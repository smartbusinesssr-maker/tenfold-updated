// @ts-nocheck — restored from compile cache + later patches. Logic is tested.
import { bookmakerScore, SHARP_BOOK_RE } from "./leagues.ts";
import { americanToDecimal, median, parseScore, shinImpliedOver, shinInvert, trimmedMedian } from "./models.ts";
import type {
  BookLine,
  FinishedSample,
  FixtureMarkets,
  H2HMatch,
  InjuryImpact,
  Last5Goals,
  LeagueCoverage,
  LineupImpact,
  MarketKind,
  PredictionExtract,
  RawFixture,
  SideMarket,
  StandingRow,
  TeamSeasonStats,
  PlayerSeasonStats,
} from "./types.ts";
import { emptyLineup, inOddsBand, CS_ODDS_BAND, DRAW_ODDS_BAND, ODDS_BAND, ODDS_PLAYABLE, TEAM_ODDS_BAND, MULTI_GOALS_ODDS_BAND, COMBO_ODDS_BAND, PLAYER_ODDS_BAND } from "./types.ts";
import { formatOuAsianSelection, isAsianTotalLine, parseOddEven, parseMultiGoals, formatMultiGoals } from "./markets-engine.ts";
import { formatCornerMarket, parseCornerMarket } from "./corners.ts";
import { formatPlayerGa, parsePlayerGa } from "./player-props.ts";

