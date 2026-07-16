/**
 * glass-material.js · Sigillerie 3D Track A recipe
 *
 * Refractive glass / liquid / crystal hero. Two exports:
 *   createGlassMaterial(opts) -> MeshPhysicalMaterial tuned for transmission
 *   createGlassHero(threeApi, opts) -> { group, update, dispose } scene
 *
 * Wire from inside a Sprite3D render callback:
 *   const mat = createGlassMaterial({ tint: '#9A4B3D', thickness: 1.2 });
 *   const hero = createGlassHero(window.Sigillerie3D, {
 *     shape: 'icosahedron', material: mat, envIntensity: 1.5, caustics: true });
 *   scene.add(hero.group);
 *   hero.update(t, sprite_t);
 *   hero.dispose();
 *
 * UX Law: Aesthetic-Usability Effect (§13). Users perceive visually polished
 * interfaces as easier to use and more trustworthy, even before they interact.
 * The caustic ground plane + rim lighting are the polish budget here. They add
 * GPU cost (one full-screen shader pass for caustics, an extra directional
 * light for the rim) but pay back in perceived quality and product trust.
 * Do not skip caustics to save 0.5 ms per frame — the perceptual return
 * outweighs the render cost on any GPU that can handle MeshPhysicalMaterial.
 */

import {
  createComposer,
  addBloom,
  addDOF,
  addVignette,
  addOutputPass,
} from '../tsl-effects.js';

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Real glass IOR sits 1.45 to 1.52. Crystal pushes 1.6+. attenuationColor
// with short attenuationDistance gives sea-glass tint without killing alpha.
//
// GLASS-1 (aesthetic §3): transmission default dropped from 1.0 to 0.4 so
// panels catch direct light visibly. Override to 0.7+ when the scene has a
// high-contrast envMap the user can see refracting through the body.
const DEFAULTS = {
  tint: '#ffffff',
  roughness: 0.05,
  transmission: 0.4,
  thickness: 1.0,
  ior: 1.45,
  attenuationDistance: 0.5,
  clearcoat: 1.0,
  clearcoatRoughness: 0.0,
  reflectivity: 0.5,
  envMapIntensity: 1.5,
  iridescence: 0.0,
  iridescenceIOR: 1.3,
  metalness: 0.0,
  // Body color before transmission. Keep near white so attenuationColor
  // drives the tint. Push it for stained-glass moods.
  color: '#ffffff',
  side: THREE.DoubleSide,
};

function toColor(c) {
  return c instanceof THREE.Color ? c : new THREE.Color(c);
}

export function createGlassMaterial(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const mat = new THREE.MeshPhysicalMaterial({
    color: toColor(o.color),
    roughness: o.roughness,
    metalness: o.metalness,
    transmission: o.transmission,
    thickness: o.thickness,
    ior: o.ior,
    attenuationColor: toColor(o.tint),
    attenuationDistance: o.attenuationDistance,
    clearcoat: o.clearcoat,
    clearcoatRoughness: o.clearcoatRoughness,
    reflectivity: o.reflectivity,
    envMapIntensity: o.envMapIntensity,
    iridescence: o.iridescence,
    iridescenceIOR: o.iridescenceIOR,
    side: o.side,
    transparent: true,
    // depthWrite off so stacked refractive bodies stop punching holes
    // through each other.
    depthWrite: false,
  });
  return mat;
}

// icosahedron reads as crystal, sphere as liquid drop, torus as jewellery.
function buildGeometry(shape) {
  switch (shape) {
    case 'sphere': return new THREE.SphereGeometry(0.9, 96, 96);
    case 'torus':  return new THREE.TorusGeometry(0.7, 0.28, 96, 192);
    case 'box':    return new THREE.BoxGeometry(1.2, 1.2, 1.2, 4, 4, 4);
    case 'icosahedron':
    default:       return new THREE.IcosahedronGeometry(0.95, 2);
  }
}

