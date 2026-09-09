import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── Shadow GLB loader ─────────────────────────────────────────────────────────
function hl(): THREE.Group {
  const g = new THREE.Group();
  const loader = new GLTFLoader();
  loader.load(
    '/sombra/SOMBRA-MODEL.glb',
    (gltf) => {
      const object = gltf.scene;
      object.scale.set(1.0, 1.0, 1.0);
      object.rotation.x = Math.PI / 2;

      // Cache all material refs once at load time — avoids traverse() every frame
      const cachedMats: THREE.MeshStandardMaterial[] = [];
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.geometry) child.geometry.computeVertexNormals();
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
              mat.flatShading = false;
              mat.needsUpdate = true;
              cachedMats.push(mat as THREE.MeshStandardMaterial);
            });
          }
        }
      });
      g.userData.cachedMats = cachedMats;

      g.add(object);
      g.userData.isGLB = true;

      object.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      g.userData.feetOffset = size.z * 0.50;
    }
  );
  return g;
}

// ── Door mesh ─────────────────────────────────────────────────────────────────
function vl(eVal: number, t: number, _doorColor: number): THREE.Group {
  const rVal = new THREE.Group();
  const i = new THREE.Mesh(
    new THREE.BoxGeometry(eVal / 48 + .2, t / 48 + .2, .3),
    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: .5, roughness: .7 })
  );
  i.castShadow = true;
  rVal.add(i);
  const a = new THREE.Mesh(
    new THREE.BoxGeometry(eVal / 48, t / 48, .1),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa, emissive: 0x888888, emissiveIntensity: .3, metalness: .4, roughness: .5, transparent: true, opacity: .85 })
  );
  a.position.z = .1;
  rVal.add(a);
  const oVal = new THREE.Mesh(
    new THREE.RingGeometry(.3, .5, 32),
    new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: .5, side: 2 })
  );
  oVal.position.z = .15;
  rVal.add(oVal);
  const s = new THREE.Mesh(
    new THREE.SphereGeometry(.8, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .12, side: 1 })
  );
  rVal.add(s);
  return rVal;
}

// ── Surreal luminous diamond (Elpis) ──────────────────────────────────────────
// Performance rules:
//   • NO PointLight — dynamic lights are O(meshes) per light per frame in WebGL
//   • All child/material refs stored in userData at creation time
//   • updateReminiscences contains ZERO traverse() calls
function yl(): THREE.Group {
  const g = new THREE.Group();

  // Core: sharp elongated diamond
  const coreGeo = new THREE.OctahedronGeometry(0.10, 0);
  coreGeo.scale(1.0, 2.2, 1.0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.8,
    metalness: 0.0,
    roughness: 0.0,
    transparent: true,
    opacity: 0.95,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  g.add(core);

  // Shell: thin wireframe
  const shellGeo = new THREE.OctahedronGeometry(0.16, 0);
  shellGeo.scale(1.0, 2.0, 1.0);
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0xddddff,
    transparent: true,
    opacity: 0.18,
    wireframe: true,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  g.add(shell);

  // Halo 1: flat orbiting ring
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.30 });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 6, 32), haloMat);
  halo.rotation.x = Math.PI / 2;
  g.add(halo);

  // Halo 2: tilted ring
  const halo2Mat = new THREE.MeshBasicMaterial({ color: 0xaaaaff, transparent: true, opacity: 0.20 });
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.008, 6, 32), halo2Mat);
  halo2.rotation.x = Math.PI / 4;
  halo2.rotation.z = Math.PI / 6;
  g.add(halo2);

  // Store direct refs — updateReminiscences uses these, never traverse()
  g.userData.halo  = halo;
  g.userData.halo2 = halo2;
  g.userData.allMats          = [coreMat, shellMat, haloMat, halo2Mat];
  g.userData.allBaseOpacities = [0.95,    0.18,     0.30,   0.20];

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────

export class EntityRenderer {
  scene: THREE.Scene;
  clock: THREE.Clock;

  shadowMesh: THREE.Group | null = null;
  doorMesh:   THREE.Group | null = null;
  reminiscenceMeshes: THREE.Group[] = [];

  doorColor = 0x666666;

  constructor(scene: THREE.Scene, clock: THREE.Clock) {
    this.scene = scene;
    this.clock = clock;
  }

  // ── Shadow ──────────────────────────────────────────────────────────────────

  createShadow(eVal: number, t: number) {
    if (this.shadowMesh) this.scene.remove(this.shadowMesh);
    const n = hl();
    this.shadowMesh = n;
    this.shadowMesh.position.set(eVal / 48 - 10, 5 - t / 48, 0);
    this.scene.add(this.shadowMesh);
  }

