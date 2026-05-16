# Sigillerie

> *One sentence in. Real-studio design out.*

A Claude Code skill that ships single-file HTML design deliverables — animations, App prototypes, slide decks, magazine infographics, data viz, knowledge graphs, 3D / immersive scenes, with optional generative audio. English-canonical, agent-driven, brand-spec-backed.

```
git clone https://github.com/realsammyt/sigillerie.git ~/.claude/skills/sigillerie
```

Then talk to your agent.

## What it makes

| Capability | Example briefs |
|---|---|
| **Hi-Fi Base** | "60-second product launch animation, MP4 + GIF + BGM" · "iOS prototype for a Pomodoro app, 4 screens, clickable" · "12-slide deck with editable PPTX export" |
| **Data Viz** | "Magazine infographic on global EV adoption, A3 print" · "Live dashboard, 6 widgets, real-time" · "Animated data story, 30s reveal" · "Pudding-style scrollytelling" |
| **Knowledge Graph** | "Visualize my Obsidian vault" · "Map my agent-os swarm" · "Citation network for [paper]" · "Wikidata neighborhood, 60s reveal MP4" |
| **Generative Audio** | "Score this deck with brand-aware BGM" · "Generative ambient for a kiosk" · "Spatial 3D scene with Doppler" · "Sonified data piece" |
| **3D / Immersive** | "Spatial slide deck for Vision Pro" · "AR product preview link, mobile-first" · "WebXR room-scale walkthrough" · "Holo-UI mockup, glasses HUD frame" |

## Three modes

- **Discovery Studio** — brand-from-nothing. 6-phase guided pipeline (Intake → Moodboard → Direction → Asset Build → Spec → Hand-off). Three differentiated options at every step. Mix-and-match supported. 35–55 min wall-clock for a full run.
- **Producer** — execute a brief at hi-fi. Anti-AI-slop discipline, brand-asset protocol, junior-pass workflow, 5/7-dim critique.
- **3D / Immersive** — three.js (Track A single-file) + R3F (Track B build-step) + `<model-viewer>` for AR. WebGPU + WebGL2 unified.

Modes compose. Capabilities compose with modes. A `/walkthrough` of a `/kg` deliverable runs through 3D mode and emits a Track B WebXR project with generative spatial audio.

## Quick examples

```
/discover Vellum, calm reading app
/3d product hero glass headphones
/viz sales-q4.csv
/kg agent-os
/spatial deck on AI psychology
/audio brand for [brand]
```

## Showcase

Four single-file HTML demos, one per capability. Each demonstrates the FIX side of the named anti-patterns in its capability's catalog. Open in a browser (most need `http://` not `file://`, start a static server in this repo root with `python -m http.server 8080`).

| Demo | Path | Recipes demonstrated |
|---|---|---|
| **Data Viz** | `demos-viz/d1-anti-pattern-showcase/` | Buried Lead, Flat Deck, Loading Void, Rainbow Categorical, Unlabeled Axis, Legend Orphan, Anticlimactic Summary |
| **Knowledge Graph** | `demos-kg/d1-anti-pattern-showcase/` | Hairball-at-Load, No Entry Node, Isotropic Nodes, Edge Spaghetti, Undifferentiated Cluster Mass, Offscreen Legend, Unlabeled Edges |
| **Generative Audio** | `demos-audio/d1-anti-pattern-showcase/` | Cold Audio Start, Uniform Texture (loop-Peak at bars 12-13), Loop Seam, Motif Overload, Audio-Only State Signal, Tab-Throttle Drift |
| **3D / Immersive** | `demos3d/d6-holo-ui/` | Adaptive Holo-UI across 4 aspect ratios (wide / square / portrait / ultrawide). Uses `@pmndrs/uikit` with `applySpatialVitrine` preset (frosted glass + warm sunset + bloom + chromatic). |

Open one in a browser to verify it renders, then check the demo's `README.md` for the anti-patterns avoided and the recipe behind each.

For design review iteration, `scripts/screenshot-demo.mjs` captures all four aspect ratios (1920x1080 / 1080x1080 / 1080x1920 / 3440x1440) at once. Pair with the global `visual-review` skill to score a demo against the project's own critique rubric.

## What it doesn't do

- iOS Safari WebXR (does not exist in 2026 — uses AR Quick Look instead)
- visionOS WebXR-AR passthrough (non-functional — ships VR-only on Vision Pro)
- 5.1 / Atmos surround MP4 export (browser limit)
- Server-side three.js renderer
- Figma round-trip
- Production web-app code (use `frontend-design`)

## License

Personal use unrestricted. Commercial use requires authorization. See `LICENSE`.

## Lineage

Discipline borrowed from [`alchaincyf/huashu-design`](https://github.com/alchaincyf/huashu-design) (花叔Design) — anti-AI-slop catalog, core asset protocol, Junior Designer workflow, 5-dim critique, 20-philosophy direction advisor. Re-authored English-canonical and extended with Discovery, three new capabilities, 3D / immersive layer.

## Status

Pre-v1, building. See `SKILL.md` for routing rules and `_planning/` (workspace) for the build plan.
