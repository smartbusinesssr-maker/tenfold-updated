# ADVANCED FOOTBALL TOTAL BOOKINGS PREDICTION ENGINE
## Full Production Specification

---

## 1. OBJECTIVE

Build a production-grade football **Total Bookings Prediction Engine** that estimates the probability distribution of total disciplinary bookings in a match and identifies statistically justified betting opportunities.

The engine must be capable of predicting:

- Total bookings
- Total yellow cards
- Total red cards
- Home team bookings
- Away team bookings
- Booking handicap
- Booking winner
- Over/Under booking lines
- First-half bookings
- Second-half bookings
- Team booking totals
- Asian booking totals
- Exact/modeled booking ranges

The primary market is:

> **Total Match Bookings — Over/Under**

Examples:

- Over 2.5
- Over 3.5
- Over 4.5
- Over 5.5
- Over 6.5
- Under 3.5
- Under 4.5
- Under 5.5
- Asian lines such as 4.25, 4.75, 5.25, 5.75

The engine must calculate:

> **P(Total Bookings > Line)**  
> **P(Total Bookings < Line)**

and compare those probabilities against available market odds.

The engine must NOT automatically recommend a bet simply because a match has historically produced many cards.

---

# 2. ABSOLUTE DATA INTEGRITY RULES

These rules are mandatory.

### REAL DATA ONLY

Use only:

- Real API-Football fixtures
- Real team statistics
- Real referee statistics
- Real disciplinary statistics
- Real historical match data
- Real odds
- Real lineups
- Real standings
- Real match context

Never create:

- Fake matches
- Fake referees
- Fake cards
- Fake averages
- Fake odds
- Fake team statistics
- Fake disciplinary statistics
- Fake referee statistics
- Fake lineup information

### MISSING DATA ≠ ZERO

If a statistic is unavailable:

```text
null / unavailable
```

must remain different from:

```text
0
```

For example:

If referee yellow-card statistics are unavailable, do NOT interpret that as:

```text
Referee average cards = 0
```

Instead:

```text
referee_data_available = false
```

and reduce confidence accordingly.

### NO FABRICATION

Do not estimate unavailable statistics and present them as API data.

If a required data component is unavailable, the model must either:

1. use a validated model that does not require it, or
2. reduce confidence, or
3. return NO BET.

---

# 3. FIXTURE VALIDATION

Before calculating anything:

Verify:

- fixture ID
- league ID
- season
- date
- kickoff time
- home team
- away team
- referee
- match status

Reject:

- postponed matches
- cancelled matches
- duplicate fixtures
- completed matches being treated as upcoming
- invalid fixture IDs

Prediction must be locked before kickoff.

After kickoff:

```text
prediction_status = LOCKED
```

Do not silently recalculate the pre-match prediction using live cards.

---

# 4. CORE BOOKING DATA

Fetch and store all available disciplinary information.

For each team collect:

### Season

- yellow cards
- red cards
- total cards
- cards per match
- fouls committed
- fouls suffered
- disciplinary points if available

### Recent Form

Collect:

- last 5 matches
- last 10 matches

For each match:

```text
yellow_cards
red_cards
total_cards
fouls_committed
fouls_suffered
```

Calculate:

```text
avg_cards_last_5
avg_cards_last_10
median_cards_last_5
median_cards_last_10
card_variance
card_standard_deviation
```

Do not rely exclusively on season averages.

---

# 5. HOME/AWAY DISCIPLINARY SPLITS

This is mandatory.

For the home team calculate:

```text
home_yellow_avg
home_red_avg
home_total_cards_avg
home_fouls_committed_avg
home_fouls_suffered_avg
```

For the away team:

```text
away_yellow_avg
away_red_avg
away_total_cards_avg
away_fouls_committed_avg
away_fouls_suffered_avg
```

Use venue-specific statistics wherever sufficient sample size exists.

Example:

A team may average:

```text
2.6 cards overall
```

but:

```text
3.4 cards at home
1.9 cards away
```

The model must preserve this distinction.

---

# 6. TEAM DISCIPLINARY STRENGTH

Calculate a disciplinary profile for every team.

### Aggression indicators

Measure:

- fouls committed
- tackles if available
- yellow cards
- red cards
- cards per foul
- cards per defensive action where available

### Discipline indicators

Measure:

- cards per match
- red cards
- repeated-card frequency
- percentage of matches with 3+ cards
- percentage with 4+ cards
- percentage with 5+ cards
- percentage with 6+ cards

