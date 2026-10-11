// pen-sizes: each dot's plotted diameter, dot size x pitch x its factor,
// rounded to a quarter pen and never below the pen (plotdoc). Writes `size` (mm).
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { attr, detailOf, pointAttr } from '../../lib/cloudtype/geo';
import { createGeometry } from 'cascade/contracts';

export const definition = {
  apiVersion: 1,
  label: 'Pen sizes',
  description: 'Size factor to plotted diameter in mm, on quarter-pen steps.',
  icon: 'PenTool',
  runsOn: 'portable',
  inputs: {
    points: { kind: 'data', type: 'geometry' },
    spec: { kind: 'data', type: 'bundle', schema: 'cloudtype_spec', fields: ['pitchMm', 'penMm'] }
  },
  props: {
    dotSize: { type: 'float', default: 0.55, min: 0.1, max: 1.5, step: 0.01, label: 'Dot size', description: 'Dot diameter as a share of the pitch' }
  },
  outputs: {
    points: { kind: 'data', type: 'geometry', description: 'Dots with size (mm)' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.points;
  const pitch = Number(context.inputs.spec?.pitchMm ?? 0.4);
  const pen = Number(context.inputs.spec?.penMm ?? 0.1);
  if (!g) return;
  const t = pointAttr(g, 't') ?? new Float64Array(g.pointCount);
  const step = pen / 4;
  const dotMm = context.props.dotSize * pitch;
  const sizes = new Float64Array(g.pointCount);
  for (let i = 0; i < g.pointCount; i++) sizes[i] = Math.max(pen, Math.round((dotMm * t[i]) / step) * step);
  context.outputs.points.set(createGeometry({
    pointCount: g.pointCount,
    point: { ...g.point, size: attr.f64(sizes) },
    detail: { ...detailOf(g), penMm: pen, pitchMm: pitch, dotMm }
  }));
}
