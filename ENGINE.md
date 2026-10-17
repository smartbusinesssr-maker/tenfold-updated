# Tenfold engine — living specification

Status: `ENGINE_VERSION` **2026.09.28j**, feature schema **v13**. Desk timezone `Africa/Kampala`. This file is the porting spec. The React UI is not part of the engine.

If you are implementing this elsewhere, follow the pipeline in §4, the formulas in §6–§10, and the checks in §13. Diagnostics in §11 never choose the ten.

---

## 0. How this file stays current

Update this file in the **same change** as the code. A model or gate that is not written here is not part of the contract.

1. Bump `ENGINE_VERSION` in `src/lib/football/types.ts`. Form is `YYYY.MM.DD` plus a letter (`a`, `b`, …) when the calendar day already has a build.
2. Add a row at the **top** of §1. One row per version. Say what changed, which function, and whether the ten can move.
3. Edit the section the change actually moved (§6 lambda, §7 grid, §8 markets, §9 gates, §10 calibration, §11 diagnostics). Delete the old formula. Do not leave two versions of a constant.
4. If an acceptance check in §13 changes, change the check. Do not leave a number that the tests no longer hit.
5. The significance arithmetic lives in two places on purpose: the rules are §11, the worked numbers are [artifacts/tenfold-significance-replication.md](artifacts/tenfold-significance-replication.md). A change to `significance.ts` updates both.

Files that count as an engine or model change: `models.ts`, `latent.ts`, `markets-engine.ts`, `features.ts`, `quality.ts`, `select.ts`, `calibrate.ts`, `significance.ts`, `kelly.ts`, `sharpe.ts`, `corners.ts`, `player-props.ts`, `pipeline.server.ts` (`estimateLambdas` callers and `scoreFixture`), `types.ts` constants.

The UI, papers list, and copy on the Method tab do not get a version bump unless a formula or a gate moved.

---

## 1. Changelog

Newest first. “Ten moves” means a different daily ten is possible on the same inputs.

