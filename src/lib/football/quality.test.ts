import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  avgForm,
  computeAbsoluteQuality,
  predictionTypeOf,
  qualityInputsFromPick,
  scoreForm,
  scoreH2H,
  scoreSampleMaturity,
  selectTopQualityPicks,
  toQualityCandidate,
  type QualityCandidate,
} from "./quality.ts";
import { selectDailyTen } from "./select.ts";
import type { MarketFamily, MarketKind, ScoredPick } from "./types.ts";

function cand(partial: Partial<QualityCandidate> & { id: string }): QualityCandidate {
  return {
    confidence: 60,
    expectedValue: 8,
    odds: { home: 1.9 },
    predictionType: "home_win",
    inputs: {
      formString: "WWDLW",
      h2hFavorable: 4,
      h2hTotal: 6,
      minGamesPlayed: 12,
      reliabilityScore: 80,
      leagueRating: 0.95,
    },
    ...partial,
  };
}

describe("quality component scorers", () => {
  it("weights recent form first", () => {
    assert.ok(scoreForm("WWWWW") > 90);
    assert.ok(scoreForm("LLLLL") < 5);
    assert.ok(scoreForm("WLLLL") > scoreForm("LLLLW"));
    assert.equal(scoreForm("WL"), 30);
  });

  it("rewards H2H dominance with sample-size shrink", () => {
    assert.ok(scoreH2H(5, 6, "home_win") > scoreH2H(2, 3, "home_win"));
    assert.ok(scoreH2H(3, 6, "draw") > scoreH2H(1, 6, "draw"));
    assert.equal(scoreH2H(0, 1, "home_win"), 35);
  });

  it("treats unknown sample as neutral and placeholder 0 as unusable", () => {
    assert.equal(scoreSampleMaturity(undefined), 60);
    assert.equal(scoreSampleMaturity(0), 0);
    assert.equal(scoreSampleMaturity(16), 95);
  });

  it("avgForm takes the worse letter so match-level picks need both sides solid", () => {
    assert.equal(avgForm("WWW", "LDL"), "LDL");
  });
});

describe("selectTopQualityPicks", () => {
  it("drops below the absolute floor even with fat confidence", () => {
    const result = selectTopQualityPicks([
      cand({
        id: "junk",
        confidence: 90,
        expectedValue: 20,
        inputs: {
          formString: "LLLLL",
          h2hFavorable: 0,
          h2hTotal: 2,
          minGamesPlayed: 2,
          reliabilityScore: 40,
          leagueRating: 0.5,
        },
      }),
      cand({ id: "good" }),
    ]);
    assert.deepEqual(result.keep, ["good"]);
    assert.ok(result.scored.find((s) => s.id === "junk")?.reason.startsWith("stage1_floor"));
  });

  it("small pool uses the stricter floor and may keep fewer than maxKeep", () => {
    const result = selectTopQualityPicks(
      [
        cand({ id: "a" }),
        cand({
          id: "mid",
          inputs: {
            formString: "WDLWD",
            h2hFavorable: 2,
            h2hTotal: 5,
            minGamesPlayed: 8,
            reliabilityScore: 60,
            leagueRating: 0.7,
          },
        }),
      ],
      { maxKeep: 5, smallPoolSize: 5, smallPoolFloor: 65, absoluteFloor: 55 },
    );
    assert.ok(result.keep.includes("a"));
    assert.ok(result.keep.length <= 2);
    assert.ok(result.keep.length < 5, "quality beats quota");
  });

  it("returns zero keep when nothing clears the bars", () => {
    const result = selectTopQualityPicks([
      cand({
        id: "thin",
        confidence: 40,
        expectedValue: 0,
        inputs: {
          formString: "LLL",
          minGamesPlayed: 0,
          reliabilityScore: 20,
          leagueRating: 0.4,
        },
      }),
    ]);
    assert.equal(result.keep.length, 0);
  });

  it("collects malformed rows without crashing", () => {
    const result = selectTopQualityPicks([{ id: "x" }, null, { foo: 1 }]);
    assert.ok(result.malformed.length >= 2);
  });
});

describe("qualityInputsFromPick", () => {
  it("uses home form for a home win and both sides for a total", () => {
    const base = {
      id: "p",
      fixtureId: 1,
      family: "win" as MarketFamily,
      kind: "home" as MarketKind,
      odd: 1.9,
      accuracy: 0.58,
      composite: 0.4,
      leagueId: 39,
      leagueWeight: 1,
      implied: 0.5,
      agreement: 0.7,
      selection: "Home",
      home: "Arsenal",
      away: "Fulham",
      facts: {
        homeRank: 1,
        awayRank: 10,
        homeForm: "WWWWW",
        awayForm: "LLLDL",
        homeGf: 2,
        homeGa: 0.8,
        awayGf: 1,
        awayGa: 1.6,
        homeOver15: 0.8,
        awayOver15: 0.5,
        h2hWins: 4,
        h2hDraws: 1,
        h2hLosses: 1,
        h2hN: 6,
        histWeight: 0.8,
        quality: 0.85,
        grade: "FULL_DATA" as const,
        coverageScore: 0.9,
        lineupConfirmed: true,
        homePlayed: 14,
        awayPlayed: 14,
      },
    } as ScoredPick;
    const home = qualityInputsFromPick(base);
    assert.equal(home.formString, "WWWWW");
    assert.equal(home.h2hFavorable, 4);
    assert.equal(home.minGamesPlayed, 14);
    const zeroPlayed = qualityInputsFromPick({
      ...base,
      facts: { ...base.facts!, homePlayed: 0, awayPlayed: 0 },
    });
    assert.equal(zeroPlayed.minGamesPlayed, undefined);
    const ou = qualityInputsFromPick({ ...base, family: "ou", kind: "over_25", selection: "Over 2.5" });
    assert.equal(ou.formString, "LLLDL");
    assert.equal(predictionTypeOf(base), "home_win");
    assert.equal(predictionTypeOf({ ...base, kind: "over_25" }), "draw");
  });
});

