/**
 * stage3d.jsx · Sigillerie 3D React layer (Track A)
 *
 * Sibling to assets/animations.jsx. Same time-slice mental model:
 *
 *   <Stage3D duration={8}>
 *     <Sprite3D start={0.4} end={8}>
 *       {(threeApi, t) => {
 *         // threeApi: { scene, camera, renderer, THREE, clock, frame, useWebGPU, group }
 *         // t: 0..1 normalized within this Sprite's window
 *         threeApi.scene.rotation.y = t * Math.PI;
 *       }}
 *     </Sprite3D>
 *   </Stage3D>
 *
 * Hard requirements (from HUASHU-3D-FORK-PLAN §3.3 + SIGILLERIE-REPO-PLAN §2.8):
 *   - Single canvas at WIDTH x HEIGHT, drawingBufferSize x pixelRatio.
 *   - WebGLRenderer color management: SRGBColorSpace, ACESFilmicToneMapping,
 *     toneMappingExposure 1.0, THREE.ColorManagement.enabled = true.
 *   - WebGPURenderer when Sigillerie3D.useWebGPU is true (interactive only).
 *   - Page contract owned: __capabilities, __ready, __sceneReady,
 *     __renderFrame, __duration, __recording.
 *   - Recording skips rAF loop. External caller drives via __renderFrame(t_ms).
 *
 * Sprite3D callbacks run every frame. Recipes mount geometry once via refs
 * or a useState pin; they MUST NOT re-create geometry per call. Stage3D
 * disposes the cached three resources on unmount.
 */

