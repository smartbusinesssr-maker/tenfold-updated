# ADVANCED OVER/UNDER GOALS PREDICTION ENGINE

## OBJECTIVE

Analyze an upcoming football fixture and determine the probability of different total-goal outcomes.

The engine must evaluate available Over/Under markets such as:

- Over 0.5 / Under 0.5
- Over 1.5 / Under 1.5
- Over 2.5 / Under 2.5
- Over 3.5 / Under 3.5
- Over 4.5 / Under 4.5

If additional lines are available, analyze them using the same methodology.

The objective is NOT simply to predict whether a match will go Over or Under.

The objective is to estimate:

`P(Total Goals > Line)`

and

`P(Total Goals < Line)`

using multiple independent and complementary signals.

The engine must identify:

1. The most likely total-goal range.
2. The strongest Over opportunity.
3. The strongest Under opportunity.
4. Whether bookmaker odds offer value.
5. Whether the data quality is sufficient to justify a prediction.

---

# ABSOLUTE DATA RULES

Use ONLY verified, current data.

Primary source:

`API-Football`

Additional market data may be used only when explicitly available and reliable.

NEVER:

- Fabricate statistics.
- Invent odds.
- Invent xG.
- Invent xGA.
- Invent injuries.
- Invent lineups.
- Invent H2H results.
- Invent fixture information.
- Treat missing data as zero.
- Use demo/sample fixtures.
- Use stale fixture data.
- Create estimated statistics and present them as actual API data.
- Force a prediction when evidence is insufficient.

If a required metric is unavailable:

`DATA NOT AVAILABLE`

If the available data is insufficient:

`INSUFFICIENT DATA`

If data sources conflict:

`DATA CONFLICT`

Do not silently resolve conflicting data by guessing.

---

# 1. FIXTURE VALIDATION

Verify:

- Fixture ID
- Home team ID
- Away team ID
- Competition
- Season
- Match date
- Match status
- Home/away designation
- League
- Team identities

Reject:

- Completed fixtures
- Cancelled fixtures
- Unconfirmed postponed fixtures
- Invalid team IDs
- Duplicate fixtures
- Conflicting fixture records

Only analyze the correct upcoming fixture.

---

# 2. TEAM GOAL-SCORING PROFILE

Analyze both teams.

For each team calculate:

### Season

- Goals scored
- Goals scored per match
- Goals conceded
- Goals conceded per match
- Total goals per match
- Matches Over 0.5
- Matches Over 1.5
- Matches Over 2.5
- Matches Over 3.5
- Matches Over 4.5
- Matches Under 1.5
- Matches Under 2.5
- Matches Under 3.5
- Matches Under 4.5

### Recent form

Analyze:

- Last 5
- Last 10

Calculate the same total-goal and scoring statistics.

Do NOT allow recent form to completely override a much larger season sample.

---

# 3. HOME/AWAY GOAL PROFILE

This is mandatory.

## Home team

Prioritize the home team's:

- Home goals scored per match
- Home goals conceded per match
- Home total goals per match
- Home Over 0.5 rate
- Home Over 1.5 rate
- Home Over 2.5 rate
- Home Over 3.5 rate
- Home Under 2.5 rate
- Home Under 3.5 rate

## Away team

Prioritize the away team's:

- Away goals scored per match
- Away goals conceded per match
- Away total goals per match
- Away Over 0.5 rate
- Away Over 1.5 rate
- Away Over 2.5 rate
- Away Over 3.5 rate
- Away Under 2.5 rate
- Away Under 3.5 rate

Venue-specific statistics should receive greater weight than overall statistics when a sufficient sample exists.

---

# 4. TOTAL GOAL DISTRIBUTION

Analyze the historical distribution of total goals.

Calculate the percentage of matches ending with:

- 0 goals
- 1 goal
- 2 goals
- 3 goals
- 4 goals
- 5+ goals

Then calculate:

`P(0 goals)`

