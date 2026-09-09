import { xl } from './levelsData';
import RAPIER from '@dimforge/rapier3d-compat';

export interface NexusInfo {
  number: number;
  title: string;
  tag: string;
  diaryText: string;
  thoughts: string[];
  gravity: number;
  windX: number;
  mistOpacity: number;
  shadowBehavior: string;
  worldX: number;
  worldY: number;
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  isDissolving?: boolean;
  dissolveTimer?: number;
  maxDissolveTime?: number;
  origX?: number;
  origY?: number;
}

export interface Reminiscence {
  x: number;
  y: number;
  w: number;
  h: number;
  collected: boolean;
  text: string;
  nexusNumber: number;
  pickupProgress?: number;
}

// ── Deterministic pseudo-random & noise ──────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hash2d(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x: number, y: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix, iy);
  const b = hash2d(ix + 1, iy);
  const c = hash2d(ix, iy + 1);
  const d = hash2d(ix + 1, iy + 1);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function fbm(x: number, y: number, octaves: number, scale: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency, scale) * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxVal;
}

// ── World Generator ──────────────────────────────────────────────
export class LevelManager {
  static instance: LevelManager | null = null;
  
  public nexuses: NexusInfo[] = [];
  public worldPlatforms: Platform[] = [];
  public worldReminiscences: Reminiscence[] = [];
  public playerSpawn = { x: 0, y: 0 };
  public shadowSpawn = { x: 0, y: 0 };

  constructor() {
    if (LevelManager.instance) {
      return LevelManager.instance;
    }
    this.generateOpenWorld();
    LevelManager.instance = this;
  }

  static getInstance(): LevelManager {
    return LevelManager.instance ||= new LevelManager();
  }

  getNexuses(): NexusInfo[] {
    return this.nexuses;
  }
  
