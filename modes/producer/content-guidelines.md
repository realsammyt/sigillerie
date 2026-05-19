---
name: content-guidelines
description: Anti-AI-slop master catalog, named visual clichés to avoid, with Western and Chinese examples and remediation rules
---

# Content Guidelines: Named Slop Catalog

The catalog of clichés AI defaults to. Each entry is a named pattern. Each name is what the critic agent's G4 gate scans for. If the critic flags "default-purple SaaS landing," it means this catalog, this row.

Slop is the default. You don't get out of it by accident. You get out by knowing the names and refusing them by name.

This file is the master entry point for visual, brand, and typography slop. Capability-specific catalogs live elsewhere (see cross-reference table at end).

---

## How to Use This File

1. Building something? Skim the catalog before you start. Set negative constraints upfront.
2. Reviewing? Open this and the critic's report side-by-side. Match each flagged item to its row.
3. Onboarding? This is the doc. The named clichés are the shared vocabulary.

---

## Visual Slop

### Backgrounds and Surfaces

| Cliché | Why it's slop | What to do instead |
|---|---|---|
| **Aggressive gradient bg** (purple → pink → blue full-bleed) | Signature of AI-generated landing pages, 2023-2025 era | Solid color. If gradient, single hue, low chroma, intentional accent only (button hover, focal halo) |
| **Mesh gradient wallpaper** | Stable Diffusion's idea of "modern" | Flat surface. Texture via type and spacing, not blob fields |
| **Default-purple SaaS landing** (#7C3AED + Inter + bento) | Linear and Vercel did it well in 2022. Everyone copied. The look is now generic | Pick a hue with rationale. Anything but #7C3AED, #6366F1, or #8B5CF6 unless brand demands it |
| **Generic glassmorphism** (blurred translucent panels everywhere) | Apple did it once with intent. AI repeats it without intent | Max one glass surface per view. Use only when there's real depth (modal over photo, HUD over content) |
| **Neumorphism revival** (soft inner shadow, monochrome puffy buttons) | Bad accessibility, 2020 dead trend zombie-walking back | Flat. Or skeuomorphic with conviction. Not the in-between |
| **Abstract gradient mesh "AI-feel" hero** | Midjourney's defaults made this a tell | Real photograph or geometric placeholder block |

### Cards and Containers

| Cliché | Why it's slop | What to do instead |
|---|---|---|
| **Rounded card + left-border accent** (12px radius, 4px solid blue left edge) | The signature AI dashboard card. Stripe and Notion never did this | Background contrast, type weight contrast, plain rule, or no card at all. Emphasis through hierarchy, not chrome |
| **Identical-size card grid** | Looks like a CMS spat it out | Asymmetric grid. Mixed sizes. Some with image, some text-only. Some span columns |
| **Bento grid everywhere** | Apple's product page move, copied to death | Bento only when info structure genuinely is grid-of-tiles. Most landing pages aren't |

### Decoration

| Cliché | Why it's slop | What to do instead |
|---|---|---|
| **Emoji decoration** (rocket before "Fast", lightbulb before "Idea", checkmark in feature lists) | Reads as toy. Anthropic, Stripe, Linear never do this | Real icons (Lucide, Phosphor, Heroicons). Or no icon |
| **Excessive iconography** (every section header, every feature row) | Visual noise, no hierarchy | One icon per section max. Often zero |
| **SVG hero illustration** (AI-drawn people, scenes, devices) | Childish, instantly AI | A grey rectangle labeled "Illustration 1200x800" beats any AI-generated SVG hero. SVG is for icons (16-32px), geometric decoration, charts. Nothing else. For deterministic photo placeholders use `https://picsum.photos/seed/<name>/1200/800` (Lorem Picsum is free, seeded, repeatable) |
| **AI-generated logo** (perfect mirror symmetry, gradient orb plus abstract symbol, four-color blob) | The fingerprints are unmistakable: forced symmetry, vague abstract glyph, rainbow gradient inside | Wordmark in a real font. Real letterform with real intent. Or commission a designer |

### Manufactured Content

| Cliché | Why it's slop | What to do instead |
|---|---|---|
| **Data slop** / **Jane Doe Content** ("10,000+ happy customers", "99.9% uptime", made-up metric cards) | Fabricated stats are lies. Real users notice. Round numbers like 99.9 and 50% are AI tells | Placeholder. Ask for real numbers. Or remove the section. If a stat must render in the mockup, mark it `[placeholder]` inline so the reviewer can't miss it |
| **Quote slop** / **Jane Doe Content** (invented testimonials, fake names, fake company logos, "Sarah Chan from Acme") | Same problem. Unethical | Placeholder card with "Real quote pending." Ask user for actual quotes. Generic-sounding names (John Doe, Sarah Chan, Jack Su) and generic-sounding companies (Acme, Nexus, SmartFlow) are explicit tells |
| **AI-stock-photography defaults** (vaguely diverse team in vaguely modern office, smiling at vaguely a laptop) | The 2026 update of Getty stock. Same energy | Real photo from a real session. Wikimedia Commons. Met Open Access. Or labeled placeholder |

---

## Typography Slop

| Cliché | Why it's slop | What to do instead |
|---|---|---|
| **Inter** | The default AI generates. Linear used it well in 2021. Now it screams template | Geist Sans, Söhne, ABC Diatype, Söhne Mono, IBM Plex, JetBrains Mono. Or a real licensed face |
| **Roboto, Arial, Helvetica, system stack** | Lazy. Says nothing | Pair display + body with intent |
| **Fraunces everywhere** | AI discovered it in 2023, overran it | Instrument Serif, Cormorant, Tiempos, EB Garamond. Or Fraunces with restraint |
| **Space Grotesk** | The 2024-2025 AI darling | Bricolage Grotesque, Mona Sans, or commit to a different geometric like Sequel Sans |
| **No display/body pairing, single font everywhere** | Flat, no rhythm | Pair: serif display + sans body (editorial), mono display + sans body (technical), heavy display + light body (contrast) |

Font sourcing rules:

- Google Fonts has good options past the obvious. Look at Instrument Serif, Cormorant, Bricolage Grotesque, JetBrains Mono.
- Open-source foundries (Pangram Pangram, Velvetyne) for character.
- Never invent a font name. The browser will fall back to Times and the design dies.

---

## Color Slop

| Cliché | Why it's slop | What to do instead |
|---|---|---|
| **Invented palette from scratch** | Usually disharmonious. AI guesses badly at color | Pull from a known system (Radix Colors, Tailwind, Anthropic brand). Or eyedrop from a reference screenshot |
| **Default Vercel/Linear purple** (#7C3AED, #6366F1) | Signals AI SaaS template instantly | Justify your hue. If purple, shift the chroma or hue meaningfully. Or pick a different anchor |
| **HSL color juggling** | Hue drifts when you change lightness | Use OKLCH. Hue stays put, lightness scales cleanly |
| **Inverted dark mode** | Just flipping black/white isn't dark mode. Saturation, contrast, accent all need rework | If dark mode isn't designed, ship light only. Half-built dark mode is worse than none |

Approach:

```css
:root {
  --primary: oklch(0.65 0.18 25);
  --primary-light: oklch(0.85 0.08 25);
  --primary-dark: oklch(0.45 0.20 25);
}
```

OKLCH keeps perceived hue stable across the lightness ramp.

---

## Copy Slop

The visual side is half the work. Copy carries the other half, and AI defaults are just as recognizable. The voice catalog applies to body copy, headlines, button labels, and any user-facing string the deliverable renders. CLAUDE.md keeps the global banned-vocab list for AI prose; the entries below are the deliverable-content version of the same discipline.

| Cliché | Why it's slop | What to do instead |
|---|---|---|
| **Filler-verb headline** ("Elevate your workflow", "Unleash productivity", "Seamlessly integrate", "Leverage AI", "Robust and comprehensive", "Foster collaboration") | These verbs say nothing. They are the SaaS-template voice. AI defaults to them. The viewer's eye skips them | Use a concrete verb plus a concrete object. "Edit 4K video in your browser" beats "Unleash creative potential" |
| **Trend-bait adjectives** ("cutting-edge", "best-in-class", "next-gen", "revolutionary", "world-class", "game-changing") | Marketing taxonomy. Reads as filler. No buyer believes any of these claims | Cut. The product either is, or it isn't. Show evidence (specific feature, specific number) instead |
| **AI-tell vocab** ("delve", "tapestry", "navigate this challenge", "in the realm of", "embark on a journey") | These five phrases are the highest-signal AI tells in 2026. ChatGPT-3 era. They mark the copy as machine-written instantly | Strip on sight. The CLAUDE.md banned list is the source of truth |
| **Hedge clutter** ("perhaps", "somewhat", "quite", "fairly", "rather", "arguably") | Adds tokens without adding meaning. AI hedges by default; humans commit | Delete the hedge. If the claim is uncertain, restate it as a measured claim ("works for projects under 1M rows") instead of hedging the unmeasured one |
| **Vague closer** ("This represents a significant step forward", "An exciting new chapter", "We're thrilled to share") | Press-release closer. Says nothing. AI loves it | End on the most concrete thing the deliverable does. The closer earns its place or gets cut |
| **Listicle parallelism** (three bullets, each starting with the same gerund: "Building...", "Creating...", "Delivering...") | Reads as filler. The parallelism is a substitute for substance | Vary the structure. Mix declarative, question, and short fragment. Force the eye to actually read each item |
| **Number-stat hallucination** ("99.9% uptime", "10x faster", "Save 70% of your time") | Same problem as Jane Doe data slop. If the number isn't real, it's a lie | Ask for the real number. If it doesn't exist yet, omit the stat. "Faster than the previous version" with no number beats a fabricated multiplier |

Banned vocabulary list (deliverable copy, not just AI prose): delve, leverage, navigate (as verb), robust, comprehensive, seamless, ensure, foster, utilize, elevate, unleash, embark, tapestry, realm, journey (metaphor), game-changer, cutting-edge, best-in-class, next-gen, world-class, revolutionary, synergy, streamline, optimize (without object).

If the copy fails this section, the design's surface polish does not rescue it. Copy slop is a critic-G4 fail.

---

## Layout Slop

| Cliché | Why it's slop | What to do instead |
|---|---|---|
| **Hero + 3-column features + testimonials + CTA** | The exhausted SaaS landing template | If your story actually has these beats, fine. Otherwise break the pattern. Single-column long-form. Asymmetric. Weird |
| **Bento overuse** | Already noted. Repeating because it's the worst offender | See above |
| **Centered everything, max-width 1200px** | Web-template default | Edge-aligned grids. Full-bleed sections. Mixed alignment with rhythm |

---

## Case Studies

### Linear (does it right)

Linear ships a defined color system, a single typography stack with intent (Inter, used before it was overrun), and a real product behind it. The look became a template because it worked, not because Linear was lazy.

The lesson: copying Linear's surface in 2026 is slop. Copying Linear's discipline isn't.

### Stripe (does it right)

Custom illustration commissioned from real artists. Ship animations only when they explain something. Type system rooted in their own commissioned face. No emoji. No bento. No purple.

### Anthropic (does it right)

Claude's brand uses a serif (Tiempos-derived), warm neutrals, restrained accent. The opposite of default-AI-purple. This is intentional positioning against the slop.

### Notion (uses emoji intentionally)

Notion's emoji-as-page-icon is part of the product. Every page has one. This is not the same as decorating a CTA button with a rocket. Pattern matters more than presence.

### The "AI Landing Page" composite

Walk down any list of 2025 startup launches. Hero with mesh gradient, default purple, Inter, bento grid, three-column features with rocket/lightbulb/checkmark icons, fake testimonials with stock-photo headshots. That composite is the slop archetype. The critic agent's G4 gate looks for any three of those in one deliverable.

### Huashu's case (preserved): the rounded-card-with-left-border-accent

The most pernicious because it looks "designed." It isn't. It's a chrome layer covering an absence of hierarchy. Strip it. Either the content's structure is clear without it (good) or the structure is broken and the chrome was hiding it (now you can fix the real problem).

---

## Decision Quickdraw

When you catch yourself reaching for one of these, stop:

- Adding a gradient? Probably no.
- Adding an emoji? No.
- Card with rounded corners and left-border accent? No.
- SVG hero illustration? No, use a placeholder block.
- Quote section with invented quotes? Ask for real ones.
- Row of feature icons? Ask if icons are wanted at all.
- Reaching for Inter? Pick something else.
- Reaching for purple gradient? Pick a justified palette.

The pattern: **when you think "this would look better with X added," that's the slop signal.** Ship the simple version. Add only when asked.

---

## Filler Rules (preserved from huashu)

### One thousand no's for every yes

Every element earns its place. Whitespace is a composition problem solved by contrast, rhythm, and breathing room, not by stuffing the page.

Test for filler: remove the element. Does the design get worse? If no, it stays removed.

### Ask before adding material

You think one more section would help? Ask first. The user knows the audience. Adding material has cost. Unilateral additions break the junior-designer-reporting-to-client posture.

### Declare the system upfront

After exploring context, state the system out loud:

> System I'll use: #1A1A1A on #F0EEE6, #D97757 accent (from your brand). Instrument Serif display + Geist Sans body. Section titles full-bleed accent + reversed-out text. Feature sections plain. Hero image full-bleed photo. Two background colors max. Confirm and I start.

The user confirms. Then you build. This kills "halfway done and headed wrong."

---

## Scale Rules

### Slides (1920x1080)

- Body min **24px**, ideal 28-36px
- Section title 80-160px
- Hero 180-240px allowed
- Never under 24px on a slide

### Print

- Body min **10pt** (~13.3px), ideal 11-12pt
- Heading 18-36pt
- Caption 8-9pt

### Web and mobile

- Body min **14px** (16px for accessibility-first)
- Mobile body **16px** (avoids iOS auto-zoom)
- Hit target min **44x44px**
- Line-height 1.5-1.7 (CJK 1.7-1.8)

### Contrast

- Body vs background min **4.5:1** (WCAG AA)
- Large type min **3:1**
- Verify in DevTools accessibility panel

---

## CSS Tools (use them)

```css
/* Typography */
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
p { text-spacing-trim: space-all; hanging-punctuation: first; }

/* Layout */
.layout {
  display: grid;
  grid-template-areas: "header header" "sidebar main" "footer footer";
  grid-template-columns: 240px 1fr;
}
.card { display: grid; grid-template-rows: subgrid; }

/* Visual */
* { scrollbar-width: thin; scrollbar-color: #666 transparent; }
.glass {
  backdrop-filter: blur(20px) saturate(150%);
  background: color-mix(in oklch, white 70%, transparent);
}
@view-transition { navigation: auto; }

/* Conditional */
.card:has(img) { padding-top: 0; }
@container (min-width: 500px) { /* ... */ }
.button:hover { background: color-mix(in oklch, var(--primary) 85%, black); }
```

---

## Cross-Reference: Capability-Specific Slop Catalogs

This file covers visual, brand, typography slop. Capability work has its own named clichés. Each entry below is a separate catalog; the critic agent's G4 gate consults the right one based on deliverable type.

| Capability | Catalog file | Examples of what lives there |
|---|---|---|
| Data viz | `capabilities/data-viz/anti-patterns.md` | Default Plotly purple, Inter axis labels, dual-axis line charts, 3D pie, rainbow categorical scales, decorative gridlines |
| Knowledge graph | `capabilities/knowledge-graph/anti-patterns.md` | Hairball force layouts, rainbow edge coloring, default D3 colors, unlabeled nodes, no zoom hierarchy |
| Generative audio | `capabilities/generative-audio/anti-patterns.md` | Tone.js default sine arpeggios, four-on-the-floor template kicks, generic ambient pad with reverb tail, no rhythmic intent |

Cross-cutting note: each named cliché in any of these catalogs is what the critic agent calls out by name. "Default-purple Plotly" is a critic finding. "Tone.js sine arpeggio" is a critic finding. Naming the slop is what makes it refuseable.

---

## The Connection to the Critic

The critic agent runs G4 (anti-slop gate) by scanning the deliverable against named entries in this catalog and the capability-specific catalogs. A flag from the critic always cites the row name. "G4 fail: aggressive gradient bg + default-purple SaaS landing + identical-size card grid." Three names, three rows, three concrete fixes.

This catalog is the shared vocabulary between the producer (who must avoid the patterns) and the critic (who must spot them). Names are the contract.
