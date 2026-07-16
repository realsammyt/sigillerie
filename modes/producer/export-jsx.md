---
name: export-jsx
description: One-way HTML to React component snapshot. Takes a validated Producer HTML deliverable and emits a `.tsx` component plus Tailwind theme snippet and EXPORT-README. The HTML stays the source of truth; the JSX is downstream.
---

# Export as JSX (Producer Pass 5, optional)

This is the bridge between a sigillerie HTML deliverable and a Next.js codebase. After Producer finishes Validation Pass (Pass 4) and the critic G4 gate clears, the user can run one command to get a drop-in React component plus a Tailwind theme snippet they paste into their config.

The transpile is one-way. The HTML in the sigillerie project remains the canonical source. If the user edits the exported JSX, they own the fork; re-running the export overwrites it.

## When to invoke

| Brief shape | Run export-jsx? |
|---|---|
| User has a Next.js codebase and asks for a component | yes |
| User wants to share a deliverable as `Component.tsx` | yes |
| User is shipping just the HTML / MP4 / GIF | no |
| Deliverable uses three.js, R3F, or WebGL | no (v1 does not support 3D, ship the HTML) |
| Deliverable uses Tone.js or runtime audio synthesis | no (v1 does not support audio runtime) |
| User is iterating on the design | not yet, finish Validation first |

## Invocation

From the repo root:

```bash
node scripts/jsx-export/index.mjs <input.html> [options]
```

Or via the npm script:

```bash
npm run export-jsx -- <input.html> [options]
```

Options:

| Flag | Default | Meaning |
|---|---|---|
| `--out=<path>` | `./out/<Name>.tsx` | Output file path. Directory is created if missing |
| `--name=<Name>` | derived from input filename | PascalCase component name |
| `--brand-spec=<path>` | none | Path to a brand-spec.md. Triggers `tailwind.theme.snippet.ts` generation |
| `--shadcn` | off | (reserved for v2) shadcn primitive rewrites |
| `--require-g4` | off | (reserved for v2) refuse input that has not passed critic G4 |

Output bundle (in the same folder as the .tsx):

| File | Contents |
|---|---|
| `<Name>.tsx` | The React component. `'use client'`, Tailwind v4 classes, typed props |
| `tailwind.theme.snippet.ts` | (only if `--brand-spec` passed) design tokens to paste into `tailwind.config.ts` |
| `EXPORT-README.md` | Five-step paste-in instructions, plus warnings if the exporter flagged anything |

## What the exporter does

1. **Parse HTML.** Pulls out `<style>` blocks, `<script type="module">` blocks, the importmap, and the body markup.
2. **CSS pass.** Each declaration is looked up against the static map (~750 entries); on miss, it falls through to a Tailwind v4 arbitrary-value class (`bg-[oklch(0.65_0.18_25)]`); on a second miss it goes to a residual `<style jsx>` block embedded in the component.
3. **JS pass.** Babel-parses scripts. Rewrites esm.sh imports to bare package names (`https://esm.sh/react@18` becomes `react`; `https://esm.sh/react-dom@18/client` becomes `react-dom/client`). Strips `createRoot(...).render(...)`, page-contract globals (`window.__ready`, `__sceneReady`, `__renderFrame`, etc.), and dead imports. Detects `useControls` from leva and promotes each control to a typed component prop with the same default value. Warns on three.js, Tone.js, and direct canvas creation (v2 territory).
4. **Markup pass.** Renames HTML attributes to JSX (`class` to `className`, `for` to `htmlFor`, `tabindex` to `tabIndex`, etc.), converts inline `style=""` strings to JSX style objects, escapes literal braces in text, self-closes void elements.
5. **Assemble.** Renders the component template: `'use client'` directive, imports (React first, then alphabetical), props interface, destructured props with defaults, state and effects body, return JSX, optional cssVars wrapper, optional residual `<style jsx>` sibling.
6. **Format.** Runs the output through prettier (TypeScript parser, single quotes, semis).
7. **Brand-spec snippet.** If `--brand-spec` was passed, parses the markdown for colour, typography, and spacing sections and emits a `sigillerieTheme` object the user pastes into their `tailwind.config.ts` under `theme.extend`.
8. **README.** Writes `EXPORT-README.md` with install steps tailored to what the exporter actually produced (mentions the theme snippet only if generated, mentions residual CSS only if present, lists any warnings).

## Two execution modes

| Mode | Trigger | What the component looks like |
|---|---|---|
| React-driven | source has a `function App() { ... return <jsx> }` (the sigillerie React+Babel default) | The component's JSX is the App's return JSX, with leva controls promoted to props |
| Static HTML | source has no React function in the script blocks | The component's JSX is the body markup converted, with Tailwind classes merged via CSS selector matching |

The CLI auto-detects which mode applies and routes accordingly.

## Limits of v1

| Limit | Workaround |
|---|---|
| Tailwind v3 not supported | Use Tailwind v4 (or stay on the HTML deliverable) |
| Three.js / R3F / WebGL deliverables not transpiled | Ship the HTML as-is; v2 will add R3F support |
| Tone.js / runtime audio not transpiled | Ship the HTML; the audio runtime needs its own client-side mount path |
| shadcn primitive rewrites not implemented | The `--shadcn` flag is a no-op in v1; the component ships self-contained |
| In React-driven mode, Tailwind classes are merged into JSX className strings by exact class-token matching that only handles `.foo` class selectors | Complex selectors (descendant, combinator) fall through to residual `<style jsx>` and still style correctly |
| Brand-spec parsing is best-effort | If your `brand-spec.md` uses unusual section headings, edit `tailwind.theme.snippet.ts` by hand after generation |
| The export is a one-shot script, not a watcher | Re-run after each HTML change |
| Bidirectional sync (HTML to JSX to HTML) | Not supported. Re-running overwrites. The HTML is the source of truth |

## Workflow placement

Producer's existing four-pass cycle (Junior, Full, Variations, Validation) is unchanged. Export is an optional Pass 5 triggered only when the user wants to drop the deliverable into a real codebase. Skipping it is the default.

```
Producer:
  Pass 1 Junior      -> assumptions + placeholders
  Pass 2 Full        -> build to spec
  Pass 3 Variations  -> 3+ differentiated options
  Pass 4 Validation  -> polish + browser eyeball + critic G4
  Pass 5 Export JSX  -> optional, only when user asks
```

The export reads the HTML AFTER Validation. Exporting an unvalidated deliverable propagates whatever slop the critic would have caught. Producer should refuse to export from a deliverable that did not pass G4.

## Cross-references

- `../_planning/JSX-EXPORT-INTEGRATION.md` (planning workspace, not shipped with the repo): the original scoping doc, decisions Q1-Q8, effort estimates, what v2 covers.
- `modes/producer/workflow.md`: the pass cycle. Its Pass 5 section is the trigger summary; this file is the spec.
- `modes/producer/dials.md`: dial state is preserved as props in React-driven mode; the destination Next.js app can still slide DENSITY from 4 to 8 at runtime.
- `modes/producer/tweaks-system.md`: the leva UI primitive that becomes typed props on export.
- `modes/producer/core-asset-protocol.md` Step 4: the brand-spec minimum surface the snippet generator reads. Schema home: `capabilities/_shared/brand-spec-schema.md`.
- `tests/jsx-export/`: three input fixtures (landing, slide-deck, prototype) and the integration harness.
