# ADVANCED FOOTBALL HANDICAP PREDICTION ENGINE
## Production-Grade Asian Handicap & European Handicap Prediction System

---

# 1. OBJECTIVE

Build an advanced, probability-driven **Football Handicap Prediction Engine**.

The engine must evaluate:

- Asian Handicap
- European Handicap
- Home handicap
- Away handicap
- Quarter-ball handicap lines
- Half-ball handicap lines
- Whole-ball handicap lines

Examples:

```text
Home -0.5
Home -0.75
Home -1.0
Home -1.25
Home -1.5
Home -1.75
Home -2.0

Away +0.5
Away +0.75
Away +1.0
Away +1.25
Away +1.5
Away +1.75
```

The engine must calculate:

```text
P(Home Handicap Win)
P(Home Handicap Push)
P(Home Handicap Half Win)
P(Home Handicap Half Loss)
P(Home Handicap Loss)
```

where applicable.

For quarter-goal Asian Handicap lines, the engine MUST correctly split the stake between the two adjacent half/whole handicap lines.

The objective is:

> **Predict the probability distribution of the final goal difference and determine whether a handicap line provides a statistically defensible betting edge.**

The engine must prefer:

```text
NO BET
```

over forcing a handicap recommendation.

---

# 2. ABSOLUTE DATA INTEGRITY

The system must use only real, verified data.

NEVER:

- invent fixtures
- invent results
- invent odds
- invent handicap lines
- invent lineups
- invent injuries
- invent player availability
- invent xG
- invent xGA
- fabricate missing statistics
- treat missing statistics as zero
- create demo matches
- use sample data for live predictions
- fabricate bookmaker prices

If xG is unavailable:

```text
DO NOT INVENT xG.
```

If xGA is unavailable:

```text
DO NOT INVENT xGA.
```

If a statistic is missing:

```text
DATA_UNAVAILABLE
```

and reduce model confidence appropriately.

---

# 3. FIXTURE VALIDATION

Before prediction, verify:

- fixture ID
- home team
- away team
- competition
- season
- kickoff date
- kickoff time
- venue
- fixture status

Reject:

- cancelled fixtures
- postponed fixtures
- completed fixtures when generating pre-match predictions
- duplicate fixtures
- invalid fixtures
- mismatched teams
- stale fixture data

The handicap prediction must correspond to the exact fixture.

---

# 4. HANDICAP TYPES

Support:

## Asian Handicap

Examples:

```text
-0.25
-0.5
-0.75
-1.0
-1.25
-1.5
-1.75
-2.0
+0.25
+0.5
+0.75
+1.0
+1.25
+1.5
+1.75
+2.0
```

## European Handicap

Where supported, evaluate:

```text
Home -1
Draw -1
Away +1
```

or equivalent three-way handicap markets.

Keep Asian Handicap and European Handicap mathematically separate.

Do NOT treat them as interchangeable markets.

---

# 5. REQUIRED CORE OUTPUT

For every eligible handicap line calculate:

```text
handicap_line
home_handicap_probability
away_handicap_probability

win_probability
push_probability
half_win_probability
half_loss_probability
loss_probability

fair_odds
market_odds
market_implied_probability
edge
EV

confidence
data_quality
model_agreement

risk_flags
recommendation
```

---

# 6. CORE CONCEPT: GOAL DIFFERENCE

The central variable is:

```text
GOAL_DIFFERENCE =
HOME_GOALS - AWAY_GOALS
```

Examples:

```text
2-0 → +2
2-1 → +1
1-1 → 0
0-1 → -1
0-2 → -2
```

The engine must calculate the probability distribution of:

```text
-5
-4
-3
-2
-1
0
+1
+2
+3
+4
+5
```

with additional tail probability for extreme scores.

This distribution becomes the foundation of the handicap model.

---

# 7. DATA TO FETCH

Use the shared SmartMatchPick match dataset where possible.

Retrieve:

### Fixture

- fixture
- competition
- venue
- kickoff
- season

### Team performance

- goals scored
- goals conceded
- wins
- draws
- losses
- clean sheets
- failed to score

### Home team

Use:

```text
HOME MATCHES ONLY
```

where possible.

### Away team

Use:

```text
AWAY MATCHES ONLY
```

where possible.

### Recent form

Retrieve:

```text
Last 5
Last 10
```

where sufficient data exists.

### Advanced statistics

Where available:

- shots
- shots on target
- big chances
- possession
- attacking statistics
- defensive statistics
- player statistics

### Squad

- injuries
- suspensions
- lineups
- unavailable players

### Market

Where available:

- Asian Handicap odds
- European Handicap odds
- handicap line
- opening line
- current line
- price movement

---

# 8. HOME TEAM HANDICAP STRENGTH

Calculate the home team's ability to outperform opponents.

Analyze:

- home wins
- home draws
- home losses
- home goal difference
- average home winning margin
- average home losing margin
- home scoring rate
- home conceding rate
- home clean sheets
- home failed-to-score rate

Also calculate:

```text
P(Home wins by 1)
P(Home wins by 2)
P(Home wins by 3+)
```

This is more useful for handicaps than simply knowing:

```text
Home Win = 70%
```

---

# 9. AWAY TEAM HANDICAP STRENGTH

Calculate:

- away wins
- away draws
- away losses
- away goal difference
- average away winning margin
- average away losing margin
- away scoring rate
- away conceding rate
- away clean sheets
- away failed-to-score rate

Calculate:

```text
P(Away wins by 1)
P(Away wins by 2)
P(Away wins by 3+)
```

---

# 10. GOAL DIFFERENCE DISTRIBUTION

Create:

```text
P(D = -5 or lower)
P(D = -4)
P(D = -3)
P(D = -2)
P(D = -1)
P(D = 0)
P(D = +1)
P(D = +2)
P(D = +3)
P(D = +4)
P(D = +5 or higher)
```

where:

```text
D = Home Goals - Away Goals
```

Normalize the distribution to approximately:

```text
100%
```

This is the most important distribution for handicap analysis.

---

# 11. POISSON FOUNDATION

Estimate:

```text
λ_home
λ_away
```

Then calculate:

```text
P(Home goals = x)
P(Away goals = y)
```

using:

```text
P(X=k) = (λ^k × e^-λ) / k!
```

Generate a sufficiently large score matrix.

At minimum:

```text
0–8 goals
```

for each team, with tail handling beyond the maximum.

Do not truncate the probability mass incorrectly.

---

# 12. DIXON-COLES CORRECTION

Apply Dixon-Coles correction to important low-score combinations:

```text
0-0
1-0
0-1
1-1
```

This is important because these results strongly affect:

- -0.25
- -0.5
- +0.25
- +0.5
- draw-related handicap outcomes

Use a validated rho parameter.

Prefer:

```text
league-specific rho
```

when sufficient historical data exists.

Otherwise use a validated global parameter.

After correction:

```text
NORMALIZE SCORE MATRIX
```

---

# 13. NEGATIVE BINOMIAL CHECK

Test whether the scoring distribution is overdispersed.

If:

```text
variance > mean
```

by a statistically meaningful amount, allow a Negative Binomial component.

Compare:

```text
Poisson
vs
Negative Binomial
```

using historical out-of-sample performance.

Do not automatically replace Poisson.

Use ensemble weighting based on historical performance.

---

# 14. HOME/AWAY EXPECTED SCORING

The calculation of:

```text
λ_home
λ_away
```

must consider:

### Home attack

- home goals scored
- home scoring frequency
- shots
- SOT
- big chances
- recent scoring
- available xG if real data exists

### Away defence

- away goals conceded
- away clean sheets
- away defensive performance
- shots conceded
- SOT conceded
- big chances conceded where available

And vice versa.

The model must not simply average the two team's overall goal averages.

---

# 15. OPPONENT-STRENGTH ADJUSTMENT

Adjust performance based on opponent quality.

For example:

```text
strong opponent
medium opponent
weak opponent
```

A +2 goal win against a weak team should not automatically receive the same strength interpretation as a +2 win against an elite team.

Calculate opponent-adjusted:

```text
goal difference
goals scored
goals conceded
win margin
loss margin
```

where sufficient data exists.

---

# 16. RECENT FORM

Use time-decay weighting.

Recent results should receive greater influence than old results.

Analyze:

```text
Last 5
Last 10
Season
```

Do not let five matches completely override a large historical sample unless the data demonstrates a meaningful structural change.

---

# 17. GOAL MARGIN FORM

Specifically track recent margins:

```text
+3
+2
+1
0
-1
-2
-3
```

Calculate:

```text
Average goal difference
Median goal difference
Goal-difference variance
```

The median is particularly useful because extreme scorelines can distort the mean.

---

# 18. PERFORMANCE AGAINST STRONG TEAMS

Track performance against:

- top teams
- middle teams
- lower-ranked teams

Analyze:

```text
goal difference
wins
draws
losses
average scoring margin
```

This helps determine whether a team can realistically cover larger handicaps.

---

# 19. HANDICAP COVER RATE

Historical handicap performance can be useful.

