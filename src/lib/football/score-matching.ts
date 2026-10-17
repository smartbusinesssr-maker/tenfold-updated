/** Score matching alternatives to the ELBO. Not used to rank the ten. */

import { gaussian, invLogit, mulberry32, sampleBeta } from "./mcmc.ts";
import {
  betaLogitScore,
  betaLogitScorePrime,
  ghEach,
  ghExpect,
  laplaceBeta,
} from "./vi.ts";

export const SM_STEPS = 80;
export const DSM_SIGMA = 0.35;
export const SM_SAMPLES = 400;

export interface SmFit {
  meanP: number;
  modeP: number;
  m: number;
  s: number;
  fisherJ: number;
  path: number[];
  lo: number;
  hi: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function mean(xs: number[]): number {
  let s = 0;
  for (const v of xs) s += v;
  return s / Math.max(1, xs.length);
}

function variance(xs: number[]): number {
  const m = mean(xs);
  let s = 0;
  for (const v of xs) s += (v - m) * (v - m);
  return s / Math.max(1, xs.length);
}

function log1pexp(z: number): number {
  if (z > 20) return z;
  if (z < -20) return Math.exp(z);
  return Math.log1p(Math.exp(z));
}

function logit(p: number): number {
  const q = clamp(p, 1e-6, 1 - 1e-6);
  return Math.log(q / (1 - q));
}

/** ½ E_q[(∇log q − ∇log π)²]. Hyvärinen (2005) Fisher divergence. */
export function fisherDiv(score: (theta: number) => number, m: number, s: number): number {
  const s2 = Math.max(s * s, 1e-8);
  return (
    0.5 *
    ghExpect((th) => {
      const d = -(th - m) / s2 - score(th);
      return d * d;
    }, m, s)
  );
}

export function fisherGrad(
  score: (theta: number) => number,
  scorePrime: (theta: number) => number,
  m: number,
  s: number,
): { J: number; dm: number; ds: number } {
  const sSafe = Math.max(s, 1e-6);
  const s2 = sSafe * sSafe;
  let J = 0;
  let dm = 0;
  let ds = 0;
  ghEach(m, sSafe, (th, z, w) => {
    const r = -z / sSafe - score(th);
    const dScore = scorePrime(th);
    J += w * 0.5 * r * r;
    dm += w * r * -dScore;
    ds += w * r * (z / s2 - dScore * z);
  });
  return { J, dm, ds };
}

export function fitFisherVi(opts: {
  score: (theta: number) => number;
  scorePrime: (theta: number) => number;
  init: number;
  initS?: number;
  steps?: number;
  lr?: number;
}): SmFit {
  const steps = opts.steps ?? SM_STEPS;
  const lr = opts.lr ?? 0.08;
  let m = opts.init;
  let logS = Math.log(opts.initS ?? 0.55);
  const path: number[] = [];

  for (let t = 0; t < steps; t++) {
    const s = clamp(Math.exp(logS), 0.06, 2.2);
    const { J, dm, ds } = fisherGrad(opts.score, opts.scorePrime, m, s);
    const decay = 1 / Math.sqrt(1 + t / 12);
    m -= lr * decay * clamp(dm, -8, 8);
    logS -= lr * decay * clamp(ds * s, -8, 8);
    path.push(J);
  }

  const s = clamp(Math.exp(logS), 0.06, 2.2);
  const { J } = fisherGrad(opts.score, opts.scorePrime, m, s);
  return {
    meanP: ghExpect(invLogit, m, s),
    modeP: invLogit(m),
    m,
    s,
    fisherJ: J,
    path,
    lo: invLogit(m - 1.96 * s),
    hi: invLogit(m + 1.96 * s),
  };
}

/** Explicit Hyvärinen J on samples: E[½ (∇log q)² + Δ log q]. */
export function hyvarinenJ(samples: number[], m: number, s: number): number {
  const s2 = Math.max(s * s, 1e-8);
  let acc = 0;
  for (const x of samples) {
    const sq = -(x - m) / s2;
    acc += 0.5 * sq * sq - 1 / s2;
  }
  return acc / Math.max(1, samples.length);
}

/** For a Gaussian, Hyvärinen SM = moment matching (MLE). */
export function hyvarinenGaussian(samples: number[]): SmFit {
  const m = mean(samples);
  const s = Math.sqrt(Math.max(variance(samples), 1e-6));
  return packSamples(m, s, samples);
}

/**
 * Vincent (2011) DSM, Gaussian q. Closed form: m = E[θ], s² = Var(θ) + σ².
 * The extra σ² is the noise tax — Song & Ermon anneal it away.
 */
export function dsmGaussian(samples: number[], sigma = DSM_SIGMA): SmFit & { debiasedS: number } {
  const m = mean(samples);
  const v = variance(samples);
  const s = Math.sqrt(Math.max(v + sigma * sigma, 1e-6));
  const fit = packSamples(m, s, samples);
  return { ...fit, debiasedS: Math.sqrt(Math.max(v, 1e-6)) };
}

function packSamples(m: number, s: number, _samples: number[]): SmFit {
  return {
    meanP: ghExpect(invLogit, m, s),
    modeP: invLogit(m),
    m,
    s,
    fisherJ: 0,
    path: [],
    lo: invLogit(m - 1.96 * s),
    hi: invLogit(m + 1.96 * s),
  };
}

function logNormal(x: number, m: number, s: number): number {
  const z = (x - m) / Math.max(s, 1e-6);
  return -0.5 * Math.log(2 * Math.PI) - Math.log(Math.max(s, 1e-6)) - 0.5 * z * z;
}

function logSigmoid(z: number): number {
  if (z > 20) return 0;
  if (z < -20) return z;
  return -log1pexp(-z);
}

/** Gutmann–Hyvärinen NCE logistic loss vs N(m_n, s_n²) noise. Lower is a better fit. */
export function nceLoss(
  logq: (x: number) => number,
  data: number[],
  noise: number[],
  logNoise: (x: number) => number,
): number {
  let acc = 0;
  for (const x of data) acc += -logSigmoid(logq(x) - logNoise(x));
  for (const y of noise) acc += -logSigmoid(logNoise(y) - logq(y));
  return acc / Math.max(1, data.length + noise.length);
}

export function drawLogitBeta(alpha: number, beta: number, n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = logit(sampleBeta(alpha, beta, rng));
  return out;
}

export function scoreCurve(
  score: (theta: number) => number,
  m: number,
  s: number,
  points = 48,
): { theta: number; q: number; pi: number }[] {
  const lo = m - 3 * s;
  const span = 6 * Math.max(s, 0.2);
  const out: { theta: number; q: number; pi: number }[] = [];
  const s2 = Math.max(s * s, 1e-8);
  for (let i = 0; i < points; i++) {
    const theta = lo + (span * i) / (points - 1);
    out.push({ theta, q: -(theta - m) / s2, pi: score(theta) });
  }
  return out;
}

export function runBttsScoreMatch(opts: {
  alpha: number;
  beta: number;
  elboM: number;
  elboS: number;
  seed?: number;
}): {
  fisher: SmFit;
  hyvarinen: SmFit;
  dsm: SmFit & { debiasedS: number };
  laplace: { m: number; s: number; modeP: number; fisherJ: number };
  elboFisherJ: number;
  nce: { fisher: number; elbo: number; hyvarinen: number };
  curve: { theta: number; q: number; pi: number }[];
} {
  const score = (th: number) => betaLogitScore(th, opts.alpha, opts.beta);
  const scorePrime = (th: number) => betaLogitScorePrime(th, opts.alpha, opts.beta);
  const laplace = laplaceBeta(opts.alpha, opts.beta);
  const fisher = fitFisherVi({
    score,
    scorePrime,
    init: laplace.m,
    initS: laplace.s,
  });
  const samples = drawLogitBeta(opts.alpha, opts.beta, SM_SAMPLES, opts.seed ?? 11);
  const hyvarinen = hyvarinenGaussian(samples);
  hyvarinen.fisherJ = fisherDiv(score, hyvarinen.m, hyvarinen.s);
  const dsm = dsmGaussian(samples);
  dsm.fisherJ = fisherDiv(score, dsm.m, dsm.s);

  const noiseRng = mulberry32((opts.seed ?? 11) + 3);
  const noiseM = mean(samples);
  const noiseS = 1.2;
  const noise: number[] = [];
  for (let i = 0; i < samples.length; i++) noise.push(noiseM + noiseS * gaussian(noiseRng));
  const logN = (x: number) => logNormal(x, noiseM, noiseS);

  return {
    fisher,
    hyvarinen,
    dsm,
    laplace: { ...laplace, fisherJ: fisherDiv(score, laplace.m, laplace.s) },
    elboFisherJ: fisherDiv(score, opts.elboM, opts.elboS),
    nce: {
      fisher: nceLoss((x) => logNormal(x, fisher.m, fisher.s), samples, noise, logN),
      elbo: nceLoss((x) => logNormal(x, opts.elboM, opts.elboS), samples, noise, logN),
      hyvarinen: nceLoss((x) => logNormal(x, hyvarinen.m, hyvarinen.s), samples, noise, logN),
    },
    curve: scoreCurve(score, fisher.m, fisher.s),
  };
}
