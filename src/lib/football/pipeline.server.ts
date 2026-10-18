// @ts-nocheck — recovered from SSR compile + corner/player modules.
import {
  CLOCK_SKEW_MS,
  FIXTURE_TTL_MS,
  H2H_TTL_MS,
  INJURY_TTL_MS,
  LAST5_TTL_MS,
  LAST_N_FIXTURES,
  LEAGUES_TTL_MS,
  LINEUP_TTL_MS,
  MAP_POOL,
  MAX_H2H_BACKFILL,
  MAX_LAST5_TEAMS,
  MAX_LINEUPS,
  MAX_MODELLED,
  MAX_ODDS_PAGES,
  MAX_ODDS_BACKFILL,
  MAX_STANDINGS_LEAGUES,
  MAX_TEAM_STATS,
  MAX_PLAYER_TEAMS,
  MAX_CORNER_STAT_FIXTURES,
  CORNER_SAMPLE_N,
  MIN_SEED_WEIGHT,
  ODDS_TTL_MS,
  PRED_TTL_MS,
  PLAYERS_TTL_MS,
  FIXTURE_STATS_TTL_MS,
  SCAN_BUDGET_MS,
  BACKTEST_BUDGET_MS,
  SCAN_TTL_MS,
  STANDINGS_TTL_MS,
  TEAM_STATS_TTL_MS,
} from "./config.server";
import {
  envOrSessionKey,
  footballGet,
  footballStatus,
  getCacheHits,
  getQuota,
  isScanBudget,
  mapPool,
  resetQueue,
  resetScanQuotaCounter,
  currentGeneration,
} from "./client.server";
import {
  anyBinaryPlayable,
  anyInBand,
  applyStandings,
  applyTeamSample,
  attachInjuryToFixture,
  bestInBandOdd,
  bestPlayableOdd,
  cheapScore,
  emptyPrediction,
  extractFixtureMarkets,
  extractH2hFixtures,
  extractLeagueCoverage,
  extractLineups,
  extractPrediction,
  extractStandings,
  extractTeamStatistics,
  extractFixtureCornerMap,
  extractPlayerSeason,
  finishedSamples,
  groupInjuriesByTeam,
  inferSeason,
  mergeH2h,
  mergeOddsRows,
  parseFixture,
  parseUpcomingStatus,
  isFinishedStatus,
  standingByTeam,
} from "./extract";
import {
  buildSnapshot,
  bttsFailureModes,
  bttsFailureSeverity,
  explainMatch,
  featureCutoffUnix,
  last5Rates,
  leagueEnvFromStandings,
  marketCoverageFromFlags,
  rollWindow,
  samplesForMatch,
  shouldFetchLive,
} from "./features";
import { isLiquidLeague, leagueExpectedTotal, leagueScoringMeans, leagueWeight } from "./leagues";
import {
  aavs,
  asianCoverP,
  asianExpectedReturn,
  asianFromGrid,
  asianLineStability,
  asianTotalFromGrid,
  bestAhLine,
  comboJointP,
  crossMarketFlags,
  drawConcentration,
  drawRiskScore,
  europeanFromGrid,
  generateCombos,
  sameMatchOverPairs,
  kindUsesGoals,
  parseAhSelection,
  parseCountSelection,
  parseEhSelection,
  pFromGridForKind,
  poissonOver,
  robustnessFromPerturb,
  totalCardsLambda,
  totalCornersLambda,
  upsetRiskScore,
  playerGoalOrAssist,
} from "./markets-engine";
import {
  bivariateCornerGrid,
  cornerLambdas,
  cornerRatesFromSamples,
  parseCornerMarket,
  pCornerMarket,
  ratesFromTeamCorners,
} from "./corners";
import {
  expectedMinutes,
  matchPlayer,
  parsePlayerGa,
  playerAttackLambdas,
} from "./player-props";
import {
  apiBttsProxy,
  apiLineToOver15,
  apiLineToOver25,
  adviceForKind,
  betaShrink,
  bivariateGrid,
  borsH2hWeight,
  breakdownFromParts,
  clamp,
  closeTableH2hDrawBoost,
  compositeScore,
  copulaGrid,
  CS_PER_FIXTURE,
  dcDecay,
  DC_RHO,
  egidiMix,
  eloToLambdas,
  ensembleFamilyOf,
  ensembleForKind,
  estimateLambdas,
  fuseScoreReport,
  gradeMarket,
  gridCellP,
  histWeightFromData,
  inflateDraw,
  isPlayableCsScore,
  jointGrid,
  latestH2hConflicts,
  h2hMarketRates,
  maherGrid,
  marketAgreesWithHistory,
  marketsFromGrid,
  matchRho,
  modalScoreForKind,
  naDrawBoost,
  negBinGrid,
  orderedLogitProbs,
  parseScore,
  pForKind,
  pickSanity,
  piToLambdas,
  quarterKelly,
  shinCsImplied,
  shinImpliedOver,
  skellamLambdasFrom1x2,
  tiltGridTo1x2,
  totalFromOver25,
  walkElo,
  walkPiRatings,
  winRateFromForm,
} from "./models";
import { beginProgress, endProgress, failProgress, setProgress } from "./progress.server";
import { loadEspnStandings, loadPublicMatches } from "./public-fixtures.server";
import { focusBestBet, leaderboard, selectDailyTen, selectDataBackedCombos, selectOverFocusCombo } from "./select";
import { todayYmd } from "./time";
import { FAMILIES, applyPlatt, makeReport, observationFromPick, walkForwardValidate } from "./calibrate";
import { applyShrink } from "./autoresearch";
import { bundleCalibration, ingestObservations, loadObservations } from "./calibrate-store.server";
import { readDayBoard, writeDayBoard } from "./board-store.server";
import { applyScoreUpdates } from "./results.ts";
import { emptyLineup, familyOf, inCsOddsBand, inOddsBand, playableOdd, ENGINE_VERSION, FEATURE_SCHEMA, ODDS_PLAYABLE } from "./types";
import { emaSpanRate, smaRate } from "./latent";

