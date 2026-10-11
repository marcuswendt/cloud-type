// typeexpr.express: each headline crafted, not one uniform effect. A stage
// between the stipple and the focus that works on the dots alone (x, y in mm,
// y down; t the tone) plus the letter each dot sits on (`comp`). Ported line
// for line from cloud-plots src/cloud_plots/typeexpr.py: every random draw is
// a 32-bit integer hash of (seed, salt, index), not a generator, so the same
// input dots give the same output dots in both languages. Every parameter's
// default is the identity.
//
// Operations, in order:
//   regularity  grid 0..1 pulls each dot onto a hexagonal lattice at the pitch
//               (past 0.5 a lattice node keeps one dot); jitter 0..1 scatters
//               by up to 0.35 pitch.
//   size        sizeVar 0..1 a per-dot size spread (lognormal on tone).
//   weight      weight 0..1 raises the tone of the letters' cores; stack 0..1
//               doubles a share of the core dots 0.3 pitch apart.
//   dissolve    erode 0..1 the share that goes, by erodeMode (edge, strokes,
//               within, rim); release 0..1 of the eroded dots are carried off
//               along the erode direction (up to releaseDist caps).
//   letters     letterVar 0..1 each letter its own rotation, tone and nudge;
//               stagger caps: each letter shifted along staggerAngle.
//   motion      smear 0..1 adds a trail of smear x 0.6 x n dots behind the
//               letters, opposite smearAngle, up to smearLen caps.
// Angles are page degrees, 0 right, 90 up.

import type { Dot } from './stipple';
import { PointGrid } from './blow';

export type ErodeMode = 'edge' | 'strokes' | 'within' | 'rim';

export interface ExpressParams {
  grid: number;
  jitter: number;
  sizeVar: number;
  weight: number;
  stack: number;
  erode: number;
  erodeMode: ErodeMode | string;
  erodeAngle: number;
  erodeScale: number;
  release: number;
  releaseDist: number;
  letterVar: number;
  stagger: number;
  staggerAngle: number;
  smear: number;
  smearAngle: number;
  smearLen: number;
}

export const EXPRESS_DEFAULTS: ExpressParams = {
  grid: 0, jitter: 0, sizeVar: 0, weight: 0, stack: 0,
  erode: 0, erodeMode: 'edge', erodeAngle: 0, erodeScale: 0.5, release: 0, releaseDist: 0.6,
  letterVar: 0, stagger: 0, staggerAngle: 90,
  smear: 0, smearAngle: 0, smearLen: 0.8
};

const MODES = ['edge', 'strokes', 'within', 'rim'];
const DEG = Math.PI / 180; // np.radians multiplies by this constant

// ── portable hash randoms (identical to typeexpr.py) ────────────────────

export function h32(a: number): number {
  a = a >>> 0;
  a = (a ^ (a >>> 16)) >>> 0;
  a = Math.imul(a, 0x7feb352d) >>> 0;
  a = (a ^ (a >>> 15)) >>> 0;
  a = Math.imul(a, 0x846ca68b) >>> 0;
  a = (a ^ (a >>> 16)) >>> 0;
  return a;
}

export function key(seed: number, salt: number): number {
  return h32((Math.imul(Math.trunc(seed) | 0, 0x9e3779b1) + Math.imul(Math.trunc(salt) | 0, 0x85ebca77)) >>> 0);
}

/** Uniform [0, 1) for stream `k` (from `key`) at integer index `i`. */
export function uni(k: number, i: number): number {
  return h32((h32((i | 0) >>> 0) ^ k) >>> 0) / 4294967296.0;
}

export function gauss(k: number, i: number): number {
  const u1 = uni(k, 2 * i);
  const u2 = uni(k, 2 * i + 1);
  return Math.sqrt(-2.0 * Math.log(1.0 - u1)) * Math.cos(2.0 * Math.PI * u2);
}

