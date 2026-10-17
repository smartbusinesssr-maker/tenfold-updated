// Unified Prediction Engine — TRUE ensemble of ALL V7.1 + Auto Generate models
// 10-model ensemble: Dixon-Coles, Shin Market, H2H Elo, Bivariate Poisson,
// Negative Binomial, Ordered Logit, Form Momentum, Table Edge, API-Football, GK Adjustment
// Self-contained edge function with chunked self-invocation, adaptive rate limiting,
// and DeepSeek calibration parameter awareness.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { applyReliabilityGate } from '../_shared/reliabilityGate.ts'
import { fetchOddsWithFallback } from '../_shared/oddsFallback.ts'
import { selectTopQualityPicks, type QualityCandidate } from '../_shared/qualitySelector.ts'
import { buildQualityInputs } from '../_shared/qualityInputsBuilder.ts'
import { evaluateLatestMatchConfirmation } from '../_shared/latestMatchConfirmation.ts'
import { dixonColesTauExtended, getLeagueBpRho, getLeagueNbR } from '../_shared/predictionTuning.ts'
import { buildBttsIntel } from '../_shared/bttsIntel.ts'
import { buildCorrectScoreIntel } from '../_shared/correctScoreIntel.ts'
import { buildOverUnderIntel } from '../_shared/overUnderIntel.ts'
import { isNoOddsAllowed, buildSyntheticBookmakers, fairOddsFromProb, NO_ODDS_CONF_BONUS } from '../_shared/noOddsSynth.ts'
import { enhanceSavedPicks } from '../_shared/enhanceSavedPicks.ts'


const CHUNK_SIZE = 25;
// Supabase severs an idle request at 150s. A chunk of 25 fixtures can exceed that
// when the API is slow, which killed the whole run with a 504. We therefore stop
// the chunk on a wall-clock budget and hand the remaining fixtures to the next
// self-invocation, so a chunk is bounded by TIME, not only by fixture count.
// Wall-clock guard lives in _shared/chunkBudget.ts and is mandatory for every engine.

// Per-engine admin toggle for the 1.85 odds filter (default ON = 1.85, OFF = 0)
let MIN_ODDS = 1.85;

// Per-call timeout wrapper to prevent a single hanging api-football request from freezing the engine
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  return await Promise.race<T | null>([
    p.then((v) => v as T | null).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => { console.warn(`[Unified] timeout ${ms}ms on ${label}`); resolve(null); }, ms)),
  ]);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const FOOTBALL_API_KEY = Deno.env.get('FOOTBALL_API_KEY')!;
const FOOTBALL_API_BASE = 'https://v3.football.api-sports.io';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PRIORITY_LEAGUES = new Set([
  39, 140, 135, 78, 61, 2, 3, 848, 88, 94, 40, 253, 71, 262, 307, 203,
  144, 207, 218, 79, 141, 136, 62, 41, 42, 179, 113, 128, 169, 292, 188, 103, 106,
]);

interface CalibrationParams {
  drawEvThreshold: number;
  drawBlendMin: number;
  drawConfMin: number;
  winEvThreshold: number;
  winBlendMin: number;
  winConfMin: number;
  kellyMinimum: number;
  rho: number;
}

const DEFAULT_PARAMS: CalibrationParams = {
  drawEvThreshold: 6,
  drawBlendMin: 0.30,
  drawConfMin: 33,
  winEvThreshold: 4,
  winBlendMin: 0.50,
  winConfMin: 56,
  kellyMinimum: 0.02,
  rho: -0.13,
};

// ─── Rate Limiter ───
const API_RATE_LIMIT = 150;
const RATE_WINDOW_MS = 60_000;
const SAFETY_BUFFER = 15;
const requestTimestamps: number[] = [];

async function rateLimitedDelay() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > RATE_WINDOW_MS) requestTimestamps.shift();
  const used = requestTimestamps.length;
  const remaining = API_RATE_LIMIT - SAFETY_BUFFER - used;
  if (remaining <= 0) {
    const waitMs = RATE_WINDOW_MS - (now - requestTimestamps[0]) + 200;
    await new Promise(r => setTimeout(r, Math.max(waitMs, 500)));
    const afterWait = Date.now();
    while (requestTimestamps.length > 0 && afterWait - requestTimestamps[0] > RATE_WINDOW_MS) requestTimestamps.shift();
  } else if (remaining < 30) {
    await new Promise(r => setTimeout(r, 500 + (1 - remaining / 30) * 1000));
  } else if (remaining < 60) {
    await new Promise(r => setTimeout(r, 400));
  } else {
    await new Promise(r => setTimeout(r, 200));
  }
}

async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, label = ''): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await fn(); } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error('Unreachable');
}

async function footballApi(endpoint: string, params: Record<string, string>) {
  await rateLimitedDelay();
  return fetchWithRetry(async () => {
    const url = new URL(endpoint, FOOTBALL_API_BASE);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    const res = await fetch(url.toString(), { headers: { 'x-apisports-key': FOOTBALL_API_KEY } });
    requestTimestamps.push(Date.now());
    if (res.status === 429) { await new Promise(r => setTimeout(r, 30_000)); throw new Error('429'); }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  }, 3, `footballApi(${endpoint})`);
}

// ═══════════════════════════════════════════════════════
// MATHEMATICAL MODELS — now shared with every other engine
// ../_shared/matchModel.ts holds the single probability core (lifted verbatim
// from V7.1). This file previously carried a duplicate copy that had already
// begun to drift from V7.1's version.
// ═══════════════════════════════════════════════════════
import {
  poissonPmf,
  dixonColesTau,
  removeVigShin,
  applyFLBCorrection,
  h2hEloDelta,
  bivariatePoissonDraw,
  negativeBinomialWinProb,
  orderedLogitProbs,
  formMomentum,
  trailingDrawStreak,
  h2hTrailingDrawStreak,
  getHomeAwayDrawRate,
  motivationFactor,
  getLeagueTierHomeAdvantage,
  kellyFraction,
  kellyDifficultyTier as kellyTier,
} from '../_shared/matchModel.ts'
import { createChunkBudget } from '../_shared/chunkBudget.ts';


interface SkipReason { fixture: string; reason: string; details?: string; }

