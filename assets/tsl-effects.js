/**
 * tsl-effects.js · Sigillerie 3D postprocessing helpers
 *
 * Composable EffectComposer wrappers. Build one composer, add passes in
 * order, hand to the recipe's render loop. The "tsl-" prefix is preserved
 * per the master plan; this module currently uses classic three.js
 * postprocessing (EffectComposer + addons). TSL-node ports land in Phase 5
 * once WebGPURenderer stabilizes for headless capture. The API surface
 * here is what recipes call.
 *
 * Caveman rules:
 *   - one composer, many passes
 *   - composer.render() per frame, NOT renderer.render()
 *   - OutputPass goes last, always
 *   - pass order: render, bloom, dof, chromatic, grain, vignette, color, output
 *
 * Full usage example:
 *
 *   import {
 *     createComposer, addBloom, addDOF, addVignette,
 *     addChromaticAberration, addFilmGrain, addColorGrade, addOutputPass,
 *   } from './tsl-effects.js';
 *
 *   const composer = createComposer(renderer, scene, camera);
 *   addBloom(composer,  { strength: 0.5, radius: 0.7, threshold: 0.85 });
 *   addDOF(composer,    { focus: 4.2, aperture: 0.0001, maxblur: 0.008 });
 *   addChromaticAberration(composer, { magnitude: 0.0008 });
 *   addFilmGrain(composer, { intensity: 0.04 });
 *   addVignette(composer, { offset: 0.95, darkness: 1.4 });
 *   addColorGrade(composer, { lut: 'cinematic' });
 *   addOutputPass(composer);
 *
 *   threeApi.draw = () => composer.render();
 *
 *   // resize hook
 *   window.addEventListener('resize', () => {
 *     composer.setSize(window.innerWidth, window.innerHeight);
 *   });
 *
 * Convenience:
 *
 *   const composer = createHeroStack(renderer, scene, camera, {
 *     bloom: { strength: 0.5 },
 *     vignette: { darkness: 1.4 },
 *   });
 *   threeApi.draw = () => composer.render();
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ============================================================
 * Composer construction
 * ============================================================ */

/**
 * Build an EffectComposer with a RenderPass already mounted. No effect
 * passes yet, no OutputPass yet. Caller adds passes then calls
 * addOutputPass(composer) last.
 *
 * opts: { width, height, pixelRatio }
 *   - width/height default to renderer.getSize()
 *   - pixelRatio defaults to renderer.getPixelRatio()
 */
export function createComposer(renderer, scene, camera, opts) {
  const o = opts || {};

  const size = new THREE.Vector2();
  renderer.getSize(size);
  const w = o.width != null ? o.width : size.x;
  const h = o.height != null ? o.height : size.y;
  const pr = o.pixelRatio != null ? o.pixelRatio : renderer.getPixelRatio();

  const composer = new EffectComposer(renderer);
  composer.setSize(w, h);
  composer.setPixelRatio(pr);
  composer.addPass(new RenderPass(scene, camera));
  return composer;
}

/**
 * Convenience wrapper: build the most common postprocessing stack for hero
 * deliverables. createComposer + addBloom + addVignette + addOutputPass.
 *
 * opts: { bloom, vignette, width, height, pixelRatio }
 *   - bloom and vignette are forwarded to their respective add functions
 *   - width/height/pixelRatio forwarded to createComposer
 */
export function createHeroStack(renderer, scene, camera, opts) {
  const o = opts || {};
  const composer = createComposer(renderer, scene, camera, {
    width: o.width,
    height: o.height,
    pixelRatio: o.pixelRatio,
  });
  addBloom(composer, o.bloom || {});
  addVignette(composer, o.vignette || {});
  addOutputPass(composer);
  return composer;
}

/* ============================================================
 * Pass: Bloom (UnrealBloomPass)
 * ============================================================ */

/**
 * Add UnrealBloomPass to an existing composer. Bloom sells the "premium"
 * feel by glowing bright spots. Defaults match aesthetic.md §4.
 *
 * opts: { strength=0.5, radius=0.7, threshold=0.85 }
 */
