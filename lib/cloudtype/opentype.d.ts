declare module 'opentype.js' {
  export interface PathCommand { type: 'M' | 'L' | 'Q' | 'C' | 'Z'; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }
  export interface Path { commands: PathCommand[] }
  export interface Glyph { advanceWidth?: number; yMax?: number; getPath(x: number, y: number, fontSize: number): Path; getBoundingBox(): { x1: number; y1: number; x2: number; y2: number } }
  export interface Font {
    unitsPerEm: number;
    names: { fullName?: Record<string, string>; fontFamily?: Record<string, string> };
    charToGlyph(ch: string): Glyph;
  }
  export function parse(buffer: ArrayBuffer): Font;
}
