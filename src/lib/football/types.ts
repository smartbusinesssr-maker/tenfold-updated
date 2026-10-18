/** Playable binary: short favourites allowed, 1.10 locks and 8.00 dogs are not. */
import type { FamilySharpeRow, SharpeReport } from "./sharpe.ts";
export type { FamilySharpeRow, SharpeReport };

export const ODDS_BAND = { min: 1.25, max: 3.5 } as const;
export const ODDS_PLAYABLE = { min: 1.25, max: 3.5 } as const;
export const DRAW_ODDS_BAND = { min: 2.4, max: 5.0 } as const;
export const TEAM_ODDS_BAND = { min: 1.10, max: 2.2 } as const;
export const CS_ODDS_BAND = { min: 3, max: 21 } as const;
export const DAILY_FOLD_SIZE = 10;
export const TARGET_WIN_PICKS = 5;
export const TARGET_BTTS_PICKS = 3;
export const TARGET_OU_PICKS = 2;
export const TARGET_CS_PICKS = 0;
export const TARGET_DC_PICKS = 1;
export const TARGET_AH_PICKS = 1;
export const COMBO_ODDS_BAND = { min: 1.5, max: 5.0 } as const;
export const MULTI_GOALS_ODDS_BAND = { min: 1.25, max: 5.0 } as const;
export const PLAYER_ODDS_BAND = { min: 1.4, max: 5.0 } as const;
export const DEFAULT_TZ = "Africa/Kampala";
/** Bump on every engine or model change, and add a changelog row in ENGINE.md in the same edit. */
export const ENGINE_VERSION = "2026.09.28j";
export const FEATURE_SCHEMA = "v13";

export type MarketKind =
  | "home"
  | "away"
  | "draw"
  | "btts_yes"
  | "btts_no"
  | "over_05"
  | "under_05"
  | "over_15"
  | "under_15"
  | "over_25"
  | "under_25"
  | "over_35"
  | "under_35"
  | "over_45"
  | "under_45"
  | "cs"
  | "dc_1x"
  | "dc_x2"
  | "dc_12"
  | "home_score"
  | "away_score"
  | "ah"
  | "eh"
  | "ou_asian"
  | "corners"
  | "cards"
  | "player_ga"
  | "multi_goals"
  | "odd_even"
  | "combo";

export type MarketFamily =
  | "win"
  | "btts"
  | "ou"
  | "cs"
  | "draw"
  | "dc"
  | "ah"
  | "team"
  | "corners"
  | "cards"
  | "player"
  | "multi"
  | "parity"
  | "combo";

export type ModelName =
  | "dixonColes"
  | "shin"
  | "apiFootball"
  | "hvattumElo"
  | "baioH2h"
  | "maher"
  | "karlisNtzoufras"
  | "negBin";

export type ScanSource = "api-football" | "public-board";

export interface QuotaSnapshot {
  dayRemaining: number;
  dayLimit: number;
  minuteRemaining: number | null;
  minuteLimit: number | null;
  usedThisScan: number;
}

export interface RawFixture {
  fixtureId: number;
  date: string;
  kickoff: string;
  timestamp: number;
  timezone: string;
  status: string;
  leagueId: number;
  league: string;
  country: string;
  round: string;
  homeId: number;
  awayId: number;
  home: string;
  away: string;
  homeLogo: string | null;
  awayLogo: string | null;
  season: number | null;
}

export interface StandingRow {
  teamId: number;
  rank: number;
  points: number;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
  form: string | null;
  homePlayed?: number | null;
  homeGf?: number | null;
  homeGa?: number | null;
  awayPlayed?: number | null;
  awayGf?: number | null;
  awayGa?: number | null;
}

export interface Last5Goals {
  forAvg: number | null;
  againstAvg: number | null;
  form: string | null;
}

export interface H2HMatch {
  timestamp: number;
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
  finished: boolean;
}