  getNearestNexus(playerX: number, playerY: number): NexusInfo | null {
    if (this.nexuses.length === 0) return null;
    let nearest = this.nexuses[0];
    let minDist = Infinity;
    for (const n of this.nexuses) {
      const dx = playerX - n.worldX;
      const dy = playerY - n.worldY;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = n;
      }
    }
    return nearest;
  }

  generateOpenWorld() {
    const WORLD_W = 24000;
    const WORLD_H = 16000;
    const GRID_COLS = 6;
    const SPACING_X = 3600;
    const SPACING_Y = 2400;
    
    this.playerSpawn = { x: SPACING_X, y: SPACING_Y - 60 };
    this.shadowSpawn = { x: SPACING_X + 3200, y: SPACING_Y + 2800 };
    
    const rng = seededRandom(42);

    // ── 1. Place the 33 Nexuses ──────────────────────────────────
    this.nexuses = xl.map((e, idx) => {
      const col = (idx % GRID_COLS) + 1;
      const row = Math.floor(idx / GRID_COLS) + 1;
      const jitterX = (rng() - 0.5) * 1200;
      const jitterY = (rng() - 0.5) * 800;
      const worldX = col * SPACING_X + jitterX;
      const worldY = row * SPACING_Y + jitterY;

      // Nexus central clearing — a large ground slab
      this.worldPlatforms.push({ x: worldX - 300, y: worldY + 260, w: 600, h: 50 });
      // Smaller "altar" platform elevated above
      this.worldPlatforms.push({ x: worldX - 80, y: worldY + 120, w: 160, h: 24 });

      // Reminiscences hidden near each nexus
      const thoughts = e.thoughts || [];
      this.worldReminiscences.push({
        x: worldX + 180 + rng() * 200,
        y: worldY - 80 - rng() * 120,
        w: 15, h: 15, collected: false,
        text: thoughts[0] || 'Uma Elpis encontrada...',
        nexusNumber: e.number
      });
      this.worldReminiscences.push({
        x: worldX - 250 - rng() * 200,
        y: worldY + 60 + rng() * 100,
        w: 15, h: 15, collected: false,
        text: thoughts[1] || 'A imaginação se expande...',
        nexusNumber: e.number
      });
      this.worldReminiscences.push({
        x: worldX + rng() * 300 - 150,
        y: worldY + 350 + rng() * 150,
        w: 15, h: 15, collected: false,
        text: thoughts[2] || 'Quem eu sou de verdade?',
        nexusNumber: e.number
      });

      return {
        number: e.number,
        title: e.title,
        tag: e.tag,
        diaryText: e.diaryText,
        thoughts: e.thoughts,
        gravity: e.gravity || 0.35,
        windX: e.windX || 0,
        mistOpacity: e.mistOpacity || 0.3,
        shadowBehavior: e.shadowBehavior,
        worldX,
        worldY
      };
    });

    // ── 2. Surrealist Ruins & Structures Generation ──────────────────────────
    // We use a sparse sampling approach:
    //   - Large step (1200px) for structure candidates (open world feel)
    //   - Each structure can be a Ruin Foundation, a Monolith, or a Plaza
    //   - Between structures we scatter debris and floating fragments

    const STEP = 1200; // Increased step for a much more open world!
    const MARGIN = 1200;

    for (let gx = MARGIN; gx < WORLD_W - MARGIN; gx += STEP) {
      for (let gy = MARGIN; gy < WORLD_H - MARGIN; gy += STEP) {

        // Skip areas very close to nexus centers so they stay open
        let tooCloseToNexus = false;
        for (const nex of this.nexuses) {
          const dx = gx - nex.worldX;
          const dy = gy - nex.worldY;
          if (dx * dx + dy * dy < 1000 * 1000) {
            tooCloseToNexus = true;
            break;
          }
        }
        if (tooCloseToNexus) continue;

        const density = fbm(gx, gy, 4, 1200);
        const localRng = seededRandom(gx * 7919 + gy * 104729);

        // Add some jitter to the grid
        const baseX = gx + (localRng() - 0.5) * 600;
        const baseY = gy + (localRng() - 0.5) * 600;

        // Determine what to build based on density
        if (density > 0.6) {
          // ─── MASSIVE MONOLITHS ────────────────────────────────────────
          // Huge, imposing cubic structures
          const w = 400 + localRng() * 600;
          const h = 400 + localRng() * 600;
          
          this.worldPlatforms.push({ 
            x: baseX - w/2, y: baseY - h/2, w: w, h: h 
          });

          // Sometimes they have a smaller floating piece nearby
          if (localRng() > 0.5) {
            this.worldPlatforms.push({ 
              x: baseX - w/2 + localRng() * w, 
              y: baseY - h/2 - 200 - localRng() * 300, 
              w: 150 + localRng() * 150, h: 50 + localRng() * 50 
            });
          }

        } else if (density > 0.45) {
          // ─── RUINED FOUNDATIONS (L or U Shapes) ────────────────────────
          // Simulates the base of old houses or buildings
          const wallThick = 60 + localRng() * 40;
          const houseW = 600 + localRng() * 400;
          const houseH = 500 + localRng() * 400;
          
          const structType = localRng();
          
          if (structType > 0.5) {
            // L-Shape
            this.worldPlatforms.push({ x: baseX, y: baseY, w: houseW, h: wallThick }); // Top Wall
            this.worldPlatforms.push({ x: baseX, y: baseY + wallThick, w: wallThick, h: houseH - wallThick }); // Left Wall
          } else {
            // U-Shape
            this.worldPlatforms.push({ x: baseX, y: baseY, w: houseW, h: wallThick }); // Top Wall
            this.worldPlatforms.push({ x: baseX, y: baseY + wallThick, w: wallThick, h: houseH - wallThick }); // Left Wall
            this.worldPlatforms.push({ x: baseX + houseW - wallThick, y: baseY + wallThick, w: wallThick, h: houseH - wallThick }); // Right Wall
          }

          // Inner pedestal/debris inside the ruins
          if (localRng() > 0.4) {
            this.worldPlatforms.push({ 
              x: baseX + houseW/2 - 60, y: baseY + houseH/2 - 60, w: 120, h: 120 
            });
          }

        } else if (density > 0.3) {
          // ─── PLAZAS / PEDESTALS ────────────────────────────────────────
          // Flat areas, wide horizontal platforms that act as minor points of interest
          const pw = 800 + localRng() * 600;
          const ph = 80 + localRng() * 100;
          
          this.worldPlatforms.push({ x: baseX - pw/2, y: baseY, w: pw, h: ph });
          
          // Add some pillars on the plaza
          const pillarCount = 2 + Math.floor(localRng() * 3);
          for(let i = 0; i < pillarCount; i++) {
            this.worldPlatforms.push({ 
              x: (baseX - pw/2) + (pw / pillarCount) * i + 40, 
              y: baseY - 150 - localRng() * 100, 
              w: 60 + localRng() * 40, h: 60 + localRng() * 40 
            });
          }
        } else {
          // ─── DEBRIS / SCATTERED STONES ─────────────────────────────────
          if (localRng() > 0.8) {
            this.worldPlatforms.push({ 
              x: baseX, y: baseY, w: 100 + localRng() * 100, h: 100 + localRng() * 100 
            });
          }
        }

        // Add some random memory fragments around interesting structures
        if (density > 0.4 && localRng() > 0.6) {
          this.worldReminiscences.push({
            x: baseX + (localRng() - 0.5) * 800,
            y: baseY + (localRng() - 0.5) * 800,
            w: 15, h: 15, collected: false,
            text: 'Ecos de uma arquitetura esquecida...',
            nexusNumber: 1
          });
        }
      }
    }

    // ── 3. Paths between Nexuses ─────────────────────────────────
    // Create stepping-stone trails that loosely connect adjacent nexuses
    for (let i = 0; i < this.nexuses.length - 1; i++) {
      const a = this.nexuses[i];
      const b = this.nexuses[i + 1];
      const steps = 8 + Math.floor(rng() * 6);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const mx = a.worldX + (b.worldX - a.worldX) * t;
        const my = a.worldY + (b.worldY - a.worldY) * t;
        // Organic wobble
        const wobX = (rng() - 0.5) * 300;
        const wobY = (rng() - 0.5) * 200;
        this.worldPlatforms.push({
          x: mx + wobX,
          y: my + wobY,
          w: 80 + rng() * 120,
          h: 18 + rng() * 14
        });
      }
    }

    // ── 4. World Boundaries (invisible massive walls) ────────────
    this.worldPlatforms.push({ x: 0, y: 0, w: WORLD_W, h: 60 });
    this.worldPlatforms.push({ x: 0, y: WORLD_H, w: WORLD_W, h: 60 });
    this.worldPlatforms.push({ x: 0, y: 0, w: 60, h: WORLD_H });
    this.worldPlatforms.push({ x: WORLD_W, y: 0, w: 60, h: WORLD_H });
  }


  initPhysics(world: RAPIER.World) {
    for (const platform of this.worldPlatforms) {
      if (platform.isDissolving) continue;
      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
        platform.x + platform.w / 2,
        platform.y + platform.h / 2,
        0
      );
      const rigidBody = world.createRigidBody(bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.cuboid(platform.w / 2, platform.h / 2, 50);
      world.createCollider(colliderDesc, rigidBody);
    }
    
    // Add collisions for the vertical background columns
    const s = [-25, -18, -10, 50, 58, 65],
          l = [-35, -28, -20, -10, 0, 10];
    for (const eVal of s) {
      for (const tVal of l) {
        const x_phys = (eVal + 10) * 48;
        const y_phys = (5 - tVal) * 48;
        
        const randomScale = Math.abs(Math.sin(eVal * 7.32 + tVal * 3.14));
        const w = 0.7 + randomScale * 1.3;
        
        // width and height in physics scale
        const radius_phys = (w / 2) * 48;
        
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x_phys, y_phys, 0);
        const rigidBody = world.createRigidBody(bodyDesc);
        // Using a cuboid for the hitbox as it closely matches the cylinder on the XY plane
        const colliderDesc = RAPIER.ColliderDesc.cuboid(radius_phys, radius_phys, 50);
        world.createCollider(colliderDesc, rigidBody);
      }
    }
  }
}
