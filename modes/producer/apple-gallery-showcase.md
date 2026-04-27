---
name: apple-gallery-showcase
description: Apple-style product gallery template, 3D-tilted card grid with slow pan and focus rotation. Specific recipe for hero animations on Apple-aesthetic briefs.
---

# Apple Gallery Showcase

A specific recipe. Tilted product cards floating above a soft horizon, slow pan, focus shifting card to card. Restrained palette, hairline borders, two-layer shadows.

This is a *style*, not a default. Use only when the brief earns it (see `brand-spec.md` and the direction-library entry pointing here).

See also:
- `modes/three3d/recipes.md` for the true-3D version (three.js camera, real depth, parallax). CSS perspective is the cheap version.
- `modes/producer/animation-best-practices.md` for cadence and pacing rules across all hero work.

---

## When to use

Fits when:
- 5+ real artifacts to show on one screen (slides, app shots, pages, infographics)
- Pro audience that reads texture (designers, devs, PMs)
- Brief wants restrained, gallery-grade, museum-card energy
- Need both the wall and the close-up at once

Skip when:
- Single-product hero (use a product hero recipe, not this)
- Story-driven or emotional pacing (timeline narrative recipe)
- Vertical / phone-first (tilt collapses on small screens)

---

## Warning: this is a slop pattern now

Apple's gallery aesthetic has been copied into every SaaS marketing page since 2022. Tilted card walls are the new gradient mesh. Pick this recipe only when:

1. The brand-spec.md explicitly calls for restrained / Apple-adjacent / editorial,
2. The artifacts are genuinely high-quality (this style amplifies whatever you put in it, including weakness),
3. The direction-library entry has a Sigillerie example using it.

If the brief is "we want it to look like Apple," push back. Ask what they actually want.

---

## Palette

Light canvas, single warm accent, everything else greyscale.

```css
:root {
  --bg:        #F5F5F7;   /* canvas */
  --bg-warm:   #FAF9F5;   /* warm variant */
  --ink:       #1D1D1F;
  --ink-80:    #3A3A3D;
  --ink-60:    #545458;
  --muted:     #86868B;
  --hairline:  #E5E5EA;
  --accent:    #D97757;   /* one accent. one. */
  --serif:     "Source Serif 4", Georgia, serif;
  --sans:      "Inter", -apple-system, system-ui;
  --mono:      "JetBrains Mono", "SF Mono", ui-monospace;
}
```

Rules:
1. Never pure black background. Black turns artifacts into cinema, not work-product.
2. One accent hue, the rest greyscale + white.
3. Three-stack typography (serif + sans + mono) reads as publication, not SaaS.

---

## Card unit

The floating card is the atomic piece.

```css
.gallery-card {
  background: #FFFFFF;
  border-radius: 14px;
  padding: 6px;
  border: 1px solid var(--hairline);
  box-shadow:
    0 20px 60px -20px rgba(29, 29, 31, 0.12),
    0 6px 18px -6px rgba(29, 29, 31, 0.06);
  aspect-ratio: 16 / 9;
  overflow: hidden;
}
.gallery-card img {
  width: 100%; height: 100%;
  object-fit: cover;
  border-radius: 9px;
}
```

The 6px padding is the matte, the inner radius nests inside the outer. Two-layer shadow gives float without going heavy.

Anti-pattern: edge-to-edge tiles, no border, no shadow. That's an infographic, not a gallery.

---

## Composition

3 to 7 cards on screen. Asymmetric staggered grid. One dominant card, smaller satellites. Never a tidy 3x3 grid (that reads as PowerPoint).

For an 8-column scaffold:

```css
.gallery-canvas {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 40px;
  padding: 60px;
}
```

Place the dominant card spanning 3-4 columns, satellites on 2 columns each, vertical staggers between.

---

## Tilt

The tilt vocabulary:

```css
transform: perspective(1200px)
           rotateX(-15deg)
           rotateY(8deg)
           rotateZ(-2deg);
```

Sweet spots:
- `rotateX`: 10 to 15 deg. More and it reads as VIP-event backdrop.
- `rotateY`: 8 to 12 deg, signed however the composition wants.
- `rotateZ`: 2 to 3 deg. The "human placed this" angle. Skip and it looks machine-set.
- `perspective`: 1200 to 2800 px. Below 1000 fish-eyes, above 3000 flattens.

