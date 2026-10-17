/**
 * Sharpe / Sortino on betting returns (rf = 0).
 * Per-bet and per-date, never annualised — a football desk is not 252 sessions.
 * Ex-ante uses Bernoulli moments of calibrated P × posted decimal.
 * Sortino & Price 1994: δ = √(Σ min(R−MAR,0)² / n). Desk MAR is cash (0). Winning
 * periods count as 0 — they are not dropped. Semi-deviation (n_loss in the
 * denominator) is the common mistake; it is reported only as a contrast.
 * UPR (Sortino, van der Meer & Plantinga 1999) is mean upside / δ.
 * Omega (Keating & Shadwick 2002) is UPM₁ / LPM₁. Kappa_n (Kaplan & Knowles
 * 2004) is (μ − MAR) / LPM_n^{1/n}: κ₁ restates Omega (Ω = 1 + κ₁), κ₂ is
 * Sortino, κ₃ weights crash tails.
 * PSR: Bailey & López de Prado (2012) P(true Sharpe > 0) given n, skew, kurtosis.
 * DSR: Bailey & López de Prado (2014) deflates PSR for the number of families searched.
 */

export const SHARPE_ROLLING_DATES = 7;
/** Minimum acceptable return for Sortino / UPR / Omega — cash, not a hurdle yield. */
export const SORTINO_MAR = 0;
const EULER_GAMMA = 0.5772156649015329;

export interface BetReturn {
  date: string;
  odd: number;
  y: 0 | 1;
  /** Optional stake as a fraction of bankroll; default 1 unit. */
  stake?: number;
  family?: string;
}

export interface DailyPoint {
  date: string;
  pnl: number;
  equity: number;
}

export interface SharpeReport {
  n: number;
  nDates: number;
  mar: number;
  mean: number;
  std: number;
  downsideStd: number;
  semiDeviation: number;
  lpm1: number;
  sharpe: number | null;
  dailySharpe: number | null;
  rollingSharpe: number | null;
  sortino: number | null;
  dailySortino: number | null;
  rollingSortino: number | null;
  sortinoSemi: number | null;
  upr: number | null;
  omega: number | null;
  kappa1: number | null;
  kappa3: number | null;
  sortinoOverSharpe: number | null;
  nLoss: number;
  lossRate: number;
  meanLoss: number;
  psr: number | null;
  yield: number;
  hitRate: number;
  minTrack: number | null;
  skew: number;
  kurtosis: number;
  maxDrawdown: number;
  daily: DailyPoint[];
}

export interface FamilySharpeRow {
  family: string;
  report: SharpeReport;
}

