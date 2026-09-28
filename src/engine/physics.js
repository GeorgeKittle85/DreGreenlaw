/**
 * Tiny, purpose-built collision world. Everything in the house is axis-aligned,
 * so the player is a vertical capsule approximated by a circle in XZ that
 * collides against AABBs (walls, furniture) and swinging door segments.
 * Floors are rectangles (flat or ramps for stairs); the ground under the player
 * is the highest floor that is not above their knees.
 */
export class Physics {
  constructor() {
    this.boxes = [];
    this.segs = [];
    this.floors = [];
  }

  addBox(minX, minY, minZ, maxX, maxY, maxZ, opts = {}) {
    const b = {
      minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX),
      minY: Math.min(minY, maxY), maxY: Math.max(minY, maxY),
      minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ),
      solid: opts.solid !== false,
      occlude: opts.occlude !== false,
      enabled: opts.enabled !== false,
      tag: opts.tag || null,
    };
    this.boxes.push(b);
    return b;
  }

  /** A thick line segment in XZ (door panels). Mutate x1..z2 to move it. */
  addSeg(x1, z1, x2, z2, minY, maxY, radius = 0.04, opts = {}) {
    const s = { x1, z1, x2, z2, minY, maxY, radius, enabled: true, occlude: !!opts.occlude, tag: opts.tag || null };
    this.segs.push(s);
    return s;
  }

  /**
   * Flat floor: { minX, maxX, minZ, maxZ, y }
   * Ramp:       add ramp: { axis: 'x'|'z', a, b, ya, yb } — height ya at coord a, yb at coord b.
   */
  addFloor(minX, minZ, maxX, maxZ, y, surface = 'wood', ramp = null) {
    const f = {
      minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ),
      y, surface, ramp, enabled: true,
    };
    this.floors.push(f);
    return f;
  }

  floorHeight(f, x, z) {
    if (!f.ramp) return f.y;
    const r = f.ramp;
    const c = r.axis === 'x' ? x : z;
    let t = (c - r.a) / (r.b - r.a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return r.ya + (r.yb - r.ya) * t;
  }

  /** Highest walkable floor at (x,z) that isn't more than maxStep above feetY. */
  groundAt(x, z, feetY, maxStep = 0.55) {
    let best = null;
    let bestY = -Infinity;
    for (const f of this.floors) {
      if (!f.enabled) continue;
      if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;
      const y = this.floorHeight(f, x, z);
      if (y <= feetY + maxStep && y > bestY) {
        bestY = y;
        best = f;
      }
    }
    return best ? { y: bestY, surface: best.surface } : null;
  }

  /**
   * Push a circle (center pos.x/pos.z, radius r) out of every solid collider
   * overlapping the vertical span [y0, y1]. Mutates pos.
   */
  collide(pos, r, y0, y1) {
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const b of this.boxes) {
        if (!b.enabled || !b.solid) continue;
        if (b.maxY <= y0 || b.minY >= y1) continue;
        if (pos.x < b.minX - r || pos.x > b.maxX + r || pos.z < b.minZ - r || pos.z > b.maxZ + r) continue;
        const cx = pos.x < b.minX ? b.minX : pos.x > b.maxX ? b.maxX : pos.x;
        const cz = pos.z < b.minZ ? b.minZ : pos.z > b.maxZ ? b.maxZ : pos.z;
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > 1e-10) {
          if (d2 < r * r) {
            const d = Math.sqrt(d2);
            const push = r - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
            moved = true;
          }
        } else {
          // Center inside the box: leave along the axis of least penetration.
          const pl = pos.x - b.minX + r;
          const pr = b.maxX - pos.x + r;
          const pb = pos.z - b.minZ + r;
          const pf = b.maxZ - pos.z + r;
          const m = Math.min(pl, pr, pb, pf);
          if (m === pl) pos.x = b.minX - r;
          else if (m === pr) pos.x = b.maxX + r;
          else if (m === pb) pos.z = b.minZ - r;
          else pos.z = b.maxZ + r;
          moved = true;
        }
      }
      for (const s of this.segs) {
        if (!s.enabled) continue;
        if (s.maxY <= y0 || s.minY >= y1) continue;
        const rr = r + s.radius;
        const ex = s.x2 - s.x1;
        const ez = s.z2 - s.z1;
        const len2 = ex * ex + ez * ez || 1e-9;
        let t = ((pos.x - s.x1) * ex + (pos.z - s.z1) * ez) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = s.x1 + ex * t;
        const cz = s.z1 + ez * t;
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 1e-5;
          const nx = d2 > 1e-10 ? dx / d : -ez / Math.sqrt(len2);
          const nz = d2 > 1e-10 ? dz / d : ex / Math.sqrt(len2);
          pos.x = cx + nx * rr;
          pos.z = cz + nz * rr;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  /** Is the straight line a→b blocked by an occluder? (walls, closed doors, big furniture) */
  lineBlocked(ax, ay, az, bx, by, bz, ignoreTag = null) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    for (const b of this.boxes) {
      if (!b.enabled || !b.occlude) continue;
      if (ignoreTag && b.tag === ignoreTag) continue;
      if (segBox(ax, ay, az, dx, dy, dz, b) < 1) return true;
    }
    for (const s of this.segs) {
      if (!s.enabled || !s.occlude) continue;
      if (segSeg2D(ax, az, bx, bz, s)) {
        // approximate vertical test at the crossing
        const t = crossT(ax, az, bx, bz, s);
        const y = ay + dy * t;
        if (y > s.minY && y < s.maxY) return true;
      }
    }
    return false;
  }

  /** Distance along a ray to the first occluding box, or Infinity. */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = Infinity;
    let hit = null;
    const ex = dx * maxDist;
    const ey = dy * maxDist;
    const ez = dz * maxDist;
    for (const b of this.boxes) {
      if (!b.enabled || !b.occlude) continue;
      const t = segBox(ox, oy, oz, ex, ey, ez, b);
      if (t < 1 && t * maxDist < best) {
        best = t * maxDist;
        hit = b;
      }
    }
    for (const s of this.segs) {
      if (!s.enabled || !s.occlude) continue;
      const bx = ox + ex;
      const bz = oz + ez;
      if (segSeg2D(ox, oz, bx, bz, s)) {
        const t = crossT(ox, oz, bx, bz, s);
        const y = oy + ey * t;
        if (y > s.minY && y < s.maxY && t * maxDist < best) {
          best = t * maxDist;
          hit = s;
        }
      }
    }
    return { dist: best, hit };
  }
}

