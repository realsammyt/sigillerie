/**
 * recipe-baseline.js · Sigillerie 3D Track A
 *
 * Minimal shared post baseline for recipes. Wires bloom + vignette +
 * OutputPass via tsl-effects.js helpers so four recipes don't each repeat
 * the same three lines.
 *
 * Addresses the systemic fix called out in the aesthetic.md §4 / §12 audit:
 * all hero-class recipes must ship bloom + vignette by default.
 *
 * Usage:
 *
 *   import { applyRecipeBaseline } from '../../assets/three3d/recipe-baseline.js';
 *
 *   // inside your recipe, after building lights and meshes:
 *   const post = applyRecipeBaseline(threeApi);
 *   threeApi.draw = () => post.composer.render();
 *
 *   // teardown:
 *   post.dispose();
 *
 * Override only what you need:
 *
 *   const post = applyRecipeBaseline(threeApi, {
 *     bloom: { strength: 0.8 },     // glass needs stronger bloom
 *     vignette: { darkness: 1.2 },
 *   });
 *
 * DOF and chromatic aberration are NOT included. Both are per-deliverable
 * choices (per aesthetic.md §12: "DOF off by default"). Recipes that need
 * them import addDOF / addChromaticAberration from tsl-effects.js directly.
 *
 * Caveman English. No em-dashes.
 */

// Pull effects via window namespace so recipe-baseline stays importmap-free.
// tsl-effects.js must be loaded before this module is called.
function pickEffects() {
  if (typeof window === 'undefined') return null;
  return (
    window.Sigillerie3D && window.Sigillerie3D.effects
  ) || null;
}

/**
 * applyRecipeBaseline. Builds an EffectComposer with:
 *   RenderPass -> UnrealBloomPass -> VignettePass -> OutputPass
 *
 * Returns { composer, draw, dispose }.
 *
 * @param {object} threeApi  { renderer, scene, camera, ... }
 * @param {object} [opts]
 * @param {object} [opts.bloom]    forwarded to addBloom. defaults match aesthetic §4 recipe defaults.
 * @param {object} [opts.vignette] forwarded to addVignette.
 */
export function applyRecipeBaseline(threeApi, opts) {
  const o = opts || {};
  const fx = pickEffects();

  if (!fx || !fx.createComposer) {
    // tsl-effects.js not loaded yet. Return a pass-through so the recipe
    // still renders, just without post. Warn once.
    if (typeof window !== 'undefined') {
      if (!window.__recipeBaselineWarn) {
        window.__recipeBaselineWarn = true;
        console.warn(
          '[recipe-baseline] tsl-effects.js not found on window.Sigillerie3D.effects. ' +
          'Load tsl-effects.js before your recipe. Falling back to direct render.'
        );
      }
    }
    return {
      composer: null,
      draw() {
        if (threeApi.renderer && threeApi.scene && threeApi.camera) {
          threeApi.renderer.render(threeApi.scene, threeApi.camera);
        }
      },
      dispose() {},
    };
  }

  const bloomOpts = Object.assign(
    { strength: 0.6, radius: 0.8, threshold: 0.85 },
    o.bloom || {}
  );
  const vignetteOpts = Object.assign(
    { offset: 0.95, darkness: 1.4 },
    o.vignette || {}
  );

  const composer = fx.createComposer(threeApi.renderer, threeApi.scene, threeApi.camera);
  fx.addBloom(composer, bloomOpts);
  fx.addVignette(composer, vignetteOpts);
  fx.addOutputPass(composer);

  function draw() {
    composer.render();
  }

  function dispose() {
    if (composer && composer.passes) {
      composer.passes.forEach((p) => {
        if (p && typeof p.dispose === 'function') p.dispose();
      });
    }
  }

  return { composer, draw, dispose };
}

// Window mount for non-module callers.
if (typeof window !== 'undefined') {
  window.SigillerieRecipeBaseline = { applyRecipeBaseline };
}

export default { applyRecipeBaseline };
