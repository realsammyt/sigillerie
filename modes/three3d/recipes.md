---
name: recipes
description: Index of 4 starter 3D recipes (turntable, glass-material, hero-shot, parallax-scroll). Real exports, opts, return values, simple combinations. Recipe code lives in assets/recipes/.
---

# 3D Recipes

Four canonical Track A recipes. Copy-paste starters, used inside `Stage3D` / `Sprite3D` callbacks. Combinations are encouraged. Code lives in `assets/recipes/`.

## The shape every recipe shares

Recipes are pure controller modules. Stage3D (`assets/stage3d.jsx`) owns the page contract (`__renderFrame`, `__sceneReady`, `__duration`, `__capabilities`); `assets/three3d-loader.js` pre-seeds `__capabilities`. Recipes never set `window.__*`.

| Export | Takes threeApi? | Returns |
|---|---|---|
| `createTurntable(threeApi, opts)` | yes | `{ update(t, sprite_t), dispose(), product, group }` |
| `createGlassMaterial(opts)` | no (pure material factory) | `THREE.MeshPhysicalMaterial` |
| `createGlassHero(threeApi, opts)` | yes | `{ group, hero, material, lights, caust, update, dispose }` |
| `createHeroShot(threeApi, opts)` | yes | `{ update(t, sprite_t), dispose(), setFocus(idx) }` |
| `createParallaxScroll(threeApi, opts)` | yes | `{ update(t, sprite_t), dispose(), layers, scrollT }` |

`threeApi` comes from the Sprite3D callback: `{ THREE, scene, camera, renderer, clock, group, frame, useWebGPU, backend, draw }`. `t` is seconds from sprite start, `sprite_t` is 0..1 within the sprite window. Call `update` per frame, `dispose` on sprite end. Each recipe also stamps its exports on `window` for inline (non-module) pages.

## Recipe index

| Recipe | What it builds | When to use | Key opts | File |
|---|---|---|---|---|
| **turntable** | Rotating product group, HDRI or RoomEnvironment IBL, three-point rig, ground shadow, rim sweep | Hero product shot for landing page or AR pre-render | `modelUrl`, `rotationSpeed`, `envIntensity`, `groundShadow`, `highlightSweep`, `hdriUrl` | `assets/recipes/turntable.js` |
| **glass-material** | Transmission-tuned `MeshPhysicalMaterial`, plus an optional full glass-hero scene with caustics | Crystal, perfume bottle, glass panel, holographic surface | material: `ior`, `thickness`, `transmission`, `tint`, `roughness`; hero: `shape`, `caustics`, `envIntensity` | `assets/recipes/glass-material.js` |
| **hero-shot** | 3 to 7 floating textured cards, orbital camera, sequential focus shifts, horizon backdrop, bloom | Apple-gallery-style hero, feature showcase, deck cover loop | `cards[]`, `cameraPan`, `focusShift`, `cardSize`, `cardSpacing`, `bg` | `assets/recipes/hero-shot.js` |
| **parallax-scroll** | Stacked content layers at z-depths, camera dolly, fog | Scrollytelling, magazine infographic with depth | `layers[]`, `cameraStart`, `cameraEnd`, `driveBy`, `fogColor` | `assets/recipes/parallax-scroll.js` |

## turntable

**Builds**: a product group rotating at `rotationSpeed` rad/s. IBL from the zero-fetch procedural RoomEnvironment by default; pass `hdriUrl` to load an `.hdr` via `Sigillerie3D.helpers.loadHDRI` (RoomEnvironment remains the failure fallback). Three-point rig via `window.SigillerieLighting.applyCoolStudio` when loaded, inline key/fill/rim otherwise. Soft contact-shadow disc. Optional rim-light sweep that peaks when camera-facing. Postfx baseline via `assets/three3d/recipe-baseline.js`.

**Opts** (all optional):

```js
const ctrl = createTurntable(threeApi, {
  modelUrl: 'hero.glb',   // loaded via helpers.loadGLTF; TorusKnot fallback when null or failed
  rotationSpeed: 0.4,     // radians per second on the product group
  envIntensity: 1.0,      // scene.environmentIntensity
  groundShadow: true,     // soft contact-shadow disc
  highlightSweep: true,   // moving rim light
  hdriUrl: null,          // default: procedural RoomEnvironment IBL; set an .hdr URL to opt in
});
```

**Returns**: `{ update(t, sprite_t), dispose(), product, group }`. `product` is `null` until the async GLB resolves.

There is no `duration` opt; the Sprite3D window sets length. The loop ties end-to-start only when `rotationSpeed * duration` is a multiple of `2 * Math.PI`, so pick the two together.

