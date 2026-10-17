import { describe, it } from "node:test";
import { DC_RHO, jointGrid, maherGrid } from "./models.ts";
import assert from "node:assert/strict";
import {
  asianCoverP,
  asianExpectedReturn,
  asianFairOdds,
  asianFromGrid,
  asianTotalFromGrid,
  bestAhLine,
  comboContradiction,
  comboJointP,
  doubleChanceFrom1x2,
  europeanFromGrid,
  europeanResult,
  generateCombos,
  sameMatchOverPairs,
  sgpBoard,
  isAsianTotalLine,
  multiGoalsFromGrid,
  oddEvenFromGrid,
  parseAhSelection,
  parseCountSelection,
  parseEhSelection,
  parseMultiGoals,
  parseOddEven,
  playerGoalOrAssist,
  poissonOver,
  poissonOverAsian,
  poissonParity,
  robustnessFromPerturb,
  settleAsian,
  settleEuropean,
  settleKind,
  splitAsianLine,
  teamToScoreFromGrid,
  totalCardsLambda,
  totalCornersLambda,
  totalsFromGrid,
} from "./markets-engine.ts";

function cell(hg: number, ag: number, p = 1): number[][] {
  const n = Math.max(hg, ag, 4) + 1;
  const g = Array.from({ length: n }, () => Array(n).fill(0));
  g[hg]![ag] = p;
  return g;
}

describe("Asian handicap settlement", () => {
  it("splits quarter lines into adjacent half/whole lines", () => {
    assert.deepEqual(splitAsianLine(-0.5), [-0.5]);
    assert.deepEqual(splitAsianLine(-1), [-1]);
    assert.deepEqual(splitAsianLine(-0.75), [-1, -0.5]);
    assert.deepEqual(splitAsianLine(-0.25), [-0.5, 0]);
    assert.deepEqual(splitAsianLine(0.25), [0, 0.5]);
    assert.deepEqual(splitAsianLine(-1.25), [-1.5, -1]);
  });

  it("Home −0.5 wins 2-0 and loses 1-1", () => {
    assert.equal(settleAsian(2, -0.5), "full_win");
    assert.equal(settleAsian(0, -0.5), "full_loss");
    assert.equal(settleKind("ah", "Home -0.5", 2, 0), true);
    assert.equal(settleKind("ah", "Home -0.5", 1, 1), false);
  });

  it("Home −1.0 pushes 1-0", () => {
    assert.equal(settleAsian(1, -1), "push");
    assert.equal(settleKind("ah", "Home -1", 1, 0), null);
    assert.equal(settleKind("ah", "Home -1", 2, 0), true);
    assert.equal(settleKind("ah", "Home -1", 1, 1), false);
  });

  it("Home −0.75 half-wins 1-0", () => {
    assert.equal(settleAsian(1, -0.75), "half_win");
    assert.equal(settleKind("ah", "Home -0.75", 1, 0), true);
    assert.equal(settleKind("ah", "Home -0.75", 2, 0), true);
    assert.equal(settleKind("ah", "Home -0.75", 0, 0), false);
  });

  it("Home −0.25 half-loses a draw", () => {
    assert.equal(settleAsian(0, -0.25), "half_loss");
    assert.equal(settleKind("ah", "Home -0.25", 0, 0), false);
    assert.equal(settleKind("ah", "Home -0.25", 1, 0), true);
  });

  it("parses Home −0.75 from extract format", () => {
    assert.deepEqual(parseAhSelection("Home -0.75"), { side: "home", line: -0.75 });
    assert.deepEqual(parseAhSelection("Away +0.5"), { side: "away", line: 0.5 });
  });

  it("cover P is full-win + half half-win; push is not a hit", () => {
    const win = asianFromGrid(cell(2, 0), "home", -0.75);
    assert.ok(win.fullWin > 0.99);
    assert.ok(asianCoverP(win) > 0.99);
    const half = asianFromGrid(cell(1, 0), "home", -0.75);
    assert.ok(half.halfWin > 0.99);
    assert.ok(Math.abs(asianCoverP(half) - 0.5) < 1e-9);
    const push = asianFromGrid(cell(1, 0), "home", -1);
    assert.ok(push.push > 0.99);
    assert.equal(asianCoverP(push), 0);
  });

  it("fair odds and expected return account for half-win / push", () => {
    const half = asianFromGrid(cell(1, 0), "home", -0.75);
    const er = asianExpectedReturn(half, 1.9);
    assert.ok(Math.abs(er - (1 + (1.9 - 1) / 2)) < 1e-9);
    const mixed = cell(2, 0, 0);
    mixed[2]![0] = 0.45;
    mixed[1]![0] = 0.25;
    mixed[0]![0] = 0.3;
    const o = asianFromGrid(mixed, "home", -0.75);
    const fair = asianFairOdds(o);
    assert.ok(fair != null && fair > 1, `fair ${fair}`);
    assert.ok(Math.abs(asianExpectedReturn(o, fair!) - 1) < 1e-6);
  });

  it("bestAhLine picks the +EV line, never a negative-EV favourite", () => {
    const g = cell(2, 0);
    const best = bestAhLine(g, [
      { side: "home", line: -0.5, odd: 1.4 },
      { side: "home", line: -1.5, odd: 1.05 },
      { side: "away", line: 0.5, odd: 3.2 },
    ]);
    assert.ok(best);
    assert.equal(best!.side, "home");
    assert.equal(best!.line, -0.5);
    assert.ok(best!.ev > 0);
    assert.equal(
      bestAhLine(g, [{ side: "away", line: -0.5, odd: 1.9 }]),
      null,
    );
  });
});

