import { runDeskPipeline } from "../src/lib/football/pipeline.server.ts";
import { gradeMarket, maherOver25Closed } from "../src/lib/football/models.ts";
import type { ScoredPick } from "../src/lib/football/types.ts";

const dates = process.argv.slice(2);
const tz = "Africa/Kampala";
const days = dates.length ? dates : ["2026-09-13", "2026-09-14"];

function last5Lean(p: ScoredPick): "over" | "under" | "mixed" {
  const totH =
    p.facts.homeGf != null && p.facts.homeGa != null ? p.facts.homeGf + p.facts.homeGa : null;
  const totA =
    p.facts.awayGf != null && p.facts.awayGa != null ? p.facts.awayGf + p.facts.awayGa : null;
  if (totH == null || totA == null) return "mixed";
  if (totH >= 3.0 && totA >= 2.8) return "over";
  if (totH <= 2.2 && totA <= 2.2) return "under";
  if (totH >= 3.2 || totA >= 3.2) return "over";
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
  tot: number;
  pois: number;
  last5H: number | null;
  last5A: number | null;
  last5Tot: number | null;
  last5Lean: string;
  h2hN: number;
  modal: string;
  modalOk: boolean;
  ft: string;
  goals: number;
  actualOver: boolean;
  hit: boolean;
  onTen: boolean;
};

const all: Row[] = [];

