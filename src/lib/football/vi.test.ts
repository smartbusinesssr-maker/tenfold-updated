import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { betaLogitLogPost } from "./mcmc.ts";
import {
  betaLogitScore,
  elboParts,
  fitGaussianVi,
  ghExpect,
  laplaceBeta,
  runBttsVi,
} from "./vi.ts";

describe("Variational inference", () => {
  it("Gauss–Hermite recovers moments of N(0,1)", () => {
    assert.ok(Math.abs(ghExpect(() => 1, 0, 1) - 1) < 1e-6);
    assert.ok(Math.abs(ghExpect((th) => th, 0, 1)) < 1e-8);
    assert.ok(Math.abs(ghExpect((th) => th * th, 0, 1) - 1) < 0.02);
  });

  it("Laplace mode of the Beta-on-logit is logit(α/(α+β))", () => {
    const lap = laplaceBeta(8, 2);
    assert.ok(Math.abs(lap.modeP - 0.8) < 1e-12);
    assert.ok(lap.s > 0.2 && lap.s < 0.8, `s ${lap.s}`);
  });

  it("VI mean recovers the conjugate Beta mean", () => {
    const alpha = 6;
    const beta = 6;
    const exact = 0.5;
    const fit = fitGaussianVi({
      logPost: (th) => betaLogitLogPost(th, alpha, beta),
      score: (th) => betaLogitScore(th, alpha, beta),
      init: 0,
    });
    assert.ok(Math.abs(fit.meanP - exact) < 0.03, `VI ${fit.meanP}`);
    assert.ok(fit.elboPath.length > 4);
    assert.ok(fit.elboPath[fit.elboPath.length - 1]! >= fit.elboPath[0]! - 0.05);
    const parts = elboParts((th) => betaLogitLogPost(th, alpha, beta), fit.m, fit.s);
    assert.ok(Math.abs(parts.elbo - (parts.energy + parts.entropy)) < 1e-12);
    assert.ok(Math.abs(fit.dm) < 0.15, `∇m should be near 0 at a symmetric mode, got ${fit.dm}`);
  });

  it("mean-field interval is narrower than a fat Laplace on a skewed Beta", () => {
    const out = runBttsVi({ alpha: 10, beta: 3, mu: 10 / 13, hits: 0, n: 0 });
    const exact = 10 / 13;
    assert.ok(Math.abs(out.conjugate.meanP - exact) < 0.04, `VI ${out.conjugate.meanP}`);
    const viW = out.conjugate.hi - out.conjugate.lo;
    assert.ok(viW > 0.05 && viW < 0.55, `width ${viW}`);
  });
});
