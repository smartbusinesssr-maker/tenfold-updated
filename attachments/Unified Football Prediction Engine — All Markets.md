# UNIFIED FOOTBALL PREDICTION ENGINE
## Production-Grade Multi-Market Probability, Value & Best-Bet Selection System

> One engine. All markets. One objective:
> **For every fixture, calculate a fully calibrated probability distribution across every supported market, then identify the single most accurate, best-supported prediction in EACH market — and the single best bet overall.**

This document merges and supersedes the eleven individual market engines:

1. Match-Win (1X2) Engine
2. Double Chance Engine
3. Draw Engine
4. Correct Score Engine
5. Over/Under Goals Engine
6. BTTS Team-Scoring Engine
7. Team To Score ≥1 Goal Engine
8. Asian & European Handicap Engine
9. Corners Engine
10. Total Bookings Engine
11. Player To Score Or Assist Engine

All eleven are now **modules** of a single architecture, sharing one data layer, one mathematical core, one calibration system, and one best-bet selection engine.

---

# PART I — FOUNDATIONS

---

# 1. OBJECTIVE

Analyze an upcoming football fixture and produce:

1. A complete, calibrated probability distribution for **every supported market**.
2. The **best (most accurate + best value) prediction within each market**.
3. A ranked shortlist of all candidate selections across all markets.
4. One **BEST BET OVERALL** — or `NO BET` if nothing qualifies.

The engine must NEVER simply output the most likely outcome. It must:

- Estimate `P(event)` for every outcome of every market.
- Compare model probabilities against market-implied probabilities (margin removed).
- Compute Expected Value for every candidate selection.
- Grade data quality and model agreement.
- Select the market + selection combination with the strongest combined evidence.

---

# 2. SUPPORTED MARKETS

### 2.1 Match Result (1X2)
- `P(Home Win)`, `P(Draw)`, `P(Away Win)` — must sum to 100% (±tolerance).

### 2.2 Double Chance
- `P(1X) = P(H) + P(D) = 1 − P(A)`
- `P(X2) = P(D) + P(A) = 1 − P(H)`
- `P(12) = P(H) + P(A) = 1 − P(D)`

### 2.3 Draw (dedicated deep module)
- Elevated-draw detection, draw value, draw-risk quantification.

### 2.4 Correct Score
- Full scoreline probability matrix (minimum 0-0 through 4-4 both directions), top-5 ranked scorelines, scoreline clusters, entropy.

### 2.5 Over/Under Total Goals
- Lines 0.5, 1.5, 2.5, 3.5, 4.5 (and any additional available lines), Over AND Under evaluated symmetrically; Asian totals (quarter lines, e.g. 2.25/2.75) where available.

### 2.6 BTTS (Both Teams To Score)
- `P(BTTS Yes)`, `P(BTTS No)` — never equated with Team Over 0.5.

### 2.7 Team To Score ≥1 (Team Over 0.5 Goals)
- `P(Home scores ≥1) = 1 − P(Home = 0)`, `P(Away scores ≥1) = 1 − P(Away = 0)` — modeled per team, never confused with Match Over 0.5 / BTTS / Team Over 1.5.

### 2.8 Asian & European Handicap
- Whole, half and quarter lines: Home/Away ±0.25, ±0.5, ±0.75, ±1.0, ±1.25, ±1.5, ±1.75, ±2.0 and beyond.
- Outputs per line: `P(Full Win)`, `P(Half Win)`, `P(Push)`, `P(Half Loss)`, `P(Full Loss)`, expected payout, fair odds.

### 2.9 Corners
- Match total corners O/U (5.5 → 14.5+), home/away team corners, corner handicaps, corner winner (H/D/A), first-half / second-half corners, Asian corner totals.

### 2.10 Total Bookings
- Total bookings O/U (2.5 → 6.5+ and Asian lines 4.25/4.75/5.25/5.75), home/away bookings, booking handicap, booking winner, 1H/2H bookings, yellow/red split.

### 2.11 Player To Score Or Assist (Player Props)
- `P(G) = P(player scores ≥1)`, `P(A) = P(player assists ≥1)`,
- `P(G ∪ A) = P(G) + P(A) − P(G ∩ A)` — the overlap term is mandatory; never sum raw.

---

# 3. ABSOLUTE DATA INTEGRITY RULES (GLOBAL — APPLY TO EVERY MODULE)

**NEVER:**

- Fabricate statistics, ratings, odds, injuries, lineups, H2H results, xG, xGA, xA, referee data, or corner/card data.
- Treat missing data as zero. **Missing ≠ 0.**
- Use demo/sample fixtures.
- Use stale fixture data when current data is available.
- Present assumptions or model estimates as API data.
- Force a prediction when evidence is weak.
- Automatically select the favorite because it has shorter odds.
- Use league position, "won last 5", or short odds as a standalone decision rule.
- Invent xG/xGA/xA: if reliable underlying data does not exist, DO NOT estimate them — use verified goals/shots/chances instead. Specifically, NEVER use xGA where the data source does not provide it; fall back to actual conceded goals and shots-conceded data.
- Apply hard-coded assumptions (e.g. "derby = more cards", "big team = covers handicap") without supporting data.

**If data is unavailable:** `DATA NOT AVAILABLE`
**If data is insufficient:** `INSUFFICIENT DATA`
**If sources conflict:** `DATA CONFLICT`

