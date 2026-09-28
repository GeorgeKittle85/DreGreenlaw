import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FACE_PX = 1;
const FACE_NX = 2;
const FACE_PY = 4;
const FACE_NY = 8;
const FACE_PZ = 16;
const FACE_NZ = 32;
export const FACES = { PX: FACE_PX, NX: FACE_NX, PY: FACE_PY, NY: FACE_NY, PZ: FACE_PZ, NZ: FACE_NZ, ALL: 63 };

/** Axis-aligned box with world-space UVs (1 repeat = `s` metres). */
export function boxGeom(x0, y0, z0, x1, y1, z1, s = 1, faces = 63) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const face = (corners, n, uvf) => {
    const b = pos.length / 3;
    for (const c of corners) {
      pos.push(c[0], c[1], c[2]);
      nor.push(n[0], n[1], n[2]);
      const [u, v] = uvf(c);
      uv.push(u / s, v / s);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  if (faces & FACE_PX) face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], (c) => [-c[2], c[1]]);
  if (faces & FACE_NX) face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], (c) => [c[2], c[1]]);
  if (faces & FACE_PZ) face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], (c) => [c[0], c[1]]);
  if (faces & FACE_NZ) face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], (c) => [-c[0], c[1]]);
  if (faces & FACE_PY) face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], (c) => [c[0], -c[2]]);
  if (faces & FACE_NY) face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], (c) => [c[0], c[2]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Subtract rectangle b from rectangle a (both [x0,z0,x1,z1]); returns up to 4 rects. */
export function rectMinus(a, b) {
  const [ax0, az0, ax1, az1] = a;
  const [bx0, bz0, bx1, bz1] = b;
  if (bx1 <= ax0 || bx0 >= ax1 || bz1 <= az0 || bz0 >= az1) return [a];
  const out = [];
  const cx0 = Math.max(ax0, bx0);
  const cx1 = Math.min(ax1, bx1);
  if (bz0 > az0) out.push([ax0, az0, ax1, bz0]);
  if (bz1 < az1) out.push([ax0, bz1, ax1, az1]);
  const mz0 = Math.max(az0, bz0);
  const mz1 = Math.min(az1, bz1);
  if (cx0 > ax0) out.push([ax0, mz0, cx0, mz1]);
  if (cx1 < ax1) out.push([cx1, mz0, ax1, mz1]);
  return out;
}

export function rectsMinus(rects, holes) {
  let cur = [rects];
  for (const h of holes) cur = cur.flatMap((r) => rectMinus(r, h));
  return cur;
}

/** Subtract intervals from [a,b]. */
function intervalMinus(a, b, cuts) {
  let segs = [[a, b]];
  for (const [c0, c1] of cuts) {
    const next = [];
    for (const [s0, s1] of segs) {
      if (c1 <= s0 || c0 >= s1) next.push([s0, s1]);
      else {
        if (c0 > s0) next.push([s0, c0]);
        if (c1 < s1) next.push([c1, s1]);
      }
    }
    segs = next;
  }
  return segs.filter(([s0, s1]) => s1 - s0 > 0.005);
}

export const WALL_T = 0.08;

/**
 * Collects static geometry into per-material batches (merged at the end, so the
 * whole house is a few dozen draw calls) and registers colliders/floors.
 */
export class Builder {
  constructor(game, group) {
    this.game = game;
    this.physics = game.physics;
    this.group = group;
    this.batches = new Map();
    this.portals = [];
  }

  add(geom, mat) {
    if (!this.batches.has(mat)) this.batches.set(mat, []);
    this.batches.get(mat).push(geom);
  }

  /** World-space box. opts: collide (default true), occlude, faces, tag */
  box(x0, y0, z0, x1, y1, z1, mat, opts = {}) {
    const [ax0, ax1] = x0 < x1 ? [x0, x1] : [x1, x0];
    const [ay0, ay1] = y0 < y1 ? [y0, y1] : [y1, y0];
    const [az0, az1] = z0 < z1 ? [z0, z1] : [z1, z0];
    if (mat) this.add(boxGeom(ax0, ay0, az0, ax1, ay1, az1, opts.scale || mat.userData.texScale || 1, opts.faces ?? 63), mat);
    if (opts.collide !== false) {
      return this.physics.addBox(ax0, ay0, az0, ax1, ay1, az1, { occlude: opts.occlude !== false, tag: opts.tag, solid: opts.solid !== false });
    }
    return null;
  }

  /** Register an opening (door/window/arch) that walls on this plane should leave out. */
  portal(axis, at, a, b, y0, y1) {
    const p = { axis, at, a: Math.min(a, b), b: Math.max(a, b), y0, y1 };
    this.portals.push(p);
    return p;
  }

  _portalsOn(axis, at, a, b, y0 = -Infinity, y1 = Infinity) {
    return this.portals.filter((p) => p.axis === axis && Math.abs(p.at - at) < 0.3 && p.b > a && p.a < b && p.y1 > y0 + 0.01 && p.y0 < y1 - 0.01);
  }

  /**
   * Build one wall skin: a slab on plane `axis`=`at` (axis 'z' → wall runs along x),
   * spanning [a,b] along the wall, vertical [y0,y1], extruded from `at` towards
   * `at + dir*thick`. Portals on this plane are cut out.
   */
  skin(axis, at, dir, a, b, y0, y1, mat, { thick = WALL_T, wainscot = null, collide = true, trimMat = null } = {}) {
    const ps = this._portalsOn(axis, at, a, b, y0, y1);
    const n0 = at;
    const n1 = at + dir * thick;
    const piece = (s0, s1, py0, py1, m, t0 = n0, t1 = n1, col = collide) => {
      if (s1 - s0 < 0.005 || py1 - py0 < 0.005) return;
      if (axis === 'z') this.box(s0, py0, t0, s1, py1, t1, m, { collide: col });
      else this.box(t0, py0, s0, t1, py1, s1, m, { collide: col });
    };
    const solid = intervalMinus(a, b, ps.map((p) => [p.a, p.b]));
    const wy = y0 + 0.95;
    const drawRun = (s0, s1, py0, py1) => {
      if (wainscot && py0 < wy) {
        const top = Math.min(py1, wy);
        piece(s0, s1, py0, top, wainscot, n0, n0 + dir * (thick + 0.018), false);
        if (py1 > wy) piece(s0, s1, wy, py1, mat, n0, n1, false);
        if (py1 > wy + 0.04 && trimMat) piece(s0, s1, wy - 0.01, wy + 0.04, trimMat, n0, n0 + dir * (thick + 0.035), false);
        if (trimMat) piece(s0, s1, py0, py0 + 0.13, trimMat, n0, n0 + dir * (thick + 0.03), false);
        if (collide) piece(s0, s1, py0, py1, null);
      } else {
        piece(s0, s1, py0, py1, mat);
        if (trimMat && py0 <= y0 + 0.01) piece(s0, s1, py0, py0 + 0.12, trimMat, n0, n0 + dir * (thick + 0.02), false);
      }
    };
    for (const [s0, s1] of solid) drawRun(s0, s1, y0, y1);
    for (const p of ps) {
      const s0 = Math.max(a, p.a);
      const s1 = Math.min(b, p.b);
      if (p.y1 < y1) drawRun(s0, s1, Math.max(y0, p.y1), y1);
      if (p.y0 > y0) drawRun(s0, s1, y0, Math.min(y1, p.y0));
    }
  }

  /**
   * A room: floor, ceiling and inner wall skins on its four sides (rect given on
   * wall centre-lines). `outer` adds exterior siding on listed sides.
   */
  room(r) {
    const { x0, x1, z0, z1 } = r;
    const y = r.y ?? 0;
    const h = r.h ?? 2.8;
    const T = WALL_T;
    const sides = r.sides ?? { n: true, s: true, e: true, w: true };
    if (r.floor) {
      const rects = rectsMinus([x0, z0, x1, z1], r.floorHoles || []);
      for (const [a0, b0, a1, b1] of rects) {
        this.box(a0, y - 0.1, b0, a1, y, b1, r.floor, { collide: false, faces: 63 & ~FACES.NY });
        this.physics.addFloor(a0, b0, a1, b1, y, r.surface || 'wood');
      }
    }
    if (r.ceil) {
      const rects = rectsMinus([x0, z0, x1, z1], r.ceilHoles || []);
      for (const [a0, b0, a1, b1] of rects) this.box(a0, y + h, b0, a1, y + h + 0.1, b1, r.ceil, { collide: false, faces: 63 & ~FACES.PY });
    }
    const opt = { wainscot: r.wainscot, trimMat: r.trim };
    if (sides.n) this.skin('z', z0, +1, x0, x1, y, y + h, r.wall, opt);
    if (sides.s) this.skin('z', z1, -1, x0, x1, y, y + h, r.wall, opt);
    if (sides.w) this.skin('x', x0, +1, z0 + T, z1 - T, y, y + h, r.wall, opt);
    if (sides.e) this.skin('x', x1, -1, z0 + T, z1 - T, y, y + h, r.wall, opt);
    const outer = r.outer || {};
    const oy0 = r.outerY0 ?? y;
    const oy1 = r.outerY1 ?? y + h;
    if (outer.n) this.skin('z', z0, -1, x0 - (outer.w ? T : 0), x1 + (outer.e ? T : 0), oy0, oy1, outer.n, {});
    if (outer.s) this.skin('z', z1, +1, x0 - (outer.w ? T : 0), x1 + (outer.e ? T : 0), oy0, oy1, outer.s, {});
    if (outer.w) this.skin('x', x0, -1, z0, z1, oy0, oy1, outer.w, {});
    if (outer.e) this.skin('x', x1, +1, z0, z1, oy0, oy1, outer.e, {});
  }

  /** Door casing on both faces of a wall around a portal. */
  casing(p, mat, depth = 0.1) {
    const w = 0.07;
    const T = WALL_T + 0.03;
    const at = p.at;
    for (const side of [-1, 1]) {
      const t0 = at + side * (T - 0.005);
      const t1 = at + side * (T + depth * 0.2);
      if (p.axis === 'z') {
        this.box(p.a - w, p.y0, t0, p.a, p.y1 + w, t1, mat, { collide: false });
        this.box(p.b, p.y0, t0, p.b + w, p.y1 + w, t1, mat, { collide: false });
        this.box(p.a - w, p.y1, t0, p.b + w, p.y1 + w, t1, mat, { collide: false });
      } else {
        this.box(t0, p.y0, p.a - w, t1, p.y1 + w, p.a, mat, { collide: false });
        this.box(t0, p.y0, p.b, t1, p.y1 + w, p.b + w, mat, { collide: false });
        this.box(t0, p.y1, p.a - w, t1, p.y1 + w, p.b + w, mat, { collide: false });
      }
    }
    // jambs lining the opening
    const j = 0.02;
    if (p.axis === 'z') {
      this.box(p.a, p.y0, at - T, p.a + j, p.y1, at + T, mat, { collide: false });
      this.box(p.b - j, p.y0, at - T, p.b, p.y1, at + T, mat, { collide: false });
      this.box(p.a, p.y1 - j, at - T, p.b, p.y1, at + T, mat, { collide: false });
    } else {
      this.box(at - T, p.y0, p.a, at + T, p.y1, p.a + j, mat, { collide: false });
      this.box(at - T, p.y0, p.b - j, at + T, p.y1, p.b, mat, { collide: false });
      this.box(at - T, p.y1 - j, p.a, at + T, p.y1, p.b, mat, { collide: false });
    }
  }

  /** Window in portal p: frame, sill, mullions and a glass pane (returns glass mesh). */
  window(p, mats, { rain = true, glassMat = null } = {}) {
    const { trim, glass, rainGlass } = mats;
    this.casing(p, trim);
    const at = p.at;
    const T = WALL_T + 0.02;
    const mid = (p.a + p.b) / 2;
    const ymid = (p.y0 + p.y1) / 2;
    if (p.axis === 'z') {
      this.box(p.a - 0.08, p.y0 - 0.04, at - T - 0.06, p.b + 0.08, p.y0, at + T + 0.06, trim, { collide: false });
      this.box(mid - 0.02, p.y0, at - 0.02, mid + 0.02, p.y1, at + 0.02, trim, { collide: false });
      this.box(p.a, ymid - 0.02, at - 0.02, p.b, ymid + 0.02, at + 0.02, trim, { collide: false });
    } else {
      this.box(at - T - 0.06, p.y0 - 0.04, p.a - 0.08, at + T + 0.06, p.y0, p.b + 0.08, trim, { collide: false });
      this.box(at - 0.02, p.y0, mid - 0.02, at + 0.02, p.y1, mid + 0.02, trim, { collide: false });
      this.box(at - 0.02, ymid - 0.02, p.a, at + 0.02, ymid + 0.02, p.b, trim, { collide: false });
    }
    // glass is its own mesh so lightning can make it glow
    const w = p.b - p.a;
    const h = p.y1 - p.y0;
    const g = new THREE.PlaneGeometry(w, h);
    const glassMesh = new THREE.Mesh(g, glassMat || glass);
    glassMesh.position.set(p.axis === 'z' ? mid : at, ymid, p.axis === 'z' ? at : mid);
    if (p.axis === 'x') glassMesh.rotation.y = Math.PI / 2;
    glassMesh.renderOrder = 2;
    this.group.add(glassMesh);
    if (rain && rainGlass) {
      for (const side of [-1, 1]) {
        const r = new THREE.Mesh(g, rainGlass);
        r.position.copy(glassMesh.position);
        r.rotation.copy(glassMesh.rotation);
        if (p.axis === 'z') r.position.z += side * 0.006;
        else r.position.x += side * 0.006;
        r.renderOrder = 3;
        this.group.add(r);
      }
    }
    // glass blocks movement but not sight
    if (p.axis === 'z') this.physics.addBox(p.a, p.y0, at - 0.05, p.b, p.y1, at + 0.05, { occlude: false });
    else this.physics.addBox(at - 0.05, p.y0, p.a, at + 0.05, p.y1, p.b, { occlude: false });
    return glassMesh;
  }

  /**
   * Straight stairs rising along ±z (or ±x) from (a, yA) to (b, yB).
   * Steps are solid boxes (which also wall off the underside); a ramp floor gives
   * smooth walking.
   */
  stairs({ axis = 'z', a, b, yA, yB, c0, c1, steps, mat, riserMat, surface = 'wood', baseY }) {
    const n = steps;
    const dir = Math.sign(b - a);
    const run = Math.abs(b - a) / n;
    const floorY = baseY ?? Math.min(yA, yB);
    const ascending = yB > yA;
    for (let i = 0; i < n; i++) {
      // step i spans [a + dir*i*run, a + dir*(i+1)*run]
      const s0 = a + dir * i * run;
      const s1 = a + dir * (i + 1) * run;
      const top = ascending ? yA + ((i + 1) * (yB - yA)) / n : yA + (i * (yB - yA)) / n;
      const bottom = ascending ? floorY : Math.min(floorY, top - 0.3);
      if (axis === 'z') {
        this.box(c0, bottom, Math.min(s0, s1), c1, top, Math.max(s0, s1), mat, { collide: true, occlude: false });
        if (riserMat) this.box(c0, top - 0.025, Math.min(s0, s1) - 0.012, c1, top + 0.012, Math.max(s0, s1) + 0.012, riserMat, { collide: false });
      } else {
        this.box(Math.min(s0, s1), bottom, c0, Math.max(s0, s1), top, c1, mat, { collide: true, occlude: false });
        if (riserMat) this.box(Math.min(s0, s1) - 0.012, top - 0.025, c0, Math.max(s0, s1) + 0.012, top + 0.012, c1, riserMat, { collide: false });
      }
    }
    // Ramp: the walkable surface runs through the step nosings.
    const rampA = ascending ? yA : yA;
    const rampB = yB;
    if (axis === 'z') this.physics.addFloor(c0, Math.min(a, b), c1, Math.max(a, b), 0, surface, { axis: 'z', a, b, ya: rampA, yb: rampB });
    else this.physics.addFloor(Math.min(a, b), c0, Math.max(a, b), c1, 0, surface, { axis: 'x', a, b, ya: rampA, yb: rampB });
  }

  /** A textured decal plane facing +normal at point (x,y,z). */
  decal(mat, x, y, z, w, h, normal, { rot = 0, offset = 0.012 } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x + normal[0] * offset, y + normal[1] * offset, z + normal[2] * offset);
    m.lookAt(m.position.x + normal[0], m.position.y + normal[1], m.position.z + normal[2]);
    if (rot) m.rotateZ(rot);
    m.renderOrder = 1;
    this.group.add(m);
    return m;
  }

  finish() {
    for (const [mat, geoms] of this.batches) {
      if (!geoms.length) continue;
      const merged = mergeGeometries(geoms, false);
      for (const g of geoms) g.dispose();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = !mat.transparent;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
    }
    this.batches.clear();
  }
}

