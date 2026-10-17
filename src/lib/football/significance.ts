/**
 * Statistical significance on a betting desk.
 * Wilson / Agresti–Coull / Clopper–Pearson intervals, exact binomial vs the book,
 * one-sided power, Benjamini–Hochberg step-up (including the prefix gap), Benjamini–Yekutieli, Storey q-values.
 * Last-5 4/5 is the teaching case: it looks like a lock and the interval still swallows Shin.
 * Storey π₀ needs a tail of large p-values; a ten-fold is usually too small, so q falls back to BH.
 * This module does not rank the ten — last-5 is almost always underpowered.
 */

import { studentTCdf } from "./calibrate.ts";
import type { MarketKind, ScoredPick } from "./types.ts";

export const SIG_ALPHA = 0.05;
export const SIG_POWER = 0.8;
export const WALD_Z = 1.959963984540054;
/** Storey (2002) default tuning: look at p-values above ½ to estimate π₀. */
export const STOREY_LAMBDA = 0.5;
export const STOREY_BOOTSTRAP_B = 80;
export const STOREY_BOOTSTRAP_SEED = 20260920;
export const STOREY_LAMBDA_GRID: number[] = Array.from({ length: 19 }, (_, i) => Math.round((i + 1) * 5) / 100);

export type StoreyLambdaMode = "fixed" | "bootstrap" | "smoother";

export type IntervalMethod = "wald" | "wilson" | "agresti-coull" | "clopper-pearson";
export type SigVerdict = "significant" | "compatible" | "underpowered" | "against";
export type EvidenceKind = "form" | "h2h";

export interface Interval {
  method: IntervalMethod;
  lo: number;
  hi: number;
  clipped: boolean;
}

export interface BinomialTest {
  k: number;
  n: number;
  p0: number;
  phat: number;
  pOneGreater: number;
  pOneLess: number;
  pTwo: number;
  z: number | null;
  reject5Greater: boolean;
}

export interface SignificanceReport {
  k: number;
  n: number;
  p0: number;
  phat: number;
  wald: Interval;
  wilson: Interval;
  agresti: Interval;
  clopper: Interval;
  test: BinomialTest;
  power: number;
  n80: number | null;
  wilsonExcludesP0: boolean;
  verdict: SigVerdict;
}

export interface EdgeZ {
  z: number | null;
  p: number | null;
  se: number;
  n: number;
  pModel: number;
  pImplied: number;
}

export interface EvidenceCount {
  kind: EvidenceKind;
  k: number;
  n: number;
  label: string;
}

export interface PickSignificance {
  id: string;
  fixture: string;
  selection: string;
  family: string;
  kind: MarketKind;
  odd: number;
  implied: number;
  accuracy: number;
  evidence: EvidenceCount | null;
  report: SignificanceReport | null;
  edge: EdgeZ;
  p: number | null;
  verdict: SigVerdict;
  onTen: boolean;
}

export interface FdrRow {
  id: string;
  p: number;
  rank: number;
  q: number;
  bhAdjusted: number;
  bh: boolean;
  storey: boolean;
  bonferroni: boolean;
}

export interface StoreyReport {
  m: number;
  lambda: number;
  pi0: number;
  nTail: number;
  thin: boolean;
  q: number[];
  bhAdjusted: number[];
  rejectQ: boolean[];
  mode: StoreyLambdaMode;
}

export interface StoreyLambdaRow {
  lambda: number;
  nTail: number;
  pi0Raw: number;
  pi0: number;
  thin: boolean;
  leadQ: number | null;
  keeps: number;
  mse: number | null;
}

export interface StoreySensitivity {
  m: number;
  grid: StoreyLambdaRow[];
  lambdaStar: number | null;
  bootstrapPi0: number | null;
  smootherPi0: number | null;
  pi0Min: number;
  pi0Max: number;
  keepsMin: number;
  keepsMax: number;
  leadQMin: number | null;
  leadQMax: number | null;
  flips: number;
  unstable: boolean;
}

export interface MeanTTest {
  n: number;
  mean: number;
  se: number;
  t: number | null;
  df: number;
  pOne: number | null;
  pTwo: number | null;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

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
  if (!(a > 0) || !(b > 0)) return 0.5;
  const lbeta = lnBeta(a, b);
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta);
  if (x < (a + 1) / (a + b + 2)) return (bt * betaCf(x, a, b)) / a;
  return 1 - (bt * betaCf(1 - x, b, a)) / b;
}

function invRegIncBeta(p: number, a: number, b: number): number {
  const q = clamp01(p);
  if (q <= 0) return 0;
  if (q >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (regIncBeta(mid, a, b) < q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function normCdf(z: number): number {
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

export function invNorm(p: number): number {
  const q = Math.max(1e-12, Math.min(1 - 1e-12, p));
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(q < 0.5 ? q : 1 - q));
  const z = t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
  return q < 0.5 ? -z : z;
}

/** P(X ≤ k | n, p) via the regularised incomplete beta. */
export function binomCdf(k: number, n: number, p: number): number {
  if (n <= 0) return 1;
  if (k < 0) return 0;
  if (k >= n) return 1;
  const q = clamp01(p);
  if (q <= 0) return 1;
  if (q >= 1) return 0;
  return regIncBeta(1 - q, n - k, k + 1);
}

export function binomSf(k: number, n: number, p: number): number {
  if (n <= 0) return 0;
  if (k <= 0) return 1;
  if (k > n) return 0;
  return 1 - binomCdf(k - 1, n, p);
}

export function binomPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  return Math.max(0, binomCdf(k, n, p) - (k === 0 ? 0 : binomCdf(k - 1, n, p)));
}

export function waldInterval(k: number, n: number, z = WALD_Z): Interval {
  if (n <= 0) return { method: "wald", lo: 0, hi: 1, clipped: false };
  const phat = k / n;
  const se = Math.sqrt(Math.max(0, (phat * (1 - phat)) / n));
  const lo = phat - z * se;
  const hi = phat + z * se;
  const clo = clamp01(lo);
  const chi = clamp01(hi);
  return { method: "wald", lo: clo, hi: chi, clipped: clo !== lo || chi !== hi };
}

export function wilsonInterval(k: number, n: number, z = WALD_Z): Interval {
  if (n <= 0) return { method: "wilson", lo: 0, hi: 1, clipped: false };
  const phat = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (phat + z2 / (2 * n)) / den;
  const margin = (z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))) / den;
  return {
    method: "wilson",
    lo: clamp01(centre - margin),
    hi: clamp01(centre + margin),
    clipped: false,
  };
}

