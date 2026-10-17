/**
 * Corners module — totals, team O/U, handicap, winner.
 * Real counts only. Missing λ is unavailable, never 0.
 * Self-contained (no import from markets-engine) to avoid a cycle.
 */

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

function negBinPmf(k: number, mean: number, r: number): number {
  if (k < 0 || mean <= 0) return k === 0 ? 1 : 0;
  const rr = Math.max(0.4, r);
  const p = rr / (rr + mean);
  let coeff = 1;
  for (let i = 1; i <= k; i++) coeff *= (rr + i - 1) / i;
  return coeff * Math.pow(p, rr) * Math.pow(1 - p, k);
}

type Settlement = "full_win" | "half_win" | "push" | "half_loss" | "full_loss";

export interface CornerAsian {
  fullWin: number;
  halfWin: number;
  push: number;
  halfLoss: number;
  loss: number;
}

function splitAsianLine(h: number): number[] {
  if (!Number.isFinite(h)) return [];
  const q = Math.round(h * 4);
  if (Math.abs(h * 4 - q) > 1e-6) return [h];
  if (q % 2 === 0) return [h];
  const lo = Math.floor(h * 2) / 2 || 0;
  const hi = Math.ceil(h * 2) / 2 || 0;
  return lo === hi ? [h] : [lo, hi];
}

function settleWholeOrHalf(diff: number, line: number): Settlement {
  const cover = diff + line;
  if (Math.abs(cover) < 1e-9) return "push";
  if (cover > 0) return "full_win";
  return "full_loss";
}

