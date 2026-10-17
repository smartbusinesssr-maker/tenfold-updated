# ADVANCED FOOTBALL PLAYER TO SCORE OR ASSIST PREDICTION ENGINE

## Production-Grade Anytime Goal, Assist & Goal-or-Assist Probability Framework

---

# 1. OBJECTIVE

Build a production-grade football player-prop prediction engine using real API-Football data.

The primary market is:

```text
PLAYER TO SCORE OR ASSIST
```

Meaning:

```text
Selected player scores at least 1 goal
OR
Selected player records at least 1 assist
```

The primary probability is:

```text
P(Player Goal OR Assist ≥ 1)
```

The engine must also separately calculate:

```text
P(Player Scores ≥ 1)
P(Player Assists ≥ 1)
P(Player Scores OR Assists ≥ 1)
```

These probabilities must not be treated as interchangeable.

---

# 2. EVENT DEFINITION

Define:

```text
G = player scores at least one goal
A = player records at least one assist
```

Then:

```text
Goal or Assist = G ∪ A
```

Therefore:

```text
P(G OR A)
=
P(G) + P(A) - P(G AND A)
```

Do NOT simply calculate:

```text
P(G) + P(A)
```

because a player can score and assist in the same match.

The overlap must be accounted for.

---

# 3. ABSOLUTE DATA INTEGRITY

Use real API-Football data only.

Never fabricate:

- Player statistics
- Goals
- Assists
- Shots
- Shots on target
- Minutes
- Starting status
- Lineups
- Injuries
- Suspensions
- Odds
- Team goals
- Team xG
- Player xG
- Player xA
- Chances created
- Key passes
- Penalties
- Set-piece responsibility
- Expected minutes
- Tactical role

Never create fake players.

Never use statistics belonging to another player.

Never assume a player starts.

Never assume an injured player plays.

Never invent bookmaker odds.

---

# 4. MISSING DATA POLICY

Missing data is:

```text
UNAVAILABLE
```

not:

```text
0
```

For example:

```text
player_xg = null
```

must not become:

```text
player_xg = 0
```

If a feature is unavailable, dynamically reduce the model's reliance on that feature.

---

# 5. XGA RESTRICTION

The system does not have reliable xGA trend data.

Therefore:

### NEVER USE

- xGA trend
- fabricated xGA
- estimated xGA presented as API data

If actual xG is available, it may be used.

If actual player xG/xA is unavailable:

```text
Do not fabricate it.
```

Use observed player statistics instead.

---

# 6. FIXTURE VALIDATION

Before analyzing a player:

1. Validate fixture ID.
2. Validate home team.
3. Validate away team.
4. Validate league.
5. Validate season.
6. Validate kickoff.
7. Confirm fixture has not started.
8. Confirm player belongs to one of the two teams.
9. Confirm player is registered/available for the fixture.
10. Confirm statistics belong to the correct season.
11. Confirm home/away orientation.

---

# 7. PLAYER ELIGIBILITY

Do not analyze every player.

Create an eligibility filter.

Potential candidates should have evidence of:

- Regular minutes
- Starting appearances
- Substitute appearances
- Goals
- Assists
- Shots
- Shots on target
- Chance creation
- Attacking involvement

depending on available API data.

Players with insufficient historical data should normally receive:

```text
NO BET
```

rather than an invented probability.

---

# 8. PLAYER ROLE

Determine the player's actual role where available.

Possible roles:

```text
ST
CF
LW
RW
AM
CM
WM
WB
FB
CB
DM
GK
```

Do not infer an exact role if the API does not provide enough information.

Role is important because goal and assist probability are strongly dependent on:

- Position
- Team structure
- Expected minutes
- Attacking responsibility

---

# 9. PLAYER MINUTES

Minutes are one of the most important variables.

Collect:

- Total minutes
- Starts
- Substitute appearances
- Average minutes
- Recent minutes
- Home minutes
- Away minutes
- Minutes in last 5
- Minutes in last 10

Calculate:

```text
Minutes per appearance
Minutes per start
Starting percentage
Substitute percentage
```

---

# 10. EXPECTED MINUTES

Estimate expected minutes using actual evidence.

Inputs may include:

- Recent starts
- Recent minutes
- Rotation pattern
- Injury status
- Suspension status
- Competition
- Fixture congestion
- Manager selection patterns
- Confirmed lineup if available

Example:

```text
Expected minutes = 82
```

is fundamentally different from:

```text
Expected minutes = 28
```

The scoring/assist model must scale appropriately.

---

# 11. STARTER PROBABILITY

Before kickoff estimate:

```text
P(Player Starts)
```

Possible classification:

```text
Confirmed starter
Very likely starter
Probable starter
Uncertain
Likely substitute
Confirmed substitute
Unavailable
```

Do not treat an uncertain starter as a confirmed starter.

---

