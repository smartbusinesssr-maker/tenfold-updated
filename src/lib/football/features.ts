import { clamp, dcDecay, maherOver15 } from "./models.ts";
import { buildLatentSide, evidenceBalance, type LatentSide } from "./latent.ts";
import type {
  DataGrade,
  FinishedSample,
  LeagueCoverage,
  MarketFamily,
  MarketKind,
  StandingRow,
  TeamSeasonStats,
} from "./types.ts";

export interface SideRates {
  gf: number | null;
  ga: number | null;
  venueGf: number | null;
  venueGa: number | null;
  failedToScore: number | null;
  cleanSheet: number | null;
  btts: number | null;
  over15: number | null;
  over25: number | null;
  n: number;
  venueN: number;
  adjAttack: number | null;
  adjDefense: number | null;
  scoringStreak: number | null;
  failedStreak: number | null;
  cleanStreak: number | null;
}

export interface MatchSnapshot {
  home: SideRates;
  away: SideRates;
  quality: number;
  grade: DataGrade;
  homeLatent: LatentSide;
  awayLatent: LatentSide;
}

export type LiveEndpoint =
  | "fixtures"
  | "odds"
  | "leagues"
  | "predictions"
  | "standings"
  | "lastN"
  | "teamStats"
  | "h2h"
  | "injuries"
  | "lineups"
  | "events"
  | "fixtureStats"
  | "players";

/** T-5m baseline cutoff. Nothing after this may enter a pre-match snapshot. */
export function featureCutoffUnix(kickoffUnix: number): number {
  if (!kickoffUnix) return Math.floor(Date.now() / 1000) - 300;
  return kickoffUnix - 300;
}

/**
 * When to call which API-Football endpoint on a live scan.
 * Events / per-match stats / players are historical-bootstrap only — season
 * minute buckets already arrive on /teams/statistics.
 */
export function shouldFetchLive(
  endpoint: LiveEndpoint,
  cov: LeagueCoverage | undefined,
  ctx: {
    lastNHome?: number;
    lastNAway?: number;
    h2hN?: number;
    minutesToKick?: number | null;
    needCorners?: boolean;
    needPlayers?: boolean;
  } = {},
): boolean {
  switch (endpoint) {
    case "fixtures":
    case "odds":
    case "leagues":
    case "lastN":
      return true;
    case "predictions":
      return !cov || cov.predictions;
    case "standings":
      return !cov || cov.standings;
    case "teamStats":
      return !cov || cov.standings || cov.fixtureStats;
    case "h2h":
      // Last-20 vs other teams is not this opponent. Fetch until we have a real H2H book.
      if ((ctx.h2hN ?? 0) >= 8) return false;
      return true;
    case "injuries":
      return !cov || cov.injuries;
    case "lineups": {
      if (cov && !cov.lineups) return false;
      const m = ctx.minutesToKick;
      return m != null && m > 0 && m <= 90;
    }
    case "events":
      return false;
    case "fixtureStats":
      return Boolean(ctx.needCorners) && (!cov || cov.fixtureStats);
    case "players":
      return Boolean(ctx.needPlayers) && (!cov || cov.playerStats || cov.lineups);
    default:
      return false;
  }
}

/** Spec §4 market-specific coverage. Flags only — snapshot presence is dataGrade. */
export function marketCoverageFromFlags(
  cov: LeagueCoverage | undefined,
  family: MarketFamily,
): number {
  if (!cov) return 0.55;
  const fx = 1;
  const stats = cov.standings || cov.fixtureStats ? 1 : 0;
  const homeAway = cov.standings ? 1 : 0.5;
  const inj = cov.injuries ? 1 : 0;
  const xi = cov.lineups ? 1 : 0;
  const odds = cov.odds ? 1 : 0;
  const ev = cov.events ? 1 : 0;
  const table = cov.standings ? 1 : 0;
  if (family === "btts") {
    return clamp(
      0.25 * fx + 0.2 * stats + 0.15 * homeAway + 0.15 * inj + 0.1 * xi + 0.1 * odds + 0.05 * ev,
      0,
      1,
    );
  }
  if (family === "win") {
    return clamp(
      0.25 * stats + 0.2 * homeAway + 0.15 * fx + 0.1 * table + 0.1 * inj + 0.1 * xi + 0.05 * odds + 0.05 * ev,
      0,
      1,
    );
  }
  if (family === "cs") {
    return clamp(
      0.22 * stats + 0.18 * homeAway + 0.15 * fx + 0.12 * inj + 0.12 * xi + 0.1 * odds + 0.11 * ev,
      0,
      1,
    );
  }
  if (family === "corners") {
    return clamp(0.35 * stats + 0.2 * homeAway + 0.2 * odds + 0.15 * fx + 0.1 * xi, 0, 1);
  }
  if (family === "player") {
    return clamp(0.4 * xi + 0.25 * stats + 0.2 * odds + 0.15 * inj, 0, 1);
  }
  return clamp(
    0.22 * fx + 0.22 * stats + 0.16 * homeAway + 0.12 * inj + 0.1 * xi + 0.1 * odds + 0.08 * ev,
    0,
    1,
  );
}