| Version | What changed | Ten moves? |
|---|---|---|
| 2026.09.28j | Scan no longer throws the board away when the clock runs out. Live budget 180s, backtest 240s, odds pages 40. A failed odds page keeps the pages already paid for and the ten is still ranked. `/odds` is never filtered by bookmaker. A fixture the date feed left blank is read with `/odds?fixture=` (up to 40, every book on the plan, up to 3 pages) and merged. One failed call does not reject the pool or blank the desk. | No |
| 2026.09.28i | Dixon–Coles correlation parameter, diagnostic. Pearson = −ρ √(λμ) e^{−(λ+μ)}. At 1.38 / 1.12 the factor is 0.102, so ρ = −0.13 is Pearson +0.013 and covariance +0.0165, not a correlation of −0.13. One hundredth more negative ρ raises Pearson by 0.0010. Legal ρ is −0.725 to 0.647; at the lower edge Pearson is +0.073. The ten use match ρ −0.135 on a 2.50-goal match, Pearson +0.014. φ at the frozen ρ is +0.081. `dcRhoMap`. Not a rank. | No |
| 2026.09.28h | Dixon–Coles free parameters, diagnostic. λ = α_home × β_away × γ, μ = α_away × β_home. Three pins (defence at 1; attacks × 1.2 and defences ÷ 1.2; home edge inside γ = 1.2) all give 1.38 / 1.12. The likelihood is flat on that line, so a fit must pin one parameter. The desk writes λ from the rate blend and does not take the 2–1 residual (+0.449 home, −0.107 away). If every match followed ρ = −0.13, the score at independence is −0.083 and the information is 0.644, so one Newton step lands at −0.129. The same step on independent matches stays at 0. `dcParamFit`. Not a rank. | No |
| 2026.09.28g | Dixon–Coles time decay, diagnostic. ξ = 0.0065 per half-week is 0.001857/day, half-life 373 days. Weights at 7/28/90/180/365/730 days: 98.7/94.9/84.6/71.6/50.8/25.8%. The 0.0065-per-day bug is 95.6/83.4/55.7/31.0/9.3/0.9% and a 107-day half-life. Two results, 3 goals at 7 days and 0 at 365, average 1.50 flat, 1.98 on the paper weight (recent share 66%), 2.73 on the bug. Venue and opponent-adjusted attack use the paper weight. Last-five rates and the newest five H2H that move λ do not. Pi learning at 365 days is still 0.778. A match at 14 days holds 97.4%; settled lines use a 14-day half-life. `dcDecayTrace`. Not a rank. | No |
| 2026.09.28f | Limitations pass. Withdrew the 7,626 / 1.0026 / 1.0539 sentence: not in the settled file and not found as a football result. Forrest, Goddard and Simmons 2005 is ~10,000 games, odds beat the model, no 0.62. Yip arXiv:2112.13001: goals VMR 1.0396, corners 1.1856. Boshnakov, Kharrat and McHale 2017 fitted a Weibull count; shape 0.9 is not that fit. Hubáček, Šourek and Železný 2019 is NBA. Settled file: 1,928 lines, 15 dates, 1 Over 2.5. Weights, ρ, r and the Weibull weight were not moved. `ENSEMBLE_WEIGHTS` corrected to the live priors (1X2 accuracy was listed as 52/30). | No |
| 2026.09.28e | Negative binomial split, diagnostic. Union is two independent margins, weight 0.08, r from the newest five H2H totals (divide by n), start 18, floor 3.5. Lab Over 1.5 is one NB on the total at hardcoded r = 8. At 1.38/1.12 and r = 18, variance is 2.675 margins / 2.847 frailty against Poisson 2.500. Over 2.5 is 45.18% / 44.78% against 45.62%. Over 1.5 is 70.22% / 69.25% against 71.27%. BTTS on the margins is 48.73%. Gamma SD of the total is 0.589. Yip r is 62.5, above the cap. Samples [2,2,3,2,3] stays 18 (gate shut); [0,2,2,3,5] opens the gate at raw r 24 and still uses 18; [0,0,1,5,6] raw 1.36 uses 3.5. `negBinSplit`. Not a rank. | No |
| 2026.09.28d | Conway–Maxwell–Poisson, diagnostic. P(k) ∝ λ^k / (k!)^ν. ν = 1 recovers Poisson. Mean-matched at 1.38/1.12: ν 0.962 / 0.85 / 1.15 needs λ 1.341 / 1.232 / 1.540 and VMR 1.023 / 1.094 / 0.920, not 1/ν. Over 2.5 is 45.51% / 45.19% / 45.99% against Poisson 45.62%. BTTS is 49.80% / 47.97% / 52.76% against 50.42%. Leaving λ at 1.38 with ν = 0.85 lifts the mean to 1.56. Totals weight 0. `cmpTrace`. Not a rank. | No |
| 2026.09.28c | Poisson regression alternatives, diagnostic. Quasi-Poisson (φ = 1.04) keeps the Poisson score, so no price moves. A 5-goal match at μ = 1.38 pulls by 3.62 / 3.36 / 2.60 under Poisson / NB r = 18 / r = 3.5. NB weight relative to Poisson is 0.957 / 0.929 / 0.849 at rates 0.80 / 1.38 / 3.20, and 0.522 at 3.20 with r = 3.5. At 1.38/1.12, Over 2.5 is 45.62% / 45.18% / 43.55% / 42.43% / 37.31% for Poisson / NB18 / NB floor / ZIP 0.05 / Weibull 0.9. BTTS 50.42% / 48.73% / 42.72% / 45.51% / 26.38%. Totals weights 0.10 / 0.12 / floor / out / 0. VMR at r = 18 is 1.077. `poissonAltTrace`. Not a rank. | No |
| 2026.09.28b | Dixon–Coles estimate, diagnostic. ρ is not refit. Stored MLE −0.1285 sits 0.0015 from the frozen −0.13. Information per match is 0.655, so SE(ρ) is 0.124 / 0.062 / 0.039 at 100 / 400 / 1,000 matches. The four likelihood pulls are ±0.127 and sum to 0. At ρ = 0 the score is −0.083. The ten use matchRho: −0.176 at total 1.60, −0.135 at 2.50, −0.099 at 3.40. ξ = 0.0065 per half-week is the 1997 predictive choice, not a weighted-likelihood maximum. `dcEstimate`. Not a rank. | No |
| 2026.09.28a | Dixon–Coles adjustment, diagnostic. A = −λμρ e^{−(λ+μ)} is 1.65 points at 1.38/1.12 and ρ = −0.13. It is added to 0–0 and 1–1 and removed from 1–0 and 0–1. Draw +3.30. Home, away, BTTS and Over 1.5 each move 1.65. Over 2.5 does not move. Relative lifts are +20.1% at 0–0 and +13.0% at 1–1; the 1–1 lift is −ρ at any scoring rate. Totals ρ = −0.10 scales A to 1.27. The 1982 rates 1.31/1.00 give A = 1.69 and a 0–0 lift of 17.0%. Recency half-life is 373 days; a match at 180 days keeps 72% of its weight. `dcAdjustment`. Not a rank. | No |
| 2026.09.27e | Maher baseline, diagnostic. Desk defence is pinned at 1, home attack is 1.12, γ is 1.232, so λ returns as 1.38 and 1.12. The 1982 average is attack = defence = 1 and γ = 1.31, so λ is 1.31 and 1.00. Totals 2.50 versus 2.31. Over 2.5 is 45.62% versus 40.66%. BTTS is 50.42% versus 46.16%. The desk 1–1 cell is 12.69%, equal to P(H=1)P(A=1). The 0…8 grid and the infinite Skellam both put the draw at 26.73%. Totals mix this grid at 0.10. `maherBaseline`. Not a rank. | No |
| 2026.09.27d | Dixon–Coles grid, diagnostic. At 1.38/1.12 and ρ = −0.13, τ is 1.201, 0.854, 0.821, 1.130 on 0–0, 1–0, 0–1, 1–1. Each cell moves 1.65 points and the four edits cancel. 2–1 stays 8.75%. P(home = 0) stays 25.16%. Draw 26.73% → 30.03%. BTTS 50.42% → 52.07%. Over 1.5 71.27% → 72.92%. Over 2.5 stays 45.62% at ρ = 0, −0.13 and the totals ρ −0.10. The 0…8 square already holds 99.9983% of the Poisson mass. `dcGridDetail`. Not a rank. | No |
| 2026.09.27c | Over combo admits match over 2.5. Legs are team over 0.5, match over 1.5, match over 2.5. A team over 0.5 at 1.35 with an over 2.5 at 1.70 is a 2.30 ticket when both legs clear the Best gate. Same-match joint is the score matrix. Over 2.5 is not stacked on over 1.5. Best only. | Best only |
| 2026.09.27b | Bayesian hierarchy, diagnostic. Goals pull toward the league. An observed 2.40 against 1.38 is 1.84 after 5 matches at κ = 6, and 2.18 after 8 matches at the last-five κ of 2.2. BTTS is a Beta–Binomial on the Poisson probability 50.4%. Five perfect H2H meetings posterior 73.0%, interval 47.8%–98.1%, which still covers the prior. Ten meetings are the first row that does not (62.9%–99.9%). The logit pool stays at 52.1% even at 20/20, because a rate of 1 hits the variance floor. 1X2 κ = 5 would make the same five meetings 75.2%. Five blanks go to 27.5%. `hierarchicalTrace`. Not a rank. | No |
| 2026.09.27a | Latent variables, diagnostic. The Karlis shock is unobserved. At 1.38/1.12, E[K\|score] is 0 at 0–0 and at 2–0, 0.087 at 1–1 (P(K=1)=0.087), and 0.298 at 2–2. Log-attack is a random walk with process noise 0.012 and observation noise 0.55. Steady gain is 0.137. A first match of 4 goals moves λ from 1.38 to 1.92. The same 4 after seven 1s reaches 1.74. An observed finishing rate of 4 shrinks to 1.67 after one game and 2.39 after five (prior strength 8). `latentShockPosterior`, `latentStateTrace`. Not a rank. | No |
| 2026.09.26e | Trivariate Poisson, diagnostic. Seven rates on (home goals, away goals, corners): three private, three pairwise shocks, one triple shock. At 1.38/1.12 with corner mean 10 and every shared rate either 0 or 0.12, P(1–1) is 12.772% in the independent, pairwise and triple structures. Pairwise and triple have the same covariances, all 0.12, and the same Corr(home, corners) +0.032. κ₁₁₁ is 0 or 0.12. E[corners \| 2–0] is 9.95 pairwise and 9.88 triple; E[corners \| 2–2] is 10.13 and 10.18. P(corners ≥ 10) at 0–0 is 54.2%, 51.2%, 52.7%. The goal total is not a third Poisson margin: variance 2.74 on mean 2.50. Corner shocks are not fitted. `trivariatePoisson`. Not a rank. | No |
| 2026.09.26d | Bivariate Poisson, diagnostic. X = X₁+X₃, Y = X₂+X₃. At 1.38/1.12 the rates are 1.26, 1.00, 0.12. Margins stay Poisson (variance = mean). The total does not: variance 2.74 on mean 2.50, VMR 1.096. Goal-difference variance is 2.26 against 2.50. P(0–0) = exp(−2.38) = 9.255% against a product of 8.208%. The 1–1 cell is two terms: private goals 11.661% and the shared goal 1.111%. 2–0 cannot contain the shock, so it sits below the product (7.347% vs 7.816%). The 0…8 margin matches Poisson(λh) to about 4e−6. Asking for covariance 0 or −0.05 both return λ₃ = 0.02. `bivariatePoisson`. Not a rank. | No |
| 2026.09.26c | Conditional correlation, diagnostic. Three structures at 1.38/1.12. Given the Karlis shock the counts are independent; each extra home goal lifts E[away] by 0.087 (1.000, 1.087, 1.174, 1.261). Given a total of exactly 2, Pearson is −1 in Maher, Dixon–Coles and Karlis. Inside total ≤ 2 the Maher correlation is −0.433 and Dixon–Coles is −0.367; inside total ≥ 3 Karlis is −0.423 against Maher −0.520. Dependence ratios: Dixon–Coles 0–0 is 1.201, 1–0 is 0.854, 2–2 is 1.000. Karlis 0–0 is 1.127 and 1–1 is 1.007. P(away ≥ 2 \| home ≥ 2) lifts 1.12 under Karlis and 1.00 under Dixon–Coles. `conditionalCorrelation`. Not a rank. | No |
| 2026.09.26b | Karlis correlation and Platt shapes, diagnostic. Corr = λ₃ / √(μh μa) at every score. At 1.38/1.12 and λ₃ = 0.12, Pearson is +0.096 and φ(both score) is +0.051. The same shock at 0.80/0.70 is +0.160. At 0.45/0.40 the shock is cut to 0.112 and Pearson is +0.264. The 0…8 grid does not move it. Platt is invlogit(a · logit p + b). Temperature (b = 0) is the fit when both tails are too sure: a stops at 0.55, so 0.80 becomes 0.68 and Brier falls from 0.340 to 0.283. Bias (a = 1) does nothing on that book. When every quote is too low, bias goes to the cap b = 0.85 and Brier falls from 0.248 to 0.163; temperature barely moves. `karlisCorrelation`, `plattMethodTrace`. Not a rank. | No |
| 2026.09.26a | Accuracy prior follows the de-vigged book. 1X2 is book 0.62 / grid 0.18, BTTS and totals are book 0.58 / grid 0.22, correct score is book 0.44 / grid 0.40. Shin cap 0.72, grid floor 0.12. Value weights exclude the book. The 7,626 / 1.0539 / 1.0026 clause in the original row is withdrawn: see 2026.09.28f. | Yes |
| 2026.09.25o | Autoresearch shrink. The frozen metric is Brier. Candidates pull the pooled probability 8% or 15% of the way back to 1/2. The last settled date is the holdout and does not pick the candidate. A shrink is kept only when the earlier dates improve by at least 0.0005 and the holdout does not rise. Within that band the milder shrink wins. One date, or a thin book, stays on the identity. `autoresearchShrink`, applied after Platt. | Yes — when the settled book confirms a shrink |
| 2026.09.25n | Dixon–Coles correlation, diagnostic. ρ is not Corr(X, Y). At 1.38/1.12 and ρ = −0.13, Pearson on the goals is +0.013 and φ(both score) = φ(both blank) = +0.081. Maher is 0. Karlis λ₃ = 0.12 is Corr +0.096 and cov 0.12, against a Dixon–Coles cov of 0.016. Negative ρ inflates 0–0 and 1–1, so the counts move together. Totals use ρ = −0.10. `dcCorrelation`. Live on Dixon–Coles. Not a rank. | No |
| 2026.09.25m | Poisson closure, diagnostic. Two independent Poisson counts sum to Poisson(λh+λa) with no shared-VMR condition. Given the total, home goals are Binomial(n, λh/(λh+λa)). At 1.38/1.12 the total is 2.50, the mode is 2, and 1–1 given 2 goals is 2p(1−p). The 0…8 grid renormalises; at the league λ the Over 2.5 move is noise, at the clamp it is not. Dixon–Coles τ then leaves the total. `poissonClosure`. Live on Dixon–Coles. Not a rank. | No |
| 2026.09.25l | Negative binomial corners, diagnostic. Two independent NB2 margins with the same VMR sum to one NB2 on the match total, r = r_h + r_a, variance = VMR × mean. At 5.2 / 4.6 and VMR 1.8 the total is 9.8: Over 9.5 is 51.7% Poisson and 48.7% full NB; Over 13.5 is 12.1% and 18.1%. The live grid mixes each margin 65/35. That matches the variance of a 65/35 mix of the finished totals and not the shape. Over 13.5 on the desk mix is 14.4%, against 14.2% for the total mix. Both margins are NB together with weight 0.1225. VMR outside (1.25, 3.5) stays Poisson. `negBinCornerInvestigate`. Live on 1X2 · O/U. Not on the ten. | No |
| 2026.09.25k | Per-market use of data that was already on the card. Last-20 for/against enters λ only when both sides have at least 12 games, as a Maher rate (own scored + opponent conceded), weight 0.14 or 0.22. That is the match-result and Asian-handicap strength, and the totals volume. Failed-to-score, or the opponent clean-sheet rate if FTS is missing, pulls that side's λ 14% toward −log(rate). A last-5 BTTS hit rate does not move λ. Corner samples with variance-to-mean in (1.25, 3.5) set the corner grid's NegBin mix. Bookings stay a two-rate Poisson: there is no referee and no match-level variance. | Yes — when last-20 or FTS is present |
| 2026.09.25j | Same-game parlay correlation. φ = (P(AB) − P(A)P(B)) / √[P(A)(1−P(A))P(B)(1−P(B))]. The joint is the score-matrix sum. The product is the acca assumption. Unadjusted EV if the book multiplies two fair singles is lift − 1. At 1.38/1.12, Maher team-over-0.5 legs have φ = 0. Dixon–Coles ρ = −0.13 moves that pair to about +0.08, because 1-1 is inflated. Home over 0.5 + over 1.5 has φ ≈ 0.52 and fair odds shorter than the naive product. Home win + under 2.5 has φ ≈ −0.17, so the naive product is a losing price. P(over 1.5 \| both teams score) = 1. No copula: the grid is the price. Diagnostic only. `sgpBoard`. Live on 1X2 · O/U. | No |
| 2026.09.25i | Over-only Best combo. Legs are team over 0.5 or match over 1.5, 2–5 of them, decimal product in [2.00, 5.00]. Each leg must already clear the Best gate (FULL_DATA, agreement ≥ 0.55, accuracy ≥ 0.70, positive EV). Same-match joint is the score-matrix sum. Both teams over 0.5 implies over 1.5, so that leg is not stacked. Different matches multiply. The shortest +EV ticket is preferred. It can be Best. It is not on the ten. Mixed combos still cannot headline. `selectOverFocusCombo`. | No |
| 2026.09.25h | Zero-inflated Skellam. Mixture on the difference: P(0)=π+(1−π)P_Sk(0), P(k≠0)=(1−π)P_Sk(k). Mean shrinks to (1−π)(λh−λa). π̂=(draw−Skellam draw)/(1−Skellam draw), and a shortfall returns 0 because π is clamped to [0, 0.25]. The same coin on the shock stacks two draw machines. Diagonal inflation can split 0-0 from 1-1; ZI-Skellam cannot. Not in structural 1X2. `ziSkellamInvestigate`. Live on 1X2 · O/U. | No |
| 2026.09.25g | Skellam variants. Independent: E[GD]=λh−λa, Var=λh+λa, draw is Bessel I₀ and the Poisson diagonal. Common shock keeps the mean and cuts variance by 2θ, which buys draws. ZI piles π on the draw. Normal+½ is the large-λ approximation. NegBin r=18 fattens |GD| and spends draws. In-play scales λ by time left. Ten: independent 8%, shock 25% of structural 1X2. `skellamVariants`. Live on 1X2 · O/U. | No |
| 2026.09.25f | Zero-inflated Poisson investigation. P(0)=π+(1−π)e^{−λ}, mean (1−π)λ, VMR 1+πλ. Three inflations disagree: margin ZIP (shutouts, mean falls), (0,0)-only (other cells × 1−π), ZI-Skellam (π onto the draw, no score). A pure Poisson has π̂=0. The prior 0.05 does not restore the mean. Not in the union. `zipInvestigate`. Live on 1X2 · O/U. | No |
| 2026.09.25e | Negative binomial investigation. NB2: P(0)=(r/(r+μ))^r, then P(k)=P(k−1)·(k−1+r)/k·μ/(r+μ). Var=μ+μ²/r. The union’s 8% is a product of two margins. r starts at 18 and only falls toward 3.5. Yip’s r̂≈μ/0.04 sits above that ceiling, so the grid is always heavier than the league. Frailty variance on the total exceeds the independent margins by 2λhλa/r. `negBinInvestigate`. Live on 1X2 · O/U. | No |
| 2026.09.25d | Poisson investigation. P(0) = e^{−λ}, then P(k) = P(k−1)·λ/k. The long sum has mean = variance = λ. The grid keeps 0…8 and drops the tail, so the truncated mean sits under λ. League λ 1.38 hides that tail; the clamp 3.35 does not. `poissonInvestigate`. Live on Dixon–Coles. | No |
| 2026.09.25c | Torvaney xG grid. Each shot is a Bernoulli; the scoreline grid is the product of the two Poisson-binomials. That grid is the Dixon–Coles weight, not a one-hot score. λ moves 18% toward the mean of those per-match rates only when both sides have a shot list or a precomputed Torvaney rate. No shots leaves λ unchanged. | Yes, only when shot xG is present |
| 2026.09.25b | Five validation grades of one settled book. Resubstitution and time-blind k-fold are refused. Holdout is the last date. Expanding walk-forward is the desk. Rolling last-7 keeps the embargo. Optimism is expanding Brier minus resubstitution Brier. `validationContrast`. Live on Accuracy. | No |
| 2026.09.25a | Karlis is documented as a shared Poisson shock, not a copula. X = X₁+X₃, Y = X₂+X₃, Var(X−Y) = λh+λa−2λ₃. Frank stays the copula rectangle. Both lift 0-0 and BTTS; 1-1 and 2-0 do not match. The score grid floors λ₃ at 0.02; the closed BTTS formula does not. `jointDependence`. Live on BTTS. | No |
| 2026.09.24b | Holm (step-down FWER) and Hochberg (step-up FWER) sit next to BH. Shared bar α/(m−r+1). On any fixed p-value list the keeps nest Bonferroni ⊆ Holm ⊆ Hochberg ⊆ BH. Diagnostic only. `stepProcedures`. | No |
| 2026.09.24a | Storey q is min(1, π₀ × BH-adjusted p). A later rank can pull an earlier q down: at threshold p₍ᵣ₎ the plug-in FDR is π₀·m·p₍ᵣ₎/r, then a running minimum from the right. `storeyQTrace`. | No |
| 2026.09.23d | Benjamini–Yekutieli is ordinary BH at α′ = α/Hₘ. The proof delivers FDR ≤ π₀α and does not spend the π₀ slack. `byMethod`. | No |
| 2026.09.23c | Dependence proof for the card: independence, PRDS, or arbitrary. One opposed pair (home against away, over against under, and the pairs in §11) makes the pooled BH ceiling α·Hₘ. Same-direction legs stay on BH. `dependenceRegimes`. | No |
| 2026.09.23 | Significance lab brought to the desk: Wilson / Clopper–Pearson / exact binomial vs the book, power, BH step-up with the prefix gap, BY harmonic tax, Storey π₀(λ) with thin-tail fallback, bootstrap λ*, quadratic smoother at 0.95. None of it ranks the ten. | No |
| v13 baseline | Scoring engine as specified in §4–§10: one feature snapshot, `estimateLambdas`, Dixon–Coles / Karlis / Frank copula / NegBin / Elo log-pool, Shin rake at α = 0.4, quality gate then the 5/3/2 mixer, FULL_DATA for Best. Feature schema `v13`. | Yes — this is the picker |

