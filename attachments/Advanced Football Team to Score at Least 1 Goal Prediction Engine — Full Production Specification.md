# ADVANCED FOOTBALL TEAM TO SCORE AT LEAST 1 GOAL ENGINE
## Production-Grade Team Goal Probability, Value & Risk Framework

---

# 1. OBJECTIVE

Build a production-grade football prediction engine that identifies teams with a high probability of scoring **at least one goal** in a match.

The engine must calculate:

```text
P(Home Team Scores ≥ 1)
P(Away Team Scores ≥ 1)
```

The primary market is:

```text
Home Team Over 0.5 Goals
Away Team Over 0.5 Goals
```

The engine must NOT confuse this with:

```text
Match Over 0.5
BTTS
Over 1.5 Match Goals
Team Over 1.5 Goals
Match Winner
```

These are different probabilities and must be modeled separately.

---

# 2. PRIMARY MATHEMATICAL DEFINITION

For a selected team:

```text
Team Goal ≥ 1
```

means:

```text
Goals scored by selected team >= 1
```

Therefore:

```text
P(Team Scores ≥ 1)
=
1 - P(Team Scores = 0)
```

If the expected goals rate for the selected team is:

```text
λ_team
```

under a Poisson baseline:

```text
P(0 goals) = e^-λ_team
```

Therefore:

```text
P(Team Scores ≥ 1)
=
1 - e^-λ_team
```

This probability must be calculated from the final calibrated scoring distribution, not blindly from raw λ.

---

# 3. ABSOLUTE DATA INTEGRITY RULES

Use REAL API-Football data only.

Never fabricate:

- Fixtures
- Results
- Team statistics
- Goals
- Shots
- Shots on target
- Big chances
- Possession
- xG
- Injuries
- Suspensions
- Lineups
- Odds
- H2H
- Goal timing
- Tactical information

Never create sample/demo matches.

Never create fake statistics to fill missing API data.

---

# 4. MISSING DATA POLICY

Missing data is:

```text
UNAVAILABLE
```

It is NOT:

```text
0
```

For example:

If shots on target are unavailable:

```text
shots_on_target = null
```

Do not convert this into:

```text
shots_on_target = 0
```

The model must dynamically reduce the influence of unavailable features.

---

# 5. XGA RESTRICTION

The system does NOT have reliable xGA trend data.

Therefore:

### NEVER USE

- xGA trend
- fabricated xGA
- estimated xGA presented as observed data

If actual xG exists in API-Football data, use it.

If xG does not exist:

```text
xG feature = unavailable
```

Do not invent xG.

The model must rely on observed goals and other available statistics.

---

# 6. FIXTURE VALIDATION

Before prediction:

1. Validate fixture ID.
2. Validate home team.
3. Validate away team.
4. Validate competition.
5. Validate season.
6. Validate kickoff time.
7. Confirm match has not started.
8. Confirm correct home/away orientation.
9. Confirm historical statistics belong to the correct team.
10. Confirm data is sufficiently recent.

Reject invalid fixtures.

---

# 7. SHARED DATA ARCHITECTURE

This engine must use the same normalized match dataset as:

- BTTS
- Over/Under
- Draw
- Win
- Correct Score
- Handicap
- Corners

Architecture:

```text
API-Football
     ↓
Data Fetch Layer
     ↓
Cache
     ↓
Normalized Match Dataset
     ↓
Prediction Engines
```

Do not fetch the same team statistics separately for every engine.

---

# 8. TEAM-SPECIFIC OBJECTIVE

For every fixture evaluate both teams separately.

Example:

```text
Home Team:
P(Score ≥ 1) = 84%

Away Team:
P(Score ≥ 1) = 68%
```

These are two independent team-scoring evaluations.

The engine may recommend:

```text
Home Team Over 0.5
```

without recommending:

```text
Away Team Over 0.5
```

---

# 9. TEAM SCORING HISTORY

For the selected team collect:

### Season

- Matches
- Goals scored
- Goals per match
- Matches scored in
- Failed-to-score matches
- Scored at least 1
- Scored 2+
- Scored 3+
- Clean sheets
- Goals scored home/away

### Last 5

- Goals scored
- Matches scored in
- Failed to score
- Average goals
- Median goals
- Scoring frequency

### Last 10

Same metrics.

---

# 10. SCORING FREQUENCY

Calculate:

```text
Scoring Rate =
Matches where team scored ≥1 / Matches
```

Calculate separately:

```text
Season Scoring Rate
Last 10 Scoring Rate
Last 5 Scoring Rate
Home Scoring Rate
Away Scoring Rate
```

