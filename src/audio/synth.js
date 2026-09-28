// Offline sound design. Every sound in the game is synthesised here into an
// AudioBuffer (rendered with OfflineAudioContext before the first click).
import { mulberry32 } from '../core/util.js';

const SR = 44100;

function noise(c, sec, kind = 'white', seed = 1) {
  const rng = mulberry32(seed);
  const n = Math.max(1, Math.floor(sec * c.sampleRate));
  const b = c.createBuffer(1, n, c.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return b;
}

function src(c, buf, t = 0, { loop = false, rate = 1 } = {}) {
  const s = c.createBufferSource();
  s.buffer = buf;
  s.loop = loop;
  s.playbackRate.value = rate;
  s.start(t);
  return s;
}

function osc(c, type, f, t = 0, stop = null) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.start(t);
  if (stop !== null) o.stop(stop);
  return o;
}

function bq(c, type, f, Q = 1, gain = 0) {
  const b = c.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = Q;
  b.gain.value = gain;
  return b;
}

function gain(c, v = 1) {
  const g = c.createGain();
  g.gain.value = v;
  return g;
}

/** points: [[t, v], ...] with exponential-ish curves ('e') or linear ramps */
function env(param, pts, t0 = 0) {
  param.cancelScheduledValues(0);
  param.setValueAtTime(pts[0][1], t0 + pts[0][0]);
  for (let i = 1; i < pts.length; i++) {
    const [t, v, mode] = pts[i];
    if (mode === 'e') param.exponentialRampToValueAtTime(Math.max(v, 1e-4), t0 + t);
    else param.linearRampToValueAtTime(v, t0 + t);
  }
}

function shaper(c, drive = 3) {
  const ws = c.createWaveShaper();
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  ws.curve = curve;
  ws.oversample = '4x';
  return ws;
}

function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

// ------------------------------------------------------------------ recipes
// Each recipe: { dur, ch?, fn(c, out) } — out is the destination to connect to.

function creakRecipe(dur, pitch, seed) {
  return {
    dur,
    fn(c, out) {
      const rng = mulberry32(seed);
      const n = Math.floor(dur * c.sampleRate);
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      let t = 0.02;
      while (t < dur - 0.05) {
        const u = t / dur;
        const shape = Math.pow(Math.sin(u * Math.PI), 0.6);
        const rate = pitch * (22 + 70 * shape + 30 * Math.sin(u * 11.7 + seed) * 0.5 + 18 * Math.sin(u * 37.1)) * (0.8 + rng() * 0.4);
        const amp = shape * (0.55 + rng() * 0.45) * (rng() < 0.04 ? 0.2 : 1);
        const i0 = Math.floor(t * c.sampleRate);
        for (let k = 0; k < 90 && i0 + k < n; k++) d[i0 + k] += amp * (rng() * 2 - 1) * Math.exp(-k / 9);
        t += 1 / Math.max(8, rate);
      }
      const s = src(c, buf);
      const mix = gain(c, 1);
      for (const [f, q, g] of [[380 * pitch, 14, 1.0], [920 * pitch, 11, 0.8], [2100 * pitch, 8, 0.45], [160, 4, 0.5]]) {
        const bp = bq(c, 'bandpass', f, q);
        const gg = gain(c, g * 3.2);
        chain(s, bp, gg, mix);
      }
      chain(s, bq(c, 'highpass', 2500, 0.7), gain(c, 0.08), mix);
      chain(mix, shaper(c, 1.6), gain(c, 0.9), out);
    },
  };
}

function thump(c, out, t, f0, f1, dec, vol) {
  const o = osc(c, 'sine', f0, t, t + dec + 0.1);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.6);
  const g = gain(c, 0);
  env(g.gain, [[0, 0], [0.004, vol], [dec, 0.0001, 'e']], t);
  chain(o, g, out);
}

function burst(c, out, t, dur, { type = 'lowpass', f = 1200, q = 0.7, vol = 0.8, seed = 3, attack = 0.002, kind = 'white' } = {}) {
  const s = src(c, noise(c, dur + 0.05, kind, seed), t);
  const g = gain(c, 0);
  env(g.gain, [[0, 0], [attack, vol], [dur, 0.0001, 'e']], t);
  chain(s, bq(c, type, f, q), g, out);
}

const R = {};

R.creak = creakRecipe(1.1, 1.0, 11);
R.creak2 = creakRecipe(0.9, 1.25, 12);
R.creakLong = creakRecipe(3.6, 0.8, 13);
R.floorCreak = creakRecipe(0.55, 1.5, 14);
R.floorCreak2 = creakRecipe(0.7, 1.1, 15);
R.rockCreak = creakRecipe(0.5, 0.9, 16);

