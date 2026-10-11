// titlepage.blow: a light touch. A share of the dots leaves the letters'
// downwind edge in small clumps (a few seeds, their neighbours with them),
// each carried along the wind by a mostly short drift (cap * distance * u^1.8),
// with a little lateral scatter and a slight shrink. Moved, not copied, so
// the edge frays a touch. Plus the pen-aware minimum spacing.

import type { Dot } from './stipple';
import { Rng } from './rng';

export class PointGrid {
  private head: Int32Array;
  private next: Int32Array;
  private gw: number;
  private gh: number;
  private x0: number;
  private y0: number;
  constructor(private xs: Float64Array, private ys: Float64Array, private cell: number) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < xs.length; i++) {
      x0 = Math.min(x0, xs[i]); y0 = Math.min(y0, ys[i]);
      x1 = Math.max(x1, xs[i]); y1 = Math.max(y1, ys[i]);
    }
    if (!xs.length) { x0 = y0 = 0; x1 = y1 = 1; }
    this.x0 = x0; this.y0 = y0;
    this.gw = Math.max(1, Math.ceil((x1 - x0) / cell) + 1);
    this.gh = Math.max(1, Math.ceil((y1 - y0) / cell) + 1);
    this.head = new Int32Array(this.gw * this.gh).fill(-1);
    this.next = new Int32Array(xs.length);
    for (let i = 0; i < xs.length; i++) {
      const c = this.cellOf(xs[i], ys[i]);
      this.next[i] = this.head[c];
      this.head[c] = i;
    }
  }
  private cellOf(x: number, y: number) {
    const cx = Math.min(this.gw - 1, Math.max(0, Math.floor((x - this.x0) / this.cell)));
    const cy = Math.min(this.gh - 1, Math.max(0, Math.floor((y - this.y0) / this.cell)));
    return cy * this.gw + cx;
  }
  /** Indices within `r` of (x, y). */
  within(x: number, y: number, r: number, out: number[] = []): number[] {
    out.length = 0;
    const k = Math.ceil(r / this.cell);
    const cx = Math.floor((x - this.x0) / this.cell), cy = Math.floor((y - this.y0) / this.cell);
    for (let yy = cy - k; yy <= cy + k; yy++) {
      if (yy < 0 || yy >= this.gh) continue;
      for (let xx = cx - k; xx <= cx + k; xx++) {
        if (xx < 0 || xx >= this.gw) continue;
        for (let i = this.head[yy * this.gw + xx]; i >= 0; i = this.next[i]) {
          if ((this.xs[i] - x) ** 2 + (this.ys[i] - y) ** 2 <= r * r) out.push(i);
        }
      }
    }
    return out;
  }
  /** The `k` nearest indices to (x, y), nearest first. */
  nearest(x: number, y: number, k: number): number[] {
    let r = this.cell;
    const n = this.xs.length;
    k = Math.min(k, n);
    for (;;) {
      const got = this.within(x, y, r);
      if (got.length >= k || r > 1e4) {
        got.sort((a, b) => (this.xs[a] - x) ** 2 + (this.ys[a] - y) ** 2 - ((this.xs[b] - x) ** 2 + (this.ys[b] - y) ** 2));
        return got.slice(0, k);
      }
      r *= 2;
    }
  }
}

export function medianNN(xs: Float64Array, ys: Float64Array, guess: number): number {
  if (xs.length < 2) return guess;
  const g = new PointGrid(xs, ys, guess);
  const d: number[] = [];
  const step = Math.max(1, Math.floor(xs.length / 4000));
  for (let i = 0; i < xs.length; i += step) {
    const nb = g.nearest(xs[i], ys[i], 2);
    const j = nb[1] ?? nb[0];
    d.push(Math.hypot(xs[j] - xs[i], ys[j] - ys[i]));
  }
  d.sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)];
}

export interface BlowOptions {
  capMm: number;
  amount: number; // share of the dots, titlepage clips at 0.08
  angleDeg: number; // the direction they travel, 0 right, 90 up
  distance: number; // max drift in caps (titlepage max_drift)
  seed: number;
  pitchGuess: number;
}

