
import { AudioManager } from '../core/AudioManager';
import { Player } from './Player';

// ─────────────────────────────────────────────────────────────────────────────
//  Shadow AI States
// ─────────────────────────────────────────────────────────────────────────────
type ShadowState = 'patrol' | 'stalk' | 'chase' | 'lunge';

export class Shadow {
  x = 0;
  y = 0;
  w = 20;
  h = 42;

  // Movement
  vx = 0;
  vy = 0;
  facingAngle = 0;
  targetAngle  = 0;

  // State machine
  state: ShadowState = 'patrol';
  pulseTime = 0;
  isStunned = false;
  stunnedTimer = 0;

  // Patrol waypoints (generated on spawn)
  private patrolPoints: { x: number; y: number }[] = [];
  private patrolIndex = 0;
  private patrolWaitTimer = 0;

  // Speeds (world units per frame)
  private readonly PATROL_SPEED = 1.2;
  private readonly STALK_SPEED  = 2.2;
  private readonly CHASE_SPEED  = 4.8;
  private readonly LUNGE_SPEED  = 9.0;

  // Detection radii
  private readonly SIGHT_RADIUS   = 900;  // starts stalking
  private readonly CHASE_RADIUS   = 450;  // full chase begins
  private readonly CAPTURE_RADIUS = 55;   // capture player
  private readonly LOSE_RADIUS    = 1400; // returns to patrol

  // State timers
  private stateTimer = 0;
  private lungeTimer = 0;
  private idleWobble = 0;

  constructor() {}

  // ─── Spawn ────────────────────────────────────────────────────────────────

  spawn(e: { x: number; y: number }) {
    this.x = e.x;
    this.y = e.y;
    this.vx = 0;
    this.vy = 0;
    this.pulseTime  = Math.random() * 100;
    this.state      = 'patrol';
    this.stateTimer = 0;
    this.isStunned  = false;
    this.stunnedTimer = 0;

    // Build a random patrol circuit around the spawn point
    this.patrolPoints = this._buildPatrolCircuit(e.x, e.y, 5, 600);
    this.patrolIndex  = 0;
    this.patrolWaitTimer = 0;
  }

  // ─── Main update ─────────────────────────────────────────────────────────

  /**
   * @param player  The Pandora player instance.
   * @param sanity  Current sanity value 0..1.  Lower = shadow is more aggressive.
   * @returns true when the player is captured.
   */
  update(player: Player, sanity = 1.0): boolean {
    this.pulseTime  += 0.08;
    this.idleWobble += 0.04;
    this.stateTimer += 1;

    // Stunned state overrides everything
    if (this.isStunned) {
      this.stunnedTimer--;
      if (this.stunnedTimer <= 0) {
        this.isStunned = false;
        this.state = 'patrol';
      }
      // Slow drift to stop
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.x  += this.vx;
      this.y  += this.vy;
      AudioManager.getInstance().setHeartbeatSpeed(0);
      return false;
    }

    const dist = this.getDistanceTo(player.x, player.y);
    this._updateState(dist, sanity);
    this._move(player, dist);
    this._updateAudio(dist, sanity);

    // Capture check
    if (dist < this.CAPTURE_RADIUS && this.state !== 'patrol') {
      return true;
    }
    return false;
  }

  // ─── State machine ────────────────────────────────────────────────────────

  private _updateState(dist: number, sanity: number) {
    // Sanity scales all detection radii: at sanity=0 they DOUBLE, at sanity=1 they are baseline
    const scale = 1 + (1 - sanity); // range 1..2
    const sightR  = this.SIGHT_RADIUS  * scale;
    const chaseR  = this.CHASE_RADIUS  * scale;
    const loseR   = this.LOSE_RADIUS;
    const captureR = this.CAPTURE_RADIUS;

    switch (this.state) {

      case 'patrol':
        if (dist < sightR) {
          this._setState('stalk');
        }
        break;

      case 'stalk':
        if (dist < chaseR) {
          this._setState('chase');
        } else if (dist > loseR) {
          this._setState('patrol');
        }
        break;

      case 'chase':
        if (dist > loseR) {
          this._setState('patrol');
        } else if (dist < captureR * 3 && this.stateTimer > 60) {
          this._setState('lunge');
        }
        break;

      case 'lunge':
        this.lungeTimer--;
        if (this.lungeTimer <= 0) {
          this._setState('chase');
        }
        break;
    }

    // Critical sanity: force at least stalk mode regardless of distance
    if (sanity < 0.15 && this.state === 'patrol') {
      this._setState('chase');
    }
  }