describe("Asian goal totals", () => {
  it("Over 2.25 half-loses a 2-goal game and full-wins 3+", () => {
    assert.equal(settleAsian(2, -2.25), "half_loss");
    assert.equal(settleAsian(3, -2.25), "full_win");
    assert.equal(settleKind("ou_asian", "Over 2.25", 2, 0), false);
    assert.equal(settleKind("ou_asian", "Over 2.25", 2, 1), true);
    assert.equal(settleKind("ou_asian", "Over 2.0", 1, 1), null);
    assert.equal(settleKind("ou_asian", "Under 2.0", 1, 1), null);
    assert.equal(settleKind("ou_asian", "Under 2.0", 2, 1), false);
  });

  it("asianTotalFromGrid Over 2.25 on a 2-0 cell is a half-loss", () => {
    const o = asianTotalFromGrid(cell(2, 0), "over", 2.25);
    assert.ok(o.halfLoss > 0.99);
    const u = asianTotalFromGrid(cell(2, 0), "under", 2.25);
    assert.ok(u.halfWin > 0.99);
  });

  it("isAsianTotalLine skips headline halves", () => {
    assert.equal(isAsianTotalLine(2.5), false);
    assert.equal(isAsianTotalLine(2.25), true);
    assert.equal(isAsianTotalLine(2), true);
    assert.equal(isAsianTotalLine(0.75), false);
  });
});

describe("European handicap", () => {
  it("Home −1 on 1-0 is an adjusted draw (no push)", () => {
    assert.equal(europeanResult(1, 0, -1), "draw");
    assert.equal(settleEuropean(1, 0, { side: "home", line: -1 }), "draw");
    assert.equal(settleKind("eh", "Home -1", 1, 0), false);
    assert.equal(settleKind("eh", "Draw -1", 1, 0), true);
    assert.equal(settleKind("eh", "Home -1", 2, 0), true);
  });

  it("europeanFromGrid mass sums to ~1", () => {
    const dist = europeanFromGrid(cell(1, 0), { side: "home", line: -1 });
    assert.ok(dist.draw > 0.99);
    assert.ok(dist.home < 1e-9);
    assert.ok(Math.abs(dist.home + dist.draw + dist.away - 1) < 1e-9);
  });

  it("parses EH labels", () => {
    assert.deepEqual(parseEhSelection("Home -1"), { side: "home", line: -1 });
    assert.deepEqual(parseEhSelection("Draw -1"), { side: "draw", line: -1 });
  });
});

