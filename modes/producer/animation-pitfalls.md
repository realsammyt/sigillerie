---
name: animation-pitfalls
description: 14 numbered animation pitfalls plus 3D additions, each from a real failure mode, with detection and fix rules
---

# Animation Pitfalls

Each rule below comes from a real failure that cost real time. Read this before writing animation code. One pass through saves an iteration round.

## 1. Stacking context, `position: relative` is mandatory

**Looks like**: a wrapper holds three absolute children. Wrapper has no `position` set. Children take `.canvas` as their coordinate root and float 200px off screen.

**Why**: `position: absolute` resolves against the nearest positioned ancestor. Without one, it walks up to `<body>` or the viewport.

**Detect**: any time you write `position: absolute` on a child, scan ancestors. The closest positioned one is the coordinate root. Confirm that's what you want.

**Fix**: any container that holds absolute children needs `position: relative`. Even if you don't visually offset it, write it as the anchor. Reflex move.

## 2. Character traps, do not depend on rare Unicode

**Looks like**: rendering `␣` (U+2423 OPEN BOX) to visualize a space token. Noto Serif SC and Cormorant Garamond have no glyph for it. Output is a tofu square or blank.

**Why**: design fonts cover a small Unicode subset. Control pictures, command keys, and many symbols fall through to system fallback or fail entirely.

**Detect**: open the rendered HTML in your target font. If the glyph looks different from your editor preview, it's a fallback.

**Fix**: every character in the animation must exist in the chosen font. Avoid `␣ ␀ ␐ ␋ ↩ ⏎ ⌘ ⌥ ⌃ ⇧`. For meta characters (space, return, tab), build a CSS box:

```html
<span class="space-key">Space</span>
```
```css
.space-key {
  display: inline-flex;
  padding: 4px 14px;
  border: 1.5px solid var(--accent);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.3em;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
```

Verify emoji too. Some fall back to gray boxes outside Noto Emoji.

## 3. Data-driven Grid and Flex templates

**Looks like**: `const N = 6` in JS, but `grid-template-columns: 80px repeat(5, 1fr)` in CSS. The sixth token has no column. Whole matrix shifts.

**Why**: hand-counted CSS templates drift from data. The moment N changes, CSS lies.

**Detect**: any time CSS contains a literal count that mirrors a JS array length, treat it as a bug.

**Fix**: pipe the count through a CSS variable.

```js
el.style.setProperty('--cols', N);
```
```css
.grid { grid-template-columns: 80px repeat(var(--cols), 1fr); }
```

Or use `grid-auto-flow: column` and let the browser expand. Ban the "fixed number plus JS constant" combo.

## 4. Scene transitions need to overlap

**Looks like**: zoom1 fades out at 19s over 0.6s, zoom2 fades in at 19.4s over 0.6s plus a 0.2s stagger. About 1 second of pure blank screen. Viewers think the video froze.

**Why**: sequential fades leave a gap. Human eye reads any blank longer than 0.3s as broken.

**Detect**: chart your fade in / fade out start times. If out_start + out_duration < in_start, you have a gap.

**Fix**: cross-fade. Start the next scene's fade in before the previous scene finishes fading out.

```js
// bad
if (t >= 19) hideZoom('zoom1');
if (t >= 19.4) showZoom('zoom2');  // 0.4s blank gap

// good
if (t >= 18.6) hideZoom('zoom1');
if (t >= 18.6) showZoom('zoom2');  // cross-fade
```

Or anchor with a persistent element (the main sentence) that briefly returns during the swap.

## 5. Pure render principle, animation state must be seekable

**Looks like**: `setTimeout` plus `fireOnce(key, fn)` for chained state changes. Live playback works. Frame-by-frame capture or seek to any timestamp breaks because past `setTimeout` calls already fired and cannot rewind.

**Why**: side effects break time travel. Once a class is added, only an explicit reset removes it.

**Detect**: try seeking backwards from t=20 to t=5. If state is wrong, render is impure.

**Fix**: `render(t)` should be a pure function. If side effects are required, pair them with a reset.

```js
const fired = new Set();
function fireOnce(key, fn) { if (!fired.has(key)) { fired.add(key); fn(); } }
function reset() { fired.clear(); /* clear all .show classes */ }
window.__seek = (t) => { reset(); render(t); };
```

Avoid `setTimeout` longer than 1 second inside render logic. Seek-back will desync.

## 6. Measuring before fonts load gives wrong values

