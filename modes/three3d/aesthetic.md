---
name: aesthetic
description: 3D aesthetic rules. Focal hierarchy, lighting, materials, postprocessing, type rendering, camera. The taste layer between Stage3D and a deliverable that looks expensive.
---

# 3D Aesthetic · Taste Rules

Stage3D + recipes give you primitives. This doc gives you taste. Read before authoring any 3D scene that ships to a real audience.

## 1. Focal hierarchy is non-negotiable

One hero. Everything else supports.

| Role | Size | Brightness | Sharpness | Examples |
|---|---|---|---|---|
| Hero | largest | brightest | full focus | the product, the title, the headline |
| Supporting | 60-75% of hero | 60-80% of hero | full focus | subtitle, secondary CTA, supporting figure |
| Context | 30-50% of hero | 30-50% of hero | slight blur (DOF) | atmosphere, distant elements, frame chrome |
| Background | n/a | <20% of hero | heavy blur | gradient, particles, environment |

Anti-pattern: 4 panels of the same size with the same brightness, equally spaced. Eye has nowhere to land.

## 2. Lighting setup: 3-point minimum

Three named lights. Each does one job. None overlap in purpose.

| Light | Position | Intensity | Color | Job |
|---|---|---|---|---|
| **Key** | upper-front, ~45° from camera | 5-8 | neutral or slightly warm | shape definition, primary cast shadow |
| **Fill** | opposite side from key | 1-2 | cool complement | soften shadow side without killing it |
| **Rim / Back** | behind subject | 4-7 | strongest accent color | edge glow, separates subject from background |

Optional 4th: **Sweep spotlight** (tight cone, animated orbit) for moving "lit slice" effect. Reads as cinema-grade motion on glass surfaces. Use for hero animations only — too much for static viewing.

Avoid: ambient-only, hemisphere-only, or single directional. All look amateur.

## 3. Material rules

Real glass needs a real environment to refract. PBR metal needs a real environment to reflect. If you set transmission/metalness without an envMap, materials read as flat tinted plastic.

| Material | Required setup | Common mistake |
|---|---|---|
| Glass / transmissive | `envMap` (PMREM-processed RoomEnvironment or HDRI), low roughness, low transmission (0.3-0.6 not 0.9), thickness > 0.3 | high transmission with no envMap = flat colored rectangle |
| PBR metal | `envMap`, metalness > 0.7, roughness 0.1-0.4 | metal without env = grey rubber |
| Standard / diffuse | three-point lighting, slight subsurface or sheen | pure flat color = paper |
| Emissive | only on tiny accents (badges, indicators), never on hero | full-emissive panels = SaaS dashboard |

**The transmission rule**: `transmission > 0.7` only when there's a high-contrast environment behind the object that the user can see refracting. Otherwise drop to 0.3-0.5 so the panel catches direct light visibly.

## 4. Postprocessing as default for hero deliverables

Three passes that turn "rendered three.js" into "looks like After Effects". Apply by default for hero animations, MP4 exports, marketing pieces.

| Pass | Purpose | Default settings |
|---|---|---|
| **Bloom** (UnrealBloomPass) | bright spots glow softly, sells the "premium" feel | `strength: 0.4, radius: 0.7, threshold: 0.85` |
| **Depth of Field** (BokehPass) | hero in focus, context softly blurred | `focus: <hero distance>, aperture: 0.0002, maxblur: 0.012` |
| **Vignette** | dark edges focus eye on center | `offset: 0.95, darkness: 1.4` |
| **Optional: chromatic aberration** | subtle edge color shift, "lens" feel | `0.0008` magnitude max — more than that is parody |

Apply via `assets/tsl-effects.js` `applyBloom()`, `applyDOF()`, `applyVignette()`. Cost: +30-50ms per frame on Titan-class GPU. Worth it.

Skip when: data-viz (clarity > polish), interactive prototypes (perf budget), still images (use higher resolution instead).

## 5. Type rendering and UI-in-3D

Pick by content shape, not by reflex. UI-shaped content (panels with layout, lists, components) gets uikit. Single labels on objects get troika.

| Approach | Quality | Cost | Use when |
|---|---|---|---|
| **`@pmndrs/uikit`** (vanilla) / **`@react-three/uikit`** (R3F) | full flexbox UI in 3D space — panels, text, components, theming, yoga-driven layout | ~150KB + Yoga WASM ~80KB | **DEFAULT for spatial UI**: holo decks, multi-panel scenes, anything resembling a real interface in 3D |
| **`troika-three-text`** (SDF) | sharp single-text labels at any zoom | 80KB lib + ~1ms per frame | single text on a 3D object: turntable caption, axis label, hover name tag |
| **CanvasTexture at 4× resolution** | OK if not camera-approached | proportional to canvas size | tiny static accents only — fallback for ultra-light bundles |
| **drei `Html` portal** | crisp DOM text positioned in 3D | DOM cost, not in WebGL | text needs to be selectable / accessible / clickable / SEO-visible |
| **TextGeometry** | extruded 3D type, vertex-shaded | font load + vertex cost | hero-only single-word title with extrusion (rare) |

