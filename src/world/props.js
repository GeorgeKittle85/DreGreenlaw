// Furniture and set dressing, built from primitives through a Kit (see builder.js).
// Local frame: +z is the front of the prop, y = 0 is the floor.
import * as THREE from 'three';

export function bed(k, M, { w = 1.4, l = 2.0, blanket = M.sheet, headH = 1.0, stain = false } = {}) {
  const hw = w / 2;
  // head at -z
  k.box(-hw, 0, -l / 2, hw, headH, -l / 2 + 0.06, M.furniture);
  k.box(-hw, 0, l / 2 - 0.05, hw, 0.55, l / 2, M.furniture);
  k.box(-hw, 0.18, -l / 2, -hw + 0.05, 0.36, l / 2, M.furniture);
  k.box(hw - 0.05, 0.18, -l / 2, hw, 0.36, l / 2, M.furniture);
  k.box(-hw + 0.04, 0.3, -l / 2 + 0.05, hw - 0.04, 0.5, l / 2 - 0.05, M.sheet);
  k.box(-hw - 0.02, 0.48, -l / 2 + 0.55, hw + 0.02, 0.56, l / 2 - 0.02, blanket);
  k.box(-hw - 0.03, 0.2, -l / 2 + 0.55, -hw + 0.0, 0.56, l / 2 - 0.02, blanket);
  k.box(hw, 0.2, -l / 2 + 0.55, hw + 0.03, 0.56, l / 2 - 0.02, blanket);
  k.rbox(w * 0.6, 0.12, 0.34, 0, 0.56, -l / 2 + 0.3, M.sheet, 0.12, 0, 0);
  if (stain) k.box(-0.3, 0.561, -0.2, 0.25, 0.562, 0.35, M.black);
  k.collider(-hw, 0, -l / 2, hw, 0.6, l / 2);
}

export function nightstand(k, M) {
  k.box(-0.23, 0, -0.2, 0.23, 0.58, 0.2, M.furniture);
  k.box(-0.2, 0.36, 0.2, 0.2, 0.54, 0.215, M.furnitureLight);
  k.sphere(0.018, 0, 0.45, 0.225, M.brass);
  k.collider(-0.23, 0, -0.2, 0.23, 0.6, 0.2);
}

export function dresser(k, M, { w = 1.2, h = 0.9, d = 0.5 } = {}) {
  k.box(-w / 2, 0.05, -d / 2, w / 2, h, d / 2, M.furniture);
  k.box(-w / 2 - 0.02, h, -d / 2 - 0.02, w / 2 + 0.02, h + 0.03, d / 2 + 0.02, M.furniture);
  for (let i = 0; i < 3; i++) {
    const y0 = 0.1 + i * ((h - 0.12) / 3);
    const y1 = y0 + (h - 0.12) / 3 - 0.03;
    k.box(-w / 2 + 0.04, y0, d / 2, w / 2 - 0.04, y1, d / 2 + 0.015, M.furnitureLight);
    k.sphere(0.02, -w / 4, (y0 + y1) / 2, d / 2 + 0.03, M.brass);
    k.sphere(0.02, w / 4, (y0 + y1) / 2, d / 2 + 0.03, M.brass);
  }
  k.collider(-w / 2, 0, -d / 2, w / 2, h + 0.03, d / 2);
}

export function table(k, M, { w = 1.6, d = 0.9, h = 0.76, mat = M.furniture } = {}) {
  k.box(-w / 2, h - 0.05, -d / 2, w / 2, h, d / 2, mat);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.box(x * (w / 2 - 0.08) - 0.03, 0, z * (d / 2 - 0.08) - 0.03, x * (w / 2 - 0.08) + 0.03, h - 0.05, z * (d / 2 - 0.08) + 0.03, mat);
  }
  k.box(-w / 2 + 0.06, h - 0.14, -d / 2 + 0.06, w / 2 - 0.06, h - 0.05, -d / 2 + 0.08, mat);
  k.box(-w / 2 + 0.06, h - 0.14, d / 2 - 0.08, w / 2 - 0.06, h - 0.05, d / 2 - 0.06, mat);
  k.collider(-w / 2, 0, -d / 2, w / 2, h, d / 2, { occlude: false });
}

