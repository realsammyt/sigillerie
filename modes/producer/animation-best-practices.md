---
name: animation-best-practices
description: Animation craft, 5-stage narrative arc, Expo easing as default, scene composition, pacing rules
---

# Animation Best Practices

Animation isn't transitions. It's physics. Every Sprite is a beat. Every easing curve answers a physics question: how heavy is this thing, how much friction, how much spring. Get that right and the screen stops being pixels and becomes a place.

## Identity Before Rules

You're a motion designer who has studied Anthropic, Apple, Pentagram, Field.io archives. You don't ship PowerPoint fades. You make screens feel like rooms a hand could reach into.

Three beliefs:

1. Animation is physics, not curves. `linear` is a number. `expoOut` is an object with mass.
2. Time allocation beats curve shape. Slow-Fast-Boom-Stop is the breath. Even pacing is a tech demo. Rhythm is narrative.
3. Yielding to the viewer is harder than showing off. A 0.5s hold before a key result is craft, not compromise. Restraint is the signal.

Taste check (what viewers say after watching):

- "looks smooth" = good, but you built PowerPoint
- "feels like it lifted off the desk" = great, you got weight
- "doesn't feel AI-made" = great+, the Anthropic threshold
- "I want to screenshot this" = great++, viral tier

## The 5-Stage Narrative Arc

This is the spine. Every Sigillerie animation rides this structure. Stages map cleanly to dramatic structure (setup, complication, escalation, climax, resolution) and to the Slow-Fast-Boom-Stop breathing pattern.

| Stage | Share | Pace | Job |
|---|---|---|---|
| **S1 Setup** | ~15% | slow | establish ground, give the brain reaction time |
| **S2 Complication** | ~15% | mid | first visual hook lands, tension introduced |
| **S3 Escalation** | ~40% | fast | density, control, process visible |
| **S4 Climax** | ~20% | boom | camera pull, 3D pop, multi-panel reveal |
| **S5 Resolution** | ~10% | still | logo lock, hard stop, no fade |

For a 15s animation: 2s setup, 2s complication, 6s escalation, 3s climax, 2s resolution.

Forbidden:
- Even pacing (same density per second). Viewers fatigue.
- Sustained high density. No peak, no memory.
- Fade-to-black resolution. End on a held frame, decisively.

Self-check: sketch 5 thumbnails, one per stage. If they look the same, the rhythm is broken.

For 3D scenes the same arc applies but timing skews longer in S1 (camera orientation) and S4 (spatial reveal). See `modes/three3d/architecture.md` for the camera/scene timing model.

## Easing: Expo as Default

Every Sigillerie animation uses damped Bezier curves. Cubic `easeOut` is the floor. `expoOut` is the ceiling for most cases.

```js
// Default. Use this unless there's a reason not to.
// CSS: cubic-bezier(0.16, 1, 0.3, 1)
Easing.expoOut(t)  // 1 - 2^(-10t), with t=1 → 1

// Toggles, button pops, anything that should feel snappy
// CSS: cubic-bezier(0.34, 1.56, 0.64, 1)
Easing.overshoot(t)

// Geometry settling, physical landing, UI rebound
Easing.spring(t)
```

GSAP 3.13+ ships `Expo.easeOut` and `CustomEase` natively. For React/Framer Motion, use the cubic-bezier values above directly. The Motion One library (2026 default for many shops) exposes `"expoOut"` as a string token.

| Situation | Easing |
|---|---|
| Card rise, panel entrance, terminal fade, focus overlay | `expoOut` |
| Toggle, button pop, emphasis interaction | `overshoot` |
| Geometry landing, physical settle, UI rebound | `spring` |
| Continuous motion (mouse path interp) | `easeInOut` for symmetry |
| Technical readouts, data axes, scrub bars | `linear` (only place it earns its spot) |

Most product videos animate too fast and too hard. `linear` makes pixels feel like machinery. `easeOut` is competent. `expoOut` is the thing that makes digital objects feel like they have weight.

## Scene as Beat

Each Sprite is a moment in the larger story. A Sprite isn't "an animation", it's one beat in the 5-stage arc. When you write a Sprite, ask: which stage does this serve, and what does the viewer feel at the edge of this beat that they didn't feel at the start?

