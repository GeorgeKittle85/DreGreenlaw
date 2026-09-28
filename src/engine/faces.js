// Paints the face of the thing that wears Ellie. Used for the 3D head texture
// and for the full-frame jump-scare / subliminal images.
import { mulberry32 } from '../core/util.js';
import { makeCanvas, noiseField, eachPixel } from './paint.js';

/**
 * @param {number} S canvas size
 * @param {object} o
 *   scream  – mouth torn open
 *   frame   – full-screen version (black background, hair curtain, face oval)
 */
export function paintFace(S, { scream = false, frame = false, seed = 666 } = {}) {
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const cx = S / 2;
  const cy = frame ? S * 0.47 : S * 0.5;
  const fw = frame ? S * 0.3 : S * 0.5;
  const fh = frame ? S * (scream ? 0.44 : 0.38) : S * 0.5;
  const P = (u, v) => [cx + u * fw, cy + v * fh];

  // ---- background
  if (frame) {
    const bg = ctx.createRadialGradient(cx, cy, S * 0.1, cx, cy, S * 0.7);
    bg.addColorStop(0, '#1a0606');
    bg.addColorStop(1, '#000');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);
  } else {
    ctx.fillStyle = '#b9b5a8';
    ctx.fillRect(0, 0, S, S);
  }

  // ---- face shape (egg, narrow jaw; jaw drops when screaming)
  ctx.save();
  if (frame) {
    ctx.beginPath();
    const jaw = scream ? 1.18 : 1.0;
    const [tx, ty] = P(0, -1);
    ctx.moveTo(tx, ty);
    ctx.bezierCurveTo(...P(0.75, -1), ...P(1.02, -0.45), ...P(0.98, 0.05));
    ctx.bezierCurveTo(...P(0.94, 0.5), ...P(0.55, jaw * 0.95), ...P(0, jaw));
    ctx.bezierCurveTo(...P(-0.55, jaw * 0.95), ...P(-0.94, 0.5), ...P(-0.98, 0.05));
    ctx.bezierCurveTo(...P(-1.02, -0.45), ...P(-0.75, -1), tx, ty);
    ctx.closePath();
    ctx.clip();
  }
  const sk = ctx.createRadialGradient(cx, cy - fh * 0.1, fw * 0.1, cx, cy, fw * 1.25);
  sk.addColorStop(0, '#d7d3c6');
  sk.addColorStop(0.55, '#b3afa2');
  sk.addColorStop(0.85, '#7c786d');
  sk.addColorStop(1, '#3c3a35');
  ctx.fillStyle = sk;
  ctx.fillRect(0, 0, S, S);

  // blotchy dead skin
  const n = noiseField(S, S, 6, 6, 5, seed);
  const n2 = noiseField(S, S, 24, 24, 2, seed + 1);
  eachPixel(ctx, S, S, (d, p, x, y, i) => {
    const f = 0.84 + 0.24 * n[i] + 0.06 * n2[i];
    const g = n[i] > 0.62 ? 0.94 : 1;
    d[p] *= f;
    d[p + 1] *= f * g;
    d[p + 2] *= f * (n[i] < 0.35 ? 1.06 : 1);
  });

  // veins
  ctx.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    let [x, y] = P((rng() - 0.5) * 1.6, (rng() - 0.5) * 1.6);
    let a = rng() * Math.PI * 2;
    ctx.strokeStyle = `rgba(55,70,85,${0.12 + rng() * 0.18})`;
    ctx.lineWidth = S * 0.002 * (1 + rng());
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 22; s++) {
      a += (rng() - 0.5) * 0.8;
      x += Math.cos(a) * S * 0.012;
      y += Math.sin(a) * S * 0.012;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // hollows: temples, cheeks, under the brow
  const shade = (u, v, r, a, col = '20,16,14') => {
    const [x, y] = P(u, v);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * fw);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * fw, 0, Math.PI * 2);
    ctx.fill();
  };
  shade(-0.62, 0.28, 0.36, 0.35);
  shade(0.62, 0.28, 0.36, 0.35);
  shade(-0.95, -0.2, 0.3, 0.3);
  shade(0.95, -0.2, 0.3, 0.3);
  shade(0, -0.72, 0.5, 0.12);

  // ---- eyes: sunken, bruised, irregular sockets; black almond eyes with a wet glint
  const eyes = [
    { u: -0.35, v: -0.12, s: 1.06, tilt: 0.12 },
    { u: 0.36, v: -0.16, s: 0.94, tilt: -0.18 },
  ];
  const eyeScale = scream ? 1.22 : 1;
  for (const e of eyes) {
    const [x, y] = P(e.u, e.v);
    const sr = fw * 0.3 * e.s;
    for (let k = 0; k < 5; k++) {
      const ox = (rng() - 0.5) * sr * 0.5;
      const oy = (rng() - 0.3) * sr * 0.45;
      const g = ctx.createRadialGradient(x + ox, y + oy, sr * 0.1, x + ox, y + oy, sr * (0.8 + rng() * 0.4));
      g.addColorStop(0, `rgba(${24 + rng() * 20},${10 + rng() * 10},${22 + rng() * 16},0.5)`);
      g.addColorStop(1, 'rgba(50,30,45,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, sr * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const rx = fw * 0.15 * e.s * eyeScale;
    const ry = fh * 0.075 * e.s * eyeScale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.tilt * (e.u < 0 ? 1 : -1));
    // almond shape, outer corner drooping
    const outer = e.u < 0 ? -1 : 1;
    ctx.fillStyle = '#020101';
    ctx.beginPath();
    ctx.moveTo(-outer * rx, -ry * 0.1);
    ctx.bezierCurveTo(-outer * rx * 0.5, -ry * 1.3, outer * rx * 0.6, -ry * 1.25, outer * rx * 1.1, ry * 0.35);
    ctx.bezierCurveTo(outer * rx * 0.5, ry * 1.2, -outer * rx * 0.5, ry * 1.1, -outer * rx, -ry * 0.1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,40,50,0.55)';
    ctx.lineWidth = S * 0.004;
    ctx.stroke();
    ctx.fillStyle = 'rgba(245,245,238,0.95)';
    ctx.beginPath();
    ctx.arc(-rx * 0.28, -ry * 0.35, Math.max(1, S * 0.0055), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // black tears
    for (let t = 0; t < 3; t++) {
      let tx = x + (rng() - 0.5) * rx * 1.2;
      let ty = y + ry * 0.8;
      ctx.strokeStyle = `rgba(8,5,5,${0.35 + rng() * 0.45})`;
      ctx.lineWidth = S * (0.003 + rng() * 0.004);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      const len = fh * (0.25 + rng() * 0.6);
      for (let s = 0; s < 10; s++) {
        tx += (rng() - 0.5) * S * 0.006;
        ty += len / 10;
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
    }
  }
  // brow furrows / wrinkles
  ctx.strokeStyle = 'rgba(40,30,28,0.25)';
  ctx.lineWidth = S * 0.003;
  for (let k = 0; k < 7; k++) {
    const [x, y] = P((rng() - 0.5) * 0.9, -0.45 - rng() * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + fw * 0.15, y - fh * 0.03 * (rng() - 0.5), x + fw * (0.2 + rng() * 0.2), y + fh * 0.02);
    ctx.stroke();
  }

  // ---- nose: no bridge, just two slits
  ctx.fillStyle = 'rgba(15,8,8,0.85)';
  for (const s of [-1, 1]) {
    const [x, y] = P(s * 0.065, 0.18);
    ctx.beginPath();
    ctx.ellipse(x, y, fw * 0.022, fh * 0.032, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  shade(0, 0.12, 0.12, 0.25);

  // ---- mouth
  const toothColor = () => {
    const c1 = 150 + rng() * 60;
    return `rgba(${c1},${c1 * 0.92},${c1 * 0.68},0.97)`;
  };
  if (!scream) {
    // A rictus grin that runs nearly ear to ear, lips peeled back over two rows of crowded teeth.
    const L = P(-0.74, 0.26);
    const R = P(0.74, 0.22);
    const upperMid = P(0, 0.4);
    const lowerMid = P(0, 0.58);
    const up = (t) => {
      const x = L[0] + (R[0] - L[0]) * t;
      const b = Math.sin(t * Math.PI);
      return [x, L[1] + (R[1] - L[1]) * t + b * (upperMid[1] - L[1])];
    };
    const lo = (t) => {
      const x = L[0] + (R[0] - L[0]) * t;
      const b = Math.sin(t * Math.PI);
      return [x, L[1] + (R[1] - L[1]) * t + b * (lowerMid[1] - L[1])];
    };
    // gums
    ctx.fillStyle = '#3b0d10';
    ctx.beginPath();
    ctx.moveTo(...L);
    for (let i = 1; i <= 30; i++) ctx.lineTo(...up(i / 30));
    for (let i = 30; i >= 0; i--) ctx.lineTo(...lo(i / 30));
    ctx.fill();
    // throat gap between the rows
    ctx.fillStyle = '#050202';
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const [x, y1] = up(t);
      const y2 = lo(t)[1];
      const yy = y1 + (y2 - y1) * 0.46;
      if (i === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    for (let i = 30; i >= 0; i--) {
      const t = i / 30;
      const [x, y1] = up(t);
      const y2 = lo(t)[1];
      ctx.lineTo(x, y1 + (y2 - y1) * 0.6);
    }
    ctx.fill();
    // teeth
    const n = 26;
    for (let i = 1; i < n; i++) {
      const t = i / n + (rng() - 0.5) * 0.01;
      const [x, y1] = up(t);
      const y2 = lo(t)[1];
      const gap = y2 - y1;
      const curve = Math.sin(t * Math.PI);
      const tw = fw * 0.052 * (0.55 + rng() * 0.5) * (0.35 + curve * 0.65);
      if (rng() > 0.08) {
        ctx.fillStyle = toothColor();
        ctx.fillRect(x - tw / 2, y1 + gap * 0.04, tw * 0.9, gap * (0.36 + rng() * 0.1));
      }
      if (rng() > 0.1) {
        ctx.fillStyle = toothColor();
        const h = gap * (0.3 + rng() * 0.1);
        ctx.fillRect(x - tw / 2 + tw * 0.2, y2 - gap * 0.04 - h, tw * 0.9, h);
      }
    }
    // thin cracked lips
    ctx.strokeStyle = 'rgba(80,20,22,0.9)';
    ctx.lineWidth = S * 0.007;
    ctx.beginPath();
    ctx.moveTo(...L);
    for (let i = 1; i <= 30; i++) ctx.lineTo(...up(i / 30));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...L);
    for (let i = 1; i <= 30; i++) ctx.lineTo(...lo(i / 30));
    ctx.stroke();
    // the corners keep going: split skin up toward the ears
    ctx.strokeStyle = 'rgba(90,10,12,0.75)';
    ctx.lineWidth = S * 0.005;
    for (const [pt, dir] of [[L, -1], [R, 1]]) {
      ctx.beginPath();
      ctx.moveTo(...pt);
      ctx.quadraticCurveTo(pt[0] + dir * fw * 0.1, pt[1] - fh * 0.06, pt[0] + dir * fw * 0.18, pt[1] - fh * 0.22);
      ctx.stroke();
    }
  } else {
    // Jaw unhinged: a tall, torn, irregular hole ringed with broken teeth.
    const [mx, my] = P(0, 0.56);
    const mw = fw * 0.5;
    const mh = fh * 0.58;
    const N = 48;
    const rim = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 1 + (rng() - 0.5) * 0.14 + Math.sin(a * 3 + 1) * 0.04;
      rim.push([mx + Math.cos(a) * mw * r, my + Math.sin(a) * mh * r]);
    }
    const g = ctx.createRadialGradient(mx, my + mh * 0.2, mh * 0.05, mx, my, mh * 1.05);
    g.addColorStop(0, '#000');
    g.addColorStop(0.55, '#060102');
    g.addColorStop(0.82, '#240507');
    g.addColorStop(1, '#4c0b10');
    ctx.fillStyle = g;
    ctx.beginPath();
    rim.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    // teeth on the upper and lower arcs only, sizes all over the place
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const s = Math.sin(a);
      if (Math.abs(s) < 0.45 || rng() < 0.12) continue;
      const [bx, by] = rim[i];
      const inward = [mx - bx, my - by];
      const il = Math.hypot(...inward) || 1;
      const nx = inward[0] / il;
      const ny = inward[1] / il;
      const fang = rng() < 0.15;
      const len = fh * (fang ? 0.2 + rng() * 0.08 : 0.06 + rng() * 0.09) * (rng() < 0.12 ? 0.4 : 1);
      const wid = fw * (0.025 + rng() * 0.035);
      ctx.fillStyle = toothColor();
      ctx.beginPath();
      ctx.moveTo(bx - ny * wid, by + nx * wid);
      ctx.lineTo(bx + nx * len + (rng() - 0.5) * wid, by + ny * len);
      ctx.lineTo(bx + ny * wid, by - nx * wid);
      ctx.closePath();
      ctx.fill();
    }
    // saliva strands
    ctx.strokeStyle = 'rgba(200,190,170,0.3)';
    for (let i = 0; i < 5; i++) {
      const x = mx + (rng() - 0.5) * mw * 1.1;
      ctx.lineWidth = S * (0.0015 + rng() * 0.002);
      ctx.beginPath();
      ctx.moveTo(x, my - mh * 0.75);
      ctx.quadraticCurveTo(x + (rng() - 0.5) * mw * 0.3, my, x + (rng() - 0.5) * mw * 0.1, my + mh * 0.75);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,8,10,0.9)';
    ctx.lineWidth = S * 0.01;
    ctx.beginPath();
    rim.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    // torn cheeks
    ctx.strokeStyle = 'rgba(80,6,8,0.75)';
    ctx.lineWidth = S * 0.006;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(mx + s * mw * 0.95, my - mh * 0.15 + k * mh * 0.1);
        ctx.lineTo(mx + s * mw * (1.3 + rng() * 0.25), my - mh * (0.35 + rng() * 0.35));
        ctx.stroke();
      }
    }
  }

  // grime + dried blood near the mouth
  for (let k = 0; k < 18; k++) {
    const [x, y] = P((rng() - 0.5) * 1.8, (rng() - 0.3) * 1.6);
    const r = S * (0.01 + rng() * 0.05);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const red = rng() < 0.4;
    g.addColorStop(0, red ? 'rgba(70,8,8,0.35)' : 'rgba(40,30,20,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();

  // ---- hair curtain for the full-frame version
  if (frame) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const startU = (rng() - 0.5) * 1.6;
      const [sx, sy] = P(startU, -1.05 - rng() * 0.15);
      const spread = 0.8 + rng() * 0.9;
      const across = rng() < 0.05;
      const endU = across ? startU * 0.3 + (rng() - 0.5) * 0.5 : side * spread + startU * 0.3;
      const [ex, ey] = P(endU, 0.6 + rng() * 1.8);
      const [c1x, c1y] = P(startU + side * (1.0 + rng() * 0.3), -0.7 + rng() * 0.4);
      const [c2x, c2y] = P(endU + side * 0.1, 0.2 + rng() * 0.6);
      ctx.strokeStyle = `rgba(${4 + rng() * 10},${3 + rng() * 6},${3 + rng() * 6},${0.55 + rng() * 0.45})`;
      ctx.lineWidth = S * (0.0015 + rng() * 0.004);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
      ctx.stroke();
    }
    // top of head mass
    ctx.fillStyle = '#050303';
    ctx.beginPath();
    ctx.ellipse(cx, cy - fh * 1.0, fw * 1.1, fh * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // vignette
    const vg = ctx.createRadialGradient(cx, cy, S * 0.25, cx, cy, S * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, S, S);
  }

  // grain
  const r2 = mulberry32(seed + 5);
  eachPixel(ctx, S, S, (d, p) => {
    const g = (r2() - 0.5) * 22;
    d[p] = Math.max(0, Math.min(255, d[p] + g));
    d[p + 1] = Math.max(0, Math.min(255, d[p + 1] + g));
    d[p + 2] = Math.max(0, Math.min(255, d[p + 2] + g));
  });
  return c;
}

/** Hair strand texture: vertical strands with alpha, for the ribbon cards. */
export function hairTexture(w = 64, h = 256, seed = 9) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = rng() * w;
    const wob = (rng() - 0.5) * 6;
    ctx.strokeStyle = `rgba(${8 + rng() * 12},${6 + rng() * 8},${6 + rng() * 8},${0.7 + rng() * 0.3})`;
    ctx.lineWidth = 1 + rng() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + wob, h * 0.3, x - wob, h * 0.6, x + wob * 0.5, h * (0.75 + rng() * 0.25));
    ctx.stroke();
  }
  return c;
}

