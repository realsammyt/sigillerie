---
name: pitfalls
description: 12 named 3D pitfalls with detection and fix. Covers pixel-ratio, time sources, async assets, render loop gating, z-fighting, tone-mapping, SSAA, GC leaks, loaders, WebXR capture, HDRI shadows, glTF gotchas.
---

# 3D Pitfalls

Each entry is a real failure mode. Read this before authoring a 3D scene. Same tone as `modes/producer/animation-pitfalls.md`. The page contract is in `page-contract.md`. The architecture decision tree is in `architecture.md`.

## 1. Pixel-ratio mismatch in scaled containers

**Looks like**: Stage applies CSS `transform: scale(0.625)` to fit a 1920x1080 canvas in a 1200x675 viewport. WebGL backbuffer renders at the unscaled DPR. Output looks soft and antialiasing breaks at glancing angles.

**Why**: `renderer.setPixelRatio(window.devicePixelRatio)` reads the unscaled DPR. CSS transform scales the canvas surface after the GPU draws. The browser bilinear-filters the result on display. Capture path catches the same softness because Playwright screenshots the post-CSS surface.

**Detect**: zoom in on a thin diagonal edge. If it's blurry beyond what 4x SSAA should give, pixel ratio is wrong.

**Fix**: read the live transform scale and multiply.

```js
function effectivePixelRatio() {
  const stage = document.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const designWidth = parseFloat(stage.dataset.designWidth || 1920);
  const stageScale = rect.width / designWidth;
  return window.devicePixelRatio * stageScale;
}
renderer.setPixelRatio(effectivePixelRatio());
window.addEventListener('resize', () => renderer.setPixelRatio(effectivePixelRatio()));
```

Stage3D wires this automatically. Hand-written 3D scenes must do it explicitly.

## 2. `Date.now` and `Clock.getDelta` killing deterministic capture

**Looks like**: scene plays fine in the browser. Recorder MP4 has the model rotating about 8% slower than expected. Audio cues land 0.4 s off from where the storyboard placed them.

**Why**: `Date.now()`, `performance.now()`, and `THREE.Clock` all read wall-clock time. The recorder uses CDP `HeadlessExperimental.beginFrame` to step virtual frames at exact 1000/60 ms intervals. Wall-clock advances faster than virtual time, so the page integrates extra rotation per recorder step.

**Detect**: count frames in the MP4 with `ffprobe`. Compare to `__duration * 60`. If MP4 is short, wall-clock is leaking.

**Fix**: route every animated value through `__renderFrame(t_ms)`. Use `t_ms` as the only time source.

```js
// bad
function animate() {
  const dt = clock.getDelta();
  model.rotation.y += dt * 0.5;
  mixer.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// good
window.__renderFrame = (t_ms) => {
  const t = t_ms / 1000;
  model.rotation.y = t * 0.5;
  mixer.setTime(t);
  renderer.render(scene, camera);
};
```

`mixer.setTime(t)` is seekable. `mixer.update(dt)` is not. See `page-contract.md` for the full rule.

## 3. Async asset loading not awaited before `__sceneReady`

**Looks like**: `__sceneReady = true` fires immediately after creating the GLTFLoader. Recorder starts capturing. First 1.5 s of MP4 shows missing geometry, then the model pops in mid-shot.

**Why**: `loader.load(url, onLoad)` is callback form. The `onLoad` callback runs after the next line. The page sets `__sceneReady = true` before assets exist.

**Detect**: extract MP4 frame 0. If it's empty or wrong, asset await is broken.

**Fix**: use `loadAsync`, `await Promise.all`, then set `__sceneReady`.

```js
// bad
new GLTFLoader().load('hero.glb', gltf => scene.add(gltf.scene));
window.__sceneReady = true;

// good
const [gltf, hdri, fonts] = await Promise.all([
  new GLTFLoader().loadAsync('hero.glb'),
  new RGBELoader().loadAsync('env.hdr'),
  document.fonts.ready,
]);
scene.add(gltf.scene);
scene.environment = hdri;
window.__sceneReady = true;
```

Same shape as 2D pitfall 6 (`document.fonts.ready` for measurement).

## 4. Render loop never disabled when `window.__recording === true`

**Looks like**: the page uses `setAnimationLoop` for live playback. Recorder fires `__renderFrame(t)` per CDP step. Both loops run. Shared GL state corrupts. MP4 has flicker every few frames.

**Why**: three's `setAnimationLoop` is its own rAF. It does not check `__recording`. The recorder's manual `__renderFrame` calls compete with it.

**Detect**: visible per-frame flicker, or assert: `getAnimationLoop() === null` should be true during recording.

**Fix**: gate the loop.

```js
function startInteractiveLoop() {
  renderer.setAnimationLoop((t_ms) => {
    if (window.__recording) {
      renderer.setAnimationLoop(null);
      return;
    }
    window.__renderFrame(t_ms);
  });
}
```

Or: don't use `setAnimationLoop` at all. Use a plain rAF that checks `__recording` first.

## 5. z-fighting on close coplanar faces

