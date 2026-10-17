# ADVANCED FOOTBALL ODD/EVEN FULL TIME PREDICTION ENGINE

## Market Definition

Predict whether the **total number of goals scored in a football match during normal time** will be:

```text
ODD
```

or:

```text
EVEN
```

### Settlement Definition

The market uses:

> **90 minutes + normal stoppage/injury time only.**

Do NOT include:

- extra time
- penalties
- penalty shootouts
- goals scored during extra time
- penalty-shootout goals

Examples:

```text
0-0 → Total = 0 → EVEN
1-0 → Total = 1 → ODD
1-1 → Total = 2 → EVEN
2-1 → Total = 3 → ODD
2-2 → Total = 4 → EVEN
3-2 → Total = 5 → ODD
```

**0 always counts as EVEN.**

---

# 1. PRIMARY OBJECTIVE

Build a production-grade **Odd/Even Full Time prediction engine** that estimates:

```text
P(Total Goals is EVEN)
P(Total Goals is ODD)
```

where:

```text
Total Goals = Home Goals + Away Goals
```

during normal time.

The final probabilities must satisfy:

```text
P(EVEN) + P(ODD) = 1.00
```

or approximately 100% after rounding.

---

# 2. CORE PRINCIPLE

Do NOT treat Odd/Even as a simple 50/50 coin flip.

The engine must determine the probability distribution of total goals and then calculate how much probability mass belongs to:

```text
0 goals
2 goals
4 goals
6 goals
8 goals
...
```

for EVEN,

and:

```text
1 goal
3 goals
5 goals
7 goals
...
```

for ODD.

Therefore:

```text
EVEN =
P(0) + P(2) + P(4) + P(6) + P(8) + ...

ODD =
P(1) + P(3) + P(5) + P(7) + P(9) + ...
```

---

# 3. ABSOLUTE DATA RULES

The engine must use **real available football data only**.

NEVER fabricate:

- fixtures
- goals
- team statistics
- player statistics
- odds
- lineups
- injuries
- suspensions
- xG
- xA
- tactical information
- goal distributions

If xG is not actually available:

```text
DO NOT ESTIMATE OR FABRICATE xG.
```

The system does not have xGA trend data.

Therefore:

```text
DO NOT USE xGA TREND.
```

Do not convert missing statistics into zero.

Missing data means:

```text
UNAVAILABLE
```

not:

```text
0
```

---

# 4. FIXTURE VALIDATION

Before prediction verify:

```text
fixture_id
home_team_id
away_team_id
league_id
season
kickoff_time
fixture_status
```

Confirm:

```text
home_team != away_team
fixture is valid
fixture has not started
fixture is not cancelled
fixture is not postponed
```

Do not generate predictions for an invalid fixture.

---

# 5. NORMAL-TIME SETTLEMENT

The engine must distinguish:

```text
FULL TIME
```

from:

```text
AFTER EXTRA TIME
```

The target variable is:

```text
normal_time_total_goals
```

If a match ends:

```text
90 minutes: 2-1
Extra time: 3-1
```

the prediction result is:

```text
Total = 3
ODD
```

The extra-time goal does not count.

Penalty shootout goals never count.

---

# 6. REQUIRED TEAM DATA

Fetch and use, where available:

### Home Team

- total goals scored
- total goals conceded
- matches played
- average goals scored
- average goals conceded
- home goals scored
- home goals conceded
- home matches
- home clean sheets
- home failed-to-score
- home 0-goal matches
- home 1-goal matches
- home 2-goal matches
- home 3+ goal matches

### Away Team

- total goals scored
- total goals conceded
- matches played
- average goals scored
- average goals conceded
- away goals scored
- away goals conceded
- away matches
- away clean sheets
- away failed-to-score
- away 0-goal matches
- away 1-goal matches
- away 2-goal matches
- away 3+ goal matches

---

# 7. RECENT FORM

Calculate goal profiles over:

```text
Last 5
Last 10
Season
```

where sufficient samples exist.

Track:

```text
goals scored
goals conceded
total goals
```

and especially:

```text
total goals EVEN frequency
total goals ODD frequency
```

Example:

```text
Last 10 matches:

0 goals → 1
1 goal → 2
2 goals → 3
3 goals → 2
4 goals → 1
5+ goals → 1
```

