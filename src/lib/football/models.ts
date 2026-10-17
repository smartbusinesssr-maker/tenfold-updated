// @ts-nocheck — restored from compile cache + later patches. Logic is tested.
import { CS_ODDS_BAND, type MarketFamily, type MarketKind, type ModelBreakdown, type ModelName, type ScoreCell } from "./types.ts";
import { finishingShrink, goalMomentum, lambdaLogSe, logLinearLambda } from "./latent.ts";
import {
  asianCoverP,
  asianExpectedReturn,
  asianFromGrid,
  doubleChanceFrom1x2,
  europeanFromGrid,
  parseAhSelection,
  parseCountSelection,
  parseEhSelection,
  poissonOver,
  settleKind,
  teamToScoreFromGrid,
  totalsFromGrid,
  totalCardsLambda,
  oddEvenFromGrid,
  multiGoalsFromGrid,
} from "./markets-engine.ts";
export { quarterKelly, kellyFull } from "./kelly.ts";

export type MaherParams = {
  attackHome: number;
  defenceAway: number;
  attackAway: number;
  defenceHome: number;
  homeAdv: number;
};
export type TauCell = {
  score: string;
  home: number;
  away: number;
  tau: number;
  maher: number;
  dc: number;
  delta: number;
};
export type BmaSource = { id: string; label?: string; p: number; prior: number };

export const DC_RHO = -0.13;
export const DC_RHO_MLE = -0.1285;
export const DC_RHO_TOTALS = -0.1;
export const DC_XI_HALF_WEEK = 0.0065;
export const DC_XI_PER_DAY = DC_XI_HALF_WEEK / 3.5;
export const HOME_ADVANTAGE_ELO = 65;
export const LEAGUE_MEAN_HOME = 1.38;
export const LEAGUE_MEAN_AWAY = 1.12;
export const MAHER_HOME_ADV = LEAGUE_MEAN_HOME / LEAGUE_MEAN_AWAY;
export const MAHER_HOME_ADV_1982 = 1.31;
export const KARLIS_COV = 0.12;
export const LEAGUE_AVG_TEAM = 1.35;
export const MAX_GOALS = 8;
export const HEAT_GOALS = 4;
export const BAIO_KAPPA = 4;
export const BTTS_HIER_KAPPA = 6;
export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
export function poissonPmf(k, lambda) {
  if (k < 0) return 0;
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}
export function poissonPmfArray(lambda, max) {
  const n = Math.max(0, Math.trunc(max));
  const out = new Array(n + 1);
  if (lambda <= 0) {
    out[0] = 1;
    for (let k = 1; k <= n; k++) out[k] = 0;
    return out;
  }
  let p = Math.exp(-Math.max(0, lambda));
  out[0] = p;
  for (let k = 1; k <= n; k++) {
    p *= lambda / k;
    out[k] = p;
  }
  return out;
}

/**
 * Poisson as the desk computes it. P(0) = e^{−λ}, then P(k) = P(k−1)·λ/k.
 * The long sum checks mean = variance = λ. The 0…max slice is what the grid keeps.
 */
export function poissonInvestigate(lambda, max = MAX_GOALS) {
  const lam = Math.max(0, Number(lambda) || 0);
  const cap = Math.max(0, Math.trunc(max));
  const short = poissonPmfArray(lam, cap);
  const longN = Math.max(cap + 8, Math.ceil(lam) + 30);
  const long = poissonPmfArray(lam, longN);
  let covered = 0;
  for (let k = 0; k <= cap; k++) covered += short[k];
  const tail = Math.max(0, 1 - covered);
  let tMean = 0;
  let tSecond = 0;
  for (let k = 0; k <= cap; k++) {
    const p = covered > 0 ? short[k] / covered : 0;
    tMean += k * p;
    tSecond += k * k * p;
  }
  const tVar = Math.max(0, tSecond - tMean * tMean);
  let longMean = 0;
  let longSecond = 0;
  for (let k = 0; k <= longN; k++) {
    longMean += k * long[k];
    longSecond += k * k * long[k];
  }
  const longVar = Math.max(0, longSecond - longMean * longMean);
  let mode = 0;
  for (let k = 1; k <= cap; k++) {
    if (short[k] > short[mode]) mode = k;
  }
  const rows = [];
  for (let k = 0; k <= cap; k++) {
    rows.push({ k, p: short[k], step: k === 0 ? null : lam / k });
  }
  return {
    lambda: lam,
    max: cap,
    rows,
    p0: short[0] ?? 0,
    mode,
    tail,
    truncatedMean: tMean,
    truncatedVar: tVar,
    truncatedVmr: tMean > 1e-12 ? tVar / tMean : 0,
    longMean,
    longVar,
    equidispersion: Math.abs(longMean - lam) < 1e-6 && Math.abs(longVar - lam) < 1e-4,
  };
}

/**
 * Two independent Poisson counts sum to Poisson(λh+λa). No shared-dispersion
 * condition — that was the negative binomial. Given the total, the home goals
 * are Binomial(n, λh / (λh+λa)). The 0…8 grid renormalises, so its Over 2.5
 * is not the infinite sum once λ is large.
 */
export function poissonClosure(lambdaH, lambdaA) {
  const lh = Math.max(0, Number(lambdaH) || 0);
  const la = Math.max(0, Number(lambdaA) || 0);
  const total = lh + la;
  const share = total > 1e-12 ? lh / total : 0.5;
  const n = Math.max(16, Math.ceil(total) + 24);
  const ph = poissonPmfArray(lh, n);
  const pa = poissonPmfArray(la, n);
  const single = poissonPmfArray(total, n);
  const conv = new Array(n + 1).fill(0);
  for (let x = 0; x <= n; x++) {
    const px = ph[x];
    for (let y = 0; y <= n - x; y++) conv[x + y] += px * pa[y];
  }
  let gap = 0;
  for (let k = 0; k <= n; k++) gap = Math.max(gap, Math.abs(conv[k] - single[k]));
  const lines = [0.5, 1.5, 2.5, 3.5].map((line) => {
    const need = Math.floor(line) + 1;
    let under = 0;
    for (let k = 0; k < need && k <= n; k++) under += single[k];
    return { line, over: clamp(1 - under, 0, 1) };
  });
  let mode = 0;
  for (let k = 1; k <= n; k++) if (single[k] > single[mode]) mode = k;
  const pMode = single[mode] || 1;
  const splits = [];
  for (let h = 0; h <= mode; h++) {
    const a = mode - h;
    const joint = (ph[h] ?? 0) * (pa[a] ?? 0);
    splits.push({
      home: h,
      away: a,
      binomial: binomPmf(h, mode, share),
      conditional: joint / pMode,
    });
  }
  const cap = typeof MAX_GOALS === "number" ? MAX_GOALS : 8;
  let mass = 0;
  let overMass = 0;
  for (let x = 0; x <= cap; x++) {
    for (let y = 0; y <= cap; y++) {
      const p = (ph[x] ?? 0) * (pa[y] ?? 0);
      mass += p;
      if (x + y >= 3) overMass += p;
    }
  }
  const rawOver25 = lines[2]?.over ?? 0;
  return {
    total,
    share,
    gap,
    lines,
    mode,
    splits,
    rawOver25,
    truncatedOver25: mass > 0 ? overMass / mass : 0,
    tailLost: Math.max(0, 1 - mass),
  };
}

function binomPmf(k, n, p) {
  if (k < 0 || k > n) return 0;
  const pp = clamp(p, 0, 1);
  let c = 1;
  for (let i = 1; i <= k; i++) c *= (n - k + i) / i;
  return c * Math.pow(pp, k) * Math.pow(1 - pp, n - k);
}

function poissonPrefix(pmf) {
  const cdf = new Array(pmf.length);
  let run = 0;
  for (let i = 0; i < pmf.length; i++) {
    run += pmf[i] ?? 0;
    cdf[i] = run;
  }
  return cdf;
}
export function poissonCdfAtLeast(k, lambda) {
  if (k <= 0) return 1;
  const upto = Math.max(0, k - 1);
  const pmf = poissonPmfArray(lambda, upto);
  let mass = 0;
  for (let i = 0; i <= upto; i++) mass += pmf[i] ?? 0;
  return clamp(1 - mass, 0, 1);
}
export function dcTau(x, y, lh, la, rho) {
  if (x === 0 && y === 0) return 1 - lh * la * rho;
  if (x === 0 && y === 1) return 1 + lh * rho;
  if (x === 1 && y === 0) return 1 + la * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}
export function dcDecay(daysAgo, xi = DC_XI_PER_DAY) {
  return Math.exp(-xi * Math.max(0, daysAgo));
}
export function dcHalfLifeDays(xi = DC_XI_PER_DAY) {
  if (!(xi > 0)) return Number.POSITIVE_INFINITY;
  return Math.LN2 / xi;
}
export function rhoBounds(lambdaH, lambdaA) {
  const lh = Math.max(1e-6, lambdaH);
  const la = Math.max(1e-6, lambdaA);
  return {
    lo: Math.max(-1 / lh, -1 / la) + 1e-4,
    hi: Math.min(1 - 1e-4, 1 / (lh * la) - 1e-4)
  };
}
export function clampRho(rho, lambdaH, lambdaA) {
  const { lo, hi } = rhoBounds(lambdaH, lambdaA);
  return clamp(rho, lo, hi);
}
export const DC_DECAY_HORIZONS = [0, 7, 30, 90, 180, 365, 730];

/**
 * φ(t) = exp(−ξ t) as a weight on two results, not as a likelihood.
 * The daily bug uses 0.0065 per day. The paper divides by 3.5 first.
 */
export function dcDecayTrace() {
  const ages = [0, 3.5, 7, 28, 90, 180, 365, 730];
  const pair = (xi) => {
    const wNew = Math.exp(-xi * 7);
    const wOld = Math.exp(-xi * 365);
    const w = wNew + wOld;
    return { wNew, wOld, mean: (3 * wNew) / w, share: wNew / w };
  };
  return {
    xiDay: DC_XI_PER_DAY,
    halfLife: dcHalfLifeDays(),
    bugHalfLife: dcHalfLifeDays(DC_XI_HALF_WEEK),
    rows: ages.map((days) => ({
      days,
      paper: dcDecay(days),
      dailyBug: dcDecay(days, DC_XI_HALF_WEEK),
    })),
    flatMean: 1.5,
    paperPair: pair(DC_XI_PER_DAY),
    bugPair: pair(DC_XI_HALF_WEEK),
    piYear: 0.55 + 0.45 * dcDecay(365),
    match14: dcDecay(14),
  };
}

export function tauCells(lambdaH, lambdaA, rho) {
  const maherG = jointGrid(lambdaH, lambdaA, 0);
  const dcG = jointGrid(lambdaH, lambdaA, rho);
  const specs = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1]];

  return specs.map(([h, a]) => {
    const maher = maherG[h][a];
    const dc = dcG[h][a];
    return {
      score: `${h}-${a}`,
      home: h,
      away: a,
      tau: dcTau(h, a, lambdaH, lambdaA, rho),
      maher,
      dc,
      delta: dc - maher
    };
  });
}
export function jointGrid(lambdaH, lambdaA, rho = DC_RHO, max = MAX_GOALS) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const g = [];
  let sum = 0;
  for (let x = 0; x <= max; x++) {
    const row = [];
    const px = poissonPmf(x, lh);
    for (let y = 0; y <= max; y++) {
      const v = Math.max(0, px * poissonPmf(y, la) * dcTau(x, y, lh, la, rho));
      row.push(v);
      sum += v;
    }
    g.push(row);
  }
  if (sum > 0) {
    for (let x = 0; x <= max; x++) {
      for (let y = 0; y <= max; y++) g[x][y] /= sum;
    }
  }
  return g;
}

/**
 * What the 0…8 grid actually does with ρ.
 * τ is 1 except on four cells. Those four edits cancel, so Z matches the
 * truncated Maher mass and a cell with τ = 1 does not move.
 */
export function dcGridDetail(lambdaH, lambdaA, rho = DC_RHO) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const used = clampRho(rho, lh, la);
  const max = MAX_GOALS;
  let z = 0;
  let maherMass = 0;
  const raw = [];
  for (let x = 0; x <= max; x++) {
    const px = poissonPmf(x, lh);
    raw[x] = [];
    for (let y = 0; y <= max; y++) {
      const base = px * poissonPmf(y, la);
      const tau = dcTau(x, y, lh, la, used);
      const v = Math.max(0, base * tau);
      raw[x][y] = { tau, base, v };
      z += v;
      maherMass += base;
    }
  }
  const maher = jointGrid(lh, la, 0, max);
  const dc = jointGrid(lh, la, used, max);
  const totals = jointGrid(lh, la, DC_RHO_TOTALS, max);
  const watch = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 0],
  ];
  const margin = (grid, side) => {
    let s = 0;
    for (let y = 0; y <= max; y++) s += side === "home" ? grid[0][y] : grid[y][0];
    return s;
  };
  const slice = (grid) => {
    const m = marketsFromGrid(grid);
    return {
      home: m.home,
      draw: m.draw,
      away: m.away,
      btts: m.bttsYes,
      over15: m.over15,
      over25: m.over25,
      p11: grid[1][1],
    };
  };
  return {
    lh,
    la,
    rho: used,
    z,
    maherMass,
    cells: watch.map(([x, y]) => ({
      score: `${x}-${y}`,
      tau: raw[x][y].tau,
      maher: maher[x][y],
      dc: dc[x][y],
    })),
    home0: { maher: margin(maher, "home"), dc: margin(dc, "home") },
    away0: { maher: margin(maher, "away"), dc: margin(dc, "away") },
    maher: slice(maher),
    dc: slice(dc),
    totals: slice(totals),
  };
}

/**
 * The Dixon–Coles adjustment is one probability.
 * A = −λ μ ρ e^{−(λ+μ)}. Negative ρ adds A to 0-0 and 1-1 and removes A from 1-0 and 0-1.
 * Draw moves by 2A. Home, away, BTTS and Over 1.5 move by A. Over 2.5 does not move.
 * The relative lift on a cell is τ − 1, which is not the same size on each score.
 */
export function dcAdjustment(lambdaH = LEAGUE_MEAN_HOME, lambdaA = LEAGUE_MEAN_AWAY, rho = DC_RHO) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const used = clampRho(rho, lh, la);
  const blank = Math.exp(-(lh + la));
  const gain = -(lh * la * used * blank);
  const grid = dcGridDetail(lh, la, used);
  const moved = (score) => {
    const cell = grid.cells.find((c) => c.score === score);
    return cell.dc - cell.maher;
  };
  return {
    lh,
    la,
    rho: used,
    blank,
    gain,
    totalsGain: -(lh * la * DC_RHO_TOTALS * blank),
    rel: {
      "0-0": -(lh * la * used),
      "1-0": la * used,
      "0-1": lh * used,
      "1-1": -used,
    },
    move00: moved("0-0"),
    move10: moved("1-0"),
    move01: moved("0-1"),
    move11: moved("1-1"),
    draw: grid.dc.draw - grid.maher.draw,
    home: grid.dc.home - grid.maher.home,
    away: grid.dc.away - grid.maher.away,
    btts: grid.dc.btts - grid.maher.btts,
    over15: grid.dc.over15 - grid.maher.over15,
    over25: grid.dc.over25 - grid.maher.over25,
  };
}

/**
 * What is actually estimated.
 * ρ is not refit. The desk freezes −0.13 (a stored −0.1285 sits next to it) and
 * matchRho scales that constant by the expected total. ξ is the 1997 predictive
 * choice, not a maximum of the weighted likelihood.
 * The score for ρ is zero in expectation at the frozen value because the four
 * low-score pulls cancel. Information per match is E[s²].
 */
export function dcEstimate(lambdaH = LEAGUE_MEAN_HOME, lambdaA = LEAGUE_MEAN_AWAY, rho = DC_RHO) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const used = clampRho(rho, lh, la);
  const grid = jointGrid(lh, la, used);
  const scoreAt = (r, x, y) => {
    const t = dcTau(x, y, lh, la, r);
    if (x === 0 && y === 0) return -(lh * la) / t;
    if (x === 1 && y === 0) return la / t;
    if (x === 0 && y === 1) return lh / t;
    if (x === 1 && y === 1) return -1 / t;
    return 0;
  };
  const specs = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  let expectedScore = 0;
  let info = 0;
  let scoreAtZero = 0;
  const parts = specs.map(([x, y]) => {
    const p = grid[x][y];
    const s = scoreAt(used, x, y);
    const pull = p * s;
    expectedScore += pull;
    info += p * s * s;
    scoreAtZero += p * scoreAt(0, x, y);
    return { score: `${x}-${y}`, p, s, pull };
  });
  const pairs = [
    [0.9, 0.7],
    [1.38, 1.12],
    [1.8, 1.6],
  ];
  return {
    rho: used,
    rhoMle: DC_RHO_MLE,
    gap: DC_RHO_MLE - DC_RHO,
    info,
    expectedScore,
    scoreAtZero,
    parts,
    se100: 1 / Math.sqrt(100 * info),
    se400: 1 / Math.sqrt(400 * info),
    se1000: 1 / Math.sqrt(1000 * info),
    schedule: pairs.map(([h, a]) => ({
      total: h + a,
      rho: matchRho(h, a),
    })),
  };
}

/**
 * Attack, defence and home advantage are not separate numbers.
 * λ = α_home × β_away × γ and μ = α_away × β_home. Scaling every attack by k
 * and every defence by 1/k leaves both means, τ and the likelihood unchanged.
 * One Newton step for ρ, if every match followed the frozen model, is score/info
 * evaluated at independence. Under independence that score is 0, so the step stays put.
 */
export function dcParamFit(lambdaH = LEAGUE_MEAN_HOME, lambdaA = LEAGUE_MEAN_AWAY) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const k = 1.2;
  const books = [
    { name: "defence pinned", ah: lh, ba: 1, gamma: 1, aa: la, bh: 1 },
    { name: "attacks × 1.2", ah: lh * k, ba: 1 / k, gamma: 1, aa: la * k, bh: 1 / k },
    { name: "home inside γ", ah: lh / k, ba: 1, gamma: k, aa: la, bh: 1 },
  ].map((row) => ({
    ...row,
    lambdaH: row.ah * row.ba * row.gamma,
    lambdaA: row.aa * row.bh,
  }));
  const scoreAt = (r, x, y) => {
    const t = dcTau(x, y, lh, la, r);
    if (x === 0 && y === 0) return -(lh * la) / t;
    if (x === 1 && y === 0) return la / t;
    if (x === 0 && y === 1) return lh / t;
    if (x === 1 && y === 1) return -1 / t;
    return 0;
  };
  const expect = (rTrue, rEval) => {
    const g = jointGrid(lh, la, rTrue);
    let score = 0;
    let info = 0;
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const p = g[x][y];
      const s = scoreAt(rEval, x, y);
      score += p * s;
      info += p * s * s;
    }
    return { score, info };
  };
  const fromFrozen = expect(DC_RHO, 0);
  const fromIndep = expect(0, 0);
  return {
    books,
    sameMeans: books.every((row) => Math.abs(row.lambdaH - lh) < 1e-12 && Math.abs(row.lambdaA - la) < 1e-12),
    scoreAtZero: fromFrozen.score,
    infoAtZero: fromFrozen.info,
    newton: fromFrozen.score / fromFrozen.info,
    indepScore: fromIndep.score,
    homeResidual: (2 - lh) / lh,
    awayResidual: (1 - la) / la,
  };
}

/**
 * ρ is not the correlation. Negative ρ inflates 0-0 and 1-1 and trims 1-0 and 0-1,
 * which moves the two counts together. Pearson on the goals is then positive.
 * Karlis states the covariance directly: Corr = λ₃ / √(λh λa).
 */
export function dcCorrelation(lambdaH, lambdaA, rho = DC_RHO) {
  const maher = countDependence(jointGrid(lambdaH, lambdaA, 0));
  const dc = countDependence(jointGrid(lambdaH, lambdaA, rho));
  const rates = karlisRates(lambdaH, lambdaA, KARLIS_COV);
  const meanH = rates.l1 + rates.l3;
  const meanA = rates.l2 + rates.l3;
  const karlisPearson = rates.l3 / Math.sqrt(Math.max(1e-12, meanH * meanA));
  return { rho, maher, dc, karlisPearson, karlisCov: rates.l3 };
}

/**
 * Pearson on the goals is −ρ √(λμ) e^{−(λ+μ)}.
 * The factor is about 0.1 at league means, and the sign is opposite ρ.
 * Covariance itself is −λμρ e^{−(λ+μ)}. The 0…8 cap does not move it.
 */
export function dcRhoMap(lambdaH = LEAGUE_MEAN_HOME, lambdaA = LEAGUE_MEAN_AWAY) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const { lo, hi } = rhoBounds(lh, la);
  const factor = Math.sqrt(lh * la) * Math.exp(-(lh + la));
  const specs = [
    { name: "lower edge", rho: lo + 0.01 },
    { name: "frozen", rho: DC_RHO },
    { name: "this match", rho: matchRho(lh, la) },
    { name: "totals", rho: DC_RHO_TOTALS },
    { name: "independent", rho: 0 },
    { name: "upper edge", rho: hi - 0.01 },
  ];
  return {
    factor,
    lo,
    hi,
    rows: specs.map((spec) => {
      const z = dcCorrelation(lh, la, spec.rho);
      return {
        name: spec.name,
        rho: spec.rho,
        cov: z.dc.cov,
        pearson: z.dc.pearson,
        phi: z.dc.phiScore,
        closed: -spec.rho * factor,
      };
    }),
  };
}

function countDependence(grid) {
  let meanH = 0;
  let meanA = 0;
  let secondH = 0;
  let secondA = 0;
  let cross = 0;
  let pHome = 0;
  let pAway = 0;
  let pBoth = 0;
  let pHome0 = 0;
  let pAway0 = 0;
  let p00 = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) {
      const p = row[y] ?? 0;
      meanH += x * p;
      meanA += y * p;
      secondH += x * x * p;
      secondA += y * y * p;
      cross += x * y * p;
      if (x >= 1) pHome += p;
      if (y >= 1) pAway += p;
      if (x >= 1 && y >= 1) pBoth += p;
      if (x === 0) pHome0 += p;
      if (y === 0) pAway0 += p;
      if (x === 0 && y === 0) p00 += p;
    }
  }
  const varH = Math.max(0, secondH - meanH * meanH);
  const varA = Math.max(0, secondA - meanA * meanA);
  const cov = cross - meanH * meanA;
  const denom = Math.sqrt(varH * varA);
  return {
    meanH,
    meanA,
    cov,
    pearson: denom > 1e-12 ? cov / denom : 0,
    varTotal: varH + varA + 2 * cov,
    phiScore: phiBinary(pHome, pAway, pBoth),
    phiBlank: phiBinary(pHome0, pAway0, p00),
  };
}