**Looks like**: two flat planes overlap (decal sticker on box, badge on shirt, label on bottle). At certain camera angles the surfaces flicker between front and back.

**Why**: depth buffer precision is logarithmic. Default near=0.1 / far=1000 wastes precision near the camera. Two faces 0.0001 units apart fall into the same depth-buffer slot and the GPU picks per-fragment.

**Detect**: rotate camera. If a flat surface flickers in checkerboard pattern, it's z-fighting.

**Fix**: choose one. In order of cheapness:

1. Set `polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1` on the foreground material.
2. Tighten the camera frustum: `near = 0.1, far = 50` (smaller `far` gives more precision).
3. Use a logarithmic depth buffer: `new WebGLRenderer({ logarithmicDepthBuffer: true })`. Costs 1-2 ms per frame on integrated GPUs.
4. Move the foreground 0.001 units along its normal (last resort, breaks geometry truth).

For decal-on-mesh specifically use `THREE.DecalGeometry`. Built for this case.

## 6. Tone-mapping double-applied (color management mistakes)

**Looks like**: HDRI environment looks washed out. Whites clip to gray. Saturated brand colors look muddy.

**Why**: tone-mapping runs once per fragment. If a texture is uploaded as `SRGBColorSpace` and the renderer also applies `ACESFilmicToneMapping`, the curve compresses sRGB-encoded values that were already compressed. Output drifts toward the middle of the value range.

The same bug runs the other direction: a normal map uploaded as `SRGBColorSpace` will get gamma-corrected and read wrong, giving incorrect surface lighting.

**Detect**: render a known-bright HDRI like Poly Haven `studio_small_03`. If the brightest pixels are not pure white in the linearized buffer, tone-mapping is doubled.

**Fix**: textures get the right color space.

```js
albedo.colorSpace = THREE.SRGBColorSpace;       // base color, only this
normal.colorSpace = THREE.LinearSRGBColorSpace; // normal/roughness/metalness/AO
roughness.colorSpace = THREE.LinearSRGBColorSpace;
metalness.colorSpace = THREE.LinearSRGBColorSpace;
ao.colorSpace = THREE.LinearSRGBColorSpace;

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
THREE.ColorManagement.enabled = true;
```

Full rules in `color-management.md`.

## 7. SSAA disabled in WebGL (jagged edges)

**Looks like**: thin geometry edges jaggy. Wireframe lines look like 1990s renderer.

**Why**: WebGL2 supports MSAA only on the default framebuffer. The moment you add postprocessing (`EffectComposer`), you render to a `WebGLRenderTarget`, and MSAA is off by default on those.

**Detect**: zoom into a thin edge in the export. If the staircase is one pixel wide, MSAA is off.

**Fix**: enable MSAA on the render target.

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const renderTarget = new THREE.WebGLRenderTarget(w, h, {
  samples: 4,  // MSAA 4x
  type: THREE.HalfFloatType,
});
const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));
```

For Track B use drei's `<RenderPass>` and set `multisampling={4}` on the `<Canvas>` gl prop. For higher quality use SSAA postprocessing pass (4x renders) accepting the cost. Default 4x MSAA is the right starting point.

## 8. Memory leak: failing to dispose materials and geometries on Sprite3D unmount

**Looks like**: Stage3D mounts six Sprite3D scenes in sequence. By the third scene, the renderer info shows 800 MB of GPU memory, and frame rate drops from 60 to 24.

**Why**: three.js does not garbage-collect GPU resources. `geometry.dispose()`, `material.dispose()`, and `texture.dispose()` are explicit. Removing a mesh from the scene graph leaves its GPU memory pinned until disposed.

**Detect**: log `renderer.info.memory.geometries` and `.textures` between scenes. They should not grow.

**Fix**: dispose on Sprite3D unmount.

```js
function disposeNode(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
        m.dispose();
      });
    }
  });
}

useEffect(() => () => disposeNode(group), []);  // cleanup on unmount
```

Stage3D's `<Sprite3D>` wrapper does this for any group passed via `ref`. Custom mount/unmount must do it manually.

## 9. Loaders running outside Stage3D's asset registry race with `__sceneReady`

**Looks like**: a Sprite3D loads its own GLB inside a `useEffect`. Stage3D sets `__sceneReady = true` after its own asset list resolves. Stage's list is shorter than the page's actual asset set. Recorder fires before the Sprite's loader returns. The Sprite is empty in MP4 frame 0.

**Why**: Stage3D collects loader promises through a registry. Loaders called outside the registry are invisible to Stage3D's `Promise.all`.

**Detect**: scene works in browser, recorder MP4 has a missing element only in the first scene's window.

**Fix**: register all loaders with Stage3D.

```jsx
<Sprite3D start={0} end={6} scene="hero">
  {(threeApi, t) => {
    // request asset through registry, NOT inside useEffect
    const model = threeApi.useAsset('hero.glb');
    if (model) model.rotation.y = t * 0.5;
  }}
