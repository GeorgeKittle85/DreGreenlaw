// The bathroom medicine cabinet. Its door is a real mirror.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Y1 } from './house.js';
import { WALL_T } from './builder.js';
import { writing } from '../engine/textures.js';
import { mulberry32 } from '../core/util.js';

export function makeKey(M, color) {
  const g = new THREE.Group();
  const mat = color ? M.brass.clone() : M.brass;
  if (color) mat.color.set(color);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12), mat);
  ring.position.x = -0.03;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.007, 0.004), mat);
  shaft.position.x = 0.012;
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.004), mat);
  t1.position.set(0.03, -0.008, 0);
  const t2 = t1.clone();
  t2.position.x = 0.018;
  g.add(ring, shaft, t1, t2);
  return g;
}

export function buildMirror(game) {
  const M = game.mats;
  const W = game.world;
  const x = -3.3;
  const y = Y1 + 1.62;
  const z = -12 + WALL_T + 0.02;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  W.root.add(group);

  // cabinet box
  const woodM = M.trimWhite;
  const add = (w, h, d, px, py, pz, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(0.58, 0.02, 0.13, 0, -0.37, 0.065, woodM);
  add(0.58, 0.02, 0.13, 0, 0.37, 0.065, woodM);
  add(0.02, 0.76, 0.13, -0.29, 0, 0.065, woodM);
  add(0.02, 0.76, 0.13, 0.29, 0, 0.065, woodM);
  add(0.56, 0.74, 0.01, 0, 0, 0.005, M.black);
  add(0.54, 0.012, 0.11, 0, 0.0, 0.065, woodM);
  add(0.54, 0.012, 0.11, 0, 0.2, 0.065, woodM);
  const pill = new THREE.MeshStandardMaterial({ color: 0x8a4a12, roughness: 0.3, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8), pill);
    b.position.set(-0.2 + i * 0.09, 0.25, 0.07 + (i % 2) * 0.02);
    group.add(b);
  }
  const key = makeKey(M);
  key.position.set(0.02, 0.018, 0.08);
  key.rotation.x = -Math.PI / 2;
  group.add(key);
  W.props.bathKey = key;

  // the mirrored door, hinged on its left edge
  const pivot = new THREE.Group();
  pivot.position.set(-0.29, 0, 0.135);
  group.add(pivot);
  const frameMat = woodM;
  const fr = (w, h, px, py) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.022), frameMat);
    m.position.set(px, py, 0);
    m.castShadow = true;
    pivot.add(m);
    return m;
  };
  const frames = [fr(0.58, 0.04, 0.29, -0.36), fr(0.58, 0.04, 0.29, 0.36), fr(0.04, 0.76, 0.02, 0), fr(0.04, 0.76, 0.56, 0)];
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.68), woodM);
  back.position.set(0.29, 0, -0.012);
  back.rotation.y = Math.PI;
  pivot.add(back);
  const reflector = new Reflector(new THREE.PlaneGeometry(0.52, 0.68), {
    textureWidth: 640,
    textureHeight: 640,
    color: 0x8d8c86,
    clipBias: 0.002,
    multisample: 0,
  });
  reflector.position.set(0.29, 0, 0.012);
  pivot.add(reflector);

  // grime on the glass
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rng = mulberry32(44);
  for (let i = 0; i < 40; i++) {
    const gx = rng() * 256;
    const gy = rng() * 256;
    const r = 5 + rng() * 40;
    const grd = g.createRadialGradient(gx, gy, 0, gx, gy, r);
    grd.addColorStop(0, `rgba(60,55,45,${0.1 + rng() * 0.2})`);
    grd.addColorStop(1, 'rgba(60,55,45,0)');
    g.fillStyle = grd;
    g.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  g.strokeStyle = 'rgba(80,75,65,0.18)';
  for (let i = 0; i < 18; i++) {
    g.lineWidth = 2 + rng() * 8;
    g.beginPath();
    const sx = rng() * 256;
    g.moveTo(sx, rng() * 80);
    g.quadraticCurveTo(sx + (rng() - 0.5) * 60, 128, sx + (rng() - 0.5) * 80, 200 + rng() * 56);
    g.stroke();
  }
  const grimeTex = new THREE.CanvasTexture(c);
  grimeTex.colorSpace = THREE.SRGBColorSpace;
  // unlit on purpose: at arm's length the torch blows lit smears out into bright white stripes
  const grime = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.68), new THREE.MeshBasicMaterial({ map: grimeTex, color: 0x9a948a, transparent: true, depthWrite: false, opacity: 0.7 }));
  grime.position.set(0.29, 0, 0.014);
  grime.renderOrder = 6;
  pivot.add(grime);
  const msgMat = M.decal(writing(['NOT', 'ELLIE'], { w: 512, h: 512, color: '#6a0b12', size: 150, font: 'Caveat', seed: 31 }));
  msgMat.transparent = true;
  const msg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), msgMat);
  msg.position.set(0.29, 0, 0.016);
  msg.renderOrder = 7;
  msg.visible = false;
  pivot.add(msg);

  W.props.mirror = { group, pivot, reflector, frames, key, message: msg, angle: 0, target: 0 };
  W.updaters.push((dt) => {
    const m = W.props.mirror;
    const d = m.target - m.angle;
    const sp = m.speed ?? 2.4;
    if (Math.abs(d) > 1e-3) {
      m.angle += Math.sign(d) * Math.min(Math.abs(d), sp * dt * (0.3 + Math.min(1, Math.abs(d))));
      m.pivot.rotation.y = m.angle;
    }
  });
  W.anchor('mirrorFront', x, Y1, z + 0.75, 0);
}
