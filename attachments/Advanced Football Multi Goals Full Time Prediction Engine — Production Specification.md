# ADVANCED FOOTBALL MULTI GOALS — FULL TIME PREDICTION ENGINE

## Production-Grade Prediction Specification

---

# 1. MARKET DEFINITION

Predict the **range of total goals scored during regular time** in a football match.

The market is:

```text
MULTI GOALS — FULL TIME
```

The target variable is:

```text
REGULAR_TIME_TOTAL_GOALS
=
HOME_GOALS_90
+
AWAY_GOALS_90
```

Only goals scored during:

```text
90 minutes + normal stoppage/injury time
```

are included.

Do NOT include:

- extra time
- penalty shootouts
- shootout penalties
- goals after the end of regular time
- post-match penalties

---

# 2. CORE OBJECTIVE

The engine must estimate:

```text
P(Total Goals ∈ Range 1)
P(Total Goals ∈ Range 2)
P(Total Goals ∈ Range 3)
...
```

The engine must support configurable goal ranges.

Example:

```text
0–1
2–3
4–5
6+
```

Another bookmaker may use:

```text
0–2
3–4
5–6
7+
```

Therefore, the prediction engine must NOT hard-code one bookmaker's ranges.

The market configuration should define:

```text
range_id
minimum_goals
maximum_goals
display_name
odds
```

For open-ended ranges:

```text
minimum_goals = 6
maximum_goals = null
```

meaning:

```text
6 or more
```

---

# 3. EXCLUSIVE RANGE REQUIREMENT

Ranges must not overlap.

Correct:

```text
0–1
2–3
4–5
6+
```

Incorrect:

```text
0–2
2–4
4–6
```

because totals such as 2 and 4 belong to multiple ranges.

The engine must validate the market configuration before prediction.

Every possible total-goal outcome must belong to exactly one range.

---

# 4. RANGE PROBABILITY

The engine must first create:

```text
P(Total Goals = 0)
P(Total Goals = 1)
P(Total Goals = 2)
P(Total Goals = 3)
P(Total Goals = 4)
P(Total Goals = 5)
...
```

Then calculate each range.

For example:

```text
Range: 0–1

P(0–1)
=
P(0) + P(1)
```

For:

```text
Range: 2–3
```

calculate:

```text
P(2–3)
=
P(2) + P(3)
```

For:

```text
Range: 4–5
```

calculate:

```text
P(4–5)
=
P(4) + P(5)
```

For:

```text
Range: 6+
```

calculate:

```text
P(6+)
=
1 - P(0)-P(1)-P(2)-P(3)-P(4)-P(5)
```

---

# 5. ABSOLUTE DATA RULES

Use real available football data only.

NEVER fabricate:

- fixtures
- scores
- team statistics
- player statistics
- odds
- lineups
- injuries
- suspensions
- xG
- xA
- xGA
- tactical information
- goal distributions

The system does NOT have xGA trend data.

Therefore:

```text
DO NOT USE xGA TREND.
```

If xG is not actually available in the API/data:

```text
DO NOT INVENT xG.
DO NOT ESTIMATE MISSING xG AND PRESENT IT AS API DATA.
```

Missing information means:

```text
UNAVAILABLE
```

not:

```text
0
```

Never convert missing statistics into zero.

---

# 6. FIXTURE VALIDATION