**Default rule**: `uikit` is the spatial-UI default. `troika-three-text` is the single-label default. CanvasTexture is a fallback when bundle budget is tight, but it pixelates against high-resolution capture (4K) and should not be the default.

Track A (vanilla single-file): use `@pmndrs/uikit` via importmap-loaded ESM. Track B (R3F + Vite): use `@react-three/uikit` natively in JSX.

## 6. Camera and lens

Default camera setup matters more than people expect.

| Property | Default | Why |
|---|---|---|
| `cameraType` | perspective | orthographic kills depth cues |
| `fov` | 35 | 50+ is too wide, distorts edges; 25 is telephoto-flat |
| `cameraNear` / `cameraFar` | 0.1 / 100 | tighter `near` enables better depth precision |
| Camera motion | slow + ease-out | rapid linear pan reads as game engine, not film |

Slight motion is mandatory for hero deliverables. A locked camera + animated subjects looks artificial. Even 0.1° drift over 8 seconds reads as "alive".

## 7. Color discipline

| Rule | Why |
|---|---|
| One accent color | brand identity. Two accents only when the brand spec demands it. |
| Warm/cool axis | hero in warm, supporting in cool (or vice versa). Same temp = flat. |
| 80% mid-tones, 15% shadows, 5% highlights | the cinematography rule. Even mid-tones read as washed-out. |
| Avoid mid-blue + mid-blue | "SaaS blue glass" is a named slop. Pick a side. |
| Background luminance ≠ subject luminance | minimum 30% delta between subject and bg luminance |

## 8. Composition

| Rule | Application |
|---|---|
| Rule of thirds | hero on a third-line, not dead center |
| Headroom | 15-20% empty above the hero, more below |
| Negative space | 60% of the frame is breathing room. Less = busy = amateur |
| Z-depth ladder | hero closest, support 1-2 units back, context 3-5 units, background 8+ |
| Asymmetry | symmetric arrangements look like PowerPoint. Always offset slightly. |

## 9. The honest hierarchy

If you can only do three things:

1. **Add bloom + vignette + DOF.** Single biggest "expensive" upgrade.
2. **Light with three-point + rim.** Skip ambient-only.
3. **Pick ONE focal element. Make it 1.5× bigger and 1.5× brighter than everything else.**

Most ugly 3D scenes break all three. Most good ones honor all three.

## 10. Anti-patterns (the named slop)

Each is a failure the critic agent (G4) scans for by name.

| Name | Pattern | Fix |
|---|---|---|
| **SaaS blue glass** | uniform translucent blue panels with transmission | one tinted, others opaque or different material |
| **Uniform panel grid** | 4 panels of same size, same spacing | break with size hierarchy + asymmetry |
| **Centered everything** | hero dead-center, perfectly framed | offset to a third line |
| **Blue-on-blue** | mid-blue subject on mid-blue bg | luminance delta + cool background |
| **Flat ambient lighting** | only `AmbientLight` or only `HemisphereLight` | three-point + rim |
| **No postprocessing** | raw three.js render shipped to social | bloom + vignette mandatory for hero |
| **Pixelated canvas type** | CanvasTexture text at lower res than capture | uikit for UI panels; troika for single labels |
| **Default sphere / cube / torus** | unmodified primitives | round corners, sub-surf, asymmetry, surface noise |
| **Visible CSS perspective fakery** | 2D plane with `transform: perspective` pretending to be 3D | use real `PerspectiveCamera` + 3D geometry |
| **Equal weight** | every element same size + brightness | hierarchy table in §1 |
| **Stacked-z parallel** | content panels arrayed on z-axis | curved arc or hero+overlay (see `architecture.md`) |
| **No focal point** | eye lands nowhere | one hero, force the rest down |
| **Choice Paralysis** | 3D chooser presents 5+ equal-weight direction tiles with no visual hierarchy or default highlight. User stalls. | Choice Overload, Hick's Law | Mark one tile as "Recommended" or visually distinguish with scale/brightness. |
| **Cognitive Blowout** | Scene has 7+ independent focal elements at the same z-depth, all at full brightness. Eye has no path. | Miller's Law, Cognitive Load | Collapse to 1 hero + 4 max supporting. Everything else is context or background. |
| **Spatial Orphan** | Related UI panels float in 3D space without a shared bounding box or visual connector. User can't tell what belongs together. | Law of Common Region | Wrap related panels in a uikit container or add a subtle backdrop plane behind them. |
| **Angular Midget** | Interactive button rendered at a size that looks fine on a 27" monitor but subtends under 1.5° at spatial viewing distance. Users can't point at it. | Fitts's Law | Check angular size at target viewing distance. Minimum 2° for all interactive targets. |
| **Invisible Peak** | Hero animation has no discernible moment of maximum interest. All stages run at the same visual intensity. | Peak-End Rule | Identify the climax keyframe explicitly. Boost bloom, scale, or camera speed at that moment. |
| **Terminal Anticlimax** | A 3D sequence ends on a context element (background, atmosphere) rather than on the hero or CTA. | Peak-End Rule, Serial Position | Route the closing camera to the hero or CTA panel. The last thing seen is most remembered. |