`P(1 goal)`

`P(2 goals)`

`P(3 goals)`

`P(4 goals)`

`P(5+ goals)`

This distribution is critical because Over/Under betting depends on the probability of the total landing above or below a specific line.

---

# 5. EXPECTED GOALS MODEL

If reliable xG data is actually available, use:

- Home xG
- Away xG
- Home recent xG
- Away recent xG
- Home/away xG
- xG consistency
- Actual goals versus xG

Do NOT invent xG.

If xG is unavailable, use verified:

- Goals scored
- Goals conceded
- Shots
- Shots on target
- Big chances
- Scoring frequency

Do not create artificial xG values.

---

# 6. ATTACKING STRENGTH

For both teams analyze:

- Goals per match
- Scoring percentage
- Goals scored last 5
- Goals scored last 10
- Shots per match
- Shots on target
- Big chances
- Big chances missed
- Possession
- Goals per shot
- Goals per shot on target
- First-half goals
- Second-half goals

Determine:

`HOME ATTACK RATING`

`AWAY ATTACK RATING`

Do not rely on goals alone when sufficient shooting/chance data exists.

---

# 7. DEFENSIVE VULNERABILITY

Analyze:

- Goals conceded per match
- Home goals conceded
- Away goals conceded
- Clean-sheet percentage
- Matches conceding ≥1
- Matches conceding ≥2
- Shots conceded
- Shots on target conceded
- Big chances conceded, if available
- Defensive errors
- First-half goals conceded
- Second-half goals conceded

Determine:

`HOME DEFENSIVE VULNERABILITY`

`AWAY DEFENSIVE VULNERABILITY`

Do NOT use xGA trend.

Do NOT estimate xGA.

Only use defensive data that actually exists.

---

# 8. RECENT GOAL ENVIRONMENT

Analyze the last:

- 5 matches
- 10 matches

for both teams.

Calculate:

- Average total goals
- Average goals scored
- Average goals conceded
- Over 1.5 %
- Over 2.5 %
- Over 3.5 %
- Under 2.5 %
- Under 3.5 %

Determine whether the current goal environment is:

`HIGH`

`MODERATE`

`LOW`

Compare recent form against the season baseline.

---

# 9. OPPONENT-STRENGTH ADJUSTMENT

Do not treat every match equally.

A team averaging 2.5 goals against weak opposition should not automatically be treated as having the same attacking strength against a strong defense.

Adjust:

- Goals scored
- Goals conceded
- Shots
- Shots on target
- Over/Under frequency

according to opponent quality where sufficient data exists.

Create:

`OPPONENT-ADJUSTED ATTACKING STRENGTH`

and

`OPPONENT-ADJUSTED DEFENSIVE VULNERABILITY`

---

# 10. POISSON TOTAL-GOAL MODEL

Estimate:

`λ_home`

`λ_away`

Then:

`λ_total = λ_home + λ_away`

Use the Poisson distribution to calculate:

`P(Total Goals = 0)`

`P(Total Goals = 1)`

`P(Total Goals = 2)`

`P(Total Goals = 3)`

`P(Total Goals = 4)`

`P(Total Goals ≥5)`

Then calculate:

### Over 1.5

`P(Over 1.5) = 1 - P(0) - P(1)`

### Under 1.5

`P(Under 1.5) = P(0) + P(1)`

### Over 2.5

`P(Over 2.5) = 1 - P(0) - P(1) - P(2)`

### Under 2.5

`P(Under 2.5) = P(0) + P(1) + P(2)`

### Over 3.5

`P(Over 3.5) = 1 - P(0) - P(1) - P(2) - P(3)`

### Under 3.5

`P(Under 3.5) = P(0) + P(1) + P(2) + P(3)`

### Over 4.5

`P(Over 4.5) = 1 - P(0) - P(1) - P(2) - P(3) - P(4)`

### Under 4.5

