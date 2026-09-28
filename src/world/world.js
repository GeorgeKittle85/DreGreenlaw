import * as THREE from 'three';
import { LightPool } from './lights.js';

/** Registry of everything the story scripts need to reach by name. */
export class World {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.doors = {};
    this.anchors = {};
    this.triggers = {};
    this.items = {};
    this.props = {};
    this.decals = {};
    this.fixtures = {};
    this.windows = [];
    this.zones = [];
    this.updaters = [];
    this.lights = new LightPool(game.scene, 6);
  }

  anchor(name, x, y, z, yaw = 0) {
    this.anchors[name] = { pos: new THREE.Vector3(x, y, z), yaw };
  }

  trigger(name, x0, y0, z0, x1, y1, z1) {
    this.triggers[name] = {
      minX: Math.min(x0, x1), maxX: Math.max(x0, x1),
      minY: Math.min(y0, y1), maxY: Math.max(y0, y1),
      minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1),
    };
  }

  in(name, p) {
    const t = this.triggers[name];
    if (!t) return false;
    return p.x >= t.minX && p.x <= t.maxX && p.y >= t.minY && p.y <= t.maxY && p.z >= t.minZ && p.z <= t.maxZ;
  }

  /** Zones are matched most-specific first: `priority` breaks ties (the yard is the fallback). */
  zone(name, area, x0, y0, z0, x1, y1, z1, priority = 0) {
    this.zones.push({ name, area, priority, minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minY: Math.min(y0, y1), maxY: Math.max(y0, y1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
    this.zones.sort((a, b) => b.priority - a.priority);
  }

  zoneAt(p) {
    for (const z of this.zones) {
      if (p.x >= z.minX && p.x <= z.maxX && p.y >= z.minY && p.y <= z.maxY && p.z >= z.minZ && p.z <= z.maxZ) return z;
    }
    return null;
  }

  update(dt) {
    for (const d of Object.values(this.doors)) d.update(dt);
    for (const u of this.updaters) u(dt);
  }
}