/** Null stays null. Unknown is not a 0% rate. */
export function shrinkRate(rate: number | null, n: number, prior: number, k = 6): number | null {
  if (rate == null || !Number.isFinite(rate) || n <= 0) return null;
  if (!Number.isFinite(prior)) return rate;
  return (n * rate + k * prior) / (n + k);
}

export function formStreaks(samples: FinishedSample[]): {
  scoring: number | null;
  failed: number | null;
  clean: number | null;
} {
  if (!samples.length) return { scoring: null, failed: null, clean: null };
  let scoring = 0;
  let failed = 0;
  let clean = 0;
  for (const s of samples) {
    if (s.gf >= 1) scoring += 1;
    else break;
  }
  for (const s of samples) {
    if (s.gf === 0) failed += 1;
    else break;
  }
  for (const s of samples) {
    if (s.ga === 0) clean += 1;
    else break;
  }
  return { scoring, failed, clean };
}

/** Same-league last-N when we have enough; otherwise all competitions. */
export function samplesForMatch(samples: FinishedSample[], leagueId?: number): FinishedSample[] {
  if (!samples?.length) return samples ?? [];
  if (!leagueId) return samples;
  const same = samples.filter((s) => s.leagueId === leagueId);
  return same.length >= 3 ? same : samples;
}

/** Unweighted last-N BTTS / FTS / O/U — what the results page actually shows. */
export function last5Rates(samples: FinishedSample[], n = 5) {
  const take = (samples ?? []).slice(0, n);
  if (!take.length) {
    return { n: 0, btts: null as number | null, fts: null as number | null, cs: null as number | null, over15: null as number | null, over25: null as number | null };
  }
  let btts = 0;
  let fts = 0;
  let cs = 0;
  let o15 = 0;
  let o25 = 0;
  for (const s of take) {
    if (s.gf === 0) fts += 1;
    if (s.ga === 0) cs += 1;
    if (s.gf >= 1 && s.ga >= 1) btts += 1;
    if (s.gf + s.ga >= 2) o15 += 1;
    if (s.gf + s.ga >= 3) o25 += 1;
  }
  const k = take.length;
  return { n: k, btts: btts / k, fts: fts / k, cs: cs / k, over15: o15 / k, over25: o25 / k };
}

/** Recency-weighted rates. Null stays null — never treat unknown as zero. */
export function rollSamples(samples: FinishedSample[], asHome?: boolean): SideRates {
  const rows = asHome == null ? samples : samples.filter((s) => s.home === asHome);
  let wSum = 0;
  let gf = 0;
  let ga = 0;
  let fts = 0;
  let cs = 0;
  let btts = 0;
  let o15 = 0;
  let o25 = 0;
  const now = Date.now() / 1000;
  for (const s of rows) {
    const days = s.timestamp ? Math.max(0, (now - s.timestamp) / 86400) : 20;
    const w = dcDecay(days);
    wSum += w;
    gf += w * s.gf;
    ga += w * s.ga;
    if (s.gf === 0) fts += w;
    if (s.ga === 0) cs += w;
    if (s.gf >= 1 && s.ga >= 1) btts += w;
    if (s.gf + s.ga >= 2) o15 += w;
    if (s.gf + s.ga >= 3) o25 += w;
  }
  const streak = formStreaks(rows);
  if (wSum <= 0) {
    return emptyRates(rows.length, 0, streak);
  }
  return {
    gf: gf / wSum,
    ga: ga / wSum,
    venueGf: null,
    venueGa: null,
    failedToScore: fts / wSum,
    cleanSheet: cs / wSum,
    btts: btts / wSum,
    over15: o15 / wSum,
    over25: o25 / wSum,
    n: rows.length,
    venueN: 0,
    adjAttack: null,
    adjDefense: null,
    scoringStreak: streak.scoring,
    failedStreak: streak.failed,
    cleanStreak: streak.clean,
  };
}

