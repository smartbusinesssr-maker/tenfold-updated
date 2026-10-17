/**
 * Unified market layer — every market is a slice of one score (or count) distribution.
 * Never invents xG / xGA / corners / cards / minutes. Missing stays unavailable.
 */
import { COMBO_ODDS_BAND, familyOf, type ComboLeg, type MarketKind } from "./types.ts";
import { settleCorner } from "./corners.ts";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0;
  const l = Math.max(0, lambda);
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
}

export type Settlement =
  | "full_win"
  | "half_win"
  | "push"
  | "half_loss"
  | "full_loss";

export interface AsianOutcome {
  fullWin: number;
  halfWin: number;
  push: number;
  halfLoss: number;
  loss: number;
}

export interface AhLine {
  side: "home" | "away";
  line: number;
}

export interface EhLine {
  side: "home" | "draw" | "away";
  line: number;
}

export interface CountLine {
  side: "over" | "under";
  line: number;
}

/** Split a quarter handicap into the two adjacent half/whole lines. */
export function splitAsianLine(h: number): number[] {
  if (!Number.isFinite(h)) return [];
  const q = Math.round(h * 4);
  if (Math.abs(h * 4 - q) > 1e-6) return [h];
  if (q % 2 === 0) return [h];
  const lo = Math.floor(h * 2) / 2 || 0;
  const hi = Math.ceil(h * 2) / 2 || 0;
  return lo === hi ? [h] : [lo, hi];
}

/** Home line L: home covers when (homeGoals + L) > awayGoals i.e. D > −L. */
export function settleWholeOrHalf(diff: number, line: number): Settlement {
  const cover = diff + line;
  if (Math.abs(cover) < 1e-9) return "push";
  if (cover > 0) return "full_win";
  return "full_loss";
}

export function mergeHalfStakes(a: Settlement, b: Settlement): Settlement {
  const rank: Record<Settlement, number> = {
    full_win: 2,
    half_win: 1,
    push: 0,
    half_loss: -1,
    full_loss: -2,
  };
  const mean = (rank[a] + rank[b]) / 2;
  if (mean >= 1.5) return "full_win";
  if (mean >= 0.5) return "half_win";
  if (mean > -0.5 && mean < 0.5) return "push";
  if (mean <= -1.5) return "full_loss";
  return "half_loss";
}

export function settleAsian(diff: number, line: number): Settlement {
  const parts = splitAsianLine(line);
  if (parts.length === 1) return settleWholeOrHalf(diff, parts[0]!);
  return mergeHalfStakes(settleWholeOrHalf(diff, parts[0]!), settleWholeOrHalf(diff, parts[1]!));
}

export function parseAhSelection(selection: string): AhLine | null {
  const t = String(selection ?? "").trim();
  const m =
    t.match(/^(home|away)\s*([+-]?\d+(?:\.\d+)?)$/i) ??
    t.match(/^(home|away)\s+([+-]?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const line = Number(m[2]);
  if (!Number.isFinite(line)) return null;
  return { side: m[1]!.toLowerCase() === "away" ? "away" : "home", line };
}

export function parseEhSelection(selection: string): EhLine | null {
  const t = String(selection ?? "").trim();
  const m = t.match(/^(home|draw|away)\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const line = Number(m[2]);
  if (!Number.isFinite(line)) return null;
  const side = m[1]!.toLowerCase();
  return { side: side === "away" ? "away" : side === "draw" ? "draw" : "home", line };
}

export function parseCountSelection(selection: string): CountLine | null {
  const t = String(selection ?? "").trim().toLowerCase();
  const m = t.match(/^(over|under)\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const line = Number(m[2]);
  if (!Number.isFinite(line)) return null;
  return { side: m[1] === "under" ? "under" : "over", line };
}

export function formatAhSelection(side: "home" | "away", line: number): string {
  const sign = line > 0 ? "+" : "";
  return `${side === "home" ? "Home" : "Away"} ${sign}${line}`;
}

/** European handicap: no push. Home −1: a 1-goal home win is an adjusted draw. */
export function europeanResult(homeGoals: number, awayGoals: number, homeLine: number): "home" | "draw" | "away" {
  const adjH = homeGoals + homeLine;
  if (adjH > awayGoals) return "home";
  if (adjH < awayGoals) return "away";
  return "draw";
}

export function settleEuropean(homeGoals: number, awayGoals: number, line: EhLine): "home" | "draw" | "away" {
  const homeLine = line.side === "away" ? -line.line : line.line;
  return europeanResult(homeGoals, awayGoals, homeLine);
}

export function europeanFromGrid(grid: number[][], line: EhLine): { home: number; draw: number; away: number } {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      const p = row[y] ?? 0;
      const r = settleEuropean(x, y, line);
      if (r === "home") home += p;
      else if (r === "draw") draw += p;
      else away += p;
    }
  }
  return { home, draw, away };
}

export function asianFromGrid(grid: number[][], side: "home" | "away", line: number): AsianOutcome {
  const out: AsianOutcome = { fullWin: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 0 };
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      const p = row[y] ?? 0;
      const diff = side === "home" ? x - y : y - x;
      const s = settleAsian(diff, line);
      if (s === "full_win") out.fullWin += p;
      else if (s === "half_win") out.halfWin += p;
      else if (s === "push") out.push += p;
      else if (s === "half_loss") out.halfLoss += p;
      else out.loss += p;
    }
  }
  return out;
}