export function chair(k, M, { mat = M.furniture, tipped = false } = {}) {
  if (tipped) {
    k.rbox(0.44, 0.04, 0.44, 0, 0.22, 0, mat, Math.PI / 2, 0, 0);
    k.rbox(0.44, 0.9, 0.04, 0, 0.02, -0.4, mat, Math.PI / 2, 0, 0);
    k.collider(-0.25, 0, -0.9, 0.25, 0.45, 0.25, { occlude: false });
    return;
  }
  k.box(-0.22, 0.44, -0.22, 0.22, 0.48, 0.22, mat);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(x * 0.19 - 0.02, 0, z * 0.19 - 0.02, x * 0.19 + 0.02, 0.44, z * 0.19 + 0.02, mat);
  k.box(-0.21, 0.48, -0.22, -0.17, 1.0, -0.18, mat);
  k.box(0.17, 0.48, -0.22, 0.21, 1.0, -0.18, mat);
  for (let i = 0; i < 3; i++) k.box(-0.17, 0.62 + i * 0.13, -0.215, 0.17, 0.68 + i * 0.13, -0.185, mat);
  k.collider(-0.22, 0, -0.22, 0.22, 0.5, 0.22, { occlude: false });
}

export function sofa(k, M, { w = 2.0 } = {}) {
  const hw = w / 2;
  k.box(-hw, 0.1, -0.45, hw, 0.42, 0.45, M.sofa);
  k.box(-hw, 0.42, -0.45, hw, 0.95, -0.22, M.sofa);
  k.box(-hw, 0.1, -0.45, -hw + 0.18, 0.66, 0.45, M.sofa);
  k.box(hw - 0.18, 0.1, -0.45, hw, 0.66, 0.45, M.sofa);
  k.box(-hw + 0.2, 0.42, -0.22, -0.01, 0.55, 0.43, M.sofa);
  k.box(0.01, 0.42, -0.22, hw - 0.2, 0.55, 0.43, M.sofa);
  for (const x of [-hw + 0.06, hw - 0.06]) for (const z of [-0.4, 0.4]) k.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.1, z + 0.03, M.furniture);
  k.collider(-hw, 0, -0.45, hw, 0.95, 0.45, { occlude: false });
}

export function armchair(k, M) {
  k.box(-0.45, 0.1, -0.45, 0.45, 0.42, 0.45, M.armchair);
  k.box(-0.45, 0.42, -0.45, 0.45, 1.05, -0.25, M.armchair);
  k.box(-0.45, 0.1, -0.45, -0.3, 0.65, 0.45, M.armchair);
  k.box(0.3, 0.1, -0.45, 0.45, 0.65, 0.45, M.armchair);
  k.box(-0.3, 0.42, -0.25, 0.3, 0.52, 0.43, M.armchair);
  k.collider(-0.45, 0, -0.45, 0.45, 1.0, 0.45, { occlude: false });
}

/** Rocking chair: dynamic kit; rocks around its local x axis. Returns the kit. */
export function rockingChair(k, M) {
  const mat = M.furniture;
  const rockerShape = new THREE.TorusGeometry(1.2, 0.02, 4, 20, 0.7);
  for (const x of [-0.24, 0.24]) k.geom(rockerShape.clone(), mat, x, 1.22, 0, 0, Math.PI / 2, Math.PI / 2 + Math.PI - 0.35);
  k.box(-0.26, 0.42, -0.25, 0.26, 0.46, 0.25, mat);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(x * 0.23 - 0.02, 0.02, z * 0.2 - 0.02, x * 0.23 + 0.02, 0.44, z * 0.2 + 0.02, mat);
  k.rbox(0.5, 0.75, 0.04, 0, 0.84, -0.28, mat, -0.18, 0, 0);
  for (const x of [-0.26, 0.26]) k.box(x - 0.02, 0.62, -0.25, x + 0.02, 0.66, 0.22, mat);
  k.collider(-0.3, 0, -0.35, 0.3, 0.9, 0.35, { occlude: false });
  return k;
}

