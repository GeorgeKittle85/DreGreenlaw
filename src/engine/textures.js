// Procedural textures for every surface in the game. No image files are used.
import * as THREE from 'three';
import { mulberry32 } from '../core/util.js';
import {
  makeCanvas, noiseField, eachPixel, grime, wrapped, stain, crack, drips, scribble, circlePts, crayonFill, speckle,
} from './paint.js';

export function toTex(canvas, { repeat = true, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

// ---------------------------------------------------------------- walls

function damask(ctx, x, y, s, color, hole) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (const m of [1, -1]) {
    ctx.save();
    ctx.scale(m, 1);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.25, -s * 0.75, s * 0.62, -s * 0.6, s * 0.5, -s * 0.2);
    ctx.bezierCurveTo(s * 0.44, 0, s * 0.18, 0.04 * s, s * 0.26, s * 0.26);
    ctx.bezierCurveTo(s * 0.36, s * 0.56, s * 0.16, s * 0.8, 0, s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.64, -s * 0.52, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.42, s * 0.58, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.74, s * 0.08, s * 0.2, s * 0.06, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.2, -s * 1.1, s * 0.05, s * 0.14, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.12, s * 0.1, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function rose(ctx, x, y, s, petal, leaf) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = leaf;
  for (const a of [0.6, 2.4, 4.2]) {
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * s * 1.1, Math.sin(a) * s * 1.1, s * 0.6, s * 0.25, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = petal;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(90,30,40,0.45)';
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function wallpaper({ size = 512, style = 'damask', base = '#56624a', motif = 'rgba(28,38,24,0.5)', accent = 'rgba(170,160,120,0.18)', seed = 1, age = 1 } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  if (style === 'damask') {
    ctx.fillStyle = accent;
    for (let x = 0; x < size; x += size / 2) ctx.fillRect(x + size / 4 - 1, 0, 2, size);
    const s = size * 0.17;
    for (const [mx, my] of [[size * 0.0, size * 0.25], [size * 0.5, size * 0.75]]) {
      wrapped(size, size, mx, my, s * 1.3, (x, y) => damask(ctx, x, y, s, motif, base));
    }
    ctx.fillStyle = motif;
    for (const [mx, my] of [[size * 0.25, size * 0.75], [size * 0.75, size * 0.25]]) {
      wrapped(size, size, mx, my, 12, (x, y) => {
        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x, y + 10);
        ctx.lineTo(x - 6, y);
        ctx.fill();
      });
    }
  } else if (style === 'floral') {
    ctx.fillStyle = accent;
    for (let x = 0; x < size; x += size / 4) ctx.fillRect(x, 0, 3, size);
    const s = size * 0.035;
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const x = (gx + 0.5 + (gy % 2) * 0.5) * (size / 4);
        const y = (gy + 0.5) * (size / 4);
        wrapped(size, size, x, y, s * 2, (xx, yy) => rose(ctx, xx, yy, s, motif, 'rgba(70,90,60,0.35)'));
      }
    }
  } else if (style === 'stripes') {
    const n = 8;
    for (let i = 0; i < n; i++) {
      if (i % 2) {
        ctx.fillStyle = motif;
        ctx.fillRect((i * size) / n, 0, size / n, size);
      }
      ctx.fillStyle = accent;
      ctx.fillRect((i * size) / n, 0, 2, size);
    }
  }
  grime(ctx, size, size, { seed, period: 3, lo: 0.6, hi: 1.04, tint: [0.92, 0.8, 0.55], tintAmt: 0.5 * age });
  for (let i = 0; i < 4 * age; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 25 + rng() * 70;
    wrapped(size, size, x, y, r, (xx, yy) => stain(ctx, xx, yy, r, [78, 58, 28], 0.2));
  }
  // water runs
  ctx.lineCap = 'round';
  for (let i = 0; i < 7 * age; i++) {
    const x = rng() * size;
    const w = 2 + rng() * 6;
    const g = ctx.createLinearGradient(0, 0, 0, size);
    const a = 0.05 + rng() * 0.12;
    g.addColorStop(0, `rgba(60,45,20,${a})`);
    g.addColorStop(rng(), `rgba(50,35,15,${a * 1.5})`);
    g.addColorStop(1, `rgba(60,45,20,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, size);
  }
  speckle(ctx, size, size, seed + 5, 10);
  return c;
}

export function wainscot({ size = 512, seed = 7, color = [58, 40, 26] } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const boards = 6;
  const bw = size / boards;
  const n = noiseField(size, size, 24, 2, 4, seed);
  const tones = Array.from({ length: boards }, () => 0.8 + rng() * 0.35);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const b = Math.floor(x / bw);
    const fx = (x % bw) / bw;
    const grain = 0.82 + 0.18 * Math.sin((x * 0.7 + n[i] * 30) * 1.3);
    let f = tones[b] * grain * (0.8 + 0.35 * n[i]);
    if (fx < 0.03 || fx > 0.97) f *= 0.35;
    else if (fx < 0.07) f *= 1.15;
    d[p] = color[0] * f;
    d[p + 1] = color[1] * f;
    d[p + 2] = color[2] * f;
    d[p + 3] = 255;
  });
  grime(ctx, size, size, { seed: seed + 1, period: 4, lo: 0.75, hi: 1.05, tintAmt: 0.2 });
  for (let i = 0; i < 25; i++) {
    ctx.strokeStyle = `rgba(200,170,130,${0.05 + rng() * 0.08})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x = rng() * size;
    const y = rng() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 20);
    ctx.stroke();
  }
  return c;
}

export function woodFloor({ size = 512, planks = 8, seed = 3, color = [96, 66, 42] } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = noiseField(size, size, 2, 24, 4, seed);
  const n2 = noiseField(size, size, 4, 4, 3, seed + 1);
  const ph = size / planks;
  const rows = [];
  for (let r = 0; r < planks; r++) {
    const j0 = rng() * size;
    const joints = [j0];
    if (rng() < 0.7) joints.push((j0 + size * (0.35 + rng() * 0.3)) % size);
    joints.sort((a, b) => a - b);
    rows.push({ joints, tones: joints.map(() => 0.7 + rng() * 0.45), shift: rng() * 100 });
  }
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const row = rows[Math.floor(y / ph)];
    const fy = (y % ph) / ph;
    let seg = 0;
    for (const j of row.joints) if (x >= j) seg++;
    seg = seg % row.tones.length;
    const tone = row.tones[seg];
    const grain = 0.8 + 0.2 * Math.sin((y * 1.6 + n[i] * 55 + row.shift) * 0.9);
    let f = tone * grain * (0.78 + 0.38 * n2[i]);
    if (fy < 0.035 || fy > 0.975) f *= 0.3;
    for (const j of row.joints) if (Math.abs(x - j) < 1.2) f *= 0.35;
    d[p] = color[0] * f;
    d[p + 1] = color[1] * f;
    d[p + 2] = color[2] * f;
    d[p + 3] = 255;
  });
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(190,160,120,${0.04 + rng() * 0.07})`;
    ctx.lineWidth = 0.5 + rng();
    ctx.beginPath();
    const x = rng() * size;
    const y = rng() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 120, y + (rng() - 0.5) * 12);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 20 + rng() * 50;
    wrapped(size, size, x, y, r, (xx, yy) => stain(ctx, xx, yy, r, [25, 15, 8], 0.35));
  }
  return c;
}

export function plaster({ size = 512, seed = 11, base = [150, 146, 136], stains = 4, cracks = 3 } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = noiseField(size, size, 6, 6, 5, seed);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const f = 0.82 + 0.25 * n[i];
    d[p] = base[0] * f;
    d[p + 1] = base[1] * f;
    d[p + 2] = base[2] * f;
    d[p + 3] = 255;
  });
  for (let i = 0; i < stains; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 40 + rng() * 90;
    wrapped(size, size, x, y, r, (xx, yy) => {
      stain(ctx, xx, yy, r, [95, 72, 38], 0.3);
      stain(ctx, xx + 10, yy + 6, r * 0.6, [85, 62, 30], 0.22);
    });
  }
  for (let i = 0; i < cracks; i++) crack(ctx, rng, rng() * size, rng() * size, 30 + rng() * 40, 1.2);
  speckle(ctx, size, size, seed + 3, 12);
  return c;
}

export function tiles({ size = 512, count = 8, seed = 13, base = [196, 192, 180], grout = [58, 56, 50] } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const ts = size / count;
  const n = noiseField(size, size, 8, 8, 4, seed);
  const tones = Array.from({ length: count * count }, () => 0.85 + rng() * 0.2);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const tx = Math.floor(x / ts);
    const ty = Math.floor(y / ts);
    const fx = (x % ts) / ts;
    const fy = (y % ts) / ts;
    const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
    if (edge < 0.04) {
      const f = 0.7 + 0.5 * n[i];
      d[p] = grout[0] * f;
      d[p + 1] = grout[1] * f;
      d[p + 2] = grout[2] * f;
    } else {
      const bevel = edge < 0.09 ? 0.88 : 1;
      const f = tones[ty * count + tx] * bevel * (0.9 + 0.14 * n[i]);
      d[p] = base[0] * f;
      d[p + 1] = base[1] * f;
      d[p + 2] = base[2] * f;
    }
    d[p + 3] = 255;
  });
  for (let i = 0; i < 5; i++) {
    const tx = Math.floor(rng() * count);
    const ty = Math.floor(rng() * count);
    crack(ctx, rng, (tx + 0.2 + rng() * 0.6) * ts, (ty + 0.2 + rng() * 0.6) * ts, 8, 1, 'rgba(40,35,30,0.7)');
  }
  grime(ctx, size, size, { seed: seed + 2, period: 3, lo: 0.6, hi: 1.05, tint: [0.8, 0.8, 0.6], tintAmt: 0.5 });
  // mould
  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = `rgba(20,30,18,${0.1 + rng() * 0.25})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + rng() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function linoleum({ size = 512, count = 4, seed = 17 } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const ts = size / count;
  const n = noiseField(size, size, 6, 6, 5, seed);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const dark = (Math.floor(x / ts) + Math.floor(y / ts)) % 2 === 0;
    const f = 0.78 + 0.3 * n[i];
    const col = dark ? [44, 60, 50] : [176, 168, 140];
    d[p] = col[0] * f;
    d[p + 1] = col[1] * f;
    d[p + 2] = col[2] * f;
    d[p + 3] = 255;
  });
  for (let i = 0; i < 6; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 20 + rng() * 60;
    wrapped(size, size, x, y, r, (xx, yy) => stain(ctx, xx, yy, r, [60, 45, 20], 0.3));
  }
  for (let i = 0; i < 50; i++) {
    ctx.strokeStyle = `rgba(20,15,10,${0.08 + rng() * 0.15})`;
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath();
    const x = rng() * size;
    const y = rng() * size;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rng() - 0.5) * 40, y + (rng() - 0.5) * 40, x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 60);
    ctx.stroke();
  }
  return c;
}