Then calculate the observed parity frequency.

---

# 8. HOME/AWAY PARITY

Home/away splits are important.

For the home team use:

```text
home matches
home total goals
home goal distribution
home odd/even frequency
```

For the away team:

```text
away matches
away total goals
away goal distribution
away odd/even frequency
```

Do not use overall statistics as a substitute when reliable venue-specific data exists.

---

# 9. MATCH TOTAL GOAL DISTRIBUTION

Construct the historical distribution:

```text
P(Total = 0)
P(Total = 1)
P(Total = 2)
P(Total = 3)
P(Total = 4)
P(Total = 5)
P(Total = 6)
P(Total >= 7)
```

where sufficient historical data exists.

This distribution is more useful than simply calculating:

```text
Average total goals
```

because Odd/Even depends on the **entire distribution**.

---

# 10. EXPECTED GOALS

If actual expected-goal data is available from the API/data source, use it.

Otherwise construct expected scoring rates from available actual goal data.

Calculate:

```text
λ_home
λ_away
λ_total
```

where:

```text
λ_total = λ_home + λ_away
```

Do not invent expected-goal values.

---

# 11. HOME EXPECTED GOALS

Estimate:

```text
λ_home
```

from appropriately weighted:

- home scoring rate
- away defensive concession rate
- opponent-adjusted attack
- opponent-adjusted defense
- recent form
- season form
- home advantage
- lineup availability
- relevant contextual factors

Use shrinkage when sample sizes are small.

---

# 12. AWAY EXPECTED GOALS

Estimate:

```text
λ_away
```

from:

- away scoring rate
- home defensive concession rate
- opponent-adjusted attack
- opponent-adjusted defense
- recent form
- season form
- lineup availability
- relevant contextual factors

Use shrinkage for small samples.

---

# 13. POISSON TOTAL-GOAL MODEL

Use Poisson as a baseline model.

If:

```text
Total Goals ~ Poisson(λ_total)
```

then:

```text
P(Total = k)
=
e^(-λ_total) × λ_total^k / k!
```

for:

```text
k = 0, 1, 2, 3, ...
```

---

# 14. DIRECT POISSON PARITY FORMULA

For a Poisson-distributed total-goal variable:

```text
P(EVEN)
=
(1 + e^(-2λ_total)) / 2
```

and:

```text
P(ODD)
=
(1 - e^(-2λ_total)) / 2
```

Therefore:

```text
P(EVEN) + P(ODD) = 1
```

This is an important mathematical baseline.

---

# 15. IMPORTANT INTERPRETATION

The Poisson model naturally approaches:

```text
50% EVEN
50% ODD
```

as expected total goals increase.

Therefore, do NOT expect enormous natural probability differences between Odd and Even.

For example, very high expected goal environments tend to push parity closer toward 50/50.

This means the engine must be especially careful about claiming a strong edge.

---

# 16. SCORE-MATRIX MODEL

Build a joint score probability matrix:

```text
P(Home Goals = h, Away Goals = a)
```

for:

```text
h = 0...N
a = 0...N
```

where N is sufficiently large to capture almost all probability mass.

Example:

```text
        Away
       0    1    2    3
Home 0 .15  .12  .06  .02
     1 .13  .11  .06  .02
     2 .07  .06  .04  .01
     3 .03  .02  .01  .01
```

These are illustrative only.

Do not use these numbers as real predictions.

---

# 17. PARITY FROM SCORE MATRIX

For every scoreline:

```text
total_goals = home_goals + away_goals
```

Then:

```text
if total_goals % 2 == 0:
    EVEN
else:
    ODD
```

Calculate:

```text
P(EVEN)
=
Σ P(h,a)
```

for all cells where:

```text
(h + a) % 2 == 0
```

and:

```text
P(ODD)
=
Σ P(h,a)
```

for all cells where:

```text
(h + a) % 2 == 1
```

This should be the preferred method when a validated score distribution exists.

---

# 18. SCORELINE EXAMPLES

Even scorelines:

```text
0-0
1-1
2-0
0-2
2-2
3-1
1-3
3-3
4-0
0-4
4-2
2-4
...
```

Odd scorelines:

