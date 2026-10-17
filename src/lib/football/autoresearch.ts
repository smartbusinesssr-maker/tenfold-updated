/**
 * Karpathy autoresearch, cut down to a probability.
 * The metric is frozen: Brier, lower better. The last date is the holdout
 * and is not used to pick the candidate. A shrink is kept only when the
 * earlier dates improve by at least DELTA and the holdout does not get worse.
 * Two passing shrinks within DELTA: keep the one closer to the identity.
 * Nothing is written to a results file.
 */

const DELTA = 0.0005;
const MIN_SELECT = 12;
const MIN_HOLDOUT = 4;

export const AUTORESEARCH_SHRINKS = [
  { id: "shrink92", keep: 0.92, description: "pull 8% of the way back to 1/2" },
  { id: "shrink85", keep: 0.85, description: "pull 15% of the way back to 1/2" },
] as const;

export interface AutoRow {
  date: string;
  p: number;
  y: 0 | 1;
}

export interface AutoTrial {
  id: string;
  keep: number;
  description: string;
  selectBrier: number;
  holdoutBrier: number;
  status: "keep" | "discard";
}

export interface AutoReport {
  keep: number;
  note: string;
  trials: AutoTrial[];
}

function clamp01(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(1 - 1e-6, Math.max(1e-6, p));
}

export function applyShrink(p: number, keep: number): number {
  const k = Math.min(1, Math.max(0.85, keep));
  return clamp01(0.5 + k * (clamp01(p) - 0.5));
}

function brierOf(rows: AutoRow[], keep: number): number {
  if (!rows.length) return 0;
  let s = 0;
  for (const row of rows) {
    const q = keep >= 1 ? clamp01(row.p) : applyShrink(row.p, keep);
    s += (q - row.y) * (q - row.y);
  }
  return s / rows.length;
}

export function autoresearchShrink(rows: AutoRow[], asOf = "9999-12-31"): AutoReport {
  const usable = rows.filter((r) => r.date < asOf && (r.y === 0 || r.y === 1) && Number.isFinite(r.p));
  const dates = [...new Set(usable.map((r) => r.date))].sort();
  const identity: AutoTrial = {
    id: "identity",
    keep: 1,
    description: "baseline",
    selectBrier: 0,
    holdoutBrier: 0,
    status: "keep",
  };
  if (dates.length < 2) {
    const note = dates.length === 0 ? "no settled book — shrink stays off" : "one date — shrink discarded";
    return { keep: 1, note, trials: [identity] };
  }
  const holdDate = dates[dates.length - 1]!;
  const selectRows = usable.filter((r) => r.date < holdDate);
  const holdRows = usable.filter((r) => r.date === holdDate);
  if (selectRows.length < MIN_SELECT || holdRows.length < MIN_HOLDOUT) {
    return { keep: 1, note: "book too thin to confirm a shrink", trials: [{ ...identity, status: "keep" }] };
  }
  const baseSelect = brierOf(selectRows, 1);
  const baseHold = brierOf(holdRows, 1);
  identity.selectBrier = baseSelect;
  identity.holdoutBrier = baseHold;
  const trials: AutoTrial[] = [identity];
  const passing: AutoTrial[] = [];
  for (const cand of AUTORESEARCH_SHRINKS) {
    const selectBrier = brierOf(selectRows, cand.keep);
    const holdoutBrier = brierOf(holdRows, cand.keep);
    const ok = selectBrier < baseSelect - DELTA && holdoutBrier <= baseHold + 1e-12;
    const trial: AutoTrial = { ...cand, selectBrier, holdoutBrier, status: ok ? "keep" : "discard" };
    trials.push(trial);
    if (ok) passing.push(trial);
  }
  if (!passing.length) {
    return { keep: 1, note: "shrinks discarded — holdout Brier did not agree", trials };
  }
  const best = Math.min(...passing.map((t) => t.selectBrier));
  const chosen = passing
    .filter((t) => t.selectBrier <= best + DELTA)
    .sort((a, b) => b.keep - a.keep)[0]!;
  for (const t of trials) {
    if (t.id !== chosen.id && t.id !== "identity") t.status = "discard";
  }
  chosen.status = "keep";
  identity.status = "discard";
  const gain = baseSelect - chosen.selectBrier;
  return {
    keep: chosen.keep,
    note: `kept ${chosen.id} — select Brier down ${(gain * 1000).toFixed(1)}‰, holdout did not rise`,
    trials,
  };
}