export interface PredictionExtract {
  fixtureId: number;
  underOver: string | null;
  advice: string | null;
  winner: string | null;
  percentHome: number | null;
  percentDraw: number | null;
  percentAway: number | null;
  poissonShareHome: number | null;
  poissonShareAway: number | null;
  attHome: number | null;
  attAway: number | null;
  homeLast5: Last5Goals | null;
  awayLast5: Last5Goals | null;
  homeSeasonForHome: number | null;
  homeSeasonAgainstHome: number | null;
  awaySeasonForAway: number | null;
  awaySeasonAgainstAway: number | null;
  homeForm: string | null;
  awayForm: string | null;
  homePlayed: number | null;
  awayPlayed: number | null;
  h2h: H2HMatch[];
  homeRank: number | null;
  awayRank: number | null;
  homeGD: number | null;
  awayGD: number | null;
  homeVenueFor: number | null;
  homeVenueAgainst: number | null;
  awayVenueFor: number | null;
  awayVenueAgainst: number | null;
  homeStats: TeamSeasonStats | null;
  awayStats: TeamSeasonStats | null;
  homeFts: number | null;
  awayFts: number | null;
  homeCs: number | null;
  awayCs: number | null;
  homeAdjAttack: number | null;
  homeAdjDefense: number | null;
  awayAdjAttack: number | null;
  awayAdjDefense: number | null;
  homeOver15: number | null;
  awayOver15: number | null;
  homeOver15For: number | null;
  awayOver15For: number | null;
  homeEarlyShare: number | null;
  homeLateShare: number | null;
  awayEarlyShare: number | null;
  awayLateShare: number | null;
  homeMicroFor?: number | null;
  homeMicroAgainst?: number | null;
  awayMicroFor?: number | null;
  awayMicroAgainst?: number | null;
  homeBtts?: number | null;
  awayBtts?: number | null;
  homeLast5Over25?: number | null;
  awayLast5Over25?: number | null;
  lastNHome?: number;
  lastNAway?: number;
  leagueEnvHome?: number | null;
  leagueEnvAway?: number | null;
  homeScoringStreak?: number | null;
  awayScoringStreak?: number | null;
  homeFailedStreak?: number | null;
  awayFailedStreak?: number | null;
  homeCleanStreak?: number | null;
  awayCleanStreak?: number | null;
  homeAttack?: number | null;
  homeDefense?: number | null;
  awayAttack?: number | null;
  awayDefense?: number | null;
  homeMomGf?: number | null;
  awayMomGf?: number | null;
  homeRegress?: number | null;
  awayRegress?: number | null;
  homeAttackVar?: number | null;
  awayAttackVar?: number | null;
  homeDefenseVar?: number | null;
  awayDefenseVar?: number | null;
  injuriesKnown?: boolean;
  bttsCoverage?: number;
  winCoverage?: number;
  ouCoverage?: number;
  leagueSize?: number;
  coverageScore: number;
  quality: number;
  grade: DataGrade;
  homeSma5?: number | null;
  homeSma20?: number | null;
  homeEwma5?: number | null;
  homeEwma20?: number | null;
  homeEma20?: number | null;
  awaySma5?: number | null;
  awaySma20?: number | null;
  awayEwma5?: number | null;
  awayEwma20?: number | null;
  awayEma20?: number | null;
}

export interface BookLine {
  bookmakerId: number;
  bookmaker: string;
  odd: number;
}

export interface SideMarket {
  kind: MarketKind;
  selection: string;
  medianOdd: number | null;
  sharpOdd: number | null;
  sharpBook: string | null;
  shinImplied: number | null;
  inBand: boolean;
  books: BookLine[];
  reliable?: boolean;
  consensusOdd?: number | null;
  bookCount?: number;
  line?: number | null;
}

export interface FixtureMarkets {
  fixtureId: number;
  winner: Partial<Record<"home" | "draw" | "away", SideMarket>>;
  btts: Partial<Record<"yes" | "no", SideMarket>>;
  ou15: Partial<Record<"over" | "under", SideMarket>>;
  ou25: Partial<Record<"over" | "under", SideMarket>>;
  ou05?: Partial<Record<"over" | "under", SideMarket>>;
  ou35?: Partial<Record<"over" | "under", SideMarket>>;
  ou45?: Partial<Record<"over" | "under", SideMarket>>;
  doubleChance?: Partial<Record<"1x" | "x2" | "12", SideMarket>>;
  homeScore?: Partial<Record<"yes" | "no", SideMarket>>;
  awayScore?: Partial<Record<"yes" | "no", SideMarket>>;
  asianHandicap?: SideMarket[];
  europeanHandicap?: SideMarket[];
  ouAsian?: SideMarket[];
  corners?: SideMarket[];
  cards?: SideMarket[];
  playerGa?: SideMarket[];
  correctScores: SideMarket[];
  oddEven?: Partial<Record<"even" | "odd", SideMarket>>;
  multiGoals?: SideMarket[];
}

