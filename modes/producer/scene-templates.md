---
name: scene-templates
description: Starter templates by output type, landing hero, App prototype, slide deck, infographic, animation reveal. Each template has structure, asset slots, animation timing.
---

# Scene Templates

Starter templates by output type. Producer picks one, customizes per brand-spec.

> Pair with `design-styles.md`. Formula: `[style DNA] + [scene template] + [content brief]`.

Template = skeleton (canvas, duration, framerate, arc, slots). Brand-spec = flesh (palette, type, voice). Pick, then fill.

---

## 1. Landing Hero

Above-the-fold. Value prop in 5s.

- **Canvas**: 1440 x 900 desktop hero, responsive down to 360
- **Duration**: 6s loop or scroll-locked reveal
- **Framerate**: 60fps where animated
- **Animation arc**: state A (still) → reveal (1.2s ease-out) → resting state with subtle ambient motion
- **Asset slots**: headline (8 words max), subhead (20 words max), CTA button, hero visual (image / 3D / motion)
- **Stage stages**: composition, motion, polish

Recommended styles: 05 Locomotive, 01 Pentagram, 11 Build, 06 Active Theory.

```
[style DNA]
- Landing hero, 1440 width, 100vh
- Core value visible in 5s, no scroll
- Single CTA, high contrast vs hero visual
- Reveal: 0-200ms hold, 200-1400ms stagger, 1400ms+ ambient
- Mobile: stack, hero visual below fold
```

---

## 2. App Prototype (iOS / Android)

Interactive screen flow in a device frame. Tappable, real data, real state.

- **Canvas**: iOS 390 x 844pt (iPhone 15), Android 360 x 800dp, iPad 1024 x 1366pt
- **Duration**: per-screen, no fixed length; transitions 250-400ms
- **Framerate**: 60fps for transitions and gestures
- **Animation arc**: tap → 200ms feedback → 300ms screen transition → settle
- **Asset slots**: status bar, nav bar, content scroll region, tab bar, modal layer
- **Stage stages**: structure, interaction, motion, polish

44pt min tap targets. State manager across taps. Real images from Wikimedia / Met / Unsplash, no lorem-ipsum.

Recommended styles: 17 Takram, 11 Build, 03 Information Architects, 01 Pentagram.

```
[style DNA]
- App UI, [iOS 390x844pt / Android 360x800dp]
- 44pt min tap targets
- Standard chrome per platform conventions
- Tap feedback under 100ms, transitions 250-400ms
- State manager across screens
- Real photography, no placeholder grays
```

Before delivery: Playwright click-test every interactive.

---

## 3. Slide Deck

Presentation slides. One message per slide, projection-safe.

- **Canvas**: 16:9 (1920 x 1080) standard, 16:10 (1920 x 1200) widescreen
- **Duration**: per-slide, no auto-advance unless requested
- **Framerate**: 30fps for build animations
- **Animation arc**: slide enter (400ms) → element builds (staggered 150ms) → hold for narration → exit
- **Asset slots**: slide number, title (40pt+), body (24pt+), footnote (16pt+), one hero element per slide, optional speaker notes
- **Stage stages**: composition, hierarchy, motion, polish

60:40 image-to-text min. Whitespace, consistent spacing across deck.

Recommended styles: 01 Pentagram, 10 Müller-Brockmann, 11 Build, 18 Kenya Hara, 04 Fathom.

```
[style DNA]
- Slide deck, 16:9 (1920x1080)
- One message per slide
- Hierarchy: title 40pt+, body 24pt+, notes 16pt+
- Generous whitespace, projection-safe contrast
- Build: title → hero → supporting
- Speaker Notes layer for presenter-only context
```

---

## 4. Magazine Infographic

Static or scroll-revealed info graphic. Reading-ordered.

- **Canvas**: vertical 1080 x 1920 (mobile read), horizontal 1920 x 1080 (article embed), square 1080 x 1080 (social)
- **Duration**: static print-grade, or 8-15s scroll-reveal
- **Framerate**: 30fps for reveal animations
- **Animation arc**: top-of-fold lock → scroll-driven reveal section by section → footer source citation
- **Asset slots**: title block, key-stat hero, 3-7 content sections, source / methodology footer
- **Stage stages**: hierarchy, data fidelity, composition, polish

Hierarchy: title → headline number → details. Top-down eye flow. Data accurate, no distortion.

Recommended styles: 04 Fathom, 10 Müller-Brockmann, 02 Stamen, 17 Takram.

```
[style DNA]
- Infographic, [vertical 1080x1920 / horizontal 1920x1080 / square 1080x1080]
- Hierarchy: title → key stat → details
- Eye flows top to bottom
- Icons and small charts aid reading, not decoration
- Data-accurate, source at footer
- Print-grade type, legible at thumbnail
```

---

## 5. Animation Reveal

Short loop or one-shot. Hero motion for social, web, inline article.

- **Canvas**: 1920 x 1080 (web hero), 1080 x 1080 (social square), 1080 x 1920 (vertical)
- **Duration**: 6s, 12s, or 15s loop; 30s one-shot
- **Framerate**: 60fps base, 25fps export floor for MP4 / GIF
- **Animation arc**: cold open (0-500ms) → reveal (500ms-3s) → hold (3-5s) → loop seam or fade
- **Asset slots**: opening frame, reveal payload, resting frame, optional brand mark
- **Stage stages**: motion, polish

Invisible loop seam. Fade 200ms each side for one-shot. Palette-optimized GIF, H.264 MP4.

Recommended styles: 07 Field.io, 06 Active Theory, 08 Resn, 12 Sagmeister.