`P(Under 4.5) = P(0) + P(1) + P(2) + P(3) + P(4)`

Poisson must be one model, NOT the sole prediction mechanism.

---

# 11. BIVARIATE / DEPENDENCY ADJUSTMENT

Where sufficient historical data exists, account for the fact that team scoring rates are not necessarily independent.

Consider whether:

- High-tempo teams create mutually elevated scoring.
- One team's attacking style increases the opponent's scoring opportunities.
- Early goals materially change match behavior.
- Strong defensive teams suppress both teams.
- Low-tempo matches produce correlated low scoring.

Apply only statistically justified adjustments.

Do not invent correlation coefficients.

If insufficient data exists:

`DEPENDENCY ADJUSTMENT = NOT AVAILABLE`

---

# 12. MATCH TEMPO

Where available, analyze:

- Shots per match
- Shots conceded
- Total shots
- Shots on target
- Possession
- Attacking frequency
- Big chances
- Goals per match

Determine whether the fixture projects toward:

`HIGH TEMPO`

`MEDIUM TEMPO`

`LOW TEMPO`

High tempo should support Over markets when accompanied by actual goal-production evidence.

Low tempo should support Under markets when accompanied by low goal-production evidence.

Tempo alone must never determine the prediction.

---

# 13. GOAL-TIMING ANALYSIS

Analyze:

- First-half goals
- Second-half goals
- Early goals
- Late goals
- First-half scoring frequency
- First-half conceding frequency
- Second-half scoring frequency
- Second-half conceding frequency

Determine whether the teams have a tendency toward:

- Early scoring
- Late scoring
- Second-half goal concentration
- Low first-half scoring

Use this as a supporting signal.

---

# 14. BTTS INTERACTION

BTTS and Over/Under are related but must not be treated as identical.

Calculate:

- P(Home scores ≥1)
- P(Away scores ≥1)
- P(BTTS)
- P(Over 1.5)
- P(Over 2.5)
- P(Over 3.5)

Use BTTS as a supporting variable.

For example:

A match with strong evidence for:

`BTTS + Over 2.5`

has a different profile from a match where:

`Over 2.5`

is driven primarily by one team scoring multiple goals.

Do not use BTTS as a substitute for total-goal analysis.

---

# 15. H2H GOAL ANALYSIS

Use recent H2H only when sufficient valid matches exist.

Analyze:

- Average total goals
- Over 1.5 %
- Over 2.5 %
- Over 3.5 %
- Under 2.5 %
- Under 3.5 %
- BTTS %
- 0-goal matches
- 1-goal matches
- 2-goal matches
- 3+ goal matches

Use H2H with LOW/MODERATE weighting.

Never allow old H2H matches to dominate current data.

If insufficient H2H:

`H2H = NOT ENOUGH DATA`

---

# 16. LINEUPS, INJURIES AND ABSENCES

Where reliable API data is available, check:

### Attack

- Main striker
- Top scorer
- Key creator
- Attacking midfielders
- Wingers

### Defense

- Starting goalkeeper
- Central defenders
- Fullbacks
- Defensive midfielders

Apply adjustments only when supported by reliable information.

### Examples

Missing key striker:

→ Reduce expected attacking output.

Missing several key defenders:

→ Increase expected opponent scoring.

Missing starting goalkeeper:

→ Increase defensive vulnerability when justified.

Never invent player availability.

If lineups are unavailable:

`LINEUP DATA = NOT AVAILABLE`

---

# 17. MATCH CONTEXT

Where reliable data exists, evaluate:

- League position
- Promotion battle
- Relegation battle
- Must-win situation
- Competition type
- Rotation
- Fixture congestion
- Rest days
- Schedule density
- Tournament situation

Do not assume:

"Both teams need a win = Over."

Context must be supported by actual evidence.

---

# 18. MARKET ODDS ANALYSIS

If reliable bookmaker Over/Under odds are available:

Calculate:

`Implied Probability = 1 / Decimal Odds`