// Slab test: returns parametric t in [0,1] of the first hit, or 2 if none.
function segBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = 0;
  let tmax = 1;
  // X
  if (Math.abs(dx) < 1e-9) {
    if (ox < b.minX || ox > b.maxX) return 2;
  } else {
    let t1 = (b.minX - ox) / dx;
    let t2 = (b.maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return 2;
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < b.minY || oy > b.maxY) return 2;
  } else {
    let t1 = (b.minY - oy) / dy;
    let t2 = (b.maxY - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return 2;
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < b.minZ || oz > b.maxZ) return 2;
  } else {
    let t1 = (b.minZ - oz) / dz;
    let t2 = (b.maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return 2;
  }
  return tmin;
}

function segSeg2D(ax, az, bx, bz, s) {
  const d1 = orient(s.x1, s.z1, s.x2, s.z2, ax, az);
  const d2 = orient(s.x1, s.z1, s.x2, s.z2, bx, bz);
  const d3 = orient(ax, az, bx, bz, s.x1, s.z1);
  const d4 = orient(ax, az, bx, bz, s.x2, s.z2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function crossT(ax, az, bx, bz, s) {
  const rx = bx - ax;
  const rz = bz - az;
  const sx = s.x2 - s.x1;
  const sz = s.z2 - s.z1;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return 0;
  return ((s.x1 - ax) * sz - (s.z1 - az) * sx) / den;
}

function orient(ax, az, bx, bz, cx, cz) {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}