Before calculating any prediction, validate:

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
fixture exists
home_team != away_team
fixture has not started
fixture is not cancelled
fixture is not postponed
fixture belongs to the requested competition/season
```

Invalid fixtures must be rejected.

---

# 7. REGULAR-TIME SETTLEMENT

The settlement variable must be:

```text
regular_time_total_goals
```

Example:

```text
90-minute score: 2–1
extra time score: 3–1
```

The Multi Goals result is based on:

```text
2–1 = 3 total goals
```

not:

```text
3–1 = 4 total goals
```

Therefore, if the market range is:

```text
2–3
```

the result is:

```text
WIN
```

Penalty shootouts must never affect settlement.

---

# 8. REQUIRED TEAM DATA

Fetch available:

### Home Team

- total goals scored
- total goals conceded
- matches played
- average goals scored
- average goals conceded
- home goals scored
- home goals conceded
- home matches
- clean sheets
- failed to score
- matches scoring 0
- matches scoring 1
- matches scoring 2
- matches scoring 3+
- total-goal distribution

### Away Team

- total goals scored
- total goals conceded
- matches played
- average goals scored
- average goals conceded
- away goals scored
- away goals conceded
- away matches
- clean sheets
- failed to score
- matches scoring 0
- matches scoring 1
- matches scoring 2
- matches scoring 3+
- total-goal distribution

---

# 9. HOME/AWAY SPLITS

Venue-specific information must receive appropriate weight.

For the home team:

```text
home scoring rate
home conceding rate
home total-goal distribution
home 0-goal frequency
home 1-goal frequency
home 2-goal frequency
home 3+ goal frequency
```

For the away team:

```text
away scoring rate
away conceding rate
away total-goal distribution
away 0-goal frequency
away 1-goal frequency
away 2-goal frequency
away 3+ goal frequency
```

Do not blindly substitute overall team statistics when sufficient home/away data exists.

---

# 10. RECENT FORM

Evaluate:

```text
last 5
last 10
season
home/away
```

where sample size permits.

Track:

```text
goals scored
goals conceded
total goals
```

Also calculate:

```text
P(0 goals)
P(1 goal)
P(2 goals)
P(3 goals)
P(4 goals)
P(5 goals)
P(6+ goals)
```

for the relevant historical samples.

Recent form should be weighted carefully and should not dominate the season baseline because of small samples.

---

# 11. MATCH TOTAL-GOAL DISTRIBUTION

Construct the historical distribution of:

```text
TOTAL MATCH GOALS
```

Example structure:

```text
0
1
2
3
4
5
6
7
8+
```

Calculate frequencies and smoothed probabilities.

The engine should preserve as much information as possible rather than immediately collapsing everything into broad ranges.

---

# 12. EXPECTED GOALS

If actual xG data is available:

```text
λ_home
λ_away
```

may incorporate it.

If actual xG is unavailable, estimate scoring intensity from valid available goal statistics.

Calculate:

```text
λ_total = λ_home + λ_away
```

The model must distinguish between:

```text
observed goals
```

and:

```text
expected goals
```

Do not falsely label an estimated scoring rate as API xG.

---

# 13. HOME EXPECTED GOALS

Estimate:

```text
λ_home
```

using validated combinations of:

- home attacking strength
- away defensive concession
- opponent-adjusted scoring
- recent scoring
- season scoring
- home advantage
- relevant lineup information
- goalkeeper information where available
- schedule/rest effects where validated

Use statistical shrinkage for small samples.

---

# 14. AWAY EXPECTED GOALS

Estimate:

```text
λ_away
```

using:

- away attacking strength
- home defensive concession
- opponent-adjusted scoring
- recent scoring
- season scoring
- away performance
- lineup availability
- goalkeeper information where available
- schedule/rest effects where validated

Again, use shrinkage for small samples.

---

# 15. TOTAL EXPECTED GOALS

Calculate:

```text
λ_total
=
λ_home + λ_away
```

This represents the model's expected total-goal environment.

However:

**Do not use λ_total alone to select the Multi Goals range.**

Two matches can have the same expected goals but substantially different distributions.

---

# 16. POISSON BASELINE

Use a Poisson model as a baseline:

```text
T ~ Poisson(λ_total)
```

Probability of exactly k total goals:

```text
P(T=k)
=
e^(-λ_total) × λ_total^k / k!
```

Calculate sufficiently far into the tail so that the remaining probability mass is negligible.

For example:

```text
k = 0 ... 12+
```

or dynamically continue until:

```text
remaining_probability < configured_tolerance
```

---

# 17. DO NOT TRUNCATE THE DISTRIBUTION INCORRECTLY

If the engine calculates:

```text
P(0)
...
P(8)
```

but ignores meaningful probability above 8, range probabilities can become incorrect.

For an open-ended range such as:

```text
6+
```

calculate the tail correctly:

```text
P(6+)
=
1 - Σ P(0...5)
```

Do not simply assign:

```text
P(6+)=P(6)
```

---

# 18. SCORE MATRIX

Construct:

```text
P(Home Goals = h, Away Goals = a)
```

for sufficiently large:

```text
h
a
```

Example:

```text
0–0
0–1
0–2
...
1–0
1–1
1–2
...
```

Each scoreline produces:

```text
total_goals = h + a
```

Then assign that scoreline to its corresponding Multi Goals range.

---

# 19. RANGE PROBABILITY FROM SCORE MATRIX

For every scoreline:

```text
total = home_goals + away_goals
```

Find the configured range:

```text
range = getRange(total)
```

Then:

```text
range_probability += scoreline_probability
```

At the end:

```text
Σ range_probabilities ≈ 1
```

This is the preferred approach when a validated score matrix exists.

---

# 20. NEGATIVE BINOMIAL MODEL

Test whether goal totals demonstrate overdispersion:

```text
variance > mean
```

If historical validation supports Negative Binomial:

```text
use NB as an ensemble component
```

Calculate:

```text
P(Total = 0)
P(Total = 1)
P(Total = 2)
...
```

Then aggregate into the configured ranges.

Do not automatically use Negative Binomial simply because it is more complex.

Model selection must be based on out-of-sample performance.

---

# 21. EMPIRICAL DISTRIBUTION MODEL

Build an empirical distribution from historical comparable matches.

Example:

```text
P(0)
P(1)
P(2)
P(3)
P(4)
P(5)
P(6+)
```

Use:

- league
- season
- venue
- team strength
- opponent strength
- relevant match context

where sufficient data exists.

Apply smoothing/shrinkage for small samples.

---

# 22. OPPONENT-ADJUSTED GOAL MODEL

Do not simply average:

```text
home goals scored
+
away goals scored
```

Adjust for opponent quality.

Evaluate:

```text
home attacking strength
home defensive strength
away attacking strength
away defensive strength
```

relative to the quality of opponents faced.

This prevents weak-schedule inflation.

---

# 23. TEAM STRENGTH

Where reliable data exists, incorporate:

```text
team strength
Elo/strength rating
league position
performance against strong opponents
performance against comparable opponents
```

Team strength should influence the expected scoring distribution.

It should not directly determine the Multi Goals range.

---

# 24. GOAL ENVIRONMENT

Classify the projected match environment:

```text
VERY LOW
LOW
MEDIUM
HIGH
VERY HIGH
```

based on:

- expected total goals
- scoring rates
- conceding rates
- total-goal distribution
- recent goal environment
- home/away environment
- opponent-adjusted rates

Use this as a diagnostic feature, not as the final prediction.

---

# 25. BTTS INTERACTION

Use BTTS as a supporting variable.

A BTTS projection can influence the score distribution because it changes the relative likelihood of scorelines such as:

```text
1–1
2–1
1–2
2–2
3–1
1–3
```

However:

```text
BTTS Yes
```

does NOT automatically imply a higher Multi Goals range.

Likewise:

```text
BTTS No
```

does not automatically imply a low range.

Use the actual joint score distribution.

---

# 26. OVER/UNDER CONSISTENCY

The Multi Goals engine should remain mathematically consistent with the O/U engine.

If the distribution says:

```text
P(0)=10%
P(1)=18%
P(2)=27%
P(3)=22%
P(4)=13%
P(5)=6%
P(6+)=4%
```

then:

```text
P(0–1) = 28%
P(2–3) = 49%
P(4–5) = 19%
P(6+) = 4%
```

These are illustrative numbers only.

The same underlying distribution should produce consistent O/U and Multi Goals probabilities.

---

# 27. CORRECT SCORE CONSISTENCY

The correct-score engine provides an additional consistency check.

For example:

```text
1–0 → 1 total
1–1 → 2 total
2–1 → 3 total
2–2 → 4 total
3–1 → 4 total
3–2 → 5 total
```

The Multi Goals probabilities should be generated by aggregating scoreline probabilities.

Do NOT choose the range based only on the single most likely correct score.

---

# 28. MOST LIKELY SCORE ≠ MOST LIKELY RANGE

Incorrect:

```text
Most likely score = 1–1
Therefore Multi Goals = 2–3
```

This is incomplete.

The engine must calculate:

```text
P(0)
+
P(1)
+
P(2)
+
P(3)
+
...
```

and aggregate every scoreline belonging to every range.

A range may be the most likely even when none of its individual scorelines is the single most likely score.

---

# 29. GOAL TIMING

If reliable goal-timing data exists, use:

```text
first-half goals
second-half goals
early scoring
late scoring
scoring/conceding periods
```

to refine the underlying goal distribution.

Do not convert goal-timing patterns directly into a Multi Goals range without historical validation.

---

# 30. LINEUPS

Where real information is available, evaluate:

- confirmed lineup
- expected lineup
- attacking absences
- defensive absences
- suspensions
- goalkeeper changes
- rotation
- expected minutes
- important player availability

Recalculate the goal distribution if lineup information materially changes scoring expectations.

---

# 31. MATCH CONTEXT

Where reliable evidence exists, evaluate:

- league match
- cup match
- knockout match
- first leg
- second leg
- relegation situation
- title race
- rotation
- fixture congestion
- rest days
- schedule density

Do not make subjective narrative adjustments.

Any context adjustment must be based on a validated historical relationship.

---

# 32. H2H

H2H can be used as a low-weight supporting feature.

Evaluate:

```text
H2H total goals
H2H goal distribution
```

but prioritize:

```text
current team strength
current season
recent form
home/away performance
opponent-adjusted performance
```

over old H2H data.

---

# 33. LEAGUE BASELINE

Calculate league-level:

```text
average goals
goal distribution
0-goal frequency
1-goal frequency
2-goal frequency
3-goal frequency
4-goal frequency
5+ frequency
```

Use:

```text
same league
same season
```

when enough data exists.

Apply shrinkage for small samples.

---

# 34. MARKET RANGES

The engine must accept bookmaker-specific ranges dynamically.

Example configuration:

```json
{
  "market": "multi_goals",
  "period": "full_time",
  "ranges": [
    {
      "id": "0_1",
      "min": 0,
      "max": 1
    },
    {
      "id": "2_3",
      "min": 2,
      "max": 3
    },
    {
      "id": "4_5",
      "min": 4,
      "max": 5
    },
    {
      "id": "6_plus",
      "min": 6,
      "max": null
    }
  ]
}
```

The engine must work with different valid configurations.

---

# 35. RANGE VALIDATION

Before prediction:

```text
validateRanges()
```

Check:

```text
no overlaps
no gaps
minimum >= 0
minimum <= maximum
ranges sorted
open-ended range only where appropriate
all possible goal totals covered
```

If invalid:

```text
STATUS = INVALID_MARKET_CONFIGURATION
```

Do not generate a prediction.

---

# 36. MODEL ENSEMBLE

Use an ensemble containing:

```text
1. Total-Goal Poisson Model
2. Score-Matrix Model
3. Negative Binomial Model
4. Empirical Goal Distribution
5. Home/Away Goal Model
6. Opponent-Adjusted Model
7. Recent Goal Distribution Model
8. League Baseline Model
9. Team Strength Model
10. Market Validation Model
```

---

# 37. STARTING ENSEMBLE WEIGHTS

Use as initial weights:

```text
20% Total-Goal Poisson
18% Score-Matrix Model
12% Negative Binomial
12% Home/Away Goal Model
10% Opponent-Adjusted Model
10% Empirical Distribution
7% Recent Goal Distribution
4% League Baseline
3% Team Strength
4% Market Validation
```

Total:

```text
100%
```

These are starting weights.

They must be optimized using historical walk-forward validation.

---

# 38. ADAPTIVE WEIGHTS

Weights may vary based on:

```text
sample size
data completeness
league
model calibration
recent out-of-sample performance
model stability
```

Do not dynamically change weights based on a single match.

---

# 39. BAYESIAN SHRINKAGE

Apply shrinkage to:

```text
recent goal frequencies
team goal distributions
league distributions
H2H distributions
```

especially when sample size is small.

For example:

```text
Team has only 5 recent matches
```

should not override:

```text
30+ season/comparable matches
```

without statistical justification.

---

# 40. PROBABILITY CALIBRATION

Calibrate the probability of each range.

Use:

```text
Brier Score
Log Loss
Calibration Curve
Expected Calibration Error
Reliability Diagram
```

For multi-class range prediction, evaluate:

```text
multiclass Brier score
multiclass log loss
class-specific calibration
```

where appropriate.

Potential calibration methods:

```text
Isotonic Regression
Platt-style calibration
Temperature Scaling
Dirichlet calibration
```

Select based on out-of-sample validation.

---

# 41. MULTI-CLASS PROBABILITY VALIDATION

If ranges are:

```text
0–1
2–3
4–5
6+
```

the final probabilities must satisfy:

```text
P(0–1)
+
P(2–3)
+
P(4–5)
+
P(6+)
=
1
```

within numerical tolerance.

If not:

```text
RECALCULATE
```

Do not return invalid probabilities.

---

# 42. MODEL AGREEMENT

Measure agreement between models.

Example:

```text
Poisson → 2–3
Score Matrix → 2–3
NB → 2–3
Empirical → 2–3
Home/Away → 2–3
```

This represents strong directional agreement.

But if:

```text
Poisson → 2–3
Score Matrix → 0–1
NB → 4–5
Empirical → 2–3
```

model disagreement is high.

Reduce confidence.

---

# 43. RANGE ENTROPY

Calculate multi-class entropy:

```text
H =
-Σ p_i log2(p_i)
```

where:

```text
p_i = probability of each Multi Goals range
```

Higher entropy means the probability is spread across several ranges.

Lower entropy means probability is concentrated.

Use this as an uncertainty measure.

---

# 44. RANGE CONCENTRATION

Calculate:

```text
max_range_probability
second_range_probability
```

and:

```text
range_margin =
top_probability - second_probability
```

Example:

```text
2–3 = 51%
0–1 = 24%
4–5 = 18%
6+ = 7%
```

The top range has:

```text
51% - 24% = 27 percentage-point margin
```

Use this as a confidence feature, not as the sole decision criterion.

---

# 45. SENSITIVITY ANALYSIS

Recalculate range probabilities under:

```text
λ_total - 10%
λ_total
λ_total + 10%
```

Also test:

```text
λ_home ± 10%
λ_away ± 10%
```

Track whether the selected range changes.

Example:

```text
Baseline → 2–3
-10%      → 2–3
+10%      → 2–3
```

This indicates better robustness.

If:

```text
Baseline → 2–3
-10%      → 0–1
+10%      → 4–5
```

then:

```text
robustness = LOW
```

---

# 46. DISTRIBUTION PERTURBATION

Perturb the goal distribution within statistically reasonable limits.

Test changes to:

```text
P(0)
P(1)
P(2)
P(3)
P(4)
P(5)
P(6+)
```

Determine whether the selected range remains stable.

This protects against overconfidence from a fragile distribution.

---

# 47. DATA QUALITY SCORE

Create:

```text
data_quality = 0–100
```

Factors:

```text
fixture validity
sample size
home/away data
recent data
goal distribution completeness
lineup certainty
odds freshness
data freshness
statistical completeness
```

Missing important data reduces the score.

---

# 48. MODEL STABILITY

Track:

```text
previous prediction
current prediction
probability movement
```

If the prediction changes substantially because of new information:

```text
recalculate
```

and record:

```text
prediction_revision_reason
```

Do not silently overwrite the original prediction.

---

# 49. MARKET ODDS

If bookmaker Multi Goals odds exist, fetch:

```text
range
bookmaker
odds
timestamp
```

Example:

```text
0–1 → 3.20
2–3 → 2.05
4–5 → 3.10
6+  → 7.50
```

These are examples only.

---

# 50. IMPLIED PROBABILITY

For decimal odds:

```text
P_raw =
1 / odds
```

Calculate separately for each range.

Because bookmaker margin exists, calculate normalized probabilities when appropriate:

```text
P_market_i =
(1 / odds_i)
/
Σ(1 / odds_j)
```

---

# 51. FAIR ODDS

For each range:

```text
fair_odds =
1 / model_probability
```

Example:

```text
Model P(2–3) = 0.48
```

then:

```text
Fair odds = 1 / 0.48
           = 2.08
