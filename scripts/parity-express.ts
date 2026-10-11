// typeexpr.express parity: run lib/cloudtype/express.ts on dots given as JSON
// and print the result, to compare with cloud-plots' typeexpr.express on the
// same input.
//
//   npx tsx scripts/parity-express.ts <in.json> [out.json]
//
// In: {dots: [[x, y, t], ...] (mm, y down), comp: [...], capMm, pitchMm, seed,
// params: {grid, jitter, sizeVar, ..., smearLen}} (camelCase, missing = default).
// Out: {dots: [[x, y, t], ...], comp: [...]}, to stdout unless a path is given.
import { readFileSync, writeFileSync } from 'node:fs';
import { express, type ExpressParams } from '../lib/cloudtype/express';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath) throw new Error('usage: parity-express.ts <in.json> [out.json]');
const src = JSON.parse(readFileSync(inPath, 'utf8')) as {
  dots: [number, number, number][];
  comp: number[];
  capMm: number;
  pitchMm: number;
  seed?: number;
  params?: Partial<ExpressParams>;
};
const r = express(
  src.dots.map(([x, y, t]) => ({ x, y, t })),
  src.comp,
  { capMm: src.capMm, pitchMm: src.pitchMm, seed: src.seed ?? 7 },
  src.params ?? {}
);
const out = JSON.stringify({ dots: r.dots.map((d) => [d.x, d.y, d.t]), comp: Array.from(r.comp) });
if (outPath) writeFileSync(outPath, out);
else process.stdout.write(out + '\n');