**Looks like**: `DOMContentLoaded` triggers `charRect(idx)` to position brackets. Fonts haven't loaded. Each character is fallback width. About 500ms later fonts arrive but the bracket positions stay frozen.

**Why**: `getBoundingClientRect` and `offsetWidth` reflect current layout. Layout depends on the active font.

**Detect**: visual offset that survives reload. Bracket sits next to the wrong character.

**Fix**: wrap any measurement code in `document.fonts.ready.then()`.

```js
document.fonts.ready.then(() => {
  requestAnimationFrame(() => {
    buildBrackets(...);
    tick();
  });
});
```

The extra `requestAnimationFrame` gives the browser one frame to commit layout.

## 7. Recording prep, give the exporter handles

**Looks like**: Playwright `recordVideo` runs at 25fps and starts when the context is created. Page load and font load take 2 seconds. Final MP4 has 2 seconds of blank or flash at the head.

**Why**: video recording starts before the animation does.

**Detect**: extract frame 0 with ffmpeg. If it's blank or mid-load, the head is dirty.

**Fix**: use `render-video.js` which does warmup, load page, reload to restart animation, wait duration, then ffmpeg trim head and convert to H.264 MP4. Frame 0 of the animation must be the final initial state, fully composed. For 60fps use ffmpeg `minterpolate` post-processing. For GIF, two-stage palette (`palettegen` plus `paletteuse`).

See `video-export.md` for full invocation.

## 8. Batch export, tmp directories need PID

**Looks like**: three `render-video.js` processes run in parallel, each on a different HTML. `TMP_DIR` uses `Date.now()` only. Same millisecond start, same dir. First to finish cleans up. Other two crash with `ENOENT`.

**Why**: time-only naming collides under concurrency.

**Detect**: random `ENOENT` on parallel runs.

**Fix**: tmp dirs must include PID or random suffix.

```js
const TMP_DIR = path.join(DIR, '.video-tmp-' + Date.now() + '-' + process.pid);
```

For real parallel batches, use shell `&` plus `wait`, not in-process fork. Three or more files: run serial.

## 9. Recordings include progress bars and replay buttons

**Looks like**: HTML has `.progress`, `.replay`, `.counter` for human debugging. MP4 export bakes them in. Looks like devtools got captured into the video.

**Why**: human chrome and video content share the same DOM.

**Detect**: watch the export. Any UI element that didn't exist in the storyboard is contamination.

**Fix**: tag chrome with `.no-record`. The recorder injects CSS to hide it.

```
.progress .counter .phases .replay .masthead .footer .no-record [data-role="chrome"]
```

Use Playwright `addInitScript` so the rule applies before navigation. Pass `--keep-chrome` to bypass.

## 10. Warmup frame leak, repeated animation at the head

**Looks like**: old flow does `goto, wait fonts 1.5s, reload, wait duration`. Recording started at context creation, so the warmup phase recorded a partial play. After reload, animation restarts from 0. Video shows mid-animation, then a cut, then animation from 0. Repeated feel.

**Why**: warmup and record share one context.

**Fix**: split into two contexts. Warmup context has no `recordVideo`, just loads URL, waits for fonts, closes. Record context has `recordVideo` and starts fresh from t=0.

```js
const warmupCtx = await browser.newContext({ viewport });
const warmupPage = await warmupCtx.newPage();
await warmupPage.goto(url, { waitUntil: 'networkidle' });
await warmupPage.waitForTimeout(1200);
await warmupCtx.close();

const recordCtx = await browser.newContext({ viewport, recordVideo });
const page = await recordCtx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(DURATION * 1000);
await page.close();
await recordCtx.close();
```

ffmpeg `-ss` only trims about 0.3s of startup latency. It cannot mask warmup leakage.

## 11. Do not draw fake chrome inside the canvas

**Looks like**: Stage component already provides scrubber, time code, pause button (all `.no-record`, hidden during export). Designer adds a "magazine page-number style" decorative bar at the bottom showing `00:60 ──── CLAUDE-DESIGN / ANATOMY`. Result: two progress bars. Viewer flags it as a bug.

**Why**: AI loves filler chrome. Page numbers, watermarks, footer credits all sneak in as "polish". They duplicate Stage chrome and violate "earn its place".

**Element ownership test**:

| Belongs to | Action |
|------------|--------|
| A specific scene's narrative | OK, keep |
| Global chrome (controls, debug) | Tag `.no-record`, hide on export |
| Neither scene-narrative nor chrome | Delete. Filler. |