export function corsHeaders(origin) {
	return {
		"Access-Control-Allow-Origin": origin && (/^https:\/\/([a-z0-9-]+\.)?grok\.com$/i.test(origin) || /localhost|127\.0\.0\.1/.test(origin)) ? origin : "*",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
		"Access-Control-Allow-Headers": "content-type,authorization,x-api-key",
		"Access-Control-Max-Age": "86400"
	};
}
var scanCache = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
function serveSaved(result) {
	const notes = Array.isArray(result?.meta?.notes) ? result.meta.notes.slice() : [];
	if (!notes.some((n) => String(n).startsWith("Saved board"))) {
		notes.unshift("Saved board — this open did not call API-Football.");
	}
	return {
		...result,
		meta: {
			...result.meta,
			saved: true,
			calls: 0,
			notes
		}
	};
}
export async function runDeskPipeline(opts) {
	const key = `${opts.date}|${opts.timezone}`;
	if (!opts.fresh) {
		const hit = scanCache.get(key);
		if (hit && hit.result) {
			if (opts.scanId) endProgress(opts.scanId, "Saved board");
			return serveSaved(hit.result);
		}
		const disk = readDayBoard(opts.date, opts.timezone);
		if (disk) {
			scanCache.set(key, { at: Date.now(), result: disk });
			if (opts.scanId) endProgress(opts.scanId, "Saved board");
			return serveSaved(disk);
		}
		const pending = inflight.get(key);
		if (pending) {
			if (opts.scanId) setProgress(opts.scanId, 20, "Waiting on in-flight scan…");
			return pending;
		}
	}
	const job = runFresh(opts);
	inflight.set(key, job);
	try {
		const result = await job;
		writeDayBoard(result);
		scanCache.set(key, {
			at: Date.now(),
			result
		});
		return result;
	} finally {
		inflight.delete(key);
	}
}
function finishedStatus(short) {
	const st = String(short ?? "").toUpperCase();
	return st === "FT" || st === "AET" || st === "PEN";
}
function upcomingStatus(short) {
	const st = String(short ?? "").toUpperCase();
	return st === "NS" || st === "TBD" || st === "PST" || st === "" || st === "CANC" || st === "ABD" || st === "AWD" || st === "WO";
}
function loadBoard(date, timezone) {
	const key = `${date}|${timezone}`;
	const hit = scanCache.get(key);
	if (hit?.result) return { key, result: hit.result };
	const disk = readDayBoard(date, timezone);
	if (disk) return { key, result: disk };
	return { key, result: null };
}
/** One fixtures call. Grades the saved board. Does not refetch odds or models. */
export async function refreshPickResults(opts) {
	const { key, result: saved } = loadBoard(opts.date, opts.timezone);
	if (!saved) throw new Error("No saved board for this date. Run the desk once, then update results.");
	const apiKey = envOrSessionKey(opts.apiKey);
	if (!apiKey) throw new Error("Set an API-Football key to update live scores.");
	const scanId = opts.scanId ?? `r-${Date.now()}`;
	beginProgress(scanId);
	resetScanQuotaCounter();
	try {
		setProgress(scanId, 30, "Checking live scores…");
		const fxRes = await footballGet("/fixtures", {
			date: opts.date,
			timezone: opts.timezone
		}, {
			apiKey,
			ttl: 60 * 1000,
			skipCache: true,
			deadline: Date.now() + 20_000,
			gen: currentGeneration()
		});
		const scores = new Map();
		for (const row of fxRes.response ?? []) {
			const id = row?.fixture?.id;
			const hg = row?.goals?.home;
			const ag = row?.goals?.away;
			if (!id || hg == null || ag == null) continue;
			const short = row?.fixture?.status?.short;
			if (upcomingStatus(short)) continue;
			scores.set(id, {
				home: hg,
				away: ag,
				live: !finishedStatus(short)
			});
		}
		const result = structuredClone(saved);
		for (const list of [result.candidates, result.scorelines, result.combos, result.bestBetAlternates]) {
			if (list?.length) applyScoreUpdates(list, scores);
		}
		const foldTally = applyScoreUpdates(result.fold ?? [], scores);
		if (result.bestBet) {
			const live = (result.candidates ?? []).find((c) => c.id === result.bestBet.id);
			if (live?.settled) result.bestBet.settled = live.settled;
			else applyScoreUpdates([result.bestBet], scores);
		}
		const ingested = ingestObservations((result.candidates ?? []).map((p) => observationFromPick(opts.date, p)).filter((o) => o != null)).ingested;
		const { applied, wfo } = bundleCalibration(opts.date);
		const corpus = loadObservations();
		const wf = walkForwardValidate(corpus, { asOf: opts.date, hyper: applied.hyper });
		result.calibration = makeReport(applied, result.fold ?? [], corpus.length, ingested, wf, corpus, wfo);
		result.modelLeaderboard = leaderboard(result.candidates ?? []);
		const when = new Date().toISOString();
		const note = `Live scores: ${foldTally.hits}/${foldTally.n} of the ten finished${foldTally.live ? `, ${foldTally.live} still in play` : ""}. One fixtures call.`;
		const notes = Array.isArray(result.meta?.notes) ? result.meta.notes.filter((n) => !String(n).startsWith("Live scores:")) : [];
		notes.unshift(note);
		if (ingested) notes.splice(1, 0, `Calibrated corpus +${ingested} finished lines.`);
		result.meta = {
			...result.meta,
			saved: true,
			calls: getQuota().usedThisScan,
			backtestHits: foldTally.hits,
			backtestN: foldTally.n,
			resultsUpdatedAt: when,
			notes
		};
		writeDayBoard(result);
		scanCache.set(key, { at: Date.now(), result });
		endProgress(scanId, "Scores updated");
		return result;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		failProgress(scanId, msg);
		throw err;
	}
}
async function runFresh(opts) {
	const scanId = opts.scanId ?? `s-${Date.now()}`;
	beginProgress(scanId);
	resetQueue();
	resetScanQuotaCounter();
	const today = todayYmd(opts.timezone);
	const deadline = Date.now() + (opts.date <= today ? BACKTEST_BUDGET_MS : SCAN_BUDGET_MS);
	const gen = currentGeneration();
	const apiKey = envOrSessionKey(opts.apiKey);
	const warnings = [];
	const notes = [];
	try {
		let result;
		if (apiKey) try {
			result = await scanApiFootball(opts, apiKey, scanId, deadline, gen, warnings, notes);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg === "scan-budget") {
				warnings.push("Clock ran out before the fixture list. No odds call was kept. Public board instead.");
				result = await scanPublic(opts, scanId, deadline, warnings, notes);
			} else {
				warnings.push(`API-Football path failed (${msg}). Falling back to the public board.`);
				notes.length = 0;
				result = await scanPublic(opts, scanId, deadline, warnings, notes);
			}
		}
		else {
			warnings.push("API-Football key is not set on the engine. Ranking last-5 form, league priors, and posted totals from the public board.");
			result = await scanPublic(opts, scanId, deadline, warnings, notes);
		}
		endProgress(scanId, "Board ranked");
		return result;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		failProgress(scanId, msg);
		throw err;
	}
}
function emptyResult(opts, source, warnings, notes) {
	const { applied, walkForward, wfo, corpus } = bundleCalibration(opts.date);
	return {
		fold: [],
		candidates: [],
		scorelines: [],
		modelLeaderboard: [],
		calibration: makeReport(applied, [], corpus.length, 0, walkForward, corpus, wfo),
		meta: {
			date: opts.date,
			timezone: opts.timezone,
			scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
			source,
			quota: getQuota(),
			upcomingTotal: 0,
			withOdds: 0,
			inBand: 0,
			modelled: 0,
			calls: getQuota().usedThisScan,
			cacheHits: getCacheHits(),
			elapsedMs: 0,
			notes
		},
		warnings,
		bestBet: null,
		bestBetAlternates: [],
		combos: []
	};
}
async function scanApiFootball(opts, apiKey, scanId, deadline, gen, warnings, notes) {
	const t0 = Date.now();
	const { applied: appliedCal, wfo } = bundleCalibration(opts.date);
	setProgress(scanId, 12, "Pulling today's fixtures…");
	try {
		await footballStatus(apiKey);
	} catch {}
	const fxRes = await footballGet("/fixtures", {
		date: opts.date,
		timezone: opts.timezone
	}, {
		apiKey,
		ttl: FIXTURE_TTL_MS,
		skipCache: true,
		deadline,
		gen
	});
	const now = Date.now() - CLOCK_SKEW_MS;
	const fixtures = [];
	const ftScores = /* @__PURE__ */ new Map();
	for (const row of fxRes.response ?? []) {
		const parsed = parseFixture(row, opts.date, opts.timezone);
		if (!parsed) continue;
		const raw = row;
		const short = raw.fixture?.status?.short;
		const finished = isFinishedStatus(short);
		if (finished || parseUpcomingStatus(short)) {} else continue;
		const ko = parsed.timestamp ? parsed.timestamp * 1e3 : Date.parse(parsed.kickoff);
		if (!finished && ko && ko < now) continue;
		fixtures.push(parsed);
		const hg = raw.goals?.home;
		const ag = raw.goals?.away;
		if (finished && hg != null && ag != null) ftScores.set(parsed.fixtureId, {
			home: hg,
			away: ag
		});
	}
	notes.push(ftScores.size ? `${fixtures.length} fixtures (${ftScores.size} settled) for ${opts.date}.` : `${fixtures.length} upcoming fixtures.`);
	setProgress(scanId, 28, "Paging odds…");
	const rawOdds = /* @__PURE__ */ new Map();
	const takeOddsRows = (rows) => {
		for (const row of rows ?? []) {
			const id = row?.fixture?.id;
			if (!id) continue;
			const prev = rawOdds.get(id);
			rawOdds.set(id, prev ? mergeOddsRows(prev, row) : row);
		}
	};
	let page = 1;
	let pagesUsed = 0;
	let total = 1;
	let oddsCut = false;
	while (page <= total && pagesUsed < MAX_ODDS_PAGES) {
		if (Date.now() > deadline - 1500) {
			oddsCut = true;
			break;
		}
		try {
			const chunk = await footballGet("/odds", {
				date: opts.date,
				timezone: opts.timezone,
				page
			}, {
				apiKey,
				ttl: ODDS_TTL_MS,
				deadline,
				gen
			});
			total = Math.min(chunk.paging?.total ?? page, MAX_ODDS_PAGES);
			takeOddsRows(chunk.response);
			pagesUsed += 1;
			page += 1;
		} catch (err) {
			oddsCut = true;
			const msg = err instanceof Error ? err.message : String(err);
			notes.push(isScanBudget(err) ? `Odds paging stopped after ${pagesUsed} pages. Those books stay on the board.` : `Odds page ${page} skipped (${msg}). Pages already read stay.`);
			break;
		}
	}
	if (oddsCut && page <= total) notes.push(`Date odds stopped at page ${pagesUsed} of ${total}. No bookmaker filter — every book on those pages is kept.`);
	const priced = (row) => {
		try {
			const m = extractFixtureMarkets(row);
			if (!m) return null;
			return anyBinaryPlayable(m) || anyInBand(m) ? m : null;
		} catch {
			return null;
		}
	};
	const markets = /* @__PURE__ */ new Map();
	for (const [id, row] of rawOdds) {
		try {
			const m = extractFixtureMarkets(row);
			if (m) markets.set(id, m);
		} catch {}
	}
	const missing = fixtures.filter((fx) => {
		if (leagueWeight(fx.leagueId, fx.league, fx.country, fx.home, fx.away) < MIN_SEED_WEIGHT) return false;
		return !priced(rawOdds.get(fx.fixtureId));
	}).slice(0, MAX_ODDS_BACKFILL);
	let backfilled = 0;
	if (missing.length) {
		setProgress(scanId, 40, "Odds from any book…");
		await mapPool(missing, MAP_POOL, async (fx) => {
			if (Date.now() > deadline - 1200) return;
			try {
				let bPage = 1;
				let bTotal = 1;
				let merged = null;
				while (bPage <= bTotal && bPage <= 3) {
					const chunk = await footballGet("/odds", {
						fixture: fx.fixtureId,
						page: bPage
					}, {
						apiKey,
						ttl: ODDS_TTL_MS,
						deadline,
						gen
					});
					bTotal = Math.min(chunk.paging?.total ?? bPage, 3);
					for (const row of chunk.response ?? []) merged = merged ? mergeOddsRows(merged, row) : row;
					bPage += 1;
				}
				if (!merged) return;
				const prev = rawOdds.get(fx.fixtureId);
				const next = prev ? mergeOddsRows(prev, merged) : merged;
				rawOdds.set(fx.fixtureId, next);
				const m = extractFixtureMarkets(next);
				if (m) {
					markets.set(fx.fixtureId, m);
					if (priced(next)) backfilled += 1;
				}
			} catch {}
		});
	}
	notes.push(`${markets.size} fixtures with books after ${pagesUsed} odds pages${backfilled ? ` · ${backfilled} priced from another book` : ""}.`);
	setProgress(scanId, 55, "Loading the day's injury list…");
	let injuryByFix = /* @__PURE__ */ new Map();
	try {
		injuryByFix = groupInjuriesByTeam((await footballGet("/injuries", {
			date: opts.date,
			timezone: opts.timezone
		}, {
			apiKey,
			ttl: INJURY_TTL_MS,
			deadline,
			gen
		})).response);
	} catch {
		notes.push("Injuries endpoint skipped.");
	}
	const seeds = [];
	let inBandCount = 0;
	for (const fx of fixtures) {
		const m = markets.get(fx.fixtureId);
		if (!m) continue;
		const w = leagueWeight(fx.leagueId, fx.league, fx.country, fx.home, fx.away);
		if (w < .5) continue;
		if (!anyBinaryPlayable(m) && !anyInBand(m)) continue;
		inBandCount += 1;
		const odd = bestPlayableOdd(m) ?? bestInBandOdd(m) ?? 1.925;
		seeds.push({
			fixture: fx,
			markets: m,
			cheap: cheapScore(w, odd),
			weight: w
		});
	}
	seeds.sort((a, b) => b.cheap - a.cheap);
	const modelled = seeds.slice(0, 36);
	notes.push(`${inBandCount} fixtures have a posted binary line; modelling top ${modelled.length}.`);
	notes.push(`Engine ${ENGINE_VERSION} feature ${FEATURE_SCHEMA}.`);
	setProgress(scanId, 58, "League coverage…");
	let coverageByLeague = /* @__PURE__ */ new Map();
	try {
		const { response } = await footballGet("/leagues", { current: "true" }, {
			apiKey,
			ttl: LEAGUES_TTL_MS,
			deadline,
			gen
		});
		coverageByLeague = extractLeagueCoverage(response);
		notes.push(`Coverage for ${coverageByLeague.size} current leagues.`);
	} catch {
		notes.push("League coverage probe skipped.");
	}
	setProgress(scanId, 62, "Pulling API-Football predictions…");
	const preds = /* @__PURE__ */ new Map();
	await mapPool(modelled, 4, async (seed) => {
		if (Date.now() > deadline - 800) return;
		if (!shouldFetchLive("predictions", coverageByLeague.get(seed.fixture.leagueId))) return;
		setProgress(scanId, 62, `Predictions · ${seed.fixture.home} vs ${seed.fixture.away}`);
		try {
			const { response } = await footballGet("/predictions", { fixture: seed.fixture.fixtureId }, {
				apiKey,
				ttl: PRED_TTL_MS,
				deadline,
				gen
			});
			const ex = extractPrediction(response, seed.fixture.fixtureId);
			if (ex) preds.set(seed.fixture.fixtureId, ex);
		} catch {}
	});
	const enriched = await enrichMatchData({
		modelled,
		preds,
		apiKey,
		deadline,
		gen,
		scanId,
		notes,
		coverageByLeague,
		hasInjuryFeed: injuryByFix.size > 0,
		injuryKnown: new Set(injuryByFix.keys())
	});
	setProgress(scanId, 90, "Fitting Dixon–Coles and ranking the ten…");
	const candidates = [];
	for (const seed of modelled) {
		const inj = attachInjuryToFixture(injuryByFix, seed.fixture.fixtureId, seed.fixture.homeId, seed.fixture.awayId);
		try {
			candidates.push(...scoreFixture({
				fixture: seed.fixture,
				markets: seed.markets,
				pred: preds.get(seed.fixture.fixtureId) ?? null,
				injuryHome: inj.home,
				injuryAway: inj.away,
				lineupHome: enriched.lineupsByFix.get(seed.fixture.fixtureId)?.home ?? emptyLineup(),
				lineupAway: enriched.lineupsByFix.get(seed.fixture.fixtureId)?.away ?? emptyLineup(),
				playersByTeam: enriched.playersByTeam,
				date: opts.date,
				ensembleWeights: appliedCal
			}));
		} catch {
			/* one fixture does not drop the board */
		}
	}
	const overTicket = selectOverFocusCombo(candidates);
	if (overTicket) candidates.push(overTicket);
	const fold = selectDailyTen(candidates);
	const scorelines = candidates.filter((c) => c.kind === "cs").sort((a, b) => b.composite - a.composite).slice(0, 16);
	if (fold.length < 10) notes.push(`Fold is ${fold.length} — this date does not have ten in-band modelled lines.`);
	const nCs = fold.filter((p) => p.family === "cs").length;
	const nBin = fold.filter((p) => p.family !== "cs").length;
	notes.push(`Mixer ${nBin} binary / ${nCs} CS (target 5–3–2, CS last resort).`);
	let backtestHits;
	let backtestN;
	let ingested = 0;
	if (ftScores.size) {
		settlePicks(candidates, ftScores);
		const graded = settlePicks(fold, ftScores);
		backtestHits = graded.hits;
		backtestN = graded.n;
		notes.push(`Settled ${opts.date}: ${graded.hits}/${graded.n} of the ten hit.`);
		ingested = ingestObservations(candidates.map((p) => observationFromPick(opts.date, p)).filter((o) => o != null)).ingested;
		if (ingested) notes.push(`Calibrated corpus +${ingested} lines (walk-forward, this date unused on itself).`);
	}
	const corpus = loadObservations();
	const wf = walkForwardValidate(corpus, { asOf: opts.date, hyper: appliedCal.hyper });
	const calReport = makeReport(appliedCal, fold, corpus.length, ingested, wf, corpus, wfo);
	if (wf.nDates >= 2) {
		const skillPp = (wf.skill * 100).toFixed(1);
		const sign = wf.skill >= 0 ? "+" : "";
		notes.push(`Walk-forward ${wf.nDates} dates / ${wf.n} lines: OOS Brier ${(wf.brierCal * 1e3).toFixed(0)}‰ vs prior ${(wf.brierPrior * 1e3).toFixed(0)}‰ (skill ${sign}${skillPp}%).`);
		if (wf.dm) {
			notes.push(`Diebold–Mariano t ${wf.dm.t.toFixed(2)} · p ${wf.dm.p < 0.001 ? "<0.1%" : `${(wf.dm.p * 100).toFixed(1)}%`}${wf.dm.reject5 ? " — mix is sharper than the prior at 5%." : " — skill not significant."}`);
		}
		if (calReport.sharpe?.sharpe != null) {
			const s = calReport.sharpe;
			const dsr = calReport.deflatedPsr != null ? `${Math.round(calReport.deflatedPsr * 100)}%` : "—";
			notes.push(`Corpus Sharpe ${s.sharpe >= 0 ? "+" : ""}${s.sharpe.toFixed(2)} · Sortino ${s.sortino != null ? s.sortino.toFixed(2) : "—"} · Ω ${s.omega != null ? s.omega.toFixed(2) : "—"} · UPR ${s.upr != null ? s.upr.toFixed(2) : "—"} · PSR ${s.psr != null ? `${Math.round(s.psr * 100)}%` : "—"} · DSR ${dsr} (${s.n} lines / ${s.nDates}d, N=${calReport.nTrials ?? 1}).`);
			const top = calReport.sharpeByFamily?.[0];
			if (top?.report.sharpe != null) {
				notes.push(`Best family Sharpe ${top.family} ${top.report.sharpe >= 0 ? "+" : ""}${top.report.sharpe.toFixed(2)} (n ${top.report.n}).`);
			}
		}
		const rules = FAMILIES.map((f) => `${f} ${appliedCal.families[f].rule ?? "prior"}`).join(", ");
		notes.push(`Backtest weights: ${rules}.`);
		if (wfo.anchored.nDates) {
			const w = wfo.anchored;
			const wfe = w.efficiency != null ? w.efficiency.toFixed(2) : "—";
			const pbo = w.pbo != null ? `${Math.round(w.pbo * 100)}%` : "need 6 dates";
			notes.push(
				`Walk-forward optimization (Pardo ${w.window}): last IS-winner ${w.recommended.label} · WFE ${wfe} · PBO ${pbo} · ${w.apply ? `applied ${w.appliedId}` : "14d · n₀ 48 stays"}.`,
			);
		}
	}
	const ranked = focusBestBet(candidates);
	if (ranked.best) {
		const live = candidates.find((c) => c.id === ranked.best.id);
		if (live?.settled) ranked.best.settled = live.settled;
	}
	return {
		fold,
		candidates: candidates.sort((a, b) => b.composite - a.composite),
		scorelines,
		modelLeaderboard: leaderboard(candidates),
		calibration: calReport,
		meta: {
			date: opts.date,
			timezone: opts.timezone,
			scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
			source: "api-football",
			quota: getQuota(),
			upcomingTotal: fixtures.length,
			withOdds: markets.size,
			inBand: inBandCount,
			modelled: modelled.length,
			calls: getQuota().usedThisScan,
			cacheHits: getCacheHits(),
			elapsedMs: Date.now() - t0,
			notes,
			backtestHits,
			backtestN,
			calibratedN: appliedCal.n,
			calibratedDates: appliedCal.nDates
		},
		warnings,
		bestBet: ranked.best,
		bestBetAlternates: ranked.alternates,
		combos: selectDataBackedCombos(candidates)
	};
}
async function scanPublic(opts, scanId, deadline, warnings, notes) {
	const t0 = Date.now();
	const { applied: appliedCal, wfo } = bundleCalibration(opts.date);
	setProgress(scanId, 14, "Loading public fixtures for today and tomorrow…");
	const matches = await loadPublicMatches(opts.date, opts.timezone, deadline);
	const now = Date.now() - CLOCK_SKEW_MS;
	const upcoming = matches.filter((m) => {
		const ko = m.fixture.timestamp ? m.fixture.timestamp * 1e3 : Date.parse(m.fixture.kickoff);
		return !ko || ko >= now;
	});
	notes.push(`Public board: ${upcoming.length} upcoming matches.`);
	setProgress(scanId, 40, "Public league tables…");
	const tableByLeague = /* @__PURE__ */ new Map();
	const publicLeagues = [...new Set(upcoming.map((m) => m.fixture.leagueId))];
	await Promise.all(publicLeagues.map(async (id) => {
		const rows = await loadEspnStandings(id, deadline);
		if (rows.length) tableByLeague.set(id, rows);
	}));
	setProgress(scanId, 55, "Fitting Dixon–Coles on the public board…");
	const candidates = [];
	for (const m of upcoming) {
		const markets = syntheticMarkets(m);
		if (!anyBinaryPlayable(markets) && !anyInBand(markets)) continue;
		const base = emptyPrediction(m.fixture.fixtureId);
		base.grade = "PARTIAL_DATA";
		base.quality = .48;
		const table = tableByLeague.get(m.fixture.leagueId);
		const withTable = applyStandings({
			...base,
			homeLast5: {
				forAvg: null,
				againstAvg: null,
				form: m.homeForm
			},
			awayLast5: {
				forAvg: null,
				againstAvg: null,
				form: m.awayForm
			},
			homeForm: m.homeForm,
			awayForm: m.awayForm,
			grade: "PARTIAL_DATA",
			quality: .48
		}, table ? standingByTeam(table, m.fixture.homeId) : void 0, table ? standingByTeam(table, m.fixture.awayId) : void 0);
		candidates.push(...scoreFixture({
			fixture: m.fixture,
			markets,
			pred: withTable,
			injuryHome: {
				attack: 0,
				defense: 0,
				keeper: 0
			},
			injuryAway: {
				attack: 0,
				defense: 0,
				keeper: 0
			},
			lineupHome: emptyLineup(),
			lineupAway: emptyLineup(),
			date: opts.date,
			ensembleWeights: appliedCal
		}));
	}
	const overTicket = selectOverFocusCombo(candidates);
	if (overTicket) candidates.push(overTicket);
	const fold = selectDailyTen(candidates);
	const corpus = loadObservations();
	const wf = walkForwardValidate(corpus, { asOf: opts.date, hyper: appliedCal.hyper });
	const ranked = focusBestBet(candidates);
	if (ranked.best) {
		const live = candidates.find((c) => c.id === ranked.best.id);
		if (live?.settled) ranked.best.settled = live.settled;
	}
	return {
		fold,
		candidates: candidates.sort((a, b) => b.composite - a.composite),
		scorelines: candidates.filter((c) => c.kind === "cs").slice(0, 16),
		modelLeaderboard: leaderboard(candidates),
		calibration: makeReport(appliedCal, fold, corpus.length, 0, wf, corpus, wfo),
		meta: {
			date: opts.date,
			timezone: opts.timezone,
			scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
			source: "public-board",
			quota: getQuota(),
			upcomingTotal: upcoming.length,
			withOdds: upcoming.filter((m) => m.over25 || m.over15 || m.homeOdd).length,
			inBand: new Set(candidates.map((c) => c.fixtureId)).size,
			modelled: upcoming.length,
			calls: 0,
			cacheHits: getCacheHits(),
			elapsedMs: Date.now() - t0,
			notes,
			calibratedN: appliedCal.n,
			calibratedDates: appliedCal.nDates
		},
		warnings,
		bestBet: ranked.best,
		bestBetAlternates: ranked.alternates,
		combos: selectDataBackedCombos(candidates)
	};
}
function syntheticMarkets(m) {
	const side = (kind, selection, odd) => {
		if (odd == null || !(odd > 1)) return void 0;
		return {
			kind,
			selection,
			medianOdd: odd,
			sharpOdd: odd,
			sharpBook: "DraftKings",
			shinImplied: kind.startsWith("over") || kind.startsWith("under") ? shinImpliedOver(odd, null) : 1 / odd,
			inBand: inOddsBand(odd),
			books: [{
				bookmakerId: 0,
				bookmaker: "DraftKings",
				odd
			}],
			reliable: true,
			consensusOdd: odd,
			bookCount: 1
		};
	};
	return {
		fixtureId: m.fixture.fixtureId,
		winner: {
			home: side("home", "Home", m.homeOdd),
			away: side("away", "Away", m.awayOdd)
		},
		btts: {},
		ou15: {
			over: side("over_15", "Over 1.5", m.over15),
			under: side("under_15", "Under 1.5", m.under15)
		},
		ou25: {
			over: side("over_25", "Over 2.5", m.over25),
			under: side("under_25", "Under 2.5", m.under25)
		},
		correctScores: []
	};
}
async function enrichMatchData(opts) {
	const { modelled, preds, apiKey, deadline, gen, scanId, notes, coverageByLeague, hasInjuryFeed, injuryKnown } = opts;
	const standingsByLeague = /* @__PURE__ */ new Map();
	const lastByTeam = /* @__PURE__ */ new Map();
	const statsByTeam = /* @__PURE__ */ new Map();
	const lineupsByFix = /* @__PURE__ */ new Map();
	const playersByTeam = /* @__PURE__ */ new Map();
	const leagues = [...new Set(modelled.map((s) => s.fixture.leagueId))].slice(0, 10);
	setProgress(scanId, 68, "League tables…");
	await mapPool(leagues, 4, async (leagueId) => {
		if (Date.now() > deadline - 600) return;
		if (!shouldFetchLive("standings", coverageByLeague.get(leagueId))) return;
		const fx = modelled.find((s) => s.fixture.leagueId === leagueId)?.fixture;
		const season = inferSeason(fx?.kickoff ?? "", fx?.timestamp ?? 0);
		try {
			const { response } = await footballGet("/standings", {
				league: leagueId,
				season
			}, {
				apiKey,
				ttl: STANDINGS_TTL_MS,
				deadline,
				gen
			});
			const rows = extractStandings(response);
			if (rows.length) standingsByLeague.set(leagueId, rows);
		} catch {}
	});
	const teamIds = [];
	const seenTeam = /* @__PURE__ */ new Set();
	for (const s of modelled) for (const id of [s.fixture.homeId, s.fixture.awayId]) {
		if (seenTeam.has(id)) continue;
		seenTeam.add(id);
		teamIds.push(id);
	}
	const lastTeams = teamIds.slice(0, 28);
	setProgress(scanId, 74, "Last-20 samples…");
	await mapPool(lastTeams, 4, async (teamId) => {
		if (Date.now() > deadline - 600) return;
		const fx = modelled.find((s) => s.fixture.homeId === teamId || s.fixture.awayId === teamId)?.fixture;
		const season = inferSeason(fx?.kickoff ?? "", fx?.timestamp ?? 0);
		try {
			const { response } = await footballGet("/fixtures", {
				team: teamId,
				last: 20,
				season
			}, {
				apiKey,
				ttl: LAST5_TTL_MS,
				deadline,
				gen
			});
			const asOf = featureCutoffUnix(fx?.timestamp ?? 0);
			lastByTeam.set(teamId, finishedSamples(response, teamId, asOf, 20));
		} catch {}
	});
	const statTeams = teamIds.slice(0, 28);
	setProgress(scanId, 80, "Season statistics…");
	await mapPool(statTeams, 4, async (teamId) => {
		if (Date.now() > deadline - 500) return;
		const fx = modelled.find((s) => s.fixture.homeId === teamId || s.fixture.awayId === teamId)?.fixture;
		if (!fx) return;
		if (!shouldFetchLive("teamStats", coverageByLeague.get(fx.leagueId))) return;
		const season = inferSeason(fx.kickoff, fx.timestamp);
		try {
			const { response } = await footballGet("/teams/statistics", {
				team: teamId,
				league: fx.leagueId,
				season
			}, {
				apiKey,
				ttl: TEAM_STATS_TTL_MS,
				deadline,
				gen
			});
			const st = extractTeamStatistics(response, teamId);
			if (st) statsByTeam.set(teamId, st);
		} catch {}
	});
	const cornerNeed = modelled.filter((s) => (s.markets?.corners?.length ?? 0) > 0);
	const cornerJobs = [];
	const seenCornerFx = /* @__PURE__ */ new Set();
	for (const s of cornerNeed) {
		const cov = coverageByLeague.get(s.fixture.leagueId);
		if (!shouldFetchLive("fixtureStats", cov, { needCorners: true })) continue;
		for (const teamId of [s.fixture.homeId, s.fixture.awayId]) {
			if (statsByTeam.get(teamId)?.cornersPerMatch != null) continue;
			const samples = lastByTeam.get(teamId) ?? [];
			for (const row of samples.slice(0, CORNER_SAMPLE_N)) {
				const fid = row.fixtureId ?? 0;
				if (fid <= 0 || seenCornerFx.has(fid)) continue;
				seenCornerFx.add(fid);
				cornerJobs.push({
					id: fid,
					teamId,
					opponentId: row.opponentId,
					home: row.home
				});
				if (cornerJobs.length >= MAX_CORNER_STAT_FIXTURES) break;
			}
			if (cornerJobs.length >= MAX_CORNER_STAT_FIXTURES) break;
		}
		if (cornerJobs.length >= MAX_CORNER_STAT_FIXTURES) break;
	}
	const cornerBags = /* @__PURE__ */ new Map();
	if (cornerJobs.length) {
		setProgress(scanId, 82, "Corner counts…");
		await mapPool(cornerJobs, 4, async (row) => {
			if (Date.now() > deadline - 450) return;
			try {
				const { response } = await footballGet("/fixtures/statistics", { fixture: row.id }, {
					apiKey,
					ttl: FIXTURE_STATS_TTL_MS,
					deadline,
					gen
				});
				const map = extractFixtureCornerMap(response);
				const mine = map.get(row.teamId);
				const opp = map.get(row.opponentId);
				if (mine == null || opp == null) return;
				const bag = cornerBags.get(row.teamId) ?? [];
				bag.push({
					home: row.home,
					for: mine,
					against: opp
				});
				cornerBags.set(row.teamId, bag);
			} catch {}
		});
		for (const [teamId, rows] of cornerBags) {
			const rates = cornerRatesFromSamples(rows);
			if (!rates?.forPerMatch) continue;
			const cur = statsByTeam.get(teamId);
			const n = rates.n ?? rows.length;
			const base = cur ?? {
				teamId,
				played: n,
				playedHome: 0,
				playedAway: 0,
				gfHome: null,
				gaHome: null,
				gfAway: null,
				gaAway: null,
				failedToScore: null,
				failedToScoreHome: null,
				failedToScoreAway: null,
				cleanSheet: null,
				cleanSheetHome: null,
				cleanSheetAway: null,
				form: null,
				over15: null,
				over25: null,
				over15For: null,
				over25For: null,
				earlyShare: null,
				lateShare: null
			};
			if (base.cornersPerMatch == null) statsByTeam.set(teamId, {
				...base,
				cornersPerMatch: rates.forPerMatch,
				cornersAgainstPerMatch: rates.againstPerMatch,
				cornersForHome: rates.forHome,
				cornersForAway: rates.forAway,
				cornersAgainstHome: rates.againstHome,
				cornersAgainstAway: rates.againstAway,
				cornersVmr: rates.vmr ?? null
			});
			else statsByTeam.set(teamId, {
				...base,
				cornersPerMatch: .55 * (base.cornersPerMatch ?? rates.forPerMatch) + .45 * rates.forPerMatch,
				cornersAgainstPerMatch: base.cornersAgainstPerMatch != null && rates.againstPerMatch != null ? .55 * base.cornersAgainstPerMatch + .45 * rates.againstPerMatch : base.cornersAgainstPerMatch ?? rates.againstPerMatch,
				cornersForHome: rates.forHome ?? base.cornersForHome,
				cornersForAway: rates.forAway ?? base.cornersForAway,
				cornersAgainstHome: rates.againstHome ?? base.cornersAgainstHome,
				cornersAgainstAway: rates.againstAway ?? base.cornersAgainstAway,
				cornersVmr: rates.vmr ?? base.cornersVmr ?? null
			});
		}
	}
	const needH2h = modelled.filter((s) => {
		const n = preds.get(s.fixture.fixtureId)?.h2h?.length ?? 0;
		const lastH = lastByTeam.get(s.fixture.homeId)?.length ?? 0;
		const lastA = lastByTeam.get(s.fixture.awayId)?.length ?? 0;
		return shouldFetchLive("h2h", coverageByLeague.get(s.fixture.leagueId), {
			h2hN: n,
			lastNHome: lastH,
			lastNAway: lastA
		});
	}).slice(0, 36);
	setProgress(scanId, 84, "H2H backfill…");
	await mapPool(needH2h, 4, async (seed) => {
		if (Date.now() > deadline - 400) return;
		try {
			const { response } = await footballGet("/fixtures/headtohead", {
				h2h: `${seed.fixture.homeId}-${seed.fixture.awayId}`,
				last: 10
			}, {
				apiKey,
				ttl: H2H_TTL_MS,
				deadline,
				gen
			});
			const extra = extractH2hFixtures(response);
			const cur = preds.get(seed.fixture.fixtureId) ?? emptyPrediction(seed.fixture.fixtureId);
			preds.set(seed.fixture.fixtureId, {
				...cur,
				h2h: mergeH2h(cur.h2h ?? [], extra)
			});
		} catch {}
	});
	const lineupSeeds = modelled.filter((s) => {
		const mins = s.fixture.timestamp ? (s.fixture.timestamp * 1e3 - Date.now()) / 6e4 : 999;
		return shouldFetchLive("lineups", coverageByLeague.get(s.fixture.leagueId), { minutesToKick: mins });
	}).slice(0, 8);
	setProgress(scanId, 86, "Confirmed XIs…");
	await mapPool(lineupSeeds, 4, async (seed) => {
		if (Date.now() > deadline - 300) return;
		try {
			const { response } = await footballGet("/fixtures/lineups", { fixture: seed.fixture.fixtureId }, {
				apiKey,
				ttl: LINEUP_TTL_MS,
				deadline,
				gen
			});
			lineupsByFix.set(seed.fixture.fixtureId, extractLineups(response, seed.fixture.homeId, seed.fixture.awayId));
		} catch {}
	});
	const playerTeams = [];
	const seenPlayerTeam = /* @__PURE__ */ new Set();
	for (const s of modelled) {
		if (!(s.markets?.playerGa?.length)) continue;
		const xi = lineupsByFix.get(s.fixture.fixtureId);
		if (!xi?.home.confirmed && !xi?.away.confirmed) continue;
		if (!shouldFetchLive("players", coverageByLeague.get(s.fixture.leagueId), { needPlayers: true })) continue;
		for (const teamId of [s.fixture.homeId, s.fixture.awayId]) {
			if (seenPlayerTeam.has(teamId)) continue;
			seenPlayerTeam.add(teamId);
			playerTeams.push({
				teamId,
				leagueId: s.fixture.leagueId,
				seasonKick: s.fixture.kickoff,
				seasonTs: s.fixture.timestamp
			});
			if (playerTeams.length >= MAX_PLAYER_TEAMS) break;
		}
		if (playerTeams.length >= MAX_PLAYER_TEAMS) break;
	}
	if (playerTeams.length) {
		setProgress(scanId, 88, "Player minutes…");
		await mapPool(playerTeams, 4, async (row) => {
			if (Date.now() > deadline - 280) return;
			const season = inferSeason(row.seasonKick, row.seasonTs);
			const acc = [];
			for (const page of [1, 2]) {
				try {
					const { response, paging } = await footballGet("/players", {
						team: row.teamId,
						season,
						page
					}, {
						apiKey,
						ttl: PLAYERS_TTL_MS,
						deadline,
						gen
					});
					acc.push(...extractPlayerSeason(response, row.teamId));
					if ((paging?.current ?? page) >= (paging?.total ?? page)) break;
				} catch {
					break;
				}
			}
			if (acc.length) playersByTeam.set(row.teamId, acc);
		});
	}
	for (const seed of modelled) {
		const fx = seed.fixture;
		let pred = preds.get(fx.fixtureId) ?? emptyPrediction(fx.fixtureId);
		const table = standingsByLeague.get(fx.leagueId);
		pred = applyStandings(pred, table ? standingByTeam(table, fx.homeId) : void 0, table ? standingByTeam(table, fx.awayId) : void 0);
		const homeAll = lastByTeam.get(fx.homeId) ?? [];
		const awayAll = lastByTeam.get(fx.awayId) ?? [];
		const homeSamples = samplesForMatch(homeAll, fx.leagueId);
		const awaySamples = samplesForMatch(awayAll, fx.leagueId);
		if (homeSamples.length) {
			const hw = rollWindow(homeSamples, 5);
			const hv = rollWindow(homeSamples, 12, true);
			const form = homeSamples.slice(0, 5).map((s) => s.gf > s.ga ? "W" : s.gf < s.ga ? "L" : "D").join("");
			pred = applyTeamSample(pred, "home", {
				forAvg: hw.gf,
				againstAvg: hw.ga,
				form: form || pred.homeForm
			}, {
				forAvg: hv.gf,
				againstAvg: hv.ga,
				form: null
			});
		}
		if (awaySamples.length) {
			const aw = rollWindow(awaySamples, 5);
			const av = rollWindow(awaySamples, 12, false);
			const form = awaySamples.slice(0, 5).map((s) => s.gf > s.ga ? "W" : s.gf < s.ga ? "L" : "D").join("");
			pred = applyTeamSample(pred, "away", {
				forAvg: aw.gf,
				againstAvg: aw.ga,
				form: form || pred.awayForm
			}, {
				forAvg: av.gf,
				againstAvg: av.ga,
				form: null
			});
		}
		const homeStats = statsByTeam.get(fx.homeId) ?? null;
		const awayStats = statsByTeam.get(fx.awayId) ?? null;
		const env = leagueEnvFromStandings(table);
		const cov = coverageByLeague.get(fx.leagueId);
		const snap = buildSnapshot({
			homeSamples: homeAll,
			awaySamples: awayAll,
			homeStats,
			awayStats,
			table,
			leagueGa: env ? env.total / 2 : leagueExpectedTotal(fx.leagueId) / 2,
			h2hN: pred.h2h?.length ?? 0,
			hasInjuries: Boolean(cov?.injuries && hasInjuryFeed || injuryKnown.has(fx.fixtureId)),
			hasOdds: true,
			coverage: cov?.score,
			lineups: lineupsByFix.has(fx.fixtureId)
		});
		const homeMicro = rollWindow(homeSamples, 5);
		const awayMicro = rollWindow(awaySamples, 5);
		const h5 = last5Rates(homeSamples, 5);
		const a5 = last5Rates(awaySamples, 5);
		pred = {
			...pred,
			homeStats,
			awayStats,
			homeSeasonForHome: pred.homeSeasonForHome ?? homeStats?.gfHome ?? null,
			homeSeasonAgainstHome: pred.homeSeasonAgainstHome ?? homeStats?.gaHome ?? null,
			awaySeasonForAway: pred.awaySeasonForAway ?? awayStats?.gfAway ?? null,
			awaySeasonAgainstAway: pred.awaySeasonAgainstAway ?? awayStats?.gaAway ?? null,
			homeFts: h5.n >= 4 ? h5.fts : snap.home.failedToScore,
			awayFts: a5.n >= 4 ? a5.fts : snap.away.failedToScore,
			homeCs: h5.n >= 4 ? h5.cs : snap.home.cleanSheet,
			awayCs: a5.n >= 4 ? a5.cs : snap.away.cleanSheet,
			homeAdjAttack: snap.home.adjAttack,
			homeAdjDefense: snap.home.adjDefense,
			awayAdjAttack: snap.away.adjAttack,
			awayAdjDefense: snap.away.adjDefense,
			homeVenueFor: snap.home.venueGf ?? pred.homeVenueFor,
			homeVenueAgainst: snap.home.venueGa ?? pred.homeVenueAgainst,
			awayVenueFor: snap.away.venueGf ?? pred.awayVenueFor,
			awayVenueAgainst: snap.away.venueGa ?? pred.awayVenueAgainst,
			homeOver15: h5.n >= 4 ? h5.over15 : snap.home.over15,
			awayOver15: a5.n >= 4 ? a5.over15 : snap.away.over15,
			homeOver15For: homeStats?.over15For ?? null,
			awayOver15For: awayStats?.over15For ?? null,
			homeEarlyShare: homeStats?.earlyShare ?? null,
			homeLateShare: homeStats?.lateShare ?? null,
			awayEarlyShare: awayStats?.earlyShare ?? null,
			awayLateShare: awayStats?.lateShare ?? null,
			homeLast5: pred.homeLast5,
			awayLast5: pred.awayLast5,
			homeMicroFor: homeMicro.gf,
			homeMicroAgainst: homeMicro.ga,
			awayMicroFor: awayMicro.gf,
			awayMicroAgainst: awayMicro.ga,
			homeBtts: h5.n >= 4 ? h5.btts : snap.home.btts,
			awayBtts: a5.n >= 4 ? a5.btts : snap.away.btts,
			homeLast5Over25: h5.over25,
			awayLast5Over25: a5.over25,
			lastNHome: snap.home.n,
			lastNAway: snap.away.n,
			homeSma5: smaRate(homeSamples, 5, "gf"),
			homeSma20: smaRate(homeSamples, 20, "gf"),
			homeSma20Against: smaRate(homeSamples, 20, "ga"),
			homeEwma5: snap.homeLatent.ewma5,
			homeEwma20: snap.homeLatent.ewma20,
			homeEma20: emaSpanRate(homeSamples, 20, "gf"),
			awaySma5: smaRate(awaySamples, 5, "gf"),
			awaySma20: smaRate(awaySamples, 20, "gf"),
			awaySma20Against: smaRate(awaySamples, 20, "ga"),
			awayEwma5: snap.awayLatent.ewma5,
			awayEwma20: snap.awayLatent.ewma20,
			awayEma20: emaSpanRate(awaySamples, 20, "gf"),
			leagueEnvHome: env?.home ?? null,
			leagueEnvAway: env?.away ?? null,
			homeScoringStreak: snap.home.scoringStreak,
			awayScoringStreak: snap.away.scoringStreak,
			homeFailedStreak: snap.home.failedStreak,
			awayFailedStreak: snap.away.failedStreak,
			homeCleanStreak: snap.home.cleanStreak,
			awayCleanStreak: snap.away.cleanStreak,
			homeAttack: snap.homeLatent.attack,
			homeDefense: snap.homeLatent.defense,
			awayAttack: snap.awayLatent.attack,
			awayDefense: snap.awayLatent.defense,
			homeMomGf: snap.homeLatent.momentum,
			awayMomGf: snap.awayLatent.momentum,
			homeRegress: snap.homeLatent.regress,
			awayRegress: snap.awayLatent.regress,
			homeAttackVar: snap.homeLatent.attackVar,
			awayAttackVar: snap.awayLatent.attackVar,
			homeDefenseVar: snap.homeLatent.defenseVar,
			awayDefenseVar: snap.awayLatent.defenseVar,
			injuriesKnown: Boolean(cov?.injuries && hasInjuryFeed || injuryKnown.has(fx.fixtureId)),
			bttsCoverage: marketCoverageFromFlags(cov, "btts"),
			winCoverage: marketCoverageFromFlags(cov, "win"),
			ouCoverage: marketCoverageFromFlags(cov, "ou"),
			coverageScore: cov?.score ?? pred.coverageScore,
			quality: snap.quality,
			grade: snap.grade
		};
		preds.set(fx.fixtureId, pred);
	}
	notes.push(`Match data: ${standingsByLeague.size} tables, ${lastByTeam.size} last-20 samples, ${statsByTeam.size} season stats, H2H backfill ${needH2h.length}, ${lineupsByFix.size} confirmed XIs, ${playersByTeam.size} player books, ${cornerBags.size} corner samples.`);
	return {
		lineupsByFix,
		playersByTeam
	};
}
export function scoreFixture(input) {
	const { fixture, markets, pred } = input;
	const now = Date.now();
	const h2h = (pred?.h2h ?? []).filter((h) => h.finished && (!fixture.timestamp || h.timestamp < fixture.timestamp - 300)).map((h) => ({
		homeGoals: h.homeGoals,
		awayGoals: h.awayGoals,
		homeIsCurrentHome: h.homeId === fixture.homeId,
		daysAgo: h.timestamp ? Math.max(0, ((fixture.timestamp || now / 1e3) - h.timestamp) / 86400) : 180
	}));
	const means = leagueScoringMeans(fixture.leagueId);
	const lambdaInput = {
		homeLast5For: pred?.homeLast5?.forAvg ?? null,
		homeLast5Against: pred?.homeLast5?.againstAvg ?? null,
		awayLast5For: pred?.awayLast5?.forAvg ?? null,
		awayLast5Against: pred?.awayLast5?.againstAvg ?? null,
		homeSeasonForHome: pred?.homeSeasonForHome ?? null,
		homeSeasonAgainstHome: pred?.homeSeasonAgainstHome ?? null,
		awaySeasonForAway: pred?.awaySeasonForAway ?? null,
		awaySeasonAgainstAway: pred?.awaySeasonAgainstAway ?? null,
		poissonShareHome: pred?.poissonShareHome ?? null,
		homePlayed: pred?.homePlayed ?? null,
		awayPlayed: pred?.awayPlayed ?? null,
		homeForm: pred?.homeForm ?? pred?.homeLast5?.form ?? null,
		awayForm: pred?.awayForm ?? pred?.awayLast5?.form ?? null,
		h2h,
		leagueAvgTotal: leagueExpectedTotal(fixture.leagueId),
		leagueAvgHome: means.home,
		leagueAvgAway: means.away,
		homeRank: pred?.homeRank ?? null,
		awayRank: pred?.awayRank ?? null,
		homeGD: pred?.homeGD ?? null,
		awayGD: pred?.awayGD ?? null,
		homeVenueFor: pred?.homeVenueFor ?? null,
		homeVenueAgainst: pred?.homeVenueAgainst ?? null,
		awayVenueFor: pred?.awayVenueFor ?? null,
		awayVenueAgainst: pred?.awayVenueAgainst ?? null,
		homeAdjAttack: pred?.homeAdjAttack ?? null,
		homeAdjDefense: pred?.homeAdjDefense ?? null,
		awayAdjAttack: pred?.awayAdjAttack ?? null,
		awayAdjDefense: pred?.awayAdjDefense ?? null,
		homeFts: pred?.homeFts ?? null,
		awayFts: pred?.awayFts ?? null,
		homeCs: pred?.homeCs ?? null,
		awayCs: pred?.awayCs ?? null,
		homeOver15For: pred?.homeOver15For ?? null,
		awayOver15For: pred?.awayOver15For ?? null,
		homeLateShare: pred?.homeLateShare ?? null,
		awayLateShare: pred?.awayLateShare ?? null,
		homeEarlyShare: pred?.homeEarlyShare ?? null,
		awayEarlyShare: pred?.awayEarlyShare ?? null,
		injuryHome: 0,
		injuryAway: 0,
		injuryAttackHome: input.injuryHome.attack,
		injuryDefenseHome: input.injuryHome.defense,
		injuryKeeperHome: input.injuryHome.keeper,
		injuryAttackAway: input.injuryAway.attack,
		injuryDefenseAway: input.injuryAway.defense,
		injuryKeeperAway: input.injuryAway.keeper,
		lineupAttackHome: input.lineupHome.attack,
		lineupDefenseHome: input.lineupHome.defense,
		lineupKeeperHome: input.lineupHome.keeper,
		lineupAttackAway: input.lineupAway.attack,
		lineupDefenseAway: input.lineupAway.defense,
		lineupKeeperAway: input.lineupAway.keeper,
		lineupConfirmed: input.lineupHome.confirmed || input.lineupAway.confirmed,
		lineupConfirmedHome: input.lineupHome.confirmed,
		lineupConfirmedAway: input.lineupAway.confirmed,
		dataQuality: pred?.quality ?? .3,
		homeMicroFor: pred?.homeMicroFor ?? null,
		homeMicroAgainst: pred?.homeMicroAgainst ?? null,
		awayMicroFor: pred?.awayMicroFor ?? null,
		awayMicroAgainst: pred?.awayMicroAgainst ?? null,
		homeBtts: pred?.homeBtts ?? null,
		awayBtts: pred?.awayBtts ?? null,
		lastNHome: pred?.lastNHome,
		lastNAway: pred?.lastNAway,
		leagueEnvHome: pred?.leagueEnvHome ?? null,
		leagueEnvAway: pred?.leagueEnvAway ?? null,
		homeScoringStreak: pred?.homeScoringStreak ?? null,
		awayScoringStreak: pred?.awayScoringStreak ?? null,
		homeFailedStreak: pred?.homeFailedStreak ?? null,
		awayFailedStreak: pred?.awayFailedStreak ?? null,
		leagueSize: pred?.leagueSize,
		homeAttack: pred?.homeAttack ?? null,
		homeDefense: pred?.homeDefense ?? null,
		awayAttack: pred?.awayAttack ?? null,
		awayDefense: pred?.awayDefense ?? null,
		homeMomGf: pred?.homeMomGf ?? null,
		awayMomGf: pred?.awayMomGf ?? null,
		homeRegress: pred?.homeRegress ?? null,
		awayRegress: pred?.awayRegress ?? null,
		homeAttackVar: pred?.homeAttackVar ?? null,
		awayAttackVar: pred?.awayAttackVar ?? null,
		homeDefenseVar: pred?.homeDefenseVar ?? null,
		awayDefenseVar: pred?.awayDefenseVar ?? null,
		homeXgShots: pred?.homeXgShots ?? null,
		awayXgShots: pred?.awayXgShots ?? null,
		homeTorvaneyFor: pred?.homeTorvaneyFor ?? null,
		awayTorvaneyFor: pred?.awayTorvaneyFor ?? null,
		homeSma20For: pred?.homeSma20 ?? null,
		homeSma20Against: pred?.homeSma20Against ?? null,
		awaySma20For: pred?.awaySma20 ?? null,
		awaySma20Against: pred?.awaySma20Against ?? null,
		homeSma20N: pred?.lastNHome ?? null,
		awaySma20N: pred?.lastNAway ?? null
	};
	const hist = estimateLambdas(lambdaInput);
	const histW = histWeightFromData(lambdaInput);
	const pi = piToLambdas(walkPiRatings(h2h), means.home, means.away);
	const shinH0 = markets.winner.home?.shinImplied ?? null;
	const piMass = pi.lambdaH + pi.lambdaA > 0 ? pi.lambdaH / (pi.lambdaH + pi.lambdaA) : .5;
	let piW = 0;
	if (h2h.length >= 2) piW = borsH2hWeight(clamp(.18 * (1.15 - histW), .06, .18), piMass, shinH0);
	let lambdaH = (1 - piW) * hist.lambdaH + piW * pi.lambdaH;
	let lambdaA = (1 - piW) * hist.lambdaA + piW * pi.lambdaA;
	let bookTrusted = false;
	const shinH = markets.winner.home?.shinImplied;
	const shinD = markets.winner.draw?.shinImplied;
	const shinA = markets.winner.away?.shinImplied;
	if (shinH != null && shinD != null && shinA != null) {
		const mkt = skellamLambdasFrom1x2(shinH, shinD, shinA, DC_RHO);
		if (marketAgreesWithHistory(lambdaH, lambdaA, mkt.lambdaH, mkt.lambdaA)) {
			const mixed = egidiMix(lambdaH, lambdaA, mkt.lambdaH, mkt.lambdaA, histW);
			lambdaH = mixed.lambdaH;
			lambdaA = mixed.lambdaA;
			bookTrusted = true;
		}
	}
	const over25P = markets.ou25.over?.shinImplied;
	if (over25P != null) {
		const totMkt = totalFromOver25(over25P);
		const tot = lambdaH + lambdaA;
		if (tot > .4 && Math.abs(totMkt - tot) / tot < .38) {
			const scale = (.45 * tot + .55 * totMkt) / tot;
			lambdaH *= scale;
			lambdaA *= scale;
			bookTrusted = true;
		}
	}
	lambdaH = clamp(lambdaH, .32, 3.35);
	lambdaA = clamp(lambdaA, .24, 3.1);
	const lambdas = {
		lambdaH,
		lambdaA,
		overdispersionR: hist.overdispersionR,
		lambdaSeH: hist.lambdaSeH,
		lambdaSeA: hist.lambdaSeA
	};
	const bttsFails = bttsFailureModes({
		lambdaH,
		lambdaA,
		homeFts: pred?.homeFts ?? null,
		awayFts: pred?.awayFts ?? null,
		homeCs: pred?.homeCs ?? null,
		awayCs: pred?.awayCs ?? null,
		homeBtts: pred?.homeBtts ?? null,
		awayBtts: pred?.awayBtts ?? null,
		injuryAttackHome: input.injuryHome.attack,
		injuryAttackAway: input.injuryAway.attack,
		injuryKeeperHome: input.injuryHome.keeper,
		injuryKeeperAway: input.injuryAway.keeper,
		leagueEnvTotal: pred?.leagueEnvHome != null && pred.leagueEnvAway != null ? pred.leagueEnvHome + pred.leagueEnvAway : null,
		homeFailedStreak: pred?.homeFailedStreak ?? null,
		awayFailedStreak: pred?.awayFailedStreak ?? null
	});
	const bttsFailSev = bttsFailureSeverity(bttsFails);
	const rho = matchRho(lambdaH, lambdaA);
	const grid = jointGrid(lambdas.lambdaH, lambdas.lambdaA, rho);
	const maherG = maherGrid(lambdas.lambdaH, lambdas.lambdaA);
	const karlisG = bivariateGrid(lambdas.lambdaH, lambdas.lambdaA);
	const nbG = negBinGrid(lambdas.lambdaH, lambdas.lambdaA, lambdas.overdispersionR);
	const copG = copulaGrid(lambdas.lambdaH, lambdas.lambdaA);
	const eloHome = walkElo(pred?.homeForm ?? pred?.homeLast5?.form ?? null);
	const eloAway = walkElo(pred?.awayForm ?? pred?.awayLast5?.form ?? null);
	const eloL = eloToLambdas(eloHome, eloAway);
	const wrH = winRateFromForm(pred?.homeForm ?? pred?.homeLast5?.form ?? null);
	const wrA = winRateFromForm(pred?.awayForm ?? pred?.awayLast5?.form ?? null);
	let ratingH = eloL.lambdaH;
	let ratingA = eloL.lambdaA;
	if (h2h.length >= 2) {
		ratingH = .6 * pi.lambdaH + .4 * eloL.lambdaH;
		ratingA = .6 * pi.lambdaA + .4 * eloL.lambdaA;
	}
	if (wrH != null && wrA != null && pred?.homeRank != null && pred.awayRank != null) {
		const ol = orderedLogitProbs(wrH, wrA, pred.homeRank - pred.awayRank);
		const olL = skellamLambdasFrom1x2(ol.home, ol.draw, ol.away, DC_RHO);
		ratingH = .75 * ratingH + .25 * olL.lambdaH;
		ratingA = .75 * ratingA + .25 * olL.lambdaA;
	}
	const eloGrid = jointGrid(ratingH, ratingA, rho);
	const eloM = marketsFromGrid(eloGrid);
	const h2hNraw = h2h.length;
	let h2hW = 0;
	let h2hHomeHits = 0;
	let h2hAwayHits = 0;
	let h2hBttsHits = 0;
	let h2hOver15 = 0;
	let h2hOver25 = 0;
	let h2hOver05 = 0;
	let h2hOver35 = 0;
	let h2hOver45 = 0;
	let h2hHomeScore = 0;
	let h2hAwayScore = 0;
	let h2hWins = 0;
	let h2hDraws = 0;
	let h2hLosses = 0;
	const csCounts = /* @__PURE__ */ new Map();
	for (const row of h2h) {
		const w = dcDecay(row.daysAgo);
		h2hW += w;
		const hg = row.homeIsCurrentHome ? row.homeGoals : row.awayGoals;
		const ag = row.homeIsCurrentHome ? row.awayGoals : row.homeGoals;
		if (hg > ag) {
			h2hHomeHits += w;
			h2hWins += 1;
		} else if (ag > hg) {
			h2hAwayHits += w;
			h2hLosses += 1;
		} else h2hDraws += 1;
		if (hg >= 1 && ag >= 1) h2hBttsHits += w;
		if (hg + ag >= 1) h2hOver05 += w;
		if (hg + ag >= 2) h2hOver15 += w;
		if (hg + ag >= 3) h2hOver25 += w;
		if (hg + ag >= 4) h2hOver35 += w;
		if (hg + ag >= 5) h2hOver45 += w;
		if (hg >= 1) h2hHomeScore += w;
		if (ag >= 1) h2hAwayScore += w;
		const key = `${hg}-${ag}`;
		csCounts.set(key, (csCounts.get(key) ?? 0) + w);
	}
	const h2hN = h2hW;
	const h2hRates = h2hMarketRates(h2h, 5);
	const shinPack = {
		home: shinH,
		draw: shinD,
		away: shinA,
		over25: over25P,
		over15: markets.ou15.over?.shinImplied,
		btts: markets.btts.yes?.shinImplied
	};
	const fused = fuseScoreReport({
		dc: grid,
		karlis: karlisG,
		copula: copG,
		negBin: nbG,
		elo: eloGrid,
		shin: shinPack
	});
	const fusedModel = fuseScoreReport({
		dc: grid,
		karlis: karlisG,
		copula: copG,
		negBin: nbG,
		elo: eloGrid
	});
	const preUnion = marketsFromGrid(fused.grid);
	const h2hDrawRate = h2hNraw > 0 ? h2hDraws / h2hNraw : 0;
	const rankGapAbs = pred?.homeRank != null && pred.awayRank != null ? Math.abs(pred.homeRank - pred.awayRank) : null;
	const drawExtra = naDrawBoost(shinD ?? null, preUnion.draw) + closeTableH2hDrawBoost(h2hDrawRate, rankGapAbs, h2hNraw);
	const unionG = inflateDraw(fused.grid, drawExtra);
	const modelG = inflateDraw(fusedModel.grid, drawExtra);
	const union = marketsFromGrid(unionG);
	const modelMk = marketsFromGrid(modelG);
	const maherM = marketsFromGrid(maherG);
	const karlisMk = marketsFromGrid(karlisG);
	const nbM = marketsFromGrid(nbG);
	const csGrid = unionG;
	const pH2hHome = h2hRates.n >= 4 && h2hRates.home != null ? h2hRates.home : betaShrink(h2hHomeHits, h2hN, union.home);
	const pH2hAway = h2hRates.n >= 4 && h2hRates.away != null ? h2hRates.away : betaShrink(h2hAwayHits, h2hN, union.away);
	const pH2hBtts = h2hRates.n >= 4 && h2hRates.btts != null ? h2hRates.btts : betaShrink(h2hBttsHits, h2hN, union.bttsYes);
	const pH2hOver15 = h2hRates.n >= 4 && h2hRates.over15 != null ? h2hRates.over15 : betaShrink(h2hOver15, h2hN, union.over15);
	const pH2hOver25 = h2hRates.n >= 4 && h2hRates.over25 != null ? h2hRates.over25 : betaShrink(h2hOver25, h2hN, union.over25);
	const pH2hOver05 = h2hN >= 4 ? betaShrink(h2hOver05, h2hN, union.over05) : union.over05;
	const pH2hOver35 = h2hN >= 4 ? betaShrink(h2hOver35, h2hN, union.over35) : union.over35;
	const pH2hOver45 = h2hN >= 4 ? betaShrink(h2hOver45, h2hN, union.over45) : union.over45;
	const pH2hHomeScore = h2hN >= 4 ? betaShrink(h2hHomeScore, h2hN, union.homeScore) : union.homeScore;
	const pH2hAwayScore = h2hN >= 4 ? betaShrink(h2hAwayScore, h2hN, union.awayScore) : union.awayScore;
	let apiHome = pred?.percentHome ?? union.home;
	let apiDraw = pred?.percentDraw ?? union.draw;
	let apiAway = pred?.percentAway ?? union.away;
	const apiSum = apiHome + apiDraw + apiAway || 1;
	apiHome /= apiSum;
	apiDraw /= apiSum;
	apiAway /= apiSum;
	const apiBtts = apiBttsProxy(apiHome, apiDraw, apiAway, union.bttsYes);
	const apiOu = apiLineToOver15(pred?.underOver ?? null);
	const apiOu25 = apiLineToOver25(pred?.underOver ?? null);
	const drawConc = drawConcentration(unionG);
	const lambdaGap = Math.abs(lambdas.lambdaH - lambdas.lambdaA);
	const dRisk = drawRiskScore({
		drawP: union.draw,
		lambdaGap,
		h2hDraw: h2hNraw >= 4 ? h2hDrawRate : null,
		h2hN: h2hNraw
	});
	const homeIsFav = union.home >= union.away;
	const uRisk = upsetRiskScore({
		favP: homeIsFav ? union.home : union.away,
		oppScoreP: homeIsFav ? union.awayScore : union.homeScore,
		favForm: homeIsFav ? wrH : wrA,
		lambdaGap
	});
	const xFlags = crossMarketFlags({
		home: union.home,
		draw: union.draw,
		away: union.away,
		bttsYes: union.bttsYes,
		over25: union.over25,
		homeScore: union.homeScore,
		awayScore: union.awayScore,
		scoreline: union.scoreline
	});
	const apiCsGrid = pred?.percentHome != null || pred?.percentDraw != null || pred?.percentAway != null ? tiltGridTo1x2(unionG, apiHome, apiDraw, apiAway) : unionG;
	const w = leagueWeight(fixture.leagueId, fixture.league, fixture.country, fixture.home, fixture.away);
	const liquid = isLiquidLeague(fixture.leagueId);
	const shinCs = shinCsImplied(markets.correctScores.filter((s) => (s.medianOdd ?? s.sharpOdd) != null).map((s) => ({
		score: s.selection,
		odd: s.medianOdd ?? s.sharpOdd ?? 0
	})), csGrid);
	const sides = [];
	if (markets.winner.home) sides.push({
		kind: "home",
		market: markets.winner.home
	});
	if (markets.winner.away) sides.push({
		kind: "away",
		market: markets.winner.away
	});
	if (markets.btts.yes) sides.push({
		kind: "btts_yes",
		market: markets.btts.yes
	});
	if (markets.btts.no) sides.push({
		kind: "btts_no",
		market: markets.btts.no
	});
	if (markets.ou15.over) sides.push({
		kind: "over_15",
		market: markets.ou15.over
	});
	if (markets.ou15.under) sides.push({
		kind: "under_15",
		market: markets.ou15.under
	});
	if (markets.ou25.over) sides.push({
		kind: "over_25",
		market: markets.ou25.over
	});
	if (markets.ou25.under) sides.push({
		kind: "under_25",
		market: markets.ou25.under
	});
	const csLines = pickCsLines(markets.correctScores, csGrid);
	if (csLines.length) for (const cs of csLines) sides.push({
		kind: "cs",
		market: cs
	});
	if (markets.winner.draw) sides.push({
		kind: "draw",
		market: markets.winner.draw
	});
	const dcM = markets.doubleChance;
	if (dcM?.["1x"]) sides.push({
		kind: "dc_1x",
		market: dcM["1x"]
	});
	if (dcM?.x2) sides.push({
		kind: "dc_x2",
		market: dcM.x2
	});
	if (dcM?.["12"]) sides.push({
		kind: "dc_12",
		market: dcM["12"]
	});
	if (markets.ou05?.over) sides.push({
		kind: "over_05",
		market: markets.ou05.over
	});
	if (markets.ou05?.under) sides.push({
		kind: "under_05",
		market: markets.ou05.under
	});
	if (markets.ou35?.over) sides.push({
		kind: "over_35",
		market: markets.ou35.over
	});
	if (markets.ou35?.under) sides.push({
		kind: "under_35",
		market: markets.ou35.under
	});
	if (markets.ou45?.over) sides.push({
		kind: "over_45",
		market: markets.ou45.over
	});
	if (markets.ou45?.under) sides.push({
		kind: "under_45",
		market: markets.ou45.under
	});
	if (markets.homeScore?.yes) sides.push({
		kind: "home_score",
		market: markets.homeScore.yes
	});
	if (markets.awayScore?.yes) sides.push({
		kind: "away_score",
		market: markets.awayScore.yes
	});
	if (markets.oddEven?.even) sides.push({
		kind: "odd_even",
		market: markets.oddEven.even
	});
	if (markets.oddEven?.odd) sides.push({
		kind: "odd_even",
		market: markets.oddEven.odd
	});
	for (const mg of markets.multiGoals ?? []) sides.push({
		kind: "multi_goals",
		market: mg
	});
	const ahPosted = (markets.asianHandicap ?? []).map((s) => {
		const parsed = parseAhSelection(s.selection);
		const odd = s.consensusOdd ?? s.sharpOdd;
		if (!parsed || odd == null || !(odd > 1)) return null;
		return {
			side: parsed.side,
			line: parsed.line,
			odd,
			market: s
		};
	}).filter((x) => Boolean(x));
	const bestAh = bestAhLine(unionG, ahPosted.map((r) => ({
		side: r.side,
		line: r.line,
		odd: r.odd
	})));
	if (bestAh) {
		const mkt = ahPosted.find((r) => r.side === bestAh.side && Math.abs(r.line - bestAh.line) < 1e-9)?.market;
		if (mkt) sides.push({
			kind: "ah",
			market: mkt
		});
	}
	let bestEh = null;
	for (const ehM of markets.europeanHandicap ?? []) {
		const parsed = parseEhSelection(ehM.selection);
		const odd = ehM.consensusOdd ?? ehM.sharpOdd;
		if (!parsed || odd == null || !(odd > 1)) continue;
		const dist = europeanFromGrid(unionG, parsed);
		const ev = (parsed.side === "home" ? dist.home : parsed.side === "away" ? dist.away : dist.draw) * odd - 1;
		if (ev <= 0) continue;
		if (!bestEh || ev > bestEh.ev) bestEh = {
			market: ehM,
			ev
		};
	}
	if (bestEh) sides.push({
		kind: "eh",
		market: bestEh.market
	});
	let bestAsianOu = null;
	for (const row of markets.ouAsian ?? []) {
		const cnt = parseCountSelection(row.selection);
		const odd = row.consensusOdd ?? row.sharpOdd;
		if (!cnt || odd == null || !(odd > 1)) continue;
		const outcome = asianTotalFromGrid(unionG, cnt.side, cnt.line);
		const ev = asianExpectedReturn(outcome, odd) - 1;
		if (ev <= 0) continue;
		if (!bestAsianOu || ev > bestAsianOu.ev) bestAsianOu = {
			market: row,
			ev
		};
	}
	if (bestAsianOu) sides.push({
		kind: "ou_asian",
		market: bestAsianOu.market
	});
	const cardsLam = totalCardsLambda(pred?.homeStats?.cardsPerMatch ?? null, pred?.awayStats?.cardsPerMatch ?? null);
	if (cardsLam != null) {
		let bestCard = null;
		for (const c of markets.cards ?? []) {
			const cnt = parseCountSelection(c.selection);
			const odd = c.consensusOdd ?? c.sharpOdd;
			if (!cnt || odd == null || !(odd > 1)) continue;
			const over = poissonOver(cardsLam, cnt.line);
			if (over == null) continue;
			const ev = (cnt.side === "over" ? over : 1 - over) * odd - 1;
			if (ev <= 0) continue;
			if (!bestCard || ev > bestCard.ev) bestCard = {
				market: c,
				ev
			};
		}
		if (bestCard) sides.push({
			kind: "cards",
			market: bestCard.market
		});
	}
	const cornersLamSplit = cornerLambdas({
		home: ratesFromTeamCorners(pred?.homeStats ?? null),
		away: ratesFromTeamCorners(pred?.awayStats ?? null)
	});
	const cornersLam = cornersLamSplit?.lambdaT ?? totalCornersLambda(pred?.homeStats?.cornersPerMatch ?? null, pred?.awayStats?.cornersPerMatch ?? null);
	const cornerGrid = cornersLamSplit ? bivariateCornerGrid(cornersLamSplit.lambdaH, cornersLamSplit.lambdaA, { vmr: cornersLamSplit.vmr }) : null;
	if (cornersLam != null) {
		const bestCorner = /* @__PURE__ */ new Map();
		for (const c of markets.corners ?? []) {
			const parsed = parseCornerMarket(c.selection);
			const odd = c.consensusOdd ?? c.sharpOdd;
			if (!parsed || odd == null || !(odd > 1)) continue;
			if (parsed.variant !== "total" && !cornersLamSplit) continue;
			let priced = null;
			if (cornersLamSplit && cornerGrid) priced = pCornerMarket(parsed, cornersLamSplit, cornerGrid);
			else if (parsed.variant === "total") {
				const over = poissonOver(cornersLam, parsed.line);
				if (over != null) {
					const p = parsed.side === "over" ? over : 1 - over;
					priced = {
						p,
						cover: null,
						ev: (o) => p * o - 1
					};
				}
			}
			if (!priced) continue;
			const ev = priced.ev(odd);
			if (ev <= 0) continue;
			const cur = bestCorner.get(parsed.variant);
			if (!cur || ev > cur.ev) bestCorner.set(parsed.variant, {
				market: c,
				ev
			});
		}
		for (const row of bestCorner.values()) sides.push({
			kind: "corners",
			market: row.market
		});
	}
	const playerBooks = markets.playerGa ?? [];
	if (playerBooks.length) {
		const homeStatsP = input.playersByTeam?.get(fixture.homeId) ?? [];
		const awayStatsP = input.playersByTeam?.get(fixture.awayId) ?? [];
		const homeXi = input.lineupHome.players ?? [];
		const awayXi = input.lineupAway.players ?? [];
		let bestPlayer = null;
		for (const row of playerBooks) {
			const parsed = parsePlayerGa(row.selection);
			const odd = row.consensusOdd ?? row.sharpOdd;
			if (!parsed || odd == null || !(odd > 1)) continue;
			const homeHit = matchPlayer(parsed.name, homeXi, homeStatsP);
			const awayHit = matchPlayer(parsed.name, awayXi, awayStatsP);
			const hit = homeHit.stats ? {
				...homeHit,
				side: "home"
			} : awayHit.stats ? {
				...awayHit,
				side: "away"
			} : null;
			if (!hit?.stats) continue;
			const onXi = Boolean(hit.player);
			const confirmed = hit.side === "home" ? input.lineupHome.confirmed : input.lineupAway.confirmed;
			const mins = expectedMinutes({
				confirmedStarter: confirmed && onXi,
				confirmedBench: confirmed && !onXi,
				minutes: hit.stats.minutes,
				appearances: hit.stats.appearances,
				starts: hit.stats.starts
			});
			if (mins == null) continue;
			const teamLam = hit.side === "home" ? lambdas.lambdaH : lambdas.lambdaA;
			const teamGf = hit.side === "home" ? pred?.homeStats?.gfHome ?? pred?.homeSeasonForHome ?? null : pred?.awayStats?.gfAway ?? pred?.awaySeasonForAway ?? null;
			const atk = playerAttackLambdas({
				stats: hit.stats,
				expectedMinutes: mins,
				teamLambda: teamLam,
				teamGfPer90: teamGf,
				pos: hit.player?.pos ?? hit.stats.position
			});
			if (!atk) continue;
			const joint = playerGoalOrAssist({
				lambdaG: atk.lambdaG,
				lambdaA: atk.lambdaA,
				expectedMinutes: mins
			});
			if (!joint) continue;
			const p = parsed.mode === "score" ? joint.pG : parsed.mode === "assist" ? joint.pA : joint.pOr;
			const ev = p * odd - 1;
			if (ev <= 0) continue;
			if (!bestPlayer || ev > bestPlayer.ev) bestPlayer = {
				market: row,
				ev
			};
		}
		if (bestPlayer) sides.push({
			kind: "player_ga",
			market: bestPlayer.market
		});
	}
	const perturbGrids = [
		.9,
		.95,
		1,
		1.05,
		1.1
	].map((s) => s === 1 ? unionG : jointGrid(lambdas.lambdaH * s, lambdas.lambdaA * s, rho));
	const out = [];
	for (const { kind, market } of sides) {
		if (market.sharpOdd == null && market.consensusOdd == null) continue;
		const odd = market.consensusOdd ?? market.sharpOdd ?? 0;
		if (!(odd > 1)) continue;
		if (kind !== "cs" && market.reliable === false && (market.bookCount ?? 0) >= 4) continue;
		if (!playableOdd(kind, odd)) continue;
		if (kind === "cs" && (pred?.grade === "UNUSABLE" || pred?.grade === "LOW_DATA")) continue;
		if ((kind === "over_15" || kind === "over_25" || kind === "over_35" || kind === "over_45" || kind === "ou_asian") && (apiOu.veto || apiOu25.veto)) continue;
		const fam = familyOf(kind);
		const mCov = fam === "btts" ? pred?.bttsCoverage : fam === "win" ? pred?.winCoverage : fam === "ou" ? pred?.ouCoverage : pred?.coverageScore;
		if (kind !== "cs" && mCov != null && mCov < .18) continue;
		let dcP = pForKind(kind, kind === "cs" || kind === "draw" || kind.startsWith("dc_") ? union : modelMk) || 0;
		let eloP = pForKind(kind, eloM) || 0;
		let maher = pForKind(kind, maherM) || 0;
		let karlis = pForKind(kind, karlisMk) || 0;
		let neg = pForKind(kind, nbM) || 0;
		let apiP = dcP;
		let h2hP = dcP;
		let csCell = union.scorelineP;
		let csShin = null;
		let structural = dcP;
		let ahEv = null;
		let ahCover = null;
		let countLambda = null;
		let expectedMins = null;
		let playerOrP = null;
		const hasApi1x2 = pred?.percentHome != null || pred?.percentDraw != null || pred?.percentAway != null;
		const hasApiOu = Boolean(pred?.underOver);
		if (kind === "home") {
			apiP = hasApi1x2 ? apiHome : dcP;
			h2hP = h2hRates.n >= 4 ? pH2hHome : dcP;
		} else if (kind === "away") {
			apiP = hasApi1x2 ? apiAway : dcP;
			h2hP = h2hRates.n >= 4 ? pH2hAway : dcP;
		} else if (kind === "btts_yes") {
			apiP = hasApi1x2 ? apiBtts : dcP;
			h2hP = h2hRates.n >= 4 ? pH2hBtts : dcP;
		} else if (kind === "btts_no") {
			apiP = hasApi1x2 ? 1 - apiBtts : dcP;
			h2hP = h2hRates.n >= 4 ? 1 - pH2hBtts : dcP;
		} else if (kind === "over_15") {
			apiP = hasApiOu ? apiOu.p : dcP;
			h2hP = h2hRates.n >= 4 ? pH2hOver15 : dcP;
		} else if (kind === "under_15") {
			apiP = hasApiOu ? 1 - apiOu.p : dcP;
			h2hP = h2hRates.n >= 4 ? 1 - pH2hOver15 : dcP;
		} else if (kind === "over_25") {
			apiP = hasApiOu ? apiOu25.p : dcP;
			h2hP = h2hRates.n >= 4 ? pH2hOver25 : dcP;
		} else if (kind === "under_25") {
			apiP = hasApiOu ? 1 - apiOu25.p : dcP;
			h2hP = h2hRates.n >= 4 ? 1 - pH2hOver25 : dcP;
		} else if (kind === "draw") {
			apiP = hasApi1x2 ? apiDraw : dcP;
			h2hP = h2hNraw >= 4 ? h2hDrawRate : dcP;
		} else if (kind === "dc_1x") {
			apiP = hasApi1x2 ? apiHome + apiDraw : dcP;
			h2hP = h2hRates.n >= 4 ? pH2hHome + (1 - pH2hHome - pH2hAway) : dcP;
		} else if (kind === "dc_x2") {
			apiP = hasApi1x2 ? apiDraw + apiAway : dcP;
			h2hP = h2hRates.n >= 4 ? pH2hAway + (1 - pH2hHome - pH2hAway) : dcP;
		} else if (kind === "dc_12") {
			apiP = hasApi1x2 ? apiHome + apiAway : dcP;
			h2hP = h2hRates.n >= 4 ? pH2hHome + pH2hAway : dcP;
		} else if (kind === "over_05") {
			apiP = dcP;
			h2hP = h2hN >= 4 ? pH2hOver05 : dcP;
		} else if (kind === "under_05") {
			apiP = dcP;
			h2hP = h2hN >= 4 ? 1 - pH2hOver05 : dcP;
		} else if (kind === "over_35") {
			apiP = dcP;
			h2hP = h2hN >= 4 ? pH2hOver35 : dcP;
		} else if (kind === "under_35") {
			apiP = dcP;
			h2hP = h2hN >= 4 ? 1 - pH2hOver35 : dcP;
		} else if (kind === "over_45") {
			apiP = dcP;
			h2hP = h2hN >= 4 ? pH2hOver45 : dcP;
		} else if (kind === "under_45") {
			apiP = dcP;
			h2hP = h2hN >= 4 ? 1 - pH2hOver45 : dcP;
		} else if (kind === "home_score") {
			apiP = dcP;
			h2hP = h2hN >= 4 ? pH2hHomeScore : dcP;
		} else if (kind === "away_score") {
			apiP = dcP;
			h2hP = h2hN >= 4 ? pH2hAwayScore : dcP;
		} else if (kind === "ah") {
			const ah = parseAhSelection(market.selection);
			if (ah) {
				const outcome = asianFromGrid(unionG, ah.side, ah.line);
				dcP = asianCoverP(outcome);
				eloP = asianCoverP(asianFromGrid(eloGrid, ah.side, ah.line));
				maher = asianCoverP(asianFromGrid(maherG, ah.side, ah.line));
				karlis = asianCoverP(asianFromGrid(karlisG, ah.side, ah.line));
				neg = asianCoverP(asianFromGrid(nbG, ah.side, ah.line));
				apiP = dcP;
				h2hP = dcP;
				structural = dcP;
				ahCover = dcP;
				ahEv = asianExpectedReturn(outcome, odd) - 1;
			}
		} else if (kind === "eh") {
			const eh = parseEhSelection(market.selection);
			if (eh) {
				const dist = europeanFromGrid(unionG, eh);
				dcP = eh.side === "home" ? dist.home : eh.side === "away" ? dist.away : dist.draw;
				const eloDist = europeanFromGrid(eloGrid, eh);
				eloP = eh.side === "home" ? eloDist.home : eh.side === "away" ? eloDist.away : eloDist.draw;
				maher = dcP;
				karlis = dcP;
				neg = dcP;
				apiP = dcP;
				h2hP = dcP;
				structural = dcP;
			}
		} else if (kind === "ou_asian") {
			const cnt = parseCountSelection(market.selection);
			if (cnt) {
				const outcome = asianTotalFromGrid(unionG, cnt.side, cnt.line);
				dcP = asianCoverP(outcome);
				eloP = asianCoverP(asianTotalFromGrid(eloGrid, cnt.side, cnt.line));
				maher = asianCoverP(asianTotalFromGrid(maherG, cnt.side, cnt.line));
				karlis = asianCoverP(asianTotalFromGrid(karlisG, cnt.side, cnt.line));
				neg = asianCoverP(asianTotalFromGrid(nbG, cnt.side, cnt.line));
				apiP = dcP;
				h2hP = dcP;
				structural = dcP;
				ahCover = dcP;
				ahEv = asianExpectedReturn(outcome, odd) - 1;
			}
		} else if (kind === "cards") {
			const cnt = parseCountSelection(market.selection);
			countLambda = cardsLam;
			if (cnt && cardsLam != null) {
				const over = poissonOver(cardsLam, cnt.line);
				dcP = over == null ? 0 : cnt.side === "over" ? over : 1 - over;
				eloP = dcP;
				maher = dcP;
				karlis = dcP;
				neg = dcP;
				apiP = dcP;
				h2hP = dcP;
				structural = dcP;
			}
		} else if (kind === "corners") {
			const parsed = parseCornerMarket(market.selection);
			countLambda = cornersLam;
			if (parsed && cornersLamSplit && cornerGrid) {
				const priced = pCornerMarket(parsed, cornersLamSplit, cornerGrid);
				if (priced) {
					dcP = priced.p;
					eloP = dcP;
					maher = dcP;
					karlis = dcP;
					neg = dcP;
					apiP = dcP;
					h2hP = dcP;
					structural = dcP;
					if (priced.cover != null) {
						ahCover = priced.cover;
						ahEv = priced.ev(odd);
					}
				}
			} else {
				const cnt = parseCountSelection(market.selection);
				if (cnt && cornersLam != null) {
					const over = poissonOver(cornersLam, cnt.line);
					dcP = over == null ? 0 : cnt.side === "over" ? over : 1 - over;
					eloP = dcP;
					maher = dcP;
					karlis = dcP;
					neg = dcP;
					apiP = dcP;
					h2hP = dcP;
					structural = dcP;
				}
			}
		} else if (kind === "player_ga") {
			const parsed = parsePlayerGa(market.selection);
			const homeStatsP = input.playersByTeam?.get(fixture.homeId) ?? [];
			const awayStatsP = input.playersByTeam?.get(fixture.awayId) ?? [];
			const homeHit = parsed ? matchPlayer(parsed.name, input.lineupHome.players ?? [], homeStatsP) : {
				player: null,
				stats: null
			};
			const awayHit = parsed ? matchPlayer(parsed.name, input.lineupAway.players ?? [], awayStatsP) : {
				player: null,
				stats: null
			};
			const hit = homeHit.stats ? {
				...homeHit,
				side: "home"
			} : awayHit.stats ? {
				...awayHit,
				side: "away"
			} : null;
			if (hit?.stats) {
				const onXi = Boolean(hit.player);
				const confirmed = hit.side === "home" ? input.lineupHome.confirmed : input.lineupAway.confirmed;
				const mins = expectedMinutes({
					confirmedStarter: confirmed && onXi,
					confirmedBench: confirmed && !onXi,
					minutes: hit.stats.minutes,
					appearances: hit.stats.appearances,
					starts: hit.stats.starts
				});
				const teamLam = hit.side === "home" ? lambdas.lambdaH : lambdas.lambdaA;
				const teamGf = hit.side === "home" ? pred?.homeStats?.gfHome ?? pred?.homeSeasonForHome ?? null : pred?.awayStats?.gfAway ?? pred?.awaySeasonForAway ?? null;
				const atk = mins != null ? playerAttackLambdas({
					stats: hit.stats,
					expectedMinutes: mins,
					teamLambda: teamLam,
					teamGfPer90: teamGf,
					pos: hit.player?.pos ?? hit.stats.position
				}) : null;
				const joint = atk && mins != null ? playerGoalOrAssist({
					lambdaG: atk.lambdaG,
					lambdaA: atk.lambdaA,
					expectedMinutes: mins
				}) : null;
				if (joint && parsed) {
					dcP = parsed.mode === "score" ? joint.pG : parsed.mode === "assist" ? joint.pA : joint.pOr;
					eloP = dcP;
					maher = dcP;
					karlis = dcP;
					neg = dcP;
					apiP = dcP;
					h2hP = dcP;
					structural = dcP;
					countLambda = atk?.lambdaG ?? null;
					expectedMins = mins ?? null;
					playerOrP = dcP;
				}
			}
		} else if (kind === "multi_goals" || kind === "odd_even") {
			dcP = pFromGridForKind(kind, market.selection, unionG);
			eloP = pFromGridForKind(kind, market.selection, eloGrid);
			maher = pFromGridForKind(kind, market.selection, maherG);
			karlis = pFromGridForKind(kind, market.selection, karlisG);
			neg = pFromGridForKind(kind, market.selection, nbG);
			apiP = dcP;
			h2hP = dcP;
			structural = dcP;
		} else if (kind === "cs") {
			const key = parseScore(market.selection);
			const scoreKey = key ? `${key.home}-${key.away}` : market.selection;
			csCell = gridCellP(csGrid, scoreKey);
			maher = gridCellP(maherG, scoreKey);
			karlis = gridCellP(karlisG, scoreKey);
			neg = gridCellP(nbG, scoreKey);
			eloP = gridCellP(eloGrid, scoreKey);
			apiP = gridCellP(apiCsGrid, scoreKey);
			const hits = csCounts.get(scoreKey) ?? 0;
			h2hP = hits > 0 ? betaShrink(hits, h2hN, csCell, 4) : csCell;
			structural = csCell;
			dcP = csCell;
			csShin = shinCs.get(scoreKey) ?? null;
			if (liquid && csShin != null) {
				dcP = clamp(dcP, csShin * .82, csShin * 1.18);
				eloP = clamp(eloP, csShin * .82, csShin * 1.18);
				apiP = clamp(apiP, csShin * .82, csShin * 1.18);
			}
		}
		const implied = kind === "cs" ? csShin ?? structural : market.shinImplied ?? (odd > 1 ? 1 / odd : .5);
		const ensShin = kind === "cs" ? csShin : implied;
		const ensFam = ensembleFamilyOf(kind);
		const calFam = input.ensembleWeights?.families?.[ensFam];
		const ens = ensembleForKind(kind, {
			dc: dcP,
			shin: ensShin,
			api: apiP,
			elo: eloP,
			h2h: h2hP
		}, calFam ? {
			accuracy: calFam.acc,
			value: calFam.val
		} : null);
		const value = ens.value;
		const accuracy = applyShrink(applyPlatt(ens.accuracy, {
			a: calFam?.plattA ?? 1,
			b: calFam?.plattB ?? 0
		}), calFam?.shrink ?? 1);
		const composite = compositeScore({
			accuracy,
			agreement: ens.agreement,
			leagueWeight: w,
			value,
			implied,
			odd,
			bandMid: kind === "cs" ? 8 : kind === "draw" ? 3.4 : kind === "home" || kind === "away" ? 1.87 : 1.925,
			kind,
			dataQuality: pred?.quality ?? .3,
			lambdaSe: ((lambdas.lambdaSeH ?? .12) + (lambdas.lambdaSeA ?? .12)) / 2
		});
		if (pickSanity({
			kind,
			lambdaH: lambdas.lambdaH,
			lambdaA: lambdas.lambdaA,
			accuracy,
			implied,
			agreement: ens.agreement,
			leagueWeight: w,
			bookmaker: market.sharpBook ?? null,
			advice: pred?.advice ?? null,
			winner: pred?.winner ?? null,
			home: fixture.home,
			away: fixture.away,
			selection: market.selection,
			odd,
			recentTotal: pred?.homeLast5?.forAvg != null && pred?.awayLast5?.forAvg != null ? ((pred.homeLast5.forAvg ?? 0) + (pred.homeLast5.againstAvg ?? 0) + (pred.awayLast5.forAvg ?? 0) + (pred.awayLast5.againstAvg ?? 0)) / 2 : null,
			homeFts: pred?.homeFts ?? null,
			awayFts: pred?.awayFts ?? null,
			homeCs: pred?.homeCs ?? null,
			awayCs: pred?.awayCs ?? null,
			homeBtts: pred?.homeBtts ?? null,
			awayBtts: pred?.awayBtts ?? null,
			homeOver15: pred?.homeOver15 ?? null,
			awayOver15: pred?.awayOver15 ?? null,
			homeLast5Gf: pred?.homeLast5?.forAvg ?? null,
			homeLast5Ga: pred?.homeLast5?.againstAvg ?? null,
			awayLast5Gf: pred?.awayLast5?.forAvg ?? null,
			awayLast5Ga: pred?.awayLast5?.againstAvg ?? null,
			h2hBtts: h2hRates.btts,
			h2hOver25: h2hRates.over25,
			h2hHome: h2hRates.home,
			h2hAway: h2hRates.away,
			h2hN: h2hRates.n,
			homeForm: pred?.homeForm ?? pred?.homeLast5?.form ?? null,
			awayForm: pred?.awayForm ?? pred?.awayLast5?.form ?? null,
			bttsFailSeverity: kind === "btts_yes" || kind === "btts_no" ? bttsFailSev : 0,
			h2hConflict: latestH2hConflicts(h2h, kind),
			scoreline: modelMk.scoreline,
			gridHome: modelMk.home,
			gridDraw: Math.max(modelMk.draw, union.draw),
			gridAway: modelMk.away,
			csTopScores: union.topScores,
			ahEv,
			ahCover,
			countLambda,
			expectedMinutes: expectedMins,
			playerOrP,
			drawRisk: dRisk,
			upsetRisk: uRisk,
			drawConcentration: drawConc.concentration,
			ahStability: kind === "ah" ? (() => {
				const ah = parseAhSelection(market.selection);
				return ah ? asianLineStability(unionG, ah.side, ah.line, odd) : null;
			})() : null,
			crossFlags: xFlags
		})) continue;
		const shown = kind === "cs" ? {
			scoreline: market.selection,
			scorelineP: csCell
		} : modalScoreForKind(modelG, kind);
		const gfH = pred?.homeLast5?.forAvg ?? null;
		const gaH = pred?.homeLast5?.againstAvg ?? null;
		const gfA = pred?.awayLast5?.forAvg ?? null;
		const gaA = pred?.awayLast5?.againstAvg ?? null;
		const formH = pred?.homeForm ?? pred?.homeLast5?.form ?? null;
		const formA = pred?.awayForm ?? pred?.awayLast5?.form ?? null;
		const injHit = input.injuryHome.attack + input.injuryHome.defense + input.injuryHome.keeper + input.injuryAway.attack + input.injuryAway.defense + input.injuryAway.keeper;
		const pickNotes = explainMatch({
			kind,
			home: fixture.home,
			away: fixture.away,
			lambdaH: lambdas.lambdaH,
			lambdaA: lambdas.lambdaA,
			histWeight: histW,
			bookTrusted,
			hasBook1x2: shinH != null && shinD != null && shinA != null,
			homeGf: gfH,
			homeGa: gaH,
			awayGf: gfA,
			awayGa: gaA,
			homeForm: formH,
			awayForm: formA,
			homeRank: pred?.homeRank ?? null,
			awayRank: pred?.awayRank ?? null,
			homeFts: pred?.homeFts ?? null,
			awayFts: pred?.awayFts ?? null,
			homeCs: pred?.homeCs ?? null,
			awayCs: pred?.awayCs ?? null,
			homeOver15: pred?.homeOver15 ?? null,
			awayOver15: pred?.awayOver15 ?? null,
			homeAdjAttack: pred?.homeAdjAttack ?? null,
			awayAdjAttack: pred?.awayAdjAttack ?? null,
			lastNHome: pred?.lastNHome ?? 0,
			lastNAway: pred?.lastNAway ?? 0,
			leagueEnvHome: pred?.leagueEnvHome ?? null,
			leagueEnvAway: pred?.leagueEnvAway ?? null,
			homeLateShare: pred?.homeLateShare ?? null,
			awayLateShare: pred?.awayLateShare ?? null,
			homeScoringStreak: pred?.homeScoringStreak ?? null,
			awayScoringStreak: pred?.awayScoringStreak ?? null,
			homeFailedStreak: pred?.homeFailedStreak ?? null,
			awayFailedStreak: pred?.awayFailedStreak ?? null,
			h2hN: h2hNraw,
			h2hLine: h2hNraw ? `H2H ${h2hWins}-${h2hDraws}-${h2hLosses} in ${h2hNraw}` : null,
			grade: pred?.grade ?? "UNUSABLE",
			lineupHome: input.lineupHome.formation,
			lineupAway: input.lineupAway.formation,
			lineupConfirmed: input.lineupHome.confirmed || input.lineupAway.confirmed,
			injuryImpact: injHit,
			bookCount: market.bookCount ?? null,
			bttsFails,
			apiLine: pred?.underOver ?? null
		});
		if (ens.i2 >= .5) pickNotes.push(`Higgins I² ${(ens.i2 * 100).toFixed(0)}% — models disagree, no extremizing`);
		if (latestH2hConflicts(h2h, kind) === "lean") pickNotes.push("Last H2H leans against this pick — kept because last-20 and the table still agree.");
		if (drawExtra > .01) pickNotes.push("Draw mass lifted: Shin is short on the draw vs the grid, or close table + H2H draws.");
		if (kind === "home" || kind === "away") pickNotes.push(`Draw risk ${dRisk.toFixed(0)}/100 · upset risk ${uRisk.toFixed(0)}/100.`);
		if (kind === "draw") pickNotes.push(`Draw concentration ${(drawConc.concentration * 100).toFixed(0)}% in 0-0…3-3 · ${drawConc.topDraw.score} leads.`);
		if (kind === "corners") pickNotes.push(cornersLamSplit ? `Corners λ ${cornersLamSplit.lambdaH.toFixed(1)}–${cornersLamSplit.lambdaA.toFixed(1)} (bivariate Poisson).` : `Match-total corners λ ${cornersLam?.toFixed(1) ?? "n/a"} — split markets stay off.`);
		if (kind === "player_ga") pickNotes.push(expectedMins != null ? `Player G∪A minutes ${expectedMins.toFixed(0)}′ · P=${(playerOrP ?? dcP).toFixed(3)} (overlap subtracted).` : "Player G∪A needs minutes — NO BET.");
		if (kind === "ah") {
			const ah = parseAhSelection(market.selection);
			if (ah) {
				const stab = asianLineStability(unionG, ah.side, ah.line, odd);
				pickNotes.push(`AH line stability ${stab} (neighbours ${ah.line - .25} / ${ah.line + .25}).`);
			}
		}
		for (const f of xFlags) if (kind === "cs" || kind === "btts_yes" || kind === "ah" || kind === "draw") pickNotes.push(f);
		const gradeOut = pred?.grade ?? "UNUSABLE";
		const edgeVal = (kind === "ah" || kind === "ou_asian") && ahEv != null ? ahEv : value - implied;
		const rob = kindUsesGoals(kind) ? robustnessFromPerturb(dcP, perturbGrids.map((g) => pFromGridForKind(kind, market.selection, g))) : 1;
		const aavsScore = aavs({
			accuracy,
			edge: edgeVal,
			agreement: ens.agreement,
			dataQuality: pred?.quality ?? .4,
			robustness: rob
		});
		out.push({
			id: `${fixture.fixtureId}:${kind}:${market.selection}`,
			fixtureId: fixture.fixtureId,
			date: input.date,
			kickoff: fixture.kickoff,
			timestamp: fixture.timestamp,
			leagueId: fixture.leagueId,
			league: fixture.league,
			country: fixture.country,
			home: fixture.home,
			away: fixture.away,
			homeLogo: fixture.homeLogo,
			awayLogo: fixture.awayLogo,
			kind,
			family: familyOf(kind),
			selection: kind === "home" ? fixture.home : kind === "away" ? fixture.away : market.selection,
			odd,
			bookmaker: market.sharpBook ?? "Book",
			implied,
			accuracy,
			value,
			edge: edgeVal,
			agreement: ens.agreement,
			composite,
			leagueWeight: w,
			kellyQuarter: quarterKelly(odd, value),
			lambdaHome: lambdas.lambdaH,
			lambdaAway: lambdas.lambdaA,
			eloHome,
			eloAway,
			rho,
			advice: adviceForKind(kind, pred?.advice ?? null),
			apiLine: pred?.underOver ?? null,
			injuries: injHit,
			bestModel: ens.best,
			models: breakdownFromParts({
				dc: kind === "cs" ? csCell : dcP,
				shin: ensShin,
				api: apiP,
				elo: eloP,
				h2h: h2hP,
				maher,
				karlis,
				negBin: neg
			}),
			scoreline: shown.scoreline,
			scorelineP: shown.scorelineP,
			heat: kind === "cs" ? union.heat : modelMk.heat,
			notes: pickNotes,
			facts: {
				homeRank: pred?.homeRank ?? null,
				awayRank: pred?.awayRank ?? null,
				homeForm: formH ?? null,
				awayForm: formA ?? null,
				homeGf: gfH ?? null,
				homeGa: gaH ?? null,
				awayGf: gfA ?? null,
				awayGa: gaA ?? null,
				h2hWins,
				h2hDraws,
				h2hLosses,
				h2hN: h2hNraw,
				histWeight: histW,
				quality: pred?.quality ?? .4,
				grade: gradeOut,
				homeOver15: pred?.homeOver15 ?? null,
				awayOver15: pred?.awayOver15 ?? null,
				coverageScore: pred?.coverageScore ?? 0,
				lineupConfirmed: input.lineupHome.confirmed || input.lineupAway.confirmed,
				homeFts: pred?.homeFts ?? null,
				awayFts: pred?.awayFts ?? null,
				injuriesKnown: pred?.injuriesKnown ?? false,
				homePlayed: pred?.homePlayed && pred.homePlayed > 0 ? pred.homePlayed : null,
				awayPlayed: pred?.awayPlayed && pred.awayPlayed > 0 ? pred.awayPlayed : null,
				lastNHome: pred?.lastNHome,
				lastNAway: pred?.lastNAway,
				homeSma5: pred?.homeSma5 ?? null,
				homeSma20: pred?.homeSma20 ?? null,
				homeEwma5: pred?.homeEwma5 ?? null,
				homeEwma20: pred?.homeEwma20 ?? null,
				homeEma20: pred?.homeEma20 ?? null,
				awaySma5: pred?.awaySma5 ?? null,
				awaySma20: pred?.awaySma20 ?? null,
				awayEwma5: pred?.awayEwma5 ?? null,
				awayEwma20: pred?.awayEwma20 ?? null,
				awayEma20: pred?.awayEma20 ?? null
			},
			robustness: rob,
			aavs: aavsScore
		});
	}
	const comboRows = generateCombos(out.map((p) => ({
		kind: p.kind,
		selection: p.selection,
		odd: p.odd
	})), unionG, 3);
	for (const spec of comboRows) {
		if (spec.jointP < .4) continue;
		const first = out.find((p) => p.kind === spec.legs[0].kind && p.selection === spec.legs[0].selection) ?? out[0];
		if (!first) continue;
		const combinedOdds = spec.combinedOdds;
		const impliedC = 1 / combinedOdds;
		const accuracyC = spec.jointP;
		const edgeC = accuracyC * combinedOdds - 1;
		const legPicks = spec.legs.map((l) => out.find((p) => p.kind === l.kind && p.selection === l.selection)).filter((p) => Boolean(p));
		const agreementC = Math.min(...legPicks.map((p) => p.agreement), first.agreement);
		const robC = robustnessFromPerturb(accuracyC, perturbGrids.map((g) => comboJointP(g, spec.legs)));
		const aavsC = aavs({
			accuracy: accuracyC,
			edge: edgeC,
			agreement: agreementC,
			dataQuality: first.facts?.quality ?? .4,
			robustness: robC
		});
		out.push({
			...first,
			id: `${fixture.fixtureId}:combo:${spec.selection}`,
			kind: "combo",
			family: "combo",
			selection: spec.selection,
			odd: combinedOdds,
			implied: impliedC,
			accuracy: accuracyC,
			value: accuracyC,
			edge: edgeC,
			agreement: agreementC,
			composite: compositeScore({
				accuracy: accuracyC,
				agreement: agreementC,
				leagueWeight: w,
				value: accuracyC,
				implied: impliedC,
				odd: combinedOdds,
				bandMid: 3.25,
				kind: "combo",
				dataQuality: first.facts?.quality ?? .4,
				lambdaSe: ((lambdas.lambdaSeH ?? .12) + (lambdas.lambdaSeA ?? .12)) / 2
			}),
			kellyQuarter: quarterKelly(combinedOdds, accuracyC),
			notes: ["Joint P from score matrix, not independence", ...spec.legs.map((l) => l.selection)],
			comboLegs: spec.legs,
			robustness: robC,
			aavs: aavsC
		});
	}
	const overPairs = sameMatchOverPairs(
		out
			.filter((p) => p.kind === "home_score" || p.kind === "away_score" || p.kind === "over_15" || p.kind === "over_25")
			.map((p) => ({ kind: p.kind, selection: p.selection, odd: p.odd })),
		unionG,
	);
	for (const spec of overPairs) {
		const legPicks = spec.legs
			.map((l) => out.find((p) => p.kind === l.kind && p.selection === l.selection))
			.filter((p) => Boolean(p));
		const first = legPicks[0];
		if (!first || legPicks.length < 2) continue;
		const agreementC = Math.min(...legPicks.map((p) => p.agreement));
		const robC = robustnessFromPerturb(spec.jointP, perturbGrids.map((g) => comboJointP(g, spec.legs)));
		out.push({
			...first,
			id: `${fixture.fixtureId}:over-block:${spec.selection}`,
			kind: "combo",
			family: "combo",
			selection: spec.selection,
			odd: spec.combinedOdds,
			implied: 1 / spec.combinedOdds,
			accuracy: spec.jointP,
			value: spec.jointP,
			edge: spec.jointP * spec.combinedOdds - 1,
			agreement: agreementC,
			comboLegs: spec.legs,
			robustness: robC,
			aavs: aavs({
				accuracy: spec.jointP,
				edge: spec.jointP * spec.combinedOdds - 1,
				agreement: agreementC,
				dataQuality: first.facts?.quality ?? 0.4,
				robustness: robC,
			}),
			notes: ["over-focus-block", "Same-match joint from the score matrix, not the product of the prices"],
		});
	}
	return out;
}
function pickCsLines(posted, grid) {
	const playable = posted.filter((s) => {
		if (s.sharpOdd == null || !inCsOddsBand(s.sharpOdd)) return false;
		if (!isPlayableCsScore(s.selection)) return false;
		return gridCellP(grid, s.selection) >= .09;
	});
	playable.sort((a, b) => gridCellP(grid, b.selection) - gridCellP(grid, a.selection));
	return playable.slice(0, 1);
}
function settlePicks(picks, scores) {
	let hits = 0;
	let n = 0;
	for (const p of picks) {
		const s = scores.get(p.fixtureId);
		if (p.kind === "combo" && p.comboLegs?.some((leg) => leg.fixtureId != null && leg.fixtureId !== p.fixtureId)) {
			let hit = true;
			let known = true;
			let won = 0;
			for (const leg of p.comboLegs) {
				const ls = scores.get(leg.fixtureId ?? p.fixtureId);
				if (!ls) {
					known = false;
					break;
				}
				const one = gradeMarket(leg.kind, leg.selection, ls.home, ls.away);
				if (one == null) {
					known = false;
					break;
				}
				if (!one) hit = false;
				else won += 1;
			}
			p.settled = {
				home: known ? won : s?.home ?? 0,
				away: known ? p.comboLegs.length : s?.away ?? 0,
				hit: known ? hit : null
			};
			if (known) {
				n += 1;
				if (hit) hits += 1;
			}
			continue;
		}
		if (!s) continue;
		const hit = gradeMarket(p.kind, p.selection, s.home, s.away, { comboLegs: p.comboLegs });
		p.settled = {
			home: s.home,
			away: s.away,
			hit
		};
		if (hit == null) continue;
		n += 1;
		if (hit) hits += 1;
	}
	return {
		hits,
		n
	};
}
export function toTodayPicks(result) {
	return {
		date: result.meta.date,
		timezone: result.meta.timezone,
		scannedAt: result.meta.scannedAt,
		source: result.meta.source,
		picks: result.fold.map((p) => ({
			slot: p.rank ?? 0,
			home: p.home,
			away: p.away,
			league: p.league,
			kickoff: p.kickoff,
			kind: p.kind,
			selection: p.selection,
			odds: p.odd,
			bookmaker: p.bookmaker,
			ensemble: p.accuracy,
			model: p.bestModel,
			scoreline: p.scoreline,
			homeLogo: p.homeLogo,
			awayLogo: p.awayLogo
		})),
		warnings: result.warnings
	};
}
