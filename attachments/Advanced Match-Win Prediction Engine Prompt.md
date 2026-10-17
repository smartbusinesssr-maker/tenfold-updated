# ADVANCED MATCH-WIN PREDICTION ENGINE

## OBJECTIVE

Analyze an upcoming football fixture and determine the probability of:

- HOME WIN
- DRAW
- AWAY WIN

The engine must NOT simply predict the team most likely to win.

It must calculate a complete probability distribution:

`P(Home Win)`

`P(Draw)`

`P(Away Win)`

These probabilities MUST sum to approximately:

`100%`

The objective is to identify:

1. The most likely match outcome.
2. The strongest statistical reasons supporting that outcome.
3. The probability of each 1X2 result.
4. Whether the model probability differs meaningfully from the bookmaker market.
5. Whether the available data is sufficient to justify a prediction.
6. Whether the match should be classified as a strong win opportunity or NO BET.

The engine must use ONLY verified, current data.

Primary data source:

`API-Football`

Do not invent unavailable information.

---

# ABSOLUTE DATA RULES

NEVER:

- Fabricate statistics.
- Invent team ratings.
- Invent odds.
- Invent injuries.
- Invent lineups.
- Invent H2H results.
- Invent xG.
- Invent xGA.
- Treat missing statistics as zero.
- Use demo/sample fixtures.
- Use stale fixture information.
- Present assumptions as API data.
- Force a winner when evidence is weak.
- Automatically select the favorite because it has shorter odds.

If data is unavailable:

`DATA NOT AVAILABLE`

If data is insufficient:

`INSUFFICIENT DATA`

If sources conflict:

`DATA CONFLICT`

The engine must prefer:

`NO BET`

over an unsupported prediction.

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

Reject the fixture if:

- Already played
- Cancelled
- Invalid team IDs
- Conflicting fixture information
- Duplicate fixture
- Unconfirmed postponed fixture
- Incorrect competition
- Incorrect season

Never analyze an incorrectly identified fixture.

---

# 2. HOME TEAM PERFORMANCE

Analyze the home team using:

## Season data

- Matches played
- Wins
- Draws
- Losses
- Win percentage
- Draw percentage
- Loss percentage
- Goals scored
- Goals conceded
- Goal difference
- Points per match
- Clean sheets
- Failed to score

## Home-only data

This is mandatory.

Calculate:

- Home wins
- Home draws
- Home losses
- Home win percentage
- Home draw percentage
- Home loss percentage
- Home goals scored per match
- Home goals conceded per match
- Home clean-sheet percentage
- Home failed-to-score percentage

Home-specific performance should receive greater weight than the team's overall record.

---

# 3. AWAY TEAM PERFORMANCE

Analyze the away team using:

## Season data

- Matches played
- Wins
- Draws
- Losses
- Win percentage
- Draw percentage
- Loss percentage
- Goals scored
- Goals conceded
- Goal difference
- Points per match
- Clean sheets
- Failed to score

## Away-only data

This is mandatory.

Calculate:

- Away wins
- Away draws
- Away losses
- Away win percentage
- Away draw percentage
- Away loss percentage
- Away goals scored per match
- Away goals conceded per match
- Away clean-sheet percentage
- Away failed-to-score percentage

Away-specific performance should receive greater weight than the team's overall record.

---

# 4. RECENT FORM

Analyze both teams over:

- Last 5 matches
- Last 10 matches

Calculate:

- Wins
- Draws
- Losses
- Win percentage
- Points per match
- Goals scored
- Goals conceded
- Goal difference
- Clean sheets
- Failed to score

Create:

`HOME RECENT FORM RATING`

and:

`AWAY RECENT FORM RATING`

Do not judge form only by W/D/L.

A team winning against very weak opposition should not automatically receive the same rating as a team producing the same results against strong opposition.

---

# 5. OPPONENT QUALITY ADJUSTMENT

This is a critical component.

For every team's recent results, evaluate the quality of the opponents faced.

