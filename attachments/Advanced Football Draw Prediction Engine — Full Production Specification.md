# ADVANCED FOOTBALL DRAW PREDICTION ENGINE
## Production-Grade Draw Probability, Detection, Value & Risk Framework

---

## 1. OBJECTIVE

Build a production-grade football **DRAW prediction engine** using real API-Football data.

The engine must estimate:

- `P(Home Win)`
- `P(Draw)`
- `P(Away Win)`

with the primary objective of identifying fixtures where the **draw probability is genuinely elevated and/or represents positive betting value**.

The system must not select a draw simply because the two teams appear evenly matched.

A draw prediction requires evidence from:

1. Team strength
2. Home/away performance
3. Goal-scoring distribution
4. Defensive performance
5. Recent form
6. Opponent-adjusted performance
7. Draw frequency
8. Low-scoring probability
9. Scoreline distribution
10. Tactical/game-state characteristics
11. Squad availability
12. Match context
13. Market pricing
14. Model agreement
15. Probability calibration

The engine must be capable of returning:

`DRAW`

or

`NO BET`

when the evidence is insufficient.

---

# 2. ABSOLUTE DATA INTEGRITY RULES

These rules are mandatory.

### REAL DATA ONLY

Never fabricate:

- Fixtures
- Results
- Goals
- Standings
- Team statistics
- H2H statistics
- Odds
- Injuries
- Suspensions
- Lineups
- Player statistics
- Tactical information
- Possession
- Shots
- Expected goals
- Expected goals against
- Corner statistics
- Form
- League statistics

Never create demo matches.

Never create fallback statistics that look like real statistics.

Never substitute another fixture for a missing fixture.

---

# 3. MISSING DATA POLICY

Missing data is NOT zero.

If a statistic is unavailable:

```text
null = unavailable
```

not:

```text
0
```

Do not estimate unavailable statistics unless a statistically justified model explicitly derives a variable from available underlying data.

The engine must distinguish:

```text
observed
derived
estimated
unavailable
```

Any derived value must identify its source variables and methodology.

---

# 4. XGA RESTRICTION

The system does NOT have reliable xGA trend data.

Therefore:

### DO NOT USE:

- xGA trend
- fabricated xGA
- estimated xGA presented as API data
- fake expected defensive goals

If xG is actually available through the connected data source, it may be used.

If xG is unavailable:

```text
xG contribution = 0
```

and the model must redistribute weight to reliable observed statistics.

Never invent xG.

---

# 5. FIXTURE VALIDATION

Before prediction:

1. Validate fixture ID.
2. Validate home team.
3. Validate away team.
4. Validate competition.
5. Validate season.
6. Validate kickoff date/time.
7. Confirm fixture has not already started.
8. Confirm teams are correctly assigned.
9. Confirm historical statistics belong to the correct teams.
10. Confirm home/away orientation.

Never use statistics from the wrong fixture.

Never use stale predictions for a different match.

---

# 6. CORE DATASET

Create one shared fixture dataset that can be consumed by:

- Draw engine
- Win engine
- BTTS engine
- Over/Under engine
- Correct Score engine
- Handicap engine
- Corner engine

Do NOT independently request the same information for every model.

Use:

```text
API-Football
      ↓
Shared Match Dataset
      ↓
Prediction Engines
```

---

# 7. TEAM PERFORMANCE DATA

For both teams collect:

### Season

- Matches played
- Wins
- Draws
- Losses
- Goals scored
- Goals conceded
- Goal difference
- Points
- Points per match
- Goals per match
- Goals conceded per match
- Draw percentage
- Clean-sheet percentage
- Failed-to-score percentage

### Last 5

Collect:

- W/D/L
- Goals scored
- Goals conceded
- Draws
- Average goals scored
- Average goals conceded

### Last 10

Collect the same metrics.

Do NOT use recent form without considering opponent strength.

---

# 8. HOME/AWAY SPLIT

This is one of the most important draw signals.

For the home team use:

```text
Home matches only
```

For the away team use:

```text
Away matches only
```

Calculate:

### Home Team

- Home win %
- Home draw %
- Home loss %
- Home goals scored
- Home goals conceded
- Home clean sheets
- Home failed to score
- Home scoring frequency
- Home conceding frequency

### Away Team

- Away win %
- Away draw %
- Away loss %
- Away goals scored
- Away goals conceded
- Away clean sheets
- Away failed to score
- Away scoring frequency
- Away conceding frequency

Do not mix home and away statistics without adjustment.

---

# 9. DRAW-FREQUENCY MODEL

Calculate draw rates at multiple levels.

### Team Draw Rate

```text
Team draw rate
= draws / matches
```

Calculate separately for:

- Season
- Last 10
- Last 5
- Home
- Away

### League Draw Rate

Calculate:

```text
league_draw_rate
```

Use the league baseline to prevent overreacting to small samples.

---

# 10. SHRINKAGE FOR SMALL SAMPLES

Do not trust raw draw percentages when sample size is small.

Use Bayesian/shrinkage adjustment.

Example:

```text
Adjusted Draw Rate =
(team_draws + prior_draws) /
(matches + prior_matches)
```

