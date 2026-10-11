// titletype.stipple, the solid fill: one row of dots along every contour,
// inset a dot radius so the disc's rim meets the letter's edge, and the
// interior Lloyd-relaxed against that fixed row (near-hexagonal, the
// drawing's own dot order). With an image's density the interior count and
// the relaxation are weighted by it, as titletype weights by its tone field.

import { distanceTransform, isoContours, type Mask, type Pt } from './grid';
import { Rng } from './rng';

export interface Dot {
  x: number;
  y: number;
  t: number; // tone (titletype) and later the size factor
}

function resampleClosed(c: Pt[], spacing: number, sigma: number): Pt[] {
  // First to ~1 px vertex spacing so `sigma` (in vertices, as on cv2's pixel chain) means the same.
  const n0 = c.length;
  if (n0 < 4) return c;
  let seg = new Float64Array(n0);
  let total = 0;
  for (let i = 0; i < n0; i++) {
    const a = c[i], b = c[(i + 1) % n0];
    seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1]);
    total += seg[i];
  }
  const sample = (pts: Pt[], segs: Float64Array, len: number, count: number): Pt[] => {
    const out: Pt[] = [];
    let i = 0;
    let acc = 0;
    for (let k = 0; k < count; k++) {
      const t = (k * len) / count;
      while (i < pts.length - 1 && acc + segs[i] < t) {
        acc += segs[i];
        i++;
      }
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const f = segs[i] > 0 ? (t - acc) / segs[i] : 0;
      out.push([a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]);
    }
    return out;
  };
  let pts = sample(c, seg, total, Math.max(4, Math.round(total)));
  const n = pts.length;
  if (sigma > 0.3) {
    const r = Math.floor(3 * sigma) + 1;
    const k: number[] = [];
    let ks = 0;
    for (let j = -r; j <= r; j++) {
      const v = Math.exp(-0.5 * (j / sigma) ** 2);
      k.push(v);
      ks += v;
    }
    const sm: Pt[] = [];
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0;
      for (let j = -r; j <= r; j++) {
        const p = pts[(((i + j) % n) + n) % n];
        sx += p[0] * k[j + r];
        sy += p[1] * k[j + r];
      }
      sm.push([sx / ks, sy / ks]);
    }
    pts = sm;
  }
  seg = new Float64Array(n);
  total = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1]);
    total += seg[i];
  }
  if (total < spacing * 1.5) {
    let mx = 0, my = 0;
    for (const p of pts) { mx += p[0]; my += p[1]; }
    return [[mx / n, my / n]];
  }
  const count = Math.max(3, Math.round(total / spacing));
  return sample(pts, seg, total, count);
}

/** Lloyd relaxation of `moving` (flat x,y) with `fixed` generators held still. */
function lloyd(
  fixed: Float64Array,
  moving: Float64Array,
  pix: Int32Array, // flat pixel indices (inside)
  w: number,
  weight: Float32Array | null,
  iterations: number,
  cell: number,
  allowed: (x: number, y: number) => boolean
): Float64Array {
  const nf = fixed.length / 2;
  const nm = moving.length / 2;
  if (!nm) return moving;
  const pts = Float64Array.from(moving);
  const gw = Math.ceil(w / cell) + 1;
  let maxY = 0;
  for (let i = 0; i < pix.length; i++) maxY = Math.max(maxY, Math.floor(pix[i] / w));
  const gh = Math.ceil((maxY + 1) / cell) + 1;
  // Pixels grouped by grid cell.
  const pc = new Int32Array(pix.length);
  for (let i = 0; i < pix.length; i++) {
    const p = pix[i];
    const x = p % w;
    const y = (p - x) / w;
    pc[i] = Math.floor(y / cell) * gw + Math.floor(x / cell);
  }
  // Counting sort by cell.
  const counts = new Int32Array(gw * gh + 1);
  for (let i = 0; i < pix.length; i++) counts[pc[i] + 1]++;
  for (let c = 1; c <= gw * gh; c++) counts[c] += counts[c - 1];
  const porder = new Int32Array(pix.length);
  for (let i = 0; i < pix.length; i++) porder[counts[pc[i]]++] = i;
  const ng = nf + nm;
  const gx = new Float64Array(ng);
  const gy = new Float64Array(ng);
  for (let i = 0; i < nf; i++) { gx[i] = fixed[2 * i]; gy[i] = fixed[2 * i + 1]; }
  const sw = new Float64Array(ng), sx = new Float64Array(ng), sy = new Float64Array(ng);
  const head = new Int32Array(gw * gh);
  const next = new Int32Array(ng);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < nm; i++) { gx[nf + i] = pts[2 * i]; gy[nf + i] = pts[2 * i + 1]; }
    head.fill(-1);
    for (let g = 0; g < ng; g++) {
      const cx = Math.min(gw - 1, Math.max(0, Math.floor(gx[g] / cell)));
      const cy = Math.min(gh - 1, Math.max(0, Math.floor(gy[g] / cell)));
      const c = cy * gw + cx;
      next[g] = head[c];
      head[c] = g;
    }
    sw.fill(0); sx.fill(0); sy.fill(0);
    let k = 0;
    const cand = new Int32Array(4096);
    let nc = 0;
    while (k < porder.length) {
      const c = pc[porder[k]];
      const ccx = c % gw;
      const ccy = (c - ccx) / gw;
      nc = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = ccy + dy;
        if (yy < 0 || yy >= gh) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = ccx + dx;
          if (xx < 0 || xx >= gw) continue;
          for (let g = head[yy * gw + xx]; g >= 0 && nc < 4096; g = next[g]) cand[nc++] = g;
        }
      }
      for (; k < porder.length && pc[porder[k]] === c; k++) {
        const i = porder[k];
        const p = pix[i];
        const x = p % w;
        const y = (p - x) / w;
        let best = -1;
        let bd = Infinity;
        for (let ci = 0; ci < nc; ci++) {
          const g = cand[ci];
          const dxg = gx[g] - x, dyg = gy[g] - y;
          const d = dxg * dxg + dyg * dyg;
          if (d < bd) { bd = d; best = g; }
        }
        if (bd > cell * cell) {
          // Sparse here: widen the search ring by ring.
          for (let r = 2; r < Math.max(gw, gh); r++) {
            for (let yy = ccy - r; yy <= ccy + r; yy++) {
              if (yy < 0 || yy >= gh) continue;
              for (let xx = ccx - r; xx <= ccx + r; xx++) {
                if (xx < 0 || xx >= gw) continue;
                if (Math.abs(yy - ccy) !== r && Math.abs(xx - ccx) !== r) continue;
                for (let g = head[yy * gw + xx]; g >= 0; g = next[g]) {
                  const d = (gx[g] - x) ** 2 + (gy[g] - y) ** 2;
                  if (d < bd) { bd = d; best = g; }
                }
              }
            }
            if (best >= 0 && Math.sqrt(bd) <= (r - 1) * cell) break;
          }
        }
        if (best < nf) continue;
        const wv = weight ? weight[p] : 1;
        sw[best] += wv;
        sx[best] += wv * x;
        sy[best] += wv * y;
      }
    }
    for (let i = 0; i < nm; i++) {
      const g = nf + i;
      if (sw[g] <= 1e-6) continue;
      const nx = sx[g] / sw[g];
      const ny = sy[g] / sw[g];
      if (allowed(nx, ny)) { pts[2 * i] = nx; pts[2 * i + 1] = ny; }
    }
  }
  return pts;
}

