import { accuracyPriors, valuePriors } from "./models.ts";
import { EXPERTS, pctWeight, type EnsembleFamily, type ExpertKey, type ExpertWeights } from "./calibrate.ts";

export interface Paper {
  year: number;
  authors: string;
  title: string;
  venue: string;
  volume: string;
  issue: string | null;
  pages: string;
  doi: string;
  usedFor: string;
}

export function citeApa(p: Paper): string {
  const loc = p.issue ? `${p.volume}(${p.issue})` : p.volume;
  const title = /[.?!]$/.test(p.title) ? p.title : `${p.title}.`;
  return `${p.authors} (${p.year}). ${title} ${p.venue}, ${loc}, ${p.pages}. ${doiHref(p)}`;
}

export function doiHref(p: Paper): string {
  return p.doi.startsWith("http") ? p.doi : `https://doi.org/${p.doi}`;
}


export const EXPERT_METHOD_LABELS: Record<ExpertKey, string> = {
  dc: "Union grid (log-pool DC / Karlis / copula / NegBin / Elo, soft-raked onto Shin)",
  shin: "Shin market",
  elo: "Pi-ratings + Hvattum Elo",
  api: "API-Football (ignored when Shin exists)",
  h2h: "Baio-shrunk H2H",
};

export function ensembleWeightRows(
  family: EnsembleFamily,
  mode: "accuracy" | "value",
  live?: ExpertWeights | null,
): Array<[string, string, string | undefined]> {
  const prior = (mode === "accuracy" ? accuracyPriors(family) : valuePriors(family)) as ExpertWeights;
  const w = live ?? prior;
  return EXPERTS.filter((k) => (mode === "value" ? k !== "shin" : true)).map((k) => [
    EXPERT_METHOD_LABELS[k],
    pctWeight(w[k]),
    live ? `prior ${pctWeight(prior[k])}` : undefined,
  ]);
}

