# ADVANCED FOOTBALL DOUBLE CHANCE PREDICTION ENGINE
## Full Production Specification

---

# 1. OBJECTIVE

Build a production-grade football **Double Chance Prediction Engine** that estimates the probability of:

```text
1X = Home Win OR Draw

X2 = Draw OR Away Win

12 = Home Win OR Away Win
```

The engine must calculate:

```text
P(Home Win)
P(Draw)
P(Away Win)

P(1X)
P(X2)
P(12)
```

The fundamental mathematical relationship is:

```text
P(1X) = P(Home Win) + P(Draw)

P(X2) = P(Draw) + P(Away Win)

P(12) = P(Home Win) + P(Away Win)
```

Because the three 1X2 outcomes are mutually exclusive:

```text
P(Home Win) + P(Draw) + P(Away Win) ≈ 1.00
```

Therefore:

```text
P(1X) = 1 - P(Away Win)

P(X2) = 1 - P(Home Win)

P(12) = 1 - P(Draw)
```

However, these probabilities must come from a properly calibrated underlying match-outcome model.

Do NOT simply select the double-chance outcome associated with the largest raw probability.

The system must determine whether the **market price provides sufficient value**.

---

# 2. SUPPORTED MARKETS

The engine must support:

### Standard Double Chance

```text
1X
X2
12
```

### Related markets for validation

- Home Win
- Draw
- Away Win
- Draw No Bet
- Asian Handicap
- Correct Score
- Match Goals
- BTTS
- Team to Score

The primary prediction remains Double Chance.

---

# 3. ABSOLUTE DATA INTEGRITY RULES

Use only real available data.

Never fabricate:

- fixtures
- team statistics
- standings
- odds
- lineups
- injuries
- suspensions
- player statistics
- referee information
- historical results
- xG
- xGA
- expected goals
- tactical statistics

If xG is not actually available:

```text
xG = unavailable
```

Do NOT estimate fake xG.

The system must never use xGA trend data because it is not available in the user's dataset.

Missing data must remain:

```text
null
```

or:

```text
unavailable
```

It must never silently become zero.

---

# 4. FIXTURE VALIDATION

Before prediction verify:

```text
fixture_id
league_id
season
home_team_id
away_team_id
fixture_date
kickoff_time
fixture_status
```

Confirm:

```text
home_team ≠ away_team
fixture is upcoming
fixture is valid
fixture has not been cancelled
fixture is not duplicated
```

If fixture validation fails:

```text
NO BET
```

---

# 5. CORE DOUBLE-CHANCE PRINCIPLE

Double Chance is fundamentally a **risk-coverage market**.

The engine must answer:

> What is the probability that the selected two outcomes cover the match?

For example:

### 1X

The only losing outcome is:

```text
Away Win
```

Therefore:

```text
P(1X) = 1 - P(Away Win)
```

### X2

The only losing outcome is:

```text
Home Win
```

Therefore:

```text
P(X2) = 1 - P(Home Win)
```

### 12

The only losing outcome is:

```text
Draw
```

Therefore:

```text
P(12) = 1 - P(Draw)
```

This relationship must remain mathematically consistent with the underlying 1X2 model.

---

# 6. TEAM STRENGTH

Build a current team-strength representation.

Consider available data for:

- season performance
- points per match
- wins
- draws
- losses
- goals scored
- goals conceded
- home performance
- away performance
- recent form
- opponent strength
- league position

Calculate:

```text
home_strength
away_strength
strength_difference
```

Do not rely exclusively on league position.

---

# 7. HOME TEAM HOME PERFORMANCE

For the home team calculate:

```text
home_win_rate
home_draw_rate
home_loss_rate

home_points_per_match
home_goals_scored
home_goals_conceded

home_clean_sheet_rate
home_failed_to_score_rate
```

Use actual home fixtures only.

Do not mix away results into home-specific statistics unless explicitly used as a separate season-strength feature.

---

# 8. AWAY TEAM AWAY PERFORMANCE

For the away team calculate:

```text
away_win_rate
away_draw_rate
away_loss_rate

away_points_per_match
away_goals_scored
away_goals_conceded

away_clean_sheet_rate
away_failed_to_score_rate
```

Use actual away fixtures.

---

# 9. RECENT FORM

Calculate:

```text
Last 5
Last 10
Season
```

For each team.

