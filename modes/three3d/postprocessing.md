---
name: postprocessing
description: 3D / Immersive, bloom / DOF / vignette guide. Stub, planned Phases 4-7.
status: stub
---

# postprocessing

Stub. Shipped today: composer + bloom / DOF / vignette / output passes in `assets/tsl-effects.js`, default recipe wiring in `assets/three3d/recipe-baseline.js`. Planned: full postfx guide, n8ao and friends (Phases 4-7; the planning docs live outside this repo).

Where the facts live now:

| Topic | Location |
|---|---|
| Postfx as default for hero deliverables + recipe defaults | `modes/three3d/aesthetic.md` § 4, § 12 |
| Pass implementations (createComposer, addBloom, addDOF, addVignette, addOutputPass) | `assets/tsl-effects.js` |
| Default wiring used by recipes | `assets/three3d/recipe-baseline.js` |
| MSAA on composer render targets | `modes/three3d/pitfalls.md` § 7 |
