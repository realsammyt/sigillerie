# Knowledge Graph Anti-Pattern Showcase

30-node citation network. Demonstrates the fix side of six named anti-patterns from `capabilities/knowledge-graph/anti-patterns.md`.

## Anti-patterns demonstrated (all shown by their fix, not their violation)

| Anti-pattern | Recipe shown |
|---|---|
| **Hairball-at-Load** | Only the root node and its 5 depth-1 neighbors are visible on load. All other nodes exist in data but are hidden until the user clicks to expand. LRU eviction caps visible nodes at 14. |
| **No Entry Node** | Root node ("Attention Is All You Need") is pinned to the viewport center at load and receives Von Restorff styling — larger radius, gold accent outline ring — so the eye goes there first. |
| **Isotropic Nodes** | Four communities map to four distinct shapes: ML Foundations → circle, NLP → rounded square, Computer Vision → triangle, Reinforcement Learning → pentagon. Size scales with degree (hub radius 2-3x leaf). |
| **Edge Spaghetti** | Default edge opacity is 0.28. On hover, the hovered edge goes full opacity and all others dim to 0.10. Edge width increases from 1.5 px to 2.5 px on hover. |
| **Undifferentiated Cluster Mass** | Communities assigned at design time. Intra-community link strength is 0.70 vs 0.25 inter-community, pulling clusters together. Each cluster gets a convex hull background fill (Law of Common Region). |
| **Offscreen Legend** | Legend is `position: fixed` at bottom-right — always in the viewport, never behind a scroll or hidden panel. |
| **Unlabeled Edges** | Edge relation (cites / extends / refutes / builds-on) appears as a text label on hover and is color-coded per relation type. |

## Domain

Research-paper citation network: 30 papers across ML Foundations, NLP, Computer Vision, and Reinforcement Learning.

## Stack

D3 v7 force simulation. Inline SVG. No build step. Single HTML file. CDN import only.

## `window.__ready` contract

`window.__ready` is set to `true` when `simulation.alpha() < 0.05` or after 800 ms, whichever comes first. `window.__recording = true` freezes layout immediately after the first tick.
