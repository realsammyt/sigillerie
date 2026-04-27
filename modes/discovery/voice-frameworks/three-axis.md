---
name: three-axis
description: Voice framework, three axes (formality, seriousness, warmth) each scored -2 to +2. Locks the brand to one fixed point in 3D voice-space.
---

# Three-axis voice spec

Sigillerie's own framework. For brands where Mailchimp is too friendly-mainstream and Atlassian is too B2B-credibility. Indie, design-first, small.

## Orientation

Three independent axes. Each scored -2 to +2 on a five-point scale. The brand voice locks to one fixed point in 3D voice-space. Five points per axis means 125 possible voices. Most brands cluster in a much smaller region, but the precision is the point. You can say "we are formality 0, seriousness -1, warmth +1" and rebuild the voice from that triple alone.

## The three axes

### Formality (-2 to +2)

How close to street talk vs how close to a press release.

| Score | Sound |
|---|---|
| -2 | "hey, here's the thing" |
| -1 | "ok so the trick is" |
| 0 | "the trick is to start small" |
| +1 | "we recommend starting with a single screen" |
| +2 | "Sigillerie is pleased to inform you that initial scope should be limited to one screen" |

### Seriousness (-2 to +2)

How much room for humor.

| Score | Sound |
|---|---|
| -2 | puns, winks, wordplay, named jokes |
| -1 | dry humor, light irony, the occasional turn of phrase |
| 0 | neutral, no jokes but no weight either |
| +1 | weighted, every sentence pulls toward consequence |
| +2 | grave, no humor, the stakes are named on every page |

### Warmth (-2 to +2)

How much rapport.

| Score | Sound |
|---|---|
| -2 | dry, information-only, no rapport |
| -1 | crisp, polite, no small talk |
| 0 | neutral, sometimes warm, sometimes not |
| +1 | warm, "we're glad you're here" without pushing |
| +2 | hot, openly affectionate, hugs in the copy |

## How to fill from intake

Vibe-words map to axis scores. Examples:

| Vibe-words | Formality | Seriousness | Warmth |
|---|---|---|---|
| calm, technical, irreverent | 0 | -1 | -1 |
| trustworthy, professional, kind | +1 | +1 | +1 |
| weird, playful, indie | -1 | -2 | 0 |
| fierce, minimal, cold | +1 | +1 | -2 |
| warm, accessible, simple | -1 | 0 | +2 |

The agent shows the inferred triple back to the user before generating. User can nudge any axis up or down one notch.

## Voice card output template

```
# Voice card · {brand}

Axis scores
  formality   -2 -1 [0] +1 +2
  seriousness -2 [-1] 0 +1 +2
  warmth      -2 [-1] 0 +1 +2

Six example sentences

Greeting     "you made it. let's go."
Success      "saved. it's live."
Error        "that didn't save. check the title and retry."
Onboarding   "pick a template. we fill in the rest."
Marketing    "ship a landing page in an afternoon. yes really."
Help         "to export: file, then export. pick html or pdf."
```

The plotted axis scores are the spec. The six sentences are the proof the spec was applied.

## When this fits

- Small brands with one or two people writing all the copy
- Indie products where the voice is a personal taste, not a committee output
- Design-first projects where the founder wants to control voice precisely
- Brands that reject "friendly SaaS" or "credible enterprise" as defaults
- Cases where the user wants a portable spec, not a borrowed identity

## Anti-pattern

Scoring all three axes at 0. That's "neutral." It is the safest place. It is also the least distinctive place. A brand at (0, 0, 0) sounds like every other brand at (0, 0, 0). Force at least one axis off-center. Better: force two. The spec earns its keep when it commits.

If the user lands on (0, 0, 0), the agent pushes back once. "Pick the axis you care about most. Move it one notch."
