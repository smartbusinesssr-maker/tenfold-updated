import { runDeskPipeline } from "../src/lib/football/pipeline.server.ts";

const date = process.argv[2] || "2026-09-13";
const timezone = process.argv[3] || "Africa/Kampala";

const r = await runDeskPipeline({ date, timezone, fresh: true, scanId: `bt-${date}` });
const rows = r.fold.map((p, i) => ({
  n: i + 1,
  match: `${p.home} v ${p.away}`,
  league: p.league,
  kind: p.kind,
  sel: p.selection,
  odd: p.odd,
  acc: Math.round(p.accuracy * 1000) / 10,
  ft: p.settled ? `${p.settled.home}-${p.settled.away}` : "—",
  hit: p.settled ? (p.settled.hit ? "HIT" : "MISS") : "—",
}));
console.log(
  JSON.stringify(
    {
      hits: r.meta.backtestHits ?? null,
      n: r.meta.backtestN ?? null,
      fold: r.fold.length,
      modelled: r.meta.modelled,
      withOdds: r.meta.withOdds,
      fixtures: r.meta.upcomingTotal,
      source: r.meta.source,
      elapsedMs: r.meta.elapsedMs,
      notes: r.meta.notes,
      warnings: r.warnings,
      rows,
    },
    null,
    2,
  ),
);
