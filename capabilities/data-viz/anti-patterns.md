---
name: anti-patterns
description: Data Viz capability — UX-law-derived anti-patterns the critic agent scans for
status: seeded (Phase 3 of UX-laws integration; Phase 9 research pass will extend)
---

# Data Viz Anti-Patterns

This catalog lists named failure modes specific to data visualization deliverables. Each pattern maps to a UX law from `_planning/UX-LAWS-INTEGRATION.md §2`. The critic agent (G4 gate) scans for these by name before shipping. Read the table first; the "Notes per pattern" section below expands recipes for the three that need more than one sentence to fix.

## The named anti-patterns

| Name | Pattern | Law violated | Fix |
|---|---|---|---|
| **Buried Lead** | The key insight is in the 4th chart of 7. First chart is context. | Serial Position Effect | Move the primary insight chart to position 1. Support charts follow. |
| **Flat Deck** | Every chart has the same visual weight, same size, same color emphasis. No chart is clearly the one. | Von Restorff Effect | One chart is 2x the size and uses the full accent color. Others are supporting. |
| **Loading Void** | DuckDB WASM initialization takes 800ms. The canvas is blank white during that time. | Doherty Threshold | Show a skeleton chart (empty axes, greyed placeholder) during WASM init. |
| **Rainbow Categorical** | A categorical palette uses 8+ distinct hues across a legend. Eye can't track which color means what. | Cognitive Load, Chunking | Cap categorical colors at 5. Group remaining categories into "Other" with a neutral. |
| **Unlabeled Axis** | A bar or line chart ships with no axis labels or units. Viewer must guess whether the y-axis is dollars, percent, or index. | Jakob's Law | Every axis gets a label and unit. No exceptions. |
| **Dual-Y Deception** | Two data series share a chart with separate y-axes. Scale mismatch makes weak correlation look strong. | Cognitive Bias (anchoring) | Split into two adjacent charts with matched x-axis. If dual-y is required, flag the scale difference explicitly in the title. |
| **Legend Orphan** | A legend floats away from the data series it describes, requiring eye travel across the full width. | Law of Proximity | Place legends inline (label each series directly) or immediately adjacent to the chart they describe. |
| **Uniform Tick Density** | Every chart in a dashboard has the same number of x-axis ticks regardless of time range. A 7-day chart and a 3-year chart show identical granularity. | Law of Similarity | Tick density should be proportional to the data range. Identical tick density across mismatched ranges signals false equivalence. |
| **Table Hairball** | A data table renders all 40 columns at default width. Scroll bar appears. Key columns are offscreen. | Pareto Principle, Selective Attention | Show the 5-7 columns that account for primary insight. Remaining columns go behind a "Show more columns" control. |
| **Anticlimactic Summary** | A scrollytelling viz ends on a methodology footnote or a "data sourced from..." attribution row. Last thing seen is noise. | Peak-End Rule | End on the headline number or the primary takeaway. Attribution moves to a collapsed footnote. |
| **Unchunked Legend** | A legend lists 12 raw category names as a flat bullet list with no grouping. | Miller's Law, Chunking | Group categories into 3-5 labeled clusters. The cluster header is the memory unit. |
| **Monochrome Sequential Trap** | A sequential colormap (light-to-dark single hue) is applied to a diverging dataset (e.g., profit/loss, above/below average). Negative values look like small positives. | Law of Similarity | Use a diverging palette (blue-white-red or equivalent) for datasets with a meaningful midpoint. Reserve sequential for monotonic data only. |

## Notes per pattern

### Loading Void: skeleton state recipe

Show a visible skeleton before WASM init completes. A skeleton is not a spinner; it's an empty chart frame with greyed placeholder shapes at the correct aspect ratio.

```html
<!-- Visible immediately; replaced by real chart on WASM ready -->
<div id="chart-skeleton" style="
  width: 100%; aspect-ratio: 16/9;
  background: #f0f0f0;
  border-radius: 4px;
  display: flex; align-items: flex-end; gap: 6px; padding: 16px;
">
  <!-- fake bars, greyed out -->
  <div style="flex:1; height:60%; background:#d8d8d8; border-radius:2px 2px 0 0"></div>
  <div style="flex:1; height:80%; background:#d8d8d8; border-radius:2px 2px 0 0"></div>
  <div style="flex:1; height:45%; background:#d8d8d8; border-radius:2px 2px 0 0"></div>
  <div style="flex:1; height:70%; background:#d8d8d8; border-radius:2px 2px 0 0"></div>
</div>
```

Hide the skeleton and mount the real chart only after DuckDB's `db.connect()` resolves. The 800ms gap is covered. The viewer sees structure, not void.

### Rainbow Categorical: palette discipline

Five colors is the working ceiling. Beyond five, the viewer's eye can't hold the mapping.

1. Rank categories by frequency or value. The top 4 get distinct hues from the brand palette.
2. The 5th slot is the accent or contrast color for the primary category you want called out.
3. Everything ranked 6+ collapses to one neutral (e.g., `#c0c0c0`, labeled "Other").
4. If all categories are equally important and there are more than 5, the chart type is wrong. Use a table or treemap with text labels, not a color legend.

### Dual-Y Deception: when split charts beat one chart

Split charts feel like more work. They're usually clearer. The decision rule:

- Same unit, different scale: split. One chart will dominate visually on dual-y, making the other look flat.
- Different units (e.g., revenue + headcount): split always. Dual-y conflates incomparable things.
- Same unit, same magnitude, strong causal relationship you're explicitly showing: dual-y is defensible. Annotate the scales clearly in both axis labels, not just the title.

## What this catalog does NOT cover

- Chart type selection (scatter vs. bar vs. line vs. heatmap) -- that's `overview.md` territory and deferred to the Phase 9 research pass.
- Performance budgets for datasets over 100k rows -- canvas vs. WebGL vs. DuckDB columnar tradeoffs belong in `duckdb-wasm.md`.
- Accessibility specifics -- color blindness safe palettes, screen reader `aria-label` patterns, keyboard navigation for interactive charts -- deferred to Phase 9.
- Print vs. screen tuning beyond the Loading Void skeleton -- resolution, CMYK color shift, bleed margins -- deferred to `print-export.md` Phase 9 pass.
- Animation timing curves for chart transitions -- covered separately in `animation-decisions.md` Phase 9 pass.
