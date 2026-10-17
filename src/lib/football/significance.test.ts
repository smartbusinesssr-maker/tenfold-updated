import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  agrestiCoullInterval,
  benjaminiHochberg,
  bhAdjustedP,
  bhProcedure,
  binomialPower,
  byHarmonicTerms,
  byMethod,
  byPrice,
  deskDependence,
  dependenceRegimes,
  gaussianRegime,
  rhoFloor,
  binomialTest,
  binomSf,
  bonferroni,
  clopperPearsonInterval,
  criticalCount,
  edgeZ,
  evidenceFromPick,
  nForPower,
  pickSignificance,
  significanceReport,
  spreadNulls,
  stepProcedures,
  storeyLambdaSensitivity,
  storeyPi0,
  storeyQValues,
  storeyQTrace,
  storeyReport,
  waldInterval,
  wilsonInterval,
} from "./significance.ts";
import type { ScoredPick } from "./types.ts";

function pick(partial: Partial<ScoredPick> & { kind?: ScoredPick["kind"] }): ScoredPick {
  return {
    id: "p1",
    fixtureId: 1,
    date: "2026-09-19",
    kickoff: "2026-09-19T12:00:00Z",
    timestamp: 0,
    leagueId: 39,
    league: "EPL",
    country: "England",
    home: "Home",
    away: "Away",
    homeLogo: null,
    awayLogo: null,
    kind: "home",
    family: "win",
    selection: "Home",
    odd: 1.9,
    bookmaker: "Bet365",
    implied: 0.55,
    accuracy: 0.62,
    value: 0.6,
    edge: 0.07,
    agreement: 0.7,
    composite: 0.4,
    leagueWeight: 0.9,
    kellyQuarter: 0.02,
    lambdaHome: 1.5,
    lambdaAway: 1.1,
    eloHome: 1600,
    eloAway: 1500,
    rho: -0.1,
    advice: null,
    apiLine: null,
    injuries: 0,
    bestModel: "dixonColes",
    models: { dixonColes: 0.6, shin: 0.55, apiFootball: 0.55, hvattumElo: 0.58, baioH2h: 0.57 },
    scoreline: "1-0",
    scorelineP: 0.12,
    heat: [],
    notes: [],
    facts: {
      homeRank: 3,
      awayRank: 12,
      homeForm: "WWWDW",
      awayForm: "LLDLW",
      homeGf: 2,
      homeGa: 0.8,
      awayGf: 0.8,
      awayGa: 1.6,
      homeOver15: 0.8,
      awayOver15: 0.4,
      h2hWins: 4,
      h2hDraws: 1,
      h2hLosses: 1,
      h2hN: 6,
      histWeight: 0.6,
      quality: 0.8,
      grade: "FULL_DATA",
      coverageScore: 0.9,
      lineupConfirmed: false,
      lastNHome: 20,
      lastNAway: 20,
    },
    ...partial,
  } as ScoredPick;
}

describe("Wilson score interval", () => {
  it("4/5 95% is about 38–96% and swallows a 55% book", () => {
    const iv = wilsonInterval(4, 5);
    assert.ok(Math.abs(iv.lo - 0.3756) < 0.01);
    assert.ok(Math.abs(iv.hi - 0.9638) < 0.01);
    assert.ok(iv.lo < 0.55 && iv.hi > 0.55);
  });

  it("0/5 does not collapse to a point the way Wald does", () => {
    const wald = waldInterval(0, 5);
    const wilson = wilsonInterval(0, 5);
    assert.equal(wald.lo, 0);
    assert.equal(wald.hi, 0);
    assert.equal(wilson.lo, 0);
    assert.ok(wilson.hi > 0.4);
  });

  it("5/5 lower bound stays above a coin", () => {
    const iv = wilsonInterval(5, 5);
    assert.ok(iv.lo > 0.5);
    assert.ok(iv.hi >= 0.99);
  });
});

