import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isDataBacked, focusBestBet, rankBestBets, selectDailyTen, selectDataBackedCombos, selectOverFocusCombo } from "./select.ts";
import type { MarketFamily, MarketKind, ScoredPick } from "./types.ts";

function line(opts: {
  id: string;
  fixtureId: number;
  family: MarketFamily;
  odd: number;
  accuracy: number;
  composite: number;
  leagueId?: number;
  implied?: number;
  agreement?: number;
  leagueWeight?: number;
  bookmaker?: string;
  kind?: MarketKind;
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
    agreement: opts.agreement ?? 0.7,
    leagueWeight: opts.leagueWeight ?? 0.9,
    bookmaker: opts.bookmaker ?? "Pinnacle",
    selection: opts.family === "cs" ? "1-1" : "x",
  } as ScoredPick;
}

describe("selectDailyTen CS eligibility", () => {
  it("does not force a CS onto a full 5–3–2 binary card", () => {
    const wins = Array.from({ length: 5 }, (_, i) =>
      line({
        id: `w${i}`,
        fixtureId: i + 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.55,
        composite: 0.4 - i * 0.01,
        leagueId: 39 + i,
      }),
    );
    const btts = Array.from({ length: 3 }, (_, i) =>
      line({
        id: `b${i}`,
        fixtureId: i + 10,
        family: "btts",
        odd: 1.91,
        accuracy: 0.55,
        composite: 0.35 - i * 0.01,
        leagueId: 140 + i,
      }),
    );
    const ou = Array.from({ length: 2 }, (_, i) =>
      line({
        id: `o${i}`,
        fixtureId: i + 20,
        family: "ou",
        odd: 1.88,
        accuracy: 0.62,
        composite: 0.33 - i * 0.01,
        leagueId: 78 + i,
      }),
    );
    const csGood = line({
      id: "cs-good",
      fixtureId: 30,
      family: "cs",
      odd: 7.2,
      accuracy: 0.14,
      implied: 0.11,
      composite: 0.11,
      leagueId: 135,
    });
    const csFakeBand = line({
      id: "cs-fake",
      fixtureId: 31,
      family: "cs",
      odd: 1.92,
      accuracy: 0.48,
      composite: 0.4,
      leagueId: 61,
    });

    const fold = selectDailyTen([...wins, ...btts, ...ou, csGood, csFakeBand]);
    const ids = fold.map((p) => p.id);
    assert.ok(!ids.includes("cs-good"), `CS should not bump a binary, got ${ids.join(",")}`);
    assert.ok(!ids.includes("cs-fake"));
    assert.equal(fold.filter((p) => p.family === "cs").length, 0);
    assert.equal(fold.length, 10);
  });

  it("lets a posted CS fill when the binary card is short", () => {
    const wins = Array.from({ length: 3 }, (_, i) =>
      line({
        id: `w${i}`,
        fixtureId: i + 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.55,
        composite: 0.4,
        leagueId: 39 + i,
      }),
    );
    const csGood = line({
      id: "cs-fill",
      fixtureId: 30,
      family: "cs",
      odd: 7.2,
      accuracy: 0.14,
      implied: 0.11,
      composite: 0.2,
      leagueId: 135,
    });
    const fold = selectDailyTen([...wins, csGood]);
    assert.ok(fold.some((p) => p.id === "cs-fill"));
  });

  it("drops Over 1.5 locks off the ten", () => {
    const lock = line({
      id: "o15-lock",
      fixtureId: 70,
      family: "ou",
      odd: 1.21,
      accuracy: 0.88,
      implied: 1 / 1.21,
      composite: 0.9,
      kind: "over_15",
    });
    const real = line({
      id: "o25",
      fixtureId: 71,
      family: "ou",
      odd: 1.91,
      accuracy: 0.56,
      implied: 1 / 1.91,
      composite: 0.4,
      kind: "over_25",
    });
    const fold = selectDailyTen([lock, real]);
    assert.equal(fold.map((p) => p.id).join(), "o25");
  });

  it("keeps a 1.72 home in the playable window", () => {
    const wide = line({
      id: "wide-home",
      fixtureId: 50,
      family: "win",
      odd: 1.72,
      accuracy: 0.58,
      implied: 0.52,
      composite: 0.4,
    });
    const fold = selectDailyTen([wide]);
    assert.equal(fold.map((p) => p.id).join(), "wide-home");
  });

  it("keeps a 1.28 favourite when the model has edge", () => {
    const short = line({
      id: "chelsea",
      fixtureId: 61,
      family: "win",
      odd: 1.28,
      accuracy: 0.82,
      implied: 1 / 1.28,
      composite: 0.55,
    });
    assert.equal(selectDailyTen([short]).map((p) => p.id).join(), "chelsea");
  });

  it("keeps a 3.40 away when the model has edge", () => {
    const dog = line({
      id: "dog",
      fixtureId: 62,
      family: "win",
      odd: 3.4,
      accuracy: 0.38,
      implied: 1 / 3.4,
      composite: 0.5,
      kind: "away",
    });
    assert.equal(selectDailyTen([dog]).length, 0, "0.38 away still fails the 51% win floor");
    const overlay = line({
      id: "overlay",
      fixtureId: 63,
      family: "win",
      odd: 3.4,
      accuracy: 0.54,
      implied: 1 / 3.4,
      composite: 0.5,
      kind: "away",
    });
    assert.equal(selectDailyTen([overlay]).map((p) => p.id).join(), "overlay");
  });

  it("drops a 50% home even when EV is positive", () => {
    const mid = line({
      id: "mid-home",
      fixtureId: 40,
      family: "win",
      odd: 2,
      accuracy: 0.5,
      implied: 0.48,
      composite: 0.9,
    });
    assert.equal(selectDailyTen([mid]).length, 0);
  });

  it("drops a 45% home at 1.90 as negative EV", () => {
    const bad = line({
      id: "bad-ev",
      fixtureId: 99,
      family: "win",
      odd: 1.9,
      accuracy: 0.45,
      composite: 0.9,
    });
    const good = line({
      id: "good-ev",
      fixtureId: 100,
      family: "win",
      odd: 1.9,
      accuracy: 0.56,
      composite: 0.4,
    });
    const fold = selectDailyTen([bad, good]);
    assert.ok(!fold.some((p) => p.id === "bad-ev"));
    assert.ok(fold.some((p) => p.id === "good-ev"));
  });

  it("drops UNUSABLE-grade fixtures even with a fat composite", () => {
    const junk = line({
      id: "junk",
      fixtureId: 77,
      family: "win",
      odd: 1.9,
      accuracy: 0.6,
      composite: 0.9,
    });
    junk.facts = {
      homeRank: null,
      awayRank: null,
      homeForm: null,
      awayForm: null,
      homeGf: null,
      homeGa: null,
      awayGf: null,
      awayGa: null,
      homeOver15: null,
      awayOver15: null,
      h2hWins: 0,
      h2hDraws: 0,
      h2hLosses: 0,
      h2hN: 0,
      histWeight: 0.32,
      quality: 0.1,
      grade: "UNUSABLE",
      coverageScore: 0,
      lineupConfirmed: false,
    };
    assert.equal(selectDailyTen([junk]).length, 0);
  });

  it("drops LOW_DATA (thin sample) even with a fat composite", () => {
    const thin = line({
      id: "thin",
      fixtureId: 78,
      family: "ou",
      odd: 1.93,
      accuracy: 0.72,
      composite: 0.9,
      kind: "over_25",
    });
    thin.facts = {
      homeRank: null,
      awayRank: null,
      homeForm: "LWWL",
      awayForm: "WWWL",
      homeGf: 2.8,
      homeGa: 3.0,
      awayGf: 2.3,
      awayGa: 1.0,
      homeOver15: 0.8,
      awayOver15: 0.7,
      h2hWins: 0,
      h2hDraws: 0,
      h2hLosses: 0,
      h2hN: 0,
      histWeight: 0.32,
      quality: 0.3,
      grade: "LOW_DATA",
      coverageScore: 0.2,
      lineupConfirmed: false,
    };
    assert.equal(selectDailyTen([thin]).length, 0);
  });

  it("drops a market coin below the book and a model-fair CS", () => {
    const coin = line({
      id: "coin",
      fixtureId: 1,
      family: "win",
      odd: 1.9,
      accuracy: 0.48,
      implied: 0.526,
      composite: 0.9,
    });
    const fair = line({
      id: "fair-cs",
      fixtureId: 2,
      family: "cs",
      odd: 7.5,
      accuracy: 0.14,
      implied: 0.1,
      composite: 0.5,
      bookmaker: "Model fair",
    });
    const thin = line({
      id: "youth",
      fixtureId: 3,
      family: "win",
      odd: 1.9,
      accuracy: 0.58,
      implied: 0.5,
      composite: 0.8,
      leagueWeight: 0.28,
    });
    const good = line({
      id: "edge",
      fixtureId: 4,
      family: "win",
      odd: 1.9,
      accuracy: 0.56,
      implied: 0.52,
      composite: 0.4,
    });
    const fold = selectDailyTen([coin, fair, thin, good]);
    const ids = fold.map((p) => p.id);
    assert.deepEqual(ids, ["edge"]);
  });

  it("keeps a priced favourite sitting on the book", () => {
    const priced = line({
      id: "priced",
      fixtureId: 8,
      family: "win",
      odd: 1.82,
      accuracy: 0.55,
      implied: 0.55,
      composite: 0.4,
    });
    const fold = selectDailyTen([priced]);
    assert.equal(fold.map((p) => p.id).join(), "priced");
  });

  it("drops a short home with no Kelly and a negative posted edge", () => {
    const dead = line({
      id: "raith",
      fixtureId: 12,
      family: "win",
      odd: 1.68,
      accuracy: 0.58,
      implied: 0.559,
      composite: 0.5,
    });
    dead.edge = -0.027;
    dead.value = 0.532;
    dead.kellyQuarter = 0;
    assert.equal(selectDailyTen([dead]).length, 0);
  });
});

