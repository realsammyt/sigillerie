# d1 · Generative Audio Anti-Pattern Showcase

Single-file Tone.js demo. A 16-bar ambient loop in D minor at 95 BPM.
Positive demonstration: every listed anti-pattern is shown by its fix, not its violation.

## Anti-patterns demonstrated

| Anti-pattern | Recipe |
|---|---|
| **Cold Audio Start** | `Tone.start()` awaited inside a `{ once: true }` click handler. "Tap to start audio" button occupies the stage before any sound is attempted. |
| **Uniform Texture** | Q5 stance: loop-Peak at bars 12-13. Filter opens from 800 Hz to 3.2 kHz, melodic motif ascends to A5, harmonic fill shifts to Am. Bar 14 begins the resolve; bar 16 is back to loop-head texture. |
| **Loop Seam** | No audio file; the loop boundary is smoothed by harmSynth's 1.5 s release and fgSynth's 0.8 s release, which tail into the next cycle. The filter is scheduled to return to baseline by bar 16. The join is inaudible on every cycle. |
| **Motif Overload** | Exactly 3 simultaneous layers: foreground motif (triangle synth), harmonic fill (polyphonic sine pad), rhythmic pulse (membrane synth). No fourth layer is ever scheduled. |
| **Audio-Only State Signal** | Waveform canvas, bar counter, VU meter, peak banner, and mute button label all update with audio state. Mute toggle changes icon and label text. Peak at bars 12-13 turns the waveform, bar number, VU hot zone, and transport dot to the accent color. |
| **Tab-Throttle Drift** | All visual updates read `Tone.Transport.position` inside `requestAnimationFrame`. Filter automation uses `Tone.getTransport().schedule`. No `setInterval` or `Date.now` in timing-sensitive paths. |

## Q5 stance: loop-Peak

Per `capabilities/generative-audio/anti-patterns.md` §Peak-End for ambient loops:
> In a 16-bar loop the peak sits at bars 12-13; bar 16 resolves to bar 1 with a crossfade that makes the join inaudible.

This demo implements that rule as the central structural fact of the loop. Bars 1-11 establish texture. Bars 12-13 introduce harmonic tension (Am, raised register, open filter). Bars 14-15 resolve. Bar 1 of the next cycle arrives as a continuation, not a restart.

## Technical notes

- Single HTML file, no build step.
- CDN: `cdnjs.cloudflare.com/ajax/libs/tone/15.0.4/Tone.js`
- Satisfies `window.__ready`, `window.__recording`, `window.__audioRuntime`, `window.__audioCues` contracts.
- Viewport target: 1440x900, responsive to 1024.
