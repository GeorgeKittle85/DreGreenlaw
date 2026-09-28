// The body of the thing that came up the well: a child's nightgown stretched
// over something two and a half metres tall.
import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';

function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Egg-shaped head with sunken sockets; morph target 0 = jaw torn open. */
function headGeometry() {
  const rx = 0.112;
  const ry = 0.148;
  const rz = 0.118;
  const g = new THREE.SphereGeometry(1, 44, 34);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const base = new Float32Array(pos.count * 3);
  const scream = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * rx;
    let y = pos.getY(i) * ry;
    let z = pos.getZ(i) * rz;
    uv.setXY(i, 0.5 + (x / (2 * rx)) * 0.98, 0.5 + (y / (2 * ry)) * 0.98);
    const pu = x / rx;
    const pv = -y / ry;
    if (z > 0) {
      const front = z / rz;
      z *= 0.86;
      for (const [eu, ev, s] of [[-0.35, -0.12, 1.05], [0.36, -0.16, 0.95]]) {
        const d2 = ((pu - eu) ** 2 + (pv - ev) ** 2 * 1.5) / (0.22 * s) ** 2;
        z -= 0.024 * Math.exp(-d2) * front;
      }
      z += 0.007 * Math.exp(-((pv + 0.42) ** 2) / 0.02) * Math.exp(-(pu ** 2) / 0.4) * front;
      for (const cu of [-0.56, 0.56]) {
        z += 0.008 * Math.exp(-((pu - cu) ** 2 + (pv - 0.06) ** 2) / 0.03) * front;
        z -= 0.012 * Math.exp(-((pu - cu) ** 2 + (pv - 0.36) ** 2) / 0.035) * front;
      }
      z += 0.012 * Math.exp(-((pu ** 2) / 0.012 + (pv - 0.08) ** 2 / 0.03)) * front;
      z -= 0.006 * Math.exp(-((pv - 0.42) ** 2) / 0.01) * Math.exp(-(pu ** 2) / 0.5) * front;
    }
    if (y < 0) {
      const t = -y / ry;
      x *= 1 - 0.28 * t * t;
      z *= 1 - 0.1 * t;
      y *= 1 + 0.14 * t;
    }
    base[i * 3] = x;
    base[i * 3 + 1] = y;
    base[i * 3 + 2] = z;
    let sx = x;
    let sy = y;
    let sz = z;
    if (pv > 0.1 && z > -0.03) {
      const t = Math.min(1, (pv - 0.1) / 0.9);
      sy -= t * 0.13;
      sx *= 1 + t * 0.14;
      const m = pu ** 2 / 0.3 + (pv - 0.58) ** 2 / 0.28;
      if (m < 1 && z > 0) sz -= (1 - m) * 0.07;
    }
    scream[i * 3] = sx;
    scream[i * 3 + 1] = sy;
    scream[i * 3 + 2] = sz;
  }
  pos.array.set(base);
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.morphAttributes.position = [new THREE.Float32BufferAttribute(scream, 3)];
  return g;
}

/** Long wet hair as bent ribbon cards. Returns { back, left, right } geometries (head-local). */
function hairGeometries() {
  const rng = mulberry32(17);
  const center = new THREE.Vector3(0, 0.13, 0);
  const R = 0.128;
  const groups = { back: [], left: [], right: [] };
  const strand = (a, e, len, width, forward, group) => {
    const n = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    const root = center.clone().addScaledVector(n, R);
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const segs = 9;
    const g = new THREE.PlaneGeometry(width, len, 1, segs);
    const p = g.attributes.position;
    const wob = rng() * 10;
    for (let v = 0; v < p.count; v++) {
      const lx = p.getX(v);
      const ly = p.getY(v);
      // clamp: float32 vertex positions put the top row a hair above len/2
      const t = Math.min(1, Math.max(0, (len / 2 - ly) / len));
      const out = new THREE.Vector3().copy(root)
        .addScaledVector(n, 0.02 * Math.sqrt(t) + forward * Math.min(t * 3, 1) * 0.045)
        .add(new THREE.Vector3(0, -len * t, 0))
        .addScaledVector(side, lx * (1 + t * 0.6) + Math.sin(t * 7 + wob) * 0.012 * t);
      // keep strands off the skull while they fall past it
      const d = out.clone().sub(center);
      if (d.length() < R + 0.012 && out.y > center.y - 0.2) out.copy(center).addScaledVector(d.normalize(), R + 0.012);
      p.setXYZ(v, out.x, out.y, out.z);
    }
    g.computeVertexNormals();
    groups[group].push(g);
  };
  for (let k = 0; k < 70; k++) {
    const a = Math.PI * (0.32 + rng() * 1.36);
    const e = 0.05 + rng() * 0.95;
    strand(a, e, 0.6 + rng() * 0.45, 0.05 + rng() * 0.03, 0, 'back');
  }
  for (let k = 0; k < 30; k++) {
    const a = (rng() - 0.5) * Math.PI * 0.62;
    const e = 0.3 + rng() * 0.45;
    strand(a, e, 0.55 + rng() * 0.35, 0.04 + rng() * 0.025, 0.5, a < 0 ? 'left' : 'right');
  }
  const merge = (arr) => {
    const out = mergeAll(arr);
    for (const g of arr) g.dispose();
    return out;
  };
  return { back: merge(groups.back), left: merge(groups.left), right: merge(groups.right) };
}