export function addBloom(composer, opts) {
  const o = opts || {};
  const strength = o.strength != null ? o.strength : 0.5;
  const radius = o.radius != null ? o.radius : 0.7;
  const threshold = o.threshold != null ? o.threshold : 0.85;

  const size = new THREE.Vector2();
  composer.renderer.getSize(size);

  const pass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    strength,
    radius,
    threshold
  );
  composer.addPass(pass);
  return composer;
}

/* ============================================================
 * Pass: Depth of Field (BokehPass)
 * ============================================================ */

/**
 * Add BokehPass (DOF) to an existing composer. Recipe usually points
 * focus at hero distance; aperture controls bokeh blob size.
 *
 * opts: { focus=5.0, aperture=0.0001, maxblur=0.008 }
 */
export function addDOF(composer, opts) {
  const o = opts || {};
  const focus = o.focus != null ? o.focus : 5.0;
  const aperture = o.aperture != null ? o.aperture : 0.0001;
  const maxblur = o.maxblur != null ? o.maxblur : 0.008;

  // BokehPass needs scene + camera. Pull them from the RenderPass that
  // createComposer mounted. If caller built composer some other way and
  // there's no RenderPass, we throw with a clear message.
  const renderPass = composer.passes.find(
    (p) => p && p.scene && p.camera && p instanceof RenderPass
  );
  if (!renderPass) {
    throw new Error(
      'tsl-effects: addDOF requires a RenderPass on the composer. ' +
        'Use createComposer() to build one.'
    );
  }

  const pass = new BokehPass(renderPass.scene, renderPass.camera, {
    focus,
    aperture,
    maxblur,
  });
  composer.addPass(pass);
  return composer;
}

/* ============================================================
 * Pass: Vignette (ShaderPass)
 * ============================================================ */

// Subtle radial darkening for hero shots. Multiplies the framebuffer by a
// smoothstep falloff from screen center.
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.95 },
    darkness: { value: 1.4 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * vec2(offset);
      float vig = smoothstep(0.8, 0.2, dot(uv, uv));
      // darkness scales how much vig pulls colors down. 1.0 == full vig.
      gl_FragColor = vec4(mix(texel.rgb, texel.rgb * vig, clamp(darkness, 0.0, 2.0) * 0.5), texel.a);
    }
  `,
};

/**
 * Add vignette to an existing composer. opts: { offset=0.95, darkness=1.4 }
 */
export function addVignette(composer, opts) {
  const o = opts || {};
  const pass = new ShaderPass(VignetteShader);
  pass.uniforms.offset.value = o.offset != null ? o.offset : 0.95;
  pass.uniforms.darkness.value = o.darkness != null ? o.darkness : 1.4;
  composer.addPass(pass);
  return composer;
}

/* ============================================================
 * Pass: Chromatic aberration (ShaderPass)
 * ============================================================ */

// Sample R/G/B with a small radial offset from screen center. Magnitude
// scales the offset; 0.0008 reads as "lens", anything above 0.003 reads
// as parody. Cheap GPU-friendly version (no rgb-shift along chroma axes).
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    magnitude: { value: 0.0008 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float magnitude;
    varying vec2 vUv;
    void main() {
      // direction from screen center, squared so edges shift more than middle
      vec2 dir = vUv - 0.5;
      float dist = dot(dir, dir);
      vec2 offset = dir * dist * magnitude * 8.0;

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      float a = texture2D(tDiffuse, vUv).a;
      gl_FragColor = vec4(r, g, b, a);
    }
  `,
};

/**
 * Add chromatic aberration to an existing composer. opts: { magnitude=0.0008 }
 *
 * aesthetic.md §4 caps useful magnitude at ~0.0008. Above 0.003 looks
 * like a broken VHS. We don't enforce a ceiling; that's the caller's job.
 */
export function addChromaticAberration(composer, opts) {
  const o = opts || {};
  const pass = new ShaderPass(ChromaticAberrationShader);
  pass.uniforms.magnitude.value = o.magnitude != null ? o.magnitude : 0.0008;
  composer.addPass(pass);
  return composer;
}

/* ============================================================
 * Pass: Film grain (ShaderPass)
 * ============================================================ */

