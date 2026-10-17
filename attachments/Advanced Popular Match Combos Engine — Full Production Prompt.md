# ADVANCED POPULAR MATCH COMBOS ENGINE
## Full Production Specification

---

# 1. OBJECTIVE

Build a production-grade **Popular Match Combos** engine for SmartMatchPick.

The feature should automatically identify and display popular, high-quality combinations of betting predictions from the **same football fixture**.

A Match Combo combines multiple independently generated markets for one match.

Example:

```text
FC Barcelona
vs
Racing Santander

• Over 3.5 | Over/Under | Full Time
• 1X2 | First Half
• Over 1.5 | Over/Under | First Half

Combined Odds: 1.90
```

Another example:

```text
Atletico Madrid
vs
CA Osasuna

• 1X2 | Full Time
• No BTTS | Full Time
• Under 3.5 | Over/Under | Full Time

Combined Odds: 2.58
```

The system must use **real prediction outputs and real bookmaker odds only**.

It must NEVER create combinations from:

- fake predictions
- fake odds
- demo fixtures
- fabricated probabilities
- unsupported markets
- random selections
- unavailable data

---

# 2. CORE PURPOSE

The feature has four objectives:

1. Find statistically strong individual selections.
2. Identify selections that are sufficiently compatible within the same match.
3. Combine them into a coherent betting combo.
4. Display the combo with the correct combined odds and prediction information.

The system should optimize for:

```text
Prediction Quality
+
Market Compatibility
+
Probability
+
Value
+
Reasonable Combined Odds
+
Low/Controlled Correlation Risk
```

Do NOT optimize solely for the highest combined odds.

---

# 3. AVAILABLE MARKET SOURCES

The combo engine should consume predictions from the existing SmartMatchPick engines.

Potential sources:

```text
1X2
Double Chance
BTTS
Over/Under Goals
Team To Score
Correct Score
Asian Handicap
Corners
Bookings
Player To Score
Player To Assist
Player Score Or Assist
First Half Markets
Second Half Markets
```

Only include a market if its prediction engine has produced a valid prediction.

---

# 4. IMPORTANT ARCHITECTURE

The Combo Engine should NOT independently predict every market again.

Instead:

```text
                    API-Football
                         ↓
                 Shared Match Data
                         ↓
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
    Prediction        Prediction      Prediction
     Engines            Engines          Engines
        ↓                ↓                ↓
       BTTS             O/U              1X2
        ↓                ↓                ↓
    Corners          Bookings        Player Props
        └────────────────┼────────────────┘
                         ↓
                COMBO ENGINE
                         ↓
            Compatibility Analysis
                         ↓
              Probability Analysis
                         ↓
                  Odds Analysis
                         ↓
                  EV / Value
                         ↓
                 Combo Selection
                         ↓
                  Popular Combos
```

The Combo Engine is an **orchestration and validation layer**, not a replacement for the individual prediction engines.

---

# 5. SAME-MATCH REQUIREMENT

A Popular Match Combo must contain selections from the **same fixture**.

Valid:

```text
Barcelona vs Racing Santander

Over 1.5
+
Barcelona Win
+
Barcelona Over 0.5
```

Invalid:

```text
Barcelona vs Racing Santander
Over 1.5

Atletico vs Osasuna
Under 3.5
```

Do not mix fixtures.

---

# 6. FIXTURE IDENTITY

Every selection must be associated with:

```text
fixture_id
league_id
season
home_team_id
away_team_id
kickoff_timestamp
```

Before constructing a combo:

```text
all_selection.fixture_id == combo.fixture_id
```

must be true.

If not:

```text
REJECT COMBO
```

---

# 7. PREDICTION FRESHNESS

Only use predictions generated for the current fixture.

Every prediction must contain:

```text
prediction_timestamp
kickoff_timestamp
model_version
data_timestamp
```

Reject stale predictions according to configurable TTL.

Example:

```text
MAX_PREDICTION_AGE = configurable
```

Odds must also have a timestamp.

---

# 8. REAL ODDS ONLY

Combined odds must be calculated from actual available bookmaker odds.

Never use:

```text
fake odds
estimated odds
placeholder odds
hard-coded odds
```

If a selection has no valid odds:

