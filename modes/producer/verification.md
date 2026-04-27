---
name: verification
description: Playwright-based validation patterns before delivery. Page contract assertions, console-error checks, screenshot diffs, click-flow tests for prototypes.
---

# verification

Last pass before delivery. Open the HTML in Playwright, assert the page contract, screenshot, log console errors. No agent ships without a human glancing at the actual output.

The harness gate `scripts/run-gates.mjs --gate=run` calls into this logic. This doc is the runtime contract producers must hit. The gate is the automation that fails the build when they don't.

## Why this exists

A file that opens silently in Chrome can still be broken. White screen from a JS throw. Fonts that never loaded. A 3D scene stuck on frame 0. An app prototype where tapping the CTA does nothing. Static screenshots lie. Verification is the layer that catches what the eye misses on a first look.

## The checklist

Run this against every deliverable before it leaves the studio.

### 1. Console errors: zero

Open headless. Listen for `console.error` and `pageerror`. Any single error fails the gate. Common offenders: missing CDN integrity hashes, JSX syntax that babel.min swallows but the runtime rejects, a `const styles = {...}` collision, a component that forgot to attach to `window`.

### 2. Network: no broken images, no failed fonts

Hook the request listener. Anything returning 4xx or 5xx fails. Especially: image CDNs (Wikimedia, Met, Unsplash), Google Fonts, locally-bundled woff2 paths.

### 3. Fonts loaded before paint

`document.fonts.ready` resolves. Then check the page set its readiness flag.

### 4. Animations reach end state

For looped animation: sample two screenshots, one second apart, after settle. They should be visually similar (the loop is steady) or the animation should clearly progress (no freeze on frame 0). For one-shot intros: wait the full duration plus 500ms, then assert the end-state DOM.

### 5. Page contract assertions (Sigillerie)

Every Sigillerie deliverable exposes a small set of window globals. The verifier reads them. The deliverable that omits them fails.

```js
// after fonts and any async setup
window.__ready === true
```

The recorder writes a flag and the page must respect it. Use this to disable autoplay loops or noisy tickers during MP4/GIF capture:

```js
if (window.__recording) {
  // skip the ambient loop, use a deterministic seed
}
```

For 3D scenes, expose a frame-stepper so the recorder can drive time deterministically instead of relying on rAF wallclock:

```js
window.__renderFrame = (t) => { /* render at time t in seconds */ }
window.__sceneReady === true  // after GLTF / textures / shaders compile
```

If the deliverable produces audio that the capture path needs to intercept:

```js
window.__audioRuntime = { ctx, masterGain, /* taps */ }
```

The gate checks each of these for the relevant capability. Missing `__sceneReady` on a 3D scene fails the gate. Missing `__audioRuntime` on a generative-audio deliverable fails the gate. Hi-Fi static pages only need `__ready`.

### 6. Screenshot, full page

`page.screenshot({ path, fullPage: true })`. Saved to `_runtime/verify/<deliverable>/full.png`. Eyeball before shipping.

### 7. Multi-viewport (if responsive)

`1920x1080`, `1440x900`, `768x1024`, `375x667`. Any viewport that visibly breaks fails. Shipping a responsive page that crumbles below 480px is a routine failure mode.

### 8. Click-flow tests for App prototypes

Static screenshots cannot prove an iOS prototype works. The flow:

```
1. Boot. Wait for __ready.
2. Tap home. Assert state changed (URL hash / DOM marker / store value).
3. Tap CTA. Assert the next screen rendered.
4. Tap back. Assert return to home.
5. Screenshot each state.
```

Any tap that fires no handler fails. Any state change that doesn't render fails. See `modes/producer/animation-pitfalls.md` pitfall #11 on duplicate progress bars: a click-flow that advances state but leaves a stale progress indicator visible counts as a fail, not a pass with a cosmetic note.

### 9. Slide decks: page each slide

`?slide=1`, `?slide=2`, ... up to the deck length. Screenshot each. Missing slides, blank slides, slides that error all fail.

## Playwright minimum

```bash
npm i -D playwright
npx playwright install chromium
```

The harness ships a runner. Producers don't write Playwright by hand for every deliverable. Use the gate.

## When verification fails

White screen: console almost always has the answer. Check CDN integrity hashes, JSX syntax, exports to window, naming collisions.

Animation stuck: record a Performance trace. Look for layout thrash. Confirm transforms and opacity carry the motion (GPU path), not width/height/top/left.

Font wrong: confirm `@font-face` URL resolves. Confirm `font-display`. CJK fonts need a fallback that holds the layout while the real font streams.

3D black: `__sceneReady` never flipped true. GLTF path 404'd, or a shader failed to compile, or the camera is inside geometry. Check `__renderFrame(0)` actually paints something.

Audio silent during capture: `__recording` was never read, or `__audioRuntime` exposed the wrong gain node. Recorder taps the master, the page plays from a different chain.

## The human glance

Verification automation catches mechanical failure. It does not catch taste failure. After the gate goes green, open the file in a real browser. Look at it. Click it. If something feels off, it is off. Ship after the eyeball, not before.

A minute of looking saves an hour of rework.