describe("selectDailyTen extra families", () => {
  function pack532() {
    const wins = Array.from({ length: 5 }, (_, i) =>
      line({
        id: `w${i}`,
        fixtureId: i + 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.55,
        composite: 0.4 - i * 0.01,
        leagueId: 39 + i,
      }),
    );
    const btts = Array.from({ length: 3 }, (_, i) =>
      line({
        id: `b${i}`,
        fixtureId: i + 10,
        family: "btts",
        odd: 1.91,
        accuracy: 0.55,
        composite: 0.35 - i * 0.01,
        leagueId: 140 + i,
      }),
    );
    const ou = Array.from({ length: 2 }, (_, i) =>
      line({
        id: `o${i}`,
        fixtureId: i + 20,
        family: "ou",
        odd: 1.88,
        accuracy: 0.62,
        implied: 1 / 1.88,
        composite: 0.33 - i * 0.01,
        leagueId: 78 + i,
        kind: "over_25",
      }),
    );
    return [...wins, ...btts, ...ou];
  }

  it("extra O/U cannot bump Over 2.5 off a full 5–3–2", () => {
    const over35 = line({
      id: "ou-35",
      fixtureId: 88,
      family: "ou",
      odd: 1.95,
      accuracy: 0.7,
      implied: 1 / 1.95,
      composite: 0.95,
      leagueId: 135,
      kind: "over_35",
    });
    const fold = selectDailyTen([...pack532(), over35]);
    const ids = fold.map((p) => p.id);
    assert.ok(!ids.includes("ou-35"), `extra O/U stole a 2.5 seat: ${ids.join(",")}`);
    assert.equal(fold.filter((p) => p.kind === "over_25").length, 2);
    assert.equal(fold.filter((p) => p.family === "win").length, 5);
    assert.equal(fold.filter((p) => p.family === "btts").length, 3);
    assert.equal(fold.length, 10);
  });

  it("Asian totals cannot bump Over 2.5 off a full 5–3–2", () => {
    const asian = line({
      id: "ou-asian",
      fixtureId: 91,
      family: "ou",
      odd: 1.82,
      accuracy: 0.72,
      implied: 1 / 1.82,
      composite: 0.99,
      leagueId: 135,
      kind: "ou_asian",
    });
    const fold = selectDailyTen([...pack532(), asian]);
    assert.ok(!fold.some((p) => p.id === "ou-asian"));
    assert.equal(fold.filter((p) => p.kind === "over_25").length, 2);
  });

  it("double chance fills a short card on pass 2", () => {
    const wins = Array.from({ length: 3 }, (_, i) =>
      line({
        id: `w${i}`,
        fixtureId: i + 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.55,
        composite: 0.4,
        leagueId: 39 + i,
      }),
    );
    const dc = line({
      id: "dc-fill",
      fixtureId: 50,
      family: "dc",
      odd: 1.45,
      accuracy: 0.74,
      implied: 1 / 1.45,
      composite: 0.32,
      leagueId: 135,
      kind: "dc_1x",
    });
    const fold = selectDailyTen([...wins, dc]);
    assert.ok(fold.some((p) => p.id === "dc-fill"), `DC missing from short card: ${fold.map((p) => p.id).join(",")}`);
  });

  it("player G∪A never occupies a ten slot", () => {
    const player = line({
      id: "player",
      fixtureId: 70,
      family: "player",
      odd: 1.8,
      accuracy: 0.55,
      implied: 1 / 1.8,
      composite: 0.4,
      leagueId: 39,
      kind: "player_ga",
    });
    const fold = selectDailyTen([...pack532(), player]);
    assert.equal(fold.filter((p) => ["win", "btts", "ou"].includes(p.family)).length, 10);
    assert.ok(!fold.some((p) => p.kind === "player_ga"));
    const short = selectDailyTen([
      ...pack532().slice(0, 8),
      player,
    ]);
    assert.ok(!short.some((p) => p.kind === "player_ga"));
  });

  it("draw with zero Kelly still fills a short card (EV floor 0.92)", () => {
    const wins = Array.from({ length: 3 }, (_, i) =>
      line({
        id: `w${i}`,
        fixtureId: i + 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.55,
        composite: 0.4,
        leagueId: 39 + i,
      }),
    );
    const draw = {
      ...line({
        id: "draw-fill",
        fixtureId: 61,
        family: "draw",
        odd: 3.2,
        accuracy: 0.32,
        implied: 1 / 3.2,
        composite: 0.28,
        leagueId: 140,
        kind: "draw",
      }),
      kellyQuarter: 0,
      edge: 0.32 - 1 / 3.2,
    } as ScoredPick;
    const fold = selectDailyTen([...wins, draw]);
    assert.ok(
      fold.some((p) => p.id === "draw-fill"),
      `draw missing from short card: ${fold.map((p) => p.id).join(",")}`,
    );
  });

  it("multi / parity / combo cannot bump a full 5–3–2", () => {
    const extras = [
      line({
        id: "multi",
        fixtureId: 200,
        family: "multi",
        odd: 2.05,
        accuracy: 0.5,
        implied: 1 / 2.05,
        composite: 0.99,
        leagueId: 135,
        kind: "multi_goals",
      }),
      line({
        id: "parity",
        fixtureId: 201,
        family: "parity",
        odd: 1.9,
        accuracy: 0.58,
        implied: 1 / 1.9,
        composite: 0.99,
        leagueId: 61,
        kind: "odd_even",
      }),
      line({
        id: "combo",
        fixtureId: 202,
        family: "combo",
        odd: 2.4,
        accuracy: 0.5,
        implied: 1 / 2.4,
        composite: 0.99,
        leagueId: 78,
        kind: "combo",
      }),
    ];
    const fold = selectDailyTen([...pack532(), ...extras]);
    const ids = fold.map((p) => p.id);
    assert.ok(!ids.includes("multi") && !ids.includes("parity") && !ids.includes("combo"), ids.join(","));
    assert.equal(fold.filter((p) => p.family === "win").length, 5);
    assert.equal(fold.filter((p) => p.family === "btts").length, 3);
    assert.equal(fold.filter((p) => p.kind === "over_25").length, 2);
    assert.equal(fold.length, 10);
  });
});