/** Asian goal totals: Over L settles as cover = total − L. Under L is the mirror. */
export function asianTotalFromGrid(
  grid: number[][],
  side: "over" | "under",
  line: number,
): AsianOutcome {
  const out: AsianOutcome = { fullWin: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 0 };
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      const p = row[y] ?? 0;
      const tot = x + y;
      const s = side === "over" ? settleAsian(tot, -line) : settleAsian(-tot, line);
      if (s === "full_win") out.fullWin += p;
      else if (s === "half_win") out.halfWin += p;
      else if (s === "push") out.push += p;
      else if (s === "half_loss") out.halfLoss += p;
      else out.loss += p;
    }
  }
  return out;
}

export function formatOuAsianSelection(side: "over" | "under", line: number): string {
  return `${side === "under" ? "Under" : "Over"} ${line}`;
}

/** Quarter / whole goal totals — not the headline 0.5 / 1.5 / 2.5 / 3.5 / 4.5 halves. */
export function isAsianTotalLine(line: number): boolean {
  if (!Number.isFinite(line)) return false;
  const q = Math.round(line * 4) / 4;
  if (Math.abs(q - line) > 1e-6) return false;
  if (q < 1 || q > 4.75) return false;
  const frac = Math.abs(q % 1);
  if (Math.abs(frac - 0.5) < 1e-9) return false;
  return true;
}

/** Win-equivalent probability used as ensemble accuracy. Push is not a hit. */
export function asianCoverP(o: AsianOutcome): number {
  return clamp(o.fullWin + 0.5 * o.halfWin, 0, 1);
}

/**
 * Fair decimal odds: expected return = 1.
 * ER = Pfw·odds + Phw·(1+(odds−1)/2) + Pp·1 + Phl·0.5
 */
export function asianFairOdds(o: AsianOutcome): number | null {
  const den = o.fullWin + 0.5 * o.halfWin;
  if (den <= 1e-9) return null;
  const num = 1 - o.push - 0.5 * o.halfLoss - 0.5 * o.halfWin;
  if (num <= 1e-9) return null;
  const odds = num / den;
  if (!Number.isFinite(odds) || odds <= 1) return null;
  return odds;
}

export function asianExpectedReturn(o: AsianOutcome, odds: number): number {
  return (
    o.fullWin * odds +
    o.halfWin * (1 + (odds - 1) / 2) +
    o.push * 1 +
    o.halfLoss * 0.5 +
    o.loss * 0
  );
}

export function goalDifferenceMass(grid: number[][]): Map<number, number> {
  const m = new Map<number, number>();
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      const d = x - y;
      m.set(d, (m.get(d) ?? 0) + (row[y] ?? 0));
    }
  }
  return m;
}

export function doubleChanceFrom1x2(home: number, draw: number, away: number) {
  const s = home + draw + away || 1;
  const h = home / s;
  const d = draw / s;
  const a = away / s;
  return {
    dc1x: clamp(h + d, 0, 1),
    dcx2: clamp(d + a, 0, 1),
    dc12: clamp(h + a, 0, 1),
    fail1x: clamp(a, 0, 1),
    failx2: clamp(h, 0, 1),
    fail12: clamp(d, 0, 1),
  };
}

export function teamToScoreFromGrid(grid: number[][]) {
  let homeZero = 0;
  let awayZero = 0;
  let tot = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      const p = row[y] ?? 0;
      tot += p;
      if (x === 0) homeZero += p;
      if (y === 0) awayZero += p;
    }
  }
  const z = tot || 1;
  return {
    homeScore: clamp(1 - homeZero / z, 0, 1),
    awayScore: clamp(1 - awayZero / z, 0, 1),
    homeFail: clamp(homeZero / z, 0, 1),
    awayFail: clamp(awayZero / z, 0, 1),
  };
}

export function totalsFromGrid(grid: number[][]) {
  const pTot: number[] = Array.from({ length: 16 }, () => 0);
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      const t = Math.min(15, x + y);
      pTot[t] = (pTot[t] ?? 0) + (row[y] ?? 0);
    }
  }
  const cdf: number[] = [];
  let acc = 0;
  for (let k = 0; k <= 15; k++) {
    acc += pTot[k] ?? 0;
    cdf[k] = acc;
  }
  const over = (line: number) => {
    const maxUnder = Math.floor(line);
    return clamp(1 - (cdf[maxUnder] ?? 1), 0, 1);
  };
  return {
    pTot,
    over05: over(0.5),
    over15: over(1.5),
    over25: over(2.5),
    over35: over(3.5),
    over45: over(4.5),
  };
}

