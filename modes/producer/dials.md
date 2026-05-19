---
name: dials
description: Three parametric dials (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY) that drive conditional rule activation across Producer output. Decoupled from the tweaks-system UI: dials are the conceptual layer, leva is the panel that exposes them at runtime.
---

# Producer Dials

A dial is a numeric knob, 1 to 10, that conditionally activates downstream rules. Producer reads three dials before authoring. The dials decide which rules from `content-guidelines.md`, `animations.md`, and capability catalogs are in force for this deliverable.

This document defines the dials, the default presets per deliverable type, and the conditional rule table. The runtime UI that exposes the dials to a viewer is `tweaks-system.md`. The conceptual contract lives here.

Borrowed in shape from `taste-skill` (DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY), re-grounded in sigillerie's HTML-first, single-file stack.

## The three dials

| Dial | Range | What it controls |
|---|---|---|
| `DESIGN_VARIANCE` | 1-10 | How far from safe template defaults the design departs. Low = familiar conventions (Bootstrap baseline, centered hero, three-column features). High = asymmetric grids, weird crops, full-bleed type, broken column rhythm. |
| `MOTION_INTENSITY` | 1-10 | How much animation runs by default. Low = entry transitions only, no perpetual motion. High = parallax, magnetic hover, idle loops, scroll-driven scene changes, ambient ticker, micro-interactions on every focusable element. |
| `VISUAL_DENSITY` | 1-10 | How much information per square inch. Low = generous whitespace, one focal element per fold, large type. High = packed grids, sidebar telemetry, micro-charts in margins, multiple parallel reads. |

The dials are orthogonal. A brutalist editorial layout is high VARIANCE + low MOTION + medium DENSITY. A Linear-style dashboard is low VARIANCE + medium MOTION + high DENSITY. A Vision Pro spatial hero is medium VARIANCE + high MOTION + low DENSITY.

## Default presets per deliverable type

Producer picks a preset based on the brief's deliverable type, then applies user override before authoring.

| Deliverable | VARIANCE | MOTION | DENSITY | Why |
|---|---|---|---|---|
| Hero animation | 6 | 8 | 3 | Motion is the point. Density would compete with the hero focal. |
| iOS prototype | 4 | 6 | 5 | Platform conventions floor variance. Motion sells the prototype. Density follows iOS HIG. |
| Landing page | 6 | 4 | 4 | Variance avoids template tells. Motion stays restrained so copy reads. |
| Slide deck | 5 | 3 | 4 | Slides need to be readable from the back of a room. Motion only at scene transitions. |
| Infographic (static) | 7 | 1 | 7 | Single artifact, no motion budget, packed with information by design. |
| Dashboard | 3 | 4 | 8 | Low variance protects scanability. Motion only on state changes. Density is the format. |
| Data viz scrollytelling | 5 | 6 | 5 | Mid on every axis. Scroll drives motion budget. Each scene resets density. |
| Knowledge graph (2D) | 5 | 5 | 6 | Layout algorithm sets variance floor. Density rises with node count. |
| Knowledge graph (3D / WebXR) | 6 | 7 | 4 | Spatial format wants motion. Density drops because depth is the third axis. |
| Spatial / Vision Pro UI | 6 | 7 | 3 | See `modes/three3d/spatial-ui.md` §10. Hero+overlay needs breathing room. |

Override flow: user can pass `dials: { variance: 8, motion: 2 }` in the brief; missing dials fall through to the preset above.

## Conditional rule table

The dials gate specific rules in other docs. When a rule's condition fires, the rule is in force for this deliverable. When the condition doesn't fire, the rule is suspended.

