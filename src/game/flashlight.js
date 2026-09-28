import * as THREE from 'three';
import { damp } from '../core/util.js';

/** A hand-held torch that lags a little behind your gaze and casts real shadows. */
export class Flashlight {
  constructor(game) {
    this.game = game;
    const spot = new THREE.SpotLight(0xfff0d8, 0, 24, 0.47, 0.55, 1.6);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0006;
    spot.shadow.normalBias = 0.025;
    spot.shadow.camera.near = 0.12;
    spot.shadow.camera.far = 24;
    spot.map = game.mats.flashCookie;
    game.scene.add(spot, spot.target);
    this.spot = spot;
    // faint bounce light around you so the dark isn't a flat void
    this.fill = new THREE.PointLight(0xffe6c8, 0, 4.5, 2);
    game.scene.add(this.fill);
    this.on = true;
    this.power = 1;
    this.base = 38;
    this.flicker = 0; // 0..1 chance-ish of dropping out this frame
    this.forcedOff = 0; // seconds of forced darkness
    this.level = 1;
    this.dir = new THREE.Vector3(0, 0, -1);
    this.pos = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._tmp = new THREE.Vector3();
    this.dropT = 0;
    this.enabled = true;
  }

  toggle() {
    if (!this.enabled) return;
    this.on = !this.on;
    this.game.audio.sfx('click', { vol: 0.35 });
  }

  /** Kill the light for `sec` seconds (scripted). */
  blackout(sec) {
    this.forcedOff = Math.max(this.forcedOff, sec);
  }

  get lit() {
    return this.level > 0.15;
  }

  update(dt) {
    const cam = this.game.camera;
    const target = cam.getWorldDirection(this._tmp);
    // lag behind the view a touch; faster when turning hard so it never loses you
    const k = 1 - Math.exp(-14 * dt);
    this.dir.lerp(target, k).normalize();
    const right = new THREE.Vector3().crossVectors(this.dir, cam.up).normalize();
    this.pos.copy(cam.position).addScaledVector(right, 0.17).add(new THREE.Vector3(0, -0.2, 0)).addScaledVector(this.dir, 0.08);
    this.spot.position.copy(this.pos);
    this.spot.target.position.copy(this.pos).addScaledVector(this.dir, 6);
    this.spot.target.updateMatrixWorld();

    // level: on/off, scripted blackouts, flicker
    let lv = this.on && this.enabled ? this.power : 0;
    if (this.forcedOff > 0) {
      this.forcedOff -= dt;
      lv = 0;
    }
    if (lv > 0 && this.flicker > 0) {
      if (this.dropT > 0) {
        this.dropT -= dt;
        lv *= 0.02;
      } else if (Math.random() < this.flicker * dt * 4.5) {
        this.dropT = 0.04 + Math.random() * 0.12;
      } else lv *= 0.75 + Math.random() * 0.25 * (1 - this.flicker);
    }
    this.level = damp(this.level, lv, lv < this.level ? 60 : 30, dt);
    this.spot.intensity = this.base * this.level;
    this.fill.intensity = 0.55 * this.level;
    this.fill.position.copy(cam.position).addScaledVector(this.dir, 1.2);
  }

  /** Is world point p inside the beam (and close enough to be seen)? */
  illuminates(p, maxDist = 16) {
    if (this.level < 0.15) return false;
    const d = this._tmp.subVectors(p, this.pos);
    const len = d.length();
    if (len > maxDist) return false;
    const cos = d.dot(this.dir) / Math.max(len, 1e-4);
    return cos > Math.cos(this.spot.angle * 1.08);
  }
}
