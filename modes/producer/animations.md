---
name: animations
description: Stage and Sprite primitives, useTime, interpolate, Easing helpers, page contract integration. Stage3D extension lives in modes/three3d/page-contract.md.
---

# Animations

Timeline engine for single-file HTML deliverables. Stage holds the clock, Sprite owns a window of that clock, components inside read local progress and paint. Lives in `assets/animations.jsx`. Mounts on `window.Animations`.

Borrowed thinking from Remotion and After Effects. Zero deps. Runs in any browser that runs React 18.

## Setup

Load order matters. React, ReactDOM, Babel standalone, then `animations.jsx`. Pinned versions only. See `react-setup.md` for the full contract.

```html
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
<script type="text/babel" src="animations.jsx"></script>
```

`animations.jsx` exposes its API on `window.Animations`. Pull it in any later script:

```jsx
const { Stage, Sprite, useTime, useSprite, Easing, interpolate } = window.Animations;
```

Per-script scope still applies (Rule 2 in `react-setup.md`). If you define `Title` in `components.jsx`, end that file with `Object.assign(window, { Title })` so `pages.jsx` can mount it.

## The Time-Slice Model

One clock, many windows.

`<Stage duration={N}>` runs a clock from 0 to N seconds, looping by default. It also auto-scales a 1920x1080 canvas to the viewport, draws play/pause and a scrubber, and waits for `document.fonts.ready` before frame 0.

`<Sprite start={a} end={b}>` mounts only when `a <= time < b`. Inside the Sprite, `useSprite()` returns its local state:

```js
{
  t,         // 0 -> 1, normalized progress through this Sprite
  elapsed,   // seconds since this Sprite started
  duration,  // end - start
  start,     // global start time (s)
  end,       // global end time (s)
}
```

Outside a Sprite, `useSprite()` returns zeros. `useTime()` returns the global clock (seconds) from any descendant of `<Stage>`.

`interpolate(t, [in0, in1], [out0, out1], easing?)` clamps at both ends and applies easing in between. The clamping is what lets you write phased animations without min/max gymnastics.

## Skeleton

```jsx
const { Stage, Sprite, useSprite, Easing, interpolate } = window.Animations;

function Title() {
  const { t } = useSprite();
  const opacity = interpolate(t, [0, 1], [0, 1], Easing.expoOut);
  const y = interpolate(t, [0, 1], [40, 0], Easing.expoOut);
  return (
    <h1 style={{ opacity, transform: `translateY(${y}px)`, fontSize: 120, fontWeight: 900 }}>
      Hello.
    </h1>
  );
}

function Scene() {
  return (
    <Stage duration={10}>
      <Sprite start={0} end={3}><Title /></Sprite>
      <Sprite start={2} end={5}><Subtitle /></Sprite>
    </Stage>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Scene />);
```

## Easing

```js
Easing.linear        // constant velocity
Easing.easeIn        // slow start, used for exits
Easing.easeOut       // slow end
Easing.easeInOut     // slow start and end
Easing.expoOut       // primary easing, cubic-bezier(0.16, 1, 0.3, 1) feel
Easing.overshoot     // toggles, badges, button pops
Easing.spring        // bouncy settle
Easing.anticipation  // pull-back then forward
```

Default to `expoOut` for entrances, `easeIn` for exits, `overshoot` for interactive feedback. Reach for `spring` only when the motion needs weight.

## Patterns

Cascading reveal (overlap windows so phases hand off):

```jsx
<Stage duration={20}>
  <Sprite start={0} end={4}><Problem /></Sprite>
  <Sprite start={4} end={10}><Approach /></Sprite>
  <Sprite start={10} end={16}><Result /></Sprite>
  <Sprite start={0} end={20}><Caption /></Sprite>
</Stage>
```

Staggered intro (offset child Sprites):

```jsx
<Stage duration={6}>
  {items.map((item, i) => (
    <Sprite key={i} start={i * 0.15} end={6}>
      <Card item={item} />
    </Sprite>
  ))}
</Stage>
```

Scene transition (cross-fade by overlapping two Sprites and easing both):

```jsx
function FadeShell({ children }) {
  const { t, duration } = useSprite();
  const opacity = interpolate(
    t,
    [0, 0.3, (duration - 0.5) / duration, 1],
    [0, 1, 1, 0],
    Easing.easeInOut
  );
  return <div style={{ opacity }}>{children}</div>;
}
```

Typewriter and counter still work the same way: use `t`, derive a discrete value, render.

## Recording Mode

Stage implements the `__ready` / `__recording` handshake for `scripts/render-video.js`. Contract, root causes, starter template: `animation-pitfalls.md` sections 12-13. Recorder-side flow: `video-export.md`.

You do not write this handshake. You inherit it by using `<Stage>`. Just keep custom font loads in CSS so `document.fonts.ready` covers them.

## What's New In Sigillerie

Sigillerie's `animations.jsx` adds `pixelRatio` on `<Stage>`. The Stage canvas is a CSS-scaled box, so a child WebGL canvas wrapped in a Sprite has no way to know the device pixel ratio of the eventual export target. Pass `pixelRatio` and any 3D child can read it from context to size its backbuffer correctly.

```jsx
<Stage duration={12} pixelRatio={2}>
  <Sprite start={0} end={12}>
    <ThreeScene />
  </Sprite>
</Stage>
```

This is the seam the 3D track plugs into. The full Stage3D and Sprite3D extension (async-asset awaiting, deterministic `__renderFrame(t)` for capture, pixelRatio plumbing into the WebGL renderer) is documented in `modes/three3d/page-contract.md`. The 2D Stage in this file is the contract Stage3D extends.

## Pitfalls

Animate `transform` and `opacity` only. `top`, `left`, `width`, `height`, `margin` trigger layout and tank the framerate.

Sprites unmount at `end`. State inside a Sprite resets when it remounts on the next loop. Hoist persistent state to a parent Sprite that wraps the whole timeline.

`useSprite()` outside a Sprite returns `{ t: 0, elapsed: 0, duration: 0 }`. If a component animates with t=0 forever, you forgot the wrapping `<Sprite>`.

A single narrative beat over 10 seconds loses the viewer. Split into two Sprites with a hand-off.

For export pipelines and frame-accurate capture, see `video-export.md`. For the React/Babel scope rules that make multi-file `.jsx` work, see `react-setup.md`. For 3D-specific extensions, see `modes/three3d/page-contract.md`.
