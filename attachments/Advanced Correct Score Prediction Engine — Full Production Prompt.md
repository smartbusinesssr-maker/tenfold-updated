# ADVANCED CORRECT SCORE PREDICTION ENGINE
## Production-Grade Football Exact Score Prediction System

---

## 1. OBJECTIVE

Build an advanced, probability-driven **Correct Score Prediction Engine** for football fixtures.

The engine must predict the probability of individual final scorelines such as:

- 0-0
- 1-0
- 0-1
- 1-1
- 2-0
- 0-2
- 2-1
- 1-2
- 2-2
- 3-0
- 0-3
- 3-1
- 1-3
- 3-2
- 2-3
- 3-3
- 4-0
- 0-4
- 4-1
- 1-4
- 4-2
- 2-4
- 4-3
- 3-4
- 4-4
- etc.

The engine must NOT simply output one guessed score.

It must:

1. Fetch real fixture data.
2. Validate the fixture.
3. Build home and away scoring distributions.
4. Estimate expected goals/scoring intensity using only available data.
5. Build a complete scoreline probability matrix.
6. Apply Poisson modelling.
7. Apply Dixon-Coles low-score correction.
8. Adjust for home/away performance.
9. Adjust for opponent strength.
10. Incorporate recent form.
11. Incorporate attacking and defensive strength.
12. Incorporate lineups and player availability.
13. Incorporate match context.
14. Incorporate goal timing.
15. Incorporate BTTS and Over/Under relationships.
16. Validate against the 1X2 model.
17. Validate against the Over/Under model.
18. Validate against the BTTS model.
19. Compare against bookmaker correct-score odds where available.
20. Calculate fair probability and fair odds.
21. Identify the most probable scorelines.
22. Detect when no exact-score prediction is sufficiently reliable.
23. Prefer NO BET rather than forcing a correct-score prediction.

The objective is:

> **Find the most statistically defensible exact scoreline, not the most attractive-looking scoreline.**

---

# 2. ABSOLUTE DATA INTEGRITY RULES

These rules are mandatory.

### NEVER:

- invent statistics
- invent fixtures
- invent odds
- invent lineups
- invent injuries
- invent xG
- invent xGA
- estimate missing xG and present it as actual xG
- estimate missing xGA and present it as actual xGA
- treat missing data as zero
- fabricate historical results
- fabricate H2H records
- fabricate player statistics
- use demo/sample matches
- use fallback fictional data
- manufacture probability values

If a required data point is unavailable:

```text
DATA_UNAVAILABLE
```

must be used internally.

The engine must continue using valid available information where possible.

Missing data must reduce:

- confidence
- model reliability
- prediction eligibility

Do not compensate for missing information by inventing values.

---

# 3. FIXTURE VALIDATION

Before calculating anything, verify:

- fixture ID
- league
- season
- home team
- away team
- kickoff date
- kickoff time
- venue
- fixture status
- competition
- current season
- postponed status
- cancelled status

Reject:

- postponed fixtures
- cancelled fixtures
- completed fixtures when generating pre-match predictions
- duplicate fixtures
- invalid fixture IDs
- fixtures with mismatched teams
- fixtures with corrupted API data

The prediction must always correspond to the exact fixture being analysed.

---

# 4. DATA TO FETCH

Fetch as much relevant real data as API-Football provides without wasting API requests.

The engine should prioritize data that materially improves exact-score modelling.

---

# 5. TEAM SEASON PERFORMANCE

For both teams retrieve:

### Goals scored

- total goals
- goals per match
- home goals per match
- away goals per match
- first-half goals
- second-half goals
- goals scored distribution

### Goals conceded

- total goals conceded
- goals conceded per match
- home goals conceded
- away goals conceded
- first-half goals conceded
- second-half goals conceded

### Match outcomes

- wins
- draws
- losses
- clean sheets
- failed to score

### Goal distributions

Determine frequency of:

```text
0 goals
1 goal
2 goals
3 goals
4 goals
5+ goals
```

Do this separately where possible for:

```text
Home team at home
Away team away
```

---

# 6. HOME/AWAY SPLIT

This is one of the highest-priority inputs.

For the HOME team prioritize:

```text
Home matches only
```

For the AWAY team prioritize:

```text
Away matches only
```

Calculate:

### Home team

- average goals scored at home
- average goals conceded at home
- scoring frequency at home
- clean-sheet frequency at home
- failed-to-score frequency at home
- 2+ goals frequency
- 3+ goals frequency

### Away team

