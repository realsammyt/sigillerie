---
name: slide-decks
description: Slide deck architectures, two patterns (multi-file with deck_index aggregator vs single-file deck_stage web component), decision rules and common failure modes
---

# slide-decks

Decks are a high-frequency Sigillerie deliverable. HTML is the source. PDF and PPTX are downstream snapshots exported from HTML with one command. Pick the architecture before you write a line of markup. Picking wrong costs hours.

## HTML is the spine

Every deck starts as an HTML aggregator the browser can play full-screen with keyboard nav. PDF and PPTX are derivatives of that aggregator, never the other way round.

Why HTML first:
- projector and screen-share friendly (no Keynote / PowerPoint dependency)
- each slide opens standalone for fast verification during build
- only upstream that PDF and PPTX can read without round-trip pain
- final delivery can ship HTML alongside PDF or PPTX, recipient picks

## Confirm export format before you write any markup

This is the hardest checkpoint. It precedes every other decision including single-file vs multi-file. Real cost of skipping: 2-3 hours of rewrite.

| Final delivery | HTML constraints | Export command |
|---|---|---|
| HTML only (live presentation, archive) | none, full visual freedom | n/a |
| HTML + PDF | none, full visual freedom | `export_deck_pdf.mjs` |
| HTML + editable PPTX | 4 hard constraints from line one | `export_deck_pptx.mjs` |

The 4 hard constraints for editable PPTX (full detail in `editable-pptx.md`):

1. body fixed at 960pt x 540pt (matches `LAYOUT_WIDE`, not 1920x1080px)
2. all text wrapped in `<p>` or `<h1>`-`<h6>` (no bare text in div, no `<span>` carrying primary copy)
3. `<p>` and `<h*>` carry no background, border, or shadow (push those to outer div)
4. no CSS gradient, no web component, no complex SVG decoration

Default Sigillerie HTML is visually rich. It will not pass PPTX constraints retroactively. If the user wants editable PPTX and animation or web components, that's a real conflict. Surface the tradeoff, don't quietly hand-roll a `pptxgenjs` script. Hand-rolled PPTX becomes permanent maintenance debt.

## Showcase before batch (any deck >= 5 slides)

Never write slide 1 through 12 in a row. Wrong direction = 12 reworks. The correct sequence:

1. pick the **2 most visually divergent slide types** (cover + emotional quote, or cover + product showcase)
2. ship those 2 as showcase, screenshot, get user to confirm grammar (font, color, spacing, structure, bilingual ratio)
3. only after grammar lock, batch the remaining N-2 slides reusing that grammar
4. assemble the aggregator and run PDF / PPTX export last

Showcase pages should be the two most structurally different. If both pass, the in-between cases pass too.

| Deck type | Showcase pair |
|---|---|
| B2B brochure / product launch | cover + content slide (philosophy / emotion) |
| Brand reveal | cover + product feature |
| Data report | hero data slide + analysis slide |
| Course / lesson | chapter cover + concept slide |

## Pick the architecture

Two patterns. Pick before writing markup.

