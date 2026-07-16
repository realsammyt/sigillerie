---
name: brand-spec-schema
description: Cross-capability shared. Schema for brand-spec.md, the canonical freeze artifact
status: seeded (derived from modes/discovery/pipeline.md and modes/producer/core-asset-protocol.md)
---

# brand-spec-schema

Schema for `brand-spec.md`. Discovery writes it in Phase 5, producer mode reads it at the start of every brief. Sources of truth: the Phase 5-to-6 gate and hand-off contract in `modes/discovery/pipeline.md`, plus the "Minimum surface" in `modes/producer/core-asset-protocol.md` Step 4.

Worked example: `launch/brand-spec.md`. Second example from a full Discovery run: `demos/d9-discovery-walkthrough/brand-spec.md`.

## Frontmatter

| Field | Required | Type | Purpose |
|---|---|---|---|
| `brand` | yes | string | Brand name, matches `assets/<brand>-brand/` folder |
| `schema_version` | yes | string | Currently `"1.0"` |
| `locale` | yes | string | `en` / `zh` / other, drives type stack and voice defaults |
| `status` | yes | string | e.g. `full`, `partial`, `inferred`, `provisional-self-brand` |
| `discovery_run` | no | date | Date of the Discovery session that produced the spec |
| `direction` | no | string | Chosen Phase 3 direction, one line |

## Body sections

| Section | Required | Contents | Purpose |
|---|---|---|---|
| Logo | yes | Paths to real files under `assets/<brand>-brand/`, dark-bg and light-bg versions, usage and forbidden rules | Producer references logos as `<img>`, never redraws |
| Palette | yes | Token / hex / role table, provenance per color (where it came from) | Injected as `:root { --brand-* }` CSS variables |
| Type stack | yes | Family per slot (display, body, mono), license per family | License is gate-checked, see below |
| Signature details | yes | The 1-2 details done at 120% | What makes the brand recognizable |
| No-go zones / anti-brand | yes | "What this is not" list plus visual anti-patterns | Critic scans deliverables against this list |
| Vibe keywords | yes | 3-5 adjectives | Shared vocabulary across phases and agents |
| Product imagery | when the brief has a product | Paths to hero / detail / scene renders or photos | Real files only, no CSS silhouettes |
| UI screenshots | when the brief has a UI | Paths to real-resolution screenshots | Same real-files rule |
| Tagline lockup | no | Primary tagline plus secondary lines | In-frame copy source |
| Motion language | no | Easings, stagger, durations for video posts | Keeps animated deliverables coherent |
| Voice | no | Formality / seriousness / warmth plus banned words | Governs any in-frame copy |
| Dials | no | DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY values | See `modes/producer/dials.md` |
| Page contract reminder | no | `__ready`, `__duration`, `__recording` notes | Convenience copy of the recorder contract |
| Known gaps | no | Mirrors `discovery.json#gaps` with severity | High severity blocks final ship |
| `## Audio Brand` | audio-capable briefs only | Extension block | Schema planned in `capabilities/generative-audio/brand-audio-spec.md` (stub today) |

## Validation gate (Phase 5 to 6)

From `modes/discovery/pipeline.md`, the spec validates when all three hold:

| Check | Rule |
|---|---|
| Logo paths | Every referenced logo file exists on disk |
| Palette provenance | Every color names its source (moodboard image, extraction, philosophy default) |
| Type license | Every family names its license (OFL, commercial, etc.) |

No silent gaps: any missing required asset must appear as a gap entry (`severity: high / medium / low`), never be omitted.

## Hand-off bundle

The spec never travels alone. Producer receives: `brand-spec.md`, populated `assets/<brand>-brand/`, `discovery.json` (audit trail), and the `gaps` list. Details: `modes/discovery/pipeline.md` "Hand-off contract".
