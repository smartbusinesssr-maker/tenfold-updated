import type { FinishedSample, StandingRow } from "./types.ts";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function poissonOver15(lh: number, la: number): number {
  const t = Math.max(0, lh + la);
  const p0 = Math.exp(-t);
  return clamp(1 - p0 - p0 * t, 0, 1);
}

/** Crowder / Rue process noise per match on the log-attack walk. */
const KALMAN_Q = 0.012;
/** Log-scale observation noise. Poisson gf≈1.3 → Var(log(gf+½)) ≈ 0.5. */
const KALMAN_R = 0.55;
const KALMAN_P0 = 0.2;

/** Dixon–Coles ξ = 0.0065 per half-week. Half-life ≈ 373 days — almost SMA(20). */
const DC_RATE_HALFLIFE_DAYS = Math.LN2 / (0.0065 / 3.5);

export interface LatentSide {
  /** Log-goal attack vs league mean. */
  attack: number;
  /** Log-goal defence; higher = suppresses opponent scoring. */
  defense: number;
  attackVar: number;
  defenseVar: number;
  ewma3: number | null;
  ewma5: number | null;
  ewma10: number | null;
  ewma20: number | null;
  seasonGf: number | null;
  /** EWMA5 − season, shrunk. Goal-form, not W-D-L. */
  momentum: number;
  /** 0–1 finishing-extreme flag. Pulls certainty, does not auto-force mean. */
  regress: number;
}

export function emptyLatent(): LatentSide {
  return {
    attack: 0,
    defense: 0,
    attackVar: KALMAN_P0,
    defenseVar: KALMAN_P0,
    ewma3: null,
    ewma5: null,
    ewma10: null,
    ewma20: null,
    seasonGf: null,
    momentum: 0,
    regress: 0,
  };
}

/** Home share of the two λs. */
export function goalShare(lambdaH: number, lambdaA: number): { home: number; away: number } {
  const t = Math.max(1e-9, lambdaH + lambdaA);
  return { home: lambdaH / t, away: lambdaA / t };
}

export function evidenceBalance(
  items: Array<{ text: string; sign: 1 | -1; weight: number }>,
): { lines: string[]; net: number } {
  let net = 0;
  const lines: string[] = [];
  for (const it of items) {
    net += it.sign * it.weight;
    lines.push(it.text);
  }
  return { lines, net };
}

/** Continuous recency. Newest-first samples. Half-life in days. */
export function ewmaRate(
  samples: FinishedSample[],
  halfLifeDays: number,
  field: "gf" | "ga",
  asOfUnix: number,
): number | null {
  if (!samples.length || halfLifeDays <= 0) return null;
  let num = 0;
  let den = 0;
  const ln2 = Math.LN2;
  for (const s of samples) {
    const days = s.timestamp ? Math.max(0, (asOfUnix - s.timestamp) / 86400) : 14;
    const w = Math.exp((-ln2 * days) / halfLifeDays);
    num += w * s[field];
    den += w;
  }
  return den > 0 ? num / den : null;
}

/**
 * Spec §216. Blend EWMA 3/5/10/20. Weights sum to 1; missing scales drop and the
 * rest renormalise. Not a last-5 cliff.
 */
export function blendTimescales(
  samples: FinishedSample[],
  field: "gf" | "ga",
  asOfUnix: number,
): number | null {
  if (!samples.length) return null;
  const parts: Array<[number, number | null]> = [
    [0.12, ewmaRate(samples, 3, field, asOfUnix)],
    [0.28, ewmaRate(samples, 5, field, asOfUnix)],
    [0.32, ewmaRate(samples, 10, field, asOfUnix)],
    [0.28, ewmaRate(samples, 20, field, asOfUnix)],
  ];
  let num = 0;
  let den = 0;
  for (const [w, v] of parts) {
    if (v == null) continue;
    num += w * v;
    den += w;
  }
  return den > 0 ? num / den : null;
}

