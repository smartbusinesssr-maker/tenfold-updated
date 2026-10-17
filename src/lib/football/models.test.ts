import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyStandings,
  consensusPrice,
  emptyPrediction,
  extractFixtureMarkets,
  mergeOddsRows,
  extractLeagueCoverage,
  extractLineups,
  extractStandings,
  extractTeamStatistics,
  extractFixtureCornerMap,
  extractPlayerSeason,
  finishedSamples,
  last5FromFixtures,
  minuteShares,
  underOverRate,
  venueSplit,
} from "./extract.ts";
import { generateCombos } from "./markets-engine.ts";
import { buildSnapshot, bttsFailureModes, bttsFailureSeverity, dataGrade, explainMatch, formStreaks, last5Rates, leagueEnvFromStandings, marketCoverageFromFlags, opponentAdjust, rollSamples, rollWindow, samplesForMatch, shouldFetchLive, shrinkRate } from "./features.ts";
import {
  blendTimescales,
  dcWeightedRate,
  emaSpanRate,
  ewmaRate,
  finishingRegress,
  finishingShrink,
  goalMomentum,
  goalShare,
  kalmanSide,
  latentStateTrace,
  logLinearLambda,
  monteCarloOver15,
  movingAverages,
  samplesFromGoals,
  smaRate,
} from "./latent.ts";
import {
  bivariateGrid,
  bivariatePoisson,
  latentShockPosterior,
  trivariatePoisson,
  DC_RHO,
  DC_RHO_MLE,
  DC_XI_HALF_WEEK,
  DC_XI_PER_DAY,
  dcDecay,
  dcHalfLifeDays,
  dcDecayTrace,
  dcTau,
  conditionalCorrelation,
  dcAdjustment,
  dcEstimate,
  dcParamFit,
  dcCorrelation,
  dcRhoMap,
  dcGridDetail,
  karlisCorrelation,
  ensembleForKind,
  fairCsOdd,
  gridCellP,
  jointGrid,
  maherBttsClosed,
  maherBaseline,
  cmpTrace,
  poissonAltTrace,
  maherBttsParts,
  maherCell,
  maherFromLambdas,
  maherGrid,
  maherLambdas,
  marketAgreesWithHistory,
  maherOver15,
  maherOver25Closed,
  MAHER_HOME_ADV,
  MAHER_HOME_ADV_1982,
  KARLIS_COV,
  karlisBttsParts,
  bttsPartsFromGrid,
  copulaBtts,
  copulaBttsParts,
  copulaGrid,
  frankCopula,
  FRANK_THETA,
  jointDependence,
  goddardBtts,
  hierarchicalBtts,
  hierarchicalTrace,
  BTTS_HIER_KAPPA,
  logitPartialPool,
  structuralBttsP,
  structuralOuP,
  structuralWinP,
  skellam1x2,
  skellamPmf,
  skellamConvPmf,
  skellamDrawConv,
  skellamVariants,
  poissonPmfArray,
  poissonInvestigate,
  poissonClosure,
  poissonConv1x2,
  skellamMoments,
  skellamFromMeanVar,
  skellamNormal1x2,
  skellamInPlay1x2,
  karlisSkellam1x2,
  karlisRates,
  logBesselI,
  negBinSkellam1x2,
  negBinMoments,
  negBinRFromVmr,
  negBinFromMoments,
  negBinIndependentTotalVar,
  negBinFrailtyTotalVar,
  negBinSplit,
  negBinInvestigate,
  negBinOverAtLeast,
  negBinOver15,
  negBinPmfArray,
  negBinGrid,
  ziSkellam1x2,
  ziSkellamInvestigate,
  ziSkellamPiFromDraw,
  diagonalInflate,
  zeroInflate00,
  zipPmf,
  zipMoments,
  zipInvestigate,
  zipMeanPreservingRate,
  zipPiFromZeroFreq,
  zipGrid,
  zinbPmf,
  ZIP_PI,
  goddardResult,
  goddardOu,
  weibullCountPmf,
  weibullOverAtLeast,
  weibullQForMean,
  apiLineToOver25,
  ZI_SKELLAM_PI,
  WEIBULL_SHAPE,
  POLYA_RHO,
  panjerAb0Poisson,
  panjerCompound,
  geometricSeverity,
  polyaAeppliPmf,
  polyaAeppliOverAtLeast,
  polyaAeppliClosedPmf,
  polyaAeppliMoments,
  polyaAeppli1x2,
  polyaKarlis1x2,
  polyaRhoFromVmr,
  polyaFromMoments,
  polyaRhoFromZeroFreq,
  YIP_GOAL_VMR,
  LEAGUE_MEAN_AWAY,
  LEAGUE_MEAN_HOME,
  DESK_MAHER_PARAMS,
  PAPER_MAHER_PARAMS,
  MIN_CS_CELL,
  parseScore,
  poissonPmf,
  rhoBounds,
  shinCsImplied,
  shinFit,
  shinInvert,
  multiplicativeDevig,
  additiveDevig,
  powerDevig,
  invert1x2Report,
  structuralCsP,
  tauCells,
  tiltGridTo1x2,
  rakeGrid,
  mixGrids,
  logPoolGrids,
  logPoolResult,
  logPoolOddsRatio,
  logPoolStats,
  logPoolBinary,
  likelihoodUpdate,
  gridEntropy,
  gridKL,
  fuseScoreGrid,
  UNION_RAKE_ALPHA,
  UNION_WEIGHTS,
  isPlayableCsScore,
  csConcentration,
  csAgreesWith1x2,
  WIN_LAMBDA_GAP,
  WIN_DRAW_MASS_MAX,
  CS_TOP_MARGIN_MIN,
  CS_TOP3_MIN,
  egidiMix,
  EGIDI_HIST_WEIGHT,
  estimateLambdas,
  histWeightFromData,
  poissonBinomialPmf,
  torvaneyXgGrid,
  torvaneyGridMean,
  torvaneyMatchRate,
  torvaneySideRate,
  torvaneyDcLogLik,
  matchRho,
  marketsCoherent,
  marketsFromGrid,
  totalSurvival,
  pickSanity,
  contradictsAdvice,
  adviceForKind,
  pForKind,
  scorelineSupportsKind,
  scorelineContradictsKind,
  gradeMarket,
  modalScoreForKind,
  borsH2hWeight,
  closeTableH2hDrawBoost,
  formMomentum,
  formTilt,
  walkElo,
  inflateDraw,
  karlisOutlierScale,
  huberWeight,
  winsorGoalRate,
  HUBER_K_GD,
  HUBER_K_GF,
  latestH2hConflicts,
  h2hMarketRates,
  formMarketTargets,
  naDrawBoost,
  orderedLogitProbs,
  pennDonnellyScale,
  wheatcroftCodTilt,
  piPsi,
  piToLambdas,
  PI_CATCHUP,
  PI_LEARNING,
  skellamLambdasFrom1x2,
  totalFromOver25,
  trimmedMedian,
  walkPiRatings,
  extremize,
  metaHeterogeneity,
  satopaaA,
  SATOPAA_MAX,
  bayesModelAverage,
  kassRafteryGrade,
  OCCAM_DELTA,
  stackMixture,
} from "./models.ts";

describe("correct-score cells", () => {
  const lh = 1.38;
  const la = 1.12;
  const dc = jointGrid(lh, la);
  const maher = maherGrid(lh, la);

  it("parses 1-0, 1:0 and unicode dashes", () => {
    assert.deepEqual(parseScore("1-0"), { home: 1, away: 0 });
    assert.deepEqual(parseScore("2:1"), { home: 2, away: 1 });
    assert.deepEqual(parseScore("0–0"), { home: 0, away: 0 });
    assert.equal(parseScore("home win"), null);
  });

  it("Dixon–Coles inflates 0-0 and 1-1 versus independent Poisson", () => {
    const dc00 = gridCellP(dc, "0-0");
    const m00 = gridCellP(maher, "0-0");
    const dc11 = gridCellP(dc, "1-1");
    const m11 = gridCellP(maher, "1-1");
    assert.ok(dc00 > m00, `0-0 DC ${dc00} vs Maher ${m00}`);
    assert.ok(dc11 > m11, `1-1 DC ${dc11} vs Maher ${m11}`);
  });

  it("modal cell for league-average lambdas is a low-score, 8–16%", () => {
    let best = 0;
    let bestScore = "";
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 4; y++) {
        const p = dc[x]![y]!;
        if (p > best) {
          best = p;
          bestScore = `${x}-${y}`;
        }
      }
    }
    assert.ok(best >= 0.08 && best <= 0.16, `modal ${bestScore} p=${best}`);
    assert.ok(["1-1", "1-0", "2-1", "2-0", "0-0"].includes(bestScore), bestScore);
  });

  it("Karlis bivariate grid is a probability distribution", () => {
    const g = bivariateGrid(lh, la);
    let sum = 0;
    for (const row of g) for (const v of row) sum += v;
    assert.ok(Math.abs(sum - 1) < 1e-6, `sum=${sum}`);
    assert.ok(gridCellP(g, "1-1") > 0.05);
  });

  it("Shin CS book de-vigs a full overround card and does not inflate a thin one", () => {
    const thin = shinCsImplied(
      [
        { score: "1-1", odd: 6.5 },
        { score: "1-0", odd: 7.5 },
      ],
      dc,
    );
    const raw11 = 1 / 6.5;
    assert.ok(Math.abs((thin.get("1-1") ?? 0) - raw11) < 1e-9, "thin book keeps 1/odd");

    const fat: { score: string; odd: number }[] = [];
    for (let h = 0; h <= 4; h++) {
      for (let a = 0; a <= 4; a++) {
        const p = Math.max(0.02, dc[h]![a]!);
        fat.push({ score: `${h}-${a}`, odd: 1 / p / 1.22 });
      }
    }
    const implied = shinCsImplied(fat, dc);
    let mass = 0;
    for (const p of implied.values()) mass += p;
    assert.ok(mass < 0.99, `posted mass ${mass} should leave tail`);
    assert.ok(mass > 0.7, `posted mass ${mass} too small`);
    const cell = implied.get("1-1") ?? 0;
    const raw = 1 / (fat.find((x) => x.score === "1-1")?.odd ?? 9);
    assert.ok(cell < raw, `Shin ${cell} should be below raw ${raw}`);
    assert.ok(cell > 0.05);
  });

  it("tilting the grid to API 1X2 moves home-win mass", () => {
    const tilted = tiltGridTo1x2(dc, 0.62, 0.22, 0.16);
    let h = 0;
    let d = 0;
    let a = 0;
    for (let x = 0; x < tilted.length; x++) {
      for (let y = 0; y < tilted[x]!.length; y++) {
        const p = tilted[x]![y]!;
        if (x > y) h += p;
        else if (x === y) d += p;
        else a += p;
      }
    }
    assert.ok(Math.abs(h - 0.62) < 0.02, `home ${h}`);
    assert.ok(Math.abs(d - 0.22) < 0.02, `draw ${d}`);
    assert.ok(Math.abs(a - 0.16) < 0.02, `away ${a}`);
  });

  it("raking onto 1X2 + Over 2.5 + BTTS matches those markets", () => {
    const raked = rakeGrid(dc, { home: 0.5, draw: 0.26, away: 0.24, over25: 0.55, btts: 0.52 });
    let h = 0;
    let d = 0;
    let over = 0;
    let btts = 0;
    let sum = 0;
    for (let x = 0; x < raked.length; x++) {
      for (let y = 0; y < raked[x]!.length; y++) {
        const p = raked[x]![y]!;
        sum += p;
        if (x > y) h += p;
        else if (x === y) d += p;
        if (x + y >= 3) over += p;
        if (x >= 1 && y >= 1) btts += p;
      }
    }
    assert.ok(Math.abs(sum - 1) < 1e-6, `sum ${sum}`);
    assert.ok(Math.abs(h - 0.5) < 0.03, `home ${h}`);
    assert.ok(Math.abs(d - 0.26) < 0.03, `draw ${d}`);
    assert.ok(Math.abs(over - 0.55) < 0.04, `over ${over}`);
    assert.ok(Math.abs(btts - 0.52) < 0.04, `btts ${btts}`);
  });

  it("only prints low-score CS cells", () => {
    assert.equal(isPlayableCsScore("1-1"), true);
    assert.equal(isPlayableCsScore("2-1"), true);
    assert.equal(isPlayableCsScore("2-2"), true);
    assert.equal(isPlayableCsScore("3-1"), true);
    assert.equal(isPlayableCsScore("3-2"), false);
    assert.equal(isPlayableCsScore("4-0"), false);
  });

  it("structural CS blend ignores Maher and stays between DC and Karlis", () => {
    const dcP = gridCellP(dc, "1-1");
    const k = gridCellP(bivariateGrid(lh, la), "1-1");
    const m = gridCellP(maher, "1-1");
    const blend = structuralCsP(dcP, k, m, dcP);
    const lo = Math.min(dcP, k);
    const hi = Math.max(dcP, k);
    assert.ok(blend >= lo - 1e-9 && blend <= hi + 1e-9, `${blend} not in [${lo},${hi}]`);
    assert.ok(dcP > m, "Maher still understates 1-1, which is why it is out of the blend");
  });

  it("fair CS odds sit in the CS band for a modal cell and reject tails", () => {
    const p = gridCellP(dc, "1-1");
    const odd = fairCsOdd(p);
    assert.ok(odd != null && odd >= 6 && odd <= 13, `fair odd ${odd} for p=${p}`);
    assert.equal(fairCsOdd(0.04), null);
    assert.ok(MIN_CS_CELL > 0.05);
  });

  it("CS ensemble accuracy is a cell probability, not a 1X2 50%", () => {
    const dcP = gridCellP(dc, "1-1");
    const ens = ensembleForKind("cs", {
      dc: dcP,
      shin: dcP * 0.9,
      api: dcP,
      elo: dcP,
      h2h: dcP,
    });
    assert.ok(ens.accuracy >= 0.07 && ens.accuracy <= 0.18, `accuracy ${ens.accuracy}`);
    const shrunk = ensembleForKind("cs", {
      dc: 0.12,
      shin: 0.12,
      api: 0.12,
      elo: 0.12,
      h2h: 0.12,
    });
    assert.ok(Math.abs(shrunk.accuracy - 0.12) < 0.005, `CS must not be extremized, got ${shrunk.accuracy}`);
    const win = ensembleForKind("home", {
      dc: 0.48,
      shin: 0.5,
      api: 0.47,
      elo: 0.46,
      h2h: 0.44,
    });
    assert.ok(win.accuracy > 0.4, `1X2 accuracy ${win.accuracy} should stay on the 1X2 scale`);
  });
});

describe("model union", () => {
  const lh = 1.38;
  const la = 1.12;
  const dc = jointGrid(lh, la);
  const karlis = bivariateGrid(lh, la);
  const cop = copulaGrid(lh, la);
  const nb = maherGrid(lh, la);
  const elo = jointGrid(lh * 1.05, la * 0.95);

  it("log-pool of identical grids is the same grid", () => {
    const pooled = logPoolGrids([
      { grid: dc, w: 0.5 },
      { grid: dc, w: 0.5 },
    ]);
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 4; y++) {
        assert.ok(Math.abs((pooled[x]?.[y] ?? 0) - (dc[x]?.[y] ?? 0)) < 1e-9, `${x}-${y}`);
      }
    }
  });

  it("linear mix is a convex combination of cells", () => {
    const mixed = mixGrids([
      { grid: dc, w: 0.7 },
      { grid: karlis, w: 0.3 },
    ]);
    const a = gridCellP(dc, "1-1");
    const b = gridCellP(karlis, "1-1");
    const p = gridCellP(mixed, "1-1");
    assert.ok(p > Math.min(a, b) - 1e-12 && p < Math.max(a, b) + 1e-12);
  });

  it("union weights sum to 1", () => {
    const s = UNION_WEIGHTS.dc + UNION_WEIGHTS.karlis + UNION_WEIGHTS.copula + UNION_WEIGHTS.negBin + UNION_WEIGHTS.elo;
    assert.ok(Math.abs(s - 1) < 1e-12, `weights ${s}`);
  });

  it("1X2, BTTS, O/U and CS are slices of one fused grid", () => {
    const g = fuseScoreGrid({ dc, karlis, copula: cop, negBin: nb, elo });
    const m = marketsFromGrid(g);
    assert.ok(Math.abs(m.home + m.draw + m.away - 1) < 1e-9);
    assert.ok(Math.abs(m.bttsYes + m.bttsNo - 1) < 1e-9);
    assert.ok(Math.abs(m.over25 + m.under25 - 1) < 1e-9);
    let cellSum = 0;
    for (const row of g) for (const v of row) cellSum += v;
    assert.ok(Math.abs(cellSum - 1) < 1e-9, `cells ${cellSum}`);
    const modal = gridCellP(g, m.scoreline);
    assert.ok(Math.abs(modal - m.scorelineP) < 1e-12);
  });

  it("soft rake walks toward Shin without copying it", () => {
    const shin = { home: 0.58, draw: 0.24, away: 0.18, over25: 0.55, btts: 0.52 };
    const raw = marketsFromGrid(fuseScoreGrid({ dc, karlis, copula: cop, negBin: nb, elo, alpha: 0 }));
    const fused = marketsFromGrid(fuseScoreGrid({ dc, karlis, copula: cop, negBin: nb, elo, shin }));
    const full = marketsFromGrid(fuseScoreGrid({ dc, karlis, copula: cop, negBin: nb, elo, shin, alpha: 1 }));
    assert.ok(fused.home > Math.min(raw.home, shin.home) - 0.01);
    assert.ok(fused.home < Math.max(raw.home, shin.home) + 0.01);
    assert.ok(Math.abs(fused.home - raw.home) > 1e-4, "α=0.4 should move home");
    assert.ok(Math.abs(full.home - shin.home) < 0.03, `full rake home ${full.home}`);
  });

  it("dictatorship: weight 1 recovers that grid", () => {
    const pooled = logPoolGrids([
      { grid: dc, w: 1 },
      { grid: karlis, w: 0 },
    ]);
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 4; y++) {
        assert.ok(Math.abs((pooled[x]?.[y] ?? 0) - (dc[x]?.[y] ?? 0)) < 1e-9, `${x}-${y}`);
      }
    }
  });

  it("identical experts have Z = 1", () => {
    const r = logPoolResult([
      { grid: dc, w: 0.6 },
      { grid: dc, w: 0.4 },
    ]);
    assert.ok(Math.abs(r.z - 1) < 1e-9, `Z ${r.z}`);
  });

  it("pooled odds are the weighted geometric mean of cell odds", () => {
    const parts = [
      { grid: dc, w: 0.7 },
      { grid: karlis, w: 0.3 },
    ];
    const pooled = logPoolGrids(parts);
    const fromGrid = gridCellP(pooled, "1-1") / gridCellP(pooled, "1-0");
    const fromOdds = logPoolOddsRatio(parts, { x: 1, y: 1 }, { x: 1, y: 0 });
    assert.ok(Math.abs(fromGrid - fromOdds) < 1e-9, `${fromGrid} vs ${fromOdds}`);
  });

  it("external Bayes: pool-then-update equals update-then-pool", () => {
    const parts = [
      { grid: dc, w: 0.55 },
      { grid: karlis, w: 0.45 },
    ];
    const L = (x: number, y: number) => (x > y ? 1.4 : x === y ? 0.9 : 1);
    const poolThen = likelihoodUpdate(logPoolGrids(parts), L);
    const updateThen = logPoolGrids(parts.map((p) => ({ grid: likelihoodUpdate(p.grid, L), w: p.w })));
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 4; y++) {
        assert.ok(
          Math.abs((poolThen[x]?.[y] ?? 0) - (updateThen[x]?.[y] ?? 0)) < 1e-9,
          `${x}-${y} ${poolThen[x]?.[y]} vs ${updateThen[x]?.[y]}`,
        );
      }
    }
  });

  it("linear mix fails external Bayes", () => {
    const parts = [
      { grid: dc, w: 0.55 },
      { grid: karlis, w: 0.45 },
    ];
    const L = (x: number, y: number) => (x > y ? 1.4 : 1);
    const mixThen = likelihoodUpdate(mixGrids(parts), L);
    const updateThen = mixGrids(parts.map((p) => ({ grid: likelihoodUpdate(p.grid, L), w: p.w })));
    let gap = 0;
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 4; y++) {
        gap = Math.max(gap, Math.abs((mixThen[x]?.[y] ?? 0) - (updateThen[x]?.[y] ?? 0)));
      }
    }
    assert.ok(gap > 1e-6, `linear EB gap ${gap} should be visible`);
  });

  it("log-pool is the I-projection: lower Σ w KL(pool‖expert) than the linear mix", () => {
    const parts = [
      { grid: dc, w: 0.5 },
      { grid: elo, w: 0.5 },
    ];
    const stats = logPoolStats(parts);
    const linear = mixGrids(parts);
    const totW = 1;
    let linearTo = 0;
    for (const p of parts) linearTo += (p.w / totW) * gridKL(linear, p.grid);
    assert.ok(stats.meanKlToExperts < linearTo - 1e-9, `I-proj ${stats.meanKlToExperts} vs linear ${linearTo}`);
    assert.ok(stats.entropy <= stats.linearEntropy + 1e-9, `H log ${stats.entropy} vs H lin ${stats.linearEntropy}`);
    assert.ok(stats.z < 1, `disagreeing experts Z ${stats.z}`);
    assert.ok(gridEntropy(dc) > 1);
  });

  it("Genest 1984: pooling the joint’s home margin is not pooling the 1X2 numbers", () => {
    const parts = [
      { grid: dc, w: 0.5 },
      { grid: elo, w: 0.5 },
    ];
    const jointHome = marketsFromGrid(logPoolGrids(parts)).home;
    const scalarHome = logPoolBinary([
      { p: marketsFromGrid(dc).home, w: 0.5 },
      { p: marketsFromGrid(elo).home, w: 0.5 },
    ]);
    assert.ok(Math.abs(jointHome - scalarHome) > 1e-5, `margin ${jointHome} vs binary pool ${scalarHome}`);
  });

  it("Genest 1984: negative weights are dropped (w_i ≥ 0)", () => {
    const pooled = logPoolGrids([
      { grid: dc, w: 1 },
      { grid: karlis, w: -0.4 },
    ]);
    for (let x = 0; x <= 3; x++) {
      for (let y = 0; y <= 3; y++) {
        assert.ok(Math.abs((pooled[x]?.[y] ?? 0) - (dc[x]?.[y] ?? 0)) < 1e-9);
      }
    }
  });

  it("Shin enters as a log-pool expert, not a linear 1X2 mix", () => {
    const shin = { home: 0.62, draw: 0.22, away: 0.16 };
    const raw = marketsFromGrid(fuseScoreGrid({ dc, karlis, copula: cop, negBin: nb, elo, alpha: 0 }));
    const fused = marketsFromGrid(fuseScoreGrid({ dc, karlis, copula: cop, negBin: nb, elo, shin }));
    const linear = (1 - UNION_RAKE_ALPHA) * raw.home + UNION_RAKE_ALPHA * shin.home;
    assert.ok(Math.abs(fused.home - linear) > 1e-4, `Genest home ${fused.home} should not equal Stone mix ${linear}`);
    assert.ok(fused.home > Math.min(raw.home, shin.home));
    assert.ok(fused.home < Math.max(raw.home, shin.home));
  });
});

describe("Negative binomial split", () => {
  it("puts more variance on one frailty, and a mild sample does not move r", () => {
    const z = negBinSplit();
    assert.ok(Math.abs(z.yipR - 62.5) < 0.1);
    assert.ok(z.r18.varFrailty > z.r18.varIndep);
    assert.ok(z.r18.over25.frailty < z.r18.over25.margins);
    assert.ok(z.r18.over25.margins < z.poisson.over25);
    assert.ok(z.r35.over15.frailty < z.r35.over15.margins);
    assert.equal(z.quiet.fired, false);
    assert.equal(z.quiet.r, 18);
    assert.equal(z.open.fired, true);
    assert.equal(z.open.moved, false);
    assert.equal(z.wild.r, 3.5);
    assert.ok(z.wild.raw != null && z.wild.raw < 3.5);
  });
});

