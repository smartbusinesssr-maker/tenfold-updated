/**
 * Two-stage quality selector.
 * Stage 1: AbsoluteQualityScore from form, H2H, sample maturity, reliability, value, league tier.
 * Stage 2: pool-relative percentile vs the rest of today's family pool.
 * Quality > quota — fewer than 10 (or 5) is acceptable.
 */

import type { MarketKind, ScoredPick } from "./types.ts";

export interface QualityInputs {
  formString?: string;
  h2hFavorable?: number;
  h2hTotal?: number;
  minGamesPlayed?: number;
  reliabilityScore?: number;
  leagueRating?: number;
}

export interface QualityCandidate {
  id: string;
  confidence: number;
  expectedValue: number;
  odds: { home?: number; draw?: number; away?: number };
  predictionType: "home_win" | "away_win" | "draw";
  inputs: QualityInputs;
}

export interface QualityScored {
  id: string;
  absolute: number;
  relative: number;
  combined: number;
  kept: boolean;
  reason: string;
  parts?: Record<string, number>;
}

export interface SelectionResult {
  keep: string[];
  drop: string[];
  scored: QualityScored[];
  malformed: Array<{ id: string; issues: string[] }>;
}

export interface SelectorConfig {
  maxKeep?: number;
  absoluteFloor?: number;
  relativeFloor?: number;
  smallPoolSize?: number;
  smallPoolFloor?: number;
}

export interface QualityGate {
  absolute: number;
  relative: number;
  combined: number;
  reason: string;
  parts?: Record<string, number>;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function scoreForm(formString?: string): number {
  if (!formString || formString.length < 3) return 30;
  const f = formString.toUpperCase().replace(/[^WDL]/g, "").slice(0, 5);
  if (f.length < 3) return 30;
  const weights = [3, 2.5, 2, 1.5, 1];
  let earned = 0;
  let max = 0;
  for (let i = 0; i < f.length; i++) {
    const w = weights[i] ?? 1;
    max += w * 3;
    const ch = f[i];
    if (ch === "W") earned += w * 3;
    else if (ch === "D") earned += w * 1;
  }
  return max > 0 ? clamp((earned / max) * 100) : 30;
}

export function scoreH2H(favorable?: number, total?: number, predictionType?: string): number {
  if (!total || total < 2) return 35;
  const fav = favorable ?? 0;
  const dominance = fav / total;
  const sampleMult = total >= 6 ? 1.0 : total >= 4 ? 0.8 : 0.6;
  let raw: number;
  if (predictionType === "draw") {
    raw = dominance >= 0.5 ? 95 : dominance >= 0.35 ? 75 : dominance >= 0.25 ? 55 : 30;
  } else {
    raw = dominance >= 0.7 ? 95 : dominance >= 0.55 ? 80 : dominance >= 0.4 ? 60 : 35;
  }
  return clamp(raw * sampleMult);
}

export function scoreSampleMaturity(minGames?: number): number {
  if (minGames == null) return 60;
  const n = minGames;
  if (n <= 0) return 0;
  if (n < 4) return 20;
  if (n < 7) return 45;
  if (n < 10) return 65;
  if (n < 15) return 80;
  return 95;
}

function scoreValue(confidence: number, ev: number, odds: number): number {
  const kelly = odds > 1 ? Math.max(0, ((confidence / 100) * odds - 1) / (odds - 1)) : 0;
  const kellyPct = clamp(kelly * 100, 0, 25) * 4;
  const evNorm = clamp(ev * 4, 0, 100);
  const confNorm = clamp(confidence);
  return clamp(confNorm * 0.4 + evNorm * 0.35 + kellyPct * 0.25);
}

function scoreLeagueTier(rating?: number): number {
  if (rating === undefined || rating === null) return 60;
  return clamp(rating * 100);
}

function bestOdds(odds: QualityCandidate["odds"]): number {
  return Math.max(odds.home || 1, odds.draw || 1, odds.away || 1);
}

export function computeAbsoluteQuality(c: QualityCandidate): {
  absolute: number;
  parts: Record<string, number>;
} {
  const formScore = scoreForm(c.inputs.formString);
  const h2hScore = scoreH2H(c.inputs.h2hFavorable, c.inputs.h2hTotal, c.predictionType);
  const sampleScore = scoreSampleMaturity(c.inputs.minGamesPlayed);
  const relScore = clamp(c.inputs.reliabilityScore ?? 50);
  const valScore = scoreValue(c.confidence, c.expectedValue, bestOdds(c.odds));
  const leagueScore = scoreLeagueTier(c.inputs.leagueRating);

  const absolute =
    formScore * 0.25 +
    h2hScore * 0.15 +
    sampleScore * 0.15 +
    relScore * 0.2 +
    valScore * 0.2 +
    leagueScore * 0.05;

  return {
    absolute: clamp(absolute),
    parts: { formScore, h2hScore, sampleScore, relScore, valScore, leagueScore },
  };
}

function meanStd(xs: number[]): { mean: number; std: number } {
  if (xs.length === 0) return { mean: 0, std: 1 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const std = Math.sqrt(variance) || 1;
  return { mean, std };
}

function normCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export function validateCandidate(raw: unknown): {
  ok: boolean;
  normalised: QualityCandidate | null;
  issues: string[];
} {
  const issues: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, normalised: null, issues: ["not_an_object"] };
  }
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== "string" || rec.id.length === 0) {
    return { ok: false, normalised: null, issues: ["missing_id"] };
  }
  const allowed: QualityCandidate["predictionType"][] = ["home_win", "away_win", "draw"];
  let predictionType = rec.predictionType as QualityCandidate["predictionType"];
  if (!allowed.includes(predictionType)) {
    issues.push(`bad_prediction_type:${predictionType ?? "null"}`);
    predictionType = "draw";
  }
  const confidence =
    typeof rec.confidence === "number" && Number.isFinite(rec.confidence)
      ? clamp(rec.confidence, 0, 100)
      : (issues.push("missing_confidence"), 0);
  const expectedValue =
    typeof rec.expectedValue === "number" && Number.isFinite(rec.expectedValue)
      ? rec.expectedValue
      : (issues.push("missing_expected_value"), 0);
  const odds =
    rec.odds && typeof rec.odds === "object" ? (rec.odds as QualityCandidate["odds"]) : (issues.push("missing_odds"), {});
  const inputs =
    rec.inputs && typeof rec.inputs === "object"
      ? (rec.inputs as QualityInputs)
      : (issues.push("missing_inputs"), {});
  return {
    ok: issues.length === 0,
    normalised: { id: rec.id, confidence, expectedValue, odds, predictionType, inputs },
    issues,
  };
}

