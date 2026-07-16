---
name: sigillerie
description: Use when the user wants a designed, self-contained HTML deliverable or a design-studio pass on one. Covers hero animations, app prototypes and mockups, slide decks, infographics, dashboards and data stories, knowledge-graph explorers, 3D product scenes, generative audio scoring, and expert design critique / ux audit. Triggers EN/ZH - single-file HTML deliverable, hero animation, iOS prototype, app mockup, slide deck, MP4 or GIF export, scrollytelling data story, visualize this CSV, knowledge graph explorer, ontology map, 3D product hero, spatial scene, generative audio brand, parametric SFX, score this deck, 做原型, 设计变体, 数据可视化, 知识图谱, 生成音频, 沉浸式, 评审. Also fires on /discover, /studio, /animate, /deck, /prototype, /viz, /chart, /dashboard, /kg, /graph, /audio, /bgm, /sfx.
license: Custom. See LICENSE (personal use unrestricted; commercial use requires authorization).
compatibility: Claude Code with Node 18+ (Playwright Chromium) and Python 3. Network access only for optional Stable Audio / ElevenLabs generation.
---

# Sigillerie

One sentence in. Real-studio design out. Flat or spatial, page or scene, animated or scored. Three modes, four capabilities, one tool.

## Modes (operational stance)

| Mode | Fires when | Output |
|---|---|---|
| **Discovery** | brief is vague, no `brand-spec.md`, "starting from scratch", `/discover`, `/studio` | populated `brand-spec.md` + assets ready for Producer |
| **Producer** | brand-spec exists, brief is concrete | hi-fi HTML deliverable + MP4/PDF/PPTX/GIF as needed |
| **3D / Immersive** | "3D", "spatial", "product hero", "walkthrough" | three.js Track A single-file HTML + MP4 (AR Quick Look / WebXR / R3F Track B planned, docs stubbed) |

Modes compose. `/discover` then `/3d product hero` is normal.

## Capabilities (output type)

| Capability | Triggers | Reads |
|---|---|---|
| **Hi-Fi Base** | "hero animation", "iOS prototype", "slide deck", "infographic", `/animate`, `/deck`, `/prototype` | `modes/producer/` |
| **Data Visualization** | `/viz`, `/chart`, `/dashboard`, "visualize this CSV", "scrollytelling", "data story" | `capabilities/data-viz/anti-patterns.md` (rest of dir stubbed) |
| **Knowledge Graph** | `/kg`, `/graph`, `/network`, `/ontology`, "visualize my Notion / Obsidian / agent-os graph" | `capabilities/knowledge-graph/anti-patterns.md` (rest of dir stubbed) |
| **Generative Audio** | `/audio`, `/bgm generate`, `/sfx generate`, `/audio brand`, "score this deck", "spatial audio" | `capabilities/generative-audio/anti-patterns.md` (rest of dir stubbed) |

## Routing

1. Check brief for triggers above. If multiple match, pick the most specific.
2. Check for `brand-spec.md` at project root or `assets/<brand>-brand/`. If missing → Discovery first unless user says skip.
3. Pick rendering pipeline (flags belong to `scripts/render-video.js`; full reference in `modes/producer/video-export.md`):
   - HTML/CSS only → `--mode=html` (Playwright recordVideo)
   - WebGL/WebGPU → `--mode=3d` (CDP `HeadlessExperimental.beginFrame`)
   - Runtime audio synthesis → add `--audio=tone`
4. Read the capability's `anti-patterns.md` and the relevant mode docs before authoring. The remaining reference docs under `capabilities/` are stubs until Phases 8-10; fall back to `modes/producer/` and state assumptions in the Junior Pass instead of silently guessing.

## Core principles (non-negotiable)

- **Existing context beats invented context.** Brand-spec drives every asset reference. Caps at 60-65 points without it.
- **Junior pass before Full pass.** Show assumptions + placeholders early. Cheaper to fix at minute 10 than minute 60.
- **Variations, not single answers.** 3+ differentiated options at any choice point. Mix-and-match supported.
- **Dial-gated rules.** Three numeric dials (`DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY`, 1-10 each) decide which downstream rules are in force per deliverable. See `modes/producer/dials.md`. Producer states the active dials in the Junior Pass; critic honors the active dial state.
- **Anti-AI-slop discipline.** Each capability has its own catalog (`modes/producer/content-guidelines.md`, `capabilities/data-viz/anti-patterns.md`, `capabilities/knowledge-graph/anti-patterns.md`, `capabilities/generative-audio/anti-patterns.md`). Critic agent scans by name.
- **Caveman docs.** Tight prose. Tables over paragraphs. One idea per sentence.

