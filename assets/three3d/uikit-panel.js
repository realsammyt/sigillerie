/**
 * uikit-panel.js · Sigillerie 3D Track A spatial-UI wrapper
 *
 * Vanilla @pmndrs/uikit integration. Wraps the yoga-driven flexbox runtime
 * into a one-call recipe API, with a CanvasTexture fallback when the uikit
 * ESM bundle cannot be resolved at runtime (CDN miss, importmap typo, etc).
 *
 * --- IMPORTMAP CONTRACT (caller owns this) ---
 *
 * Add this entry to the page importmap, ALONGSIDE the three entry that
 * three3d-loader.js already documents:
 *
 *   <script type="importmap">
 *   {
 *     "imports": {
 *       "three": "https://cdn.jsdelivr.net/npm/three@0.181.0/build/three.module.min.js",
 *       "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/",
 *       "@pmndrs/uikit": "https://cdn.jsdelivr.net/npm/@pmndrs/uikit@latest/dist/index.js"
 *     }
 *   }
 *   </script>
 *
 * Note: jsDelivr serves the published @pmndrs/uikit ESM bundle from
 * `dist/index.js`. user verifies, if `@pmndrs/uikit@latest` shifts its
 * entry, pin to a known-good version (e.g. `@pmndrs/uikit@0.8.x`) and
 * point at the resolved file. The fallback below makes a wrong path
 * non-fatal: createPanel still returns a working Object3D, just rendered
 * via CanvasTexture instead of yoga flex.
 *
 * --- USAGE ---
 *
 *   const panel = window.SigillerieUikit.createPanel(threeApi, {
 *     width: 2.5, height: 1.5,
 *     position: [0, 0, 0],
 *     rotation: [0, 0, 0],
 *     layout: 'flex-col',
 *     theme: 'dark',
 *     background: '#283355',
 *     borderRadius: 32,
 *     padding: 32,
 *     children: [
 *       { type: 'text', text: 'Sigillerie', fontSize: 96, fontWeight: 'bold' },
 *       { type: 'text', text: 'Holo-UI v0.1', fontSize: 32, marginTop: 16 },
 *     ],
 *   });
 *   threeApi.group.add(panel.root);
 *   // per-frame:
 *   panel.update();
 *   // teardown:
 *   panel.dispose();
 *
 * --- FALLBACK ---
 *
 * If the @pmndrs/uikit dynamic import fails, createPanel still returns a
 * { root, update, dispose } shape. The root is a CanvasTexture+Plane mesh
 * laid out via a small in-house flexbox emulator. Recipes work either way.
 *
 * --- LINE BUDGET ---
 *
 * Stays around 380 lines. uikit handles the heavy lifting; the fallback is
 * the bulk of the code so failures stay invisible to recipes.
 */

// caveman: dynamic import promise. Caching means we only attempt the load
// once per page load. Recipes that build many panels share the result.
let uikitModulePromise = null;

function tryLoadUikit() {
  if (uikitModulePromise !== null) return uikitModulePromise;
  uikitModulePromise = import('@pmndrs/uikit')
    .then((mod) => mod && (mod.default || mod))
    .catch((err) => {
      console.warn(
        '[SigillerieUikit] @pmndrs/uikit load failed, using CanvasTexture fallback.',
        err && err.message ? err.message : err
      );
      return null;
    });
  return uikitModulePromise;
}

// caveman: kick the load on module init so the first createPanel doesn't
// pay the latency. Promise is cached either way.
tryLoadUikit();

// ---- Theme defaults ---------------------------------------------------
// Two themes. Dark is the Sigillerie default (deep cool with warm accent).
// Light gives recipes a paper-on-paper editorial feel.

const THEMES = {
  dark: {
    background: '#0F1422',
    surface: '#1B2240',
    surfaceAlt: '#283355',
    text: '#F2F4FA',
    textMuted: '#B8C6E6',
    accent: '#FF8A4C',
    border: 'rgba(255,255,255,0.08)',
  },
  light: {
    background: '#F4EBD0',
    surface: '#FFFFFF',
    surfaceAlt: '#EFE6CC',
    text: '#1A1B1E',
    textMuted: '#5A5A5A',
    accent: '#D6603A',
    border: 'rgba(0,0,0,0.08)',
  },
};