### Volatility

Measure:

```text
mean
median
variance
standard deviation
coefficient of variation
```

A team averaging 2.5 cards with low variance is different from a team averaging 2.5 cards with extreme volatility.

---

# 7. OPPONENT-ADJUSTED CARD MODEL

Raw card averages are not enough.

Adjust team disciplinary statistics according to opponent strength and style.

Example:

If Team A averaged:

```text
3.4 cards
```

but most recent opponents were extremely aggressive, that average should not automatically be projected against a low-intensity opponent.

Estimate:

```text
Expected Home Team Cards
Expected Away Team Cards
```

using both:

```text
team card tendency
+
opponent card pressure
```

---

# 8. OPPONENT CARD PRESSURE

Measure how frequently the opponent causes opposing teams to receive cards.

For each team calculate:

```text
opponent_cards_forced_avg
opponent_cards_forced_home
opponent_cards_forced_away
```

Also calculate:

```text
opponents_receive_3+ cards %
opponents_receive_4+ cards %
opponents_receive_5+ cards %
```

This is extremely important.

A team does not only receive cards.

Its style may cause opponents to commit tactical fouls and receive cards.

---

# 9. FOUL ENVIRONMENT

Bookings are strongly related to foul behavior.

Collect:

- fouls committed
- fouls suffered
- total fouls
- fouls per match
- home/away foul rates
- recent foul rates

Calculate:

```text
Expected Total Fouls
```

and use this as an explanatory variable for bookings.

However:

> Fouls must not automatically be converted into cards using an arbitrary fixed ratio.

The foul-to-card relationship must be learned/calibrated from historical data where possible.

---

# 10. FOUL → CARD CONVERSION

Calculate:

```text
Cards / Fouls
```

for:

- home team
- away team
- league
- referee
- recent matches

Example:

```text
Team A:
2.9 cards / 14.8 fouls

Team B:
2.1 cards / 11.9 fouls
```

Use this relationship to improve the expected-card model.

Do not assume:

```text
10 fouls = X cards
```

universally.

The relationship varies substantially by:

- referee
- league
- match intensity
- teams
- competition
- tactical context

---

# 11. REFEREE MODEL

The referee should be one of the most important variables when reliable referee data exists.

Fetch:

- referee identity
- matches officiated
- yellow cards per match
- red cards per match
- fouls per match
- penalties if available
- historical card distribution
- home-team cards
- away-team cards

Calculate:

```text
ref_yellow_avg
ref_red_avg
ref_total_cards_avg
ref_fouls_avg
ref_card_rate
ref_home_cards_avg
ref_away_cards_avg
```

---

# 12. REFEREE HOME/AWAY BIAS

Where sufficient historical data exists:

Calculate:

```text
home_cards_avg
away_cards_avg
home_card_share
away_card_share
```

Do not automatically interpret a small difference as meaningful bias.

Require sufficient referee sample size.

Use shrinkage toward the league average when the sample is small.

Example:

```text
Referee sample = 8 matches
```

should have considerably less influence than:

```text
Referee sample = 100 matches
```

---

# 13. REFEREE CONSISTENCY

Measure referee variance:

```text
mean cards
median cards
variance
standard deviation
```

Also calculate:

```text
P(0 cards)
P(1 card)
P(2 cards)
P(3 cards)
P(4 cards)
P(5 cards)
P(6+ cards)
```

A referee with an average of 5 cards but huge variance must not be treated the same as a referee consistently producing 5-card matches.

---

# 14. LEAGUE CARD ENVIRONMENT

Calculate league-level:

- average cards per match
- median cards
- card variance
- yellow cards
- red cards
- fouls
- referee tendencies
- home cards
- away cards

Also calculate league distributions:

```text
P(total cards = 0)
P(total cards = 1)
P(total cards = 2)
...
P(total cards >= 8)
```

Use league-specific priors.

---

# 15. LEAGUE NORMALIZATION

Do not compare leagues directly without normalization.

Example:

A 4-card match may be:

```text
above average in League A
```

but:

```text
below average in League B
```

Calculate:

```text
league_card_index =
match/team card rate / league baseline
```

This prevents cross-league distortion.

---

# 16. RECENT CARD MOMENTUM

Calculate:

### Last 5

```text
avg cards
median cards
variance
3+ %
4+ %
5+ %
6+ %
```