function mergeHalfStakes(a: Settlement, b: Settlement): Settlement {
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

function settleAsian(diff: number, line: number): Settlement {
  const parts = splitAsianLine(line);
  if (parts.length === 1) return settleWholeOrHalf(diff, parts[0]!);
  return mergeHalfStakes(settleWholeOrHalf(diff, parts[0]!), settleWholeOrHalf(diff, parts[1]!));
}

function poissonOver(lambda: number | null, line: number): number | null {
  if (lambda == null || !Number.isFinite(lambda) || lambda <= 0) return null;
  if (!Number.isFinite(line)) return null;
  const maxUnder = Math.floor(line);
  let under = 0;
  for (let k = 0; k <= maxUnder; k++) under += poissonPmf(k, lambda);
  return clamp(1 - under, 0, 1);
}

function poissonOverAsian(lambda: number | null, line: number): CornerAsian | null {
  if (lambda == null || !Number.isFinite(lambda) || lambda <= 0) return null;
  const out: CornerAsian = { fullWin: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 0 };
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

function asianCoverP(o: CornerAsian): number {
  return clamp(o.fullWin + 0.5 * o.halfWin, 0, 1);
}

function asianExpectedReturn(o: CornerAsian, odd: number): number {
  const profit = odd - 1;
  return 1 + o.fullWin * profit + o.halfWin * (profit / 2) + o.halfLoss * (-0.5) + o.loss * -1;
}

export const CORNER_GRID_MAX = 16;

export interface CornerLambdas {
  lambdaH: number;
  lambdaA: number;
  lambdaT: number;
  n: number;
  vmr: number | null;
}

export type CornerMarket =
  | { variant: "total"; side: "over" | "under"; line: number }
  | { variant: "team"; team: "home" | "away"; side: "over" | "under"; line: number }
  | { variant: "handicap"; side: "home" | "away"; line: number }
  | { variant: "winner"; side: "home" | "away" | "draw" };

export interface CornerRates {
  forPerMatch: number | null;
  againstPerMatch: number | null;
  forHome: number | null;
  forAway: number | null;
  againstHome: number | null;
  againstAway: number | null;
  n?: number | null;
  vmr?: number | null;
}

/**
 * Opponent-adjusted λ_home / λ_away.
 * Does not add a team's for to the opponent's against without a league scale.
 * Either side missing → null (missing ≠ 0).
 */
export function cornerLambdas(opts: {
  home: CornerRates;
  away: CornerRates;
  leagueAvg?: number | null;
}): CornerLambdas | null {
  const hAtt = opts.home.forHome ?? opts.home.forPerMatch;
  const aAtt = opts.away.forAway ?? opts.away.forPerMatch;
  if (hAtt == null || aAtt == null) return null;
  if (!Number.isFinite(hAtt) || !Number.isFinite(aAtt) || hAtt <= 0 || aAtt <= 0) return null;

  const hDef = opts.home.againstHome ?? opts.home.againstPerMatch;
  const aDef = opts.away.againstAway ?? opts.away.againstPerMatch;
  const nH = opts.home.n ?? 0;
  const nA = opts.away.n ?? 0;
  const n = Math.min(nH || 8, nA || 8);

  let lambdaH = hAtt;
  let lambdaA = aAtt;
  const parts = [hAtt, aAtt, hDef, aDef].filter((x): x is number => x != null && x > 0);
  const league =
    opts.leagueAvg != null && opts.leagueAvg > 0.5 ? opts.leagueAvg : parts.length ? parts.reduce((s, x) => s + x, 0) / parts.length : null;

  if (aDef != null && aDef > 0 && league != null && league > 0) lambdaH = (hAtt * aDef) / league;
  if (hDef != null && hDef > 0 && league != null && league > 0) lambdaA = (aAtt * hDef) / league;

  lambdaH = clamp(lambdaH, 0.6, 12);
  lambdaA = clamp(lambdaA, 0.6, 12);
  const vmrs = [opts.home.vmr, opts.away.vmr].filter((v): v is number => v != null && v > 1.25 && v < 3.5);
  const vmr = vmrs.length ? vmrs.reduce((s, v) => s + v, 0) / vmrs.length : null;
  return { lambdaH, lambdaA, lambdaT: clamp(lambdaH + lambdaA, 2, 20), n, vmr };
}

/** Independent Poisson (default). NegBin mix only when a real VMR is supplied. */
export function bivariateCornerGrid(
  lambdaH: number,
  lambdaA: number,
  opts: { vmr?: number | null; max?: number } = {},
): number[][] {
  const max = opts.max ?? CORNER_GRID_MAX;
  const vmr = opts.vmr;
  const useNb = vmr != null && vmr > 1.25 && vmr < 4;
  const rH = useNb ? lambdaH / Math.max((vmr as number) - 1, 0.05) : 8;
  const rA = useNb ? lambdaA / Math.max((vmr as number) - 1, 0.05) : 8;
  const pmfH = (k: number) =>
    useNb ? 0.65 * poissonPmf(k, lambdaH) + 0.35 * negBinPmf(k, lambdaH, rH) : poissonPmf(k, lambdaH);
  const pmfA = (k: number) =>
    useNb ? 0.65 * poissonPmf(k, lambdaA) + 0.35 * negBinPmf(k, lambdaA, rA) : poissonPmf(k, lambdaA);
  const grid: number[][] = [];
  let mass = 0;
  for (let h = 0; h <= max; h++) {
    const row: number[] = [];
    const ph = pmfH(h);
    for (let a = 0; a <= max; a++) {
      const p = ph * pmfA(a);
      row.push(p);
      mass += p;
    }
    grid.push(row);
  }
  if (mass > 0 && Math.abs(mass - 1) > 1e-6) {
    for (const row of grid) {
      for (let i = 0; i < row.length; i++) row[i] = (row[i] ?? 0) / mass;
    }
  }
  return grid;
}

export type CornerNbLine = {
  line: number;
  poisson: number;
  negbin: number;
  marginMix: number;
  totalMix: number;
};

/**
 * Corner totals at one VMR.
 * Two independent NB2 margins with the same VMR sum to one NB2 on the total (same p).
 * The desk does not price that. It mixes each margin 65% Poisson / 35% NB, so both
 * margins are NegBin only 0.35² of the time. A 35% mix of the finished totals is fatter.
 */
export function negBinCornerInvestigate(lambdaH: number, lambdaA: number, vmr: number): {
  mean: number;
  rH: number;
  rA: number;
  rTotal: number;
  varPoisson: number;
  varFull: number;
  varDesk: number;
  open: boolean;
  bothNbWeight: number;
  lines: CornerNbLine[];
  singleNbOver95: number;
} {
  const lh = Math.max(0.2, lambdaH);
  const la = Math.max(0.2, lambdaA);
  const mean = lh + la;
  const open = vmr > 1.25 && vmr < 3.5;
  const excess = vmr > 1.01 ? vmr - 1 : 0;
  const rH = excess > 0 ? lh / excess : Number.POSITIVE_INFINITY;
  const rA = excess > 0 ? la / excess : Number.POSITIVE_INFINITY;
  const rTotal = excess > 0 ? mean / excess : Number.POSITIVE_INFINITY;
  const varFull = excess > 0 ? vmr * mean : mean;
  const varDesk = excess > 0 ? (0.65 + 0.35 * vmr) * mean : mean;
  const nbH = (k: number) => (excess > 0 ? negBinPmf(k, lh, rH) : poissonPmf(k, lh));
  const nbA = (k: number) => (excess > 0 ? negBinPmf(k, la, rA) : poissonPmf(k, la));
  const mixH = (k: number) => 0.65 * poissonPmf(k, lh) + 0.35 * nbH(k);
  const mixA = (k: number) => 0.65 * poissonPmf(k, la) + 0.35 * nbA(k);
  const poiH = (k: number) => poissonPmf(k, lh);
  const poiA = (k: number) => poissonPmf(k, la);
  const over = (ph: (k: number) => number, pa: (k: number) => number, line: number) => cornerConvOver(ph, pa, line);
  const lines = [6.5, 8.5, 9.5, 10.5, 13.5].map((line) => {
    const poisson = over(poiH, poiA, line);
    const negbin = over(nbH, nbA, line);
    return {
      line,
      poisson,
      negbin,
      marginMix: over(mixH, mixA, line),
      totalMix: 0.65 * poisson + 0.35 * negbin,
    };
  });
  const singleNbOver95 = excess > 0 ? nbTotalOver(mean, rTotal, 9.5) : lines[2]!.poisson;
  return {
    mean,
    rH,
    rA,
    rTotal,
    varPoisson: mean,
    varFull,
    varDesk,
    open,
    bothNbWeight: 0.35 * 0.35,
    lines,
    singleNbOver95,
  };
}

function cornerConvOver(ph: (k: number) => number, pa: (k: number) => number, line: number): number {
  const max = 48;
  const need = Math.floor(line) + 1;
  let under = 0;
  for (let h = 0; h <= max; h++) {
    const left = ph(h);
    if (left <= 0) continue;
    for (let a = 0; a <= max; a++) {
      if (h + a < need) under += left * pa(a);
    }
  }
  return clamp(1 - under, 0, 1);
}

function nbTotalOver(mean: number, r: number, line: number): number {
  const max = 48;
  const need = Math.floor(line) + 1;
  let under = 0;
  for (let k = 0; k < need && k <= max; k++) under += negBinPmf(k, mean, r);
  return clamp(1 - under, 0, 1);
}

export function cornerWinnerFromGrid(grid: number[][]): { home: number; draw: number; away: number } {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h < grid.length; h++) {
    const row = grid[h] ?? [];
    for (let a = 0; a < row.length; a++) {
      const p = row[a] ?? 0;
      if (h > a) home += p;
      else if (h < a) away += p;
      else draw += p;
    }
  }
  const z = home + draw + away || 1;
  return { home: home / z, draw: draw / z, away: away / z };
}

export function cornerHandicapFromGrid(grid: number[][], side: "home" | "away", line: number): CornerAsian {
  const out: CornerAsian = { fullWin: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 0 };
  for (let h = 0; h < grid.length; h++) {
    const row = grid[h] ?? [];
    for (let a = 0; a < row.length; a++) {
      const p = row[a] ?? 0;
      const diff = side === "home" ? h - a : a - h;
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

export function parseCornerMarket(selection: string): CornerMarket | null {
  const t = String(selection ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  const teamOu = t.match(/^(home|away)\s+corners?\s+(over|under)\s+(\d+(?:\.\d+)?)/);
  if (teamOu) {
    return {
      variant: "team",
      team: teamOu[1] === "away" ? "away" : "home",
      side: teamOu[2] === "under" ? "under" : "over",
      line: Number(teamOu[3]),
    };
  }

  const hc =
    t.match(/^corners?\s+(home|away)\s*([+-]?\d+(?:\.\d+)?)/) ||
    t.match(/^(home|away)\s*([+-]\d+(?:\.\d+)?)\s+corners?/);
  if (hc) {
    return { variant: "handicap", side: hc[1] === "away" ? "away" : "home", line: Number(hc[2]) };
  }

  if (/corners?\s+draw|draw\s+corners|corners?\s+tie/.test(t) || t === "draw most corners") {
    return { variant: "winner", side: "draw" };
  }
  if (/away most corners|away corners win/.test(t) && !/home/.test(t)) {
    return { variant: "winner", side: "away" };
  }
  if (/home most corners|home corners win/.test(t)) {
    return { variant: "winner", side: "home" };
  }
  if (/most corners\s+away/.test(t)) return { variant: "winner", side: "away" };
  if (/most corners\s+home/.test(t)) return { variant: "winner", side: "home" };

  const tot = t.match(/^(over|under)\s+(\d+(?:\.\d+)?)/);
  if (tot) {
    return { variant: "total", side: tot[1] === "under" ? "under" : "over", line: Number(tot[2]) };
  }
  return null;
}

export function formatCornerMarket(m: CornerMarket): string {
  if (m.variant === "total") return `${m.side === "under" ? "Under" : "Over"} ${m.line}`;
  if (m.variant === "team") {
    const who = m.team === "away" ? "Away" : "Home";
    return `${who} corners ${m.side === "under" ? "Under" : "Over"} ${m.line}`;
  }
  if (m.variant === "handicap") {
    const sign = m.line > 0 ? "+" : "";
    return `Corners ${m.side === "away" ? "Away" : "Home"} ${sign}${m.line}`;
  }
  if (m.side === "draw") return "Corners draw";
  return `${m.side === "away" ? "Away" : "Home"} most corners`;
}

export function pCornerMarket(
  m: CornerMarket,
  lam: CornerLambdas,
  grid: number[][],
): { p: number; cover: number | null; ev: (odd: number) => number } | null {
  if (m.variant === "total") {
    const quarter = Math.abs(m.line * 4 - Math.round(m.line * 4)) < 1e-9 && m.line % 0.5 !== 0;
    if (quarter || Number.isInteger(m.line)) {
      const outcome = poissonOverAsian(lam.lambdaT, m.line);
      if (!outcome) return null;
      const flipped: CornerAsian = {
        fullWin: outcome.loss,
        halfWin: outcome.halfLoss,
        push: outcome.push,
        halfLoss: outcome.halfWin,
        loss: outcome.fullWin,
      };
      const used = m.side === "over" ? outcome : flipped;
      const cover = asianCoverP(used);
      return { p: cover, cover, ev: (odd) => asianExpectedReturn(used, odd) - 1 };
    }
    const over = poissonOver(lam.lambdaT, m.line);
    if (over == null) return null;
    const p = m.side === "over" ? over : 1 - over;
    return { p, cover: null, ev: (odd) => p * odd - 1 };
  }
  if (m.variant === "team") {
    const lamSide = m.team === "home" ? lam.lambdaH : lam.lambdaA;
    const over = poissonOver(lamSide, m.line);
    if (over == null) return null;
    const p = m.side === "over" ? over : 1 - over;
    return { p, cover: null, ev: (odd) => p * odd - 1 };
  }
  if (m.variant === "handicap") {
    const outcome = cornerHandicapFromGrid(grid, m.side, m.line);
    const cover = asianCoverP(outcome);
    return { p: cover, cover, ev: (odd) => asianExpectedReturn(outcome, odd) - 1 };
  }
  const w = cornerWinnerFromGrid(grid);
  const p = m.side === "home" ? w.home : m.side === "away" ? w.away : w.draw;
  return { p, cover: null, ev: (odd) => p * odd - 1 };
}

export function settleCorner(
  selection: string,
  extra: {
    corners?: number | null;
    homeCorners?: number | null;
    awayCorners?: number | null;
  },
): boolean | null {
  const m = parseCornerMarket(selection);
  if (!m) return null;
  if (m.variant === "total") {
    const c = extra.corners;
    if (c == null) return null;
    const s = m.side === "over" ? settleAsian(c, -m.line) : settleAsian(-c, m.line);
    if (s === "push") return null;
    return s === "full_win" || s === "half_win";
  }
  const h = extra.homeCorners;
  const a = extra.awayCorners;
  if (h == null || a == null) return null;
  if (m.variant === "team") {
    const c = m.team === "home" ? h : a;
    const s = m.side === "over" ? settleAsian(c, -m.line) : settleAsian(-c, m.line);
    if (s === "push") return null;
    return s === "full_win" || s === "half_win";
  }
  if (m.variant === "handicap") {
    const diff = m.side === "home" ? h - a : a - h;
    const s = settleAsian(diff, m.line);
    if (s === "push") return null;
    return s === "full_win" || s === "half_win";
  }
  if (m.side === "draw") return h === a;
  if (m.side === "home") return h > a;
  return a > h;
}

/** Aggregate last-N fixture corner counts. Missing fixtures stay out of the mean. */
export function cornerRatesFromSamples(
  rows: Array<{ home: boolean; for: number; against: number }>,
): CornerRates | null {
  const clean = rows.filter((r) => Number.isFinite(r.for) && Number.isFinite(r.against));
  if (clean.length < 4) return null;
  let f = 0;
  let ag = 0;
  let fH = 0;
  let nH = 0;
  let fA = 0;
  let nA = 0;
  let agH = 0;
  let agA = 0;
  for (const r of clean) {
    f += r.for;
    ag += r.against;
    if (r.home) {
      fH += r.for;
      agH += r.against;
      nH += 1;
    } else {
      fA += r.for;
      agA += r.against;
      nA += 1;
    }
  }
  const n = nH + nA;
  if (n < 4) return null;
  const totals = clean.map((r) => r.for + r.against);
  let vmr: number | null = null;
  if (totals.length >= 6) {
    const mu = totals.reduce((s, x) => s + x, 0) / totals.length;
    const v = totals.reduce((s, x) => s + (x - mu) ** 2, 0) / totals.length;
    if (mu > 1) {
      const ratio = v / mu;
      if (ratio > 1.25 && ratio < 3.5) vmr = ratio;
    }
  }
  return {
    forPerMatch: f / n,
    againstPerMatch: ag / n,
    forHome: nH >= 2 ? fH / nH : null,
    forAway: nA >= 2 ? fA / nA : null,
    againstHome: nH >= 2 ? agH / nH : null,
    againstAway: nA >= 2 ? agA / nA : null,
    n,
    vmr,
  };
}

export function ratesFromTeamCorners(st: {
  cornersPerMatch?: number | null;
  cornersAgainstPerMatch?: number | null;
  cornersForHome?: number | null;
  cornersForAway?: number | null;
  cornersAgainstHome?: number | null;
  cornersAgainstAway?: number | null;
  played?: number | null;
  cornersVmr?: number | null;
} | null): CornerRates {
  return {
    forPerMatch: st?.cornersPerMatch ?? null,
    againstPerMatch: st?.cornersAgainstPerMatch ?? null,
    forHome: st?.cornersForHome ?? null,
    forAway: st?.cornersForAway ?? null,
    againstHome: st?.cornersAgainstHome ?? null,
    againstAway: st?.cornersAgainstAway ?? null,
    n: st?.played ?? null,
    vmr: st?.cornersVmr ?? null,
  };
}
