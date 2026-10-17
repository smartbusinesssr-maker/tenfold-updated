import { snapshotFromObservations, walkForwardValidate } from "../src/lib/football/calibrate.ts";
import { loadObservations } from "../src/lib/football/calibrate-store.server.ts";
import { runDeskPipeline } from "../src/lib/football/pipeline.server.ts";

const dates = process.argv.slice(2);
const timezone = process.env.TENFOLD_TZ?.trim() || "Africa/Kampala";
const list = dates.length ? dates : ["2026-09-15", "2026-09-14", "2026-09-13"];

const out: unknown[] = [];
for (const date of list) {
  const r = await runDeskPipeline({ date, timezone, fresh: true, scanId: `cal-${date}` });
  out.push({
    date,
    hits: r.meta.backtestHits ?? null,
    n: r.meta.backtestN ?? null,
    fold: r.fold.length,
    ingested: r.calibration?.ingested ?? 0,
    corpus: r.calibration?.nAfter ?? 0,
    appliedN: r.calibration?.applied.n ?? 0,
    elapsedMs: r.meta.elapsedMs,
    warnings: r.warnings.slice(0, 2),
  });
}

const obs = loadObservations();
const snap = snapshotFromObservations(obs, "9999-12-31");
const wf = walkForwardValidate(obs, { asOf: "9999-12-31" });
console.log(
  JSON.stringify(
    {
      scans: out,
      corpus: { n: snap.n, dates: snap.dates },
      accuracy: {
        win: snap.families.win.acc,
        btts: snap.families.btts.acc,
        ou: snap.families.ou.acc,
        cs: snap.families.cs.acc,
      },
      walkForward: {
        n: wf.n,
        nDates: wf.nDates,
        brierCal: wf.brierCal,
        brierPrior: wf.brierPrior,
        skill: wf.skill,
        folds: wf.folds.map((f) => ({
          date: f.date,
          trainN: f.trainN,
          n: f.n,
          brierCal: f.brierCal,
          brierPrior: f.brierPrior,
          skill: f.skill,
        })),
      },
    },
    null,
    2,
  ),
);