export function agrestiCoullInterval(k: number, n: number, z = WALD_Z): Interval {
  if (n <= 0) return { method: "agresti-coull", lo: 0, hi: 1, clipped: false };
  const z2 = z * z;
  const ntilde = n + z2;
  const ptilde = (k + z2 / 2) / ntilde;
  const se = Math.sqrt(Math.max(0, (ptilde * (1 - ptilde)) / ntilde));
  const lo = ptilde - z * se;
  const hi = ptilde + z * se;
  const clo = clamp01(lo);
  const chi = clamp01(hi);
  return { method: "agresti-coull", lo: clo, hi: chi, clipped: clo !== lo || chi !== hi };
}

export function clopperPearsonInterval(k: number, n: number, alpha = SIG_ALPHA): Interval {
  if (n <= 0) return { method: "clopper-pearson", lo: 0, hi: 1, clipped: false };
  const a = Math.max(1e-12, Math.min(1 - 1e-12, alpha));
  let lo: number;
  let hi: number;
  if (k <= 0) lo = 0;
  else lo = invRegIncBeta(a / 2, k, n - k + 1);
  if (k >= n) hi = 1;
  else hi = invRegIncBeta(1 - a / 2, k + 1, n - k);
  return { method: "clopper-pearson", lo: clamp01(lo), hi: clamp01(hi), clipped: false };
}

export function binomialTest(k: number, n: number, p0: number): BinomialTest {
  const kk = Math.max(0, Math.min(n, Math.round(k)));
  const p = clamp01(p0);
  const phat = n > 0 ? kk / n : 0;
  const pOneGreater = n > 0 ? binomSf(kk, n, p) : 1;
  const pOneLess = n > 0 ? binomCdf(kk, n, p) : 1;
  const observed = binomPmf(kk, n, p);
  let pTwo = 0;
  if (n > 0) {
    for (let i = 0; i <= n; i++) {
      const pi = binomPmf(i, n, p);
      if (pi <= observed + 1e-12) pTwo += pi;
    }
    pTwo = Math.min(1, pTwo);
  } else {
    pTwo = 1;
  }
  let z: number | null = null;
  if (n > 0 && p > 0 && p < 1) {
    const se = Math.sqrt((p * (1 - p)) / n);
    z = se > 0 ? (phat - p) / se : phat === p ? 0 : phat > p ? 8 : -8;
  }
  return {
    k: kk,
    n,
    p0: p,
    phat,
    pOneGreater: clamp01(pOneGreater),
    pOneLess: clamp01(pOneLess),
    pTwo: clamp01(pTwo),
    z,
    reject5Greater: pOneGreater < SIG_ALPHA,
  };
}

export function criticalCount(n: number, p0: number, alpha = SIG_ALPHA): number | null {
  if (n <= 0) return null;
  for (let k = 0; k <= n; k++) {
    if (binomSf(k, n, clamp01(p0)) <= alpha + 1e-15) return k;
  }
  return null;
}

/** One-sided power of the exact binomial vs p0 at alternative p1. */
export function binomialPower(n: number, p0: number, p1: number, alpha = SIG_ALPHA): number {
  const kCrit = criticalCount(n, p0, alpha);
  if (kCrit == null) return 0;
  return binomSf(kCrit, n, clamp01(p1));
}