/**
 * Prop kit: prop factories describe parts in local space; the kit places them in
 * the world, either merged into the static batches (default) or as a live Group
 * for things that move. Local frame: +z is the prop's front, y=0 is the floor.
 */
export class Kit {
  constructor(builder, x, y, z, rotY = 0, { dynamic = false } = {}) {
    this.b = builder;
    this.rot = rotY;
    this.origin = new THREE.Vector3(x, y, z);
    this.matrix = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
    this.dynamic = dynamic;
    this.group = dynamic ? new THREE.Group() : null;
    if (dynamic) {
      this.group.position.copy(this.origin);
      this.group.rotation.y = rotY;
      builder.group.add(this.group);
    }
    this.colliders = [];
    this.meshes = [];
  }

  _emit(geom, mat, local) {
    if (this.dynamic) {
      const m = new THREE.Mesh(geom, mat);
      m.applyMatrix4(local);
      m.castShadow = !mat.transparent;
      m.receiveShadow = true;
      this.group.add(m);
      this.meshes.push(m);
      return m;
    }
    geom.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.matrix, local));
    this.b.add(geom, mat);
    return null;
  }

  /** Box by local extents. */
  box(x0, y0, z0, x1, y1, z1, mat, { s } = {}) {
    const g = boxGeom(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), s || mat.userData.texScale || 1);
    return this._emit(g, mat, new THREE.Matrix4());
  }

  /** Box with its own rotation around its centre. */
  rbox(w, h, d, cx, cy, cz, mat, rx = 0, ry = 0, rz = 0) {
    const g = boxGeom(-w / 2, -h / 2, -d / 2, w / 2, h / 2, d / 2, mat.userData.texScale || 1);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    return this._emit(g, mat, m);
  }

  cyl(rTop, rBot, h, cx, cy, cz, mat, { seg = 12, rx = 0, rz = 0, ry = 0, open = false } = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    return this._emit(g, mat, m);
  }

  sphere(r, cx, cy, cz, mat, { sx = 1, sy = 1, sz = 1, seg = 12 } = {}) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    return this._emit(g, mat, m);
  }

  plane(w, h, cx, cy, cz, mat, { ry = 0, rx = 0 } = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    return this._emit(g, mat, m);
  }

  geom(g, mat, cx = 0, cy = 0, cz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    return this._emit(g, mat, m);
  }

  /** Local AABB collider (rotation must be a multiple of 90°). */
  collider(x0, y0, z0, x1, y1, z1, opts = {}) {
    const pts = [new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)].map((p) => p.applyMatrix4(this.matrix));
    const b = this.b.physics.addBox(pts[0].x, pts[0].y, pts[0].z, pts[1].x, pts[1].y, pts[1].z, opts);
    this.colliders.push(b);
    return b;
  }

  /** Local point → world. */
  world(x, y, z) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.matrix);
  }
}
