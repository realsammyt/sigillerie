/**
 * scene-presets.js · Sigillerie 3D Track A scene-preset library
 *
 * Six vetted scene compositions. Each preset is a curated bundle of
 * lighting mood + material recommendation + camera setup + postprocessing
 * config. Calling one configures `threeApi.scene` end-to-end so a recipe
 * author doesn't have to roll lighting, materials and post from scratch.
 *
 * --- THE SIX ---
 *
 *   applyHeroStudio       product launch, cool studio + clear glass + heavy bloom
 *   applySpatialVitrine   Vision Pro spatial UI, warm sunset + frosted glass
 *   applyEditorialTilt    magazine layout, softbox + paper-warm + grain
 *   applyAuroraDrift      abstract hero, aurora + plasma + heavy bloom
 *   applyPaperDiorama     hand-crafted diorama, cool softbox + paper + grain
 *   applyData3D           data viz in 3D, softbox + ceramic + minimal post
 *
 * --- DEPENDENCIES ---
 *
 * Reads (defensively) from the window namespace, so other Track A authors
 * can build sibling libraries in parallel:
 *
 *   window.SigillerieMaterials   six factory funcs (createGlassClear ...)
 *   window.SigillerieLighting    six controllers (applyCoolStudio ...)
 *   window.SigillerieEffects     post helpers (applyBloom, applyDOF ...)
 *
 * If any dependency is missing, the preset logs a warning and falls back
 * to a basic three-point + standard material + no post pipeline. Never
 * crashes. The recipe still renders, just plainer.
 *
 * --- USAGE FROM A RECIPE ---
 *
 *   // inside a Stage3D onReady callback:
 *   const kit = window.SigilleriePresets.applyHeroStudio(threeApi, {
 *     focus: 5.0,
 *     attachDraw: true,
 *   });
 *
 *   // mesh creation uses the kit's material factory:
 *   const heroMat = kit.material();
 *   const hero = new THREE.Mesh(geom, heroMat);
 *   threeApi.scene.add(hero);
 *
 *   // background:
 *   threeApi.scene.background = new THREE.Color(kit.bgColor);
 *
 *   // if attachDraw was false, the recipe wires draw itself:
 *   threeApi.draw = kit.postprocessing.draw;
 *
 *   // teardown on hot reload:
 *   kit.dispose();
 *
 * Recipe authors who want to override one knob (e.g. softer bloom) can
 * pass it through opts; preset internals merge over the curated defaults.
 *
 * No em-dashes. caveman idioms. Sigillerie taste.
 */

// THREE comes from the loader namespace. Recipes that don't have it loaded
// yet would already have crashed in stage3d.jsx, so this is a fair grab.
const THREE = (typeof window !== 'undefined' && window.Sigillerie3D)
  ? window.Sigillerie3D.THREE
  : null;

// ---- Defensive lookup helpers ----------------------------------------------

function pickMaterials() {
  if (typeof window === 'undefined') return null;
  return window.SigillerieMaterials || null;
}

function pickLighting() {
  if (typeof window === 'undefined') return null;
  return window.SigillerieLighting || null;
}

function pickEffects() {
  if (typeof window === 'undefined') return null;
  // Two possible mount points. The new SigillerieEffects namespace, or the
  // pre-existing Sigillerie3D.effects that ships with tsl-effects.js. Both
  // expose applyBloom / applyDOF / applyVignette with the same shape, so
  // we can wire either as a same source.
  return (
    window.SigillerieEffects ||
    (window.Sigillerie3D && window.Sigillerie3D.effects) ||
    null
  );
}

function warnOnce(key, msg) {
  if (typeof window === 'undefined') return;
  window.__sigilleriePresetWarns = window.__sigilleriePresetWarns || {};
  if (window.__sigilleriePresetWarns[key]) return;
  window.__sigilleriePresetWarns[key] = true;
  console.warn('[SigilleriePresets] ' + msg);
}

// ---- Fallback fabricators (used when a sibling lib is absent) --------------