export function nForPower(p0: number, p1: number, alpha = SIG_ALPHA, power = SIG_POWER, cap = 2000): number | null {
  const delta = p1 - p0;
  if (!(Math.abs(delta) > 1e-6)) return null;
  let lo = 1;
  let hi = cap;
  if (binomialPower(hi, p0, p1, alpha) < power) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (binomialPower(mid, p0, p1, alpha) >= power) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function significanceReport(k: number, n: number, p0: number, alpha = SIG_ALPHA): SignificanceReport {
  const kk = Math.max(0, Math.min(n, Math.round(k)));
  const p = clamp01(p0);
  const phat = n > 0 ? kk / n : 0;
  const z = invNorm(1 - alpha / 2);
  const wald = waldInterval(kk, n, z);
  const wilson = wilsonInterval(kk, n, z);
  const agresti = agrestiCoullInterval(kk, n, z);
  const clopper = clopperPearsonInterval(kk, n, alpha);
  const test = binomialTest(kk, n, p);
  const alt10 = clamp01(p + 0.1);
  const power = binomialPower(n, p, alt10, alpha);
  const n80 = nForPower(p, alt10, alpha, SIG_POWER);
  const wilsonExcludesP0 = p < wilson.lo - 1e-12 || p > wilson.hi + 1e-12;
  let verdict: SigVerdict;
  if (wilsonExcludesP0 && phat < p) {
    verdict = "against";
  } else if (test.pOneGreater < alpha && phat > p && n >= 8) {
    verdict = "significant";
  } else if (n < 12) {
    verdict = "underpowered";
  } else {
    verdict = "compatible";
  }
  return {
    k: kk,
    n,
    p0: p,
    phat,
    wald,
    wilson,
    agresti,
    clopper,
    test,
    power,
    n80,
    wilsonExcludesP0,
    verdict,
  };
}

export function edgeZ(pModel: number, pImplied: number, n: number): EdgeZ {
  const p0 = clamp01(pImplied);
  const p1 = clamp01(pModel);
  const nn = Math.max(0, Math.floor(n));
  const se = nn > 0 ? Math.sqrt(Math.max(1e-12, (p0 * (1 - p0)) / nn)) : 1;
  let z: number | null = null;
  let p: number | null = null;
  if (nn >= 2) {
    z = (p1 - p0) / se;
    p = 1 - normCdf(z);
  }
  return { z, p, se, n: nn, pModel: p1, pImplied: p0 };
}

export function meanTTest(xs: number[]): MeanTTest {
  const n = xs.length;
  if (!n) return { n: 0, mean: 0, se: 0, t: null, df: 0, pOne: null, pTwo: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  let ss = 0;
  for (const x of xs) ss += (x - mean) * (x - mean);
  const varHat = n > 1 ? ss / (n - 1) : 0;
  const se = Math.sqrt(varHat / n);
  const df = Math.max(1, n - 1);
  if (!(se > 1e-12) || n < 2) {
    const t = mean === 0 ? 0 : mean > 0 ? 8 : -8;
    return { n, mean, se, t: n < 2 ? null : t, df, pOne: n < 2 ? null : mean > 0 ? 0 : 1, pTwo: n < 2 ? null : 0 };
  }
  const t = mean / se;
  const pTwo = 2 * (1 - studentTCdf(Math.abs(t), df));
  const pOne = 1 - studentTCdf(t, df);
  return { n, mean, se, t, df, pOne: clamp01(pOne), pTwo: clamp01(pTwo) };
}

export function benjaminiHochberg(pValues: number[], alpha = SIG_ALPHA): { reject: boolean[]; cutoff: number | null; m: number } {
  const m = pValues.length;
  const reject = pValues.map(() => false);
  if (!m) return { reject, cutoff: null, m: 0 };
  const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let maxRank = 0;
  let cutoff: number | null = null;
  for (let r = 1; r <= m; r++) {
    const row = order[r - 1]!;
    if (row.p <= (r / m) * alpha + 1e-15) {
      maxRank = r;
      cutoff = (r / m) * alpha;
    }
  }
  for (let r = 1; r <= maxRank; r++) reject[order[r - 1]!.i] = true;
  return { reject, cutoff, m };
}

export function bonferroni(pValues: number[], alpha = SIG_ALPHA): boolean[] {
  const m = pValues.length;
  const cut = m ? alpha / m : alpha;
  return pValues.map((p) => p <= cut);
}

export interface StepRow {
  rank: number;
  index: number;
  p: number;
  bonBar: number;
  holmBar: number;
  bhBar: number;
  bonferroni: boolean;
  holm: boolean;
  hochberg: boolean;
  bh: boolean;
}

export interface StepProcedures {
  m: number;
  alpha: number;
  rows: StepRow[];
  bonKeeps: number;
  holmKeeps: number;
  hochbergKeeps: number;
  bhKeeps: number;
}

/**
 * Bonferroni, Holm (step-down FWER), Hochberg (step-up FWER), BH (step-up FDR) on one ordered list.
 * Holm and Hochberg share the bars α/(m−r+1). Holm stops at the first miss. Hochberg takes the last hit.
 * Those bars sit on or under BH's (r/m)α, so on any fixed list the keeps nest:
 * Bonferroni ⊆ Holm ⊆ Hochberg ⊆ BH.
 * Nesting is not a licence to swap the error rates. Does not rank the ten.
 */
export function stepProcedures(pValues: number[], alpha = SIG_ALPHA): StepProcedures {
  const m = pValues.length;
  const order = pValues.map((p, index) => ({ p: clamp01(p), index })).sort((a, b) => a.p - b.p || a.index - b.index);
  let holmStop = m + 1;
  let hochK = 0;
  let bhK = 0;
  const bonBar = m ? alpha / m : alpha;
  for (let r = 1; r <= m; r++) {
    const p = order[r - 1]!.p;
    const holmBar = alpha / (m - r + 1);
    const bhBar = (r / m) * alpha;
    if (holmStop === m + 1 && p > holmBar + 1e-15) holmStop = r;
    if (p <= holmBar + 1e-15) hochK = r;
    if (p <= bhBar + 1e-15) bhK = r;
  }
  const rows: StepRow[] = order.map((row, i) => {
    const rank = i + 1;
    return {
      rank,
      index: row.index,
      p: row.p,
      bonBar,
      holmBar: m ? alpha / (m - rank + 1) : alpha,
      bhBar: m ? (rank / m) * alpha : alpha,
      bonferroni: row.p <= bonBar + 1e-15,
      holm: rank < holmStop,
      hochberg: rank <= hochK,
      bh: rank <= bhK,
    };
  });
  return {
    m,
    alpha,
    rows,
    bonKeeps: rows.filter((r) => r.bonferroni).length,
    holmKeeps: rows.filter((r) => r.holm).length,
    hochbergKeeps: rows.filter((r) => r.hochberg).length,
    bhKeeps: rows.filter((r) => r.bh).length,
  };
}

export interface BhStep {
  index: number;
  rank: number;
  p: number;
  bhBar: number;
  byBar: number;
  ownBar: boolean;
  kept: boolean;
  byKept: boolean;
  rawAdjust: number;
  adjusted: number;
  byAdjusted: number;
  gap: boolean;
}

export interface BhProcedure {
  m: number;
  alpha: number;
  harmonic: number;
  kStar: number;
  byKStar: number;
  cutoff: number | null;
  byCutoff: number | null;
  steps: BhStep[];
  gaps: number;
  budget: number;
  byBudget: number;
}

/** Euler–Mascheroni. H_m = ln m + γ + 1/(2m) − ε, with 0 < ε < 1/(12m²). */
export const EULER_GAMMA = 0.5772156649015329;

export interface ByPrice {
  m: number;
  harmonic: number;
  lnApprox: number;
  alphaBy: number;
  worstBh: number;
}

export interface ByTerm {
  k: number;
  term: number;
  share: number;
}

export type DeskRegime = "separate" | "same-way" | "opposed";

export interface DeskDependence {
  m: number;
  fixtures: number;
  shared: number;
  opposed: number;
  regime: DeskRegime;
  procedure: "BH" | "BY";
}

/** α_BY = α / H_m. Uncorrected BH under arbitrary dependence is only guaranteed up to α·H_m. */
export function byPrice(m: number, alpha = SIG_ALPHA): ByPrice {
  const n = Math.max(1, Math.floor(m));
  const harmonic = harmonicNumber(n);
  const lnApprox = Math.log(n) + EULER_GAMMA + 1 / (2 * n);
  return {
    m: n,
    harmonic,
    lnApprox,
    alphaBy: alpha / harmonic,
    worstBh: Math.min(1, alpha * harmonic),
  };
}

export function byPricePath(maxM = 40, alpha = SIG_ALPHA): ByPrice[] {
  const n = Math.max(1, Math.min(60, Math.floor(maxM)));
  const out: ByPrice[] = [];
  for (let m = 1; m <= n; m++) out.push(byPrice(m, alpha));
  return out;
}

/** The summands of H_m. The k = 1 term is most of the tax; the tail is the log. */
export function byHarmonicTerms(m: number): ByTerm[] {
  const n = Math.max(1, Math.floor(m));
  const h = harmonicNumber(n);
  const out: ByTerm[] = [];
  for (let k = 1; k <= n; k++) {
    const term = 1 / k;
    out.push({ k, term, share: h > 0 ? term / h : 0 });
  }
  return out;
}

function kindsOpposed(a: MarketKind, b: MarketKind): boolean {
  if (a.startsWith("over_") && b === `under_${a.slice(5)}`) return true;
  if (b.startsWith("over_") && a === `under_${b.slice(5)}`) return true;
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  return (
    key === "away|home" ||
    key === "draw|home" ||
    key === "away|draw" ||
    key === "btts_no|btts_yes" ||
    key === "away|dc_1x" ||
    key === "dc_x2|home" ||
    key === "dc_12|draw"
  );
}

/**
 * BH is valid under independence and under PRDS (positive dependence — several overs on one night).
 * BY is the proven bound when dependence can go negative: home against away, over against under, on the same fixture.
 * A shared fixture that points the same way does not by itself force BY. Does not rank the ten.
 */
export function deskDependence(picks: Array<{ fixtureId: number; kind: MarketKind }>): DeskDependence {
  const byFix = new Map<number, MarketKind[]>();
  for (const p of picks) {
    const list = byFix.get(p.fixtureId) ?? [];
    list.push(p.kind);
    byFix.set(p.fixtureId, list);
  }
  let shared = 0;
  let opposed = 0;
  for (const kinds of byFix.values()) {
    if (kinds.length < 2) continue;
    shared += 1;
    let hit = false;
    for (let i = 0; i < kinds.length && !hit; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        if (kindsOpposed(kinds[i]!, kinds[j]!)) hit = true;
      }
    }
    if (hit) opposed += 1;
  }
  const regime: DeskRegime = opposed > 0 ? "opposed" : shared > 0 ? "same-way" : "separate";
  return {
    m: picks.length,
    fixtures: byFix.size,
    shared,
    opposed,
    regime,
    procedure: regime === "opposed" ? "BY" : "BH",
  };
}

export type ProofRegime = "independence" | "prds" | "arbitrary";

export interface RegimeBlock {
  label: string;
  m: number;
  proof: ProofRegime;
  procedure: "BH" | "BY";
  bhCeiling: number;
}

export interface DependenceRegimes {
  m: number;
  proof: ProofRegime;
  procedure: "BH" | "BY";
  bhCeiling: number;
  byCeiling: number;
  rhoFloor: number;
  opposedFixtures: number;
  sameWayFixtures: number;
  blocks: RegimeBlock[];
}

export interface EquicorrelationPoint {
  rho: number;
  bhProved: number;
}

/** Most negative equicorrelation that is still a correlation matrix: −1/(m−1). */
export function rhoFloor(m: number): number {
  const n = Math.floor(m);
  if (n < 2) return 0;
  return -1 / (n - 1);
}

/**
 * One-sided tests on equicorrelated Gaussians.
 * ρ = 0 is independence. ρ > 0 is PRDS, so BH is proved. ρ < 0 down to the PSD floor is possible and BH is not proved.
 */
export function gaussianRegime(rho: number, m: number): { proof: ProofRegime; possible: boolean; floor: number; procedure: "BH" | "BY" } {
  const floor = rhoFloor(m);
  if (m < 2) return { proof: "independence", possible: true, floor, procedure: "BH" };
  if (rho < floor - 1e-9) return { proof: "arbitrary", possible: false, floor, procedure: "BY" };
  if (rho > 1e-9) return { proof: "prds", possible: true, floor, procedure: "BH" };
  if (rho >= -1e-9) return { proof: "independence", possible: true, floor, procedure: "BH" };
  return { proof: "arbitrary", possible: true, floor, procedure: "BY" };
}

export function equicorrelationPath(m: number): EquicorrelationPoint[] {
  const floor = rhoFloor(Math.max(2, Math.floor(m)));
  const steps = 40;
  const out: EquicorrelationPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const rho = floor + (1 - floor) * (i / steps);
    const snapped = Math.round(rho * 1000) / 1000;
    out.push({ rho: snapped, bhProved: snapped >= -1e-9 ? 1 : 0 });
  }
  return out;
}

