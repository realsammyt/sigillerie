---
name: critique-guide
description: 5-dimension critique rubric (philosophical coherence, hierarchy, execution, function, innovation), scored 0-10, with extension to 7-dim including spatial coherence (3D) and data truth (viz)
---

# critique-guide

Rate the work, not the maker. Critique is structural feedback on a deliverable, scored against fixed dimensions. The author is invisible at scoring time. Comments belong to artifacts.

This rubric runs at G4 (the demo gate) before any phase merge. A demo with any dimension under 7 fails the gate and routes back to producer mode for fixes. The critic-agent invokes this guide; humans can run it manually with `/review`.

## The Five Dimensions

Each scored 0-10. Total is the floor of the five (worst dimension wins), not an average. A masterpiece with one broken leg still wobbles.

### 1. Philosophical Coherence

Does the work hold to one design philosophy, or does it leak into another?

| Score | What it looks like |
|-------|--------------------|
| 10 | Every choice (color, type, rhythm, motion) traces back to a single philosophy. Nothing contradicts. |
| 7-8 | Direction is clear, one or two details drift. |
| 5 | Intent is visible but execution mixes vocabularies (e.g. Hara typography over a Sagmeister palette). |
| 3 | Surface mimicry. The look is borrowed, the logic isn't. |
| 0-2 | No discernible philosophy. Decisions look random. |

**Audit prompts**:
- Name the philosophy in one sentence. If you can't, score drops below 5.
- Does any element contradict the named philosophy?
- Are signature techniques of that school actually present, not just implied?

### 2. Visual Hierarchy

Does the eye know where to go?

| Score | What it looks like |
|-------|--------------------|
| 10 | The eye flows along the intended path. Zero friction. |
| 7-8 | Primary and secondary read clearly. One or two ambiguous mid-tier elements. |
| 5 | Title and body are distinguishable. Middle layers blur. |
| 3 | Information is flat. No clear entry. |
| 0-2 | Squint test fails completely. |

**Audit prompts**:
- Squint test: with eyes nearly closed, are 3-4 levels still visible?
- Title-to-body ratio at least 2.5x?
- Is whitespace doing hierarchical work, or just sitting there?

### 3. Execution

Pixel-level craft. Alignment, spacing, color discipline, type discipline.

| Score | What it looks like |
|-------|--------------------|
| 10 | Pixel-precise. Grid-aligned. Color count and type count both controlled. |
| 7-8 | Polished overall. One or two micro-misalignments. |
| 5 | Roughly aligned. Spacing inconsistent. Color system loose. |
| 3 | Visible alignment errors. Too many colors. Type chaos. |
| 0-2 | Looks like a draft. |

**Audit prompts**:
- Is there a spacing system (8pt grid is the default)?
- Color count under 4 plus neutrals?
- Type families under 3?
- Edges aligned to a real grid, or eyeballed?

### 4. Functionality

Does every element earn its place? Does the work do its job?

| Score | What it looks like |
|-------|--------------------|
| 10 | Every element serves the goal. Zero ornament-for-ornament. |
| 7-8 | Goal-driven with minor decorative drift. |
| 5 | Usable. Decoration competes with content in places. |
| 3 | Form swallows function. Users hunt for information. |
| 0-2 | Pure decoration. Communication has collapsed. |

**Audit prompts**:
- If you delete element X, does the work get worse? If no, delete it.
- Is the primary CTA / message in the strongest position?
- Information density appropriate for the medium (slide vs PDF vs landing page)?

### 5. Innovation

Within the philosophy, is there a fresh move? Or is this template-shaped?

| Score | What it looks like |
|-------|--------------------|
| 10 | Surprising and inevitable. A specific, defensible move within the chosen school. |
| 7-8 | A clear authorial voice. Not template-fed. |
| 5 | Competent but generic. Could be anyone's. |
| 3 | Heavy cliche use. Default-mode visuals. |
| 0-2 | Stock-asset assembly. |

**Audit prompts**:
- Name one decision that surprised you. If none, score below 7.
- Are any cliches present (gradient orbs for AI, neon-on-black, glassmorphism-by-default)?
- Inside the philosophy, is there room for the author's own move, and was it taken?

## Cliche Scan (Anti-Pattern Catalog)

Critic-agent looks for named anti-patterns. Each hit drops innovation by 1, sometimes more. The catalog grows; current entries:

| Name | Description | UX law violated |
|------|-------------|-----------------|
| **generic-LoFi** | Default low-fi wireframe aesthetic mistaken for a finished design. | Aesthetic-Usability Effect (low perceived craft lowers perceived function) |
| **mystery-meat** | Icons or controls without labels, function unguessable. | Jakob's Law (violates platform convention that interactive controls are labeled) |
| **hairball** | Force-directed graph rendered with no spatial logic, every node visible at once. | Cognitive Load / Miller's Law (exceeds working memory; no focal path) |
| **neon-cyber-default** | Deep blue (#0D1117) plus neon glow, used as a fallback rather than a choice. | Von Restorff Effect (nothing differentiates; every element glows equally) |
| **AI-orb** | Gradient sphere standing in for "intelligence." | Selective Attention (decorative focal element competes with actual content) |
| **glass-everywhere** | Frosted glass on every surface. Translucency has no semantic role. | Common Region (no visual grouping signal; everything reads as one undifferentiated layer) |
| **template-grid** | 3-column card grid with identical cards, no visual rhythm. | Serial Position Effect (middle cards equal in weight to first/last; no hierarchy) |
| **ornament-tax** | Decorative element that survives the deletion test (work is unchanged when removed) but stayed in. | Cognitive Load (every non-functional element consumes attention budget without return) |

A demo with two or more named anti-patterns cannot score above 6 on innovation, regardless of other strengths.

**Additional UX-law gate flags** (each counts as a named anti-pattern hit):

| Flag | What to look for | Fail condition |
|------|-----------------|----------------|
| **serial-position-burial** | Key stat or primary claim not first or last in its sequence. | Found in position 2-through-(N-1) with no visual weight to compensate. |
| **von-restorff-null** | Every element identical in size, color, and weight. Nothing differentiates. | Zero elements break the visual rhythm. |
| **doherty-void** | Interactive or animated deliverable has no loading state or skeleton. | First meaningful content arrives over 400 ms with no progress signal. |
| **fitts-undersize** | Interactive targets (buttons, CTAs) below 44 px on screen or below 2° angular size in spatial context. | Any tappable region misses the minimum. |
| **cognitive-overload** | More than 5 focal elements on a flat surface or more than 4 in a 3D supporting layer, all at equal visual weight. | Count exceeds cap; no hierarchy present. |

## UX law violation scan

A second-pass critique gate, run after the five-dimension score. The five-dimension rubric catches aesthetic and craft failures. This gate catches cognitive UX failures: no visual defect, just a broken mental model or overloaded attention system.

**Gate structure:** four questions, each a binary pass/fail. One fail blocks the G4 gate the same way a dimension score below 7 does. These mirror the self-check in SKILL.md "UX law self-check (pre-delivery gate)" but are framed for reviewer use, not author use.

### Q1 - Cognitive load

Count independent focal elements. If there are 6 or more on a flat surface all at the same visual weight, that's a fail. The reviewer doesn't need to count precisely; if the squint test produces more than five competing entry points, the deliverable fails this gate.

Relevant laws: Miller's Law, Cognitive Load theory.

### Q2 - Serial position

The most important claim or content is at position 1 or position N in its sequence. Check the slide deck order, the section sequence in an infographic, the card list. If the hero claim is buried in the middle with no compensating visual weight (size, color, isolation), that's a fail.

Relevant law: Serial Position Effect.

### Q3 - Peak-end

The deliverable has a named peak (the highest-value moment: the stat that lands, the product reveal, the climax frame) and a deliberate close (the last thing the viewer sees or reads). If the reviewer can't name both in one sentence each, the deliverable fails this gate. "It kind of ends" is a fail.

Relevant laws: Peak-End Rule, Von Restorff Effect (the peak must be isolable).

### Q4 - Doherty

Any interaction or animation that takes over 400 ms to first meaningful content has a loading state. Check: skeleton screen, progress indicator, or animated placeholder. Missing loading state on a slow-to-render deliverable is a fail.

Relevant law: Doherty Threshold.

### Named violation flags (call these out explicitly in critique reports)

| Law | What to look for | Fail example |
|-----|-----------------|--------------|
| **Serial Position Effect** | Important content in the middle of a sequence with no visual distinction. | Slide 4 of 7 carries the core value proposition at body-text size. |
| **Von Restorff Effect** | No element breaks the visual rhythm; everything blends. | 6 equally styled feature callouts, none differentiated. |
| **Common Region** | Related items have no shared bounding, grouping, or backdrop. | Three related stats float with no container; reader can't parse the grouping. |
| **Aesthetic-Usability Effect** | Low craft triggers low trust in function before the user interacts. | Misaligned grid, inconsistent type scale, visible draft quality in a shipped deliverable. |
| **Doherty Threshold** | No feedback for operations over 400 ms. | Clicking a CTA triggers a 2 s transition with no skeleton or spinner. |
| **Fitts's Law** | CTA or interactive region too small or too far from the natural gaze or cursor path. | Primary CTA at bottom-right corner of a 1920 px-wide layout with no visual weight to pull the eye. |
| **Jakob's Law** | Interaction pattern deviates from platform convention without rationale. | Custom swipe gesture replaces standard scroll on a web landing page. |
| **Selective Attention** | Decorative element captures attention at the same level as functional content. | Animated background gradient moves faster than the hero text, pulling focus away. |

## Per-Medium Weighting

The five dimensions matter unequally by medium. The floor rule still applies; this just guides where to push first when scores tie.

| Medium | Push hardest on | Can be looser on |
|--------|-----------------|------------------|
| Cover image / hero | Innovation, hierarchy | Functionality (single image, low interaction) |
| Infographic | Functionality, hierarchy | Innovation (accuracy beats novelty) |
| Slide deck | Hierarchy, functionality | Innovation (clarity beats novelty) |
| White paper / PDF | Execution, functionality | Innovation (professionalism beats novelty) |
| Landing page | All five, no exceptions | None |
| App UI | Functionality, execution | Philosophical coherence (usability beats school) |
| Social card | Innovation, hierarchy | Execution (vibe beats polish) |

## Output Template

```
## Critique Report

**Floor score**: X/10 (lowest dimension)
**Verdict**: pass (>=7) / hold (5-6) / fail (<5)

**Per dimension**:
- Philosophical coherence: X/10. [one sentence]
- Visual hierarchy: X/10. [one sentence]
- Execution: X/10. [one sentence]
- Functionality: X/10. [one sentence]
- Innovation: X/10. [one sentence]

**Anti-patterns detected**: [list, or "none"]
**UX law violations**: [list from violation scan, or "none"]

### Keep
- [specific moves that work, in design language]

### Fix (ranked)
1. **[name]**, severity: critical / important / polish
   - Now: [state]
   - Why: [reason]
   - Move: [concrete fix with numbers]

### 5-minute wins
- [ ] [highest-impact fix]
- [ ] [next]
- [ ] [next]
```

## Worked Example

Fictional landing page for a SaaS analytics tool. Hero shows a gradient sphere over deep-blue background, three identical feature cards below, frosted-glass nav, no clear primary CTA, body type 16px, headline 24px.

```
## Critique Report

**Floor score**: 3/10
**Verdict**: fail

**Per dimension**:
- Philosophical coherence: 4/10. No declared philosophy; visuals default to neon-cyber.
- Visual hierarchy: 3/10. Headline-to-body ratio 1.5x, well below the 2.5x floor; CTA not findable.
- Execution: 6/10. Spacing roughly on an 8pt grid; color count crept to 7 including glow stops.
- Functionality: 4/10. Three cards repeat the same shape with no rhythm; nav glass dilutes contrast.
- Innovation: 3/10. Two named anti-patterns present (see below); zero authorial moves.

**Anti-patterns detected**: AI-orb, neon-cyber-default, template-grid, glass-everywhere
**UX law violations**: Serial Position Effect (CTA buried mid-page), Von Restorff Effect (nothing differentiates), Selective Attention (orb competes with headline)

### Keep
- Vertical rhythm in the card region tracks the 8pt grid.

### Fix (ranked)
1. **No philosophy declared**, critical. Pick one school (Pentagram informational, Hara reductive, or Sagmeister expressive) and rebuild from there.
2. **Hero cliche stack**, critical. Drop the gradient sphere and neon glow. Replace with a typographic hero or a real product moment.
3. **Hierarchy collapse**, critical. Headline to 56px minimum, body to 16-18px, primary CTA in a single accent color used nowhere else.
4. **Card uniformity**, important. Break the 3-up symmetry; vary card height or content density.

### 5-minute wins
- [ ] Delete the gradient orb.
- [ ] Bump headline to 56px.
- [ ] Drop one of the seven colors; cap palette at 4.
```

## Roadmap: 7-Dim Extension (Phase 11)

Two dimensions are reserved for capability-specific critique. They are not active yet. Producer-mode demos in Phase 11 will turn them on.

- **6. Spatial coherence** (3D mode). Camera framing, depth cues, scale legibility, navigation legibility in 3D space, AR Quick Look behavior, Vision Pro / Quest comfort.
- **7. Data truth** (data viz). Encoding honesty, axis discipline, no truncated baselines without flagging, color used for variable not decoration, source visible, uncertainty shown where present.

When active, the floor rule extends: lowest of seven wins. Critic-agent will gate G4 against the active dimension count for the capability under test.

## Critic-Agent Integration

- Trigger: every G4 (demo gate) run.
- Input: the demo artifact plus the declared philosophy.
- Output: this template, written to the demo's review log.
- Gate logic: floor score below 7 routes back to producer mode; floor 7 or 8 ships with a fix list; floor 9-10 ships clean.
- Override: human reviewer can force-pass with a written justification logged alongside the report.

The critic does not propose redesigns. It scores, names anti-patterns, and lists fixes. The producer-agent or the human owner decides what to change.