describe("Conway–Maxwell–Poisson", () => {
  it("matches the mean, and ν = 1 is Poisson", () => {
    const z = cmpTrace();
    const poi = z.rows[0];
    const over = z.rows[2];
    const under = z.rows[3];
    assert.ok(Math.abs(poi.nu - 1) < 1e-12);
    assert.ok(Math.abs(poi.over25 - z.poisson.over25) < 1e-6);
    for (const row of z.rows) assert.ok(Math.abs(row.mean - 1.38) < 0.002);
    assert.ok(over.vmr > 1.05 && over.btts < z.poisson.btts);
    assert.ok(over.rate < 1.38 && over.unmatched > 1.5);
    assert.ok(under.vmr < 0.95 && under.btts > z.poisson.btts);
    assert.ok(under.rate > 1.38 && under.unmatched < 1.3);
    assert.ok(Math.abs(over.over25 - z.poisson.over25) < 0.01);
  });
});

describe("Poisson regression alternatives", () => {
  it("r = 18 barely moves Over 2.5, and a blowout pulls less than under Poisson", () => {
    const z = poissonAltTrace();
    assert.equal(z.phi, 1.04);
    assert.ok(Math.abs(z.nb18.over25 - z.poisson.over25) < 0.01);
    assert.ok(z.nb18.btts < z.poisson.btts);
    assert.ok(z.nb35.over25 < z.nb18.over25);
    assert.ok(z.weibull.btts < 0.35);
    assert.ok(z.zip.over25 < z.poisson.over25);
    assert.ok(z.pull.nb35 < z.pull.nb18 && z.pull.nb18 < z.pull.poisson);
    assert.ok(z.weight.hot < z.weight.league && z.weight.league < z.weight.quiet);
    assert.ok(z.weight.hotFloor < 0.6);
    assert.ok(z.vmr18 > 1.04 && z.vmr18 < 1.1);
  });
});

describe("Dixon–Coles time decay", () => {
  it("keeps a year-old match near half, and does not use 0.0065 as a daily rate", () => {
    const z = dcDecayTrace();
    assert.ok(z.halfLife > 373 && z.halfLife < 374);
    assert.ok(z.bugHalfLife > 106 && z.bugHalfLife < 107);
    const year = z.rows.find((r) => r.days === 365);
    assert.ok(year && year.paper > 0.5 && year.paper < 0.52);
    assert.ok(year && year.dailyBug < 0.1);
    assert.ok(z.paperPair.mean > 1.9 && z.paperPair.mean < 2);
    assert.ok(z.paperPair.mean > z.flatMean);
    assert.ok(z.bugPair.mean > 2.7);
    assert.ok(z.paperPair.share < 0.7 && z.bugPair.share > 0.9);
    assert.ok(z.piYear > 0.75 && z.piYear < 0.8);
    assert.ok(z.match14 > 0.97);
  });
});

describe("Dixon–Coles parameters", () => {
  it("converts 1997 ξ from half-weeks to days", () => {
    assert.equal(DC_XI_HALF_WEEK, 0.0065);
    assert.ok(Math.abs(DC_XI_PER_DAY - 0.0065 / 3.5) < 1e-12);
    const tHalf = dcHalfLifeDays();
    assert.ok(tHalf > 350 && tHalf < 400, `half-life ${tHalf} days`);
  });

  it("weights a match 3.5 days ago at exp(-0.0065) under paper units", () => {
    const w = dcDecay(3.5, DC_XI_PER_DAY);
    assert.ok(Math.abs(w - Math.exp(-0.0065)) < 1e-9, `w=${w}`);
  });

  it("does not decay H2H as fast as the old 0.0065 / day bug", () => {
    const paper = dcDecay(180, DC_XI_PER_DAY);
    const buggy = dcDecay(180, 0.0065);
    assert.ok(paper > 0.65, `paper 180d ${paper}`);
    assert.ok(buggy < 0.35, `buggy 180d ${buggy}`);
    assert.ok(paper > buggy * 2);
  });

  it("keeps τ positive inside rho bounds for league-average lambdas", () => {
    const { lo, hi } = rhoBounds(1.38, 1.12);
    assert.ok(lo < -0.13 && hi > 0);
    for (const rho of [-0.13, 0, lo + 0.01, hi - 0.01]) {
      for (const [x, y] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        const t = dcTau(x, y, 1.38, 1.12, rho);
        assert.ok(t > 0, `τ(${x},${y}) rho=${rho} → ${t}`);
      }
    }
  });

  it("tauCells inflate 0-0 and 1-1 at paper ρ, match Maher at ρ = 0", () => {
    const paper = Object.fromEntries(tauCells(1.38, 1.12, DC_RHO).map((c) => [c.score, c]));
    assert.ok((paper["0-0"]?.delta ?? 0) > 0);
    assert.ok((paper["1-1"]?.delta ?? 0) > 0);
    assert.ok((paper["1-0"]?.delta ?? 0) < 0);
    assert.ok((paper["0-1"]?.delta ?? 0) < 0);
    for (const c of tauCells(1.38, 1.12, 0)) {
      assert.ok(Math.abs(c.delta) < 1e-12, `${c.score} delta ${c.delta}`);
      assert.ok(Math.abs(c.tau - 1) < 1e-12);
    }
    assert.ok(Math.abs(DC_RHO_MLE - DC_RHO) < 0.01);
  });
});

describe("Maher independent Poisson", () => {
  it("factors desk league means as α × β × γ", () => {
    const { lambdaH, lambdaA } = maherLambdas(DESK_MAHER_PARAMS);
    assert.ok(Math.abs(lambdaH - LEAGUE_MEAN_HOME) < 1e-12, `λh ${lambdaH}`);
    assert.ok(Math.abs(lambdaA - LEAGUE_MEAN_AWAY) < 1e-12, `λa ${lambdaA}`);
    assert.ok(Math.abs(MAHER_HOME_ADV - LEAGUE_MEAN_HOME / LEAGUE_MEAN_AWAY) < 1e-12);
    assert.equal(DESK_MAHER_PARAMS.defenceAway, 1);
    assert.equal(DESK_MAHER_PARAMS.defenceHome, 1);
  });

  it("uses γ = 1.31 for the 1982 average team", () => {
    const { lambdaH, lambdaA } = maherLambdas(PAPER_MAHER_PARAMS);
    assert.equal(MAHER_HOME_ADV_1982, 1.31);
    assert.ok(Math.abs(lambdaH - 1.31) < 1e-12, `λh ${lambdaH}`);
    assert.ok(Math.abs(lambdaA - 1) < 1e-12, `λa ${lambdaA}`);
  });

  it("the 1982 book is lower scoring, and 1-1 is the product of the margins", () => {
    const z = maherBaseline();
    assert.ok(Math.abs(z.attackHome - 1.12) < 1e-12);
    assert.equal(z.ouWeight, 0.1);
    assert.ok(Math.abs(z.desk.lambdaH - 1.38) < 1e-12);
    assert.ok(Math.abs(z.desk.lambdaA - 1.12) < 1e-12);
    assert.ok(Math.abs(z.paper.lambdaH - 1.31) < 1e-12);
    assert.ok(Math.abs(z.paper.lambdaA - 1) < 1e-12);
    assert.ok(Math.abs(z.desk.cell11 - z.desk.product11) < 1e-12);
    assert.ok(Math.abs(z.desk.grid.p00 - z.desk.p00) < 1e-4);
    assert.ok(Math.abs(z.desk.grid.over25 - z.desk.over25) < 1e-4);
    assert.ok(Math.abs(z.desk.skellam.draw - z.desk.grid.draw) < 1e-4);
    assert.ok(z.paper.total < z.desk.total);
    assert.ok(z.paper.gamma > z.desk.gamma);
    assert.ok(z.paper.over25 < z.desk.over25);
    assert.ok(z.paper.grid.away < z.desk.grid.away);
  });

  it("round-trips lambdas with defence pinned at 1", () => {
    const recovered = maherFromLambdas(1.38, 1.12);
    const { lambdaH, lambdaA } = maherLambdas(recovered);
    assert.ok(Math.abs(lambdaH - 1.38) < 1e-12);
    assert.ok(Math.abs(lambdaA - 1.12) < 1e-12);
    assert.equal(recovered.defenceAway, 1);
    assert.equal(recovered.defenceHome, 1);
    assert.ok(Math.abs(recovered.homeAdv - MAHER_HOME_ADV) < 1e-12);
    assert.ok(Math.abs(recovered.attackHome - 1.38 / MAHER_HOME_ADV) < 1e-12);
  });

  it("maherGrid is jointGrid at ρ = 0", () => {
    const a = maherGrid(1.38, 1.12);
    const b = jointGrid(1.38, 1.12, 0);
    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 4; y++) {
        assert.ok(Math.abs(a[x]![y]! - b[x]![y]!) < 1e-15, `${x}-${y}`);
      }
    }
  });

  it("untruncated cell is the product of Poisson PMFs", () => {
    const lh = 1.38;
    const la = 1.12;
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ] as const) {
      const product = poissonPmf(x, lh) * poissonPmf(y, la);
      assert.ok(Math.abs(maherCell(lh, la, x, y) - product) < 1e-15, `${x}-${y}`);
    }
  });

  it("truncated 8×8 grid ratio is close to 1 but not exact", () => {
    const lh = 1.38;
    const la = 1.12;
    const grid = maherGrid(lh, la);
    const product11 = maherCell(lh, la, 1, 1);
    const ratio = grid[1]![1]! / product11;
    assert.ok(ratio > 1 && ratio < 1.02, `ratio ${ratio}`);
    assert.ok(Math.abs(ratio - 1) > 1e-6, "truncation should move mass");
  });

  it("BTTS closed form is (1−e^{−λ})(1−e^{−μ})", () => {
    const lh = 1.38;
    const la = 1.12;
    const closed = maherBttsClosed(lh, la);
    const expected = (1 - Math.exp(-lh)) * (1 - Math.exp(-la));
    assert.ok(Math.abs(closed - expected) < 1e-15);
    const grid = maherGrid(lh, la);
    let btts = 0;
    for (let x = 1; x < grid.length; x++) {
      for (let y = 1; y < grid[x]!.length; y++) btts += grid[x]![y]!;
    }
    assert.ok(Math.abs(btts - closed) < 0.02, `grid BTTS ${btts} vs closed ${closed}`);
  });

  it("over 1.5 / 2.5 closed forms match 1 − P(total < line)", () => {
    const lh = 1.38;
    const la = 1.12;
    const o15 = maherOver15(lh, la);
    const under15 =
      maherCell(lh, la, 0, 0) + maherCell(lh, la, 1, 0) + maherCell(lh, la, 0, 1);
    assert.ok(Math.abs(o15 - (1 - under15)) < 1e-12);
    const o25 = maherOver25Closed(lh, la);
    let under25 = 0;
    for (let x = 0; x <= 2; x++) {
      for (let y = 0; y <= 2 - x; y++) under25 += maherCell(lh, la, x, y);
    }
    assert.ok(Math.abs(o25 - (1 - under25)) < 1e-12);
    assert.ok(o25 < o15);
  });

  it("underestimates the draw versus Dixon–Coles at paper ρ", () => {
    const lh = 1.38;
    const la = 1.12;
    const maher = maherGrid(lh, la);
    const dc = jointGrid(lh, la, DC_RHO);
    let mDraw = 0;
    let dDraw = 0;
    for (let k = 0; k < maher.length; k++) {
      mDraw += maher[k]![k]!;
      dDraw += dc[k]![k]!;
    }
    assert.ok(dDraw > mDraw, `DC draw ${dDraw} vs Maher ${mDraw}`);
    assert.ok(gridCellP(dc, "0-0") > gridCellP(maher, "0-0"));
    assert.ok(gridCellP(dc, "1-1") > gridCellP(maher, "1-1"));
  });
});

describe("BTTS derivation", () => {
  const lh = 1.38;
  const la = 1.12;

  it("product equals inclusion–exclusion on independent Poisson", () => {
    const parts = maherBttsParts(lh, la);
    const product = (1 - Math.exp(-lh)) * (1 - Math.exp(-la));
    const inclusion = 1 - Math.exp(-lh) - Math.exp(-la) + Math.exp(-(lh + la));
    assert.ok(Math.abs(parts.product - product) < 1e-15);
    assert.ok(Math.abs(parts.btts - inclusion) < 1e-15);
    assert.ok(Math.abs(parts.product - parts.btts) < 1e-15);
    assert.ok(Math.abs(maherBttsClosed(lh, la) - parts.product) < 1e-15);
  });

  it("holds as an identity on Maher, Dixon–Coles and Karlis grids", () => {
    for (const grid of [maherGrid(lh, la), jointGrid(lh, la, DC_RHO), bivariateGrid(lh, la, KARLIS_COV)]) {
      const p = bttsPartsFromGrid(grid);
      const identity = 1 - p.pHome0 - p.pAway0 + p.p00;
      assert.ok(Math.abs(p.btts - identity) < 1e-12, `btts ${p.btts} vs identity ${identity}`);
    }
  });

  it("Karlis lifts P(0-0) and BTTS without moving Poisson margins", () => {
    const m = maherBttsParts(lh, la);
    const k = karlisBttsParts(lh, la, KARLIS_COV);
    assert.equal(KARLIS_COV, 0.12);
    assert.ok(Math.abs(k.pHome0 - m.pHome0) < 1e-15, "P(H=0) stays e^{−λ}");
    assert.ok(Math.abs(k.pAway0 - m.pAway0) < 1e-15, "P(A=0) stays e^{−μ}");
    assert.ok(k.p00 > m.p00, `P(00) Karlis ${k.p00} vs Maher ${m.p00}`);
    assert.ok(k.btts > m.btts, `BTTS Karlis ${k.btts} vs Maher ${m.btts}`);
    assert.ok(k.exactlyOne < m.exactlyOne);
    const zero = karlisBttsParts(lh, la, 0);
    assert.ok(Math.abs(zero.btts - m.btts) < 1e-15);
  });

  it("closed Karlis P(0-0) is exp(−(λ+μ−c))", () => {
    const k = karlisBttsParts(lh, la, 0.12);
    assert.ok(Math.abs(k.p00 - Math.exp(-(lh + la - 0.12))) < 1e-15);
    assert.ok(Math.abs(k.cov - 0.12) < 1e-15);
  });

  it("Frank copula θ = 0 recovers independent Poisson", () => {
    const m = maherBttsParts(lh, la);
    const c = copulaBttsParts(lh, la, 0);
    assert.ok(Math.abs(c.p00 - m.p00) < 1e-9);
    assert.ok(Math.abs(c.btts - m.btts) < 1e-9);
    assert.ok(Math.abs(frankCopula(0.25, 0.33, 0) - 0.25 * 0.33) < 1e-12);
  });

  it("positive Frank θ lifts 0-0 and BTTS the way Karlis does", () => {
    const m = maherBttsParts(lh, la);
    const c = copulaBttsParts(lh, la, FRANK_THETA);
    assert.ok(c.p00 > m.p00, `P(00) copula ${c.p00} vs Maher ${m.p00}`);
    assert.ok(c.btts > m.btts, `BTTS copula ${c.btts} vs Maher ${m.btts}`);
    assert.ok(Math.abs(c.pHome0 - m.pHome0) < 1e-15);
    const grid = copulaGrid(lh, la, FRANK_THETA);
    const parts = bttsPartsFromGrid(grid);
    assert.ok(Math.abs(parts.btts - (1 - parts.pHome0 - parts.pAway0 + parts.p00)) < 1e-12);
    let sum = 0;
    for (const row of grid) for (const v of row) sum += v;
    assert.ok(Math.abs(sum - 1) < 1e-9, `copula grid ${sum}`);
  });

  it("Karlis is a shared shock, not the Frank copula", () => {
    const d = jointDependence(1.38, 1.12, 0.12, 0.8);
    assert.ok(Math.abs(d.l1 + d.l3 - 1.38) < 1e-9);
    assert.ok(Math.abs(d.l2 + d.l3 - 1.12) < 1e-9);
    assert.ok(Math.abs(d.gdVarKarlis - (1.38 + 1.12 - 2 * 0.12)) < 1e-9);
    assert.ok(d.gdVarKarlis < d.gdVarIndep);
    assert.ok(d.karlis.p00 > d.maher.p00);
    assert.ok(d.frank.p00 > d.maher.p00);
    assert.ok(d.karlis.draw > d.maher.draw);
    assert.ok(Math.abs(d.karlis.p11 - d.frank.p11) > 1e-4);
    const off = d.cells.find((c) => c.score === "2-0");
    assert.ok(off && Math.abs(off.karlis - off.frank) > 1e-4);
    const gone = jointDependence(1.38, 1.12, 0, 0);
    assert.equal(gone.closedL3, 0);
    assert.equal(gone.l3, 0.02);
    assert.ok(Math.abs(gone.frank.p00 - gone.maher.p00) < 1e-5);
  });

  it("Goddard / Baio is Poisson BTTS when H2H is empty", () => {
    const g = goddardBtts({
      lambdaH: 2.1,
      lambdaA: 1.6,
      leagueHome: lh,
      leagueAway: la,
      h2hHits: 0,
      h2hN: 0,
    });
    const poisson = maherBttsClosed(2.1, 1.6);
    assert.ok(Math.abs(g - poisson) < 1e-12, `empty H2H should be Poisson ${poisson}, got ${g}`);
    const blended = structuralBttsP(0.5, copulaBtts(lh, la), karlisBttsParts(lh, la).btts, g);
    assert.ok(blended > 0.3 && blended < 0.8);
  });

  it("partial pooling sits between H2H MLE and the Poisson prior", () => {
    const h = hierarchicalBtts({
      lambdaH: lh,
      lambdaA: la,
      leagueHome: lh,
      leagueAway: la,
      h2hHits: 8,
      h2hN: 10,
      kappa: BTTS_HIER_KAPPA,
    });
    assert.equal(h.completePooling, h.league);
    assert.ok(h.partial > Math.min(h.noPooling, h.hyperMean) - 1e-12);
    assert.ok(h.partial < Math.max(h.noPooling, h.hyperMean) + 1e-12);
    assert.ok(h.weightData > 0.5 && h.weightData < 0.7, `w ${h.weightData}`);
    assert.ok(h.lo < h.partial && h.hi > h.partial);
    const logitP = logitPartialPool(0.8, 0.5, 10, 0.35);
    assert.ok(logitP > 0.5 && logitP < 0.8);
  });
});