function emptyRates(
  n: number,
  venueN: number,
  streak: { scoring: number | null; failed: number | null; clean: number | null } = {
    scoring: null,
    failed: null,
    clean: null,
  },
): SideRates {
  return {
    gf: null,
    ga: null,
    venueGf: null,
    venueGa: null,
    failedToScore: null,
    cleanSheet: null,
    btts: null,
    over15: null,
    over25: null,
    n,
    venueN,
    adjAttack: null,
    adjDefense: null,
    scoringStreak: streak.scoring,
    failedStreak: streak.failed,
    cleanStreak: streak.clean,
  };
}

export function mergeVenue(overall: SideRates, venue: SideRates): SideRates {
  return {
    ...overall,
    venueGf: venue.gf,
    venueGa: venue.ga,
    venueN: venue.n,
  };
}

/**
 * Opponent-adjusted attack/defence from pre-match standings of the sides
 * those last-N games were against. Missing opponent row → skip that match,
 * do not treat as average-zero.
 */
export function opponentAdjust(
  samples: FinishedSample[],
  table: StandingRow[] | undefined,
  leagueGa: number,
): { attack: number | null; defense: number | null } {
  if (!table?.length || samples.length < 3) return { attack: null, defense: null };
  const byId = new Map(table.map((r) => [r.teamId, r]));
  let wA = 0;
  let wD = 0;
  let att = 0;
  let def = 0;
  const now = Date.now() / 1000;
  for (const s of samples) {
    const opp = byId.get(s.opponentId);
    if (!opp || opp.played < 4) continue;
    const days = s.timestamp ? Math.max(0, (now - s.timestamp) / 86400) : 20;
    const w = dcDecay(days);
    const oppGa = opp.goalsAgainst / opp.played;
    const oppGf = opp.goalsFor / opp.played;
    const defIdx = Math.max(0.45, oppGa) / Math.max(0.45, leagueGa);
    const attIdx = Math.max(0.45, oppGf) / Math.max(0.45, leagueGa);
    wA += w;
    wD += w;
    att += w * (s.gf / defIdx);
    def += w * (s.ga / attIdx);
  }
  return {
    attack: wA > 0 ? att / wA : null,
    defense: wD > 0 ? def / wD : null,
  };
}

export function applySeasonStats(rates: SideRates, stats: TeamSeasonStats | null, home: boolean): SideRates {
  if (!stats) return rates;
  const gf = home ? stats.gfHome : stats.gfAway;
  const ga = home ? stats.gaHome : stats.gaAway;
  const fts = home ? stats.failedToScoreHome : stats.failedToScoreAway;
  const cs = home ? stats.cleanSheetHome : stats.cleanSheetAway;
  return {
    ...rates,
    failedToScore: rates.failedToScore ?? fts ?? stats.failedToScore,
    cleanSheet: rates.cleanSheet ?? cs ?? stats.cleanSheet,
    over15: rates.over15 ?? stats.over15,
    over25: rates.over25 ?? stats.over25,
    venueGf: rates.venueGf ?? gf,
    venueGa: rates.venueGa ?? ga,
  };
}

export function dataGrade(opts: {
  lastN: number;
  venueN: number;
  standings: boolean;
  stats: boolean;
  h2h: number;
  injuries: boolean;
  odds: boolean;
  coverage?: number;
  lineups?: boolean;
}): { quality: number; grade: DataGrade } {
  let q = 0;
  if (opts.lastN >= 8) q += 0.22;
  else if (opts.lastN >= 5) q += 0.16;
  else if (opts.lastN >= 3) q += 0.08;
  if (opts.venueN >= 3) q += 0.12;
  if (opts.standings) q += 0.16;
  if (opts.stats) q += 0.18;
  if (opts.h2h >= 3) q += 0.08;
  else if (opts.h2h >= 1) q += 0.04;
  if (opts.injuries) q += 0.08;
  if (opts.odds) q += 0.16;
  if (opts.lineups) q += 0.04;
  q *= 0.7 + 0.3 * clamp(opts.coverage ?? 1, 0, 1);
  const quality = clamp(q, 0, 1);
  const grade: DataGrade =
    quality >= 0.72 ? "FULL_DATA" : quality >= 0.45 ? "PARTIAL_DATA" : quality >= 0.22 ? "LOW_DATA" : "UNUSABLE";
  return { quality, grade };
}