- average goals scored away
- average goals conceded away
- scoring frequency away
- clean-sheet frequency away
- failed-to-score frequency away
- 2+ goals frequency
- 3+ goals frequency

Do NOT treat overall season statistics as equivalent to venue-specific statistics.

---

# 7. RECENT FORM

Analyze:

```text
Last 5
Last 10
```

where sufficient data exists.

For each team calculate:

- goals scored
- goals conceded
- goals per match
- goals scored distribution
- clean sheets
- failed to score
- BTTS frequency
- Over 1.5 frequency
- Over 2.5 frequency
- Under 2.5 frequency
- 2+ goals frequency

Recent matches should receive more weight than old matches.

However:

> Do not allow a tiny recent sample to completely override a much larger historical sample.

---

# 8. OPPONENT-STRENGTH ADJUSTMENT

Raw goals are not enough.

A team scoring 2.0 goals against weak opponents is not necessarily equivalent to a team scoring 2.0 goals against elite opponents.

Adjust attacking and defensive performance according to opponent quality.

Consider:

- league position
- team strength rating
- historical performance
- recent opponent quality
- competition level

Use opponent-adjusted scoring rates where sufficient data exists.

---

# 9. ATTACKING STRENGTH

Calculate separate attacking strength for:

```text
Home team
Away team
```

Inputs may include:

- goals scored
- scoring frequency
- 2+ goal frequency
- shots
- shots on target
- big chances
- offensive possession where useful
- attacking efficiency
- recent scoring
- venue-specific scoring

If xG is actually available from the API/data source:

```text
USE IT.
```

If xG is NOT available:

```text
DO NOT INVENT IT.
```

Never create synthetic xG and label it as real xG.

---

# 10. DEFENSIVE STRENGTH

Calculate:

- goals conceded
- clean sheets
- goals conceded distribution
- 2+ goals conceded frequency
- 3+ goals conceded frequency
- shots conceded
- shots on target conceded
- big chances conceded if available
- defensive errors if available
- recent defensive performance
- home/away defensive performance

Create separate defensive ratings for:

```text
Home defence
Away defence
```

---

# 11. EXPECTED GOALS / SCORING INTENSITY

The engine must estimate:

```text
λ_home
λ_away
```

where:

```text
λ_home = expected home goals
λ_away = expected away goals
```

These are model outputs.

They must NOT simply equal:

```text
season average goals
```

Instead combine:

- team attacking strength
- opponent defensive strength
- venue effect
- recent form
- opponent quality
- league scoring environment
- lineup strength
- relevant tactical factors
- available xG information
- scoring/conceding distributions

If actual xG exists, it can materially influence λ.

If xG does not exist, rely on available goals, shots, SOT, big chances and other verified data.

Do not fabricate xG.

---

# 12. LEAGUE GOAL ENVIRONMENT

Account for the scoring environment of the competition.

Calculate where possible:

```text
league average home goals
league average away goals
league average total goals
```

Use this to normalize team performance.

For example:

```text
Team home scoring rate / league home scoring rate
```

and:

```text
Opponent away concession rate / league away scoring environment
```

This prevents comparing raw goal rates across leagues with significantly different scoring environments.

---

# 13. POISSON SCORE MODEL

For each team calculate:

```text
P(Home scores = x)
```

and:

```text
P(Away scores = y)
```

using:

```text
P(X=k) = (λ^k × e^-λ) / k!
```

Generate probabilities for:

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

Do not stop at 3-3.

High-scoring outcomes need to exist in the mathematical distribution even if they have low probability.

---

# 14. COMPLETE SCORELINE MATRIX

Create a probability matrix.

Example:

| Home \ Away | 0 | 1 | 2 | 3 | 4 | 5+ |
|---|---:|---:|---:|---:|---:|---:|
| 0 | P00 | P01 | P02 | P03 | P04 | P05+ |
| 1 | P10 | P11 | P12 | P13 | P14 | P15+ |
| 2 | P20 | P21 | P22 | P23 | P24 | P25+ |
| 3 | P30 | P31 | P32 | P33 | P34 | P35+ |
| 4 | P40 | P41 | P42 | P43 | P44 | P45+ |
| 5+ | P50+ | P51+ | P52+ | P53+ | P54+ | P55+ |

Every cell represents:

```text
P(Home goals = x AND Away goals = y)
```

The entire matrix must sum to approximately:

```text
100%
```

after normalization.

---

# 15. DIXON-COLES CORRECTION