export function bookshelf(k, M, { w = 1.0, h = 2.0, d = 0.34 } = {}) {
  k.box(-w / 2, 0, -d / 2, -w / 2 + 0.03, h, d / 2, M.furniture);
  k.box(w / 2 - 0.03, 0, -d / 2, w / 2, h, d / 2, M.furniture);
  k.box(-w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.02, M.furniture);
  k.box(-w / 2, h - 0.03, -d / 2, w / 2, h, d / 2, M.furniture);
  const shelves = 5;
  for (let i = 0; i < shelves; i++) {
    const y = 0.05 + (i * (h - 0.1)) / shelves;
    k.box(-w / 2, y, -d / 2, w / 2, y + 0.025, d / 2, M.furniture);
    if (i < shelves) k.plane(w - 0.07, (h - 0.1) / shelves - 0.05, 0, y + 0.025 + ((h - 0.1) / shelves - 0.05) / 2, d / 2 - 0.08, M.books);
  }
  k.collider(-w / 2, 0, -d / 2, w / 2, h, d / 2);
}

export function fireplace(k, M) {
  k.box(-0.9, 0, -0.3, 0.9, 1.15, 0.12, M.brick);
  k.box(-1.0, 1.15, -0.32, 1.0, 1.22, 0.2, M.furniture);
  k.box(-0.5, 0, -0.22, 0.5, 0.75, 0.125, M.black);
  k.box(-0.95, 0, 0.12, 0.95, 0.05, 0.6, M.brick);
  for (let i = 0; i < 4; i++) k.cyl(0.05, 0.05, 0.5, -0.2 + i * 0.13, 0.12, -0.05, M.furniture, { rz: Math.PI / 2 + 0.1 * i, seg: 6 });
  k.collider(-1.0, 0, -0.32, 1.0, 1.22, 0.2);
}

export function crt(k, M) {
  // cabinet
  k.box(-0.45, 0, -0.25, 0.45, 0.55, 0.25, M.furniture);
  // TV (the screen itself is a live mesh made by the caller)
  k.box(-0.33, 0.55, -0.25, 0.33, 1.05, 0.2, M.plastic);
  k.box(-0.2, 0.62, -0.42, 0.2, 0.98, -0.25, M.plastic);
  k.box(0.23, 0.6, 0.2, 0.3, 0.98, 0.21, M.darkMetal);
  k.collider(-0.45, 0, -0.42, 0.45, 1.05, 0.25);
}

export function floorLamp(k, M) {
  k.cyl(0.14, 0.16, 0.04, 0, 0.02, 0, M.brass);
  k.cyl(0.015, 0.015, 1.45, 0, 0.75, 0, M.brass);
  const shade = k.cyl(0.14, 0.24, 0.3, 0, 1.52, 0, M.lampShade, { open: true, seg: 14 });
  k.collider(-0.16, 0, -0.16, 0.16, 1.6, 0.16, { occlude: false });
  return { shade, bulb: k.world(0, 1.5, 0) };
}

export function tableLamp(k, M, y = 0) {
  k.cyl(0.06, 0.08, 0.05, 0, y + 0.025, 0, M.brass);
  k.cyl(0.012, 0.012, 0.28, 0, y + 0.18, 0, M.brass);
  const shade = k.cyl(0.08, 0.14, 0.18, 0, y + 0.36, 0, M.lampShade, { open: true, seg: 12 });
  return { shade, bulb: k.world(0, y + 0.33, 0) };
}

/** Ceiling fixture: short cord and an exposed bulb or a glass shade. */
export function ceilingLight(k, M, { h = 2.8, drop = 0.35, shade = true } = {}) {
  k.cyl(0.05, 0.05, 0.03, 0, h - 0.015, 0, M.metal);
  k.cyl(0.006, 0.006, drop, 0, h - drop / 2, 0, M.black);
  let shadeMesh = null;
  if (shade) shadeMesh = k.cyl(0.05, 0.2, 0.14, 0, h - drop - 0.05, 0, M.lampShade, { open: true, seg: 14 });
  const bulb = k.sphere(0.04, 0, h - drop - 0.08, 0, M.bulbOn, { seg: 8 });
  return { shade: shadeMesh, bulbMesh: bulb, bulb: k.world(0, h - drop - 0.12, 0) };
}