Where historical market handicap lines are available, calculate:

```text
Cover rate
Push rate
Half-win rate
Half-loss rate
```

But do not blindly assume past market performance predicts future performance.

Use it as a supporting model only.

---

# 20. MATCH CONTEXT

Consider:

- title race
- relegation battle
- knockout match
- first leg
- second leg
- cup rotation
- must-win scenario
- qualification
- likely defensive approach
- likely rotation
- fixture congestion

Context should only alter probabilities when supported by historical evidence.

Do not make subjective assumptions such as:

```text
"must win = guaranteed attacking football"
```

---

# 21. LINEUP ADJUSTMENT

Account for:

- starting striker availability
- key attacking players
- central defenders
- fullbacks
- goalkeeper
- midfield creators
- suspensions
- injuries

Adjust:

```text
λ_home
λ_away
```

only when the adjustment is supported by historical player/team data.

Do not invent player impact values.

---

# 22. GOALKEEPER ADJUSTMENT

Where reliable data exists:

Evaluate:

- starting goalkeeper
- backup goalkeeper
- clean-sheet performance
- goals conceded
- goalkeeper availability

A goalkeeper absence may influence:

```text
opponent scoring distribution
```

but the adjustment must be calibrated.

---

# 23. REST AND SCHEDULE

Calculate:

```text
days_since_last_match
```

and where available:

```text
days_until_next_match
```

Analyze:

- congestion
- rotation
- travel
- fatigue indicators

Use this as a small model component unless historical evidence shows stronger predictive value.

---

# 24. TACTICAL MATCHUP

Where measurable data exists, analyze:

- possession
- pressing
- transition play
- defensive block
- attacking tempo
- set-piece threat
- counterattacking tendency

Use only predictive features.

Avoid subjective tactical narratives dominating the numerical model.

---

# 25. DERIVE HANDICAP OUTCOMES FROM SCORE MATRIX

For every scoreline:

```text
Home Goals = H
Away Goals = A
Goal Difference = H - A
```

Then apply the handicap.

Example:

```text
Home -1.0
```

A final:

```text
2-0
```

means:

```text
Adjusted result = 1-0
```

which is a win.

A final:

```text
1-0
```

means:

```text
Adjusted result = 0
```

which is a push.

A final:

```text
1-1
```

means:

```text
Adjusted result = -1
```

which is a loss.

The engine must calculate this for EVERY scoreline.

---

# 26. ASIAN HANDICAP SETTLEMENT

Implement exact settlement logic.

## Home -0.5

Home wins if:

```text
Home Goals > Away Goals
```

Home loses if:

```text
Home Goals <= Away Goals
```

---

# 27. HOME -1.0

### Home wins

```text
Home wins by 2+
```

### Push

```text
Home wins by exactly 1
```

### Loss

```text
Draw
or
Away win
```

---

# 28. HOME -1.5

Home wins if:

```text
Home wins by 2+
```

Otherwise:

```text
LOSS
```

---

# 29. HOME -0.25

This is equivalent to:

```text
50% stake on 0
+
50% stake on -0.5
```

Therefore:

### Home win

Full win.

### Draw

Half loss.

### Away win

Full loss.

The engine MUST calculate:

```text
P(full win)
P(half loss)
P(full loss)
```

---

# 30. HOME -0.75

This is:

```text
50% stake on -0.5
+
50% stake on -1.0
```

Therefore:

### Home wins by 2+

Full win.

### Home wins by exactly 1

Half win.

### Draw or Away win

Full loss.

Output:

```text
P(full win)
P(half win)
P(full loss)
```

---

# 31. HOME -1.25

This is:

```text
50% stake on -1.0
+
50% stake on -1.5
```

Therefore:

### Home wins by 2+

Full win.

### Home wins by exactly 1

Half loss.

### Draw/Away win

Full loss.

Output:

```text
P(full win)
P(half loss)
P(full loss)
```

---

# 32. GENERAL QUARTER-HANDICAP ENGINE

Do NOT hard-code only individual handicap lines.

Create a generic settlement engine.

For:

```text
H = handicap
```

If:

```text
H = n + 0.25
```

split into:

```text
n
and
n + 0.5
```

If:

```text
H = n + 0.75
```

split into:

```text
n + 0.5
and
n + 1.0
```

Calculate each half independently.

Then combine the stake outcomes.

This must work for both positive and negative handicaps.

---

# 33. PUSH PROBABILITY

Calculate push probability separately.

Examples:

```text
Home -1.0
```

has push probability:

```text
P(Home wins by exactly 1)
```

For:

```text
Home +1.0
```

push probability is:

```text
P(Away wins by exactly 1)
```

Push probability is an important feature.

A line with a high push probability can have a very different risk profile from a nearby half-goal line.

---

# 34. HALF-WIN PROBABILITY

For quarter handicaps calculate:

```text
P(Half Win)
```

Example:

```text
Home -0.75
```

half win occurs when:

```text
Home wins by exactly 1
```

because:

```text
-0.5 = win
-1.0 = push
```

Half of the stake wins and half pushes.

---

# 35. HALF-LOSS PROBABILITY

Example:

```text
Home -0.25
```

when match is drawn:

```text
0 handicap = push
-0.5 handicap = loss
```

Therefore:

```text
50% stake = push
50% stake = loss
```

which is a half loss.

Implement this mathematically rather than using textual assumptions.

---

# 36. EXPECTED PAYOUT

For each handicap calculate expected return.

Given decimal odds:

```text
EV = Expected Return - 1
```

For Asian handicap:

```text
Expected Return =
P(full win) × winning return
+
P(half win) × half-win return
+
P(push) × 1
+
P(half loss) × half-loss return
+
P(loss) × 0
```

The exact implementation must respect stake splitting.

---

# 37. FAIR ODDS

Calculate fair odds from the complete settlement distribution.

Do NOT simply use:

```text
1 / P(win)
```

for quarter handicaps.

The correct fair price must account for:

```text
full win
half win
push
half loss
loss
```

Solve for the odds at which:

```text
Expected Value = 0
```

This becomes:

```text
FAIR_ODDS
```

---

# 38. MARKET ODDS

Where API-Football provides bookmaker odds, retrieve:

- handicap line
- home handicap odds
- away handicap odds
- bookmaker
- timestamp where available

Do not assume the displayed handicap line is current if the odds timestamp is stale.

---

# 39. IMPLIED PROBABILITY

For standard binary markets:

```text
Implied Probability = 1 / Odds
```

But for Asian Handicap:

> Do not treat raw implied probability as the complete probability of winning because pushes and half outcomes exist.

Where possible:

```text
REMOVE BOOKMAKER MARGIN
```

using both sides of the market.

---

# 40. HANDICAP MARKET CONSISTENCY

Compare:

```text
Model probability distribution
vs
Market handicap line
```

Look for:

```text
model expects +1.3 goal difference
market line = Home -0.5
```

This could indicate value.

But investigate market disagreement before recommending a bet.

---

# 41. HANDICAP LINE VALUE

The engine should identify:

```text
BEST HANDICAP LINE
```

rather than automatically predicting the most aggressive line.

For example:

```text
Home -0.5
Home -0.75
Home -1.0
Home -1.25
```

may all be evaluated.

The engine should compare:

```text
probability
risk
EV
push protection
half-win potential
market price
```

and identify the strongest risk-adjusted opportunity.

---

# 42. DO NOT CHASE THE HIGHEST ODDS

A higher handicap price does not automatically mean better value.

The engine should maximize:

```text
CALIBRATED EXPECTED VALUE
```

subject to:

```text
minimum confidence
minimum data quality
acceptable variance
```

---

# 43. HANDICAP STABILITY

Calculate how sensitive the recommendation is to the handicap line.

Example:

```text
Home -0.5 → strong
Home -0.75 → strong
Home -1.0 → moderate
Home -1.25 → weak
```

This indicates:

```text
LINE_STABILITY = GOOD
```

If only one exact line produces value:

```text
LINE_STABILITY = LOW
```

This should reduce confidence.

---

# 44. HANDICAP RANGE

Determine the range of handicap lines where the model maintains positive EV.

Example:

```text
Home -0.25 → +EV
Home -0.5  → +EV
Home -0.75 → +EV
Home -1.0  → neutral
Home -1.25 → -EV
```

Then identify:

```text
Optimal handicap = -0.5
```

if that line provides the best risk-adjusted value.

---

# 45. GOAL-DIFFERENCE EXPECTATION

Calculate:

```text
Expected Goal Difference =
λ_home - λ_away
```

Example:

```text
λ_home = 1.80
λ_away = 0.90

Expected Difference = +0.90
```

This does NOT mean the match will finish:

```text
2-1
```

It represents the expected mean goal difference.

Use the complete distribution for actual handicap probabilities.

---

# 46. GOAL-DIFFERENCE MEDIAN

Also calculate the median goal difference.

This is useful because the mean can be distorted by extreme scorelines.

Store:

```text
mean_goal_difference
median_goal_difference
mode_goal_difference
```

Compare all three.

---

# 47. GOAL-DIFFERENCE MODE