```

This is a mathematical fair-price estimate, not a guarantee.

---

# 52. EDGE

Calculate:

```text
edge =
model_probability
-
market_probability
```

for each range.

Store:

```text
edge_0_1
edge_2_3
edge_4_5
edge_6_plus
```

where applicable.

---

# 53. EXPECTED VALUE

For decimal odds:

```text
EV =
model_probability × bookmaker_odds - 1
```

Calculate:

```text
EV_range
```

for every available range.

Do not select a range simply because it has the highest probability.

Price and probability must both be considered.

---

# 54. VALUE VS PROBABILITY

The engine must distinguish:

```text
MOST LIKELY RANGE
```

from:

```text
BEST VALUE RANGE
```

Example:

```text
0–1 → 35%
2–3 → 45%
4–5 → 15%
6+  → 5%
```

The most probable range is:

```text
2–3
```

But if bookmaker pricing makes another range materially mispriced, the value calculation may differ.

The system must report both separately.

---

# 55. LINE SHOPPING

If multiple bookmakers are available:

```text
Bookmaker A
Bookmaker B
Bookmaker C
...
```

compare prices for the same range.

Store:

```text
best_available_odds
best_bookmaker
market_average
market_probability
```

Never use stale odds.

---

# 56. ODDS MOVEMENT

Track:

```text
opening odds
current odds
previous odds
```

Calculate:

```text
odds movement
implied probability movement
```

If the market moves materially:

```text
recalculate EV
```

The underlying probability model should not be changed merely to follow the market.

---

# 57. NO-BET CONDITIONS

Return:

```text
NO BET
```

when:

- model probability is insufficient
- EV is negative
- data quality is poor
- model disagreement is high
- range is unstable
- probability is widely distributed
- sample size is insufficient
- odds are stale
- market price does not provide sufficient value
- lineup uncertainty materially affects the model
- fixture data is invalid
- market ranges are invalid

---

# 58. DO NOT FORCE A RANGE

The engine must be allowed to say:

```text
NO BET
```

even if one range technically has the highest probability.

For example:

```text
0–1 → 27%
2–3 → 31%
4–5 → 25%
6+  → 17%
```

Although:

```text
2–3
```

is the largest individual range, the distribution is relatively dispersed.

If configured confidence/value requirements are not met:

```text
NO BET
```

---

# 59. PROBABILITY THRESHOLDS

Use configurable thresholds rather than hard-coded assumptions.

Example starting values:

```text
minimum_probability = 0.40
minimum_EV = 0.04
minimum_data_quality = 70
minimum_model_agreement = 65
minimum_robustness = 60
```

These are starting parameters only.

They must be optimized through historical testing.

---

# 60. CONFIDENCE SCORE

Create:

```text
confidence = 0–100
```

based on:

```text
probability strength
range margin
model agreement
data quality
calibration
sample size
robustness
market efficiency
odds quality
distribution concentration
```

Do not simply set:

```text
confidence = probability × 100
```

---

# 61. RISK FLAGS

Generate flags such as:

```text
LOW_SAMPLE_SIZE
LOW_DATA_QUALITY
HIGH_MODEL_DISAGREEMENT
HIGH_RANGE_ENTROPY
LOW_RANGE_MARGIN
UNSTABLE_RANGE
LINEUP_UNCERTAINTY
STALE_ODDS
HIGH_ODDS_VOLATILITY
WEAK_MARKET_EDGE
LOW_EV
EXTREME_TAIL_RANGE
```

---

# 62. MOST LIKELY RANGE

Return:

```text
most_likely_range
most_likely_probability
```

regardless of whether it qualifies as a bet.

Example:

```text
Most Likely:
2–3 Goals

