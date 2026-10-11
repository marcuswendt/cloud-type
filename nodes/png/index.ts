// png: the page rasterised at a print resolution, each dot a filled disc of its
// plotted size, on white, black or transparent.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { Color } from 'cascade/contracts';
import { cachePath, saveImage } from 'cascade/io';
import { pageDots } from '../../lib/cloudtype/page';
import { drawDots } from '../../lib/cloudtype/raster';

export const definition = {
  apiVersion: 1,
  label: 'PNG',
  description: 'Raster of the page at 150-1200 dpi.',
  icon: 'ImageDown',
  runsOn: 'portable',
  inputs: {
    page: { kind: 'data', type: 'geometry' },
    style: { kind: 'data', type: 'bundle', schema: 'cloudtype_style', fields: ['colour'] }
  },
  props: {
    dpi: { type: 'int', default: 600, min: 72, max: 1200, step: 1, label: 'PNG dpi' },
    ground: { type: 'string', default: 'transparent', control: 'select', label: 'PNG ground', options: [{ value: 'transparent', label: 'transparent' }, { value: 'white', label: 'white' }, { value: 'black', label: 'black' }] }
  },
  outputs: {
    image: { kind: 'data', type: 'image' }
  }
} as const satisfies NodeDefinition;

export async function execute(context: NodeExecutionContext<typeof definition>) {
  const r = pageDots(context.inputs.page);
  const s = context.inputs.style ?? {};
  const colour = Array.isArray(s.colour) ? Color.toHex(s.colour as [number, number, number, number]) : '#181818';
  const ground = context.props.ground === 'black' || context.props.ground === 'white' ? context.props.ground : 'transparent';
  const ppm = context.props.dpi / 25.4;
  const w = Math.max(1, Math.round(r.pageMm[0] * ppm));
  const h = Math.max(1, Math.round(r.pageMm[1] * ppm));
  if (w * h > 260e6 || w > 32000 || h > 32000) throw new Error(`${w} x ${h} px is too large; lower the dpi`);
  const canvas = new OffscreenCanvas(w, h);
  drawDots(canvas.getContext('2d') as OffscreenCanvasRenderingContext2D, w, h, r, ppm, colour, ground);
  const path = await saveImage(canvas, cachePath(context.nodeId, '.png'));
  context.outputs.image.set({ path, size: [w, h], channels: 'rgba', depth: 'u8', space: 'srgb' });
}