</Sprite3D>
```

`useAsset` returns null until Stage3D's registry resolves the promise, and the registry is what feeds `__sceneReady`. If a recipe needs an ad-hoc loader, escalate it to Stage3D's `registerAsset(promise)` in mount.

## 10. WebXR session capture: you can't `recordVideo` a WebXR session

**Looks like**: a Track B `/walkthrough` deliverable runs fine in Quest 3. The recorder produces an MP4 of the desktop fallback only. The XR session frames are gone.

**Why**: WebXR rendering targets the headset compositor, not the page canvas. The browser's `recordVideo` and `HeadlessExperimental.beginFrame` capture the page surface. They don't see the XR layer. There is no "record the headset view from the page" API in 2026.

**Detect**: open the MP4. If the brief said WebXR but the export is flat 3D, you're capturing the fallback.

**Fix (the workaround)**: record a non-XR walkthrough alongside the XR build. The `walkthrough.md` recipe builds two entry points:

1. `index.html`, the WebXR build, ships to user
2. `recording.html`, same scene, no XR session, scripted camera fly-through driven by `__renderFrame(t)`. The recorder captures this.

Both reuse the same scene module. Only the camera control differs. The MP4 marketing asset comes from `recording.html`. The interactive XR experience comes from `index.html`.

For Quest passthrough video specifically, ask the user to screen-record from the headset (`adb screenrecord` on Quest, native Capture on Vision Pro). No browser-side path exists.

## 11. HDRI causing cubic shadow boundaries (PMREMGenerator missing)

**Looks like**: a Poly Haven HDR is loaded and assigned to `scene.environment`. Reflections on a metallic sphere show six sharp seams in a cube pattern.

**Why**: HDR equirectangular maps need pre-filtering into a mip chain to act as IBL. Without `PMREMGenerator.fromEquirectangular`, three uses the raw cube projection and the seams between cube faces become visible.

**Detect**: render a chrome-rough sphere under HDRI. If you can see hard seams, PMREM is missing.

**Fix**:

```js
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const pmrem = new THREE.PMREMGenerator(renderer);
const hdr = await new RGBELoader().loadAsync('env.hdr');
const envMap = pmrem.fromEquirectangular(hdr).texture;
hdr.dispose();
pmrem.dispose();

scene.environment = envMap;
scene.background = envMap;  // optional, only if you want HDR as backdrop
```

Stage3D's `useHDR(url)` does this internally. Manual scenes must do it.

## 12. Blender / glTF gotchas: scale, axis, animation clip names

Three sub-failures, often together.

### 12a. Scale wrong

Blender's default unit is 1.0 = 1 m. Three is also 1 unit = 1 m. But Blender users often model in cm and forget to apply scale in object mode. Result: a model that was 175 cm tall in Blender appears 1.75 cm tall in three.

**Fix**: Blender → Object → Apply → Scale before export. Or scale at runtime: `model.scale.setScalar(100)`. Prefer apply-in-Blender so the GLB is portable.

### 12b. Axis up wrong

Blender is Z-up. glTF is Y-up. three is Y-up. The glTF exporter handles the conversion if "Y Up" is checked in export options. If not, models lie on their side.

**Fix**: in Blender's glTF exporter, check **Transform → Y Up**. If you inherit a GLB with the wrong axis, rotate at load: `model.rotateX(-Math.PI / 2)`.

### 12c. Animation clip names lost or generic

Blender uses NLA strips. Without naming an action, the GLB ships clips named `Action`, `Action.001`, `Action.002`. Picking by name fails. Animation playback picks the wrong clip.

**Fix**: name actions in Blender's NLA editor. In three, prefer index access only when there's exactly one clip. For multi-clip GLBs, name them and find by name:

```js
const idle = THREE.AnimationClip.findByName(gltf.animations, 'Idle');
const action = mixer.clipAction(idle);
action.play();
```

If you inherit an unnamed GLB, `console.log(gltf.animations.map(a => a.name))` to see what's there, then either rename in Blender or document the index in the recipe.

## Pre-flight 3D checklist

- Pixel ratio multiplied by stage scale?
- Every animated value derived from `t_ms`, never `Date.now` / `Clock.getDelta`?
- All loaders awaited via `loadAsync` + `Promise.all` before `__sceneReady = true`?
- Render loop bails when `__recording` flips on?
- z-fighting checked on overlapping faces?
- Texture color spaces correct (albedo sRGB, others LinearSRGB)?
- MSAA enabled on `EffectComposer` render target?
- Disposers wired on Sprite3D unmount?
- All loaders registered with Stage3D's asset registry?
- WebXR deliverable has a parallel `recording.html` for MP4 export?
- HDRI passed through `PMREMGenerator`?
- glTF: scale applied in Blender, Y-up, animation clips named?

## Cross-references

- The page contract these pitfalls test: `page-contract.md`
- Recipe code that avoids these by construction: `recipes.md`, `assets/recipes/`
- Color rules expanded: `color-management.md`
- 2D version of pitfalls 2/3/4: `modes/producer/animation-pitfalls.md` § 5, 6, 12, 13
- Recorder source: `scripts/render-video.js`
- Lint rules: `capabilities/_shared/verifier-rules.md`