R.doorShut = {
  dur: 0.5,
  fn(c, out) {
    thump(c, out, 0.0, 120, 70, 0.18, 0.7);
    burst(c, out, 0, 0.06, { f: 1400, vol: 0.5 });
    burst(c, out, 0.03, 0.02, { type: 'bandpass', f: 3200, q: 3, vol: 0.5, seed: 4 });
  },
};

R.doorSlam = {
  dur: 1.6,
  fn(c, out) {
    thump(c, out, 0, 95, 40, 0.5, 1.0);
    burst(c, out, 0, 0.12, { f: 2200, vol: 1.0 });
    burst(c, out, 0, 0.35, { f: 380, q: 1, vol: 0.9, kind: 'brown', seed: 9 });
    for (let i = 0; i < 7; i++) burst(c, out, 0.06 + i * 0.045 + Math.random() * 0.02, 0.03, { type: 'bandpass', f: 2600 + i * 200, q: 4, vol: 0.35 * (1 - i / 8), seed: 20 + i });
  },
};

R.doorBang = {
  dur: 1.2,
  fn(c, out) {
    thump(c, out, 0, 80, 45, 0.35, 0.9);
    burst(c, out, 0, 0.09, { f: 1800, vol: 0.9 });
    burst(c, out, 0.12, 0.05, { f: 900, vol: 0.4, seed: 5 });
  },
};

R.knock = {
  dur: 1.4,
  fn(c, out) {
    for (const t of [0, 0.28, 0.56]) {
      thump(c, out, t, 190, 120, 0.12, 0.9);
      burst(c, out, t, 0.05, { type: 'bandpass', f: 520, q: 2, vol: 0.8, seed: Math.floor(t * 100) });
    }
  },
};

R.knockSlow = {
  dur: 3.2,
  fn(c, out) {
    for (const t of [0, 1.0, 2.3]) {
      thump(c, out, t, 150, 90, 0.2, 1.0);
      burst(c, out, t, 0.07, { type: 'bandpass', f: 420, q: 2, vol: 0.9, seed: Math.floor(t * 100) });
    }
  },
};

R.thud = {
  dur: 1.2,
  fn(c, out) {
    thump(c, out, 0, 70, 32, 0.7, 1.0);
    burst(c, out, 0, 0.25, { f: 500, vol: 0.8, kind: 'brown', seed: 7 });
  },
};

R.runSteps = {
  dur: 2.0,
  fn(c, out) {
    let t = 0;
    for (let i = 0; i < 9; i++) {
      thump(c, out, t, 110, 60, 0.12, 0.8);
      burst(c, out, t, 0.05, { f: 900, vol: 0.4, seed: i + 30 });
      t += 0.2 - i * 0.008;
    }
  },
};

R.herStep1 = {
  dur: 0.35,
  fn(c, out) {
    thump(c, out, 0, 95, 60, 0.1, 0.6);
    burst(c, out, 0.005, 0.06, { type: 'bandpass', f: 1300, q: 1.2, vol: 0.55, seed: 41 });
  },
};
R.herStep2 = {
  dur: 0.35,
  fn(c, out) {
    thump(c, out, 0, 85, 55, 0.1, 0.55);
    burst(c, out, 0.005, 0.07, { type: 'bandpass', f: 1100, q: 1.2, vol: 0.5, seed: 43 });
  },
};

R.skitter = {
  dur: 0.8,
  fn(c, out) {
    for (let i = 0; i < 7; i++) {
      const t = i * 0.085 + Math.random() * 0.02;
      thump(c, out, t, 120, 70, 0.06, 0.5);
      burst(c, out, t, 0.04, { type: 'bandpass', f: 1500, q: 1.5, vol: 0.4, seed: 50 + i });
    }
    burst(c, out, 0, 0.7, { type: 'bandpass', f: 700, q: 0.8, vol: 0.18, seed: 60, attack: 0.2 });
  },
};

// jump-scare hit: dissonant string/brass cluster + impact + sub drop
R.stinger = {
  dur: 3.2,
  fn(c, out) {
    const lp = bq(c, 'lowpass', 1200, 0.9);
    env(lp.frequency, [[0, 1500], [0.02, 9000], [1.6, 1800, 'e'], [3.0, 600, 'e']]);
    const g = gain(c, 0);
    env(g.gain, [[0, 0], [0.006, 0.55], [0.25, 0.35], [3.0, 0.0001, 'e']]);
    const cl = [98, 103.8, 110, 196, 207.7, 220, 233.1, 392, 415.3, 440, 466.2, 830.6];
    const pre = gain(c, 1);
    for (const f of cl) {
      const o = osc(c, 'sawtooth', f * (1 + (Math.random() - 0.5) * 0.012), 0, 3.2);
      const vib = osc(c, 'sine', 5 + Math.random() * 3, 0, 3.2);
      const vg = gain(c, f * 0.006);
      chain(vib, vg, o.frequency);
      chain(o, gain(c, 0.12), pre);
    }
    chain(pre, shaper(c, 2.5), lp, g, out);
    burst(c, out, 0, 0.3, { type: 'highpass', f: 900, vol: 0.9, seed: 71 });
    thump(c, out, 0, 60, 26, 1.8, 1.0);
  },
};