export function drawConcentration(grid: number[][]) {
  let draw = 0;
  let low = 0;
  const cells: Array<{ score: string; p: number }> = [];
  for (let k = 0; k < grid.length; k++) {
    const p = grid[k]?.[k] ?? 0;
    draw += p;
    if (k <= 3) low += p;
    cells.push({ score: `${k}-${k}`, p });
  }
  cells.sort((a, b) => b.p - a.p);
  return {
    draw,
    lowScoreDraw: low,
    concentration: draw > 0 ? low / draw : 0,
    topDraw: cells[0] ?? { score: "1-1", p: 0 },
  };
}

export function drawRiskScore(opts: {
  drawP: number;
  lambdaGap: number;
  h2hDraw?: number | null;
  h2hN?: number;
}): number {
  let s = clamp(opts.drawP / 0.4, 0, 1) * 55;
  s += (1 - clamp(opts.lambdaGap / 0.8, 0, 1)) * 25;
  if ((opts.h2hN ?? 0) >= 4 && opts.h2hDraw != null) s += opts.h2hDraw * 20;
  return clamp(s, 0, 100);
}

export function upsetRiskScore(opts: {
  favP: number;
  oppScoreP: number;
  favForm?: number | null;
  lambdaGap: number;
}): number {
  let s = (1 - clamp(opts.favP, 0, 1)) * 35;
  s += clamp(opts.oppScoreP, 0, 1) * 30;
  if (opts.favForm != null) s += (1 - opts.favForm) * 20;
  s += (1 - clamp(opts.lambdaGap / 0.6, 0, 1)) * 15;
  return clamp(s, 0, 100);
}

/** Poisson O/U for a count market (corners / cards). DATA_UNAVAILABLE if λ missing. */
export function poissonOver(lambda: number | null, line: number): number | null {
  if (lambda == null || !Number.isFinite(lambda) || lambda <= 0) return null;
  if (!Number.isFinite(line)) return null;
  const maxUnder = Math.floor(line);
  let under = 0;
  for (let k = 0; k <= maxUnder; k++) under += poissonPmf(k, lambda);
  return clamp(1 - under, 0, 1);
}

export function poissonOverAsian(lambda: number | null, line: number): AsianOutcome | null {
  if (lambda == null || !Number.isFinite(lambda) || lambda <= 0) return null;
  if (!Number.isFinite(line)) return null;
  const out: AsianOutcome = { fullWin: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 0 };
  for (let k = 0; k <= 30; k++) {
    const p = poissonPmf(k, lambda);
    const s = settleAsian(k, -line);
    if (s === "full_win") out.fullWin += p;
    else if (s === "half_win") out.halfWin += p;
    else if (s === "push") out.push += p;
    else if (s === "half_loss") out.halfLoss += p;
    else out.loss += p;
  }
  return out;
}

/**
 * P(G ∪ A) = P(G) + P(A) − P(G ∩ A).
 * Overlap from historical joint rate when present; otherwise P(G)·P(A) (independence).
 * Never sums raw. Expected minutes must scale λ. Missing minutes → unavailable.
 */
export function playerGoalOrAssist(opts: {
  lambdaG: number | null;
  lambdaA: number | null;
  expectedMinutes: number | null;
  overlap?: number | null;
}): { pG: number; pA: number; pBoth: number; pOr: number } | null {
  if (opts.expectedMinutes == null || opts.expectedMinutes < 20) return null;
  if (opts.lambdaG == null || opts.lambdaA == null) return null;
  const scale = clamp(opts.expectedMinutes / 90, 0.15, 1.05);
  const lg = Math.max(0, opts.lambdaG) * scale;
  const la = Math.max(0, opts.lambdaA) * scale;
  const pG = 1 - Math.exp(-lg);
  const pA = 1 - Math.exp(-la);
  const pBoth =
    opts.overlap != null && Number.isFinite(opts.overlap)
      ? clamp(opts.overlap, 0, Math.min(pG, pA))
      : pG * pA;
  const pOr = clamp(pG + pA - pBoth, 0, 1);
  return { pG, pA, pBoth, pOr };
}

export function crossMarketFlags(opts: {
  home: number;
  draw: number;
  away: number;
  bttsYes: number;
  over25: number;
  homeScore: number;
  awayScore: number;
  scoreline: string;
  ahLine?: AhLine | null;
}): string[] {
  const flags: string[] = [];
  const s = opts.scoreline.match(/^(\d+)-(\d+)$/);
  const hg = s ? Number(s[1]) : null;
  const ag = s ? Number(s[2]) : null;
  if (hg != null && ag != null) {
    if (hg > ag && opts.away > opts.home + 0.04) flags.push("CS fights 1X2");
    if (ag > hg && opts.home > opts.away + 0.04) flags.push("CS fights 1X2");
    if (hg >= 1 && ag >= 1 && opts.bttsYes < 0.4) flags.push("CS fights BTTS No");
    if ((hg === 0 || ag === 0) && opts.bttsYes > 0.62) flags.push("CS fights BTTS Yes");
    if (hg + ag >= 3 && opts.over25 < 0.42) flags.push("CS fights Under 2.5");
    if (hg + ag <= 2 && opts.over25 > 0.62) flags.push("CS fights Over 2.5");
  }
  if (opts.bttsYes > Math.min(opts.homeScore, opts.awayScore) + 0.02) {
    flags.push("BTTS exceeds team-to-score");
  }
  if (opts.ahLine && Math.abs(opts.ahLine.line) >= 1.5) {
    if (opts.over25 < 0.45) flags.push("large handicap in a low-goal match");
  }
  return flags;
}

