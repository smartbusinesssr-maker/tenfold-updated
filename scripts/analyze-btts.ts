import { runDeskPipeline } from "../src/lib/football/pipeline.server.ts";
import { gradeMarket } from "../src/lib/football/models.ts";
import type { ScoredPick } from "../src/lib/football/types.ts";

const dates = process.argv.slice(2);
const tz = "Africa/Kampala";
const days = dates.length ? dates : ["2026-09-13", "2026-09-14"];

function poissonBtts(lh: number, la: number) {
  return (1 - Math.exp(-Math.max(0, lh))) * (1 - Math.exp(-Math.max(0, la)));
}

function last5Lean(p: ScoredPick): "yes" | "no" | "mixed" {
  const gfH = p.facts.homeGf;
  const gfA = p.facts.awayGf;
  if (gfH == null || gfA == null) return "mixed";
  if (gfH >= 1.05 && gfA >= 1.05) return "yes";
  if (gfH <= 0.85 || gfA <= 0.85) return "no";
  return "mixed";
}

type Row = {
  date: string;
  match: string;
  league: string;
  kind: string;
  odd: number;
  acc: number;
  implied: number;
  dc: number;
  shin: number | null;
  h2h: number;
  elo: number;
  lambdaH: number;
  lambdaA: number;
  pois: number;
  last5H: number | null;
  last5A: number | null;
  last5Lean: string;
  h2hN: number;
  ftsH: number | null;
  ftsA: number | null;
  modal: string;
  modalOk: boolean;
  ft: string;
  actualYes: boolean;
  hit: boolean;
  onTen: boolean;
};

const all: Row[] = [];