export function stone({ size = 512, seed = 19, base = [92, 88, 80] } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = 'rgb(38,36,32)';
  ctx.fillRect(0, 0, size, size);
  const rows = 7;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = rng() * -60;
    while (x < size) {
      const w = 50 + rng() * 90;
      const tone = 0.65 + rng() * 0.5;
      const y = r * rh;
      wrapped(size, size, x + w / 2, y + rh / 2, w, (cx) => {
        const x0 = cx - w / 2;
        ctx.fillStyle = rgb(base[0] * tone, base[1] * tone, base[2] * tone);
        ctx.beginPath();
        const inset = 3 + rng() * 3;
        ctx.roundRect(x0 + inset, y + inset, w - inset * 2, rh - inset * 2, 8 + rng() * 10);
        ctx.fill();
      });
      x += w;
    }
  }
  const n = noiseField(size, size, 10, 10, 5, seed);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const f = 0.7 + 0.45 * n[i];
    d[p] *= f;
    d[p + 1] *= f;
    d[p + 2] *= f;
  });
  grime(ctx, size, size, { seed: seed + 3, period: 2, lo: 0.55, hi: 1.05, tint: [0.7, 0.85, 0.6], tintAmt: 0.5 });
  for (let i = 0; i < 10; i++) {
    const x = rng() * size;
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, 'rgba(10,12,8,0.35)');
    g.addColorStop(1, 'rgba(10,12,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 6 + rng() * 20, size * (0.4 + rng() * 0.6));
  }
  return c;
}