export function fridge(k, M) {
  k.box(-0.38, 0, -0.34, 0.38, 1.72, 0.34, M.appliance);
  k.box(-0.38, 1.1, 0.34, 0.38, 1.12, 0.345, M.darkMetal);
  k.box(0.28, 1.2, 0.34, 0.31, 1.5, 0.39, M.chrome);
  k.box(0.28, 0.7, 0.34, 0.31, 1.0, 0.39, M.chrome);
  k.collider(-0.38, 0, -0.34, 0.38, 1.72, 0.34);
}

export function stove(k, M) {
  k.box(-0.38, 0, -0.32, 0.38, 0.9, 0.32, M.enamel);
  k.box(-0.3, 0.12, 0.32, 0.3, 0.6, 0.33, M.glassDark);
  k.box(-0.38, 0.9, -0.32, 0.38, 1.25, -0.28, M.enamel);
  for (const [x, z] of [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.14], [0.18, 0.14]]) k.cyl(0.08, 0.08, 0.02, x, 0.91, z, M.darkMetal, { seg: 12 });
  k.box(-0.32, 0.72, 0.32, 0.32, 0.74, 0.35, M.chrome);
  k.collider(-0.38, 0, -0.32, 0.38, 0.95, 0.32, { occlude: false });
}

export function counter(k, M, { w = 1.6, sink = false } = {}) {
  k.box(-w / 2, 0, -0.3, w / 2, 0.86, 0.3, M.furnitureLight);
  k.box(-w / 2 - 0.02, 0.86, -0.32, w / 2 + 0.02, 0.9, 0.33, M.enamel);
  const doors = Math.max(1, Math.round(w / 0.5));
  for (let i = 0; i < doors; i++) {
    const x0 = -w / 2 + (i * w) / doors + 0.02;
    const x1 = -w / 2 + ((i + 1) * w) / doors - 0.02;
    k.box(x0, 0.08, 0.3, x1, 0.78, 0.315, M.furniture);
    k.box(x1 - 0.06, 0.6, 0.315, x1 - 0.045, 0.7, 0.33, M.chrome);
  }
  if (sink) {
    k.box(-0.3, 0.8, -0.2, 0.3, 0.905, 0.2, M.darkMetal);
    k.box(-0.27, 0.8, -0.17, 0.27, 0.906, 0.17, M.black);
    k.cyl(0.015, 0.015, 0.28, 0, 1.02, -0.25, M.chrome);
    k.cyl(0.012, 0.012, 0.18, 0, 1.15, -0.17, M.chrome, { rx: Math.PI / 2 });
  }
  k.collider(-w / 2, 0, -0.32, w / 2, 0.9, 0.33, { occlude: false });
}

export function upperCabinet(k, M, { w = 1.6, y = 1.5, h = 0.7 } = {}) {
  k.box(-w / 2, y, -0.18, w / 2, y + h, 0.18, M.furnitureLight);
  const doors = Math.max(1, Math.round(w / 0.5));
  for (let i = 0; i < doors; i++) {
    const x0 = -w / 2 + (i * w) / doors + 0.02;
    const x1 = -w / 2 + ((i + 1) * w) / doors - 0.02;
    k.box(x0, y + 0.03, 0.18, x1, y + h - 0.03, 0.195, M.furniture);
  }
}

export function wallPhone(k, M) {
  k.box(-0.1, 1.35, -0.02, 0.1, 1.62, 0.06, M.plastic);
  k.cyl(0.05, 0.05, 0.02, 0, 1.47, 0.07, M.darkMetal, { rx: Math.PI / 2, seg: 14 });
  const dyn = new THREE.Group();
  return dyn;
}

export function radio(k, M) {
  k.box(-0.2, 0, -0.1, 0.2, 0.24, 0.1, M.furniture);
  k.box(-0.17, 0.04, 0.1, 0.02, 0.2, 0.105, M.darkMetal);
  k.box(0.06, 0.12, 0.1, 0.16, 0.18, 0.105, M.glassDark);
  k.cyl(0.02, 0.02, 0.02, 0.1, 0.06, 0.11, M.brass, { rx: Math.PI / 2 });
  k.cyl(0.004, 0.004, 0.35, 0.15, 0.4, -0.05, M.chrome, { rz: 0.3 });
}

