---
name: architecture
description: Decision tree for picking 3D track + layout pattern. Track A vanilla three.js, Track B R3F + Vite + drei + xr, or model-viewer easy path. Includes layout patterns (curved arc, hero+overlay, carousel, isometric) and the stacked-z anti-pattern.
---

# 3D Architecture · Decision Tree

Two decisions per deliverable: (1) which **track** to use (A / B / model-viewer), and (2) which **layout pattern** to use. Layout matters more than people expect: a wrong pattern hides 75% of content from the default camera angle.

## Layout patterns (read FIRST)

The default camera is head-on. Layout determines what's visible there.

| Pattern | Use when | Visible head-on | Best for |
|---|---|---|---|
| **Hero 3D object + 2D text overlay** | most marketing animations, product launches, brand heroes | 3D motion + crisp 2D text via `drei.Html` or DOM-positioned overlays | the 80% case |
| **Curved arc (Vision Pro-style)** | spatial UI, multi-panel content needing 3D depth | every panel faces camera, all readable | multi-app interfaces, tabs, settings |
| **Carousel / orbital** | rotating reveal of equal-priority items | one item forward at a time, others orbit | feature carousel, testimonials, gallery |
| **Isometric layered** | dashboards, infographics, structured data | top-down 30° angle shows all layers | data viz, system diagrams |
| **Stacked-z parallel** | RARE — AR/VR depth-effects only | useless head-on; back panels 100% hidden | NEVER as content layout. Only as visual texture under a hero. |

The Phase 4 `demos3d/d6-holo-ui` initially used stacked-z and content was hidden behind the front panel. Redesigned to curved arc; now all four panels readable head-on. **Lesson**: do not default to stacked-z just because three.js can do depth.

## The three tracks

## The three tracks

| Track | What it is | Bundle (gz) | Build step? | Single-file deploy? |
|---|---|---|---|---|
| **Easy path** | `<model-viewer>` web component | ~200 KB (incl. bundled three) | no | yes |
| **Track A** | Vanilla three.js r181+ via import map, drei-vanilla helpers, zustand, leva | ~360 KB | no | yes |
| **Track B** | R3F + drei + react-three-xr + uikit + react-spring + postprocessing in a Vite project | ~1.4 MB | yes (`npm run build`) | no, ships `dist/` folder |

Track A is the default. Easy path wins for AR-first product pages. Track B fires when the brief actually needs R3F's reactive scene graph, WebXR runtime, or in-scene UIKit panels.

## Decision tree

```
brief mentions 3D / spatial / AR / WebXR?
├── no  → not a 3D job. Use producer mode.
└── yes
    │
    ├── brief is "show this product, rotate, view in AR"
    │   AND no custom shaders or motion?
    │   → Easy path. <model-viewer> + ar-modes="webxr scene-viewer quick-look".
    │
    ├── brief mentions WebXR / Vision Pro VR / Quest passthrough
    │   / room-scale / immersive / in-scene UI panel
    │   / interactive product configurator?
    │   → Track B. R3F + xr + uikit. Build-step output.
    │
    └── everything else
        → Track A. Vanilla three.js single-file.
```

If two tracks tie, pick smaller. Easy path < Track A < Track B.

## Trigger words that auto-route

Trigger detection runs before any rendering decision. Skill matches against the brief.

### Easy path triggers

- `/3d product`
- `/ar preview`
- "AR Quick Look"
- "Scene Viewer"
- "QR code for AR"
- "rotate this product"
- "auto-rotate" (when paired with a product mesh)
- "AR button"

### Track A triggers (default 3D)

- `/3d`, `/spatial`, `/three`, `/holo`
- `/turntable` (when not paired with AR keywords, those go easy path)
- "hero shot", "glass material", "parallax"
- "isometric infographic with depth"
- "holographic UI"
- "3D scatter" (data viz crossover, see `capabilities/data-viz/`)
- "smart-glasses HUD", "kiosk display"

### Track B triggers

- `/walkthrough`, `/spatial deck`, `/webxr`
- "WebXR", "immersive-vr", "immersive-ar"
- "Vision Pro VR" (NOT AR, see non-goals)
- "Quest 3", "Quest passthrough"
- "room-scale", "teleport waypoints"
- "in-scene UI panel", "uikit", "controllable"
- "interactive product configurator"
- "deck with 3D charts that animate per slide"
- "WebXR walkthrough"

## Why Track A is default and not R3F

R3F is the better DX. It does not load under `@babel/standalone` (the inline `<script type="text/babel">` Producer uses) because R3F requires the `@react-three/babel` bundler plugin. The pmndrs `htm`-based no-bundler escape replaces JSX with template literals, which breaks parity with the Stage/Sprite ergonomic.

So the rule:

- 2D content stays React + JSX inline (huashu pattern).
- 3D content in Track A is **vanilla three.js in a sibling `<script type="module">`**. Stage3D mounts a `<canvas>` ref, the three code lives outside Babel.
- Track B is the only place R3F runs. It demands a build step.

Lint rule in `verify.py`: any `<script type="text/babel">` containing `@react-three/fiber` or `<Canvas>` JSX fails the check.

## Bundle budgets per track

Hard caps. If a track exceeds, refactor or escalate.