function resolveTheme(name) {
  return THEMES[name] || THEMES.dark;
}

// ---- Public entrypoint ------------------------------------------------

/**
 * Build a spatial UI panel. Returns synchronously with an Object3D root and
 * an update() the caller ticks per frame. The internal uikit Root mounts
 * asynchronously; until it's ready, root is an empty THREE.Group placeholder
 * and update() is a no-op. Once the import resolves, the populated yoga UI
 * gets attached to root and update() forwards to the Root's tick.
 *
 * @param {object} threeApi Stage3D's threeApi: { THREE, scene, renderer, ... }
 * @param {object} opts panel spec, see file header for the shape
 * @returns {{ root: THREE.Object3D, update: () => void, dispose: () => void }}
 */
export function createPanel(threeApi, opts) {
  const THREE = (threeApi && threeApi.THREE) || (typeof window !== 'undefined' && window.Sigillerie3D && window.Sigillerie3D.THREE);
  if (!THREE) {
    throw new Error('[SigillerieUikit] threeApi.THREE missing. Pass Stage3D threeApi.');
  }

  const o = opts || {};
  const theme = resolveTheme(o.theme || 'dark');

  // Stable handle. We swap internals once the async path resolves.
  const root = new THREE.Group();
  root.name = 'SigillerieUikitPanel';
  // Apply transform up front so even the placeholder is in the right place.
  if (Array.isArray(o.position)) root.position.set(o.position[0] || 0, o.position[1] || 0, o.position[2] || 0);
  if (Array.isArray(o.rotation)) root.rotation.set(o.rotation[0] || 0, o.rotation[1] || 0, o.rotation[2] || 0);
  if (Array.isArray(o.scale)) root.scale.set(o.scale[0] || 1, o.scale[1] || 1, o.scale[2] || 1);

  // State that the returned closures share. Mutated when async load lands.
  const state = {
    THREE,
    threeApi,
    opts: o,
    theme,
    uikitRoot: null,        // the @pmndrs/uikit Root instance
    fallbackMesh: null,     // CanvasTexture mesh when uikit unavailable
    disposables: [],        // textures, materials, geometries to free
    disposed: false,
    lastTime: typeof performance !== 'undefined' ? performance.now() : 0,
  };

  // Async wire-up. Resolves uikit if available, otherwise builds fallback.
  tryLoadUikit().then((uikit) => {
    if (state.disposed) return;
    if (uikit && uikit.Root && uikit.Container && uikit.Text) {
      try {
        mountUikit(state, root, uikit);
        return;
      } catch (err) {
        console.warn('[SigillerieUikit] uikit mount failed, falling back.', err);
      }
    }
    mountFallback(state, root);
  });

  return {
    root,
    update() {
      if (state.disposed) return;
      const now = typeof performance !== 'undefined' ? performance.now() : state.lastTime + 16.6;
      const dt = (now - state.lastTime) / 1000;
      state.lastTime = now;
      if (state.uikitRoot && typeof state.uikitRoot.update === 'function') {
        // uikit's Root.update(delta) ticks layout, animations, hover state.
        try {
          state.uikitRoot.update(dt);
        } catch (err) {
          // First frame after mount can race; swallow and try next tick.
        }
      }
      // Fallback path is a static mesh; nothing to tick per frame.
    },
    dispose() {
      if (state.disposed) return;
      state.disposed = true;
      if (state.uikitRoot && typeof state.uikitRoot.destroy === 'function') {
        try { state.uikitRoot.destroy(); } catch (err) { /* noop */ }
      }
      state.disposables.forEach((d) => {
        if (d && typeof d.dispose === 'function') {
          try { d.dispose(); } catch (err) { /* noop */ }
        }
      });
      state.disposables.length = 0;
      // Detach root from parent so callers don't have to.
      if (root.parent) root.parent.remove(root);
      // Walk root and dispose geometries/materials in case we mounted a fallback.
      root.traverse((obj) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            Object.keys(m).forEach((k) => {
              const v = m[k];
              if (v && v.isTexture && typeof v.dispose === 'function') v.dispose();
            });
            if (typeof m.dispose === 'function') m.dispose();
          });
        }
      });
    },
  };
}

// ---- uikit path -------------------------------------------------------

