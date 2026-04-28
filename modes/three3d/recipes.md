---
name: recipes
description: Index of 4 starter 3D recipes (turntable, glass-material, hero-shot, parallax-scroll). What each builds, params, simple combinations. Recipe code lives in assets/recipes/.
---

# 3D Recipes

Four canonical Track A recipes. Copy-paste starters. Each conforms to `page-contract.md` by construction. Combinations are encouraged. Code lives in `assets/recipes/`.

## Recipe index

| Recipe | What it builds | When to use | Params | File |
|---|---|---|---|---|
| **turntable** | Auto-rotating product on a turntable, even rim light, soft floor shadow | Hero product shot for landing page or AR pre-render | `model`, `rpm`, `tilt`, `floor`, `bg` | `assets/recipes/turntable.js` |
| **glass-material** | Refractive glass shader with chromatic dispersion and IOR | Crystal, perfume bottle, glass panel, holographic UI surface | `ior`, `thickness`, `dispersion`, `roughness`, `tint` | `assets/recipes/glass-material.js` |
| **hero-shot** | Cinematic single-frame composition with depth-of-field, rim light, slow camera dolly | Page hero, splash screen, marketing still or 8 s loop | `subject`, `dofFocus`, `dollyAmplitude`, `rimColor` | `assets/recipes/hero-shot.js` |
| **parallax-scroll** | Stacked plane layers with z-depth, scroll-driven camera dolly, optional fog | Magazine infographic, isometric depth story, scrollytelling | `layers[]`, `scrollLength`, `fogDensity` | `assets/recipes/parallax-scroll.js` |

All four set `window.__renderFrame`, `__sceneReady`, `__duration`, `__capabilities`. All four pass `verify.py`.

## turntable

**Builds**: a model on a turntable surface. Even three-point lighting from HDRI. Soft contact shadow on a floor disc. Optional gradient or solid background. Default 8 s loop, full 360°.

**When**: any "show this product, rotate" brief. Pairs with the easy path `<model-viewer>` when you don't need custom lighting; pairs with Track A turntable when you do.

**Params**:

```js
{
  model: 'hero.glb',          // GLB path or three Object3D
  rpm: 7.5,                   // 7.5 = full rotation in 8 s
  tilt: 0.0,                  // radians, axis tilt
  floor: 'shadow' | 'mirror' | 'none',
  bg: '#0a0a0a' | gradientObj | hdriPath,
  exposure: 1.0,
  duration: 8,                // sets __duration
}
```

**Output**: single-file HTML, `__renderFrame` rotates `model.rotation.y = t_ms / 1000 * (rpm * Math.PI / 30)`. Loop ties end-to-start because 360° at duration boundary.

## glass-material

**Builds**: a `MeshPhysicalMaterial` configured for glass with `transmission`, `thickness`, `ior`, `dispersion`. Optional internal tint. Optional HDR environment for refraction reads.

**When**: any deliverable with a glass surface that should refract the scene behind it. Crystal product shots, perfume, holographic panels, glass UI.

**Params**:

```js
{
  ior: 1.5,                   // 1.5 = window glass, 1.45 = acrylic, 2.4 = diamond
  thickness: 0.5,             // refraction depth in scene units
  dispersion: 0.05,           // chromatic dispersion (r178+)
  roughness: 0.05,            // 0 = perfect glass, 0.3 = frosted
  tint: '#ffffff',            // attenuationColor
  attenuationDistance: 1.0,
}
```

**Gotcha**: glass needs an environment map to refract through. Use `scene.environment = pmremEnvMap`. Without it, glass looks black or flat. See `pitfalls.md` § 11.

**Performance**: `transmission` is expensive. Limit to one or two glass meshes per scene. For a wall of glass, use `MeshStandardMaterial` with `transparent: true` and `opacity` instead.

## hero-shot

**Builds**: a one-take cinematic frame. Subject framed at rule-of-thirds. Slow camera dolly in or around. Depth-of-field bokeh. Rim light separates subject from background. Bloom on bright highlights.

**When**: hero animation for a landing page, splash screen, 8 s loop for a deck cover, marketing still where the product needs to feel premium.

**Params**:

```js
{
  subject: 'hero.glb',
  dofFocus: 'subject' | 'auto' | numberDistance,
  dofAperture: 0.025,         // smaller = more blur
  dollyAmplitude: 0.5,        // scene units, camera moves ± this
  dollyAxis: 'in' | 'orbit',
  rimColor: '#ffe9c8',        // warm rim
  rimIntensity: 2.5,
  bloomThreshold: 0.85,
  duration: 8,
}
```

**Composition rules baked in**:

- Camera at 35 mm equivalent FOV (50°)
- Subject occupies ~40% of frame height
- Rim light positioned 135° from camera, 45° elevation
- DOF focus distance tracks subject if `dofFocus: 'subject'`
- Background gets the HDRI but darkened to 0.4 exposure relative to subject