// shrieking violin stabs
R.screech = {
  dur: 2.2,
  fn(c, out) {
    const pre = gain(c, 1);
    for (const [f, v] of [[1245, 0.3], [1320, 0.3], [1864, 0.2], [2490, 0.12]]) {
      const o = osc(c, 'sawtooth', f, 0, 2.2);
      const vib = osc(c, 'sine', 7.5, 0, 2.2);
      chain(vib, gain(c, f * 0.02), o.frequency);
      chain(o, gain(c, v), pre);
    }
    const g = gain(c, 0);
    const pts = [[0, 0]];
    for (let i = 0; i < 4; i++) {
      const t = i * 0.32;
      pts.push([t + 0.005, 0.8], [t + 0.24, 0.12]);
    }
    pts.push([2.1, 0.0]);
    env(g.gain, pts);
    chain(pre, bq(c, 'bandpass', 2400, 0.8), shaper(c, 1.8), g, out);
  },
};

// rising dread swell that cuts off into a boom
R.swell = {
  dur: 4.2,
  fn(c, out) {
    const s = src(c, noise(c, 4.2, 'pink', 81));
    const f = bq(c, 'bandpass', 300, 0.6);
    env(f.frequency, [[0, 200], [2.6, 3000, 'e']]);
    const g = gain(c, 0);
    env(g.gain, [[0, 0.0001], [2.6, 0.7, 'e'], [2.62, 0]]);
    chain(s, f, g, out);
    const pre = gain(c, 1);
    for (const fr of [55, 58.3, 110, 116.5, 164.8]) chain(osc(c, 'sawtooth', fr, 0, 2.7), gain(c, 0.15), pre);
    const g2 = gain(c, 0);
    env(g2.gain, [[0, 0.0001], [2.6, 0.8, 'e'], [2.62, 0]]);
    chain(pre, bq(c, 'lowpass', 900), g2, out);
    thump(c, out, 2.62, 70, 25, 1.4, 1.0);
    burst(c, out, 2.62, 0.4, { f: 600, vol: 0.9, kind: 'brown', seed: 83 });
  },
};

function screamRecipe(dur, base, seed, dist = 4) {
  return {
    dur,
    fn(c, out) {
      const rng = mulberry32(seed);
      const f0 = osc(c, 'sawtooth', base, 0, dur);
      const fp = f0.frequency;
      fp.setValueAtTime(base * 0.4, 0);
      fp.exponentialRampToValueAtTime(base, 0.12);
      for (let t = 0.15; t < dur - 0.3; t += 0.07) fp.linearRampToValueAtTime(base * (0.95 + rng() * 0.12), t);
      fp.exponentialRampToValueAtTime(base * 0.55, dur);
      const voices = [
        [f0, 0.5],
        [osc(c, 'sawtooth', base * 1.012, 0, dur), 0.4],
        [osc(c, 'square', base * 2.02, 0, dur), 0.12],
        [osc(c, 'sawtooth', base * 2.99, 0, dur), 0.1],
      ];
      for (let i = 1; i < voices.length; i++) {
        const mult = [1, 1.012, 2.02, 2.99][i];
        const p = voices[i][0].frequency;
        p.setValueAtTime(base * 0.4 * mult, 0);
        p.exponentialRampToValueAtTime(base * mult, 0.12);
        p.exponentialRampToValueAtTime(base * 0.55 * mult, dur);
      }
      const vib = osc(c, 'sine', 9, 0, dur);
      const vg = gain(c, base * 0.05);
      vib.connect(vg);
      const src0 = gain(c, 1);
      for (const [o, v] of voices) {
        vg.connect(o.frequency);
        chain(o, gain(c, v), src0);
      }
      const rasp = src(c, noise(c, dur, 'white', seed + 1));
      chain(rasp, bq(c, 'bandpass', 2300, 0.7), gain(c, 0.5), src0);
      const form = gain(c, 1);
      for (const [f, q, g] of [[820, 6, 1.0], [1250, 7, 0.8], [2650, 8, 0.6], [3500, 9, 0.35]]) chain(src0, bq(c, 'bandpass', f, q), gain(c, g * 2.2), form);
      chain(src0, bq(c, 'lowpass', 5000), gain(c, 0.2), form);
      const g = gain(c, 0);
      env(g.gain, [[0, 0], [0.03, 1], [dur * 0.7, 0.85], [dur, 0.0001, 'e']]);
      chain(form, shaper(c, dist), g, out);
    },
  };
}
R.scream = screamRecipe(1.9, 620, 101, 5);
R.scream2 = screamRecipe(1.4, 540, 102, 6);
R.screamFar = screamRecipe(2.4, 480, 103, 2);