```text
1-0
0-1
2-1
1-2
3-0
0-3
3-2
2-3
4-1
1-4
...
```

---

# 19. NEGATIVE BINOMIAL MODEL

Football goal distributions can be more dispersed than a Poisson distribution.

Test for overdispersion:

```text
variance > mean
```

If historical validation supports it, use a Negative Binomial model.

Estimate:

```text
P(Total = k)
```

and then calculate:

```text
P(EVEN)
=
Σ P(Total = 0,2,4,6,...)

P(ODD)
=
Σ P(Total = 1,3,5,7,...)
```

Do not use Negative Binomial automatically.

Select it only when historical validation demonstrates an improvement.

---

# 20. EMPIRICAL DISTRIBUTION MODEL

Create a historical empirical distribution of total goals.

Example:

```text
0 → 8%
1 → 20%
2 → 27%
3 → 22%
4 → 13%
5 → 6%
6+ → 4%
```

These values are illustrative only.

Calculate:

```text
Empirical EVEN
=
P(0)+P(2)+P(4)+P(6+ even components)

Empirical ODD
=
P(1)+P(3)+P(5)+P(7+ odd components)
```

Use smoothing when samples are small.

---

# 21. RECENT PARITY MODEL

Create a model based on recent observed total-goal parity.

For example:

```text
Last 5
Last 10
Season
Home/Away
```

Calculate:

```text
recent_even_rate
recent_odd_rate
```

However:

**Do not allow a small recent sample to dominate the model.**

A sequence such as:

```text
E
O
E
E
E
```

does not prove that the next match is likely to be Even.

Apply Bayesian shrinkage toward the broader league/team baseline.

---

# 22. LEAGUE PARITY BASELINE

Calculate league-level:

```text
EVEN frequency
ODD frequency
```

for comparable historical matches.

Prefer:

```text
same league
same season
```

when sample size is sufficient.

Use broader league history with shrinkage when necessary.

Do not assume every league is exactly 50/50 without testing the historical data.

---

# 23. OPPONENT-ADJUSTED GOAL ENVIRONMENT

Adjust expected total goals based on:

```text
home attacking strength
away attacking strength
home defensive strength
away defensive strength
opponent quality
```

Do not simply average:

```text
Home average goals
+
Away average goals
```

without opponent adjustment.

---

# 24. GOAL ENVIRONMENT

Evaluate whether the match historically projects toward:

```text
Low goal environment
Medium goal environment
High goal environment
```

using actual available evidence:

- scoring rates
- conceding rates
- total-goal distribution
- O/U probabilities
- BTTS environment
- recent goal totals
- home/away splits

Do not assume that a high-goal match automatically means Odd.

Do not assume that a low-goal match automatically means Even.

---

# 25. RELATIONSHIP WITH OVER/UNDER

The Odd/Even model may consume the **validated total-goal distribution** generated by the Over/Under engine.

For example:

```text
P(0)
P(1)
P(2)
P(3)
P(4)
...
```

can be reused.

However:

**Do not simply copy an Over/Under recommendation into Odd/Even.**

The Odd/Even market is specifically about parity.

---

# 26. RELATIONSHIP WITH CORRECT SCORE

The correct-score engine can provide a detailed score matrix.

Use it to calculate:

```text
P(EVEN)
P(ODD)
```

by summing the appropriate scoreline cells.

This provides a strong consistency check.

Example:

```text
Most probable scores:

1-1 → EVEN
2-0 → EVEN
1-0 → ODD
2-1 → ODD
0-0 → EVEN
```

The engine must sum the **entire probability distribution**, not simply choose the parity of the single most likely score.

---

# 27. DO NOT USE MOST-LIKELY SCORE ONLY

Incorrect method:

```text
Most likely score = 1-1
Therefore EVEN
```

Correct method:

```text
Sum probability of ALL EVEN scorelines
vs
Sum probability of ALL ODD scorelines
```

This distinction is mandatory.

---

# 28. BTTS INTERACTION

BTTS can be used as a secondary contextual feature.

Examples:

```text
BTTS Yes
```

increases the probability mass of scorelines such as:

```text
1-1
2-1
1-2
2-2
3-1
1-3
...
```

But BTTS does NOT directly determine parity.

Do not use:

```text
BTTS Yes = Odd
```

