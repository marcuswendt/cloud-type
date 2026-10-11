// Seeded random numbers. The Python original uses numpy's PCG64; the exact
// sequence is not reproduced (dot positions are not meant to match), only the
// distributions: uniform, normal, exponential, Lomax (numpy's `pareto`),
// weighted choice with replacement and choice without replacement.

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private spare: number | null = null;

  constructor(seed: number) {
    // splitmix32 to fill the sfc32 state.
    let s = (Math.floor(seed) >>> 0) ^ 0x9e3779b9;
    const next = () => {
      s = (s + 0x9e3779b9) | 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next();
    this.b = next();
    this.c = next();
    this.d = next();
    for (let i = 0; i < 12; i++) this.random();
  }

  /** Uniform [0, 1). */
  random(): number {
    let { a, b, c, d } = this;
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return (t >>> 0) / 4294967296;
  }

  uniform(lo: number, hi: number): number {
    return lo + (hi - lo) * this.random();
  }

  /** Integer in [lo, hi). */
  integers(lo: number, hi: number): number {
    return lo + Math.floor(this.random() * (hi - lo));
  }

  normal(mean = 0, sd = 1): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return mean + sd * v;
    }
    let u = 0;
    while (u <= 1e-12) u = this.random();
    const v = this.random();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return mean + sd * r * Math.cos(2 * Math.PI * v);
  }

  exponential(scale: number): number {
    return -Math.log(1 - this.random()) * scale;
  }

  /** numpy's pareto(a): Lomax, (1 - U)^(-1/a) - 1. */
  pareto(a: number): number {
    return Math.pow(1 - this.random(), -1 / a) - 1;
  }

  /** `n` indices drawn with replacement, weighted by `w`. */
  choiceWeighted(w: ArrayLike<number>, n: number): Int32Array {
    const m = w.length;
    const cum = new Float64Array(m);
    let s = 0;
    for (let i = 0; i < m; i++) {
      s += Math.max(0, w[i]);
      cum[i] = s;
    }
    const out = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      const r = this.random() * s;
      let lo = 0;
      let hi = m - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] > r) hi = mid;
        else lo = mid + 1;
      }
      out[k] = lo;
    }
    return out;
  }

  /** `n` distinct indices from [0, m). */
  choiceNoReplace(m: number, n: number): Int32Array {
    n = Math.min(n, m);
    const idx = new Int32Array(m);
    for (let i = 0; i < m; i++) idx[i] = i;
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(this.random() * (m - i));
      const t = idx[i];
      idx[i] = idx[j];
      idx[j] = t;
    }
    return idx.slice(0, n);
  }
}
