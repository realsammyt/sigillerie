---
name: moodboard-sources
description: Discovery Phase 2, 3-lane reference registry, fetch and license patterns, Tinder-pass mechanic, citation/source tracking per image
---

# Moodboard Sources

Moodboard is taste capture. The agent fetches images across three lanes, then the user passes through them like Tinder. Keeps tell us what to chase. Cuts tell us what to avoid. Flinches tell us where the brand has nerves. Both signals carry equal weight, and the cut pile is the main defense against generic-AI output. Read `_planning/DISCOVERY-STUDIO-MODE.md` §B Phase 2 and §I before running this stage.

## The Three Lanes

Balance is mandatory. Each lane carries different signal. Pulling all images from one lane produces a flat moodboard with no triangulation.

| Lane | Count | Purpose | Source seed |
|---|---|---|---|
| Direct competitors | 4 to 6 | Same product space. Screenshots, brand artifacts, marketing pages. Shows the field the brand has to stand inside or against. | User-named competitors plus search by category. |
| Aspirational adjacent | 4 to 6 | Vibe-word matches from outside the category. User-named heroes plus semantic vibe expansion. | User mentions plus Brand New, Awwwards. |
| Philosophy pattern matches | 4 to 6 | Seeded from the 5-school by 20-philosophy library in `direction-library.md`. Anchors the brand to a tradition rather than a trend. | `direction-library.md` plus museum / archive sources. |

Total target: 12 to 18 images. Below 12 is too thin to triangulate. Above 18 the user fatigues mid-pass.

## Source Registry

Real sources only. No invented URLs. License posture is the agent's working assumption, and the user confirms before any commercial publication.

| Source | URL | Best lane | License posture | Fetch method | Attribution |
|---|---|---|---|---|---|
| Brand New | underconsideration.com/brandnew/ | Direct, Aspirational | Editorial review, fair-use for moodboard reference | WebFetch on article page, extract `img` tags | Cite article URL and reviewed studio |
| Awwwards | awwwards.com | Aspirational | Showcase galleries, fair-use for reference | WebFetch on collection page | Cite project URL and studio |
| Behance | behance.net | Aspirational, Philosophy | Author-posted, terms allow reference | WebFetch on project page | Cite project URL and author |
| Dribbble | dribbble.com | Aspirational (with caveat) | Author-posted | WebFetch with quality filter | Cite shot URL and author. Caveat: Dribbble skews to one trend cycle, prefer pinned-by-studios shots, cap at 2 per board |
| Pentagram | pentagram.com/work | Aspirational, Philosophy | Studio portfolio, fair-use for reference | WebFetch project pages | Cite project URL and partner |
| Method | method.com | Aspirational | Studio portfolio | WebFetch | Cite project URL |
| IDEO | ideo.com/work | Aspirational | Studio portfolio | WebFetch | Cite project URL |
| Wolff Olins | wolffolins.com/work | Aspirational, Direct (rebrands) | Studio portfolio | WebFetch | Cite project URL |
| How and How | howandhow.co | Aspirational | Studio portfolio | WebFetch | Cite project URL |
| Studio Blackburn | studioblackburn.com | Aspirational, Philosophy | Studio portfolio | WebFetch | Cite project URL |
| Are.na | are.na | All three lanes | Curated boards, mixed rights, fair-use for reference | WebFetch on board page, follow blocks | Cite board URL and curator. Trace each block to its origin where possible |
| Library of Congress | loc.gov | Philosophy | Public domain or rights-cleared in most cases | WebFetch on item page | Cite item URL and collection |
| Met Museum (Open Access) | metmuseum.org/art/collection | Philosophy | CC0 on Open Access items | WebFetch on object page, check Open Access flag | Cite object URL even when CC0 |

The agent prefers the studio site over the showcase aggregator when both have the same image. Closer to source means cleaner attribution.

## Fetch Mechanism

The flow is small and traceable.

1. Agent runs `WebFetch` on the source HTML page and extracts candidate image URLs.
2. Agent filters by minimum dimension (1200px on the long edge) and rejects sprite or icon URLs.
3. Agent shells out to `curl` with a polite User-Agent string, a 1-second delay between requests to the same host, and a 30-second timeout.
4. Image saves to `moodboard/<lane>/NN.jpg` where `<lane>` is `direct`, `aspirational`, or `philosophy` and `NN` is a zero-padded index.
5. Agent writes a sibling `moodboard/<lane>/NN-source.json` capturing provenance.

