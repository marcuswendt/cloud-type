// titletype.focus: a lens finding the sharp point. Every dot is moved by a
// draw from its bokeh kernel, the kernel's radius `defocus` caps times the
// dot's defocus, so a soft letter is the sharp one convolved with the bokeh;
// `fade` thins defocused dots, `rings` draws a few as visible bokeh rings,
// `ghost` adds a faint offset second image. Plus the reticle.

import type { Dot } from './stipple';
import { Rng } from './rng';

export const POINT = -9.0; // a tone that makes the dot a single pen-down at the pen's width

export interface FocusOptions {
  field: 'tilt' | 'radial' | 'swept' | 'hunt';
  center: [number, number];
  angle: number;
  dof: number;
  span: number;
  defocus: number;
  kernel: 'disc' | 'ring' | 'cateye';
  rim: number;
  cat: number;
  fade: number;
  ghost: number;
  ghostDir: [number, number];
  sweep: number;
  rhythm: number;
  seed: number;
  bbox: [number, number, number, number];
  orderRange: [number, number];
  rings: number;
  ringPitch: number;
  shrink: number;
  ringTone: number;
}

function bokehOffsets(rng: Rng, n: number, kernel: string, rim: number, cat: number, toward: Float64Array | null): Float64Array {
  const off = new Float64Array(n * 2);
  // Draw order kept as in numpy: all radii, then rim picks, then angles.
  const rad = new Float64Array(n);
  for (let i = 0; i < n; i++) rad[i] = Math.sqrt(rng.random());
  if (kernel === 'ring' || kernel === 'cateye') {
    const onRim = new Uint8Array(n);
    for (let i = 0; i < n; i++) onRim[i] = rng.random() < rim ? 1 : 0;
    for (let i = 0; i < n; i++) if (onRim[i]) rad[i] = 0.85 + 0.15 * rng.random();
  }
  for (let i = 0; i < n; i++) {
    const a = rng.random() * 2 * Math.PI;
    off[2 * i] = Math.cos(a) * rad[i];
    off[2 * i + 1] = Math.sin(a) * rad[i];
  }
  if (kernel === 'cateye' && cat > 0 && toward) {
    for (let i = 0; i < n; i++) {
      const bad = Math.hypot(off[2 * i] - cat * toward[2 * i], off[2 * i + 1] - cat * toward[2 * i + 1]) > 1.0;
      if (bad) {
        off[2 * i] *= (1 - cat) * 0.9;
        off[2 * i + 1] *= (1 - cat) * 0.9;
      }
    }
  }
  return off;
}

export function focusField(dots: Dot[], comp: Int32Array, order: Float64Array, o: FocusOptions): Float64Array {
  const [x0, y0, x1, y1] = o.bbox;
  const W = Math.max(1e-6, x1 - x0);
  const asp = (y1 - y0) / W;
  const cu = o.center[0];
  const cv = o.center[1] * asp;
  const n = dots.length;
  const f = new Float64Array(n);
  let phase = 0;
  if (o.field === 'hunt') phase = new Rng(o.seed + 811).uniform(0, 2 * Math.PI);
  const a = (o.angle * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const u = (dots[i].x - x0) / W;
    const v = ((dots[i].y - y0) / Math.max(1e-6, y1 - y0)) * asp;
    let d: number;
    if (o.field === 'radial') d = Math.hypot(u - cu, v - cv);
    else if (o.field === 'swept' || o.field === 'hunt') {
      const pos = order.length ? order[comp[i]] : 0;
      if (o.field === 'swept') d = Math.abs(pos - o.sweep);
      else d = 0.5 * (1 - Math.cos(2 * Math.PI * o.rhythm * pos + phase)) * o.span;
    } else d = Math.abs(-(u - cu) * Math.sin(a) + (v - cv) * Math.cos(a));
    f[i] = Math.pow(Math.min(1, Math.max(0, (d - o.dof) / Math.max(1e-6, o.span))), 1.2);
  }
  return f;
}

/**
 * `comp[i]`: the connected piece of ink each dot sits on (0 outside), `ncomp`
 * the label count; used for the reading order of `swept` and `hunt`.
 */
