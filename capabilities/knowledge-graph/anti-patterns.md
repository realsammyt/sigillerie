---
name: anti-patterns
description: Knowledge Graph capability — UX-law-derived anti-patterns the critic agent scans for
status: seeded (Phase 3 of UX-laws integration; Phase 10 research pass will extend)
---

# Knowledge Graph Anti-Patterns

This catalog names concrete failure modes the critic agent (G4) scans for in knowledge graph deliverables. It covers 2D force-directed graphs, 3D node-link scenes, and WebXR graph walks. The patterns are derived from the UX-law catalog in `_planning/UX-LAWS-INTEGRATION.md §2`. 3D and WebXR variants amplify most of these failures because spatial depth and locomotion add complexity the viewer didn't ask for. Patterns marked **(3D)** or **(WebXR)** are medium-specific; all others apply across all three rendering modes.

## The named anti-patterns

| Name | Pattern | Law violated | Fix |
|---|---|---|---|
| **Hairball-at-Load** | Force-directed layout renders all 200 nodes immediately at full opacity. Viewer sees noise. | Cognitive Load, Working Memory | Start focused on root node. Expand on demand. Maximum 30 nodes visible at once. |
| **No Entry Node** | Root node is placed by the force-directed algorithm, not by design. It might be anywhere. | Serial Position, Mental Model | Pin the root or most important node to the initial camera target. It is always the entry point. |
| **Isotropic Nodes** | Every node uses the same shape, size, and color regardless of type or importance. Viewer can't distinguish person from concept from event. | Law of Similarity, Von Restorff Effect | Map node type to visual channel (shape or color). Map importance to size. One node type per visual encoding; don't encode the same distinction twice. |
| **Edge Spaghetti** | Dense graphs render hundreds of crossing edges at full opacity. The connection structure is unreadable. | Law of Pragnanz, Cognitive Load | Bundle edges by community or direction using hierarchical edge bundling (HEB). Default edge opacity 0.25-0.35; full opacity only on hover of incident edges. |
| **Offscreen Legend** | Relationship types are color-coded. The legend explaining the color map is off the initial viewport (below fold or in a hidden panel). | Working Memory, Selective Attention | Keep the legend permanently visible inside the viewport, anchored to a corner. Users on task won't find it behind a click. |
| **Unlabeled Edges** | Edges carry no type label. Every connection looks identical even when the relationship semantics differ (e.g., "authored" vs "cited by" vs "refutes"). | Law of Uniform Connectedness, Mental Model | Label edges on hover at minimum; label prominent edges statically. The connection type is half the information in a knowledge graph. |
| **Flat Degree Sizing** | All nodes render at the same radius regardless of degree or centrality. High-degree hub nodes that anchor the graph are visually indistinguishable from leaf nodes. | Serial Position, Law of Similarity | Scale node radius by degree or betweenness centrality. Hubs get 2-3x the leaf radius. Hub prominence guides attention to the graph's structural spine. |
| **Camera Spin at Load (3D)** | A 3D graph auto-rotates on load at >30°/sec. The viewer can't read a node label before it rotates away. | Cognitive Load, Mental Model | Default rotation ≤ 10°/sec, or no auto-rotation until the user has had 3 seconds of idle time at load. Add a pause-on-hover. |
| **Label Collision** | Node labels are drawn at fixed screen size. At zoom-out, dozens of labels overlap and form unreadable blocks. | Chunking, Law of Pragnanz | Implement level-of-detail label suppression: show labels only when node radius > 8px on screen. Suppress overlapping labels at current zoom using a spatial hash or force-directed label placement. |
| **Drift Zone (WebXR)** | The graph occupies a 2 m radius sphere in world space. Using free locomotion, the user can walk outside the meaningful region and see only background or edge fragments. | Mental Model, Law of Common Region | Bound the navigable space to the graph's bounding sphere plus 0.5 m margin. Use a soft boundary (opacity fade or audio cue) that redirects the user inward before they fully exit. |
| **Undifferentiated Cluster Mass** | Connected communities exist in the data but the layout treats all nodes with identical repulsion. Clusters are not visually apparent. | Law of Proximity, Chunking | Run community detection (Louvain or label propagation) before layout. Apply intra-community attractive force 2-3x the inter-community force. Color code by community. The cluster structure becomes the first-level mental model. |
| **Depth Occlusion (3D)** | In a 3D force-directed layout, high-degree nodes cluster near the scene center. Nodes at the back of the cluster are completely occluded. Depth adds no information; it just hides nodes. | Occam's Razor, Cognitive Load | Use depth only when a third dimension encodes a meaningful data attribute (time, confidence, category layer). For pure relational data, a 2D layout with thoughtful z-jitter is usually better than a true 3D layout. |

## Notes per pattern

### Hairball-at-Load: progressive disclosure recipe