or:

```text
BTTS No = Even
```

There is no such deterministic relationship.

---

# 29. 1X2 INTERACTION

Use the 1X2 model only as a consistency signal.

For example, a strong home-win probability may alter the expected score distribution.

But:

```text
Home Win
```

does not imply:

```text
Odd
```

or:

```text
Even
```

The Odd/Even model must remain mathematically independent at the final parity calculation.

---

# 30. GOAL-TIMING DATA

If reliable goal-timing data exists, evaluate:

- first-half goals
- second-half goals
- scoring periods
- conceding periods
- late-goal frequency

Use it to refine the total-goal distribution.

Do not use goal timing as a direct Odd/Even predictor without validation.

---

# 31. LINEUPS AND PLAYER AVAILABILITY

Where real data exists, evaluate:

- confirmed starting XI
- expected starters
- unavailable attackers
- unavailable defenders
- suspensions
- goalkeeper changes
- rotation
- expected minutes

Adjust:

```text
λ_home
λ_away
```

when the evidence supports an adjustment.

Do not invent player impact values.

---

# 32. GOALKEEPER ADJUSTMENT

If reliable goalkeeper information exists:

Evaluate:

- starting goalkeeper
- backup goalkeeper
- clean-sheet performance
- goals conceded
- recent availability

Use goalkeeper adjustments only when supported by sufficient historical evidence.

---

# 33. MATCH CONTEXT

Consider, where real data exists:

- league vs cup
- knockout vs league
- first-leg vs second-leg
- relegation implications
- title implications
- rotation risk
- fixture congestion
- rest days
- schedule density

Context must modify the underlying goal distribution only when historical validation supports the relationship.

Do not create narrative-based probability changes.

---

# 34. H2H

Use H2H only as a supporting feature.

Evaluate:

```text
H2H total goals
H2H odd/even frequency
```

Do not allow old H2H matches to dominate current team strength.

Prioritize:

```text
current teams
current season
recent form
home/away performance
```

over old H2H.

---

# 35. MARKET ODDS

If bookmaker Odd/Even odds are available, fetch:

```text
Odd odds
Even odds
bookmaker
timestamp
```

Calculate raw implied probabilities:

```text
P_implied(Odd) = 1 / OddOdds
P_implied(Even) = 1 / EvenOdds
```

If both sides are available, remove bookmaker margin where appropriate.

---

# 36. VIG-REMOVED MARKET PROBABILITY

For two-way market odds:

```text
raw_odd = 1 / odd_odds
raw_even = 1 / even_odds
```

Then:

```text
total = raw_odd + raw_even
```

and:

```text
vig_removed_odd = raw_odd / total
vig_removed_even = raw_even / total
```

Use these for market comparison.

---

# 37. MODEL VS MARKET

Calculate:

```text
model_probability
market_probability
```

for both:

```text
Odd
Even
```

Then:

```text
edge =
model_probability - market_probability
```

Also calculate:

```text
fair_odds =
1 / model_probability
```

---

# 38. EXPECTED VALUE

For a standard decimal market:

```text
EV =
Model Probability × Market Odds - 1
```

Calculate separately:

```text
EV_Odd
EV_Even
```

Do not recommend a side merely because it has a higher probability.

Price matters.

---

# 39. EXAMPLE

Illustrative example only:

```text
Model:
EVEN = 56%
ODD = 44%

Bookmaker:
EVEN = 1.90
ODD = 1.95
```

Calculate:

```text
EV(EVEN)
=
0.56 × 1.90 - 1
=
0.064
```

Therefore:

```text
+6.4% expected value
```

This example is mathematical only and is not a real betting recommendation.

---

# 40. MODEL ENSEMBLE

Use an ensemble containing:

```text
1. Total-Goal Poisson Model
2. Total-Goal Negative Binomial Model
3. Score-Matrix Parity Model
4. Empirical Goal Distribution Model
5. Home/Away Goal Model
6. Recent Goal Distribution Model
7. League Parity Baseline
8. Opponent-Adjusted Goal Model
9. Correct-Score Consistency Model
10. Market Validation Model
```

---

# 41. STARTING ENSEMBLE WEIGHTS

Use the following as starting values:

```text
20% Total-Goal Poisson
15% Score-Matrix Parity
12% Negative Binomial
12% Home/Away Goal Model
10% Opponent-Adjusted Goal Model
10% Empirical Goal Distribution
8% Recent Goal Distribution
5% League Baseline
4% Correct-Score Consistency
4% Market Validation
```

Total:

```text
100%
```

These are initial weights only.

They must be optimized through historical walk-forward testing.

---

# 42. WEIGHT ADAPTATION

Weights should be allowed to vary based on:

```text
data quality
sample size
league
model performance
calibration
recent model reliability
```

If Negative Binomial consistently performs worse than Poisson in a specific league:

```text
reduce NB weight
```

If the score-matrix model performs better:

```text
increase its validated weight
```

Do not manually change weights based on a few recent matches.

---

# 43. BAYESIAN SHRINKAGE

Apply shrinkage to unstable parity frequencies.

For example:

```text
Team recent EVEN = 70%
```

from only:

```text
10 matches
```

should not be treated as a true 70% underlying probability.

Shrink toward:

```text
league baseline
season baseline
model baseline
```

depending on sample size.

---

# 44. PROBABILITY CALIBRATION

Raw model probabilities must be calibrated.

Use:

```text
Brier Score
Log Loss
Calibration Curves
Reliability Diagrams
Expected Calibration Error
```

Calibrate:

```text
P(EVEN)
P(ODD)
```

separately or through a coherent binary calibration framework.

Possible methods:

```text
Platt Scaling
Isotonic Regression
Beta Calibration
```

Select the method using out-of-sample validation.

---

# 45. MODEL AGREEMENT

Calculate how strongly the models agree.

Example:

```text
Poisson → 52% Even
NB → 54% Even
Score Matrix → 55% Even
Empirical → 57% Even
Home/Away → 53% Even
```

This represents reasonable agreement.

If:

```text
Model A → 70% Even
Model B → 51% Even
Model C → 48% Even
Model D → 54% Even
```

model disagreement is high.

Reduce confidence.

---

# 46. DATA QUALITY SCORE

Create:

```text
data_quality = 0–100
```

Evaluate:

- fixture validity
- sample size
- home/away data availability
- recent data availability
- goal distribution completeness
- lineup certainty
- odds availability
- model input completeness
- data freshness

Missing data should reduce quality.

---

# 47. SAMPLE SIZE

Track:

```text
season_matches
home_matches
away_matches
recent_5
recent_10
league_sample
H2H_sample
```

Do not treat:

```text
3 matches
```

as equally reliable to:

```text
30 matches
```

Use statistical shrinkage.

---

# 48. PARITY DIFFERENCE

Calculate:

```text
Parity Difference =
P(EVEN) - P(ODD)
```

Absolute difference:

```text
|P(EVEN) - P(ODD)|
```

This should be used as a confidence feature.

Because Odd/Even is inherently close to 50/50 in many goal environments, avoid labeling tiny differences as strong signals.

---

# 49. PROBABILITY THRESHOLDS

Use configurable thresholds.

Example starting framework:

```text
<52%      = Very weak
52–54%    = Weak
54–56%    = Moderate
56–58%    = Strong
58–60%    = Very strong
>60%      = Exceptional / requires validation
```

These are NOT universal truth thresholds.

They must be validated against historical results.

If historical testing shows that 55% predictions are not reliable:

```text
do not classify them as strong.
```

---

# 50. NO-BET CONDITIONS

Return:

```text
NO BET
```

when:

- probability difference is too small
- model agreement is poor
- data quality is poor
- sample size is insufficient
- odds are unavailable when required
- EV is negative
- market price does not provide sufficient value
- prediction is unstable
- lineups materially change the model
- fixture data is invalid
- prediction is stale

---

# 51. 50/50 WARNING

If:

```text
P(EVEN) ≈ 50%
P(ODD) ≈ 50%
```

the engine should explicitly identify:

```text
LOW EDGE / COIN-FLIP ENVIRONMENT
```

Do not force a selection.

---

# 52. SENSITIVITY TEST

Recalculate parity under:

```text
λ_total - 10%
λ_total
λ_total + 10%
```

and, where appropriate:

```text
λ_home - 10%
λ_home + 10%
λ_away - 10%
λ_away + 10%
```

