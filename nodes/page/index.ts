// page: the dots placed on the page. Fit wraps them with a margin (measured to
// the dots' rims); custom sets the page size and puts the first baseline's left
// edge at the text origin. The page size is the detail attribute pageMm.
import type { NodeDefinition, NodeExecutionContext } from 'cascade/contracts';
import { createGeometry } from 'cascade/contracts';
import { pointAttr } from '../../lib/cloudtype/geo';

export const definition = {
  apiVersion: 1,
  label: 'Page',
  description: 'Place the dots on a fitted or custom page.',
  icon: 'File',
  runsOn: 'portable',
  inputs: {
    points: { kind: 'data', type: 'geometry' }
  },
  props: {
    mode: { type: 'string', default: 'fit', control: 'select', label: 'Page', options: [{ value: 'fit', label: 'fit' }, { value: 'custom', label: 'custom' }] },
    marginMm: { type: 'float', default: 5, min: 0, max: 40, step: 0.5, label: 'Margin', description: 'mm' },
    pageSize: { type: 'vec2', default: [194, 256], min: 20, max: 600, step: 0.5, label: 'Page size', description: 'width, height in mm' },
    textOrigin: { type: 'vec2', default: [38.791, 23.594], min: -50, max: 500, step: 0.001, label: 'Text origin', description: 'text x and first baseline, mm' }
  },
  outputs: {
    points: { kind: 'data', type: 'geometry', description: 'Dots in page mm (+Y up: y = -page y); detail pageMm' }
  }
} as const satisfies NodeDefinition;

export function execute(context: NodeExecutionContext<typeof definition>) {
  const g = context.inputs.points;
  if (!g) return;
  const p = context.props;
  const n = g.pointCount;
  const P = g.point.P.data;
  const sizes = pointAttr(g, 'size') ?? new Float64Array(n);
  let dx = 0, dy = 0;
  let page: [number, number];
  if (p.mode === 'custom') {
    dx = p.textOrigin[0];
    dy = p.textOrigin[1];
    page = [p.pageSize[0], p.pageSize[1]];
  } else {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const r = sizes[i] / 2, x = P[2 * i], y = -P[2 * i + 1];
      x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r);
      x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r);
    }
    if (!n) { x0 = y0 = 0; x1 = y1 = 10; }
    const m = p.marginMm;
    dx = m - x0;
    dy = m - y0;
    page = [Math.round((x1 - x0 + 2 * m) * 1000) / 1000, Math.round((y1 - y0 + 2 * m) * 1000) / 1000];
  }
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    out[2 * i] = P[2 * i] + dx;
    out[2 * i + 1] = -(-P[2 * i + 1] + dy);
  }
  context.outputs.points.set(createGeometry({
    pointCount: n,
    point: { ...g.point, P: { storage: 'f64', size: 2, data: out } },
    detail: { ...g.detail, pageMm: page }
  }));
}
