import * as THREE from 'three';
import { buildHer, POSES, RANDOM_POSES, clonePose, mixPose } from './herModel.js';
import { NavGrid } from './nav.js';
import { clamp, damp, pick, rand } from '../core/util.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/**
 * "Her". Modes:
 *   hidden   – not in the world
 *   static   – holds a pose where the script put her
 *   stalk    – Rule 5: moves only while nobody can see her
 *   follow   – Rule 4: always right behind you
 *   gaze     – Rule 3: waits under a light and raises her face
 *   script   – the story drives her directly
 */
export class Her {
  constructor(game) {
    this.game = game;
    const built = buildHer(game.mats);
    this.root = built.root;
    this.j = built.j;
    this.faceMat = built.faceMat;
    this.headMesh = built.headMesh;
    this.hair = built.hair;
    this.root.visible = false;
    game.scene.add(this.root);
    this.mode = 'hidden';
    this.pose = clonePose(POSES.stand);
    this.from = clonePose(POSES.stand);
    this.to = clonePose(POSES.stand);
    this.blend = 1;
    this.blendSpeed = 2;
    this.jaw = 0;
    this.jawTarget = 0;
    this.headTrack = 0;
    this.trackYaw = 0;
    this.trackPitch = 0;
    this.twitchT = rand(1, 3);
    this.twitch = null;
    this.walkPhase = 0;
    this.walking = 0;
    this.time = 0;
    this.speed = 2.6;
    this.observed = false;
    this.wasMoving = false;
    this.path = null;
    this.repathT = 0;
    this.stepAcc = 0;
    this.pauseT = 0;
    this.onCatch = null;
    this.catchDist = 1.05;
    this.gaze = 0;
    this.breath = null;
    this.breathOn = false;
    this.nav = null;
    this.lastSeenT = 0;
    this.moveBudget = 0;
    this.flickerScale = 1;
    this._tmp = new THREE.Vector3();
    this.samplePts = [
      new THREE.Vector3(0, 2.2, 0),
      new THREE.Vector3(0, 1.7, 0),
      new THREE.Vector3(0, 1.15, 0),
      new THREE.Vector3(0, 0.55, 0),
    ];
  }

  // ------------------------------------------------------------------ control
  show(pos, yaw = 0, pose = 'stand', mode = 'static') {
    this.root.position.copy(pos);
    this.root.rotation.set(0, yaw, 0);
    this.setPose(pose, true);
    this.root.visible = true;
    this.mode = mode;
    this.path = null;
    this.wasMoving = false;
    this.jaw = this.jawTarget = 0;
    this.setFace('idle');
    this.root.updateMatrixWorld(true);
  }

  hide() {
    this.root.visible = false;
    this.mode = 'hidden';
    this.breathLoop(false);
  }

  setPose(name, instant = false, speed = 2) {
    const p = typeof name === 'string' ? POSES[name] : name;
    this.poseName = typeof name === 'string' ? name : 'custom';
    mixPose(this.from, this.pose, this.pose, 0);
    this.to = clonePose(p);
    this.blend = instant ? 1 : 0;
    this.blendSpeed = speed;
    if (instant) this.pose = clonePose(p);
  }

  randomPose(exclude) {
    let n = pick(RANDOM_POSES);
    if (n === exclude) n = pick(RANDOM_POSES);
    this.setPose(n, true);
    return n;
  }

  setFace(kind) {
    const M = this.game.mats;
    this.faceMat.map = kind === 'scream' ? M.faceScreamTex : M.faceIdleTex;
    this.faceMat.needsUpdate = true;
  }

  faceTowards(p, instant = true) {
    const dx = p.x - this.root.position.x;
    const dz = p.z - this.root.position.z;
    const yaw = Math.atan2(dx, dz);
    if (instant) this.root.rotation.y = yaw;
    return yaw;
  }

  headWorld(out = new THREE.Vector3()) {
    return this.j.head.localToWorld(out.set(0, 0.13, 0.05));
  }

  breathLoop(on) {
    const a = this.game.audio;
    if (on && !this.breath && a.ready) {
      this.breath = a.loopAt('breathHer', this.headWorld(), 0.0, { ref: 1.2, rolloff: 1.6 });
    } else if (!on && this.breath) {
      this.breath.stop(0.3);
      this.breath = null;
    }
  }

