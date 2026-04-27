---
name: design-context
description: Brand-zero fallback patterns. When user has no brand, no references, no taste anchors, what producer mode does instead of guessing.
---

# design-context

Brand-zero fallback for producer mode. When the user shows up with no brand, no codebase, no references, and no taste anchors, this file is the path. It is not the preferred path.

## Cross-references first

- `modes/discovery/pipeline.md` is the canonical brand-from-zero path. Six phases, real moodboard, real picks, populated `brand-spec.md`. Producer reads its output. If the user has time for Discovery, they should run Discovery.
- `modes/discovery/direction-library.md` is the structured alternative. 5 schools × 20 philosophies. Pick a row and a column, get a real lineage instead of a guess.

This doc is for when both are explicitly skipped. Maybe the user wants a one-shot prototype in 20 minutes. Maybe they are testing producer mode itself. Maybe Discovery already ran and came back thin. Whatever the reason: the work has a ceiling. State it up front.

**Hard cap**: brand-zero output tops out around 65 / 100 on the 5-axis critique. Without real assets or Discovery context, originality and craft both stall. Tell the user this before starting.

## What design context actually is

Ranked by quality, highest first:

1. **A real design system or UI kit.** Tokens, components, type scale. The dream case.
2. **A codebase.** Live components beat any spec. Read `theme.ts`, `tokens.css`, `_variables.scss`, then 2-3 actual components.
3. **A shipped product.** No code? Take screenshots with Playwright, or ask the user for them.
4. **Brand guidelines, logos, marketing assets.** Anything physical the brand has touched.
5. **Competitor references with URLs.** Not "make it like Stripe" from memory. Actual URLs or actual screenshots.
6. **A known design system as scaffold.** Apple HIG, Material 3, Radix Colors, shadcn/ui, Tailwind defaults. State which one you picked.

This file covers tier 6 and the void below it.

## Step zero: ask before assuming

Before any fallback, run the intake checklist:

```
1. Do you have a design system, UI kit, or component library? Path?
2. Brand guide, color rules, type stack?
3. Screenshots or URL of any shipped product?
4. Codebase I can read?
```

If "no" across the board, push once:

```
Let me try one more pass:
- Older project with related design?
- Marketing site, what colors and type does it use?
- Logo file, even a draft?
- A product you admire as a north star?
```

Most users have *something*. The first "no" is often a misread. Push once, accept the second.

## When the answer is genuinely zero

Tell the user the ceiling. Then pick on their behalf, with stated reasoning. Never produce generic. Generic is the failure mode.

### 1. Pick one aesthetic direction

Commit. The choices live in `direction-library.md` if you want a real lineage. Quick fallback shortlist:

- editorial (School 5)
- brutally minimal (School 1 or 3)
- organic, restrained warmth (School 3 lite)
- raw, hand-set (School 4 lite)
- luxury refined (School 5 high-end)
- playful with discipline (School 4 controlled)

Pick one. Say which. Show the user.

### 2. Safe-default palette logic

Warm-but-restrained beats cold-and-clean for brand-zero. Cold-and-clean reads as Inter-and-Stripe knockoff inside ten seconds.

Rules:

- **Two accent colors max.** One primary, one secondary. Anything more reads as confused.
- **One warm anchor.** Terracotta, ochre, oxblood, dusty rose, faded sienna. Pick one. Use OKLCH for the spec value so saturation stays controlled across hue shifts.
- **Background off-white, never pure white.** `#FDF9F0`, `#F8F5EE`, `#FAF7F2`. Pure white is a tell.
- **Text near-black, never pure black.** `#1A1A1A` or `#0F1115`. Pure `#000` reads as default-CSS.
- **One muted gray for secondary text.** `#6B6B6B` is a workable starting point.
- **No gradients in v1.** Gradients without brand reasoning are anti-pattern. Add later if the design language earns them.

Spec example:

```
Primary:    oklch(0.65 0.14 35)   # warm terracotta
Secondary:  oklch(0.55 0.10 200)  # muted teal, optional
Background: #FDF9F0
Text:       #1A1A1A
Muted:      #6B6B6B
```

### 3. Safe-default type stack

**Never use Inter as display.** Inter as body is fine. Inter as display is the AI-tell of 2024-2026.

Pairings that hold up (all free on Google Fonts unless noted):

- Instrument Serif display + Geist Sans body. Editorial, humanist, low cost.
- Cormorant Garamond display + Inter Tight body. Literary, high contrast.
- Bricolage Grotesque display + Söhne body (Söhne is paid). Confident, contemporary.
- Fraunces display + Work Sans body. Warning: Fraunces is now overused by AI tools, downgrade if the user might recognize.
- JetBrains Mono display + Geist Sans body. Technical, builder-energy.

Rule: serif display plus sans body, or grotesque display plus sans body. Never two sans-serifs at the same weight class. Never Inter on Inter.

### 4. Spacing and radius

Tailwind scale works as scaffold: 4, 8, 12, 16, 24, 32, 48, 64. Stick to it. Mixing scales is the visible mark of design-by-vibe.

Radius: 4px on small controls, 8px on buttons, 12px on cards. Anything larger needs brand reason. Pure squares (0px) read as brutalist commitment, valid if the direction supports it.

### 5. Document every pick inline

Every decision gets a comment in the HTML head. Future you, or the next translator, reads this and knows what was reasoning vs. what was guessing.

```html
<!--
Brand-zero design decisions:
- Direction: editorial (no brand context, picked for warmth)
- Primary: oklch(0.65 0.14 35), warm terracotta, fits direction
- Display: Instrument Serif, humanist literary
- Body: Geist Sans, clean contrast
- No gradients, no glow effects, no AI-slop signals
- Spacing: Tailwind 4-base scale
- Ceiling: ~65/100, capped without Discovery or real assets
-->
```

## Case study: brand-zero done right

User: "Build me a landing page for a meditation app. No brand, no time."

Wrong move: pick blue, use Inter, ship Stripe-knockoff #4,729.

Right move:
1. State the ceiling. "No Discovery, capped around 65."
2. Pick School 3 (Eastern Minimalism), philosophy: Hara-lite. State it.
3. Palette: off-white `#FAF7F2` background, near-black text, single warm accent `oklch(0.55 0.08 50)` (muted ochre). One color. No secondary.
4. Type: Cormorant Garamond display, Inter Tight body. Serif anchors the calm.
5. Spacing: generous, double the Tailwind defaults at section breaks (96px, 128px). Whitespace carries the philosophy.
6. Document picks in head comment. Hand to user. Note the ceiling again in delivery.

Result: not a great brand. A *coherent* one. The 65 ceiling holds.

## Case study: brand-zero gone wrong

User: "Make it look professional."

Wrong move: take "professional" as a brief.

Right move: refuse the brief. "Professional" is not direction. Push the user to `direction-library.md` or run a 5-minute Discovery intake. If they still refuse, pick School 1 (Information Architecture, Vignelli-lite), state it, and proceed under cap.

## When a codebase shows up mid-task

If the user produces a codebase after you started brand-zero, stop. Read the codebase. The 65 cap lifts. Your earlier picks become the placeholder. Honest placeholder rules apply: gray block plus label, swap to real values when you have them.

## The ceiling, restated

Brand-zero is fallback. Fallback has a ceiling. The ceiling is real and the user should know.

- With Discovery: target 80+
- With real assets but no Discovery: target 70-75
- With known design system as scaffold: target 65
- With nothing and pure picks: 55-65, originality stalls

Tell the user. Ship with the cap stated. Offer Discovery as the next step.
