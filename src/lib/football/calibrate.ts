import { accuracyPriors, clamp, ensembleFamilyOf, invLogit, logit, valuePriors } from "./models.ts";
import { autoresearchShrink } from "./autoresearch.ts";
import { sharpeFromBets, familySharpeReports, deflatedSharpe, type SharpeReport, type FamilySharpeRow } from "./sharpe.ts";
import type { MarketKind, ModelName, ScoredPick } from "./types.ts";

/** Expert keys on the accuracy / value pool — not the grid-union internals. */
export const EXPERTS = ["dc", "shin", "api", "elo", "h2h"] as const;
export type ExpertKey = (typeof EXPERTS)[number];
export type EnsembleFamily = "win" | "btts" | "ou" | "cs";

export type ExpertWeights = Record<ExpertKey, number>;

export const EXPERT_LABELS: Record<ExpertKey, string> = {
  dc: "Union grid",
  shin: "Shin market",
  api: "API-Football",
  elo: "Pi / Elo",
  h2h: "Baio H2H",
};

export const EXPERT_TO_MODEL: Record<ExpertKey, ModelName> = {
  dc: "dixonColes",
  shin: "shin",
  api: "apiFootball",
  elo: "hvattumElo",
  h2h: "baioH2h",
};

export const FAMILIES: EnsembleFamily[] = ["win", "btts", "ou", "cs"];

export const FAMILY_LABELS: Record<EnsembleFamily, string> = {
  win: "1X2 / handicap",
  btts: "BTTS / team",
  ou: "Over / under",
  cs: "Correct score",
};

/** Pseudo-count: ~ a week of tens before the corpus can outvote the prior. */
export const CAL_N0 = 48;
/** Below this, stay on the prior for that family. */
export const CAL_MIN_N = 12;
/** An expert needs this many scored lines before its Brier can move its share. */
export const CAL_MIN_EXPERT_N = 8;
export const CAL_SHIN_CAP = 0.72;
export const CAL_DC_FLOOR = 0.12;
export const CAL_EXPERT_FLOOR = 0.03;
export const CAL_BINS = 10;
export const CAL_MAX_OBS = 4000;
/** Recency half-life: a line two weeks ago counts half as much as today. */
export const CAL_HALFLIFE_DAYS = 14;
/** OOS Brier must beat the prior by this much before we leave the paper mix. */
export const CAL_OOS_DELTA = 0.0005;
export const CAL_LS_STEPS = 56;
export const CAL_LS_LR = 0.3;
export const CAL_LS_LOGIT_LR = 1.15;
export const CAL_PLATT_STEPS = 48;
export const CAL_PLATT_LR = 0.35;
export const CAL_PLATT_RIDGE = 0.12;
export const CAL_PLATT_A_MIN = 0.55;
export const CAL_PLATT_A_MAX = 1.45;
export const CAL_PLATT_B_MAX = 0.85;

export type FitMethod = "prior" | "inverse-brier" | "mix-ls" | "prior-platt" | "mix-ls-platt";
export const FIT_METHODS: FitMethod[] = ["prior", "inverse-brier", "mix-ls", "prior-platt", "mix-ls-platt"];
export const FIT_CANDIDATES: FitMethod[] = ["inverse-brier", "mix-ls", "prior-platt", "mix-ls-platt"];
export const FIT_METHOD_LABELS: Record<FitMethod, string> = {
  prior: "Paper prior",
  "inverse-brier": "Inverse-Brier",
  "mix-ls": "Backtest mix",
  "prior-platt": "Prior + scale",
  "mix-ls-platt": "Backtest mix + scale",
};

export interface PlattMap {
  a: number;
  b: number;
}

export const IDENTITY_PLATT: PlattMap = { a: 1, b: 0 };

export interface CalibrationObservation {
  date: string;
  fixtureId: number;
  kind: MarketKind;
  family: EnsembleFamily;
  selection: string;
  y: 0 | 1;
  p: Partial<Record<ExpertKey, number>>;
  /** Pooled accuracy that scored this line that day — for ECE, not for reweighting. */
  accuracy: number;
  /** Posted decimal when known. Required for Sharpe; older corpus rows omit it. */
  odd?: number;
}

export interface ReliabilityBin {
  lo: number;
  hi: number;
  pBar: number;
  yBar: number;
  n: number;
}

export interface FamilyCalibration {
  family: EnsembleFamily;
  n: number;
  nByExpert: ExpertWeights;
  brier: ExpertWeights;
  logLoss: ExpertWeights;
  priorAcc: ExpertWeights;
  priorVal: ExpertWeights;
  acc: ExpertWeights;
  val: ExpertWeights;
  ece: number;
  reliability: ReliabilityBin[];
  rule: FitMethod;
  oosBrier: number;
  oosPrior: number;
  plattA: number;
  plattB: number;
  /** 1 = identity. Below 1 only after the autoresearch holdout agreed. */
  shrink: number;
  autoresearch: string;
  inSampleAcc: ExpertWeights;
  backtestWindows: number;
}

export interface CardExpertRow {
  expert: ExpertKey;
  label: string;
  n: number;
  brier: number;
  logLoss: number;
  meanP: number;
}

export interface CardCalibration {
  n: number;
  hits: number;
  brier: number;
  logLoss: number;
  ece: number;
  reliability: ReliabilityBin[];
  experts: CardExpertRow[];
}

export interface CalibrationSnapshot {
  asOf: string;
  n: number;
  nDates: number;
  dates: string[];
  families: Record<EnsembleFamily, FamilyCalibration>;
  hyper: CalibrateHyper;
  hyperId: string;
}

export interface CalibrationReport {
  applied: CalibrationSnapshot;
  card: CardCalibration | null;
  nAfter: number;
  ingested: number;
  walkForward?: WalkForwardReport | null;
  wfo?: WfoPair | null;
  sharpe?: SharpeReport | null;
  cardSharpe?: SharpeReport | null;
  sharpeByFamily?: FamilySharpeRow[];
  deflatedPsr?: number | null;
  nTrials?: number;
  validation?: ValidationContrast | null;
}

export function emptyWeights(): ExpertWeights {
  return { dc: 0, shin: 0, api: 0, elo: 0, h2h: 0 };
}

export function copyWeights(w: ExpertWeights): ExpertWeights {
  return { dc: w.dc, shin: w.shin, api: w.api, elo: w.elo, h2h: w.h2h };
}

export function brierScore(p: number, y: number): number {
  const q = clamp(p, 1e-4, 0.999);
  return (q - y) * (q - y);
}

