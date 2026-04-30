---
name: intake-questions
description: Discovery Phase 1, 6 intake questions, bilingual EN/ZH, vague-answer handling, public-source gap-fill rules
---

# Discovery Phase 1, Intake

Phase 1 listens. No options yet, no moodboard, no logo talk. Six questions, asked one at a time, answers landed in `discovery.json#intake`. If user names a real existing product, agent fills gaps from public sources and tags inferred fields. Locale captured here threads through every later phase. Budget: 4–7 min wall-clock, 8–12 turns, 0–2 web searches.

Postel's Law (be conservative in what you send, liberal in what you accept) governs intake. Accept any answer shape: short, long, vague, off-topic. The vague-answer recovery table normalizes input into the rubric. Don't ask the user to retry in a particular format; restate as a forced choice instead.

---

## The Six Questions

| # | EN (canonical) | ZH (canonical) | Why | Good answer | If vague |
|---|---|---|---|---|---|
| 1 | What is the thing? | 这是个什么东西？ | Anchors the noun. Product, service, app, or company shapes every later choice. | Concrete noun + one-sentence frame. "iOS app for tide-pool ID." | Reflect back nearest concrete reading. Ask: "App, site, hardware, or service?" |
| 2 | Who's it for? | 用户是谁？ | One archetypal customer, plain words. Not a TAM slide. | One human in one sentence. "Field biologists who shoot in tide pools at dawn." | Pin to one. Ask: "If only one person bought this, who?" |
| 3 | What problem does it kill? | 它解决什么问题？ | Forces the value claim. Vibe lives downstream of stakes. | Pain in user's own words, not feature-speak. | Reflect feature, ask for cost. "iNaturalist is slow at 5am offline" beats "fast offline ID." |
| 4 | Three vibe-words. | 三个气质词。 | Triangulates taste. Three is the minimum that locates a point. | Three adjectives, comma-separated. "Calm, technical, irreverent." | Offer 5 paired contrasts: warm/cool, loud/quiet, dry/playful, dense/airy, classic/strange. User picks one from each, agent compresses to three. |
| 5 | What you're not. | 你绝对不是什么？ | Anti-brand sharpens the brand. One adjacent thing user actively rejects beats ten things they like. | One or two named adjacent brands or descriptors. "Not Apple-clean. Not REI-rugged." | Ask: "Pick a brand close to yours that you'd hate being mistaken for." |
| 6 | Where will it ship first? | 第一站在哪里上线？ | Locks the first surface. Determines aspect ratios, asset list, 3D lane on/off. | One of: landing page, App Store screenshots, pitch deck, AR preview, slide deck, dashboard. | Ask: "Where does the first stranger see this?" |

---

## Asking Rhythm

One question at a time. Wait for answer. Reflect once. Move on.

Never batch. Reasons:

- Batch produces survey-fill answers. Single produces conversation.
- Each answer reframes the next question. Q3's "kills" depends on Q2's "who."
- Vague answers can't recover when buried in a list of six.
- User can stop at any point and resume without re-reading a wall.

Cadence: question, answer, one-line reflection ("Ok, biologists at dawn, pre-coffee."), next question. Reflection confirms capture and gives user a free correction point.

---

## Real-Product Detection

If user names an existing product (URL, App Store link, brand name with site), agent runs the producer-mode core asset protocol in parallel:

1. Fetch homepage, About, App Store listing, press kit if present
2. Pull existing logo, palette, type stack, product imagery, voice samples
3. Pre-fill `intake` fields from public copy

Pre-filled fields tagged `inferred: true` in `discovery.json`. Agent shows back what was found before asking next question:

> "Found Tidepool.app, looks like an iOS field-ID app, palette pulls cool grays + algae green, voice reads field-guide-dry. Confirm or correct?"

Never assumes when source is ambiguous. Confidence below 80% means ask, not infer.

---

## Vague-Answer Recovery

Re-asking is the lazy move. It signals the agent didn't listen. Recovery patterns instead:

| Vague answer | What user meant | Recovery move |
|---|---|---|
| "Modern and clean." | They haven't located their taste yet. | "Modern like Linear or modern like Apple? Clean like Muji or clean like Stripe?" Two pairs, each a real divergence. |
| "Everyone." (Q2) | They haven't picked a beachhead. | "If launch day was tomorrow and you had budget for one ad, who sees it?" |
| "Just a website." (Q6) | Surface unclear. | "Marketing landing, product app, docs site, or portfolio?" |
| "Make it pop." | Visual ambition without anchor. | "Pop like a neon sign or pop like a perfectly crisp button? One's loud, one's tight." |
| "Like Apple." | Reference too broad. | "Apple-the-product-page, Apple-the-keynote, or Apple-the-store? Different brands inside one." |
| Silence / shrug. | Decision fatigue or not their domain. | Skip to Q4 (vibe-words). Vibe is easier than ontology. Return to skipped questions later with answers from Q4 in hand. |

Recovery rule: never repeat the original question verbatim. Always offer a forced choice between two real divergences. Two crisp options beat one open prompt.

---

## Anti-Prompts

These belong in later phases. Not here:

- "What's your favorite font?" → Phase 4 (typography pairing)
- "What colors do you like?" → Phase 2 (moodboard) and Phase 4 (palette)
- "Do you want a wordmark or a symbol?" → Phase 4 (logo build)
- "What's your tagline?" → Phase 4 (voice card) or out of scope
- "How much should it cost?" → Out of Discovery entirely
- "Show me three logos." → Phase 4. If asked here, redirect: "Let's get the brief tight first, then logos land sharper."

Phase 1 captures the brief. Phase 1 does not generate or propose. Holding this line is the whole point.

---

## Output Write, `discovery.json#intake`

After Q6, agent writes to `discovery.json` per spec §D:

```json
"intake": {
  "product": "string",
  "audience": "string",
  "problem": "string",
  "vibe_words": ["string", "string", "string"],
  "anti_brands": ["string"],
  "first_surface": "landing | app | deck | ar | dashboard | screenshots",
  "inferred_fields": ["product"]
}
```

Plus top-level `locale` set from question language. `intake.locale` is read by Phases 2–6.

`inferred_fields` lists every field pre-filled from public sources. User confirms or corrects in the reflection step. `events` log gets one entry per question answered.

Checkpoint at end of Phase 1. State on disk before any moodboard work starts.

---

## Bilingual Rules

If user opens in Chinese (any of: Chinese characters in first message, `/discover` followed by zh text, `帮我做品牌`, `从零开始`, `我还没logo`), set `intake.locale = "zh"`. Threading effects:

- **Phase 2 moodboard**: source weighting shifts to Chinese-speaking studios, Studio AHA, Lava Beijing, Foreign Policy, MUJI Japan, Kenya Hara archives, Eric Chan, Jonathan Yuen
- **Phase 4 typography**: pairings include CJK-aware fonts. Display: Source Han Sans, Noto Sans CJK SC/TC, Noto Serif CJK. Body: same families. Mono: JetBrains Mono with CJK fallback. Filter out Latin-only families that break on Chinese strings.
- **Phase 4 voice card**: framework includes Chinese tone variant, formal/casual axis tuned for 您/你 register, dry/warm tuned for 文言-leaning vs 口语-leaning
- **Phase 6 hand-off**: gap report rendered bilingual

User can switch mid-stream. Switch logged as event, locale flag updated, downstream phases re-render in new locale at next checkpoint.

Mixed-language input (English brief, Chinese product name) defaults to `locale = "en"` with `product` field stored as the original Chinese string. No transliteration without confirmation.
