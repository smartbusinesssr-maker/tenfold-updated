import { citeApa, doiHref, ensembleWeightRows, PAPERS } from "@/lib/football/papers";
import type { CalibrationReport } from "@/lib/football/types";

export function MethodPanel({ calibration }: { calibration?: CalibrationReport | null }) {
  const live = calibration?.applied;
  const moved = Boolean(live && live.n >= 12);
  const titleFor = (fam: "win" | "btts" | "ou" | "cs", base: string) => {
    const rule = live?.families[fam]?.rule;
    if (!moved || !rule || rule === "prior") return base;
    return `${base} (calibrated)`;
  };
  return (
    <div className="space-y-8 text-sm text-pretty">
      <section className="space-y-3">
        <h2 className="font-display text-xl">How the ten are chosen</h2>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            <span className="text-foreground">Extract.</span> Date-scoped fixtures, paginated pre-match odds (every bookmaker the plan returns — no bookmaker filter; a blank book is filled from `/odds?fixture=`), injuries, and API-Football predictions. Bets 1, 4, 5, 8, 9, 10, 12, 21 plus extra O/U 0.5/3.5/4.5, team-to-score, cards, multi-goals. A failed odds page keeps the books already fetched. The clock does not throw that board away. The posted price is the trimmed-median consensus, not whichever book happens to sit
            in 1.85–2.00 — a 1.05 Over 1.5 with one stale 1.93 line stays 1.05 and is not a value pick. Then a
            single `/leagues?current=true` coverage probe. Endpoints are called only when that league actually
            supports them, and only when they add information: last-20 results always (LEVEL 1), tables and
            `/teams/statistics` when coverage allows, H2H only if last-20 is thin (never primary), injuries
            role-weighted and only counted as known for that league, confirmed XIs inside 90 minutes. Corner
            counts (`/fixtures/statistics`) and player season minutes (`/players`) fire only when those markets
            are posted and coverage allows, capped so a live scan stays inside the budget. We do
            not call `/fixtures/events` on a live scan. Missing stays null, never zero. Those become one
            feature snapshot (v13): opponent-adjusted attack/defence, Kalman log-attack / log-defence
            (Crowder 2002), multi-timescale EWMA 3/5/10/20, goal-form momentum, finishing-regression
            flag, failed-to-score, clean sheets, scoring streaks, availability by role, league
            environment from the table, BTTS failure modes, data grade. λ is Maher log-linear
            (μ + att − def) mixed with the rate path — not a last-5 Over 1.5 percentage.
            Quality is not inflated by a global injury feed. Public scans pull ESPN standings. A token-bucket
            limiter stays under 6 requests/sec. Every market — 1X2, double chance, draw, O/U 0.5–4.5 plus
            Asian totals (2.0 / 2.25 / 2.75), BTTS, team-to-score, Asian/European handicap, bookings, odd/even,
            multi-goals, same-fixture combos (joint P from the score matrix, not independence), corners
            (bivariate Poisson totals / team / handicap / winner), and player G∪A (P(G)+P(A)−P(G∩A), minutes-scaled)
            — slices the shared dataset. Draw risk and upset risk gate straight wins. AH and Asian totals use full
            settlement EV. Best looks first for an over combo: team over 0.5, match over 1.5 or match over 2.5, 2–5 legs, price at least 2.00, each leg already through the FULL_DATA gate. Same-match legs use the score matrix. Over 2.5 is not stacked on over 1.5. Both teams over 0.5 is not stacked with over 1.5. Corners and player G∪A stay NO BET without count or minutes data.
          </li>
          <li>
            <span className="text-foreground">Price.</span> Home, Away, BTTS Yes/No and Over/Under 2.5
            are eligible at 1.25–3.50 — short enough for a real favourite, long enough that a 1.21 Over 1.5
            cannot occupy a slot. Over 1.5 is not a Tenfold market. Under 2.5 shorter than 1.55 is treated as
            a lock and stays off the ten. Draw lives at 2.40–5.00 and only prints when the grid is elevated
            (~26%+). Double chance needs ≥62% coverage and a price that is not a lock. Team-to-score ≥70%
            at 1.10–2.20 — that is <span className="text-foreground">Home Team Score a Goal Yes</span> / team Over 0.5,
            never Team To Score First or Last (those live at ~1.40–1.80 and were leaking into the TTS median). Asian handicap uses full-settlement EV (push / half-win), never 1/P(win). Correct score is 3.00–21.00 on 0-0 through 2-2 / 3-1, last resort only. Shin inversion strips the overround; for CS that inversion runs
            across the whole posted book, with tail reserved for unposted scores. Never 1/odd on a single cell.
          </li>
          <li>
            <span className="text-foreground">Model.</span> Last-five and season rates become λ via Maher
            attack/defence, Dixon–Coles recency, and Baio shrinkage toward that league’s home/away means
            (Pollard), not a global 1.38/1.12. Season-start samples (fewer than six matches) shrink harder. Opponent-adjusted
            rates discount table GD/rank so the same signal is not counted three times. Last-5 stays last-5 (last-20
            is FTS, clean sheets, opponent-adjusted rates — it does not overwrite recent form). SMA(k) of that last-20
            book is on Moving avg, next to match-count EMA and the live EWMA 3/5/10/20 day blend; SMA does not rank
            the ten. Form strings are
            newest-first. H2H walks Constantinou
            pi-ratings (6–18% of λ, BORS-cut when H2H disagrees with Shin, and cut further when last-20 form is in). Shin 1X2 is inverted to a Skellam λ pair and mixed with
            history (Egidi; history rises to ~62% when the sample is full). Over 2.5 rescales the total. ρ
            tightens on low-scoring matches. A second grid is 60% pi-ratings / 40% Hvattum Elo. Shot xG, when a match actually has a shot list, becomes a Torvaney grid: each shot is a Bernoulli, the scoreline is the product of the two Poisson-binomials, and λ moves 18% toward that match’s xG total. No shot list leaves λ on goals. Those grids —
            Dixon–Coles, Karlis, Frank copula, NegBin, Elo — are log-pooled into one posterior (p ∝ Π p_i^w).
            Karlis is not that copula: X = X₁+X₃, Y = X₂+X₃, and the shock cancels in the goal difference.
            Frank is the rectangle on the Poisson CDFs. Both lift 0-0; they do not share a 1-1.
            That is the I-projection: it minimises Σ w_i KL(p ‖ p_i). Genest 1984: unique pointwise EB
            rule (w ≥ 0 and weights sum to 1). Shin is a second density — model joint raked onto the book, then
            log-pooled with the model at α = 0.4 — not a linear mix of 1X2 numbers. Home, BTTS, Over 2.5 and 1-1 are slices of that
            table, not four independent blends. Last-five H2H is one 10% expert on BTTS / Over 2.5 — it is not
            also raked onto the grid. Blowout rates are Huber-winsorised toward the league mean
            (full weight to ~1.8 GD/game, then k/|r|); a side being thrashed is not shrunk twice. A top-quartile
            side on a cold streak gets λ back (Wheatcroft); hot form on an already-top-half side is damped. Ordered
            logit from win-rate + table gap feeds the ratings grid, not a tenth independent 1X2. Draw mass lifts only
            when Shin is short vs the grid or H2H draws pile up in a close table. A straight win needs λ gap ≥ 0.12
            and grid draw below 30% — a 32% draw is a draw, not a 1.90 home. Over 1.5 at 1.90 needs λ ≈ 1.7–2.1
            (a 4-goal game is a 1.05 Over, not a 1.90); Over 2.5 needs λ ≥ 2.38. Shin is mixed into λ only when
            the book agrees with last-20 history — a stale 1.93 does not drag a 2.8-gf side down to a coin flip.
            Panjer compound (Pólya–Aeppli) is on the 1X2 · O/U
            lab only — Yip (2024) measured goal VMR ≈ 1.04. NegBin is 8% of the union: r starts at 18 and only falls toward 3.5, so it stays heavier than that league figure. Open 1X2 · O/U for which negative binomial: the union uses two margins, and the Over 1.5 blend uses one on the total at r = 8. Zero-inflated Poisson is not in the union: margin ZIP, (0,0)-only and ZI-Skellam are three different coins, and π = 0.05 is a prior. Open 1X2 · O/U for the Skellam variants, the zero-inflated Skellam, and same-game parlay correlation. The over combo prices a same-match pair from that joint, not from the product. Last-20 for and against enter λ only with 12 games on both sides. A failed-to-score rate pulls that side toward −log(FTS). A last-5 BTTS percentage does not. Corner samples inside VMR (1.25, 3.5) mix each team 65% Poisson / 35% negative binomial. Same variance as mixing the finished totals, different shape, and the full negative binomial is the one that moves a line far from the mean. Open 1X2 · O/U for the corner lines. The accuracy price sits on the de-vigged book (0.62 of the 1X2 logit pool). That weight is a prior. It is not a 7,626-match log-loss. The grid is the correction, not the base. Value is still the model's price with the book taken out.
          </li>
          <li>
            <span className="text-foreground">Rank.</span> Accuracy is a weighted logit pool (Satopää),
            then extremized when Higgins I² is low — models that agree are underconfident, so the
            desk pushes away from ½. When I² is high, a → 1 and agreement falls. Value stays a
            linear mix without the market (Clemen: do not stack on five points). Composite =
            accuracy × (1 − I²) × league prior × edge × band centrality. A line needs ≥1pp of
            model edge vs Shin, model agreement, and a real posted CS book — no model-fair
            lottery tickets. Under 1.5, away dogs, youth/women, and API-advice conflicts are
            dropped. Mixer: five wins, three BTTS, two totals on pass 1. Extra families (draw, double chance,
            Asian handicap, team-to-score) fill pass 2 only when they are FULL_DATA. Combos, cards, corners,
            player G∪A, multi-goals and odd/even stay on Markets — they never occupy a ten slot.
            Extra O/U lines (0.5 / 3.5 / 4.5 and Asian 2.0 / 2.25 / 2.75) share the totals family — they cannot occupy the two Over/Under 2.5 seats.
            Before the mixer, a two-stage quality selector scores each pick from recency-weighted form, H2H
            dominance, sample maturity, reliability, Kelly/EV and league tier, then ranks it against the rest
            of today's family pool. Only picks that clear both bars (absolute ≥ 55; large family pools also
            need the 70th percentile) enter the ten. Quality beats quota — a short fold is the
            correct answer when the date is thin. Best requires FULL_DATA (last-five + sample ≥ 5). An over-only combo can be that bet. Every other combo stays off the headline.
            Accuracy weights start as inverse-Brier, then a Granger–Ramanathan least-squares mix
            on the logit pool the ten actually use, plus an intercept (temperature scale) when the
            whole crowd is biased. Nested walk-forward picks that rule; the live mix is the
            recency-weighted mean of expanding-window fits, not a one-shot in-sample refit. Applied
            only if it beats the paper prior out of sample — this date does not grade itself.
            Diebold–Mariano (Harvey–Leybourne–Newbold t, HAC on daily Brier) tests whether the skill
            is noise. Recency half-life and shrinkage n₀ are a separate Pardo walk-forward: a 4-cell
            mix-ls grid (14d/48, 7d/24, 28d/96, 14d/96), freeze the IS-winner, score the next date.
            Efficiency is IS Brier / OOS Brier; PBO (Bailey CSCV) and White’s reality check flag a
            snooped hyper. Applied only if mean OOS beats 14d · n₀ 48 by 0.0005 Brier.
            Rolling last-7 waits until the corpus is longer than a week. Shin is capped.
            Open Maher for Conway–Maxwell–Poisson: matching the mean, Over 2.5 stays near the Poisson number and the weight stays 0. Open Maher for the regression: quasi-Poisson does not move a price, and NB at r = 18 moves Over 2.5 by less than half a point. Open Dixon–Coles for the decay: a year-old match still holds half its weight, and the last five results are not decayed. Open Dixon–Coles for the parameter: ρ = −0.13 is a goal correlation of +0.013, not −0.13. Open Dixon–Coles for the fit: one Newton step from independence lands on the frozen ρ, and attack times defence is not a separate number. Open Dixon–Coles for the estimate: ρ is frozen, and 1,000 matches still leave an SE of 0.04. Open Dixon–Coles for the adjustment: one probability A, and the 1–1 lift is exactly −ρ. Open Maher for the baseline: defence pinned at 1, and the 1982 average is a larger home edge on fewer goals. Open Dixon–Coles for the grid: the four τ edits cancel, and Over 2.5 does not move. Open Baio for the hierarchy: five perfect H2H meetings do not become the sample rate, and the interval still covers the prior. Open Moving avg for the latent state: the shock is unobserved given the score, and one match moves log-attack by the Kalman gain, not by the goals. Open BTTS for the trivariate extension: the same goal pair can hide a pairwise corner shock or a triple shock, and only the third cumulant separates them. Open BTTS for the bivariate Poisson: the margins stay Poisson, the total does not, and the covariance cannot be negative. Open Dixon–Coles for the conditional correlation: given the shock the counts are independent, given an exact total the correlation is −1, and Dixon–Coles only edits the low corner. Open BTTS for the Karlis correlation: the same shock is a larger Pearson when the means are smaller. Open Calibrate for the three Platt maps. Temperature pulls both tails toward 1/2. Bias shifts every quote the same way. Walk-forward for the hyper grid; Accuracy for the
            out-of-sample curve and the five validation methods. Resubstitution and a time-blind
            k-fold are shown there so they can be refused. Expanding walk-forward is the one the desk uses.
            A home/away needs λ gap, the book as favourite,
            last-five H2H not 1/5 against, and draw mass under 30%. BTTS No only prints when λ, last-five GF and
            last-five H2H all say a clean sheet — missing data is not a No. Correct score is optional — it only
            fills a short card, never bumps a binary. A CS cell must beat the next score by 1pp, keep 28% in the
            top three, and live in the same 1X2 cluster as the grid (0-2 is not a 68% home). The fold can be short if the date has no edge.
            A 1.90 home is not dropped because Shin P(home) is 48% (the draw takes the rest), and a
            2.04 named book does not kill a 1.91 consensus.
            Stake size is Kelly 1956 on calibrated P versus the posted decimal: f* = (bp − q)/b. The desk
            defaults to Thorp quarter-Kelly, haircuts a second market on the same fixture, and scales the
            whole card if it would exceed 20% of bankroll. Full Kelly below 2% is a pass. Open Kelly to size
            the ticked slips (or the daily ten). Stake size does not rank the ten.
            Risk-adjusted return is Sharpe 1966 on unit-stake settled lines (rf = 0, not annualised).
            Sortino & Price 1994 uses the same book with MAR = 0 (cash): downside δ keeps winning
            periods as zeros, so a 2.00 overlay that mostly hits looks better on Sortino than on Sharpe.
            UPR (Dutch Triangle, 1999) is the other tail of the same δ. Omega (Keating & Shadwick 2002)
            is UPM₁ / LPM₁; Kappa (Kaplan & Knowles 2004) nests them — κ₁ restates Omega, κ₂ is Sortino,
            κ₃ weights crash tails. Open Sortino to change MAR, odd and hit rate, and to see the
            drop-winners bug (semi-deviation in the denominator). PSR (Bailey & López de Prado 2012) is P(true Sharpe is positive)
            given n, skew and kurtosis; DSR (2014) deflates that for the number of families searched.
            Open Accuracy for the live corpus, family split, Sortino, and equity path. The Kelly card prints an
            ex-ante Sharpe, Sortino and Omega from Bernoulli moments after haircut — that is not a backtest.
            Last-five 4/5 is not a significant edge: Wilson 1927 puts it in 38–96%, which still contains a 1.82
            Shin line, and a 10pp edge needs a three-digit sample for 80% power. Ten simultaneous claims are a
            search — Bonferroni is α/10, Holm steps down and Hochberg steps up on α/(m−r+1) for the familywise
            error, and Benjamini–Hochberg steps up on (r/m)α for a 5% false-discovery rate with π₀ = 1. The keeps
            nest in that order. The step-up keeps every
            rank up to k*, including a line that missed its own bar. Benjamini–Yekutieli divides those bars by
            H_m only when the joint law is arbitrary. The method is ordinary BH at α′ = α/H_m; it does not spend a
            π₀ estimate. Independence and PRDS (same-direction legs, ρ ≥ 0) keep BH
            at α. One opposed pair — home against away — pulls the whole card onto the α·H_m bound; BH on the
            other legs does not repair the pooled rate. Storey (2002) estimates
            π₀ from p-values above λ = ½ and reports a q-value: π₀ times the BH-adjusted p, or lower when a
            later rank has a smaller ratio. q is an FDR, not a p-value. λ is not innocent:
            bootstrap picks λ* by MSE, the smoother reads a quadratic π₀(λ) at 0.95, and a ten-fold rarely
            has a usable tail, so q falls back to BH. Open Significance. Those tests
            diagnose the card; they do not rank the ten.
          </li>
        </ol>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <WeightTable
          title={titleFor("win", "Accuracy ensemble — 1X2")}
          rows={ensembleWeightRows("win", "accuracy", moved ? live!.families.win.acc : null)}
        />
        <WeightTable
          title="Value ensemble (no market)"
          rows={ensembleWeightRows("win", "value", moved ? live!.families.win.val : null)}
        />
        <WeightTable
          title={titleFor("ou", "Accuracy ensemble — over/under")}
          rows={ensembleWeightRows("ou", "accuracy", moved ? live!.families.ou.acc : null)}
        />
        <WeightTable
          title="Value ensemble — over/under"
          rows={ensembleWeightRows("ou", "value", moved ? live!.families.ou.val : null)}
        />
        <WeightTable
          title={titleFor("btts", "Accuracy ensemble — BTTS")}
          rows={ensembleWeightRows("btts", "accuracy", moved ? live!.families.btts.acc : null)}
        />
        <WeightTable
          title={titleFor("cs", "Accuracy ensemble — correct score")}
          rows={ensembleWeightRows("cs", "accuracy", moved ? live!.families.cs.acc : null)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Meta-analysis on the card</h2>
        <p className="text-muted-foreground">
          Each pick is five probability “studies” (Dixon–Coles, Shin, API, ratings, H2H). Cochrane
          techniques that fit a live desk — and the ones that do not:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <span className="text-foreground">Used.</span> Cochran Q → Higgins I² (agreement).
            DerSimonian–Laird τ² (how much extra spread). Satopää logit pool + extremizing
            (Ranjan–Gneiting: a linear pool is underdispersed). Bates–Granger inverse-Brier as the
            starting mix; Granger–Ramanathan least squares plus intercept when it wins walk-forward
            — open Accuracy.
          </li>
          <li>
            <span className="text-foreground">Not used on the ten.</span> Classic BMA / Occam’s window /
            one-shot stacking — they collapse onto Shin. Open the BMA tab to watch that happen.
            Trim-and-fill, PRISMA, funnel plots — those are for published trials, not five models of one match.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">References</h2>
        <p className="text-muted-foreground">
          APA citations for every paper on the desk, chronological. DOI links go to the publisher.
        </p>
        <ol className="space-y-4">
          {[...PAPERS]
            .sort((a, b) => a.year - b.year || a.authors.localeCompare(b.authors))
            .map((p, i) => (
            <li key={`${p.doi}:${i}`} className="rounded-lg bg-card p-4 shadow-border" data-qa="paper-cite">
              <p className="text-pretty">{citeApa(p)}</p>
              <p className="mt-2">
                <a
                  href={doiHref(p)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-pitch underline-offset-4 hover:underline"
                >
                  {p.doi.startsWith("http") ? p.doi.replace(/^https:\/\//, "") : `doi:${p.doi}`}
                </a>
              </p>
              <p className="mt-2 text-muted-foreground">{p.usedFor}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function WeightTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string] | [string, string, string | undefined] | string[]>;
}) {
  return (
    <div>
      <h3 className="mb-2 font-medium">{title}</h3>
      <ul className="divide-y divide-border rounded-lg bg-card shadow-border">
        {rows.map((row) => (
          <li key={row[0]} className="flex items-center justify-between gap-3 px-3 py-2">
            <span>{row[0]}</span>
            <span className="shrink-0 text-right font-mono tabular-nums text-muted-foreground">
              {row[1]}
              {row[2] ? <span className="ml-2 text-xs opacity-70">{row[2]}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