Identify:

```text
MOST LIKELY GOAL DIFFERENCE
```

Example:

```text
+1
```

This means the most probable margin category is:

```text
Home wins by exactly 1
```

It does NOT mean a specific score.

---

# 48. HANDICAP CLUSTER

Group outcomes.

For example:

### Home covers -0.5

```text
+1
+2
+3
...
```

### Home covers -1.0

```text
+2
+3
+4
...
```

### Home covers -1.5

```text
+2
+3
+4
...
```

This allows the engine to understand how quickly probability falls as the handicap becomes more aggressive.

---

# 49. 1X2 CONSISTENCY

The handicap distribution must agree with the 1X2 model.

From the score matrix calculate:

```text
Home Win
Draw
Away Win
```

Then compare against the existing win model.

If:

```text
Handicap model says Home -1.5 has strong probability
```

but:

```text
Win model says Home Win = only 52%
```

the handicap recommendation should be investigated.

Large disagreement should reduce confidence.

---

# 50. CORRECT-SCORE CONSISTENCY

Compare handicap predictions against the Correct Score model.

If the Correct Score model strongly favors:

```text
1-0
1-1
```

then:

```text
Home -1.5
```

should naturally be a poor candidate.

If Correct Score probabilities concentrate around:

```text
2-0
3-0
2-1
3-1
```

larger home handicaps may become more plausible.

Do not force the models to agree.

Use disagreement as a risk signal.

---

# 51. BTTS CONSISTENCY

Use BTTS as supporting information.

For example:

High BTTS probability may reduce the likelihood of:

```text
Home -2.0
```

if the away team has a strong scoring probability.

But BTTS must not automatically determine handicap selection.

---

# 52. OVER/UNDER CONSISTENCY

Use the goal-total model.

A large handicap often requires enough goals for the stronger team to separate.

If:

```text
Under 2.5 = very high
```

then:

```text
-2.0
-2.5
```

should receive additional scrutiny.

If:

```text
Over 3.5 = high
```

a large handicap may be more plausible, depending on which team is expected to score those goals.

---

# 53. MARKET MOVEMENT

Where historical/current odds data is available, track:

```text
opening handicap
current handicap
opening odds
current odds
```

Detect:

```text
line movement
price movement
```

Example:

```text
Home -0.5
→
Home -0.75
```

This represents a materially different market expectation.

Do not automatically follow market movement.

Use it as information.

---

# 54. MARKET DISAGREEMENT

If model says:

```text
Home -1.0 = strong value
```

but market has moved toward:

```text
Home +0.5
```

investigate immediately.

Possible causes:

- lineup news
- injury
- suspension
- stale model
- data error
- market information unavailable to model

If unresolved:

```text
NO BET
```

---

# 55. ENSEMBLE MODEL

Use multiple components:

### Model 1

Poisson goal model.

### Model 2

Dixon-Coles.

### Model 3

Home/away strength.

### Model 4

Opponent-adjusted form.

### Model 5

Team strength/Elo.

### Model 6

Recent goal-difference model.

### Model 7

Negative Binomial where validated.

### Model 8

Lineup/squad adjustment.

### Model 9

Market handicap model.

### Model 10

Goal-distribution model.

---

# 56. STARTING ENSEMBLE WEIGHTS

Use as initial values only:

```text
Poisson                         20%
Dixon-Coles                     15%
Home/Away performance           12%
Opponent-adjusted form          10%
Team strength/Elo                8%
Recent goal difference           8%
Defensive strength               7%
Goal distribution                6%
Negative Binomial                4%
Lineup/squad                     4%
Market validation                3%
H2H                              1%
Tactical/context                 2%
```

Total:

```text
100%
```

These weights MUST eventually be optimized through historical out-of-sample testing.

---

# 57. H2H

Use:

```text
Last 5 H2H
```

where available.

Analyze:

- winning margin
- draw frequency
- goal difference
- scoring
- conceding

H2H should have low weight.

Do not let old H2H dominate current team strength.

---

# 58. DATA QUALITY SCORE

Create:

```text
DATA_QUALITY_SCORE = 0–100
```

Consider:

- fixture validity
- historical sample size
- home/away sample
- recent-form completeness
- lineup availability
- odds availability
- statistical completeness
- team identity consistency
- league consistency

Suggested classification:

```text
90–100 Excellent
80–89 Very Good
70–79 Good
60–69 Moderate
50–59 Weak
<50 Reject
```

Make thresholds configurable.

---

# 59. MODEL AGREEMENT

Measure agreement between:

- Poisson
- Dixon-Coles
- goal-difference model
- Elo
- recent form
- home/away model
- market model
- lineup model

If models agree:

```text
MODEL_AGREEMENT ↑
```

If models strongly disagree:

```text
MODEL_AGREEMENT ↓
```

---

# 60. HANDICAP CONFIDENCE

Confidence should depend on:

```text
Data quality
+
Model agreement
+
Goal-difference concentration
+
Line stability
+
1X2 consistency
+
Correct-score consistency
+
BTTS consistency
+
O/U consistency
+
Lineup certainty
+
Market validation
+
Historical calibration
```

Do NOT calculate confidence from EV alone.

---

# 61. HANDICAP RISK

Generate risk flags:

```text
HIGH_VARIANCE
LOW_GOAL_ENVIRONMENT
HIGH_GOAL_ENVIRONMENT
LINEUP_UNCERTAINTY
MARKET_DISAGREEMENT
MODEL_DISAGREEMENT
SMALL_SAMPLE
LOW_DATA_QUALITY
HIGH_DRAW_RISK
UPSET_RISK
LARGE_HANDICAP_RISK
LINE_INSTABILITY
```

---

# 62. BEST HANDICAP SELECTION

For every available handicap line:

```text
Calculate model outcome probabilities
Calculate fair odds
Compare market odds
Calculate EV
Calculate risk
Calculate confidence
```

Then rank available lines.

Rank using:

```text
Risk-adjusted expected value
```

rather than:

```text
raw odds
```

---

# 63. EXAMPLE OUTPUT STRUCTURE

```json
{
  "fixture_id": "...",
  "home_team": "...",
  "away_team": "...",

  "lambda_home": 0.00,
  "lambda_away": 0.00,

  "expected_goal_difference": 0.00,
  "median_goal_difference": 0,
  "mode_goal_difference": 0,

  "goal_difference_distribution": {
    "-3_or_less": 0.00,
    "-2": 0.00,
    "-1": 0.00,
    "0": 0.00,
    "+1": 0.00,
    "+2": 0.00,
    "+3_or_more": 0.00
  },

  "recommended_handicap": "HOME -0.75",

  "handicap_analysis": {
    "line": -0.75,
    "full_win_probability": 0.00,
    "half_win_probability": 0.00,
    "push_probability": 0.00,
    "half_loss_probability": 0.00,
    "loss_probability": 0.00,

    "market_odds": 0.00,
    "fair_odds": 0.00,
    "edge": 0.00,
    "ev": 0.00
  },

  "alternative_lines": [],

  "confidence": "...",
  "data_quality": 0.00,
  "model_agreement": 0.00,

  "line_stability": "...",
  "risk_flags": [],

  "recommendation": "BET / NO BET"
}
```

The numerical values above are schema placeholders only.

Never populate live predictions with fabricated values.

---

# 64. DATABASE STORAGE

Store every handicap prediction before kickoff.

Store:

```text
fixture_id
prediction_timestamp
model_version

home_team
away_team

lambda_home
lambda_away

expected_goal_difference
median_goal_difference
mode_goal_difference

goal_difference_distribution

handicap_line
home_probability
away_probability

full_win_probability
half_win_probability
push_probability
half_loss_probability
loss_probability

market_odds
fair_odds
EV
edge

confidence
data_quality
model_agreement

risk_flags
recommendation
```

---

# 65. PREDICTION LOCK

Once kickoff occurs:

```text
LOCK PREDICTION
```

Do not modify the original pre-match prediction after kickoff.

This is required for honest historical performance tracking.

---

# 66. AUTOMATIC SETTLEMENT

After the final result:

Retrieve:

```text
actual_home_goals
actual_away_goals
```

Calculate:

```text
actual_goal_difference
```

Then automatically determine:

```text
FULL WIN
HALF WIN
PUSH
HALF LOSS
FULL LOSS
```

according to the exact handicap line.

---

# 67. PROFITABILITY TRACKING

Track:

```text
bets
wins
half wins
pushes
half losses
losses

stake
profit
ROI

EV predicted
EV realized

closing line
opening line
```

Calculate:

```text
ROI =
Total Profit / Total Stake
```

Track separately by:

- handicap line
- league
- team
- confidence
- model version
- odds range

---

# 68. CLV / CLOSING LINE VALUE

Where sufficient odds history exists, track:

```text
Opening handicap
Prediction-time handicap
Closing handicap
```

Measure whether the model consistently identifies favorable prices before the market moves.

CLV should be tracked separately from short-term win rate.

A model can have:

```text
negative short-term variance
```

while still demonstrating positive long-term CLV.

---

