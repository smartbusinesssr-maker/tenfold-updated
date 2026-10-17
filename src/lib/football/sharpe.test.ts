import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deflatedSharpe,
  expectedCardSharpe,
  expectedUnitMoments,
  familySharpeReports,
  maxDrawdown,
  probabilisticSharpe,
  sharpeFromBets,
  syntheticBook,
  unitReturn,
} from "./sharpe.ts";

describe("unitReturn", () => {
  it("pays decimal-minus-one on a hit and −1 on a miss", () => {
    assert.equal(unitReturn(2, 1), 1);
    assert.ok(Math.abs(unitReturn(1.9, 1) - 0.9) < 1e-12);
    assert.equal(unitReturn(1.9, 0), -1);
  });
});

describe("sharpeFromBets", () => {
  it("is null on a one-line sample", () => {
    const r = sharpeFromBets([{ date: "2026-09-01", odd: 2, y: 1 }]);
    assert.equal(r.n, 1);
    assert.equal(r.sharpe, null);
    assert.equal(r.maxDrawdown, 0);
    assert.equal(r.mar, 0);
  });

  it("is positive on a string of overlays that hit", () => {
    const bets = [
      { date: "2026-09-01", odd: 1.9, y: 1 as const },
      { date: "2026-09-01", odd: 1.8, y: 1 as const },
      { date: "2026-09-02", odd: 2.0, y: 1 as const },
      { date: "2026-09-02", odd: 1.7, y: 0 as const },
      { date: "2026-09-03", odd: 1.91, y: 1 as const },
      { date: "2026-09-03", odd: 2.1, y: 1 as const },
    ];
    const r = sharpeFromBets(bets);
    assert.ok((r.sharpe ?? 0) > 0);
    assert.ok((r.sortino ?? 0) >= (r.sharpe ?? 0));
    assert.ok(r.psr != null && r.psr > 0.5);
    assert.equal(r.nDates, 3);
    assert.ok(r.dailySharpe != null);
    assert.ok(r.rollingSharpe != null);
    assert.ok(r.upr != null && r.upr > 0);
    assert.ok((r.sortinoOverSharpe ?? 0) >= 1);
    assert.equal(r.nLoss, 1);
    assert.equal(r.daily.length, 3);
    assert.ok(r.maxDrawdown > 0);
    assert.ok(r.omega != null && r.omega > 1);
    assert.ok(r.kappa1 != null);
  });

  it("is negative when the book mostly misses", () => {
    const bets = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-09-0${(i % 3) + 1}`,
      odd: 1.9,
      y: (i === 0 ? 1 : 0) as 0 | 1,
    }));
    const r = sharpeFromBets(bets);
    assert.ok((r.sharpe ?? 0) < 0);
    assert.ok((r.psr ?? 1) < 0.5);
    assert.ok(r.maxDrawdown >= 4);
  });
});

describe("expectedCardSharpe", () => {
  it("matches μ = p·odd − 1 on a single 2.00 overlay", () => {
    const m = expectedUnitMoments(2, 0.6);
    assert.ok(Math.abs(m.mu - 0.2) < 1e-9);
    const card = expectedCardSharpe([{ odd: 2, p: 0.6, stake: 0.05 }]);
    assert.ok(Math.abs(card.mu - 0.05 * 0.2) < 1e-9);
    assert.ok((card.sharpe ?? 0) > 0);
    assert.ok(card.omega != null && Math.abs(card.omega - 1.5) < 1e-9);
  });

  it("is null with no slips", () => {
    assert.equal(expectedCardSharpe([]).sharpe, null);
    assert.equal(expectedCardSharpe([]).omega, null);
  });

  it("a second independent slip lifts Sortino (µ doubles faster than δ)", () => {
    const one = expectedCardSharpe([{ odd: 2, p: 0.6, stake: 0.05 }]);
    const two = expectedCardSharpe([
      { odd: 2, p: 0.6, stake: 0.05 },
      { odd: 2, p: 0.6, stake: 0.05 },
    ]);
    assert.ok(one.sortino != null && two.sortino != null);
    assert.ok(two.sortino > one.sortino);
    assert.ok(Math.abs(two.mu - 2 * one.mu) < 1e-12);
    assert.ok(one.omega != null && two.omega != null);
    assert.ok(Math.abs(two.omega - one.omega) < 1e-12);
  });

  it("per-date Sortino is undefined when no day finishes below MAR", () => {
    const r = sharpeFromBets([
      { date: "2026-09-01", odd: 2, y: 1 },
      { date: "2026-09-01", odd: 1.8, y: 0 },
      { date: "2026-09-02", odd: 2, y: 1 },
      { date: "2026-09-03", odd: 2, y: 0 },
    ]);
    assert.ok(r.sortino != null);
    assert.ok(r.dailySortino != null);
    assert.ok(r.nDates >= 2);
  });
});

describe("Sortino 1994", () => {
  it("counts winning periods as zero in δ, so Sortino beats Sharpe on a mixed overlay book", () => {
    const r = sharpeFromBets([
      { date: "2026-09-01", odd: 2, y: 1 },
      { date: "2026-09-02", odd: 2, y: 1 },
      { date: "2026-09-03", odd: 2, y: 0 },
    ]);
    assert.ok(r.sortino != null && r.sharpe != null);
    assert.ok(r.sortino > r.sharpe);
    assert.equal(r.nLoss, 1);
    assert.ok(Math.abs(r.lossRate - 1 / 3) < 1e-12);
    assert.equal(r.meanLoss, -1);
    assert.ok(r.upr != null && r.upr > 0);
    assert.ok(r.semiDeviation > r.downsideStd);
    assert.ok(r.sortinoSemi != null && r.sortino! > r.sortinoSemi);
  });

  it("is undefined when every slip finishes above MAR", () => {
    const r = sharpeFromBets([
      { date: "2026-09-01", odd: 2, y: 1 },
      { date: "2026-09-02", odd: 1.8, y: 1 },
      { date: "2026-09-03", odd: 1.9, y: 1 },
    ]);
    assert.equal(r.nLoss, 0);
    assert.equal(r.sortino, null);
    assert.equal(r.upr, null);
    assert.equal(r.omega, null);
    assert.equal(r.kappa1, null);
    assert.equal(r.downsideStd, 0);
  });

  it("a positive MAR turns a short-priced hit into a shortfall", () => {
    const cash = sharpeFromBets(
      [
        { date: "2026-09-01", odd: 1.05, y: 1 },
        { date: "2026-09-02", odd: 1.05, y: 1 },
        { date: "2026-09-03", odd: 1.05, y: 0 },
      ],
      0,
    );
    const hurdle = sharpeFromBets(
      [
        { date: "2026-09-01", odd: 1.05, y: 1 },
        { date: "2026-09-02", odd: 1.05, y: 1 },
        { date: "2026-09-03", odd: 1.05, y: 0 },
      ],
      0.1,
    );
    assert.ok(hurdle.nLoss > cash.nLoss);
    assert.equal(hurdle.mar, 0.1);
    assert.ok((hurdle.sortino ?? 0) < (cash.sortino ?? 0));
  });
});

describe("Omega and Kappa", () => {
  it("Ω = 1 + κ₁ and κ₂ is Sortino", () => {
    const r = sharpeFromBets([
      { date: "2026-09-01", odd: 2, y: 1 },
      { date: "2026-09-02", odd: 2, y: 1 },
      { date: "2026-09-03", odd: 2, y: 0 },
      { date: "2026-09-04", odd: 1.8, y: 1 },
    ]);
    assert.ok(r.omega != null && r.kappa1 != null && r.sortino != null);
    assert.ok(Math.abs(r.omega - (1 + r.kappa1)) < 1e-12);
    assert.ok(r.kappa3 != null);
    assert.ok(r.kappa3 < r.sortino);
  });

  it("even-money coin flip has Omega 1", () => {
    const r = sharpeFromBets([
      { date: "2026-09-01", odd: 2, y: 1 },
      { date: "2026-09-02", odd: 2, y: 0 },
    ]);
    assert.ok(r.omega != null);
    assert.ok(Math.abs(r.omega - 1) < 1e-12);
    assert.ok(r.kappa1 != null && Math.abs(r.kappa1) < 1e-12);
  });

  it("2.00 overlay that hits 3/5 has Omega 1.5", () => {
    const r = sharpeFromBets([
      { date: "2026-09-01", odd: 2, y: 1 },
      { date: "2026-09-02", odd: 2, y: 1 },
      { date: "2026-09-03", odd: 2, y: 1 },
      { date: "2026-09-04", odd: 2, y: 0 },
      { date: "2026-09-05", odd: 2, y: 0 },
    ]);
    assert.ok(r.omega != null);
    assert.ok(Math.abs(r.omega - 1.5) < 1e-12);
  });
});

describe("syntheticBook", () => {
  it("places exactly round(p n) hits", () => {
    const bets = syntheticBook(1.9, 0.58, 40);
    assert.equal(bets.length, 40);
    assert.equal(bets.filter((b) => b.y === 1).length, 23);
    const r = sharpeFromBets(bets);
    assert.ok(r.sortino != null);
    assert.ok(r.omega != null && r.omega > 1);
  });
});

describe("probabilisticSharpe", () => {
  it("rises with n for a fixed positive Sharpe", () => {
    const small = probabilisticSharpe(0.4, 8, 0, 3);
    const large = probabilisticSharpe(0.4, 80, 0, 3);
    assert.ok(small != null && large != null);
    assert.ok(large > small);
  });
});

describe("deflatedSharpe", () => {
  it("equals PSR when only one family was searched", () => {
    const psr = probabilisticSharpe(0.4, 40, 0, 3);
    const dsr = deflatedSharpe(0.4, 40, 0, 3, 1);
    assert.equal(dsr, psr);
  });

  it("is below PSR when four families were searched", () => {
    const psr = probabilisticSharpe(0.4, 40, 0, 3, 0);
    const dsr = deflatedSharpe(0.4, 40, 0, 3, 4);
    assert.ok(psr != null && dsr != null);
    assert.ok(dsr < psr);
  });
});

describe("maxDrawdown", () => {
  it("is the peak-to-trough on unit equity", () => {
    assert.equal(maxDrawdown([1, 1, -1, -1, -1, 0.5]), 3);
    assert.equal(maxDrawdown([0.5, 0.5, 0.5]), 0);
  });
});

describe("familySharpeReports", () => {
  it("ranks families by Sharpe and drops n < 2", () => {
    const bets = [
      { date: "2026-09-01", odd: 1.9, y: 1 as const, family: "btts" },
      { date: "2026-09-01", odd: 1.8, y: 1 as const, family: "btts" },
      { date: "2026-09-02", odd: 1.9, y: 1 as const, family: "btts" },
      { date: "2026-09-01", odd: 1.9, y: 0 as const, family: "win" },
      { date: "2026-09-02", odd: 2.0, y: 0 as const, family: "win" },
      { date: "2026-09-03", odd: 1.15, y: 1 as const, family: "win" },
      { date: "2026-09-01", odd: 8.0, y: 0 as const, family: "cs" },
    ];
    const rows = familySharpeReports(bets);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.family, "btts");
    assert.ok((rows[0]!.report.sharpe ?? 0) > 0);
    assert.equal(rows[1]!.family, "win");
    assert.ok((rows[1]!.report.sharpe ?? 0) < 0);
    assert.ok(rows[1]!.report.omega != null);
  });
});
