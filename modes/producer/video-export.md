---
name: video-export
description: HTML to MP4/GIF export pipeline (--mode=html). Playwright recordVideo at 25fps, ffmpeg interp to 60fps, palette-optimized GIF, BGM mixing. 3D mode covered in modes/three3d/page-contract.md.
---

# Video Export (HTML mode)

Scope: `--mode=html` only. Playwright headless Chromium loads the single-file HTML, records at 25fps, ffmpeg upscales temporally and packages MP4 + GIF. For 3D scenes (Three.js / R3F / model-viewer), use `--mode=three3d` and read `modes/three3d/page-contract.md` instead. That mode drives frames via CDP `HeadlessExperimental.beginFrame` against a virtualized clock and a page-side `__renderFrame(t)` hook, which is a different pipeline.

## When to export

Export only after:
- HTML runs clean in a real browser, no console errors
- User has watched it once and said the visual is right
- Playwright sanity screenshots at key timestamps look correct

Do not export while animation bugs are still open. Fixing inside an MP4 is expensive.

User triggers: "export to video", "make it MP4", "GIF version", "60fps please".

## Deliverable set

Default: ship three files, let the user pick.

| Format | Spec | Best for | 30s typical size |
|---|---|---|---|
| MP4 25fps | 1920x1080, H.264, CRF 18 | WeChat, video platforms, embeds | 1-2 MB |
| MP4 60fps | 1920x1080, minterpolate or fps-dup, H.264, CRF 18 | High-fps showcase, portfolio, Bilibili | 1.5-3 MB |
| GIF | 960x540, 15fps, palette-optimized | Twitter/X, README, Slack preview | 2-4 MB |

## Recording handshake (HTML mode contract)

The HTML page MUST cooperate with the recorder. Two globals:

- `window.__ready` set to `true` when fonts, images, and first paint are stable. The recorder waits on this before starting the timer.
- `window.__recording` set to `true` by the recorder before navigation. The page reads this flag to force `loop = false` on all timelines, kill any "Press to start" overlay, and disable interactive idle-state animations.

Hand-rolled stages must check `window.__recording`. Stages built on `assets/animations.jsx` get this for free.

Final-frame rule: the last sprite in the timeline sets `fadeOut = 0`. Video end frames should not fade to background or the user gets a black flash on loop.

## Tooling

Two scripts in `scripts/`:

### 1. `render-video.js` (HTML to 25fps MP4)

Drives Playwright. Records a webm at 25fps, transcodes to H.264 MP4, trims the head.

```bash
NODE_PATH=$(npm root -g) node scripts/render-video.js <html-file>
```

Args:
- `--duration=30` total animation seconds
- `--width=1920 --height=1080` resolution
- `--trim=2.2` seconds to cut from the front (drops navigation + font-load flicker)
- `--fontwait=1.5` extra wait for webfonts before `__ready` is honored
- `--audio=tone` opt-in: capture runtime-synthesized audio via MediaRecorder OPUS. See `capabilities/generative-audio/capture-pipeline.md` for the full path. The default is silent video; BGM gets mixed in later.