describe("rankBestBets AAVS", () => {
  function facts() {
    return {
      homeRank: null,
      awayRank: null,
      homeForm: "WWWDW",
      awayForm: "WDLWW",
      homeGf: null,
      homeGa: null,
      awayGf: null,
      awayGa: null,
      homeOver15: null,
      awayOver15: null,
      h2hWins: 4,
      h2hDraws: 1,
      h2hLosses: 1,
      h2hN: 6,
      histWeight: 0.7,
      quality: 0.8,
      grade: "FULL_DATA" as const,
      coverageScore: 0.8,
      lineupConfirmed: true,
      homePlayed: 14,
      awayPlayed: 14,
    };
  }

  it("gates quality, agreement and EV then prefers higher accuracy on a 5% AAVS tie", () => {
    const weakQ = {
      ...line({
        id: "weak-q",
        fixtureId: 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.7,
        implied: 0.5,
        composite: 0.9,
      }),
      aavs: 0.9,
      edge: 0.2,
      facts: { ...facts(), quality: 0.4 },
    } as ScoredPick;
    const weakA = {
      ...line({
        id: "weak-a",
        fixtureId: 2,
        family: "win",
        odd: 1.9,
        accuracy: 0.7,
        implied: 0.5,
        composite: 0.9,
        agreement: 0.4,
      }),
      aavs: 0.9,
      edge: 0.2,
      facts: facts(),
    } as ScoredPick;
    const a = {
      ...line({
        id: "a",
        fixtureId: 3,
        family: "win",
        odd: 1.9,
        accuracy: 0.6,
        implied: 0.5,
        composite: 0.5,
      }),
      aavs: 0.2,
      edge: 0.08,
      facts: facts(),
    } as ScoredPick;
    const b = {
      ...line({
        id: "b",
        fixtureId: 4,
        family: "win",
        odd: 1.9,
        accuracy: 0.7,
        implied: 0.5,
        composite: 0.5,
      }),
      aavs: 0.202,
      edge: 0.08,
      facts: facts(),
    } as ScoredPick;
    const ranked = rankBestBets([weakQ, weakA, a, b]);
    assert.equal(ranked.best?.id, "b");
    assert.deepEqual(
      ranked.alternates.map((p) => p.id),
      ["a"],
    );
  });

  it("does not headline PARTIAL_DATA, a combo, or an ungated leftover", () => {
    const partial = {
      ...line({
        id: "partial",
        fixtureId: 10,
        family: "win",
        odd: 1.9,
        accuracy: 0.72,
        implied: 0.5,
        composite: 0.99,
      }),
      aavs: 0.99,
      edge: 0.22,
      facts: { ...facts(), grade: "PARTIAL_DATA" as const, quality: 0.5, homePlayed: 3, awayPlayed: 3 },
    } as ScoredPick;
    const combo = {
      ...line({
        id: "combo-best",
        fixtureId: 11,
        family: "combo",
        odd: 2.47,
        accuracy: 0.56,
        implied: 0.4,
        composite: 0.99,
        kind: "combo",
      }),
      aavs: 0.95,
      edge: 0.39,
      facts: facts(),
    } as ScoredPick;
    const thinSample = {
      ...line({
        id: "thin-n",
        fixtureId: 12,
        family: "win",
        odd: 1.9,
        accuracy: 0.7,
        implied: 0.5,
        composite: 0.9,
      }),
      aavs: 0.9,
      edge: 0.2,
      facts: { ...facts(), homePlayed: 2, awayPlayed: 2, lastNHome: 2, lastNAway: 2 },
    } as ScoredPick;
    const ranked = rankBestBets([partial, combo, thinSample]);
    assert.equal(ranked.best, null);
    assert.equal(ranked.alternates.length, 0);
    assert.equal(
      selectDataBackedCombos([{ ...combo, facts: { ...facts(), grade: "PARTIAL_DATA" as const, quality: 0.5 } }]).length,
      0,
    );
  });
});