Apply Dixon-Coles correction to the low-score cells:

```text
0-0
1-0
0-1
1-1
```

The corrected probability is:

```text
P(x,y) =
Poisson(Home=x)
×
Poisson(Away=y)
×
τ(x,y)
```

Use the standard Dixon-Coles correction structure:

```text
τ(0,0) = 1 - λ_home × λ_away × ρ

τ(1,0) = 1 + λ_away × ρ

τ(0,1) = 1 + λ_home × ρ

τ(1,1) = 1 - ρ

τ(x,y) = 1 otherwise
```

Do not blindly hard-code a permanent rho value if the system has enough historical data to calibrate rho.

Preferred:

```text
league-specific rho
```

or:

```text
competition-specific rho
```

where sufficient historical data exists.

Otherwise use a conservative validated default.

After applying correction:

```text
NORMALIZE THE COMPLETE MATRIX
```

so probabilities sum to 100%.

Dixon-Coles is particularly useful for correcting low-scoring scoreline probabilities.

---

# 16. TIME-DECAY WEIGHTING

Recent matches should receive greater influence.

Example conceptual weighting:

```text
Recent matches = higher weight
Older matches = lower weight
```

Do not allow old seasons to dominate current team strength.

The decay rate should ideally be calibrated using historical backtesting.

---

# 17. BIVARIATE DEPENDENCY

Where sufficient historical data exists, test whether home and away goal counts show dependency.

Football goals are not perfectly independent.

Potential causes include:

- game state
- tactical reaction
- leading team becoming defensive
- losing team becoming aggressive
- red cards
- match importance

Use dependency modelling only where validated.

Do not introduce arbitrary correlation simply because it increases a preferred scoreline's probability.

---

# 18. NEGATIVE BINOMIAL / OVERDISPERSION CHECK

Poisson assumes:

```text
Variance ≈ Mean
```

Football scoring data can sometimes show overdispersion.

Test whether:

```text
variance > mean
```

If substantial overdispersion exists, use a Negative Binomial component.

The model can then compare:

```text
Poisson score probability
vs
Negative Binomial score probability
```

and blend them according to historical validation.

Do NOT automatically use Negative Binomial for every match.

---

# 19. GOAL DISTRIBUTION MODEL

Do not only predict the most likely score.

First understand the likely total-goal environment.

Calculate:

```text
P(0 total goals)
P(1 total goal)
P(2 total goals)
P(3 total goals)
P(4 total goals)
P(5+ total goals)
```

Then determine:

```text
Most likely total-goal range
```

Example:

```text
0–2 goals = dominant distribution
```

or:

```text
2–4 goals = dominant distribution
```

This helps constrain the plausible exact-score candidates.

---

# 20. BTTS INTERACTION

Use the existing BTTS model as a consistency layer.

If BTTS probability is high:

Prioritize scorelines where:

```text
Home > 0
AND
Away > 0
```

Examples:

```text
1-1
2-1
1-2
2-2
3-1
1-3
```

If BTTS probability is low:

Increase consideration of:

```text
1-0
0-1
2-0
0-2
0-0
3-0
0-3
```

But:

> BTTS must influence the ranking, not override the underlying score probability.

---

# 21. OVER/UNDER INTERACTION

Use the Over/Under model as another consistency layer.

If:

```text
Over 2.5 probability is high
```

the scoreline model should generally favor scorelines such as:

```text
2-1
1-2
3-0
0-3
3-1
1-3
2-2
3-2
2-3
```

If:

```text
Under 2.5 probability is high
```

the candidate set should naturally contain more:

```text
0-0
1-0
0-1
1-1
2-0
0-2
```

Do not force the correct-score model to match the O/U model.

Use it as a consistency check.

---

# 22. WIN MODEL CONSISTENCY

The highest-ranked exact score must be checked against the existing 1X2 prediction.

For example:

If:

```text
Home Win = 68%
Draw = 20%
Away Win = 12%
```

then a score such as:

```text
0-2
```

should receive strong scrutiny even if its raw scoreline probability is non-zero.

Likewise:

If Draw probability is high, candidate scores should include:

```text
0-0
1-1
2-2
3-3
```

depending on the goal distribution.

The correct-score model must be mathematically compatible with the broader 1X2 distribution.

---

# 23. EXACT SCORE CONSISTENCY RULE

After generating the complete matrix:

Calculate:

```text
Home Win =
sum(all scorelines where home goals > away goals)

Draw =
sum(all scorelines where home goals = away goals)

Away Win =
sum(all scorelines where home goals < away goals)
```