function mountUikit(state, host, uikit) {
  const { THREE, threeApi, opts, theme } = state;
  const Root = uikit.Root;
  const Container = uikit.Container;
  const Text = uikit.Text;
  // Some builds of uikit also ship Image; fall back to a Container if missing.
  const ImageNode = uikit.Image || uikit.Container;

  // Root needs camera + renderer to handle pointer events and pixel sizing.
  // sizeX/sizeY are world units, matching the recipe's width/height contract.
  const rootNode = new Root({
    sizeX: opts.width != null ? opts.width : 2,
    sizeY: opts.height != null ? opts.height : 1.2,
    flexDirection: opts.layout === 'flex-row' ? 'row' : 'column',
    justifyContent: opts.justifyContent || 'flex-start',
    alignItems: opts.alignItems || 'stretch',
    padding: opts.padding != null ? opts.padding : 24,
    backgroundColor: opts.background || theme.surface,
    borderRadius: opts.borderRadius != null ? opts.borderRadius : 24,
    borderColor: opts.borderColor || theme.border,
    borderWidth: opts.borderWidth != null ? opts.borderWidth : 0,
  });

  // uikit's Root extends Object3D, so we add it directly to our host group.
  // Cameras are picked up off threeApi at attach time.
  if (typeof rootNode.bind === 'function') {
    // Newer API: bind(camera, renderer) wires interaction.
    try {
      rootNode.bind(threeApi.camera, threeApi.renderer);
    } catch (err) {
      // Older builds bind via attach; ignore.
    }
  }

  host.add(rootNode);
  state.uikitRoot = rootNode;

  // Walk the spec children and build the tree.
  const childSpecs = Array.isArray(opts.children) ? opts.children : [];
  childSpecs.forEach((spec) => {
    const node = buildUikitChild(spec, { Container, Text, ImageNode, theme });
    if (node) rootNode.add(node);
  });
}

function buildUikitChild(spec, ctx) {
  if (!spec) return null;
  const { Container, Text, ImageNode, theme } = ctx;
  const type = spec.type || 'container';

  if (type === 'text') {
    const node = new Text({
      text: spec.text != null ? String(spec.text) : '',
      fontSize: spec.fontSize != null ? spec.fontSize : 32,
      color: spec.color || theme.text,
      fontWeight: spec.fontWeight || 'normal',
      lineHeight: spec.lineHeight,
      letterSpacing: spec.letterSpacing,
      textAlign: spec.textAlign || 'left',
      marginTop: spec.marginTop,
      marginBottom: spec.marginBottom,
      marginLeft: spec.marginLeft,
      marginRight: spec.marginRight,
    });
    return node;
  }

  if (type === 'image') {
    const node = new ImageNode({
      src: spec.src,
      width: spec.width,
      height: spec.height,
      borderRadius: spec.borderRadius,
      marginTop: spec.marginTop,
      marginBottom: spec.marginBottom,
    });
    return node;
  }

  // Default: container, recursive.
  const containerProps = {
    width: spec.width,
    height: spec.height,
    flexDirection: spec.layout === 'flex-row' ? 'row' : (spec.layout === 'flex-col' ? 'column' : (spec.flexDirection || 'column')),
    justifyContent: spec.justifyContent,
    alignItems: spec.alignItems,
    padding: spec.padding,
    margin: spec.margin,
    marginTop: spec.marginTop,
    marginBottom: spec.marginBottom,
    backgroundColor: spec.background,
    borderRadius: spec.borderRadius,
    borderColor: spec.borderColor || theme.border,
    flexGrow: spec.flexGrow,
  };
  const node = new Container(containerProps);
  const kids = Array.isArray(spec.children) ? spec.children : [];
  kids.forEach((kidSpec) => {
    const kid = buildUikitChild(kidSpec, ctx);
    if (kid) node.add(kid);
  });
  return node;
}

// ---- Fallback path ----------------------------------------------------
// CanvasTexture-on-plane. Honors theme + a subset of children layout: text
// stacks vertically (flex-col) or horizontally (flex-row). Good enough that
// recipes don't crash when uikit isn't there; not pixel-equivalent.