```text
selection_available = true
odds_available = false
```

It may be shown internally but should NOT be included in a price-based combo.

---

# 9. COMBO ODDS

For standard independent decimal selections:

```text
Combined Odds =
Odds_1 × Odds_2 × Odds_3
```

Example:

```text
1.30 × 1.40 × 1.50
=
2.73
```

The displayed combined odds must be calculated from the exact odds used by the combo.

Do not manually enter combined odds.

---

# 10. BOOKMAKER CONSISTENCY

Where possible, all selections in a combo should be available from the same bookmaker if the product is intended to be directly bettable.

Store:

```text
bookmaker_id
bookmaker_name
selection_odds
```

Prefer a combo where all selections are executable at the same bookmaker.

If the platform supports multi-bookmaker combinations, clearly mark them as:

```text
MULTI-BOOKMAKER
```

and do not falsely imply that the displayed combined odds are available from one bookmaker.

---

# 11. COMBO SIZE

Support configurable combo sizes:

```text
2 selections
3 selections
4 selections
```

Recommended primary display:

```text
2–3 selections
```

Avoid unnecessarily large combinations.

More legs generally introduce more failure points and stronger correlation.

---

# 12. DEFAULT COMBO SIZE

Set:

```text
MIN_COMBO_LEGS = 2
MAX_COMBO_LEGS = 3
```

Allow admin configuration.

Do not generate 5–10 leg combinations simply to increase displayed odds.

---

# 13. INDIVIDUAL SELECTION QUALITY

Before a market can enter a combo, validate:

```text
prediction_valid
odds_valid
probability_valid
data_quality
model_agreement
calibration
edge
EV
prediction_freshness
```

Potential configurable requirements:

```text
MIN_SELECTION_PROBABILITY
MIN_SELECTION_DATA_QUALITY
MIN_SELECTION_MODEL_AGREEMENT
MIN_SELECTION_EV
```

---

# 14. DO NOT USE WEAK LEGS TO INCREASE ODDS

The engine must never do:

```text
Strong Selection
+
Weak Selection
+
Weak Selection
=
High Odds Combo
```

simply because the final price looks attractive.

Every leg must independently pass its own quality requirements.

---

# 15. MARKET COMPATIBILITY

The engine must determine whether selections can logically coexist.

Examples:

### Compatible

```text
Home Win
+
Over 1.5 Goals
```

### Potentially compatible

```text
Home Win
+
BTTS Yes
```

This may occur when the home team wins 2-1, 3-1, etc.

### Contradictory

```text
Home Win
+
Away Win
```

Impossible in the same full-time match.

Reject.

---

# 16. HARD CONTRADICTIONS

Reject combinations such as:

```text
Home Win + Away Win
```

```text
Home Win + X2
```

```text
Away Win + 1X
```

```text
BTTS Yes + BTTS No
```

```text
Over 2.5 + Under 2.5
```

```text
Over 3.5 + Under 3.5
```

```text
Home Over 1.5 + Home Under 0.5
```

and equivalent contradictions.

---

# 17. SAME-MARKET CONFLICTS

Prevent incompatible selections from the same market family.

Example:

```text
Over 2.5
+
Under 2.5
```

Reject.

For nested selections, determine whether they are:

```text
compatible
redundant
contradictory
```

---

# 18. REDUNDANCY DETECTION

Avoid combos where one leg adds almost no independent information.

Example:

```text
Over 0.5 Goals
+
Over 1.5 Goals
+
Over 2.5 Goals
```

These are heavily nested.

The combo engine should penalize excessive redundancy.

Do not assume multiplying their individual probabilities is valid.

---

# 19. CORRELATION MODEL

This is one of the most important parts of the system.

Individual market probabilities cannot simply be multiplied when selections are correlated.

For example:

```text
Home Win
+
Home Over 0.5
```

are strongly related.

Likewise:

```text
Over 2.5
+
BTTS Yes
```

are positively correlated.

The engine must estimate or calibrate the **joint probability** where possible.

---

# 20. JOINT PROBABILITY

Instead of blindly calculating:

```text
P(A) × P(B)
```

calculate:

```text
P(A ∩ B)
```

when the underlying models support it.

For example:

```text
P(Home Win AND Over 1.5)
```

should preferably come from the underlying score distribution.

If:

```text
Home Win = 65%
Over 1.5 = 78%
```

do NOT automatically claim:

```text
65% × 78% = 50.7%
```

because the events are not necessarily independent.

---

# 21. SCORE-MATRIX JOINT MODEL

For goal-related markets, derive joint probabilities from the complete score matrix whenever possible.

Example:

```text
P(Home Win AND Over 1.5)
```

is the sum of all scoreline probabilities satisfying:

```text
Home Goals > Away Goals
AND
Total Goals >= 2
```

This is significantly more coherent than multiplying independent probabilities.

---

# 22. BTTS JOINT MODEL

For:

```text
BTTS Yes
+
Over 2.5
```

calculate:

```text
P(BTTS Yes AND Total Goals > 2.5)
```

from the score distribution when available.

Valid scorelines include:

```text
2-1
1-2
3-1
2-2
3-2
...
```

Do not calculate the joint probability by simply multiplying two independent model probabilities.

---

# 23. 1X2 + GOALS JOINT MODEL

For:

```text
Home Win
+
Over 1.5
```

calculate the combined event directly from the score matrix.

Likewise:

```text
Away Win
+
Under 3.5
```

can be derived by summing scorelines satisfying both conditions.

---

# 24. DOUBLE CHANCE JOINT MODEL

Examples:

```text
1X + Over 1.5
X2 + Under 3.5
12 + BTTS Yes
```

must be evaluated against the underlying score distribution.

Do not blindly multiply their probabilities.

---

# 25. CORNERS / BOOKINGS CORRELATION

For:

```text
Over 2.5 Goals
+
Over 9.5 Corners
```

or:

```text
Over 4.5 Bookings
+
Under 2.5 Goals
```

joint probability may not be directly available.

Use historical empirical correlation only if enough data exists.

If joint modeling is unavailable:

```text
correlation_uncertainty = high
```

and reduce combo confidence.

Do not invent a correlation coefficient.

---

# 26. PLAYER PROP CORRELATION

Player props can be strongly correlated with team outcomes.

Examples:

```text
Player to Score
+
Team Over 1.5
```

```text
Player Score or Assist
+
Team Win
```

```text
Player Assist
+
BTTS Yes
```

Use team goal allocation and player involvement models where available.

Do not treat them as independent events automatically.

---

# 27. SAME-TEAM PLAYER CORRELATION

Multiple player selections from the same team can be highly correlated.

Example:

```text
Player A to Score
+
Player B to Score
```

The engine must account for limited goal allocation.

If the model cannot reliably estimate the joint event:

```text
reduce confidence
```

or:

```text
reject combo
```

---

# 28. COMBO PROBABILITY

For each candidate combo calculate:

```text
joint_probability
```

preferably from a joint model.

If no joint model exists:

```text
estimated_joint_probability
```

must be clearly marked as an approximation.

Never present an independence-based approximation as an exact joint probability.

---

# 29. COMBO FAIR ODDS

Calculate:

```text
Fair Combo Odds =
1 / Joint Probability
```

where appropriate for a standard all-legs-win combo.

Example:

```text
Joint probability = 0.55

Fair odds = 1.82
```

---

# 30. COMBO EV

Calculate:

```text
EV =
Joint Probability × Combined Odds - 1
```

for a one-unit stake on a standard all-win combo.

Example:

```text
Joint probability = 0.55
Combined odds = 2.00

EV = 0.55 × 2.00 - 1
EV = +0.10
```

Therefore:

```text
+10% expected value
```

This is only valid if the joint probability is appropriately modeled.

---

# 31. COMBO EDGE

Calculate:

```text
Combo Edge =
Joint Probability
-
Market Implied Probability
```

where market implied probability is:

```text
1 / Combined Odds
```

Use vig-adjusted probabilities where the underlying market structure permits.

---

# 32. COMBO VALUE SCORE

Create:

```text
combo_value_score = 0–100
```

based on:

```text
joint probability
EV
price
data quality
model agreement
calibration
correlation confidence
robustness
```

Do not make value score simply equal to combined odds.

---

# 33. COMBO CONFIDENCE

Create:

