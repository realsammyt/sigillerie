---
name: editable-pptx
description: HTML to editable PowerPoint export, 4 hard constraints for html2pptx, dependencies, when to use vs PDF
---

# editable-pptx

Path: HTML rendered in a headless browser, computed styles read per element, each DOM node translated into a native PowerPoint object via `pptxgenjs`. Result: a `.pptx` where every text box is double-click editable, every image is swappable, every color is changeable.

This is the only path supported by `scripts/export_deck_pptx.mjs`. The translator lives at `scripts/html2pptx.js`.

For the upstream decision (one-file deck vs per-slide files vs PDF vs PPTX), see `slide-decks.md`.

## When PPTX, when PDF

| Client need | Output |
|---|---|
| Recipient will edit copy, swap logos, retint sections after delivery | **PPTX** (this doc) |
| Visual fidelity dominates: gradients, web components, complex SVG, animation traces, custom filters | **PDF** (`scripts/export_deck_pdf.mjs`) |
| Both | Ship both. Visual PDF for the read, editable PPTX for the handoff. |

PPTX cannot hold visual-driven HTML faithfully. The format itself does not allow it (see "Why these are physical, not bugs" at the bottom). Do not try to force a visual deck through `html2pptx` and expect it to pass. Empirically, visual-driven HTML clears the translator at under 30%.

## Dependencies

```
playwright    # headless browser, computed-style read
pptxgenjs     # PowerPoint object writer
sharp         # image processing for <img> assets
```

Install once at repo root. The export script picks them up from `node_modules`.

## Canvas: 960pt by 540pt, layout `LAYOUT_WIDE`

PPTX units are inches. The body's computed dimensions must match the presentation layout's inch dimensions within 0.1", and `html2pptx.js` enforces this with `validateDimensions`.

Use one of these three equivalent body declarations:

```css
body { width: 960pt;   height: 540pt;  }   /* clearest */
body { width: 1280px;  height: 720px;  }   /* px habit */
body { width: 13.333in; height: 7.5in; }   /* inch direct */
```

Paired pptxgenjs setup:

```js
const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';   // 13.333in x 7.5in, no custom defineLayout needed
```

Body size is physical size, not resolution. A 1920x1080 body does not give sharper text. It shrinks every `pt` font relative to canvas, so projected slides look smaller, not crisper.

## The 4 hard constraints

The translator walks the DOM and emits PowerPoint objects. PPTX's object model projects back onto HTML as these four rules. Violate any of them and the export errors out.

### 1. Text lives in `<p>` or `<h1>`-`<h6>`, never bare in a `<div>`

```html
<!-- wrong: text directly inside div -->
<div class="title">Q3 revenue up 23%</div>

<!-- right: text inside a paragraph-level tag -->
<div class="title"><h1>Q3 revenue up 23%</h1></div>
<div class="body"><p>New users carried it.</p></div>
```

Why: PowerPoint text must sit in a text frame. Text frames map to paragraph-level HTML (p, h1-h6, li). A bare `<div>` has no text-frame analog in OOXML.

`<span>` cannot carry primary text either. It's inline, can't anchor a text-box position. Use spans only inside p/h\* for local style runs (bold, color shift).

### 2. No CSS gradients, solid fills only

```css
/* wrong */
background: linear-gradient(to right, #FF6B6B, #4ECDC4);

/* right: solid */
background: #FF6B6B;

/* if you need a multi-color bar, use flex children with solid fills */
.stripe-bar { display: flex; }
.stripe-bar div { flex: 1; }
.red  { background: #FF6B6B; }
.teal { background: #4ECDC4; }
```

Why: PowerPoint shape fill supports solid and a narrow set of preset gradients. `pptxgenjs` `fill: { color }` only emits solid. Arbitrary CSS angles don't translate.

### 3. Background, border, and shadow go on the wrapping `<div>`, never on the text tag

```html
<!-- wrong: background on the <p> itself -->
<p style="background: #FFD700; border-radius: 4px;">Highlight</p>

<!-- right: div carries chrome, p carries text -->
<div style="background: #FFD700; border-radius: 4px; padding: 8pt 12pt;">
  <p>Highlight</p>
</div>
```

Why: in PPTX, a shape (rectangle, rounded-rect) and a text frame are two separate objects. `<p>` becomes a text frame only. Background, border, shadow belong to the shape, which means they belong to the wrapping div.

### 4. Images come in via `<img>`, never `background-image`