Older letters inside 2026.09.23 (BY price curve, Storey λ grid) are folded into the 2026.09.23 row. They did not change `estimateLambdas` or `selectDailyTen`.

---

## 2. What a port must produce

Inputs for one date: fixtures, posted decimal odds (many books), last-N results, table, optional season stats, H2H, injuries, lineups inside 90 minutes of kickoff.

Outputs:

- A score grid per fixture, goals 0…8, rows sum to 1.
- One probability per posted market, sliced from that grid. Not a separate model per market.
- A daily ten of length **at most 10**, shape five wins / three BTTS / two totals on the first pass. Shorter is correct when the date is thin.
- Best bets: FULL_DATA only. The one combo that may headline is the over ticket in §9 (team over 0.5 or match over 1.5, 2–5 legs, price ≥ 2.00). Any other combo stays off Best.
- A market board for the families that are not allowed on the ten.

Missing data stays **null**. It is never stored as zero. A null rate does not enter a shrink as a real observation.

---

## 3. Module map

| Piece | Source | Port this |
|---|---|---|
| Constants, market kinds | `types.ts` | Yes, the bands and quotas |
| Snapshot, data grade | `features.ts` | Yes |
| λ, Poisson, Dixon–Coles, pools, Shin | `models.ts` | Yes |
| Log-linear λ, momentum, Kalman, finishing shrink | `latent.ts` | Yes |
| Asian settlement, combos, cards, parity, team-to-score | `markets-engine.ts` | Yes |
| Corners | `corners.ts` | Yes, only with counts |
| Player G∪A | `player-props.ts` | Yes, only with minutes |
| Quality score and two-stage cut | `quality.ts` | Yes |
| Daily ten, Best, data-backed | `select.ts` | Yes |
| Orchestration | `pipeline.server.ts` `scoreFixture` | Call the pieces in §4. Bit-identical picks require porting this function, not re-deriving it |
| Calibration, walk-forward | `calibrate.ts` | Yes if you want the live weights; priors in §10 work without it |
| Kelly, Sharpe, Sortino | `kelly.ts`, `sharpe.ts` | Optional. Must not rank |
| Significance | `significance.ts` | Optional. Must not rank. Worked numbers in the appendix |

