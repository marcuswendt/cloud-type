// The graph's final page dots, by running cloud-type.cascade through Cascade's
// own runtime (the same createRuntime + definition-v1 registrations `cascade
// run` uses), with a preset from the document's editor section applied.
//
//   npx tsx scripts/parity-dots.ts <preset-id> <out.json> [font.otf]
//
// Output matches the standalone's scripts/dots.ts: {settings, page, pitch,
// dot_mm, dots: [[x, y, size], ...]} in page mm (y down), float32 like the
// standalone's Result. A font path is read in place (the licensed font stays
// where it is; nothing is copied).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRuntime } from 'cascade/runtime';
import { createNodeRuntimeHost } from 'cascade/runtime/node';
import type { AssetRef, Geometry } from 'cascade/contracts';
import { pageDots } from '../lib/cloudtype/page';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [presetId, out, fontPath] = process.argv.slice(2);
if (!presetId || !out) throw new Error('usage: parity-dots.ts <preset-id> <out.json> [font.otf]');

const doc = JSON.parse(readFileSync(path.join(root, 'cloud-type.cascade'), 'utf8'));
const editor = doc.editor;
const preset = editor.presets.find((p: { id: string }) => p.id === presetId);
if (!preset) throw new Error(`preset? ${editor.presets.map((p: { id: string }) => p.id).join(' ')}`);

// Every project node, registered the way the CLI registers definition-v1 modules.
const registrations = [];
for (const dir of readdirSync(path.join(root, 'nodes'))) {
  const mod = await import(pathToFileURL(path.join(root, 'nodes', dir, 'index.ts')).href);
  registrations.push({ kind: 'definition-v1' as const, moduleId: `project.${dir}`, definition: mod.definition, loadExecute: async () => mod.execute });
}
const byId = new Map(registrations.map((r) => [r.moduleId, r]));
const host = createNodeRuntimeHost({
  modules: { resolve: async (id: string) => byId.get(id) ?? null },
  assets: {
    async read(ref: AssetRef) {
      const p = path.isAbsolute(ref.path) ? ref.path : path.join(root, ref.path);
      return new Uint8Array(readFileSync(p));
    },
    async write() {
      throw new Error('parity: no writes');
    }
  }
});
const runtime = createRuntime({ host, nodes: registrations as never });
const graph = await runtime.load(doc);

// The preset, as published parameter values onto their node props.
const params = new Map<string, { node: string; prop: string }>(editor.parameters.map((p: { id: string; node: string; prop: string }) => [p.id, p]));
for (const [id, value] of Object.entries(preset.values)) {
  const p = params.get(id);
  if (!p) throw new Error(`unknown parameter ${id}`);
  await graph.setProp(p.node, p.prop, value);
}
if (fontPath) await graph.setProp('type-set', 'font', { path: path.resolve(fontPath), mediaType: 'font/otf' });

const t0 = performance.now();
const svgOut = process.env.SVG;
const result = await graph.run({ target: { kind: 'node', nodeId: 'page' } });
const ms = performance.now() - t0;
if (result.status !== 'completed') throw new Error(`run ${result.status}: ${result.diagnostics.map((d) => d.message).join('; ')}`);
const g = graph.getOutput('page', 'points') as Geometry;
const r = pageDots(g);
const dots: number[][] = [];
for (let i = 0; i < r.count; i++) dots.push([r.dots[3 * i], r.dots[3 * i + 1], r.dots[3 * i + 2]]);
const spec = graph.getOutput('spec', 'spec') as { pitchMm: number };
const look = graph.getOutput('look', 'look') as { defocus: number; fade: number; dof: number; span: number; tone: number };
const v = preset.values;

// The settings in the standalone's shape, for scripts/parity.py.
const settings = {
  name: preset.label, text: v.text, capMm: v.capMm, leading: v.leading, tracking: v.tracking, width: v.width,
  indents: String(v.indents ?? '').split(/[ ,;]+/).filter(Boolean).map(Number),
  tone: look.tone, growth: v.growth, seed: v.seed, penMm: 0.1, dotSize: v.dotSize,
  focus: {
    field: v.field, centerX: v.centre[0], centerY: v.centre[1], angle: v.angle, dof: look.dof, span: look.span, defocus: look.defocus,
    bokeh: v.bokeh, cat: v.cat, rim: v.rim, fade: look.fade, rings: v.rings, ringTone: v.ringTone, reticle: v.reticle, scale: v.scale
  },
  blown: { amount: v.blowAmount, angle: v.blowAngle, distance: v.blowDistance }
};
let smin = Infinity, smax = 0;
for (const d of dots) { smin = Math.min(smin, d[2]); smax = Math.max(smax, d[2]); }
writeFileSync(out, JSON.stringify({ settings, page: r.pageMm, pitch: spec.pitchMm, dot_mm: Number(g.detail.dotMm), dots, ms, sizeRange: [smin, smax] }));
console.log(presetId, 'dots', r.count, 'ms', Math.round(ms), 'page', r.pageMm.map((x) => x.toFixed(1)).join('x'), 'pitch', spec.pitchMm.toFixed(3));
if (svgOut) {
  // The two SVG outputs, for a byte comparison with the standalone's SVG=... run.
  await graph.run({ target: { kind: 'node', nodeId: 'plot-svg' } });
  await graph.run({ target: { kind: 'node', nodeId: 'preview-svg' } });
  writeFileSync(svgOut, String(graph.getOutput('plot-svg', 'svg')));
  writeFileSync(svgOut.replace(/\.svg$/, '-preview.svg'), String(graph.getOutput('preview-svg', 'svg')));
}
await graph.dispose();
await runtime.dispose();