for (const date of days) {
  const r = await runDeskPipeline({ date, timezone: tz, fresh: true, scanId: `btts-${date}` });
  const onTen = new Set(r.fold.filter((p) => p.family === "btts").map((p) => p.id));
  for (const p of r.candidates) {
    if (p.family !== "btts") continue;
    const s = p.settled;
    if (!s || s.hit == null) continue;
    const actualYes = s.home >= 1 && s.away >= 1;
    const hit = Boolean(gradeMarket(p.kind, p.selection, s.home, s.away));
    all.push({
      date,
      match: `${p.home} v ${p.away}`,
      league: p.league,
      kind: p.kind,
      odd: Math.round(p.odd * 100) / 100,
      acc: Math.round(p.accuracy * 1000) / 10,
      implied: Math.round(p.implied * 1000) / 10,
      dc: Math.round(p.models.dixonColes * 1000) / 10,
      shin: p.models.shin != null ? Math.round(p.models.shin * 1000) / 10 : null,
      h2h: Math.round(p.models.baioH2h * 1000) / 10,
      elo: Math.round(p.models.hvattumElo * 1000) / 10,
      lambdaH: Math.round(p.lambdaHome * 100) / 100,
      lambdaA: Math.round(p.lambdaAway * 100) / 100,
      pois: Math.round(poissonBtts(p.lambdaHome, p.lambdaAway) * 1000) / 10,
      last5H: p.facts.homeGf,
      last5A: p.facts.awayGf,
      last5Lean: last5Lean(p),
      h2hN: p.facts.h2hN,
      ftsH: p.facts.homeFts ?? null,
      ftsA: p.facts.awayFts ?? null,
      modal: p.scoreline,
      modalOk: p.kind === "btts_yes" ? !p.scoreline.includes("0") : p.scoreline.includes("0"),
      ft: `${s.home}-${s.away}`,
      actualYes,
      hit,
      onTen: onTen.has(p.id),
    });
  }
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function brier(p: number, y: number) {
  return (p - y) ** 2;
}
function pct(n: number, d: number) {
  return d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : "0/0";
}

const uniqueFix = new Map<string, Row>();
for (const row of all) {
  const key = `${row.date}|${row.match}`;
  const yes = row.kind === "btts_yes";
  const prev = uniqueFix.get(key);
  if (!prev || (yes && prev.kind !== "btts_yes")) uniqueFix.set(key, row);
}

const fixtures = [...uniqueFix.values()].map((row) => {
  const pYes =
    row.kind === "btts_yes" ? row.acc / 100 : 1 - row.acc / 100;
  const bookYes =
    row.kind === "btts_yes" ? row.implied / 100 : 1 - row.implied / 100;
  const dcYes = row.kind === "btts_yes" ? row.dc / 100 : 1 - row.dc / 100;
  const h2hYes = row.kind === "btts_yes" ? row.h2h / 100 : 1 - row.h2h / 100;
  const poisYes = row.pois / 100;
  const y = row.actualYes ? 1 : 0;
  const last5Pick = row.last5Lean === "yes" ? 1 : row.last5Lean === "no" ? 0 : null;
  return { ...row, pYes, bookYes, dcYes, h2hYes, poisYes, y, last5Pick };
});

const buckets = [
  { lo: 0, hi: 0.45, label: "<45%" },
  { lo: 0.45, hi: 0.52, label: "45–52%" },
  { lo: 0.52, hi: 0.58, label: "52–58%" },
  { lo: 0.58, hi: 0.65, label: "58–65%" },
  { lo: 0.65, hi: 1, label: "≥65%" },
];

const cal = buckets.map((b) => {
  const xs = fixtures.filter((f) => f.pYes >= b.lo && f.pYes < b.hi);
  return {
    bucket: b.label,
    n: xs.length,
    meanP: Math.round(mean(xs.map((x) => x.pYes)) * 1000) / 10,
    hitYes: xs.filter((x) => x.y === 1).length,
    rate: xs.length ? Math.round((100 * xs.filter((x) => x.y === 1).length) / xs.length) : 0,
  };
});

const picks = all;
const yesPicks = picks.filter((p) => p.kind === "btts_yes");
const noPicks = picks.filter((p) => p.kind === "btts_no");
const ten = picks.filter((p) => p.onTen);

const last5Agree = fixtures.filter((f) => f.last5Pick != null);
const last5Hit = last5Agree.filter((f) => f.last5Pick === f.y).length;
const modelHit = fixtures.filter((f) => (f.pYes >= 0.5 ? 1 : 0) === f.y).length;
const bookHit = fixtures.filter((f) => (f.bookYes >= 0.5 ? 1 : 0) === f.y).length;
const poisHit = fixtures.filter((f) => (f.poisYes >= 0.5 ? 1 : 0) === f.y).length;
const h2hHit = fixtures.filter((f) => (f.h2hYes >= 0.5 ? 1 : 0) === f.y).length;
const dcHit = fixtures.filter((f) => (f.dcYes >= 0.5 ? 1 : 0) === f.y).length;

const modalClash = picks.filter((p) => !p.modalOk);

const out = {
  days,
  nPicks: picks.length,
  nFixtures: fixtures.length,
  pickHit: pct(picks.filter((p) => p.hit).length, picks.length),
  tenHit: pct(ten.filter((p) => p.hit).length, ten.length),
  yesHit: pct(yesPicks.filter((p) => p.hit).length, yesPicks.length),
  noHit: pct(noPicks.filter((p) => p.hit).length, noPicks.length),
  sideAccuracy: {
    modelPYesGe50: pct(modelHit, fixtures.length),
    bookFavourite: pct(bookHit, fixtures.length),
    dixonColes: pct(dcHit, fixtures.length),
    poissonLambda: pct(poisHit, fixtures.length),
    h2hExpert: pct(h2hHit, fixtures.length),
    last5GfRule: pct(last5Hit, last5Agree.length),
  },
  brier: {
    model: Math.round(mean(fixtures.map((f) => brier(f.pYes, f.y))) * 1000) / 1000,
    book: Math.round(mean(fixtures.map((f) => brier(f.bookYes, f.y))) * 1000) / 1000,
    dc: Math.round(mean(fixtures.map((f) => brier(f.dcYes, f.y))) * 1000) / 1000,
    poisson: Math.round(mean(fixtures.map((f) => brier(f.poisYes, f.y))) * 1000) / 1000,
    h2h: Math.round(mean(fixtures.map((f) => brier(f.h2hYes, f.y))) * 1000) / 1000,
  },
  meanPYes: Math.round(mean(fixtures.map((f) => f.pYes)) * 1000) / 10,
  actualYesRate: Math.round((100 * fixtures.filter((f) => f.y === 1).length) / Math.max(1, fixtures.length)),
  calibration: cal,
  modalContradicts: modalClash.length,
  ten,
  misses: picks.filter((p) => !p.hit),
  hits: picks.filter((p) => p.hit),
};

console.log(JSON.stringify(out, null, 2));