**Gotcha**: the GLB resolves async; `product` stays `null` until it lands. Stage3D holds `__sceneReady` until every load registered in `window.__sceneAssets.pending` settles, and `helpers.loadGLTF` registers automatically, so no page-level gating is needed. See `pitfalls.md` § 9.

## glass-material

Two exports.

### `createGlassMaterial(opts)`

Pure factory, no threeApi. Returns a `MeshPhysicalMaterial` tuned for transmission. Defaults:

```js
const mat = createGlassMaterial({
  color: '#ffffff',          // body color, keep near white
  tint: '#ffffff',           // attenuationColor drives the tint
  roughness: 0.05,           // 0 = polished, 0.3 = frosted
  transmission: 0.4,         // deliberate low default so panels catch light; use 0.7+ with a high-contrast envMap
  thickness: 1.0,            // refraction depth in scene units
  ior: 1.45,                 // 1.45 acrylic, 1.5 window glass, 1.6+ crystal
  attenuationDistance: 0.5,
  clearcoat: 1.0,
  clearcoatRoughness: 0.0,
  envMapIntensity: 1.5,
  iridescence: 0.0,
  metalness: 0.0,
});
```

No `dispersion` opt is shipped; set `mat.dispersion` on the returned material yourself if the brief needs chromatic dispersion (r178+).

### `createGlassHero(threeApi, opts)`

Full hero scene: glass body, key/fill/rim lights, matte ground, procedural worley caustics (spotlight fallback), bloom + DOF + vignette. Returns `{ group, hero, material, lights, caust, update, dispose }`. Caller adds the group:

```js
const hero = createGlassHero(threeApi, {
  shape: 'icosahedron',      // 'sphere' | 'torus' | 'box' | 'custom-glb' (+ modelUrl)
  material: null,            // defaults to createGlassMaterial()
  envIntensity: 1.5,
  caustics: true,
  keyLightIntensity: 1.6,
  fillLightIntensity: 0.5,
});
threeApi.scene.add(hero.group);
```

**Gotcha**: glass needs an environment map to refract. `createGlassHero` builds a RoomEnvironment PMREM when `threeApi.renderer` is present; pass `opts.envMap` to override. A bare `createGlassMaterial` on your own mesh needs `scene.environment` set. See `pitfalls.md` § 11.

**Performance**: `transmission` is expensive. Limit to one or two glass meshes per scene. For a wall of glass use `MeshStandardMaterial` with `transparent: true` and `opacity`.

## hero-shot

**Builds**: an Apple-gallery-style hero in real 3D. 3 to 7 rounded textured cards in an asymmetric layout. Camera pans on a slow orbital path with a gentle bob. Focus shifts card to card every 2.4 s: the focused card grows 1.4x and pulls forward, far satellites drop to 0.4 alpha. Procedural horizon-gradient backdrop, soft shadow floor, accent rim halo behind each card, bloom + vignette baseline.

**Opts**:

```js
const hero = createHeroShot(threeApi, {
  cards: [   // 3 to 7 required, throws otherwise; 5 is the practical default (Miller's Law)
    { id: 'discovery', title: 'Discovery', accent: '#9A4B3D', textureUrl: 'card-1.png' },
    { id: 'producer',  title: 'Producer',  accent: '#1B1614', textureUrl: 'card-2.png' },
    { id: '3d',        title: '3D',        accent: '#6E6862', textureUrl: 'card-3.png' },
  ],
  cameraPan: 'slow-orbital',    // 'medium-orbital' | 'static'
  focusShift: 'sequential',     // 'random' | 'static'
  cardSize: { w: 1.6, h: 1.0 },
  cardSpacing: 2.4,
  bg: 'horizon-gradient',       // any other value skips backdrop + floor
});
```

**Returns**: `{ update(t, sprite_t), dispose(), setFocus(idx) }`. The recipe adds itself to `threeApi.scene`; no manual add needed. `setFocus(idx)` forces a card into focus for scripted moments.

## parallax-scroll

**Builds**: N content layers at different z-depths. Camera lerps `cameraStart` to `cameraEnd` as progress goes 0 to 1; perspective gives the parallax. Fog fades deep layers. `parallaxFactor` per layer: 1 = world-locked (full natural parallax), 0 = layer follows camera (sky dome), values between scale the effect.

**Opts**:

```js
const scroll = createParallaxScroll(threeApi, {
  layers: [
    { z: -8, content: 'bg-mountains.png',  parallaxFactor: 0.1 },
    { z: -4, content: 'mid-trees.png',     parallaxFactor: 0.4 },
    { z:  0, content: { type: 'text', text: 'Headline', size: 1.5, color: '#fff' } },
  ],
  cameraStart: [0, 0, 5],
  cameraEnd:   [0, 0, -2],
  driveBy: 'sprite-t',          // or 'window-scroll' for live scroll pages
  fogColor: '#0a0a0a',
  fogNear: 5,
  fogFar: 20,
});
```