**The engine must always prefer `NO BET` over an unsupported prediction.**

**Primary data source:** API-Football (fixtures, standings, team statistics, player statistics, lineups, injuries, H2H, events, odds). Supplementary verified sources permitted only for markets API-Football does not cover; label every non-API value with its source.

---

# 4. FIXTURE VALIDATION (RUN ONCE, BEFORE ANY MODULE)

Verify:

- Fixture ID, Home team ID, Away team ID
- Competition, Season, Match date, Match status
- Home/away designation, league, team identities

**Reject the fixture if:**

- Already played / cancelled / invalid team IDs / conflicting fixture info / duplicate / unconfirmed postponement / wrong competition or season.

Never analyze an incorrectly identified fixture. On rejection: output `FIXTURE INVALID — NO ANALYSIS`.

---

# 5. SHARED DATA LAYER (FETCH ONCE — FEED ALL MODULES)

Every module reads from this single validated dataset. No module fetches independently.

### 5.1 Team performance (both teams)
- Season: played, W/D/L, win/draw/loss %, GF, GA, GD, points/match, clean sheets, failed-to-score.
- **Home-only split (home team) and away-only split (away team) — MANDATORY.** Venue-specific performance outweighs overall record.
- Last 5 / Last 10: W/D/L, points/match, GF, GA, GD, clean sheets, failed-to-score.

### 5.2 Advanced statistics (only where actually available)
- Shots, shots on target, big chances, big chances missed, goals per shot, possession.
- xG (never estimated if absent), xGA (restricted — see §3), corners for/against, cards for/against, fouls.

### 5.3 Contextual
- League table (position, points, GD — supporting evidence only, never dominant).
- Rest & congestion: days since last match, matches in previous 7/14 days, travel, upcoming fixture, rotation risk.
- Match context: title/promotion/relegation races, knockout/leg structure, must-win, derby/rivalry (only with historical evidence).
- Lineups, injuries, suspensions (never invented; weighted by player importance — a reserve absence ≠ first-choice GK or primary striker absence).
- H2H: recent results, venue-specific H2H, H2H goals/corners/cards where available. **Low-to-moderate weight; never overrides current-season evidence.** If insufficient: `H2H = NOT ENOUGH DATA`.
- Tactical data only where reliable: pressing, possession, block height, transitions, set-piece strength. If unavailable: `TACTICAL SIGNAL = NOT AVAILABLE`.
- Referee (bookings module): identity, cards/game, home/away card bias, consistency.
- Player-level data (props module): minutes, starts, goals, assists, shots, chances created, xG/xA where real, penalties/free-kick duties, expected minutes, starter probability.

---

# PART II — THE MATHEMATICAL CORE (SHARED BY ALL MODULES)

Every module draws its probabilities from this common core. No module maintains its own independent probability model.

---

# 6. GOAL EXPECTANCY ENGINE

Estimate:

```text
λ_home   (expected home goals)
λ_away   (expected away goals)
```

Inputs (weighted, using only available verified data):

- Home attack strength vs away defensive strength
- Away attack strength vs home defensive strength
- League scoring baseline
- Home advantage (team/league-specific — never a generic fixed bonus)
- Opponent-adjusted recent form
- Squad/lineup adjustments
- xG layer where genuinely available

Formulas (baseline; blend components, do not hard-code):

```text
λ_home = LeagueAvgHomeGoals × HomeAttackStrength × AwayDefensiveWeakness × HomeAdvantageFactor × FormFactor × LineupFactor
λ_away = LeagueAvgAwayGoals × AwayAttackStrength × HomeDefensiveWeakness × FormFactor × LineupFactor
```

Shrink small samples toward the league mean:

```text
AdjustedRate = (ObservedRate × n + LeagueRate × k) / (n + k)     (k = shrinkage constant)
```

---

# 7. POISSON SCORE MATRIX

For home goals `i` and away goals `j`:

```text
P(i goals) = (λ^i × e^−λ) / i!
P(i, j)    = P_home(i) × P_away(j)          [independence baseline]
```

Build the full matrix at minimum for 0–0 through 4–4 (extend to capture ≥99% of probability mass).

From the matrix derive (this is the **single source of truth** for all match-outcome markets):

```text
P(Home Win) = Σ P(i,j) for i > j
P(Draw)     = Σ P(i,j) for i = j
P(Away Win) = Σ P(i,j) for i < j
```

Normalize to 100%. All module outputs must remain consistent with this matrix (see Part IV — Consistency Engine).

---

# 8. DIXON-COLES LOW-SCORE CORRECTION

Apply the Dixon-Coles adjustment to low-scoring cells (0-0, 1-0, 0-1, 1-1):

```text
P_DC(0,0) = P(0,0) × (1 − λ_home·λ_away·ρ)
P_DC(1,0) = P(1,0) × (1 + λ_away·ρ)
P_DC(0,1) = P(0,1) × (1 + λ_home·ρ)
P_DC(1,1) = P(1,1) × (1 − ρ)
```

Estimate ρ from historical league data; if insufficient data, set ρ = 0 and document it. Renormalize the matrix after correction. Dixon-Coles typically raises draw probability in low-expectancy matches — this directly feeds the Draw, Double Chance, Correct Score and Handicap modules.

---

# 9. OVERDISPERSION, ZERO-INFLATION & BIVARIATE CHECKS

