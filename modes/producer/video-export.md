---
name: video-export
description: HTML to MP4/GIF export pipeline (--mode=html). Playwright recordVideo at 30fps default, NVENC GPU encode auto-detected, SSAA via deviceScaleFactor for crisp text, resolution presets (4K, vertical, square), GIF + BGM. 3D mode covered in modes/three3d/page-contract.md.
---

# Video Export (HTML mode)

Scope: `--mode=html` only. Playwright headless Chromium loads the single-file HTML, captures at viewport resolution with high DPI rasterization, ffmpeg encodes to H.264 (NVENC when available, libx264 fallback). For 3D scenes (Three.js / R3F / model-viewer), use `--mode=3d` and read `modes/three3d/page-contract.md` instead. That mode drives frames via CDP `HeadlessExperimental.beginFrame` against a virtualized clock and a page-side `__renderFrame(t)` hook, which is a different pipeline.

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
| MP4 30fps | 1920x1080, H.264, CRF 18 | WeChat, video platforms, embeds | 1-2 MB |
| MP4 60fps | 1920x1080, minterpolate, H.264, CRF 18 | High-fps showcase, portfolio, Bilibili | 1.5-3 MB |
| GIF | 720px wide, 25fps, palette-optimized | Twitter/X, README, Slack preview | 2-4 MB |

## Recording handshake (HTML mode contract)

The HTML page MUST cooperate with the recorder. Two globals:

- `window.__ready` set to `true` when fonts, images, and first paint are stable. The recorder waits on this before starting the timer.
- `window.__recording` set to `true` by the recorder before navigation. The page reads this flag to force `loop = false` on all timelines, kill any "Press to start" overlay, and disable interactive idle-state animations.

Hand-rolled stages must check `window.__recording`. Stages built on `assets/animations.jsx` get this for free.

Final-frame rule: the last sprite in the timeline sets `fadeOut = 0`. Video end frames should not fade to background or the user gets a black flash on loop.

## Tooling

Three scripts in `scripts/`:

### 1. `render-video.js` (HTML to MP4)

Drives Playwright. Records a webm at viewport resolution with `deviceScaleFactor` set for SSAA, transcodes to H.264 MP4 (NVENC when available), trims the head, optional 60fps interpolation.

```bash
node scripts/render-video.js <html-file> [flags]
```

**Full flag reference**:

| Flag | Default | Purpose |
|---|---|---|
| `--duration=<sec>` | reads `window.__duration`, fallback 10 | total animation seconds |
| `--mode=html\|3d\|tone` | auto-detect | `3d` if `window.__renderFrame` exists, else `html` |
| `--output=<path>` | `<input>.mp4` | output file |
| `--verbose` | off | log timing, file sizes, ffmpeg invocation |
| **Resolution** | | |
| `--width=<px>` `--height=<px>` | 1920 × 1080 | explicit, overrides any preset below |
| `--4k` |  | 3840 × 2160 |
| `--1440p` |  | 2560 × 1440 |
| `--720p` |  | 1280 × 720 |
| `--vertical` |  | 1080 × 1920 (Reels / TikTok / Shorts) |
| `--square` |  | 1080 × 1080 (Instagram feed) |
| **Frame rate** | | |
| `--fps=<n>` | 30 | output fps |
| `--base-fps=<n>` | 30 | capture fps |
| `--60fps` |  | shorthand for `--fps=60` (engages minterpolate) |
| `--no-interp` | off | force skip minterpolate, output at base-fps |
| **Quality** | | |
| `--ssaa=<n>` | 2 | super-sample factor 1-4. 1=off, 2=default crisp, 3=hero, 4=print. Sets Chromium `deviceScaleFactor` so text and edges raster at higher DPI before capture. |
| **Encoder** | | |
| (auto) | NVENC if available, else libx264 | encoder selection |
| `--gpu-encode` |  | force `h264_nvenc` (errors if unavailable) |
| `--cpu-encode` |  | force `libx264 -preset slow` (forced CPU) |
| **Browser GPU** | | |
| (always on) | enabled | `--enable-gpu`, `--use-angle=<platform>`, `--enable-features=Vulkan,VulkanFromANGLE`, `--enable-unsafe-webgpu`, `--allow-file-access-from-files` |
| `--no-gpu` |  | disable GPU launch flags (CI / debug / suspect render bugs) |
| **Audio** | | |
| `--audio=tone` | off | capture runtime-synthesized audio via MediaRecorder OPUS. See `capabilities/generative-audio/capture-pipeline.md`. Default is silent video; BGM gets mixed by `add-music.sh` after. |
| **Other outputs** | | |
| `--gif` | off | also emit GIF via `convert-formats.sh` |

