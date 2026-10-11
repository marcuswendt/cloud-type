// type-set: the headline set in the chosen font at cap height (titletype.layout
// without the mockup fit), as closed outline polygons in mm. Inspect it as a
// wireframe. The font is read from its asset; a licensed font is dropped in by
// the person using it and never ships with the project.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { setText } from '../../lib/cloudtype/layout';
import { fontName, parseFont } from '../../lib/cloudtype/font';
import { polygonsToGeometry } from '../../lib/cloudtype/geo';

export const definition = {
  apiVersion: 1,
  label: 'Type set',
  description: 'Text at cap height, leading, tracking, width, alignment and indents, as outline polygons (mm).',
  icon: 'Type',
  runsOn: 'portable',
  capabilities: ['assets'],
  inputs: {
    spec: { kind: 'data', type: 'bundle', schema: 'cloudtype_spec', fields: ['capMm'] }
  },
  props: {
    text: { type: 'string', default: 'CLOUD\nOBSERVATORY', control: 'textarea', label: 'Text' },
    font: { type: 'asset', default: { path: 'assets/fonts/InterDisplay-Medium.otf', mediaType: 'font/otf' }, accept: ['.otf', '.ttf'], label: 'Font' },
    leading: { type: 'float', default: 1.2146, min: 0.8, max: 2, step: 0.001, label: 'Leading', description: 'caps between baselines' },
    tracking: { type: 'float', default: -0.0097, min: -0.2, max: 0.4, step: 0.0001, label: 'Tracking', description: 'caps added after every glyph' },
    width: { type: 'float', default: 1, min: 0.6, max: 1.4, step: 0.01, label: 'Width' },
    align: { type: 'string', default: 'left', control: 'select', options: [{ value: 'left', label: 'left' }, { value: 'center', label: 'centre' }, { value: 'right', label: 'right' }], label: 'Align' },
    indents: { type: 'string', default: '', label: 'Line indents', description: 'Per line, in caps, e.g. 2.27, 0, 0' }
  },
  outputs: {
    geometry: { kind: 'data', type: 'geometry', description: 'Closed glyph outlines, mm, origin at the first baseline' }
  }
} as const satisfies NodeDefinition;

export async function execute(context: NodeExecutionContext<typeof definition>) {
  const p = context.props;
  const capMm = Number(context.inputs.spec?.capMm ?? 13.614);
  const ref = p.font as { path?: string; mediaType?: string } | null;
  if (!ref?.path) throw new Error('Type set: no font');
  const bytes = await context.capabilities.assets.read(ref as { path: string }, { signal: context.signal });
  const font = parseFont(bytes);
  const indents = String(p.indents ?? '').split(/[ ,;]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  const align = p.align === 'center' || p.align === 'right' ? p.align : 'left';
  const set = setText(font, { text: p.text, capMm, leading: p.leading, tracking: p.tracking, width: p.width, align, indents });
  const name = fontName(font, ref.path.split('/').pop() ?? 'font');
  context.outputs.geometry.set(
    polygonsToGeometry(set.polygons, { title: p.text.replace(/\\n/g, '\n').replace(/\n/g, ' '), description: `Font: ${name}.` })
  );
}
