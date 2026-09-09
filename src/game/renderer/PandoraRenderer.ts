import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function ml(_color: number): THREE.Group {
  const g = new THREE.Group();

  const loader = new GLTFLoader();
  loader.load(
    '/pandora/PANDORA-MODEL.glb',
    (gltf) => {
      const object = gltf.scene;
      
      // Escala restaurada para 1.0
      object.scale.set(1.0, 1.0, 1.0);
      
      // Rotacionando para alinhar (Z-Up)
      object.rotation.x = Math.PI / 2;
      
      // Habilitar sombras
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.geometry) {
            child.geometry.computeVertexNormals();
          }
          // NÃO aplicar filtro de ambiente — Pandora mantém suas cores originais
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
              mat.flatShading = false;
              mat.needsUpdate = true;
            });
          }
        }
      });
      
      g.add(object);
      g.userData.isGLB = true;
      
      // Força atualização de matrizes antes do Box3
      object.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      // O Box3 nativo em SkinnedMeshes costuma ser impreciso, fazendo afundar ou flutuar.
      g.userData.feetOffset = size.z * 0.50;
      console.log('[Pandora] Box3 size:', size, '| feetOffset:', g.userData.feetOffset);
    },
    (xhr) => {
      console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    (error) => {
      console.error('Erro ao carregar o GLB:', error);
    }
  );

  return g;
}