function whisperRecipe(dur, seed) {
  return {
    dur,
    fn(c, out) {
      const rng = mulberry32(seed);
      const s = src(c, noise(c, dur, 'white', seed));
      const vowels = [[800, 1200, 2500], [400, 2200, 2800], [300, 2700, 3300], [500, 900, 2400], [350, 800, 2300], [650, 1700, 2600]];
      const fs = [bq(c, 'bandpass', 800, 9), bq(c, 'bandpass', 1200, 11), bq(c, 'bandpass', 2500, 12)];
      const amp = gain(c, 0);
      const mix = gain(c, 1);
      fs.forEach((f, i) => chain(s, f, gain(c, [1.4, 1.1, 0.6][i] * 2.5), mix));
      let t = 0.05;
      amp.gain.setValueAtTime(0, 0);
      while (t < dur - 0.2) {
        const v = vowels[Math.floor(rng() * vowels.length)];
        const len = 0.09 + rng() * 0.14;
        fs.forEach((f, i) => f.frequency.setTargetAtTime(v[i] * (0.9 + rng() * 0.2), t, 0.015));
        const pk = 0.5 + rng() * 0.5;
        amp.gain.setTargetAtTime(pk, t, 0.02);
        amp.gain.setTargetAtTime(pk * 0.15, t + len * 0.7, 0.03);
        if (rng() < 0.3) burst(c, out, t, 0.08 + rng() * 0.08, { type: 'highpass', f: 5200, q: 0.7, vol: 0.18, seed: seed + Math.floor(t * 1000) });
        t += len + (rng() < 0.2 ? 0.12 : 0.02);
      }
      amp.gain.setTargetAtTime(0, dur - 0.2, 0.05);
      chain(mix, bq(c, 'highpass', 250), amp, out);
    },
  };
}
R.whisper1 = whisperRecipe(1.6, 201);
R.whisper2 = whisperRecipe(2.2, 202);
R.whisper3 = whisperRecipe(1.2, 203);
R.whisper4 = whisperRecipe(2.8, 204);

R.giggle = {
  dur: 1.4,
  fn(c, out) {
    let t = 0.02;
    for (let i = 0; i < 5; i++) {
      const f = 560 - i * 30;
      const o = osc(c, 'sawtooth', f, t, t + 0.14);
      o.frequency.setValueAtTime(f * 1.06, t);
      o.frequency.linearRampToValueAtTime(f * 0.92, t + 0.12);
      const g = gain(c, 0);
      env(g.gain, [[0, 0], [0.012, 0.5], [0.1, 0.2], [0.13, 0]], t);
      const mix = gain(c, 1);
      for (const [ff, q, v] of [[320, 6, 1], [2700, 10, 0.7], [3400, 12, 0.4]]) chain(o, bq(c, 'bandpass', ff, q), gain(c, v * 2.5), mix);
      chain(mix, g, out);
      burst(c, out, t, 0.09, { type: 'bandpass', f: 3000, q: 1, vol: 0.12, seed: 300 + i });
      t += 0.17 + i * 0.012;
    }
  },
};