For goals, corners, and cards distributions:

1. Compute `variance / mean` on historical samples.
2. If `variance > mean` materially, Poisson underestimates tails → apply **Negative Binomial** where out-of-sample validation (log loss, Brier score, calibration error) shows improvement.
3. Test for **zero-inflation** (excess 0 counts, e.g. 0-0 matches, 0-card matches) → apply zero-inflated model only if validated.
4. Where home/away counts are correlated (corners especially), use a **bivariate Poisson** or documented correlation adjustment.
5. Apply **time-decay weighting** to historical observations (recent matches weigh more); document the decay function.

Never silently swap distributions — report which distribution was used and why.

---

# 10. GOAL-DIFFERENCE DISTRIBUTION (HANDICAP CORE)

From the corrected score matrix, derive the full goal-difference distribution:

```text
P(D = d) = Σ P_home(i) × P_away(j)  for all (i,j) with i − j = d
```

for d = −6 … +6 (extend as needed). Compute:

- Expected goal difference, median goal difference, modal goal difference
- This distribution drives **all handicap lines** (Part III, Module 8).

---

# 11. MARKET ODDS, IMPLIED PROBABILITY, FAIR ODDS & EV (SHARED VALUE LAYER)

For every market where reliable odds exist:

```text
Raw Implied Probability = 1 / Decimal Odds
Overround = Σ Raw Implied − 1
Market Probability = Raw Implied / Σ Raw Implied        [margin removed]

Fair Odds = 1 / Model Probability
Edge = Model Probability − Market Probability
EV = (Model Probability × Decimal Odds) − 1
```

For Asian lines with push/half outcomes, compute **expected payout** explicitly:

```text
Expected Return =
  P(full win) × (odds − 1)
+ P(half win) × (odds − 1) / 2
+ P(push) × 0
+ P(half loss) × (−0.5)
+ P(full loss) × (−1)
```

Rules:

- A selection is a **value bet** only when model probability is meaningfully above market probability, EV > 0, data quality is acceptable, no major unresolved lineup issue exists, and models are not strongly conflicting.
- **Never chase the highest odds** (e.g. Home −2.0 over Home −1.0) without the probability structure justifying it.
- Use **line shopping** (best available price across books) where multiple books are available.
- Track **line movement** where data exists; material movement against the model reduces confidence.
- Double-chance prices carry heavy margin — always compute whether the raw price adequately compensates (the **double-chance price problem**: 1X/X2 odds are often so short that even high true probability yields negative EV).

---

# PART III — MARKET MODULES

Each module below consumes the Shared Data Layer (§5) and the Mathematical Core (§6–§11), then adds its market-specific signals. Every module must return: a probability distribution, a best selection within its market, a confidence classification, and `NO BET` where criteria fail.

---

# MODULE 1 — MATCH RESULT (1X2)

**Objective:** the most accurately calibrated `P(H) / P(D) / P(A)` distribution — not "the team that looks strongest."

### Component signals (sub-models)
1. Home/away performance (venue splits — mandatory, venue-weighted)
2. Recent form (last 5 / last 10)
3. **Opponent-adjusted form** — never rate raw W/D/L without opponent quality: `W W W W W` vs weak sides ≠ `W W D W L` vs elite sides. Produce `OPPONENT-ADJUSTED FORM RATING`.
4. Team strength / Elo (`MODEL TEAM STRENGTH RATING` — label self-built ratings as such; updated after every match; includes opponent strength, venue, margin, recency)
5. Attack rating (goals/match, scoring %, failed-to-score %, shots, SOT, big chances, conversion; xG only if real)
6. Defensive rating (conceded/match, clean sheets, shots conceded; never estimate xGA)
7. Goal expectancy / Poisson matrix (§6–§8)
8. Home advantage adjustment (team/league-specific, never generic)
9. Squad/lineup adjustment (importance-weighted; `NEUTRAL` if unknown)
10. Rest/schedule
11. H2H (low weight)
12. Tactical matchup (only if reliable)
13. Market validation
14. **Draw-risk model** (mandatory): similar strength, high draw frequency, low-goal environment, frequent 1-1/0-0/2-2, low rating separation → `DRAW RISK SCORE 0–100`; high draw risk reduces straight-win confidence.
15. **Upset-risk model** (mandatory for the favorite): poor form, missing key players, high opponent scoring probability, market/model disagreement, congestion → `UPSET RISK SCORE 0–100`.
16. Performance vs strong opponents (record inflation check) and performance quality per recent match (`DOMINANT / CONVINCING / NARROW / FORTUITOUS` — only with supporting data).

### Starting ensemble weights (calibrate out-of-sample)
20% Elo/strength · 15% home/away performance · 15% opponent-adjusted form · 10% attack · 10% defense · 10% goal expectancy/Poisson · 5% home advantage · 5% lineup · 3% vs-strong-opponents · 2% rest · 2% H2H · 1% tactical · 2% market.

### Straight-win filter
A straight win qualifies only when: win probability high, opponent-adjusted strength/home-away/form/goal-expectancy/defense all support it, lineup acceptable, draw risk not excessive, upset risk acceptable, data quality sufficient, multiple independent models agree. Otherwise `NO BET`.

### Win-strength tiers
80%+ ELITE · 75–79% VERY STRONG · 70–74% STRONG · 65–69% MODERATE · 60–64% WEAK · <60% PASS (validate thresholds against historical calibration; 80% ≠ guaranteed).