**Self-check before delivery**: pull a still frame. Anything that looks like player UI (horizontal progress bar, time code, control button shape)? If removing it doesn't damage the story, remove it. Same information shown twice (progress, time, attribution) collapses to one place, and that place is chrome.

Counter examples: `00:42 ──── PROJECT NAME` at bottom, `CH 03 / 06` chapter counter, version stamp `v0.3.1` in the corner. All filler.

## 12. Recording head blank plus offset, the `__ready` x tick x lastTick triad

**Bug A (head blank)**: 60s animation exports MP4 with 2 to 3 seconds of blank head. `ffmpeg -ss 0.3` cannot cut it.

**Bug B (start offset, real incident 2026-04-20)**: 24s export felt like the animation started 19 seconds in. Animation actually began recording at t=5, ran to t=24, looped to t=0, recorded the next 5 seconds. So the visible "opening" lived in the final 5 seconds of the file.

**Root cause** (both bugs share it): Playwright `recordVideo` writes WebM from `newContext()`. Babel, React, fonts cost L seconds (2 to 6). The recorder waits for `window.__ready = true` as the "animation starts here" anchor. It must pair with animation `time = 0` exactly. Two common mistakes:

| Wrong | Symptom |
|-------|---------|
| `__ready` set in `useEffect` or sync setup, before tick frame 1 | Recorder thinks animation started, WebM still capturing blank, head blank |
| `lastTick = performance.now()` initialized at script top level | Font load L seconds counted into first frame's `dt`, `time` jumps to L, video lags by L |

**Correct starter tick template** (every hand-written animation needs this skeleton):

```js
// state
let time = 0;
let playing = false;   // do not play until fonts ready
let lastTick = null;   // sentinel, first-frame dt forced to 0
const fired = new Set();

// tick
function tick(now) {
  if (lastTick === null) {
    lastTick = now;
    window.__ready = true;   // pair: recorder anchor and t=0 same frame
    render(0);
    requestAnimationFrame(tick);
    return;
  }
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  if (playing) {
    let t = time + dt;
    if (t >= DURATION) {
      t = window.__recording ? DURATION - 0.001 : 0;
      if (!window.__recording) fired.clear();
    }
    time = t;
    render(time);
  }
  requestAnimationFrame(tick);
}

// boot
document.fonts.ready.then(() => {
  render(0);
  playing = true;
  requestAnimationFrame(tick);
});

// seek hook for render-video.js
window.__seek = (t) => { fired.clear(); time = t; lastTick = null; render(t); };
```

**Recorder side defenses**:
1. `addInitScript` injects `window.__recording = true` before `goto`.
2. `waitForFunction(() => window.__ready === true)`, record offset for ffmpeg trim.
3. After `__ready`, call `page.evaluate(() => window.__seek && window.__seek(0))` to force time to 0. Second line of defense for HTML that didn't follow the template.

**Verify**: extract frame 0 and frame end with ffmpeg. Frame 0 must be t=0 initial state. Frame end must be the animation's true final state, not a second-loop midpoint.

## 13. Recording must disable loops, the `window.__recording` handshake

**Looks like**: Stage default `loop=true` for browser preview. `render-video.js` waits duration plus 300ms buffer. Stage enters next loop in those 300ms. ffmpeg `-t DURATION` truncation lands inside loop 2. Final 0.5 to 1 second cuts back to scene 1. Looks like a bug.

**Why**: no handshake between recorder and HTML. HTML doesn't know it's being recorded.

**Fix**:

1. Recorder injects `window.__recording = true` via `addInitScript` before `goto`.

```js
await recordCtx.addInitScript(() => { window.__recording = true; });
```

2. Stage reads the signal and forces `loop=false`.

```js
const effectiveLoop = (typeof window !== 'undefined' && window.__recording) ? false : loop;
if (next >= duration) return effectiveLoop ? 0 : duration - 0.001;
```

3. Final-Sprite `fadeOut={0}` in record mode. Otherwise the video fades to dark instead of holding the last frame.

**Verify**: `ffmpeg -ss 19.8 -i video.mp4 -frames:v 1 end.png`. The last 0.2s should still show the expected final frame.

## 14. 60fps default to frame duplication, not minterpolate