The prior should be league-specific.

This prevents:

```text
2 draws in 3 matches = 66.7%
```

from being interpreted as proof that a team is highly draw-prone.

---

# 11. GOAL ENVIRONMENT

Draw probability is strongly affected by expected scoring.

Calculate:

- Home scoring rate
- Home conceding rate
- Away scoring rate
- Away conceding rate
- Combined goal rate
- Recent goal rate
- Home/away goal rate
- Clean-sheet frequency
- Failed-to-score frequency

Determine whether the fixture belongs to:

```text
Low-goal environment
Medium-goal environment
High-goal environment
```

Low-goal environments generally deserve greater draw consideration, but must not automatically trigger a draw.

---

# 12. EXPECTED GOALS MODEL

If actual API xG is available, use it.

If not, construct expected scoring rates only from observed statistics.

Calculate:

```text
lambda_home
lambda_away
```

using a weighted combination of:

- Home attacking strength
- Away defensive vulnerability
- Away attacking strength
- Home defensive vulnerability
- Recent scoring
- Recent conceding
- Home/away splits
- League scoring baseline
- Opponent strength

Apply shrinkage when sample sizes are small.

---

# 13. POISSON SCORELINE MODEL

Use:

```text
P(Home goals = h)
=
e^-λhome × λhome^h / h!
```

and:

```text
P(Away goals = a)
=
e^-λaway × λaway^a / a!
```

Create a score matrix.

Example:

```text
          Away
       0     1     2     3
Home
0     0-0   0-1   0-2   0-3
1     1-0   1-1   1-2   1-3
2     2-0   2-1   2-2   2-3
3     3-0   3-1   3-2   3-3
```

The draw probability is:

```text
P(Draw)
=
P(0-0)
+
P(1-1)
+
P(2-2)
+
P(3-3)
+
...
```

Calculate enough score states so that probability mass is effectively captured.

---

# 14. DIXON-COLES DRAW MODEL

Implement a Dixon-Coles adjustment for low-scoring outcomes.

Give special treatment to:

```text
0-0
1-0
0-1
1-1
```

because ordinary independent Poisson assumptions can misrepresent these scorelines.

The Dixon-Coles adjustment should be learned/calibrated using historical league data.

Do not hard-code a universal correction factor without validation.

---

# 15. LOW-SCORING DRAW DETECTION

Explicitly calculate:

```text
P(0-0)
P(1-1)
P(2-2)
P(3-3)
```

Then:

```text
Low-Score Draw Probability
=
P(0-0) + P(1-1) + P(2-2) + P(3-3)
```

Also calculate:

```text
P(Total Goals <= 2)
```

and:

```text
P(Total Goals <= 3)
```

A strong draw candidate should generally have meaningful probability concentrated around draw scorelines.

---

# 16. DRAW SCORE CONCENTRATION

Measure how much probability mass is concentrated on draw outcomes.

Example:

```text
Draw probability = 31%

0-0 = 7%
1-1 = 15%
2-2 = 6%
3-3 = 3%
```

This is stronger than a model producing:

```text
Draw probability = 31%

0-0 = 2%
1-1 = 4%
2-2 = 2%
3-3 = 1%
```

because the second model may be artificially generating a high aggregate draw probability.

Calculate:

```text
Draw Concentration Index
=
sum(draw scoreline probabilities) / P(Draw)
```

---

# 17. BALANCE MODEL

Draws become more plausible when team strengths are closely matched.

Calculate:

- Elo difference
- League position difference
- Points-per-match difference
- Goal-difference difference
- Attack-strength difference
- Defensive-strength difference
- Recent-form difference
- Home/away adjusted strength difference

Create:

```text
Team Balance Score
0–100
```

High balance increases draw probability.

However:

### IMPORTANT

Balanced teams do NOT automatically equal a draw.

The balance score must interact with the goal environment and score distribution.

---

# 18. ELO / TEAM STRENGTH

Calculate team strength using:

- Historical performance
- Recent performance
- League strength
- Opponent quality
- Home advantage

Calculate:

```text
Elo Home
Elo Away
Elo Difference
```

Do not use league position as a substitute for team strength.

---

# 19. OPPONENT-ADJUSTED FORM

A 4-match unbeaten run against weak teams should not be treated the same as a 4-match unbeaten run against strong teams.

For each recent match calculate opponent quality.

Weight recent performance by:

```text
opponent strength
```

Separate:

```text
raw form
```

from:

```text
opponent-adjusted form
```

Use opponent-adjusted form as the stronger signal.

---

# 20. PERFORMANCE AGAINST STRONG OPPONENTS

Calculate:

- Results vs top teams
- Results vs middle teams
- Results vs bottom teams
- Goals scored
- Goals conceded
- Draw rate

This helps determine whether a team can resist stronger opposition.

---

# 21. PERFORMANCE WHEN FAVORED / UNDERDOG

Where historical market odds are available, calculate:

### As Favorite

- Win %
- Draw %
- Loss %

### As Underdog

- Win %
- Draw %
- Loss %

This is useful for identifying teams that frequently draw despite being priced as favorites or underdogs.

