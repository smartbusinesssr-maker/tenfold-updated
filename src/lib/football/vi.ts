/** Gaussian variational inference on the BTTS logit. Not used to rank the ten. */

import { betaLogitLogPost, invLogit, logitNormalBinomLogPost } from "./mcmc.ts";

export const VI_STEPS = 80;

/** Physicist Gauss–Hermite n = 7. E[f(Z)] Z~N(0,1) = π^{-1/2} Σ w_i f(√2 x_i). */
const GH7: [number, number][] = [
  [0, 0.8102646175568073],
  [0.8162878828589647, 0.4256072526101278],
  [1.6735516287674714, 0.05451558281912705],
  [2.6519613568352334, 0.0009717812450995192],
];
const INV_SQRT_PI = 1 / Math.sqrt(Math.PI);

/** Quadrature over θ = m + s z, z ~ N(0,1). Weights already include π^{-1/2}. */
export function ghEach(
  m: number,
  s: number,
  fn: (theta: number, z: number, weight: number) => void,
): void {
  for (const [x, w] of GH7) {
    const z = Math.SQRT2 * x;
    const wn = w * INV_SQRT_PI;
    fn(m + s * z, z, wn);
    if (x !== 0) fn(m - s * z, -z, wn);
  }
}

export function ghExpect(g: (theta: number) => number, m: number, s: number): number {
  let acc = 0;
  ghEach(m, s, (th, _z, w) => {
    acc += w * g(th);
  });
  return acc;
}

function ghScoreGrad(score: (theta: number) => number, m: number, s: number): { dm: number; ds: number } {
  let dm = 0;
  let ds = 0;
  ghEach(m, s, (th, z, w) => {
    const sc = score(th);
    dm += w * sc;
    ds += w * sc * z;
  });
  return { dm, ds: ds + 1 / Math.max(s, 1e-6) };
}

function entropyGaussian(s: number): number {
  return 0.5 * (1 + Math.log(2 * Math.PI * s * s));
}

export function elboParts(
  logPost: (theta: number) => number,
  m: number,
  s: number,
): { energy: number; entropy: number; elbo: number } {
  const energy = ghExpect(logPost, m, s);
  const entropy = entropyGaussian(s);
  return { energy, entropy, elbo: energy + entropy };
}

export function betaLogitScore(theta: number, alpha: number, beta: number): number {
  return alpha - (alpha + beta) * invLogit(theta);
}

export function betaLogitScorePrime(theta: number, alpha: number, beta: number): number {
  const p = invLogit(theta);
  return -(alpha + beta) * p * (1 - p);
}

export function logitNormalScore(
  theta: number,
  muLogit: number,
  tau: number,
  y: number,
  n: number,
): number {
  return -(theta - muLogit) / Math.max(tau * tau, 1e-8) + y - n * invLogit(theta);
}

export interface ViFit {
  meanP: number;
  modeP: number;
  m: number;
  s: number;
  elbo: number;
  energy: number;
  entropy: number;
  dm: number;
  ds: number;
  elboPath: number[];
  lo: number;
  hi: number;
}

export function fitGaussianVi(opts: {
  logPost: (theta: number) => number;
  score: (theta: number) => number;
  init: number;
  steps?: number;
  lr?: number;
}): ViFit {
  const steps = opts.steps ?? VI_STEPS;
  const lr = opts.lr ?? 0.12;
  let m = opts.init;
  let logS = Math.log(0.55);
  const elboPath: number[] = [];

  for (let t = 0; t < steps; t++) {
    const s = Math.min(2.2, Math.max(0.06, Math.exp(logS)));
    const { dm, ds } = ghScoreGrad(opts.score, m, s);
    const decay = 1 / Math.sqrt(1 + t / 12);
    m += lr * decay * dm;
    logS += lr * decay * (ds * s);
    const sNow = Math.min(2.2, Math.max(0.06, Math.exp(logS)));
    elboPath.push(ghExpect(opts.logPost, m, sNow) + entropyGaussian(sNow));
  }

  const s = Math.min(2.2, Math.max(0.06, Math.exp(logS)));
  const meanP = ghExpect(invLogit, m, s);
  const parts = elboParts(opts.logPost, m, s);
  const grad = ghScoreGrad(opts.score, m, s);
  return {
    meanP,
    modeP: invLogit(m),
    m,
    s,
    elbo: parts.elbo,
    energy: parts.energy,
    entropy: parts.entropy,
    dm: grad.dm,
    ds: grad.ds,
    elboPath,
    lo: invLogit(m - 1.96 * s),
    hi: invLogit(m + 1.96 * s),
  };
}

/** Laplace on the conjugate Beta-on-logit. Mode is logit(α/(α+β)). */
export function laplaceBeta(alpha: number, beta: number): { m: number; s: number; modeP: number } {
  const p = alpha / (alpha + beta);
  const m = Math.log(Math.max(p, 1e-6) / Math.max(1 - p, 1e-6));
  const hess = Math.max((alpha + beta) * p * (1 - p), 1e-6);
  return { m, s: 1 / Math.sqrt(hess), modeP: p };
}

export function runBttsVi(opts: {
  alpha: number;
  beta: number;
  mu: number;
  tau?: number;
  hits: number;
  n: number;
}): { conjugate: ViFit; logitNormal: ViFit; laplace: ReturnType<typeof laplaceBeta> } {
  const muLogit = Math.log(Math.max(opts.mu, 1e-4) / Math.max(1 - opts.mu, 1e-4));
  const tau = opts.tau ?? 0.35;
  const laplace = laplaceBeta(opts.alpha, opts.beta);
  const conjugate = fitGaussianVi({
    logPost: (th) => betaLogitLogPost(th, opts.alpha, opts.beta),
    score: (th) => betaLogitScore(th, opts.alpha, opts.beta),
    init: laplace.m,
  });
  const logitNormal = fitGaussianVi({
    logPost: (th) => logitNormalBinomLogPost(th, muLogit, tau, opts.hits, opts.n),
    score: (th) => logitNormalScore(th, muLogit, tau, opts.hits, opts.n),
    init: muLogit,
  });
  return { conjugate, logitNormal, laplace };
}