Probability:
46%
```

Then separately:

```text
Bet Status:
NO BET
```

if the value/confidence requirements are not met.

This distinction is important.

---

# 63. TOP RANGE ALTERNATIVES

Return the top three ranges:

```text
1. 2–3 → 46%
2. 0–1 → 29%
3. 4–5 → 19%
```

with the remaining tail:

```text
6+ → 6%
```

This provides transparency.

---

# 64. GOAL DISTRIBUTION OUTPUT

Always preserve the underlying distribution.

Example:

```json
{
  "0": 0.10,
  "1": 0.18,
  "2": 0.27,
  "3": 0.22,
  "4": 0.13,
  "5": 0.06,
  "6_plus": 0.04
}
```

Then aggregate into ranges.

This makes the Multi Goals market explainable.

---

# 65. RANGE AGGREGATION ALGORITHM

Conceptually:

```text
for each goal_total:
    probability = goal_distribution[goal_total]

    matching_range =
        find configured range containing goal_total

    range_probability[matching_range] += probability
```

After aggregation:

```text
normalize(range_probability)
```

only if required due to numerical rounding.

Do NOT distort the distribution through arbitrary normalization.

---

# 66. RANGE COVERAGE VALIDATION

Before producing results:

```text
for every goal_total:
    exactly one range must contain goal_total
