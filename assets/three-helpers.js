/**
 * three-helpers.js · Sigillerie 3D Track A helper module
 *
 * Curated re-exports + small utilities for vanilla three.js recipes. Loads
 * via importmap from jsDelivr CDN (see three3d-loader.js for the map).
 *
 * Exports:
 *   - createOrbitControls(camera, dom)
 *   - loadGLTF(url)
 *   - loadHDRI(url, renderer)
 *   - createGroundShadow(scene, opts)
 *   - disposeMesh(mesh)
 *   - randomFloats(count, min, max)
 *   - easeOutExpo(t), easeInOutCubic(t), easeOutBack(t), easeOutElastic(t)
 *
 * Asset loaders register into window.__sceneAssets so Stage3D can later
 * gate __sceneReady on all pending loads. For now the registry exists and
 * is wired; a future pass will make Stage3D await it before first paint.
 *
 * Example:
 *
 *   import { loadGLTF, loadHDRI, easeOutExpo } from './three-helpers.js';
 *   const gltf = await loadGLTF('hero.glb');
 *   threeApi.scene.add(gltf.scene);
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Asset registry. Stage3D awaits __sceneAssets.pending in a later pass.
// Each loader pushes a Promise here; Promise.all gates __sceneReady.
const sceneAssets = {
  pending: [],
  loaded: [],
};
if (typeof window !== 'undefined') {
  window.__sceneAssets = sceneAssets;
}

// DRACOLoader for compressed glTF. Decoder ships from the same CDN.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  'https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/libs/draco/'
);
dracoLoader.setDecoderConfig({ type: 'js' });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const rgbeLoader = new RGBELoader();

/**
 * Build OrbitControls and bind to a DOM element. Disabled in recording mode
 * because the recorder needs camera state to come from __renderFrame, not
 * mouse drag.
 */
export function createOrbitControls(camera, dom) {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  if (typeof window !== 'undefined' && window.__recording === true) {
    controls.enabled = false;
  }
  return controls;
}

/**
 * Load a GLB/GLTF and resolve with the parsed result. Registers the load
 * promise on window.__sceneAssets so Stage3D can gate __sceneReady on it.
 */
export function loadGLTF(url) {
  const promise = new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        sceneAssets.loaded.push({ kind: 'gltf', url });
        resolve(gltf);
      },
      undefined,
      (err) => reject(err)
    );
  });
  sceneAssets.pending.push(promise);
  return promise;
}

/**
 * Load an HDR image, generate a PMREM environment, and return the env
 * texture ready for scene.environment / scene.background.
 */
export function loadHDRI(url, renderer) {
  const promise = new Promise((resolve, reject) => {
    rgbeLoader.load(
      url,
      (hdrTex) => {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromEquirectangular(hdrTex).texture;
        hdrTex.dispose();
        pmrem.dispose();
        sceneAssets.loaded.push({ kind: 'hdri', url });
        resolve(envMap);
      },
      undefined,
      (err) => reject(err)
    );
  });
  sceneAssets.pending.push(promise);
  return promise;
}

/**
 * Soft contact shadow plane. Cheap fake; uses a radial gradient texture on
 * a flat plane facing up. Good enough for hero shots and turntables.
 */
export function createGroundShadow(scene, opts) {
  const o = opts || {};
  const size = o.size != null ? o.size : 4;
  const opacity = o.opacity != null ? o.opacity : 0.4;
  const color = o.color != null ? o.color : 0x000000;
  const y = o.y != null ? o.y : 0;

  // Procedural radial-fade texture, drawn in a 256x256 canvas.
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const geom = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    color: color,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  scene.add(mesh);
  return mesh;
}

/**
 * Walk a mesh / group and dispose every geometry, material, and texture.
 * Safe on null. Removes from parent if attached.
 */
export function disposeMesh(mesh) {
  if (!mesh) return;
  mesh.traverse((obj) => {
    if (obj.geometry && typeof obj.geometry.dispose === 'function') {
      obj.geometry.dispose();
    }
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
  if (mesh.parent) mesh.parent.remove(mesh);
}

/**
 * Generate `count` floats in [min, max). Useful for instanced layouts and
 * randomized particle starts. Deterministic when a seed is provided.
 */
export function randomFloats(count, min, max, seed) {
  const out = new Float32Array(count);
  const range = max - min;
  if (seed == null) {
    for (let i = 0; i < count; i++) out[i] = min + Math.random() * range;
    return out;
  }
  // Mulberry32, small + decent + deterministic. Recipes that record need
  // identical seeds across runs to get identical layouts.
  let s = seed | 0;
  for (let i = 0; i < count; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    out[i] = min + r * range;
  }
  return out;
}

// ---- Easings ----------------------------------------------------------
// Mirror the 2D engine's curve catalogue. Recipes that flow between 2D and
// 3D Sprites stay smooth across the boundary by sharing the same maths.

/** t in [0,1] -> ease-out exponential. Fast start, soft brake. */
export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** t in [0,1] -> ease-in-out cubic. Symmetric S-curve. */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** t in [0,1] -> ease-out back. Slight overshoot before settling. */
export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** t in [0,1] -> ease-out elastic. Decaying overshoot oscillation. */
export function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/** Linear remap with clamp. Mirrors 2D animations.jsx interpolate(). */
export function interpolate(t, inputRange, outputRange, easing) {
  const inStart = inputRange[0];
  const inEnd = inputRange[1];
  const outStart = outputRange[0];
  const outEnd = outputRange[1];
  if (t <= inStart) return outStart;
  if (t >= inEnd) return outEnd;
  const span = inEnd - inStart;
  let p = span === 0 ? 1 : (t - inStart) / span;
  if (typeof easing === 'function') p = easing(p);
  return outStart + (outEnd - outStart) * p;
}

// Mount on the Sigillerie3D namespace for cross-script-tag access. Recipes
// in <script type="text/babel"> can read window.Sigillerie3D.helpers.loadGLTF.
if (typeof window !== 'undefined') {
  window.Sigillerie3D = Object.assign(window.Sigillerie3D || {}, {
    helpers: {
      createOrbitControls,
      loadGLTF,
      loadHDRI,
      createGroundShadow,
      disposeMesh,
      randomFloats,
      easeOutExpo,
      easeInOutCubic,
      easeOutBack,
      easeOutElastic,
      interpolate,
    },
  });
}