These must approximately match the independent 1X2 model.

If there is a major disagreement:

```text
MODEL_DISAGREEMENT = TRUE
```

and reduce confidence.

Do not silently hide the disagreement.

---

# 24. CORRECT SCORE CANDIDATE RANKING

Rank every scoreline by:

```text
Final Score Probability
```

Then produce:

```text
Rank 1
Rank 2
Rank 3
Rank 4
Rank 5
```

Example output:

```text
1. 1-1 — 12.4%
2. 2-1 — 10.1%
3. 1-0 — 9.7%
4. 2-0 — 8.4%
5. 0-1 — 7.2%
```

The numbers above are examples only.

Never generate example values for live predictions.

---

# 25. SCORELINE CLUSTERING

Do not only examine individual scorelines.

Group related outcomes.

For example:

### Home-controlled cluster

```text
1-0
2-0
2-1
3-0
3-1
```

### Away-controlled cluster

```text
0-1
0-2
1-2
0-3
1-3
```

### Draw cluster

```text
0-0
1-1
2-2
3-3
```

Determine which cluster contains the greatest combined probability.

This provides a stronger indication of the match's underlying scoring shape.

---

# 26. SCORELINE CONCENTRATION

Calculate:

```text
Top 1 score probability
Top 3 combined probability
Top 5 combined probability
Top 10 combined probability
```

This is important.

Example:

```text
Top score = 13%
Top 3 = 34%
Top 5 = 47%
```

is materially different from:

```text
Top score = 7%
Top 3 = 20%
Top 5 = 31%
```

The second match is much more uncertain.

Use score concentration in confidence calculation.

---

# 27. ENTROPY / UNCERTAINTY

Calculate scoreline distribution entropy where practical.

High entropy:

```text
many scorelines have similar probabilities
```

Low entropy:

```text
probability concentrated around a few scorelines
```

High entropy should reduce correct-score confidence.

Low entropy can increase confidence.

This prevents the engine from calling a match "high confidence" merely because one score happens to rank first by a tiny margin.

---

# 28. TOP-SCORE MARGIN

Calculate:

```text
Top Score Probability
-
Second Score Probability
```

Example:

```text
1-1 = 13%
2-1 = 9%
margin = 4 percentage points
```

versus:

```text
1-1 = 9.5%
2-1 = 9.3%
margin = 0.2 percentage points
```

The second situation should have substantially lower confidence.

---

# 29. H2H SCORELINES

Use historical H2H carefully.

Analyze:

- last 5 H2H
- scorelines
- total goals
- BTTS
- home/away context

H2H must NOT dominate.

Old H2H matches can contain:

- different managers
- different squads
- different tactics
- different league positions
- different player quality

Use H2H as a supporting signal only.

---

# 30. LINEUPS AND PLAYER AVAILABILITY

Where API-Football provides reliable information, retrieve:

- confirmed lineups
- predicted lineups
- injuries
- suspensions
- unavailable players
- starting goalkeeper
- key attackers
- key defenders

Apply stronger adjustments when important players are unavailable.

Examples:

### Missing primary striker

Potential effect:

```text
↓ λ_home
```

### Missing starting goalkeeper

Potential effect:

```text
↑ opponent λ
```

### Multiple defensive absences

Potential effect:

```text
↑ opponent scoring probability
```

Never apply arbitrary numerical adjustments without calibration.

The adjustment system should be based on historical performance or validated player-impact models.

---

# 31. GOALKEEPER EFFECT

Goalkeeper availability can materially affect exact-score probabilities.

Where reliable data exists, account for:

- starting goalkeeper
- backup goalkeeper
- clean-sheet frequency
- goals conceded
- goalkeeper quality

Do not exaggerate goalkeeper effects.

---

# 32. GOAL TIMING

Analyze scoring and conceding patterns by period:

```text
0–15
16–30
31–45+
46–60
61–75
76–90+
```

Look for:

- early scoring
- late scoring
- late conceding
- second-half strength
- first-half weakness

Use this to adjust the likelihood of scoreline progression where justified.

Do not convert goal-timing information directly into an arbitrary score without statistical validation.

---

# 33. MATCH CONTEXT

Consider:

- league match
- cup match
- knockout
- first leg
- second leg
- relegation battle
- title race
- qualification
- must-win situation
- rotation risk
- congested schedule

Context may affect:

- attacking intensity
- defensive risk
- rotation
- late-game behavior

Context should modify probabilities only when supported by historical evidence.