Track:

```text
P(EVEN)
P(ODD)
```

If the preferred side changes easily:

```text
robustness = LOW
```

---

# 53. GOAL-DISTRIBUTION SENSITIVITY

Perturb:

```text
P(0)
P(1)
P(2)
P(3)
P(4)
...
```

within statistically reasonable ranges.

Check whether parity remains stable.

This is important because small changes in the distribution can alter Odd/Even probabilities.

---

# 54. ENTROPY

Calculate binary prediction entropy:

```text
H =
-p_even log2(p_even)
-p_odd log2(p_odd)
```

When:

```text
P(EVEN) = 50%
P(ODD) = 50%
```

uncertainty is maximal.

As one probability becomes dominant:

```text
entropy decreases
```

Use entropy as a supporting uncertainty metric.

---

# 55. CROSS-MARKET CONSISTENCY

Check consistency with:

```text
Over/Under
BTTS
1X2
Double Chance
Correct Score
Team To Score
Handicap
```

Example:

If the score matrix says:

```text
P(0) = 10%
P(1) = 18%
P(2) = 28%
P(3) = 22%
P(4) = 13%
...
```

then:

```text
EVEN =
P(0)+P(2)+P(4)+...
```

must agree with the Odd/Even output.

Do not allow the Odd/Even engine to use a completely incompatible goal distribution.

---

# 56. CROSS-MARKET CHECK IS NOT A GATE

Other markets should provide consistency checks.

Do NOT do:

```text
Over 1.5 = YES
therefore Odd/Even = ODD
```

That is invalid.

The Odd/Even prediction must come from parity probability.

---

# 57. MARKET PRICE STABILITY

Track:

```text
opening odds
current odds
odds movement
market probability movement
```

If the price moves significantly:

```text
recalculate EV
```

Do not use stale odds.

---

# 58. PREDICTION LOCK

At kickoff:

```text
prediction_status = LOCKED
```

Store:

```text
final_probability_even
final_probability_odd
final_odds_even
final_odds_odd
fair_odds_even
fair_odds_odd
EV_even
EV_odd
model_version
timestamp
```

Do not silently modify the pre-match prediction after kickoff.

---

# 59. POST-MATCH SETTLEMENT

After final normal-time score:

```text
total_goals =
home_goals_90
+
away_goals_90
```

Then:

```text
if total_goals % 2 == 0:
    result = EVEN
else:
    result = ODD
```

Example:

```text
0-0 → EVEN
1-0 → ODD
1-1 → EVEN
2-1 → ODD
2-2 → EVEN
```

Ignore:

```text
extra time
penalty shootout
```

---

# 60. AUTOMATIC RESULT VALIDATION

Use the official final normal-time score.

Do not settle using:

```text
after-extra-time score
penalty shootout score
```

For competitions where extra time is possible, explicitly preserve the 90-minute score.

---

# 61. PERFORMANCE TRACKING

Track:

```text
Odd accuracy
Even accuracy
Overall hit rate
Brier score
Log loss
ROI
Yield
Average odds
Average model probability
Average EV
Closing line value
```

Break down by:

```text
league
season
odds range
probability range
model version
home/away goal environment
```

---

# 62. CALIBRATION BUCKETS

Create probability buckets:

```text
50–52%
52–54%
54–56%
56–58%
58–60%
60%+
```

For each bucket track:

```text
predicted probability
actual frequency
sample size
Brier score
ROI
```

This determines whether the confidence thresholds are actually meaningful.

---

# 63. LEAGUE-SPECIFIC CALIBRATION

Track Odd/Even performance by league.

For example:

```text
League A
League B
League C
```

If enough historical data exists, calibrate separately.

For small leagues:

```text
use hierarchical/shrinkage calibration
```

Do not overfit tiny samples.

---

# 64. MODEL VERSIONING

Every prediction must store:

```text
odd_even_model_version
goal_model_version
calibration_version
data_timestamp
prediction_timestamp
```

Example:

```text
odd-even-v1.0
```

This allows historical comparison after future model updates.

---

# 65. API EFFICIENCY

Do not create separate API requests solely for Odd/Even if the necessary data already exists.

Use the shared SmartMatchPick dataset.

Architecture:

```text
API-Football
      ↓
Shared Match Dataset
      ↓
Team / Fixture / Form / Odds / Squad Data
      ↓
Goal Distribution Engine
      ↓
┌───────────────┬──────────────┐
↓               ↓              ↓
O/U             Correct Score  Odd/Even
↓               ↓              ↓
         Shared Probability Distribution
                       ↓
                  Final Validation
```

The Odd/Even engine should reuse:

- fixture data
- team form
- home/away statistics
- goal distributions
- score matrix
- lineup information
- odds

whenever already available.

---

# 66. CACHING

Cache:

```text
fixture data
team statistics
recent fixtures
standings
squad data
lineups
odds
goal distributions
prediction outputs
```

Do not repeatedly request the same information for:

```text
O/U
BTTS
Correct Score
Odd/Even
1X2
```

---

# 67. TWO-STAGE PIPELINE

### Stage 1 — Candidate Filter

Quickly calculate:

```text
basic goal environment
basic parity distribution
data quality
odds availability
```

Reject obviously unsuitable fixtures.

### Stage 2 — Advanced Model

Only for qualifying fixtures:

```text
full score matrix
Poisson
Negative Binomial
empirical distribution
opponent adjustment
lineup adjustment
market comparison
calibration
sensitivity
robustness
```

This reduces unnecessary computation/API usage.

---

# 68. FINAL SCORE

Create:

```text
odd_even_score = 0–100
```

based on:

```text
probability strength
model agreement
data quality
calibration
market edge
robustness
sample size
price quality
```

Do NOT make score equal simply to:

```text
probability × 100
```

---

# 69. RECOMMENDATION LOGIC

Possible outputs:

```text
EVEN
ODD
NO BET
```

The recommendation should require configurable minimum conditions.

Example:

```text
IF
probability >= minimum_probability
AND
EV >= minimum_EV
AND
data_quality >= minimum_data_quality
AND
model_agreement >= minimum_agreement
AND
robustness >= minimum_robustness
THEN
select side
ELSE
NO BET
```

---

# 70. IMPORTANT: DO NOT FORCE A SIDE

If:

```text
EVEN = 51.2%
ODD = 48.8%
```

do not automatically recommend:

```text
EVEN
```

if the required edge is not met.

Correct result:

```text
NO BET
```

---

# 71. OUTPUT FORMAT

Return a human-readable result:

```text
ODD/EVEN — FULL TIME

Fixture:
Home Team vs Away Team

Market:
Odd/Even — Full Time

Prediction:
EVEN

Probability:
56.8%

Alternative:
ODD — 43.2%

Fair Odds:
EVEN — 1.76
ODD — 2.31

Market Odds:
EVEN — 1.90
ODD — 1.95

Edge:
+5.0%

EV:
+7.9%

Model Agreement:
84%

Data Quality:
91%

Robustness:
78%

Confidence:
82%

Risk:
Medium

Status:
QUALIFIED
```

Numbers above are illustrative only.

---

# 72. JSON OUTPUT

Return structured data:

```json
{
  "fixture": {
    "fixture_id": 123456,
    "home_team": "Home Team",
    "away_team": "Away Team",
    "league": "League",
    "kickoff": "2026-09-16T18:00:00Z"
  },

  "market": {
    "type": "odd_even",
    "period": "full_time",
    "settlement_period": "normal_time_only"
  },

  "prediction": {
    "even_probability": 0.568,
    "odd_probability": 0.432,
    "selection": "EVEN"
  },

  "goal_distribution": {
    "0": 0.10,
    "1": 0.18,
    "2": 0.28,
    "3": 0.22,
    "4": 0.13,
    "5": 0.06,
    "6_plus": 0.03
  },

  "expected_goals": {
    "home": 1.20,
    "away": 0.95,
    "total": 2.15
  },

  "market": {
    "even_odds": 1.90,
    "odd_odds": 1.95,
    "fair_even_odds": 1.76,
    "fair_odd_odds": 2.31
  },

  "value": {
    "even_edge": 0.05,
    "odd_edge": -0.05,
    "even_ev": 0.079,
    "odd_ev": -0.157
  },

  "quality": {
    "model_agreement": 84,
    "data_quality": 91,
    "robustness": 78,
    "confidence": 82,
    "entropy": 0.987
  },

  "status": "QUALIFIED",
  "model_version": "odd-even-v1.0"
}
```