export function siding({ size = 512, boards = 8, seed = 23, paint = [150, 150, 142], wood = [80, 72, 60] } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const bh = size / boards;
  const n = noiseField(size, size, 3, 12, 5, seed);
  const peel = noiseField(size, size, 12, 12, 3, seed + 7);
  const grain = noiseField(size, size, 2, 30, 3, seed + 9);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const fy = (y % bh) / bh;
    const shade = 0.55 + 0.45 * Math.pow(fy, 0.6);
    const bare = peel[i] > 0.72;
    const col = bare ? wood : paint;
    let f = shade * (0.8 + 0.3 * n[i]) * (bare ? 0.8 + 0.3 * grain[i] : 1);
    if (fy > 0.95) f *= 0.4;
    d[p] = col[0] * f;
    d[p + 1] = col[1] * f;
    d[p + 2] = col[2] * f;
    d[p + 3] = 255;
  });
  grime(ctx, size, size, { seed: seed + 1, period: 2, lo: 0.55, hi: 1.02, tint: [0.75, 0.8, 0.65], tintAmt: 0.6 });
  return c;
}

export function shingles({ size = 512, seed = 29 } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#141412';
  ctx.fillRect(0, 0, size, size);
  const rows = 10;
  const rh = size / rows;
  const sw = size / 8;
  for (let r = 0; r < rows; r++) {
    for (let k = -1; k < 9; k++) {
      const x = k * sw + (r % 2) * sw * 0.5;
      const t = 0.5 + rng() * 0.5;
      if (rng() < 0.04) continue;
      ctx.fillStyle = rgb(52 * t, 50 * t, 46 * t);
      ctx.fillRect(x + 1, r * rh + 1, sw - 2, rh - 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x + 1, r * rh + rh - 4, sw - 2, 3);
    }
  }
  grime(ctx, size, size, { seed, period: 3, lo: 0.6, hi: 1.1, tint: [0.6, 0.9, 0.5], tintAmt: 0.5 });
  return c;
}

export function ground({ size = 512, seed = 31, kind = 'grass' } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = noiseField(size, size, 4, 4, 6, seed);
  const blades = noiseField(size, size, 64, 16, 2, seed + 1);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    let col;
    if (kind === 'grass') {
      const g = n[i];
      const dirt = g < 0.42;
      col = dirt ? [52, 44, 34] : [44, 58, 36];
      const f = (0.6 + 0.6 * g) * (dirt ? 1 : 0.75 + 0.5 * blades[i]);
      d[p] = col[0] * f;
      d[p + 1] = col[1] * f;
      d[p + 2] = col[2] * f;
    } else if (kind === 'dirt') {
      const f = 0.6 + 0.6 * n[i];
      d[p] = 70 * f;
      d[p + 1] = 60 * f;
      d[p + 2] = 48 * f;
    } else {
      const f = 0.55 + 0.6 * n[i];
      d[p] = 72 * f;
      d[p + 1] = 70 * f;
      d[p + 2] = 66 * f;
    }
    d[p + 3] = 255;
  });
  if (kind === 'gravel' || kind === 'dirt') {
    const count = kind === 'gravel' ? 2600 : 500;
    for (let i = 0; i < count; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = kind === 'gravel' ? 1.5 + rng() * 4 : 1 + rng() * 3;
      const t = 60 + rng() * 90;
      wrapped(size, size, x, y, r, (xx, yy) => {
        ctx.fillStyle = rgb(t, t * 0.97, t * 0.92);
        ctx.beginPath();
        ctx.ellipse(xx, yy, r, r * (0.6 + rng() * 0.4), rng() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(xx + r * 0.3, yy + r * 0.4, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  if (kind === 'concrete') {
    for (let i = 0; i < 6; i++) crack(ctx, rng, rng() * size, rng() * size, 40, 1.5, 'rgba(15,12,10,0.6)');
    for (let i = 0; i < 5; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 30 + rng() * 80;
      wrapped(size, size, x, y, r, (xx, yy) => stain(ctx, xx, yy, r, [25, 22, 15], 0.45));
    }
  }
  return c;
}

export function bark({ size = 256, seed = 37 } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const n = noiseField(size, size, 16, 3, 5, seed);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const ridge = Math.abs(Math.sin((x / size) * Math.PI * 12 + n[i] * 6));
    const f = 0.35 + 0.6 * ridge * n[i];
    d[p] = 60 * f;
    d[p + 1] = 52 * f;
    d[p + 2] = 44 * f;
    d[p + 3] = 255;
  });
  return c;
}

export function fabric({ size = 256, base = [90, 50, 45], pattern = 'weave', seed = 41, motif = 'rgba(40,20,20,0.35)' } = {}) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = noiseField(size, size, 4, 4, 4, seed);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const weave = ((x + y) % 4 < 2 ? 0.94 : 1.04) * ((x - y + 1000) % 6 < 3 ? 0.97 : 1.02);
    const f = weave * (0.75 + 0.35 * n[i]);
    d[p] = base[0] * f;
    d[p + 1] = base[1] * f;
    d[p + 2] = base[2] * f;
    d[p + 3] = 255;
  });
  if (pattern === 'floral') {
    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        const x = (gx + 0.5 + (gy % 2) * 0.5) * (size / 3);
        const y = (gy + 0.5) * (size / 3);
        wrapped(size, size, x, y, 30, (xx, yy) => rose(ctx, xx, yy, size * 0.04, motif, 'rgba(40,50,35,0.3)'));
      }
    }
  } else if (pattern === 'plaid') {
    ctx.fillStyle = motif;
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(0, (k * size) / 4, size, size / 16);
      ctx.fillRect((k * size) / 4, 0, size / 16, size);
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 15 + rng() * 35;
    wrapped(size, size, x, y, r, (xx, yy) => stain(ctx, xx, yy, r, [60, 40, 25], 0.28));
  }
  return c;
}

