---
name: sigillerie
description: Sigillerie · AI design studio that ships single-file HTML deliverables (animations, prototypes, slide decks, infographics, data viz, knowledge graphs, 3D / immersive, generative audio). Three modes (Discovery / Producer / 3D) × four capabilities (Hi-Fi Base / Data Viz / Knowledge Graph / Generative Audio). Triggers EN/ZH — discover, studio, brand, design, prototype, app mockup, iOS prototype, slide deck, presentation, animation, hero, MP4 export, GIF export, infographic, dashboard, chart, viz, data-story, scrollytelling, knowledge graph, ontology, network, vault explorer, agent-os swarm, 3D, spatial, AR, AR Quick Look, model-viewer, WebXR, Vision Pro, Quest, walkthrough, generative audio, BGM, SFX, audio brand, parametric SFX, sonification, expert review, critique, ux audit, ux review, heuristic review, usability check, cognitive load review, decision fatigue, 评审, 做原型, 设计变体, 推荐风格, 沉浸式, 立体展示, 动画 Demo, 数据可视化, 知识图谱, 生成音频. English-canonical docs.
---

# Sigillerie

One sentence in. Real-studio design out. Flat or spatial, AR or page, animated or scored. Three modes, four capabilities, one tool.

## Modes (operational stance)

| Mode | Fires when | Output |
|---|---|---|
| **Discovery** | brief is vague, no `brand-spec.md`, "starting from scratch", `/discover`, `/studio` | populated `brand-spec.md` + assets ready for Producer |
| **Producer** | brand-spec exists, brief is concrete | hi-fi HTML deliverable + MP4/PDF/PPTX/GIF as needed |
| **3D / Immersive** | "3D", "spatial", "AR", "WebXR", "Vision Pro", "Quest", "walkthrough" | three.js / R3F / `<model-viewer>` HTML + MP4 |

Modes compose. `/discover` then `/3d product hero` is normal.

## Capabilities (output type)

| Capability | Triggers | Reads |
|---|---|---|
| **Hi-Fi Base** | "hero animation", "iOS prototype", "slide deck", "infographic", `/animate`, `/deck`, `/prototype` | `modes/producer/` |
| **Data Visualization** | `/viz`, `/chart`, `/dashboard`, "visualize this CSV", "scrollytelling", "data story" | `capabilities/data-viz/` |
| **Knowledge Graph** | `/kg`, `/graph`, `/network`, `/ontology`, "visualize my Notion / Obsidian / agent-os graph" | `capabilities/knowledge-graph/` |
| **Generative Audio** | `/audio`, `/bgm generate`, `/sfx generate`, `/audio brand`, "score this deck", "spatial audio" | `capabilities/generative-audio/` |

## Routing

1. Check brief for triggers above. If multiple match, pick the most specific.
2. Check for `brand-spec.md` at project root or `assets/<brand>-brand/`. If missing → Discovery first unless user says skip.
3. Pick rendering pipeline:
   - HTML/CSS only → `--mode=html` (Playwright recordVideo)
   - WebGL/WebGPU → `--mode=3d` (CDP `HeadlessExperimental.beginFrame`)
   - Runtime audio synthesis → add `--audio=tone`
4. Read the relevant capability's references before authoring. Never guess a chart type, layout algorithm, audio engine, or device frame from memory.

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

`verify.py` enforces this. No `Date.now`, no `Clock.getDelta` for animation timing — only `__renderFrame(t)`.

## References map

| Topic | Path |
|---|---|
| Discovery (6 phases, options UX, JSON schema) | `modes/discovery/` |
| Producer workflow + asset protocol + critique | `modes/producer/` |
| Producer dials (VARIANCE / MOTION / DENSITY) | `modes/producer/dials.md` |
| 3D Track A vs B + page contract + recipes | `modes/three3d/` |
| Data viz stack + ingestion + print export | `capabilities/data-viz/` |
| Knowledge graph stack + storytelling + dogfood | `capabilities/knowledge-graph/` |
| Generative audio (Tone.js + Stable Audio + ElevenLabs) | `capabilities/generative-audio/` |
| brand-spec.md schema | `capabilities/_shared/brand-spec-schema.md` |
| UX laws rubric + integration plan | `_planning/UX-LAWS-INTEGRATION.md` |

## What this skill does NOT do

- iOS Safari WebXR (does not exist in 2026)
- visionOS WebXR-AR passthrough (non-functional, ship VR-only on Vision Pro)
- 5.1 surround / Atmos export from browser
- Server-side three.js rendering
- Figma round-trip
- Generic frontend coding (use `frontend-design`)
- Production web-app development

## Lineage

Discipline borrowed from [`alchaincyf/huashu-design`](https://github.com/alchaincyf/huashu-design) (花叔Design). Re-authored English-canonical, extended with Discovery, three new capabilities, and 3D / immersive layer. License posture matches huashu (personal use unrestricted, commercial use requires authorization). See `LICENSE`.

The dial system shape (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY) is influenced by [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill), re-grounded in sigillerie's single-file HTML / three.js / R3F stack rather than the original's React+Tailwind+shadcn target. Sigillerie's `Copy Slop` section in `content-guidelines.md` also draws from taste-skill's "AI Tells" filler-verb ban.