Record:

```text
wins
draws
losses
goals scored
goals conceded
points
```

Also calculate:

```text
points_per_match
win_rate
draw_rate
loss_rate
```

Recent form must be opponent-adjusted.

---

# 10. OPPONENT-ADJUSTED FORM

Do not treat:

```text
3 wins against weak teams
```

as equivalent to:

```text
3 wins against elite teams
```

Assign opponent-strength context.

Measure performance against:

```text
strong opponents
mid-level opponents
weak opponents
```

where sufficient historical data exists.

Use shrinkage when sample sizes are small.

---

# 11. HOME ADVANTAGE

Model home advantage using historical league-level and team-level data.

Estimate:

```text
home_advantage
```

using actual historical results.

Do not use one universal fixed home advantage across every league.

League-specific calibration is preferred.

---

# 12. ATTACKING STRENGTH

Calculate:

```text
home_attack_strength
away_attack_strength
```

using available:

- goals scored
- scoring frequency
- multi-goal frequency
- home/away scoring
- recent scoring
- opponent-adjusted scoring

If actual xG exists, it may be used.

If xG does not exist:

```text
DO NOT CREATE IT
```

---

# 13. DEFENSIVE STRENGTH

Calculate:

```text
home_defensive_strength
away_defensive_strength
```

using:

- goals conceded
- clean sheets
- conceded 1+
- conceded 2+
- home/away splits
- recent defensive results
- opponent-adjusted defensive performance

Do not fabricate xGA.

---

# 14. GOAL EXPECTANCY

Estimate:

```text
λ_home
λ_away
```

from actual available scoring/defensive information.

Potential inputs:

```text
home scoring strength
away defensive weakness

away scoring strength
home defensive weakness

home advantage
recent form
opponent strength
```

If actual API xG exists, incorporate it.

If not:

```text
xG contribution = excluded
```

---

# 15. POISSON SCORE MATRIX

Use the expected scoring rates to construct:

```text
P(Home Goals = h)
P(Away Goals = a)
```

using:

```text
P(X=k) = (λ^k × e^-λ) / k!
```

Then create the full score matrix.

Example structure:

```text
        Away
        0     1     2     3     4
Home 0
     1
     2
     3
     4
```

Each cell represents:

```text
P(Home goals = h AND Away goals = a)
```

---

# 16. 1X2 PROBABILITIES FROM SCORE MATRIX

Calculate:

### Home Win

Sum every cell where:

```text
Home Goals > Away Goals
```

### Draw

Sum every cell where:

```text
Home Goals = Away Goals
```

### Away Win

Sum every cell where:

```text
Home Goals < Away Goals
```

Then verify:

```text
P(Home)
+
P(Draw)
+
P(Away)
≈ 100%
```

---

# 17. DRAW MODEL

Draw probability is critical for Double Chance.

Calculate:

```text
P(0-0)
P(1-1)
P(2-2)
P(3-3)
...
```

Then:

```text
P(Draw)
=
Σ P(Home Goals = k, Away Goals = k)
```

The model must specifically monitor:

```text
draw_probability
```

rather than treating draws as residual noise.

---

# 18. DRAW RISK MODEL

Identify fixtures with elevated draw probability.

Indicators can include:

- similar team strength
- similar expected scoring rates
- low scoring environment
- low attacking separation
- strong defensive teams
- high historical draw rate
- recent draw frequency
- balanced home/away performance

Do not assume any individual indicator guarantees a draw.

---

# 19. UPSET RISK

Measure:

```text
P(Home Win)
P(Away Win)
```

relative to:

```text
team strength
market expectation
home advantage
recent performance
goal expectancy
```

Identify:

```text
favorite vulnerability
underdog strength
```

This is particularly important for selecting between:

```text
1X
X2
```

---

# 20. DOUBLE-CHANCE COVERAGE

Calculate:

```text
DC_1X = P(Home Win) + P(Draw)

DC_X2 = P(Draw) + P(Away Win)

DC_12 = P(Home Win) + P(Away Win)
```

Also calculate:

```text
failure_probability_1X = P(Away Win)

failure_probability_X2 = P(Home Win)

failure_probability_12 = P(Draw)
```

The failure probability is often more informative than the raw coverage probability.

---

# 21. DOUBLE-CHANCE RISK RANKING

Rank markets by:

```text
coverage probability
failure probability
market price
EV
model agreement
robustness
```

Example:

```text
1X = 83%
X2 = 68%
12 = 79%
```

The system must not automatically select 1X.

It must compare price.

---

# 22. MARKET ODDS

Fetch real Double Chance odds where available.

Store:

```text
bookmaker
market
selection
odds
line
timestamp
```

Examples:

```text
1X @ 1.28
X2 @ 1.65
12 @ 1.42
```

These are examples only.

Never fabricate odds.

---

# 23. IMPLIED PROBABILITY

For standard decimal odds:

```text
Implied Probability = 1 / Odds
```

Example:

```text
Odds = 1.50

Implied probability =
1 / 1.50
=
66.67%
```

Compare:

```text
model probability
vs
vig-adjusted market probability
```

where possible.

---

# 24. FAIR ODDS

Calculate:

```text
Fair Odds = 1 / Model Probability
```

Example:

```text
Model probability = 80%

Fair odds = 1.25
```

If the market offers:

```text
1.40
```

the model may identify value.

---

# 25. EXPECTED VALUE

For standard Double Chance:

```text
EV =
(P_win × profit)
-
(P_loss × stake)
```

For a one-unit stake:

```text
EV =
P × (Odds - 1)
-
(1 - P)
```

Equivalent:

```text
EV =
P × Odds - 1
```

A positive EV is required for a value recommendation unless the system is explicitly configured for probability-only selections.

---

# 26. EDGE

Calculate:

```text
edge =
model_probability - market_implied_probability
```

Prefer comparing against vig-adjusted market probability where available.

Example:

```text
Model = 82%
Market = 76%

Edge = +6 percentage points
```

---

# 27. DOUBLE-CHANCE PRICE PROBLEM

Do not confuse:

```text
high probability
```

with:

```text
good bet
```

Example:

```text
1X probability = 90%
odds = 1.08
```

may have almost no value.

While:

```text
X2 probability = 74%
odds = 1.65
```

could potentially offer greater EV.

The engine must optimize for:

```text
probability + price + risk
```

not probability alone.

---

# 28. MARKET CONSISTENCY

Compare Double Chance against:

### 1X

Must be consistent with:

```text
Home Win
Draw
Away Win
```

### X2

Must be consistent with:

```text
Home Win
Draw
Away Win
```

### 12

Must be consistent with:

```text
Draw probability
```

If the underlying model says:

```text
P(Draw) = 34%
```

then:

```text
P(12)
```

cannot simultaneously be 80%.

It must be approximately:

```text
66%
```

before calibration adjustments.

---

# 29. DRAW NO BET CONSISTENCY

Compare:

```text
1X
vs
Home Draw No Bet
```

and:

```text
X2
vs
Away Draw No Bet
```

The engine should identify whether the extra protection from the draw justifies the reduced price.

---

# 30. ASIAN HANDICAP CONSISTENCY

Compare Double Chance with:

```text
Home +0.5
Away +0.5
```

because:

```text
Home +0.5
```

is conceptually equivalent to:

```text
1X
```

for standard win/draw/loss settlement.

Likewise:

```text
Away +0.5
```

corresponds to:

```text
X2
```

The model must ensure these related markets do not produce contradictory probabilities.

---

# 31. CORRECT-SCORE CONSISTENCY

Use the score matrix to validate Double Chance.

For:

```text
1X
```

sum all:

```text
Home Win scorelines
+
Draw scorelines
```

For:

```text
X2
```

sum:

```text
Draw
+
Away Win
```

For:

```text
12
```

sum:

```text
Home Win
+
Away Win
```

This provides a powerful internal consistency check.

---

# 32. GOALS CONSISTENCY

Compare Double Chance against:

- Over/Under 1.5
- Over/Under 2.5
- BTTS
- Team to score

Do not force agreement.

Use these only as secondary consistency checks.

Example:

A very high:

```text
1X probability
```

combined with a model predicting:

```text
high probability of an away multi-goal result
```

should trigger investigation.

---

# 33. TEAM TO SCORE CONSISTENCY

If the Away Team has:

```text
very high probability of scoring
```

and:

```text
very high attacking strength
```

then an extremely high:

```text
1X
```

may require additional scrutiny.

This is a consistency check, not a hard rejection.

---

# 34. H2H

Use H2H as a supporting signal.