Never fabricate historical odds.

---

# 22. DRAW VS STRENGTH INTERACTION

Create a specific draw interaction model.

Example signals:

```text
High team balance
+
Low expected goals
+
High historical draw frequency
+
Strong defensive resistance
=
High draw candidate
```

But:

```text
High team balance
+
Very high expected goals
+
Weak defenses
=
Potentially lower draw probability
```

The model must learn these interactions rather than using simplistic rules.

---

# 23. CLEAN SHEETS AND FAILED-TO-SCORE

For each team calculate:

- Clean-sheet %
- Failed-to-score %
- Scored at least once %
- Conceded at least once %
- Scored 2+ %
- Conceded 2+ %

Use these to determine the likely score environment.

Examples:

### 0-0 support

High:

```text
clean sheets
+
failed-to-score
+
low scoring rates
```

### 1-1 support

High:

```text
scoring frequency
+
conceding frequency
+
moderate expected goals
```

---

# 24. BTTS INTERACTION

Use the BTTS engine output as a contextual feature.

Examples:

High:

```text
P(BTTS = YES)
```

can support:

```text
1-1
2-2
3-3
```

while low BTTS probability can support:

```text
0-0
1-0
0-1
```

However:

### DO NOT double count

The draw engine must not simply copy BTTS probability.

Use BTTS as a secondary feature.

---

# 25. OVER/UNDER INTERACTION

Use the independent Over/Under engine as a contextual cross-check.

Examples:

High:

```text
P(Under 2.5)
```

may increase the plausibility of:

```text
0-0
1-0
0-1
1-1
```

High:

```text
P(Over 2.5)
```

may support:

```text
2-2
3-2
2-3
```

but high goal probability can also reduce draw concentration.

Do not assume:

```text
Under = Draw
```

---

# 26. CORRECT SCORE CONSISTENCY

The draw engine and correct-score engine must share the same underlying score distribution.

If the draw model says:

```text
P(Draw) = 34%
```

but the correct-score model says:

```text
1-1 = 4%
2-2 = 2%
0-0 = 1%
```

the system must detect the inconsistency.

The draw probability must be mathematically consistent with the score matrix.

---

# 27. HOME ADVANTAGE ADJUSTMENT

Home advantage must be explicitly modeled.

Do not assume:

```text
Home advantage = automatic home win
```

Home advantage should modify:

```text
λ_home
λ_away
team strength
```

and therefore influence the draw distribution.

---

# 28. DRAW PRESERVATION / GAME-STATE MODEL

Where historical event data is available, analyze:

- Goals scored first
- Goals conceded first
- Reaction after conceding
- Reaction after taking the lead
- Late goals
- Draw frequency after 60'
- Draw frequency after 75'
- Equal-score game behavior

Identify teams that historically:

- protect draws
- chase wins
- collapse late
- score late
- concede late

This can improve draw probability modeling.

---

# 29. GOAL-TIMING DATA

Where available collect:

- Goals 0–15
- 16–30
- 31–45+
- 46–60
- 61–75
- 76–90+

Analyze:

- Early goal probability
- Late goal probability
- First-half draw tendency
- Second-half scoring tendency
- Late equalizer frequency

Do not use unavailable goal timing data as zero.

---

# 30. TACTICAL MATCHUP

Where reliable data is available evaluate:

- Possession style
- Pressing intensity
- Defensive block
- Counterattacking profile
- Crossing volume
- Shot volume
- Tempo
- Chance creation
- Defensive compactness

Identify whether the tactical matchup is likely to produce:

```text
open match
```

or:

```text
controlled/low-event match
```

Do not invent tactical information.

---

# 31. SQUAD AVAILABILITY

Collect:

- Injuries
- Suspensions
- Expected absences
- Confirmed lineups when available
- Goalkeeper availability
- Main striker availability
- Main defender availability
- Midfield availability

Create an availability impact score.

Particular attention should be given to:

### Draw probability increasing

Potential loss of:

- attacking star
- primary striker
- creative midfielder

### Draw probability decreasing

Potential loss of:

- starting goalkeeper
- key center-back
- defensive midfielder

These are tendencies, not hard-coded rules.

---

# 32. GOALKEEPER EFFECT

Where player data is available:

Evaluate:

- Starting goalkeeper availability
- Backup goalkeeper usage
- Clean-sheet performance
- Goals conceded

Do not create goalkeeper ratings when data is unavailable.

---

# 33. REST AND SCHEDULE

Calculate:

- Days since previous match
- Days until next match
- Matches in previous 14 days
- Matches in previous 21 days
- Travel/congestion where available

Look for:

```text
fatigue
rotation
conservative approach
```

Do not over-weight this feature.

---

# 34. MATCH CONTEXT

Where available evaluate:

- League match
- Cup match
- Playoff
- Relegation battle
- Title race
- Qualification battle
- First/second leg
- Must-win situation
- Already-qualified scenario

Important:

Do not automatically classify a high-stakes game as a draw.

The model must determine whether the context encourages:

```text
risk-taking
```

or:

```text
risk avoidance
```

---

# 35. H2H

