import * as THREE from 'three';
import { makeStatic } from '../engine/textures.js';
import { clamp, pick, rand } from '../core/util.js';

const _v = new THREE.Vector3();

/**
 * Keeps the dread going between the scripted scares: lightning, sounds that
 * come from just behind you, creaks overhead, the rocking chairs, the TV snow
 * and the clock. Each chapter sets a "stage" that decides what's allowed.
 */
export class Director {
  constructor(game, story) {
    this.game = game;
    this.story = story;
    this.stage = 'title';
    this.tension = 0;
    this.flicker = 0;
    this.nextLightning = 8;
    this.nextAmbient = 20;
    this.nextTick = 0;
    this.tick = 0;
    this.rockers = [];
    this.tv = makeStatic();
    this.tvMat = new THREE.MeshBasicMaterial({ map: this.tv.tex, color: 0xb8c0c8 });
    this.tvOnFlag = false;
    this.tvLoop = null;
    this.birdsT = 0;
    this.rockT = 0;
    const W = game.world;
    this.tvDarkMat = W.tvScreen?.material;
  }

  reset(stage) {
    this.stage = stage;
    this.tension = { title: 0.1, prologue: 0.2, arrival: 0.12, rules: 0.35, hallway: 0.55, hunt: 0.5, well: 0.6, after: 0 }[stage] ?? 0.2;
    this.flicker = 0;
    this.nextLightning = rand(6, 14);
    this.nextAmbient = rand(18, 30);
    this.setTV(false);
    this.inside = false;
  }

  setTV(on) {
    const W = this.game.world;
    if (!W.tvScreen) return;
    this.tvOnFlag = on;
    W.tvScreen.material = on ? this.tvMat : this.tvDarkMat;
    if (on && !this.tvLoop) this.tvLoop = this.game.audio.loopAt('static', W.anchors.tv.pos, 0.35, { ref: 1.2 });
    if (!on && this.tvLoop) {
      this.tvLoop.stop(0.05);
      this.tvLoop = null;
    }
  }

  lightningAllowed() {
    return ['title', 'arrival', 'rules', 'hunt', 'hallway'].includes(this.stage) && this.game.rainOn !== false;
  }

  update(dt) {
    const g = this.game;
    const W = g.world;
    const st = this.story;
    if (!W) return;

    // lightning
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      const hunt = this.stage === 'hunt';
      this.nextLightning = hunt ? rand(12, 24) : rand(16, 38);
      if (this.lightningAllowed() && !g.scares?.busy) g.lightning({ near: Math.random() < (hunt ? 0.35 : 0.2) });
    }

    // rocking chairs: they rock when you aren't looking
    this.rockT += dt;
    for (const [key, active] of [['porchRocker', this.stage === 'arrival' || this.stage === 'title'], ['rocker', (this.stage === 'arrival' && st.flags.power) || this.stage === 'rules']]) {
      const r = W.props[key];
      if (!r) continue;
      const d = r.userData;
      d.amp = d.amp ?? 0;
      let target = active ? 0.16 : 0;
      if (active && g.mode === 'play') {
        const p = r.getWorldPosition(_v);
        const looking = this.looking(p, 0.9) && g.camera.position.distanceTo(p) < 8;
        if (looking) target = 0.015;
      }
      d.amp += (target - d.amp) * Math.min(1, dt * (target > d.amp ? 0.6 : 1.5));
      d.phase = (d.phase ?? 0) + dt * 2.1;
      const prev = r.rotation.x;
      r.rotation.x = Math.sin(d.phase) * d.amp;
      if (d.amp > 0.05 && Math.sign(prev) !== Math.sign(r.rotation.x) && Math.random() < 0.6 && g.mode !== 'title') {
        g.audio.sfx('rockCreak', { pos: r.getWorldPosition(_v).setY(r.position.y + 0.4), vol: 0.35 * (d.amp / 0.16), rate: rand(0.9, 1.1) });
      }
    }

    // TV snow
    if (this.tvOnFlag) {
      this.tick++;
      if (this.tick % 2 === 0) this.tv.update();
    }

    // grandfather clock
    if ((this.stage === 'arrival' || this.stage === 'rules') && g.mode === 'play') {
      this.nextTick -= dt;
      if (this.nextTick <= 0) {
        this.nextTick = 1;
        this._tock = !this._tock;
        const cp = W.anchors.clock.pos;
        if (g.camera.position.distanceTo(cp) < 9) g.audio.sfx(this._tock ? 'tock' : 'tick', { pos: _v.set(cp.x, cp.y + 1.7, cp.z), vol: 0.35, ref: 1.5 });
      }
    }

    // birds at dawn
    if (this.stage === 'after') {
      this.birdsT -= dt;
      if (this.birdsT <= 0) {
        this.birdsT = rand(1.5, 5);
        this.chirp();
      }
    }