/** Unweighted mean of the newest k matches. Last-5 GF on a results page is SMA(5). */
export function smaRate(samples: FinishedSample[], k: number, field: "gf" | "ga"): number | null {
  if (!samples.length || k < 1) return null;
  const take = samples.slice(0, Math.min(k, samples.length));
  let s = 0;
  for (const row of take) s += row[field];
  return s / take.length;
}

/**
 * Classic match-count EMA, α = 2/(span+1). Walks oldest → newest across the
 * whole book. Span is games, not days — not the same as ewmaRate.
 */
export function emaSpanRate(samples: FinishedSample[], span: number, field: "gf" | "ga"): number | null {
  if (!samples.length || span < 1) return null;
  const alpha = 2 / (span + 1);
  const rows = [...samples].reverse();
  let s = rows[0]![field];
  for (let i = 1; i < rows.length; i++) {
    s = alpha * rows[i]![field] + (1 - alpha) * s;
  }
  return s;
}

/** Last-20 sample mean: Dixon–Coles ξ on the full book. */
export function dcWeightedRate(
  samples: FinishedSample[],
  field: "gf" | "ga",
  asOfUnix: number,
): number | null {
  return ewmaRate(samples, DC_RATE_HALFLIFE_DAYS, field, asOfUnix);
}

export function samplesFromGoals(
  gf: number[],
  opts?: { asOfUnix?: number; gapDays?: number; ga?: number },
): FinishedSample[] {
  const asOf = opts?.asOfUnix ?? 1_800_000_000;
  const gap = Math.max(1, opts?.gapDays ?? 7);
  const ga = opts?.ga ?? 1;
  return gf.map((g, i) => ({
    timestamp: asOf - i * gap * 86400,
    opponentId: 1,
    gf: g,
    ga,
    home: true,
  }));
}

export interface MovingAverageSet {
  n: number;
  sma5: number | null;
  sma20: number | null;
  smaK: number | null;
  emaK: number | null;
  ewma5: number | null;
  ewma20: number | null;
  dc: number | null;
}

export function movingAverages(
  samples: FinishedSample[],
  k: number,
  field: "gf" | "ga" = "gf",
  asOfUnix?: number,
): MovingAverageSet {
  const asOf = asOfUnix ?? Date.now() / 1000;
  const span = Math.max(1, Math.round(k));
  return {
    n: samples.length,
    sma5: smaRate(samples, 5, field),
    sma20: smaRate(samples, 20, field),
    smaK: smaRate(samples, span, field),
    emaK: emaSpanRate(samples, span, field),
    ewma5: ewmaRate(samples, 5, field, asOf),
    ewma20: ewmaRate(samples, 20, field, asOf),
    dc: dcWeightedRate(samples, field, asOf),
  };
}

export interface MaPathPoint {
  i: number;
  obs: number;
  sma: number;
  ema: number;
}

/** Oldest → newest path for the lab chart. */
export function movingAveragePath(
  samples: FinishedSample[],
  k: number,
  field: "gf" | "ga" = "gf",
): MaPathPoint[] {
  if (!samples.length) return [];
  const span = Math.max(1, Math.round(k));
  const alpha = 2 / (span + 1);
  const rows = [...samples].reverse();
  let ema = rows[0]![field];
  const out: MaPathPoint[] = [];
  for (let i = 0; i < rows.length; i++) {
    const obs = rows[i]![field];
    if (i > 0) ema = alpha * obs + (1 - alpha) * ema;
    const window = rows.slice(Math.max(0, i + 1 - span), i + 1);
    let s = 0;
    for (const row of window) s += row[field];
    out.push({ i: i + 1, obs, sma: s / window.length, ema });
  }
  return out;
}

/**
 * Spec §221. Maher log-linear:
 *   log λ_home = log μ_home + attack_home − defence_away
 */
export function logLinearLambda(mu: number, attack: number, oppDefense: number): number {
  const base = Math.max(0.35, mu);
  return clamp(Math.exp(Math.log(base) + attack - oppDefense), 0.32, 3.35);
}

/**
 * Spec §219. Short − long goal form, shrunk by sample size. W-D-L is not this.
 */