User-Agent template: `Sigillerie-Moodboard-Agent/1.0 (research; +contact-on-request)`. Never spoof a browser. Never bypass robots.txt.

## source.json Schema

Small JSON, one per image. Lives next to the image file.

```json
{
  "image": "moodboard/aspirational/03.jpg",
  "lane": "aspirational",
  "source_url": "https://www.underconsideration.com/brandnew/archives/example.php",
  "source_type": "editorial_review",
  "studio": "How and How",
  "project": "Acme rebrand 2024",
  "captured_at": "2026-04-27T14:22:11Z",
  "license": "fair_use_reference",
  "attribution_required": true,
  "verified_real": true,
  "notes": "Pulled from primary article, not from social repost"
}
```

`verified_real` flips false if the agent suspects AI generation, sees no traceable source, or finds the asset on a private leak board.

## Tinder-Pass Mechanic

The chooser is a single static HTML page at `choosers/phase-2-moodboard.html`. Sketch only here. Full template lives in `chooser-templates/tinder.html`.

Layout: 12 to 18 thumbnails in a responsive grid. Each card has the image, a small lane badge, and three controls.

| Control | Meaning | Signal weight |
|---|---|---|
| Thumbs-up | Keep. This is the brand. | Strong positive |
| Thumbs-down | Cut. Not the brand. | Strong negative, equal weight to keep |
| Star | Hero. Anchor image. | Highest positive, cap at 3 |
| Flinch note | Optional one-line text on a thumbs-down. "Why does this make you uncomfortable." | Surfaces hidden constraints |

The user picks 5 keeps, marks at most 3 hero stars, and writes 1 flinch with a short reason. Selections POST to a small JSON file `moodboard/decisions.json`. The agent reads that file at the start of Phase 3.

Flinches are gold. A user who cuts something with "feels too startup-y" has named a constraint nobody captured in the intake form. Pneuma reads that and routes the brand away from the flinch zone in later phases.

## License and Rights Summary

Moodboard collection sits inside fair-use research practice. The references are not redistributed, not embedded in shipped product, and not used as training data. The deliverable brand designed downstream from the moodboard does not require licensing the references, because the moodboard informs taste rather than supplying assets.

Two rules the agent enforces.

| Rule | Enforcement |
|---|---|
| No image from the moodboard ships in the final brand artifact | Agent refuses to copy from `moodboard/` into `deliverables/` |
| Attribution carries through to handoff | Phase 8 brief includes a `references.md` listing every kept image with its `source.json` data |

Edge cases the user must confirm before publication: direct competitor screenshots used in pitch decks, Behance and Dribbble shots from individual authors (some authors prefer takedowns even on fair-use reference), and any image flagged `verified_real: false`.

## Quality Bar

The agent verifies each image before saving.

| Check | Pass condition |
|---|---|
| Real, not AI-generated | Source page predates current generative-image cycle, or studio is a known human-led practice, or user confirms |
| Traceable to source | Image URL chain ends at a public page, not a Pinterest dead-end |
| Not a private leak | Not behind a Figma share link, not from a "leaked rebrand" forum thread |
| Resolution | 1200px on the long edge minimum |
| Not a sprite or placeholder | Visual content, not UI chrome |

When any check fails, the agent still saves the image but marks the `source.json` with a `suspect` flag and a reason. The chooser surfaces suspect images with a small warning badge so the user can confirm or drop them before passing.

## Anti-Patterns

These produce flat moodboards and the agent refuses them.

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| 30 images, all from one source | No triangulation, board reads as one curator's taste | Enforce 4 to 6 per lane, hard cap |
| All Dribbble | One trend cycle, generic-AI adjacent | Cap Dribbble at 2 per board, prefer studio sites |
| No philosophy lane | Brand floats with no tradition, drifts to AI defaults | Philosophy lane is mandatory, seeded from `direction-library.md` |
| No flinches captured | User sees only positive signal, hidden constraints stay hidden | Chooser requires at least 1 flinch note before submit |
| Skipping the cut pile in handoff | Phase 3 onward forgets what the brand is not | `decisions.json` carries cuts and flinches into every later phase |

The cut pile is the main defense against generic-AI output. Treat it as primary data.
