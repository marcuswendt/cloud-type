// Dots onto a canvas: each a filled disc of its plotted size, as plotdoc.rasterize
// draws the spirals. The standalone's render.drawDots, on any 2D context.

import type { PageDots } from './page';

export type Ground = 'white' | 'black' | 'transparent';

/** The two automatic dot colours: dark ink, and the light ink it swaps to on black. */
export const DARK_DOTS = '#181818';
export const LIGHT_DOTS = '#ededed';

/**
 * The dot colour for a ground. The default ink follows the ground (dark on
 * white or transparent, light on black), as the standalone app's setGround did;
 * any other colour was chosen on purpose and is kept. Without this a black
 * export is black dots on black.
 */
export function dotColourFor(colour: string, ground: Ground): string {
  const c = colour.toLowerCase();
  if (c !== DARK_DOTS && c !== LIGHT_DOTS) return colour;
  return ground === 'black' ? LIGHT_DOTS : DARK_DOTS;
}

export function drawDots(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  r: PageDots,
  pxPerMm: number,
  dotColour: string,
  ground: Ground
) {
  ctx.clearRect(0, 0, width, height);
  if (ground !== 'transparent') {
    ctx.fillStyle = ground === 'black' ? '#000' : '#fff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = dotColour;
  ctx.beginPath();
  const minR = 0.35; // keep sub-pixel dots visible as faint specks rather than vanishing
  for (let i = 0; i < r.count; i++) {
    const x = r.dots[3 * i] * pxPerMm;
    const y = r.dots[3 * i + 1] * pxPerMm;
    const rad = Math.max(minR, (r.dots[3 * i + 2] / 2) * pxPerMm);
    ctx.moveTo(x + rad, y);
    ctx.arc(x, y, rad, 0, Math.PI * 2);
  }
  ctx.fill();
}