```

If:

```text
goal_total = 3
```

and two ranges contain 3:

```text
INVALID
```

If no range contains 3:

```text
INVALID
```

This prevents settlement errors.

---

# 67. CROSS-MARKET VALIDATION

Check consistency against:

```text
Over/Under
BTTS
1X2
Double Chance
Correct Score
Team To Score
Handicap
Odd/Even
```

Examples:

The Multi Goals distribution should be compatible with:

```text
Over 1.5
Over 2.5
Over 3.5
Under 2.5
Under 3.5
```

and:

```text
Odd/Even
```

because all are derived from the same underlying total-goal distribution.

---

# 68. ODD/EVEN CONSISTENCY

From the same distribution:

```text
EVEN =
P(0)+P(2)+P(4)+P(6)+...
```

and:

```text
ODD =
P(1)+P(3)+P(5)+P(7)+...
```

The Multi Goals engine and Odd/Even engine should not produce contradictory probabilities from the same score distribution.

---

# 69. CORRECT-SCORE CONSISTENCY

From the same score matrix:

```text
Multi Goals range
=
sum of all scoreline probabilities whose total belongs to that range
```

This creates one coherent probability system.

---

# 70. SHARED SMARTMATCHPICK DATASET

Do not build a completely isolated API pipeline.

Use:

```text
API-Football
      ↓