function mountFallback(state, host) {
  const { THREE, opts, theme } = state;
  const w = opts.width != null ? opts.width : 2;
  const h = opts.height != null ? opts.height : 1.2;

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  // Canvas backing pixel density: 512 px per world unit, capped by dpr.
  const pxPerUnit = 512;
  const cw = Math.max(256, Math.round(w * pxPerUnit * Math.min(dpr, 2)));
  const ch = Math.max(256, Math.round(h * pxPerUnit * Math.min(dpr, 2)));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // Background with rounded corners.
  const radius = (opts.borderRadius != null ? opts.borderRadius : 24) * (cw / (w * pxPerUnit));
  const padding = (opts.padding != null ? opts.padding : 24) * (cw / (w * pxPerUnit));

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = opts.background || theme.surface;
  roundRect(ctx, 0, 0, cw, ch, radius);
  ctx.fill();

  // optional border stroke (maps to opts.borderWidth + opts.borderColor)
  if (opts.borderWidth && opts.borderWidth > 0) {
    const bw = opts.borderWidth * (cw / (w * pxPerUnit));
    ctx.strokeStyle = opts.borderColor || theme.border;
    ctx.lineWidth = Math.max(1, bw);
    roundRect(ctx, bw * 0.5, bw * 0.5, cw - bw, ch - bw, Math.max(0, radius - bw * 0.5));
    ctx.stroke();
  }

  // Children layout. Only text and nested containers are honored in fallback.
  const layout = opts.layout || 'flex-col';
  const innerX = padding;
  const innerY = padding;
  const innerW = cw - padding * 2;
  const innerH = ch - padding * 2;

  drawChildren(ctx, opts.children || [], {
    x: innerX,
    y: innerY,
    w: innerW,
    h: innerH,
    layout,
    theme,
    pxScale: cw / (w * pxPerUnit),
  });

  const tex = new THREE.CanvasTexture(canvas);
  if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const geom = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'SigillerieUikitFallback';
  host.add(mesh);
  state.fallbackMesh = mesh;
  state.disposables.push(tex, mat, geom);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawChildren(ctx, children, frame) {
  const { x, y, w, h, layout, theme, pxScale } = frame;
  const isCol = layout !== 'flex-row';
  let cursor = isCol ? y : x;

  for (let i = 0; i < children.length; i += 1) {
    const spec = children[i];
    if (!spec) continue;
    const marginTop = (spec.marginTop || 0) * pxScale;
    const marginBottom = (spec.marginBottom || 0) * pxScale;
    const marginLeft = (spec.marginLeft || 0) * pxScale;
    const marginRight = (spec.marginRight || 0) * pxScale;

    if (isCol) cursor += marginTop;
    else cursor += marginLeft;

    if (spec.type === 'text' || spec.text) {
      const fontPx = (spec.fontSize != null ? spec.fontSize : 32) * pxScale;
      const weight = spec.fontWeight === 'bold' ? '700' : (spec.fontWeight || '400');
      const family = spec.fontFamily || 'system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = spec.color || theme.text;
      ctx.font = `${weight} ${fontPx}px ${family}`;
      ctx.textBaseline = 'top';
      ctx.textAlign = spec.textAlign || (isCol ? 'left' : 'left');
      const tx = isCol ? x : cursor;
      const ty = isCol ? cursor : y;
      const text = String(spec.text != null ? spec.text : '');
      // crude wrap on width when in column mode
      const lines = isCol ? wrapText(ctx, text, w) : [text];
      const lineH = fontPx * 1.2;
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, tx, ty + idx * lineH);
      });
      const advance = isCol ? lines.length * lineH + marginBottom : ctx.measureText(text).width + marginRight;
      cursor += advance;
      continue;
    }

    if (spec.type === 'container' || Array.isArray(spec.children)) {
      // Reserve a height proportional to children count; rough but readable.
      const childH = isCol ? Math.min(h - (cursor - y), 0.4 * h) : h;
      drawChildren(ctx, spec.children || [], {
        x: isCol ? x : cursor,
        y: isCol ? cursor : y,
        w: isCol ? w : (0.4 * w),
        h: childH,
        layout: spec.layout || 'flex-col',
        theme,
        pxScale,
      });
      cursor += isCol ? childH + marginBottom : (0.4 * w) + marginRight;
    }
  }
}

function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---- Mount on window namespace ----------------------------------------

if (typeof window !== 'undefined') {
  window.SigillerieUikit = Object.assign(window.SigillerieUikit || {}, {
    createPanel,
    THEMES,
  });
}

export default { createPanel, THEMES };