export function doorPanel({ w = 256, h = 512, color = [70, 48, 32], painted = false, seed = 43 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = noiseField(w, h, 2, 12, 4, seed);
  eachPixel(ctx, w, h, (d, p, x, y, i) => {
    const grain = painted ? 1 : 0.85 + 0.15 * Math.sin((x * 0.9 + n[i] * 40) * 1.1);
    const f = grain * (0.82 + 0.3 * n[i]);
    d[p] = color[0] * f;
    d[p + 1] = color[1] * f;
    d[p + 2] = color[2] * f;
    d[p + 3] = 255;
  });
  const panels = [
    [0.14, 0.06, 0.86, 0.3],
    [0.14, 0.36, 0.86, 0.6],
    [0.14, 0.66, 0.46, 0.94],
    [0.54, 0.66, 0.86, 0.94],
  ];
  for (const [x0, y0, x1, y1] of panels) {
    const X0 = x0 * w;
    const Y0 = y0 * h;
    const X1 = x1 * w;
    const Y1 = y1 * h;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(X0, Y0, X1 - X0, 5);
    ctx.fillRect(X0, Y0, 5, Y1 - Y0);
    ctx.fillStyle = 'rgba(255,240,220,0.12)';
    ctx.fillRect(X0, Y1 - 5, X1 - X0, 5);
    ctx.fillRect(X1 - 5, Y0, 5, Y1 - Y0);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(X0 + 12, Y0 + 12, X1 - X0 - 24, Y1 - Y0 - 24);
  }
  if (painted) {
    for (let i = 0; i < 14; i++) crack(ctx, rng, rng() * w, rng() * h, 10 + rng() * 20, 1, 'rgba(40,30,20,0.4)');
  }
  grime(ctx, w, h, { seed: seed + 1, period: 3, lo: 0.65, hi: 1.05, tintAmt: 0.35 });
  // hand grime around the knob
  const g = ctx.createRadialGradient(w * 0.85, h * 0.52, 2, w * 0.85, h * 0.52, w * 0.3);
  g.addColorStop(0, 'rgba(20,12,6,0.45)');
  g.addColorStop(1, 'rgba(20,12,6,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export function rug({ w = 512, h = 256, seed = 47, base = [92, 22, 24], alt = [24, 30, 56], gold = [150, 120, 60] } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = rgb(...base);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = rgb(...gold);
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = rgb(...alt);
  ctx.lineWidth = 14;
  ctx.strokeRect(30, 30, w - 60, h - 60);
  ctx.fillStyle = rgb(...alt);
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.22, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgb(...gold);
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.08, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rng() < 0.5 ? rgb(...gold, 0.5) : rgb(...alt, 0.7);
    const x = 50 + rng() * (w - 100);
    const y = 50 + rng() * (h - 100);
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 5, y);
    ctx.fill();
  }
  const n = noiseField(w, h, 8, 4, 4, seed);
  eachPixel(ctx, w, h, (d, p, x, y, i) => {
    const f = 0.55 + 0.55 * n[i];
    const worn = n[i] > 0.66 ? 1.25 : 1;
    d[p] = Math.min(255, d[p] * f * worn);
    d[p + 1] = Math.min(255, d[p + 1] * f * worn);
    d[p + 2] = Math.min(255, d[p + 2] * f * worn);
  });
  return c;
}

// ---------------------------------------------------------------- paper things

export function paper(w = 256, h = 320, seed = 53, tone = [214, 204, 178]) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = noiseField(w, h, 4, 5, 4, seed);
  eachPixel(ctx, w, h, (d, p, x, y, i) => {
    const edge = Math.min(x, y, w - x, h - y) / Math.min(w, h);
    const f = (0.84 + 0.18 * n[i]) * (edge < 0.05 ? 0.8 + edge * 4 : 1);
    d[p] = tone[0] * f;
    d[p + 1] = tone[1] * f;
    d[p + 2] = tone[2] * f;
    d[p + 3] = 255;
  });
  for (let i = 0; i < 3; i++) stain(ctx, rng() * w, rng() * h, 10 + rng() * 40, [120, 90, 40], 0.25);
  return c;
}