Render the root node and its immediate neighbors (depth 1) on load. Gate further expansion on user interaction: click a node to reveal its neighbors. Cap visible nodes at 30 with an LRU eviction strategy (hide the least-recently-focused subtree when the cap is hit). Use an enter animation (nodes fade in over 200 ms) so expansion reads as a deliberate reveal, not a data dump. Libraries that support this natively: Sigma.js `NodeReducer` / `EdgeReducer` pipeline, and vis.js `hideNodesOnDrag` with a custom expansion handler.

### Edge Spaghetti: bundling options

Hierarchical edge bundling (D3 `d3.edgeBundling`) works well for tree-structured graphs. For general force-directed graphs, FDEB (Force-Directed Edge Bundling) is the standard; `d3-edge-bundling` implements it. In Three.js/WebXR, use quadratic Bezier curves with shared control points per community pair rather than straight `Line` geometries. Reduce edge draw calls: batch edges by color/type into a single `LineSegments` geometry per type group.

### Label Collision: suppression strategy

At each render frame (or on zoom-change), compute node screen positions. Sort by importance descending. Iterate the sorted list; for each node, place the label only if it doesn't overlap any already-placed label (AABB check with 4 px padding). This is O(n log n) with a spatial hash. For static SVG renders (D3), use the `labella.js` or `d3-annotation` force-based placement passes. In WebXR, use world-space billboarded labels and suppress at angular size < 1.5° (same floor as the Fitts's Law hit target threshold in `modes/three3d/aesthetic.md §13`).

### Offscreen Legend: placement contract

The legend must occupy a fixed-position element in screen space (SVG overlay or HTML overlay with `position: fixed`), not a DOM element inside the scrollable graph container. For WebXR, anchor the legend panel to the camera rig at a fixed offset (0.25 m right, 0 m up, -0.6 m forward) so it follows the viewer. A legend that disappears when the user pans is not a legend; it's a tooltip.

### Undifferentiated Cluster Mass: community detection order

Run community detection on the raw adjacency list before any layout pass. Community assignment drives three things: (1) intra-community spring constant in the force simulation, (2) node color, (3) initial position seeding (nodes in the same community start near each other before force simulation begins). The layout inherits the cluster structure rather than discovering it emergently. Emergent discovery takes many more simulation steps and produces noisier results.

## Medium-specific notes

- **WebXR amplifies Drift Zone.** In a flat 2D graph, panning outside the viewport is immediately obvious (blank canvas). In WebXR, the user can walk meters into "nothing" before realizing they've left the data. Soft boundaries are mandatory, not optional.
- **3D depth almost always hurts readability.** Edge occlusion in a true 3D layout is severe in the center of dense graphs. Prefer 2D layout with slight z-jitter (±0.05 m) for visual separation without full depth occlusion. Reserve 3D depth for graphs where a third data dimension (time, certainty, layer) genuinely exists.
- **Camera Spin is uniquely harmful in 3D.** In a flat graph, animation doesn't relocate nodes. In a 3D scene, auto-rotation moves every node to a new screen position, invalidating any spatial memory the viewer built. Even a slow spin (15°/sec) resets spatial memory every 24 seconds.
- **WebXR locomotion conflicts with Mental Model.** Users expect to walk "through" a graph, but most force-directed layouts aren't designed with a walkable scale. A graph that looks correct on screen may require the user to teleport 20 m to reach peripheral nodes, breaking the sense of a unified space. Design the graph's bounding volume explicitly: decide whether it's an inspection object (1-2 m diameter, view from outside) or a walkable space (10 m diameter, designed for interior traversal).
- **Angular Midget from `modes/three3d/aesthetic.md §10` applies to KG node click targets.** A node rendered at 6 px screen radius at zoom-out is below the 32 px desktop hit target floor. Implement a minimum hit area independent of rendered size using transparent hit-circle overlays or pointer event radius inflation.
- **Label Collision and Offscreen Legend compound in WebXR.** In a spatial walk, the legend anchor point may drift out of the viewer's field of view. Labels that collide in flat view become physically intersecting planes in 3D space. Both require spatial-aware solutions, not just CSS fixes ported from 2D.

## What this catalog does NOT cover

- Layout algorithm selection: which force-directed, hierarchical, or radial algorithm fits which data shape. That's `capabilities/knowledge-graph/layout-algorithms.md` territory.
- Accessibility for screen-reader graph traversal: keyboard navigation, ARIA live regions for node announcements, focus management in SVG. Noted as a gap; belongs in `capabilities/knowledge-graph/accessibility.md`.
- Performance budgets for graphs exceeding 10k nodes: WebWorker offloading for force simulation, GPU-accelerated layout with WebGL compute or WASM, level-of-detail geometry switching.
- Semantic ontology design: how to model entity types and relationship types in the source data before visualization. Out of scope for a rendering anti-pattern catalog.
- Color contrast compliance for node and edge colors across the full palette. Belongs in `capabilities/knowledge-graph/color-and-style.md` with WCAG 2.1 AA cross-check.