function phiBinary(pa, pb, joint) {
  const denom = Math.sqrt(Math.max(0, pa * (1 - pa) * pb * (1 - pb)));
  if (denom < 1e-12) return 0;
  return clamp((joint - pa * pb) / denom, -1, 1);
}

/**
 * Karlis correlation is λ₃ / √(μh μa), and it is the same at every score.
 * A fixed shock is a larger correlation when the means are small.
 * The 0…8 grid trims that number. Dixon–Coles does not have this formula.
 */
export function karlisCorrelation(lambdaH, lambdaA, cov = KARLIS_COV) {
  const rates = karlisRates(lambdaH, lambdaA, cov);
  const meanH = rates.l1 + rates.l3;
  const meanA = rates.l2 + rates.l3;
  const pearson = rates.l3 / Math.sqrt(Math.max(1e-12, meanH * meanA));
  const grid = countDependence(bivariateGrid(lambdaH, lambdaA, cov));
  return {
    l1: rates.l1,
    l2: rates.l2,
    l3: rates.l3,
    meanH,
    meanA,
    pearson,
    gridPearson: grid.pearson,
    phiScore: grid.phiScore,
    varDiff: rates.l1 + rates.l2,
    asked: cov,
  };
}

/**
 * Holgate / Karlis bivariate Poisson: X = X₁+X₃, Y = X₂+X₃, three independent Poissons.
 * Margins stay Poisson, so each variance equals its mean. The total does not:
 * Var(X+Y) = λ₁+λ₂+4λ₃. Covariance cannot be negative. λ₃ = 0 is the Maher product,
 * but the desk will not take the shock below 0.02.
 */
export function bivariatePoisson(lambdaH, lambdaA, cov = KARLIS_COV) {
  const { l1, l2, l3 } = karlisRates(lambdaH, lambdaA, cov);
  const meanH = l1 + l3;
  const meanA = l2 + l3;
  const meanTotal = meanH + meanA;
  const varTotal = l1 + l2 + 4 * l3;
  const scores = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [2, 0],
  ];
  const grid = bivariateGrid(lambdaH, lambdaA, cov);
  return {
    l1,
    l2,
    l3,
    meanH,
    meanA,
    varTotal,
    meanTotal,
    vmrTotal: meanTotal > 1e-12 ? varTotal / meanTotal : 0,
    varDiff: l1 + l2,
    p00: Math.exp(-(l1 + l2 + l3)),
    product00: Math.exp(-(meanH + meanA)),
    cells: scores.map(([x, y]) => bivariateCell(l1, l2, l3, meanH, meanA, x, y)),
    margins: [0, 1, 2, 3].map((k) => {
      let gridP = 0;
      const row = grid[k] ?? [];
      for (let y = 0; y < row.length; y++) gridP += row[y] ?? 0;
      return { k, closed: poissonPmf(k, meanH), grid: gridP };
    }),
    floorL3: karlisRates(lambdaH, lambdaA, 0).l3,
    negL3: karlisRates(lambdaH, lambdaA, -0.05).l3,
  };
}

function bivariateCell(l1, l2, l3, meanH, meanA, x, y) {
  const terms = [];
  const kMax = Math.min(x, y);
  let joint = 0;
  for (let k = 0; k <= kMax; k++) {
    const p = poissonPmf(x - k, l1) * poissonPmf(y - k, l2) * poissonPmf(k, l3);
    terms.push({ k, p });
    joint += p;
  }
  const product = poissonPmf(x, meanH) * poissonPmf(y, meanA);
  return { score: `${x}-${y}`, terms, joint, product };
}

/**
 * The shared shock is latent. The score is the observation.
 * P(K=k | x, y) uses the same three Poissons as the bivariate cell.
 * A one-sided score forces K = 0. A 1–1 only rarely was the shared goal.
 */
export function latentShockPosterior(lambdaH, lambdaA, cov = KARLIS_COV) {
  const { l1, l2, l3 } = karlisRates(lambdaH, lambdaA, cov);
  const scores = [
    [0, 0],
    [1, 1],
    [2, 0],
    [2, 2],
  ];
  return {
    prior: l3,
    l1,
    l2,
    scores: scores.map(([x, y]) => shockPosterior(l1, l2, l3, x, y)),
  };
}

function shockPosterior(l1, l2, l3, x, y) {
  const weights = [];
  let mass = 0;
  for (let k = 0; k <= Math.min(x, y); k++) {
    const p = poissonPmf(x - k, l1) * poissonPmf(y - k, l2) * poissonPmf(k, l3);
    weights.push({ k, p });
    mass += p;
  }
  let mean = 0;
  const posterior = weights.map((w) => {
    const prob = mass > 0 ? w.p / mass : 0;
    mean += w.k * prob;
    return { k: w.k, prob };
  });
  return { score: `${x}-${y}`, mean, posterior };
}

/**
 * Trivariate reduction on (home goals, away goals, corners).
 * Seven rates: three private, three pairwise shocks, one triple shock.
 * The same three means and the same three covariances still leave the third cumulant free.
 * Pairwise shocks and a triple shock are not the same joint. Home, away and the goal total
 * are not a trivariate Poisson: the total is not Poisson.
 */
export function trivariatePoisson(lambdaH, lambdaA, cornerMean = 10, cov = KARLIS_COV) {
  const goal = karlisRates(lambdaH, lambdaA, cov);
  const shock = goal.l3;
  const meanH = goal.l1 + goal.l3;
  const meanA = goal.l2 + goal.l3;
  const corners = Math.max(shock * 3, cornerMean);
  const independent = triRates({
    meanH,
    meanA,
    corners,
    l12: shock,
    l1c: 0,
    l2c: 0,
    l123: 0,
  });
  const pairwise = triRates({
    meanH,
    meanA,
    corners,
    l12: shock,
    l1c: shock,
    l2c: shock,
    l123: 0,
  });
  const triple = triRates({
    meanH,
    meanA,
    corners,
    l12: 0,
    l1c: 0,
    l2c: 0,
    l123: shock,
  });
  const scores = [
    [0, 0],
    [1, 1],
    [2, 0],
    [2, 2],
  ];
  return {
    shock,
    meanH,
    meanA,
    corners,
    varTotal: goal.l1 + goal.l2 + 4 * goal.l3,
    meanTotal: meanH + meanA,
    independent: triSummary(independent, scores),
    pairwise: triSummary(pairwise, scores),
    triple: triSummary(triple, scores),
  };
}

function triRates({ meanH, meanA, corners, l12, l1c, l2c, l123 }) {
  return {
    l1: meanH - l12 - l1c - l123,
    l2: meanA - l12 - l2c - l123,
    lc: corners - l1c - l2c - l123,
    l12,
    l1c,
    l2c,
    l123,
  };
}

function triSummary(rates, scores) {
  const meanH = rates.l1 + rates.l12 + rates.l1c + rates.l123;
  const meanA = rates.l2 + rates.l12 + rates.l2c + rates.l123;
  const meanC = rates.lc + rates.l1c + rates.l2c + rates.l123;
  const covHG = rates.l12 + rates.l123;
  const covHC = rates.l1c + rates.l123;
  const covAC = rates.l2c + rates.l123;
  const cells = scores.map(([x, y]) => triCell(rates, x, y));
  return {
    rates,
    covHG,
    covHC,
    covAC,
    kappa: rates.l123,
    corrHC: covHC / Math.sqrt(Math.max(1e-12, meanH * meanC)),
    p11: cells.find((c) => c.score === "1-1").joint,
    cells,
  };
}

function triCell(rates, x, y) {
  let mass = 0;
  let shockMass = 0;
  const byS = new Map();
  const kMax = Math.max(x, y);
  for (let k123 = 0; k123 <= kMax; k123++) {
    for (let k12 = 0; k12 <= kMax; k12++) {
      for (let k1c = 0; k1c <= kMax; k1c++) {
        for (let k2c = 0; k2c <= kMax; k2c++) {
          const hPriv = x - k12 - k1c - k123;
          const aPriv = y - k12 - k2c - k123;
          if (hPriv < 0 || aPriv < 0) continue;
          const p =
            poissonPmf(hPriv, rates.l1) *
            poissonPmf(aPriv, rates.l2) *
            poissonPmf(k12, rates.l12) *
            poissonPmf(k1c, rates.l1c) *
            poissonPmf(k2c, rates.l2c) *
            poissonPmf(k123, rates.l123);
          const s = k1c + k2c + k123;
          mass += p;
          shockMass += p * s;
          byS.set(s, (byS.get(s) ?? 0) + p);
        }
      }
    }
  }
  let over = 0;
  if (mass > 0) {
    for (const [s, p] of byS) over += (p / mass) * poissonAtLeast(rates.lc + s, 10);
  }
  return {
    score: `${x}-${y}`,
    joint: mass,
    meanC: mass > 0 ? rates.lc + shockMass / mass : 0,
    over10: over,
  };
}

function poissonAtLeast(lambda, k) {
  let under = 0;
  for (let i = 0; i < k; i++) under += poissonPmf(i, lambda);
  return Math.max(0, 1 - under);
}

/**
 * Three conditional structures on the same margins.
 * Given the Karlis shock, the counts are independent — the correlation is the shock you did not see.
 * Given an exact total, away goals are what is left, so the correlation is −1 in every model.
 * Dixon–Coles only edits the {0,1} corner. Karlis moves E[away | home] at every home score.
 */
export function conditionalCorrelation(lambdaH, lambdaA, rho = DC_RHO, cov = KARLIS_COV) {
  const maher = jointGrid(lambdaH, lambdaA, 0);
  const dc = jointGrid(lambdaH, lambdaA, rho);
  const karlis = bivariateGrid(lambdaH, lambdaA, cov);
  const rates = karlisRates(lambdaH, lambdaA, cov);
  const cells = [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 2],
    [3, 1],
  ];
  return {
    shockCorr: 0,
    slope: rates.l3 / (rates.l1 + rates.l3),
    bands: {
      all: bandTrio(maher, dc, karlis, () => true),
      under: bandTrio(maher, dc, karlis, (x, y) => x + y <= 2),
      over: bandTrio(maher, dc, karlis, (x, y) => x + y >= 3),
      exact: bandTrio(maher, dc, karlis, (x, y) => x + y === 2),
    },
    givenHome: [0, 1, 2, 3].map((x) => ({
      x,
      maher: condMean(maher, x),
      dc: condMean(dc, x),
      karlis: condMean(karlis, x),
    })),
    ratio: cells.map(([x, y]) => ({
      score: `${x}-${y}`,
      maher: depRatio(maher, x, y),
      dc: depRatio(dc, x, y),
      karlis: depRatio(karlis, x, y),
    })),
    tail: {
      maher: tailLift(maher, 2),
      dc: tailLift(dc, 2),
      karlis: tailLift(karlis, 2),
    },
  };
}

function bandTrio(maher, dc, karlis, keep) {
  return {
    maher: slicePearson(maher, keep),
    dc: slicePearson(dc, keep),
    karlis: slicePearson(karlis, keep),
  };
}

function slicePearson(grid, keep) {
  let mass = 0;
  let meanH = 0;
  let meanA = 0;
  let secondH = 0;
  let secondA = 0;
  let cross = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) {
      if (!keep(x, y)) continue;
      const p = row[y] ?? 0;
      mass += p;
      meanH += x * p;
      meanA += y * p;
      secondH += x * x * p;
      secondA += y * y * p;
      cross += x * y * p;
    }
  }
  if (!(mass > 1e-12)) return 0;
  const mh = meanH / mass;
  const ma = meanA / mass;
  const varH = Math.max(0, secondH / mass - mh * mh);
  const varA = Math.max(0, secondA / mass - ma * ma);
  const denom = Math.sqrt(varH * varA);
  if (denom < 1e-12) return 0;
  return (cross / mass - mh * ma) / denom;
}

function condMean(grid, x) {
  const row = grid[x] ?? [];
  let mass = 0;
  let mean = 0;
  for (let y = 0; y < row.length; y++) {
    const p = row[y] ?? 0;
    mass += p;
    mean += y * p;
  }
  return mass > 1e-12 ? mean / mass : 0;
}

function depRatio(grid, x, y) {
  let pH = 0;
  let pA = 0;
  for (let j = 0; j < grid[x].length; j++) pH += grid[x][j] ?? 0;
  for (let i = 0; i < grid.length; i++) pA += grid[i][y] ?? 0;
  const joint = grid[x][y] ?? 0;
  const indep = pH * pA;
  return indep > 1e-12 ? joint / indep : 0;
}

function tailLift(grid, k) {
  let pX = 0;
  let pY = 0;
  let both = 0;
  for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[x].length; y++) {
      const p = grid[x][y] ?? 0;
      if (x >= k) pX += p;
      if (y >= k) pY += p;
      if (x >= k && y >= k) both += p;
    }
  }
  const cond = pX > 1e-12 ? both / pX : 0;
  return { cond, base: pY, lift: pY > 1e-12 ? cond / pY : 0 };
}

/** Poisson-binomial PMF. Each shot is an independent Bernoulli. Empty list is a sure 0. */
export function poissonBinomialPmf(probs, max = MAX_GOALS) {
  const ps = [];
  const src = Array.isArray(probs) ? probs : [];
  for (const raw of src) {
    if (!Number.isFinite(raw)) continue;
    ps.push(clamp(raw, 0, 1));
  }
  let dp = [1];
  for (const p of ps) {
    const next = new Array(dp.length + 1).fill(0);
    for (let k = 0; k < dp.length; k++) {
      next[k] += dp[k] * (1 - p);
      next[k + 1] += dp[k] * p;
    }
    dp = next;
  }
  const out = new Array(max + 1).fill(0);
  let tail = 0;
  for (let k = 0; k < dp.length; k++) {
    if (k < max) out[k] += dp[k];
    else tail += dp[k];
  }
  out[max] += tail;
  return out;
}

/**
 * Torvaney 2018: a match is not one score. Each shot xG is a Bernoulli.
 * The scoreline probability is the product of the two Poisson-binomials.
 * That grid is the weight Dixon–Coles would put on every (x, y), not a one-hot result.
 */
export function torvaneyXgGrid(homeShots, awayShots, max = MAX_GOALS) {
  const h = poissonBinomialPmf(homeShots, max);
  const a = poissonBinomialPmf(awayShots, max);
  const g = [];
  for (let x = 0; x <= max; x++) {
    const row = [];
    for (let y = 0; y <= max; y++) row.push(h[x] * a[y]);
    g.push(row);
  }
  return g;
}

export function torvaneyGridMean(grid) {
  let home = 0;
  let away = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) {
      const p = row[y];
      home += x * p;
      away += y * p;
    }
  }
  return { home, away };
}

/** Sum of shot xG. Null when the list has no finite probability. This is the Poisson-binomial mean before truncation. */
export function torvaneyMatchRate(shots) {
  if (!Array.isArray(shots) || shots.length === 0) return null;
  let sum = 0;
  let n = 0;
  for (const raw of shots) {
    if (!Number.isFinite(raw)) continue;
    sum += clamp(raw, 0, 1);
    n += 1;
  }
  return n ? sum : null;
}

/** Mean of per-match Torvaney rates. A match with no shots is skipped, not scored as 0-0. */
export function torvaneySideRate(matches) {
  if (!Array.isArray(matches)) return null;
  let sum = 0;
  let n = 0;
  for (const match of matches) {
    const rate = torvaneyMatchRate(match);
    if (rate == null) continue;
    sum += rate;
    n += 1;
  }
  return n ? sum / n : null;
}

/** One match's weighted Dixon–Coles log-likelihood. Weights are the xG grid. */
export function torvaneyDcLogLik(homeShots, awayShots, lambdaH, lambdaA, rho = DC_RHO) {
  const weights = torvaneyXgGrid(homeShots, awayShots);
  const max = weights.length - 1;
  const dc = jointGrid(lambdaH, lambdaA, rho, max);
  let ll = 0;
  for (let x = 0; x <= max; x++) {
    for (let y = 0; y <= max; y++) {
      const w = weights[x][y];
      if (!(w > 0)) continue;
      ll += w * Math.log(Math.max(dc[x][y], 1e-12));
    }
  }
  return ll;
}

export function marketsFromGrid(grid) {
  let home = 0;
  let draw = 0;
  let away = 0;
  let bttsYes = 0;
  let over15 = 0;
  let over25 = 0;
  let bestP = -1;
  let bestH = 1;
  let bestA = 1;
  const scores = [];
  const heat = [];
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) {
      const p = row[y];
      if (x > y) home += p;else
      if (x === y) draw += p;else
      away += p;
      if (x >= 1 && y >= 1) bttsYes += p;
      const tot2 = x + y;
      if (tot2 >= 2) over15 += p;
      if (tot2 >= 3) over25 += p;
      if (p > bestP) {
        bestP = p;
        bestH = x;
        bestA = y;
      }
      scores.push({ score: `${x}-${y}`, p });
      if (x <= HEAT_GOALS && y <= HEAT_GOALS) {
        heat.push({ home: x, away: y, p });
      }
    }
  }
  const tot = home + draw + away || 1;
  scores.sort((a, b) => b.p - a.p);
  const h = home / tot;
  const d = draw / tot;
  const a = away / tot;
  const totals = totalsFromGrid(grid);
  const team = teamToScoreFromGrid(grid);
  const dc = doubleChanceFrom1x2(h, d, a);
  const parity = oddEvenFromGrid(grid);
  const multi01 = multiGoalsFromGrid(grid, { min: 0, max: 1 });
  const multi23 = multiGoalsFromGrid(grid, { min: 2, max: 3 });
  const multi45 = multiGoalsFromGrid(grid, { min: 4, max: 5 });
  const multi6 = multiGoalsFromGrid(grid, { min: 6, max: null });
  return {
    home: h,
    draw: d,
    away: a,
    bttsYes: clamp(bttsYes, 0, 1),
    bttsNo: clamp(1 - bttsYes, 0, 1),
    over15: clamp(over15, 0, 1),
    under15: clamp(1 - over15, 0, 1),
    over25: clamp(over25, 0, 1),
    under25: clamp(1 - over25, 0, 1),
    over05: totals.over05,
    under05: clamp(1 - totals.over05, 0, 1),
    over35: totals.over35,
    under35: clamp(1 - totals.over35, 0, 1),
    over45: totals.over45,
    under45: clamp(1 - totals.over45, 0, 1),
    homeScore: team.homeScore,
    awayScore: team.awayScore,
    dc1x: dc.dc1x,
    dcx2: dc.dcx2,
    dc12: dc.dc12,
    even: parity.even,
    odd: parity.odd,
    multi01,
    multi23,
    multi45,
    multi6,
    scoreline: `${bestH}-${bestA}`,
    scorelineP: clamp(bestP, 0, 1),
    heat,
    topScores: scores.slice(0, 8)
  };
}
export const MIN_CS_CELL = 0.09;
export const CS_PER_FIXTURE = 1;
export const WIN_LAMBDA_GAP = 0.12;
export const WIN_DRAW_MASS_MAX = 0.3;
export const CS_TOP_MARGIN_MIN = 0.01;
export const CS_TOP3_MIN = 0.28;

/** Top-1 / margin / top-3 from marketsFromGrid.topScores. High entropy → NO BET. */
export function csConcentration(topScores) {
  const rows = Array.isArray(topScores) ? topScores : [];
  const p1 = Number(rows[0]?.p) || 0;
  const p2 = Number(rows[1]?.p) || 0;
  const p3 = Number(rows[2]?.p) || 0;
  return { top1: p1, top2: p2, margin: p1 - p2, top3: p1 + p2 + p3 };
}