export function grandfatherClock(k, M) {
  k.box(-0.26, 0, -0.2, 0.26, 2.05, 0.2, M.furniture);
  k.box(-0.3, 2.05, -0.22, 0.3, 2.18, 0.22, M.furniture);
  k.plane(0.34, 0.34, 0, 1.72, 0.205, M.clock);
  k.box(-0.14, 0.5, 0.2, 0.14, 1.45, 0.205, M.glassDark);
  k.collider(-0.26, 0, -0.2, 0.26, 2.18, 0.2);
}

export function frame(k, M, { w = 0.4, h = 0.5, mat, border = 0.035, depth = 0.025, frameMat = null } = {}) {
  const fm = frameMat || M.furniture;
  k.box(-w / 2, -h / 2, 0, w / 2, -h / 2 + border, depth, fm);
  k.box(-w / 2, h / 2 - border, 0, w / 2, h / 2, depth, fm);
  k.box(-w / 2, -h / 2, 0, -w / 2 + border, h / 2, depth, fm);
  k.box(w / 2 - border, -h / 2, 0, w / 2, h / 2, depth, fm);
  return k.plane(w - border * 2, h - border * 2, 0, 0, depth * 0.5, mat);
}

export function bathtub(k, M, { l = 1.6, w = 0.75 } = {}) {
  k.box(-w / 2, 0.12, -l / 2, w / 2, 0.58, -l / 2 + 0.06, M.porcelain);
  k.box(-w / 2, 0.12, l / 2 - 0.06, w / 2, 0.58, l / 2, M.porcelain);
  k.box(-w / 2, 0.12, -l / 2, -w / 2 + 0.06, 0.58, l / 2, M.porcelain);
  k.box(w / 2 - 0.06, 0.12, -l / 2, w / 2, 0.58, l / 2, M.porcelain);
  k.box(-w / 2 + 0.06, 0.12, -l / 2 + 0.06, w / 2 - 0.06, 0.16, l / 2 - 0.06, M.porcelain);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.sphere(0.05, x * (w / 2 - 0.08), 0.06, z * (l / 2 - 0.12), M.brass, { seg: 8 });
  const water = k.plane(w - 0.12, l - 0.12, 0, 0.5, 0, M.water, { rx: -Math.PI / 2 });
  k.cyl(0.015, 0.015, 0.2, 0, 0.66, -l / 2 + 0.03, M.chrome);
  k.collider(-w / 2, 0, -l / 2, w / 2, 0.58, l / 2);
  return water;
}

export function toilet(k, M) {
  k.cyl(0.17, 0.13, 0.4, 0, 0.2, 0.05, M.porcelain, { seg: 14 });
  k.box(-0.19, 0.4, -0.16, 0.19, 0.44, 0.28, M.porcelain);
  k.box(-0.2, 0.44, -0.26, 0.2, 0.82, -0.08, M.porcelain);
  k.collider(-0.2, 0, -0.26, 0.2, 0.82, 0.28, { occlude: false });
}

export function pedestalSink(k, M) {
  k.cyl(0.07, 0.1, 0.78, 0, 0.39, 0, M.porcelain, { seg: 12 });
  k.box(-0.3, 0.78, -0.22, 0.3, 0.88, 0.2, M.porcelain);
  k.box(-0.24, 0.8, -0.16, 0.24, 0.885, 0.14, M.water);
  k.cyl(0.012, 0.012, 0.16, 0, 0.96, -0.19, M.chrome);
  k.collider(-0.3, 0, -0.22, 0.3, 0.9, 0.2, { occlude: false });
}

export function washer(k, M, { dryer = false } = {}) {
  k.box(-0.3, 0, -0.3, 0.3, 0.88, 0.3, M.appliance);
  k.cyl(0.19, 0.19, 0.02, 0, 0.45, 0.305, dryer ? M.darkMetal : M.glassDark, { rx: Math.PI / 2, seg: 16 });
  k.box(-0.3, 0.82, 0.25, 0.3, 0.88, 0.31, M.plastic);
  k.collider(-0.3, 0, -0.3, 0.3, 0.88, 0.3);
}

