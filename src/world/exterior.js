// The yard at night: fog, pines, the car you came in, the mailbox, rain and lightning.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder, Kit, rectsMinus } from './builder.js';
import * as P from './props.js';
import { YARD } from './house.js';
import { mulberry32 } from '../core/util.js';

export function buildExterior(game) {
  const M = game.mats;
  const W = game.world;
  const group = new THREE.Group();
  W.root.add(group);
  const b = new Builder(game, group);
  const phys = game.physics;

  // ground, path, road
  b.box(-80, YARD - 0.3, -70, 80, YARD, 90, M.grass, { collide: false, faces: 4 });
  // the yard is walkable everywhere except under the house and over the cellar stairs
  for (const [x0, z0, x1, z1] of rectsMinus([-40, -40, 40, 60], [[-8.2, -12.2, 8.2, 0.2], [-0.7, -13.6, 0.7, -12.2]])) {
    phys.addFloor(x0, z0, x1, z1, YARD, 'grass');
  }
  b.box(-0.8, YARD, 3.4, 0.8, YARD + 0.012, 27.6, M.gravel, { collide: false, faces: 4 | 16 | 32 | 1 | 2 });
  phys.addFloor(-0.8, 3.4, 0.8, 27.6, YARD + 0.012, 'gravel');
  b.box(-80, YARD, 27.6, 80, YARD + 0.016, 33.2, M.asphalt, { collide: false, faces: 4 });
  phys.addFloor(-40, 27.6, 40, 33.2, YARD + 0.016, 'asphalt');
  // painted centre line
  for (let x = -60; x < 60; x += 4) b.box(x, YARD + 0.017, 30.35, x + 2, YARD + 0.018, 30.45, M.trimWhite, { collide: false, faces: 4 });

  // fences: front with a gate gap, sides, and back to the house corners
  let k = new Kit(b, -14, YARD, 25.8, 0);
  P.picketFence(k, M, 28, { gapFrom: 12.9, gapTo: 15.1 });
  phys.addBox(-14, YARD, 25.75, -1.1, YARD + 1.2, 25.85, { occlude: false });
  phys.addBox(1.1, YARD, 25.75, 14, YARD + 1.2, 25.85, { occlude: false });
  for (const x of [-14, 14]) {
    k = new Kit(b, x, YARD, 25.8, Math.PI / 2);
    P.picketFence(k, M, 26.3);
    phys.addBox(x - 0.05, YARD, -0.5, x + 0.05, YARD + 1.2, 25.8, { occlude: false });
  }
  for (const [x0, x1] of [[-14, -8.2], [8.2, 14]]) {
    k = new Kit(b, x0, YARD, -0.5, 0);
    P.picketFence(k, M, x1 - x0);
    phys.addBox(x0, YARD, -0.55, x1, YARD + 1.2, -0.45, { occlude: false });
  }
  // gate hanging open
  k = new Kit(b, 1.1, YARD, 25.8, -2.1);
  P.picketFence(k, M, 2.0);
  // invisible bounds beyond the road
  phys.addBox(-16, YARD, 34.5, 16, YARD + 3, 35, { occlude: false });
  phys.addBox(-16.5, YARD, 25.8, -16, YARD + 3, 35, { occlude: false });
  phys.addBox(16, YARD, 25.8, 16.5, YARD + 3, 35, { occlude: false });

  // mailbox (flag is live) — house number 57
  k = new Kit(b, 1.9, YARD, 26.5, Math.PI);
  P.mailbox(k, M);
  {
    const fk = new Kit(b, 1.9 + 0.14, YARD + 1.2, 26.5 - 0.05, Math.PI, { dynamic: true });
    fk.box(-0.01, 0, -0.02, 0.01, 0.22, 0.02, M.darkMetal);
    fk.box(-0.01, 0.14, -0.02, 0.012, 0.22, 0.1, M.ribbon);
    W.props.mailFlag = fk.group;
  }
  W.anchor('mailbox', 1.9, YARD + 1.2, 26.3);

  // the car, headlights on
  k = new Kit(b, 2.4, YARD + 0.016, 30.4, Math.PI);
  P.car(k, M);
  W.anchor('car', 2.4, YARD, 30.4);
  W.anchor('carDoor', 1.45, YARD + 1.0, 29.9);
  {
    const hl = new THREE.SpotLight(0xfff0d0, 0, 45, 0.42, 0.55, 1.4);
    hl.position.set(2.4, YARD + 0.75, 28.1);
    hl.target.position.set(0.5, YARD, 5);
    hl.castShadow = false;
    group.add(hl, hl.target);
    W.headlight = hl;
    // fake volumetric beams
    const coneGeo = new THREE.ConeGeometry(2.8, 14, 20, 1, true);
    coneGeo.translate(0, -7, 0);
    coneGeo.rotateX(-Math.PI / 2);
    const coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0.12 } },
      vertexShader: `varying float vD; varying vec3 vN; varying vec3 vV; void main(){ vD = -position.z / 14.0; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uOpacity; varying float vD; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(abs(dot(vN, vV)), 1.5); float a = uOpacity * (1.0 - vD) * (1.0 - vD) * rim; gl_FragColor = vec4(vec3(1.0,0.95,0.85) * a, a); }`,
    });
    W.beams = [];
    for (const dx of [-0.65, 0.65]) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(2.4 + dx, YARD + 0.72, 28.15);
      cone.lookAt(0.5 + dx, YARD + 0.2, 5);
      cone.renderOrder = 5;
      group.add(cone);
      W.beams.push(cone);
    }
    W.beamMat = coneMat;
  }

  // a dead oak in the yard and a few shrubs
  k = new Kit(b, -9.2, YARD, 11, 0);
  P.deadTree(k, M, 7);
  k = new Kit(b, 10.5, YARD, 17, 0);
  P.pine(k, M, { h: 10, r: 2.4 });
  for (const [x, z, s] of [[-5, 1.4, 1], [5.5, 1.3, 1.2], [-7.5, 3, 0.8], [7.2, 3.5, 0.9]]) {
    k = new Kit(b, x, YARD, z, 0);
    k.sphere(0.8 * s, 0, 0.45 * s, 0, M.foliage, { sy: 0.7, seg: 8 });
  }
  phys.addBox(-9.5, YARD, 10.7, -8.9, YARD + 3, 11.3);
  phys.addBox(10.3, YARD, 16.8, 10.7, YARD + 3, 17.2);

  b.finish();

  // forest: instanced pines
  {
    const trunk = new THREE.CylinderGeometry(0.14, 0.24, 4.5, 6);
    trunk.translate(0, 2.25, 0);
    const tiers = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const r = 2.3 * (1 - t * 0.78);
      const c = new THREE.ConeGeometry(r, 3.0, 7);
      c.translate(0, 2.2 + t * 7 + 1.5, 0);
      tiers.push(c);
    }
    const foliage = mergeGeometries(tiers);
    const rng = mulberry32(99);
    const spots = [];
    let tries = 0;
    while (spots.length < 220 && tries < 5000) {
      tries++;
      const x = (rng() - 0.5) * 130;
      const z = -60 + rng() * 140;
      const inYard = x > -16 && x < 16 && z > -14 && z < 26.5;
      const onRoad = z > 26 && z < 35;
      if (inYard || onRoad) continue;
      if (Math.abs(x) < 20 && z > -18 && z < 40 && rng() < 0.3) continue;
      spots.push([x, z, 0.7 + rng() * 0.7, rng() * Math.PI * 2]);
    }
    const tm = new THREE.InstancedMesh(trunk, M.bark, spots.length);
    const fm = new THREE.InstancedMesh(foliage, M.foliageDark, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, z, s, r], i) => {
      m4.compose(new THREE.Vector3(x, YARD, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(s, s * (0.9 + (i % 5) * 0.08), s));
      tm.setMatrixAt(i, m4);
      fm.setMatrixAt(i, m4);
    });
    tm.castShadow = fm.castShadow = false;
    tm.receiveShadow = fm.receiveShadow = true;
    group.add(tm, fm);
  }

  // sky dome
  {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: { value: new THREE.Color(0x0b0f14) },
        uZenith: { value: new THREE.Color(0x020306) },
        uFlash: { value: 0 },
        uMoon: { value: new THREE.Vector3(-0.5, 0.45, -0.75).normalize() },
        uDawn: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uHorizon; uniform vec3 uZenith; uniform float uFlash; uniform vec3 uMoon; uniform float uDawn; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
          float m = max(dot(vDir, uMoon), 0.0);
          col += vec3(0.25, 0.3, 0.4) * pow(m, 60.0) * 0.6 + vec3(0.08, 0.1, 0.14) * pow(m, 6.0) * 0.4;
          col += vec3(0.55, 0.6, 0.75) * uFlash * (0.4 + 0.6 * h);
          col = mix(col, mix(vec3(0.36,0.38,0.42), vec3(0.2,0.24,0.32), h), uDawn);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(95, 24, 12), skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    game.scene.add(sky);
    W.sky = sky;
    W.skyMat = skyMat;
  }

  // rain: world-anchored streaks around the camera, suppressed under the house and porch roofs
  {
    const N = 2600;
    const pos = new Float32Array(N * 2 * 3);
    const seed = new Float32Array(N * 2 * 3);
    const end = new Float32Array(N * 2);
    const rng = mulberry32(5);
    for (let i = 0; i < N; i++) {
      const s = [rng(), rng(), rng()];
      for (let e = 0; e < 2; e++) {
        seed.set(s, (i * 2 + e) * 3);
        end[i * 2 + e] = e;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('endp', new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uCenter: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uOpacity: { value: 0.22 },
        uFlash: { value: 0 },
      },
      vertexShader: `attribute vec3 seed; attribute float endp; uniform vec3 uCenter; uniform float uTime;
        varying float vA;
        void main(){
          float S = 26.0; float Hh = 14.0;
          vec3 p;
          p.x = uCenter.x - S*0.5 + mod(seed.x * S - uCenter.x, S);
          p.z = uCenter.z - S*0.5 + mod(seed.z * S - uCenter.z, S);
          float fall = mod(seed.y * Hh - uTime * 11.0, Hh);
          p.y = uCenter.y - 5.0 + fall - endp * 0.45;
          p.x += endp * 0.06;
          bool house = p.x > -8.3 && p.x < 8.3 && p.z > -12.3 && p.z < 0.3;
          bool porch = p.x > -3.4 && p.x < 3.4 && p.z > 0.0 && p.z < 2.9 && p.y < 2.9;
          if (house || porch || p.y < -0.62) p.y = -1000.0;
          vA = 1.0 - smoothstep(6.0, 13.0, length(p.xz - uCenter.xz));
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uOpacity; uniform float uFlash; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.6,0.66,0.78) * (1.0 + uFlash * 3.0), uOpacity * vA); }`,
    });
    const rain = new THREE.LineSegments(g, mat);
    rain.frustumCulled = false;
    rain.renderOrder = 4;
    game.scene.add(rain);
    W.rain = rain;
    W.rainMat = mat;
  }

  // moonlight + lightning
  {
    const moon = new THREE.DirectionalLight(0x8fa6c8, 0.0);
    moon.position.set(-30, 40, 25);
    moon.target.position.set(0, 0, 0);
    moon.castShadow = false;
    game.scene.add(moon, moon.target);
    W.moon = moon;
  }

  // zones & triggers
  W.zone('yard', 'exterior', -60, -0.75, -70, 60, 20, 90, -10);
  W.anchor('start', 0.3, YARD, 28.8, 0);
  W.trigger('yardSilhouette', -14, -2, 0, 14, 5, 19);
  W.trigger('yardNear', -14, -2, 0, 14, 5, 9);
  W.trigger('porchTop', -3.2, -1, -0.2, 3.2, 3, 3.6);
  W.trigger('carZone', -1.0, -2, 27.0, 5.5, 4, 34);
  return group;
}