// Three-point fallback when SigillerieLighting is not on window. Returns a
// minimal controller shape: { lights: [...], dispose() }.
function fallbackThreePoint(THREE, scene, opts) {
  const o = opts || {};
  const keyColor = o.keyColor != null ? o.keyColor : 0xffffff;
  const fillColor = o.fillColor != null ? o.fillColor : 0xa0c4ff;
  const rimColor = o.rimColor != null ? o.rimColor : 0xffd6a0;

  const key = new THREE.DirectionalLight(keyColor, 5.0);
  key.position.set(3, 4, 4);
  const fill = new THREE.DirectionalLight(fillColor, 1.4);
  fill.position.set(-3, 2, 2);
  const rim = new THREE.DirectionalLight(rimColor, 4.0);
  rim.position.set(-2, 3, -4);
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);

  scene.add(key, fill, rim, ambient);

  return {
    lights: [key, fill, rim, ambient],
    dispose() {
      [key, fill, rim, ambient].forEach((l) => {
        if (l.parent) l.parent.remove(l);
      });
    },
  };
}

// Standard-material fallback. Honest matte. No transmission tricks.
function fallbackMaterialFactory() {
  return function () {
    return new THREE.MeshStandardMaterial({
      color: 0xcfcfcf,
      roughness: 0.55,
      metalness: 0.0,
    });
  };
}

// No-op post pipeline. draw simply calls renderer.render().
function fallbackPost(threeApi) {
  return {
    composer: null,
    draw() {
      if (threeApi && threeApi.renderer && threeApi.scene && threeApi.camera) {
        threeApi.renderer.render(threeApi.scene, threeApi.camera);
      }
    },
    dispose() {},
  };
}

// ---- Light controller resolver (real lib or fallback) ---------------------

function lightWith(name, threeApi, opts) {
  const lib = pickLighting();
  if (lib && typeof lib[name] === 'function') {
    // lighting-moods API: (THREE, group, opts) -> { lights, update, dispose }
    return lib[name](threeApi.THREE, threeApi.scene, opts || {});
  }
  warnOnce(
    'lighting:' + name,
    'SigillerieLighting.' + name + ' not found. Using three-point fallback.'
  );
  return fallbackThreePoint(threeApi.THREE, threeApi.scene, opts || {});
}

// Material factory resolver. Returned function builds a fresh material per
// call so each mesh has its own instance (so animating one doesn't drift
// the rest). Falls back to a plain standard material if the lib is absent.
function materialFactory(name, opts) {
  const lib = pickMaterials();
  if (lib && typeof lib[name] === 'function') {
    return function () {
      // Real materials in materials.js take (THREE, opts). Pass both.
      try {
        return lib[name](THREE, opts || {});
      } catch (err) {
        // Older signature might be (opts) only. Try once before falling back.
        try {
          return lib[name](opts || {});
        } catch (e2) {
          warnOnce(
            'material:err:' + name,
            'Material factory ' + name + ' threw: ' + err.message
          );
          return fallbackMaterialFactory()();
        }
      }
    };
  }
  warnOnce(
    'material:' + name,
    'SigillerieMaterials.' + name + ' not found. Using standard fallback.'
  );
  return fallbackMaterialFactory();
}

// ---- Postprocessing resolver ----------------------------------------------

