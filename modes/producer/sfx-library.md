---
name: sfx-library
description: SFX cue contract. 32 planned cues across 8 categories with per-cue use guidance, pitch variants, narrative placement notes. Generator script planned, not shipped.
---

# sfx-library

Sigillerie's SFX cue contract. 32 cues, 8 categories, 4 cues per category. Each cue comes in 3 pitch variants (low, mid, high). 96 audio files per brand library once generated.

Target generator: `scripts/seed-audio-library.mjs` through the ElevenLabs Sound Effects API. Planned, not shipped; no SFX audio files ship in the repo today. Until it lands, generate cues to this naming contract yourself and log a license trail per asset (minimum entry schema in `capabilities/generative-audio/anti-patterns.md`, the one substantive file in that capability). Path contract: `assets/<brand>-brand/audio/sfx/<category>/<cue>-<pitch>.mp3`.

SFX serves motion. Motion does not serve SFX. If a cue is the reason a beat exists, cut the beat.

---

## The 32 cues

### magic (AI shimmer, reveal sparkle, transform tail)

| cue | use |
|---|---|
| `magic-sparkle` | subtle accent for hover or reveal moments under 200ms |
| `magic-shimmer` | rising tail behind AI generation states, 600 to 900ms |
| `magic-transform` | morph or before-after pivot, ride the visual midpoint |
| `magic-twinkle` | small grace note, footnote reveal, micro-celebration |

### impact (logo hits, drops, thuds)

| cue | use |
|---|---|
| `impact-logo` | hero brand stamp, lands on the still frame after motion settles |
| `impact-drop` | object placement, card lock, modal commit |
| `impact-thud` | heavy arrival, low body, pairs with screen shake |
| `impact-stamp` | certification, seal, finality |

### whoosh (air motion, transitions, swipes)

| cue | use |
|---|---|
| `whoosh-fast` | quick title flash, label cut, under 400ms |
| `whoosh-slow` | hero transitions, panel slide, 600 to 1000ms |
| `whoosh-sweep` | horizontal carousel, tab cycle, lateral camera move |
| `whoosh-rise` | upward reveal, chart bar grow, scroll-triggered entrance |

### click (UI taps, button presses, mechanical pulses)

| cue | use |
|---|---|
| `click-crisp` | primary button, default tap, mid-pitch fits most palettes |
| `click-soft` | secondary button, link, low-stakes action |
| `click-tap` | mobile finger tap, iOS-style muted contact |
| `click-toggle` | switch, checkbox, on/off state change |

### transition (scene changes, dissolves, slides)

| cue | use |
|---|---|
| `transition-slide` | side panel, drawer, lateral entrance |
| `transition-dissolve` | image cross-fade, soft blur entry |
| `transition-snap` | card lock into grid, stack collapse |
| `transition-flip` | front-to-back card pivot, page turn |

### notify (success, error, alert, achievement)

| cue | use |
|---|---|
| `notify-success` | two-tone ascending, payment done, task complete |
| `notify-error` | descending warning, soft, never harsh |
| `notify-pop` | toast, message arrival, low-priority alert |
| `notify-achievement` | rising arpeggio for milestone, badge, hero-tier moment |

### mechanical (keyboard, terminal, machine cues)

| cue | use |
|---|---|
| `mechanical-type` | single key, rhythm element for typed sequences |
| `mechanical-enter` | confirm, command commit, line break |
| `mechanical-execute` | terminal run, build kick, script start |
| `mechanical-tick` | progress beat, loading rhythm, idle pulse |

### organic (paper, fabric, natural texture)

| cue | use |
|---|---|
| `organic-paper` | document arrival, page surface, contract feel |
| `organic-stack` | papers collapsing, list aggregation, group action |
| `organic-fabric` | soft swipe over textile, gentle dismiss |
| `organic-water` | drip or ripple accent, calm-brand transitions |

---

## Pitch variants

Every cue ships at three pitches: low, mid, high. Files named `<cue>-low.mp3`, `<cue>-mid.mp3`, `<cue>-high.mp3`.

- **Default**: pick mid for most contexts. It mixes against any BGM bed.
- **Low**: pairs with heavy visual events, dark brands, slow ease curves.
- **High**: small grace notes, micro-interactions, bright brand palettes.

For static MP4 deliverables, the producer picks one variant per cue placement and burns it in.

For interactive deliverables, all three variants load and Tone.js `PitchShift` interpolates between them in real time. Click counters, scroll velocity, scene state can drive the variant pick or the shift amount (typically ±200 cents around the chosen base). Runtime patch doc: `capabilities/generative-audio/parametric-sfx.md` (stub today).

---

## Narrative placement rules

**SFX serves motion, not the other way.** If a cue exists for itself, cut it. The visual event is primary. The cue confirms what the eye already saw.

**Density bands by deliverable type.**

- Hero animation, logo reveal, brand sting: max **6 SFX per 10 seconds**. Beyond that, the ear stops parsing and starts hearing noise.
- Tool demo, walkthrough, screen recording: **0 to 2 SFX per 10 seconds**. Restraint is the brand. Most clicks should pass silent. Punctuate the meaningful ones.
- Slide deck BGM bed: SFX only on transition beats and one hero moment per slide. Density is driven by slide cadence, not seconds.

**Stacking limit.** At any single time point, max 2 SFX simultaneous. If BGM ducks below 0.3, 3 SFX is acceptable. On brand impact moments, clear all other SFX 200ms before the hit and let the impact land alone.

**Duration matching.** SFX duration must sit within 1.2x of the visual event it scores. A 600ms ease cannot carry a 200ms whoosh and cannot carry a 2s shimmer. Pick or trim accordingly.

**Frequency bed coordination.** BGM lives under 2 kHz. SFX from 1 kHz up. The 1 to 2 kHz overlap is where SFX side-chains BGM during cues. The seed library tracks the BGM track its cues will sit against.

---

## Regeneration (planned, not shipped)

`scripts/seed-audio-library.mjs` does not exist yet. Target design: regenerate the library from prompts in `brand-spec.md` under the `## Audio Brand` block, defaults inherited from visual direction, deterministic output so MP3 references in deliverables stay valid across regenerations. Key from `SIGILLERIE_ELEVENLABS_KEY` env or `--api-key=<...>`; each cue logged to `audio-license.json` with model version, prompt, generation date, license tier.

**Commercial use requires the user's own ElevenLabs API key on a tier permitting commercial output.** Prototyping output is personal-use only. Spec home: `capabilities/generative-audio/seed-library.md` (stub today).

---

## Selection decision tree

1. Tactile action (type, click, swipe)? → `mechanical` or `click`
2. Element entering or leaving? → `whoosh` or `transition`
3. State feedback (success, error, alert)? → `notify`
4. Brand stamp, hero moment? → `impact`
5. AI generation, morph, sparkle? → `magic`
6. Paper, fabric, natural texture? → `organic`

If none fit, the cue probably shouldn't exist. Cut the beat.

---

## Cross-references

- Anti-patterns + license-trail entry schema (the one substantive file today): `capabilities/generative-audio/anti-patterns.md`
- Seed library spec, prompts, license trail: `capabilities/generative-audio/seed-library.md` (stub today)
- Parametric SFX runtime patch (Tone.js PitchShift): `capabilities/generative-audio/parametric-sfx.md` (stub today)
- Two-track BGM + SFX system: `capabilities/generative-audio/two-tracks.md` (stub today)
- Brand audio spec block: `capabilities/generative-audio/brand-audio-spec.md` (stub today)