| Slot | Budget (gz) | Notes |
|---|---|---|
| Easy path total | 250 KB | model-viewer is 200 KB, leaves 50 KB for shell + custom CSS |
| Easy path GLB | 5 MB | hard cap for mobile AR |
| Easy path USDZ | 8 MB | iOS quick look ceiling for in-store load |
| Track A core | 360 KB | three (168) + drei-vanilla picks (80) + zustand (3) + leva (40) + glue (60) |
| Track A textures + GLB | 8 MB | total assets per page |
| Track A HDRI | 2 MB | use 1k or 2k EXRs, never 4k unless reviewed |
| Track B core | 1.4 MB | R3F + drei (cherry-picked) + xr + uikit + spring + postprocessing |
| Track B per-route | 800 KB | code-split, lazy-load XR variants |
| Track B total assets | 25 MB | spatial decks can be heavy, accept it |

WebGL2 is the export backend on every track. WebGPU is interactive-only and falls back to WebGL2 in headless capture.

## When to escalate or downgrade

| Symptom | Move |
|---|---|
| Easy path can't do a feature (custom rim-light shader) | Upgrade to Track A |
| Track A scene needs in-scene clickable UI panel | Upgrade to Track B (uikit) |
| Track A scene only spins a model, no shaders, no postfx | Downgrade to easy path |
| Track B WebXR works but bundle is 2.4 MB | Cut drei imports, lazy-load uikit, drop unused postfx passes |
| Brief says "AR on iPhone" | Stop. iOS Safari has no WebXR in 2026. Easy path with `ios-src=*.usdz` only. See `ar-quicklook.md` |

## What lives where

```
modes/three3d/
├── architecture.md          (this file, pick a track)
├── page-contract.md         (window.__renderFrame and friends)
├── pitfalls.md              (12 named 3D failure modes)
├── recipes.md               (turntable, glass, hero-shot, parallax-scroll)
├── webxr-deliverables.md    (Track B specifics)
├── ar-quicklook.md          (USDZ + iOS routing)
├── model-viewer.md          (easy path patterns)
├── postprocessing.md        (bloom, DOF, n8ao)
├── spatial-audio.md         (HRTF + PositionalAudio)
└── color-management.md      (ACES + sRGB defaults)

assets/
├── three3d-loader.js        (Track A importmap + WebGPU/WebGL2 detect)
├── stage3d.jsx              (Stage3D + Sprite3D React wrappers)
├── three-helpers.js         (drei-vanilla re-exports)
├── tsl-effects.js           (TSL postfx nodes)
├── recipes/                 (Track A recipe code)
├── r3f-starter/             (Track B Vite project)
├── glb-templates/           (starter GLBs, DRACO + meshopt)
└── usdz-templates/          (starter USDZ for AR Quick Look)

scripts/
├── render-video.js          (--mode=3d auto-detects via __renderFrame)
└── webxr-bundle.js          (build Track B to dist/)
```

## Engine niches outside three.js

three.js wins by default. These are the exceptions worth knowing.

| Engine | When | Why |
|---|---|---|
| Babylon.js 8.x | Heavy product configurator with Inspector + GUI | accept 1.4 MB cost for built-in tooling |
| OGL | Sub-20 KB hero accent | when payload is the design choice |
| A-Frame | Simplest "double-click HTML" WebXR | only XR framework that runs without build |
| PlayCanvas | not used | 300 KB middle ground, smaller ecosystem than three |

A-Frame is the one engine outside three the skill ships. Reserved for `/walkthrough` briefs that name "minimum viable WebXR". Track B is preferred when scene complexity grows.

## Compose with other modes and capabilities

Modes and capabilities cross. Track choice does not change.

| Brief | Mode | Capability | Track |
|---|---|---|---|
| `/3d product` for a candle brand | 3D | Hi-Fi Base | Easy path |
| `/walkthrough` of an `/kg` agent-os swarm | 3D + KG | Knowledge Graph | Track B |
| `/spatial deck` with `/audio brand` BGM | 3D + Audio | Hi-Fi Base + Generative Audio | Track B + `--audio=tone` |
| `/3d` hero animation reading from `brand-spec.md` | Producer + 3D | Hi-Fi Base | Track A |
| `/viz` 3D scatter with embedding map | Producer | Data Viz (deck.gl on three) | Track A |

## Don'ts

- Don't pick Track B because the brief says "3D". Default is Track A.
- Don't pick Track A because someone wrote "AR" once. AR triggers route to easy path or Track B (WebXR-AR on Quest 3 / Chrome Android).
- Don't load R3F under `<script type="text/babel">`. It will not work.
- Don't author 3D animation that reads `Date.now()` or `Clock.getDelta()`. See `page-contract.md` and `pitfalls.md` 2.
- Don't ship Track B without running `webxr-bundle.js`. The dist folder is the deliverable, not the src.

## Cross-references

- Page contract every track must satisfy: `page-contract.md`
- Failures across tracks: `pitfalls.md`
- Recipe code: `recipes.md` and `assets/recipes/`
- AR routing: `ar-quicklook.md`, `model-viewer.md`
- Color defaults: `color-management.md`
- Capture pipeline: `scripts/render-video.js --mode=3d`
- Data viz crossover: `capabilities/data-viz/stack.md` (deck.gl, cosmos.gl)
- KG crossover: `capabilities/knowledge-graph/stack.md` (3d-force-graph, react-force-graph)
