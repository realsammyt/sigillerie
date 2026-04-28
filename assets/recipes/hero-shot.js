/**
 * hero-shot.js, Sigillerie 3D Track A recipe.
 *
 * Apple-gallery-style hero shot in real 3D. The 3D-real version of
 * modes/producer/apple-gallery-showcase.md (the CSS-perspective trick).
 *
 * 3 to 7 textured cards float in an asymmetric grid. Camera pans on a slow
 * orbital path. Focus shifts card to card every 2 to 3 sec, focused card
 * grows 1.4x, second-ring satellites drop to 0.4 alpha. Soft shadows on a
 * procedural horizon gradient. One subtle rim light per card.
 *
 * Self-contained. Caveman English. No em-dashes, no banned vocab.
 *
 * Usage:
 *
 *   import { createHeroShot } from './recipes/hero-shot.js';
 *
 *   const cards = [
 *     { id: 'discovery', title: 'Discovery', accent: '#9A4B3D', textureUrl: 'card-1.png' },
 *     { id: 'producer',  title: 'Producer',  accent: '#1B1614', textureUrl: 'card-2.png' },
 *     { id: '3d',        title: '3D',        accent: '#6E6862', textureUrl: 'card-3.png' },
 *   ];
 *   const hero = createHeroShot(threeApi, {
 *     cards,
 *     cameraPan: 'slow-orbital',
 *     focusShift: 'sequential',
 *     cardSize: { w: 1.6, h: 1.0 },
 *     cardSpacing: 2.4,
 *     layout: 'asymmetric',
 *     bg: 'horizon-gradient',
 *   });
 *
 *   // per frame (t in seconds, sprite_t local sprite time):
 *   hero.update(t, sprite_t);
 *
 *   // teardown:
 *   hero.dispose();
 *
 * threeApi shape (per Stage3D / Sprite3D contract, see modes/three3d/page-contract.md):
 *   { THREE, scene, camera, renderer }
 */

const PAN_SPEEDS = {
  'slow-orbital': 12.0,   // sec per revolution
  'medium-orbital': 9.0,
  'static': Infinity,
};

const FOCUS_HOLD = 2.4;   // sec per card
const FOCUS_FADE = 0.6;   // sec to crossfade between focuses
const FOCUS_SCALE = 1.4;
const SATELLITE_ALPHA = 0.4;

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToVec3(THREE, hex) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

/**
 * Build an asymmetric layout. One dominant card center-front, satellites
 * staggered around it. Same vibe as the CSS gallery, but in real 3D.
 *
 * Returns array of { x, y, z, tilt: {x, y, z}, ring }.
 *   ring 0 = dominant
 *   ring 1 = primary satellite
 *   ring 2 = far satellite (drops alpha when not focused)
 */
function buildLayout(count, spacing) {
  const slots = [];
  // dominant in middle, slightly forward
  slots.push({
    x: 0, y: 0.05, z: 0.4,
    tilt: { x: -0.18, y: 0.10, z: -0.03 },
    ring: 0,
  });

  // ring 1, four primary satellites (left, right, top-left, bottom-right)
  const ring1 = [
    { x: -spacing * 0.95, y:  0.55, z: -0.2, tilt: { x: -0.14, y:  0.18, z:  0.04 } },
    { x:  spacing * 0.95, y: -0.10, z: -0.1, tilt: { x: -0.16, y: -0.14, z: -0.05 } },
    { x: -spacing * 0.45, y: -0.85, z: -0.3, tilt: { x: -0.10, y:  0.12, z:  0.02 } },
    { x:  spacing * 0.55, y:  0.85, z: -0.4, tilt: { x: -0.20, y: -0.10, z: -0.04 } },
  ];
  for (const s of ring1) slots.push({ ...s, ring: 1 });

  // ring 2, far satellites (only used when count > 5)
  const ring2 = [
    { x: -spacing * 1.7, y: -0.30, z: -0.9, tilt: { x: -0.12, y:  0.22, z:  0.05 } },
    { x:  spacing * 1.6, y:  0.40, z: -1.0, tilt: { x: -0.18, y: -0.20, z: -0.06 } },
  ];
  for (const s of ring2) slots.push({ ...s, ring: 2 });

  return slots.slice(0, Math.max(3, Math.min(7, count)));
}