  // ------------------------------------------------------------------ perception
  /** Can the player see her right now? Needs line of sight, the frustum, and light. */
  isObserved() {
    if (!this.root.visible) return false;
    const g = this.game;
    const cam = g.camera;
    const eye = cam.position;
    this.root.updateMatrixWorld(true);
    for (const local of this.samplePts) {
      const p = _v.copy(local).applyMatrix4(this.root.matrixWorld);
      if (local.y > 2 && this.j.head) this.headWorld(p);
      const ndc = _w.copy(p).project(cam);
      if (ndc.z > 1 || ndc.z < -1 || Math.abs(ndc.x) > 1.02 || Math.abs(ndc.y) > 1.02) continue;
      const dist = eye.distanceTo(p);
      if (g.physics.lineBlocked(eye.x, eye.y, eye.z, p.x, p.y, p.z)) continue;
      // right in front of you, the torch's spill is enough (but in the dark she walks)
      if (dist < 1.4 && g.flashlight.level > 0.15) return true;
      if (g.flash > 0.3) return true;
      if (g.flashlight.illuminates(p, 18)) return true;
      for (const l of g.world.lights.lights) {
        if (l.intensity > 0.3 && l.position.distanceTo(p) < l.distance * 0.55) return true;
      }
    }
    return false;
  }

  /** Is her face near the centre of the player's view (and not behind a wall)? */
  faceInView(maxAngle = 0.2, maxDist = 14) {
    if (!this.root.visible) return false;
    const g = this.game;
    const eye = g.camera.position;
    const h = this.headWorld(_v);
    const d = _w.subVectors(h, eye);
    const dist = d.length();
    if (dist > maxDist) return false;
    d.normalize();
    const fwd = this._tmp;
    g.camera.getWorldDirection(fwd);
    if (fwd.dot(d) < Math.cos(maxAngle)) return false;
    return !g.physics.lineBlocked(eye.x, eye.y, eye.z, h.x, h.y, h.z);
  }

  distToPlayer() {
    const p = this.game.player.pos;
    return Math.hypot(p.x - this.root.position.x, p.z - this.root.position.z);
  }

  // ------------------------------------------------------------------ stalking
  buildNav() {
    const doors = this.game.world.doors;
    const solid = ['front', 'basement'].map((id) => doors[id]?.seg).filter(Boolean);
    this.nav = new NavGrid(this.game.physics, { minX: -8, maxX: 8, minZ: -12, maxZ: 0, y0: -0.3, y1: 0.4, cell: 0.25, radius: 0.28, solidSegs: solid });
  }

  startStalk(pos, { speed = 2.6 } = {}) {
    if (!this.nav) this.buildNav();
    this.show(pos, 0, pick(['stand', 'tilt', 'hang']), 'stalk');
    this.speed = speed;
    this.faceTowards(this.game.player.pos);
    this.path = null;
    this.repathT = 0;
    this.lastSeenT = this.game.time;
    // you can hear her breathing, wherever she is
    this.breathLoop(true);
  }

  /** Find a spot out of sight, about `dist` metres (walking) from the player. */
  relocateUnseen(minD = 6, maxD = 11) {
    if (!this.nav) this.buildNav();
    const p = this.game.player.pos;
    const eye = this.game.camera.position;
    for (let tries = 0; tries < 80; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(minD, maxD);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (!this.nav.walkableAt(x, z)) continue;
      const path = this.nav.path(x, z, p.x, p.z);
      const L = NavGrid.length(x, z, path);
      if (L < minD || L > maxD * 1.8) continue;
      // must not be visible from where the player stands
      const blocked = this.game.physics.lineBlocked(eye.x, eye.y, eye.z, x, 1.6, z);
      const fwd = this.game.camera.getWorldDirection(this._tmp);
      const behind = (x - p.x) * fwd.x + (z - p.z) * fwd.z < 0;
      if (!blocked && !behind) continue;
      this.root.position.set(x, 0, z);
      this.faceTowards(p);
      this.randomPose();
      this.path = null;
      return true;
    }
    return false;
  }

