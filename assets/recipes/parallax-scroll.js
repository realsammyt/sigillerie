// parallax-scroll.js, Sigillerie 3D Track A recipe
// Depth-parallax scroll-driven scene. Multiple content layers at different
// z-depths. Camera dollies forward as scroll/time advances, parallax happens
// for free because of perspective. Use for scrollytelling deliverables and
// animated data stories.
//
// Usage:
//   import { createParallaxScroll } from './recipes/parallax-scroll.js';
//
//   const scroll = createParallaxScroll(threeApi, {
//     layers: [
//       { z: -8, content: 'background-mountains.png', parallaxFactor: 0.1 },
//       { z: -4, content: 'middle-trees.png',         parallaxFactor: 0.4 },
//       { z: -1, content: 'foreground-text.png',      parallaxFactor: 0.8 },
//       { z:  0, content: { type: 'text', text: 'Headline',
//                            font: 'serif', size: 1.5, color: '#fff' } },
//     ],
//     cameraStart: [0, 0, 5],
//     cameraEnd:   [0, 0, -2],
//     driveBy:     'sprite-t',     // 'sprite-t' or 'window-scroll'
//     fogColor:    '#0a0a0a',
//     fogNear:     5,
//     fogFar:      20,
//   });
//   scroll.update(time, sprite_t);  // per frame
//   scroll.dispose();               // on sprite end
//
// Content shapes:
//   - string ending in .png/.jpg/.jpeg/.webp → image plane (TextureLoader)
//   - { type: 'text', text, font, size, color } → uikit panel (primary) or
//     CanvasTexture fallback when uikit unavailable or opts.renderer='canvas'
//   - { type: 'color', color } → flat color plane (cheap depth hint)
//   - THREE.Object3D → drop straight in (caller owns the mesh)
//
// parallaxFactor per layer:
//   0 = layer locks to camera (no relative motion, like a sky dome)
//   1 = full natural parallax (default, layer stays in world space)
//   any value scales the parallax effect.
//
// Self-contained. No build step. No external textures required (text and
// color layers procedural). Works under Track A inline pages.

import { applyRecipeBaseline } from '../three3d/recipe-baseline.js';

const HELPERS = (typeof window !== 'undefined' && window.Sigillerie3D && window.Sigillerie3D.helpers) || {};

