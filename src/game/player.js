import * as THREE from 'three';
import { clamp, damp, lerp, wrapAngle } from '../core/util.js';

const EYE = 1.62;
const RADIUS = 0.28;

/**
 * First-person body: walking, running (with stamina), stairs, head bob,
 * footsteps, camera shake and scripted "forced look" for scares.
 */
export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.vy = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = true;
    this.surface = 'wood';
    this.stepDist = 0;
    this.bob = 0;
    this.bobAmp = 0;
    this.stamina = 1;
    this.exhausted = false;
    this.sprintTime = 0;
    this.canMove = true;
    this.canLook = true;
    this.trauma = 0;
    this.shakeT = 0;
    this.eyeOffset = 0;
    this.lookAt = null;
    this.moving = false;
    this.speedNow = 0;
    this.lastStepSide = 0;
    this.onStep = null;
    this.eye = EYE;
    this.camera = game.camera;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.forward = new THREE.Vector3();
  }

  teleport(p, yaw = this.yaw, pitch = 0) {
    this.pos.copy(p);
    this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0);
    this.vy = 0;
    const g = this.game.physics.groundAt(p.x, p.z, p.y + 0.5, 1.0);
    if (g) this.pos.y = g.y;
    this.syncCamera(0);
  }

  /** Smoothly turn the head toward a world point (strength 0..1 per second). */
  forceLook(target, speed = 6) {
    this.lookAt = target ? { target: target.clone(), speed } : null;
  }

  shake(amount) {
    this.trauma = Math.min(1.2, this.trauma + amount);
  }

  get eyePos() {
    return this.camera.position;
  }

  update(dt) {
    const g = this.game;
    const input = g.input;
    const phys = g.physics;
    const s = g.settings;

    // --- look
    if (this.canLook && !this.lookAt) {
      const sens = 0.0022 * s.sensitivity;
      this.yaw -= input.mdx * sens;
      this.pitch -= input.mdy * sens * (s.invertY ? -1 : 1);
      this.yaw -= input.turnAxis() * 2.2 * dt;
    }
    if (this.lookAt) {
      const eye = this.camera.position;
      const d = new THREE.Vector3().subVectors(this.lookAt.target, eye);
      const ty = Math.atan2(-d.x, -d.z);
      const tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
      const k = 1 - Math.exp(-this.lookAt.speed * dt);
      this.yaw += wrapAngle(ty - this.yaw) * k;
      this.pitch += (tp - this.pitch) * k;
    }
    this.pitch = clamp(this.pitch, -1.45, 1.45);
    this.yaw = wrapAngle(this.yaw);

    // --- move
    const axis = this.canMove ? input.moveAxis() : { x: 0, y: 0 };
    let len = Math.hypot(axis.x, axis.y);
    const wantSprint = this.canMove && input.sprinting() && axis.y > 0.1 && !this.exhausted;
    const sprint = wantSprint && this.stamina > 0.02;
    let speed = g.walkSpeed ?? 2.2;
    if (sprint) speed = 4.3;
    if (axis.y < -0.1) speed *= 0.9;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    let wx = 0;
    let wz = 0;
    if (len > 0.01) {
      const ax = axis.x / Math.max(1, len);
      const ay = axis.y / Math.max(1, len);
      wx = (fx * ay + rx * ax) * speed;
      wz = (fz * ay + rz * ax) * speed;
    }
    const accel = len > 0.01 ? 9 : 11;
    this.vel.x = damp(this.vel.x, wx, accel, dt);
    this.vel.y = damp(this.vel.y, wz, accel, dt);

    // stamina
    if (sprint && Math.hypot(this.vel.x, this.vel.y) > 3) {
      this.stamina -= dt / 6.5;
      this.sprintTime = 0;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
        g.audio?.sfx('gasp', { vol: 0.5 });
      }
    } else {
      this.sprintTime += dt;
      if (this.sprintTime > 0.8) this.stamina = Math.min(1, this.stamina + dt / 9);
      if (this.exhausted && this.stamina > 0.35) this.exhausted = false;
    }

    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    phys.collide(this.pos, RADIUS, this.pos.y + 0.42, this.pos.y + 1.75);

    // ground / stairs
    const ground = phys.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.5);
    if (ground) {
      const gap = this.pos.y - ground.y;
      if (gap > 0.001) {
        if (this.grounded && gap < 0.45) {
          this.eyeOffset += gap;
          this.pos.y = ground.y;
          this.vy = 0;
        } else {
          this.vy -= 18 * dt;
          this.pos.y += this.vy * dt;
          if (this.pos.y <= ground.y) {
            this.pos.y = ground.y;
            if (this.vy < -4) g.audio?.sfx('land', { vol: 0.5 });
            this.vy = 0;
          }
        }
      } else {
        // walked up a ramp or step: smooth the camera a little
        this.eyeOffset += gap;
        this.pos.y = ground.y;
        this.vy = 0;
      }
      this.grounded = this.pos.y - ground.y < 0.02;
      this.surface = ground.surface;
    } else {
      // nothing under us: undo the move (never fall out of the world)
      this.pos.x = before.x;
      this.pos.z = before.z;
    }
    this.eyeOffset = damp(this.eyeOffset, 0, 14, dt);

    // head bob + footsteps
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    this.speedNow = moved / Math.max(dt, 1e-5);
    this.moving = this.speedNow > 0.4;
    const stride = sprint ? 1.25 : 0.78;
    if (this.grounded) this.stepDist += moved;
    const phase = (this.stepDist / stride) * Math.PI;
    this.bobAmp = damp(this.bobAmp, this.moving ? (sprint ? 0.055 : 0.032) : 0, 8, dt);
    this.bob = Math.sin(phase * 2) * this.bobAmp;
    const side = Math.floor(this.stepDist / stride);
    if (side !== this.lastStepSide) {
      this.lastStepSide = side;
      if (this.moving && this.grounded) {
        g.audio?.footstep(this.surface, sprint ? 1 : 0.6, this.pos);
        this.onStep?.(sprint);
      }
    }
    this.syncCamera(dt);
  }

  syncCamera(dt) {
    const cam = this.camera;
    this.trauma = Math.max(0, this.trauma - dt * 1.1);
    this.shakeT += dt * 30;
    const sh = this.trauma * this.trauma;
    const n = (o) => Math.sin(this.shakeT * 1.13 + o) * 0.6 + Math.sin(this.shakeT * 2.31 + o * 2.1) * 0.4;
    const sx = n(1) * 0.05 * sh;
    const sy = n(2) * 0.05 * sh;
    const sr = n(3) * 0.04 * sh;
    const sway = Math.cos((this.stepDist / 0.78) * Math.PI) * this.bobAmp * 0.25;
    cam.position.set(this.pos.x, this.pos.y + this.eye + this.bob + this.eyeOffset * 0.6, this.pos.z);
    this.euler.set(this.pitch + sy, this.yaw + sx, sr + sway * 0.4);
    cam.quaternion.setFromEuler(this.euler);
    cam.getWorldDirection(this.forward);
  }

  /** Horizontal facing as a unit vector. */
  facing() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  lerpEye(target, t) {
    this.eye = lerp(this.eye, target, t);
  }
}