describe("Clopper–Pearson", () => {
  it("4/5 95% is wider than Wilson and still covers 0.55", () => {
    const cp = clopperPearsonInterval(4, 5);
    const w = wilsonInterval(4, 5);
    assert.ok(cp.lo < w.lo + 1e-9);
    assert.ok(cp.hi > w.hi - 1e-9);
    assert.ok(cp.lo < 0.55 && cp.hi > 0.55);
  });

  it("0/n upper bound is 1 − (α/2)^{1/n}", () => {
    const n = 5;
    const hi = 1 - (0.025) ** (1 / n);
    const cp = clopperPearsonInterval(0, n);
    assert.equal(cp.lo, 0);
    assert.ok(Math.abs(cp.hi - hi) < 0.01);
  });
});

describe("Agresti–Coull vs Wald", () => {
  it("adds two of each, so 0/5 is not a zero-width interval", () => {
    const ac = agrestiCoullInterval(0, 5);
    assert.ok(ac.hi > 0.3);
    assert.equal(ac.lo, 0);
  });
});

describe("exact binomial", () => {
  it("P(X≥4 | n=5, p=0.5) is 6/32", () => {
    const t = binomialTest(4, 5, 0.5);
    assert.ok(Math.abs(t.pOneGreater - 6 / 32) < 1e-9);
    assert.equal(t.reject5Greater, false);
  });

  it("P(X≥5 | n=5, p=0.5) is 1/32", () => {
    const t = binomialTest(5, 5, 0.5);
    assert.ok(Math.abs(t.pOneGreater - 1 / 32) < 1e-9);
    assert.equal(t.reject5Greater, true);
  });

  it("two-sided on a coin 25/50 stays near 1", () => {
    const t = binomialTest(25, 50, 0.5);
    assert.ok(t.pTwo > 0.8);
  });
});

describe("power", () => {
  it("last-5 at an 80% true rate vs a coin has ~33% power", () => {
    const pow = binomialPower(5, 0.5, 0.8);
    assert.ok(Math.abs(pow - 0.8 ** 5) < 0.02);
    assert.ok(pow < 0.4);
  });

  it("a 10pp edge needs a three-digit sample for 80% power", () => {
    const n = nForPower(0.5, 0.6);
    assert.ok(n != null && n > 80);
    assert.ok(n! < 400);
    assert.ok(binomialPower(n!, 0.5, 0.6) >= 0.8);
    assert.ok(binomialPower(n! - 1, 0.5, 0.6) < 0.8);
  });

  it("n=5 versus a 55% book has no 5% reject region, even on 5/5", () => {
    assert.equal(criticalCount(5, 0.55), null);
    assert.equal(binomialPower(5, 0.55, 0.99), 0);
    const r = significanceReport(5, 5, 0.55);
    assert.equal(r.verdict, "underpowered");
    assert.ok(r.test.pOneGreater > 0.05);
  });

  it("last-20 16/20 vs 0.55 is significant, last-5 4/5 is not", () => {
    const thin = significanceReport(4, 5, 0.55);
    const thick = significanceReport(16, 20, 0.55);
    assert.equal(thin.verdict, "underpowered");
    assert.equal(thin.wilsonExcludesP0, false);
    assert.equal(thick.verdict, "significant");
    assert.ok(thick.test.pOneGreater < 0.05);
  });
});