// UX Law: Serial Position (§13). The camera starts on the first layer and
// ends on the last. Those are the two panels the viewer remembers most.
// Put the product hero at cameraStart target. Put the CTA or closing claim
// at the cameraEnd target. Context and supporting copy travel between them.
//
// UX Law: Peak-End Rule (§13). The animation has one moment of highest
// interest (the layer that first fully fills the frustum as the camera
// closes in) and a deliberate close (cameraEnd). Design both explicitly:
// put the peak layer at roughly z = (cameraStart[2] + cameraEnd[2]) / 2
// and let the final stationary frame be the CTA, not a transition frame.
export function createParallaxScroll(threeApi, opts = {}) {
  const THREE = threeApi.THREE;
  const scene = threeApi.scene;
  const camera = threeApi.camera;
  const renderer = threeApi.renderer;

  const cfg = {
    layers: Array.isArray(opts.layers) ? opts.layers : [],
    cameraStart: opts.cameraStart || [0, 0, 5],
    cameraEnd: opts.cameraEnd || [0, 0, -2],
    driveBy: opts.driveBy || 'sprite-t',
    fogColor: opts.fogColor || '#0a0a0a',
    fogNear: opts.fogNear != null ? opts.fogNear : 5,
    fogFar: opts.fogFar != null ? opts.fogFar : 20,
    aspectFallback: opts.aspectFallback || 16 / 9,
  };

  // camera basics. fov stays whatever the caller set, default to 50 if zero.
  if (!camera.fov) camera.fov = 50;
  camera.position.set(cfg.cameraStart[0], cfg.cameraStart[1], cfg.cameraStart[2]);
  camera.lookAt(0, 0, cfg.cameraStart[2] - 1);
  camera.updateProjectionMatrix();

  // fog gives the atmospheric depth cue. Far layers fade toward fogColor.
  const fogColor = new THREE.Color(cfg.fogColor);
  scene.fog = new THREE.Fog(fogColor, cfg.fogNear, cfg.fogFar);
  // tint the clear color so the fade reads clean even when layers are thin
  if (renderer && renderer.setClearColor) {
    renderer.setClearColor(fogColor, 1);
  }

  // disposables we own. Anything we add to scene gets removed on dispose.
  const sceneAdds = [];
  const disposables = [];
  const layerEntries = [];

  // figure out viewport aspect once. Recompute each frame if renderer size
  // changes during a recording? not in v1. Stage3D resizes canvas at mount.
  function getAspect() {
    if (renderer && renderer.domElement && renderer.domElement.clientWidth > 0) {
      return renderer.domElement.clientWidth / Math.max(1, renderer.domElement.clientHeight);
    }
    return cfg.aspectFallback;
  }

  // size a plane to fill the camera frustum at a given world z. The camera
  // sits at cameraStart for sizing because that is when layers first appear
  // at full coverage. Layers stay sized; the camera moves through them.
  function frustumSize(planeZ) {
    const camZ = cfg.cameraStart[2];
    const dist = Math.max(0.01, Math.abs(camZ - planeZ));
    const fovRad = (camera.fov * Math.PI) / 180;
    const h = 2 * dist * Math.tan(fovRad / 2);
    const w = h * getAspect();
    // pad a touch so parallax sway never reveals an edge
    return { w: w * 1.15, h: h * 1.15 };
  }

  // --- content builders ------------------------------------------------------

  function buildImagePlane(url, w, h) {
    // texture loader is sync-construct, async-load. Plane appears black until
    // the texture lands. For recording, the page contract waits on
    // window.__sceneReady, but a single-recipe call cannot block that gate.
    // Caller should set __sceneReady after createParallaxScroll has loaded.
    const loader = (HELPERS.loadTexture)
      ? null
      : new THREE.TextureLoader();
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      color: 0xffffff,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

    const onLoad = (tex) => {
      if (tex.colorSpace !== undefined) {
        tex.colorSpace = THREE.SRGBColorSpace;
      } else if (THREE.sRGBEncoding) {
        tex.encoding = THREE.sRGBEncoding;
      }
      tex.anisotropy = 4;
      mat.map = tex;
      mat.needsUpdate = true;
      disposables.push(tex);
    };

    if (HELPERS.loadTexture) {
      Promise.resolve(HELPERS.loadTexture(url)).then(onLoad).catch(() => {});
    } else {
      loader.load(url, onLoad, undefined, () => {
        // load fail, leave plane at flat color, no console spam
      });
    }
    return mesh;
  }

  // uikit panels array. update() ticks yoga; dispose() tears them down.
  const uikitPanels = [];

  function buildTextPlane(spec, w, h) {
    // PARA-1 (aesthetic §5): uikit is primary for {type:'text'} layers.
    // Falls back to CanvasTexture when:
    //   a) window.SigillerieUikit.createPanel is unavailable, or
    //   b) caller passes {renderer: 'canvas'} on the spec.
    const uikit = typeof window !== 'undefined' && window.SigillerieUikit;
    const forceCanvas = spec.renderer === 'canvas';
    if (!forceCanvas && uikit && typeof uikit.createPanel === 'function') {
      try {
        const panel = uikit.createPanel({
          type: 'text',
          text: spec.text || '',
          font: spec.font || 'serif',
          fontSize: spec.size || 1.0,
          color: spec.color || '#ffffff',
          width: w,
          height: h,
        });
        uikitPanels.push(panel);
        // uikit panels expose a Three.js Object3D on .root or .mesh
        return panel.root || panel.mesh || panel;
      } catch (err) {
        // uikit threw (e.g. Yoga WASM not ready). Fall through to canvas.
        console.warn('[parallax-scroll] uikit panel failed, using canvas fallback', err);
      }
    }

    // CanvasTexture fallback. Used when uikit unavailable or canvas opt-in.
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cw = Math.max(256, Math.round(1024 * dpr));
    const ch = Math.max(128, Math.round((1024 * h / Math.max(0.01, w)) * dpr));
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);
    const fontFam = spec.font || 'serif';
    const sizePx = Math.round((spec.size || 1.0) * 0.18 * cw);
    ctx.fillStyle = spec.color || '#ffffff';
    ctx.font = (spec.weight || '600') + ' ' + sizePx + 'px ' + fontFam;
    ctx.textAlign = spec.align || 'center';
    ctx.textBaseline = 'middle';
    if (spec.shadow !== false) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = sizePx * 0.18;
      ctx.shadowOffsetY = sizePx * 0.06;
    }
    const lines = String(spec.text || '').split('\n');
    const lineH = sizePx * 1.18;
    const startY = ch / 2 - ((lines.length - 1) * lineH) / 2;
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], cw / 2, startY + i * lineH);
    }
    const tex = new THREE.CanvasTexture(c);
    if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    disposables.push(tex);
    return mesh;
  }

  function buildColorPlane(spec, w, h) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.color || '#222'),
      transparent: spec.opacity != null,
      opacity: spec.opacity != null ? spec.opacity : 1,
      depthWrite: false,
      fog: true,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    return mesh;
  }

  function isImageUrl(s) {
    return /\.(png|jpg|jpeg|webp|avif)(\?.*)?$/i.test(s);
  }

  // build every layer once
  for (let i = 0; i < cfg.layers.length; i += 1) {
    const layer = cfg.layers[i];
    if (!layer) continue;
    const z = layer.z != null ? layer.z : -i;
    const pf = layer.parallaxFactor != null ? layer.parallaxFactor : 1;
    const size = frustumSize(z);

    let mesh = null;
    const content = layer.content;
    if (typeof content === 'string') {
      if (isImageUrl(content)) {
        mesh = buildImagePlane(content, size.w, size.h);
      } else {
        // bare string treated as text content
        mesh = buildTextPlane({ type: 'text', text: content }, size.w, size.h);
      }
    } else if (content && typeof content === 'object') {
      if (content.isObject3D) {
        mesh = content;
      } else if (content.type === 'text') {
        mesh = buildTextPlane(content, size.w, size.h);
      } else if (content.type === 'color') {
        mesh = buildColorPlane(content, size.w, size.h);
      }
    }

    if (!mesh) continue;
    mesh.position.set(layer.x || 0, layer.y || 0, z);
    if (mesh.geometry && mesh.geometry.type === 'PlaneGeometry') {
      // planes face +z by default, camera looks down -z. We want planes facing
      // the camera, which is already the case for default plane orientation.
    }
    if (layer.opacity != null && mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = layer.opacity;
    }
    mesh.renderOrder = i;
    scene.add(mesh);
    sceneAdds.push(mesh);
    layerEntries.push({
      mesh,
      baseZ: z,
      baseX: layer.x || 0,
      baseY: layer.y || 0,
      parallaxFactor: pf,
    });
  }

  // --- postprocessing baseline (PARA-3, aesthetic §4 / §12) -----------------
  const post = applyRecipeBaseline(threeApi);
  if (post.composer) {
    threeApi.draw = () => post.composer.render();
  }

  // --- scroll source ---------------------------------------------------------
  // sprite-t mode reads from update(t, sprite_t).
  // window-scroll mode reads from window.scrollY versus document height.

  let scrollListener = null;
  let cachedScrollT = 0;

  function readWindowScrollT() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
    const max = Math.max(1, (document.documentElement.scrollHeight || 0) - window.innerHeight);
    const y = window.scrollY || window.pageYOffset || 0;
    return Math.min(1, Math.max(0, y / max));
  }

  if (cfg.driveBy === 'window-scroll' && typeof window !== 'undefined') {
    cachedScrollT = readWindowScrollT();
    scrollListener = () => { cachedScrollT = readWindowScrollT(); };
    window.addEventListener('scroll', scrollListener, { passive: true });
  }

  // --- per-frame update ------------------------------------------------------
  // t = absolute seconds from sprite start. sprite_t = 0..1 normalized.
  function update(t, sprite_t) {
    // tick uikit yoga layout per frame (PARA-1)
    for (const panel of uikitPanels) {
      if (panel && typeof panel.update === 'function') panel.update();
    }

    let s;
    if (cfg.driveBy === 'window-scroll') {
      s = cachedScrollT;
    } else {
      s = (sprite_t != null) ? sprite_t : Math.min(1, Math.max(0, (t || 0) / 6));
    }

    // camera position lerps cameraStart → cameraEnd as s goes 0 → 1
    const cs = cfg.cameraStart, ce = cfg.cameraEnd;
    const cx = cs[0] + (ce[0] - cs[0]) * s;
    const cy = cs[1] + (ce[1] - cs[1]) * s;
    const cz = cs[2] + (ce[2] - cs[2]) * s;
    camera.position.set(cx, cy, cz);
    // keep looking forward (down -z) so framing stays stable
    camera.lookAt(cx, cy, cz - 1);

    // parallaxFactor: 0 means layer follows camera (no relative motion).
    // 1 means layer stays in world space (full natural parallax).
    // We achieve "follow camera" by sliding the layer toward the camera by
    // (1 - pf) * camera_delta. pf = 1 → no slide. pf = 0 → full slide.
    for (let i = 0; i < layerEntries.length; i += 1) {
      const L = layerEntries[i];
      const dx = cx - cs[0];
      const dy = cy - cs[1];
      const dz = cz - cs[2];
      const lock = 1 - L.parallaxFactor;
      L.mesh.position.set(
        L.baseX + dx * lock,
        L.baseY + dy * lock,
        L.baseZ + dz * lock
      );
    }
  }

  // --- dispose ---------------------------------------------------------------
  function dispose() {
    if (scrollListener && typeof window !== 'undefined') {
      window.removeEventListener('scroll', scrollListener);
      scrollListener = null;
    }
    for (const obj of sceneAdds) {
      if (obj && obj.parent) obj.parent.remove(obj);
      if (obj && obj.geometry && typeof obj.geometry.dispose === 'function') {
        obj.geometry.dispose();
      }
      if (obj && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m && typeof m.dispose === 'function') m.dispose();
        }
      }
    }
    for (const d of disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    // tear down uikit panels (PARA-1)
    for (const panel of uikitPanels) {
      if (panel && typeof panel.dispose === 'function') panel.dispose();
    }
    uikitPanels.length = 0;
    if (scene.fog) scene.fog = null;
    post.dispose();
  }

  return {
    update,
    dispose,
    get layers() { return layerEntries.map((L) => L.mesh); },
    get scrollT() {
      return cfg.driveBy === 'window-scroll' ? cachedScrollT : null;
    },
  };
}

// expose on window for cross-script-tag access (Track A inline pages)
if (typeof window !== 'undefined') {
  Object.assign(window, { createParallaxScroll });
}