### Last 10

Same metrics.

Compare:

```text
Last 5 vs Last 10 vs Season
```

Detect:

```text
increasing card environment
stable card environment
decreasing card environment
```

Do not overweight recent form simply because it is recent.

Use sample-size-aware weighting.

---

# 17. MATCH INTENSITY MODEL

Estimate expected match intensity using available real data.

Potential variables:

- fouls
- cards
- tackles if available
- shots
- possession
- attacking pressure
- defensive pressure
- competition importance
- rivalry indicators
- standings pressure
- recent match intensity

Only use variables actually available.

Do not invent possession, tackles, or pressure statistics.

---

# 18. MATCH CONTEXT

Consider:

### League position

- title race
- Champions League qualification
- relegation battle
- promotion race
- survival pressure

### Match importance

- knockout
- playoff
- final
- derby
- rivalry
- decisive qualification match

### Competition type

Different competitions can have different disciplinary environments.

### Schedule

Consider:

- fixture congestion
- rest days
- previous match intensity
- upcoming important match

Context must modify the probability carefully rather than create arbitrary card increases.

---

# 19. DERBY / RIVALRY EFFECT

If reliable historical evidence exists, detect:

```text
derby
rivalry
high-tension fixture
```

Use historical disciplinary evidence only when the relationship is supported by sufficient data.

Never apply:

```text
"derby = automatically more cards"
```

as a hard-coded assumption.

---

# 20. HEAD-TO-HEAD

Use H2H as a supporting feature.

Collect:

- last 5 H2H
- total cards
- home cards
- away cards
- fouls
- referee where available

Calculate:

```text
H2H card average
H2H median
H2H variance
```

H2H should receive limited weight because:

- squads change
- coaches change
- referees change
- competition changes
- tactical styles change

Recent/current team and referee data should dominate.

---

# 21. LINEUP AND PLAYER DISCIPLINE

When confirmed or reliably available, analyze:

- starting XI
- missing players
- suspended players
- injured players
- defensive personnel
- midfield personnel
- players with high card rates where actual data exists

Potentially important:

- aggressive defensive midfielder absent
- first-choice fullback absent
- center-back pairing changed
- key ball-progressor absent

Do not infer player card tendencies without actual player disciplinary data.

---

# 22. PLAYER DISCIPLINARY RISK

Where player statistics are available:

Collect:

- yellow cards
- red cards
- fouls
- fouls per 90
- cards per 90
- starts
- minutes

Calculate expected contribution from likely starters.

Do not use a player's season card total without adjusting for expected minutes.

---

# 23. TACTICAL MATCHUP

Use actual available tactical/statistical information.

Potential indicators:

- pressing intensity
- defensive aggression
- possession battles
- transition frequency
- attacking style
- crossing
- dribbling
- counterattacking
- defensive block
- tactical fouling

Only include metrics actually available.

Do not invent tactical classifications.

---

# 24. GAME-STATE MODEL

Bookings can depend heavily on match state.

Model potential effects of:

- favorite leading
- favorite trailing
- underdog leading
- late equalizer
- protecting a lead
- chasing a goal

Pre-match model should estimate how likely different game states are based on the underlying match-strength model.

Do not use live-game information for the locked pre-match prediction.

---

# 25. FIRST-HALF VS SECOND-HALF BOOKINGS

Where historical timing data exists, model:

```text
First-half expected cards
Second-half expected cards
```

Calculate:

```text
1H card average
2H card average
1H card percentage
2H card percentage
```

This can support:

- 1H Over/Under
- 2H Over/Under
- full-match total

Do not assume that cards are evenly distributed between halves.

---

# 26. CARD TIMING

Where actual minute-by-minute data is available, calculate:

```text
0–15
16–30
31–45+
46–60
61–75
76–90+
```

Determine whether a team/referee historically produces higher late-match card frequency.

Use this primarily for:

- timing markets
- first/second-half models
- game-state modeling

---

# 27. EXPECTED HOME BOOKINGS

Estimate:

```text
λ_home_cards
```

using a weighted combination of:

- home card rate
- opponent card pressure
- home foul rate
- opponent fouls suffered
- referee home-card tendency
- league baseline
- recent card form
- expected lineup
- match intensity
- context

---

# 28. EXPECTED AWAY BOOKINGS

Estimate:

```text
λ_away_cards
```

using:

- away card rate
- opponent card pressure
- away foul rate
- opponent fouls suffered
- referee away-card tendency
- league baseline
- recent card form
- expected lineup
- match intensity
- context

---

# 29. EXPECTED TOTAL BOOKINGS

Calculate:

```text
λ_total_cards =
λ_home_cards + λ_away_cards
```

This becomes the central parameter for the total-bookings distribution.

However, do not blindly assume independent Poisson behavior.

Test the actual historical distribution.

---

# 30. BOOKING DISTRIBUTION MODEL

Build a probability distribution:

```text
P(Total Cards = 0)
P(Total Cards = 1)
P(Total Cards = 2)
P(Total Cards = 3)
P(Total Cards = 4)
P(Total Cards = 5)
P(Total Cards = 6)
P(Total Cards = 7)
P(Total Cards = 8)
...
P(Total Cards >= N)
```

This distribution is more important than a single average.

---

# 31. POISSON BASELINE

Use Poisson as the initial model.

Formula:

```text
P(X=k) = (λ^k × e^-λ) / k!
```

where:

```text
λ = expected total bookings
```

Then derive line probabilities.

Example:

```text
P(Over 4.5)
=
1 - P(0) - P(1) - P(2) - P(3) - P(4)
```

---

# 32. NEGATIVE BINOMIAL MODEL

Test for overdispersion.

Calculate:

```text
variance / mean
```

If:

```text
variance > mean
```

Poisson may underestimate tail probability.

Use Negative Binomial where historical validation demonstrates improved calibration.

Compare:

```text
Poisson
vs
Negative Binomial
```

using out-of-sample:

- log loss
- Brier score
- calibration error

Do not automatically choose Negative Binomial merely because it is more complex.

---

# 33. ZERO-INFLATION

Test whether unusually many matches produce zero bookings.

Only use a Zero-Inflated model if historical evidence supports it.

Do not force zero inflation into every league.

---

# 34. HOME/AWAY JOINT BOOKING MODEL

Model:

```text
Home cards
+
Away cards
=
Total cards
```

rather than independently predicting total cards alone.

Estimate:

```text
P(Home cards = h, Away cards = a)
```

Then:

```text
Total = h + a
```

This allows the engine to support:

- total cards
- team cards
- booking handicap
- booking winner

from one coherent distribution.

---

# 35. CORRELATION BETWEEN TEAMS

Test whether home and away bookings are correlated.

Potential sources:

- aggressive matchup
- referee style
- rivalry
- high foul environment
- game-state interaction

Estimate:

```text
Cov(Home Cards, Away Cards)
```

from historical data.

Do not assume correlation without empirical evidence.

---

# 36. TOTAL BOOKING LINE CALCULATIONS

For line `L`:

Calculate:

```text
P(Over L)
P(Under L)
```

For half-point lines:

```text
Over 4.5
=
P(Total >= 5)

Under 4.5
=
P(Total <= 4)
```

---

# 37. ASIAN BOOKING LINES

Correctly split quarter lines.

Example:

### Over 4.25

Equivalent to:

```text
50% Over 4.0
50% Over 4.5
```

### Over 4.75

Equivalent to:

```text
50% Over 4.5
50% Over 5.0
```

Calculate settlement probabilities separately.

Do not treat:

```text
4.25
```

as a normal 4.25-card threshold.

---

# 38. PUSH / HALF-WIN / HALF-LOSS

For Asian booking markets calculate:

```text
full win
half win
push
half loss
full loss
```

For every quarter line.

Example:

For Over 4.25:

```text
Total <= 3 = full loss
Total = 4 = half loss
Total >= 5 = full win
```

For Under 4.25:

```text
Total <= 3 = full win
Total = 4 = half win
Total >= 5 = full loss
```

These settlement probabilities must be included in EV calculations.

---

# 39. BOOKING HANDICAP MODEL

For:

```text
Home -0.5 cards
Home -1.0 cards
Home -1.5 cards
Home +0.5 cards
```

and Asian quarter handicaps:

```text
Home -0.25
Home -0.75
Home -1.25
```

calculate the complete outcome distribution.

Do not use only the expected card difference.

---

# 40. BOOKING DIFFERENCE DISTRIBUTION

Calculate:

```text
D = Home Cards - Away Cards
```

Then estimate:

```text
P(D = -N)
...
P(D = 0)
...
P(D = +N)
```

This supports:

- booking winner
- booking handicap
- team-card comparisons

---

# 41. BOOKING WINNER

