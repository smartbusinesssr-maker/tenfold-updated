import { useMemo, useState } from "react";
import { ScorelineGrid } from "@/components/desk/scoreline-grid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  clampRho,
  DC_DECAY_HORIZONS,
  DC_RHO,
  DC_RHO_MLE,
  DC_RHO_TOTALS,
  DC_XI_HALF_WEEK,
  DC_XI_PER_DAY,
  dcHalfLifeDays,
  dcDecay,
  dcCorrelation,
  dcRhoMap,
  dcAdjustment,
  dcEstimate,
  dcParamFit,
  dcDecayTrace,
  dcGridDetail,
  conditionalCorrelation,
  jointGrid,
  LEAGUE_MEAN_AWAY,
  LEAGUE_MEAN_HOME,
  marketsFromGrid,
  poissonClosure,
  poissonInvestigate,
  rhoBounds,
  tauCells,
  type TauCell,
} from "@/lib/football/models";
import { cn } from "@/lib/utils";

export interface DcSeed {
  id: number;
  label: string;
  lambdaHome: number;
  lambdaAway: number;
  rho: number;
}

export function seedsFromPicks(
  picks: Array<{
    fixtureId: number;
    home: string;
    away: string;
    lambdaHome: number;
    lambdaAway: number;
    rho: number;
  }>,
  limit = 12,
): DcSeed[] {
  const acc: DcSeed[] = [];
  for (const p of picks) {
    if (acc.some((s) => s.id === p.fixtureId)) continue;
    acc.push({
      id: p.fixtureId,
      label: `${p.home} v ${p.away}`,
      lambdaHome: p.lambdaHome,
      lambdaAway: p.lambdaAway,
      rho: p.rho,
    });
    if (acc.length >= limit) break;
  }
  return acc;
}