SHARED MATCH DATA
      ↓
┌────────┬────────┬──────────────┐
│ BTTS   │ O/U    │ 1X2          │
├────────┼────────┼──────────────┤
│ Score  │ Handicap │ Corners    │
├────────┼────────┼──────────────┤
│ Odd/Even │ Multi Goals │ etc. │
└────────┴────────┴──────────────┘
```

Reuse:

- fixture data
- team data
- recent matches
- standings
- home/away statistics
- squad data
- lineup data
- odds
- goal distributions
- score matrices

where appropriate.

---

# 71. API EFFICIENCY

Do not make duplicate requests for information already available.

If the O/U engine already fetched:

```text
team recent matches
```

the Multi Goals engine should consume the cached/shared result.

Likewise, if Correct Score already generated:

```text
score matrix
```

Multi Goals should aggregate it instead of recalculating the same information unnecessarily.

---

# 72. CACHING

Cache:

```text
fixture
team
league
season
recent fixtures
standings
home/away statistics
squad
lineups
odds
goal distributions
score matrices
prediction outputs
```

Use timestamps and expiration rules appropriate to each data type.

---

# 73. TWO-STAGE PIPELINE

### Stage 1 — Fast Filter

Calculate:

```text
basic goal environment
expected total goals
basic distribution
data quality
range probabilities
```

Reject fixtures with clearly inadequate data.

### Stage 2 — Advanced Prediction

For candidates:

```text
full score matrix
Poisson
Negative Binomial
empirical distribution
opponent adjustment
lineup adjustment
market analysis
calibration
sensitivity
robustness
EV
```

This reduces unnecessary computation.

---

# 74. PREDICTION LOCK

At kickoff:

```text
prediction_status = LOCKED
```

Store the final pre-match values:

```text
fixture_id
market
range_configuration
predicted_range
all_range_probabilities
goal_distribution
expected_home_goals
expected_away_goals
expected_total_goals
market_odds
fair_odds
edge
EV
confidence
data_quality
model_agreement
robustness
model_version
prediction_timestamp
```

Never silently change the locked prediction after kickoff.

---

# 75. POST-MATCH SETTLEMENT

After the match:

```text
home_goals_90
away_goals_90
```

Calculate:

```text
actual_total =
home_goals_90 + away_goals_90
```

Then:

```text
settled_range =
findRange(actual_total)
```

Example:

```text
Final normal-time score:
2–1

