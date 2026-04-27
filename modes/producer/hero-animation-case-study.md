---
name: hero-animation-case-study
description: Worked-example hero animation. Brief intake to ship, with timing math, asset choices, anti-slop fixes mid-build, and post-mortem.
---

# hero-animation-case-study

One real hero animation, walked end to end. 25 seconds, 8 scenes, gallery-ripple structure. Built for a design studio launch page. The brief was thin, the asset pile was wrong, the first cut leaned cliche. This is the receipt.

Read alongside `modes/producer/workflow.md` (the named-pass discipline this followed), `modes/producer/animation-pitfalls.md` (the traps that bit during build), and `modes/producer/critique-guide.md` (the rubric that scored the post-delivery pass).

## Sigillerie callout

Phase 0 of this case was a scramble. The producer agent had no brand-spec, no usable image set, no locked palette. Two hours went to chasing assets that should have arrived pre-baked.

If `modes/discovery/pipeline.md` had run first, Phase 0 disappears. Discovery hands over `brand-spec.md` plus `assets/<brand>-brand/` populated: logo, palette with provenance, type stack with license, product imagery, voice card. Producer mode opens with everything in place and goes straight to direction lock.

The fix below is what producer did without Discovery. The lesson: never ship producer-only when Discovery is available. Run the full pipeline.

## The brief (intake)

Studio launch page. One hero block above the fold. Show breadth and depth at once. Studio has shipped 30+ projects across decks, hero animations, and product mockups; the founder wants visitors to feel that volume in the first 3 seconds, then linger on a few standouts.

What the brief did not say: duration, palette, end format, fallback for slow hardware, mobile behavior. Producer's first move was the question batch from `modes/producer/workflow.md` §Question Template. Ten questions, batched, answered in one round.

Pulled out of the batch:

- Duration: 25s loop, MP4 + GIF deliverables.
- Format: 1920x1080, looped on the page, also exported as standalone for social.
- Palette: warm paper ground, single accent. Founder cited Anthropic's marketing pages as a vibe ref.
- Mobile: scaled-down still image fallback, no auto-play under 768px.
- Must-haves: studio wordmark in the closing beat. No tagline copy.
- Asset pile: 32 thumbnails from prior projects, mixed aspect ratios, mixed quality.

That last bullet became the Phase 0 problem.

## Phase 0: asset triage (the scramble)

32 thumbnails, but only 21 were 16:9 and on-brand. The rest were vertical app shots, wireframes, or off-color screenshots. Producer cropped, color-matched, and re-rendered to a uniform set of 32 cards (looping 21 source images twice with crop variations to fill the gallery). 90 minutes burned.

Notes for next time:

- Discovery's Phase 4 `ui_screenshots` slot would have produced this set in one batch.
- Without Discovery, force the user to deliver a uniform asset pack before Phase 1. Do not start with mixed material.
- 48 cards in the gallery, 32 unique sources. Below 20 the structure looks empty; this is a hard floor.

## Direction lock

Two minutes of HTML sketching, three thumb-sized concept stills:

1. **Gallery-ripple + multi-focus**: 48 cards explode out from center, then four named projects pull forward with background dim.
2. **Typographic march**: studio wordmark animates through 200 weight steps, projects scroll behind in mono.
3. **Single hero loop**: one project at full-bleed, slow zoom, others tile in the corner.

Founder picked 1. The reasoning held: brief asked for breadth-then-depth, and gallery-ripple is the structure that maps to that arc. Typographic march would have shown breadth via repetition, not volume. Single hero loop reads as portfolio-tour, not studio-launch.

Direction locked at the 30-minute mark.

## Pass 1: Junior pass (15 min)

HTML scaffold, placeholders for everything. Comments at the top:

```html
<!--
Assumptions:
- 25s loop, 8 beats: intro, ripple, settle, focus x4, brand reveal.
- Palette: paper #F7F4EE, ink #1D1D1F, accent #D97757 (terracotta).
- Type: variable sans for wordmark (Inter Variable), no body copy.
- Gallery: 48 cards, 8x6 grid, 3D tilt rotateX(14deg) rotateY(-10deg).

Open questions:
- Focus pick order: chronological or aesthetic? Going with aesthetic for now.
- Final brand reveal: full wordmark center, or off-axis?
- Background music: out of scope for v1.
-->
```