/** CS cell must live in the grid's 1X2 cluster — 0-2 is not a 68% home. */
export function csAgreesWith1x2(score, home, draw, away) {
  const s = parseScore(score);
  if (!s) return false;
  const h = Number(home) || 0;
  const d = Number(draw) || 0;
  const a = Number(away) || 0;
  if (s.home > s.away && a > h + 0.04) return false;
  if (s.away > s.home && h > a + 0.04) return false;
  if (s.home === s.away && Math.max(h, a) >= 0.58 && d < 0.22) return false;
  return true;
}
export function parseScore(score) {
  const t = score.trim().replace(/[:–—]/g, "-");
  const m = t.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  const home = Number(m[1]);
  const away = Number(m[2]);
  if (
  !Number.isFinite(home) ||
  !Number.isFinite(away) ||
  home < 0 ||
  away < 0 ||
  home > 20 ||
  away > 20)
  {
    return null;
  }
  return { home, away };
}
/** Does this cell belong to the market? 1-0 is not BTTS Yes; 0-1 is not Over 1.5. */
export function scorelineSupportsKind(score, kind) {
  const s = parseScore(score);
  if (!s) return true;
  const tot = s.home + s.away;
  switch (kind) {
    case "btts_yes":
      return s.home >= 1 && s.away >= 1;
    case "btts_no":
      return s.home === 0 || s.away === 0;
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
    case "home":
      return s.home > s.away;
    case "away":
      return s.away > s.home;
    case "draw":
      return s.home === s.away;
    case "dc_1x":
      return s.home >= s.away;
    case "dc_x2":
      return s.away >= s.home;
    case "dc_12":
      return s.home !== s.away;
    case "home_score":
      return s.home >= 1;
    case "away_score":
      return s.away >= 1;
    case "multi_goals":
    case "odd_even":
    case "combo":
      return true;
    default:
      return true;
  }
}
export function gradeMarket(kind, selection, hg, ag, extra?) {
  return settleKind(kind, selection ?? "", hg, ag, extra);
}
/** Opposite result (0-1 vs home, 1-0 vs BTTS Yes). A 1-1 draw does not veto a home lean. */
export function scorelineContradictsKind(score, kind) {
  if (kind === "home" || kind === "away") {
    const s = parseScore(score);
    if (!s) return false;
    return kind === "home" ? s.away > s.home : s.home > s.away;
  }
  return !scorelineSupportsKind(score, kind);
}
/** Hottest cell that actually belongs to this market — what the card should print. */
export function modalScoreForKind(grid, kind) {
  let bestP = -1;
  let bestH = 0;
  let bestA = 0;
  let any = false;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) {
      const p = row[y] ?? 0;
      if (!scorelineSupportsKind(`${x}-${y}`, kind)) continue;
      if (!any || p > bestP) {
        bestP = p;
        bestH = x;
        bestA = y;
        any = true;
      }
    }
  }
  if (!any) {
    return { scoreline: "1-1", scorelineP: 0 };
  }
  return { scoreline: `${bestH}-${bestA}`, scorelineP: clamp(bestP, 0, 1) };
}
export function gridCellP(grid, score) {
  const s = parseScore(score);
  if (!s) return 0;
  return grid[s.home]?.[s.away] ?? 0;
}
export function maherGrid(lambdaH, lambdaA, max = MAX_GOALS) {
  return jointGrid(lambdaH, lambdaA, 0, max);
}
export function maherLambdas(p) {
  return {
    lambdaH: clamp(p.attackHome * p.defenceAway * p.homeAdv, 0.05, 4.2),
    lambdaA: clamp(p.attackAway * p.defenceHome, 0.05, 4.2)
  };
}
export function maherFromLambdas(lambdaH, lambdaA, homeAdv = MAHER_HOME_ADV) {
  const g = Math.max(1.01, homeAdv);
  return {
    attackHome: lambdaH / g,
    defenceAway: 1,
    attackAway: lambdaA,
    defenceHome: 1,
    homeAdv: g
  };
}
export function maherCell(lambdaH, lambdaA, x, y) {
  return poissonPmf(x, lambdaH) * poissonPmf(y, lambdaA);
}
export function maherBttsClosed(lambdaH, lambdaA) {
  return clamp((1 - Math.exp(-lambdaH)) * (1 - Math.exp(-lambdaA)), 0, 1);
}
/** BTTS No is live only when λ, last-5 GF and last-5 H2H all say a clean sheet. Missing ≠ No. */
export function bttsNoAllQuiet(opts) {
  const pois = maherBttsClosed(opts.lambdaH, opts.lambdaA);
  const lambdaNo = pois < 0.48 || Math.min(opts.lambdaH, opts.lambdaA) < 0.9;
  const gfH = opts.homeLast5Gf;
  const gfA = opts.awayLast5Gf;
  const formNo = gfH != null && gfA != null && (gfH <= 0.85 || gfA <= 0.85);
  const h2hNo = (opts.h2hN ?? 0) >= 4 && opts.h2hBtts != null && opts.h2hBtts <= 0.4;
  return lambdaNo && formNo && h2hNo;
}
export function bttsPartsFromGrid(grid) {
  let pHome0 = 0;
  let pAway0 = 0;
  let p00 = 0;
  let btts = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) {
      const p = row[y];
      if (x === 0) pHome0 += p;
      if (y === 0) pAway0 += p;
      if (x === 0 && y === 0) p00 = p;
      if (x >= 1 && y >= 1) btts += p;
    }
  }
  return {
    pHome0,
    pAway0,
    p00,
    btts: clamp(btts, 0, 1),
    exactlyOne: clamp(pHome0 + pAway0 - 2 * p00, 0, 1)
  };
}
export function maherBttsParts(lambdaH, lambdaA) {
  const pHome0 = Math.exp(-lambdaH);
  const pAway0 = Math.exp(-lambdaA);
  const p00 = Math.exp(-(lambdaH + lambdaA));
  const product = (1 - pHome0) * (1 - pAway0);
  return {
    pHome0,
    pAway0,
    p00,
    btts: clamp(1 - pHome0 - pAway0 + p00, 0, 1),
    exactlyOne: clamp(pHome0 + pAway0 - 2 * p00, 0, 1),
    product
  };
}
export function karlisBttsParts(lambdaH, lambdaA, cov = KARLIS_COV) {
  const l3 = clamp(
    Math.min(Math.max(0, cov), 0.28 * Math.min(lambdaH, lambdaA)),
    0,
    0.35
  );
  const pHome0 = Math.exp(-lambdaH);
  const pAway0 = Math.exp(-lambdaA);
  const p00 = Math.exp(-(lambdaH + lambdaA - l3));
  return {
    pHome0,
    pAway0,
    p00,
    btts: clamp(1 - pHome0 - pAway0 + p00, 0, 1),
    exactlyOne: clamp(pHome0 + pAway0 - 2 * p00, 0, 1),
    cov: l3
  };
}
export const FRANK_THETA = 0.8;
export function frankCopula(u, v, theta = FRANK_THETA) {
  const uu = clamp(u, 1e-12, 1 - 1e-12);
  const vv = clamp(v, 1e-12, 1 - 1e-12);
  if (Math.abs(theta) < 1e-6) return uu * vv;
  const et = Math.exp(-theta);
  const inner =
  1 + (Math.exp(-theta * uu) - 1) * (Math.exp(-theta * vv) - 1) / (et - 1);
  if (!(inner > 0)) return uu * vv;
  return clamp(-Math.log(inner) / theta, 0, 1);
}
export function poissonCdf(k, lambda) {
  if (k < 0) return 0;
  const pmf = poissonPmfArray(lambda, k);
  let s = 0;
  for (let i = 0; i <= k; i++) s += pmf[i] ?? 0;
  return clamp(s, 0, 1);
}
function copulaMarginCdf(k, lambda, max) {
  if (k < 0) return 0;
  if (k >= max) return 1;
  return poissonCdf(k, lambda);
}
export function copulaCell(
lambdaH,
lambdaA,
x,
y,
theta = FRANK_THETA,
max = MAX_GOALS)
{
  const Fu = copulaMarginCdf(x, lambdaH, max);
  const Fum = copulaMarginCdf(x - 1, lambdaH, max);
  const Gv = copulaMarginCdf(y, lambdaA, max);
  const Gvm = copulaMarginCdf(y - 1, lambdaA, max);
  return Math.max(
    0,
    frankCopula(Fu, Gv, theta) -
    frankCopula(Fum, Gv, theta) -
    frankCopula(Fu, Gvm, theta) +
    frankCopula(Fum, Gvm, theta)
  );
}
export function copulaGrid(lambdaH, lambdaA, theta = FRANK_THETA, max = MAX_GOALS) {
  const g = [];
  let sum = 0;
  for (let x = 0; x <= max; x++) {
    const row = [];
    for (let y = 0; y <= max; y++) {
      const v = copulaCell(lambdaH, lambdaA, x, y, theta, max);
      row.push(v);
      sum += v;
    }
    g.push(row);
  }
  if (sum > 0) {
    for (let x = 0; x <= max; x++) {
      for (let y = 0; y <= max; y++) g[x][y] /= sum;
    }
  }
  return g;
}
export function copulaBtts(lambdaH, lambdaA, theta = FRANK_THETA) {
  const f0 = Math.exp(-lambdaH);
  const g0 = Math.exp(-lambdaA);
  const p00 = frankCopula(f0, g0, theta);
  return clamp(1 - f0 - g0 + p00, 0, 1);
}
export function copulaBttsParts(lambdaH, lambdaA, theta = FRANK_THETA) {
  const pHome0 = Math.exp(-lambdaH);
  const pAway0 = Math.exp(-lambdaA);
  const p00 = frankCopula(pHome0, pAway0, theta);
  return {
    pHome0,
    pAway0,
    p00,
    btts: clamp(1 - pHome0 - pAway0 + p00, 0, 1),
    exactlyOne: clamp(pHome0 + pAway0 - 2 * p00, 0, 1),
    theta
  };
}

const JOINT_SCORES = ["0-0", "1-0", "0-1", "1-1", "2-0", "2-1"];

/**
 * Karlis is not a copula. X = X₁+X₃, Y = X₂+X₃, three independent Poissons, Cov = λ₃.
 * The shock cancels in the goal difference, so Var(X−Y) = λ₁+λ₂ = λh+λa−2λ₃.
 * Frank is the copula: a cell is the C rectangle on the Poisson CDFs. θ = 0 is independence.
 * Both can lift 0-0 and BTTS. They do not move 1-1 and 2-0 by the same amount.
 * The score grid floors λ₃ at 0.02. The closed BTTS formula does not.
 * Does not rank the ten.
 */
export function jointDependence(lambdaH, lambdaA, cov = KARLIS_COV, theta = FRANK_THETA) {
  const rates = karlisRates(lambdaH, lambdaA, cov);
  const closed = karlisBttsParts(lambdaH, lambdaA, cov);
  const maherG = maherGrid(lambdaH, lambdaA);
  const karlisG = bivariateGrid(lambdaH, lambdaA, cov);
  const frankG = copulaGrid(lambdaH, lambdaA, theta);
  const take = (g) => {
    const m = marketsFromGrid(g);
    const b = bttsPartsFromGrid(g);
    return {
      p00: g[0][0],
      p11: g[1][1],
      p20: g[2][0],
      btts: b.btts,
      draw: m.draw,
      over25: m.over25
    };
  };
  return {
    lambdaH,
    lambdaA,
    covAsked: cov,
    theta,
    l1: rates.l1,
    l2: rates.l2,
    l3: rates.l3,
    closedL3: closed.cov,
    marginHome: rates.l1 + rates.l3,
    marginAway: rates.l2 + rates.l3,
    gdVarIndep: lambdaH + lambdaA,
    gdVarKarlis: rates.l1 + rates.l2,
    maher: take(maherG),
    karlis: take(karlisG),
    frank: take(frankG),
    cells: JOINT_SCORES.map((score) => {
      const [x, y] = score.split("-").map(Number);
      return { score, maher: maherG[x][y], karlis: karlisG[x][y], frank: frankG[x][y] };
    })
  };
}
export function goddardBtts(opts) {
  return hierarchicalBtts(opts).partial;
}
function betaMomentInterval(alpha, betaPar) {
  const m = alpha / (alpha + betaPar);
  const v = m * (1 - m) / (alpha + betaPar + 1);
  const s = Math.sqrt(Math.max(0, v));
  return { lo: clamp(m - 1.96 * s, 0, 1), hi: clamp(m + 1.96 * s, 0, 1) };
}
export function hierarchicalBtts(opts) {
  const poisson = maherBttsClosed(opts.lambdaH, opts.lambdaA);
  const league = maherBttsClosed(opts.leagueHome, opts.leagueAway);
  const kappa = Math.max(0.25, opts.kappa ?? BTTS_HIER_KAPPA);
  const tau = opts.tau ?? 0.35;
  const n = Math.max(0, opts.h2hN);
  const hits = clamp(opts.h2hHits, 0, n);
  const hyperMean = poisson;
  const h2h = n > 0 ? hits / n : null;
  const noPooling = h2h ?? poisson;
  const completePooling = league;
  const alpha = kappa * hyperMean + hits;
  const betaPar = kappa * (1 - hyperMean) + (n - hits);
  const partial = alpha / (alpha + betaPar);
  const { lo, hi } = betaMomentInterval(alpha, betaPar);
  const logitPartial = logitPartialPool(noPooling, hyperMean, n, tau);
  return {
    poisson,
    league,
    hyperMean,
    h2h,
    noPooling,
    completePooling,
    partial: clamp(partial, 0.02, 0.95),
    logitPartial: clamp(logitPartial, 0.02, 0.95),
    weightData: n / (n + kappa),
    kappa,
    alpha,
    beta: betaPar,
    lo,
    hi
  };
}
export function logitPartialPool(y, mu, n, tau = 0.35) {
  const p = clamp(y, 0.001, 0.999);
  const m = clamp(mu, 0.001, 0.999);
  if (n <= 0) return m;
  const sigma = 1 / Math.sqrt(Math.max(n * p * (1 - p), 0.08));
  const w = tau * tau / (tau * tau + sigma * sigma);
  return invLogit((1 - w) * logit(m) + w * logit(p));
}
export function structuralBttsP(dc, copula, karlis, goddard) {
  return clamp(
    0.4 * dc + 0.22 * copula + 0.16 * karlis + 0.22 * goddard,
    0.02,
    0.95
  );
}
export function maherOver25Closed(lambdaH, lambdaA) {
  let under = 0;
  for (let x = 0; x <= 2; x++) {
    for (let y = 0; y <= 2 - x; y++) under += maherCell(lambdaH, lambdaA, x, y);
  }
  return clamp(1 - under, 0, 1);
}
export const DESK_MAHER_PARAMS = {
  attackHome: LEAGUE_MEAN_HOME / MAHER_HOME_ADV,
  defenceAway: 1,
  attackAway: LEAGUE_MEAN_AWAY,
  defenceHome: 1,
  homeAdv: MAHER_HOME_ADV
};
export const PAPER_MAHER_PARAMS = {
  attackHome: 1,
  defenceAway: 1,
  attackAway: 1,
  defenceHome: 1,
  homeAdv: MAHER_HOME_ADV_1982
};

/**
 * The independent baseline. Desk λ factors as attack × defence × home advantage
 * with both defences set to 1. The 1982 average is attack = defence = 1 and γ = 1.31.
 * Cells are the product of two Poissons. Totals use this grid at weight 0.10.
 */
export function maherBaseline() {
  const take = (params) => {
    const { lambdaH, lambdaA } = maherLambdas(params);
    const parts = maherBttsParts(lambdaH, lambdaA);
    const grid = maherGrid(lambdaH, lambdaA);
    const m = marketsFromGrid(grid);
    const p1h = poissonPmf(1, lambdaH);
    const p1a = poissonPmf(1, lambdaA);
    return {
      lambdaH,
      lambdaA,
      total: lambdaH + lambdaA,
      gamma: params.homeAdv,
      p00: parts.p00,
      btts: parts.btts,
      exactlyOne: parts.exactlyOne,
      over15: maherOver15(lambdaH, lambdaA),
      over25: maherOver25Closed(lambdaH, lambdaA),
      cell11: maherCell(lambdaH, lambdaA, 1, 1),
      product11: p1h * p1a,
      grid: {
        home: m.home,
        draw: m.draw,
        away: m.away,
        btts: m.bttsYes,
        over25: m.over25,
        p00: grid[0][0],
        p11: grid[1][1],
      },
      skellam: skellam1x2(lambdaH, lambdaA),
    };
  };
  return {
    ouWeight: 0.1,
    attackHome: DESK_MAHER_PARAMS.attackHome,
    desk: take(DESK_MAHER_PARAMS),
    paper: take(PAPER_MAHER_PARAMS),
  };
}






















export function karlisRates(lambdaH, lambdaA, cov = KARLIS_COV) {
  const l3 = clamp(
    Math.min(cov, 0.28 * Math.min(lambdaH, lambdaA)),
    0.02,
    0.35
  );
  return {
    l1: Math.max(0.05, lambdaH - l3),
    l2: Math.max(0.05, lambdaA - l3),
    l3
  };
}
export function bivariateGrid(lambdaH, lambdaA, cov = KARLIS_COV, max = MAX_GOALS) {
  const { l1, l2, l3 } = karlisRates(lambdaH, lambdaA, cov);
  const g = [];
  let sum = 0;
  for (let x = 0; x <= max; x++) {
    const row = [];
    for (let y = 0; y <= max; y++) {
      let v = 0;
      const kMax = Math.min(x, y);
      for (let k = 0; k <= kMax; k++) {
        v += poissonPmf(x - k, l1) * poissonPmf(y - k, l2) * poissonPmf(k, l3);
      }
      row.push(v);
      sum += v;
    }
    g.push(row);
  }
  if (sum > 0) {
    for (let x = 0; x <= max; x++) {
      for (let y = 0; y <= max; y++) g[x][y] /= sum;
    }
  }
  return g;
}
export function negBinGrid(lambdaH, lambdaA, r, max = MAX_GOALS) {
  const g = [];
  let sum = 0;
  for (let x = 0; x <= max; x++) {
    const row = [];
    const px = negBinPmf(x, lambdaH, r);
    for (let y = 0; y <= max; y++) {
      const v = px * negBinPmf(y, lambdaA, r);
      row.push(v);
      sum += v;
    }
    g.push(row);
  }
  if (sum > 0) {
    for (let x = 0; x <= max; x++) {
      for (let y = 0; y <= max; y++) g[x][y] /= sum;
    }
  }
  return g;
}
export function tiltGridTo1x2(grid, pHome, pDraw, pAway) {
  const hT = clamp(pHome, 0.05, 0.9);
  const dT = clamp(pDraw, 0.05, 0.6);
  const aT = clamp(pAway, 0.05, 0.9);
  const tsum = hT + dT + aT || 1;
  const th = hT / tsum;
  const td = dT / tsum;
  const ta = aT / tsum;
  let h = 0;
  let d = 0;
  let a = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) {
      const p = row[y];
      if (x > y) h += p;else
      if (x === y) d += p;else
      a += p;
    }
  }
  const sh = th / (h || 1e-9);
  const sd = td / (d || 1e-9);
  const sa = ta / (a || 1e-9);
  const out = grid.map((row) => row.slice());
  let sum = 0;
  for (let x = 0; x < out.length; x++) {
    for (let y = 0; y < out[x].length; y++) {
      const s = x > y ? sh : x === y ? sd : sa;
      out[x][y] *= s;
      sum += out[x][y];
    }
  }
  if (sum > 0) {
    for (let x = 0; x < out.length; x++) {
      for (let y = 0; y < out[x].length; y++) out[x][y] /= sum;
    }
  }
  return out;
}
function scaleGridPartition(grid, pred, target) {
  const t = clamp(target, 0.04, 0.96);
  let yes = 0;
  let no = 0;
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) {
      if (pred(x, y)) yes += row[y];else
      no += row[y];
    }
  }
  const sy = t / (yes || 1e-9);
  const sn = (1 - t) / (no || 1e-9);
  for (let x = 0; x < grid.length; x++) {
    const row = grid[x];
    for (let y = 0; y < row.length; y++) row[y] *= pred(x, y) ? sy : sn;
  }
}
export function rakeGrid(grid, targets, rounds = 6) {
  let out = grid.map((row) => row.slice());
  const has1x2 =
  targets.home != null && targets.draw != null && targets.away != null;
  for (let r = 0; r < rounds; r++) {
    if (has1x2) {
      out = tiltGridTo1x2(out, targets.home, targets.draw, targets.away);
    }
    if (targets.over25 != null)
    scaleGridPartition(out, (x, y) => x + y >= 3, targets.over25);
    if (targets.over15 != null)
    scaleGridPartition(out, (x, y) => x + y >= 2, targets.over15);
    if (targets.btts != null)
    scaleGridPartition(out, (x, y) => x >= 1 && y >= 1, targets.btts);
  }
  let sum = 0;
  for (const row of out) for (const v of row) sum += v;
  if (sum > 0) {
    for (const row of out) {
      for (let y = 0; y < row.length; y++) row[y] /= sum;
    }
  }
  return out;
}
export const UNION_WEIGHTS = {
  dc: 0.5,
  karlis: 0.2,
  copula: 0.14,
  negBin: 0.08,
  elo: 0.08
};
export const UNION_RAKE_ALPHA = 0.4;
function gridDim(parts) {
  let n = 0;
  for (const p of parts) n = Math.max(n, p.grid.length);
  return Math.max(0, n - 1);
}
function renormalizeGrid(grid) {
  let sum = 0;
  for (const row of grid) for (const v of row) sum += v;
  if (sum > 0) {
    for (const row of grid) {
      for (let y = 0; y < row.length; y++) row[y] /= sum;
    }
  }
  return grid;
}
export function mixGrids(parts) {
  const max = gridDim(parts);
  const totW = parts.reduce((a, p) => a + p.w, 0) || 1;
  const out = [];
  for (let x = 0; x <= max; x++) {
    const row = [];
    for (let y = 0; y <= max; y++) {
      let v = 0;
      for (const p of parts) v += p.w / totW * (p.grid[x]?.[y] ?? 0);
      row.push(v);
    }
    out.push(row);
  }
  return renormalizeGrid(out);
}
export function logPoolResult(parts, floor = 1e-12) {
  const max = gridDim(parts);
  const cleaned = parts.map((p) => ({ grid: p.grid, w: Math.max(0, p.w) }));
  const totW = cleaned.reduce((a, p) => a + p.w, 0) || 1;
  const raw = [];
  let z = 0;
  for (let x = 0; x <= max; x++) {
    const row = [];
    for (let y = 0; y <= max; y++) {
      let log = 0;
      for (const p of cleaned) {
        log += p.w / totW * Math.log(Math.max(floor, p.grid[x]?.[y] ?? 0));
      }
      const v = Math.exp(log);
      row.push(v);
      z += v;
    }
    raw.push(row);
  }
  const grid = raw.map((row) => row.map((v) => z > 0 ? v / z : v));
  return { grid, z, entropy: gridEntropy(grid) };
}
export function logPoolGrids(parts, floor = 1e-12) {
  return logPoolResult(parts, floor).grid;
}
export function gridEntropy(grid) {
  let h = 0;
  for (const row of grid) {
    for (const p of row) {
      if (p > 0) h -= p * Math.log(p);
    }
  }
  return h;
}
export function gridKL(p, q, floor = 1e-12) {
  const max = Math.max(p.length, q.length) - 1;
  let s = 0;
  for (let x = 0; x <= max; x++) {
    for (let y = 0; y <= max; y++) {
      const pi = p[x]?.[y] ?? 0;
      if (pi <= 0) continue;
      s += pi * Math.log(pi / Math.max(floor, q[x]?.[y] ?? 0));
    }
  }
  return s;
}
export function likelihoodUpdate(grid, L) {
  const out = grid.map((row, x) =>
  row.map((v, y) => Math.max(0, v * Math.max(0, L(x, y))))
  );
  return renormalizeGrid(out);
}
export function logPoolOddsRatio(parts, a, b, floor = 1e-12) {
  const totW = parts.reduce((s, p) => s + p.w, 0) || 1;
  let log = 0;
  for (const p of parts) {
    const pa = Math.max(floor, p.grid[a.x]?.[a.y] ?? 0);
    const pb = Math.max(floor, p.grid[b.x]?.[b.y] ?? 0);
    log += p.w / totW * Math.log(pa / pb);
  }
  return Math.exp(log);
}
export function logPoolStats(parts) {
  const totW = parts.reduce((a, p) => a + p.w, 0) || 1;
  const pooled = logPoolResult(parts);
  const linear = mixGrids(parts);
  let toExp = 0;
  let fromExp = 0;
  for (const p of parts) {
    const w = p.w / totW;
    toExp += w * gridKL(pooled.grid, p.grid);
    fromExp += w * gridKL(p.grid, pooled.grid);
  }
  return {
    z: pooled.z,
    entropy: pooled.entropy,
    linearEntropy: gridEntropy(linear),
    meanKlToExperts: toExp,
    meanKlFromExperts: fromExp
  };
}
export function logPoolBinary(parts) {
  let totW = 0;
  let logY = 0;
  let logN = 0;
  for (const part of parts) {
    const w = Math.max(0, part.w);
    if (w <= 0) continue;
    totW += w;
    const p = clamp(part.p, 1e-12, 1 - 1e-12);
    logY += w * Math.log(p);
    logN += w * Math.log(1 - p);
  }
  if (totW <= 0) return 0.5;
  logY /= totW;
  logN /= totW;
  const y = Math.exp(logY);
  const n = Math.exp(logN);
  return y / (y + n);
}
export function fuseScoreReport(opts) {
  const w = UNION_WEIGHTS;
  const parts = [
  { grid: opts.dc, w: w.dc },
  { grid: opts.karlis, w: w.karlis },
  { grid: opts.copula, w: w.copula },
  { grid: opts.negBin, w: w.negBin },
  { grid: opts.elo, w: w.elo }];

  const stats = logPoolStats(parts);
  const model = logPoolResult(parts).grid;
  const shin = opts.shin;
  if (!shin) return { grid: model, stats };
  const a = clamp(opts.alpha ?? UNION_RAKE_ALPHA, 0, 1);
  if (a <= 0) return { grid: model, stats };
  const book = rakeGrid(
    model,
    {
      home: shin.home,
      draw: shin.draw,
      away: shin.away,
      over25: shin.over25,
      over15: shin.over15,
      btts: shin.btts
    },
    8
  );
  if (a >= 1) return { grid: book, stats };
  return {
    grid: logPoolGrids([
    { grid: model, w: 1 - a },
    { grid: book, w: a }]
    ),
    stats
  };
}
export function fuseScoreGrid(opts) {
  return fuseScoreReport(opts).grid;
}
export function isPlayableCsScore(score) {
  const s = parseScore(score);
  if (!s) return false;
  if (s.home > 3 || s.away > 3) return false;
  return s.home + s.away <= 4;
}
export function structuralCsP(dc, karlis, maher, negBin, copula = dc) {
  void maher;
  return clamp(
    0.58 * dc + 0.2 * karlis + 0.16 * copula + 0.06 * negBin,
    0.001,
    0.55
  );
}
export function shinCsImplied(posted, grid) {
  const byScore = new Map();
  for (const row of posted) {
    const s = parseScore(row.score);
    if (!s || !(row.odd > 1)) continue;
    const key = `${s.home}-${s.away}`;
    const arr = byScore.get(key) ?? [];
    arr.push(row.odd);
    byScore.set(key, arr);
  }
  const scores = [];
  const odds = [];
  for (const [score, os] of byScore) {
    const med = median(os);
    if (med == null) continue;
    scores.push(score);
    odds.push(med);
  }
  const out = new Map();
  if (!odds.length) return out;
  let postedModel = 0;
  for (const score of scores) postedModel += gridCellP(grid, score);
  const tail = clamp(1 - postedModel, 0.02, 0.28);
  const rawSum = odds.reduce((a, o) => a + 1 / o, 0);
  if (rawSum > 1.001) {
    const probs = shinInvert(odds);
    const mass = 1 - tail;
    scores.forEach((score, i) => out.set(score, (probs[i] ?? 0) * mass));
  } else {
    scores.forEach((score, i) => out.set(score, 1 / (odds[i] ?? 1)));
  }
  return out;
}
export const ZI_SKELLAM_PI = 0.05;
export const DIAG_INFLATE_P = 0.05;
export const ZIP_PI = 0.05;
export const WIN_HIER_KAPPA = 5;
export const OU_HIER_KAPPA = 6;

