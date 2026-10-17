import { useMemo, useState } from "react";
import { type DcSeed } from "@/components/desk/dixon-coles-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bivariateGrid,
  DC_RHO,
  DIAG_INFLATE_P,
  diagonalInflate,
  goddardOu,
  goddardResult,
  jointGrid,
  KARLIS_COV,
  karlisRates,
  karlisSkellam1x2,
  LEAGUE_MEAN_AWAY,
  LEAGUE_MEAN_HOME,
  maherGrid,
  maherOver15,
  maherOver25Closed,
  polyaAeppliOverAtLeast,
  polyaAeppli1x2,
  polyaAeppliMoments,
  polyaKarlis1x2,
  polyaRhoFromVmr,
  YIP_GOAL_VMR,
  zipGrid,
  zipMoments,
  zipInvestigate,
  zeroInflate00,
  ZI_SKELLAM_PI,
  ZIP_PI,
  bttsPartsFromGrid,
  negBinMoments,
  negBinInvestigate,
  negBinRFromVmr,
  negBinFrailtyTotalVar,
  negBinIndependentTotalVar,
  negBinSplit,
  marketsFromGrid,
  negBinGrid,
  negBinOver15,
  negBinSkellam1x2,
  skellam1x2,
  skellamInPlay1x2,
  skellamMoments,
  skellamNormal1x2,
  skellamPmf,
  skellamDrawConv,
  skellamVariants,
  shinFit,
  multiplicativeDevig,
  additiveDevig,
  powerDevig,
  invert1x2Report,
  structuralOuP,
  structuralWinP,
  weibullOverAtLeast,
  WIN_HIER_KAPPA,
  ziSkellam1x2,
  ziSkellamInvestigate,
} from "@/lib/football/models";
import { sgpBoard } from "@/lib/football/markets-engine";
import { negBinCornerInvestigate } from "@/lib/football/corners";

function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

const GD_KS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] as const;