# 69. CALIBRATION

Evaluate predicted probabilities using:

- Brier score
- log loss
- calibration curves
- reliability diagrams
- ROI
- CLV
- cover rate

Do not optimize only for:

```text
handicap win percentage
```

A probability model must be properly calibrated.

---

# 70. LEAGUE-SPECIFIC PERFORMANCE

Track performance by:

```text
league
country
competition
season
handicap range
```

Example:

```text
-0.5
-0.75
-1.0
-1.25
-1.5
```

Some leagues may produce different goal-difference distributions.

Do not create league-specific parameters from tiny samples.

Use shrinkage toward broader averages when necessary.

---

# 71. HANDICAP LINE CALIBRATION

For each line track:

```text
Predicted cover probability
Actual cover frequency
```

Compare:

```text
Predicted 60%
Actual ~60%
```

across a large sample.

If systematic bias exists:

```text
recalibrate
```

Do not manually adjust probabilities based on a handful of matches.

---

# 72. NO-BET CONDITIONS

Return:

```text
NO BET
```

when:

### Data

- insufficient historical data
- invalid fixture
- stale data
- poor data quality

### Model

- unstable λ estimates
- high goal-difference entropy
- major model disagreement

### Market

- no reliable odds
- stale handicap line
- major unexplained market disagreement

### Line

- poor line stability
- EV disappears after realistic margin assumptions
- aggressive handicap unsupported by score distribution

### Squad

- major lineup uncertainty
- key players unresolved
- goalkeeper uncertainty

---

# 73. HANDICAP ENTROPY

Calculate uncertainty across the goal-difference distribution.

High entropy means:

```text
many different margins are plausible
```

Low entropy means:

```text
probability is concentrated around a smaller number of margins
```

High entropy should reduce confidence.

---

# 74. TOP MARGIN CONCENTRATION

Calculate:

```text
P(Home +1)
P(Home +2)
P(Home +3)
...
```

and:

```text
P(Away +1)
P(Away +2)
P(Away +3)
...
```

Also calculate:

```text
Top 3 goal-difference probabilities
Top 5 goal-difference probabilities
```

This helps determine whether the handicap edge is robust.

---

# 75. SENSITIVITY ANALYSIS

Test how the handicap prediction changes when:

```text
λ_home
```

and:

```text
λ_away
```

move slightly.

For example:

```text
λ_home ± 0.10
λ_away ± 0.10
```

If the recommendation remains profitable across reasonable parameter changes:

```text
ROBUSTNESS = HIGH
```

If a tiny change destroys the edge:

```text
ROBUSTNESS = LOW
```

Reduce confidence accordingly.

---

# 76. MONTE CARLO VALIDATION

Where computationally practical, perform Monte Carlo simulation from the calibrated scoring distributions.

Simulate a large number of matches.

For example:

```text
100,000 simulations
```

using the model's scoring distributions.

Estimate:

```text
handicap win
half win
push
half loss
loss
```

Compare simulation results against analytical calculations.

The simulation must not replace the mathematical model.

It should validate it.

---

# 77. CROSS-MARKET CONSISTENCY

The handicap engine should communicate with:

```text
BTTS ENGINE
OVER/UNDER ENGINE
WIN ENGINE
CORRECT SCORE ENGINE
```

The four models should share the same validated underlying dataset.

Check:

### Win

Does handicap direction agree with likely winner?

### Correct Score

Do likely scorelines support the handicap?

### Over/Under

Is the goal environment sufficient for the handicap?

### BTTS

Does the opponent have sufficient scoring probability to threaten the handicap?

---

# 78. EXAMPLE OF CROSS-MARKET LOGIC

Suppose the system identifies:

```text
Home Win = strong
BTTS = low
Over 2.5 = moderate
Correct Scores:
2-0
1-0
3-0
```

This creates a coherent environment for:

```text
Home -0.5
Home -0.75
possibly Home -1.0
```

But if the dominant scores are:

```text
1-0
1-1
0-0
```

then:

```text
Home -1.5
```

should be rejected.

The handicap engine must derive its probability from the distribution rather than merely following the winner prediction.

---

# 79. ASIAN HANDICAP VS EUROPEAN HANDICAP

Keep these markets separate.

### Asian Handicap

Allows:

- pushes
- half wins
- half losses
- quarter lines

### European Handicap

Usually produces a three-way market:

```text
Home handicap win
Draw
Away handicap win
```

The engine must calculate European Handicap outcomes from the same score matrix but apply the correct settlement rules.

---

# 80. EUROPEAN HANDICAP

For a European handicap of:

```text
Home -1
```