export function selectTopQualityPicks(
  rawCandidates: Array<QualityCandidate | unknown>,
  config: SelectorConfig = {},
): SelectionResult {
  const maxKeep = config.maxKeep ?? 5;
  const absoluteFloor = config.absoluteFloor ?? 55;
  const relativeFloor = config.relativeFloor ?? 70;
  const smallPoolSize = config.smallPoolSize ?? 5;
  const smallPoolFloor = config.smallPoolFloor ?? 65;

  const malformed: Array<{ id: string; issues: string[] }> = [];
  const candidates: QualityCandidate[] = [];
  for (const raw of rawCandidates || []) {
    const v = validateCandidate(raw);
    if (v.normalised) {
      candidates.push(v.normalised);
      if (v.issues.length > 0) malformed.push({ id: v.normalised.id, issues: v.issues });
    } else {
      malformed.push({ id: (raw as { id?: string })?.id ?? "unknown", issues: v.issues });
    }
  }

  const stage1 = candidates.map((c) => {
    const { absolute, parts } = computeAbsoluteQuality(c);
    return { c, absolute, parts };
  });

  const passS1 = stage1.filter((s) => s.absolute >= absoluteFloor);
  const failS1 = stage1.filter((s) => s.absolute < absoluteFloor);

  if (passS1.length > 0 && passS1.length < smallPoolSize) {
    const strict = passS1.filter((s) => s.absolute >= smallPoolFloor);
    strict.sort((a, b) => b.absolute - a.absolute);
    const kept = strict.slice(0, maxKeep);
    const keptIds = new Set(kept.map((k) => k.c.id));
    const scored = stage1.map((s) => ({
      id: s.c.id,
      absolute: s.absolute,
      relative: 0,
      combined: s.absolute,
      kept: keptIds.has(s.c.id),
      reason: keptIds.has(s.c.id)
        ? "kept_small_pool"
        : s.absolute < absoluteFloor
          ? `stage1_floor_${absoluteFloor}`
          : `stage1_strict_floor_${smallPoolFloor}`,
      parts: s.parts,
    }));
    return {
      keep: kept.map((k) => k.c.id),
      drop: candidates.filter((c) => !keptIds.has(c.id)).map((c) => c.id),
      scored,
      malformed,
    };
  }

  const absVals = passS1.map((s) => s.absolute);
  const evVals = passS1.map((s) => s.c.expectedValue);
  const confVals = passS1.map((s) => s.c.confidence);
  const A = meanStd(absVals);
  const E = meanStd(evVals);
  const C = meanStd(confVals);

  const ranked = passS1.map((s) => {
    const zAbs = (s.absolute - A.mean) / A.std;
    const zEv = (s.c.expectedValue - E.mean) / E.std;
    const zConf = (s.c.confidence - C.mean) / C.std;
    const blended = 0.5 * zAbs + 0.3 * zEv + 0.2 * zConf;
    const relative = clamp(normCdf(blended) * 100);
    const combined = 0.6 * s.absolute + 0.4 * relative;
    return { ...s, relative, combined };
  });

  const passBothRaw = ranked.filter((r) => r.relative >= relativeFloor);
  // Homogeneous pool: z≈0 so nobody clears the 70th percentile. Fall back to Stage 1 order.
  const passBoth = passBothRaw.length > 0 ? passBothRaw : [...ranked];
  passBoth.sort((a, b) => b.combined - a.combined);
  const kept = passBoth.slice(0, maxKeep);
  const keptIds = new Set(kept.map((k) => k.c.id));

  const scored: QualityScored[] = [
    ...ranked.map((r) => ({
      id: r.c.id,
      absolute: r.absolute,
      relative: r.relative,
      combined: r.combined,
      kept: keptIds.has(r.c.id),
      reason: keptIds.has(r.c.id)
        ? passBothRaw.length === 0
          ? "kept_homogeneous"
          : "kept"
        : r.relative < relativeFloor
          ? `stage2_floor_${relativeFloor}`
          : "beyond_top",
      parts: r.parts,
    })),
    ...failS1.map((s) => ({
      id: s.c.id,
      absolute: s.absolute,
      relative: 0,
      combined: s.absolute,
      kept: false,
      reason: `stage1_floor_${absoluteFloor}`,
      parts: s.parts,
    })),
  ];

  return {
    keep: kept.map((k) => k.c.id),
    drop: candidates.filter((c) => !keptIds.has(c.id)).map((c) => c.id),
    scored,
    malformed,
  };
}

