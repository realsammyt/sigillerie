---
name: glossary
description: Canonical EN translations for huashu-derived terms. All Phase 3 translators consult this; G1 lint enforces consistency.
---

# Glossary

This file locks the canonical English term for every recurring Chinese, loanword, or domain term carried over from huashu-design into Sigillerie. All Phase 3 translators consult it before authoring. The G1 lint pass scans output for terminology drift against this table. When two candidates compete, this file wins.

## Methodology terms

| Chinese | English-borrowed (source) | Canonical EN | Notes |
|---|---|---|---|
| 反 AI slop | anti-AI-slop | anti-AI-slop | Hyphenated. Not "anti-slop" alone. |
| 设计变体 | variations | design variations | Plural by default. |
| Junior Designer | Junior Designer | Junior Designer | Already English in source. Capitalized as a role. |
| 评审 | review | critique | Reserve "review" for code/PR. Critique carries the 5-axis weight. |
| 流派 | school | school | As in "school of design", not "派系" / faction. |
| 设计哲学 | design philosophy | design philosophy | One of 20. Pairs with school. |
| 落地 | ship | ship | Verb. Not "land", not "deliver". |
| 干净的 placeholder | honest placeholder | honest placeholder | Gray block plus label, not a fake stat. |
| 设计语言 | design language | design language | The grammar of a deck or product. |
| 视觉锚点 | visual anchor | visual anchor | The detail done at 120%. |
| 品牌资产 | brand asset | brand asset | Logo, product shot, UI capture, color, type. |
| 核心资产协议 | Core Asset Protocol | Core Asset Protocol | Capitalized. Five steps. |
| 反例 | counter-example | anti-pattern | Use anti-pattern in design context. |
| 工作流程 | workflow | workflow | One word, lower case unless heading. |
| 复盘 | retrospective | retrospective | Post-ship reflection. Not "review", not "postmortem". |
| 直觉 | intuition | instinct | Design context. "Intuition" stays for UX-of-product copy. |
| 调试 | debug | iterate | Design context only. Code context keeps "debug". |
| 一稿 / 二稿 | v1 / v2 | v1 draft, v2 draft | Numbered. "Draft" not "version" so "version" stays free for releases. |
| 假设 | assumption | assumption | Junior Pass writes these inline. |
| 占位 | placeholder | placeholder | Honest by default (see above). |
| 检查点 | checkpoint | checkpoint | The four stops in the workflow where the designer pauses for sign-off. |
| 气质关键词 | mood keywords | mood keywords | 3 to 5 adjectives in a brand-spec. |
| 品位 | taste | taste | Not "flavor", not "style". |
| 兜底 | fallback | fallback | Plan B path. |

## Process and methodology

| Term | Canonical EN | Notes |
|---|---|---|
| Junior Pass | Junior Pass | Capitalized. Pass 1: assumptions plus placeholders. |
| Full Pass | Full Pass | Pass 2: real components fill the placeholders. |
| Variations Pass | Variations Pass | Generates 3+ design variations across one or more axes. |
| Validation Pass | Validation Pass | Playwright screenshots, console check, eyeball review. |
| Tweaks | Tweaks | Capitalized. Live param panel inside a prototype. |
| Showcase | showcase | Lower case. A pre-built sample in the gallery. |
| Variations grid | variations grid | The side-by-side canvas showing variations. |
| Discovery brief | discovery brief | Output of Discovery mode. |
| Producer pass | Producer pass | A Sigillerie production cycle. |
| 5-axis critique | 5-axis critique | philosophical coherence, visual hierarchy, execution, functionality, innovation. Axis names per `critique-guide.md`. |
| Quick Wins | Quick Wins | The top 3 fixes a critique surfaces. |

## Render-pipeline terms