For a home team, prioritize:

```text
Home Scoring Rate
```

For an away team, prioritize:

```text
Away Scoring Rate
```

---

# 11. FAILED-TO-SCORE ANALYSIS

Calculate:

```text
Falling-to-Score Rate
=
Matches with 0 goals / Matches
```

This is one of the most important opposing signals.

Example:

```text
Home team failed to score:
Season: 12%
Home: 8%
Last 10: 10%
```

This provides strong evidence for a high probability of scoring at least once.

But sample size must be considered.

---

# 12. HOME/AWAY SPLITS

This is mandatory.

For a home team:

```text
Home scoring statistics
```

must receive greater weight.

For an away team:

```text
Away scoring statistics
```

must receive greater weight.

Do not use overall statistics as the primary signal when reliable venue-specific data exists.

---

# 13. OPPONENT DEFENSIVE DATA

For the opposing team collect:

- Goals conceded
- Goals conceded per match
- Matches conceded ≥1
- Matches conceded 2+
- Clean sheets
- Home/away defensive statistics
- Last 5 defensive record
- Last 10 defensive record
- Season defensive record

For a home attacking team:

```text
Opponent Away Defensive Performance
```

should receive greater weight.

For an away attacking team:

```text
Opponent Home Defensive Performance
```

should receive greater weight.

---

# 14. OPPONENT CONCEDE RATE

Calculate:

```text
Opponent Conceding Rate =
Matches opponent conceded ≥1 / Matches
```

Also calculate:

```text
Opponent conceded 2+
Opponent clean sheets
Opponent goals conceded per match
```

A team that concedes in 85% of relevant matches provides stronger support for the selected team to score.

---

# 15. ATTACKING STRENGTH

Build a team attacking-strength score using available data.

Possible inputs:

- Goals scored per match
- Scoring frequency
- Goals scored home/away
- Recent goals
- Shots
- Shots on target
- Big chances
- Attacking statistics
- xG if actually available

Never force unavailable statistics into the model.

---

# 16. SHOTS

Where available collect:

- Shots per match
- Shots on target
- Shots inside box
- Shots outside box
- Blocked shots
- Shot accuracy

Analyze:

```text
Shot Volume
Shot Quality
Shot Accuracy
```

The goal is to determine whether the team's scoring frequency is supported by repeatable attacking activity.

---

# 17. SHOTS ON TARGET

Calculate:

```text
SOT per match
SOT conversion
SOT frequency
```

Use this as a supporting attacking feature.

Do not assume:

```text
More shots = guaranteed goal
```

The feature should be statistically validated.

---

# 18. BIG CHANCES

If available:

- Big chances created
- Big chances missed
- Big chances per match

Calculate:

```text
Big Chance Creation Rate
```

and:

```text
Big Chance Conversion
```

Use cautiously because small samples can create extreme percentages.

---

# 19. xG LAYER

If actual API xG data is available:

Use:

```text
xG per match
xG home/away
recent xG
```

and compare:

```text
Observed Goals
vs
xG
```

This can identify finishing overperformance/underperformance.

Example:

```text
Goals = 0.9
xG = 1.6
```

may indicate the team has generated scoring opportunities despite poor finishing.

But:

### Never estimate missing xG.

---

# 20. GOAL CONVERSION

Where sufficient shot data exists calculate:

```text
Goal Conversion =
Goals / Shots
```

and:

```text
SOT Conversion =
Goals / Shots on Target
```

Do not over-weight conversion because finishing rates are volatile.

Use regression/shrinkage toward league averages when samples are small.

---

# 21. EXPECTED TEAM GOALS

Construct:

```text
λ_home_team
λ_away_team
```

using:

### Attack

- Team scoring rate
- Team goals per match
- Home/away attack
- Recent scoring
- Shots
- SOT
- Big chances
- xG if available

### Opponent

- Goals conceded
- Opponent clean sheets
- Opponent conceded ≥1
- Opponent conceded 2+
- Venue-specific defense
- Recent defense

### League

- League scoring baseline
- Venue scoring baseline

### Context

- Squad availability
- Rest
- Match context

---

# 22. EXPECTED-GOALS BLENDING

Do not simply average all statistics.

Use a structured model:

```text
Team Attack Strength
+
Opponent Defensive Weakness
+
Venue Adjustment
+
League Baseline
+
Recent Form
+
Available Chance-Creation Data
```

Generate:

```text
λ_team
```

Then calibrate it historically.

---

# 23. POISSON TEAM-GOAL MODEL

Baseline:

```text
P(X = k)
=
(e^-λ × λ^k) / k!
```

