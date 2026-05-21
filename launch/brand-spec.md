---
brand: Sigillerie
locale: en
discovery_run: 2026-05-21
status: provisional-self-brand
direction: Hara minimalism with Sagmeister-grade typography moments
schema_version: 1.0
---

# Sigillerie · self brand-spec (for launch campaign)

> Inferred from `demos/d1-hero-animation`, `README.md`, `SKILL.md`, the Vellum
> demo, and the studio's "real-studio design out" stance. Provisional. Built
> in 15 minutes specifically to give launch posts a coherent identity.

A Claude Code skill that ships single-file HTML design deliverables. The
audience is design-curious developers and AI-curious designers reading the
GitHub repo or scrolling X / LinkedIn / Bluesky. The problem it kills is
generic AI design slop and "AI-generated" tells.

## Vibe keywords

studio · disciplined · quietly precise

## What this is not

- AI-generated gradient mesh hero pages
- corporate SaaS launch screens (rounded everything, soft pastel grids)
- "we built this with Cursor" Twitter aesthetic
- maximalist generative-art splash screens

## Palette

| Token              | Hex      | Role                                             |
|--------------------|----------|--------------------------------------------------|
| `--stage`          | #0A0A0A  | dark stage background, the dominant surface      |
| `--paper`          | #FAF7F0  | warm paper, type and primary card surfaces       |
| `--ink`            | #1B1614  | true type color when on paper                    |
| `--quiet`          | #6E6862  | secondary type, hairlines, metadata              |
| `--accent`         | #9A4B3D  | rust orange, one element max per composition     |
| `--surface`        | #EFE9DD  | secondary paper surface                          |

Hard rule: one accent per composition. The rust signals where the eye lands.

## Type stack

| Slot     | Family                                  | Role                                  |
|----------|-----------------------------------------|---------------------------------------|
| Display  | Source Serif Pro (or fraunces fallback) | wordmark "Sigillerie", big moments    |
| Body     | Inter                                   | UI copy, captions                     |
| Eyebrow  | Inter, all caps, 0.3-0.4em tracking     | section labels, "MODE", "SHOWCASE"    |
| Mono     | JetBrains Mono                          | version numbers, code, signature      |

Wordmark size: 180px on 1080p hero, 240px on 1920p, 96px on 1080×1920 stories.
Wordmark weight: 400. Letter-spacing -0.02em.

## Tagline lockup

Primary tagline: **One sentence in. Real-studio design out.**

Secondary lines (use one, not all):
- Three modes, four capabilities, one tool.
- Flat or spatial. AR or page. Animated or scored.
- Now public. github.com/realsammyt/sigillerie

## Signature details

- Stage-on-paper or paper-on-stage. Both work; pick one per post.
- Hairline rules at 0.5-1px in `--quiet` at 30-40% opacity.
- 60%+ negative space on every composition. The page must not yell.
- One rust accent per composition. Highlight the lead claim with it.
- Wordmark always in Source Serif Pro (or fraunces variant); never in Inter.
- Cards/panels: 6-8px border-radius max. No big rounded chiclets.
- No drop shadows on paper surface; soft 24-48px shadows allowed on cards floating on stage.
- Eyebrow caps with wide tracking before the lead.
- Signature mono row at bottom-right: `SIGILLERIE · v0.9 · LAUNCH 2026`

## Anti-patterns (do not ship if you see these)

- gradient mesh background, especially purple-to-pink
- glowing emoji as visual focal point
- "Made with AI" badge
- generic dotted grid background
- four-or-more focal points on one frame
- center-stack of three identical chiclet cards (the obvious AI default)
- pastel
- corporate stock photography of laptops

## Motion language (for video posts)

- expoOut and cubicOut easings only. No bounce. No spring overshoot.
- Cascade reveals: 60-120ms stagger between siblings.
- Total duration 6-10s for feed posts, 4-6s for stories.
- Hold the final composition for 1.5-2s before loop / end.
- Background grain or noise allowed at <3% opacity; no other texture.
- Hairline rules draw across like a pen-stroke (0 to width over 700-1000ms).

## Page contract reminder

Every recorded HTML must set:
- `window.__ready = true` after first paint
- `window.__duration = <seconds>` for the recorder
- Respect `window.__recording` (disable loops when true)

For 3D pages, also `window.__sceneReady` and `window.__renderFrame(t_ms)`.

## Dials (active for this campaign)

- DESIGN_VARIANCE = 4 (low — disciplined, brand-coherent across the slate)
- MOTION_INTENSITY = 5 (medium — subtle reveals, no kineticism for its own sake)
- VISUAL_DENSITY = 3 (low — whitespace anchors, one claim per frame)

## Voice (for any in-frame copy)

Formality 0, seriousness -1 (dry-witty allowed), warmth +1.

- "Now public" beats "We're thrilled to announce"
- "Three modes" beats "A comprehensive suite"
- Numbers over adjectives. "60-second animation" beats "stunning animation"
- No em-dashes. Use commas, periods, parens.
- Banned: delve, leverage, robust, comprehensive, seamless, ensure, navigate (as verb), foster, utilize.

## Repository URL

`github.com/realsammyt/sigillerie`

(Use this exact string when including the URL in a frame.)
