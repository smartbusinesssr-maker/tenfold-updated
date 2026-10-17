import type { LedgerRow, ScoredPick } from "./types";

function q(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

const HEADER = [
  "savedAt",
  "date",
  "kickoff",
  "league",
  "country",
  "home",
  "away",
  "market",
  "selection",
  "odd",
  "bookmaker",
  "modelProb",
  "impliedProb",
  "edge",
  "composite",
  "advice",
  "lambdaHome",
  "lambdaAway",
  "scoreline",
  "fixtureId",
].join(",");

export function pickToLedger(p: ScoredPick, savedAt = new Date().toISOString()): LedgerRow {
  return {
    savedAt,
    date: p.date,
    kickoff: p.kickoff,
    league: p.league,
    country: p.country,
    home: p.home,
    away: p.away,
    market: p.kind,
    selection: p.selection,
    odd: p.odd,
    bookmaker: p.bookmaker,
    modelProb: p.accuracy,
    impliedProb: p.implied,
    edge: p.edge,
    composite: p.composite,
    advice: p.advice,
    lambdaHome: p.lambdaHome,
    lambdaAway: p.lambdaAway,
    scoreline: p.scoreline,
    fixtureId: p.fixtureId,
    pickId: p.id,
  };
}

export function ledgerToCsv(rows: LedgerRow[]): string {
  const lines = [HEADER];
  for (const r of rows) {
    lines.push(
      [
        q(r.savedAt),
        q(r.date),
        q(r.kickoff),
        q(r.league),
        q(r.country),
        q(r.home),
        q(r.away),
        q(r.market),
        q(r.selection),
        q(r.odd.toFixed(2)),
        q(r.bookmaker),
        q(r.modelProb.toFixed(3)),
        q(r.impliedProb.toFixed(3)),
        q(r.edge.toFixed(3)),
        q(r.composite.toFixed(4)),
        q(r.advice),
        q(r.lambdaHome.toFixed(2)),
        q(r.lambdaAway.toFixed(2)),
        q(r.scoreline),
        q(r.fixtureId),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