function blockCeiling(proof: ProofRegime, m: number, alpha: number): number {
  if (proof === "arbitrary") return Math.min(1, alpha * harmonicNumber(m));
  return alpha;
}

/**
 * BH (1995) covers independence. BY (2001) Thm 1.2 covers PRDS — nonnegative dependence, including same-direction legs.
 * One opposed pair (home vs away, over vs under) makes the joint law arbitrary: BH on the pooled card is only proved up to α·H_m.
 * BH inside a clean block does not restore a pooled FDR. Does not rank the ten.
 */
export function dependenceRegimes(
  picks: Array<{ fixtureId: number; kind: MarketKind }>,
  alpha = SIG_ALPHA,
): DependenceRegimes {
  const byFix = new Map<number, MarketKind[]>();
  for (const p of picks) {
    const list = byFix.get(p.fixtureId) ?? [];
    list.push(p.kind);
    byFix.set(p.fixtureId, list);
  }
  let singles = 0;
  let opposedFixtures = 0;
  let sameWayFixtures = 0;
  const blocks: RegimeBlock[] = [];
  const fixtureIds = [...byFix.keys()].sort((a, b) => a - b);
  for (const id of fixtureIds) {
    const kinds = byFix.get(id)!;
    if (kinds.length < 2) {
      singles += kinds.length;
      continue;
    }
    let opposed = false;
    for (let i = 0; i < kinds.length && !opposed; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        if (kindsOpposed(kinds[i]!, kinds[j]!)) opposed = true;
      }
    }
    if (opposed) {
      opposedFixtures += 1;
      blocks.push({
        label: `Opposed · ${id}`,
        m: kinds.length,
        proof: "arbitrary",
        procedure: "BY",
        bhCeiling: blockCeiling("arbitrary", kinds.length, alpha),
      });
    } else {
      sameWayFixtures += 1;
      blocks.push({
        label: `Same-way · ${id}`,
        m: kinds.length,
        proof: "prds",
        procedure: "BH",
        bhCeiling: alpha,
      });
    }
  }
  if (singles) {
    blocks.unshift({
      label: "Separate matches",
      m: singles,
      proof: "independence",
      procedure: "BH",
      bhCeiling: alpha,
    });
  }
  const m = picks.length;
  const proof: ProofRegime = opposedFixtures > 0 ? "arbitrary" : sameWayFixtures > 0 ? "prds" : "independence";
  return {
    m,
    proof,
    procedure: proof === "arbitrary" ? "BY" : "BH",
    bhCeiling: blockCeiling(proof, Math.max(m, 1), alpha),
    byCeiling: alpha,
    rhoFloor: rhoFloor(m),
    opposedFixtures,
    sameWayFixtures,
    blocks,
  };
}

/** H_m = Σ_{i=1}^{m} 1/i. Benjamini–Yekutieli divides every BH bar by this under arbitrary dependence. */
export function harmonicNumber(m: number): number {
  const n = Math.max(0, Math.floor(m));
  let h = 0;
  for (let i = 1; i <= n; i++) h += 1 / i;
  return h;
}