// Hash-based per-pixel noise. Same hash function as the common GPU
// noise pattern: fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453).
// Animated by feeding `time` so grain shimmers across frames.
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.05 },
    count: { value: 4096.0 },
    time: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float count;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      // count controls effective grain density via a quantized sample lattice
      vec2 grainUv = floor(vUv * count + time * 137.31) / count;
      float n = hash(grainUv + fract(time)) - 0.5;
      vec3 graded = texel.rgb + n * intensity;
      gl_FragColor = vec4(graded, texel.a);
    }
  `,
};

/**
 * Add film grain to an existing composer. opts: { intensity=0.05, count=4096 }
 *
 * Caller must update the `time` uniform per frame for animated grain. We
 * patch the pass with a `.tick(dt)` helper that does this. If caller
 * never ticks, grain is static (still useful, just less filmic).
 */
export function addFilmGrain(composer, opts) {
  const o = opts || {};
  const pass = new ShaderPass(FilmGrainShader);
  pass.uniforms.intensity.value = o.intensity != null ? o.intensity : 0.05;
  pass.uniforms.count.value = o.count != null ? o.count : 4096.0;

  // expose tick on the pass so recipes can drive the time uniform
  pass.tick = function (dt) {
    pass.uniforms.time.value += (dt != null ? dt : 0.016);
  };

  // also auto-tick from composer.render via a wrap (cheap, single closure)
  if (!composer.__tslTickPatched) {
    const originalRender = composer.render.bind(composer);
    let lastT = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    composer.render = function (deltaTime) {
      const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      const dt = (now - lastT) / 1000.0;
      lastT = now;
      // tick all passes that expose .tick
      for (let i = 0; i < composer.passes.length; i++) {
        const p = composer.passes[i];
        if (p && typeof p.tick === 'function') p.tick(dt);
      }
      return originalRender(deltaTime);
    };
    composer.__tslTickPatched = true;
  }

  composer.addPass(pass);
  return composer;
}

/* ============================================================
 * Pass: Color grade (ShaderPass)
 * ============================================================ */

// Per-LUT presets. Each preset is a channel-mix matrix + saturation +
// curve gamma. v1 doesn't load .cube LUTs; presets here cover the four
// most common looks recipes ask for.
const COLOR_GRADE_PRESETS = {
  neutral: {
    mix: [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ],
    saturation: 1.0,
    gamma: 1.0,
  },
  warm: {
    // pull reds and yellows up, drop blues a touch
    mix: [
      [1.08, 0.02, 0.0],
      [0.02, 1.04, 0.0],
      [0.0, 0.0, 0.92],
    ],
    saturation: 1.05,
    gamma: 0.95,
  },
  cool: {
    // teal shadows, keep mid blues honest
    mix: [
      [0.92, 0.0, 0.04],
      [0.0, 1.02, 0.04],
      [0.04, 0.02, 1.08],
    ],
    saturation: 1.0,
    gamma: 1.05,
  },
  cinematic: {
    // teal-and-orange. shadows cooler, highlights warmer.
    mix: [
      [1.08, 0.04, -0.04],
      [0.0, 1.02, -0.02],
      [-0.04, 0.02, 1.04],
    ],
    saturation: 1.08,
    gamma: 0.92,
  },
};

const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    mixR: { value: new THREE.Vector3(1.0, 0.0, 0.0) },
    mixG: { value: new THREE.Vector3(0.0, 1.0, 0.0) },
    mixB: { value: new THREE.Vector3(0.0, 0.0, 1.0) },
    saturation: { value: 1.0 },
    gamma: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 mixR;
    uniform vec3 mixG;
    uniform vec3 mixB;
    uniform float saturation;
    uniform float gamma;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;

      // channel mix
      vec3 mixed = vec3(
        dot(c, mixR),
        dot(c, mixG),
        dot(c, mixB)
      );

      // saturation around luma
      float luma = dot(mixed, vec3(0.2126, 0.7152, 0.0722));
      vec3 satted = mix(vec3(luma), mixed, saturation);

      // gamma curve (keeps channels positive)
      vec3 curved = pow(max(satted, vec3(0.0)), vec3(gamma));

      gl_FragColor = vec4(curved, texel.a);
    }
  `,
};

/**
 * Add color grade to an existing composer.
 *
 * opts: { lut: 'warm' | 'cool' | 'cinematic' | 'neutral' (default),
 *         saturation, gamma, mix }
 *   - lut picks a preset; saturation/gamma/mix override the preset's values
 *   - mix is a 3x3 array if you want to bypass the preset
 */