export function goalMomentum(short: number | null, long: number | null, n: number): number {
  if (short == null || long == null || n <= 0) return 0;
  const w = n / (n + 8);
  return clamp(w * (short - long), -0.7, 0.7);
}

/**
 * Spec §213 / §220. Hierarchical finishing: last-N rate vs season expected.
 * Returns 0–1 “extreme” flag. Does not delete the observation.
 */
export function finishingRegress(obs: number | null, expected: number | null, n: number): number {
  if (obs == null || expected == null || n < 3) return 0;
  const se = Math.sqrt(Math.max(0.2, expected) / n);
  const z = Math.abs(obs - expected) / Math.max(0.08, se);
  return clamp((z - 1.5) / 3, 0, 1);
}

/**
 * Spec §213. Shrink an observed rate toward the long-term mean.
 * k is the prior strength in games.
 */
export function finishingShrink(obs: number, expected: number, n: number, k = 8): number {
  if (n <= 0) return expected;
  return (n * obs + k * expected) / (n + k);
}

/**
 * Spec §217. 1-D Kalman on log-attack / log-defence (Crowder et al. 2002).
 * Samples are newest-first; the walk is oldest-first. Opponent GA from the
 * current table is an as-of proxy — skip the row if the opponent is missing.
 */
export function kalmanSide(
  samples: FinishedSample[],
  leagueGf: number,
  table?: StandingRow[],
  leagueGa?: number,
): { attack: number; defense: number; attackVar: number; defenseVar: number } {
  const muF = Math.max(0.45, leagueGf);
  const muA = Math.max(0.45, leagueGa ?? leagueGf);
  let att = 0;
  let def = 0;
  let pA = KALMAN_P0;
  let pD = KALMAN_P0;
  const byId = table?.length ? new Map(table.map((r) => [r.teamId, r])) : null;
  const rows = [...samples].reverse();
  for (const s of rows) {
    pA += KALMAN_Q;
    pD += KALMAN_Q;
    let oppDef = 0;
    let oppAtt = 0;
    if (byId) {
      const opp = byId.get(s.opponentId);
      if (opp && opp.played >= 4) {
        const oppGa = opp.goalsAgainst / Math.max(1, opp.played);
        const oppGf = opp.goalsFor / Math.max(1, opp.played);
        oppDef = Math.log(muA / Math.max(0.4, oppGa));
        oppAtt = Math.log(Math.max(0.4, oppGf) / muF);
      }
    }
    const yAtt = Math.log(s.gf + 0.5) - Math.log(muF) - att + oppDef;
    const kA = pA / (pA + KALMAN_R);
    att += kA * yAtt;
    pA *= 1 - kA;
    const yDef = Math.log(muA) - Math.log(s.ga + 0.5) - def - oppAtt;
    const kD = pD / (pD + KALMAN_R);
    def += kD * yDef;
    pD *= 1 - kD;
  }
  return {
    attack: clamp(att, -1.1, 1.1),
    defense: clamp(def, -1.1, 1.1),
    attackVar: clamp(pA, 0.02, 0.6),
    defenseVar: clamp(pD, 0.02, 0.6),
  };
}

export function buildLatentSide(
  samples: FinishedSample[],
  leagueGf: number,
  leagueGa: number,
  table?: StandingRow[],
  asOfUnix?: number,
): LatentSide {
  if (!samples.length) return emptyLatent();
  const asOf = asOfUnix ?? Date.now() / 1000;
  const walk = kalmanSide(samples, leagueGf, table, leagueGa);
  const ewma3 = ewmaRate(samples, 3, "gf", asOf);
  const ewma5 = ewmaRate(samples, 5, "gf", asOf);
  const ewma10 = ewmaRate(samples, 10, "gf", asOf);
  const ewma20 = ewmaRate(samples, 20, "gf", asOf);
  const seasonGf = blendTimescales(samples, "gf", asOf);
  const n = samples.length;
  return {
    attack: walk.attack,
    defense: walk.defense,
    attackVar: walk.attackVar,
    defenseVar: walk.defenseVar,
    ewma3,
    ewma5,
    ewma10,
    ewma20,
    seasonGf,
    momentum: goalMomentum(ewma5, ewma20 ?? seasonGf, n),
    regress: finishingRegress(ewma5, ewma20 ?? seasonGf, Math.min(n, 5)),
  };
}