export function logLossScore(p: number, y: number): number {
  const q = clamp(p, 1e-4, 0.999);
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

export function renormalize(w: ExpertWeights, floor = 0): ExpertWeights {
  const out = emptyWeights();
  let tot = 0;
  for (const k of EXPERTS) {
    out[k] = Math.max(floor, w[k] ?? 0);
    tot += out[k];
  }
  if (tot <= 0) return copyWeights(w);
  for (const k of EXPERTS) out[k] /= tot;
  return out;
}

export function mixWeights(emp: ExpertWeights, prior: ExpertWeights, n: number, n0 = CAL_N0): ExpertWeights {
  const t = n <= 0 ? 0 : n / (n + n0);
  const out = emptyWeights();
  for (const k of EXPERTS) out[k] = t * emp[k] + (1 - t) * prior[k];
  return renormalize(out);
}

/** Recency half-life and prior pseudo-count the mix shrinks with. */
export interface CalibrateHyper {
  halfLife: number;
  n0: number;
}

export const DEFAULT_HYPER: CalibrateHyper = { halfLife: CAL_HALFLIFE_DAYS, n0: CAL_N0 };

export interface WfoGridCell extends CalibrateHyper {
  id: string;
  label: string;
}

/**
 * Pardo walk-forward grid. Mix-ls only — do not nest method × hyper
 * (that 16-way search is the overfitting the lab is meant to catch).
 */
export const WFO_GRID: WfoGridCell[] = [
  { id: "default", label: "14d · n₀ 48", halfLife: 14, n0: 48 },
  { id: "short", label: "7d · n₀ 24", halfLife: 7, n0: 24 },
  { id: "long", label: "28d · n₀ 96", halfLife: 28, n0: 96 },
  { id: "tight", label: "14d · n₀ 96", halfLife: 14, n0: 96 },
];

/** Rolling IS window for WFO (validation still uses CAL_ROLLING_DATES = 7). */
export const WFO_ROLLING_DATES = 2;
export const WFO_PBO_MIN_DATES = 6;
export const WFO_METHOD: FitMethod = "mix-ls";

export function hyperOf(h?: CalibrateHyper | null): CalibrateHyper {
  if (!h || !(h.halfLife > 0) || !(h.n0 > 0)) return { ...DEFAULT_HYPER };
  return { halfLife: h.halfLife, n0: h.n0 };
}

export function wfoGridId(h: CalibrateHyper): string {
  const hit = WFO_GRID.find((g) => g.halfLife === h.halfLife && g.n0 === h.n0);
  return hit?.id ?? `hl${h.halfLife}-n${h.n0}`;
}

export function wfoGridCell(id: string): WfoGridCell {
  return WFO_GRID.find((g) => g.id === id) ?? WFO_GRID[0]!;
}

function applyAccuracyGuardrails(w: ExpertWeights): ExpertWeights {
  const out = renormalize({
    dc: Math.max(CAL_DC_FLOOR, w.dc),
    shin: Math.min(CAL_SHIN_CAP, w.shin),
    api: Math.max(CAL_EXPERT_FLOOR, w.api),
    elo: Math.max(CAL_EXPERT_FLOOR, w.elo),
    h2h: Math.max(CAL_EXPERT_FLOOR, w.h2h),
  });
  if (out.shin > CAL_SHIN_CAP) {
    out.dc += out.shin - CAL_SHIN_CAP;
    out.shin = CAL_SHIN_CAP;
  }
  if (out.dc < CAL_DC_FLOOR) {
    const need = CAL_DC_FLOOR - out.dc;
    const donors = EXPERTS.filter((k) => k !== "dc" && out[k] > CAL_EXPERT_FLOOR);
    const pool = donors.reduce((s, k) => s + (out[k] - CAL_EXPERT_FLOOR), 0);
    if (pool > 0) {
      for (const k of donors) {
        const take = Math.min(out[k] - CAL_EXPERT_FLOOR, need * ((out[k] - CAL_EXPERT_FLOOR) / pool));
        out[k] -= take;
        out.dc += take;
      }
    }
  }
  out.shin = Math.min(out.shin, CAL_SHIN_CAP);
  out.dc = Math.max(out.dc, CAL_DC_FLOOR);
  return out;
}

function applyValueGuardrails(w: ExpertWeights): ExpertWeights {
  const out = copyWeights(w);
  out.shin = 0;
  out.dc = Math.max(out.dc, CAL_DC_FLOOR);
  for (const k of EXPERTS) {
    if (k === "shin") continue;
    out[k] = Math.max(CAL_EXPERT_FLOOR, out[k]);
  }
  return renormalize(out);
}

export function inverseBrierWeights(
  brier: ExpertWeights,
  nByExpert: ExpertWeights,
  prior: ExpertWeights,
  opts?: { dropShin?: boolean },
): ExpertWeights {
  const dropShin = opts?.dropShin === true;
  const inv = emptyWeights();
  let sumInv = 0;
  const usable: ExpertKey[] = [];
  for (const k of EXPERTS) {
    if (dropShin && k === "shin") continue;
    if (nByExpert[k] < CAL_MIN_EXPERT_N) continue;
    const mse = Math.max(brier[k], 1e-6);
    inv[k] = 1 / mse;
    sumInv += inv[k];
    usable.push(k);
  }
  if (sumInv <= 0 || usable.length === 0) return copyWeights(prior);

  const reserved = EXPERTS.filter((k) => !usable.includes(k)).reduce((s, k) => s + prior[k], 0);
  const presentMass = Math.max(0.05, 1 - reserved);
  const emp = emptyWeights();
  for (const k of EXPERTS) {
    if (usable.includes(k)) emp[k] = (inv[k] / sumInv) * presentMass;
    else emp[k] = prior[k];
  }
  if (dropShin) emp.shin = 0;
  return renormalize(emp);
}

export function recencyWeight(obsDate: string, asOf: string, halfLife = CAL_HALFLIFE_DAYS): number {
  const a = Date.parse(`${obsDate}T00:00:00Z`);
  const b = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const days = Math.max(0, (b - a) / 86_400_000);
  return 2 ** (-days / Math.max(1, halfLife));
}

export function effectiveN(weights: number[]): number {
  let s = 0;
  let s2 = 0;
  for (const w of weights) {
    if (!(w > 0)) continue;
    s += w;
    s2 += w * w;
  }
  if (s2 <= 0) return 0;
  return (s * s) / s2;
}

/**
 * Granger–Ramanathan combination: minimise Brier of the pool, not of
 * each expert in isolation. Accuracy uses the same logit pool as the live
 * desk (Satopää is applied later per-card). Value stays a linear mix with
 * Shin dropped. Projected onto the Shin-cap / DC-floor simplex each step.
 */
export function mixLeastSquaresWeights(
  rows: CalibrationObservation[],
  prior: ExpertWeights,
  opts?: { dropShin?: boolean; asOf?: string; pool?: "linear" | "logit"; halfLife?: number },
): ExpertWeights {
  const dropShin = opts?.dropShin === true;
  const pool = opts?.pool ?? (dropShin ? "linear" : "logit");
  if (rows.length < CAL_MIN_EXPERT_N) return copyWeights(prior);
  const asOf = opts?.asOf ?? rows[rows.length - 1]?.date ?? "9999-12-31";
  const halfLife = opts?.halfLife ?? CAL_HALFLIFE_DAYS;
  const brier = emptyWeights();
  const nBy = emptyWeights();
  for (const o of rows) {
    for (const k of EXPERTS) {
      const p = o.p[k];
      if (p == null || !Number.isFinite(p)) continue;
      brier[k] += brierScore(p, o.y);
      nBy[k] += 1;
    }
  }
  for (const k of EXPERTS) {
    brier[k] = nBy[k] > 0 ? brier[k] / nBy[k] : 0.25;
  }
  let w = inverseBrierWeights(brier, nBy, prior, { dropShin });
  const project = dropShin ? applyValueGuardrails : applyAccuracyGuardrails;
  w = project(w);
  const lr = pool === "logit" ? CAL_LS_LOGIT_LR : CAL_LS_LR;
  for (let step = 0; step < CAL_LS_STEPS; step++) {
    const grad = emptyWeights();
    let mass = 0;
    for (const o of rows) {
      const r = recencyWeight(o.date, asOf, halfLife);
      const pMix = pool === "logit" ? poolLogitP(o.p, w) : mixExpertP(o.p, w);
      const err = pMix - o.y;
      mass += r;
      for (const k of EXPERTS) {
        if (dropShin && k === "shin") continue;
        const pk = o.p[k];
        if (pk == null || !Number.isFinite(pk)) continue;
        if (pool === "logit") {
          // ∂σ(z)/∂w_k = σ(z)(1−σ(z)) (logit p_k − z) on the simplex
          grad[k] += r * 2 * err * pMix * (1 - pMix) * (logit(pk) - logit(pMix));
        } else {
          // ∂p_mix/∂w_k = (p_k − p_mix) on the renormalized simplex
          grad[k] += r * 2 * err * (pk - pMix);
        }
      }
    }
    if (!(mass > 0)) break;
    const next = emptyWeights();
    for (const k of EXPERTS) {
      if (dropShin && k === "shin") {
        next[k] = 0;
        continue;
      }
      next[k] = w[k] - lr * (grad[k] / mass);
    }
    w = project(next);
  }
  return w;
}

export function applyPlatt(p: number, map: PlattMap | null | undefined): number {
  const a = map?.a ?? 1;
  const b = map?.b ?? 0;
  if (a === 1 && b === 0) return clamp(p, 1e-4, 0.999);
  return invLogit(a * logit(p) + b);
}

/** Recency-weighted logistic (Platt) map of a mix onto observed hits. Ridge pulls toward identity. */
export function fitPlattMap(
  rows: CalibrationObservation[],
  pOf: (o: CalibrationObservation) => number,
  asOf: string,
  halfLife = CAL_HALFLIFE_DAYS,
): PlattMap {
  if (rows.length < CAL_MIN_N) return { ...IDENTITY_PLATT };
  let a = 1;
  let b = 0;
  for (let step = 0; step < CAL_PLATT_STEPS; step++) {
    let ga = 0;
    let gb = 0;
    let mass = 0;
    for (const o of rows) {
      const r = recencyWeight(o.date, asOf, halfLife);
      const z = logit(pOf(o));
      const p = invLogit(a * z + b);
      const err = p - o.y;
      ga += r * err * z;
      gb += r * err;
      mass += r;
    }
    if (!(mass > 0)) break;
    a = clamp(a - CAL_PLATT_LR * (ga / mass + CAL_PLATT_RIDGE * (a - 1)), CAL_PLATT_A_MIN, CAL_PLATT_A_MAX);
    b = clamp(b - CAL_PLATT_LR * (gb / mass + CAL_PLATT_RIDGE * b), -CAL_PLATT_B_MAX, CAL_PLATT_B_MAX);
  }
  return { a, b };
}

export type PlattShape = "identity" | "temperature" | "bias" | "full";

/**
 * Three Platt maps on one book, inside the live clamps.
 * Temperature is a only (b = 0): it pulls both tails toward 1/2 together.
 * Bias is b only (a = 1): it shifts every logit by the same amount.
 * Full is what the desk fits. A one-price book cannot tell a from b.
 */
export function plattMethodTrace() {
  const hot = plattBook([
    [0.8, 10, 10],
    [0.2, 10, 10],
  ]);
  const shifted = plattBook([
    [0.4, 12, 4],
    [0.6, 14, 2],
  ]);
  return {
    hot: plattShapes(hot),
    shifted: plattShapes(shifted),
  };
}

function plattBook(specs: Array<[number, number, number]>): Array<{ p: number; y: 0 | 1 }> {
  const rows: Array<{ p: number; y: 0 | 1 }> = [];
  for (const [p, hits, misses] of specs) {
    for (let i = 0; i < hits; i++) rows.push({ p, y: 1 });
    for (let i = 0; i < misses; i++) rows.push({ p, y: 0 });
  }
  return rows;
}

function plattShapes(rows: Array<{ p: number; y: 0 | 1 }>) {
  const maps: Record<PlattShape, PlattMap> = {
    identity: { ...IDENTITY_PLATT },
    temperature: fitPlattShape(rows, "temperature"),
    bias: fitPlattShape(rows, "bias"),
    full: fitPlattShape(rows, "full"),
  };
  const probe = [0.2, 0.4, 0.6, 0.8];
  return {
    maps,
    brier: {
      identity: plattBrier(rows, maps.identity),
      temperature: plattBrier(rows, maps.temperature),
      bias: plattBrier(rows, maps.bias),
      full: plattBrier(rows, maps.full),
    },
    at: probe.map((p) => ({
      p,
      identity: applyPlatt(p, maps.identity),
      temperature: applyPlatt(p, maps.temperature),
      bias: applyPlatt(p, maps.bias),
      full: applyPlatt(p, maps.full),
    })),
  };
}

function fitPlattShape(rows: Array<{ p: number; y: 0 | 1 }>, shape: Exclude<PlattShape, "identity">): PlattMap {
  let a = 1;
  let b = 0;
  for (let step = 0; step < CAL_PLATT_STEPS; step++) {
    let ga = 0;
    let gb = 0;
    for (const o of rows) {
      const z = logit(o.p);
      const p = invLogit(a * z + b);
      const err = p - o.y;
      if (shape !== "bias") ga += err * z;
      if (shape !== "temperature") gb += err;
    }
    const n = rows.length || 1;
    if (shape !== "bias") {
      a = clamp(a - CAL_PLATT_LR * (ga / n + CAL_PLATT_RIDGE * (a - 1)), CAL_PLATT_A_MIN, CAL_PLATT_A_MAX);
    }
    if (shape !== "temperature") {
      b = clamp(b - CAL_PLATT_LR * (gb / n + CAL_PLATT_RIDGE * b), -CAL_PLATT_B_MAX, CAL_PLATT_B_MAX);
    }
  }
  return { a, b };
}

function plattBrier(rows: Array<{ p: number; y: 0 | 1 }>, map: PlattMap): number {
  if (!rows.length) return 0;
  let s = 0;
  for (const o of rows) {
    const q = applyPlatt(o.p, map);
    s += (q - o.y) * (q - o.y);
  }
  return s / rows.length;
}

export function reliabilityDiagram(
  pairs: Array<{ p: number; y: number }>,
  bins = CAL_BINS,
): { bins: ReliabilityBin[]; ece: number } {
  const acc: ReliabilityBin[] = [];
  for (let i = 0; i < bins; i++) {
    acc.push({ lo: i / bins, hi: (i + 1) / bins, pBar: 0, yBar: 0, n: 0 });
  }
  for (const row of pairs) {
    const p = clamp(row.p, 0, 1);
    let i = Math.floor(p * bins);
    if (i >= bins) i = bins - 1;
    if (i < 0) i = 0;
    acc[i].n += 1;
    acc[i].pBar += p;
    acc[i].yBar += row.y;
  }
  let ece = 0;
  const nTot = pairs.length || 1;
  for (const b of acc) {
    if (b.n <= 0) continue;
    b.pBar /= b.n;
    b.yBar /= b.n;
    ece += (b.n / nTot) * Math.abs(b.pBar - b.yBar);
  }
  return { bins: acc, ece };
}

function familyOfPick(kind: MarketKind): EnsembleFamily {
  return ensembleFamilyOf(kind) as EnsembleFamily;
}

export function observationFromPick(date: string, pick: ScoredPick): CalibrationObservation | null {
  const hit = pick.settled?.hit;
  if (hit == null) return null;
  const y: 0 | 1 = hit ? 1 : 0;
  const p: Partial<Record<ExpertKey, number>> = {};
  if (Number.isFinite(pick.models.dixonColes)) p.dc = pick.models.dixonColes;
  if (pick.models.shin != null && Number.isFinite(pick.models.shin)) p.shin = pick.models.shin;
  if (Number.isFinite(pick.models.apiFootball)) p.api = pick.models.apiFootball;
  if (Number.isFinite(pick.models.hvattumElo)) p.elo = pick.models.hvattumElo;
  if (Number.isFinite(pick.models.baioH2h)) p.h2h = pick.models.baioH2h;
  if (p.dc == null) return null;
  return {
    date,
    fixtureId: pick.fixtureId,
    kind: pick.kind,
    family: familyOfPick(pick.kind),
    selection: pick.selection,
    y,
    p,
    accuracy: pick.accuracy,
    odd: pick.odd > 1 ? pick.odd : undefined,
  };
}

export function obsKey(o: CalibrationObservation): string {
  return `${o.date}|${o.fixtureId}|${o.kind}|${o.selection}`;
}

export function mergeObservations(
  existing: CalibrationObservation[],
  incoming: CalibrationObservation[],
  max = CAL_MAX_OBS,
): CalibrationObservation[] {
  const map = new Map<string, CalibrationObservation>();
  for (const o of existing) map.set(obsKey(o), o);
  for (const o of incoming) map.set(obsKey(o), o);
  const all = [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.fixtureId - b.fixtureId);
  return all.length > max ? all.slice(all.length - max) : all;
}

function meanOrPrior(sum: number, n: number, fallback: number): number {
  return n > 0 ? sum / n : fallback;
}

export interface CalibrateOpts {
  method?: FitMethod;
  asOf?: string;
  oosBrier?: number;
  oosPrior?: number;
  hyper?: CalibrateHyper;
}

function familyRows(obs: CalibrationObservation[], family: EnsembleFamily): CalibrationObservation[] {
  return obs.filter((o) => o.family === family);
}

function expertDiagnostics(rows: CalibrationObservation[]): {
  brier: ExpertWeights;
  logLoss: ExpertWeights;
  nBy: ExpertWeights;
} {
  const brierSum = emptyWeights();
  const logSum = emptyWeights();
  const nBy = emptyWeights();
  for (const o of rows) {
    for (const k of EXPERTS) {
      const p = o.p[k];
      if (p == null || !Number.isFinite(p)) continue;
      brierSum[k] += brierScore(p, o.y);
      logSum[k] += logLossScore(p, o.y);
      nBy[k] += 1;
    }
  }
  const brier = emptyWeights();
  const logLoss = emptyWeights();
  for (const k of EXPERTS) {
    brier[k] = meanOrPrior(brierSum[k], nBy[k], 0.25);
    logLoss[k] = meanOrPrior(logSum[k], nBy[k], 0.7);
  }
  return { brier, logLoss, nBy };
}

function recencyN(rows: CalibrationObservation[], asOf: string, halfLife = CAL_HALFLIFE_DAYS): number {
  return effectiveN(rows.map((o) => recencyWeight(o.date, asOf, halfLife)));
}

export function fitFamilyWeights(
  rows: CalibrationObservation[],
  family: EnsembleFamily,
  method: FitMethod,
  asOf: string,
  hyper?: CalibrateHyper,
): { acc: ExpertWeights; val: ExpertWeights } {
  const priorAcc = copyWeights(accuracyPriors(family) as ExpertWeights);
  const priorVal = copyWeights(valuePriors(family) as ExpertWeights);
  const h = hyperOf(hyper);
  const base = baseMethod(method);
  if (base === "prior" || rows.length < CAL_MIN_N) {
    return { acc: copyWeights(priorAcc), val: copyWeights(priorVal) };
  }
  const nEff = Math.max(rows.length * 0.5, recencyN(rows, asOf, h.halfLife));
  const { brier, nBy } = expertDiagnostics(rows);
  let empAcc: ExpertWeights;
  let empVal: ExpertWeights;
  if (base === "mix-ls") {
    empAcc = mixLeastSquaresWeights(rows, priorAcc, { asOf, pool: "logit", halfLife: h.halfLife });
    empVal = mixLeastSquaresWeights(rows, priorVal, { asOf, dropShin: true, pool: "linear", halfLife: h.halfLife });
  } else {
    empAcc = inverseBrierWeights(brier, nBy, priorAcc);
    empVal = inverseBrierWeights(brier, nBy, priorVal, { dropShin: true });
  }
  return {
    acc: applyAccuracyGuardrails(mixWeights(empAcc, priorAcc, nEff, h.n0)),
    val: applyValueGuardrails(mixWeights(empVal, priorVal, nEff, h.n0)),
  };
}

function baseMethod(method: FitMethod): "prior" | "inverse-brier" | "mix-ls" {
  if (method === "mix-ls" || method === "mix-ls-platt") return "mix-ls";
  if (method === "inverse-brier") return "inverse-brier";
  return "prior";
}

function methodUsesPlatt(method: FitMethod): boolean {
  return method === "prior-platt" || method === "mix-ls-platt";
}

export function fitFamilyFull(
  rows: CalibrationObservation[],
  family: EnsembleFamily,
  method: FitMethod,
  asOf: string,
  hyper?: CalibrateHyper,
): { acc: ExpertWeights; val: ExpertWeights; platt: PlattMap } {
  const h = hyperOf(hyper);
  const { acc, val } = fitFamilyWeights(rows, family, method, asOf, h);
  const platt = methodUsesPlatt(method)
    ? fitPlattMap(rows, (o) => poolLogitP(o.p, acc), asOf, h.halfLife)
    : { ...IDENTITY_PLATT };
  return { acc, val, platt };
}

export interface BacktestMeanFit {
  acc: ExpertWeights;
  val: ExpertWeights;
  platt: PlattMap;
  windows: number;
  inSample: { acc: ExpertWeights; val: ExpertWeights; platt: PlattMap };
}

/**
 * Recency-weighted mean of expanding-window fits (including the full sample).
 * The live mix is the average of mixes that were available on earlier dates —
 * not a one-shot in-sample refit of the method that won nested walk-forward.
 */
export function backtestMeanFit(
  rows: CalibrationObservation[],
  family: EnsembleFamily,
  method: FitMethod,
  asOf: string,
  hyper?: CalibrateHyper,
): BacktestMeanFit {
  const h = hyperOf(hyper);
  const inSample = fitFamilyFull(rows, family, method, asOf, h);
  if (baseMethod(method) === "prior" || rows.length < CAL_MIN_N) {
    return { acc: inSample.acc, val: inSample.val, platt: inSample.platt, windows: 0, inSample };
  }
  const dates = [...new Set(rows.map((o) => o.date))].sort();
  const cuts = [...dates.filter((d) => d < asOf), asOf];
  const accSum = emptyWeights();
  const valSum = emptyWeights();
  let aSum = 0;
  let bSum = 0;
  let mass = 0;
  let windows = 0;
  for (const cut of cuts) {
    const train = rows.filter((o) => o.date < cut);
    if (train.length < CAL_MIN_N) continue;
    const fit = cut === asOf ? inSample : fitFamilyFull(train, family, method, cut, h);
    const recencyDate = cut === asOf ? (dates[dates.length - 1] ?? cut) : cut;
    const r = recencyWeight(recencyDate, asOf, h.halfLife);
    mass += r;
    windows += 1;
    for (const k of EXPERTS) {
      accSum[k] += r * fit.acc[k];
      valSum[k] += r * fit.val[k];
    }
    aSum += r * fit.platt.a;
    bSum += r * fit.platt.b;
  }
  if (!(mass > 0) || windows < 1) {
    return { acc: inSample.acc, val: inSample.val, platt: inSample.platt, windows: 0, inSample };
  }
  const acc = emptyWeights();
  const val = emptyWeights();
  for (const k of EXPERTS) {
    acc[k] = accSum[k] / mass;
    val[k] = valSum[k] / mass;
  }
  return {
    acc: applyAccuracyGuardrails(acc),
    val: applyValueGuardrails(val),
    platt: methodUsesPlatt(method)
      ? {
          a: clamp(aSum / mass, CAL_PLATT_A_MIN, CAL_PLATT_A_MAX),
          b: clamp(bSum / mass, -CAL_PLATT_B_MAX, CAL_PLATT_B_MAX),
        }
      : { ...IDENTITY_PLATT },
    windows,
    inSample,
  };
}

export function scoreCalibratedP(o: CalibrationObservation, acc: ExpertWeights, platt?: PlattMap | null): number {
  return applyPlatt(poolLogitP(o.p, acc), platt);
}

export function methodOosBrier(
  obs: CalibrationObservation[],
  family: EnsembleFamily,
  method: FitMethod,
  asOf: string,
  hyper?: CalibrateHyper,
): { n: number; brier: number } {
  const h = hyperOf(hyper);
  const rows = familyRows(obs, family).filter((o) => o.date < asOf || asOf === "9999-12-31");
  const scoped = rows.filter((o) => o.date <= asOf);
  const dates = [...new Set(scoped.map((o) => o.date))].sort();
  let n = 0;
  let brier = 0;
  if (!dates.length) return { n: 0, brier: 0 };
  if (method === "prior") {
    const prior = copyWeights(accuracyPriors(family) as ExpertWeights);
    for (const o of scoped) {
      brier += brierScore(poolLogitP(o.p, prior), o.y);
      n += 1;
    }
    return { n, brier: n ? brier / n : 0 };
  }
  for (const date of dates) {
    const train = scoped.filter((o) => o.date < date);
    const test = scoped.filter((o) => o.date === date);
    if (!test.length) continue;
    const fit = fitFamilyFull(train, family, method, date, h);
    for (const o of test) {
      brier += brierScore(scoreCalibratedP(o, fit.acc, fit.platt), o.y);
      n += 1;
    }
  }
  return { n, brier: n ? brier / n : 0 };
}

export function selectFitMethod(
  obs: CalibrationObservation[],
  family: EnsembleFamily,
  asOf: string,
  hyper?: CalibrateHyper,
): { method: FitMethod; oosBrier: number; oosPrior: number } {
  const h = hyperOf(hyper);
  const rows = familyRows(obs, family);
  const n = rows.length;
  const oosPrior = methodOosBrier(obs, family, "prior", asOf, h);
  if (n < CAL_MIN_N) {
    return { method: "prior", oosBrier: oosPrior.brier, oosPrior: oosPrior.brier };
  }
  const dates = [...new Set(rows.map((o) => o.date))].sort();
  if (dates.length < 2) {
    const fallback: FitMethod = "mix-ls";
    return { method: fallback, oosBrier: oosPrior.brier, oosPrior: oosPrior.brier };
  }
  let best: FitMethod = "prior";
  let bestBrier = oosPrior.brier;
  for (const method of FIT_CANDIDATES) {
    const scored = methodOosBrier(obs, family, method, asOf, h);
    if (scored.n >= CAL_MIN_N && scored.brier < bestBrier - CAL_OOS_DELTA) {
      best = method;
      bestBrier = scored.brier;
    }
  }
  return { method: best, oosBrier: bestBrier, oosPrior: oosPrior.brier };
}

export function calibrateFamily(
  obs: CalibrationObservation[],
  family: EnsembleFamily,
  opts: CalibrateOpts = {},
): FamilyCalibration {
  const rows = familyRows(obs, family);
  const asOf = opts.asOf ?? rows[rows.length - 1]?.date ?? "9999-12-31";
  const hyper = hyperOf(opts.hyper);
  const picked = opts.method
    ? {
        method: opts.method,
        oosBrier: opts.oosBrier ?? 0,
        oosPrior: opts.oosPrior ?? 0,
      }
    : selectFitMethod(obs, family, asOf, hyper);
  const priorAcc = copyWeights(accuracyPriors(family) as ExpertWeights);
  const priorVal = copyWeights(valuePriors(family) as ExpertWeights);
  const { brier, logLoss, nBy } = expertDiagnostics(rows);
  const pairs: Array<{ p: number; y: number }> = rows.map((o) => ({ p: o.accuracy, y: o.y }));
  const fitted = backtestMeanFit(rows, family, picked.method, asOf, hyper);
  const rel = reliabilityDiagram(pairs);
  const trial = autoresearchShrink(
    rows.map((o) => ({ date: o.date, p: o.accuracy, y: o.y })),
    asOf,
  );
  return {
    family,
    n: rows.length,
    nByExpert: nBy,
    brier,
    logLoss,
    priorAcc,
    priorVal,
    acc: fitted.acc,
    val: fitted.val,
    ece: rel.ece,
    reliability: rel.bins,
    rule: picked.method,
    oosBrier: picked.oosBrier,
    oosPrior: picked.oosPrior,
    plattA: fitted.platt.a,
    plattB: fitted.platt.b,
    shrink: trial.keep,
    autoresearch: trial.note,
    inSampleAcc: fitted.inSample.acc,
    backtestWindows: fitted.windows,
  };
}

export function snapshotFromObservations(
  obs: CalibrationObservation[],
  asOf: string,
  hyper?: CalibrateHyper,
): CalibrationSnapshot {
  return packSnapshot(
    obs.filter((o) => o.date < asOf),
    asOf,
    hyper,
  );
}

export function cardCalibration(picks: ScoredPick[]): CardCalibration | null {
  const graded = picks.filter((p) => p.settled && p.settled.hit != null);
  if (!graded.length) return null;
  const pairs: Array<{ p: number; y: number }> = [];
  let hits = 0;
  let brier = 0;
  let logLoss = 0;
  const expert = {
    dc: { n: 0, brier: 0, logLoss: 0, meanP: 0 },
    shin: { n: 0, brier: 0, logLoss: 0, meanP: 0 },
    api: { n: 0, brier: 0, logLoss: 0, meanP: 0 },
    elo: { n: 0, brier: 0, logLoss: 0, meanP: 0 },
    h2h: { n: 0, brier: 0, logLoss: 0, meanP: 0 },
  };
  for (const p of graded) {
    const y: 0 | 1 = p.settled?.hit ? 1 : 0;
    if (y) hits += 1;
    pairs.push({ p: p.accuracy, y });
    brier += brierScore(p.accuracy, y);
    logLoss += logLossScore(p.accuracy, y);
    const vals: Record<ExpertKey, number | null> = {
      dc: p.models.dixonColes,
      shin: p.models.shin,
      api: p.models.apiFootball,
      elo: p.models.hvattumElo,
      h2h: p.models.baioH2h,
    };
    for (const k of EXPERTS) {
      const v = vals[k];
      if (v == null || !Number.isFinite(v)) continue;
      expert[k].n += 1;
      expert[k].brier += brierScore(v, y);
      expert[k].logLoss += logLossScore(v, y);
      expert[k].meanP += v;
    }
  }
  const n = graded.length;
  const rel = reliabilityDiagram(pairs);
  const experts: CardExpertRow[] = EXPERTS.map((k) => ({
    expert: k,
    label: EXPERT_LABELS[k],
    n: expert[k].n,
    brier: expert[k].n ? expert[k].brier / expert[k].n : 0,
    logLoss: expert[k].n ? expert[k].logLoss / expert[k].n : 0,
    meanP: expert[k].n ? expert[k].meanP / expert[k].n : 0,
  }));
  return {
    n,
    hits,
    brier: brier / n,
    logLoss: logLoss / n,
    ece: rel.ece,
    reliability: rel.bins,
    experts,
  };
}

export interface ValidationRow {
  id: "resubstitution" | "holdout" | "shuffled" | "expanding" | "rolling";
  label: string;
  valid: boolean;
  usesFuture: boolean;
  n: number;
  nDates: number;
  brier: number | null;
  note: string;
}

export interface ValidationContrast {
  rows: ValidationRow[];
  /** Expanding Brier minus resubstitution Brier. Positive means the in-sample grade looked too good. */
  optimism: number | null;
  desk: "expanding";
}

const VALIDATION_MIN_N = 8;

function priorP(o: CalibrationObservation): number {
  return poolLogitP(o.p, accuracyPriors(o.family));
}

/** Intercept on the logit of the frozen paper mix. Eight lines or it stays 0. */
function fitIntercept(train: CalibrationObservation[]): number {
  if (train.length < VALIDATION_MIN_N) return 0;
  let ySum = 0;
  let pSum = 0;
  for (const o of train) {
    ySum += o.y;
    pSum += priorP(o);
  }
  const yBar = clamp(ySum / train.length, 0.02, 0.98);
  const pBar = clamp(pSum / train.length, 0.02, 0.98);
  return logit(yBar) - logit(pBar);
}

function adjustedP(o: CalibrationObservation, a: number): number {
  return clamp(invLogit(logit(priorP(o)) + a), 1e-4, 0.999);
}

function meanBrier(train: CalibrationObservation[], test: CalibrationObservation[]): { n: number; brier: number } {
  const a = fitIntercept(train);
  let s = 0;
  for (const o of test) s += brierScore(adjustedP(o, a), o.y);
  const n = test.length;
  return { n, brier: n ? s / n : 0 };
}

/**
 * Five ways to grade one settled book. The probability starts as the paper mix.
 * Each scheme may shift that mix by an intercept fit on its training lines.
 * Resubstitution and time-blind k-fold are not valid. Expanding walk-forward is the desk.
 * Does not rank the ten.
 */
export function validationContrast(obs: CalibrationObservation[]): ValidationContrast {
  const dates = [...new Set(obs.map((o) => o.date))].sort();
  const byDate = new Map<string, CalibrationObservation[]>();
  for (const o of obs) {
    const list = byDate.get(o.date);
    if (list) list.push(o);
    else byDate.set(o.date, [o]);
  }
  const empty = (id: ValidationRow["id"], label: string, valid: boolean, usesFuture: boolean, note: string): ValidationRow => ({
    id,
    label,
    valid,
    usesFuture,
    n: 0,
    nDates: 0,
    brier: null,
    note,
  });
  if (!dates.length) {
    return {
      desk: "expanding",
      optimism: null,
      rows: [
        empty("resubstitution", "Resubstitution", false, false, "Fit and score are the same lines."),
        empty("holdout", "Last-date holdout", true, false, "One date. Honest, and noisy."),
        empty("shuffled", "K-fold, ignoring time", false, true, "A later date can train an earlier one."),
        empty("expanding", "Expanding walk-forward", true, false, "The desk. Day D never trains day D."),
        empty("rolling", "Rolling last 7", true, false, "Same embargo, short memory."),
      ],
    };
  }

  const all = obs;
  const resub = meanBrier(all, all);

  const last = dates[dates.length - 1]!;
  const holdTrain = all.filter((o) => o.date < last);
  const holdTest = byDate.get(last) ?? [];
  const hold = dates.length >= 2 ? meanBrier(holdTrain, holdTest) : { n: 0, brier: 0 };

  const k = Math.min(5, dates.length);
  let shufN = 0;
  let shufS = 0;
  let shufFuture = false;
  if (k >= 2) {
    dates.forEach((date, index) => {
      const fold = index % k;
      const trainDates = dates.filter((_, i) => i % k !== fold);
      if (trainDates.some((d) => d > date)) shufFuture = true;
      const train = all.filter((o) => trainDates.includes(o.date));
      const test = byDate.get(date) ?? [];
      const scored = meanBrier(train, test);
      shufN += scored.n;
      shufS += scored.brier * scored.n;
    });
  }

  let expN = 0;
  let expS = 0;
  let rollN = 0;
  let rollS = 0;
  for (const date of dates) {
    const earlier = dates.filter((d) => d < date);
    const trainExp = all.filter((o) => earlier.includes(o.date));
    const rollDates = earlier.slice(Math.max(0, earlier.length - CAL_ROLLING_DATES));
    const trainRoll = all.filter((o) => rollDates.includes(o.date));
    const test = byDate.get(date) ?? [];
    const exp = meanBrier(trainExp, test);
    const roll = meanBrier(trainRoll, test);
    expN += exp.n;
    expS += exp.brier * exp.n;
    rollN += roll.n;
    rollS += roll.brier * roll.n;
  }

  const rows: ValidationRow[] = [
    {
      id: "resubstitution",
      label: "Resubstitution",
      valid: false,
      usesFuture: false,
      n: resub.n,
      nDates: dates.length,
      brier: resub.brier,
      note: "The intercept is fit on the lines it then grades.",
    },
    {
      id: "holdout",
      label: "Last-date holdout",
      valid: true,
      usesFuture: false,
      n: hold.n,
      nDates: hold.n ? 1 : 0,
      brier: hold.n ? hold.brier : null,
      note: "Honest. One date, so one noisy number.",
    },
    {
      id: "shuffled",
      label: "K-fold, ignoring time",
      valid: false,
      usesFuture: shufFuture,
      n: shufN,
      nDates: k >= 2 ? dates.length : 0,
      brier: shufN ? shufS / shufN : null,
      note: "Folds ignore the calendar. A later date can train an earlier one.",
    },
    {
      id: "expanding",
      label: "Expanding walk-forward",
      valid: true,
      usesFuture: false,
      n: expN,
      nDates: dates.length,
      brier: expN ? expS / expN : null,
      note: "The desk. Day D is scored with an intercept fit only on earlier dates.",
    },
    {
      id: "rolling",
      label: "Rolling last 7",
      valid: true,
      usesFuture: false,
      n: rollN,
      nDates: dates.length,
      brier: rollN ? rollS / rollN : null,
      note: "Same embargo. Training dates are the last seven before D.",
    },
  ];
  const resubB = rows[0]!.brier;
  const expB = rows[3]!.brier;
  return {
    desk: "expanding",
    optimism: resubB != null && expB != null ? expB - resubB : null,
    rows,
  };
}
export function makeReport(
  applied: CalibrationSnapshot,
  picks: ScoredPick[],
  nAfter: number,
  ingested: number,
  walkForward: WalkForwardReport | null = null,
  observations: CalibrationObservation[] = [],
  wfo: WfoPair | null = null,
): CalibrationReport {
  const corpusBets = observations
    .filter((o) => o.odd != null && o.odd > 1)
    .map((o) => ({ date: o.date, odd: o.odd as number, y: o.y, family: o.family }));
  const cardBets = picks
    .filter((p) => p.settled && p.settled.hit != null && p.odd > 1)
    .map((p) => ({
      date: p.date,
      odd: p.odd,
      y: (p.settled?.hit ? 1 : 0) as 0 | 1,
    }));
  const sharpe = corpusBets.length >= 2 ? sharpeFromBets(corpusBets) : null;
  const byFamily = corpusBets.length >= 2 ? familySharpeReports(corpusBets) : [];
  const nTrials = Math.max(1, new Set(corpusBets.map((b) => b.family ?? "other")).size);
  const deflatedPsr =
    sharpe?.sharpe != null ? deflatedSharpe(sharpe.sharpe, sharpe.n, sharpe.skew, sharpe.kurtosis, nTrials) : null;
  return {
    applied,
    card: cardCalibration(picks),
    nAfter,
    ingested,
    walkForward,
    wfo,
    sharpe,
    cardSharpe: cardBets.length >= 2 ? sharpeFromBets(cardBets) : null,
    sharpeByFamily: byFamily,
    deflatedPsr,
    nTrials,
    validation: validationContrast(observations),
  };
}

export function pctWeight(w: number): string {
  return `${Math.round(w * 100)}%`;
}

export function priorSnapshot(asOf: string): CalibrationSnapshot {
  return snapshotFromObservations([], asOf);
}

export const CAL_EMBARGO_DAYS = 0;
/** Rolling comparison uses this many prior dates once the corpus is longer than a week. */
export const CAL_ROLLING_DATES = 7;

export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}