// Build a post pipeline by chaining named effect calls. Every effect lib
// is expected to expose applyBloom / applyDOF / applyVignette and v2 will
// add applyChromatic / applyGrain. Missing effects are silently skipped
// (with a one-shot warn) so a deck that only has bloom available still
// gets a usable render path.
//
// Returns { composer, draw, dispose }.
function buildPost(threeApi, recipe) {
  const fx = pickEffects();
  if (!fx) {
    warnOnce(
      'effects:none',
      'SigillerieEffects not found. No postprocessing; using direct render.'
    );
    return fallbackPost(threeApi);
  }

  // Initialize composer with bloom (or any first pass that creates one).
  // The tsl-effects.js applyBloom returns the composer; later passes (DOF,
  // vignette etc.) splice into it.
  let composer = null;
  const passes = [];

  if (recipe.bloom && typeof fx.applyBloom === 'function') {
    composer = fx.applyBloom(
      threeApi.renderer,
      threeApi.scene,
      threeApi.camera,
      recipe.bloom
    );
    passes.push('bloom');
  }

  // DOF requires its own composer chain in the existing tsl-effects.js,
  // but newer SigillerieEffects.applyDOF should work on an existing
  // composer. caveman: try composer-extending first, then fall back to a
  // fresh DOF composer if no bloom was requested.
  if (recipe.dof && typeof fx.applyDOF === 'function') {
    if (!composer) {
      composer = fx.applyDOF(
        threeApi.renderer,
        threeApi.scene,
        threeApi.camera,
        recipe.dof
      );
      passes.push('dof');
    } else if (typeof fx.attachDOF === 'function') {
      // hypothetical attach API for v2 effects lib
      fx.attachDOF(composer, threeApi.scene, threeApi.camera, recipe.dof);
      passes.push('dof');
    }
    // if neither path fits, skip DOF rather than thrash composers.
  }

  if (recipe.vignette && typeof fx.applyVignette === 'function' && composer) {
    fx.applyVignette(composer, recipe.vignette);
    passes.push('vignette');
  }

  if (recipe.chromatic && typeof fx.applyChromatic === 'function' && composer) {
    fx.applyChromatic(composer, recipe.chromatic);
    passes.push('chromatic');
  }

  if (recipe.grain && typeof fx.applyGrain === 'function' && composer) {
    fx.applyGrain(composer, recipe.grain);
    passes.push('grain');
  }

  // No composer means no effects matched; ship the fallback path.
  if (!composer) return fallbackPost(threeApi);

  const draw = function () {
    composer.render();
  };

  const dispose = function () {
    if (composer && composer.passes) {
      composer.passes.forEach((p) => {
        if (p && typeof p.dispose === 'function') p.dispose();
      });
    }
  };

  return { composer, draw, dispose, passes };
}

// ---- Camera plumbing ------------------------------------------------------

// Configure threeApi.camera in place. Returns a small drift object the
// recipe can call per frame for slow idle motion. caveman: no chained
// promises, just direct mutations.
function setupCamera(threeApi, cfg) {
  const cam = threeApi.camera;
  if (!cam) return { drift() {}, target: new THREE.Vector3() };

  if (typeof cfg.fov === 'number') {
    cam.fov = cfg.fov;
    cam.updateProjectionMatrix();
  }
  if (Array.isArray(cfg.pos) && cfg.pos.length === 3) {
    cam.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
  }
  const target = new THREE.Vector3(
    cfg.target ? cfg.target[0] : 0,
    cfg.target ? cfg.target[1] : 0,
    cfg.target ? cfg.target[2] : 0
  );
  cam.lookAt(target);

  // Idle drift. cfg.drift is a string tag: 'slight' | 'orbit' | 'tilt' | null.
  const basePos = cam.position.clone();
  const driftKind = cfg.drift || null;

  function drift(t) {
    if (!driftKind) return;
    if (driftKind === 'slight') {
      // 0.1deg sway over an 8-second cycle. just enough to feel alive.
      const a = Math.sin(t * 0.25) * 0.0017;
      cam.position.x = basePos.x + Math.cos(a) * 0.05 - 0.05;
      cam.position.y = basePos.y + Math.sin(t * 0.18) * 0.02;
      cam.lookAt(target);
    } else if (driftKind === 'orbit') {
      // slow circular pan. radius preserved.
      const r = Math.hypot(basePos.x, basePos.z);
      const a = t * 0.07;
      cam.position.x = Math.sin(a) * r;
      cam.position.z = Math.cos(a) * r;
      cam.lookAt(target);
    } else if (driftKind === 'tilt') {
      // tiny isometric breathing. y bobs, lookAt fixed.
      cam.position.y = basePos.y + Math.sin(t * 0.3) * 0.04;
      cam.lookAt(target);
    }
  }

  return { drift, target };
}

// ---- Shared kit assembler -------------------------------------------------