/** Spec §224. log-λ standard error from attack + opponent-defence variances. */
export function lambdaLogSe(attackVar: number, oppDefVar: number): number {
  return Math.sqrt(Math.max(0, attackVar) + Math.max(0, oppDefVar));
}

/**
 * Across matches, log-attack is a random walk (Crowder). Goals are a noisy observation.
 * One match moves the state by the Kalman gain, not by the score itself.
 * Finishing is a separate latent rate, shrunk toward the long mean with prior strength 8.
 */
export function latentStateTrace(leagueGf = 1.38) {
  const mu = Math.max(0.45, leagueGf);
  const steady = kalmanSteady();
  const cold = kalmanPath(mu, [4]);
  const flat = kalmanPath(mu, Array.from({ length: 8 }, () => 1));
  const spike = kalmanPath(mu, [...Array.from({ length: 7 }, () => 1), 4]);
  const last = <T,>(rows: T[]): T => rows[rows.length - 1]!;
  return {
    q: KALMAN_Q,
    r: KALMAN_R,
    p0: KALMAN_P0,
    mu,
    steadyGain: steady.gain,
    steadyVar: steady.variance,
    cold: last(cold),
    flat: last(flat),
    spike: last(spike),
    shrink1: finishingShrink(4, mu, 1, 8),
    shrink5: finishingShrink(4, mu, 5, 8),
  };
}

function kalmanSteady() {
  const disc = KALMAN_Q * KALMAN_Q + 4 * KALMAN_Q * KALMAN_R;
  const variance = (-KALMAN_Q + Math.sqrt(disc)) / 2;
  const predicted = variance + KALMAN_Q;
  return { variance, gain: predicted / (predicted + KALMAN_R) };
}

function kalmanPath(mu: number, goalsOldestFirst: number[]) {
  let att = 0;
  let p = KALMAN_P0;
  const rows = [];
  for (const gf of goalsOldestFirst) {
    p += KALMAN_Q;
    const gain = p / (p + KALMAN_R);
    const y = Math.log(gf + 0.5) - Math.log(mu) - att;
    att += gain * y;
    p *= 1 - gain;
    rows.push({
      gf,
      gain,
      attack: att,
      lambda: mu * Math.exp(att),
      variance: p,
    });
  }
  return rows;
}

/**
 * Spec §225. Log-normal draws around λ. Returns mean, 10–90 interval, and
 * P(Over 1.5) averaged over the posterior — not a point λ plugged into Poisson.
 */
export function monteCarloOver15(
  lambdaH: number,
  lambdaA: number,
  seLogH: number,
  seLogA: number,
  draws = 400,
): { meanH: number; meanA: number; lo: number; hi: number; pOver15: number } {
  const n = Math.max(40, Math.min(2000, draws));
  let sumH = 0;
  let sumA = 0;
  let sumP = 0;
  const totals: number[] = [];
  let s = 1;
  const next = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const gauss = (): number => {
    const u = Math.max(1e-12, next());
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  for (let i = 0; i < n; i++) {
    const h = clamp(lambdaH * Math.exp(seLogH * gauss()), 0.32, 3.35);
    const a = clamp(lambdaA * Math.exp(seLogA * gauss()), 0.24, 3.1);
    sumH += h;
    sumA += a;
    sumP += poissonOver15(h, a);
    totals.push(h + a);
  }
  totals.sort((x, y) => x - y);
  const q = (p: number) => totals[Math.min(totals.length - 1, Math.floor(p * (totals.length - 1)))] ?? lambdaH + lambdaA;
  return {
    meanH: sumH / n,
    meanA: sumA / n,
    lo: q(0.1),
    hi: q(0.9),
    pOver15: sumP / n,
  };
}