export interface InjuryCounts {
  home: number;
  away: number;
}

export interface ModelBreakdown {
  dixonColes: number;
  shin: number | null;
  apiFootball: number;
  hvattumElo: number;
  baioH2h: number;
  maher?: number;
  karlisNtzoufras?: number;
  negBin?: number;
}

export interface ScoreCell {
  home: number;
  away: number;
  p: number;
}

export type DataGrade = "FULL_DATA" | "PARTIAL_DATA" | "LOW_DATA" | "UNUSABLE";

export interface TeamSeasonStats {
  teamId: number;
  played: number;
  playedHome: number;
  playedAway: number;
  gfHome: number | null;
  gaHome: number | null;
  gfAway: number | null;
  gaAway: number | null;
  failedToScore: number | null;
  failedToScoreHome: number | null;
  failedToScoreAway: number | null;
  cleanSheet: number | null;
  cleanSheetHome: number | null;
  cleanSheetAway: number | null;
  form: string | null;
  over15: number | null;
  over25: number | null;
  over15For: number | null;
  over25For: number | null;
  earlyShare: number | null;
  lateShare: number | null;
  cardsPerMatch?: number | null;
  cornersPerMatch?: number | null;
  cornersAgainstPerMatch?: number | null;
  cornersForHome?: number | null;
  cornersForAway?: number | null;
  cornersAgainstHome?: number | null;
  cornersAgainstAway?: number | null;
  cornersVmr?: number | null;
}

export interface FinishedSample {
  timestamp: number;
  opponentId: number;
  gf: number;
  ga: number;
  home: boolean;
  leagueId?: number;
  fixtureId?: number;
}

export interface InjuryImpact {
  attack: number;
  defense: number;
  keeper: number;
}

export interface LineupPlayer {
  id: number;
  name: string;
  pos: string | null;
  number: number | null;
}

export interface PlayerSeasonStats {
  id: number;
  name: string;
  teamId: number;
  minutes: number | null;
  appearances: number | null;
  starts: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  sot: number | null;
  keyPasses: number | null;
  position: string | null;
  penaltyGoals?: number | null;
}

export interface LineupImpact {
  attack: number;
  defense: number;
  keeper: number;
  formation: string | null;
  confirmed: boolean;
  starters: number;
  players?: LineupPlayer[];
}

export interface LeagueCoverage {
  leagueId: number;
  standings: boolean;
  injuries: boolean;
  predictions: boolean;
  odds: boolean;
  lineups: boolean;
  events: boolean;
  fixtureStats: boolean;
  playerStats: boolean;
  score: number;
}

export interface MatchFacts {
  homeRank: number | null;
  awayRank: number | null;
  homeForm: string | null;
  awayForm: string | null;
  homeGf: number | null;
  homeGa: number | null;
  awayGf: number | null;
  awayGa: number | null;
  homeOver15: number | null;
  awayOver15: number | null;
  h2hWins: number;
  h2hDraws: number;
  h2hLosses: number;
  h2hN: number;
  histWeight: number;
  quality: number;
  grade: DataGrade;
  coverageScore: number;
  lineupConfirmed: boolean;
  homeFts?: number | null;
  awayFts?: number | null;
  injuriesKnown?: boolean;
  homePlayed?: number | null;
  awayPlayed?: number | null;
  lastNHome?: number;
  lastNAway?: number;
  homeSma5?: number | null;
  homeSma20?: number | null;
  homeEwma5?: number | null;
  homeEwma20?: number | null;
  homeEma20?: number | null;
  awaySma5?: number | null;
  awaySma20?: number | null;
  awayEwma5?: number | null;
  awayEwma20?: number | null;
  awayEma20?: number | null;
}

export interface ComboLeg {
  kind: MarketKind;
  selection: string;
  odd: number;
  /** Set when the leg is a different match from the ticket header. Settlement uses it. */
  fixtureId?: number;
}

