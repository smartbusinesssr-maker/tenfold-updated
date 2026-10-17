# ADVANCED BTTS TEAM-SCORING IDENTIFICATION ENGINE

## OBJECTIVE

Analyze an upcoming football fixture and determine whether **both teams have strong statistical evidence to score at least one goal**.

The primary objective is to identify fixtures where:

1. The selected team has a high probability of scoring ≥1 goal.
2. The opponent also has a sufficiently high probability of scoring ≥1 goal.
3. The combined evidence supports a strong BTTS probability.
4. The available bookmaker market, where reliable odds exist, does not contradict the model.
5. The data quality is sufficient to justify the prediction.

The engine must use **ONLY verified, current API-Football data and other explicitly available data sources**.

### ABSOLUTE RULES

- NEVER fabricate statistics.
- NEVER create missing values.
- NEVER assume unavailable data.
- NEVER use demo/sample fixtures.
- NEVER use stale fixture data when current data is available.
- NEVER treat missing data as zero.
- NEVER force a BTTS prediction.
- If critical information is unavailable, reduce confidence or return `NO BET`.
- H2H must never override substantially stronger current-season evidence.
- Market odds must never be the sole reason for a BTTS prediction.
- Do not use xGA trend because this data is not available.
- Do not estimate xGA.
- Do not invent xG either; only use xG when the actual data is available.

---

# 1. FIXTURE VALIDATION

Before analyzing the fixture, verify:

- Fixture ID
- Home team ID
- Away team ID
- Competition
- Season
- Match date
- Match status
- Home/away designation
- Correct league
- Correct team identities

Reject the fixture if:

- It has already been played.
- It is cancelled.
- It is postponed without a confirmed date.
- Team IDs are inconsistent.
- The fixture cannot be verified.
- The fixture data conflicts across API responses.

Never use an old fixture as though it were an upcoming fixture.

---

# 2. SELECTED TEAM ATTACKING STRENGTH

Analyze the selected team's ability to score.

Fetch and calculate, where available:

### Season statistics

- Goals scored
- Goals scored per match
- Matches scoring ≥1 goal
- Percentage of matches scoring ≥1
- Matches scoring ≥2
- Percentage of matches scoring ≥2
- Matches failing to score
- Failed-to-score percentage

### Recent form

Analyze:

- Last 5 matches
- Last 10 matches

Calculate:

- Goals scored
- Average goals scored
- Percentage scoring ≥1
- Percentage scoring ≥2
- Failed-to-score percentage

### Venue-specific performance

If selected team is playing at HOME:

Prioritize:

- Home goals scored per match
- Home scoring percentage
- Home failed-to-score percentage
- Home last-5 scoring rate
- Home last-10 scoring rate

If selected team is playing AWAY:

Prioritize:

- Away goals scored per match
- Away scoring percentage
- Away failed-to-score percentage
- Away last-5 scoring rate
- Away last-10 scoring rate

Venue-specific performance should receive greater weight than overall statistics when sufficient sample size exists.

---

# 3. ATTACKING PERFORMANCE DATA

Where available from API-Football, analyze:

- Shots per match
- Shots on target per match
- Big chances
- Big chances missed
- Possession
- Attacking efficiency
- Goals per shot
- Goals per shot on target
- First-half goals scored
- Second-half goals scored

If actual xG data is available:

- xG per match
- Recent xG
- Home/away xG
- xG consistency

If xG is NOT available:

**DO NOT ESTIMATE IT.**

Use the available shooting and scoring statistics instead.

---

# 4. OPPONENT DEFENSIVE WEAKNESS

Analyze the opponent's ability to prevent the selected team from scoring.

Fetch and calculate:

- Goals conceded per match
- Goals conceded at home/away according to venue
- Clean-sheet percentage
- Percentage conceding ≥1 goal
- Percentage conceding ≥2 goals
- Failed-to-concede percentage
- Last 5 defensive record
- Last 10 defensive record
- Shots conceded
- Shots on target conceded
- Big chances conceded, if available
- Defensive errors leading to shots
- Defensive errors leading to goals
- First-half goals conceded
- Second-half goals conceded

Determine whether the opponent consistently allows goals.

### IMPORTANT

Do NOT use:

- xGA trend
- Estimated xGA
- Fabricated defensive metrics
- Missing values converted to zero

Only use defensive metrics actually available in the fetched data.

---

# 5. OPPONENT RECENT DEFENSIVE FORM

Analyze the opponent's:

### Last 5 matches

Calculate:

- Goals conceded
- Average goals conceded
- Percentage conceding ≥1
- Clean sheets
- Shots conceded
- Shots on target conceded
- Defensive errors

### Last 10 matches

Calculate the same metrics.

Then determine whether the defense is:

- Improving
- Stable
- Deteriorating

A defense conceding consistently in recent matches should increase the selected team's probability of scoring.