Do not port the desk components. They display these functions.

---

## 4. Pipeline

Run once per fixture, then once per date.

1. **Price.** Trimmed-median consensus of the posted books. Do not pick the book that happens to sit in 1.85–2.00. A 1.05 Over 1.5 with one stale 1.93 stays 1.05.
2. **Snapshot.** `buildSnapshot`. Last-20 results always. Table and season stats when the league has them. H2H only when last-20 is thin — never the primary rate. Injuries role-weighted, and only if that league’s injury feed is real. Confirmed XIs only inside 90 minutes.
3. **Grade.** `dataGrade`. See §6.
4. **λ.** `estimateLambdas`. See §7. Clamp home to [0.32, 3.35], away to [0.24, 3.1].
5. **Grids.** Independent Poisson (`rho = 0`), Dixon–Coles, Karlis bivariate Poisson, Frank copula, NegBin, Elo/pi-ratings. See §8.
6. **Union.** Log-pool those grids with `UNION_WEIGHTS`. That is the model joint.
7. **Book.** Invert Shin (not 1/odd on one cell). Rake the model joint onto the book, then log-pool model and raked book at `UNION_RAKE_ALPHA = 0.4`.
8. **Slice.** Home, draw, away, BTTS, totals, correct score, double chance, handicaps, combos — all sums or settlement expectations on that one grid. See §9.
9. **Score the pick.** Accuracy from the grid (or the ensemble logit pool when several experts exist). Edge = accuracy − implied. Implied = 1/consensus odd after the devig you declared. Shin is the book, not a second goal model mixed in linear 1X2 space.
10. **Quality, then mixer.** §10. Quality can drop a line before the quota runs. A short fold is allowed.
11. **Diagnostics.** Kelly, Sharpe, significance. They read the card. They do not reorder it.

`scoreFixture` is step 4 through 9 with the desk’s expert weights and sanity gates (λ gap, draw mass, BTTS No requiring three agreeing signals). A port that only implements §7 and §8 and then averages 1X2 numbers will not match.

---

## 5. Constants that must match

Odds and quotas (`types.ts`):

| Name | Value |
|---|---|
| Playable binary (home, away, BTTS, O/U 2.5) | 1.25–3.50 |
| Draw | 2.40–5.00, and only if grid draw is about 26%+ |
| Team to score | 1.10–2.20, model ≥ 70% |
| Correct score | 3.00–21.00, cells 0-0 through 2-2 and 3-1, last resort |
| Double chance | model ≥ 62%, not a lock |
| Daily ten | 10 |
| Mixer pass 1 | 5 wins, 3 BTTS, 2 totals |
| Pass 2, FULL_DATA only | draw, double chance, Asian handicap, team-to-score |
| Never on the ten | combos, cards, corners, player G∪A, multi-goals, odd/even |
| Extra totals | 0.5 / 3.5 / 4.5 and Asian 2.0 / 2.25 / 2.75 share the totals family. They do not take the two Over/Under 2.5 seats |
| Over 1.5, Under 0.5, Under 1.5 | not Tenfold markets |
| Under 2.5 shorter than 1.55 | lock, off the ten |

Model (`models.ts`, `latent.ts`):

| Name | Value |
|---|---|
| League mean home / away goals | 1.38 / 1.12, unless the league table supplies its own |
| Dixon–Coles ρ | −0.13 (totals path −0.1) |
| ρ decay ξ per day | 0.0065 / 3.5 |
| Karlis covariance | 0.12 |
| Frank copula θ | 0.8 |
| Goal grid | 0…8 |
| Union weights | Dixon–Coles 0.50, Karlis 0.20, copula 0.14, NegBin 0.08, Elo 0.08 |
| Shin rake weight α | 0.4 on the book side of the log-pool |
| Baio κ | 4; harder (6) when a side has played fewer than 6 |
| Huber goal-rate knot | 1.8 GD per game, then weight k/\|r\| |
| Win λ gap | ≥ 0.12 |
| Win draw-mass cap | 0.30 |
| Home Elo advantage | 65 points |
| Pi-rating learning / catch-up | 0.035 / 0.7 |
| History weight before data bumps | 0.32, clamped to [0.22, 0.78] after the bumps in `histWeightFromData` |
| Yip goal variance-to-mean | ≈ 1.04. Pólya–Aeppli is a lab, not the grid that prices the ten |

Selection (`select.ts`, `quality.ts`):