/**
 * Two-level hierarchy the desk already runs.
 * Goals pull toward the league mean. BTTS is a Beta–Binomial on top of that Poisson probability.
 * The hypermean is plugged in, not given its own posterior.
 */
export function hierarchicalTrace(observed = 2.4) {
  const leagueH = LEAGUE_MEAN_HOME;
  const leagueA = LEAGUE_MEAN_AWAY;
  const pull = (n, k) => (n * observed + k * leagueH) / (n + k);
  const bttsAt = (n, hits, kappa = BTTS_HIER_KAPPA) => {
    const h = hierarchicalBtts({
      lambdaH: leagueH,
      lambdaA: leagueA,
      leagueHome: leagueH,
      leagueAway: leagueA,
      h2hHits: hits,
      h2hN: n,
      kappa,
    });
    return {
      n,
      hits,
      kappa,
      prior: h.hyperMean,
      noPooling: h.noPooling,
      partial: h.partial,
      logit: h.logitPartial,
      weight: h.weightData,
      lo: h.lo,
      hi: h.hi,
    };
  };
  return {
    observed,
    leagueH,
    lambda: [
      { id: "thin", n: 5, k: 6, lambda: pull(5, 6) },
      { id: "last5", n: 8, k: 2.2, lambda: pull(8, 2.2) },
      { id: "season", n: 16, k: BAIO_KAPPA, lambda: pull(16, BAIO_KAPPA) },
    ],
    perfect: [0, 2, 5, 10, 20].map((n) => bttsAt(n, n)),
    blank5: bttsAt(5, 0),
    win5: bttsAt(5, 5, WIN_HIER_KAPPA),
  };
}

export const WEIBULL_SHAPE = 0.9;
export const POLYA_RHO = 0.88;
export const YIP_GOAL_VMR = 1.04;
export const YIP_CORNER_VMR = 1.19;
export function logBesselI(n, x) {
  const nu = Math.abs(Math.trunc(n));
  const ax = Math.abs(x);
  if (ax < 1e-12) return nu === 0 ? 0 : Number.NEGATIVE_INFINITY;
  let logTerm = 0;
  for (let i = 1; i <= nu; i++) logTerm += Math.log(ax / (2 * i));
  let maxLog = logTerm;
  const logs = [logTerm];
  for (let k = 1; k < 140; k++) {
    logTerm += 2 * Math.log(ax) - Math.log(4 * k * (k + nu));
    logs.push(logTerm);
    if (logTerm > maxLog) maxLog = logTerm;
    if (logTerm < maxLog - 34 && k > nu + 4) break;
  }
  let sum = 0;
  for (const lt of logs) sum += Math.exp(lt - maxLog);
  return maxLog + Math.log(sum);
}
export function skellamLogPmf(k, lambdaH, lambdaA) {
  const lh = Math.max(1e-8, lambdaH);
  const la = Math.max(1e-8, lambdaA);
  const n = Math.abs(Math.trunc(k));
  const x = 2 * Math.sqrt(lh * la);
  return -(lh + la) + 0.5 * k * Math.log(lh / la) + logBesselI(n, x);
}
export function skellamPmf(k, lambdaH, lambdaA) {
  const lp = skellamLogPmf(k, lambdaH, lambdaA);
  return lp < -40 ? 0 : Math.exp(lp);
}
export function skellamConvPmf(k, lambdaH, lambdaA, max = 28) {
  const kk = Math.trunc(k);
  const n = Math.abs(kk);
  const cap = max + n;
  const ph = poissonPmfArray(lambdaH, cap);
  const pa = poissonPmfArray(lambdaA, cap);
  let s = 0;
  if (kk >= 0) {
    for (let y = 0; y <= max; y++) s += (ph[y + n] ?? 0) * (pa[y] ?? 0);
  } else {
    for (let x = 0; x <= max; x++) s += (ph[x] ?? 0) * (pa[x + n] ?? 0);
  }
  return s;
}
export function skellamDrawConv(lambdaH, lambdaA, max = 24) {
  return skellamConvPmf(0, lambdaH, lambdaA, max);
}
function poissonSplit(pmf, cdf, t) {
  const max = pmf.length - 1;
  if (t < 0) return { lt: 0, eq: 0, gt: 1 };
  if (t > max) return { lt: 1, eq: 0, gt: 0 };
  const eq = pmf[t] ?? 0;
  const lt = t === 0 ? 0 : cdf[t - 1] ?? 0;
  const gt = clamp(1 - (cdf[t] ?? 0), 0, 1);
  return { lt, eq, gt };
}
export function poissonConv1x2(
lambdaH,
lambdaA,
homeShift = 0,
awayShift = 0,
maxK = 24)
{
  return countConv1x2(
    poissonPmfArray(lambdaH, maxK),
    poissonPmfArray(lambdaA, maxK),
    homeShift,
    awayShift
  );
}
function countConv1x2(ph, pa, homeShift = 0, awayShift = 0) {
  const cdf = poissonPrefix(ph);
  const maxK = Math.min(ph.length, pa.length) - 1;
  const h0 = Math.trunc(homeShift);
  const a0 = Math.trunc(awayShift);
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let y = 0; y <= maxK; y++) {
    const py = pa[y] ?? 0;
    const t = y + a0 - h0;
    const sp = poissonSplit(ph, cdf, t);
    home += py * sp.gt;
    draw += py * sp.eq;
    away += py * sp.lt;
  }
  const s = home + draw + away || 1;
  return { home: home / s, draw: draw / s, away: away / s };
}
export function skellamMoments(lambdaH, lambdaA) {
  const lh = Math.max(1e-8, lambdaH);
  const la = Math.max(1e-8, lambdaA);
  const mean = lh - la;
  const variance = lh + la;
  const sd = Math.sqrt(variance);
  return {
    mean,
    variance,
    sd,
    skewness: mean / (sd * sd * sd),
    excessKurtosis: 1 / variance
  };
}
export function skellamFromMeanVar(mean, variance) {
  const v = Math.max(Math.abs(mean) + 1e-6, variance);
  return {
    lambdaH: clamp((v + mean) / 2, 0.05, 4.2),
    lambdaA: clamp((v - mean) / 2, 0.05, 4.2)
  };
}
function stdNormCdf(z) {
  const ax = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * ax);
  const d = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const p =
  d *
  t * (
  0.31938153 +
  t * (
  -0.356563782 +
  t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}
export function skellamNormal1x2(lambdaH, lambdaA) {
  const m = skellamMoments(lambdaH, lambdaA);
  const s = Math.max(1e-6, m.sd);
  const away = stdNormCdf((-0.5 - m.mean) / s);
  const upToDraw = stdNormCdf((0.5 - m.mean) / s);
  const draw = clamp(upToDraw - away, 0.02, 0.6);
  const home = clamp(1 - upToDraw, 0.04, 0.92);
  const tot = home + draw + away || 1;
  return { home: home / tot, draw: draw / tot, away: away / tot };
}
export function skellam1x2(lambdaH, lambdaA, maxK = 24) {
  return poissonConv1x2(lambdaH, lambdaA, 0, 0, maxK);
}
export function karlisSkellam1x2(lambdaH, lambdaA, cov = KARLIS_COV) {
  const r = karlisRates(lambdaH, lambdaA, cov);
  return skellam1x2(r.l1, r.l2);
}
export function ziSkellam1x2(lambdaH, lambdaA, pi = ZI_SKELLAM_PI) {
  const base = skellam1x2(lambdaH, lambdaA);
  const p = clamp(pi, 0, 0.25);
  const keep = 1 - p;
  const home = keep * base.home;
  const away = keep * base.away;
  const draw = p + keep * base.draw;
  const s = home + draw + away || 1;
  return { home: home / s, draw: draw / s, away: away / s };
}

/** π̂ = (observed draw − Skellam draw) / (1 − Skellam draw). A shortfall returns 0: the desk cannot deflate. */
export function ziSkellamPiFromDraw(observedDraw, skellamDraw) {
  const den = 1 - skellamDraw;
  const num = observedDraw - skellamDraw;
  if (den < 1e-12 || num <= 1e-15) return 0;
  return clamp(num / den, 0, 0.25);
}

export function ziSkellamMoments(lambdaH, lambdaA, pi = ZI_SKELLAM_PI) {
  const p = clamp(pi, 0, 0.25);
  const m = skellamMoments(lambdaH, lambdaA);
  const mean = (1 - p) * m.mean;
  const second = (1 - p) * (m.variance + m.mean * m.mean);
  return {
    mean,
    variance: Math.max(0, second - mean * mean),
    skellamMean: m.mean,
    skellamVariance: m.variance,
    pi: p,
  };
}

/**
 * Zero-inflated Skellam as the desk writes it, plus the two cousins it does not use.
 * The mixture puts π on GD = 0 and multiplies every other difference by 1−π.
 * The same coin on the common-shock Skellam stacks two draw machines.
 * Diagonal inflation is a score model: it can lift 1-1 without calling it 0-0.
 */
export function ziSkellamInvestigate(lambdaH, lambdaA, pi = ZI_SKELLAM_PI) {
  const p = clamp(Number(pi) || 0, 0, 0.25);
  const lh = Math.max(1e-6, Number(lambdaH) || 0);
  const la = Math.max(1e-6, Number(lambdaA) || 0);
  const base = skellam1x2(lh, la);
  const zi = ziSkellam1x2(lh, la, p);
  const shock = karlisSkellam1x2(lh, la);
  const keep = 1 - p;
  const shockDraw = p + keep * shock.draw;
  const shockHome = keep * shock.home;
  const shockAway = keep * shock.away;
  const shockTot = shockHome + shockDraw + shockAway || 1;
  const ks = [-3, -2, -1, 0, 1, 2, 3];
  const pmf = ks.map((k) => {
    const f = skellamPmf(k, lh, la);
    return { k, skellam: f, zi: k === 0 ? p + keep * f : keep * f };
  });
  const maher = maherGrid(lh, la);
  const diag = diagonalInflate(maher, p);
  const moments = ziSkellamMoments(lh, la, p);
  return {
    pi: p,
    base,
    zi,
    shock,
    ziShock: {
      home: shockHome / shockTot,
      draw: shockDraw / shockTot,
      away: shockAway / shockTot,
    },
    moments,
    piHatIfSkellam: ziSkellamPiFromDraw(base.draw, base.draw),
    piHat: ziSkellamPiFromDraw(zi.draw, base.draw),
    pmf,
    p00: maher[0][0],
    p11: maher[1][1],
    diag00: diag[0][0],
    diag11: diag[1][1],
  };
}

export function skellamInPlay1x2(
lambdaH,
lambdaA,
homeGoals,
awayGoals,
remainingFrac,
maxK = 24)
{
  const gdH = Math.max(0, Math.trunc(homeGoals));
  const gdA = Math.max(0, Math.trunc(awayGoals));
  const t = clamp(remainingFrac, 0, 1);
  if (t <= 1e-9) {
    const gd = gdH - gdA;
    return {
      home: gd > 0 ? 1 : 0,
      draw: gd === 0 ? 1 : 0,
      away: gd < 0 ? 1 : 0
    };
  }
  return poissonConv1x2(lambdaH * t, lambdaA * t, gdH, gdA, maxK);
}
export function negBinSkellam1x2(lambdaH, lambdaA, r = 8, maxK = 20) {
  const ph = negBinPmfArray(lambdaH, r, maxK);
  const pa = negBinPmfArray(lambdaA, r, maxK);
  const cdf = poissonPrefix(ph);
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let y = 0; y <= maxK; y++) {
    const py = pa[y] ?? 0;
    const sp = poissonSplit(ph, cdf, y);
    home += py * sp.gt;
    draw += py * sp.eq;
    away += py * sp.lt;
  }
  const s = home + draw + away || 1;
  return { home: home / s, draw: draw / s, away: away / s };
}

/**
 * Skellam variants on one λ pair. Independent is the difference of two Poissons.
 * The shock keeps the mean and cuts the variance. ZI piles mass on the draw.
 * NegBin fattens |GD|. Normal is the continuity correction. In-play scales λ by time left.
 */
export function skellamVariants(lambdaH, lambdaA, opts = {}) {
  const lh = Math.max(1e-6, Number(lambdaH) || 0);
  const la = Math.max(1e-6, Number(lambdaA) || 0);
  const r = Math.max(0.5, Number(opts.r) || 18);
  const pi = clamp(opts.pi == null ? ZI_SKELLAM_PI : Number(opts.pi), 0, 0.25);
  const rates = karlisRates(lh, la, opts.cov ?? KARLIS_COV);
  const mom = skellamMoments(lh, la);
  const minutesLeft = opts.minutesLeft == null ? 90 : Number(opts.minutesLeft);
  const scoreH = opts.scoreH == null ? 0 : opts.scoreH;
  const scoreA = opts.scoreA == null ? 0 : opts.scoreA;
  return {
    mean: mom.mean,
    variance: mom.variance,
    theta: rates.l3,
    shockMean: rates.l1 - rates.l2,
    shockVariance: rates.l1 + rates.l2,
    besselDraw: skellamPmf(0, lh, la),
    convDraw: skellamDrawConv(lh, la),
    indep: skellam1x2(lh, la),
    shock: skellam1x2(rates.l1, rates.l2),
    zi: ziSkellam1x2(lh, la, pi),
    normal: skellamNormal1x2(lh, la),
    negbin: negBinSkellam1x2(lh, la, r),
    live: skellamInPlay1x2(lh, la, scoreH, scoreA, clamp(minutesLeft, 0, 90) / 90),
    r,
    pi,
  };
}

export function diagonalInflate(grid, p = DIAG_INFLATE_P) {
  const mix2 = clamp(p, 0, 0.25);
  const n = grid.length;
  let dsum = 0;
  for (let i = 0; i < n; i++) dsum += grid[i]?.[i] ?? 0;
  const out = grid.map((row) => row.slice());
  const keep = 1 - mix2;
  let sum = 0;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < (out[x]?.length ?? 0); y++) {
      let v = keep * (out[x][y] ?? 0);
      if (x === y)
      v += mix2 * (dsum > 0 ? (grid[x][x] ?? 0) / dsum : 1 / Math.max(1, n));
      out[x][y] = v;
      sum += v;
    }
  }
  if (sum > 0) {
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < (out[x]?.length ?? 0); y++) out[x][y] /= sum;
    }
  }
  return out;
}
export function zeroInflate00(grid, pi = ZIP_PI) {
  const p = clamp(pi, 0, 0.25);
  const keep = 1 - p;
  const out = grid.map((row) => row.map((v) => keep * v));
  if (out[0]) out[0][0] = (out[0][0] ?? 0) + p;
  return out;
}
export function zipPmf(k, lambda, pi = ZIP_PI) {
  const p = clamp(pi, 0, 0.95);
  const kk = Math.trunc(k);
  if (kk < 0) return 0;
  const poi = poissonPmf(kk, lambda);
  return kk === 0 ? p + (1 - p) * poi : (1 - p) * poi;
}
export function zipMoments(lambda, pi = ZIP_PI) {
  const p = clamp(pi, 0, 0.95);
  const lam = Math.max(0, lambda);
  const mean = (1 - p) * lam;
  const variance = (1 - p) * lam * (1 + p * lam);
  return {
    mean,
    variance,
    vmr: mean > 0 ? variance / mean : 1,
    p0: zipPmf(0, lam, p),
    pi: p
  };
}
export function zipMeanPreservingRate(mean, pi = ZIP_PI) {
  const p = clamp(pi, 0, 0.95);
  return Math.max(0.05, mean) / Math.max(1e-6, 1 - p);
}
export function zipPiFromZeroFreq(p0, lambda) {
  const poi0 = Math.exp(-Math.max(0, lambda));
  const num = clamp(p0, 0, 1) - poi0;
  const den = 1 - poi0;
  if (den < 1e-12 || num <= 0) return 0;
  return clamp(num / den, 0, 0.95);
}
export function zipGrid(lambdaH, lambdaA, pi = ZIP_PI, max = MAX_GOALS) {
  const g = [];
  let sum = 0;
  for (let x = 0; x <= max; x++) {
    const row = [];
    const px = zipPmf(x, lambdaH, pi);
    for (let y = 0; y <= max; y++) {
      const v = px * zipPmf(y, lambdaA, pi);
      row.push(v);
      sum += v;
    }
    g.push(row);
  }
  if (sum > 0) {
    for (let x = 0; x <= max; x++) {
      for (let y = 0; y <= max; y++) g[x][y] /= sum;
    }
  }
  return g;
}

/**
 * Three ways to add a zero, which are not the same model.
 * Margin ZIP: each side is π at 0 plus (1−π) Poisson, so the mean falls to (1−π)λ.
 * (0,0)-only: π is poured onto 0-0 and every other cell is multiplied by 1−π.
 * ZI-Skellam: π is poured onto the 1X2 draw and no score is named.
 */
export function zipInvestigate(lambdaH, lambdaA, pi = ZIP_PI) {
  const p = clamp(Number(pi) || 0, 0, 0.95);
  const lh = Math.max(1e-6, Number(lambdaH) || 0);
  const la = Math.max(1e-6, Number(lambdaA) || 0);
  const maherG = maherGrid(lh, la);
  const zipG = zipGrid(lh, la, p);
  const onlyG = zeroInflate00(maherG, p);
  const moments = zipMoments(lh, p);
  const poi0 = Math.exp(-Math.min(lh, 40));
  return {
    pi: p,
    poissonP0: poi0,
    p0: moments.p0,
    mean: moments.mean,
    variance: moments.variance,
    vmr: moments.vmr,
    piHat: zipPiFromZeroFreq(moments.p0, lh),
    piHatPoisson: zipPiFromZeroFreq(poi0, lh),
    meanPreserving: zipMeanPreservingRate(lh, p),
    maher: marketsFromGrid(maherG),
    zip: marketsFromGrid(zipG),
    only00: marketsFromGrid(onlyG),
    zi: ziSkellam1x2(lh, la, Math.min(p, 0.25)),
    p00: { maher: maherG[0][0], zip: zipG[0][0], only: onlyG[0][0] },
    p10: { maher: maherG[1][0], zip: zipG[1][0], only: onlyG[1][0] },
    p11: { maher: maherG[1][1], zip: zipG[1][1], only: onlyG[1][1] },
  };
}

