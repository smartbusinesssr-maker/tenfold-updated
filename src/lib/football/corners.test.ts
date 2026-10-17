import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bivariateCornerGrid,
  cornerHandicapFromGrid,
  cornerLambdas,
  cornerRatesFromSamples,
  cornerWinnerFromGrid,
  negBinCornerInvestigate,
  parseCornerMarket,
  pCornerMarket,
  settleCorner,
} from "./corners.ts";
import { asianCoverP } from "./markets-engine.ts";

describe("corner lambdas — missing ≠ 0", () => {
  it("returns null when either side lacks production", () => {
    assert.equal(
      cornerLambdas({
        home: { forPerMatch: 5.1, againstPerMatch: 4, forHome: null, forAway: null, againstHome: null, againstAway: null },
        away: { forPerMatch: null, againstPerMatch: 5, forHome: null, forAway: null, againstHome: null, againstAway: null },
      }),
      null,
    );
  });

  it("opponent-adjusts when concession rates exist", () => {
    const lam = cornerLambdas({
      home: {
        forPerMatch: 6,
        againstPerMatch: 4,
        forHome: 6.5,
        forAway: 5,
        againstHome: 3.5,
        againstAway: 4.5,
        n: 10,
      },
      away: {
        forPerMatch: 4,
        againstPerMatch: 6,
        forHome: 4.5,
        forAway: 3.8,
        againstHome: 5.5,
        againstAway: 6.2,
        n: 10,
      },
      leagueAvg: 5,
    });
    assert.ok(lam);
    assert.ok(lam!.lambdaH > lam!.lambdaA);
    assert.ok(Math.abs(lam!.lambdaT - (lam!.lambdaH + lam!.lambdaA)) < 1e-9);
    assert.equal(lam!.vmr, null);
  });

  it("match corner totals with VMR above 1.25 are kept, a flat book is not", () => {
    const flat = Array.from({ length: 8 }, (_, i) => ({ home: i % 2 === 0, for: 5, against: 5 }));
    assert.equal(cornerRatesFromSamples(flat)?.vmr ?? null, null);
    const wild = [4, 12, 3, 14, 5, 11, 2, 13].map((t, i) => ({
      home: i % 2 === 0,
      for: Math.ceil(t / 2),
      against: Math.floor(t / 2),
    }));
    const rates = cornerRatesFromSamples(wild);
    assert.ok((rates?.vmr ?? 0) > 1.25);
    const lam = cornerLambdas({
      home: { ...rates!, forPerMatch: 5, againstPerMatch: 5 },
      away: { forPerMatch: 5, againstPerMatch: 5, forHome: 5, forAway: 5, againstHome: 5, againstAway: 5, vmr: rates!.vmr },
    });
    assert.ok(lam?.vmr != null && lam.vmr > 1.25);
  });
});

describe("negative binomial corners", () => {
  it("shared VMR sums to one NB, and the desk mix matches that variance not that shape", () => {
    const z = negBinCornerInvestigate(5.2, 4.6, 1.8);
    const mid = z.lines.find((row) => row.line === 9.5)!;
    const low = z.lines.find((row) => row.line === 6.5)!;
    const tail = z.lines.find((row) => row.line === 13.5)!;
    assert.ok(z.open);
    assert.ok(Math.abs(z.varFull - 1.8 * z.mean) < 1e-9);
    assert.ok(Math.abs(z.varDesk - (0.65 * z.varPoisson + 0.35 * z.varFull)) < 1e-9);
    assert.ok(Math.abs(z.rTotal - (z.rH + z.rA)) < 1e-9);
    assert.ok(Math.abs(z.singleNbOver95 - mid.negbin) < 0.01);
    assert.ok(tail.negbin > tail.poisson);
    assert.ok(low.negbin < low.poisson);
    assert.ok(tail.marginMix > tail.poisson);
    assert.ok(tail.negbin > tail.totalMix);
    assert.ok(Math.abs(tail.marginMix - tail.totalMix) < Math.abs(tail.negbin - tail.poisson));
    assert.ok(Math.abs(mid.negbin - mid.poisson) < Math.abs(tail.negbin - tail.poisson));
    const shut = negBinCornerInvestigate(5.2, 4.6, 1.1);
    assert.equal(shut.open, false);
    assert.ok(Math.abs(shut.varFull - 1.1 * shut.mean) < 1e-9);
  });
});

describe("bivariate corners", () => {
  it("independent grid sums to 1 and winner + handicap are coherent", () => {
    const g = bivariateCornerGrid(6, 4);
    let mass = 0;
    for (const row of g) for (const p of row) mass += p;
    assert.ok(mass > 0.98 && mass < 1.02);
    const w = cornerWinnerFromGrid(g);
    assert.ok(w.home > w.away);
    assert.ok(w.home + w.draw + w.away > 0.98);
    const hc = cornerHandicapFromGrid(g, "home", -1.5);
    assert.ok(asianCoverP(hc) > 0.4);
  });

  it("NegBin mix is used only with a real VMR", () => {
    const pois = bivariateCornerGrid(5, 5);
    const nb = bivariateCornerGrid(5, 5, { vmr: 1.4 });
    assert.notEqual(pois[0]![0], nb[0]![0]);
  });
});

describe("parse / settle corner markets", () => {
  it("parses total, team, handicap, winner", () => {
    assert.deepEqual(parseCornerMarket("Over 9.5"), { variant: "total", side: "over", line: 9.5 });
    assert.equal(parseCornerMarket("Home corners Over 5.5")?.variant, "team");
    assert.equal(parseCornerMarket("Corners Home -1.5")?.variant, "handicap");
    assert.equal(parseCornerMarket("Home most corners")?.side, "home");
    assert.equal(parseCornerMarket("Corners draw")?.side, "draw");
  });

  it("settles from split counts; missing stays null", () => {
    assert.equal(settleCorner("Over 9.5", {}), null);
    assert.equal(settleCorner("Over 9.5", { corners: 10 }), true);
    assert.equal(settleCorner("Over 9.5", { corners: 9 }), false);
    assert.equal(settleCorner("Home corners Over 5.5", { homeCorners: 6, awayCorners: 4 }), true);
    assert.equal(settleCorner("Home most corners", { homeCorners: 7, awayCorners: 4 }), true);
    assert.equal(settleCorner("Corners draw", { homeCorners: 5, awayCorners: 5 }), true);
    assert.equal(settleCorner("Corners Home -1.5", { homeCorners: 7, awayCorners: 4 }), true);
    assert.equal(settleCorner("Corners Home -1.5", { homeCorners: 5, awayCorners: 4 }), false);
  });

  it("prices Over 9.5 above 0.4 when λT is 11", () => {
    const lam = { lambdaH: 6, lambdaA: 5, lambdaT: 11, n: 8, vmr: null };
    const g = bivariateCornerGrid(6, 5);
    const priced = pCornerMarket({ variant: "total", side: "over", line: 9.5 }, lam, g);
    assert.ok(priced && priced.p > 0.5);
  });
});

describe("corner sample rates", () => {
  it("needs 4 matches and never treats empty as 0", () => {
    assert.equal(cornerRatesFromSamples([]), null);
    assert.equal(cornerRatesFromSamples([{ home: true, for: 5, against: 4 }]), null);
    const r = cornerRatesFromSamples([
      { home: true, for: 6, against: 3 },
      { home: true, for: 7, against: 4 },
      { home: false, for: 4, against: 5 },
      { home: false, for: 5, against: 6 },
    ]);
    assert.ok(r && r.forPerMatch != null && r.forPerMatch > 5);
    assert.ok(r!.forHome != null && r!.forAway != null);
  });
});