| Dimension | Single-file + `assets/deck_stage.js` | Multi-file + `assets/deck_index.html` |
|---|---|---|
| Code structure | one HTML, slides as `<section>` | one HTML per slide, aggregator iframes them |
| CSS scope | global (one slide's CSS leaks into others) | iframe-isolated by construction |
| Verify a single slide | needs JS `goTo` | double-click the file |
| Parallel agent work | merge conflicts on one file | zero conflicts, one file per slide |
| Debug blast radius | one CSS bug breaks the whole deck | one bug affects one slide |
| Cross-slide state | trivial (shared scope) | needs `postMessage` |
| Print to PDF | built-in | aggregator iterates iframes |
| Keyboard nav | built-in | built-in |

### Decision rule

```
slides <= 10, needs cross-slide animation or shared state, pitch demo
  -> single-file (path B)

slides >= 10, lecture, course, long brochure, multi-agent build
  -> multi-file (path A, default)
```

Multi-file is the default for production work. Every advantage of single-file (keyboard nav, print, scaling) exists in multi-file too. The reverse isn't true: scope isolation and per-file verification can't be retrofitted onto single-file.

## Path A (default): multi-file architecture

### Layout

```
deck/
  index.html            # copied from assets/deck_index.html, edit MANIFEST
  shared/
    tokens.css          # color, type scale, page chrome
    fonts.html          # <link> for Google Fonts, included per slide
  slides/
    01-cover.html       # each file is a complete 1920x1080 HTML
    02-agenda.html
    ...
```

### Slide template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>P05 - Chapter Title</title>
  <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
  <link rel="stylesheet" href="../shared/tokens.css">
  <style>
    /* slide-local styles, can't pollute other slides */
    body { padding: 120px; }
  </style>
</head>
<body>
  <div class="page-header">...</div>
  <div>...</div>
  <div class="page-footer">...</div>
</body>
</html>
```

Constraints:
- `<body>` is the canvas, no `<section>` wrapper
- `width: 1920px; height: 1080px` locked in `shared/tokens.css`
- per-slide `<link>` for fonts (cheap, keeps each file standalone)

### Aggregator

Copy `assets/deck_index.html` and edit `window.DECK_MANIFEST`:

```js
window.DECK_MANIFEST = [
  { file: "slides/01-cover.html",   label: "Cover" },
  { file: "slides/02-agenda.html",  label: "Agenda" },
  { file: "slides/03-problem.html", label: "Problem" },
];
```

Built into the aggregator: keyboard nav (arrows, Home, End, digits, P for print), scale + letterbox, slide counter, localStorage memory, hash deeplink, print mode iterating iframes.

### Per-slide verification

```bash
open slides/05-personas.html
```

Playwright screenshots go straight to `goto(file://.../slides/05-personas.html)`, no JS step. Iterate-and-verify cost approaches zero.

### `shared/tokens.css` scope

Only what's truly cross-slide:
- CSS variables (palette, type scale, spacing)
- canvas lock `body { width: 1920px; height: 1080px; }`
- shared `.page-header` / `.page-footer` chrome

Don't put per-slide layouts in tokens. That re-introduces the global pollution that single-file architecture suffers.

## Path B: single-file + `assets/deck_stage.js`

For <= 10 slides, cross-slide shared state, or compact pitch demos.

### Usage

1. embed `assets/deck_stage.js` via `<script src="...">`
2. wrap slides in `<deck-stage>` with `<section>` children
3. **`<script>` tag must come after `</deck-stage>`** (or use `defer` / `type="module"`)

```html
<body>
  <deck-stage>
    <section><h1>Slide 1</h1></section>
    <section><h1>Slide 2</h1></section>
  </deck-stage>
  <script src="deck_stage.js"></script>
</body>
```

### Why script position is hard

If the script defines `customElements` before the parser reaches `<deck-stage>`, `connectedCallback` fires while children haven't parsed yet. `_collectSlides()` returns empty, counter shows `1 / 0`, all slides stack-render on top of each other.

Three legal placements:

```html
<!-- best: after </deck-stage> -->
</deck-stage>
<script src="deck_stage.js"></script>

<!-- ok: head with defer -->
<head><script src="deck_stage.js" defer></script></head>

<!-- ok: module scripts defer by default -->
<head><script src="deck_stage.js" type="module"></script></head>
```

### Single-file CSS trap (read this)

The single most common bug: the `display` property on `<section>` gets overridden by per-slide CSS, all slides render simultaneously.

Wrong:

```css
deck-stage > section {
  display: flex;        /* overrides ::slotted display:none, all slides stack */
  padding: 80px;
}
.emotion-slide { display: grid; }  /* even worse, specificity 10 */
```

Right (starter CSS, copy as-is):

```css
deck-stage > section {
  background: var(--paper);
  padding: 80px 120px;
  overflow: hidden;
  position: relative;
  /* never set display here */
}

deck-stage > section:not(.active) {
  display: none !important;
}

deck-stage > section.active {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

@media print {
  deck-stage > section { display: flex !important; }
  deck-stage > section:not(.active) { display: flex !important; }
}
```

Cleaner alternative: put flex / grid on an inner `<div>`, leave `<section>` as a pure visibility toggle.

## Path C: 3D-heavy slides via Track A scenes

When slides need a real three.js scene (interactive product viewer, spatial data, brand sequence), each slide becomes a Track A page implementing the contract in `modes/three3d/page-contract.md`. The slide hosts a canvas, exports `__renderFrame(time)`, and the deck navigation passes through to the scene's animation loop. PDF export captures one frame; PPTX path is not viable for 3D slides, switch to PDF or keep HTML as the canonical delivery.

Cross-reference: `modes/three3d/page-contract.md`.

## Capability cross-references

- **Generative audio**: a deck can ship brand-aware BGM. Wire an `<audio>` tag to the deck's slide-change event so cues fire on navigation. Spec in `capabilities/generative-audio/brand-audio-spec.md`.
- **Data viz**: slides with embedded charts use Plot or D3 inside the slide HTML, no special wiring needed. Stack and patterns in `capabilities/data-viz/stack.md`.
- **Editable PPTX**: 4 hard constraints, fallback flow, full template in `editable-pptx.md`.

## Slide labels

- multi-file: `MANIFEST` entries take `{ file, label: "04 Problem Statement" }`
- single-file: `<section data-screen-label="04 Problem Statement">`
- numbering starts at 1, never 0. Users say "slide 5" and mean the fifth one

## Speaker notes

Off by default. Add only on explicit request. When notes carry the script, on-slide text can drop to a minimum.

```html
<script type="application/json" id="speaker-notes">
[
  "Slide 1 narration...",
  "Slide 2 narration..."
]
</script>
```

Notes guidance: full sentences not bullets, conversational not written, 200-400 words per slide, mark emphasis and pauses.

## Common failure modes

**Emoji blank in Chromium / Playwright export.** Chromium ships no color emoji font, `page.pdf()` renders empty boxes. Use Unicode glyphs (`✦` `✓` `→` `·`) or plain text.

**`Cannot find package 'playwright'` from export script.** ESM resolves `node_modules` upward from script location. Copy the script into the deck directory, run `npm install playwright pdf-lib`, invoke from there.

**Chinese / custom fonts render as system default.** Webfonts haven't loaded when Playwright snapshots. Set `wait-for-timeout=3500` minimum or self-host fonts in `shared/fonts/`.

**Information density too high.** Cap at one core message + 3-4 supporting points + one visual subject per slide. More than that, split.

**Multi-file: iframe blank.** Check MANIFEST `file` paths are relative to `index.html`. Inspect iframe `src` in DevTools.

**Single-file: slides stack-render.** CSS specificity bug. Re-read the starter CSS section above.

**Single-file: scale wrong.** Slides must be direct `<section>` children of `<deck-stage>`. No wrapper div in between.

**Position drifts across screens.** Use fixed `1920x1080` and `px`, never `vw` / `vh` / `%`. Aggregator handles scaling.

## Verification checklist (run before delivery)

- [ ] open `index.html`, cover renders clean, fonts loaded
- [ ] arrow through every slide, no blank pages, no broken layout
- [ ] press P, print preview shows one slide per page, no clipping
- [ ] hard-refresh 3 random slides, localStorage state restores
- [ ] Playwright screenshot every slide, eyeball the set
- [ ] grep for `TODO` and `placeholder`, none remain
