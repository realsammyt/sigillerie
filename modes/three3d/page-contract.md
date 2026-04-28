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

Scene length in seconds. Lets the recorder stop early without hitting a timeout. Optional but recommended; default fallback is 30 s.

### `window.__audioCues`

Array of cues. Each: `{t: <seconds>, type: 'sfx' | 'bgm', file?: <path>, position?: [x, y, z]}`. The recorder writes a sidecar JSON to `add-music.sh` which mixes audio offset-aware. `position` (when present) routes through `PositionalAudio` for HRTF panning. See `spatial-audio.md`.

### `window.__audioRuntime`

Tells the recorder which audio capture path to use:

- `"static"`, only files referenced. `add-music.sh` mixes from disk.
- `"tone"`, Tone.js synthesis at runtime. Needs `--mode=tone` capture, MediaStreamAudioDestinationNode → MediaRecorder OPUS → ffmpeg AAC remux.
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

`verify.py` greps for these patterns. CI fails if any appear in a 3D scene file.

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

All four are caught by `verify.py` lint rules. Fix is the conformant skeleton above.

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

Track B's `webxr-bundle.js` build emits the contract automatically when the entry uses `<XR>` or `<Canvas frameloop="demand">`.

## `<model-viewer>` (easy path) contract

`<model-viewer>` is special. The recorder handles it without `__renderFrame`. The page just needs:

```js
const mv = document.querySelector('model-viewer');
mv.addEventListener('load', () => {
  window.__sceneReady = true;
  window.__ready = true;
  window.__duration = 8;  // matches auto-rotate cycle
});
```

The recorder pulls turntable frames via `mv.toBlob({ idealAspect: true })` at virtual time stops. No CDP `beginFrame` needed. See `model-viewer.md`.

## Cross-references

- 12 named 3D pitfalls including the four FAILs above: `pitfalls.md`
- Audio cue schema: `spatial-audio.md`, `capabilities/generative-audio/capture-pipeline.md`
- Recipe code that conforms by construction: `recipes.md`
- 2D version of the seekable-render rule: `modes/producer/animation-pitfalls.md` § 5 and § 12
- Recorder source: `scripts/render-video.js`
- Lint rules: `capabilities/_shared/verifier-rules.md`