## 11. Where to apply

| Deliverable type | Apply rules from |
|---|---|
| Hero animation MP4 | all sections, especially §1, §4, §5 |
| Spatial slide deck | §1, §2, §3, §6, §8 |
| AR product preview (`<model-viewer>`) | §3 (material), §6 (camera) — postprocessing handled by model-viewer |
| Data viz in 3D | §1 (hero = data), §6, §7. Skip §4 (DOF kills clarity). |
| Knowledge graph 3D | §1 (focus node), §7 (color discipline), §6 (slow camera) |
| Interactive prototype | §1, §2, §3, §6. Skip §4 (perf). |

## 12. Recipe defaults (what we ship by default)

Every recipe in `assets/recipes/` should respect these defaults unless the caller explicitly opts out:

- Three-point lighting (key + fill + rim) configured at sensible intensities
- envMap set (PMREM RoomEnvironment if no HDRI provided)
- Bloom on by default, threshold 0.85
- Vignette on by default
- DOF off by default (focus depth is per-deliverable)
- Camera fov 35°, perspective, slight idle drift
- Background: gradient sphere or HDRI, not flat color

Recipes that violate these are the place where ugly leaks in. Audit recipes when you change this doc.

## 13. UX laws in spatial context

Core UX laws don't stop at 2D. These are the spatial restatements.

### Fitts's Law: angular hit floor

Interactive targets in spatial UI have a minimum angular size, not a minimum pixel size.

| Platform | Viewing distance | Minimum target |
|---|---|---|
| Vision Pro (eyes + hand tracking) | 0.5-0.8 m | 44 pt physical = ~3.1° at 0.8 m |
| Quest 3 (ray-cast) | 0.6-1.2 m | 80 x 80 px at 72 PPI = ~3.6° at 0.9 m |
| Desktop WebGL (mouse) | 0.5-0.7 m | 32 x 32 px screen = ~2.6° at 0.6 m |
| Generic 3D infographic (no interaction) | n/a | Not applicable, no interaction targets |

For uikit panels: interactive buttons must have `padding` that brings the visual + hit area to the floor above. Use `pointerEvents: auto` only on regions that meet the floor.

### Jakob's Law: platform conventions before invention

Before designing any spatial UI:

1. State the target platform: Vision Pro / Quest / Desktop WebGL / abstract scene.
2. Map the critical conventions of that platform.
3. Deviate only with explicit rationale.

| Platform | Key conventions |
|---|---|
| Vision Pro | Glass panels, close button top-left, system ornaments white/translucent |
| Quest 3 | Social UI panels at 0.7 m, controls below content, Meta Sans or system font |
| Desktop WebGL | Orbital camera, panel in screen-space overlay OR world-anchored at hero distance |
| Abstract 3D | No fixed conventions. Focal hierarchy (§1) is the only rule. |

### Pragnanz: scene resolution to one reading

A 3D scene should resolve to one simple Gestalt from any stable camera position.

Test: describe the scene in one sentence without naming individual elements. If you can't, the scene has no Gestalt. Reduce until you can.

Per z-layer: maximum three distinct focal elements. Beyond three, the layer loses its reading.

### Cognitive Load: scene complexity cap

| Category | Maximum count |
|---|---|
| Hero elements (z = 0, full focus) | 1 |
| Supporting elements (z = 1-2 back) | 4 |
| Context elements (z = 3-5 back, slight blur) | 8 |
| Background / atmosphere (z = 8+) | unlimited |

Exceeding the supporting-element cap requires a spatial justification (carousel with one focus slot, sequential reveal that clears previous elements).

### Serial Position: first and last panels carry

Camera starts on panel A. Camera ends on panel B. The viewer best remembers A and B.

Put the product hero at the initial camera target. Put the CTA or closing message at the scene the camera rests on last. The journey between them can carry context, it won't anchor memory.

### Von Restorff: one conspicuous element per frame

One element per frame should break the visual rhythm. The focused card in `hero-shot.js` (1.4x scale, other cards at 0.85 alpha) is the canonical implementation. Do not break the rhythm in two places simultaneously, two anomalies cancel each other's isolation effect.
