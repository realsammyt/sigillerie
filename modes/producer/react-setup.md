---
name: react-setup
description: React + Babel inline setup, pinned versions, scope rules, common pitfalls
---

# React + Babel Setup

Rules for inline React+Babel prototypes in Sigillerie's Producer mode. Break them and the page breaks.

## Pinned Script Tags

Drop these into `<head>`. Pinned versions only. No `@latest`, no major-only tags.

```html
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
```

For dev with readable errors, swap `production.min.js` for `development.js` and `babel.min.js` for `babel.js`.

React 19 works the same way (`react@19.0.0` / `react-dom@19.0.0`), but 18.3.1 stays the safe default for single-file decks. Pick one and pin both React and ReactDOM to the same major.

Never use `react@18` or `react@latest`. CDN cache drift will bite you across machines.

## File Layout

```
deck/
  index.html        # entry, all <script> tags here
  components.jsx    # primitives, loaded type="text/babel"
  pages.jsx         # composed views
  data.js           # plain JS, no JSX
  styles.css        # optional extras
```

Load order in HTML:

```html
<!-- React + Babel first -->
<script src="https://unpkg.com/react@18.3.1/..."></script>
<script src="https://unpkg.com/react-dom@18.3.1/..."></script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/..."></script>

<!-- Then JSX files -->
<script type="text/babel" src="components.jsx"></script>
<script type="text/babel" src="pages.jsx"></script>

<!-- Mount last -->
<script type="text/babel">
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
</script>
```

Do not use `type="module"`. It conflicts with Babel standalone.

## Three Rules You Cannot Break

### Rule 1: Never write `const styles = {...}`

Two files both declaring `const styles` will collide once concatenated under Babel. Always namespace.

Wrong:

```jsx
// components.jsx
const styles = { button: {...}, card: {...} };

// pages.jsx  - clobbers the previous one
const styles = { container: {...}, header: {...} };
```

Right:

```jsx
// terminal.jsx
const terminalStyles = { screen: {...}, line: {...} };

// sidebar.jsx
const sidebarStyles = { container: {...}, item: {...} };
```

Or inline for small components:

```jsx
<div style={{ padding: 16, background: '#111' }}>...</div>
```

Non-negotiable. Every `const styles = {...}` becomes `const fooStyles = {...}`.

### Rule 2: Scope is per-script, share via `Object.assign(window, {...})`

Each `<script type="text/babel">` block compiles in its own scope. A `Terminal` defined in `components.jsx` is `undefined` inside `pages.jsx` by default.

Fix it at the bottom of each file:

```jsx
// components.jsx
function Terminal(props) { ... }
function Line(props) { ... }
const colors = { green: '#0f0', red: '#f33' };

Object.assign(window, {
  Terminal, Line, colors,
});
```

Now `<Terminal />` resolves in any later script via `window.Terminal`.

### Rule 3: Never use `scrollIntoView`

It scrolls the host page, not just your container, and wrecks the preview frame. Use container-scoped scrolling:

```js
container.scrollTop = targetElement.offsetTop;

container.scrollTo({
  top: targetElement.offsetTop - 100,
  behavior: 'smooth',
});
```

## Sigillerie Specifics

### Track A 3D scenes

Track A loads three.js via a sibling `<script type="importmap">` next to the React+Babel scripts. Keep three.js out of the React tree. Do not try to mount it through React Three Fiber under `@babel/standalone`. R3F's JSX-in-JSX expansion does not survive Babel standalone compilation. See `modes/three3d/architecture.md` for the boundary contract.

### Fixed-size content scaling

Slides target 1920x1080. Video exports target 1920x1080. Scaling to viewport uses a JS resize handler plus CSS transform with letterboxing. See `modes/producer/animations.md` for the helper and the wrapper pattern.

## Starter Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prototype</title>

  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; }
    body {
      font-family: -apple-system, 'SF Pro Text', sans-serif;
      background: #FAFAFA;
      color: #1A1A1A;
    }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel" src="components.jsx"></script>

  <script type="text/babel">
    const { useState, useEffect } = React;

    function App() {
      return (
        <div style={{padding: 40}}>
          <h1>Hello</h1>
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
```

## Common Errors

| Symptom | Cause | Fix |
|---|---|---|
| `styles is not defined` or `Cannot read property 'button' of undefined` | Two files both declared `const styles` | Rename to `fooStyles`, `barStyles` |
| `Terminal is not defined` across files | Per-script scope, not exported | Add `Object.assign(window, {Terminal})` at end of defining file |
| Blank page, console clean | JSX syntax error swallowed by minified Babel | Swap `babel.min.js` for `babel.js` to surface the parse error |
| `ReactDOM.createRoot is not a function` | Wrong React version (17 or mismatched) | Pin both react and react-dom to 18.3.1 (or both to 19) |
| `Objects are not valid as a React child` | Rendering an object directly | Render a primitive: `{obj.name}` not `{obj}` |
| Track A scene blank, console quiet | Tried to mount three.js inside React tree under Babel standalone | Move three.js to importmap, keep it outside React. See `modes/three3d/architecture.md` |

## Splitting Large Decks

Past ~1000 lines a single file gets painful. Split by role:

```
deck/
  index.html
  src/
    primitives.jsx     # Button, Card, Badge
    components.jsx     # composed widgets
    pages/
      home.jsx
      detail.jsx
      settings.jsx
    router.jsx         # state-based routing
    app.jsx            # entry component
  data.js
```

Load in dependency order:

```html
<script type="text/babel" src="src/primitives.jsx"></script>
<script type="text/babel" src="src/components.jsx"></script>
<script type="text/babel" src="src/pages/home.jsx"></script>
<script type="text/babel" src="src/pages/detail.jsx"></script>
<script type="text/babel" src="src/pages/settings.jsx"></script>
<script type="text/babel" src="src/router.jsx"></script>
<script type="text/babel" src="src/app.jsx"></script>
```

Every file ends with `Object.assign(window, {...})` for whatever it exposes.