Calculate:

```text
P(0)
P(1)
P(2)
P(3)
P(4)
P(5+)
```

Then:

```text
P(Team ≥ 1)
=
1 - P(0)
```

---

# 24. NEGATIVE BINOMIAL MODEL

Football scoring can exhibit overdispersion.

Test whether:

```text
Variance > Mean
```

If justified, run a Negative Binomial model.

Compare:

```text
Poisson
vs
Negative Binomial
```

using historical out-of-sample validation.

Do not automatically assume Negative Binomial is superior.

---

# 25. ZERO-INFLATION ANALYSIS

Evaluate whether the team produces significantly more zero-goal matches than expected under the baseline model.

If justified, use a zero-inflated framework.

This is particularly useful for teams with:

- inconsistent attacks
- frequent failed-to-score matches
- very low shot volume

Do not introduce zero inflation without empirical justification.

---

# 26. HOME TEAM SCORING MODEL

For the home team calculate:

```text
Home Attack Strength
+
Away Defense Weakness
+
Home Scoring Rate
+
Away Concede Rate
+
League Home Goal Baseline
```

Produce:

```text
P(Home ≥ 1)
```

---

# 27. AWAY TEAM SCORING MODEL

For the away team calculate:

```text
Away Attack Strength
+
Home Defense Weakness
+
Away Scoring Rate
+
Home Concede Rate
+
League Away Goal Baseline
```

Produce:

```text
P(Away ≥ 1)
```

---

# 28. OPPONENT-ADJUSTED ATTACK

Do not treat all goals equally.

Scoring 2 goals against a weak defense is different from scoring 2 against an elite defense.

Adjust recent attacking performance based on:

```text
Opponent defensive strength
```

Similarly adjust opponent defensive statistics based on the quality of teams faced.

---

# 29. RECENT FORM

Use:

```text
Last 5
Last 10
Season
```

with controlled temporal weighting.

Recent matches should matter, but one unusual result must not dominate the model.

Use shrinkage.

---

# 30. SCORING MOMENTUM

Calculate:

```text
Recent scoring rate
vs
Season scoring rate
```

Example:

```text
Season = 72%
Last 10 = 80%
Last 5 = 100%
```

This can indicate positive scoring momentum.

But:

```text
3/3
```

must not be treated as definitive proof.

---

# 31. OPPONENT DEFENSIVE MOMENTUM

Calculate:

```text
Opponent concede rate:
Season
Last 10
Last 5
Venue
```

Identify:

```text
Improving defense
Stable defense
Declining defense
```

Use statistically meaningful changes only.

---

# 32. CLEAN SHEET ANALYSIS

Calculate opponent:

```text
Clean Sheet %
```

Separate:

```text
Season
Home/Away
Last 5
Last 10
```

A low opponent clean-sheet rate supports the selected team scoring.

---

# 33. MATCHUP SCORE

Create:

```text
Team Scoring Matchup Score
0–100
```

based on:

- Team attacking strength
- Opponent defensive weakness
- Venue split
- Recent scoring
- Scoring frequency
- Shot quality
- SOT
- Big chances
- xG if available
- league baseline

---

# 34. GOALKEEPER ANALYSIS

Where player data is available evaluate:

- Starting goalkeeper
- Backup goalkeeper
- Clean-sheet performance
- Goals conceded
- Availability

A missing starting goalkeeper can materially change:

```text
Opponent defensive strength
```

but do not create unsupported goalkeeper ratings.

---

# 35. INJURIES AND SUSPENSIONS

Collect:

- Main striker availability
- Main creator availability
- Key attacking players
- Defensive players
- Goalkeeper

Estimate impact only when player data supports it.

Do not automatically classify an injured player as a fixed percentage reduction.

Use historical/team-specific evidence where possible.

---

# 36. EXPECTED LINEUP

If confirmed lineup is available:

Recalculate:

```text
λ_team
```

before prediction lock.

If lineup is unavailable:

```text
lineup_uncertainty = true
```

Do not fabricate lineups.

---

# 37. GOAL-TIMING DATA

Where available analyze:

- 0–15
- 16–30
- 31–45+
- 46–60
- 61–75
- 76–90+

Calculate:

```text
Probability team scores at least once in each period
```

This can identify teams that regularly score late.

Do not treat missing timing data as zero.

---

# 38. GAME-STATE BEHAVIOR

Analyze:

- Scoring first
- Conceding first
- Response after conceding
- Late scoring
- Leading behavior
- Trailing behavior

A team that consistently produces goals after conceding may have a higher scoring probability than raw season averages indicate.

---