Where possible, remove bookmaker margin.

For every available line compare:

`MODEL PROBABILITY`

against:

`MARKET IMPLIED PROBABILITY`

Calculate:

`EDGE = MODEL PROBABILITY - MARKET PROBABILITY`

Then calculate expected value where appropriate:

`EV = (Model Probability × Decimal Odds) - 1`

Example:

If model probability = 80%

and odds = 1.40

`EV = (0.80 × 1.40) - 1`

`EV = 0.12`

Therefore:

`+12% expected value`

Do not recommend a market simply because the probability is high.

A high-probability bet can still have poor value if the odds are too low.

---

# 19. MARKET/MODEL DISAGREEMENT

Identify major disagreements.

Example:

Model:

`Over 2.5 = 72%`

Market:

`Over 2.5 implied probability = 55%`

This is a potentially significant model-market discrepancy.

However, before accepting the edge:

Recheck:

- Fixture
- Odds
- Team data
- Home/away splits
- Recent form
- Lineups
- Data freshness
- Model assumptions

Never assume market disagreement automatically means value.

---

# 20. OVER/UNDER LINE SELECTION

Evaluate each available line separately.

Example:

| Market | Model Probability | Market Probability | Edge | Decision |
|---|---:|---:|---:|---|
| Over 1.5 | XX% | XX% | XX% | |
| Under 1.5 | XX% | XX% | XX% | |
| Over 2.5 | XX% | XX% | XX% | |
| Under 2.5 | XX% | XX% | XX% | |
| Over 3.5 | XX% | XX% | XX% | |
| Under 3.5 | XX% | XX% | XX% | |
| Over 4.5 | XX% | XX% | XX% | |
| Under 4.5 | XX% | XX% | XX% | |

Select the market based on:

1. Probability
2. Statistical support
3. Model-market edge
4. Data quality
5. Risk
6. Historical calibration

Do not automatically choose Over 2.5.

---

# 21. MODEL ENSEMBLE

Use multiple prediction components.

### MODEL 1 — Season Goal Distribution

Uses full-season total-goal data.

### MODEL 2 — Recent Goal Distribution

Uses last 5/10 matches.

### MODEL 3 — Home/Away Model

Uses venue-specific performance.

### MODEL 4 — Poisson

Uses expected scoring rates.

### MODEL 5 — Attack Strength

Measures attacking output.

### MODEL 6 — Defensive Vulnerability

Measures goals conceded and defensive weakness.

### MODEL 7 — Shot/Chance Model

Uses shots, shots on target and big chances.

### MODEL 8 — Opponent Strength

Adjusts performance based on opposition quality.

### MODEL 9 — Goal Timing

Identifies scoring/conceding patterns.

### MODEL 10 — H2H

Uses recent historical meetings.

### MODEL 11 — Lineup Adjustment

Accounts for important player absences.

### MODEL 12 — Market Validation

Compares model probability with bookmaker probability.

The final prediction must be an ensemble.

---

# 22. RECOMMENDED STARTING WEIGHTS

Use these as INITIAL weights only.

They must be backtested and recalibrated using historical out-of-sample results.

### OVER/UNDER MODEL

25% — Home/away goal profile

20% — Season goal distribution

15% — Recent last-5/last-10 goal distribution

10% — Poisson model

10% — Attack/defensive strength

5% — Shots/chances

5% — Opponent-strength adjustment

3% — Goal timing

3% — H2H

2% — Lineup adjustment

2% — Market validation

These are starting weights, NOT scientifically proven optimal weights.

The system should eventually optimize them using historical calibration.

---

# 23. CONFIDENCE CALCULATION

Calculate:

`MODEL CONFIDENCE = 0–100`

Confidence should consider:

- Agreement between models
- Data quantity
- Data quality
- Home/away sample size
- Recent form consistency
- Goal distribution consistency
- Lineup certainty
- Market agreement/disagreement
- Model calibration

