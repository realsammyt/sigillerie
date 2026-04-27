---
name: audio-design-rules
description: Producer audio (stereo BGM + SFX dual-track). Frequency-band isolation, sidechain ducking, narrative cue placement. Spatial/HRTF in modes/three3d/spatial-audio.md, generative in capabilities/generative-audio/.
---

# audio-design-rules

Producer-mode audio recipe for stereo deliverables (animations, hero films, prototype walkthroughs, slide decks). Two channels, hard rules, ship-ready.

For HRTF, binaural, positional 3D audio, see `modes/three3d/spatial-audio.md`. For Tone.js runtime synthesis and Stable Audio asset generation, see `capabilities/generative-audio/`.

## Iron rule, dual-track architecture

Every Producer deliverable runs two independent audio layers. One layer is broken.

| Layer | Job | Duration | Sync to visual | Frequency band |
|---|---|---|---|---|
| **SFX (beat layer)** | Mark each visual event | 0.2 to 2 s | Frame-accurate | High, 1 kHz and up |
| **BGM (bed layer)** | Emotion, room tone | Continuous, 20 to 60 s | Section-level | Low to mid, under 2 kHz |

A BGM-only piece reads cheap. The audience subconsciously clocks "the picture moves but nothing answers." That gap is the tell.

## Gold ratios, hard numbers

Calibrated against Anthropic launch films, Apple keynote SFX beds, and Linear product launches. Plug and play.

### Levels
- BGM gain: `0.40` to `0.50` of full scale
- SFX gain: `1.00`
- Loudness gap: BGM peak sits 6 to 8 dB below SFX peak. Don't make SFX loud, make the gap right.
- amix: `normalize=0`. Never `normalize=1`, it flattens dynamics.

### Loudness targets, per platform (LUFS, integrated)
- YouTube / Vimeo hero: -14 LUFS
- Web autoplay (muted-by-default landing pages): -16 LUFS
- Twitter / X video: -14 LUFS
- Instagram / TikTok: -14 LUFS
- Apple Quick Look / model-viewer ambient: -18 LUFS

True peak ceiling: -1.0 dBTP across the board.

### Frequency-band isolation (the P1 fix)
The trick isn't loud SFX. It's spectral lanes.

```bash
[bgm_raw]lowpass=f=2000[bgm]      # BGM stays under 2 kHz
[sfx_raw]highpass=f=1000[sfx]     # SFX rides 1 kHz and up
[bgm][sfx]amix=inputs=2:duration=first:normalize=0[a]
```

Human ears peak in the 2 to 5 kHz presence band. If SFX lives there and BGM occupies the full spectrum, BGM's high end masks SFX. Lowpass the bed, highpass the hits, both layers get their own room.

### Sidechain ducking, the 1 to 2 kHz overlap zone
The bands cross between 1 kHz and 2 kHz. To keep SFX punch in the overlap, duck BGM by 4 to 6 dB during SFX onsets.

```bash
[bgm][sfx]sidechaincompress=threshold=0.05:ratio=4:attack=5:release=200[ducked]
```

Attack 5 ms catches the transient. Release 200 ms restores the bed before it feels pumped.

### Fades
- BGM in: `afade=in:st=0:d=0.3`
- BGM out: `afade=out:st=N-1.5:d=1.5`
- SFX carries its own envelope, no extra fade

## SFX cue placement, narrative rules

### Sync window (the 80 ms rule)
Sound joins motion. It does not lead by more than 80 ms or lag by more than 80 ms. Outside that window the brain registers desync.

- Same-frame (0 ms): clicks, focus shifts, logo lockup, decisive impacts
- Lead 1 to 2 frames (-33 to -66 ms): whoosh, motion onset cues. Primes the eye.
- Trail 1 to 2 frames (+33 to +66 ms): physical landings, weight, settle. Matches real-world physics.

### Duration coupling
SFX duration stays within 1.2x of the visual event it scores. A 400 ms card snap gets a sub-500 ms hit. Long tails on short events drag.

### Density, by product temperament
| Temperament | SFX per 10 s | Reference |
|---|---|---|
| Dense, info-rich | 8 to 10 | Apple keynote feature reveals, Anthropic Artifacts demo |
| Balanced productivity | 3 to 5 | Linear launch films, Anthropic Word demo |
| Calm, focused | 0 to 2 | Anthropic Code Desktop, IDE walkthroughs |

Cut 30 to 50 percent of cues you'd instinctively place. The remaining ones land harder. Empty space is dramatic.

### Cue priority (P0 always, P2 sparingly)