/** Exclusive upper bound for training dates. Embargo 0 = the test date itself. */
export function trainCutoff(testDate: string, embargoDays = CAL_EMBARGO_DAYS): string {
  if (embargoDays <= 0) return testDate;
  return shiftYmd(testDate, -embargoDays);
}

/** Linear Bates–Granger mix of the experts that actually quoted this line. */
export function mixExpertP(p: Partial<Record<ExpertKey, number>>, w: ExpertWeights): number {
  let num = 0;
  let den = 0;
  for (const k of EXPERTS) {
    const pk = p[k];
    const wk = w[k] ?? 0;
    if (pk == null || !Number.isFinite(pk) || wk <= 0) continue;
    num += wk * clamp(pk, 1e-4, 0.999);
    den += wk;
  }
  if (den <= 0) {
    const fallback = p.dc ?? p.shin ?? 0.5;
    return clamp(fallback, 1e-4, 0.999);
  }
  return num / den;
}

/** Logit opinion pool — the same mix the live desk uses for accuracy. */
export function poolLogitP(p: Partial<Record<ExpertKey, number>>, w: ExpertWeights): number {
  let acc = 0;
  let den = 0;
  for (const k of EXPERTS) {
    const pk = p[k];
    const wk = w[k] ?? 0;
    if (pk == null || !Number.isFinite(pk) || wk <= 0) continue;
    acc += wk * logit(pk);
    den += wk;
  }
  if (den <= 0) {
    const fallback = p.dc ?? p.shin ?? 0.5;
    return clamp(fallback, 1e-4, 0.999);
  }
  return invLogit(acc / den);
}