# 39. MATCH CONTEXT

Where data is available evaluate:

- League position
- Title race
- Relegation battle
- Qualification
- Cup match
- Playoff
- Must-win situation
- Rotation risk

Context is secondary.

Never allow context to override strong statistical evidence.

---

# 40. REST AND FATIGUE

Calculate:

- Days since previous match
- Matches in previous 14 days
- Matches in previous 21 days
- Congestion

Use carefully.

Do not automatically reduce attacking output because of fixture congestion.

---

# 41. H2H

Use H2H as a secondary feature only.

Collect:

- Last 5 H2H
- Selected team's scoring frequency
- Goals scored
- Failed-to-score

Prioritize current:

```text
Attack
Defense
Home/Away
Form
Squad
```

over old H2H.

---

# 42. BTTS RELATIONSHIP

The BTTS model can provide contextual information.

Example:

```text
Team A Over 0.5 = 86%
Team B Over 0.5 = 72%
BTTS = 65%
```

This is coherent.

But:

```text
Team A Over 0.5
```

must remain its own probability.

Do not derive team scoring probability directly from BTTS.

---

# 43. OVER/UNDER RELATIONSHIP

Use the Over/Under model as a cross-check.

For example:

```text
Team A ≥1 goal = 87%
Match Over 1.5 = 82%
```

is generally coherent.

But:

```text
Team A ≥1 = 87%
Match Over 1.5 = 45%
```

may still be mathematically possible if Team A is likely to score exactly one and Team B is unlikely to score.

Therefore do not automatically classify such output as an error.

Check the complete score distribution.

---

# 44. CORRECT SCORE CONSISTENCY

The team-to-score probability must equal:

```text
P(1-0)
+
P(1-1)
+
P(1-2)
+
P(2-0)
+
P(2-1)
+
...
```

for the selected team.

For the home team:

```text
P(Home ≥1)
=
1 - sum(Home score = 0)
```

For the away team:

```text
P(Away ≥1)
=
1 - sum(Away score = 0)
```

The score model is the mathematical source of truth.

---

# 45. DRAW INTERACTION

A team can have a high probability of scoring while the match still has a high draw probability.

Example:

```text
Home ≥1 = 84%
Away ≥1 = 82%
Draw = 35%
```

This can happen because 1-1 and 2-2 are plausible.

Do not treat draw probability as a contradiction.

---

# 46. TEAM OVER 0.5 VS TEAM OVER 1.5

These are separate markets.

Calculate:

```text
P(Team ≥1)
P(Team ≥2)
P(Team ≥3)
```

For example:

```text
Team ≥1 = 86%
Team ≥2 = 57%
Team ≥3 = 29%
```

A strong Team Over 0.5 recommendation does NOT automatically imply Team Over 1.5.

---

# 47. SCORING DISTRIBUTION

Return:

```text
P(0 goals)
P(1 goal)
P(2 goals)
P(3 goals)
P(4 goals)
P(5+ goals)
```

Example:

```text
0 = 13%
1 = 31%
2 = 28%
3 = 16%
4+ = 12%
```

Therefore:

```text
P(≥1) = 87%
```

This provides much more information than a single percentage.

---

# 48. MODEL ENSEMBLE

Use multiple models.

Minimum:

### Model 1
Poisson

### Model 2
Negative Binomial

### Model 3
Home/Away Attack-Defense Model

### Model 4
Opponent-Adjusted Scoring Model

### Model 5
Recent Scoring Model

### Model 6
Shot/SOT Model

### Model 7
xG Model — ONLY if actual xG exists

### Model 8
Bayesian Scoring-Frequency Model

### Model 9
Goal-Timing Model

### Model 10
Market-Implied Team-Goal Model — ONLY when team-goal odds are available

---

# 49. STARTING ENSEMBLE WEIGHTS

Use these as starting values:

```text
Poisson                         18%
Negative Binomial               10%
Home/Away Attack-Defense        16%
Opponent-Adjusted Scoring       14%
Recent Scoring                  10%
Shot/SOT Model                  10%
xG Model                          8%
Bayesian Scoring Frequency       6%
Goal Timing                       4%
Market Validation                 4%
```

Total:

```text
100%
```

If xG is unavailable, redistribute its weight among validated available models.

Do not create synthetic xG.

These weights must eventually be optimized using historical out-of-sample validation.

---

# 50. MODEL AGREEMENT

Calculate each model's:

```text
P(Team ≥1)
```

Example:

```text
Poisson              88%
Negative Binomial    86%
Attack/Defense       89%
Recent Form          84%
Shot Model           87%
Bayesian             86%
```