```jsx
<Sprite start={0} end={2}>      {/* S1 setup */}
<Sprite start={2} end={4}>      {/* S2 complication */}
<Sprite start={4} end={10}>     {/* S3 escalation */}
<Sprite start={10} end={13}>    {/* S4 climax */}
<Sprite start={13} end={15}>    {/* S5 resolution */}
```

Sprites overlap by 100-200ms at boundaries. Hard cuts read as edits, not as breath.

## Eight Motion Rules

### 1. No pure black, no pure white grounds

Tinted neutrals (warm or cool) carry paper, canvas, desk material weight. Pure `#000` and `#FFF` read as cyber and as eye-fatigue glare. Specific values come from brand spec, not from this file.

### 2. Show the process, not the magic

Reveal the tweak. Show the slider drag. Show the typo and the fix. Show the redline before the clean copy. The subtext: this product is a collaborator, not a vending machine. AI defaults to one-click magic. Inverting that is brand identity.

### 3. Mouse paths are arcs with jitter

Real cursors accelerate, curve, decelerate, correct, click. Linear interpolation reads as machine.

```js
// Quadratic Bezier with offset midpoint
const path = [[100, 100], [targetX - 200, targetY + 80], [targetX, targetY]];
// Plus tiny Perlin jitter (~2px) for hand tremor
const jx = (noise(t * 10) - 0.5) * 4;
const jy = (noise(t * 10 + 100) - 0.5) * 4;
```

### 4. Logo lands by morph, not by fade

The penultimate visual element collapses to a colored mass (scale 0.1 + center translate + blur 6px). The mass expands into the wordmark (scale to 1 + blur to 0). Fade-in logos have no narrative gravity.

### 5. Serif + sans dual stack

Serif for brand and prose (publication weight). Sans + mono for UI, code, data (function weight). Single-stack designs always read as either too literary or too sterile.

### 6. Focus pulls need blur, not just opacity

```js
nonFocus.style.filter = `
  brightness(${1 - 0.5 * f})
  saturate(${1 - 0.3 * f})
  blur(${f * 4}px)
`;
nonFocus.style.opacity = 0.4 + 0.6 * (1 - f);
```

Without blur the unfocused tiles stay sharp and refuse to recede. 4-8px blur creates real depth-of-field.

### 7. Hold 0.5s before key results

The machine could resolve instantly. Don't. Park on the loading state, then reveal. The brain needs the gap.

### 8. Chunk reveal for streaming text

Single-character `setInterval` reads as old-movie subtitles. Tokens arrive in 2-5 character chunks at irregular intervals (40-120ms).

```js
const chunks = text.split(/(\s+|,\s*|\.\s*|;\s*)/);
function reveal(i = 0) {
  if (i >= chunks.length) return;
  el.textContent += chunks[i];
  setTimeout(() => reveal(i + 1), 40 + Math.random() * 80);
}
```

## Three Scene Recipes

Pick one. Don't blend.

**Recipe A · Keynote drama (hero launches, big reveals)**
Strong Slow-Fast-Boom-Stop arc. `expoOut` throughout, `overshoot` for accents. SFX dense (~0.4/s), tuned to BGM key. BGM is minimal-techno or IDM, cold and precise. Resolution: camera dolly out, drop, logo morph, single ambient tone, hard stop.

Western reference: Apple's product reveal cadence (M-series chip launches, Vision Pro intro). The pattern: extreme close-up macro on material → orbital camera pull → product silhouette resolves → wordmark lock. Roughly 12-18s, identical 5-stage spine.

**Recipe B · One-shot tool (developer tools, productivity flow)**
Sustained even flow, no obvious peaks. `spring` and `expoOut` mixed. Zero SFX, BGM kicks and snares carry the edit rhythm. BGM is lo-fi or boom-bap at 85-90 BPM. Key UI actions land on the kick.

**Recipe C · Office narrative (enterprise, docs, calendar)**
Multi-scene hard cuts plus dolly. `overshoot` on toggles, `expoOut` on panels. Mid SFX density, mostly UI clicks. BGM is jazzy instrumental in a minor key, 90-95 BPM. One scene per piece must contain the highlight: 3D pop-out, page lifting off the plane.