export function aavs(opts: {
  accuracy: number;
  edge: number;
  agreement: number;
  dataQuality: number;
  robustness?: number;
}): number {
  const rob = opts.robustness ?? 1;
  return (
    clamp(opts.accuracy, 0, 1) *
    (1 + clamp(opts.edge, -0.2, 0.25)) *
    clamp(opts.agreement, 0, 1) *
    clamp(opts.dataQuality, 0, 1) *
    clamp(rob, 0, 1)
  );
}

export function bestAhLine(
  grid: number[][],
  posted: Array<{ side: "home" | "away"; line: number; odd: number }>,
): { side: "home" | "away"; line: number; odd: number; cover: number; ev: number; outcome: AsianOutcome } | null {
  let best: {
    side: "home" | "away";
    line: number;
    odd: number;
    cover: number;
    ev: number;
    outcome: AsianOutcome;
  } | null = null;
  for (const row of posted) {
    const outcome = asianFromGrid(grid, row.side, row.line);
    const cover = asianCoverP(outcome);
    const ev = asianExpectedReturn(outcome, row.odd) - 1;
    if (ev <= 0) continue;
    if (!best || ev > best.ev + 1e-9 || (Math.abs(ev - best.ev) < 1e-9 && cover > best.cover)) {
      best = { ...row, cover, ev, outcome };
    }
  }
  return best;
}

export function asianLineStability(
  grid: number[][],
  side: "home" | "away",
  line: number,
  odd: number,
): "high" | "moderate" | "low" {
  const neighbors = [line - 0.25, line, line + 0.25];
  let plus = 0;
  for (const L of neighbors) {
    const o = asianFromGrid(grid, side, L);
    if (asianExpectedReturn(o, odd) - 1 > 0) plus += 1;
  }
  if (plus >= 3) return "high";
  if (plus >= 2) return "moderate";
  return "low";
}

export function countOverFromLambda(lambda: number | null, line: number, side: "over" | "under"): number | null {
  const over = poissonOver(lambda, line);
  if (over == null) return null;
  return side === "over" ? over : 1 - over;
}

/** Team cards λ: home cards + away cards. Null if either side is missing — missing ≠ 0. */
export function totalCardsLambda(homePerMatch: number | null, awayPerMatch: number | null): number | null {
  if (homePerMatch == null || awayPerMatch == null) return null;
  if (!Number.isFinite(homePerMatch) || !Number.isFinite(awayPerMatch)) return null;
  const tot = homePerMatch + awayPerMatch;
  if (tot <= 0) return null;
  return clamp(tot, 0.4, 12);
}

export function kindUsesGoals(kind: MarketKind): boolean {
  return kind !== "corners" && kind !== "cards" && kind !== "player_ga";
}

export const DEFAULT_MULTI_RANGES = [
  { min: 0, max: 1, id: "0-1" },
  { min: 2, max: 3, id: "2-3" },
  { min: 4, max: 5, id: "4-5" },
  { min: 6, max: null as number | null, id: "6+" },
] as const;

export const MAX_SAME_MARKET_FAMILY = 1;
export const MIN_COMBO_JOINT = 0.4;
export const COMBO_SKIP = new Set<MarketKind>(["corners", "cards", "player_ga", "combo", "cs"]);

export interface ComboSpec {
  legs: ComboLeg[];
  jointP: number;
  combinedOdds: number;
  selection: string;
}

export function parseOddEven(selection: string): "even" | "odd" | null {
  const t = String(selection ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (/\beven\b/.test(t) && !/\bodd\b/.test(t)) return "even";
  if (/\bodd\b/.test(t) && !/\beven\b/.test(t)) return "odd";
  return null;
}

export function parseMultiGoals(selection: string): { min: number; max: number | null } | null {
  const t = String(selection ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
  const plus = t.match(/^(\d+)\+$/) || t.match(/^(\d+)(?:ormore|plus)$/);
  if (plus) return { min: Number(plus[1]), max: null };
  const range = t.match(/^(\d+)-(\d+)$/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  return null;
}

export function formatMultiGoals(range: { min: number; max: number | null }): string {
  return range.max == null ? `${range.min}+` : `${range.min}-${range.max}`;
}

export function multiGoalsFromGrid(
  grid: number[][],
  range: { min: number; max: number | null },
): number {
  let p = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      const tot = x + y;
      if (tot >= range.min && (range.max == null || tot <= range.max)) p += row[y] ?? 0;
    }
  }
  return clamp(p, 0, 1);
}

export function oddEvenFromGrid(grid: number[][]): { even: number; odd: number } {
  let even = 0;
  let odd = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      const p = row[y] ?? 0;
      if ((x + y) % 2 === 0) even += p;
      else odd += p;
    }
  }
  const z = even + odd || 1;
  return { even: clamp(even / z, 0, 1), odd: clamp(odd / z, 0, 1) };
}