| Term | Canonical EN | Notes |
|---|---|---|
| Stage | Stage | Capitalized. The animation host component. |
| Sprite | Sprite | Capitalized. A timed child of Stage. |
| recordVideo | `recordVideo` | Monospace. Playwright API name, kept verbatim. |
| beginFrame mode | beginFrame mode | The deterministic-render path. |
| --mode=html | `--mode=html` | Monospace. CLI flag, verbatim. |
| --mode=3d | `--mode=3d` | Monospace. |
| --mode=tone | `--mode=tone` | Monospace. |
| page contract | page contract | The shape a deliverable HTML must satisfy for the renderer. |
| audio runtime | audio runtime | The Tone.js-based player a Sigillerie page boots. |
| warmup context | warmup context | First Playwright context, throwaway. |
| record context | record context | Second Playwright context, the one that writes WebM. |
| chrome elements | chrome elements | Player UI hidden during record. Page gates chrome on `window.__recording` (no `.no-record` auto-hide is shipped). |
| __ready signal | `window.__ready` | Monospace. Set in tick first frame. |
| __recording signal | `window.__recording` | Monospace. Forces loop=false. |

## Capability and mode terms

Modes (proper nouns, capitalized when naming the mode):

| Term | Canonical EN | Notes |
|---|---|---|
| Discovery | Discovery | The intake mode. Outputs a discovery brief. |
| Producer | Producer | The build mode. The default of Sigillerie. |
| 3D / Immersive | 3D, Immersive | Use "3D" for the mode token, "Immersive" when describing the deliverable class. Both capitalized. |

Capabilities (proper nouns, capitalized):

| Term | Canonical EN | Notes |
|---|---|---|
| Hi-Fi Base | Hi-Fi Base | Hyphen, both words capitalized. Default capability. |
| Data Viz | Data Viz | Two words, both capitalized. Short form. Formal long form "Data Visualization" (SKILL.md capability table). Never "DataViz". |
| Knowledge Graph | Knowledge Graph | Both capitalized when naming the capability. |
| Generative Audio | Generative Audio | Both capitalized. |

Tracks:

| Term | Canonical EN | Notes |
|---|---|---|
| Track A | Track A | Single-file deliverable. |
| Track B | Track B | Build-step deliverable. |

File names (always monospace):

| Term | Canonical EN |
|---|---|
| brand spec | `brand-spec.md` |
| discovery output | `discovery.json` |
| audio license | `audio-license.json` |

Block names:

| Term | Canonical EN | Notes |
|---|---|---|
| Audio Brand block | Audio Brand block | The optional addition to `brand-spec.md`. Capitalized. |

## Banned in Sigillerie

These tokens fail G1. Translators must rewrite around them.

Vocabulary:

- delve
- leverage
- comprehensive
- seamless
- ensure
- foster
- utilize
- robust
- navigate (as a verb)

Filler intensifiers:

- very
- really
- simply
- just
- actually
- essentially

Punctuation:

- em-dashes (use comma, period, parens, or middle-dot)

Openers:

- "Here's"
- "Now,"
- "Of course,"
- "It's worth noting"

AI-tells:

- "as an AI"
- "as a language model"

## Tie-breaking rules

When a term has both a translated form and an English-borrowed form in huashu source, prefer the English-borrowed unless the translation reads clearer in context. Example: the source already says "Junior Designer" and "Tweaks" in English, so those win over any retranslation.

When huashu uses a metaphor that does not transfer, paraphrase rather than literal-translate. Example: 「一稿、二稿」literally maps to "first manuscript, second manuscript", which reads odd; use "v1 draft, v2 draft" instead.

When the same Chinese term has two English candidates of equal weight, list both here in this file as the canonical pair, and let G1 surface inconsistency by flagging mixed use across one document. Example: 落地 = ship (verb) is locked; if a translator wants "deliver" instead, they propose it here first, not in their draft.

When in doubt, write the candidate in this glossary and ping the architect in the next sync. Do not silently coin new terms in capability docs. Drift starts with one well-meaning synonym.