Use H2H only as a secondary feature.

Collect:

- Last 5 H2H
- Draw count
- Goals
- Venue context

Prefer recent H2H.

Do not allow H2H to dominate the prediction.

Historical H2H must not override current:

- team strength
- form
- injuries
- home/away performance
- goal environment

---

# 36. LEAGUE DRAW BASELINE

Calculate:

```text
league_draw_probability
```

Use it as a prior.

Then adjust based on fixture-specific characteristics.

This prevents extreme draw probabilities from small team samples.

---

# 37. MARKET ODDS

If bookmaker odds are available, collect:

- Home win odds
- Draw odds
- Away win odds

Remove bookmaker margin.

Calculate normalized implied probabilities.

Example:

```text
pH_raw = 1 / home_odds
pD_raw = 1 / draw_odds
pA_raw = 1 / away_odds

sum = pH_raw + pD_raw + pA_raw

pH_market = pH_raw / sum
pD_market = pD_raw / sum
pA_market = pA_raw / sum
```

---

# 38. MARKET VS MODEL EDGE

Calculate:

```text
Draw Edge =
Model Draw Probability - Market Draw Probability
```

Example:

```text
Model = 34%
Market = 28%

Edge = +6 percentage points
```

Do not recommend a draw solely because the model probability is high.

Price matters.

---

# 39. FAIR DRAW ODDS

Calculate:

```text
Fair Draw Odds = 1 / P(Draw)
```

Example:

```text
P(Draw) = 0.34

Fair odds = 2.94
```

If bookmaker odds are:

```text
3.20
```

then the draw may have positive value.

---

# 40. EXPECTED VALUE

Calculate:

```text
EV = (P(Draw) × Odds) - 1
```

Example:

```text
P = 0.34
Odds = 3.20

EV = (0.34 × 3.20) - 1
EV = +0.088
EV = +8.8%
```

Only classify as value when the edge survives uncertainty and calibration.

---

# 41. MARKET DISAGREEMENT

Calculate:

```text
Model Draw Probability
vs
Market Draw Probability
```

Classify:

```text
Strong disagreement
Moderate disagreement
Small disagreement
Agreement
```

Large disagreement requires additional validation.

It must not automatically mean the market is wrong.

---

# 42. DRAW VALUE MODEL

Create:

```text
Draw Value Score
0–100
```

Inputs:

- Probability edge
- EV
- Model confidence
- Data quality
- Model agreement
- Price quality
- Calibration
- Score concentration
- Team balance
- Goal environment

---

# 43. ENSEMBLE MODELS

Use multiple independent models.

Minimum ensemble:

### MODEL 1
Dixon-Coles

### MODEL 2
Independent Poisson

### MODEL 3
Bivariate Poisson

### MODEL 4
Negative Binomial

### MODEL 5
Elo/Team Strength

### MODEL 6
Home/Away Strength

### MODEL 7
Opponent-Adjusted Form

### MODEL 8
Draw-Frequency Bayesian Model

### MODEL 9
Low-Goal Environment Model

### MODEL 10
Market-Implied Probability Model

---

# 44. STARTING ENSEMBLE WEIGHTS

Use these as starting weights only.

They must eventually be optimized through historical validation.

```text
Dixon-Coles                  20%
Independent Poisson          12%
Bivariate Poisson             8%
Negative Binomial             7%
Elo / Team Strength          12%
Home/Away Strength           10%
Opponent-Adjusted Form        8%
Draw-Frequency Model          8%
Low-Goal Environment          8%
Market Validation              7%
```

Total:

```text
100%
```

The weights must be recalibrated using historical out-of-sample performance.

---

# 45. MODEL AGREEMENT

Calculate the spread between models.

Example:

```text
Model 1: 34%
Model 2: 32%
Model 3: 36%
Model 4: 33%
Model 5: 31%
```

Strong agreement.

But:

```text
Model 1: 42%
Model 2: 27%
Model 3: 31%
Model 4: 18%
Model 5: 36%
```

High disagreement.

High disagreement should reduce confidence.

---

# 46. PROBABILITY CALIBRATION

Raw model probabilities must NOT automatically be treated as true probabilities.

Use historical calibration.

Recommended methods:

- Isotonic regression
- Platt scaling
- Beta calibration
- Logistic calibration

Evaluate:

- Brier Score
- Log Loss
- Reliability diagrams
- Calibration error

Calibration must be performed out-of-sample.

---

# 47. LEAGUE-SPECIFIC CALIBRATION

Draw rates differ substantially between competitions.

Create league-specific calibration where sufficient historical data exists.

For small samples:

```text
League-specific model
+
Global model
```

Use shrinkage between them.

Never allow tiny league samples to dominate.

---

# 48. TEMPORAL WEIGHTING

Recent matches should generally receive greater weight than very old matches.

However:

Do not overreact to one or two matches.

Use a controlled decay function.

Example concept:

```text
recent matches = higher weight
older matches = lower weight
```

while retaining sufficient historical information.

---

# 49. DRAW PROBABILITY TIERS

Use calibrated probabilities.

Suggested starting classification:

```text
< 20%     Very Low
20–24%    Low
25–29%    Moderate
30–34%    Strong
35–39%    Very Strong
40%+      Exceptional
```

These are NOT universal betting thresholds.

They must be validated against historical league-specific calibration.

---

# 50. DRAW BETTING THRESHOLD

Do not simply bet every fixture with:

```text
P(Draw) > 30%
```

Require a combination of:

```text
minimum calibrated probability
+
positive edge
+
positive EV
+
acceptable data quality
+
acceptable model agreement
+
reasonable price
```

---

# 51. NO-BET CONDITIONS

Return:

```text
NO BET
```

if any critical condition exists.

Examples:

### Insufficient data

Missing important fixture/team information.

### Model disagreement

Models produce materially different draw probabilities.

### Weak calibration

Historical model reliability is poor.

### Poor price

Draw odds are too short relative to fair odds.

### Low edge

Model probability is close to market probability.

### High uncertainty

Large sensitivity to reasonable parameter changes.

### Strong directional imbalance

One team has overwhelming strength and the score model strongly supports a decisive result.

### Unstable lineups

Important lineup information is missing close to kickoff.

---

# 52. SENSITIVITY TEST

Stress-test the draw probability.

Change key parameters by:

```text
±5%
±10%
```

and evaluate the resulting probability.

Example:

```text
Base P(Draw) = 33%

-10% scoring expectation = 36%
+10% scoring expectation = 29%
```

This indicates sensitivity.

A robust draw should not disappear under a reasonable parameter perturbation.

---

# 53. ROBUSTNESS SCORE

Create:

```text
Draw Robustness Score
0–100
```

Inputs:

- Probability stability
- Score concentration
- Model agreement
- Data quality
- Calibration
- Market edge
- Parameter sensitivity

---

# 54. ENTROPY / UNCERTAINTY

Calculate uncertainty across:

```text
Home Win
Draw
Away Win
```

A fixture where:

```text
33% Home
34% Draw
33% Away
```

is fundamentally different from:

```text
10% Home
78% Draw
12% Away
```

The first is highly uncertain.

The second has an extreme draw probability.

Do not confuse balance with confidence.

---

# 55. DRAW STRENGTH VS DRAW CONFIDENCE

Separate these metrics.

### Draw Probability

Probability that the match ends in a draw.

### Draw Confidence

Confidence that the estimated probability is reliable.

Example:

```text
Draw Probability: 34%
Confidence: 82
```

is acceptable.

But:

```text
Draw Probability: 42%
Confidence: 48
```

should likely be avoided.

---

# 56. PRIMARY DRAW SCORELINES

Return:

```text
Top 5 draw scorelines
```

Example:

```text
1-1   14.8%
0-0    8.4%
2-2    5.9%
3-3    2.1%
4-4    0.5%
```

The sum must equal the model's draw probability within numerical tolerance.

---

# 57. MOST LIKELY MATCH RESULT

Return:

```text
Home Win
Draw
Away Win
```

with probabilities.

Example:

```text
Home Win: 31%
Draw: 37%
Away Win: 32%
```

---

# 58. DRAW-SPECIFIC SIGNALS

Create explicit feature scores:

```text
Team Balance Score
Low Goal Environment Score
Draw Frequency Score
Score Concentration Score
Defensive Resistance Score
Recent Draw Momentum
Home/Away Draw Score
Market Value Score
Model Agreement Score
Data Quality Score
```

This makes the prediction explainable.

---

# 59. DRAW MOMENTUM

Calculate recent draw tendency.

Use:

```text
Last 5
Last 10
Season
Home/Away
Opponent-adjusted
```

But avoid blindly interpreting:

```text
3 draws in last 5
```

as permanent draw momentum.

Use Bayesian shrinkage and opponent adjustment.

---

# 60. OPPONENT DRAW INTERACTION

A team with a high draw rate against weak teams may not be equally draw-prone against strong teams.

Model draw frequency by opponent strength.

Where sufficient data exists calculate:

```text
Draw vs strong teams
Draw vs medium teams
Draw vs weak teams
```

---

# 61. LEAGUE POSITION GAP

Use league position difference as a secondary feature.

Example:

```text
1st vs 2nd
```

does not necessarily mean draw.

The actual strength difference must be measured.

Use:

```text
Elo
Points per match
Goal difference
Opponent-adjusted performance
```

rather than league position alone.

---

# 62. GOAL DIFFERENCE DISTRIBUTION

Calculate:

```text
P(Home wins by 1)
P(Home wins by 2+)
P(Draw)
P(Away wins by 1)
P(Away wins by 2+)
```

This helps determine whether the fixture is likely to be:

```text
tight
```

or:

```text
decisive
```

---

# 63. DRAW VS DOUBLE CHANCE

The system may calculate:

```text
1X
X2
```

as secondary markets.

But do not confuse:

```text
high 1X probability
```

with:

```text
high draw probability
```

Example:

```text
Home win = 55%
Draw = 30%
Away win = 15%

1X = 85%
```

This is NOT necessarily a good draw bet.

---

# 64. DRAW VS CORRECT SCORE

If:

```text
Draw = 35%
```

