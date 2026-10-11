// look: how far from 1C the focus sits. With "use strength" on, the five values
// come from titlepage.between(strength), 0 = 1C, 1 = soft (the approved CLOUD
// OBSERVATORY is 0.1); off, they are set by hand.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { between } from '../../lib/cloudtype/params';

export const definition = {
  apiVersion: 1,
  label: 'Look',
  description: 'Defocus, fade, sharp zone, falloff and dot tone: from the 1C-soft strength, or by hand.',
  icon: 'Aperture',
  runsOn: 'portable',
  props: {
    useStrength: { type: 'bool', default: true, label: 'Use strength' },
    strength: { type: 'float', default: 0.1, min: 0, max: 1, step: 0.01, label: 'Strength 1C→soft' },
    defocus: { type: 'float', default: 0.408, min: 0, max: 1.2, step: 0.001, label: 'Defocus', description: 'caps' },
    fade: { type: 'float', default: 0.435, min: 0, max: 1, step: 0.001, label: 'Fade' },
    dof: { type: 'float', default: 0.183, min: 0, max: 1, step: 0.001, label: 'Sharp zone', description: "dof: share of the text's width kept sharp" },
    span: { type: 'float', default: 0.492, min: 0.02, max: 1.5, step: 0.001, label: 'Falloff', description: 'span: distance to full blur' },
    tone: { type: 'float', default: 0.715, min: 0.2, max: 1.5, step: 0.001, label: 'Tone', description: "Multiplies every dot's size" }
  },
  outputs: {
    look: {
      kind: 'data', type: 'bundle', schema: 'cloudtype_look',
      fields: { defocus: 'float', fade: 'float', dof: 'float', span: 'float', tone: 'float' }
    }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const p = context.props;
  const v = p.useStrength ? between(p.strength) : { defocus: p.defocus, fade: p.fade, dof: p.dof, span: p.span, tone: p.tone };
  context.outputs.look.set(v);
}