    // ambient events
    if (g.mode !== 'play' || g.scares?.busy || st.dead) return;
    this.nextAmbient -= dt;
    if (this.nextAmbient > 0) return;
    this.nextAmbient = { arrival: rand(22, 40), rules: rand(16, 30), hallway: rand(14, 24), hunt: rand(14, 26), well: rand(10, 18) }[this.stage] ?? 30;
    if (this.stage === 'arrival' && !this.inside) return;
    this.ambient();
  }

  looking(p, cos) {
    const g = this.game;
    const d = _v.copy(p).sub(g.camera.position).normalize();
    const f = g.camera.getWorldDirection(new THREE.Vector3());
    return f.dot(d) > cos;
  }

  /** A position relative to the player: behind, above, to the side. */
  around(kind) {
    const g = this.game;
    const p = g.player.pos;
    const f = g.player.facing();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    if (kind === 'behind') return p.clone().addScaledVector(f, -rand(1.0, 1.6)).addScaledVector(r, rand(-0.4, 0.4)).setY(p.y + 1.6);
    if (kind === 'above') return p.clone().addScaledVector(f, rand(-3, 3)).addScaledVector(r, rand(-3, 3)).setY(p.y + 3.1);
    if (kind === 'side') return p.clone().addScaledVector(r, pick([-1, 1]) * rand(2, 4)).setY(p.y + 1.2);
    return p.clone().addScaledVector(f, rand(-6, 6)).addScaledVector(r, rand(-6, 6)).setY(p.y + 1.2);
  }

  ambient() {
    const g = this.game;
    const a = g.audio;
    const upstairs = g.player.pos.y > 2.5;
    const pool = {
      arrival: ['creakAbove', 'knock', 'thudAbove', 'doorCreak', 'drip'],
      rules: ['whisperBehind', 'creakBehind', 'giggleFar', 'knock', 'doorCreak', 'breathBehind'],
      hallway: ['knockWall', 'drip', 'whisperBehind', 'creakBehind'],
      hunt: ['whisperBehind', 'giggleFar', 'doorCreak', 'creakBehind'],
      well: ['drip', 'drip', 'whisperBehind'],
    }[this.stage];
    if (!pool) return;
    let ev = pick(pool);
    if (ev === 'creakAbove' && upstairs) ev = 'creakBehind';
    switch (ev) {
      case 'creakAbove':
        a.sfx(pick(['floorCreak', 'floorCreak2', 'creak']), { pos: this.around('above'), vol: 0.7, rate: rand(0.7, 1) });
        break;
      case 'thudAbove':
        a.sfx('thud', { pos: this.around('above'), vol: 0.5, muffle: 700 });
        break;
      case 'knock':
        a.sfx(pick(['knock', 'knockSlow']), { pos: this.around('far'), vol: 0.6, muffle: 1200 });
        break;
      case 'knockWall':
        a.sfx('knockSlow', { pos: this.around('side'), vol: 0.8 });
        break;
      case 'doorCreak':
        a.sfx('creakLong', { pos: this.around('far'), vol: 0.5, muffle: 1500 });
        break;
      case 'drip':
        for (let i = 0; i < 3; i++) a.sfx('drip', { pos: this.around('far'), vol: 0.4, delay: i * rand(0.4, 0.9), rate: rand(0.8, 1.2) });
        break;
      case 'whisperBehind':
        a.sfx(pick(['whisper1', 'whisper2', 'whisper3', 'whisper4']), { pos: this.around('behind'), vol: 0.55 });
        g.fearTarget = Math.max(g.fearTarget, 0.45);
        break;
      case 'breathBehind':
        a.sfx('breathHer', { pos: this.around('behind'), vol: 0.5 });
        g.fearTarget = Math.max(g.fearTarget, 0.4);
        break;
      case 'creakBehind':
        a.sfx(pick(['floorCreak', 'floorCreak2']), { pos: this.around('behind').setY(g.player.pos.y + 0.1), vol: 0.7 });
        break;
      case 'giggleFar':
        a.sfx('giggle', { pos: this.around('far'), vol: 0.35, muffle: 2500 });
        break;
      default:
        break;
    }
  }

  chirp() {
    const g = this.game;
    const a = g.audio;
    if (!a.ready) return;
    const ctx = a.ctx;
    const pos = this.around('far').setY(4 + Math.random() * 4);
    const n = 2 + Math.floor(Math.random() * 4);
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.positionX.value = pos.x;
    panner.positionY.value = pos.y;
    panner.positionZ.value = pos.z;
    panner.refDistance = 4;
    panner.connect(a.sfxBus);
    const base = 2600 + Math.random() * 1600;
    let t = ctx.currentTime + 0.05;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.09);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(0.05, t + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(gn).connect(panner);
      o.start(t);
      o.stop(t + 0.12);
      t += 0.13 + Math.random() * 0.08;
    }
  }

  /** Is the player looking at world point p within angle (cos)? */
  lookingAt(p, cos = 0.9) {
    return this.looking(p, cos);
  }
}

export { clamp };