describe("1X2 and over/under structural", () => {
  const lh = LEAGUE_MEAN_HOME;
  const la = LEAGUE_MEAN_AWAY;

  it("Skellam PMF sums and matches Maher 1X2", () => {
    let s = 0;
    for (let k = -12; k <= 12; k++) s += skellamPmf(k, lh, la);
    assert.ok(Math.abs(s - 1) < 0.01, `Skellam mass ${s}`);
    const sk = skellam1x2(lh, la);
    const maher = marketsFromGrid(maherGrid(lh, la));
    assert.ok(Math.abs(sk.home - maher.home) < 0.025, `home ${sk.home} vs ${maher.home}`);
    assert.ok(Math.abs(sk.draw - maher.draw) < 0.025, `draw ${sk.draw} vs ${maher.draw}`);
    const tot = sk.home + sk.draw + sk.away;
    assert.ok(Math.abs(tot - 1) < 1e-12);
  });

  it("Bessel PMF matches the Poisson convolution and the moment map", () => {
    for (const k of [-3, -1, 0, 1, 4]) {
      const b = skellamPmf(k, lh, la);
      const c = skellamConvPmf(k, lh, la);
      assert.ok(Math.abs(b - c) < 2e-4, `k=${k} Bessel ${b} conv ${c}`);
    }
    const m = skellamMoments(lh, la);
    assert.ok(Math.abs(m.mean - (lh - la)) < 1e-12);
    assert.ok(Math.abs(m.variance - (lh + la)) < 1e-12);
    const back = skellamFromMeanVar(m.mean, m.variance);
    assert.ok(Math.abs(back.lambdaH - lh) < 1e-9);
    assert.ok(Math.abs(back.lambdaA - la) < 1e-9);
    assert.ok(Math.abs(Math.exp(logBesselI(0, 0)) - 1) < 1e-12);
  });

  it("Fox–Glynn recurrence fills a Poisson PMF and the draw is the diagonal convolution", () => {
    const p = poissonPmfArray(lh, 16);
    assert.ok(Math.abs(p[0]! - Math.exp(-lh)) < 1e-12);
    for (let k = 1; k <= 8; k++) {
      assert.ok(Math.abs(p[k]! - p[k - 1]! * (lh / k)) < 1e-12, `recurrence k=${k}`);
      assert.ok(Math.abs(p[k]! - poissonPmf(k, lh)) < 1e-12);
    }
    let mass = 0;
    for (const x of p) mass += x;
    assert.ok(mass > 0.999 && mass <= 1 + 1e-12, `poisson mass ${mass}`);
    const sk = skellam1x2(lh, la);
    const draw = skellamDrawConv(lh, la);
    assert.ok(Math.abs(draw - sk.draw) < 1e-9, `draw conv ${draw} vs ${sk.draw}`);
    const conv = poissonConv1x2(lh, la);
    assert.ok(Math.abs(conv.home - sk.home) < 1e-12);
    const live = poissonConv1x2(lh, la, 1, 0);
    assert.ok(live.home > sk.home);
  });

  it("common-shock Skellam is the untruncated Karlis 1X2", () => {
    const rates = karlisRates(lh, la);
    assert.ok(rates.l1 < lh && rates.l2 < la);
    const shock = karlisSkellam1x2(lh, la);
    const indep = skellam1x2(lh, la);
    assert.ok(shock.draw > indep.draw, `shock draw ${shock.draw} vs ${indep.draw}`);
    const grid = marketsFromGrid(bivariateGrid(lh, la));
    assert.ok(Math.abs(shock.home - grid.home) < 0.02, `Karlis closed ${shock.home} vs grid ${grid.home}`);
    assert.ok(Math.abs(shock.draw - grid.draw) < 0.02);
  });

  it("in-play Skellam is kick-off at τ=1 and the scoreline at τ=0", () => {
    const pre = skellam1x2(lh, la);
    const kick = skellamInPlay1x2(lh, la, 0, 0, 1);
    assert.ok(Math.abs(kick.home - pre.home) < 0.02);
    const done = skellamInPlay1x2(lh, la, 2, 1, 0);
    assert.equal(done.home, 1);
    assert.equal(done.draw, 0);
    const lead = skellamInPlay1x2(lh, la, 1, 0, 0.2);
    assert.ok(lead.home > pre.home);
  });

  it("NegBin Skellam fattens |GD| and cuts the draw versus Poisson", () => {
    const sk = skellam1x2(lh, la);
    const nb = negBinSkellam1x2(lh, la, 4);
    assert.ok(nb.draw < sk.draw, `NB draw ${nb.draw} vs ${sk.draw}`);
    const nrm = skellamNormal1x2(lh, la);
    assert.ok(Math.abs(nrm.home - sk.home) < 0.08, `normal home ${nrm.home} vs ${sk.home}`);
  });

  it("NB2 moments, Poisson limit, and frailty extra variance", () => {
    const r = 8;
    const mu = lh;
    const m = negBinMoments(mu, r);
    assert.ok(Math.abs(m.variance - (mu + (mu * mu) / r)) < 1e-12);
    assert.ok(Math.abs(m.p0 - Math.pow(r / (r + mu), r)) < 1e-12);
    const tab = negBinPmfArray(mu, r, 12);
    assert.ok(Math.abs((tab[0] ?? 0) - m.p0) < 1e-12);
    const back = negBinFromMoments(m.mean, m.variance);
    assert.ok(Math.abs(back.r - r) < 1e-9);
    assert.equal(negBinRFromVmr(mu, 1), Number.POSITIVE_INFINITY);
    const yipR = negBinRFromVmr(lh + la, YIP_GOAL_VMR);
    assert.ok(yipR > 40, `Yip r ${yipR}`);
    const poi = poissonPmfArray(mu, 8);
    const fat = negBinPmfArray(mu, 400, 8);
    for (let k = 0; k <= 6; k++) {
      assert.ok(Math.abs((fat[k] ?? 0) - (poi[k] ?? 0)) < 0.01, `limit k=${k}`);
    }
    const ind = negBinIndependentTotalVar(lh, la, r);
    const fr = negBinFrailtyTotalVar(lh, la, r);
    assert.ok(fr > ind + 0.05, `frailty ${fr} vs independent ${ind}`);
    const o15 = negBinOverAtLeast(2, lh, la, r);
    assert.ok(Math.abs(o15 - negBinOver15(lh, la, r)) < 1e-12);
    assert.ok(o15 > 0.55 && o15 < 0.9);
  });

  it("Dixon–Coles lifts the draw versus independent Skellam", () => {
    const sk = skellam1x2(lh, la);
    const dc = marketsFromGrid(jointGrid(lh, la, DC_RHO));
    assert.ok(dc.draw > sk.draw, `DC draw ${dc.draw} vs Skellam ${sk.draw}`);
  });

  it("zero-inflated Skellam and diagonal inflate add draw mass", () => {
    const sk = skellam1x2(lh, la);
    const zi = ziSkellam1x2(lh, la, ZI_SKELLAM_PI);
    assert.ok(zi.draw > sk.draw);
    assert.ok(zi.home < sk.home);
    const dc = jointGrid(lh, la, DC_RHO);
    const inf = marketsFromGrid(diagonalInflate(dc));
    const raw = marketsFromGrid(dc);
    assert.ok(inf.draw > raw.draw, `inflated draw ${inf.draw} vs ${raw.draw}`);
  });

  it("ZIP extra zeros, mean-preserving rate, and (0,0) vs diagonal", () => {
    const pi = ZIP_PI;
    const z0 = zipPmf(0, lh, pi);
    const poi0 = poissonPmf(0, lh);
    assert.ok(z0 > poi0);
    assert.ok(Math.abs(zipPmf(0, lh, 0) - poi0) < 1e-12);
    const mom = zipMoments(lh, pi);
    assert.ok(Math.abs(mom.mean - (1 - pi) * lh) < 1e-12);
    assert.ok(mom.vmr > 1);
    const rate = zipMeanPreservingRate(lh, pi);
    assert.ok(Math.abs((1 - pi) * rate - lh) < 1e-9);
    const hat = zipPiFromZeroFreq(z0, lh);
    assert.ok(Math.abs(hat - pi) < 1e-9, `π̂ ${hat}`);
    assert.equal(zipPiFromZeroFreq(poi0, lh), 0);
    const zipG = zipGrid(lh, la, pi);
    const maher = maherGrid(lh, la);
    const zipB = bttsPartsFromGrid(zipG);
    const maherB = bttsPartsFromGrid(maher);
    assert.ok(zipB.btts < maherB.btts, `ZIP BTTS ${zipB.btts} vs ${maherB.btts}`);
    const only00 = zeroInflate00(maher, pi);
    assert.ok((only00[0]![0] ?? 0) > (maher[0]![0] ?? 0));
    const diag = diagonalInflate(maher, pi);
    assert.ok((diag[1]![1] ?? 0) > (only00[1]![1] ?? 0), "diagonal lifts 1-1; (0,0)-only does not");
    assert.ok(zinbPmf(0, lh, 8, pi) > zipPmf(0, lh, pi));
  });

  it("Goddard 1X2 returns the prior when H2H is empty and shrinks toward results", () => {
    const prior = { home: 0.46, draw: 0.27, away: 0.27 };
    const empty = goddardResult({
      priorHome: prior.home,
      priorDraw: prior.draw,
      priorAway: prior.away,
      homeHits: 0,
      drawHits: 0,
      awayHits: 0,
    });
    assert.ok(Math.abs(empty.home - prior.home) < 1e-12);
    const hit = goddardResult({
      priorHome: prior.home,
      priorDraw: prior.draw,
      priorAway: prior.away,
      homeHits: 6,
      drawHits: 1,
      awayHits: 1,
    });
    assert.ok(hit.home > empty.home);
    assert.ok(hit.home < 0.75);
  });

  it("structural 1X2 sits between the five goal/result models", () => {
    const dc = marketsFromGrid(jointGrid(lh, la, DC_RHO));
    const sk = skellam1x2(lh, la);
    const karlis = marketsFromGrid(bivariateGrid(lh, la));
    const god = goddardResult({
      priorHome: dc.home,
      priorDraw: dc.draw,
      priorAway: dc.away,
      homeHits: 3,
      drawHits: 2,
      awayHits: 1,
    });
    const inf = ziSkellam1x2(lh, la);
    const p = structuralWinP(dc.home, sk.home, karlis.home, god.home, inf.home);
    const xs = [dc.home, sk.home, karlis.home, god.home, inf.home];
    assert.ok(p > Math.min(...xs) - 1e-12 && p < Math.max(...xs) + 1e-12);
    assert.ok(p > 0.3 && p < 0.6);
  });

  it("Weibull-count PMF sums and overdisperses versus Poisson", () => {
    const q = weibullQForMean(lh, WEIBULL_SHAPE);
    let s = 0;
    let mean = 0;
    for (let k = 0; k <= 16; k++) {
      const p = weibullCountPmf(k, q);
      s += p;
      mean += k * p;
    }
    assert.ok(Math.abs(s - 1) < 0.02, `weibull mass ${s}`);
    assert.ok(Math.abs(mean - lh) < 0.12, `mean ${mean}`);
    assert.ok(weibullCountPmf(0, q) > poissonPmf(0, lh));
  });

  it("Panjer compound with severity 1 recovers Poisson; Pólya–Aeppli overdisperses", () => {
    const lam = lh + la;
    const count = panjerAb0Poisson(lam);
    const ones = geometricSeverity(1, 16);
    assert.equal(ones[1], 1);
    const rec = panjerCompound(count.a, count.b, count.p0, ones, 16);
    const raw = poissonPmfArray(lam, 16);
    for (let k = 0; k <= 8; k++) {
      assert.ok(Math.abs((rec[k] ?? 0) - (raw[k] ?? 0)) < 2e-6, `k=${k} Panjer ${rec[k]} Poi ${raw[k]}`);
    }
    const pa = polyaAeppliPmf(lam, POLYA_RHO, 20);
    const panjerPa = panjerCompound(
      panjerAb0Poisson(lam * POLYA_RHO).a,
      panjerAb0Poisson(lam * POLYA_RHO).b,
      panjerAb0Poisson(lam * POLYA_RHO).p0,
      geometricSeverity(POLYA_RHO, 20),
      20,
    );
    let mass = 0;
    let mean = 0;
    for (let k = 0; k <= 20; k++) {
      mass += pa[k] ?? 0;
      mean += k * (pa[k] ?? 0);
      assert.ok(Math.abs((pa[k] ?? 0) - (panjerPa[k] ?? 0)) < 2e-5, `Evans vs Panjer k=${k}`);
    }
    assert.ok(Math.abs(mass - 1) < 0.02, `PA mass ${mass}`);
    assert.ok(Math.abs(mean - lam) < 0.12, `PA mean ${mean}`);
    assert.ok((pa[0] ?? 0) > poissonPmf(0, lam), "compound P(0) exceeds Poisson");
    for (const k of [0, 1, 2, 4]) {
      const closed = polyaAeppliClosedPmf(k, lam, POLYA_RHO);
      assert.ok(Math.abs(closed - (pa[k] ?? 0)) < 2e-5, `closed k=${k} ${closed} vs Evans ${pa[k]}`);
    }
    const mom = polyaAeppliMoments(lam, POLYA_RHO);
    assert.ok(Math.abs(mom.vmr - (2 - POLYA_RHO) / POLYA_RHO) < 1e-12);
    const poi25 = maherOver25Closed(lh, la);
    const pa25 = polyaAeppliOverAtLeast(3, lh, la, 1);
    assert.ok(Math.abs(pa25 - poi25) < 0.02, `ρ=1 Over 2.5 ${pa25} vs ${poi25}`);
    const sk = skellam1x2(lh, la);
    const pa1x2 = polyaAeppli1x2(lh, la);
    assert.ok(pa1x2.draw < sk.draw, `PA draw ${pa1x2.draw} vs Skellam ${sk.draw}`);
    const tot = pa1x2.home + pa1x2.draw + pa1x2.away;
    assert.ok(Math.abs(tot - 1) < 1e-12);
    const back = polyaFromMoments(mom.mean, mom.variance);
    assert.ok(Math.abs(back.rho - POLYA_RHO) < 1e-9, `moment ρ ${back.rho}`);
    assert.equal(polyaRhoFromVmr(1), 1);
    const yipRho = polyaRhoFromVmr(YIP_GOAL_VMR);
    assert.ok(yipRho > 0.97 && yipRho < 1, `Yip ρ ${yipRho}`);
    const zf = polyaRhoFromZeroFreq(pa[0] ?? 0, lam);
    assert.ok(Math.abs(zf - POLYA_RHO) < 0.05, `zero-freq ρ ${zf}`);
    const shockPa = polyaKarlis1x2(lh, la);
    assert.ok(shockPa.draw > pa1x2.draw, `Type I draw ${shockPa.draw} vs ${pa1x2.draw}`);
    const shockPoi = polyaKarlis1x2(lh, la, KARLIS_COV, 1);
    const karlis = karlisSkellam1x2(lh, la);
    assert.ok(Math.abs(shockPoi.draw - karlis.draw) < 0.02, `ρ=1 Type I ${shockPoi.draw} vs Karlis ${karlis.draw}`);
  });

  it("structural O/U 2.5 is a convex mix inside the engine range", () => {
    const dc = marketsFromGrid(jointGrid(lh, la, DC_RHO));
    const maher = maherOver25Closed(lh, la);
    const karlis = marketsFromGrid(bivariateGrid(lh, la)).over25;
    const nb = 0.48;
    const w = weibullOverAtLeast(3, lh, la);
    const g = goddardOu({ prior: dc.over25, hits: 4, n: 8 });
    const p = structuralOuP(dc.over25, maher, karlis, nb, w, g);
    assert.ok(p > 0.35 && p < 0.7, `OU ${p}`);
    const empty = goddardOu({ prior: 0.48, hits: 0, n: 0 });
    assert.ok(Math.abs(empty - 0.48) < 1e-12);
  });

  it("API under 1.5 vetoes Over 2.5", () => {
    assert.equal(apiLineToOver25("-1.5").veto, true);
    assert.ok(apiLineToOver25("+2.5").p > 0.55);
    assert.ok(apiLineToOver25("-2.5").p < 0.45);
  });

  it("pickSanity drops coins, traps, and model-fair CS", () => {
    const base = {
      lambdaH: 1.38,
      lambdaA: 1.12,
      accuracy: 0.56,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null as string | null,
      winner: null as string | null,
      home: "Arsenal",
      away: "Everton",
    };
    assert.equal(pickSanity({ ...base, kind: "home" }), null);
    assert.equal(pickSanity({ ...base, kind: "home", accuracy: 0.52 }), null);
    assert.ok(pickSanity({ ...base, kind: "home", accuracy: 0.48 }));
    assert.ok(pickSanity({ ...base, kind: "home", lambdaH: 1.2, lambdaA: 1.15 }));
    assert.equal(pickSanity({ ...base, kind: "home", implied: 0.47 }), null);
    assert.ok(pickSanity({ ...base, kind: "home", implied: 0.32 }));
    assert.ok(pickSanity({ ...base, kind: "under_15" }));
    assert.ok(pickSanity({ ...base, kind: "away" }));
    assert.equal(pickSanity({ ...base, kind: "away", lambdaA: 1.5, lambdaH: 1.1 }), null);
    assert.ok(pickSanity({ ...base, kind: "cs", bookmaker: "Model fair" }));
    assert.equal(pickSanity({ ...base, kind: "over_25" }), null);
    assert.equal(pickSanity({ ...base, kind: "under_25" }), null);
    assert.ok(pickSanity({ ...base, kind: "over_25", lambdaH: 0.9, lambdaA: 0.8 }));
    assert.equal(pickSanity({ ...base, kind: "over_25", lambdaH: 1.7, lambdaA: 1.3 }), null);
    assert.equal(pickSanity({ ...base, kind: "under_25", lambdaH: 1.05, lambdaA: 0.95 }), null);
    assert.ok(
      pickSanity({
        ...base,
        kind: "under_25",
        lambdaH: 1.14,
        lambdaA: 0.9,
        odd: 1.4,
        implied: 1 / 1.4,
        accuracy: 0.75,
      }),
      "Under 2.5 at 1.40 is a lock",
    );
    assert.equal(
      pickSanity({
        ...base,
        kind: "under_25",
        lambdaH: 1.05,
        lambdaA: 0.95,
        odd: 1.55,
        implied: 1 / 1.55,
        accuracy: 0.66,
      }),
      null,
    );
    assert.ok(contradictsAdvice("away", { advice: "Winner : home team", winner: "Arsenal", home: "Arsenal", away: "Everton" }));
    assert.equal(
      contradictsAdvice("btts_no", { advice: "Both teams to score: No", winner: null, home: "A", away: "B" }),
      false,
    );
    assert.equal(
      contradictsAdvice("btts_yes", { advice: "Both teams to score: No", winner: null, home: "A", away: "B" }),
      true,
    );
    assert.equal(
      contradictsAdvice("btts_no", { advice: "Both teams to score: Yes", winner: null, home: "A", away: "B" }),
      true,
    );
  });
});

describe("Shin inversion", () => {
  it("z = 0 and matches multiplicative when the book has no overround", () => {
    const odds = [2, 3, 6];
    const fit = shinFit(odds);
    assert.ok(Math.abs(fit.overround) < 0.01, `overround ${fit.overround}`);
    assert.equal(fit.z, 0);
    const mul = multiplicativeDevig(odds);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs((fit.probs[i] ?? 0) - (mul[i] ?? 0)) < 1e-12);
    }
  });

  it("z > 0 on a typical 1X2 overround; probabilities sum to 1", () => {
    const odds = [1.9, 3.6, 4.2];
    const fit = shinFit(odds);
    assert.ok(fit.overround > 0.03, `overround ${fit.overround}`);
    assert.ok(fit.z > 0.005 && fit.z < 0.25, `z ${fit.z}`);
    const s = fit.probs.reduce((a: number, b: number) => a + b, 0);
    assert.ok(Math.abs(s - 1) < 1e-9, `sum ${s}`);
  });

  it("Shin puts more mass on the favourite than multiplicative (FLB correction)", () => {
    const odds = [1.5, 4.2, 7];
    const shin = shinInvert(odds);
    const mul = multiplicativeDevig(odds);
    const pow = powerDevig(odds);
    assert.ok((shin[0] ?? 0) > (mul[0] ?? 0), `Shin ${shin[0]} vs mul ${mul[0]}`);
    assert.ok((pow[0] ?? 0) > (mul[0] ?? 0), `power ${pow[0]} vs mul ${mul[0]}`);
    assert.ok((shin[2] ?? 0) < (mul[2] ?? 0), `Shin longshot ${shin[2]} vs mul ${mul[2]}`);
  });

  it("additive can floor a longshot; Shin stays strictly positive", () => {
    const odds = [1.1, 3.5, 15];
    const add = additiveDevig(odds);
    const shin = shinInvert(odds);
    assert.ok((add[2] ?? 1) < 0.005, `additive tail ${add[2]}`);
    assert.ok((shin[2] ?? 0) > (add[2] ?? 1), `Shin ${shin[2]} vs additive ${add[2]}`);
    assert.ok(Math.abs(shin.reduce((a: number, b: number) => a + b, 0) - 1) < 1e-9);
  });
});

describe("Egidi mix and pi-ratings", () => {
  it("inverts a balanced 1X2 into λ near league means", () => {
    const mkt = invert1x2Report(0.45, 0.27, 0.28, DC_RHO);
    assert.ok(mkt.lambdaH > mkt.lambdaA, `home ${mkt.lambdaH} vs away ${mkt.lambdaA}`);
    assert.ok(mkt.lambdaH > 1.1 && mkt.lambdaH < 1.9, `λh ${mkt.lambdaH}`);
    assert.ok(mkt.lambdaA > 0.8 && mkt.lambdaA < 1.5, `λa ${mkt.lambdaA}`);
    assert.ok(Math.abs(mkt.fitted.home - 0.45) < 0.04, `home ${mkt.fitted.home}`);
    assert.ok(Math.abs(mkt.fitted.draw - 0.27) < 0.04, `draw ${mkt.fitted.draw}`);
    assert.ok(mkt.sse < 0.004, `sse ${mkt.sse}`);
  });

  it("mixes 32% history with 68% market", () => {
    assert.equal(EGIDI_HIST_WEIGHT, 0.32);
    const m = egidiMix(1.2, 1.0, 2.0, 0.6);
    assert.ok(Math.abs(m.lambdaH - (0.32 * 1.2 + 0.68 * 2.0)) < 1e-12);
    assert.ok(Math.abs(m.lambdaA - (0.32 * 1.0 + 0.68 * 0.6)) < 1e-12);
  });

  it("ψ is odd, zero at 0, and flattens large blowouts", () => {
    assert.equal(piPsi(0), 0);
    assert.ok(Math.abs(piPsi(2) + piPsi(-2)) < 1e-15);
    assert.ok(piPsi(4) < 4);
    assert.ok(piPsi(1) > piPsi(0.4));
    assert.equal(PI_LEARNING, 0.035);
    assert.equal(PI_CATCHUP, 0.7);
  });

  it("a home 2-0 lifts current home home-rating and cuts away away-rating", () => {
    const before = walkPiRatings([]);
    const after = walkPiRatings([
      { homeGoals: 2, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 14 },
    ]);
    assert.ok(after.homeH > before.homeH);
    assert.ok(after.awayA < before.awayA);
    const lam = piToLambdas(after);
    assert.ok(lam.lambdaH > LEAGUE_MEAN_HOME);
    assert.ok(lam.lambdaA < LEAGUE_MEAN_AWAY);
  });

  it("Over 2.5 at 50% implies a total near 2.7", () => {
    const tot = totalFromOver25(0.5);
    assert.ok(tot > 2.4 && tot < 3.1, `tot ${tot}`);
  });

  it("ρ is more negative when expected goals are low", () => {
    const low = matchRho(0.9, 0.7);
    const high = matchRho(1.8, 1.6);
    assert.ok(low < DC_RHO, `low ${low}`);
    assert.ok(high > DC_RHO, `high ${high}`);
    assert.ok(low > rhoBounds(0.9, 0.7).lo);
  });

  it("a de-vigged book pulls 1X2 accuracy toward the book, not the grid", () => {
    const ens = ensembleForKind("home", { dc: 0.72, shin: 0.46, api: 0.7, elo: 0.68, h2h: 0.64 });
    const toBook = Math.abs(ens.accuracy - 0.46);
    const toGrid = Math.abs(ens.accuracy - 0.72);
    assert.ok(toBook < toGrid, `accuracy ${ens.accuracy} should sit nearer 0.46 than 0.72`);
    assert.ok(ens.value > 0.55, `value still follows the model, got ${ens.value}`);
  });

  it("log opinion pool sits between the models and is closer to the geometric mean", () => {
    const ens = ensembleForKind("home", {
      dc: 0.4,
      shin: 0.5,
      api: 0.45,
      elo: 0.42,
      h2h: 0.38,
    });
    assert.ok(ens.accuracy > 0.38 && ens.accuracy < 0.55);
    assert.ok(ens.value > 0.05);
    assert.ok(ens.i2 >= 0 && ens.i2 <= 1);
  });

  it("API disagreement does not collapse agreement when Shin exists", () => {
    const calm = ensembleForKind("home", {
      dc: 0.54,
      shin: 0.52,
      api: 0.54,
      elo: 0.53,
      h2h: 0.51,
    });
    const noisyApi = ensembleForKind("home", {
      dc: 0.54,
      shin: 0.52,
      api: 0.22,
      elo: 0.53,
      h2h: 0.51,
    });
    assert.ok(noisyApi.agreement > 0.35, `agreement ${noisyApi.agreement}`);
    assert.ok(Math.abs(noisyApi.agreement - calm.agreement) < 0.08);
  });
});

describe("meta-analysis pooling", () => {
  it("I² is 0 when every model prints the same probability", () => {
    const h = metaHeterogeneity([0.44, 0.44, 0.44, 0.44, 0.44]);
    assert.equal(h.i2, 0);
    assert.equal(h.tau2, 0);
    assert.ok(h.q < 0.01);
  });

  it("I² is high when the five models quarrel", () => {
    const h = metaHeterogeneity([0.22, 0.48, 0.55, 0.31, 0.7]);
    assert.ok(h.i2 > 0.5, `I² ${h.i2}`);
    assert.ok(h.tau2 > 0);
  });

  it("extremizing pushes 0.65 away from ½ only when I² is low", () => {
    const tight = extremize(0.65, satopaaA(0));
    const loose = extremize(0.65, satopaaA(1));
    assert.ok(tight > 0.65, `a=${satopaaA(0)} → ${tight}`);
    assert.ok(Math.abs(loose - 0.65) < 1e-12);
    assert.equal(satopaaA(0), 1 + SATOPAA_MAX);
    assert.equal(satopaaA(1), 1);
  });

  it("ensemble agreement is 1 − I² and accuracy stays a probability", () => {
    const agree = ensembleForKind("home", { dc: 0.48, shin: 0.49, api: 0.47, elo: 0.48, h2h: 0.46 });
    const fight = ensembleForKind("home", { dc: 0.25, shin: 0.7, api: 0.4, elo: 0.35, h2h: 0.55 });
    assert.ok(agree.i2 < fight.i2);
    assert.ok(agree.agreement > fight.agreement);
    assert.ok(agree.accuracy > 0.45 && agree.accuracy < 0.6);
  });
});

describe("Bayesian model averaging", () => {
  const sources = [
    { id: "dc", label: "DC", p: 0.4, prior: 0.26 },
    { id: "shin", label: "Shin", p: 0.51, prior: 0.28 },
    { id: "api", label: "API", p: 0.47, prior: 0.18 },
    { id: "elo", label: "Elo", p: 0.41, prior: 0.16 },
    { id: "h2h", label: "H2H", p: 0.38, prior: 0.12 },
  ];

  it("n = 0 returns the prior weights", () => {
    const fit = bayesModelAverage(sources, 0.51, 0);
    assert.ok(Math.abs(fit.weights[1] - 0.28) < 1e-9);
    assert.ok(Math.abs(fit.weights[0] - 0.26) < 1e-9);
    assert.equal(kassRafteryGrade(1), "not worth a mention");
  });

  it("large n collapses onto the model nearest Shin", () => {
    const fit = bayesModelAverage(sources, 0.51, 20);
    const shinW = fit.weights[1];
    assert.ok(shinW > 0.8, `Shin weight ${shinW}`);
    assert.equal(fit.bestIndex, 1);
  });

  it("Occam's window drops models with BF > 20", () => {
    const fit = bayesModelAverage(sources, 0.51, 12, OCCAM_DELTA);
    assert.ok(fit.dropped[4], "far H2H should drop");
    assert.ok(!fit.dropped[1], "Shin should stay");
    assert.ok(Math.abs(fit.weights.reduce((a: number, b: number) => a + b, 0) - 1) < 1e-9);
  });

  it("one-observation stacking mixes so the pool hits Shin", () => {
    const s = stackMixture(sources, 0.51);
    assert.ok(Math.abs(s.pooled - 0.51) < 1e-9);
    const used = s.weights.filter((w: number) => w > 1e-6).length;
    assert.ok(used <= 2);
  });
});