// Procedural caustic ground. Worley cell noise in a fragment shader. Cheap.
// Looks like sun through a wineglass on a table. Falls back to a soft
// spotlight when shader compile fails.
function buildCausticGround(THREEref) {
  const geo = new THREEref.PlaneGeometry(8, 8, 1, 1);
  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0.7 },
    uTint: { value: new THREEref.Color('#ffd9b8') },
  };
  const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const frag = `precision highp float; varying vec2 vUv;
    uniform float uTime; uniform float uIntensity; uniform vec3 uTint;
    vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));
      return -1.0+2.0*fract(sin(p)*43758.5453123); }
    float worley(vec2 uv){ vec2 i=floor(uv); vec2 f=fract(uv); float d=1.0;
      for(int y=-1;y<=1;y++){ for(int x=-1;x<=1;x++){
        vec2 g=vec2(float(x),float(y));
        vec2 o=0.5+0.5*sin(uTime*0.6+6.2831*hash2(i+g));
        vec2 r=g+o-f; d=min(d,dot(r,r)); } }
      return d; }
    void main(){ vec2 uv=(vUv-0.5)*6.0;
      float w1=worley(uv); float w2=worley(uv*1.7+3.1);
      float caust=pow(1.0-w1,6.0)+0.5*pow(1.0-w2,8.0);
      float radial=smoothstep(1.1,0.0,length(vUv-0.5));
      float a=caust*radial*uIntensity;
      gl_FragColor=vec4(uTint*caust, a); }`;
  const mat = new THREEref.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: vert, fragmentShader: frag,
  });
  const mesh = new THREEref.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.05;
  mesh.renderOrder = -1;
  return { mesh, uniforms, material: mat, geometry: geo };
}

// Spotlight fallback when caustic shader is off or fails to compile.
function buildSpotFallback(THREEref) {
  const spot = new THREEref.SpotLight(0xfff0d8, 6.0, 8, Math.PI / 6, 0.6, 1.2);
  spot.position.set(2.5, 4.0, 2.5);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0008;
  return spot;
}