export function zinbPmf(k, mean, r, pi = ZIP_PI) {
  const p = clamp(pi, 0, 0.95);
  const kk = Math.trunc(k);
  if (kk < 0) return 0;
  const nb = negBinPmf(kk, mean, r);
  return kk === 0 ? p + (1 - p) * nb : (1 - p) * nb;
}
export function goddardResult(opts) {
  const k = Math.max(0.25, opts.kappa ?? WIN_HIER_KAPPA);
  const ph = Math.max(1e-4, opts.priorHome);
  const pd = Math.max(1e-4, opts.priorDraw);
  const pa = Math.max(1e-4, opts.priorAway);
  const s = ph + pd + pa || 1;
  const aH = k * (ph / s) + Math.max(0, opts.homeHits);
  const aD = k * (pd / s) + Math.max(0, opts.drawHits);
  const aA = k * (pa / s) + Math.max(0, opts.awayHits);
  const tot = aH + aD + aA || 1;
  return { home: aH / tot, draw: aD / tot, away: aA / tot };
}
export function goddardOu(opts) {
  const k = Math.max(0.25, opts.kappa ?? OU_HIER_KAPPA);
  const n = Math.max(0, opts.n);
  return clamp(
    (k * clamp(opts.prior, 0.02, 0.95) + clamp(opts.hits, 0, n)) / (k + n),
    0.04,
    0.96
  );
}
export function structuralWinP(dc, skellam, karlis, goddard, inflated) {
  return clamp(
    0.55 * dc + 0.08 * skellam + 0.25 * karlis + 0.12 * goddard + 0 * inflated,
    0.04,
    0.92
  );
}
export function structuralOuP(dc, maher, karlis, negBin, weibull, goddard) {
  return clamp(
    0.5 * dc +
    0.1 * maher +
    0.2 * karlis +
    0.12 * negBin +
    0 * weibull +
    0.08 * goddard,
    0.05,
    0.95
  );
}

/**
 * Alternatives to Poisson regression at a fixed mean.
 * Quasi-Poisson keeps the Poisson score, so the price does not move.
 * NB2 divides that score by 1 + μ/r, so a blowout pulls less.
 * Weibull is priced and then given weight 0 in the totals blend.
 */
export function poissonAltTrace(lambdaH = LEAGUE_MEAN_HOME, lambdaA = LEAGUE_MEAN_AWAY) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const slice = (grid) => {
    const m = marketsFromGrid(grid);
    return { draw: m.draw, btts: m.bttsYes, over15: m.over15, over25: m.over25 };
  };
  const max = MAX_GOALS;
  const qh = weibullQForMean(lh);
  const qa = weibullQForMean(la);
  const weibull = [];
  let mass = 0;
  for (let x = 0; x <= max; x++) {
    const px = weibullCountPmf(x, qh);
    weibull[x] = [];
    for (let y = 0; y <= max; y++) {
      const v = px * weibullCountPmf(y, qa);
      weibull[x][y] = v;
      mass += v;
    }
  }
  if (mass > 0) {
    for (let x = 0; x <= max; x++) {
      for (let y = 0; y <= max; y++) weibull[x][y] /= mass;
    }
  }
  const blow = 5 - lh;
  const nbPull = (mu, r) => (5 - mu) / (1 + mu / r);
  const ratio = (mu, r) => 1 / (1 + mu / r);
  return {
    phi: 1.04,
    poisson: slice(maherGrid(lh, la)),
    nb18: slice(negBinGrid(lh, la, 18)),
    nb35: slice(negBinGrid(lh, la, 3.5)),
    weibull: slice(weibull),
    zip: slice(zipGrid(lh, la, ZIP_PI)),
    pull: { poisson: blow, nb18: nbPull(lh, 18), nb35: nbPull(lh, 3.5) },
    weight: { quiet: ratio(0.8, 18), league: ratio(lh, 18), hot: ratio(3.2, 18), hotFloor: ratio(3.2, 3.5) },
    vmr18: negBinMoments(lh, 18).vmr,
    vmr35: negBinMoments(lh, 3.5).vmr,
  };
}

function logFact(k) {
  let s = 0;
  for (let i = 2; i <= k; i++) s += Math.log(i);
  return s;
}

/** Conway–Maxwell–Poisson weight λ^k / (k!)^ν. ν = 1 is Poisson. */
export function cmpMoments(lambda, nu, max = 40) {
  const lam = Math.max(1e-8, lambda);
  const v = Math.max(0.05, nu);
  const cap = Math.max(8, Math.trunc(max));
  const weights = [];
  let z = 0;
  for (let k = 0; k <= cap; k++) {
    const w = Math.exp(k * Math.log(lam) - v * logFact(k));
    weights.push(w);
    z += w;
  }
  let mean = 0;
  let second = 0;
  const pmf = [];
  for (let k = 0; k <= cap; k++) {
    const p = z > 0 ? weights[k] / z : 0;
    pmf.push(p);
    mean += k * p;
    second += k * k * p;
  }
  const variance = Math.max(0, second - mean * mean);
  return { lambda: lam, nu: v, mean, variance, vmr: mean > 1e-12 ? variance / mean : 0, p0: pmf[0] ?? 0, pmf };
}

/** λ in the CMP weight, chosen so the mean is the Poisson rate. */
export function cmpLambdaForMean(mean, nu) {
  const mu = Math.max(0.05, mean);
  if (Math.abs(nu - 1) < 1e-9) return mu;
  let lo = 1e-6;
  let hi = Math.max(mu, 1);
  while (cmpMoments(hi, nu).mean < mu && hi < 80) hi *= 1.7;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (cmpMoments(mid, nu).mean > mu) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function cmpGrid(lambdaH, lambdaA, nu, max = MAX_GOALS) {
  const h = cmpMoments(cmpLambdaForMean(lambdaH, nu), nu, 30);
  const a = cmpMoments(cmpLambdaForMean(lambdaA, nu), nu, 30);
  const g = [];
  let sum = 0;
  for (let x = 0; x <= max; x++) {
    g[x] = [];
    for (let y = 0; y <= max; y++) {
      const v = (h.pmf[x] ?? 0) * (a.pmf[y] ?? 0);
      g[x][y] = v;
      sum += v;
    }
  }
  if (sum > 0 && Math.abs(sum - 1) > 1e-12) {
    for (let x = 0; x <= max; x++) {
      for (let y = 0; y <= max; y++) g[x][y] /= sum;
    }
  }
  return g;
}

/**
 * Conway–Maxwell–Poisson at the league means. ν < 1 is overdispersed, ν > 1 underdispersed.
 * The rate inside the weight is not the mean. Totals weight stays 0.
 */
export function cmpTrace(lambdaH = LEAGUE_MEAN_HOME, lambdaA = LEAGUE_MEAN_AWAY) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const poisson = marketsFromGrid(maherGrid(lh, la));
  const nus = [1, 1 / 1.04, 0.85, 1.15];
  return {
    poissonP0: Math.exp(-lh),
    poisson: {
      draw: poisson.draw,
      btts: poisson.bttsYes,
      over15: poisson.over15,
      over25: poisson.over25,
    },
    rows: nus.map((nu) => {
      const rate = cmpLambdaForMean(lh, nu);
      const mom = cmpMoments(rate, nu);
      const m = marketsFromGrid(cmpGrid(lh, la, nu));
      return {
        nu,
        rate,
        mean: mom.mean,
        vmr: mom.vmr,
        p0: mom.p0,
        unmatched: cmpMoments(lh, nu).mean,
        draw: m.draw,
        btts: m.bttsYes,
        over15: m.over15,
        over25: m.over25,
      };
    }),
  };
}

function weibullSurvival(k, q, beta) {
  if (k <= 0) return 1;
  return Math.pow(q, Math.pow(k, beta));
}
function weibullMeanFromQ(q, beta, max = 28) {
  let e = 0;
  for (let k = 1; k <= max; k++) e += weibullSurvival(k, q, beta);
  return e;
}
export function weibullQForMean(mean, beta = WEIBULL_SHAPE) {
  const mu = Math.max(0.05, mean);
  let lo = 1e-8;
  let hi = 1 - 1e-8;
  for (let i = 0; i < 42; i++) {
    const mid = (lo + hi) / 2;
    if (weibullMeanFromQ(mid, beta) > mu) hi = mid;else
    lo = mid;
  }
  return (lo + hi) / 2;
}
export function weibullCountPmf(k, q, beta = WEIBULL_SHAPE) {
  if (k < 0) return 0;
  return Math.max(
    0,
    weibullSurvival(k, q, beta) - weibullSurvival(k + 1, q, beta)
  );
}
export function weibullOverAtLeast(
line,
lambdaH,
lambdaA,
beta = WEIBULL_SHAPE,
max = MAX_GOALS)
{
  const qh = weibullQForMean(lambdaH, beta);
  const qa = weibullQForMean(lambdaA, beta);
  const need = Math.max(0, Math.floor(line));
  let under = 0;
  for (let x = 0; x <= max; x++) {
    const px = weibullCountPmf(x, qh, beta);
    const yMax = need - 1 - x;
    if (yMax < 0) continue;
    for (let y = 0; y <= Math.min(max, yMax); y++)
    under += px * weibullCountPmf(y, qa, beta);
  }
  return clamp(1 - under, 0, 1);
}
export function fairCsOdd(p) {
  if (!(p >= MIN_CS_CELL)) return null;
  const odd = 1 / p;
  if (odd < CS_ODDS_BAND.min - 1e-6 || odd > CS_ODDS_BAND.max + 1e-6)
  return null;
  return odd;
}
export function maherOver15(lambdaH, lambdaA) {
  const p00 = poissonPmf(0, lambdaH) * poissonPmf(0, lambdaA);
  const p10 = poissonPmf(1, lambdaH) * poissonPmf(0, lambdaA);
  const p01 = poissonPmf(0, lambdaH) * poissonPmf(1, lambdaA);
  return clamp(1 - p00 - p10 - p01, 0, 1);
}
export function dixonColesOver15(lambdaH, lambdaA, rho = DC_RHO_TOTALS) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const p00 = poissonPmf(0, lh) * poissonPmf(0, la) * dcTau(0, 0, lh, la, rho);
  const p10 = poissonPmf(1, lh) * poissonPmf(0, la) * dcTau(1, 0, lh, la, rho);
  const p01 = poissonPmf(0, lh) * poissonPmf(1, la) * dcTau(0, 1, lh, la, rho);
  return clamp(1 - p00 - p10 - p01, 0, 1);
}
export function bivariateOver15(lambdaH, lambdaA, cov = KARLIS_COV) {
  const l3 = clamp(
    Math.min(cov, 0.28 * Math.min(lambdaH, lambdaA)),
    0.02,
    0.35
  );
  const l1 = Math.max(0.05, lambdaH - l3);
  const l2 = Math.max(0.05, lambdaA - l3);
  const p00 = Math.exp(-(l1 + l2 + l3));
  const p10 = p00 * l1;
  const p01 = p00 * l2;
  return clamp(1 - p00 - p10 - p01, 0, 1);
}
function logGamma(z) {
  const p = [
  0.9999999999998099, 676.5203681218851, -1259.1392167224028,
  771.3234287779073, -176.6150291621406, 12.507343278686905,
  -0.13857109526572012, 9984369578019572e-21, 15056327351493116e-23];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const x = z - 1;
  let a = p[0];
  for (let i = 1; i < p.length; i++) a += p[i] / (x + i);
  const t = x + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a));

}
export function negBinPmf(k, mean, r) {
  const mu = Math.max(1e-6, mean);
  const rr = Math.max(0.5, r);
  const p = rr / (rr + mu);
  const logC = logGamma(k + rr) - logGamma(k + 1) - logGamma(rr);
  return Math.exp(logC + rr * Math.log(p) + k * Math.log(1 - p));
}
export function negBinPmfArray(mean, r, max) {
  const n = Math.max(0, Math.trunc(max));
  const mu = Math.max(1e-6, mean);
  const rr = Math.max(0.5, r);
  const out = new Array(n + 1);
  const stay = rr / (rr + mu);
  const hop = mu / (rr + mu);
  out[0] = Math.pow(stay, rr);
  for (let k = 1; k <= n; k++) {
    out[k] = (out[k - 1] ?? 0) * ((k - 1 + rr) / k) * hop;
  }
  return out;
}
export function negBinMoments(mean, r) {
  const mu = Math.max(1e-6, mean);
  const rr = Math.max(0.5, r);
  const p = rr / (rr + mu);
  return {
    mean: mu,
    variance: mu + mu * mu / rr,
    vmr: 1 + mu / rr,
    r: rr,
    p,
    p0: Math.pow(p, rr)
  };
}
export function negBinRFromVmr(mean, vmr) {
  const mu = Math.max(1e-6, mean);
  if (vmr <= 1 + 1e-9) return Number.POSITIVE_INFINITY;
  return mu / (vmr - 1);
}
export function negBinFromMoments(mean, variance) {
  const mu = Math.max(1e-6, mean);
  const v = Math.max(mu, variance);
  const r = negBinRFromVmr(mu, v / mu);
  if (!Number.isFinite(r)) return negBinMoments(mu, 1e9);
  return negBinMoments(mu, r);
}
export function negBinIndependentTotalVar(lambdaH, lambdaA, r) {
  const rr = Math.max(0.5, r);
  return lambdaH + lambdaA + (lambdaH * lambdaH + lambdaA * lambdaA) / rr;
}
export function negBinFrailtyTotalVar(lambdaH, lambdaA, r) {
  const mu = Math.max(1e-6, lambdaH + lambdaA);
  return negBinMoments(mu, r).variance;
}

/**
 * The H2H rule that sets overdispersionR. Variance divides by n, not n−1.
 * The gate can open and still leave r at 18. Yip's r is above the cap, so it never appears.
 */
export function negBinRFromTotals(totals) {
  const xs = (Array.isArray(totals) ? totals : []).map(Number).filter((n) => Number.isFinite(n));
  if (xs.length < 2) {
    return { n: xs.length, mu: null, v: null, vmr: null, raw: null, r: 18, fired: false, moved: false };
  }
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length;
  const vmr = mu > 1e-12 ? v / mu : 0;
  const fired = v > mu + 0.15;
  const raw = fired ? negBinRFromVmr(mu, vmr) : Number.POSITIVE_INFINITY;
  const r = fired ? clamp(raw, 3.5, 18) : 18;
  return { n: xs.length, mu, v, vmr, raw, r, fired, moved: r < 18 - 1e-9 };
}

/**
 * Two negative binomials at one pair of means.
 * Margins: independent NB2, which is what the union grid uses.
 * Frailty: one NB2 on the total, which is what the lab Over 1.5 uses.
 */
export function negBinSplit(lambdaH = LEAGUE_MEAN_HOME, lambdaA = LEAGUE_MEAN_AWAY) {
  const lh = clamp(lambdaH, 0.05, 4.2);
  const la = clamp(lambdaA, 0.05, 4.2);
  const poi = marketsFromGrid(maherGrid(lh, la));
  const book = (r) => {
    const ind = marketsFromGrid(negBinGrid(lh, la, r));
    return {
      r,
      gammaSd: (lh + la) / Math.sqrt(r),
      varIndep: negBinIndependentTotalVar(lh, la, r),
      varFrailty: negBinFrailtyTotalVar(lh, la, r),
      over15: { margins: ind.over15, frailty: negBinOverAtLeast(2, lh, la, r) },
      over25: { margins: ind.over25, frailty: negBinOverAtLeast(3, lh, la, r) },
      btts: ind.bttsYes,
    };
  };
  return {
    poisson: { over15: poi.over15, over25: poi.over25, btts: poi.bttsYes, variance: lh + la },
    yipR: negBinRFromVmr(lh + la, YIP_GOAL_VMR),
    r18: book(18),
    r8: book(8),
    r35: book(3.5),
    quiet: negBinRFromTotals([2, 2, 3, 2, 3]),
    open: negBinRFromTotals([0, 2, 2, 3, 5]),
    wild: negBinRFromTotals([0, 0, 1, 5, 6]),
  };
}

/**
 * NB2 as the desk computes it. P(0) = (r/(r+μ))^r, then
 * P(k) = P(k−1) · (k−1+r)/k · μ/(r+μ). Variance is μ + μ²/r.
 * The Poisson column is the same mean with no extra variance.
 */
export function negBinInvestigate(mean, r, max = MAX_GOALS) {
  const mu = Math.max(1e-6, Number(mean) || 0);
  const rr = Math.max(0.5, Number(r) || 0);
  const cap = Math.max(0, Math.trunc(max));
  const moments = negBinMoments(mu, rr);
  const short = negBinPmfArray(mu, rr, cap);
  const poi = poissonPmfArray(mu, cap);
  let covered = 0;
  for (let k = 0; k <= cap; k++) covered += short[k];
  const tail = Math.max(0, 1 - covered);
  let tMean = 0;
  let tSecond = 0;
  for (let k = 0; k <= cap; k++) {
    const p = covered > 0 ? short[k] / covered : 0;
    tMean += k * p;
    tSecond += k * k * p;
  }
  const tVar = Math.max(0, tSecond - tMean * tMean);
  const hop = mu / (rr + mu);
  const rows = [];
  for (let k = 0; k <= cap; k++) {
    rows.push({
      k,
      p: short[k],
      poisson: poi[k],
      step: k === 0 ? null : ((k - 1 + rr) / k) * hop,
    });
  }
  return {
    mean: mu,
    r: rr,
    variance: moments.variance,
    vmr: moments.vmr,
    p0: moments.p0,
    poissonP0: poi[0] ?? 0,
    p0Lift: moments.p0 - (poi[0] ?? 0),
    rows,
    tail,
    truncatedMean: tMean,
    truncatedVar: tVar,
    truncatedVmr: tMean > 1e-12 ? tVar / tMean : 0,
  };
}

