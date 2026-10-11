// The graph's wire format: Cascade `geometry`, in millimetres.
//
// Cascade geometry is +Y up (the flip into SVG's frame lives in the SVG
// writers), while the generator works y-down like the page. So every point
// crosses this boundary with its y negated: exact in float64, so the maths on
// either side is untouched and parity holds. Attributes are float64 unless
// they are flags or labels.

import { createGeometry, type Attribute, type DetailSet, type DetailValue, type Geometry } from 'cascade/contracts';
import type { Polygon, Pt } from './grid';
import type { Dot } from './stipple';

const f64 = (data: Float64Array): Attribute => ({ storage: 'f64', size: 1, data });

/** Closed polygons (y-down mm) as closed poly primitives. */
export function polygonsToGeometry(polys: Polygon[], detail: DetailSet = {}): Geometry {
  let n = 0;
  for (const p of polys) n += p.length;
  const P = new Float64Array(n * 2);
  const vertexPoints = new Int32Array(n);
  const offsets = new Int32Array(polys.length + 1);
  let k = 0;
  polys.forEach((poly, i) => {
    for (const [x, y] of poly) {
      P[2 * k] = x;
      P[2 * k + 1] = -y;
      vertexPoints[k] = k;
      k++;
    }
    offsets[i + 1] = k;
  });
  return createGeometry({
    pointCount: n,
    point: { P: { storage: 'f64', size: 2, data: P } },
    detail,
    topology: { vertexPoints, offsets, kinds: new Uint8Array(polys.length), closed: new Uint8Array(polys.length).fill(1) }
  });
}

/** The closed primitives back as y-down polygons. */
export function geometryToPolygons(g: Geometry | null | undefined): Polygon[] {
  if (!g) return [];
  const P = g.point.P.data;
  const { offsets, vertexPoints } = g.topology;
  const out: Polygon[] = [];
  for (let i = 0; i + 1 < offsets.length; i++) {
    const poly: Pt[] = [];
    for (let v = offsets[i]; v < offsets[i + 1]; v++) {
      const p = vertexPoints[v];
      poly.push([P[2 * p], -P[2 * p + 1]]);
    }
    out.push(poly);
  }
  return out;
}

export type PointAttrs = Record<string, Attribute>;

/** Dots (y-down mm) as a point cloud; `t` becomes a point attribute, plus any extras. */
export function dotsToGeometry(dots: Dot[], extra: PointAttrs = {}, detail: DetailSet = {}, tName = 't'): Geometry {
  const n = dots.length;
  const P = new Float64Array(n * 2);
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    P[2 * i] = dots[i].x;
    P[2 * i + 1] = -dots[i].y;
    t[i] = dots[i].t;
  }
  return createGeometry({ pointCount: n, point: { P: { storage: 'f64', size: 2, data: P }, [tName]: f64(t), ...extra }, detail });
}

/** A point cloud back as y-down dots, `t` read from the named attribute (0 when absent). */
export function geometryToDots(g: Geometry | null | undefined, tName = 't'): Dot[] {
  if (!g) return [];
  const P = g.point.P.data;
  const t = g.point[tName]?.data as ArrayLike<number> | undefined;
  const out: Dot[] = new Array(g.pointCount);
  for (let i = 0; i < g.pointCount; i++) out[i] = { x: P[2 * i], y: -P[2 * i + 1], t: t ? t[i] : 0 };
  return out;
}

/** A numeric point attribute as a plain array view, or null. */
export function pointAttr(g: Geometry | null | undefined, name: string): ArrayLike<number> | null {
  const a = g?.point[name];
  return a && a.storage !== 'string' ? (a.data as ArrayLike<number>) : null;
}

export function detailOf(g: Geometry | null | undefined): Record<string, DetailValue> {
  return { ...(g?.detail ?? {}) };
}

export function detailString(g: Geometry | null | undefined, key: string, fallback = ''): string {
  const v = g?.detail[key];
  return typeof v === 'string' ? v : fallback;
}

export function detailNumber(g: Geometry | null | undefined, key: string, fallback = 0): number {
  const v = g?.detail[key];
  return typeof v === 'number' ? v : fallback;
}

export const attr = {
  f64,
  i32: (data: Int32Array): Attribute => ({ storage: 'i32', size: 1, data }),
  u8: (data: Uint8Array): Attribute => ({ storage: 'u8', size: 1, data })
};