export function createGlassHero(threeApi, opts = {}) {
  // threeApi is the Sigillerie3D namespace from three3d-loader.js. Pull
  // THREE off it; fall back to the module-level import if missing.
  const T = (threeApi && threeApi.THREE) || THREE;

  const o = {
    shape: 'icosahedron',
    modelUrl: null,
    material: null,
    envIntensity: 1.5,
    caustics: true,
    background: null,
    keyLightIntensity: 1.6,
    fillLightIntensity: 0.5,
    ...opts,
  };

  const group = new T.Group();
  group.name = 'GlassHero';

  // RoomEnvironment is a good IBL default for transmission bodies. Real
  // HDRI is better but adds a fetch; this ships zero-asset. PMREMGenerator
  // needs a renderer, which lives on threeApi at runtime. Pass opts.envMap
  // to override.
  let envTex = null;
  let pmrem = null;
  if (opts.envMap) {
    envTex = opts.envMap;
  } else if (threeApi && threeApi.renderer) {
    pmrem = new T.PMREMGenerator(threeApi.renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }

  // Lighting: key warm, fill cool, rim back.
  const key = new T.DirectionalLight(0xfff0d8, o.keyLightIntensity);
  key.position.set(3, 4, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  group.add(key);

  const fill = new T.DirectionalLight(0xb8d8ff, o.fillLightIntensity);
  fill.position.set(-3, 2, -1);
  group.add(fill);

  const rim = new T.DirectionalLight(0xffffff, 0.8);
  rim.position.set(0, 2, -4);
  group.add(rim);

  // Matte ground disc. Catches the spotlight when caustics are off and
  // sits under the additive caustic plane when caustics are on.
  const ground = new T.Mesh(
    new T.CircleGeometry(3.5, 64),
    new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.05;
  ground.receiveShadow = true;
  group.add(ground);

  // Additive procedural caustic plane over the ground.
  let caust = null;
  let spot = null;
  if (o.caustics) {
    try {
      caust = buildCausticGround(T);
      caust.material.blending = T.AdditiveBlending;
      group.add(caust.mesh);
    } catch (err) {
      console.warn('[glass-material] caustic shader failed, using spot', err);
      spot = buildSpotFallback(T);
      group.add(spot);
      group.add(spot.target);
    }
  } else {
    spot = buildSpotFallback(T);
    group.add(spot);
    group.add(spot.target);
  }

  // Hero body: a primitive or a loaded GLB.
  const material = o.material || createGlassMaterial({ envMapIntensity: o.envIntensity });
  if (envTex) material.envMap = envTex;

  let hero = null;
  let loadedGeometries = [];
  if (o.shape === 'custom-glb' && o.modelUrl) {
    hero = new T.Group();
    const loader = new GLTFLoader();
    // Register the async GLB load in window.__sceneAssets so Stage3D's
    // __sceneReady gate waits for the hero body.
    const assets = (typeof window !== 'undefined')
      ? (window.__sceneAssets = window.__sceneAssets || { pending: [], loaded: [] })
      : null;
    const loadPromise = new Promise((resolve, reject) => {
      loader.load(
        o.modelUrl,
        (gltf) => {
          gltf.scene.traverse((node) => {
            if (node.isMesh) {
              node.material = material;
              node.castShadow = true;
              node.receiveShadow = false;
              loadedGeometries.push(node.geometry);
            }
          });
          // Center + fit to about the unit sphere.
          const box = new T.Box3().setFromObject(gltf.scene);
          const size = new T.Vector3(); box.getSize(size);
          const center = new T.Vector3(); box.getCenter(center);
          const scale = 1.6 / Math.max(size.x, size.y, size.z, 0.001);
          gltf.scene.scale.setScalar(scale);
          gltf.scene.position.sub(center.multiplyScalar(scale));
          hero.add(gltf.scene);
          if (assets) assets.loaded.push({ kind: 'gltf', url: o.modelUrl });
          resolve(gltf);
        },
        undefined,
        (err) => {
          console.warn('[glass-material] GLB load failed', err);
          reject(err);
        }
      );
    });
    if (assets) {
      assets.pending.push(loadPromise);
      // gate uses allSettled; avoid unhandledrejection noise when no gate
      // is listening.
      loadPromise.catch(() => {});
    }
  } else {
    const geom = buildGeometry(o.shape);
    loadedGeometries.push(geom);
    hero = new T.Mesh(geom, material);
    hero.castShadow = true;
  }
  group.add(hero);

  // Stash an optional background hint for the host scene to read.
  if (o.background) group.userData.background = o.background;

  // GLASS-3 (aesthetic §4): bloom + DOF + vignette. DOF slots between bloom
  // and vignette so it can blur context while bloom stays on the hero body.
  // Uses tsl-effects directly, NOT recipe-baseline, so the pass order is
  // controlled (render -> bloom -> dof -> vignette -> output).
  let glassPost = null;
  if (threeApi && threeApi.renderer && threeApi.scene && threeApi.camera) {
    try {
      const composer = createComposer(threeApi.renderer, threeApi.scene, threeApi.camera);
      addBloom(composer, { strength: 0.8, radius: 0.8, threshold: 0.85 });
      addDOF(composer, { focus: 4.5, aperture: 0.04 / 1000, maxblur: 0.012 });
      addVignette(composer, { offset: 0.95, darkness: 1.4 });
      addOutputPass(composer);
      if (threeApi.draw !== undefined) {
        threeApi.draw = () => composer.render();
      }
      glassPost = {
        composer,
        dispose() {
          if (composer && composer.passes) {
            composer.passes.forEach((p) => {
              if (p && typeof p.dispose === 'function') p.dispose();
            });
          }
        },
      };
    } catch (err) {
      console.warn('[glass-material] postprocessing setup failed', err);
    }
  }

  // Tick. t is wall time in seconds, sprite_t is local 0..1 progress.
  // Spin slow, breathe slower.
  function update(t = 0, sprite_t = 0) {
    if (hero) {
      hero.rotation.y = t * 0.35 + sprite_t * 0.6;
      hero.rotation.x = Math.sin(t * 0.25) * 0.08;
      const breathe = 1.0 + Math.sin(t * 0.7) * 0.02;
      hero.scale.setScalar(breathe);
    }
    if (caust) {
      caust.uniforms.uTime.value = t;
    }
  }

  // Teardown. Recipes that re-spawn heroes per scene need this or the GPU
  // leaks buffers.
  function dispose() {
    group.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => m && m.dispose && m.dispose());
      }
    });
    loadedGeometries.forEach((g) => g && g.dispose && g.dispose());
    if (caust) {
      caust.geometry.dispose();
      caust.material.dispose();
    }
    if (pmrem) pmrem.dispose();
    if (envTex && !opts.envMap) envTex.dispose && envTex.dispose();
    if (glassPost) glassPost.dispose();
  }

  return {
    group,
    hero,
    material,
    lights: { key, fill, rim, spot },
    caust,
    update,
    dispose,
  };
}

// Window-stamp for inline Babel scripts that prefer globals.
if (typeof window !== 'undefined') {
  Object.assign(window, { createGlassMaterial, createGlassHero });
}

export default { createGlassMaterial, createGlassHero };
