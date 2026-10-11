// stipple: titletype's solid fill. One row of dots along every contour, inset a
// dot radius, the interior Lloyd-relaxed against it. Each dot carries its tone
// `t` and the connected component (letter) it sits in, `comp`, for the focus.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { connectedComponents } from '../../lib/cloudtype/grid';
import { stipple } from '../../lib/cloudtype/stipple';
import { attr, dotsToGeometry } from '../../lib/cloudtype/geo';
import type { SourceMask } from '../../lib/cloudtype/mask';

export const definition = {
  apiVersion: 1,
  label: 'Stipple',
  description: 'Mask to dots: contour row plus a Lloyd-relaxed interior. Points carry t and comp.',
  icon: 'Grip',
  runsOn: 'portable',
  inputs: {
    mask: { kind: 'data', type: 'cloudtype.mask' },
    spec: { kind: 'data', type: 'bundle', schema: 'cloudtype_spec', fields: ['pitchMm', 'seed', 'quality'] }
  },
  props: {
    order: { type: 'float', default: 1, min: 0, max: 2, step: 0.05, label: 'Order', description: 'Lloyd relaxation: 0 random, 1 near-hexagonal' }
  },
  outputs: {
    points: { kind: 'data', type: 'geometry', description: 'Dots, mm; point attributes t (tone) and comp (letter)' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const mask = context.inputs.mask as SourceMask | null | undefined;
  const spec = context.inputs.spec ?? {};
  const pitch = Number(spec.pitchMm ?? 0.4);
  const seed = Number(spec.seed ?? 7);
  if (!mask) {
    context.outputs.points.set(dotsToGeometry([], { comp: attr.i32(new Int32Array(0)) }, { ncomp: 0, seed }));
    return;
  }
  const R = mask.pxPerMm;
  const origin = mask.originMm;
  const dots = stipple(mask, { pxPerMm: R, originMm: origin, pitchMm: pitch, order: context.props.order, seed, iterScale: spec.quality === 'preview' ? 0.6 : 1 });
  const cc = connectedComponents(mask.inside, mask.w, mask.h);
  const comp = new Int32Array(dots.length);
  dots.forEach((d, i) => {
    const ix = Math.min(mask.w - 1, Math.max(0, Math.floor((d.x - origin[0]) * R)));
    const iy = Math.min(mask.h - 1, Math.max(0, Math.floor((d.y - origin[1]) * R)));
    comp[i] = cc.labels[iy * mask.w + ix];
  });
  context.outputs.points.set(
    dotsToGeometry(dots, { comp: attr.i32(comp) }, { ncomp: cc.n, seed, title: mask.title, description: mask.description })
  );
}