describe("match data into λ", () => {
  const blank = {
    homeLast5For: null as number | null,
    homeLast5Against: null as number | null,
    awayLast5For: null as number | null,
    awayLast5Against: null as number | null,
    homeSeasonForHome: null as number | null,
    homeSeasonAgainstHome: null as number | null,
    awaySeasonForAway: null as number | null,
    awaySeasonAgainstAway: null as number | null,
    poissonShareHome: null as number | null,
    homePlayed: 10 as number | null,
    awayPlayed: 10 as number | null,
    injuryHome: 0,
    injuryAway: 0,
    homeForm: null as string | null,
    awayForm: null as string | null,
    h2h: [] as { homeGoals: number; awayGoals: number; homeIsCurrentHome: boolean; daysAgo: number }[],
    leagueAvgTotal: 2.5,
    leagueAvgHome: 1.38,
    leagueAvgAway: 1.12,
  };

  it("last-five from finished fixtures is newest 5, venue-split", () => {
    const rows = [3, 1, 2, 0, 4, 2, 1, 0].map((gf, i) => ({
      fixture: { timestamp: 1_700_000_000 + i * 86400, status: { short: "FT" } },
      teams: { home: { id: 1 }, away: { id: 2 } },
      goals: { home: gf, away: 1 },
    }));
    const l5 = last5FromFixtures(rows, 1, 5);
    assert.equal(l5.form?.length, 5);
    assert.ok(l5.forAvg != null && l5.forAvg > 1);
    const v = venueSplit(rows, 1, 4);
    assert.ok(v.home.forAvg != null);
    assert.equal(v.away.forAvg, null);
  });

  it("standings extract rank, GD, form", () => {
    const rows = extractStandings([
      {
        league: {
          standings: [
            [
              {
                rank: 2,
                points: 40,
                team: { id: 10 },
                goalsDiff: 18,
                form: "WWDLW",
                all: { played: 12, goals: { for: 28, against: 10 } },
              },
            ],
          ],
        },
      },
    ]);
    assert.equal(rows[0]?.rank, 2);
    assert.equal(rows[0]?.goalsDiff, 18);
    const pred = applyStandings(emptyPrediction(1), rows[0], undefined);
    assert.equal(pred.homeRank, 2);
    assert.equal(pred.homeGD, 18);
  });

  it("standings total played overwrites venue-count so GD is per game", () => {
    const pred = applyStandings(
      { ...emptyPrediction(1), homePlayed: 7, awayPlayed: 7 },
      {
        teamId: 1,
        rank: 2,
        points: 40,
        played: 14,
        goalsFor: 28,
        goalsAgainst: 10,
        goalsDiff: 18,
        form: "WWWWW",
      },
      {
        teamId: 2,
        rank: 16,
        points: 10,
        played: 14,
        goalsFor: 10,
        goalsAgainst: 24,
        goalsDiff: -14,
        form: "LLLLL",
      },
    );
    assert.equal(pred.homePlayed, 14);
    assert.equal(pred.awayPlayed, 14);
  });

  it("a 2nd vs 16th table gap lifts home λ versus a blank prior", () => {
    const base = estimateLambdas(blank);
    const ranked = estimateLambdas({
      ...blank,
      homeRank: 2,
      awayRank: 16,
      homeGD: 22,
      awayGD: -14,
    });
    assert.ok(ranked.lambdaH > base.lambdaH + 0.08, `λh ${ranked.lambdaH} vs ${base.lambdaH}`);
    assert.ok(ranked.lambdaA < base.lambdaA - 0.04, `λa ${ranked.lambdaA} vs ${base.lambdaA}`);
  });

  it("hot last-five scoring raises λ above the league prior", () => {
    const hot = estimateLambdas({
      ...blank,
      homeLast5For: 2.4,
      homeLast5Against: 0.6,
      awayLast5For: 0.6,
      awayLast5Against: 2.0,
      homeForm: "WWWWW",
      awayForm: "LLLLL",
    });
    assert.ok(hot.lambdaH > 1.55, `hot home ${hot.lambdaH}`);
    assert.ok(hot.lambdaA < 1.05, `cold away ${hot.lambdaA}`);
  });

  it("H2H dominance pulls λ toward those scores", () => {
    const h2h = [
      { homeGoals: 3, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 30 },
      { homeGoals: 2, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 60 },
      { homeGoals: 2, awayGoals: 1, homeIsCurrentHome: true, daysAgo: 90 },
      { homeGoals: 1, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 120 },
    ];
    const p = estimateLambdas({ ...blank, h2h });
    const q = estimateLambdas(blank);
    assert.ok(p.lambdaH > q.lambdaH, `h2h home ${p.lambdaH} vs ${q.lambdaH}`);
  });

  it("full sample raises Egidi history weight above the 0.32 default", () => {
    const thin = histWeightFromData(blank);
    const full = histWeightFromData({
      ...blank,
      homeLast5For: 1.8,
      homeLast5Against: 0.9,
      awayLast5For: 1.1,
      awayLast5Against: 1.4,
      homeSeasonForHome: 1.7,
      awaySeasonForAway: 1.0,
      homeVenueFor: 1.9,
      awayVenueFor: 0.9,
      homeRank: 3,
      awayRank: 12,
      h2h: [
        { homeGoals: 2, awayGoals: 1, homeIsCurrentHome: true, daysAgo: 20 },
        { homeGoals: 1, awayGoals: 1, homeIsCurrentHome: true, daysAgo: 40 },
        { homeGoals: 2, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 70 },
        { homeGoals: 1, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 100 },
      ],
    });
    assert.ok(thin <= EGIDI_HIST_WEIGHT + 0.05, `thin ${thin}`);
    assert.ok(full > 0.5, `full ${full}`);
    assert.ok(full > thin);
  });

  it("as-of cutoff drops matches on or after kickoff", () => {
    const rows = [
      { fixture: { timestamp: 1000, status: { short: "FT" } }, teams: { home: { id: 1 }, away: { id: 2 } }, goals: { home: 4, away: 0 } },
      { fixture: { timestamp: 2000, status: { short: "FT" } }, teams: { home: { id: 1 }, away: { id: 2 } }, goals: { home: 0, away: 0 } },
    ];
    const before = last5FromFixtures(rows, 1, 5, 1500);
    assert.equal(before.forAvg, 4);
    const samples = finishedSamples(rows, 1, 1500, 10);
    assert.equal(samples.length, 1);
    assert.equal(samples[0]?.gf, 4);
  });

  it("does not treat missing rates as zero", () => {
    const r = rollSamples([]);
    assert.equal(r.gf, null);
    assert.equal(r.failedToScore, null);
  });

  it("opponent adjustment inflates scoring against tight defences", () => {
    const samples = [
      { timestamp: 1, opponentId: 9, gf: 2, ga: 0, home: true },
      { timestamp: 2, opponentId: 9, gf: 2, ga: 1, home: true },
      { timestamp: 3, opponentId: 9, gf: 1, ga: 0, home: true },
    ];
    const table = [
      { teamId: 9, rank: 1, points: 28, played: 10, goalsFor: 22, goalsAgainst: 4, goalsDiff: 18, form: "WWWWW" },
    ];
    const adj = opponentAdjust(samples, table, 1.25);
    assert.ok(adj.attack != null && adj.attack > 1.67, `adj ${adj.attack}`);
  });

  it("FULL_DATA grade needs last-N, table, stats and odds", () => {
    const low = dataGrade({ lastN: 3, venueN: 0, standings: false, stats: false, h2h: 0, injuries: false, odds: true });
    const full = dataGrade({ lastN: 8, venueN: 4, standings: true, stats: true, h2h: 4, injuries: true, odds: true });
    assert.equal(low.grade, "LOW_DATA");
    assert.equal(full.grade, "FULL_DATA");
  });

  it("team statistics parse home/away averages and failed-to-score as a rate", () => {
    const st = extractTeamStatistics(
      {
        team: { id: 5 },
        fixtures: { played: { home: 8, away: 7, total: 15 } },
        goals: { for: { average: { home: "1.9", away: "1.1" } }, against: { average: { home: "0.8", away: "1.4" } } },
        failed_to_score: { total: 3 },
        clean_sheet: { total: 6 },
      },
      5,
    );
    assert.equal(st?.gfHome, 1.9);
    assert.ok(st && Math.abs((st.failedToScore ?? 0) - 0.2) < 1e-9);
    assert.ok(st && Math.abs((st.cleanSheet ?? 0) - 0.4) < 1e-9);
  });

  it("snapshot keeps one λ-path for both sides", () => {
    const homeSamples = [
      { timestamp: 1, opponentId: 2, gf: 2, ga: 0, home: true },
      { timestamp: 2, opponentId: 2, gf: 1, ga: 1, home: true },
      { timestamp: 3, opponentId: 2, gf: 2, ga: 1, home: false },
    ];
    const awaySamples = [
      { timestamp: 1, opponentId: 1, gf: 0, ga: 2, home: false },
      { timestamp: 2, opponentId: 1, gf: 1, ga: 1, home: false },
      { timestamp: 3, opponentId: 1, gf: 1, ga: 2, home: true },
    ];
    const snap = buildSnapshot({
      homeSamples,
      awaySamples,
      homeStats: null,
      awayStats: null,
      table: undefined,
      leagueGa: 1.12,
      h2hN: 0,
      hasInjuries: false,
      hasOdds: true,
    });
    assert.ok(snap.home.gf != null && snap.home.gf > snap.away.gf!);
    assert.ok(snap.quality > 0);
  });

  it("team statistics parse over/under, venue FTS and goal-timing shares", () => {
    const st = extractTeamStatistics(
      {
        team: { id: 5 },
        fixtures: { played: { home: 8, away: 7, total: 15 } },
        goals: {
          for: {
            average: { home: "1.9", away: "1.1" },
            minute: {
              "0-15": { total: 4 },
              "16-30": { total: 2 },
              "31-45": { total: 6 },
              "46-60": { total: 5 },
              "61-75": { total: 3 },
              "76-90": { total: 8 },
              "91-105": { total: 2 },
            },
            under_over: { "1.5": { over: 10, under: 5 }, "2.5": { over: 6, under: 9 } },
          },
          against: {
            average: { home: "0.8", away: "1.4" },
            under_over: { "0.5": { over: 9, under: 6 } },
          },
        },
        failed_to_score: { home: 1, away: 4, total: 5 },
        clean_sheet: { home: 5, away: 1, total: 6 },
      },
      5,
    );
    assert.equal(st?.over15For, 10 / 15);
    assert.ok(st && Math.abs((st.failedToScoreHome ?? 0) - 1 / 8) < 1e-9);
    assert.ok(st && st.earlyShare != null && st.lateShare != null);
    assert.ok(st!.lateShare! > st!.earlyShare!);
  });

  it("under/over and minute helpers leave missing as null, never zero", () => {
    assert.equal(underOverRate(undefined, "1.5"), null);
    assert.equal(minuteShares(undefined).early, null);
    assert.equal(minuteShares({ "0-15": { total: null } }).early, null);
  });

  it("standings keep home/away goal splits", () => {
    const rows = extractStandings([
      {
        league: {
          standings: [
            [
              {
                rank: 1,
                points: 20,
                team: { id: 7 },
                goalsDiff: 10,
                form: "WW",
                all: { played: 10, goals: { for: 18, against: 8 } },
                home: { played: 5, goals: { for: 12, against: 2 } },
                away: { played: 5, goals: { for: 6, against: 6 } },
              },
            ],
          ],
        },
      },
    ]);
    assert.equal(rows[0]?.homeGf, 12);
    assert.equal(rows[0]?.awayPlayed, 5);
  });

  it("coverage score is a weighted sum of flags, not a boolean", () => {
    const map = extractLeagueCoverage([
      {
        league: { id: 39 },
        seasons: [
          {
            current: true,
            coverage: {
              fixtures: { events: true, lineups: true, statistics_fixtures: true },
              standings: true,
              injuries: true,
              predictions: true,
              odds: true,
            },
          },
        ],
      },
    ]);
    const full = map.get(39);
    assert.ok(full && full.score > 0.9);
    const thin = extractLeagueCoverage([
      {
        league: { id: 200 },
        seasons: [{ current: true, coverage: { fixtures: {}, standings: false, odds: true } }],
      },
    ]);
    assert.ok((thin.get(200)?.score ?? 1) < 0.3);
  });

  it("lineup 5-4-1 without a keeper weakens attack and keeper", () => {
    const xi = extractLineups(
      [
        {
          team: { id: 1 },
          formation: "5-4-1",
          startXI: Array.from({ length: 11 }, (_, i) => ({
            player: { pos: i < 5 ? "D" : i < 10 ? "M" : "F" },
          })),
        },
        {
          team: { id: 2 },
          formation: "4-3-3",
          startXI: [
            { player: { pos: "G" } },
            ...Array.from({ length: 4 }, () => ({ player: { pos: "D" } })),
            ...Array.from({ length: 3 }, () => ({ player: { pos: "M" } })),
            ...Array.from({ length: 3 }, () => ({ player: { pos: "F" } })),
          ],
        },
      ],
      1,
      2,
    );
    assert.equal(xi.home.confirmed, true);
    assert.ok(xi.home.keeper > 0);
    assert.ok(xi.home.attack > xi.away.attack);
    assert.equal(xi.away.keeper, 0);
  });

  it("thin startXI is not a confirmed lineup", () => {
    const xi = extractLineups([{ team: { id: 1 }, formation: "4-4-2", startXI: [] }], 1, 2);
    assert.equal(xi.home.confirmed, false);
    assert.equal(xi.home.attack, 0);
  });
});

describe("feature extras into λ", () => {
  const blank = {
    homeLast5For: null as number | null,
    homeLast5Against: null as number | null,
    awayLast5For: null as number | null,
    awayLast5Against: null as number | null,
    homeSeasonForHome: null as number | null,
    homeSeasonAgainstHome: null as number | null,
    awaySeasonForAway: null as number | null,
    awaySeasonAgainstAway: null as number | null,
    poissonShareHome: null as number | null,
    homePlayed: 10 as number | null,
    awayPlayed: 10 as number | null,
    injuryHome: 0,
    injuryAway: 0,
    homeForm: null as string | null,
    awayForm: null as string | null,
    h2h: [] as { homeGoals: number; awayGoals: number; homeIsCurrentHome: boolean; daysAgo: number }[],
    leagueAvgTotal: 2.5,
    leagueAvgHome: 1.38,
    leagueAvgAway: 1.12,
  };

  it("a side that regularly scores 2+ lifts its own λ", () => {
    const base = estimateLambdas(blank);
    const hot = estimateLambdas({ ...blank, homeOver15For: 0.7, awayOver15For: 0.2 });
    assert.ok(hot.lambdaH > base.lambdaH);
    assert.ok(hot.lambdaA < base.lambdaA);
  });

  it("late-goal environment lifts both λ", () => {
    const base = estimateLambdas(blank);
    const late = estimateLambdas({ ...blank, homeLateShare: 0.35, awayLateShare: 0.32 });
    assert.ok(late.lambdaH > base.lambdaH);
    assert.ok(late.lambdaA > base.lambdaA);
  });

  it("last-20 Maher rates move λ only when both sides have 12 games", () => {
    const base = estimateLambdas(blank);
    const short = estimateLambdas({
      ...blank,
      homeSma20For: 2.4,
      homeSma20Against: 0.6,
      awaySma20For: 0.5,
      awaySma20Against: 2.2,
      homeSma20N: 8,
      awaySma20N: 8,
    });
    assert.equal(short.lambdaH, base.lambdaH);
    const long = estimateLambdas({
      ...blank,
      homeSma20For: 2.4,
      homeSma20Against: 0.6,
      awaySma20For: 0.5,
      awaySma20Against: 2.2,
      homeSma20N: 18,
      awaySma20N: 18,
    });
    assert.ok(long.lambdaH > base.lambdaH);
    assert.ok(long.lambdaA < base.lambdaA);
  });

  it("failed-to-score rate pulls λ toward -log(FTS); a BTTS hit-rate does not", () => {
    const base = estimateLambdas(blank);
    const quiet = estimateLambdas({ ...blank, homeFts: 0.55, awayFts: 0.5 });
    assert.ok(quiet.lambdaH < base.lambdaH);
    assert.ok(Math.abs(quiet.lambdaH - (0.86 * base.lambdaH + 0.14 * -Math.log(0.55))) < 0.02);
    const bttsNoise = estimateLambdas({ ...blank, homeBtts: 0.9, awayBtts: 0.9 });
    assert.equal(bttsNoise.lambdaH, base.lambdaH);
    assert.equal(bttsNoise.lambdaA, base.lambdaA);
  });

  it("season-start n<6 shrinks harder toward the league prior", () => {
    const thin = estimateLambdas({
      ...blank,
      homePlayed: 3,
      awayPlayed: 3,
      homeLast5For: 3.2,
      homeLast5Against: 0.2,
      awayLast5For: 0.2,
      awayLast5Against: 3.0,
    });
    const full = estimateLambdas({
      ...blank,
      homePlayed: 14,
      awayPlayed: 14,
      homeLast5For: 3.2,
      homeLast5Against: 0.2,
      awayLast5For: 0.2,
      awayLast5Against: 3.0,
    });
    assert.ok(thin.lambdaH < full.lambdaH, `thin ${thin.lambdaH} vs full ${full.lambdaH}`);
  });

  it("opponent-adjusted rates discount table GD so the table is not counted twice", () => {
    const tableOnly = estimateLambdas({
      ...blank,
      homeRank: 2,
      awayRank: 16,
      homeGD: 22,
      awayGD: -14,
    });
    const withAdj = estimateLambdas({
      ...blank,
      homeRank: 2,
      awayRank: 16,
      homeGD: 22,
      awayGD: -14,
      homeAdjAttack: 1.4,
      awayAdjAttack: 1.1,
    });
    const gapTable = tableOnly.lambdaH - tableOnly.lambdaA;
    const gapAdj = withAdj.lambdaH - withAdj.lambdaA;
    assert.ok(gapTable > 0.08);
    assert.ok(Math.abs(gapAdj - gapTable) > 0.01 || Math.abs(withAdj.lambdaH - tableOnly.lambdaH) > 0.01);
  });

  it("confirmed 5-at-back lineup cuts own λ versus the injury-only path", () => {
    const inj = estimateLambdas({
      ...blank,
      injuryAttackHome: 0,
      lineupAttackHome: 0.07,
      lineupConfirmed: true,
    });
    const none = estimateLambdas(blank);
    assert.ok(inj.lambdaH < none.lambdaH);
  });

  it("one confirmed XI does not wipe the other side's injuries", () => {
    const both = estimateLambdas({
      ...blank,
      injuryAttackAway: 0.1,
      lineupConfirmedHome: true,
      lineupConfirmedAway: false,
      lineupAttackHome: 0,
    });
    const injOnly = estimateLambdas({
      ...blank,
      injuryAttackAway: 0.1,
      lineupConfirmedHome: false,
      lineupConfirmedAway: false,
    });
    assert.ok(Math.abs(both.lambdaA - injOnly.lambdaA) < 0.02, `away λ ${both.lambdaA} vs ${injOnly.lambdaA}`);
  });

  it("trimmed median drops a stale 12.00 while keeping the 1.90 cluster", () => {
    const m = trimmedMedian([1.88, 1.9, 1.91, 1.92, 12]);
    assert.ok(m != null && m < 2 && m > 1.85);
  });

  it("union markets stay coherent: 1X2 sums to 1, O1.5 ≥ O2.5, BTTS ≤ O1.5", () => {
    const g = jointGrid(1.45, 1.12);
    const m = marketsFromGrid(g);
    assert.equal(marketsCoherent(m), true);
    const fused = fuseScoreGrid({
      dc: g,
      karlis: bivariateGrid(1.45, 1.12),
      copula: copulaGrid(1.45, 1.12),
      negBin: negBinGrid(1.45, 1.12, 12),
      elo: jointGrid(1.4, 1.15),
      shin: { home: 0.48, draw: 0.28, away: 0.24, over25: 0.52, over15: 0.76, btts: 0.55 },
    });
    assert.equal(marketsCoherent(marketsFromGrid(fused)), true);
  });
});