export function buildSnapshot(opts: {
  homeSamples: FinishedSample[];
  awaySamples: FinishedSample[];
  homeStats: TeamSeasonStats | null;
  awayStats: TeamSeasonStats | null;
  table: StandingRow[] | undefined;
  leagueGa: number;
  h2hN: number;
  hasInjuries: boolean;
  hasOdds: boolean;
  coverage?: number;
  lineups?: boolean;
}): MatchSnapshot {
  const homeRoll = rollSamples(opts.homeSamples);
  const awayRoll = rollSamples(opts.awaySamples);
  const homeVenue = rollSamples(opts.homeSamples, true);
  const awayVenue = rollSamples(opts.awaySamples, false);
  const homeAdj = opponentAdjust(opts.homeSamples, opts.table, opts.leagueGa);
  const awayAdj = opponentAdjust(opts.awaySamples, opts.table, opts.leagueGa);
  let home = applySeasonStats(
    { ...mergeVenue(homeRoll, homeVenue), adjAttack: homeAdj.attack, adjDefense: homeAdj.defense },
    opts.homeStats,
    true,
  );
  let away = applySeasonStats(
    { ...mergeVenue(awayRoll, awayVenue), adjAttack: awayAdj.attack, adjDefense: awayAdj.defense },
    opts.awayStats,
    false,
  );
  const totPrior = Math.max(1.4, opts.leagueGa * 2);
  const o15Prior = maherOver15(totPrior * 0.54, totPrior * 0.46);
  home = shrinkSide(home, o15Prior);
  away = shrinkSide(away, o15Prior);
  const { quality, grade } = dataGrade({
    lastN: Math.min(home.n, away.n),
    venueN: Math.min(home.venueN, away.venueN),
    standings: Boolean(opts.table?.length),
    stats: Boolean(opts.homeStats && opts.awayStats),
    h2h: opts.h2hN,
    injuries: opts.hasInjuries,
    odds: opts.hasOdds,
    coverage: opts.coverage,
    lineups: opts.lineups,
  });
  const homeLatent = buildLatentSide(opts.homeSamples, opts.leagueGa, opts.leagueGa, opts.table);
  const awayLatent = buildLatentSide(opts.awaySamples, opts.leagueGa, opts.leagueGa, opts.table);
  return { home, away, quality, grade, homeLatent, awayLatent };
}

function shrinkSide(rates: SideRates, o15Prior: number): SideRates {
  const k = rates.n >= 10 ? 4 : 8;
  return {
    ...rates,
    failedToScore: shrinkRate(rates.failedToScore, rates.n, 0.26, k),
    cleanSheet: shrinkRate(rates.cleanSheet, rates.n, 0.28, k),
    btts: shrinkRate(rates.btts, rates.n, 0.51, k),
    over15: shrinkRate(rates.over15, rates.n, o15Prior, k),
    over25: shrinkRate(rates.over25, rates.n, Math.max(0.35, o15Prior - 0.22), k),
  };
}

/** League scoring environment from the current table. Null if the sample is too thin. */
export function leagueEnvFromStandings(rows: StandingRow[] | undefined): {
  home: number;
  away: number;
  total: number;
  n: number;
} | null {
  if (!rows?.length) return null;
  let homeGf = 0;
  let homeN = 0;
  let awayGf = 0;
  let awayN = 0;
  let gf = 0;
  let played = 0;
  for (const r of rows) {
    if ((r.homePlayed ?? 0) >= 3 && r.homeGf != null) {
      homeGf += r.homeGf;
      homeN += r.homePlayed!;
    }
    if ((r.awayPlayed ?? 0) >= 3 && r.awayGf != null) {
      awayGf += r.awayGf;
      awayN += r.awayPlayed!;
    }
    if (r.played >= 3) {
      gf += r.goalsFor;
      played += r.played;
    }
  }
  if (homeN >= 20 && awayN >= 20) {
    const home = homeGf / homeN;
    const away = awayGf / awayN;
    return { home, away, total: home + away, n: homeN };
  }
  if (played >= 30) {
    const per = gf / played;
    return { home: per * 1.12, away: per * 0.88, total: per * 2, n: played };
  }
  return null;
}

