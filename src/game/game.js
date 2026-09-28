import * as THREE from 'three';
import { Renderer } from '../engine/renderer.js';
import { Input } from '../engine/input.js';
import { Physics } from '../engine/physics.js';
import { createMaterials } from '../engine/materials.js';
import { Audio } from '../audio/audio.js';
import { Scheduler } from '../core/scheduler.js';
import { World } from '../world/world.js';
import { buildHouse, YARD } from '../world/house.js';
import { buildExterior } from '../world/exterior.js';
import { buildBasement } from '../world/basement.js';
import { buildLoop } from '../world/loop.js';
import { buildMirror } from '../world/mirror.js';
import { Player } from './player.js';
import { Interact } from './interact.js';
import { Flashlight } from './flashlight.js';
import { clamp, damp, lerp, rand, nextFrame } from '../core/util.js';

const ENV = {
  exterior: { fog: 0x0b1016, density: 0.05, sky: 0x2e3d55, ground: 0x0b0b0d, hemi: 0.9, moon: 0.45 },
  house: { fog: 0x030304, density: 0.06, sky: 0x1d2433, ground: 0x0a0908, hemi: 0.16, moon: 0 },
  basement: { fog: 0x040302, density: 0.075, sky: 0x1a1612, ground: 0x050403, hemi: 0.07, moon: 0 },
  loop: { fog: 0x040404, density: 0.065, sky: 0x1e1c1a, ground: 0x080706, hemi: 0.1, moon: 0 },
  dawn: { fog: 0x6b717a, density: 0.028, sky: 0x9aa6b8, ground: 0x2a2a26, hemi: 2.2, moon: 1.4 },
};