Calculate:

```text
P(Home cards > Away cards)
P(Home cards = Away cards)
P(Away cards > Home cards)
```

If the market offers:

```text
Home
Draw
Away
```

calculate all three probabilities.

---

# 42. MARKET ODDS

Fetch real available odds when available.

For each market collect:

```text
bookmaker
market
line
selection
odds
timestamp
```

Never invent odds.

If odds are unavailable:

```text
market_validation = unavailable
```

Do not manufacture EV.

---

# 43. IMPLIED PROBABILITY

For decimal odds:

```text
Implied Probability = 1 / Odds
```

Where multiple outcomes exist, calculate bookmaker margin.

For two-way markets:

```text
Raw implied probabilities
=
1/Odds_Over
1/Odds_Under
```

Then remove vig where appropriate.

---

# 44. FAIR ODDS

Calculate:

```text
Fair Odds = 1 / Model Probability
```

For Asian lines with push/half outcomes, calculate fair odds using expected settlement value rather than simply using:

```text
1 / P(win)
```

---

# 45. EXPECTED VALUE

For a simple binary market:

```text
EV =
(P_win × Profit_if_win)
-
(P_loss × Stake)
```

For Asian lines:

```text
EV =
P(full win) × full-win profit
+
P(half win) × half-win profit
+
P(push) × 0
+
P(half loss) × half-loss
+
P(full loss) × full-loss
```

Only recommend a bet when expected value is genuinely positive after accounting for settlement.

---

# 46. LINE SHOPPING

Compare available bookmakers.

Example:

```text
Bookmaker A:
Over 4.5 @ 1.72

Bookmaker B:
Over 4.5 @ 1.83

Bookmaker C:
Over 5.5 @ 2.10
```

The engine should evaluate:

```text
probability
price
EV
line
robustness
```

rather than selecting the highest probability blindly.

---

# 47. LINE SENSITIVITY

Calculate probability at neighboring lines.

Example:

```text
Over 3.5 = 78%
Over 4.5 = 65%
Over 5.5 = 49%
```

This reveals where the model's edge disappears.

Also perform:

```text
λ_total - 10%
λ_total
λ_total + 10%
```

sensitivity testing.

A recommendation that disappears under a small parameter change should be marked fragile.

---

# 48. MODEL ENSEMBLE

Use multiple independently validated models.

### Model 1
Poisson total-card model

### Model 2
Negative Binomial

### Model 3
Home/Away disciplinary model

### Model 4
Opponent-adjusted card model

### Model 5
Referee model

### Model 6
Foul-to-card conversion model

### Model 7
Recent-form model

### Model 8
League-specific hierarchical model

### Model 9
Joint home/away booking model

### Model 10
Market validation model

The ensemble must be calibrated using historical out-of-sample results.

---

# 49. STARTING ENSEMBLE WEIGHTS

Use these as initial weights only.

They MUST be optimized through backtesting.

```text
15%  Poisson Total Cards
12%  Negative Binomial
14%  Home/Away Disciplinary Strength
12%  Opponent Card Pressure
14%  Referee Model
8%   Foul/Card Conversion
8%   Recent Card Form
6%   League Hierarchical Model
6%   Joint Home/Away Card Model
5%   Market Validation
```

Total:

```text
100%
```

The engine should dynamically reduce models whose historical calibration deteriorates.

---

# 50. REFEREE WEIGHTING

Referee influence should depend on:

```text
sample size
data quality
recent referee form
league consistency
```

Example concept:

```text
Referee weight =
base_weight × sample_reliability × data_quality
```

Use shrinkage toward league averages.

---

# 51. MODEL AGREEMENT

Calculate disagreement between models.

Example:

```text
Poisson: 71%
Negative Binomial: 74%
Referee model: 76%
Team model: 72%
Market model: 69%
```

High agreement:

```text
stronger confidence
```

Large disagreement:

```text
reduce confidence
```

Potentially:

```text
NO BET
```

---

# 52. PROBABILITY CALIBRATION

Track predictions against actual results.

Use:

- Brier Score
- Log Loss
- calibration curve
- reliability diagram
- Expected Calibration Error
- calibration by probability bucket

Example:

```text
Predicted 70–75%
Actual hit rate = 72%
```

Good calibration.

If:

```text
Predicted 70–75%
Actual hit rate = 58%
```

the model is overconfident.

---

# 53. LEAGUE-SPECIFIC CALIBRATION