High confidence requires multiple models to point in the same direction.

If models strongly disagree:

Reduce confidence.

---

# 24. DATA QUALITY SCORE

Calculate:

`DATA QUALITY SCORE = 0–100`

Consider:

- Fixture validity
- Data freshness
- Historical sample size
- Home/away sample size
- Recent form availability
- Goal statistics availability
- Shooting statistics availability
- Lineup availability
- Odds availability
- Data consistency

Classification:

90–100 = Excellent

80–89 = Very Good

70–79 = Good

60–69 = Limited

<60 = Insufficient

Do not produce a high-confidence prediction when data quality is poor.

---

# 25. OVER/UNDER CLASSIFICATION

Use probability thresholds only as initial screening rules.

### 85%+

VERY STRONG

### 80–84%

STRONG

### 75–79%

MODERATE

### 70–74%

WEAK

### <70%

PASS

These thresholds must eventually be calibrated against actual historical hit rates.

A probability of 80% should mean approximately 80% realized frequency over a large, properly selected out-of-sample sample—not merely that the model "feels confident."

---

# 26. VALUE FILTER

A market should not be classified as a value bet based on probability alone.

Require:

`MODEL PROBABILITY > MARKET IMPLIED PROBABILITY`

by a meaningful margin.

Also require:

- Positive EV
- Acceptable data quality
- No major unresolved lineup issue
- No major model conflict
- No serious data-quality warning

If probability is high but expected value is poor:

`HIGH PROBABILITY — LOW VALUE`

Do not recommend it as a value bet.

---

# 27. RISK DETECTION

Actively search for reasons the prediction could fail.

### Over risks

- Low scoring teams
- High clean-sheet rates
- Low shots on target
- Frequent 0–0 / 1–0 / 0–1 results
- Key attackers missing
- Low recent goal environment
- Low venue-specific scoring
- Strong defensive opponents

### Under risks

- High scoring frequency
- High shots on target
- High big-chance production
- Weak defenses
- High BTTS frequency
- Frequent 3+ goal matches
- Key defensive absences
- High recent goal environment

The engine must actively search for contradictory evidence.

---

# 28. MOST LIKELY GOAL RANGE

Based on the final probability distribution, identify:

`MOST LIKELY TOTAL GOALS`

Examples:

`0 goals — XX%`

`1 goal — XX%`

`2 goals — XX%`

`3 goals — XX%`

`4 goals — XX%`

`5+ goals — XX%`

Then identify the highest-probability total-goal range.

---

# 29. CORRECT-SCORE CONSISTENCY CHECK

If the prediction engine also produces correct-score probabilities, compare the Over/Under prediction against them.

Example:

If the highest correct-score probabilities are:

1–0
1–1
2–0

then an aggressive Over 3.5 prediction should receive additional scrutiny.

If the highest probabilities are:

2–1
2–2
3–1
3–2

then higher Overs may have stronger supporting evidence.

Correct-score output is a validation layer, NOT the primary Over/Under model.

---

# 30. FINAL OUTPUT

Return:

## MATCH

`HOME TEAM vs AWAY TEAM`

## EXPECTED GOALS

Home:

`X.XX`

Away:

`X.XX`

Total:

`X.XX`

If expected goals cannot be reliably calculated:

`N/A — insufficient data`

---

## MOST LIKELY TOTAL GOALS

`X goals`

Probability:

`XX%`

---

## TOTAL-GOAL DISTRIBUTION

0 goals: `XX%`

1 goal: `XX%`

2 goals: `XX%`

3 goals: `XX%`

4 goals: `XX%`

5+ goals: `XX%`

---

## OVER/UNDER PROBABILITIES

Over 0.5: `XX%`

Under 0.5: `XX%`

Over 1.5: `XX%`

Under 1.5: `XX%`

Over 2.5: `XX%`

Under 2.5: `XX%`

Over 3.5: `XX%`