  updateShadow(eVal: number, t: number, isStunned = false, facingAngle = 0) {
    if (!this.shadowMesh) return;

    const feetOffset = (this.shadowMesh.userData.feetOffset as number) ?? 0;
    this.shadowMesh.position.set(eVal / 48 - 10, 5 - t / 48, feetOffset);
    this.shadowMesh.rotation.z = -facingAngle + Math.PI / 2;

    // Hot path — use cached material refs, NO traverse()
    const cachedMats = this.shadowMesh.userData.cachedMats as THREE.MeshStandardMaterial[] | undefined;
    if (!cachedMats || cachedMats.length === 0) return; // GLB still loading

    if (isStunned) {
      const flash = Math.sin(this.clock.getElapsedTime() * 25) > 0;
      for (const mat of cachedMats) {
        if (!mat.emissive) continue;
        if (mat.userData.origEmissive === undefined) {
          mat.userData.origEmissive = mat.emissive.getHex();
          mat.userData.origEmissiveIntensity = mat.emissiveIntensity || 0;
        }
        mat.emissive.setHex(flash ? 0xff3333 : 0xffffff);
        mat.emissiveIntensity = 1.0;
      }
    } else {
      for (const mat of cachedMats) {
        if (mat.userData.origEmissive !== undefined) {
          if (mat.emissive) mat.emissive.setHex(mat.userData.origEmissive);
          mat.emissiveIntensity = mat.userData.origEmissiveIntensity;
          delete mat.userData.origEmissive;
        }
      }
    }
  }

  // ── Door ────────────────────────────────────────────────────────────────────

  createDoor(eVal: number, t: number, n: number, rVal: number) {
    const i = vl(n, rVal, this.doorColor);
    this.doorMesh = i;
    this.doorMesh.position.set((eVal + n / 2) / 48 - 10, 5 - (t + rVal / 2) / 48, 0);
    this.scene.add(this.doorMesh);
  }

  // ── Elpis (Reminiscences) ───────────────────────────────────────────────────

  createReminiscence(eVal: number, t: number) {
    const n = yl();
    n.userData.floatOffset = Math.random() * Math.PI * 2;
    n.userData.tiltX = (Math.random() - 0.5) * 0.6;
    n.userData.tiltZ = (Math.random() - 0.5) * 0.6;
    n.position.set((eVal + 7.5) / 48 - 10, 5 - (t + 7.5) / 48, 0.55);
    this.scene.add(n);
    this.reminiscenceMeshes.push(n);
    return n;
  }

  updateReminiscences(eVal: any[], t: number) {
    for (let nVal = 0; nVal < eVal.length; nVal++) {
      const item = eVal[nVal];
      const rVal = this.reminiscenceMeshes[nVal];
      if (!rVal) continue;

      if (item.collected) {
        rVal.visible = false;
        continue;
      }
      rVal.visible = true;

      // Read cached data — zero object allocation, zero traverse
      const floatOffset   = (rVal.userData.floatOffset as number) || 0;
      const tiltX         = (rVal.userData.tiltX       as number) || 0;
      const tiltZ         = (rVal.userData.tiltZ       as number) || 0;
      const halo          = rVal.userData.halo  as THREE.Mesh | undefined;
      const halo2         = rVal.userData.halo2 as THREE.Mesh | undefined;
      const allMats       = rVal.userData.allMats          as (THREE.MeshBasicMaterial | THREE.MeshStandardMaterial)[];
      const baseOpacities = rVal.userData.allBaseOpacities as number[];

      const pick = item.pickupProgress;
      const isAbsorbing = pick !== undefined && pick < 1;

      if (isAbsorbing) {
        const fade = 1 - pick * 0.9;
        rVal.scale.setScalar(fade);
        rVal.position.set((item.x + 7.5) / 48 - 10, 5 - (item.y + 7.5) / 48, 0.55);
        rVal.rotation.y = t * 8;
        rVal.rotation.x = t * 6;
        for (let i = 0; i < allMats.length; i++) {
          allMats[i].transparent = true;
          allMats[i].opacity = baseOpacities[i] * fade;
        }
        continue;
      }

      // ── Idle animation (zero traverse calls) ─────────────────────────────
      rVal.scale.set(1, 1, 1);
      const hoverZ = 0.55 + Math.sin(t * 1.8 + floatOffset) * 0.08;
      rVal.position.set((item.x + 7.5) / 48 - 10, 5 - (item.y + 7.5) / 48, hoverZ);

      rVal.rotation.y = t * 0.9 + floatOffset;
      rVal.rotation.x = tiltX + Math.sin(t * 0.7 + floatOffset) * 0.12;
      rVal.rotation.z = tiltZ + Math.cos(t * 0.5 + floatOffset) * 0.08;

      if (halo)  halo.rotation.z  =  t * 1.4 + floatOffset;
      if (halo2) halo2.rotation.y = -t * 1.1 + floatOffset;

      for (let i = 0; i < allMats.length; i++) {
        allMats[i].transparent = baseOpacities[i] < 1;
        allMats[i].opacity = baseOpacities[i];
      }
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  clearEntities() {
    for (const m of this.reminiscenceMeshes) this.scene.remove(m);
    this.reminiscenceMeshes = [];
    if (this.doorMesh)   { this.scene.remove(this.doorMesh);   this.doorMesh   = null; }
    if (this.shadowMesh) { this.scene.remove(this.shadowMesh); this.shadowMesh = null; }
  }
}