export interface StippleOptions {
  pxPerMm: number;
  originMm: [number, number];
  pitchMm: number;
  order: number;
  seed: number;
  /** Multiplies the Lloyd iteration count (preview speed). */
  iterScale?: number;
}

export function stipple(mask: Mask, o: StippleOptions): Dot[] {
  const { w, h, inside } = mask;
  const R = o.pxPerMm;
  const p = o.pitchMm * R;
  const rng = new Rng(o.seed);
  let any = false;
  for (let i = 0; i < inside.length; i++) if (inside[i]) { any = true; break; }
  if (!any) return [];
  const dt = distanceTransform(inside, w, h);
  const inset = 0.32 * p;
  const dens = mask.density;
  const densAt = (x: number, y: number) => {
    if (!dens) return 1;
    const ix = Math.min(w - 1, Math.max(0, Math.floor(x)));
    const iy = Math.min(h - 1, Math.max(0, Math.floor(y)));
    return dens[iy * w + ix];
  };

  // 1. The contour pass: one row along every edge (cv2's boundary pixels of
  // dt >= inset sit about half a pixel inside the level, hence + 0.5).
  const loops = isoContours(dt, w, h, inset + 0.5);
  const edge: number[] = [];
  for (const c of loops) {
    let local = 0;
    for (const q of c) local += densAt(q[0], q[1]);
    local /= c.length;
    for (const q of resampleClosed(c, (0.9 * p) / Math.sqrt(Math.max(local, 0.3)), 0.12 * p)) edge.push(q[0], q[1]);
  }
  const edgeF = Float64Array.from(edge);

  // 2. The interior, relaxed against that row.
  const coreLim = inset + 0.7 * p;
  const coreIdx: number[] = [];
  const coreW: number[] = [];
  let wsum = 0;
  const pixList: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!inside[i]) continue;
    pixList.push(i);
    if (dt[i] >= coreLim) {
      const d = dens ? dens[i] : 1;
      coreIdx.push(i);
      coreW.push(d);
      wsum += d;
    }
  }
  const nInt = Math.round(wsum / (0.866 * p * p));
  let interior: Float64Array = new Float64Array(0);
  if (nInt > 0 && coreIdx.length) {
    const pick = rng.choiceWeighted(coreW, nInt);
    const seeds = new Float64Array(nInt * 2);
    for (let k = 0; k < nInt; k++) {
      const q = coreIdx[pick[k]];
      const x = q % w;
      seeds[2 * k] = x + rng.random() - 0.5;
      seeds[2 * k + 1] = (q - x) / w + rng.random() - 0.5;
    }
    const lim = inset + 0.45 * p;
    const allowed = (x: number, y: number) => {
      const qx = Math.min(w - 1, Math.max(0, Math.round(x)));
      const qy = Math.min(h - 1, Math.max(0, Math.round(y)));
      return dt[qy * w + qx] >= lim;
    };
    const iters = Math.round(18 * o.order * (o.iterScale ?? 1));
    interior = lloyd(edgeF, seeds, Int32Array.from(pixList), w, dens ?? null, iters, Math.max(2, p), allowed);
  }
  const [ox, oy] = o.originMm;
  const out: Dot[] = [];
  for (let i = 0; i < edgeF.length / 2; i++) out.push({ x: ox + edgeF[2 * i] / R, y: oy + edgeF[2 * i + 1] / R, t: 1 });
  for (let i = 0; i < interior.length / 2; i++) {
    const x = interior[2 * i], y = interior[2 * i + 1];
    out.push({ x: ox + x / R, y: oy + y / R, t: densAt(x, y) });
  }
  return out;
}
