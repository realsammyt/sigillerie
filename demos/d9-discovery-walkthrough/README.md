# d9 · Discovery walkthrough · Vellum

A complete simulated Discovery run, end to end. Six phases, one fictional brand,
all artifacts hand-built so the structure of Discovery's output is legible
without any API spend.

## What this demo shows

- A populated `brand-spec.md` ready for producer-mode hand-off
- Three visually-different logo SVGs from three different schools of design
- A palette extracted from a moodboard image, with provenance
- A type stack with license noted per family and CJK fallback chain
- A 1-page voice card scored on three axes, with six example sentences
- A full `discovery.json` decision log: 38 events, 6 phases, append-only
- Three chooser HTML pages replaying what the user saw at each choose-point
- A `discovery-canvas.html` rendering the whole timeline as one page

## Brand · Vellum

Calm reading app for biologists. Audience: biologists at dawn, pre-coffee.
Vibe-words: calm, technical, irreverent. Anti-brands: bookworm clichés,
gamified reading apps, generic Kindle clones. First surface: web reading app.

Direction picked: Kenya Hara, Eastern Minimalism (whitespace-anchored), with
iA Content-First typography mixed in. The choose-point rationale: vibe-words
map directly to the Hara row, and the moodboard flinch was on Pocket-2024's
loud orange. Anchoring on whitespace defends against that flinch structurally.

## Time stamp

Simulated 45-minute run, 2026-04-27 09:14:08Z to 09:59:44Z. 52 agent turns,
0 image generations, 6 web searches in the simulated trace. Real runs
typically cost 15–25 image generations; this demo is hand-built so the
golden test runs free.

## Files map

```
d9-discovery-walkthrough/
  README.md                            this file
  brand-spec.md                        producer contract, populated
  discovery.json                       full 6-phase decision log
  discovery-canvas.html                rendered timeline (open in browser)
  moodboard/
    README.md                          three lanes, what the pass showed
    sources.json                       URL list for would-have-been refs
  assets/vellum-brand/
    logo.svg                           chosen logo (== logo-option-b.svg)
    logo-option-a.svg                  Pentagram-Typographic IA, rejected
    logo-option-b.svg                  Hara-Whitespace, chosen
    logo-option-c.svg                  Sagmeister-Visceral, rejected
    logo-white.svg                     chosen logo for dark backgrounds
    palette.css                        CSS custom properties + dark mode
    palette.json                       Style Dictionary tokens
    type-stack.css                     Source Serif + Inter + JetBrains Mono
    voice.md                           three-axis voice card, six sentences
    icon-system.txt                    Lucide v0.469.0 thin
  choosers/
    phase-2-moodboard.html             tinder pass replay, 5 kept / 1 flinch
    phase-3-directions.html            3-up direction shortlist replay
    phase-4-logo.html                  3-up logo replay with all SVGs inline
```

## How to view

Open `discovery-canvas.html` in a browser. The page reads `discovery.json`
and renders a vertical timeline of all six phases. Events, choose-points,
the chosen artifact, the rejects. Every artifact is one click away.

For a single-phase view, open any of the `choosers/*.html` files directly.

For producer hand-off, open `brand-spec.md`. That is the contract Vellum's
producer-mode session would read on its first turn.

## What is and is not real

Real:

- The three logo SVGs. Hand-coded, valid, distinct, render in any browser.
- The palette and type stack. Real OFL-licensed families, real hex values,
  real dark-mode flip.
- The voice card scoring. Real three-axis framework from
  `modes/discovery/voice-frameworks/three-axis.md`.
- The decision log shape. Schema v1.0 from `modes/discovery/pipeline.md`.

Not real:

- The 15 moodboard images. URLs listed in `sources.json` are the references
  that would have been fetched. The thumbnails are text-only.
- The product imagery and UI screenshots. Marked as gaps in the spec
  (severity: high for the hero shot, medium for the UI mocks). Producer
  mode refuses final delivery while high-severity gaps stand. This is the
  designed behavior, not a demo shortcut.
- The 45-minute timestamps in `discovery.json#events`. Authored, not logged.

## Visual differentiation of the three logos

Required by the Phase 2 golden test. Each SVG sits at the same canvas
(240×80, viewBox 0 0 240 80) so they compare cleanly:

- **Option A (Pentagram).** Pure serif wordmark, tight tracking, 36px
  Source Serif, hairline rule under the type, mono metadata strip below.
  No mark. Reads as masthead.
- **Option B (Hara, chosen).** Single open arc above lowercase Inter
  Light wordmark tracked at 3.6em. Negative space dominates. Reads as breath.
- **Option C (Sagmeister).** Torn-paper top edge, letterforms with
  individual rotations, rust accent block bleeding off the right margin,
  monospaced "read slow." stamp. Reads as music magazine.

Three distinct schools, three distinct moves, one canvas size.