/** Returns the dots (moved in place, `t` the size factor) and a flag per dot: 1 blown. */
export function blow(dots: Dot[], o: BlowOptions): { dots: Dot[]; kind: Uint8Array } {
  const share = Math.min(0.3, Math.max(0, o.amount));
  const n = dots.length;
  const kind = new Uint8Array(n);
  if (!n || share <= 0) return { dots, kind };
  const a = (o.angleDeg * Math.PI) / 180;
  const w: [number, number] = [Math.cos(a), -Math.sin(a)];
  const nrm: [number, number] = [-w[1], w[0]];
  const xs = new Float64Array(n), ys = new Float64Array(n);
  for (let i = 0; i < n; i++) { xs[i] = dots[i].x; ys[i] = dots[i].y; }
  const pitch = medianNN(xs, ys, o.pitchGuess);
  const grid = new PointGrid(xs, ys, Math.max(1e-3, pitch * 2));
  const rng = new Rng(o.seed + 4049);
  const want = Math.round(share * n);
  let cand: number[] = [];
  const tmp: number[] = [];
  for (let i = 0; i < n; i++) {
    if (dots[i].t <= 0) continue;
    const c = grid.within(xs[i] + w[0] * 2.5 * pitch, ys[i] + w[1] * 2.5 * pitch, 2.0 * pitch, tmp).length;
    if (c < 2) cand.push(i);
  }
  if (!cand.length) return { dots, kind };
  const out = dots.map((d) => ({ ...d }));
  let moved = 0;
  const maxD = o.capMm * o.distance;
  let guard = 0;
  while (moved < want && guard++ < 1e6) {
    const s = cand[Math.floor(rng.random() * cand.length)];
    const k = rng.integers(2, 9);
    const nb = grid.nearest(xs[s], ys[s], Math.min(k * 3, n)).filter((i) => !kind[i]).slice(0, k);
    const base = maxD * Math.pow(rng.uniform(0, 1), 1.8);
    for (const i of nb) {
      const d = base * rng.uniform(0.6, 1.25);
      const lat = rng.normal(0, 0.08) * o.capMm;
      const q = d / Math.max(maxD, 1e-9);
      out[i].x = xs[i] + w[0] * d + nrm[0] * lat * q;
      out[i].y = ys[i] + w[1] * d + nrm[1] * lat * q;
      out[i].t *= rng.uniform(0.7, 0.95);
      kind[i] = 1;
      moved++;
    }
    if (!nb.length) {
      cand = cand.filter((c) => c !== s);
      if (!cand.length) break;
    }
  }
  return { dots: out, kind };
}

/**
 * Pen-aware spacing: no two dot centres closer than `minMm` (the plotter
 * joins path ends nearer than its min_gap, and two nib marks closer than the
 * pen merge). Larger dots win; the rest are dropped.
 */
export function thin<T extends { x: number; y: number }>(dots: T[], sizes: Float64Array, minMm: number): number[] {
  const n = dots.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => sizes[b] - sizes[a]);
  if (minMm <= 0) return order.sort((a, b) => a - b);
  const cell = minMm;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of dots) { x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y); }
  const gw = Math.ceil((x1 - x0) / cell) + 3, gh = Math.ceil((y1 - y0) / cell) + 3;
  const buckets = new Map<number, number[]>();
  const keep: number[] = [];
  for (const i of order) {
    const cx = Math.floor((dots[i].x - x0) / cell) + 1, cy = Math.floor((dots[i].y - y0) / cell) + 1;
    let ok = true;
    for (let yy = cy - 1; yy <= cy + 1 && ok; yy++) for (let xx = cx - 1; xx <= cx + 1 && ok; xx++) {
      const b = buckets.get(yy * gw + xx);
      if (!b) continue;
      for (const j of b) if ((dots[j].x - dots[i].x) ** 2 + (dots[j].y - dots[i].y) ** 2 < minMm * minMm) { ok = false; break; }
    }
    if (!ok) continue;
    const key = cy * gw + cx;
    const b = buckets.get(key);
    if (b) b.push(i); else buckets.set(key, [i]);
    keep.push(i);
  }
  void gh;
  return keep.sort((a, b) => a - b);
}