export function focus(dots: Dot[], comp: Int32Array, ncomp: number, capMm: number, o: FocusOptions): Dot[] {
  if (!dots.length) return [];
  const rng = new Rng(o.seed + 801);
  const n = dots.length;
  // Reading order of the letters: by line (row of the centroid), then x.
  const order = new Float64Array(ncomp);
  if (ncomp > 1) {
    const sx = new Float64Array(ncomp), sy = new Float64Array(ncomp), cnt = new Float64Array(ncomp);
    for (let i = 0; i < n; i++) {
      const c = comp[i];
      sx[c] += dots[i].x;
      sy[c] += dots[i].y;
      cnt[c]++;
    }
    const cents: [number, number, number][] = [];
    for (let l = 1; l < ncomp; l++) if (cnt[l]) cents.push([l, sy[l] / cnt[l], sx[l] / cnt[l]]);
    cents.sort((a, b) => {
      const ra = Math.round(a[1] / (1.1 * capMm)), rb = Math.round(b[1] / (1.1 * capMm));
      return ra !== rb ? ra - rb : a[2] - b[2];
    });
    cents.forEach(([l], k) => {
      order[l] = o.orderRange[0] + ((o.orderRange[1] - o.orderRange[0]) * k) / Math.max(1, cents.length - 1);
    });
  }
  const f = focusField(dots, comp, order, o);
  const [bx0, by0, bx1, by1] = o.bbox;
  const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
  const outDir = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const dx = dots[i].x - cx, dy = dots[i].y - cy;
    const m = Math.hypot(dx, dy) + 1e-9;
    outDir[2 * i] = dx / m;
    outDir[2 * i + 1] = dy / m;
  }
  const off = bokehOffsets(rng, n, o.kernel, o.rim, o.cat, outDir);
  const r = new Float64Array(n);
  const mx = new Float64Array(n), my = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = o.defocus * capMm * f[i];
    mx[i] = dots[i].x + off[2 * i] * r[i];
    my[i] = dots[i].y + off[2 * i + 1] * r[i];
  }
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) keep[i] = rng.random() > o.fade * Math.pow(f[i], 1.5) ? 1 : 0;
  const out: Dot[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push({ x: mx[i], y: my[i], t: dots[i].t - o.shrink * 2.5 * f[i] });
  if (o.rings > 0) {
    const step = o.ringPitch || 0.55;
    const sel: number[] = [];
    for (let i = 0; i < n; i++) if (rng.random() < o.rings * 0.03 * f[i] * f[i]) sel.push(i);
    for (const i of sel) {
      const rad = Math.max(r[i] * rng.uniform(0.35, 0.8), 2 * step);
      const m = Math.max(6, Math.floor((2 * Math.PI * rad) / step));
      const th0 = rng.uniform(0, 2 * Math.PI);
      for (let j = 0; j < m; j++) {
        const th = th0 + (2 * Math.PI * j) / m;
        const px = mx[i] + rad * Math.cos(th);
        const py = my[i] + rad * Math.sin(th);
        if (o.kernel === 'cateye' && o.cat > 0) {
          const tx = outDir[2 * i], ty = outDir[2 * i + 1];
          if (Math.hypot(px - mx[i] - o.cat * rad * tx, py - my[i] - o.cat * rad * ty) > rad * 1.02) continue;
        }
        out.push({ x: px, y: py, t: o.ringTone });
      }
    }
  }
  if (o.ghost > 0) {
    const gx = o.ghostDir[0] * capMm * 0.08, gy = o.ghostDir[1] * capMm * 0.08;
    const sel: number[] = [];
    for (let i = 0; i < n; i++) if (rng.random() < o.ghost * f[i] && keep[i]) sel.push(i);
    const off2 = bokehOffsets(rng, sel.length, o.kernel, o.rim, 0, null);
    sel.forEach((i, k) => {
      out.push({ x: dots[i].x + gx + off2[2 * k] * r[i] * 1.1, y: dots[i].y + gy + off2[2 * k + 1] * r[i] * 1.1, t: POINT });
    });
  }
  return out;
}

/** A faint focusing reticle (a broken crosshair at the focus point) and an optional focus scale. */
export function reticle(
  bbox: [number, number, number, number],
  capMm: number,
  pitchMm: number,
  center: [number, number],
  amount: number,
  scale: boolean,
  scaleLength = 0.55
): Dot[] {
  const [x0, y0, x1, y1] = bbox;
  const cx = x0 + center[0] * (x1 - x0), cy = y0 + center[1] * (y1 - y0);
  const s = pitchMm * 1.6;
  const pts: Dot[] = [];
  const arm = 0.9 * capMm * amount, gap = 0.25 * capMm;
  for (const sign of [-1, 1]) {
    for (let t = gap; t < gap + arm - 1e-9; t += s) {
      pts.push({ x: cx + sign * t, y: cy, t: POINT }, { x: cx, y: cy + sign * t, t: POINT });
    }
  }
  if (scale) {
    const y = y1 + 0.5 * capMm;
    for (let i = 0; i < 23; i++) {
      const x = x0 + (scaleLength * (x1 - x0) * i) / 22;
      const hh = i % 5 === 0 ? 0.35 * capMm : 0.18 * capMm;
      for (let yy = y; yy < y + hh - 1e-9; yy += s) pts.push({ x, y: yy, t: POINT });
    }
  }
  return pts;
}
