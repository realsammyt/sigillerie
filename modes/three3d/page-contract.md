---
name: page-contract
description: The 3D page contract. window.__ready, __recording, __sceneReady, __renderFrame, __duration, __audioCues, __audioRuntime, __capabilities. Producer and consumer rules.
---

# 3D Page Contract

The handshake between any 3D HTML deliverable and the recording pipeline. Extends the 2D `__ready` / `__recording` convention from `SKILL.md`. Every 3D page must satisfy this, or `verify.py` fails the build.

## The eight variables

| Variable | Type | Required for 3D? | Set by | Read by |
|---|---|---|---|---|
| `window.__ready` | bool | yes | page (boot) | recorder (warmup gate) |
| `window.__recording` | bool | reads only | recorder (`addInitScript`) | page (gate loop, hide chrome) |
| `window.__sceneReady` | bool | **yes** | page (after assets resolve) | recorder (capture gate) |
| `window.__renderFrame(t_ms)` | function | **yes** | page | recorder (per frame) |
| `window.__duration` | number (s) | recommended | page | recorder (stop time) |
| `window.__audioCues` | `[{t, type, file?, position?}]` | optional | page | `add-music.sh` |
| `window.__audioRuntime` | "static" / "tone" / "wam2" | required if synth | page | recorder (capture path) |
| `window.__capabilities` | `{webgpu, webxr, modelViewer, audio}` | optional | page (boot) | recorder (introspection) |

## What each one means

### `window.__ready`

First paint complete. Fonts loaded. DOM committed. Same as 2D.

For 3D: do **not** set `__ready` until both fonts and the canvas mount. The recorder warmup waits for this.

### `window.__recording`

The recorder injects `__recording = true` via `addInitScript` before navigation. The page reads it and gates anything that breaks deterministic capture:

- Disable orbit controls, auto-rotate, momentum scroll
- Force `loop = false`
- Hide loaders, debug HUDs, dev controls
- Skip any `setInterval` driven by wall-clock

Page never sets this. Only reads.

### `window.__sceneReady`

3D-specific. The signal that **every async asset is loaded and parsed**. GLTF, textures, HDRI, fonts, audio buffers. Set after `await Promise.all([...])`.

The recorder waits for `__ready === true && __sceneReady === true` before stepping the first frame. If a page sets `__sceneReady = true` before `await` resolves, the recorder captures placeholders or missing geometry.

### `window.__renderFrame(t_ms)`

The deterministic frame entry point. The recorder calls it once per frame with virtualized time `t_ms`. The function must:

1. Set every uniform, mixer, tween, camera position, and animation clip from `t_ms`.
2. Call `renderer.render(scene, camera)` synchronously before returning.
3. Never read `Date.now()`, `performance.now()`, or `Clock.getDelta()`.

Pure function of `t`. State derives from time, never from event accumulation. Same rule as 2D pitfall 5 (seekable render). Page authors a single source of truth.

### `window.__duration`

Scene length in seconds. Lets the recorder stop early without hitting a timeout. Optional but recommended; default fallback is 10 s. The recorder reads it after the ready gates, so setting it during async boot (before `__ready` / `__sceneReady`) is fine.

### `window.__audioCues`

Array of cues. Each: `{t: <seconds>, type: 'sfx' | 'bgm', file?: <path>, position?: [x, y, z]}`. The recorder does NOT write a sidecar. The agent authors the sidecar JSON from `__audioCues` by hand (`verify.py` reports the cue count only). `add-music.sh` reads it: auto-detects `<video>.mp4.audio-cues.json` next to the rendered MP4 (full basename including `.mp4`), or takes `--sfx-cues=<path>`. `position` (when present) routes through `PositionalAudio` for HRTF panning. See `spatial-audio.md` (stub today).

### `window.__audioRuntime`

Tells the recorder which audio capture path to use:

- `"static"`, only files referenced. `add-music.sh` mixes from disk.
- `"tone"`, Tone.js synthesis at runtime. Needs `--mode=tone` capture (html capture with `--audio=tone` implied), MediaStreamAudioDestinationNode → MediaRecorder OPUS → ffmpeg AAC remux. Known limitation: in 3d mode (`--mode=3d --audio=tone`) audio records in wall-clock time while video runs on a virtual clock, so A/V sync holds only when capture keeps pace with real time; slow captures drift and cannot be repaired in post.
- `"wam2"`, roadmap; WAM2 plugin host. Not in v1.

