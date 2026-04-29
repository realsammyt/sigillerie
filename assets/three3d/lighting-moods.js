/**
 * lighting-moods.js, Sigillerie 3D Track A lighting library.
 *
 * Six curated lighting moods. Each one is a function that adds vetted
 * three-point + accent setups to a scene/group, per the rule in
 * modes/three3d/aesthetic.md section 2: three-point minimum, key + fill
 * + rim, no ambient-only. These replace the ad-hoc lighting in recipes.
 *
 * Caveman English. No em-dashes, no banned vocab.
 *
 * Usage:
 *
 *   import * as THREE from 'three';
 *   import { applyCoolStudio, applyAurora } from './lighting-moods.js';
 *
 *   const lights = applyCoolStudio(THREE, scene);
 *   // per frame:
 *   lights.update(t);
 *   // teardown:
 *   lights.dispose();
 *
 * Each mood returns:
 *   {
 *     lights:  Array<THREE.Light>,   // every light added to the group
 *     update:  (t: number) => void,  // per-frame mutation, default no-op
 *     dispose: () => void,           // removes lights from group
 *   }
 *
 * Lights themselves don't hold GPU resources (no .dispose() on Light), so
 * teardown just detaches them from the parent group. RectAreaLight needs
 * RectAreaLightUniformsLib initialised once; the softbox mood handles that
 * lazily on first call.
 *
 * Six moods:
 *   - applyCoolStudio    daytime studio, clean white key, neutral
 *   - applyWarmSunset    magic hour, warm gold + teal + coral
 *   - applyDramaticSingle  hard single key, editorial portrait
 *   - applySoftboxNeutral  big area lights, magazine product photography
 *   - applyAurora        slow color-shifting hemisphere + orbiting points
 *   - applyNoirLow       hot key + deep navy, film noir contrast
 *
 * Pairing notes are on each mood. Materials and moods compose.
 */

import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

let rectAreaUniformsReady = false;