function voiceRecipe(dur, f0base, seed, { phone = false, dark = false } = {}) {
  return {
    dur,
    fn(c, out) {
      const rng = mulberry32(seed);
      const o = osc(c, 'sawtooth', f0base, 0, dur);
      const o2 = osc(c, 'triangle', f0base * 1.003, 0, dur);
      const vowels = [[730, 1090, 2440], [530, 1840, 2480], [390, 1990, 2550], [570, 840, 2410], [440, 1020, 2240], [660, 1720, 2410]];
      const fs = [bq(c, 'bandpass', 700, 7), bq(c, 'bandpass', 1200, 9), bq(c, 'bandpass', 2400, 10)];
      const exc = gain(c, 1);
      o.connect(exc);
      chain(o2, gain(c, 0.4), exc);
      const mix = gain(c, 1);
      fs.forEach((f, i) => chain(exc, f, gain(c, [1.6, 1.2, 0.7][i]), mix));
      const amp = gain(c, 0);
      let t = 0.05;
      while (t < dur - 0.15) {
        const v = vowels[Math.floor(rng() * vowels.length)];
        const len = 0.1 + rng() * 0.16;
        fs.forEach((f, i) => f.frequency.setTargetAtTime(v[i] * (dark ? 0.8 : 1), t, 0.02));
        const intonation = f0base * (1 + 0.12 * Math.sin(t * 2.3 + seed) + (rng() - 0.5) * 0.06) * (1 - (t / dur) * 0.1);
        o.frequency.setTargetAtTime(intonation, t, 0.04);
        o2.frequency.setTargetAtTime(intonation * 1.003, t, 0.04);
        amp.gain.setTargetAtTime(0.7 + rng() * 0.3, t, 0.02);
        amp.gain.setTargetAtTime(0.05, t + len * 0.8, 0.02);
        if (rng() < 0.35) burst(c, out, t + len * 0.85, 0.05, { type: 'highpass', f: 3500, vol: 0.06, seed: seed + Math.floor(t * 999) });
        t += len + (rng() < 0.15 ? 0.22 : 0.03);
      }
      amp.gain.setTargetAtTime(0, dur - 0.12, 0.03);
      let last = chain(mix, amp);
      if (phone) last = chain(last, bq(c, 'highpass', 350, 0.7), bq(c, 'lowpass', 3000, 0.7), shaper(c, 2));
      if (dark) last = chain(last, shaper(c, 3), bq(c, 'lowpass', 2200));
      chain(last, gain(c, 0.9), out);
    },
  };
}
R.momA = voiceRecipe(2.4, 205, 401);
R.momB = voiceRecipe(3.0, 215, 402);
R.momC = voiceRecipe(1.8, 198, 403);
R.momPhoneA = voiceRecipe(2.6, 210, 404, { phone: true });
R.momPhoneB = voiceRecipe(3.2, 205, 405, { phone: true });
R.momPhoneC = voiceRecipe(2.0, 220, 406, { phone: true });
R.momBad = voiceRecipe(2.2, 150, 407, { dark: true });
R.radioA = voiceRecipe(4.0, 120, 408, { phone: true });
R.radioB = voiceRecipe(4.5, 125, 409, { phone: true });
R.radioBad = voiceRecipe(4.0, 95, 410, { phone: true, dark: true });
R.samVoice = voiceRecipe(1.6, 140, 411);

R.static = {
  dur: 2.0,
  fn(c, out) {
    const s = src(c, noise(c, 2.0, 'white', 501));
    chain(s, bq(c, 'bandpass', 3200, 0.4), gain(c, 0.5), out);
    const rng = mulberry32(502);
    for (let i = 0; i < 40; i++) burst(c, out, rng() * 1.95, 0.01, { type: 'highpass', f: 1500, vol: 0.4 + rng() * 0.4, seed: 510 + i });
  },
};

R.phoneRing = {
  dur: 1.8,
  fn(c, out) {
    const bells = [[1180, 2950, 4420], [1320, 3250, 4870]];
    for (let i = 0; i < 34; i++) {
      const t = i * 0.05;
      const bell = bells[i % 2];
      for (const [k, f] of bell.entries()) {
        const o = osc(c, 'sine', f, t, t + 0.12);
        const g = gain(c, 0);
        env(g.gain, [[0, 0], [0.002, [0.25, 0.12, 0.06][k]], [0.1, 0.0001, 'e']], t);
        chain(o, g, out);
      }
    }
  },
};

function thunderRecipe(near, seed) {
  const dur = near ? 7 : 8;
  return {
    dur,
    fn(c, out) {
      const rng = mulberry32(seed);
      if (near) burst(c, out, 0, 0.35, { type: 'highpass', f: 1500, vol: 0.9, seed });
      const s = src(c, noise(c, dur, 'brown', seed + 1));
      const lp = bq(c, 'lowpass', near ? 500 : 250, 0.8);
      env(lp.frequency, [[0, near ? 700 : 300], [dur, 70, 'e']]);
      const g = gain(c, 0);
      const pts = [[0, 0], [near ? 0.05 : 0.8, near ? 1 : 0.6]];
      let t = near ? 0.3 : 1.2;
      while (t < dur - 1) {
        pts.push([t, (0.3 + rng() * 0.7) * (1 - t / dur)]);
        t += 0.25 + rng() * 0.5;
      }
      pts.push([dur, 0]);
      env(g.gain, pts);
      chain(s, lp, g, gain(c, 1.4), out);
    },
  };
}
R.thunderNear = thunderRecipe(true, 601);
R.thunderFar = thunderRecipe(false, 602);
R.thunderFar2 = thunderRecipe(false, 603);