/**
 * Full BH (1995) step-up, plus BY (2001).
 * k* is the largest rank with p_(r) ≤ (r/m)α. Every rank ≤ k* is kept — including a rank that missed its own bar
 * if a worse rank cleared a higher bar. Adjusted p is the running minimum of (m/k)p_(k) from the right.
 * BY uses the same step-up on bars divided by H_m. Does not rank the ten.
 */
export function bhProcedure(pValues: number[], alpha = SIG_ALPHA): BhProcedure {
  const m = pValues.length;
  const h = harmonicNumber(m);
  const order = pValues.map((p, index) => ({ p: clamp01(p), index })).sort((a, b) => a.p - b.p || a.index - b.index);
  let kStar = 0;
  let byKStar = 0;
  const raw = new Array<number>(m);
  for (let r = 1; r <= m; r++) {
    const p = order[r - 1]!.p;
    const bhBar = (r / m) * alpha;
    const byBar = h > 0 ? bhBar / h : bhBar;
    raw[r - 1] = (m / r) * p;
    if (p <= bhBar + 1e-15) kStar = r;
    if (p <= byBar + 1e-15) byKStar = r;
  }
  const adjusted = new Array<number>(m);
  const byAdjusted = new Array<number>(m);
  let run = 1;
  let byRun = 1;
  for (let r = m; r >= 1; r--) {
    run = Math.min(run, raw[r - 1]!);
    byRun = Math.min(byRun, Math.min(1, h > 0 ? h * raw[r - 1]! : raw[r - 1]!));
    adjusted[r - 1] = Math.max(0, Math.min(1, run));
    byAdjusted[r - 1] = Math.max(0, Math.min(1, byRun));
  }
  const steps: BhStep[] = order.map((row, i) => {
    const rank = i + 1;
    const bhBar = m ? (rank / m) * alpha : alpha;
    const byBar = h > 0 ? bhBar / h : bhBar;
    const ownBar = row.p <= bhBar + 1e-15;
    const kept = rank <= kStar;
    return {
      index: row.index,
      rank,
      p: row.p,
      bhBar,
      byBar,
      ownBar,
      kept,
      byKept: rank <= byKStar,
      rawAdjust: raw[i]!,
      adjusted: adjusted[i]!,
      byAdjusted: byAdjusted[i]!,
      gap: kept && !ownBar,
    };
  });
  return {
    m,
    alpha,
    harmonic: h,
    kStar,
    byKStar,
    cutoff: kStar ? (kStar / m) * alpha : null,
    byCutoff: byKStar ? (byKStar / m) * alpha / (h || 1) : null,
    steps,
    gaps: steps.filter((s) => s.gap).length,
    budget: alpha * kStar,
    byBudget: alpha * byKStar,
  };
}

export interface ByMethod {
  m: number;
  alpha: number;
  harmonic: number;
  alphaPrime: number;
  pi0: number;
  provedCeiling: number;
  slack: number;
  kStar: number;
  cutoff: number | null;
  keeps: number;
  bhKeeps: number;
  sameAsBhAtPrime: boolean;
}

/**
 * Benjamini–Yekutieli (2001) is ordinary BH run at α' = α / H_m.
 * Under arbitrary dependence that delivers FDR ≤ π₀ α, not α. The method does not estimate π₀ and does not spend the slack.
 * Spending it is Storey, which is not proved for arbitrary dependence. Does not rank the ten.
 */
export function byMethod(pValues: number[], alpha = SIG_ALPHA, pi0 = 1): ByMethod {
  const m = pValues.length;
  const harmonic = harmonicNumber(m);
  const alphaPrime = harmonic > 0 ? alpha / harmonic : alpha;
  const pi = Math.min(1, Math.max(0, pi0));
  const atPrime = benjaminiHochberg(pValues, alphaPrime);
  const atAlpha = benjaminiHochberg(pValues, alpha);
  const proc = bhProcedure(pValues, alpha);
  const fromBars = Array.from({ length: m }, () => false);
  for (const step of proc.steps) if (step.byKept) fromBars[step.index] = true;
  const keeps = atPrime.reject.filter(Boolean).length;
  return {
    m,
    alpha,
    harmonic,
    alphaPrime,
    pi0: pi,
    provedCeiling: pi * alpha,
    slack: (1 - pi) * alpha,
    kStar: proc.byKStar,
    cutoff: proc.byCutoff,
    keeps,
    bhKeeps: atAlpha.reject.filter(Boolean).length,
    sameAsBhAtPrime: m === 0 || atPrime.reject.every((kept, i) => kept === fromBars[i]),
  };
}

/**
 * Storey (2002) π₀(λ) = #{p > λ} / (m (1−λ)), capped at 1.
 * A ten-fold rarely has a usable tail — nTail < 2 is thin, and q falls back to BH (π₀ = 1).
 */
export function storeyPi0(pValues: number[], lambda = STOREY_LAMBDA): { pi0: number; nTail: number; thin: boolean; lambda: number; m: number; raw: number } {
  const m = pValues.length;
  const lam = snapLambda(lambda);
  if (!m) return { pi0: 1, nTail: 0, thin: true, lambda: lam, m: 0, raw: 1 };
  let nTail = 0;
  for (const p of pValues) if (p > lam) nTail += 1;
  const raw = nTail / (m * (1 - lam));
  const thin = nTail < 2 || m < 5;
  const pi0 = thin ? 1 : Math.max(0, Math.min(1, raw));
  return { pi0, nTail, thin, lambda: lam, m, raw };
}

export function storeyPi0Path(pValues: number[]): Array<{ lambda: number; pi0: number; nTail: number; thin: boolean; pi0Raw: number }> {
  return STOREY_LAMBDA_GRID.map((lambda) => {
    const est = storeyPi0(pValues, lambda);
    return {
      lambda,
      pi0: Math.max(0, Math.min(1, est.raw)),
      nTail: est.nTail,
      thin: est.thin,
      pi0Raw: est.raw,
    };
  });
}

/**
 * Storey q-values: monotone min_{t ≥ p} π₀ m t / #{p_j ≤ t}.
 * π₀ = 1 recovers the BH-adjusted p-value. q is an FDR, not a p-value.
 */