## UX law self-check (pre-delivery gate)

Before shipping any deliverable, Claude applies this four-question rubric. No rubric section -> no ship.

1. **Cognitive load check.** Count independent focal elements. If over 5 on a flat surface or over 4 in a 3D supporting layer, reduce.
2. **Serial position check.** The most important claim is at position 1 or position N in its sequence. If it's in the middle, move it.
3. **Peak-End check.** The deliverable has an identifiable peak (highest-value moment) and a deliberate close. If both aren't named, design them before shipping.
4. **Doherty check.** Anything that takes over 400 ms to first meaningful content has a loading state. If not, add it.

These four gates cover the must-cite laws most likely to fail silently (no visual defect, just a cognitive UX defect).

## Page contract (every recordable HTML)

| Variable | Required when | Purpose |
|---|---|---|
| `window.__ready` | always | first paint complete |
| `window.__recording` | reads | disable orbit/loop, hide loaders |
| `window.__sceneReady` | 3D | all GLTF / textures / HDRI awaited |
| `window.__renderFrame(t_ms)` | 3D | sets uniforms/mixers from t, calls `renderer.render()` synchronously |
| `window.__duration` | optional | scene length seconds |
| `window.__audioCues` | optional | `[{t, type, file?, position?}]` cues |
| `window.__audioRuntime` | when synthesizing audio | `"static"` / `"tone"` / `"wam2"` |
| `window.__capabilities` | optional | `{ webgpu, webxr, modelViewer, audio }` introspection |

Run `python scripts/verify.py <file.html>` before shipping (`--3d`, `--audio` add the mode contracts); it checks the variables above. Animation timing comes from `__renderFrame(t)` only, never `Date.now` or `Clock.getDelta`. The timing rule is convention: no script scans source for it today.

## References map

| Topic | Path |
|---|---|
| Discovery (6 phases, options UX, JSON schema) | `modes/discovery/pipeline.md` |
| Producer workflow + asset protocol + critique | `modes/producer/workflow.md` |
| Producer dials (VARIANCE / MOTION / DENSITY) | `modes/producer/dials.md` |
| Producer Pass 5 (HTML to React/Tailwind export) | `modes/producer/export-jsx.md` |
| 3D Track A vs B + page contract + recipes | `modes/three3d/architecture.md` (AR / WebXR / model-viewer topics stubbed) |
| Data viz anti-pattern catalog | `capabilities/data-viz/anti-patterns.md` (rest of dir stubbed until Phase 9) |
| Knowledge graph anti-pattern catalog | `capabilities/knowledge-graph/anti-patterns.md` (rest stubbed until Phase 10) |
| Generative audio anti-pattern catalog | `capabilities/generative-audio/anti-patterns.md` (rest stubbed until Phase 8) |
| brand-spec.md schema | `capabilities/_shared/brand-spec-schema.md` (worked examples: `launch/brand-spec.md`, `demos/d9-discovery-walkthrough/brand-spec.md`) |
| UX laws rubric | inline above ("UX law self-check") + per-capability derivations in `capabilities/*/anti-patterns.md` |

## What this skill does NOT do

- iOS Safari WebXR (unsupported at last check, 2026-07; re-verify on caniuse before assuming)
- visionOS WebXR-AR passthrough (non-functional at last check, 2026-07; ship VR-only on Vision Pro)
- 5.1 surround / Atmos export from browser
- Server-side three.js rendering
- Figma round-trip
- Generic frontend coding (use `frontend-design`)
- Production web-app development (the optional Pass 5 export to React/Tailwind is a one-way snapshot for handoff, not a path into app development)

## Lineage

Discipline borrowed from [`alchaincyf/huashu-design`](https://github.com/alchaincyf/huashu-design) (花叔Design). Re-authored English-canonical, extended with Discovery, three new capabilities, and 3D / immersive layer. License posture matches huashu (personal use unrestricted, commercial use requires authorization). See `LICENSE`.

The dial system shape (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY) is influenced by [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill), re-grounded in sigillerie's single-file HTML / three.js / R3F stack rather than the original's React+Tailwind+shadcn target. Sigillerie's `Copy Slop` section in `content-guidelines.md` also draws from taste-skill's "AI Tells" filler-verb ban.