and:

```text
1-1 = 17%
```

then 1-1 is the dominant draw scoreline.

But do not recommend correct score simply because it is the most likely score.

Correct-score variance is extremely high.

---

# 65. DRAW VS BTTS

Use:

```text
P(BTTS)
```

to distinguish:

```text
0-0 draw
```

from:

```text
1-1 / 2-2 draw
```

Possible output:

```text
Draw: 34%
Most likely draw score: 1-1
BTTS: 64%
Under 2.5: 61%
```

This provides a coherent prediction profile.

---

# 66. CROSS-MARKET CONSISTENCY

The draw engine should communicate with:

- Win engine
- BTTS engine
- Over/Under engine
- Correct Score engine
- Handicap engine

Perform consistency checks.

Example:

```text
Draw = 35%
Under 2.5 = 68%
BTTS = 61%
Most likely score = 1-1
```

This is internally coherent.

But:

```text
Draw = 35%
Over 4.5 = 70%
Most likely score = 4-0
```

should trigger a consistency review.

### IMPORTANT

Cross-market models must NOT force each other.

The draw model remains statistically independent.

---

# 67. DATA QUALITY SCORE

Create:

```text
Data Quality Score = 0–100
```

Consider:

- Fixture validity
- Historical match coverage
- Home/away sample size
- Recent form completeness
- Odds availability
- Injury availability
- lineup information
- statistics completeness
- data freshness

Example:

```text
90–100 = Excellent
80–89 = Very Good
70–79 = Good
60–69 = Moderate
<60 = Weak
```

Set minimum production threshold.

---

# 68. FINAL DRAW SCORE

Create a final:

```text
DRAW SCORE
0–100
```

based on:

```text
Probability
+
Value
+
Model Agreement
+
Data Quality
+
Robustness
+
Score Concentration
+
Team Balance
+
Goal Environment
```

Do not let this score replace the actual probability.

It is a decision-quality score.

---

# 69. RECOMMENDATION LOGIC

Possible outputs:

```text
STRONG DRAW
DRAW VALUE
LEAN DRAW
NO BET
```

Example:

### STRONG DRAW

Requirements might include:

```text
High calibrated draw probability
Strong model agreement
Strong score concentration
Good data quality
Robust under sensitivity testing
Positive expected value
```

### DRAW VALUE

High value but slightly lower probability.

### LEAN DRAW

Draw probability elevated but insufficient betting value.

### NO BET

Insufficient edge or confidence.

---

# 70. DO NOT FORCE A DRAW

This is mandatory.

The system must be comfortable saying:

```text
NO BET
```

even when:

- teams are evenly matched
- recent games contain draws
- draw odds look attractive
- league draw rate is high

The model must require measurable statistical support.

---

# 71. PREDICTION PIPELINE

Use this pipeline:

```text
1. Validate fixture
        ↓
2. Retrieve shared API-Football dataset
        ↓
3. Validate data completeness
        ↓
4. Build team strength
        ↓
5. Build home/away strength
        ↓
6. Build opponent-adjusted form
        ↓
7. Calculate expected scoring rates
        ↓
8. Generate Poisson score matrix
        ↓
9. Apply Dixon-Coles correction
        ↓
10. Run alternative statistical models
        ↓
11. Calculate draw probability
        ↓
12. Analyze draw score concentration
        ↓
13. Calculate balance score
        ↓
14. Calculate low-goal environment
        ↓
15. Apply squad/context adjustments
        ↓
16. Compare model probabilities
        ↓
17. Calibrate probability
        ↓
18. Compare with market
        ↓
19. Calculate fair odds
        ↓
20. Calculate EV
        ↓
21. Stress-test probability
        ↓
22. Calculate robustness
        ↓
23. Apply no-bet filters
        ↓
24. Generate final recommendation
```

---

# 72. DATABASE STORAGE

Store every prediction.

Minimum fields:

```text
fixture_id
league_id
season
home_team
away_team
kickoff_time

home_win_probability
draw_probability
away_win_probability

raw_draw_probability
calibrated_draw_probability

fair_draw_odds
market_draw_odds
market_draw_probability
draw_edge
draw_ev

home_expected_goals
away_expected_goals

p_0_0
p_1_1
p_2_2
p_3_3

top_draw_scoreline

team_balance_score
low_goal_score
draw_frequency_score
score_concentration_score
model_agreement
robustness_score
data_quality_score

confidence
draw_score

recommendation
risk_flags

model_version
prediction_timestamp
```

---

# 73. PREDICTION LOCK

Once the match begins:

```text
LOCK PREDICTION
```

Do not modify the pre-match prediction using post-kickoff information.

Store:

```text
prediction_at_lock
```

separately from:

```text
post_match_result
```

---

# 74. AUTOMATIC SETTLEMENT

After the final result is available:

```text
actual_result
```

must be stored.

Determine:

```text
predicted_draw = true/false
actual_draw = true/false
hit = true/false
```

If odds were stored:

```text
profit
ROI
```

must be calculated.

---

# 75. PERFORMANCE ANALYTICS

Track:

### Overall

