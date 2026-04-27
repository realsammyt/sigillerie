---
brand: Vellum
locale: en
discovery_run: 2026-04-27
discovery_duration_min: 45
status: provisional
direction: Kenya Hara, Eastern Minimalism (whitespace-anchored)
schema_version: 1.0
---

# Vellum · brand-spec

> Provisional. Built in 45 minutes. Expected to evolve. Header says so.

A calm reading app for biologists. The audience is biologists at dawn,
pre-coffee. The problem it kills is distraction, plus the performative
reading-app energy that has crept across the category.

## Vibe keywords

calm · technical · irreverent

## What this is not

- bookworm clichés (curl up, cozy, tome, snuggle)
- gamified reading apps (streaks, badges, quantified guilt)
- generic Kindle clones (one column, generic Caslon, no opinion)

These three rule out specific design moves downstream. See no-go zones below.

## Direction

Kenya Hara, Eastern Minimalism. School 3, philosophy #9 in
`modes/discovery/direction-library.md`.

Why this row landed:

- vibe-words map directly. calm + technical reads as restraint, not minimalism-as-trend.
- moodboard flinch was loud-color (Pocket-2024). this row anchors on white-space,
  which defends against that flinch structurally.
- audience is pre-coffee biologists. the page must not yell.

The user mixed in iA Content-First typography (option B in the shortlist) for the
type stack. The grid and atmosphere stay Hara. Logged in `discovery.json#directions.mix`.

## Logo

| File                                         | Use                                  |
|----------------------------------------------|--------------------------------------|
| `assets/vellum-brand/logo.svg`               | primary, on `--paper` background     |
| `assets/vellum-brand/logo-white.svg`         | on `--ink` background                |
| `assets/vellum-brand/logo-option-a.svg`      | rejected alternate (Pentagram-IA)    |
| `assets/vellum-brand/logo-option-b.svg`      | chosen (== `logo.svg`)               |
| `assets/vellum-brand/logo-option-c.svg`      | rejected alternate (Sagmeister)      |

The chosen mark is a single open arc above the wordmark. The arc reads as a
page edge curling, a thumb under a book spine, or a sunrise just barely
cresting the horizon. Ambiguity is the point. The wordmark is Inter Light
at 16px, tracked open at 3.6 letter-spacing.

Min size: 60px wide. Below that the arc collapses visually. Use the wordmark
alone (no mark) for favicon and avatar contexts.

## Palette

| Token                  | Hex      | Role                                              | Cap        |
|------------------------|----------|---------------------------------------------------|------------|
| `--paper`              | #FAF7F0  | body color, the whitespace anchor                 | ~80%       |
| `--ink`                | #1B1614  | body type, the only type color                    | ~12%       |
| `--accent-quiet`       | #6E6862  | secondary text, hairline rules                    | ~5%        |
| `--accent-rare`        | #9A4B3D  | rust orange, one element max per composition      | 5% hard cap|
| `--surface-secondary`  | #EFE9DD  | cards, elevated panels                            | as needed  |

Provenance: extracted from moodboard image #7 (MUJI Atsumi Tea spread) via
chroma.js k-means, k=5. CSS at `assets/vellum-brand/palette.css`. Tokens at
`assets/vellum-brand/palette.json`. Dark mode flip ships in the CSS.

## Type stack

| Slot     | Family             | License | Fallback chain                                  |
|----------|--------------------|---------|-------------------------------------------------|
| Display  | Source Serif Pro   | SIL OFL | Source Serif, Georgia, Times New Roman, serif   |
| Body     | Inter              | SIL OFL | system-ui, Helvetica Neue, sans-serif           |
| Mono     | JetBrains Mono     | SIL OFL | Source Code Pro, ui-monospace, monospace        |

Locale is `en`. CJK fallback families (Source Han, Noto CJK, Sarasa Mono)
are listed in the stack so a future zh fork inherits a working setup.
Sizing: golden-ratio scale anchored at 16px body. Reading line at 66ch.

CSS at `assets/vellum-brand/type-stack.css`.

## Icon system

Lucide v0.469.0 thin (1.25 stroke). Sizes 18px and 24px only. Color via
`currentColor`, never hard-coded. See `assets/vellum-brand/icon-system.txt`
for full rules.

## Voice

Three-axis framework. Scores: formality 0, seriousness -1, warmth +1.

The voice card lives at `assets/vellum-brand/voice.md`. Six example sentences
plus a do/don't table plus an anti-brand-in-voice-terms section.

## Audio Brand

Deferred to v2. The intake did not mention sound, video, or kiosk surfaces;
the first surface is a web reading app, where audio is the wrong default.
Re-open during a future Discovery run with `--audio` if Vellum ships a
podcast-listen mode or a kiosk install.

## Signature details

- 80%-plus negative space on every page. Treat as a rule, not a tendency.
- One rust accent per page maximum. If you need two, the page is doing too much.
- Hairline rules at 0.5px or 0.75px, never 1px. The page should feel inked, not drawn.
- Headers in lowercase serif. Title Case is for the page meta only.
- Single open-arc echoes throughout the product (loading state, end-of-article,
  empty library state). The mark is a vocabulary, not just a logo.

## No-go zones

- pure white (#FFFFFF). Too clinical, breaks the warm-paper feel.
- pure black (#000000). Same, breaks ink warmth.
- saturated blues. Every reading app uses them, anti-distinctive.
- saturated greens. Similarly default-coded.
- streak language ("X days in a row"). Directly anti the audience.
- rounded corners above 4px. Soft-tech sentiment, not Vellum.
- drop shadows. The surface is paper, not glass.
- skeumorphic page-flip. Kindle clone signal.

## Product imagery

| Asset                              | Status | Source / next action                         |
|------------------------------------|--------|----------------------------------------------|
| product-hero.png                   | gap    | user must commission or shoot                |
| biologist-hands-with-paper.jpg     | gap    | needs real photography of biologist + paper  |
| ui-home.png                        | gap    | mock once Phase 1 of build exists            |
| ui-reader.png                      | gap    | mock once reader UI is wired                 |
| ui-library.png                     | gap    | mock once library view is wired              |

All five flagged in `discovery.json#gaps`. Severity: high for the
biologist-hands shot (hero unit, real claim), medium for the rest.

Rule from `modes/discovery/asset-pathways.md`: the agent never hallucinates
a real-product photo. Producer mode will refuse to ship final delivery while
high-severity gaps stand. Placeholders allowed in draft only.

## How producer mode reads this

Producer reads:

1. `## Logo` for asset paths, picks `logo.svg` by default
2. `## Palette` for CSS custom properties, drops `palette.css` into the deliverable
3. `## Type stack` for `@font-face` or system stack assembly
4. `## Voice` for copy generation, scores feed the voice prompt
5. `## No-go zones` as exclusion rules in any generation prompt
6. `## Signature details` as inclusion rules
7. `## Product imagery` for asset slots and gap flags

If a slot is gap-flagged high, producer prompts the user before drafting.

## Audit trail

Full Discovery decision log at `discovery.json`. Human-readable rendering at
`discovery-canvas.html`. Six phases, ~45 minutes wall-clock, three logo options
hand-built, palette extracted from moodboard image #7, type pairing pulled from
Typewolf editorial reference, voice scored on three axes from intake vibe-words.

Every chosen asset cites its alternatives. Every reject is recoverable.