```
[style DNA]
- Animation reveal, [1920x1080 / 1080x1080 / 1080x1920]
- [6s / 12s / 15s loop, or 30s one-shot]
- 60fps base, export at 25fps for MP4/GIF
- Cold open → reveal → hold → invisible seam
- Brand mark final 1.5s if requested
- Palette-optimized GIF under 5MB
```

---

## 6. 3D Product Turntable

Hero product rotating. Camera orbit, lighting, materials.

- **Canvas**: 1920 x 1080 hero, 1080 x 1080 social
- **Duration**: 8-12s full rotation, looping
- **Framerate**: 60fps render, 30fps export floor
- **Animation arc**: ease-in start (0-500ms) → constant-velocity rotation (500ms-7.5s) → ease-out hold (7.5-8s) → loop with invisible seam
- **Asset slots**: GLB / USDZ model, environment HDRI, optional ground shadow, optional caption layer
- **Stage stages**: 3D scene, lighting, motion, polish

Cross-ref `modes/three3d/recipes.md` (camera rigs, lighting), `model-viewer.md` (embed contract), `ar-quicklook.md` (if AR ships too).

Recommended styles: 17 Takram, 01 Pentagram, 06 Active Theory.

```
[style DNA]
- 3D turntable, 1920x1080 (or 1080x1080)
- 8-12s loop, invisible seam, 60fps
- Camera orbit constant radius, ease-in/out at seam
- HDRI environment for material accuracy
- Ground shadow, no floating product
- GLB primary, USDZ for AR Quick Look
```

---

## 7. Data-Driven Scrollytelling

Long-scroll narrative driven by live data. Scroll advances chart state.

- **Canvas**: 1440 x viewport (desktop), 390 x viewport (mobile)
- **Duration**: scroll-paced, no fixed length; transitions 600-900ms per step
- **Framerate**: 60fps for chart morphs
- **Animation arc**: scene 1 establishes baseline → scroll triggers each subsequent scene → final scene rests on conclusion
- **Asset slots**: title block, 4-8 scenes (each with chart + caption), data source citation, optional methodology drawer
- **Stage stages**: data, hierarchy, motion, polish

Cross-ref `capabilities/data-viz/deliverable-types.md` (chart-type matrix), `animation-decisions.md` (transition rules), `duckdb-wasm.md` (browser-resident parquet).

Recommended styles: 04 Fathom, 02 Stamen, 10 Müller-Brockmann, 17 Takram.

```
[style DNA]
- Scrollytelling, 1440 desktop / 390 mobile
- 4-8 scroll-triggered scenes
- Chart morphs 600-900ms, ease-in-out
- Single chart frame, data swaps in place (no jump cuts)
- Caption tracks chart, sticky left or below
- Source + methodology in drawer
```

---

## 8. Knowledge-Graph Hero MP4

Force-directed graph reveal. Nodes settle, edges trace, camera lands on focus cluster.

- **Canvas**: 1920 x 1080 hero, 3840 x 2160 if 4K requested
- **Duration**: 12-20s
- **Framerate**: 60fps render, 30fps export floor
- **Animation arc**: nodes burst from center (0-2s) → force simulation settles (2-8s) → camera lands on focus cluster (8-11s) → labels fade in (11-13s) → hold or loop
- **Asset slots**: nodes JSON, edges JSON, palette per node-type, focus cluster ID, optional title overlay
- **Stage stages**: graph layout, motion, hierarchy, polish

Cross-ref `capabilities/knowledge-graph/deliverable-types.md` (format menu), `layout-algorithms.md` (force vs radial vs hierarchical), `color-and-style.md` (node-type palettes).

Recommended styles: 07 Field.io, 02 Stamen, 17 Takram.

```
[style DNA]
- KG hero MP4, 1920x1080, 12-20s, 60fps
- Force-directed settle, camera lands on cluster
- Edge-trace offset 100ms per depth ring
- Labels fade only after layout settles
- Palette encodes node-type, edge weight = thickness
```

---

## 9. Generative-Ambient Kiosk

Always-on installation visual + audio. Parametric, runs for hours, never exactly repeats.

- **Canvas**: 1920 x 1080 portrait or landscape, 4K if hardware permits
- **Duration**: indefinite, audio loops avoid identifiable seams
- **Framerate**: 30-60fps depending on visual density
- **Animation arc**: parametric drift, no fixed start or end; visual events triggered by audio amplitude or seeded RNG
- **Asset slots**: parameter set (seed, range, drift rate), audio bed, optional sensor input (Kinect, mic, touch)
- **Stage stages**: parametric system, motion, audio, polish

Cross-ref `capabilities/generative-audio/deliverable-types.md` (audio format menu), `parametric-sfx.md` (SFX recipes), `seed-library.md` (reusable seeds), `two-tracks.md` (visual-audio sync contract).

Recommended styles: 07 Field.io, 06 Active Theory, 18 Kenya Hara.

```
[style DNA]
- Ambient kiosk, 1920x1080 (or 4K)
- Indefinite runtime, no visible loop seam
- Parametric drift, seeded RNG with documented range
- Audio bed parametric, amplitude drives visuals (or vice versa)
- Optional sensor: Kinect / mic / touch
- Memory stable over 8+ hour run
```

---

## How to Invoke

1. Match output type to one of the nine templates.
2. Pick a style from `design-styles.md` per brand voice + audience.
3. Combine: style DNA + template block + content brief.
4. Customize: canvas, duration, palette per brand-spec.
5. Verify: run the Stage stages listed before delivery.

If none of the nine fit, the request is hybrid. Pick dominant, borrow slots from a second.

---

v1.0 · 2026-04-27
