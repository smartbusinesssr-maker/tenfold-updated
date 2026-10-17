import { useMemo, useState } from "react";
import { ScorelineGrid } from "@/components/desk/scoreline-grid";
import { type DcSeed } from "@/components/desk/dixon-coles-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DESK_MAHER_PARAMS,
  DC_RHO,
  jointGrid,
  maherBttsClosed,
  maherBaseline,
  maherCell,
  maherFromLambdas,
  maherLambdas,
  maherOver15,
  maherOver25Closed,
  MAHER_HOME_ADV,
  MAHER_HOME_ADV_1982,
  marketsFromGrid,
  PAPER_MAHER_PARAMS,
  cmpTrace,
  poissonAltTrace,
  poissonPmf,
  type MaherParams,
} from "@/lib/football/models";
import { cn } from "@/lib/utils";

function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function pp(n: number): string {
  const v = n * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} pp`;
}

function near(a: number, b: number, eps = 1e-3): boolean {
  return Math.abs(a - b) < eps;
}

function sameParams(a: MaherParams, b: MaherParams): boolean {
  return (
    near(a.attackHome, b.attackHome) &&
    near(a.defenceAway, b.defenceAway) &&
    near(a.attackAway, b.attackAway) &&
    near(a.defenceHome, b.defenceHome) &&
    near(a.homeAdv, b.homeAdv)
  );
}

function MaherBase() {
  const z = maherBaseline();
  const rows = [
    ["λ home", z.desk.lambdaH, z.paper.lambdaH],
    ["λ away", z.desk.lambdaA, z.paper.lambdaA],
    ["Total", z.desk.total, z.paper.total],
    ["0–0", z.desk.p00, z.paper.p00],
    ["1–1", z.desk.cell11, z.paper.cell11],
    ["Home", z.desk.grid.home, z.paper.grid.home],
    ["Draw", z.desk.grid.draw, z.paper.grid.draw],
    ["Away", z.desk.grid.away, z.paper.grid.away],
    ["BTTS", z.desk.btts, z.paper.btts],
    ["Over 1.5", z.desk.over15, z.paper.over15],
    ["Over 2.5", z.desk.over25, z.paper.over25],
  ] as const;
  return (
    <section className="space-y-3" data-qa="maher-base">
      <h2 className="font-display text-xl">Baseline</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Two frozen books, both with defence pinned at 1. The desk sets home attack to {z.attackHome.toFixed(2)} and
        γ to {z.desk.gamma.toFixed(3)}, so the means come back as {z.desk.lambdaH.toFixed(2)} and{" "}
        {z.desk.lambdaA.toFixed(2)}. The 1982 average team is attack = defence = 1 and γ = {z.paper.gamma.toFixed(2)},
        so the means are {z.paper.lambdaH.toFixed(2)} and {z.paper.lambdaA.toFixed(2)}. That is a larger home edge
        on a lower-scoring match: the total falls from {z.desk.total.toFixed(2)} to {z.paper.total.toFixed(2)}, and
        Over 2.5 falls from {pct(z.desk.over25, 2)} to {pct(z.paper.over25, 2)}. The 1–1 cell is exactly P(H=1) P(A=1),{" "}
        {pct(z.desk.cell11, 2)} on the desk book. The 0…8 grid and the infinite Skellam agree on the draw at{" "}
        {pct(z.desk.grid.draw, 2)}. Totals keep this grid at {pct(z.ouWeight, 0)}. This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium" />
              <th className="py-1.5 font-medium">Desk</th>
              <th className="py-1.5 font-medium">1982</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map(([label, desk, paper]) => (
              <tr key={label} className="border-t border-border">
                <td className="py-1.5 font-sans">{label}</td>
                <td className="py-1.5">{label.startsWith("λ") || label === "Total" ? desk.toFixed(2) : pct(desk, 2)}</td>
                <td className="py-1.5">{label.startsWith("λ") || label === "Total" ? paper.toFixed(2) : pct(paper, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CmpTrace() {
  const z = cmpTrace();
  const mild = z.rows[1];
  const over = z.rows[2];
  const under = z.rows[3];
  return (
    <section className="space-y-3" data-qa="cmp-trace">
      <h2 className="font-display text-xl">Conway–Maxwell–Poisson</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        P(k) ∝ λ<sup>k</sup> / (k!)<sup>ν</sup>. ν = 1 is Poisson. ν below 1 is overdispersed, ν above 1 is
        underdispersed. λ in that weight is not the mean. At ν = 0.85, leaving λ at 1.38 lifts the mean to{" "}
        {over.unmatched.toFixed(2)}. Solving λ so the mean stays 1.38 puts it at {over.rate.toFixed(2)}, and the
        variance-to-mean ratio is {over.vmr.toFixed(3)}, not 1/ν. Over 2.5 then moves from {pct(z.poisson.over25, 2)} to{" "}
        {pct(over.over25, 2)}. The Yip-sized ν = {mild.nu.toFixed(3)} only reaches a variance ratio of {mild.vmr.toFixed(3)}{" "}
        and Over 2.5 of {pct(mild.over25, 2)}. Both-teams-to-score is what moves: {pct(z.poisson.btts, 2)} at ν = 1,{" "}
        {pct(over.btts, 2)} at 0.85, {pct(under.btts, 2)} at 1.15. The totals blend does not use this. This does not
        rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">ν</th>
              <th className="py-1.5 font-medium">λ</th>
              <th className="py-1.5 font-medium">VMR</th>
              <th className="py-1.5 font-medium">P(0)</th>
              <th className="py-1.5 font-medium">BTTS</th>
              <th className="py-1.5 font-medium">Over 2.5</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.rows.map((row) => (
              <tr key={row.nu} className="border-t border-border">
                <td className="py-1.5">{row.nu.toFixed(3)}</td>
                <td className="py-1.5">{row.rate.toFixed(3)}</td>
                <td className="py-1.5">{row.vmr.toFixed(3)}</td>
                <td className="py-1.5">{pct(row.p0, 2)}</td>
                <td className="py-1.5">{pct(row.btts, 2)}</td>
                <td className="py-1.5">{pct(row.over25, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PoissonAlt() {
  const z = poissonAltTrace();
  const rows = [
    ["Poisson", z.poisson, "0.10"],
    ["NB r = 18", z.nb18, "0.12"],
    ["NB r = 3.5", z.nb35, "floor"],
    ["ZIP π = 0.05", z.zip, "out"],
    ["Weibull 0.9", z.weibull, "0"],
  ] as const;
  return (
    <section className="space-y-3" data-qa="poi-alt">
      <h2 className="font-display text-xl">Regression</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Quasi-Poisson keeps the Poisson score and multiplies the standard error by √1.04, so a price does not
        move. Negative binomial divides the score by 1 + μ/r. A 5-goal match at μ = 1.38 pulls the log-mean by{" "}
        {z.pull.poisson.toFixed(2)} under Poisson, {z.pull.nb18.toFixed(2)} at r = 18, and {z.pull.nb35.toFixed(2)} at
        the floor r = 3.5. At r = 18 the variance-to-mean ratio is {z.vmr18.toFixed(3)}, a little heavier than Yip’s
        1.04, and Over 2.5 only moves from {pct(z.poisson.over25, 2)} to {pct(z.nb18.over25, 2)}. The r = 3.5 floor
        and the ZIP both cut both-teams-to-score by several points because they add zeros. Weibull shape 0.9 cuts
        it to {pct(z.weibull.btts, 2)} and is then given weight 0. This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Model</th>
              <th className="py-1.5 font-medium">Draw</th>
              <th className="py-1.5 font-medium">BTTS</th>
              <th className="py-1.5 font-medium">Over 1.5</th>
              <th className="py-1.5 font-medium">Over 2.5</th>
              <th className="py-1.5 font-medium">Totals weight</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map(([label, m, w]) => (
              <tr key={label} className="border-t border-border">
                <td className="py-1.5 font-sans">{label}</td>
                <td className="py-1.5">{pct(m.draw, 2)}</td>
                <td className="py-1.5">{pct(m.btts, 2)}</td>
                <td className="py-1.5">{pct(m.over15, 2)}</td>
                <td className="py-1.5">{pct(m.over25, 2)}</td>
                <td className="py-1.5 font-sans">{w}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Match rate</th>
              <th className="py-1.5 font-medium">NB r = 18 / Poisson</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            <tr className="border-t border-border">
              <td className="py-1.5 font-sans">0.80</td>
              <td className="py-1.5">{z.weight.quiet.toFixed(3)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5 font-sans">1.38</td>
              <td className="py-1.5">{z.weight.league.toFixed(3)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5 font-sans">3.20</td>
              <td className="py-1.5">{z.weight.hot.toFixed(3)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5 font-sans">3.20 at r = 3.5</td>
              <td className="py-1.5">{z.weight.hotFloor.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MaherPanel({ seeds }: { seeds: DcSeed[] }) {
  const [p, setP] = useState<MaherParams>(DESK_MAHER_PARAMS);
  const [seedId, setSeedId] = useState<number | "desk">("desk");

  const { lambdaH, lambdaA } = maherLambdas(p);
  const maher = useMemo(() => marketsFromGrid(jointGrid(lambdaH, lambdaA, 0)), [lambdaH, lambdaA]);
  const dc = useMemo(() => marketsFromGrid(jointGrid(lambdaH, lambdaA, DC_RHO)), [lambdaH, lambdaA]);
  const bttsClosed = maherBttsClosed(lambdaH, lambdaA);
  const ou15Closed = maherOver15(lambdaH, lambdaA);
  const ou25Closed = maherOver25Closed(lambdaH, lambdaA);

  const cells = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const;
  const productCells = cells.map(([h, a]) => {
    const product = maherCell(lambdaH, lambdaA, h, a);
    const gridP = maher.heat.find((c) => c.home === h && c.away === a)?.p ?? 0;
    const dcP = dc.heat.find((c) => c.home === h && c.away === a)?.p ?? 0;
    return { score: `${h}-${a}`, product, gridP, dcP, ratio: product > 1e-12 ? gridP / product : 1 };
  });

  function patch(next: Partial<MaherParams>) {
    setP((cur) => ({ ...cur, ...next }));
    setSeedId("desk");
  }

  function applyDesk() {
    setP(DESK_MAHER_PARAMS);
    setSeedId("desk");
  }

  function apply1982() {
    setP(PAPER_MAHER_PARAMS);
    setSeedId("desk");
  }

  function applySeed(id: number) {
    const s = seeds.find((x) => x.id === id);
    if (!s) return;
    setP(maherFromLambdas(s.lambdaHome, s.lambdaAway));
    setSeedId(id);
  }

  const readouts: Array<[string, number, number, string]> = [
    ["Home", maher.home, dc.home, "vs DC"],
    ["Draw", maher.draw, dc.draw, "vs DC"],
    ["Away", maher.away, dc.away, "vs DC"],
    ["BTTS yes", maher.bttsYes, bttsClosed, "vs closed"],
    ["Over 1.5", maher.over15, ou15Closed, "vs closed"],
    ["Over 2.5", maher.over25, ou25Closed, "vs closed"],
  ];

  const homePmf = [0, 1, 2, 3, 4].map((k) => poissonPmf(k, lambdaH));
  const awayPmf = [0, 1, 2, 3, 4].map((k) => poissonPmf(k, lambdaA));

  return (
    <div id="maher-lab" data-qa="maher-lab" className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-display text-xl">Maher independent Poisson</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Sandbox only. Totals mix this independent grid at 10% beside Dixon–Coles at 50%. Maher (1982) writes
          home and away goals as independent Poissons: λ = α<sub>h</sub> β<sub>a</sub> γ, μ = α<sub>a</sub> β<sub>h</sub>.
          The joint cell is the product P(H=x) P(A=y). That product is the baseline the other grids are
          measured against.
        </p>
      </section>

      <MaherBase />
      <PoissonAlt />
      <CmpTrace />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="λ home" v={lambdaH.toFixed(2)} n="α_h × β_a × γ" />
        <Stat k="λ away" v={lambdaA.toFixed(2)} n="α_a × β_h" />
        <Stat k="γ" v={p.homeAdv.toFixed(3)} n={`desk ${MAHER_HOME_ADV.toFixed(3)}`} />
        <Stat k="BTTS closed" v={pct(bttsClosed)} n="(1−e^{−λ})(1−e^{−μ})" />
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={sameParams(p, DESK_MAHER_PARAMS) ? "default" : "outline"} onClick={applyDesk}>
          Desk league
        </Button>
        <Button size="sm" variant={sameParams(p, PAPER_MAHER_PARAMS) ? "default" : "outline"} onClick={apply1982}>
          1982 average (γ {MAHER_HOME_ADV_1982})
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
        <p className="text-xs text-muted-foreground">Run the desk to seed attack/defence from today’s fold.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <p className="font-mono text-xs text-muted-foreground">
            λ = {p.attackHome.toFixed(2)} × {p.defenceAway.toFixed(2)} × {p.homeAdv.toFixed(3)} = {lambdaH.toFixed(2)}
            <br />μ = {p.attackAway.toFixed(2)} × {p.defenceHome.toFixed(2)} = {lambdaA.toFixed(2)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Param
              label="α home attack"
              value={p.attackHome}
              min={0.5}
              max={2.2}
              step={0.02}
              format={(n) => n.toFixed(2)}
              onChange={(n) => patch({ attackHome: n })}
            />
            <Param
              label="α away attack"
              value={p.attackAway}
              min={0.5}
              max={2.2}
              step={0.02}
              format={(n) => n.toFixed(2)}
              onChange={(n) => patch({ attackAway: n })}
            />
            <Param
              label="β away defence"
              value={p.defenceAway}
              min={0.5}
              max={2.0}
              step={0.02}
              format={(n) => n.toFixed(2)}
              onChange={(n) => patch({ defenceAway: n })}
              hint="> 1 = leaky away defence"
            />
            <Param
              label="β home defence"
              value={p.defenceHome}
              min={0.5}
              max={2.0}
              step={0.02}
              format={(n) => n.toFixed(2)}
              onChange={(n) => patch({ defenceHome: n })}
            />
          </div>
          <Param
            label="γ home advantage"
            value={p.homeAdv}
            min={1.0}
            max={1.6}
            step={0.001}
            format={(n) => n.toFixed(3)}
            onChange={(n) => patch({ homeAdv: n })}
            hint={`desk ${MAHER_HOME_ADV.toFixed(3)} · 1982-style ${MAHER_HOME_ADV_1982}`}
          />
        </div>

        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Independent joint vs Dixon–Coles</p>
          <ScorelineGrid
            heat={maher.heat}
            highlight={maher.scoreline}
            caption="Home goals down · away across · independent Poisson P(H,A). Modal cells are typically 8–14%."
          />
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="mb-1 text-muted-foreground">P(H = k)</p>
              <ul className="space-y-1">
                {homePmf.map((v, k) => (
                  <li key={`h-${k}`} className="grid grid-cols-[1.5rem_1fr_2.5rem] items-center gap-2">
                    <span className="font-mono text-muted-foreground tabular-nums">{k}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-pitch" style={{ width: `${Math.round(v * 100)}%` }} />
                    </div>
                    <span className="text-right font-mono tabular-nums">{pct(v, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-muted-foreground">P(A = k)</p>
              <ul className="space-y-1">
                {awayPmf.map((v, k) => (
                  <li key={`a-${k}`} className="grid grid-cols-[1.5rem_1fr_2.5rem] items-center gap-2">
                    <span className="font-mono text-muted-foreground tabular-nums">{k}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-pitch" style={{ width: `${Math.round(v * 100)}%` }} />
                    </div>
                    <span className="text-right font-mono tabular-nums">{pct(v, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ul className="divide-y divide-border text-sm">
            {readouts.map(([label, a, b, vs]) => (
              <li key={label} className="flex items-center justify-between py-1.5">
                <span>{label}</span>
                <span className="font-mono tabular-nums">
                  {pct(a)}{" "}
                  <span className="text-muted-foreground">
                    {pp(a - b)} {vs}
                  </span>
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between py-1.5">
              <span>Modal CS</span>
              <span className="font-mono tabular-nums">
                {maher.scoreline} {pct(maher.scorelineP)}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-4 shadow-border">
          <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">Independence P(x)P(y)</p>
          <p className="mb-3 text-sm text-pretty text-muted-foreground">
            Untruncated product vs the truncated 8×8 grid (ratio ≈ 1) vs Dixon–Coles. Maher under-calls the draw by{" "}
            {pp(dc.draw - maher.draw)}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {productCells.map((c) => (
              <div key={c.score} className="rounded-lg bg-muted p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-2xl leading-none">{c.score}</span>
                  <span
                    className={cn(
                      "font-mono text-sm tabular-nums",
                      c.dcP - c.product > 0.0005
                        ? "text-pitch"
                        : c.dcP - c.product < -0.0005
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {pp(c.dcP - c.product)} DC
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground tabular-nums">
                  product {pct(c.product)} · grid {pct(c.gridP)} · ratio {c.ratio.toFixed(3)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Ratio ≠ 1 only because the 8×8 grid renormalises the Poisson tail. The infinite product is exact
            independence. BTTS closed form is that product of two survival functions — no τ, no covariance.
          </p>
        </div>

        <div className="rounded-xl bg-card p-4 shadow-border">
          <p className="mb-3 text-xs tracking-wide text-muted-foreground uppercase">What 1982 showed</p>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="text-foreground">Conditional Poisson.</span> Pooled scores look overdispersed. Maher
              showed that is mix over match means, not a failure of Poisson given λ, μ.
            </li>
            <li>
              <span className="text-foreground">Attack × defence.</span> Team α, β beat a constant-rate model. Home
              advantage is a common γ (later work writes it as k² on the away mean). The desk’s γ is{" "}
              {MAHER_HOME_ADV.toFixed(3)}.
            </li>
            <li>
              <span className="text-foreground">Independence is the miss.</span> Draws — especially 0-0 and 1-1 — are
              more common than the product allows. Dixon–Coles τ (1997) and Karlis covariance (2003) are the
              corrections. This grid is not in the correct-score blend — independence would pull 1-1 down.
            </li>
            <li>
              <span className="text-foreground">1X2 is Skellam.</span> Home minus away under independence is Skellam
              with those λ, μ — Bessel I_|k| or the Poisson convolution, same mass. The desk now uses the
              untruncated convolution for 1X2, not the 8×8 sum.
            </li>
          </ul>
        </div>
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