export interface ScoredPick {
  id: string;
  fixtureId: number;
  date: string;
  kickoff: string;
  timestamp: number;
  leagueId: number;
  league: string;
  country: string;
  home: string;
  away: string;
  homeLogo: string | null;
  awayLogo: string | null;
  kind: MarketKind;
  family: MarketFamily;
  selection: string;
  odd: number;
  bookmaker: string;
  implied: number;
  accuracy: number;
  value: number;
  edge: number;
  agreement: number;
  composite: number;
  leagueWeight: number;
  kellyQuarter: number;
  lambdaHome: number;
  lambdaAway: number;
  eloHome: number;
  eloAway: number;
  rho: number;
  advice: string | null;
  apiLine: string | null;
  injuries: number;
  bestModel: ModelName;
  models: ModelBreakdown;
  scoreline: string;
  scorelineP: number;
  heat: ScoreCell[];
  notes: string[];
  facts: MatchFacts;
  rank?: number;
  settled?: { home: number; away: number; hit: boolean | null; live?: boolean } | null;
  aavs?: number;
  robustness?: number;
  comboLegs?: ComboLeg[];
  qualityGate?: {
    absolute: number;
    relative: number;
    combined: number;
    reason: string;
    parts?: Record<string, number>;
  };
}

export type ExpertKey = "dc" | "shin" | "api" | "elo" | "h2h";
export type EnsembleFamily = "win" | "btts" | "ou" | "cs";

export interface ExpertWeights {
  dc: number;
  shin: number;
  api: number;
  elo: number;
  h2h: number;
}

export interface ReliabilityBin {
  lo: number;
  hi: number;
  pBar: number;
  yBar: number;
  n: number;
}

export interface FamilyCalibration {
  family: EnsembleFamily;
  n: number;
  nByExpert: ExpertWeights;
  brier: ExpertWeights;
  logLoss: ExpertWeights;
  priorAcc: ExpertWeights;
  priorVal: ExpertWeights;
  acc: ExpertWeights;
  val: ExpertWeights;
  ece: number;
  reliability: ReliabilityBin[];
  rule?: "prior" | "inverse-brier" | "mix-ls" | "prior-platt" | "mix-ls-platt";
  oosBrier?: number;
  oosPrior?: number;
  plattA?: number;
  plattB?: number;
  shrink?: number;
  autoresearch?: string;
  inSampleAcc?: ExpertWeights;
  backtestWindows?: number;
}

export interface CardExpertRow {
  expert: ExpertKey;
  label: string;
  n: number;
  brier: number;
  logLoss: number;
  meanP: number;
}

export interface CardCalibration {
  n: number;
  hits: number;
  brier: number;
  logLoss: number;
  ece: number;
  reliability: ReliabilityBin[];
  experts: CardExpertRow[];
}

export interface CalibrationSnapshot {
  asOf: string;
  n: number;
  nDates: number;
  dates: string[];
  families: Record<EnsembleFamily, FamilyCalibration>;
  hyper?: { halfLife: number; n0: number };
  hyperId?: string;
}

export interface CalibrationReport {
  applied: CalibrationSnapshot;
  card: CardCalibration | null;
  nAfter: number;
  ingested: number;
  walkForward?: WalkForwardReport | null;
  wfo?: WfoPair | null;
  sharpe?: SharpeReport | null;
  cardSharpe?: SharpeReport | null;
  sharpeByFamily?: FamilySharpeRow[];
  deflatedPsr?: number | null;
  nTrials?: number;
  validation?: {
    rows: Array<{
      id: "resubstitution" | "holdout" | "shuffled" | "expanding" | "rolling";
      label: string;
      valid: boolean;
      usesFuture: boolean;
      n: number;
      nDates: number;
      brier: number | null;
      note: string;
    }>;
    optimism: number | null;
    desk: "expanding";
  } | null;
}

export interface WalkForwardFold {
  date: string;
  trainN: number;
  trainDates: number;
  trainFrom: string | null;
  trainTo: string | null;
  n: number;
  hits: number;
  brierCal: number;
  brierPrior: number;
  brierRoll: number | null;
  logLossCal: number;
  logLossPrior: number;
  skill: number;
  cumBrierCal: number;
  cumBrierPrior: number;
  accWin: ExpertWeights;
  accByFamily: Record<EnsembleFamily, ExpertWeights>;
}