export function WinOuPanel({ seeds }: { seeds: DcSeed[] }) {
  const [lh, setLh] = useState(LEAGUE_MEAN_HOME);
  const [la, setLa] = useState(LEAGUE_MEAN_AWAY);
  const [nbR, setNbR] = useState(18);
  const [zipPi, setZipPi] = useState(ZIP_PI);
  const [ziPi, setZiPi] = useState(ZI_SKELLAM_PI);
  const [h2hN, setH2hN] = useState(6);
  const [h2hHome, setH2hHome] = useState(0.5);
  const [h2hOver, setH2hOver] = useState(0.5);
  const [minutesLeft, setMinutesLeft] = useState(90);
  const [scoreH, setScoreH] = useState(0);
  const [scoreA, setScoreA] = useState(0);
  const [seedId, setSeedId] = useState<number | "desk">("desk");
  const [oh, setOh] = useState(1.9);
  const [od, setOd] = useState(3.6);
  const [oa, setOa] = useState(4.2);

  const homeHits = h2hHome * h2hN;
  const awayHits = (1 - h2hHome) * 0.55 * h2hN;
  const drawHits = Math.max(0, h2hN - homeHits - awayHits);
  const overHits = h2hOver * h2hN;

  const shin = useMemo(() => {
    const odds = [oh, od, oa];
    const fit = shinFit(odds);
    const inv = invert1x2Report(fit.probs[0] ?? 0.45, fit.probs[1] ?? 0.27, fit.probs[2] ?? 0.28, DC_RHO);
    return {
      fit,
      mul: multiplicativeDevig(odds),
      add: additiveDevig(odds),
      pow: powerDevig(odds),
      inv,
    };
  }, [oh, od, oa]);

  const rows = useMemo(() => {
    const dc = marketsFromGrid(jointGrid(lh, la, DC_RHO));
    const maher = marketsFromGrid(maherGrid(lh, la));
    const karlis = marketsFromGrid(bivariateGrid(lh, la, KARLIS_COV));
    const sk = skellam1x2(lh, la);
    const shock = karlisSkellam1x2(lh, la);
    const zi = ziSkellam1x2(lh, la);
    const nrm = skellamNormal1x2(lh, la);
    const nb = negBinSkellam1x2(lh, la, 4);
    const inf = marketsFromGrid(diagonalInflate(jointGrid(lh, la, DC_RHO), DIAG_INFLATE_P));
    const god = goddardResult({
      priorHome: dc.home,
      priorDraw: dc.draw,
      priorAway: dc.away,
      homeHits,
      drawHits,
      awayHits,
      kappa: WIN_HIER_KAPPA,
    });
    const home = structuralWinP(dc.home, sk.home, shock.home, god.home, inf.home);
    const away = structuralWinP(dc.away, sk.away, shock.away, god.away, inf.away);
    const nb15 = negBinOver15(lh, la, 8);
    const nbG = marketsFromGrid(negBinGrid(lh, la, 8));
    const w15 = weibullOverAtLeast(2, lh, la);
    const w25 = weibullOverAtLeast(3, lh, la);
    const god15 = goddardOu({ prior: dc.over15, hits: overHits, n: h2hN });
    const god25 = goddardOu({ prior: dc.over25, hits: overHits * 0.7, n: h2hN });
    const ou15 = structuralOuP(dc.over15, maherOver15(lh, la), karlis.over15, nb15, w15, god15);
    const ou25 = structuralOuP(dc.over25, maherOver25Closed(lh, la), karlis.over25, nbG.over25, w25, god25);
    const pa15 = polyaAeppliOverAtLeast(2, lh, la);
    const pa25 = polyaAeppliOverAtLeast(3, lh, la);
    const pa1x2 = polyaAeppli1x2(lh, la);
    const paMom = polyaAeppliMoments(lh + la);
    const paShock = polyaKarlis1x2(lh, la);
    const yipRho = polyaRhoFromVmr(YIP_GOAL_VMR);
    const nbMom = negBinMoments(lh + la, 8);
    const yipR = negBinRFromVmr(lh + la, YIP_GOAL_VMR);
    const nbFr = negBinFrailtyTotalVar(lh, la, 8);
    const nbInd = negBinIndependentTotalVar(lh, la, 8);
    const zipG = zipGrid(lh, la);
    const zipM = marketsFromGrid(zipG);
    const zipB = bttsPartsFromGrid(zipG);
    const zipMom = zipMoments(lh + la);
    const only00 = zeroInflate00(maherGrid(lh, la), ZIP_PI);
    const mom = skellamMoments(lh, la);
    const rates = karlisRates(lh, la);
    const live = skellamInPlay1x2(lh, la, scoreH, scoreA, minutesLeft / 90);
    const drawConv = skellamDrawConv(lh, la);
    const indepPmf = GD_KS.map((k) => skellamPmf(k, lh, la));
    const shockPmf = GD_KS.map((k) => skellamPmf(k, rates.l1, rates.l2));
    return {
      dc,
      maher,
      karlis,
      sk,
      shock,
      zi,
      nrm,
      nb,
      inf,
      god,
      home,
      away,
      ou15,
      ou25,
      w15,
      w25,
      god15,
      god25,
      nb15,
      pa15,
      pa25,
      pa1x2,
      paMom,
      paShock,
      yipRho,
      nbMom,
      yipR,
      nbFr,
      nbInd,
      zipM,
      zipB,
      zipMom,
      p00zip: only00[0]?.[0] ?? 0,
      p00maher: maherGrid(lh, la)[0]?.[0] ?? 0,
      mom,
      rates,
      live,
      indepPmf,
      shockPmf,
      drawConv,
    };
  }, [lh, la, homeHits, drawHits, awayHits, overHits, h2hN, minutesLeft, scoreH, scoreA]);

  function applyDesk() {
    setLh(LEAGUE_MEAN_HOME);
    setLa(LEAGUE_MEAN_AWAY);
    setH2hN(6);
    setH2hHome(0.5);
    setH2hOver(0.5);
    setMinutesLeft(90);
    setScoreH(0);
    setScoreA(0);
    setSeedId("desk");
  }

  function applySeed(id: number) {
    const s = seeds.find((x) => x.id === id);
    if (!s) return;
    setLh(s.lambdaHome);
    setLa(s.lambdaAway);
    setSeedId(id);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="font-display text-2xl">1X2 · over/under</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Same λ as the ten. 1X2 on the ten is Dixon–Coles 55% + common-shock Skellam 25% + Goddard 12% +
          independent Skellam 8% — the 5% diagonal inflate stays on this lab. Totals on the ten are
          Dixon–Coles + Karlis + NegBin; Weibull-count is lab only. The ten print slices of one union grid, not four blends.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={seedId === "desk" ? "secondary" : "outline"} onClick={applyDesk}>
          Desk λ
        </Button>
        {seeds.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={seedId === s.id ? "secondary" : "outline"}
            className="h-auto max-w-full whitespace-normal py-2 text-left"
            onClick={() => applySeed(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl bg-card p-4 shadow-border">
        <h3 className="font-display text-lg">Shin 1X2 inversion</h3>
        <p className="text-sm text-pretty text-muted-foreground">
          Shin (1991): a bookmaker facing insider share z sets the overround. Invert the posted 1X2
          for z and the true p, then fit two Dixon–Coles λ’s to those three probabilities. Two λ’s
          cannot hit 1X2 exactly — SSE is the leftover. That λ pair is 68% of the ten. Additive /
          multiplicative / power are Štrumbelj (2014) comparators; they are not on the ten.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            Home odd
            <Input type="number" min={1.01} step={0.05} value={oh} onChange={(e) => setOh(Number(e.target.value) || 1.9)} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Draw odd
            <Input type="number" min={1.01} step={0.05} value={od} onChange={(e) => setOd(Number(e.target.value) || 3.6)} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Away odd
            <Input type="number" min={1.01} step={0.05} value={oa} onChange={(e) => setOa(Number(e.target.value) || 4.2)} />
          </label>
        </div>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          overround {(shin.fit.overround * 100).toFixed(1)}% · z {shin.fit.z.toFixed(3)} · inverted λ{" "}
          {shin.inv.lambdaH.toFixed(2)} / {shin.inv.lambdaA.toFixed(2)} · SSE {(shin.inv.sse * 1e4).toFixed(2)}×10⁻⁴
        </p>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Method</th>
              <th className="py-1 font-medium">Home</th>
              <th className="py-1 font-medium">Draw</th>
              <th className="py-1 font-medium">Away</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {[
              ["Shin (ten)", shin.fit.probs],
              ["Multiplicative", shin.mul],
              ["Additive", shin.add],
              ["Power", shin.pow],
              ["DC λ round-trip", [shin.inv.fitted.home, shin.inv.fitted.draw, shin.inv.fitted.away]],
            ].map(([name, p]) => (
              <tr key={String(name)} className="border-t border-border/60">
                <td className="py-1 font-sans">{name}</td>
                <td>{pct((p as number[])[0] ?? 0)}</td>
                <td>{pct((p as number[])[1] ?? 0)}</td>
                <td>{pct((p as number[])[2] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <Param label="λ home" value={lh} min={0.4} max={3.2} step={0.02} format={(n) => n.toFixed(2)} onChange={setLh} />
          <Param label="λ away" value={la} min={0.3} max={3.0} step={0.02} format={(n) => n.toFixed(2)} onChange={setLa} />
          <Param
            label="H2H matches n"
            value={h2hN}
            min={0}
            max={16}
            step={1}
            format={(n) => n.toFixed(0)}
            onChange={setH2hN}
          />
          <Param
            label="H2H home-win rate"
            value={h2hHome}
            min={0}
            max={1}
            step={0.05}
            format={(n) => pct(n, 0)}
            onChange={setH2hHome}
            hint={h2hN === 0 ? "n = 0 → Goddard = Dixon–Coles 1X2" : `${homeHits.toFixed(1)} home wins in ${h2hN}`}
          />
          <Param
            label="H2H over 1.5 rate"
            value={h2hOver}
            min={0}
            max={1}
            step={0.05}
            format={(n) => pct(n, 0)}
            onChange={setH2hOver}
          />
          <Param
            label="Minutes remaining"
            value={minutesLeft}
            min={0}
            max={90}
            step={1}
            format={(n) => n.toFixed(0)}
            onChange={setMinutesLeft}
            hint="Skellam process. Kick-off = 90. Full-time is the current score."
          />
          <Param label="Current home goals" value={scoreH} min={0} max={6} step={1} format={(n) => n.toFixed(0)} onChange={setScoreH} />
          <Param label="Current away goals" value={scoreA} min={0} max={6} step={1} format={(n) => n.toFixed(0)} onChange={setScoreA} />
        </div>

        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Home win</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="text-muted-foreground">Dixon–Coles</dt>
            <dd>{pct(rows.dc.home)}</dd>
            <dt className="text-muted-foreground">Skellam / Maher</dt>
            <dd>{pct(rows.sk.home)}</dd>
            <dt className="text-muted-foreground">Common-shock Skellam</dt>
            <dd>{pct(rows.shock.home)}</dd>
            <dt className="text-muted-foreground">Goddard Dirichlet</dt>
            <dd>{pct(rows.god.home)}</dd>
            <dt className="text-muted-foreground">Diagonal inflate</dt>
            <dd>{pct(rows.inf.home)}</dd>
            <dt className="text-foreground">Structural 1X2</dt>
            <dd>{pct(rows.home)}</dd>
            <dt className="text-muted-foreground">ZI-Skellam draw</dt>
            <dd>{pct(rows.zi.draw)}</dd>
            <dt className="text-muted-foreground">Shock Skellam draw</dt>
            <dd>{pct(rows.shock.draw)}</dd>
            <dt className="text-muted-foreground">Away structural</dt>
            <dd>{pct(rows.away)}</dd>
          </dl>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Over</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="text-muted-foreground">Over 1.5 structural</dt>
            <dd>{pct(rows.ou15)}</dd>
            <dt className="text-muted-foreground">Over 2.5 structural</dt>
            <dd>{pct(rows.ou25)}</dd>
            <dt className="text-muted-foreground">Weibull Over 2.5</dt>
            <dd>{pct(rows.w25)}</dd>
            <dt className="text-muted-foreground">Maher Over 2.5</dt>
            <dd>{pct(maherOver25Closed(lh, la))}</dd>
            <dt className="text-muted-foreground">Pólya–Aeppli Over 2.5</dt>
            <dd>{pct(rows.pa25)}</dd>
            <dt className="text-muted-foreground">Pólya–Aeppli draw</dt>
            <dd>{pct(rows.pa1x2.draw)}</dd>
            <dt className="text-muted-foreground">Type I PA draw</dt>
            <dd>{pct(rows.paShock.draw)}</dd>
            <dt className="text-muted-foreground">ρ̂ Yip goals (VMR 1.04)</dt>
            <dd>{rows.yipRho.toFixed(3)}</dd>
            <dt className="text-muted-foreground">NegBin VMR (r=8)</dt>
            <dd>{rows.nbMom.vmr.toFixed(2)}</dd>
            <dt className="text-muted-foreground">r̂ Yip goals (VMR 1.04)</dt>
            <dd>{Number.isFinite(rows.yipR) ? rows.yipR.toFixed(0) : "∞"}</dd>
            <dt className="text-muted-foreground">Goddard Over 1.5</dt>
            <dd>{pct(rows.god15)}</dd>
            <dt className="text-muted-foreground">ZIP Over 2.5</dt>
            <dd>{pct(rows.zipM.over25)}</dd>
            <dt className="text-muted-foreground">ZIP BTTS</dt>
            <dd>{pct(rows.zipB.btts)}</dd>
            <dt className="text-muted-foreground">ZIP P(0-0)</dt>
            <dd>{pct(rows.p00zip)}</dd>
          </dl>
          <p className="text-xs text-pretty text-muted-foreground">
            Independent Skellam is untruncated Maher. The common shock cancels in the difference, so
            Karlis 1X2 is Skellam(λh−θ, λa−θ) — smaller rates, more draws. Dixon–Coles τ and the
            inflate buy still more. Weibull β = 0.9 fattens 0s and the tail. Pólya–Aeppli is Poisson
            clusters of geometric size (Evans 1953 recurrence, ρ = 0.88, VMR {rows.paMom.vmr.toFixed(2)}).
            Independent PA 1X2 cuts the draw versus Skellam. Type I (Minkova) is the common-shock
            identity on PA rates — more draws, ρ = 1 is Karlis–Skellam. Yip (2024) goals VMR 1.04
            inverts to ρ̂ = {rows.yipRho.toFixed(2)}, so the ten stay Poisson. NegBin r=8 is VMR{" "}
            {rows.nbMom.vmr.toFixed(2)}; Yip goals invert to r̂ ≈ {rows.yipR.toFixed(0)}. Frailty
            Var(total) {rows.nbFr.toFixed(2)} vs independent {rows.nbInd.toFixed(2)} — O/U uses the
            frailty (one NB on λh+λa). ZIP π = 0.05 on each margin cuts Over and BTTS (shutouts, not
            draws). (0,0)-only P(0-0) {pct(rows.p00zip)} vs Maher {pct(rows.p00maher)}. Not the ten.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-border">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Goal difference PMF</p>
          <SkellamBars ks={GD_KS} indep={rows.indepPmf} shock={rows.shockPmf} />
          <p className="text-xs text-pretty text-muted-foreground">
            Light bars: independent Skellam. Solid: common-shock. Mass at 0 is P(draw). E[GD] ={" "}
            {rows.mom.mean.toFixed(2)}, Var = {rows.mom.variance.toFixed(2)} ≥ |mean|. Shock rates λ₁={" "}
            {rows.rates.l1.toFixed(2)}, λ₂={rows.rates.l2.toFixed(2)}, θ={rows.rates.l3.toFixed(2)}.
          </p>
        </div>
        <div className="space-y-3 rounded-xl bg-card p-4 shadow-border">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Skellam identities</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="text-muted-foreground">E[H−A] = λh − λa</dt>
            <dd>{rows.mom.mean.toFixed(3)}</dd>
            <dt className="text-muted-foreground">Var[H−A] = λh + λa</dt>
            <dd>{rows.mom.variance.toFixed(3)}</dd>
            <dt className="text-muted-foreground">Draw Σ Poi(j)Poi(j)</dt>
            <dd>{pct(rows.drawConv)}</dd>
            <dt className="text-muted-foreground">Skewness</dt>
            <dd>{rows.mom.skewness.toFixed(3)}</dd>
            <dt className="text-muted-foreground">Excess kurtosis 1/(λh+λa)</dt>
            <dd>{rows.mom.excessKurtosis.toFixed(3)}</dd>
            <dt className="text-muted-foreground">Normal+continuity home</dt>
            <dd>{pct(rows.nrm.home)}</dd>
            <dt className="text-muted-foreground">NegBin-difference draw</dt>
            <dd>{pct(rows.nb.draw)}</dd>
            <dt className="text-foreground">In-play home ({minutesLeft}&prime;)</dt>
            <dd>{pct(rows.live.home)}</dd>
            <dt className="text-foreground">In-play draw</dt>
            <dd>{pct(rows.live.draw)}</dd>
            <dt className="text-foreground">In-play away</dt>
            <dd>{pct(rows.live.away)}</dd>
          </dl>
          <p className="text-xs text-pretty text-muted-foreground">
            Koopman & Lit (2019): Skellam on the difference was the best 1X2 betting model; the
            pairwise goal counts were more precise. The draw is the diagonal convolution Σ Poi(j;λh)
            Poi(j;λa) — Fox–Glynn table, prefix CDF, not an FFT. NegBin-difference fattens |GD| and
            usually cuts the draw — lab only. Karlis (2009) found extra zero-inflation unnecessary on
            2006–07 EPL.
          </p>
        </div>
      </div>

      <NegBinTrace lh={lh} la={la} r={nbR} onR={setNbR} />
      <NegBinSplit />
      <ZipTrace lh={lh} la={la} pi={zipPi} onPi={setZipPi} />
      <SkellamVariantTrace lh={lh} la={la} minutesLeft={minutesLeft} scoreH={scoreH} scoreA={scoreA} />
      <ZiSkellamTrace lh={lh} la={la} pi={ziPi} onPi={setZiPi} />
      <SgpTrace lh={lh} la={la} />
      <CornerNbTrace />
    </div>
  );
}

function NegBinSplit() {
  const z = negBinSplit();
  const rows = [
    ["Poisson", z.poisson.variance, null, z.poisson.over15, z.poisson.over15, z.poisson.over25, z.poisson.over25, z.poisson.btts],
    ["r = 18", z.r18.varIndep, z.r18.varFrailty, z.r18.over15.margins, z.r18.over15.frailty, z.r18.over25.margins, z.r18.over25.frailty, z.r18.btts],
    ["r = 8", z.r8.varIndep, z.r8.varFrailty, z.r8.over15.margins, z.r8.over15.frailty, z.r8.over25.margins, z.r8.over25.frailty, z.r8.btts],
    ["r = 3.5", z.r35.varIndep, z.r35.varFrailty, z.r35.over15.margins, z.r35.over15.frailty, z.r35.over25.margins, z.r35.over25.frailty, z.r35.btts],
  ] as const;
  const samples = [
    ["2, 2, 3, 2, 3", z.quiet],
    ["0, 2, 2, 3, 5", z.open],
    ["0, 0, 1, 5, 6", z.wild],
  ] as const;
  return (
    <section className="space-y-3" data-qa="nb-split">
      <h2 className="font-display text-xl">Which negative binomial</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        The union spends 8% on two independent margins, and r starts at 18. The Over 1.5 blend above spends
        its 12% on one negative binomial of the total, and that call hardcodes r = 8. One gamma on the sum
        has variance μ + μ²/r. Two gammas have λh + λa + (λh² + λa²)/r, which is smaller because the cross
        term 2λhλa/r is missing. At r = 18 the latent total has standard deviation {z.r18.gammaSd.toFixed(3)}.
        Over 2.5 is {pct(z.poisson.over25, 2)} Poisson, {pct(z.r18.over25.margins, 2)} on the margins, and{" "}
        {pct(z.r18.over25.frailty, 2)} on the frailty. Yip’s r for these rates is {z.yipR.toFixed(0)}, above the
        cap, so the estimator cannot reach it. Five quiet totals stay at 18. Five totals whose variance clears
        μ + 0.15 can still be pinned at 18, because the raw r is 24. Only the wild sample hits the floor 3.5.
        This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Fit</th>
              <th className="py-1.5 font-medium">Var margins</th>
              <th className="py-1.5 font-medium">Var frailty</th>
              <th className="py-1.5 font-medium">Over 1.5 margins</th>
              <th className="py-1.5 font-medium">Over 1.5 frailty</th>
              <th className="py-1.5 font-medium">Over 2.5 margins</th>
              <th className="py-1.5 font-medium">Over 2.5 frailty</th>
              <th className="py-1.5 font-medium">BTTS</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map(([label, vM, vF, o15m, o15f, o25m, o25f, btts]) => (
              <tr key={label} className="border-t border-border">
                <td className="py-1.5 font-sans">{label}</td>
                <td className="py-1.5">{vM.toFixed(3)}</td>
                <td className="py-1.5">{vF == null ? "—" : vF.toFixed(3)}</td>
                <td className="py-1.5">{pct(o15m, 2)}</td>
                <td className="py-1.5">{pct(o15f, 2)}</td>
                <td className="py-1.5">{pct(o25m, 2)}</td>
                <td className="py-1.5">{pct(o25f, 2)}</td>
                <td className="py-1.5">{pct(btts, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Newest five totals</th>
              <th className="py-1.5 font-medium">Variance</th>
              <th className="py-1.5 font-medium">Raw r</th>
              <th className="py-1.5 font-medium">Used r</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {samples.map(([label, s]) => (
              <tr key={label} className="border-t border-border">
                <td className="py-1.5 font-sans">{label}</td>
                <td className="py-1.5">{(s.v ?? 0).toFixed(3)}</td>
                <td className="py-1.5">{s.raw != null && Number.isFinite(s.raw) ? s.raw.toFixed(2) : "—"}</td>
                <td className="py-1.5">{s.r.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NegBinTrace({
  lh,
  la,
  r,
  onR,
}: {
  lh: number;
  la: number;
  r: number;
  onR: (n: number) => void;
}) {
  const home = negBinInvestigate(lh, r);
  const yipR = negBinRFromVmr(lh + la, YIP_GOAL_VMR);
  const frailty = negBinFrailtyTotalVar(lh, la, r);
  const indep = negBinIndependentTotalVar(lh, la, r);
  const total = lh + la;
  return (
    <section className="space-y-3" data-qa="negbin-trace">
      <h2 className="font-display text-xl">Negative binomial</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        NB2 is a Poisson whose rate is itself random. P(0) = (r/(r+μ))<sup>r</sup>, then P(k) =
        P(k−1) · (k−1+r)/k · μ/(r+μ). Variance is μ + μ²/r, so the variance-to-mean ratio is 1 + μ/r.
        Large r is Poisson. The union spends 8% on a product of two of these margins, at the r from
        the H2H total. That r starts at 18 and only falls, toward 3.5, when those totals are wild.
        It never rises to Yip’s league figure. This does not rank the ten.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={r === 18 ? "default" : "outline"} onClick={() => onR(18)}>
          Desk r 18
        </Button>
        <Button size="sm" variant={r === 8 ? "default" : "outline"} onClick={() => onR(8)}>
          Lab r 8
        </Button>
        <Button size="sm" variant={r === 3.5 ? "default" : "outline"} onClick={() => onR(3.5)}>
          Floor r 3.5
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat k="P(0) home" v={pct(home.p0)} n={`Poisson ${pct(home.poissonP0)}`} />
        <Stat k="Extra zeros" v={pp(home.p0Lift)} n="NB minus Poisson, same μ" />
        <Stat k="VMR" v={home.vmr.toFixed(3)} n={`1 + ${lh.toFixed(2)}/${r}`} />
        <Stat k="Yip r̂" v={Number.isFinite(yipR) ? yipR.toFixed(0) : "∞"} n="VMR 1.04, not used" />
      </div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">k</th>
              <th className="px-3 py-2 font-medium">NB</th>
              <th className="px-3 py-2 font-medium">Poisson</th>
              <th className="px-3 py-2 font-medium">Gap</th>
            </tr>
          </thead>
          <tbody>
            {home.rows.map((row) => (
              <tr key={row.k} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-mono tabular-nums">{row.k}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.p, 2)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.poisson, 2)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{pp(row.p - row.poisson)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        Total {total.toFixed(2)}. Frailty variance {frailty.toFixed(2)} (one NB on the sum). Independent
        margins {indep.toFixed(2)}. The union uses the margins. Over/Under in the lab above uses the
        frailty. Tail past 8 is {home.tail < 1e-4 ? "<0.01%" : pct(home.tail, 2)}.
      </p>
    </section>
  );
}

function ZipTrace({
  lh,
  la,
  pi,
  onPi,
}: {
  lh: number;
  la: number;
  pi: number;
  onPi: (n: number) => void;
}) {
  const z = zipInvestigate(lh, la, pi);
  const rows: Array<[string, string, string, string, string]> = [
    ["Home", pct(z.maher.home), pct(z.zip.home), pct(z.only00.home), pct(z.zi.home)],
    ["Draw", pct(z.maher.draw), pct(z.zip.draw), pct(z.only00.draw), pct(z.zi.draw)],
    ["BTTS", pct(z.maher.bttsYes), pct(z.zip.bttsYes), pct(z.only00.bttsYes), "—"],
    ["Over 2.5", pct(z.maher.over25), pct(z.zip.over25), pct(z.only00.over25), "—"],
    ["0-0", pct(z.p00.maher), pct(z.p00.zip), pct(z.p00.only), "—"],
    ["1-0", pct(z.p10.maher), pct(z.p10.zip), pct(z.p10.only), "—"],
    ["1-1", pct(z.p11.maher), pct(z.p11.zip), pct(z.p11.only), "—"],
  ];
  return (
    <section className="space-y-3" data-qa="zip-trace">
      <h2 className="font-display text-xl">Zero-inflated Poisson</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        A zero-inflated Poisson is a coin toss. With probability π the count is a structural zero.
        Otherwise it is Poisson(λ). P(0) = π + (1−π)e<sup>−λ</sup>. The mean falls to (1−π)λ and the
        variance-to-mean ratio becomes 1 + πλ. The desk’s prior is π = 0.05. It is not an estimate:
        a pure Poisson has π̂ = 0. There are three places to put that coin, and they do not agree.
        Dixon–Coles is none of them. Not in the ten.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={pi === 0 ? "default" : "outline"} onClick={() => onPi(0)}>
          π = 0
        </Button>
        <Button size="sm" variant={pi === ZIP_PI ? "default" : "outline"} onClick={() => onPi(ZIP_PI)}>
          Prior 0.05
        </Button>
        <Button size="sm" variant={pi === 0.1 ? "default" : "outline"} onClick={() => onPi(0.1)}>
          π = 0.10
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat k="ZIP P(0)" v={pct(z.p0)} n={`Poisson ${pct(z.poissonP0)}`} />
        <Stat k="Mean" v={z.mean.toFixed(3)} n={`λ was ${lh.toFixed(2)}`} />
        <Stat k="VMR" v={z.vmr.toFixed(3)} n="1 + πλ" />
        <Stat k="π̂ if Poisson" v={z.piHatPoisson.toFixed(2)} n={`recover π → ${z.piHat.toFixed(2)}`} />
      </div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium"> </th>
              <th className="px-3 py-2 font-medium">Maher</th>
              <th className="px-3 py-2 font-medium">Margin ZIP</th>
              <th className="px-3 py-2 font-medium">(0,0) only</th>
              <th className="px-3 py-2 font-medium">ZI-Skellam</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b, c, d]) => (
              <tr key={label} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{label}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{a}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{b}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{c}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        Margin ZIP uses λ as written, so expected goals fall. Holding the mean at {lh.toFixed(2)} would
        need λ = {z.meanPreserving.toFixed(3)}. The grid does not do that. (0,0)-only multiplies every
        other cell by 1−π. ZI-Skellam adds π to the draw and never chooses 0-0 or 1-1.
      </p>
    </section>
  );
}

function SkellamVariantTrace({
  lh,
  la,
  minutesLeft,
  scoreH,
  scoreA,
}: {
  lh: number;
  la: number;
  minutesLeft: number;
  scoreH: number;
  scoreA: number;
}) {
  const v = skellamVariants(lh, la, { r: 18, minutesLeft, scoreH, scoreA });
  const rows: Array<[string, { home: number; draw: number; away: number }, string]> = [
    ["Independent", v.indep, "two Poissons"],
    ["Common shock", v.shock, `θ ${v.theta.toFixed(2)}, variance down`],
    ["ZI π 0.05", v.zi, "coin on the draw"],
    ["Normal + ½", v.normal, "large-λ approximation"],
    ["NegBin r 18", v.negbin, "heavier |GD|"],
    ["In play", v.live, `${scoreH}–${scoreA}, ${minutesLeft}′ left`],
  ];
  const agree = Math.abs(v.besselDraw - v.convDraw) < 1e-3;
  return (
    <section className="space-y-3" data-qa="skellam-variants">
      <h2 className="font-display text-xl">Skellam variants</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Skellam is the law of the goal difference. Independent: E[H−A] = λh−λa and Var = λh+λa.
        The draw is both the Bessel I₀ term and the diagonal convolution of two Poissons. A common
        shock subtracts θ from both rates, so the mean of the difference stays put and the variance
        falls by 2θ. That buys draws. Zero inflation puts a coin on the draw and does not name the
        score. The normal approximation with a half-goal correction is not exact at a league λ.
        A negative-binomial difference fattens the tails, which usually spends draws. In-play
        multiplies both λ by the fraction of the match left and shifts by the score above. The ten
        use the independent Skellam at 8% and the shock at 25% of structural 1X2. The rest stay here.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat k="E[GD]" v={v.mean.toFixed(3)} n="shock keeps this" />
        <Stat k="Var" v={v.variance.toFixed(3)} n={`shock ${v.shockVariance.toFixed(3)}`} />
        <Stat k="Bessel draw" v={pct(v.besselDraw)} n={agree ? "matches the convolution" : "convolution disagrees"} />
        <Stat k="θ" v={v.theta.toFixed(2)} n="floored at 0.02" />
      </div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Variant</th>
              <th className="px-3 py-2 font-medium">Home</th>
              <th className="px-3 py-2 font-medium">Draw</th>
              <th className="px-3 py-2 font-medium">Away</th>
              <th className="px-3 py-2 font-medium">What moved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, p, note]) => (
              <tr key={label} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{label}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(p.home)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(p.draw)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(p.away)}</td>
                <td className="px-3 py-2 text-muted-foreground">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ZiSkellamTrace({
  lh,
  la,
  pi,
  onPi,
}: {
  lh: number;
  la: number;
  pi: number;
  onPi: (n: number) => void;
}) {
  const z = ziSkellamInvestigate(lh, la, pi);
  return (
    <section className="space-y-3" data-qa="zi-skellam">
      <h2 className="font-display text-xl">Zero-inflated Skellam</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        This is a mixture on the goal difference, not a score. With probability π the match is a
        structural draw. Otherwise it is Skellam(λh, λa). Every non-zero difference is multiplied by
        1−π. Only k = 0 grows. The mean shrinks from λh−λa to (1−π) times that. π is clamped to
        [0, 0.25], so the model can add draws and cannot remove them. If the draw you observe is the
        Skellam draw, π̂ = 0. Karlis and Ntzoufras found the extra parameter unnecessary on 2006–07
        Premier League, so 0.05 is a prior. The same coin on the common-shock Skellam stacks two
        draw machines. Diagonal inflation is the score-grid cousin: it can raise 1-1 without calling
        it 0-0. The structural 1X2 multiplies that diagonal slot by zero. Not in the ten.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={pi === 0 ? "default" : "outline"} onClick={() => onPi(0)}>
          π = 0
        </Button>
        <Button size="sm" variant={pi === ZI_SKELLAM_PI ? "default" : "outline"} onClick={() => onPi(ZI_SKELLAM_PI)}>
          Prior 0.05
        </Button>
        <Button size="sm" variant={pi === 0.1 ? "default" : "outline"} onClick={() => onPi(0.1)}>
          π = 0.10
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat k="ZI draw" v={pct(z.zi.draw)} n={`Skellam ${pct(z.base.draw)}`} />
        <Stat k="E[GD]" v={z.moments.mean.toFixed(3)} n={`was ${z.moments.skellamMean.toFixed(3)}`} />
        <Stat k="π̂ if Skellam" v={z.piHatIfSkellam.toFixed(2)} n={`recover π → ${z.piHat.toFixed(2)}`} />
        <Stat k="Shock + ZI draw" v={pct(z.ziShock.draw)} n={`shock alone ${pct(z.shock.draw)}`} />
      </div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-border">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">GD</th>
              <th className="px-3 py-2 font-medium">Skellam</th>
              <th className="px-3 py-2 font-medium">ZI-Skellam</th>
              <th className="px-3 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {z.pmf.map((row) => (
              <tr key={row.k} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-mono tabular-nums">{row.k}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.skellam)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.zi)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">{pp(row.zi - row.skellam)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        Diagonal inflation, same π, on the Maher grid: 0-0 {pct(z.p00)} → {pct(z.diag00)}, 1-1 {pct(z.p11)} →{" "}
        {pct(z.diag11)}. ZI-Skellam has no column for those scores.
      </p>
    </section>
  );
}

function SgpTrace({ lh, la }: { lh: number; la: number }) {
  const dc = sgpBoard(jointGrid(lh, la, DC_RHO));
  const maher = sgpBoard(maherGrid(lh, la));
  const bothDc = dc.rows[0]!;
  const bothMaher = maher.rows[0]!;
  return (
    <section className="space-y-3" data-qa="sgp-corr">
      <h2 className="font-display text-xl">Same-game parlay correlation</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Two bets on one match are functions of the same score, so they are not independent even when
        the two goal counts are. φ is the correlation of the two win/lose indicators. The joint is the
        score-matrix sum. The product is what a multiplied acca assumes. Lift above 1 means the
        unadjusted acca is too long: a book that pays the product of two fair singles is giving the
        correlation away. Lift below 1 means that same product is a losing price. A Gaussian copula is
        only a stand-in when the margin is all you have. This grid is the price. Dixon–Coles ρ is not
        this correlation. On Maher the two team-over-0.5 legs have φ = 0, because each leg uses a
        different count. Negative ρ inflates 1-1 as well as 0-0, and at these λ the both-score joint
        moves a little above the product. The large φ is home over 0.5 with over 1.5: they share the
        home goals. Both teams scoring already implies over 1.5, so that third leg has conditional
        probability {pct(dc.bothImplyOver15, 0)}. Not a new market. The over combo already uses the joint.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat k="Both teams, Maher φ" v={bothMaher.phi.toFixed(2)} n="independent goals" />
        <Stat k="Both teams, DC φ" v={bothDc.phi.toFixed(2)} n={`lift ${bothDc.lift.toFixed(2)}`} />
        <Stat
          k="Home 0.5 + over 1.5"
          v={dc.rows[1]!.phi.toFixed(2)}
          n={`fair ${dc.rows[1]!.fairOdds.toFixed(2)} vs naive ${dc.rows[1]!.naiveOdds.toFixed(2)}`}
        />
        <Stat
          k="Unadjusted EV"
          v={`${(dc.rows[1]!.unadjustedEv * 100).toFixed(1)}%`}
          n="if the book just multiplies"
        />
      </div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Pair, Dixon–Coles grid</th>
              <th className="px-3 py-2 font-medium">Joint</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">φ</th>
              <th className="px-3 py-2 font-medium">Fair</th>
              <th className="px-3 py-2 font-medium">Naive</th>
            </tr>
          </thead>
          <tbody>
            {dc.rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.joint)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.product)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{row.phi.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{row.fairOdds.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{row.naiveOdds.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const CORNER_VMRS = [1.4, 1.8, 2.4] as const;

function CornerNbTrace() {
  const [vmr, setVmr] = useState<number>(1.8);
  const z = negBinCornerInvestigate(5.2, 4.6, vmr);
  const mid = z.lines[2]!;
  const tail = z.lines[4]!;
  return (
    <section className="space-y-3" data-qa="corner-nb">
      <h2 className="font-display text-xl">Negative binomial corners</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        A typical split, 5.2 and 4.6, mean {z.mean.toFixed(1)}. These are corner counts, not the goal
        λ above. Two teams with the same variance-to-mean sum to one negative binomial on the match
        total: r = r_home + r_away = {Number.isFinite(z.rTotal) ? z.rTotal.toFixed(1) : "—"}. Poisson
        keeps mean = variance. The full negative binomial keeps the mean and multiplies the variance
        by the VMR. The live grid mixes each team 65% Poisson and 35% negative binomial before the
        counts are added. That has the same variance as mixing the finished totals 65/35, and a
        different shape. Both teams are overdispersed together only {pct(z.bothNbWeight, 1)} of the
        time, but either team being overdispersed is enough to feed the far tail. The full law is
        what moves a 13.5 line. The desk mix takes a shorter step, and it is the one that can still
        price a corner handicap. The sample has to land in (1.25, 3.5) before any of this replaces
        Poisson {z.open ? "— this VMR is inside the gate" : "— this VMR stays Poisson"}. Not on the ten.
      </p>
      <div className="flex flex-wrap gap-2">
        {CORNER_VMRS.map((v) => (
          <Button key={v} size="sm" variant={vmr === v ? "secondary" : "outline"} onClick={() => setVmr(v)}>
            VMR {v.toFixed(1)}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat k="Variance, Poisson" v={z.varPoisson.toFixed(1)} n="equals the mean" />
        <Stat k="Variance, full NB" v={z.varFull.toFixed(1)} n={`r total ${z.rTotal.toFixed(1)}`} />
        <Stat k="Variance, desk mix" v={z.varDesk.toFixed(1)} n="65 / 35 on each margin" />
        <Stat
          k="Over 13.5"
          v={pct(tail.negbin)}
          n={`Poisson ${pct(tail.poisson)} · desk ${pct(tail.marginMix)}`}
        />
      </div>
      <div className="overflow-x-auto rounded-lg bg-card shadow-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 font-medium">Poisson</th>
              <th className="px-3 py-2 font-medium">Full NB</th>
              <th className="px-3 py-2 font-medium">Margin mix</th>
              <th className="px-3 py-2 font-medium">Total mix</th>
            </tr>
          </thead>
          <tbody>
            {z.lines.map((row) => (
              <tr key={row.line} className="border-b border-border last:border-0">
                <td className="px-3 py-2">Over {row.line.toFixed(1)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.poisson)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.negbin)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.marginMix)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{pct(row.totalMix)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-xs text-muted-foreground tabular-nums">
        Over 9.5: one NB on the total {pct(z.singleNbOver95)} against the two-margin convolution{" "}
        {pct(mid.negbin)}. Same law, same p. The line on the mean barely moves. Over 13.5 is where the
        variance shows.
      </p>
    </section>
  );
}

function pp(n: number): string {
  const v = n * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} pp`;
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

function SkellamBars({
  ks,
  indep,
  shock,
}: {
  ks: readonly number[];
  indep: number[];
  shock: number[];
}) {
  const peak = Math.max(0.08, ...indep, ...shock);
  const w = 320;
  const h = 88;
  const gap = 4;
  const slot = (w - 16) / ks.length;
  const barW = (slot - gap) / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-foreground" aria-label="Skellam goal-difference PMF">
      {ks.map((k, i) => {
        const x0 = 8 + i * slot;
        const ih = (indep[i] ?? 0) / peak;
        const sh = (shock[i] ?? 0) / peak;
        return (
          <g key={k}>
            <rect
              x={x0}
              y={8 + (h - 24) * (1 - ih)}
              width={barW}
              height={(h - 24) * ih}
              fill="currentColor"
              opacity={0.28}
            />
            <rect
              x={x0 + barW + 1}
              y={8 + (h - 24) * (1 - sh)}
              width={barW}
              height={(h - 24) * sh}
              fill="currentColor"
              opacity={0.85}
            />
            <text x={x0 + slot / 2 - 2} y={h - 4} textAnchor="middle" fontSize="8" fill="currentColor" opacity={0.6}>
              {k}
            </text>
          </g>
        );
      })}
    </svg>
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