**Looks like**: `convert-formats.sh` produces 60fps via `minterpolate=fps=60:mi_mode=mci`. Some macOS QuickTime and Safari versions refuse to play (black frame, or won't open). VLC and Chrome play fine.

**Why**: minterpolate's H.264 stream contains SEI / SPS fields some players choke on.

**Fix**: default 60fps uses simple `fps=60` filter (frame duplication). Compatible across QuickTime, Safari, Chrome, VLC. Only enable `--minterpolate` after testing target players. The 60fps tag matters mainly for upload platform algorithms (Bilibili, YouTube). For CSS animations the perceived smoothness gain is small. Add `-profile:v high -level 4.0` for broader H.264 reach.

```bash
bash convert-formats.sh input.mp4 --minterpolate
```

## 3D pitfalls

WebGL canvases inside Stage-scaled containers introduce a fresh class of bugs. Full coverage in `modes/three3d/pitfalls.md`. The four most common cross-domain failures:

**15. Pixel-ratio mismatch in scaled containers**. Stage applies CSS `transform: scale()` to fit the viewport. WebGL canvas backing-store size stays at `devicePixelRatio` of the unscaled root. Result: canvas renders crisp on the GPU, then gets bilinear-scaled down by CSS. Looks soft. Fix in `modes/three3d/page-contract.md`: read the live transform scale and multiply into `renderer.setPixelRatio(window.devicePixelRatio * stageScale)`.

**16. Time source breaks deterministic capture**. `Date.now()` and `THREE.Clock.getDelta()` both read wall-clock time. Recorder paces frames at 25fps. Wall clock advances faster than frame rate, animation desyncs from video time. Fix: route all 3D time through `__renderFrame(t)` which the recorder calls per frame. Same contract as the 2D `render(t)` from pitfall 5.

**17. Async assets not awaited before `__sceneReady`**. GLTFLoader, texture loaders, and font loaders all return promises. If `window.__sceneReady = true` fires before they resolve, the recorder captures placeholder geometry or missing textures. Fix: `await Promise.all([gltfPromise, texturePromise, fontsReady])` then set `__sceneReady`. Same shape as pitfall 12's `__ready` pairing.

**18. Render loop not gated by `window.__recording`**. Three.js `setAnimationLoop` keeps drawing on its own clock. When the recorder finishes its window, the loop is still firing. If the recorder's stop logic is loose, the tail of the video catches a half-rendered frame from the next loop iteration. Fix: gate the loop the same way Stage does. `const effectiveLoop = window.__recording ? false : loop;` Already covered in `assets/animations.jsx` Stage code, but worth naming it as a 3D pitfall too because most 3D authors write a fresh loop instead of using Stage.

## Western case study: Linear's smooth scroll regressions

Linear (linear.app) shipped a marketing page with momentum-scroll on a virtualized list. On certain trackpad gestures, scroll velocity overshot the list bounds and snapped back. The bug only reproduced on macOS Safari, only at specific DPRs. The fix mirrors pitfall 5 and 12: compute scroll position from a single time source (the rAF tick), not from event-driven velocity accumulation. State must be derivable from t.

Stripe's animation library `@stripe/animation` ships a small subset of GSAP because they hit pitfall 4 at scale: scenes that fade independently rack up combined gap latency across a long page. Their library forces overlap by default.

Anthropic's model release reveal animations (the Claude landing pages) use a single deterministic clock driving every layer. Hover and scroll merely seek that clock. This is pitfall 5 taken to its endpoint: pure `render(t)` is the only way to make a marketing page that records cleanly across every viewport size.

## Pre-flight checklist (5 seconds)

- Every `position: absolute` parent has `position: relative`?
- Every special character (`␣`, `⌘`, emoji) exists in the chosen font?
- Grid / Flex template count matches JS data length?
- Scene transitions cross-fade with no gap longer than 0.3s?
- DOM measurement code wrapped in `document.fonts.ready.then()`?
- `render(t)` is pure or has explicit reset?
- Frame 0 is the full initial state, not blank?
- No fake chrome (progress bar, time code, attribution strip) competing with Stage scrubber?
- Tick frame 1 sets `window.__ready = true` paired with t=0?
- Stage reads `window.__recording` and forces `loop=false`?
- Final Sprite `fadeOut={0}` so the video holds the last frame?
- 60fps MP4 uses frame duplication unless `--minterpolate` was tested on target players?
- Frame 0 and frame end extracted post-export, both verified?
- Single-file delivery: `animations.jsx` is inlined, not `src="..."` (file:// CORS)?
- Cross-scene elements (chapter labels, watermark, scene number) have no hard-coded color, visible against every scene background?
- 3D scene: pixel ratio multiplies stage scale, time routes through `__renderFrame(t)`, async assets awaited before `__sceneReady`, loop gated by `__recording`?
