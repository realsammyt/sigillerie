---
name: spatial-audio
description: 3D / Immersive, HRTF + PositionalAudio. Stub, planned Phases 4-7.
status: stub
---

# spatial-audio

Stub. Shipped today: the `__audioCues` schema only (a cue's `position` field marks it for `PositionalAudio` / HRTF routing); the sidecar is authored by the agent and mixed by `add-music.sh`. Planned: full spatial-audio authoring guide (Phases 4-7; the planning docs live outside this repo).

Where the facts live now:

| Topic | Location |
|---|---|
| `__audioCues` schema + sidecar workflow | `modes/three3d/page-contract.md` (`__audioCues` section) |
| Audio design rules | `modes/producer/audio-design-rules.md` |
| Mixing script (reads `<video>.mp4.audio-cues.json` or `--sfx-cues`) | `scripts/add-music.sh` |