export class PandoraRenderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  
  playerMesh: THREE.Group | null = null;
  playerColor = 0x888888;
  walkPhase = 0;
  playerAngle = 0;
  targetCamX = 0;
  targetCamY = 0;

  cameraOrbitYaw = 0;
  cameraOrbitPitch = 0.55;
  cameraDistance = 2.8;

  currentCamPos?: THREE.Vector3;
  currentCamLookAt?: THREE.Vector3;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  createPlayer(eVal: number, t: number, onLoad?: () => void) {
    if (this.playerMesh) {
      this.scene.remove(this.playerMesh);
    }
    const n = ml(this.playerColor);
    this.playerMesh = n;
    this.playerMesh.position.set(eVal / 48 - 10, 5 - t / 48, 0.55);
    this.walkPhase = 0;
    this.scene.add(this.playerMesh);
    
    if (onLoad) {
      onLoad();
    }
  }

  updatePlayer(eVal: number, t: number, n: number, jumpHeight = 0, moveSpeed = 0, clockElapsed: number, groundZ: number) {
    const rVal = eVal / 48 - 10,
        i = 5 - t / 48;
    this.playerAngle = n;
    this.targetCamX = rVal;
    this.targetCamY = i;
    
    if (this.playerMesh) {
      const zLift = jumpHeight * 0.08;
      const bob = this.animatePlayer(moveSpeed, jumpHeight, clockElapsed);
      const scaleFactor = 1 + jumpHeight * 0.03;
      
      const feetOffset = (this.playerMesh.userData.feetOffset as number) ?? 0;
      const finalZ = groundZ + feetOffset + zLift + bob;
      
      this.playerMesh.position.set(rVal, i, finalZ);
      this.playerMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
      if (this.playerMesh) {
        this.playerMesh.visible = true;
        // The GLTF model's default forward is facing -Y (Right).
        // Since the 3D Y-axis mapping is inverted (i = 5 - t/48), we must invert playerAngle.
        this.playerMesh.rotation.z = -this.playerAngle + Math.PI / 2;
      }
    }
  }

  animatePlayer(moveSpeed: number, jumpHeight: number, elapsed: number) {
    const mesh = this.playerMesh;
    if (!mesh || !mesh.visible) return 0;

    const legs = mesh.userData.legs as THREE.Group[] | undefined;
    const arms = mesh.userData.arms as THREE.Group[] | undefined;
    const hair = mesh.userData.hair as THREE.Group | undefined;
    const hairLocks = mesh.userData.hairLocks as THREE.Mesh[] | undefined;
    const dress = mesh.userData.dress as THREE.Group | THREE.Mesh | undefined;
    const head = mesh.userData.head as THREE.Group | undefined;

    const isMoving = moveSpeed > 0.35;

    if (isMoving) {
      this.walkPhase += 0.05 + moveSpeed * 0.045;
    }

    const phase = this.walkPhase;
    const swing = isMoving ? Math.sin(phase) * 0.48 : 0;
    const swingOpp = isMoving ? Math.sin(phase + Math.PI) * 0.48 : 0;

    if (legs) {
      legs[0].rotation.y = swing;
      legs[1].rotation.y = swingOpp;
    }

    if (arms) {
      arms[0].rotation.y = isMoving ? swingOpp * 0.7 : Math.sin(elapsed * 1.5) * 0.04;
      arms[1].rotation.y = isMoving ? swing * 0.7 : Math.cos(elapsed * 1.5) * 0.04;
      arms[0].rotation.x = isMoving ? -0.12 + Math.abs(swingOpp) * 0.15 : -0.12;
      arms[1].rotation.x = isMoving ? 0.12 - Math.abs(swing) * 0.15 : 0.12;
    }

    if (hair) {
      hair.rotation.y = isMoving ? Math.sin(phase) * 0.09 : Math.sin(elapsed * 1.2) * 0.02;
      hair.rotation.x = isMoving ? Math.abs(Math.sin(phase)) * 0.06 : 0;
    }
    if (hairLocks) {
      hairLocks.forEach((lock, idx) => {
        const lag = idx * 0.12;
        lock.rotation.y = isMoving ? Math.sin(phase - lag) * 0.14 : Math.sin(elapsed * 1.5 + lag) * 0.03;
        lock.rotation.z = isMoving ? 0.1 + moveSpeed * 0.05 : 0;
      });
    }

    if (dress) {
      dress.rotation.y = isMoving ? Math.sin(phase + Math.PI / 2) * 0.08 : Math.sin(elapsed * 1.8) * 0.015;
      dress.rotation.x = isMoving ? Math.cos(phase * 2) * 0.03 : 0;
    }

    if (head) {
      head.rotation.y = isMoving ? Math.sin(phase * 0.5) * 0.03 : Math.sin(elapsed * 1.2) * 0.015;
      head.rotation.x = Math.sin(elapsed * 1.8) * 0.01;
    }

    if (jumpHeight > 0.2) {
      if (hair) {
        hair.rotation.x = -0.25;
      }
    }

    return isMoving ? Math.abs(Math.sin(phase)) * 0.012 : Math.sin(elapsed * 2.1) * 0.006;
  }

  resetCamera(skySphere?: THREE.Mesh) {
    const desiredPos = new THREE.Vector3();
    const desiredLookAt = new THREE.Vector3();

    const dist = this.cameraDistance;
    const height = Math.sin(this.cameraOrbitPitch) * dist;
    const flatDist = Math.cos(this.cameraOrbitPitch) * dist;
    
    const offsetX = -Math.cos(this.cameraOrbitYaw) * flatDist;
    const offsetY = -Math.sin(this.cameraOrbitYaw) * flatDist;
    
    desiredPos.set(this.targetCamX + offsetX, this.targetCamY + offsetY, height - 0.3);
    desiredLookAt.set(this.targetCamX, this.targetCamY, 0.5);

    if (!this.currentCamPos || !this.currentCamLookAt) {
      this.currentCamPos = desiredPos.clone();
      this.currentCamLookAt = desiredLookAt.clone();
    } else {
      const lerpSpeed = 0.25; 
      this.currentCamPos.lerp(desiredPos, lerpSpeed);
      this.currentCamLookAt.lerp(desiredLookAt, lerpSpeed);
    }

    this.camera.position.copy(this.currentCamPos);
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(this.currentCamLookAt);
    
    if (skySphere) {
      skySphere.position.set(this.targetCamX, this.targetCamY, 0);
    }
  }

  updateMenuCamera(time: number, skySphere?: THREE.Mesh) {
    const orbitRadius = 45;
    const orbitSpeed = 0.08;
    const angle = time * orbitSpeed;
    const centerX = 25;
    const centerY = -25;
    this.camera.position.x = centerX + Math.cos(angle) * orbitRadius;
    this.camera.position.y = centerY + Math.sin(angle) * orbitRadius;
    this.camera.position.z = 15;
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(new THREE.Vector3(centerX, centerY, -2));
    
    if (skySphere) {
      skySphere.position.set(this.camera.position.x, this.camera.position.y, 0);
    }
  }
}