Maintain separate calibration for leagues when sample sizes support it.

Examples:

```text
Premier League
La Liga
Serie A
Bundesliga
Champions League
Uganda Premier League
etc.
```

Do not create unstable league models from tiny samples.

Use hierarchical shrinkage toward the global model.

---

# 54. BOOKING PROBABILITY SCORE

Create:

```text
booking_strength_score = 0–100
```

Example interpretation:

```text
<60   Weak
60–69 Moderate
70–74 Strong
75–79 Very Strong
80–84 Elite
85+   Exceptional
```

These thresholds must ultimately be validated against historical performance.

The score is NOT the same thing as probability.

---

# 55. DATA QUALITY SCORE

Create:

```text
data_quality_score = 0–100
```

Consider:

- fixture validity
- team card data
- home/away sample
- referee data
- referee sample size
- league data
- foul data
- lineup certainty
- player disciplinary data
- odds availability
- historical depth

Example:

```text
90–100 = Excellent
80–89  = Very Good
70–79  = Good
60–69  = Limited
<60    = Poor
```

---

# 56. REFEREE CONFIDENCE SCORE

Separate referee reliability from general data quality.

Example:

```text
referee_sample = 85 matches
referee_data_quality = high
```

should have considerably greater influence than:

```text
referee_sample = 5 matches
```

---

# 57. ROBUSTNESS TEST

Recalculate the recommendation under:

```text
-10% expected cards
-5% expected cards
baseline
+5% expected cards
+10% expected cards
```

Also test:

```text
referee influence reduced
recent form reduced
H2H removed
market data removed
```

If the recommendation remains positive:

```text
robust = true
```

If it changes dramatically:

```text
robust = false
```

---

# 58. NO-BET CONDITIONS

Return:

```text
NO BET
```

when:

- fixture cannot be validated
- referee is unknown and referee data is essential to the edge
- insufficient team card data
- insufficient historical data
- odds unavailable for a value-based recommendation
- model probability below configured threshold
- EV below minimum
- model disagreement too high
- probability poorly calibrated
- line is highly sensitive
- expected-card estimate is unstable
- lineup uncertainty materially affects the model
- market has moved against the model
- edge disappears after reasonable sensitivity testing
- data quality is below minimum threshold

---

# 59. RECOMMENDATION LOGIC

Do NOT use:

```text
highest_probability = automatic bet
```

Use:

```text
Probability
+
Fair Odds
+
Market Odds
+
EV
+
Data Quality
+
Model Agreement
+
Calibration
+
Robustness
+
Line Stability
```

A lower-probability market may be better if its price provides significantly more value.

---

# 60. MINIMUM CONFIGURATION

Make thresholds configurable.

Example:

```text
MIN_BOOKING_PROBABILITY = 0.70

MIN_EV = 0.04

MIN_DATA_QUALITY = 70

MIN_MODEL_AGREEMENT = 0.70

MAX_SENSITIVITY_DROP = configurable

MIN_REFEREE_SAMPLE = configurable

MIN_TEAM_MATCH_SAMPLE = configurable
```

Do not hard-code these permanently.

They should be optimized using historical backtesting.

---

# 61. CROSS-MARKET VALIDATION

Compare booking prediction against:

- BTTS
- Over/Under goals
- 1X2
- Correct Score
- Team to score
- Handicap

Example:

A predicted high-card match may also have:

```text
high expected match intensity
high foul environment
competitive scoreline
```

This can increase contextual confidence.

However:

> The booking model must remain statistically independent.

Do NOT force the bookings model to agree with the goals model.

---

# 62. GOALS ↔ BOOKINGS RELATIONSHIP

Do not assume:

```text
more goals = more cards
```

or:

```text
fewer goals = fewer cards
```

Instead test the relationship historically.

If the relationship is statistically significant in a specific league/context, it may be used as a secondary feature.

Otherwise ignore it.

---

# 63. CARD DISTRIBUTION SHAPE

Report:

```text
mean
median
mode
variance
standard deviation
P25
P50
P75
P90
```

Also report:

```text
most likely booking range
```

Example:

```text
Most likely:
3–5 total cards
```

rather than pretending the model can predict an exact number with certainty.

---

# 64. TOP OUTCOMES

Return:

```text
Top 5 most likely total-card outcomes
```

Example:

```text
4 cards: 17.2%
5 cards: 16.4%
3 cards: 14.8%
6 cards: 12.9%
7 cards: 9.6%
```

