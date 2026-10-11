// style: one dot colour and ground for the preview and the PNG.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';

export const definition = {
  apiVersion: 1,
  label: 'Style',
  description: 'Dot colour and ground, shared by the preview and the PNG.',
  icon: 'Palette',
  runsOn: 'portable',
  props: {
    colour: { type: 'color', default: [0.0941, 0.0941, 0.0941, 1], label: 'Dots' },
    ground: { type: 'string', default: 'white', control: 'select', label: 'Ground', options: [{ value: 'white', label: 'white' }, { value: 'black', label: 'black' }, { value: 'transparent', label: 'transparent' }] }
  },
  outputs: {
    style: { kind: 'data', type: 'bundle', schema: 'cloudtype_style', fields: { colour: 'color', ground: 'string' } }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  context.outputs.style.set({ colour: context.props.colour, ground: context.props.ground });
}