---

# MODULE 2 — DOUBLE CHANCE (1X / X2 / 12)

**Objective:** select the double chance only when the market price properly compensates — never default to the largest raw probability.

Derive strictly from the calibrated 1X2 core (§7):

```text
P(1X) = P(H) + P(D) = 1 − P(A)
P(X2) = P(D) + P(A) = 1 − P(H)
P(12) = P(H) + P(A) = 1 − P(D)
```

### Requirements
- **Coverage & risk ranking** per option: what single outcome kills the ticket, and its probability.
- **Price problem check:** compute fair odds for each double chance; if the offered price is too short relative to model probability → flag `NEGATIVE EV DESPITE HIGH PROBABILITY`.
- Consistency checks: Draw No Bet, Asian Handicap 0 / ±0.5, correct-score clusters and goals markets must not contradict the chosen double chance.
- Draw-specific model input (Module 3) determines whether 1X/X2 (draw-protected) beats 12.
- Sensitivity/robustness test: perturb λ ±10% and recompute; unstable selections are downgraded.

### Strength tiers
90%+ ELITE COVERAGE · 80–89% STRONG · 70–79% MODERATE · 65–69% MARGINAL · <65% NO BET. **Value tiers** separate high-probability/low-value (acceptable for accas, flag it) from high-probability/positive-value (preferred).

---

# MODULE 3 — DRAW (DEDICATED DEEP MODULE)

**Objective:** identify fixtures where draw probability is **genuinely elevated and/or positive value** — never select a draw merely because teams look evenly matched.

### Required evidence stack (15 pillars)
1. Team strength parity (Elo separation)
2. Home/away performance balance
3. Goal-scoring distributions
4. Defensive performance
5. Recent form
6. Opponent-adjusted form
7. **Draw-frequency model:** team draw rates (with small-sample shrinkage toward league draw baseline) + league draw rate
8. **Low-scoring probability:** goal environment, joint low expectancy
9. Scoreline distribution: 0-0 / 1-1 / 2-2 concentration (`DRAW SCORE CONCENTRATION`)
10. Tactical/game-state: draw preservation behavior, low-tempo matchups, both-teams-content states
11. Squad availability (missing strikers ↑ draw; missing defenders ↓ draw)
12. Match context (a point suits both, first-leg caution — modifiers, never standalone reasons)
13. Market pricing (draw odds often carry value because recreational money avoids draws)
14. Model agreement across the draw sub-models
15. Calibration (league-specific draw baselines; temporal weighting)

### Models
- Dixon-Coles draw cell (§8) — mandatory
- Balance model: `BalanceScore = f(|strength gap|, |attack gap|, |defense gap|)` — but balance alone NEVER suffices
- Clean-sheet / failed-to-score interaction: 0-0 support vs 1-1 support (do NOT double count with BTTS)
- Performance when favored vs when underdog (draw frequency in each role)
- Fair draw odds `= 1 / P(Draw)`, draw EV, draw value model

### Draw tiers
32%+ ELITE DRAW · 29–31% STRONG · 26–28% ELEVATED · 23–25% NORMAL · <23% LOW. **Betting threshold:** only bet the draw when tier is elevated AND market probability < model probability by a meaningful margin AND data quality ≥ Good. Otherwise `NO BET` — the draw module defaults to NO BET more often than any other module.

---

# MODULE 4 — CORRECT SCORE

**Objective:** full scoreline probability matrix + ranked Top-5 — never one guessed score.

### Pipeline
1. λ_home / λ_away from §6 (league goal environment normalized)
2. Poisson matrix (§7) → Dixon-Coles correction (§8) → overdispersion/bivariate checks (§9)
3. Negative-binomial alternative where validated
4. Time-decay weighting of inputs
5. Lineup effects: missing primary striker ↓ λ, missing GK ↑ opponent λ, multiple defensive absences ↑ opponent λ (importance-weighted, data-driven)
6. Goalkeeper effect (shot-stopping evidence only)
7. Goal-timing data where available

### Derived metrics
- **Top-5 scorelines** with probabilities and fair odds
- **Scoreline clustering:** home-controlled cluster (1-0/2-0/2-1), away-controlled cluster, draw cluster (0-0/1-1/2-2) — cluster totals feed Modules 1–3
- **Concentration:** top-score probability, top-3 cumulative
- **Entropy / uncertainty:** high entropy = wide distribution = low confidence
- **Top-score margin:** gap between rank-1 and rank-2 scoreline; small margin → no bet
- Exact-score consistency rule: the chosen primary score must be consistent with the 1X2 lean and the O/U lean (§Part IV)

### Classification
ELITE / STRONG / MODERATE / WEAK / NO BET based on concentration + margin + data quality + market value. Correct-score bets require positive EV and acceptable entropy; otherwise output the matrix for information only.

---

# MODULE 5 — OVER/UNDER TOTAL GOALS

**Objective:** `P(Total > Line)` and `P(Total < Line)` for every available line, from multiple complementary signals.

### Lines
0.5, 1.5, 2.5, 3.5, 4.5 (minimum); Asian totals (2.25, 2.75, 3.25 …) with quarter-line stake splitting where offered; evaluate Over AND Under symmetrically — always look for the **strongest Under** as actively as the strongest Over.