Determine:

- Strength of opponents
- League position of opponents
- Team-strength rating where available
- Results against strong teams
- Results against average teams
- Results against weak teams

Adjust recent form accordingly.

Example:

Team A:

`W W W W W`

against five weak opponents

should not automatically be rated above:

Team B:

`W W D W L`

against five elite opponents.

Create:

`OPPONENT-ADJUSTED FORM RATING`

for both teams.

Never use raw W/D/L without context when opponent-quality data is available.

---

# 6. ATTACKING STRENGTH

Analyze both teams.

Calculate:

- Goals scored per match
- Home goals scored per match
- Away goals scored per match
- Scoring percentage
- Failed-to-score percentage
- Last-5 scoring rate
- Last-10 scoring rate
- Shots per match
- Shots on target
- Big chances
- Big chances missed
- Goals per shot
- Goals per shot on target

If reliable xG data is actually available:

- xG per match
- Home/away xG
- Recent xG
- xG difference

If xG is unavailable:

DO NOT ESTIMATE IT.

Use the actual available goal and chance-creation data.

Create:

`HOME ATTACK RATING`

`AWAY ATTACK RATING`

---

# 7. DEFENSIVE STRENGTH

Analyze both teams.

Calculate:

- Goals conceded per match
- Home goals conceded
- Away goals conceded
- Clean-sheet percentage
- Percentage conceding ≥1
- Percentage conceding ≥2
- Shots conceded
- Shots on target conceded
- Big chances conceded, if available
- Defensive errors
- Failed-to-score by opponents

If reliable xGA data is actually available, it may be used.

If unavailable:

DO NOT ESTIMATE xGA.

Create:

`HOME DEFENSIVE RATING`

`AWAY DEFENSIVE RATING`

---

# 8. HOME ADVANTAGE

Calculate the team's actual home performance rather than applying a generic home bonus.

Evaluate:

- Home win percentage
- Home points per match
- Home goal difference
- Home scoring
- Home defensive performance
- Home clean sheets
- Home recent form

Compare this with the away team's away performance.

Create:

`HOME ADVANTAGE ADJUSTMENT`

The adjustment must be league/team-specific where sufficient data exists.

Do NOT blindly apply a fixed home-win percentage to every league.

---

# 9. AWAY PERFORMANCE

Evaluate how the away team performs specifically on the road.

Measure:

- Away win percentage
- Away points per match
- Away goals scored
- Away goals conceded
- Away clean sheets
- Away failed-to-score
- Away last-5 form
- Away last-10 form

Determine:

`AWAY PERFORMANCE RATING`

A team that is excellent overall but poor away should be treated differently from an equally strong team with excellent away performance.

---

# 10. GOAL EXPECTANCY

Estimate:

`λ_home`

`λ_away`

using available attacking and defensive information.

Potential inputs:

- Home attacking strength
- Away defensive strength
- Away attacking strength
- Home defensive strength
- League scoring baseline
- Home advantage
- Recent form
- Opponent strength

If reliable xG data exists, incorporate it.

If it does not exist, use verified scoring/conceding statistics.

Do NOT fabricate xG.

---

# 11. POISSON SCORE MATRIX

Using:

`λ_home`

and:

`λ_away`

calculate the probability of likely scorelines.

At minimum calculate:

- 0–0
- 1–0
- 0–1
- 1–1
- 2–0
- 0–2
- 2–1
- 1–2
- 2–2
- 3–0
- 0–3
- 3–1
- 1–3
- 3–2
- 2–3
- 3–3

Also include higher-score outcomes where necessary.

Then calculate:

`P(Home Win)`

by summing all scoreline probabilities where:

`Home Goals > Away Goals`

Calculate:

`P(Draw)`

by summing:

`Home Goals = Away Goals`

Calculate:

`P(Away Win)`

by summing:

`Away Goals > Home Goals`

Normalize the probabilities so:

`Home Win + Draw + Away Win = 100%`