```text
combo_confidence = 0–100
```

based on:

- individual leg quality
- joint probability confidence
- model agreement
- data quality
- odds quality
- correlation uncertainty
- lineup certainty
- prediction freshness
- robustness

---

# 34. COMBO ROBUSTNESS

Run sensitivity tests.

For example:

```text
team strength -10%
team strength baseline
team strength +10%
```

and:

```text
expected goals -10%
expected goals baseline
expected goals +10%
```

Recalculate the combo probability.

Also remove:

```text
recent form
H2H
market signal
lineup adjustment
```

where applicable.

If the combo remains valid:

```text
robustness = strong
```

If one small change destroys the edge:

```text
robustness = weak
```

---

# 35. ODDS RANGE

Allow configurable combo odds ranges.

Example:

```text
MIN_COMBO_ODDS = 1.50
MAX_COMBO_ODDS = 5.00
```

Do not automatically prefer higher odds.

The engine should find the best combination within the configured range based on:

```text
quality
probability
EV
robustness
```

---

# 36. POPULARITY MODEL

The feature is called:

> **Popular Match Combos**

Popularity should not mean:

> highest odds.

Create a popularity score using measurable platform data where available:

```text
combo_views
combo_clicks
combo_saves
combo_bets/click-throughs
user_selections
historical engagement
```

If these behavioral metrics do not exist, use:

```text
predicted_popularity
```

based on:

- familiar teams
- market familiarity
- reasonable odds
- strong prediction quality
- combo simplicity

Do not fabricate user activity.

---

# 37. POPULARITY MUST NOT OVERRIDE QUALITY

A combo with high clicks but poor prediction quality should not automatically be promoted.

Use:

```text
Quality Gate
```

before:

```text
Popularity Ranking
```

Architecture:

```text
Candidate Combos
      ↓
Quality Filter
      ↓
Value Filter
      ↓
Compatibility Filter
      ↓
Risk Filter
      ↓
Popularity Ranking
```

---

# 38. COMBO POPULARITY SCORE

Possible starting formula:

```text
Popularity Score =
35% user engagement
20% selection quality
15% combo probability
10% EV
10% simplicity
10% odds attractiveness
```

These weights should be configurable and validated.

If user engagement data does not exist, redistribute that component rather than creating fake popularity data.

---

# 39. DO NOT SHOW ONLY ONE COMBO

Generate multiple candidates per fixture.

Example:

```text
Candidate A
Over 1.5 + Home Win

Candidate B
BTTS Yes + Over 2.5

Candidate C
1X + Over 1.5
```

Then score them.

Display a configurable number.

Example:

```text
POPULAR_COMBOS_PER_FIXTURE = 1–3
```

---

# 40. COMBO DIVERSIFICATION

Avoid displaying:

```text
Combo A:
Over 1.5 + Home Win

Combo B:
Over 1.5 + Home Win + BTTS Yes

Combo C:
Over 1.5 + Home Win + Home Over 0.5
```

These are essentially variations of the same underlying idea.

Apply a similarity penalty.

---

# 41. COMBO DIVERSITY SCORE

Calculate overlap between candidate combos.

Example:

```text
Combo A:
A + B

Combo B:
A + B + C
```

High overlap.

Prefer:

```text
Combo A:
A + B

Combo B:
A + D
```

if both meet quality requirements.

---

# 42. MARKET FAMILY LIMIT

Configurable rule:

```text
MAX_SAME_MARKET_FAMILY = 1
```

Example:

Do not normally combine:

```text
Over 1.5
+
Over 2.5
```

because they are strongly nested.

Likewise avoid excessive combinations from the same underlying model.

---

# 43. COMBO LEG WEIGHT

Each leg should receive a quality score.

Example:

```text
Selection Quality =
30% probability
20% EV
15% model agreement
15% data quality
10% calibration
10% robustness
```

Then calculate overall combo quality.

---

# 44. WEAK-LINK PENALTY

A combo is only as reliable as its weakest critical component.

Calculate:

```text
minimum_leg_quality
```

and:

```text
average_leg_quality
```

Then apply a weak-link penalty.

Do not allow:

```text
95%
95%
52%
```

to be treated as a premium combo.

---

# 45. MODEL AGREEMENT