export function shelves(k, M, { w = 1.2, h = 1.8, d = 0.4, items = true, mat = M.metal } = {}) {
  for (const x of [-w / 2, w / 2 - 0.03]) for (const z of [-d / 2, d / 2 - 0.03]) k.box(x, 0, z, x + 0.03, h, z + 0.03, mat);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const y = 0.1 + (i * (h - 0.15)) / (n - 1);
    k.box(-w / 2, y, -d / 2, w / 2, y + 0.02, d / 2, mat);
    if (items) {
      let x = -w / 2 + 0.08;
      while (x < w / 2 - 0.12) {
        const r = Math.random();
        if (r < 0.45) {
          const jr = 0.04 + Math.random() * 0.03;
          const jh = 0.12 + Math.random() * 0.1;
          k.cyl(jr, jr, jh, x + jr, y + 0.02 + jh / 2, (Math.random() - 0.5) * 0.1, M.jar, { seg: 8 });
          x += jr * 2 + 0.03;
        } else if (r < 0.75) {
          const bw = 0.15 + Math.random() * 0.2;
          const bh = 0.1 + Math.random() * 0.15;
          k.box(x, y + 0.02, -0.12, x + bw, y + 0.02 + bh, 0.1, M.cardboard);
          x += bw + 0.03;
        } else x += 0.12;
      }
    }
  }
  k.collider(-w / 2, 0, -d / 2, w / 2, h, d / 2);
}

export function cardboardBoxes(k, M, { n = 3 } = {}) {
  let y = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.4 + Math.random() * 0.25;
    const h = 0.3 + Math.random() * 0.2;
    const d = 0.35 + Math.random() * 0.2;
    const ox = (Math.random() - 0.5) * 0.1;
    k.rbox(w, h, d, ox, y + h / 2, (Math.random() - 0.5) * 0.1, M.cardboard, 0, (Math.random() - 0.5) * 0.4, 0);
    y += h;
  }
  k.collider(-0.35, 0, -0.3, 0.35, y, 0.3, { occlude: false });
}

/** Ellie's doll ("Mr. Buttons"): a dynamic prop that can be picked up. */
export function doll(k, M) {
  k.cyl(0.06, 0.09, 0.16, 0, 0.08, 0, M.dollDress, { seg: 10 });
  k.sphere(0.07, 0, 0.22, 0, M.skinDoll, { seg: 12 });
  k.sphere(0.074, 0, 0.245, -0.012, M.black, { sx: 1, sy: 0.7, sz: 1, seg: 10 });
  k.sphere(0.012, -0.025, 0.225, 0.064, M.black, { seg: 6 });
  k.sphere(0.012, 0.025, 0.225, 0.064, M.black, { seg: 6 });
  k.cyl(0.018, 0.018, 0.13, -0.08, 0.12, 0, M.skinDoll, { rz: 0.4, seg: 6 });
  k.cyl(0.018, 0.018, 0.13, 0.08, 0.12, 0, M.skinDoll, { rz: -0.4, seg: 6 });
  return k;
}

export function musicBox(k, M) {
  k.box(-0.09, 0, -0.06, 0.09, 0.08, 0.06, M.furnitureLight);
  k.rbox(0.18, 0.012, 0.12, 0, 0.14, -0.1, M.furnitureLight, -1.2, 0, 0);
  k.cyl(0.01, 0.01, 0.06, 0, 0.11, 0, M.porcelain, { seg: 6 });
  k.sphere(0.012, 0, 0.15, 0, M.porcelain, { seg: 6 });
  return k;
}

