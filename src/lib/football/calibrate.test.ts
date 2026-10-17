import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CAL_DC_FLOOR,
  CAL_MIN_N,
  CAL_N0,
  CAL_SHIN_CAP,
  applyPlatt,
  brierScore,
  backtestMeanFit,
  calibrateFamily,
  cardCalibration,
  combinatoriallySymmetricPBO,
  dieboldMariano,
  fitFamilyWeights,
  fitPlattMap,
  plattMethodTrace,
  inverseBrierWeights,
  logLossScore,
  mergeObservations,
  mixExpertP,
  mixLeastSquaresWeights,
  mixWeights,
  observationFromPick,
  poolLogitP,
  priorSnapshot,
  makeReport,
  reliabilityDiagram,
  selectFitMethod,
  shiftYmd,
  snapshotFromObservations,
  studentTCdf,
  trainCutoff,
  walkForwardOptimize,
  walkForwardOptimizePair,
  walkForwardValidate,
  whiteRealityCheck,
  validationContrast,
  WFO_GRID,
  type CalibrationObservation,
  type ExpertWeights,
} from "./calibrate.ts";
import { accuracyPriors, ensembleForKind, valuePriors } from "./models.ts";
import type { ScoredPick } from "./types.ts";

function w(partial: Partial<ExpertWeights>): ExpertWeights {
  return { dc: 0.4, shin: 0.25, api: 0.1, elo: 0.15, h2h: 0.1, ...partial };
}

function obs(opts: {
  date: string;
  family?: CalibrationObservation["family"];
  y: 0 | 1;
  p: Partial<CalibrationObservation["p"]>;
  accuracy?: number;
  fixtureId?: number;
  kind?: CalibrationObservation["kind"];
}): CalibrationObservation {
  const p = { dc: 0.5, shin: 0.5, api: 0.5, elo: 0.5, h2h: 0.5, ...opts.p };
  return {
    date: opts.date,
    fixtureId: opts.fixtureId ?? 1,
    kind: opts.kind ?? "home",
    family: opts.family ?? "win",
    selection: "Home",
    y: opts.y,
    p,
    accuracy: opts.accuracy ?? p.dc ?? 0.5,
  };
}

describe("Brier and log-loss", () => {
  it("perfect 1.0 on a hit is ~0 Brier", () => {
    assert.ok(brierScore(0.999, 1) < 1e-5);
    assert.ok(brierScore(0.0001, 0) < 1e-5);
  });

  it("a coin flip costs 0.25 Brier", () => {
    assert.ok(Math.abs(brierScore(0.5, 1) - 0.25) < 1e-9);
    assert.ok(Math.abs(brierScore(0.5, 0) - 0.25) < 1e-9);
  });

  it("log-loss is worse for a confident miss than a coin", () => {
    assert.ok(logLossScore(0.9, 0) > logLossScore(0.5, 0));
    assert.ok(logLossScore(0.9, 1) < logLossScore(0.5, 1));
  });
});

describe("inverse-Brier weights", () => {
  it("gives more mass to the lower-Brier expert", () => {
    const prior = w({});
    const brier = w({ dc: 0.12, shin: 0.22, api: 0.24, elo: 0.23, h2h: 0.25 });
    const nBy = w({ dc: 40, shin: 40, api: 40, elo: 40, h2h: 40 });
    const emp = inverseBrierWeights(brier, nBy, prior);
    assert.ok(emp.dc > emp.shin, `dc ${emp.dc} vs shin ${emp.shin}`);
    assert.ok(emp.dc > emp.api);
  });

  it("value path drops Shin", () => {
    const prior = valuePriors("win") as ExpertWeights;
    const brier = w({ dc: 0.18, shin: 0.11, api: 0.22, elo: 0.2, h2h: 0.21 });
    const nBy = w({ dc: 40, shin: 40, api: 40, elo: 40, h2h: 40 });
    const emp = inverseBrierWeights(brier, nBy, prior, { dropShin: true });
    assert.equal(emp.shin, 0);
    assert.ok(emp.dc > emp.api);
  });

  it("falls back to the prior when nobody has enough sample", () => {
    const prior = accuracyPriors("win") as ExpertWeights;
    const emp = inverseBrierWeights(w({ dc: 0.1 }), w({ dc: 2, shin: 2, api: 2, elo: 2, h2h: 2 }), prior);
    assert.equal(emp.dc, prior.dc);
    assert.equal(emp.shin, prior.shin);
  });
});

