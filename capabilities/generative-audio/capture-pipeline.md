---
name: capture-pipeline
description: Generative Audio capability — TODO Phase 8
status: stub
---

# capture-pipeline

Stub, planned for Phase 8. Planned: the `--audio=tone` capture mechanics, audio cue schema, and LUFS rules that `modes/producer/video-export.md`, `modes/three3d/page-contract.md`, and `modes/three3d/color-management.md` route here. Exists today: the contract is implemented in `scripts/render-video.js` (page calls `__sigillerieRegisterRecorder`, exposes `__audioStart()` / `__audioStop()`, MediaRecorder OPUS capture); mix rules live in `modes/producer/audio-design-rules.md`.