describe("Double chance identities", () => {
  it("1X + X2 − 12 = 2D", () => {
    const dc = doubleChanceFrom1x2(0.5, 0.28, 0.22);
    assert.ok(Math.abs(dc.dc1x + dc.dcx2 - dc.dc12 - 2 * 0.28) < 1e-9);
    assert.ok(Math.abs(dc.dc1x - (1 - 0.22)) < 1e-9);
    assert.ok(Math.abs(dc.dcx2 - (1 - 0.5)) < 1e-9);
    assert.ok(Math.abs(dc.dc12 - (1 - 0.28)) < 1e-9);
  });

  it("settleKind covers 1X / X2 / 12", () => {
    assert.equal(settleKind("dc_1x", "1X", 1, 0), true);
    assert.equal(settleKind("dc_1x", "1X", 1, 1), true);
    assert.equal(settleKind("dc_1x", "1X", 0, 1), false);
    assert.equal(settleKind("dc_x2", "X2", 0, 1), true);
    assert.equal(settleKind("dc_12", "12", 1, 1), false);
    assert.equal(settleKind("draw", "Draw", 1, 1), true);
    assert.equal(settleKind("draw", "Draw", 1, 0), false);
  });
});

describe("Team to score and extra O/U", () => {
  it("team-to-score is 1 − P(team = 0), never Match Over 0.5", () => {
    const g = cell(1, 0);
    const t = teamToScoreFromGrid(g);
    assert.ok(t.homeScore > 0.99);
    assert.ok(t.awayScore < 1e-9);
    const tot = totalsFromGrid(g);
    assert.ok(tot.over05 > 0.99);
    assert.ok(tot.over25 < 1e-9);
    assert.equal(settleKind("home_score", "Home to score", 1, 0), true);
    assert.equal(settleKind("away_score", "Away to score", 1, 0), false);
    assert.equal(settleKind("over_35", "Over 3.5", 2, 2), true);
    assert.equal(settleKind("under_35", "Under 3.5", 2, 1), true);
    assert.equal(settleKind("over_05", "Over 0.5", 0, 0), false);
  });
});

describe("Player G∪A overlap", () => {
  it("P(G∪A) = P(G)+P(A)−P(G∩A) and missing minutes → null", () => {
    const hit = playerGoalOrAssist({ lambdaG: 0.5, lambdaA: 0.4, expectedMinutes: 85, overlap: 0.08 });
    assert.ok(hit);
    const pG = hit!.pG;
    const pA = hit!.pA;
    assert.ok(Math.abs(hit!.pOr - (pG + pA - hit!.pBoth)) < 1e-9);
    assert.ok(hit!.pOr < pG + pA);
    assert.equal(playerGoalOrAssist({ lambdaG: 0.5, lambdaA: 0.4, expectedMinutes: null }), null);
    assert.equal(playerGoalOrAssist({ lambdaG: 0.5, lambdaA: 0.4, expectedMinutes: 12 }), null);
    assert.equal(playerGoalOrAssist({ lambdaG: null, lambdaA: 0.4, expectedMinutes: 90 }), null);
  });
});

describe("Cards λ — missing ≠ 0", () => {
  it("returns null when either side is missing", () => {
    assert.equal(totalCardsLambda(null, 2.1), null);
    assert.equal(totalCardsLambda(2.1, null), null);
    assert.equal(totalCardsLambda(0, 0), null);
    const lam = totalCardsLambda(2.1, 1.8);
    assert.ok(lam != null && Math.abs(lam - 3.9) < 1e-9);
  });

  it("poissonOver is unavailable without λ", () => {
    assert.equal(poissonOver(null, 4.5), null);
    assert.ok((poissonOver(4.2, 3.5) ?? 0) > 0.4);
  });

  it("poissonOverAsian iterates k and settleAsian(k, −line)", () => {
    const o = poissonOverAsian(4.2, 4.25);
    assert.ok(o);
    const mass = o!.fullWin + o!.halfWin + o!.push + o!.halfLoss + o!.loss;
    assert.ok(mass > 0.95 && mass < 1.02);
    assert.equal(parseCountSelection("Over 4.5")?.line, 4.5);
    assert.equal(settleKind("cards", "Over 4.5", 1, 1, { cards: 5 }), true);
    assert.equal(settleKind("cards", "Over 4.5", 1, 1, { cards: 4 }), false);
    assert.equal(settleKind("cards", "Over 4.5", 1, 1, {}), null);
    assert.equal(settleKind("corners", "Over 9.5", 2, 1, {}), null);
  });
});