function initRectAreaUniformsOnce() {
  if (rectAreaUniformsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaUniformsReady = true;
}

// Caveman lerp. Used by aurora.
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(THREE, out, a, b, t) {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
  return out;
}

// Build a no-op update so every mood has consistent shape.
function noopUpdate() {}

// Build a dispose closure. Removes lights from the group they were added to.
function makeDispose(group, lights) {
  return function dispose() {
    for (const light of lights) {
      if (light.parent === group) group.remove(light);
      // Lights with helper targets (Directional, Spot) sometimes parent the
      // target separately. Detach if attached.
      if (light.target && light.target.parent === group) {
        group.remove(light.target);
      }
    }
  };
}

/**
 * applyCoolStudio. Daytime studio shoot. Clean white key, cool fill, neutral
 * rim. Pairs best with glass-clear and PBR-metal materials. Use for product
 * showcases, hero MP4s where the subject must read crisp and modern.
 */
export function applyCoolStudio(THREE, group, opts = {}) {
  const lights = [];

  // Key. Warm-white directional from upper-front-right.
  const key = new THREE.DirectionalLight(0xfff5e6, 6.5);
  key.position.set(3.2, 4.0, 2.6);
  key.castShadow = opts.castShadow !== false;
  if (key.castShadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
  }
  group.add(key);
  lights.push(key);

  // Fill. Cool-blue directional from opposite side, dim.
  const fill = new THREE.DirectionalLight(0xa8c8ff, 1.6);
  fill.position.set(-3.0, 2.4, 1.6);
  group.add(fill);
  lights.push(fill);

  // Rim. White directional from behind for edge separation.
  const rim = new THREE.DirectionalLight(0xffffff, 4.0);
  rim.position.set(-1.2, 2.6, -3.2);
  group.add(rim);
  lights.push(rim);

  // Hemisphere. Subtle cool-top, warm-floor for ambient grounding.
  const hemi = new THREE.HemisphereLight(0xdce8ff, 0xfff0d8, 0.3);
  group.add(hemi);
  lights.push(hemi);

  return {
    lights,
    update: noopUpdate,
    dispose: makeDispose(group, lights),
  };
}

/**
 * applyWarmSunset. Magic hour, warm gold key with cool teal fill and coral
 * rim. Pairs best with paper-warm, ceramic, matte resin. Use for narrative
 * pieces, brand storytelling, anything that wants emotional warmth.
 */
export function applyWarmSunset(THREE, group, opts = {}) {
  const lights = [];

  // Key. Warm gold directional, low-right, strong. Tilted off-axis so
  //      glass edges catch a clean specular rim (aesthetic §2).
  const key = new THREE.DirectionalLight(0xffc89a, 9.0);
  key.position.set(3.6, 2.4, 2.2);
  key.castShadow = opts.castShadow !== false;
  if (key.castShadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
  }
  group.add(key);
  lights.push(key);

  // Fill. Cool teal-violet directional, upper-left. Stronger than baseline
  //       so the cool side reads against the warm key without going flat.
  const fill = new THREE.DirectionalLight(0x6286b8, 1.9);
  fill.position.set(-2.8, 3.4, 1.0);
  group.add(fill);
  lights.push(fill);

  // Rim. Hot coral directional from behind. Carries the strongest accent
  //      color and lifts panel edges off the dark backdrop.
  const rim = new THREE.DirectionalLight(0xff8050, 6.5);
  rim.position.set(0.6, 3.0, -3.4);
  group.add(rim);
  lights.push(rim);

  // Hemisphere. Reduced intensity + cooler top so the warm key dominates
  //             the warm/cool axis instead of the hemi flooding everything.
  const hemi = new THREE.HemisphereLight(0xb04030, 0x140820, 0.18);
  group.add(hemi);
  lights.push(hemi);

  return {
    lights,
    update: noopUpdate,
    dispose: makeDispose(group, lights),
  };
}

/**
 * applyDramaticSingle. One hard key plus deep ambient drop. Editorial portrait
 * feel. Pairs best with dark velvet, lacquer, brushed steel. Use for hero
 * reveals, single-subject shots, anything that wants chiaroscuro.
 */
export function applyDramaticSingle(THREE, group, opts = {}) {
  const lights = [];

  // Key. Warm-white spotlight, narrow cone, upper-front.
  const key = new THREE.SpotLight(0xfff2dc, 12, 0, Math.PI / 4, 0.4, 1.0);
  key.position.set(1.6, 4.4, 2.8);
  key.target.position.set(0, 0, 0);
  key.castShadow = opts.castShadow !== false;
  if (key.castShadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
  }
  group.add(key);
  group.add(key.target);
  lights.push(key);

  // Fill. Very dim cool ambient. Just enough to keep shadows from going pure black.
  const fill = new THREE.AmbientLight(0x6080a0, 0.2);
  group.add(fill);
  lights.push(fill);

  // Rim. Faint blue from behind for edge separation.
  const rim = new THREE.DirectionalLight(0x6890d0, 1.5);
  rim.position.set(-0.4, 2.0, -3.0);
  group.add(rim);
  lights.push(rim);

  return {
    lights,
    update: noopUpdate,
    dispose: makeDispose(group, lights),
  };
}

/**
 * applySoftboxNeutral. Two big area lights, near-shadowless, magazine product
 * photography. Pairs best with PBR metal, glossy ceramic, satin plastics. Use
 * for catalog shots, e-commerce hero, anything that wants to read as
 * professionally lit without drama.
 */
export function applySoftboxNeutral(THREE, group, opts = {}) {
  initRectAreaUniformsOnce();
  const lights = [];

  // Key. Big rect area light, upper-front, 3 wide x 4 tall.
  const key = new THREE.RectAreaLight(0xffffff, 4.5, 3, 4);
  key.position.set(0, 4.5, 3.2);
  key.lookAt(0, 0, 0);
  group.add(key);
  lights.push(key);

  // Fill. Even bigger rect area light below, 4x4. Bounces light up.
  const fill = new THREE.RectAreaLight(0xfff8f0, 2.0, 4, 4);
  fill.position.set(0, -2.4, 2.4);
  fill.lookAt(0, 0, 0);
  group.add(fill);
  lights.push(fill);

  // Rim. Subtle directional, white, behind. Holds the silhouette edge.
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(0.4, 2.6, -3.0);
  group.add(rim);
  lights.push(rim);

  return {
    lights,
    update: noopUpdate,
    dispose: makeDispose(group, lights),
  };
}

// Aurora palette. Five colors. Lerp loops through these.
const AURORA_TOP = [
  { r: 0.20, g: 0.95, b: 0.65 }, // mint
  { r: 0.30, g: 0.55, b: 0.95 }, // electric blue
  { r: 0.65, g: 0.30, b: 0.95 }, // violet
  { r: 0.95, g: 0.40, b: 0.75 }, // rose
  { r: 0.20, g: 0.95, b: 0.65 }, // back to mint, closes the loop
];
const AURORA_BOTTOM = [
  { r: 0.05, g: 0.10, b: 0.18 }, // deep navy
  { r: 0.10, g: 0.05, b: 0.20 }, // deep purple
  { r: 0.18, g: 0.05, b: 0.18 }, // plum
  { r: 0.05, g: 0.15, b: 0.18 }, // teal-shadow
  { r: 0.05, g: 0.10, b: 0.18 }, // back to navy
];
const AURORA_PERIOD = 18.0; // sec for full color cycle

/**
 * applyAurora. Slow color-shifting hemisphere plus two accent point lights
 * orbiting the subject. Pairs best with iridescent glass, holographic foil,
 * obsidian. Use for ambient scenes, knowledge graphs, anything that wants
 * slow living motion in the lighting itself.
 */
export function applyAurora(THREE, group, opts = {}) {
  const lights = [];

  // Hemisphere. Top + bottom colors animate over time.
  const hemi = new THREE.HemisphereLight(0x33ff99, 0x0c1018, 0.9);
  group.add(hemi);
  lights.push(hemi);

  // Two accent point lights. They orbit the origin on opposite sides.
  const accentA = new THREE.PointLight(0x8a5cff, 6.0, 18, 1.6);
  accentA.position.set(2.6, 1.6, 0);
  group.add(accentA);
  lights.push(accentA);

  const accentB = new THREE.PointLight(0x44d6c8, 5.0, 18, 1.6);
  accentB.position.set(-2.6, 1.2, 0);
  group.add(accentB);
  lights.push(accentB);

  // Faint directional rim so silhouettes never lose edge.
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(0, 3.0, -3.4);
  group.add(rim);
  lights.push(rim);

  // Reusable scratch colors so update() doesn't allocate per frame.
  const topScratch = new THREE.Color();
  const bottomScratch = new THREE.Color();

  function update(t) {
    if (typeof t !== 'number') return;

    // Color cycle. Loop through palette over AURORA_PERIOD sec.
    const phase = ((t % AURORA_PERIOD) / AURORA_PERIOD) * (AURORA_TOP.length - 1);
    const idx = Math.floor(phase);
    const frac = phase - idx;
    const topA = AURORA_TOP[idx];
    const topB = AURORA_TOP[idx + 1];
    const botA = AURORA_BOTTOM[idx];
    const botB = AURORA_BOTTOM[idx + 1];
    lerpColor(THREE, topScratch, topA, topB, frac);
    lerpColor(THREE, bottomScratch, botA, botB, frac);
    hemi.color.copy(topScratch);
    hemi.groundColor.copy(bottomScratch);

    // Orbits. Two accents on opposite sides, 8 sec per revolution.
    const orbitT = (t / 8.0) * Math.PI * 2;
    const r = 2.6;
    const yA = 1.6 + Math.sin(t * 0.6) * 0.4;
    const yB = 1.2 + Math.sin(t * 0.6 + Math.PI) * 0.4;
    accentA.position.set(Math.cos(orbitT) * r, yA, Math.sin(orbitT) * r);
    accentB.position.set(Math.cos(orbitT + Math.PI) * r, yB, Math.sin(orbitT + Math.PI) * r);
  }

  return {
    lights,
    update,
    dispose: makeDispose(group, lights),
  };
}

/**
 * applyNoirLow. Hot single key plus deep blue ambient. High-contrast, film
 * noir. Pairs best with brushed steel, dark wood, raw leather. Use for moody
 * reveals, mystery, anything that wants the subject half-swallowed by shadow.
 */
export function applyNoirLow(THREE, group, opts = {}) {
  const lights = [];

  // Key. Hot-white directional from low-side. Hard, wide-angle slash.
  const key = new THREE.DirectionalLight(0xffffff, 9.0);
  key.position.set(4.0, 1.4, 1.6);
  key.castShadow = opts.castShadow !== false;
  if (key.castShadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
  }
  group.add(key);
  lights.push(key);

  // Fill. Deep navy ambient. Crushes blacks but leaves blue undertone.
  const fill = new THREE.AmbientLight(0x101830, 0.15);
  group.add(fill);
  lights.push(fill);

  // Rim. Cyan-edge spotlight from behind. Pulls the silhouette out of the dark.
  const rim = new THREE.SpotLight(0x6cf0ff, 4.0, 0, Math.PI / 5, 0.5, 1.0);
  rim.position.set(-1.6, 2.4, -3.4);
  rim.target.position.set(0, 0.4, 0);
  group.add(rim);
  group.add(rim.target);
  lights.push(rim);

  return {
    lights,
    update: noopUpdate,
    dispose: makeDispose(group, lights),
  };
}

// Mount on window for non-module recipe consumers. Keeps Track A's
// importmap-free callers happy.
if (typeof window !== 'undefined') {
  window.SigillerieLighting = {
    applyCoolStudio,
    applyWarmSunset,
    applyDramaticSingle,
    applySoftboxNeutral,
    applyAurora,
    applyNoirLow,
  };
}