describe("shrinkage and guardrails", () => {
  it("n = 0 is the prior", () => {
    const prior = accuracyPriors("btts") as ExpertWeights;
    const mixed = mixWeights(w({ dc: 0.9, shin: 0.02, api: 0.02, elo: 0.03, h2h: 0.03 }), prior, 0);
    assert.ok(Math.abs(mixed.dc - prior.dc) < 1e-12);
  });

  it("mix is a convex combination", () => {
    const prior = w({ dc: 0.5, shin: 0.2, api: 0.1, elo: 0.1, h2h: 0.1 });
    const emp = w({ dc: 0.2, shin: 0.5, api: 0.1, elo: 0.1, h2h: 0.1 });
    const mixed = mixWeights(emp, prior, CAL_N0);
    assert.ok(Math.abs(mixed.dc - 0.35) < 0.02, `dc ${mixed.dc}`);
  });

  it("stays on the prior below the sample floor", () => {
    const rows = Array.from({ length: CAL_MIN_N - 1 }, (_, i) =>
      obs({
        date: "2026-09-10",
        y: 1,
        fixtureId: i + 1,
        p: { dc: 0.9, shin: 0.2, api: 0.2, elo: 0.2, h2h: 0.2 },
        accuracy: 0.9,
      }),
    );
    const cal = calibrateFamily(rows, "win");
    const prior = accuracyPriors("win") as ExpertWeights;
    assert.equal(cal.n, CAL_MIN_N - 1);
    assert.ok(Math.abs(cal.acc.dc - prior.dc) < 1e-9);
  });

  it("Shin cannot exceed the cap even with a dominant book Brier", () => {
    const rows = Array.from({ length: 80 }, (_, i) =>
      obs({
        date: "2026-09-10",
        y: 1,
        fixtureId: i + 1,
        p: { dc: 0.55, shin: 0.92, api: 0.4, elo: 0.4, h2h: 0.4 },
        accuracy: 0.7,
      }),
    );
    const cal = calibrateFamily(rows, "win");
    assert.ok(cal.acc.shin <= CAL_SHIN_CAP + 1e-9, `shin ${cal.acc.shin}`);
    assert.ok(cal.acc.dc >= CAL_DC_FLOOR - 1e-9, `dc ${cal.acc.dc}`);
    assert.equal(cal.val.shin, 0);
  });

  it("weights sum to 1", () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      obs({
        date: "2026-09-11",
        y: i % 3 === 0 ? 0 : 1,
        fixtureId: i + 1,
        p: { dc: 0.62, shin: 0.55, api: 0.5, elo: 0.48, h2h: 0.44 },
      }),
    );
    const cal = calibrateFamily(rows, "win");
    const accSum = cal.acc.dc + cal.acc.shin + cal.acc.api + cal.acc.elo + cal.acc.h2h;
    const valSum = cal.val.dc + cal.val.shin + cal.val.api + cal.val.elo + cal.val.h2h;
    assert.ok(Math.abs(accSum - 1) < 1e-9, `acc ${accSum}`);
    assert.ok(Math.abs(valSum - 1) < 1e-9, `val ${valSum}`);
  });
});

describe("mix least-squares and OOS rule pick", () => {
  it("concentrates on the sharp expert when a second expert is a noisy clone", () => {
    const rows = Array.from({ length: 40 }, (_, i) => {
      const y: 0 | 1 = i % 2 === 0 ? 1 : 0;
      const dc = y ? 0.78 : 0.22;
      return obs({
        date: "2026-09-10",
        y,
        fixtureId: i + 1,
        p: { dc, shin: 0.5, api: 0.5, elo: 0.5, h2h: 0.5 },
      });
    });
    const prior = accuracyPriors("win") as ExpertWeights;
    const ls = mixLeastSquaresWeights(rows, prior, { asOf: "2026-09-10" });
    const { brier, nBy } = (() => {
      const brier = { dc: 0, shin: 0, api: 0, elo: 0, h2h: 0 };
      const nBy = { dc: 40, shin: 40, api: 40, elo: 40, h2h: 40 };
      for (const o of rows) {
        for (const k of ["dc", "shin", "api", "elo", "h2h"] as const) {
          const p = o.p[k] ?? 0.5;
          brier[k] += (p - o.y) * (p - o.y);
        }
      }
      for (const k of ["dc", "shin", "api", "elo", "h2h"] as const) brier[k] /= 40;
      return { brier, nBy };
    })();
    const ib = inverseBrierWeights(brier as ExpertWeights, nBy as ExpertWeights, prior);
    assert.ok(ls.dc > prior.dc, `ls dc ${ls.dc} vs prior ${prior.dc}`);
    assert.ok(ib.dc > prior.dc, `ib dc ${ib.dc} vs prior ${prior.dc}`);
    assert.ok(ls.dc > ls.shin, `ls dc ${ls.dc} vs shin ${ls.shin}`);
    assert.ok(ls.shin <= CAL_SHIN_CAP + 1e-9);
    assert.ok(ls.dc >= CAL_DC_FLOOR - 1e-9);
  });

  it("picks mix-ls when it beats the prior out of sample, otherwise stays on the prior", () => {
    const sharp = Array.from({ length: 24 }, (_, i) =>
      obs({
        date: "2026-09-12",
        y: 1,
        fixtureId: i + 1,
        p: { dc: 0.86, shin: 0.52, api: 0.5, elo: 0.5, h2h: 0.5 },
      }),
    );
    const later = Array.from({ length: 24 }, (_, i) =>
      obs({
        date: "2026-09-13",
        y: 1,
        fixtureId: 50 + i,
        p: { dc: 0.86, shin: 0.52, api: 0.5, elo: 0.5, h2h: 0.5 },
      }),
    );
    const picked = selectFitMethod([...sharp, ...later], "win", "2026-09-14");
    assert.notEqual(picked.method, "prior");
    assert.ok(picked.oosBrier <= picked.oosPrior + 1e-9);

    const noise = [
      ...Array.from({ length: 24 }, (_, i) =>
        obs({
          date: "2026-09-12",
          y: (i % 2) as 0 | 1,
          fixtureId: i + 1,
          p: { dc: 0.9, shin: 0.1, api: 0.1, elo: 0.1, h2h: 0.1 },
        }),
      ),
      ...Array.from({ length: 24 }, (_, i) =>
        obs({
          date: "2026-09-13",
          y: ((i + 1) % 2) as 0 | 1,
          fixtureId: 50 + i,
          p: { dc: 0.9, shin: 0.1, api: 0.1, elo: 0.1, h2h: 0.1 },
        }),
      ),
    ];
    const safe = selectFitMethod(noise, "win", "2026-09-14");
    assert.ok(safe.method === "prior" || safe.method === "prior-platt", safe.method);
    assert.notEqual(safe.method, "mix-ls");
    assert.notEqual(safe.method, "inverse-brier");
  });

  it("live snapshot records the chosen rule", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      obs({
        date: "2026-09-14",
        y: 1,
        fixtureId: i + 1,
        p: { dc: 0.88, shin: 0.5, api: 0.4, elo: 0.4, h2h: 0.4 },
      }),
    );
    const applied = snapshotFromObservations(rows, "2026-09-15");
    assert.ok(applied.families.win.rule === "mix-ls" || applied.families.win.rule === "mix-ls-platt");
    assert.ok(applied.families.win.acc.dc > accuracyPriors("win").dc);
  });
});

