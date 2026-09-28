import * as THREE from 'three';
import { NavGrid } from '../game/nav.js';
import { wrapAngle } from '../core/util.js';

/**
 * Test-only: walks the real player (real input, real collisions, real doors)
 * to a target using A* over the collision world. Used by tests/playthrough.mjs
 * to prove that every objective is physically reachable.
 */
export class Autopilot {
  constructor(game) {
    this.game = game;
    this.route = null;
    this.status = 'idle';
    this.holdPitch = null;
    this.stuckT = 0;
    this.lastPos = new THREE.Vector3();
    this.log = [];
    game.hooks.push(this);
  }

  grid(level) {
    const phys = this.game.physics;
    const specs = {
      ground: { minX: -16, maxX: 16, minZ: -12.5, maxZ: 34, y0: -0.8, y1: 0.35 },
      upper: { minX: -8, maxX: 8, minZ: -12, maxZ: 0, y0: 2.8, y1: 3.25 },
      basement: { minX: -7, maxX: 7, minZ: -24, maxZ: -9, y0: -3.6, y1: -3.2 },
      loopShort: { minX: 197, maxX: 211, minZ: -14, maxZ: 2, y0: -0.2, y1: 0.3 },
      loopLong: { minX: 257, maxX: 271, minZ: -26, maxZ: 2, y0: -0.2, y1: 0.3 },
    };
    // open doors are furniture; closed ones get opened on the way
    const open = Object.values(this.game.world.doors).filter((d) => !d.moving && d.angle > 1.2).map((d) => d.seg);
    return new NavGrid(phys, { ...specs[level], cell: 0.2, radius: 0.28, solidSegs: open });
  }

  levelOf(p) {
    if (p.x > 230) return 'loopLong';
    if (p.x > 150) return 'loopShort';
    if (p.y > 2.2) return 'upper';
    if (p.y < -1.5) return 'basement';
    return 'ground';
  }

  /** Plan a route of [x, z] waypoints (with level changes via the stairs). */
  plan(target) {
    const p = this.game.player.pos;
    const from = this.levelOf(p);
    const to = this.levelOf(target);
    const legs = [];
    const connectors = {
      'ground>upper': [[0.9, -1.5], [0.9, -7.2]],
      'upper>ground': [[0.9, -7.2], [0.9, -1.4]],
      'ground>basement': [[0, -8.5], [0, -13.9]],
      'basement>ground': [[0, -13.9], [0, -8.5]],
    };
    const pathOn = (level, ax, az, bx, bz) => {
      const g = this.grid(level);
      const pts = g.path(ax, az, bx, bz);
      if (!pts) throw new Error(`no path on ${level} from (${ax.toFixed(1)},${az.toFixed(1)}) to (${bx.toFixed(1)},${bz.toFixed(1)})`);
      return pts;
    };
    if (from === to) {
      legs.push(...pathOn(from, p.x, p.z, target.x, target.z));
    } else {
      const key = `${from}>${to}`;
      const c = connectors[key];
      if (!c) throw new Error(`no connector ${key}`);
      legs.push(...pathOn(from, p.x, p.z, c[0][0], c[0][1]));
      legs.push(c[1]);
      legs.push(...pathOn(to, c[1][0], c[1][1], target.x, target.z));
    }
    return legs;
  }

  goTo(x, y, z, { tol = 0.35, timeout = 90, pitch = null } = {}) {
    const target = new THREE.Vector3(x, y, z);
    this.route = this.plan(target);
    this.tol = tol;
    this.status = 'walking';
    this.holdPitch = pitch;
    this.t = 0;
    this.timeout = timeout;
    this.stuckT = 0;
    this.replans = 0;
    this.lastPos.copy(this.game.player.pos);
    this.goal = target;
    return this.route.length;
  }

  stop() {
    this.route = null;
    this.status = 'idle';
    this.game.input.virtual = null;
  }

  preUpdate(dt) {
    const g = this.game;
    if (this.status !== 'walking' || !this.route) return;
    this.t += dt;
    const p = g.player.pos;
    if (!g.player.canMove) {
      g.input.virtual = { x: 0, y: 0 };
      return;
    }
    let wp = this.route[0];
    while (wp && Math.hypot(wp[0] - p.x, wp[1] - p.z) < (this.route.length === 1 ? this.tol : 0.3)) {
      this.route.shift();
      wp = this.route[0];
    }
    if (!wp) {
      this.status = 'arrived';
      g.input.virtual = { x: 0, y: 0 };
      return;
    }
    const dx = wp[0] - p.x;
    const dz = wp[1] - p.z;
    const yaw = Math.atan2(-dx, -dz);
    g.player.yaw += wrapAngle(yaw - g.player.yaw) * Math.min(1, dt * 12);
    if (this.holdPitch !== null) g.player.pitch = this.holdPitch;
    else g.player.pitch *= 0.9;
    const facing = Math.abs(wrapAngle(yaw - g.player.yaw)) < 0.6;
    g.input.virtual = { x: 0, y: facing ? 1 : 0.2 };
    // open closed doors that are in the way, like a person would
    for (const d of Object.values(g.world.doors)) {
      if (!d.interactable || d.locked || d.angle > 1.2 || d.target > 1.2) continue;
      const hx = (d.seg.x1 + d.seg.x2) / 2;
      const hz = (d.seg.z1 + d.seg.z2) / 2;
      if (Math.hypot(hx - p.x, hz - p.z) < 1.3 && Math.abs(d.pivot.position.y - p.y) < 1.5) {
        const ahead = (hx - p.x) * dx + (hz - p.z) * dz > 0;
        if (ahead) d.open();
      }
    }
    // stuck?
    if (p.distanceTo(this.lastPos) > 0.25) {
      this.lastPos.copy(p);
      this.stuckT = 0;
    } else this.stuckT += dt;
    if (this.stuckT > 1.5 && this.replans < 4) {
      // something moved (a door swung, she stepped in the way): look again
      this.replans++;
      this.stuckT = 0;
      try {
        this.route = this.plan(this.goal);
      } catch (e) {
        /* keep the old route */
      }
    }
    if (this.stuckT > 6 || this.t > this.timeout) {
      this.status = this.stuckT > 6 ? 'stuck' : 'timeout';
      this.log.push(`${this.status} at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} heading to ${wp[0].toFixed(2)},${wp[1].toFixed(2)}`);
      g.input.virtual = null;
    }
  }
}
