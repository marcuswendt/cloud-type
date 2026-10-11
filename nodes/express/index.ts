// express: typeexpr.express, each headline crafted rather than one uniform
// effect. Between the stipple and the focus: regularity (grid, jitter), size,
// weight (cores heavier, stacked dots), dissolve (erode by edge, strokes,
// within or rim, with released dots carried off), per-letter variation
// (rotation, tone, nudge, stagger) and motion (a smear trail). Every default
// is the identity. Keeps `comp` (updated) and the detail `ncomp` for the focus.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { express } from '../../lib/cloudtype/express';
import { attr, detailOf, dotsToGeometry, geometryToDots, pointAttr } from '../../lib/cloudtype/geo';

export const definition = {
  apiVersion: 1,
  label: 'Express',
  description: 'Type expression (typeexpr.express): regularity, weight, dissolve, per-letter variation and motion on the dots.',
  icon: 'Sparkles',
  runsOn: 'portable',
  inputs: {
    points: { kind: 'data', type: 'geometry' },
    spec: { kind: 'data', type: 'bundle', schema: 'cloudtype_spec', fields: ['capMm', 'pitchMm', 'seed'] }
  },
  props: {
    grid: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Grid', description: 'Pull each dot onto a hexagonal lattice at the pitch; past 0.5 one dot per node' },
    jitter: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Jitter', description: 'Scatter by up to 0.35 pitch' },
    sizeVar: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Size variation', description: 'Per-dot size spread (lognormal on tone)' },
    weight: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Weight', description: "Raise the tone of the letters' cores" },
    stack: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Stack', description: 'Double a share of the core dots, 0.3 pitch apart' },
    erode: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Erode', description: 'Share of the dots that goes' },
    erodeMode: {
      type: 'string', default: 'edge', control: 'select', label: 'Erode from',
      options: [{ value: 'edge', label: 'edge' }, { value: 'strokes', label: 'strokes' }, { value: 'within', label: 'within' }, { value: 'rim', label: 'rim' }]
    },
    erodeAngle: { type: 'float', default: 0, min: -180, max: 180, step: 1, label: 'Erode angle', description: 'degrees: 0 right, 90 up' },
    erodeScale: { type: 'float', default: 0.5, min: 0.05, max: 3, step: 0.01, label: 'Erode scale', description: 'Noise scale, caps' },
    release: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Release', description: 'Share of the eroded dots carried off instead of going' },
    releaseDist: { type: 'float', default: 0.6, min: 0, max: 3, step: 0.01, label: 'Release distance', description: 'caps' },
    letterVar: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Letter variation', description: 'Each letter its own rotation (up to 5°), tone and nudge' },
    stagger: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Stagger', description: 'caps: each letter shifted along the stagger angle' },
    staggerAngle: { type: 'float', default: 90, min: -180, max: 180, step: 1, label: 'Stagger angle', description: 'degrees: 0 right, 90 up' },
    smear: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Smear', description: 'A trail of smear × 0.6 × n dots behind the letters' },
    smearAngle: { type: 'float', default: 0, min: -180, max: 180, step: 1, label: 'Smear angle', description: 'degrees: the direction of motion; the trail is opposite' },
    smearLen: { type: 'float', default: 0.8, min: 0, max: 3, step: 0.01, label: 'Smear length', description: 'caps' }
  },
  outputs: {
    points: { kind: 'data', type: 'geometry', description: 'Dots; point attributes t (tone) and comp (letter, 0 for released dots)' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.points;
  const spec = context.inputs.spec ?? {};
  const dots = geometryToDots(g);
  const compRaw = pointAttr(g, 'comp');
  const r = express(
    dots,
    compRaw ?? new Int32Array(dots.length),
    { capMm: Number(spec.capMm ?? 13.614), pitchMm: Number(spec.pitchMm ?? 0.4), seed: Number(spec.seed ?? 7) },
    context.props
  );
  context.outputs.points.set(dotsToGeometry(r.dots, { comp: attr.i32(r.comp) }, detailOf(g)));
}