| Name | Value |
|---|---|
| Min sample each side | 5 |
| Ten data gate | not LOW_DATA or UNUSABLE; last-five present; FULL_DATA, or PARTIAL_DATA with quality ≥ 0.6 |
| Best data gate | FULL_DATA and quality ≥ 0.6. No fallback to the ungated pool |
| Absolute quality floor | 55 |
| Relative floor on a large family pool | 70th percentile |
| Small pool (< 5 that cleared 55) | floor 65, not the percentile |
| Quality weights | form 0.25, H2H 0.15, sample 0.15, reliability 0.20, value 0.20, league 0.05 |
| Min edge (most families) | −0.01 |
| Min EV | 0.96; draw 0.92; correct score 0.80 |
| Agreement floor | 0.18 |
| League-weight floor | 0.50 |
| Straight-win accuracy | ≥ 0.54 |
| BTTS / O/U accuracy | ≥ 0.50 |

Data grade (`features.ts` `dataGrade`):

| Points | Condition |
|---|---|
| 0.22 / 0.16 / 0.08 | last-N ≥ 8 / ≥ 5 / ≥ 3 |
| 0.12 | venue N ≥ 3 |
| 0.16 | standings present |
| 0.18 | season stats present |
| 0.08 / 0.04 | H2H ≥ 3 / ≥ 1 |
| 0.08 | injuries known for this league |
| 0.16 | odds present |
| 0.04 | lineups |
| then | multiply by 0.7 + 0.3 × coverage |

Grade: ≥ 0.72 FULL_DATA, ≥ 0.45 PARTIAL_DATA, ≥ 0.22 LOW_DATA, else UNUSABLE.

---

## 6. Feature snapshot

`buildSnapshot` rolls last-N samples into side rates, venue rates, opponent-adjusted attack and defence, and a league environment off the table. Form strings are newest-first. Last-5 stays last-5. Last-20 feeds failed-to-score, clean sheets, and opponent-adjusted rates. It does not overwrite the last-5 number.

Opponent adjustment discounts table goal difference and rank so the same strength is not added again as a raw rate, again as GD, and again as rank. `estimateLambdas` still applies a **reduced** table term when adjusted rates are already present (`tableW = 0.7` instead of 1).

BTTS failure modes are flags on the snapshot (both teams quiet, one team fails to score, and so on). They explain a BTTS No. They are not a second probability.

---

## 7. Lambdas — `estimateLambdas`

Do these in order. Skipping one and “adding form at the end” will not match.

Priors: `leagueAvgHome` or 1.38, `leagueAvgAway` or 1.12.

1. **Winsorise** last-5 (or prior) goals for and against, both sides, with Huber knot 1.8: if \|rate − league\| ≤ 1.8 keep it, else pull it back to `league + 1.8 · sign`.
2. **Karlis outlier scale.** If goals-for exceed goals-against by more than 0.15, scale the excess by a second Huber weight, times a small-sample penalty. Otherwise scale = 1. Apply to for and against.
3. **Recent rate.** Home recent = ½ home-for + ½ away-against. Away recent = ½ away-for + ½ home-against.
4. **Venue.** If venue splits exist: venue home = 0.55 home-venue-for + 0.45 away-venue-against, then recent = 0.28 venue + 0.72 recent. Same pattern for away.
5. **Season.** Home season = 0.55 home-for-at-home + 0.45 away-against-away. Away season is the mirror.
6. **Finishing shrink.** `(n · recent + k · season) / (n + k)`. With last-5 present, n = 5 and k = 2. Without it, k = 8 and n is the short sample (capped at 8).
7. **Recent vs season.** With last-5, λ = 0.72 recent + 0.28 season. Without, 0.40 / 0.60.
8. **Poisson share.** If a home-share of the total is in (0.05, 0.95), blend 22% of the way toward that split. Keep the total.
9. **Baio shrink** toward the league prior. Strength k = 6 if that side has played fewer than 6, else 2.2 when last-5 exists, else κ = 4. n is played, clamped to [2, 16].
10. **Availability.** Confirmed lineup (weight 0.7) else the injury shock. Attack multiplies λ by `1 − clamp(shock, −0.08, 0.22)`. Opponent defence multiplies by `1 + clamp(shock, −0.08, 0.18)`. Opponent keeper multiplies by `1 + clamp(shock, 0, 0.20)`.
11. **Form tilt.** Newest-first W/D/L. W adds 0.08, L subtracts 0.06, weight decays ×0.72 each match back. Clamp the sum to [−0.12, 0.14]. Add to λ. Draws add nothing.
12. **Adjusted attack/defence,** if present. λ_home = 0.82 λ + 0.18 adj attack. Opponent adjusted defence moves the other λ at weight 0.10.
13. **Over-1.5 rates.** Side rate > 0.55 multiplies that λ by 1.04. Rate < 0.28 multiplies by 0.96.
14. **Late-goal share.** Mean of the two sides > 0.28 multiplies both λ by 1.03. Below 0.12 multiplies by 0.98.
15. **Table.** GD per game, only if played ≥ 4, clamped to [−2.2, 2.4]. Home λ += 0.14·w·homeGD − 0.08·w·awayGD. Rank gap `(awayRank − homeRank) / 20` clamped to [−0.8, 0.8]: home λ += 0.16·w·gap, away λ −= 0.12·w·gap. w = 0.7 if adjusted attacks exist, else 1.
16. **Failed-to-score streak** ≥ 3: multiply by `1 − 0.03 · min(4, streak)`.
17. **H2H,** if at least two meetings. Use the five most recent. Mix 12–22% when last-N ≥ 8 on both sides, else 16–28%. Also set the NegBin r from the H2H total’s variance-to-mean when variance exceeds the mean by 0.15. r clamped to [3.5, 18], default 18.
18. **Maher log-linear,** if attack or defence ratings exist. `log λ = log μ + attack − oppDefence`, μ at least 0.35, result clamped to [0.32, 3.35]. Blend 15% of that into the λ you already have.
19. **Goal momentum.** `w · (short − long)` with w = n/(n+8), clamped to [−0.7, 0.7]. Add 0.12 × momentum. This is goals, not W-D-L.
20. **League total guard.** If \|λ_sum − leagueAvgTotal\| / leagueAvgTotal > 0.85, replace the total with 0.25·league + 0.75·current. Default league total 2.65.
21. **Torvaney xG grid,** only when both sides have it. Each historical match is a list of shot probabilities. The scoreline weight is the product of two Poisson-binomials. The rate mixed in is the mean of those match totals (the grid mean before the 0…8 cap). λ = 0.82·λ + 0.18·rate. One side missing, or a match with no shots, does not enter. A season goal average is not a shot list.
22. **Clamp.** Home [0.32, 3.35], away [0.24, 3.1].

Return overdispersion r and a log-scale standard error from attack/defence variance (default variance 0.12 each). The standard error is uncertainty. It is not a second λ.

Shin is **not** inside this function. Mixing the book into λ happens later, and only when the book agrees with last-20 history. A stale 1.93 does not pull a 2.8 goals-for side to a coin flip.

---

## 8. The score grid

### 8.1 Poisson and Dixon–Coles

```
P(X = k) = e^(−λ) λ^k / k!
τ(0,0) = 1 − λh λa ρ
τ(0,1) = 1 + λh ρ
τ(1,0) = 1 + λa ρ
τ(1,1) = 1 − ρ
τ = 1 otherwise
cell(x,y) ∝ P(X=x) P(Y=y) max(0, τ(x,y))
```

Then divide by the sum so the grid is a distribution. λ is clamped to [0.05, 4.2] inside the grid, which is wider than the λ clamp in §7. ρ is clamped so every τ stays non-negative: above max(−1/λh, −1/λa) and below 1/(λh λa).

The probability is computed by recurrence, not by k!. P(0) = e^{−λ} and P(k) = P(k−1) · λ/k. On an untruncated sum the mean and the variance both equal λ. The grid stops at 8, so that identity fails on the cells you can see: the truncated mean is below λ and the variance-to-mean ratio is below 1. At λ = 1.38 the missing tail is under 0.01%. At the §7 clamp 3.35 it is not.

