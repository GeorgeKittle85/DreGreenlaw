/**
 * Grid navigation over one "band" of floor height (e.g. the ground floor).
 * A cell is walkable if there is floor inside the band and nothing solid at body
 * height within `radius`. Door segments are ignored (the thing opens doors;
 * the autopilot opens them too) unless listed in `solidSegs`.
 */
export class NavGrid {
  constructor(physics, o) {
    this.physics = physics;
    this.minX = o.minX;
    this.minZ = o.minZ;
    this.cell = o.cell ?? 0.25;
    this.w = Math.ceil((o.maxX - o.minX) / this.cell);
    this.h = Math.ceil((o.maxZ - o.minZ) / this.cell);
    this.y0 = o.y0;
    this.y1 = o.y1;
    this.radius = o.radius ?? 0.3;
    this.solidSegs = o.solidSegs || [];
    this.blocked = new Uint8Array(this.w * this.h);
    this.floorY = new Float32Array(this.w * this.h);
    this.build();
  }

  build() {
    const p = this.physics;
    const r = this.radius;
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const x = this.minX + (i + 0.5) * this.cell;
        const z = this.minZ + (j + 0.5) * this.cell;
        const idx = j * this.w + i;
        const g = p.groundAt(x, z, this.y1, 0);
        if (!g || g.y < this.y0) {
          this.blocked[idx] = 1;
          continue;
        }
        this.floorY[idx] = g.y;
        const b0 = g.y + 0.42;
        const b1 = g.y + 1.7;
        let hit = false;
        for (const b of p.boxes) {
          if (!b.enabled || !b.solid) continue;
          if (b.maxY <= b0 || b.minY >= b1) continue;
          if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r) continue;
          const cx = Math.max(b.minX, Math.min(x, b.maxX));
          const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
          if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) {
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const s of this.solidSegs) {
            const ex = s.x2 - s.x1;
            const ez = s.z2 - s.z1;
            const l2 = ex * ex + ez * ez || 1e-9;
            let t = ((x - s.x1) * ex + (z - s.z1) * ez) / l2;
            t = Math.max(0, Math.min(1, t));
            const dx = x - (s.x1 + ex * t);
            const dz = z - (s.z1 + ez * t);
            if (dx * dx + dz * dz < (r + s.radius) ** 2) {
              hit = true;
              break;
            }
          }
        }
        this.blocked[idx] = hit ? 1 : 0;
      }
    }
  }

  cellOf(x, z) {
    return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)];
  }

  center(i, j) {
    return [this.minX + (i + 0.5) * this.cell, this.minZ + (j + 0.5) * this.cell];
  }

  inside(i, j) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h;
  }

  walkable(i, j) {
    return this.inside(i, j) && !this.blocked[j * this.w + i];
  }

  walkableAt(x, z) {
    const [i, j] = this.cellOf(x, z);
    return this.walkable(i, j);
  }

  nearestWalkable(i, j, maxR = 8) {
    if (this.walkable(i, j)) return [i, j];
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
          if (this.walkable(i + di, j + dj)) return [i + di, j + dj];
        }
      }
    }
    return null;
  }

  /** Straight grid line of sight (Bresenham over walkable cells). */
  clear(a, b) {
    let [x0, y0] = a;
    const [x1, y1] = b;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!this.walkable(x0, y0)) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** A* from world point a to b. Returns array of [x,z] waypoints (excluding start) or null. */
  path(ax, az, bx, bz) {
    let s = this.nearestWalkable(...this.cellOf(ax, az));
    let t = this.nearestWalkable(...this.cellOf(bx, bz));
    if (!s || !t) return null;
    const W = this.w;
    const N = this.w * this.h;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new Heap();
    const si = s[1] * W + s[0];
    const ti = t[1] * W + t[0];
    g[si] = 0;
    const hfn = (i) => {
      const x = i % W;
      const y = (i / W) | 0;
      const dx = Math.abs(x - t[0]);
      const dy = Math.abs(y - t[1]);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    heap.push(si, hfn(si));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false;
    let iter = 0;
    while (heap.size && iter++ < 60000) {
      const cur = heap.pop();
      if (cur === ti) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W;
      const cy = (cur / W) | 0;
      for (const [dx, dy, cost] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.walkable(nx, ny)) continue;
        if (dx && dy && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        const ng = g[cur] + cost;
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          heap.push(ni, ng + hfn(ni));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = ti; c !== -1; c = came[c]) cells.push([c % W, (c / W) | 0]);
    cells.reverse();
    // string-pull: keep only corners we can't see past
    const out = [];
    let anchor = cells[0];
    for (let i = 1; i < cells.length; i++) {
      if (!this.clear(anchor, cells[i])) {
        anchor = cells[i - 1];
        out.push(this.center(...anchor));
      }
    }
    out.push([bx, bz]);
    return out;
  }

  /** Path length helper. */
  static length(ax, az, pts) {
    if (!pts) return Infinity;
    let L = 0;
    let px = ax;
    let pz = az;
    for (const [x, z] of pts) {
      L += Math.hypot(x - px, z - pz);
      px = x;
      pz = z;
    }
    return L;
  }
}

class Heap {
  constructor() {
    this.items = [];
    this.pri = [];
  }
  get size() {
    return this.items.length;
  }
  push(item, p) {
    const a = this.items;
    const q = this.pri;
    a.push(item);
    q.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (q[par] <= q[i]) break;
      [a[par], a[i]] = [a[i], a[par]];
      [q[par], q[i]] = [q[i], q[par]];
      i = par;
    }
  }
  pop() {
    const a = this.items;
    const q = this.pri;
    const top = a[0];
    const lastI = a.pop();
    const lastP = q.pop();
    if (a.length) {
      a[0] = lastI;
      q[0] = lastP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && q[l] < q[m]) m = l;
        if (r < a.length && q[r] < q[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [q[m], q[i]] = [q[i], q[m]];
        i = m;
      }
    }
    return top;
  }
}