describe("Platt shapes", () => {
  it("temperature pulls both tails in, and bias is the tool when every quote is low", () => {
    const t = plattMethodTrace();
    assert.ok(t.hot.maps.temperature.a <= 0.55 + 1e-9);
    assert.ok(Math.abs(t.hot.maps.bias.b) < 0.02);
    assert.ok(t.hot.brier.temperature < t.hot.brier.identity - 0.04);
    assert.ok(Math.abs(t.hot.brier.bias - t.hot.brier.identity) < 1e-3);
    assert.ok(Math.abs(t.hot.brier.full - t.hot.brier.temperature) < 1e-3);
    const at80 = t.hot.at.find((row) => row.p === 0.8)!;
    assert.ok(at80.temperature < 0.7 && at80.temperature > 0.66);
    assert.ok(t.shifted.brier.bias < t.shifted.brier.temperature - 0.05);
    assert.ok(t.shifted.maps.bias.b > 0.8);
    assert.ok(Math.abs(t.shifted.brier.full - t.shifted.brier.bias) < 0.005);
  });
});

describe("Platt intercept (Granger–Ramanathan Method A)", () => {
  it("identity map is a no-op", () => {
    assert.equal(applyPlatt(0.62, { a: 1, b: 0 }), 0.62);
    assert.ok(Math.abs(applyPlatt(0.62, null) - 0.62) < 1e-12);
  });

  it("poolLogitP of equal experts is that probability", () => {
    const p = poolLogitP(
      { dc: 0.7, shin: 0.7, api: 0.7, elo: 0.7, h2h: 0.7 },
      { dc: 0.4, shin: 0.2, api: 0.1, elo: 0.2, h2h: 0.1 },
    );
    assert.ok(Math.abs(p - 0.7) < 1e-9);
  });

  it("fits a positive bias when every expert is too low", () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      obs({
        date: "2026-09-12",
        y: 1,
        fixtureId: i + 1,
        p: { dc: 0.42, shin: 0.42, api: 0.42, elo: 0.42, h2h: 0.42 },
      }),
    );
    const prior = accuracyPriors("win") as ExpertWeights;
    const map = fitPlattMap(rows, (o) => poolLogitP(o.p, prior), "2026-09-12");
    assert.ok(map.b > 0.05, `b ${map.b}`);
    const lifted = applyPlatt(0.42, map);
    assert.ok(lifted > 0.42, `lifted ${lifted}`);
  });

  it("picks a scaled rule when the crowd is biased and weights cannot help", () => {
    const mk = (date: string, start: number) =>
      Array.from({ length: 24 }, (_, i) =>
        obs({
          date,
          y: 1,
          fixtureId: start + i,
          p: { dc: 0.4, shin: 0.4, api: 0.4, elo: 0.4, h2h: 0.4 },
        }),
      );
    const rows = [...mk("2026-09-12", 1), ...mk("2026-09-13", 50), ...mk("2026-09-14", 90)];
    const picked = selectFitMethod(rows, "win", "2026-09-15");
    assert.ok(picked.method === "prior-platt" || picked.method === "mix-ls-platt", picked.method);
    assert.ok(picked.oosBrier < picked.oosPrior - 0.0005, `${picked.oosBrier} vs ${picked.oosPrior}`);
    const applied = snapshotFromObservations(rows, "2026-09-15");
    assert.ok(applied.families.win.plattB > 0.05, `plattB ${applied.families.win.plattB}`);
  });

  it("walk-forward skill is positive once the intercept has a train window", () => {
    const rows: CalibrationObservation[] = [];
    for (let d = 12; d <= 15; d++) {
      for (let i = 0; i < 20; i++) {
        rows.push(
          obs({
            date: `2026-09-${d}`,
            y: 1,
            fixtureId: d * 100 + i,
            p: { dc: 0.4, shin: 0.4, api: 0.4, elo: 0.4, h2h: 0.4 },
          }),
        );
      }
    }
    const wf = walkForwardValidate(rows, { asOf: "2026-09-15" });
    assert.ok(wf.nDates >= 4);
    assert.ok(wf.skill > 0, `skill ${wf.skill}`);
    assert.ok(wf.brierCal < wf.brierPrior);
  });
});