These must come from the actual modeled distribution.

---

# 65. TEAM BOOKING PREDICTIONS

For each team calculate:

```text
P(Home Team Over 0.5)
P(Home Team Over 1.5)
P(Home Team Over 2.5)
P(Home Team Over 3.5)
```

and:

```text
P(Away Team Over 0.5)
P(Away Team Over 1.5)
...
```

Also calculate the full team-card distribution.

---

# 66. FIRST-HALF MODEL

If data supports it:

Calculate:

```text
P(1H Over 0.5)
P(1H Over 1.5)
P(1H Over 2.5)
...
```

Use actual first-half historical card distributions.

Do not derive first-half cards simply by dividing full-match cards by two.

---

# 67. SECOND-HALF MODEL

Similarly:

```text
P(2H Over 0.5)
P(2H Over 1.5)
...
```

Use actual historical second-half distributions.

---

# 68. PREDICTION OUTPUT

Every prediction should contain:

```text
Fixture
League
Date
Referee

Expected Home Cards
Expected Away Cards
Expected Total Cards

Home Card Distribution
Away Card Distribution
Total Card Distribution

Over/Under Probabilities

Booking Handicap Probabilities

Booking Winner Probabilities

First Half Probability
Second Half Probability

Market Odds
Fair Odds
Edge
EV

Model Agreement
Data Quality
Referee Reliability
Calibration
Robustness

Risk Flags

Final Recommendation
```

---

# 69. HUMAN-READABLE OUTPUT

Example structure:

```text
TOTAL BOOKINGS

Match:
Team A vs Team B

Expected Cards:
Home: 2.35
Away: 2.08
Total: 4.43

Over 4.5:
67.8%

Under 4.5:
32.2%

Market:
Over 4.5 @ 1.72

Fair Odds:
1.47

Estimated EV:
+16.7%

Model Agreement:
82%

Data Quality:
91%

Referee Reliability:
88%

Robustness:
Strong

Recommendation:
OVER 4.5 BOOKINGS

Risk:
Medium
```

Values above are illustrative formatting only and must never be used as actual prediction data.

---

# 70. JSON OUTPUT

Use a structure similar to:

```json
{
  "fixture_id": 123456,
  "league_id": 39,
  "home_team": "Team A",
  "away_team": "Team B",
  "referee": {
    "name": "Referee",
    "sample_size": 42,
    "avg_cards": 4.87,
    "reliability": 86
  },
  "expected_cards": {
    "home": 2.31,
    "away": 2.08,
    "total": 4.39
  },
  "probabilities": {
    "over_3_5": 0.72,
    "over_4_5": 0.61,
    "over_5_5": 0.43,
    "under_3_5": 0.28,
    "under_4_5": 0.39,
    "under_5_5": 0.57
  },
  "booking_winner": {
    "home": 0.43,
    "draw": 0.21,
    "away": 0.36
  },
  "market": {
    "line": 4.5,
    "selection": "over",
    "odds": null,
    "fair_odds": 1.64,
    "edge": null,
    "ev": null
  },
  "quality": {
    "data_quality": 91,
    "model_agreement": 82,
    "referee_reliability": 86,
    "robustness": "strong"
  },
  "recommendation": "NO BET",
  "risk_flags": [],
  "model_version": "bookings-v1"
}
```

Numbers are structural examples only.

---

# 71. DATABASE STORAGE

Store:

```text
fixture_id
prediction_timestamp
kickoff_timestamp

league_id
season

home_team
away_team
referee

expected_home_cards
expected_away_cards
expected_total_cards

distribution

predicted_over_under_lines

market_odds
fair_odds
EV

model_agreement
data_quality
confidence
robustness

recommendation
model_version
```

After the match, store:

```text
actual_home_cards
actual_away_cards
actual_total_cards
actual_red_cards
actual_yellow_cards

result
profit_loss
ROI
```

---

# 72. AUTOMATIC SETTLEMENT

After the official match result:

Compare:

```text
predicted_total_cards
vs
actual_total_cards
```

Correctly settle:

- win
- loss
- push
- half win
- half loss

for Asian lines.

Do not settle quarter lines as normal binary bets.

Use the official disciplinary statistics source configured by the system.

---

# 73. PERFORMANCE TRACKING

Track:

```text
overall hit rate
ROI
yield
Brier score
log loss
CLV
EV realization
```