describe("data-backed ten", () => {
  const backed = {
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
    grade: "FULL_DATA" as const,
    coverageScore: 0.85,
    lineupConfirmed: true,
    homePlayed: 14,
    awayPlayed: 14,
  };

  it("isDataBacked requires last-five and sample on a graded pick", () => {
    const full = {
      ...line({ id: "f", fixtureId: 1, family: "win", odd: 1.9, accuracy: 0.6, composite: 0.4 }),
      facts: backed,
    } as ScoredPick;
    assert.equal(isDataBacked(full, "best"), true);
    assert.equal(isDataBacked({ ...full, facts: { ...backed, grade: "PARTIAL_DATA", quality: 0.5 } }, "best"), false);
    assert.equal(isDataBacked({ ...full, facts: { ...backed, homePlayed: 2, awayPlayed: 2 } }, "ten"), false);
  });

  it("a short card does not fill with combo / parity / multi", () => {
    const wins = Array.from({ length: 3 }, (_, i) =>
      line({
        id: `w${i}`,
        fixtureId: i + 1,
        family: "win",
        odd: 1.9,
        accuracy: 0.55,
        composite: 0.4,
        leagueId: 39 + i,
      }),
    );
    const extras = [
      line({
        id: "combo-fill",
        fixtureId: 90,
        family: "combo",
        odd: 2.4,
        accuracy: 0.5,
        implied: 1 / 2.4,
        composite: 0.99,
        leagueId: 78,
        kind: "combo",
      }),
      line({
        id: "parity-fill",
        fixtureId: 91,
        family: "parity",
        odd: 1.9,
        accuracy: 0.58,
        implied: 1 / 1.9,
        composite: 0.99,
        leagueId: 61,
        kind: "odd_even",
      }),
    ];
    const fold = selectDailyTen([...wins, ...extras]);
    const ids = fold.map((p) => p.id);
    assert.ok(!ids.includes("combo-fill") && !ids.includes("parity-fill"), ids.join(","));
  });

  it("PARTIAL_DATA without last-five stays off the ten", () => {
    const thin = line({
      id: "no-form",
      fixtureId: 1,
      family: "win",
      odd: 1.9,
      accuracy: 0.62,
      implied: 0.5,
      composite: 0.9,
    });
    thin.facts = {
      homeRank: null,
      awayRank: null,
      homeForm: null,
      awayForm: null,
      homeGf: null,
      homeGa: null,
      awayGf: null,
      awayGa: null,
      homeOver15: null,
      awayOver15: null,
      h2hWins: 0,
      h2hDraws: 0,
      h2hLosses: 0,
      h2hN: 0,
      histWeight: 0.3,
      quality: 0.5,
      grade: "PARTIAL_DATA",
      coverageScore: 0.4,
      lineupConfirmed: false,
      homePlayed: 4,
      awayPlayed: 4,
    };
    assert.equal(selectDailyTen([thin]).length, 0);
  });
});

