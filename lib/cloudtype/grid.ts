// Raster helpers the Python original takes from OpenCV: the polygon fill
// behind glyph_mask, the Euclidean distance transform, connected components
// (8-connected, as cv2.connectedComponents) and the contours of a level set.

export interface Mask {
  w: number;
  h: number;
  /** 1 inside, 0 outside. */
  inside: Uint8Array;
  /** Optional tone 0..1 per pixel (an image's darkness); ones when absent. */
  density?: Float32Array;
}

export type Pt = [number, number];
export type Polygon = Pt[];

/** Fill polygons (non-zero winding) sampled at pixel centres. */
export function fillPolygons(polys: Polygon[], w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  // Edge list: (x0, y0, x1, y1, dir) with y0 < y1.
  const edges: number[] = [];
  for (const poly of polys) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = poly[i];
      const [bx, by] = poly[(i + 1) % n];
      if (ay === by) continue;
      if (ay < by) edges.push(ax, ay, bx, by, 1);
      else edges.push(bx, by, ax, ay, -1);
    }
  }
  const ne = edges.length / 5;
  // Bucket edges by the first row whose centre they cross.
  const buckets: number[][] = Array.from({ length: h }, () => []);
  for (let e = 0; e < ne; e++) {
    const y0 = edges[e * 5 + 1];
    const y1 = edges[e * 5 + 3];
    const r0 = Math.max(0, Math.ceil(y0 - 0.5));
    const r1 = Math.min(h - 1, Math.ceil(y1 - 0.5) - 1);
    if (r0 <= r1) buckets[r0].push(e);
  }
  let active: number[] = [];
  const xs: number[] = [];
  const ds: number[] = [];
  for (let row = 0; row < h; row++) {
    const yc = row + 0.5;
    active = active.filter((e) => edges[e * 5 + 3] > yc);
    for (const e of buckets[row]) active.push(e);
    if (!active.length) continue;
    xs.length = 0;
    ds.length = 0;
    const order: number[] = [];
    for (const e of active) {
      const x0 = edges[e * 5], y0 = edges[e * 5 + 1], x1 = edges[e * 5 + 2], y1 = edges[e * 5 + 3];
      const t = (yc - y0) / (y1 - y0);
      xs.push(x0 + t * (x1 - x0));
      ds.push(edges[e * 5 + 4]);
      order.push(order.length);
    }
    order.sort((i, j) => xs[i] - xs[j]);
    let wind = 0;
    for (let k = 0; k < order.length - 1; k++) {
      wind += ds[order[k]];
      if (wind !== 0) {
        const xa = xs[order[k]];
        const xb = xs[order[k + 1]];
        const c0 = Math.max(0, Math.ceil(xa - 0.5));
        const c1 = Math.min(w - 1, Math.ceil(xb - 0.5) - 1);
        const base = row * w;
        for (let c = c0; c <= c1; c++) out[base + c] = 1;
      }
    }
  }
  return out;
}

const INF = 1e20;

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/** Distance of every pixel to the nearest pixel where `src` is 0 (cv2.distanceTransform). */
export function distanceTransform(src: Uint8Array, w: number, h: number): Float32Array {
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const tmp = new Float64Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = src[y * w + x] ? INF : 0;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) tmp[y * w + x] = d[y];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = tmp[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

/** 8-connected components of `src` != 0: labels (0 background) and count incl. background. */
export function connectedComponents(src: Uint8Array, w: number, h: number): { labels: Int32Array; n: number } {
  const labels = new Int32Array(w * h);
  let n = 1;
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!src[i] || labels[i]) continue;
    let sp = 0;
    stack[sp++] = i;
    labels[i] = n;
    while (sp) {
      const p = stack[--sp];
      const px = p % w;
      const py = (p - px) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = py + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = px + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (src[q] && !labels[q]) {
            labels[q] = n;
            stack[sp++] = q;
          }
        }
      }
    }
    n++;
  }
  return { labels, n };
}

/** Closed iso-lines of `field` at `level` (marching squares over pixel indices). */
export function isoContours(field: Float32Array, w: number, h: number, level: number): Polygon[] {
  const pos = new Map<number, Pt>();
  const adj = new Map<number, number[]>();
  const val = (x: number, y: number) => field[y * w + x] - level;
  const hId = (x: number, y: number) => (y * w + x) * 2; // edge (x,y)-(x+1,y)
  const vId = (x: number, y: number) => (y * w + x) * 2 + 1; // edge (x,y)-(x,y+1)
  const point = (id: number): void => {
    if (pos.has(id)) return;
    const cell = id >> 1;
    const x = cell % w;
    const y = (cell - x) / w;
    if (id & 1) {
      const a = val(x, y), b = val(x, y + 1);
      pos.set(id, [x, y + a / (a - b)]);
    } else {
      const a = val(x, y), b = val(x + 1, y);
      pos.set(id, [x + a / (a - b), y]);
    }
  };
  const link = (a: number, b: number) => {
    point(a);
    point(b);
    let la = adj.get(a);
    if (!la) adj.set(a, (la = []));
    la.push(b);
    let lb = adj.get(b);
    if (!lb) adj.set(b, (lb = []));
    lb.push(a);
  };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const v0 = val(x, y), v1 = val(x + 1, y), v2 = val(x + 1, y + 1), v3 = val(x, y + 1);
      const c = (v0 >= 0 ? 1 : 0) | (v1 >= 0 ? 2 : 0) | (v2 >= 0 ? 4 : 0) | (v3 >= 0 ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const top = hId(x, y), right = vId(x + 1, y), bottom = hId(x, y + 1), left = vId(x, y);
      switch (c) {
        case 1: case 14: link(left, top); break;
        case 2: case 13: link(top, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(right, bottom); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(left, bottom); break;
        case 5: case 10: {
          const centre = (v0 + v1 + v2 + v3) / 4 >= 0;
          if ((c === 5) === centre) { link(left, bottom); link(top, right); }
          else { link(left, top); link(right, bottom); }
          break;
        }
      }
    }
  }
  const seen = new Set<number>();
  const loops: Polygon[] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: Pt[] = [];
    let prev = -1;
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      loop.push(pos.get(cur)!);
      const nb = adj.get(cur)!;
      const next = nb[0] !== prev ? nb[0] : nb[1] ?? nb[0];
      prev = cur;
      cur = next;
      if (cur === undefined) break;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