describe("consensus odds and λ-price sanity", () => {
  it("a 1.93 Pinnacle outlier does not beat a 1.05 book cluster", () => {
    const lines = [
      { bookmakerId: 4, bookmaker: "Pinnacle", odd: 1.93 },
      { bookmakerId: 8, bookmaker: "Bet365", odd: 1.05 },
      { bookmakerId: 7, bookmaker: "William Hill", odd: 1.06 },
      { bookmakerId: 16, bookmaker: "Unibet", odd: 1.04 },
      { bookmakerId: 11, bookmaker: "1xBet", odd: 1.05 },
      { bookmakerId: 3, bookmaker: "Betfair", odd: 1.07 },
    ];
    const c = consensusPrice(lines);
    assert.ok((c.median ?? 9) < 1.15, `median ${c.median}`);
    assert.equal(c.inBand, false);
    assert.equal(c.reliable, true);
  });

  it("a real 1.90 cluster stays in band", () => {
    const c = consensusPrice([
      { bookmakerId: 4, bookmaker: "Pinnacle", odd: 1.9 },
      { bookmakerId: 8, bookmaker: "Bet365", odd: 1.91 },
      { bookmakerId: 7, bookmaker: "William Hill", odd: 1.88 },
      { bookmakerId: 16, bookmaker: "Unibet", odd: 1.92 },
    ]);
    assert.equal(c.inBand, true);
    assert.ok((c.median ?? 0) > 1.85 && (c.median ?? 9) < 2);
  });

  it("median 1.91 stays in band even if the named sharp is 2.04", () => {
    const c = consensusPrice([
      { bookmakerId: 4, bookmaker: "Pinnacle", odd: 2.04 },
      { bookmakerId: 8, bookmaker: "Bet365", odd: 1.9 },
      { bookmakerId: 7, bookmaker: "William Hill", odd: 1.91 },
      { bookmakerId: 16, bookmaker: "Unibet", odd: 1.89 },
      { bookmakerId: 11, bookmaker: "1xBet", odd: 1.92 },
    ]);
    assert.ok((c.median ?? 9) < 2 && (c.median ?? 0) > 1.85, `median ${c.median}`);
    assert.equal(c.inBand, true);
  });

  it("extractFixtureMarkets does not mark a 1.05 Over 1.5 as a 1.90 pick", () => {
    const books = [
      {
        id: 4,
        name: "Pinnacle",
        bets: [{ id: 5, name: "Goals Over/Under", values: [{ value: "Over 1.5", odd: "1.93" }, { value: "Under 1.5", odd: "1.90" }] }],
      },
      ...[8, 7, 16, 11, 3].map((id) => ({
        id,
        name: `Book${id}`,
        bets: [
          {
            id: 5,
            name: "Goals Over/Under",
            values: [
              { value: "Over 1.5", odd: "1.05" },
              { value: "Under 1.5", odd: "8.00" },
            ],
          },
        ],
      })),
    ];
    const m = extractFixtureMarkets({ fixture: { id: 99 }, bookmakers: books });
    assert.ok(m);
    assert.equal(m!.ou15.over?.inBand, false);
    assert.ok((m!.ou15.over?.consensusOdd ?? 9) < 1.2);
  });

  it("a blank book does not hide a price another book posted", () => {
    const dateRow = { fixture: { id: 5 }, bookmakers: [{ id: 8, name: "Bet365", bets: [] }] };
    const other = {
      fixture: { id: 5 },
      bookmakers: [
        {
          id: 11,
          name: "1xBet",
          bets: [
            {
              id: 1,
              name: "Match Winner",
              values: [
                { value: "Home", odd: "1.91" },
                { value: "Draw", odd: "3.40" },
                { value: "Away", odd: "4.20" },
              ],
            },
          ],
        },
      ],
    };
    const merged = mergeOddsRows(dateRow, other);
    const m = extractFixtureMarkets(merged);
    assert.equal(m?.winner.home?.sharpBook, "1xBet");
    assert.ok((m?.winner.home?.medianOdd ?? 0) > 1.8);
    const blank = extractFixtureMarkets(dateRow);
    assert.equal(blank?.winner.home, undefined);
  });

  it("Bet365 first-half Over 1.5 at 1.74 does not beat 1xBet full-match 1.11", () => {
    const books = [
      {
        id: 8,
        name: "Bet365",
        bets: [
          {
            id: 6,
            name: "Goals Over/Under First Half",
            values: [
              { value: "Over 1.5", odd: "1.74" },
              { value: "Under 1.5", odd: "2.05" },
            ],
          },
          {
            id: 5,
            name: "Goals Over/Under",
            values: [
              { value: "Over 1.5", odd: "1.11" },
              { value: "Under 1.5", odd: "4.85" },
            ],
          },
        ],
      },
      {
        id: 11,
        name: "1xBet",
        bets: [
          {
            id: 5,
            name: "Goals Over/Under",
            values: [
              { value: "Over 1.5", odd: "1.11" },
              { value: "Under 1.5", odd: "4.85" },
            ],
          },
        ],
      },
    ];
    const m = extractFixtureMarkets({ fixture: { id: 1 }, bookmakers: books });
    assert.ok(m);
    assert.ok((m!.ou15.over?.consensusOdd ?? 9) < 1.25, `consensus ${m!.ou15.over?.consensusOdd}`);
    assert.equal(m!.ou15.over?.inBand, false);
    assert.ok(!(m!.ou15.over?.books ?? []).some((l) => Math.abs(l.odd - 1.74) < 1e-6));
  });

  it("a first-half-only Over 1.5 book does not populate ou15", () => {
    const books = [
      {
        id: 8,
        name: "Bet365",
        bets: [
          {
            id: 6,
            name: "Goals Over/Under First Half",
            values: [
              { value: "Over 1.5", odd: "1.74" },
              { value: "Under 1.5", odd: "2.05" },
            ],
          },
        ],
      },
    ];
    const m = extractFixtureMarkets({ fixture: { id: 2 }, bookmakers: books });
    assert.ok(m);
    assert.equal(m!.ou15.over, undefined);
    assert.equal(m!.ou15.under, undefined);
  });

  it("Over 1.5 at 1.90 is rejected when λ says a 4-goal game", () => {
    const base = {
      lambdaH: 2.2,
      lambdaA: 2.1,
      accuracy: 0.72,
      implied: 0.628,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null as string | null,
      winner: null as string | null,
      home: "Dubai United",
      away: "Shabab Al Ahli",
      odd: 1.93,
      recentTotal: 4.55,
    };
    assert.ok(pickSanity({ ...base, kind: "over_15" }));
    const tight = pickSanity({
      ...base,
      kind: "over_15",
      lambdaH: 0.95,
      lambdaA: 0.85,
      accuracy: 0.55,
      implied: 0.52,
      odd: 1.91,
      recentTotal: 1.8,
    });
    assert.equal(tight, null);
  });

  it("Over 1.5 at 1.74 with tot ~2.2 is not the 90-minute line", () => {
    const skip = pickSanity({
      kind: "over_15",
      lambdaH: 0.9,
      lambdaA: 1.3,
      accuracy: 0.611,
      implied: 0.534,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Bet365",
      advice: null,
      winner: null,
      home: "Al-Faisaly FC",
      away: "Al-Ittihad FC",
      odd: 1.74,
      recentTotal: 2.0,
      scoreline: "0-1",
    });
    assert.ok(skip, "1.74 Over 1.5 must drop when lambda says a 2-goal game");
  });

  it("BTTS Yes is dropped when the modal cell is a clean sheet", () => {
    assert.equal(scorelineSupportsKind("1-0", "btts_yes"), false);
    assert.equal(scorelineSupportsKind("1-1", "btts_yes"), true);
    assert.equal(scorelineContradictsKind("1-0", "btts_yes"), true);
    assert.equal(scorelineContradictsKind("1-1", "home"), false);
    assert.equal(scorelineContradictsKind("0-1", "home"), true);
    const grid = jointGrid(1.25, 1.05);
    const m = marketsFromGrid(grid);
    const bttsModal = modalScoreForKind(grid, "btts_yes");
    const [bh, ba] = bttsModal.scoreline.split("-").map(Number);
    assert.ok(bh >= 1 && ba >= 1, `BTTS modal ${bttsModal.scoreline}`);
    assert.ok(scorelineSupportsKind(bttsModal.scoreline, "btts_yes"));
    assert.equal(gradeMarket("btts_yes", "BTTS Yes", 1, 0), false);
    assert.equal(gradeMarket("btts_yes", "BTTS Yes", 1, 1), true);
    assert.equal(gradeMarket("home", "Home", 2, 1), true);
    assert.equal(gradeMarket("home", "Home", 1, 1), false);
    assert.equal(gradeMarket("over_25", "Over 2.5", 2, 1), true);
    assert.equal(gradeMarket("under_25", "Under 2.5", 1, 1), true);
    assert.equal(gradeMarket("cs", "1-0", 1, 0), true);
    assert.equal(gradeMarket("cs", "1-0", 2, 0), false);
    const skip = pickSanity({
      kind: "btts_yes",
      lambdaH: 1.25,
      lambdaA: 1.05,
      accuracy: 0.587,
      implied: 0.422,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "William Hill",
      advice: "Combo Winner : Houtvenne and +2.5 goals",
      winner: "Houtvenne",
      home: "Houtvenne",
      away: "Dessel Sport",
      odd: 1.91,
      scoreline: "1-0",
      homeFts: 0.2,
      awayFts: 0.2,
    });
    assert.ok(skip, `BTTS Yes + 1-0 must drop: ${skip}`);
    const keep = pickSanity({
      kind: "btts_yes",
      lambdaH: 1.35,
      lambdaA: 1.2,
      accuracy: 0.56,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.9,
      scoreline: "1-1",
      homeFts: 0.2,
      awayFts: 0.2,
    });
    assert.equal(keep, null, `BTTS Yes + 1-1 dropped: ${keep}`);
    assert.equal(adviceForKind("btts_yes", "Combo Winner : Houtvenne and +2.5 goals"), null);
    assert.equal(adviceForKind("over_15", "Double chance : draw or Al-Ittihad FC and -3.5 goals"), null);
    assert.ok(adviceForKind("home", "Winner : Houtvenne"));
    const ouSkip = pickSanity({
      kind: "over_15",
      lambdaH: 0.85,
      lambdaA: 1.05,
      accuracy: 0.56,
      implied: 0.53,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Bet365",
      advice: null,
      winner: null,
      home: "Al-Faisaly FC",
      away: "Al-Ittihad FC",
      odd: 1.88,
      scoreline: "0-1",
    });
    assert.ok(ouSkip, "Over 1.5 + modal 0-1 must drop");
    assert.equal(m.scoreline === "1-0" || m.scoreline === "1-1" || m.scoreline === "0-1", true);
  });

  it("a gift price vs the model is treated as a stale book", () => {
    const skip = pickSanity({
      kind: "home",
      lambdaH: 1.7,
      lambdaA: 0.9,
      accuracy: 0.7,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.93,
    });
    assert.ok(skip);
  });

  it("Egidi mix is refused when the book total is a different match", () => {
    assert.equal(marketAgreesWithHistory(2.2, 2.0, 1.1, 1.0), false);
    assert.equal(marketAgreesWithHistory(1.4, 1.1, 1.35, 1.15), true);
  });

  it("league environment from home/away table splits", () => {
    const env = leagueEnvFromStandings(
      Array.from({ length: 8 }, (_, i) => ({
        teamId: i + 1,
        rank: i + 1,
        points: 20,
        played: 10,
        goalsFor: 12,
        goalsAgainst: 10,
        goalsDiff: 2,
        form: "W",
        homePlayed: 5,
        homeGf: 8,
        homeGa: 3,
        awayPlayed: 5,
        awayGf: 4,
        awayGa: 7,
      })),
    );
    assert.ok(env);
    assert.ok(env!.home > env!.away);
    assert.ok(Math.abs(env!.home - 1.6) < 1e-9);
  });

  it("last-3 micro form is hotter than last-10 when the side just exploded", () => {
    const now = Date.now() / 1000;
    const samples = [
      { timestamp: now - 86400, opponentId: 2, gf: 4, ga: 0, home: true },
      { timestamp: now - 2 * 86400, opponentId: 2, gf: 3, ga: 1, home: true },
      { timestamp: now - 3 * 86400, opponentId: 2, gf: 3, ga: 0, home: true },
      { timestamp: now - 20 * 86400, opponentId: 2, gf: 0, ga: 2, home: true },
      { timestamp: now - 30 * 86400, opponentId: 2, gf: 0, ga: 1, home: true },
      { timestamp: now - 40 * 86400, opponentId: 2, gf: 1, ga: 2, home: true },
      { timestamp: now - 50 * 86400, opponentId: 2, gf: 0, ga: 0, home: true },
      { timestamp: now - 60 * 86400, opponentId: 2, gf: 1, ga: 1, home: true },
    ];
    const micro = rollWindow(samples, 3);
    const all = rollSamples(samples);
    assert.ok(micro.gf != null && all.gf != null);
    assert.ok(micro.gf! > all.gf! + 0.8);
  });
});

describe("coverage, shrinkage, streaks, BTTS failure, explain", () => {
  it("does not fetch events or player stats on a live scan", () => {
    assert.equal(shouldFetchLive("events", undefined), false);
    assert.equal(shouldFetchLive("fixtureStats", undefined), false);
    assert.equal(shouldFetchLive("players", undefined), false);
    assert.equal(shouldFetchLive("fixtureStats", undefined, { needCorners: true }), true);
    assert.equal(shouldFetchLive("players", undefined, { needPlayers: true }), true);
    assert.equal(shouldFetchLive("lastN", undefined), true);
  });

  it("always fetches H2H unless a full H2H book is already on the snapshot", () => {
    assert.equal(shouldFetchLive("h2h", undefined, { lastNHome: 12, lastNAway: 11, h2hN: 1 }), true);
    assert.equal(shouldFetchLive("h2h", undefined, { lastNHome: 3, lastNAway: 4, h2hN: 1 }), true);
    assert.equal(shouldFetchLive("h2h", undefined, { lastNHome: 3, lastNAway: 4, h2hN: 8 }), false);
  });

  it("skips team stats when the league has neither standings nor fixture stats", () => {
    const thin = {
      leagueId: 200,
      standings: false,
      injuries: false,
      predictions: false,
      odds: true,
      lineups: false,
      events: false,
      fixtureStats: false,
      playerStats: false,
      score: 0.2,
    };
    assert.equal(shouldFetchLive("teamStats", thin), false);
    assert.equal(shouldFetchLive("standings", thin), false);
    assert.equal(
      shouldFetchLive("lineups", { ...thin, lineups: true }, { minutesToKick: 40 }),
      true,
    );
    assert.equal(
      shouldFetchLive("lineups", { ...thin, lineups: true }, { minutesToKick: 200 }),
      false,
    );
  });

  it("shrinkRate never turns missing into zero", () => {
    assert.equal(shrinkRate(null, 8, 0.5), null);
    assert.equal(shrinkRate(0.8, 0, 0.5), null);
    const s = shrinkRate(1, 2, 0.5, 6);
    assert.ok(s != null && s < 0.7 && s > 0.5);
  });

  it("form streaks count consecutive newest matches and stay null on empty", () => {
    assert.equal(formStreaks([]).scoring, null);
    const now = Date.now() / 1000;
    const samples = [
      { timestamp: now, opponentId: 2, gf: 2, ga: 0, home: true },
      { timestamp: now - 86400, opponentId: 2, gf: 1, ga: 1, home: true },
      { timestamp: now - 2 * 86400, opponentId: 2, gf: 0, ga: 2, home: true },
    ];
    const st = formStreaks(samples);
    assert.equal(st.scoring, 2);
    assert.equal(st.failed, 0);
    assert.equal(st.clean, 1);
  });

  it("BTTS failure modes fire on FTS, clean sheets, and missing strikers", () => {
    const fails = bttsFailureModes({
      lambdaH: 1.4,
      lambdaA: 1.2,
      homeFts: 0.58,
      awayFts: 0.2,
      homeCs: 0.2,
      awayCs: 0.5,
      homeBtts: 0.3,
      awayBtts: 0.4,
      injuryAttackHome: 0.12,
      injuryAttackAway: 0,
      injuryKeeperHome: 0,
      injuryKeeperAway: 0,
      leagueEnvTotal: 2.0,
      homeFailedStreak: 3,
      awayFailedStreak: 0,
    });
    const codes = fails.map((f) => f.code);
    assert.ok(codes.includes("fts_home"));
    assert.ok(codes.includes("one_way_away"));
    assert.ok(codes.includes("striker_home"));
    assert.ok(codes.includes("low_env"));
    assert.ok(codes.includes("fail_streak_home"));
    assert.ok(bttsFailureSeverity(fails) >= 0.55);
  });

  it("explainMatch does not invent a reason that is not on the snapshot", () => {
    const notes = explainMatch({
      kind: "over_15",
      home: "A",
      away: "B",
      lambdaH: 1.1,
      lambdaA: 0.9,
      histWeight: 0.4,
      bookTrusted: false,
      hasBook1x2: false,
      homeGf: null,
      homeGa: null,
      awayGf: null,
      awayGa: null,
      homeForm: null,
      awayForm: null,
      homeRank: null,
      awayRank: null,
      homeFts: null,
      awayFts: null,
      homeCs: null,
      awayCs: null,
      homeOver15: null,
      awayOver15: null,
      homeAdjAttack: null,
      awayAdjAttack: null,
      lastNHome: 0,
      lastNAway: 0,
      leagueEnvHome: null,
      leagueEnvAway: null,
      homeLateShare: null,
      awayLateShare: null,
      homeScoringStreak: null,
      awayScoringStreak: null,
      homeFailedStreak: null,
      awayFailedStreak: null,
      h2hN: 0,
      h2hLine: null,
      grade: "LOW_DATA",
      lineupHome: null,
      lineupAway: null,
      lineupConfirmed: false,
      injuryImpact: 0,
      bookCount: null,
      bttsFails: [],
      apiLine: null,
    });
    assert.ok(!notes.some((n) => /failed to score/i.test(n)));
    assert.ok(!notes.some((n) => /clean sheet/i.test(n)));
    assert.ok(!notes.some((n) => /confirmed xi/i.test(n)));
    assert.ok(!notes.some((n) => /H2H/i.test(n)));
    assert.ok(notes.some((n) => /λ 1.10 \/ 0.90/.test(n)));
  });

  it("BTTS yes is rejected when failed-to-score is high", () => {
    const base = {
      lambdaH: 1.2,
      lambdaA: 1.1,
      accuracy: 0.58,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null as string | null,
      winner: null as string | null,
      home: "A",
      away: "B",
      odd: 1.9,
    };
    assert.ok(pickSanity({ ...base, kind: "btts_yes", homeFts: 0.55 }));
    assert.ok(pickSanity({ ...base, kind: "btts_yes", bttsFailSeverity: 0.7 }));
    assert.equal(pickSanity({ ...base, kind: "btts_yes", homeFts: 0.2, awayFts: 0.2 }), null);
  });

  it("failed scoring streak pulls λ down", () => {
    const blank = {
      homeLast5For: 1.4 as number | null,
      homeLast5Against: 1.1 as number | null,
      awayLast5For: 1.2 as number | null,
      awayLast5Against: 1.3 as number | null,
      homeSeasonForHome: 1.4 as number | null,
      homeSeasonAgainstHome: 1.1 as number | null,
      awaySeasonForAway: 1.2 as number | null,
      awaySeasonAgainstAway: 1.3 as number | null,
      poissonShareHome: null as number | null,
      homePlayed: 10 as number | null,
      awayPlayed: 10 as number | null,
      injuryHome: 0,
      injuryAway: 0,
      homeForm: null as string | null,
      awayForm: null as string | null,
      h2h: [] as { homeGoals: number; awayGoals: number; homeIsCurrentHome: boolean; daysAgo: number }[],
      leagueAvgTotal: 2.5,
      leagueAvgHome: 1.38,
      leagueAvgAway: 1.12,
    };
    const base = estimateLambdas(blank);
    const cold = estimateLambdas({ ...blank, homeFailedStreak: 4 });
    assert.ok(cold.lambdaH < base.lambdaH);
  });

  it("market coverage is higher for 1X2 when standings exist", () => {
    const full = {
      leagueId: 39,
      standings: true,
      injuries: true,
      predictions: true,
      odds: true,
      lineups: true,
      events: true,
      fixtureStats: true,
      playerStats: true,
      score: 1,
    };
    const oddsOnly = {
      ...full,
      standings: false,
      injuries: false,
      predictions: false,
      lineups: false,
      events: false,
      fixtureStats: false,
      playerStats: false,
      score: 0.2,
    };
    assert.ok(marketCoverageFromFlags(full, "win") > marketCoverageFromFlags(oddsOnly, "win"));
    assert.ok(marketCoverageFromFlags(full, "btts") > 0.8);
  });

  it("a global injury feed does not by itself create FULL_DATA", () => {
    const inflated = dataGrade({
      lastN: 3,
      venueN: 0,
      standings: false,
      stats: false,
      h2h: 0,
      injuries: true,
      odds: true,
    });
    assert.notEqual(inflated.grade, "FULL_DATA");
    assert.ok(inflated.quality < 0.45);
  });
});