- Draw hit rate
- ROI
- Yield
- Average odds
- Average model probability
- Average market probability
- Average edge
- Average EV

### By league

### By probability range

### By odds range

### By confidence

### By model agreement

### By recommendation type

### By scoreline

### By season

---

# 76. CALIBRATION MONITORING

Track:

```text
Predicted 20% → Actual draw frequency
Predicted 25% → Actual draw frequency
Predicted 30% → Actual draw frequency
Predicted 35% → Actual draw frequency
Predicted 40% → Actual draw frequency
```

Build reliability curves.

The objective is not simply high hit rate.

The objective is:

```text
probability calibration
+
positive expected value
```

---

# 77. MODEL VERSIONING

Every prediction must contain:

```text
model_version
```

Example:

```text
DRAW_ENGINE_v3.4
```

When model weights or logic change:

```text
new model version
```

Do not overwrite historical model definitions.

---

# 78. API EFFICIENCY

Do not make unnecessary API requests.

Create a shared cache.

Cache:

- Fixtures
- Teams
- Standings
- Recent matches
- H2H
- Statistics
- Injuries
- Lineups
- Odds
- Players

Multiple prediction engines should reuse the same dataset.

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
 ┌──────────┬──────────┬──────────┬──────────┐
 │ BTTS     │ O/U      │ 1X2      │ DRAW     │
 └──────────┴──────────┴──────────┴──────────┘
      ↓
Correct Score / Handicap / Corners
```

---

# 79. COMPUTATIONAL EFFICIENCY

Do not fetch advanced statistics for every fixture unnecessarily.

Use staged filtering.

### Stage 1

Cheap filters:

- Fixture validity
- League
- Team availability
- Basic form
- Home/away performance
- Draw rate
- team strength

### Stage 2

Only promising fixtures receive deeper analysis:

- H2H
- injuries
- lineups
- detailed statistics
- odds
- score distribution
- tactical variables

### Stage 3

Run expensive ensemble/calibration only on qualified fixtures.

This reduces API usage and computation.

---

# 80. DRAW CANDIDATE FILTER

A preliminary candidate may require combinations such as:

```text
reasonable team balance
+
reasonable draw frequency
+
reasonable low/medium goal environment
```

But this is only a screening stage.

The final model decides the actual probability.

Never hard-code:

```text
balanced = draw
```

---

# 81. ADVANCED FEATURE INTERACTIONS

The model should learn interactions such as:

```text
Team Balance × Low Goal Environment
```

```text
Home Strength Difference × Draw Rate
```

```text
Expected Goals × Score Concentration
```

```text
Opponent Strength × Recent Draw Frequency
```

```text
BTTS Probability × Draw Probability
```

```text
Lineup Impact × Expected Goals
```

Do not simply sum independent signals without testing interaction effects.

---

# 82. MODEL DISAGREEMENT PENALTY

If models disagree significantly:

```text
reduce confidence
```

rather than artificially averaging into a strong recommendation.

Calculate:

```text
draw_probability_std
```

or another robust dispersion metric.

Higher dispersion:

```text
lower confidence
```

---

# 83. PROBABILITY SANITY CHECK

Always verify:

```text
P(Home Win)
+
P(Draw)
+
P(Away Win)
≈ 100%
```

If probabilities do not sum correctly:

1. Normalize if appropriate.
2. Investigate model failure.
3. Do not publish invalid output.

---

# 84. SCORE MATRIX SANITY CHECK

Verify:

```text
sum(all score probabilities) ≈ 100%
```

and:

```text
sum(draw score probabilities)
≈
P(Draw)
```

If this fails, reject the prediction.

---

# 85. FAIR-ODDS SANITY CHECK

If:

```text
P(Draw) = 0
```

do not calculate infinite/invalid odds.

If:

```text
P(Draw) <= 0
```

mark the prediction invalid.

If:

```text
P(Draw) >= 1
```

reject the model output.

---

# 86. FINAL OUTPUT

Return a structured result similar to:

```json
{
  "fixture": {
    "fixture_id": 123456,
    "home_team": "Home Team",
    "away_team": "Away Team",
    "league": "Competition"
  },

  "probabilities": {
    "home_win": 0.31,
    "draw": 0.37,
    "away_win": 0.32
  },

  "draw_analysis": {
    "raw_probability": 0.35,
    "calibrated_probability": 0.37,
    "fair_odds": 2.70,
    "market_probability": 0.29,
    "edge": 0.08,
    "ev": 0.184
  },

  "score_distribution": {
    "0_0": 0.08,
    "1_1": 0.15,
    "2_2": 0.07,
    "3_3": 0.03
  },

  "scores": {
    "most_likely_draw": "1-1",
    "draw_concentration": 0.89
  },

  "signals": {
    "team_balance": 86,
    "low_goal_environment": 78,
    "draw_frequency": 73,
    "score_concentration": 84,
    "model_agreement": 88,
    "data_quality": 94,
    "robustness": 81
  },

  "confidence": 86,

  "recommendation": "DRAW VALUE",

  "risk_flags": [],

  "model_version": "DRAW_ENGINE_v1.0"
}
```

The exact field names may be adapted to the existing database schema.

---

# 87. HUMAN-READABLE OUTPUT

The UI should display:

```text
DRAW

