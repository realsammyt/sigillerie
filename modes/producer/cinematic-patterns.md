---
name: cinematic-patterns
description: Cinematic motion patterns adapted for HTML deliverables. Camera moves, parallax, depth-of-field via blur, anchor moments, restraint rules.
---

# Cinematic Patterns

Motion language for HTML deliverables. Reach for these when a moment needs weight. Skip them when content carries itself.

Cross-refs:
- `modes/three3d/recipes.md` for real depth (true 3D camera in WebGL).
- `modes/producer/animation-best-practices.md` for the 5-stage arc these patterns plug into.

---

## 0 · Why Cinematic, Not PPT

Two ways to demo a workflow:

| Mode | Shape | Result |
|---|---|---|
| PPT | Step 1 fades, step 2 fades, four boxes onscreen | Reads as slide deck with transitions. No wow. |
| Cinematic | Scene-based, one focus at a time, dissolves and focus pulls between | Reads as keynote cut. Viewer wants to share. |

Difference is narrative shape, not animation tech. Same CSS, different intent.

---

## 1 · The Patterns

### A · Dolly-In Reveal

Camera pushes toward subject. Use for the anchor moment of a scene: the number that matters, the artifact being unveiled, the result.

Implementation: `transform: scale(1) translateZ(0)` to `scale(1.15) translateZ(0)` over 1.2s with `cubic-bezier(.16,1,.3,1)`. Pair with subtle vignette darkening at edges.

When: once per deliverable, max twice. Dolly-in everywhere flattens to noise.

### B · Rack-Focus Blur Swap

Two layers, one sharp, one blurred. Swap which is which to redirect attention.

```
Layer A: filter: blur(0px); opacity: 1;
Layer B: filter: blur(12px); opacity: 0.4;
→ rack:
Layer A: filter: blur(12px); opacity: 0.4;
Layer B: filter: blur(0px); opacity: 1;
```

800ms ease-out. Cheap stand-in for depth-of-field without WebGL.

When the deliverable can afford real depth, see `modes/three3d/recipes.md` for true camera DOF. Blur swap is the 2D shorthand.

### C · Parallax Depth (Faux 3D)

Three planes moving at different rates as the viewport shifts or scene plays:

- Background: 0.3x movement, blurred 4px
- Midground: 0.7x, slight blur
- Foreground: 1.0x, sharp

Sells depth without shader cost. Stripe's annual letter uses this for hero panels. Apple keynote slides use it under product shots.

For actual 3D parallax with parallax-aware lighting, swap to `modes/three3d/recipes.md`.

### D · Anchor-Moment Punctuation

One scene per deliverable gets a hard stop. Big serif type, held for a beat, no motion. The viewer's eye lands.

```
duration: 1.4s hold
type: serif italic, 96px+
motion: none (or 1px settle)
audio: single sting at entry
```

Apple keynotes do this with the product name reveal. Stripe does it with the year-end metric. The trick is restraint: anchor moments only land if the rest of the piece moves.

### E · Slow-Burn Linger

After a reveal, hold. Resist the next cut for 600-900ms longer than feels right.

The instinct is to keep moving. Wrong. The viewer needs time for the moment to register. Cuts too early read as nervous.

Test: when the cut feels late, it's correct. When it feels on time, you're early.

### F · Match-Cut Morph

Element A in scene 1 morphs into element B in scene 2, sharing position or shape. Forces narrative continuity across scene boundaries.

Implementation: SVG path interpolation, or CSS clip-path morph, or simply a shared anchor element that persists through the transition while siblings fade.

Hard to author, high payoff. Use once per deliverable.

---

## 2 · Restraint Rules

Cinematic tools earn their place. Over-cinematizing is the anti-pattern.

| Rule | Why |
|---|---|
| Max one dolly-in per scene, two per deliverable | Loses weight if everywhere |
| One anchor moment per deliverable | The whole piece exists to set this up |
| Rack-focus only when redirecting attention, never as decoration | Blur is a verb, not an adjective |
| Parallax planes max 3, always with intent | More planes = visual noise, not depth |
| Slow-burn lingers come in pairs at most | Otherwise pace dies |
| Match-cut morphs once per piece | The trick is the rarity |

If the content sells itself (a clear chart, a clean diagram, a strong sentence), skip cinematic entirely. PPT-fade is fine when the work is the point. Cinematic is for moments that need weight the content alone can't carry.

---

## 3 · Western Reference Points

| Source | What to study |
|---|---|
| Apple keynote (any post-2018) | Anchor-moment timing, dolly restraint, audio sting density |
| Stripe annual letter (web) | Parallax planes, scroll-driven pacing, type-as-hero |
| Linear changelog animations | Scene-based structure with no cinematic excess |
| Pitch.com hero loops | Match-cut morphs done well |

Watch with sound off first. If the motion alone tells the story, the cinematic language is working.

---

## 4 · Plug-In Points

The 5-stage arc lives in `modes/producer/animation-best-practices.md`. Cinematic patterns map to stages:

- S1 Setup: no cinematic, keep mechanical
- S2 Complication / S3 Escalation: parallax depth, rack-focus to guide attention
- S3 → S4 seam: match-cut morph from process to product
- S4 Climax: dolly-in on the key artifact
- S5 Resolution: anchor moment + slow-burn linger

Don't apply all six patterns in one piece. Pick two, maybe three. The rest stay in the toolbox.

---

## 5 · Anti-Pattern Quick Check

| Symptom | Fix |
|---|---|
| Every scene has a dolly-in | Cut all but the strongest one |
| Parallax on every panel | Reserve for hero scenes |
| Blur as ambient texture, not focus tool | Remove or replace with opacity |
| Anchor moments stacked back-to-back | Keep one, downgrade the others |
| Match-cut morphs as transitions throughout | Pick the single best, fade the rest |
| Cinematic applied to a reference table | Tables don't want cinema. Ship plain. |

---

## 6 · When To Skip This Doc

If the deliverable is a static infographic, a knowledge graph, a data dashboard with live filters, a slide deck of read-aloud content, or anything where motion would compete with comprehension: skip cinematic patterns entirely.

Cinematic is for hero moments. Most surfaces aren't hero moments.
