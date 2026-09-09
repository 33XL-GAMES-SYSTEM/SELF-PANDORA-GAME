import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EnvironmentRenderer } from './EnvironmentRenderer';
import { PandoraRenderer } from './PandoraRenderer';
import { EntityRenderer } from './EntityRenderer';
import { type Platform } from '../level/LevelManager';

export function updateEnvFilter(_isReverie: boolean) { /* reserved for future texture-swap logic */ }

export class CoreRenderer {
  container: HTMLElement;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  clock: THREE.Clock;
  composer!: EffectComposer;
  bloomPass!: UnrealBloomPass;
  ssaoPass!: SSAOPass;

  envRenderer!: EnvironmentRenderer;
  pandoraRenderer!: PandoraRenderer;
  entityRenderer!: EntityRenderer;

  private _rmb = false;
  private _rmbLastX = 0;
  private _rmbLastY = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    this.initScene();
    
    // Instantiate sub-engines
    this.envRenderer = new EnvironmentRenderer(this.scene, this.renderer, this.clock);
    this.pandoraRenderer = new PandoraRenderer(this.scene, this.camera);
    this.entityRenderer = new EntityRenderer(this.scene, this.clock);

    this.envRenderer.loadTextures(() => {
        // Textures loaded
    });
    this.envRenderer.setupLights();
    this.envRenderer.createBackground();
    this.envRenderer.createAmbientParticles();
    this.envRenderer.createMistParticles();
    this.envRenderer.createWaveRing();
    this.envRenderer.createTransitionPlane();

    this.setupCameraControls();
    this.setupPostProcessing(this.container.clientWidth, this.container.clientHeight);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);
    this.scene.fog = new THREE.FogExp2(0x111111, 0.015);
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.05, 500);
    this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'high-performance'});
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.6;

    // Environment map for PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    this.container.appendChild(this.renderer.domElement);
  }

  setupCameraControls() {
    this.container.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 1 : -1;
      const zoomSpeed = 0.3;
      this.pandoraRenderer.cameraDistance = Math.max(
        0.8,
        Math.min(20.0, this.pandoraRenderer.cameraDistance + delta * zoomSpeed)
      );
    }, { passive: false, capture: true });

    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 2) {
        this._rmb = true;
        this._rmbLastX = e.clientX;
        this._rmbLastY = e.clientY;
      }
    }, { capture: true });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this._rmb) return;
      const dx = e.clientX - this._rmbLastX;
      const dy = e.clientY - this._rmbLastY;
      this._rmbLastX = e.clientX;
      this._rmbLastY = e.clientY;

      const sensitivity = 0.005;
      this.pandoraRenderer.cameraOrbitYaw += dx * sensitivity;
      this.pandoraRenderer.cameraOrbitPitch = Math.max(
        0.05,
        Math.min(Math.PI / 2 - 0.05, this.pandoraRenderer.cameraOrbitPitch - dy * sensitivity)
      );
    });

    document.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 2) this._rmb = false;
    });

    document.addEventListener('mouseleave', () => {
      this._rmb = false;
    });
    
    window.addEventListener('blur', () => {
      this._rmb = false;
    });

    document.addEventListener('contextmenu', (e: Event) => {
      e.preventDefault();
    }, { capture: true });
  }

  setupPostProcessing(w: number, h: number) {
    this.composer = new EffectComposer(this.renderer);
    
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    // Ambient Occlusion
    this.ssaoPass = new SSAOPass(this.scene, this.camera, w, h);
    this.ssaoPass.kernelRadius = 1.2;
    this.ssaoPass.minDistance = 0.005;
    this.ssaoPass.maxDistance = 0.1;
    // this.composer.addPass(this.ssaoPass); // DISABLED: Causes dark shadow aura around player

    // Bloom
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.4, 0.95);
    this.composer.addPass(this.bloomPass);
  }

  // DELEGATIONS for backward compatibility with GameCoordinator.ts

  createPlayer(x: number, y: number, onLoad?: () => void) {
    this.pandoraRenderer.createPlayer(x, y, onLoad);
  }

  updatePlayer(x: number, y: number, angle: number, jumpHeight = 0, moveSpeed = 0) {
    const elapsed = this.clock.getElapsedTime();
    const groundZ = this.envRenderer.getGroundZ(x / 48 - 10, 5 - y / 48);
    this.pandoraRenderer.updatePlayer(x, y, angle, jumpHeight, moveSpeed, elapsed, groundZ);
  }

  createShadow(x: number, y: number) {
    this.entityRenderer.createShadow(x, y);
  }

  updateShadow(x: number, y: number, isStunned = false, facingAngle = 0) {
    this.entityRenderer.updateShadow(x, y, isStunned, facingAngle);
  }

  createPlatform(x: number, y: number, w: number, h: number, isReverie = false, _a = 0) {
    return this.envRenderer.createPlatform(x, y, w, h, this.currentLevelNum, isReverie, _a);
  }

  updatePlatforms(platforms: Platform[], playerX: number, playerY: number) {
    this.envRenderer.updatePlatforms(platforms, playerX, playerY);
  }

  createDoor(x: number, y: number, w: number, h: number) {
    this.entityRenderer.createDoor(x, y, w, h);
  }

  createReminiscence(x: number, y: number) {
    return this.entityRenderer.createReminiscence(x, y);
  }

  updateReminiscences(items: any[]) {
    this.entityRenderer.updateReminiscences(items, this.clock.getElapsedTime());
  }

  updateWaveRing(x: number, y: number, radius: number, isActive: boolean) {
    this.envRenderer.updateWaveRing(x, y, radius, isActive);
  }

  addParticleBurst(x: number, y: number, color: string) {
    this.envRenderer.addParticleBurst(x, y, color);
  }

  updateParticles(windX = 0) {
    this.envRenderer.updateParticles(windX);
  }

  setMistIntensity(i: number) {
    this.envRenderer.setMistIntensity(i);
  }

  triggerTransition(duration: number, callback: () => void) {
    this.envRenderer.triggerTransition(duration, callback);
  }

  setCameraShake(intensity: number) {
    const t = (Math.random() - 0.5) * intensity * 0.04;
    const n = (Math.random() - 0.5) * intensity * 0.04;
    const rVal = (Math.random() - 0.5) * intensity * 0.04;
    this.camera.position.x += t;
    this.camera.position.y += n;
    this.camera.position.z += rVal;
  }

  resetCamera() {
    this.pandoraRenderer.resetCamera(this.envRenderer.skySphere);
  }

  updateMenuCamera(time: number) {
    this.pandoraRenderer.updateMenuCamera(time, this.envRenderer.skySphere);
  }

  setBloom(strength: number) {
    this.bloomPass.strength = strength;
  }

  render() {
    this.composer.render();
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  getCanvas() {
    return this.renderer.domElement;
  }

  currentLevelNum = 1;

  clearLevel() {
    this.envRenderer.clearEnvironment();
    this.entityRenderer.clearEntities();
  }
}