// Every preset assembles the same shape. This helper saves repeating the
// same return literal six times.
function assembleKit(threeApi, parts, opts) {
  const bgColor = opts.bgColor || parts.bgDefault;
  threeApi.scene.background = new THREE.Color(bgColor);
  if (opts.attachDraw) threeApi.draw = parts.post.draw;

  return {
    lighting: parts.lighting,
    material: parts.material,
    camera: {
      fov: parts.cameraCfg.fov,
      pos: parts.cameraCfg.pos,
      target: parts.cameraCfg.target,
      drift: parts.camDrift.drift,
    },
    postprocessing: parts.post,
    bgColor,
    dispose() {
      if (parts.lighting && parts.lighting.dispose) parts.lighting.dispose();
      if (parts.post && parts.post.dispose) parts.post.dispose();
    },
  };
}

// ---- The presets ----------------------------------------------------------
//
// Each preset follows the same internal flow:
//   1. lighting controller
//   2. material factory
//   3. camera setup (+ drift)
//   4. post pipeline
//   5. assembleKit (bg, attachDraw, return shape)

/**
 * Cool studio + glass-clear + heavy bloom + DOF.
 * Product launch hero. The "default expensive" look.
 */
export function applyHeroStudio(threeApi, opts = {}) {
  if (!THREE) throw new Error('[SigilleriePresets] THREE not on Sigillerie3D namespace');

  const lighting = lightWith('applyCoolStudio', threeApi, opts.lighting);
  const material = materialFactory('createGlassClear', opts.material);
  const cameraCfg = { fov: 35, pos: [0, 0.4, 5], target: [0, 0, 0], drift: 'slight' };
  const camDrift = setupCamera(threeApi, cameraCfg);

  const focusDist = typeof opts.focus === 'number' ? opts.focus : 5.0;
  const post = buildPost(threeApi, {
    bloom: { strength: 0.6, radius: 0.6, threshold: 0.85 },
    dof: { focus: focusDist, aperture: 0.0002, maxblur: 0.012 },
    vignette: { offset: 1.0, darkness: 0.4 },
  });

  return assembleKit(
    threeApi,
    { lighting, material, cameraCfg, camDrift, post, bgDefault: '#0a1428' },
    opts
  );
}

/**
 * Warm sunset + glass-frosted + bloom + chromatic.
 * Vision Pro spatial UI. Soft, milky, rim-lit.
 */
export function applySpatialVitrine(threeApi, opts = {}) {
  if (!THREE) throw new Error('[SigilleriePresets] THREE not on Sigillerie3D namespace');

  const lighting = lightWith('applyWarmSunset', threeApi, opts.lighting);
  const material = materialFactory('createGlassFrosted', opts.material);
  const cameraCfg = { fov: 38, pos: [0, 0.2, 5.5], target: [0, 0, 0], drift: 'slight' };
  const camDrift = setupCamera(threeApi, cameraCfg);

  const post = buildPost(threeApi, {
    bloom: { strength: 0.85, radius: 0.85, threshold: 0.72 },
    vignette: { offset: 0.95, darkness: 1.25 },
    chromatic: { magnitude: 0.0007 },
  });

  // deep purple-navy. closer to film than to SaaS.
  return assembleKit(
    threeApi,
    { lighting, material, cameraCfg, camDrift, post, bgDefault: '#0a0814' },
    opts
  );
}

/**
 * Softbox + paper-warm + grain + warm grade.
 * Magazine layout. Calm, sub-surf paper feel.
 */
export function applyEditorialTilt(threeApi, opts = {}) {
  if (!THREE) throw new Error('[SigilleriePresets] THREE not on Sigillerie3D namespace');

  const lighting = lightWith('applySoftboxNeutral', threeApi, opts.lighting);
  const material = materialFactory('createPaperWarm', opts.material);
  // slight isometric tilt: camera off-axis, looking down a touch.
  const cameraCfg = { fov: 30, pos: [1.8, 1.4, 4.6], target: [0, 0, 0], drift: 'slight' };
  const camDrift = setupCamera(threeApi, cameraCfg);

  const post = buildPost(threeApi, {
    bloom: { strength: 0.2, radius: 0.5, threshold: 0.9 },
    vignette: { offset: 1.0, darkness: 0.3 },
    grain: { intensity: 0.06, size: 1.2 },
  });

  return assembleKit(
    threeApi,
    { lighting, material, cameraCfg, camDrift, post, bgDefault: '#f4ead8' },
    opts
  );
}

