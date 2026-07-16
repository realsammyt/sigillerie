---
name: core-asset-protocol
description: 5-step brand-asset acquisition protocol used before any hi-fi work, prevents 60-65 point ceiling outputs that result from working without context
---

# Core Asset Protocol

The single hardest constraint in producer mode. Skipping any step caps output quality at 60-65/100. Walking the protocol moves the same brief into 85-95/100 territory. The cost is roughly 30 minutes. The cost of skipping is 1-2 hours of rework and a deliverable the client doesn't recognize as theirs.

The protocol fires whenever the brief names a real brand, product, or company. Stripe, Linear, Anthropic, Notion, Lovart, DJI, the user's own company. Doesn't matter whether the user offered assets first. If a brand is named, the protocol runs.

A precondition: fact-verification before assumption. Before walking these five steps, confirm the product exists and you know its current state. If you're not sure whether v4 has shipped, what the spec is, or whether the company still uses the old name, search first. The protocol assumes that question is already settled.

---

## The Asset Hierarchy

Brand identity is "the thing gets recognized." Recognition runs on a strict ordering of asset types, not a flat list. Producer mode treats this hierarchy as load-bearing.

| Asset | Recognition contribution | Required when |
|---|---|---|
| **Logo** | Highest. Any brand becomes itself the moment its logo appears. | Any named brand. No exceptions. |
| **Product photos / official renders** | Very high. The hero of any physical product is the product itself. | Physical products (hardware, packaging, consumer goods). |
| **UI screenshots** | Very high. The hero of any digital product is its interface. | Digital products (apps, websites, SaaS). |
| **Color palette** | Medium. Helpful, but on its own collides with every other brand using the same hex. | Supporting. |
| **Typography** | Low. Reinforces the above. Doesn't establish recognition alone. | Supporting. |
| **Vibe keywords** | Low. For agent self-checks, not output. | Supporting. |

Translated to execution rules:

1. Pulling color values and typography while skipping logo, product photos, and UI is a protocol violation.
2. Replacing real product photos with CSS silhouettes or hand-drawn SVG is a protocol violation. The result is "generic tech animation," black bg + orange accent + rounded bars, looks identical for every product, recognition lands at zero.
3. Failing to find an asset and silently filling with generic content is a protocol violation. Stop and ask. Or hand to Discovery. Or write a placeholder labeled honestly.

Color and type are real and useful. They're just not the spine. The spine is logo, product, UI.

---

## The Five Steps

### Step 1. Ask

One pass, the full checklist. Don't ask "do you have brand guidelines?" The user doesn't know what counts as guidelines. Ask the list:

```
For <brand/product>, which of these do you have on hand? In priority order:
1. Logo (SVG, high-res PNG). Required for any brand.
2. Product photos / official renders. Required for physical products.
3. UI screenshots / interface assets. Required for digital products.
4. Color values (hex, RGB, palette).
5. Typography (display, body).
6. Brand guidelines PDF, Figma design system, brand site link.

Send what you've got. I'll find or generate the rest.
```

If the user has it, take it. If they don't, Step 2.

### Step 2. Acquire

Search official sources by asset type. Path tables:

| Asset | Where to look |
|---|---|
| **Logo** | `<brand>.com/brand`, `/press`, `/press-kit`, `brand.<brand>.com`, inline SVG in homepage header |
| **Product / renders** | Product detail page hero + gallery, official launch films (frame-grab), official press releases |
| **UI screenshots** | App Store / Play Store product page, official screenshots section, official demo videos |
| **Color** | Inline CSS, Tailwind config, brand guidelines PDF |
| **Type** | `<link rel="stylesheet">` references, Google Fonts requests, brand guidelines |

Web search fallback queries:
- Logo: `<brand> logo download SVG`, `<brand> press kit`
- Product: `<brand> <product> official renders`, `<brand> <product> product photography`
- UI: `<brand> app screenshots`, `<brand> dashboard UI`

Download paths, three fallbacks per asset:

**Logo.** (1) Standalone SVG/PNG file. (2) Pull homepage HTML, grep the inline `<svg>` node for the logo. (3) Official social avatar (GitHub, X, LinkedIn) as last resort, usually a clean transparent PNG.

**Product photos.** (1) Hero image from the official product page. (2) Press kit downloads. (3) Frame-grab from the official launch video via `yt-dlp` + `ffmpeg`. (4) Wikimedia Commons. (5) AI generation (e.g. nano-banana-pro) using a real product photo as reference. Never replace with CSS or hand-drawn SVG.

**UI screenshots.** (1) App Store / Play Store screenshots, but check whether they're real UI or marketing mockup. (2) Official site's screenshot section. (3) Frame-grab from product demo videos. (4) Latest version captured from official social posts. (5) If user has an account, ask them to screenshot the live UI.

The 5-10-2-8 quality bar (applies to all non-logo assets):

- 5 search rounds across distinct channels.
- 10 candidates collected before filtering.
- 2 finalists chosen.
- Each finalist scores 8/10 or higher across resolution, license clarity, brand-fit, lighting/composition consistency, narrative role.

Below 8/10, drop the asset. An honest placeholder beats a 7/10 stand-in. Logos exempt from 5-10-2-8: any real logo beats no logo.

If acquisition truly fails, hand off to Discovery Studio. See `modes/discovery/asset-pathways.md`. Discovery is Sigillerie's canonical filler for missing assets, replacing the older "go find them yourself" recommendation. Producer doesn't have to solve this alone.

### Step 3. Verify

Each asset gets a verification pass before it enters the spec.