// ═══════════════════════════════════════════════════════
// UNIFIED ANALYSIS: TRUE 10-MODEL ENSEMBLE
// ═══════════════════════════════════════════════════════
function analyzeMatchUnified(
  fixture: any,
  odds: { home: number; draw: number; away: number },
  standings: any[],
  h2h: any[],
  homeRecentMatches: any[],
  awayRecentMatches: any[],
  skipReasons: SkipReason[],
  apiPrediction: any | null,
  params: CalibrationParams,
  homeGKOut: boolean,
  awayGKOut: boolean,
  auditRows?: any[],
  freemiumRows?: any[]
): { type: string; confidence: number; reasoning: string[]; expectedValue: number; odds: number; kelly: number; qualityInputs?: any; reliabilityRS?: number } | null {
  
  const homeTeam = fixture.teams.home;
  const awayTeam = fixture.teams.away;
  const matchLabel = `${homeTeam.name} vs ${awayTeam.name}`;
  
  let homeStanding = standings?.find((s: any) => s.team?.id === homeTeam.id);
  let awayStanding = standings?.find((s: any) => s.team?.id === awayTeam.id);
  let usedFallback = false;
  if (!homeStanding || !awayStanding) {
    usedFallback = true;
    const mid = Math.ceil((standings?.length || 20) / 2);
    if (!homeStanding) homeStanding = { rank: mid, all: { played: 15, goals: { for: 18, against: 18 }, win: 5, draw: 5, lose: 5 }, form: 'WDLWD' };
    if (!awayStanding) awayStanding = { rank: mid, all: { played: 15, goals: { for: 16, against: 19 }, win: 4, draw: 5, lose: 6 }, form: 'LDWDL' };
  }
  
  const homePos = homeStanding.rank || 10;
  const awayPos = awayStanding.rank || 10;
  const homeGames = homeStanding.all?.played || 1;
  const awayGames = awayStanding.all?.played || 1;
  const homeGoalsPG = (homeStanding.all?.goals?.for || 0) / homeGames;
  const awayGoalsPG = (awayStanding.all?.goals?.for || 0) / awayGames;
  const homeConcPG = (homeStanding.all?.goals?.against || 0) / homeGames;
  const awayConcPG = (awayStanding.all?.goals?.against || 0) / awayGames;
  const leagueAvg = Math.max(1, (homeGoalsPG + awayGoalsPG + homeConcPG + awayConcPG) / 4);
  
  // Karlis & Ntzoufras (2011): outlier down-weighting
  const homeGD = Math.abs((homeStanding.all?.goals?.for || 0) - (homeStanding.all?.goals?.against || 0)) / homeGames;
  const awayGD = Math.abs((awayStanding.all?.goals?.for || 0) - (awayStanding.all?.goals?.against || 0)) / awayGames;
  const homeOutlierDampen = homeGD > 3 ? 0.85 : 1.0;
  const awayOutlierDampen = awayGD > 3 ? 0.85 : 1.0;
  
  const homeAttack = (homeGoalsPG / leagueAvg) * homeOutlierDampen;
  const homeDefense = homeConcPG / leagueAvg;
  const awayAttack = (awayGoalsPG / leagueAvg) * awayOutlierDampen;
  const awayDefense = awayConcPG / leagueAvg;
  const homeAdv = getLeagueTierHomeAdvantage(fixture.league?.id || 0);
  let expHome = homeAttack * awayDefense * leagueAvg * homeAdv;
  let expAway = awayAttack * homeDefense * leagueAvg;
  
  // ─── Model 10: Goalkeeper Impact (probability-layer only) ───
  // NOTE: previously also applied as expHome/expAway xG multiplier (×1.08),
  // which double-counted the same GK signal once via Poisson/DC and again via
  // gkHomeAdj/gkAwayAdj below. xG-multiplier path removed; GK now affects
  // probabilities at exactly one point in the pipeline.
  const gkReasoning: string[] = [];
  if (homeGKOut) gkReasoning.push(`${homeTeam.name} GK out → opponent edge`);
  if (awayGKOut) gkReasoning.push(`${awayTeam.name} GK out → opponent edge`);

  // ─── Model 1: Dixon-Coles corrected Poisson ───
  const leagueId = fixture.league?.id || 0;
  const bpRho = getLeagueBpRho(leagueId, params.rho);
  const nbR = getLeagueNbR(leagueId, 5);
  let dcDraw = 0, dcHome = 0, dcAway = 0;
  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      let p = poissonPmf(h, expHome) * poissonPmf(a, expAway) * dixonColesTauExtended(h, a, expHome, expAway, params.rho);
      p = Math.max(0, p);
      if (h === a) dcDraw += p; else if (h > a) dcHome += p; else dcAway += p;
    }
  }
  const dcT = dcDraw + dcHome + dcAway;
  if (dcT > 0) { dcDraw /= dcT; dcHome /= dcT; dcAway /= dcT; }
  
  // ─── Model 2: Shin's market probabilities (FLB-corrected) ───
  const marketRaw = removeVigShin(odds.home, odds.draw, odds.away);
  const market = applyFLBCorrection(marketRaw, odds);
  
  // ─── Model 3: H2H Elo (BORS-adjusted) ───
  const eloDelta = h2hEloDelta(h2h, homeTeam.id);
  const eloHomeAdv = 1 / (1 + Math.pow(10, -eloDelta / 400));
  const eloFavorsHome = eloDelta > 0;
  const marketFavorsHome = market.home > market.away;
  const eloMarketAlign = (eloFavorsHome && marketFavorsHome) || (!eloFavorsHome && !marketFavorsHome);
  
  // ─── Model 4: Bivariate Poisson (per-league correlation) ───
  const bpDrawProb = bivariatePoissonDraw(expHome, expAway, bpRho);
  
  // ─── Model 5: Negative Binomial (per-league dispersion) ───
  const nbHomeWin = negativeBinomialWinProb(expHome, expAway, nbR);
  const nbAwayWin = negativeBinomialWinProb(expAway, expHome, nbR);
  
  // ─── Model 6: Ordered Logit ───
  const homeStrength = (homeStanding.all?.win || 0) / homeGames * 100;
  const awayStrength = (awayStanding.all?.win || 0) / awayGames * 100;
  const posGap = homePos - awayPos;
  const olProbs = orderedLogitProbs(homeStrength, awayStrength, posGap);
  
  // ─── Model 7: Form Momentum (Constantinou threshold) ───
  const homeForm = homeStanding.form || '';
  const awayForm = awayStanding.form || '';
  const homeMomentum = formMomentum(homeForm);
  const awayMomentum = formMomentum(awayForm);
  const momentumAdj = (homeMomentum - awayMomentum) * 0.05;
  
  // ─── Model 8: Position-based table edge ───
  const totalTeamsInLeague = standings.length || 20;
  const homePercentile = homePos / totalTeamsInLeague;
  const awayPercentile = awayPos / totalTeamsInLeague;
  let tableEdgeHome = 0, tableEdgeAway = 0;
  if (homePercentile < 0.25 && awayPercentile > 0.5) tableEdgeHome = 0.08;
  else if (homePercentile < 0.25 && awayPercentile > 0.75) tableEdgeHome = 0.12;
  if (awayPercentile < 0.25 && homePercentile > 0.5) tableEdgeAway = 0.06;
  else if (awayPercentile < 0.25 && homePercentile > 0.75) tableEdgeAway = 0.10;
  
  // ─── Model 9: API-Football predictions ───
  let apiH = 0, apiD = 0, apiA = 0, hasApi = false;
  if (apiPrediction?.predictions?.percent) {
    const p = apiPrediction.predictions.percent;
    apiH = parseFloat(p.home || '0') / 100;
    apiD = parseFloat(p.draw || '0') / 100;
    apiA = parseFloat(p.away || '0') / 100;
    if (apiH + apiD + apiA > 0) hasApi = true;
  }
  
  // ─── Recent form analysis from fetched matches (from Auto Generate) ───
  let homeRecentWins = 0, homeRecentDraws = 0;
  for (const m of homeRecentMatches.slice(0, 5)) {
    const hg = m.goals?.home; const ag = m.goals?.away;
    if (typeof hg !== 'number' || typeof ag !== 'number') continue;
    const isHome = m.teams?.home?.id === homeTeam.id;
    const tg = isHome ? hg : ag; const og = isHome ? ag : hg;
    if (tg > og) homeRecentWins++;
    if (tg === og) homeRecentDraws++;
  }
  let awayRecentWins = 0, awayRecentDraws = 0;
  for (const m of awayRecentMatches.slice(0, 5)) {
    const hg = m.goals?.home; const ag = m.goals?.away;
    if (typeof hg !== 'number' || typeof ag !== 'number') continue;
    const isHome = m.teams?.home?.id === awayTeam.id;
    const tg = isHome ? hg : ag; const og = isHome ? ag : hg;
    if (tg > og) awayRecentWins++;
    if (tg === og) awayRecentDraws++;
  }
  
  // ─── H2H Draw Rate Analysis (from Auto Generate) ───
  const h2hDraws = h2h.filter((m: any) => m.goals?.home === m.goals?.away).length;
  const h2hDrawRate = h2h.length > 0 ? h2hDraws / h2h.length : 0;
  const absPositionGap = Math.abs(homePos - awayPos);
  
  // ─── Opponent-strength down-weighting (Penn & Donnelly) ───
  let adjustedHomeMomentum = homeMomentum;
  let adjustedAwayMomentum = awayMomentum;
  if (homePos <= Math.ceil(totalTeamsInLeague / 2) && homeMomentum > 0.7) adjustedHomeMomentum *= 0.85;
  if (awayPos <= Math.ceil(totalTeamsInLeague / 2) && awayMomentum > 0.7) adjustedAwayMomentum *= 0.85;
  
  // ═══════════════════════════════════════════════════════
  // 10-MODEL ENSEMBLE BLEND (Plan-specified weights)
  // ═══════════════════════════════════════════════════════
  const DC_W = 0.22;       // Dixon-Coles Poisson
  const MKT_W = 0.20;      // Shin Market (FLB-corrected)
  const H2H_BASE_W = 0.10; // H2H Elo (BORS-adjusted)
  const BP_W = 0.08;       // Bivariate Poisson
  const NB_W = 0.06;       // Negative Binomial
  const OL_W = 0.08;       // Ordered Logit
  const FORM_W = 0.07;     // Form Momentum
  const TABLE_W = 0.06;    // Table Edge
  const API_W = hasApi ? 0.08 : 0; // API-Football
  const GK_W = 0.05;       // Goalkeeper Adjustment
  
  // BORS adjustment on H2H weight
  const H2H_W = H2H_BASE_W * (eloMarketAlign ? 1.3 : 0.7);
  
  // Form momentum is applied as a direct ±5% probability shift (matches Auto-Gen).
  // Previously double-scaled by FORM_W/totalW which collapsed it to ~±0.4%.
  const totalW = DC_W + MKT_W + H2H_W + BP_W + NB_W + OL_W + TABLE_W + API_W + GK_W;
  const momentumShift = (adjustedHomeMomentum - adjustedAwayMomentum) * FORM_W;
  
  // GK adjustment as probability modifier
  const gkHomeAdj = awayGKOut ? 0.04 : (homeGKOut ? -0.03 : 0);
  const gkAwayAdj = homeGKOut ? 0.04 : (awayGKOut ? -0.03 : 0);
  
  let blendHome = (
    dcHome * DC_W +
    market.home * MKT_W +
    eloHomeAdv * H2H_W +
    nbHomeWin * NB_W +
    olProbs.home * OL_W +
    tableEdgeHome * TABLE_W +
    (hasApi ? apiH * API_W : 0) +
    gkHomeAdj * GK_W
  ) / totalW + momentumShift;
  
  let blendDraw = (
    dcDraw * DC_W +
    market.draw * MKT_W +
    bpDrawProb * BP_W +
    olProbs.draw * OL_W +
    (hasApi ? apiD * API_W : 0)
  ) / totalW;
  
  let blendAway = (
    dcAway * DC_W +
    market.away * MKT_W +
    (1 - eloHomeAdv) * H2H_W +
    nbAwayWin * NB_W +
    olProbs.away * OL_W +
    tableEdgeAway * TABLE_W +
    (hasApi ? apiA * API_W : 0) +
    gkAwayAdj * GK_W
  ) / totalW - momentumShift;
  
  // Clamp + Normalize
  blendHome = Math.max(0.02, Math.min(0.95, blendHome));
  blendDraw = Math.max(0.02, Math.min(0.95, blendDraw));
  blendAway = Math.max(0.02, Math.min(0.95, blendAway));
  let bT = blendHome + blendDraw + blendAway;
  if (bT > 0) { blendHome /= bT; blendDraw /= bT; blendAway /= bT; }
  
  // ─── Draw underestimation correction (Na et al.) — BEFORE EV/Kelly ───
  const marketImpliedDraw = market.draw * 100;
  if (marketImpliedDraw < 25 && (dcDraw * 100) > 28) {
    blendDraw = Math.min(0.95, blendDraw + 0.03);
    bT = blendHome + blendDraw + blendAway;
    if (bT > 0) { blendHome /= bT; blendDraw /= bT; blendAway /= bT; }
  }
  
  // ─── H2H draw rate boost (from Auto Generate) ───
  if (h2hDrawRate > 0.4 && absPositionGap <= 5) {
    blendDraw = Math.min(0.95, blendDraw + 0.02);
    bT = blendHome + blendDraw + blendAway;
    if (bT > 0) { blendHome /= bT; blendDraw /= bT; blendAway /= bT; }
  }
  
  // ─── COD Overreaction Adjustment (Wheatcroft 2020) ───
  const homePctile = homePos / totalTeamsInLeague;
  const awayPctile = awayPos / totalTeamsInLeague;
  let codApplied = false;
  if (homePctile < 0.4 && homeMomentum < 0.3) { blendHome = Math.min(0.95, blendHome + 0.02); codApplied = true; }
  else if (homePctile > 0.6 && homeMomentum > 0.7) { blendHome = Math.max(0.05, blendHome - 0.02); codApplied = true; }
  if (awayPctile < 0.4 && awayMomentum < 0.3) { blendAway = Math.min(0.95, blendAway + 0.02); codApplied = true; }
  else if (awayPctile > 0.6 && awayMomentum > 0.7) { blendAway = Math.max(0.05, blendAway - 0.02); codApplied = true; }
  if (codApplied) {
    const codTotal = blendHome + blendDraw + blendAway;
    if (codTotal > 0) { blendHome /= codTotal; blendDraw /= codTotal; blendAway /= codTotal; }
  }
  
  // ─── PORTED RESEARCH BONUSES (MATCH_DRAW + super_advanced) ───
  const bonusReasons: string[] = [];
  const homeSplitDrawRate = getHomeAwayDrawRate(homeStanding, 'home');
  const awaySplitDrawRate = getHomeAwayDrawRate(awayStanding, 'away');
  const avgSplitDrawRate = (homeSplitDrawRate + awaySplitDrawRate) / 2;
  if (avgSplitDrawRate > 0.30) {
    blendDraw = Math.min(0.95, blendDraw + 0.01);
    bonusReasons.push(`Home/Away split draw rate: ${(avgSplitDrawRate * 100).toFixed(0)}% (+1%)`);
  }
  const homeDrawStreak = trailingDrawStreak(homeForm);
  const awayDrawStreak = trailingDrawStreak(awayForm);
  if (homeDrawStreak >= 2 || awayDrawStreak >= 2) {
    blendDraw = Math.min(0.95, blendDraw + 0.02);
    bonusReasons.push(`Trailing draw streak (H:${homeDrawStreak}/A:${awayDrawStreak}) (+2%)`);
  }
  const h2hDrawStreakRecent = h2hTrailingDrawStreak(h2h);
  if (h2hDrawStreakRecent >= 2) {
    blendDraw = Math.min(0.95, blendDraw + 0.02);
    bonusReasons.push(`Last ${h2hDrawStreakRecent} H2H were draws (+2%)`);
  }
  if (odds.home > 2.0 && odds.away > 2.0 && odds.draw > 3.0) {
    blendDraw = Math.min(0.95, blendDraw + 0.02);
    bonusReasons.push('Balanced odds — no clear favorite (+2% draw)');
  } else if (odds.home < 1.5 || odds.away < 1.5) {
    blendDraw = Math.max(0.02, blendDraw - 0.02);
    bonusReasons.push('Clear favorite present — draw penalty (-2%)');
  }
  const mot = motivationFactor(homePos, awayPos, totalTeamsInLeague);
  if (mot.home !== 0 || mot.away !== 0) {
    blendHome = Math.min(0.95, Math.max(0.02, blendHome + mot.home));
    blendAway = Math.min(0.95, Math.max(0.02, blendAway + mot.away));
    bonusReasons.push(`Motivation: home+${(mot.home * 100).toFixed(1)}% away+${(mot.away * 100).toFixed(1)}%`);
  }
  const bonusTotal = blendHome + blendDraw + blendAway;
  if (bonusTotal > 0) { blendHome /= bonusTotal; blendDraw /= bonusTotal; blendAway /= bonusTotal; }
  
  const drawEV = (blendDraw * odds.draw - 1) * 100;
  const homeEV = (blendHome * odds.home - 1) * 100;
  const awayEV = (blendAway * odds.away - 1) * 100;
  const kD = kellyFraction(blendDraw, odds.draw);
  const kH = kellyFraction(blendHome, odds.home);
  const kA = kellyFraction(blendAway, odds.away);
  
  const candidates: Array<{type: string; prob: number; ev: number; odds: number; confidence: number; reasoning: string[]; kelly: number}> = [];
  
  // ─── Draw candidate ───
  if (odds.draw >= MIN_ODDS && drawEV > params.drawEvThreshold && blendDraw > params.drawBlendMin && Math.round(blendDraw * 100) >= params.drawConfMin && kD >= params.kellyMinimum) {
    const r: string[] = [];
    r.push(`[Unified 10-model] DC draw: ${(dcDraw * 100).toFixed(1)}%`);
    r.push(`Bivariate Poisson draw: ${(bpDrawProb * 100).toFixed(1)}%`);
    r.push(`Ordered Logit draw: ${(olProbs.draw * 100).toFixed(1)}%`);
    r.push(`Market (Shin+FLB): ${(market.draw * 100).toFixed(1)}%`);
    r.push(`Ensemble (10 models): ${(blendDraw * 100).toFixed(1)}%`);
    if (h2hDrawRate > 0.3) r.push(`H2H draw rate: ${(h2hDrawRate * 100).toFixed(0)}%`);
    if (Math.abs(eloDelta) < 50) r.push(`H2H Elo balanced (Δ${eloDelta.toFixed(0)})`);
    if (absPositionGap <= 3) r.push(`Close positions: ${homePos} vs ${awayPos}`);
    if (hasApi) r.push(`API: H${(apiH*100).toFixed(0)}% D${(apiD*100).toFixed(0)}% A${(apiA*100).toFixed(0)}%`);
    r.push(`Kelly: ${(kD * 100).toFixed(1)}% [${kellyTier(kD)}]`);
    r.push(`Quarter-Kelly: ${(kD * 0.25 * 100).toFixed(2)}% of bankroll`);
    if (codApplied) r.push('COD overreaction applied');
    if (gkReasoning.length > 0) r.push(...gkReasoning);
    if (bonusReasons.length > 0) r.push(...bonusReasons);
    r.push(`EV: ${drawEV.toFixed(1)}%`);
    let conf = Math.round(blendDraw * 100);
    if (kD > 0.10) conf = Math.min(95, conf + 3);
    candidates.push({ type: 'draw', prob: blendDraw, ev: drawEV, odds: odds.draw, confidence: conf, reasoning: r, kelly: kD });
  }
  
  // ─── Home win candidate ───
  if (odds.home >= MIN_ODDS && homeEV > params.winEvThreshold && blendHome > params.winBlendMin && Math.round(blendHome * 100) >= params.winConfMin && kH >= params.kellyMinimum) {
    const r: string[] = [];
    r.push(`[Unified 10-model] DC home: ${(dcHome * 100).toFixed(1)}%`);
    r.push(`NB home: ${(nbHomeWin * 100).toFixed(1)}%`);
    r.push(`Ordered Logit home: ${(olProbs.home * 100).toFixed(1)}%`);
    r.push(`Market (Shin+FLB): ${(market.home * 100).toFixed(1)}%`);
    r.push(`Ensemble (10 models): ${(blendHome * 100).toFixed(1)}%`);
    r.push(`Expected goals: ${expHome.toFixed(2)} - ${expAway.toFixed(2)}`);
    if (homePos < awayPos) r.push(`Position: ${homePos} vs ${awayPos}`);
    if (eloDelta > 30) r.push(`H2H Elo: +${eloDelta.toFixed(0)}`);
    if (tableEdgeHome > 0) r.push(`Table edge: +${(tableEdgeHome * 100).toFixed(0)}%`);
    if (homeRecentWins >= 3) r.push(`Recent form: ${homeRecentWins}W in last 5`);
    if (hasApi) r.push(`API: H${(apiH*100).toFixed(0)}%`);
    r.push(`Kelly: ${(kH * 100).toFixed(1)}% [${kellyTier(kH)}]`);
    r.push(`Quarter-Kelly: ${(kH * 0.25 * 100).toFixed(2)}% of bankroll`);
    if (gkReasoning.length > 0) r.push(...gkReasoning);
    if (usedFallback) r.push('Standings estimated (fallback)');
    if (bonusReasons.length > 0) r.push(...bonusReasons);
    r.push(`EV: ${homeEV.toFixed(1)}%`);
    let conf = Math.round(blendHome * 100);
    if (kH > 0.10) conf = Math.min(95, conf + 3);
    candidates.push({ type: 'home_win', prob: blendHome, ev: homeEV, odds: odds.home, confidence: conf, reasoning: r, kelly: kH });
  }
  
  // ─── Away win candidate ───
  if (odds.away >= MIN_ODDS && awayEV > params.winEvThreshold && blendAway > params.winBlendMin && Math.round(blendAway * 100) >= params.winConfMin && kA >= params.kellyMinimum) {
    const r: string[] = [];
    r.push(`[Unified 10-model] DC away: ${(dcAway * 100).toFixed(1)}%`);
    r.push(`NB away: ${(nbAwayWin * 100).toFixed(1)}%`);
    r.push(`Ordered Logit away: ${(olProbs.away * 100).toFixed(1)}%`);
    r.push(`Market (Shin+FLB): ${(market.away * 100).toFixed(1)}%`);
    r.push(`Ensemble (10 models): ${(blendAway * 100).toFixed(1)}%`);
    r.push(`Expected goals: ${expHome.toFixed(2)} - ${expAway.toFixed(2)}`);
    if (awayPos < homePos) r.push(`Position: ${awayPos} vs ${homePos}`);
    if (eloDelta < -30) r.push(`H2H Elo: ${eloDelta.toFixed(0)}`);
    if (tableEdgeAway > 0) r.push(`Table edge: +${(tableEdgeAway * 100).toFixed(0)}%`);
    if (awayRecentWins >= 3) r.push(`Recent form: ${awayRecentWins}W in last 5`);
    if (hasApi) r.push(`API: A${(apiA*100).toFixed(0)}%`);
    r.push(`Kelly: ${(kA * 100).toFixed(1)}% [${kellyTier(kA)}]`);
    r.push(`Quarter-Kelly: ${(kA * 0.25 * 100).toFixed(2)}% of bankroll`);
    if (gkReasoning.length > 0) r.push(...gkReasoning);
    if (usedFallback) r.push('Standings estimated (fallback)');
    if (bonusReasons.length > 0) r.push(...bonusReasons);
    r.push(`EV: ${awayEV.toFixed(1)}%`);
    let conf = Math.round(blendAway * 100);
    if (kA > 0.10) conf = Math.min(95, conf + 3);
    candidates.push({ type: 'away_win', prob: blendAway, ev: awayEV, odds: odds.away, confidence: conf, reasoning: r, kelly: kA });
  }
  
  if (candidates.length === 0) {
    skipReasons.push({ fixture: matchLabel, reason: 'threshold_not_met',
      details: `draw(${Math.round(blendDraw*100)},EV=${drawEV.toFixed(1)}) home(${Math.round(blendHome*100)},EV=${homeEV.toFixed(1)}) away(${Math.round(blendAway*100)},EV=${awayEV.toFixed(1)})` });
    return null;
  }
  
  candidates.sort((a, b) => {
    const aS = a.kelly > 0.10 ? 1 : 0;
    const bS = b.kelly > 0.10 ? 1 : 0;
    if (aS !== bS) return bS - aS;
    return b.confidence - a.confidence;
  });
  
  const best = candidates[0];

  // ─── Early-Season Reliability Gate ───
  const gate = applyReliabilityGate(homeStanding, awayStanding, best.confidence, fixture.league?.name);
  const baseAudit = {
    engine: 'unified',
    fixture_id: fixture.fixture?.id ?? null,
    fixture_label: matchLabel,
    league_name: fixture.league?.name ?? null,
    match_date: fixture.fixture?.date ?? null,
    rs: gate.rs,
    verdict: gate.verdict,
    original_confidence: best.confidence,
    capped_confidence: gate.cappedConfidence,
    components: gate.components,
  };
  if (gate.exclude) {
    auditRows?.push({ ...baseAudit, included: false, skip_reason: gate.reason ?? 'reliability_excluded' });
    skipReasons.push({ fixture: matchLabel, reason: 'early_season_unreliable', details: gate.reason });
    // Route reliability-excluded picks (not data-quality issues) to freemium tier
    try {
      const bestOdds = best.type === 'draw' ? odds.draw : best.type === 'home_win' ? odds.home : odds.away;
      freemiumRows?.push({
        fixture_id: fixture.fixture?.id,
        home_team: fixture.teams.home.name,
        away_team: fixture.teams.away.name,
        home_logo: fixture.teams.home.logo,
        away_logo: fixture.teams.away.logo,
        league_name: fixture.league?.name,
        league_logo: fixture.league?.logo,
        match_date: fixture.fixture?.date,
        prediction_type: best.type,
        confidence: Math.min(best.confidence, gate.cappedConfidence ?? best.confidence),
        odds: odds,
        expected_value: best.ev,
        reasoning: best.reasoning,
        source_engine: 'unified',
        status: 'scheduled',
      });
    } catch (_) {}
    return null;
  }
  auditRows?.push({ ...baseAudit, included: true, skip_reason: null });
  const finalReasoning = [`Reliability ${gate.rs}/100 (${gate.verdict})`, ...best.reasoning];

  let qualityInputs: any = null;
  try {
    qualityInputs = buildQualityInputs({
      predictionType: best.type as any,
      homeStanding,
      awayStanding,
      homeId: fixture.teams.home.id,
      awayId: fixture.teams.away.id,
      homeRecentMatches: homeRecentMatches || [],
      awayRecentMatches: awayRecentMatches || [],
      h2h: h2h || [],
      reliabilityScore: gate.rs,
      leagueName: fixture.league?.name,
    });
  } catch (_) {}

  return { type: best.type, confidence: gate.cappedConfidence, reasoning: finalReasoning, expectedValue: parseFloat(best.ev.toFixed(2)), odds: best.odds, kelly: best.kelly, qualityInputs, reliabilityRS: gate.rs };
}