describe("walk-forward", () => {
  it("does not use the as-of date", () => {
    const rows = [
      ...Array.from({ length: 30 }, (_, i) =>
        obs({
          date: "2026-09-14",
          y: 1,
          fixtureId: i + 1,
          p: { dc: 0.88, shin: 0.5, api: 0.4, elo: 0.4, h2h: 0.4 },
          accuracy: 0.8,
        }),
      ),
      ...Array.from({ length: 30 }, (_, i) =>
        obs({
          date: "2026-09-15",
          y: 0,
          fixtureId: 100 + i,
          p: { dc: 0.2, shin: 0.8, api: 0.7, elo: 0.7, h2h: 0.7 },
          accuracy: 0.2,
        }),
      ),
    ];
    const applied = snapshotFromObservations(rows, "2026-09-15");
    assert.equal(applied.n, 30);
    assert.deepEqual(applied.dates, ["2026-09-14"]);
    assert.ok(applied.families.win.acc.dc > accuracyPriors("win").dc);
  });
});

describe("walk-forward validation", () => {
  it("shiftYmd and trainCutoff", () => {
    assert.equal(shiftYmd("2026-09-16", -1), "2026-09-15");
    assert.equal(shiftYmd("2026-09-01", -1), "2026-08-31");
    assert.equal(trainCutoff("2026-09-16", 0), "2026-09-16");
    assert.equal(trainCutoff("2026-09-16", 1), "2026-09-15");
  });

  it("mixExpertP skips missing experts and renormalizes", () => {
    const p = mixExpertP(
      { dc: 0.8, elo: 0.2 },
      { dc: 0.5, shin: 0.3, api: 0.1, elo: 0.1, h2h: 0 },
    );
    assert.ok(Math.abs(p - (0.5 * 0.8 + 0.1 * 0.2) / 0.6) < 1e-9);
  });

  it("first fold trains on nothing — paper prior, no self-grading", () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) =>
        obs({
          date: "2026-09-14",
          y: 1,
          fixtureId: i + 1,
          p: { dc: 0.9, shin: 0.4, api: 0.4, elo: 0.4, h2h: 0.4 },
        }),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        obs({
          date: "2026-09-15",
          y: 1,
          fixtureId: 50 + i,
          p: { dc: 0.9, shin: 0.4, api: 0.4, elo: 0.4, h2h: 0.4 },
        }),
      ),
    ];
    const wf = walkForwardValidate(rows, { asOf: "2026-09-15" });
    assert.equal(wf.nDates, 2);
    assert.equal(wf.folds[0].date, "2026-09-14");
    assert.equal(wf.folds[0].trainN, 0);
    assert.equal(wf.folds[0].trainFrom, null);
    const priorDc = accuracyPriors("win").dc;
    assert.ok(Math.abs(wf.folds[0].accWin.dc - priorDc) < 1e-9, `first DC wt ${wf.folds[0].accWin.dc}`);
    assert.equal(wf.folds[1].trainN, 20);
    assert.deepEqual(
      rows.filter((o) => o.date === "2026-09-15").length,
      wf.folds[1].n,
    );
    assert.ok(wf.folds[1].accWin.dc > priorDc, "second fold should upweight the sharp DC");
  });

  it("embargo drops the adjacent date from train", () => {
    const rows = [
      ...Array.from({ length: 16 }, (_, i) =>
        obs({
          date: "2026-09-13",
          y: 1,
          fixtureId: i + 1,
          p: { dc: 0.85, shin: 0.45, api: 0.4, elo: 0.4, h2h: 0.4 },
        }),
      ),
      ...Array.from({ length: 16 }, (_, i) =>
        obs({
          date: "2026-09-14",
          y: 0,
          fixtureId: 40 + i,
          p: { dc: 0.2, shin: 0.8, api: 0.7, elo: 0.7, h2h: 0.7 },
        }),
      ),
      ...Array.from({ length: 16 }, (_, i) =>
        obs({
          date: "2026-09-15",
          y: 1,
          fixtureId: 80 + i,
          p: { dc: 0.6, shin: 0.5, api: 0.5, elo: 0.5, h2h: 0.5 },
        }),
      ),
    ];
    const open = walkForwardValidate(rows, { asOf: "2026-09-15", embargoDays: 0 });
    const purged = walkForwardValidate(rows, { asOf: "2026-09-15", embargoDays: 1 });
    const lastOpen = open.folds[open.folds.length - 1];
    const lastPurged = purged.folds[purged.folds.length - 1];
    assert.equal(lastOpen.date, "2026-09-15");
    assert.equal(lastOpen.trainN, 32);
    assert.equal(lastPurged.trainN, 16);
    assert.equal(lastPurged.trainTo, "2026-09-13");
  });

  it("rolling window ignores stale dates the expanding window keeps", () => {
    const mk = (date: string, startId: number, dcP: number, y: 0 | 1, n = 16) =>
      Array.from({ length: n }, (_, i) =>
        obs({
          date,
          y,
          fixtureId: startId + i,
          p: { dc: dcP, shin: 0.5, api: 0.5, elo: 0.5, h2h: 0.5 },
        }),
      );
    const rows = [
      ...mk("2026-09-10", 1, 0.15, 1),
      ...mk("2026-09-11", 40, 0.9, 1),
      ...mk("2026-09-12", 80, 0.9, 1),
      ...mk("2026-09-13", 120, 0.55, 1),
    ];
    const wf = walkForwardValidate(rows, { asOf: "2026-09-13", rollingDates: 2 });
    const last = wf.folds[wf.folds.length - 1];
    assert.equal(last.date, "2026-09-13");
    assert.equal(last.trainN, 48);
    assert.ok(last.brierRoll != null);
    assert.notEqual(last.brierRoll, last.brierCal);
  });

  it("asOf clips future dates from both train and test", () => {
    const rows = [
      ...Array.from({ length: 16 }, (_, i) =>
        obs({ date: "2026-09-14", y: 1, fixtureId: i + 1, p: { dc: 0.7 } }),
      ),
      ...Array.from({ length: 16 }, (_, i) =>
        obs({ date: "2026-09-15", y: 1, fixtureId: 40 + i, p: { dc: 0.7 } }),
      ),
      ...Array.from({ length: 16 }, (_, i) =>
        obs({ date: "2026-09-16", y: 0, fixtureId: 80 + i, p: { dc: 0.2 } }),
      ),
    ];
    const wf = walkForwardValidate(rows, { asOf: "2026-09-15" });
    assert.deepEqual(
      wf.folds.map((f) => f.date),
      ["2026-09-14", "2026-09-15"],
    );
    assert.equal(wf.n, 32);
  });

  it("calibrated OOS beats the prior when one expert is consistently sharper", () => {
    const rows: CalibrationObservation[] = [];
    for (let d = 10; d <= 15; d++) {
      const date = `2026-09-${d}`;
      for (let i = 0; i < 20; i++) {
        rows.push(
          obs({
            date,
            y: 1,
            fixtureId: d * 100 + i,
            p: { dc: 0.88, shin: 0.52, api: 0.5, elo: 0.5, h2h: 0.5 },
          }),
        );
      }
    }
    const wf = walkForwardValidate(rows, { asOf: "2026-09-15" });
    assert.ok(wf.nDates >= 5);
    assert.ok(wf.skill > 0, `skill ${wf.skill}`);
    assert.ok(wf.brierCal < wf.brierPrior);
    const last = wf.folds[wf.folds.length - 1];
    assert.ok(last.accWin.dc > accuracyPriors("win").dc);
    assert.ok(last.accWin.shin <= accuracyPriors("win").shin + 0.02);
    assert.ok(last.accByFamily.win.dc === last.accWin.dc);
    assert.ok(wf.dm != null && wf.dm.t > 0, `DM t ${wf.dm?.t}`);
  });
});