describe("Odd/Even and Multi Goals", () => {
  it("parses even/odd and exclusive multi-goal ranges", () => {
    assert.equal(parseOddEven("even"), "even");
    assert.equal(parseOddEven("Odd Goals"), "odd");
    assert.equal(parseOddEven("even goals"), "even");
    assert.equal(parseOddEven("even/odd"), null);
    assert.deepEqual(parseMultiGoals("0-1"), { min: 0, max: 1 });
    assert.deepEqual(parseMultiGoals("2-3"), { min: 2, max: 3 });
    assert.deepEqual(parseMultiGoals("6+"), { min: 6, max: null });
    assert.deepEqual(parseMultiGoals("6 or more"), { min: 6, max: null });
  });

  it("aggregates exclusive ranges from the score matrix", () => {
    const g = Array.from({ length: 8 }, () => Array(8).fill(0));
    g[0]![0] = 0.1;
    g[1]![0] = 0.18;
    g[1]![1] = 0.27;
    g[2]![1] = 0.22;
    g[2]![2] = 0.13;
    g[3]![2] = 0.06;
    g[4]![2] = 0.04;
    const r01 = multiGoalsFromGrid(g, { min: 0, max: 1 });
    const r23 = multiGoalsFromGrid(g, { min: 2, max: 3 });
    const r45 = multiGoalsFromGrid(g, { min: 4, max: 5 });
    const r6 = multiGoalsFromGrid(g, { min: 6, max: null });
    assert.ok(Math.abs(r01 - 0.28) < 1e-9);
    assert.ok(Math.abs(r23 - 0.49) < 1e-9);
    assert.ok(Math.abs(r45 - 0.19) < 1e-9);
    assert.ok(Math.abs(r6 - 0.04) < 1e-9);
    assert.ok(Math.abs(r01 + r23 + r45 + r6 - 1) < 1e-9);
  });

  it("odd/even from the grid matches Poisson parity closed form at λ=0", () => {
    const g = cell(0, 0);
    const p = oddEvenFromGrid(g);
    assert.ok(p.even > 0.99);
    assert.ok(p.odd < 1e-9);
    const closed = poissonParity(0);
    assert.ok(Math.abs(closed.even - 1) < 1e-9);
    const mid = poissonParity(2.2);
    assert.ok(mid.even > 0.5 && mid.even < 0.56);
    assert.ok(Math.abs(mid.even + mid.odd - 1) < 1e-9);
  });

  it("settles multi-goals and odd/even on regular-time totals", () => {
    assert.equal(settleKind("multi_goals", "2-3", 2, 1), true);
    assert.equal(settleKind("multi_goals", "2-3", 0, 0), false);
    assert.equal(settleKind("multi_goals", "6+", 4, 3), true);
    assert.equal(settleKind("odd_even", "Even", 1, 1), true);
    assert.equal(settleKind("odd_even", "Odd", 1, 0), true);
    assert.equal(settleKind("odd_even", "Even", 1, 0), false);
  });
});