// ─── Helpers ───
function mergeReasonCounts(existing: Record<string, number>, incoming: Record<string, number>): Record<string, number> {
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) merged[k] = (merged[k] || 0) + v;
  return merged;
}

async function alertAdmin(supabase: any, adminId: string, title: string, message: string) {
  try { await supabase.from('notifications').insert({ user_id: adminId, title, message, type: 'system_alert', is_read: false }); } catch (_) {}
}

function selfInvoke(date: string, offset: number, runId: string) {
  const url = `${SUPABASE_URL}/functions/v1/unified-generate-predictions`;
  const body = JSON.stringify({ date, offset, runId });
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
  const fire = (attempt: number): Promise<void> =>
    fetch(url, { method: 'POST', headers, body })
      .then(async r => { try { await r.text(); } catch (_) {} })
      .catch(e => {
        console.error(`[Unified] Self-invoke attempt ${attempt} error: ${e}`);
        if (attempt === 1) return new Promise<void>((r) => setTimeout(() => fire(2).then(r), 1500));
      });
  try {
    // @ts-ignore
    if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any)?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(fire(1));
      return;
    }
  } catch (_) {}
  fire(1);
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let adminId: string | null = null;
  let runId: string | null = null;
  let offset = 0;

  try {
    let requestDate: string | null = null;
    let existingRunId: string | null = null;
    try {
      const body = await req.json();
      if (body?.date) requestDate = body.date;
      if (body?.targetDate) requestDate = body.targetDate;
      if (body?.runDate) requestDate = body.runDate;
      if (typeof body?.offset === 'number') offset = body.offset;
      if (body?.runId) existingRunId = body.runId;
    } catch (_) {}

    const isFirstChunk = offset === 0 && !existingRunId;

    if (isFirstChunk) {
      const { data: flag } = await supabase.from('feature_flags').select('enabled').eq('key', 'engine_unified').maybeSingle();
      if (!flag?.enabled) {
        return new Response(JSON.stringify({ success: false, message: 'Unified engine is disabled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Per-engine 1.57 odds-filter toggle (defaults ON)
    {
      const { data: oddsFlag } = await supabase
        .from('feature_flags').select('enabled').eq('key', 'odds_filter_unified').maybeSingle();
      MIN_ODDS = (oddsFlag?.enabled ?? true) ? 1.85 : 0;
      console.log(`[Unified] Odds filter: ${MIN_ODDS > 0 ? `ON (>=${MIN_ODDS})` : 'OFF'}`);
    }

    const buildEatDateStr = (offsetDays: number) => {
      const eat = new Date(Date.now() + 3 * 60 * 60 * 1000);
      eat.setUTCDate(eat.getUTCDate() + offsetDays);
      const y = eat.getUTCFullYear();
      const m = String(eat.getUTCMonth() + 1).padStart(2, '0');
      const d = String(eat.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    let dateStr: string;
    if (requestDate === 'today') dateStr = buildEatDateStr(0);
    else if (requestDate === 'tomorrow') dateStr = buildEatDateStr(1);
    else if (requestDate && /^\d{4}-\d{2}-\d{2}$/.test(requestDate)) dateStr = requestDate;
    else dateStr = buildEatDateStr(1);

    console.log(`[Unified] ${isFirstChunk ? 'Starting' : 'Continuing'} for ${dateStr}, offset=${offset}`);

    const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
    adminId = adminRoles?.[0]?.user_id;
    if (!adminId) throw new Error('No admin user found');

    // Calibration disabled — using locked baseline params (April 29 baseline that was saving picks).
    // The May 1 calibration drove predictions_saved to 0 for 4 days. To re-enable, restore the
    // unified_calibration_log lookup block from git history.
    const params = { ...DEFAULT_PARAMS };
    console.log(`[Unified] Calibration disabled. Using locked baseline params (April-29 baseline).`);

    if (isFirstChunk) {
      try {
        const { data: r } = await supabase.from('prediction_engine_runs')
          .insert({ engine: 'unified', run_date: dateStr, status: 'running', total_fixtures: 0 })
          .select('id').single();
        runId = r?.id || null;
      } catch (_) {}
    } else {
      runId = existingRunId;
    }

    const fixturesData = await footballApi('/fixtures', { date: dateStr });
    const fixtures = fixturesData?.response || [];

    if (fixtures.length === 0) {
      if (runId) await supabase.from('prediction_engine_runs').update({ status: 'completed', completed_at: new Date().toISOString(), total_fixtures: 0 }).eq('id', runId);
      return new Response(JSON.stringify({ success: true, message: 'No fixtures', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sortedFixtures = [...fixtures].sort((a: any, b: any) => {
      const ap = PRIORITY_LEAGUES.has(a.league.id) ? 0 : 1;
      const bp = PRIORITY_LEAGUES.has(b.league.id) ? 0 : 1;
      return ap !== bp ? ap - bp : (a.fixture.id || 0) - (b.fixture.id || 0);
    });

    const totalFixtures = sortedFixtures.length;
    if (isFirstChunk && runId) {
      await supabase.from('prediction_engine_runs').update({ total_fixtures: totalFixtures }).eq('id', runId);
    }

    let chunkEnd = Math.min(offset + CHUNK_SIZE, totalFixtures);
    const chunkFixtures = sortedFixtures.slice(offset, chunkEnd);
    let isLastChunk = chunkEnd >= totalFixtures;
    const budget = createChunkBudget('Unified');

    const { data: defaults } = await supabase.from('prediction_assignment_defaults').select('user_id').eq('admin_id', adminId);
    const assignedUserIds = (defaults || []).map((d: any) => d.user_id);

    let savedCount = 0, processedCount = 0;
    const errors: string[] = [];
    const skipReasons: SkipReason[] = [];
    const allowNoOdds = await isNoOddsAllowed(supabase as any);
    const auditRows: any[] = [];
    const freemiumRows: any[] = [];
    const enhanceMeta: Array<{ fixtureId: number; homeTeamId: number; awayTeamId: number; leagueId: number; season: number }> = [];

    const isCancelled = async (): Promise<boolean> => {
      if (!runId) return false;
      const { data } = await supabase.from('prediction_engine_runs').select('cancel_requested').eq('id', runId).maybeSingle();
      return data?.cancel_requested === true;
    };

    if (await isCancelled()) {
      if (runId) await supabase.from('prediction_engine_runs').update({ status: 'cancelled', completed_at: new Date().toISOString(), errors: ['Cancelled by admin'] }).eq('id', runId);
      return new Response(JSON.stringify({ success: true, cancelled: true, runId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    for (const fixture of chunkFixtures) {
      if (budget.exceeded()) break;
      budget.consume();
      try {
        const fixtureId = fixture.fixture.id;
        const leagueId = fixture.league.id;
        const season = fixture.league.season;
        const matchLabel = `${fixture.teams.home.name} vs ${fixture.teams.away.name}`;
        processedCount++;

        const { data: existing } = await supabase.from('saved_matches')
          .select('id').eq('fixture_id', fixtureId).eq('source_engine', 'unified').eq('user_id', adminId).maybeSingle();
        if (existing) { skipReasons.push({ fixture: matchLabel, reason: 'already_saved' }); continue; }

        // Fetch odds with multi-bookmaker fallback
        const oddsResult = await fetchOddsWithFallback(
          footballApi,
          supabase,
          fixtureId,
          fixture.fixture?.status,
          fixture.fixture?.date || null,
        );
        let bookmakers = oddsResult.bookmakers;
        let isNoOddsFixture = false;
        if (bookmakers.length === 0) {
          if (!allowNoOdds) { skipReasons.push({ fixture: matchLabel, reason: oddsResult.skipReason || 'no_odds' }); continue; }
          bookmakers = buildSyntheticBookmakers();
          isNoOddsFixture = true;
        } else if (oddsResult.source === 'bookmaker_fallback') {
          console.log(`[odds-fallback] ${matchLabel} recovered via bookmaker iteration (${oddsResult.bookmakersTried} tried)`);
        }

        let ho: number[] = [], dro: number[] = [], ao: number[] = [];
        for (const bm of bookmakers) {
          const mw = bm.bets?.find((b: any) => b.name === 'Match Winner');
          if (mw) {
            const vals = mw.values || [];
            const h = vals.find((v: any) => v.value === 'Home');
            const d = vals.find((v: any) => v.value === 'Draw');
            const a = vals.find((v: any) => v.value === 'Away');
            if (h) ho.push(parseFloat(h.odd));
            if (d) dro.push(parseFloat(d.odd));
            if (a) ao.push(parseFloat(a.odd));
          }
        }
        if (ho.length === 0) {
          if (!allowNoOdds) { skipReasons.push({ fixture: matchLabel, reason: 'no_match_winner_odds' }); continue; }
          ho = [2.7]; dro = [3.2]; ao = [2.8]; isNoOddsFixture = true;
        }

        const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
        const matchOdds = { home: parseFloat(avg(ho).toFixed(2)), draw: parseFloat(avg(dro).toFixed(2)), away: parseFloat(avg(ao).toFixed(2)) };

        if (!isNoOddsFixture && MIN_ODDS > 0 && matchOdds.home < MIN_ODDS && matchOdds.draw < MIN_ODDS && matchOdds.away < MIN_ODDS) {
          skipReasons.push({ fixture: matchLabel, reason: `all_odds_below_${MIN_ODDS}` }); continue;
        }

        // Fetch standings
        const standingsData = await footballApi('/standings', { league: String(leagueId), season: String(season) });
        const standings = standingsData?.response?.[0]?.league?.standings?.[0] || [];

        // Fetch H2H
        const h2hData = await footballApi('/fixtures/headtohead', { h2h: `${fixture.teams.home.id}-${fixture.teams.away.id}`, last: '10' });
        const h2h = h2hData?.response || [];

        // Fetch recent matches in parallel with timeouts (from V7.1 — now also in Unified)
        const [hRecRes, aRecRes] = await Promise.all([
          withTimeout(footballApi('/fixtures', { team: String(fixture.teams.home.id), season: String(season), last: '5' }), 6000, `home recent ${fixture.teams.home.id}`),
          withTimeout(footballApi('/fixtures', { team: String(fixture.teams.away.id), season: String(season), last: '5' }), 6000, `away recent ${fixture.teams.away.id}`),
        ]);
        const homeRecentMatches: any[] = (hRecRes as any)?.response || [];
        const awayRecentMatches: any[] = (aRecRes as any)?.response || [];

        // Fetch API predictions
        let apiPrediction = null;
        try {
          const pd = await footballApi('/predictions', { fixture: String(fixtureId) });
          apiPrediction = pd?.response?.[0] || null;
        } catch (_) {}

        // ─── Goalkeeper Impact Layer: fetch injuries ───
        let homeGKOut = false, awayGKOut = false;
        try {
          const injData = await footballApi('/injuries', { fixture: String(fixtureId) });
          const injuries = injData?.response || [];
          const gkInjuries = injuries.filter((inj: any) => {
            const pos = inj.player?.type || inj.player?.position || '';
            return pos.toLowerCase().includes('goalkeeper') || pos.toLowerCase() === 'g';
          });
          homeGKOut = gkInjuries.some((i: any) => i.team?.id === fixture.teams.home.id);
          awayGKOut = gkInjuries.some((i: any) => i.team?.id === fixture.teams.away.id);
          if (homeGKOut) console.log(`[Unified] GK OUT: ${fixture.teams.home.name}`);
          if (awayGKOut) console.log(`[Unified] GK OUT: ${fixture.teams.away.name}`);
        } catch (_) {}

        const prediction = analyzeMatchUnified(fixture, matchOdds, standings, h2h, homeRecentMatches, awayRecentMatches, skipReasons, apiPrediction, params, homeGKOut, awayGKOut, auditRows, freemiumRows);
        if (!prediction) continue;

        if (isNoOddsFixture && prediction.confidence < ((params.winConfMin ?? 60) + NO_ODDS_CONF_BONUS)) {
          skipReasons.push({ fixture: matchLabel, reason: 'no_odds_allowed_below_conf' });
          continue;
        }
        if (isNoOddsFixture) {
          const p = Math.max(0.01, Math.min(0.99, (prediction.confidence ?? 50) / 100));
          const fair = fairOddsFromProb(p);
          if (prediction.type === 'home_win') matchOdds.home = fair;
          else if (prediction.type === 'away_win') matchOdds.away = fair;
          else if (prediction.type === 'draw') matchOdds.draw = fair;
          (prediction as any).expectedValue = null;
        }

        // ─── Latest-Match Confirmation Layer (non-blocking admin marker) ───
        const lmConfirm = evaluateLatestMatchConfirmation(
          fixture.teams.home.id,
          fixture.teams.away.id,
          fixture.fixture.date,
          prediction.type as any,
          h2h,
        );
        if (lmConfirm.result === 'FAIL') {
          auditRows.push({
            engine: 'unified',
            fixture_id: fixtureId,
            fixture_label: matchLabel,
            league_name: fixture.league?.name ?? null,
            match_date: fixture.fixture?.date ?? null,
            included: true,
            verdict: 'H2H_REVIEW',
            skip_reason: 'latest_match_conflict_admin_review',
            components: { latestMatchConfirmation: lmConfirm },
          });
        }

        const getStakeMultiplier = (conf: number) => conf >= 90 ? 2.5 : conf >= 80 ? 2.0 : conf >= 70 ? 1.5 : conf >= 60 ? 1.0 : 0.5;
        const dynamicStake = 10000 * getStakeMultiplier(prediction.confidence);

        const bttsIntelPayload = buildBttsIntel({
          homeTeamId: fixture.teams.home.id,
          awayTeamId: fixture.teams.away.id,
          homeRecentMatches, awayRecentMatches, h2h,
          standings, matchOdds,
        });
        const bttsRec = bttsIntelPayload?.label === 'BTTS_LIKELY' ? 'yes'
          : bttsIntelPayload?.label === 'BTTS_LEAN' ? 'lean'
          : bttsIntelPayload?.label === 'BTTS_NO' ? 'no' : null;
        const correctScoreIntel = buildCorrectScoreIntel({
          predictionType: prediction.type,
          bttsRecommendation: bttsRec,
          bttsConfidence: bttsIntelPayload?.score ?? null,
          overUnder: null,
          homeTeamId: fixture.teams.home.id,
          awayTeamId: fixture.teams.away.id,
          homeRecentMatches, awayRecentMatches, h2h,
          standings, matchOdds,
        });
        const overUnderIntel = buildOverUnderIntel({
          homeTeamId: fixture.teams.home.id,
          awayTeamId: fixture.teams.away.id,
          homeRecentMatches, awayRecentMatches, h2h,
          standings, matchOdds,
        });

        const { applyRiskToSavedMatch } = await import('../_shared/riskMarketSelector.ts');
        const unifiedRecord = applyRiskToSavedMatch({
          fixture_id: fixtureId, home_team: fixture.teams.home.name, away_team: fixture.teams.away.name,
          home_logo: fixture.teams.home.logo, away_logo: fixture.teams.away.logo,
          league_name: fixture.league.name, league_logo: fixture.league.logo,
          league_country: fixture.league.country || null,
          match_date: fixture.fixture.date, prediction_type: prediction.type,
          confidence: prediction.confidence, odds: matchOdds, expected_value: prediction.expectedValue,
          reasoning: prediction.reasoning, user_id: adminId, is_admin_generated: true,
          status: 'scheduled', stake: dynamicStake, source_engine: 'unified',
          odds_source: isNoOddsFixture ? 'model_implied' : 'bookmaker',
          is_no_odds_pick: isNoOddsFixture,
          btts_intel: bttsIntelPayload,
          correct_score_intel: correctScoreIntel,
          over_under_intel: overUnderIntel,
          factors: {
            qualityInputs: prediction.qualityInputs || null,
            reliabilityRS: prediction.reliabilityRS || null,
            latestMatchConfirmation: lmConfirm,
            no_odds_fallback: isNoOddsFixture,
          },
        });
        const { data: savedMatch, error: saveError } = await supabase.from('saved_matches').insert(unifiedRecord).select('id').single();

        if (saveError) { errors.push(`Save: ${matchLabel}: ${saveError.message}`); continue; }
        enhanceMeta.push({
          fixtureId: Number(fixtureId),
          homeTeamId: Number(fixture.teams.home.id),
          awayTeamId: Number(fixture.teams.away.id),
          leagueId: Number(leagueId),
          season: Number(season),
        });

        if (savedMatch && assignedUserIds.length > 0) {
          await supabase.from('prediction_assignments').upsert(
            assignedUserIds.map((uid: string) => ({ prediction_id: savedMatch.id, user_id: uid, assigned_by: adminId })),
            { onConflict: 'prediction_id,user_id' }
          );
        }

        // Auto-upsert league
        try {
          const leagueSlug = fixture.league.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          const leagueData: Record<string, unknown> = {
            name: fixture.league.name, slug: leagueSlug, is_active: true, priority: 50,
            meta_title: `${fixture.league.name} Predictions & Tips | SmartMatchPick AI`,
            meta_description: `AI-powered football predictions for ${fixture.league.name}. Get accurate match analysis and betting tips.`,
          };
          if (fixture.league.country) leagueData.country = fixture.league.country;
          if (fixture.league.logo) leagueData.logo_url = fixture.league.logo;
          await supabase.from('leagues').upsert(leagueData, { onConflict: 'slug', ignoreDuplicates: false });
        } catch (_) {}

        savedCount++;
        console.log(`[Unified] SAVED: ${matchLabel} -> ${prediction.type} (conf=${prediction.confidence})`);
      } catch (err) {
        errors.push(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    if (budget.stopped) {
      chunkEnd = offset + budget.consumed;
      isLastChunk = chunkEnd >= totalFixtures;
    }

    try { await enhanceSavedPicks(supabase as any, { engine: 'unified', table: 'saved_matches', fixtureMeta: enhanceMeta }); }
    catch (e) { console.warn('[Unified] enhanceSavedPicks failed', (e as any)?.message); }

    const chunkReasonCounts: Record<string, number> = {};
    for (const sr of skipReasons) chunkReasonCounts[sr.reason] = (chunkReasonCounts[sr.reason] || 0) + 1;

    if (auditRows.length > 0) {
      try {
        const enriched = auditRows.map((r) => ({ ...r, run_id: runId || null }));
        await supabase.from('prediction_reliability_audit').insert(enriched);
      } catch (e) {
        console.warn('[Unified] audit insert failed', (e as any)?.message);
      }
    }

    if (freemiumRows.length > 0) {
      try {
        await supabase.from('freemium_picks').upsert(freemiumRows, { onConflict: 'fixture_id' });
        console.log(`[Unified] Freemium: upserted ${freemiumRows.length} picks`);
      } catch (e) {
        console.warn('[Unified] freemium upsert failed', (e as any)?.message);
      }
    }

    if (runId) {
      const { data: cur } = await supabase.from('prediction_engine_runs')
        .select('fixtures_processed, predictions_saved, skip_reasons, errors').eq('id', runId).maybeSingle();
      const update: any = {
        fixtures_processed: (cur?.fixtures_processed || 0) + processedCount,
        predictions_saved: (cur?.predictions_saved || 0) + savedCount,
        skip_reasons: mergeReasonCounts((cur?.skip_reasons as Record<string, number>) || {}, chunkReasonCounts),
        errors: [...((cur?.errors as string[]) || []), ...errors].slice(0, 50),
      };
      if (isLastChunk) { update.status = 'completed'; update.completed_at = new Date().toISOString(); }
      await supabase.from('prediction_engine_runs').update(update).eq('id', runId);
    }

    if (!isLastChunk && runId) {
      if (await isCancelled()) {
        await supabase.from('prediction_engine_runs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', runId);
        return new Response(JSON.stringify({ success: true, cancelled: true, runId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      selfInvoke(dateStr, chunkEnd, runId);
    }

    // ─── Two-Stage Quality Selection (replaces dumb prune-to-5) ───
    if (isLastChunk) {
      try {
        const nextDate = new Date(dateStr + 'T00:00:00Z');
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const nextDayISO = nextDate.toISOString().split('T')[0];
        const { data: allPreds } = await supabase.from('saved_matches')
          .select('id, confidence, expected_value, odds, prediction_type, factors')
          .eq('source_engine', 'unified')
          .eq('user_id', adminId)
          .gte('match_date', `${dateStr}T00:00:00Z`)
          .lt('match_date', `${nextDayISO}T00:00:00Z`);

        if (allPreds && allPreds.length > 0) {
          const candidates: QualityCandidate[] = allPreds.map((p: any) => ({
            id: p.id,
            confidence: p.confidence || 0,
            expectedValue: p.expected_value || 0,
            odds: p.odds || {},
            predictionType: p.prediction_type,
            inputs: p.factors?.qualityInputs || {},
          }));
          const result = selectTopQualityPicks(candidates);
          console.log(`[Unified] Quality selector: kept ${result.keep.length}/${candidates.length}`);
          if ((result.malformed?.length ?? 0) > 0) {
            console.warn(`[Unified] ${result.malformed!.length} malformed candidates`, result.malformed);
            try {
              await supabase.from('prediction_reliability_audit').insert(
                result.malformed!.map((m) => ({
                  engine: 'unified', run_id: runId, included: false,
                  verdict: 'malformed', skip_reason: m.issues.join(','),
                }))
              );
            } catch {}
          }

          // Trust the quality selector's verdict (incl. small-pool branch).
          // Zero keep means nothing cleared the bars; do not force picks.
          const keepIds = new Set(result.keep);
          const dropIds = result.drop;
          if (result.keep.length === 0 && candidates.length > 0) {
            console.warn(`[Unified] Selector returned 0 keep from ${candidates.length} candidates — no picks saved (quality bar not cleared)`);
            try {
              await supabase.from('prediction_reliability_audit').insert([{
                engine: 'unified', run_id: runId, included: false,
                verdict: 'selector_zero_keep', skip_reason: `quality_floors_not_cleared:${candidates.length}_candidates`,
              }]);
            } catch {}
          }

          if (dropIds.length > 0) {
            await supabase.from('prediction_assignments').delete().in('prediction_id', dropIds);
            await supabase.from('saved_matches').delete().in('id', dropIds);
          }
          if (runId) await supabase.from('prediction_engine_runs').update({ predictions_saved: keepIds.size }).eq('id', runId);
        }
      } catch (pruneErr) {
        console.warn('[Unified] Quality selector failed:', pruneErr);
      }

      let totalSaved = savedCount;
      if (runId) {
        const { data: finalRun } = await supabase.from('prediction_engine_runs').select('predictions_saved').eq('id', runId).maybeSingle();
        totalSaved = finalRun?.predictions_saved || savedCount;
      }
      console.log(`[Unified] COMPLETE: ${totalSaved} predictions for ${dateStr}`);
      if (totalSaved === 0 && totalFixtures > 5) {
        await alertAdmin(supabase, adminId, 'Unified Engine Warning', `Unified for ${dateStr} saved 0 predictions from ${totalFixtures} fixtures.`);
      }
    }

    return new Response(JSON.stringify({
      success: true, date: dateStr, engine: 'unified',
      chunk: { offset, end: chunkEnd, isLast: isLastChunk },
      totalFixtures, chunkProcessed: processedCount, chunkSaved: savedCount, runId: runId || undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    console.error('[Unified] CRITICAL:', msg);
    if (runId) {
      const s = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await s.from('prediction_engine_runs').update({ status: 'failed', completed_at: new Date().toISOString(), errors: [msg] }).eq('id', runId);
    }
    if (adminId) await alertAdmin(supabase, adminId, 'Unified Engine Failed', `Unified failed at offset ${offset}: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