function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function pp(n: number): string {
  const v = n * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} pp`;
}

function near(a: number, b: number, eps = 1e-4): boolean {
  return Math.abs(a - b) < eps;
}

function cellOf(cells: TauCell[], score: string): TauCell | undefined {
  return cells.find((c) => c.score === score);
}

export function DixonColesPanel({ seeds }: { seeds: DcSeed[] }) {
  const [lh, setLh] = useState(LEAGUE_MEAN_HOME);
  const [la, setLa] = useState(LEAGUE_MEAN_AWAY);
  const [rho, setRho] = useState(DC_RHO);
  const [xi, setXi] = useState(DC_XI_PER_DAY);
  const [seedId, setSeedId] = useState<number | "paper">("paper");

  const bounds = rhoBounds(lh, la);
  const rhoUsed = clampRho(rho, lh, la);
  const clipped = Math.abs(rhoUsed - rho) > 1e-6;

  const dc = useMemo(() => marketsFromGrid(jointGrid(lh, la, rhoUsed)), [lh, la, rhoUsed]);
  const maher = useMemo(() => marketsFromGrid(jointGrid(lh, la, 0)), [lh, la]);
  const cells = useMemo(() => tauCells(lh, la, rhoUsed), [lh, la, rhoUsed]);
  const poisson = useMemo(() => poissonInvestigate(lh), [lh]);
  const poissonAway = useMemo(() => poissonInvestigate(la), [la]);
  const halfLife = dcHalfLifeDays(xi);
  const paperHalfLife = dcHalfLifeDays(DC_XI_PER_DAY);
  const twoByTwo = [
    cellOf(cells, "0-0"),
    cellOf(cells, "0-1"),
    cellOf(cells, "1-0"),
    cellOf(cells, "1-1"),
  ].filter((c): c is TauCell => Boolean(c));
  const d11 = cellOf(cells, "1-1");
  const d00 = cellOf(cells, "0-0");

  const paperPreset =
    seedId === "paper" && near(rho, DC_RHO) && near(xi, DC_XI_PER_DAY) && near(lh, LEAGUE_MEAN_HOME) && near(la, LEAGUE_MEAN_AWAY);
  const independentPreset = near(rho, 0);
  const buggyPreset = near(xi, DC_XI_HALF_WEEK);

  function applyPaper() {
    setLh(LEAGUE_MEAN_HOME);
    setLa(LEAGUE_MEAN_AWAY);
    setRho(DC_RHO);
    setXi(DC_XI_PER_DAY);
    setSeedId("paper");
  }

  function applyIndependent() {
    setRho(0);
  }

  function applyBuggyXi() {
    setXi(DC_XI_HALF_WEEK);
  }

  function applyMleRho() {
    setRho(DC_RHO_MLE);
  }

  function applySeed(id: number) {
    const s = seeds.find((x) => x.id === id);
    if (!s) return;
    setLh(s.lambdaHome);
    setLa(s.lambdaAway);
    setRho(s.rho);
    setXi(DC_XI_PER_DAY);
    setSeedId(id);
  }

  const readouts: Array<[string, number, number]> = [
    ["Home", dc.home, maher.home],
    ["Draw", dc.draw, maher.draw],
    ["Away", dc.away, maher.away],
    ["BTTS yes", dc.bttsYes, maher.bttsYes],
    ["Over 1.5", dc.over15, maher.over15],
    ["Over 2.5", dc.over25, maher.over25],
  ];

  return (
    <div id="dixon-coles-lab" data-qa="dixon-coles-lab" className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-display text-xl">Dixon–Coles parameters</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Sandbox only. The daily ten keep ρ = {DC_RHO}, then scale it by the expected total. A rescan does not refit ρ or ξ. Dixon & Coles (1997) correct four low-score cells, then down-weight old matches with φ(t) = exp(−ξ t). Their ξ = {DC_XI_HALF_WEEK} is per half-week: divide by 3.5 and the half-life is {Math.round(paperHalfLife)} days. Treating 0.0065 as daily was the bug.
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="ρ (desk)" v={DC_RHO.toFixed(2)} n={`MLE ${DC_RHO_MLE}`} />
        <Stat k="ξ / half-week" v={String(DC_XI_HALF_WEEK)} n="1997 time unit" />
        <Stat k="ξ / day" v={DC_XI_PER_DAY.toFixed(5)} n="desk H2H rate" />
        <Stat k="half-life" v={`${Math.round(paperHalfLife)}d`} n="paper, not 107d" />
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={paperPreset ? "default" : "outline"} onClick={applyPaper}>
          1997 paper
        </Button>
        <Button size="sm" variant={independentPreset ? "default" : "outline"} onClick={applyIndependent}>
          Independent (ρ = 0)
        </Button>
        <Button size="sm" variant={buggyPreset ? "default" : "outline"} onClick={applyBuggyXi}>
          Buggy ξ 0.0065/day
        </Button>
        <Button size="sm" variant={near(lh, 3.35) ? "default" : "outline"} onClick={() => setLh(3.35)}>
          Clamp λ 3.35
        </Button>
        <Button size="sm" variant={near(rho, DC_RHO_MLE) ? "default" : "outline"} onClick={applyMleRho}>
          MLE ρ {DC_RHO_MLE}
        </Button>
      </div>

      {seeds.length ? (
        <div className="flex flex-wrap gap-2">
          {seeds.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={seedId === s.id ? "secondary" : "outline"}
              className="h-auto max-w-full whitespace-normal py-2 text-left"
              onClick={() => applySeed(s.id)}
            >
              {s.label}
              <span className="font-mono text-muted-foreground tabular-nums">
                {s.lambdaHome.toFixed(2)}/{s.lambdaAway.toFixed(2)}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run the desk to seed λ from today’s fold.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <Param
            label="λ home"
            value={lh}
            min={0.4}
            max={3.35}
            step={0.02}
            format={(n) => n.toFixed(2)}
            onChange={setLh}
            hint="League mean 1.38 · clamp 3.35"
          />
          <Param
            label="λ away"
            value={la}
            min={0.4}
            max={3.0}
            step={0.02}
            format={(n) => n.toFixed(2)}
            onChange={setLa}
            hint="League mean 1.12"
          />
          <Param
            label="ρ"
            value={rho}
            min={-0.4}
            max={0.2}
            step={0.005}
            format={(n) => n.toFixed(3)}
            onChange={setRho}
            hint={
              clipped
                ? `clipped to ${rhoUsed.toFixed(3)} so τ > 0`
                : `valid ${bounds.lo.toFixed(2)} … ${bounds.hi.toFixed(2)} · totals use ${DC_RHO_TOTALS}`
            }
          />
          <Param
            label="ξ / day"
            value={xi}
            min={0}
            max={0.008}
            step={0.00005}
            format={(n) => n.toFixed(5)}
            onChange={setXi}
            hint={
              Number.isFinite(halfLife)
                ? `half-life ${Math.round(halfLife)} days · paper ${DC_XI_PER_DAY.toFixed(5)}`
                : "no decay"
            }
          />

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground tabular-nums">
            <dt>τ(0,0)</dt>
            <dd className="text-right text-foreground">1 − λμρ = {cellOf(cells, "0-0")?.tau.toFixed(3)}</dd>
            <dt>τ(1,0)</dt>
            <dd className="text-right text-foreground">1 + μρ = {cellOf(cells, "1-0")?.tau.toFixed(3)}</dd>
            <dt>τ(0,1)</dt>
            <dd className="text-right text-foreground">1 + λρ = {cellOf(cells, "0-1")?.tau.toFixed(3)}</dd>
            <dt>τ(1,1)</dt>
            <dd className="text-right text-foreground">1 − ρ = {cellOf(cells, "1-1")?.tau.toFixed(3)}</dd>
          </dl>
        </div>

        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Joint grid vs Maher</p>
          <ScorelineGrid
            heat={dc.heat}
            highlight={dc.scoreline}
            caption="Home goals down · away across · Dixon–Coles P(H,A). Modal cells are typically 8–14%."
          />
          <ul className="divide-y divide-border text-sm">
            {readouts.map(([label, a, b]) => (
              <li key={label} className="flex items-center justify-between py-1.5">
                <span>{label}</span>
                <span className="font-mono tabular-nums">
                  {pct(a)}{" "}
                  <span className="text-muted-foreground">{pp(a - b)} vs Poisson</span>
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between py-1.5">
              <span>Modal CS</span>
              <span className="font-mono tabular-nums">
                {dc.scoreline} {pct(dc.scorelineP)}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-4 shadow-border">
          <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">Low-score τ cells</p>
          <p className="mb-3 text-sm text-pretty text-muted-foreground">
            {independentPreset
              ? "Independent Poisson — τ = 1 on every cell, so the grid is Maher."
              : `Negative ρ inflates 0-0 (${pp(d00?.delta ?? 0)}) and 1-1 (${pp(d11?.delta ?? 0)}), trims 1-0 and 0-1. That is why the correct-score engine prefers 1-1 more than Maher.`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {twoByTwo.map((c) => (
              <div key={c.score} className="rounded-lg bg-muted p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-2xl leading-none">{c.score}</span>
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      c.delta > 0.0005 ? "text-pitch" : c.delta < -0.0005 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {pp(c.delta)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground tabular-nums">τ {c.tau.toFixed(3)}</p>
                <p className="font-mono text-sm tabular-nums">
                  {pct(c.maher)} → {pct(c.dc)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Home down, away across. The four τ edits cancel, so a cell with τ = 1 does not move and Over 2.5 does not move. Totals use ρ = {DC_RHO_TOTALS} so Over 1.5 is not dragged as hard.
          </p>
        </div>

        <div className="rounded-xl bg-card p-4 shadow-border">
          <p className="mb-3 text-xs tracking-wide text-muted-foreground uppercase">
            Time decay φ(t) = exp(−ξ t)
          </p>
          <ul className="space-y-2">
            {DC_DECAY_HORIZONS.map((d) => {
              const live = dcDecay(d, xi);
              const paper = dcDecay(d, DC_XI_PER_DAY);
              const showPaper = Math.abs(live - paper) > 0.01;
              return (
                <li key={d} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-sm">
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {d === 0 ? "today" : d >= 365 ? `${d / 365}y` : `${d}d`}
                  </span>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-pitch" style={{ width: `${Math.round(live * 100)}%` }} />
                    {showPaper ? (
                      <span
                        className="absolute top-0 h-full w-px bg-foreground/70"
                        style={{ left: `${Math.round(paper * 100)}%` }}
                        title={`paper ${pct(paper, 0)}`}
                      />
                    ) : null}
                  </div>
                  <span className="min-w-16 text-right font-mono text-xs tabular-nums">
                    {pct(live, 0)}
                    {showPaper ? <span className="text-muted-foreground"> · {pct(paper, 0)}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Paper ξ / day {DC_XI_PER_DAY.toFixed(4)} keeps a six-month H2H at {pct(dcDecay(180, DC_XI_PER_DAY), 0)}.
            Treating 0.0065 as daily would cut that to {pct(dcDecay(180, DC_XI_HALF_WEEK), 0)} — a 107-day half-life.
            Tick marks are the paper weights when the slider leaves them.
          </p>
        </div>
      </div>

      <DcGrid lh={lh} la={la} rho={rhoUsed} />
      <DcAdjust lh={lh} la={la} rho={rhoUsed} />
      <DcEstimate />
      <DcParamFit />
      <DcDecayUse />
      <DcCorrelation lh={lh} la={la} rho={rhoUsed} />
      <DcRhoMap lh={lh} la={la} />
      <ConditionalStructures lh={lh} la={la} rho={rhoUsed} />

      <section className="space-y-3" data-qa="poisson-trace">
        <h2 className="font-display text-xl">Poisson</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Every score starts here. P(0) = e<sup>−λ</sup>, then P(k) = P(k−1) · λ/k. The code is that
          recurrence, not a factorial. Before the cap, the mean and the variance are both λ. The grid
          keeps goals 0…8, drops the rest, and renormalises, so the truncated mean sits under λ and the
          variance-to-mean ratio falls under 1. At the league λ the tail is noise. At the clamp 3.35 it
          is not. Dixon–Coles does not change the margins. τ edits four cells. An independent cell is
          still Maher: P(x, y) = P(x)P(y). This does not rank the ten.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat k="P(0) home" v={pct(poisson.p0)} n={`e^−${lh.toFixed(2)}`} />
          <Stat k="Mode" v={String(poisson.mode)} n="floor of λ when λ is not an integer" />
          <Stat
            k="Tail past 8"
            v={poisson.tail < 1e-4 ? "<0.01%" : pct(poisson.tail, 2)}
            n={`away ${poissonAway.tail < 1e-4 ? "<0.01%" : pct(poissonAway.tail, 2)}`}
          />
          <Stat
            k="Truncated VMR"
            v={poisson.truncatedVmr.toFixed(3)}
            n={poisson.equidispersion ? "full sum is equidispersed" : "full sum left λ"}
          />
        </div>
        <div className="overflow-x-auto rounded-lg bg-card shadow-border">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">k</th>
                <th className="px-3 py-2 font-medium">P(k)</th>
                <th className="px-3 py-2 font-medium">Step λ/k</th>
                <th className="px-3 py-2 font-medium">From previous</th>
              </tr>
            </thead>
            <tbody>
              {poisson.rows.map((row, i) => {
                const prev = i === 0 ? null : poisson.rows[i - 1]!;
                const built = prev && row.step != null ? prev.p * row.step : row.p;
                return (
                  <tr key={row.k} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono tabular-nums">{row.k}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{pct(row.p, 2)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{row.step == null ? "e^−λ" : row.step.toFixed(3)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                      {i === 0 ? "start" : pct(built, 2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          Truncated mean {poisson.truncatedMean.toFixed(3)} against λ {lh.toFixed(2)}. Untruncated mean{" "}
          {poisson.longMean.toFixed(3)}, variance {poisson.longVar.toFixed(3)}.
        </p>
        <PoissonClosure lh={lh} la={la} />
      </section>
    </div>
  );
}

function DcDecayUse() {
  const z = dcDecayTrace();
  return (
    <section className="space-y-3" data-qa="dc-decay">
      <h2 className="font-display text-xl">Where the weight lands</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        φ(t) = exp(−ξ t) is a weight, not a new score. ξ = 0.0065 is per half-week, so per day it is{" "}
        {z.xiDay.toFixed(5)} and the half-life is {z.halfLife.toFixed(0)} days. A match a year old still holds{" "}
        {pct(z.rows[6]!.paper, 1)}. Treating 0.0065 as a daily rate cuts that to {pct(z.rows[6]!.dailyBug, 1)} and the
        half-life to {z.bugHalfLife.toFixed(0)} days. Two results, 3 goals at 7 days and 0 goals at 365 days, average{" "}
        {z.flatMean.toFixed(2)} if each match counts once. The paper weight moves that to {z.paperPair.mean.toFixed(2)},
        and the recent match is {pct(z.paperPair.share, 0)} of the pair. The daily bug moves it to{" "}
        {z.bugPair.mean.toFixed(2)}. Venue rates and opponent-adjusted attack use the paper weight. The last five
        results, and the newest five H2H that move λ, do not. A year-old H2H still teaches the pi-rating at{" "}
        {z.piYear.toFixed(3)} of a fresh meeting, because that learning rate is 0.55 + 0.45 φ(t). A settled line uses a
        14-day half-life; a match result at 14 days still holds {pct(z.match14, 1)}. This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Age</th>
              <th className="py-1.5 font-medium">Paper</th>
              <th className="py-1.5 font-medium">0.0065 / day</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.rows.map((row) => (
              <tr key={row.days} className="border-t border-border">
                <td className="py-1.5 font-sans">{row.days === 0 ? "today" : `${row.days}d`}</td>
                <td className="py-1.5">{pct(row.paper, 1)}</td>
                <td className="py-1.5">{pct(row.dailyBug, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DcParamFit() {
  const z = dcParamFit();
  return (
    <section className="space-y-3" data-qa="dc-fit">
      <h2 className="font-display text-xl">Free parameters</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        The 1997 likelihood is in attack, defence, home advantage and ρ. A match mean is α times the
        opponent’s defence times γ, so those three are not separate numbers. Multiplying every attack by
        1.2 and dividing every defence by 1.2 leaves both means, and the whole grid, unchanged. Putting
        the home edge into γ does the same. The likelihood is flat along that direction, so a fit has to
        pin one of them. This desk never estimates them. It writes λ from the rate blend. A 2–1 at the
        league means would move home attack by the residual {z.homeResidual.toFixed(3)} and away attack by{" "}
        {z.awayResidual.toFixed(3)}. The blend does not take that step. ρ is the one parameter with a
        score. If every match followed the frozen model, the score at independence is {z.scoreAtZero.toFixed(3)} and
        the information is {z.infoAtZero.toFixed(3)}, so one Newton step lands at {z.newton.toFixed(3)}. That is{" "}
        {Math.abs(z.newton + 0.13).toFixed(4)} from the frozen −0.13. The same step on independent matches
        stays at {z.indepScore.toFixed(0)}, because 0–0 and 1–1 are not fat enough to move ρ. This does not
        rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Pin</th>
              <th className="py-1.5 font-medium">α home</th>
              <th className="py-1.5 font-medium">β away</th>
              <th className="py-1.5 font-medium">γ</th>
              <th className="py-1.5 font-medium">α away</th>
              <th className="py-1.5 font-medium">β home</th>
              <th className="py-1.5 font-medium">λ</th>
              <th className="py-1.5 font-medium">μ</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.books.map((row) => (
              <tr key={row.name} className="border-t border-border">
                <td className="py-1.5 font-sans">{row.name}</td>
                <td className="py-1.5">{row.ah.toFixed(3)}</td>
                <td className="py-1.5">{row.ba.toFixed(3)}</td>
                <td className="py-1.5">{row.gamma.toFixed(2)}</td>
                <td className="py-1.5">{row.aa.toFixed(3)}</td>
                <td className="py-1.5">{row.bh.toFixed(3)}</td>
                <td className="py-1.5">{row.lambdaH.toFixed(2)}</td>
                <td className="py-1.5">{row.lambdaA.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DcEstimate() {
  const z = dcEstimate();
  return (
    <section className="space-y-3" data-qa="dc-est">
      <h2 className="font-display text-xl">Estimate</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        ρ is not fitted on this desk. The stored figure next to −0.13 is {z.rhoMle.toFixed(4)}, a gap of{" "}
        {Math.abs(z.gap).toFixed(4)}. One match carries information {z.info.toFixed(2)} about ρ, so 1,000 matches
        still leave a standard error of {z.se1000.toFixed(3)}. That is {Math.round(z.se1000 / Math.abs(z.gap))} times
        the gap, so the third decimal is not identified. At the frozen ρ the four low-score pulls on the likelihood
        are equal and sum to zero. At ρ = 0 the same probabilities pull the score to {z.scoreAtZero.toFixed(3)}, so
        independence is not the maximum. The ten do not use −0.13 raw. They multiply by 2.6 divided by the expected
        total, and clip that factor to 0.75…1.35. At 1.38 / 1.12 the match ρ is {z.schedule[1].rho.toFixed(3)}. ξ is
        not a maximum of the weighted likelihood either: changing ξ rescales the weights and the objective with them.
        The 1997 value 0.0065 per half-week was chosen by prediction. This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Score</th>
              <th className="py-1.5 font-medium">Pull</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.parts.map((part) => (
              <tr key={part.score} className="border-t border-border">
                <td className="py-1.5 font-sans">{part.score}</td>
                <td className="py-1.5">{part.pull.toFixed(3)}</td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className="py-1.5 font-sans">Sum</td>
              <td className="py-1.5">{z.expectedScore.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-1.5 font-medium">Expected goals</th>
                <th className="py-1.5 font-medium">Match ρ</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {z.schedule.map((row) => (
                <tr key={row.total} className="border-t border-border">
                  <td className="py-1.5 font-sans">{row.total.toFixed(2)}</td>
                  <td className="py-1.5">{row.rho.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-1.5 font-medium">Matches</th>
                <th className="py-1.5 font-medium">SE(ρ)</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {[
                [100, z.se100],
                [400, z.se400],
                [1000, z.se1000],
              ].map(([n, se]) => (
                <tr key={n} className="border-t border-border">
                  <td className="py-1.5 font-sans">{n}</td>
                  <td className="py-1.5">{se.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DcAdjust({ lh, la, rho }: { lh: number; la: number; rho: number }) {
  const desk = dcAdjustment(lh, la, rho);
  const paper = dcAdjustment(1.31, 1, rho);
  const totals = dcAdjustment(lh, la, DC_RHO_TOTALS);
  const rows = [
    ["This ρ", desk],
    ["Totals ρ", totals],
    ["1982 rates", paper],
  ] as const;
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)} pp`;
  return (
    <section className="space-y-3" data-qa="dc-adjust">
      <h2 className="font-display text-xl">Adjustment</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        The whole correction is one probability, A = −λ μ ρ e<sup>−(λ+μ)</sup>. At the desk rates that is{" "}
        {pct(desk.gain, 2)}. It is added to 0–0 and to 1–1, and taken off 1–0 and 0–1. Draw moves by twice A.
        Home, away, both teams to score and Over 1.5 move by A. Over 2.5 moves by nothing, because every edited
        score is two goals or fewer. The relative lift is not the same size: 0–0 is multiplied by {desk.rel["0-0"] >= 0 ? "+" : ""}
        {(desk.rel["0-0"] * 100).toFixed(1)}%, while 1–1 is multiplied by exactly −ρ, {(desk.rel["1-1"] * 100).toFixed(1)}%,
        whatever the scoring rates are. The 1982 book (1.31 / 1.00) moves a little more in probability and a little
        less in percentage, because a lower-scoring match has a larger 0–0 to begin with. A match 180 days ago still
        carries {pct(dcDecay(180, DC_XI_PER_DAY), 0)} of its weight. Half-life {dcHalfLifeDays(DC_XI_PER_DAY).toFixed(0)} days.
        This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium" />
              <th className="py-1.5 font-medium">A</th>
              <th className="py-1.5 font-medium">0–0 lift</th>
              <th className="py-1.5 font-medium">1–1 lift</th>
              <th className="py-1.5 font-medium">Draw</th>
              <th className="py-1.5 font-medium">Over 2.5</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map(([label, z]) => (
              <tr key={label} className="border-t border-border">
                <td className="py-1.5 font-sans">{label}</td>
                <td className="py-1.5">{signed(z.gain)}</td>
                <td className="py-1.5">{(z.rel["0-0"] * 100).toFixed(1)}%</td>
                <td className="py-1.5">{(z.rel["1-1"] * 100).toFixed(1)}%</td>
                <td className="py-1.5">{signed(z.draw)}</td>
                <td className="py-1.5">{signed(z.over25)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DcGrid({ lh, la, rho }: { lh: number; la: number; rho: number }) {
  const z = dcGridDetail(lh, la, rho);
  const move = z.cells[0] ? z.cells[0].dc - z.cells[0].maher : 0;
  return (
    <section className="space-y-3" data-qa="dc-grid">
      <h2 className="font-display text-xl">Grid</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        τ is {z.cells.find((c) => c.score === "0-0")?.tau.toFixed(3)} at 0–0,{" "}
        {z.cells.find((c) => c.score === "1-0")?.tau.toFixed(3)} at 1–0,{" "}
        {z.cells.find((c) => c.score === "0-1")?.tau.toFixed(3)} at 0–1 and{" "}
        {z.cells.find((c) => c.score === "1-1")?.tau.toFixed(3)} at 1–1. Everywhere else it is 1. The four
        edits are the same size, {pp(move)}, and they cancel. A 2–1 stays on the Maher number. P(home = 0)
        stays {pct(z.home0.dc)}. The only mass missing from the 0…8 square is the Poisson tail,{" "}
        {((1 - z.maherMass) * 100).toFixed(3)} percentage points, and τ does not add to it. Over 2.5 only sees
        totals of 3 or more, so it is the same number at ρ = 0, at this ρ, and at the totals ρ. Draw and both
        teams to score move because 0–0 and 1–1 are draws and 1–1 is both teams scoring. This does not rank
        the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Score</th>
              <th className="py-1.5 font-medium">τ</th>
              <th className="py-1.5 font-medium">Maher</th>
              <th className="py-1.5 font-medium">Dixon–Coles</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.cells.map((c) => (
              <tr key={c.score} className="border-t border-border">
                <td className="py-1.5 font-sans">{c.score}</td>
                <td className="py-1.5">{c.tau.toFixed(3)}</td>
                <td className="py-1.5">{pct(c.maher, 2)}</td>
                <td className="py-1.5">{pct(c.dc, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Market</th>
              <th className="py-1.5 font-medium">Maher</th>
              <th className="py-1.5 font-medium">ρ {z.rho.toFixed(2)}</th>
              <th className="py-1.5 font-medium">Totals ρ {DC_RHO_TOTALS.toFixed(2)}</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {(
              [
                ["Home", "home"],
                ["Draw", "draw"],
                ["Away", "away"],
                ["BTTS", "btts"],
                ["Over 1.5", "over15"],
                ["Over 2.5", "over25"],
              ] as const
            ).map(([label, key]) => (
              <tr key={key} className="border-t border-border">
                <td className="py-1.5 font-sans">{label}</td>
                <td className="py-1.5">{pct(z.maher[key], 2)}</td>
                <td className="py-1.5">{pct(z.dc[key], 2)}</td>
                <td className="py-1.5">{pct(z.totals[key], 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DcRhoMap({ lh, la }: { lh: number; la: number }) {
  const z = dcRhoMap(lh, la);
  const frozen = z.rows.find((row) => row.name === "frozen");
  return (
    <section className="space-y-3" data-qa="dc-rho">
      <h2 className="font-display text-xl">Parameter scale</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Pearson on the goals is −ρ × {z.factor.toFixed(3)}. The factor is the square root of λμ times e to the power −(λ+μ).
        The frozen −0.130 is a correlation of {frozen ? signed(frozen.pearson) : ""}, not −0.13, and the covariance
        is {frozen ? frozen.cov.toFixed(4) : ""}. One more hundredth of negative ρ raises Pearson by{" "}
        {(z.factor / 100).toFixed(4)}. The legal range is {z.lo.toFixed(3)} to {z.hi.toFixed(3)}. At the lower edge
        Pearson is still only {signed(z.rows[0]!.pearson)}. The ten do not use −0.13 raw: a {(lh + la).toFixed(2)}-goal match is scaled
        to {z.rows[2]!.rho.toFixed(3)}, Pearson {signed(z.rows[2]!.pearson)}. φ is larger because it only looks at the
        four cells τ edits. This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">ρ</th>
              <th className="py-1.5 font-medium">Value</th>
              <th className="py-1.5 font-medium">Cov</th>
              <th className="py-1.5 font-medium">Pearson</th>
              <th className="py-1.5 font-medium">φ</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.rows.map((row) => (
              <tr key={row.name} className="border-t border-border">
                <td className="py-1.5 font-sans">{row.name}</td>
                <td className="py-1.5">{row.rho.toFixed(3)}</td>
                <td className="py-1.5">{row.cov.toFixed(4)}</td>
                <td className="py-1.5">{signed(row.pearson)}</td>
                <td className="py-1.5">{signed(row.phi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DcCorrelation({ lh, la, rho }: { lh: number; la: number; rho: number }) {
  const z = dcCorrelation(lh, la, rho);
  return (
    <section className="space-y-3" data-qa="dc-corr">
      <h2 className="font-display text-xl">Correlation</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        ρ is the low-score knob, not the correlation. At a negative ρ the four τ edits all push the
        same way: more 0–0, more 1–1, fewer 1–0 and 0–1. The two counts move together, so Pearson
        on the goals is positive while ρ is negative. Both-teams-score and both-blank are the same
        φ, because each indicator is the complement of the other. Karlis puts the covariance on
        every scoreline, λ₃ = {z.karlisCov.toFixed(2)}, so its correlation is larger. Dixon–Coles
        only touches the corner of the grid. The totals path uses ρ = {DC_RHO_TOTALS}, a shorter
        step of the same sign. This does not rank the ten.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat k="ρ" v={z.rho.toFixed(3)} n="parameter, not Corr(X, Y)" />
        <Stat k="Pearson" v={signed(z.dc.pearson)} n={`Maher ${signed(z.maher.pearson)}`} />
        <Stat k="φ both score" v={signed(z.dc.phiScore)} n={`both blank ${signed(z.dc.phiBlank)}`} />
        <Stat k="Karlis Pearson" v={signed(z.karlisPearson)} n={`cov ${z.karlisCov.toFixed(2)} vs DC ${z.dc.cov.toFixed(3)}`} />
      </div>
    </section>
  );
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(3)}`;
}

function ConditionalStructures({ lh, la, rho }: { lh: number; la: number; rho: number }) {
  const z = conditionalCorrelation(lh, la, rho);
  const bands = [
    ["Every score", z.bands.all],
    ["Total ≤ 2", z.bands.under],
    ["Total ≥ 3", z.bands.over],
    ["Total = 2", z.bands.exact],
  ] as const;
  return (
    <section className="space-y-3" data-qa="cond-corr">
      <h2 className="font-display text-xl">Conditional correlation</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        The Pearson above is one number for the whole match. Condition on something and it moves.
        Given the Karlis shock, the two counts are independent — the correlation is only the shock
        you did not see, and each extra home goal lifts expected away goals by {z.slope.toFixed(3)}.
        Given a total of exactly 2, away goals are what is left, so the correlation is −1 in every
        model. A band is not an exact total: staying under 2 forces a negative correlation even when
        the model is Maher. Dixon–Coles only edits home and away in {"{0, 1}"}. Past that corner the
        dependence ratio is 1, and the chance that away has 2+ given home has 2+ does not move.
        Karlis does move that tail. This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Slice</th>
              <th className="py-1.5 font-medium">Maher</th>
              <th className="py-1.5 font-medium">Dixon–Coles</th>
              <th className="py-1.5 font-medium">Karlis</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {bands.map(([label, row]) => (
              <tr key={label} className="border-t border-border">
                <td className="py-1.5 font-sans">{label}</td>
                <td className="py-1.5">{signed(row.maher)}</td>
                <td className="py-1.5">{signed(row.dc)}</td>
                <td className="py-1.5">{signed(row.karlis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Home goals</th>
              <th className="py-1.5 font-medium">E[away | home]</th>
              <th className="py-1.5 font-medium">Dixon–Coles</th>
              <th className="py-1.5 font-medium">Karlis</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.givenHome.map((row) => (
              <tr key={row.x} className="border-t border-border">
                <td className="py-1.5">{row.x}</td>
                <td className="py-1.5">{row.maher.toFixed(3)}</td>
                <td className="py-1.5">{row.dc.toFixed(3)}</td>
                <td className="py-1.5">{row.karlis.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Score</th>
              <th className="py-1.5 font-medium">Maher ratio</th>
              <th className="py-1.5 font-medium">Dixon–Coles</th>
              <th className="py-1.5 font-medium">Karlis</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.ratio.map((row) => (
              <tr key={row.score} className="border-t border-border">
                <td className="py-1.5 font-sans">{row.score}</td>
                <td className="py-1.5">{row.maher.toFixed(3)}</td>
                <td className="py-1.5">{row.dc.toFixed(3)}</td>
                <td className="py-1.5">{row.karlis.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        P(away ≥ 2 | home ≥ 2) is {pct(z.tail.maher.cond)} under Maher, the same under Dixon–Coles, and{" "}
        {pct(z.tail.karlis.cond)} under Karlis — a lift of {z.tail.karlis.lift.toFixed(2)} against the base rate.
        The ratio is the cell divided by the product of its margins. 1 is independence.
      </p>
    </section>
  );
}

function PoissonClosure({ lh, la }: { lh: number; la: number }) {
  const z = poissonClosure(lh, la);
  const o25 = z.lines.find((row) => row.line === 2.5)!;
  return (
    <div className="space-y-3" data-qa="poisson-closure">
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Add the two counts and the total is Poisson as well. λ {lh.toFixed(2)} + {la.toFixed(2)} ={" "}
        {z.total.toFixed(2)}. The convolution and the single Poisson differ by {z.gap.toExponential(1)}. No
        shared variance-to-mean is required — that condition was only for the negative binomial. Given{" "}
        {z.mode} goals, the home side is Binomial with share {pct(z.share, 1)}. Over 2.5 on the infinite sum
        is {pct(o25.over)}. The grid keeps 0…8 and renormalises, which moves that line by{" "}
        {pp(z.truncatedOver25 - z.rawOver25)} here
        {z.tailLost < 1e-4 ? " — the lost tail is noise" : ` — ${pct(z.tailLost, 2)} of the mass sat past 8`}.
        This is the Maher product. Dixon–Coles τ edits four low scores and then renormalises, so the total
        stops being Poisson. Not a rank.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {z.lines.map((row) => (
          <Stat key={row.line} k={`Over ${row.line.toFixed(1)}`} v={pct(row.over)} n="one Poisson on the total" />
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-border">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Given {z.mode} goals</th>
              <th className="px-3 py-2 font-medium">Binomial</th>
              <th className="px-3 py-2 font-medium">P(score | total)</th>
            </tr>
          </thead>
          <tbody>
            {z.splits.map((row) => (
              <tr key={`${row.home}-${row.away}`} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-mono tabular-nums">
                  {row.home}–{row.away}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.binomial, 2)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.conditional, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ k, v, n }: { k: string; v: string; n: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-3 shadow-border">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{k}</dt>
      <dd className="font-display text-2xl leading-tight tabular-nums">{v}</dd>
      <p className="text-xs text-muted-foreground">{n}</p>
    </div>
  );
}

function Param({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        <span className="font-mono text-sm tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        className="dc-range mt-1 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
