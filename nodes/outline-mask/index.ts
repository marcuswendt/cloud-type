// outline-mask: the glyph outlines filled on the stipple raster (10 px per
// pitch, 6 for preview) with a 1 mm margin.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { detailString, geometryToPolygons } from '../../lib/cloudtype/geo';
import { outlineMask } from '../../lib/cloudtype/mask';
import { maskResolution } from '../../lib/cloudtype/params';

export const definition = {
  apiVersion: 1,
  label: 'Outline mask',
  description: 'Closed outlines to a raster mask.',
  icon: 'SquareDashed',
  runsOn: 'portable',
  inputs: {
    geometry: { kind: 'data', type: 'geometry' },
    spec: { kind: 'data', type: 'bundle', schema: 'cloudtype_spec', fields: ['pitchMm', 'quality'] }
  },
  outputs: {
    mask: { kind: 'data', type: 'cloudtype.mask' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.geometry;
  const pitch = Number(context.inputs.spec?.pitchMm ?? 0.4);
  const R = maskResolution(pitch, String(context.inputs.spec?.quality ?? 'full'));
  context.outputs.mask.set(outlineMask(geometryToPolygons(g), R, detailString(g, 'title'), detailString(g, 'description')));
}