describe("Diebold–Mariano", () => {
  it("student-t CDF is ½ at 0 and ~0.975 at t_4 2.776", () => {
    assert.ok(Math.abs(studentTCdf(0, 10) - 0.5) < 1e-6);
    assert.ok(Math.abs(studentTCdf(2.776, 4) - 0.975) < 0.01);
    assert.ok(studentTCdf(-2.776, 4) < 0.03);
  });

  it("rejects when calibrated Brier is lower every day", () => {
    const cal = [0.19, 0.18, 0.2, 0.17, 0.185, 0.175, 0.19, 0.18];
    const prior = [0.26, 0.25, 0.27, 0.24, 0.255, 0.245, 0.26, 0.25];
    const dm = dieboldMariano(cal, prior);
    assert.ok(dm);
    assert.ok(dm.t > 2, `t ${dm.t}`);
    assert.ok(dm.p < 0.05, `p ${dm.p}`);
    assert.equal(dm.reject5, true);
    assert.ok(dm.meanDiff > 0);
  });

  it("does not claim skill when the two series are the same", () => {
    const xs = [0.2, 0.22, 0.18, 0.21, 0.19, 0.2];
    const dm = dieboldMariano(xs, xs);
    assert.ok(dm);
    assert.ok(Math.abs(dm.t) < 1e-6);
    assert.ok(dm.p > 0.4);
    assert.equal(dm.reject5, false);
  });
});