Break down by:

```text
league
referee
line
Over/Under
team
probability bucket
model
season
odds range
```

---

# 74. MODEL DIAGNOSTICS

The system should identify:

```text
Which leagues are profitable?
Which lines are profitable?
Which referees improve prediction accuracy?
Where is the model overconfident?
Where does Poisson fail?
Where does Negative Binomial perform better?
Which probability buckets are miscalibrated?
```

Do not optimize purely for historical ROI.

Also optimize:

```text
probability calibration
log loss
Brier score
stability
generalization
```

to avoid overfitting.

---

# 75. BACKTESTING

Backtest chronologically.

Never allow future information to leak into historical predictions.

For every historical fixture:

```text
Only use information available before kickoff.
```

Do NOT use:

- post-match card data
- later referee statistics
- future team form
- future lineups
- future odds

when reconstructing an old prediction.

---

# 76. WALK-FORWARD VALIDATION

Use:

```text
Training period
→ validation period
→ test period
```

Then roll forward.

Example:

```text
Train: Seasons 1–2
Validate: Season 3
Test: Season 4

Then:

Train: Seasons 1–3
Validate: Season 4
Test: Season 5
```

This better reflects real deployment.

---

# 77. API EFFICIENCY

Do NOT make separate API requests for every prediction engine.

Build a shared fixture dataset.

Example architecture:

```text
API-Football
      ↓
Shared Fixture Data
      ↓
 ┌────┼─────┬─────┬─────┬─────┐
 ↓    ↓     ↓     ↓     ↓
BTTS O/U   1X2  Correct Handicap
                  ↓
               Corners
                  ↓
              Bookings
                  ↓
             Player Props
```

All engines should reuse:

- fixture data
- team data
- standings
- recent matches
- lineups
- referee
- odds
- player information

where appropriate.

---

# 78. CACHING

Cache:

```text
team statistics
team fixtures
recent form
standings
referee statistics
player statistics
odds
league statistics
```

Use appropriate TTLs.

For example:

```text
historical team data → long TTL
referee statistics → long TTL
fixture metadata → moderate TTL
odds → short TTL
lineups → very short TTL
```

Avoid repeatedly downloading identical data.

---

# 79. STAGED PREDICTION PIPELINE

Use a funnel.

### Stage 1 — Fixture validation

Verify fixture.

### Stage 2 — Cheap filtering

Use:

- league card environment
- team card averages
- recent card environment

### Stage 3 — Referee enrichment

Fetch/use referee data.

### Stage 4 — Detailed disciplinary model

Calculate:

- foul environment
- opponent card pressure
- home/away
- team distributions

### Stage 5 — Lineup/context enrichment

Only when needed.

### Stage 6 — Distribution modeling

Generate full card distribution.

### Stage 7 — Market comparison

Calculate:

- fair odds
- edge
- EV

### Stage 8 — Robustness

Run sensitivity tests.

### Stage 9 — Final selection

Return:

```text
BET
or
NO BET
```

This reduces API usage and computation.

---

# 80. FINAL DECISION HIERARCHY

The engine must prioritize:

```text
1. Data integrity
2. Correct fixture
3. Correct referee
4. Team disciplinary profile
5. Home/away disciplinary splits
6. Opponent card pressure
7. Foul environment
8. Referee behavior
9. League environment
10. Recent form
11. Lineup/player discipline
12. Match context
13. Expected home cards
14. Expected away cards
15. Full probability distribution
16. Poisson/NB model comparison
17. Joint home/away model
18. Model ensemble
19. Calibration
20. Model agreement
21. Market odds
22. Fair odds
23. EV
24. Line sensitivity
25. Robustness
26. Risk
27. Final recommendation
```

---

# 81. CORE PRINCIPLE

The system must NOT use simplistic logic such as:

```text
Team gets many cards
+
Referee gives many cards
=
BET OVER
```

Instead:

> **Model the complete probability distribution of bookings, account for team disciplinary behavior, opponent card pressure, referee behavior, league environment, foul environment, home/away splits, match context, and uncertainty, then compare the calibrated probability distribution against the actual market price.**

The objective is not to predict:

> "How many cards will probably happen?"

The objective is to estimate:

> **"What is the probability distribution of every relevant booking outcome, and does the available market price provide a statistically defensible edge?"**

When the data, calibration, price, or robustness is insufficient:

```text
NO BET
```

is the correct prediction.