/** Closed form for Poisson totals: P(even) = (1 + e^{-2λ}) / 2. */
export function poissonParity(lambda: number): { even: number; odd: number } {
  const l = Math.max(0, lambda);
  const even = clamp((1 + Math.exp(-2 * l)) / 2, 0, 1);
  return { even, odd: 1 - even };
}

export function negBinPmf(k: number, mean: number, r = 8): number {
  if (k < 0 || mean <= 0) return k === 0 ? 1 : 0;
  const p = r / (r + mean);
  let coeff = 1;
  for (let i = 1; i <= k; i++) coeff *= (r + i - 1) / i;
  return coeff * Math.pow(p, r) * Math.pow(1 - p, k);
}

/** Corners λ: same clamp as cards. Missing ≠ 0. */
export function totalCornersLambda(homePerMatch: number | null, awayPerMatch: number | null): number | null {
  return totalCardsLambda(homePerMatch, awayPerMatch);
}

export function jointFromGrid(grid: number[][], preds: Array<(h: number, a: number) => boolean>): number {
  if (!preds.length) return 0;
  let p = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      if (preds.every((fn) => fn(x, y))) p += row[y] ?? 0;
    }
  }
  return clamp(p, 0, 1);
}

function ouLineFromKind(kind: MarketKind): number | null {
  switch (kind) {
    case "over_05":
    case "under_05":
      return 0.5;
    case "over_15":
    case "under_15":
      return 1.5;
    case "over_25":
    case "under_25":
      return 2.5;
    case "over_35":
    case "under_35":
      return 3.5;
    case "over_45":
    case "under_45":
      return 4.5;
    default:
      return null;
  }
}

export function comboPredicateForKind(
  kind: MarketKind,
  selection: string,
): ((h: number, a: number) => boolean) | null {
  switch (kind) {
    case "home":
      return (h, a) => h > a;
    case "away":
      return (h, a) => a > h;
    case "draw":
      return (h, a) => h === a;
    case "dc_1x":
      return (h, a) => h >= a;
    case "dc_x2":
      return (h, a) => a >= h;
    case "dc_12":
      return (h, a) => h !== a;
    case "btts_yes":
      return (h, a) => h >= 1 && a >= 1;
    case "btts_no":
      return (h, a) => h === 0 || a === 0;
    case "over_05":
      return (h, a) => h + a >= 1;
    case "under_05":
      return (h, a) => h + a < 1;
    case "over_15":
      return (h, a) => h + a >= 2;
    case "under_15":
      return (h, a) => h + a < 2;
    case "over_25":
      return (h, a) => h + a >= 3;
    case "under_25":
      return (h, a) => h + a < 3;
    case "over_35":
      return (h, a) => h + a >= 4;
    case "under_35":
      return (h, a) => h + a < 4;
    case "over_45":
      return (h, a) => h + a >= 5;
    case "under_45":
      return (h, a) => h + a < 5;
    case "home_score":
      return (h) => h >= 1;
    case "away_score":
      return (_h, a) => a >= 1;
    case "odd_even": {
      const side = parseOddEven(selection);
      if (!side) return null;
      return (h, a) => (side === "even" ? (h + a) % 2 === 0 : (h + a) % 2 === 1);
    }
    case "multi_goals": {
      const range = parseMultiGoals(selection);
      if (!range) return null;
      return (h, a) => {
        const tot = h + a;
        return tot >= range.min && (range.max == null || tot <= range.max);
      };
    }
    case "cs": {
      const m = String(selection).match(/(\d+)\s*-\s*(\d+)/);
      if (!m) return null;
      const hg = Number(m[1]);
      const ag = Number(m[2]);
      return (h, a) => h === hg && a === ag;
    }
    default:
      return null;
  }
}

function asianCellWeight(diff: number, line: number): number {
  const s = settleAsian(diff, line);
  if (s === "full_win") return 1;
  if (s === "half_win") return 0.5;
  return 0;
}

export function comboCellWeight(kind: MarketKind, selection: string, h: number, a: number): number | null {
  const pred = comboPredicateForKind(kind, selection);
  if (pred) return pred(h, a) ? 1 : 0;
  if (kind === "ah") {
    const ah = parseAhSelection(selection);
    if (!ah) return null;
    const diff = ah.side === "home" ? h - a : a - h;
    return asianCellWeight(diff, ah.line);
  }
  if (kind === "ou_asian") {
    const cnt = parseCountSelection(selection);
    if (!cnt) return null;
    const tot = h + a;
    return cnt.side === "over" ? asianCellWeight(tot, -cnt.line) : asianCellWeight(-tot, cnt.line);
  }
  if (kind === "eh") {
    const eh = parseEhSelection(selection);
    if (!eh) return null;
    return settleEuropean(h, a, eh) === eh.side ? 1 : 0;
  }
  return null;
}

