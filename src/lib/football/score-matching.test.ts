import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { betaLogitLogPost } from "./mcmc.ts";
import {
  betaLogitScore,
  betaLogitScorePrime,
  fitGaussianVi,
  laplaceBeta,
} from "./vi.ts";
import {
  dsmGaussian,
  drawLogitBeta,
  fisherDiv,
  fitFisherVi,
  hyvarinenGaussian,
  hyvarinenJ,
  nceLoss,
  runBttsScoreMatch,
} from "./score-matching.ts";

describe("Score matching", () => {
  it("Fisher divergence of N(0,1) against its own score is ~0", () => {
    const j = fisherDiv((th) => -th, 0, 1);
    assert.ok(Math.abs(j) < 1e-6, `J ${j}`);
  });

  it("Fisher VI recovers the symmetric Beta mean", () => {
    const alpha = 6;
    const beta = 6;
    const fit = fitFisherVi({
      score: (th) => betaLogitScore(th, alpha, beta),
      scorePrime: (th) => betaLogitScorePrime(th, alpha, beta),
      init: 0.4,
    });
    assert.ok(Math.abs(fit.meanP - 0.5) < 0.04, `Fisher meanP ${fit.meanP}`);
    assert.ok(fit.path.length > 4);
    assert.ok(fit.path[fit.path.length - 1]! <= fit.path[0]! + 0.05);
    assert.ok(fit.fisherJ < 0.15, `J ${fit.fisherJ}`);
  });

  it("Hyvärinen on Gaussian samples recovers mean and sd", () => {
    const samples = drawLogitBeta(8, 8, 500, 3);
    const fit = hyvarinenGaussian(samples);
    const m = samples.reduce((a, b) => a + b, 0) / samples.length;
    assert.ok(Math.abs(fit.m - m) < 1e-12);
    const j = hyvarinenJ(samples, fit.m, fit.s);
    const jBad = hyvarinenJ(samples, fit.m + 0.8, fit.s);
    assert.ok(j < jBad, `J ${j} vs ${jBad}`);
  });

  it("DSM Gaussian is wider than Hyvärinen by about σ", () => {
    const samples = [0, 0.2, -0.1, 0.05, -0.05, 0.15];
    const h = hyvarinenGaussian(samples);
    const d = dsmGaussian(samples, 0.4);
    assert.ok(Math.abs(d.m - h.m) < 1e-12);
    assert.ok(d.s > h.s);
    assert.ok(Math.abs(d.s * d.s - (h.s * h.s + 0.16)) < 1e-10);
    assert.ok(Math.abs(d.debiasedS - h.s) < 1e-10);
  });

  it("on a skewed Beta, ELBO matches E[p] and Fisher sits nearer Laplace", () => {
    const alpha = 10;
    const beta = 3;
    const exact = alpha / (alpha + beta);
    const elbo = fitGaussianVi({
      logPost: (th) => betaLogitLogPost(th, alpha, beta),
      score: (th) => betaLogitScore(th, alpha, beta),
      init: 0,
    });
    const out = runBttsScoreMatch({
      alpha,
      beta,
      elboM: elbo.m,
      elboS: elbo.s,
      seed: 5,
    });
    assert.ok(Math.abs(elbo.meanP - exact) < 0.04, `ELBO ${elbo.meanP}`);
    const lap = laplaceBeta(alpha, beta);
    assert.ok(
      Math.abs(out.fisher.modeP - lap.modeP) < 0.06,
      `Fisher mode ${out.fisher.modeP} vs Laplace ${lap.modeP}`,
    );
    assert.ok(
      out.fisher.fisherJ <= out.elboFisherJ + 0.08,
      `Fisher J ${out.fisher.fisherJ} vs ELBO J ${out.elboFisherJ}`,
    );
    assert.ok(out.nce.hyvarinen <= out.nce.elbo + 0.15);
  });

  it("NCE loss of the true noise density against itself is worse than a moment-matched Gaussian on the data", () => {
    const data = [0.2, 0.1, 0.25, 0.15, 0.18];
    const noise = [-1, -0.8, -1.1, -0.9, -1.2];
    const logN = (x: number) => -0.5 * Math.log(2 * Math.PI) - 0.5 * x * x;
    const logQ = (x: number) => {
      const z = (x - 0.18) / 0.06;
      return -0.5 * Math.log(2 * Math.PI) - Math.log(0.06) - 0.5 * z * z;
    };
    assert.ok(nceLoss(logQ, data, noise, logN) < nceLoss(logN, data, noise, logN));
  });
});