(function () {
  const { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } =
    React;

  // Bail if the loader module hasn't published Sigillerie3D yet. The HTML
  // wiring loads three3d-loader.js before this file, so this is a sanity
  // check, not a normal path.
  if (typeof window === 'undefined' || !window.Sigillerie3D) {
    console.error('[Stage3D] Sigillerie3D namespace missing. Load three3d-loader.js first.');
    return;
  }

  const THREE = window.Sigillerie3D.THREE;
  const useWebGPU = window.Sigillerie3D.useWebGPU;
  const loadWebGPURenderer = window.Sigillerie3D.loadWebGPURenderer;

  // ---- Contexts ----------------------------------------------------------
  // Stage3DContext exposes the live three.js api. Sprite3DContext exposes
  // local-window progress, mirror of the 2D SpriteContext.

  const Stage3DContext = createContext({
    threeApi: null,
    time: 0,
    duration: 8,
    pixelRatio: 1,
    isRecording: false,
    registerSprite: () => () => {},
    aspect: 16 / 9,
    layout: 'wide',
  });
  const Sprite3DContext = createContext(null);

  function useStage3D() {
    return useContext(Stage3DContext);
  }

  function useSprite3D() {
    const v = useContext(Sprite3DContext);
    if (!v) return { t: 0, elapsed: 0, duration: 0, start: 0, end: 0 };
    return v;
  }

  // ---- Adaptive layout helpers -----------------------------------------
  // Viewport-aware classification + recipe-friendly camera/grid presets.
  // Pure functions so they're safe to call from non-React consumers via
  // window.SigillerieAdaptive.

  // caveman: classify aspect into a layout bucket. Boundaries chosen so
  // 16:9 lands "wide", 1:1 lands "square", phones land "portrait", cinema
  // ratios (21:9, 32:9) land "ultrawide".
  function layoutForAspect(aspect) {
    if (aspect > 2.4) return 'ultrawide';
    if (aspect > 1.5) return 'wide';
    if (aspect > 0.9) return 'square';
    return 'portrait';
  }

  // caveman: per-layout camera defaults. Recipes call cameraForLayout()
  // and apply { fov, pos, target } to their PerspectiveCamera. Numbers
  // tuned against the aesthetic doc §6 (default fov 35) with adjustments
  // for narrow / wide framings.
  function cameraForLayout(layout) {
    switch (layout) {
      case 'ultrawide':
        // closer in + flatter fov so caps/status read at proper size, not
        // as thumbnails on the wings. FOV 28 -> 42 + z 7.2 -> 10 + paired
        // with arcRadius drop 9 -> 6 below so the wide panels fit the camera.
        return { fov: 42, pos: [0, 0.1, 10.0], target: [0, 0, 0] };
      case 'square':
        // back enough that 2x2 grid breathes; flatter z-recede (below) means
        // the bottom row no longer reads tiny.
        return { fov: 42, pos: [0, 0.2, 8.4], target: [0, -0.1, 0] };
      case 'portrait':
        // wider fov so 4 stacked panels fit vertically without crowding;
        // taller frame needs more vertical reach, not closer camera.
        return { fov: 50, pos: [0, 0, 7.4], target: [0, 0, 0] };
      case 'wide':
      default:
        // classic hero: third-line offset, slight tilt-up for headroom.
        // FOV 34 -> 46, z 5.6 -> 8.0 so the full arc fits without right-edge
        // crop on the hero panel. Paired with arcRadius tighten below.
        return { fov: 46, pos: [0.2, 0.25, 8.0], target: [0, -0.05, 0] };
    }
  }

  // caveman: aspect-aware panel grid. Returns N transforms for N panels.
  // Patterns:
  //   wide: horizontal arc, panels rotated to face center
  //   square: 2x2 grid with z-stagger so depth reads
  //   portrait: vertical stack
  //   ultrawide: shallow arc across a long horizontal span
  //
  // scales (optional): per-slot footprint array. Each entry is that slot's
  // world-space width (panel width times its scale factor). When present,
  // the wide/ultrawide rows space slots so every adjacent gap clears the
  // half-width sums (a hero-scaled panel no longer swallows its neighbors)
  // and scaled-up slots come forward, toward the camera, instead of
  // sinking deeper into the arc. Missing entries assume a ~2.2 unit panel.
  function gridForLayout(layout, count, scales) {
    const n = Math.max(1, count | 0);
    const out = [];
    if (n === 1) {
      out.push({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
      return out;
    }

    // Per-slot world footprints. Default approximates a uikit panel so
    // scale-less callers still get gaps that clear typical panels.
    const widths = [];
    for (let i = 0; i < n; i += 1) {
      const v = Array.isArray(scales) ? scales[i] : null;
      widths.push(typeof v === 'number' && v > 0 ? v : 2.2);
    }

    if (layout === 'portrait') {
      // vertical stack with asymmetric x-shift so it doesn't read PowerPoint.
      // step is tuned so panels don't overlap each other (uikit panels are
      // ~1.6 units tall) at portrait camera fov 50.
      const step = Math.min(1.65, 5.6 / n);
      const startY = ((n - 1) / 2) * step;
      for (let i = 0; i < n; i += 1) {
        // alternating slight x-shift breaks the dead-center column.
        const xShift = (i % 2 === 0 ? -0.18 : 0.22);
        // gentle z-recede so bottom panels still read at full size.
        const zShift = -i * 0.08;
        out.push({
          position: [xShift, startY - i * step, zShift],
          rotation: [0, xShift > 0 ? -0.05 : 0.05, 0],
          scale: [1, 1, 1],
        });
      }
      return out;
    }

    if (layout === 'square') {
      // 2x2 grid. Hero (slot 0) sits top-left and forward; subtitle top-
      // right; caps + status on bottom row receding. Generous spacing so
      // the hero doesn't crash into its neighbor; widen the column step
      // when a footprint pair demands more room.
      const cols = 2;
      const rows = Math.ceil(n / cols);
      let xStep = 3.2;
      for (let i = 0; i + 1 < n; i += 1) {
        if (i % cols === 0) {
          xStep = Math.max(xStep, (widths[i] + widths[i + 1]) / 2 + 0.3);
        }
      }
      const yStep = 2.0;
      for (let i = 0; i < n; i += 1) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const colsThisRow = (r === rows - 1 && n % cols === 1) ? 1 : cols;
        const cx = (c - (colsThisRow - 1) / 2) * xStep;
        const cy = ((rows - 1) / 2 - r) * yStep;
        // gentler depth ladder: hero forward, top row near, bottom row
        // slightly recessed. Avoids bottom-row panels reading too small.
        const cz = i === 0 ? 0.10 : (r === 0 ? -0.05 : -0.20);
        // every panel toes-in toward center for a faint vitrine curve.
        const yaw = -cx * 0.08;
        out.push({
          position: [cx, cy, cz],
          rotation: [0, yaw, 0],
          scale: [1, 1, 1],
        });
      }
      return out;
    }

    // wide + ultrawide: a footprint-spaced horizontal row on a shallow arc.
    // The old fixed arc span packed n=4 slots into ~5.3 units of x, so a
    // hero-scaled panel (~4 units wide) overlapped both neighbors, and the
    // arc put center slots DEEPER than the wings (hero behind supporting
    // panels). Now adjacent gaps clear the half-width sums and depth comes
    // from footprint: the biggest slot sits most forward (toward the
    // camera), small slots recede. Cameras unchanged (wide fov 46 + z 8.0,
    // ultrawide fov 42 + z 10.0).
    const isUltra = layout === 'ultrawide';
    const arcRadius = isUltra ? 9.0 : 5.2;
    const marginX = isUltra ? 0.9 : 0.3;
    const yawFactor = isUltra ? 0.55 : 0.7;

    // cumulative x: each gap = half-width sum + breathing margin.
    const xs = [0];
    for (let i = 1; i < n; i += 1) {
      xs.push(xs[i - 1] + (widths[i - 1] + widths[i]) / 2 + marginX);
    }

    let wMin = Infinity;
    let wMax = -Infinity;
    for (let i = 0; i < n; i += 1) {
      if (widths[i] < wMin) wMin = widths[i];
      if (widths[i] > wMax) wMax = widths[i];
    }
    const wSpan = wMax - wMin;

    // depth ladder from footprint: -0.15 (smallest, recedes) up to +0.35
    // (biggest, forward). Uniform rows sit flat mid-ladder.
    const zs = [];
    for (let i = 0; i < n; i += 1) {
      const zf = wSpan > 0 ? (widths[i] - wMin) / wSpan : 0.5;
      zs.push(-0.15 + zf * 0.5);
    }

    // center the row extents on x = 0.
    const recenter = () => {
      const shift =
        (xs[0] - widths[0] / 2 + xs[n - 1] + widths[n - 1] / 2) / 2;
      for (let i = 0; i < n; i += 1) xs[i] -= shift;
    };
    recenter();

    // Screen-space clearance pass. Slots sit at different depths and toe
    // in toward center, so world gaps that look safe can still overlap
    // after projection: a forward slot's near edge swings toward the
    // camera and projects wider, while the neighbor's toed-in edge
    // recedes. Check each adjacent pair's projected edges against the
    // layout's paired camera (cameraForLayout) and widen any deficit.
    const cam = cameraForLayout(layout);
    const camX = cam.pos[0];
    const camZ = cam.pos[2];
    const yawAt = (x) => -(x / arcRadius) * yawFactor;
    // angle here is the projected slope (x over depth) of a slot edge;
    // side -1 = left edge, +1 = right edge.
    const edgeAngle = (i, side) => {
      const yaw = yawAt(xs[i]);
      const half = widths[i] / 2;
      const ex = xs[i] + side * half * Math.cos(yaw);
      const ez = zs[i] - side * half * Math.sin(yaw);
      return (ex - camX) / Math.max(0.5, camZ - ez);
    };
    const angPad = 0.03; // projected seam between neighbors
    for (let sweep = 0; sweep < 3; sweep += 1) {
      for (let i = 1; i < n; i += 1) {
        const deficit = edgeAngle(i - 1, 1) + angPad - edgeAngle(i, -1);
        if (deficit > 0) {
          const push = deficit * Math.max(0.5, camZ - zs[i]);
          for (let j = i; j < n; j += 1) xs[j] += push;
        }
      }
      recenter();
    }

    for (let i = 0; i < n; i += 1) {
      out.push({
        position: [xs[i], 0, zs[i]],
        rotation: [0, yawAt(xs[i]), 0],
        scale: [1, 1, 1],
      });
    }
    return out;
  }

  // Hook: returns current viewport aspect + layout class. Re-fires on
  // viewport resize because Stage3D updates the context state below.
  function useAspect() {
    const ctx = useContext(Stage3DContext);
    return {
      aspect: ctx.aspect != null ? ctx.aspect : 16 / 9,
      layout: ctx.layout || 'wide',
    };
  }

  // Mount adaptive helpers on a global namespace so vanilla recipes
  // (no React) can use the same camera/grid logic.
  if (typeof window !== 'undefined') {
    window.SigillerieAdaptive = {
      layoutForAspect,
      cameraForLayout,
      gridForLayout,
    };
  }

  // ---- Styles ------------------------------------------------------------

  const stage3dStyles = {
    wrapper: {
      position: 'fixed',
      inset: 0,
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    canvas: {
      display: 'block',
    },
    overlay: {
      position: 'fixed',
      bottom: 12,
      left: 12,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 11,
      pointerEvents: 'none',
    },
  };

  // ---- Stage3D -----------------------------------------------------------

  function Stage3D(props) {
    const width = props.width != null ? props.width : 1920;
    const height = props.height != null ? props.height : 1080;
    const duration = props.duration != null ? props.duration : 8;
    const loop = props.loop != null ? props.loop : true;
    const bgColor = props.bgColor != null ? props.bgColor : '#0a0a0a';
    const cameraType = props.cameraType || 'perspective';
    const cameraFov = props.cameraFov != null ? props.cameraFov : 50;
    const cameraPos = props.cameraPos || [0, 0, 5];
    const cameraNear = props.cameraNear != null ? props.cameraNear : 0.1;
    const cameraFar = props.cameraFar != null ? props.cameraFar : 1000;

    // Recording flag read once at mount. Same caching as the 2D Stage.
    const isRecording = useMemo(
      () => (typeof window !== 'undefined' ? !!window.__recording : false),
      []
    );

    // pixelRatio default: prop -> devicePixelRatio -> 1.
    const pixelRatio = useMemo(() => {
      if (props.pixelRatio != null) return props.pixelRatio;
      if (typeof window !== 'undefined' && window.devicePixelRatio) {
        return window.devicePixelRatio;
      }
      return 1;
    }, [props.pixelRatio]);

    const canvasRef = useRef(null);
    const threeRef = useRef(null); // { scene, camera, renderer, clock, group }
    const spritesRef = useRef([]); // [{ start, end, render }]
    const rafRef = useRef(null);
    const [time, setTime] = useState(0);
    const [bootStatus, setBootStatus] = useState('booting');

    // Viewport-aware state. Initial value seeded from window inner-size so
    // the first render of children sees a real layout class, not the
    // stage's nominal width/height (which is the backbuffer size, not the
    // visible aspect).
    const [viewport, setViewport] = useState(() => {
      // caveman: prefer real viewport; fall back to nominal stage aspect.
      const vw = (typeof window !== 'undefined' && window.innerWidth) || width;
      const vh = (typeof window !== 'undefined' && window.innerHeight) || height;
      const a = vw > 0 && vh > 0 ? vw / vh : (width / height);
      return { aspect: a, layout: layoutForAspect(a) };
    });

    // Sprite registration. Children call this in an effect; returns an
    // unregister function. Each entry stores the render callback ref so
    // hot-edits during dev don't stale-close.
    const registerSprite = useCallback((entry) => {
      spritesRef.current.push(entry);
      return () => {
        const i = spritesRef.current.indexOf(entry);
        if (i >= 0) spritesRef.current.splice(i, 1);
      };
    }, []);

    // ---- Boot the three.js scene ---------------------------------------
    // Async because WebGPURenderer needs to await its own init() call.
    useEffect(() => {
      let cancelled = false;

      async function boot() {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Color management is global. Set once before any material exists.
        THREE.ColorManagement.enabled = true;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(bgColor);

        // Camera. Perspective default; orthographic available for iso shots.
        let camera;
        if (cameraType === 'orthographic') {
          const aspect = width / height;
          const halfH = 1;
          const halfW = halfH * aspect;
          camera = new THREE.OrthographicCamera(
            -halfW,
            halfW,
            halfH,
            -halfH,
            cameraNear,
            cameraFar
          );
        } else {
          camera = new THREE.PerspectiveCamera(
            cameraFov,
            width / height,
            cameraNear,
            cameraFar
          );
        }
        camera.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
        camera.lookAt(0, 0, 0);

        // Renderer. WebGPU when available + not recording, else WebGL2.
        let renderer = null;
        let usedBackend = 'webgl2';
        if (useWebGPU) {
          const WebGPURenderer = await loadWebGPURenderer();
          if (WebGPURenderer) {
            try {
              renderer = new WebGPURenderer({
                canvas,
                antialias: true,
                alpha: false,
              });
              await renderer.init();
              usedBackend = 'webgpu';
            } catch (err) {
              console.warn('[Stage3D] WebGPU init failed, dropping to WebGL2', err);
              renderer = null;
            }
          }
        }
        if (!renderer) {
          renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: isRecording, // recorder reads back via CDP
          });
        }

        // Color pipeline per modes/three3d/color-management.md plan.
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.setPixelRatio(pixelRatio);

        // caveman: recording = pin to nominal stage size; interactive = fill
        // visible viewport so portrait/ultrawide actually paint into the
        // tall/long frame.
        if (isRecording) {
          renderer.setSize(width, height, false);
        } else {
          const vw = (typeof window !== 'undefined' && window.innerWidth) || width;
          const vh = (typeof window !== 'undefined' && window.innerHeight) || height;
          renderer.setSize(vw, vh, false);
          // Camera aspect must match the actual viewport, not the nominal stage.
          if (camera.isPerspectiveCamera) {
            camera.aspect = vw / vh;
            camera.updateProjectionMatrix();
          }
        }

        if (cancelled) {
          renderer.dispose && renderer.dispose();
          return;
        }

        const clock = new THREE.Clock(false);
        // Root group lets recipes add meshes to threeApi.group instead of
        // mutating the scene root. Cleaner disposal path.
        const group = new THREE.Group();
        scene.add(group);

        threeRef.current = {
          scene,
          camera,
          renderer,
          clock,
          group,
          THREE,
          frame: 0,
          useWebGPU: usedBackend === 'webgpu',
          backend: usedBackend,
          // Recipes can replace this with a postprocessing composer call,
          // e.g. api.draw = () => composer.render(). When null/undefined,
          // __renderFrame falls back to the plain renderer.render(scene, camera).
          draw: null,
        };

        // Update __capabilities with the actual chosen backend.
        if (typeof window !== 'undefined') {
          window.__capabilities = {
            webgpu: usedBackend === 'webgpu',
            webxr:
              typeof navigator !== 'undefined' &&
              typeof navigator.xr !== 'undefined' &&
              navigator.xr !== null,
            modelViewer:
              typeof customElements !== 'undefined' &&
              customElements.get('model-viewer') != null,
            audio: 'static',
          };
        }

        // Wire the page contract render hook. The recorder calls this per
        // frame in --mode=3d. Walks every Sprite3D, calls its callback at
        // the right local-t, then renders synchronously.
        if (typeof window !== 'undefined') {
          window.__duration = duration;
          window.__renderFrame = function renderFrameAt(t_ms) {
            const t_s = t_ms / 1000;
            const api = threeRef.current;
            if (!api) return;
            // Mirror clock to the requested time. Recipes that read
            // api.clock.elapsedTime (e.g. uniform.time) get the right
            // wall-clock-equivalent value without ever touching Date.now.
            api.clock.elapsedTime = t_s;
            api.frame = Math.round(t_ms / (1000 / 60));
            // Publish the frame time on the namespace so time-driven post
            // passes (tsl-effects film grain) can seek from absolute scene
            // time instead of the wall clock.
            if (window.Sigillerie3D) window.Sigillerie3D.frameTime = t_s;

            const list = spritesRef.current;
            for (let i = 0; i < list.length; i++) {
              const s = list[i];
              if (t_s < s.start || t_s >= s.end) continue;
              const span = s.end - s.start;
              const localT = span <= 0 ? 1 : (t_s - s.start) / span;
              const cb = s.renderRef && s.renderRef.current;
              if (typeof cb === 'function') {
                cb(api, Math.max(0, Math.min(1, localT)), t_s);
              }
            }
            if (typeof api.draw === 'function') {
              api.draw();
            } else {
              api.renderer.render(api.scene, api.camera);
            }
          };
        }

        // First-paint wait. Fonts ready, then paint once so sprites mount
        // and recipes kick off their asset loads, then await every load
        // registered in window.__sceneAssets.pending (the registry
        // three-helpers.js and the recipes maintain), repaint frame 0 with
        // the loaded assets, and only then signal __ready + __sceneReady.
        const markReady = () => {
          if (cancelled) return;
          // Flip bootStatus first so React commits the children and their
          // Sprite3Ds register via useEffect. We must NOT signal __ready yet,
          // or the recorder starts capturing before sprites are in
          // spritesRef.current and the early frames render an empty scene.
          setBootStatus('ready');
          // Wait two animation frames + a microtask flush so:
          //   - React commits children (1 rAF after setBootStatus)
          //   - Children's useEffects run, registering sprites (next rAF)
          // Only THEN run __renderFrame(0) to paint the populated scene.
          const renderFrame0 = () => {
            if (typeof window !== 'undefined' && typeof window.__renderFrame === 'function') {
              window.__renderFrame(0);
            } else {
              const api = threeRef.current;
              if (!api) return;
              if (typeof api.draw === 'function') {
                api.draw();
              } else {
                api.renderer.render(api.scene, api.camera);
              }
            }
          };
          // Await the asset registry. Loops because a settled load can
          // register a follow-up load; allSettled so a 404 never wedges
          // the gate.
          const settleAssets = (seen) => {
            if (cancelled) return;
            const reg = typeof window !== 'undefined' ? window.__sceneAssets : null;
            const pending = (reg && reg.pending) || [];
            if (pending.length <= seen) {
              renderFrame0();
              if (typeof window !== 'undefined') {
                window.__ready = true;
                window.__sceneReady = true;
              }
              return;
            }
            Promise.allSettled(pending.slice()).then(() => settleAssets(pending.length));
          };
          const finalize = () => {
            if (cancelled) return;
            renderFrame0();
            settleAssets(0);
          };
          if (typeof requestAnimationFrame === 'function' && !window.__recording) {
            requestAnimationFrame(() => requestAnimationFrame(finalize));
          } else {
            setTimeout(finalize, 32);
          }
        };
        if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
          document.fonts.ready.then(markReady);
          setTimeout(markReady, 200);
        } else {
          setTimeout(markReady, 100);
        }
      }

      boot();

      return () => {
        cancelled = true;
        // Dispose three resources. Walk the scene, dispose geometries,
        // materials, textures.
        const api = threeRef.current;
        if (api) {
          api.scene.traverse((obj) => {
            if (obj.geometry && typeof obj.geometry.dispose === 'function') {
              obj.geometry.dispose();
            }
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((m) => {
                Object.keys(m).forEach((k) => {
                  const v = m[k];
                  if (v && v.isTexture && typeof v.dispose === 'function') v.dispose();
                });
                if (typeof m.dispose === 'function') m.dispose();
              });
            }
          });
          if (api.renderer && typeof api.renderer.dispose === 'function') {
            api.renderer.dispose();
          }
        }
        threeRef.current = null;
        if (typeof window !== 'undefined') {
          if (window.__renderFrame) delete window.__renderFrame;
        }
      };
      // Boot once. Stage3D props are intentionally non-reactive to avoid
      // tearing down the renderer mid-record. Change a recipe's seed by
      // remounting the whole Stage.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- Drive the clock (interactive only) ----------------------------
    // Recording mode skips this entirely; the recorder calls __renderFrame
    // directly per frame.
    useEffect(() => {
      if (isRecording) return;
      if (bootStatus !== 'ready') return;

      let cancelled = false;
      let lastWall = null;
      let localTime = 0;

      function tick(now) {
        if (cancelled) return;
        if (lastWall === null) lastWall = now;
        const delta = (now - lastWall) / 1000;
        lastWall = now;
        localTime += delta;
        if (localTime >= duration) {
          localTime = loop ? 0 : duration - 0.001;
        }
        setTime(localTime);
        if (typeof window !== 'undefined' && typeof window.__renderFrame === 'function') {
          window.__renderFrame(localTime * 1000);
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        cancelled = true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [bootStatus, isRecording, duration, loop]);

    // ---- Resize subscription -------------------------------------------
    // Keep aspect/layout state in sync with the visible viewport. Recording
    // mode pins to the nominal stage size since the recorder never resizes.
    useEffect(() => {
      if (typeof window === 'undefined') return undefined;
      if (isRecording) return undefined;

      function onResize() {
        const vw = window.innerWidth || width;
        const vh = window.innerHeight || height;
        const a = vw > 0 && vh > 0 ? vw / vh : (width / height);
        const next = layoutForAspect(a);

        // caveman: in interactive mode the canvas backbuffer follows the
        // viewport so portrait/ultrawide actually paint into the tall/long
        // frame (no letterbox bars). Camera aspect + composer get the same
        // size so post-stack passes stay in sync.
        const api = threeRef.current;
        if (api && api.renderer && api.camera) {
          api.renderer.setSize(vw, vh, false);
          if (api.camera.isPerspectiveCamera) {
            api.camera.aspect = a;
            api.camera.updateProjectionMatrix();
          }
          // Notify any post-pipeline composer attached by a preset.
          if (typeof api.onResize === 'function') {
            api.onResize(vw, vh);
          }
        }

        // caveman: only re-render when the bucket changes OR aspect drifts
        // by more than 1% (avoids per-pixel React churn during resize).
        setViewport((prev) => {
          if (prev.layout === next && Math.abs(prev.aspect - a) < 0.01) return prev;
          return { aspect: a, layout: next };
        });
      }

      window.addEventListener('resize', onResize, { passive: true });
      // Run once after mount in case the seed used stale dimensions.
      onResize();
      return () => window.removeEventListener('resize', onResize);
    }, [isRecording, width, height]);

    const stageCtx = useMemo(
      () => ({
        threeApi: threeRef.current,
        time,
        duration,
        pixelRatio,
        isRecording,
        registerSprite,
        bootStatus,
        aspect: viewport.aspect,
        layout: viewport.layout,
      }),
      [time, duration, pixelRatio, isRecording, registerSprite, bootStatus, viewport]
    );

    // Canvas display size. Recording mode pins to the nominal stage aspect
    // (width x height) so MP4 export gets a fixed-size canvas. Interactive
    // mode fills the actual viewport so portrait and ultrawide aspects
    // compose into the visible frame (no letterbox bars).
    const canvasStyle = isRecording
      ? {
          ...stage3dStyles.canvas,
          width: 'auto',
          height: 'auto',
          maxWidth: '100vw',
          maxHeight: '100vh',
          aspectRatio: `${width} / ${height}`,
        }
      : {
          ...stage3dStyles.canvas,
          width: '100vw',
          height: '100vh',
        };

    return (
      <Stage3DContext.Provider value={stageCtx}>
        <div style={stage3dStyles.wrapper}>
          <canvas ref={canvasRef} width={width} height={height} style={canvasStyle} />
          {bootStatus === 'ready' ? props.children : null}
          {!isRecording && bootStatus !== 'ready' ? (
            <div style={stage3dStyles.overlay}>three.js booting...</div>
          ) : null}
        </div>
      </Stage3DContext.Provider>
    );
  }

  // ---- Sprite3D ----------------------------------------------------------

  function Sprite3D(props) {
    const start = props.start != null ? props.start : 0;
    const end = props.end != null ? props.end : Infinity;
    const children = props.children;

    const stage = useContext(Stage3DContext);
    const renderRef = useRef(null);

    // Keep the latest callback in a ref so __renderFrame walks always call
    // the current closure even if the recipe re-renders with new captured
    // values.
    if (typeof children === 'function') {
      renderRef.current = children;
    }

    useEffect(() => {
      if (!stage.registerSprite) return;
      const entry = { start, end, renderRef };
      const unregister = stage.registerSprite(entry);
      return unregister;
    }, [stage, start, end]);

    // Local progress mirrors the 2D engine. Even though the callback gets
    // its own t, exposing useSprite3D() to descendants matches the 2D
    // pattern for drop-in muscle memory.
    const t_s = stage.time;
    let local;
    if (t_s < start || t_s >= end) {
      local = { t: 0, elapsed: 0, duration: end - start, start, end, active: false };
    } else {
      const span = end - start;
      const elapsed = t_s - start;
      const t = span <= 0 ? 1 : Math.max(0, Math.min(1, elapsed / span));
      local = { t, elapsed, duration: span, start, end, active: true };
    }

    return (
      <Sprite3DContext.Provider value={local}>
        {/* Sprite3D renders nothing into the DOM. Its job is to register a
            three.js render callback with the Stage. JSX-style children that
            aren't functions are treated as element-children that may use
            useSprite3D() and useStage3D() to read state. */}
        {typeof children === 'function' ? null : children}
      </Sprite3DContext.Provider>
    );
  }

  // ---- Export ------------------------------------------------------------

  if (typeof window !== 'undefined') {
    window.Sigillerie3D = Object.assign(window.Sigillerie3D || {}, {
      Stage3D,
      Sprite3D,
      useStage3D,
      useSprite3D,
      useAspect,
      layoutForAspect,
      cameraForLayout,
      gridForLayout,
    });
    Object.assign(window, {
      Stage3D,
      Sprite3D,
      useStage3D,
      useSprite3D,
      useAspect,
    });
  }
})();