export function negBinOverAtLeast(line, lambdaH, lambdaA, r) {
  const need = Math.max(1, Math.trunc(line));
  const g = negBinPmfArray(lambdaH + lambdaA, r, Math.max(16, need + 14));
  let mass = 0;
  for (let k = 0; k < need; k++) mass += g[k] ?? 0;
  return clamp(1 - mass, 0, 1);
}
export function panjerAb0Poisson(lambda) {
  const lam = Math.max(0, lambda);
  return { a: 0, b: lam, p0: Math.exp(-lam) };
}
export function panjerAb0NegBin(mean, r) {
  const mu = Math.max(1e-6, mean);
  const rr = Math.max(0.5, r);
  const a = mu / (rr + mu);
  return { a, b: (rr - 1) * a, p0: Math.pow(rr / (rr + mu), rr) };
}
export function geometricSeverity(rho, max) {
  const p = clamp(rho, 1e-6, 1);
  const q = 1 - p;
  const n = Math.max(1, Math.trunc(max));
  const f = new Array(n + 1).fill(0);
  f[1] = p;
  for (let k = 2; k <= n; k++) f[k] = (f[k - 1] ?? 0) * q;
  return f;
}
export function panjerCompound(a, b, p0, severity, max) {
  const n = Math.max(0, Math.trunc(max));
  const g = new Array(n + 1).fill(0);
  const f0 = severity[0] ?? 0;
  const denom = 1 - a * f0;
  g[0] =
  denom > 1e-12 ? clamp(p0, 0, 1) / (f0 > 0 ? denom : 1) : clamp(p0, 0, 1);
  const safe = Math.abs(denom) < 1e-12 ? 1 : denom;
  for (let x = 1; x <= n; x++) {
    let acc = 0;
    const lim = Math.min(x, severity.length - 1);
    for (let k = 1; k <= lim; k++) {
      const fk = severity[k] ?? 0;
      if (fk === 0) continue;
      acc += (a + b * k / x) * fk * (g[x - k] ?? 0);
    }
    g[x] = acc / safe;
  }
  return g;
}
export function polyaAeppliPmf(mean, rho = POLYA_RHO, max = 24) {
  const p = clamp(rho, 0.2, 1);
  const mu = Math.max(0.05, mean);
  const n = Math.max(0, Math.trunc(max));
  const theta = mu * p;
  const q = 1 - p;
  const g = new Array(n + 1).fill(0);
  const p0 = Math.exp(-theta);
  g[0] = p0;
  if (n >= 1) g[1] = theta * p * p0;
  for (let x = 1; x < n; x++) {
    const prev = g[x] ?? 0;
    const back = x >= 1 ? g[x - 1] ?? 0 : 0;
    g[x + 1] = (theta * p + 2 * q * x) * prev - q * q * (x - 1) * back;
    g[x + 1] = (g[x + 1] ?? 0) / (x + 1);
  }
  return g;
}
export function polyaAeppliClosedPmf(k, mean, rho = POLYA_RHO) {
  const kk = Math.trunc(k);
  if (kk < 0) return 0;
  const p = clamp(rho, 0.2, 1);
  const theta = Math.max(0.05, mean) * p;
  if (kk === 0) return Math.exp(-theta);
  const q = 1 - p;
  if (q < 1e-12) return poissonPmf(kk, theta);
  let s = 0;
  let binom = 1;
  let pow = theta * p / q;
  for (let j = 1; j <= kk; j++) {
    if (j > 1) binom *= (kk - (j - 1)) / (j - 1);
    s += binom * pow / factorialInt(j);
    pow *= theta * p / q;
  }
  return Math.exp(-theta) * Math.pow(q, kk) * s;
}
function factorialInt(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}
export function polyaAeppliMoments(mean, rho = POLYA_RHO) {
  const p = clamp(rho, 0.2, 1);
  const mu = Math.max(0.05, mean);
  const vmr = (2 - p) / p;
  return { mean: mu, variance: mu * vmr, vmr, theta: mu * p, rho: p };
}
export function polyaRhoFromVmr(vmr) {
  const d = Math.max(1, vmr);
  return clamp(2 / (d + 1), 0.2, 1);
}
export function polyaFromMoments(mean, variance) {
  const mu = Math.max(0.05, mean);
  const v = Math.max(mu, variance);
  return polyaAeppliMoments(mu, polyaRhoFromVmr(v / mu));
}
export function polyaRhoFromZeroFreq(p0, mean) {
  const mu = Math.max(0.05, mean);
  const p = clamp(p0, 1e-12, 0.999);
  return clamp(-Math.log(p) / mu, 0.2, 1);
}
export function polyaAeppli1x2(lambdaH, lambdaA, rho = POLYA_RHO, maxK = 24) {
  return countConv1x2(
    polyaAeppliPmf(lambdaH, rho, maxK),
    polyaAeppliPmf(lambdaA, rho, maxK)
  );
}
export function polyaKarlis1x2(lambdaH, lambdaA, cov = KARLIS_COV, rho = POLYA_RHO) {
  const r = karlisRates(lambdaH, lambdaA, cov);
  return polyaAeppli1x2(r.l1, r.l2, rho);
}
export function polyaAeppliOverAtLeast(line, lambdaH, lambdaA, rho = POLYA_RHO) {
  const need = Math.max(1, Math.trunc(line));
  const g = polyaAeppliPmf(lambdaH + lambdaA, rho, Math.max(16, need + 14));
  let mass = 0;
  for (let k = 0; k < need; k++) mass += g[k] ?? 0;
  return clamp(1 - mass, 0, 1);
}
export function negBinOver15(lambdaH, lambdaA, r) {
  return negBinOverAtLeast(2, lambdaH, lambdaA, r);
}
export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function trimmedMedian(values) {
  if (values.length < 4) return median(values);
  const s = [...values].sort((a, b) => a - b);
  const q1 = s[Math.floor((s.length - 1) * 0.25)];
  const q3 = s[Math.floor((s.length - 1) * 0.75)];
  const iqr = q3 - q1;
  if (!(iqr > 0)) return median(s);
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return median(s.filter((v) => v >= lo && v <= hi));
}
export function marketsCoherent(m) {
  const s = m.home + m.draw + m.away;
  if (Math.abs(s - 1) > 0.02) return false;
  if (m.over15 + 1e-9 < m.over25) return false;
  if (m.bttsYes > m.over15 + 1e-9) return false;
  return true;
}
function shinQs(implied, z) {
  const sumP = implied.reduce((a, b) => a + b, 0);
  if (z >= 1 || sumP <= 0) return implied.map((p) => p / sumP);
  return implied.map((p) => {
    const inside = z * z + 4 * (1 - z) * p * p / sumP;
    return (Math.sqrt(Math.max(0, inside)) - z) / (2 * (1 - z));
  });
}
export function shinFit(odds) {
  const implied = odds.map((o) => o > 1 ? 1 / o : 0);
  const sum = implied.reduce((a, b) => a + b, 0);
  const n = Math.max(1, odds.length);
  if (sum <= 0) {
    const p = 1 / n;
    return { probs: odds.map(() => p), z: 0, overround: -1 };
  }
  const overround = sum - 1;
  if (sum <= 1) {
    return { probs: implied.map((p) => p / sum), z: 0, overround };
  }
  let lo = 0;
  let hi = 0.99;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const q2 = shinQs(implied, mid);
    const s2 = q2.reduce((a, b) => a + b, 0);
    if (s2 > 1) lo = mid;else
    hi = mid;
  }
  const z = (lo + hi) / 2;
  const q = shinQs(implied, z);
  const s = q.reduce((a, b) => a + b, 0) || 1;
  return { probs: q.map((v) => v / s), z, overround };
}
export function shinInvert(odds) {
  return shinFit(odds).probs;
}
export function multiplicativeDevig(odds) {
  const implied = odds.map((o) => o > 1 ? 1 / o : 0);
  const sum = implied.reduce((a, b) => a + b, 0) || 1;
  return implied.map((p) => p / sum);
}
export function additiveDevig(odds) {
  const implied = odds.map((o) => o > 1 ? 1 / o : 0);
  const k = implied.length || 1;
  const sum = implied.reduce((a, b) => a + b, 0);
  const c = (sum - 1) / k;
  const raw = implied.map((p) => Math.max(1e-6, p - c));
  const s = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((p) => p / s);
}
export function powerDevig(odds) {
  const implied = odds.map((o) => o > 1 ? 1 / o : 0);
  const sum = implied.reduce((a, b) => a + b, 0);
  if (sum <= 0) return multiplicativeDevig(odds);
  if (Math.abs(sum - 1) < 1e-9) return implied.map((p) => p / sum);
  let lo = 0.2;
  let hi = 8;
  const target = sum > 1;
  for (let i = 0; i < 40; i++) {
    const n2 = (lo + hi) / 2;
    const s2 = implied.reduce((a, p) => a + p ** n2, 0);
    if (target ? s2 > 1 : s2 < 1) lo = n2;else
    hi = n2;
  }
  const n = (lo + hi) / 2;
  const raw = implied.map((p) => p ** n);
  const s = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((p) => p / s);
}
export function shinImpliedOver(overOdds, underOdds) {
  if (!(overOdds > 1)) return 0.62;
  if (underOdds && underOdds > 1) {
    const [over] = shinInvert([overOdds, underOdds]);
    return clamp(over ?? 1 / overOdds, 0.05, 0.97);
  }
  return clamp(1 / overOdds / 1.045, 0.05, 0.97);
}
export function americanToDecimal(n) {
  if (n > 0) return 1 + n / 100;
  if (n < 0) return 1 + 100 / Math.abs(n);
  return 1;
}
export function over15FromOver25(pOver25) {
  const target = clamp(pOver25, 0.02, 0.98);
  let lo = 0.4;
  let hi = 5.5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const p = poissonCdfAtLeast(3, mid);
    if (p > target) hi = mid;else
    lo = mid;
  }
  return poissonCdfAtLeast(2, (lo + hi) / 2);
}
export function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}
export function walkElo(form, k = 18, field = 1500) {
  if (!form) return field;
  const chars = form.replace(/[^WDL]/gi, "").split("").reverse();
  let r = field;
  for (const ch of chars) {
    const s = ch === "W" || ch === "w" ? 1 : ch === "D" || ch === "d" ? 0.5 : 0;
    const e = 1 / (1 + 10 ** ((field - r) / 400));
    r += k * (s - e);
  }
  return r;
}

export function eloToLambdas(eloHome, eloAway) {
  const delta = (eloHome + HOME_ADVANTAGE_ELO - eloAway) / 220;
  return {
    lambdaH: clamp(LEAGUE_MEAN_HOME + 0.55 * delta, 0.35, 3.2),
    lambdaA: clamp(LEAGUE_MEAN_AWAY - 0.45 * delta, 0.28, 3)
  };
}
export const PI_LEARNING = 0.035;
export const PI_CATCHUP = 0.7;
export const EGIDI_HIST_WEIGHT = 0.32;
export function piPsi(error) {
  if (error === 0) return 0;
  return 3 * Math.log10(1 + Math.abs(error)) * Math.sign(error);
}
export function walkPiRatings(h2h) {
  const r = { homeH: 0, homeA: 0, awayH: 0, awayA: 0 };
  const rows = [...h2h].sort((a, b) => b.daysAgo - a.daysAgo);
  for (const row of rows) {
    const lr = PI_LEARNING * (0.55 + 0.45 * dcDecay(row.daysAgo));
    if (row.homeIsCurrentHome) {
      const expected = r.homeH - r.awayA;
      const psi = piPsi(row.homeGoals - row.awayGoals - expected);
      r.homeH += psi * lr;
      r.homeA += psi * lr * PI_CATCHUP;
      r.awayA -= psi * lr;
      r.awayH -= psi * lr * PI_CATCHUP;
    } else {
      const expected = r.awayH - r.homeA;
      const psi = piPsi(row.homeGoals - row.awayGoals - expected);
      r.awayH += psi * lr;
      r.awayA += psi * lr * PI_CATCHUP;
      r.homeA -= psi * lr;
      r.homeH -= psi * lr * PI_CATCHUP;
    }
  }
  return r;
}
export function piToLambdas(pi, meanH = LEAGUE_MEAN_HOME, meanA = LEAGUE_MEAN_AWAY) {
  const gd = pi.homeH - pi.awayA;
  return {
    lambdaH: clamp(meanH + 0.5 * gd, 0.32, 3.35),
    lambdaA: clamp(meanA - 0.4 * gd, 0.24, 3.1)
  };
}
export function skellamLambdasFrom1x2(pHome, pDraw, pAway, rho = DC_RHO) {
  return invert1x2Report(pHome, pDraw, pAway, rho);
}
export function invert1x2Report(pHome, pDraw, pAway, rho = DC_RHO) {
  const h = Math.max(0.08, pHome);
  const d = Math.max(0.08, pDraw);
  const a = Math.max(0.08, pAway);
  const s = h + d + a;
  const ph = h / s;
  const pd = d / s;
  const pa = a / s;
  let tot = clamp(2.2 + 2.4 * (0.3 - pd), 1.4, 4);
  let share = clamp(ph / (ph + pa), 0.28, 0.78);
  for (let i = 0; i < 8; i++) {
    let lo = 1.3;
    let hi = 4.1;
    for (let j = 0; j < 12; j++) {
      const mid = (lo + hi) / 2;
      const m = marketsFromGrid(jointGrid(mid * share, mid * (1 - share), rho));
      if (m.draw > pd) lo = mid;else
      hi = mid;
    }
    tot = (lo + hi) / 2;
    let slo = 0.28;
    let shi = 0.78;
    const want = ph / (ph + pa);
    for (let j = 0; j < 12; j++) {
      const mid = (slo + shi) / 2;
      const m = marketsFromGrid(jointGrid(tot * mid, tot * (1 - mid), rho));
      const got = m.home / (m.home + m.away);
      if (got < want) slo = mid;else
      shi = mid;
    }
    share = (slo + shi) / 2;
  }
  const lambdaH = clamp(tot * share, 0.32, 3.35);
  const lambdaA = clamp(tot * (1 - share), 0.24, 3.1);
  const fitted = marketsFromGrid(jointGrid(lambdaH, lambdaA, rho));
  const sse =
  (fitted.home - ph) ** 2 + (fitted.draw - pd) ** 2 + (fitted.away - pa) ** 2;
  return {
    lambdaH,
    lambdaA,
    sse,
    fitted: { home: fitted.home, draw: fitted.draw, away: fitted.away }
  };
}
export function egidiMix(histH, histA, mktH, mktA, histWeight = EGIDI_HIST_WEIGHT) {
  const w = clamp(histWeight, 0.15, 0.85);
  return {
    lambdaH: clamp(w * histH + (1 - w) * mktH, 0.32, 3.35),
    lambdaA: clamp(w * histA + (1 - w) * mktA, 0.24, 3.1)
  };
}
export function totalFromOver25(pOver) {
  const target = clamp(pOver, 0.08, 0.92);
  let lo = 1.2;
  let hi = 4.6;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const p = 1 - poissonPmf(0, mid) - poissonPmf(1, mid) - poissonPmf(2, mid);
    if (p > target) hi = mid;else
    lo = mid;
  }
  return (lo + hi) / 2;
}
export function matchRho(lambdaH, lambdaA, base = DC_RHO) {
  const tot = Math.max(0.8, lambdaH + lambdaA);
  return clampRho(base * clamp(2.6 / tot, 0.75, 1.35), lambdaH, lambdaA);
}
export function betaShrink(hits, n, prior, strength = 2) {
  if (n <= 0) return prior;
  return (hits + strength * prior) / (n + strength);
}
export function formTilt(form) {
  if (!form) return 0;
  const chars = form.replace(/[^WDL]/gi, "").split("");
  let tilt = 0;
  let w = 1;
  for (const ch of chars) {
    if (ch === "W" || ch === "w") tilt += 0.08 * w;else
    if (ch === "L" || ch === "l") tilt -= 0.06 * w;
    w *= 0.72;
  }
  return clamp(tilt, -0.12, 0.14);
}

export function histWeightFromData(input) {
  let s = EGIDI_HIST_WEIGHT;
  if (input.homeLast5For != null && input.awayLast5For != null) s += 0.08;
  if (input.homeVenueFor != null && input.awayVenueFor != null) s += 0.06;
  if (input.homeSeasonForHome != null && input.awaySeasonForAway != null)
  s += 0.05;
  if (input.h2h.length >= 4) s += 0.1;else
  if (input.h2h.length >= 2) s += 0.05;
  if (input.homeRank != null && input.awayRank != null) s += 0.08;
  if ((input.homePlayed ?? 0) >= 8 && (input.awayPlayed ?? 0) >= 8) s += 0.04;
  if (input.homeAdjAttack != null && input.awayAdjAttack != null) s += 0.05;
  if (input.homeOver15For != null && input.awayOver15For != null) s += 0.03;
  if (input.lineupConfirmed) s += 0.04;
  const q = input.dataQuality;
  if (q != null && q < 0.45) s -= 0.08;
  return clamp(s, 0.22, 0.78);
}
function gdPerGame(gd, played) {
  if (gd == null || played == null || played < 4) return 0;
  return clamp(gd / played, -2.2, 2.4);
}
function lambdaFromZeroRate(rate) {
  if (rate == null || !(rate > 0.05) || !(rate < 0.75)) return null;
  return clamp(-Math.log(rate), 0.25, 2.8);
}
export function estimateLambdas(input) {
  const priorH = input.leagueAvgHome ?? LEAGUE_MEAN_HOME;
  const priorA = input.leagueAvgAway ?? LEAGUE_MEAN_AWAY;
  const nShort = Math.max(1, Math.min(8, input.lastNHome ?? 5));
  let gfH = input.homeLast5For ?? priorH;
  let gaH = input.homeLast5Against ?? priorA;
  let gfA = input.awayLast5For ?? priorA;
  let gaA = input.awayLast5Against ?? priorH;
  gfH = winsorGoalRate(gfH, priorH);
  gaH = winsorGoalRate(gaH, priorA);
  gfA = winsorGoalRate(gfA, priorA);
  gaA = winsorGoalRate(gaA, priorH);
  const scaleH = karlisOutlierScale(gfH, gaH, { n: nShort, league: priorH });
  const scaleA = karlisOutlierScale(gfA, gaA, { n: nShort, league: priorA });
  gfH = priorH + scaleH * (gfH - priorH);
  gaH = priorA + scaleH * (gaH - priorA);
  gfA = priorA + scaleA * (gfA - priorA);
  gaA = priorH + scaleA * (gaA - priorH);
  let recentH = 0.5 * gfH + 0.5 * gaA;
  let recentA = 0.5 * gfA + 0.5 * gaH;
  if (input.homeVenueFor != null && input.awayVenueAgainst != null) {
    const venueH = 0.55 * input.homeVenueFor + 0.45 * input.awayVenueAgainst;
    recentH = 0.28 * venueH + 0.72 * recentH;
  }
  if (input.awayVenueFor != null && input.homeVenueAgainst != null) {
    const venueA = 0.55 * input.awayVenueFor + 0.45 * input.homeVenueAgainst;
    recentA = 0.28 * venueA + 0.72 * recentA;
  }
  const seasonH =
  0.55 * (input.homeSeasonForHome ?? priorH) +
  0.45 * (input.awaySeasonAgainstAway ?? priorH);
  const seasonA =
  0.55 * (input.awaySeasonForAway ?? priorA) +
  0.45 * (input.homeSeasonAgainstHome ?? priorA);
  const hasLast5 = input.homeLast5For != null && input.awayLast5For != null;
  const shrunkRecentH = finishingShrink(recentH, seasonH, hasLast5 ? 5 : nShort, hasLast5 ? 2 : 8);
  const nAway = Math.max(1, Math.min(8, input.lastNAway ?? 5));
  const shrunkRecentA = finishingShrink(recentA, seasonA, hasLast5 ? 5 : nAway, hasLast5 ? 2 : 8);
  const recentW = hasLast5 ? 0.72 : 0.4;
  let lambdaH = recentW * shrunkRecentH + (1 - recentW) * seasonH;
  let lambdaA = recentW * shrunkRecentA + (1 - recentW) * seasonA;
  const share = input.poissonShareHome;
  if (share != null && share > 0.05 && share < 0.95) {
    const ratio = share / (1 - share);
    const tot = lambdaH + lambdaA;
    const targetH = tot * ratio / (1 + ratio);
    const targetA = tot - targetH;
    lambdaH = 0.78 * lambdaH + 0.22 * targetH;
    lambdaA = 0.78 * lambdaA + 0.22 * targetA;
  }
  const kH = (input.homePlayed ?? 8) < 6 ? 6 : hasLast5 ? 2.2 : BAIO_KAPPA;
  const kA = (input.awayPlayed ?? 8) < 6 ? 6 : hasLast5 ? 2.2 : BAIO_KAPPA;
  const nH = clamp(input.homePlayed ?? 8, 2, 16);
  const nA = clamp(input.awayPlayed ?? 8, 2, 16);
  lambdaH = (nH * lambdaH + kH * priorH) / (nH + kH);
  lambdaA = (nA * lambdaA + kA * priorA) / (nA + kA);
  const mixLuH = input.lineupConfirmedHome != null ? input.lineupConfirmedHome ? 0.7 : 0 : input.lineupConfirmed ? 0.7 : 0;
  const mixLuA = input.lineupConfirmedAway != null ? input.lineupConfirmedAway ? 0.7 : 0 : input.lineupConfirmedHome == null && input.lineupConfirmedAway == null && input.lineupConfirmed ? 0.7 : 0;
  const attH = mixLuH * (input.lineupAttackHome ?? 0) + (1 - mixLuH) * (input.injuryAttackHome ?? 0.024 * (input.injuryHome ?? 0));
  const attA = mixLuA * (input.lineupAttackAway ?? 0) + (1 - mixLuA) * (input.injuryAttackAway ?? 0.024 * (input.injuryAway ?? 0));
  const defH = mixLuH * (input.lineupDefenseHome ?? 0) + (1 - mixLuH) * (input.injuryDefenseHome ?? 0);
  const defA = mixLuA * (input.lineupDefenseAway ?? 0) + (1 - mixLuA) * (input.injuryDefenseAway ?? 0);
  const gkH = mixLuH * (input.lineupKeeperHome ?? 0) + (1 - mixLuH) * (input.injuryKeeperHome ?? 0);
  const gkA = mixLuA * (input.lineupKeeperAway ?? 0) + (1 - mixLuA) * (input.injuryKeeperAway ?? 0);
  lambdaH *= 1 - clamp(attH, -0.08, 0.22);
  lambdaA *= 1 - clamp(attA, -0.08, 0.22);
  lambdaH *= 1 + clamp(defA, -0.08, 0.18);
  lambdaA *= 1 + clamp(defH, -0.08, 0.18);
  lambdaH *= 1 + clamp(gkA, 0, 0.2);
  lambdaA *= 1 + clamp(gkH, 0, 0.2);
  lambdaH += formTilt(input.homeForm);
  lambdaA += formTilt(input.awayForm);
  if (input.homeAdjAttack != null) lambdaH = 0.82 * lambdaH + 0.18 * input.homeAdjAttack;
  if (input.awayAdjAttack != null) lambdaA = 0.82 * lambdaA + 0.18 * input.awayAdjAttack;
  if (input.homeAdjDefense != null) lambdaA = 0.9 * lambdaA + 0.1 * input.homeAdjDefense;
  if (input.awayAdjDefense != null) lambdaH = 0.9 * lambdaH + 0.1 * input.awayAdjDefense;
  if (input.homeOver15For != null) {
    if (input.homeOver15For > 0.55) lambdaH *= 1.04;else
    if (input.homeOver15For < 0.28) lambdaH *= 0.96;
  }
  if (input.awayOver15For != null) {
    if (input.awayOver15For > 0.55) lambdaA *= 1.04;else
    if (input.awayOver15For < 0.28) lambdaA *= 0.96;
  }
  if (input.homeLateShare != null && input.awayLateShare != null) {
    const late = (input.homeLateShare + input.awayLateShare) / 2;
    if (late > 0.28) {
      lambdaH *= 1.03;
      lambdaA *= 1.03;
    } else if (late < 0.12) {
      lambdaH *= 0.98;
      lambdaA *= 0.98;
    }
  }
  const homeStr = gdPerGame(input.homeGD, input.homePlayed);
  const awayStr = gdPerGame(input.awayGD, input.awayPlayed);
  const hasAdj = input.homeAdjAttack != null && input.awayAdjAttack != null;
  const tableW = hasAdj ? 0.7 : 1;
  lambdaH += 0.14 * tableW * homeStr - 0.08 * tableW * awayStr;
  lambdaA += 0.14 * tableW * awayStr - 0.08 * tableW * homeStr;
  if (input.homeRank != null && input.awayRank != null) {
    const gap = clamp((input.awayRank - input.homeRank) / 20, -0.8, 0.8);
    lambdaH += 0.16 * tableW * gap;
    lambdaA -= 0.12 * tableW * gap;
  }
  if ((input.homeFailedStreak ?? 0) >= 3) lambdaH *= 1 - 0.03 * Math.min(4, input.homeFailedStreak);
  if ((input.awayFailedStreak ?? 0) >= 3) lambdaA *= 1 - 0.03 * Math.min(4, input.awayFailedStreak);
  const richForm = (input.lastNHome ?? 0) >= 8 && (input.lastNAway ?? 0) >= 8;
  let overdispersionR = 18;
  if (input.h2h.length >= 2) {
    const newest = [...input.h2h].sort((a, b) => (a.daysAgo ?? 9e9) - (b.daysAgo ?? 9e9)).slice(0, 5);
    let hSum = 0;
    let aSum = 0;
    const totals = [];
    for (const row of newest) {
      const hg = row.homeIsCurrentHome ? row.homeGoals : row.awayGoals;
      const ag = row.homeIsCurrentHome ? row.awayGoals : row.homeGoals;
      hSum += hg;
      aSum += ag;
      totals.push(hg + ag);
    }
    const k = newest.length;
    if (k > 0) {
      const mix2 = richForm ? clamp(0.12 + 0.02 * k, 0.12, 0.22) : clamp(0.16 + 0.03 * k, 0.16, 0.28);
      lambdaH = (1 - mix2) * lambdaH + mix2 * (hSum / k);
      lambdaA = (1 - mix2) * lambdaA + mix2 * (aSum / k);
      const mu = totals.reduce((a, b) => a + b, 0) / totals.length;
      const v = totals.reduce((a, b) => a + (b - mu) ** 2, 0) / totals.length;
      if (v > mu + 0.15) {
        overdispersionR = clamp(negBinRFromVmr(mu, v / mu), 3.5, 18);
      }
    }
  }
  if (input.homeAttack != null || input.awayDefense != null) {
    lambdaH = 0.85 * lambdaH + 0.15 * logLinearLambda(lambdaH, input.homeAttack ?? 0, input.awayDefense ?? 0);
  }
  if (input.awayAttack != null || input.homeDefense != null) {
    lambdaA = 0.85 * lambdaA + 0.15 * logLinearLambda(lambdaA, input.awayAttack ?? 0, input.homeDefense ?? 0);
  }
  const momH = input.homeMomGf ?? goalMomentum(input.homeLast5For, input.homeSeasonForHome, input.lastNHome ?? 5);
  const momA = input.awayMomGf ?? goalMomentum(input.awayLast5For, input.awaySeasonForAway, input.lastNAway ?? 5);
  lambdaH += 0.12 * momH;
  lambdaA += 0.12 * momA;
  const leagueAvg = input.leagueAvgTotal || 2.65;
  const total = lambdaH + lambdaA;
  if (total > 0 && Math.abs(total - leagueAvg) / leagueAvg > 0.85) {
    const scale = (0.25 * leagueAvg + 0.75 * total) / total;
    lambdaH *= scale;
    lambdaA *= scale;
  }
  const xh = input.homeTorvaneyFor ?? torvaneySideRate(input.homeXgShots);
  const xa = input.awayTorvaneyFor ?? torvaneySideRate(input.awayXgShots);
  if (xh != null && xa != null) {
    lambdaH = 0.82 * lambdaH + 0.18 * clamp(xh, 0.15, 3.35);
    lambdaA = 0.82 * lambdaA + 0.18 * clamp(xa, 0.15, 3.1);
  }
  const nLong = Math.min(input.homeSma20N ?? 0, input.awaySma20N ?? 0);
  if (
    nLong >= 12 &&
    input.homeSma20For != null &&
    input.homeSma20Against != null &&
    input.awaySma20For != null &&
    input.awaySma20Against != null
  ) {
    const w = nLong >= 16 ? 0.22 : 0.14;
    const longH = winsorGoalRate(0.55 * input.homeSma20For + 0.45 * input.awaySma20Against, priorH);
    const longA = winsorGoalRate(0.55 * input.awaySma20For + 0.45 * input.homeSma20Against, priorA);
    lambdaH = (1 - w) * lambdaH + w * longH;
    lambdaA = (1 - w) * lambdaA + w * longA;
  }
  const zH = lambdaFromZeroRate(input.homeFts) ?? lambdaFromZeroRate(input.awayCs);
  const zA = lambdaFromZeroRate(input.awayFts) ?? lambdaFromZeroRate(input.homeCs);
  if (zH != null) lambdaH = 0.86 * lambdaH + 0.14 * zH;
  if (zA != null) lambdaA = 0.86 * lambdaA + 0.14 * zA;
  return {
    lambdaH: clamp(lambdaH, 0.32, 3.35),
    lambdaA: clamp(lambdaA, 0.24, 3.1),
    overdispersionR,
    lambdaSeH: lambdaLogSe(input.homeAttackVar ?? 0.12, input.awayDefenseVar ?? 0.12),
    lambdaSeA: lambdaLogSe(input.awayAttackVar ?? 0.12, input.homeDefenseVar ?? 0.12)
  };
}