R.fuse = {
  dur: 2.2,
  fn(c, out) {
    thump(c, out, 0, 120, 60, 0.2, 1.0);
    burst(c, out, 0, 0.06, { f: 2600, vol: 0.9 });
    const ping = osc(c, 'sine', 1760, 0, 1);
    const pg = gain(c, 0);
    env(pg.gain, [[0, 0], [0.002, 0.25], [0.6, 0.0001, 'e']]);
    chain(ping, pg, out);
    const buzz = osc(c, 'sawtooth', 60, 0.05, 2.2);
    const bg = gain(c, 0);
    env(bg.gain, [[0, 0], [0.1, 0.5], [0.35, 0.25], [2.1, 0.0001, 'e']]);
    chain(buzz, bq(c, 'bandpass', 180, 2), bg, out);
  },
};

R.click = { dur: 0.08, fn: (c, out) => burst(c, out, 0, 0.012, { type: 'bandpass', f: 3200, q: 2, vol: 0.8, seed: 700 }) };
R.clack = {
  dur: 0.2,
  fn(c, out) {
    burst(c, out, 0, 0.015, { type: 'bandpass', f: 2600, q: 2, vol: 0.8, seed: 701 });
    burst(c, out, 0.06, 0.015, { type: 'bandpass', f: 1900, q: 2, vol: 0.6, seed: 702 });
  },
};

R.rattle = {
  dur: 0.8,
  fn(c, out) {
    for (let i = 0; i < 6; i++) {
      const t = i * 0.09 + Math.random() * 0.02;
      burst(c, out, t, 0.03, { type: 'bandpass', f: 2200 + Math.random() * 800, q: 4, vol: 0.5, seed: 710 + i });
      thump(c, out, t, 160, 110, 0.05, 0.4);
    }
  },
};

R.unlock = {
  dur: 0.9,
  fn(c, out) {
    burst(c, out, 0, 0.02, { type: 'bandpass', f: 3500, q: 3, vol: 0.6, seed: 720 });
    burst(c, out, 0.18, 0.02, { type: 'bandpass', f: 2900, q: 3, vol: 0.6, seed: 721 });
    thump(c, out, 0.4, 200, 120, 0.1, 0.6);
    burst(c, out, 0.4, 0.04, { type: 'bandpass', f: 1800, q: 2, vol: 0.6, seed: 722 });
  },
};

R.paper = {
  dur: 0.7,
  fn(c, out) {
    const rng = mulberry32(730);
    for (let i = 0; i < 14; i++) burst(c, out, rng() * 0.55, 0.03 + rng() * 0.05, { type: 'highpass', f: 2000 + rng() * 3000, vol: 0.2 + rng() * 0.25, seed: 731 + i });
  },
};

R.pickup = {
  dur: 0.5,
  fn(c, out) {
    thump(c, out, 0, 140, 90, 0.08, 0.4);
    const rng = mulberry32(740);
    for (let i = 0; i < 5; i++) burst(c, out, 0.03 + rng() * 0.2, 0.04, { type: 'highpass', f: 2500, vol: 0.15, seed: 741 + i });
  },
};

R.chains = {
  dur: 1.8,
  fn(c, out) {
    const rng = mulberry32(750);
    for (let i = 0; i < 26; i++) {
      const t = rng() * 0.9;
      const f = 1800 + rng() * 3800;
      const o = osc(c, 'sine', f, t, t + 0.3);
      const g = gain(c, 0);
      env(g.gain, [[0, 0], [0.002, 0.15 + rng() * 0.15], [0.08 + rng() * 0.2, 0.0001, 'e']], t);
      chain(o, g, out);
      burst(c, out, t, 0.01, { type: 'highpass', f: 3000, vol: 0.3, seed: 760 + i });
    }
    thump(c, out, 1.0, 90, 50, 0.4, 0.9);
    burst(c, out, 1.0, 0.1, { f: 1200, vol: 0.5, seed: 790 });
  },
};

R.splash = {
  dur: 1.4,
  fn(c, out) {
    const s = src(c, noise(c, 1.2, 'white', 800));
    const lp = bq(c, 'lowpass', 4000, 0.8);
    env(lp.frequency, [[0, 5000], [0.5, 400, 'e']]);
    const g = gain(c, 0);
    env(g.gain, [[0, 0], [0.01, 0.9], [0.8, 0.0001, 'e']]);
    chain(s, lp, g, out);
    const rng = mulberry32(801);
    for (let i = 0; i < 8; i++) {
      const t = 0.1 + rng() * 0.8;
      const o = osc(c, 'sine', 300, t, t + 0.08);
      o.frequency.setValueAtTime(250 + rng() * 200, t);
      o.frequency.exponentialRampToValueAtTime(700 + rng() * 600, t + 0.06);
      const bg = gain(c, 0);
      env(bg.gain, [[0, 0], [0.005, 0.15], [0.07, 0]], t);
      chain(o, bg, out);
    }
  },
};

