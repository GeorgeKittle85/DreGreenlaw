// 57 Hollow Creek Road. Two storeys and a basement, built from room rectangles.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder, Kit, WALL_T } from './builder.js';
import { Door } from './doors.js';
import * as P from './props.js';

export const Y0 = 0;
export const Y1 = 3.0;
export const H = 2.8;
export const YB = -3.4;
export const YARD = -0.6;

/** Place a hinged door in a portal. `into` = which side (+1/-1 along the wall normal) it swings into. */
export function doorIn(game, b, M, id, p, { hinge = 'a', into = 1, mat, locked = false, lockedText, openAngle = 1.45, casing = true } = {}) {
  const width = p.b - p.a;
  const height = p.y1 - p.y0 - 0.01;
  let hingePos;
  let baseAngle;
  let swing;
  if (p.axis === 'z') {
    if (hinge === 'a') {
      hingePos = [p.a, p.y0, p.at];
      baseAngle = 0;
      swing = -into;
    } else {
      hingePos = [p.b, p.y0, p.at];
      baseAngle = Math.PI;
      swing = into;
    }
  } else if (hinge === 'a') {
    hingePos = [p.at, p.y0, p.a];
    baseAngle = -Math.PI / 2;
    swing = into;
  } else {
    hingePos = [p.at, p.y0, p.b];
    baseAngle = Math.PI / 2;
    swing = -into;
  }
  const door = new Door(game, b.group, { id, hinge: hingePos, baseAngle, width, height, swing, mat: mat || M.door, knobMat: M.brass, locked, lockedText, openAngle });
  game.world.doors[id] = door;
  if (casing) b.casing(p, M.trim);
  return door;
}

/** Hang a framed picture on a wall. normal = direction the picture faces. */
export function hang(b, M, x, y, z, rotY, opts) {
  const k = new Kit(b, x, y, z, rotY);
  P.frame(k, M, opts);
  return k;
}