---

# 34. REST AND FIXTURE CONGESTION

Check:

- days since previous match
- upcoming important fixtures
- travel burden where available
- fixture congestion
- rotation probability

A heavily congested team may have reduced attacking or defensive performance.

Do not assume fatigue automatically means more goals.

Use historical evidence where possible.

---

# 35. TACTICAL MATCHUP

Analyze available tactical information:

- possession profile
- pressing intensity
- defensive block
- transition style
- attacking width
- crossing
- set pieces
- counterattacking tendency

The goal is not to create subjective football commentary.

Use tactical information only when it has measurable predictive value.

---

# 36. MARKET VALIDATION

Where bookmaker correct-score odds are available, retrieve them.

For each score:

```text
Implied Probability = 1 / Decimal Odds
```

Remove bookmaker margin where possible.

Compare:

```text
MODEL PROBABILITY
vs
MARKET IMPLIED PROBABILITY
```

Calculate:

```text
Edge =
Model Probability
-
Fair Market Probability
```

Correct-score markets usually contain significant bookmaker margin and are high variance.

Therefore:

> Market disagreement must NOT automatically mean the bookmaker is wrong.

The market should be treated as an external validation signal.

---

# 37. FAIR ODDS

For each scoreline:

```text
Fair Odds = 1 / Model Probability
```

Example:

```text
Model probability = 0.10

Fair odds = 10.00
```

Only calculate this when probability > 0.

---

# 38. EXPECTED VALUE

If actual bookmaker odds exist:

```text
EV = (Model Probability × Decimal Odds) - 1
```

Example:

```text
Probability = 0.12
Odds = 10.00

EV = (0.12 × 10) - 1
EV = 0.20
```

Therefore:

```text
+20% theoretical EV
```

But EV does not mean the prediction is likely to win.

Exact-score bets remain high variance.

---

# 39. MARKET/MODEL DISAGREEMENT

Detect:

```text
MODEL strongly favors score
MARKET strongly disagrees
```

Do not immediately select the score.

Investigate:

- lineup information
- injuries
- fixture context
- stale model data
- stale odds
- unusual market movement
- insufficient historical sample
- data-quality problems

If the disagreement cannot be explained:

```text
REDUCE CONFIDENCE
```

or:

```text
NO BET
```

---

# 40. ENSEMBLE MODEL

Use multiple independent components.

Recommended architecture:

### Model 1 — Poisson

Base score probability.

### Model 2 — Dixon-Coles

Low-score correction.

### Model 3 — Recent Form

Time-weighted current performance.

### Model 4 — Home/Away Model

Venue-specific scoring and conceding.

### Model 5 — Opponent-Adjusted Model

Adjusts team strength according to opposition.

### Model 6 — Negative Binomial

Handles overdispersion where validated.

### Model 7 — Team Strength Model

Elo/strength rating component.

### Model 8 — Market Model

De-vigged bookmaker information.

### Model 9 — Lineup/Squad Model

Player availability adjustment.

### Model 10 — Goal Distribution Model

Controls the expected total-goal environment.

---

# 41. STARTING ENSEMBLE WEIGHTS

Use these as initial weights only.

They MUST be backtested and recalibrated.

```text
Poisson baseline                  20%
Dixon-Coles                       15%
Home/Away performance             12%
Opponent-adjusted form            10%
Team strength/Elo                  8%
Recent scoring form                8%
Defensive strength                 7%
Goal distribution                  6%
Negative Binomial                  4%
Lineup/squad                       4%
Market validation                  3%
H2H                                1%
Tactical/context                   2%
```

Total:

```text
100%
```

Do not assume these weights are optimal.

The production system should eventually learn optimal weights from historical backtesting.

---

# 42. PROBABILITY CALIBRATION

The engine must be calibrated historically.

Track:

- predicted probability
- actual outcome
- Brier score
- log loss
- calibration curve
- top-1 accuracy
- top-3 hit rate
- top-5 hit rate
- mean reciprocal rank
- scoreline probability calibration

Do NOT optimize only for raw correct-score hit rate.

A model that predicts:

```text
1-1 = 15%
```

must be evaluated on whether 1-1 actually occurs approximately 15% of the time across a large sample.

Probability calibration is more important than a short-term hit rate.

---

# 43. LEAGUE-SPECIFIC CALIBRATION

Do not assume every league behaves identically.

Track performance by:

- league
- country
- competition
- season
- home/away
- scoreline
- total-goal environment

If a league has insufficient historical data:

```text
SHRINK TOWARD GLOBAL/REGIONAL AVERAGES
```

Do not create extreme league-specific parameters from tiny samples.

---

# 44. DATA QUALITY SCORE

Create:

```text
DATA_QUALITY_SCORE
```

from 0–100.

Consider:

- fixture validity
- number of historical matches
- home/away sample size
- recent-form availability
- lineup availability
- odds availability
- statistics completeness
- team identity consistency
- competition consistency

Example:

```text
90–100 = Excellent
80–89  = Very Good
70–79  = Good
60–69  = Moderate
50–59  = Weak
<50    = Reject
```

These thresholds should be configurable.

---

# 45. MODEL AGREEMENT SCORE

Compare:

- Poisson
- Dixon-Coles
- recent form
- home/away model
- team-strength model
- market model
- lineup model

If several independent models converge around the same score cluster:

```text
MODEL_AGREEMENT ↑
```

If models disagree significantly:

```text
MODEL_AGREEMENT ↓
```

Do not hide disagreement.

---

# 46. CORRECT SCORE CONFIDENCE

Correct-score confidence must depend on:

```text
Top score probability
+
Top-score margin
+
Top-3 concentration
+
Model agreement
+
Data quality
+
1X2 consistency
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

Do NOT define confidence purely from the top score probability.

---

# 47. CORRECT SCORE CLASSIFICATION

Use conservative screening.

### ELITE

```text
Very strong probability concentration
+
Strong model agreement
+
High data quality
+
Cross-market consistency
```

### STRONG

```text
Strong top-score probability
+
Good model agreement
+
Good data quality
```

### MODERATE

```text
Reasonable probability
+
some model uncertainty
```

### WEAK

```text
Low score concentration
OR
high model disagreement
```

### NO BET

```text
Insufficient data
OR
high entropy
OR
no meaningful top-score separation
OR
major cross-market disagreement
OR
poor calibration
```

Correct-score predictions should have a much higher rejection rate than normal 1X2 predictions.

---

# 48. TOP 5 OUTPUT

Always calculate the top five scorelines internally.

Output:

```text
Rank
Score
Probability
Fair Odds
Model Agreement
Confidence
```

Example structure:

```text
1. 1-1
Probability: XX%
Fair Odds: X.XX
Confidence: STRONG

2. 2-1
Probability: XX%
Fair Odds: X.XX
Confidence: MODERATE

3. 1-0
Probability: XX%
Fair Odds: X.XX
Confidence: MODERATE
```

The example values above are placeholders only.

Never use them for real predictions.

---

# 49. PRIMARY CORRECT SCORE

The primary score should be:

```text
highest calibrated final probability
```

subject to:

- data-quality gate
- model-agreement gate
- cross-market consistency
- probability concentration
- scoreline plausibility
- lineup validation

Do NOT simply select:

```text
highest raw Poisson score
```

The final score must come from the calibrated ensemble.

---

# 50. SECONDARY SCORE

The system may output:

```text
Primary Correct Score
Secondary Correct Score
```

ONLY if the secondary score has meaningful probability and is sufficiently independent.

Do not output ten "predictions" just to increase the chance of appearing correct.

---

# 51. SCORE CLUSTER RECOMMENDATION

Also output the dominant score family.

Example:

```text
Primary Score: 2-1

Dominant Score Cluster:
Home win with 2–1 / 2–0 / 1–0
```

or:

```text
Primary Score: 1-1

Dominant Score Cluster:
Low-scoring draw
```

This helps interpret the model without pretending that one exact score is certain.

---

# 52. CROSS-MARKET CONSISTENCY CHECK

The correct-score model must be checked against:

### 1X2

Does the score imply the predicted winner/draw?

### BTTS

Does the score agree with BTTS probability?

### Over/Under

Does the total goals agree with the expected goal environment?

### Goal expectancy

Does the score approximately correspond to:

```text
λ_home
λ_away
```

### Team scoring probability

Does the score make sense given each team's probability of scoring?

If major contradictions exist:

```text
MODEL_CONFLICT = TRUE
```

Reduce confidence or reject the prediction.

---

# 53. EXAMPLE OF CONSISTENCY LOGIC

Suppose:

```text
Home Win = 62%
Draw = 23%
Away Win = 15%

BTTS = 58%

Over 2.5 = 57%