R.drip = {
  dur: 0.4,
  fn(c, out) {
    const o = osc(c, 'sine', 1400, 0, 0.3);
    o.frequency.setValueAtTime(1500, 0);
    o.frequency.exponentialRampToValueAtTime(650, 0.03);
    const g = gain(c, 0);
    env(g.gain, [[0, 0], [0.002, 0.5], [0.15, 0.0001, 'e']]);
    chain(o, g, out);
  },
};

R.whoosh = {
  dur: 1.4,
  fn(c, out) {
    const s = src(c, noise(c, 1.4, 'pink', 810));
    const f = bq(c, 'bandpass', 300, 0.9);
    env(f.frequency, [[0, 250], [0.5, 2400, 'e'], [1.3, 300, 'e']]);
    const g = gain(c, 0);
    env(g.gain, [[0, 0], [0.4, 1.0], [1.3, 0]]);
    chain(s, f, g, out);
  },
};

R.gasp = {
  dur: 0.8,
  fn(c, out) {
    const s = src(c, noise(c, 0.8, 'white', 820));
    const g = gain(c, 0);
    env(g.gain, [[0, 0], [0.18, 0.6], [0.3, 0.1], [0.5, 0]]);
    chain(s, bq(c, 'bandpass', 1500, 1.2), g, out);
    const o = osc(c, 'sawtooth', 170, 0.05, 0.4);
    const og = gain(c, 0);
    env(og.gain, [[0, 0], [0.1, 0.12], [0.3, 0]], 0.05);
    chain(o, bq(c, 'bandpass', 700, 5), og, out);
  },
};

R.land = { dur: 0.4, fn: (c, out) => thump(c, out, 0, 90, 50, 0.2, 0.8) };

R.carDoor = {
  dur: 0.9,
  fn(c, out) {
    thump(c, out, 0, 70, 40, 0.3, 1.0);
    burst(c, out, 0, 0.06, { f: 2000, vol: 0.6, seed: 830 });
    burst(c, out, 0.02, 0.02, { type: 'bandpass', f: 4000, q: 3, vol: 0.4, seed: 831 });
  },
};

R.relay = {
  dur: 0.9,
  fn(c, out) {
    burst(c, out, 0, 0.01, { type: 'bandpass', f: 2400, q: 3, vol: 0.8, seed: 840 });
    for (let i = 0; i < 4; i++) burst(c, out, 0.15 + i * 0.11, 0.008, { type: 'bandpass', f: 1800, q: 3, vol: 0.4 - i * 0.08, seed: 841 + i });
  },
};

R.ringing = {
  dur: 4.5,
  fn(c, out) {
    for (const f of [5200, 5231]) {
      const o = osc(c, 'sine', f, 0, 4.5);
      const g = gain(c, 0);
      env(g.gain, [[0, 0], [0.05, 0.05], [4.4, 0.0001, 'e']]);
      chain(o, g, out);
    }
  },
};

R.clockBell = {
  dur: 4.0,
  fn(c, out) {
    const f = 196;
    for (const [m, v, d] of [[1, 0.5, 3.8], [2.0, 0.25, 2.6], [2.4, 0.2, 2.2], [3.0, 0.12, 1.6], [4.2, 0.08, 1.1], [5.4, 0.05, 0.8]]) {
      const o = osc(c, 'sine', f * m, 0, 4);
      const g = gain(c, 0);
      env(g.gain, [[0, 0], [0.004, v], [d, 0.0001, 'e']]);
      chain(o, g, out);
    }
    burst(c, out, 0, 0.02, { type: 'bandpass', f: 1500, q: 2, vol: 0.3, seed: 850 });
  },
};

R.tick = { dur: 0.06, fn: (c, out) => burst(c, out, 0, 0.008, { type: 'bandpass', f: 4200, q: 4, vol: 0.5, seed: 860 }) };
R.tock = { dur: 0.06, fn: (c, out) => burst(c, out, 0, 0.008, { type: 'bandpass', f: 3100, q: 4, vol: 0.5, seed: 861 }) };

R.glass = {
  dur: 1.2,
  fn(c, out) {
    const rng = mulberry32(870);
    burst(c, out, 0, 0.08, { type: 'highpass', f: 3000, vol: 0.8, seed: 871 });
    for (let i = 0; i < 16; i++) {
      const t = rng() * 0.7;
      const o = osc(c, 'sine', 2500 + rng() * 5000, t, t + 0.2);
      const g = gain(c, 0);
      env(g.gain, [[0, 0], [0.002, 0.12], [0.1 + rng() * 0.1, 0.0001, 'e']], t);
      chain(o, g, out);
    }
  },
};