export function pFromGridForKind(kind: MarketKind, selection: string, grid: number[][]): number {
  if (kind === "ah") {
    const ah = parseAhSelection(selection);
    if (!ah) return 0;
    return asianCoverP(asianFromGrid(grid, ah.side, ah.line));
  }
  if (kind === "ou_asian") {
    const cnt = parseCountSelection(selection);
    if (!cnt) return 0;
    return asianCoverP(asianTotalFromGrid(grid, cnt.side, cnt.line));
  }
  if (kind === "eh") {
    const eh = parseEhSelection(selection);
    if (!eh) return 0;
    const dist = europeanFromGrid(grid, eh);
    return eh.side === "home" ? dist.home : eh.side === "away" ? dist.away : dist.draw;
  }
  if (kind === "odd_even") {
    const side = parseOddEven(selection);
    if (!side) return 0;
    const p = oddEvenFromGrid(grid);
    return side === "even" ? p.even : p.odd;
  }
  if (kind === "multi_goals") {
    const range = parseMultiGoals(selection);
    if (!range) return 0;
    return multiGoalsFromGrid(grid, range);
  }
  const pred = comboPredicateForKind(kind, selection);
  if (!pred) return 0;
  return jointFromGrid(grid, [pred]);
}

export function comboJointP(grid: number[][], legs: ComboLeg[]): number {
  if (!legs.length) return 0;
  let tot = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x] ?? [];
    for (let y = 0; y < row.length; y++) {
      let w = row[y] ?? 0;
      if (w <= 0) continue;
      let ok = true;
      for (const leg of legs) {
        const cw = comboCellWeight(leg.kind, leg.selection, x, y);
        if (cw == null) {
          ok = false;
          break;
        }
        w *= cw;
        if (w <= 0) {
          ok = false;
          break;
        }
      }
      if (ok) tot += w;
    }
  }
  return clamp(tot, 0, 1);
}

export type SgpRow = {
  label: string;
  pa: number;
  pb: number;
  joint: number;
  product: number;
  phi: number;
  lift: number;
  fairOdds: number;
  naiveOdds: number;
  unadjustedEv: number;
};

/** φ of two same-game indicators. The joint is the cell sum; the product is what an acca assumes. */
export function sgpPair(
  grid: number[][],
  a: { kind: MarketKind; selection: string },
  b: { kind: MarketKind; selection: string },
  label: string,
): SgpRow {
  const pa = pFromGridForKind(a.kind, a.selection, grid);
  const pb = pFromGridForKind(b.kind, b.selection, grid);
  const joint = comboJointP(grid, [
    { kind: a.kind, selection: a.selection, odd: 1 },
    { kind: b.kind, selection: b.selection, odd: 1 },
  ]);
  const product = pa * pb;
  const denom = Math.sqrt(Math.max(0, pa * (1 - pa) * pb * (1 - pb)));
  const phi = denom < 1e-12 ? 0 : clamp((joint - product) / denom, -1, 1);
  const lift = product < 1e-12 ? 0 : joint / product;
  const fairOdds = joint > 1e-12 ? 1 / joint : Number.POSITIVE_INFINITY;
  const naiveOdds = product > 1e-12 ? 1 / product : Number.POSITIVE_INFINITY;
  return {
    label,
    pa,
    pb,
    joint,
    product,
    phi,
    lift,
    fairOdds,
    naiveOdds,
    unadjustedEv: Number.isFinite(naiveOdds) ? joint * naiveOdds - 1 : 0,
  };
}

/**
 * Same-game parlay correlation on one score matrix.
 * bothImplyOver15 is P(over 1.5 | both teams score). On integer goals it is 1,
 * so the third leg adds price and no risk.
 */
export function sgpBoard(grid: number[][]): { rows: SgpRow[]; bothImplyOver15: number } {
  const rows = [
    sgpPair(
      grid,
      { kind: "home_score", selection: "Home to score" },
      { kind: "away_score", selection: "Away to score" },
      "Home over 0.5 + away over 0.5",
    ),
    sgpPair(
      grid,
      { kind: "home_score", selection: "Home to score" },
      { kind: "over_15", selection: "Over 1.5" },
      "Home over 0.5 + over 1.5",
    ),
    sgpPair(
      grid,
      { kind: "home", selection: "Home" },
      { kind: "over_15", selection: "Over 1.5" },
      "Home win + over 1.5",
    ),
    sgpPair(
      grid,
      { kind: "home", selection: "Home" },
      { kind: "under_25", selection: "Under 2.5" },
      "Home win + under 2.5",
    ),
  ];
  const both = comboJointP(grid, [
    { kind: "home_score", selection: "Home to score", odd: 1 },
    { kind: "away_score", selection: "Away to score", odd: 1 },
  ]);
  const triple = comboJointP(grid, [
    { kind: "home_score", selection: "Home to score", odd: 1 },
    { kind: "away_score", selection: "Away to score", odd: 1 },
    { kind: "over_15", selection: "Over 1.5", odd: 1 },
  ]);
  return { rows, bothImplyOver15: both > 1e-12 ? triple / both : 0 };
}