Total:
3

Ranges:
0–1
2–3
4–5
6+

Settlement:
2–3
```

---

# 76. EXTRA-TIME PROTECTION

If the match goes to extra time:

```text
DO NOT MODIFY regular-time total
```

Example:

```text
90 minutes:
1–1

Extra time:
2–1
```

The Multi Goals result remains:

```text
2 total goals
```

not:

```text
3 total goals
```

Penalty shootout goals are ignored completely.

---

# 77. PERFORMANCE TRACKING

Track:

```text
overall hit rate
range-specific hit rate
Brier score
log loss
ROI
yield
average odds
average model probability
average EV
closing-line value
```

Break down by:

```text
league
season
range
odds range
probability bucket
model version
goal environment
home/away
```

---

# 78. RANGE-SPECIFIC PERFORMANCE

Track separately:

```text
0–1 performance
2–3 performance
4–5 performance
6+ performance
```

because tail ranges may have very different calibration and sample sizes.

Do not assume:

```text
all ranges perform equally.
```

---

# 79. PROBABILITY CALIBRATION BUCKETS

Create buckets such as:

```text
30–35%
35–40%
40–45%
45–50%
50–55%
55–60%
60%+
```

For every range calculate:

```text
predicted probability
actual frequency
sample size
Brier score
log loss
ROI
```

This determines whether the model's probabilities are trustworthy.

---

# 80. LEAGUE-SPECIFIC CALIBRATION

Where sufficient data exists:

```text
calibrate by league
```

but avoid overfitting small competitions.

For small samples:

```text
hierarchical/Bayesian shrinkage
```

should pull league-specific estimates toward a broader baseline.

---

# 81. MODEL VERSIONING

Every prediction must store:

```text
multi_goals_model_version
goal_model_version
calibration_version
range_configuration_version
data_timestamp
prediction_timestamp
```

Example:

```text
multi-goals-v1.0
```

If the range configuration changes, it should have a new configuration version.

---

# 82. DATABASE STRUCTURE

Recommended fields:

```text
fixture_id
market_type
period
range_config_id
predicted_range
probability_by_range
goal_distribution
lambda_home
lambda_away
lambda_total
fair_odds_by_range
market_odds_by_range
edge_by_range
ev_by_range
model_agreement
data_quality
confidence
robustness
entropy
risk_flags
prediction_status
prediction_timestamp
model_version
actual_home_goals_90
actual_away_goals_90
actual_total_goals
settled_range
settlement_status
```

---

# 83. HUMAN-READABLE OUTPUT

Example:

```text
MULTI GOALS — FULL TIME

Fixture:
Home Team vs Away Team

Predicted Range:
2–3 Goals

Range Probabilities:
0–1 Goals → 28%
2–3 Goals → 46%
4–5 Goals → 20%
6+ Goals → 6%

Expected Goals:
Home → 1.18
Away → 0.97
Total → 2.15

Most Likely Range:
2–3 Goals

Fair Odds:
2–3 → 2.17

Market Odds:
2–3 → 2.35

Edge:
+7.0 percentage points

EV:
+8.1%

Model Agreement:
86%

Data Quality:
92%

Robustness:
81%

Confidence:
84%

Risk:
Medium