export function well(k, M) {
  // stone ring with a real hole
  const ring = new THREE.LatheGeometry(
    [new THREE.Vector2(0.62, 0), new THREE.Vector2(0.8, 0), new THREE.Vector2(0.82, 0.75), new THREE.Vector2(0.78, 0.82), new THREE.Vector2(0.64, 0.82), new THREE.Vector2(0.6, 0.75), new THREE.Vector2(0.6, -2.0)],
    20,
  );
  k.geom(ring, M.stone);
  k.cyl(0.6, 0.6, 0.02, 0, -1.9, 0, M.water, { seg: 20 });
  // wooden frame, pulley, rope
  for (const x of [-0.72, 0.72]) k.box(x - 0.05, 0.6, -0.05, x + 0.05, 2.0, 0.05, M.furniture);
  k.box(-0.85, 1.9, -0.06, 0.85, 2.02, 0.06, M.furniture);
  k.cyl(0.08, 0.08, 0.06, 0, 1.8, 0, M.metal, { rx: Math.PI / 2, seg: 12 });
  k.cyl(0.008, 0.008, 3.2, 0.06, 0.2, 0, M.rope, { seg: 4 });
  k.collider(-0.82, 0, -0.82, 0.82, 0.82, 0.82);
}

export function candle(k, M, x, z, h = 0.18, y = 0) {
  k.cyl(0.025, 0.028, h, x, y + h / 2, z, M.wax, { seg: 8 });
}

export function pine(k, M, { h = 9, r = 2.2 } = {}) {
  k.cyl(0.14, 0.22, h * 0.45, 0, h * 0.225, 0, M.bark, { seg: 7 });
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const tr = r * (1 - t * 0.78);
    const th = h * 0.3;
    k.cyl(0, tr, th, 0, h * 0.22 + t * h * 0.7 + th / 2, 0, i % 2 ? M.foliage : M.foliageDark, { seg: 8 });
  }
}

export function deadTree(k, M, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const branch = (x, y, z, len, r, ax, az, depth) => {
    const ex = x + Math.sin(az) * Math.sin(ax) * len;
    const ey = y + Math.cos(ax) * len;
    const ez = z + Math.cos(az) * Math.sin(ax) * len;
    const mid = new THREE.Vector3((x + ex) / 2, (y + ey) / 2, (z + ez) / 2);
    const dir = new THREE.Vector3(ex - x, ey - y, ez - z).normalize();
    const g = new THREE.CylinderGeometry(r * 0.65, r, len, 6);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    k.geom(g, M.bark, mid.x, mid.y, mid.z, e.x, e.y, e.z);
    if (depth > 0) {
      const n = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) branch(ex, ey, ez, len * (0.55 + rnd() * 0.2), r * 0.6, ax + 0.3 + rnd() * 0.5, az + (rnd() - 0.5) * 2.5, depth - 1);
    }
  };
  branch(0, 0, 0, 3.2, 0.3, 0.05, 0, 4);
}

export function picketFence(k, M, len, { gapFrom = null, gapTo = null } = {}) {
  const mat = M.trimWhite;
  for (let x = 0; x <= len; x += 0.14) {
    if (gapFrom !== null && x > gapFrom && x < gapTo) continue;
    const h = 1.0 + ((x * 7.13) % 0.1);
    k.rbox(0.07, h, 0.025, x, h / 2, 0, mat, 0, 0, ((x * 13.7) % 0.1) - 0.05);
  }
  const rail = (y) => {
    if (gapFrom === null) k.box(0, y, -0.04, len, y + 0.06, -0.012, mat);
    else {
      k.box(0, y, -0.04, gapFrom, y + 0.06, -0.012, mat);
      k.box(gapTo, y, -0.04, len, y + 0.06, -0.012, mat);
    }
  };
  rail(0.25);
  rail(0.75);
}

export function mailbox(k, M) {
  k.box(-0.05, 0, -0.05, 0.05, 1.05, 0.05, M.porchWood);
  k.box(-0.13, 1.05, -0.28, 0.13, 1.25, 0.2, M.darkMetal);
  k.cyl(0.13, 0.13, 0.48, 0, 1.25, -0.04, M.darkMetal, { rx: Math.PI / 2, seg: 12 });
  k.plane(0.2, 0.1, 0, 0.88, 0.052, M.plate57);
  k.collider(-0.14, 0, -0.3, 0.14, 1.4, 0.22, { occlude: false });
}