# 12. LINEUP UPDATE

If confirmed lineups become available:

Immediately recalculate:

```text
Expected Minutes
Goal Probability
Assist Probability
Goal-or-Assist Probability
```

A confirmed lineup should carry substantially more weight than a predicted lineup.

---

# 13. PLAYER GOAL HISTORY

Collect:

### Season

- Goals
- Appearances
- Starts
- Minutes
- Goals per 90
- Goals per appearance
- Scoring frequency

### Last 5

- Goals
- Minutes
- Starts
- Scoring frequency

### Last 10

Same metrics.

### Home/Away

Separate venue-specific performance where sufficient sample exists.

---

# 14. PLAYER ASSIST HISTORY

Collect:

- Assists
- Appearances
- Starts
- Minutes
- Assists per 90
- Assists per appearance
- Matches with assist
- Recent assists
- Home/away assist performance

Use actual recorded assists only.

---

# 15. PLAYER GOAL FREQUENCY

Calculate:

```text
P(Goal occurrence based on historical scoring)
```

using:

```text
Goals
/
Relevant appearances
```

but prefer minutes-adjusted rates.

For example:

```text
Goals per 90
```

is generally more informative than:

```text
Goals per appearance
```

when playing time varies significantly.

---

# 16. PLAYER ASSIST FREQUENCY

Calculate:

```text
Assists per 90
```

and:

```text
Assist frequency
```

Again, adjust for minutes.

A substitute playing 20 minutes per game should not be directly compared with a full-time 90-minute player using appearances alone.

---

# 17. PLAYER ATTACKING INVOLVEMENT

Where API-Football provides the statistics, collect:

- Shots
- Shots on target
- Goals
- Assists
- Key passes
- Chances created
- Dribbles
- Crosses
- Big chances
- Passes
- Progressive involvement where available
- Penalties
- Set pieces

Use only statistics actually available.

---

# 18. SHOTS MODEL

For goal probability calculate:

```text
Shots per 90
```

and:

```text
Shots on target per 90
```

Also evaluate:

```text
Shot frequency
Shot consistency
Recent shot volume
```

A player who consistently generates shots is generally more relevant for the scoring model than a player whose goal count is inflated by a tiny sample.

---

# 19. SHOTS ON TARGET

Calculate:

```text
SOT per 90
```

and where sufficient data exists:

```text
Goal conversion from SOT
```

Use shrinkage because finishing rates are highly volatile.

---

# 20. BIG CHANCES

Where available:

- Big chances
- Big chances missed
- Big chances created

For goals:

```text
Big chances per 90
```

is an important supporting feature.

Do not assume every big chance becomes a goal.

---

# 21. CHANCES CREATED

For assist probability collect:

- Key passes
- Chances created
- Big chances created
- Assists
- Crosses
- Final-third passing where available

Calculate:

```text
Chance Creation per 90
```

and:

```text
Assist Opportunity Rate
```

where statistically justified.

---

# 22. xG

If actual player xG is available:

Use:

```text
Player xG
Player xG per 90
Recent xG
xG by venue
```

Compare:

```text
Goals vs xG
```

to detect finishing over/underperformance.

Do not assume xG underperformance guarantees future goals.

Use regression/shrinkage.

---

# 23. xA

If actual player xA is available:

Use:

```text
Player xA
xA per 90
Recent xA
```

This is highly relevant to the assist component.

Never fabricate xA.

---

# 24. TEAM GOAL ENVIRONMENT

Player props cannot be modeled independently from team scoring.

Calculate:

```text
P(Team Scores ≥1)
P(Team Scores ≥2)
Expected Team Goals
```

Use the existing Team-to-Score and Over/Under engines where appropriate.

The player model should estimate the player's share of the team's attacking output.

---

# 25. PLAYER GOAL SHARE

Calculate:

```text
Player Goals / Team Goals
```

using relevant periods.

Prefer:

```text
Player Goals per 90
/
Team Goals per 90
```

when appropriate.

Apply shrinkage to prevent small samples from creating extreme percentages.

---

# 26. PLAYER SHOT SHARE

Calculate:

```text
Player Shots
/
Team Shots
```

and:

```text
Player SOT
/
Team SOT
```

where available.

This identifies players with sustained attacking responsibility.

---

# 27. PLAYER CHANCE-CREATION SHARE

For assists calculate:

```text
Player Key Passes
/
Team Key Passes
```

and:

```text
Player Chances Created
/
Team Chances Created
```

where available.

---

# 28. TEAM ATTACKING STRENGTH

Evaluate:

- Team goals per match
- Team scoring rate
- Team home/away attack
- Team expected goals if available
- Team shots
- Team SOT
- Big chances
- Recent scoring

A player's goal-or-assist probability should decrease when the team itself has a low scoring expectation.

---

# 29. OPPONENT DEFENSE

Collect:

- Goals conceded
- Clean sheets
- Goals conceded per match
- Shots allowed
- Shots on target allowed
- Big chances conceded
- Defensive performance
- Home/away defensive split

For home players:

```text
Opponent Away Defense
```

For away players:

```text
Opponent Home Defense
```

should receive greater weight.

---

# 30. OPPONENT PLAYER-SPECIFIC MATCHUP

Where data permits evaluate:

- Defensive weakness in player's area
- Goals conceded to player's position
- Chances allowed
- Crosses allowed
- Shots allowed
- SOT allowed
- Tactical matchup

Do not invent position-specific defensive data.

If unavailable, exclude it.

---

# 31. OPPONENT STRENGTH

Adjust player expectations based on opponent quality.

Scoring against a weak defense should not be treated identically to scoring against an elite defense.

Use:

```text
Opponent Defensive Strength
```

to adjust:

```text
Expected Player Goal Rate
Expected Player Assist Rate
```

---

# 32. HOME/AWAY PLAYER SPLITS

Where sufficient data exists calculate:

### Home

- Goals per 90
- Assists per 90
- Shots per 90
- SOT per 90
- Key passes per 90

### Away

Same metrics.

Do not use venue splits with tiny samples without shrinkage.

---

# 33. RECENT FORM

Use:

```text
Last 5
Last 10
Season
```

for:

- Goals
- Assists
- Minutes
- Shots
- SOT
- Key passes
- Chances created

Recent performance should receive additional weight but must not dominate because player-event samples are noisy.

---

# 34. RECENT MINUTES FORM

Track:

```text
Last 5 average minutes
Last 10 average minutes
Season average minutes
```

A player with:

```text
90 → 88 → 87 → 84 → 90
```

is very different from:

```text
25 → 18 → 31 → 20 → 27
```

even if their goal/assist totals are similar.

---

# 35. FORM MOMENTUM

Create separate:

```text
Goal Momentum
Assist Momentum
Attacking Involvement Momentum
Minutes Momentum
```

Do not create a single vague "player form" score without preserving the underlying components.

---

# 36. EXPECTED PLAYER GOALS

Build:

```text
λ_player_goal
```

using:

- Player scoring rate
- Player minutes
- Shots
- SOT
- Big chances
- Player xG if available
- Team expected goals
- Player goal share
- Opponent defense
- Venue
- Recent attacking involvement
- Expected minutes

Then calculate:

```text
P(Player Goal ≥1)
```

from the final scoring distribution.

---

# 37. EXPECTED PLAYER ASSISTS

Build:

```text
λ_player_assist
```

using:

- Assists per 90
- Key passes
- Chances created
- Big chances created
- xA if available
- Team scoring expectation
- Player creative share
- Expected minutes
- Opponent defense
- Venue
- Recent involvement

Then calculate:

```text
P(Player Assist ≥1)
```

---

# 38. GOAL MODEL

Baseline:

```text
P(G = k)
=
e^-λg × λg^k / k!
```

Therefore:

```text
P(Player Goal ≥1)
=
1 - e^-λg
```

But the final probability must be calibrated.

---

# 39. ASSIST MODEL

Use an appropriate count model.

Possible:

```text
Poisson
Negative Binomial
Zero-Inflated Poisson
```

depending on historical validation.

Calculate:

```text
P(A = 0)
P(A ≥1)
P(A ≥2)
```

Assist events are often sparse, so use appropriate shrinkage.

---

# 40. GOAL + ASSIST OVERLAP

Calculate:

```text
P(G AND A)
```

Do not assume goal and assist events are independent without testing.

Preferred approach:

Use a joint player-event model or estimate dependency from historical data.

Then:

```text
P(G OR A)
=
P(G)
+
P(A)
-
P(G AND A)
```

---

# 41. JOINT EVENT MODEL

Recommended structure:

```text
                    PLAYER
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
     GOAL MODEL               ASSIST MODEL
          │                         │
          └────────────┬────────────┘
                       ▼
                DEPENDENCY MODEL
                       │
                       ▼
             GOAL OR ASSIST MODEL
```

The final goal-or-assist probability must come from this joint framework.

---

# 42. TEAM GOAL DEPENDENCY

A player's probability of scoring or assisting is partly dependent on the number of goals their team scores.

Model:

```text
Team Expected Goals
        ↓
Expected Team Goals
        ↓
Player Attacking Share
        ↓
Player Goal/Assist Opportunity
```

Do not simply multiply player probability by team probability.

Use a statistically validated allocation model.

---

# 43. PLAYER ATTACKING SHARE MODEL

Estimate:

```text
Goal Share
Assist Share
Shot Share
SOT Share
Chance-Creation Share
```

Then combine with:

```text
Expected Team Goals
```

to derive player opportunity.

---

# 44. PENALTY TAKING

Where reliable data exists determine:

```text
Primary penalty taker
Secondary penalty taker
Penalty involvement
```

Penalty responsibility can materially increase goal probability.

Do not assume the team's highest-scoring player takes penalties.

Do not invent penalty responsibility.

---

# 45. FREE-KICK RESPONSIBILITY

Where reliable data exists:

- Direct free-kick attempts
- Free-kick goals
- Set-piece responsibility

Use only if supported by actual data.

---

# 46. SET-PIECE ASSIST OPPORTUNITY

Where data exists evaluate whether the player takes:

- Corners
- Free kicks
- Set pieces

This can increase assist opportunity.

Do not assume a player takes corners simply because they are a midfielder or winger.

---

# 47. TACTICAL ROLE

Evaluate where the player operates:

- Striker
- Wide attacker
- Attacking midfielder
- Central midfielder
- Wing-back
- Defender

and how that role affects:

```text
Goal Opportunity
Assist Opportunity
```

Use actual lineup/formation information where available.

---

# 48. EXPECTED POSITION

If confirmed lineup exists:

Use actual position.

If only historical position exists:

Use the most recent reliable role.

If role is uncertain:

```text
role_uncertainty = true
```

and reduce confidence.

---

# 49. SUBSTITUTION RISK

Calculate:

```text
Substitution Risk
```

based on:

- Average minutes
- Recent substitution patterns
- Starter status
- Competition
- Manager rotation
- Injury return

Expected minutes must reflect this.

---

# 50. INJURY / SUSPENSION

Collect:

- Injury status
- Suspension status
- Return status
- Fitness information where available

Classification:

```text
AVAILABLE
DOUBTFUL
UNAVAILABLE
```

Do not infer availability from old statistics.

---

# 51. TEAM ROTATION

Evaluate:

- Recent fixture congestion
- Competition importance
- Upcoming matches
- Rotation history

If rotation probability is high:

```text
reduce expected minutes
increase uncertainty
```

Do not automatically exclude the player.

---

# 52. CONFIRMED LINEUP PRIORITY

Data hierarchy:

```text
Confirmed lineup
>
Recent lineup history
>
Predicted lineup
>
Historical starting percentage
```

If confirmed lineup is available, use it.

---

# 53. GOAL TIMING

Where available calculate player's scoring periods:

```text
0–15
16–30
31–45+
46–60
61–75
76–90+
```

Also evaluate substitution timing.

A player frequently substituted before late-game periods may have reduced exposure to late goals.

---

# 54. ASSIST TIMING

Where available analyze when assists occur.

Combine:

```text
Assist timing
+
Expected minutes
```

to improve assist probability.

---

# 55. MATCH GAME STATE

Evaluate player behavior when:

- Team leads
- Team draws
- Team trails

Players on teams that frequently chase games may receive more attacking opportunities.

Use historical evidence.

Do not invent tactical behavior.

---

# 56. MATCH CONTEXT

Evaluate:

- League
- Cup
- Playoff
- Relegation battle
- Title race
- Qualification
- First/second leg
- Must-win situation

Context modifies opportunity but must not dominate the statistical model.

---

# 57. OPPONENT GAME STATE

Consider whether the opponent:

- Concedes early
- Concedes late
- Allows many shots
- Allows many SOT
- Defends deep
- Concedes set pieces

Only use these features when actual data exists.

---

# 58. PLAYER VS OPPONENT HISTORY

H2H player-specific data should be used cautiously.

If sufficient historical data exists:

- Goals vs opponent
- Assists vs opponent
- Minutes vs opponent

But:

### Never let old H2H dominate current player form.

Current:

```text
Role
Minutes
Team strength
Opponent defense
```

must be more important.

---

# 59. MARKET ODDS

If actual player prop odds are available, collect:

```text
Player to Score
Player to Assist
Player to Score or Assist
```

and relevant alternatives.

Never fabricate odds.

---

# 60. MARKET PROBABILITY

For a two-sided market:

```text
Raw Implied Probability = 1 / Odds
```

Remove bookmaker margin where possible.

For a directly quoted:

```text
Player to Score or Assist
```

market, compare directly with the model.

---

# 61. FAIR ODDS

Calculate:

```text
Fair Odds =
1 / P(Player Goal or Assist)
```

Example:

```text
P = 0.71

Fair Odds = 1.408
```

---

# 62. EXPECTED VALUE

If genuine odds are available:

```text
EV =
(P × Odds) - 1
```

Example:

```text
P = 0.71
Odds = 1.55

EV = 0.1005
EV = +10.05%
```

Only recommend when the edge is sufficiently robust.

---

# 63. MARKET EDGE

Calculate:

```text
Edge =
Model Probability - Market Probability
```

Store both:

```text
Probability Edge
EV Edge
```

---

# 64. PRICE SENSITIVITY

A high probability at extremely short odds may still be poor value.

Example:

```text
Probability = 80%
Fair Odds = 1.25
Market Odds = 1.15
```

This is potentially poor value despite the high hit probability.

The engine must distinguish:

```text
High probability
```

from:

```text
Good betting value
```

---

# 65. ENSEMBLE MODELS

Use multiple models.

Minimum:

### Model 1
Player Goal Poisson

### Model 2
Player Goal Negative Binomial

### Model 3
Player Assist Count Model

### Model 4
Minutes-Adjusted Player Model

### Model 5
Team Goal Allocation Model

### Model 6
Player Shot/SOT Model

### Model 7
Chance Creation Model

### Model 8
Opponent-Adjusted Player Model

### Model 9
Bayesian Player Scoring/Assist Model

### Model 10
Market Validation Model

xG/xA models may be added only when actual data exists.

---

# 66. STARTING ENSEMBLE WEIGHTS

Use these as initial weights only:

```text
Player Goal Poisson             14%
Negative Binomial               8%
Assist Model                    12%
Minutes-Adjusted Model          12%
Team Goal Allocation            12%
Shot/SOT Model                  10%
Chance Creation Model           10%
Opponent-Adjusted Model         10%
Bayesian Model                   7%
Market Validation                5%
```

Total:

```text
100%
```

If actual xG/xA data is available, introduce validated xG/xA models and rebalance weights.

These weights must eventually be optimized using historical out-of-sample validation.

---

# 67. PLAYER PROP CALIBRATION

Calibrate:

```text
P(Goal)
P(Assist)
P(Goal OR Assist)
```

separately.

Do not assume that calibration for match outcomes automatically transfers to player props.

Use:

- Brier score
- Log loss
- Reliability curves
- Calibration error

---

# 68. PLAYER-SPECIFIC SHRINKAGE

Player samples are often small.

Use Bayesian shrinkage toward:

```text
League position baseline
Team attacking baseline
Player career baseline
```

depending on available sample size.

For example, do not treat:

```text
2 goals in 2 starts
```

as proof of a permanent elite scoring rate.

---

# 69. LEAGUE-SPECIFIC CALIBRATION

Different leagues have different:

- Goal rates
- Assist rates
- Match tempo
- Substitution patterns
- Player minutes
- Tactical styles

Use league-specific calibration when sufficient data exists.

Use global shrinkage for small samples.

---

# 70. MODEL AGREEMENT

Compare:

```text
Goal probability by model
Assist probability by model
Goal-or-assist probability by model
```

Example:

```text
Model 1: 72%
Model 2: 69%
Model 3: 74%
Model 4: 71%
Model 5: 73%
```

Strong agreement.

Large disagreement should reduce confidence.

---

# 71. DATA QUALITY SCORE

Create:

```text
Player Data Quality
0–100
```

Consider:

- Fixture validity
- Player identity
- Minutes data
- Recent form completeness
- Role certainty
- Injury status
- lineup certainty
- team statistics
- opponent statistics
- market data
- data freshness

---

# 72. ROLE CERTAINTY SCORE

Create:

```text
Role Certainty
0–100
```

Example:

```text
Confirmed starter + confirmed position = very high
Probable starter + uncertain role = medium
Possible substitute = low
```

Role uncertainty should reduce confidence.

---

# 73. MINUTES CERTAINTY SCORE

Create:

```text
Expected Minutes Confidence
0–100
```

A player expected to play:

```text
85–90 minutes
```

has much lower uncertainty than:

```text
20–45 minutes
```

---

# 74. ROBUSTNESS TEST

Stress-test:

```text
Expected minutes ±10%
Player attacking rate ±10%
Team expected goals ±10%
Opponent defensive strength ±10%
```

Recalculate:

```text
P(Goal)
P(Assist)
P(Goal OR Assist)
```

A robust selection should remain strong across reasonable parameter changes.

---

# 75. ROBUSTNESS SCORE

Create:

```text
Player Prop Robustness
0–100
```

Inputs:

- Probability stability
- Minutes stability
- Model agreement
- Data quality
- Role certainty
- Team goal expectation
- Opponent uncertainty
- Market stability

---

# 76. PLAYER GOAL-OR-ASSIST SCORE

Create:

```text
GOAL OR ASSIST SCORE
0–100
```

Inputs:

```text
Calibrated probability
+
Expected minutes
+
Goal probability
+
Assist probability
+
Attacking involvement
+
Team scoring expectation
+
Opponent weakness
+
Model agreement
+
Data quality
+
Robustness
+
Market value
```

This score is a decision-quality metric.

It must not replace the probability.

---

# 77. PROBABILITY TIERS

Suggested starting thresholds:

```text
<60%       Weak
60–69%     Moderate
70–74%     Strong
75–79%     Very Strong
80–84%     Elite
85%+       Exceptional
```

These thresholds must be validated against historical performance.

---