export function rollWindow(samples: FinishedSample[], n: number, asHome?: boolean): SideRates {
  return rollSamples(samples.slice(0, n), asHome);
}

export interface BttsFailure {
  code: string;
  text: string;
  severity: number;
}

/** Spec §33 — explicit BTTS failure modes from the snapshot, never invented. */
export function bttsFailureModes(opts: {
  lambdaH: number;
  lambdaA: number;
  homeFts: number | null;
  awayFts: number | null;
  homeCs: number | null;
  awayCs: number | null;
  homeBtts: number | null;
  awayBtts: number | null;
  injuryAttackHome: number;
  injuryAttackAway: number;
  injuryKeeperHome: number;
  injuryKeeperAway: number;
  leagueEnvTotal: number | null;
  homeFailedStreak: number | null;
  awayFailedStreak: number | null;
}): BttsFailure[] {
  const out: BttsFailure[] = [];
  if (opts.homeFts != null && opts.homeFts > 0.42) {
    out.push({
      code: "fts_home",
      text: `Home failed-to-score ${Math.round(opts.homeFts * 100)}%`,
      severity: opts.homeFts > 0.55 ? 0.55 : 0.32,
    });
  }
  if (opts.awayFts != null && opts.awayFts > 0.42) {
    out.push({
      code: "fts_away",
      text: `Away failed-to-score ${Math.round(opts.awayFts * 100)}%`,
      severity: opts.awayFts > 0.55 ? 0.55 : 0.32,
    });
  }
  if (opts.homeCs != null && opts.homeCs > 0.42 && (opts.awayFts ?? 0) > 0.32) {
    out.push({
      code: "one_way_home",
      text: `Home clean-sheet ${Math.round(opts.homeCs * 100)}% vs away FTS ${Math.round((opts.awayFts ?? 0) * 100)}%`,
      severity: 0.48,
    });
  }
  if (opts.awayCs != null && opts.awayCs > 0.42 && (opts.homeFts ?? 0) > 0.32) {
    out.push({
      code: "one_way_away",
      text: `Away clean-sheet ${Math.round(opts.awayCs * 100)}% vs home FTS ${Math.round((opts.homeFts ?? 0) * 100)}%`,
      severity: 0.48,
    });
  }
  if (opts.injuryAttackHome >= 0.08) {
    out.push({ code: "striker_home", text: "Home attacking availability is down", severity: 0.28 });
  }
  if (opts.injuryAttackAway >= 0.08) {
    out.push({ code: "striker_away", text: "Away attacking availability is down", severity: 0.28 });
  }
  if (opts.injuryKeeperHome >= 0.1) {
    out.push({ code: "keeper_home", text: "Home goalkeeper availability is down", severity: 0.22 });
  }
  if (opts.injuryKeeperAway >= 0.1) {
    out.push({ code: "keeper_away", text: "Away goalkeeper availability is down", severity: 0.22 });
  }
  if (opts.leagueEnvTotal != null && opts.leagueEnvTotal < 2.15) {
    out.push({
      code: "low_env",
      text: `League environment ${opts.leagueEnvTotal.toFixed(2)} goals`,
      severity: 0.3,
    });
  }
  if ((opts.homeFailedStreak ?? 0) >= 3) {
    out.push({
      code: "fail_streak_home",
      text: `Home failed to score in last ${opts.homeFailedStreak}`,
      severity: 0.4,
    });
  }
  if ((opts.awayFailedStreak ?? 0) >= 3) {
    out.push({
      code: "fail_streak_away",
      text: `Away failed to score in last ${opts.awayFailedStreak}`,
      severity: 0.4,
    });
  }
  if (opts.lambdaH < 0.95 || opts.lambdaA < 0.85) {
    out.push({
      code: "lambda_thin",
      text: `Scoring rates ${opts.lambdaH.toFixed(2)} / ${opts.lambdaA.toFixed(2)} too thin for BTTS`,
      severity: 0.5,
    });
  }
  if (opts.homeBtts != null && opts.awayBtts != null && (opts.homeBtts + opts.awayBtts) / 2 < 0.38) {
    out.push({
      code: "low_btts_rate",
      text: `Recent BTTS ${Math.round(opts.homeBtts * 100)}% / ${Math.round(opts.awayBtts * 100)}%`,
      severity: 0.34,
    });
  }
  return out;
}