| Condition | Rule activated | Source |
|---|---|---|
| `VARIANCE < 4` | Ship the safe template. Hero + 3-col features + CTA is allowed, even though `content-guidelines.md` flags it. | `content-guidelines.md` Layout Slop |
| `VARIANCE > 7` | Asymmetric grid required. Centered max-width 1200px is banned. Full-bleed or edge-aligned. | `content-guidelines.md` Layout Slop |
| `VARIANCE > 7` | At least one section breaks the page's primary grid. | new rule |
| `MOTION < 3` | No perpetual animation. Entry transitions only. No idle loops, no parallax, no auto-playing video backgrounds. | `animation-best-practices.md` |
| `MOTION > 6` | Every focusable element gets a hover/focus micro-interaction. Scroll-driven scene change at least once. | `animations.md` |
| `MOTION > 8` | Magnetic cursor pull on primary CTAs. Ambient idle on hero geometry. Audio cues if `__audioRuntime` present. | new rule |
| `DENSITY < 4` | Maximum one focal element per fold. Body type baseline 18px web, 32px slide. | `content-guidelines.md` Scale Rules |
| `DENSITY < 4` | Cards banned. Use spacing and type contrast instead. Echoes `taste-skill` Section 4. | `content-guidelines.md` Cards and Containers |
| `DENSITY > 7` | Sidebar or rail allowed. Micro-charts in margins allowed. Body type may drop to 14px. | new rule |
| `DENSITY > 7` | Cards return as legitimate containment (the dashboard case). Three-column card row remains banned. | `content-guidelines.md` |
| any two dials at extremes | The third dial defaults to mid (5) unless explicitly set. Three-extreme combinations almost always fail the critic. | governance rule |

## How Producer reads the dials

In the Junior Pass:

1. Read the brief. Pick the deliverable type. Look up the preset.
2. State the dials out loud in the assumptions block, with the conditional rules they activate or suspend. Example:
   > "Working at VARIANCE 6 / MOTION 8 / DENSITY 3 for a hero animation. This activates: asymmetric grid optional (variance under 7), every CTA gets hover micro-interaction (motion 8), max one focal per fold (density 3). Cards are banned. Centered 1200px allowed."
3. Wait for user override before proceeding to Full Pass.

In the Full Pass:

1. The conditional rule table is the spec. Build to it.
2. If a rule from another doc is suspended by current dials, note it in a code comment so a reviewer knows it was a dial decision, not an oversight.

In the Validation Pass:

1. Re-check the deliverable against the active rule set, not the global rule set. The critic's G4 gate honors the dial state.

## Exposing dials at runtime

If the deliverable should let the viewer adjust the dials live, expose them through leva via `tweaks-system.md`. Each dial becomes one slider in a folder named `dials`:

```jsx
const { variance, motion, density } = useControls('dials', {
  variance: { value: 6, min: 1, max: 10, step: 1 },
  motion:   { value: 8, min: 1, max: 10, step: 1 },
  density:  { value: 3, min: 1, max: 10, step: 1 },
});
```

The rule activations then read from these values in the same component tree. The viewer slides DENSITY from 3 to 8 and the layout shifts from one-focal-per-fold to packed-with-rail. This is the parametric design exploration loop made interactive.

Not every deliverable should expose dials live. The rule of thumb: expose dials when the design space genuinely benefits from real-time comparison (hero animation, dashboard density, slide-deck variant). Hide them for static infographics or recorded MP4 export.

## Cross-references

- `tweaks-system.md`: the UI primitive (leva or vanilla fallback) that exposes dials at runtime.
- `content-guidelines.md`: the master slop catalog. Many of its rules are dial-gated per the table above.
- `animations.md`, `animation-best-practices.md`, `animation-pitfalls.md`: motion rules, gated by `MOTION_INTENSITY`.
- `capabilities/_shared/verifier-rules.md`: the critic's G4 gate consults the active dial state, not just the master catalog.

## Failure modes

Three dials at extremes (10/10/10 or 1/1/1) produce illegible output. The governance rule forces the third dial to 5 unless explicitly justified.

The user gives a brief without picking a deliverable type. Producer falls back to landing page preset (6/4/4) and flags the assumption in the Junior Pass.

A dial gets exposed at runtime but the deliverable doesn't actually re-render on dial change. This is a wiring bug, not a dial bug. Every dial-gated style must be derived in the React render path, not baked into CSS at mount.

The critic flags a pattern that the dials specifically allowed (e.g., cards at DENSITY 8). The critic agent must read the active dial state and skip the rule. If the critic isn't dial-aware, the agent prompt needs updating.