# 78. NO-BET CONDITIONS

Return:

```text
NO BET
```

when:

- Player starting status is uncertain
- Expected minutes are too low
- Role is uncertain
- Player data is insufficient
- Models strongly disagree
- Team goal expectation is weak
- Opponent data is insufficient
- Probability is poorly calibrated
- Market price is too short
- EV is insufficient
- Probability is highly sensitive
- Injury status is unclear
- Player has insufficient sample size

---

# 79. SUBSTITUTION FILTER

A player expected to play only 20–30 minutes should not automatically qualify even if:

```text
Goal or Assist probability per 90
```

is excellent.

Expected exposure matters.

The model must calculate probability conditional on:

```text
Expected Minutes
```

---

# 80. STARTER FILTER

Where appropriate, establish separate thresholds:

```text
Starter
Substitute
Unknown
```

A player prop should generally have higher confidence when the player is confirmed to start.

---

# 81. PLAYER COMPARISON

For a fixture, rank eligible players.

Example:

```text
Player A — 78%
Player B — 72%
Player C — 64%
Player D — 51%
```

But ranking alone is insufficient.

The final ranking should incorporate:

```text
Probability
+
Price
+
EV
+
Minutes
+
Robustness
```

---

# 82. MULTI-PLAYER SELECTION

If creating a player ticket:

Do not blindly select the top probabilities.

Check:

- Same-match correlation
- Team dependence
- Expected team goals
- Player overlap
- Minutes
- Market prices

Example:

Two attackers from the same team can be positively correlated through team scoring.

However, two players cannot both receive an assist on the same goal under normal scoring rules, so assist markets have specific dependency constraints.

The ticket engine must account for this.

---

# 83. PLAYER CORRELATION

Model relationships between:

```text
Player Goal
Player Assist
Team Goals
Other Player Goals
BTTS
Match Over/Under
```

Do not assume independence when constructing accumulators.

---

# 84. CROSS-MARKET CONSISTENCY

Compare player probability with:

```text
Team Over 0.5
Team Over 1.5
Match Over/Under
BTTS
Correct Score
1X2
```

Example:

```text
Player Goal or Assist = 82%
Team Over 0.5 = 91%
Team Over 1.5 = 68%
```

This can be coherent.

But:

```text
Player Goal or Assist = 90%
Team Over 0.5 = 52%
```

requires investigation.

Do not automatically reject; inspect the underlying player distribution.

---

# 85. TEAM GOAL ALLOCATION CONSISTENCY

If the team has:

```text
Expected Goals = 1.2
```

and five players are independently assigned extremely high goal probabilities, the model may be overcounting attacking output.

The combined player model must remain consistent with team scoring expectations.

---

# 86. ATTACKING RESOURCE CONSTRAINT

Ensure player-level probabilities do not imply an unrealistic team scoring distribution.

Use:

```text
Team expected goals
+
Player attacking shares
```

as a constraint.

This prevents:

```text
Player A = 80%
Player B = 75%
Player C = 72%
Player D = 68%
```

from being produced without accounting for shared team scoring opportunity.

---

# 87. GOAL OR ASSIST OUTPUT

For every player return:

```text
Goal Probability
Assist Probability
Goal OR Assist Probability
Goal AND Assist Probability
```

Example:

```text
Goal: 42%
Assist: 36%
Goal + Assist overlap: 9%

Goal OR Assist:
42 + 36 - 9
= 69%
```

---

# 88. FAIR ODDS OUTPUT

Example:

```text
Goal probability: 42%
Assist probability: 36%
Goal-or-assist probability: 69%

Fair odds:
Goal = 2.38
Assist = 2.78
Goal or Assist = 1.45
```

---

# 89. FINAL OUTPUT STRUCTURE

Return:

```json
{
  "fixture": {
    "fixture_id": 123456,
    "home_team": "Team A",
    "away_team": "Team B"
  },

  "player": {
    "id": 999,
    "name": "Player Name",
    "team": "Team A",
    "position": "FW"
  },

  "availability": {
    "status": "STARTER_CONFIRMED",
    "expected_minutes": 84,
    "minutes_confidence": 94,
    "role_confidence": 96
  },

  "probabilities": {
    "goal": 0.43,
    "assist": 0.34,
    "goal_and_assist": 0.08,
    "goal_or_assist": 0.69
  },

  "expected_rates": {
    "goals_per_90": 0.58,
    "assists_per_90": 0.42
  },

  "team_context": {
    "team_expected_goals": 1.86,
    "team_over_0_5_probability": 0.88
  },

  "player_data": {
    "shots_per_90": 3.1,
    "shots_on_target_per_90": 1.4,
    "key_passes_per_90": 2.2
  },

  "market": {
    "odds": 1.62,
    "market_probability": 0.617,
    "fair_odds": 1.449,
    "edge": 0.073,
    "ev": 0.1178
  },

  "quality": {
    "model_agreement": 89,
    "data_quality": 94,
    "robustness": 87,
    "confidence": 91
  },

  "recommendation": "PLAYER TO SCORE OR ASSIST",

  "risk_flags": [],

  "model_version": "PLAYER_GA_ENGINE_v1.0"
}
```