R.breathHer = {
  dur: 3.6,
  fn(c, out) {
    const s = src(c, noise(c, 3.6, 'white', 880));
    const g = gain(c, 0);
    env(g.gain, [[0, 0], [1.1, 0.5], [1.4, 0.05], [1.6, 0.0], [1.7, 0.4], [2.9, 0.1], [3.5, 0]]);
    chain(s, bq(c, 'bandpass', 620, 2.5), g, out);
    const o = osc(c, 'sawtooth', 58, 1.6, 3.4);
    const og = gain(c, 0);
    env(og.gain, [[0, 0], [1.7, 0.18], [2.8, 0.05], [3.3, 0]]);
    const vib = osc(c, 'sine', 23, 0, 3.6);
    chain(vib, gain(c, 9), o.frequency);
    chain(o, bq(c, 'lowpass', 380, 2), og, out);
  },
};

// Footsteps: 3 variants per surface
const STEP = {
  wood: (c, out, v) => {
    thump(c, out, 0, 105 + v * 20, 65, 0.09, 0.8);
    burst(c, out, 0, 0.05, { f: 900, vol: 0.45, seed: 900 + v });
    burst(c, out, 0.01, 0.04, { type: 'bandpass', f: 2200, q: 1, vol: 0.12, seed: 910 + v });
  },
  porch: (c, out, v) => {
    thump(c, out, 0, 130 + v * 15, 80, 0.12, 0.9);
    burst(c, out, 0, 0.05, { f: 1100, vol: 0.4, seed: 920 + v });
  },
  tile: (c, out, v) => {
    burst(c, out, 0, 0.03, { type: 'bandpass', f: 2600 + v * 300, q: 1.5, vol: 0.55, seed: 930 + v });
    thump(c, out, 0, 140, 90, 0.05, 0.4);
  },
  stone: (c, out, v) => {
    burst(c, out, 0, 0.035, { type: 'highpass', f: 1100 + v * 200, q: 0.8, vol: 0.5, seed: 940 + v });
    thump(c, out, 0, 90, 60, 0.07, 0.5);
    burst(c, out, 0.03, 0.08, { type: 'bandpass', f: 3500, q: 0.8, vol: 0.08, seed: 945 + v });
  },
  gravel: (c, out, v) => {
    const rng = mulberry32(950 + v);
    for (let i = 0; i < 9; i++) burst(c, out, rng() * 0.09, 0.02 + rng() * 0.03, { type: 'bandpass', f: 2500 + rng() * 3000, q: 1.5, vol: 0.35, seed: 955 + v * 10 + i });
    thump(c, out, 0, 80, 50, 0.06, 0.3);
  },
  grass: (c, out, v) => {
    burst(c, out, 0, 0.09, { f: 1400 + v * 200, vol: 0.45, seed: 960 + v, attack: 0.01 });
    burst(c, out, 0.03, 0.08, { type: 'bandpass', f: 600, q: 1, vol: 0.2, seed: 965 + v });
  },
  asphalt: (c, out, v) => {
    burst(c, out, 0, 0.025, { type: 'bandpass', f: 1800 + v * 200, q: 1.2, vol: 0.4, seed: 970 + v });
    burst(c, out, 0.02, 0.07, { type: 'highpass', f: 2500, vol: 0.08, seed: 975 + v });
  },
};
for (const [surf, fn] of Object.entries(STEP)) {
  for (let v = 0; v < 3; v++) R[`step_${surf}_${v}`] = { dur: 0.3, fn: (c, out) => fn(c, out, v) };
}

// loudness trims (measured: peak / RMS of each render)
R.giggle.gain = 2.6;
R.whoosh.gain = 2.8;
R.breathHer.gain = 2.2;
R.gasp.gain = 2.0;
R.tick.gain = 3.5;
R.tock.gain = 3.0;
R.relay.gain = 3.0;
R.stinger.gain = 0.6;
R.doorSlam.gain = 0.75;
for (const k of Object.keys(R)) if (k.startsWith('step_asphalt') || k.startsWith('step_grass')) R[k].gain = 2.2;

export const RECIPES = R;

/** Render every recipe to an AudioBuffer. */
export async function renderAll(onProgress = () => {}) {
  const names = Object.keys(R);
  const out = {};
  let i = 0;
  for (const name of names) {
    const r = R[name];
    const len = Math.ceil((r.dur + 0.05) * SR);
    const c = new OfflineAudioContext(1, len, SR);
    const master = c.createGain();
    master.gain.value = r.gain ?? 1;
    master.connect(c.destination);
    r.fn(c, master);
    out[name] = await c.startRendering();
    i++;
    if (i % 6 === 0) onProgress(i / names.length);
  }
  onProgress(1);
  return out;
}

/** Stereo reverb impulse. */
export function makeImpulse(ctx, seconds = 2.4, decay = 3.0, seed = 5) {
  const rng = mulberry32(seed);
  const n = Math.floor(seconds * ctx.sampleRate);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i] = (rng() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
    }
  }
  return b;
}

export { noise };
