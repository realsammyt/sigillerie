# Vellum · moodboard

Phase 2 of the Discovery run. Three lanes, 15 references total, 5 kept,
9 rejected, 1 flinch. No actual JPGs were fetched for this demo; this folder
records what would have been collected and why.

## Lane 01 · Direct competitors (4 refs)

What sits in the same shelf as Vellum at the App Store / on the web.

| # | Source                                | Captured for                  | Verdict     |
|---|---------------------------------------|-------------------------------|-------------|
| 1 | Pocket 2024 marketing site            | The category default          | flinch      |
| 2 | Instapaper default reading view       | Aging type, generic chrome    | rejected    |
| 3 | Feedly home dashboard                 | Saved-for-later overload UI   | rejected    |
| 4 | Matter app, quiet reading view        | Closest contemporary peer     | kept        |

The flinch on Pocket-2024 (loud orange, gamified streaks) is the
load-bearing signal of the whole moodboard pass. Every downstream choice
defends against it.

## Lane 02 · Aspirational adjacent (5 refs)

Brands matching the vibe-words semantically. Not competitors. Not in the
reading-app space necessarily.

| # | Source                                | Captured for                  | Verdict     |
|---|---------------------------------------|-------------------------------|-------------|
| 5 | Arc Browser, easels feature           | Adjacent productivity         | rejected    |
| 6 | Readwise, streaks feature             | Aspirational but gamified     | rejected    |
| 7 | Readwise Reader, clean                | Clean reading surface         | kept        |
| 8 | iA Writer, paper view                 | The platonic reading paper    | kept        |

## Lane 03 · Philosophy pattern matches (6 refs)

Seeded from `modes/discovery/direction-library.md`. One per row of the
5-school grid plus a few extras to widen the range.

| #  | Source                                | School / philosophy           | Verdict   |
|----|---------------------------------------|-------------------------------|-----------|
| 9  | Pentagram, MIT Press redesign         | School 1, Pentagram-Typo IA   | rejected  |
| 10 | Hara, Designing Design book spread    | School 3, Hara-Whitespace     | kept      |
| 11 | Field.io, British Council install     | School 2, Kinetic             | rejected  |
| 12 | Active Theory, NASA Prospect          | School 2, WebGL               | rejected  |
| 13 | iA Writer, typography reference       | School 1, iA Content-First    | rejected  |
| 14 | Takram, Fabricated City               | School 3, Speculative         | rejected  |
| 15 | MUJI, Atsumi Tea spread (art-direction by Hara) | School 3, Hara-Whitespace | kept |

The MUJI Atsumi Tea spread is the source-of-truth image for the chosen
palette (extracted via chroma.js k-means k=5).

## What this lane breakdown showed

- One direct kept (Matter), three direct rejected → the category default is
  not the brand's reference point. Vellum is competing against the category,
  not aiming to fit it.
- Two aspirational kept (Readwise Reader, iA Writer) → both are quiet,
  type-driven, no-streaks. The brand wants to be in their shelf.
- Two philosophy kept (Hara book spread, MUJI Atsumi Tea) → both School 3.
  Eastern Minimalism is the row that resonates. Confirmed in Phase 3.

## Source citations (would-be `*-source.json` companions)

In a real run, every kept and rejected image would carry a sibling JSON file
with `{ url, license, captured_at, captured_by, attribution }`. Skipped here
because no real fetches happened. See `sources.json` in this folder for the
URL list that would have been logged.

## Why nothing was generated

Phase 2 is taste capture, not asset generation. Discovery's anti-pattern rule
(`asset-pathways.md`) requires at least one asset to anchor on moodboard or
philosophy DNA, not pure tool output. The MUJI Atsumi Tea image carried the
palette downstream. That anchor protected the brand from generic-AI-startup
fingerprint at Phase 4.