describe("Popular match combos — joint P from the score matrix", () => {
  it("joint P is the cell sum, not the independence product", () => {
    const g = Array.from({ length: 5 }, () => Array(5).fill(0));
    g[2]![0] = 0.5;
    g[0]![0] = 0.5;
    const home = comboJointP(g, [{ kind: "home", selection: "Home", odd: 1.8 }]);
    const over = comboJointP(g, [{ kind: "over_15", selection: "Over 1.5", odd: 1.7 }]);
    const joint = comboJointP(g, [
      { kind: "home", selection: "Home", odd: 1.8 },
      { kind: "over_15", selection: "Over 1.5", odd: 1.7 },
    ]);
    assert.ok(Math.abs(home - 0.5) < 1e-9);
    assert.ok(Math.abs(over - 0.5) < 1e-9);
    assert.ok(Math.abs(home * over - 0.25) < 1e-9, "independence product is 0.25");
    assert.ok(Math.abs(joint - 0.5) < 1e-9, "joint must be the overlapping cell");
  });

  it("rejects hard contradictions and nested redundancy", () => {
    const home = { kind: "home" as const, selection: "Home", odd: 1.8 };
    const away = { kind: "away" as const, selection: "Away", odd: 2.1 };
    const dc1x = { kind: "dc_1x" as const, selection: "1X", odd: 1.4 };
    const bttsYes = { kind: "btts_yes" as const, selection: "BTTS Yes", odd: 1.8 };
    const under05 = { kind: "under_05" as const, selection: "Under 0.5", odd: 6 };
    const over25 = { kind: "over_25" as const, selection: "Over 2.5", odd: 1.9 };
    const under25 = { kind: "under_25" as const, selection: "Under 2.5", odd: 1.9 };
    assert.equal(comboContradiction(home, away), true);
    assert.equal(comboContradiction(home, dc1x), true);
    assert.equal(comboContradiction(bttsYes, under05), true);
    assert.equal(comboContradiction(over25, under25), true);
    assert.equal(
      comboContradiction(
        { kind: "over_15", selection: "Over 1.5", odd: 1.4 },
        { kind: "under_25", selection: "Under 2.5", odd: 1.9 },
      ),
      false,
    );
  });

  it("generateCombos keeps 1.5–5.0, joint ≥ 0.40, one family per combo", () => {
    const g = Array.from({ length: 5 }, () => Array(5).fill(0));
    g[2]![0] = 1;
    const inBand = generateCombos(
      [
        { kind: "home", selection: "Home", odd: 1.5 },
        { kind: "over_15", selection: "Over 1.5", odd: 1.4 },
        { kind: "btts_no", selection: "BTTS No", odd: 1.6 },
      ],
      g,
      3,
    );
    assert.ok(inBand.length >= 1);
    assert.ok(inBand.every((c) => c.combinedOdds >= 1.5 - 1e-9 && c.combinedOdds <= 5 + 1e-9));
    assert.ok(inBand.every((c) => c.jointP >= 0.4 - 1e-9));
    assert.ok(inBand.every((c) => new Set(c.legs.map((l) => l.kind)).size === c.legs.length));

    const tooShort = generateCombos(
      [
        { kind: "home", selection: "Home", odd: 1.2 },
        { kind: "over_15", selection: "Over 1.5", odd: 1.2 },
      ],
      g,
      3,
    );
    assert.equal(tooShort.length, 0);

    const sameFamily = generateCombos(
      [
        { kind: "over_15", selection: "Over 1.5", odd: 1.5 },
        { kind: "over_25", selection: "Over 2.5", odd: 1.9 },
      ],
      g,
      3,
    );
    assert.equal(sameFamily.length, 0);

    const thin = Array.from({ length: 5 }, () => Array(5).fill(0));
    thin[2]![0] = 0.3;
    thin[0]![0] = 0.7;
    const belowFloor = generateCombos(
      [
        { kind: "home", selection: "Home", odd: 1.8 },
        { kind: "over_15", selection: "Over 1.5", odd: 1.7 },
      ],
      thin,
      3,
    );
    assert.equal(belowFloor.length, 0);

    const skipped = generateCombos(
      [
        { kind: "cs", selection: "2-0", odd: 7.5 },
        { kind: "home", selection: "Home", odd: 1.8 },
        { kind: "corners", selection: "Over 9.5", odd: 1.9 },
      ],
      g,
      3,
    );
    assert.equal(skipped.length, 0);
  });

  it("same-match over pairs use the score matrix, not the product", () => {
    const g = Array.from({ length: 4 }, () => Array(4).fill(0));
    g[2]![0] = 0.1;
    g[1]![1] = 0.6;
    g[0]![0] = 0.3;
    const pairs = sameMatchOverPairs(
      [
        { kind: "home_score", selection: "Home to score", odd: 1.4 },
        { kind: "away_score", selection: "Away to score", odd: 1.5 },
        { kind: "over_15", selection: "Over 1.5", odd: 1.3 },
      ],
      g,
    );
    const both = pairs.find(
      (p) => p.legs.some((l) => l.kind === "home_score") && p.legs.some((l) => l.kind === "away_score"),
    );
    assert.ok(both);
    assert.ok(Math.abs(both!.jointP - 0.6) < 1e-9);
    assert.ok(Math.abs(0.7 * 0.6 - 0.6) > 0.1);
    assert.ok(pairs.every((p) => p.legs.length === 2));
    g[2]![1] = 0.2;
    const withTotal = sameMatchOverPairs(
      [
        { kind: "home_score", selection: "Home to score", odd: 1.4 },
        { kind: "over_25", selection: "Over 2.5", odd: 1.7 },
        { kind: "over_15", selection: "Over 1.5", odd: 1.3 },
      ],
      g,
    );
    const teamOu = withTotal.find((p) => p.legs.some((l) => l.kind === "home_score") && p.legs.some((l) => l.kind === "over_25"));
    assert.ok(teamOu);
    assert.ok(Math.abs(teamOu!.jointP - 0.2) < 1e-9);
    assert.equal(
      withTotal.some((p) => p.legs.some((l) => l.kind === "over_15") && p.legs.some((l) => l.kind === "over_25")),
      false,
    );
  });

  it("SGP correlation is zero only when the legs use different independent counts", () => {
    const board = sgpBoard(maherGrid(1.38, 1.12));
    const both = board.rows[0]!;
    const withOver = board.rows[1]!;
    const winUnder = board.rows[3]!;
    assert.ok(Math.abs(both.phi) < 1e-6);
    assert.ok(Math.abs(both.unadjustedEv - (both.lift - 1)) < 1e-9);
    assert.ok(withOver.phi > 0.4);
    assert.ok(withOver.joint > withOver.product);
    assert.ok(withOver.fairOdds < withOver.naiveOdds);
    assert.ok(withOver.unadjustedEv > 0);
    assert.ok(Math.abs(board.bothImplyOver15 - 1) < 1e-9);
    assert.ok(winUnder.phi < -0.1);
    assert.ok(winUnder.unadjustedEv < 0);
    const dc = sgpBoard(jointGrid(1.38, 1.12, DC_RHO));
    assert.ok(dc.rows[0]!.phi > 0.05 && dc.rows[0]!.phi < 0.15);
    assert.ok(Math.abs(dc.bothImplyOver15 - 1) < 1e-9);
  });

  it("robustness stays high when λ perturb keeps the side", () => {
    assert.ok(robustnessFromPerturb(0.62, [0.6, 0.61, 0.62, 0.63, 0.64]) > 0.7);
    assert.ok(robustnessFromPerturb(0.62, [0.4, 0.41, 0.39, 0.38, 0.42]) < 0.2);
  });

  it("combo settlement voids on any push", () => {
    const legs = [
      { kind: "home" as const, selection: "Home", odd: 1.8 },
      { kind: "ah" as const, selection: "Home -1", odd: 1.9 },
    ];
    assert.equal(settleKind("combo", "Home + Home -1", 2, 0, { comboLegs: legs }), true);
    assert.equal(settleKind("combo", "Home + Home -1", 1, 0, { comboLegs: legs }), null);
    assert.equal(settleKind("combo", "Home + Home -1", 0, 1, { comboLegs: legs }), false);
  });
});

describe("Corners λ — missing ≠ 0", () => {
  it("uses the same clamp as cards and refuses a missing side", () => {
    assert.equal(totalCornersLambda(null, 5.1), null);
    assert.equal(totalCornersLambda(5.1, null), null);
    const lam = totalCornersLambda(5.1, 4.2);
    assert.ok(lam != null && Math.abs(lam - 9.3) < 1e-9);
  });
});