function mergeAll(geoms) {
  let count = 0;
  let icount = 0;
  for (const g of geoms) {
    count += g.attributes.position.count;
    icount += g.index.count;
  }
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const idx = new Uint32Array(icount);
  let o = 0;
  let io = 0;
  for (const g of geoms) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + o;
    o += g.attributes.position.count;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/** Build the rig. Returns { root, j (joints), faceMat, headMesh, hair: {left,right,back} }. */
export function buildHer(M) {
  const skin = M.herSkin;
  const root = new THREE.Group();
  const j = {};
  const hips = new THREE.Group();
  hips.position.y = 1.12;
  root.add(hips);
  j.hips = hips;
  for (const [s, n] of [[-1, 'L'], [1, 'R']]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.09, 0, 0);
    hips.add(hip);
    const thigh = mesh(new THREE.CylinderGeometry(0.05, 0.036, 0.56, 7), skin);
    thigh.position.y = -0.28;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.56;
    hip.add(knee);
    knee.add(mesh(new THREE.SphereGeometry(0.043, 8, 6), skin));
    const shin = mesh(new THREE.CylinderGeometry(0.037, 0.026, 0.54, 7), skin);
    shin.position.y = -0.27;
    knee.add(shin);
    const ankle = new THREE.Group();
    ankle.position.y = -0.53;
    knee.add(ankle);
    const foot = mesh(new THREE.BoxGeometry(0.075, 0.04, 0.22), skin);
    foot.position.set(0, -0.01, 0.07);
    ankle.add(foot);
    for (let t = 0; t < 4; t++) {
      const toe = mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.06, 5), skin);
      toe.rotation.x = Math.PI / 2 + 0.2;
      toe.position.set(-0.025 + t * 0.017, -0.02, 0.2);
      ankle.add(toe);
    }
    j[`hip${n}`] = hip;
    j[`knee${n}`] = knee;
    j[`ankle${n}`] = ankle;
  }
  // skirt hangs from the hips, too short for the body wearing it
  const skirtPts = [[0.15, 0.1], [0.19, 0.0], [0.24, -0.25], [0.29, -0.48], [0.315, -0.56]].map(([r, y]) => new THREE.Vector2(r, y));
  const skirtGeo = new THREE.LatheGeometry(skirtPts, 18);
  {
    const p = skirtGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const w = 1 + Math.sin(a * 7) * 0.06 * Math.max(0, -y) * 2;
      p.setX(i, p.getX(i) * w);
      p.setZ(i, p.getZ(i) * w);
      if (y < -0.5) p.setY(i, y + Math.sin(a * 5) * 0.03);
    }
    skirtGeo.computeVertexNormals();
  }
  const skirt = mesh(skirtGeo, M.herGown);
  hips.add(skirt);
  j.skirt = skirt;

  const spine = new THREE.Group();
  hips.add(spine);
  j.spine = spine;
  const bodicePts = [[0.16, 0.06], [0.135, 0.22], [0.14, 0.42], [0.2, 0.58], [0.16, 0.65], [0.07, 0.69]].map(([r, y]) => new THREE.Vector2(r, y));
  const bodice = mesh(new THREE.LatheGeometry(bodicePts, 16), M.herGown);
  bodice.scale.set(1, 1, 0.72);
  spine.add(bodice);
  const chest = new THREE.Group();
  chest.position.y = 0.64;
  spine.add(chest);
  j.chest = chest;

  const neck = new THREE.Group();
  neck.position.y = 0.03;
  chest.add(neck);
  const neckM = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 7), skin);
  neckM.position.y = 0.12;
  neck.add(neckM);
  j.neck = neck;
  const head = new THREE.Group();
  head.position.y = 0.23;
  neck.add(head);
  j.head = head;
  const faceMat = M.herFace.clone();
  const headMesh = mesh(headGeometry(), faceMat);
  headMesh.position.y = 0.13;
  head.add(headMesh);
  const cap = mesh(new THREE.SphereGeometry(0.131, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M.herHairCap);
  cap.position.y = 0.135;
  cap.rotation.x = -0.55;
  head.add(cap);
  const hg = hairGeometries();
  const hairBack = mesh(hg.back, M.herHair);
  const hairL = mesh(hg.left, M.herHair);
  const hairR = mesh(hg.right, M.herHair);
  const pivotL = new THREE.Group();
  const pivotR = new THREE.Group();
  pivotL.position.y = pivotR.position.y = 0.13;
  hairL.position.y = hairR.position.y = -0.13;
  pivotL.add(hairL);
  pivotR.add(hairR);
  head.add(hairBack, pivotL, pivotR);

  for (const [s, n] of [[-1, 'L'], [1, 'R']]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.18, -0.04, 0);
    chest.add(sh);
    sh.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), skin));
    const upper = mesh(new THREE.CylinderGeometry(0.033, 0.026, 0.52, 6), skin);
    upper.position.y = -0.26;
    sh.add(upper);
    const el = new THREE.Group();
    el.position.y = -0.52;
    sh.add(el);
    el.add(mesh(new THREE.SphereGeometry(0.034, 8, 6), skin));
    const fore = mesh(new THREE.CylinderGeometry(0.027, 0.019, 0.5, 6), skin);
    fore.position.y = -0.25;
    el.add(fore);
    const wr = new THREE.Group();
    wr.position.y = -0.5;
    el.add(wr);
    const palm = mesh(new THREE.BoxGeometry(0.075, 0.11, 0.024), skin);
    palm.position.y = -0.055;
    wr.add(palm);
    const fingers = [];
    for (let f = 0; f < 5; f++) {
      const thumb = f === 4;
      const base = new THREE.Group();
      base.position.set(thumb ? s * -0.04 : -0.03 + f * 0.02, thumb ? -0.04 : -0.11, 0);
      if (thumb) base.rotation.z = s * -0.6;
      wr.add(base);
      const l1 = thumb ? 0.06 : 0.085 + (f === 1 || f === 2 ? 0.02 : 0);
      const seg1 = mesh(new THREE.CylinderGeometry(0.0085, 0.008, l1, 5), skin);
      seg1.position.y = -l1 / 2;
      base.add(seg1);
      const mid = new THREE.Group();
      mid.position.y = -l1;
      base.add(mid);
      const l2 = l1 * 0.85;
      const seg2 = mesh(new THREE.CylinderGeometry(0.0075, 0.005, l2, 5), skin);
      seg2.position.y = -l2 / 2;
      mid.add(seg2);
      fingers.push({ base, mid });
    }
    j[`sh${n}`] = sh;
    j[`el${n}`] = el;
    j[`wr${n}`] = wr;
    j[`fingers${n}`] = fingers;
  }

  return { root, j, faceMat, headMesh, hair: { back: hairBack, left: pivotL, right: pivotR } };
}

