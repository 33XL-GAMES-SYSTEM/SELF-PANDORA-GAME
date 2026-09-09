import { AudioManager } from '../core/AudioManager';
import RAPIER from '@dimforge/rapier3d-compat';

export class Player {
  x = 100;
  y = 400;
  vx = 0;
  vy = 0;
  vz = 0;
  w = 20;
  h = 42;
  facingAngle = 0;
  targetAngle = 0;

  // Tuned for smoothness and responsiveness
  runSpeed = 4.2;
  accel = 0.35;          // faster approach to target velocity
  decel = 0.15;         // faster deceleration when no input (feels less floaty, more responsive)
  friction = 0.90;      // higher = more slide / momentum
  turnSpeed = 0.15;     // smoother and faster angular interpolation

  waveActive = false;
  waveRadius = 0;
  waveMaxRadius = 220;
  waveSpeed = 7;
  waveCooldown = 0;

  // Jump / hop
  jumpHeight = 0;       // 0 = grounded, >0 = airborne (used by renderer for scale)
  jumpVelocity = 0;
  jumpGravity = 0.18;
  jumpStrength = 3.2;
  isJumping = false;
  jumpCooldown = 0;

  // For smooth collection magnetism
  // For smooth collection magnetism
  magnetRadius = 120;
  magnetStrength = 0.05; // pull multiplier: gentle drift that accelerates near Pandora
  collectRadius = 22;    // distance at which the memory starts being absorbed

  // ── Sanity ────────────────────────────────────────────────────────────
  sanity = 1.0;          // 0..1, starts full
  readonly maxSanity = 1.0;
  // Drains passively each frame while playing (~3 min to deplete)
  readonly sanityDrainRate = 0.0000556; // 1/18000 frames-at-60fps ≈ 180s

  rigidBody?: RAPIER.RigidBody;
  characterController?: RAPIER.KinematicCharacterController;

  constructor() {}

  spawn(e: { x: number; y: number }, world: RAPIER.World) {
    this.x = e.x;
    this.y = e.y;
    this.vx = 0;
    this.vy = 0;
    this.facingAngle = 0;
    this.targetAngle = 0;
    this.waveActive = false;
    this.waveRadius = 0;
    this.waveCooldown = 0;
    this.jumpHeight = 0;
    this.jumpVelocity = 0;
    this.isJumping = false;
    this.jumpCooldown = 0;
    this.sanity = 1.0;  // Reset sanity on every spawn

    if (this.rigidBody) {
      world.removeRigidBody(this.rigidBody);
    }
    if (this.characterController) {
      world.removeCharacterController(this.characterController);
    }

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.x, this.y, 0);
    this.rigidBody = world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(this.w / 2, this.h / 2, 20);
    world.createCollider(colliderDesc, this.rigidBody);
    