  private _setState(s: ShadowState) {
    this.state      = s;
    this.stateTimer = 0;
    if (s === 'lunge') {
      this.lungeTimer = 35; // 35 frames of lunge
    }
  }

  // ─── Movement ─────────────────────────────────────────────────────────────

  private _move(player: Player, dist: number) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;

    switch (this.state) {

      // ── Patrol: walk between waypoints ──────────────────────────────────
      case 'patrol': {
        if (this.patrolWaitTimer > 0) {
          this.patrolWaitTimer--;
          this._applyFriction(0.88);
          break;
        }
        const wp = this.patrolPoints[this.patrolIndex];
        const wdx = wp.x - this.x;
        const wdy = wp.y - this.y;
        const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
        if (wdist < 20) {
          this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
          this.patrolWaitTimer = 60 + Math.floor(Math.random() * 90);
        } else {
          this._steerToward(wdx / wdist, wdy / wdist, this.PATROL_SPEED, 0.08);
        }
        break;
      }

      // ── Stalk: follow at distance, lingering ────────────────────────────
      case 'stalk': {
        // Keep a comfortable following distance, don't rush
        const keepDist = 340;
        if (dist > keepDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          this._steerToward(nx, ny, this.STALK_SPEED, 0.06);
        } else {
          // Hover & wobble in place
          const wobble = Math.sin(this.idleWobble) * 0.4;
          this.vx += wobble * (dy / dist);
          this.vy -= wobble * (dx / dist);
          this._applyFriction(0.92);
        }
        break;
      }

      // ── Chase: direct pursuit ───────────────────────────────────────────
      case 'chase': {
        const nx = dx / dist;
        const ny = dy / dist;
        // Slight sinusoidal side-step to make it feel organic
        const sideStep = Math.sin(this.stateTimer * 0.08) * 0.3;
        const perpX = -ny * sideStep;
        const perpY =  nx * sideStep;
        this._steerToward(nx + perpX, ny + perpY, this.CHASE_SPEED, 0.10);
        break;
      }

      // ── Lunge: burst of speed directly at player ─────────────────────── 
      case 'lunge': {
        const nx = dx / dist;
        const ny = dy / dist;
        this._steerToward(nx, ny, this.LUNGE_SPEED, 0.35);
        break;
      }
    }

    // Apply velocity to position
    this.x += this.vx;
    this.y += this.vy;

    // Update facing angle to match movement direction
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > 0.2) {
      this.targetAngle = Math.atan2(this.vy, this.vx);
      let diff = this.targetAngle - this.facingAngle;
      while (diff > Math.PI)  diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingAngle += diff * 0.12;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _steerToward(nx: number, ny: number, maxSpeed: number, accel: number) {
    this.vx += (nx * maxSpeed - this.vx) * accel;
    this.vy += (ny * maxSpeed - this.vy) * accel;

    // Clamp to max speed
    const s = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (s > maxSpeed) {
      this.vx = (this.vx / s) * maxSpeed;
      this.vy = (this.vy / s) * maxSpeed;
    }
  }

  private _applyFriction(factor: number) {
    this.vx *= factor;
    this.vy *= factor;
  }

  private _buildPatrolCircuit(
    cx: number, cy: number,
    count: number, radius: number
  ): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const r     = radius * (0.7 + Math.random() * 0.6);
      pts.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
    }
    return pts;
  }

  private _updateAudio(dist: number, sanity: number) {
    const audio = AudioManager.getInstance();
    if (this.state === 'patrol' && sanity > 0.4) {
      audio.setHeartbeatSpeed(0);
      return;
    }
    // Heartbeat intensity = combination of proximity + low sanity
    const proximityFactor = Math.max(0, 1 - dist / this.SIGHT_RADIUS);
    const sanityFactor    = Math.max(0, 1 - sanity);  // 0 when sane, 1 when insane
    const stateMultiplier =
      this.state === 'lunge' ? 1.0 :
      this.state === 'chase' ? 0.8 :
      this.state === 'stalk' ? 0.5 : 0.2;
    const intensity = Math.min(1, proximityFactor * stateMultiplier + sanityFactor * 0.4);
    audio.setHeartbeatSpeed(intensity);
  }

  // ─── Public helpers ───────────────────────────────────────────────────────

  getDistanceTo(targetX: number, targetY: number): number {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  stun(duration = 120) {
    this.isStunned    = true;
    this.stunnedTimer = duration;
    this.state        = 'patrol';
  }
}