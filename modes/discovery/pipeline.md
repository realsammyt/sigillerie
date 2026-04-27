---
name: pipeline
description: Discovery Studio 6-phase machine, state transitions, checkpoints, discovery.json schema, save/resume
---

# pipeline

State machine for Discovery Studio. Six phases, fixed I/O contracts, append-only log. Runs upstream of producer mode. Output: populated `brand-spec.md` plus `assets/<brand>-brand/`. Canonical spec lives at `_planning/DISCOVERY-STUDIO-MODE.md`. This doc is the runtime contract.

## Phase state machine (§B)

| # | Phase | Input | Output | Choose-point | Checkpoint write | Skip | Resume |
|---|---|---|---|---|---|---|---|
| 1 | Intake | First user message | `discovery.json#intake` | None. Listening only. | `discovery.json` (intake block) | No | Yes |
| 2 | Moodboard | intake block | 12-18 images, 3 lanes, `source.json` per image | Tinder pass: keep 5, flinch 1 | `discovery.json#moodboard` + `moodboard/` tree | `--fast` | Yes |
| 3 | Directions | intake + moodboard | 3 HTML lookbook tiles | A / B / C / mix | `discovery.json#directions` + `choosers/phase-3-directions.html` | `--solo-direction` | Yes |
| 4 | Asset build | chosen direction | Files under `assets/<brand>-brand/` | Per-asset pick (3 options each) | `discovery.json#assets` after each asset | Per-asset via `--asset-subset` | Yes (per-slot) |
| 5 | Spec consolidation | chosen assets | `brand-spec.md` | None. Automatic. | `brand-spec.md` written | No | Yes |
| 6 | Hand-off | full spec | summary + gaps + transition | None. Automatic. | `discovery.json#gaps` finalized | No | n/a |

Agent vs user split:

| Action | Agent | User |
|---|---|---|
| Ask 6 intake questions | x | |
| Answer intake questions | | x |
| Pull 12-18 references | x | |
| Tinder pass | | x |
| Render 3 directions | x | |
| Pick A/B/C/mix | | x |
| Run logo tools | x | |
| Pick logo / palette / type | | x |
| Write `brand-spec.md` | x | |
| Sign off on gaps list | | x |

## Transition rules

Phase advances when checkpoint writes succeed and choose-point resolves. Otherwise blocked.

- **1 → 2**: all 6 intake fields present (or marked `inferred: true` from public sources). Locale captured.
- **2 → 3**: at least 5 kept images and 1 flinch logged. If user keeps fewer, agent prompts once, then proceeds.
- **3 → 4**: `directions.chosen` set. Mix string parsed to per-asset overrides.
- **4 → 5**: every required asset slot has `chosen` or `status: gap`. No silent gaps.
- **5 → 6**: `brand-spec.md` validates against producer schema (logo paths exist, palette has provenance, type stack has license).

Failure paths (§F):

- **Quality floor breach**: 3 weak logos. Agent does not advance. Re-runs phase 4 logo slot with adjusted prompts. Logged as `regenerate_event`.
- **Logo collision**: TinEye / Brandmark hit. Surface URL, branch into regen-with-constraint or pivot-to-acquire. Logged as `collision_event`.
- **Mid-pipeline abandon**: state on disk after every phase. No transition.
- **Discovery cannot make it**: real photo of nonexistent hardware. `status: gap, severity: high`. Producer mode flags or refuses.
- **Skip to producer**: respected. Minimal spec written, fields tagged `inferred` or `missing`. Warning surfaced.

## discovery.json schema (§D)

Append-only events log. Every `chosen` cites `alternatives`. Re-picks fork to `discovery.v2.json`.

