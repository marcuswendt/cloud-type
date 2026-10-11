// The plot document, after cloud-plots' plotdoc / final_export conventions:
// millimetres, numbered Inkscape layers (NextDraw reads the leading integer),
// every layer fill="none", every mark a pen path. A dot no larger than the
// pen is one pen-down (a two-vertex zero-length path); a larger dot is one
// Archimedean spiral from its centre at 0.8 pen per turn, closed by a full
// circle at the rim (plotdoc.dot_marks), so it plots as a solid disc.

import type { PageDots as Result } from './page';

export const LARGE_MM = 0.35;
const NS =
  'xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"';

const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f3 = (v: number) => v.toFixed(3);

/** plotdoc.dot_marks' spiral for one disc of `size` mm at the pen. */
export function spiral(x: number, y: number, size: number, pen: number): [number, number][] {
  const rim = (size - pen) / 2;
  const pitch = 0.8 * pen;
  const turns = Math.max(rim / pitch, 1e-6);
  const thetaEnd = 2 * Math.PI * turns;
  const step = Math.max(Math.min(pen / Math.max(rim, pen), 0.5), 0.05);
  const pts: [number, number][] = [];
  for (let th = 0; th < thetaEnd; th += step) {
    const r = (rim * th) / thetaEnd;
    pts.push([x + Math.cos(th) * r, y + Math.sin(th) * r]);
  }
  for (let a = 0; a < 2 * Math.PI + step; a += step) {
    const th = a + thetaEnd;
    pts.push([x + Math.cos(th) * rim, y + Math.sin(th) * rim]);
  }
  return pts;
}

function layerOpen(number: number, name: string, pen: number) {
  return `<g inkscape:groupmode="layer" inkscape:label="${number} ${xml(name)}" id="layer${number}" fill="none" stroke="black" stroke-width="${f3(pen)}" stroke-linecap="round" stroke-linejoin="round">`;
}

/** Greedy nearest-neighbour order, so the pen does not cross the page between neighbours. */
function tour(idx: number[], d: Float32Array): number[] {
  if (idx.length < 3) return idx;
  const left = new Set(idx);
  const out: number[] = [];
  // Bucket for speed.
  const cell = 2;
  const grid = new Map<string, number[]>();
  for (const i of idx) {
    const k = `${Math.floor(d[3 * i] / cell)},${Math.floor(d[3 * i + 1] / cell)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
  }
  let cur = idx.reduce((a, b) => (d[3 * a] + d[3 * a + 1] < d[3 * b] + d[3 * b + 1] ? a : b));
  while (left.size) {
    left.delete(cur);
    out.push(cur);
    if (!left.size) break;
    const cx = Math.floor(d[3 * cur] / cell), cy = Math.floor(d[3 * cur + 1] / cell);
    let best = -1, bd = Infinity;
    for (let r = 0; best < 0 || r <= Math.ceil(Math.sqrt(bd) / cell) + 1; r++) {
      for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) {
        if (Math.abs(yy - cy) !== r && Math.abs(xx - cx) !== r) continue;
        const b = grid.get(`${xx},${yy}`);
        if (!b) continue;
        for (const j of b) {
          if (!left.has(j)) continue;
          const dd = (d[3 * j] - d[3 * cur]) ** 2 + (d[3 * j + 1] - d[3 * cur + 1]) ** 2;
          if (dd < bd) { bd = dd; best = j; }
        }
      }
      if (r > 4000) break;
    }
    if (best < 0) best = left.values().next().value!;
    cur = best;
  }
  return out;
}

export interface PlotOptions {
  title: string;
  layers: 'size' | 'single';
  description?: string;
}

export function plotSvg(r: Result, o: PlotOptions): string {
  const pen = r.penMm;
  const [pw, ph] = r.pageMm;
  const groups: { number: number; name: string; idx: number[] }[] =
    o.layers === 'single'
      ? [{ number: 0, name: 'title', idx: [] }]
      : [
          { number: 1, name: 'dots small', idx: [] },
          { number: 2, name: 'dots medium', idx: [] },
          { number: 3, name: 'dots large', idx: [] }
        ];
  for (let i = 0; i < r.count; i++) {
    const s = r.dots[3 * i + 2];
    if (o.layers === 'single') groups[0].idx.push(i);
    else groups[s <= pen * 1.05 ? 0 : s >= LARGE_MM - 1e-9 ? 2 : 1].idx.push(i);
  }
  const desc =
    `Cloud Type. Page ${f3(pw)} x ${f3(ph)} mm. Pen ${pen} mm. ` +
    (o.layers === 'single' ? 'Layer 0 title: every dot. ' : `Layers 1 dots small (one pen-down each), 2 dots medium (spirals under ${LARGE_MM} mm), 3 dots large (spirals from ${LARGE_MM} mm). `) +
    'Pen paths only, no fills. ' + (o.description ?? '');
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg ${NS} width="${f3(pw)}mm" height="${f3(ph)}mm" viewBox="0 0 ${f3(pw)} ${f3(ph)}">`,
    `<title>${xml(o.title)}</title>`,
    `<desc>${xml(desc.trim())}</desc>`
  ];
  for (const g of groups) {
    if (!g.idx.length) continue;
    parts.push(layerOpen(g.number, g.name, pen));
    for (const i of tour(g.idx, r.dots)) {
      const x = r.dots[3 * i], y = r.dots[3 * i + 1], s = r.dots[3 * i + 2];
      if (s <= pen * 1.05) parts.push(`<path d="M${f3(x)},${f3(y)}L${f3(x)},${f3(y)}"/>`);
      else parts.push(`<path d="${spiral(x, y, s, pen).map(([a, b], k) => `${k ? 'L' : 'M'}${f3(a)},${f3(b)}`).join(' ')}"/>`);
    }
    parts.push('</g>');
  }
  parts.push('</svg>');
  return parts.join('\n');
}

/** A preview: every dot a filled circle of its size, on the chosen ground. Not for the plotter. */
export function previewSvg(r: Result, title: string, dotColour: string, ground: 'white' | 'black' | 'transparent'): string {
  const [pw, ph] = r.pageMm;
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg ${NS} width="${f3(pw)}mm" height="${f3(ph)}mm" viewBox="0 0 ${f3(pw)} ${f3(ph)}">`,
    `<title>${xml(title)} (preview, not for plotting)</title>`
  ];
  if (ground !== 'transparent') parts.push(`<rect x="0" y="0" width="${f3(pw)}" height="${f3(ph)}" fill="${ground === 'black' ? '#000000' : '#ffffff'}"/>`);
  parts.push(`<g inkscape:groupmode="layer" inkscape:label="preview" fill="${xml(dotColour)}" stroke="none">`);
  for (let i = 0; i < r.count; i++) {
    parts.push(`<circle cx="${f3(r.dots[3 * i])}" cy="${f3(r.dots[3 * i + 1])}" r="${f3(r.dots[3 * i + 2] / 2)}"/>`);
  }
  parts.push('</g>', '</svg>');
  return parts.join('\n');
}