## parallax-scroll

**Builds**: N stacked plane layers along the z-axis. Scroll position drives camera dolly. Each layer can be a sprite, a video texture, an SVG-as-texture, or a small mesh. Optional volumetric fog softens deep layers.

**When**: scrollytelling, magazine-style infographic with depth, "isometric infographic" briefs, any deliverable where the user is supposed to feel they're moving through layered content.

**Params**:

```js
{
  layers: [
    { z: 0,  content: 'foreground.png', scale: 1.0 },
    { z: -2, content: 'midground.png',  scale: 0.85, parallax: 0.7 },
    { z: -5, content: 'bg.png',         scale: 0.6,  parallax: 0.3 },
  ],
  scrollLength: 4000,         // pixels of scroll to traverse the scene
  cameraStart: [0, 0, 5],
  cameraEnd: [0, 0, -3],
  fogDensity: 0.05,
  fogColor: '#0a0e1a',
  duration: 12,               // for MP4 export, scrollLength is for live page
}
```

**Output modes**:

- Live page: scroll position via `IntersectionObserver` and `scroll` event drives `__renderFrame`.
- MP4 export: `__duration` interpolates camera from `cameraStart` to `cameraEnd` over time.
- Both share the same `__renderFrame(t_ms)` that maps `t_ms` to a `progress` 0..1.

For data-heavy parallax see `capabilities/data-viz/animation-decisions.md` § scrollama integration.

## Combination patterns

Recipes compose. The pattern is: one base + one accent.

| Combo | Recipe A | Recipe B | Use for |
|---|---|---|---|
| **Crystal product hero** | turntable | glass-material | "luxury perfume rotating with refraction" |
| **Cinematic glass panel** | hero-shot | glass-material | holographic UI panel with rim light + bokeh |
| **Layered turntable** | turntable | parallax-scroll (background only) | turntable with depth backplate, e.g. moving stars |
| **Hero on parallax** | hero-shot | parallax-scroll | scrollytelling section that ends on a hero shot |

Combination authoring:

```js
// crystal product hero, turntable.js + glass-material.js
import { buildTurntable } from './recipes/turntable.js';
import { glassMaterial } from './recipes/glass-material.js';

const stage = await buildTurntable({
  model: 'crystal.glb',
  rpm: 7.5,
  bg: 'studio_small.hdr',
});

stage.model.traverse((mesh) => {
  if (mesh.isMesh) mesh.material = glassMaterial({ ior: 1.45, dispersion: 0.05 });
});
```

`turntable.js` returns a stage object with `{ scene, camera, renderer, model, render }`. `glass-material.js` returns a configured material instance. Combinations compose by mutating the result of recipe A.

## Adding a new recipe

A new recipe is a JS module under `assets/recipes/`. Stub:

```js
// assets/recipes/<name>.js
import * as THREE from 'three';

export async function build<Name>(params = {}) {
  const {
    duration = 8,
    // ...other params with defaults
  } = params;

  const renderer = new THREE.WebGLRenderer({ canvas: params.canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  THREE.ColorManagement.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, params.canvas.width / params.canvas.height, 0.1, 100);

  // await all assets
  const [/* assets */] = await Promise.all([/* loaders */]);

  // scene setup

  function render(t_ms) {
    // pure function of t_ms
    const t = t_ms / 1000;
    // animate
    renderer.render(scene, camera);
  }

  return { scene, camera, renderer, render, duration };
}
```

Then add an entry to the recipe index table at the top of this file with: name, what it builds, when to use, params, file path.

Validation gate for a new recipe:

- Renders in <2 s on a Titan RTX baseline
- Visually matches a reference screenshot committed in the PR
- Sets the page contract via `assets/three3d-loader.js` glue (loader installs `__renderFrame`, `__sceneReady`, `__duration`)
- Passes `verify.py` lint (no `Date.now`, no `Clock.getDelta`)

## What recipes are NOT

- Not full deliverables. They're starters. Producer mode + 3D mode compose them into actual outputs.
- Not WebXR. Track B has its own recipe set under `assets/r3f-starter/src/recipes/` (Phase 6).
- Not interactive. Recipes are deterministic pure-time `__renderFrame` modules. Interactivity is layered on by the deliverable.
- Not branded. Recipes take params and read brand colors from the surrounding page. Hard-coding brand colors in a recipe defeats reuse.

## Cross-references

- Architecture decision (when to use Track A recipes vs `<model-viewer>` vs Track B): `architecture.md`
- Page contract every recipe satisfies: `page-contract.md`
- Failure modes recipes already avoid: `pitfalls.md`
- Color rules baked into all recipes: `color-management.md`
- Postfx options (bloom, DOF, n8ao) used by `hero-shot`: `postprocessing.md`
- TSL rim-light shader powering `hero-shot`: `assets/three3d/tsl-effects.js`
