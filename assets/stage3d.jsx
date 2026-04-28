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
        renderer.setSize(width, height, false);

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
            api.renderer.render(api.scene, api.camera);
          };
        }

        // First-paint wait. Fonts ready, then mark __ready and __sceneReady
        // and run a single render so frame 0 is the loaded state. Asset
        // loading (GLTF/HDRI) will move __sceneReady gating into a later
        // pass; for now first render is enough.
        const markReady = () => {
          if (cancelled) return;
          // Run the time-0 frame so any Sprite3D starting at start=0 paints.
          if (typeof window !== 'undefined' && typeof window.__renderFrame === 'function') {
            window.__renderFrame(0);
          } else {
            threeRef.current.renderer.render(threeRef.current.scene, threeRef.current.camera);
          }
          if (typeof window !== 'undefined') {
            window.__ready = true;
            window.__sceneReady = true;
          }
          setBootStatus('ready');
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

    const stageCtx = useMemo(
      () => ({
        threeApi: threeRef.current,
        time,
        duration,
        pixelRatio,
        isRecording,
        registerSprite,
        bootStatus,
      }),
      [time, duration, pixelRatio, isRecording, registerSprite, bootStatus]
    );

    // Canvas size in CSS pixels. Backbuffer is scaled by pixelRatio via
    // renderer.setPixelRatio above.
    const canvasStyle = {
      ...stage3dStyles.canvas,
      width: width,
      height: height,
      maxWidth: '100vw',
      maxHeight: '100vh',
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
    });
    Object.assign(window, {
      Stage3D,
      Sprite3D,
      useStage3D,
      useSprite3D,
    });
  }
})();