export interface WalkForwardFold {
  date: string;
  trainN: number;
  trainDates: number;
  trainFrom: string | null;
  trainTo: string | null;
  n: number;
  hits: number;
  brierCal: number;
  brierPrior: number;
  brierRoll: number | null;
  logLossCal: number;
  logLossPrior: number;
  skill: number;
  cumBrierCal: number;
  cumBrierPrior: number;
  accWin: ExpertWeights;
  accByFamily: Record<EnsembleFamily, ExpertWeights>;
}

export interface WalkForwardFamilySlice {
  family: EnsembleFamily;
  n: number;
  brierCal: number;
  brierPrior: number;
  skill: number;
}

export interface WalkForwardExpertSlice {
  expert: ExpertKey;
  label: string;
  n: number;
  brier: number;
}

export interface DieboldMariano {
  t: number;
  p: number;
  meanDiff: number;
  n: number;
  lag: number;
  reject5: boolean;
}

export interface WalkForwardReport {
  asOf: string;
  embargoDays: number;
  rollingDates: number;
  n: number;
  nDates: number;
  hits: number;
  brierCal: number;
  brierPrior: number;
  brierRoll: number | null;
  logLossCal: number;
  logLossPrior: number;
  eceCal: number;
  skill: number;
  folds: WalkForwardFold[];
  families: Record<EnsembleFamily, WalkForwardFamilySlice>;
  experts: WalkForwardExpertSlice[];
  reliability: ReliabilityBin[];
  dm: DieboldMariano | null;
}

