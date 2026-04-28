/**
 * tsl-effects.js · Sigillerie 3D postprocessing helpers
 *
 * NOTE: filename "tsl-effects" is preserved per the master plan. Current
 * implementation uses CLASSIC three.js postprocessing (EffectComposer +
 * passes from three/addons/postprocessing/). TSL nodes (Three.js Shading
 * Language) are a Phase 5 enhancement; these helpers will be ported to
 * TSL nodes once the WebGPURenderer pipeline stabilizes for headless
 * recording. Until then, the API surface here is what recipes call.
 *
 * Exports (all return a composer the recipe must call composer.render() in
 * place of renderer.render()):
 *   - applyBloom(renderer, scene, camera, opts)
 *   - applyDOF(renderer, scene, camera, opts)
 *   - applyACESToneMap(renderer)
 *   - applyVignette(composer, opts)
 *
 * Example:
 *
 *   import { applyBloom } from './tsl-effects.js';
 *   const composer = applyBloom(renderer, scene, camera, { strength: 0.7 });
 *   // in __renderFrame: composer.render() instead of renderer.render()
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Build an EffectComposer with bloom. Returns the composer; recipe drives
 * it via composer.render() per frame instead of renderer.render(scene,cam).
 *
 * opts: { strength=0.7, radius=0.5, threshold=0.85 }
 */
export function applyBloom(renderer, scene, camera, opts) {
  const o = opts || {};
  const strength = o.strength != null ? o.strength : 0.7;
  const radius = o.radius != null ? o.radius : 0.5;
  const threshold = o.threshold != null ? o.threshold : 0.85;

  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);
  composer.setSize(size.x, size.y);
  composer.setPixelRatio(renderer.getPixelRatio());

  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      strength,
      radius,
      threshold
    )
  );
  composer.addPass(new OutputPass());
  return composer;
}

/**
 * Build an EffectComposer with bokeh depth-of-field. Bokeh wants a
 * focusDistance in scene units; recipes typically point it at the hero.
 *
 * opts: { focus=2, aperture=0.0002, maxblur=0.01 }
 */
export function applyDOF(renderer, scene, camera, opts) {
  const o = opts || {};
  const focus = o.focus != null ? o.focus : 2;
  const aperture = o.aperture != null ? o.aperture : 0.0002;
  const maxblur = o.maxblur != null ? o.maxblur : 0.01;

  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);
  composer.setSize(size.x, size.y);
  composer.setPixelRatio(renderer.getPixelRatio());

  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new BokehPass(scene, camera, {
      focus,
      aperture,
      maxblur,
    })
  );
  composer.addPass(new OutputPass());
  return composer;
}

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

// Vignette shader. Subtle radial darkening for hero shots. Implemented as
// a ShaderPass tail. Multiplies the framebuffer by a smoothstep falloff
// from screen center.
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.0 },
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
      gl_FragColor = vec4(mix(texel.rgb, texel.rgb * vig, darkness), texel.a);
    }
  `,
};

/**
 * Add vignette to an existing composer. Insert before OutputPass for
 * correct color-space handling. opts: { offset=1.0, darkness=0.6 }.
 */
export function applyVignette(composer, opts) {
  const o = opts || {};
  const pass = new ShaderPass(VignetteShader);
  pass.uniforms.offset.value = o.offset != null ? o.offset : 1.0;
  pass.uniforms.darkness.value = o.darkness != null ? o.darkness : 0.6;
  // Splice in before the last pass (which is usually OutputPass).
  const passes = composer.passes;
  if (passes.length > 0) {
    composer.passes = passes.slice(0, -1).concat([pass, passes[passes.length - 1]]);
  } else {
    composer.addPass(pass);
  }
  return pass;
}

// Mount on Sigillerie3D namespace for cross-script-tag access.
if (typeof window !== 'undefined') {
  window.Sigillerie3D = Object.assign(window.Sigillerie3D || {}, {
    effects: {
      applyBloom,
      applyDOF,
      applyACESToneMap,
      applyVignette,
    },
  });
}
