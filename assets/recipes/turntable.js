// turntable.js, Sigillerie 3D Track A recipe
// Rotating-product hero scene. Drop into a <Sprite3D> callback.
//
// Usage:
//   import { createTurntable } from './recipes/turntable.js';
//   const t = createTurntable(threeApi, { modelUrl, rotationSpeed, ... });
//   t.update(time, sprite_t);   // per frame
//   t.dispose();                // on sprite end
//
// Self-contained. Uses three-helpers.js for loadGLTF / loadHDRI / createGroundShadow.

const HELPERS = (typeof window !== 'undefined' && window.Sigillerie3D && window.Sigillerie3D.helpers) || {};

export function createTurntable(threeApi, opts = {}) {
  const THREE = threeApi.THREE;
  const scene = threeApi.scene;
  const camera = threeApi.camera;
  const renderer = threeApi.renderer;

  const cfg = {
    modelUrl: opts.modelUrl || null,
    rotationSpeed: opts.rotationSpeed != null ? opts.rotationSpeed : 0.4,
    envIntensity: opts.envIntensity != null ? opts.envIntensity : 1.0,
    groundShadow: opts.groundShadow !== false,
    highlightSweep: opts.highlightSweep !== false,
    hdriUrl: opts.hdriUrl || 'assets/hdri/studio-soft.hdr',
  };

  // camera setup, 30 deg fov, slight tilt, look at origin
  camera.fov = 30;
  camera.position.set(0, 0.6, 4.2);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  // group holds the product so we rotate cleanly without touching the mesh's local transforms
  const productGroup = new THREE.Group();
  productGroup.name = 'turntable-product';
  scene.add(productGroup);

  // disposable registry, anything we created, we kill
  const disposables = [];
  const sceneAdds = [productGroup];
  let productMesh = null;
  let pmrem = null;

  // --- environment (IBL) -----------------------------------------------------
  // Try HDRI from disk. Fall back to procedural RoomEnvironment.
  function setupEnv() {
    const loadHDRI = HELPERS.loadHDRI;
    const finalize = (envTex) => {
      scene.environment = envTex;
      if ('environmentIntensity' in scene) {
        scene.environmentIntensity = cfg.envIntensity;
      }
    };

    if (loadHDRI && cfg.hdriUrl) {
      Promise.resolve(loadHDRI(cfg.hdriUrl, renderer))
        .then((tex) => {
          if (tex) finalize(tex);
          else fallbackRoomEnv();
        })
        .catch(() => fallbackRoomEnv());
    } else {
      fallbackRoomEnv();
    }
  }

  function fallbackRoomEnv() {
    // RoomEnvironment is in three/examples, assume the loader exposed it
    const RoomEnvironment = (window.Sigillerie3D && window.Sigillerie3D.RoomEnvironment) || THREE.RoomEnvironment;
    if (!RoomEnvironment) return;
    pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const room = new RoomEnvironment();
    const envTex = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envTex;
    if ('environmentIntensity' in scene) {
      scene.environmentIntensity = cfg.envIntensity;
    }
  }

  setupEnv();

  // --- product mesh ----------------------------------------------------------
  function makeFallback() {
    // slate body, copper accents, torus knot proxy
    const geo = new THREE.TorusKnotGeometry(0.55, 0.18, 220, 32);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x6b7280,        // slate
      metalness: 0.85,
      roughness: 0.28,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      sheen: 0.2,
      sheenColor: new THREE.Color(0xb87333), // copper sheen
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  }

  function fitAndCenter(obj) {
    // normalize to ~1.2 unit max dim and center on origin
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const target = 1.2;
    const s = target / maxDim;
    obj.scale.multiplyScalar(s);
    obj.position.sub(center.multiplyScalar(s));
  }

  if (cfg.modelUrl && HELPERS.loadGLTF) {
    Promise.resolve(HELPERS.loadGLTF(cfg.modelUrl))
      .then((gltf) => {
        const root = gltf.scene || gltf;
        root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        fitAndCenter(root);
        productGroup.add(root);
        productMesh = root;
      })
      .catch(() => {
        productMesh = makeFallback();
        productGroup.add(productMesh);
      });
  } else {
    productMesh = makeFallback();
    productGroup.add(productMesh);
  }

  // --- key + ambient fill ----------------------------------------------------
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(2.5, 3.0, 2.0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);
  sceneAdds.push(keyLight);

  const fill = new THREE.HemisphereLight(0xbfd4ff, 0x222227, 0.35);
  scene.add(fill);
  sceneAdds.push(fill);

  // --- moving rim-light (hero sweep) -----------------------------------------
  let rimLight = null;
  if (cfg.highlightSweep) {
    rimLight = new THREE.DirectionalLight(0xfff2dc, 0.0);
    rimLight.position.set(0, 1.2, -3.0); // initial behind subject
    scene.add(rimLight);
    sceneAdds.push(rimLight);
  }

  // --- ground shadow ---------------------------------------------------------
  let ground = null;
  if (cfg.groundShadow && HELPERS.createGroundShadow) {
    ground = HELPERS.createGroundShadow({
      size: 3.2,
      opacity: 0.55,
      blur: 2.8,
      y: -0.62,
    });
    if (ground) {
      scene.add(ground);
      sceneAdds.push(ground);
    }
  } else if (cfg.groundShadow) {
    // minimal fallback, soft circular shadow disc
    const tex = makeRadialShadowTexture(THREE);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    ground = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.62;
    scene.add(ground);
    sceneAdds.push(ground);
    disposables.push(tex, mat, ground.geometry);
  }

  function makeRadialShadowTexture(THREE) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,0.95)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
    return tex;
  }

  // --- per-frame update ------------------------------------------------------
  // t = absolute seconds from sprite start, sprite_t = 0..1 normalized
  function update(t, sprite_t) {
    const time = t || 0;
    productGroup.rotation.y = time * cfg.rotationSpeed;

    if (rimLight) {
      // sweep around the model. brightest when light vector aligns with camera
      const sweep = time * cfg.rotationSpeed * 0.6 + Math.PI; // start opposite key
      const radius = 3.2;
      rimLight.position.set(
        Math.sin(sweep) * radius,
        1.4 + Math.sin(time * 0.4) * 0.15,
        Math.cos(sweep) * radius
      );
      // intensity peaks when rim is roughly camera-facing
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir).negate(); // points from origin toward cam
      const lightDir = rimLight.position.clone().normalize();
      const align = Math.max(0, lightDir.dot(camDir));
      rimLight.intensity = 0.4 + Math.pow(align, 2.5) * 2.6;
    }
  }

  // --- dispose ---------------------------------------------------------------
  function dispose() {
    for (const obj of sceneAdds) {
      if (obj && obj.parent) obj.parent.remove(obj);
    }
    if (productMesh) {
      productMesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            for (const k in m) {
              const v = m[k];
              if (v && v.isTexture) v.dispose();
            }
            m.dispose();
          }
        }
      });
    }
    for (const d of disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    if (pmrem) pmrem.dispose();
    if (scene.environment && scene.environment.dispose) {
      // do not dispose if a sibling sprite still uses it, caller owns scene-level env
    }
  }

  return {
    update,
    dispose,
    get product() { return productMesh; },
    get group() { return productGroup; },
  };
}

// expose on window for cross-script-tag access (Track A inline pages)
if (typeof window !== 'undefined') {
  Object.assign(window, { createTurntable });
}
