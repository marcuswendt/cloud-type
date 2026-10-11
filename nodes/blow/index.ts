// blow: titlepage.blow. A share of the dots carried off the downwind edge in
// clumps, at most `distance` caps. Blown dots are flagged `blown`.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { blow } from '../../lib/cloudtype/blow';
import { attr, detailOf, dotsToGeometry, geometryToDots } from '../../lib/cloudtype/geo';

export const definition = {
  apiVersion: 1,
  label: 'Blow',
  description: 'Carry a share of the dots off the downwind edge (titlepage.blow).',
  icon: 'Wind',
  runsOn: 'portable',
  inputs: {
    points: { kind: 'data', type: 'geometry' },
    spec: { kind: 'data', type: 'bundle', schema: 'cloudtype_spec', fields: ['capMm', 'pitchMm', 'seed'] }
  },
  props: {
    amount: { type: 'float', default: 0.05, min: 0, max: 0.3, step: 0.005, label: 'Amount', description: 'Share of the dots carried off the downwind edge' },
    angle: { type: 'float', default: 32, min: -180, max: 180, step: 1, label: 'Direction', description: 'degrees: 0 right, 90 up' },
    distance: { type: 'float', default: 0.5, min: 0, max: 3, step: 0.01, label: 'Distance', description: 'caps' }
  },
  outputs: {
    points: { kind: 'data', type: 'geometry', description: 'Dots; blown = 1 for the carried ones' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.points;
  const spec = context.inputs.spec ?? {};
  const p = context.props;
  const b = blow(geometryToDots(g), {
    capMm: Number(spec.capMm ?? 13.614), amount: p.amount, angleDeg: p.angle, distance: p.distance,
    seed: Number(spec.seed ?? 7), pitchGuess: Number(spec.pitchMm ?? 0.4)
  });
  context.outputs.points.set(dotsToGeometry(b.dots, { blown: attr.u8(b.kind) }, detailOf(g)));
}