Under 3.5: `XX%`

Over 4.5: `XX%`

Under 4.5: `XX%`

---

## BEST OVER OPPORTUNITY

Market:

`OVER X.X`

Model probability:

`XX%`

Market probability:

`XX%`

Edge:

`XX%`

EV:

`XX%`

Confidence:

`XX/100`

---

## BEST UNDER OPPORTUNITY

Market:

`UNDER X.X`

Model probability:

`XX%`

Market probability:

`XX%`

Edge:

`XX%`

EV:

`XX%`

Confidence:

`XX/100`

---

# 31. MODEL BREAKDOWN

Show:

- Season goal distribution
- Recent goal distribution
- Home/away signal
- Attack signal
- Defensive signal
- Poisson signal
- Shot/chance signal
- Opponent-strength signal
- Goal-timing signal
- H2H signal
- Lineup signal
- Market signal

For each signal state:

`BULLISH OVER`

`BULLISH UNDER`

`NEUTRAL`

or

`INSUFFICIENT DATA`

---

# 32. POSITIVE SIGNALS

List the five strongest data-backed signals supporting the final selection.

1.
2.
3.
4.
5.

---

# 33. NEGATIVE SIGNALS / RISKS

List the strongest risks.

1.
2.
3.
4.

---

# 34. FINAL DECISION

Choose exactly one:

`OVER X.X`

`UNDER X.X`

`NO BET`

The selected line must be explicitly stated.

Example:

`FINAL DECISION: OVER 1.5`

or:

`FINAL DECISION: UNDER 3.5`

or:

`FINAL DECISION: NO BET`

---

# 35. FINAL REASON

Provide a concise explanation based exclusively on verified data.

The explanation must identify:

- Why the goal environment supports the selected line.
- Which statistical models agree.
- Any significant contradictory evidence.
- Whether the market provides value.
- The overall confidence.
- The data quality.

---

# 36. NO-BET RULE

The engine MUST output:

`NO BET — INSUFFICIENT OVER/UNDER EVIDENCE`

when:

- Data quality is insufficient.
- Models strongly disagree.
- Home/away sample is too small.
- Critical statistics are missing.
- Fixture information is unreliable.
- Odds are unreliable or unavailable when value assessment is required.
- Lineup uncertainty materially affects the projection.
- The model probability does not provide sufficient edge.
- There is no statistically meaningful difference between Over and Under outcomes.

Never force a market selection.

---

# CORE PRINCIPLE

The engine must NOT use a simplistic rule such as:

`Average goals > 2.5 → OVER 2.5`

or:

`Average goals < 2.5 → UNDER 2.5`

Instead, determine the complete goal environment using:

**Season Goal Distribution  
+ Recent Goal Distribution  
+ Home/Away Splits  
+ Attacking Strength  
+ Defensive Vulnerability  
+ Shots  
+ Shots on Target  
+ Big Chances  
+ xG when actually available  
+ Poisson Distribution  
+ Opponent Strength  
+ Goal Timing  
+ BTTS Interaction  
+ H2H Support  
+ Lineup Adjustments  
+ Market Probability  
+ Expected Value  
+ Model Agreement  
+ Data Quality**

The goal is to produce a **calibrated probability distribution**, not simply a binary Over/Under prediction.

The system must prefer:

`NO BET`

over an unsupported prediction.

# FINAL PRIORITY

The prediction hierarchy should be:

**1. Data integrity**

↓

**2. Goal distribution**

↓

**3. Home/Away context**

↓

**4. Attack + defensive strength**

↓

**5. Recent form**

↓

**6. Poisson / statistical models**

↓

**7. Shot/chance data**

↓

**8. Opponent-strength adjustment**

↓

**9. Lineups**

↓

**10. H2H**

↓

**11. Market validation**

↓

**12. Probability + EV**

↓

**13. Final Over/Under selection**

Never reverse this hierarchy simply because bookmaker odds look attractive.