function emptyFamilySlice(family: EnsembleFamily): WalkForwardFamilySlice {
  return { family, n: 0, brierCal: 0, brierPrior: 0, skill: 0 };
}

export function emptyWalkForward(asOf = "", embargoDays = CAL_EMBARGO_DAYS, rollingDates = CAL_ROLLING_DATES): WalkForwardReport {
  return {
    asOf,
    embargoDays,
    rollingDates,
    n: 0,
    nDates: 0,
    hits: 0,
    brierCal: 0,
    brierPrior: 0,
    brierRoll: null,
    logLossCal: 0,
    logLossPrior: 0,
    eceCal: 0,
    skill: 0,
    folds: [],
    families: {
      win: emptyFamilySlice("win"),
      btts: emptyFamilySlice("btts"),
      ou: emptyFamilySlice("ou"),
      cs: emptyFamilySlice("cs"),
    },
    experts: EXPERTS.map((k) => ({ expert: k, label: EXPERT_LABELS[k], n: 0, brier: 0 })),
    reliability: [],
    dm: null,
  };
}

function skillScore(brierCal: number, brierPrior: number): number {
  if (!(brierPrior > 0)) return 0;
  return 1 - brierCal / brierPrior;
}

/** Lanczos approximation (g = 7) for log Γ(z), z > 0. */
function logGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const lanczos = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  z -= 1;
  let x = lanczos[0]!;
  for (let i = 1; i < lanczos.length; i++) x += lanczos[i]! / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function lnBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function betaCf(x: number, a: number, b: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return h;
}

function regIncBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = lnBeta(a, b);
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta);
  if (x < (a + 1) / (a + b + 2)) return (bt * betaCf(x, a, b)) / a;
  return 1 - (bt * betaCf(1 - x, b, a)) / b;
}

export function studentTCdf(t: number, nu: number): number {
  if (!(nu > 0) || !Number.isFinite(t)) return 0.5;
  const x = nu / (nu + t * t);
  const ib = regIncBeta(x, nu / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

function bartlettHacVar(e: number[], lag: number): number {
  const n = e.length;
  if (!n) return 0;
  let g0 = 0;
  for (const x of e) g0 += x * x;
  g0 /= n;
  const L = Math.max(0, Math.min(lag, n - 1));
  for (let l = 1; l <= L; l++) {
    let gl = 0;
    for (let t = l; t < n; t++) gl += e[t]! * e[t - l]!;
    gl /= n;
    g0 += 2 * (1 - l / (L + 1)) * gl;
  }
  return Math.max(0, g0);
}

/**
 * Diebold–Mariano (1995) on daily Brier, Harvey–Leybourne–Newbold (1997) small-sample.
 * d_t = L_prior − L_cal so t > 0 means the calibrated mix is sharper. One-sided p.
 */
export function dieboldMariano(cal: number[], prior: number[]): DieboldMariano | null {
  const n = Math.min(cal.length, prior.length);
  if (n < 3) return null;
  const d: number[] = [];
  for (let i = 0; i < n; i++) d.push(prior[i]! - cal[i]!);
  const mean = d.reduce((s, x) => s + x, 0) / n;
  const lag = Math.min(Math.max(1, Math.floor(n ** (1 / 3))), n - 1);
  const centered = d.map((x) => x - mean);
  const v = bartlettHacVar(centered, lag);
  const se = Math.sqrt(v / n);
  const h = 1;
  const hln = Math.sqrt(Math.max(0, n + 1 - 2 * h + (h * (h - 1)) / n) / n);
  let t: number;
  if (!(se > 1e-12)) {
    if (Math.abs(mean) < 1e-12) t = 0;
    else t = mean > 0 ? 8 : -8;
  } else {
    t = (mean / se) * hln;
  }
  if (!Number.isFinite(t)) t = 0;
  t = Math.max(-12, Math.min(12, t));
  const p = Math.max(0, Math.min(1, 1 - studentTCdf(t, n - 1)));
  return {
    t,
    p,
    meanDiff: mean,
    n,
    lag,
    reject5: t > 0 && p < 0.05,
  };
}

function packSnapshot(rows: CalibrationObservation[], asOf: string, hyper?: CalibrateHyper): CalibrationSnapshot {
  const h = hyperOf(hyper);
  const dates = [...new Set(rows.map((o) => o.date))].sort();
  const families = {} as Record<EnsembleFamily, FamilyCalibration>;
  for (const family of FAMILIES) {
    const picked = selectFitMethod(rows, family, asOf, h);
    families[family] = calibrateFamily(rows, family, {
      method: picked.method,
      asOf,
      oosBrier: picked.oosBrier,
      oosPrior: picked.oosPrior,
      hyper: h,
    });
  }
  return {
    asOf,
    n: rows.length,
    nDates: dates.length,
    dates,
    families,
    hyper: h,
    hyperId: wfoGridId(h),
  };
}

function lastDateSet(dates: string[], k: number): Set<string> {
  const u = [...new Set(dates)].sort();
  return new Set(u.slice(Math.max(0, u.length - k)));
}

export interface WalkForwardOpts {
  asOf?: string;
  embargoDays?: number;
  rollingDates?: number;
  hyper?: CalibrateHyper;
}

/**
 * Expanding-window walk-forward: each date is scored with accuracy weights
 * (and optional Platt intercept) fit only on earlier dates. Rolling last-K
 * dates is a second OOS mix. Labels on day D never train day D. Scoring uses
 * the live logit pool so the curve matches the ten.
 */
export function walkForwardValidate(
  obs: CalibrationObservation[],
  opts: WalkForwardOpts = {},
): WalkForwardReport {
  const embargoDays = opts.embargoDays ?? CAL_EMBARGO_DAYS;
  const rollingDates = opts.rollingDates ?? CAL_ROLLING_DATES;
  const asOf = opts.asOf ?? "9999-12-31";
  const hyper = hyperOf(opts.hyper);
  const usable = obs.filter((o) => o.date <= asOf);
  const dates = [...new Set(usable.map((o) => o.date))].sort();
  const empty = emptyWalkForward(asOf, embargoDays, rollingDates);
  if (!dates.length) return empty;

  const folds: WalkForwardFold[] = [];
  const famSum: Record<EnsembleFamily, { n: number; cal: number; prior: number }> = {
    win: { n: 0, cal: 0, prior: 0 },
    btts: { n: 0, cal: 0, prior: 0 },
    ou: { n: 0, cal: 0, prior: 0 },
    cs: { n: 0, cal: 0, prior: 0 },
  };
  const expSum = {
    dc: { n: 0, brier: 0 },
    shin: { n: 0, brier: 0 },
    api: { n: 0, brier: 0 },
    elo: { n: 0, brier: 0 },
    h2h: { n: 0, brier: 0 },
  };
  const pairs: Array<{ p: number; y: number }> = [];
  let totN = 0;
  let totHits = 0;
  let totCal = 0;
  let totPrior = 0;
  let totRoll = 0;
  let totRollN = 0;
  let totLlCal = 0;
  let totLlPrior = 0;

  for (const date of dates) {
    const cutoff = trainCutoff(date, embargoDays);
    const trainAll = usable.filter((o) => o.date < cutoff);
    const test = usable.filter((o) => o.date === date);
    if (!test.length) continue;

    const snap = packSnapshot(trainAll, date, hyper);
    const trainDateList = snap.dates;
    const rollingSet = lastDateSet(trainDateList, rollingDates);
    const rollingSame = rollingSet.size === 0 || rollingSet.size === trainDateList.length;
    const snapRoll = rollingSame
      ? snap
      : packSnapshot(
          trainAll.filter((o) => rollingSet.has(o.date)),
          date,
          hyper,
        );

    let n = 0;
    let hits = 0;
    let cal = 0;
    let prior = 0;
    let roll = 0;
    let llCal = 0;
    let llPrior = 0;
    for (const o of test) {
      const fam = snap.families[o.family];
      const accPrior = fam.priorAcc;
      const accRoll = snapRoll.families[o.family];
      const pCal = scoreCalibratedP(o, fam.acc, { a: fam.plattA, b: fam.plattB });
      const pPrior = poolLogitP(o.p, accPrior);
      const pRoll = scoreCalibratedP(o, accRoll.acc, { a: accRoll.plattA, b: accRoll.plattB });
      n += 1;
      if (o.y) hits += 1;
      cal += brierScore(pCal, o.y);
      prior += brierScore(pPrior, o.y);
      roll += brierScore(pRoll, o.y);
      llCal += logLossScore(pCal, o.y);
      llPrior += logLossScore(pPrior, o.y);
      pairs.push({ p: pCal, y: o.y });
      famSum[o.family].n += 1;
      famSum[o.family].cal += brierScore(pCal, o.y);
      famSum[o.family].prior += brierScore(pPrior, o.y);
      for (const k of EXPERTS) {
        const pk = o.p[k];
        if (pk == null || !Number.isFinite(pk)) continue;
        expSum[k].n += 1;
        expSum[k].brier += brierScore(pk, o.y);
      }
    }
    if (!n) continue;

    totN += n;
    totHits += hits;
    totCal += cal;
    totPrior += prior;
    totLlCal += llCal;
    totLlPrior += llPrior;
    if (!rollingSame) {
      totRoll += roll;
      totRollN += n;
    } else {
      totRoll += cal;
      totRollN += n;
    }

    folds.push({
      date,
      trainN: snap.n,
      trainDates: snap.nDates,
      trainFrom: trainDateList[0] ?? null,
      trainTo: trainDateList[trainDateList.length - 1] ?? null,
      n,
      hits,
      brierCal: cal / n,
      brierPrior: prior / n,
      brierRoll: roll / n,
      logLossCal: llCal / n,
      logLossPrior: llPrior / n,
      skill: skillScore(cal / n, prior / n),
      cumBrierCal: totCal / totN,
      cumBrierPrior: totPrior / totN,
      accWin: copyWeights(snap.families.win.acc),
      accByFamily: {
        win: copyWeights(snap.families.win.acc),
        btts: copyWeights(snap.families.btts.acc),
        ou: copyWeights(snap.families.ou.acc),
        cs: copyWeights(snap.families.cs.acc),
      },
    });
  }

  if (!totN) return empty;
  const rel = reliabilityDiagram(pairs);
  const families = {} as Record<EnsembleFamily, WalkForwardFamilySlice>;
  for (const f of FAMILIES) {
    const s = famSum[f];
    const brierCal = s.n ? s.cal / s.n : 0;
    const brierPrior = s.n ? s.prior / s.n : 0;
    families[f] = {
      family: f,
      n: s.n,
      brierCal,
      brierPrior,
      skill: skillScore(brierCal, brierPrior),
    };
  }
  return {
    asOf,
    embargoDays,
    rollingDates,
    n: totN,
    nDates: folds.length,
    hits: totHits,
    brierCal: totCal / totN,
    brierPrior: totPrior / totN,
    brierRoll: totRollN ? totRoll / totRollN : null,
    logLossCal: totLlCal / totN,
    logLossPrior: totLlPrior / totN,
    eceCal: rel.ece,
    skill: skillScore(totCal / totN, totPrior / totN),
    folds,
    families,
    experts: EXPERTS.map((k) => ({
      expert: k,
      label: EXPERT_LABELS[k],
      n: expSum[k].n,
      brier: expSum[k].n ? expSum[k].brier / expSum[k].n : 0,
    })),
    reliability: rel.bins,
    dm: dieboldMariano(
      folds.map((f) => f.brierCal),
      folds.map((f) => f.brierPrior),
    ),
  };
}

export type WfoWindow = "anchored" | "rolling";

export interface WfoFoldConfig {
  id: string;
  label: string;
  halfLife: number;
  n0: number;
  isBrier: number;
  oosBrier: number;
  efficiency: number | null;
}

export interface WfoFold {
  date: string;
  window: WfoWindow;
  trainN: number;
  trainDates: number;
  trainFrom: string | null;
  trainTo: string | null;
  n: number;
  isWinner: string;
  oosBest: string;
  isOosAgree: boolean;
  isBrier: number;
  oosBrier: number;
  efficiency: number | null;
  configs: WfoFoldConfig[];
}

export interface WfoGridSummary {
  id: string;
  label: string;
  halfLife: number;
  n0: number;
  isWins: number;
  oosWins: number;
  meanIs: number;
  meanOos: number;
  meanEfficiency: number | null;
  nFolds: number;
}

export interface WhiteRealityCheck {
  bestId: string;
  stat: number;
  p: number;
  nBoot: number;
  n: number;
}

export interface WfoReport {
  asOf: string;
  window: WfoWindow;
  rollingDates: number;
  n: number;
  nDates: number;
  folds: WfoFold[];
  grid: WfoGridSummary[];
  recommended: WfoGridCell;
  oosChampion: WfoGridCell;
  efficiency: number | null;
  lastAgree: boolean;
  pbo: number | null;
  pboN: number;
  white: WhiteRealityCheck | null;
  apply: boolean;
  appliedId: string;
  appliedReason: string;
}

export interface WfoPair {
  anchored: WfoReport;
  rolling: WfoReport;
}

export interface WfoOpts {
  asOf?: string;
  rollingDates?: number;
}

function emptyGridSummary(): WfoGridSummary[] {
  return WFO_GRID.map((g) => ({
    id: g.id,
    label: g.label,
    halfLife: g.halfLife,
    n0: g.n0,
    isWins: 0,
    oosWins: 0,
    meanIs: 0,
    meanOos: 0,
    meanEfficiency: null,
    nFolds: 0,
  }));
}

function emptyWfo(asOf: string, window: WfoWindow, rollingDates: number): WfoReport {
  const def = WFO_GRID[0]!;
  return {
    asOf,
    window,
    rollingDates,
    n: 0,
    nDates: 0,
    folds: [],
    grid: emptyGridSummary(),
    recommended: def,
    oosChampion: def,
    efficiency: null,
    lastAgree: true,
    pbo: null,
    pboN: 0,
    white: null,
    apply: false,
    appliedId: def.id,
    appliedReason: "corpus too small to walk the grid — staying on 14d · n₀ 48",
  };
}

function wfoEfficiency(isBrier: number, oosBrier: number): number | null {
  if (!(oosBrier > 0) || !(isBrier >= 0)) return null;
  return isBrier / oosBrier;
}

type FamilyMix = Record<EnsembleFamily, { acc: ExpertWeights; platt: PlattMap }>;

function fitMixLsFamilies(
  train: CalibrationObservation[],
  asOf: string,
  hyper: CalibrateHyper,
): FamilyMix {
  const out = {} as FamilyMix;
  for (const family of FAMILIES) {
    const rows = familyRows(train, family);
    const fit = fitFamilyFull(rows, family, WFO_METHOD, asOf, hyper);
    out[family] = { acc: fit.acc, platt: fit.platt };
  }
  return out;
}

function brierAgainstMix(rows: CalibrationObservation[], mix: FamilyMix): { n: number; brier: number } {
  let n = 0;
  let s = 0;
  for (const o of rows) {
    const f = mix[o.family];
    s += brierScore(scoreCalibratedP(o, f.acc, f.platt), o.y);
    n += 1;
  }
  return { n, brier: n ? s / n : 0 };
}

function argminId(rows: Array<{ id: string; value: number }>): string {
  let best = rows[0]?.id ?? WFO_GRID[0]!.id;
  let bestV = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    if (r.value < bestV) {
      bestV = r.value;
      best = r.id;
    }
  }
  return best;
}

function meanOf(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Combinations of k indices from 0..n-1. */
export function indexCombinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  function rec(start: number, left: number) {
    if (left === 0) {
      out.push(cur.slice());
      return;
    }
    for (let i = start; i <= n - left; i++) {
      cur.push(i);
      rec(i + 1, left - 1);
      cur.pop();
    }
  }
  rec(0, k);
  return out;
}

/**
 * Bailey–Borwein–López de Prado–Zhu CSCV probability of backtest overfitting.
 * series[config][date] = OOS Brier (lower better). PBO = share of symmetric
 * splits where the IS-winner ranks worse than the OOS median.
 */
export function combinatoriallySymmetricPBO(series: Record<string, number[]>): { pbo: number; nCombos: number } | null {
  const ids = Object.keys(series);
  if (ids.length < 2) return null;
  const T = Math.min(...ids.map((id) => series[id]?.length ?? 0));
  if (T < WFO_PBO_MIN_DATES) return null;
  const evenT = T % 2 === 0 ? T : T - 1;
  const groups = evenT > 12 ? 12 : evenT;
  const block = evenT / groups;
  const blockScore: Record<string, number[]> = {};
  for (const id of ids) {
    const src = series[id]!;
    const acc: number[] = [];
    for (let g = 0; g < groups; g++) {
      const lo = Math.floor(g * block);
      const hi = Math.floor((g + 1) * block);
      let s = 0;
      let n = 0;
      for (let i = lo; i < hi; i++) {
        s += src[i]!;
        n += 1;
      }
      acc.push(n ? s / n : 0);
    }
    blockScore[id] = acc;
  }
  const half = groups / 2;
  const combos = indexCombinations(groups, half);
  if (!combos.length) return null;
  let overfit = 0;
  for (const isIdx of combos) {
    const isSet = new Set(isIdx);
    const oosIdx: number[] = [];
    for (let i = 0; i < groups; i++) if (!isSet.has(i)) oosIdx.push(i);
    const isMean = ids.map((id) => ({ id, value: meanOf(isIdx.map((i) => blockScore[id]![i]!)) }));
    const oosMean = ids.map((id) => ({ id, value: meanOf(oosIdx.map((i) => blockScore[id]![i]!)) }));
    const bestIs = argminId(isMean);
    const ordered = [...oosMean].sort((a, b) => a.value - b.value);
    const rank0 = Math.max(0, ordered.findIndex((r) => r.id === bestIs));
    const omega = ids.length <= 1 ? 0 : rank0 / (ids.length - 1);
    if (omega > 0.5) overfit += 1;
  }
  return { pbo: overfit / combos.length, nCombos: combos.length };
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * White (2000) reality check: H0 that no grid cell beats the default on mean
 * daily Brier. Stationary bootstrap-style resample of the max statistic.
 */
export function whiteRealityCheck(
  series: Record<string, number[]>,
  benchmarkId = "default",
  nBoot = 399,
  seed = 17,
): WhiteRealityCheck | null {
  const ids = Object.keys(series);
  const bench = series[benchmarkId];
  if (!bench || ids.length < 2) return null;
  const T = Math.min(bench.length, ...ids.map((id) => series[id]?.length ?? 0));
  if (T < 3) return null;
  const others = ids.filter((id) => id !== benchmarkId);
  const diffs: Record<string, number[]> = {};
  for (const id of others) {
    const row = series[id]!;
    diffs[id] = Array.from({ length: T }, (_, t) => bench[t]! - row[t]!);
  }
  const means = others.map((id) => ({ id, value: meanOf(diffs[id]!) }));
  const best = means.reduce((a, b) => (b.value > a.value ? b : a), means[0]!);
  const stat = best.value;
  const rand = lcg(seed);
  let exceed = 0;
  for (let b = 0; b < nBoot; b++) {
    let maxStar = Number.NEGATIVE_INFINITY;
    for (const id of others) {
      const d = diffs[id]!;
      const mu = meanOf(d);
      let s = 0;
      for (let t = 0; t < T; t++) {
        const j = Math.floor(rand() * T);
        s += d[j]! - mu;
      }
      const m = s / T;
      if (m > maxStar) maxStar = m;
    }
    if (maxStar >= stat - 1e-15) exceed += 1;
  }
  return {
    bestId: best.id,
    stat,
    p: (1 + exceed) / (1 + nBoot),
    nBoot,
    n: T,
  };
}

function decideApply(report: Omit<WfoReport, "apply" | "appliedId" | "appliedReason">): {
  apply: boolean;
  appliedId: string;
  appliedReason: string;
} {
  const def = WFO_GRID[0]!;
  if (!report.folds.length) {
    return { apply: false, appliedId: def.id, appliedReason: "corpus too small to walk the grid — staying on 14d · n₀ 48" };
  }
  const rec = report.recommended;
  if (rec.id === def.id) {
    return {
      apply: false,
      appliedId: def.id,
      appliedReason: "last IS-winner is the default 14d · n₀ 48",
    };
  }
  const recRow = report.grid.find((g) => g.id === rec.id);
  const defRow = report.grid.find((g) => g.id === def.id);
  const recOos = recRow?.meanOos ?? Number.POSITIVE_INFINITY;
  const defOos = defRow?.meanOos ?? Number.POSITIVE_INFINITY;
  if (recOos < defOos - CAL_OOS_DELTA) {
    return {
      apply: true,
      appliedId: rec.id,
      appliedReason: `last IS-winner ${rec.label} beats default OOS by ${((defOos - recOos) * 1000).toFixed(1)}‰ Brier`,
    };
  }
  return {
    apply: false,
    appliedId: def.id,
    appliedReason: `last IS-winner ${rec.label} did not beat 14d · n₀ 48 OOS by ${(CAL_OOS_DELTA * 1000).toFixed(1)}‰ — leaving the paper hyper`,
  };
}

/**
 * Pardo walk-forward optimization of (half-life, n₀). Each fold grid-searches
 * mix-ls on the IS window, freezes the IS-winner, scores the next date.
 * Efficiency = IS Brier / OOS Brier of that path (≳ 0.5–0.6 is robust).
 */
export function walkForwardOptimize(obs: CalibrationObservation[], opts: WfoOpts & { window?: WfoWindow } = {}): WfoReport {
  const window: WfoWindow = opts.window ?? "anchored";
  const rollingDates = opts.rollingDates ?? WFO_ROLLING_DATES;
  const asOf = opts.asOf ?? "9999-12-31";
  const usable = obs.filter((o) => o.date < asOf);
  const dates = [...new Set(usable.map((o) => o.date))].sort();
  const empty = emptyWfo(asOf, window, rollingDates);
  if (dates.length < 2) return empty;

  const folds: WfoFold[] = [];
  let totN = 0;

  for (const date of dates) {
    const before = usable.filter((o) => o.date < date);
    const trainDatesAll = [...new Set(before.map((o) => o.date))].sort();
    const trainDateList =
      window === "anchored" ? trainDatesAll : trainDatesAll.slice(Math.max(0, trainDatesAll.length - rollingDates));
    const trainSet = new Set(trainDateList);
    const train = window === "anchored" ? before : before.filter((o) => trainSet.has(o.date));
    const test = usable.filter((o) => o.date === date);
    if (train.length < CAL_MIN_N || !test.length) continue;

    const configs: WfoFoldConfig[] = [];
    for (const cell of WFO_GRID) {
      const mix = fitMixLsFamilies(train, date, cell);
      const is = brierAgainstMix(train, mix);
      const oos = brierAgainstMix(test, mix);
      configs.push({
        id: cell.id,
        label: cell.label,
        halfLife: cell.halfLife,
        n0: cell.n0,
        isBrier: is.brier,
        oosBrier: oos.brier,
        efficiency: wfoEfficiency(is.brier, oos.brier),
      });
    }
    const isWinner = argminId(configs.map((c) => ({ id: c.id, value: c.isBrier })));
    const oosBest = argminId(configs.map((c) => ({ id: c.id, value: c.oosBrier })));
    const winner = configs.find((c) => c.id === isWinner)!;
    totN += test.length;
    folds.push({
      date,
      window,
      trainN: train.length,
      trainDates: trainDateList.length,
      trainFrom: trainDateList[0] ?? null,
      trainTo: trainDateList[trainDateList.length - 1] ?? null,
      n: test.length,
      isWinner,
      oosBest,
      isOosAgree: isWinner === oosBest,
      isBrier: winner.isBrier,
      oosBrier: winner.oosBrier,
      efficiency: winner.efficiency,
      configs,
    });
  }

  if (!folds.length) return empty;

  const grid: WfoGridSummary[] = WFO_GRID.map((g) => {
    const isList = folds.map((f) => f.configs.find((c) => c.id === g.id)!.isBrier);
    const oosList = folds.map((f) => f.configs.find((c) => c.id === g.id)!.oosBrier);
    const effList = folds
      .map((f) => f.configs.find((c) => c.id === g.id)!.efficiency)
      .filter((x): x is number => x != null && Number.isFinite(x));
    return {
      id: g.id,
      label: g.label,
      halfLife: g.halfLife,
      n0: g.n0,
      isWins: folds.filter((f) => f.isWinner === g.id).length,
      oosWins: folds.filter((f) => f.oosBest === g.id).length,
      meanIs: meanOf(isList),
      meanOos: meanOf(oosList),
      meanEfficiency: effList.length ? meanOf(effList) : null,
      nFolds: folds.length,
    };
  });

  const last = folds[folds.length - 1]!;
  const recommended = wfoGridCell(last.isWinner);
  const oosChampion = wfoGridCell(argminId(grid.map((g) => ({ id: g.id, value: g.meanOos }))));
  const pathIs = meanOf(folds.map((f) => f.isBrier));
  const pathOos = meanOf(folds.map((f) => f.oosBrier));
  const series: Record<string, number[]> = {};
  for (const g of WFO_GRID) series[g.id] = folds.map((f) => f.configs.find((c) => c.id === g.id)!.oosBrier);
  const pbo = combinatoriallySymmetricPBO(series);
  const white = whiteRealityCheck(series, "default");
  const partial: Omit<WfoReport, "apply" | "appliedId" | "appliedReason"> = {
    asOf,
    window,
    rollingDates,
    n: totN,
    nDates: folds.length,
    folds,
    grid,
    recommended,
    oosChampion,
    efficiency: wfoEfficiency(pathIs, pathOos),
    lastAgree: last.isOosAgree,
    pbo: pbo?.pbo ?? null,
    pboN: pbo?.nCombos ?? 0,
    white,
  };
  const decision = decideApply(partial);
  return { ...partial, ...decision };
}

export function walkForwardOptimizePair(obs: CalibrationObservation[], opts: WfoOpts = {}): WfoPair {
  return {
    anchored: walkForwardOptimize(obs, { ...opts, window: "anchored" }),
    rolling: walkForwardOptimize(obs, { ...opts, window: "rolling" }),
  };
}