Collect:

- last 5 H2H
- home wins
- draws
- away wins
- goals
- home/away context

H2H must have low-to-moderate weight.

Current:

```text
team strength
form
home/away performance
```

must dominate older H2H.

---

# 35. LINEUPS

Where available, collect:

- confirmed lineup
- expected lineup
- injuries
- suspensions
- unavailable players
- goalkeeper status
- defensive changes
- attacking changes

The engine should calculate:

```text
lineup_confidence
```

---

# 36. KEY PLAYER ABSENCE

Assess actual impact of unavailable players.

Examples:

- starting goalkeeper unavailable
- primary striker unavailable
- central defender unavailable
- multiple defensive players unavailable

Only adjust the model when supported by historical/player data.

Do not assign arbitrary:

```text
+10%
```

or:

```text
-15%
```

adjustments without validation.

---

# 37. SQUAD STRENGTH

Where player data is available, estimate:

```text
expected starting XI strength
bench strength
missing-player impact
```

Do not use player reputation alone.

Use measurable historical performance where available.

---

# 38. REST AND SCHEDULE

Consider:

```text
days_since_last_match
matches_last_7_days
matches_last_14_days
travel/congestion data if available
```

Use this as a secondary variable.

Do not assume fatigue automatically favors the opponent.

---

# 39. MATCH CONTEXT

Consider:

- title race
- relegation battle
- playoff
- knockout match
- qualification
- must-win scenario
- late-season incentives

Context should modify probabilities only where historical evidence supports it.

---

# 40. TEAM FORM MOMENTUM

Calculate:

```text
recent win rate
recent draw rate
recent loss rate
recent points per match
```

Compare:

```text
last 5
last 10
season
```

Detect:

```text
improving
stable
declining
```

Do not overweight a five-match sample.

---

# 41. OPPONENT QUALITY

Adjust recent results based on opponent quality.

Example:

```text
Team A:
3 wins in last 5

but opponents:
ranked 15, 17, 18, 19, 20
```

This should not automatically receive the same strength rating as:

```text
3 wins against top-five opponents
```

---

# 42. ELO / TEAM STRENGTH MODEL

Maintain a dynamic team-strength rating.

Possible structure:

```text
base_rating
home_advantage
recent_form_adjustment
opponent_adjustment
league_strength_adjustment
```

Update after completed matches.

Never allow future matches to influence past ratings.

---

# 43. ELO CALIBRATION

Do not assume the ELO difference directly equals a probability.

Calibrate:

```text
ELO difference
→ historical win/draw/loss probabilities
```

by league or competition when sufficient data exists.

---

# 44. DRAW-SPECIFIC MODEL

Build a separate draw model.

Potential inputs:

```text
team strength difference
expected goals
goal volatility
home/away draw rates
recent draw rates
league draw rate
defensive strength
scoring rates
```

Output:

```text
P(Draw)
```

This can be ensembled with the Poisson-derived draw probability.

---

# 45. ENSEMBLE MODELS

Use multiple models:

### Model 1
Poisson score matrix

### Model 2
Dixon-Coles

### Model 3
Team-strength/ELO

### Model 4
Home/Away performance

### Model 5
Opponent-adjusted form

### Model 6
Draw-specific model

### Model 7
Recent-form model

### Model 8
Squad/lineup model

### Model 9
Goal-distribution model

### Model 10
Market validation model

---

# 46. STARTING ENSEMBLE WEIGHTS

Use these as initial weights only.

They must be optimized through chronological backtesting.

```text
18% Poisson / Score Matrix
14% Dixon-Coles
14% Team Strength / ELO
14% Home/Away Performance
10% Opponent-Adjusted Form
10% Draw-Specific Model
7% Goal Distribution Model
5% Recent Form
4% Squad / Lineup
4% Market Validation
```

Total:

```text
100%
```

The weights must be recalibrated if historical testing shows a better configuration.

---

# 47. PROBABILITY CALIBRATION

Calibrate separately:

```text
P(Home Win)
P(Draw)
P(Away Win)
P(1X)
P(X2)
P(12)
```

Use:

- Brier score
- Log Loss
- calibration curves
- reliability diagrams
- Expected Calibration Error

Do not assume calibration of 1X2 automatically guarantees calibration of Double Chance.

---

# 48. MATHEMATICAL CONSISTENCY CHECK

