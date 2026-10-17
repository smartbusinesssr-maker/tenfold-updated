// ═══════════════════════════════════════════════════════════════
// TWO-STAGE QUALITY SELECTOR
// Shared across V7.1, Auto-Generate, and Unified prediction engines.
//
// Goal: replace dumb "score-then-slice(0,5)" pruning with an
// intelligent ranking that:
//   1. Computes an AbsoluteQualityScore per pick from real stats
//      (form, H2H, sample maturity, reliability, value, league tier)
//   2. Computes a pool-relative percentile rank vs the rest of
//      today's candidate pool (so a 70-confidence pick in a strong
//      pool can lose to a 65-confidence pick in a weak one)
//   3. Saves up to 5 picks — but ONLY those that clear BOTH bars.
//      Saving fewer than 5 is acceptable. Quality > quota.
// ═══════════════════════════════════════════════════════════════

export interface QualityInputs {
  // Form: per-pick side recent results, most recent first.
  // For prediction.type === 'home_win' use home form; for 'away_win'
  // use away form; for 'draw' use the AVERAGE of both sides' form.
  formString?: string;            // e.g. "WWDLW"

  // H2H: counts in favour of the picked outcome out of total H2H.
  h2hFavorable?: number;
  h2hTotal?: number;

  // Sample maturity: min(homeGamesPlayed, awayGamesPlayed).
  // 0 if either side uses placeholder standings.
  minGamesPlayed?: number;

  // Reliability score from _shared/reliabilityGate.ts (0–100).
  reliabilityScore?: number;

  // League quality tier rating (0.0 – 1.0) from leagueQualityRatings.
  leagueRating?: number;
}

export interface QualityCandidate {
  id: string;                     // saved_matches.id
  confidence: number;             // 0–100
  expectedValue: number;          // EV%
  odds: { home?: number; draw?: number; away?: number };
  predictionType: 'home_win' | 'away_win' | 'draw';
  inputs: QualityInputs;
}

export interface SelectionResult {
  keep: string[];                 // saved_matches.ids to keep
  drop: string[];                 // saved_matches.ids to delete
  scored: Array<{
    id: string;
    absolute: number;
    relative: number;
    combined: number;
    kept: boolean;
    reason: string;
  }>;
  malformed?: Array<{ id: string; issues: string[] }>;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ─── Stage 1 component scorers ───────────────────────────────────

function scoreForm(formString?: string): number {
  if (!formString || formString.length < 3) return 30;
  const f = formString.toUpperCase().slice(0, 5);
  // Recency-weighted: most recent first → weight 3, 2.5, 2, 1.5, 1
  const weights = [3, 2.5, 2, 1.5, 1];
  let earned = 0;
  let max = 0;
  for (let i = 0; i < f.length; i++) {
    const w = weights[i] ?? 1;
    max += w * 3; // W = 3 points
    const ch = f[i];
    if (ch === 'W') earned += w * 3;
    else if (ch === 'D') earned += w * 1;
    // L = 0
  }
  return max > 0 ? clamp((earned / max) * 100) : 30;
}

function scoreH2H(favorable?: number, total?: number, predictionType?: string): number {
  if (!total || total < 2) return 35;            // not enough data
  const fav = favorable ?? 0;
  const dominance = fav / total;
  // Sample-size confidence multiplier
  const sampleMult = total >= 6 ? 1.0 : total >= 4 ? 0.8 : 0.6;
  let raw: number;
  if (predictionType === 'draw') {
    // For draws, "favorable" should be draw count; reward high draw rate
    raw = dominance >= 0.5 ? 95 : dominance >= 0.35 ? 75 : dominance >= 0.25 ? 55 : 30;
  } else {
    raw = dominance >= 0.7 ? 95 : dominance >= 0.55 ? 80 : dominance >= 0.4 ? 60 : 35;
  }
  return clamp(raw * sampleMult);
}

function scoreSampleMaturity(minGames?: number): number {
  const n = minGames ?? 0;
  if (n <= 0) return 0;          // placeholder / no data
  if (n < 4) return 20;
  if (n < 7) return 45;
  if (n < 10) return 65;
  if (n < 15) return 80;
  return 95;
}

function scoreValue(confidence: number, ev: number, odds: number): number {
  // Kelly fraction (clamped 0–1)
  const kelly = odds > 1 ? Math.max(0, ((confidence / 100) * odds - 1) / (odds - 1)) : 0;
  const kellyPct = clamp(kelly * 100, 0, 25) * 4; // map 0..25% kelly → 0..100
  const evNorm = clamp(ev * 4, 0, 100);           // 25% EV → 100
  const confNorm = clamp(confidence);
  return clamp(confNorm * 0.4 + evNorm * 0.35 + kellyPct * 0.25);
}

function scoreLeagueTier(rating?: number): number {
  if (rating === undefined || rating === null) return 60;
  return clamp(rating * 100);
}

function bestOdds(odds: QualityCandidate['odds']): number {
  return Math.max(odds.home || 1, odds.draw || 1, odds.away || 1);
}

// ─── Stage 1: AbsoluteQualityScore ───────────────────────────────

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
    relScore * 0.20 +
    valScore * 0.20 +
    leagueScore * 0.05;

  return {
    absolute: clamp(absolute),
    parts: { formScore, h2hScore, sampleScore, relScore, valScore, leagueScore },
  };
}

// ─── Stage 2: pool-relative ranking ──────────────────────────────

