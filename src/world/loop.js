// The hallway that shouldn't exist. Built twice: a normal one and a long one
// ("If the hallway is longer than it should be…").
import * as THREE from 'three';
import { Builder, Kit, WALL_T } from './builder.js';
import * as P from './props.js';
import { doorIn, hang } from './house.js';
import { writing } from '../engine/textures.js';

export function buildLoop(game, name, ox, L) {
  const M = game.mats;
  const W = game.world;
  const group = new THREE.Group();
  W.root.add(group);
  const b = new Builder(game, group);
  const T = WALL_T;
  const H = 2.7;
  const zc = -L - 1; // corner centre z
  const X = (x) => ox + x;

  const pStart = b.portal('z', 1.5, X(-0.45), X(0.45), 0, 2.08);
  const pCorner = b.portal('x', X(1), -L - 1.96, -L - 0.04, 0, H);
  const pExit = b.portal('x', X(7), zc - 0.45, zc + 0.45, 0, 2.08);
  const pBath = b.portal('x', X(1), -5.45, -4.55, 0, 2.08);
  const windows = [b.portal('x', X(-1), -3.6, -2.4, 0.95, 2.0)];
  if (L > 15) windows.push(b.portal('x', X(-1), -14.6, -13.4, 0.95, 2.0));

  b.room({ x0: X(-1), x1: X(1), z0: -L - 2, z1: 1.5, y: 0, h: H, floor: M.wood, ceil: M.ceiling, wall: M.wallHall, wainscot: M.wainscot, trim: M.trim });
  b.room({ x0: X(1), x1: X(7), z0: -L - 2, z1: -L, y: 0, h: H, floor: M.wood, ceil: M.ceiling, wall: M.wallHall, wainscot: M.wainscot, trim: M.trim });
  b.room({ x0: X(7), x1: X(9.5), z0: -L - 2, z1: -L, y: 0, h: H, floor: M.black, ceil: M.black, wall: M.black });
  b.room({ x0: X(1), x1: X(4), z0: -7, z1: -3, y: 0, h: H, floor: M.tileFloor, surface: 'tile', ceil: M.ceiling, wall: M.plaster, wainscot: M.tile, trim: M.trimWhite });
  b.casing(pCorner, M.trim);

  const glassMats = { trim: M.trim, glass: M.glass, rainGlass: M.rainGlass };
  for (const p of windows) {
    W.windows.push(b.window(p, glassMats));
    // what's outside: rain, dark trees
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), W.loopBackdropMat || (W.loopBackdropMat = makeBackdrop()));
    back.position.set(X(-3.2), 1.4, (p.a + p.b) / 2);
    back.rotation.y = Math.PI / 2;
    group.add(back);
    b.box(X(-3.4), 0, p.a - 1.4, X(-1.1), 2.8, p.a - 1.3, M.black, { collide: false });
    b.box(X(-3.4), 0, p.b + 1.3, X(-1.1), 2.8, p.b + 1.4, M.black, { collide: false });
    b.box(X(-3.4), -0.1, p.a - 1.4, X(-1.1), 0, p.b + 1.4, M.black, { collide: false });
    b.box(X(-3.4), 2.8, p.a - 1.4, X(-1.1), 2.9, p.b + 1.4, M.black, { collide: false });
  }

  const doors = {};
  doors.start = doorIn(game, b, M, `loopStart_${name}`, pStart, { hinge: 'a', into: 1, mat: M.doorWhite, locked: true, lockedText: "It won't open." });
  doors.bath = doorIn(game, b, M, `loopBath_${name}`, pBath, { hinge: 'b', into: 1, mat: M.doorWhite, locked: true, lockedText: "It won't open." });
  doors.exit = doorIn(game, b, M, `loopExit_${name}`, pExit, { hinge: 'a', into: 1, mat: M.doorWhite });
  b.decal(M.sign, X(0), 1.55, 1.5 - T - 0.02, 0.42, 0.21, [0, 0, -1]);

  // dressing
  b.decal(M.rugRunner, X(0), 0.004, -L / 2 + 0.5, L + 1.5, 0.95, [0, 1, 0], { rot: Math.PI / 2 });
  let k = new Kit(b, X(-1 + T + 0.2), 0, -6.5, Math.PI / 2);
  P.sideTable(k, M, { w: 0.8, d: 0.36, h: 0.8 });
  k = new Kit(b, X(-1 + T + 0.2), 0.8, -6.5, Math.PI / 2);
  P.radio(k, M);
  const pics = [
    [-1, -1.2, 'family'], [-1, -8.6, 'ellie'], [1, -1.6, 'christmas'], [1, -8.8, 'ellie_dark'],
  ];
  if (L > 15) pics.push([-1, -11.5, 'ellie'], [1, -12.2, 'ellie_dark'], [-1, -17.5, 'ellie_dark'], [1, -18.4, 'ellie'], [1, -15.5, 'mom']);
  const frames = [];
  for (const [side, z, ph] of pics) {
    const kk = hang(b, M, X(side * (1 - T - 0.02)), 1.6, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 0.38, h: 0.48, mat: M.photo[ph] });
    frames.push(kk);
  }
  // tilted versions of the same frames for loop 2 (hidden)
  const tilted = new THREE.Group();
  for (const [side, z] of pics) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), M.furniture);
    g.position.set(X(side * (1 - T - 0.035)), 1.6, z);
    g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.z = (Math.random() - 0.5) * 0.8;
    tilted.add(g);
  }
  tilted.visible = false;
  group.add(tilted);

  // bathroom: sink of black water
  k = new Kit(b, X(4 - T - 0.24), 0, -5.0, -Math.PI / 2);
  P.pedestalSink(k, M);
  k = new Kit(b, X(2.5), 0, -7 + T + 0.3, 0);
  P.toilet(k, M);
  b.decal(M.glassDark, X(4 - T - 0.005), 1.6, -5.0, 0.45, 0.6, [-1, 0, 0]);

  // writing for loop 3 (hidden until then)
  const scrawl = new THREE.Group();
  group.add(scrawl);
  const bw = new Builder(game, scrawl);
  const lines = ['YOU DIDNT LOOK FOR ME', 'I WAITED IN THE DARK', 'FOUR DAYS SAM', 'READY OR NOT'];
  const zs = L > 15 ? [-2, -6, -10, -14, -18] : [-2, -5.5, -8.5];
  zs.forEach((z, i) => {
    const t = lines[i % lines.length];
    const mat = M.decal(writing(t, { color: '#5e0707', seed: 20 + i, size: 76 }));
    bw.decal(mat, X(i % 2 ? 1 - T : -1 + T), 1.55, z, 2.6, 0.65, [i % 2 ? -1 : 1, 0, 0]);
  });
  bw.decal(M.handprints, X(0), 2.7 - 0.01, -3, 1.8, 1.8, [0, -1, 0]);
  bw.decal(M.handprints, X(6.9), 1.4, zc, 1.8, 1.8, [-1, 0, 0]);
  scrawl.visible = false;

  // the light at the end (loop 5)
  const exitGlow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.7), new THREE.MeshBasicMaterial({ color: 0xe8ecf0 }));
  exitGlow.position.set(X(9.45), 1.35, zc);
  exitGlow.rotation.y = -Math.PI / 2;
  exitGlow.visible = false;
  group.add(exitGlow);

  b.finish();

  // hanging bulbs (live, they swing)
  const bulbs = [];
  const bulbZ = L > 15 ? [-3.5, -10, -16, zc] : [-3.5, zc];
  for (const z of bulbZ) {
    const piv = new THREE.Group();
    piv.position.set(X(0), H, z);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), M.black);
    cord.position.y = -0.25;
    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.bulbOn);
    bulbMesh.position.y = -0.53;
    piv.add(cord, bulbMesh);
    group.add(piv);
    const fx = W.lights.add({ pos: new THREE.Vector3(X(0), H - 0.6, z), bulb: bulbMesh, zone: `loop_${name}`, intensity: 2.6, range: 7, power: false });
    bulbs.push({ piv, fx, swing: 0, phase: Math.random() * 6 });
  }
  const bathFx = W.lights.add({ pos: new THREE.Vector3(X(2.5), H - 0.4, -5), zone: `loop_${name}`, intensity: 1.8, range: 4, power: false, on: false });
  const exitFx = W.lights.add({ pos: new THREE.Vector3(X(8.6), 1.6, zc), color: 0xdde6f0, zone: `loop_${name}`, intensity: 5, range: 8, power: false, on: false });

  W.updaters.push((dt) => {
    const t = W.lights.time;
    for (const bl of bulbs) {
      bl.piv.rotation.z = Math.sin(t * 1.3 + bl.phase) * 0.06 * bl.swing;
      bl.piv.rotation.x = Math.cos(t * 1.1 + bl.phase) * 0.05 * bl.swing;
      const p = bl.piv.children[1].getWorldPosition(bl.fx.pos);
      p.y -= 0.05;
    }
  });

  W.zone(`loop_${name}`, 'loop', X(-4), -1, -L - 3, X(10), 4, 2);
  W.anchor(`loopStart_${name}`, X(0), 0, 0.85, 0);
  W.anchor(`loopCorner_${name}`, X(0), 0, zc, 0);
  W.anchor(`loopSink_${name}`, X(4 - T - 0.24), 0.85, -5.0);
  W.anchor(`loopExitDoor_${name}`, X(7), 0, zc);
  W.trigger(`loopExit_${name}`, X(7.35), -1, -L - 2, X(9.5), 4, -L);
  W.trigger(`loopB_${name}`, X(1.2), -1, -L - 2, X(7), 4, -L);
  W.trigger(`loopCorner_${name}`, X(-1), -1, -L - 2, X(1), 4, -L);
  W.trigger(`loopA_${name}`, X(-1), -1, -L, X(1), 4, 1.5);
  W.trigger(`loopBath_${name}`, X(1.1), -1, -7, X(4), 4, -3);

  const loop = { name, ox, L, zc, doors, bulbs, bathFx, exitFx, scrawl, tilted, exitGlow, group };
  W.loops = W.loops || {};
  W.loops[name] = loop;
  return loop;
}

function makeBackdrop() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 192);
  grd.addColorStop(0, '#0a0e16');
  grd.addColorStop(1, '#020304');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#000';
  for (let i = 0; i < 9; i++) {
    const x = i * 30 + Math.random() * 20;
    const w = 20 + Math.random() * 30;
    g.beginPath();
    g.moveTo(x, 192);
    g.lineTo(x + w / 2, 30 + Math.random() * 60);
    g.lineTo(x + w, 192);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, color: 0x303640 });
}