**Common combos**:

```bash
# default, 1080p, 30fps, SSAA 2x, NVENC if available
node scripts/render-video.js page.html --duration=8

# hero-quality, 4K, 60fps interp, max NVENC
node scripts/render-video.js page.html --4k --60fps --duration=15

# fast preview, small + skip interp
node scripts/render-video.js page.html --720p --ssaa=1 --no-interp --duration=8

# vertical social cut
node scripts/render-video.js page.html --vertical --duration=12

# CI-safe (no GPU access)
node scripts/render-video.js page.html --no-gpu --cpu-encode --ssaa=1
```

**Why these defaults**: 30/30 matches Playwright's native capture rate, skipping minterpolate when fps_out === fps_base. SSAA 2x makes text and edges crisp without doubling encode time on Titan-class GPUs. NVENC auto-detect saves ~5-10× encode time when available. All overridable.

Output: `<name>.mp4` next to the source HTML (or wherever `--output` points).

### 2. `convert-formats.sh` (MP4 to 60fps MP4 / GIF / WebM / AVIF)

```bash
bash scripts/convert-formats.sh <input.mp4> --60fps --gif
```

Every output is opt-in. No flags, no files: the script exits 1 unless at least one of `--60fps --gif --gif-3d --webm --avif` is passed.

| Flag | Output | Notes |
|---|---|---|
| `--60fps` | `<name>-60fps.mp4` | minterpolate when source fps < 60, plain `fps=60` re-encode at 60+. Adds `-profile:v high -level 4.0`. |
| `--gif` | `<name>.gif` | two-pass palette, bayer dither, diff stats |
| `--gif-3d` | `<name>-3d.gif` | per-frame palette refresh, for camera-fly 3D scenes |
| `--webm` | `<name>.webm` | VP9 two-pass |
| `--avif` | `<name>.avif` | animated AVIF (libsvtav1, needs ffmpeg 5.1+) |
| `--gif-width=<px>` | | GIF width, default 720. 1280 sharper, 600 fast-loading on Twitter/X |
| `--gif-fps=<n>` | | GIF framerate, default 25 |
| `--width=<px>` | | resize width for the 60fps MP4, default keep |
| `--output-dir=<path>` | | derivatives dir, default next to input |

There is no `--minterpolate` flag and no frame-dup mode: `--60fps` picks minterpolate automatically for sub-60 sources. Some macOS QuickTime builds refuse minterpolate H.264 streams; test the target player, and if it refuses, fall back to the manual frame-dup command in troubleshooting below.

When `--60fps` runs, GIF / WebM / AVIF derive from the 60fps output.

### 3. `add-music.sh` (MP4 + BGM + SFX cues to MP4)

Mixes BGM and time-aligned SFX into a rendered MP4. Trims BGM to video length, applies fades, band isolation, optional sidechain ducking, two-pass loudnorm.

```bash
bash scripts/add-music.sh <input.mp4> [--bgm=<path>] [--bgm-volume=<db>] [--sfx-cues=<json>] [--duck-bgm] [--output=<path>] [--lufs=<target>]
```

| Flag | Default | Purpose |
|---|---|---|
| `--bgm=<path>` | `assets/audio/sigillerie-default/bgm-tutorial.mp3` | BGM track. The default file is not shipped yet, so pass `--bgm=` explicitly today. |
| `--bgm-volume=<db>` | -18 | BGM master volume in dB |
| `--sfx-cues=<json>` | auto-detects `<input>.audio-cues.json` next to input | SFX cue sidecar |
| `--duck-bgm` | off | sidechain duck BGM under SFX (4:1, 5 ms attack, 200 ms release) |
| `--output=<path>` | `<input>.scored.mp4` | output file |
| `--lufs=<target>` | -14 | integrated LUFS target, two-pass loudnorm |

