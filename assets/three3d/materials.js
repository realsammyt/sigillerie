/**
 * materials.js · Sigillerie 3D Track A material library
 *
 * Six curated PBR materials, each tuned for the editorial / studio look the
 * aesthetic doc demands. Returns configured MeshPhysicalMaterial instances
 * (and one ShaderMaterial for the plasma surface).
 *
 * --- DEPENDENCY: scene.environment ---
 *
 * Every material here assumes the host scene has a PMREM-processed env map
 * set on `scene.environment`. Without that, glass reads as flat tinted
 * plastic and metal reads as grey rubber (aesthetic.md §3, §10 SaaS blue
 * glass). Stage3D recipes default to PMREM RoomEnvironment, so this is the
 * correct contract.
 *
 * --- USAGE ---
 *
 *   import * as M from './assets/three3d/materials.js';
 *   const THREE = window.Sigillerie3D.THREE;
 *   const glass = M.createGlassClear(THREE, { tint: '#FFE9D2' });
 *   mesh.material = glass;
 *
 *   // Plasma surface needs a per-frame tick:
 *   const plasma = M.createPlasmaGlow(THREE);
 *   mesh.material = plasma;
 *   // in render loop:
 *   plasma.userData.update(clock.getElapsedTime());
 *
 * Babel-transformed sibling scripts read these off the window namespace:
 *
 *   const { createGlassClear, createPlasmaGlow } = window.SigillerieMaterials;
 *
 * --- DESIGN INTENT ---
 *
 * Six materials, each a different tactile register. No SaaS blue glass.
 * Each has a "best paired with" note in its JSDoc. Keep this list short:
 * if a seventh wants to be added, audit whether one of the six already
 * covers that mood.
 */

// caveman: pick THREE off the namespace if available, fall back to caller arg.
// Each function still takes THREE as first arg so the file works in any
// scope where THREE is in lexical reach.

/**
 * Vision Pro window pane. Crystalline clarity, edge highlight from clearcoat,
 * faint iridescence so it catches direction lights as a colored streak.
 * Best paired with: hero product reveal, crystalline UI panels, glass plinths.
 *
 * @param {object} THREE three.js module
 * @param {object} [opts]
 * @param {string} [opts.tint='#FFFFFF'] attenuation tint, very subtle
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createGlassClear(THREE, { tint = '#FFFFFF' } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.04,
    transmission: 0.9,
    thickness: 0.6,
    ior: 1.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    iridescence: 0.3,
    iridescenceIOR: 1.3,
    envMapIntensity: 1.0,
    transparent: true,
    side: THREE.DoubleSide,
  });
  // attenuation makes the glass "drink" tint over thickness. very small so
  // it stays close to neutral but picks up warmth from envMap.
  mat.attenuationColor = new THREE.Color(tint);
  mat.attenuationDistance = 1.5;
  return mat;
}

/**
 * Sunset rim of opal glass. Soft, milky, picks up rim light dramatically
 * via sheen. Reads as expensive frosted display case glass.
 * Best paired with: secondary panels behind a clear-glass hero, soft cards.
 *
 * @param {object} THREE three.js module
 * @param {object} [opts]
 * @param {string} [opts.tint='#9AB5E8'] sheen + attenuation color
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createGlassFrosted(THREE, { tint = '#9AB5E8' } = {}) {
  const tintCol = new THREE.Color(tint);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.4,
    transmission: 0.55,
    thickness: 0.8,
    ior: 1.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    sheen: 0.8,
    sheenRoughness: 0.5,
    envMapIntensity: 1.0,
    transparent: true,
    side: THREE.DoubleSide,
  });
  mat.sheenColor = tintCol.clone();
  mat.attenuationColor = tintCol.clone();
  mat.attenuationDistance = 1.0;
  // tiny self-glow so the frost reads even in shadow side
  mat.emissive = tintCol.clone().multiplyScalar(0.04);
  return mat;
}

/**
 * Apple keynote dark mirror. Black-glass-and-mirror lacquer. Deep ink color
 * with high envmap reflectivity and a hint of clearcoat float.
 * Best paired with: floor planes, plinth bases, dark-mode hero stages.
 *
 * @param {object} THREE three.js module
 * @param {object} [opts]
 * @param {string} [opts.base='#0A0E14'] body color
 * @param {string} [opts.tint='#1F2940'] reserved for future variant tinting
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createMirrorDark(THREE, { base = '#0A0E14', tint = '#1F2940' } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(base),
    metalness: 1.0,
    roughness: 0.15,
    clearcoat: 0.3,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.5,
  });
  // tint stashed on userData so callers can rebuild a variant if they want
  // a colored deep mirror without re-reading the source.
  mat.userData.tint = new THREE.Color(tint);
  return mat;
}

/**
 * Magazine-editorial paper. Matte body with a warm sheen highlight and a
 * whisper of transmission for subsurface warmth on thin planes.
 * Best paired with: cards, manifesto pages, layered editorial layouts.
 *
 * @param {object} THREE three.js module
 * @param {object} [opts]
 * @param {string} [opts.color='#F4EBD0'] paper body color
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createPaperWarm(THREE, { color = '#F4EBD0' } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.0,
    roughness: 0.95,
    sheen: 0.4,
    sheenRoughness: 0.7,
    // tiny transmission so a thin plane glows on its lit edge
    transmission: 0.05,
    thickness: 0.1,
    ior: 1.3,
    side: THREE.DoubleSide,
  });
  mat.sheenColor = new THREE.Color('#FFD9A3');
  return mat;
}

/**
 * Studio ceramic vase finish. High-roughness body under a full clearcoat,
 * so light puddles into broad gentle highlights instead of sharp specular.
 * Best paired with: rounded sculptural objects, hero product on a plinth.
 *
 * @param {object} THREE three.js module
 * @param {object} [opts]
 * @param {string} [opts.color='#E8E4DD'] clay tone
 * @returns {THREE.MeshPhysicalMaterial}
 */