/** Smooth value noise 0..1 on the unit lattice. */
export function vnoise(k: number, x: number, y: number): number {
  const fx0 = Math.floor(x), fy0 = Math.floor(y);
  const fx = x - fx0, fy = y - fy0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const ix = fx0 | 0, iy = fy0 | 0;
  const lat = (a: number, b: number) => uni(k, ((((a | 0) >>> 0) ^ h32((b | 0) >>> 0)) >>> 0) | 0);
  const n00 = lat(ix, iy), n10 = lat(ix + 1, iy), n01 = lat(ix, iy + 1), n11 = lat(ix + 1, iy + 1);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

/** A page angle (0 right, 90 up) as a y-down unit vector. */
export function pageDir(deg: number): [number, number] {
  const a = deg * DEG;
  return [Math.cos(a), -Math.sin(a)];
}

/** Round half to even, as numpy's np.round and Python's round(). */
export function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

// ── neighbourhood ────────────────────────────────────────────────────────

export function neighbourCounts(xs: Float64Array, ys: Float64Array, r: number): Float64Array {
  const n = xs.length;
  const out = new Float64Array(n);
  if (n < 2) return out;
  const g = new PointGrid(xs, ys, Math.max(1e-6, r));
  const tmp: number[] = [];
  for (let i = 0; i < n; i++) out[i] = g.within(xs[i], ys[i], r, tmp).length - 1.0;
  return out;
}

/** 0 on the rim .. 1 deep inside a stroke, from neighbour counts. */
export function coreOf(xs: Float64Array, ys: Float64Array, pitch: number): Float64Array {
  const nc = neighbourCounts(xs, ys, 1.6 * pitch);
  for (let i = 0; i < nc.length; i++) nc[i] = Math.min(1, Math.max(0, (nc[i] - 3.0) / 3.0));
  return nc;
}

// ── the stage ────────────────────────────────────────────────────────────

export function isIdentity(p: Partial<ExpressParams> | null | undefined): boolean {
  if (!p) return true;
  return (['grid', 'jitter', 'sizeVar', 'weight', 'stack', 'erode', 'letterVar', 'stagger', 'smear'] as const).every(
    (k) => Number(p[k] ?? 0) === 0
  );
}

export interface ExpressOptions {
  capMm: number;
  pitchMm: number;
  seed: number;
}

/** (dots, comp) -> (dots, comp). `comp` the letter id per dot (0 none). */
export function express(
  dots: Dot[],
  compIn: ArrayLike<number>,
  o: ExpressOptions,
  params: Partial<ExpressParams> = {}
): { dots: Dot[]; comp: Int32Array } {
  const p: ExpressParams = { ...EXPRESS_DEFAULTS };
  for (const [k, v] of Object.entries(params)) {
    if (k in EXPRESS_DEFAULTS && v !== undefined && v !== null) (p as unknown as Record<string, unknown>)[k] = v;
  }
  if (!dots.length || isIdentity(p)) return { dots: dots.map((d) => ({ ...d })), comp: Int32Array.from(compIn) };
  let n = dots.length;
  let xs = new Float64Array(n), ys = new Float64Array(n), t = new Float64Array(n);
  let comp = Int32Array.from(compIn);
  for (let i = 0; i < n; i++) { xs[i] = dots[i].x; ys[i] = dots[i].y; t[i] = dots[i].t; }
  let idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  const pitch = Number(o.pitchMm);
  const cap = Number(o.capMm);
  const S = Math.trunc(Number(o.seed));

  // regularity
  if (p.grid > 0) {
    const hx = pitch, hy = (pitch * Math.sqrt(3)) / 2;
    const row = new Float64Array(n), col = new Float64Array(n);
    const g = Number(p.grid);
    for (let i = 0; i < n; i++) {
      row[i] = roundHalfEven(ys[i] / hy);
      const off = (row[i] & 1) * 0.5;
      col[i] = roundHalfEven(xs[i] / hx - off);
      const lx = (col[i] + off) * hx, ly = row[i] * hy;
      xs[i] = xs[i] + g * (lx - xs[i]);
      ys[i] = ys[i] + g * (ly - ys[i]);
    }
    if (g > 0.5) {
      const seen = new Set<string>();
      const keep: number[] = [];
      for (let i = 0; i < n; i++) {
        const c = `${row[i]},${col[i]}`;
        if (!seen.has(c)) { seen.add(c); keep.push(i); }
      }
      xs = Float64Array.from(keep, (i) => xs[i]);
      ys = Float64Array.from(keep, (i) => ys[i]);
      t = Float64Array.from(keep, (i) => t[i]);
      comp = Int32Array.from(keep, (i) => comp[i]);
      n = xs.length;
      idx = new Int32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
    }
  }
  if (p.jitter > 0) {
    const k = key(S, 11);
    const s = 0.35 * pitch * p.jitter;
    for (let i = 0; i < n; i++) {
      xs[i] = xs[i] + s * gauss(k, idx[i]);
      ys[i] = ys[i] + s * gauss(k, idx[i] + n);
    }
  }

  let core: Float64Array | null =
    p.weight > 0 || p.stack > 0 || (p.erode > 0 && (p.erodeMode === 'within' || p.erodeMode === 'rim')) ? coreOf(xs, ys, pitch) : null;

  // size and weight
  if (p.sizeVar > 0) {
    const k = key(S, 13);
    for (let i = 0; i < n; i++) t[i] = t[i] * Math.exp(0.45 * p.sizeVar * gauss(k, idx[i]));
  }
  if (p.weight > 0) {
    for (let i = 0; i < n; i++) t[i] = t[i] + 0.6 * p.weight * core![i];
  }
  const ex: number[] = [], ey: number[] = [], et: number[] = [], ec: number[] = [];
  if (p.stack > 0) {
    const k = key(S, 17);
    const ox = new Float64Array(n), oy = new Float64Array(n);
    const sel = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      sel[i] = uni(k, idx[i]) < p.stack * core![i] && t[i] > 0 ? 1 : 0;
      const ang = 2 * Math.PI * uni(k, idx[i] + n);
      ox[i] = 0.3 * pitch * Math.cos(ang);
      oy[i] = 0.3 * pitch * Math.sin(ang);
    }
    for (let i = 0; i < n; i++) if (sel[i]) { ex.push(xs[i] + ox[i]); ey.push(ys[i] + oy[i]); et.push(t[i] * 0.85); ec.push(comp[i]); }
  }

  // dissolve
  if (p.erode > 0) {
    const mode = MODES.includes(p.erodeMode) ? p.erodeMode : 'edge';
    const d = pageDir(p.erodeAngle);
    const sc = Math.max(0.05, Number(p.erodeScale)) * cap;
    const kz = key(S, 19);
    const nz = new Float64Array(n), proj = new Float64Array(n), r = new Float64Array(n);
    let pmin = Infinity, pmax = -Infinity;
    for (let i = 0; i < n; i++) {
      nz[i] = vnoise(kz, xs[i] / sc, ys[i] / sc);
      proj[i] = xs[i] * d[0] + ys[i] * d[1];
      pmin = Math.min(pmin, proj[i]);
      pmax = Math.max(pmax, proj[i]);
    }
    if (mode === 'edge') {
      const span = Math.max(1e-9, pmax - pmin);
      for (let i = 0; i < n; i++) r[i] = 0.7 * ((proj[i] - pmin) / span) + 0.3 * nz[i];
    } else if (mode === 'strokes') {
      const lo = new Map<number, number>(), hi = new Map<number, number>();
      for (let i = 0; i < n; i++) {
        const c = comp[i];
        lo.set(c, Math.min(lo.get(c) ?? Infinity, proj[i]));
        hi.set(c, Math.max(hi.get(c) ?? -Infinity, proj[i]));
      }
      for (let i = 0; i < n; i++) {
        const a = lo.get(comp[i])!, b = hi.get(comp[i])!;
        r[i] = 0.7 * ((proj[i] - a) / Math.max(1e-9, b - a)) + 0.3 * nz[i];
      }
    } else if (mode === 'within') {
      for (let i = 0; i < n; i++) r[i] = 0.35 * core![i] + 0.65 * nz[i];
    } else {
      for (let i = 0; i < n; i++) r[i] = 0.7 * (1.0 - core![i]) + 0.3 * nz[i];
    }
    const thr = 1.0 - 1.05 * p.erode;
    const gone = new Uint8Array(n);
    let any = false;
    for (let i = 0; i < n; i++) if (r[i] > thr) { gone[i] = 1; any = true; }
    if (p.release > 0 && any) {
      const k = key(S, 23);
      const nrm: [number, number] = [-d[1], d[0]];
      for (let i = 0; i < n; i++) {
        if (!gone[i] || !(uni(k, idx[i]) < p.release)) continue;
        const u = uni(k, idx[i] + n);
        const dist = cap * p.releaseDist * u ** 1.6;
        const lat = 0.12 * cap * gauss(k, idx[i] + 2 * n) * (0.3 + u);
        ex.push(xs[i] + dist * d[0] + lat * nrm[0]);
        ey.push(ys[i] + dist * d[1] + lat * nrm[1]);
        et.push(t[i] * (0.9 - 0.4 * u));
        ec.push(0);
      }
    }
    const keep: number[] = [];
    for (let i = 0; i < n; i++) if (!gone[i]) keep.push(i);
    xs = Float64Array.from(keep, (i) => xs[i]);
    ys = Float64Array.from(keep, (i) => ys[i]);
    t = Float64Array.from(keep, (i) => t[i]);
    comp = Int32Array.from(keep, (i) => comp[i]);
    if (core) { const c0 = core; core = Float64Array.from(keep, (i) => c0[i]); }
    idx = Int32Array.from(keep, (i) => idx[i]);
  }

  // letters
  const len = xs.length;
  if (p.letterVar > 0 || p.stagger > 0) {
    const kl = key(S, 29);
    const sd = pageDir(p.staggerAngle);
    const comps = [...new Set(comp)].sort((a, b) => a - b);
    for (const c of comps) {
      if (c <= 0) continue;
      const m: number[] = [];
      for (let i = 0; i < len; i++) if (comp[i] === c) m.push(i);
      let sx = 0, sy = 0;
      for (const i of m) { sx += xs[i]; sy += ys[i]; }
      const cx = sx / m.length, cy = sy / m.length;
      const uc = [uni(kl, 4 * c), uni(kl, 4 * c + 1), uni(kl, 4 * c + 2), uni(kl, 4 * c + 3)];
      if (p.letterVar > 0) {
        const a = 5.0 * p.letterVar * (2 * uc[0] - 1) * DEG;
        const ca = Math.cos(a), sa = Math.sin(a);
        const nx = 0.04 * cap * p.letterVar * (2 * uc[1] - 1);
        const ny = 0.04 * cap * p.letterVar * (2 * uc[2] - 1);
        const tf = 1.0 + 0.3 * p.letterVar * (2 * uc[3] - 1);
        for (const i of m) {
          const qx = xs[i] - cx, qy = ys[i] - cy;
          xs[i] = cx + (ca * qx - sa * qy) + nx;
          ys[i] = cy + (sa * qx + ca * qy) + ny;
          t[i] = t[i] * tf;
        }
      }
      if (p.stagger > 0) {
        const us = uni(kl, 7919 + c);
        const dx = sd[0] * cap * p.stagger * (us - 0.5), dy = sd[1] * cap * p.stagger * (us - 0.5);
        for (const i of m) { xs[i] = xs[i] + dx; ys[i] = ys[i] + dy; }
      }
    }
  }

  // motion
  if (p.smear > 0 && len) {
    const k = key(S, 31);
    const m = roundHalfEven(p.smear * 0.6 * len);
    const d = pageDir(p.smearAngle);
    const nrm: [number, number] = [-d[1], d[0]];
    for (let j = 0; j < m; j++) {
      const src = Math.min(Math.trunc(uni(k, j) * len), len - 1);
      const u = uni(k, j + m);
      const dist = cap * p.smearLen * u ** 1.5;
      const lat = 0.08 * pitch * gauss(k, j + 2 * m);
      ex.push(xs[src] - dist * d[0] + lat * nrm[0]);
      ey.push(ys[src] - dist * d[1] + lat * nrm[1]);
      et.push(t[src] * (1.0 - 0.75 * u));
      ec.push(comp[src]);
    }
  }

  const out: Dot[] = new Array(len + ex.length);
  for (let i = 0; i < len; i++) out[i] = { x: xs[i], y: ys[i], t: t[i] };
  for (let j = 0; j < ex.length; j++) out[len + j] = { x: ex[j], y: ey[j], t: et[j] };
  const compOut = new Int32Array(len + ec.length);
  compOut.set(comp);
  compOut.set(ec, len);
  return { dots: out, comp: compOut };
}