### Signals
- Total-goals distribution: `P(Total = k) = Σ_j P(k−j, j)` from the corrected matrix
- League goal environment & tempo
- Both teams' scoring + conceding rates (venue-split)
- Recent goal-form, scoring momentum
- Clean-sheet / failed-to-score profiles
- Lineup/attacker availability
- Referee/pace/context modifiers (evidence-based only)

### Outputs
- Most likely total-goal range (0–1, 2–3, 4–5, 6+)
- Strongest Over opportunity, strongest Under opportunity (each with line, probability, fair odds, market odds, EV)
- `NO BET` when the distribution is flat across the main line or market fully prices it.

---

# MODULE 6 — BTTS (BOTH TEAMS TO SCORE)

**Objective:** identify fixtures where **both** teams have strong statistical evidence to score ≥1.

### Core

```text
P(BTTS Yes) = P(Home ≥ 1 AND Away ≥ 1)
```

Baseline (independence): `P(H≥1) × P(A≥1)`; apply correlation/Dixon-Coles-aware adjustment from the matrix where it materially changes the result. Never equate BTTS with Team Over 0.5 or Match Over 1.5.

### Evidence requirements (ALL four)
1. Selected side scoring probability high (attack rating, venue scoring rate, scoring momentum, shot/chance quality)
2. Opponent scoring probability sufficiently high (same stack)
3. Combined BTTS probability strong
4. Market does not contradict (where reliable odds exist)
5. Data quality sufficient

### Anti-patterns
- No BTTS call when one side has strong failed-to-score profile or the opponent has elite clean-sheet profile.
- Goal-timing: teams whose goals cluster late/early inform live-BTTS notes but the locked prediction is pre-match only.
- Classification tiers on BTTS probability with a **BTTS candidate filter**; risk detection must actively search for the 1-0/0-0 failure mode.

---

# MODULE 7 — TEAM TO SCORE ≥1 GOAL (TEAM OVER 0.5)

**Objective (per team):**

```text
P(Team Scores ≥ 1) = 1 − P(Team = 0) = 1 − e^(−λ_team)   [Poisson baseline]
```

Computed **separately for home and away**; never confused with Match Over 0.5, BTTS, Team Over 1.5, or match winner.

### Signals
- Scoring frequency & failed-to-score analysis (season / last 5 / last 10 / venue)
- Opponent concede rate, opponent defensive momentum, opponent clean-sheet profile
- Shots, SOT, big chances, goal conversion
- xG layer only if real; expected-team-goals blending (attack vs opponent defense vs league baseline vs context)
- Negative-binomial / zero-inflation checks on team goal counts
- Goalkeeper matchup, defensive absences, matchup score
- **Odds floor:** Team Over 0.5 prices are typically extremely short — compute fair odds and apply an odds-floor/value test; flag selections that are probable but unbettable at market price.
- Team Over 0.5 vs Team Over 1.5 must be priced from the same team-goal distribution, reported separately.

---

# MODULE 8 — ASIAN & EUROPEAN HANDICAP

**Objective:** from the goal-difference distribution (§10), price every handicap line with exact settlement logic.

### 8.1 Lines
Home/Away: 0, ±0.25, ±0.5, ±0.75, ±1.0, ±1.25, ±1.5, ±1.75, ±2.0 and beyond; European handicap (3-way with push treated as a separate outcome) where offered.

### 8.2 Exact settlement (derive from the score matrix — never textual assumptions)

**Home −0.5:** win = `H > A`; loss = `H ≤ A`.

**Home −1.0:** win = home by 2+; **push** = home by exactly 1; loss = draw or away win.

**Home −1.5:** win = home by 2+; otherwise loss.

**Quarter lines — generic split engine (mandatory, do not hard-code):**

```text
H = n + 0.25  →  50% stake on n      + 50% stake on n + 0.5
H = n + 0.75  →  50% stake on n + 0.5 + 50% stake on n + 1.0
```

- **Home −0.25:** home win → full win; draw → half loss (0 = push, −0.5 = loss); away win → full loss.
- **Home −0.75:** home by 2+ → full win; home by exactly 1 → **half win** (−0.5 wins, −1.0 pushes); draw/away → full loss.
- **Home −1.25:** home by 2+ → full win; home by exactly 1 → **half loss**; draw/away → full loss.
- Works identically for positive lines (mirror logic).

### 8.3 Required outputs per line

```text
P(Full Win) · P(Half Win) · P(Push) · P(Half Loss) · P(Full Loss)
Expected Payout (§11 formula) · Fair Odds · Market Odds · Edge · EV
```

Push probability is a first-class feature: a line with high push probability (e.g. −1.0 in a narrow-win profile) has a fundamentally different risk profile from the neighboring −0.75/−1.25.

### 8.4 Handicap-specific signals
- Handicap cover rate (historical ATS performance, venue-split, with shrinkage)
- Goal-margin form (winning/losing margins, not just results)
- Performance vs strong teams (blowout resistance)
- Handicap stability (does the probability survive λ ±10% perturbation)
- Handicap clusters: report the range of lines the same underlying distribution supports (e.g. "distribution supports Home −0.5 comfortably, −1.0 marginal, −1.5 rejected")
- 1X2 and correct-score consistency (Part IV)
- **Never chase higher odds** from a deeper line without the goal-difference mass to justify it.

---

# MODULE 9 — CORNERS

