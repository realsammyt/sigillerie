---
name: color-management
description: Three.js color defaults. SRGBColorSpace output, ACESFilmicToneMapping, ColorManagement.enabled. Texture color spaces. Audio + visual delivery alignment. ffmpeg flags.
---

# 3D Color Management

The defaults that make three.js look right and match the export pipeline. Same rule applies to Track A and Track B. Easy path (`<model-viewer>`) handles this internally; you don't tune it.

## The three lines every 3D page sets

```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
THREE.ColorManagement.enabled = true;
```

That's the baseline. Stage3D sets it. Hand-written 3D scenes must set it explicitly.

## What each does

| Setting | Default in three r170+ | What it does |
|---|---|---|
| `outputColorSpace` | `SRGBColorSpace` | Tags the framebuffer as sRGB so the browser displays it correctly. If you forget this, output looks dim. |
| `toneMapping` | `NoToneMapping` | Maps HDR linear values into 0..1 display range. ACES is the cinematic standard. |
| `toneMappingExposure` | `1.0` | Scalar before tone-mapping. 1.0 is neutral, 0.5 dims, 2.0 brightens. |
| `THREE.ColorManagement.enabled` | `true` (since r152) | Tells three to do all math in linear sRGB and convert at upload/output boundaries. |

These settings are coupled. Changing one without the others double-applies or skips a curve.

## Texture color spaces

Every texture you upload must be tagged with the right color space. Wrong tag = wrong lighting math.

| Texture role | Color space | Why |
|---|---|---|
| Albedo / base color / diffuse | `SRGBColorSpace` | Authored in sRGB, three converts to linear for math |
| Normal map | `LinearSRGBColorSpace` | Encodes geometry, not color. Gamma-correcting it gives wrong surface lighting |
| Roughness | `LinearSRGBColorSpace` | Encodes a 0..1 scalar, no gamma |
| Metalness | `LinearSRGBColorSpace` | Same |
| AO (ambient occlusion) | `LinearSRGBColorSpace` | Same |
| Emissive | `SRGBColorSpace` | Authored as a color, treated like albedo |
| HDR environment (.hdr / .exr) | already linear | RGBELoader/EXRLoader handle this; do not override |
| LUT for custom tone-map | `LinearSRGBColorSpace` | LUT data is not a color |

Code:

```js
import * as THREE from 'three';
import { TextureLoader } from 'three';

const tl = new TextureLoader();

const albedo = await tl.loadAsync('albedo.png');
albedo.colorSpace = THREE.SRGBColorSpace;

const normal = await tl.loadAsync('normal.png');
normal.colorSpace = THREE.LinearSRGBColorSpace;

const roughness = await tl.loadAsync('roughness.png');
roughness.colorSpace = THREE.LinearSRGBColorSpace;
```

GLTFLoader does this automatically when materials are exported correctly from Blender or Substance. If you assign a texture to a custom material, you set the color space yourself.

## Common color failures

### Output looks washed out

**Looks like**: scene is dim, whites are gray, brand colors muted.

**Cause**: tone-mapping running, but texture albedo tagged as `LinearSRGBColorSpace`. The shader reads the raw sRGB-encoded values as linear, applies tone-map, and the curve squashes the middle.

**Fix**: tag albedos as `SRGBColorSpace`.

### Output looks crushed-dark

**Looks like**: shadows clip to black, midtones too dark.

**Cause**: `ColorManagement.enabled = false`. three is doing math in sRGB-encoded space, which is non-linear. Lighting accumulates wrong.

**Fix**: `THREE.ColorManagement.enabled = true`. Set it once at app boot.

### Normal map gives wrong lighting

**Looks like**: surface looks flat or shadows go the wrong direction at glancing angles.

**Cause**: normal map tagged as `SRGBColorSpace`. three gamma-corrects it. The encoded XYZ vectors get squashed.

**Fix**: tag normal maps as `LinearSRGBColorSpace`.

### Tone-map double-applied (the classic bug)

**Looks like**: HDR environment looks washed out. Saturated colors muddy. Bright highlights clip to gray instead of white.

**Cause**: rendering to a `WebGLRenderTarget` in postprocessing, then tone-mapping at composer output, but the render pass already wrote tone-mapped values.

**Fix**:

```js
const renderTarget = new THREE.WebGLRenderTarget(w, h, {
  type: THREE.HalfFloatType,             // keep HDR precision
  colorSpace: THREE.LinearSRGBColorSpace, // intermediate is linear
  samples: 4,
});

const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));   // writes linear
composer.addPass(bloomPass);                       // operates on linear
composer.addPass(new OutputPass());                // applies tone-map + sRGB output
```

`OutputPass` (three r163+) is the canonical end-of-chain pass. It does the tone-map and sRGB encode once. Renderer's `outputColorSpace` and `toneMapping` are bypassed when `OutputPass` is in use; that's correct.