λ_home = 1.75
λ_away = 1.05
```

The candidate scorelines should naturally concentrate around combinations such as:

```text
2-1
1-1
2-0
1-0
2-2
3-1
```

A score such as:

```text
0-3
```

should require exceptionally strong evidence before becoming the primary prediction.

This is not because 0-3 is impossible.

It is because the complete probability distribution must remain internally consistent.

---

# 54. NO-BET RULES

Return:

```text
NO BET
```

when any of the following occur:

### Data problems

- insufficient historical data
- invalid fixture
- missing critical data
- stale data
- corrupted API response

### Model problems

- very high score entropy
- top score barely ahead of second
- large model disagreement
- unstable λ estimates
- unstable lineup situation

### Cross-market problems

- correct score contradicts 1X2
- correct score contradicts BTTS
- correct score contradicts goal distribution
- major market disagreement without explanation

### Probability problems

- top score probability below configurable minimum
- top-3 concentration too low
- no meaningful scoreline separation

Do not force an exact score simply because the user requested one.

---

# 55. SCORELINE RISK FLAGS

Generate flags such as:

```text
HIGH_SCORELINE_VARIANCE
LOW_SCORE_CONCENTRATION
MODEL_DISAGREEMENT
LINEUP_UNCERTAINTY
MARKET_DISAGREEMENT
SMALL_SAMPLE
H2H_UNRELIABLE
LOW_DATA_QUALITY
HIGH_GOAL_VARIANCE
LOW_GOAL_VARIANCE
DRAW_RISK
UPSET_RISK
```

These should be visible to the internal engine and optionally to administrators.

---

# 56. FINAL OUTPUT STRUCTURE

Return a structured object similar to:

```json
{
  "fixture_id": "...",
  "home_team": "...",
  "away_team": "...",

  "lambda_home": 0.00,
  "lambda_away": 0.00,

  "primary_correct_score": "X-X",
  "primary_probability": 0.00,
  "primary_fair_odds": 0.00,

  "top_scores": [
    {
      "score": "X-X",
      "probability": 0.00,
      "fair_odds": 0.00,
      "rank": 1
    },
    {
      "score": "X-X",
      "probability": 0.00,
      "fair_odds": 0.00,
      "rank": 2
    }
  ],

  "home_win_probability": 0.00,
  "draw_probability": 0.00,
  "away_win_probability": 0.00,

  "btts_probability": 0.00,

  "over_1_5_probability": 0.00,
  "over_2_5_probability": 0.00,
  "over_3_5_probability": 0.00,

  "most_likely_total_goals": "...",

  "score_cluster": "...",

  "top_score_margin": 0.00,
  "top_3_concentration": 0.00,
  "top_5_concentration": 0.00,

  "model_agreement": 0.00,
  "data_quality": 0.00,

  "confidence": "...",

  "risk_flags": [],

  "market_probability": 0.00,
  "model_edge": 0.00,

  "recommendation": "BET / NO BET"
}
```

---

# 57. DATABASE STORAGE

Store every prediction before kickoff.

Store:

```text
fixture_id
prediction_timestamp
model_version
home_team
away_team

lambda_home
lambda_away

score_matrix

primary_score
primary_probability

top_5_scores

1X2 probabilities
BTTS probability
O/U probabilities

data_quality
model_agreement

market odds
fair odds
EV

confidence
risk flags