describe("unified-engine techniques on the shared state", () => {
  it("Karlis outlier scale is Huber, not a cliff at |GD| = 3", () => {
    assert.equal(karlisOutlierScale(1.6, 1.1), 1);
    assert.equal(karlisOutlierScale(null, 1), 1);
    const mild = karlisOutlierScale(2.8, 0.7);
    const wild = karlisOutlierScale(4.2, 0.4);
    const justUnder = karlisOutlierScale(2.95, 0.1);
    const justOver = karlisOutlierScale(3.05, 0.1);
    assert.ok(mild < 1 && mild > wild, `mild ${mild} wild ${wild}`);
    assert.ok(wild >= 0.72 && wild <= 0.85, `wild ${wild}`);
    assert.ok(Math.abs(justUnder - justOver) < 0.04, `cliff ${justUnder} vs ${justOver}`);
  });

  it("does not shrink a side that is being thrashed", () => {
    assert.equal(karlisOutlierScale(0.4, 4.2), 1);
    assert.equal(karlisOutlierScale(1.0, 1.4), 1);
  });

  it("thin samples damp blowouts harder than a 12-game run", () => {
    const thin = karlisOutlierScale(3.2, 0.8, { n: 3, league: 1.35 });
    const full = karlisOutlierScale(3.2, 0.8, { n: 14, league: 1.35 });
    assert.ok(thin < full, `thin ${thin} full ${full}`);
  });

  it("Huber weight is 1 inside k and k/|r| outside", () => {
    assert.equal(huberWeight(1.2, HUBER_K_GD), 1);
    assert.equal(huberWeight(-1.2, HUBER_K_GD), 1);
    assert.ok(Math.abs(huberWeight(3.6, HUBER_K_GD) - 0.5) < 1e-12);
    assert.equal(huberWeight(HUBER_K_GF, HUBER_K_GF), 1);
  });

  it("winsor pulls a 4.5 gf toward the league and leaves 1.5 alone", () => {
    const league = 1.38;
    assert.equal(winsorGoalRate(1.5, league), 1.5);
    const w = winsorGoalRate(4.5, league);
    assert.ok(w < 4.5 && w > league + 0.8, `winsor ${w}`);
  });

  it("BORS cuts H2H when Elo and Shin disagree on the favourite", () => {
    const agree = borsH2hWeight(0.12, 0.62, 0.58);
    const fight = borsH2hWeight(0.12, 0.62, 0.41);
    assert.ok(agree > 0.12);
    assert.ok(fight < 0.12);
    assert.equal(borsH2hWeight(0.12, 0.62, null), 0.12);
  });

  it("Penn–Donnelly damps hot form on a top-half side", () => {
    assert.equal(pennDonnellyScale(2, 20, 0.85), 0.85);
    assert.equal(pennDonnellyScale(16, 20, 0.85), 1);
    assert.equal(pennDonnellyScale(2, 20, 0.5), 1);
  });

  it("Wheatcroft COD returns λ to a quality side on a cold streak", () => {
    assert.ok(wheatcroftCodTilt(2, 20, "LLLLL") > 0);
    assert.ok(wheatcroftCodTilt(18, 20, "WWWWW") < 0);
    assert.equal(wheatcroftCodTilt(10, 20, "WDLWD"), 0);
  });

  it("ordered logit puts more mass on the stronger, higher-table side", () => {
    const p = orderedLogitProbs(0.7, 0.25, -10);
    assert.ok(p.home > p.away);
    assert.ok(p.draw > 0.08 && p.draw < 0.4);
    assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-9);
  });

  it("Na draw boost only when Shin is short and the grid is not", () => {
    assert.equal(naDrawBoost(0.22, 0.31), 0.03);
    assert.equal(naDrawBoost(0.3, 0.31), 0);
    assert.equal(naDrawBoost(null, 0.31), 0);
  });

  it("close-table H2H draws add mass only with a real sample", () => {
    assert.equal(closeTableH2hDrawBoost(0.5, 3, 6), 0.02);
    assert.equal(closeTableH2hDrawBoost(0.5, 3, 2), 0);
    assert.equal(closeTableH2hDrawBoost(0.2, 3, 6), 0);
  });

  it("inflateDraw raises P(draw) and keeps the grid summing to 1", () => {
    const g = jointGrid(1.4, 1.15);
    const before = marketsFromGrid(g);
    const afterG = inflateDraw(g, 0.03);
    const after = marketsFromGrid(afterG);
    assert.ok(after.draw > before.draw + 0.02);
    assert.ok(Math.abs(after.home + after.draw + after.away - 1) < 1e-8);
    let s = 0;
    for (const row of afterG) for (const p of row) s += p;
    assert.ok(Math.abs(s - 1) < 1e-8);
  });

  it("a 3-goal last H2H thrashing vetoes the beaten side", () => {
    const h2h = [{ homeGoals: 0, awayGoals: 4, homeIsCurrentHome: true, daysAgo: 40 }];
    assert.equal(latestH2hConflicts(h2h, "home"), "thrash");
    assert.equal(latestH2hConflicts(h2h, "away"), null);
    const skip = pickSanity({
      kind: "home",
      lambdaH: 1.7,
      lambdaA: 1.0,
      accuracy: 0.58,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.9,
      h2hConflict: "thrash",
    });
    assert.ok(skip);
  });

  it("two straight H2H losses veto a home pick", () => {
    const h2h = [
      { homeGoals: 2, awayGoals: 3, homeIsCurrentHome: true, daysAgo: 20 },
      { homeGoals: 2, awayGoals: 1, homeIsCurrentHome: false, daysAgo: 120 },
    ];
    assert.equal(latestH2hConflicts(h2h, "home"), "thrash");
    assert.equal(
      latestH2hConflicts(
        [{ homeGoals: 1, awayGoals: 2, homeIsCurrentHome: true, daysAgo: 20 }],
        "home",
      ),
      "lean",
    );
  });

  it("BTTS No is dropped when both sides actually score", () => {
    const skip = pickSanity({
      kind: "btts_no",
      lambdaH: 0.8,
      lambdaA: 1.6,
      accuracy: 0.538,
      implied: 0.456,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Bet365",
      advice: null,
      winner: null,
      home: "Airdrie United",
      away: "Alloa Athletic",
      odd: 2.0,
      scoreline: "0-1",
      homeFts: 0.2,
      awayFts: 0.08,
      homeBtts: 0.6,
      awayBtts: 0.6,
      homeOver15: 0.73,
      awayOver15: 0.82,
      h2hBtts: 0.6,
      h2hN: 10,
    });
    assert.ok(skip, `BTTS No must drop when form is BTTS: ${skip}`);
    const keep = pickSanity({
      kind: "btts_no",
      lambdaH: 0.7,
      lambdaA: 0.9,
      accuracy: 0.56,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.9,
      scoreline: "1-0",
      homeFts: 0.48,
      awayFts: 0.22,
      homeBtts: 0.32,
      awayBtts: 0.4,
      homeOver15: 0.5,
      awayOver15: 0.48,
      homeLast5Gf: 0.6,
      awayLast5Gf: 0.8,
      h2hBtts: 0.3,
      h2hN: 8,
    });
    assert.equal(keep, null, `quiet BTTS No dropped: ${keep}`);
  });

  it("BTTS No is banned unless λ, last-5 GF and last-5 H2H all say No", () => {
    const quiet = {
      kind: "btts_no",
      lambdaH: 0.7,
      lambdaA: 0.85,
      accuracy: 0.56,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.9,
      scoreline: "1-0",
      homeFts: 0.48,
      awayFts: 0.4,
      homeBtts: 0.32,
      awayBtts: 0.3,
      homeLast5Gf: 0.6,
      awayLast5Gf: 0.8,
      h2hBtts: 0.2,
      h2hN: 5,
    };
    assert.equal(pickSanity(quiet), null, `all-quiet No dropped: ${pickSanity(quiet)}`);
    assert.ok(
      pickSanity({ ...quiet, homeLast5Gf: 1.0, awayLast5Gf: 1.0 }),
      "last-5 both scoring 1.0 must drop BTTS No",
    );
    assert.ok(pickSanity({ ...quiet, homeLast5Gf: null, awayLast5Gf: null }), "missing last-5 is not a No");
    assert.ok(pickSanity({ ...quiet, h2hN: 2, h2hBtts: 0.2 }), "thin H2H is not a No");
    assert.ok(pickSanity({ ...quiet, h2hBtts: 0.6, h2hN: 5 }), "H2H BTTS Yes is not a No");
    assert.ok(
      pickSanity({ ...quiet, lambdaH: 1.2, lambdaA: 1.3, homeLast5Gf: 0.6, awayLast5Gf: 0.8 }),
      "both λ scoring is not a No even if last-5 is thin",
    );
    // SKC: one-sided λ, last-5 both at 1.0, mixed H2H
    assert.ok(
      pickSanity({
        ...quiet,
        lambdaH: 0.79,
        lambdaA: 2.3,
        homeLast5Gf: 1.0,
        awayLast5Gf: 1.0,
        h2hBtts: 0.4,
        h2hN: 9,
        odd: 2.41,
        implied: 0.375,
        accuracy: 0.553,
      }),
      "SKC-shaped one-sided λ with last-5 1.0/1.0 must drop",
    );
  });

  it("cold last-five form vetoes a home pick", () => {
    const skip = pickSanity({
      kind: "home",
      lambdaH: 1.5,
      lambdaA: 1.0,
      accuracy: 0.58,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "Aston Villa",
      away: "Nottingham Forest",
      odd: 1.9,
      homeForm: "WDLLL",
      awayForm: "DDLLW",
    });
    assert.ok(skip, `cold Villa form must drop: ${skip}`);
  });

  it("straight win is dropped when draw mass is 30%+ or last-5 H2H is 1/5", () => {
    const home = {
      kind: "home",
      lambdaH: 1.5,
      lambdaA: 1.1,
      accuracy: 0.58,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.9,
    };
    assert.equal(pickSanity({ ...home, gridDraw: 0.24 }), null);
    assert.ok(pickSanity({ ...home, gridDraw: 0.32 }), "32% draw is not a straight win");
    assert.ok(
      pickSanity({ ...home, h2hN: 5, h2hHome: 0.2 }),
      "H2H 1/5 home must drop",
    );
    assert.equal(pickSanity({ ...home, h2hN: 5, h2hHome: 0.4 }), null);
    assert.ok(
      pickSanity({ ...home, lambdaH: 1.22, lambdaA: 1.14 }),
      `λ gap ${WIN_LAMBDA_GAP} must drop a coin`,
    );
  });

  it("CS cell must separate, concentrate, and sit in the 1X2 cluster", () => {
    assert.equal(csAgreesWith1x2("2-1", 0.62, 0.22, 0.16), true);
    assert.equal(csAgreesWith1x2("0-2", 0.68, 0.2, 0.12), false);
    assert.equal(csAgreesWith1x2("1-1", 0.55, 0.25, 0.2), true);
    assert.equal(csAgreesWith1x2("1-1", 0.68, 0.2, 0.12), false);
    const coin = csConcentration([
      { score: "1-1", p: 0.095 },
      { score: "1-0", p: 0.093 },
      { score: "0-1", p: 0.09 },
    ]);
    assert.ok(coin.margin < CS_TOP_MARGIN_MIN);
    const peaked = csConcentration([
      { score: "1-0", p: 0.14 },
      { score: "2-0", p: 0.11 },
      { score: "2-1", p: 0.1 },
    ]);
    assert.ok(peaked.margin >= CS_TOP_MARGIN_MIN);
    assert.ok(peaked.top3 >= CS_TOP3_MIN);
    const csBase = {
      kind: "cs",
      lambdaH: 1.5,
      lambdaA: 1.0,
      accuracy: 0.14,
      implied: 0.11,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 7.2,
      selection: "1-0",
      gridHome: 0.58,
      gridDraw: 0.24,
      gridAway: 0.18,
    };
    assert.equal(
      pickSanity({
        ...csBase,
        csTopScores: [
          { score: "1-0", p: 0.14 },
          { score: "2-0", p: 0.11 },
          { score: "2-1", p: 0.1 },
        ],
      }),
      null,
    );
    assert.ok(
      pickSanity({
        ...csBase,
        csTopScores: [
          { score: "1-0", p: 0.095 },
          { score: "1-1", p: 0.094 },
          { score: "0-1", p: 0.09 },
        ],
      }),
      "coin CS ranking must drop",
    );
    assert.ok(
      pickSanity({
        ...csBase,
        selection: "0-2",
        csTopScores: [
          { score: "0-2", p: 0.14 },
          { score: "0-1", p: 0.11 },
          { score: "1-2", p: 0.1 },
        ],
      }),
      "0-2 vs a home favourite must drop",
    );
    assert.ok(
      pickSanity({
        ...csBase,
        selection: "0-0",
        lambdaH: 1.5,
        lambdaA: 1.4,
        csTopScores: [
          { score: "0-0", p: 0.14 },
          { score: "1-0", p: 0.11 },
          { score: "1-1", p: 0.1 },
        ],
      }),
      "0-0 in a 2.9-goal game must drop",
    );
  });

  it("BTTS Yes is dropped when last-5 H2H is clean sheets", () => {
    const h2h = [
      { homeGoals: 2, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 10 },
      { homeGoals: 3, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 40 },
      { homeGoals: 1, awayGoals: 0, homeIsCurrentHome: false, daysAgo: 80 },
      { homeGoals: 2, awayGoals: 1, homeIsCurrentHome: true, daysAgo: 120 },
      { homeGoals: 4, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 200 },
    ];
    const rates = h2hMarketRates(h2h, 5);
    assert.equal(rates.n, 5);
    assert.ok((rates.btts ?? 1) <= 0.25, `h2h btts ${rates.btts}`);
    const skip = pickSanity({
      kind: "btts_yes",
      lambdaH: 1.8,
      lambdaA: 0.9,
      accuracy: 0.572,
      implied: 0.504,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Bet365",
      advice: null,
      winner: null,
      home: "Chelsea",
      away: "Hull City",
      odd: 1.84,
      scoreline: "2-1",
      homeFts: 0.12,
      awayFts: 0.4,
      homeBtts: 0.8,
      awayBtts: 0.2,
      homeLast5Gf: 3.2,
      awayLast5Gf: 0.8,
      h2hBtts: rates.btts,
      h2hN: rates.n,
    });
    assert.ok(skip, `Chelsea BTTS Yes vs Hull blanks must drop: ${skip}`);
    const noKeep = pickSanity({
      kind: "btts_no",
      lambdaH: 1.9,
      lambdaA: 0.75,
      accuracy: 0.62,
      implied: 0.51,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Bet365",
      advice: null,
      winner: null,
      home: "Chelsea",
      away: "Hull City",
      odd: 1.95,
      scoreline: "2-0",
      homeFts: 0.12,
      awayFts: 0.4,
      homeBtts: 0.8,
      awayBtts: 0.2,
      homeLast5Gf: 3.2,
      awayLast5Gf: 0.8,
      h2hBtts: rates.btts,
      h2hN: rates.n,
    });
    assert.equal(noKeep, null, `BTTS No must be the live side: ${noKeep}`);
    const t = formMarketTargets({
      h2hRates: rates,
      homeBtts: 0.8,
      awayBtts: 0.2,
      homeLast5Gf: 3.2,
      homeLast5Ga: 2.0,
      awayLast5Gf: 0.8,
      awayLast5Ga: 0.4,
    });
    assert.ok((t.btts ?? 1) < 0.42, `form BTTS ${t.btts}`);
  });

  it("Under 2.5 is dropped when last-5 H2H and home games go over", () => {
    const h2h = [
      { homeGoals: 2, awayGoals: 1, homeIsCurrentHome: true, daysAgo: 10 },
      { homeGoals: 3, awayGoals: 1, homeIsCurrentHome: false, daysAgo: 40 },
      { homeGoals: 1, awayGoals: 1, homeIsCurrentHome: false, daysAgo: 80 },
      { homeGoals: 2, awayGoals: 1, homeIsCurrentHome: true, daysAgo: 120 },
      { homeGoals: 0, awayGoals: 0, homeIsCurrentHome: false, daysAgo: 200 },
    ];
    const rates = h2hMarketRates(h2h, 5);
    assert.ok((rates.over25 ?? 0) >= 0.55, `h2h o25 ${rates.over25}`);
    const skip = pickSanity({
      kind: "under_25",
      lambdaH: 1.2,
      lambdaA: 0.6,
      accuracy: 0.543,
      implied: 0.507,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "Auxerre",
      away: "Nice",
      odd: 1.89,
      scoreline: "1-1",
      homeLast5Gf: 1.2,
      homeLast5Ga: 2.4,
      awayLast5Gf: 0.2,
      awayLast5Ga: 0.8,
      h2hOver25: rates.over25,
      h2hN: rates.n,
    });
    assert.ok(skip, `Auxerre Under 2.5 must drop: ${skip}`);
    const overKeep = pickSanity({
      kind: "over_25",
      lambdaH: 1.2,
      lambdaA: 1.0,
      accuracy: 0.56,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "Auxerre",
      away: "Nice",
      odd: 1.9,
      scoreline: "2-1",
      homeLast5Gf: 1.2,
      homeLast5Ga: 2.4,
      awayLast5Gf: 0.2,
      awayLast5Ga: 0.8,
      h2hOver25: rates.over25,
      h2hN: rates.n,
    });
    assert.equal(overKeep, null, `Over 2.5 must be the live side: ${overKeep}`);
    const t = formMarketTargets({
      h2hRates: rates,
      homeLast5Gf: 1.2,
      homeLast5Ga: 2.4,
      awayLast5Gf: 0.2,
      awayLast5Ga: 0.8,
    });
    assert.ok((t.over25 ?? 0) >= 0.52, `form O2.5 ${t.over25}`);
    const keep = pickSanity({
      kind: "under_25",
      lambdaH: 1.05,
      lambdaA: 0.95,
      accuracy: 0.56,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.9,
      scoreline: "1-0",
      homeLast5Gf: 1.0,
      homeLast5Ga: 0.8,
      awayLast5Gf: 0.7,
      awayLast5Ga: 0.9,
      h2hOver25: 0.2,
      h2hN: 5,
    });
    assert.equal(keep, null, `quiet Under 2.5 dropped: ${keep}`);
  });

  it("formMomentum is 1 on WWWWW and 0 on LLLLL", () => {
    assert.ok(formMomentum("WWWWW") > 0.9);
    assert.ok(formMomentum("LLLLL") < 0.1);
    assert.equal(formMomentum(null), 0.5);
  });

  it("weights the last match, not the oldest (form is newest-first)", () => {
    assert.ok(formMomentum("WLLLL") > formMomentum("LLLLW"));
    assert.ok(formTilt("WLLLL") > formTilt("LLLLW"));
    assert.ok(walkElo("WLLLL") > walkElo("LLLLW"));
  });

  it("last-5 H2H still moves λ when last-20 exists", () => {
    const base = {
      homeLast5For: 1.5 as number | null,
      homeLast5Against: 1.1 as number | null,
      awayLast5For: 1.2 as number | null,
      awayLast5Against: 1.2 as number | null,
      homeSeasonForHome: 1.5 as number | null,
      homeSeasonAgainstHome: 1.1 as number | null,
      awaySeasonForAway: 1.2 as number | null,
      awaySeasonAgainstAway: 1.2 as number | null,
      poissonShareHome: null as number | null,
      homePlayed: 10 as number | null,
      awayPlayed: 10 as number | null,
      injuryHome: 0,
      injuryAway: 0,
      homeForm: null as string | null,
      awayForm: null as string | null,
      h2h: [] as { homeGoals: number; awayGoals: number; homeIsCurrentHome: boolean; daysAgo: number }[],
      leagueAvgTotal: 2.5,
      leagueAvgHome: 1.38,
      leagueAvgAway: 1.12,
      lastNHome: 12,
      lastNAway: 12,
    };
    const h2h = [
      { homeGoals: 5, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 20 },
      { homeGoals: 4, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 50 },
      { homeGoals: 4, awayGoals: 1, homeIsCurrentHome: true, daysAgo: 80 },
      { homeGoals: 3, awayGoals: 0, homeIsCurrentHome: true, daysAgo: 110 },
    ];
    const withH2h = estimateLambdas({ ...base, h2h });
    const noH2h = estimateLambdas(base);
    assert.ok(withH2h.lambdaH > noH2h.lambdaH + 0.12, `H2H ignored: ${withH2h.lambdaH} vs ${noH2h.lambdaH}`);
    assert.ok(withH2h.lambdaH < 2.8, `H2H became the attack: ${withH2h.lambdaH}`);
  });

  it("a 0.8 last-five attack stays a thin attack", () => {
    const p = estimateLambdas({
      homeLast5For: 1.4,
      homeLast5Against: 1.0,
      awayLast5For: 0.8,
      awayLast5Against: 0.4,
      homeSeasonForHome: 1.4,
      homeSeasonAgainstHome: 1.0,
      awaySeasonForAway: 0.9,
      awaySeasonAgainstAway: 1.1,
      poissonShareHome: null,
      homePlayed: 12,
      awayPlayed: 12,
      injuryHome: 0,
      injuryAway: 0,
      homeForm: null,
      awayForm: null,
      h2h: [],
      leagueAvgTotal: 2.5,
      leagueAvgHome: 1.38,
      leagueAvgAway: 1.12,
      lastNHome: 12,
      lastNAway: 12,
    });
    assert.ok(p.lambdaA < 1.15, `away λ ${p.lambdaA} erased the 0.8 last-five`);
  });

  it("thrashing last-5 does not become the attack rating", () => {
    const blank = {
      homeLast5For: 1.5 as number | null,
      homeLast5Against: 1.1 as number | null,
      awayLast5For: 1.2 as number | null,
      awayLast5Against: 1.2 as number | null,
      homeSeasonForHome: 1.5 as number | null,
      homeSeasonAgainstHome: 1.1 as number | null,
      awaySeasonForAway: 1.2 as number | null,
      awaySeasonAgainstAway: 1.2 as number | null,
      poissonShareHome: null as number | null,
      homePlayed: 10 as number | null,
      awayPlayed: 10 as number | null,
      injuryHome: 0,
      injuryAway: 0,
      homeForm: null as string | null,
      awayForm: null as string | null,
      h2h: [] as { homeGoals: number; awayGoals: number; homeIsCurrentHome: boolean; daysAgo: number }[],
      leagueAvgTotal: 2.5,
      leagueAvgHome: 1.38,
      leagueAvgAway: 1.12,
    };
    const normal = estimateLambdas(blank);
    const blowout = estimateLambdas({ ...blank, homeLast5For: 4.5, homeLast5Against: 0.3 });
    assert.ok(blowout.lambdaH > normal.lambdaH);
    assert.ok(blowout.lambdaH < 4.5 * 0.55 + 1.5 * 0.45);
  });
});

