// spec: the numbers every stage shares, as one bundle. The pitch is resolved
// here once (cap / 34 clamped to 0.28-0.6 mm, divided by the density, unless
// set explicitly) so no later stage re-derives it.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { pitchOf } from '../../lib/cloudtype/params';

export const definition = {
  apiVersion: 1,
  label: 'Spec',
  description: 'Cap height, dot pitch, seed and pen, shared by every stage.',
  icon: 'Ruler',
  runsOn: 'portable',
  props: {
    capMm: { type: 'float', default: 13.614, min: 3, max: 60, step: 0.01, label: 'Cap height', description: 'mm. For an image source, the scale the focus and blown dots are measured in.' },
    density: { type: 'float', default: 1, min: 0.4, max: 2.5, step: 0.01, label: 'Density', description: '1 = cap / 34 pitch' },
    pitchMm: { type: 'float', default: 0, min: 0, max: 2, step: 0.001, label: 'Pitch', description: 'mm; 0 = automatic (cap / 34, 0.28-0.6 mm)' },
    seed: { type: 'int', default: 7, min: 0, max: 99999, step: 1, label: 'Seed' },
    penMm: { type: 'float', default: 0.1, min: 0.1, max: 0.2, step: 0.1, label: 'Pen', description: 'mm: 0.1 or 0.2' },
    quality: { type: 'string', default: 'full', control: 'select', options: [{ value: 'full', label: 'full' }, { value: 'preview', label: 'preview (faster)' }], label: 'Quality' }
  },
  outputs: {
    spec: {
      kind: 'data', type: 'bundle', schema: 'cloudtype_spec',
      fields: {
        capMm: { type: 'float', description: 'Cap height, mm' },
        pitchMm: { type: 'float', description: 'Dot pitch, mm' },
        seed: 'int',
        penMm: { type: 'float', description: 'Pen width, mm' },
        quality: { type: 'string', description: 'full or preview' }
      }
    }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const p = context.props;
  context.outputs.spec.set({
    capMm: p.capMm,
    pitchMm: pitchOf(p.capMm, p.density, p.pitchMm),
    seed: p.seed,
    penMm: p.penMm,
    quality: p.quality === 'preview' ? 'preview' : 'full'
  });
}
