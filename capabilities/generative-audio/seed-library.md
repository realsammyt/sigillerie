---
name: seed-library
description: Generative Audio capability — TODO Phase 8
status: stub
---

# seed-library

Stub, planned for Phase 8. Planned: the seed inventory (8 BGM + 32 SFX) and license posture that `modes/producer/audio-design-rules.md` and `modes/producer/sfx-library.md` defer here. Exists today: nothing. `scripts/seed-audio-library.mjs` does not exist, no audio assets ship under `assets/`, and `scripts/add-music.sh` exits 1 without an explicit `--bgm=<path>` because its default (`assets/audio/sigillerie-default/bgm-tutorial.mp3`) is absent. Per `modes/producer/sfx-library.md`, any bundled defaults would be personal-use prototyping only.
