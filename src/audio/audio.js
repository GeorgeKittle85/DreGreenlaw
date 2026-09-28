import * as THREE from 'three';
import { renderAll, makeImpulse, noise } from './synth.js';
import { clamp, pick } from '../core/util.js';

/**
 * Live mixer: HRTF-positioned one-shots, ambience beds (rain, wind, drone,
 * electrical hum), heartbeat and breathing driven by fear, the music box,
 * ringing phones and TV static. Everything is procedural (see synth.js).
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = null;
    this.ready = false;
    this.volume = 0.8;
    this.fear = 0;
    this.tension = 0;
    this.exertion = 0;
    this.area = 'exterior';
    this.nextBeat = 0;
    this.loops = new Set();
    this._v = new THREE.Vector3();
    this._f = new THREE.Vector3();
    this._u = new THREE.Vector3();
  }

  async prerender(onProgress) {
    this.buffers = await renderAll(onProgress);
  }

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 10;
    comp.attack.value = 0.002;
    comp.release.value = 0.35;
    master.connect(comp);
    comp.connect(ctx.destination);
    this.master = master;

    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.sfxBus.connect(master);
    this.ambBus.connect(master);
    // global low-pass used to "deafen" the world for a moment after a scare
    this.deafen = ctx.createBiquadFilter();
    this.deafen.type = 'lowpass';
    this.deafen.frequency.value = 20000;
    this.ambBus.disconnect();
    this.ambBus.connect(this.deafen);
    this.deafen.connect(master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx, 2.6, 3.2);
    this.revSend = ctx.createGain();
    this.revSend.gain.value = 0.3;
    this.revSend.connect(this.reverb);
    this.reverb.connect(master);

    this._buildBeds();
    this.ready = true;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ------------------------------------------------------------------ beds
  _loopSrc(buf, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(0, Math.random() * buf.duration);
    return s;
  }

  _buildBeds() {
    const ctx = this.ctx;
    const pink = noise(ctx, 6, 'pink', 11);
    const brown = noise(ctx, 6, 'brown', 12);
    const white = noise(ctx, 4, 'white', 13);

    // rain: a hiss plus a sparse patter layer
    const patter = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    {
      const d = patter.getChannelData(0);
      for (let k = 0; k < 900; k++) {
        const i0 = Math.floor(Math.random() * (d.length - 400));
        const a = 0.2 + Math.random() * 0.8;
        const f = 0.2 + Math.random() * 0.6;
        for (let j = 0; j < 300; j++) d[i0 + j] += a * Math.sin(j * f) * Math.exp(-j / 40);
      }
    }
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.value = 7000;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    const r1 = this._loopSrc(pink);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;
    const r1g = ctx.createGain();
    r1g.gain.value = 0.5;
    r1.connect(hp).connect(r1g).connect(this.rainFilter);
    const r2 = this._loopSrc(patter);
    const r2g = ctx.createGain();
    r2g.gain.value = 0.3;
    r2.connect(r2g).connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain).connect(this.ambBus);

    // wind
    const w = this._loopSrc(brown);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 1.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 220;
    lfo.connect(lfoG).connect(this.windFilter.frequency);
    lfo.start();
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.13;
    const gustG = ctx.createGain();
    gustG.gain.value = 0.08;
    gust.connect(gustG).connect(this.windGain.gain);
    gust.start();
    w.connect(this.windFilter).connect(this.windGain).connect(this.ambBus);

    // drone: low detuned saws, a sub, a thin dissonant high whine
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 170;
    dlp.Q.value = 3;
    const dl = ctx.createOscillator();
    dl.frequency.value = 0.05;
    const dlg = ctx.createGain();
    dlg.gain.value = 60;
    dl.connect(dlg).connect(dlp.frequency);
    dl.start();
    for (const [f, v] of [[55, 0.35], [55.45, 0.35], [82.6, 0.12], [41.2, 0.4]]) {
      const o = ctx.createOscillator();
      o.type = f < 50 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = v;
      o.connect(g).connect(dlp);
      o.start();
    }
    dlp.connect(this.droneGain).connect(this.ambBus);
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    for (const f of [1318.5, 1396.9, 2093]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const trem = ctx.createOscillator();
      trem.frequency.value = 0.2 + Math.random() * 0.3;
      const tg = ctx.createGain();
      tg.gain.value = 0.3;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      trem.connect(tg).connect(g.gain);
      trem.start();
      o.connect(g).connect(this.whineGain);
      o.start();
    }
    this.whineGain.connect(this.ambBus);
    const rum = this._loopSrc(brown, 0.5);
    const rlp = ctx.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 90;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    rum.connect(rlp).connect(this.rumbleGain).connect(this.ambBus);

    // mains hum (power on)
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 60;
    const hlp = ctx.createBiquadFilter();
    hlp.type = 'lowpass';
    hlp.frequency.value = 260;
    hum.connect(hlp).connect(this.humGain).connect(this.ambBus);
    hum.start();

    // player breathing: band-passed noise gated by a breathing LFO
    this.breathGain = ctx.createGain();
    this.breathGain.gain.value = 0;
    const br = this._loopSrc(white);
    const bbp = ctx.createBiquadFilter();
    bbp.type = 'bandpass';
    bbp.frequency.value = 1100;
    bbp.Q.value = 0.9;
    this.breathLfo = ctx.createOscillator();
    this.breathLfo.frequency.value = 0.35;
    const shape = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.max(0, x) ** 1.5;
    }
    shape.curve = curve;
    const gate = ctx.createGain();
    gate.gain.value = 0;
    this.breathLfo.connect(shape).connect(gate.gain);
    this.breathLfo.start();
    br.connect(bbp).connect(gate).connect(this.breathGain).connect(this.sfxBus);
  }

  /** Per-area bed settings. */
  setArea(area, indoorsPowered = false) {
    this.area = area;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (p, v, tc = 0.8) => p.setTargetAtTime(v, t, tc);
    const out = area === 'exterior';
    const house = area === 'house';
    set(this.rainGain.gain, this.rainOn === false ? 0 : out ? 0.34 : house ? 0.12 : area === 'loop' ? 0.06 : 0.0);
    set(this.rainFilter.frequency, out ? 7000 : 750);
    set(this.windGain.gain, out ? 0.12 : house ? 0.03 : 0.0);
    set(this.humGain.gain, house && indoorsPowered ? 0.012 : 0);
    const wet = { exterior: 0.12, house: 0.28, basement: 0.5, loop: 0.34 }[area] ?? 0.25;
    set(this.revSend.gain, wet);
  }

  setRain(on) {
    this.rainOn = on;
    this.setArea(this.area, this.powered);
  }

  setPower(on) {
    this.powered = on;
    this.setArea(this.area, on);
  }

  // ------------------------------------------------------------------ one-shots
  /**
   * Play a prerendered sound. o: { pos (Vector3), vol, rate, delay, muffle, rev (reverb send 0..1), phone }
   * Returns { src, gain, panner, stop() }.
   */
  sfx(name, o = {}) {
    if (!this.ready || !this.buffers) return null;
    let buf = this.buffers[name];
    if (!buf) {
      console.warn('missing sound', name);
      return null;
    }
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = o.rate ?? 1;
    s.loop = !!o.loop;
    const g = ctx.createGain();
    g.gain.value = o.vol ?? 1;
    let node = s;
    if (o.muffle) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = typeof o.muffle === 'number' ? o.muffle : 900;
      node = node.connect(f);
    }
    if (o.phone) {
      const f1 = ctx.createBiquadFilter();
      f1.type = 'highpass';
      f1.frequency.value = 380;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = 3000;
      node = node.connect(f1).connect(f2);
    }
    node.connect(g);
    let panner = null;
    if (o.pos) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = o.ref ?? 1.4;
      panner.maxDistance = 60;
      panner.rolloffFactor = o.rolloff ?? 1.1;
      panner.positionX.value = o.pos.x;
      panner.positionY.value = o.pos.y;
      panner.positionZ.value = o.pos.z;
      g.connect(panner);
      panner.connect(o.bus || this.sfxBus);
      (o.rev !== 0 ? panner : null)?.connect(this.revSend);
    } else {
      g.connect(o.bus || this.sfxBus);
      if (o.rev) {
        const rg = ctx.createGain();
        rg.gain.value = o.rev;
        g.connect(rg).connect(this.revSend);
      }
    }
    const when = ctx.currentTime + (o.delay || 0);
    s.start(when, o.offset || 0);
    const h = {
      src: s,
      gain: g,
      panner,
      stop: (fade = 0.05) => {
        try {
          g.gain.setTargetAtTime(0, ctx.currentTime, fade);
          s.stop(ctx.currentTime + fade * 5);
        } catch (e) {
          /* already stopped */
        }
      },
      setPos: (p) => {
        if (!panner) return;
        panner.positionX.value = p.x;
        panner.positionY.value = p.y;
        panner.positionZ.value = p.z;
      },
    };
    if (o.loop) {
      this.loops.add(h);
      s.onended = () => this.loops.delete(h);
    }
    return h;
  }

  /** Stop every looping sound (chapter resets). */
  stopLoops() {
    for (const h of this.loops) h.stop(0.1);
    this.loops.clear();
    for (const mb of this._musicBoxes || []) mb.stop();
    this._musicBoxes = [];
    for (const r of this._rings || []) r.stop();
    this._rings = [];
  }

  footstep(surface, intensity, pos) {
    if (!this.ready) return;
    const name = `step_${surface}_${Math.floor(Math.random() * 3)}`;
    const p = pos ? this._v.set(pos.x, pos.y + 0.1, pos.z) : null;
    this.sfx(this.buffers[name] ? name : `step_wood_0`, { vol: 0.28 + intensity * 0.3, rate: 0.9 + Math.random() * 0.2, pos: p, ref: 2.5, rev: 0.3 });
    if (surface === 'wood' && Math.random() < 0.12) this.sfx(pick(['floorCreak', 'floorCreak2']), { vol: 0.12, rate: 0.9 + Math.random() * 0.3, pos: p, ref: 2 });
  }

  /** The dissonant "sting" + optional scream: the loud part of a jump scare. */
  scare({ scream = true, level = 1, pos = null } = {}) {
    this.sfx('stinger', { vol: 0.95 * level });
    if (scream) this.sfx(pick(['scream', 'scream2']), { vol: 1.0 * level, pos, ref: 3 });
    this.sfx('screech', { vol: 0.35 * level });
    this.duck(1.2);
  }

  /** Muffle the ambience for a moment (the "ears ringing" after a scare). */
  duck(sec = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.deafen.frequency.cancelScheduledValues(t);
    this.deafen.frequency.setValueAtTime(500, t);
    this.deafen.frequency.exponentialRampToValueAtTime(20000, t + sec + 1.5);
  }

  // ------------------------------------------------------------------ positional loops
  loopAt(name, pos, vol = 1, o = {}) {
    return this.sfx(name, { ...o, pos, vol, loop: true });
  }

  /** Twinkle Twinkle, in a minor key, from a music box that is winding down. */
  musicBox(pos, { slowdown = 0.02, vol = 0.5, onEnd } = {}) {
    if (!this.ready) return { stop() {} };
    const ctx = this.ctx;
    const N = { C: 523.25, D: 587.33, Eb: 622.25, F: 698.46, G: 783.99, Ab: 830.61, Bb: 932.33, C2: 1046.5 };
    const melody = ['C', 'C', 'G', 'G', 'Ab', 'Ab', 'G', '-', 'F', 'F', 'Eb', 'Eb', 'D', 'D', 'C', '-', 'G', 'G', 'F', 'F', 'Eb', 'Eb', 'D', '-', 'G', 'G', 'F', 'F', 'Eb', 'Eb', 'D', '-', 'C', 'C', 'G', 'G', 'Ab', 'Ab', 'G', '-', 'F', 'F', 'Eb', 'Eb', 'D', 'D', 'C'];
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.refDistance = 1.2;
    panner.rolloffFactor = 1.2;
    panner.positionX.value = pos.x;
    panner.positionY.value = pos.y;
    panner.positionZ.value = pos.z;
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(panner);
    panner.connect(this.sfxBus);
    panner.connect(this.revSend);
    let t = ctx.currentTime + 0.1;
    let dur = 0.42;
    let detune = 0;
    const nodes = [];
    for (let i = 0; i < melody.length; i++) {
      const n = melody[i];
      if (n !== '-') {
        const f = N[n] * (1 + detune + (Math.random() - 0.5) * 0.008);
        for (const [m, v, d] of [[1, 0.45, 1.6], [3.01, 0.12, 0.35], [5.93, 0.05, 0.12]]) {
          const o = ctx.createOscillator();
          o.frequency.value = f * m;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(v, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + d + 0.05);
          nodes.push(o);
        }
      }
      t += dur;
      dur *= 1 + slowdown;
      detune -= slowdown * 0.25;
    }
    const endAt = t;
    const h = {
      stop: () => {
        for (const o of nodes) {
          try {
            o.stop();
          } catch (e) {
            /* */
          }
        }
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      },
      endsIn: () => endAt - ctx.currentTime,
    };
    this._musicBoxes = this._musicBoxes || [];
    this._musicBoxes.push(h);
    if (onEnd) setTimeout(onEnd, (endAt - ctx.currentTime) * 1000);
    return h;
  }

  /** An old bell telephone ringing until stopped. */
  phone(pos, vol = 0.8) {
    if (!this.ready) return { stop() {} };
    let alive = true;
    let cur = null;
    const ring = () => {
      if (!alive) return;
      cur = this.sfx('phoneRing', { pos, vol, ref: 2.5 });
      timer = setTimeout(ring, 4000);
    };
    let timer = setTimeout(ring, 10);
    const h = {
      stop: () => {
        alive = false;
        clearTimeout(timer);
        cur?.stop(0.02);
      },
    };
    this._rings = this._rings || [];
    this._rings.push(h);
    return h;
  }

  // ------------------------------------------------------------------ per frame
  update(dt, camera, { fear, tension, exertion, areaTension = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const L = ctx.listener;
    camera.getWorldPosition(this._v);
    camera.getWorldDirection(this._f);
    this._u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (L.positionX) {
      L.positionX.value = this._v.x;
      L.positionY.value = this._v.y;
      L.positionZ.value = this._v.z;
      L.forwardX.value = this._f.x;
      L.forwardY.value = this._f.y;
      L.forwardZ.value = this._f.z;
      L.upX.value = this._u.x;
      L.upY.value = this._u.y;
      L.upZ.value = this._u.z;
    } else {
      L.setPosition(this._v.x, this._v.y, this._v.z);
      L.setOrientation(this._f.x, this._f.y, this._f.z, this._u.x, this._u.y, this._u.z);
    }
    const t = ctx.currentTime;
    const tens = clamp(Math.max(tension, areaTension), 0, 1);
    this.droneGain.gain.setTargetAtTime(0.05 + tens * 0.22 + fear * 0.1, t, 1.2);
    this.whineGain.gain.setTargetAtTime(tens > 0.35 ? (tens - 0.35) * 0.02 + fear * 0.015 : fear * 0.01, t, 1.5);
    this.rumbleGain.gain.setTargetAtTime(0.08 + tens * 0.4, t, 1.5);

    // breathing: exertion and fear
    const b = clamp(Math.max(exertion * 0.9, fear * 0.7), 0, 1);
    this.breathGain.gain.setTargetAtTime(b * 0.09, t, 0.5);
    this.breathLfo.frequency.setTargetAtTime(0.28 + b * 0.6, t, 0.8);

    // heartbeat
    if (fear > 0.22 && t >= this.nextBeat) {
      const bpm = 62 + fear * 85;
      this._beat(t, 0.25 + fear * 0.55);
      this.nextBeat = t + 60 / bpm;
    }
  }

  _beat(t, vol) {
    const ctx = this.ctx;
    for (const [dt, v, f] of [[0, 1, 62], [0.19, 0.6, 55]]) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f, t + dt);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dt + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(vol * v, t + dt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.18);
      o.connect(g).connect(this.sfxBus);
      o.start(t + dt);
      o.stop(t + dt + 0.25);
    }
    this.onBeat?.(vol);
  }
}