// Poses: joint → [x, y, z] Euler (radians). Extra keys: y (root drop), curl (fingers), part (hair).
export const POSES = {
  stand: { spine: [0.06, 0, 0], neck: [0.2, 0, 0.3], head: [0.1, 0, 0.35], shL: [0.05, 0, 0.1], shR: [0.05, 0, -0.1], elL: [-0.15, 0, 0], elR: [-0.1, 0, 0], hipL: [0, 0, 0.04], hipR: [0, 0, -0.04], kneeL: [0.05, 0, 0], kneeR: [0.05, 0, 0], curl: 0.35 },
  hang: { spine: [0.18, 0, 0], neck: [0.85, 0, 0.05], head: [0.45, 0, 0.1], shL: [0.3, 0, 0.06], shR: [0.3, 0, -0.06], elL: [-0.05, 0, 0], elR: [-0.05, 0, 0], hipL: [0, 0, 0.03], hipR: [0, 0, -0.03], kneeL: [0.1, 0, 0], kneeR: [0.1, 0, 0], curl: 0.2 },
  tilt: { spine: [0.02, 0, 0.05], neck: [0.1, 0, 1.0], head: [0.05, 0, 0.55], shL: [0.02, 0, 0.12], shR: [0.02, 0, -0.08], elL: [-0.2, 0, 0], elR: [-0.1, 0, 0], hipL: [0, 0, 0.05], hipR: [0, 0, -0.02], kneeL: [0, 0, 0], kneeR: [0.1, 0, 0], curl: 0.6 },
  reach: { spine: [0.2, 0, 0], neck: [-0.2, 0, 0.25], head: [0, 0, 0.3], shL: [0.1, 0, 0.1], shR: [-1.45, 0, -0.1], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], hipL: [0, 0, 0.04], hipR: [0, 0, -0.04], kneeL: [0, 0, 0], kneeR: [0, 0, 0], curl: 0.05 },
  lean: { spine: [0.55, 0, 0], neck: [-0.55, 0, 0.1], head: [-0.25, 0, 0.1], shL: [-0.5, 0, 0.1], shR: [-0.55, 0, -0.08], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], hipL: [-0.2, 0, 0.04], hipR: [-0.15, 0, -0.04], kneeL: [0.3, 0, 0], kneeR: [0.25, 0, 0], curl: 0.4 },
  crouch: { y: -0.5, spine: [0.75, 0, 0], neck: [-0.85, 0, 0.2], head: [-0.3, 0, 0.1], shL: [-0.7, 0, 0.25], shR: [-0.8, 0, -0.25], elL: [-0.3, 0, 0], elR: [-0.3, 0, 0], hipL: [-1.3, 0, 0.2], hipR: [-1.3, 0, -0.2], kneeL: [2.0, 0, 0], kneeR: [2.0, 0, 0], curl: 0.1 },
  twist: { spine: [0.05, 0, 0], neck: [0.1, 0.9, 0.1], head: [0.1, 1.4, 0.2], shL: [0.05, 0, 0.1], shR: [0.05, 0, -0.1], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], hipL: [0, 0, 0.04], hipR: [0, 0, -0.04], kneeL: [0, 0, 0], kneeR: [0, 0, 0], curl: 0.7 },
  handsUp: { spine: [0.1, 0, 0], neck: [0.25, 0, -0.2], head: [0.2, 0, -0.3], shL: [-2.8, 0, 0.35], shR: [-2.8, 0, -0.35], elL: [-0.5, 0, 0], elR: [-0.5, 0, 0], hipL: [0, 0, 0.04], hipR: [0, 0, -0.04], kneeL: [0, 0, 0], kneeR: [0, 0, 0], curl: 0.9 },
  lunge: { spine: [0.42, 0, 0], neck: [-0.35, 0, 0.05], head: [-0.1, 0, 0.08], shL: [-1.7, 0, 0.55], shR: [-1.7, 0, -0.55], elL: [-0.25, 0, 0], elR: [-0.25, 0, 0], hipL: [-0.5, 0, 0.05], hipR: [0.3, 0, -0.05], kneeL: [0.6, 0, 0], kneeR: [0.4, 0, 0], curl: 0, part: 1 },
  smile: { spine: [0.02, 0, 0], neck: [-0.05, 0, 0.12], head: [-0.12, 0, 0.18], shL: [0.02, 0, 0.1], shR: [0.02, 0, -0.1], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], hipL: [0, 0, 0.04], hipR: [0, 0, -0.04], kneeL: [0, 0, 0], kneeR: [0, 0, 0], curl: 0.3, part: 1 },
  straight: { spine: [0, 0, 0], neck: [0.05, 0, 0.12], head: [0.05, 0, 0.12], shL: [0, 0, 0.08], shR: [0, 0, -0.08], elL: [-0.05, 0, 0], elR: [-0.05, 0, 0], hipL: [0, 0, 0.03], hipR: [0, 0, -0.03], kneeL: [0, 0, 0], kneeR: [0, 0, 0], curl: 0.3 },
};

export const RANDOM_POSES = ['stand', 'tilt', 'reach', 'lean', 'crouch', 'twist', 'handsUp', 'hang'];

export const JOINTS = ['spine', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'kneeL', 'kneeR'];

export function clonePose(p) {
  const o = {};
  for (const k of JOINTS) o[k] = [...(p[k] || [0, 0, 0])];
  o.y = p.y || 0;
  o.curl = p.curl ?? 0.3;
  o.part = p.part ?? 0;
  return o;
}

export function mixPose(out, a, b, t) {
  for (const k of JOINTS) for (let i = 0; i < 3; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.curl = a.curl + (b.curl - a.curl) * t;
  out.part = a.part + (b.part - a.part) * t;
  return out;
}