  updateStalk(dt) {
    const g = this.game;
    const obs = this.isObserved();
    this.observed = obs;
    const dist = this.distToPlayer();
    // her presence eats the torch
    const near = dist < 9 && !g.physics.lineBlocked(g.camera.position.x, g.camera.position.y, g.camera.position.z, this.root.position.x, 1.6, this.root.position.z);
    const flick = near ? clamp((9 - dist) / 7, 0, 1) : dist < 6 ? 0.25 : 0;
    g.flashlight.flicker = Math.max(g.flashlight.flicker, flick * this.flickerScale);
    g.tension = Math.max(g.tension, 0.55 + flick * 0.35);
    // in the dark between flickers, sometimes you see what's coming
    this.subT = (this.subT ?? 4) - dt;
    if (near && dist < 6 && g.flashlight.level < 0.15 && this.subT <= 0) {
      this.subT = rand(7, 14);
      g.story?.script?.spawn((s) => g.scares.subliminal(s, { dur: 0.05, strength: 0.75 }));
    }
    if (obs) {
      g.fearTarget = Math.max(g.fearTarget, clamp(1 - dist / 12, 0.2, 1));
      this.lastSeenT = g.time;
      if (this.wasMoving) {
        this.wasMoving = false;
        this.walking = 0;
        this.randomPose(this.poseName);
        this.faceTowards(g.player.pos);
        if (dist < 5) g.audio.sfx(pick(['floorCreak', 'floorCreak2']), { pos: this.headWorld(), vol: 0.6 });
      }
      return;
    }
    if (this.pauseT > 0) {
      this.pauseT -= dt;
      return;
    }
    if (g.debug.herFrozen) return;
    // move
    const p = g.player.pos;
    this.repathT -= dt;
    if (!this.path || this.repathT <= 0) {
      this.path = this.nav.path(this.root.position.x, this.root.position.z, p.x, p.z);
      this.repathT = 0.3;
    }
    if (!this.path || !this.path.length) return;
    if (!this.wasMoving) {
      this.wasMoving = true;
      this.setPose('lean', true);
    }
    let step = this.speed * dt;
    const pos = this.root.position;
    while (step > 0 && this.path.length) {
      const [tx, tz] = this.path[0];
      const dx = tx - pos.x;
      const dz = tz - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-3) {
        this.path.shift();
        continue;
      }
      const m = Math.min(step, d);
      // doors in the way get thrown open
      const door = this.doorBetween(pos.x, pos.z, pos.x + (dx / d) * (m + 0.5), pos.z + (dz / d) * (m + 0.5));
      if (door) {
        door.open('slam');
        g.onSlam?.(door.pivot.position);
        this.pauseT = 0.35;
        return;
      }
      pos.x += (dx / d) * m;
      pos.z += (dz / d) * m;
      step -= m;
      this.root.rotation.y = Math.atan2(dx, dz);
      if (m >= d - 1e-4) this.path.shift();
      this.stepAcc += m;
    }
    const gr = g.physics.groundAt(pos.x, pos.z, pos.y + 0.5, 0.6);
    if (gr) pos.y = gr.y;
    this.walking = 1;
    if (this.stepAcc > 0.55) {
      this.stepAcc = 0;
      g.audio.sfx(Math.random() < 0.5 ? 'herStep1' : 'herStep2', { pos: _v.set(pos.x, pos.y + 0.1, pos.z), vol: 0.8, rate: rand(0.9, 1.1), ref: 2 });
    }
    if (dist < this.catchDist && Math.abs(g.player.pos.y - pos.y) < 1.2) {
      this.mode = 'static';
      this.onCatch?.();
    }
  }

  doorBetween(ax, az, bx, bz) {
    for (const d of Object.values(this.game.world.doors)) {
      if (d.locked || d.angle > 1.0 || d.kind !== 'door' || !d.interactable) continue;
      const s = d.seg;
      const o = (x1, z1, x2, z2, x3, z3) => (x2 - x1) * (z3 - z1) - (z2 - z1) * (x3 - x1);
      const d1 = o(s.x1, s.z1, s.x2, s.z2, ax, az);
      const d2 = o(s.x1, s.z1, s.x2, s.z2, bx, bz);
      const d3 = o(ax, az, bx, bz, s.x1, s.z1);
      const d4 = o(ax, az, bx, bz, s.x2, s.z2);
      if (d1 * d2 < 0 && d3 * d4 < 0) return d;
    }
    return null;
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    if (this.mode === 'hidden') return;
    this.time += dt;
    const g = this.game;
    if (this.mode === 'stalk') this.updateStalk(dt);

    // pose blend
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt * this.blendSpeed);
      const t = this.blend * this.blend * (3 - 2 * this.blend);
      mixPose(this.pose, this.from, this.to, t);
    }
    const P = this.pose;
    const j = this.j;
    const set = (joint, r) => joint.rotation.set(r[0], r[1], r[2]);
    set(j.spine, P.spine);
    set(j.neck, P.neck);
    set(j.head, P.head);
    set(j.shL, P.shL);
    set(j.shR, P.shR);
    set(j.elL, P.elL);
    set(j.elR, P.elR);
    set(j.hipL, P.hipL);
    set(j.hipR, P.hipR);
    set(j.kneeL, P.kneeL);
    set(j.kneeR, P.kneeR);
    j.hips.position.y = 1.12 + P.y;
    for (const side of ['L', 'R']) {
      for (const f of j[`fingers${side}`]) {
        f.base.rotation.x = P.curl * 0.7;
        f.mid.rotation.x = P.curl * 1.1;
      }
    }
    // walk cycle overlay
    if (this.walking > 0.01) {
      this.walkPhase += dt * 7.5;
      const s = Math.sin(this.walkPhase) * this.walking;
      j.hipL.rotation.x += s * 0.5;
      j.hipR.rotation.x -= s * 0.5;
      j.kneeL.rotation.x += Math.max(0, -Math.cos(this.walkPhase)) * 0.8 * this.walking;
      j.kneeR.rotation.x += Math.max(0, Math.cos(this.walkPhase)) * 0.8 * this.walking;
      j.shL.rotation.x -= s * 0.25;
      j.shR.rotation.x += s * 0.25;
      j.hips.position.y += Math.abs(Math.cos(this.walkPhase)) * 0.04 * this.walking;
      j.neck.rotation.z += Math.sin(this.walkPhase * 0.5) * 0.15 * this.walking;
    }
    this.walking = damp(this.walking, 0, 6, dt);

    // head tracks the player (limited), always a little late
    if (this.headTrack > 0.01) {
      const eye = g.camera.position;
      this.root.updateMatrixWorld(true);
      const local = this.root.worldToLocal(_v.copy(eye));
      const yaw = clamp(Math.atan2(local.x, local.z), -1.3, 1.3);
      const pitch = clamp(-Math.atan2(local.y - 2.1, Math.hypot(local.x, local.z)), -0.6, 0.6);
      this.trackYaw = damp(this.trackYaw, yaw, 4, dt);
      this.trackPitch = damp(this.trackPitch, pitch, 4, dt);
      j.neck.rotation.y += this.trackYaw * 0.5 * this.headTrack;
      j.head.rotation.y += this.trackYaw * 0.5 * this.headTrack;
      j.head.rotation.x += this.trackPitch * this.headTrack;
    }

    // twitches: sudden wrong little jerks
    this.twitchT -= dt;
    if (this.twitchT <= 0) {
      this.twitchT = rand(0.8, 3.5);
      this.twitch = { t: rand(0.06, 0.18), z: rand(-0.6, 0.6), x: rand(-0.3, 0.3), arm: Math.random() < 0.4 };
    }
    if (this.twitch) {
      this.twitch.t -= dt;
      j.head.rotation.z += this.twitch.z;
      j.neck.rotation.x += this.twitch.x;
      if (this.twitch.arm) j.elR.rotation.x -= 0.4;
      if (this.twitch.t <= 0) this.twitch = null;
    }

    // hair: part + sway
    const part = P.part;
    this.hair.left.rotation.y = -part * 0.95;
    this.hair.right.rotation.y = part * 0.95;
    this.hair.left.rotation.z = -part * 0.25 + Math.sin(this.time * 1.3) * 0.02;
    this.hair.right.rotation.z = part * 0.25 + Math.sin(this.time * 1.1 + 1) * 0.02;

    // jaw
    this.jaw = damp(this.jaw, this.jawTarget, 18, dt);
    this.headMesh.morphTargetInfluences[0] = this.jaw;

    // breath follows the head; louder when close
    if (this.breath) {
      this.breath.setPos(this.headWorld(_v));
      const d = this.distToPlayer();
      this.breath.gain.gain.value = clamp(1.2 - d / 6, 0, 1) * 0.9;
    }
  }
}
