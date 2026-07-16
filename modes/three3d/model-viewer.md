---
name: model-viewer
description: 3D / Immersive, easy-path <model-viewer> patterns. Stub, planned Phases 4-7.
status: stub
---

# model-viewer

Stub. Shipped today: the easy path works through the generic pipeline (no model-viewer-specific tooling exists). Planned: full pattern guide (Phases 4-7; the planning docs live outside this repo).

Where the facts live now:

| Topic | Location |
|---|---|
| Easy-path contract + real capture path (html mode vs `__renderFrame` shim) | `modes/three3d/page-contract.md` (`<model-viewer>` section) |
| When to pick easy path vs Track A | `modes/three3d/architecture.md` (decision tree, triggers, budgets) |
| Scene Viewer fallback flakiness (Oct 2025 Play Services update) | `modes/three3d/architecture.md` (decision-tree field notes) |