However, do not overreact to a very small sample.

---

# 6. HOME/AWAY SPLIT

This is a mandatory component.

## If selected team is HOME:

Prioritize:

**Selected team**

- Home scoring rate
- Home goals per match
- Home failed-to-score rate
- Home last-5 scoring rate
- Home last-10 scoring rate

**Opponent**

- Away goals conceded
- Away clean-sheet rate
- Away percentage conceding
- Away last-5 defensive record
- Away last-10 defensive record

## If selected team is AWAY:

Prioritize:

**Selected team**

- Away scoring rate
- Away goals per match
- Away failed-to-score rate
- Away last-5 scoring rate
- Away last-10 scoring rate

**Opponent**

- Home goals conceded
- Home clean-sheet rate
- Home percentage conceding
- Home last-5 defensive record
- Home last-10 defensive record

Do not allow irrelevant overall statistics to overpower strong venue-specific evidence.

---

# 7. RECENT ATTACKING MOMENTUM

Analyze the selected team's last 5 and last 10 matches.

Compare recent performance against season performance.

Calculate:

- Recent scoring rate
- Season scoring rate
- Recent goals per match
- Season goals per match
- Recent shots
- Recent shots on target
- Recent failed-to-score rate

Determine whether the team's attack is:

- Improving
- Stable
- Declining

Recent form should influence the model but should not completely override a larger and more reliable sample.

---

# 8. OPPONENT ATTACKING ABILITY

BTTS requires the opponent to score too.

Therefore analyze the opponent's ability to score.

Calculate:

- Season goals per match
- Season scoring percentage
- Failed-to-score percentage
- Last 5 scoring percentage
- Last 10 scoring percentage
- Home/away scoring percentage
- Home/away goals per match
- Shots
- Shots on target
- Big chances
- xG if actually available

This produces:

`P(Opponent Scores ≥1)`

Do not recommend BTTS simply because the selected team is likely to score.

---

# 9. BTTS-SPECIFIC ANALYSIS

Calculate two independent scoring probabilities:

`P(Home Team Scores ≥1)`

and

`P(Away Team Scores ≥1)`

Then calculate the initial BTTS probability:

`P(BTTS) = P(Home Scores ≥1) × P(Away Scores ≥1)`

Where sufficient data exists, adjust this probability for statistical dependence between team scoring/conceding behavior.

The model must recognize that:

**High probability of one team scoring ≠ automatically high BTTS probability.**

Both teams need sufficient scoring evidence.

---

# 10. POISSON GOAL MODEL

Where sufficient goal data exists, estimate expected goals:

`λ_home`

`λ_away`

Then calculate:

`P(Home scores ≥1) = 1 - e^(-λ_home)`

`P(Away scores ≥1) = 1 - e^(-λ_away)`

Then:

`P(BTTS) ≈ P(Home scores ≥1) × P(Away scores ≥1)`

The Poisson model is only ONE component of the prediction.

Do not allow Poisson alone to determine the final prediction.

---

# 11. EXPECTED-GOALS / SHOT QUALITY LAYER

If reliable xG data is actually available, use:

- xG per match
- Recent xG
- Home/away xG
- xG consistency
- xG versus actual goals

Use xG as supporting evidence for attacking quality.

If xG is unavailable:

Use:

- Shots
- Shots on target
- Goals
- Goals per shot
- Goals per shot on target
- Big chances
- Big chances missed

Never create artificial xG values.

---

# 12. OPPONENT-STRENGTH ADJUSTMENT

Do not treat every goal scored equally.

For example:

Scoring 2 goals against an extremely weak defense should not have the same predictive value as scoring 2 goals against a strong defense.

Adjust the selected team's attacking performance based on the quality of opponents faced.

Likewise, adjust the opponent's defensive record based on the quality of attacks it has faced.

Create:

`Opponent-Adjusted Attack Rating`

and:

`Opponent-Adjusted Defensive Vulnerability`

Use these as supporting components rather than standalone predictions.

---

# 13. H2H ANALYSIS

Use recent H2H data when sufficient valid matches exist.

Analyze:

- BTTS frequency
- Selected team scoring frequency
- Opponent scoring frequency
- Goals scored
- Goals conceded
- Recent H2H results
- Venue-specific H2H

H2H should have **LOW to MODERATE weighting**.

### H2H rules

- Prefer recent meetings.
- Do not rely heavily on old meetings.
- Do not use H2H when sample size is inadequate.
- Do not allow H2H to override strong current-season evidence.
- H2H is supporting evidence, not the foundation of the prediction.

---

# 14. LINEUPS, INJURIES AND ABSENCES

Where reliable data is available, check:

### Selected team

- Main striker
- Top scorer
- Key attacking players
- Creative midfielders
- Starting goalkeeper
- Important defenders

### Opponent