---

# 90. HUMAN-READABLE OUTPUT

Display:

```text
PLAYER TO SCORE OR ASSIST

Player: [Name]
Fixture: [Home] vs [Away]

Goal: 43%
Assist: 34%
Goal OR Assist: 69%

Expected Minutes: 84

Team Expected Goals: 1.86

Shots/90: 3.1
SOT/90: 1.4
Key Passes/90: 2.2

Fair Odds: 1.45
Market Odds: 1.62

Edge: +7.3%
EV: +11.8%

Model Agreement: 89/100
Data Quality: 94/100
Robustness: 87/100
Confidence: 91/100

Recommendation:
PLAYER TO SCORE OR ASSIST

Risk:
LOW
```

Only display actual statistics and odds that were fetched.

---

# 91. EXPLANATION ENGINE

Generate explanations from the actual model.

Example:

```text
The player has a strong goal-or-assist probability because he is
projected for substantial minutes, has sustained attacking involvement,
and contributes both scoring and chance creation.

The team is also projected to generate a strong attacking environment,
while the opponent's defensive profile increases the player's expected
opportunity.

The ensemble estimates a 69% probability of at least one goal or assist,
with strong model agreement and stable probability under sensitivity testing.
```

Never insert unsupported statistics.

---

# 92. RISK FLAGS

Possible flags:

```text
STARTER_UNCERTAIN
LOW_EXPECTED_MINUTES
ROLE_UNCERTAIN
INJURY_UNCERTAINTY
LOW_SAMPLE_SIZE
HIGH_MODEL_DISAGREEMENT
WEAK_TEAM_GOAL_ENVIRONMENT
WEAK_OPPONENT_DATA
STALE_DATA
HIGH_SENSITIVITY
LOW_MARKET_VALUE
VERY_SHORT_ODDS
```

---

# 93. DATABASE STORAGE

Store:

```text
fixture_id
league_id
season
home_team
away_team
kickoff_time

player_id
player_name
team_id
position

starter_status
expected_minutes
minutes_confidence
role_confidence

goal_probability
assist_probability
goal_and_assist_probability
goal_or_assist_probability

goals_per_90
assists_per_90
shots_per_90
shots_on_target_per_90
key_passes_per_90

team_expected_goals
team_over_0_5_probability

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

prediction_timestamp
model_version
```

---

# 94. PREDICTION LOCK

At kickoff:

```text
LOCK PLAYER PROP
```

Do not update the pre-match prediction using post-kickoff information.

Store:

```text
pre_match_prediction
```

separately from:

```text
actual_player_result
```

---

# 95. AUTOMATIC SETTLEMENT

After the match:

Collect actual:

```text
player_goals
player_assists
```

Then calculate:

```text
actual_goal = goals >= 1
actual_assist = assists >= 1
actual_goal_or_assist = actual_goal OR actual_assist
```

Set:

```text
hit = true/false
```

If odds were stored:

```text
profit
ROI
```

must be calculated.

---

# 96. IMPORTANT ASSIST SETTLEMENT RULE

The settlement engine must use the **official assist statistic provided by the trusted data source**.

Do not manually infer assists from:

- final passes
- key passes
- chances created
- video interpretation

unless the system explicitly supports a separate non-official derived metric.

The official recorded assist determines settlement for the standard assist market.

---

# 97. PERFORMANCE ANALYTICS

Track separately:

### Goal

- Goal hit rate
- Goal calibration
- Goal ROI

### Assist

- Assist hit rate
- Assist calibration
- Assist ROI

### Goal or Assist

- Hit rate
- ROI
- Yield
- Average odds
- Average probability
- Average EV

Also analyze:

- League
- Player position
- Player
- Odds range
- Probability range
- Expected minutes
- Starter/substitute
- Model confidence

---

# 98. CALIBRATION BUCKETS

Track:

```text
50–60%
60–65%
65–70%
70–75%
75–80%
80–85%
85–90%
90%+
```

For each bucket:

```text
Predicted probability
Actual hit rate
Calibration error
Sample size
ROI
```

---

# 99. PLAYER-SPECIFIC CALIBRATION

Where enough samples exist, monitor calibration by:

```text
Player
Position
League
Market
Odds range
Expected minutes
```

But do not overfit individual players with tiny samples.

---

# 100. MODEL VERSIONING

Every prediction must store:

```text
model_version
```

Example:

```text
PLAYER_GOAL_ASSIST_ENGINE_v1.0
```

Changing:

- Features
- Weights
- Calibration
- Minutes model
- Goal model
- Assist model
- Correlation model
- Thresholds

requires a new model version.

---

# 101. API EFFICIENCY

Player props can generate huge API usage.

Do NOT fetch every player's complete data individually for every fixture.

Use:

```text
Fixture
↓
Teams
↓
Squads
↓
Recent player statistics
↓
Shared cache
```

Then reuse the data across:

- Player Goal
- Player Assist
- Player Goal/Assist
- Team Goals
- BTTS
- Over/Under
- Correct Score

---

# 102. PLAYER CANDIDATE PIPELINE

Use staged processing.

### Stage 1 — Fixture Filter

Evaluate:

- Team scoring expectation
- Opponent defense
- Match viability

### Stage 2 — Player Filter

Evaluate:

- Minutes
- Starts
- Goals
- Assists
- Shots
- SOT
- Key passes

### Stage 3 — Deep Player Model

Only candidates receive:

- Detailed player model
- Team allocation
- Goal/assist joint model
- lineup analysis
- market analysis
- sensitivity testing

This reduces API requests.

---

# 103. NO DUMMY FALLBACK

If player data is unavailable:

DO NOT:

```text
Assume player is starting
Assume player scores
Use previous match
Use league-average player statistics
Generate random probability
Use fixed 70%
```

Instead:

```text
NO BET
```

or:

```text
PLAYER DATA UNAVAILABLE
```

---

# 104. PLAYER PROP SELECTION HIERARCHY

Prioritize:

```text
1. Correct player identity
2. Fixture validity
3. Player availability
4. Starting probability
5. Expected minutes
6. Player role
7. Team expected goals
8. Player scoring involvement
9. Player chance creation
10. Opponent defense
11. Home/away
12. Recent form
13. Goal model
14. Assist model
15. Joint goal/assist model
16. Ensemble agreement
17. Probability calibration
18. Market price
19. EV
20. Sensitivity
21. Robustness
22. Final selection
```

---

# 105. CRITICAL PRINCIPLE

Do NOT ask:

> "Is this player a good attacker?"

Ask:

> "Given the player's expected minutes, role, team scoring expectation, attacking involvement, opponent defensive environment and actual market price, what is the calibrated probability that this specific player records at least one goal or official assist?"

---

# 106. FINAL PRODUCTION RULE

The engine must prefer:

```text
NO BET
```

over a forced player selection when:

- Starting status is uncertain
- Expected minutes are too low
- Role is unclear
- Data quality is poor
- Player sample size is inadequate
- Team scoring expectation is weak
- Models disagree
- Probability is poorly calibrated
- Market price is insufficient
- EV is negative
- Probability is highly sensitive
- Injury/fitness status is uncertain

---

# 107. FINAL ARCHITECTURE

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
                    NORMALIZED FIXTURE DATA
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
        HOME TEAM DATA                   AWAY TEAM DATA
              │                                │
              └───────────────┬────────────────┘
                              ▼
                       TEAM GOAL MODEL
                              │
                              ▼
                      PLAYER ELIGIBILITY
                              │
                              ▼
                    PLAYER MINUTES MODEL
                              │
                              ▼
                       PLAYER ROLE
                              │
                              ▼
             ┌────────────────┴────────────────┐
             ▼                                 ▼
       PLAYER GOAL MODEL                PLAYER ASSIST MODEL
             │                                 │
             └────────────────┬────────────────┘
                              ▼
                    JOINT EVENT MODEL
                              │
                              ▼
                  GOAL OR ASSIST PROBABILITY
                              │
                              ▼
                         CALIBRATION
                              │
                              ▼
                       MARKET ANALYSIS
                              │
                              ▼
                           EV / VALUE
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
                 FINAL PLAYER SELECTION
                              │
                              ▼
                       PREDICTION LOCK
                              │
                              ▼
                    AUTOMATIC SETTLEMENT
                              │
                              ▼
                PERFORMANCE + CALIBRATION
```

---

# 108. CORE SYSTEM REQUIREMENT

The engine must produce three independently calibrated probabilities:

```text
P(Player Goal ≥1)
P(Player Assist ≥1)
P(Player Goal OR Assist ≥1)
```

The final:

```text
PLAYER TO SCORE OR ASSIST
```

probability must account for the overlap between goals and assists.

The system must combine:

```text
PLAYER
+
MINUTES
+
ROLE
+
TEAM ATTACK
+
OPPONENT DEFENSE
+
SCORING INVOLVEMENT
+
CHANCE CREATION
+
GOAL/ASSIST DISTRIBUTION
+
LINEUP
+
MATCH CONTEXT
+
MARKET
```

while maintaining strict mathematical consistency with the team's expected goal environment.

### The objective is NOT to find famous players.

### The objective is to find players with the highest **calibrated probability of recording at least one official goal or assist**, relative to the actual market price and uncertainty.