Strong agreement.

If:

```text
Poisson              94%
Negative Binomial    91%
Attack/Defense       89%
Recent Form          63%
Shot Model           58%
```

the prediction requires additional scrutiny.

---

# 51. CALIBRATION

Raw probabilities must be calibrated.

Use historical out-of-sample data.

Possible methods:

- Isotonic regression
- Platt scaling
- Beta calibration

Evaluate:

- Brier score
- Log loss
- Reliability curves
- Calibration error

The objective is accurate probability, not merely high hit rate.

---

# 52. LEAGUE-SPECIFIC CALIBRATION

Team scoring behavior differs between leagues.

Where sufficient data exists, maintain:

```text
League-specific calibration
```

with:

```text
Global model
+
League model
```

using shrinkage for small samples.

---

# 53. SAMPLE SIZE ADJUSTMENT

Do not trust:

```text
5 matches
5 scored
= 100%
```

as a true 100% probability.

Use Bayesian shrinkage toward:

```text
league scoring baseline
```

and the team's longer-term history.

---

# 54. MARKET ODDS

If actual team-goal odds are available, collect:

```text
Team Over 0.5
Team Under 0.5
```

and relevant team-total lines.

If only match 1X2/BTTS/O-U odds exist, use them only as secondary market information.

Do not reverse-engineer a team-goal market probability without a validated method.

---

# 55. IMPLIED PROBABILITY

For genuine Team Over 0.5 odds:

```text
Implied Probability =
1 / Odds
```

Then remove bookmaker margin when both sides are available.

---

# 56. FAIR ODDS

Calculate:

```text
Fair Odds =
1 / Calibrated Probability
```

Example:

```text
Probability = 0.87

Fair Odds = 1.149
```

---

# 57. EXPECTED VALUE

If actual market odds are available:

```text
EV =
(P × Odds) - 1
```

Example:

```text
P = 0.87
Odds = 1.25

EV = 0.0875
EV = +8.75%
```

Do not recommend a market solely because probability is high.

Price matters.

---

# 58. ODDS FLOOR

The engine must account for very short prices.

A:

```text
90% probability
```

at:

```text
1.05
```

may have poor value.

Therefore evaluate:

```text
Probability
Fair Odds
Market Odds
Edge
EV
```

together.

---

# 59. EDGE

Calculate:

```text
Edge =
Model Probability - Market Probability
```

Example:

```text
Model = 88%
Market = 82%

Edge = +6 percentage points
```

---

# 60. PROBABILITY TIERS

Suggested starting classification:

```text
<70%      Weak
70–79%    Moderate
80–84%    Strong
85–89%    Very Strong
90–94%    Elite
95%+      Exceptional
```

These thresholds must be calibrated historically.

Do not assume 90% model probability means 90% real-world probability until calibration confirms it.

---

# 61. TEAM SCORING QUALITY SCORE

Create:

```text
Team Scoring Quality Score
0–100
```

Inputs:

- Calibrated probability
- Scoring frequency
- Venue-specific scoring
- Opponent concede rate
- Attack strength
- Recent form
- Model agreement
- Data quality
- Robustness
- Market value

---

# 62. ROBUSTNESS TEST

Perturb expected scoring rate:

```text
λ × 0.90
λ × 0.95
λ
λ × 1.05
λ × 1.10
```

Calculate:

```text
P(Team ≥1)
```

Example:

```text
λ -10% = 84%
Base     = 88%
λ +10% = 91%
```

This is robust.

If:

```text
λ -10% = 67%
Base     = 82%
λ +10% = 91%
```

the prediction is highly sensitive.

Reduce confidence.

---

# 63. ROBUSTNESS SCORE

Create:

```text
Robustness Score
0–100
```

based on:

- Probability stability
- Model agreement
- Data completeness
- Sample size
- Calibration
- Score distribution
- Sensitivity

---

# 64. DATA QUALITY SCORE

Create:

```text
Data Quality
0–100
```

Consider:

- Fixture validation
- Recent match coverage
- Home/away sample
- Team statistics
- Opponent statistics
- Shot data
- xG availability
- lineup information
- injury information
- data freshness

---

# 65. CONFIDENCE SCORE

Keep:

```text
Probability
```

separate from:

```text
Confidence
```

Example:

```text
Team Over 0.5:
Probability = 88%

Confidence = 91/100
```

versus:

```text
Probability = 88%
Confidence = 57/100
```

The second means the probability estimate is uncertain.

---

# 66. NO-BET CONDITIONS

Return:

```text
NO BET
```

when:

- Data quality is too low
- Sample size is inadequate
- Model disagreement is high
- Probability is poorly calibrated
- Market odds provide insufficient value
- Probability is highly sensitive
- Important attacking players are uncertain
- Opponent defensive data is incomplete
- Fixture data is stale
- Market price is too short
- Model cannot distinguish genuine edge from uncertainty

Never force a selection.

---

# 67. TEAM SELECTION LOGIC

For each fixture evaluate:

```text
Home Team ≥1
Away Team ≥1
```

Then rank them independently.

Example:

```text
Home Team:
91% — Strong

Away Team:
68% — Weak
```

Recommendation:

```text
HOME TEAM TO SCORE
```

not:

```text
BOTH TEAMS TO SCORE
```

---

# 68. BEST TEAM-TO-SCORE OPPORTUNITY

When scanning fixtures:

Rank candidates by:

1. Calibrated probability
2. Market edge
3. EV
4. Data quality
5. Model agreement
6. Robustness
7. Scoring consistency
8. Opponent defensive weakness
9. Home/away scoring strength
10. Price quality

---

# 69. MULTI-MATCH SCANNER

For a daily prediction run:

```text
Fetch fixtures
      ↓
Validate fixtures
      ↓
Cheap team-scoring filters
      ↓
Rank candidates
      ↓
Deep-data retrieval
      ↓
Run ensemble
      ↓
Calibrate
      ↓
Market comparison
      ↓
Robustness test
      ↓
NO-BET filter
      ↓
Final candidates
```

Do not deeply process every fixture if API limits make this inefficient.

---

# 70. CANDIDATE PRE-FILTER

Potential candidates can be screened using:

```text
High team scoring frequency
+
Strong home/away scoring
+
Opponent high concede frequency
+
Strong attacking output
```

This is only a pre-filter.

The final ensemble determines the probability.

---

# 71. CROSS-MARKET VALIDATION

Check consistency with:

- BTTS
- Over/Under
- Correct Score
- 1X2
- Draw
- Handicap

But do not force agreement.

The Team Over 0.5 model must remain independently calculated.

---

# 72. IMPORTANT MATHEMATICAL CONSISTENCY

If:

```text
P(Home ≥1) = 87%
```

then:

```text
P(Home = 0) = 13%
```

If the correct-score model produces:

```text
0-0 = 5%
0-1 = 4%
0-2 = 2%
0-3 = 1%
0-4+ = 1%
```

then:

```text
P(Home = 0) = 13%
```

and therefore:

```text
P(Home ≥1) = 87%
```

These values must agree.

---

# 73. TEAM GOAL DISTRIBUTION

Always retain the complete distribution:

```text
0
1
2
3
4
5+
```

because it enables:

- Team Over 0.5
- Team Over 1.5
- Team Over 2.5
- Correct Score
- BTTS
- Match O/U
- Handicap

from the same underlying model.

---

# 74. PRIMARY OUTPUT

Return:

```text
Fixture
Selected Team
Home/Away
P(0 goals)
P(≥1 goal)
P(≥2 goals)
P(≥3 goals)

Expected Goals
Scoring Rate
Venue Scoring Rate
Opponent Concede Rate

Model Agreement
Data Quality
Robustness
Confidence

Market Odds
Market Probability
Fair Odds
Edge
EV

Recommendation
Risk Flags
```

---

# 75. EXAMPLE OUTPUT

```json
{
  "fixture": {
    "fixture_id": 123456,
    "home_team": "Team A",
    "away_team": "Team B"
  },

  "selection": {
    "team": "Team A",
    "market": "Team Over 0.5 Goals"
  },

  "probabilities": {
    "zero_goals": 0.12,
    "one_plus": 0.88,
    "two_plus": 0.59,
    "three_plus": 0.31
  },

  "expected_goals": 2.02,

  "distribution": {
    "0": 0.12,
    "1": 0.29,
    "2": 0.29,
    "3": 0.20,
    "4_plus": 0.10
  },

  "signals": {
    "season_scoring_rate": 0.86,
    "venue_scoring_rate": 0.90,
    "opponent_concede_rate": 0.84,
    "attack_strength": 88,
    "model_agreement": 91,
    "data_quality": 95,
    "robustness": 89
  },

  "market": {
    "odds": 1.22,
    "fair_odds": 1.14,
    "market_probability": 0.82,
    "edge": 0.06,
    "ev": 0.0736
  },

  "confidence": 92,

  "recommendation": "STRONG TEAM TO SCORE",

  "risk_flags": [],

  "model_version": "TEAM_GOAL_ENGINE_v1.0"
}
```

---