GPU launch flags (from upstream PR #14, baked into `render-video.js`): Chromium starts with `--enable-gpu`, `--ignore-gpu-blocklist`, ANGLE backend selected per-platform (`--use-angle=metal` on macOS, `--use-angle=d3d11` on Windows, `--use-angle=gl` on Linux), plus `--enable-features=Vulkan,UseSkiaRenderer` where supported. This matters for canvas-heavy and CSS-filter-heavy pages where the software rasterizer drops frames or smears blur. Headless Chromium without these flags falls back to SwiftShader and recording quality degrades noticeably.

Output: `<name>.mp4` next to the source HTML.

### 2. `convert-formats.sh` (25fps MP4 to 60fps MP4 + GIF)

```bash
bash scripts/convert-formats.sh <input.mp4> [gif_width] [--minterpolate]
```

Outputs:
- `<name>-60fps.mp4`. Default uses `fps=60` frame duplication (broadest compat). `--minterpolate` switches to motion-compensated interpolation.
- `<name>.gif`. Two-pass palette, default 960px wide.

60fps mode pick:

| Mode | Command | Plays in | Use when |
|---|---|---|---|
| Frame dup (default) | `convert-formats.sh in.mp4` | QuickTime, Safari, Chrome, VLC | General delivery, social, uploads |
| Minterpolate | `convert-formats.sh in.mp4 --minterpolate` | Chrome, VLC, most players. macOS QuickTime sometimes refuses | Bilibili-style showcases. Test on the target player before delivery |

Why default flipped to frame-dup: minterpolate H.264 elementary streams hit a known QuickTime decoder bug. Multiple deliveries failed in the wild. See troubleshooting below.

`gif_width`:
- 960 default, social-friendly
- 1280 sharper, bigger file
- 600 fast-loading on Twitter/X

### 3. `add-music.sh` (MP4 + BGM to MP4)

Mixes a BGM track into a silent MP4. Picks from a built-in library by mood, or accepts an arbitrary file. Auto-trims to video length, applies fades.

```bash
bash add-music.sh <input.mp4> [--mood=<name>] [--music=<path>] [--out=<path>]
```

Built-in BGM library (`assets/bgm-<mood>.mp3`):

| `--mood=` | Style | Fits |
|---|---|---|
| `tech` (default) | Apple-event-style minimal synth + piano | Product launches, AI tooling, skill promo |
| `ad` | Upbeat modern electronic, build + drop | Social ads, teasers, promo cuts |
| `educational` | Warm acoustic guitar, electric piano | Explainers, course intros |
| `educational-alt` | Same lane, different track | Same |
| `tutorial` | Lo-fi ambient, near-invisible | Software demos, long walkthroughs |
| `tutorial-alt` | Same lane, different track | Same |

Behavior:
- BGM trimmed to video duration
- 0.3s fade-in, 1s fade-out
- Video stream `-c:v copy` (no re-encode), audio AAC 192k
- `--music=<path>` overrides `--mood`
- Bad mood name lists valid options instead of silently failing

### Dual-track audio (BGM + SFX)

For pages that synthesize SFX at runtime (Web Audio, Tone.js, generative drones), do not bake SFX into BGM. Two-track approach:

1. Capture runtime SFX with `--audio=tone` during `render-video.js` (writes a separate OPUS track alongside the silent MP4)
2. Mix BGM under SFX with `add-music.sh`, then layer the captured SFX on top using ffmpeg `amix` with sidechain ducking on the BGM bus

Full mix recipe and ducking parameters live in `capabilities/generative-audio/audio-design-rules.md`. The capture mechanics live in `capabilities/generative-audio/capture-pipeline.md`. Both cross-link back here.

## Standard pipeline

```bash
cd <project>

# 1. Record 25fps base MP4 (silent, or with --audio=tone for runtime SFX)
NODE_PATH=$(npm root -g) node "$SKILL/scripts/render-video.js" my-anim.html

# 2. Derive 60fps MP4 + GIF
bash "$SKILL/scripts/convert-formats.sh" my-anim.mp4

# 3. Mix BGM
bash "$SKILL/scripts/add-music.sh" my-anim-60fps.mp4 --mood=tech

# Outputs:
# my-anim.mp4              25fps, silent
# my-anim-60fps.mp4        60fps, silent
# my-anim.gif              15fps, palette-optimized
# my-anim-60fps-bgm.mp4    60fps, BGM mixed
```

## Technical notes (troubleshooting)

### Playwright `recordVideo` quirks

- Frame rate is locked at 25fps. Chromium headless compositor ceiling. You cannot record native 60fps from Playwright.
- Recording starts at context creation, before navigation. The first 1-2 seconds are reload + font load. Always `--trim`.
- Output is webm by default. Transcode to H.264 MP4 for universal playback. `render-video.js` does this.

### ffmpeg minterpolate config

Current settings: `minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`

- `mi_mode=mci`: motion-compensated interpolation
- `mc_mode=aobmc`: adaptive overlapped block motion compensation
- `me_mode=bidir`: bidirectional motion estimation
- `vsbmc=1`: variable-size block motion compensation

Works well on CSS transform animations (translate, scale, rotate). Pure opacity fades sometimes ghost. If the user complains, fall back to frame duplication:

```bash
ffmpeg -i input.mp4 -r 60 -c:v libx264 -crf 18 output.mp4
```

### Why GIF needs two-pass palette

GIF is 256-color. Single-pass uses a generic palette and crushes subtle gradients (cream backgrounds with orange accents go muddy).

Two-pass:
1. `palettegen=stats_mode=diff` scans the whole video, builds a palette tuned to this animation
2. `paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle` encodes with that palette. `rectangle` diff only redraws changed regions, shrinking file size.

`dither=bayer` is smoother on fades than `none` but adds a few hundred KB. Worth it.

## Pre-flight check

Before running the export, 30 seconds of self-check:

- HTML runs clean in browser, no console errors
- Frame 0 is a complete initial state, not a loading blank
- Final frame is a stable end-state, not a half-finished one
- Fonts, images, emoji all render correctly (cross-ref `animation-pitfalls.md`)
- `--duration` matches the actual animation length
- Stage code reads `window.__recording` and forces `loop = false`
- Last sprite has `fadeOut = 0`
- Watermark present where the brand rules require it

## Delivery note template

```
Delivery

| File | Format | Spec | Size |
|---|---|---|---|
| foo.mp4 | MP4 | 1920x1080, 25fps, H.264 | X MB |
| foo-60fps.mp4 | MP4 | 1920x1080, 60fps (motion interp), H.264 | X MB |
| foo.gif | GIF | 960x540, 15fps, palette-optimized | X MB |

Notes
- 60fps uses minterpolate motion estimation, strong on transform animations
- GIF is palette-optimized, ~3 MB at 30s
- BGM mood: <mood>, fades 0.3s in / 1s out

Want a different size or fps? Say the word.
```

## Common follow-ups

| User says | Response |
|---|---|
| "Too big" | MP4: raise CRF to 23-28. GIF: drop width to 600 or fps to 10. |
| "GIF looks bad" | Bump `gif_width` to 1280, or recommend MP4 (WeChat Moments accepts it). |
| "Need 9:16 vertical" | Re-record with `--width=1080 --height=1920`. |
| "Add a watermark" | ffmpeg `-vf "drawtext=..."` or PNG `overlay=`. |
| "Need transparent bg" | MP4 has no alpha. Use WebM VP9 + alpha, or APNG. |
| "Lossless please" | CRF 0 + preset veryslow. File grows ~10x. |
