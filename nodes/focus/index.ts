// focus: titletype.focus, a lens finding the sharp point. Each dot is moved by a
// draw from its bokeh kernel (disc, ring or cat's eye), scaled by its distance
// from the sharp zone; fade thins defocused dots, rings draws some as visible
// bokeh rings, ghost adds an offset second image, shrink takes defocused dots
// toward a pen point. Plus the reticle and the focus scale.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { focus, reticle } from '../../lib/cloudtype/focus';
import { detailOf, detailNumber, dotsToGeometry, geometryToDots, pointAttr } from '../../lib/cloudtype/geo';
import type { Dot } from '../../lib/cloudtype/stipple';

export const definition = {
  apiVersion: 1,
  label: 'Focus',
  description: 'Defocus the dots around a focal point or line, with bokeh, rings, ghost and the reticle.',
  icon: 'Focus',
  runsOn: 'portable',
  inputs: {
    points: { kind: 'data', type: 'geometry' },
    spec: { kind: 'data', type: 'bundle', schema: 'cloudtype_spec', fields: ['capMm', 'pitchMm', 'seed'] },
    look: { kind: 'data', type: 'bundle', schema: 'cloudtype_look', fields: ['defocus', 'fade', 'dof', 'span'] }
  },
  props: {
    field: {
      type: 'string', default: 'radial', control: 'select', label: 'Style',
      options: [{ value: 'none', label: 'none (sharp)' }, { value: 'radial', label: 'radial' }, { value: 'tilt', label: 'tilt' }, { value: 'swept', label: 'swept' }, { value: 'hunt', label: 'hunt' }]
    },
    centre: { type: 'vec2', default: [0.35, 0.5], min: -0.5, max: 3, step: 0.001, label: 'Focal point', description: "Share of the text's box" },
    angle: { type: 'float', default: 20, min: -90, max: 90, step: 1, label: 'Angle', description: 'degrees' },
    sweep: { type: 'float', default: 0.5, min: 0, max: 1, step: 0.01, label: 'Sweep' },
    rhythm: { type: 'float', default: 2, min: 0.5, max: 8, step: 0.1, label: 'Rhythm' },
    bokeh: { type: 'string', default: 'cateye', control: 'select', label: 'Bokeh', options: [{ value: 'disc', label: 'disc' }, { value: 'ring', label: 'ring' }, { value: 'cateye', label: "cat's eye" }] },
    rim: { type: 'float', default: 0.55, min: 0, max: 1, step: 0.01, label: 'Rim' },
    cat: { type: 'float', default: 0.55, min: 0, max: 0.95, step: 0.01, label: "Cat's eye" },
    rings: { type: 'float', default: 0.7, min: 0, max: 3, step: 0.01, label: 'Bokeh rings' },
    ringTone: { type: 'float', default: -0.2, min: -2, max: 1, step: 0.01, label: 'Ring tone' },
    shrink: { type: 'float', default: 1, min: 0, max: 2, step: 0.01, label: 'Shrink', description: 'Defocused dots shrink toward a pen point' },
    ghost: { type: 'float', default: 0, min: 0, max: 1, step: 0.01, label: 'Ghost' },
    reticle: { type: 'float', default: 0, min: 0, max: 1.5, step: 0.01, label: 'Reticle' },
    scale: { type: 'bool', default: false, label: 'Focus scale (ticks)' },
    scaleLength: { type: 'float', default: 0.55, min: 0.05, max: 1, step: 0.0001, label: 'Scale length', description: "Share of the text's width" }
  },
  outputs: {
    points: { kind: 'data', type: 'geometry', description: 'Dots after the lens; t is the tone' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.points;
  const p = context.props;
  const spec = context.inputs.spec ?? {};
  const look = context.inputs.look ?? {};
  const capMm = Number(spec.capMm ?? 13.614);
  const pitch = Number(spec.pitchMm ?? 0.4);
  const seed = Number(spec.seed ?? 7);
  let dots: Dot[] = geometryToDots(g);
  const field = p.field;
  if (dots.length && (field === 'radial' || field === 'tilt' || field === 'swept' || field === 'hunt')) {
    const compRaw = pointAttr(g, 'comp');
    const comp = compRaw instanceof Int32Array ? compRaw : Int32Array.from(compRaw ?? new Int32Array(dots.length));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const d of dots) { x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y); x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y); }
    const bbox: [number, number, number, number] = [x0, y0, x1, y1];
    const center: [number, number] = [p.centre[0], p.centre[1]];
    const kernel = p.bokeh === 'disc' || p.bokeh === 'ring' ? p.bokeh : 'cateye';
    dots = focus(dots, comp, detailNumber(g, 'ncomp', 0), capMm, {
      field, center, angle: p.angle, dof: Number(look.dof), span: Number(look.span), defocus: Number(look.defocus),
      kernel, rim: p.rim, cat: p.cat, fade: Number(look.fade), ghost: p.ghost, ghostDir: [0.6, -0.3], sweep: p.sweep,
      rhythm: p.rhythm, seed, bbox, orderRange: [0, 1], rings: p.rings, ringPitch: pitch * 1.3, shrink: p.shrink,
      ringTone: p.ringTone
    });
    if (p.reticle > 0) dots = dots.concat(reticle(bbox, capMm, pitch, center, p.reticle, p.scale, p.scaleLength));
  }
  const detail = detailOf(g);
  delete detail.ncomp;
  context.outputs.points.set(dotsToGeometry(dots, {}, detail));
}