calculate adjusted score:

```text
Adjusted Home Goals = Home Goals - 1
Adjusted Away Goals = Away Goals
```

Then determine:

```text
Home wins
Draw
Away wins
```

Unlike Asian Handicap -1:

```text
NO PUSH
```

for the exact one-goal margin.

A one-goal home win becomes:

```text
Adjusted Draw
```

which is a European Handicap DRAW.

---

# 81. EUROPEAN HANDICAP OUTPUT

For European handicap:

```text
home_handicap_win_probability
handicap_draw_probability
away_handicap_win_probability
```

must sum approximately:

```text
100%
```

The model should also calculate fair odds for all three outcomes.

---

# 82. RECOMMENDED HANDICAP

The final recommendation must consider:

```text
Probability
+
Fair odds
+
Market odds
+
EV
+
Risk
+
Push protection
+
Half-win protection
+
Model agreement
+
Data quality
+
Line stability
+
Cross-market consistency
```

Do not automatically choose:

```text
strongest team
```

or:

```text
lowest handicap
```

or:

```text
highest odds
```

---

# 83. FINAL HANDICAP RANKING

Rank candidate handicap lines:

```text
Rank 1
Rank 2
Rank 3
```

using:

```text
Risk-adjusted EV
```

Example structure:

```text
1. Home -0.75
   EV: XX%
   Full Win: XX%
   Half Win: XX%
   Loss: XX%
   Confidence: STRONG

2. Home -0.5
   EV: XX%
   Win: XX%
   Confidence: STRONG

3. Home -1.0
   EV: XX%
   Push: XX%
   Confidence: MODERATE
```

Again, values must come from real calculations.

---

# 84. PRIMARY DECISION HIERARCHY

Use this order:

```text
1. Data integrity
2. Fixture validation
3. Home/away performance
4. Team strength
5. Opponent-adjusted performance
6. Recent form
7. Goal-scoring strength
8. Defensive strength
9. Expected goals/scoring intensity
10. Poisson distribution
11. Dixon-Coles correction
12. Goal-difference distribution
13. Handicap settlement calculation
14. Negative Binomial validation
15. Lineup adjustment
16. Match context
17. Rest/schedule
18. 1X2 consistency
19. Correct-score consistency
20. BTTS consistency
21. O/U consistency
22. Market handicap
23. Fair odds
24. EV
25. Calibration
26. Model agreement
27. Sensitivity analysis
28. Risk analysis
29. Final handicap
30. NO-BET gate
```

---

# 85. CORE PRINCIPLE

The engine must NOT think:

> "This team is stronger, therefore take -1.5."

It must think:

> "What is the complete probability distribution of the goal difference, how does that distribution settle against each available handicap line, what is the fair price of each line, what does the market offer, and which line provides the strongest statistically validated risk-adjusted value?"

The system must understand that:

```text
-0.5
-0.75
-1.0
-1.25
-1.5
```

are materially different bets.

The correct handicap is the line where:

```text
MODEL EDGE
+
PRICE
+
PROBABILITY
+
RISK
+
SETTLEMENT STRUCTURE
```

are most favorable.

If no line meets the required standards:

```text
NO BET
```

---

# 86. FINAL PRODUCTION REQUIREMENT

The production Handicap Engine must use:

```text
REAL API DATA
+
HOME/AWAY SPLITS
+
RECENT FORM
+
OPPONENT STRENGTH
+
TEAM STRENGTH
+
ATTACKING STRENGTH
+
DEFENSIVE STRENGTH
+
GOAL DIFFERENCE DISTRIBUTION
+
POISSON
+
DIXON-COLES
+
NEGATIVE BINOMIAL VALIDATION
+
LINEUP DATA
+
GOALKEEPER DATA
+
MATCH CONTEXT
+
REST/SCHEDULE
+
MARKET HANDICAP
+
FAIR ODDS
+
EV
+
CALIBRATION
+
SENSITIVITY ANALYSIS
+
MODEL AGREEMENT
+
CROSS-MARKET VALIDATION
+
STRICT NO-BET FILTER
```

It must NEVER use:

```text
FAKE DATA
DEMO DATA
FABRICATED xG
FABRICATED xGA
FABRICATED ODDS
FABRICATED LINEUPS
MISSING DATA AS ZERO
ARBITRARY HANDICAP ASSUMPTIONS
```

The final objective is **not to predict that a team will win**.

The objective is to determine:

```text
HOW MANY GOALS THE TEAM IS LIKELY TO WIN OR LOSE BY
```

and then determine whether the available handicap line is correctly priced relative to that probability distribution.