/**
 * Rounded-rect plane geometry. Plain BoxGeometry would have crisp edges
 * which read SaaS, not gallery. We bevel the corners by clipping a plane
 * with a rounded shape via THREE.Shape + ExtrudeGeometry, very thin depth.
 */
function makeRoundedCardGeometry(THREE, w, h, radius) {
  const r = Math.min(radius, w * 0.5, h * 0.5);
  const shape = new THREE.Shape();
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  shape.moveTo(x0 + r, y0);
  shape.lineTo(x1 - r, y0);
  shape.quadraticCurveTo(x1, y0, x1, y0 + r);
  shape.lineTo(x1, y1 - r);
  shape.quadraticCurveTo(x1, y1, x1 - r, y1);
  shape.lineTo(x0 + r, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - r);
  shape.lineTo(x0, y0 + r);
  shape.quadraticCurveTo(x0, y0, x0 + r, y0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.center();
  // map UVs onto the front face for the texture
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2]     = (pos.getX(i) - x0) / w;
    uv[i * 2 + 1] = (pos.getY(i) - y0) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/**
 * Procedural horizon gradient. Big sphere, vertex-colored top to bottom.
 * Two-tone, warm canvas top / soft horizon line / cooler floor.
 * No HDRI, no plastic.
 */
function buildHorizonBackdrop(THREE, scene) {
  const geo = new THREE.SphereGeometry(60, 32, 24);
  // flip it, we paint the inside
  geo.scale(-1, 1, 1);
  const top    = new THREE.Color('#F5F2EC');
  const horizon = new THREE.Color('#E0DCD2');
  const floor  = new THREE.Color('#B8B0A4');
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const y = geo.attributes.position.getY(i) / 60;
    let c;
    if (y > 0.05) {
      const k = Math.min(1, (y - 0.05) / 0.6);
      c = tmp.copy(horizon).lerp(top, k);
    } else if (y > -0.1) {
      const k = (y + 0.1) / 0.15;
      c = tmp.copy(floor).lerp(horizon, k);
    } else {
      c = tmp.copy(floor);
    }
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'heroShot.backdrop';
  scene.add(mesh);
  return mesh;
}

/**
 * Soft floor for shadow catching. Big plane, MeshStandardMaterial,
 * receives shadows only.
 */
function buildShadowFloor(THREE, scene) {
  const geo = new THREE.PlaneGeometry(40, 40);
  const mat = new THREE.ShadowMaterial({ opacity: 0.18 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.6;
  mesh.receiveShadow = true;
  mesh.name = 'heroShot.floor';
  scene.add(mesh);
  return mesh;
}

export function createHeroShot(threeApi, opts = {}) {
  const { THREE, scene, camera, renderer } = threeApi;
  if (!THREE || !scene || !camera) {
    throw new Error('createHeroShot needs threeApi with THREE, scene, camera');
  }

  const cardsIn = (opts.cards || []).slice(0, 7);
  if (cardsIn.length < 3) {
    throw new Error('createHeroShot needs 3 to 7 cards, got ' + cardsIn.length);
  }
  const cardSize = opts.cardSize || { w: 1.6, h: 1.0 };
  const spacing  = opts.cardSpacing || 2.4;
  const panMode  = opts.cameraPan || 'slow-orbital';
  const focusMode = opts.focusShift || 'sequential';
  const bgMode   = opts.bg || 'horizon-gradient';

  const root = new THREE.Group();
  root.name = 'heroShot.root';
  scene.add(root);

  // backdrop + floor
  const disposables = [];
  let backdrop = null;
  let floor = null;
  if (bgMode === 'horizon-gradient') {
    backdrop = buildHorizonBackdrop(THREE, scene);
    floor    = buildShadowFloor(THREE, scene);
    disposables.push(backdrop, floor);
  }

  // lights, soft key + fill + per-card rim hint via a moving subtle directional
  const ambient = new THREE.AmbientLight(0xfff4e6, 0.55);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(3.2, 4.5, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  key.shadow.camera.left   = -6;
  key.shadow.camera.right  =  6;
  key.shadow.camera.top    =  4;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far  = 18;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfd6e0, 0.30);
  fill.position.set(-3.5, 2.0, -1.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe6cc, 0.45);
  rim.position.set(-1.5, 2.5, -3.5);
  scene.add(rim);

  if (renderer) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // build cards
  const layout = buildLayout(cardsIn.length, spacing);
  const cardObjects = [];
  const loader = new THREE.TextureLoader();
  const geoCache = new THREE.Group();   // not added to scene, just for tracking

  for (let i = 0; i < cardsIn.length; i++) {
    const data = cardsIn[i];
    const slot = layout[i];

    const geo = makeRoundedCardGeometry(THREE, cardSize.w, cardSize.h, 0.08);
    const accent = new THREE.Color(data.accent || '#1B1614');

    let texture = null;
    if (data.textureUrl) {
      try {
        texture = loader.load(data.textureUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
      } catch (e) {
        texture = null;
      }
    }

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      color: texture ? 0xffffff : accent,
      roughness: 0.55,
      metalness: 0.05,
      transparent: true,
      opacity: 1.0,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.position.set(slot.x, slot.y, slot.z);
    mesh.rotation.set(slot.tilt.x, slot.tilt.y, slot.tilt.z);
    mesh.userData = {
      id: data.id,
      title: data.title,
      ring: slot.ring,
      basePos: mesh.position.clone(),
      baseRot: mesh.rotation.clone(),
      baseScale: 1.0,
      targetScale: 1.0,
      currentScale: 1.0,
      targetAlpha: 1.0,
      currentAlpha: 1.0,
    };
    root.add(mesh);
    cardObjects.push(mesh);

    // tiny rim plane behind each card, accent color, flat material
    // gives the warm halo that reads as "lit from behind"
    const rimGeo = new THREE.PlaneGeometry(cardSize.w * 1.08, cardSize.h * 1.08);
    const rimMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.copy(mesh.position).add(new THREE.Vector3(0, 0, -0.04));
    rimMesh.rotation.copy(mesh.rotation);
    rimMesh.userData.parentCard = mesh;
    root.add(rimMesh);
    mesh.userData.rim = rimMesh;
  }

  // camera setup, slow orbital
  const focusPoint = new THREE.Vector3(0, 0, 0);
  const orbitRadius = Math.max(spacing * 1.8, 4.6);
  const orbitHeight = 0.9;
  const panPeriod = PAN_SPEEDS[panMode] != null ? PAN_SPEEDS[panMode] : 12.0;

  // initial camera state, in case host has not placed it yet
  camera.position.set(orbitRadius * 0.6, orbitHeight, orbitRadius);
  camera.lookAt(focusPoint);

  const state = {
    focusedIdx: 0,
    lastFocusSwitchT: 0,
    focusProgress: 1.0,
    prevFocusedIdx: 0,
  };

  function pickFocusIdx(t) {
    if (focusMode === 'static') return 0;
    if (focusMode === 'random') {
      // deterministic-ish pseudo random by time slot
      const slot = Math.floor(t / FOCUS_HOLD);
      return Math.abs((slot * 1103515245 + 12345) % cardObjects.length);
    }
    // sequential default
    return Math.floor(t / FOCUS_HOLD) % cardObjects.length;
  }

  function update(t, _spriteT) {
    const time = (typeof t === 'number' && isFinite(t)) ? t : 0;

    // 1. camera orbit
    if (panPeriod !== Infinity) {
      const angle = (time / panPeriod) * Math.PI * 2;
      // gentle vertical bob too, like a hand-held panavision drift
      const bob = Math.sin(time * 0.18) * 0.12;
      camera.position.x = Math.cos(angle) * orbitRadius;
      camera.position.z = Math.sin(angle) * orbitRadius;
      camera.position.y = orbitHeight + bob;
      camera.lookAt(focusPoint);
    }

    // 2. focus rotation
    const newFocus = pickFocusIdx(time);
    if (newFocus !== state.focusedIdx) {
      state.prevFocusedIdx = state.focusedIdx;
      state.focusedIdx = newFocus;
      state.lastFocusSwitchT = time;
      state.focusProgress = 0;
    }
    const sinceSwitch = time - state.lastFocusSwitchT;
    state.focusProgress = Math.min(1, sinceSwitch / FOCUS_FADE);
    const fp = easeInOutCubic(state.focusProgress);

    // 3. per-card target scale + alpha
    for (let i = 0; i < cardObjects.length; i++) {
      const card = cardObjects[i];
      const ring = card.userData.ring;

      let prevScale = 1.0, prevAlpha = 1.0;
      if (i === state.prevFocusedIdx && state.prevFocusedIdx !== state.focusedIdx) {
        prevScale = FOCUS_SCALE;
      }
      if (ring === 2 && i !== state.prevFocusedIdx) {
        prevAlpha = SATELLITE_ALPHA;
      }

      let targetScale = 1.0, targetAlpha = 1.0;
      if (i === state.focusedIdx) {
        targetScale = FOCUS_SCALE;
        targetAlpha = 1.0;
      } else if (ring === 2) {
        targetAlpha = SATELLITE_ALPHA;
      } else {
        targetScale = 1.0;
        targetAlpha = 0.85;
      }

      card.userData.currentScale = lerp(prevScale, targetScale, fp);
      card.userData.currentAlpha = lerp(prevAlpha, targetAlpha, fp);

      const s = card.userData.currentScale;
      card.scale.set(s, s, s);
      card.material.opacity = card.userData.currentAlpha;

      // breathe rotation, very subtle, gives "alive" feel
      const baseRot = card.userData.baseRot;
      const breathe = Math.sin(time * 0.35 + i * 1.7) * 0.012;
      card.rotation.set(baseRot.x + breathe, baseRot.y + breathe * 0.6, baseRot.z);

      // pull focused card slightly forward, push others slightly back
      const basePos = card.userData.basePos;
      const forward = (i === state.focusedIdx) ? 0.35 * fp : -0.05 * fp;
      card.position.set(basePos.x, basePos.y, basePos.z + forward);

      // rim follows
      if (card.userData.rim) {
        const rimMesh = card.userData.rim;
        rimMesh.scale.set(s, s, 1);
        rimMesh.position.set(basePos.x, basePos.y, basePos.z + forward - 0.04);
        rimMesh.rotation.copy(card.rotation);
        rimMesh.material.opacity = 0.12 * card.userData.currentAlpha *
          (i === state.focusedIdx ? 1.4 : 0.85);
      }
    }
  }

  function dispose() {
    for (const card of cardObjects) {
      root.remove(card);
      if (card.userData.rim) {
        root.remove(card.userData.rim);
        card.userData.rim.geometry.dispose();
        card.userData.rim.material.dispose();
      }
      card.geometry.dispose();
      if (card.material.map) card.material.map.dispose();
      card.material.dispose();
    }
    scene.remove(root);
    if (backdrop) {
      scene.remove(backdrop);
      backdrop.geometry.dispose();
      backdrop.material.dispose();
    }
    if (floor) {
      scene.remove(floor);
      floor.geometry.dispose();
      floor.material.dispose();
    }
    scene.remove(ambient);
    scene.remove(key);
    scene.remove(fill);
    scene.remove(rim);
  }

  return {
    update,
    dispose,
    // escape hatches for advanced callers
    _cards: cardObjects,
    _root: root,
    setFocus(idx) {
      if (idx < 0 || idx >= cardObjects.length) return;
      state.prevFocusedIdx = state.focusedIdx;
      state.focusedIdx = idx;
      state.lastFocusSwitchT = -999;
      state.focusProgress = 1;
    },
  };
}

// classic-script convenience, in case the recipe is loaded outside an
// importmap / module context (e.g., quick prototype HTML pages).
if (typeof window !== 'undefined') {
  Object.assign(window, { createHeroShot });
}
