// Text setting, as titletype.layout without the mockup fit: every glyph at
// cap height `capMm`, the pen advancing by the glyph's own advance (no
// kerning, as PIL's per-character getlength) plus `tracking` caps, lines
// `leading` caps apart, each line optionally indented by `indents[i]` caps.

import type { Font, PathCommand } from 'opentype.js';
import type { Polygon, Pt } from './grid';

export interface TypeSetting {
  text: string;
  capMm: number;
  leading: number;
  tracking: number;
  width: number;
  align: 'left' | 'center' | 'right';
  indents: number[];
}

export interface GlyphPlacement {
  ch: string;
  xMm: number;
  baselineMm: number;
}

export interface Setting {
  polygons: Polygon[]; // in mm, origin at the first line's left edge and baseline
  glyphs: GlyphPlacement[];
  lines: { baselineMm: number; capMm: number }[];
}

export function capRatio(font: Font): number {
  const g = font.charToGlyph('H');
  const bb = g.getBoundingBox();
  const h = bb.y2 > 0 ? bb.y2 : font.unitsPerEm * 0.7;
  return h / font.unitsPerEm;
}

function flatten(cmds: PathCommand[], tol: number): Polygon[] {
  const out: Polygon[] = [];
  let cur: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  const close = () => {
    if (cur.length >= 3) out.push(cur);
    cur = [];
  };
  for (const c of cmds) {
    if (c.type === 'M') {
      close();
      x = sx = c.x!;
      y = sy = c.y!;
      cur.push([x, y]);
    } else if (c.type === 'L') {
      x = c.x!;
      y = c.y!;
      cur.push([x, y]);
    } else if (c.type === 'Q') {
      const n = Math.max(2, Math.ceil(Math.hypot(c.x! - x, c.y! - y) / tol / 2));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        cur.push([u * u * x + 2 * u * t * c.x1! + t * t * c.x!, u * u * y + 2 * u * t * c.y1! + t * t * c.y!]);
      }
      x = c.x!;
      y = c.y!;
    } else if (c.type === 'C') {
      const len = Math.hypot(c.x1! - x, c.y1! - y) + Math.hypot(c.x2! - c.x1!, c.y2! - c.y1!) + Math.hypot(c.x! - c.x2!, c.y! - c.y2!);
      const n = Math.max(3, Math.ceil(len / tol / 2));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        cur.push([
          u * u * u * x + 3 * u * u * t * c.x1! + 3 * u * t * t * c.x2! + t * t * t * c.x!,
          u * u * u * y + 3 * u * u * t * c.y1! + 3 * u * t * t * c.y2! + t * t * t * c.y!
        ]);
      }
      x = c.x!;
      y = c.y!;
    } else if (c.type === 'Z') {
      x = sx;
      y = sy;
      close();
    }
  }
  close();
  return out;
}

export function setText(font: Font, s: TypeSetting): Setting {
  const ratio = capRatio(font);
  const sizeMm = s.capMm / ratio; // font size (em) in mm
  const unit = sizeMm / font.unitsPerEm;
  const lines = s.text.replace(/\\n/g, '\n').split('\n');
  const polygons: Polygon[] = [];
  const glyphs: GlyphPlacement[] = [];
  const lineInfo: { baselineMm: number; capMm: number }[] = [];
  lines.forEach((line, i) => {
    const base = i * s.leading * s.capMm;
    lineInfo.push({ baselineMm: base, capMm: s.capMm });
    let pen = 0;
    const row: { ch: string; x: number }[] = [];
    for (const ch of Array.from(line)) {
      const g = font.charToGlyph(ch);
      if (ch !== ' ') row.push({ ch, x: pen });
      pen += (g.advanceWidth ?? 0) * unit * s.width + s.tracking * s.capMm;
    }
    const lineW = pen - s.tracking * s.capMm;
    const shift = (s.align === 'center' ? -lineW / 2 : s.align === 'right' ? -lineW : 0) + (s.indents[i] ?? 0) * s.capMm;
    for (const { ch, x } of row) {
      const gx = x + shift;
      glyphs.push({ ch, xMm: gx, baselineMm: base });
      const g = font.charToGlyph(ch);
      // opentype's path is y-down from the baseline at fontSize in "px": use mm directly.
      const path = g.getPath(0, 0, sizeMm);
      for (const poly of flatten(path.commands, s.capMm / 400)) {
        polygons.push(poly.map(([px, py]) => [gx + px * s.width, base + py] as Pt));
      }
    }
  });
  return { polygons, glyphs, lines: lineInfo };
}

export function bounds(polys: Polygon[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}