For every leg calculate:

```text
model_agreement
```

Then calculate:

```text
combo_model_agreement
```

A combo containing one highly disputed selection should receive a lower confidence score.

---

# 46. DATA QUALITY

Each leg must have:

```text
data_quality_score
```

Combo quality should account for the weakest data source.

Example:

```text
Leg A = 94
Leg B = 91
Leg C = 62
```

The combo should be penalized substantially.

---

# 47. LINEUP UPDATE

When confirmed lineups become available:

1. Recalculate affected prediction engines.
2. Recalculate affected combo probabilities.
3. Recalculate odds/EV.
4. Remove invalid combos.
5. Generate replacements if necessary.

Never keep a combo active if a key player absence invalidates one of its legs.

---

# 48. ODDS UPDATE

When bookmaker odds change:

```text
refresh odds
→ recalculate combined odds
→ recalculate fair odds comparison
→ recalculate EV
```

A combo may remain mathematically valid but lose value after an odds movement.

---

# 49. COMBO LOCK

At kickoff:

```text
combo_status = LOCKED
```

Store:

```text
final_prediction
final_odds
final_joint_probability
final_EV
timestamp
```

Do not silently modify the pre-match combo after kickoff.

---

# 50. POST-MATCH SETTLEMENT

After the fixture finishes:

Evaluate every leg individually.

Example:

```text
Leg 1: WIN
Leg 2: WIN
Leg 3: WIN

Combo:
WIN
```

If one leg fails:

```text
Leg 1: WIN
Leg 2: LOSS
Leg 3: WIN

Combo:
LOSS
```

Store actual outcomes.

---

# 51. COMBO PERFORMANCE TRACKING

Track:

```text
combo_hit_rate
ROI
yield
average_odds
average_probability
average_EV
CLV
```

Break down by:

```text
combo size
league
market combination
odds range
probability range
model version
```

---

# 52. COMBO BACKTESTING

Historical testing must reconstruct exactly what the engine would have known before kickoff.

Do not use:

- final scores
- future lineups
- future odds
- future team form
- post-match statistics

when generating historical combos.

---

# 53. WALK-FORWARD VALIDATION

Use:

```text
Training
→ Validation
→ Test
→ Roll Forward
```

Optimize combo-selection thresholds using only historical data available at the time.

Avoid overfitting to one season or league.

---

# 54. MARKET COMPATIBILITY MATRIX

Create a compatibility engine.

Example:

| Market A | Market B | Status |
|---|---|---|
| Home Win | Over 1.5 | Compatible |
| Home Win | BTTS Yes | Compatible |
| Home Win | Away Win | Reject |
| 1X | X2 | Compatible but highly overlapping |
| 1X | Away Win | Reject |
| Over 2.5 | BTTS Yes | Compatible |
| Over 2.5 | Under 2.5 | Reject |
| Home Win | 1X | Redundant/penalize |
| Over 1.5 | Over 2.5 | Strongly correlated/penalize |
| Home Over 1.5 | Home Win | Compatible |
| Home Over 1.5 | Home Under 0.5 | Reject |

The matrix should be extensible.

---

# 55. REDUNDANCY VS CORRELATION

Do not treat these as the same.

### Redundancy

One selection provides almost no additional information.

Example:

```text
1X
+
Home +0.5 Asian Handicap
```

These are effectively the same event.

Reject or strongly penalize.

### Correlation

Two different events are related.

Example:

```text
Home Win
+
Over 1.5
```

These can both happen, but are not identical.

Use joint modeling.

---

# 56. COMBO GENERATION ALGORITHM

For every eligible fixture:

### Step 1

Load all valid prediction markets.

### Step 2

Remove invalid/stale predictions.

### Step 3

Remove markets without valid odds if value is required.

### Step 4

Create candidate pairs.

### Step 5

Remove hard contradictions.

### Step 6

Remove redundant combinations.

### Step 7

Calculate joint probability.

### Step 8

Calculate combined odds.

### Step 9

Calculate fair odds.

### Step 10

Calculate edge.

### Step 11

Calculate EV.

### Step 12

Calculate correlation risk.

### Step 13

Calculate robustness.

### Step 14

Calculate combo confidence.

### Step 15