The numerical values in this schema are examples only.

---

# 73. CRITICAL MATHEMATICAL VALIDATION

Before returning the prediction, verify:

```text
even_probability >= 0
odd_probability >= 0
```

and:

```text
abs((even_probability + odd_probability) - 1) < tolerance
```

If not:

```text
RECALCULATE
```

Do not return invalid probabilities.

---

# 74. DISTRIBUTION VALIDATION

Verify:

```text
Σ P(Total Goals = k) ≈ 1
```

within an acceptable numerical tolerance.

If the distribution does not normalize:

```text
INVALID MODEL OUTPUT
```

Do not generate the final prediction.

---

# 75. SCORE-MATRIX VALIDATION

Verify:

```text
ΣΣ P(Home=h,Away=a) ≈ 1
```

Then verify:

```text
P(EVEN) + P(ODD) ≈ 1
```

The score matrix and parity output must agree.

---

# 76. CONSISTENCY WITH TOTAL GOALS

If:

```text
λ_total
```

is high, the Poisson parity probabilities should generally move toward 50/50.

If the final ensemble suddenly produces:

```text
EVEN = 75%
```

the engine must investigate whether the historical distribution or another model provides sufficient evidence.

Do not allow unexplained extreme probabilities.

---

# 77. EXTREME PROBABILITY PROTECTION

Do not allow:

```text
EVEN = 90%
```

or:

```text
ODD = 90%
```

simply because one small sample shows strong parity.

Apply:

```text
probability shrinkage
calibration
sample-size controls
model agreement
```

before accepting extreme probabilities.

---

# 78. RISK FLAGS

Generate risk flags such as:

```text
LOW_SAMPLE_SIZE
MODEL_DISAGREEMENT
NEAR_50_50
STALE_ODDS
LINEUP_UNCERTAINTY
LOW_DATA_QUALITY
HIGH_DISTRIBUTION_UNCERTAINTY
LOW_EV
ODDS_MOVEMENT
HISTORICAL_INSTABILITY
```

---

# 79. FINAL DECISION HIERARCHY

Use this hierarchy:

```text
1. Correct fixture
2. Correct settlement definition
3. Real data
4. Normal-time goal data
5. Home/away goal profile
6. Recent goal distribution
7. Opponent-adjusted goal rates
8. Expected total goals
9. Poisson model
10. Score matrix
11. Negative Binomial where validated
12. Empirical distribution
13. League parity baseline
14. Lineup adjustment
15. Calibration
16. Model agreement
17. Market odds
18. Fair odds
19. EV
20. Sensitivity
21. Robustness
22. Final Odd/Even selection
23. NO BET when requirements are not satisfied
```

---

# 80. CORE RULE

The engine must understand:

```text
Odd/Even is a parity prediction,
not a goal-total prediction.
```

The correct calculation is:

```text
EVEN =
P(0) + P(2) + P(4) + P(6) + ...

ODD =
P(1) + P(3) + P(5) + P(7) + ...
```

with:

```text
0 = EVEN
```

The engine must use the **complete predicted total-goal distribution** whenever possible.

Never make the decision from:

```text
average goals alone
most likely score alone
BTTS alone
Over/Under recommendation alone
1X2 alone
recent Odd/Even streak alone
```

The final architecture must be:

```text
REAL FIXTURE
      ↓
REAL API DATA
      ↓
HOME/AWAY + RECENT GOAL DATA
      ↓
EXPECTED HOME/AWAY GOALS
      ↓
TOTAL GOAL DISTRIBUTION
      ↓
SCORE MATRIX
      ↓
POISSON / NB / EMPIRICAL ENSEMBLE
      ↓
EVEN PROBABILITY
      +
ODD PROBABILITY
      ↓
CALIBRATION
      ↓
MODEL AGREEMENT
      ↓
REAL BOOKMAKER ODDS
      ↓
FAIR ODDS
      ↓
EV
      ↓
ROBUSTNESS / SENSITIVITY
      ↓
QUALITY GATE
      ↓
EVEN / ODD / NO BET
```

**Never force an Odd or Even prediction when the evidence does not produce a meaningful edge.**