describe("backtest-mean weights", () => {
  it("upweights a sharp DC across expanding windows", () => {
    const rows: CalibrationObservation[] = [];
    for (let d = 10; d <= 14; d++) {
      for (let i = 0; i < 16; i++) {
        rows.push(
          obs({
            date: `2026-09-${d}`,
            y: 1,
            fixtureId: d * 100 + i,
            p: { dc: 0.9, shin: 0.5, api: 0.45, elo: 0.45, h2h: 0.45 },
          }),
        );
      }
    }
    const fit = backtestMeanFit(rows, "win", "mix-ls", "2026-09-15");
    const prior = accuracyPriors("win") as ExpertWeights;
    assert.ok(fit.windows >= 2, `windows ${fit.windows}`);
    assert.ok(fit.acc.dc > prior.dc, `acc.dc ${fit.acc.dc} vs prior ${prior.dc}`);
    assert.ok(fit.inSample.acc.dc > prior.dc);
    const applied = snapshotFromObservations(rows, "2026-09-15");
    assert.ok((applied.families.win.backtestWindows ?? 0) >= 2);
    assert.ok(applied.families.win.acc.dc > prior.dc);
  });
});


describe("reliability / ECE", () => {
  it("perfect forecasts have ECE near 0", () => {
    const pairs = [
      ...Array.from({ length: 20 }, () => ({ p: 0.02, y: 0 })),
      ...Array.from({ length: 20 }, () => ({ p: 0.98, y: 1 })),
    ];
    const rel = reliabilityDiagram(pairs);
    assert.ok(rel.ece < 0.05, `ece ${rel.ece}`);
  });

  it("a constant 0.8 on a 50% event is miscalibrated", () => {
    const pairs = Array.from({ length: 40 }, (_, i) => ({ p: 0.8, y: i % 2 }));
    const rel = reliabilityDiagram(pairs);
    assert.ok(rel.ece > 0.2, `ece ${rel.ece}`);
  });
});

describe("merge and pick ingest", () => {
  it("dedupes by date/fixture/kind/selection and caps the tail", () => {
    const a = obs({ date: "2026-09-10", fixtureId: 1, y: 1, p: { dc: 0.6 } });
    const b = obs({ date: "2026-09-10", fixtureId: 1, y: 0, p: { dc: 0.4 } });
    const merged = mergeObservations([a], [b]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].y, 0);
  });

  it("observationFromPick skips pushes", () => {
    const pick = {
      fixtureId: 9,
      kind: "ah",
      selection: "Home −0.25",
      accuracy: 0.55,
      models: { dixonColes: 0.55, shin: 0.52, apiFootball: 0.5, hvattumElo: 0.51, baioH2h: 0.5 },
      settled: { home: 1, away: 1, hit: null },
    } as unknown as ScoredPick;
    assert.equal(observationFromPick("2026-09-15", pick), null);
  });
});