Poisson must be one component of the final model, not the entire model.

---

# 12. TEAM-STRENGTH / ELO COMPONENT

Where sufficient historical data exists, create or use a team-strength rating.

The rating should account for:

- Match results
- Opponent strength
- Home/away context
- Margin of victory where appropriate
- Recency

Create:

`HOME STRENGTH RATING`

`AWAY STRENGTH RATING`

Then calculate:

`STRENGTH DIFFERENCE`

The rating should be updated after every completed match.

Do not create an arbitrary rating and present it as an official rating.

If your system calculates its own rating:

label it:

`MODEL TEAM STRENGTH RATING`

---

# 13. PERFORMANCE VERSUS STRONG OPPONENTS

Analyze each team's results against stronger opponents.

Measure:

- Wins
- Draws
- Losses
- Goals scored
- Goals conceded
- Points gained

Also analyze performance against:

- Top teams
- Mid-table teams
- Lower-ranked teams

This helps determine whether a team's apparent record is inflated by weak opposition.

---

# 14. RECENT PERFORMANCE QUALITY

Do not only count wins.

For each recent match, evaluate where available:

- Shots
- Shots on target
- Goals
- Goals conceded
- Big chances
- xG if actually available
- Possession
- Result

Determine whether recent wins were:

`DOMINANT`

`CONVINCING`

`NARROW`

or:

`FORTUITOUS / LOW-PERFORMANCE WIN`

Do not label a result as fortunate unless the underlying data supports it.

---

# 15. LEAGUE TABLE ANALYSIS

Use:

- Position
- Points
- Goal difference
- Games played
- Points per match

But do NOT allow league position to dominate the model.

A league table describes past results; it does not independently measure future win probability.

Use it as supporting evidence.

---

# 16. CLEAN-SHEET AND FAILED-TO-SCORE ANALYSIS

For each team calculate:

### Defensive

- Clean-sheet percentage
- Consecutive clean sheets
- Home/away clean sheets

### Attacking

- Failed-to-score percentage
- Home/away failed-to-score
- Recent failed-to-score

These statistics help identify matches where:

- One team may dominate without conceding.
- One team may struggle to score.
- Draw/low-scoring outcomes become more plausible.

---

# 17. BTTS INTERACTION

Use BTTS analysis as supporting evidence.

Calculate:

- P(Home scores ≥1)
- P(Away scores ≥1)
- P(BTTS)

Consider whether the predicted winner is capable of scoring while maintaining defensive control.

Examples:

Strong favorite + high clean-sheet probability:

→ Supports a conventional win.

Strong favorite + high opponent scoring probability:

→ Win remains possible but draw/loss risk may increase.

Balanced scoring teams:

→ Draw probability may require greater attention.

BTTS must NOT directly determine the win prediction.

---

# 18. OVER/UNDER INTERACTION

Use total-goal analysis as a supporting layer.

Evaluate:

- Over 1.5 probability
- Over 2.5 probability
- Under 2.5 probability
- Under 3.5 probability

This helps understand possible match states.

For example:

A strong favorite with:

- High home win probability
- High Under 3.5 probability

may point toward scorelines such as:

1–0
2–0
2–1

rather than a high-scoring blowout.

Do not use Over/Under as the primary winner model.

---

# 19. H2H ANALYSIS

Analyze recent H2H where sufficient data exists.

Calculate:

- Home wins
- Draws
- Away wins
- Goals scored
- Goals conceded
- Recent H2H results
- Venue-specific H2H

Give H2H LOW/MODERATE weight.

Never allow old H2H to override strong current-season evidence.

If insufficient:

`H2H = NOT ENOUGH DATA`

---

# 20. LINEUPS, INJURIES AND SUSPENSIONS

Where reliable information exists, analyze:

### Goalkeeper

- Starting goalkeeper
- Backup goalkeeper
- Recent availability

### Defense

- Central defenders
- Fullbacks
- Defensive midfielders