P0, omission reads wrong:
- Typing (terminal, input field)
- Click, selection, decision moments
- Focus shift (visual lead changes)
- Logo lockup

P1, recommended:
- Element enter / exit (modal, card, sheet)
- Success and completion feedback
- AI generation start / end
- Scene transition

P2, optional, easy to over-stuff:
- Hover, focus-in
- Progress ticks
- Decorative ambient

## Western parallels (worth studying)

**Apple keynote.** Sparse SFX over a wide cinematic bed. Density sits in the 3 to 5 per 10 s zone for product reveals, drops to 0 for hero shots. Logo lockups always get a 1.5 to 2 s impact with sub-bass under 80 Hz. Watch any iPhone reveal: the bed is huge, the SFX are surgical.

**Linear product launches.** Tighter, more design-tool feel. SFX ride at 1 to 3 per 10 s. Crisp UI clicks, soft snaps, no whooshes. BGM is minimal synth, almost ambient. The restraint is the brand.

**Anthropic Artifacts demo.** Around 9 SFX per 10 s. Functional density. Each tool action gets a beat. Use this when the product itself is the spectacle.

**Anthropic Code Desktop.** 0 SFX, lo-fi BGM only. Works because the temperament is "concentration." Sometimes the right SFX count is zero.

## Seed library

Sigillerie ships 8 BGM tracks plus 32 SFX out of the box via `scripts/seed-audio-library.mjs`. Run once after repo clone. Coverage:

- 8 BGM beds: tech-minimal, tech-alt, tutorial-warm, educational-curious, ad-upbeat, ambient-focus, lo-fi-rest, cinematic-hero
- 32 SFX across 6 families: keyboard (4), container (6), impact (6), focus (4), magic / AI (6), feedback (6)

Full inventory and licensing notes live in `capabilities/generative-audio/seed-library.md`. For one-off custom assets beyond the seed set, use the Tone.js runtime path or Stable Audio asset gen documented in `capabilities/generative-audio/`.

## BGM selection tree

```
What's the temperament?
  Product launch / tech reveal     -> bgm-tech-minimal
  Tutorial / how-to                -> bgm-tutorial-warm
  Educational / explainer          -> bgm-educational-curious
  Marketing / brand spot           -> bgm-ad-upbeat
  Concentration / IDE walkthrough  -> bgm-ambient-focus or no BGM
  Long hold / closing card         -> bgm-lo-fi-rest
  Hero film / cinematic open       -> bgm-cinematic-hero
```

