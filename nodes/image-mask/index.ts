// image-mask: an image as the source. Dark is ink (or light, inverted);
// threshold keeps it binary, luminance also weights the dot density by tone
// above a floor. Scaled to a height in mm.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { decodeDarkness } from '../../lib/cloudtype/image';
import { emptyMask, imageMask } from '../../lib/cloudtype/mask';
import { maskResolution } from '../../lib/cloudtype/params';

export const definition = {
  apiVersion: 1,
  label: 'Image mask',
  description: 'An image to a raster mask (and density, in luminance mode).',
  icon: 'Image',
  runsOn: 'portable',
  capabilities: ['assets'],
  inputs: {
    spec: { kind: 'data', type: 'bundle', schema: 'cloudtype_spec', fields: ['pitchMm', 'quality'] }
  },
  props: {
    image: { type: 'asset', default: { path: '' }, accept: ['image/*'], label: 'Image' },
    mode: { type: 'string', default: 'threshold', control: 'select', options: [{ value: 'threshold', label: 'Threshold' }, { value: 'luminance', label: 'Luminance' }], label: 'Mode' },
    threshold: { type: 'float', default: 0.5, min: 0.02, max: 0.98, step: 0.01, label: 'Threshold' },
    floor: { type: 'float', default: 0.15, min: 0, max: 1, step: 0.01, label: 'Density floor' },
    invert: { type: 'bool', default: false, label: 'Invert (light is ink)' },
    heightMm: { type: 'float', default: 40, min: 5, max: 250, step: 0.5, label: 'Image height', description: 'mm' }
  },
  outputs: {
    mask: { kind: 'data', type: 'cloudtype.mask' }
  }
} as const satisfies NodeDefinition;

export async function execute(context: NodeExecutionContext<typeof definition>) {
  const p = context.props;
  const pitch = Number(context.inputs.spec?.pitchMm ?? 0.4);
  const R = maskResolution(pitch, String(context.inputs.spec?.quality ?? 'full'));
  const ref = p.image as { path?: string; mediaType?: string } | null;
  if (!ref?.path) {
    context.outputs.mask.set(emptyMask(R, 'image'));
    return;
  }
  const bytes = await context.capabilities.assets.read(ref as { path: string }, { signal: context.signal });
  const img = await decodeDarkness(bytes, ref.mediaType);
  const name = ref.path.split('/').pop() ?? 'image';
  const mode = p.mode === 'luminance' ? 'luminance' : 'threshold';
  context.outputs.mask.set(imageMask(img, { mode, threshold: p.threshold, invert: p.invert, heightMm: p.heightMm, floor: p.floor }, R, name));
}
