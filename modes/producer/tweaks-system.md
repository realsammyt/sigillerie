---
name: tweaks-system
description: Runtime parameter tuning panel for HTML deliverables. Sigillerie uses leva from pmndrs as the default UI; localStorage persists choices across reloads.
---

# tweaks-system

A tweaks panel lets the viewer change a deliverable's parameters at runtime without touching code. Sigillerie ships every non-trivial HTML artifact with one. The default UI is [`leva`](https://leva.pmnd.rs/) from pmndrs.

## Why leva

Hand-rolling a panel for every deliverable wastes tokens and produces inconsistent output. Leva gives us:

- declarative API (one `useControls` call replaces ~150 lines of DOM)
- color, number, slider, select, boolean, vector, button controls out of the box
- localStorage persistence baked in (no manual JSON wrangling)
- collapsible folders, ranges, conditional render
- ~40KB gzipped, no external CSS file

It is React-first, which fits Sigillerie's React+Babel default for HTML deliverables.

## Loader pattern (single-file HTML)

For the standalone HTML output Sigillerie ships, load leva via importmap from esm.sh. No bundler.

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18",
    "react-dom/client": "https://esm.sh/react-dom@18/client",
    "leva": "https://esm.sh/leva@0.9?deps=react@18"
  }
}
</script>

<script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { useControls, Leva } from 'leva';

function App() {
  const { primary, fontSize, density, dark } = useControls({
    primary:  { value: '#D97757' },
    fontSize: { value: 16, min: 12, max: 24, step: 1 },
    density:  { options: ['compact', 'comfortable', 'spacious'] },
    dark:     false,
  });

  return (
    <div style={{
      '--primary': primary,
      fontSize,
      background: dark ? '#0A0A0A' : '#FAFAFA',
      color:      dark ? '#FAFAFA' : '#1A1A1A',
      padding:    density === 'compact' ? 8 : density === 'spacious' ? 32 : 16,
    }}>
      <Leva collapsed />
      {/* deliverable content */}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
</script>
```

`<Leva collapsed />` mounts the panel collapsed in the top-right; the viewer clicks to expand. Pass `hidden` for production exports where the panel should not render.

## Persistence

Leva persists state automatically when you give the store a name:

```jsx
import { useControls, Leva, useCreateStore, LevaPanel } from 'leva';

const store = useCreateStore();
// or use the default store; both honor localStorage when given a key:

useControls({ primary: '#D97757' }, { store });
```

For a single-store deliverable the simpler path is the built-in store with a project-scoped key:

```jsx
useControls('design', {
  primary: '#D97757',
  fontSize: 16,
});
```

The folder name `'design'` becomes part of the localStorage key, so two deliverables on the same origin do not stomp on each other. Survives reload. No manual JSON.

## The 3-7 rule

A tweaks panel exposes 3 to 7 parameters. Never more. The panel is a curated cross-section of the design space, not the full surface.

Bad:

- `borderRadius` slider 0-50px (every middle value is ugly)
- 12 color pickers for every accent
- raw spacing values in pixels for every component

Good:

- `cornerStyle: ['sharp', 'soft', 'pill']` (three considered variants)
- `palette: ['warm', 'cool', 'mono']` (curated triplets)
- `density: ['compact', 'comfortable', 'spacious']`

The default values must already be a finished design. The panel adds optional exploration on top of a complete artifact.

## When NOT to use leva

Reach for the vanilla fallback when:

- total bundle budget is under 50KB and leva alone would blow it
- the deliverable is static (infographic, hero shot, single-frame export)
- the deliverable has no React runtime
- only 1-2 knobs exist and a checkbox plus color input is enough

### Vanilla DOM fallback (30 lines)

```html
<div id="tweaks" style="position:fixed;bottom:16px;right:16px;background:#fff;
  border:1px solid #e5e5e5;border-radius:8px;padding:12px;font:13px system-ui;
  box-shadow:0 6px 20px rgba(0,0,0,.1);z-index:9999">
  <label>primary <input id="t-primary" type="color" value="#D97757"></label><br>
  <label>size <input id="t-size" type="range" min="12" max="24" value="16"></label>
</div>
<script>
  const KEY = 'tweaks:demo';
  const state = { primary: '#D97757', size: 16, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  const apply = () => {
    document.documentElement.style.setProperty('--primary', state.primary);
    document.documentElement.style.fontSize = state.size + 'px';
    localStorage.setItem(KEY, JSON.stringify(state));
  };
  document.getElementById('t-primary').oninput = e => { state.primary = e.target.value; apply(); };
  document.getElementById('t-size').oninput    = e => { state.size = +e.target.value; apply(); };
  document.getElementById('t-primary').value = state.primary;
  document.getElementById('t-size').value = state.size;
  apply();
</script>
```

Same persistence contract, no React, ~1KB.

## Common parameter sets

Pick from these starting points based on the deliverable type.

**Generic visual:** primary color, font size, dark mode, density.

**Slide deck:** theme (light/dark/brand), background style, info density (minimal/standard/dense).

**Product mockup:** layout variant (A/B/C), animation speed (0.5x-2x), data volume (5/20/100 rows), state (empty/loading/success/error).

**Animation:** speed, loop mode (once/loop/ping-pong), easing (linear/easeOut/spring).

**Landing page:** hero style (image/gradient/pattern/solid), CTA copy variant, structure (single/two-col/sidebar).

## Cross-references

- `capabilities/data-viz/`: leva drives axis bounds, palette swap, filter thresholds, chart-type toggle on dashboard deliverables.
- `modes/three3d/architecture.md`: leva is the default control surface for 3D scenes; folders group camera, lighting, material, and post controls.
- `modes/producer/react-best-practices.md`: leva sits inside the same React+Babel runtime; controls hook into the same component tree.

## Failure modes

The panel covers the deliverable. Pass `collapsed` (leva) or default-hidden (vanilla) and let the viewer open it.

The panel does not persist. Check that localStorage is reachable; private browsing modes block writes. Wrap writes in try/catch and degrade silently.

Two deliverables on the same origin overwrite each other's state. Scope the store name or storage key by project: `'tweaks:project-name'`.

A tweak option is purely cosmetic and adds no insight. Cut it. The 3-7 rule is a hard ceiling, not a target.