function line(opts: {
  id: string;
  fixtureId: number;
  family: MarketFamily;
  odd: number;
  accuracy: number;
  composite: number;
  leagueId?: number;
  implied?: number;
  kind?: MarketKind;
  facts?: ScoredPick["facts"];
}): ScoredPick {
  const kind: MarketKind =
    opts.kind ??
    (opts.family === "win" ? "home" : opts.family === "btts" ? "btts_yes" : opts.family === "cs" ? "cs" : "over_25");
  return {
    id: opts.id,
    fixtureId: opts.fixtureId,
    family: opts.family,
    kind,
    odd: opts.odd,
    accuracy: opts.accuracy,
    composite: opts.composite,
    leagueId: opts.leagueId ?? 39,
    implied: opts.implied,
    agreement: 0.7,
    leagueWeight: 0.9,
    bookmaker: "Pinnacle",
    selection: opts.family === "cs" ? "1-1" : "x",
    facts: opts.facts,
  } as ScoredPick;
}

function strongFacts(over: Partial<ScoredPick["facts"]> = {}): ScoredPick["facts"] {
  return {
    homeRank: 3,
    awayRank: 12,
    homeForm: "WWWDW",
    awayForm: "WDLWW",
    homeGf: 1.8,
    homeGa: 0.9,
    awayGf: 1.2,
    awayGa: 1.1,
    homeOver15: 0.7,
    awayOver15: 0.6,
    h2hWins: 4,
    h2hDraws: 1,
    h2hLosses: 1,
    h2hN: 6,
    histWeight: 0.8,
    quality: 0.82,
    grade: "FULL_DATA",
    coverageScore: 0.85,
    lineupConfirmed: true,
    homePlayed: 14,
    awayPlayed: 14,
    ...over,
  };
}

describe("selectDailyTen quality gate", () => {
  it("drops a FULL_DATA pick with rotten form even when composite is fat", () => {
    const junk = line({
      id: "rotten",
      fixtureId: 1,
      family: "win",
      odd: 1.9,
      accuracy: 0.62,
      composite: 0.99,
      facts: strongFacts({
        homeForm: "LLLLL",
        awayForm: "LLLLL",
        h2hWins: 0,
        h2hDraws: 0,
        h2hLosses: 6,
        h2hN: 6,
        homePlayed: 2,
        awayPlayed: 2,
        quality: 0.75,
      }),
    });
    const good = line({
      id: "solid",
      fixtureId: 2,
      family: "win",
      odd: 1.9,
      accuracy: 0.58,
      composite: 0.4,
      leagueId: 140,
      facts: strongFacts(),
    });
    const fold = selectDailyTen([junk, good]);
    assert.ok(!fold.some((p) => p.id === "rotten"), fold.map((p) => p.id).join(","));
    assert.ok(fold.some((p) => p.id === "solid"));
    assert.ok((fold[0]?.qualityGate?.absolute ?? 0) >= 55);
  });

  it("does not force a 10 when only two picks clear the quality bars", () => {
    const keepers = [
      line({
        id: "k1",
        fixtureId: 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.6,
        composite: 0.5,
        facts: strongFacts(),
      }),
      line({
        id: "k2",
        fixtureId: 2,
        family: "btts",
        odd: 1.91,
        accuracy: 0.58,
        composite: 0.45,
        leagueId: 140,
        facts: strongFacts({ homeForm: "WDWWW", h2hWins: 3, h2hDraws: 2, h2hN: 6 }),
      }),
    ];
    const filler = Array.from({ length: 8 }, (_, i) =>
      line({
        id: `f${i}`,
        fixtureId: 10 + i,
        family: i % 2 === 0 ? "win" : "ou",
        odd: 1.9,
        accuracy: 0.56,
        composite: 0.9,
        leagueId: 61 + i,
        kind: i % 2 === 0 ? "home" : "over_25",
        facts: strongFacts({
          homeForm: "LLLLL",
          awayForm: "LLLLL",
          h2hWins: 0,
          h2hDraws: 0,
          h2hLosses: 5,
          h2hN: 5,
          homePlayed: 3,
          awayPlayed: 3,
          quality: 0.72,
        }),
      }),
    );
    const fold = selectDailyTen([...keepers, ...filler]);
    assert.ok(fold.length < 10, `quota filled with junk: ${fold.map((p) => p.id).join(",")}`);
    assert.ok(fold.some((p) => p.id === "k1"));
    assert.ok(fold.every((p) => p.id === "k1" || p.id === "k2" || (p.qualityGate?.absolute ?? 100) >= 55));
  });

  it("absolute quality ranks a hot-form home above a cold one", () => {
    const hot = toQualityCandidate(
      line({
        id: "hot",
        fixtureId: 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.58,
        composite: 0.4,
        facts: strongFacts({ homeForm: "WWWWW" }),
      }),
    );
    const cold = toQualityCandidate(
      line({
        id: "cold",
        fixtureId: 2,
        family: "win",
        odd: 1.9,
        accuracy: 0.58,
        composite: 0.4,
        facts: strongFacts({ homeForm: "LLLWD" }),
      }),
    );
    assert.ok(computeAbsoluteQuality(hot).absolute > computeAbsoluteQuality(cold).absolute);
  });
});