describe("BH and Bonferroni", () => {
  it("BH keeps the fourth of five, Bonferroni only the first two", () => {
    const ps = [0.001, 0.008, 0.03, 0.04, 0.2];
    const bh = benjaminiHochberg(ps, 0.05);
    const bon = bonferroni(ps, 0.05);
    assert.deepEqual(bh.reject, [true, true, true, true, false]);
    assert.deepEqual(bon, [true, true, false, false, false]);
    assert.ok(bh.cutoff != null && Math.abs(bh.cutoff - 0.04) < 1e-12);
  });

  it("ten identical 4% tests fail Bonferroni and survive BH", () => {
    const ps = Array.from({ length: 10 }, () => 0.04);
    assert.equal(bonferroni(ps, 0.05).some(Boolean), false);
    assert.equal(benjaminiHochberg(ps, 0.05).reject.every(Boolean), true);
  });

  it("Holm stops, Hochberg steps up, BH keeps more, and the keeps nest", () => {
    const split = stepProcedures([0.011, 0.014, 0.015, 0.04, 0.2], 0.05);
    assert.equal(split.bonKeeps, 0);
    assert.equal(split.holmKeeps, 0);
    assert.equal(split.hochbergKeeps, 3);
    assert.equal(split.bhKeeps, 4);
    const pile = stepProcedures(Array.from({ length: 10 }, () => 0.04), 0.05);
    assert.equal(pile.holmKeeps, 0);
    assert.equal(pile.hochbergKeeps, 10);
    assert.equal(pile.bhKeeps, 10);
    const gap = stepProcedures([0.001, 0.012, 0.032, 0.039, 0.2], 0.05);
    assert.equal(gap.bonKeeps, 1);
    assert.equal(gap.holmKeeps, 2);
    assert.equal(gap.hochbergKeeps, 2);
    assert.equal(gap.bhKeeps, 4);
    for (const card of [split, pile, gap]) {
      assert.ok(card.bonKeeps <= card.holmKeeps);
      assert.ok(card.holmKeeps <= card.hochbergKeeps);
      assert.ok(card.hochbergKeeps <= card.bhKeeps);
      for (const row of card.rows) {
        if (row.bonferroni) assert.equal(row.holm, true);
        if (row.holm) assert.equal(row.hochberg, true);
        if (row.hochberg) assert.equal(row.bh, true);
        assert.ok(row.holmBar <= row.bhBar + 1e-12);
      }
    }
  });

  it("a rank that misses its own bar is still kept when a worse rank clears", () => {
    const ps = [0.001, 0.012, 0.032, 0.039, 0.2];
    const proc = bhProcedure(ps, 0.05);
    assert.equal(proc.kStar, 4);
    assert.equal(proc.gaps, 1);
    const gap = proc.steps.find((s) => s.gap);
    assert.ok(gap);
    assert.equal(gap!.rank, 3);
    assert.ok(gap!.p > gap!.bhBar);
    assert.ok(gap!.adjusted <= 0.05);
    assert.ok(Math.abs(gap!.adjusted - (5 / 4) * 0.039) < 1e-12);
    assert.equal(proc.byKStar, 1);
    assert.equal(proc.steps.filter((s) => s.byKept).length, 1);
    assert.ok(proc.harmonic > 2.28 && proc.harmonic < 2.29);
  });

  it("adjusted p matches the BH p-value, and ten 4% lines die under BY", () => {
    const ps = [0.001, 0.012, 0.032, 0.039, 0.2];
    const proc = bhProcedure(ps, 0.05);
    const adj = bhAdjustedP(ps);
    for (const step of proc.steps) assert.ok(Math.abs(step.adjusted - adj[step.index]!) < 1e-12);
    const pile = bhProcedure(Array.from({ length: 10 }, () => 0.04), 0.05);
    assert.equal(pile.kStar, 10);
    assert.equal(pile.byKStar, 0);
    assert.ok(Math.abs(pile.harmonic - 7381 / 2520) < 1e-9);
  });

  it("BY price on a ten is α/H_10, and the worst-case BH bound is α·H_10", () => {
    const price = byPrice(10, 0.05);
    const h = 7381 / 2520;
    assert.ok(Math.abs(price.harmonic - h) < 1e-9);
    assert.ok(Math.abs(price.alphaBy - 0.05 / h) < 1e-12);
    assert.ok(Math.abs(price.worstBh - 0.05 * h) < 1e-12);
    assert.ok(Math.abs(price.lnApprox - price.harmonic) < 0.01);
    const terms = byHarmonicTerms(10);
    const sum = terms.reduce((s, t) => s + t.term, 0);
    assert.ok(Math.abs(sum - h) < 1e-12);
    assert.ok(terms[0]!.share > 0.3);
  });

  it("opposed legs on one fixture call for BY; same-way shared legs stay on BH", () => {
    const separate = deskDependence([
      { fixtureId: 1, kind: "home" },
      { fixtureId: 2, kind: "over_25" },
    ]);
    assert.equal(separate.regime, "separate");
    assert.equal(separate.procedure, "BH");
    const same = deskDependence([
      { fixtureId: 1, kind: "home" },
      { fixtureId: 1, kind: "over_25" },
    ]);
    assert.equal(same.regime, "same-way");
    assert.equal(same.procedure, "BH");
    const opposed = deskDependence([
      { fixtureId: 1, kind: "home" },
      { fixtureId: 1, kind: "away" },
    ]);
    assert.equal(opposed.regime, "opposed");
    assert.equal(opposed.procedure, "BY");
    const ou = deskDependence([
      { fixtureId: 3, kind: "over_25" },
      { fixtureId: 3, kind: "under_25" },
    ]);
    assert.equal(ou.procedure, "BY");
  });

  it("one opposed pair makes the pooled card arbitrary; clean blocks stay proved at α", () => {
    const separate = dependenceRegimes(
      Array.from({ length: 10 }, (_, i) => ({ fixtureId: i + 1, kind: "home" as const })),
    );
    assert.equal(separate.proof, "independence");
    assert.equal(separate.procedure, "BH");
    assert.ok(Math.abs(separate.bhCeiling - 0.05) < 1e-12);
    assert.ok(Math.abs(separate.rhoFloor + 1 / 9) < 1e-12);

    const same = dependenceRegimes([
      { fixtureId: 1, kind: "home" },
      { fixtureId: 1, kind: "over_25" },
      { fixtureId: 2, kind: "over_15" },
    ]);
    assert.equal(same.proof, "prds");
    assert.equal(same.procedure, "BH");
    assert.ok(Math.abs(same.bhCeiling - 0.05) < 1e-12);

    const spoiler = dependenceRegimes([
      { fixtureId: 1, kind: "home" },
      { fixtureId: 1, kind: "away" },
      ...Array.from({ length: 8 }, (_, i) => ({ fixtureId: i + 2, kind: "over_25" as const })),
    ]);
    assert.equal(spoiler.proof, "arbitrary");
    assert.equal(spoiler.procedure, "BY");
    assert.equal(spoiler.m, 10);
    assert.ok(Math.abs(spoiler.bhCeiling - 0.05 * (7381 / 2520)) < 1e-9);
    assert.equal(spoiler.blocks.find((b) => b.proof === "independence")?.m, 8);
    const bad = spoiler.blocks.find((b) => b.proof === "arbitrary");
    assert.equal(bad?.m, 2);
    assert.ok(Math.abs(bad!.bhCeiling - 0.05 * 1.5) < 1e-12);
  });

  it("equicorrelated one-sided Gaussians are PRDS only for ρ ≥ 0", () => {
    assert.equal(gaussianRegime(0, 10).proof, "independence");
    assert.equal(gaussianRegime(0.4, 10).procedure, "BH");
    const neg = gaussianRegime(-0.05, 10);
    assert.equal(neg.possible, true);
    assert.equal(neg.proof, "arbitrary");
    assert.equal(gaussianRegime(-0.5, 10).possible, false);
    assert.ok(Math.abs(rhoFloor(2) + 1) < 1e-12);
  });

  it("BY is BH at α/H_m, and the proof leaves the π₀ slack unspent", () => {
    const gap = [0.001, 0.012, 0.032, 0.039, 0.2];
    const method = byMethod(gap, 0.05, 1);
    assert.equal(method.sameAsBhAtPrime, true);
    assert.equal(method.kStar, 1);
    assert.equal(method.keeps, 1);
    assert.equal(method.bhKeeps, 4);
    assert.ok(Math.abs(method.alphaPrime - 0.05 / method.harmonic) < 1e-12);
    const half = byMethod(gap, 0.05, 0.5);
    assert.ok(Math.abs(half.provedCeiling - 0.025) < 1e-12);
    assert.ok(Math.abs(half.slack - 0.025) < 1e-12);
    assert.equal(half.kStar, method.kStar);
    const pile = byMethod(Array.from({ length: 10 }, () => 0.04), 0.05, 1);
    assert.equal(pile.sameAsBhAtPrime, true);
    assert.equal(pile.keeps, 0);
    assert.equal(pile.bhKeeps, 10);
  });
});