Home Win     31%
Draw         37%
Away Win     32%

Draw Fair Odds: 2.70
Market Odds: 3.05
Value: +9.1%

Most Likely Draw Score:
1-1

Draw Confidence:
86/100

Data Quality:
94/100

Model Agreement:
88/100

Risk:
LOW

Recommendation:
DRAW VALUE
```

Only display market value if real odds were actually fetched.

---

# 88. EXPLANATION ENGINE

Generate explanations from actual model features.

Example:

```text
Draw probability is elevated because both teams have closely matched
opponent-adjusted strength, the home/away goal environment is moderate,
and the score distribution is concentrated around 0-0 and 1-1.

The model estimates a 37% draw probability versus a 29% normalized
market probability, producing a positive probability edge.

The recommendation remains subject to lineup confirmation and price
stability.
```

Never generate an explanation containing a statistic that was not actually used.

---

# 89. RISK FLAGS

Automatically generate flags such as:

```text
LOW_DATA
HIGH_MODEL_DISAGREEMENT
LOW_SAMPLE_SIZE
LINEUP_UNCERTAINTY
MARKET_DISAGREEMENT
LOW_VALUE
HIGH_GOAL_ENVIRONMENT
STRONG_HOME_EDGE
STRONG_AWAY_EDGE
HIGH_PROBABILITY_SENSITIVITY
STALE_DATA
```

---

# 90. FINAL DECISION HIERARCHY

The engine must prioritize:

```text
1. Data integrity
2. Correct fixture
3. Correct home/away orientation
4. Data freshness
5. Sample-size reliability
6. Team strength
7. Home/away performance
8. Opponent-adjusted form
9. Goal environment
10. Expected scoring rates
11. Poisson score distribution
12. Dixon-Coles correction
13. Draw frequency
14. Team balance
15. Low-score concentration
16. Squad availability
17. Match context
18. H2H
19. Ensemble agreement
20. Probability calibration
21. Market probability
22. Fair odds
23. EV
24. Sensitivity
25. Robustness
26. Final recommendation
```

---

# 91. CRITICAL PRINCIPLE

The engine must NOT ask:

> "Do these teams look like they could draw?"

It must ask:

> "What is the calibrated probability distribution of every realistic match outcome, how much probability mass is concentrated on draw scorelines, and does the available market price provide sufficient risk-adjusted value?"

The system should identify draws through **probability distribution modeling**, not intuition.

---

# 92. PRODUCTION RULE

The final system must always prefer:

```text
NO BET
```

over:

```text
FORCED DRAW
```

when:

- data quality is inadequate
- probabilities are poorly calibrated
- model disagreement is high
- draw probability is not sufficiently above market expectation
- expected value is insufficient
- scoreline distribution is unstable
- lineup information creates excessive uncertainty
- sensitivity testing materially changes the prediction

The goal is not to predict a draw in every balanced match.

The goal is to identify **statistically supported, calibrated and potentially profitable draw opportunities**.

---

# 93. FINAL ARCHITECTURE

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
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     TEAM STRENGTH   HOME/AWAY      FORM MODEL
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                 GOAL EXPECTANCY
                         │
                         ▼
                  SCORE MATRIX
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       POISSON MODELS        DIXON-COLES
              │                     │
              └──────────┬──────────┘
                         ▼
                 DRAW ENSEMBLE
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      BALANCE        LOW GOALS       DRAW RATE
          │              │              │
          └──────────────┼──────────────┘
                         ▼
                CALIBRATION LAYER
                         │
                         ▼
                 MARKET COMPARISON
                         │
                         ▼
                  VALUE / EV LAYER
                         │
                         ▼
                SENSITIVITY TEST
                         │
                         ▼
                 ROBUSTNESS SCORE
                         │
                         ▼
                NO-BET / SELECTION
                         │
                         ▼
                 FINAL DRAW PICK
                         │
                         ▼
                 RESULT SETTLEMENT
                         │
                         ▼
             PERFORMANCE + CALIBRATION
```

---

## FINAL ENGINE REQUIREMENT

Build this as a **real statistical prediction system**, not a rule-based tip generator.

The engine must:

- use real API-Football data
- never fabricate missing data
- never fabricate xG/xGA
- never use xGA trend because it is unavailable
- correctly distinguish home and away statistics
- use opponent-adjusted form
- model the full score distribution
- explicitly model draw scorelines
- use Dixon-Coles correction
- use multiple independent models
- calibrate probabilities
- account for league-specific draw rates
- apply sample-size shrinkage
- evaluate market value
- calculate fair odds
- calculate EV
- perform sensitivity testing
- measure model agreement
- measure data quality
- measure robustness
- maintain cross-market consistency
- allow NO BET
- lock predictions at kickoff
- automatically settle results
- track ROI and calibration
- version every model
- minimize API requests through shared cached data

### The objective is not maximum number of draw picks.

### The objective is maximum quality of **calibrated draw probability and risk-adjusted value**.

A draw should only be recommended when the evidence supports it.