export function storeyQValues(pValues: number[], pi0 = 1): number[] {
  const m = pValues.length;
  if (!m) return [];
  const pi = Math.max(0, Math.min(1, pi0));
  const order = pValues.map((p, i) => ({ p: clamp01(p), i })).sort((a, b) => a.p - b.p);
  const qSorted = new Array<number>(m);
  for (let r = m; r >= 1; r--) {
    const raw = (pi * m * order[r - 1]!.p) / r;
    const next = r < m ? qSorted[r]! : 1;
    qSorted[r - 1] = Math.max(0, Math.min(1, Math.min(raw, next)));
  }
  const out = new Array<number>(m);
  order.forEach((row, r) => {
    out[row.i] = qSorted[r]!;
  });
  return out;
}

export interface StoreyQStep {
  index: number;
  rank: number;
  p: number;
  bhRatio: number;
  scaled: number;
  q: number;
  pulled: boolean;
}

/**
 * The q-value calculation, rank by rank.
 * At threshold t = p_(r) the plug-in FDR is π₀ · m · t / r, which is π₀ times the BH ratio.
 * q at rank r is the running minimum of those values over k ≥ r, capped at 1.
 * Because π₀ factors out, q = min(1, π₀ · p_BH). A pulled rank is one whose own ratio loses to a later rank.
 * Does not rank the ten.
 */
export function storeyQTrace(pValues: number[], pi0 = 1): { pi0: number; m: number; steps: StoreyQStep[]; identity: boolean; pulled: number } {
  const m = pValues.length;
  const pi = Math.max(0, Math.min(1, pi0));
  const q = storeyQValues(pValues, pi);
  const bh = bhAdjustedP(pValues);
  const order = pValues.map((p, index) => ({ p: clamp01(p), index })).sort((a, b) => a.p - b.p || a.index - b.index);
  const steps: StoreyQStep[] = order.map((row, i) => {
    const rank = i + 1;
    const bhRatio = m ? (m / rank) * row.p : row.p;
    const scaled = pi * bhRatio;
    const qv = q[row.index] ?? 1;
    return {
      index: row.index,
      rank,
      p: row.p,
      bhRatio,
      scaled,
      q: qv,
      pulled: qv < Math.min(1, scaled) - 1e-9,
    };
  });
  const identity =
    m === 0 ||
    q.every((qv, i) => Math.abs(qv - Math.min(1, pi * (bh[i] ?? 1))) < 1e-9);
  return { pi0: pi, m, steps, identity, pulled: steps.filter((s) => s.pulled).length };
}

export function bhAdjustedP(pValues: number[]): number[] {
  return storeyQValues(pValues, 1);
}

export function storeyReport(
  pValues: number[],
  lambda = STOREY_LAMBDA,
  alpha = SIG_ALPHA,
  mode: StoreyLambdaMode = "fixed",
): StoreyReport {
  const bhAdjusted = bhAdjustedP(pValues);
  let lam = snapLambda(lambda);
  let est = storeyPi0(pValues, lam);
  if (mode === "bootstrap" || mode === "smoother") {
    const sens = storeyLambdaSensitivity(pValues, alpha);
    if (mode === "bootstrap" && sens.lambdaStar != null) {
      lam = sens.lambdaStar;
      est = storeyPi0(pValues, lam);
    } else if (mode === "smoother" && sens.smootherPi0 != null) {
      lam = 0.95;
      const thin = pValues.length < 5;
      est = {
        pi0: thin ? 1 : sens.smootherPi0,
        nTail: storeyPi0(pValues, 0.95).nTail,
        thin,
        lambda: lam,
        m: pValues.length,
        raw: sens.smootherPi0,
      };
    }
  }
  const q = storeyQValues(pValues, est.pi0);
  return {
    m: est.m,
    lambda: est.lambda,
    pi0: est.pi0,
    nTail: est.nTail,
    thin: est.thin,
    q,
    bhAdjusted,
    rejectQ: q.map((v) => v <= alpha),
    mode,
  };
}

/**
 * Storey (2002) bootstrap pick of λ: minimise MSE of π₀(λ) against min_λ π₀ as a plug-in truth.
 * Storey–Tibshirani (2003) smoother: quadratic fit of π₀(λ), evaluated at 0.95.
 * Only λ with nTail ≥ 2 on the original sample enter the bootstrap — empty tails would pick λ = 0.95 and π₀ = 0.
 */
export function storeyLambdaSensitivity(
  pValues: number[],
  alpha = SIG_ALPHA,
  boots = STOREY_BOOTSTRAP_B,
  seed = STOREY_BOOTSTRAP_SEED,
): StoreySensitivity {
  const m = pValues.length;
  const empty: StoreySensitivity = {
    m,
    grid: [],
    lambdaStar: null,
    bootstrapPi0: null,
    smootherPi0: null,
    pi0Min: 1,
    pi0Max: 1,
    keepsMin: 0,
    keepsMax: 0,
    leadQMin: null,
    leadQMax: null,
    flips: 0,
    unstable: false,
  };
  if (!m) return empty;

  const orig = STOREY_LAMBDA_GRID.map((lambda) => storeyPi0(pValues, lambda));
  const usable = orig.filter((e) => !e.thin);
  const target = usable.length ? Math.min(...usable.map((e) => e.pi0)) : 1;

  const mseByLambda = new Map<number, number>();
  if (usable.length && m >= 5 && boots > 0) {
    const rng = mulberry32(seed);
    const acc = STOREY_LAMBDA_GRID.map(() => 0);
    for (let b = 0; b < boots; b++) {
      const draw = resample(pValues, rng);
      for (let i = 0; i < STOREY_LAMBDA_GRID.length; i++) {
        const est = storeyPi0(draw, STOREY_LAMBDA_GRID[i]!);
        const pi = est.thin ? 1 : est.pi0;
        const d = pi - target;
        acc[i] += d * d;
      }
    }
    STOREY_LAMBDA_GRID.forEach((lambda, i) => {
      mseByLambda.set(lambda, acc[i]! / boots);
    });
  }

  let lambdaStar: number | null = null;
  let bestMse = Infinity;
  for (const e of usable) {
    const mse = mseByLambda.get(e.lambda);
    if (mse == null) continue;
    if (mse < bestMse - 1e-15 || (Math.abs(mse - bestMse) <= 1e-15 && (lambdaStar == null || e.lambda < lambdaStar))) {
      bestMse = mse;
      lambdaStar = e.lambda;
    }
  }

  const smootherPi0 = fitSmootherPi0(orig);
  const rejectTracks: boolean[][] = [];

  const grid: StoreyLambdaRow[] = orig.map((e) => {
    const q = storeyQValues(pValues, e.pi0);
    const keeps = q.filter((v) => v <= alpha).length;
    rejectTracks.push(q.map((v) => v <= alpha));
    return {
      lambda: e.lambda,
      nTail: e.nTail,
      pi0Raw: e.raw,
      pi0: e.pi0,
      thin: e.thin,
      leadQ: q.length ? Math.min(...q) : null,
      keeps,
      mse: mseByLambda.get(e.lambda) ?? null,
    };
  });

  let flips = 0;
  if (rejectTracks.length) {
    const tests = rejectTracks[0]!.length;
    for (let t = 0; t < tests; t++) {
      const first = rejectTracks[0]![t];
      if (rejectTracks.some((row) => row[t] !== first)) flips += 1;
    }
  }

  const pi0s = grid.map((g) => g.pi0);
  const keepCounts = grid.map((g) => g.keeps);
  const qs = grid.map((g) => g.leadQ).filter((v): v is number => v != null);
  const pi0Min = Math.min(...pi0s);
  const pi0Max = Math.max(...pi0s);
  const keepsMin = Math.min(...keepCounts);
  const keepsMax = Math.max(...keepCounts);
  const bootstrapPi0 = lambdaStar != null ? (grid.find((g) => g.lambda === lambdaStar)?.pi0 ?? null) : null;

  return {
    m,
    grid,
    lambdaStar,
    bootstrapPi0,
    smootherPi0,
    pi0Min,
    pi0Max,
    keepsMin,
    keepsMax,
    leadQMin: qs.length ? Math.min(...qs) : null,
    leadQMax: qs.length ? Math.max(...qs) : null,
    flips,
    unstable: keepsMax - keepsMin >= 2 || pi0Max - pi0Min >= 0.25,
  };
}