export interface WalkForwardFamilySlice {
  family: EnsembleFamily;
  n: number;
  brierCal: number;
  brierPrior: number;
  skill: number;
}

export interface WalkForwardExpertSlice {
  expert: ExpertKey;
  label: string;
  n: number;
  brier: number;
}

export interface DieboldMariano {
  t: number;
  p: number;
  meanDiff: number;
  n: number;
  lag: number;
  reject5: boolean;
}

export interface WalkForwardReport {
  asOf: string;
  embargoDays: number;
  rollingDates: number;
  n: number;
  nDates: number;
  hits: number;
  brierCal: number;
  brierPrior: number;
  brierRoll: number | null;
  logLossCal: number;
  logLossPrior: number;
  eceCal: number;
  skill: number;
  folds: WalkForwardFold[];
  families: Record<EnsembleFamily, WalkForwardFamilySlice>;
  experts: WalkForwardExpertSlice[];
  reliability: ReliabilityBin[];
  dm: DieboldMariano | null;
}

export type WfoWindow = "anchored" | "rolling";

export interface WfoGridCell {
  id: string;
  label: string;
  halfLife: number;
  n0: number;
}

export interface WfoFoldConfig {
  id: string;
  label: string;
  halfLife: number;
  n0: number;
  isBrier: number;
  oosBrier: number;
  efficiency: number | null;
}

export interface WfoFold {
  date: string;
  window: WfoWindow;
  trainN: number;
  trainDates: number;
  trainFrom: string | null;
  trainTo: string | null;
  n: number;
  isWinner: string;
  oosBest: string;
  isOosAgree: boolean;
  isBrier: number;
  oosBrier: number;
  efficiency: number | null;
  configs: WfoFoldConfig[];
}

export interface WfoGridSummary {
  id: string;
  label: string;
  halfLife: number;
  n0: number;
  isWins: number;
  oosWins: number;
  meanIs: number;
  meanOos: number;
  meanEfficiency: number | null;
  nFolds: number;
}

export interface WhiteRealityCheck {
  bestId: string;
  stat: number;
  p: number;
  nBoot: number;
  n: number;
}

export interface WfoReport {
  asOf: string;
  window: WfoWindow;
  rollingDates: number;
  n: number;
  nDates: number;
  folds: WfoFold[];
  grid: WfoGridSummary[];
  recommended: WfoGridCell;
  oosChampion: WfoGridCell;
  efficiency: number | null;
  lastAgree: boolean;
  pbo: number | null;
  pboN: number;
  white: WhiteRealityCheck | null;
  apply: boolean;
  appliedId: string;
  appliedReason: string;
}

export interface WfoPair {
  anchored: WfoReport;
  rolling: WfoReport;
}

export interface ModelLeaderRow {
  model: ModelName;
  label: string;
  meanP: number;
  calib: number;
  wins: number;
  brier?: number;
  logLoss?: number;
  n?: number;
}

export interface DeskMeta {
  date: string;
  timezone: string;
  scannedAt: string;
  source: ScanSource;
  quota: QuotaSnapshot;
  upcomingTotal: number;
  withOdds: number;
  inBand: number;
  modelled: number;
  calls: number;
  cacheHits: number;
  elapsedMs: number;
  notes: string[];
  /** True when this response was read from the saved day board and made no API calls. */
  saved?: boolean;
  /** When live scores were last written onto this saved board. */
  resultsUpdatedAt?: string;
  backtestHits?: number;
  backtestN?: number;
  calibratedN?: number;
  calibratedDates?: number;
}

export interface DeskResult {
  fold: ScoredPick[];
  candidates: ScoredPick[];
  scorelines: ScoredPick[];
  modelLeaderboard: ModelLeaderRow[];
  calibration?: CalibrationReport | null;
  meta: DeskMeta;
  warnings: string[];
  bestBet?: ScoredPick | null;
  bestBetAlternates?: ScoredPick[];
  combos?: ScoredPick[];
}

export interface ScanProgress {
  scanId: string;
  percent: number;
  step: string;
  running: boolean;
  error: string | null;
}