export function addColorGrade(composer, opts) {
  const o = opts || {};
  const presetName =
    typeof o.lut === 'string' && COLOR_GRADE_PRESETS[o.lut] ? o.lut : 'neutral';
  const preset = COLOR_GRADE_PRESETS[presetName];

  const pass = new ShaderPass(ColorGradeShader);
  const m = o.mix && o.mix.length === 3 ? o.mix : preset.mix;
  pass.uniforms.mixR.value.set(m[0][0], m[0][1], m[0][2]);
  pass.uniforms.mixG.value.set(m[1][0], m[1][1], m[1][2]);
  pass.uniforms.mixB.value.set(m[2][0], m[2][1], m[2][2]);
  pass.uniforms.saturation.value =
    o.saturation != null ? o.saturation : preset.saturation;
  pass.uniforms.gamma.value = o.gamma != null ? o.gamma : preset.gamma;

  composer.addPass(pass);
  return composer;
}

/* ============================================================
 * Pass: Output (must be last)
 * ============================================================ */

/**
 * Add OutputPass to an existing composer. Must be the last pass added.
 * Handles tone mapping output and color-space conversion to display.
 */
export function addOutputPass(composer) {
  composer.addPass(new OutputPass());
  return composer;
}

/* ============================================================
 * Tone mapping helper (renderer-level, not a pass)
 * ============================================================ */

/**
 * Force ACES Filmic tone mapping on a renderer. Stage3D sets this by
 * default; this helper exists for hot-reload contexts that swap the
 * renderer or for recipes that opt out and back in.
 */
export function applyACESToneMap(renderer, exposure) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure != null ? exposure : 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

/* ============================================================
 * Legacy convenience wrappers (back-compat)
 *
 * These match the pre-refactor API. Recipes haven't shipped yet, so
 * breaking them is acceptable, but keeping these costs little and
 * smooths the migration.
 * ============================================================ */

/**
 * Legacy: build a complete bloom-only composer. Equivalent to
 * createComposer + addBloom + addOutputPass.
 *
 * opts forwarded to addBloom.
 */
export function applyBloom(renderer, scene, camera, opts) {
  const composer = createComposer(renderer, scene, camera);
  addBloom(composer, opts);
  addOutputPass(composer);
  return composer;
}

/**
 * Legacy: build a complete DOF-only composer. Equivalent to
 * createComposer + addDOF + addOutputPass.
 *
 * opts forwarded to addDOF.
 */
export function applyDOF(renderer, scene, camera, opts) {
  const composer = createComposer(renderer, scene, camera);
  addDOF(composer, opts);
  addOutputPass(composer);
  return composer;
}

/**
 * Legacy: vignette as a tail-insert into an existing composer. Splices
 * before the final pass (which is usually OutputPass) so output color-
 * space conversion still runs last.
 *
 * Prefer addVignette for new code (added before addOutputPass instead of
 * spliced in after).
 *
 * opts: { offset=0.95, darkness=1.4 }
 */
export function applyVignette(composer, opts) {
  const o = opts || {};
  const pass = new ShaderPass(VignetteShader);
  pass.uniforms.offset.value = o.offset != null ? o.offset : 0.95;
  pass.uniforms.darkness.value = o.darkness != null ? o.darkness : 1.4;

  const passes = composer.passes;
  if (passes.length > 0) {
    composer.passes = passes
      .slice(0, -1)
      .concat([pass, passes[passes.length - 1]]);
  } else {
    composer.addPass(pass);
  }
  return pass;
}

/* ============================================================
 * Window namespace mount
 * ============================================================ */

if (typeof window !== 'undefined') {
  window.Sigillerie3D = Object.assign(window.Sigillerie3D || {}, {
    effects: {
      // new composable API
      createComposer,
      createHeroStack,
      addBloom,
      addDOF,
      addVignette,
      addChromaticAberration,
      addFilmGrain,
      addColorGrade,
      addOutputPass,
      // tone map
      applyACESToneMap,
      // legacy
      applyBloom,
      applyDOF,
      applyVignette,
    },
  });
}