export function bttsFailureSeverity(fails: BttsFailure[]): number {
  if (!fails.length) return 0;
  return clamp(
    1 - fails.reduce((acc, f) => acc * (1 - clamp(f.severity, 0, 0.85)), 1),
    0,
    1,
  );
}

export interface ExplainInput {
  kind: MarketKind;
  home: string;
  away: string;
  lambdaH: number;
  lambdaA: number;
  histWeight: number;
  bookTrusted: boolean;
  hasBook1x2: boolean;
  homeGf: number | null;
  homeGa: number | null;
  awayGf: number | null;
  awayGa: number | null;
  homeForm: string | null;
  awayForm: string | null;
  homeRank: number | null;
  awayRank: number | null;
  homeFts: number | null;
  awayFts: number | null;
  homeCs: number | null;
  awayCs: number | null;
  homeOver15: number | null;
  awayOver15: number | null;
  homeAdjAttack: number | null;
  awayAdjAttack: number | null;
  lastNHome: number;
  lastNAway: number;
  leagueEnvHome: number | null;
  leagueEnvAway: number | null;
  homeLateShare: number | null;
  awayLateShare: number | null;
  homeScoringStreak: number | null;
  awayScoringStreak: number | null;
  homeFailedStreak: number | null;
  awayFailedStreak: number | null;
  h2hN: number;
  h2hLine: string | null;
  grade: DataGrade;
  lineupHome: string | null;
  lineupAway: string | null;
  lineupConfirmed: boolean;
  injuryImpact: number;
  bookCount: number | null;
  bttsFails: BttsFailure[];
  apiLine: string | null;
}