export function avgForm(a: string, b: string): string {
  const len = Math.max(a.length, b.length);
  const out: string[] = [];
  const rank = (ch?: string) => (ch === "W" ? 3 : ch === "D" ? 2 : ch === "L" ? 1 : 0);
  for (let i = 0; i < len; i++) {
    const ca = a[i];
    const cb = b[i];
    if (!ca && !cb) break;
    out.push(rank(ca) <= rank(cb) ? ca || cb || "D" : cb || ca || "D");
  }
  return out.join("");
}

const HOME_KINDS = new Set<MarketKind>(["home", "dc_1x", "home_score"]);
const AWAY_KINDS = new Set<MarketKind>(["away", "dc_x2", "away_score"]);
const ONE_X_TWO = new Set<MarketKind>(["home", "away", "draw", "dc_1x", "dc_x2", "dc_12"]);

export function predictionTypeOf(p: Pick<ScoredPick, "kind" | "selection" | "home" | "away">): QualityCandidate["predictionType"] {
  if (HOME_KINDS.has(p.kind)) return "home_win";
  if (AWAY_KINDS.has(p.kind)) return "away_win";
  if (p.kind === "ah" || p.kind === "eh") {
    const s = (p.selection ?? "").toLowerCase();
    const home = (p.home ?? "").toLowerCase();
    const away = (p.away ?? "").toLowerCase();
    if (s.startsWith("home") || (home && s.includes(home))) return "home_win";
    if (s.startsWith("away") || (away && s.includes(away))) return "away_win";
  }
  return "draw";
}

