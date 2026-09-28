import * as THREE from 'three';
import { clamp, wobble } from '../core/util.js';

/**
 * Practical lights (bulbs, lamps, candles) are "fixtures"; a small fixed pool of
 * PointLights is assigned each frame to the fixtures that matter most to the
 * player. A constant light count means shaders never recompile when lights
 * turn on and off.
 */
export class LightPool {
  constructor(scene, count = 6) {
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffd9a0, 0, 6, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    this.fixtures = [];
    this.power = true;
    this.surge = 0;
    this.tint = new THREE.Color(1, 1, 1);
    this.time = 0;
    this._tmp = new THREE.Color();
  }

  /**
   * f: { pos: Vector3, color, intensity, range, on, flicker (0..1), zone, power (true = needs mains),
   *      shade, bulb (meshes whose emissive follows the light), kind }
   */
  add(f) {
    const fx = {
      pos: f.pos.clone(),
      color: new THREE.Color(f.color ?? 0xffc98a),
      intensity: f.intensity ?? 2.5,
      range: f.range ?? 6,
      on: f.on ?? true,
      flicker: f.flicker ?? 0,
      zone: f.zone || null,
      power: f.power ?? true,
      kind: f.kind || 'bulb',
      level: 0,
      seed: Math.random() * 100,
      override: null,
      meshes: [],
      baseEmissive: [],
    };
    for (const m of [f.shade, f.bulb, ...(f.meshes || [])]) {
      if (!m) continue;
      m.material = m.material.clone();
      fx.meshes.push(m);
      fx.baseEmissive.push(m.material.emissiveIntensity ?? 1);
    }
    this.fixtures.push(fx);
    return fx;
  }

  level(fx) {
    if (fx.override !== null) return fx.override;
    if (!fx.on) return 0;
    if (fx.power && !this.power) return 0;
    let v = 1;
    const t = this.time;
    if (fx.kind === 'candle') {
      v = 0.8 + 0.12 * wobble(t * 3.1, fx.seed) + 0.08 * Math.sin(t * 23 + fx.seed);
    }
    if (fx.flicker > 0) {
      const n = wobble(t * 2.3, fx.seed);
      if (n > 1 - fx.flicker * 0.9) v *= 0.05 + 0.3 * Math.random();
      else v *= 1 - fx.flicker * 0.25 * Math.random();
    }
    if (this.surge > 0 && fx.kind !== 'candle') {
      v *= Math.random() < this.surge ? 0.05 + Math.random() * 0.2 : 1;
    }
    return clamp(v, 0, 1.5);
  }

  update(dt, camPos, zone) {
    this.time += dt;
    const scored = [];
    for (const fx of this.fixtures) {
      fx.level = this.level(fx);
      for (let i = 0; i < fx.meshes.length; i++) {
        const m = fx.meshes[i].material;
        if ('emissiveIntensity' in m) m.emissiveIntensity = fx.baseEmissive[i] * fx.level * (fx.meshes[i].userData.isShade ? 1 : 1);
      }
      if (fx.level <= 0.001) continue;
      const d2 = fx.pos.distanceToSquared(camPos);
      if (d2 > (fx.range + 26) * (fx.range + 26)) continue;
      const zoneBoost = zone && fx.zone === zone ? 4 : 1;
      scored.push({ fx, s: (fx.intensity * fx.level * zoneBoost) / (1 + d2) });
    }
    scored.sort((a, b) => b.s - a.s);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const e = scored[i];
      if (!e) {
        l.intensity = 0;
        continue;
      }
      l.position.copy(e.fx.pos);
      l.color.copy(e.fx.color).multiply(this.tint);
      l.intensity = e.fx.intensity * e.fx.level;
      l.distance = e.fx.range;
    }
  }
}