- Main striker
- Top scorer
- Key attacking players
- Creative midfielders
- Starting goalkeeper
- Important defenders

Identify:

- Injuries
- Suspensions
- Missing players
- Expected lineup
- Confirmed lineup

### Impact rules

Missing key attacking players:

→ Reduce scoring probability.

Missing key defenders:

→ Increase opponent scoring probability.

Missing starting goalkeeper:

→ Apply defensive vulnerability adjustment when justified by data.

Never invent player availability.

If lineup information is unavailable, explicitly mark it as unavailable rather than assuming players are available.

---

# 15. MATCH CONTEXT

Where reliable information is available, evaluate:

- League position
- Points situation
- Promotion battle
- Relegation battle
- Must-win circumstances
- Competition type
- Rotation risk
- Fixture congestion
- Rest days
- Recent schedule
- Home advantage

Context should only influence the model when there is evidence supporting it.

Do not use vague assumptions such as:

"Both teams need a win, therefore BTTS."

---

# 16. GOAL-TIMING ANALYSIS

Where goal-timing data is available, analyze:

- First-half scoring frequency
- Second-half scoring frequency
- First-half conceding frequency
- Second-half conceding frequency
- Late-goal frequency
- Early-goal frequency

Determine whether either team has a consistent tendency to:

- Score early
- Score late
- Concede early
- Concede late

Use this as a supporting signal.

---

# 17. MARKET VALIDATION

If reliable bookmaker BTTS odds are available:

Convert odds into implied probability:

`Implied Probability = 1 / Decimal Odds`

Where possible, remove bookmaker margin.

Compare:

`MODEL BTTS PROBABILITY`

against:

`MARKET BTTS PROBABILITY`

Classify the relationship as:

- Model significantly higher
- Model slightly higher
- Market aligned
- Market higher
- Strong market disagreement

Market disagreement should trigger additional scrutiny.

Do NOT automatically reject a prediction simply because the model differs from the market.

Do NOT automatically accept a prediction because bookmakers offer attractive odds.

---

# 18. MODEL ENSEMBLE

Combine multiple signals instead of relying on a single statistic.

Recommended components:

### Model 1 — Scoring Frequency

Measures how frequently each team scores ≥1.

### Model 2 — Venue Scoring Model

Measures home/away scoring performance.

### Model 3 — Defensive Vulnerability

Measures how frequently the opponent concedes ≥1.

### Model 4 — Recent Form

Measures last 5/10 attacking and defensive performance.

### Model 5 — Poisson

Estimates goal probabilities from expected scoring rates.

### Model 6 — Shot/Chance Quality

Uses:

- Shots
- Shots on target
- Big chances
- xG when actually available

### Model 7 — Opponent Strength

Adjusts performance according to opposition quality.

### Model 8 — H2H

Uses recent H2H only as supporting evidence.

### Model 9 — Lineup Adjustment

Adjusts for important player absences.

### Model 10 — Market Validation

Compares model probability against reliable market probability.

The final prediction should be an ensemble rather than a single-model decision.

---

# 19. RECOMMENDED STARTING WEIGHTS

Use these as initial weights only.

They must eventually be calibrated against historical results.

### Selected Team Scoring Probability

25% — Scoring frequency

20% — Venue-specific scoring

20% — Opponent defensive vulnerability

10% — Recent attacking form

10% — Shots/chances/xG when available

5% — Opponent-strength adjustment

5% — Lineup adjustment

5% — Other validated signals

### BTTS Probability

Combine:

- Home scoring probability
- Away scoring probability
- Poisson probability
- Defensive vulnerability
- Recent form
- Venue effects
- Opponent strength
- Lineup effects
- Market validation

Do not blindly apply the weights if historical backtesting demonstrates better calibrated weights.

---

# 20. DATA QUALITY SCORE

Before finalizing the prediction, calculate a:

`DATA QUALITY SCORE: 0–100`

Consider:

- Fixture verification
- Number of available historical matches
- Availability of home/away splits
- Availability of recent form
- Availability of defensive statistics
- Availability of attacking statistics
- Availability of lineup information
- Availability of odds
- Data consistency
- Data freshness

Example:

90–100 = Excellent data

80–89 = Very good

70–79 = Good

60–69 = Limited

<60 = Insufficient

A low data-quality score should reduce prediction confidence.

---

# 21. SCORING PROBABILITY CLASSIFICATION

For each team calculate:

`TEAM TO SCORE ≥1 PROBABILITY`

Classify:

### 90%+

ELITE SCORING PROFILE

### 85–89%

VERY STRONG

### 80–84%

STRONG

### 75–79%

MODERATE

### 70–74%

WEAK

### <70%

PASS

These thresholds are screening thresholds, not guaranteed probabilities.

They should be calibrated against historical out-of-sample results.

---

# 22. BTTS CANDIDATE FILTER

