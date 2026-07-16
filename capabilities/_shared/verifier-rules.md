---
name: verifier-rules
description: Cross-capability shared. What scripts/verify.py actually checks
status: seeded (mirrors scripts/verify.py)
---

# verifier-rules

What `scripts/verify.py` scans today. This doc mirrors the script; when they disagree, the script wins. Run: `python scripts/verify.py <input.html> [--strict] [--3d] [--audio] [--duration=<sec>]`.

## Checks by contract variable

| Check | When active | Rule | Exit code on fail |
|---|---|---|---|
| `window.__ready` | always | Must become `true` within timeout (default 30 s) | 1 |
| `window.__renderFrame` | `--3d` | Must be a function; smoke call `__renderFrame(0)` must not throw | 1 |
| `window.__sceneReady` | `--3d` | Must become `true` within timeout | 1 |
| `window.__audioRuntime` | `--audio` | Must be `'static'`, `'tone'`, or `'wam2'` (legacy object form accepted with a note) | 1 |
| `window.__duration` | when claimed, or via `--duration` | Must be a number > 0 | 1 |
| Console errors, page errors | always | Any uncaught exception or console error fails | 2 |
| Console warnings | `--strict` only | Any warning fails | 2 |
| Images | always | Every `<img>` must have `naturalWidth > 0` | 3 |
| Fonts | always | `document.fonts.ready` must resolve with status `'loaded'` | 3 |
| Network | always | No 4xx/5xx responses (favicon.ico ignored) | 3 |
| Page load | always | Load within `--timeout` (default 30 s) | 4 |

Exit 0 = all passed.

## Recorded but not enforced

`window.__recording`, `window.__audioCues` (count only), and `window.__capabilities` are snapshotted into the result JSON but never fail the gate.

Everything else in the docs (design rules, anti-pattern catalogs, dial settings) is convention only. verify.py does not scan for it; the critic agent (G4) covers that territory by reading, not by script.