describe("Storey q-value", () => {
  it("π₀ = 1 recovers BH: same rejects at 5%", () => {
    const ps = [0.001, 0.008, 0.03, 0.04, 0.2];
    const bh = benjaminiHochberg(ps, 0.05);
    const q = storeyQValues(ps, 1);
    assert.deepEqual(
      q.map((v) => v <= 0.05),
      bh.reject,
    );
    const adj = bhAdjustedP(ps);
    for (let i = 0; i < ps.length; i++) assert.ok(Math.abs(adj[i]! - q[i]!) < 1e-12);
  });

  it("π₀ = 0.5 pulls q down and keeps a BH miss", () => {
    const ps = [0.01, 0.04, 0.2];
    const bhQ = storeyQValues(ps, 1);
    const q = storeyQValues(ps, 0.5);
    assert.ok(q[0]! < bhQ[0]!);
    assert.ok(q[1]! <= 0.05);
    assert.ok(bhQ[1]! > 0.05);
    assert.ok(q[0]! <= q[1]! + 1e-12);
    assert.ok(q[1]! <= q[2]! + 1e-12);
  });

  it("q equals min(1, π₀ × BH-adjusted p), and a later rank can pull it down", () => {
    const ps = [0.001, 0.012, 0.032, 0.039, 0.2];
    const trace = storeyQTrace(ps, 0.5);
    assert.equal(trace.identity, true);
    assert.equal(trace.pulled, 1);
    const gap = trace.steps.find((s) => s.rank === 3);
    assert.ok(gap);
    assert.equal(gap!.pulled, true);
    assert.ok(Math.abs(gap!.scaled - 0.5 * (5 / 3) * 0.032) < 1e-12);
    assert.ok(Math.abs(gap!.q - 0.5 * (5 / 4) * 0.039) < 1e-12);
    const bh = bhAdjustedP(ps);
    const q = storeyQValues(ps, 0.5);
    for (let i = 0; i < ps.length; i++) assert.ok(Math.abs(q[i]! - Math.min(1, 0.5 * bh[i]!)) < 1e-12);
  });

  it("a mixed ten with a real tail estimates π₀ = 0.6 at λ = 0.5", () => {
    const ps = [0.001, 0.002, 0.003, 0.01, 0.02, 0.03, 0.04, 0.6, 0.7, 0.8];
    const est = storeyPi0(ps, 0.5);
    assert.equal(est.nTail, 3);
    assert.equal(est.thin, false);
    assert.ok(Math.abs(est.pi0 - 0.6) < 1e-12);
    const rep = storeyReport(ps, 0.5);
    assert.ok(rep.rejectQ.filter(Boolean).length >= 4);
    assert.ok(rep.q[0]! < rep.bhAdjusted[0]!);
  });

  it("ten 4% p-values have no tail, so π₀ falls back to 1 and q = BH", () => {
    const ps = Array.from({ length: 10 }, () => 0.04);
    const est = storeyPi0(ps, 0.5);
    assert.equal(est.nTail, 0);
    assert.equal(est.thin, true);
    assert.equal(est.pi0, 1);
    const q = storeyReport(ps).q;
    assert.ok(q.every((v) => Math.abs(v - 0.04) < 1e-12));
  });

  it("spread nulls put mass above λ = 0.5 so π₀ is identifiable", () => {
    const ps = spreadNulls(10);
    const est = storeyPi0(ps, 0.5);
    assert.ok(est.nTail >= 2);
    assert.equal(est.thin, false);
    assert.ok(est.pi0 > 0.5);
  });
});