`ρ = 0` is Maher independence. Default ρ = −0.13. Low-scoring matches tighten ρ further (`matchRho`). Totals use −0.1.

Decay on a past match `exp(−ξ · days)`, ξ = 0.0065/3.5 per day. Half-life is ln 2 / ξ.

### 8.2 Other grids on the same λ pair

- **Karlis** bivariate Poisson, covariance 0.12. Not a copula. X = X₁+X₃, Y = X₂+X₃, three independent Poissons. λ₁ = λh − λ₃, λ₂ = λa − λ₃, with λ₃ floored at 0.02 on the score grid and capped at 0.28·min(λh, λa). Margins stay Poisson, so P(H=0) stays e^{−λh}. The shock cancels in the goal difference: Var(X−Y) = λh + λa − 2λ₃, which is how the model buys draws. Closed BTTS uses P(0-0) = e^{−(λh+λa−λ₃)} and does not apply the 0.02 floor.
- **Frank copula** θ = 0.8. This is the copula. C_θ(u,v) = −θ⁻¹ log(1 + (e^{−θu}−1)(e^{−θv}−1)/(e^{−θ}−1)). θ = 0 is independence. A cell is the rectangle of C on the Poisson CDFs. Positive θ lifts 0-0 and BTTS in the same direction as Karlis and then moves 2-0 and 2-1 by a different amount. Do not treat λ₃ and θ as the same knob.
- **NegBin** with the r from §7 step 17 (or 18 if H2H did not move it). NB2: P(0) = (r/(r+μ))^r and P(k) = P(k−1)·(k−1+r)/k·μ/(r+μ). Variance is μ + μ²/r. The union grid is the product of two independent margins at that shared r. A single NB on λh+λa is the frailty total, and its variance is larger by 2λhλa/r. The ten use the product, not the frailty. r is clamped to [3.5, 18], so it cannot reach the Yip league value μ/(1.04−1). Smaller r means a heavier tail.
- **Elo / pi-ratings** produce a second λ pair, then their own Dixon–Coles grid. Pi-ratings move 6–18% of λ from H2H. Cut that weight when H2H disagrees with Shin (BORS) and cut it again when last-20 form is already in the λ.

Zero-inflated Poisson is **not** in that union. P(0) = π + (1−π)e^{−λ}, mean (1−π)λ, VMR 1+πλ. The prior π = 0.05 is not fit: a Poisson zero frequency gives π̂ = 0. Margin ZIP, (0,0)-only, and ZI-Skellam put the extra mass in three different places. Dixon–Coles τ is a fourth thing and keeps Poisson margins. Holding the mean fixed would replace λ with λ/(1−π). The grid does not.

Skellam is the goal difference, not another score grid. Independent: mean λh−λa, variance λh+λa. The draw is e^{−(λh+λa)} I₀(2√(λh λa)), and the same number is the diagonal convolution of the two Poissons. Common-shock Skellam is Skellam(λh−θ, λa−θ): the mean is unchanged and the variance falls by 2θ, so the draw rises. That is the 25% slot in structural 1X2. The independent Skellam is the 8% slot. The normal approximation, the NegBin difference, and the in-play shift are not in the ten.

Zero-inflated Skellam is also not in the ten. It is a mixture on the difference, not a cell model. P(GD = 0) = π + (1−π) P_Sk(0), and P(GD = k) = (1−π) P_Sk(k) for k ≠ 0. The mean shrinks to (1−π)(λh−λa). π̂ = (observed draw − Skellam draw) / (1 − Skellam draw). If the observed draw is smaller, π̂ is returned as 0, because π is clamped to [0, 0.25] and the model cannot deflate. Putting that coin on the common-shock Skellam stacks two draw machines. Diagonal inflation of the score grid can raise 1-1 and 0-0 by different amounts. ZI-Skellam cannot tell those scores apart. Structural 1X2 gives the diagonal slot weight 0.

### 8.3 Log-pool

Weights w ≥ 0, treated as summing to 1 (the code renormalises).

```
p(x,y) ∝ exp( Σᵢ (wᵢ / Σw) log pᵢ(x,y) )
```

Floor each cell at 1e−12 before the log. This is the I-projection: it minimises Σ wᵢ KL(p ‖ pᵢ). A linear mix of the same grids exists (`mixGrids`) and is not the union the ten use.

`UNION_WEIGHTS`: dc 0.50, karlis 0.20, copula 0.14, negBin 0.08, elo 0.08.

### 8.4 Shin, then rake

Invert the whole posted book with Shin’s insider proportion. Do not turn one correct-score odd into 1/odd and call it a probability. Unposted scorelines keep a residual tail.

Rake the model grid onto the book’s 1X2 (and BTTS, when posted) by scaling those regions, a few rounds, then renormalise. Log-pool the untouched model grid with the raked grid at book weight 0.4.

Home, BTTS, Over 2.5 and 1-1 are slices of that table. They are not four independent blends.

### 8.5 What is a lab, not the ten

Zero-inflated Skellam, diagonal inflation, Weibull counts, Pólya–Aeppli (Panjer). Yip’s goal VMR is about 1.04, so the compound-Poisson extra variance is not switched on for the card. Corners use a higher VMR (about 1.19) inside the corners module only.

---

## 9. Markets sliced from the grid

- **1X2.** Sum x > y, x = y, x < y.
- **BTTS.** Sum of cells with x ≥ 1 and y ≥ 1. BTTS No prints only when λ, last-five goals-for, and last-five H2H all say a clean sheet. Missing is not a No.
- **Totals.** Sum of cells with x + y ≥ line, for 0.5, 1.5, 2.5, 3.5, 4.5. Over 2.5 wants λh + λa ≥ 2.38 before it is a serious price. Over 1.5 at 1.90 wants a total near 1.7–2.1; a four-goal match is a short Over, not a 1.90.
- **Asian totals and Asian handicaps.** Quarter lines are the average of the two neighbouring lines (2.25 is half 2.0 and half 2.5). Settlement is win / half-win / push / half-loss / loss. Fair odds and EV use that settlement, never 1/P(cover).
- **European handicap.** Integer line, three-way, from the grid.
- **Double chance.** 1X = home + draw, and the two mirrors, from the 1X2 sums. Not a new model.
- **Team to score.** 1 − P(that side scores 0). This is “team over 0.5”, not first or last scorer.
- **Correct score.** A cell, after the gates: beat the next score by 1 percentage point, top three cells hold ≥ 28%, and the score agrees with the 1X2 cluster. 0-2 is not a 68% home. Optional. It fills a short card. It does not bump a binary.
- **Combos.** Joint probability is the sum of cells that satisfy every leg. Independence is wrong. Reject pairs that cannot happen together.
- **Odd/even, multi-goal ranges.** Sums on the same grid.
- **Corners.** Own bivariate Poisson on corner counts. No counts → no bet.
- **Player goal or assist.** P(G) + P(A) − P(both), scaled by minutes. No minutes → no bet.
- **Cards.** Poisson on the card rate. No rate → no bet.

A straight win also needs the book on that side as favourite, last-five H2H not 1 win in 5 against, and draw mass under 30%.

---

## 10. From probabilities to the ten

### 10.1 Experts

Accuracy is a weighted logit pool, then extremized when Higgins I² is low. Value is a linear mix that **excludes** the market, so a price can still be short or long against the book.

The accuracy prior is the de-vigged book, not the grid. The weights are book 0.62 / grid 0.18 on 1X2, book 0.58 / grid 0.22 on BTTS and totals, and book 0.44 / grid 0.40 on correct score. Shin's accuracy cap is 0.72. The grid floor is 0.12, so a fit cannot delete the model. Value priors give the book weight 0. These weights are a prior. They are not a fit on this desk's settled lines.

