// opentype.js is a project-owned dependency (never Cascade core). It is CJS in
// Node and may be ESM in a bundle, so take `parse` from wherever it lives.
import * as ot from 'opentype.js';
import type { Font } from 'opentype.js';

export function parseFont(bytes: Uint8Array): Font {
  const mod = ot as unknown as { parse?: (b: ArrayBuffer) => Font; default?: { parse?: (b: ArrayBuffer) => Font } };
  const parse = mod.parse ?? mod.default?.parse;
  if (!parse) throw new Error('opentype.js: no parse()');
  return parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}

export function fontName(font: Font, fallback: string): string {
  const names = font.names as unknown as Record<string, unknown>;
  const pick = (rec: unknown): string | undefined => {
    if (!rec || typeof rec !== 'object') return undefined;
    const full = (rec as Record<string, unknown>).fullName as Record<string, string> | undefined;
    if (full && typeof full === 'object') return full.en ?? Object.values(full)[0];
    return undefined;
  };
  return pick(names) ?? pick(names.windows) ?? pick(names.macintosh) ?? pick(names.unicode) ?? fallback;
}
