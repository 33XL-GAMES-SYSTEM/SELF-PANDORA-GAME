import * as THREE from 'three';
import { type Platform } from '../level/LevelManager';

function _l(t: number, n: number, s: number, cVal: THREE.Texture, u: THREE.Texture): THREE.Group {
  const f = new THREE.Group();
  const m: THREE.Texture = s <= 15 ? cVal : u;
  
  const w = t / 48;
  const h = n / 48;
  const d = 4.8;
  
  const geom = new THREE.BoxGeometry(w, h, d);
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const norm = geom.attributes.normal;
  
  const scale = 0.75; // The zoom level we defined earlier
  
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    
    // In our 2.5D setup translated to 3D, Z is UP (height of the wall).
    // U (horizontal) goes around the wall. V (vertical) maps to Z.
    if (nx > 0.5) {
      uv.setXY(i, y * scale, z * scale);
    } else if (ny > 0.5) {
      uv.setXY(i, x * scale, z * scale);
    } else if (nz > 0.5) {
      uv.setXY(i, x * scale, y * scale);
    }
  }
  
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, 
    map: m, 
    metalness: .1, 
    roughness: .9
  });
  
  const x = new THREE.Mesh(geom, mat);
  x.castShadow = true;
  x.receiveShadow = true;
  f.add(x);
  
  return f;
}

export class EnvironmentRenderer {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;

  purpleLight!: THREE.PointLight;
  cyanLight!: THREE.PointLight;
  
  platformMeshes: THREE.Group[] = [];
  platformMeta: { w: number; h: number; }[] = [];
  
  skySphere!: THREE.Mesh;
  mistParticles!: THREE.Points;
  ambientParticles!: THREE.Points;
  particlesGroup!: THREE.Group;
  particleSystems: THREE.Points[] = [];
  waveRing!: THREE.Mesh;
  transitionPlane!: THREE.Mesh;
  groundMesh: THREE.Mesh | null = null;
  groundRaycaster = new THREE.Raycaster();
  groundRayDir = new THREE.Vector3(0, 0, -1);