The sentence that used to sit here — 7,626 out-of-time matches, market log-loss 1.0026, Dixon–Coles log-loss 1.0539, a consensus clone beating an alpha layer — is withdrawn. It is not a result from `data/calibration.json`. A search of those three figures does not land on a football paper. 1.0026 is a France Poisson-regression log-loss in one league table (Gagolewski-style iterative Poisson), not a bookmaker. Forrest, Goddard and Simmons (2005) is the result that actually supports a book-heavy accuracy prior: nearly 10,000 English games, published odds beat a large statistical model, and bootstraps of that model do not beat the odds. They do not publish 0.62.

### 10.1a What was checked, and what was not changed

Counted on 28 Sep 2026 from the settled file: 1,928 lines, 15 dates (12–28 Sep 2026), one settled Over 2.5. That book cannot re-estimate ρ, r, or the 0.62 weight. The walk-forward already refuses to leave the prior unless a later date confirms it.

| Gap | What the ten does | What was found | Left in place |
| --- | --- | --- | --- |
| Book versus a goals model | Shin 0.62 of 1X2 accuracy, 0 of value | Forrest et al. 2005, ~10,000 games: odds beat the model. Hubáček, Šourek and Železný 2019 profit by decorrelating a model from the book, on NBA seasons 2007–2014, with player stats and a portfolio rule. Not a football Poisson. | Weights unchanged. No residual model was trained. There is no multi-year odds panel on this card. |
| Goal overdispersion | Union NegBin is 8%, independent margins, r starts at 18 and only falls to 3.5. At 1.38 that is VMR 1.077. Over 2.5 moves from 45.62% to 45.18% before the 8% weight. | Yip, Zou, Hung and Yiu, arXiv:2112.13001, HKJC 2016–2021: goals VMR 1.0396, corners 1.1856. They cite Maher 1982: Poisson beat negative binomial because the ratio is near 1. | r was not opened above 18. The H2H rule cannot represent 1.04, and the price gap is smaller than the book weight. |
| Weibull count | Shape 0.9 is priced and given weight 0. At 1.38/1.12 it cuts BTTS from 50.42% to 26.38%. | Boshnakov, Kharrat and McHale 2017: a fitted Weibull inter-arrival count plus a copula beat Poisson out of sample and produced positive returns on 1X2 and Over 2.5. The abstract does not give the return or the shape. | Weight stays 0. Shape 0.9 is not their fitted model. |
| Extra zeros | ZIP π = 0.05 is a prior. Not in the union. | Karlis and Ntzoufras 2003: zero-inflated bivariate Poisson did not improve their 1997–98 fits once the shared shock was in. | Stays out. |
| One ρ | Frozen −0.13. `matchRho` then scales it by the total. A season fit published by dashee87 is −0.12851. Information per match here is 0.655, so 100 matches leave an SE of 0.124. | Dixon and Coles 1997 estimate one ρ on the whole sample. They do not rescale it by the expected total. | Not refit on 15 dates. `matchRho` was not removed: that would move low-score prices with no holdout. |
| Attack and defence | A weighted recipe on the snapshot. The Kalman (q = 0.012) is a panel, not the ten. | Rue and Salvesen 2000, Crowder et al. 2002, Koopman and Lit 2015 need a season of matches, not one card. | No 20-team likelihood was invented for today. |

`formMarketTargets` (last-5 totals and last-5 BTTS as a probability) is not called by the pipeline. Those rates enter as vetoes. A side whose last-5 BTTS rate is 0.28 or lower cannot be a BTTS Yes. That is a gate, not a shrunk probability.

### 10.2 Calibration

When a settled corpus has n ≥ 12, a Granger–Ramanathan least-squares mix on the logit pool can replace the prior, plus an intercept if the whole crowd is biased. Nested walk-forward chooses the rule. The live mix is a recency-weighted mean of expanding-window fits, not a one-shot refit on today. Apply it only if it beats the paper prior **out of sample**. Today does not grade itself.

A second walk-forward (Pardo) chooses recency half-life and shrinkage n₀ on a 4-cell grid: (14d, 48), (7d, 24), (28d, 96), (14d, 96). Freeze the in-sample winner, score the next date. Apply only if mean out-of-sample Brier beats 14d · n₀ 48 by 0.0005. PBO and White’s reality check flag a snooped hyper. Shin's accuracy weight cannot pass 0.72, and the grid cannot fall under 0.12.

A port with no settled history uses the paper priors and skips this section. Do not fit weights on the day you are predicting.

The same settled lines can be graded five ways (`validationContrast`). The starting probability is the paper mix; each scheme may add an intercept fit on its own training lines. Resubstitution and a k-fold that ignores time are not valid. Last-date holdout is valid and one number. Expanding walk-forward is the rule above. Rolling last-7 uses the same embargo. Optimism is expanding Brier minus resubstitution Brier. This grade does not choose the ten.

### 10.3 Quality, then quota

`computeAbsoluteQuality` is the weighted sum in §5. `selectTopQualityPicks` drops anything under 55. A family pool that still has 5 or more is cut at the 70th percentile. A pool under 5 uses a floor of 65 instead. `gateDailyTen` / `gateBestBets` apply that before the mixer.

`isDataBacked` is the grade rule in §5. Stubs with no facts object stay eligible so unit tests can run; a live row always has facts.

`selectDailyTen` then fills pass 1 (5 / 3 / 2) from lines that are data-backed, inside the odds band, with agreement, league weight, edge, and EV above the floors. Pass 2 adds draw, double chance, Asian handicap, and team-to-score only from FULL_DATA, and only while the card is short of 10. Research families never occupy a slot.

Best is `focusBestBet`. A qualifying over combo takes the slot. Otherwise `rankBestBets` after `gateBestBets`. FULL_DATA only. Mixed combos do not headline.

Quality beats quota. Ten quiet lines do not get promoted to fill the card.

---

## 11. Diagnostics — read, do not rank

### 11.1 Kelly and risk

Stake on a ticked slip is Kelly: f* = (b p − q) / b, with p the calibrated probability and b = odd − 1. Default is quarter-Kelly. A second market on the same fixture is haircut. The card is scaled if it would exceed 20% of bankroll. Full Kelly below 2% is a pass. Stake size does not sort the ten.

Sharpe is mean excess return over volatility on unit stakes, rf = 0, not annualised. Sortino uses MAR = 0 and keeps winning periods in the downside as zeros. Omega is upside partial moment over downside partial moment. These describe a settled book. They do not pick tomorrow.

### 11.2 Significance

One line, then the family. Full arithmetic and the 25 numerical checks are in [artifacts/tenfold-significance-replication.md](artifacts/tenfold-significance-replication.md). The rules:

- Evidence is last-5 (or H2H if form is shorter than 3 and H2H has n ≥ 4) against the **implied** probability, not against a coin.
- The interval that judges the line is Wilson. Wald is shown so you can see it collapse at 0/5. 4 wins in 5 against a 55% book is **underpowered**: Wilson still covers the book, and n < 8 cannot be called significant.
- Verdict order: Wilson excludes the book on the low side → against; exact one-sided p < 0.05 and n ≥ 8 and the rate is above the book → significant; n < 12 → underpowered; else compatible.
- Family, live print: Bonferroni α/m, BH step-up at (r/m)α including the prefix gap, Storey q at λ = ½. If fewer than 2 p-values exceed λ, or m < 5, π₀ = 1 and q is the BH-adjusted p.
- q = min(1, π₀ × BH-adjusted p). Walk from the worst p and take a running minimum of π₀·m·p₍ᵣ₎/r.
- Holm stops at the first miss of α/(m−r+1). Hochberg steps up on those same bars. BH steps up on (r/m)α. Keeps nest. Hochberg is not BH. The first three control familywise error. BH controls the false-discovery rate.
- BY is BH run at α/Hₘ, Hₘ = Σ 1/i. Use it when the card is arbitrary dependence. Do not also divide by π₀.
- Dependence: separate fixtures → independence, BH at α. Same-direction legs on one fixture → PRDS, BH at α. Any opposed pair → arbitrary, uncorrected BH is only proved up to α·Hₘ on the pooled card. One spoiler covers the whole family. Opposed pairs include home–away, home–draw, away–draw, BTTS yes–no, and over–under on the same line.
- Bootstrap λ* and the quadratic smoother at 0.95 are reported. The live q stays at λ = ½.