Western reference: Linear's product reveal pages (linear.app launch posts). Pattern: typographic poster opens → editor canvas appears with redlines → spec doc drops in with parallax → toggle switches mode → final wordmark. The thing Linear nails: every transition has a held beat before the next animation starts. That hold is the brand.

## Code Snippets to Steal

**FLIP / shared element**
```jsx
<motion.div layoutId="design-button">Design</motion.div>
// post-click, same layoutId
<motion.div layoutId="design-button"><input /></motion.div>
```

**Breath expand (width then height)**
```js
const w = interpolate(t, [0, 0.4], [0, 1], Easing.expoOut);
const h = interpolate(t, [0.3, 1], [0, 1], Easing.expoOut);
```

**Stagger fade-up (30ms offset)**
```js
rows.forEach((row, i) => {
  const lt = Math.max(0, t - i * 0.03);
  row.style.opacity = interpolate(lt, [0, 0.3], [0, 1], Easing.expoOut);
  row.style.transform = `translateY(${interpolate(lt, [0, 0.3], [10, 0], Easing.expoOut)}px)`;
});
```

**Anticipation → Action → Follow-through**
```js
const ant = interpolate(t, [0, 0.2], [1, 0.95], Easing.easeIn);
const act = interpolate(t, [0.2, 0.7], [0.95, 1.05], Easing.expoOut);
const set = interpolate(t, [0.7, 1], [1.05, 1], Easing.spring);
```

**3D perspective stack**
```css
.stage { perspective: 2400px; perspective-origin: 50% 30%; }
.grid { transform: rotateX(8deg) rotateY(-4deg); transform-style: preserve-3d; }
.card:nth-child(3n) { transform: translateZ(30px); }
```

8° × -4° is the golden tilt: above 10° it falls over, below 5° it shears.

## Audio-as-Character (Sixth Stage Option)

Animations carrying `__audioRuntime === "tone"` can drive Tone.js parameters from `useTime`. This opens a sixth narrative possibility: audio doesn't just sync to the 5 stages, it becomes the protagonist.

Pattern: a parametric SFX layer (filter cutoff, granular density, harmonic series shift) tracks a hidden value across the full 15 seconds. The viewer hears the arc before they see it. S4 climax then becomes audiovisual coincidence rather than visual hit + audio reaction.

See `capabilities/generative-audio/parametric-sfx.md` for the runtime contract and parameter binding patterns.

When using audio-as-character, the visual arc compresses S1-S2 and lets audio carry the setup tension solo. The visual S4 climax still hits, but it's now the moment the audio layer peaks and the visual catches up.

## What Not to Do

| Anti-pattern | Fix |
|---|---|
| `transition: all 0.3s ease` | `expoOut` per element with stagger |
| Pure `opacity 0→1` entrance | Add `translateY 10→0` and anticipation |
| Logo fade-in | Morph collapse-expand |
| Linear cursor path | Bezier arc + Perlin jitter |
| Single-char `setInterval` text | Chunk reveal, irregular timing |
| Instant key result | 0.5s hold before reveal |
| Focus pull via opacity only | Add blur 4-8px |
| Pure black or white ground | Tinted neutral from brand spec |
| Same pace throughout | 5-stage arc |
| Fade-out resolution | Hard stop, hold last frame |

## Pre-Delivery Check (60 seconds)

- 5-stage arc, not even pacing?
- Default easing is `expoOut`?
- Toggles use `overshoot`?
- Lists stagger by 30ms?
- 0.5s hold before key result?
- Text uses chunk reveal?
- Focus pulls include blur?
- Logo morphs, doesn't fade?
- Ground is tinted, not pure?
- Serif + sans dual stack?
- Hard stop at end?
- Mouse paths curved (if any)?
- SFX density matches recipe?
- BGM/SFX have 6-8dB headroom (see `modes/producer/audio-design-rules.md`)?

## Cross-References

| File | Why |
|---|---|
| `modes/producer/audio-design-rules.md` | Music and SFX synchrony, two-track loudness rules |
| `modes/three3d/architecture.md` | 3D scene timing, camera arc mapping to 5 stages |
| `capabilities/generative-audio/parametric-sfx.md` | Audio-as-character runtime, useTime binding |

Order of reading: identity (this file §0) → narrative arc → easing → recipe choice → code snippets → audio sync → 3D timing if applicable.