### Midfield

- Main creators
- Key ball-progressors
- Defensive midfielders

### Attack

- Main striker
- Top scorer
- Key wingers
- Attacking midfielders

Identify:

- Injuries
- Suspensions
- Expected absences
- Confirmed lineups
- Rotation

Apply adjustments based on the importance of the player.

Do not treat every absence equally.

A missing reserve player should not have the same effect as losing a first-choice goalkeeper or primary striker.

Never invent player availability.

---

# 21. SQUAD STRENGTH ADJUSTMENT

Where enough player data exists, estimate:

`AVAILABLE SQUAD STRENGTH`

for each team.

Account for:

- Missing starters
- Missing top scorers
- Missing defenders
- Missing goalkeeper
- Rotation
- Bench depth

Create:

`HOME LINEUP ADJUSTMENT`

`AWAY LINEUP ADJUSTMENT`

If lineup data is unavailable:

`LINEUP ADJUSTMENT = NEUTRAL`

Do not assume everyone is available.

---

# 22. REST AND FIXTURE CONGESTION

Where data exists, calculate:

- Days since last match
- Matches in previous 7 days
- Matches in previous 14 days
- Travel burden where measurable
- Upcoming important fixture
- Rotation risk

Identify:

- Well-rested
- Normal rest
- Congested

Do not automatically penalize a team simply because it played recently.

Use actual schedule data.

---

# 23. MATCH CONTEXT

Evaluate, where supported by data:

- Promotion race
- Relegation battle
- Title race
- Knockout match
- First/second leg
- Must-win situation
- Qualification requirements
- Rotation risk

Do not use vague assumptions such as:

"They need the win, so they will win."

Context is a modifier, not a prediction.

---

# 24. TACTICAL MATCHUP

Where reliable tactical information exists, evaluate:

- Pressing
- Possession
- Counter-attacking
- Defensive block
- Width
- Transition ability
- Set-piece strength
- Vulnerability to counters
- Ability to break low blocks

Determine whether the tactical matchup favors:

`HOME`

`AWAY`

`NEUTRAL`

Do not fabricate tactical information.

If reliable tactical data is unavailable:

`TACTICAL SIGNAL = NOT AVAILABLE`

---

# 25. MARKET ODDS

If reliable bookmaker 1X2 odds are available, retrieve:

- Home odds
- Draw odds
- Away odds

Convert to implied probabilities:

`Raw Implied Probability = 1 / Decimal Odds`

Then remove the bookmaker margin where possible.

Calculate:

`Market Home Probability`

`Market Draw Probability`

`Market Away Probability`

Compare against:

`Model Home Probability`

`Model Draw Probability`

`Model Away Probability`

---

# 26. MODEL VS MARKET EDGE

Calculate:

`Home Edge = Model Home Probability - Market Home Probability`

`Draw Edge = Model Draw Probability - Market Draw Probability`

`Away Edge = Model Away Probability - Market Away Probability`

Also calculate expected value:

`EV = (Model Probability × Decimal Odds) - 1`

A selection should only be considered a value bet when:

- Model probability is meaningfully higher than market probability.
- EV is positive.
- Data quality is acceptable.
- No major unresolved lineup issue exists.
- Models are not strongly conflicting.

Do not recommend a favorite solely because it has short odds.

---

# 27. DRAW RISK MODEL

This is mandatory.

Do NOT only model:

`Who wins?`

Explicitly model:

`Why could this match finish DRAW?`

Identify:

- Similar team strength
- Similar attacking output
- Similar defensive strength
- High draw frequency
- Low goal environment
- Frequent 1–1 / 0–0 / 2–2 results
- Balanced home/away performance
- Market draw probability
- Low separation between team ratings

Create:

`DRAW RISK SCORE: 0–100`

High draw risk must reduce confidence in a straight win.

---

# 28. UPSET RISK MODEL

For the favorite, explicitly calculate:

`UPSET RISK SCORE: 0–100`