for (const date of days) {
  const r = await runDeskPipeline({ date, timezone: tz, fresh: true, scanId: `ou25-${date}` });
  const onTen = new Set(r.fold.filter((p) => p.kind === "over_25" || p.kind === "under_25").map((p) => p.id));
  for (const p of r.candidates) {
    if (p.kind !== "over_25" && p.kind !== "under_25") continue;
    const s = p.settled;
    if (!s || s.hit == null) continue;
    const goals = s.home + s.away;
    const actualOver = goals >= 3;
    const hit = Boolean(gradeMarket(p.kind, p.selection, s.home, s.away));
    const totH =
      p.facts.homeGf != null && p.facts.homeGa != null ? p.facts.homeGf + p.facts.homeGa : null;
    const totA =
      p.facts.awayGf != null && p.facts.awayGa != null ? p.facts.awayGf + p.facts.awayGa : null;
    const last5Tot = totH != null && totA != null ? 0.6 * totH + 0.4 * totA : totH ?? totA;
    const modalTot = p.scoreline.split(/[-–]/).reduce((a, x) => a + Number(x), 0);
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
      tot: Math.round((p.lambdaHome + p.lambdaAway) * 100) / 100,
      pois: Math.round(maherOver25Closed(p.lambdaHome, p.lambdaAway) * 1000) / 10,
      last5H: totH != null ? Math.round(totH * 100) / 100 : null,
      last5A: totA != null ? Math.round(totA * 100) / 100 : null,
      last5Tot: last5Tot != null ? Math.round(last5Tot * 100) / 100 : null,
      last5Lean: last5Lean(p),
      h2hN: p.facts.h2hN,
      modal: p.scoreline,
      modalOk: p.kind === "over_25" ? modalTot >= 3 : modalTot < 3,
      ft: `${s.home}-${s.away}`,
      goals,
      actualOver,
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
  const over = row.kind === "over_25";
  const prev = uniqueFix.get(key);
  if (!prev || (over && prev.kind !== "over_25")) uniqueFix.set(key, row);
}

const fixtures = [...uniqueFix.values()].map((row) => {
  const pOver = row.kind === "over_25" ? row.acc / 100 : 1 - row.acc / 100;
  const bookOver = row.kind === "over_25" ? row.implied / 100 : 1 - row.implied / 100;
  const dcOver = row.kind === "over_25" ? row.dc / 100 : 1 - row.dc / 100;
  const h2hOver = row.kind === "over_25" ? row.h2h / 100 : 1 - row.h2h / 100;
  const poisOver = row.pois / 100;
  const y = row.actualOver ? 1 : 0;
  const last5Pick = row.last5Lean === "over" ? 1 : row.last5Lean === "under" ? 0 : null;
  return { ...row, pOver, bookOver, dcOver, h2hOver, poisOver, y, last5Pick };
});

const buckets = [
  { lo: 0, hi: 0.42, label: "<42%" },
  { lo: 0.42, hi: 0.5, label: "42–50%" },
  { lo: 0.5, hi: 0.58, label: "50–58%" },
  { lo: 0.58, hi: 0.66, label: "58–66%" },
  { lo: 0.66, hi: 1, label: "≥66%" },
];

const cal = buckets.map((b) => {
  const xs = fixtures.filter((f) => f.pOver >= b.lo && f.pOver < b.hi);
  return {
    bucket: b.label,
    n: xs.length,
    meanP: xs.length ? Math.round(mean(xs.map((x) => x.pOver)) * 1000) / 10 : 0,
    hitOver: xs.filter((x) => x.y === 1).length,
    rate: xs.length ? Math.round((100 * xs.filter((x) => x.y === 1).length) / xs.length) : 0,
  };
});

const overPicks = all.filter((p) => p.kind === "over_25");
const underPicks = all.filter((p) => p.kind === "under_25");
const ten = all.filter((p) => p.onTen);
const last5Agree = fixtures.filter((f) => f.last5Pick != null);
const last5Hit = last5Agree.filter((f) => f.last5Pick === f.y).length;
const modelHit = fixtures.filter((f) => (f.pOver >= 0.5 ? 1 : 0) === f.y).length;
const bookHit = fixtures.filter((f) => (f.bookOver >= 0.5 ? 1 : 0) === f.y).length;
const poisHit = fixtures.filter((f) => (f.poisOver >= 0.5 ? 1 : 0) === f.y).length;
const h2hHit = fixtures.filter((f) => (f.h2hOver >= 0.5 ? 1 : 0) === f.y).length;
const dcHit = fixtures.filter((f) => (f.dcOver >= 0.5 ? 1 : 0) === f.y).length;
const lambdaHighOver = fixtures.filter((f) => f.tot >= 2.8);
const lambdaHighHit = lambdaHighOver.filter((f) => f.y === 1).length;
const lambdaLowUnder = fixtures.filter((f) => f.tot <= 2.3);
const lambdaLowHit = lambdaLowUnder.filter((f) => f.y === 0).length;

const out = {
  days,
  nPicks: all.length,
  nFixtures: fixtures.length,
  pickHit: pct(all.filter((p) => p.hit).length, all.length),
  tenHit: pct(ten.filter((p) => p.hit).length, ten.length),
  overHit: pct(overPicks.filter((p) => p.hit).length, overPicks.length),
  underHit: pct(underPicks.filter((p) => p.hit).length, underPicks.length),
  sideAccuracy: {
    modelPOverGe50: pct(modelHit, fixtures.length),
    bookFavourite: pct(bookHit, fixtures.length),
    dixonColes: pct(dcHit, fixtures.length),
    poissonLambda: pct(poisHit, fixtures.length),
    h2hExpert: pct(h2hHit, fixtures.length),
    last5TotalRule: pct(last5Hit, last5Agree.length),
    lambdaTotGe28GoesOver: pct(lambdaHighHit, lambdaHighOver.length),
    lambdaTotLe23GoesUnder: pct(lambdaLowHit, lambdaLowUnder.length),
  },
  brier: {
    model: Math.round(mean(fixtures.map((f) => brier(f.pOver, f.y))) * 1000) / 1000,
    book: Math.round(mean(fixtures.map((f) => brier(f.bookOver, f.y))) * 1000) / 1000,
    dc: Math.round(mean(fixtures.map((f) => brier(f.dcOver, f.y))) * 1000) / 1000,
    poisson: Math.round(mean(fixtures.map((f) => brier(f.poisOver, f.y))) * 1000) / 1000,
    h2h: Math.round(mean(fixtures.map((f) => brier(f.h2hOver, f.y))) * 1000) / 1000,
  },
  meanPOver: fixtures.length ? Math.round(mean(fixtures.map((f) => f.pOver)) * 1000) / 10 : 0,
  actualOverRate: fixtures.length
    ? Math.round((100 * fixtures.filter((f) => f.y === 1).length) / fixtures.length)
    : 0,
  calibration: cal,
  modalContradicts: all.filter((p) => !p.modalOk).length,
  ten,
  misses: all.filter((p) => !p.hit),
  hits: all.filter((p) => p.hit),
};

console.log(JSON.stringify(out, null, 2));
