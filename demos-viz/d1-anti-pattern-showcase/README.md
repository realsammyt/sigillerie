# Data Viz Anti-Pattern Showcase

Single-file HTML demo for Sigillerie's data-viz capability. A 4-panel chart story about Meridian Software's 2025 annual performance. Positive demonstration: every named anti-pattern is shown as its fix, not its violation.

## Anti-patterns demonstrated

| Anti-pattern | Recipe applied |
|---|---|
| **Buried Lead** | Headline insight (APAC +34% YoY) is in panel 1, not buried mid-deck. |
| **Flat Deck** | Panel 1 spans full width with an accent-color border; panels 2-3 are smaller and use neutral palette. Only one element breaks the visual rhythm. |
| **Loading Void** | All four chart frames show a skeleton state (greyed placeholder bars/lines) on load. Skeleton is held for a minimum of 600 ms even when data loads faster. |
| **Rainbow Categorical** | Categorical palette capped at 4 named hues plus one neutral "Other" bucket. No legend exceeds 5 distinct colors. |
| **Unlabeled Axis** | Every chart includes an axis-note caption naming the unit (USD millions, %, fiscal year). |
| **Legend Orphan** | Legends are rendered inline immediately below each chart, not floated to a remote corner. |
| **Anticlimactic Summary** | Panel 4 closes on the headline ARR number ($487M) in 56px type. Data attribution is collapsed into a `<details>` footnote below the fold. |