Showed founder. Two adjustments: focus order goes chronological (newest first), brand reveal stays center. Direction sign-off in 5 minutes.

## Pass 2: Full pass (the lift)

Four hours. Timing math first, then implementation.

### Timing budget (25.0s total)

| Beat | Window | Duration | Easing |
|---|---|---|---|
| 1. Cold open (paper ground, terminal cursor blink) | 0.0 - 2.5s | 2.5s | none |
| 2. Wordmark fade-in (weight 100, low opacity) | 2.5 - 4.0s | 1.5s | expoOut |
| 3. Wordmark settle, breath beat | 4.0 - 8.3s | 4.3s | hold |
| 4. Ripple (cards explode from center) | 8.3 - 10.0s | 1.7s | expoOut |
| 5. Pan + tilt settle | 10.0 - 11.0s | 1.0s | easeOut |
| 6. Focus x4 (1.7s each, 0.6s gaps) | 11.0 - 19.6s | 8.6s | expoOut in, easeOut out |
| 7. Walloff (cards fade, wordmark grows) | 19.6 - 22.5s | 2.9s | easeInOut |
| 8. Brand hold + loop seam | 22.5 - 25.0s | 2.5s | hold + crossfade to t=0 |

Per-card ripple delay: distance from center times 0.8s max. Center cards at t=8.3s, corner cards at t=9.1s. Each card's own fade-in is 0.7s.

Per-focus internal: 0.4s in ramp, 0.9s hold, 0.4s out ramp. Background dims to 40% opacity, brightness to 68%, saturate to 65%. Filter, not opacity-only. The desaturation is what makes the focused card pop.

### Asset choices that mattered

- **Variable font**: Inter Variable, weight 100 to 700 over 0.9s for the brand reveal. Cheaper than scaling, reads as "filling in" rather than "pushing forward". Pitfall: must verify the font license covers variable axes.
- **Two-tier shadows**: cards split into `depth-near` and `depth-far` via `sin(i * 1.7) + cos(i * 0.73)`. Looks like 3D stacking, costs zero per-frame transform. Real `translateZ` on 48 cards killed framerate at 25fps in the v1 trial.
- **Pan motion**: sine wave + linear drift, x and y at different frequencies (0.12, 0.09). Avoids the "I can predict the next position" feel of pure linear pan.
- **Single accent color**: terracotta `#D97757` shows up on terminal prompt, focus ring, brand hyphen, cursor, and nowhere else. Five anchors, one color. Anything else would dilute.

### Anti-slop fixes mid-build

Three moments where the agent caught itself drifting toward named cliches from `modes/producer/critique-guide.md`'s anti-pattern catalog. Recovery:

**1. AI-orb almost happened.** First brand-reveal sketch had a soft gradient sphere behind the wordmark "for warmth". Caught it at the 50% checkpoint. Replaced with a flat paper ground and a single hairline rule under the wordmark. Cleaner, more on-philosophy, and dropped one anti-pattern hit.

**2. Glass-everywhere on the focus overlay.** First focus draft had the foreground card on a frosted-glass layer over the dimmed gallery. Looked expensive, read as glassmorphism-by-default. Switched to flat paper ground, 3-layer drop shadow, 3px terracotta outline ring. The card now reads as "lifted off the page" without the glass tax.

**3. Ornament-tax on the bottom strip.** Mid-build, agent added a `00:25 ── STUDIO / HERO` page-number-style strip at the bottom. Caught by pitfall 11 (`do not draw fake chrome inside the canvas`). Deleted. Stage already provided scrubber and time code; the strip duplicated chrome and survived the deletion test.

The catch rate matters. Each one would have dropped the innovation score by a point at critique time. Three would have failed the gate.

### Pitfalls that bit

In order of when they bit:

- **Pitfall 6** (measuring before fonts load). Bracket-style decoration around the wordmark sat 200px off because `getBoundingClientRect` ran before Inter Variable arrived. Wrapped in `document.fonts.ready.then()` plus one `requestAnimationFrame`. Fixed.
- **Pitfall 4** (transition gaps). Beat 4 to 5 had a 0.4s blank between ripple end and pan start. Cross-faded by overlapping the windows. Fixed.
- **Pitfall 12** (head-blank on export). First MP4 export had 1.8s of blank head. The `__ready` flag was firing in `useEffect` before the first tick. Moved to the tick-frame-1 pattern from the pitfall doc. Fixed.
- **Pitfall 13** (loop during record). First export caught 0.8s of loop-2 at the tail because Stage default `loop=true` ran past the recorder window. Added `window.__recording` handshake. Fixed.

