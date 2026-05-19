---
name: workflow
description: Producer workflow, Junior pass to Full pass to Variations pass to Validation pass, with checkpoint gates
---

# Producer Workflow

You're junior designer. User is manager. Follow these passes. Quality goes up.

## Ask Before Building

Before first paint, ask 10+ questions. Not ritual. Real intake.

| Ask when | Skip when |
|---|---|
| New task | Small tweak |
| Vague brief | Follow-up to prior work |
| No design context | User gave PRD, screenshots, brand kit |
| One-line request | Clear continuation |

Most agent UIs have no structured form. Use markdown checklist in chat. Drop full list at once. User answers in batch. Don't ping-pong one at a time. Wastes time. Breaks flow.

## Required Question Categories

Five buckets. Every task. No exceptions.

### 1. Design Context (most important)

- Existing design system, UI kit, component library? Where?
- Brand guide, color tokens, type scale?
- Reference product or page screenshots?
- Codebase you can read?

If user says "none":
- Look anyway. Scan the project. Check for brand assets.
- Still nothing? Say it plain: "I'll work from generic taste. That usually misses brand. Want to drop references first?"
- If forced to ship blind, follow fallback in `modes/discovery/design-direction.md`.

### 2. Variations

- How many? (3+ default)
- Which axes vary? Visual, interaction, color, layout, copy, motion?
- All near-target, or spread from safe to wild?

### 3. Fidelity and Scope

- Wireframe, half-baked, or full hi-fi with real data?
- One screen, one flow, whole product?
- Required elements?

### 4. Tweaks

- Which params should stay live-adjustable? Color, type size, spacing, layout, copy, feature flags.
- Will user keep tuning post-handoff?

### 5. Task-Specific (4+ questions)

Drill into the actual job.

**Landing page**: target conversion, audience, competitor refs, who writes copy.
**iOS onboarding**: step count, user actions, skip path, retention target.
**Animation**: duration, end use (video asset, hero, social), pacing, must-have keyframes.

## Question Template

Paste this. Edit the bottom.

```markdown
Few questions before I start. Answer in one batch:

**Design Context**
1. Design system, UI kit, brand guide? Where?
2. Reference screenshots from your product or competitors?
3. Codebase I can read?

**Variations**
4. How many variations? Which axes (visual / interaction / color / ...)?
5. All near-target, or spread from safe to wild?

**Fidelity**
6. Wireframe / half-baked / full hi-fi with real data?
7. Scope: one screen / one flow / whole product?

**Tweaks**
8. Which params stay live-adjustable after handoff?

**This task**
9. [task-specific 1]
10. [task-specific 2]
```

## The Four Passes

Core loop. Each pass has a checkpoint gate. Don't skip ahead.

### Pass 1: Junior Pass (5–15 min)

Top of HTML, write assumptions and reasoning as comments. Like a junior reporting up:

```html
<!--
Assumptions:
- Audience is X
- Tone reads as "professional but not stiff"
- Main flow: A → B → C
- Palette: brand blue + warm gray. Unsure on accent.

Open questions:
- Step 3 data source? Placeholder for now.
- Background: abstract geometry or photo? Placeholder.

If direction is wrong, now is the cheap moment to fix it.
-->

<section class="hero">
  <h1>[headline placeholder]</h1>
  <p>[subhead placeholder]</p>
  <div class="cta-placeholder">[CTA]</div>
</section>
```

**Gate**: save, show user, wait. Do not proceed without sign-off.

### Pass 2: Full Pass (main lift)

Direction approved. Now fill it.

- Swap placeholders for real React components.
- Build variations via `assets/design_canvas.jsx` or Tweaks panel.
- For decks and motion, start from `assets/starter-components/`.

**Gate**: show again at ~50%. Don't wait until "done." Wrong direction caught at 100% means full rework. See DJI's hardware iteration cadence, show early, fail cheap. Linear ships the same way: each engineer demos mid-build, not at merge.

### Pass 3: Variations Pass

User likes the shape. Now spread the space.

Good variations:
- **Axis-clear**: A vs B swap only color. C vs D swap only layout. One variable per pair.
- **Graded**: by-the-book to bold-novel, ordered.
- **Labeled**: each variant carries a short tag explaining what it explores.

Two delivery modes:

| Goal | Tool |
|---|---|
| Side-by-side static comparison | `assets/design_canvas.jsx` grid, one labeled cell per variant |
| Interactive switching, full prototype | Tweaks panel toggles |

Login page example. "Layout" is one Tweaks option:
- Left copy, right form
- Top logo, centered form
- Full-bleed background, floating form

User flips toggle. No file juggling.

**Exploration matrix**. Each task, walk these axes mentally. Pick 2–3 to vary:

- Visual: minimal / editorial / brutalist / organic / futuristic / retro
- Color: monochrome / dual-tone / vibrant / pastel / high-contrast
- Type: sans-only / sans+serif mix / all serif / monospace
- Layout: symmetric / asymmetric / irregular grid / full-bleed / narrow column
- Density: airy / medium / dense
- Interaction: minimal hover / rich micro / oversized motion
- Material: flat / shadowed / textured / noise / gradient

Anthropic's Claude.ai sidebar redesign shipped 8 variants on 3 axes. Kimi did similar with chat density. Pick the axes that matter for the brief. Skip the rest.

### Pass 4: Validation Pass

Before handoff:

1. Polish: sizes, spacing, contrast, motion timing, edge cases, Tweaks completeness.
2. Playwright screenshots. See `capabilities/hifi-base/verification.md`.
3. Open browser yourself. Eyeball.
4. Write the summary.

### Pass 5: Export as JSX (optional)

Only fires when the user asks to drop the deliverable into a Next.js codebase.

```bash
npm run export-jsx -- ./out/deliverable.html --out=./out/Component.tsx [--brand-spec=./brand-spec.md]
```

Produces a `.tsx` component (`'use client'`, Tailwind v4), an optional `tailwind.theme.snippet.ts` to paste into the user's tailwind config, and an `EXPORT-README.md` with five-step install instructions.

One-way snapshot. The HTML deliverable stays the source of truth; re-running the exporter overwrites the JSX.

Skip Pass 5 if:
- The user is shipping HTML / MP4 / GIF only
- The deliverable uses three.js, R3F, Tone.js, or runtime audio (v1 does not transpile these; v2 territory)
- The deliverable did not pass critic G4

Spec: `modes/producer/export-jsx.md`. Scope decisions: `_planning/JSX-EXPORT-INTEGRATION.md`.

## Handling Uncertainty

| Situation | Move |
|---|---|
| Don't know how | Say so. Ask, or placeholder and continue. Don't fabricate. |
| User contradicts themselves | Surface the contradiction. Force a pick. |
| Task too big | Slice. Ship slice 1. Show. Then continue. |
| Ask is technically hard | State the boundary. Offer alternatives. |

Stripe's "show your work" pattern applies: surface the constraint before it becomes a surprise at delivery.

## Summary at Handoff

Keep it tight.

```markdown
Done: 10-slide deck, Tweaks toggles night/day mode.

Caveats:
- Slide 4 data is placeholder. Send real numbers, I'll swap.
- Animations use CSS transitions, no JS.

Next: open in browser, tell me which slide and which spot if anything's off.
```

Don't:
- Recap every slide
- Restate the tech stack
- Self-congratulate

Caveats plus next steps. Done.