Default `"static"`.

### `window.__capabilities`

Boot-time introspection. The recorder logs it. Useful for CI heatmaps:

```js
window.__capabilities = {
  webgpu: !!navigator.gpu,
  webxr: !!navigator.xr,
  modelViewer: 'customElements' in window && !!customElements.get('model-viewer'),
  audio: window.__audioRuntime || 'static',
};
```

Optional. Recorder works without it.

## 3D-specific obligations

These three rules are non-negotiable.

### 1. Define `__renderFrame`

Every 3D page must expose `window.__renderFrame(t_ms)`. The function is the only place the renderer is called. No `setAnimationLoop`, no `requestAnimationFrame` driving render. Stage3D installs the rAF loop externally and calls `__renderFrame` from inside it during interactive playback. The recorder calls `__renderFrame` directly during capture.

Browsers can drop frames inside headless Chromium; rAF is not guaranteed at 60 Hz. The deterministic capture path uses CDP `HeadlessExperimental.beginFrame` and feeds virtual `t_ms` values. If the page reads wall-clock anywhere, capture desyncs.

### 2. Await every asset before `__sceneReady`

```js
const [gltf, hdri] = await Promise.all([
  gltfLoader.loadAsync('hero.glb'),
  rgbeLoader.loadAsync('env.hdr'),
]);
await document.fonts.ready;
// scene setup...
window.__sceneReady = true;
```

The classic failure: a `useEffect` calls `gltfLoader.load(url, onLoad)` (callback form), and the next line sets `__sceneReady = true`. The recorder fires before `onLoad` runs. Capture is broken. Use `loadAsync` and `await Promise.all`.

### 3. Never use wall-clock timers

Banned in 3D pages:

- `Date.now()`
- `performance.now()` for animation timing (OK for one-shot perf marks, never inside `__renderFrame`)
- `THREE.Clock`, `clock.getDelta()`, `clock.getElapsedTime()` driving any uniform or mixer
- `setInterval` / `setTimeout` for animation phases longer than a single tick

Permitted:

- Reading `t_ms` from `__renderFrame` parameter
- One-time setup inside `await` before `__sceneReady`

Convention, hand-check. `verify.py` does NOT scan source for these patterns today. It checks the contract at runtime only: `__ready` / `__sceneReady` gates, `__renderFrame`-is-a-function, a `__renderFrame(0)` smoke call, image / font / network asset gates, console-error gates. Grep your scene file for this list yourself before running `verify.py`.

## A conformant page (Track A skeleton)

```html
<!doctype html>
<html>
<head>
  <script type="importmap">
    { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.181/build/three.module.js" } }
  </script>
</head>
<body>
  <canvas id="c"></canvas>
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    THREE.ColorManagement.enabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100);
    camera.position.set(0, 1, 4);

    let mixer, model;

    async function boot() {
      const [gltf, hdri] = await Promise.all([
        new GLTFLoader().loadAsync('hero.glb'),
        new RGBELoader().loadAsync('env.hdr'),
      ]);
      await document.fonts.ready;

      scene.environment = hdri;
      scene.environment.mapping = THREE.EquirectangularReflectionMapping;
      model = gltf.scene;
      scene.add(model);
      mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();

      window.__duration = 12;
      window.__audioCues = [{ t: 2.0, type: 'sfx', file: 'whoosh.mp3' }];
      window.__capabilities = { webgpu: !!navigator.gpu, webxr: !!navigator.xr, audio: 'static' };

      window.__renderFrame = (t_ms) => {
        const t = t_ms / 1000;
        // pure function of t, every uniform/clip set from t
        if (mixer) {
          mixer.setTime(t);  // NOT update(dt). setTime() is seekable.
        }
        model.rotation.y = t * 0.5;
        renderer.render(scene, camera);
      };

      window.__sceneReady = true;
      window.__ready = true;
      window.__renderFrame(0);  // commit initial frame

      if (!window.__recording) {
        // interactive loop only when not recording
        const loop = (t_ms) => {
          if (window.__recording) return;  // recorder takes over
          window.__renderFrame(t_ms);
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }
    }

    boot();
  </script>
</body>
</html>
```

The `three@0.181` pin is deliberate. Shipped assets pin the same release (`assets/three3d-loader.js` import map, `assets/three-helpers.js` DRACO decoder path). Current three is r185 (2026-07); do not bump the pin here alone. To bump: update this pin and the asset pins together, read the three.js migration guide for r182-r185, then re-run `verify.py --3d` and a capture pass.

