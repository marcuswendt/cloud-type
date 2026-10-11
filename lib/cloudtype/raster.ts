// Dots onto a canvas: each a filled disc of its plotted size, as plotdoc.rasterize
// draws the spirals. The standalone's render.drawDots, on any 2D context.

import type { PageDots } from './page';

export type Ground = 'white' | 'black' | 'transparent';

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