describe("card calibration + ensemble wiring", () => {
  it("cardCalibration ranks the sharper expert", () => {
    const picks = Array.from({ length: 12 }, (_, i) => {
      const hit = i < 9;
      return {
        accuracy: hit ? 0.7 : 0.4,
        models: {
          dixonColes: hit ? 0.72 : 0.35,
          shin: 0.55,
          apiFootball: 0.5,
          hvattumElo: 0.5,
          baioH2h: 0.5,
        },
        settled: { home: 1, away: 0, hit },
      } as unknown as ScoredPick;
    });
    const card = cardCalibration(picks);
    assert.ok(card);
    assert.equal(card.n, 12);
    assert.equal(card.hits, 9);
    const dc = card.experts.find((e) => e.expert === "dc");
    const shin = card.experts.find((e) => e.expert === "shin");
    assert.ok(dc && shin);
    assert.ok(dc.brier < shin.brier);
  });

  it("makeReport scores priced lines and splits Sharpe by family", () => {
    const priced: CalibrationObservation[] = [
      { ...obs({ date: "2026-09-01", family: "btts", y: 1, p: { dc: 0.7 } }), odd: 1.9 },
      { ...obs({ date: "2026-09-01", family: "btts", y: 1, p: { dc: 0.7 }, fixtureId: 2 }), odd: 1.8 },
      { ...obs({ date: "2026-09-02", family: "btts", y: 1, p: { dc: 0.7 }, fixtureId: 3 }), odd: 1.91 },
      { ...obs({ date: "2026-09-01", family: "win", y: 0, p: { dc: 0.4 }, fixtureId: 4 }), odd: 1.9 },
      { ...obs({ date: "2026-09-02", family: "win", y: 0, p: { dc: 0.4 }, fixtureId: 5 }), odd: 2.0 },
      { ...obs({ date: "2026-09-03", family: "win", y: 0, p: { dc: 0.4 }, fixtureId: 6 }), odd: 1.8 },
      obs({ date: "2026-09-01", family: "ou", y: 1, p: { dc: 0.6 }, fixtureId: 7 }),
    ];
    const report = makeReport(priorSnapshot("2026-09-03"), [], priced.length, 0, null, priced);
    assert.ok(report.sharpe);
    assert.equal(report.sharpe.n, 6);
    assert.equal(report.nTrials, 2);
    assert.equal(report.sharpeByFamily?.length, 2);
    assert.equal(report.sharpeByFamily?.[0]?.family, "btts");
    assert.ok((report.sharpeByFamily?.[0]?.report.sharpe ?? 0) > 0);
    assert.ok(report.deflatedPsr != null);
  });

  it("ensembleForKind default path is unchanged when no weights are passed", () => {
    const ens = ensembleForKind("home", { dc: 0.4, shin: 0.5, api: 0.45, elo: 0.42, h2h: 0.38 });
    assert.ok(ens.accuracy > 0.38 && ens.accuracy < 0.55);
  });

  it("passing a Shin-heavy accuracy set pulls the pool toward the book", () => {
    const parts = { dc: 0.4, shin: 0.7, api: 0.4, elo: 0.4, h2h: 0.4 };
    const prior = ensembleForKind("home", parts);
    const heavy = ensembleForKind("home", parts, {
      accuracy: { dc: 0.08, shin: 0.72, api: 0.04, elo: 0.08, h2h: 0.08 },
      value: { dc: 0.5, shin: 0, api: 0.2, elo: 0.2, h2h: 0.1 },
    });
    assert.ok(heavy.accuracy > prior.accuracy, `${heavy.accuracy} vs ${prior.accuracy}`);
    assert.equal(heavy.value > 0.05, true);
  });
});

describe("calibrate hypers", () => {
  it("larger n₀ shrinks mix-ls further toward the paper prior", () => {
    const rows: CalibrationObservation[] = [];
    for (let d = 10; d <= 14; d++) {
      for (let i = 0; i < 16; i++) {
        rows.push(
          obs({
            date: `2026-09-${d}`,
            y: 1,
            fixtureId: d * 100 + i,
            p: { dc: 0.9, shin: 0.5, api: 0.45, elo: 0.45, h2h: 0.45 },
          }),
        );
      }
    }
    const prior = accuracyPriors("win") as ExpertWeights;
    const loose = fitFamilyWeights(rows, "win", "mix-ls", "2026-09-15", { halfLife: 14, n0: 24 });
    const tight = fitFamilyWeights(rows, "win", "mix-ls", "2026-09-15", { halfLife: 14, n0: 96 });
    const looseGap = Math.abs(loose.acc.dc - prior.dc);
    const tightGap = Math.abs(tight.acc.dc - prior.dc);
    assert.ok(tightGap < looseGap, `tight ${tightGap} vs loose ${looseGap}`);
  });

  it("grid default is 14d / n₀ 48 and has four mix-ls cells", () => {
    assert.equal(WFO_GRID.length, 4);
    assert.equal(WFO_GRID[0]?.id, "default");
    assert.equal(WFO_GRID[0]?.halfLife, 14);
    assert.equal(WFO_GRID[0]?.n0, 48);
    assert.ok(WFO_GRID.every((g) => g.n0 >= 24 && g.halfLife >= 7));
  });
});