function ouSideLine(kind: MarketKind, selection: string): { side: "over" | "under"; line: number } | null {
  const fromKind = ouLineFromKind(kind);
  if (fromKind != null) {
    return { side: kind.startsWith("under") ? "under" : "over", line: fromKind };
  }
  if (kind === "ou_asian") return parseCountSelection(selection);
  return null;
}

export function comboContradiction(a: ComboLeg, b: ComboLeg): boolean {
  const pair = new Set([`${a.kind}:${a.selection}`, `${b.kind}:${b.selection}`]);
  const kinds = new Set([a.kind, b.kind]);
  if (kinds.has("home") && kinds.has("away")) return true;
  if (kinds.has("home") && kinds.has("dc_x2")) return true;
  if (kinds.has("away") && kinds.has("dc_1x")) return true;
  if (kinds.has("draw") && kinds.has("dc_12")) return true;
  if (kinds.has("btts_yes") && kinds.has("btts_no")) return true;
  if (kinds.has("home") && kinds.has("draw")) return true;
  if (kinds.has("away") && kinds.has("draw")) return true;
  if (kinds.has("home") && kinds.has("dc_1x")) return true;
  if (kinds.has("away") && kinds.has("dc_x2")) return true;
  if (kinds.has("draw") && (kinds.has("dc_1x") || kinds.has("dc_x2"))) return true;
  if (kinds.has("home") && kinds.has("dc_12")) return true;
  if (kinds.has("away") && kinds.has("dc_12")) return true;
  if (kinds.has("home") && kinds.has("home_score")) return true;
  if (kinds.has("away") && kinds.has("away_score")) return true;
  if (kinds.has("odd_even") && parseOddEven(a.selection) && parseOddEven(b.selection)) {
    if (parseOddEven(a.selection) !== parseOddEven(b.selection)) return true;
  }
  if (kinds.has("btts_yes") && (kinds.has("under_05") || kinds.has("under_15"))) return true;
  const oa = ouSideLine(a.kind, a.selection);
  const ob = ouSideLine(b.kind, b.selection);
  if (oa && ob && oa.side !== ob.side) {
    const over = oa.side === "over" ? oa : ob;
    const under = oa.side === "under" ? oa : ob;
    if (over.line >= under.line) return true;
  }
  void pair;
  return false;
}

function familyOk(legs: ComboLeg[]): boolean {
  const seen = new Set<string>();
  for (const leg of legs) {
    const f = familyOf(leg.kind);
    if (seen.has(f)) return false;
    seen.add(f);
  }
  return true;
}

export function robustnessFromPerturb(baseP: number, perturbed: number[]): number {
  if (!perturbed.length) return 1;
  const baseSide = baseP >= 0.5;
  let stay = 0;
  let abs = 0;
  for (const p of perturbed) {
    if ((p >= 0.5) === baseSide) stay += 1;
    abs += Math.abs(p - baseP);
  }
  const stayOnSide = stay / perturbed.length;
  const meanAbs = abs / perturbed.length;
  return clamp(stayOnSide * (1 - meanAbs / 0.15), 0, 1);
}

export function generateCombos(
  picks: Array<{ kind: MarketKind; selection: string; odd: number }>,
  grid: number[][],
  max = 3,
): ComboSpec[] {
  const pool = picks.filter((p) => !COMBO_SKIP.has(p.kind) && p.odd > 1);
  const out: ComboSpec[] = [];
  const pushIf = (legs: ComboLeg[]) => {
    if (legs.length < 2) return;
    if (!familyOk(legs)) return;
    for (let i = 0; i < legs.length; i++) {
      for (let j = i + 1; j < legs.length; j++) {
        if (comboContradiction(legs[i]!, legs[j]!)) return;
      }
    }
    let combinedOdds = 1;
    for (const leg of legs) combinedOdds *= leg.odd;
    if (combinedOdds < COMBO_ODDS_BAND.min - 1e-9 || combinedOdds > COMBO_ODDS_BAND.max + 1e-9) return;
    const jointP = comboJointP(grid, legs);
    if (jointP < MIN_COMBO_JOINT) return;
    out.push({
      legs,
      jointP,
      combinedOdds,
      selection: legs.map((l) => l.selection).join(" + "),
    });
  };
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const two: ComboLeg[] = [
        { kind: pool[i]!.kind, selection: pool[i]!.selection, odd: pool[i]!.odd },
        { kind: pool[j]!.kind, selection: pool[j]!.selection, odd: pool[j]!.odd },
      ];
      pushIf(two);
      for (let k = j + 1; k < pool.length; k++) {
        pushIf([
          ...two,
          { kind: pool[k]!.kind, selection: pool[k]!.selection, odd: pool[k]!.odd },
        ]);
      }
    }
  }
  out.sort((a, b) => b.jointP * b.combinedOdds - a.jointP * a.combinedOdds);
  return out.slice(0, max);
}