function meanStd(xs: number[]): { mean: number; std: number } {
  if (xs.length === 0) return { mean: 0, std: 1 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const std = Math.sqrt(variance) || 1;
  return { mean, std };
}

// Approx normal CDF for percentile mapping
function normCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// ─── Main entry point ────────────────────────────────────────────

export interface SelectorConfig {
  maxKeep?: number;               // hard cap (default 5)
  absoluteFloor?: number;         // Stage 1 cutoff (default 55)
  relativeFloor?: number;         // Stage 2 cutoff (default 70)
  smallPoolSize?: number;         // below this, skip Stage 2 (default 5)
  smallPoolFloor?: number;        // stricter Stage 1 floor when small pool (default 65)
}

// Validate & normalise a candidate so a missing predictionType / inputs / odds
// can never crash the selector. Returns { ok, normalised, issues } so callers
// can log malformed rows for the admin audit feed.
export function validateCandidate(raw: any): {
  ok: boolean;
  normalised: QualityCandidate | null;
  issues: string[];
} {
  const issues: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, normalised: null, issues: ['not_an_object'] };
  }
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    return { ok: false, normalised: null, issues: ['missing_id'] };
  }
  const allowed: QualityCandidate['predictionType'][] = ['home_win', 'away_win', 'draw'];
  let predictionType = raw.predictionType;
  if (!allowed.includes(predictionType)) {
    issues.push(`bad_prediction_type:${predictionType ?? 'null'}`);
    predictionType = 'draw'; // safest fallback (lowest weighted value)
  }
  const confidence = typeof raw.confidence === 'number' && isFinite(raw.confidence)
    ? clamp(raw.confidence, 0, 100) : (issues.push('missing_confidence'), 0);
  const expectedValue = typeof raw.expectedValue === 'number' && isFinite(raw.expectedValue)
    ? raw.expectedValue : (issues.push('missing_expected_value'), 0);
  const odds = (raw.odds && typeof raw.odds === 'object') ? raw.odds : (issues.push('missing_odds'), {});
  const inputs = (raw.inputs && typeof raw.inputs === 'object') ? raw.inputs : (issues.push('missing_inputs'), {});
  return {
    ok: issues.length === 0,
    normalised: { id: raw.id, confidence, expectedValue, odds, predictionType, inputs },
    issues,
  };
}

export function selectTopQualityPicks(
  rawCandidates: Array<QualityCandidate | any>,
  config: SelectorConfig = {}
): SelectionResult & { malformed: Array<{ id: string; issues: string[] }> } {
  const maxKeep = config.maxKeep ?? 5;
  const absoluteFloor = config.absoluteFloor ?? 55;
  const relativeFloor = config.relativeFloor ?? 70;
  const smallPoolSize = config.smallPoolSize ?? 5;
  const smallPoolFloor = config.smallPoolFloor ?? 65;

  // Normalise + collect malformed rows for the audit
  const malformed: Array<{ id: string; issues: string[] }> = [];
  const candidates: QualityCandidate[] = [];
  for (const raw of rawCandidates || []) {
    const v = validateCandidate(raw);
    if (v.normalised) {
      candidates.push(v.normalised);
      if (v.issues.length > 0) malformed.push({ id: v.normalised.id, issues: v.issues });
    } else {
      malformed.push({ id: raw?.id ?? 'unknown', issues: v.issues });
    }
  }
  if (malformed.length > 0) {
    console.warn(`[QualitySelector] ${malformed.length} malformed candidates`, malformed.slice(0, 5));
  }

  // Stage 1
  const stage1 = candidates.map((c) => {
    const { absolute, parts } = computeAbsoluteQuality(c);
    return { c, absolute, parts };
  });

  const passS1 = stage1.filter((s) => s.absolute >= absoluteFloor);
  const failS1 = stage1.filter((s) => s.absolute < absoluteFloor);

  // Small pool: skip Stage 2, apply stricter floor
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
        ? 'kept_small_pool'
        : s.absolute < absoluteFloor
        ? `stage1_floor_${absoluteFloor}`
        : `stage1_strict_floor_${smallPoolFloor}`,
    }));
    return {
      keep: kept.map((k) => k.c.id),
      drop: candidates.filter((c) => !keptIds.has(c.id)).map((c) => c.id),
      scored,
      malformed,
    };
  }

  // Stage 2: pool-relative percentile
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

  const passBoth = ranked.filter((r) => r.relative >= relativeFloor);
  passBoth.sort((a, b) => b.combined - a.combined);
  const kept = passBoth.slice(0, maxKeep);
  const keptIds = new Set(kept.map((k) => k.c.id));

  const scored = [
    ...ranked.map((r) => ({
      id: r.c.id,
      absolute: r.absolute,
      relative: r.relative,
      combined: r.combined,
      kept: keptIds.has(r.c.id),
      reason: keptIds.has(r.c.id)
        ? 'kept'
        : r.relative < relativeFloor
        ? `stage2_floor_${relativeFloor}`
        : 'beyond_top5',
    })),
    ...failS1.map((s) => ({
      id: s.c.id,
      absolute: s.absolute,
      relative: 0,
      combined: s.absolute,
      kept: false,
      reason: `stage1_floor_${absoluteFloor}`,
    })),
  ];

  return {
    keep: kept.map((k) => k.c.id),
    drop: candidates.filter((c) => !keptIds.has(c.id)).map((c) => c.id),
    scored,
    malformed,
  };
}
