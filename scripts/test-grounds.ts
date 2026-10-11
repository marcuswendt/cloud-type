// Every ground gives a visible export: cook the real graph headlessly, decode
// the PNG it wrote, and measure the dots against the ground.
//
//   npx tsx scripts/test-grounds.ts
//
// Default ink must switch to light on black (the regression this guards), stay
// dark on white and on transparent, and an explicitly chosen colour is kept.
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRuntime } from 'cascade/runtime';
import { createNodeRuntimeHost } from 'cascade/runtime/node';
import { installIoBridge } from 'cascade/io';
import type { AssetRef, ImageRef } from 'cascade/contracts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Skia, from Cascade's own optional dependency: the same renderer `cascade run` uses.
const skia = createRequire(path.join(root, 'node_modules', 'cascade', 'package.json'))('@napi-rs/canvas');
Object.assign(globalThis, { OffscreenCanvas: class { constructor(w: number, h: number) { return skia.createCanvas(w, h); } } });

const scratch = mkdtempSync(path.join(os.tmpdir(), 'cloud-type-grounds-'));
const files = new Map<string, Uint8Array>();
installIoBridge({
  async read(p: string) { return new Uint8Array(readFileSync(path.join(root, p))); },
  async write(p: string, data: Uint8Array) { files.set(p, data); mkdirSync(path.dirname(path.join(scratch, p)), { recursive: true }); writeFileSync(path.join(scratch, p), data); return p; },
});

const doc = JSON.parse(readFileSync(path.join(root, 'cloud-type.cascade'), 'utf8'));
const registrations = [];
for (const dir of readdirSync(path.join(root, 'nodes'))) {
  const mod = await import(pathToFileURL(path.join(root, 'nodes', dir, 'index.ts')).href);
  registrations.push({ kind: 'definition-v1' as const, moduleId: `project.${dir}`, definition: mod.definition, loadExecute: async () => mod.execute });
}
const byId = new Map(registrations.map((r) => [r.moduleId, r]));
const host = createNodeRuntimeHost({
  modules: { resolve: async (id: string) => byId.get(id) ?? null },
  assets: {
    async read(ref: AssetRef) { return new Uint8Array(readFileSync(path.join(root, ref.path))); },
    async write() { throw new Error('no asset writes'); },
  },
});
const runtime = createRuntime({ host, nodes: registrations as never });
const graph = await runtime.load(doc);
// 600 dpi: a pen-point dot is about 2.4 px across, so its centre is solid ink.
await graph.setProp('png', 'dpi', 600);

const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
async function measure(ground: string, colour?: number[]) {
  await graph.setProp('png', 'ground', ground);
  if (colour) await graph.setProp('style', 'colour', colour);
  const result = await graph.run({ target: { kind: 'node', nodeId: 'png' } });
  if (result.status !== 'completed') throw new Error(result.diagnostics.map((d) => d.message).join('; '));
  const ref = graph.getOutput('png', 'image') as ImageRef;
  const image = await skia.loadImage(Buffer.from(files.get(ref.path)!));
  const canvas = skia.createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, image.width, image.height).data;
  // Ground: the corner pixel. Dots: pixels that differ from it. Their ink is
  // the 5 % most different, which are dot centres rather than antialiased rims.
  const groundL = luminance(px[0], px[1], px[2]);
  const groundA = px[3] / 255;
  const found: { l: number; d: number; red: number }[] = [];
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255;
    const l = luminance(px[i], px[i + 1], px[i + 2]);
    const d = groundA < 0.5 ? a : Math.abs(l - groundL);
    if (d > 0.25) found.push({ l, d, red: px[i] - px[i + 2] });
  }
  found.sort((x, y) => y.d - x.d);
  const core = found.slice(0, Math.max(1, Math.round(found.length * 0.05)));
  const n = found.length;
  const sum = core.reduce((t, p) => t + p.l, 0) * (n ? 1 : NaN);
  const red = core.reduce((t, p) => t + p.red, 0);
  return { groundL, groundA, dots: n, dotL: sum / core.length, redness: red / core.length };
}

const failures: string[] = [];
const expect = (ok: boolean, message: string) => { if (!ok) failures.push(message); console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`); };

const white = await measure('white');
expect(white.dots > 1000 && white.groundL > 0.95 && white.dotL < 0.2, `white ground: ${white.dots} dark dot px (L ${white.dotL.toFixed(2)}) on L ${white.groundL.toFixed(2)}`);
const black = await measure('black');
expect(black.dots > 1000 && black.groundL < 0.05 && black.dotL > 0.8, `black ground: ${black.dots} light dot px (L ${black.dotL.toFixed(2)}) on L ${black.groundL.toFixed(2)}`);
const clear = await measure('transparent');
expect(clear.dots > 1000 && clear.groundA === 0 && clear.dotL < 0.2, `transparent ground: ${clear.dots} opaque dark dot px (L ${clear.dotL.toFixed(2)}), ground alpha ${clear.groundA}`);
expect(Math.abs(white.dots - black.dots) / white.dots < 0.15, `same dots on white and black (${white.dots} vs ${black.dots})`);
const custom = await measure('black', [0.8, 0.1, 0.1, 1]);
expect(custom.dots > 1000 && custom.redness > 100, `explicit colour is kept on black (red-blue ${custom.redness.toFixed(0)})`);

await runtime.dispose();
rmSync(scratch, { recursive: true, force: true });
if (failures.length) { console.error(`${failures.length} ground check(s) failed`); process.exit(1); }
