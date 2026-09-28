import * as THREE from 'three';
import { rand } from '../core/util.js';

const _v = new THREE.Vector3();

/**
 * The loud parts. Every function takes the running Script `s` so a scare dies
 * cleanly with the chapter if the player restarts mid-scream.
 */
export class Scares {
  constructor(game) {
    this.game = game;
    this.busy = false;
  }

  /** A face flashed for a couple of frames. Barely there. */
  async subliminal(s, { dur = 0.07, strength = 0.9, scream = false, zoom = 0.85 } = {}) {
    const g = this.game;
    g.renderer.uniforms.tFace.value = scream ? g.mats.faceFrameScreamTex : g.mats.faceFrameTex;
    g.renderer.uniforms.uFaceZoom.value = zoom;
    g.fx.face = strength;
    g.kick('static', 0.25);
    g.audio.sfx('static', { vol: 0.25, rate: 1.4 });
    await s.wait(dur);
    g.fx.face = 0;
  }

  /**
   * She is suddenly in your face, screaming. `fatal` leaves the screen black for
   * the death sequence; otherwise the world comes back and she's gone.
   */
  async lunge(s, { fatal = false, hold = 0.95, level = 1, from = null } = {}) {
    const g = this.game;
    const her = g.entity;
    const p = g.player;
    this.busy = true;
    const prevMove = p.canMove;
    const prevLook = p.canLook;
    p.canMove = false;
    p.canLook = false;
    p.lookAt = null;
    // if she's somewhere visible, snap the view to her first
    if (from) {
      p.forceLook(from, 30);
      await s.wait(0.08);
      p.forceLook(null);
    }
    const cam = g.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    fwd.y = Math.max(-0.3, Math.min(0.3, fwd.y));
    fwd.normalize();
    const place = (d) => {
      const head = _v.copy(cam.position).addScaledVector(fwd, d);
      her.root.position.set(head.x, 0, head.z);
      her.root.rotation.y = Math.atan2(-fwd.x, -fwd.z);
      her.root.updateMatrixWorld(true);
      const hw = her.headWorld(new THREE.Vector3());
      her.root.position.y += head.y - hw.y + (d < 0.6 ? 0.02 : 0);
    };
    her.show(cam.position, 0, 'lunge', 'script');
    her.setFace('scream');
    her.jawTarget = 1;
    her.headTrack = 0;
    her.update(0);
    g.flashlight.forcedOff = 0;
    g.flashlight.on = true;
    g.flashlight.level = 1;
    place(1.5);
    g.audio.scare({ level, pos: her.headWorld() });
    g.scareFx(level);
    g.kick('whiteFlash', 0.25 * level);
    const t0 = g.time;
    while (g.time - t0 < 0.16) {
      const k = (g.time - t0) / 0.16;
      place(1.5 - k * 1.15);
      await s.wait(0);
    }
    place(0.36);
    const t1 = g.time;
    while (g.time - t1 < hold) {
      p.shake(0.25);
      g.kick('static', Math.random() < 0.3 ? 0.5 : 0.1);
      g.kick('aberration', 1.8);
      g.kick('distort', 0.9);
      g.kick('red', 0.25);
      if (Math.random() < 0.15) g.flashlight.blackout(0.04);
      her.root.position.x += (Math.random() - 0.5) * 0.02;
      await s.wait(0);
    }
    g.fadeTo(1, 0);
    g.audio.duck(2.5);
    g.audio.sfx('ringing', { vol: 0.25 });
    her.hide();
    her.setFace('idle');
    her.jawTarget = 0;
    her.jaw = 0;
    this.busy = false;
    if (fatal) return;
    await s.wait(0.6);
    p.canMove = prevMove;
    p.canLook = prevLook;
    g.fadeTo(0, 1.2);
  }

  /** The full-frame painted face (used when you least expect it). It shows through a blackout. */
  async screenFace(s, { dur = 1.35, level = 1 } = {}) {
    const g = this.game;
    const u = g.renderer.uniforms;
    u.tFace.value = g.mats.faceFrameScreamTex;
    g.audio.scare({ level });
    g.scareFx(level);
    const t0 = g.time;
    while (g.time - t0 < dur) {
      const k = (g.time - t0) / dur;
      u.uFaceZoom.value = 0.55 + k * 0.7 + Math.random() * 0.04;
      g.fx.face = 1;
      g.kick('static', Math.random() < 0.25 ? 0.4 : 0.05);
      g.kick('distort', 1);
      g.kick('red', 0.3);
      await s.wait(0);
    }
    g.fx.face = 0;
    g.fadeTo(1, 0);
    g.audio.duck(3);
  }

  /** Lightning shows her somewhere, just for the length of the flash. */
  async reveal(s, pos, yaw, pose = 'stand', { near = true, hold = 0.35, sting = true } = {}) {
    const g = this.game;
    g.entity.show(pos, yaw, pose, 'static');
    g.lightning({ near });
    if (sting) {
      g.audio.sfx('stinger', { vol: 0.7, delay: 0.05 });
      g.audio.sfx('screech', { vol: 0.3, delay: 0.05 });
      g.scareFx(0.7);
    }
    await s.wait(hold);
    g.entity.hide();
  }

  /** Flicker the torch in a few quick stutters. */
  async stutter(s, n = 3) {
    const g = this.game;
    for (let i = 0; i < n; i++) {
      g.flashlight.blackout(rand(0.05, 0.14));
      g.audio.sfx('click', { vol: 0.15, rate: rand(0.8, 1.2) });
      await s.wait(rand(0.1, 0.25));
    }
  }
}
