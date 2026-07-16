---
name: ar-quicklook
description: 3D / Immersive, USDZ + iOS AR routing. Stub, planned Phases 4-7.
status: stub
---

# ar-quicklook

Stub. Shipped today: routing rules only (no USDZ tooling; `assets/usdz-templates/` is empty). Planned: full USDZ authoring + AR Quick Look delivery guide (Phases 4-7; the planning docs live outside this repo).

Where the facts live now:

| Topic | Location |
|---|---|
| iOS routing rule ("AR on iPhone" = easy path + `ios-src=*.usdz`) | `modes/three3d/architecture.md` (decision tree + escalate/downgrade table) |
| iOS Safari WebXR does not exist (2026) | `SKILL.md` "What this skill does NOT do" |
| Easy-path `<model-viewer>` contract + capture | `modes/three3d/page-contract.md` |
| USDZ size cap (8 MB) | `modes/three3d/architecture.md` bundle budgets |