const OVER_FOCUS_KINDS = new Set<MarketKind>(["home_score", "away_score", "over_15", "over_25"]);

function overPairImplied(a: MarketKind, b: MarketKind): boolean {
  return (a === "over_15" && b === "over_25") || (a === "over_25" && b === "over_15");
}

/** Same-match over pairs. Joint is the score-matrix cell sum, never the product of the two prices. */
export function sameMatchOverPairs(
  legs: Array<{ kind: MarketKind; selection: string; odd: number }>,
  grid: number[][],
): ComboSpec[] {
  const pool = legs.filter((p) => OVER_FOCUS_KINDS.has(p.kind) && p.odd > 1);
  const out: ComboSpec[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]!;
      const b = pool[j]!;
      if (a.kind === b.kind) continue;
      if (overPairImplied(a.kind, b.kind)) continue;
      const pair: ComboLeg[] = [
        { kind: a.kind, selection: a.selection, odd: a.odd },
        { kind: b.kind, selection: b.selection, odd: b.odd },
      ];
      const jointP = comboJointP(grid, pair);
      if (!(jointP > 0)) continue;
      let combinedOdds = 1;
      for (const leg of pair) combinedOdds *= leg.odd;
      out.push({
        legs: pair,
        jointP,
        combinedOdds,
        selection: pair.map((l) => l.selection).join(" + "),
      });
    }
  }
  return out;
}

export function settleKind(
  kind: MarketKind,
  selection: string,
  hg: number,
  ag: number,
  extra?: {
    corners?: number | null;
    homeCorners?: number | null;
    awayCorners?: number | null;
    cards?: number | null;
    playerHit?: boolean | null;
    comboLegs?: ComboLeg[];
  },
): boolean | null {
  if (!Number.isFinite(hg) || !Number.isFinite(ag) || hg < 0 || ag < 0) return null;
  const tot = hg + ag;
  switch (kind) {
    case "home":
      return hg > ag;
    case "away":
      return ag > hg;
    case "draw":
      return hg === ag;
    case "dc_1x":
      return hg >= ag;
    case "dc_x2":
      return ag >= hg;
    case "dc_12":
      return hg !== ag;
    case "btts_yes":
      return hg >= 1 && ag >= 1;
    case "btts_no":
      return hg === 0 || ag === 0;
    case "over_05":
      return tot >= 1;
    case "under_05":
      return tot < 1;
    case "over_15":
      return tot >= 2;
    case "under_15":
      return tot < 2;
    case "over_25":
      return tot >= 3;
    case "under_25":
      return tot < 3;
    case "over_35":
      return tot >= 4;
    case "under_35":
      return tot < 4;
    case "over_45":
      return tot >= 5;
    case "under_45":
      return tot < 5;
    case "home_score":
      return hg >= 1;
    case "away_score":
      return ag >= 1;
    case "cs": {
      const m = String(selection).match(/(\d+)\s*-\s*(\d+)/);
      if (!m) return null;
      return Number(m[1]) === hg && Number(m[2]) === ag;
    }
    case "ah": {
      const ah = parseAhSelection(selection);
      if (!ah) return null;
      const diff = ah.side === "home" ? hg - ag : ag - hg;
      const s = settleAsian(diff, ah.line);
      if (s === "push") return null;
      return s === "full_win" || s === "half_win";
    }
    case "ou_asian": {
      const cnt = parseCountSelection(selection);
      if (!cnt) return null;
      const s = cnt.side === "over" ? settleAsian(tot, -cnt.line) : settleAsian(-tot, cnt.line);
      if (s === "push") return null;
      return s === "full_win" || s === "half_win";
    }
    case "eh": {
      const eh = parseEhSelection(selection);
      if (!eh) return null;
      return settleEuropean(hg, ag, eh) === eh.side;
    }
    case "corners":
      return settleCorner(selection, extra ?? {});
    case "cards": {
      const c = extra?.cards;
      if (c == null) return null;
      const line = parseCountSelection(selection);
      if (!line) return null;
      return line.side === "over" ? c > line.line : c < line.line;
    }
    case "player_ga":
      return extra?.playerHit ?? null;
    case "multi_goals": {
      const range = parseMultiGoals(selection);
      if (!range) return null;
      return tot >= range.min && (range.max == null || tot <= range.max);
    }
    case "odd_even": {
      const side = parseOddEven(selection);
      if (!side) return null;
      const even = tot % 2 === 0;
      return side === "even" ? even : !even;
    }
    case "combo": {
      const legs = extra?.comboLegs;
      if (!legs?.length) return null;
      let anyPush = false;
      let allWin = true;
      for (const leg of legs) {
        const r = settleKind(leg.kind, leg.selection, hg, ag);
        if (r == null) anyPush = true;
        else if (!r) allWin = false;
      }
      if (anyPush) return null;
      return allWin;
    }
    default:
      return null;
  }
}

export function emptyAsian(): AsianOutcome {
  return { fullWin: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 0 };
}