export const PAPERS = [
	{
		year: 1940,
		authors: "Deming, W. E., & Stephan, F. F.",
		title: "On a least squares adjustment of a sampled frequency table when the expected marginal totals are known",
		venue: "The Annals of Mathematical Statistics",
		volume: "11",
		issue: "4",
		pages: "427–444",
		doi: "10.1214/aoms/1177731829",
		usedFor: "Iterative proportional fitting. The union grid is soft-raked 40% onto Shin 1X2, Over 2.5, Over 1.5 and BTTS so every market is a slice of one table. Live on the ten."
	},
	{
		year: 1956,
		authors: "Kelly, J. L., Jr.",
		title: "A new interpretation of information rate",
		venue: "Bell System Technical Journal",
		volume: "35",
		issue: "4",
		pages: "917–926",
		doi: "10.1002/j.1538-7305.1956.tb03809.x",
		usedFor: "Fractional Kelly sizes the card (default ¼). Same-fixture haircut, 20% card cap, 2% full-Kelly floor. Displayed on Kelly — not used to rank the ten."
	},
	{
		year: 1966,
		authors: "Sharpe, W. F.",
		title: "Mutual fund performance",
		venue: "The Journal of Business",
		volume: "39",
		issue: "1",
		pages: "119–138",
		doi: "10.1086/294846",
		usedFor: "Sharpe ratio on unit-stake betting returns: (mean − rf) / σ with rf = 0 (cash). Not annualised — a football desk is not 252 sessions. Per-bet and per-date. Displayed on Accuracy; ex-ante Bernoulli version on Kelly. Does not rank the ten."
	},
	{
		year: 1991,
		authors: "Sortino, F. A., & van der Meer, R.",
		title: "Downside risk",
		venue: "The Journal of Portfolio Management",
		volume: "17",
		issue: "4",
		pages: "27–31",
		doi: "10.3905/jpm.1991.409343",
		usedFor: "Downside deviation δ around a minimum acceptable return. Desk MAR is cash (0): a losing slip, not a missed hurdle yield. Winning periods stay in the sample as zeros — they are not dropped — which is why Sortino beats Sharpe on a book that mostly hits. Live on Accuracy and Sortino. Does not rank the ten."
	},
	{
		year: 1994,
		authors: "Sortino, F. A., & Price, L. N.",
		title: "Performance measurement in a downside risk framework",
		venue: "The Journal of Portfolio Management",
		volume: "20",
		issue: "1",
		pages: "59–64",
		doi: "10.3905/jpm.1994.409501",
		usedFor: "Sortino = (mean − MAR) / δ with δ = √(Σ min(R−MAR,0)² / n). Winning periods stay as zeros, they are not dropped. Per-bet, per-date and rolling on Accuracy; interactive MAR / odd / hit-rate on Sortino; ex-ante Bernoulli with independent co-losses on Kelly. Desk MAR = 0 (cash)."
	},
	{
		year: 1999,
		authors: "Sortino, F. A., van der Meer, R., & Plantinga, A.",
		title: "The Dutch triangle",
		venue: "The Journal of Portfolio Management",
		volume: "26",
		issue: "1",
		pages: "50–57",
		doi: "10.3905/jpm.1999.319775",
		usedFor: "Upside potential ratio = mean(max(R−MAR,0)) / δ. Same δ as Sortino, the other tail — winning variance is the point of an overlay book, not a penalty. Live on Accuracy and Sortino. Does not rank the ten."
	},
	{
		year: 2002,
		authors: "Keating, C., & Shadwick, W. F.",
		title: "A universal performance measure",
		venue: "The Journal of Performance Measurement",
		volume: "6",
		issue: "3",
		pages: "59–84",
		doi: "https://people.duke.edu/~charvey/Teaching/BA453_2006/Keating_A_universal_performance_measure.pdf",
		usedFor: "Omega Ω(MAR) = UPM₁ / LPM₁, the probability-weighted gains over losses relative to cash. Uses the whole distribution, not just the second downside moment. A 2.00 overlay that hits 60% prints Ω = 1.50. Live on Accuracy, Sortino and the Kelly card. Does not rank the ten."
	},
	{
		year: 2004,
		authors: "Kaplan, P. D., & Knowles, J. A.",
		title: "Kappa: A generalized downside risk-adjusted performance measure",
		venue: "The Journal of Performance Measurement",
		volume: "8",
		issue: "3",
		pages: "42–54",
		doi: "http://w.performance-measurement.org/KaplanKnowles2004.pdf",
		usedFor: "κ_n = (μ − MAR) / LPM_n^{1/n}. κ₁ restates Omega (Ω = 1 + κ₁), κ₂ is Sortino, κ₃ weights crash tails harder than Sortino. Live on Accuracy and Sortino. Does not rank the ten."
	},
	{
		year: 2012,
		authors: "Bailey, D. H., & López de Prado, M.",
		title: "The Sharpe ratio efficient frontier",
		venue: "The Journal of Risk",
		volume: "15",
		issue: "2",
		pages: "3–44",
		doi: "10.21314/JOR.2012.255",
		usedFor: "Probabilistic Sharpe Ratio: P(true Sharpe > 0) given observed ŝ, n, skew and kurtosis. Non-normal betting returns inflate Sharpe SE; PSR is the honest p-value. Live on Accuracy."
	},
	{
		year: 2014,
		authors: "Bailey, D. H., & López de Prado, M.",
		title: "The deflated Sharpe ratio: correcting for selection bias, backtest overfitting and non-normality",
		venue: "The Journal of Portfolio Management",
		volume: "40",
		issue: "5",
		pages: "94–107",
		doi: "10.3905/jpm.2014.40.5.094",
		usedFor: "DSR deflates PSR for the number of families searched (win / BTTS / O/U / CS). Expected max Sharpe of N independent trials is the hurdle. A modest corpus Sharpe can fail DSR once you admit four families were tried. Live on Accuracy. Does not rank the ten."
	},
	{
		year: 1927,
		authors: "Wilson, E. B.",
		title: "Probable inference, the law of succession, and statistical inference",
		venue: "Journal of the American Statistical Association",
		volume: "22",
		issue: "158",
		pages: "209–212",
		doi: "10.1080/01621459.1927.10502953",
		usedFor: "Score interval for a binomial rate. Last-5 4/5 is 38–96% at 95% — the book still sits inside. Wald collapses to a point on 0/n and n/n; Wilson does not. Desk default on Significance. Does not rank the ten."
	},
	{
		year: 1934,
		authors: "Clopper, C. J., & Pearson, E. S.",
		title: "The use of confidence or fiducial limits illustrated in the case of the binomial",
		venue: "Biometrika",
		volume: "26",
		issue: "4",
		pages: "404–413",
		doi: "10.1093/biomet/26.4.404",
		usedFor: "Exact binomial belt: invert two one-sided tests. Wider than Wilson (4/5 is ~28–99%). The conservative contrast on Significance. Does not rank the ten."
	},
	{
		year: 1998,
		authors: "Agresti, A., & Coull, B. A.",
		title: "Approximate is better than “exact” for interval estimation of binomial proportions",
		venue: "The American Statistician",
		volume: "52",
		issue: "2",
		pages: "119–126",
		doi: "10.1080/00031305.1998.10480550",
		usedFor: "Add z²/2 hits and z²/2 misses, then Wald on the adjusted rate. Coverage is closer to 95% than Clopper–Pearson, which is conservative. Live on Significance next to Wilson."
	},
	{
		year: 2001,
		authors: "Brown, L. D., Cai, T. T., & DasGupta, A.",
		title: "Interval estimation for a binomial proportion",
		venue: "Statistical Science",
		volume: "16",
		issue: "2",
		pages: "101–133",
		doi: "10.1214/ss/1009213286",
		usedFor: "Wald coverage collapses near 0 and 1. Wilson and Agresti–Coull keep nominal 95% on small n. That is why a last-5 rate is never printed as 80% ± a Wald error. Live on Significance."
	},
	{
		year: 1979,
		authors: "Holm, S.",
		title: "A simple sequentially rejective multiple test procedure",
		venue: "Scandinavian Journal of Statistics",
		volume: "6",
		issue: "2",
		pages: "65–70",
		doi: "10.2307/4615733",
		usedFor: "Step-down FWER. Rank r must clear α/(m−r+1), and the first miss stops the procedure. Same bars as Hochberg, fewer keeps. Nested inside BH on any fixed list. Live on Significance. Does not rank the ten."
	},
	{
		year: 1988,
		authors: "Hochberg, Y.",
		title: "A sharper Bonferroni procedure for multiple tests of significance",
		venue: "Biometrika",
		volume: "75",
		issue: "4",
		pages: "800–802",
		doi: "10.1093/biomet/75.4.800",
		usedFor: "Step-up FWER on Holm's bars: keep the prefix through the last rank that clears α/(m−r+1). Not BH. BH steps up on (r/m)α and controls FDR, not the familywise error. Live on Significance. Does not rank the ten."
	},
	{
		year: 1995,
		authors: "Benjamini, Y., & Hochberg, Y.",
		title: "Controlling the false discovery rate: a practical and powerful approach to multiple testing",
		venue: "Journal of the Royal Statistical Society: Series B",
		volume: "57",
		issue: "1",
		pages: "289–300",
		doi: "10.1111/j.2517-6161.1995.tb02031.x",
		usedFor: "FDR for the daily card. Step-up: largest k* with p_(r) ≤ (r/m)α, then keep the whole prefix — a rank can miss its own bar and still be kept. Adjusted p is the running min of (m/k)p_(k) from the right, not (m/r)p. Equivalent to Storey q with π₀ = 1. Live on Significance. Does not rank the ten."
	},
	{
		year: 2001,
		authors: "Benjamini, Y., & Yekutieli, D.",
		title: "The control of the false discovery rate in multiple testing under dependency",
		venue: "The Annals of Statistics",
		volume: "29",
		issue: "4",
		pages: "1165–1188",
		doi: "10.1214/aos/1013699998",
		usedFor: "The method is BH run at α/H_m. Independence and PRDS (theorem 1.2) need no divisor. Arbitrary dependence, including one opposed pair, only proves uncorrected BH up to α·H_m. BY restores a ceiling of π₀α and does not spend the π₀ slack — that would be Storey, unproved here. Live on Significance. Does not rank the ten."
	},
	{
		year: 2002,
		authors: "Storey, J. D.",
		title: "A direct approach to false discovery rates",
		venue: "Journal of the Royal Statistical Society: Series B",
		volume: "64",
		issue: "3",
		pages: "479–498",
		doi: "10.1111/1467-9868.00346",
		usedFor: "π₀(λ) = #{p > λ} / m(1−λ). At threshold p_(r) the plug-in FDR is π₀·m·p_(r)/r. q is the running minimum of those ratios from the right, which equals min(1, π₀ × the BH-adjusted p). A later rank can pull an earlier q down. λ = ½ is the desk default. Live on Significance. Does not rank the ten."
	},
	{
		year: 2003,
		authors: "Storey, J. D.",
		title: "The positive false discovery rate: a Bayesian interpretation and the q-value",
		venue: "The Annals of Statistics",
		volume: "31",
		issue: "6",
		pages: "2013–2035",
		doi: "10.1214/aos/1074290335",
		usedFor: "q-value is the minimum pFDR if you reject every test at least as extreme. Posterior error probability under a simple mixture. Displayed next to p on Significance. Not a p-value — it is an FDR."
	},
	{
		year: 2003,
		authors: "Storey, J. D., & Tibshirani, R.",
		title: "Statistical significance for genomewide studies",
		venue: "Proceedings of the National Academy of Sciences",
		volume: "100",
		issue: "16",
		pages: "9440–9445",
		doi: "10.1073/pnas.1530509100",
		usedFor: "The genome-wide recipe: estimate π₀, plot pFDR vs t, call q. Smoother: quadratic π₀(λ), read at 0.95. A football ten is not a microarray — the λ table on Significance is that diagnostic at m = 10, which is why the tail is usually thin and λ-sensitive."
	},
	{
		year: 1995,
		authors: "Diebold, F. X., & Mariano, R. S.",
		title: "Comparing predictive accuracy",
		venue: "Journal of Business & Economic Statistics",
		volume: "13",
		issue: "3",
		pages: "253–263",
		doi: "10.1080/07350015.1995.10524599",
		usedFor: "Diebold–Mariano on daily Brier: d_t = L_prior − L_cal, HAC variance, one-sided p. The mix only leaves the paper prior when t rejects equal Brier at 5%. Live on Calibrate and Accuracy."
	},
	{
		year: 1997,
		authors: "Harvey, D., Leybourne, S., & Newbold, P.",
		title: "Testing the equality of prediction mean squared errors",
		venue: "International Journal of Forecasting",
		volume: "13",
		issue: "2",
		pages: "281–291",
		doi: "10.1016/S0169-2070(96)00719-4",
		usedFor: "Small-sample t correction on Diebold–Mariano: multiply by √((n+1−2h+h(h−1)/n)/n). Desk h = 1 on daily Brier. Live on Calibrate."
	},
	{
		year: 1964,
		authors: "Huber, P. J.",
		title: "Robust estimation of a location parameter",
		venue: "The Annals of Mathematical Statistics",
		volume: "35",
		issue: "1",
		pages: "73–101",
		doi: "10.1214/aoms/1177703732",
		usedFor: "Huber ψ: full influence inside ±k, then k sign(r). Last-5 / venue / micro / season goal rates are winsorised toward the league mean with k = 1.25 gf (k = 1.8 on GD/game). A side putting up 4–0s is pulled in; a side conceding 4–0s is not shrunk twice. Thin samples tighten k. Replaces the |GD|>3 cliff."
	},
	{
		year: 1961,
		authors: "Stone, M.",
		title: "The opinion pool",
		venue: "The Annals of Mathematical Statistics",
		volume: "32",
		issue: "4",
		pages: "1339–1342",
		doi: "10.1214/aoms/1177704866",
		usedFor: "Linear (arithmetic) opinion pool. Desk mixGrids is this rule — lab only. The ten use the logarithmic pool: linear mixing of grids is overdispersed and fails external Bayes."
	},
	{
		year: 1984,
		authors: "Genest, C.",
		title: "A characterization theorem for externally Bayesian groups",
		venue: "The Annals of Statistics",
		volume: "12",
		issue: "3",
		pages: "1100–1105",
		doi: "10.1214/aos/1176346726",
		usedFor: "The only pointwise pooling operator T(f)(θ) = H(f₁(θ),…,fₙ(θ))/∫H that is externally Bayesian is the log pool with wᵢ ≥ 0 and Σ wᵢ = 1. Dictatorship is wⱼ = 1. The ten: (1) log-pool the five model joints, (2) treat Shin as a second density — rake model onto book margins, then log-pool model ⊕ book at α = 0.4. Not a linear mix of 1X2 numbers. Pooling 1X2 scalars instead of the joint is the operator Genest rules out."
	},
	{
		year: 1986,
		authors: "Genest, C., McConway, K. J., & Schervish, M. J.",
		title: "Characterization of externally Bayesian pooling operators",
		venue: "The Annals of Statistics",
		volume: "14",
		issue: "2",
		pages: "487–501",
		doi: "10.1214/aos/1176349934",
		usedFor: "All EB operators are T(f)(θ) ∝ g(θ) Π fᵢ(θ)^{wᵢ}. g is a group prior independent of the opinions. The desk uses g ≡ 1 on the truncated 8×8 grid (1984 special case). Negative weights and Σ w ≠ 1 are allowed in 1986; the ten still enforce w ≥ 0, Σ w = 1."
	},
	{
		year: 1982,
		authors: "Maher, M. J.",
		title: "Modelling association football scores",
		venue: "Statistica Neerlandica",
		volume: "36",
		issue: "3",
		pages: "109–118",
		doi: "10.1111/j.1467-9574.1982.tb00782.x",
		usedFor: "Independent Poisson: λ = α_home × β_away × γ, μ = α_away × β_home. Joint cell is P(H=x)P(A=y). P(0)=e^{−λ}, then P(k)=P(k−1)·λ/k. Mean equals variance only before the 0…8 cap. Not in the union grid — it underestimates 0-0 and 1-1, which is why Dixon–Coles τ exists. Still the ρ=0 limit. Open Dixon–Coles for the Poisson trace; Maher to move attack, defence and γ."
	},
	{
		year: 1920,
		authors: "Greenwood, M., & Yule, G. U.",
		title: "An inquiry into the nature of frequency distributions representative of multiple happenings with particular reference to the occurrence of multiple attacks of disease or of repeated accidents",
		venue: "Journal of the Royal Statistical Society",
		volume: "83",
		issue: "2",
		pages: "255–279",
		doi: "10.2307/2341080",
		usedFor: "Poisson-gamma mixture is negative binomial. Desk NB2: Var=mu+mu^2/r, P(0)=(r/(r+mu))^r, then the recurrence (k-1+r)/k * mu/(r+mu). H2H totals set r, clamped to 3.5-18, which is heavier than Yip r-hat = mu/0.04. r to infinity is Poisson. The union's 8% is a product of two margins. The O/U lab puts one NB on the total; that frailty variance is larger by 2*lh*la/r. Open 1X2 / O/U."
	},
	{
		year: 1951,
		authors: "Moroney, M. J.",
		title: "Facts from Figures",
		venue: "Penguin",
		volume: "ch. 8",
		issue: null,
		pages: "96–103",
		doi: "https://en.wikipedia.org/wiki/Facts_from_Figures",
		usedFor: "First football application: 480 matches, mean 1.7, variance 1.9. His ‘modified Poisson’ is NB. r̂=μ²/(σ²−μ)=1.7²/0.2≈14.5 — close to the desk’s default 18 when H2H is thin."
	},
	{
		year: 1968,
		authors: "Reep, C., & Benjamin, B.",
		title: "Skill and chance in association football",
		venue: "Journal of the Royal Statistical Society, Series A",
		volume: "131",
		issue: "4",
		pages: "581–585",
		doi: "10.2307/2343726",
		usedFor: "NB / geometric on possessions: chance dominates completed-pass chains. Not a goals model, but the paper later writers cite when they reach for NegBin on scores. Desk uses NB2 on totals and a product grid on cells, not Reep’s geometric r=1."
	},
	{
		year: 2000,
		authors: "Karlis, D., & Ntzoufras, I.",
		title: "On modelling soccer data",
		venue: "Student",
		volume: "3",
		issue: null,
		pages: "229–244",
		doi: "http://www2.stat-athens.aueb.gr/~jbn/papers/paper3.htm",
		usedFor: "Negative binomial versus Poisson on 1997–98 EPL/Serie A: the improvement is minor once attack/defence are in the mean. Yip (2024) goals VMR 1.04 ⇒ r̂=μ/0.04≈62, which is Poisson for betting purposes. r=8 on the lab is VMR 1.31 — heavier than the league. The ten still mix NB because H2H can be wilder than the league."
	},
	{
		year: 1986,
		authors: "Pollard, R.",
		title: "Home advantage in soccer: a retrospective analysis",
		venue: "Journal of Sports Sciences",
		volume: "4",
		issue: "3",
		pages: "237–248",
		doi: "10.1080/02640418608732122",
		usedFor: "Home share of goals is not 1.38/1.12 everywhere. Each league has its own prior mean; Baio shrinks toward that, not a global English rate."
	},
	{
		year: 1969,
		authors: "Bates, J. M., & Granger, C. W. J.",
		title: "The combination of forecasts",
		venue: "Operational Research Quarterly",
		volume: "20",
		issue: "4",
		pages: "451–468",
		doi: "10.1057/jors.1969.103",
		usedFor: "Combining forecasts beats the best single model. Inverse-Brier is the starting mix; when experts are correlated the desk switches to Granger–Ramanathan least squares on the live logit pool, plus an intercept (temperature scale) when that beats the paper prior on expanding-window walk-forward. Live weights are the recency-weighted mean of those expanding-window fits — Open Calibrate. Recency half-life and n₀ are walked by Pardo WFO — Open Walk-forward. Shin is capped. I² still down-weights a quarrel on the live card."
	},
	{
		year: 1984,
		authors: "Granger, C. W. J., & Ramanathan, R.",
		title: "Improved methods of combining forecasts",
		venue: "Journal of Forecasting",
		volume: "3",
		issue: "2",
		pages: "197–204",
		doi: "10.1002/for.3980030207",
		usedFor: "Method A of Granger–Ramanathan (1984): least squares on the combination, with intercept. Accuracy tab fits simplex weights on the logit pool (the mix the ten actually use) then a Platt scale/bias on that mix. Applied only when expanding-window OOS Brier beats the paper prior. The ten use the recency-weighted mean of those window fits, not a one-shot in-sample refit — Open Calibrate. Union grid and Shin are not two studies — the intercept is the bias correction inverse-Brier cannot make."
	},
	{
		year: 1995,
		authors: "Diebold, F. X., & Mariano, R. S.",
		title: "Comparing predictive accuracy",
		venue: "Journal of Business & Economic Statistics",
		volume: "13",
		issue: "3",
		pages: "253–263",
		doi: "10.1080/07350015.1995.10524599",
		usedFor: "Diebold–Mariano test on daily Brier of the calibrated mix versus the paper prior. Loss differential d_t = L_prior − L_cal, Newey–West HAC, one-sided H1 that calibration is sharper. Live on Calibrate and Accuracy. Does not rank the ten.",
	},
	{
		year: 1997,
		authors: "Harvey, D., Leybourne, S., & Newbold, P.",
		title: "Testing the equality of prediction mean squared errors",
		venue: "International Journal of Forecasting",
		volume: "13",
		issue: "2",
		pages: "281–291",
		doi: "10.1016/S0169-2070(96)00719-4",
		usedFor: "Small-sample correction of Diebold–Mariano: multiply the t-stat by √((T−1)/T) for one-step losses and compare to Student-t with T−1 df. A 5-date football corpus cannot use a normal p-value. Live on Calibrate.",
	},
	{
		year: 1959,
		authors: "Roberts, S. W.",
		title: "Control chart tests based on geometric moving averages",
		venue: "Technometrics",
		volume: "1",
		issue: "3",
		pages: "239–250",
		doi: "10.1080/00401706.1959.10489860",
		usedFor: "Geometric moving average of observations — the match-count EMA with α = 2/(k+1) on Moving avg. Not the live λ timescale (that is day half-life EWMA). Does not rank the ten.",
	},
	{
		year: 1986,
		authors: "Hunter, J. S.",
		title: "The exponentially weighted moving average",
		venue: "Journal of Quality Technology",
		volume: "18",
		issue: "4",
		pages: "203–210",
		doi: "10.1080/00224065.1986.11979016",
		usedFor: "EWMA as a forecast: each new observation updates the mean by α. Live λ blends half-lives 3/5/10/20 days. Open Moving avg to put SMA, match-count EMA, and DC last-20 on the same book. Does not rank the ten.",
	},
	{
		year: 2000,
		authors: "White, H.",
		title: "A reality check for data snooping",
		venue: "Econometrica",
		volume: "68",
		issue: "5",
		pages: "1097–1126",
		doi: "10.1111/1468-0262.00152",
		usedFor: "Tests whether the best grid cell on the walk-forward has genuine OOS skill over the default 14d · n₀ 48, or is the max of four snooped Briers. Stationary-style bootstrap of the max mean daily Brier gap. Live on Walk-forward. Does not rank the ten.",
	},
	{
		year: 2008,
		authors: "Pardo, R.",
		title: "The evaluation and optimization of trading strategies",
		venue: "John Wiley & Sons",
		volume: "2nd ed.",
		issue: null,
		pages: "ch. 11",
		doi: "10.1002/9781119196969",
		usedFor: "Walk-forward optimization, not validation: each fold grid-searches (half-life, n₀) on the IS window, freezes the winner, scores the next date. Efficiency = IS Brier / OOS Brier of that path — ≳ 0.5–0.6 is the robustness bar. Anchored (all past dates) and rolling last-2. Last IS-winner is the live candidate; applied only if its mean OOS beats 14d · n₀ 48 by 0.0005 Brier. Open Walk-forward. Does not rank the ten.",
	},
	{
		year: 2000,
		authors: "Tashman, L. J.",
		title: "Out-of-sample tests of forecasting accuracy: an analysis and review",
		venue: "International Journal of Forecasting",
		volume: "16",
		issue: "4",
		pages: "437–450",
		doi: "10.1016/S0169-2070(00)00065-0",
		usedFor: "Five grades of one settled book. Resubstitution fits the intercept on the lines it then scores. K-fold that ignores the calendar lets a later date train an earlier one. Last-date holdout is honest and one number. Expanding walk-forward is the desk: day D never trains day D. Rolling last-7 keeps the embargo and drops the old book. Optimism is expanding Brier minus resubstitution Brier. Live on Accuracy. Does not rank the ten.",
	},
	{
		year: 2017,
		authors: "Bailey, D. H., Borwein, J. M., López de Prado, M., & Zhu, Q. J.",
		title: "The probability of backtest overfitting",
		venue: "Journal of Computational Finance",
		volume: "20",
		issue: "4",
		pages: "39–69",
		doi: "https://papers.ssrn.com/abstract=2326253",
		usedFor: "Combinatorially symmetric cross-validation (CSCV) estimates PBO: the chance the IS-best grid cell ranks worse than the OOS median. Runs when the corpus has six scored dates. Live on Walk-forward. Does not rank the ten.",
	},
	{
		year: 1986,
		authors: "DerSimonian, R., & Laird, N.",
		title: "Meta-analysis in clinical trials",
		venue: "Controlled Clinical Trials",
		volume: "7",
		issue: "3",
		pages: "177–188",
		doi: "10.1016/0197-2456(86)90046-2",
		usedFor: "Random-effects τ² on the five model probabilities. With equal within-model SE the pooled mean does not move; τ² and I² tell us whether the crowd is a fixed effect or a random one."
	},
	{
		year: 1986,
		authors: "Genest, C., & Zidek, J. V.",
		title: "Combining probability distributions: a critique and an annotated bibliography",
		venue: "Statistical Science",
		volume: "1",
		issue: "4",
		pages: "114–148",
		doi: "10.1214/ss/1177013825",
		usedFor: "Opinion pooling. Logarithmic pool of scoreline grids (Genest 1984 characterisation). Linear mix is mixGrids on the lab. Logit pool + Satopää is only the last 30% Shin calibration on the already-fused posterior."
	},
	{
		year: 1989,
		authors: "Clemen, R. T.",
		title: "Combining forecasts: A review and annotated bibliography",
		venue: "International Journal of Forecasting",
		volume: "5",
		issue: "4",
		pages: "559–583",
		doi: "10.1016/0169-2070(89)90012-5",
		usedFor: "Simple combinations beat complicated ones. Paper weights stay fixed; we do not fit a stacking regression on five points."
	},
	{
		year: 1953,
		authors: "Metropolis, N., Rosenbluth, A. W., Rosenbluth, M. N., Teller, A. H., & Teller, E.",
		title: "Equation of state calculations by fast computing machines",
		venue: "Journal of Chemical Physics",
		volume: "21",
		issue: "6",
		pages: "1087–1092",
		doi: "10.1063/1.1699114",
		usedFor: "The original Metropolis random-walk: propose, accept if the posterior rises, otherwise accept with e^{Δ}. Live on the Baio tab. Not used to rank the ten."
	},
	{
		year: 1970,
		authors: "Hastings, W. K.",
		title: "Monte Carlo sampling methods using Markov chains and their applications",
		venue: "Biometrika",
		volume: "57",
		issue: "1",
		pages: "97–109",
		doi: "10.1093/biomet/57.1.97",
		usedFor: "Asymmetric proposals: accept min(1, π(θ′)q(θ|θ′) / π(θ)q(θ′|θ)). The lab uses a symmetric Gaussian walk, so this ratio is 1."
	},
	{
		year: 1990,
		authors: "Gelfand, A. E., & Smith, A. F. M.",
		title: "Sampling-based approaches to calculating marginal densities",
		venue: "Journal of the American Statistical Association",
		volume: "85",
		issue: "410",
		pages: "398–409",
		doi: "10.1080/01621459.1990.10476213",
		usedFor: "Gibbs sampling made hierarchical Bayes practical. Baio’s WinBUGS model is this idea at team level. Our BTTS layer is conjugate, so Gibbs is just a Beta draw — shown next to MH on the Baio tab."
	},
	{
		year: 1992,
		authors: "Gelman, A., & Rubin, D. B.",
		title: "Inference from iterative simulation using multiple sequences",
		venue: "Statistical Science",
		volume: "7",
		issue: "4",
		pages: "457–472",
		doi: "10.1214/ss/1177011136",
		usedFor: "R̂ compares between-chain to within-chain variance. The Baio lab flags R̂ > 1.1. Split the step size down and watch it fail."
	},
	{
		year: 1992,
		authors: "Lambert, D.",
		title: "Zero-inflated Poisson regression, with an application to defects in manufacturing",
		venue: "Technometrics",
		volume: "34",
		issue: "1",
		pages: "1–14",
		doi: "10.1080/00401706.1992.10485228",
		usedFor: "ZIP: with probability π the count is a structural zero, else Poisson(λ). E=(1−π)λ, Var=(1−π)λ(1+πλ), π̂=(p0−e^{−λ})/(1−e^{−λ}). Football needs three different inflations: ZIP on a margin (extra shutouts, BTTS down), (0,0)-only on the joint (Karlis J=0), and diagonal / ZI-Skellam (extra draws). Dixon–Coles is none of these — it moves four cells and keeps Poisson margins. Lab only; π=0.05 is a prior, not an MLE."
	},
	{
		year: 1999,
		authors: "Jordan, M. I., Ghahramani, Z., Jaakkola, T. S., & Saul, L. K.",
		title: "An introduction to variational methods for graphical models",
		venue: "Machine Learning",
		volume: "37",
		issue: "2",
		pages: "183–233",
		doi: "10.1023/A:1007665907178",
		usedFor: "Replace the posterior with a tractable q and minimise KL(q‖π). On the Baio tab q is Gaussian on logit(p). Not used to rank the ten."
	},
	{
		year: 2017,
		authors: "Blei, D. M., Kucukelbir, A., & McAuliffe, J. D.",
		title: "Variational inference: a review for statisticians",
		venue: "Journal of the American Statistical Association",
		volume: "112",
		issue: "518",
		pages: "859–877",
		doi: "10.1080/01621459.2017.1285773",
		usedFor: "ELBO = E_q[log π] + H[q]. Climb it instead of sampling. Mean-field q is typically too tight — the lab shows VI 95% vs Metropolis 95%. The ten still print the conjugate mean."
	},
	{
		year: 2005,
		authors: "Hyvärinen, A.",
		title: "Estimation of non-normalized statistical models by score matching",
		venue: "Journal of Machine Learning Research",
		volume: "6",
		issue: "24",
		pages: "695–709",
		doi: "https://jmlr.org/papers/v6/hyvarinen05a.html",
		usedFor: "Fisher divergence ½ E_q‖∇log q − ∇log π‖². Same Gaussian q as the ELBO lab, no partition function. Open the Baio tab. Not used to rank the ten."
	},
	{
		year: 2011,
		authors: "Vincent, P.",
		title: "A connection between score matching and denoising autoencoders",
		venue: "Neural Computation",
		volume: "23",
		issue: "7",
		pages: "1661–1674",
		doi: "10.1162/NECO_a_00142",
		usedFor: "Denoising SM: match q’s score to −ε/σ² on noise-perturbed posterior draws. For a Gaussian that is s² = Var(θ)+σ² — the noise tax. Baio tab."
	},
	{
		year: 2012,
		authors: "Gutmann, M. U., & Hyvärinen, A.",
		title: "Noise-contrastive estimation of unnormalized statistical models, with applications to natural image statistics",
		venue: "Journal of Machine Learning Research",
		volume: "13",
		issue: "11",
		pages: "307–361",
		doi: "https://jmlr.org/papers/v13/gutmann12a.html",
		usedFor: "Classify posterior draws vs Gaussian noise; the classifier recovers log π − log p_noise. Alternative to score matching when you have samples. NCE loss on the Baio tab, not a ranker."
	},
	{
		year: 2016,
		authors: "Liu, Q., Lee, J. D., & Jordan, M. I.",
		title: "A kernelized Stein discrepancy for goodness-of-fit tests",
		venue: "Proceedings of Machine Learning Research",
		volume: "48",
		issue: null,
		pages: "276–284",
		doi: "10.48550/arXiv.1602.03253",
		usedFor: "KSD is Fisher matching in an RKHS — the kernelised cousin of Hyvärinen. 1D Fisher on the Baio tab is the same Stein identity without the kernel. Not used to rank the ten."
	},
	{
		year: 2019,
		authors: "Song, Y., & Ermon, S.",
		title: "Generative modeling by estimating gradients of the data distribution",
		venue: "Advances in Neural Information Processing Systems",
		volume: "32",
		issue: null,
		pages: "11918–11930",
		doi: "10.48550/arXiv.1907.05600",
		usedFor: "NCSN: DSM at many noise levels, then annealed Langevin. The lab uses one noise level. Sampling from the score is how you would draw a 20-team Baio model without MH; we still print the conjugate mean."
	},
	{
		year: 1991,
		authors: "Shin, H. S.",
		title: "Optimal betting odds against insider traders",
		venue: "The Economic Journal",
		volume: "101",
		issue: "408",
		pages: "1179–1185",
		doi: "10.2307/2234433",
		usedFor: "The pricing model: a bookmaker who faces a share z of insiders sets odds so expected profit is non-negative. Invert for z and the true p. Live on 1X2 · O/U; shinFit.z is the insider share. shinInvert (the probabilities) de-vigs every 1X2, BTTS and CS book on the ten."
	},
	{
		year: 1993,
		authors: "Shin, H. S.",
		title: "Measuring the incidence of insider trading in a market for state-contingent claims",
		venue: "The Economic Journal",
		volume: "103",
		issue: "420",
		pages: "1141–1153",
		doi: "10.2307/2234240",
		usedFor: "Empirical z on horse racing; football 1X2 z is typically 0.02–0.08 on sharp books, higher on soft overrounds. Closed form q_i = (√[z² + 4(1−z)π_i²/Σπ] − z) / [2(1−z)], z bisection so Σq = 1. Favourite-longshot: Shin puts more mass on the favourite than multiplicative de-vig."
	},
	{
		year: 1994,
		authors: "Madigan, D., & Raftery, A. E.",
		title: "Model selection and accounting for model uncertainty in graphical models using Occam's window",
		venue: "Journal of the American Statistical Association",
		volume: "89",
		issue: "428",
		pages: "1535–1546",
		doi: "10.1080/01621459.1994.10476894",
		usedFor: "Occam’s window: drop a model if the Bayes factor versus the current best exceeds 20:1. Live on the BMA tab. Not used to rank the ten."
	},
	{
		year: 1995,
		authors: "Kass, R. E., & Raftery, A. E.",
		title: "Bayes factors",
		venue: "Journal of the American Statistical Association",
		volume: "90",
		issue: "430",
		pages: "773–795",
		doi: "10.1080/01621459.1995.10476572",
		usedFor: "Grades on 2 ln BF: barely / positive / strong / very strong. The BMA tab labels each model against the current best."
	},
	{
		year: 1999,
		authors: "Hoeting, J. A., Madigan, D., Raftery, A. E., & Volinsky, C. T.",
		title: "Bayesian model averaging: a tutorial",
		venue: "Statistical Science",
		volume: "14",
		issue: "4",
		pages: "382–417",
		doi: "10.1214/ss/1009212519",
		usedFor: "P(y | D) = Σ P(y | Mₖ, D) P(Mₖ | D). On the BMA tab Shin stands in for D with a Gaussian (expected Brier) likelihood, SE 10 pp. As n grows, posterior mass collapses onto the model nearest the market — which is why the ten still use paper-fixed logit weights."
	},
	{
		year: 1997,
		authors: "Dixon, M. J., & Coles, S. G.",
		title: "Modelling association football scores and inefficiencies in the football betting market",
		venue: "Journal of the Royal Statistical Society: Series C (Applied Statistics)",
		volume: "46",
		issue: "2",
		pages: "265–280",
		doi: "10.1111/1467-9876.00065",
		usedFor: "Low-score τ (ρ ≈ −0.13, MLE ≈ −0.1285), the 8×8 joint grid, and ξ = 0.0065 per half-week (0.00186 / day, half-life ≈ 373 days) on H2H. Last-20 DC mean on Moving avg is this ξ — it sits on SMA(20). Primary engine for 1X2, BTTS, totals. CS cells are this grid raked to Shin 1X2 + O/U + BTTS (58% of the cell blend)."
	},
	{
		year: 2000,
		authors: "Rue, H., & Salvesen, Ø.",
		title: "Prediction and retrospective analysis of soccer matches in a league",
		venue: "Journal of the Royal Statistical Society: Series D (The Statistician)",
		volume: "49",
		issue: "3",
		pages: "399–418",
		doi: "10.1111/1467-9884.00243",
		usedFor: "Dynamic strengths — last-5 mixed with season-to-date instead of static rates. Complements Dixon–Coles ξ on the H2H window. The 1X2 structural blend still uses those walking λ."
	},
	{
		year: 2002,
		authors: "Crowder, M., Dixon, M., Gill, M., & Le, C.",
		title: "Dynamic modelling and prediction of English Football League matches for betting",
		venue: "Journal of the Royal Statistical Society: Series D (The Statistician)",
		volume: "51",
		issue: "2",
		pages: "157–168",
		doi: "10.1111/1467-9884.00305",
		usedFor: "Attack and defence as a state-space walk (spec §217). Last-N results update log-attack / log-defence with Kalman process noise q = 0.012. λ = exp(μ + att − def) is the Maher observation of that state."
	},
	{
		year: 2025,
		authors: "Michels, R., Ötting, M., & Karlis, D.",
		title: "Extending the Dixon and Coles model: an application to women’s football data",
		venue: "Journal of the Royal Statistical Society: Series C (Applied Statistics)",
		volume: "74",
		issue: "1",
		pages: "167–186",
		doi: "10.1093/jrsssc/qlae050",
		usedFor: "Dixon–Coles is a special case of the Sarmanov family. Desk keeps DC τ for 0-0/1-0/0-1/1-1, Karlis covariance and NegBin margins as competing grids on the same λ, log-pooled — not a single assumed copula."
	},
	{
		year: 2025,
		authors: "Ridall, P. G., Titman, A. C., & Pettitt, A. N.",
		title: "Bayesian state-space models for the modelling and prediction of the results of English Premier League football",
		venue: "Journal of the Royal Statistical Society: Series C (Applied Statistics)",
		volume: "74",
		issue: "3",
		pages: "717–742",
		doi: "10.1093/jrsssc/qlae075",
		usedFor: "Team strengths with posterior variance (spec §224–226). Two matches can share P(Over 1.5)=0.78; the one with tight λ SE ranks higher. Composite now divides by 1 + 0.55·SE."
	},
	{
		year: 2015,
		authors: "Koopman, S. J., & Lit, R.",
		title: "A dynamic bivariate Poisson model for analysing and forecasting match results in the English Premier League",
		venue: "Journal of the Royal Statistical Society: Series A (Statistics in Society)",
		volume: "178",
		issue: "1",
		pages: "167–186",
		doi: "10.1111/rssa.12042",
		usedFor: "Karlis bivariate Poisson with attack/defence as a state-space walk. The desk cannot run a 20-team Kalman on one API snapshot; last-five + ξ is the cheap version. Remaining-time Skellam on the 1X2 · O/U tab is the in-play slice of the same Poisson-process idea."
	},
	{
		year: 2019,
		authors: "Koopman, S. J., & Lit, R.",
		title: "Forecasting football match results in national league competitions using score-driven time series models",
		venue: "International Journal of Forecasting",
		volume: "35",
		issue: "2",
		pages: "797–809",
		doi: "10.1016/j.ijforecast.2018.10.011",
		usedFor: "Pairwise counts (goals) were the most precise forecasts; the Skellam difference model was the most successful for betting 1X2. That split is why the desk keeps Skellam in the win blend and the full grid for correct score — they are not the same likelihood."
	},
	{
		year: 2003,
		authors: "Karlis, D., & Ntzoufras, I.",
		title: "Analysis of sports data by using bivariate Poisson models",
		venue: "Journal of the Royal Statistical Society: Series D (The Statistician)",
		volume: "52",
		issue: "3",
		pages: "381–393",
		doi: "10.1111/1467-9884.00366",
		usedFor: "BTTS as joint mass 1 − P(H=0) − P(A=0) + P(0-0). Shared covariance c = 0.12 lifts P(0-0) to e^{−(λ+μ−c)} without moving the Poisson margins. Goal difference is Skellam(λh−c, λa−c) — the shock cancels. That closed form is the Karlis 1X2 slot (untruncated). Diagonal inflation of the grid is 14% of structural 1X2. Zero-inflated bivariate Poisson (J=0, extra (0,0) only) did not improve their 1997–98 fits — 0–0 was not under-predicted once the shock was in. 16% of structural BTTS, CS, and O/U."
	},
	{
		year: 2006,
		authors: "Karlis, D., & Ntzoufras, I.",
		title: "Bayesian analysis of the differences of count data",
		venue: "Statistics in Medicine",
		volume: "25",
		issue: "11",
		pages: "1885–1905",
		doi: "10.1002/sim.2372",
		usedFor: "Proof that X−Y is Skellam even when (X,Y) share a common shock. Variance of GD is λh+λa−2θ, so bivariate Poisson buys draws by shrinking the independent rates, not by correlating the difference. Live as karlisSkellam1x2 on the 1X2 · O/U tab."
	},
	{
		year: 2002,
		authors: "Crowder, M., Dixon, M., Ledford, A., & Robinson, M.",
		title: "Dynamic modelling and prediction of English Football League matches for betting",
		venue: "Journal of the Royal Statistical Society: Series D (The Statistician)",
		volume: "51",
		issue: "2",
		pages: "157–168",
		doi: "10.1111/1467-9884.00308",
		usedFor: "Attack and defence as a latent bivariate process; they bet 1X2, not cells. Last-five + Dixon–Coles ξ is the cheap version of that walk. Not a second Gibbs sampler on the daily snapshot."
	},
	{
		year: 2005,
		authors: "Forrest, D., Goddard, J., & Simmons, R.",
		title: "Odds-setters as forecasters: the case of English football",
		venue: "International Journal of Forecasting",
		volume: "21",
		issue: "3",
		pages: "551–564",
		doi: "10.1016/j.ijforecast.2005.03.003",
		usedFor: "Nearly 10,000 English games: published odds beat a large statistical model, and bootstraps of that model do not beat the odds. The live 1X2 accuracy weight is Shin 0.62 / grid 0.18. That 0.62 is this desk's prior, not a figure from the paper. Value still has to beat Shin. ±4pp clamp on liquid 1X2 — never applied to correct-score cells."
	},
	{
		year: 2005,
		authors: "Goddard, J.",
		title: "Regression models for forecasting goals and match results in association football",
		venue: "International Journal of Forecasting",
		volume: "21",
		issue: "2",
		pages: "331–340",
		doi: "10.1016/j.ijforecast.2004.08.002",
		usedFor: "A results model is competitive with a goals model. Hybrid: Dixon–Coles 1X2 as Dirichlet prior, H2H W/D/L as the data — 18% of structural 1X2. The same idea on BTTS (Beta–Binomial) is 22% of structural BTTS. Open the 1X2 · O/U tab."
	},
	{
		year: 2004,
		authors: "Goddard, J., & Asimakopoulos, I.",
		title: "Forecasting football results and the efficiency of fixed-odds betting",
		venue: "Journal of Forecasting",
		volume: "23",
		issue: "1",
		pages: "51–66",
		doi: "10.1002/for.877",
		usedFor: "Ordered probit on win–draw–lose, not on goals. End-of-season 1X2 prices are the least efficient; the desk still ranks on calibrated probability, not raw tipster 1X2."
	},
	{
		year: 2005,
		authors: "Karlis, D., & Ntzoufras, I.",
		title: "Bivariate Poisson and diagonal inflated bivariate Poisson regression models in R",
		venue: "Journal of Statistical Software",
		volume: "14",
		issue: "10",
		pages: "1–36",
		doi: "10.18637/jss.v014.i10",
		usedFor: "Mixture (1−p)·BP + p·diagonal. p = 0.05 on the Dixon–Coles grid. Extra draw mass without moving the Poisson totals much. Live on the 1X2 · O/U tab."
	},
	{
		year: 2009,
		authors: "Karlis, D., & Ntzoufras, I.",
		title: "Bayesian modelling of football outcomes: using the Skellam's distribution for the goal difference",
		venue: "IMA Journal of Management Mathematics",
		volume: "20",
		issue: "2",
		pages: "133–145",
		doi: "10.1093/imaman/dpn026",
		usedFor: "P(H−A = k) = e^{−(λh+λa)} (λh/λa)^{k/2} I_|k|(2√(λh λa)). Mean λh−λa, variance λh+λa. Independent Poisson 1X2 in closed form; zero-inflated Skellam adds draws — on 2006–07 EPL the extra π was not significant, so the desk keeps π = 0.05 as a mild prior, not an MLE. 16% of structural 1X2 is the independent (Maher) Skellam; the Karlis slot is the common-shock version. Untruncated, so it is not the 8×8 Dixon–Coles sum. Open 1X2 · O/U for the PMF."
	},
	{
		year: 1937,
		authors: "Irwin, J. O.",
		title: "The frequency distribution of the difference between two independent variates following the same Poisson distribution",
		venue: "Journal of the Royal Statistical Society",
		volume: "100",
		issue: "3",
		pages: "415–416",
		doi: "10.2307/2980526",
		usedFor: "Equal-mean case: P(K = k) = e^{−2λ} I_|k|(2λ). The desk’s draw at λh = λa is that formula. Skellam (1946) dropped the equal-mean restriction."
	},
	{
		year: 1946,
		authors: "Skellam, J. G.",
		title: "The frequency distribution of the difference between two Poisson variates belonging to different populations",
		venue: "Journal of the Royal Statistical Society",
		volume: "109",
		issue: "3",
		pages: "296",
		doi: "10.2307/2981372",
		usedFor: "Convolution of two Poissons is the definition; the Bessel form is the closed sum. 1X2 on the desk is that convolution (home = Σ Poi(y; μ) P(X > y)) via a prefix CDF on a Fox–Glynn PMF table, not a truncated 8×8 and not an FFT. Same λ pair as Maher."
	},
	{
		year: 1981,
		authors: "Panjer, H. H.",
		title: "Recursive evaluation of a family of compound distributions",
		venue: "ASTIN Bulletin",
		volume: "12",
		issue: "1",
		pages: "22–26",
		doi: "10.1017/S0515036100006796",
		usedFor: "The (a,b,0) class: p(k)/p(k−1) = a + b/k. Poisson is a = 0, b = λ; NegBin is a = μ/(r+μ), b = (r−1)a. Compound sum S = X₁+…+X_N is then g(x) = Σ_k (a + b k/x) f(k) g(x−k), O(n²) not n-fold convolution. Severity = 1 recovers the count law (the desk’s Poisson table). Geometric severity is Pólya–Aeppli on the O/U lab — not in the ten; Yip (2024) found goal VMR ≈ 1.04, corners ≈ 1.19."
	},
	{
		year: 1966,
		authors: "Adelson, R. M.",
		title: "Compound Poisson distributions",
		venue: "Operational Research Quarterly",
		volume: "17",
		issue: "1",
		pages: "73–75",
		doi: "10.1057/jors.1966.8",
		usedFor: "Poisson special case of Panjer: g(x) = (λ/x) Σ_k k f(k) g(x−k). Inventory demand, not football, but it is the recursion the desk uses when a = 0."
	},
	{
		year: 1981,
		authors: "Sundt, B., & Jewell, W. S.",
		title: "Further results on recursive evaluation of compound distributions",
		venue: "ASTIN Bulletin",
		volume: "12",
		issue: "1",
		pages: "27–39",
		doi: "10.1017/S0515036100006802",
		usedFor: "Only Poisson, binomial and negative binomial sit in (a,b,0). The (a,b,1) class frees p(0) and starts the recurrence at k = 2 — zero-modified Poisson, which is ZI-Skellam’s count analogue. Desk ZI is still the mixture on GD, not a second Panjer on totals."
	},
	{
		year: 2024,
		authors: "Yip, S., Zou, Y., Hung, R. T. H., & Yiu, K. F. C.",
		title: "Forecasting number of corner kicks taken in association football using compound Poisson distribution",
		venue: "Journal of the Operational Research Society",
		volume: "75",
		issue: "11",
		pages: "2127–2137",
		doi: "10.1080/01605682.2024.2306170",
		usedFor: "Geometric-Poisson (Pólya–Aeppli) for clustered counts. Corners are overdispersed (VMR 1.19); goals are almost Poisson (1.04). That is why the ten keep Poisson/NegBin/Weibull for O/U and leave Panjer compound on the lab."
	},
	{
		year: 1953,
		authors: "Evans, D. A.",
		title: "Experimental evidence concerning contagious distributions in ecology",
		venue: "Biometrika",
		volume: "40",
		issue: "1–2",
		pages: "186–211",
		doi: "10.1093/biomet/40.1-2.186",
		usedFor: "O(n) recurrence for Pólya–Aeppli: (x+1)P_{x+1}=[θρ+2(1−ρ)x]P_x−(1−ρ)²(x−1)P_{x−1}, with P(0)=e^{−θ}, P(1)=θρ e^{−θ}. Compared Neyman A, NegBin and PA on plant/insect counts. Desk PMF is this recurrence; Panjer compound is the numerical check. VMR=(2−ρ)/ρ."
	},
	{
		year: 1959,
		authors: "Galliher, H. P., Morse, P. M., & Simond, M.",
		title: "Dynamics of two classes of continuous-review inventory systems",
		venue: "Operations Research",
		volume: "7",
		issue: "3",
		pages: "362–384",
		doi: "10.1287/opre.7.3.362",
		usedFor: "Laguerre form P(n)=e^{−θ} θ ρ^n (1/n) L_{n−1}^1(−θ(1−ρ)/ρ) for n≥1. Same mass as Evans. Inventory, not football — cited so the PMF is not ‘only a recursion’."
	},
	{
		year: 2014,
		authors: "Minkova, L. D., & Balakrishnan, N.",
		title: "On a bivariate Pólya-Aeppli distribution",
		venue: "Communications in Statistics — Theory and Methods",
		volume: "43",
		issue: "23",
		pages: "5026–5038",
		doi: "10.1080/03610926.2012.740127",
		usedFor: "Type I bivariate PA: trivariate reduction of geometric-compounded Poisson, the clustered analogue of Karlis. Common shock still cancels in GD, so Type I 1X2 is independent PA(λh−θ, λa−θ). ρ = 1 recovers Karlis–Skellam. Moment map ρ = 2/(VMR+1); Yip goals VMR 1.04 ⇒ ρ̂ ≈ 0.98. Not in the ten."
	},
	{
		year: 1988,
		authors: "Fox, B. L., & Glynn, P. W.",
		title: "Computing Poisson probabilities",
		venue: "Communications of the ACM",
		volume: "31",
		issue: "4",
		pages: "440–445",
		doi: "10.1145/42404.42409",
		usedFor: "Fill Poisson masses from p(0)=e^{−λ} by p(k)=p(k−1)·λ/k, bound the truncated tail, and never overflow. Their left-window is for λ in the hundreds; football λ < 4.2 so the desk starts at 0. The 1X2 convolution reuses that table instead of recomputing each cell from scratch."
	},
	{
		year: 2010,
		authors: "Alzaid, A. A., & Omair, M. A.",
		title: "On the Poisson difference distribution inference and applications",
		venue: "Bulletin of the Malaysian Mathematical Sciences Society",
		volume: "33",
		issue: "1",
		pages: "17–45",
		doi: "https://www.emis.de/journals/BMMSS/pdf/v33n1/v33n1p2.pdf",
		usedFor: "Regularized hypergeometric ₀F̃₁ form of the Skellam PMF, equivalent to I_|k|. Bessel is computed in log-sum-exp so high λ does not overflow. Moments E = λh−λa, Var = λh+λa, skew (λh−λa)/(λh+λa)^{3/2}."
	},
	{
		year: 2016,
		authors: "Shahtahmassebi, G., & Moyeed, R.",
		title: "An application of the generalized Poisson difference distribution to the Bayesian modelling of football scores",
		venue: "Statistica Neerlandica",
		volume: "70",
		issue: "3",
		pages: "260–273",
		doi: "10.1111/stan.12087",
		usedFor: "GPDD adds a dispersion parameter on each half of the GD; θ = 0 recovers Skellam. Extra variance fattens |GD| and usually cuts the draw — the opposite of a common shock, which shrinks GD variance and buys draws. Lab shows the cheaper NegBin-difference analogue. Not in the daily ten — no walk-forward yet."
	},
	{
		year: 2007,
		authors: "McHale, I., & Scarf, P.",
		title: "Modelling soccer matches using bivariate discrete distributions with general dependence structure",
		venue: "Statistica Neerlandica",
		volume: "61",
		issue: "4",
		pages: "432–445",
		doi: "10.1111/j.1467-9574.2007.00368.x",
		usedFor: "Copula on Poisson margins: P(x,y) is the Frank rectangle C(F(x),G(y)) − C(F(x−1),G(y)) − C(F(x),G(y−1)) + C(F(x−1),G(y−1)). Dependence hits every cell, not only Dixon–Coles’ four low scores. 16% of the correct-score blend."
	},
	{
		year: 2010,
		authors: "Baio, G., & Blangiardo, M.",
		title: "Bayesian hierarchical model for the prediction of football results",
		venue: "Journal of Applied Statistics",
		volume: "37",
		issue: "2",
		pages: "253–264",
		doi: "10.1080/02664760802684177",
		usedFor: "Attack and defence are random effects shrunk toward the league mean (κ = 4 on λ). BTTS adds a Beta–Binomial layer: posterior mean (κμ + H2H hits) / (κ + n). That mean is exact — the ten use it. Baio sampled a 20-team model in WinBUGS because that posterior has no closed form. Open the Baio tab for Metropolis–Hastings vs the exact mean."
	},
	{
		year: 2002,
		authors: "Higgins, J. P. T., & Thompson, S. G.",
		title: "Quantifying heterogeneity in a meta-analysis",
		venue: "Statistics in Medicine",
		volume: "21",
		issue: "11",
		pages: "1539–1558",
		doi: "10.1002/sim.1186",
		usedFor: "Agreement on the card is 1 − I², not a raw standard deviation. I² = max(0, (Q − df)/Q) from Cochran’s Q on the five model probabilities."
	},
	{
		year: 2010,
		authors: "Hvattum, L. M., & Arntzen, H.",
		title: "Using ELO ratings for match result prediction in association football",
		venue: "International Journal of Forecasting",
		volume: "26",
		issue: "3",
		pages: "460–470",
		doi: "10.1016/j.ijforecast.2009.10.002",
		usedFor: "Form string walked as Elo vs a 1500 field, +65 home advantage. 40% of the ratings grid; pi-ratings take the other 60%."
	},
	{
		year: 2011,
		authors: "McHale, I., & Scarf, P.",
		title: "Modelling the dependence of goals scored by opposing teams in international soccer matches",
		venue: "Statistical Modelling",
		volume: "11",
		issue: "3",
		pages: "219–236",
		doi: "10.1177/1471082X1001100303",
		usedFor: "Frank copula on shutouts: BTTS = 1 − e^{−λ} − e^{−μ} + C(e^{−λ}, e^{−μ}; θ), θ = 0.8. Not the Karlis shock. Both lift 0-0 and BTTS; Frank then moves 2-0 and 2-1 by a different amount, because a cell is a copula rectangle on the whole grid. 14% of the union grid. Live on BTTS. Does not rank the ten."
	},
	{
		year: 2010,
		authors: "Heuer, A., Müller, C., & Rubner, O.",
		title: "Soccer: is scoring goals a predictable Poissonian process?",
		venue: "Europhysics Letters",
		volume: "89",
		issue: null,
		pages: "38007",
		doi: "10.1209/0295-5075/89/38007",
		usedFor: "Goal arrival is close to Poisson; overdispersion fattens Over tails via NegBin mix."
	},
	{
		year: 2012,
		authors: "Constantinou, A. C., Fenton, N. E., & Neil, M.",
		title: "pi-football: A Bayesian network model for forecasting Association Football match outcomes",
		venue: "Knowledge-Based Systems",
		volume: "36",
		issue: null,
		pages: "322–339",
		doi: "10.1016/j.knosys.2012.07.008",
		usedFor: "Score probabilistic forecasts, not 1X2 hit-rate. Form momentum is a recency-weighted W/D/L score, damped (Penn–Donnelly) when an already-top-half side is hot — that is not extra signal. Live on λ, not a separate 1X2 blender."
	},
	{
		year: 2013,
		authors: "Constantinou, A. C., & Fenton, N. E.",
		title: "Determining the level of ability of football teams by dynamic ratings based on the relative discrepancies in scores between adversaries",
		venue: "Journal of Quantitative Analysis in Sports",
		volume: "9",
		issue: "1",
		pages: "37–50",
		doi: "10.1515/jqas-2012-0036",
		usedFor: "Pi-ratings: separate home/away strengths, ψ(e) = 3 log₁₀(1+|e|) sgn(e), λ = 0.035, γ = 0.7 catch-up. Walked on H2H, mixed 18% into historical λ and 60% of the ratings grid. Beats Hvattum Elo on RPS."
	},
	{
		year: 2014,
		authors: "Štrumbelj, E.",
		title: "On determining probability forecasts from betting odds",
		venue: "International Journal of Forecasting",
		volume: "30",
		issue: "4",
		pages: "934–943",
		doi: "10.1016/j.ijforecast.2014.03.008",
		usedFor: "Among additive, multiplicative, Shin and power de-vig, Shin has the lowest RPS on football 1X2. The desk uses Shin for 1X2, BTTS and CS; the other three are on the 1X2 · O/U lab. Sharp books preferred (smaller z)."
	},
	{
		year: 2010,
		authors: "Ranjan, R., & Gneiting, T.",
		title: "Combining probability forecasts",
		venue: "Journal of the Royal Statistical Society: Series B (Statistical Methodology)",
		volume: "72",
		issue: "1",
		pages: "71–91",
		doi: "10.1111/j.1467-9868.2009.00726.x",
		usedFor: "A linear opinion pool is underdispersed. When I² is low the desk extremizes the logit pool instead of fitting a beta transform (no settled outcomes yet to estimate α, β)."
	},
	{
		year: 2015,
		authors: "Koopman, S. J., & Lit, R.",
		title: "A dynamic bivariate Poisson model for analysing and forecasting match results in the English Premier League",
		venue: "Journal of the Royal Statistical Society: Series A (Statistics in Society)",
		volume: "178",
		issue: "1",
		pages: "167–186",
		doi: "10.1111/rssa.12042",
		usedFor: "Attack and defence wander through the season. Last-five already 62% of λ; match ρ tightens when expected totals are low (τ bounds still apply)."
	},
	{
		year: 2017,
		authors: "Boshnakov, G., Kharrat, T., & McHale, I. G.",
		title: "A bivariate Weibull count model for forecasting association football scores",
		venue: "International Journal of Forecasting",
		volume: "33",
		issue: "2",
		pages: "458–466",
		doi: "10.1016/j.ijforecast.2016.11.006",
		usedFor: "Weibull-count margins (overdispersed 0s and tails vs Poisson) glued with a copula beat Dixon–Coles on some CS books. The desk uses that copula on Poisson margins (McHale–Scarf rectangle) plus NegBin as the overdispersed margin. Discrete Weibull (β = 0.9) is 12% of structural O/U. 18% of the CS cell."
	},
	{
		year: 2018,
		authors: "Egidi, L., Pauli, F., & Torelli, N.",
		title: "Combining historical data and bookmakers’ odds in modelling football scores",
		venue: "Statistical Modelling",
		volume: "18",
		issue: "5–6",
		pages: "436–459",
		doi: "10.1177/1471082X18798414",
		usedFor: "Convex mix of historical λ and book-implied λ. Shin 1X2 is inverted on the Dixon–Coles grid (Skellam match); 32% history, 68% market — books are the better calibrated λ. Totals market (Over 2.5) rescales the pair at 55%."
	},
	{
		year: 2014,
		authors: "Satopää, V. A., Baron, J., Foster, D. P., Mellers, B. A., Tetlock, P. E., & Ungar, L. H.",
		title: "Combining multiple probability predictions using a simple logit model",
		venue: "International Journal of Forecasting",
		volume: "30",
		issue: "2",
		pages: "344–356",
		doi: "10.1016/j.ijforecast.2013.09.009",
		usedFor: "Accuracy is a weighted logit pool, then extremized: logit(p*) = a · logit(p), a = 1 + 0.32(1 − I²). Stronger when models agree, off when they do not. Football models share data so a never reaches the 1.5 used on independent geopolitical crowds."
	},
	{
		year: 2018,
		authors: "Yao, Y., Vehtari, A., Simpson, D., & Gelman, A.",
		title: "Using stacking to average Bayesian predictive distributions (with discussion)",
		venue: "Bayesian Analysis",
		volume: "13",
		issue: "3",
		pages: "917–1007",
		doi: "10.1214/17-BA1091",
		usedFor: "Stacking beats BMA when every model is misspecified (they all are). True stacking needs leave-one-out log scores. The BMA tab shows the one-observation version: mix two models so the pool hits Shin. Not enough to rank the ten."
	},
	{
		year: 2019,
		authors: "Angelini, G., & De Angelis, L.",
		title: "Efficiency of online football betting markets",
		venue: "International Journal of Forecasting",
		volume: "35",
		issue: "2",
		pages: "712–721",
		doi: "10.1016/j.ijforecast.2018.07.008",
		usedFor: "Highest-accuracy picks are where model, API, and market already agree."
	},
	{
		year: 2022,
		authors: "da Costa, I. B., Marinho, L. B., & Pires, C. E. S.",
		title: "Forecasting football results and exploiting betting markets: the case of “both teams to score”",
		venue: "International Journal of Forecasting",
		volume: "38",
		issue: "3",
		pages: "895–909",
		doi: "10.1016/j.ijforecast.2021.06.008",
		usedFor: "BTTS is a classification problem, not a leftover of 1X2. Structural BTTS (Dixon–Coles + Frank copula + Karlis + Goddard) is the dc slot; H2H BTTS frequency is the results-model slot. Books remain a baseline, not the ranker."
	},
	{
		year: 2021,
		authors: "Wheatcroft, E.",
		title: "Evaluating probabilistic forecasts of football matches: the case against the ranked probability score",
		venue: "Journal of Quantitative Analysis in Sports",
		volume: "17",
		issue: "4",
		pages: "273–287",
		doi: "10.1515/jqas-2019-0089",
		usedFor: "Binary markets (this pick vs not) are scored with log-loss, not RPS. The logit pool matches that. Accuracy tab is still distance to Shin until full-time settles. Closing-odds overreaction: a top-quartile side on a cold streak gets λ back; a bottom-quartile heater gets λ cut. Applied on the match state, not as a second 1X2 blend."
	},
	{
		year: 2015,
		authors: "Groll, A., Schauberger, G., & Tutz, G.",
		title: "Prediction of major international soccer tournaments based on team-specific regularized Poisson regression: an application to the FIFA World Cup 2014",
		venue: "Journal of Quantitative Analysis in Sports",
		volume: "11",
		issue: "2",
		pages: "97–115",
		doi: "10.1515/jqas-2014-0051",
		usedFor: "Regularized Poisson with team covariates. Injuries already shrink λ; the 1X2 blend does not grow a Lasso on five H2H rows. Confirms goals models still beat raw FIFA ranks for match results."
	}
];