describe("latent state (spec 205–226)", () => {
  const now = 1_800_000_000;
  const samples = [
    { timestamp: now - 3 * 86400, opponentId: 9, gf: 3, ga: 0, home: true },
    { timestamp: now - 10 * 86400, opponentId: 9, gf: 2, ga: 1, home: true },
    { timestamp: now - 17 * 86400, opponentId: 9, gf: 1, ga: 1, home: true },
    { timestamp: now - 40 * 86400, opponentId: 9, gf: 0, ga: 2, home: true },
    { timestamp: now - 70 * 86400, opponentId: 9, gf: 0, ga: 1, home: true },
  ];

  it("EWMA weights the newest match more than the oldest", () => {
    const hotNow = [
      { timestamp: now - 2 * 86400, opponentId: 9, gf: 4, ga: 0, home: true },
      { timestamp: now - 20 * 86400, opponentId: 9, gf: 0, ga: 1, home: true },
    ];
    const hotThen = [
      { timestamp: now - 2 * 86400, opponentId: 9, gf: 0, ga: 1, home: true },
      { timestamp: now - 20 * 86400, opponentId: 9, gf: 4, ga: 0, home: true },
    ];
    const a = ewmaRate(hotNow, 5, "gf", now);
    const b = ewmaRate(hotThen, 5, "gf", now);
    assert.ok(a != null && b != null && a > b, `recent ${a} vs old ${b}`);
  });

  it("timescale blend sits between EWMA-3 and EWMA-20", () => {
    const short = ewmaRate(samples, 3, "gf", now);
    const long = ewmaRate(samples, 20, "gf", now);
    const mix = blendTimescales(samples, "gf", now);
    assert.ok(mix != null && short != null && long != null);
    assert.ok(mix < short + 1e-9 && mix > long - 1e-9);
  });

  it("log-linear λ rises with attack and falls with opponent defence", () => {
    const base = logLinearLambda(1.38, 0, 0);
    const hot = logLinearLambda(1.38, 0.3, -0.1);
    const cold = logLinearLambda(1.38, -0.2, 0.25);
    assert.ok(hot > base);
    assert.ok(cold < base);
  });

  it("Kalman attack rises after a scoring run", () => {
    const cold = kalmanSide(
      Array.from({ length: 6 }, (_, i) => ({
        timestamp: i,
        opponentId: 1,
        gf: 0,
        ga: 2,
        home: true,
      })),
      1.3,
    );
    const hot = kalmanSide(
      Array.from({ length: 6 }, (_, i) => ({
        timestamp: i,
        opponentId: 1,
        gf: 3,
        ga: 0,
        home: true,
      })),
      1.3,
    );
    assert.ok(hot.attack > cold.attack, `hot ${hot.attack} vs cold ${cold.attack}`);
    assert.ok(hot.defense > cold.defense);
  });

  it("finishing shrink and regress flag a 4.5 last-5 vs a 1.2 season", () => {
    const shrunk = finishingShrink(4.5, 1.2, 5, 8);
    assert.ok(shrunk < 2.6 && shrunk > 1.2);
    assert.ok(finishingRegress(4.5, 1.2, 5) > 0.5);
    assert.equal(finishingRegress(1.3, 1.2, 5), 0);
  });

  it("goal momentum is shrunk and signed", () => {
    assert.ok(goalMomentum(2.2, 1.3, 12) > 0.2);
    assert.ok(goalMomentum(2.2, 1.3, 12) < 2.2 - 1.3);
    assert.ok(goalMomentum(0.8, 1.4, 12) < 0);
  });

  it("latent attack on the snapshot mixes into λ", () => {
    const blank = {
      homeLast5For: 1.4 as number | null,
      homeLast5Against: 1.1 as number | null,
      awayLast5For: 1.2 as number | null,
      awayLast5Against: 1.3 as number | null,
      homeSeasonForHome: 1.4 as number | null,
      homeSeasonAgainstHome: 1.1 as number | null,
      awaySeasonForAway: 1.2 as number | null,
      awaySeasonAgainstAway: 1.3 as number | null,
      poissonShareHome: null as number | null,
      homePlayed: 10 as number | null,
      awayPlayed: 10 as number | null,
      injuryHome: 0,
      injuryAway: 0,
      homeForm: null as string | null,
      awayForm: null as string | null,
      h2h: [] as { homeGoals: number; awayGoals: number; homeIsCurrentHome: boolean; daysAgo: number }[],
      leagueAvgTotal: 2.5,
      leagueAvgHome: 1.38,
      leagueAvgAway: 1.12,
      lastNHome: 12,
      lastNAway: 12,
    };
    const base = estimateLambdas(blank);
    const lat = estimateLambdas({
      ...blank,
      homeAttack: 0.35,
      awayDefense: -0.15,
      awayAttack: -0.2,
      homeDefense: 0.2,
    });
    assert.ok(lat.lambdaH > base.lambdaH + 0.08, `λh ${lat.lambdaH} vs ${base.lambdaH}`);
    assert.ok(lat.lambdaA < base.lambdaA, `λa ${lat.lambdaA} vs ${base.lambdaA}`);
  });

  it("survival is monotone and matches Over 1.5 / 2.5", () => {
    const g = jointGrid(1.45, 1.12);
    const s = totalSurvival(g);
    const m = marketsFromGrid(g);
    assert.ok((s[0] ?? 0) > 0.99);
    assert.ok((s[2] ?? 0) >= (s[3] ?? 0));
    assert.ok((s[3] ?? 0) >= (s[4] ?? 0));
    assert.ok(Math.abs((s[2] ?? 0) - m.over15) < 1e-9);
    assert.ok(Math.abs((s[3] ?? 0) - m.over25) < 1e-9);
  });

  it("Monte Carlo interval covers the point total", () => {
    const mc = monteCarloOver15(1.45, 1.12, 0.08, 0.08, 200);
    const tot = 1.45 + 1.12;
    assert.ok(mc.lo < tot && mc.hi > tot);
    assert.ok(mc.pOver15 > 0.55 && mc.pOver15 < 0.9);
  });

  it("goal share splits a one-sided total from a balanced one", () => {
    const open = goalShare(1.2, 1.2);
    const tilt = goalShare(1.9, 0.5);
    assert.ok(Math.abs(open.home - 0.5) < 0.02);
    assert.ok(tilt.home > 0.75);
  });

  it("snapshot carries Kalman attack", () => {
    const snap = buildSnapshot({
      homeSamples: samples.map((s) => ({ ...s, home: true })),
      awaySamples: samples.map((s) => ({ ...s, gf: 0, ga: 2, home: false })),
      homeStats: null,
      awayStats: null,
      table: undefined,
      leagueGa: 1.2,
      h2hN: 0,
      hasInjuries: false,
      hasOdds: true,
    });
    assert.ok(snap.homeLatent.attack > snap.awayLatent.attack);
  });

  it("SMA(5) is the unweighted last five and ignores the tail", () => {
    const cliff = samplesFromGoals([3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(smaRate(cliff, 5, "gf"), 3);
    assert.ok(Math.abs((smaRate(cliff, 20, "gf") ?? 0) - 0.75) < 1e-9);
    const ema = emaSpanRate(cliff, 5, "gf");
    assert.ok(ema != null && ema > 0.75 && ema < 3);
  });

  it("DC last-20 mean sits on SMA(20) for a weekly book", () => {
    const even = samplesFromGoals(Array.from({ length: 20 }, () => 1.2));
    const asOf = even[0]!.timestamp;
    const dc = dcWeightedRate(even, "gf", asOf);
    const sma = smaRate(even, 20, "gf");
    assert.ok(dc != null && sma != null);
    assert.ok(Math.abs(dc - sma) < 0.02);
  });

  it("movingAverages on a hot last-5 lifts SMA5 over SMA20", () => {
    const hot = samplesFromGoals([4, 3, 2, 3, 2, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 2, 0, 1, 1]);
    const ma = movingAverages(hot, 5, "gf", hot[0]!.timestamp);
    assert.equal(ma.n, 20);
    assert.ok((ma.sma5 ?? 0) > (ma.sma20 ?? 0));
    assert.ok((ma.ewma5 ?? 0) > (ma.ewma20 ?? 0));
  });
});

describe("binary markets survive the CS-only trap", () => {
  it("a posted 1.90 home favourite is kept after Shin pooling", () => {
    const lam = estimateLambdas({
      homeLast5For: 1.8,
      homeLast5Against: 0.8,
      awayLast5For: 0.9,
      awayLast5Against: 1.5,
      homeSeasonForHome: 1.85,
      homeSeasonAgainstHome: 0.75,
      awaySeasonForAway: 0.95,
      awaySeasonAgainstAway: 1.55,
      poissonShareHome: 0.62,
      homePlayed: 12,
      awayPlayed: 12,
      injuryHome: 0,
      injuryAway: 0,
      homeForm: "WWWDW",
      awayForm: "LLDWL",
      h2h: [],
      leagueAvgTotal: 2.5,
      leagueAvgHome: 1.38,
      leagueAvgAway: 1.12,
      homeRank: 2,
      awayRank: 16,
      homeGD: 14,
      awayGD: -8,
      lastNHome: 12,
      lastNAway: 12,
    });
    const m = marketsFromGrid(jointGrid(lam.lambdaH, lam.lambdaA));
    const implied = 1 / 1.9;
    const ens = ensembleForKind("home", {
      dc: m.home,
      shin: implied,
      api: m.home,
      elo: m.home,
      h2h: m.home,
    });
    const skip = pickSanity({
      kind: "home",
      lambdaH: lam.lambdaH,
      lambdaA: lam.lambdaA,
      accuracy: ens.accuracy,
      implied,
      agreement: ens.agreement,
      leagueWeight: 1,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "Arsenal",
      away: "Everton",
      odd: 1.9,
    });
    assert.equal(skip, null, `home dropped: ${skip} λ ${lam.lambdaH.toFixed(2)}/${lam.lambdaA.toFixed(2)} acc ${ens.accuracy.toFixed(3)}`);
  });

  it("BTTS yes is kept when both sides actually score", () => {
    const btts = pickSanity({
      kind: "btts_yes",
      lambdaH: 1.25,
      lambdaA: 1.05,
      accuracy: 0.55,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.9,
      homeFts: 0.22,
      awayFts: 0.25,
    });
    assert.equal(btts, null, `btts dropped: ${btts}`);
    const ou = pickSanity({
      kind: "over_25",
      lambdaH: 1.45,
      lambdaA: 1.2,
      accuracy: 0.55,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 1,
      bookmaker: "Pinnacle",
      advice: null,
      winner: null,
      home: "A",
      away: "B",
      odd: 1.9,
    });
    assert.equal(ou, null, `over 2.5 dropped: ${ou}`);
  });

  it("last-5 rates are the results page, not last-20 shrink", () => {
    const hull = last5Rates(
      [
        { timestamp: 1, opponentId: 2, gf: 0, ga: 1, home: false },
        { timestamp: 2, opponentId: 3, gf: 0, ga: 0, home: true },
        { timestamp: 3, opponentId: 4, gf: 1, ga: 0, home: false },
        { timestamp: 4, opponentId: 5, gf: 1, ga: 1, home: true },
        { timestamp: 5, opponentId: 6, gf: 2, ga: 0, home: true },
      ],
      5,
    );
    assert.equal(hull.n, 5);
    assert.equal(hull.btts, 0.2);
    assert.equal(hull.fts, 0.4);
    const mixed = [
      { timestamp: 1, opponentId: 2, gf: 6, ga: 3, home: true, leagueId: 48 },
      { timestamp: 2, opponentId: 3, gf: 1, ga: 2, home: false, leagueId: 39 },
      { timestamp: 3, opponentId: 4, gf: 4, ga: 3, home: true, leagueId: 39 },
      { timestamp: 4, opponentId: 5, gf: 2, ga: 0, home: true, leagueId: 48 },
      { timestamp: 5, opponentId: 6, gf: 2, ga: 3, home: false, leagueId: 39 },
    ];
    const pl = samplesForMatch(mixed, 39);
    assert.equal(pl.length, 3);
    assert.equal(pl.every((s) => s.leagueId === 39), true);
  });

  it("BTTS ensemble treats last-5 H2H as a 10% expert, not the side", () => {
    const ens = ensembleForKind("btts_yes", {
      dc: 0.57,
      shin: 0.5,
      api: 0.55,
      elo: 0.54,
      h2h: 0.2,
    });
    assert.ok(ens.accuracy < 0.56, `H2H 1/5 should pull below DC: ${ens.accuracy}`);
    assert.ok(ens.accuracy > 0.45, `H2H 10% must not flip a 57% grid: ${ens.accuracy}`);
  });
});

describe("unified extra markets", () => {
  it("marketsFromGrid DC identities and extra O/U / team-to-score", () => {
    const grid = jointGrid(1.4, 1.1);
    const m = marketsFromGrid(grid);
    assert.ok(Math.abs(m.dc1x + m.dcx2 - m.dc12 - 2 * m.draw) < 1e-9);
    assert.ok(Math.abs(m.dc1x - (m.home + m.draw)) < 1e-9);
    assert.ok(m.over05 > m.over15);
    assert.ok(m.over15 > m.over25);
    assert.ok(m.over25 > m.over35);
    assert.ok(m.homeScore > m.over25);
    assert.equal(pForKind("dc_1x", m), m.dc1x);
    assert.equal(pForKind("over_35", m), m.over35);
    assert.equal(pForKind("home_score", m), m.homeScore);
  });

  it("gradeMarket settles draw / DC / AH / EH / extra O/U / team-to-score", () => {
    assert.equal(gradeMarket("draw", "Draw", 1, 1), true);
    assert.equal(gradeMarket("draw", "Draw", 1, 0), false);
    assert.equal(gradeMarket("dc_1x", "1X", 1, 0), true);
    assert.equal(gradeMarket("dc_1x", "1X", 0, 2), false);
    assert.equal(gradeMarket("dc_12", "12", 1, 1), false);
    assert.equal(gradeMarket("over_35", "Over 3.5", 2, 2), true);
    assert.equal(gradeMarket("home_score", "Home to score", 1, 0), true);
    assert.equal(gradeMarket("away_score", "Away to score", 1, 0), false);
    assert.equal(gradeMarket("ah", "Home -0.5", 2, 0), true);
    assert.equal(gradeMarket("ah", "Home -0.5", 1, 1), false);
    assert.equal(gradeMarket("ah", "Home -1", 1, 0), null);
    assert.equal(gradeMarket("eh", "Home -1", 1, 0), false);
    assert.equal(gradeMarket("eh", "Draw -1", 1, 0), true);
    assert.equal(gradeMarket("ou_asian", "Over 2.25", 2, 1), true);
    assert.equal(gradeMarket("ou_asian", "Over 2.0", 1, 1), null);
  });

  it("pickSanity gates draw / DC / team / AH / player / Under 0.5", () => {
    const base = {
      lambdaH: 1.38,
      lambdaA: 1.12,
      accuracy: 0.56,
      implied: 0.52,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null as string | null,
      winner: null as string | null,
      home: "Arsenal",
      away: "Everton",
    };
    assert.ok(pickSanity({ ...base, kind: "player_ga" }), "player without minutes is NO BET");
    assert.ok(
      pickSanity({ ...base, kind: "player_ga", expectedMinutes: 85, playerOrP: 0.3, accuracy: 0.35, countLambda: 0.4 }),
      "player G∪A too thin",
    );
    assert.equal(
      pickSanity({
        ...base,
        kind: "player_ga",
        expectedMinutes: 85,
        playerOrP: 0.55,
        accuracy: 0.55,
        countLambda: 0.5,
        odd: 1.8,
        implied: 1 / 1.8,
      }),
      null,
    );
    assert.ok(pickSanity({ ...base, kind: "under_05" }), "Under 0.5 is a lock");
    assert.ok(pickSanity({ ...base, kind: "draw", odd: 3.4, accuracy: 0.2, gridDraw: 0.2 }));
    assert.equal(
      pickSanity({
        ...base,
        kind: "draw",
        odd: 3.4,
        implied: 1 / 3.4,
        accuracy: 0.32,
        gridDraw: 0.3,
      }),
      null,
    );
    assert.ok(pickSanity({ ...base, kind: "dc_1x", accuracy: 0.55, odd: 1.4, implied: 1 / 1.4 }));
    assert.equal(
      pickSanity({
        ...base,
        kind: "dc_1x",
        accuracy: 0.72,
        odd: 1.45,
        implied: 1 / 1.45,
      }),
      null,
    );
    assert.ok(pickSanity({ ...base, kind: "home_score", accuracy: 0.65, odd: 1.3, implied: 1 / 1.3 }));
    assert.equal(
      pickSanity({
        ...base,
        kind: "home_score",
        accuracy: 0.86,
        odd: 1.167,
        implied: 1 / 1.167,
      }),
      null,
      "real TTS 1.167 is playable, not a 1.18 lock",
    );
    assert.ok(pickSanity({ ...base, kind: "home_score", accuracy: 0.78, odd: 1.08, implied: 1 / 1.08 }));
    assert.equal(
      pickSanity({
        ...base,
        kind: "home_score",
        accuracy: 0.78,
        odd: 1.35,
        implied: 1 / 1.35,
      }),
      null,
    );
    assert.ok(pickSanity({ ...base, kind: "ah", accuracy: 0.55, odd: 1.9, implied: 1 / 1.9, ahCover: 0.4, ahEv: 0.1 }));
    assert.equal(
      pickSanity({
        ...base,
        kind: "ah",
        accuracy: 0.58,
        odd: 1.9,
        implied: 1 / 1.9,
        ahCover: 0.58,
        ahEv: 0.08,
      }),
      null,
    );
    assert.ok(
      pickSanity({
        ...base,
        kind: "home",
        odd: 1.9,
        implied: 1 / 1.9,
        accuracy: 0.56,
        drawRisk: 82,
      }),
      "high draw risk must veto a straight win",
    );
    assert.ok(
      pickSanity({
        ...base,
        kind: "draw",
        odd: 3.4,
        implied: 1 / 3.4,
        accuracy: 0.32,
        gridDraw: 0.3,
        drawConcentration: 0.4,
      }),
      "low draw concentration is NO BET",
    );
    assert.ok(
      pickSanity({
        ...base,
        kind: "ou_asian",
        selection: "Over 2.25",
        odd: 1.9,
        implied: 1 / 1.9,
        accuracy: 0.58,
        ahCover: 0.58,
        ahEv: -0.02,
      }),
      "Asian total needs +EV settlement",
    );
    assert.equal(
      pickSanity({
        ...base,
        kind: "ou_asian",
        selection: "Over 2.25",
        odd: 1.9,
        implied: 1 / 1.9,
        accuracy: 0.58,
        ahCover: 0.58,
        ahEv: 0.06,
        lambdaH: 1.5,
        lambdaA: 1.2,
      }),
      null,
    );
  });

  it("pickSanity floors odd/even 0.54, multi-goals 0.40, combo 0.40", () => {
    const base = {
      lambdaH: 1.38,
      lambdaA: 1.12,
      implied: 1 / 1.9,
      agreement: 0.7,
      leagueWeight: 0.9,
      bookmaker: "Pinnacle",
      advice: null as string | null,
      winner: null as string | null,
      home: "Arsenal",
      away: "Everton",
      odd: 1.9,
    };
    assert.ok(pickSanity({ ...base, kind: "odd_even", accuracy: 0.53 }), "odd/even is a coin");
    assert.equal(pickSanity({ ...base, kind: "odd_even", accuracy: 0.56 }), null);
    assert.ok(pickSanity({ ...base, kind: "multi_goals", accuracy: 0.35 }), "multi-goals range too thin");
    assert.equal(pickSanity({ ...base, kind: "multi_goals", accuracy: 0.45 }), null);
    assert.ok(pickSanity({ ...base, kind: "combo", accuracy: 0.35 }), "combo joint P too thin");
    assert.equal(pickSanity({ ...base, kind: "combo", accuracy: 0.45 }), null);
  });

  it("extractFixtureMarkets reads bets 4 / 5 extra lines / 9 / 12 / 45", () => {
    const books = [
      {
        id: 4,
        name: "Pinnacle",
        bets: [
          {
            id: 4,
            name: "Asian Handicap",
            values: [
              { value: "Home", odd: "1.90", handicap: "-0.75" },
              { value: "Away", odd: "1.95", handicap: "0.75" },
            ],
          },
          {
            id: 9,
            name: "Handicap Result",
            values: [
              { value: "Home", odd: "2.20", handicap: "-1" },
              { value: "Draw", odd: "3.40", handicap: "-1" },
              { value: "Away", odd: "3.10", handicap: "-1" },
            ],
          },
          {
            id: 12,
            name: "Double Chance",
            values: [
              { value: "Home/Draw", odd: "1.40" },
              { value: "Draw/Away", odd: "2.10" },
              { value: "Home/Away", odd: "1.30" },
            ],
          },
          {
            id: 5,
            name: "Goals Over/Under",
            values: [
              { value: "Over 0.5", odd: "1.12" },
              { value: "Under 0.5", odd: "6.00" },
              { value: "Over 3.5", odd: "2.40" },
              { value: "Under 3.5", odd: "1.55" },
              { value: "Over 2.25", odd: "1.82" },
              { value: "Under 2.25", odd: "2.05" },
            ],
          },
          {
            id: 45,
            name: "Cards Over/Under",
            values: [
              { value: "Over 4.5", odd: "1.85" },
              { value: "Under 4.5", odd: "1.90" },
            ],
          },
          {
            id: 49,
            name: "Total Corners",
            values: [
              { value: "Over 9.5", odd: "1.85" },
              { value: "Under 9.5", odd: "1.90" },
            ],
          },
          {
            id: 52,
            name: "Home Team Total Corners",
            values: [
              { value: "Over 5.5", odd: "1.95" },
              { value: "Under 5.5", odd: "1.80" },
            ],
          },
          {
            id: 92,
            name: "Anytime Goal Scorer",
            values: [{ value: "Erling Haaland", odd: "1.66" }],
          },
          {
            id: 21,
            name: "Odd/Even",
            values: [
              { value: "Even", odd: "1.90" },
              { value: "Odd", odd: "1.91" },
            ],
          },
          {
            id: 99,
            name: "Multi Goals",
            values: [
              { value: "0-1", odd: "3.20" },
              { value: "2-3", odd: "2.05" },
              { value: "4-5", odd: "3.10" },
              { value: "6+", odd: "4.80" },
            ],
          },
        ],
      },
    ];
    const m = extractFixtureMarkets({ fixture: { id: 77 }, bookmakers: books });
    assert.ok(m);
    assert.equal(m!.doubleChance?.["1x"]?.selection, "1X");
    assert.ok((m!.doubleChance?.["1x"]?.consensusOdd ?? 0) > 1.3);
    assert.ok((m!.asianHandicap ?? []).some((s) => s.selection === "Home -0.75"));
    assert.ok((m!.europeanHandicap ?? []).some((s) => /Home/.test(s.selection)));
    assert.ok((m!.ou05?.over?.consensusOdd ?? 9) < 1.2);
    assert.ok((m!.ou35?.over?.consensusOdd ?? 0) > 2);
    assert.ok((m!.ouAsian ?? []).some((s) => s.selection === "Over 2.25"));
    assert.ok((m!.cards ?? []).some((s) => s.selection === "Over 4.5"));
    assert.ok((m!.corners ?? []).some((s) => s.selection === "Over 9.5"));
    assert.ok((m!.corners ?? []).some((s) => /Home corners Over 5.5/.test(s.selection)));
    assert.ok((m!.playerGa ?? []).some((s) => /Haaland/.test(s.selection)));
    assert.equal(m!.oddEven?.even?.selection, "Even");
    assert.equal(m!.oddEven?.odd?.selection, "Odd");
    assert.ok((m!.multiGoals ?? []).some((s) => s.selection === "2-3"));
    assert.ok((m!.multiGoals ?? []).some((s) => s.selection === "6+"));
  });

  it("Home Team Score a Goal Yes is team-to-score; Score First/Last are not mixed in", () => {
    const books = [
      {
        id: 8,
        name: "Bet365",
        bets: [
          {
            id: 43,
            name: "Home Team Score a Goal",
            values: [
              { value: "Yes", odd: "1.167" },
              { value: "No", odd: "5.00" },
            ],
          },
          {
            id: 14,
            name: "Team To Score First",
            values: [
              { value: "Home", odd: "1.44" },
              { value: "Away", odd: "3.20" },
              { value: "Draw", odd: "8.00" },
            ],
          },
          {
            id: 15,
            name: "Team To Score Last",
            values: [
              { value: "Home", odd: "1.57" },
              { value: "Away", odd: "2.80" },
            ],
          },
          {
            id: 12,
            name: "Double Chance",
            values: [
              { value: "Home/Draw", odd: "1.44" },
              { value: "Draw/Away", odd: "2.10" },
              { value: "Home/Away", odd: "1.30" },
            ],
          },
        ],
      },
    ];
    const m = extractFixtureMarkets({ fixture: { id: 101 }, bookmakers: books });
    assert.ok(m);
    const yes = m!.homeScore?.yes?.consensusOdd ?? 0;
    assert.ok(Math.abs(yes - 1.167) < 1e-6, `TTS consensus ${yes} must stay on 1.167, not score-first/last`);
    assert.equal(m!.homeScore?.yes?.sharpBook, "Bet365");
    assert.ok(!(m!.homeScore?.yes?.books ?? []).some((l) => Math.abs(l.odd - 1.44) < 1e-6));
    assert.ok(!(m!.homeScore?.yes?.books ?? []).some((l) => Math.abs(l.odd - 1.57) < 1e-6));
    assert.ok((m!.doubleChance?.["1x"]?.consensusOdd ?? 0) > 1.4);
  });

  it("Home Team Total Goals Over 0.5 is team-to-score; Over 1.5 is not", () => {
    const books = [
      {
        id: 8,
        name: "Bet365",
        bets: [
          {
            id: 16,
            name: "Goals Over/Under - Home Team",
            values: [
              { value: "Over 0.5", odd: "1.202" },
              { value: "Under 0.5", odd: "4.50" },
              { value: "Over 1.5", odd: "1.80" },
              { value: "Under 1.5", odd: "1.95" },
            ],
          },
        ],
      },
    ];
    const m = extractFixtureMarkets({ fixture: { id: 102 }, bookmakers: books });
    assert.ok(m);
    const yes = m!.homeScore?.yes?.consensusOdd ?? 0;
    assert.ok(Math.abs(yes - 1.202) < 1e-6, `Over 0.5 consensus ${yes}`);
    assert.ok(!(m!.homeScore?.yes?.books ?? []).some((l) => Math.abs(l.odd - 1.8) < 1e-6));
  });

  it("1X + Home to score combo multiplies the posted singles, not a cloned 1X price", () => {
    const g = Array.from({ length: 6 }, () => Array(6).fill(0));
    g[1]![1] = 0.35;
    g[1]![0] = 0.25;
    g[2]![1] = 0.15;
    g[0]![0] = 0.05;
    g[0]![1] = 0.2;
    const rows = generateCombos(
      [
        { kind: "dc_1x", selection: "1X", odd: 1.602 },
        { kind: "home_score", selection: "Home to score", odd: 1.202 },
      ],
      g,
      3,
    );
    assert.ok(rows.length >= 1, "1X + TTS should be a legal combo");
    const combo = rows.find((c) => c.legs.some((l) => l.kind === "dc_1x") && c.legs.some((l) => l.kind === "home_score"));
    assert.ok(combo);
    assert.ok(Math.abs(combo!.combinedOdds - 1.602 * 1.202) < 1e-6, `combo ${combo!.combinedOdds}`);
    const ttsLeg = combo!.legs.find((l) => l.kind === "home_score");
    assert.ok(ttsLeg && Math.abs(ttsLeg.odd - 1.202) < 1e-6);
  });

  it("cardsPerMatch stays null when the stats payload has no cards", () => {
    const st = extractTeamStatistics(
      {
        team: { id: 5 },
        fixtures: { played: { home: 8, away: 7, total: 15 } },
        goals: { for: { average: { home: "1.9", away: "1.1" } }, against: { average: { home: "0.8", away: "1.4" } } },
      },
      5,
    );
    assert.equal(st?.cardsPerMatch ?? null, null);
    assert.equal(st?.cornersPerMatch ?? null, null);
    const withCards = extractTeamStatistics(
      {
        team: { id: 5 },
        fixtures: { played: { home: 8, away: 7, total: 15 } },
        goals: { for: { average: { home: "1.9", away: "1.1" } }, against: { average: { home: "0.8", away: "1.4" } } },
        cards: {
          yellow: { "0-15": { total: 10 }, "16-30": { total: 5 } },
          red: { "0-15": { total: 2 } },
        },
      },
      5,
    );
    assert.ok(withCards?.cardsPerMatch != null);
    assert.ok(Math.abs((withCards!.cardsPerMatch ?? 0) - 17 / 15) < 1e-9);
    const withCorners = extractTeamStatistics(
      {
        team: { id: 5 },
        fixtures: { played: { home: 8, away: 7, total: 15 } },
        goals: { for: { average: { home: "1.9", away: "1.1" } }, against: { average: { home: "0.8", away: "1.4" } } },
        corners: { for: { total: 75, average: { home: 5.5, away: 4.5, total: 5 } }, against: { total: 60 } },
      },
      5,
    );
    assert.ok(withCorners?.cornersPerMatch != null);
    assert.ok(Math.abs((withCorners!.cornersPerMatch ?? 0) - 5) < 1e-9);
    assert.equal(withCorners?.cornersAgainstPerMatch, 4);
  });

  it("extractFixtureCornerMap reads Corner Kicks and extractPlayerSeason keeps missing as null", () => {
    const map = extractFixtureCornerMap([
      { team: { id: 1 }, statistics: [{ type: "Corner Kicks", value: 7 }, { type: "Shots on Goal", value: 4 }] },
      { team: { id: 2 }, statistics: [{ type: "Corner Kicks", value: 3 }] },
    ]);
    assert.equal(map.get(1), 7);
    assert.equal(map.get(2), 3);
    const players = extractPlayerSeason(
      [
        {
          player: { id: 9, name: "Haaland" },
          statistics: [
            {
              team: { id: 50 },
              games: { minutes: 810, appearences: 9, lineups: 9, position: "Attacker" },
              goals: { total: 10, assists: 2 },
              shots: { total: 30, on: 16 },
              passes: { key: 6 },
            },
          ],
        },
        {
          player: { id: 10, name: "Unknown" },
          statistics: [{ team: { id: 50 }, games: { minutes: 400, appearences: 8, lineups: 3, position: "Midfielder" } }],
        },
      ],
      50,
    );
    assert.equal(players[0]?.goals, 10);
    assert.equal(players[0]?.assists, 2);
    assert.equal(players[1]?.goals, null);
    assert.equal(players[1]?.assists, null);
  });
});

describe("Torvaney xG grid", () => {
  it("one shot is a Bernoulli and two shots are a Poisson-binomial", () => {
    const one = poissonBinomialPmf([0.3], 8);
    assert.ok(Math.abs(one[0] - 0.7) < 1e-12);
    assert.ok(Math.abs(one[1] - 0.3) < 1e-12);
    const two = poissonBinomialPmf([0.5, 0.5], 8);
    assert.ok(Math.abs(two[0] - 0.25) < 1e-12);
    assert.ok(Math.abs(two[1] - 0.5) < 1e-12);
    assert.ok(Math.abs(two[2] - 0.25) < 1e-12);
    const none = poissonBinomialPmf([], 8);
    assert.ok(Math.abs(none[0] - 1) < 1e-12);
  });

  it("the scoreline grid is the product of the two margins", () => {
    const grid = torvaneyXgGrid([0.4], [0.25]);
    assert.ok(Math.abs(grid[0][0] - 0.6 * 0.75) < 1e-12);
    assert.ok(Math.abs(grid[1][0] - 0.4 * 0.75) < 1e-12);
    assert.ok(Math.abs(grid[0][1] - 0.6 * 0.25) < 1e-12);
    assert.ok(Math.abs(grid[1][1] - 0.4 * 0.25) < 1e-12);
    let sum = 0;
    for (const row of grid) for (const p of row) sum += p;
    assert.ok(Math.abs(sum - 1) < 1e-12);
    const mean = torvaneyGridMean(grid);
    assert.ok(Math.abs(mean.home - 0.4) < 1e-12);
    assert.ok(Math.abs(mean.away - 0.25) < 1e-12);
    assert.equal(torvaneyMatchRate([]), null);
    const side = torvaneySideRate([[0.4, 0.2], []]);
    assert.ok(side != null && Math.abs(side - 0.6) < 1e-12);
  });

  it("Dixon–Coles prefers λ at the xG total, and goals-only λ ignores a missing list", () => {
    const shotsH = [0.4, 0.25, 0.1];
    const shotsA = [0.2, 0.15];
    const near = torvaneyDcLogLik(shotsH, shotsA, 0.75, 0.35);
    const far = torvaneyDcLogLik(shotsH, shotsA, 2.4, 2.2);
    assert.ok(near > far);
    const base = estimateLambdas({ h2h: [] });
    const same = estimateLambdas({ h2h: [], homeXgShots: null, awayXgShots: [shotsA] });
    assert.equal(same.lambdaH, base.lambdaH);
    assert.equal(same.lambdaA, base.lambdaA);
    const moved = estimateLambdas({
      h2h: [],
      homeXgShots: [shotsH, shotsH],
      awayXgShots: [shotsA, shotsA],
    });
    assert.ok(moved.lambdaH !== base.lambdaH || moved.lambdaA !== base.lambdaA);
  });
});

describe("Poisson distribution", () => {
  it("recurrence matches e^{−λ} and the long sum is equidispersed", () => {
    const p = poissonInvestigate(1, 8);
    assert.ok(Math.abs(p.p0 - Math.exp(-1)) < 1e-12);
    assert.ok(Math.abs(p.rows[1]!.p - Math.exp(-1)) < 1e-12);
    assert.ok(Math.abs(p.rows[2]!.p - Math.exp(-1) / 2) < 1e-12);
    assert.equal(p.rows[1]!.step, 1);
    assert.equal(p.equidispersion, true);
    assert.ok(Math.abs(p.longMean - 1) < 1e-9);
    assert.ok(Math.abs(p.longVar - 1) < 1e-6);
  });

  it("league λ hides the tail; the clamp does not", () => {
    const league = poissonInvestigate(1.38, 8);
    const clamp = poissonInvestigate(3.35, 8);
    assert.equal(league.mode, 1);
    assert.ok(league.tail < 1e-4);
    assert.ok(clamp.tail > league.tail);
    assert.ok(clamp.truncatedMean < 3.35);
    assert.ok(clamp.truncatedVmr < 1);
    assert.equal(clamp.equidispersion, true);
  });

  it("two independent Poissons sum to one, and the score split is binomial", () => {
    const z = poissonClosure(1.38, 1.12);
    assert.ok(Math.abs(z.total - 2.5) < 1e-12);
    assert.ok(z.gap < 1e-9);
    assert.equal(z.mode, 2);
    const mid = z.splits.find((row) => row.home === 1 && row.away === 1)!;
    assert.ok(Math.abs(mid.binomial - mid.conditional) < 1e-9);
    assert.ok(Math.abs(mid.binomial - 2 * z.share * (1 - z.share)) < 1e-12);
    const over = z.lines.find((row) => row.line === 2.5)!;
    assert.ok(over.over > 0.45 && over.over < 0.6);
    assert.ok(Math.abs(z.truncatedOver25 - z.rawOver25) < 0.002);
    const hot = poissonClosure(3.35, 3.1);
    assert.ok(hot.tailLost > z.tailLost);
    assert.ok(Math.abs(hot.truncatedOver25 - hot.rawOver25) > Math.abs(z.truncatedOver25 - z.rawOver25));
  });
});

describe("Bayesian hierarchy", () => {
  it("a short perfect sample stays inside the prior, and a rate of 1 does not move the logit pool", () => {
    const z = hierarchicalTrace();
    const at = (n: number) => z.perfect.find((row) => row.n === n)!;
    assert.ok(Math.abs(at(0).partial - at(0).prior) < 1e-12);
    assert.ok(at(5).partial > 0.7 && at(5).partial < 0.76);
    assert.ok(Math.abs(at(5).weight - 5 / 11) < 1e-12);
    assert.ok(at(5).lo < at(5).prior && at(5).hi > at(5).prior);
    assert.ok(at(10).lo > at(10).prior);
    assert.ok(z.blank5.partial < z.blank5.prior);
    assert.ok(Math.abs(at(20).logit - at(20).prior) < 0.03);
    assert.ok(z.lambda[0].lambda > z.leagueH && z.lambda[0].lambda < z.observed);
    assert.ok(z.lambda[1].lambda > z.lambda[0].lambda);
    assert.ok(z.win5.partial > at(5).partial);
  });
});

describe("Latent variables", () => {
  it("the shock is unseen, and one match does not set the latent rate to the score", () => {
    const shock = latentShockPosterior(1.38, 1.12);
    const at = (score: string) => shock.scores.find((row) => row.score === score)!;
    assert.ok(Math.abs(shock.prior - 0.12) < 1e-9);
    assert.equal(at("0-0").mean, 0);
    assert.equal(at("2-0").mean, 0);
    assert.ok(Math.abs(at("1-1").mean - 0.087) < 0.002);
    assert.ok(Math.abs(at("1-1").posterior[1]!.prob - 0.087) < 0.002);
    assert.ok(at("2-2").mean > 0.25 && at("2-2").mean < 0.35);
    assert.ok(at("2-2").posterior[2]!.prob < 0.03);
    const state = latentStateTrace(1.38);
    assert.ok(Math.abs(state.steadyGain - 0.137) < 0.002);
    assert.ok(state.cold.gain > 0.27 && state.cold.lambda > 1.85 && state.cold.lambda < 2);
    assert.ok(state.spike.lambda < state.cold.lambda);
    assert.ok(state.spike.lambda > state.flat.lambda);
    assert.ok(state.shrink1 < state.shrink5 && state.shrink5 < 2.5);
    assert.ok(state.shrink1 < 1.8);
  });
});

describe("Trivariate Poisson", () => {
  it("the same covariances leave the third cumulant free, and the goal total is not a third Poisson", () => {
    const z = trivariatePoisson(1.38, 1.12, 10);
    const at = (block: { cells: Array<{ score: string; meanC: number; joint: number }> }, score: string) =>
      block.cells.find((row) => row.score === score)!;
    assert.ok(Math.abs(z.varTotal - 2.74) < 1e-9);
    assert.ok(z.varTotal > z.meanTotal);
    assert.ok(Math.abs(z.pairwise.p11 - z.independent.p11) < 1e-9);
    assert.ok(Math.abs(z.triple.p11 - z.independent.p11) < 1e-9);
    assert.equal(z.independent.kappa, 0);
    assert.equal(z.pairwise.kappa, 0);
    assert.ok(Math.abs(z.triple.kappa - 0.12) < 1e-9);
    assert.equal(z.independent.covHC, 0);
    assert.ok(Math.abs(z.pairwise.covHC - z.triple.covHC) < 1e-9);
    assert.ok(Math.abs(z.triple.corrHC - 0.0323) < 0.001);
    assert.ok(Math.abs(at(z.independent, "2-2").meanC - 10) < 1e-9);
    assert.ok(at(z.pairwise, "2-0").meanC > at(z.triple, "2-0").meanC + 0.05);
    assert.ok(at(z.triple, "2-2").meanC > at(z.pairwise, "2-2").meanC);
    assert.ok(at(z.pairwise, "0-0").meanC < at(z.triple, "0-0").meanC);
    assert.ok(Math.abs(at(z.pairwise, "2-0").joint - at(z.triple, "2-0").joint) < 1e-9);
    assert.ok(z.pairwise.rates.l1 > 0 && z.triple.rates.lc > 0);
  });
});

describe("Bivariate Poisson", () => {
  it("margins stay Poisson, the total does not, and the covariance cannot be negative", () => {
    const z = bivariatePoisson(1.38, 1.12);
    assert.ok(Math.abs(z.l1 - 1.26) < 1e-9);
    assert.ok(Math.abs(z.l2 - 1) < 1e-9);
    assert.ok(Math.abs(z.l3 - 0.12) < 1e-9);
    assert.ok(Math.abs(z.p00 - Math.exp(-2.38)) < 1e-12);
    assert.ok(z.p00 > z.product00);
    assert.ok(Math.abs(z.varTotal - 2.74) < 1e-9);
    assert.ok(Math.abs(z.vmrTotal - 1.096) < 1e-9);
    assert.ok(Math.abs(z.varDiff - 2.26) < 1e-9);
    const cell = Object.fromEntries(z.cells.map((c) => [c.score, c]));
    assert.equal(cell["0-0"].terms.length, 1);
    assert.equal(cell["1-1"].terms.length, 2);
    assert.ok(Math.abs(cell["1-1"].terms[1].p - 0.01111) < 0.0001);
    assert.ok(Math.abs(cell["1-1"].joint - (cell["1-1"].terms[0].p + cell["1-1"].terms[1].p)) < 1e-12);
    assert.ok(cell["2-0"].joint < cell["2-0"].product);
    assert.ok(cell["0-0"].joint / cell["0-0"].product > 1.1);
    assert.ok(Math.abs(z.margins[0].grid - z.margins[0].closed) < 1e-4);
    assert.equal(z.floorL3, 0.02);
    assert.equal(z.negL3, 0.02);
  });
});

describe("Conditional correlation", () => {
  it("an exact total is −1, the low corner is Dixon–Coles, and the shock slope is Karlis", () => {
    const z = conditionalCorrelation(1.38, 1.12);
    assert.equal(z.shockCorr, 0);
    assert.ok(Math.abs(z.slope - 0.087) < 0.002);
    assert.ok(Math.abs(z.bands.exact.maher + 1) < 1e-9);
    assert.ok(Math.abs(z.bands.exact.dc + 1) < 1e-9);
    assert.ok(Math.abs(z.bands.exact.karlis + 1) < 1e-9);
    assert.ok(z.bands.under.maher < -0.4);
    assert.ok(z.bands.under.dc > z.bands.under.maher);
    assert.ok(z.bands.over.karlis > z.bands.over.maher + 0.05);
    assert.ok(Math.abs(z.givenHome[2].dc - z.givenHome[2].maher) < 1e-6);
    assert.ok(z.givenHome[0].dc < z.givenHome[0].maher);
    assert.ok(z.givenHome[1].dc > z.givenHome[1].maher);
    assert.ok(z.givenHome[3].karlis - z.givenHome[0].karlis > 0.2);
    const byScore = Object.fromEntries(z.ratio.map((row) => [row.score, row]));
    assert.ok(byScore["0-0"].dc > 1.15);
    assert.ok(byScore["1-0"].dc < 0.9);
    assert.ok(Math.abs(byScore["2-2"].dc - 1) < 1e-6);
    assert.ok(byScore["0-0"].karlis > byScore["1-1"].karlis);
    assert.ok(Math.abs(z.tail.dc.lift - 1) < 1e-6);
    assert.ok(z.tail.karlis.lift > 1.1);
  });
});

describe("Karlis correlation", () => {
  it("the same shock is a larger correlation when the means are smaller", () => {
    const league = karlisCorrelation(1.38, 1.12);
    const low = karlisCorrelation(0.8, 0.7);
    const tiny = karlisCorrelation(0.45, 0.4);
    assert.ok(Math.abs(league.pearson - 0.0965) < 0.002);
    assert.ok(Math.abs(league.gridPearson - league.pearson) < 1e-3);
    assert.ok(league.phiScore > 0.04 && league.phiScore < 0.07);
    assert.ok(Math.abs(league.l3 - 0.12) < 1e-9);
    assert.ok(Math.abs(low.l3 - 0.12) < 1e-9);
    assert.ok(low.pearson > league.pearson + 0.05);
    assert.ok(tiny.l3 < 0.12);
    assert.ok(tiny.pearson > low.pearson);
  });
});

describe("Dixon–Coles estimate", () => {
  it("the four likelihood pulls cancel, and the stored third decimal is inside the SE", () => {
    const z = dcEstimate();
    assert.ok(Math.abs(z.expectedScore) < 1e-9);
    assert.ok(z.scoreAtZero < -0.05);
    assert.ok(z.info > 0.6 && z.info < 0.7);
    assert.ok(z.se1000 > Math.abs(z.gap) * 10);
    const pull = z.parts.map((p) => p.pull);
    assert.ok(Math.abs(pull[0] + pull[1]) < 1e-6);
    assert.ok(Math.abs(pull[2] - pull[1]) < 1e-6);
    assert.ok(Math.abs(pull[3] + pull[1]) < 1e-6);
    assert.ok(z.schedule[0].rho < z.schedule[1].rho);
    assert.ok(z.schedule[1].rho < z.schedule[2].rho);
    assert.ok(z.schedule[1].rho < DC_RHO);
  });
});

describe("Dixon–Coles free parameters", () => {
  it("three pins share one mean, and one Newton step from independence lands on the frozen ρ", () => {
    const z = dcParamFit();
    assert.equal(z.sameMeans, true);
    assert.ok(Math.abs(z.books[1].ah - 1.38 * 1.2) < 1e-12);
    assert.ok(Math.abs(z.books[1].ba - 1 / 1.2) < 1e-12);
    assert.ok(Math.abs(z.indepScore) < 1e-12);
    assert.ok(z.scoreAtZero < -0.08 && z.scoreAtZero > -0.09);
    assert.ok(z.infoAtZero > 0.64 && z.infoAtZero < 0.65);
    assert.ok(Math.abs(z.newton + 0.13) < 0.001);
    assert.ok(Math.abs(z.newton - DC_RHO_MLE) < 0.001);
    assert.ok(z.homeResidual > 0.44 && z.homeResidual < 0.46);
    assert.ok(z.awayResidual < -0.1 && z.awayResidual > -0.12);
  });
});

describe("Dixon–Coles adjustment", () => {
  it("one probability A is added to 0-0 and 1-1 and taken off the one-goal scores", () => {
    const z = dcAdjustment(1.38, 1.12);
    const paper = dcAdjustment(1.31, 1);
    const totals = dcAdjustment(1.38, 1.12, -0.1);
    assert.ok(Math.abs(z.gain - 0.01649) < 0.0001);
    assert.ok(Math.abs(z.move00 - z.gain) < 1e-4);
    assert.ok(Math.abs(z.move11 - z.gain) < 1e-4);
    assert.ok(Math.abs(z.move10 + z.gain) < 1e-4);
    assert.ok(Math.abs(z.draw - 2 * z.gain) < 1e-4);
    assert.ok(Math.abs(z.home + z.gain) < 1e-4);
    assert.ok(Math.abs(z.btts - z.gain) < 1e-4);
    assert.ok(Math.abs(z.over15 - z.gain) < 1e-4);
    assert.ok(Math.abs(z.over25) < 1e-9);
    assert.ok(Math.abs(z.rel["1-1"] - 0.13) < 1e-12);
    assert.ok(Math.abs(paper.rel["1-1"] - z.rel["1-1"]) < 1e-12);
    assert.ok(paper.gain > z.gain);
    assert.ok(paper.rel["0-0"] < z.rel["0-0"]);
    assert.ok(Math.abs(totals.gain / z.gain - 0.1 / 0.13) < 1e-9);
  });
});

describe("Dixon–Coles grid", () => {
  it("the four τ edits cancel, and Over 2.5 does not move", () => {
    const z = dcGridDetail(1.38, 1.12);
    const at = (score: string) => z.cells.find((c) => c.score === score)!;
    assert.ok(Math.abs(at("0-0").tau - 1.201) < 0.002);
    assert.ok(at("1-0").tau < 0.86 && at("0-1").tau < 0.83);
    assert.ok(Math.abs(at("1-1").tau - 1.13) < 0.002);
    assert.equal(at("2-1").tau, 1);
    assert.ok(Math.abs(at("2-1").dc - at("2-1").maher) < 1e-12);
    const move = at("0-0").dc - at("0-0").maher;
    assert.ok(Math.abs(at("1-0").maher - at("1-0").dc - move) < 1e-9);
    assert.ok(Math.abs(at("1-1").dc - at("1-1").maher - move) < 1e-9);
    assert.ok(Math.abs(z.home0.dc - z.home0.maher) < 1e-9);
    assert.ok(Math.abs(z.z - z.maherMass) < 1e-9);
    assert.ok(Math.abs(z.dc.over25 - z.maher.over25) < 1e-12);
    assert.ok(Math.abs(z.totals.over25 - z.maher.over25) < 1e-12);
    assert.ok(z.dc.over15 > z.maher.over15);
    assert.ok(Math.abs(z.dc.draw - z.maher.draw - 2 * move) < 1e-9);
  });
});

describe("Dixon–Coles correlation", () => {
  it("negative ρ moves the counts together, and ρ is not the correlation", () => {
    const z = dcCorrelation(1.38, 1.12, DC_RHO);
    assert.ok(Math.abs(z.maher.pearson) < 1e-6);
    assert.ok(z.dc.pearson > 0.01 && z.dc.pearson < 0.02);
    assert.ok(z.dc.pearson < z.karlisPearson);
    assert.ok(Math.abs(z.dc.phiScore - z.dc.phiBlank) < 1e-9);
    assert.ok(z.dc.phiScore > 0.07 && z.dc.phiScore < 0.09);
    assert.ok(z.dc.cov > 0 && z.dc.cov < z.karlisCov);
    const flat = dcCorrelation(1.38, 1.12, 0);
    assert.ok(Math.abs(flat.dc.pearson) < 1e-6);
    assert.ok(Math.abs(flat.dc.phiScore) < 1e-6);
  });
});

describe("Dixon–Coles correlation parameter", () => {
  it("Pearson is −ρ times a factor near 0.1, and the opposite sign", () => {
    const z = dcRhoMap(1.38, 1.12);
    assert.ok(z.factor > 0.1 && z.factor < 0.105);
    const frozen = z.rows.find((r) => r.name === "frozen");
    assert.ok(frozen);
    assert.ok(Math.abs(frozen.pearson - frozen.closed) < 1e-4);
    assert.ok(frozen.pearson > frozen.closed);
    assert.ok(Math.abs(frozen.cov - 0.0165) < 1e-4);
    assert.ok(frozen.pearson > 0 && frozen.pearson < 0.02);
    assert.ok(z.rows[0].pearson < 0.08);
    assert.ok(z.rows[2].rho < DC_RHO);
    assert.ok(z.rows[2].pearson > frozen.pearson);
    const upper = z.rows.find((r) => r.name === "upper edge");
    assert.ok(upper && upper.pearson < 0);
    assert.ok(Math.abs(frozen.cov - -1.38 * 1.12 * DC_RHO * Math.exp(-(1.38 + 1.12))) < 1e-4);
  });
});

describe("Negative binomial", () => {
  it("P(0) and the recurrence match NB2, and zeros exceed Poisson", () => {
    const mu = 1.38;
    const r = 18;
    const nb = negBinInvestigate(mu, r, 8);
    const p0 = (r / (r + mu)) ** r;
    assert.ok(Math.abs(nb.p0 - p0) < 1e-12);
    assert.ok(Math.abs(nb.rows[1]!.p - nb.rows[0]!.p * nb.rows[1]!.step!) < 1e-12);
    assert.ok(Math.abs(nb.vmr - (1 + mu / r)) < 1e-12);
    assert.ok(nb.p0 > nb.poissonP0);
    const thin = negBinInvestigate(mu, 3.5, 8);
    assert.ok(thin.p0Lift > nb.p0Lift);
    assert.ok(thin.vmr > nb.vmr);
  });

  it("frailty variance exceeds independent margins by the cross term", () => {
    const lh = 1.38;
    const la = 1.12;
    const r = 18;
    const gap = negBinFrailtyTotalVar(lh, la, r) - negBinIndependentTotalVar(lh, la, r);
    assert.ok(Math.abs(gap - (2 * lh * la) / r) < 1e-9);
  });
});

describe("Zero-inflated Poisson", () => {
  it("the three inflations do not move the same cells", () => {
    const pi = 0.05;
    const lh = 1.38;
    const z = zipInvestigate(lh, 1.12, pi);
    assert.ok(Math.abs(z.p0 - (pi + (1 - pi) * Math.exp(-lh))) < 1e-12);
    assert.ok(Math.abs(z.mean - (1 - pi) * lh) < 1e-12);
    assert.ok(Math.abs(z.vmr - (1 + pi * lh)) < 1e-9);
    assert.equal(z.piHatPoisson, 0);
    assert.ok(Math.abs(z.piHat - pi) < 1e-9);
    assert.ok(z.p00.only > z.p00.maher);
    assert.ok(z.p11.only < z.p11.maher);
    assert.ok(z.p10.only < z.p10.maher);
    assert.ok(z.zip.bttsYes < z.maher.bttsYes);
    const off = zipInvestigate(lh, 1.12, 0);
    assert.ok(z.zi.draw > off.zi.draw);
  });
});

describe("Skellam variants", () => {
  it("shock keeps the mean, cuts the variance, and buys the draw", () => {
    const lh = 1.38;
    const la = 1.12;
    const v = skellamVariants(lh, la, { r: 18 });
    assert.ok(Math.abs(v.mean - (lh - la)) < 1e-12);
    assert.ok(Math.abs(v.variance - (lh + la)) < 1e-12);
    assert.ok(Math.abs(v.shockMean - v.mean) < 1e-12);
    assert.ok(Math.abs(v.shockVariance - (lh + la - 2 * v.theta)) < 1e-12);
    assert.ok(v.shockVariance < v.variance);
    assert.ok(Math.abs(v.besselDraw - v.convDraw) < 1e-4);
    assert.ok(v.shock.draw > v.indep.draw);
    assert.ok(v.zi.draw > v.indep.draw);
    assert.ok(v.negbin.draw < v.indep.draw);
    const full = skellamVariants(lh, la, { minutesLeft: 90, scoreH: 0, scoreA: 0 });
    assert.ok(Math.abs(full.live.draw - full.indep.draw) < 1e-12);
    const done = skellamVariants(lh, la, { minutesLeft: 0, scoreH: 1, scoreA: 0 });
    assert.equal(done.live.home, 1);
    assert.equal(done.live.draw, 0);
  });
});

describe("Zero-inflated Skellam", () => {
  it("only k = 0 grows, the mean shrinks, and a pure Skellam has π̂ = 0", () => {
    const lh = 1.38;
    const la = 1.12;
    const pi = 0.05;
    const z = ziSkellamInvestigate(lh, la, pi);
    const zero = z.pmf.find((row) => row.k === 0)!;
    const one = z.pmf.find((row) => row.k === 1)!;
    assert.ok(Math.abs(zero.zi - (pi + (1 - pi) * zero.skellam)) < 1e-12);
    assert.ok(Math.abs(one.zi - (1 - pi) * one.skellam) < 1e-12);
    assert.ok(one.zi < one.skellam);
    assert.ok(Math.abs(z.moments.mean - (1 - pi) * (lh - la)) < 1e-12);
    assert.equal(z.piHatIfSkellam, 0);
    assert.ok(Math.abs(z.piHat - pi) < 1e-9);
    assert.equal(ziSkellamPiFromDraw(z.base.draw - 0.02, z.base.draw), 0);
    assert.ok(z.ziShock.draw > z.zi.draw);
    assert.ok(z.diag11 > z.p11);
    const off = ziSkellamInvestigate(lh, la, 0);
    assert.ok(Math.abs(off.zi.draw - off.base.draw) < 1e-12);
    assert.ok(Math.abs(off.moments.mean - (lh - la)) < 1e-12);
  });
});