None of these booleans reorder the ten.

---

## 12. Porting procedure

1. Types and the constant tables in §5. Reject a market outside its band before you model it.
2. Poisson PMF, Dixon–Coles τ, grid renormalisation. Check §13.1 before writing anything else.
3. `estimateLambdas` in the order of §7. Feed it a fixture whose last-5 and league priors you can compute by hand.
4. The other grids and `logPoolGrids`. Check that five equal grids come back unchanged, and that weights 0.5/0.2/0.14/0.08/0.08 sum to 1.
5. Shin inversion on a 1X2 book you can solve by hand, then the rake, then the 0.4 log-pool.
6. Slice 1X2, BTTS, Over 2.5, one Asian quarter line, one combo of two compatible legs. The combo must equal the cell sum, not the product.
7. `dataGrade` and `isDataBacked`. A side with two matches is not FULL_DATA and is not on the ten.
8. Quality score, then `selectDailyTen`. Confirm a date of locks and 8.00 dogs returns a short card, not ten forced picks.
9. Optional: Kelly, then significance. Confirm 4/5 versus 0.55 is underpowered, and that turning significance off does not change the ten.
10. Only if you need bit-identical slips: port `scoreFixture` and diff it against this build on a saved fixture JSON. §7–§9 are the contract; `scoreFixture` also applies expert weights and the win/BTTS sanity gates.

Language does not matter. You need a Poisson PMF, a stable sort, and (for significance) a regularised incomplete beta or a binomial CDF. No database and no clock inside the pure functions. Kickoff time is an input, used to drop results after the match and to decide whether a lineup is confirmed.

Form is newest-first. If your feed is oldest-first, reverse it before `formTilt` and before the significance evidence count. Reversing only one of them will disagree with itself.

---

## 13. Acceptance checks

Tolerances: grid cells 1e−9 after renormalisation, λ within 1e−6 of a hand calculation on the same inputs, keep-sets exact.

### 13.1 Grid

- τ(0,0) at λh = λa = 1, ρ = −0.13 is 1 − (1)(1)(−0.13) = 1.13.
- τ(1,1) at ρ = −0.13 is 1.13. τ(0,1) is 1 + λh·ρ = 0.87.
- A Dixon–Coles grid sums to 1. Every cell ≥ 0.
- ρ = 0 grid equals the product of the two Poissons, after the λ clamp.
- Log-pool of one grid is that grid.
- Poisson(1): P(0) = P(1) = e^{−1}, P(2) = e^{−1}/2. The long sum has mean and variance 1.
- Poisson(1.38) mode is 1 and the mass past 8 is under 0.01%. Poisson(3.35) truncated mean is under 3.35 and its truncated variance-to-mean ratio is under 1. The untruncated sum is still equidispersed.
- NB2 at μ = 1.38, r = 18: P(0) = (18/19.38)^18, which exceeds e^{−1.38}. VMR = 1 + 1.38/18. r = 3.5 has a larger P(0) gap and a larger VMR. Frailty variance minus independent-margin variance equals 2λhλa/r.
- ZIP at λ = 1.38, π = 0.05: P(0) = 0.05 + 0.95 e^{−1.38} and the mean is 0.95 × 1.38. π̂ of a pure Poisson is 0. (0,0)-only raises 0-0 and lowers 1-0 and 1-1. ZI-Skellam at π = 0.05 has a higher draw than π = 0.
- Skellam at λh = 1.38, λa = 1.12: mean 0.26, variance 2.50. Bessel draw matches the convolution. Shock variance is 2.50 − 2×0.12 = 2.26 and its draw is higher. NegBin r = 18 draw is lower. In-play at 1–0 with 0 minutes left is home = 1. At 0–0 with 90 left, in-play equals the independent Skellam.
- ZI-Skellam at π = 0.05: P(GD = 0) = 0.05 + 0.95 P_Sk(0), and P(GD = 1) = 0.95 P_Sk(1). Mean is 0.95 × 0.26. π̂ of the plain Skellam draw is 0. A draw 2 points below the Skellam draw also returns π̂ = 0. Diagonal inflation at the same π raises 1-1. π = 0 leaves the draw and the mean on the Skellam.
- Union weights sum to 1.
- Karlis at λh = 1.38, λa = 1.12, c = 0.12: λ₁+λ₃ = 1.38, Var(X−Y) = 1.38+1.12−0.24. Frank at θ = 0.8 does not match the Karlis 1-1. At c = 0 the closed shock is 0 and the grid shock is 0.02. At θ = 0, Frank P(0-0) matches Maher.

### 13.2 Lambda

- No observations: both λ sit on the league priors after the Baio step and the final clamp. They are not zero.
- A rate 4.0 against a league 1.38 is Huber-pulled before it enters the recent blend. It is not left at 4.0.
- Form `W` only, one character: tilt = +0.08. Form empty: tilt = 0.
- `finishingShrink(4.5, 1.2, 5, 8) = (5·4.5 + 8·1.2) / 13`.
- `logLinearLambda` matches exp(log μ + attack − defence) inside the clamp.
- Failed-to-score streak of 0 does not change λ.

### 13.3 Gates

- Grade points with last-N ≥ 8, venue, standings, stats, H2H ≥ 3, injuries, odds, lineups, coverage 1: sum 0.22+0.12+0.16+0.18+0.08+0.08+0.16+0.04 = 1.04, clamped to 1, FULL_DATA.
- Last-N = 2 and nothing else: 0 points, UNUSABLE, off the ten.
- Under 2.5 at 1.40 is ineligible. Over 1.5 is not a single on the ten. It can be a leg of the over combo. A mixed combo is never Best.
- Two team-over-0.5 legs at 1.40 and 1.50, both FULL_DATA and +EV, product 2.10: that ticket is Best, ahead of a higher single. The same two prices at 1.20 × 1.30 stay off Best because the product is under 2.00.
- Same-match both-teams-over-0.5 uses the score-matrix joint. A joint of 0.40 at combined odds 2.25 is −EV and is rejected, even though the product of the marginals would look +EV.
- That pair is not also stacked with over 1.5 from the same match.
- Maher at 1.38 / 1.12: home over 0.5 and away over 0.5 have φ = 0. Dixon–Coles ρ = −0.13 moves that pair to about +0.08. Home over 0.5 with over 1.5 has φ ≈ 0.52, fair odds about 1.57 against a naive 1.87. Home win with under 2.5 has negative φ, and the naive product is −EV. P(over 1.5 | both teams score) = 1.
- Absolute quality 54 does not pass the floor of 55.

### 13.4 Diagnostics

- Wilson 4/5 contains 0.55. Verdict underpowered.
- BH on (0.001, 0.008, 0.03, 0.04, 0.2) keeps four. Bonferroni keeps two.
- Step split (0.011, 0.014, 0.015, 0.04, 0.2): Bonferroni 0, Holm 0, Hochberg 3, BH 4.
- Ten copies of 0.04: Holm 0, Hochberg 10, BH 10, BY 0.
- Gap (0.001, 0.012, 0.032, 0.039, 0.2) at π₀ = ½: rank 3 q equals ½ · (5/4) · 0.039, which is below its own scaled ratio.
- H₁₀ = 7381/2520.
- Home and away on one fixture, plus eight single-leg fixtures: joint proof is arbitrary. The clean block of eight is still independence **inside the block**. The pooled BH ceiling is α·H₁₀.
- On a book whose first date is all misses and whose second date is all hits, at a flat 0.55: resubstitution Brier is below expanding Brier, optimism is positive, and the time-blind k-fold uses a future date.

The rest of the significance checks are in the appendix.

---

## 14. What this file will not do

It will not pick a stake, a rank, or a “significant” stamp and call that the ten. The ten is §10. Everything in §11 is a reading of a card you already built.

It will not silently track a fork. If you change a coefficient in a port and do not edit §1 and the section that owned the old number, the port has left this spec.