# 76. HUMAN-READABLE OUTPUT

Example:

```text
TEAM TO SCORE

Team A — Over 0.5 Goals

Probability: 88%
Fair Odds: 1.14
Market Odds: 1.22
Edge: +6%
EV: +7.36%

Expected Goals: 2.02

Probability of:
0 goals: 12%
1 goal: 29%
2 goals: 29%
3 goals: 20%
4+: 10%

Scoring Rate: 86%
Home Scoring Rate: 90%
Opponent Away Concede Rate: 84%

Model Agreement: 91%
Data Quality: 95%
Robustness: 89%
Confidence: 92/100

Recommendation:
STRONG TEAM TO SCORE

Risk:
LOW
```

Only show odds/EV when genuine market odds were fetched.

---

# 77. EXPLANATION ENGINE

The explanation must be generated from actual model inputs.

Example:

```text
Team A has an elevated probability of scoring because its home
scoring frequency is strong, its attacking output remains above
the league baseline, and the opponent has conceded in a high
percentage of relevant away fixtures.

The scoring distribution assigns only 12% probability to zero goals,
producing an 88% probability of at least one goal.

The ensemble models are closely aligned and the probability remains
stable under sensitivity testing.
```

Never mention statistics that were not actually used.

---

# 78. RISK FLAGS

Possible:

```text
LOW_DATA
LOW_SAMPLE_SIZE
HIGH_MODEL_DISAGREEMENT
LINEUP_UNCERTAINTY
ATTACKING_PLAYER_UNCERTAINTY
STALE_DATA
HIGH_PROBABILITY_SENSITIVITY
WEAK_OPPONENT_DATA
LOW_MARKET_VALUE
VERY_SHORT_ODDS
```

---

# 79. DATABASE STORAGE

Store:

```text
fixture_id
league_id
season
home_team
away_team
kickoff_time

selected_team
selected_team_side

expected_goals

probability_zero
probability_one_plus
probability_two_plus
probability_three_plus

probability_1_goal
probability_2_goals
probability_3_goals
probability_4_plus

season_scoring_rate
venue_scoring_rate
recent_scoring_rate

opponent_concede_rate
opponent_clean_sheet_rate

attack_strength
opponent_defensive_weakness

market_odds
market_probability
fair_odds
edge
ev

model_agreement
data_quality
robustness
confidence

recommendation
risk_flags

model_version
prediction_timestamp
```

---

# 80. PREDICTION LOCK

Once kickoff occurs:

```text
LOCK PRE-MATCH PREDICTION
```

Never alter the prediction using post-kickoff information.

Store actual result separately.

---

# 81. AUTOMATIC SETTLEMENT

After the match:

```text
actual_team_goals
```

Determine:

```text
predicted_over_0_5
actual_over_0_5
hit
```

If odds were stored:

```text
profit
ROI
```

must be calculated.

---

# 82. PERFORMANCE ANALYTICS

Track:

### Overall

- Hit rate
- ROI
- Yield
- Average odds
- Average probability
- Average edge
- Average EV

### By league

### By team

### By probability range

### By odds range

### By confidence

### By model agreement

### By recommendation type

### By home/away

### By season

---

# 83. CALIBRATION MONITORING

Compare predicted probabilities with actual outcomes.

Example:

```text
Predicted 70–75%
Predicted 75–80%
Predicted 80–85%
Predicted 85–90%
Predicted 90–95%
Predicted 95%+
```

For every bucket calculate:

```text
Predicted probability
Actual scoring frequency
Calibration error
Sample size
```

---

# 84. MODEL PERFORMANCE METRICS

Use:

### Brier Score

For binary outcome:

```text
Team scored ≥1 = 1
Team scored 0 = 0
```

### Log Loss

Track probability quality.

### Calibration Error

Determine whether:

```text
90%
```

predictions actually happen approximately 90% of the time.

---

# 85. MODEL VERSIONING

Every prediction must contain:

```text
model_version
```

Example:

```text
TEAM_GOAL_ENGINE_v2.3
```

When changing:

- model weights
- formulas
- features
- calibration
- thresholds

create a new version.

Do not overwrite historical model definitions.

---

# 86. API EFFICIENCY

Use shared cached data.

For one fixture, avoid separately requesting:

```text
Team A stats → BTTS
Team A stats → O/U
Team A stats → Team Goal
Team A stats → Correct Score
```

Instead:

```text
Fetch once
↓
Normalize
↓
Cache
↓
Reuse
```

This is mandatory for API efficiency.

---

# 87. TWO-STAGE DATA FETCHING

### Stage 1 — Cheap

