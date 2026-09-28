// The cellar under Hollow Creek Road, and the old well at its heart.
import * as THREE from 'three';
import { Builder, Kit, WALL_T } from './builder.js';
import * as P from './props.js';
import { YB } from './house.js';
import { writing } from '../engine/textures.js';

export function buildBasement(game) {
  const M = game.mats;
  const W = game.world;
  const group = new THREE.Group();
  W.root.add(group);
  const b = new Builder(game, group);
  const T = WALL_T;
  const top = -0.8;
  const h = top - YB;

  b.room({ x0: -7, x1: 7, z0: -24, z1: -9, y: YB, h, floor: M.concrete, surface: 'stone', ceil: M.woodDark, wall: M.stone, floorHoles: [[-0.6, -13.4, 0.6, -9]], ceilHoles: [[-0.6, -13.4, 0.6, -9]] });
  // outside faces of the stair tunnel
  b.skin('x', -0.6, -1, -13.4, -9 + T, YB, top, M.stone);
  b.skin('x', 0.6, +1, -13.4, -9 + T, YB, top, M.stone);
  // joists
  const k = new Kit(b, 0, 0, 0, 0);
  for (let z = -23.4; z < -9.2; z += 0.8) k.box(-6.92, top - 0.16, z - 0.05, 6.92, top, z + 0.05, M.furniture);
  // posts
  for (const [x, z] of [[-3, -15], [3, -15], [-3, -21], [3, -21]]) {
    b.box(x - 0.1, YB, z - 0.1, x + 0.1, top, z + 0.1, M.furniture);
  }

  // the well, candles, Mom's chair
  let kk = new Kit(b, 0, YB, -18, 0);
  P.well(kk, M);
  W.anchor('well', 0, YB, -18);
  W.anchor('wellFront', 0, YB, -16.2, 0);
  kk = new Kit(b, 0, YB, -15.2, Math.PI);
  P.chair(kk, M);
  // Mom's cardigan over the chair back
  kk.rbox(0.46, 0.4, 0.06, 0, 0.82, -0.2, M.armchair, -0.1, 0, 0);
  const candleLights = [];
  {
    const ck = new Kit(b, 0, YB, -18, 0, { dynamic: true });
    const flames = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2;
      const r = 1.55;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const hgt = 0.14 + ((i * 7) % 5) * 0.03;
      P.candle(ck, M, x, z, hgt);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), M.flame.clone());
      flame.scale.set(1, 2.2, 1);
      flame.position.set(x, hgt + 0.03, z);
      ck.group.add(flame);
      flames.push(flame);
    }
    W.props.candles = ck.group;
    W.props.flames = flames;
    // three pooled "candle" fixtures cover the ring
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const fx = W.lights.add({ pos: new THREE.Vector3(Math.cos(a) * 1.4, YB + 0.5, -18 + Math.sin(a) * 1.4), color: 0xff9a4a, intensity: 1.6, range: 7, zone: 'cellar', kind: 'candle', power: false, on: true });
      candleLights.push(fx);
    }
    W.fixtures.candles = candleLights;
  }

  // shelves of jars, the furnace, boxes
  kk = new Kit(b, -6.72, YB, -12.5, Math.PI / 2);
  P.shelves(kk, M, { w: 1.6, h: 2.0, d: 0.45, mat: M.furniture });
  kk = new Kit(b, -6.72, YB, -20.5, Math.PI / 2);
  P.shelves(kk, M, { w: 1.6, h: 2.0, d: 0.45, mat: M.furniture });
  kk = new Kit(b, 6.72, YB, -16, -Math.PI / 2);
  P.shelves(kk, M, { w: 2.0, h: 2.0, d: 0.45 });
  kk = new Kit(b, 5.4, YB, -22.6, 0);
  P.furnace(kk, M);
  kk = new Kit(b, -4.8, YB, -23.4, 0);
  P.cardboardBoxes(kk, M, { n: 3 });
  kk = new Kit(b, 3.2, YB, -10.0, 0);
  P.cardboardBoxes(kk, M, { n: 2 });

  // what Mom wrote down here
  b.decal(M.tally, -3.5, YB + 1.5, -24 + T + 0.01, 3.2, 1.6, [0, 0, 1]);
  b.decal(M.tally, 3.8, YB + 1.3, -24 + T + 0.01, 3.0, 1.5, [0, 0, 1], { rot: 0.03 });
  const say = (text, x, y, z, w, hh, n, opts = {}) => b.decal(M.decal(writing(text, { color: opts.color || '#e8e0cc', font: opts.font || 'Caveat', size: opts.size || 80, seed: opts.seed || 3 })), x, y, z, w, hh, n);
  say(['ELEANOR MARLOW', 'ELEANOR MARLOW', 'ELEANOR MARLOW'], 0, YB + 1.6, -24 + T + 0.01, 3.4, 1.2, [0, 0, 1], { size: 70 });
  say('COME HOME', 6.92 - 0.0, YB + 1.9, -20.2, 2.4, 0.6, [-1, 0, 0], { color: '#5e0707', font: 'Schoolbell' });
  say('GIVE HER BACK', -6.92, YB + 1.5, -16.5, 2.6, 0.65, [1, 0, 0], { color: '#5e0707', font: 'Schoolbell', seed: 9 });
  for (const [x, z, n, name] of [[-6.9, -18.2, [1, 0, 0], 'well'], [-6.9, -14.6, [1, 0, 0], 'tall'], [6.9, -12.4, [-1, 0, 0], 'sam'], [6.9, -19.8, [-1, 0, 0], 'eyes']]) {
    b.decal(M.drawing[name], x, YB + 1.45, z, 0.45, 0.45, n);
  }
  b.decal(M.handprints, 0, YB + 0.02, -18, 3.6, 3.6, [0, 1, 0]);

  b.finish();

  // Ellie's hands (hidden until the end)
  {
    const hands = new THREE.Group();
    const mat = M.herSkin.clone();
    mat.emissive = new THREE.Color(0x303030);
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.9, 7), mat);
      fore.position.y = 0.45;
      arm.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat);
      hand.scale.set(1, 1.3, 0.6);
      hand.position.y = 0.92;
      arm.add(hand);
      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.07, 5), mat);
        fin.position.set(-0.03 + f * 0.02, 0.99, 0);
        arm.add(fin);
      }
      arm.position.set(s * 0.2, -1.2, 0);
      arm.rotation.z = -s * 0.25;
      hands.add(arm);
    }
    hands.position.set(0, YB + 0.5, -18);
    hands.visible = false;
    group.add(hands);
    W.props.wellHands = hands;
  }

  W.zone('cellar', 'basement', -7, -4, -24, 7, -0.9, -9);
  return group;
}
