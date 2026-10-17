import { useMemo, useState } from "react";
import { type DcSeed } from "@/components/desk/dixon-coles-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BAIO_KAPPA,
  BTTS_HIER_KAPPA,
  hierarchicalBtts,
  hierarchicalTrace,
  LEAGUE_MEAN_AWAY,
  LEAGUE_MEAN_HOME,
  maherBttsClosed,
} from "@/lib/football/models";
import { MCMC_STEP, runBttsMcmc } from "@/lib/football/mcmc";
import { runBttsVi } from "@/lib/football/vi";
import { DSM_SIGMA, runBttsScoreMatch } from "@/lib/football/score-matching";
import { cn } from "@/lib/utils";

function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function HierarchyBlock() {
  const z = hierarchicalTrace();
  const at = (n: number) => z.perfect.find((row: { n: number }) => row.n === n)!;
  const five = at(5);
  const ten = at(10);
  return (
    <section className="space-y-3" data-qa="hier-bayes">
      <h2 className="font-display text-xl">Hierarchy</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Two levels, both partial pools. A side observed at {z.observed.toFixed(2)} goals, league{" "}
        {z.leagueH.toFixed(2)}, is not left at {z.observed.toFixed(2)}. Five matches and κ = 6 — the thin-season
        rule — leave λ at {z.lambda[0].lambda.toFixed(2)}. Eight matches with last-five present, κ = 2.2, leave
        it at {z.lambda[1].lambda.toFixed(2)}. BTTS sits on top of the Poisson probability,{" "}
        {pct(five.prior)}. Five meetings that all had both teams scoring land at {pct(five.partial)}, and the
        95% interval {pct(five.lo)}–{pct(five.hi)} still covers the prior. Ten such meetings are the first row
        that does not: {pct(ten.lo)}–{pct(ten.hi)}. The logit pool stays near {pct(at(20).logit)} even at 20/20,
        because a rate of 1 has no binomial variance and the formula floors it. 1X2 uses κ = 5, so the same
        five perfect meetings would be {pct(z.win5.partial)} instead of {pct(five.partial)}. Five blanks go the
        other way, to {pct(z.blank5.partial)}. This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">H2H, all both-score</th>
              <th className="py-1.5 font-medium">Weight on data</th>
              <th className="py-1.5 font-medium">Posterior</th>
              <th className="py-1.5 font-medium">95%</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {z.perfect.map((row: { n: number; weight: number; partial: number; lo: number; hi: number }) => (
              <tr key={row.n} className="border-t border-border">
                <td className="py-1.5 font-sans">{row.n === 0 ? "none" : `${row.n}/${row.n}`}</td>
                <td className="py-1.5">{pct(row.weight, 0)}</td>
                <td className="py-1.5">{pct(row.partial)}</td>
                <td className="py-1.5">
                  {pct(row.lo)}–{pct(row.hi)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BaioPanel({ seeds }: { seeds: DcSeed[] }) {
  const [lh, setLh] = useState(LEAGUE_MEAN_HOME);
  const [la, setLa] = useState(LEAGUE_MEAN_AWAY);
  const [kappa, setKappa] = useState(BTTS_HIER_KAPPA);
  const [h2hN, setH2hN] = useState(4);
  const [h2hRate, setH2hRate] = useState(0.5);
  const [seedId, setSeedId] = useState<number | "desk">("desk");
  const [step, setStep] = useState(MCMC_STEP);

  const hits = h2hRate * h2hN;
  const hier = useMemo(
    () =>
      hierarchicalBtts({
        lambdaH: lh,
        lambdaA: la,
        leagueHome: LEAGUE_MEAN_HOME,
        leagueAway: LEAGUE_MEAN_AWAY,
        h2hHits: hits,
        h2hN,
        kappa,
      }),
    [lh, la, hits, h2hN, kappa],
  );

  const mcmc = useMemo(
    () =>
      runBttsMcmc({
        alpha: hier.alpha,
        beta: hier.beta,
        mu: hier.hyperMean,
        hits,
        n: h2hN,
        step,
        seed: 7,
      }),
    [hier.alpha, hier.beta, hier.hyperMean, hits, h2hN, step],
  );

  const vi = useMemo(
    () =>
      runBttsVi({
        alpha: hier.alpha,
        beta: hier.beta,
        mu: hier.hyperMean,
        hits,
        n: h2hN,
      }),
    [hier.alpha, hier.beta, hier.hyperMean, hits, h2hN],
  );

  const sm = useMemo(
    () =>
      runBttsScoreMatch({
        alpha: hier.alpha,
        beta: hier.beta,
        elboM: vi.conjugate.m,
        elboS: vi.conjugate.s,
        seed: 11,
      }),
    [hier.alpha, hier.beta, vi.conjugate.m, vi.conjugate.s],
  );

  function applySeed(id: number) {
    const s = seeds.find((x) => x.id === id);
    if (!s) return;
    setLh(s.lambdaHome);
    setLa(s.lambdaAway);
    setSeedId(id);
  }

  function applyDesk() {
    setLh(LEAGUE_MEAN_HOME);
    setLa(LEAGUE_MEAN_AWAY);
    setKappa(BTTS_HIER_KAPPA);
    setH2hN(4);
    setH2hRate(0.5);
    setSeedId("desk");
  }

  function applyNoPool() {
    setKappa(0.25);
  }

  function applyComplete() {
    setKappa(24);
    setH2hN(0);
  }

  const loPct = hier.lo * 100;
  const hiPct = hier.hi * 100;
  const midPct = hier.partial * 100;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="font-display text-2xl">Baio hierarchy · BTTS</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Baio & Blangiardo (2010): attack and defence are random effects shrunk toward a league
          mean (κ = {BAIO_KAPPA} on λ). BTTS sits one level up — a Beta–Binomial on the probability.
          Complete pooling is the league rate. No pooling is the H2H MLE. Partial pooling is what the
          ten use — the conjugate Beta mean, not a Gibbs chain. Baio ran WinBUGS because 20-team
          attack/defence is not conjugate. The sampler below is.
        </p>
      </header>

      <HierarchyBlock />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={seedId === "desk" ? "secondary" : "outline"} onClick={applyDesk}>
          Desk κ = {BTTS_HIER_KAPPA}
        </Button>
        <Button size="sm" variant="outline" onClick={applyNoPool}>
          No pooling
        </Button>
        <Button size="sm" variant="outline" onClick={applyComplete}>
          Complete pooling
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
            max={3.2}
            step={0.02}
            format={(n) => n.toFixed(2)}
            onChange={(n) => {
              setLh(n);
              setSeedId("desk");
            }}
            hint={`Poisson BTTS ${pct(hier.poisson)} · already Baio-shrunk on λ`}
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
            label="κ prior matches"
            value={kappa}
            min={0.25}
            max={24}
            step={0.25}
            format={(n) => n.toFixed(2)}
            onChange={setKappa}
            hint={`Weight on data n/(n+κ) = ${pct(hier.weightData, 0)}. Baio used ${BAIO_KAPPA} on λ.`}
          />
          <Param
            label="H2H matches n"
            value={h2hN}
            min={0}
            max={20}
            step={1}
            format={(n) => n.toFixed(0)}
            onChange={setH2hN}
          />
          <Param
            label="H2H BTTS rate"
            value={h2hRate}
            min={0}
            max={1}
            step={0.05}
            format={(n) => pct(n, 0)}
            onChange={setH2hRate}
            hint={h2hN === 0 ? "n = 0 → posterior = Poisson BTTS from λ" : `${hits.toFixed(1)} both-score in ${h2hN}`}
          />
        </div>

        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Pooling</p>
          <PoolBar label="Complete (league)" value={hier.completePooling} />
          <PoolBar label="Partial (desk)" value={hier.partial} accent />
          <PoolBar label="No pooling" value={hier.noPooling} />
          <PoolBar label="Logit-scale (Gelman)" value={hier.logitPartial} />

          <div>
            <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">Posterior 95%</p>
            <div className="relative h-2 rounded-full bg-muted">
              <div
                className="absolute top-0 h-2 rounded-full bg-pitch/70"
                style={{ left: `${loPct}%`, width: `${Math.max(1.5, hiPct - loPct)}%` }}
              />
              <div
                className="absolute top-[-3px] h-3.5 w-0.5 bg-foreground"
                style={{ left: `${midPct}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              {pct(hier.lo)} – {pct(hier.hi)} · mean {pct(hier.partial)}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="text-muted-foreground">α, β</dt>
            <dd className="text-right">
              {hier.alpha.toFixed(2)}, {hier.beta.toFixed(2)}
            </dd>
            <dt className="text-muted-foreground">League μ</dt>
            <dd className="text-right">{pct(hier.league)}</dd>
            <dt className="text-muted-foreground">Poisson from λ</dt>
            <dd className="text-right">{pct(hier.poisson)}</dd>
            <dt className="text-muted-foreground">
              vs independent {pct(maherBttsClosed(LEAGUE_MEAN_HOME, LEAGUE_MEAN_AWAY))}
            </dt>
            <dd className="text-right text-muted-foreground">league mean</dd>
          </dl>
        </div>
      </div>

      <p className="text-sm text-pretty text-muted-foreground">
        Posterior mean (κμ + y) / (κ + n) with μ = (1 − e<sup>−λ</sup>)(1 − e<sup>−μ</sup>) from the
        already-shrunk λ. Drag κ up and the posterior walks toward Poisson BTTS; drag n up and it
        follows H2H. That is the whole hierarchy — no Gibbs sampler on five H2H rows.
      </p>

      <section className="space-y-4">
        <h3 className="font-display text-xl">Metropolis–Hastings</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Random-walk MH on logit(p). Two chains, 200 burn-in, 600 kept. When the target is the Beta
          posterior, the chain mean must recover (κμ + y)/(κ + n). The logit-normal prior is not
          conjugate — that is the case MCMC earns. Drag the step down until R̂ blows up: the chain
          has not mixed, so you would not trust the mean.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
            <Param
              label="Proposal step σ"
              value={step}
              min={0.05}
              max={1.4}
              step={0.05}
              format={(n) => n.toFixed(2)}
              onChange={setStep}
              hint="≈ 0.4 on the logit is a decent start. Too small → sticky. Too big → rejected."
            />
            <Trace traces={mcmc.conjugate.traces} />
            <p className="text-xs text-muted-foreground">Two chains on the conjugate Beta target.</p>
          </div>
          <div className="space-y-3 rounded-xl bg-card p-4 shadow-border">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Versus exact</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
              <dt className="text-muted-foreground">Exact Beta mean</dt>
              <dd>{pct(hier.partial)}</dd>
              <dt className="text-muted-foreground">MH mean</dt>
              <dd>{pct(mcmc.conjugate.mean)}</dd>
              <dt className="text-muted-foreground">Gibbs mean (Beta draws)</dt>
              <dd>{pct(mcmc.gibbsMean)}</dd>
              <dt className="text-muted-foreground">Logit-normal MH</dt>
              <dd>{pct(mcmc.logitNormal.mean)}</dd>
              <dt className="text-muted-foreground">Gelman–Rubin R̂</dt>
              <dd className={mcmc.conjugate.rHat > 1.1 ? "text-destructive" : undefined}>
                {mcmc.conjugate.rHat >= 10 ? "∞" : mcmc.conjugate.rHat.toFixed(3)}
              </dd>
              <dt className="text-muted-foreground">Accept</dt>
              <dd>{pct(mcmc.conjugate.accept, 0)}</dd>
              <dt className="text-muted-foreground">ESS / chain</dt>
              <dd>{mcmc.conjugate.ess.toFixed(0)}</dd>
              <dt className="text-muted-foreground">MH 95%</dt>
              <dd>
                {pct(mcmc.conjugate.lo)} – {pct(mcmc.conjugate.hi)}
              </dd>
            </dl>
            <p className="text-xs text-pretty text-muted-foreground">
              R̂ → 1 means the two chains found the same place. The ten still print the exact mean.
              A 20-team Baio model has no exact mean — that is why they sampled.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-xl">Variational inference</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Same posterior, no chain. Posit q(θ) = N(m, s²) on the logit and climb the ELBO
          E<sub>q</sub>[log π] + H[q] (Jordan 1999, Blei 2017). Gauss–Hermite quadrature, 80 steps.
          The mean should sit next to Metropolis. The 95% bar is usually tighter — mean-field
          underestimates spread. That is why the ten still print the conjugate mean, not this Gaussian.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl bg-card p-4 shadow-border">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">ELBO</p>
            <ElboPath path={vi.conjugate.elboPath} />
            <p className="text-xs text-muted-foreground">
              Evidence lower bound on the conjugate Beta-on-logit. Up is better. Unnormalized, so
              only the path matters.
            </p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
              <dt className="text-muted-foreground">E_q[log π] energy</dt>
              <dd>{vi.conjugate.energy.toFixed(3)}</dd>
              <dt className="text-muted-foreground">H[q] entropy</dt>
              <dd>{vi.conjugate.entropy.toFixed(3)}</dd>
              <dt className="text-muted-foreground">ELBO sum</dt>
              <dd>{vi.conjugate.elbo.toFixed(3)}</dd>
              <dt className="text-muted-foreground">∇m</dt>
              <dd>{vi.conjugate.dm.toFixed(3)}</dd>
              <dt className="text-muted-foreground">∇s</dt>
              <dd>{vi.conjugate.ds.toFixed(3)}</dd>
              <dt className="text-muted-foreground">m, s on logit</dt>
              <dd>
                {vi.conjugate.m.toFixed(2)}, {vi.conjugate.s.toFixed(2)}
              </dd>
            </dl>
            <p className="text-xs text-pretty text-muted-foreground">
              Reparameterize θ = m + s z, z ~ N(0,1). ∇m = E[score], ∇s = E[score · z] + 1/s.
              At a mode both sit near 0. Entropy ½(1+log 2πs²) fights the energy term that wants s → 0.
            </p>
          </div>
          <div className="space-y-3 rounded-xl bg-card p-4 shadow-border">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Versus MCMC</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
              <dt className="text-muted-foreground">Exact Beta mean</dt>
              <dd>{pct(hier.partial)}</dd>
              <dt className="text-muted-foreground">VI mean E<sub>q</sub>[p]</dt>
              <dd>{pct(vi.conjugate.meanP)}</dd>
              <dt className="text-muted-foreground">Laplace mode</dt>
              <dd>{pct(vi.laplace.modeP)}</dd>
              <dt className="text-muted-foreground">MH mean</dt>
              <dd>{pct(mcmc.conjugate.mean)}</dd>
              <dt className="text-muted-foreground">VI 95%</dt>
              <dd>
                {pct(vi.conjugate.lo)} – {pct(vi.conjugate.hi)}
              </dd>
              <dt className="text-muted-foreground">MH 95%</dt>
              <dd>
                {pct(mcmc.conjugate.lo)} – {pct(mcmc.conjugate.hi)}
              </dd>
              <dt className="text-muted-foreground">Width VI / MH</dt>
              <dd>
                {(
                  (vi.conjugate.hi - vi.conjugate.lo) /
                  Math.max(1e-6, mcmc.conjugate.hi - mcmc.conjugate.lo)
                ).toFixed(2)}
              </dd>
              <dt className="text-muted-foreground">Logit-normal VI</dt>
              <dd>{pct(vi.logitNormal.meanP)}</dd>
            </dl>
            <p className="text-xs text-pretty text-muted-foreground">
              A ratio below 1 is the mean-field tax: faster than two chains, overconfident on the
              interval. Use it to locate the mean; do not use it as a calibrated 95%.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-xl">Score matching</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Same Gaussian q, different objective. Hyvärinen (2005) matches scores: minimise
          ½ E<sub>q</sub>[(∇log q − ∇log π)²] — no partition function, no entropy term. Vincent
          (2011) perturbs posterior draws and matches −ε/σ² (σ = {DSM_SIGMA}). Gutmann–Hyvärinen
          NCE classifies those draws vs noise. Liu et al. (2016) is the kernelised Stein form of
          the same identity. The ten still print the conjugate mean.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl bg-card p-4 shadow-border">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Scores on the logit</p>
            <ScoreOverlay curve={sm.curve} />
            <p className="text-xs text-muted-foreground">
              Solid is q’s score −(θ−m)/s². Faint is π. Overlap is a small Fisher J.
            </p>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Fisher J</p>
            <ElboPath path={sm.fisher.path} />
            <p className="text-xs text-muted-foreground">Down is better. Unnormalized π, so only the path matters.</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
              <dt className="text-muted-foreground">Fisher J of Fisher-q</dt>
              <dd>{sm.fisher.fisherJ.toFixed(3)}</dd>
              <dt className="text-muted-foreground">Fisher J of ELBO-q</dt>
              <dd>{sm.elboFisherJ.toFixed(3)}</dd>
              <dt className="text-muted-foreground">Fisher J of Laplace</dt>
              <dd>{sm.laplace.fisherJ.toFixed(3)}</dd>
              <dt className="text-muted-foreground">NCE Fisher / ELBO / moments</dt>
              <dd>
                {sm.nce.fisher.toFixed(2)} / {sm.nce.elbo.toFixed(2)} / {sm.nce.hyvarinen.toFixed(2)}
              </dd>
            </dl>
            <p className="text-xs text-pretty text-muted-foreground">
              ELBO sets E<sub>q</sub>[score] = 0, so E<sub>q</sub>[p] hits the Beta mean. Fisher
              matches the whole score field — closer to Laplace, Jensen-biased on E[p]. DSM’s s is
              √(Var(θ)+σ²); subtract σ to debias.
            </p>
          </div>
          <div className="space-y-3 rounded-xl bg-card p-4 shadow-border">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Versus ELBO</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
              <dt className="text-muted-foreground">Exact Beta mean</dt>
              <dd>{pct(hier.partial)}</dd>
              <dt className="text-muted-foreground">ELBO E<sub>q</sub>[p]</dt>
              <dd>{pct(vi.conjugate.meanP)}</dd>
              <dt className="text-muted-foreground">Fisher E<sub>q</sub>[p]</dt>
              <dd>{pct(sm.fisher.meanP)}</dd>
              <dt className="text-muted-foreground">Fisher mode σ(m)</dt>
              <dd>{pct(sm.fisher.modeP)}</dd>
              <dt className="text-muted-foreground">Hyvärinen samples E<sub>q</sub>[p]</dt>
              <dd>{pct(sm.hyvarinen.meanP)}</dd>
              <dt className="text-muted-foreground">DSM E<sub>q</sub>[p]</dt>
              <dd>{pct(sm.dsm.meanP)}</dd>
              <dt className="text-muted-foreground">Fisher s / ELBO s</dt>
              <dd>
                {sm.fisher.s.toFixed(2)} / {vi.conjugate.s.toFixed(2)}
              </dd>
              <dt className="text-muted-foreground">DSM s / debiased</dt>
              <dd>
                {sm.dsm.s.toFixed(2)} / {sm.dsm.debiasedS.toFixed(2)}
              </dd>
              <dt className="text-muted-foreground">Fisher 95%</dt>
              <dd>
                {pct(sm.fisher.lo)} – {pct(sm.fisher.hi)}
              </dd>
            </dl>
            <p className="text-xs text-pretty text-muted-foreground">
              NCE loss is lower when q is easier to tell from N(m, 1.2²) noise. Moment-matched
              Hyvärinen usually wins that one — it is forward-KL on the draws. Reverse KL (ELBO)
              and Fisher do not see the samples.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ScoreOverlay({ curve }: { curve: { theta: number; q: number; pi: number }[] }) {
  if (curve.length < 2) return null;
  const ys = curve.flatMap((c) => [c.q, c.pi]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = Math.max(1e-6, hi - lo);
  function pts(key: "q" | "pi"): string {
    return curve
      .map((c, i) => {
        const x = (i / (curve.length - 1)) * 320;
        const y = 4 + (1 - (c[key] - lo) / span) * 44;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }
  return (
    <svg viewBox="0 0 320 52" className="w-full text-muted-foreground" aria-label="Score overlay">
      <polyline fill="none" stroke="currentColor" strokeWidth="1" opacity={0.4} points={pts("pi")} />
      <polyline fill="none" stroke="currentColor" strokeWidth="1.4" points={pts("q")} />
    </svg>
  );
}

function ElboPath({ path }: { path: number[] }) {
  if (path.length < 2) return null;
  const lo = Math.min(...path);
  const hi = Math.max(...path);
  const span = Math.max(1e-6, hi - lo);
  const pts = path
    .map((v, i) => {
      const x = (i / (path.length - 1)) * 320;
      const y = 4 + (1 - (v - lo) / span) * 44;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 320 52" className="w-full text-muted-foreground" aria-label="ELBO path">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.2" points={pts} />
    </svg>
  );
}

function Trace({ traces }: { traces: number[][] }) {
  const a = traces[0] ?? [];
  const b = traces[1] ?? [];
  const n = Math.min(a.length, b.length);
  const take = 140;
  const stride = Math.max(1, Math.floor(n / take));
  function pts(arr: number[]): string {
    const out: string[] = [];
    let k = 0;
    for (let i = 0; i < arr.length && k < take; i += stride, k++) {
      const x = (k / Math.max(1, take - 1)) * 320;
      const y = 4 + (1 - arr[i]!) * 44;
      out.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return out.join(" ");
  }
  return (
    <svg viewBox="0 0 320 52" className="w-full text-muted-foreground" aria-label="MCMC trace">
      <polyline fill="none" stroke="currentColor" strokeWidth="1" points={pts(a)} />
      <polyline fill="none" stroke="currentColor" strokeWidth="1.2" opacity={0.85} points={pts(b)} />
    </svg>
  );
}

function PoolBar({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr_2.75rem] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", accent ? "bg-pitch" : "bg-line")}
          style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
        />
      </div>
      <span className="text-right font-mono tabular-nums">{pct(value, 0)}</span>
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