function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function pct(v) {
  const n = num(v);
  if (n == null) return null;
  return n > 1.5 ? n / 100 : n;
}
function parseUpcomingStatus(short) {
  const s = (short ?? "").toUpperCase();
  return s === "NS" || s === "TBD" || s === "PST";
}
function parseFixture(raw, date, timezone) {
  const r = raw;
  const id = r.fixture?.id;
  const home = r.teams?.home?.name;
  const away = r.teams?.away?.name;
  if (!id || !home || !away) return null;
  return {
    fixtureId: id,
    date,
    kickoff: r.fixture?.date ?? "",
    timestamp: r.fixture?.timestamp ?? 0,
    timezone: r.fixture?.timezone ?? timezone,
    status: r.fixture?.status?.short ?? "",
    leagueId: r.league?.id ?? 0,
    league: r.league?.name ?? "",
    country: r.league?.country ?? "",
    round: r.league?.round ?? "",
    homeId: r.teams?.home?.id ?? 0,
    awayId: r.teams?.away?.id ?? 0,
    home,
    away,
    homeLogo: r.teams?.home?.logo ?? null,
    awayLogo: r.teams?.away?.logo ?? null,
    season:
      typeof r.league?.season === "number"
        ? r.league.season
        : inferSeason(r.fixture?.date ?? "", r.fixture?.timestamp ?? 0),
  };
}
function inferSeason(kickoff, timestamp) {
  const d = timestamp ? new Date(timestamp * 1e3) : new Date(kickoff);
  if (Number.isNaN(d.getTime())) return new Date().getUTCFullYear();
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 6 ? y : y - 1;
}
function last5(team) {
  const t = team;
  if (!t) return null;
  const gfAvg = num(t.last_5?.goals?.for?.average);
  const gaAvg = num(t.last_5?.goals?.against?.average);
  const gfTot = num(t.last_5?.goals?.for?.total);
  const gaTot = num(t.last_5?.goals?.against?.total);
  return {
    forAvg: gfAvg ?? (gfTot != null ? gfTot / 5 : null),
    againstAvg: gaAvg ?? (gaTot != null ? gaTot / 5 : null),
    form: t.last_5?.form ?? t.league?.form ?? null,
  };
}
function isFinishedStatus(short) {
  const st = (short ?? "").toUpperCase();
  return st === "FT" || st === "AET" || st === "PEN";
}
function extractH2hFixtures(rows) {
  const h2h = [];
  for (const row of rows) {
    const m = row;
    const hg = m.goals?.home;
    const ag = m.goals?.away;
    if (hg == null || ag == null) continue;
    h2h.push({
      timestamp: m.fixture?.timestamp ?? 0,
      homeId: m.teams?.home?.id ?? 0,
      awayId: m.teams?.away?.id ?? 0,
      homeGoals: hg,
      awayGoals: ag,
      finished: isFinishedStatus(m.fixture?.status?.short),
    });
  }
  return h2h;
}
function last5FromFixtures(rows, teamId, n = 5, asOfTs = 0) {
  const finished = [];
  for (const row of rows) {
    const m = row;
    if (!isFinishedStatus(m.fixture?.status?.short)) continue;
    const ts = m.fixture?.timestamp ?? 0;
    if (asOfTs && ts >= asOfTs) continue;
    const hg = m.goals?.home;
    const ag = m.goals?.away;
    if (hg == null || ag == null) continue;
    const home = m.teams?.home?.id === teamId;
    if (!home && m.teams?.away?.id !== teamId) continue;
    finished.push({ ts, gf: home ? hg : ag, ga: home ? ag : hg, home });
  }
  finished.sort((a, b) => b.ts - a.ts);
  const take = finished.slice(0, n);
  return ratesFromTake(take);
}
function ratesFromTake(take) {
  let gf = 0;
  let ga = 0;
  let form = "";
  for (const m of take) {
    gf += m.gf;
    ga += m.ga;
    form += m.gf > m.ga ? "W" : m.gf < m.ga ? "L" : "D";
  }
  const n = take.length;
  return {
    forAvg: n > 0 ? gf / n : null,
    againstAvg: n > 0 ? ga / n : null,
    form: form || null,
  };
}
function venueSplit(rows, teamId, n = 4, asOfTs = 0) {
  const finished = [];
  for (const row of rows) {
    const m = row;
    if (!isFinishedStatus(m.fixture?.status?.short)) continue;
    const ts = m.fixture?.timestamp ?? 0;
    if (asOfTs && ts >= asOfTs) continue;
    const hg = m.goals?.home;
    const ag = m.goals?.away;
    if (hg == null || ag == null) continue;
    const home = m.teams?.home?.id === teamId;
    if (!home && m.teams?.away?.id !== teamId) continue;
    finished.push({ ts, gf: home ? hg : ag, ga: home ? ag : hg, home });
  }
  finished.sort((a, b) => b.ts - a.ts);
  return {
    home: ratesFromTake(finished.filter((m) => m.home).slice(0, n)),
    away: ratesFromTake(finished.filter((m) => !m.home).slice(0, n)),
  };
}
function finishedSamples(rows, teamId, asOfTs, n = 10) {
  const out = [];
  for (const row of rows) {
    const m = row;
    if (!isFinishedStatus(m.fixture?.status?.short)) continue;
    const ts = m.fixture?.timestamp ?? 0;
    if (ts >= asOfTs) continue;
    const hg = m.goals?.home;
    const ag = m.goals?.away;
    if (hg == null || ag == null) continue;
    const home = m.teams?.home?.id === teamId;
    if (!home && m.teams?.away?.id !== teamId) continue;
    const opp = home ? (m.teams?.away?.id ?? 0) : (m.teams?.home?.id ?? 0);
    out.push({
      timestamp: ts,
      opponentId: opp,
      gf: home ? hg : ag,
      ga: home ? ag : hg,
      home,
      leagueId: m.league?.id ?? 0,
      fixtureId: m.fixture?.id ?? 0,
    });
  }
  out.sort((a, b) => b.timestamp - a.timestamp);
  return out.slice(0, n);
}
function extractTeamStatistics(raw, teamId) {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const r = row;
  const played = r.fixtures?.played?.total ?? 0;
  const playedHome = r.fixtures?.played?.home ?? 0;
  const playedAway = r.fixtures?.played?.away ?? 0;
  const ftsN = r.failed_to_score?.total;
  const ftsH = r.failed_to_score?.home;
  const ftsA = r.failed_to_score?.away;
  const csN = r.clean_sheet?.total;
  const csH = r.clean_sheet?.home;
  const csA = r.clean_sheet?.away;
  const timing = minuteShares(r.goals?.for?.minute);
  const scoredOu = underOverRate(r.goals?.for?.under_over, "1.5");
  const scoredOu25 = underOverRate(r.goals?.for?.under_over, "2.5");
  return {
    teamId: r.team?.id ?? teamId,
    played,
    playedHome,
    playedAway,
    gfHome: num(r.goals?.for?.average?.home),
    gaHome: num(r.goals?.against?.average?.home),
    gfAway: num(r.goals?.for?.average?.away),
    gaAway: num(r.goals?.against?.average?.away),
    failedToScore: rateOrNull(ftsN, played),
    failedToScoreHome: rateOrNull(ftsH, playedHome),
    failedToScoreAway: rateOrNull(ftsA, playedAway),
    cleanSheet: rateOrNull(csN, played),
    cleanSheetHome: rateOrNull(csH, playedHome),
    cleanSheetAway: rateOrNull(csA, playedAway),
    form: r.form ?? null,
    over15: null,
    over25: null,
    over15For: scoredOu,
    over25For: scoredOu25,
    earlyShare: timing.early,
    lateShare: timing.late,
    cardsPerMatch: cardsPerMatchFromStats(r, played),
    cornersPerMatch: cornersPerMatchFromStats(r, played),
    cornersAgainstPerMatch: cornersAgainstFromStats(r, played),
    cornersForHome: cornersSplitFromStats(r, "for", "home", playedHome),
    cornersForAway: cornersSplitFromStats(r, "for", "away", playedAway),
    cornersAgainstHome: cornersSplitFromStats(r, "against", "home", playedHome),
    cornersAgainstAway: cornersSplitFromStats(r, "against", "away", playedAway),
  };
}
function cardsPerMatchFromStats(r, played) {
  const cards = r?.cards;
  if (!cards || typeof cards !== "object" || played <= 0) return null;
  let total = 0;
  let any = false;
  for (const color of ["yellow", "red"]) {
    const block = cards[color];
    if (!block || typeof block !== "object") continue;
    for (const cell of Object.values(block)) {
      const n = num(cell?.total);
      if (n == null) continue;
      any = true;
      total += n;
    }
  }
  if (!any) return null;
  return total / played;
}
function cornersPerMatchFromStats(r, played) {
  const corners = r?.corners;
  if (!corners || typeof corners !== "object" || played <= 0) return null;
  const tot = num(corners.for?.total);
  if (tot != null) return tot / played;
  const avg = num(corners.for?.average?.total ?? corners.for?.average);
  if (avg != null) return avg;
  return null;
}
function cornersAgainstFromStats(r, played) {
  const corners = r?.corners;
  if (!corners || typeof corners !== "object" || played <= 0) return null;
  const tot = num(corners.against?.total);
  if (tot != null) return tot / played;
  const avg = num(corners.against?.average?.total ?? corners.against?.average);
  if (avg != null) return avg;
  return null;
}
function cornersSplitFromStats(r, side, venue, played) {
  const corners = r?.corners;
  if (!corners || typeof corners !== "object" || !(played > 0)) return null;
  const block = corners[side];
  if (!block) return null;
  const tot = num(block[venue] ?? block.total?.[venue]);
  if (tot != null) return tot / played;
  const avg = num(block.average?.[venue] ?? block.average?.[venue === "home" ? "home" : "away"]);
  return avg;
}
function rateOrNull(count, played) {
  if (count == null || played <= 0) return null;
  return clamp01(count / played);
}
function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}
function underOverRate(block, line) {
  if (!block) return null;
  const row = block[line] ?? block[line.replace(".5", ",5")];
  if (!row) return null;
  const over = row.over;
  const under = row.under;
  if (over == null && under == null) return null;
  const o = over ?? 0;
  const u = under ?? 0;
  if (o + u <= 0) return null;
  return o / (o + u);
}
const EARLY_KEYS = ["0-15", "16-30"];
const LATE_KEYS = ["76-90", "91-105"];
function minuteShares(minute) {
  if (!minute) return { early: null, late: null };
  let total = 0;
  let early = 0;
  let late = 0;
  for (const [key, cell] of Object.entries(minute)) {
    const n = cell?.total;
    if (n == null || n < 0) continue;
    total += n;
    if (EARLY_KEYS.includes(key)) early += n;
    if (LATE_KEYS.includes(key)) late += n;
  }
  if (total <= 0) return { early: null, late: null };
  return { early: early / total, late: late / total };
}
function extractStandings(raw) {
  const page = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const out = [];
  for (const block of page) {
    const league = block?.league;
    const tables = league?.standings;
    const groups = Array.isArray(tables) ? tables : [];
    for (const group of groups) {
      const rows = Array.isArray(group) ? group : [group];
      for (const row of rows) {
        const r = row;
        const teamId = r.team?.id;
        if (!teamId || r.rank == null) continue;
        const played = r.all?.played ?? 0;
        const gf = r.all?.goals?.for ?? 0;
        const ga = r.all?.goals?.against ?? 0;
        out.push({
          teamId,
          rank: r.rank,
          points: r.points ?? 0,
          played,
          goalsFor: gf,
          goalsAgainst: ga,
          goalsDiff: r.goalsDiff ?? gf - ga,
          form: r.form ?? null,
          homePlayed: r.home?.played ?? null,
          homeGf: r.home?.goals?.for ?? null,
          homeGa: r.home?.goals?.against ?? null,
          awayPlayed: r.away?.played ?? null,
          awayGf: r.away?.goals?.for ?? null,
          awayGa: r.away?.goals?.against ?? null,
        });
      }
    }
  }
  return out;
}
function extractEspnStandings(raw) {
  const out = [];
  const root = raw;
  const groups = Array.isArray(root?.children)
    ? root.children
    : raw != null
      ? [raw]
      : [];
  const walk = (node) => {
    const n = node;
    for (const child of n.children ?? []) walk(child);
    for (const entry of n.standings?.entries ?? []) {
      const e = entry;
      const teamId = Number(e.team?.id);
      if (!teamId) continue;
      const stat = (name) => {
        const s = e.stats?.find((x) => x.name === name);
        if (!s) return null;
        if (typeof s.value === "number" && Number.isFinite(s.value))
          return s.value;
        return num(s.displayValue);
      };
      const played = stat("gamesPlayed") ?? stat("gamesplayed") ?? 0;
      const gf = stat("pointsFor") ?? stat("goalsFor") ?? 0;
      const ga = stat("pointsAgainst") ?? stat("goalsAgainst") ?? 0;
      const gd =
        stat("pointDifferential") ?? stat("goalDifferential") ?? gf - ga;
      const rank = stat("rank") ?? stat("rankings") ?? out.length + 1;
      const formStat = e.stats?.find(
        (x) => x.name === "streak" || x.name === "form",
      );
      out.push({
        teamId,
        rank: rank ?? out.length + 1,
        points: stat("points") ?? 0,
        played,
        goalsFor: gf,
        goalsAgainst: ga,
        goalsDiff: gd,
        form: formStat?.displayValue ?? null,
        homePlayed: null,
        homeGf: null,
        homeGa: null,
        awayPlayed: null,
        awayGf: null,
        awayGa: null,
      });
    }
  };
  for (const g of groups) walk(g);
  return out;
}
function standingByTeam(rows, teamId) {
  return rows.find((r) => r.teamId === teamId);
}
/** @returns {import("./types.ts").PredictionExtract} */
function applyStandings(pred, home, away): PredictionExtract {
  const next = {
    ...pred,
    homeRank: home?.rank ?? pred.homeRank,
    awayRank: away?.rank ?? pred.awayRank,
    homeGD: home?.goalsDiff ?? pred.homeGD,
    awayGD: away?.goalsDiff ?? pred.awayGD,
    homePlayed: home?.played ?? pred.homePlayed ?? null,
    awayPlayed: away?.played ?? pred.awayPlayed ?? null,
    homeForm: pred.homeForm ?? home?.form ?? null,
    awayForm: pred.awayForm ?? away?.form ?? null,
  };
  if (
    next.homeVenueFor == null &&
    home?.homePlayed &&
    home.homePlayed >= 4 &&
    home.homeGf != null
  ) {
    next.homeVenueFor = home.homeGf / home.homePlayed;
    next.homeVenueAgainst =
      home.homeGa != null
        ? home.homeGa / home.homePlayed
        : next.homeVenueAgainst;
  }
  if (
    next.awayVenueFor == null &&
    away?.awayPlayed &&
    away.awayPlayed >= 4 &&
    away.awayGf != null
  ) {
    next.awayVenueFor = away.awayGf / away.awayPlayed;
    next.awayVenueAgainst =
      away.awayGa != null
        ? away.awayGa / away.awayPlayed
        : next.awayVenueAgainst;
  }
  return next;
}
/** @returns {import("./types.ts").PredictionExtract} */
function applyTeamSample(pred, side, overall, venue): PredictionExtract {
  if (side === "home") {
    return {
      ...pred,
      homeLast5: overall.forAvg != null ? overall : pred.homeLast5,
      homeForm: overall.form ?? pred.homeForm,
      homeVenueFor: venue.forAvg,
      homeVenueAgainst: venue.againstAvg,
    };
  }
  return {
    ...pred,
    awayLast5: overall.forAvg != null ? overall : pred.awayLast5,
    awayForm: overall.form ?? pred.awayForm,
    awayVenueFor: venue.forAvg,
    awayVenueAgainst: venue.againstAvg,
  };
}
function mergeH2h(existing, extra) {
  const seen = new Set(
    existing.map((h) => `${h.timestamp}:${h.homeId}:${h.awayId}`),
  );
  const out = [...existing];
  for (const row of extra) {
    const k = `${row.timestamp}:${row.homeId}:${row.awayId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  out.sort((a, b) => b.timestamp - a.timestamp);
  return out;
}
/** @returns {import("./types.ts").PredictionExtract} */
function emptyPrediction(fixtureId): PredictionExtract {
  return {
    fixtureId,
    underOver: null,
    advice: null,
    winner: null,
    percentHome: null,
    percentDraw: null,
    percentAway: null,
    poissonShareHome: null,
    poissonShareAway: null,
    attHome: null,
    attAway: null,
    homeLast5: null,
    awayLast5: null,
    homeSeasonForHome: null,
    homeSeasonAgainstHome: null,
    awaySeasonForAway: null,
    awaySeasonAgainstAway: null,
    homeForm: null,
    awayForm: null,
    homePlayed: null,
    awayPlayed: null,
    h2h: [],
    homeRank: null,
    awayRank: null,
    homeGD: null,
    awayGD: null,
    homeVenueFor: null,
    homeVenueAgainst: null,
    awayVenueFor: null,
    awayVenueAgainst: null,
    homeStats: null,
    awayStats: null,
    homeFts: null,
    awayFts: null,
    homeCs: null,
    awayCs: null,
    homeAdjAttack: null,
    homeAdjDefense: null,
    awayAdjAttack: null,
    awayAdjDefense: null,
    homeOver15: null,
    awayOver15: null,
    homeOver15For: null,
    awayOver15For: null,
    homeEarlyShare: null,
    homeLateShare: null,
    awayEarlyShare: null,
    awayLateShare: null,
    coverageScore: 0,
    quality: 0,
    grade: "UNUSABLE",
  };
}
/** @returns {import("./types.ts").PredictionExtract | null} */
function extractPrediction(raw, fixtureId): PredictionExtract | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const r = row;
  const h2h = extractH2hFixtures(r.h2h ?? []);
  return {
    fixtureId,
    underOver: r.predictions?.under_over ?? null,
    advice: r.predictions?.advice ?? null,
    winner: r.predictions?.winner?.name ?? null,
    percentHome: pct(r.predictions?.percent?.home),
    percentDraw: pct(r.predictions?.percent?.draw),
    percentAway: pct(r.predictions?.percent?.away),
    poissonShareHome: pct(r.comparison?.poisson_distribution?.home),
    poissonShareAway: pct(r.comparison?.poisson_distribution?.away),
    attHome: pct(r.comparison?.att?.home),
    attAway: pct(r.comparison?.att?.away),
    homeLast5: last5(r.teams?.home),
    awayLast5: last5(r.teams?.away),
    homeSeasonForHome: num(r.teams?.home?.league?.goals?.for?.average?.home),
    homeSeasonAgainstHome: num(
      r.teams?.home?.league?.goals?.against?.average?.home,
    ),
    awaySeasonForAway: num(r.teams?.away?.league?.goals?.for?.average?.away),
    awaySeasonAgainstAway: num(
      r.teams?.away?.league?.goals?.against?.average?.away,
    ),
    homeForm: r.teams?.home?.league?.form ?? last5(r.teams?.home)?.form ?? null,
    awayForm: r.teams?.away?.league?.form ?? last5(r.teams?.away)?.form ?? null,
    homePlayed:
      r.teams?.home?.league?.fixtures?.played?.home ??
      r.teams?.home?.league?.fixtures?.played?.total ??
      null,
    awayPlayed:
      r.teams?.away?.league?.fixtures?.played?.away ??
      r.teams?.away?.league?.fixtures?.played?.total ??
      null,
    h2h,
    homeRank: null,
    awayRank: null,
    homeGD: null,
    awayGD: null,
    homeVenueFor: null,
    homeVenueAgainst: null,
    awayVenueFor: null,
    awayVenueAgainst: null,
    homeStats: null,
    awayStats: null,
    homeFts: null,
    awayFts: null,
    homeCs: null,
    awayCs: null,
    homeAdjAttack: null,
    homeAdjDefense: null,
    awayAdjAttack: null,
    awayAdjDefense: null,
    homeOver15: null,
    awayOver15: null,
    homeOver15For: null,
    awayOver15For: null,
    homeEarlyShare: null,
    homeLateShare: null,
    awayEarlyShare: null,
    awayLateShare: null,
    coverageScore: 0,
    quality: 0,
    grade: "UNUSABLE",
  };
}
function classifyOuLabel(label) {
  const t = label.trim().toLowerCase().replace(",", ".").replace(/\s+goals?$/, "");
  const side = /^(over|\bo\b)/.test(t) ? "over" : /^(under|\bu\b)/.test(t) ? "under" : null;
  if (!side) return null;
  if (/\b0\.5\b/.test(t)) return { side, line: 5 };
  if (/\b1\.5\b/.test(t)) return { side, line: 15 };
  if (/\b2\.5\b/.test(t)) return { side, line: 25 };
  if (/\b3\.5\b/.test(t)) return { side, line: 35 };
  if (/\b4\.5\b/.test(t)) return { side, line: 45 };
  return null;
}
/** First-half, second-half, team, corners, cards — not the 90-minute market. */
function betIsPeriodScoped(name) {
  const n = String(name ?? "").toLowerCase();
  return /first|1st|second|2nd|\bhalf\b|home team|away team|corner|card|booking|\basian\b/.test(n);
}
function isFullMatchOuBet(id, name) {
  if (id === 5) return true;
  if (betIsPeriodScoped(name)) return false;
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return n === "goals over/under" || n === "goals over / under" || n === "total goals" || n === "match goals";
}
function isFullMatchBttsBet(id, name) {
  if (id === 8) return true;
  if (betIsPeriodScoped(name)) return false;
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return n === "both teams score" || n === "both teams to score";
}
function isFullMatchCsBet(id, name) {
  if (id === 10) return true;
  if (betIsPeriodScoped(name)) return false;
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return n === "exact score" || n === "correct score";
}
function isFullMatchDcBet(id, name) {
  if (id === 12) return true;
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b/.test(n)) return false;
  return n === "double chance";
}
function isFullMatchAhBet(id, name) {
  if (id === 4) return true;
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b|corner|card|booking/.test(n)) return false;
  return n === "asian handicap";
}
function isFullMatchEhBet(id, name) {
  if (id === 9) return true;
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b|asian/.test(n)) return false;
  return n === "european handicap" || n === "handicap result" || n === "result handicap";
}
function isTeamScoreBet(id, name) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  // Score-first / last / both-halves are different markets. "Team To Score Last"
  // used to leak into Home-to-score Yes and pull the consensus from ~1.16 to ~1.44.
  if (/first|1st|second|2nd|\bhalf\b|\blast\b|both halves|either half|win to nil|anytime|scorer/.test(n)) {
    return false;
  }
  if (id === 43 || id === 44) return true;
  return (
    n === "home team score a goal" ||
    n === "away team score a goal" ||
    n === "home team to score" ||
    n === "away team to score" ||
    n === "team to score a goal"
  );
}
/** Full-match team totals. Over 0.5 ≡ team to score; Over 1.5 is a different pick. */
function isTeamGoalsOuSide(id, name) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b|corner|card|booking|exact/.test(n)) return null;
  const home =
    /^(home team total goals|goals over\/under - home team|goals over\/under home team|total - home|home team goals over\/under)$/.test(n);
  const away =
    /^(away team total goals|goals over\/under - away team|goals over\/under away team|total - away|away team goals over\/under)$/.test(n);
  if (home && !away) return "home";
  if (away && !home) return "away";
  if (id === 16 && /home/.test(n) && !/away/.test(n)) return "home";
  if (id === 17 && /away/.test(n) && !/home/.test(n)) return "away";
  return null;
}
function isFullMatchCornersOu(id, name) {
  if (id === 45) return false;
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b|handicap|asian|team|1x2|winner|most/.test(n)) return false;
  if (id === 49 || id === 55) return /corner/.test(n);
  return /^(total )?corners( over\/under)?$/.test(n) || (n.includes("corners") && /over\/under|total/.test(n) && !/team/.test(n));
}
function isCornersHandicap(id, name) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b/.test(n)) return false;
  if (!/corner/.test(n)) return false;
  return /handicap|asian/.test(n) || id === 50;
}
function isCornersWinner(id, name) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b|handicap/.test(n)) return false;
  if (!/corner/.test(n)) return false;
  return /1x2|winner|most corners|corners result/.test(n) || id === 54;
}
function isTeamCornersSide(id, name) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b|handicap/.test(n)) return null;
  if (!/corner/.test(n)) return null;
  if (/home team|home corners/.test(n) && !/away/.test(n)) return "home";
  if (/away team|away corners/.test(n) && !/home/.test(n)) return "away";
  if (id === 52) return "home";
  if (id === 53) return "away";
  return null;
}
function isPlayerGaMode(id, name) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|last|hat.?trick|2\+|two or more/.test(n)) return null;
  if (id === 92 || /anytime (goal )?scorer|player to score$|to score$/.test(n)) return "score";
  if (/score or assist|goal or assist|to score or assist/.test(n)) return "or";
  if (/anytime assist|player to assist/.test(n)) return "assist";
  return null;
}
function isFullMatchCardsOu(id, name) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b|handicap|asian|player/.test(n)) return false;
  if (id === 45 || id === 80) return /card|booking/.test(n) || n === "cards over/under";
  return n === "cards over/under" || n === "total cards" || n === "total bookings" || (/(cards|bookings)/.test(n) && /over\/under|total/.test(n));
}
function isFullMatchOddEven(id, name) {
  if (id === 21) return true;
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b/.test(n)) return false;
  return n === "odd/even" || n === "odd / even" || n === "goals odd/even" || /odd.?even|even.?odd/.test(n);
}
function isFullMatchMultiGoals(id, name) {
  const n = String(name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/first|1st|second|2nd|\bhalf\b/.test(n)) return false;
  return /multi goals|goals range|exact goals number|goal range/.test(n);
}
function parseDcLabel(label) {
  const t = String(label ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const compact = t.replace(/\s+/g, "");
  if (compact === "1x" || t === "home/draw" || t === "home or draw" || t === "home / draw") return "1x";
  if (compact === "x2" || t === "draw/away" || t === "draw or away" || t === "away/draw" || t === "draw / away") return "x2";
  if (compact === "12" || t === "home/away" || t === "home or away" || t === "home / away") return "12";
  return null;
}
function parseAhLabel(label, handicap) {
  const t = String(label ?? "").trim();
  const hRaw = handicap != null && String(handicap).trim() !== "" ? Number(String(handicap).replace(",", ".")) : null;
  const m = t.match(/^(home|away)\s*([+-]?\d+(?:\.\d+)?)?$/i);
  if (!m) return null;
  const side = m[1].toLowerCase() === "away" ? "away" : "home";
  const line = m[2] != null ? Number(m[2].replace(",", ".")) : hRaw;
  if (line == null || !Number.isFinite(line)) return null;
  const q = Math.round(line * 4) / 4;
  return { side, line: q };
}
function parseEhLabel(label, handicap) {
  const t = String(label ?? "").trim();
  const hRaw = handicap != null && String(handicap).trim() !== "" ? Number(String(handicap).replace(",", ".")) : null;
  const m = t.match(/^(home|draw|away)\s*([+-]?\d+(?:\.\d+)?)?$/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const side = raw === "away" ? "away" : raw === "draw" ? "draw" : "home";
  const line = m[2] != null ? Number(m[2].replace(",", ".")) : hRaw;
  if (line == null || !Number.isFinite(line)) return null;
  return { side, line };
}
function parseCountLabel(label) {
  const t = String(label ?? "").trim().toLowerCase().replace(",", ".");
  const side = /^(over|\bo\b)/.test(t) ? "over" : /^(under|\bu\b)/.test(t) ? "under" : null;
  if (!side) return null;
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const line = Number(m[1]);
  if (!Number.isFinite(line)) return null;
  return { side, line };
}
function ahSelection(side, line) {
  const sign = line > 0 ? "+" : "";
  return `${side === "away" ? "Away" : "Home"} ${sign}${line}`;
}
function ehSelection(side, line) {
  const sign = line > 0 ? "+" : "";
  const name = side === "away" ? "Away" : side === "draw" ? "Draw" : "Home";
  return `${name} ${sign}${line}`;
}
function parseTeamScoreSide(betName, value, id) {
  const n = String(betName ?? "").toLowerCase();
  const v = String(value ?? "").toLowerCase().trim();
  const homeNamed = (/home/.test(n) && !/away/.test(n)) || id === 43;
  const awayNamed = (/away/.test(n) && !/home/.test(n)) || id === 44;
  if (homeNamed) {
    if (v === "yes" || v === "home") return { team: "home", yes: true };
    if (v === "no") return { team: "home", yes: false };
    return null;
  }
  if (awayNamed) {
    if (v === "yes" || v === "away") return { team: "away", yes: true };
    if (v === "no") return { team: "away", yes: false };
    return null;
  }
  if (v === "home" || v === "home yes") return { team: "home", yes: true };
  if (v === "away" || v === "away yes") return { team: "away", yes: true };
  return null;
}
/**
 * Full-match Over 1.5 lives at ~1.10–1.40. First-half / team 1.5 lives at ~1.70.
 * If both clusters are posted, keep the short (match) quotes.
 */
function collapseOu15Cluster(over, under) {
  const shortO = over.filter((l) => l.odd > 1 && l.odd < 1.45);
  const longO = over.filter((l) => l.odd >= 1.62);
  if (shortO.length && longO.length) {
    const longU = under.filter((l) => l.odd >= 3);
    return { over: shortO, under: longU.length ? longU : under };
  }
  return { over, under };
}
function parseCsLabel(label) {
  const s = parseScore(label);
  if (!s) return null;
  return `${s.home}-${s.away}`;
}
/**
 * Trimmed-median consensus. A lone 1.93 does not beat a 1.05 cluster.
 * inBand is decided on the median, not the named sharp book.
 */
function consensusPrice(lines, band = ODDS_BAND) {
  const clean = lines.filter((l) => l.odd > 1 && Number.isFinite(l.odd));
  if (!clean.length) {
    return { median: null, n: 0, reliable: false, inBand: false, sharp: null, cluster: [] };
  }
  const rawMed = trimmedMedian(clean.map((l) => l.odd)) ?? median(clean.map((l) => l.odd));
  const rel = 0.12;
  const cluster = clean.filter((l) => Math.abs(l.odd - rawMed) / Math.max(rawMed, 1e-6) <= rel);
  const use = cluster.length >= 2 ? cluster : clean;
  const med = trimmedMedian(use.map((l) => l.odd)) ?? median(use.map((l) => l.odd));
  const ranked = [...use].sort((a, b) => {
    const sa = bookmakerScore(a.bookmakerId, a.bookmaker);
    const sb = bookmakerScore(b.bookmakerId, b.bookmaker);
    if (sb !== sa) return sb - sa;
    return Math.abs(a.odd - (med ?? a.odd)) - Math.abs(b.odd - (med ?? b.odd));
  });
  const sharp = ranked[0] ?? null;
  const n = use.length;
  const reliable = n >= 3 || (n >= 2 && cluster.length === n);
  const inBand = med != null && med >= band.min - 1e-9 && med <= band.max + 1e-9;
  return { median: med, n, reliable, inBand, sharp, cluster: use };
}
function bandForKind(kind) {
  if (kind === "cs") return CS_ODDS_BAND;
  if (kind === "draw") return DRAW_ODDS_BAND;
  if (kind === "home_score" || kind === "away_score") return TEAM_ODDS_BAND;
  if (kind === "multi_goals") return MULTI_GOALS_ODDS_BAND;
  if (kind === "combo") return COMBO_ODDS_BAND;
  if (kind === "player_ga") return PLAYER_ODDS_BAND;
  return ODDS_BAND;
}
function toSide(kind, selection, lines, extra = {}) {
  if (!lines.length) return null;
  const band = bandForKind(kind);
  const c = consensusPrice(lines, band);
  if (c.median == null) return null;
  return {
    kind,
    selection,
    medianOdd: c.median,
    sharpOdd: c.sharp?.odd ?? c.median,
    sharpBook: c.sharp?.bookmaker ?? null,
    shinImplied: null,
    inBand: c.inBand,
    books: lines,
    reliable: c.reliable,
    consensusOdd: c.median,
    bookCount: c.n,
    line: extra.line ?? null,
  };
}
/** @returns {Partial<Record<"over" | "under", import("./types.ts").SideMarket>>} */
function fillOu(over, under, overKind, underKind, overSel, underSel): Partial<Record<"over" | "under", SideMarket>> {
  const o = toSide(overKind, overSel, over);
  const u = toSide(underKind, underSel, under);
  if (o) {
    o.shinImplied = shinImpliedOver(o.medianOdd ?? o.sharpOdd ?? 1.9, u?.medianOdd ?? null);
  }
  if (u) {
    const overP =
      o?.shinImplied ?? (o?.medianOdd ? shinImpliedOver(o.medianOdd, u.medianOdd) : null);
    u.shinImplied = overP != null ? 1 - overP : u.medianOdd ? 1 / u.medianOdd : null;
  }
  /** @type {Partial<Record<"over" | "under", import("./types.ts").SideMarket>>} */
  const out = {};
  if (o) out.over = o;
  if (u) out.under = u;
  return out;
}
/** @returns {import("./types.ts").FixtureMarkets | null} */
function extractFixtureMarkets(row): FixtureMarkets | null {
  const fixtureId = row.fixture?.id;
  if (!fixtureId) return null;
  const home = [];
  const draw = [];
  const away = [];
  const yes = [];
  const no = [];
  const o05 = [];
  const u05 = [];
  const o15 = [];
  const u15 = [];
  const o25 = [];
  const u25 = [];
  const o35 = [];
  const u35 = [];
  const o45 = [];
  const u45 = [];
  const dc1x = [];
  const dcx2 = [];
  const dc12 = [];
  const homeScoreYes = [];
  const homeScoreNo = [];
  const awayScoreYes = [];
  const awayScoreNo = [];
  const csMap = new Map();
  const ahMap = new Map();
  const ehMap = new Map();
  const ouAsianMap = new Map();
  const cornerMap = new Map();
  const cardMap = new Map();
  const playerGaMap = new Map();
  const evenLines = [];
  const oddLines = [];
  const multiMap = new Map();
  const pushMap = (map, key, line) => {
    const arr = map.get(key) ?? [];
    arr.push(line);
    map.set(key, arr);
  };
  for (const book of row.bookmakers ?? []) {
    const bid = book.id ?? 0;
    const bname = book.name ?? "Book";
    for (const bet of book.bets ?? []) {
      const name = (bet.name ?? "").toLowerCase();
      const id = bet.id;
      const isWinner = id === 1 || name === "match winner";
      const isBtts = isFullMatchBttsBet(id, name);
      const isOu = isFullMatchOuBet(id, name);
      const isCs = isFullMatchCsBet(id, name);
      const isDc = isFullMatchDcBet(id, name);
      const isAh = isFullMatchAhBet(id, name);
      const isEh = isFullMatchEhBet(id, name);
      const isTeam = isTeamScoreBet(id, name);
      const teamOu = isTeamGoalsOuSide(id, name);
      const isCorners = isFullMatchCornersOu(id, name);
      const isCornerHc = isCornersHandicap(id, name);
      const isCornerWin = isCornersWinner(id, name);
      const teamCorner = isTeamCornersSide(id, name);
      const isCards = isFullMatchCardsOu(id, name);
      const playerGaMode = isPlayerGaMode(id, name);
      const isOddEven = isFullMatchOddEven(id, name);
      const isMulti = isFullMatchMultiGoals(id, name);
      for (const v of bet.values ?? []) {
        const odd = Number.parseFloat(String(v.odd ?? ""));
        if (!(odd > 1)) continue;
        const label = String(v.value ?? "").trim();
        const handicap = v.handicap ?? v.line ?? null;
        const line = { bookmakerId: bid, bookmaker: bname, odd };
        if (isWinner) {
          const l = label.toLowerCase();
          if (l === "home") home.push(line);
          else if (l === "draw") draw.push(line);
          else if (l === "away") away.push(line);
        } else if (isBtts) {
          const l = label.toLowerCase();
          if (l === "yes") yes.push(line);
          else if (l === "no") no.push(line);
        } else if (isOu) {
          const cls = classifyOuLabel(label);
          if (cls) {
            if (cls.line === 5 && cls.side === "over") o05.push(line);
            else if (cls.line === 5 && cls.side === "under") u05.push(line);
            else if (cls.line === 15 && cls.side === "over") o15.push(line);
            else if (cls.line === 15 && cls.side === "under") u15.push(line);
            else if (cls.line === 25 && cls.side === "over") o25.push(line);
            else if (cls.line === 25 && cls.side === "under") u25.push(line);
            else if (cls.line === 35 && cls.side === "over") o35.push(line);
            else if (cls.line === 35 && cls.side === "under") u35.push(line);
            else if (cls.line === 45 && cls.side === "over") o45.push(line);
            else if (cls.line === 45 && cls.side === "under") u45.push(line);
          } else {
            const cnt = parseCountLabel(label);
            if (cnt && isAsianTotalLine(cnt.line)) {
              pushMap(ouAsianMap, formatOuAsianSelection(cnt.side, cnt.line), line);
            }
          }
        } else if (isCs) {
          const score = parseCsLabel(label);
          if (!score) continue;
          pushMap(csMap, score, line);
        } else if (isDc) {
          const dc = parseDcLabel(label);
          if (dc === "1x") dc1x.push(line);
          else if (dc === "x2") dcx2.push(line);
          else if (dc === "12") dc12.push(line);
        } else if (isAh) {
          const ah = parseAhLabel(label, handicap);
          if (!ah) continue;
          pushMap(ahMap, ahSelection(ah.side, ah.line), line);
        } else if (isEh) {
          const eh = parseEhLabel(label, handicap);
          if (!eh) continue;
          pushMap(ehMap, ehSelection(eh.side, eh.line), line);
        } else if (isTeam) {
          const ts = parseTeamScoreSide(name, label, id);
          if (!ts) continue;
          if (ts.team === "home" && ts.yes) homeScoreYes.push(line);
          else if (ts.team === "home") homeScoreNo.push(line);
          else if (ts.team === "away" && ts.yes) awayScoreYes.push(line);
          else awayScoreNo.push(line);
        } else if (teamOu) {
          const cls = classifyOuLabel(label);
          if (!cls || cls.line !== 5) continue;
          if (teamOu === "home" && cls.side === "over") homeScoreYes.push(line);
          else if (teamOu === "home") homeScoreNo.push(line);
          else if (teamOu === "away" && cls.side === "over") awayScoreYes.push(line);
          else awayScoreNo.push(line);
        } else if (isCorners) {
          const cnt = parseCountLabel(label);
          if (!cnt) continue;
          if (cnt.line < 5 || cnt.line > 16) continue;
          const sel = `${cnt.side === "under" ? "Under" : "Over"} ${cnt.line}`;
          pushMap(cornerMap, sel, line);
        } else if (isCornerHc) {
          const ah = parseAhLabel(label, handicap);
          if (!ah) continue;
          const sel = formatCornerMarket({ variant: "handicap", side: ah.side, line: ah.line });
          pushMap(cornerMap, sel, line);
        } else if (isCornerWin) {
          const l = label.toLowerCase();
          let sel = null;
          if (l === "home" || /home/.test(l) && !/away|draw/.test(l)) sel = formatCornerMarket({ variant: "winner", side: "home" });
          else if (l === "away" || /away/.test(l) && !/home|draw/.test(l)) sel = formatCornerMarket({ variant: "winner", side: "away" });
          else if (l === "draw" || /draw|tie/.test(l)) sel = formatCornerMarket({ variant: "winner", side: "draw" });
          if (!sel) continue;
          pushMap(cornerMap, sel, line);
        } else if (teamCorner) {
          const cnt = parseCountLabel(label);
          if (!cnt) continue;
          if (cnt.line < 1.5 || cnt.line > 12) continue;
          const sel = formatCornerMarket({ variant: "team", team: teamCorner, side: cnt.side, line: cnt.line });
          pushMap(cornerMap, sel, line);
        } else if (isCards) {
          const cnt = parseCountLabel(label);
          if (!cnt) continue;
          if (cnt.line < 2 || cnt.line > 8) continue;
          const sel = `${cnt.side === "under" ? "Under" : "Over"} ${cnt.line}`;
          pushMap(cardMap, sel, line);
        } else if (isOddEven) {
          const oe = parseOddEven(label);
          if (oe === "even") evenLines.push(line);
          else if (oe === "odd") oddLines.push(line);
        } else if (isMulti) {
          const mg = parseMultiGoals(label);
          if (!mg) continue;
          pushMap(multiMap, formatMultiGoals(mg), line);
        } else if (playerGaMode) {
          const parsed = parsePlayerGa(label) ?? { name: label, mode: playerGaMode };
          if (!parsed.name || parsed.name.length < 2) continue;
          const sel = formatPlayerGa(parsed.name, playerGaMode);
          pushMap(playerGaMap, sel, line);
        }
      }
    }
  }
  const winner = {};
  const h = toSide("home", "Home", home);
  const d = toSide("draw", "Draw", draw);
  const a = toSide("away", "Away", away);
  if (h && d && a && h.medianOdd && d.medianOdd && a.medianOdd) {
    const [ph, pd, pa] = shinInvert([h.medianOdd, d.medianOdd, a.medianOdd]);
    h.shinImplied = ph ?? null;
    a.shinImplied = pa ?? null;
    if (d) d.shinImplied = pd ?? null;
  }
  if (h) winner.home = h;
  if (a) winner.away = a;
  if (d) winner.draw = { ...d, kind: "draw", selection: "Draw" };
  const btts = {};
  const y = toSide("btts_yes", "BTTS Yes", yes);
  const n = toSide("btts_no", "BTTS No", no);
  if (y && n && y.medianOdd && n.medianOdd) {
    const [py, pn] = shinInvert([y.medianOdd, n.medianOdd]);
    y.shinImplied = py ?? null;
    n.shinImplied = pn ?? null;
  }
  if (y) btts.yes = y;
  if (n) btts.no = n;
  const correctScores = [];
  for (const [score, lines] of csMap) {
    const side = toSide("cs", score, lines);
    if (!side) continue;
    if (side.medianOdd) side.shinImplied = 1 / side.medianOdd;
    correctScores.push(side);
  }
  const ou15Pair = collapseOu15Cluster(o15, u15);
  const dc = {};
  const d1 = toSide("dc_1x", "1X", dc1x);
  const d2 = toSide("dc_x2", "X2", dcx2);
  const d12 = toSide("dc_12", "12", dc12);
  if (d1 && d1.medianOdd) d1.shinImplied = 1 / d1.medianOdd;
  if (d2 && d2.medianOdd) d2.shinImplied = 1 / d2.medianOdd;
  if (d12 && d12.medianOdd) d12.shinImplied = 1 / d12.medianOdd;
  if (d1) dc["1x"] = d1;
  if (d2) dc.x2 = d2;
  if (d12) dc["12"] = d12;

  const hsY = toSide("home_score", "Home to score", homeScoreYes);
  const hsN = toSide("home_score", "Home fail to score", homeScoreNo);
  const asY = toSide("away_score", "Away to score", awayScoreYes);
  const asN = toSide("away_score", "Away fail to score", awayScoreNo);
  if (hsY && hsN && hsY.medianOdd && hsN.medianOdd) {
    const [py, pn] = shinInvert([hsY.medianOdd, hsN.medianOdd]);
    hsY.shinImplied = py ?? null;
    hsN.shinImplied = pn ?? null;
  } else if (hsY && hsY.medianOdd) hsY.shinImplied = 1 / hsY.medianOdd;
  if (asY && asN && asY.medianOdd && asN.medianOdd) {
    const [py, pn] = shinInvert([asY.medianOdd, asN.medianOdd]);
    asY.shinImplied = py ?? null;
    asN.shinImplied = pn ?? null;
  } else if (asY && asY.medianOdd) asY.shinImplied = 1 / asY.medianOdd;

  const asianHandicap = [];
  const ahHomeByLine = new Map();
  const ahAwayByLine = new Map();
  for (const [sel, lines] of ahMap) {
    const parsed = parseAhLabel(sel, null);
    if (!parsed) continue;
    const side = toSide("ah", sel, lines, { line: parsed.line });
    if (!side) continue;
    if (parsed.side === "home") ahHomeByLine.set(parsed.line, side);
    else ahAwayByLine.set(parsed.line, side);
    asianHandicap.push(side);
  }
  for (const [line, hs] of ahHomeByLine) {
    const aw = ahAwayByLine.get(-line);
    if (hs.medianOdd && aw?.medianOdd) {
      const [ph, pa] = shinInvert([hs.medianOdd, aw.medianOdd]);
      hs.shinImplied = ph ?? null;
      aw.shinImplied = pa ?? null;
    } else if (hs.medianOdd) hs.shinImplied = 1 / hs.medianOdd;
  }
  for (const [line, aw] of ahAwayByLine) {
    if (aw.shinImplied == null && aw.medianOdd) aw.shinImplied = 1 / aw.medianOdd;
  }

  const europeanHandicap = [];
  for (const [sel, lines] of ehMap) {
    const parsed = parseEhLabel(sel, null);
    const side = toSide("eh", sel, lines, { line: parsed?.line ?? null });
    if (!side) continue;
    if (side.medianOdd) side.shinImplied = 1 / side.medianOdd;
    europeanHandicap.push(side);
  }

  const ouAsian = [];
  for (const [sel, lines] of ouAsianMap) {
    const cnt = parseCountLabel(sel);
    const side = toSide("ou_asian", sel, lines, { line: cnt?.line ?? null });
    if (!side) continue;
    if (side.medianOdd) side.shinImplied = 1 / side.medianOdd;
    ouAsian.push(side);
  }

  const corners = [];
  for (const [sel, lines] of cornerMap) {
    const parsed = parseCornerMarket(sel);
    const side = toSide("corners", sel, lines, { line: parsed && "line" in parsed ? parsed.line : null });
    if (!side) continue;
    if (side.medianOdd) side.shinImplied = 1 / side.medianOdd;
    corners.push(side);
  }
  const cards = [];
  for (const [sel, lines] of cardMap) {
    const cnt = parseCountLabel(sel);
    const side = toSide("cards", sel, lines, { line: cnt?.line ?? null });
    if (!side) continue;
    if (side.medianOdd) side.shinImplied = 1 / side.medianOdd;
    cards.push(side);
  }

  const oddEven = {};
  const evn = toSide("odd_even", "Even", evenLines);
  const od = toSide("odd_even", "Odd", oddLines);
  if (evn && od && evn.medianOdd && od.medianOdd) {
    const [pe, po] = shinInvert([evn.medianOdd, od.medianOdd]);
    evn.shinImplied = pe ?? null;
    od.shinImplied = po ?? null;
  } else {
    if (evn && evn.medianOdd) evn.shinImplied = 1 / evn.medianOdd;
    if (od && od.medianOdd) od.shinImplied = 1 / od.medianOdd;
  }
  if (evn) oddEven.even = evn;
  if (od) oddEven.odd = od;

  const multiGoals = [];
  for (const [sel, lines] of multiMap) {
    const side = toSide("multi_goals", sel, lines);
    if (!side) continue;
    if (side.medianOdd) side.shinImplied = 1 / side.medianOdd;
    multiGoals.push(side);
  }

  const playerGa = [];
  for (const [sel, lines] of playerGaMap) {
    const side = toSide("player_ga", sel, lines);
    if (!side) continue;
    if (side.medianOdd) side.shinImplied = 1 / side.medianOdd;
    playerGa.push(side);
  }

  return {
    fixtureId,
    winner,
    btts,
    ou15: fillOu(ou15Pair.over, ou15Pair.under, "over_15", "under_15", "Over 1.5", "Under 1.5"),
    ou25: fillOu(o25, u25, "over_25", "under_25", "Over 2.5", "Under 2.5"),
    ou05: fillOu(o05, u05, "over_05", "under_05", "Over 0.5", "Under 0.5"),
    ou35: fillOu(o35, u35, "over_35", "under_35", "Over 3.5", "Under 3.5"),
    ou45: fillOu(o45, u45, "over_45", "under_45", "Over 4.5", "Under 4.5"),
    doubleChance: dc,
    homeScore: { yes: hsY ?? undefined, no: hsN ?? undefined },
    awayScore: { yes: asY ?? undefined, no: asN ?? undefined },
    asianHandicap,
    europeanHandicap,
    ouAsian,
    corners,
    cards,
    playerGa,
    correctScores,
    oddEven,
    multiGoals,
  };
}
function extractInjuries(rows) {
  const byFix = new Map();
  for (const row of rows) {
    const fid = row.fixture?.id;
    const tid = row.team?.id;
    if (!fid || !tid) continue;
    const type = (row.player?.type ?? "").toLowerCase();
    const w = /missing|injured|out|suspended/.test(type) ? 1 : 0.4;
    const inner = byFix.get(fid) ?? new Map();
    inner.set(tid, (inner.get(tid) ?? 0) + w);
    byFix.set(fid, inner);
  }
  const out = new Map();
  for (const [fid, teams] of byFix) {
    const vals = [...teams.values()];
    out.set(fid, { home: vals[0] ?? 0, away: vals[1] ?? 0 });
  }
  return out;
}
function attachInjuryToFixture(counts, fixtureId, homeId, awayId) {
  const zero = { attack: 0, defense: 0, keeper: 0 };
  const inner = counts.get(fixtureId);
  if (!inner) return { home: zero, away: zero };
  return { home: inner.get(homeId) ?? zero, away: inner.get(awayId) ?? zero };
}
function injuryWeights(type, reason) {
  const t = `${type} ${reason}`.toLowerCase();
  const doubtful = /doubt|questionable|knock/.test(t);
  const suspended = /suspend/.test(t);
  const scale = doubtful ? 0.3 : suspended ? 0.75 : 1;
  if (/goalkeeper|\bgk\b/.test(t))
    return { attack: 0, defense: 0.04 * scale, keeper: 0.16 * scale };
  if (/striker|forward|attack|winger/.test(t))
    return { attack: 0.09 * scale, defense: 0, keeper: 0 };
  if (/defender|centre-back|center-back|\bcb\b|full-back|fullback/.test(t)) {
    return { attack: 0, defense: 0.07 * scale, keeper: 0 };
  }
  return { attack: 0.035 * scale, defense: 0.025 * scale, keeper: 0 };
}
function groupInjuriesByTeam(rows) {
  const byFix = new Map();
  for (const row of rows) {
    const fid = row.fixture?.id;
    const tid = row.team?.id;
    if (!fid || !tid) continue;
    const type = row.player?.type ?? row.type ?? "";
    const reason = row.player?.reason ?? row.reason ?? "";
    const add = injuryWeights(type, reason);
    const inner = byFix.get(fid) ?? new Map();
    const cur = inner.get(tid) ?? { attack: 0, defense: 0, keeper: 0 };
    inner.set(tid, {
      attack: Math.min(0.22, cur.attack + add.attack),
      defense: Math.min(0.18, cur.defense + add.defense),
      keeper: Math.min(0.2, cur.keeper + add.keeper),
    });
    byFix.set(fid, inner);
  }
  return byFix;
}
function espnFormLast5(form) {
  return { forAvg: null, againstAvg: null, form };
}

/** Keep every book. A later row fills a bet the first bookmaker left blank. */
export function mergeOddsRows(a, b) {
  if (!a) return b;
  if (!b) return a;
  const books = new Map();
  const add = (book) => {
    if (!book) return;
    const id = String(book.id ?? book.name ?? books.size);
    const prev = books.get(id);
    if (!prev) {
      books.set(id, book);
      return;
    }
    const bets = new Map();
    for (const bet of [...(prev.bets ?? []), ...(book.bets ?? [])]) {
      const key = String(bet?.id ?? bet?.name ?? bets.size);
      if (!bets.has(key)) bets.set(key, bet);
    }
    books.set(id, { ...prev, ...book, bets: [...bets.values()] });
  };
  for (const book of a.bookmakers ?? []) add(book);
  for (const book of b.bookmakers ?? []) add(book);
  return { ...a, fixture: b.fixture ?? a.fixture, bookmakers: [...books.values()] };
}

/** @returns {{ line?: number, over15?: number, under15?: number, over25?: number, under25?: number, home?: number, away?: number }} */
function oddsFromEspn(event): {
  line?: number;
  over15?: number;
  under15?: number;
  over25?: number;
  under25?: number;
  home?: number;
  away?: number;
} {
  const odds = event.competitions?.[0]?.odds?.[0];
  if (!odds) return {};
  const line = odds.overUnder;
  let overDec;
  let underDec;
  const overAm = odds.total?.over?.close?.odds;
  const underAm = odds.total?.under?.close?.odds;
  if (overAm) overDec = americanToDecimal(Number(overAm));
  if (underAm) underDec = americanToDecimal(Number(underAm));
  if (odds.overOdds) overDec = americanToDecimal(odds.overOdds);
  if (odds.underOdds) underDec = americanToDecimal(odds.underOdds);
  const out = { line };
  if (line === 1.5) {
    out.over15 = overDec;
    out.under15 = underDec;
  } else if (line === 2.5) {
    out.over25 = overDec;
  }
  return out;
}
function binarySides(m) {
  return [
    m.winner.home,
    m.winner.away,
    m.winner.draw,
    m.btts.yes,
    m.btts.no,
    m.ou15.over,
    m.ou15.under,
    m.ou25.over,
    m.ou25.under,
    m.ou05?.over,
    m.ou05?.under,
    m.ou35?.over,
    m.ou35?.under,
    m.ou45?.over,
    m.ou45?.under,
    m.doubleChance?.["1x"],
    m.doubleChance?.x2,
    m.doubleChance?.["12"],
    m.homeScore?.yes,
    m.awayScore?.yes,
    ...(m.asianHandicap ?? []),
    ...(m.europeanHandicap ?? []),
    ...(m.ouAsian ?? []),
    ...(m.corners ?? []),
    ...(m.cards ?? []),
    ...(m.playerGa ?? []),
    m.oddEven?.even,
    m.oddEven?.odd,
    ...(m.multiGoals ?? []),
  ];
}
function sideOdd(s) {
  return s?.consensusOdd ?? s?.sharpOdd ?? s?.medianOdd ?? null;
}
function anyInBand(m) {
  return binarySides(m).some((s) => s?.inBand);
}
function anyBinaryPlayable(m) {
  return binarySides(m).some((s) => {
    const odd = sideOdd(s);
    if (odd == null) return false;
    if (s.kind === "draw") return inOddsBand(odd, DRAW_ODDS_BAND.min, DRAW_ODDS_BAND.max);
    if (s.kind === "home_score" || s.kind === "away_score") {
      return inOddsBand(odd, TEAM_ODDS_BAND.min, TEAM_ODDS_BAND.max);
    }
    if (s.kind === "multi_goals") {
      return inOddsBand(odd, MULTI_GOALS_ODDS_BAND.min, MULTI_GOALS_ODDS_BAND.max);
    }
    if (s.kind === "combo") {
      return inOddsBand(odd, COMBO_ODDS_BAND.min, COMBO_ODDS_BAND.max);
    }
    return inOddsBand(odd, ODDS_PLAYABLE.min, ODDS_PLAYABLE.max);
  });
}
function cheapScore(leagueW, _odd) {
  return leagueW;
}
function bestInBandOdd(m) {
  const sides = binarySides(m).filter((s) => Boolean(s?.inBand));
  if (!sides.length) return null;
  sides.sort((a, b) => Math.abs((sideOdd(a) ?? 9) - 1.925) - Math.abs((sideOdd(b) ?? 9) - 1.925));
  return sideOdd(sides[0]);
}
function bestPlayableOdd(m) {
  const sides = binarySides(m).filter((s) => {
    const odd = sideOdd(s);
    return odd != null && inOddsBand(odd, ODDS_PLAYABLE.min, ODDS_PLAYABLE.max);
  });
  if (!sides.length) return null;
  sides.sort((a, b) => Math.abs((sideOdd(a) ?? 9) - 1.925) - Math.abs((sideOdd(b) ?? 9) - 1.925));
  return sideOdd(sides[0]);
}
function extractLeagueCoverage(raw) {
  const page = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const out = new Map();
  for (const row of page) {
    const r = row;
    const id = r.league?.id;
    if (!id) continue;
    const season =
      (r.seasons ?? []).find((s) => s.current) ??
      r.seasons?.[r.seasons.length - 1];
    const c = season?.coverage;
    if (!c) continue;
    const events = Boolean(c.fixtures?.events);
    const lineups = Boolean(c.fixtures?.lineups);
    const fixtureStats = Boolean(c.fixtures?.statistics_fixtures);
    const standings = Boolean(c.standings);
    const injuries = Boolean(c.injuries);
    const predictions = Boolean(c.predictions);
    const odds = Boolean(c.odds);
    const score =
      (standings ? 0.2 : 0) +
      (injuries ? 0.15 : 0) +
      (predictions ? 0.1 : 0) +
      (odds ? 0.2 : 0) +
      (lineups ? 0.15 : 0) +
      (events ? 0.1 : 0) +
      (fixtureStats ? 0.1 : 0);
    const playerStats = Boolean(c.players) || Boolean(c.fixtures?.statistics_players);
    out.set(id, {
      leagueId: id,
      standings,
      injuries,
      predictions,
      odds,
      lineups,
      events,
      fixtureStats,
      playerStats,
      score,
    });
  }
  return out;
}
function formationTilt(formation) {
  if (!formation) return { attack: 0, defense: 0 };
  const parts = formation
    .split(/[-–/]/)
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => n > 0);
  if (parts.length < 2) return { attack: 0, defense: 0 };
  const back = parts[0];
  const front = parts[parts.length - 1];
  let attack = 0;
  let defense = 0;
  if (back >= 5) {
    attack += 0.04;
    defense -= 0.03;
  } else if (back <= 3) {
    attack -= 0.03;
    defense += 0.02;
  }
  if (front >= 3) attack -= 0.03;
  else if (front <= 1) attack += 0.03;
  return { attack, defense };
}
function extractLineups(raw, homeId, awayId) {
  const page = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const byTeam = new Map();
  for (const row of page) {
    const r = row;
    const tid = r.team?.id;
    if (!tid) continue;
    const xi = r.startXI ?? [];
    const starters = xi.length;
    if (starters < 8) {
      byTeam.set(tid, {
        ...emptyLineup(),
        formation: r.formation ?? null,
        starters,
      });
      continue;
    }
    let gk = 0;
    let fwd = 0;
    for (const slot of xi) {
      const pos = (slot.player?.pos ?? "").toUpperCase();
      const name = (slot.player?.name ?? "").toLowerCase();
      if (pos === "G" || /goalkeeper|\bgk\b/.test(name)) gk += 1;
      if (pos === "F" || pos === "A") fwd += 1;
    }
    const form = formationTilt(r.formation ?? null);
    let attack = form.attack;
    let defense = form.defense;
    let keeper = 0;
    if (gk === 0) keeper = 0.12;
    if (fwd === 0) attack += 0.08;
    else if (fwd >= 3) attack -= 0.02;
    byTeam.set(tid, {
      attack: Math.min(0.18, Math.max(-0.08, attack)),
      defense: Math.min(0.12, Math.max(-0.08, defense)),
      keeper: Math.min(0.16, keeper),
      formation: r.formation ?? null,
      confirmed: true,
      starters,
      players: xi
        .map((slot) => ({
          id: slot.player?.id ?? 0,
          name: slot.player?.name ?? "",
          pos: slot.player?.pos ?? null,
          number: slot.player?.number ?? null,
        }))
        .filter((p) => p.id > 0 || p.name),
    });
  }
  return {
    home: byTeam.get(homeId) ?? emptyLineup(),
    away: byTeam.get(awayId) ?? emptyLineup(),
  };
}
function extractFixtureCorners(raw, homeId, awayId) {
  const map = extractFixtureCornerMap(raw);
  return { home: map.get(homeId) ?? null, away: map.get(awayId) ?? null };
}
function extractFixtureCornerMap(raw) {
  const page = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const map = new Map();
  for (const row of page) {
    const tid = row?.team?.id;
    if (!tid) continue;
    const stats = row?.statistics ?? [];
    for (const s of stats) {
      const t = String(s?.type ?? "").toLowerCase();
      if (t === "corner kicks" || t === "corners") {
        const v = num(s?.value);
        if (v != null) map.set(tid, v);
      }
    }
  }
  return map;
}
function extractPlayerSeason(raw, teamId) {
  const page = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  /** @type {import("./types.ts").PlayerSeasonStats[]} */
  const out = [];
  for (const row of page) {
    const pid = row?.player?.id;
    const name = row?.player?.name ?? "";
    if (!pid) continue;
    const stats = Array.isArray(row?.statistics) ? row.statistics : [];
    const st = stats.find((s) => s?.team?.id === teamId) ?? stats[0];
    if (!st) continue;
    out.push({
      id: pid,
      name,
      teamId: st.team?.id ?? teamId,
      minutes: num(st.games?.minutes),
      appearances: num(st.games?.appearences ?? st.games?.appearances),
      starts: num(st.games?.lineups),
      goals: num(st.goals?.total),
      assists: num(st.goals?.assists),
      shots: num(st.shots?.total),
      sot: num(st.shots?.on),
      keyPasses: num(st.passes?.key),
      position: st.games?.position ?? row.player?.position ?? null,
      penaltyGoals: num(st.penalty?.scored),
    });
  }
  return out;
}
export {
  SHARP_BOOK_RE,
  anyBinaryPlayable,
  anyInBand,
  applyStandings,
  applyTeamSample,
  attachInjuryToFixture,
  bestInBandOdd,
  bestPlayableOdd,
  cheapScore,
  consensusPrice,
  emptyPrediction,
  espnFormLast5,
  extractEspnStandings,
  extractFixtureMarkets,
  extractH2hFixtures,
  extractInjuries,
  extractLeagueCoverage,
  extractLineups,
  extractPrediction,
  extractStandings,
  extractTeamStatistics,
  extractFixtureCorners,
  extractFixtureCornerMap,
  extractPlayerSeason,
  finishedSamples,
  groupInjuriesByTeam,
  inferSeason,
  last5FromFixtures,
  mergeH2h,
  minuteShares,
  oddsFromEspn,
  parseFixture,
  parseUpcomingStatus,
  isFinishedStatus,
  standingByTeam,
  underOverRate,
  venueSplit,
};
