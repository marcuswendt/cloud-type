// The two sources of a mask: a set headline's outline, or an image. Both are
// generate.ts's textMask / imageMask from the standalone, unchanged apart from
// taking their inputs as arguments. A mask is the `cloudtype.mask` wire type.

import { bounds } from './layout';
import { fillPolygons, type Mask, type Polygon } from './grid';

export interface SourceMask extends Mask {
  /** Raster resolution, px per mm. */
  pxPerMm: number;
  /** Where pixel (0, 0)'s corner sits, in mm (y down). */
  originMm: [number, number];
  /** What the mask is of (the headline, or the image's name): carried to the SVG title. */
  title: string;
  /** Font or source note, carried to the plot SVG's description. */
  description: string;
}

export function emptyMask(pxPerMm: number, title = '', description = ''): SourceMask {
  return { w: 1, h: 1, inside: new Uint8Array(1), pxPerMm, originMm: [0, 0], title, description };
}

/** titletype's glyph mask: the polygons filled at R px/mm with a 1 mm margin. */
export function outlineMask(polygons: Polygon[], R: number, title: string, description: string): SourceMask {
  if (!polygons.length) return emptyMask(R, title, description);
  const [x0, y0, x1, y1] = bounds(polygons);
  const m = 1.0;
  const ox = Math.floor((x0 - m) * R), oy = Math.floor((y0 - m) * R);
  const w = Math.ceil((x1 + m) * R) - ox, h = Math.ceil((y1 + m) * R) - oy;
  const polys: Polygon[] = polygons.map((p) => p.map(([x, y]) => [x * R - ox, y * R - oy]));
  return { w, h, inside: fillPolygons(polys, w, h), pxPerMm: R, originMm: [ox / R, oy / R], title, description };
}

export interface ImageInput {
  w: number;
  h: number;
  /** Darkness 0..1 per pixel (1 = black). */
  dark: Float32Array;
}

export interface ImageMaskOptions {
  mode: 'threshold' | 'luminance';
  threshold: number;
  invert: boolean;
  heightMm: number;
  floor: number;
}

export function imageMask(img: ImageInput, o: ImageMaskOptions, R: number, title: string): SourceMask {
  const hMm = o.heightMm;
  const wMm = (hMm * img.w) / img.h;
  const m = 1.0;
  const w = Math.ceil((wMm + 2 * m) * R), h = Math.ceil((hMm + 2 * m) * R);
  const inside = new Uint8Array(w * h);
  const lum = o.mode === 'luminance';
  const density = lum ? new Float32Array(w * h) : undefined;
  const thr = o.threshold;
  for (let y = 0; y < h; y++) {
    const v = ((y + 0.5) / R - m) / hMm * img.h - 0.5;
    if (v < -0.5 || v > img.h - 0.5) continue;
    const y0 = Math.max(0, Math.min(img.h - 1, Math.floor(v))), y1 = Math.min(img.h - 1, y0 + 1), fy = Math.min(1, Math.max(0, v - y0));
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / R - m) / wMm * img.w - 0.5;
      if (u < -0.5 || u > img.w - 0.5) continue;
      const x0 = Math.max(0, Math.min(img.w - 1, Math.floor(u))), x1 = Math.min(img.w - 1, x0 + 1), fx = Math.min(1, Math.max(0, u - x0));
      const a = img.dark[y0 * img.w + x0], b = img.dark[y0 * img.w + x1], c = img.dark[y1 * img.w + x0], d = img.dark[y1 * img.w + x1];
      let k = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      if (o.invert) k = 1 - k;
      const i = y * w + x;
      inside[i] = k >= thr ? 1 : 0;
      if (density) density[i] = Math.min(1, o.floor + (1 - o.floor) * Math.min(1, Math.max(0, (k - thr) / Math.max(1e-3, 1 - thr))));
    }
  }
  return { w, h, inside, density, pxPerMm: R, originMm: [-m, -m], title, description: `Image: ${title}.` };
}