Generate 3-leg candidates from surviving pairs.

### Step 16

Repeat compatibility analysis.

### Step 17

Apply quality thresholds.

### Step 18

Apply diversity penalty.

### Step 19

Apply popularity score.

### Step 20

Select final Popular Match Combos.

---

# 57. CANDIDATE FILTER

A candidate should satisfy configurable conditions such as:

```text
MIN_LEG_PROBABILITY
MIN_COMBO_PROBABILITY
MIN_COMBO_EV
MIN_DATA_QUALITY
MIN_MODEL_AGREEMENT
MIN_ROBUSTNESS
MIN_ODDS
MAX_ODDS
MAX_CORRELATION_RISK
```

Do not hard-code these permanently.

---

# 58. NO-COMBO CONDITION

If no combination meets the requirements:

```text
NO VALID POPULAR COMBO
```

Do not manufacture one simply because the UI expects a card.

The frontend should gracefully hide the section or display:

```text
No high-quality match combos available.
```

if configured to do so.

---

# 59. DISPLAY DATA

Each Popular Match Combo card should display:

```text
Kickoff Time
Date
Home Team
Away Team
League

Selection 1
Market Type
Period

Selection 2
Market Type
Period

Selection 3
Market Type
Period

Combined Odds
```

Optional:

```text
Combo Probability
Confidence
Value
Bookmaker
```

Do not overload the card with technical model information.

---

# 60. FRONTEND STRUCTURE

Match the existing SmartMatchPick design.

Each card should contain:

```text
┌──────────────────────────────────────┐
│ 10:30 pm    Wed 16/09                │
│                                      │
│ FC Barcelona                         │
│ Racing Santander                     │
│ LaLiga                               │
│                                      │
│ • Over 3.5 Over/Under | Full Time    │
│ • 1X2 | Full Time                    │
│ • Over 1.5 Over/Under | First Half  │
│                                      │
│              1.90                    │
└──────────────────────────────────────┘
```

The combo card should remain clean and readable on:

- desktop
- tablet
- mobile

---

# 61. SELECTION DISPLAY FORMAT

Use:

```text
• [Selection] [Market Type] | [Period]
```

Examples:

```text
• Over 1.5 | Over/Under | Full Time
• Barcelona | 1X2 | Full Time
• Yes | Both Teams To Score | Full Time
• Under 3.5 | Over/Under | Full Time
• Over 4.5 | Bookings | Full Time
• Over 8.5 | Corners | Full Time
```

The UI must use the correct market name.

Do not display internal model names.

---

# 62. TEAM NAME DISPLAY

Use official API team names.

Do not abbreviate unpredictably.

If the UI has a configured short-name system, use that consistently.

Example:

```text
FC Barcelona
```

rather than randomly switching between:

```text
Barcelona
Barça
FCB
```

---

# 63. LEAGUE DISPLAY

Use the real competition name.

Example:

```text
LaLiga
Premier League
Serie A
Bundesliga
UEFA Champions League
```

Do not fabricate competition names.

---

# 64. TIME DISPLAY

Convert kickoff timestamps to the user's configured display timezone.

Store UTC internally.

Display:

```text
10:30 pm
Wed 16/09
```

or the configured local format.

Do not manipulate kickoff time manually.

---

# 65. COMBO ODDS DISPLAY

Display:

```text
1.90
```

not:

```text
Odds: 1.90
```

if matching the existing compact card design.

Use configurable decimal precision.

Recommended:

```text
2 decimal places
```

---

# 66. ODDS SOURCE

Store:

```text
bookmaker
market
selection
odds
timestamp
```

If the card is clickable, open the configured betting destination only when a valid destination exists.

Do not fabricate affiliate/bookmaker URLs.

---

# 67. POPULARITY ORDER

The frontend should receive already-ranked combos.

Backend should determine:

```text
display_rank
```

using:

```text
quality
+
value
+
probability
+
popularity
+
diversity
```

The frontend should not independently invent ranking logic.

---

# 68. DUPLICATE COMBO PREVENTION

Normalize every combo.

Example:

```text
A + B + C
```

and:

```text
C + A + B
```

must be treated as the same combo.

Create a deterministic:

```text
combo_hash
```

from:

```text
fixture_id
selection IDs
```

Reject duplicates.

---

# 69. COMBO VERSIONING

Store:

```text
combo_engine_version
prediction_engine_versions
odds_timestamp
generated_at
```

This allows historical analysis.

Example:

```text
combo_engine_version = combo-v2.1
```

---

# 70. API EFFICIENCY

The Combo Engine should make **zero unnecessary API-Football calls**.

It should consume the shared prediction dataset.

Do NOT do:

```text
BTTS API calls
+
O/U API calls
+
1X2 API calls
+
Combo API calls
```

if the Combo Engine can simply consume the already-fetched data.

Architecture:

```text
API-Football
      ↓
Shared Data Cache
      ↓
Prediction Engines
      ↓
Prediction Results Database
      ↓
Combo Engine
```

---

# 71. DATABASE STRUCTURE

Store combo candidates:

```text
combo_id
fixture_id
created_at

combo_engine_version

selection_ids

selection_count

combined_odds

joint_probability
fair_odds
edge
EV

model_agreement
data_quality
confidence

correlation_score
robustness_score
popularity_score
diversity_score

bookmaker_id

status
```

---

# 72. FINAL COMBO STATUS

Possible statuses:

```text
CANDIDATE
QUALIFIED
POPULAR
LOCKED
WON
LOST
VOID
EXPIRED
REMOVED
```

---

# 73. AUTOMATIC INVALIDATION

Automatically invalidate a combo when:

- fixture postponed
- fixture cancelled
- selection becomes unavailable
- lineup changes invalidate a prediction
- odds become invalid
- prediction expires
- market is suspended
- underlying model changes materially
- fixture starts

---

# 74. POPULAR COMBO SELECTION SCORE

Recommended starting structure:

```text
25% Joint Probability
20% EV
15% Model Agreement
10% Data Quality
10% Robustness
10% Odds Attractiveness
5% User Engagement
5% Diversity
```

These weights are starting values.

Backtest and optimize them.

Do not optimize solely for clicks.

---

# 75. RISK PENALTY

Apply penalties for:

```text
high correlation
low data quality
weakest leg
lineup uncertainty
odds instability
model disagreement
low sample size
```

Example:

```text
Final Combo Score =
Base Score
-
Correlation Penalty
-
Data Risk Penalty
-
Instability Penalty
```

---

# 76. CORRELATION RISK SCALE

Create:

```text
LOW
MEDIUM
HIGH
```

or numerical:

```text
0–100
```

Example:

```text
0–30 = Low
31–60 = Medium
61–100 = High
```

The exact thresholds must be calibrated.

High correlation does not automatically mean the combo is invalid, but it means joint modeling becomes more important.

---

# 77. COMBO EXPLANATION

Each combo should optionally have a short explanation.

Example:

```text
Strong combo based on the match's goal environment,
home performance and current prediction agreement.
```

Do not expose fabricated statistical claims.

Only mention statistics that actually exist in the prediction data.

---

# 78. NO HALLUCINATED EXPLANATIONS

If the engine does not have:

```text
Barcelona averages 2.4 goals
```

do not write:

```text
Barcelona averages 2.4 goals.
```

The explanation generator must receive structured prediction evidence.

Use:

```text
available evidence only
```

---

# 79. ADMIN CONTROLS

Create admin controls for:

```text
Enable/Disable Popular Match Combos

Minimum combo legs
Maximum combo legs

Minimum combined odds
Maximum combined odds

Minimum leg probability
Minimum joint probability

Minimum EV
Minimum data quality
Minimum model agreement

Maximum correlation risk

Maximum combos per fixture

Maximum combos displayed

Popularity weighting

Diversity weighting
```

---

# 80. ADMIN MANUAL OVERRIDE

Allow admins to:

```text
hide combo
restore combo
feature combo
remove combo
```

But manual overrides must NOT create fake odds or predictions.

Admin should only be able to select from valid prediction data.

---

# 81. PREMIUM / FREEMIUM COMPATIBILITY

If SmartMatchPick uses premium predictions:

Support:

```text
public combos
premium combos
```

The combo engine should respect the visibility status of each underlying prediction.

If one selection is premium:

```text
combo_visibility = premium
```