When to drop BGM entirely:
- Duration under 10 s (BGM can't establish)
- Temperament is "focused" or "meditative"
- Voiceover or environmental audio already carries the bed
- SFX density is high (avoid auditory pile-up)

## Recipes

### Recipe A, product hero (25 s)
```
BGM: bgm-tech-minimal at 0.45, lowpass 2 kHz
SFX density: ~6 per 10 s
Cues:
  Type x 4 (0.6 s spacing)
  Enter
  Card snap x 4 (0.2 s stagger)
  Click
  Whoosh
  Focus shift x 4
  Logo thud (1.5 s)
Mix: BGM 0.45 / SFX 1.0, normalize=0, sidechain 4 dB
```

### Recipe B, IDE walkthrough (30 to 45 s)
```
BGM: bgm-tutorial-warm at 0.50
SFX density: 0 to 2 per 10 s
Strategy: VO carries the room. SFX only on decisive moments
  (file save, command complete, test pass).
```

### Recipe C, AI generation demo (15 to 20 s)
```
BGM: bgm-tech-minimal or none
SFX density: ~8 per 10 s
Cues:
  Type + enter
  AI process loop (1.2 s, repeats 2 to 3 times)
  Complete chime
  Sparkle on result
```

### Recipe D, single-take ambient (10 to 15 s)
```
BGM: none
SFX: 3 to 5 hand-placed cues, each one a feature
Use case: hero close-up, product still life, one big moment
```

## ffmpeg templates

### Single SFX onto video
```bash
ffmpeg -y -i video.mp4 -itsoffset 2.5 -i sfx.mp3 \
  -filter_complex "[0:a][1:a]amix=inputs=2:normalize=0[a]" \
  -map 0:v -map "[a]" output.mp4
```

### Multi-cue SFX track from timeline
```bash
ffmpeg -y \
  -i sfx-type.mp3 -i sfx-enter.mp3 -i sfx-click.mp3 -i sfx-thud.mp3 \
  -filter_complex "\
[0:a]adelay=1100|1100[a0];\
[1:a]adelay=3200|3200[a1];\
[2:a]adelay=7000|7000[a2];\
[3:a]adelay=21800|21800[a3];\
[a0][a1][a2][a3]amix=inputs=4:duration=longest:normalize=0[mixed]" \
  -map "[mixed]" -t 25 sfx-track.mp3
```

`adelay=N|N` writes both stereo channels. `normalize=0` keeps dynamics. `-t 25` trims to length.

### Final mix, video + SFX track + BGM with band isolation and ducking
```bash
ffmpeg -y -i video.mp4 -i sfx-track.mp3 -i bgm.mp3 \
  -filter_complex "\
[2:a]atrim=0:25,afade=in:st=0:d=0.3,afade=out:st=23.5:d=1.5,\
     lowpass=f=2000,volume=0.45[bgm];\
[1:a]highpass=f=1000,volume=1.0[sfx];\
[bgm][sfx]sidechaincompress=threshold=0.05:ratio=4:attack=5:release=200[ducked];\
[ducked][sfx]amix=inputs=2:duration=first:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k final.mp4
```

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| SFX inaudible | BGM high end masks them | `lowpass=f=2000` BGM, `highpass=f=1000` SFX |
| SFX harsh, ear-fatiguing | Absolute SFX level too hot | SFX to 0.7, BGM to 0.3, keep 6 to 8 dB gap |
| BGM and SFX rhythm fight | BGM has strong percussive beat | Switch to ambient or minimal-synth bed |
| BGM cuts dead at end | No fade-out | `afade=out:st=N-1.5:d=1.5` |
| SFX smears into mush | Cues too dense, tails too long | SFX duration under 0.5 s, cue spacing 0.2 s minimum |
| Pumping artifact | Sidechain too aggressive | Drop ducking ratio to 3, release to 250 ms |

## Visual coupling

SFX timbre matches visual register:
- Warm, paper, mineral palette -> wood, soft click, paper snap
- Cold, dark, technical palette -> beep, pulse, glitch, digital
- Hand-drawn, playful palette -> boing, pop, zap, cartoon

Pro move: cut SFX timeline first, conform animation to it. Each cue is a metronome tick. Visual sliding to lock onto SFX is rock solid; SFX chasing visual ends up one frame off and feels wrong every time.

## Pre-delivery loudness check (mandatory)

Run before every export:

```bash
ffmpeg -i final.mp4 -af "loudnorm=I=-14:TP=-1.0:LRA=11:print_format=summary" -f null -
```

Read `input_i` (integrated LUFS) and `input_tp` (true peak). If LUFS is off platform target by more than 1 dB, or true peak exceeds -1.0 dBTP, re-render with `loudnorm` two-pass:

```bash
# Pass 1: measure
ffmpeg -i final.mp4 -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2> measured.json

# Pass 2: apply (paste measured values from pass 1)
ffmpeg -i final.mp4 -af "loudnorm=I=-14:TP=-1.0:LRA=11:\
measured_I=X:measured_TP=Y:measured_LRA=Z:measured_thresh=T:offset=O:\
linear=true:print_format=summary" -c:v copy -c:a aac -b:a 192k final-normalized.mp4
```

## Pre-ship checklist

- [ ] Loudness gap: SFX peak minus BGM peak between 6 and 8 dB
- [ ] Bands: BGM lowpass 2 kHz, SFX highpass 1 kHz
- [ ] Sidechain ducking active in 1 to 2 kHz overlap
- [ ] amix `normalize=0`
- [ ] BGM fade-in 0.3 s, fade-out 1.5 s
- [ ] SFX density matches product temperament
- [ ] Every SFX inside the 80 ms sync window
- [ ] SFX duration within 1.2x of visual event
- [ ] Logo lockup gets 1.5 s minimum impact
- [ ] Loudnorm verified against platform target
- [ ] True peak under -1.0 dBTP
- [ ] Mute BGM, listen to SFX track alone, has rhythm
- [ ] Mute SFX, listen to BGM alone, has emotional arc

Each layer stands on its own. If only the sum sounds good, the layers aren't doing their jobs.

## Cross-references

- `modes/three3d/spatial-audio.md` for HRTF, binaural rendering, positional audio in WebXR / model-viewer / Vision Pro deliverables
- `capabilities/generative-audio/` for Tone.js runtime synthesis (parametric SFX, sonification) and Stable Audio asset generation (one-off custom beds and hits)
- `capabilities/generative-audio/seed-library.md` for the 8 BGM + 32 SFX shipped via `scripts/seed-audio-library.mjs`