export const DEFAULT_SETTINGS = { sensitivity: 1, volume: 0.8, brightness: 0.35, invertY: false, retro: true, quality: 'medium' };

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 140);
    this.scene.add(this.camera);
    this.physics = new Physics();
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.sched = new Scheduler();
    this.settings = { ...DEFAULT_SETTINGS, ...loadJSON('comehome.settings') };
    this.mode = 'loading';
    this.running = false;
    this.time = 0;
    this.timeScale = 1;
    this.fear = 0;
    this.fearTarget = 0;
    this.tension = 0;
    this.flash = 0;
    this.flashQueue = [];
    this.env = { ...ENV.exterior };
    this.envName = 'exterior';
    this.envOverride = null;
    this.fx = { aberration: 0, distort: 0, static: 0, red: 0, whiteFlash: 0, blackout: 0, face: 0 };
    this.fxDecay = { aberration: 1.5, distort: 3, static: 4, red: 1.2, whiteFlash: 6, face: 30 };
    this.hooks = [];
    this.debug = { noclip: false };
    this.lastFrame = performance.now();
  }

  async init(progress) {
    progress(0.05, 'painting the walls…');
    await nextFrame();
    try {
      await document.fonts.ready;
      await Promise.all(['40px Schoolbell', '40px Caveat', '40px Fell', '40px Elite'].map((f) => document.fonts.load(f)));
    } catch (e) {
      /* fonts are a nicety */
    }
    let step = 0;
    this.mats = createMaterials(() => progress(0.05 + (++step / 7) * 0.35, 'painting the walls…'));
    await nextFrame();
    progress(0.42, 'building the house…');
    this.world = new World(this);
    buildHouse(this);
    await nextFrame();
    buildExterior(this);
    buildBasement(this);
    buildLoop(this, 'short', 200, 10);
    buildLoop(this, 'long', 260, 22);
    buildMirror(this);
    await nextFrame();
    progress(0.6, 'turning out the lights…');

    this.hemi = new THREE.HemisphereLight(0x2e3d55, 0x0b0b0d, 0.5);
    this.scene.add(this.hemi);
    this.scene.fog = new THREE.FogExp2(0x0b1016, 0.05);
    this.scene.background = new THREE.Color(0x000000);

    this.player = new Player(this);
    this.flashlight = new Flashlight(this);
    this.interact = new Interact(this);
    for (const h of this.hooks) h.init?.(this);

    this.applySettings();
    window.addEventListener('resize', () => this.renderer.resize(this.camera));
    this.renderer.resize(this.camera);

    progress(0.65, 'recording the voicemail…');
    await this.audio.prerender((f) => progress(0.65 + f * 0.33, 'recording the voicemail…'));
    progress(1, '');
    // compile shaders up front so the first scare doesn't hitch
    this.player.teleport(this.world.anchors.start.pos, 0);
    this.renderer.gl.compile(this.scene, this.camera);
  }

  applySettings() {
    const s = this.settings;
    this.renderer.setQuality(s.quality);
    this.renderer.setRetro(s.retro);
    this.renderer.resize(this.camera);
    this.renderer.uniforms.uBrightness.value = s.brightness;
    this.audio.setVolume(s.volume);
    const size = this.renderer.shadowSize;
    const sh = this.flashlight?.spot.shadow;
    if (sh && sh.mapSize.x !== size) {
      sh.mapSize.set(size, size);
      sh.map?.dispose();
      sh.map = null;
    }
    saveJSON('comehome.settings', s);
  }

  // ------------------------------------------------------------------ environment
  setEnv(name, instant = false) {
    this.envName = name;
    if (instant) Object.assign(this.env, ENV[name]);
  }

  /** Lightning: a few quick pulses, thunder after a delay. */
  lightning({ near = false, delay = null, silent = false } = {}) {
    const t = this.time;
    const pulses = near ? [[0, 0.8], [0.07, 0.25], [0.12, 1.2], [0.3, 0.6]] : [[0, 0.5], [0.09, 0.9], [0.22, 0.35]];
    for (const [dt, v] of pulses) this.flashQueue.push({ at: t + dt, v });
    if (!silent) {
      const d = delay ?? (near ? 0.15 : rand(1.2, 3.5));
      this.audio.sfx(near ? 'thunderNear' : Math.random() < 0.5 ? 'thunderFar' : 'thunderFar2', { vol: near ? 0.95 : 0.6, delay: d, muffle: this.envName === 'exterior' ? 0 : 1500 });
    }
  }

  // ------------------------------------------------------------------ effects
  /** Fade the world to black (1) or back (0) over `sec` seconds of game time. */
  fadeTo(target, sec) {
    this.fadeTarget = target;
    this.fadeRate = sec > 0 ? 1 / sec : Infinity;
    if (!(sec > 0)) this.fx.blackout = target;
  }

  /** Same, but to white. */
  whiteTo(target, sec) {
    this.whiteTarget = target;
    this.whiteRate = sec > 0 ? 1 / sec : Infinity;
    if (!(sec > 0)) this.whiteLevel = target;
  }

  kick(name, v) {
    this.fx[name] = Math.max(this.fx[name], v);
  }

  scareFx(level = 1) {
    this.kick('aberration', 1.6 * level);
    this.kick('distort', 0.8 * level);
    this.kick('red', 0.35 * level);
    this.player.shake(0.9 * level);
    this.fearTarget = Math.max(this.fearTarget, 0.9);
    this.fear = Math.max(this.fear, 0.8 * level);
  }

  // ------------------------------------------------------------------ frame
  frame(now) {
    const rawDt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const dt = Math.min(0.05, rawDt) * this.timeScale;
    if (!this.debug.manual) this.step(dt);
    if (!this.debug.noRender) this.renderFrame(dt);
  }

  /** Advance the simulation by dt (also used by the test harness to run faster than real time). */
  step(dt) {
    if (this.running) this.tick(dt);
    else if (this.mode === 'title') this.tickTitle(dt);
    this.input.endFrame();
    // rendering normally refreshes world matrices; headless stepping must do it itself
    if (this.debug.noRender) this.scene.updateMatrixWorld();
  }

  tick(dt) {
    this.time += dt;
    const steps = Math.max(1, Math.ceil(dt / 0.034));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.sched.update(sdt);
      for (const h of this.hooks) h.preUpdate?.(sdt);
      if (!this.debug.noclip) this.player.update(sdt);
      else this.noclip(sdt);
      this.world.update(sdt);
      for (const h of this.hooks) h.update?.(sdt);
    }
    this.flashlight.update(dt);
    this.interact.update();
    if (this.player.canMove && this.input.interactPressed()) this.interact.use();
    if (this.input.hit('KeyF')) this.flashlight.toggle();
    this.updateEnvironment(dt);
    this.ui.update(dt);
    this.ui.stamina(this.player.stamina, this.player.stamina < 0.98);
  }

  noclip(dt) {
    const p = this.player;
    const input = this.input;
    p.yaw -= input.mdx * 0.0022 * this.settings.sensitivity;
    p.pitch = clamp(p.pitch - input.mdy * 0.0022 * this.settings.sensitivity, -1.5, 1.5);
    const a = input.moveAxis();
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    p.pos.addScaledVector(f, a.y * 6 * dt).addScaledVector(r, a.x * 6 * dt);
    p.syncCamera(dt);
  }

  tickTitle(dt) {
    this.time += dt;
    const t = this.time * 0.05;
    const r = 24;
    this.camera.position.set(Math.sin(t) * r * 0.5 + 2, 1.2 + Math.sin(t * 0.7) * 0.4, 16 + Math.cos(t) * 5);
    this.camera.lookAt(0, 2.8, -4);
    this.world.update(dt);
    for (const h of this.hooks) h.titleUpdate?.(dt);
    this.flashlight.level = 0;
    this.flashlight.spot.intensity = 0;
    this.flashlight.fill.intensity = 0;
    this.updateEnvironment(dt);
  }

  updateEnvironment(dt) {
    const W = this.world;
    const cam = this.camera.position;
    const zone = W.zoneAt(cam);
    this.zone = zone;
    let area = zone ? zone.area : 'exterior';
    if (this.envOverride) area = this.envOverride;
    if (area !== this.envName) {
      this.envName = area;
      this.audio.setArea(area === 'dawn' ? 'exterior' : area, W.lights.power);
    }
    const target = ENV[area] || ENV.exterior;
    const e = this.env;
    const k = 1 - Math.exp(-3 * dt);
    const fogC = this.scene.fog.color;
    fogC.lerp(new THREE.Color(target.fog), k);
    this.scene.fog.density = lerp(this.scene.fog.density, target.density, k);
    e.hemi = lerp(e.hemi ?? target.hemi, target.hemi, k);
    e.moon = lerp(e.moon ?? target.moon, target.moon, k);
    this.hemi.color.lerp(new THREE.Color(target.sky), k);
    this.hemi.groundColor.lerp(new THREE.Color(target.ground), k);

    // lightning pulses
    let f = 0;
    this.flashQueue = this.flashQueue.filter((q) => {
      if (this.time >= q.at) {
        this.flash = Math.max(this.flash, q.v);
        return false;
      }
      return true;
    });
    this.flash = damp(this.flash, 0, 14, dt);
    f = this.flash;
    const inside = area !== 'exterior' && area !== 'dawn';
    this.hemi.intensity = e.hemi + f * (inside ? 1.6 : 5);
    if (W.moon) W.moon.intensity = e.moon + f * (inside ? 0.0 : 6);
    if (W.skyMat) W.skyMat.uniforms.uFlash.value = f;
    if (W.rainMat) {
      W.rainMat.uniforms.uFlash.value = f;
      W.rainMat.uniforms.uTime.value = this.time;
      W.rainMat.uniforms.uCenter.value.copy(cam);
      W.rain.visible = this.rainOn !== false && (area === 'exterior' || area === 'house');
    }
    const g = this.mats.glass;
    g.emissive.setRGB(0.25, 0.3, 0.42);
    g.emissiveIntensity = 0.12 + f * 6;
    if (W.loopBackdropMat) W.loopBackdropMat.color.setScalar(0.19 + f * 2.5);
    this.mats.rainGlassTex.offset.y = (this.time * 0.08) % 1;

    W.lights.update(dt, cam, zone ? zone.name : null);

    // fear / tension → post fx + audio
    this.fearTarget = damp(this.fearTarget, 0, 0.35, dt);
    this.fear = damp(this.fear, Math.max(this.fearTarget, this.tension * 0.35), this.fear > this.fearTarget ? 0.6 : 2.5, dt);
    const step = (cur, target, rate) => {
      if (cur === target || target === undefined) return cur;
      const d = target - cur;
      const m = rate * dt;
      return Math.abs(d) <= m ? target : cur + Math.sign(d) * m;
    };
    this.fx.blackout = step(this.fx.blackout, this.fadeTarget, this.fadeRate ?? 1);
    this.whiteLevel = step(this.whiteLevel ?? 0, this.whiteTarget, this.whiteRate ?? 1);
    const u = this.renderer.uniforms;
    u.uAberration.value = 0.12 + this.fear * 0.45 + this.fx.aberration;
    u.uGrain.value = 0.06 + this.fear * 0.05 + this.tension * 0.02;
    u.uVignette.value = 0.25 + this.fear * 0.45;
    u.uDistort.value = this.fx.distort;
    u.uStatic.value = clamp(this.fx.static, 0, 1);
    u.uRed.value = clamp(this.fx.red, 0, 1);
    u.uFlash.value = this.fx.whiteFlash + (this.whiteLevel ?? 0);
    u.uBlackout.value = clamp(this.fx.blackout, 0, 1);
    u.uFace.value = clamp(this.fx.face, 0, 1);
    // decay after reading, so a kick is always seen at full strength for a frame
    // (scripts resume after the frame's update, and a face set there must not arrive pre-faded)
    for (const k2 of Object.keys(this.fxDecay)) this.fx[k2] = damp(this.fx[k2], 0, this.fxDecay[k2], dt);
    u.uDesat.value = 0.28 + this.tension * 0.2;
    u.uPulse.value = damp(u.uPulse.value, 0, 6, dt);
    const exertion = 1 - this.player.stamina;
    this.audio.update(dt, this.camera, { fear: this.fear, tension: this.tension, exertion: this.player.exhausted ? 1 : exertion * 0.8 });
  }

  renderFrame() {
    this.renderer.render(this.scene, this.camera, this.time);
  }
}

export function loadJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || {};
  } catch (e) {
    return {};
  }
}

export function saveJSON(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    /* storage unavailable */
  }
}

export { YARD };
