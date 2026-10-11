// thin: no two dot centres closer than the minimum spacing (set it to the pen
// width so nib marks never merge). Larger dots win.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { createGeometry, type Attribute } from 'cascade/contracts';
import { thin } from '../../lib/cloudtype/blow';
import { geometryToDots, pointAttr } from '../../lib/cloudtype/geo';

export const definition = {
  apiVersion: 1,
  label: 'Thin',
  description: 'Drop dots closer than the minimum spacing.',
  icon: 'Eraser',
  runsOn: 'portable',
  inputs: {
    points: { kind: 'data', type: 'geometry' }
  },
  props: {
    minSpacingMm: { type: 'float', default: 0, min: 0, max: 0.8, step: 0.01, label: 'Min spacing', description: 'mm' }
  },
  outputs: {
    points: { kind: 'data', type: 'geometry' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.points;
  if (!g) return;
  const size = pointAttr(g, 'size');
  const sizes = size instanceof Float64Array ? size : Float64Array.from(size ?? new Float64Array(g.pointCount));
  const keep = thin(geometryToDots(g), sizes, context.props.minSpacingMm);
  if (keep.length === g.pointCount) {
    context.outputs.points.set(g);
    return;
  }
  const point: Record<string, Attribute> = {};
  for (const [name, a] of Object.entries(g.point)) {
    if (a.storage === 'string') continue;
    const C = a.data.constructor as new (n: number) => typeof a.data;
    const out = new C(keep.length * a.size);
    keep.forEach((i, k) => { for (let c = 0; c < a.size; c++) out[k * a.size + c] = a.data[i * a.size + c]; });
    point[name] = { storage: a.storage, size: a.size, data: out };
  }
  context.outputs.points.set(createGeometry({ pointCount: keep.length, point, detail: { ...g.detail } }));
}