function overLeg(opts: {
  id: string;
  fixtureId: number;
  kind: "home_score" | "away_score" | "over_15" | "over_25";
  odd: number;
  accuracy: number;
  home: string;
  away: string;
}): ScoredPick {
  const implied = 1 / opts.odd;
  return {
    ...line({
      id: opts.id,
      fixtureId: opts.fixtureId,
      family: opts.kind === "over_15" || opts.kind === "over_25" ? "ou" : "team",
      kind: opts.kind,
      odd: opts.odd,
      accuracy: opts.accuracy,
      implied,
      composite: 0.4,
      agreement: 0.7,
    }),
    home: opts.home,
    away: opts.away,
    selection: opts.kind === "home_score" ? "Home to score" : opts.kind === "away_score" ? "Away to score" : opts.kind === "over_25" ? "Over 2.5" : "Over 1.5",
    edge: opts.accuracy - implied,
    facts: {
      homeGf: 1.4,
      awayGf: 1.1,
      homeGa: 1,
      awayGa: 1,
      lastNHome: 8,
      lastNAway: 8,
      quality: 0.8,
      grade: "FULL_DATA",
      h2hN: 0,
      h2hWins: 0,
      h2hDraws: 0,
      h2hLosses: 0,
    },
  } as ScoredPick;
}