export function qualityInputsFromPick(p: ScoredPick): QualityInputs {
  const facts = p.facts;
  const type = predictionTypeOf(p);
  const homeForm = (facts?.homeForm ?? "").replace(/[^WDL]/gi, "").toUpperCase();
  const awayForm = (facts?.awayForm ?? "").replace(/[^WDL]/gi, "").toUpperCase();
  let formString = "";
  if (type === "home_win") formString = homeForm;
  else if (type === "away_win") formString = awayForm;
  else formString = avgForm(homeForm, awayForm);

  let h2hFavorable: number | undefined;
  let h2hTotal: number | undefined;
  if (facts && ONE_X_TWO.has(p.kind) && facts.h2hN > 0) {
    h2hTotal = facts.h2hN;
    if (type === "draw") h2hFavorable = facts.h2hDraws;
    else if (type === "home_win") h2hFavorable = facts.h2hWins;
    else h2hFavorable = facts.h2hLosses;
  }

  const homePlayed = facts?.homePlayed;
  const awayPlayed = facts?.awayPlayed;
  let minGamesPlayed: number | undefined;
  // 0 means "not populated", not a placeholder standing — only trust a positive sample.
  if (typeof homePlayed === "number" && homePlayed > 0 && typeof awayPlayed === "number" && awayPlayed > 0) {
    minGamesPlayed = Math.min(homePlayed, awayPlayed);
  }

  return {
    formString: formString || undefined,
    h2hFavorable,
    h2hTotal,
    minGamesPlayed,
    reliabilityScore: facts?.quality != null ? facts.quality * 100 : undefined,
    leagueRating: p.leagueWeight,
  };
}

export function toQualityCandidate(p: ScoredPick): QualityCandidate {
  const type = predictionTypeOf(p);
  const implied = p.implied || (p.odd > 1 ? 1 / p.odd : 0.5);
  const edgePct = (p.edge ?? p.accuracy - implied) * 100;
  return {
    id: p.id,
    confidence: clamp(p.accuracy * 100, 0, 100),
    expectedValue: edgePct,
    odds: type === "home_win" ? { home: p.odd } : type === "away_win" ? { away: p.odd } : { draw: p.odd },
    predictionType: type,
    inputs: qualityInputsFromPick(p),
  };
}

const DAILY_CONFIG: SelectorConfig = {
  maxKeep: 999,
  absoluteFloor: 55,
  relativeFloor: 70,
  smallPoolSize: 5,
  smallPoolFloor: 55,
};

const BEST_CONFIG: SelectorConfig = {
  maxKeep: 3,
  absoluteFloor: 60,
  relativeFloor: 70,
  smallPoolSize: 5,
  smallPoolFloor: 65,
};

function attachScores(picks: ScoredPick[], scored: QualityScored[]): ScoredPick[] {
  const byId = new Map(scored.map((s) => [s.id, s]));
  return picks.map((p) => {
    const s = byId.get(p.id);
    if (!s) return p;
    return {
      ...p,
      qualityGate: {
        absolute: s.absolute,
        relative: s.relative,
        combined: s.combined,
        reason: s.reason,
        parts: s.parts,
      },
    };
  });
}

/** Per-family Stage 1 + Stage 2. Picks without facts skip the gate (test stubs / incomplete rows). */
export function gateDailyTen(candidates: ScoredPick[]): { keep: ScoredPick[]; dropIds: Set<string> } {
  const withFacts: ScoredPick[] = [];
  const without: ScoredPick[] = [];
  for (const c of candidates) {
    if (c.facts) withFacts.push(c);
    else without.push(c);
  }

  const keepIds = new Set<string>(without.map((c) => c.id));
  const dropIds = new Set<string>();
  const scoredAll: QualityScored[] = [];

  const byFamily = new Map<string, ScoredPick[]>();
  for (const c of withFacts) {
    if (c.facts?.grade === "LOW_DATA" || c.facts?.grade === "UNUSABLE") {
      dropIds.add(c.id);
      continue;
    }
    if (c.facts && (c.facts.quality ?? 0) < 0.6 && c.facts.grade !== "FULL_DATA") {
      dropIds.add(c.id);
      continue;
    }
    const arr = byFamily.get(c.family) ?? [];
    arr.push(c);
    byFamily.set(c.family, arr);
  }

  for (const group of byFamily.values()) {
    const result = selectTopQualityPicks(group.map(toQualityCandidate), DAILY_CONFIG);
    for (const id of result.keep) keepIds.add(id);
    for (const id of result.drop) dropIds.add(id);
    scoredAll.push(...result.scored);
  }

  const annotated = attachScores(candidates, scoredAll);
  return { keep: annotated.filter((c) => keepIds.has(c.id)), dropIds };
}

export function gateBestBets(picks: ScoredPick[]): ScoredPick[] {
  if (picks.length === 0) return [];
  const result = selectTopQualityPicks(picks.map(toQualityCandidate), BEST_CONFIG);
  const keepIds = new Set(result.keep);
  return attachScores(picks, result.scored).filter((p) => keepIds.has(p.id));
}