export interface LedgerRow {
  savedAt: string;
  date: string;
  kickoff: string;
  league: string;
  country: string;
  home: string;
  away: string;
  market: MarketKind;
  selection: string;
  odd: number;
  bookmaker: string;
  modelProb: number;
  impliedProb: number;
  edge: number;
  composite: number;
  advice: string | null;
  lambdaHome: number;
  lambdaAway: number;
  scoreline: string;
  fixtureId: number;
  pickId: string;
}

export interface TodayPick {
  slot: number;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  kind: MarketKind;
  selection: string;
  odds: number;
  bookmaker: string;
  ensemble: number;
  model: ModelName;
  scoreline: string;
  homeLogo: string | null;
  awayLogo: string | null;
}

export function familyOf(kind: MarketKind): MarketFamily {
  if (kind === "home" || kind === "away") return "win";
  if (kind === "draw") return "draw";
  if (kind === "btts_yes" || kind === "btts_no") return "btts";
  if (kind === "cs") return "cs";
  if (kind === "dc_1x" || kind === "dc_x2" || kind === "dc_12") return "dc";
  if (kind === "home_score" || kind === "away_score") return "team";
  if (kind === "ah" || kind === "eh") return "ah";
  if (kind === "corners") return "corners";
  if (kind === "cards") return "cards";
  if (kind === "player_ga") return "player";
  if (kind === "multi_goals") return "multi";
  if (kind === "odd_even") return "parity";
  if (kind === "combo") return "combo";
  return "ou";
}

export function isWinKind(kind: MarketKind): boolean {
  return kind === "home" || kind === "away";
}

export function emptyFamilyCount(): Record<MarketFamily, number> {
  return {
    win: 0,
    btts: 0,
    ou: 0,
    cs: 0,
    draw: 0,
    dc: 0,
    ah: 0,
    team: 0,
    corners: 0,
    cards: 0,
    player: 0,
    multi: 0,
    parity: 0,
    combo: 0,
  };
}

export function inOddsBand(odd: number, lo: number = ODDS_BAND.min, hi: number = ODDS_BAND.max): boolean {
  return odd >= lo - 1e-9 && odd <= hi + 1e-9;
}

export function inCsOddsBand(odd: number): boolean {
  return odd >= CS_ODDS_BAND.min - 1e-9 && odd <= CS_ODDS_BAND.max + 1e-9;
}

/** Playable window per market — draws live long, team-to-score lives short. */
export function playableOdd(kind: MarketKind, odd: number): boolean {
  if (kind === "cs") return inCsOddsBand(odd);
  if (kind === "draw") return inOddsBand(odd, DRAW_ODDS_BAND.min, DRAW_ODDS_BAND.max);
  if (kind === "home_score" || kind === "away_score") {
    return inOddsBand(odd, TEAM_ODDS_BAND.min, TEAM_ODDS_BAND.max);
  }
  if (kind === "player_ga") return inOddsBand(odd, PLAYER_ODDS_BAND.min, PLAYER_ODDS_BAND.max);
  if (kind === "combo") return inOddsBand(odd, COMBO_ODDS_BAND.min, COMBO_ODDS_BAND.max);
  if (kind === "multi_goals") return inOddsBand(odd, MULTI_GOALS_ODDS_BAND.min, MULTI_GOALS_ODDS_BAND.max);
  if (kind === "ou_asian") return inOddsBand(odd, ODDS_PLAYABLE.min, ODDS_PLAYABLE.max);
  return inOddsBand(odd, ODDS_PLAYABLE.min, ODDS_PLAYABLE.max);
}

export function isHeadlineOu(kind: MarketKind): boolean {
  return kind === "over_25" || kind === "under_25";
}

export function isExtraFamily(family: MarketFamily): boolean {
  return (
    family === "draw" ||
    family === "dc" ||
    family === "ah" ||
    family === "team" ||
    family === "corners" ||
    family === "cards" ||
    family === "player" ||
    family === "multi" ||
    family === "parity" ||
    family === "combo"
  );
}

export function emptyLineup(): LineupImpact {
  return { attack: 0, defense: 0, keeper: 0, formation: null, confirmed: false, starters: 0, players: [] };
}
