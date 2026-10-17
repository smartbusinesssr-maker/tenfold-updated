/** Random-walk Metropolis–Hastings for the BTTS posterior. Not used to rank the ten. */

export const MCMC_DRAWS = 600;
export const MCMC_BURN = 200;
export const MCMC_STEP = 0.4;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function log1pexp(z: number): number {
  if (z > 20) return z;
  if (z < -20) return Math.exp(z);
  return Math.log1p(Math.exp(z));
}

export function invLogit(z: number): number {
  if (z >= 20) return 1;
  if (z <= -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

/** Beta(α, β) on the logit: log π(θ) = α θ − (α+β) log(1+e^θ). Jacobian included. */
export function betaLogitLogPost(theta: number, alpha: number, beta: number): number {
  return alpha * theta - (alpha + beta) * log1pexp(theta);
}

/** Non-conjugate: θ ~ N(m, τ²), y ~ Bin(n, invlogit θ). */
export function logitNormalBinomLogPost(
  theta: number,
  muLogit: number,
  tau: number,
  y: number,
  n: number,
): number {
  const z = theta - muLogit;
  return -0.5 * (z * z) / Math.max(tau * tau, 1e-8) + y * theta - n * log1pexp(theta);
}

export function randomWalkMh(opts: {
  logPost: (x: number) => number;
  init: number;
  step: number;
  draws: number;
  rng: () => number;
}): { x: number[]; accept: number } {
  const x = new Array<number>(opts.draws);
  let cur = opts.init;
  let lp = opts.logPost(cur);
  let acc = 0;
  for (let i = 0; i < opts.draws; i++) {
    const prop = cur + opts.step * gaussian(opts.rng);
    const lpp = opts.logPost(prop);
    if (lpp >= lp || Math.log(Math.max(opts.rng(), 1e-16)) < lpp - lp) {
      cur = prop;
      lp = lpp;
      acc += 1;
    }
    x[i] = cur;
  }
  return { x, accept: acc / opts.draws };
}

function mean(xs: number[]): number {
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

function sampleVar(xs: number[]): number {
  const m = mean(xs);
  let s = 0;
  for (const v of xs) s += (v - m) ** 2;
  return s / Math.max(1, xs.length - 1);
}

export function gelmanRubin(chains: number[][]): number {
  const m = chains.length;
  const n = chains[0]?.length ?? 0;
  if (m < 2 || n < 4) return 1;
  const means = chains.map(mean);
  const grand = mean(means);
  const W = mean(chains.map(sampleVar));
  let b = 0;
  for (const mu of means) b += (mu - grand) ** 2;
  const B = (n / (m - 1)) * b;
  if (W <= 1e-18) return B > 1e-12 ? 99 : 1;
  const V = ((n - 1) / n) * W + B / n;
  return Math.sqrt(V / W);
}

export function effectiveSampleSize(xs: number[]): number {
  if (xs.length < 8) return xs.length;
  const m = mean(xs);
  let den = 0;
  for (const v of xs) den += (v - m) ** 2;
  if (den <= 1e-18) return xs.length;
  let sumRho = 0;
  const maxLag = Math.min(80, Math.floor(xs.length / 4));
  for (let lag = 1; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = 0; i + lag < xs.length; i++) num += (xs[i] - m) * (xs[i + lag] - m);
    const rho = num / den;
    if (rho < 0.05) break;
    sumRho += rho;
  }
  return xs.length / (1 + 2 * sumRho);
}

function quantile(xs: number[], q: number): number {
  const s = xs.slice().sort((a, b) => a - b);
  const i = clampIndex(Math.floor(q * (s.length - 1)), 0, s.length - 1);
  return s[i]!;
}

function clampIndex(i: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, i));
}

export interface ChainSummary {
  mean: number;
  lo: number;
  hi: number;
  rHat: number;
  accept: number;
  ess: number;
  traces: number[][];
}

function summarize(thetaChains: number[][], accept: number): ChainSummary {
  const pChains = thetaChains.map((c) => c.map(invLogit));
  const flat = pChains.flat();
  return {
    mean: mean(flat),
    lo: quantile(flat, 0.025),
    hi: quantile(flat, 0.975),
    rHat: gelmanRubin(pChains),
    accept,
    ess: mean(pChains.map(effectiveSampleSize)),
    traces: pChains,
  };
}

export function sampleGamma(shape: number, rng: () => number): number {
  if (shape < 1) {
    const u = Math.max(rng(), 1e-12);
    return sampleGamma(shape + 1, rng) * u ** (1 / Math.max(shape, 1e-8));
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = gaussian(rng);
    let v = 1 + c * x;
    if (v <= 0) continue;
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(Math.max(u, 1e-16)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(alpha: number, beta: number, rng: () => number): number {
  const g1 = sampleGamma(Math.max(alpha, 1e-6), rng);
  const g2 = sampleGamma(Math.max(beta, 1e-6), rng);
  return g1 / (g1 + g2);
}

export function runBttsMcmc(opts: {
  alpha: number;
  beta: number;
  mu: number;
  tau?: number;
  hits: number;
  n: number;
  draws?: number;
  burn?: number;
  step?: number;
  seed?: number;
}): { conjugate: ChainSummary; logitNormal: ChainSummary; gibbsMean: number } {
  const draws = opts.draws ?? MCMC_DRAWS;
  const burn = opts.burn ?? MCMC_BURN;
  const step = Math.max(0.02, opts.step ?? MCMC_STEP);
  const tau = opts.tau ?? 0.35;
  const total = draws + burn;
  const muLogit = Math.log(Math.max(opts.mu, 1e-4) / Math.max(1 - opts.mu, 1e-4));
  const y = opts.hits;
  const n = opts.n;

  function twoChains(
    logPost: (th: number) => number,
    inits: [number, number],
    seed: number,
  ): ChainSummary {
    const runs = inits.map((init, i) =>
      randomWalkMh({
        logPost,
        init,
        step,
        draws: total,
        rng: mulberry32(seed + i * 9973),
      }),
    );
    const kept = runs.map((r) => r.x.slice(burn));
    const accept = (runs[0]!.accept + runs[1]!.accept) / 2;
    return summarize(kept, accept);
  }

  const conjugate = twoChains(
    (th) => betaLogitLogPost(th, opts.alpha, opts.beta),
    [muLogit - 0.8, muLogit + 0.8],
    opts.seed ?? 1,
  );

  const logitNormal = twoChains(
    (th) => logitNormalBinomLogPost(th, muLogit, tau, y, n),
    [muLogit - 0.8, muLogit + 0.8],
    (opts.seed ?? 1) + 17,
  );

  const rng = mulberry32((opts.seed ?? 1) + 99);
  let g = 0;
  const gN = 400;
  for (let i = 0; i < gN; i++) g += sampleBeta(opts.alpha, opts.beta, rng);
  return { conjugate, logitNormal, gibbsMean: g / gN };
}