function snapLambda(lambda: number): number {
  const clamped = Math.max(0.05, Math.min(0.95, lambda));
  return Math.round(clamped * 20) / 20;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resample(ps: number[], rng: () => number): number[] {
  const m = ps.length;
  const out = new Array<number>(m);
  for (let i = 0; i < m; i++) out[i] = ps[Math.floor(rng() * m)]!;
  return out;
}

/** Quadratic OLS of π₀(λ), evaluated at 0.95, then clipped to [0, 1]. Thin/empty tails are dropped from the fit. */
function fitSmootherPi0(ests: Array<{ lambda: number; pi0: number; thin: boolean; raw: number }>): number | null {
  const pts = ests.filter((e) => !e.thin);
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p.lambda);
  const ys = pts.map((p) => Math.min(1.5, Math.max(0, p.raw)));
  const coef = fitQuadratic(xs, ys);
  if (!coef) return null;
  const y = coef.a + coef.b * 0.95 + coef.c * 0.95 * 0.95;
  if (!Number.isFinite(y)) return null;
  return Math.max(0, Math.min(1, y));
}

function fitQuadratic(xs: number[], ys: number[]): { a: number; b: number; c: number } | null {
  const n = xs.length;
  if (n < 3) return null;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let t0 = 0;
  let t1 = 0;
  let t2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    const x2 = x * x;
    s0 += 1;
    s1 += x;
    s2 += x2;
    s3 += x2 * x;
    s4 += x2 * x2;
    t0 += y;
    t1 += x * y;
    t2 += x2 * y;
  }
  const solved = solve3(
    [
      [s0, s1, s2],
      [s1, s2, s3],
      [s2, s3, s4],
    ],
    [t0, t1, t2],
  );
  if (!solved) return null;
  return { a: solved[0], b: solved[1], c: solved[2] };
}

function solve3(A: number[][], b: number[]): [number, number, number] | null {
  const M = [
    [A[0]![0]!, A[0]![1]!, A[0]![2]!, b[0]!],
    [A[1]![0]!, A[1]![1]!, A[1]![2]!, b[1]!],
    [A[2]![0]!, A[2]![1]!, A[2]![2]!, b[2]!],
  ];
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
    }
    const row = M[col]!;
    M[col] = M[pivot]!;
    M[pivot] = row;
    const diag = M[col]![col]!;
    if (Math.abs(diag) < 1e-12) return null;
    for (let c = col; c < 4; c++) M[col]![c]! /= diag;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r]![col]!;
      for (let c = col; c < 4; c++) M[r]![c]! -= f * M[col]![c]!;
    }
  }
  return [M[0]![3]!, M[1]![3]!, M[2]![3]!];
}

/** Evenly spaced null p-values on (0.15, 0.95) so λ = 0.5 has a tail. Optional lead signal. */
export function spreadNulls(m: number, signal?: number): number[] {
  const count = Math.max(0, Math.floor(m));
  if (!count) return [];
  const hasSignal = signal != null;
  const start = hasSignal ? 1 : 0;
  const slots = count - start;
  const rest: number[] = [];
  for (let i = 0; i < slots; i++) {
    rest.push(0.15 + ((i + 0.5) / Math.max(1, slots)) * 0.8);
  }
  return hasSignal ? [clamp01(signal!), ...rest] : rest;
}

function parseForm(form: string | null | undefined): string {
  return String(form ?? "")
    .toUpperCase()
    .replace(/[^WDL]/g, "")
    .slice(0, 5);
}

function countChars(s: string, pred: (ch: string) => boolean): number {
  let k = 0;
  for (const ch of s) if (pred(ch)) k += 1;
  return k;
}

function formEvidence(kind: MarketKind, homeForm: string, awayForm: string): EvidenceCount | null {
  const side =
    kind === "home" || kind === "dc_1x" || kind === "draw" || kind === "dc_12"
      ? homeForm
      : kind === "away" || kind === "dc_x2"
        ? awayForm
        : "";
  if (side.length < 3) return null;
  if (kind === "home") return { kind: "form", k: countChars(side, (c) => c === "W"), n: side.length, label: "last-5 W" };
  if (kind === "away") return { kind: "form", k: countChars(side, (c) => c === "W"), n: side.length, label: "last-5 W" };
  if (kind === "draw") {
    const src = homeForm.length >= 3 ? homeForm : side;
    return { kind: "form", k: countChars(src, (c) => c === "D"), n: src.length, label: "last-5 D" };
  }
  if (kind === "dc_1x") return { kind: "form", k: countChars(side, (c) => c !== "L"), n: side.length, label: "last-5 1X" };
  if (kind === "dc_x2") return { kind: "form", k: countChars(side, (c) => c !== "L"), n: side.length, label: "last-5 X2" };
  if (kind === "dc_12") return { kind: "form", k: countChars(side, (c) => c !== "D"), n: side.length, label: "last-5 12" };
  return null;
}