After calibration verify:

```text
P(1X) ≈ P(Home) + P(Draw)

P(X2) ≈ P(Draw) + P(Away)

P(12) ≈ P(Home) + P(Away)
```

and:

```text
P(1X) ≈ 1 - P(Away)

P(X2) ≈ 1 - P(Home)

P(12) ≈ 1 - P(Draw)
```

Any material inconsistency must trigger:

```text
model_error
```

or recalibration.

---

# 49. MODEL AGREEMENT

Measure disagreement between models.

Example:

```text
Poisson 1X = 81%
Dixon-Coles 1X = 83%
ELO = 79%
Home/Away = 84%
Draw model = 82%
```

High agreement:

```text
stronger confidence
```

Large disagreement:

```text
reduce confidence
```

---

# 50. DATA QUALITY SCORE

Create:

```text
data_quality_score = 0–100
```

Consider:

- fixture validity
- historical depth
- home/away sample size
- current team data
- lineup certainty
- injury information
- standings
- goal data
- odds availability
- league data

Example:

```text
90–100 Excellent
80–89 Very Good
70–79 Good
60–69 Limited
<60 Poor
```

---

# 51. DOUBLE-CHANCE CONFIDENCE SCORE

Create a separate:

```text
double_chance_confidence = 0–100
```

based on:

```text
probability
model agreement
data quality
calibration
price stability
robustness
```

Do not make confidence equal to probability.

---

# 52. ROBUSTNESS TEST

Run:

```text
-10% expected home goals
baseline
+10% expected home goals

-10% expected away goals
baseline
+10% expected away goals
```

Also test removal/reduction of:

```text
H2H
recent form
market
lineup uncertainty
```

If the Double Chance selection remains stable:

```text
robustness = strong
```

If the selection flips easily:

```text
robustness = weak
```

---

# 53. PROBABILITY SENSITIVITY

For each Double Chance selection calculate:

```text
baseline_probability
worst_case_probability
best_case_probability
```

Example:

```text
1X

Baseline: 84%
Worst case: 79%
Best case: 87%
```

This is more useful than presenting a single number without uncertainty.

---

# 54. DOUBLE-CHANCE STRENGTH TIERS

Suggested starting classification:

```text
<60%    Weak
60–69%  Moderate
70–74%  Strong
75–79%  Very Strong
80–84%  Elite
85%+    Exceptional
```

These thresholds are descriptive only.

Final thresholds must be historically calibrated.

---

# 55. VALUE TIERS

Separate probability from value.

### High probability / low value

```text
Probability ≥ 80%
EV < 0
```

Result:

```text
NO BET
```

### High probability / positive value

```text
Probability ≥ configured threshold
EV ≥ configured threshold
```

Potential:

```text
BET
```

### Lower probability / high value

Allow only if:

```text
model quality
calibration
EV
robustness
```

all meet configured requirements.

---

# 56. NO-BET CONDITIONS

Return:

```text
NO BET
```

when:

- fixture invalid
- insufficient historical data
- major lineup uncertainty
- model disagreement too high
- probability below threshold
- EV below minimum
- odds unavailable for a value-based strategy
- market price is too short
- probability is unstable
- draw model is highly uncertain
- team-strength estimates are unreliable
- model calibration is poor
- recommendation changes under minor sensitivity changes
- market moves materially against the model

---

# 57. RECOMMENDATION LOGIC

The engine should rank:

```text
1X
X2
12
```

using:

```text
model probability
+
market price
+
EV
+
data quality
+
model agreement
+
calibration
+
robustness
+
line stability
```

Then return:

```text
BEST DOUBLE CHANCE
```

or:

```text
NO BET
```

---

# 58. IMPORTANT: DO NOT FORCE A DOUBLE-CHANCE BET

There must always be a valid:

```text
NO BET
```

outcome.

Even if:

```text
1X = 78%
X2 = 72%
12 = 69%
```

the engine should return:

```text
NO BET
```

if all three markets are overpriced.

---

# 59. DOUBLE-CHANCE MARKET RANKING

For every fixture calculate:

```text
selection
probability
fair_odds
market_odds
edge
EV
confidence
robustness
```

Then rank.

Example structure:

```text
1X
Probability: 82%
Fair Odds: 1.22
Market: 1.31
EV: +7.4%

X2
Probability: 71%
Fair Odds: 1.41
Market: 1.55
EV: +10.1%

12
Probability: 77%
Fair Odds: 1.30
Market: 1.25
EV: -3.8%
```

The engine should select based on the configured objective, not simply highest probability.

---

# 60. CROSS-MARKET ARBITRATION

Check for contradictions such as:

```text
1X strongly recommended
```

while:

```text
Away Win probability extremely high
```

or:

```text
X2 strongly recommended
```

while:

```text
Home Win probability extremely high
```

These contradictions should trigger:

```text
warning
```

and potentially:

```text
NO BET
```

---

# 61. MARKET MOVEMENT

If historical odds snapshots exist, track:

```text
opening odds
current odds
closing odds
```

Calculate:

```text
line movement
price movement
```

Monitor whether:

```text
model edge
```

is increasing or disappearing.

Do not treat bookmaker movement as proof that the bookmaker is correct.

It is a validation/input signal, not the final authority.

---

# 62. CLOSING LINE VALUE

After kickoff, compare the selected price against closing market price.

Track:

```text
CLV
```

by:

- selection
- league
- bookmaker
- odds range
- probability bucket

Positive long-term CLV can help evaluate whether the model identifies useful market information.

---

# 63. BACKTESTING

Backtest chronologically.

At each historical prediction timestamp, use only information that was available before kickoff.

Never leak:

- final result
- future form
- future odds
- future lineup
- future team statistics
- future ELO ratings

into historical predictions.

---

# 64. WALK-FORWARD TESTING

Use:

```text
Training
→ Validation
→ Test
```

then roll forward.

Example:

```text
Train: Seasons 1–2
Validate: Season 3
Test: Season 4
```

Then:

```text
Train: Seasons 1–3
Validate: Season 4
Test: Season 5
```

This should be preferred over random train/test splits for time-series football data.

---

# 65. PERFORMANCE TRACKING

Track:

```text
overall hit rate
ROI
yield
Brier score
Log Loss
CLV
EV realization
```

Break down by:

```text
1X
X2
12

league
season
odds range
probability bucket
confidence tier
model version
```

---

# 66. API EFFICIENCY

All prediction engines must share the same underlying fixture dataset.

Architecture:

```text
API-Football
      ↓
Shared Fixture Dataset
      ↓
Team Data
      ↓
 ┌──────┬──────┬──────┬──────┬───────┐
 ↓      ↓      ↓      ↓      ↓
BTTS    O/U    1X2   DC     Correct
                       ↓
                    Handicap
                       ↓
                    Corners
                       ↓
                   Bookings
                       ↓
                  Player Props
```

Do not repeatedly request identical:

- fixtures
- team statistics
- standings
- recent matches
- lineups
- injuries
- odds

for each engine.

---

# 67. CACHING

Cache:

```text
historical fixtures
team statistics
standings
recent form
ELO/team strength
player data
lineups
injuries
odds
league statistics
```

Use shorter TTLs for rapidly changing information.

For example:

```text
historical statistics → long TTL
team strength → moderate TTL
odds → short TTL
lineups → very short TTL
```

---

# 68. STAGED PIPELINE

Use:

### Stage 1
Fixture validation

### Stage 2
Basic team-strength filter

### Stage 3
Home/away performance

### Stage 4
Recent form

### Stage 5
Goal model

### Stage 6
1X2 distribution

### Stage 7
Double Chance conversion

### Stage 8
Market odds

### Stage 9
EV calculation

### Stage 10
Robustness/calibration

### Stage 11
Final recommendation

This prevents expensive calculations for poor-quality fixtures.

---

# 69. PREDICTION OUTPUT

Every prediction must contain:

```text
Fixture
League
Date
Home Team
Away Team

Home Win Probability
Draw Probability
Away Win Probability

1X Probability
X2 Probability
12 Probability

Failure Probability

Fair Odds

Market Odds

Edge
EV

Model Agreement
Data Quality
Confidence
Calibration
Robustness

Risk Flags

Best Double Chance
Final Recommendation
```

---

# 70. HUMAN-READABLE OUTPUT

Use:

```text
DOUBLE CHANCE

Match:
Team A vs Team B

1X:
82.4%

X2:
67.1%

12:
75.9%

Underlying 1X2:

Home Win:
58.7%

Draw:
23.7%

Away Win:
17.6%

Best Market:
1X

Fair Odds:
1.21

Market Odds:
1.32

Edge:
+6.6%

EV:
Positive

Model Agreement:
87%

Data Quality:
92%

Robustness:
Strong

Recommendation:
1X
```