export function createCeramicMatte(THREE, { color = '#E8E4DD' } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.0,
    roughness: 0.65,
    clearcoat: 1.0,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.8,
  });
  return mat;
}

// caveman: simplex 3D noise, MIT licensed Ashima/Stefan Gustavson port. ~30
// lines of GLSL inline so plasma material has zero external shader deps.
const SIMPLEX_3D_GLSL = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

/**
 * Aurora / nebula / plasma surface. Self-emissive shader that lerps two
 * colors via simplex noise across position and time. Caller drives uTime
 * each frame (Stage3D recipe pattern: clock.getElapsedTime()).
 * Best paired with: rim accent objects, sky panels behind a hero, audio-
 * reactive surfaces. Never as the hero body itself (aesthetic §3 emissive).
 *
 * @param {object} THREE three.js module
 * @param {object} [opts]
 * @param {string} [opts.tint='#FF6B9D'] primary plasma color (warm)
 * @param {string} [opts.secondary='#4D7FFF'] secondary plasma color (cool)
 * @returns {THREE.ShaderMaterial} with userData.update(t) hook
 */
export function createPlasmaGlow(THREE, { tint = '#FF6B9D', secondary = '#4D7FFF' } = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uTint: { value: new THREE.Color(tint) },
    uSecondary: { value: new THREE.Color(secondary) },
    uIntensity: { value: 1.0 },
  };

  const vertexShader = /* glsl */ `
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uTint;
    uniform vec3 uSecondary;
    uniform float uIntensity;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    ${SIMPLEX_3D_GLSL}

    void main() {
      // two-octave plasma: slow base flow + faster fine detail
      float t = uTime * 0.18;
      vec3 p = vWorldPos * 0.7;
      float n1 = snoise(vec3(p.x, p.y + t, p.z - t * 0.5));
      float n2 = snoise(vec3(p.xy * 2.3 + t * 0.6, p.z * 2.3 - t));
      float n = 0.5 + 0.5 * (n1 * 0.65 + n2 * 0.35);

      // shape into bands so you get aurora ribbons not blobby paint
      n = smoothstep(0.25, 0.85, n);

      // color lerp between cool and warm pole
      vec3 col = mix(uSecondary, uTint, n);

      // fresnel rim brightening so silhouette glows extra
      vec3 V = normalize(cameraPosition - vWorldPos);
      float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 2.0);
      col += uTint * fres * 0.6;

      // overall brightness scale, gives bloom something to grab
      col *= uIntensity * 1.2;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: false,
    side: THREE.FrontSide,
    toneMapped: true,
  });

  // caveman: caller drives time. Stage3D recipe just calls this each frame
  // and never has to know about the uniform name.
  mat.userData.update = (t) => {
    uniforms.uTime.value = t;
  };
  mat.userData.uniforms = uniforms;

  return mat;
}

// caveman: window namespace mount so Babel-transformed sibling scripts
// (text/babel) can read these without a separate import. Module scripts
// can still import the named exports above directly.
if (typeof window !== 'undefined') {
  window.SigillerieMaterials = {
    createGlassClear,
    createGlassFrosted,
    createMirrorDark,
    createPaperWarm,
    createCeramicMatte,
    createPlasmaGlow,
  };
}

export default {
  createGlassClear,
  createGlassFrosted,
  createMirrorDark,
  createPaperWarm,
  createCeramicMatte,
  createPlasmaGlow,
};