/** Spec §157 — a reason is only emitted if the feature is present on the snapshot. */
export function explainMatch(input: ExplainInput): string[] {
  const notes: string[] = [];
  const bits: string[] = [];
  const homeShort = input.home.split(" ").slice(-1)[0] ?? input.home;
  const awayShort = input.away.split(" ").slice(-1)[0] ?? input.away;
  if (input.homeForm || input.homeGf != null) {
    bits.push(
      `${homeShort} ${input.homeForm ?? "—"} ${
        input.homeGf != null && input.homeGa != null ? `${input.homeGf.toFixed(1)}/${input.homeGa.toFixed(1)}` : ""
      }`.trim(),
    );
  }
  if (input.awayForm || input.awayGf != null) {
    bits.push(
      `${awayShort} ${input.awayForm ?? "—"} ${
        input.awayGf != null && input.awayGa != null ? `${input.awayGf.toFixed(1)}/${input.awayGa.toFixed(1)}` : ""
      }`.trim(),
    );
  }
  if (input.homeRank != null && input.awayRank != null) bits.push(`table ${input.homeRank} vs ${input.awayRank}`);
  if (input.lastNHome || input.lastNAway) bits.push(`n=${input.lastNHome}/${input.lastNAway}`);
  if (input.bookCount != null && input.bookCount > 0) bits.push(`${input.bookCount} books`);
  if (input.homeOver15 != null || input.awayOver15 != null) {
    const a = input.homeOver15 != null ? `${Math.round(input.homeOver15 * 100)}%` : "—";
    const b = input.awayOver15 != null ? `${Math.round(input.awayOver15 * 100)}%` : "—";
    bits.push(`O1.5 ${a}/${b}`);
  }
  if (input.h2hLine) bits.push(input.h2hLine);
  bits.push(`history ${(input.histWeight * 100).toFixed(0)}% of λ`);
  bits.push(input.grade.replace("_", " ").toLowerCase());
  notes.push(bits.join(" · "));

  notes.push(`λ ${input.lambdaH.toFixed(2)} / ${input.lambdaA.toFixed(2)} from one match state.`);

  if (input.homeFts != null || input.awayFts != null) {
    const a = input.homeFts != null ? `${Math.round(input.homeFts * 100)}%` : "—";
    const b = input.awayFts != null ? `${Math.round(input.awayFts * 100)}%` : "—";
    notes.push(`Failed to score ${a} / ${b}.`);
  }
  if (input.homeCs != null || input.awayCs != null) {
    const a = input.homeCs != null ? `${Math.round(input.homeCs * 100)}%` : "—";
    const b = input.awayCs != null ? `${Math.round(input.awayCs * 100)}%` : "—";
    notes.push(`Clean sheets ${a} / ${b}.`);
  }
  if (input.homeAdjAttack != null && input.awayAdjAttack != null) {
    notes.push(
      `Opponent-adjusted attack ${input.homeAdjAttack.toFixed(2)} / ${input.awayAdjAttack.toFixed(2)}.`,
    );
  }
  if (input.leagueEnvHome != null && input.leagueEnvAway != null) {
    notes.push(
      `League environment ${input.leagueEnvHome.toFixed(2)} / ${input.leagueEnvAway.toFixed(2)} from the current table.`,
    );
  }
  if ((input.homeScoringStreak ?? 0) >= 3 || (input.awayScoringStreak ?? 0) >= 3) {
    notes.push(
      `Scoring streak ${input.homeScoringStreak ?? 0} / ${input.awayScoringStreak ?? 0}.`,
    );
  }
  if ((input.homeFailedStreak ?? 0) >= 2 || (input.awayFailedStreak ?? 0) >= 2) {
    notes.push(
      `Failed-to-score streak ${input.homeFailedStreak ?? 0} / ${input.awayFailedStreak ?? 0}.`,
    );
  }
  if (input.homeLateShare != null && input.awayLateShare != null) {
    notes.push(
      `Season minute buckets: 76'+ ${Math.round(input.homeLateShare * 100)}% / ${Math.round(input.awayLateShare * 100)}% (not per-match events).`,
    );
  }
  if (input.injuryImpact > 0.02) {
    notes.push(`Availability impact ${input.injuryImpact.toFixed(2)} (role-weighted, not a headcount).`);
  }
  if (input.lineupConfirmed) {
    const forms = [input.lineupHome, input.lineupAway].filter(Boolean).join(" / ");
    notes.push(`Confirmed XI${forms ? ` ${forms}` : ""}.`);
  }
  if (input.hasBook1x2) {
    if (input.bookTrusted) {
      notes.push("Book 1X2 agrees with last-20 history — Shin mixed into λ.");
    } else {
      notes.push("Book disagrees with last-20 history — football λ kept, Shin not mixed in.");
    }
  }
  if (input.apiLine) notes.push(`API-Football O/U ${input.apiLine}`);
  if (input.kind === "btts_yes" || input.kind === "btts_no") {
    for (const f of input.bttsFails) notes.push(f.text);
  }

  const evidence = evidenceBalance([
    ...(input.homeGf != null && input.homeGf > 1.55
      ? [{ text: `${homeShort} scoring state ${input.homeGf.toFixed(1)}`, sign: 1 as const, weight: 0.2 }]
      : []),
    ...(input.awayGf != null && input.awayGf > 1.35
      ? [{ text: `${awayShort} scoring state ${input.awayGf.toFixed(1)}`, sign: 1 as const, weight: 0.18 }]
      : []),
    ...(input.awayFts != null && input.awayFts > 0.4
      ? [{ text: `${awayShort} failed-to-score ${Math.round(input.awayFts * 100)}%`, sign: -1 as const, weight: 0.22 }]
      : []),
    ...(input.homeFts != null && input.homeFts > 0.4
      ? [{ text: `${homeShort} failed-to-score ${Math.round(input.homeFts * 100)}%`, sign: -1 as const, weight: 0.22 }]
      : []),
    ...(input.homeCs != null && input.homeCs > 0.42
      ? [{ text: `${homeShort} clean-sheet ${Math.round(input.homeCs * 100)}%`, sign: -1 as const, weight: 0.16 }]
      : []),
    ...(input.awayAdjAttack != null && input.homeAdjAttack != null && input.awayAdjAttack < 1.05
      ? [{ text: "opponent-adjusted away attack is weak", sign: -1 as const, weight: 0.12 }]
      : []),
    ...(input.leagueEnvHome != null && input.leagueEnvHome + (input.leagueEnvAway ?? 0) > 2.7
      ? [{ text: "high league goal environment", sign: 1 as const, weight: 0.14 }]
      : []),
  ]);
  if (evidence.lines.length >= 2) {
    notes.push(`Evidence ${evidence.net >= 0 ? "for" : "against"}: ${evidence.lines.slice(0, 4).join("; ")}.`);
  }
  return notes;
}