describe("over focus combo", () => {
  it("builds a 2.00+ ticket from two team overs and makes it Best", () => {
    const a = overLeg({ id: "a", fixtureId: 1, kind: "home_score", odd: 1.4, accuracy: 0.8, home: "Arsenal", away: "Wolves" });
    const b = overLeg({ id: "b", fixtureId: 2, kind: "away_score", odd: 1.5, accuracy: 0.78, home: "Leeds", away: "Everton" });
    const single = line({
      id: "win",
      fixtureId: 9,
      family: "win",
      odd: 1.9,
      accuracy: 0.62,
      composite: 0.99,
      agreement: 0.8,
    });
    single.facts = a.facts;
    single.edge = 0.1;
    const ticket = selectOverFocusCombo([a, b, single]);
    assert.ok(ticket);
    assert.ok(ticket!.odd >= 2);
    assert.equal(ticket!.comboLegs?.length, 2);
    assert.ok(Math.abs(ticket!.accuracy - 0.8 * 0.78) < 1e-9);
    assert.ok(ticket!.selection.includes("Arsenal over 0.5"));
    assert.ok(ticket!.selection.includes("Everton over 0.5"));
    const ten = selectDailyTen([a, b, ticket!]);
    assert.ok(!ten.some((p) => p.kind === "combo"));
    const focused = focusBestBet([a, b, single]);
    assert.equal(focused.best?.kind, "combo");
    assert.ok((focused.best?.odd ?? 0) >= 2);
    assert.notEqual(focused.best?.id, "win");
  });

  it("rejects a product under 2.00", () => {
    const a = overLeg({ id: "a", fixtureId: 1, kind: "home_score", odd: 1.2, accuracy: 0.9, home: "A", away: "B" });
    const b = overLeg({ id: "b", fixtureId: 2, kind: "over_15", odd: 1.3, accuracy: 0.85, home: "C", away: "D" });
    assert.equal(selectOverFocusCombo([a, b]), null);
  });

  it("uses the same-match joint and does not stack over 1.5 on both teams scoring", () => {
    const home = overLeg({ id: "h", fixtureId: 1, kind: "home_score", odd: 1.5, accuracy: 0.8, home: "Home", away: "Away" });
    const away = overLeg({ id: "a", fixtureId: 1, kind: "away_score", odd: 1.5, accuracy: 0.8, home: "Home", away: "Away" });
    const over = overLeg({ id: "o", fixtureId: 1, kind: "over_15", odd: 1.3, accuracy: 0.84, home: "Home", away: "Away" });
    const block = {
      ...home,
      id: "block",
      kind: "combo" as const,
      family: "combo" as const,
      odd: 2.25,
      accuracy: 0.4,
      implied: 1 / 2.25,
      edge: 0.4 * 2.25 - 1,
      notes: ["over-focus-block"],
      comboLegs: [
        { kind: "home_score" as const, selection: "Home to score", odd: 1.5 },
        { kind: "away_score" as const, selection: "Away to score", odd: 1.5 },
      ],
    };
    assert.equal(selectOverFocusCombo([home, away, over, block]), null);
    const priced = { ...block, accuracy: 0.5, edge: 0.5 * 2.25 - 1 };
    const ticket = selectOverFocusCombo([home, away, over, priced]);
    assert.ok(ticket);
    assert.equal(ticket!.accuracy, 0.5);
    assert.equal(ticket!.comboLegs?.length, 2);
    assert.ok(!ticket!.comboLegs?.some((l) => l.kind === "over_15"));
  });

  it("pairs a team over 0.5 with over 2.5 when the product reaches 2.00", () => {
    const team = overLeg({ id: "h", fixtureId: 1, kind: "home_score", odd: 1.35, accuracy: 0.8, home: "Arsenal", away: "Wolves" });
    const ou = overLeg({ id: "o", fixtureId: 2, kind: "over_25", odd: 1.7, accuracy: 0.72, home: "Leeds", away: "Everton" });
    const ticket = selectOverFocusCombo([team, ou]);
    assert.ok(ticket);
    assert.ok(ticket!.odd >= 2);
    assert.ok(Math.abs(ticket!.odd - 1.35 * 1.7) < 1e-9);
    assert.ok(ticket!.selection.includes("Arsenal over 0.5"));
    assert.ok(ticket!.selection.includes("over 2.5"));
    assert.ok(Math.abs(ticket!.accuracy - 0.8 * 0.72) < 1e-9);
    const short = overLeg({ id: "s", fixtureId: 3, kind: "over_25", odd: 1.4, accuracy: 0.75, home: "A", away: "B" });
    assert.equal(selectOverFocusCombo([team, short]), null);
  });
});