**Objective:** a complete probability distribution of corner counts — not a point estimate.

### 9.1 Markets
- Match total corners O/U: 5.5 through 14.5 (and Asian corner totals with quarter-line splitting)
- Home team corners O/U + home corner distribution
- Away team corners O/U + away corner distribution
- Corner handicap: Home −0.5 → −3.0+ and mirrored away lines (same settlement engine as Module 8, applied to corner difference)
- Corner winner: `P(Home corners > Away)`, `P(=)`, `P(<)`
- First-half corners, second-half corners

### 9.2 Core corner data (both teams)
Corners for/against per match (season, last 5, last 10), total match corners, full corner-count distribution, home/away corner splits (mandatory), corner attacking strength, corner defensive vulnerability (corners conceded), opponent-adjusted corner performance.

### 9.3 Expectation model

```text
λ_home_corners   = f(home corner attack, away corner concession, venue split, tempo, style)
λ_away_corners   = f(away corner attack, home corner concession, venue split, tempo, style)
λ_total_corners  = λ_home_corners + λ_away_corners
```

Style/tempo inputs (only where data exists): shots and blocked shots (blocked shots → corners), crossing profile, possession interaction (low-possession counter teams often win corner counts despite losing possession), shot volume interaction, game-state model (trailing teams generate late corner surges), corner tempo (corners per minute/attack).

### 9.4 Distribution model
- Poisson baseline per team; **overdispersion check mandatory** (corner variance typically exceeds mean → Negative Binomial where validated)
- Zero-inflation check
- **Bivariate/correlation model** for home+away joint distribution (corners correlate via game state and tempo — independence underestimates extreme totals)
- Corner volatility, median corners, distribution shape (skew), corner entropy
- Line stability & sensitivity analysis (λ ±10%)

### 9.5 Outputs
- Total-corner line probabilities for every listed line; most likely corner range; top total-corner outcomes
- Team corner distributions and line probabilities
- Corner handicap table with P(win/push/loss) per line
- Corner winner probabilities (must sum to 100%)
- Fair odds, market comparison, EV, line shopping, line movement, model/market disagreement flags
- H2H corner analysis (limited weight)

---

# MODULE 10 — TOTAL BOOKINGS

**Objective:** probability distribution of total disciplinary bookings; primary market Total Bookings Over/Under (incl. Asian lines 4.25/4.75/5.25/5.75), plus team bookings, booking handicap, booking winner, 1H/2H bookings, yellow/red split, exact booking ranges.

### 10.1 Booking data
Season + recent (last 5/10) cards for/against, home/away disciplinary splits, team aggression indicators (fouls), discipline indicators, card volatility. **Missing card data ≠ 0 cards.**

### 10.2 The four environment layers
1. **Foul environment:** fouls per match (both teams), foul → card conversion rate per team and league.
2. **Referee model (mandatory where available):** referee identity, cards/game average, home/away card bias, consistency/variance. Referee tendency is a first-order driver — a strict referee materially raises λ_total_cards. If referee unknown: use league average and flag `REFEREE NOT CONFIRMED` (reduces data quality).
3. **League card environment:** league baseline cards/game, league normalization (a 4-card match is high in some leagues, low in others).
4. **Match intensity model:** standings pressure, rivalry/derby (only with historical disciplinary evidence — never hard-coded), knockout/final context, expected game state (chasing team fouls more).

### 10.3 Expectation model

```text
λ_home_cards = f(home card rate, away card pressure, home foul rate, referee home tendency, league baseline, recent card form, lineup discipline, intensity, context)
λ_away_cards = f(symmetric inputs)
λ_total_cards = λ_home_cards + λ_away_cards
```

Player disciplinary risk (where data exists): likely starters' cards per 90 and fouls per 90, adjusted for expected minutes. Do not infer card tendencies without actual player disciplinary data.

### 10.4 Distribution & outputs
- Poisson baseline; **overdispersion test mandatory** (cards are typically overdispersed — game-state clustering); Negative Binomial where validated
- Full distribution P(Total Cards = 0 … ≥N)
- Line probabilities incl. Asian booking lines (quarter-split engine, §Module 8 logic)
- 1H/2H split from historical timing data (never assume even split); card-timing bands 0–15 … 76–90+ where minute data exists
- Booking handicap and booking winner from the card-difference distribution
- Fair odds, market comparison, EV, sensitivity analysis

---

# MODULE 11 — PLAYER TO SCORE OR ASSIST (PROPS)

**Objective:** per selected player:

```text
P(G)      = P(player scores ≥ 1)
P(A)      = P(player assists ≥ 1)
P(G ∪ A)  = P(G) + P(A) − P(G ∩ A)     ← the overlap term is MANDATORY
```

Never output `P(G) + P(A)` as the combined probability — a player can score AND assist in the same match. Model the joint event explicitly.

### 11.1 Eligibility & availability (gate checks)
- Squad membership, injury/suspension status (verified only)
- **Starter probability** and **expected minutes** — a player averaging 25 minutes cannot be priced on per-match totals. All player rates are per-90, then scaled by expected minutes.
- Confirmed lineup priority: once lineups are confirmed, starter probability becomes binary and the model re-runs.
- Substitution risk, rotation risk, new-manager bounce only with evidence.

### 11.2 Goal model

