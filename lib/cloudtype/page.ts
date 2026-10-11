// The placed page as the SVG writers and the raster want it: the standalone's
// Result (x, y, size per dot in page mm, float32) rebuilt from the page geometry.

import type { Geometry } from 'cascade/contracts';
import { detailNumber, pointAttr } from './geo';

export interface PageDots {
  dots: Float32Array;
  count: number;
  pageMm: [number, number];
  penMm: number;
}

export function pageDots(g: Geometry | null | undefined): PageDots {
  if (!g) return { dots: new Float32Array(0), count: 0, pageMm: [10, 10], penMm: 0.1 };
  const P = g.point.P.data;
  const size = pointAttr(g, 'size');
  const n = g.pointCount;
  const dots = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    dots[3 * i] = P[2 * i];
    dots[3 * i + 1] = -P[2 * i + 1];
    dots[3 * i + 2] = size ? size[i] : 0;
  }
  const page = g.detail.pageMm;
  const pageMm: [number, number] = Array.isArray(page) ? [Number(page[0]), Number(page[1])] : [10, 10];
  return { dots, count: n, pageMm, penMm: detailNumber(g, 'penMm', 0.1) };
}