Status:
QUALIFIED
```

All numbers above are illustrative only.

---

# 84. JSON OUTPUT

Return structured output:

```json
{
  "fixture": {
    "fixture_id": 123456,
    "home_team": "Home Team",
    "away_team": "Away Team",
    "league": "League",
    "season": 2026,
    "kickoff": "2026-09-16T18:00:00Z"
  },

  "market": {
    "type": "multi_goals",
    "period": "full_time",
    "settlement": "regular_time_only"
  },

  "ranges": [
    {
      "id": "0_1",
      "min": 0,
      "max": 1,
      "probability": 0.28,
      "fair_odds": 3.57
    },
    {
      "id": "2_3",
      "min": 2,
      "max": 3,
      "probability": 0.46,
      "fair_odds": 2.17
    },
    {
      "id": "4_5",
      "min": 4,
      "max": 5,
      "probability": 0.20,
      "fair_odds": 5.00
    },
    {
      "id": "6_plus",
      "min": 6,
      "max": null,
      "probability": 0.06,
      "fair_odds": 16.67
    }
  ],

  "prediction": {
    "most_likely_range": "2_3",
    "selection": "2_3",
    "status": "QUALIFIED"
  },

  "goal_expectancy": {
    "home": 1.18,
    "away": 0.97,
    "total": 2.15
  },

  "goal_distribution": {
    "0": 0.10,
    "1": 0.18,
    "2": 0.27,
    "3": 0.19,
    "4": 0.13,
    "5": 0.07,
    "6_plus": 0.06
  },

  "market": {
    "selected_range": "2_3",
    "market_odds": 2.35,
    "fair_odds": 2.17,
    "edge": 0.07,
    "ev": 0.081
  },

  "quality": {
    "model_agreement": 86,
    "data_quality": 92,
    "robustness": 81,
    "confidence": 84,
    "entropy": 1.72
  },

  "risk_flags": [],

  "model_version": "multi-goals-v1.0"
}
```

The values in this JSON are examples only.

---

# 85. FINAL VALIDATION CHECKS

Before returning a prediction, verify:

### Probability validity

```text
0 <= P(range) <= 1
```

### Probability sum

```text
Σ P(range) ≈ 1
```

### Goal distribution

```text
Σ P(total goals) ≈ 1
```

### Score matrix

```text
ΣΣ P(home, away) ≈ 1
```

### Range coverage

```text
every possible goal total belongs to exactly one range
```

### Settlement

```text
regular time only
```

If any validation fails:

```text
RECALCULATE
```

or:

```text
NO BET / INVALID DATA
```

Do not return an invalid prediction.

---

# 86. IMPORTANT DISTINCTION

The engine must separately report:

```text
MOST LIKELY RANGE
```

and:

```text
BEST VALUE RANGE
```

They are not necessarily the same.

For example:

```text
Most likely:
2–3 Goals

Best available value:
4–5 Goals
```

if the market price sufficiently compensates for the lower probability.

Do not hide this distinction.

---

# 87. FINAL DECISION HIERARCHY

Use this order:

```text
1. Correct fixture
2. Correct competition
3. Correct settlement period
4. Real data validation
5. Market-range validation
6. Home/away scoring data
7. Recent goal data
8. Season goal data
9. Opponent-adjusted strength
10. Expected home goals
11. Expected away goals
12. Expected total goals
13. Score matrix
14. Poisson model
15. Negative Binomial where validated
16. Empirical distribution
17. League baseline
18. Lineup adjustment
19. Goal distribution aggregation
20. Model calibration
21. Model agreement
22. Market odds
23. Fair odds
24. Edge
25. EV
26. Sensitivity
27. Robustness
28. Data quality
29. Confidence
30. Final range
31. NO BET when requirements are not satisfied
```

---

# 88. CORE SMARTMATCHPICK ARCHITECTURE

The final system should work as:

```text
                 API-FOOTBALL
                      ↓
              SHARED MATCH DATA
                      ↓
        ┌─────────────┴─────────────┐
        ↓                           ↓
 TEAM/FORM DATA                MARKET ODDS
        ↓                           ↓
 HOME/AWAY GOALS             MULTI-GOAL RANGES
        ↓                           ↓
 EXPECTED HOME GOALS         BOOKMAKER PRICES
        ↓                           ↓
 EXPECTED AWAY GOALS                │
        ↓                           │
 EXPECTED TOTAL GOALS               │
        ↓                           │
 ┌──────┴───────────────┐           │
 ↓                      ↓           ↓
POISSON             SCORE MATRIX    MARKET
 ↓                      ↓           ↓
NB MODEL            EMPIRICAL       IMPLIED
 ↓                      ↓           ↓
 └──────────────┬───────┴───────────┘
                ↓
        COMPLETE GOAL DISTRIBUTION
                ↓
       AGGREGATE INTO RANGES
                ↓
      ┌─────────┴─────────┐
      ↓                   ↓
MOST LIKELY RANGE     MARKET VALUE
      ↓                   ↓
PROBABILITY            FAIR ODDS
                          ↓
                         EV
                          ↓
              CALIBRATION + AGREEMENT
                          ↓
                SENSITIVITY + ROBUSTNESS
                          ↓
                    QUALITY GATE
                          ↓
             RANGE / NO BET
                          ↓
                 PREDICTION LOCK
                          ↓
              NORMAL-TIME SETTLEMENT
                          ↓
                 PERFORMANCE TRACKING
```

---

# 89. CORE REQUIREMENT

The Multi Goals engine must **not** simply predict:

```text
Expected Goals = 2.4
Therefore → 2–3 Goals
```

That is insufficient.

It must model:

```text
P(0)
P(1)
P(2)
P(3)
P(4)
P(5)
P(6)
...
```

and then aggregate those probabilities according to the actual market ranges.

For example:

```text
0–1 = P(0) + P(1)

2–3 = P(2) + P(3)

4–5 = P(4) + P(5)

6+ = P(6) + P(7) + P(8) + ...
```

The final prediction should therefore be based on the **complete regular-time goal distribution**, not merely the average expected goals, recent streaks, or the most likely correct score.

**Real data → expected scoring rates → complete goal distribution → score matrix → range aggregation → calibration → market comparison → EV → robustness → qualified range or NO BET.**