describe("CSCV PBO and White RC", () => {
  it("PBO is null below six dates and in [0,1] on a 6-date matrix", () => {
    const short = {
      a: [0.2, 0.2, 0.2, 0.2],
      b: [0.3, 0.3, 0.3, 0.3],
    };
    assert.equal(combinatoriallySymmetricPBO(short), null);
    const honest = {
      a: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      b: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
      c: [0.35, 0.35, 0.35, 0.35, 0.35, 0.35],
      d: [0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
    };
    const pboHonest = combinatoriallySymmetricPBO(honest);
    assert.ok(pboHonest);
    assert.equal(pboHonest.pbo, 0);

    const snooped = {
      a: [0.1, 0.1, 0.1, 0.9, 0.9, 0.9],
      b: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      c: [0.9, 0.9, 0.9, 0.1, 0.1, 0.1],
      d: [0.55, 0.55, 0.55, 0.55, 0.55, 0.55],
    };
    const pboSnoop = combinatoriallySymmetricPBO(snooped);
    assert.ok(pboSnoop);
    assert.ok(pboSnoop.pbo > 0.4, `pbo ${pboSnoop.pbo}`);
    assert.equal(pboSnoop.nCombos, 20);
  });

  it("White RC is null under 3 dates and does not reject a flat grid", () => {
    assert.equal(whiteRealityCheck({ default: [0.2, 0.2], short: [0.2, 0.2] }), null);
    const rc = whiteRealityCheck({
      default: [0.2, 0.21, 0.19, 0.2, 0.205, 0.195],
      short: [0.2, 0.21, 0.19, 0.2, 0.205, 0.195],
      long: [0.201, 0.209, 0.191, 0.199, 0.204, 0.196],
    });
    assert.ok(rc);
    assert.ok(rc.p > 0.2, `p ${rc.p}`);
  });
});

describe("walk-forward optimization", () => {
  function book(startDay: number, days: number, y: 0 | 1, dc: number): CalibrationObservation[] {
    const rows: CalibrationObservation[] = [];
    for (let d = startDay; d < startDay + days; d++) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      for (let i = 0; i < 16; i++) {
        rows.push(
          obs({
            date,
            y,
            fixtureId: d * 100 + i,
            p: { dc, shin: 0.5, api: 0.45, elo: 0.45, h2h: 0.45 },
          }),
        );
      }
    }
    return rows;
  }

  it("empty corpus returns the default hyper and does not apply", () => {
    const report = walkForwardOptimize([], { asOf: "2026-09-15" });
    assert.equal(report.nDates, 0);
    assert.equal(report.apply, false);
    assert.equal(report.appliedId, "default");
    assert.equal(report.recommended.id, "default");
    assert.equal(report.pbo, null);
  });

  it("anchored WFO walks expanding windows and reports a path efficiency", () => {
    const rows = [
      ...book(8, 3, 0, 0.85),
      ...book(11, 3, 1, 0.85),
    ];
    const report = walkForwardOptimize(rows, { asOf: "2026-09-15", window: "anchored" });
    assert.ok(report.nDates >= 2, `folds ${report.nDates}`);
    assert.ok(report.efficiency != null && report.efficiency > 0);
    assert.ok(WFO_GRID.some((g) => g.id === report.recommended.id));
    assert.equal(report.grid.length, 4);
    assert.ok(report.folds.every((f) => f.configs.length === 4));
    assert.ok(report.folds.every((f) => f.trainFrom && f.trainTo && f.trainTo < f.date));
    const pair = walkForwardOptimizePair(rows, { asOf: "2026-09-15" });
    assert.equal(pair.anchored.window, "anchored");
    assert.equal(pair.rolling.window, "rolling");
    assert.ok(pair.rolling.folds.every((f) => f.trainDates <= 2));
  });

  it("this date is unused on itself", () => {
    const rows = book(10, 4, 1, 0.8);
    const report = walkForwardOptimize(rows, { asOf: "2026-09-13" });
    assert.ok(report.folds.every((f) => f.date < "2026-09-13"));
  });

  it("PBO stays null on a 4-date corpus", () => {
    const rows = book(10, 4, 1, 0.75);
    const report = walkForwardOptimize(rows, { asOf: "2026-09-15" });
    assert.ok(report.nDates >= 2);
    assert.equal(report.pbo, null);
  });
});

describe("validation methods", () => {
  it("resubstitution looks better than expanding, and k-fold uses the future", () => {
    const flat = { dc: 0.55, shin: 0.55, api: 0.55, elo: 0.55, h2h: 0.55 };
    const early = Array.from({ length: 12 }, (_, i) =>
      obs({ date: "2026-09-01", y: 0, fixtureId: i, p: flat }),
    );
    const late = Array.from({ length: 12 }, (_, i) =>
      obs({ date: "2026-09-02", y: 1, fixtureId: 100 + i, p: flat }),
    );
    const v = validationContrast([...early, ...late]);
    const row = (id: string) => v.rows.find((r) => r.id === id)!;
    assert.equal(v.desk, "expanding");
    assert.equal(row("resubstitution").valid, false);
    assert.equal(row("shuffled").valid, false);
    assert.equal(row("shuffled").usesFuture, true);
    assert.equal(row("expanding").valid, true);
    assert.equal(row("expanding").usesFuture, false);
    assert.equal(row("holdout").n, 12);
    assert.equal(row("holdout").usesFuture, false);
    assert.ok(row("resubstitution").brier! < row("expanding").brier!);
    assert.ok(v.optimism! > 0);
  });
});