describe("Storey λ sensitivity", () => {
  const sparse = [0.001, 0.002, 0.003, 0.01, 0.02, 0.03, 0.04, 0.6, 0.7, 0.8];

  it("π₀ at λ = 0.05 is near the true 30% mix; λ = ½ overshoots to 60%", () => {
    const lo = storeyPi0(sparse, 0.05);
    const mid = storeyPi0(sparse, 0.5);
    assert.ok(Math.abs(lo.raw - 3 / 9.5) < 1e-12);
    assert.ok(Math.abs(mid.pi0 - 0.6) < 1e-12);
    assert.ok(lo.pi0 < mid.pi0);
  });

  it("keep-set and π₀ swing across the λ grid", () => {
    const s = storeyLambdaSensitivity(sparse, 0.05);
    assert.equal(s.unstable, true);
    assert.ok(s.pi0Max - s.pi0Min >= 0.25);
    assert.ok(s.smootherPi0 != null && s.smootherPi0 > 0 && s.smootherPi0 < 1);
    assert.ok(s.lambdaStar != null);
    const half = s.grid.find((g) => g.lambda === 0.5);
    assert.ok(half && Math.abs(half.pi0 - 0.6) < 1e-12);
    assert.ok(half && half.mse != null);
  });

  it("middling p-values flip the keep-set as π₀ moves", () => {
    const weak = [0.01, 0.02, 0.04, 0.06, 0.08, 0.12, 0.2, 0.55, 0.7, 0.9];
    const s = storeyLambdaSensitivity(weak, 0.05);
    assert.ok(s.keepsMax - s.keepsMin >= 2);
    assert.ok(s.flips >= 2);
  });

  it("bootstrap λ* is deterministic at a fixed seed", () => {
    const a = storeyLambdaSensitivity(sparse, 0.05, 80, 20260920);
    const b = storeyLambdaSensitivity(sparse, 0.05, 80, 20260920);
    assert.equal(a.lambdaStar, b.lambdaStar);
    assert.equal(a.bootstrapPi0, b.bootstrapPi0);
  });

  it("a pile of 4% p-values has no usable λ, so bootstrap and smoother sit out", () => {
    const ps = Array.from({ length: 10 }, () => 0.04);
    const s = storeyLambdaSensitivity(ps, 0.05);
    assert.equal(s.lambdaStar, null);
    assert.equal(s.smootherPi0, null);
    assert.ok(s.grid.every((g) => g.thin));
    assert.equal(s.keepsMin, s.keepsMax);
  });

  it("smoother mode uses the 0.95 fit, not λ = ½", () => {
    const half = storeyReport(sparse, 0.5, 0.05, "fixed");
    const smooth = storeyReport(sparse, 0.5, 0.05, "smoother");
    assert.equal(smooth.mode, "smoother");
    assert.equal(smooth.lambda, 0.95);
    assert.notEqual(smooth.pi0, half.pi0);
  });
});

