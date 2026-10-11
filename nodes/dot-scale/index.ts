// dot-scale: titletype.dot_scale. A dot's size factor grows with its tone; the
// look's tone (clamped 0.2-1.5) multiplies all of them. `t` becomes the factor.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { detailOf, dotsToGeometry, geometryToDots } from '../../lib/cloudtype/geo';
import { dotScale } from '../../lib/cloudtype/params';

export const definition = {
  apiVersion: 1,
  label: 'Dot scale',
  description: 'Tone to size factor (titletype.dot_scale).',
  icon: 'Scaling',
  runsOn: 'portable',
  inputs: {
    points: { kind: 'data', type: 'geometry' },
    look: { kind: 'data', type: 'bundle', schema: 'cloudtype_look', fields: ['tone'] }
  },
  props: {
    growth: { type: 'float', default: 0.5, min: 0, max: 1.5, step: 0.01, label: 'Size growth' }
  },
  outputs: {
    points: { kind: 'data', type: 'geometry', description: 't is now the size factor' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.points;
  const tone = Math.min(1.5, Math.max(0.2, Number(context.inputs.look?.tone ?? 1)));
  const growth = context.props.growth;
  const dots = geometryToDots(g).map((d) => ({ x: d.x, y: d.y, t: dotScale(d.t, growth, tone) }));
  context.outputs.points.set(dotsToGeometry(dots, {}, detailOf(g)));
}
