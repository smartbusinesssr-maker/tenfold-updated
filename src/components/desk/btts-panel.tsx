import { useMemo, useState, type ReactNode } from "react";
import { type DcSeed } from "@/components/desk/dixon-coles-panel";
import { ScorelineGrid } from "@/components/desk/scoreline-grid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  bttsPartsFromGrid,
  clampRho,
  copulaBttsParts,
  DC_RHO,
  FRANK_THETA,
  jointGrid,
  jointDependence,
  bivariatePoisson,
  trivariatePoisson,
  karlisCorrelation,
  KARLIS_COV,
  karlisBttsParts,
  LEAGUE_MEAN_AWAY,
  LEAGUE_MEAN_HOME,
  maherBttsParts,
  MAHER_HOME_ADV_1982,
  marketsFromGrid,
  rhoBounds,
} from "@/lib/football/models";
import { cn } from "@/lib/utils";

function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function tenths(p: number): number {
  return Math.round(p * 1000);
}

function fmtT(t: number): string {
  return `${(t / 10).toFixed(1)}%`;
}

function pp(n: number): string {
  const v = n * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} pp`;
}

function near(a: number, b: number, eps = 1e-3): boolean {
  return Math.abs(a - b) < eps;
}

export function BttsPanel({ seeds }: { seeds: DcSeed[] }) {
  const [lh, setLh] = useState(LEAGUE_MEAN_HOME);
  const [la, setLa] = useState(LEAGUE_MEAN_AWAY);
  const [rho, setRho] = useState(DC_RHO);
  const [cov, setCov] = useState(KARLIS_COV);
  const [theta, setTheta] = useState(FRANK_THETA);
  const [seedId, setSeedId] = useState<number | "desk">("desk");

  const bounds = rhoBounds(lh, la);
  const rhoLive = clampRho(rho, lh, la);

  const maher = useMemo(() => maherBttsParts(lh, la), [lh, la]);
  const karlis = useMemo(() => karlisBttsParts(lh, la, cov), [lh, la, cov]);
  const copula = useMemo(() => copulaBttsParts(lh, la, theta), [lh, la, theta]);
  const dcGrid = useMemo(() => jointGrid(lh, la, rhoLive), [lh, la, rhoLive]);
  const dc = useMemo(() => bttsPartsFromGrid(dcGrid), [dcGrid]);
  const dcMarkets = useMemo(() => marketsFromGrid(dcGrid), [dcGrid]);
  const joint = useMemo(() => jointDependence(lh, la, cov, theta), [lh, la, cov, theta]);
  const corr = useMemo(() => karlisCorrelation(lh, la, cov), [lh, la, cov]);
  const biv = useMemo(() => bivariatePoisson(lh, la, cov), [lh, la, cov]);
  const tri = useMemo(() => trivariatePoisson(lh, la, 10, cov), [lh, la, cov]);

  const residual = Math.abs(maher.btts - maher.product);
  const h0T = tenths(maher.pHome0);
  const a0T = tenths(maher.pAway0);
  const nT = tenths(maher.p00);
  const bT = 1000 - h0T - a0T + nT;
  const aoT = h0T - nT;
  const hoT = a0T - nT;

  const deskPreset =
    near(lh, LEAGUE_MEAN_HOME) && near(la, LEAGUE_MEAN_AWAY) && near(rho, DC_RHO) && near(cov, KARLIS_COV) && near(theta, FRANK_THETA);
  const independentPreset = near(rho, 0) && near(cov, 0) && near(theta, 0);
  const paperPreset = near(lh, MAHER_HOME_ADV_1982) && near(la, 1) && near(rho, DC_RHO);

  function applyDesk() {
    setLh(LEAGUE_MEAN_HOME);
    setLa(LEAGUE_MEAN_AWAY);
    setRho(DC_RHO);
    setCov(KARLIS_COV);
    setTheta(FRANK_THETA);
    setSeedId("desk");
  }

  function applyIndependent() {
    setRho(0);
    setCov(0);
    setTheta(0);
    setSeedId("desk");
  }

  function apply1982() {
    setLh(MAHER_HOME_ADV_1982);
    setLa(1);
    setRho(DC_RHO);
    setCov(KARLIS_COV);
    setSeedId("desk");
  }

  function applySeed(id: number) {
    const s = seeds.find((x) => x.id === id);
    if (!s) return;
    setLh(s.lambdaHome);
    setLa(s.lambdaAway);
    setRho(s.rho);
    setCov(KARLIS_COV);
    setSeedId(id);
  }

  return (
    <div id="btts-lab" data-qa="btts-lab" className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-display text-xl">BTTS derivation</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Both teams to score means home ≥ 1 and away ≥ 1. Same joint grid as 1X2 and correct score — not a new
          model. The ranked ten still use the Dixon–Coles region sum (30% of BTTS accuracy). This sandbox only
          walks the algebra.
        </p>
      </section>

      <Step n={1} title="Four outcomes, only one is BTTS">
        <p className="text-sm text-pretty text-muted-foreground">
          Home down, away across. The four cells are mutually exclusive and add to 100%.
        </p>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
          <span />
          <span className="text-center text-xs text-muted-foreground">Away blank</span>
          <span className="text-center text-xs text-muted-foreground">Away scores</span>
          <span className="self-center text-xs text-muted-foreground">Home blank</span>
          <Partition title="Neither" score="0-0" value={fmtT(nT)} note="counted in both shutouts" />
          <Partition title="Away only" score="0-k" value={fmtT(aoT)} note="home blank" />
          <span className="self-center text-xs text-muted-foreground">Home scores</span>
          <Partition title="Home only" score="k-0" value={fmtT(hoT)} note="away blank" />
          <Partition title="Both score" score="BTTS" value={fmtT(bT)} note="this is the event" tone="pitch" />
        </div>
      </Step>

      <Step n={2} title="Subtracting both shutouts removes 0-0 twice">
        <p className="text-sm text-pretty text-muted-foreground">
          Home blank is neither + away only. Away blank is neither + home only. Subtract both from 100% and
          neither has been taken out twice — add it back once.
        </p>
        <ol className="divide-y divide-border font-mono text-sm tabular-nums">
          <Worked op="" label="Start" value="100%" />
          <Worked
            op="−"
            label="Home blank  (neither + away only)"
            value={fmtT(h0T)}
          />
          <Worked
            op="−"
            label="Away blank  (neither + home only)"
            value={fmtT(a0T)}
          />
          <Worked op="+" label="Neither  (put 0-0 back once)" value={fmtT(nT)} />
          <Worked op="=" label="Both score" value={fmtT(bT)} emph />
        </ol>
        <p className="font-mono text-sm tabular-nums" data-qa="btts-identity">
          1 − {fmtT(h0T)} − {fmtT(a0T)} + {fmtT(nT)} = {fmtT(bT)}
        </p>
      </Step>

      <Step n={3} title="Independence is a shortcut, not a different formula">
        <p className="text-sm text-pretty text-muted-foreground">
          If home and away goals are independent, P(both) = P(home scores) × P(away scores). For Poisson that is
          (1 − e<sup>−λ</sup>)(1 − e<sup>−μ</sup>). It is the same identity, factored.
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat k="P(home scores)" v={pct(1 - maher.pHome0)} n="1 − e⁻λ" />
          <Stat k="P(away scores)" v={pct(1 - maher.pAway0)} n="1 − e⁻μ" />
          <Stat k="Product" v={pct(maher.product)} n="Maher closed form" />
          <Stat
            k="Vs identity"
            v={residual < 1e-12 ? "exact" : residual.toExponential(1)}
            n="product − inclusion"
          />
        </dl>
      </Step>

      <Step n={4} title="Karlis, Dixon–Coles and the copula reuse the identity. They only change the terms.">
        <p className="text-sm text-pretty text-muted-foreground">
          Karlis keeps the Poisson margins, so on the BTTS identity home-blank and away-blank do not move. Only
          0-0 rises, and BTTS rises with it. The score grid is a different object: the shared shock moves every
          cell and tightens the goal difference. Dixon–Coles τ moves four low-score cells. The Frank copula is
          not that shock.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-80 text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-1.5 font-medium">Term</th>
                <th className="py-1.5 font-medium">Maher</th>
                <th className="py-1.5 font-medium">Karlis</th>
                <th className="py-1.5 font-medium">Dixon–Coles</th>
                <th className="py-1.5 font-medium">Copula</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              <TermRow label="Home blank" maher={maher.pHome0} karlis={karlis.pHome0} dc={dc.pHome0} copula={copula.pHome0} />
              <TermRow label="Away blank" maher={maher.pAway0} karlis={karlis.pAway0} dc={dc.pAway0} copula={copula.pAway0} />
              <TermRow label="Neither 0-0" maher={maher.p00} karlis={karlis.p00} dc={dc.p00} copula={copula.p00} />
              <TermRow label="Both score" maher={maher.btts} karlis={karlis.btts} dc={dc.btts} copula={copula.btts} />
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Karlis BTTS {pct(karlis.btts)} ({pp(karlis.btts - maher.btts)} vs product). Dixon–Coles{" "}
          {pct(dc.btts)} ({pp(dc.btts - maher.btts)}). Frank copula θ = {theta.toFixed(1)} → {pct(copula.btts)} (
          {pp(copula.btts - maher.btts)}). θ = 0 makes the copula column match Maher.
        </p>
      </Step>

      <Step n={5} title="Karlis is a shared shock. The copula is Frank.">
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Write the goals as X = X₁ + X₃ and Y = X₂ + X₃, three independent Poissons. Covariance is λ₃, not a
          copula parameter. λ₁ + λ₃ is the home margin and λ₂ + λ₃ is the away margin, so the blanks stay
          e<sup>−λ</sup>. The shock cancels in the score difference: Var(X − Y) = λ₁ + λ₂ = λh + λa − 2λ₃.
          That tighter difference is how Karlis buys draws. Frank never writes a shock. A cell is the rectangle
          C(F(x), G(y)) − C(F(x−1), G(y)) − C(F(x), G(y−1)) + C(F(x−1), G(y−1)), and θ = 0 is independence.
          Positive θ lifts 0-0 and BTTS the way Karlis does, then moves 2-0 and 2-1 by a different amount. The
          score grid floors λ₃ at 0.02. The closed BTTS formula does not. This does not rank the ten.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-qa="btts-joint">
          <Stat k="λ₁ / λ₂ / λ₃" v={`${joint.l1.toFixed(2)} / ${joint.l2.toFixed(2)} / ${joint.l3.toFixed(2)}`} n="shock is the third rate" />
          <Stat k="GD variance" v={joint.gdVarKarlis.toFixed(2)} n={`independent ${joint.gdVarIndep.toFixed(2)} · minus 2λ₃`} />
          <Stat k="Draw, Karlis" v={pct(joint.karlis.draw)} n={`${pp(joint.karlis.draw - joint.maher.draw)} vs Maher`} />
          <Stat k="1-1 gap" v={pp(joint.karlis.p11 - joint.frank.p11)} n="Karlis minus Frank · not the same model" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-qa="karlis-corr">
          <Stat k="Pearson" v={signed3(corr.pearson)} n="λ₃ / √(μh μa), every score" />
          <Stat k="Grid Pearson" v={signed3(corr.gridPearson)} n="after the 0…8 cut" />
          <Stat k="φ both score" v={signed3(corr.phiScore)} n="indicator correlation, not the count" />
          <Stat k="λ₃ used" v={corr.l3.toFixed(3)} n={corr.l3 + 1e-9 < cov ? "clamped — means are too small" : "the shock you asked for"} />
        </div>
        <p className="text-xs text-muted-foreground">
          The correlation is not λ₃. At 1.38 / 1.12 a shock of 0.12 is Pearson +0.096. The same 0.12 at
          0.80 / 0.70 is +0.160. Below that the shock itself is cut, and what remains is a still larger share
          of a small total.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-80 text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-1.5 font-medium">Score</th>
                <th className="py-1.5 font-medium">Maher</th>
                <th className="py-1.5 font-medium">Karlis grid</th>
                <th className="py-1.5 font-medium">Frank</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {joint.cells.map((c) => (
                <tr key={c.score} className="border-t border-border">
                  <td className="py-1.5 font-sans">{c.score}</td>
                  <td className="py-1.5">{pct(c.maher)}</td>
                  <td className="py-1.5">
                    {pct(c.karlis)} <Delta vs={c.maher} value={c.karlis} />
                  </td>
                  <td className="py-1.5">
                    {pct(c.frank)} <Delta vs={c.maher} value={c.frank} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Closed Karlis λ₃ is {joint.closedL3.toFixed(2)}. The grid uses {joint.l3.toFixed(2)}.
          {Math.abs(joint.closedL3 - joint.l3) > 1e-9
            ? " They differ because the grid will not put the shock below 0.02."
            : " At this covariance they match."}
        </p>
      </Step>

      <Step n={6} title="Bivariate Poisson is three Poissons, not a copula.">
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          X = X₁ + X₃ and Y = X₂ + X₃. A cell sums the ways those goals could have been the shared one.
          k runs from 0 to the smaller score. k = 0 is two private tallies. The last term, when both sides
          scored, is the shock. Each margin stays Poisson, so its variance equals its mean, and the 0…8 grid
          matches that Poisson to noise at a league rate. The total does not. Var(X + Y) = λ₁ + λ₂ + 4λ₃, so
          the variance-to-mean sits above 1 even though neither margin does. A one-sided score cannot contain
          the shock, so 2–0 falls below the product of the margins while 0–0 rises. Covariance cannot be
          negative. Asking for 0 or for −0.05 both come back as λ₃ = {biv.floorL3.toFixed(2)}. This does not
          rank the ten.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-qa="biv-poisson">
          <Stat k="λ₁ / λ₂ / λ₃" v={`${biv.l1.toFixed(2)} / ${biv.l2.toFixed(2)} / ${biv.l3.toFixed(2)}`} n="three independent rates" />
          <Stat k="Total VMR" v={biv.vmrTotal.toFixed(3)} n={`var ${biv.varTotal.toFixed(2)} on mean ${biv.meanTotal.toFixed(2)}`} />
          <Stat k="GD variance" v={biv.varDiff.toFixed(2)} n={`independent ${(biv.meanH + biv.meanA).toFixed(2)}`} />
          <Stat k="0–0" v={pct(biv.p00, 2)} n={`product ${pct(biv.product00, 2)}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-1.5 font-medium">Score</th>
                <th className="py-1.5 font-medium">k = 0</th>
                <th className="py-1.5 font-medium">k = 1</th>
                <th className="py-1.5 font-medium">Joint</th>
                <th className="py-1.5 font-medium">Product</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {biv.cells
                .filter((c) => ["0-0", "1-1", "2-0", "2-1"].includes(c.score))
                .map((c) => (
                  <tr key={c.score} className="border-t border-border">
                    <td className="py-1.5 font-sans">{c.score}</td>
                    <td className="py-1.5">{pct(c.terms[0]?.p ?? 0, 2)}</td>
                    <td className="py-1.5">{c.terms[1] ? pct(c.terms[1].p, 2) : "—"}</td>
                    <td className="py-1.5">{pct(c.joint, 2)}</td>
                    <td className="py-1.5">{pct(c.product, 2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Home P(0) is {pct(biv.margins[0].closed, 2)} from the Poisson margin and {pct(biv.margins[0].grid, 2)} from
          the grid. The generating function is exp(λ₁(s−1) + λ₂(t−1) + λ₃(st−1)). The st term is the shock.
        </p>
      </Step>

      <Step n={7} title="A third count needs seven rates. The goal pair does not say which.">
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Corners are the third count, mean {tri.corners.toFixed(0)}. The goal pair stays the bivariate Poisson
          from the step above, so 1–1 has the same probability in every column. An independent corner Poisson
          ignores the score. Putting the goal shock into pairwise corner shocks, or into one triple shock, leaves
          all three covariances equal and the home-goal correlation with corners at{" "}
          {signed3(tri.triple.corrHC)}. The third cumulant does not. Pairwise shocks have κ = 0, so a 2–0 can
          still bring a corner. The triple shock has κ = {tri.triple.kappa.toFixed(2)}, so a 2–0 rules it out and
          corners stay at the private rate, the same as a 0–0. A 2–2 lifts corners further under the triple shock,
          because that shock is the only one and it adds a corner. κ cannot exceed the smallest covariance. Home,
          away and the goal total are not this distribution: the total has variance {tri.varTotal.toFixed(2)} on a
          mean of {tri.meanTotal.toFixed(2)}. These corner shocks match the goal shock so the structures can be
          compared. They are not a fit, and they do not rank the ten.
        </p>
        <div className="overflow-x-auto" data-qa="tri-poisson">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-1.5 font-medium">Score</th>
                <th className="py-1.5 font-medium">Independent</th>
                <th className="py-1.5 font-medium">Pairwise κ = 0</th>
                <th className="py-1.5 font-medium">Triple κ = {tri.triple.kappa.toFixed(2)}</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {tri.independent.cells.map((c: { score: string; meanC: number; over10: number }) => {
                const pair = tri.pairwise.cells.find((row: { score: string; meanC: number }) => row.score === c.score)!;
                const trip = tri.triple.cells.find((row: { score: string; meanC: number }) => row.score === c.score)!;
                return (
                  <tr key={c.score} className="border-t border-border">
                    <td className="py-1.5 font-sans">{c.score}</td>
                    <td className="py-1.5">{c.meanC.toFixed(2)}</td>
                    <td className="py-1.5">{pair.meanC.toFixed(2)}</td>
                    <td className="py-1.5">{trip.meanC.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Expected corners given the score. P(corners ≥ 10) at 0–0 is {pct(tri.independent.cells[0].over10)} if
          corners ignore the goals, {pct(tri.pairwise.cells[0].over10)} with pairwise shocks, and{" "}
          {pct(tri.triple.cells[0].over10)} with the triple shock. At 2–2 those three are{" "}
          {pct(tri.independent.cells[3].over10)}, {pct(tri.pairwise.cells[3].over10)} and{" "}
          {pct(tri.triple.cells[3].over10)}.
        </p>
      </Step>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={deskPreset ? "default" : "outline"} onClick={applyDesk}>
          Desk league
        </Button>
        <Button size="sm" variant={paperPreset && !deskPreset ? "default" : "outline"} onClick={apply1982}>
          1982 average
        </Button>
        <Button size="sm" variant={independentPreset ? "default" : "outline"} onClick={applyIndependent}>
          Independent (ρ = 0, c = 0)
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
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Move the terms</p>
          <Param
            label="λ home"
            value={lh}
            min={0.4}
            max={3.2}
            step={0.02}
            format={(n) => n.toFixed(2)}
            onChange={(n) => {
              setLh(n);
              setSeedId("desk");
            }}
          />
          <Param
            label="λ away"
            value={la}
            min={0.3}
            max={3.0}
            step={0.02}
            format={(n) => n.toFixed(2)}
            onChange={(n) => {
              setLa(n);
              setSeedId("desk");
            }}
          />
          <Param
            label="ρ Dixon–Coles"
            value={rhoLive}
            min={bounds.lo}
            max={bounds.hi}
            step={0.005}
            format={(n) => n.toFixed(3)}
            onChange={(n) => {
              setRho(n);
              setSeedId("desk");
            }}
            hint="τ only on 0-0, 1-0, 0-1, 1-1. Of those, only 1-1 is BTTS."
          />
          <Param
            label="c Karlis covariance"
            value={cov}
            min={0}
            max={0.35}
            step={0.01}
            format={(n) => n.toFixed(2)}
            onChange={(n) => {
              setCov(n);
              setSeedId("desk");
            }}
            hint="Closed BTTS only moves 0-0. The grid is X = X₁+X₃ and floors λ₃ at 0.02."
          />
          <Param
            label="θ Frank copula"
            value={theta}
            min={0}
            max={4}
            step={0.1}
            format={(n) => n.toFixed(1)}
            onChange={(n) => {
              setTheta(n);
              setSeedId("desk");
            }}
            hint="θ = 0 is independence. Dependence hits every cell, not a shared count."
          />
        </div>

        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Dixon–Coles grid · BTTS ringed</p>
          <ScorelineGrid
            heat={dcMarkets.heat}
            highlight=""
            region="btts"
            caption="Ringed cells are both score. Faded row 0 and column 0 are the shutouts from step 2."
          />
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl bg-card p-4 shadow-border" data-qa={`btts-step-${n}`}>
      <h3 className="flex items-baseline gap-3 text-balance font-display text-lg">
        <span className="font-mono text-sm text-pitch tabular-nums">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Partition({
  title,
  score,
  value,
  note,
  tone = "muted",
}: {
  title: string;
  score: string;
  value: string;
  note: string;
  tone?: "pitch" | "muted";
}) {
  return (
    <div className={cn("rounded-lg p-3", tone === "pitch" ? "bg-pitch/15" : "bg-muted")}>
      <p className="text-xs text-muted-foreground">{score}</p>
      <p className="font-display text-lg leading-tight">{title}</p>
      <p className="mt-1 font-mono text-sm tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Worked({
  op,
  label,
  value,
  emph,
}: {
  op: string;
  label: string;
  value: string;
  emph?: boolean;
}) {
  return (
    <li className={cn("flex items-baseline gap-3 py-1.5", emph ? "text-foreground" : "text-muted-foreground")}>
      <span className="w-4 shrink-0 text-foreground">{op}</span>
      <span className="min-w-0 flex-1 text-pretty">{label}</span>
      <span className={cn("tabular-nums", emph ? "text-foreground" : null)}>{value}</span>
    </li>
  );
}

function TermRow({
  label,
  maher,
  karlis,
  dc,
  copula,
}: {
  label: string;
  maher: number;
  karlis: number;
  dc: number;
  copula: number;
}) {
  return (
    <tr className="border-t border-border">
      <td className="py-1.5 font-sans">{label}</td>
      <td className="py-1.5">{pct(maher)}</td>
      <td className="py-1.5">
        {pct(karlis)} <Delta vs={maher} value={karlis} />
      </td>
      <td className="py-1.5">
        {pct(dc)} <Delta vs={maher} value={dc} />
      </td>
      <td className="py-1.5">
        {pct(copula)} <Delta vs={maher} value={copula} />
      </td>
    </tr>
  );
}

function Delta({ vs, value }: { vs: number; value: number }) {
  if (Math.abs(value - vs) < 5e-4) {
    return <span className="text-xs text-muted-foreground">same</span>;
  }
  return <span className="text-xs text-muted-foreground">{pp(value - vs)}</span>;
}

function signed3(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(3)}`;
}

function Stat({ k, v, n }: { k: string; v: string; n: string }) {
  return (
    <div>
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