describe("edge z", () => {
  it("a 7pp model edge on n=5 is noise", () => {
    const e = edgeZ(0.62, 0.55, 5);
    assert.ok(e.z != null && e.z < 1);
    assert.ok((e.p ?? 0) > 0.2);
  });

  it("the same edge on n=200 clears 5%", () => {
    const e = edgeZ(0.62, 0.55, 200);
    assert.ok((e.p ?? 1) < 0.05);
    assert.ok((e.z ?? 0) > 1.6);
  });
});

describe("evidence from last-5 form", () => {
  it("counts W on a home, and treats a last-5 4/5 as underpowered vs Shin 55%", () => {
    const p = pick({ facts: { ...pick({}).facts, homeForm: "WWWDW" } });
    const ev = evidenceFromPick(p);
    assert.ok(ev);
    assert.equal(ev!.k, 4);
    assert.equal(ev!.n, 5);
    const row = pickSignificance(p, true);
    assert.equal(row.verdict, "underpowered");
    assert.ok((row.p ?? 0) > 0.05);
  });

  it("double chance 1X counts W+D", () => {
    const p = pick({ kind: "dc_1x", family: "dc", selection: "1X", facts: { ...pick({}).facts, homeForm: "WDLWL" } });
    const ev = evidenceFromPick(p);
    assert.equal(ev!.k, 3);
    assert.equal(ev!.n, 5);
  });

  it("falls back to H2H when the form string is empty", () => {
    const p = pick({
      facts: { ...pick({}).facts, homeForm: "", awayForm: "", h2hWins: 5, h2hDraws: 1, h2hLosses: 0, h2hN: 6 },
    });
    const ev = evidenceFromPick(p);
    assert.ok(ev);
    assert.equal(ev!.kind, "h2h");
    assert.equal(ev!.k, 5);
    assert.equal(ev!.n, 6);
  });
});

describe("binomSf sanity", () => {
  it("sums with the lower tail", () => {
    assert.ok(Math.abs(binomSf(0, 5, 0.4) - 1) < 1e-9);
    assert.ok(binomSf(6, 5, 0.4) === 0);
  });
});