```json
{
  "schema_version": "1.0",
  "brand": "Vellum",
  "locale": "en",
  "started_at": "2026-04-27T14:02:11Z",
  "current_phase": 6,
  "intake": {
    "product": "calm reading app, iOS first, distraction-free long-form",
    "audience": "knowledge workers who hoard articles and never read them",
    "problem": "saved-for-later piles that breed guilt and never get read",
    "vibe_words": ["calm", "literary", "patient"],
    "anti_brands": ["Pocket", "Instapaper-circa-2012"],
    "first_surface": "app",
    "inferred_fields": []
  },
  "moodboard": {
    "kept": [
      "moodboard/03-philosophy/02-hara-muji-spread.jpg",
      "moodboard/02-aspirational/04-readwise-reader.png",
      "moodboard/01-direct/03-matter-app-hero.png",
      "moodboard/03-philosophy/05-iA-writer-typography.png",
      "moodboard/02-aspirational/01-arc-browser-easels.png"
    ],
    "rejected": [
      "moodboard/01-direct/01-pocket-2024.png",
      "moodboard/01-direct/02-instapaper-default.png"
    ],
    "flinch": [
      {"image": "moodboard/01-direct/01-pocket-2024.png", "reason": "loud orange, gamified, anti-calm"}
    ]
  },
  "directions": {
    "shortlist": [
      {"philosophy": "Kenya Hara, Eastern Minimalism", "rationale": "vibe-words map directly; flinch was loud-color, this row anchors on white-space", "rendered_at": "choosers/phase-3-directions.html#A"},
      {"philosophy": "iA, Information Architecture", "rationale": "literary + patient → typographic system, not motion-led", "rendered_at": "choosers/phase-3-directions.html#B"},
      {"philosophy": "Field.io, Motion Poetics", "rationale": "control row; user can reject motion-led explicitly", "rendered_at": "choosers/phase-3-directions.html#C"}
    ],
    "chosen": "Kenya Hara, Eastern Minimalism",
    "mix": "A grid + B's typography"
  },
  "assets": {
    "logo": {
      "chosen": "assets/vellum-brand/logo-option-a.svg",
      "source": "Recraft SVG vector",
      "prompt": "minimal serif wordmark 'Vellum', single-stroke V ligature, ivory ground",
      "alternatives": ["logo-option-b.svg", "logo-option-c.svg"]
    },
    "palette": {
      "chosen": "assets/vellum-brand/palette.css",
      "source": "extracted from moodboard image #2 (Hara MUJI spread)",
      "alternatives": ["palette-khroma.css", "palette-philosophy-default.css"]
    },
    "typography": {
      "chosen": "Söhne Buch + Source Serif Pro + JetBrains Mono",
      "license": "Söhne commercial / OFL / OFL",
      "alternatives": ["Inter + Crimson Pro", "Geist + Newsreader"]
    },
    "iconography": {"chosen": "Phosphor"},
    "product_imagery": {
      "status": "rendered",
      "files": ["assets/vellum-brand/product-hero.png"]
    },
    "ui_screenshots": {
      "status": "mocked",
      "files": ["assets/vellum-brand/ui-home.png", "assets/vellum-brand/ui-reader.png", "assets/vellum-brand/ui-library.png"]
    },
    "voice": {
      "framework": "Atlassian voice principles",
      "card": "assets/vellum-brand/voice.md"
    }
  },
  "gaps": [
    {"asset": "real-device-photography", "severity": "medium", "next_action": "user shoots iPhone-in-hand once TestFlight build exists"}
  ],
  "events": [
    {"ts": "2026-04-27T14:08:44Z", "phase": 1, "action": "intake complete", "artifact": "discovery.json"},
    {"ts": "2026-04-27T14:21:02Z", "phase": 2, "action": "kept 5, flinched Pocket-2024", "artifact": "moodboard/"},
    {"ts": "2026-04-27T14:34:18Z", "phase": 3, "action": "chose Hara, mix B typography", "artifact": "choosers/phase-3-directions.html"},
    {"ts": "2026-04-27T14:51:09Z", "phase": 4, "action": "logo: chose A", "artifact": "assets/vellum-brand/logo-option-a.svg"},
    {"ts": "2026-04-27T14:53:40Z", "phase": 4, "action": "palette: chose moodboard-extracted", "artifact": "assets/vellum-brand/palette.css"}
  ]
}
```

