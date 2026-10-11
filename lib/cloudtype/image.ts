// Image bytes -> darkness, as the standalone's render.readImage: transparent
// counts as white, at most `max` px on the long side. Works in the browser and
// under `cascade run`, where the headless host installs createImageBitmap and
// OffscreenCanvas over Skia.

import type { ImageInput } from './mask';

export async function decodeDarkness(bytes: Uint8Array, mediaType: string | undefined, max = 2400): Promise<ImageInput> {
  const bmp = (await createImageBitmap(new Blob([bytes as BlobPart], mediaType ? { type: mediaType } : {}))) as ImageBitmap;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const dark = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dark[i] = 1 - (0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]) / 255;
  bmp.close?.();
  return { w, h, dark };
}