| Asset | Verification |
|---|---|
| **Logo** | File opens, transparent background, at least two versions (dark-bg, light-bg) |
| **Product photos** | One frame ≥ 2000px, clean or removed background, multiple angles (hero, detail, in-context) |
| **UI screenshots** | Real resolution (1x/2x), current version, no leaked user data |
| **Color** | `grep -hoE '#[0-9A-Fa-f]{6}' assets/<brand>-brand/*.{svg,html,css} \| sort \| uniq -c \| sort -rn \| head -20`, then strip black/white/grey |

Two traps to watch:

**Demo-brand contamination.** Product UI screenshots often show example brands in the canvas. The example brand's color isn't the host brand's color. When two strong colors appear, isolate which belongs to whom.

**Multi-facet brands.** A brand's marketing site palette and product UI palette often differ. Lovart's marketing is warm cream + orange; the product UI is charcoal + lime. Both real. Pick the facet that matches the deliverable.

### Step 4. Freeze

Write `brand-spec.md`. This is the canonical freeze artifact for the brief. Schema home: `capabilities/_shared/brand-spec-schema.md`. The minimum surface below is the working baseline.

Minimum surface:

```markdown
# <Brand> · Brand Spec
> Captured: YYYY-MM-DD
> Sources: <list>
> Completeness: <full / partial / inferred>

## Core assets

### Logo
- Primary: assets/<brand>-brand/logo.svg
- Inverse: assets/<brand>-brand/logo-white.svg
- Usage: <intro / outro / corner watermark / global>
- Forbidden: <no stretch, no recolor, no stroke>

### Product photos (physical products)
- Hero: assets/<brand>-brand/product-hero.png (2000x1500)
- Detail: assets/<brand>-brand/product-detail-1.png, -2.png
- Scene: assets/<brand>-brand/product-scene.png

### UI screenshots (digital products)
- Home: assets/<brand>-brand/ui-home.png
- Feature: assets/<brand>-brand/ui-feature-<name>.png

## Supporting assets

### Palette
- Primary, Background, Ink, Accent (with source notes)
- Forbidden colors: <colors the brand explicitly avoids>

### Typography
- Display, Body, Mono

### Signature details
- The 1-2 details done at 120%

### Anti-brand
- What this brand is not

### Vibe keywords
- 3-5 adjectives
```

Discipline rules once the spec is written:

1. Every HTML file references real asset paths from the spec. No CSS silhouettes substituting for product photos.
2. Logos appear as `<img>` references to real files, never redrawn.
3. Product photos appear as `<img>` references to real files, never replaced with CSS.
4. CSS variables get injected from the spec: `:root { --brand-primary: ...; }`. HTML uses `var(--brand-*)` only.
5. Brand consistency moves from "by discipline" to "by structure." Adding a new color means editing the spec first.

Audio-capable briefs extend the spec with `## Audio Brand`. Schema in `capabilities/generative-audio/brand-audio-spec.md`.

### Step 5. Reference

Producer mode reads `brand-spec.md` at the start of every brief. This is the audit-on-load rule.

If the spec exists, treat it as ground truth, attach it to the working context, and proceed.

If the spec is missing, fail open, don't fail closed:

```
brand-spec.md not found for <brand>.

Two options:
A) Run Discovery Studio to generate the missing spec (~30 min, produces full asset set).
   See modes/discovery/asset-pathways.md.
B) Proceed with honest placeholders (gray blocks + text labels marked
   "asset pending"). Lower quality ceiling. Output flagged as draft.

Pick A or B.
```

Never proceed silently. The placeholder route stays valid, but the user is told what they're getting.

---

## What Happens Without Real Assets

Without the protocol, output drifts to AI defaults: black background, orange accent, rounded soft shapes, gradient halos, generic tech-y feel. Every brand looks the same. The fingerprint is "AI made this," not "this is my brand."

The fingerprint is cataloged in `modes/producer/content-guidelines.md` as named slop. Treat that file as the diagnostic, treat this file as the prevention.

---

## Case Studies

**Kimi animation.** Guessed "should be orange" from memory. Kimi is `#1783FF`, blue. Full rework.

**Lovart design.** A demo brand inside Lovart's product screenshots showed a strong red. The red got pulled as if it were Lovart's color. Nearly broke the entire deliverable.

**DJI Pocket 4 launch animation.** Older protocol pulled colors only. No DJI logo download, no Pocket 4 product photo, CSS silhouettes in place of the camera. The output read as generic black-bg orange-accent tech animation. The product itself was invisible. This is what triggered the v1.1 upgrade from "brand asset" to "core asset."

**Stripe asset library.** Stripe publishes a full press kit at `stripe.com/newsroom/brand`: logo (SVG, light/dark), product screenshots, color spec (Slate `#425466`, Stripe Purple `#635BFF`), the Sohne typeface licensed for marketing. Walking the protocol against Stripe takes 10 minutes because the company already did the work. The deliverable picks up Stripe's actual visual signature instead of a generic SaaS gradient.

**Linear brand kit.** Linear keeps its brand assets at `linear.app/brand`: monochrome logo, brand color (`#5E6AD2`), Inter customizations, motion guidelines. Pulling these and freezing them in `brand-spec.md` gets you a Linear-feeling output. Skipping them gets you another purple SaaS landing page that could be anyone.

The pattern across all five: the protocol's cost is fixed and small. The cost of skipping it scales with the importance of the brief.

---

## Cross-References

- `modes/discovery/asset-pathways.md`. Discovery's generation and acquisition routes per asset type. Canonical filler when the brief lands without assets.
- `modes/producer/content-guidelines.md`. Named slop catalog. What outputs look like when this protocol is skipped.
- `capabilities/_shared/brand-spec-schema.md`. Schema home for the freeze artifact.
- `capabilities/generative-audio/brand-audio-spec.md`. The `## Audio Brand` extension to `brand-spec.md` for audio-capable briefs.