```text
λ_player_goals = f(per-90 goal rate, shots/90, SOT/90, big chances, xG/90 if REAL, player goal share of team goals,
                   team λ for this match, opponent defensive weakness, position/role, penalty & free-kick duties,
                   home/away player splits, recent form & minutes form, expected minutes)
P(G) = 1 − e^(−λ_player_goals)
```

Penalty-taking duty is a material adjustment — identify the designated taker from data. Set-piece responsibility feeds both goal and assist rates.

### 11.3 Assist model

```text
λ_player_assists = f(per-90 assist rate, chances created/90, xA/90 if REAL, chance-creation share,
                     team λ, teammates' conversion quality, set-piece delivery duty, role, expected minutes)
P(A) = 1 − e^(−λ_player_assists)
```

### 11.4 Overlap & team dependency
- `P(G ∩ A)` estimated from historical joint frequency of the player's goal+assist games (per-minute adjusted), or a documented copula/correlation assumption if sample is thin — never assumed zero, never assumed independent without justification.
- Team goal dependency: player props scale with team λ; if the team's scoring expectation falls (e.g. elite opponent), the player's P(G) and P(A) both fall.
- Opponent player-specific matchup (e.g. weak fullback vs winger) only where data supports it.
- Player vs opponent history: low weight; never let old H2H dominate current form.

### 11.5 Value layer
Anytime scorer / assist / score-or-assist odds → implied probability → fair odds → EV → market edge → price sensitivity (flag selections whose edge evaporates within normal price movement).

---

# PART IV — CROSS-MARKET CONSISTENCY ENGINE (MANDATORY)

All modules read from one corrected score matrix. Before any output, run these consistency checks:

1. **1X2 ↔ Double Chance:** P(1X)+P(X2)−P(12) must equal 2·P(D)... verify the three identities hold exactly.
2. **1X2 ↔ Correct Score:** the strongest scoreline cluster must align with the 1X2 lean. Dominant 2-0/1-0/2-1 supports home win; dominant 1-1/0-0/2-2 signals draw risk. Correct score validates, never overrides.
3. **1X2 ↔ Handicap:** a Home −1.5 recommendation requires a home-win cluster with multi-goal mass; if the modal margin is 1, −1.0 push-risk must be priced, and −1.5 is likely rejected.
4. **BTTS ↔ Team-to-Score:** P(BTTS) ≤ min(P(H≥1), P(A≥1)). BTTS Yes cannot be recommended if either team's P(≥1) is weak.
5. **BTTS ↔ Correct Score:** BTTS Yes is inconsistent with 0-x / x-0 scoreline dominance.
6. **O/U ↔ Correct Score:** Over 2.5 recommendation requires the matrix mass above 2.5 goals to match; the modal scoreline should sit in the corresponding range.
7. **Draw ↔ Low-scoring:** elevated draw probability should coincide with elevated 0-0/1-1 mass; a draw call in a high-λ match needs explicit justification.
8. **Corners/cards ↔ match model:** corner winner and booking winner should not contradict the strength model without an explicit style/referee explanation.
9. **Player props ↔ team model:** a strong score-or-assist pick on a player whose team has low λ requires explicit justification (penalty duty, set-piece monopoly, etc.).
10. **Draw No Bet ↔ Asian Handicap 0** equivalence and market-consistency checks across books.

Any unresolved contradiction → downgrade confidence; material contradiction → `NO BET` for the affected markets.

---

# PART V — BEST-BET SELECTION ENGINE (THE UNIFYING LAYER)

This is the core of the unified engine: after all modules run, select the best prediction in each market and the best bet overall.

## V.1 Per-market best selection

Within each market, the best selection is the candidate maximizing **Accuracy-Adjusted Value Score**:

```text
AAVS = (Model Probability) × (1 + Edge) × (Model Agreement / 100) × (Data Quality / 100) × (Robustness / 100)
```

subject to hard gates:

- Data Quality ≥ 60 (below → market outputs `INSUFFICIENT DATA — NO BET`)
- Model Agreement ≥ 55 (below → NO BET for that market)
- EV > 0 when odds are available (when odds unavailable, probability and agreement alone decide, flagged `PRICE UNVERIFIED`)
- Robustness: selection survives λ ±10% sensitivity test
- No unresolved critical lineup/availability conflict

## V.2 Cross-market ranking

Rank every market's best selection into a fixture-level shortlist using:

1. Model probability (accuracy first — this engine prioritizes being right over being bold)
2. Edge over market
3. Model agreement
4. Data quality
5. Price adequacy (reject probable-but-unbettable selections — see odds-floor logic)

## V.3 Best Bet Overall

```text
BEST BET = highest AAVS selection passing ALL gates
```

If two selections are within 5% AAVS, prefer the one with higher model probability (accuracy priority). Output one BEST BET, up to two ALTERNATES, and list every market that returned NO BET with its reason.

## V.4 Global NO-BET rule

Output `NO BET — INSUFFICIENT EVIDENCE` for the entire fixture when:

- Data quality insufficient across core datasets
- Correct fixture cannot be confirmed
- Model disagreement is substantial in every market
- No selection passes all gates
- Key statistics conflict

Never force a bet. `NO BET` is a valid, preferred output over a weak prediction.

---

# PART VI — CALIBRATION, QUALITY & GOVERNANCE

## VI.1 Data Quality Score (0–100, per fixture)