```html
<!-- wrong -->
<div style="background-image: url('chart.png')"></div>

<!-- right -->
<img src="chart.png" style="position: absolute; left: 50%; top: 20%; width: 300pt; height: 200pt;" />
```

Why: `html2pptx.js` reads picture sources from `<img>` only. It does not parse CSS `background-image` URLs.

## Per-slide HTML skeleton

One HTML file per slide. Scope isolation per file beats one big deck file (CSS bleed kills exports).

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 960pt; height: 540pt;
    font-family: system-ui, -apple-system, "Inter", sans-serif;
    background: #FEFEF9;
    overflow: hidden;
  }
  .card {
    position: absolute;
    background: #1A4A8A;
    border-radius: 4pt;
    padding: 12pt 16pt;
  }
  .card h2 { font-size: 24pt; color: #FFFFFF; font-weight: 700; }
  .card p  { font-size: 14pt; color: rgba(255,255,255,0.85); }
</style>
</head>
<body>
  <div style="position: absolute; top: 40pt; left: 60pt; right: 60pt;">
    <h1 style="font-size: 36pt; color: #1A1A1A; font-weight: 700;">Title is an assertion, not a topic</h1>
    <p style="font-size: 16pt; color: #555555; margin-top: 10pt;">Subhead carries the proof.</p>
  </div>

  <div class="card" style="top: 130pt; left: 60pt; width: 240pt; height: 160pt;">
    <h2>Point one</h2>
    <p>Short body line.</p>
  </div>

  <div style="position: absolute; top: 320pt; left: 60pt; width: 540pt;">
    <ul style="font-size: 16pt; color: #1A1A1A; padding-left: 24pt; list-style: disc;">
      <li>First item</li>
      <li>Second item</li>
    </ul>
  </div>

  <img src="illustration.png" style="position: absolute; right: 60pt; top: 110pt; width: 320pt; height: 240pt;" />
</body>
</html>
```

## Build script

```js
const pptxgen = require('pptxgenjs');
const html2pptx = require('../scripts/html2pptx.js');

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';

  const slides = ['01-cover.html', '02-agenda.html', '03-content.html'];
  for (const file of slides) {
    await html2pptx(`./slides/${file}`, pres);
  }
  await pres.writeFile({ fileName: 'deck.pptx' });
})();
```

The Sigillerie wrapper is `scripts/export_deck_pptx.mjs`. It walks a slides directory, calls `html2pptx.js` per file, writes the deck.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `DIV element contains unwrapped text "X"` | bare text in a div | wrap in `<p>` or `<h*>` |
| `CSS gradients are not supported` | linear/radial-gradient | solid fill, or flex children |
| `Text element <p> has background` | chrome on a text tag | move chrome to wrapping div |
| `Background images on DIV elements are not supported` | `background-image` | use `<img>` |
| `HTML content overflows body by Xpt vertically` | content past 540pt | trim copy, smaller font, or `overflow: hidden` |
| `HTML dimensions don't match presentation layout` | body and layout disagree | 960x540pt body with `LAYOUT_WIDE` |
| `Text box "X" ends too close to bottom edge` | large `<p>` under 0.5" from bottom | raise it; projector edges crop |

## Fallback: client has visual HTML, demands editable PPTX

Be honest up front. The HTML uses gradients or web components or complex SVG and won't pass the translator. Two options:

- **A. Ship PDF.** 100% visual fidelity, recipient can read and print, can't edit text.
- **B. Re-author an editable variant.** Keep the design intent (palette, hierarchy, copy, layout rhythm). Drop gradients to solids. Drop web components to paragraph HTML. Drop complex SVG to simplified `<img>` or solid geometry. Keep the PDF too, deliver both.

Don't ask the client to rewrite their HTML to pass 4 constraints. They gave design intent. Translation is the job.

When to refuse B: animation is the value, deck is over 30 slides, design depends on precise SVG filters. Tell the client the rewrite cost exceeds the editable benefit, recommend PDF.

## Why these are physical, not bugs

The 4 constraints are OOXML projecting onto HTML, not author laziness:

- PPTX text must live in `<a:txBody>`, mapping to paragraph-level HTML
- PPTX shape and text frame are separate objects, can't co-host chrome and text
- PPTX shape fill supports solid plus narrow preset gradients, not arbitrary CSS angles
- PPTX picture objects reference real files, not CSS URLs

Don't expect the translator to outgrow the format. HTML adapts to PPTX, not the reverse.
