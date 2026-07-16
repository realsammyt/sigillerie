/**
 * three3d-loader.js · Sigillerie 3D Track A loader (vanilla three.js)
 *
 * Phase 4 wave 1. Sibling to assets/animations.jsx. Loads three r181+ via
 * import map from jsDelivr CDN. Detects WebGPU. Picks renderer backend.
 * Mounts a Sigillerie3D namespace on window so React+Babel sibling scripts
 * can read window.Sigillerie3D.useWebGPU, etc.
 *
 * --- HOW TO WIRE INTO A DELIVERABLE ---
 *
 * 1. In <head>, before any module script:
 *
 *   <script type="importmap">
 *   {
 *     "imports": {
 *       "three": "https://cdn.jsdelivr.net/npm/three@0.181.0/build/three.module.min.js",
 *       "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/"
 *     }
 *   }
 *   </script>
 *
 * 2. Then this loader, also in <head>:
 *
 *   <script type="module" src="three3d-loader.js"></script>
 *
 * 3. Then the React Stage3D layer (sibling, type=text/babel):
 *
 *   <script type="text/babel" data-presets="react" src="stage3d.jsx"></script>
 *
 * 4. Then the deliverable's recipe code (also text/babel, uses Stage3D).
 *
 * The Sigillerie3D namespace exposes: THREE, useWebGPU, isRecording, ready
 * (a Promise that resolves once THREE is loaded), and a small loadHTML
 * helper string that recipes can stamp into pages.
 *
 * --- RECORDING POSTURE ---
 *
 * WebGPU is the default when navigator.gpu exists AND window.__recording is
 * not set. Recording mode falls back to WebGL2 because WebGPURenderer's
 * deterministic frame stepping in headless Chromium is not yet rock-solid
 * on Windows ANGLE/D3D11, and the existing render-video.js --mode=3d path
 * targets WebGL2 + CDP beginFrame.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Recording flag is read once, at module load. Late mutation should not
// flip backends mid-scene.
const isRecording =
  typeof window !== 'undefined' && window.__recording === true;

// WebGPU detection is a navigator.gpu sniff. Chromium 121+ on Windows with
// the GPU launch flags from scripts/render-video.js exposes navigator.gpu
// in headless. Safari Tech Preview also exposes it. Firefox does not yet.
const hasWebGPU =
  typeof navigator !== 'undefined' &&
  typeof navigator.gpu !== 'undefined' &&
  navigator.gpu !== null;

// Default rule: WebGPU when present AND not recording. Recording uses WebGL2.
const useWebGPU = hasWebGPU && !isRecording;

// Capabilities snapshot. Stage3D will overwrite window.__capabilities on
// mount with the real renderer choice; this is the pre-mount best guess.
const capabilities = {
  webgpu: useWebGPU,
  webxr:
    typeof navigator !== 'undefined' &&
    typeof navigator.xr !== 'undefined' &&
    navigator.xr !== null,
  modelViewer:
    typeof customElements !== 'undefined' &&
    customElements.get('model-viewer') != null,
  audio: 'static',
};

// Lazy WebGPURenderer import. Stage3D awaits Sigillerie3D.loadWebGPURenderer()
// when useWebGPU is true. Keeps the cold-start cost off the WebGL2 path.
async function loadWebGPURenderer() {
  // WebGPU support is intentionally disabled in v0.x of Sigillerie 3D.
  // Reason: three.js r170+ ships WebGPURenderer inside `three/webgpu`, which
  // is a FULL second build of three.js (not just the renderer). Loading it
  // creates two THREE namespaces and breaks PMREM/cross-instance objects.
  // Until three offers a single-instance WebGPU path, recipe code uses
  // WebGLRenderer everywhere. Roadmap item; not blocking.
  return null;
}

// Reference HTML snippet for recipe builders. Inline as a string so a
// recipe can render it for copy-paste docs. Not used at runtime.
const loadHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Sigillerie 3D Deliverable</title>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.181.0/build/three.module.min.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/"
  }
}
</script>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="module" src="three3d-loader.js"></script>
<script type="text/babel" data-presets="react" src="stage3d.jsx"></script>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
  /* recipe code goes here. Use <Stage3D> + <Sprite3D>. */
</script>
</body>
</html>`;

// Mount the namespace. Cross-script-tag access for React+Babel siblings.
const Sigillerie3D = {
  THREE,
  // RoomEnvironment rides along so recipes get a zero-fetch procedural IBL
  // default without importing three/addons themselves.
  RoomEnvironment,
  useWebGPU,
  hasWebGPU,
  isRecording,
  capabilities,
  loadWebGPURenderer,
  loadHTML,
  // ready resolves once this module finishes initializing. Stage3D awaits
  // it before constructing the renderer so the THREE export is in scope.
  ready: Promise.resolve(),
  version: '0.1.0',
};

if (typeof window !== 'undefined') {
  window.Sigillerie3D = Sigillerie3D;
  // Pre-seed __capabilities. Stage3D will overwrite once it picks the real
  // renderer; recorder reads either snapshot fine.
  window.__capabilities = capabilities;
}

export default Sigillerie3D;
export { THREE, RoomEnvironment, useWebGPU, hasWebGPU, isRecording, capabilities, loadWebGPURenderer };