Fetch:

- Fixture
- Recent results
- Standings
- Basic statistics
- Home/away scoring
- Opponent home/away defense

### Stage 2 — Deep

Only for qualified candidates:

- Detailed statistics
- Shots
- SOT
- Big chances
- xG if available
- injuries
- lineups
- odds
- goal timing

This reduces API usage.

---

# 88. NO-DUMMY FALLBACK

If API-Football fails:

Do NOT:

```text
use demo data
use previous fixture statistics
use random probability
use default 85%
```

Instead:

```text
DATA UNAVAILABLE
```

or:

```text
NO BET
```

---

# 89. FINAL DECISION HIERARCHY

The engine should prioritize:

```text
1. Data integrity
2. Correct fixture
3. Data freshness
4. Home/away orientation
5. Sample-size reliability
6. Team scoring frequency
7. Venue-specific scoring
8. Opponent defensive vulnerability
9. Opponent-adjusted attack
10. Expected team goals
11. Goal distribution
12. Poisson
13. Negative Binomial
14. Chance creation
15. xG if available
16. Recent scoring
17. Goal timing
18. Squad availability
19. Match context
20. H2H
21. Ensemble agreement
22. Probability calibration
23. Market price
24. Fair odds
25. EV
26. Sensitivity
27. Robustness
28. NO-BET filter
29. Final selection
```

---

# 90. CRITICAL PRINCIPLE

Do NOT ask:

> "Is this a strong attacking team?"

Ask:

> "What is the calibrated probability that this specific team scores at least one goal against this specific opponent under the actual home/away conditions, and does the available market price justify the risk?"

The engine must model:

```text
TEAM ATTACK
+
OPPONENT DEFENSE
+
HOME/AWAY
+
RECENT FORM
+
OPPONENT QUALITY
+
GOAL DISTRIBUTION
+
SQUAD
+
CONTEXT
+
MARKET
```

rather than relying on one statistic.

---

# 91. FINAL PRODUCTION RULE

The engine must prefer:

```text
NO BET
```

over a forced Team Over 0.5 selection when:

- scoring probability is not sufficiently reliable
- data is incomplete
- sample size is weak
- models disagree
- probability is poorly calibrated
- price is too short
- EV is negative
- probability is highly sensitive
- important attacking information is unavailable
- opponent defensive data is unreliable

The objective is **not to produce the highest possible number of Team Over 0.5 picks**.

The objective is to identify teams whose probability of scoring at least one goal is **statistically supported, calibrated, robust and, where odds are available, potentially profitable**.

---

# 92. FINAL SYSTEM ARCHITECTURE

```text
                         API-FOOTBALL
                              │
                              ▼
                       DATA FETCH LAYER
                              │
                              ▼
                          CACHE LAYER
                              │
                              ▼
                   NORMALIZED MATCH DATA
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
       HOME TEAM DATA                  AWAY TEAM DATA
              │                               │
              ▼                               ▼
       ATTACK MODEL                    ATTACK MODEL
              │                               │
              └───────────────┬───────────────┘
                              ▼
                    OPPONENT DEFENSE
                              │
                              ▼
                     HOME/AWAY ADJUSTMENT
                              │
                              ▼
                    EXPECTED TEAM GOALS
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
             POISSON    NEGATIVE BINOMIAL   OTHER
                │             │             │
                └─────────────┼─────────────┘
                              ▼
                    GOAL DISTRIBUTION
                              │
                              ▼
                     ENSEMBLE MODEL
                              │
                              ▼
                       CALIBRATION
                              │
                              ▼
                       MARKET CHECK
                              │
                              ▼
                       VALUE / EV
                              │
                              ▼
                    SENSITIVITY TEST
                              │
                              ▼
                     ROBUSTNESS SCORE
                              │
                              ▼
                     NO-BET FILTER
                              │
                              ▼
                 TEAM OVER 0.5 SELECTION
                              │
                              ▼
                       PREDICTION LOCK
                              │
                              ▼
                    AUTOMATIC SETTLEMENT
                              │
                              ▼
               ROI + HIT RATE + CALIBRATION
```

---

## CORE REQUIREMENT

The engine must produce a **probability distribution for the selected team's goals**, not merely a yes/no prediction.

From that single calibrated distribution, derive:

```text
Team Over 0.5
Team Over 1.5
Team Over 2.5
Team Over 3.5
Correct Score
BTTS
Match Over/Under
```

where mathematically appropriate.

This creates a consistent prediction ecosystem across SmartMatchPick while ensuring the **Team Over 0.5 engine remains independently validated and never relies on fabricated data**.