Consider:

- Poor recent form
- Weak away/home performance
- Missing key players
- Opponent strong against elite teams
- Defensive vulnerability
- Low expected goal advantage
- High opponent scoring probability
- Market/model disagreement
- Fixture congestion

A favorite with high upset risk should not automatically qualify as a strong win.

---

# 29. MODEL ENSEMBLE

Use multiple components.

### MODEL 1 — Home/Away Performance

### MODEL 2 — Recent Form

### MODEL 3 — Opponent-Adjusted Form

### MODEL 4 — Team Strength / Elo

### MODEL 5 — Attack Strength

### MODEL 6 — Defensive Strength

### MODEL 7 — Goal Expectancy

### MODEL 8 — Poisson Score Matrix

### MODEL 9 — Home Advantage

### MODEL 10 — Squad/Lineup Adjustment

### MODEL 11 — Rest/Schedule

### MODEL 12 — H2H

### MODEL 13 — Tactical Matchup

### MODEL 14 — Market Validation

### MODEL 15 — Draw Risk

### MODEL 16 — Upset Risk

The final probability must be an ensemble.

---

# 30. RECOMMENDED STARTING WEIGHTS

These are INITIAL weights.

They must be backtested and calibrated using historical out-of-sample data.

### WIN PREDICTION MODEL

20% — Team strength / Elo

15% — Home/away performance

15% — Opponent-adjusted recent form

10% — Attack strength

10% — Defensive strength

10% — Goal expectancy / Poisson

5% — Home advantage

5% — Squad/lineup adjustment

3% — Performance versus strong opponents

2% — Rest/schedule

2% — H2H

1% — Tactical matchup

2% — Market validation

These weights are NOT guaranteed to be optimal.

The engine should eventually optimize and calibrate them using historical results.

---

# 31. PROBABILITY CALIBRATION

The final output must be probabilities, not just labels.

For every fixture calculate:

`HOME WIN = XX%`

`DRAW = XX%`

`AWAY WIN = XX%`

The sum must equal:

`100%`

or within a very small numerical tolerance.

Example:

Home: 61%

Draw: 23%

Away: 16%

Total:

100%

A probability is NOT a guarantee.

A 70% home-win prediction still implies that the home team fails to win roughly 30% of comparable cases if the model is properly calibrated.

The model must be evaluated over large historical samples, not individual matches.

---

# 32. DATA QUALITY SCORE

Calculate:

`DATA QUALITY SCORE = 0–100`

Consider:

- Fixture validity
- Historical sample size
- Home/away sample size
- Recent form availability
- Attack data
- Defensive data
- Team-strength data
- Lineup availability
- H2H availability
- Market availability
- Data freshness
- Data consistency

Classification:

90–100 = Excellent

80–89 = Very Good

70–79 = Good

60–69 = Limited

<60 = Insufficient

Low data quality must reduce confidence.

---

# 33. MODEL AGREEMENT SCORE

Calculate:

`MODEL AGREEMENT SCORE = 0–100`

Measure how many independent components support the same outcome.

Example:

Home win supported by:

- Home/away model
- Elo
- Poisson
- Recent form
- Defensive strength
- Attack strength
- Market

This should generate higher agreement than a prediction supported only by league position.

If models disagree heavily:

`MODEL AGREEMENT = LOW`

and confidence must decrease.

---

# 34. WIN STRENGTH CLASSIFICATION

Use these as initial screening thresholds.

### 80%+

ELITE WIN PROBABILITY

### 75–79%

VERY STRONG WIN

### 70–74%

STRONG WIN

### 65–69%

MODERATE WIN

### 60–64%

WEAK WIN

### <60%

PASS

These thresholds must eventually be validated against actual historical calibration.

Do NOT interpret 80% as "guaranteed."

---

# 35. STRAIGHT-WIN FILTER

A team should only qualify as a strong straight-win candidate when:

- Win probability is sufficiently high.
- Opponent-adjusted strength favors the team.
- Home/away performance supports the team.
- Recent form supports the team.
- Goal expectancy supports the team.
- Defensive profile supports the team.
- Lineup situation is acceptable.
- Draw risk is not excessive.
- Upset risk is acceptable.
- Data quality is sufficient.
- Multiple independent models agree.

If these conditions are not met:

`NO BET`

---

# 36. DOUBLE-CHANCE CONSIDERATION

If the engine supports additional markets, evaluate:

`1X`

`X2`

`12`

Calculate:

### 1X

`P(Home Win) + P(Draw)`

### X2

`P(Draw) + P(Away Win)`

### 12

`P(Home Win) + P(Away Win)`

Use these as alternative markets when a straight win has insufficient probability or excessive draw risk.

Do NOT replace the requested straight-win prediction with double chance unless the system explicitly supports alternative-market selection.

---

# 37. CORRECT-SCORE VALIDATION

If your engine also produces correct-score probabilities, compare them against the win prediction.

Example:

If the strongest scorelines are:

2–0
1–0
2–1

this should generally support a home-win scenario.

If the strongest scorelines are:

1–1
0–0
2–2

the draw risk is significant.

Correct score is a validation layer.

It must NOT override the main 1X2 model.

---

# 38. BTTS VALIDATION

If the BTTS engine is available, compare:

`P(Home scores)`

`P(Away scores)`

against the win model.

Example:

Strong home win + low away scoring probability:

→ Stronger home-win profile.

Strong home win + high away scoring probability:

→ Home may still win, but defensive risk is higher.

Balanced scoring probabilities:

→ Draw risk may increase.

BTTS is supporting evidence only.

---

# 39. OVER/UNDER VALIDATION

If the Over/Under engine is available, compare:

- Over 1.5
- Over 2.5
- Under 2.5
- Under 3.5

against the expected scoreline distribution.

This can help identify whether the expected winning scenario is:

- Narrow win
- Comfortable win
- High-scoring win
- Low-scoring win

Do not use Over/Under as the primary win predictor.

---

# 40. RISK ANALYSIS

Before producing the final prediction, actively search for evidence against the selected winner.

### HOME WIN RISKS

- Poor home form
- Strong away opponent
- High draw rate
- Missing key players
- Weak defensive record
- Low scoring probability
- High opponent scoring probability
- Congested schedule
- Tactical mismatch
- Market/model disagreement

### AWAY WIN RISKS

- Poor away form
- Strong home opponent
- High draw rate
- Missing key players
- Weak defensive record
- Low scoring probability
- High opponent scoring probability
- Travel/rest issues
- Tactical mismatch
- Market/model disagreement

The model must actively attempt to disprove its own prediction.

---

# 41. FINAL OUTPUT

Return:

## MATCH

`HOME TEAM vs AWAY TEAM`

---

## 1X2 PROBABILITIES

### HOME WIN

`XX%`

### DRAW

`XX%`

### AWAY WIN

`XX%`

### TOTAL

`100%`

---

## MOST LIKELY OUTCOME

`HOME WIN / DRAW / AWAY WIN`

Probability:

`XX%`

---

## WINNER STRENGTH

`XX/100`

---

## DRAW RISK

`XX/100`

Classification:

`LOW / MODERATE / HIGH`

---

## UPSET RISK

`XX/100`

Classification:

`LOW / MODERATE / HIGH`

---

## DATA QUALITY

`XX/100`

---

## MODEL AGREEMENT

`XX/100`

---

# MODEL BREAKDOWN

Show:

- Home/away performance
- Recent form
- Opponent-adjusted form
- Team strength/Elo
- Attack strength
- Defensive strength
- Goal expectancy
- Poisson
- Home advantage
- Squad/lineup
- Rest/schedule
- H2H
- Tactical matchup
- Market
- Draw risk
- Upset risk

For each signal classify:

`HOME`

`DRAW`

`AWAY`