    this.characterController = world.createCharacterController(0.1);
    this.characterController.setUp({ x: 0.0, y: 0.0, z: 1.0 });
  }

  update(keys: Record<string, boolean>, cameraAngle: number = 0) {
    const audio = AudioManager.getInstance();
    const left = keys.KeyA;
    const right = keys.KeyD;
    const up = keys.KeyW;
    const down = keys.KeyS;

    let inputX = 0;
    let inputY = 0;
    if (up) inputX += 1;
    if (down) inputX -= 1;
    if (left) inputY += 1;
    if (right) inputY -= 1;

    let moveDir = 0;
    if (inputX !== 0 || inputY !== 0) {
      moveDir = 1;
      const inputAngle = Math.atan2(inputY, inputX);
      // We invert the sum because the Physics Y axis is inverted relative to Three.js Y axis
      this.targetAngle = -(cameraAngle + inputAngle);
      this.targetAngle = (this.targetAngle + Math.PI * 2) % (Math.PI * 2);
    }

      // Smooth turning for third-person
      let angleDiff = this.targetAngle - this.facingAngle;
      // Wrap to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.facingAngle += angleDiff * this.turnSpeed; // Visual turning speed
      this.facingAngle = (this.facingAngle + Math.PI * 2) % (Math.PI * 2);

    const limit = this.runSpeed;

    if (moveDir !== 0) {
      // Move in the direction the model actually faces. The character
      // turns smoothly into the new heading and walks along it, instead
      // of instantly sliding diagonally while still facing another way.
      const desiredVx = Math.cos(this.facingAngle) * limit;
      const desiredVy = Math.sin(this.facingAngle) * limit;
      this.vx += (desiredVx - this.vx) * this.accel;
      this.vy += (desiredVy - this.vy) * this.accel;
    } else {
      // Smooth deceleration — blend toward zero (momentum glide)
      this.vx *= this.friction;
      this.vy *= this.friction;
      // Kill micro-drift
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
      if (Math.abs(this.vy) < 0.05) this.vy = 0;
    }

    // Soft speed clamping (keeps hops/momentum in check without hard cuts)
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > limit) {
      const dampFactor = limit / speed;
      this.vx *= dampFactor * 0.98 + 0.02; // blend toward limit
      this.vy *= dampFactor * 0.98 + 0.02;
    }

    // ── Wave ability ─────────────────────────────────────────
    if (this.waveCooldown > 0) {
      this.waveCooldown--;
    }

    if (this.waveActive) {
      this.waveRadius += this.waveSpeed;
      if (this.waveRadius >= this.waveMaxRadius) {
        this.waveActive = false;
        this.waveRadius = 0;
      }
    }

    if (keys.MouseClick && this.waveCooldown === 0 && !this.waveActive) {
      this.waveActive = true;
      this.waveRadius = 0;
      this.waveCooldown = 120;
      audio.playLucidityWave();
    }

    // ── Jump / Hop ───────────────────────────────────────────
    if (this.jumpCooldown > 0) {
      this.jumpCooldown--;
    }

    if (this.characterController && this.rigidBody) {
      const currentPos = this.rigidBody.translation();
      // Consider grounded if Rapier says so, or if we hit our manual Z=0 floor
      const isGrounded = this.characterController.computedGrounded() || currentPos.z <= 0.1;

      if (keys.Space && isGrounded && this.jumpCooldown === 0) {
        this.vz = this.jumpStrength * 3; // Scale jump strength for physics
        this.jumpCooldown = 30;
      }

      if (!isGrounded) {
        this.vz -= 0.6; // Gravity
      } else if (this.vz < 0) {
        this.vz = -0.1; // Slight downward pressure for slopes/steps
      }

      const collider = this.rigidBody.collider(0);

      // ── Axis-separated collision resolution ─────────────────
      // Move along X first and resolve collisions
      this.characterController.computeColliderMovement(
        collider,
        new RAPIER.Vector3(this.vx, 0, 0),
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined
      );
      const mx = this.characterController.computedMovement().x;
      const finalX = currentPos.x + mx;
      this.vx = mx; 

      this.rigidBody.setTranslation({ x: finalX, y: currentPos.y, z: currentPos.z }, false);

      // Move along Y and resolve collisions
      this.characterController.computeColliderMovement(
        collider,
        new RAPIER.Vector3(0, this.vy, 0),
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined
      );
      const my = this.characterController.computedMovement().y;
      const finalY = currentPos.y + my;
      this.vy = my; 
      
      this.rigidBody.setTranslation({ x: finalX, y: finalY, z: currentPos.z }, false);

      // Move along Z and resolve collisions
      this.characterController.computeColliderMovement(
        collider,
        new RAPIER.Vector3(0, 0, this.vz),
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined
      );
      const mz = this.characterController.computedMovement().z;
      let finalZ = currentPos.z + mz;
      this.vz = mz;

      // Hardcode a floor at Z = 0 so the player doesn't fall below the map
      if (finalZ <= 0) {
        finalZ = 0;
        if (this.vz < 0) this.vz = 0;
      }

      this.rigidBody.setNextKinematicTranslation({
        x: finalX,
        y: finalY,
        z: finalZ
      });

      this.x = finalX;
      this.y = finalY;
      
      // Update visual jump height based on physical Z (scaled down to renderer expectations)
      this.jumpHeight = Math.max(0, finalZ / 4);
    }
  }

  /** Restore sanity by a fixed amount (clamped to maxSanity). */
  restoreSanity(amount: number) {
    this.sanity = Math.min(this.maxSanity, this.sanity + amount);
  }

  /** Drain sanity passively — call once per gameplay frame. */
  drainSanity() {
    this.sanity = Math.max(0, this.sanity - this.sanityDrainRate);
  }
}