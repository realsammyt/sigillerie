---
name: anti-patterns
description: Generative Audio capability — UX-law-derived anti-patterns the critic agent scans for
status: seeded (Phase 3 of UX-laws integration; Phase 8 research pass will extend)
---

# Generative Audio Anti-Patterns

This catalog covers failure modes in runtime synthesis (Track A: Tone.js) and AI-asset generation (Track B: Stable Audio, ElevenLabs). The critic agent invokes it during the G4 gate pass on any deliverable that includes audio. Track A patterns fail at runtime and are often invisible in static review; Track B patterns are baked into the asset and must be caught at generation time. Some patterns hit both tracks.

## Anti-patterns

| Name | Pattern | Law violated | Track | Fix |
|---|---|---|---|---|
| **Cold Audio Start** | `Tone.js` AudioContext initializes on page load. Browsers block autoplay. 400ms+ blank audio before user gesture fires. | Doherty Threshold | A | Gate `Tone.start()` on first user gesture. Show an explicit "Tap to start audio" affordance before any sound is expected. |
| **Uniform Texture** | Generative BGM holds the same energy from 0:00 to end. No peak. No resolution. | Peak-End Rule | A, B | Score a peak at 60-70% of track duration. End with resolution (reverb tail, final chord, or fade to silence). |
| **BGM Mask** | Background music sits at the same gain level as SFX and voice. SFX cues become inaudible during busy passages. | Selective Attention | A, B | Duck BGM by 8-12 dB when a SFX or voice event fires. Use `Tone.CrossFade` or a sidechain compressor node in Tone.js. |
| **Loop Seam** | An audio loop has a hard cut at the boundary. The click or pop at bar 16→bar 1 is audible on every cycle. | Aesthetic-Usability Effect | A, B | Crossfade the loop tail into the loop head over 50-100 ms. In Tone.js use `Player` with `loopStart`/`loopEnd` and a short fade envelope; in Track B assets, export with loop region markers confirmed in a DAW. |
| **Tab-Throttle Drift** | BGM timing is driven by `setInterval` or `setTimeout`. When the tab is backgrounded, browser throttles timer resolution to 1 s intervals. Audio drifts out of sync with animated visuals on return. | Mental Model | A | Drive all timing from the `Tone.Transport` clock, not from JS timers. `Transport.schedule` uses the Web Audio API clock, which runs on the audio thread and is immune to tab throttle. |
| **Spatial Fallback Void** | A 3D audio scene uses `PannerNode` with HRTF convolution. On devices with no head-tracking and no HRTF database, the AudioContext silently falls back to equal-power stereo, with no indication to the listener. | Jakob's Law | A | Detect HRTF support at init (`AudioContext.listener.positionX` exists vs. deprecated `setPosition`). If HRTF is unavailable, fall back to explicit stereo pan and log a console warning. Never let the fallback be silent. |
| **Node Leak** | Tone.js synth nodes, effects chains, and `BufferSource` nodes are created on every event but never disposed. After 60 s of playback the audio graph has hundreds of idle nodes, memory climbs, and dropout artifacts begin. | Cognitive Load (system load analog) | A | Call `.dispose()` on every Tone.js node when it's no longer needed. For one-shot SFX use `ToneAudioBuffer` with a `Player` set to `dispose: true` post-playback. Audit graph size with `Tone.getContext().rawContext.destination.numberOfOutputs` as a health check. |
| **Uncanny Voice** | ElevenLabs output is used for a brand voice at a timbre or cadence the model wasn't tuned for. The result sounds human-ish but wrong: wrong breath, wrong stress, wrong affect. | Aesthetic-Usability Effect | B | Audition at least three voice models against the script before committing. Prefer voices that have been trained on content similar in register (conversational vs. authoritative vs. narrator). Reject any voice with uncanny breath artifacts even if the prosody is otherwise correct. |
| **License Trail Break** | A Stable Audio or ElevenLabs asset is used in a deliverable with no provenance record. Model license, generation prompt, and output asset UUID are not logged. If the client asks for a license audit, the chain is broken. | Mental Model (user's expectation that delivered assets are auditable) | B | At generation time, write a sidecar entry to `license-trail.md` per asset: model, version, prompt hash, output filename, date, and license type. Never commit a Track B audio asset without a corresponding sidecar entry. |
| **Hallucinated Lyrics** | A generative music model produces audio with audible, unintelligible syllables or phonemes that sound like lyrics. The deliverable ships with indistinct vocal artifacts that no one authored. | Aesthetic-Usability Effect | B | Prompt Stable Audio with "no vocals, no voice, no lyrics" explicitly. Audition the full output before use. If vocal artifacts are present, regenerate or apply a high-pass spectral gate above the formant range. |
| **Motif Overload** | A Tone.js generative score plays five independent melodic motifs simultaneously. Nothing is foregrounded. The listener can't track any single idea. | Miller's Law | A | Limit simultaneous melodic layers to three maximum. One motif carries the foreground; one provides harmonic fill; one provides rhythmic texture. Any more than three competes for the listener's tracking capacity. |
| **Audio-Only State Signal** | A UI state change (loading complete, error, success) is communicated only through an audio cue. Users with audio muted or hearing impairments receive no feedback. | Accessibility (Cognitive Load, Mental Model) | A, B | Every audio state signal must have a visual companion: a spinner resolves, an icon changes, a toast appears. Audio is a secondary channel, not the primary signal. |
| **Flat First Three Seconds** | The audio bed begins with silence or a quiet ambient pad and takes 8-12 s to reach any identifiable character. The user's attention window for new audio is under 5 s. | Serial Position Effect | A, B | The first 3 s must establish the tonal identity: tempo, key, and character. Start at arrival energy, not warm-up energy. |

## Peak-End for ambient loops (Q5 stance)

Composed scores follow the Peak-End Rule as stated: peak at 60-70% of duration, resolution at the end.

Ambient loops are not exempt, but the rule applies at the loop level, not the session level. A 16-bar ambient loop should have a micro-peak at bars 12-13 (filter opens, transient layer enters, harmonic tension increases) and resolve back to the loop head texture by bar 16. On every cycle, the listener experiences a brief arc. The session length is irrelevant; the arc lives inside the loop. This is better than exempting ambient loops entirely, because a totally flat loop trains the listener to tune it out, which defeats the purpose of presence audio.

Rule: in a 16-bar loop, the peak sits at bars 12-13; bar 16 resolves to bar 1 with a crossfade that makes the join inaudible.

## Notes per pattern

### Cold Audio Start: gesture-gate recipe

```js
// Show affordance before audio is expected
document.getElementById('start-btn').addEventListener('click', async () => {
  await Tone.start();           // resolves AudioContext suspension
  document.getElementById('start-btn').remove();
  Transport.start();
}, { once: true });
```

The "Tap to start audio" button must be visible before any audio is attempted. Don't hide it behind other UI. The click handler uses `{ once: true }` so it fires exactly once.

### Loop Seam: crossfade recipe (Tone.js)

```js
const player = new Tone.Player({
  url: './loop.wav',
  loop: true,
  loopStart: 0,
  loopEnd: 4.0,   // exact loop duration in seconds
  fadeIn: 0.05,   // 50ms fade in at loop start
  fadeOut: 0.05,  // 50ms fade out before loop end
}).toDestination();
```

For Track B assets, confirm the loop region in a DAW before export. A loop that sounds clean at 44.1 kHz may still click at the sample boundary if the waveform isn't zero-crossing-aligned.

### Node Leak: disposal pattern

```js
// One-shot SFX with auto-disposal
const sfx = new Tone.Player({ url: './sfx.wav' }).toDestination();
sfx.onstop = () => sfx.dispose();
sfx.start();
```

For effect chains, call `dispose()` on the chain root and Tone.js propagates disposal to connected nodes. Audit node count during development with `Tone.getContext().rawContext.state`.

### License Trail Break: sidecar format

Minimum entry in `license-trail.md` for any Track B asset:

```
| filename | model | model_version | prompt_hash | generated_date | license |
| bgm-01.wav | stable-audio-open-1.0 | 1.0 | sha256:abc123 | 2026-05-15 | Stability AI Community |
```

Prompt hash is SHA-256 of the exact prompt string. Store the full prompt text in a companion `.prompt.txt` file.

### BGM Mask: ducking recipe (Tone.js)

```js
const bgm = new Tone.Player('./bgm.wav').connect(bgmGain);
const bgmGain = new Tone.Gain(1.0).toDestination();

// On SFX trigger, duck BGM
function playSfx(url) {
  bgmGain.gain.rampTo(0.2, 0.05);     // -14 dB in 50ms
  const sfx = new Tone.Player({ url, onload: () => sfx.start() }).toDestination();
  sfx.onstop = () => {
    bgmGain.gain.rampTo(1.0, 0.3);    // restore in 300ms
    sfx.dispose();
  };
}
```

## Track-specific notes

**Track A (Tone.js, runtime synthesis):**
- Cold Audio Start, Tab-Throttle Drift, Node Leak, and Motif Overload are Track A-only failure modes; they require audio graph access to fix.
- BGM Mask is most critical in Track A because BGM and SFX share the same live graph and ducking must be reactive.
- Tab-Throttle Drift is invisible in local development (tab stays active) and only surfaces in QA when the tab is backgrounded.
- Sample-rate mismatch between imported audio buffers and the AudioContext (e.g., 48 kHz buffer in a 44.1 kHz context) causes pitch drift; always resample on import or match context rate to source.
- Spatial Fallback Void is a Track A-only runtime failure; test explicitly on target devices before shipping.

**Track B (AI-asset generation):**
- Uncanny Voice and Hallucinated Lyrics are generation-time risks; they can't be patched after the fact without regenerating the asset.
- License Trail Break is always a Track B risk; Track A synthesis has no external provenance to log.
- Loop Seam is common in AI-generated loops because generative models don't guarantee zero-crossing alignment at the loop boundary; always verify before committing the asset.
- BGM energy levels from Stable Audio vary by prompt; normalize peak to -1 dBFS and RMS to -18 dBFS before use in a deliverable.

## What this catalog does NOT cover

- Detailed Tone.js audio graph topology patterns (parametric-sfx.md territory, deferred to Phase 8).
- Full license-trail audit procedure including chain-of-title verification for commercial delivery (license-trail.md territory, deferred to Phase 8).
- Spatial audio mixdown specifics: HRTF database selection, binaural render chain, head-tracking latency budgets (spatial-audio.md territory, deferred to Phase 8).
- Brand audio composition guidance: motif architecture, key-signature rules, brand DNA to sonic palette translation (brand-audio-spec.md territory, deferred to Phase 8).
- Streaming and adaptive bitrate considerations for audio assets in web delivery (capture-pipeline.md territory, deferred to Phase 8).
