// plot-svg: the plotter document, as the standalone's plotSvg. Millimetres,
// numbered Inkscape layers (1 small / 2 medium / 3 large, or one 0 title),
// pen paths only: a pen-down for a dot no larger than the pen, plotdoc's
// spiral disc for a larger one. No fills.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { detailNumber, detailString } from '../../lib/cloudtype/geo';
import { pageDots } from '../../lib/cloudtype/page';
import { plotSvg } from '../../lib/cloudtype/svg';

export const definition = {
  apiVersion: 1,
  label: 'Plot SVG',
  description: 'Plotter SVG: mm, Inkscape layers, pen paths only.',
  icon: 'FileCode',
  runsOn: 'portable',
  inputs: {
    page: { kind: 'data', type: 'geometry' }
  },
  props: {
    layers: { type: 'string', default: 'size', control: 'select', label: 'SVG layers', options: [{ value: 'size', label: '1 small · 2 medium · 3 large' }, { value: 'single', label: '0 title (one layer)' }] }
  },
  outputs: {
    svg: { kind: 'data', type: 'string' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.page;
  const layers = context.props.layers === 'single' ? 'single' : 'size';
  const description = `${detailString(g, 'description')} Seed ${detailNumber(g, 'seed')}.`.trim();
  context.outputs.svg.set(plotSvg(pageDots(g), { title: detailString(g, 'title', 'Cloud Type'), layers, description }));
}