All values above are formatting examples only.

Never use example values as actual predictions.

---

# 71. JSON OUTPUT

Use a structure similar to:

```json
{
  "fixture_id": 123456,
  "home_team": "Team A",
  "away_team": "Team B",

  "one_x_two": {
    "home_win": 0.587,
    "draw": 0.237,
    "away_win": 0.176
  },

  "double_chance": {
    "1X": {
      "probability": 0.824,
      "failure_probability": 0.176,
      "fair_odds": 1.214
    },
    "X2": {
      "probability": 0.413,
      "failure_probability": 0.587,
      "fair_odds": 2.421
    },
    "12": {
      "probability": 0.763,
      "failure_probability": 0.237,
      "fair_odds": 1.311
    }
  },

  "market": {
    "selection": "1X",
    "odds": null,
    "edge": null,
    "ev": null
  },

  "quality": {
    "data_quality": 92,
    "model_agreement": 87,
    "confidence": 88,
    "robustness": "strong"
  },

  "recommendation": "NO BET",

  "risk_flags": [],

  "model_version": "double-chance-v1"
}
```

The numerical values are structural examples only.

---

# 72. DATABASE STORAGE

Store:

```text
fixture_id
prediction_timestamp
kickoff_timestamp

home_team
away_team
league_id
season

home_win_probability
draw_probability
away_win_probability

one_x_probability
x_two_probability
twelve_probability

fair_odds_1x
fair_odds_x2
fair_odds_12

market_odds_1x
market_odds_x2
market_odds_12

edge_1x
edge_x2
edge_12

ev_1x
ev_x2
ev_12

model_agreement
data_quality
confidence
robustness

recommendation
model_version
```

After the match store:

```text
actual_result
settled_selection
win_loss
profit_loss
ROI
closing_odds
CLV
```

---

# 73. AUTOMATIC SETTLEMENT

Settlement:

### 1X

Wins when:

```text
Home Win
OR
Draw
```

Loses when:

```text
Away Win
```

### X2

Wins when:

```text
Draw
OR
Away Win
```

Loses when:

```text
Home Win
```

### 12

Wins when:

```text
Home Win
OR
Away Win
```

Loses when:

```text
Draw
```

No push exists for standard Double Chance.

---

# 74. SPECIAL CASE: ABANDONED MATCHES

Do not automatically settle an abandoned/postponed match.

Use configured settlement rules and official competition/bookmaker settlement information.

Possible status:

```text
PENDING_SETTLEMENT
```

until the match is officially resolved.

---

# 75. FINAL DECISION HIERARCHY

The engine must prioritize:

```text
1. Data integrity
2. Correct fixture
3. Correct home/away identification
4. Team strength
5. Home advantage
6. Home performance
7. Away performance
8. Opponent-adjusted form
9. Attack strength
10. Defensive strength
11. Goal expectancy
12. Poisson score distribution
13. Dixon-Coles correction
14. Draw probability
15. Upset probability
16. 1X2 probability
17. Double Chance probability
18. Model agreement
19. Calibration
20. Market price
21. Fair odds
22. Edge
23. EV
24. Sensitivity
25. Robustness
26. Risk
27. Final recommendation
```

---

# 76. CORE PRINCIPLE

The Double Chance engine must NOT ask:

> "Which team looks stronger?"

It must ask:

> **"What is the calibrated probability of Home Win, Draw, and Away Win, and does combining two of those mutually exclusive outcomes create sufficient probability coverage at the available market price?"**

The engine must calculate the complete:

```text
Home Win
Draw
Away Win
```

distribution first.

Then derive:

```text
1X
X2
12
```

from that distribution.

Finally compare each market against:

```text
market odds
fair odds
edge
EV
model agreement
calibration
data quality
robustness
```

A high-probability Double Chance selection with poor value must be:

```text
NO BET
```

A lower-probability selection with a genuinely superior risk-adjusted price may be preferable.

**Probability identifies safety.  
Price identifies value.  
Calibration identifies whether the probability can be trusted.  
Robustness identifies whether the prediction survives uncertainty.**

The final system must optimize all four.