export function gownTexture(S = 512, seed = 13) {
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = noiseField(S, S, 5, 5, 5, seed);
  const folds = noiseField(S, S, 12, 2, 3, seed + 2);
  eachPixel(ctx, S, S, (d, p, x, y, i) => {
    const hem = y / S;
    const dirt = Math.max(0, hem - 0.6) * 1.6;
    const f = (0.72 + 0.3 * n[i]) * (0.8 + 0.25 * folds[i]);
    d[p] = 205 * f * (1 - dirt * 0.55);
    d[p + 1] = 199 * f * (1 - dirt * 0.62);
    d[p + 2] = 184 * f * (1 - dirt * 0.7);
    d[p + 3] = 255;
  });
  for (let k = 0; k < 14; k++) {
    const x = rng() * S;
    const y = S * 0.3 + rng() * S * 0.7;
    const r = S * (0.02 + rng() * 0.08);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const red = rng() < 0.3;
    g.addColorStop(0, red ? 'rgba(80,12,10,0.45)' : 'rgba(40,32,20,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // a faded print of tiny flowers — it was a little girl's nightgown once
  for (let k = 0; k < 90; k++) {
    ctx.fillStyle = `rgba(150,90,100,${0.08 + rng() * 0.1})`;
    ctx.beginPath();
    ctx.arc(rng() * S, rng() * S, 2 + rng() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function skinTexture(S = 256, seed = 17) {
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  const n = noiseField(S, S, 6, 6, 5, seed);
  eachPixel(ctx, S, S, (d, p, x, y, i) => {
    const f = 0.78 + 0.3 * n[i];
    d[p] = 196 * f;
    d[p + 1] = 192 * f;
    d[p + 2] = 180 * f;
    d[p + 3] = 255;
  });
  ctx.lineCap = 'round';
  for (let k = 0; k < 20; k++) {
    let x = rng() * S;
    let y = rng() * S;
    let a = rng() * 6.28;
    ctx.strokeStyle = `rgba(60,72,90,${0.15 + rng() * 0.2})`;
    ctx.lineWidth = 1 + rng();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) {
      a += (rng() - 0.5) * 0.9;
      x += Math.cos(a) * 5;
      y += Math.sin(a) * 5;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}