Full pitfall in `pitfalls.md` § 6.

## ACES vs other tone-mappers

| Tone-mapping | When | Notes |
|---|---|---|
| `ACESFilmicToneMapping` | default | Cinematic, S-curve, slight saturation lift. Most flattering for product and hero shots. |
| `AgXToneMapping` | bright HDRI scenes | r170+. Better hue preservation in highlights, less aggressive S-curve. Worth a pass for high-key product. |
| `NeutralToneMapping` | data viz, UI mockups | r170+. Identity-ish. Use when you want the rendered color to match a Figma swatch exactly. |
| `ReinhardToneMapping` | rare | Older, less filmic. Keep ACES unless reviewing a specific look. |
| `LinearToneMapping` | never | Just clips at 1.0. Banding everywhere. |
| `NoToneMapping` | only if `OutputPass` is doing it | See above. |

For brand-driven decks where the user wants Pantone-accurate UI mockups, switch to `NeutralToneMapping` and reduce environment intensity. ACES will warp brand colors slightly toward filmic.

## ffmpeg color flags

The recorder pipeline tags the MP4 with BT.709, the standard for HD video. Every `--mode=3d` export does:

```bash
ffmpeg -framerate 60 -i frame_%05d.png \
  -c:v libx264 -crf 16 -preset slow \
  -pix_fmt yuv420p \
  -color_primaries bt709 \
  -color_trc bt709 \
  -colorspace bt709 \
  -movflags +faststart \
  out.mp4
```

What each flag does:

- `-pix_fmt yuv420p`, chroma subsampling 4:2:0, required for QuickTime, Safari, Bilibili, YouTube
- `-color_primaries bt709`, what the colors mean
- `-color_trc bt709`, transfer characteristics, matches sRGB display gamma well enough
- `-colorspace bt709`, YCbCr conversion matrix
- `-movflags +faststart`, moov atom at front, plays in browsers without full download

Do not pass `bt2020` or `smpte2084` (HDR10). The recorder is SDR-only in v1. HDR export is roadmap.

For GIF export use `bayer` dither + per-frame palette (see `convert-formats.sh`). Smooth shaded gradients destroy default palette. Full recipe in `modes/producer/animation-pitfalls.md` § video-export.

## Audio + visual delivery alignment

Color management has a sibling rule on the audio side. Both need attention before delivery.

| Domain | Rule | Where |
|---|---|---|
| Visual | sRGB output, ACES tone-map, BT.709 MP4 tags | this file |
| Audio | -14 LUFS integrated for BGM, -1 dBTP true peak ceiling | `modes/producer/audio-design-rules.md`, `capabilities/generative-audio/capture-pipeline.md` |

The reason both matter: an MP4 served on a content platform gets normalized. YouTube targets -14 LUFS audio. If your BGM is -10 LUFS, YouTube quietens it; if it's -22 LUFS, YouTube boosts it and brings up noise. Same on the visual side: if you render with no tone-mapping and brand colors clip, the platform's adaptive playback can't recover them.

Pre-delivery check (one minute):

1. `ffmpeg -i out.mp4 -af "loudnorm=print_format=json" -f null -` (audio LUFS measure)
2. Open MP4 in QuickTime, seek through, look for clipped highlights or crushed shadows
3. Compare visual to design-system reference. Tone-map has bias; if you need exact Pantone match, switch to `NeutralToneMapping`

## When to override the defaults

| Override | Reason | Cost |
|---|---|---|
| `toneMappingExposure = 0.85` | HDRI is too bright, scene blown out | one-line, safe |
| `toneMapping = NeutralToneMapping` | brand color accuracy required (UI mockups) | flatter look, lose cinematic feel |
| `toneMapping = AgXToneMapping` | hue shift in ACES highlights bothering you | minor; hue preservation better, contrast similar |
| disable tone-map entirely | data viz where one color = one value | use `NoToneMapping` and `OutputPass` only for sRGB encode |
| `toneMapping` per-pass via shader | A/B comparison or split-screen | escalate to TSL custom node |

Defaults work for 90% of deliverables. Override only with reason in the recipe README.

## Cross-references

- Pitfall walkthrough for tone-map double-apply: `pitfalls.md` § 6
- Audio LUFS rules and capture pipeline: `capabilities/generative-audio/capture-pipeline.md`, `modes/producer/audio-design-rules.md`
- Recipes that bake these defaults: `recipes.md`, `assets/recipes/`
- Postprocessing pass order with `OutputPass`: `postprocessing.md`
- Recorder source with ffmpeg flags: `scripts/render-video.js`, `scripts/convert-formats.sh`
- 2D color-handling, where applicable: `modes/producer/animations.md`