function formScoreEvidence(kind: MarketKind, homeForm: string, awayForm: string): EvidenceCount | null {
  const side = kind === "home_score" ? homeForm : awayForm;
  if (side.length < 3) return null;
  const k = countChars(side, (c) => c === "W" || c === "D");
  return { kind: "form", k, n: side.length, label: "last-5 scored" };
}

function h2hEvidence(kind: MarketKind, wins: number, draws: number, losses: number, n: number): EvidenceCount | null {
  if (n < 4) return null;
  if (kind === "home") return { kind: "h2h", k: wins, n, label: "H2H home" };
  if (kind === "away") return { kind: "h2h", k: losses, n, label: "H2H away" };
  if (kind === "draw") return { kind: "h2h", k: draws, n, label: "H2H draw" };
  if (kind === "dc_1x") return { kind: "h2h", k: wins + draws, n, label: "H2H 1X" };
  if (kind === "dc_x2") return { kind: "h2h", k: losses + draws, n, label: "H2H X2" };
  if (kind === "dc_12") return { kind: "h2h", k: wins + losses, n, label: "H2H 12" };
  return null;
}

export function evidenceFromPick(p: ScoredPick): EvidenceCount | null {
  const f = p.facts;
  const hf = parseForm(f?.homeForm);
  const af = parseForm(f?.awayForm);
  if (p.kind === "home_score" || p.kind === "away_score") {
    const scored = formScoreEvidence(p.kind, hf, af);
    if (scored) return scored;
  }
  const form = formEvidence(p.kind, hf, af);
  if (form) return form;
  return h2hEvidence(p.kind, f?.h2hWins ?? 0, f?.h2hDraws ?? 0, f?.h2hLosses ?? 0, f?.h2hN ?? 0);
}

function nEff(p: ScoredPick): number {
  const nH = p.facts?.lastNHome ?? p.facts?.homePlayed ?? 0;
  const nA = p.facts?.lastNAway ?? p.facts?.awayPlayed ?? 0;
  const n = Math.min(nH || 20, nA || 20);
  return Math.max(3, Math.min(20, n || 5));
}

export function pickSignificance(p: ScoredPick, onTen = false, alpha = SIG_ALPHA): PickSignificance {
  const implied = p.implied || (p.odd > 1 ? 1 / p.odd : 0.5);
  const evidence = evidenceFromPick(p);
  const report = evidence ? significanceReport(evidence.k, evidence.n, implied, alpha) : null;
  const edge = edgeZ(p.accuracy, implied, nEff(p));
  const pVal = report ? report.test.pOneGreater : edge.p;
  let verdict: SigVerdict = report?.verdict ?? "underpowered";
  if (!report) {
    if (edge.p != null && edge.p < alpha && p.accuracy > implied) {
      verdict = edge.n >= 12 ? "significant" : "underpowered";
    } else if (edge.p != null && edge.z != null && edge.z < -invNorm(1 - alpha / 2)) {
      verdict = "against";
    } else if (edge.n < 12) {
      verdict = "underpowered";
    } else {
      verdict = "compatible";
    }
  }
  return {
    id: p.id,
    fixture: `${p.home} v ${p.away}`,
    selection: p.selection,
    family: p.family,
    kind: p.kind,
    odd: p.odd,
    implied,
    accuracy: p.accuracy,
    evidence,
    report,
    edge,
    p: pVal,
    verdict,
    onTen,
  };
}

export function cardSignificance(fold: ScoredPick[], rest: ScoredPick[] = [], alpha = SIG_ALPHA): {
  rows: PickSignificance[];
  fdr: FdrRow[];
  bhRejects: number;
  bonferroniRejects: number;
  storeyRejects: number;
  pi0: number;
  storeyThin: boolean;
  m: number;
} {
  const foldIds = new Set(fold.map((p) => p.id));
  const seen = new Set<string>();
  const picks: ScoredPick[] = [];
  for (const p of [...fold, ...rest]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    picks.push(p);
  }
  const rows = picks.map((p) => pickSignificance(p, foldIds.has(p.id), alpha));
  const tested = rows.filter((r) => r.p != null);
  const ps = tested.map((r) => r.p!);
  const bh = benjaminiHochberg(ps, alpha);
  const bon = bonferroni(ps, alpha);
  const storey = storeyReport(ps, STOREY_LAMBDA, alpha);
  const fdr: FdrRow[] = tested.map((r, i) => ({
    id: r.id,
    p: r.p!,
    rank: 0,
    q: storey.q[i]!,
    bhAdjusted: storey.bhAdjusted[i]!,
    bh: bh.reject[i]!,
    storey: storey.rejectQ[i]!,
    bonferroni: bon[i]!,
  }));
  const order = fdr.map((row, i) => ({ i, p: row.p })).sort((a, b) => a.p - b.p);
  order.forEach((o, rank) => {
    fdr[o.i]!.rank = rank + 1;
  });
  return {
    rows,
    fdr,
    bhRejects: bh.reject.filter(Boolean).length,
    bonferroniRejects: bon.filter(Boolean).length,
    storeyRejects: storey.rejectQ.filter(Boolean).length,
    pi0: storey.pi0,
    storeyThin: storey.thin,
    m: ps.length,
  };
}

export function settledBinomial(picks: ScoredPick[]): SignificanceReport | null {
  const scored = picks.filter((p) => p.settled && p.settled.hit != null);
  if (scored.length < 3) return null;
  const k = scored.filter((p) => p.settled!.hit).length;
  const p0 = scored.reduce((s, p) => s + (p.implied || (p.odd > 1 ? 1 / p.odd : 0.5)), 0) / scored.length;
  return significanceReport(k, scored.length, p0);
}

export function powerCurve(p0: number, p1: number, alpha = SIG_ALPHA, maxN = 160): Array<{ n: number; power: number }> {
  const out: Array<{ n: number; power: number }> = [];
  for (const n of [5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 160]) {
    if (n > maxN) break;
    out.push({ n, power: binomialPower(n, p0, p1, alpha) });
  }
  return out;
}

export function fmtP(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p < 0.001) return "<0.1%";
  if (p < 0.01) return `${(p * 100).toFixed(1)}%`;
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
}

export function fmtPct(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(0)}%`;
}

export function fmtInterval(iv: Interval | null | undefined): string {
  if (!iv) return "—";
  return `${(iv.lo * 100).toFixed(0)}–${(iv.hi * 100).toFixed(0)}%`;
}

export function verdictLabel(v: SigVerdict): string {
  if (v === "significant") return "significant";
  if (v === "against") return "against the book";
  if (v === "underpowered") return "underpowered";
  return "compatible with book";
}
