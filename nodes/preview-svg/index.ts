// preview-svg: every dot a filled circle of its size on the ground. The viewer
// output; not for the plotter.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { Color } from 'cascade/contracts';
import { detailString } from '../../lib/cloudtype/geo';
import { pageDots } from '../../lib/cloudtype/page';
import { previewSvg } from '../../lib/cloudtype/svg';

export const definition = {
  apiVersion: 1,
  label: 'Preview SVG',
  description: 'Filled preview SVG in the dot colour on the ground.',
  icon: 'Eye',
  runsOn: 'portable',
  inputs: {
    page: { kind: 'data', type: 'geometry' },
    style: { kind: 'data', type: 'bundle', schema: 'cloudtype_style', fields: ['colour', 'ground'] }
  },
  outputs: {
    svg: { kind: 'data', type: 'string' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.page;
  const s = context.inputs.style ?? {};
  const colour = Array.isArray(s.colour) ? Color.toHex(s.colour as [number, number, number, number]) : '#181818';
  const ground = s.ground === 'black' || s.ground === 'transparent' ? s.ground : 'white';
  context.outputs.svg.set(previewSvg(pageDots(g), detailString(g, 'title', 'Cloud Type'), colour, ground));
}
