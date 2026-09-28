// Low-level helpers for painting procedural textures on 2D canvases.
import { mulberry32 } from '../core/util.js';

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // we read pixels back a lot while painting
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

/** Tileable multi-octave value noise in [0,1]. periodX/Y = lattice cells across the image for octave 0. */
export function noiseField(w, h, periodX, periodY, octaves, seed, persistence = 0.5) {
  const out = new Float32Array(w * h);
  const rng = mulberry32(seed);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const PX = Math.max(1, Math.round(periodX * (1 << o)));
    const PY = Math.max(1, Math.round(periodY * (1 << o)));
    const grid = new Float32Array(PX * PY);
    for (let i = 0; i < grid.length; i++) grid[i] = rng();
    for (let y = 0; y < h; y++) {
      const gy = (y / h) * PY;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % PY) * PX;
      const r1 = ((y0 + 1) % PY) * PX;
      for (let x = 0; x < w; x++) {
        const gx = (x / w) * PX;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % PX;
        const c1 = (x0 + 1) % PX;
        const a = grid[r0 + c0];
        const b = grid[r0 + c1];
        const c = grid[r1 + c0];
        const d = grid[r1 + c1];
        const top = a + (b - a) * sx;
        const bot = c + (d - c) * sx;
        out[y * w + x] += amp * (top + (bot - top) * sy);
      }
    }
    total += amp;
    amp *= persistence;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Iterate pixels: fn(data, index*4, x, y, i). */
export function eachPixel(ctx, w, h, fn) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) fn(d, i * 4, x, y, i);
  }
  ctx.putImageData(img, 0, 0);
}

/** Multiply the canvas by (lo + (hi-lo)*noise), tinting toward `tint` in stained areas. */
export function grime(ctx, w, h, { seed = 1, period = 4, octaves = 5, lo = 0.72, hi = 1.08, tint = [0.85, 0.75, 0.55], tintAmt = 0.25 } = {}) {
  const n = noiseField(w, h, period, period, octaves, seed);
  const n2 = noiseField(w, h, period * 2, period * 2, 3, seed + 99);
  eachPixel(ctx, w, h, (d, p, x, y, i) => {
    const f = lo + (hi - lo) * n[i];
    const t = Math.max(0, n2[i] - 0.5) * 2 * tintAmt;
    d[p] = Math.min(255, d[p] * f * (1 - t + t * tint[0]));
    d[p + 1] = Math.min(255, d[p + 1] * f * (1 - t + t * tint[1]));
    d[p + 2] = Math.min(255, d[p + 2] * f * (1 - t + t * tint[2]));
  });
}

/** Call draw(ox, oy) for every wrapped copy needed so a shape at (x,y) with radius r tiles. */
export function wrapped(w, h, x, y, r, draw) {
  for (const ox of [-w, 0, w]) {
    for (const oy of [-h, 0, h]) {
      if (x + ox + r < 0 || x + ox - r > w || y + oy + r < 0 || y + oy - r > h) continue;
      draw(x + ox, y + oy);
    }
  }
}

/** Soft circular stain with a darker rim (water damage). */
export function stain(ctx, x, y, r, color = [70, 50, 25], alpha = 0.35) {
  const [cr, cg, cb] = color;
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * 0.35})`);
  g.addColorStop(0.75, `rgba(${cr},${cg},${cb},${alpha * 0.55})`);
  g.addColorStop(0.9, `rgba(${cr * 0.7},${cg * 0.7},${cb * 0.7},${alpha})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Random-walk crack line. */
export function crack(ctx, rng, x, y, len, width = 1, color = 'rgba(20,15,10,0.55)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  let a = rng() * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i < len; i++) {
    a += (rng() - 0.5) * 0.9;
    x += Math.cos(a) * 4;
    y += Math.sin(a) * 4;
    ctx.lineTo(x, y);
    if (rng() < 0.06) {
      crack(ctx, rng, x, y, Math.floor(len * 0.4), width * 0.7, color);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }
  ctx.stroke();
}

/** Vertical drips running down from (x,y). */
export function drips(ctx, rng, x, y, count, maxLen, color, width = 3) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const dx = x + (rng() - 0.5) * 20;
    const len = maxLen * (0.2 + rng() * 0.8);
    const wv = width * (0.5 + rng() * 0.8);
    ctx.lineWidth = wv;
    ctx.beginPath();
    ctx.moveTo(dx, y);
    ctx.lineTo(dx + (rng() - 0.5) * 3, y + len);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dx, y + len, wv * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A wobbly hand-drawn stroke through points (crayon/marker look). */
export function scribble(ctx, rng, pts, { color = '#222', width = 3, passes = 3, jitter = 1.5, alpha = 0.7 } = {}) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    ctx.globalAlpha = alpha * (0.6 + rng() * 0.4);
    ctx.lineWidth = width * (0.7 + rng() * 0.5);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const jx = x + (rng() - 0.5) * jitter * 2;
      const jy = y + (rng() - 0.5) * jitter * 2;
      if (i === 0) ctx.moveTo(jx, jy);
      else ctx.lineTo(jx, jy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function circlePts(cx, cy, rx, ry, n = 24, start = 0, end = Math.PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = start + ((end - start) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Hatch-fill a region with crayon strokes (clip to path first). */
export function crayonFill(ctx, rng, x0, y0, x1, y1, color, spacing = 4, alpha = 0.55) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let x = x0 - (y1 - y0); x < x1; x += spacing) {
    ctx.globalAlpha = alpha * (0.6 + rng() * 0.4);
    ctx.lineWidth = 2 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(x + rng() * 2, y1);
    ctx.lineTo(x + (y1 - y0) + rng() * 2, y0);
    ctx.stroke();
  }
  ctx.restore();
}

/** Add fine paper/film noise. */
export function speckle(ctx, w, h, seed, amount = 18) {
  const rng = mulberry32(seed);
  eachPixel(ctx, w, h, (d, p) => {
    const n = (rng() - 0.5) * amount;
    d[p] = Math.max(0, Math.min(255, d[p] + n));
    d[p + 1] = Math.max(0, Math.min(255, d[p + 1] + n));
    d[p + 2] = Math.max(0, Math.min(255, d[p + 2] + n));
  });
}