/**
 * Aurora lighting + plasma material + heavy bloom.
 * Abstract hero. The "what is that?" opener for an animation.
 */
export function applyAuroraDrift(threeApi, opts = {}) {
  if (!THREE) throw new Error('[SigilleriePresets] THREE not on Sigillerie3D namespace');

  const lighting = lightWith('applyAurora', threeApi, opts.lighting);
  const material = materialFactory('createPlasmaGlow', opts.material);
  const cameraCfg = { fov: 42, pos: [3.4, 0.6, 4.0], target: [0, 0, 0], drift: 'orbit' };
  const camDrift = setupCamera(threeApi, cameraCfg);

  const post = buildPost(threeApi, {
    bloom: { strength: 1.1, radius: 0.85, threshold: 0.6 },
    vignette: { offset: 1.0, darkness: 0.7 },
    chromatic: { magnitude: 0.0008 },
  });

  // pure black so the plasma carries all the color.
  return assembleKit(
    threeApi,
    { lighting, material, cameraCfg, camDrift, post, bgDefault: '#000000' },
    opts
  );
}

/**
 * Cool-studio softbox + paper-warm + grain + slight desat.
 * Hand-crafted diorama, top-down isometric.
 */
export function applyPaperDiorama(threeApi, opts = {}) {
  if (!THREE) throw new Error('[SigilleriePresets] THREE not on Sigillerie3D namespace');

  // caller can opt to use softbox if cool-studio reads too cold for paper.
  const lightName = opts.useSoftbox ? 'applySoftboxNeutral' : 'applyCoolStudio';
  const lighting = lightWith(lightName, threeApi, opts.lighting);
  const material = materialFactory('createPaperWarm', opts.material);
  // 30 degree above + offset. classic diorama angle.
  const cameraCfg = { fov: 28, pos: [3.0, 3.0, 3.0], target: [0, 0, 0], drift: 'tilt' };
  const camDrift = setupCamera(threeApi, cameraCfg);

  const post = buildPost(threeApi, {
    bloom: { strength: 0.18, radius: 0.5, threshold: 0.92 },
    vignette: { offset: 1.0, darkness: 0.35 },
    grain: { intensity: 0.08, size: 1.0 },
  });

  return assembleKit(
    threeApi,
    { lighting, material, cameraCfg, camDrift, post, bgDefault: '#f1e6cf' },
    opts
  );
}

/**
 * Softbox + ceramic-matte + minimal post.
 * Data viz in 3D. Clarity over polish: NO DOF, vignette only.
 */
export function applyData3D(threeApi, opts = {}) {
  if (!THREE) throw new Error('[SigilleriePresets] THREE not on Sigillerie3D namespace');

  const lighting = lightWith('applySoftboxNeutral', threeApi, opts.lighting);
  const material = materialFactory('createCeramicMatte', opts.material);
  // fixed camera. data shouldn't shimmy.
  const cameraCfg = { fov: 35, pos: [0, 0.6, 5.2], target: [0, 0, 0], drift: null };
  const camDrift = setupCamera(threeApi, cameraCfg);

  // minimal post. vignette pulls the eye toward the center plot.
  // explicitly NO DOF (clarity), NO chromatic (parsing values matters).
  const post = buildPost(threeApi, {
    vignette: { offset: 1.0, darkness: 0.25 },
  });

  // bg: paper white default, deep blue when caller wants a darker chart.
  const bgDefault = opts.dark === true ? '#0c1a2e' : '#f6f4ee';

  return assembleKit(
    threeApi,
    { lighting, material, cameraCfg, camDrift, post, bgDefault },
    opts
  );
}

// ---- Window mount ---------------------------------------------------------

const SigilleriePresets = {
  applyHeroStudio,
  applySpatialVitrine,
  applyEditorialTilt,
  applyAuroraDrift,
  applyPaperDiorama,
  applyData3D,
};

if (typeof window !== 'undefined') {
  window.SigilleriePresets = SigilleriePresets;
  // Also nest under Sigillerie3D for parity with helpers/effects.
  window.Sigillerie3D = Object.assign(window.Sigillerie3D || {}, {
    presets: SigilleriePresets,
  });
}

export default SigilleriePresets;