export interface ExAnteSharpe {
  n: number;
  mu: number;
  sigma: number;
  sharpe: number | null;
  sortino: number | null;
  omega: number | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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

function invNorm(p: number): number {
  const q = clamp(p, 1e-6, 1 - 1e-6);
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  const t = Math.sqrt(-2 * Math.log(q < 0.5 ? q : 1 - q));
  const z = t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
  return q < 0.5 ? -z : z;
}

export function unitReturn(odd: number, y: 0 | 1): number {
  if (!(odd > 1)) return 0;
  return y ? odd - 1 : -1;
}

function moments(xs: number[], mar = SORTINO_MAR): {
  n: number;
  mean: number;
  std: number;
  skew: number;
  kurtosis: number;
  downsideStd: number;
  semiDeviation: number;
  upsideMean: number;
  lpm1: number;
  lpm3: number;
  nLoss: number;
  meanLoss: number;
} {
  const n = xs.length;
  if (!n) {
    return {
      n: 0,
      mean: 0,
      std: 0,
      skew: 0,
      kurtosis: 3,
      downsideStd: 0,
      semiDeviation: 0,
      upsideMean: 0,
      lpm1: 0,
      lpm3: 0,
      nLoss: 0,
      meanLoss: 0,
    };
  }
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  let down = 0;
  let up = 0;
  let lpm1Sum = 0;
  let lpm3Sum = 0;
  let nLoss = 0;
  let lossSum = 0;
  for (const x of xs) {
    const d = x - mean;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
    const short = x - mar;
    if (short < 0) {
      const gap = -short;
      down += short * short;
      lpm1Sum += gap;
      lpm3Sum += gap * gap * gap;
      nLoss += 1;
      lossSum += x;
    } else {
      up += short;
    }
  }
  const varHat = n > 1 ? m2 / (n - 1) : 0;
  const std = Math.sqrt(Math.max(0, varHat));
  const s = Math.sqrt(m2 / n) || 1;
  const skew = n >= 3 ? m3 / n / (s * s * s) : 0;
  const kurtosis = n >= 4 ? m4 / n / (s * s * s * s) : 3;
  /** Sortino & Price 1994: δ = √(Σ min(R−MAR,0)² / n) — winning periods count as 0, not dropped. */
  const downsideStd = Math.sqrt(down / n);
  /** The common mistake: sample std of losing observations only. */
  const semiDeviation = nLoss ? Math.sqrt(down / nLoss) : 0;
  return {
    n,
    mean,
    std,
    skew,
    kurtosis,
    downsideStd,
    semiDeviation,
    upsideMean: up / n,
    lpm1: lpm1Sum / n,
    lpm3: lpm3Sum / n,
    nLoss,
    meanLoss: nLoss ? lossSum / nLoss : 0,
  };
}

export function probabilisticSharpe(
  sharpe: number,
  n: number,
  skew: number,
  kurtosis: number,
  sr0 = 0,
): number | null {
  if (n < 3 || !Number.isFinite(sharpe)) return null;
  const se2 = 1 - skew * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe;
  if (!(se2 > 0)) return null;
  const z = ((sharpe - sr0) * Math.sqrt(n - 1)) / Math.sqrt(se2);
  return clamp(normCdf(z), 0, 1);
}

export function minTrackRecord(
  sharpe: number,
  skew: number,
  kurtosis: number,
  sr0 = 0,
  conf = 0.95,
): number | null {
  if (!(sharpe > sr0)) return null;
  const se2 = 1 - skew * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe;
  if (!(se2 > 0)) return null;
  const z = invNorm(conf);
  const n = 1 + ((z * Math.sqrt(se2)) / (sharpe - sr0)) ** 2;
  return Number.isFinite(n) ? Math.ceil(n) : null;
}

/** Expected max Sharpe of `nTrials` independent strategies (Bailey & LdP 2014). */
export function expectedMaxSharpe(
  n: number,
  nTrials: number,
  sharpe: number,
  skew: number,
  kurtosis: number,
): number | null {
  if (nTrials <= 1 || n < 3) return 0;
  const se2 = 1 - skew * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe;
  if (!(se2 > 0)) return null;
  const srStd = Math.sqrt(se2 / (n - 1));
  const z1 = invNorm(1 - 1 / nTrials);
  const z2 = invNorm(1 - 1 / (nTrials * Math.E));
  return srStd * ((1 - EULER_GAMMA) * z1 + EULER_GAMMA * z2);
}

export function deflatedSharpe(
  sharpe: number,
  n: number,
  skew: number,
  kurtosis: number,
  nTrials: number,
): number | null {
  if (nTrials <= 1) return probabilisticSharpe(sharpe, n, skew, kurtosis, 0);
  const sr0 = expectedMaxSharpe(n, nTrials, sharpe, skew, kurtosis);
  if (sr0 == null) return null;
  return probabilisticSharpe(sharpe, n, skew, kurtosis, sr0);
}

export function maxDrawdown(xs: number[]): number {
  let peak = 0;
  let eq = 0;
  let dd = 0;
  for (const x of xs) {
    eq += x;
    if (eq > peak) peak = eq;
    const drop = peak - eq;
    if (drop > dd) dd = drop;
  }
  return dd;
}

function ratio(num: number, den: number): number | null {
  if (!(den > 1e-12) || !Number.isFinite(num)) return null;
  return num / den;
}

function kappaN(mean: number, mar: number, lpm: number, order: number): number | null {
  if (!(lpm > 1e-18)) return null;
  return ratio(mean - mar, lpm ** (1 / order));
}

export function sharpeFromReturns(xs: number[], dates?: string[], mar = SORTINO_MAR): SharpeReport {
  const m = moments(xs, mar);
  const excess = m.mean - mar;
  const sharpe = ratio(m.mean, m.std);
  const sortino = ratio(excess, m.downsideStd);
  const sortinoSemi = ratio(excess, m.semiDeviation);
  const upr = ratio(m.upsideMean, m.downsideStd);
  const omega = ratio(m.upsideMean, m.lpm1);
  const kappa1 = kappaN(m.mean, mar, m.lpm1, 1);
  const kappa3 = kappaN(m.mean, mar, m.lpm3, 3);
  const sortinoOverSharpe =
    sharpe != null && sortino != null && Math.abs(sharpe) > 1e-12 ? sortino / sharpe : null;
  const hits = xs.filter((x) => x > 0).length;
  const psr = sharpe != null ? probabilisticSharpe(sharpe, m.n, m.skew, m.kurtosis) : null;
  const minTrack = sharpe != null ? minTrackRecord(sharpe, m.skew, m.kurtosis) : null;

  const daily: DailyPoint[] = [];
  let dailySharpe: number | null = null;
  let rollingSharpe: number | null = null;
  let dailySortino: number | null = null;
  let rollingSortino: number | null = null;
  let nDates = dates ? new Set(dates).size : 0;
  if (dates && dates.length === xs.length && nDates >= 1) {
    const byDate = new Map<string, number[]>();
    dates.forEach((d, i) => {
      const arr = byDate.get(d) ?? [];
      arr.push(xs[i]!);
      byDate.set(d, arr);
    });
    const ordered = [...byDate.keys()].sort();
    nDates = ordered.length;
    let eq = 0;
    const pnls: number[] = [];
    for (const d of ordered) {
      const pnl = byDate.get(d)!.reduce((a, b) => a + b, 0);
      eq += pnl;
      pnls.push(pnl);
      daily.push({ date: d, pnl, equity: eq });
    }
    if (nDates >= 2) {
      const dm = moments(pnls, mar);
      dailySharpe = ratio(dm.mean, dm.std);
      dailySortino = ratio(dm.mean - mar, dm.downsideStd);
      const window = pnls.slice(-SHARPE_ROLLING_DATES);
      if (window.length >= 2) {
        const rm = moments(window, mar);
        rollingSharpe = ratio(rm.mean, rm.std);
        rollingSortino = ratio(rm.mean - mar, rm.downsideStd);
      }
    }
  }

  return {
    n: m.n,
    nDates,
    mar,
    mean: m.mean,
    std: m.std,
    downsideStd: m.downsideStd,
    semiDeviation: m.semiDeviation,
    lpm1: m.lpm1,
    sharpe,
    dailySharpe,
    rollingSharpe,
    sortino,
    dailySortino,
    rollingSortino,
    sortinoSemi,
    upr,
    omega,
    kappa1,
    kappa3,
    sortinoOverSharpe,
    nLoss: m.nLoss,
    lossRate: m.n ? m.nLoss / m.n : 0,
    meanLoss: m.meanLoss,
    psr,
    yield: m.mean,
    hitRate: m.n ? hits / m.n : 0,
    minTrack,
    skew: m.skew,
    kurtosis: m.kurtosis,
    maxDrawdown: maxDrawdown(xs),
    daily,
  };
}

export function sharpeFromBets(bets: BetReturn[], mar = SORTINO_MAR): SharpeReport {
  const ordered = [...bets].sort((a, b) => a.date.localeCompare(b.date));
  const xs = ordered.map((b) => (b.stake ?? 1) * unitReturn(b.odd, b.y));
  return sharpeFromReturns(xs, ordered.map((b) => b.date), mar);
}

export function familySharpeReports(bets: BetReturn[], mar = SORTINO_MAR): FamilySharpeRow[] {
  const groups = new Map<string, BetReturn[]>();
  for (const b of bets) {
    const k = b.family ?? "other";
    const arr = groups.get(k) ?? [];
    arr.push(b);
    groups.set(k, arr);
  }
  return [...groups.entries()]
    .map(([family, rows]) => ({ family, report: sharpeFromBets(rows, mar) }))
    .filter((row) => row.report.n >= 2)
    .sort((a, b) => (b.report.sharpe ?? -999) - (a.report.sharpe ?? -999));
}

export function expectedUnitMoments(odd: number, p: number): { mu: number; var: number } {
  const q = clamp(p, 1e-6, 1 - 1e-6);
  if (!(odd > 1)) return { mu: 0, var: 0 };
  const win = odd - 1;
  const mu = q * odd - 1;
  const e2 = q * win * win + (1 - q);
  return { mu, var: Math.max(0, e2 - mu * mu) };
}

export function expectedCardSharpe(
  slips: Array<{ odd: number; p: number; stake?: number }>,
): ExAnteSharpe {
  let mu = 0;
  let v = 0;
  let n = 0;
  let eD = 0;
  let eD2 = 0;
  let eDsq = 0;
  let eU = 0;
  for (const s of slips) {
    const f = s.stake ?? 1;
    if (!(f > 0) || !(s.odd > 1)) continue;
    const m = expectedUnitMoments(s.odd, s.p);
    mu += f * m.mu;
    v += f * f * m.var;
    n += 1;
    const q = 1 - clamp(s.p, 0, 1);
    const p = clamp(s.p, 0, 1);
    eD += q * -f;
    eD2 += q * f * f;
    eDsq += (q * f) * (q * f);
    eU += p * f * (s.odd - 1);
  }
  const sigma = Math.sqrt(Math.max(0, v));
  /** Independent co-losses: E[(Σ min(R_i,0))²] = Σ E[D²] + (Σ E[D])² − Σ (E[D])². */
  const downStd = Math.sqrt(Math.max(0, eD2 + eD * eD - eDsq));
  return {
    n,
    mu,
    sigma,
    sharpe: ratio(mu, sigma),
    sortino: ratio(mu, downStd),
    omega: ratio(eU, -eD),
  };
}

/** Evenly spaced hits, two slips a date — a toy book for the Sortino lab. */
export function syntheticBook(odd: number, p: number, n: number): BetReturn[] {
  const count = Math.max(0, Math.floor(n));
  const hits = Math.max(0, Math.min(count, Math.round(clamp(p, 0, 1) * count)));
  const bets: BetReturn[] = [];
  for (let i = 0; i < count; i++) {
    const day = 1 + Math.floor(i / 2);
    const mm = String(Math.min(28, day)).padStart(2, "0");
    const y: 0 | 1 = Math.floor((i + 1) * hits / count) > Math.floor(i * hits / count) ? 1 : 0;
    bets.push({ date: `2026-09-${mm}`, odd, y });
  }
  return bets;
}

export function fmtSharpe(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "—";
  const sign = s > 0 ? "+" : "";
  return `${sign}${s.toFixed(2)}`;
}

export function fmtPsr(p: number | null): string {
  if (p == null) return "—";
  return `${Math.round(p * 100)}%`;
}

export function fmtDrawdown(dd: number): string {
  if (!Number.isFinite(dd) || dd <= 0) return "0";
  return `${dd.toFixed(dd >= 10 ? 1 : 2)}u`;
}

export function fmtOmega(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "—";
  return s.toFixed(2);
}