For longer pan canvases, raise perspective to 2400 and let the canvas exceed viewport.

---

## Pan

Slow continuous pan, 8 to 15 seconds per cycle. Sin/cos drift, not CSS keyframes.

```js
const panX = Math.sin(panT * 0.12) * 220 - panT * 8;
const panY = Math.cos(panT * 0.09) * 120 - panT * 5;
const clampedX = Math.max(-900, Math.min(900, panX));
```

Numbers:
- Sine period 0.09 to 0.15 rad/s (one full swing every 30 to 50 seconds)
- Linear drift 5 to 8 px/s (slower than a blink)
- Amplitude 120 to 220 px (visible, not nauseating)
- Clamp to keep edges off-screen

Use rAF, not `setTimeout` and not CSS keyframes. Time-driven, every frame computes from `t`.

---

## Focus rotation

Every 2 to 3 seconds, one card becomes hero. Never simultaneous reveals.

The focus overlay is a *flat* element (no tilt) that scales from the card's tilted slot up to a centered presentation size. Background dims to 45%, blur on the rest.

```js
focusOverlay.style.width  = lerp(startW, endW, focusIntensity) + 'px';
focusOverlay.style.height = lerp(startH, endH, focusIntensity) + 'px';
focusOverlay.style.opacity = focusIntensity;

card.style.opacity = entryOp * (1 - 0.55 * focusIntensity);
card.style.filter  = `brightness(${1 - 0.3 * focusIntensity}) blur(${1.5 * focusIntensity}px)`;
```

Sharpness rule: the focus overlay's `<img src>` must point at the original full-res file, not the gallery thumbnail. Preload originals into an `Image[]` array. Browser resamples per frame from the high-res source.

---

## Timeline shape

One render function, time-driven, no state machine.

```js
const T = {
  DURATION: 25.0,
  panStart: 8.6,
  focuses: [
    { start: 11.0, end: 12.7, idx: 2  },
    { start: 13.3, end: 15.0, idx: 3  },
    { start: 15.6, end: 17.3, idx: 10 },
    { start: 17.9, end: 19.6, idx: 16 },
  ],
};

const easeOut = t => 1 - Math.pow(1 - t, 3);
function lerp(time, start, end, fromV, toV, easing = easeOut) {
  if (time <= start) return fromV;
  if (time >= end)   return toV;
  return fromV + (toV - fromV) * easing((time - start) / (end - start));
}

function render(t) { /* read t, write all elements */ }
requestAnimationFrame(function tick(now) {
  const t = ((now - startMs) / 1000) % T.DURATION;
  render(t);
  requestAnimationFrame(tick);
});
```

Why: any frame can be jumped to (`window.__setTime(12.3)` for Playwright capture), loop ties end-to-start via mod, debug freeze is one line.

---

## Texture details

These read as nothing-much, but the absence is loud.

**Noise overlay.** Light backgrounds need grain or they look plastic.

```css
.stage::before {
  content: '';
  position: absolute; inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.078  0 0 0 0 0.078  0 0 0 0 0.074  0 0 0 0.035 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.5;
}
```

**Corner mark.** Small mono caps, top-left, like a museum wall card.

**Wordmark on close.** Negative tracking (`letter-spacing: -0.045em`) is the Apple tell. Heavy weight on stem characters, lighter on the accent character.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Reads as PPT template | No shadow, no hairline | Two-layer shadow + 1px border |
| Tilt looks cheap | rotateY only | Add 2-3deg rotateZ |
| Pan stutters | setTimeout or CSS keyframes loop | rAF + sin/cos, time-driven |
| Focus card blurry | Reused the gallery thumbnail | Independent overlay, original src |
| Background plastic | Solid `#F5F5F7` | SVG fractalNoise at 0.5 opacity |
| Reads as SaaS | Inter only | Add serif + mono, three-stack |

---

## Case study

Apple uses this on Vision Pro pages, Mac mini reveal, iPhone product galleries. The pattern is well-trodden. Sigillerie picks it when the brand earns restraint, not as a default.

For true depth (parallax that reads on movement, not just on tilt), see `modes/three3d/recipes.md`. CSS perspective is convincing in screenshots, three.js is convincing in motion.

For pacing across all hero animation work (entry timing, hold durations, exit grace), see `modes/producer/animation-best-practices.md`.