export const ENSEMBLE_WEIGHTS = {
	accuracy: {
		win: [
			["Union grid", "18%"],
			["Shin market", "62%"],
			["Pi-ratings + Hvattum Elo", "6%"],
			["API-Football (ignored when Shin exists)", "4%"],
			["Baio-shrunk H2H", "10%"]
		],
		btts: [
			["Union grid", "22%"],
			["Shin market", "58%"],
			["Pi-ratings + Hvattum Elo", "6%"],
			["API-Football (ignored when Shin exists)", "4%"],
			["Baio-shrunk H2H", "10%"]
		],
		ou: [
			["Union grid", "22%"],
			["Shin market", "58%"],
			["Pi-ratings + Hvattum Elo", "6%"],
			["API-Football (ignored when Shin exists)", "4%"],
			["Baio-shrunk H2H", "10%"]
		],
		cs: [
			["Union grid", "40%"],
			["Shin market", "44%"],
			["Pi-ratings + Hvattum Elo", "6%"],
			["API-Football (ignored when Shin exists)", "4%"],
			["Baio-shrunk H2H", "6%"]
		]
	},
	value: {
		win: [
			["Union grid", "38%"],
			["Hvattum Elo", "20%"],
			["API-Football", "18%"],
			["Baio H2H", "24%"]
		],
		btts: [
			["Union grid", "50%"],
			["Hvattum Elo", "22%"],
			["API-Football", "16%"],
			["Baio H2H", "12%"]
		],
		ou: [
			["Union grid", "52%"],
			["Hvattum Elo", "22%"],
			["API-Football", "14%"],
			["Baio H2H", "12%"]
		],
		cs: [
			["Union grid", "50%"],
			["Hvattum Elo", "22%"],
			["API-Football", "12%"],
			["Baio H2H", "16%"]
		]
	}
};