unless explicitly configured otherwise.

Do not leak premium prediction details through a free combo.

---

# 82. SEO

Popular Match Combos can be indexable when appropriate.

Use real fixture information:

```text
Team A vs Team B
prediction markets
league
date
```

Do not create thousands of thin pages from identical combinations.

Avoid indexable URLs for every permutation.

Prefer:

```text
one match page
```

with the relevant combo content.

---

# 83. MOBILE UX

On mobile:

- card width should fit viewport
- team names should remain readable
- selections should wrap naturally
- odds should remain prominent
- no horizontal overflow
- no tiny text
- no oversized odds box
- no clipped market labels

Example:

```text
FC Barcelona
Racing Santander

• Over 1.5 | O/U | Full Time
• 1X | Double Chance | Full Time
• Over 0.5 | Team Goals | Full Time

            1.82
```

---

# 84. DESKTOP UX

On desktop:

- cards should maintain consistent width
- cards should align in a horizontal scroll/grid
- spacing should remain consistent
- selection text should not overflow
- odds should have consistent placement
- cards should not become excessively wide

The visual style should remain consistent with the existing SmartMatchPick dashboard.

---

# 85. FINAL OUTPUT OBJECT

Return:

```json
{
  "fixture_id": 123456,
  "home_team": "FC Barcelona",
  "away_team": "Racing Santander",
  "league": "LaLiga",
  "kickoff": "2026-09-16T20:30:00Z",

  "combo": {
    "selection_count": 3,

    "selections": [
      {
        "selection": "Over 1.5",
        "market": "Over/Under",
        "period": "Full Time",
        "probability": 0.84,
        "odds": 1.25
      },
      {
        "selection": "Home Win",
        "market": "1X2",
        "period": "Full Time",
        "probability": 0.68,
        "odds": 1.45
      }
    ],

    "combined_odds": 1.81,
    "joint_probability": 0.58,
    "fair_odds": 1.72,
    "edge": 0.03,
    "ev": 0.05,

    "quality": {
      "model_agreement": 87,
      "data_quality": 92,
      "confidence": 84,
      "robustness": 81
    },

    "correlation_risk": "medium",
    "popularity_score": 76,
    "diversity_score": 88
  },

  "status": "POPULAR",
  "combo_engine_version": "combo-v1"
}
```

Numbers are structural examples only and must never be used as real prediction values.

---

# 86. FINAL DECISION HIERARCHY

The engine must prioritize:

```text
1. Real fixture
2. Real prediction data
3. Real odds
4. Prediction freshness
5. Individual selection quality
6. Market compatibility
7. Contradiction detection
8. Redundancy detection
9. Joint probability
10. Correlation
11. Model agreement
12. Calibration
13. Data quality
14. Combined odds
15. Fair odds
16. EV
17. Robustness
18. Popularity
19. Diversity
20. Final display selection
```

---

# 87. CORE PRINCIPLE

The system must NOT generate:

> "Popular Match Combos" by randomly combining the highest-probability predictions.

It must generate:

> **Statistically coherent combinations of real prediction markets for the same fixture, using validated individual predictions, joint-event probability, correlation analysis, real bookmaker odds, EV, calibration, data quality and robustness.**

The engine must understand that:

```text
Individual Probability
≠
Combo Probability
```

and:

```text
Combined Odds
≠
Combo Value
```

and:

```text
High Odds
≠
High Quality
```

The correct architecture is:

```text
REAL MATCH
     ↓
REAL DATA
     ↓
INDIVIDUAL PREDICTION ENGINES
     ↓
VALID PREDICTIONS
     ↓
COMPATIBILITY ENGINE
     ↓
CONTRADICTION FILTER
     ↓
REDUNDANCY FILTER
     ↓
JOINT PROBABILITY MODEL
     ↓
CORRELATION ANALYSIS
     ↓
REAL BOOKMAKER ODDS
     ↓
FAIR ODDS
     ↓
EV
     ↓
ROBUSTNESS
     ↓
POPULARITY / DIVERSITY
     ↓
POPULAR MATCH COMBOS
```

If no combination passes the required quality and value thresholds:

```text
NO VALID COMBO
```

Do not manufacture a combo merely to populate the UI.