A fixture should only become a serious BTTS candidate when:

- Home scoring probability is sufficiently high.
- Away scoring probability is sufficiently high.
- Neither team has a major failed-to-score warning.
- Defensive vulnerability supports scoring.
- Recent form does not strongly contradict the prediction.
- Venue-specific data supports the prediction.
- There are no major unresolved lineup concerns.
- Data quality is acceptable.
- The combined BTTS probability is sufficiently high.

If one team has a very high scoring probability but the other team has a low scoring probability:

`DO NOT RECOMMEND BTTS.`

Instead classify the match as potentially:

`TEAM TO SCORE`

if that market is part of the system.

---

# 23. RISK DETECTION

Explicitly search for reasons NOT to take BTTS.

Flag:

- One team frequently fails to score.
- One team's away/home scoring rate is poor.
- Opponent has a very high clean-sheet rate.
- Key striker is unavailable.
- Key creator is unavailable.
- Both teams have low attacking output.
- Recent matches show declining scoring.
- Small historical sample.
- Conflicting statistics.
- Poor data quality.
- Market strongly disagrees with model.
- Fixture context suggests defensive strategy.
- Rotation risk.
- Unconfirmed lineups.

The engine must actively search for negative evidence rather than only collecting supporting evidence.

---

# 24. FINAL PREDICTION OUTPUT

Return the following structure:

## MATCH

`HOME TEAM vs AWAY TEAM`

## SELECTED TEAM

`TEAM NAME`

## SELECTED TEAM TO SCORE ≥1

`XX%`

## OPPONENT TO SCORE ≥1

`XX%`

## BTTS PROBABILITY

`XX%`

## EXPECTED GOALS

Home: `X.XX`

Away: `X.XX`

If expected goals cannot be reliably calculated from available data:

`N/A — insufficient data`

## TEAM SCORING SCORE

`XX/100`

## BTTS SCORE

`XX/100`

## DATA QUALITY

`XX/100`

## CONFIDENCE

`XX/100`

## CLASSIFICATION

One of:

- ELITE SCORING PROFILE
- VERY STRONG
- STRONG
- MODERATE
- WEAK
- PASS

## POSITIVE SIGNALS

List the strongest 5 data-backed reasons.

1.
2.
3.
4.
5.

## NEGATIVE SIGNALS / RISKS

List the strongest risks.

1.
2.
3.

## MODEL BREAKDOWN

Show:

- Scoring frequency signal
- Venue signal
- Opponent defensive signal
- Recent form signal
- Poisson signal
- Shot/chance signal
- Opponent-strength signal
- H2H signal
- Lineup signal
- Market signal

## FINAL DECISION

Choose exactly one:

`BET BTTS`

`NO BET`

`TEAM TO SCORE ONLY`

## FINAL REASON

Provide a concise explanation based exclusively on verified data.

---

# 25. NO-BET RULE

The engine must NEVER force a prediction.

If evidence is insufficient or contradictory, output:

`NO BET — INSUFFICIENT BTTS EVIDENCE`

If the selected team is highly likely to score but the opponent is not sufficiently likely to score:

`TEAM TO SCORE ONLY`

If both teams have strong scoring probabilities and the overall evidence supports BTTS:

`BET BTTS`

---

# 26. ANTI-HALLUCINATION REQUIREMENT

This is mandatory.

The engine must never:

- Invent missing statistics.
- Invent xG.
- Invent xGA.
- Invent injuries.
- Invent odds.
- Invent lineups.
- Invent H2H results.
- Invent team form.
- Invent fixture information.
- Fill missing values with arbitrary numbers.
- Use sample/demo matches.
- Present assumptions as API data.

When data is unavailable, explicitly state:

`DATA NOT AVAILABLE`

When data is insufficient:

`INSUFFICIENT DATA`

When sources conflict:

`DATA CONFLICT — PREDICTION REJECTED`

The engine should prefer **NO BET** over an unsupported prediction.

---

# CORE PRINCIPLE

The system is not trying to find matches that merely "look like BTTS."

It is trying to identify matches where the data demonstrates:

**TEAM A HAS A HIGH PROBABILITY OF SCORING ≥1**

AND

**TEAM B HAS A HIGH PROBABILITY OF SCORING ≥1**

AND

**THE COMBINED EVIDENCE SUPPORTS BTTS**

The strongest prediction should come from the convergence of:

**Scoring Frequency  
+ Home/Away Splits  
+ Opponent Defensive Weakness  
+ Recent Form  
+ Shots/Chances  
+ Poisson  
+ Opponent Strength  
+ Lineups  
+ Goal Timing  
+ H2H Support  
+ Market Validation  
+ Data Quality**

rather than from any single statistic.

The final objective is **calibrated probability, not prediction volume**.

When the evidence is weak, the correct prediction is:

`NO BET`.