export function apiBttsProxy(pHome, pDraw, pAway, dcBtts) {
  const proxy = clamp(
    0.72 - 0.55 * pDraw + 0.12 * (pHome + pAway - 0.7),
    0.28,
    0.78
  );
  return clamp(0.55 * dcBtts + 0.45 * proxy, 0.08, 0.92);
}
export function apiLineToOver15(line) {
  if (!line) return { p: 0.62, boost: false, veto: false };
  const t = line.trim().toLowerCase().replace(",", ".");
  const over = /over/.test(t) || t.startsWith("+");
  const under = /under/.test(t) || t.startsWith("-");
  const num = Number.parseFloat((t.match(/(\d+(?:\.\d+)?)/) ?? [])[1] ?? "");
  if (!Number.isFinite(num)) return { p: 0.62, boost: false, veto: false };
  if (over) {
    if (num <= 1.5) return { p: 0.74, boost: num === 1.5, veto: false };
    if (num <= 2.5) return { p: 0.8, boost: false, veto: false };
    return { p: 0.86, boost: false, veto: false };
  }
  if (under) {
    if (num <= 1.5) return { p: 0.32, boost: false, veto: true };
    if (num <= 2.5) return { p: 0.58, boost: false, veto: false };
    return { p: 0.7, boost: false, veto: false };
  }
  return { p: 0.62, boost: false, veto: false };
}
export function apiLineToOver25(line) {
  if (!line) return { p: 0.52, veto: false };
  const t = line.trim().toLowerCase().replace(",", ".");
  const over = /over/.test(t) || t.startsWith("+");
  const under = /under/.test(t) || t.startsWith("-");
  const num = Number.parseFloat((t.match(/(\d+(?:\.\d+)?)/) ?? [])[1] ?? "");
  if (!Number.isFinite(num)) return { p: 0.52, veto: false };
  if (over) {
    if (num <= 1.5) return { p: 0.58, veto: false };
    if (num <= 2.5) return { p: 0.62, veto: false };
    return { p: 0.72, veto: false };
  }
  if (under) {
    if (num <= 1.5) return { p: 0.18, veto: true };
    if (num <= 2.5) return { p: 0.38, veto: false };
    return { p: 0.48, veto: false };
  }
  return { p: 0.52, veto: false };
}
export function bandQuality(odd, mid = 1.925) {
  const denom = mid < 3 ? 0.075 * 1.6 : 5.5;
  return clamp(1 - Math.abs(odd - mid) / denom, 0.55, 1);
}
const ACC_WIN = { dc: 0.18, shin: 0.62, api: 0.04, elo: 0.06, h2h: 0.1 };
const VAL_WIN = { dc: 0.38, shin: 0, api: 0.18, elo: 0.2, h2h: 0.24 };
const ACC_BTTS = { dc: 0.22, shin: 0.58, api: 0.04, elo: 0.06, h2h: 0.1 };
const VAL_BTTS = { dc: 0.5, shin: 0, api: 0.16, elo: 0.22, h2h: 0.12 };
const ACC_OU = { dc: 0.22, shin: 0.58, api: 0.04, elo: 0.06, h2h: 0.1 };
const VAL_OU = { dc: 0.52, shin: 0, api: 0.14, elo: 0.22, h2h: 0.12 };
const ACC_CS = { dc: 0.4, shin: 0.44, api: 0.04, elo: 0.06, h2h: 0.06 };
const VAL_CS = { dc: 0.5, shin: 0, api: 0.12, elo: 0.22, h2h: 0.16 };
function mix(w, parts, hasShin) {
  const ww = hasShin ? w : { ...w, shin: 0 };
  const tot = ww.dc + ww.shin + ww.api + ww.elo + ww.h2h || 1;
  return (
    (ww.dc * parts.dc +
    ww.shin * parts.shin +
    ww.api * parts.api +
    ww.elo * parts.elo +
    ww.h2h * parts.h2h) /
    tot);

}
export function logit(p) {
  const q = clamp(p, 1e-4, 0.999);
  return Math.log(q / (1 - q));
}
export function invLogit(z) {
  if (z > 20) return 1 - 1e-6;
  if (z < -20) return 1e-6;
  return 1 / (1 + Math.exp(-z));
}
function logitPool(w, parts, hasShin) {
  const ww = hasShin ? w : { ...w, shin: 0 };
  let acc = 0;
  let tot = 0;
  ["dc", "shin", "api", "elo", "h2h"].forEach((k) => {
    const weight = ww[k];
    if (weight <= 0) return;
    acc += weight * logit(parts[k]);
    tot += weight;
  });
  if (tot <= 0) return parts.dc;
  return invLogit(acc / tot);
}
export function extremize(p, a) {
  return invLogit(a * logit(p));
}
export const SATOPAA_MAX = 0.18;
export const META_SE_WIN = 0.05;
export const META_SE_CS = 0.025;
export function metaHeterogeneity(ps, typicalSe = META_SE_WIN) {
  const xs = ps.filter((p) => Number.isFinite(p));
  const k = xs.length;
  if (k < 2) return { q: 0, i2: 0, tau2: 0, k };
  const mean = xs.reduce((a, b) => a + b, 0) / k;
  const v = Math.max(1e-8, typicalSe * typicalSe);
  let q = 0;
  for (const x of xs) q += (x - mean) ** 2 / v;
  const df = k - 1;
  const i2 = q <= df ? 0 : (q - df) / q;
  const C = df / v;
  const tau2 = Math.max(0, (q - df) / C);
  return { q, i2: clamp(i2, 0, 1), tau2, k };
}
export function satopaaA(i2) {
  return 1 + SATOPAA_MAX * (1 - clamp(i2, 0, 1));
}
export const OCCAM_DELTA = 20;
export const BMA_SE = 0.1;
export function accuracyPriors(family) {
  if (family === "btts") return ACC_BTTS;
  if (family === "cs") return ACC_CS;
  if (family === "ou") return ACC_OU;
  return ACC_WIN;
}
export function valuePriors(family) {
  if (family === "btts") return VAL_BTTS;
  if (family === "cs") return VAL_CS;
  if (family === "ou") return VAL_OU;
  return VAL_WIN;
}
export function expectedLogScore(p, reference) {
  const q = clamp(p, 1e-4, 0.999);
  const r = clamp(reference, 1e-4, 0.999);
  return r * Math.log(q) + (1 - r) * Math.log(1 - q);
}
export function bayesModelAverage(sources, reference, n, occamDelta = Infinity) {
  const empty = {
    weights: [],
    logLik: [],
    logPost: [],
    bfVsBest: [],
    dropped: [],
    pooled: reference,
    maxWeight: 0,
    bestIndex: 0
  };
  if (!sources.length) return empty;
  const twoS2 = 2 * BMA_SE * BMA_SE;
  const logLik = sources.map((s) =>
  n <= 0 ? 0 : -n * (s.p - reference) ** 2 / twoS2
  );
  const logPost = logLik.map(
    (ll, i) => ll + Math.log(Math.max(sources[i].prior, 1e-12))
  );
  const peak = Math.max(...logPost);
  let raw = logPost.map((z) => Math.exp(z - peak));
  let tot = raw.reduce((a, b) => a + b, 0) || 1;
  let weights = raw.map((x) => x / tot);
  const bestIndex = weights.reduce((b, w, i, arr) => w > arr[b] ? i : b, 0);
  const bfVsBest = logPost.map((lp) => Math.exp(logPost[bestIndex] - lp));
  const dropped = bfVsBest.map((bf) => bf > occamDelta);
  const kept = dropped.filter((d) => !d).length;
  if (Number.isFinite(occamDelta) && kept >= 1 && dropped.some(Boolean)) {
    raw = raw.map((x, i) => dropped[i] ? 0 : x);
    tot = raw.reduce((a, b) => a + b, 0) || 1;
    weights = raw.map((x) => x / tot);
  }
  const pooled = sources.reduce((acc, s, i) => acc + weights[i] * s.p, 0);
  return {
    weights,
    logLik,
    logPost,
    bfVsBest,
    dropped,
    pooled,
    maxWeight: Math.max(...weights),
    bestIndex
  };
}
export function stackMixture(sources, reference) {
  const k = sources.length;
  const zeros = () => Array.from({ length: k }, () => 0);
  if (!k) return { weights: [], pooled: reference };
  const priorTot = sources.reduce((a2, s) => a2 + s.prior, 0) || 1;
  const priorW = sources.map((s) => s.prior / priorTot);
  const loI = sources.reduce((b2, s, i, arr) => s.p < arr[b2].p ? i : b2, 0);
  const hiI = sources.reduce((b2, s, i, arr) => s.p > arr[b2].p ? i : b2, 0);
  if (sources[hiI].p - sources[loI].p < 1e-9) {
    return { weights: priorW, pooled: sources[0].p };
  }
  if (reference <= sources[loI].p) {
    const w2 = zeros();
    w2[loI] = 1;
    return { weights: w2, pooled: sources[loI].p };
  }
  if (reference >= sources[hiI].p) {
    const w2 = zeros();
    w2[hiI] = 1;
    return { weights: w2, pooled: sources[hiI].p };
  }
  let best = null;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      const a2 = sources[i].p;
      const b2 = sources[j].p;
      if (a2 <= reference && reference <= b2) {
        const pr = sources[i].prior + sources[j].prior;
        if (!best || pr > best.prior) best = { i, j, prior: pr };
      }
    }
  }
  if (!best)
  return {
    weights: priorW,
    pooled: sources.reduce((a2, s, i) => a2 + priorW[i] * s.p, 0)
  };
  const a = sources[best.i].p;
  const b = sources[best.j].p;
  const t = (reference - a) / (b - a);
  const w = zeros();
  w[best.i] = 1 - t;
  w[best.j] = t;
  return { weights: w, pooled: reference };
}
export function kassRafteryGrade(bfVsBest) {
  const twice = 2 * Math.log(Math.max(bfVsBest, 1));
  if (twice < 2) return "not worth a mention";
  if (twice < 6) return "positive";
  if (twice < 10) return "strong";
  return "very strong";
}
export function ensembleFamilyOf(kind) {
  if (
    kind === "home" ||
    kind === "away" ||
    kind === "draw" ||
    kind === "dc_1x" ||
    kind === "dc_x2" ||
    kind === "dc_12" ||
    kind === "ah" ||
    kind === "eh"
  ) {
    return "win";
  }
  if (kind === "btts_yes" || kind === "btts_no" || kind === "home_score" || kind === "away_score") {
    return "btts";
  }
  if (kind === "cs") return "cs";
  if (kind === "multi_goals" || kind === "odd_even" || kind === "combo") return "ou";
  return "ou";
}
export function ensembleForKind(kind, parts, weightSet: {
  accuracy?: { dc: number; shin: number; api: number; elo: number; h2h: number };
  value?: { dc: number; shin: number; api: number; elo: number; h2h: number };
} | null = null) {
  const hasShin = parts.shin != null;
  const shin = parts.shin ?? parts.dc;
  const packed = { dc: parts.dc, shin, api: parts.api, elo: parts.elo, h2h: parts.h2h };
  const family = ensembleFamilyOf(kind);
  const accW = weightSet?.accuracy ?? (family === "win" ? ACC_WIN : family === "btts" ? ACC_BTTS : family === "cs" ? ACC_CS : ACC_OU);
  const valW = weightSet?.value ?? (family === "win" ? VAL_WIN : family === "btts" ? VAL_BTTS : family === "cs" ? VAL_CS : VAL_OU);
  const accUse = hasShin ? { ...accW, api: 0 } : accW;
  const cluster = hasShin ? [parts.dc, parts.elo, parts.h2h, shin] : [parts.dc, parts.api, parts.elo, parts.h2h];
  const het = metaHeterogeneity(cluster, family === "cs" ? META_SE_CS : META_SE_WIN);
  const pooled = logitPool(accUse, packed, hasShin);
  const a = family === "cs" ? 1 : satopaaA(het.i2);
  const accuracy = clamp(extremize(pooled, a), family === "cs" ? 0.02 : 0.05, 0.97);
  const value = clamp(mix(valW, packed, false), family === "cs" ? 0.02 : 0.05, 0.97);
  const agreement = clamp(1 - het.i2, 0, 1);
  const labelled = [
  { name: "dixonColes", p: parts.dc },
  { name: "apiFootball", p: parts.api },
  { name: "hvattumElo", p: parts.elo },
  { name: "baioH2h", p: parts.h2h }];

  if (hasShin) labelled.push({ name: "shin", p: shin });
  labelled.sort((a2, b) => Math.abs(a2.p - accuracy) - Math.abs(b.p - accuracy));
  let best = labelled[0]?.name ?? "dixonColes";
  const dcGap = Math.abs(parts.dc - accuracy);
  const bestGap = Math.abs((labelled[0]?.p ?? parts.dc) - accuracy);
  if (dcGap <= bestGap + 0.008) best = "dixonColes";
  return { accuracy, value, agreement, i2: het.i2, best };
}

export function pickSanity(opts) {
  const tot = opts.lambdaH + opts.lambdaA;
  const odd = opts.odd ?? (opts.implied > 0 ? 1 / opts.implied : 1.9);
  if (opts.leagueWeight < 0.5) return "league too thin";
  if (opts.agreement < 0.18) return "models disagree";
  if (opts.kind === "player_ga") {
    if (!(opts.expectedMinutes > 20)) return "player G∪A needs minutes — NO BET";
    if (!(opts.playerOrP > 0) && !(opts.countLambda > 0)) return "player λ unavailable";
    if (opts.accuracy < 0.42) return "player G∪A too thin";
  }
  if (opts.kind === "corners" && !(opts.countLambda > 0)) return "corners λ unavailable";
  if (opts.kind === "cards" && !(opts.countLambda > 0)) return "cards λ unavailable";
  if (opts.kind === "under_15") return "Under 1.5 at 1.90 is a trap";
  if (opts.kind === "under_05") return "Under 0.5 is a lock";
  if (opts.kind === "away" && opts.lambdaA < opts.lambdaH + WIN_LAMBDA_GAP) return "away is not the favourite";
  if (opts.kind === "home" && opts.lambdaH < opts.lambdaA + WIN_LAMBDA_GAP) return "home lambda gap too thin";
  if (opts.kind === "home" && opts.implied < 0.4) return "book does not make home favourite";
  if (opts.kind === "away" && opts.implied < 0.4) return "book does not make away favourite";
  if (opts.kind === "over_25" && tot < 2.38) {
    const totH =
    opts.homeLast5Gf != null && opts.homeLast5Ga != null ? opts.homeLast5Gf + opts.homeLast5Ga : null;
    const formOver =
    (opts.h2hN ?? 0) >= 5 && (opts.h2hOver25 ?? 0) >= 0.5 || totH != null && totH >= 3.2;
    if (!formOver) return "lambda too low for Over 2.5";
  }
  if (opts.kind === "under_25" && tot > 2.62) return "lambda too high for Under 2.5";
  if (opts.kind === "under_25" && odd < 1.55) return "Under 2.5 shorter than 1.55 is a lock";
  if (opts.kind === "over_15" && tot < 1.45) return "lambda too low for Over 1.5";
  if (opts.kind === "over_15" && tot >= 1.95 && odd >= 1.6) {
    return "Over 1.5 at 1.70+ is not the full-match 1.5 line";
  }
  if (opts.kind === "over_15" && tot > 2.45 && odd >= 1.85) {
    return "lambda too high for Over 1.5 at 1.90";
  }
  if (opts.kind === "over_05" && tot < 1.35) return "lambda too low for Over 0.5";
  if (opts.kind === "over_35" && tot < 3.15) return "lambda too low for Over 3.5";
  if (opts.kind === "under_35" && tot > 3.55) return "lambda too high for Under 3.5";
  if (opts.kind === "over_45" && tot < 4.05) return "lambda too low for Over 4.5";
  if (opts.kind === "under_45" && tot > 4.45) return "lambda too high for Under 4.5";
  if (opts.kind === "draw") {
    if (opts.accuracy < 0.26) return "draw not elevated";
    if (odd < 2.4 || odd > 5) return "draw odds outside 2.4–5.0";
    if ((opts.gridDraw ?? 0) < 0.23) return "grid draw not elevated";
  }
  if (opts.kind === "dc_1x" || opts.kind === "dc_x2" || opts.kind === "dc_12") {
    if (opts.accuracy < 0.62) return "double chance coverage too thin";
  }
  if (opts.kind === "home_score" || opts.kind === "away_score") {
    if (opts.accuracy < 0.7) return "team-to-score below 70%";
    if (odd < 1.1) return "team-to-score odds too short";
  }
  if (opts.kind === "ah") {
    if ((opts.ahCover ?? opts.accuracy) < 0.5) return "AH cover too thin";
    if (!((opts.ahEv ?? -1) > 0)) return "AH expected return not positive";
    if (opts.ahStability === "low") return "AH line is unstable";
  }
  if (opts.kind === "odd_even" && opts.accuracy < 0.54) return "odd/even is a coin";
  if (opts.kind === "multi_goals" && opts.accuracy < 0.4) return "multi-goals range too thin";
  if (opts.kind === "combo" && opts.accuracy < 0.4) return "combo joint P too thin";
  if (opts.kind === "corners" && opts.accuracy < 0.52) return "corners cover too thin";
  if (opts.kind === "ou_asian") {
    if ((opts.ahCover ?? opts.accuracy) < 0.5) return "Asian total cover too thin";
    if (!((opts.ahEv ?? -1) > 0)) return "Asian total EV not positive";
    const cnt = parseCountSelection(String(opts.selection ?? ""));
    if (cnt) {
      if (cnt.side === "over" && tot < cnt.line - 0.2) return "lambda too low for this over line";
      if (cnt.side === "under" && tot > cnt.line + 0.2) return "lambda too high for this under line";
    }
  }
  if ((opts.kind === "home" || opts.kind === "away") && (opts.drawRisk ?? 0) >= 78) {
    return "draw risk too high for a straight win";
  }
  if ((opts.kind === "home" || opts.kind === "away") && (opts.upsetRisk ?? 0) >= 78) {
    return "upset risk too high for a straight win";
  }
  if (opts.kind === "draw" && opts.drawConcentration != null && opts.drawConcentration < 0.55) {
    return "draw mass not in 0-0…3-3";
  }
  if (opts.kind === "btts_yes" && (opts.crossFlags ?? []).includes("BTTS exceeds team-to-score")) {
    return "BTTS exceeds team-to-score";
  }
  if (opts.kind === "cs" && (opts.crossFlags ?? []).some((f) => /CS fights/.test(String(f)))) {
    return "CS fights another market";
  }
  if (opts.kind === "over_25" && opts.implied < 0.42) return "book does not make Over 2.5 favourite";
  if (opts.kind === "under_25" && opts.implied < 0.42) return "book does not make Under 2.5 favourite";
  if (opts.kind === "over_15" && opts.implied < 0.42) return "Over 1.5 at this price is a quiet match";
  if (opts.kind === "btts_yes" && (opts.lambdaH < 0.82 || opts.lambdaA < 0.72)) return "a side rarely scores";
  if (opts.kind === "btts_yes" && (opts.bttsFailSeverity ?? 0) >= 0.55) return "BTTS failure modes";
  if (opts.kind === "btts_yes" && ((opts.homeFts ?? 0) > 0.48 || (opts.awayFts ?? 0) > 0.48)) {
    return "failed-to-score too high for BTTS yes";
  }
  if (opts.kind === "btts_yes" && (opts.homeCs ?? 0) > 0.5 && (opts.awayFts ?? 0) > 0.35) {
    return "home keeps a clean sheet too often";
  }
  if (opts.kind === "btts_yes" && (opts.awayCs ?? 0) > 0.5 && (opts.homeFts ?? 0) > 0.35) {
    return "away keeps a clean sheet too often";
  }
  if (opts.kind === "btts_yes" && (opts.h2hN ?? 0) >= 5 && opts.h2hBtts != null && opts.h2hBtts <= 0.35) {
    return "last-5 H2H is not BTTS";
  }
  if (
  opts.kind === "btts_yes" &&
  opts.homeBtts != null &&
  opts.awayBtts != null &&
  Math.min(opts.homeBtts, opts.awayBtts) <= 0.28)
  {
    return "one side rarely does BTTS";
  }
  if (
  opts.kind === "btts_yes" && (
  opts.awayLast5Gf != null && opts.awayLast5Gf <= 0.85 ||
  opts.homeLast5Gf != null && opts.homeLast5Gf <= 0.85))
  {
    return "a side's last-five attack is too thin for BTTS";
  }
  if (opts.scoreline && scorelineContradictsKind(opts.scoreline, opts.kind)) {
    return "modal scoreline contradicts the selection";
  }
  if (opts.kind === "btts_no") {
    if (!bttsNoAllQuiet(opts)) return "BTTS No needs λ, last-5 GF and last-5 H2H all quiet";
    if (tot > 2.62 && opts.lambdaH >= 1 && opts.lambdaA >= 1) return "both sides score too often";
    const ftsH = opts.homeFts;
    const ftsA = opts.awayFts;
    if (ftsH != null && ftsA != null && ftsH < 0.36 && ftsA < 0.36) {
      return "both sides usually score";
    }
    const bh = opts.homeBtts;
    const ba = opts.awayBtts;
    if (bh != null && ba != null && (bh + ba) / 2 >= 0.55) {
      return "recent matches are BTTS";
    }
    const oH = opts.homeOver15;
    const oA = opts.awayOver15;
    if (
    oH != null &&
    oA != null &&
    oH >= 0.7 &&
    oA >= 0.7 && (
    ftsH == null || ftsH < 0.4) && (
    ftsA == null || ftsA < 0.4))
    {
      return "both sides play over 1.5";
    }
    if ((opts.h2hBtts ?? 0) >= 0.55 && (opts.h2hN ?? 0) >= 5) {
      return "H2H is BTTS yes";
    }
  }
  if (opts.kind === "home") {
    const wr = winRateFromForm(opts.homeForm);
    const n = String(opts.homeForm ?? "").replace(/[^WDL]/gi, "").length;
    if (wr != null && n >= 5 && wr <= 0.2) return "home form is cold";
    if ((opts.gridDraw ?? 0) >= WIN_DRAW_MASS_MAX) return "draw mass too high for a straight win";
    if ((opts.h2hN ?? 0) >= 5 && opts.h2hHome != null && opts.h2hHome <= 0.2) {
      return "last-5 H2H is not a home win";
    }
  }
  if (opts.kind === "away") {
    const wr = winRateFromForm(opts.awayForm);
    const n = String(opts.awayForm ?? "").replace(/[^WDL]/gi, "").length;
    if (wr != null && n >= 5 && wr <= 0.2) return "away form is cold";
    if ((opts.gridDraw ?? 0) >= WIN_DRAW_MASS_MAX) return "draw mass too high for a straight win";
    if ((opts.h2hN ?? 0) >= 5 && opts.h2hAway != null && opts.h2hAway <= 0.2) {
      return "last-5 H2H is not an away win";
    }
  }
  if (opts.kind === "cs" && (!opts.bookmaker || /model fair/i.test(opts.bookmaker))) {
    return "no posted CS book";
  }
  if (opts.h2hConflict === "thrash") return "last H2H was a thrashing against this side";
  if (opts.kind === "over_15" && opts.recentTotal != null && opts.recentTotal > 3.4 && odd > 1.7) {
    return "recent scoring makes Over 1.5 a short price";
  }
  if (opts.kind === "under_25") {
    if ((opts.h2hN ?? 0) >= 5 && opts.h2hOver25 != null && opts.h2hOver25 >= 0.55) {
      return "last-5 H2H goes over 2.5";
    }
    const totH =
    opts.homeLast5Gf != null && opts.homeLast5Ga != null ? opts.homeLast5Gf + opts.homeLast5Ga : null;
    const totA =
    opts.awayLast5Gf != null && opts.awayLast5Ga != null ? opts.awayLast5Gf + opts.awayLast5Ga : null;
    if (totH != null && totH >= 3.2 || totA != null && totA >= 3.2) {
      return "a side's last-five is a 3-goal game";
    }
  }
  if (opts.kind === "over_25") {
    if ((opts.h2hN ?? 0) >= 5 && opts.h2hOver25 != null && opts.h2hOver25 <= 0.3) {
      return "last-5 H2H stays under 2.5";
    }
  }
  if (opts.kind !== "cs" && opts.kind !== "draw" && opts.kind !== "ah" && opts.kind !== "ou_asian" && opts.kind !== "combo" && opts.kind !== "multi_goals" && opts.kind !== "odd_even" && opts.kind !== "corners" && opts.kind !== "player_ga" && opts.accuracy >= 0.58) {
    const fair = 1 / opts.accuracy;
    if (odd > fair * 1.32) return "posted price is a gift vs the model";
  }
  const edge = opts.accuracy - opts.implied;
  const ev = opts.accuracy * odd;
  if (opts.kind === "cs") {
    if (opts.selection && !isPlayableCsScore(opts.selection)) return "not a modal scoreline";
    if (edge < 0) return "CS cell below the book";
    if (opts.accuracy < MIN_CS_CELL) return "CS cell too thin";
    const conc = csConcentration(opts.csTopScores);
    if ((opts.csTopScores?.length ?? 0) >= 2 && conc.margin < CS_TOP_MARGIN_MIN) {
      return "CS ranking is a coin";
    }
    if ((opts.csTopScores?.length ?? 0) >= 3 && conc.top3 < CS_TOP3_MIN) {
      return "CS mass is too spread";
    }
    if (
      opts.selection &&
      opts.gridHome != null &&
      opts.gridAway != null &&
      !csAgreesWith1x2(opts.selection, opts.gridHome, opts.gridDraw ?? 0, opts.gridAway)
    ) {
      return "CS cell fights the 1X2 cluster";
    }
    const sel = parseScore(String(opts.selection ?? ""));
    if (sel) {
      if (sel.home + sel.away === 0 && tot >= 2.7) return "0-0 in a scoring game";
      if (sel.home + sel.away >= 4 && tot <= 2.15) return "4-goal score in a quiet game";
    }
  } else if (opts.kind === "ah" || opts.kind === "ou_asian" || opts.kind === "combo" || opts.kind === "multi_goals" || opts.kind === "odd_even") {
    /* settlement EV / own accuracy floors already gated */
  } else if (opts.kind === "draw") {
    if (ev < 0.92) return "negative EV";
    if (edge < -0.01) return "model below the book";
  } else {
    if (ev < 0.96) return "negative EV";
    if (edge < -0.01) return "model below the book";
  }
  if (contradictsAdvice(opts.kind, opts)) return "API advice contradicts";
  return null;
}