prediction status
```

Once kickoff occurs:

```text
LOCK PREDICTION
```

Do not modify the original prediction after the match starts.

This is critical for honest performance tracking.

---

# 58. AUTOMATIC SETTLEMENT

After the final result becomes available:

Retrieve:

```text
actual_home_goals
actual_away_goals
```

Construct:

```text
actual_score = "X-X"
```

Compare against:

```text
primary_correct_score
```

Then record:

```text
HIT
MISS
```

Also record whether the actual result fell inside:

```text
Top 3
Top 5
Top 10
```

---

# 59. PERFORMANCE TRACKING

Track correct-score performance by:

### Overall

- exact-score hit rate
- top-3 hit rate
- top-5 hit rate
- top-10 hit rate
- average predicted probability of actual score
- log loss
- Brier score where applicable

### By league

- league hit rate
- calibration
- average score entropy

### By confidence

```text
Elite
Strong
Moderate
Weak
```

### By scoreline

```text
0-0
1-0
0-1
1-1
2-0
0-2
2-1
1-2
2-2
etc.
```

---

# 60. CALIBRATION FEEDBACK LOOP

After enough historical matches:

Analyze:

```text
Predicted 5% scores
Predicted 10% scores
Predicted 15% scores
Predicted 20% scores
```

Compare predicted vs actual frequencies.

If the model systematically overestimates certain scores:

```text
calibrate downward
```

If it systematically underestimates:

```text
calibrate upward
```

Calibration must be performed using historical out-of-sample data.

Never calibrate using future match results.

---

# 61. MODEL VERSIONING

Every prediction must contain:

```text
model_version
```

Example:

```text
correct_score_v1.0
correct_score_v1.1
correct_score_v2.0
```

When weights or methodology change:

```text
increment model version
```

This allows performance comparison between model generations.

---

# 62. API EFFICIENCY

Do not repeatedly fetch the same information for:

```text
BTTS
Over/Under
Win
Correct Score
```

If the SmartMatchPick architecture runs all prediction engines on the same fixture:

Create a shared:

```text
MATCH_ANALYTICS_DATASET
```

containing:

- fixture
- teams
- standings
- form
- home/away stats
- H2H
- injuries
- lineups
- odds
- goals
- shots
- shots on target
- relevant player data

Then allow:

```text
BTTS ENGINE
OVER/UNDER ENGINE
WIN ENGINE
CORRECT SCORE ENGINE
```

to consume the same validated dataset.

This significantly reduces duplicate API requests.

---

# 63. DATA FETCH PRIORITY

When API request limits exist, prioritize:

### Tier 1 — Mandatory

- fixture
- teams
- recent results
- home/away results
- standings
- goals
- injuries/lineups when available
- odds where available

### Tier 2 — High value

- shots
- shots on target
- big chances
- H2H
- player availability

### Tier 3 — Enhancement

- detailed player statistics
- goal timing
- tactical information

Only perform expensive additional requests after the fixture passes the initial eligibility filters.

---

# 64. DO NOT OVERFIT

Do not create dozens of adjustments simply because historical data shows a temporary relationship.

Every additional feature must demonstrate:

```text
out-of-sample predictive improvement
```

before receiving significant weight.

Prefer:

```text
simple + calibrated + validated
```

over:

```text
complex + overfit
```

---

# 65. IMPORTANT DISTINCTION

Correct-score probability is NOT the same thing as prediction confidence.

For example:

```text
1-1 = 13%
```

does NOT mean:

```text
13% confidence that the match will finish 1-1
```

It means:

```text
the model estimates a 13% probability for that exact score.
```

Correct-score probabilities will often be relatively low because the outcome space is large.

---

# 66. PRIMARY DECISION LOGIC

Use this hierarchy:

```text
1. Data integrity
2. Fixture validation
3. Home/away performance
4. Team attacking strength
5. Defensive strength
6. Opponent-adjusted performance
7. League scoring environment
8. Recent form
9. Expected scoring rates
10. Poisson distribution
11. Dixon-Coles correction
12. Scoreline matrix
13. Goal distribution
14. BTTS interaction
15. Over/Under interaction
16. 1X2 interaction
17. Lineups/injuries
18. Rest/context
19. H2H
20. Market validation
21. Probability calibration
22. Model agreement
23. Risk analysis
24. Final correct-score selection
25. NO-BET gate
```

---

# 67. CORE PRINCIPLE

The engine must never think:

> "Which score looks most likely?"

It must think:

> "What is the calibrated probability distribution across all possible scorelines, and which exact score has the strongest statistically supported probability after accounting for team strength, venue, recent form, opponent quality, scoring rates, low-score dependency, lineups, goal environment, market information, and cross-market consistency?"

The engine must be comfortable returning:

```text
NO BET
```

when the probability distribution is too uncertain.

---

# 68. FINAL REQUIREMENT

The Correct Score Engine must use:

```text
REAL API DATA
+
VALIDATED HISTORICAL DATA
+
STATISTICAL MODELLING
+
POISSON
+
DIXON-COLES
+
HOME/AWAY SPLITS
+
OPPONENT ADJUSTMENT
+
RECENT FORM
+
GOAL DISTRIBUTION
+
LINEUP ANALYSIS
+
BTTS CONSISTENCY
+
OVER/UNDER CONSISTENCY
+
1X2 CONSISTENCY
+
MARKET VALIDATION
+
CALIBRATION
+
MODEL AGREEMENT
+
STRICT NO-BET FILTER
```

It must never use:

```text
fake data
demo data
invented xG
invented xGA
invented odds
invented lineups
missing data treated as zero
arbitrary score guesses
```

The final system should prioritize **probability quality and calibration over the number of predictions produced**.

A correct-score prediction is only valuable when the underlying probability distribution is defensible.