## Append-only events log

Rules:

- `events` array is append-only. Never mutate prior entries.
- Re-pick = new event, new `artifact`, prior choice stays in `alternatives`.
- Re-running phase 4 with different prompts forks to `discovery.v2.json`. Original kept.
- Every `chosen` field cites at least one `alternatives` entry so rejected paths recover.
- `gaps` array drives producer-mode delivery flagging. High-severity gaps block ship.

## Save / resume

State persists to `discovery.json` after every phase end and after every asset slot in phase 4.

- `/discover resume` reads `discovery.json`, prints current phase, asks: "stopped at phase N, keep going or restart?"
- `/discover [brand]` on existing brand folder: same prompt.
- Partial-asset entry: agent audits before phase 1. Existing files, prior `brand-spec.md`, user URLs all parsed. Discovery enters at first phase where info is actually missing. Logo + palette present but no voice → enter at phase 4's voice slot. Phases 1-2 run lightly for vibe capture only.
- Mid-phase abandon: agent writes partial state, exits clean. `current_phase` reflects last completed phase, not current.
- Restart: `/discover [brand] --restart` archives prior `discovery.json` to `discovery.archive-{ts}.json` and starts fresh.

## Locale handling (§F)

`intake.locale` captured in phase 1, threaded through every prompt downstream.

| Locale | Effect |
|---|---|
| `zh` | Moodboard sources weighted to Chinese-speaking studios. Type pairings include CJK families (Source Han Sans, Noto CJK). Voice framework offers Chinese tone variant. Triggers fire on zh phrases. |
| `en` | Default sources. Latin type stack. English voice frameworks (Mailchimp, Atlassian). |
| Other | Falls back to `en` with a logged warning. User can override per-asset. |

Locale never assumed. If intake is mixed-language, agent asks once and locks.

## Phase-end checkpoint script (§G)

After every phase, agent writes:

```
<project>/
  discovery.json                  # updated, append-only events
  discovery-canvas.html           # re-rendered timeline
```

Per-phase additions:

| Phase | Additional writes |
|---|---|
| 1 | none |
| 2 | `moodboard/{01-direct,02-aspirational,03-philosophy}/*.jpg` + `*-source.json` |
| 3 | `choosers/phase-3-directions.html` |
| 4 | `assets/<brand>-brand/{logo*.svg, palette.{css,json}, type-stack.css, product-hero.png, ui-*.png, voice.md, icon-system.txt}` + `choosers/phase-4-{slot}.html` per slot |
| 5 | `brand-spec.md` |
| 6 | `gaps` finalized in `discovery.json` |
| 5.5 (opt-in) | `tokens/{tokens.css, tokens.json, frame.html, slide-template.html}` |
| 4 (3D lane) | `3d/{hero.glb, hero.usdz, env.hdr, materials.json}` if `first_surface` is `ar`/`xr`/`3d-deck`/`model-viewer` |

Non-destructive. Re-running phase 4 with different prompts adds new option files. Never overwrites.

## Hand-off contract

Producer mode receives:

- `brand-spec.md` matching producer schema (logo paths, product images, UI screenshots, palette with provenance, type stack, signature details, no-go zones, vibe keywords)
- `assets/<brand>-brand/` populated
- `discovery.json` for audit trail
- `gaps` list with severity per entry

Gap shape:

```json
{"asset": "product-hero", "severity": "high | medium | low", "next_action": "user must shoot or commission"}
```

Severity rules:

- **high**: producer mode refuses to ship final delivery. Placeholder allowed in draft only.
- **medium**: producer mode ships with watermark or caveat in `## Known gaps` section.
- **low**: cosmetic. Producer ships clean.

Producer preflight reads `gaps` first. If any high-severity gap, producer prompts user before proceeding. Discovery's job ends at hand-off; producer owns delivery quality from there.