export function contradictsAdvice(kind, opts) {
  const a = (opts.advice ?? "").toLowerCase();
  const winner = (opts.winner ?? "").toLowerCase();
  const home = opts.home.toLowerCase();
  const away = opts.away.toLowerCase();
  if (kind === "home") {
    if (winner && away && winner === away) return true;
    if (/winner\s*:\s*away/.test(a)) return true;
    if (/double chance\s*:\s*away/.test(a)) return true;
  }
  if (kind === "away") {
    if (winner && home && winner === home) return true;
    if (/winner\s*:\s*home/.test(a)) return true;
    if (/double chance\s*:\s*home/.test(a)) return true;
  }
  if ((kind === "over_15" || kind === "over_25" || kind === "over_35" || kind === "over_45") && /under\s*[1234]\.5/.test(a) && !/over\s*[1234]\.5/.test(a)) {
    return true;
  }
  if ((kind === "under_15" || kind === "under_25" || kind === "under_35" || kind === "under_45") && /over\s*[1234]\.5/.test(a) && !/under\s*[1234]\.5/.test(a)) {
    return true;
  }
  if (kind === "btts_yes" && /btts\s*:\s*no|btts\s+no|both teams to score\s*:\s*no|both teams not to score/.test(a)) {
    return true;
  }
  if (kind === "btts_no" && /btts\s*:\s*yes|both teams to score\s*:\s*yes/.test(a) && !/:\s*no/.test(a)) {
    return true;
  }
  if ((kind === "over_15" || kind === "over_25") && /-\s*1\.5/.test(a) && !/\+\s*[123]\.5/.test(a)) {
    return true;
  }
  if (kind === "over_25" && /-\s*2\.5/.test(a) && !/\+\s*[23]\.5/.test(a)) {
    return true;
  }
  if ((kind === "under_15" || kind === "under_25") && /\+\s*[23]\.5/.test(a) && !/-\s*[123]\.5/.test(a)) {
    return true;
  }
  return false;
}

/** API combo line only stays on the card when it talks about this market. */
export function adviceForKind(kind, advice) {
  if (!advice) return null;
  const a = String(advice).toLowerCase();
  if (kind === "btts_yes" || kind === "btts_no") {
    return /btts|both teams to score/.test(a) ? advice : null;
  }
  if (kind === "over_15" || kind === "over_25" || kind === "under_15" || kind === "under_25" || kind === "over_05" || kind === "under_05" || kind === "over_35" || kind === "under_35" || kind === "over_45" || kind === "under_45" || kind === "ou_asian") {
    if (contradictsAdvice(kind, { advice, winner: null, home: "", away: "" })) return null;
    if ((kind.startsWith("over") ) && /-\s*[123]\.5/.test(a)) return null;
    if ((kind.startsWith("under") ) && /\+\s*[123]\.5/.test(a)) return null;
    if (/double chance|winner\s*:/.test(a) && !/\bover\b|\bunder\b/.test(a)) return null;
    return /goal|over|under/.test(a) ? advice : null;
  }
  if (kind === "home" || kind === "away") {
    if (/double chance/.test(a) && !/winner\s*:/.test(a)) return null;
    return /winner|double chance/.test(a) ? advice : null;
  }
  if (kind === "draw") {
    return /draw/.test(a) ? advice : null;
  }
  if (kind === "dc_1x" || kind === "dc_x2" || kind === "dc_12") {
    return /double chance/.test(a) ? advice : null;
  }
  return advice;
}

export function kindHitPrior(kind) {
  switch (kind) {
    case "over_15":
      return 1.04;
    case "home":
      return 1.08;
    case "btts_yes":
      return 1.02;
    case "over_25":
      return 0.98;
    case "under_25":
      return 0.88;
    case "btts_no":
      return 0.94;
    case "away":
      return 0.8;
    case "cs":
      return 0.88;
    case "draw":
      return 0.9;
    case "dc_1x":
    case "dc_x2":
      return 1.02;
    case "dc_12":
      return 0.95;
    case "home_score":
    case "away_score":
      return 1;
    case "ah":
    case "eh":
    case "ou_asian":
      return 1;
    case "over_05":
      return 0.72;
    case "over_35":
      return 0.96;
    case "under_35":
      return 0.94;
    case "over_45":
    case "under_45":
      return 0.9;
    case "cards":
    case "corners":
      return 0.92;
    case "player_ga":
      return 0.5;
    case "multi_goals":
      return 0.92;
    case "odd_even":
      return 0.88;
    case "combo":
      return 0.9;
    default:
      return 1;
  }
}

export function compositeScore(opts) {
  const edgeTerm = 1 + clamp(opts.value - opts.implied, -0.04, 0.1) * 2.4;
  const calTerm = 1 + clamp(opts.accuracy - opts.implied, -0.03, 0.1) * 3.2;
  const uncertTerm = 1 / (1 + 0.55 * clamp(opts.lambdaSe ?? 0.12, 0, 0.8));
  return (
    opts.accuracy * (
    0.5 + 0.5 * opts.agreement) *
    opts.leagueWeight *
    edgeTerm *
    calTerm *
    uncertTerm *
    bandQuality(opts.odd, opts.bandMid ?? 1.925) *
    kindHitPrior(opts.kind ?? "home") * (
    0.55 + 0.45 * clamp(opts.dataQuality ?? 1, 0.2, 1)));

}

export function breakdownFromParts(parts) {
  return {
    dixonColes: parts.dc,
    shin: parts.shin,
    apiFootball: parts.api,
    hvattumElo: parts.elo,
    baioH2h: parts.h2h,
    maher: parts.maher,
    karlisNtzoufras: parts.karlis,
    negBin: parts.negBin
  };
}
export function pForKind(kind, m) {
  switch (kind) {
    case "home":
      return m.home;
    case "away":
      return m.away;
    case "draw":
      return m.draw;
    case "btts_yes":
      return m.bttsYes;
    case "btts_no":
      return m.bttsNo;
    case "over_05":
      return m.over05;
    case "under_05":
      return m.under05;
    case "over_15":
      return m.over15;
    case "under_15":
      return m.under15;
    case "over_25":
      return m.over25;
    case "under_25":
      return m.under25;
    case "over_35":
      return m.over35;
    case "under_35":
      return m.under35;
    case "over_45":
      return m.over45;
    case "under_45":
      return m.under45;
    case "home_score":
      return m.homeScore;
    case "away_score":
      return m.awayScore;
    case "dc_1x":
      return m.dc1x;
    case "dc_x2":
      return m.dcx2;
    case "dc_12":
      return m.dc12;
    case "cs":
      return m.scorelineP;
    default:
      return 0;
  }
}

export const HUBER_K_GD = 1.8;
export const HUBER_K_GF = 1.8;

export function huberWeight(r, k) {
  const a = Math.abs(r);
  if (!(a > k)) return 1;
  return k / a;
}

export function winsorGoalRate(x, league) {
  const r = x - league;
  const w = huberWeight(r, HUBER_K_GF);
  return league + w * r;
}

export function karlisOutlierScale(gf, ga, opts = {}) {
  if (gf == null || ga == null) return 1;
  if (gf <= ga + 0.15) return 1;
  const gd = gf - ga;
  const w = huberWeight(gd, HUBER_K_GD);
  if (w >= 1) return 1;
  const n = opts?.n ?? 10;
  const nPen = 0.85 + 0.15 * (n / (n + 4));
  return clamp((0.7 + 0.3 * w) * nPen, 0.72, 1);
}

export function borsH2hWeight(base, piMass, shinH) {
  if (shinH == null) return base;
  const agree = (piMass - 0.5) * (shinH - 0.5);
  if (agree > 0) return clamp(base * 1.18, 0, 0.28);
  return clamp(base * 0.62, 0, 0.2);
}

export function pennDonnellyScale(rank, size, formMom) {
  if (rank <= size / 2 && formMom > 0.65) return formMom;
  return 1;
}

export function formMomentum(form) {
  if (!form) return 0.5;
  const chars = String(form).replace(/[^WDL]/gi, "").split("");
  if (!chars.length) return 0.5;
  let acc = 0;
  let wsum = 0;
  let w = 1;
  for (const ch of chars) {
    const v = ch === "W" || ch === "w" ? 1 : ch === "L" || ch === "l" ? 0 : 0.5;
    acc += w * v;
    wsum += w;
    w *= 0.65;
  }
  return wsum ? acc / wsum : 0.5;
}

export function wheatcroftCodTilt(rank, size, form) {
  const mom = formMomentum(form);
  const quality = 1 - (rank - 1) / Math.max(1, size - 1);
  if (Math.abs(mom - 0.5) < 0.18) return 0;
  return (quality - mom) * 0.22;
}

export function orderedLogitProbs(wrH, wrA, rankDiff) {
  const strength = wrH - wrA - 0.025 * rankDiff;
  const home = clamp(0.33 + 0.42 * strength, 0.12, 0.78);
  const away = clamp(0.33 - 0.42 * strength, 0.08, 0.7);
  const draw = clamp(1 - home - away, 0.08, 0.4);
  const s = home + draw + away || 1;
  return { home: home / s, draw: draw / s, away: away / s };
}

export function naDrawBoost(shinD, gridD) {
  if (shinD == null) return 0;
  if (gridD - shinD >= 0.08) return 0.03;
  return 0;
}

export function closeTableH2hDrawBoost(h2hDrawRate, rankGapAbs, h2hN) {
  if (h2hN < 4) return 0;
  if (h2hDrawRate < 0.35) return 0;
  if (rankGapAbs != null && rankGapAbs > 6) return 0;
  return 0.02;
}

export function inflateDraw(grid, extra) {
  if (!(extra > 0)) return grid.map((row) => row.slice());
  const out = grid.map((row) => row.slice());
  let drawMass = 0;
  let rest = 0;
  for (let x = 0; x < out.length; x++) {
    for (let y = 0; y < out[x].length; y++) {
      if (x === y) drawMass += out[x][y];else
      rest += out[x][y];
    }
  }
  const target = clamp(drawMass + extra, 0.05, 0.5);
  const scaleD = drawMass > 0 ? target / drawMass : 1;
  const scaleR = rest > 0 ? (1 - target) / rest : 1;
  for (let x = 0; x < out.length; x++) {
    for (let y = 0; y < out[x].length; y++) {
      out[x][y] *= x === y ? scaleD : scaleR;
    }
  }
  let sum = 0;
  for (const row of out) for (const v of row) sum += v;
  if (sum > 0) {
    for (const row of out) {
      for (let y = 0; y < row.length; y++) row[y] /= sum;
    }
  }
  return out;
}

export function latestH2hConflicts(h2h, kind) {
  if (!h2h || !h2h.length) return null;
  const newest = [...h2h].sort((a, b) => (a.daysAgo ?? 9e9) - (b.daysAgo ?? 9e9));
  const gdOf = (row) => {
    const hg = row.homeIsCurrentHome ? row.homeGoals : row.awayGoals;
    const ag = row.homeIsCurrentHome ? row.awayGoals : row.homeGoals;
    return hg - ag;
  };
  const last = newest[0];
  const gd = gdOf(last);
  if (kind === "home" && gd <= -3) return "thrash";
  if (kind === "away" && gd >= 3) return "thrash";
  if (newest.length >= 2) {
    const gd1 = gdOf(newest[0]);
    const gd2 = gdOf(newest[1]);
    if (kind === "home" && gd1 < 0 && gd2 < 0) return "thrash";
    if (kind === "away" && gd1 > 0 && gd2 > 0) return "thrash";
  }
  if (kind === "home" && gd < 0) return "lean";
  if (kind === "away" && gd > 0) return "lean";
  return null;
}

/** Last-N H2H rates as posted on a results page — unweighted, newest first. */
export function h2hMarketRates(h2h, n = 5) {
  if (!h2h || !h2h.length) {
    return { n: 0, btts: null, over15: null, over25: null, home: null, away: null, draw: null };
  }
  const newest = [...h2h].sort((a, b) => (a.daysAgo ?? 9e9) - (b.daysAgo ?? 9e9)).slice(0, n);
  let btts = 0;
  let o15 = 0;
  let o25 = 0;
  let homeW = 0;
  let awayW = 0;
  for (const row of newest) {
    const hg = row.homeIsCurrentHome ? row.homeGoals : row.awayGoals;
    const ag = row.homeIsCurrentHome ? row.awayGoals : row.homeGoals;
    if (hg >= 1 && ag >= 1) btts += 1;
    if (hg + ag >= 2) o15 += 1;
    if (hg + ag >= 3) o25 += 1;
    if (hg > ag) homeW += 1;else
    if (ag > hg) awayW += 1;
  }
  const k = newest.length;
  return {
    n: k,
    btts: btts / k,
    over15: o15 / k,
    over25: o25 / k,
    home: homeW / k,
    away: awayW / k,
    draw: (k - homeW - awayW) / k
  };
}

/** Last-5 H2H + last-5 totals → BTTS / O/U targets the grid must match. */
export function formMarketTargets(opts) {
  const h = opts.h2hRates ?? { n: 0, btts: null, over15: null, over25: null };
  const totH =
  opts.homeLast5Gf != null && opts.homeLast5Ga != null ? opts.homeLast5Gf + opts.homeLast5Ga : null;
  const totA =
  opts.awayLast5Gf != null && opts.awayLast5Ga != null ? opts.awayLast5Gf + opts.awayLast5Ga : null;
  let over25 = h.over25;
  let over15 = h.over15;
  if (totH != null && totA != null) {
    const tot = 0.6 * totH + 0.4 * totA;
    const p25 = clamp(1 - poissonPmf(0, tot) - poissonPmf(1, tot) - poissonPmf(2, tot), 0.05, 0.95);
    const p15 = clamp(1 - poissonPmf(0, tot) - poissonPmf(1, tot), 0.08, 0.97);
    over25 = over25 != null ? 0.55 * over25 + 0.45 * p25 : p25;
    over15 = over15 != null ? 0.55 * over15 + 0.45 * p15 : p15;
  }
  if (opts.homeLast5Over25 != null && opts.awayLast5Over25 != null) {
    const emp = 0.6 * opts.homeLast5Over25 + 0.4 * opts.awayLast5Over25;
    over25 = over25 != null ? 0.55 * over25 + 0.45 * emp : emp;
  }
  let btts = h.btts;
  if (opts.homeBtts != null && opts.awayBtts != null) {
    const last5 = 0.5 * opts.homeBtts + 0.5 * opts.awayBtts;
    btts = btts != null ? 0.55 * btts + 0.45 * last5 : last5;
  }
  const fromLast5 = totH != null || opts.homeBtts != null && opts.awayBtts != null;
  return { n: h.n ?? 0, btts, over15, over25, fromLast5 };
}

export function marketAgreesWithHistory(histH, histA, mktH, mktA) {
  const ht = histH + histA;
  const mt = mktH + mktA;
  if (ht < 0.5 || mt < 0.5) return false;
  const totRel = Math.abs(mt - ht) / ht;
  const shareH = histH / ht;
  const shareM = mktH / mt;
  return totRel < 0.38 && Math.abs(shareH - shareM) < 0.22;
}

export function winRateFromForm(form) {
  if (!form) return null;
  const chars = String(form).replace(/[^WDL]/gi, "");
  if (!chars.length) return null;
  let w = 0;
  for (const ch of chars) if (ch === "W" || ch === "w") w += 1;
  return w / chars.length;
}

export function totalSurvival(grid) {
  const max = 16;
  const by = Array.from({ length: max }, () => 0);
  for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[x].length; y++) {
      const t = x + y;
      if (t < max) by[t] += grid[x][y];
    }
  }
  const s = Array.from({ length: max }, () => 0);
  let cdf = 0;
  for (let k = 0; k < max; k++) {
    s[k] = 1 - cdf;
    cdf += by[k];
  }
  return s;
}