Sidecar format:

```json
{ "cues": [
  { "t": 1.2, "type": "sfx", "file": "assets/.../whoosh.mp3", "gain_db": -6 }
] }
```

Behavior:
- BGM trimmed to video duration, 0.3s fade-in, 1.5s fade-out
- Band isolation: BGM lowpass 2 kHz, SFX highpass 1 kHz (numbers explained in `audio-design-rules.md`)
- Video stream `-c:v copy` (no re-encode), audio AAC 192k
- Missing cue files skip with a warning, they do not abort the mix

A mood-keyed BGM library (`--mood=tech` and friends) is planned, not shipped. No BGM files ship in the repo today.

### Dual-track audio (BGM + SFX)

For pages that synthesize SFX at runtime (Web Audio, Tone.js, generative drones), do not bake SFX into BGM. Two-track approach:

1. Capture runtime SFX with `--audio=tone` during `render-video.js` (writes a separate OPUS track alongside the silent MP4)
2. Mix BGM + SFX in one `add-music.sh` pass: `--bgm=` for the bed, `--sfx-cues=` for the hits, `--duck-bgm` for sidechain ducking. Band isolation and duck parameters are built into the script; no hand-rolled `amix` needed.

The why behind the mix numbers lives in `modes/producer/audio-design-rules.md`. Capture mechanics: `capabilities/generative-audio/capture-pipeline.md` (stub today).

## Standard pipeline

```bash
cd <project>

# 1. Record 30fps base MP4 (silent, or with --audio=tone for runtime SFX)
NODE_PATH=$(npm root -g) node "$SKILL/scripts/render-video.js" my-anim.html

# 2. Derive 60fps MP4 + GIF
bash "$SKILL/scripts/convert-formats.sh" my-anim.mp4 --60fps --gif

# 3. Mix BGM (no default BGM ships yet, bring a file)
bash "$SKILL/scripts/add-music.sh" my-anim-60fps.mp4 --bgm=path/to/bed.mp3

# Outputs:
# my-anim.mp4                 30fps, silent
# my-anim-60fps.mp4           60fps, silent
# my-anim.gif                 720px, 25fps, palette-optimized (derived from the 60fps file)
# my-anim-60fps.scored.mp4    60fps, BGM mixed
```

## Technical notes (troubleshooting)

### Playwright `recordVideo` quirks

- Capture runs at `--base-fps`, default 30. You cannot record native 60fps from Playwright; 60fps comes from post interpolation.
- Recording starts at context creation, before navigation. The first 1-2 seconds are reload + font load. `render-video.js` waits for `window.__ready`, then trims that warmup head automatically with ffmpeg `-ss` (no flag needed).
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
2. `paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle` encodes with that palette. `rectangle` diff only redraws changed regions, shrinking file size.

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
| foo.mp4 | MP4 | 1920x1080, 30fps, H.264 | X MB |
| foo-60fps.mp4 | MP4 | 1920x1080, 60fps (motion interp), H.264 | X MB |
| foo.gif | GIF | 720px wide, 25fps, palette-optimized | X MB |

Notes
- 60fps uses minterpolate motion estimation, strong on transform animations
- GIF is palette-optimized, ~3 MB at 30s
- BGM: <file>, -18 dB under SFX, fades 0.3s in / 1.5s out, loudnorm to -14 LUFS

Want a different size or fps? Say the word.
```

## Common follow-ups

| User says | Response |
|---|---|
| "Too big" | MP4: raise CRF to 23-28. GIF: re-run with `--gif-width=600` or `--gif-fps=10`. |
| "GIF looks bad" | Re-run with `--gif-width=1280`, or recommend MP4 (WeChat Moments accepts it). |
| "Need 9:16 vertical" | Re-record with `--width=1080 --height=1920`. |
| "Add a watermark" | ffmpeg `-vf "drawtext=..."` or PNG `overlay=`. |
| "Need transparent bg" | MP4 has no alpha. Use WebM VP9 + alpha, or APNG. |
| "Lossless please" | CRF 0 + preset veryslow. File grows ~10x. |