export function buildHouse(game) {
  const M = game.mats;
  const W = game.world;
  const group = new THREE.Group();
  W.root.add(group);
  const b = new Builder(game, group);
  const T = WALL_T;
  const glassMats = { trim: M.trim, glass: M.glass, rainGlass: M.rainGlass };

  // ---------------------------------------------------------------- portals
  const pFront = b.portal('z', 0, -0.5, 0.5, Y0, 2.15);
  const pLivingArch = b.portal('x', -1.5, -2.75, -1.25, Y0, 2.3);
  const pDiningArch = b.portal('x', 1.5, -1.85, -0.6, Y0, 2.25);
  const pKitchen = b.portal('x', 1.5, -8.5, -7.6, Y0, 2.08);
  const pKitDining = b.portal('z', -5, 3.3, 4.3, Y0, 2.2);
  const pPantry = b.portal('z', -10, 6.9, 7.7, Y0, 2.05);
  const pLaundry = b.portal('x', -1.5, -8.6, -7.7, Y0, 2.08);
  const pBasement = b.portal('z', -9, -0.45, 0.45, Y0, 2.05);
  const pTunnelOut = b.portal('z', -12, -0.6, 0.6, YARD, 0.25);

  const wLivS = b.portal('z', 0, -6.2, -4.8, 0.9, 2.1);
  const wLivW = b.portal('x', -8, -6.3, -5.1, 0.9, 2.1);
  const wDinS = b.portal('z', 0, 4.2, 5.6, 0.9, 2.1);
  const wDinE = b.portal('x', 8, -3.2, -1.8, 0.9, 2.1);
  const wKitE = b.portal('x', 8, -8.2, -6.8, 0.9, 2.1);
  const wKitN = b.portal('z', -12, 3.0, 4.4, 1.05, 2.1);
  const wLauW = b.portal('x', -8, -10.2, -8.8, 1.0, 2.0);

  const pEllie = b.portal('x', -1.5, -4.1, -3.2, Y1, Y1 + 2.08);
  const pBath = b.portal('x', -1.5, -9.6, -8.75, Y1, Y1 + 2.08);
  const pSam = b.portal('x', 1.5, -1.6, -0.75, Y1, Y1 + 2.08);
  const pMom = b.portal('x', 1.5, -9.6, -8.75, Y1, Y1 + 2.08);

  const wEllS = b.portal('z', 0, -5.4, -4.2, Y1 + 0.9, Y1 + 2.1);
  const wEllW = b.portal('x', -8, -4.0, -2.8, Y1 + 0.9, Y1 + 2.1);
  const wSamS = b.portal('z', 0, 4.2, 5.4, Y1 + 0.9, Y1 + 2.1);
  const wSamE = b.portal('x', 8, -4.6, -3.6, Y1 + 0.9, Y1 + 2.1);
  const wMomE = b.portal('x', 8, -9.2, -8.0, Y1 + 0.9, Y1 + 2.1);
  const wMomN = b.portal('z', -12, 4.2, 5.4, Y1 + 0.9, Y1 + 2.1);
  const wBathW = b.portal('x', -8, -11.4, -10.5, Y1 + 1.1, Y1 + 2.0);
  const wHallU = b.portal('z', 0, -0.6, 0.6, Y1 + 0.9, Y1 + 2.1);

  // ---------------------------------------------------------------- ground floor
  const stairHole = [0.25, -6.6, 1.5, -2.0];
  const gOuter = { outerY0: YARD, outerY1: Y1 };
  b.room({ x0: -1.5, x1: 1.5, z0: -9, z1: 0, y: Y0, h: H, floor: M.wood, ceil: M.ceiling, wall: M.wallHall, wainscot: M.wainscot, trim: M.trim, ceilHoles: [stairHole], outer: { s: M.siding }, ...gOuter });
  b.room({ x0: -8, x1: -1.5, z0: -7, z1: 0, y: Y0, h: H, floor: M.wood, ceil: M.ceiling, wall: M.wallLiving, trim: M.trim, outer: { s: M.siding, w: M.siding }, ...gOuter });
  b.room({ x0: 1.5, x1: 8, z0: -5, z1: 0, y: Y0, h: H, floor: M.woodDark, ceil: M.ceiling, wall: M.wallDining, wainscot: M.wainscot, trim: M.trim, outer: { s: M.siding, e: M.siding }, ...gOuter });
  // kitchen minus the pantry corner
  b.room({ x0: 1.5, x1: 8, z0: -12, z1: -5, y: Y0, h: H, floor: M.lino, surface: 'tile', ceil: M.ceiling, wall: M.plaster, wainscot: M.tile, trim: M.trimWhite, sides: { n: false, s: true, w: true, e: false }, outer: { n: M.siding, e: M.siding }, ...gOuter });
  b.skin('z', -12, +1, 1.5, 6.4, Y0, Y0 + H, M.plaster, { wainscot: M.tile, trimMat: M.trimWhite });
  b.skin('x', 8, -1, -10 + T, -5 - T, Y0, Y0 + H, M.plaster, { wainscot: M.tile, trimMat: M.trimWhite });
  b.skin('z', -10, +1, 6.4, 8 - T, Y0, Y0 + H, M.plaster, { wainscot: M.tile, trimMat: M.trimWhite });
  b.skin('x', 6.4, -1, -12 + T, -10, Y0, Y0 + H, M.plaster, { wainscot: M.tile, trimMat: M.trimWhite });
  b.room({ x0: 6.4, x1: 8, z0: -12, z1: -10, y: Y0, h: H, floor: null, ceil: null, wall: M.plaster, trim: M.trimWhite });
  b.room({ x0: -8, x1: -1.5, z0: -12, z1: -7, y: Y0, h: H, floor: M.concrete, surface: 'stone', ceil: M.ceiling, wall: M.plaster, trim: M.trimWhite, outer: { n: M.siding, w: M.siding }, ...gOuter });
  // dead space either side of the basement stair tunnel
  b.box(-1.5, Y0, -12, -0.6 - T, Y1, -9, null);
  b.box(0.6 + T, Y0, -12, 1.5, Y1, -9, null);
  b.skin('z', -12, -1, -1.5, 1.5, YARD, Y1, M.siding);
  b.skin('z', -9, -1, -0.6, 0.6, Y0, Y0 + H, M.plaster);

  // ---------------------------------------------------------------- upper floor
  const uOuter = { outerY0: Y1, outerY1: Y1 + H + 0.1 };
  b.room({ x0: -1.5, x1: 1.5, z0: -12, z1: 0, y: Y1, h: H, floor: M.wood, floorHoles: [stairHole], ceil: M.ceiling, wall: M.wallHall, wainscot: M.wainscot, trim: M.trim, outer: { s: M.siding, n: M.siding }, ...uOuter });
  b.room({ x0: -8, x1: -1.5, z0: -6, z1: 0, y: Y1, h: H, floor: M.wood, ceil: M.ceiling, wall: M.wallEllie, trim: M.trimWhite, outer: { s: M.siding, w: M.siding }, ...uOuter });
  b.room({ x0: -8, x1: -1.5, z0: -12, z1: -6, y: Y1, h: H, floor: M.tileFloor, surface: 'tile', ceil: M.ceiling, wall: M.plaster, wainscot: M.tile, trim: M.trimWhite, outer: { n: M.siding, w: M.siding }, ...uOuter });
  b.room({ x0: 1.5, x1: 8, z0: -5, z1: 0, y: Y1, h: H, floor: M.wood, ceil: M.ceiling, wall: M.wallSam, trim: M.trimWhite, outer: { s: M.siding, e: M.siding }, ...uOuter });
  b.room({ x0: 1.5, x1: 8, z0: -12, z1: -5, y: Y1, h: H, floor: M.wood, ceil: M.ceiling, wall: M.wallMom, wainscot: M.wainscot, trim: M.trim, outer: { n: M.siding, e: M.siding }, ...uOuter });

  // stairs up (east side of the hall), 17 steps
  b.stairs({ axis: 'z', a: -2.0, b: -6.6, yA: Y0, yB: Y1, c0: 0.25, c1: 1.5 - T, steps: 17, mat: M.woodDark, riserMat: M.trim, baseY: Y0 });
  // upstairs railing around the stairwell
  const rail = (x0, z0, x1, z1) => {
    b.box(x0, Y1, z0, x1, Y1 + 0.95, z1, null, { occlude: false });
    const k = new Kit(b, 0, 0, 0, 0);
    const len = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    k.box(x0, Y1 + 0.9, z0, x1, Y1 + 0.97, z1, M.trim);
    for (let s = 0; s <= len; s += 0.14) {
      const x = alongX ? Math.min(x0, x1) + s : (x0 + x1) / 2;
      const z = alongX ? (z0 + z1) / 2 : Math.min(z0, z1) + s;
      k.box(x - 0.018, Y1, z - 0.018, x + 0.018, Y1 + 0.9, z + 0.018, M.trimWhite);
    }
  };
  rail(0.22, -6.6, 0.28, -2.0);
  rail(0.22, -2.03, 1.5 - T, -1.97);
  // handrail up the stairs (visual)
  {
    const k = new Kit(b, 0, 0, 0, 0);
    const len = Math.hypot(4.6, 3.0);
    k.rbox(0.05, 0.06, len, 0.22, 0.9 + 1.5, -4.3, M.trim, Math.atan2(3.0, 4.6), 0, 0);
    for (let i = 0; i < 17; i++) {
      const z = -2.0 - (i + 0.5) * (4.6 / 17);
      const y = ((i + 1) * 3.0) / 17;
      k.box(0.2, y, z - 0.015, 0.24, y + 0.9, z + 0.015, M.trimWhite);
    }
    k.box(0.17, 0, -1.95, 0.29, 1.15, -1.83, M.trim);
  }

  // basement stairs: 20 steep steps down a narrow tunnel
  b.stairs({ axis: 'z', a: -9.25, b: -13.4, yA: Y0, yB: YB, c0: -0.6 + T, c1: 0.6 - T, steps: 20, mat: M.woodDark, riserMat: M.trim, baseY: YB, surface: 'wood' });
  // the threshold under the basement door, between the hall floor and the top step
  game.physics.addFloor(-0.6, -9.32, 0.6, -8.9, Y0, 'wood');
  b.box(-0.52, Y0 - 0.1, -9.26, 0.52, Y0, -9.0, M.woodDark, { collide: false });
  b.skin('x', -0.6, +1, -13.4, -9, YB, Y0 + H, M.plaster);
  b.skin('x', 0.6, -1, -13.4, -9, YB, Y0 + H, M.plaster);
  b.box(-0.6, Y0 + H, -12, 0.6, Y0 + H + 0.1, -9, M.ceiling, { collide: false });
  {
    const k = new Kit(b, 0, 0, 0, 0);
    k.rbox(1.2, 0.1, Math.hypot(1.4, 1.0), 0, -0.25, -12.7, M.woodDark, -Math.atan2(1.0, 1.4), 0, 0);
    k.box(-0.6, 0.2, -12.05, 0.6, Y0 + H, -11.95, M.plaster);
  }

  // ---------------------------------------------------------------- windows
  for (const p of [wLivS, wLivW, wDinS, wDinE, wKitE, wKitN, wLauW, wEllS, wEllW, wSamS, wSamE, wMomE, wMomN, wBathW, wHallU]) {
    W.windows.push(b.window(p, glassMats));
  }
  W.ellieWindow = W.windows[7];

  // ---------------------------------------------------------------- doors
  const D = (id, p, o) => doorIn(game, b, M, id, p, o);
  D('front', pFront, { hinge: 'a', into: -1, mat: M.doorExterior, locked: true, lockedText: "Locked. Mom always kept a spare somewhere." });
  D('kitchen', pKitchen, { hinge: 'b', into: 1 });
  D('pantry', pPantry, { hinge: 'a', into: -1 });
  D('laundry', pLaundry, { hinge: 'b', into: -1 });
  D('basement', pBasement, { hinge: 'a', into: -1, locked: true, lockedText: 'Chained shut. Padlocked from this side.' });
  D('ellie', pEllie, { hinge: 'a', into: -1, mat: M.doorWhite, locked: true, lockedText: 'Locked. There is a bolt and a padlock on this side of the door.' });
  D('bath', pBath, { hinge: 'a', into: -1, mat: M.doorWhite });
  D('sam', pSam, { hinge: 'b', into: 1, mat: M.doorWhite });
  D('mom', pMom, { hinge: 'b', into: 1 });
  for (const p of [pLivingArch, pDiningArch, pKitDining]) b.casing(p, M.trim);
  b.casing(pTunnelOut, M.trim);

  // Ellie's door: sign + bolt and padlock on the hall side
  b.decal(M.sign, -1.5 - T - 0.02, Y1 + 1.55, -3.65, 0.42, 0.21, [-1, 0, 0]);
  {
    const k = new Kit(b, -1.5 - T - 0.03, Y1 + 1.1, -3.3, 0, { dynamic: true });
    k.box(-0.03, -0.03, -0.2, 0.0, 0.03, 0.05, M.metal);
    k.box(-0.05, -0.08, -0.05, -0.02, 0.0, 0.02, M.brass);
    W.props.ellieBolt = k.group;
  }
  // chains across the basement door
  {
    // two sagging chains in an X, interlocking links, padlocked where they cross
    const z = -9 + T + 0.075;
    const link = new THREE.TorusGeometry(0.02, 0.0062, 5, 10);
    const parts = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const [[ax, ay], [bx, by]] of [[[-0.56, 1.9], [0.56, 0.42]], [[0.56, 1.9], [-0.56, 0.42]]]) {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.floor(len / 0.04);
      const ang = Math.atan2(by - ay, bx - ax);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const e = new THREE.Euler(i % 2 ? Math.PI / 2 : 0, 0, ang, 'ZYX');
        m4.compose(new THREE.Vector3(ax + (bx - ax) * t, Y0 + ay + (by - ay) * t - Math.sin(t * Math.PI) * 0.06, z + (i % 2) * 0.003), q.setFromEuler(e), new THREE.Vector3(1.55, 1, 1));
        parts.push(link.clone().applyMatrix4(m4));
      }
    }
    const chains = new THREE.Group();
    const mesh = new THREE.Mesh(mergeGeometries(parts), M.darkMetal);
    mesh.castShadow = true;
    chains.add(mesh);
    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.032), M.brass);
    lockBody.position.set(0, Y0 + 1.08, z + 0.02);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 5, 10, Math.PI), M.chrome);
    shackle.position.set(0, Y0 + 1.12, z + 0.02);
    chains.add(lockBody, shackle);
    group.add(chains);
    W.props.chains = chains;
    b.decal(M.paper, 0.2, Y0 + 1.55, -9 + T + 0.005, 0.2, 0.26, [0, 0, 1], { rot: 0.1 });
  }

  // ---------------------------------------------------------------- lights
  const L = W.lights;
  const fixture = (name, x, y, z, zone, o = {}) => {
    const k = new Kit(b, x, y - H + 0.0, z, 0, { dynamic: true });
    const f = P.ceilingLight(k, M, { h: H, drop: o.drop ?? 0.35, shade: o.shade ?? true });
    const fx = L.add({ pos: new THREE.Vector3(x, y - 0.5, z), shade: f.shade, bulb: f.bulbMesh, zone, intensity: o.intensity ?? 3.2, range: o.range ?? 7, flicker: o.flicker ?? 0, color: o.color });
    W.fixtures[name] = fx;
    return fx;
  };
  fixture('hallFront', -0.6, H, -1.1, 'hall', { intensity: 2.6 });
  fixture('hallBack', -0.6, H, -7.9, 'hall', { intensity: 2.2, flicker: 0.4 });
  fixture('living', -4.6, H, -3.6, 'living', { intensity: 3.0 });
  fixture('dining', 4.8, H, -2.4, 'dining', { intensity: 3.0, drop: 0.55 });
  fixture('kitchen', 4.5, H, -8.3, 'kitchen', { intensity: 3.4, shade: false });
  fixture('pantry', 7.2, H, -11, 'pantry', { intensity: 1.6, shade: false, range: 4 });
  fixture('laundry', -4.7, H, -9.5, 'laundry', { intensity: 2.0, shade: false, flicker: 0.25 });
  fixture('hallU1', -0.6, Y1 + H, -4.2, 'hallU', { intensity: 2.4 });
  fixture('hallU2', -0.4, Y1 + H, -9.6, 'hallU', { intensity: 2.2, flicker: 0.3 });
  fixture('ellie', -4.7, Y1 + H, -3.0, 'ellie', { intensity: 2.6, color: 0xffb0a0 });
  fixture('bath', -4.7, Y1 + H, -9.0, 'bath', { intensity: 2.4, shade: false, flicker: 0.15 });
  fixture('sam', 4.7, Y1 + H, -2.5, 'sam', { intensity: 2.6, shade: false });
  fixture('mom', 4.7, Y1 + H, -8.5, 'mom', { intensity: 2.8 });
  {
    const k = new Kit(b, -7.35, Y0, -6.35, 0, { dynamic: true });
    const f = P.floorLamp(k, M);
    W.fixtures.livingLamp = L.add({ pos: f.bulb, shade: f.shade, zone: 'living', intensity: 1.6, range: 5 });
  }

  // ---------------------------------------------------------------- hall furniture
  let k;
  k = new Kit(b, -1.2, Y0, -4.8, Math.PI / 2);
  P.grandfatherClock(k, M);
  W.anchor('clock', -1.2, Y0, -4.8);
  hang(b, M, -1.5 + T + 0.02, 1.62, -3.5, Math.PI / 2, { w: 0.42, h: 0.52, mat: M.photo.family });
  hang(b, M, -1.5 + T + 0.02, 1.7, -6.3, Math.PI / 2, { w: 0.36, h: 0.46, mat: M.photo.christmas });
  hang(b, M, -1.5 + T + 0.02, 1.55, -7.4, Math.PI / 2, { w: 0.3, h: 0.38, mat: M.photo.ellie });
  k = new Kit(b, 1.2, Y0, -8.1, -Math.PI / 2);
  P.sideTable(k, M, { w: 0.6, d: 0.35, h: 0.8 });
  b.decal(M.rugRunner, -0.55, Y0 + 0.004, -4.5, 7.8, 0.95, [0, 1, 0], { rot: Math.PI / 2 });
  // coat rack by the door
  k = new Kit(b, -1.15, Y0, -0.45, 0);
  k.cyl(0.02, 0.02, 1.8, 0, 0.9, 0, M.furniture);
  k.cyl(0.16, 0.2, 0.04, 0, 0.02, 0, M.furniture);
  k.geom(new THREE.CylinderGeometry(0.12, 0.2, 0.9, 8, 1, true), M.armchair, 0.06, 1.25, 0.05);

  // ---------------------------------------------------------------- living room
  k = new Kit(b, -7.6, Y0, -3.0, Math.PI / 2);
  P.fireplace(k, M);
  b.box(-8.75, YARD, -3.6, -8.0 - T, 9.2, -2.4, M.brick);
  k = new Kit(b, -4.4, Y0, -6.47, 0);
  P.crt(k, M);
  {
    const sk = new Kit(b, -4.4, Y0, -6.47, 0, { dynamic: true });
    W.tvScreen = sk.plane(0.5, 0.38, -0.02, 0.81, 0.206, M.glassDark);
  }
  W.anchor('tv', -4.4, Y0 + 0.8, -6.2);
  // Chapter I: nobody goes up those stairs in the dark
  W.stairGate = game.physics.addBox(0.25, Y0, -2.35, 1.5, Y0 + 2.2, -2.05, { occlude: false, enabled: false });
  k = new Kit(b, -4.4, Y0, -3.3, Math.PI);
  P.sofa(k, M, { w: 2.1 });
  k = new Kit(b, -4.4, Y0, -4.75, 0);
  P.table(k, M, { w: 1.0, d: 0.5, h: 0.42 });
  k = new Kit(b, -6.7, Y0, -6.0, 0);
  P.armchair(k, M);
  k = new Kit(b, -1.5 - T - 0.19, Y0, -5.2, -Math.PI / 2);
  P.bookshelf(k, M, { w: 1.1, h: 2.1 });
  b.decal(M.rug, -4.4, Y0 + 0.004, -4.3, 3.2, 2.4, [0, 1, 0]);
  // rocking chair (dynamic: it rocks)
  {
    const rk = new Kit(b, -5.5, Y0, -1.05, Math.PI, { dynamic: true });
    P.rockingChair(rk, M);
    W.props.rocker = rk.group;
    W.props.rocker.userData.rock = 0;
  }
  {
    const ck = new Kit(b, -8 + T + 0.03, Y0 + 2.2, -5.7, Math.PI / 2);
    P.curtains(ck, M, 1.4, 2.2, M.curtain, { open: 0.45 });
    const ck2 = new Kit(b, -5.5, Y0 + 2.2, -T - 0.03, Math.PI);
    P.curtains(ck2, M, 1.6, 2.2, M.curtain, { open: 0.5 });
  }
  // mantel pictures
  hang(b, M, -7.62, 1.45, -3.35, Math.PI / 2, { w: 0.2, h: 0.25, mat: M.photo.ellie_dark, depth: 0.03 });
  hang(b, M, -7.62, 1.43, -2.6, Math.PI / 2, { w: 0.24, h: 0.2, mat: M.photo.mom, depth: 0.03 });
  hang(b, M, -8 + T + 0.02, 1.9, -3.0, Math.PI / 2, { w: 0.7, h: 0.5, mat: M.photo.christmas });

  // ---------------------------------------------------------------- dining room
  k = new Kit(b, 4.8, Y0, -2.4, 0);
  P.table(k, M, { w: 2.2, d: 1.1 });
  k = new Kit(b, 3.45, Y0, -2.4, Math.PI / 2);
  P.chair(k, M);
  k = new Kit(b, 5.0, Y0, -1.6, Math.PI);
  P.chair(k, M);
  k = new Kit(b, 5.0, Y0, -3.2, 0);
  P.chair(k, M);
  k = new Kit(b, 6.4, Y0, -2.0, -Math.PI / 2);
  P.chair(k, M, { tipped: true });
  // place settings for three
  {
    const tk = new Kit(b, 0, Y0, 0, 0);
    const setting = (x, z, name, ry) => {
      tk.cyl(0.13, 0.12, 0.015, x, 0.77, z, M.porcelain, { seg: 16 });
      tk.sphere(0.06, x + 0.02, 0.8, z, M.black, { sy: 0.5, seg: 8 });
      tk.plane(0.12, 0.06, x + Math.sin(ry) * 0.2, 0.8, z + Math.cos(ry) * 0.2, M.placeCard[name], { ry, rx: -0.3 });
    };
    setting(3.9, -2.4, 'MOM', -Math.PI / 2);
    setting(5.0, -1.95, 'ELLIE', 0);
    setting(5.0, -2.85, 'SAM', Math.PI);
    for (let i = 0; i < 3; i++) tk.cyl(0.015, 0.02, 0.25, 4.7 + i * 0.12, 0.89, -2.4, M.wax, { seg: 6 });
  }
  W.anchor('ribbon', 5.0, Y0 + 0.78, -1.95);
  k = new Kit(b, 7.62, Y0, -4.2, -Math.PI / 2);
  P.dresser(k, M, { w: 1.4, h: 1.7, d: 0.5 });
  hang(b, M, 5.2, 1.7, -5 + T + 0.02, 0, { w: 0.55, h: 0.7, mat: M.photo.mom });
  {
    const ck = new Kit(b, 4.9, Y0 + 2.2, -T - 0.03, Math.PI);
    P.curtains(ck, M, 1.6, 2.2, M.curtain, { open: 0.35 });
  }

  // ---------------------------------------------------------------- kitchen
  k = new Kit(b, 3.7, Y0, -11.58, 0);
  P.counter(k, M, { w: 1.6, sink: true });
  k = new Kit(b, 2.4, Y0, -11.58, 0);
  P.counter(k, M, { w: 1.0 });
  k = new Kit(b, 5.4, Y0, -11.58, 0);
  P.counter(k, M, { w: 1.8 });
  k = new Kit(b, 5.4, Y0, -11.78, 0);
  P.upperCabinet(k, M, { w: 1.8 });
  k = new Kit(b, 2.4, Y0, -11.78, 0);
  P.upperCabinet(k, M, { w: 1.0 });
  k = new Kit(b, 7.5, Y0, -8.6, -Math.PI / 2);
  P.fridge(k, M);
  b.decal(M.rules, 7.5 - 0.345, Y0 + 1.45, -8.5, 0.2, 0.25, [-1, 0, 0], { rot: -0.05 });
  b.decal(M.drawing.family, 7.5 - 0.345, Y0 + 1.2, -8.85, 0.2, 0.2, [-1, 0, 0], { rot: 0.08 });
  W.anchor('rules', 7.1, Y0 + 1.45, -8.5);
  k = new Kit(b, 7.55, Y0, -5.75, -Math.PI / 2);
  P.stove(k, M);
  k = new Kit(b, 4.3, Y0, -8.0, 0);
  P.table(k, M, { w: 1.1, d: 0.8, mat: M.furnitureLight });
  k = new Kit(b, 4.3, Y0, -8.6, 0);
  P.chair(k, M, { mat: M.furnitureLight });
  k = new Kit(b, 4.3, Y0, -7.4, Math.PI);
  P.chair(k, M, { mat: M.furnitureLight });
  // wall phone (the handset is a separate live mesh)
  k = new Kit(b, 1.5 + T + 0.02, Y0, -6.3, Math.PI / 2);
  P.wallPhone(k, M);
  {
    const hs = new THREE.Group();
    const mat = M.plastic;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), mat);
    const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), mat);
    const e2 = e1.clone();
    e1.position.y = 0.1;
    e2.position.y = -0.1;
    hs.add(bar, e1, e2);
    hs.position.set(1.5 + T + 0.11, Y0 + 1.48, -6.18);
    hs.traverse((o) => (o.castShadow = true));
    group.add(hs);
    W.props.handset = hs;
    W.anchor('phone', 1.62, Y0 + 1.48, -6.3);
  }
  // pantry: fuse box + shelves
  k = new Kit(b, 7.2, Y0, -12 + T, 0);
  k.box(-0.22, 1.2, 0, 0.22, 1.75, 0.12, M.darkMetal);
  k = new Kit(b, 7.2, Y0 + 1.47, -12 + T + 0.121, 0, { dynamic: true });
  k.box(-0.2, -0.26, 0, 0.2, 0.26, 0.015, M.metal);
  W.props.fuseDoor = k.group;
  W.anchor('fusebox', 7.2, Y0 + 1.47, -11.7);
  k = new Kit(b, 6.4 + T + 0.2, Y0, -11.0, Math.PI / 2);
  P.shelves(k, M, { w: 1.3, h: 2.0, d: 0.35, mat: M.furnitureLight });

  // ---------------------------------------------------------------- laundry
  k = new Kit(b, -6.9, Y0, -11.6, 0);
  P.washer(k, M);
  k = new Kit(b, -6.2, Y0, -11.6, 0);
  P.washer(k, M, { dryer: true });
  W.anchor('picture', -6.2, Y0 + 0.9, -11.55);
  k = new Kit(b, -4.6, Y0, -11.62, 0);
  P.counter(k, M, { w: 1.2, sink: true });
  k = new Kit(b, -7.7, Y0, -8.0, Math.PI / 2);
  P.shelves(k, M, { w: 1.2, h: 1.9, d: 0.4 });
  k = new Kit(b, -4.8, Y0 + 2.2, -9.5, 0);
  P.clothesline(k, M, 4.8, 6);
  k = new Kit(b, -2.5, Y0, -7.6, 0);
  P.cardboardBoxes(k, M, { n: 2 });

  // ---------------------------------------------------------------- upstairs hall
  b.decal(M.rugRunner, -0.6, Y1 + 0.004, -6.2, 11.2, 0.95, [0, 1, 0], { rot: Math.PI / 2 });
  k = new Kit(b, 0.2, Y1, -11.62, 0);
  P.sideTable(k, M, { w: 0.9, d: 0.4, h: 0.8 });
  hang(b, M, -1.5 + T + 0.02, Y1 + 1.6, -6.6, Math.PI / 2, { w: 0.42, h: 0.52, mat: M.photo.ellie });
  hang(b, M, -1.5 + T + 0.02, Y1 + 1.6, -1.2, Math.PI / 2, { w: 0.42, h: 0.52, mat: M.photo.ellie_dark });
  hang(b, M, 1.5 - T - 0.02, Y1 + 1.6, -10.8, -Math.PI / 2, { w: 0.42, h: 0.52, mat: M.photo.sam });
  hang(b, M, 1.5 - T - 0.02, Y1 + 1.65, -7.2, -Math.PI / 2, { w: 0.36, h: 0.46, mat: M.photo.family });

  // ---------------------------------------------------------------- Ellie's room
  k = new Kit(b, -6.6, Y1, -4.95, 0);
  P.bed(k, M, { w: 0.95, l: 1.8, blanket: M.blanketPink, headH: 0.85 });
  k = new Kit(b, -7.55, Y1, -5.6, 0);
  P.nightstand(k, M);
  k = new Kit(b, -2.7, Y1, -0.35, Math.PI);
  P.dresser(k, M, { w: 1.0, h: 0.85, d: 0.45 });
  W.anchor('musicbox', -2.7, Y1 + 0.88, -0.4);
  {
    const mk = new Kit(b, -2.7, Y1 + 0.88, -0.4, Math.PI, { dynamic: true });
    P.musicBox(mk, M);
    W.props.musicBox = mk.group;
  }
  k = new Kit(b, -4.6, Y1, -3.0, 0);
  P.table(k, M, { w: 0.6, d: 0.6, h: 0.45, mat: M.furnitureLight });
  k = new Kit(b, -4.6, Y1, -3.45, 0);
  k.box(-0.13, 0.25, -0.13, 0.13, 0.28, 0.13, M.furnitureLight);
  k.box(-0.13, 0.28, -0.14, 0.13, 0.55, -0.11, M.furnitureLight);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(x * 0.11 - 0.015, 0, z * 0.11 - 0.015, x * 0.11 + 0.015, 0.25, z * 0.11 + 0.015, M.furnitureLight);
  {
    const tk = new Kit(b, -4.6, Y1 + 0.45, -3.0, 0);
    tk.cyl(0.05, 0.04, 0.02, -0.12, 0.01, 0.08, M.porcelain, { seg: 10 });
    tk.cyl(0.05, 0.04, 0.02, 0.12, 0.01, -0.08, M.porcelain, { seg: 10 });
    tk.cyl(0.04, 0.05, 0.08, 0, 0.04, 0, M.porcelain, { seg: 10 });
  }
  // toys
  {
    const tk = new Kit(b, -5.2, Y1, -1.4, 0);
    const cols = [M.ribbon, M.blanketBlue, M.furnitureLight, M.dollDress];
    for (let i = 0; i < 7; i++) {
      const s = 0.08;
      tk.rbox(s, s, s, (i % 4) * 0.13 - 0.2, s / 2 + (i > 3 ? s : 0), Math.floor(i / 4) * 0.02, cols[i % 4], 0, i * 0.3, 0);
    }
    tk.sphere(0.1, 0.5, 0.1, 0.4, M.ribbon, { seg: 12 });
  }
  // the wardrobe the thing stands in (live doors)
  {
    const wx = -3.3;
    const wz = -6 + T + 0.31;
    k = new Kit(b, wx, Y1, wz, 0);
    k.box(-0.62, 0, -0.3, 0.62, 2.1, -0.27, M.furniture);
    k.box(-0.62, 0, -0.3, -0.59, 2.1, 0.3, M.furniture);
    k.box(0.59, 0, -0.3, 0.62, 2.1, 0.3, M.furniture);
    k.box(-0.62, 2.07, -0.3, 0.62, 2.14, 0.32, M.furniture);
    k.box(-0.62, 0, -0.3, 0.62, 0.08, 0.3, M.furniture);
    k.cyl(0.012, 0.012, 1.16, 0, 1.85, -0.05, M.brass, { rz: Math.PI / 2 });
    k.collider(-0.62, 0, -0.3, 0.62, 2.14, 0.3, { occlude: false });
    const wd = [];
    wd.push(new Door(game, group, { id: 'wardrobeL', hinge: [wx - 0.59, Y1 + 0.08, wz + 0.31], baseAngle: 0, width: 0.59, height: 1.98, thick: 0.03, swing: -1, mat: M.furniture, knobMat: M.brass, openAngle: 1.9 }));
    wd.push(new Door(game, group, { id: 'wardrobeR', hinge: [wx + 0.59, Y1 + 0.08, wz + 0.31], baseAngle: Math.PI, width: 0.59, height: 1.98, thick: 0.03, swing: 1, mat: M.furniture, knobMat: M.brass, openAngle: 1.9 }));
    for (const d of wd) {
      d.interactable = false;
      W.doors[d.id] = d;
    }
    W.anchor('wardrobe', wx, Y1, wz - 0.02, 0);
  }
  // drawings pinned all over the walls
  {
    const ds = [
      ['tall', -7.92 + 0.0, Y1 + 1.5, -1.2, [1, 0, 0]],
      ['taller', -7.92, Y1 + 1.4, -2.1, [1, 0, 0]],
      ['eyes', -7.92, Y1 + 1.7, -5.0, [1, 0, 0]],
      ['sam', -6.0, Y1 + 1.6, -5.92, [0, 0, 1]],
      ['windows', -5.2, Y1 + 1.35, -5.92, [0, 0, 1]],
      ['mommy', -1.58, Y1 + 1.5, -5.2, [-1, 0, 0]],
      ['well', -1.58, Y1 + 1.65, -1.5, [-1, 0, 0]],
      ['family', -1.58, Y1 + 1.2, -2.3, [-1, 0, 0]],
      ['tall', -3.4, Y1 + 1.5, -0.08, [0, 0, -1]],
      ['eyes', -6.8, Y1 + 1.55, -0.08, [0, 0, -1]],
    ];
    ds.forEach(([name, x, y, z, n], i) => b.decal(M.drawing[name], x, y, z, 0.42, 0.42, n, { rot: (i % 3 - 1) * 0.07 }));
  }
  W.anchor('drawingNote', -6.4, Y1 + 0.58, -4.4);
  {
    const ck = new Kit(b, -4.8, Y1 + 2.2, -T - 0.03, Math.PI);
    P.curtains(ck, M, 1.4, 2.2, M.curtainEllie, { open: 0.4 });
  }
  // growth chart on the wall beside the door: the last marks are far too high
  {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 64, 512);
    const marks = [[0.36, 'E 5'], [0.42, 'E 6'], [0.47, 'E 7'], [0.58, '7'], [0.7, '7'], [0.83, '7'], [0.97, '7']];
    for (const [h, t] of marks) {
      const y = 512 - h * 512 * 0.98;
      g.fillStyle = h > 0.5 ? '#3a0a0a' : '#1a1a40';
      g.fillRect(4, y, 34, 3);
      g.font = '18px Caveat, cursive';
      g.fillText(t, 38, y + 6);
    }
    b.decal(M.decal(c), -1.5 - T, Y1 + 1.2, -4.45, 0.18, 2.4, [-1, 0, 0]);
  }

  // ---------------------------------------------------------------- bathroom
  k = new Kit(b, -7.45, Y1, -9.0, 0);
  W.props.tubWater = P.bathtub(k, M);
  k = new Kit(b, -5.8, Y1, -11.62, 0);
  P.toilet(k, M);
  k = new Kit(b, -3.3, Y1, -11.68, 0);
  P.pedestalSink(k, M);
  W.anchor('mirror', -3.3, Y1 + 1.6, -12 + T + 0.06);
  k = new Kit(b, -2.1, Y1, -11.7, 0);
  k.cyl(0.012, 0.012, 0.6, 0, 1.2, 0.0, M.chrome, { rz: Math.PI / 2 });
  k.box(-0.26, 0.7, -0.03, 0.26, 1.2, 0.0, M.sheet);

  // ---------------------------------------------------------------- Sam's old room (stripped)
  k = new Kit(b, 6.95, Y1, -2.6, -Math.PI / 2);
  k.box(-0.5, 0.25, -1.0, 0.5, 0.3, 1.0, M.metal);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(x * 0.48 - 0.02, 0, z * 0.98 - 0.02, x * 0.48 + 0.02, z < 0 ? 0.9 : 0.55, z * 0.98 + 0.02, M.metal);
  k.collider(-0.5, 0, -1.0, 0.5, 0.6, 1.0, { occlude: false });
  hang(b, M, 8 - T - 0.02, Y1 + 1.55, -2.6, -Math.PI / 2, { w: 0.5, h: 0.72, mat: M.poster, depth: 0.005, border: 0.005 });
  W.anchor('poster', 7.8, Y1 + 1.55, -2.6);
  k = new Kit(b, 2.3, Y1, -4.5, 0);
  P.cardboardBoxes(k, M, { n: 3 });
  k = new Kit(b, 3.0, Y1, -4.4, 0);
  P.cardboardBoxes(k, M, { n: 2 });
  k = new Kit(b, 2.2, Y1, -3.2, Math.PI / 2);
  P.table(k, M, { w: 1.1, d: 0.55, mat: M.furnitureLight });
  W.anchor('samNote', 2.25, Y1 + 0.77, -3.1);

  // ---------------------------------------------------------------- Mom's room
  k = new Kit(b, 5.0, Y1, -10.85, 0);
  P.bed(k, M, { w: 1.6, l: 2.1, blanket: M.blanketMom, headH: 1.2, stain: true });
  k = new Kit(b, 3.8, Y1, -11.62, 0);
  P.nightstand(k, M);
  k = new Kit(b, 6.2, Y1, -11.62, 0);
  P.nightstand(k, M);
  {
    const lk = new Kit(b, 3.8, Y1 + 0.58, -11.62, 0, { dynamic: true });
    const f = P.tableLamp(lk, M);
    W.fixtures.momLamp = L.add({ pos: f.bulb, shade: f.shade, zone: 'mom', intensity: 1.2, range: 4 });
  }
  W.anchor('diary', 6.2, Y1 + 0.6, -11.6);
  k = new Kit(b, 1.85, Y1, -6.4, Math.PI / 2);
  P.dresser(k, M, { w: 1.3, h: 0.9, d: 0.5 });
  // Mom's wardrobe: the feet
  {
    const wx = 8 - T - 0.31;
    const wz = -6.4;
    k = new Kit(b, wx, Y1, wz, -Math.PI / 2);
    k.box(-0.62, 0, -0.3, 0.62, 2.1, -0.27, M.furniture);
    k.box(-0.62, 0, -0.3, -0.59, 2.1, 0.3, M.furniture);
    k.box(0.59, 0, -0.3, 0.62, 2.1, 0.3, M.furniture);
    k.box(-0.62, 2.07, -0.3, 0.62, 2.14, 0.32, M.furniture);
    k.box(-0.62, 0, -0.3, 0.62, 0.08, 0.3, M.furniture);
    // hanging dresses
    for (let i = 0; i < 5; i++) k.box(-0.45 + i * 0.2, 0.7, -0.15, -0.4 + i * 0.2, 1.8, 0.12, i % 2 ? M.blanketMom : M.curtain);
    k.collider(-0.62, 0, -0.3, 0.62, 2.14, 0.3, { occlude: false });
    const d1 = new Door(game, group, { id: 'momWardrobe', hinge: [wx - 0.31, Y1 + 0.08, wz + 0.59], baseAngle: Math.PI / 2, width: 1.18, height: 1.98, thick: 0.03, swing: -1, mat: M.furniture, knobMat: M.brass, openAngle: 1.7 });
    d1.interactable = true;
    W.doors.momWardrobe = d1;
    W.anchor('momWardrobe', wx, Y1, wz);
  }
  // shrine of Ellie photographs over the bed, and the clipping
  {
    const photos = ['ellie', 'ellie_dark', 'christmas', 'ellie', 'ellie_dark', 'ellie', 'ellie_dark', 'ellie'];
    photos.forEach((ph, i) => {
      const x = 3.6 + (i % 4) * 0.7 + (i > 3 ? 0.35 : 0);
      const y = Y1 + 1.55 + (i > 3 ? 0.55 : 0);
      b.decal(M.photo[ph], x, y, -12 + T + 0.01, 0.28, 0.35, [0, 0, 1], { rot: ((i * 37) % 7 - 3) * 0.03 });
    });
    b.decal(M.newspaper, 1.5 + T + 0.01, Y1 + 1.55, -7.3, 0.4, 0.5, [1, 0, 0], { rot: 0.04 });
    W.anchor('clipping', 1.7, Y1 + 1.55, -7.3);
  }

  // ---------------------------------------------------------------- roof, gables, foundation, porch
  {
    const rk = new Kit(b, 0, 0, 0, 0);
    const run = 6.6;
    const rise = 2.7;
    const len = Math.hypot(run, rise);
    const ang = Math.atan2(rise, run);
    rk.rbox(17.2, 0.16, len, 0, Y1 + H + 0.1 + rise / 2, 0.6 - run / 2, M.shingles, ang, 0, 0);
    rk.rbox(17.2, 0.16, len, 0, Y1 + H + 0.1 + rise / 2, -12.6 + run / 2, M.shingles, -ang, 0, 0);
    // gable triangles
    const tri = (x, n) => {
      const g = new THREE.BufferGeometry();
      const y0 = Y1 + H + 0.1;
      const v = [x, y0, 0.05, x, y0, -12.05, x, y0 + rise + 0.05, -6];
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 12 / 1.6, 0, 6 / 1.6, rise / 1.6], 2));
      if (n > 0) g.setIndex([0, 1, 2]);
      else g.setIndex([0, 2, 1]);
      g.computeVertexNormals();
      rk.geom(g, M.siding);
    };
    tri(8 + T, 1);
    tri(-8 - T, -1);
    // attic floor seal
    b.box(-8, Y1 + H + 0.1, -12, 8, Y1 + H + 0.12, 0, M.woodDark, { collide: false });
  }
  // stone foundation skirt
  b.box(-8.2, YARD - 0.2, -12.2, 8.2, Y0 - 0.02, -11.98, M.foundation, { collide: false });
  b.box(-8.2, YARD - 0.2, -12.2, -7.98, Y0 - 0.02, 0.2, M.foundation, { collide: false });
  b.box(7.98, YARD - 0.2, -12.2, 8.2, Y0 - 0.02, 0.2, M.foundation, { collide: false });
  b.box(-8.2, YARD - 0.2, -0.02, 8.2, Y0 - 0.02, 0.2, M.foundation, { collide: false });
  // porch
  {
    b.box(-3.2, YARD, 0.0, 3.2, Y0, 2.6, M.porchWood, { collide: false, scale: 1.6 });
    game.physics.addFloor(-3.2, 0.0, 3.2, 2.6, Y0, 'porch');
    for (let i = 0; i < 3; i++) {
      const z0 = 2.6 + i * 0.3;
      b.box(-1.0, YARD, z0, 1.0, Y0 - (i + 1) * 0.2 + 0.0, z0 + 0.3, M.porchWood, { collide: false });
    }
    game.physics.addFloor(-1.0, 2.6, 1.0, 3.5, 0, 'porch', { axis: 'z', a: 2.6, b: 3.5, ya: Y0, yb: YARD });
    for (const x of [-3.05, -1.05, 1.05, 3.05]) b.box(x - 0.08, Y0, 2.35, x + 0.08, 2.75, 2.51, M.trimWhite);
    const rk = new Kit(b, 0, 0, 0, 0);
    rk.rbox(6.8, 0.1, 2.9, 0, 2.85, 1.35, M.shingles, 0.18, 0, 0);
    // railing
    for (const [x0, x1] of [[-3.05, -1.05], [1.05, 3.05]]) {
      b.box(x0, Y0, 2.4, x1, Y0 + 0.95, 2.46, null, { occlude: false });
      rk.box(x0, Y0 + 0.88, 2.39, x1, Y0 + 0.95, 2.47, M.trimWhite);
      rk.box(x0, Y0 + 0.08, 2.4, x1, Y0 + 0.14, 2.46, M.trimWhite);
      for (let x = x0 + 0.1; x < x1; x += 0.15) rk.box(x - 0.02, Y0 + 0.1, 2.41, x + 0.02, Y0 + 0.9, 2.45, M.trimWhite);
    }
    for (const z0 of [0.3]) {
      for (const x of [-3.15, 3.15]) {
        b.box(x - 0.03, Y0, z0, x + 0.03, Y0 + 0.95, 2.4, null, { occlude: false });
        rk.box(x - 0.03, Y0 + 0.88, z0, x + 0.03, Y0 + 0.95, 2.4, M.trimWhite);
      }
    }
    // porch rocking chair
    const pk = new Kit(b, -2.2, Y0, 1.3, 0, { dynamic: true });
    P.rockingChair(pk, M);
    W.props.porchRocker = pk.group;
    // porch light (off until the very end)
    const lk = new Kit(b, 0.78, Y0 + 2.0, 0.1, 0, { dynamic: true });
    lk.box(-0.07, -0.12, 0, 0.07, 0.12, 0.12, M.darkMetal);
    const bulb = lk.sphere(0.045, 0, -0.02, 0.07, M.bulbOn, { seg: 8 });
    W.fixtures.porch = L.add({ pos: new THREE.Vector3(0.78, Y0 + 1.95, 0.35), bulb, zone: 'porch', intensity: 2.2, range: 6, on: false, power: false });
    b.decal(M.plate57, -0.85, Y0 + 1.9, 0.02, 0.28, 0.14, [0, 0, 1]);
  }

  // ---------------------------------------------------------------- stairs blockade (chapter IV)
  {
    const bk = new Kit(b, 0.88, Y0, -2.35, 0, { dynamic: true });
    bk.rbox(1.1, 0.5, 0.4, 0, 0.25, 0.05, M.furniture, 0, 0.2, 0);
    bk.rbox(0.9, 1.8, 0.35, 0.05, 0.8, -0.3, M.furniture, 0.5, 0.1, 0.1);
    bk.rbox(0.6, 0.45, 0.5, -0.1, 0.72, 0.1, M.cardboard, 0.1, 0.4, 0);
    bk.rbox(0.44, 0.9, 0.05, 0.3, 1.1, 0.2, M.furnitureLight, 0.3, -0.6, 1.2);
    bk.rbox(0.8, 0.1, 0.8, -0.2, 1.3, -0.2, M.sheet, 0.7, 0.2, 0.3);
    W.props.blockade = bk.group;
    W.blockadeCollider = game.physics.addBox(0.2, Y0, -2.9, 1.5, Y0 + 2.4, -1.75, { occlude: false, enabled: false });
    bk.group.visible = false;
  }

  b.finish();

  // ---------------------------------------------------------------- zones & triggers
  W.zone('hall', 'house', -1.5, -0.5, -9, 1.5, 2.5, 0);
  W.zone('stairs', 'house', 0.25, -0.5, -6.6, 1.5, 3.0, -2.0);
  W.zone('living', 'house', -8, -0.5, -7, -1.5, 2.5, 0);
  W.zone('dining', 'house', 1.5, -0.5, -5, 8, 2.5, 0);
  W.zone('pantry', 'house', 6.4, -0.5, -12, 8, 2.5, -10);
  W.zone('kitchen', 'house', 1.5, -0.5, -12, 8, 2.5, -5);
  W.zone('laundry', 'house', -8, -0.5, -12, -1.5, 2.5, -7);
  W.zone('cellarStairs', 'basement', -0.6, -3.6, -13.4, 0.6, 2.5, -9);
  W.zone('hallU', 'house', -1.5, 2.5, -12, 1.5, 6, 0);
  W.zone('ellie', 'house', -8, 2.5, -6, -1.5, 6, 0);
  W.zone('bath', 'house', -8, 2.5, -12, -1.5, 6, -6);
  W.zone('sam', 'house', 1.5, 2.5, -5, 8, 6, 0);
  W.zone('mom', 'house', 1.5, 2.5, -12, 8, 6, -5);
  W.zone('porch', 'exterior', -3.3, -1, 0, 3.3, 3, 3.6);

  W.trigger('foyer', -1.5, -0.5, -3.2, 1.5, 2.5, -0.35);
  W.trigger('kitchen', 1.6, -0.5, -12, 8, 2.5, -5.1);
  W.trigger('livingroom', -8, -0.5, -7, -1.6, 2.5, 0);
  W.trigger('upstairs', -1.5, 2.6, -12, 1.5, 6, 0);
  W.trigger('stairsDown', 0.25, -0.5, -6.0, 1.5, 2.0, -1.4);
  W.trigger('ellieRoom', -7.9, 2.5, -5.9, -1.65, 6, -0.1);
  W.trigger('ellieDoorway', -1.62, 2.5, -4.1, -1.2, 6, -3.2);
  W.trigger('bathroom', -7.9, 2.5, -11.9, -1.6, 6, -6.1);
  W.trigger('momRoom', 1.6, 2.5, -11.9, 7.9, 6, -5.1);
  W.trigger('cellar', -7, -4, -24, 7, -1.2, -13.0);

  return group;
}