// ── portable blow additions (titlepage.blow / blow.ts) ───────────────────

/**
 * Extra displacement of blown dots: a wavy (curl) lateral path whose amplitude
 * grows along the drift, and gravity bending it up (+) or down (-)
 * quadratically with distance. Zero when both are zero. `w` the unit travel
 * direction (y down), `d` the travel distance per dot, `idx` the dot indices.
 */
export function driftExtra(
  d: ArrayLike<number>,
  maxD: number,
  w: [number, number],
  seed: number,
  idx: ArrayLike<number>,
  o: { turbulence?: number; curl?: number; gravity?: number; capMm?: number }
): Float64Array {
  const turbulence = o.turbulence ?? 0, curl = o.curl ?? 0.6, gravity = o.gravity ?? 0, capMm = o.capMm ?? 13.6;
  const n = d.length;
  const out = new Float64Array(n * 2);
  if (turbulence === 0 && gravity === 0) return out;
  const nrm: [number, number] = [-w[1], w[0]];
  const md = Math.max(maxD, 1e-9);
  const k = key(seed, 37);
  const lam = Math.max(0.05, curl) * capMm;
  for (let i = 0; i < n; i++) {
    const q = d[i] / md;
    if (turbulence) {
      const phase = 2 * Math.PI * uni(k, idx[i]);
      const amp = 0.35 * capMm * turbulence * q;
      const s = amp * Math.sin((2 * Math.PI * d[i]) / lam + phase);
      out[2 * i] += s * nrm[0];
      out[2 * i + 1] += s * nrm[1];
    }
    if (gravity) out[2 * i + 1] += -gravity * 0.8 * capMm * q * q;
  }
  return out;
}
