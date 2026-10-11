// Compare two dots JSON files (scripts/parity-dots.ts or the standalone's
// scripts/dots.ts): counts, median nearest-neighbour spacing, page, and the
// largest per-dot difference when the two have the same count.
//   npx tsx scripts/compare-dots.ts <a.json> <b.json>
import { readFileSync } from 'node:fs';

type Doc = { page: [number, number]; dots: [number, number, number][] };
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')) as Doc);

function medianNN(d: [number, number, number][]): number {
  const cell = 1;
  const grid = new Map<string, number[]>();
  d.forEach(([x, y], i) => {
    const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
  });
  const nn: number[] = [];
  d.forEach(([x, y], i) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    let best = Infinity;
    for (let r = 1; r < 50 && (best === Infinity || r <= Math.ceil(Math.sqrt(best) / cell) + 1); r++) {
      for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) {
        for (const j of grid.get(`${xx},${yy}`) ?? []) {
          if (j === i) continue;
          const dd = (d[j][0] - x) ** 2 + (d[j][1] - y) ** 2;
          if (dd < best) best = dd;
        }
      }
    }
    nn.push(Math.sqrt(best));
  });
  nn.sort((p, q) => p - q);
  return nn[nn.length >> 1];
}

const line = (name: string, d: Doc) => `${name}: ${d.dots.length} dots, median NN ${medianNN(d.dots).toFixed(4)} mm, page ${d.page.map((v) => v.toFixed(3)).join(' x ')}`;
console.log(line('a', a));
console.log(line('b', b));
if (a.dots.length === b.dots.length) {
  let m = 0;
  for (let i = 0; i < a.dots.length; i++) for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.dots[i][c] - b.dots[i][c]));
  console.log(m === 0 ? 'identical: every dot, every size' : `same count, max difference ${m.toExponential(3)} mm`);
} else {
  console.log(`counts differ by ${(((b.dots.length - a.dots.length) / a.dots.length) * 100).toFixed(2)} %`);
}