Inputs: fixture validity, historical sample size, home/away sample size, recent-form availability, attack/defense data, strength data, lineup availability, H2H availability, market availability, referee availability (bookings), player-data availability (props), data freshness, data consistency.

90–100 Excellent · 80–89 Very Good · 70–79 Good · 60–69 Limited · <60 Insufficient.

## VI.2 Model Agreement Score (0–100, per market)

Count independent components supporting the selection. A pick supported by Elo + Poisson + form + defense + market outranks one supported only by league position. Heavy disagreement → `MODEL AGREEMENT = LOW` → confidence decreases.

## VI.3 Probability calibration

- Final outputs are probabilities, not labels; every multi-outcome distribution sums to 100% ± tolerance.
- A 70% prediction fails ~30% of the time if calibrated — evaluate over large historical samples, never single matches.
- League-specific calibration: goal, draw, corner and card baselines are computed per league per season.
- All ensemble weights in this document are STARTING weights — backtest and recalibrate out-of-sample (log loss, Brier score, calibration curves).

## VI.4 Risk analysis (mandatory pre-output)

For every candidate selection, actively attempt to disprove it: list the strongest counter-evidence (form, absences, market disagreement, congestion, tactical mismatch, distribution shape). A selection that cannot survive its own risk section is rejected.

---

# PART VII — UNIFIED OUTPUT FORMAT

```text
════════════════════════════════════════════
UNIFIED FOOTBALL PREDICTION ENGINE — OUTPUT
════════════════════════════════════════════

MATCH:              HOME TEAM vs AWAY TEAM
COMPETITION:        ... | DATE: ... | STATUS: VALIDATED
DATA QUALITY:       XX/100 (classification)

────────── 1X2 CORE ──────────
HOME WIN  XX% | DRAW  XX% | AWAY WIN  XX%   (total 100%)
λ_home X.XX | λ_away X.XX
DRAW RISK XX/100 (L/M/H) | UPSET RISK XX/100 (L/M/H)
MODEL AGREEMENT XX/100

────────── BEST PREDICTION PER MARKET ──────────
1X2:            <selection> @ XX% | edge XX% | EV XX% | tier | or NO BET — reason
DOUBLE CHANCE:  <1X/X2/12> @ XX% | ... | or NO BET — reason
DRAW MODULE:    elevated? yes/no | P(Draw) XX% | value? | or NO BET
CORRECT SCORE:  Top-5 list w/ % and fair odds | primary pick | confidence | or matrix-only
OVER/UNDER:     best Over <line> @ XX% | best Under <line> @ XX% | EV | or NO BET
BTTS:           YES/NO @ XX% | or NO BET — reason
TEAM TO SCORE:  Home ≥1 @ XX% | Away ≥1 @ XX% | value flags | or PASS
HANDICAP:       best line + full settlement table (P win/half-win/push/half-loss/loss, EV) | or NO BET
CORNERS:        best total line | team corners | corner winner H/D/A | handicap | or INSUFFICIENT DATA
BOOKINGS:       best total line | team bookings | winner | referee note | or INSUFFICIENT DATA
PLAYER PROPS:   player | P(G) P(A) P(G∪A) | expected minutes | EV | or NO BET

────────── CONSISTENCY REPORT ──────────
All cross-market checks: PASS / list of contradictions + resolution

────────── FINAL RANKING ──────────
★ BEST BET OVERALL:  <market + selection> @ XX% | fair odds X.XX | EV XX% | AAVS XX
  ALTERNATE 1: ...
  ALTERNATE 2: ...
  MARKETS RETURNING NO BET: ... (with reasons)

────────── EVIDENCE ──────────
POSITIVE SIGNALS (top 5): ...
NEGATIVE SIGNALS / RISKS (top 4): ...
MARKET COMPARISON: model vs market per relevant outcome
FINAL REASON: concise explanation using ONLY verified data — why this selection,
which models agree, main risks, market agreement, EV, confidence, data quality.

FINAL DECISION: <selection> | or NO BET — INSUFFICIENT EVIDENCE
```

---

# CORE PRINCIPLE

The engine must NEVER use:

```text
Higher league position = WIN
Won last 5 = WIN
Shorter odds = VALUE
Evenly matched = DRAW
Big team = COVERS HANDICAP
Derby = MORE CARDS
Famous striker = SCORES
```

Every market is priced from one validated dataset and one calibrated mathematical core:

**Fixture Validation → Shared Data Layer → Goal Expectancy → Poisson + Dixon-Coles + Overdispersion → Score & Goal-Difference Matrix → Market Modules → Consistency Engine → Market Value Layer (fair odds, edge, EV) → Data Quality + Model Agreement + Robustness → Accuracy-Adjusted Value Ranking → Best Bet per Market → Best Bet Overall → NO BET when evidence fails.**

# FINAL PRIORITY HIERARCHY

1. Data integrity
2. Correct fixture
3. Shared validated dataset (venue splits mandatory)
4. Calibrated mathematical core
5. Market-specific module evidence
6. Cross-market consistency
7. Market validation & expected value
8. Data quality, model agreement, robustness
9. Best-bet ranking (accuracy first)
10. Final decision — with NO BET preferred over any unsupported selection

Never reverse this hierarchy because a team is popular, famous, or short-priced. The objective is not to find a bet — it is to find the **most accurately calibrated, best-evidenced prediction in each market**, and to say **NO BET** when none exists.