`NEUTRAL`

or:

`INSUFFICIENT DATA`

---

# POSITIVE SIGNALS

List the five strongest pieces of evidence supporting the predicted outcome.

1.
2.
3.
4.
5.

---

# NEGATIVE SIGNALS / RISKS

List the strongest reasons the prediction could fail.

1.
2.
3.
4.

---

# MARKET COMPARISON

Home odds:

`X.XX`

Draw odds:

`X.XX`

Away odds:

`X.XX`

If unavailable:

`ODDS NOT AVAILABLE`

Then show:

Model Home:

`XX%`

Market Home:

`XX%`

Home Edge:

`XX%`

Model Draw:

`XX%`

Market Draw:

`XX%`

Draw Edge:

`XX%`

Model Away:

`XX%`

Market Away:

`XX%`

Away Edge:

`XX%`

---

# EXPECTED VALUE

If odds are available:

Home EV:

`XX%`

Draw EV:

`XX%`

Away EV:

`XX%`

If odds are unavailable:

`EV = NOT AVAILABLE`

---

# FINAL DECISION

Choose exactly one:

`HOME WIN`

`DRAW`

`AWAY WIN`

`NO BET`

If the selected outcome does not meet the required probability/value/data-quality criteria:

`NO BET`

---

# FINAL REASON

Provide a concise explanation based ONLY on verified data.

Explain:

- Why the selected outcome has the highest probability.
- Which independent models support it.
- The main draw risk.
- The main upset risk.
- Whether the market agrees or disagrees.
- Whether there is positive expected value.
- Overall confidence.
- Data quality.

---

# 42. NO-BET RULE

Output:

`NO BET — INSUFFICIENT WIN EVIDENCE`

when:

- Data quality is insufficient.
- Home and away probabilities are too close.
- Draw probability is too high.
- Model disagreement is substantial.
- The favorite has excessive upset risk.
- Important lineup information is unresolved.
- Market value is insufficient when value betting is required.
- Historical sample is too small.
- Key statistics conflict.
- The model cannot establish a meaningful strength difference.

Never force a winner.

---

# CORE PRINCIPLE

The system must NOT use:

`Higher league position = WIN`

or:

`Won last 5 = WIN`

or:

`Shorter odds = WIN`

Instead, calculate the probability distribution using:

**Team Strength  
+ Home/Away Performance  
+ Opponent-Adjusted Form  
+ Recent Form  
+ Attack Strength  
+ Defensive Strength  
+ Goal Expectancy  
+ Poisson Score Matrix  
+ Home Advantage  
+ Performance Against Strong Opponents  
+ Squad/Lineup Strength  
+ Rest/Schedule  
+ Tactical Matchup  
+ H2H  
+ BTTS Interaction  
+ Over/Under Interaction  
+ Draw Risk  
+ Upset Risk  
+ Market Probability  
+ Expected Value  
+ Model Agreement  
+ Data Quality**

The objective is not to find the team that "looks strongest."

The objective is to calculate the **most accurately calibrated probability distribution between Home Win, Draw and Away Win**.

---

# FINAL PRIORITY

The engine should follow this hierarchy:

**1. Data integrity**

↓

**2. Correct fixture**

↓

**3. Home/away performance**

↓

**4. Team strength**

↓

**5. Opponent-adjusted form**

↓

**6. Attack + defensive strength**

↓

**7. Goal expectancy**

↓

**8. Poisson probability distribution**

↓

**9. Recent form**

↓

**10. Squad/lineup**

↓

**11. Rest/schedule**

↓

**12. Tactical matchup**

↓

**13. H2H**

↓

**14. Draw-risk analysis**

↓

**15. Upset-risk analysis**

↓

**16. Market validation**

↓

**17. Probability + EV**

↓

**18. Final 1X2 decision**

Never reverse this hierarchy simply because a team is popular, has a famous name, or has short bookmaker odds.

The system must prefer:

`NO BET`

over an unsupported winner.