/** Child's crayon drawings. Returns a canvas. */
export function drawing(kind, seed = 61) {
  const W = 256;
  const H = 256;
  const c = paper(W, H, seed, [226, 220, 204]);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const black = '#15120f';
  const font = (px) => `${px}px Schoolbell, 'Comic Sans MS', cursive`;
  const stick = (x, y, s, color, { arms = 'down', long = 1, tall = 1, smile = true, eyes = true } = {}) => {
    scribble(ctx, rng, circlePts(x, y - 42 * s * tall, 11 * s, 12 * s, 14), { color, width: 2.4 });
    scribble(ctx, rng, [[x, y - 30 * s * tall], [x, y - 8 * s]], { color, width: 2.5 });
    scribble(ctx, rng, [[x, y - 8 * s], [x - 8 * s, y + 10 * s]], { color, width: 2.5 });
    scribble(ctx, rng, [[x, y - 8 * s], [x + 8 * s, y + 10 * s]], { color, width: 2.5 });
    const ay = y - 26 * s * tall;
    if (arms === 'down') {
      scribble(ctx, rng, [[x, ay], [x - 12 * s, ay + 22 * s * long]], { color, width: 2.3 });
      scribble(ctx, rng, [[x, ay], [x + 12 * s, ay + 22 * s * long]], { color, width: 2.3 });
    } else if (arms === 'up') {
      scribble(ctx, rng, [[x, ay], [x - 14 * s, ay - 16 * s]], { color, width: 2.3 });
      scribble(ctx, rng, [[x, ay], [x + 14 * s, ay - 16 * s]], { color, width: 2.3 });
    } else if (arms === 'eyes') {
      scribble(ctx, rng, [[x, ay], [x - 8 * s, ay - 14 * s * tall]], { color, width: 2.3 });
      scribble(ctx, rng, [[x, ay], [x + 8 * s, ay - 14 * s * tall]], { color, width: 2.3 });
    }
    const hy = y - 42 * s * tall;
    if (eyes) {
      ctx.fillStyle = color;
      ctx.fillRect(x - 5 * s, hy - 3 * s, 2.5 * s, 2.5 * s);
      ctx.fillRect(x + 3 * s, hy - 3 * s, 2.5 * s, 2.5 * s);
    }
    if (smile) scribble(ctx, rng, circlePts(x, hy + 2 * s, 5 * s, 4 * s, 8, 0.3, Math.PI - 0.3), { color, width: 1.6, passes: 2 });
  };
  const tallGirl = (x, y, s, height = 2.3) => {
    // black scribbled mass: hair + dress, arms to the floor, huge smile
    ctx.save();
    const top = y - 120 * s * height * 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, top + 20 * s);
    ctx.lineTo(x - 22 * s, y - 20 * s);
    ctx.lineTo(x + 22 * s, y - 20 * s);
    ctx.lineTo(x + 10 * s, top + 20 * s);
    ctx.closePath();
    ctx.clip();
    crayonFill(ctx, rng, x - 30 * s, top, x + 30 * s, y, black, 2.5, 0.8);
    ctx.restore();
    scribble(ctx, rng, circlePts(x, top + 8 * s, 12 * s, 14 * s, 14), { color: black, width: 3 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, top + 8 * s, 12 * s, 0, Math.PI * 2);
    ctx.clip();
    crayonFill(ctx, rng, x - 14 * s, top - 8 * s, x + 14 * s, top + 24 * s, black, 2, 0.75);
    ctx.restore();
    // hair strands
    for (let i = 0; i < 12; i++) {
      const hx = x - 12 * s + i * 2.2 * s;
      scribble(ctx, rng, [[hx, top], [hx + (rng() - 0.5) * 6, top + 60 * s]], { color: black, width: 1.6, passes: 1 });
    }
    // arms to the floor
    scribble(ctx, rng, [[x - 10 * s, top + 26 * s], [x - 26 * s, y - 40 * s], [x - 24 * s, y + 4 * s]], { color: black, width: 2.4 });
    scribble(ctx, rng, [[x + 10 * s, top + 26 * s], [x + 26 * s, y - 40 * s], [x + 24 * s, y + 4 * s]], { color: black, width: 2.4 });
    for (const side of [-1, 1]) {
      for (let f = 0; f < 4; f++) scribble(ctx, rng, [[x + side * 24 * s, y + 4 * s], [x + side * (20 + f * 3) * s, y + 14 * s]], { color: black, width: 1.3, passes: 1 });
    }
    scribble(ctx, rng, [[x - 12 * s, y - 20 * s], [x - 12 * s, y + 10 * s]], { color: black, width: 2.4 });
    scribble(ctx, rng, [[x + 12 * s, y - 20 * s], [x + 12 * s, y + 10 * s]], { color: black, width: 2.4 });
    // the smile (red, too wide)
    scribble(ctx, rng, circlePts(x, top + 10 * s, 11 * s, 7 * s, 10, 0.1, Math.PI - 0.1), { color: '#b0151a', width: 2.2, passes: 3, alpha: 0.9 });
    ctx.fillStyle = '#e8e2d2';
    ctx.fillRect(x - 6 * s, top + 3 * s, 3 * s, 3 * s);
    ctx.fillRect(x + 3 * s, top + 3 * s, 3 * s, 3 * s);
  };
  const house = (x, y, s, color) => {
    scribble(ctx, rng, [[x - 30 * s, y], [x - 30 * s, y - 40 * s], [x + 30 * s, y - 40 * s], [x + 30 * s, y], [x - 30 * s, y]], { color, width: 2.5 });
    scribble(ctx, rng, [[x - 36 * s, y - 38 * s], [x, y - 68 * s], [x + 36 * s, y - 38 * s]], { color, width: 2.5 });
    scribble(ctx, rng, [[x - 6 * s, y], [x - 6 * s, y - 18 * s], [x + 6 * s, y - 18 * s], [x + 6 * s, y]], { color, width: 2 });
  };
  const label = (text, x, y, px = 18, color = '#1d3fa0', rot = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = font(px);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  const sun = () => {
    scribble(ctx, rng, circlePts(W - 34, 34, 16, 16, 16), { color: '#e0a21a', width: 3 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      scribble(ctx, rng, [[W - 34 + Math.cos(a) * 20, 34 + Math.sin(a) * 20], [W - 34 + Math.cos(a) * 30, 34 + Math.sin(a) * 30]], { color: '#e0a21a', width: 2.5, passes: 2 });
    }
  };
  const grass = () => {
    for (let x = 6; x < W; x += 5) scribble(ctx, rng, [[x, H - 12], [x + 2, H - 22 - rng() * 8]], { color: '#2f8a2f', width: 1.8, passes: 1 });
  };

  if (kind === 'family') {
    sun();
    grass();
    house(70, H - 20, 1, '#9c3d1d');
    stick(140, H - 30, 1, '#8a2a7a');
    stick(175, H - 34, 0.8, '#1d3fa0');
    stick(205, H - 28, 0.62, '#c0306a');
    label('MOM', 140, 130, 16, '#8a2a7a');
    label('SAM', 175, 150, 16, '#1d3fa0');
    label('ME', 205, 176, 16, '#c0306a');
  } else if (kind === 'tall') {
    grass();
    tallGirl(95, H - 26, 1.3, 2.4);
    stick(185, H - 30, 0.62, '#c0306a');
    scribble(ctx, rng, [[118, H - 110], [178, H - 70]], { color: black, width: 2 });
    label('ME', 95, 40, 26, black);
    label('ELLIE', 185, 150, 20, '#c0306a');
    label('ME AND ELLIE', W / 2, H - 2, 18, black);
  } else if (kind === 'well') {
    scribble(ctx, rng, [[70, 120], [70, 220], [186, 220], [186, 120]], { color: '#555', width: 3 });
    scribble(ctx, rng, circlePts(128, 120, 58, 14, 20), { color: '#555', width: 3 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(76, 124, 104, 92);
    ctx.clip();
    crayonFill(ctx, rng, 76, 124, 180, 216, '#101820', 2.2, 0.85);
    ctx.restore();
    stick(128, 206, 0.45, '#c0306a');
    label('HIDING SPOT', 128, 100, 20, '#c0306a');
    label('SAM IS IT', 128, 40, 22, '#1d3fa0');
    label('1 2 3 4 5 6 7 8 9 10', 128, 64, 16, '#1d3fa0');
  } else if (kind === 'eyes') {
    crayonFill(ctx, rng, 0, 0, W, H, black, 3, 0.65);
    ctx.fillStyle = '#e8e2d2';
    ctx.beginPath();
    ctx.ellipse(96, 110, 14, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(160, 110, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.arc(96, 110, 5, 0, Math.PI * 2);
    ctx.arc(160, 110, 5, 0, Math.PI * 2);
    ctx.fill();
    scribble(ctx, rng, circlePts(128, 150, 60, 30, 16, 0.15, Math.PI - 0.15), { color: '#b0151a', width: 4, passes: 4 });
    label('I SEE YOU SAM', W / 2, 232, 20, '#b0151a');
  } else if (kind === 'mommy') {
    scribble(ctx, rng, [[30, 190], [220, 190], [220, 160], [30, 160], [30, 190]], { color: '#6b4a2a', width: 3 });
    stick(70, 170, 0.5, '#8a2a7a', { smile: false });
    scribble(ctx, rng, [[60, 138], [80, 150]], { color: '#8a2a7a', width: 2 });
    tallGirl(170, 225, 0.95, 2.6);
    label('MOMMY IS TIRED', W / 2, 36, 20, '#8a2a7a');
    label('I WILL WATCH HER', W / 2, 60, 16, black);
  } else if (kind === 'taller') {
    grass();
    const hs = [0.5, 0.62, 0.78, 0.96, 1.2];
    const names = ['7', '7', '7', '7', '7'];
    hs.forEach((s, k) => {
      const x = 30 + k * 48;
      if (k < 2) stick(x, H - 26, s * 0.9, '#c0306a');
      else tallGirl(x, H - 26, s * 0.55, 1.4 + k * 0.5);
      label(names[k], x, H - 2, 16, black);
    });
    label('ME EVERY BIRTHDAY', W / 2, 30, 18, black);
  } else if (kind === 'sam') {
    grass();
    stick(80, H - 28, 0.85, '#1d3fa0', { arms: 'eyes', smile: false, eyes: false });
    tallGirl(176, H - 26, 1.15, 2.4);
    label('SAM', 80, 132, 18, '#1d3fa0');
    label('YOUR IT', W / 2, 34, 22, '#b0151a');
  } else if (kind === 'windows') {
    house(128, H - 20, 2.4, '#333');
    ctx.fillStyle = '#101010';
    for (const [x, y] of [[80, 120], [176, 120], [80, 176], [176, 176]]) {
      scribble(ctx, rng, [[x - 14, y - 14], [x + 14, y - 14], [x + 14, y + 14], [x - 14, y + 14], [x - 14, y - 14]], { color: '#333', width: 2 });
      ctx.fillRect(x - 3, y - 10, 6, 20);
      ctx.beginPath();
      ctx.arc(x, y - 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    label('SHE IS IN EVERY ROOM', W / 2, 30, 17, black);
  }
  speckle(ctx, W, H, seed, 8);
  return c;
}

/** Old photograph with simple figures. */
export function photo(kind, seed = 71) {
  const W = 256;
  const H = 320;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  const person = (x, y, s, skin, hair, shirt, { long = false, scratched = false, dark = false, smile = true } = {}) => {
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(x, y + 70 * s, 42 * s, 55 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 42 * s, y + 70 * s, 84 * s, 80 * s);
    ctx.fillStyle = hair;
    if (long) {
      ctx.beginPath();
      ctx.ellipse(x, y + 12 * s, 30 * s, 48 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(x, y, 22 * s, 28 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(x, y - 14 * s, 24 * s, 17 * s, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 24 * s, y - 16 * s, 48 * s, 8 * s);
    if (dark) {
      const g = ctx.createRadialGradient(x, y, 2, x, y, 30 * s);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, 24 * s, 30 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ddd';
      ctx.fillRect(x - 8 * s, y - 4 * s, 2 * s, 2 * s);
      ctx.fillRect(x + 6 * s, y - 4 * s, 2 * s, 2 * s);
    } else {
      ctx.fillStyle = 'rgba(30,20,15,0.8)';
      ctx.fillRect(x - 9 * s, y - 4 * s, 4 * s, 3 * s);
      ctx.fillRect(x + 5 * s, y - 4 * s, 4 * s, 3 * s);
      if (smile) {
        ctx.strokeStyle = 'rgba(90,30,30,0.8)';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(x, y + 8 * s, 7 * s, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }
    if (scratched) {
      ctx.strokeStyle = 'rgba(235,230,215,0.9)';
      for (let i = 0; i < 26; i++) {
        ctx.lineWidth = 1 + rng() * 2;
        ctx.beginPath();
        ctx.moveTo(x + (rng() - 0.5) * 50 * s, y + (rng() - 0.5) * 60 * s);
        ctx.lineTo(x + (rng() - 0.5) * 50 * s, y + (rng() - 0.5) * 60 * s);
        ctx.stroke();
      }
    }
  };
  if (kind === 'ellie' || kind === 'ellie_dark') {
    bg.addColorStop(0, '#5a7fa8');
    bg.addColorStop(1, '#2d4460');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    person(W / 2, 150, 1.7, '#e0c0a8', '#3a2418', '#b8445a', { long: true, dark: kind === 'ellie_dark' });
  } else if (kind === 'family') {
    bg.addColorStop(0, '#6d5a44');
    bg.addColorStop(1, '#3b3025');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2c5a2c';
    ctx.beginPath();
    ctx.moveTo(30, 250);
    ctx.lineTo(60, 60);
    ctx.lineTo(90, 250);
    ctx.fill();
    person(150, 120, 1.05, '#d9b89c', '#4a3322', '#5b6b8a', { long: true });
    person(95, 170, 0.8, '#e0c0a8', '#6a4a2a', '#8a3a2a', { scratched: true });
    person(195, 195, 0.62, '#e0c0a8', '#3a2418', '#b8445a', { long: true });
  } else if (kind === 'christmas') {
    bg.addColorStop(0, '#4d3a2c');
    bg.addColorStop(1, '#221a14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1f4a26';
    ctx.beginPath();
    ctx.moveTo(40, 280);
    ctx.lineTo(80, 40);
    ctx.lineTo(120, 280);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = ['#d33', '#fd3', '#39f'][i % 3];
      ctx.beginPath();
      ctx.arc(55 + rng() * 50, 80 + rng() * 180, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    person(170, 120, 1.0, '#cfae94', '#6f6a66', '#4a4a5a', { long: true, smile: false });
    person(120, 200, 0.62, '#d8d0c8', '#111', '#e8e4dc', { long: true, dark: true });
  } else if (kind === 'mom') {
    bg.addColorStop(0, '#7a6a55');
    bg.addColorStop(1, '#3a3025');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    person(W / 2, 140, 1.6, '#d6b59a', '#4a3322', '#6a4a5a', { long: true });
  } else if (kind === 'sam') {
    bg.addColorStop(0, '#6a8a6a');
    bg.addColorStop(1, '#2a3a2a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    person(W / 2, 150, 1.6, '#e0c0a8', '#6a4a2a', '#2a4a8a', { scratched: true });
  }
  // age: sepia, fade, vignette, scratches
  const n = noiseField(W, H, 4, 5, 4, seed);
  eachPixel(ctx, W, H, (d, p, x, y, i) => {
    const r = d[p];
    const g = d[p + 1];
    const b = d[p + 2];
    const l = r * 0.3 + g * 0.59 + b * 0.11;
    const sep = [l * 1.07 + 18, l * 0.92 + 10, l * 0.72];
    const k = 0.55;
    const vx = x / W - 0.5;
    const vy = y / H - 0.5;
    const v = 1 - (vx * vx + vy * vy) * 1.4;
    const f = v * (0.8 + 0.3 * n[i]);
    d[p] = (r * (1 - k) + sep[0] * k) * f + 20;
    d[p + 1] = (g * (1 - k) + sep[1] * k) * f + 16;
    d[p + 2] = (b * (1 - k) + sep[2] * k) * f + 10;
  });
  ctx.strokeStyle = 'rgba(240,230,210,0.25)';
  for (let i = 0; i < 12; i++) {
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    const x = rng() * W;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rng() - 0.5) * 30, H);
    ctx.stroke();
  }
  // white border
  ctx.strokeStyle = '#d8d0bc';
  ctx.lineWidth = 16;
  ctx.strokeRect(0, 0, W, H);
  return c;
}

/** Paint on walls: text with drips. Transparent background. */
export function writing(lines, { w = 1024, h = 256, color = '#5e0707', font = 'Schoolbell', seed = 81, size = 90, slant = -0.03 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const arr = Array.isArray(lines) ? lines : [lines];
  const lh = h / arr.length;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  arr.forEach((line, k) => {
    const y = lh * (k + 0.5);
    ctx.save();
    ctx.translate(w / 2, y);
    ctx.rotate(slant + (rng() - 0.5) * 0.04);
    ctx.font = `${size}px ${font}, 'Comic Sans MS', cursive`;
    for (let p = 0; p < 4; p++) {
      ctx.globalAlpha = 0.45 + rng() * 0.3;
      ctx.fillStyle = color;
      ctx.fillText(line, (rng() - 0.5) * 4, (rng() - 0.5) * 4);
    }
    ctx.restore();
    const tw = Math.min(w * 0.95, ctx.measureText ? line.length * size * 0.45 : w);
    drips(ctx, rng, w / 2 - tw / 2 + rng() * tw, y + size * 0.3, 3, lh * 0.6, color, 3);
    drips(ctx, rng, w / 2 - tw / 2 + rng() * tw, y + size * 0.3, 2, lh * 0.5, color, 2);
  });
  return c;
}

export function handprints({ w = 512, h = 512, count = 9, color = [70, 8, 8], seed = 91 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = 60 + rng() * (w - 120);
    const y = 60 + rng() * (h - 120);
    const s = 0.7 + rng() * 0.4;
    const a = (rng() - 0.5) * 0.8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(s, s);
    ctx.fillStyle = rgb(...color, 0.55 + rng() * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 10, 20, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    const fingers = [[-18, -18, -0.5], [-8, -30, -0.15], [3, -32, 0], [13, -28, 0.15], [24, -2, 0.9]];
    for (const [fx, fy, fa] of fingers) {
      ctx.beginPath();
      ctx.ellipse(fx, fy, 5, 13, fa, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drips(ctx, rng, x, y + 20, 2, 60, rgb(...color, 0.5), 2);
  }
  return c;
}

export function tally({ w = 512, h = 256, groups = 22, seed = 97 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.strokeStyle = 'rgba(210,200,180,0.55)';
  ctx.lineCap = 'round';
  let x = 20;
  let y = 30;
  for (let g = 0; g < groups; g++) {
    for (let k = 0; k < 4; k++) {
      ctx.lineWidth = 2 + rng();
      ctx.beginPath();
      ctx.moveTo(x + k * 9 + rng() * 2, y);
      ctx.lineTo(x + k * 9 + rng() * 3, y + 40);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 36);
    ctx.lineTo(x + 34, y + 4);
    ctx.stroke();
    x += 56;
    if (x > w - 50) {
      x = 20;
      y += 62;
    }
  }
  return c;
}

export function rainGlass({ w = 256, h = 512, seed = 101 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  for (let i = 0; i < 70; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const len = 20 + rng() * 120;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, 'rgba(200,210,230,0)');
    g.addColorStop(1, 'rgba(200,210,230,0.35)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + (rng() - 0.5) * 6, y + len * 0.3, x + (rng() - 0.5) * 6, y + len * 0.6, x + (rng() - 0.5) * 4, y + len);
    ctx.stroke();
  }
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(210,220,240,${0.1 + rng() * 0.3})`;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, 0.6 + rng() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function flashCookie(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(7);
  const n = noiseField(size, size, 8, 8, 3, 5);
  eachPixel(ctx, size, size, (d, p, x, y, i) => {
    const dx = x / size - 0.5;
    const dy = y / size - 0.5;
    const r = Math.sqrt(dx * dx + dy * dy) * 2;
    let v = Math.exp(-r * r * 3.2) * 0.9;
    v += Math.exp(-Math.pow((r - 0.42) / 0.05, 2)) * 0.28;
    v += Math.exp(-r * r * 30) * 0.4;
    v *= 0.85 + 0.25 * n[i];
    v *= 1 - Math.min(1, Math.max(0, (r - 0.8) / 0.2));
    const b = Math.max(0, Math.min(255, v * 255));
    d[p] = b;
    d[p + 1] = b * 0.97;
    d[p + 2] = b * 0.9;
    d[p + 3] = 255;
  });
  // a few dust specks on the lens
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.1 + rng() * 0.2})`;
    ctx.beginPath();
    ctx.arc(size * (0.3 + rng() * 0.4), size * (0.3 + rng() * 0.4), 1 + rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function clockFace(size = 256, h = 3, m = 13) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const cx = size / 2;
  ctx.fillStyle = '#cfc6ae';
  ctx.beginPath();
  ctx.arc(cx, cx, cx - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a2016';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#2a2016';
  ctx.font = '26px Fell, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const num = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  num.forEach((t, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(t, cx + Math.cos(a) * (cx - 30), cx + Math.sin(a) * (cx - 30));
  });
  const hand = (a, len, w) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.lineTo(cx + Math.cos(a) * len, cx + Math.sin(a) * len);
    ctx.stroke();
  };
  hand(((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2, cx * 0.5, 7);
  hand((m / 60) * Math.PI * 2 - Math.PI / 2, cx * 0.75, 4);
  grime(ctx, size, size, { seed: 3, period: 3, lo: 0.6, hi: 1.05 });
  return c;
}

export function sign() {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  const rng = mulberry32(5);
  ctx.fillStyle = '#e6dcc4';
  ctx.fillRect(0, 0, 256, 128);
  const cols = ['#c0306a', '#1d3fa0', '#2f8a2f', '#e0a21a', '#8a2a7a'];
  ctx.font = "40px Schoolbell, 'Comic Sans MS', cursive";
  ctx.textAlign = 'center';
  const t = "ELLIE'S ROOM";
  let x = 22;
  for (const ch of t) {
    ctx.fillStyle = cols[Math.floor(rng() * cols.length)];
    ctx.fillText(ch, x, 52 + (rng() - 0.5) * 8);
    x += ch === ' ' ? 12 : 19;
  }
  ctx.font = "26px Schoolbell, 'Comic Sans MS', cursive";
  ctx.fillStyle = '#b0151a';
  ctx.fillText('KEEP OUT', 128, 96);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 90);
  ctx.lineTo(196, 88);
  ctx.stroke();
  ctx.font = "22px Caveat, cursive";
  ctx.fillStyle = '#111';
  ctx.fillText('keep it LOCKED', 128, 120);
  grime(ctx, 256, 128, { seed: 9, period: 2, lo: 0.7, hi: 1.02 });
  return c;
}

/** Faded fan poster above Sam's old bed. */
export function poster85() {
  const W = 256;
  const H = 384;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#9e1b1b');
  g.addColorStop(1, '#5c0c0c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(210,170,70,0.9)';
  ctx.font = 'bold 170px Fell, serif';
  ctx.textAlign = 'center';
  ctx.fillText('85', W / 2, 210);
  // a big, happy tight end silhouette mid-celebration
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.ellipse(128, 250, 26, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(92, 268, 72, 70);
  ctx.beginPath();
  ctx.moveTo(92, 280);
  ctx.lineTo(40, 222);
  ctx.lineTo(52, 214);
  ctx.lineTo(100, 268);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(164, 280);
  ctx.lineTo(216, 222);
  ctx.lineTo(204, 214);
  ctx.lineTo(156, 268);
  ctx.fill();
  ctx.fillStyle = '#6b3a1a';
  ctx.beginPath();
  ctx.ellipse(40, 206, 14, 9, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(230,200,120,0.95)';
  ctx.font = 'bold 30px Elite, monospace';
  ctx.fillText('KITTLE', W / 2, 372);
  grime(ctx, W, H, { seed: 85, period: 3, lo: 0.55, hi: 1.05, tint: [1, 0.9, 0.7], tintAmt: 0.5 });
  return c;
}

export function newspaper() {
  const W = 256;
  const H = 320;
  const c = paper(W, H, 111, [206, 198, 176]);
  const ctx = c.getContext('2d');
  const rng = mulberry32(111);
  ctx.fillStyle = '#1c1812';
  ctx.font = 'bold 21px Fell, serif';
  ctx.textAlign = 'left';
  ctx.fillText('GIRL, 7, FOUND', 16, 38);
  ctx.fillText('IN WELL', 16, 62);
  ctx.fillRect(16, 70, W - 32, 2);
  ctx.fillStyle = '#3a342a';
  ctx.fillRect(16, 82, 100, 110);
  for (let y = 84; y < H - 20; y += 7) {
    const x0 = y < 196 ? 124 : 16;
    ctx.fillStyle = `rgba(30,25,18,${0.35 + rng() * 0.3})`;
    ctx.fillRect(x0, y, W - 16 - x0 - rng() * 30, 3);
  }
  return c;
}

export function bookSpines({ w = 256, h = 256, seed = 121 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = '#0c0a08';
  ctx.fillRect(0, 0, w, h);
  const shelf = h / 2;
  for (let row = 0; row < 2; row++) {
    let x = 0;
    while (x < w) {
      const bw = 8 + rng() * 18;
      const bh = shelf * (0.65 + rng() * 0.33);
      const hue = [[90, 30, 25], [30, 50, 40], [40, 40, 70], [80, 65, 40], [50, 30, 50]][Math.floor(rng() * 5)];
      const t = 0.5 + rng() * 0.6;
      ctx.fillStyle = rgb(hue[0] * t, hue[1] * t, hue[2] * t);
      const y = row * shelf + shelf - bh;
      if (rng() < 0.08) {
        x += bw;
        continue;
      }
      ctx.fillRect(x, y, bw - 1, bh);
      ctx.fillStyle = 'rgba(200,170,90,0.35)';
      ctx.fillRect(x + 1, y + bh * 0.15, bw - 3, 2);
      ctx.fillRect(x + 1, y + bh * 0.8, bw - 3, 2);
      x += bw;
    }
  }
  grime(ctx, w, h, { seed, period: 3, lo: 0.6, hi: 1.05 });
  return c;
}

export function placeCard(name) {
  const c = makeCanvas(128, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e4dccb';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#7a1414';
  ctx.font = "34px Schoolbell, 'Comic Sans MS', cursive";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 64, 34);
  return c;
}

export function numberPlate(text) {
  const c = makeCanvas(128, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1b19';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#c9c0a8';
  ctx.font = 'bold 42px Fell, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 34);
  grime(ctx, 128, 64, { seed: 57, period: 2, lo: 0.6, hi: 1.05 });
  return c;
}

export function rulesPaper() {
  const c = paper(256, 320, 131, [220, 212, 190]);
  const ctx = c.getContext('2d');
  const rng = mulberry32(131);
  ctx.fillStyle = '#231a12';
  ctx.font = '22px Caveat, cursive';
  ctx.fillText('RULES OF THE HOUSE', 30, 40);
  for (let i = 0; i < 7; i++) {
    const y = 76 + i * 34;
    ctx.fillText(`${i + 1}.`, 22, y);
    ctx.strokeStyle = i === 6 ? '#6d1010' : '#2a2016';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let x = 44;
    ctx.moveTo(x, y - 6);
    while (x < 230 - rng() * 60) {
      x += 6;
      ctx.lineTo(x, y - 6 + Math.sin(x * 0.8) * 3 + (rng() - 0.5) * 3);
    }
    ctx.stroke();
  }
  return c;
}

/** Tiny animated TV snow. Call update() each frame while visible. */
export function makeStatic(w = 96, h = 72) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const tex = toTex(c, { repeat: false });
  let figure = 0;
  return {
    canvas: c,
    tex,
    setFigure(v) {
      figure = v;
    },
    update() {
      const d = img.data;
      for (let y = 0, p = 0; y < h; y++) {
        const roll = Math.random() < 0.02 ? 0.4 : 1;
        for (let x = 0; x < w; x++, p += 4) {
          let v = Math.random() * 255 * roll;
          if (figure > 0) {
            // a tall dark shape standing in the snow
            const dx = (x - w * 0.5) / (w * 0.07);
            const dy = (y - h * 0.55) / (h * 0.38);
            const head = Math.hypot((x - w * 0.5) / (w * 0.05), (y - h * 0.2) / (h * 0.08));
            if ((dx * dx < 1 && Math.abs(dy) < 1) || head < 1) v *= 1 - figure * 0.85;
          }
          d[p] = v;
          d[p + 1] = v;
          d[p + 2] = v;
          d[p + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      tex.needsUpdate = true;
    },
  };
}