export function car(k, M) {
  // sedan facing +z (front); origin at road level under its centre
  k.box(-0.9, 0.35, -2.2, 0.9, 0.95, 2.2, M.carPaint);
  k.box(-0.82, 0.95, -1.1, 0.82, 1.45, 0.9, M.carPaint);
  k.box(-0.8, 0.98, 0.9, 0.8, 1.42, 0.92, M.glassDark);
  k.box(-0.8, 0.98, -1.12, 0.8, 1.42, -1.1, M.glassDark);
  k.box(-0.84, 1.0, -1.05, -0.82, 1.4, 0.85, M.glassDark);
  k.box(0.82, 1.0, -1.05, 0.84, 1.4, 0.85, M.glassDark);
  for (const [x, z] of [[-0.82, -1.4], [0.82, -1.4], [-0.82, 1.4], [0.82, 1.4]]) k.cyl(0.34, 0.34, 0.22, x, 0.34, z, M.tire, { rz: Math.PI / 2, seg: 14 });
  const hl = [k.box(-0.8, 0.62, 2.2, -0.5, 0.78, 2.23, M.headlight), k.box(0.5, 0.62, 2.2, 0.8, 0.78, 2.23, M.headlight)];
  k.box(-0.85, 0.62, -2.23, -0.55, 0.75, -2.2, M.taillight);
  k.box(0.55, 0.62, -2.23, 0.85, 0.75, -2.2, M.taillight);
  k.box(-0.9, 0.3, 2.2, 0.9, 0.45, 2.3, M.chrome);
  k.collider(-0.95, 0, -2.3, 0.95, 1.45, 2.3);
  return hl;
}

export function sideTable(k, M, { w = 0.7, d = 0.35, h = 0.8 } = {}) {
  k.box(-w / 2, h - 0.04, -d / 2, w / 2, h, d / 2, M.furniture);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(x * (w / 2 - 0.04) - 0.02, 0, z * (d / 2 - 0.04) - 0.02, x * (w / 2 - 0.04) + 0.02, h - 0.04, z * (d / 2 - 0.04) + 0.02, M.furniture);
  k.box(-w / 2 + 0.03, h - 0.2, -d / 2 + 0.03, w / 2 - 0.03, h - 0.06, d / 2 - 0.03, M.furniture);
  k.collider(-w / 2, 0, -d / 2, w / 2, h, d / 2, { occlude: false });
}

export function curtains(k, M, w, h, mat, { open = 0.3 } = {}) {
  const g = new THREE.PlaneGeometry(w * (0.5 - open / 2) + 0.1, h, 8, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.03);
  g.computeVertexNormals();
  const cw = w * (0.5 - open / 2) + 0.1;
  k.geom(g.clone(), mat, -w / 2 + cw / 2 - 0.05, 0, 0);
  k.geom(g, mat, w / 2 - cw / 2 + 0.05, 0, 0);
  k.cyl(0.012, 0.012, w + 0.3, 0, h / 2 + 0.05, 0, M.brass, { rz: Math.PI / 2, seg: 6 });
}

export function furnace(k, M) {
  k.cyl(0.55, 0.6, 1.8, 0, 0.9, 0, M.darkMetal, { seg: 16 });
  k.cyl(0.12, 0.12, 1.2, 0, 2.3, 0, M.darkMetal, { seg: 8 });
  k.box(-0.2, 0.3, 0.5, 0.2, 0.6, 0.62, M.black);
  k.collider(-0.6, 0, -0.6, 0.6, 2.5, 0.6);
}

export function clothesline(k, M, len, dresses) {
  k.cyl(0.005, 0.005, len, 0, 0, 0, M.rope, { rz: Math.PI / 2, seg: 4 });
  for (let i = 0; i < dresses; i++) {
    const x = -len / 2 + ((i + 0.5) * len) / dresses;
    const g = new THREE.PlaneGeometry(0.34, 0.55, 3, 3);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      pos.setX(v, pos.getX(v) * (1 + (0.275 - y) * 0.9));
      pos.setZ(v, Math.sin(pos.getX(v) * 9 + i) * 0.03);
    }
    g.computeVertexNormals();
    k.geom(g, i % 2 ? M.curtainEllie : M.blanketPink, x, -0.3, 0);
  }
}
