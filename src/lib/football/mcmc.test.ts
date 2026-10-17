import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  betaLogitLogPost,
  effectiveSampleSize,
  gelmanRubin,
  invLogit,
  mulberry32,
  randomWalkMh,
  runBttsMcmc,
  sampleBeta,
} from "./mcmc.ts";

describe("Markov chain Monte Carlo", () => {
  it("MH on a conjugate Beta recovers the exact mean", () => {
    const alpha = 5;
    const beta = 5;
    const exact = alpha / (alpha + beta);
    const out = runBttsMcmc({
      alpha,
      beta,
      mu: exact,
      hits: 0,
      n: 0,
      draws: 1200,
      burn: 300,
      step: 0.45,
      seed: 21,
    });
    assert.ok(Math.abs(out.conjugate.mean - exact) < 0.03, `MH ${out.conjugate.mean} vs ${exact}`);
    assert.ok(Math.abs(out.gibbsMean - exact) < 0.03, `Gibbs ${out.gibbsMean}`);
    assert.ok(out.conjugate.rHat < 1.12, `R̂ ${out.conjugate.rHat}`);
    assert.ok(out.conjugate.accept > 0.15 && out.conjugate.accept < 0.8, `acc ${out.conjugate.accept}`);
    assert.ok(out.conjugate.ess > 40, `ESS ${out.conjugate.ess}`);
  });

  it("Gelman–Rubin is ~1 when two chains match, high when they do not", () => {
    const same = [
      [0.4, 0.41, 0.39, 0.4, 0.42, 0.38, 0.4, 0.41],
      [0.4, 0.39, 0.41, 0.4, 0.38, 0.42, 0.4, 0.39],
    ];
    assert.ok(gelmanRubin(same) < 1.05);
    const split = [
      Array.from({ length: 40 }, (_, i) => 0.2 + 0.01 * (i % 3)),
      Array.from({ length: 40 }, (_, i) => 0.8 + 0.01 * (i % 3)),
    ];
    assert.ok(gelmanRubin(split) > 2, `split R̂ ${gelmanRubin(split)}`);
  });

  it("ESS is at most the raw length", () => {
    const rng = mulberry32(3);
    const iid = Array.from({ length: 200 }, () => rng());
    const ess = effectiveSampleSize(iid);
    assert.ok(ess <= 200 + 1e-9);
    assert.ok(ess > 80, `iid ESS ${ess}`);
  });

  it("Beta draws concentrate on the mean", () => {
    const rng = mulberry32(9);
    let s = 0;
    for (let i = 0; i < 800; i++) s += sampleBeta(8, 2, rng);
    assert.ok(Math.abs(s / 800 - 0.8) < 0.03);
  });

  it("random-walk MH accepts a higher posterior for sure", () => {
    const rng = mulberry32(4);
    const lp = (th: number) => betaLogitLogPost(th, 6, 6);
    const chain = randomWalkMh({ logPost: lp, init: 0, step: 0.3, draws: 400, rng });
    const pMean = chain.x.reduce((s, th) => s + invLogit(th), 0) / chain.x.length;
    assert.ok(Math.abs(pMean - 0.5) < 0.08, `mean ${pMean}`);
  });
});