What's right:

- `loadAsync` + `Promise.all` before `__sceneReady`
- `mixer.setTime(t)` instead of `mixer.update(dt)` (seekable)
- Rotation derives from `t`, not from accumulating per-frame deltas
- `__renderFrame` calls `render` synchronously
- Interactive loop bails when `__recording` flips on

## A broken page (the four common failures)

```html
<script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16/9, 0.1, 100);
  const clock = new THREE.Clock();  // FAIL 1: wall-clock time source

  let model;
  new GLTFLoader().load('hero.glb', (gltf) => {  // FAIL 2: callback, not awaited
    model = gltf.scene;
    scene.add(model);
  });

  window.__sceneReady = true;  // FAIL 3: set before loader callback fires
  window.__ready = true;

  function animate() {
    requestAnimationFrame(animate);  // FAIL 4: loop never gated by __recording
    const dt = clock.getDelta();      // FAIL 1 again
    if (model) model.rotation.y += dt * 0.5;
    renderer.render(scene, camera);
  }
  animate();
</script>
```

Symptoms:

- Recorder stops after first asset returns missing texture (FAIL 2 + 3 race)
- MP4 has 2 s of empty scene at head before model pops in (FAIL 3)
- Capture desyncs from interactive playback by ~0.4 s over 12 s (FAIL 1)
- Last 0.5 s of MP4 catches a half-rendered frame from second loop iteration (FAIL 4)

`verify.py` has no lint rules and does not reliably catch any of these four. FAIL 2 and 3 surface only indirectly, when the asset request itself fails (network 4xx gate or console-error gate); a slow-but-successful load behind a premature `__sceneReady` passes cleanly. FAIL 1 and 4 are never caught (`render-video.js` neutralizes wall-clock and rAF at capture time, which masks rather than detects them). Hand-check against the conformant skeleton above.

## Track B (R3F) contract

Same eight variables. R3F sets them inside the root component:

```jsx
function Scene() {
  const { gl, scene, camera } = useThree();
  const { progress } = useProgress();

  useEffect(() => {
    if (progress === 100) {
      window.__sceneReady = true;
      window.__renderFrame = (t_ms) => {
        // walk scene graph, set animations from t_ms
        gl.render(scene, camera);
      };
      window.__ready = true;
    }
  }, [progress]);

  // disable R3F's internal frame loop during recording
  useFrame((state) => {
    if (window.__recording) return;
    // interactive only
  });
  // ... scene contents
}
```

Track B tooling is planned, not shipped (`scripts/webxr-bundle.js` does not exist yet, `assets/r3f-starter/` is empty). When it lands, the build will emit the contract automatically for entries using `<XR>` or `<Canvas frameloop="demand">`. Until then, wire the contract by hand as above.

## `<model-viewer>` (easy path) contract

The recorder (`render-video.js`) has NO model-viewer-specific path. Two capture options:

| Page shape | Capture path | Determinism |
|---|---|---|
| No `__renderFrame` | auto-detect picks html mode, Playwright `recordVideo` | wall-clock; auto-rotate captured in real time |
| `__renderFrame(t_ms)` shim sets `mv.cameraOrbit` (and `mv.currentTime`) as a pure function of `t_ms` | 3d mode, CDP `beginFrame` | deterministic |

Minimum page wiring either way:

```js
const mv = document.querySelector('model-viewer');
mv.addEventListener('load', () => {
  window.__sceneReady = true;
  window.__ready = true;
  window.__duration = 8;  // matches auto-rotate cycle
});
```

Set `__sceneReady` in the `load` handler as above. For deterministic turntables, add the `__renderFrame` shim; without it the export drifts with wall-clock. `model-viewer.md` is a stub today; this section is the contract.

## Cross-references

- 12 named 3D pitfalls including the four FAILs above: `pitfalls.md`
- Audio cue schema: `spatial-audio.md`, `capabilities/generative-audio/capture-pipeline.md`
- Recipe code that conforms by construction: `recipes.md`
- 2D version of the seekable-render rule: `modes/producer/animation-pitfalls.md` § 5 and § 12
- Recorder source: `scripts/render-video.js`
- Runtime gate: `scripts/verify.py` (no static lint exists today; `capabilities/_shared/verifier-rules.md` is a Phase 11 stub)