  realityTexture!: THREE.Texture;
  reverieTexture!: THREE.Texture;
  surrealTexture3!: THREE.Texture;
  surrealTexture4!: THREE.Texture;
  skyDayTexture!: THREE.Texture;
  skyNightTexture!: THREE.Texture;
  tubesTexture!: THREE.Texture;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, clock: THREE.Clock) {
    this.scene = scene;
    this.renderer = renderer;
    this.clock = clock;
    this.particlesGroup = new THREE.Group();
    this.scene.add(this.particlesGroup);
  }

  loadTextures(onComplete: () => void) {
    const progressBar = document.getElementById('loading-progress-bar');
    const statusText = document.getElementById('loading-status-text');
    const loadingScreen = document.getElementById('loading-screen');
    const menuScreenBase = document.getElementById('menu-screen-base');
    const menuScreenTop = document.getElementById('menu-screen-top');
    const quoteElement = document.getElementById('loading-poetic-quote');

    const quotes = [
      "\"As sombras dão forma às memórias...\"",
      "\"Quem eu sou de verdade?\"",
      "\"A imaginação se expande no escuro...\"",
      "\"A aceitação é o primeiro passo da cura...\"",
      "\"Nenhuma ferida é um erro.\""
    ];
    if (quoteElement) {
      quoteElement.innerText = quotes[Math.floor(Math.random() * quotes.length)];
    }

    const manager = new THREE.LoadingManager();

    manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const percentage = Math.round((itemsLoaded / itemsTotal) * 100);
      if (progressBar) progressBar.style.width = `${percentage}%`;
      if (statusText) statusText.innerText = `Reintegrando memórias: ${percentage}%`;
    };

    manager.onLoad = () => {
      if (statusText) statusText.innerText = 'Integração concluída.';
      setTimeout(() => {
        if (loadingScreen) {
          loadingScreen.classList.remove('active', 'pointer-events-auto');
          loadingScreen.classList.add('pointer-events-none');
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 1000);
        }
        if (menuScreenBase) {
          menuScreenBase.classList.add('active', 'pointer-events-auto');
          menuScreenBase.classList.remove('pointer-events-none');
        }
        if (menuScreenTop) {
          menuScreenTop.classList.add('active');
          menuScreenTop.style.pointerEvents = 'none';
          menuScreenTop.classList.remove('pointer-events-none');
        }
      }, 600);
      onComplete();
    };

    manager.onError = (url) => {
      console.error('Error loading texture:', url);
      if (statusText) {
        statusText.innerText = 'Conexão instável. Carregando mesmo assim...';
        statusText.style.color = '#f59e0b';
      }
      setTimeout(() => {
        if (loadingScreen) {
          loadingScreen.classList.remove('active', 'pointer-events-auto');
          loadingScreen.classList.add('pointer-events-none');
          loadingScreen.style.display = 'none';
        }
        if (menuScreenBase) {
          menuScreenBase.classList.add('active', 'pointer-events-auto');
          menuScreenBase.classList.remove('pointer-events-none');
        }
        if (menuScreenTop) {
          menuScreenTop.classList.add('active');
          menuScreenTop.style.pointerEvents = 'none';
          menuScreenTop.classList.remove('pointer-events-none');
        }
      }, 1500);
      onComplete();
    };

    const t = new THREE.TextureLoader(manager);
    this.realityTexture = t.load(`/textures/main/wall_bricks_bw.jpg`);
    this.realityTexture.wrapS = THREE.RepeatWrapping;
    this.realityTexture.wrapT = THREE.RepeatWrapping;
    this.realityTexture.minFilter = THREE.LinearFilter;
    this.realityTexture.magFilter = THREE.LinearFilter;
    this.reverieTexture = t.load(`/textures/main/wall_bricks_bw.jpg`);
    this.reverieTexture.wrapS = THREE.RepeatWrapping;
    this.reverieTexture.wrapT = THREE.RepeatWrapping;
    this.reverieTexture.minFilter = THREE.LinearFilter;
    this.reverieTexture.magFilter = THREE.LinearFilter;
    this.surrealTexture3 = t.load(`/textures/main/wall_bricks_bw.jpg`);
    this.surrealTexture3.wrapS = THREE.RepeatWrapping;
    this.surrealTexture3.wrapT = THREE.RepeatWrapping;
    this.surrealTexture3.minFilter = THREE.LinearFilter;
    this.surrealTexture3.magFilter = THREE.LinearFilter;
    this.surrealTexture4 = t.load(`/textures/main/wall_bricks_bw.jpg`);
    this.surrealTexture4.wrapS = THREE.RepeatWrapping;
    this.surrealTexture4.wrapT = THREE.RepeatWrapping;
    this.surrealTexture4.minFilter = THREE.LinearFilter;
    this.surrealTexture4.magFilter = THREE.LinearFilter;
    this.skyDayTexture = t.load(`/textures/main/sky_clouds_bw_pano.jpg`);
    this.skyDayTexture.wrapS = THREE.RepeatWrapping;
    this.skyDayTexture.wrapT = THREE.RepeatWrapping;
    this.skyDayTexture.repeat.set(6, 4);
    this.skyDayTexture.minFilter = THREE.LinearFilter;
    this.skyDayTexture.magFilter = THREE.LinearFilter;
    this.skyNightTexture = t.load(`/textures/main/sky_clouds_bw_pano.jpg`);
    this.skyNightTexture.wrapS = THREE.RepeatWrapping;
    this.skyNightTexture.wrapT = THREE.RepeatWrapping;
    this.skyNightTexture.repeat.set(6, 4);
    this.skyNightTexture.minFilter = THREE.LinearFilter;
    this.skyNightTexture.magFilter = THREE.LinearFilter;
    
    this.tubesTexture = t.load(`/textures/main/tubes_texture.jpg`);
    this.tubesTexture.wrapS = THREE.RepeatWrapping;
    this.tubesTexture.wrapT = THREE.RepeatWrapping;
    this.tubesTexture.repeat.set(1, 1);
    this.tubesTexture.minFilter = THREE.LinearFilter;
    this.tubesTexture.magFilter = THREE.LinearFilter;
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.4);
    dir.position.set(15, 25, 20);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 100;
    dir.shadow.camera.left = -30;
    dir.shadow.camera.right = 30;
    dir.shadow.camera.top = 30;
    dir.shadow.camera.bottom = -30;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);
    this.purpleLight = new THREE.PointLight(0xaaaaaa, 0.5, 35);
    this.purpleLight.position.set(-12, 8, 12);
    this.scene.add(this.purpleLight);
    this.cyanLight = new THREE.PointLight(0xcccccc, 0.5, 35);
    this.cyanLight.position.set(12, 8, 12);
    this.scene.add(this.cyanLight);
    const backDir = new THREE.DirectionalLight(0xffffff, 0.15);
    backDir.position.set(0, 0, -10);
    this.scene.add(backDir);
  }

  createBackground() {
    const t = new THREE.SphereGeometry(350, 32, 32),
        n = new THREE.MeshBasicMaterial({map: this.skyDayTexture, side: 1, fog: false});
    this.skySphere = new THREE.Mesh(t, n);
    this.skySphere.position.set(240, -160, 0); 
    this.scene.add(this.skySphere);
    
    const grass = new THREE.TextureLoader().load(`/textures/main/floor_grass_bw.jpg`);
    grass.wrapS = THREE.RepeatWrapping;
    grass.wrapT = THREE.RepeatWrapping;
    grass.repeat.set(900, 900);
    grass.minFilter = THREE.LinearMipmapLinearFilter;
    grass.magFilter = THREE.LinearFilter;
    grass.generateMipmaps = true;
    grass.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    
    const groundMat = new THREE.MeshStandardMaterial({color: 0x444444, map: grass, metalness: 0.05, roughness: 0.95});
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), groundMat);
    ground.position.set(240, -160, -1.09);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.groundMesh = ground;
    
    const s = [-25, -18, -10, 50, 58, 65],
        l = [-35, -28, -20, -10, 0, 10];

    for (const eVal of s) {
      for (const tVal of l) {
        const randomScale = Math.abs(Math.sin(eVal * 7.32 + tVal * 3.14));
        const w = 0.7 + randomScale * 1.3;
        const depth = 15 + randomScale * 30;

        const radius = w / 2;
        const colGeom = new THREE.CylinderGeometry(radius, radius, depth, 16);
        colGeom.rotateX(Math.PI / 2); // Make it point along Z axis
        
        const uv = colGeom.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          uv.setY(i, uv.getY(i) * (depth / 3.5));
          uv.setX(i, uv.getX(i) * 2); // Wrap texture 2 times around the cylinder
        }

        const nVal = (eVal + tVal) % 2 === 0;
        const rValMat = new THREE.MeshStandardMaterial({
          color: 0x666666,
          map: this.tubesTexture,
          emissive: nVal ? 0x2a2a2a : 0x151515,
          emissiveIntensity: 0.3,
          metalness: 0.7,
          roughness: 0.3
        });
        const rVal = new THREE.Mesh(colGeom, rValMat);
        rVal.position.set(eVal, tVal, -5);
        rVal.receiveShadow = true;
        rVal.castShadow = true;
        this.scene.add(rVal);
      }
    }
  }

  createAmbientParticles() {
    const e = new Float32Array(600);
    for (let t = 0; t < 200; t++) {
      e[t * 3] = (Math.random() - 0.5) * 60;
      e[t * 3 + 1] = (Math.random() - 0.5) * 40;
      e[t * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
    }
    const t = new THREE.BufferGeometry();
    t.setAttribute(`position`, new THREE.BufferAttribute(e, 3));
    const n = new THREE.PointsMaterial({size: 0.08, color: 0x888888, transparent: true, opacity: 0.4, blending: 2});
    this.ambientParticles = new THREE.Points(t, n);
    this.scene.add(this.ambientParticles);
  }

  createMistParticles() {
    const e = new Float32Array(240),
        t = new Float32Array(240);
    for (let n = 0; n < 80; n++) {
      e[n * 3] = (Math.random() - 0.5) * 70;
      e[n * 3 + 1] = (Math.random() - 0.5) * 50;
      e[n * 3 + 2] = -0.5 + Math.random() * 2;
      t[n * 3] = 0.8;
      t[n * 3 + 1] = 0.8;
      t[n * 3 + 2] = 0.8;
    }
    const n = new THREE.BufferGeometry();
    n.setAttribute(`position`, new THREE.BufferAttribute(e, 3));
    n.setAttribute(`color`, new THREE.BufferAttribute(t, 3));
    const rVal = new THREE.PointsMaterial({size: 0.5, vertexColors: true, transparent: true, opacity: 0, blending: 2});
    this.mistParticles = new THREE.Points(n, rVal);
    this.scene.add(this.mistParticles);
  }

  createWaveRing() {
    const e = new THREE.RingGeometry(0.1, 0.3, 64),
        t = new THREE.MeshBasicMaterial({color: 2282478, transparent: true, opacity: 0, side: 2});
    this.waveRing = new THREE.Mesh(e, t);
    this.waveRing.rotation.x = -Math.PI / 2;
    this.waveRing.position.z = -0.1;
    this.scene.add(this.waveRing);
  }

  createTransitionPlane() {
    const e = new THREE.PlaneGeometry(100, 60),
        t = new THREE.MeshBasicMaterial({color: 657932, transparent: true, opacity: 0});
    this.transitionPlane = new THREE.Mesh(e, t);
    this.transitionPlane.position.z = 5;
    this.scene.add(this.transitionPlane);
  }

  setMistIntensity(e: number) {
    if (this.mistParticles) {
      (this.mistParticles.material as THREE.PointsMaterial).opacity = e * 0.4;
    }
  }

  triggerTransition(e: number, t: () => void) {
    const mat = this.transitionPlane.material as THREE.MeshBasicMaterial,
        rVal = Date.now(),
        i = () => {
          const a = (Date.now() - rVal) / e;
          if (a < 0.5) {
            mat.opacity = a * 2;
          } else if (a < 1) {
            t();
            mat.opacity = (1 - a) * 2;
          } else {
            mat.opacity = 0;
            return;
          }
          requestAnimationFrame(i);
        };
    i();
  }

  updateMist(e: number, windX = 0) {
    if (this.mistParticles && (this.mistParticles.material as THREE.PointsMaterial).opacity > 0) {
      const t = this.mistParticles.geometry.attributes.position.array as Float32Array;
      const windSpeed = 0.01 + windX * 0.4;
      for (let n = 0; n < t.length; n += 3) {
        t[n] += windSpeed;
        t[n + 1] += Math.sin(e + n) * 0.005;
        if (windSpeed >= 0) {
          if (t[n] > 35) t[n] = -35;
        } else {
          if (t[n] < -35) t[n] = 35;
        }
      }
      this.mistParticles.geometry.attributes.position.needsUpdate = true;
      this.mistParticles.rotation.z += 0.001 + windX * 0.002;
    }
  }

  getGroundZ(x: number, y: number): number {
    if (!this.groundMesh) return -1.09;
    const origin = new THREE.Vector3(x, y, 20);
    this.groundRaycaster.set(origin, this.groundRayDir);
    const hits = this.groundRaycaster.intersectObject(this.groundMesh);
    if (hits.length > 0) return hits[0].point.z;
    return -1.09;
  }

  createPlatform(eVal: number, t: number, n: number, rVal: number, levelNum: number, _i = false, _a = 0) {
    const cVal = _l(n, rVal, levelNum, this.realityTexture, this.surrealTexture3);
    cVal.position.set((eVal + n / 2) / 48 - 10, 5 - (t + rVal / 2) / 48, 1.3);
    this.scene.add(cVal);
    this.platformMeshes.push(cVal);
    this.platformMeta.push({w: n, h: rVal});
    return cVal;
  }

  updatePlatforms(eVal: Platform[], playerX: number, playerY: number) {
    eVal.forEach((item, tVal) => {
      const mesh = this.platformMeshes[tVal];
      if (mesh) {
        const dx = item.x - playerX;
        const dy = item.y - playerY;
        if (dx * dx + dy * dy > 9000000) {
          mesh.visible = false;
        } else {
          mesh.visible = true;
          const targetX = (item.x + item.w / 2) / 48 - 10;
          const targetY = 5 - (item.y + item.h / 2) / 48;
          if (Math.abs(mesh.position.x - targetX) > 0.001 || Math.abs(mesh.position.y - targetY) > 0.001) {
            mesh.position.set(targetX, targetY, 1.3);
          }
        }
      }
    });
  }

  updateWaveRing(eVal: number, t: number, n: number, rVal: boolean) {
    if (this.waveRing && rVal) {
      this.waveRing.position.set(eVal / 48 - 10, 5 - t / 48, -0.1);
      const ringScale = n / 14.4;
      this.waveRing.scale.set(ringScale, ringScale, 1);
      (this.waveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - n / 220);
    } else if (this.waveRing) {
      (this.waveRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  parseColor(eVal: string) {
    if (eVal.includes(`217, 70, 239`)) return {r: 0.85, g: 0.27, b: 0.94};
    if (eVal.includes(`6, 182, 212`)) return {r: 0.8, g: 0.8, b: 0.8};
    if (eVal.includes(`34, 211, 238`)) return {r: 0.8, g: 0.8, b: 0.8};
    if (eVal.includes(`236, 72, 153`)) return {r: 0.93, g: 0.28, b: 0.6};
    return {r: 1, g: 1, b: 1};
  }

  addParticleBurst(eVal: number, t: number, n: string) {
    const rVal = new Float32Array(36),
        i = new Float32Array(36),
        a = new Float32Array(12),
        oVal = this.parseColor(n);
    for (let nVal = 0; nVal < 12; nVal++) {
      rVal[nVal * 3] = eVal / 48 - 10 + (Math.random() - 0.5) * 1.5;
      rVal[nVal * 3 + 1] = 5 - t / 48 + (Math.random() - 0.5) * 1.5;
      rVal[nVal * 3 + 2] = (Math.random() - 0.5) * 0.8;
      i[nVal * 3] = oVal.r;
      i[nVal * 3 + 1] = oVal.g;
      i[nVal * 3 + 2] = oVal.b;
      a[nVal] = 0.1 + Math.random() * 0.15;
    }
    const s = new THREE.BufferGeometry();
    s.setAttribute(`position`, new THREE.BufferAttribute(rVal, 3));
    s.setAttribute(`color`, new THREE.BufferAttribute(i, 3));
    s.setAttribute(`size`, new THREE.BufferAttribute(a, 1));
    const cVal = new THREE.Points(s, new THREE.PointsMaterial({size: 0.2, vertexColors: true, transparent: true, opacity: 1, blending: 2, sizeAttenuation: true}));
    cVal.userData.life = 40;
    cVal.userData.maxLife = 40;
    cVal.userData.velocity = Array.from({length: 12}, () => ({x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.1}));
    this.particlesGroup.add(cVal);
    this.particleSystems.push(cVal);
  }

  updateParticles(windX = 0) {
    if (this.ambientParticles) {
      this.ambientParticles.rotation.z += 3e-4 + windX * 5e-4;
    }
    this.updateMist(this.clock.getElapsedTime(), windX);
    for (let e = this.particleSystems.length - 1; e >= 0; e--) {
      const t = this.particleSystems[e];
      t.userData.life--;
      if (t.userData.life <= 0) {
        this.particlesGroup.remove(t);
        this.particleSystems.splice(e, 1);
        continue;
      }
      const n = t.geometry.attributes.position.array as Float32Array,
          rVal = t.userData.velocity,
          i = t.userData.life / t.userData.maxLife;
      for (let eVal = 0; eVal < rVal.length; eVal++) {
        n[eVal * 3] += rVal[eVal].x + windX * 0.1;
        n[eVal * 3 + 1] += rVal[eVal].y;
        n[eVal * 3 + 2] += rVal[eVal].z;
        rVal[eVal].y -= 0.008;
      }
      t.geometry.attributes.position.needsUpdate = true;
      (t.material as THREE.PointsMaterial).opacity = i;
    }
  }

  clearEnvironment() {
    this.platformMeshes.forEach(eVal => this.scene.remove(eVal));
    this.platformMeshes = [];
    this.platformMeta = [];
    this.particleSystems.forEach(eVal => this.particlesGroup.remove(eVal));
    this.particleSystems = [];
  }
}