Layer `content` shapes: image URL string (textured plane), `{ type: 'text', text, font, size, color }` (uikit panel, CanvasTexture fallback), `{ type: 'color', color }` (flat depth hint), or any `THREE.Object3D` (caller owns it).

**Returns**: `{ update(t, sprite_t), dispose(), layers, scrollT }`.

**Progress source**:

- MP4 export / Sprite3D: `driveBy: 'sprite-t'`, progress comes from the sprite window.
- Live page: `driveBy: 'window-scroll'`, progress from `window.scrollY` vs document height.

Both run through the same `update(t, sprite_t)`.

For data-heavy parallax see `capabilities/data-viz/animation-decisions.md` § scrollama integration.

## Combination patterns

Recipes compose. The pattern is: one base + one accent.

| Combo | Recipe A | Recipe B | Use for |
|---|---|---|---|
| **Crystal product hero** | turntable | createGlassMaterial | "luxury perfume rotating with refraction" |
| **Glass hero standalone** | createGlassHero | (self-contained) | crystal splash, holographic panel |
| **Layered turntable** | turntable | parallax-scroll (background only) | turntable with depth backplate, e.g. moving stars |
| **Hero on parallax** | hero-shot | parallax-scroll | scrollytelling section that ends on a hero shot |

Combination authoring:

```js
// crystal product hero, turntable.js + glass-material.js
import { createTurntable } from './recipes/turntable.js';
import { createGlassMaterial } from './recipes/glass-material.js';

// inside a Sprite3D callback
const ctrl = createTurntable(threeApi, { modelUrl: 'crystal.glb' });
const glass = createGlassMaterial({ ior: 1.45, tint: '#9A4B3D' });
let swapped = false;

function update(t, sprite_t) {
  ctrl.update(t, sprite_t);
  // product resolves async; swap materials once it lands
  if (!swapped && ctrl.product) {
    ctrl.product.traverse((o) => { if (o.isMesh) o.material = glass; });
    swapped = true;
  }
}
```

`createTurntable` returns a controller whose `product` getter stays `null` until the GLB lands. `createGlassMaterial` returns a material instance. Combinations compose by mutating recipe A's objects from your own `update`.

## Adding a new recipe

A new recipe is a JS module under `assets/recipes/`. Stub:

```js
// assets/recipes/<name>.js
export function create<Name>(threeApi, opts = {}) {
  const { THREE, scene, camera, renderer } = threeApi;
  const cfg = { /* defaults */ ...opts };

  // build meshes and lights, add to scene, track what you add
  const sceneAdds = [];

  function update(t, sprite_t) {
    // pure function of t (seconds) and sprite_t (0..1). No Date.now, no Clock.
  }

  function dispose() {
    for (const obj of sceneAdds) {
      if (obj.parent) obj.parent.remove(obj);
    }
    // dispose every geometry, material, texture you created
  }

  return { update, dispose };
}

if (typeof window !== 'undefined') Object.assign(window, { create<Name> });
```

Do NOT construct a `WebGLRenderer`. Stage3D owns renderer, camera, and scene; the recipe borrows them via `threeApi`.

Then add an entry to the recipe index table at the top of this file with: name, what it builds, when to use, opts, file path.

Validation gate for a new recipe:

- Renders in <2 s on a Titan RTX baseline
- Visually matches a reference screenshot committed in the PR
- Stays a pure controller: Stage3D (`assets/stage3d.jsx`) owns the page contract; the recipe never sets `window.__*`
- No `Date.now` / `Clock.getDelta` anywhere (hand-check; `verify.py` does not scan source today), and the host page passes `verify.py --3d` at runtime

## What recipes are NOT

- Not full deliverables. They're starters. Producer mode + 3D mode compose them into actual outputs.
- Not WebXR. Track B recipes are planned under `assets/r3f-starter/src/recipes/` (Phase 6, directory empty today).
- Not interactive. Recipes are deterministic pure-time `update(t)` controllers. Interactivity is layered on by the deliverable.
- Not branded. Recipes take opts and read brand colors from the surrounding page. Hard-coding brand colors in a recipe defeats reuse.

## Cross-references

- Architecture decision (when to use Track A recipes vs `<model-viewer>` vs Track B): `architecture.md`
- Page contract the host page satisfies (owned by Stage3D): `page-contract.md`
- Failure modes recipes already avoid: `pitfalls.md`
- Color rules baked into all recipes: `color-management.md`
- Postfx passes used by recipes (composer, bloom, DOF, vignette): `assets/tsl-effects.js`; default wiring: `assets/three3d/recipe-baseline.js`; guide stub: `postprocessing.md`