## Pass 3: Variations pass

Founder asked for three palette variants and two pacing variants. Tweaks panel exposed:

- Palette: paper-warm (default), paper-cool (sub `#F4F4F1` ground, `#3B5BDB` accent), high-contrast (`#FFFFFF` ground, `#000000` ink, accent `#D97757`).
- Pacing: 25s (default) and 18s (focus beats compressed to 1.2s each, gaps to 0.4s).

One axis per variant pair, per `modes/producer/workflow.md` §Variations Pass discipline. Founder picked paper-warm + 25s. The 18s version went to the social cut.

## Pass 4: Validation pass

Pre-flight checklist from `modes/producer/animation-pitfalls.md` ran clean. Playwright captured frame 0 and frame end:

- Frame 0: paper ground, terminal cursor only. Correct initial state.
- Frame end: wordmark center, full weight 700, gallery faded to 0. Correct final state.

MP4 export: 25fps base, 60fps via frame duplication (not minterpolate, per pitfall 14). GIF: two-stage palette via `palettegen` and `paletteuse`. File sizes: 4.2MB MP4, 8.7MB GIF.

Founder review on the live page: one note (terracotta accent felt too saturated against the warm paper). Dropped saturation 6%. Shipped.

## Post-delivery critique

Ran the rubric from `modes/producer/critique-guide.md`.

```
## Critique Report

Floor score: 8/10
Verdict: pass

Per dimension:
- Philosophical coherence: 9/10. Paper-and-ink studio, single accent, every choice traces back. Gallery-ripple is the volume move; multi-focus is the depth move. Coherent.
- Visual hierarchy: 8/10. Eye flows: cursor → wordmark → ripple → focus → wordmark. Beat 3 (settle) is slightly long; could trim 0.5s.
- Execution: 9/10. 8pt grid, 4 colors total, 1 type family. Two-tier shadow holds up at full-frame inspection.
- Functionality: 8/10. Every element serves the breadth-then-depth arc. Bottom strip got deleted in time. Loop seam is invisible.
- Innovation: 8/10. Variable-weight brand reveal and the sin+drift pan are the two authorial moves. Gallery-ripple itself is structural, not novel.

Anti-patterns detected: none. (Three near-misses caught mid-build.)
```

Floor 8, ship-clean. The settle beat is the only fixable note for v2.

## Post-mortem

What worked:

- Question batch up front. Ten questions, one round, intake locked in 30 minutes.
- Junior-pass HTML with assumptions in comments. Founder caught the focus-order question before any pixels were painted.
- Mid-build cliche checks against the anti-pattern catalog. Three saves, all before the 50% checkpoint.
- Pitfall doc as the build-time companion. Four hits, four named fixes, no debugging from scratch.

What to change next time:

- **Run Discovery first.** Phase 0 asset triage was 90 minutes that should not have happened. `modes/discovery/pipeline.md` Phase 4 produces uniform asset packs by default.
- **Trim the settle beat.** 4.3s of wordmark hold is 0.5s too long. Founder didn't flag it; the rubric did.
- **Lock palette before timing math.** The accent saturation tweak at the end could have been caught in Pass 1 with a 30-second contrast check on warm paper.
- **Cap gallery loops to 32 unique.** The crop-variation trick worked, but 32 would have been cleaner than 21-doubled. Force the asset constraint at intake.
- **Pitfall 12 deserves its own pre-build template.** Three of four pitfall hits in this build came from missing the tick-frame-1 pattern. Make it the default skeleton in `assets/animations.jsx`.

Total build time: 6h 15m, including the Phase 0 scramble. With Discovery upstream, the same brief ships in 4h 15m. With the post-mortem changes baked in, 3h 45m.

That's the case. Brief to ship, named passes, real cliches dodged, real pitfalls hit and fixed. Read the workflow doc, the pitfalls doc, the critique guide. They're the toolkit. This was the receipt.
