import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  SIG_ALPHA,
  STOREY_LAMBDA,
  benjaminiHochberg,
  bhProcedure,
  bonferroni,
  byHarmonicTerms,
  byMethod,
  byPrice,
  byPricePath,
  cardSignificance,
  dependenceRegimes,
  deskDependence,
  equicorrelationPath,
  gaussianRegime,
  fmtInterval,
  fmtP,
  fmtPct,
  powerCurve,
  settledBinomial,
  significanceReport,
  spreadNulls,
  stepProcedures,
  storeyLambdaSensitivity,
  storeyReport,
  storeyQTrace,
  verdictLabel,
  type FdrRow,
  type Interval,
  type PickSignificance,
  type SigVerdict,
  type StoreyLambdaMode,
} from "@/lib/football/significance";
import type { ScoredPick } from "@/lib/football/types";

const STOREY_PRESETS = [
  { id: "sparse", label: "Sparse signals" },
  { id: "weak", label: "Weak leaks" },
  { id: "noise", label: "All noise" },
  { id: "this", label: "This p + nulls" },
  { id: "live", label: "Live card" },
] as const;

const LAMBDA_MODES: Array<{ id: StoreyLambdaMode; label: string }> = [
  { id: "fixed", label: "λ slider" },
  { id: "bootstrap", label: "Bootstrap λ*" },
  { id: "smoother", label: "Smoother @ 0.95" },
];

const SPARSE_PS = [0.001, 0.002, 0.003, 0.01, 0.02, 0.03, 0.04, 0.6, 0.7, 0.8];
const WEAK_PS = [0.01, 0.02, 0.04, 0.06, 0.08, 0.12, 0.2, 0.55, 0.7, 0.9];
const BH_GAP = [0.001, 0.012, 0.032, 0.039, 0.2];
const BH_CLASSIC = [0.001, 0.008, 0.03, 0.04, 0.2];
const BH_PILE = Array.from({ length: 10 }, () => 0.04);
const STEP_SPLIT = [0.011, 0.014, 0.015, 0.04, 0.2];

const STEP_PRESETS = [
  { id: "split", label: "Step split" },
  { id: "gap", label: "Prefix gap" },
  { id: "pile", label: "Ten at 4%" },
  { id: "live", label: "Live card" },
] as const;

const BH_PRESETS = [
  { id: "gap", label: "Prefix gap" },
  { id: "classic", label: "Classic five" },
  { id: "pile", label: "Ten at 4%" },
  { id: "live", label: "Live card" },
] as const;

const REGIME_PRESETS = [
  { id: "spoiler", label: "One spoiler" },
  { id: "separate", label: "Separate" },
  { id: "same", label: "Same-way" },
  { id: "opposed", label: "Opposed" },
  { id: "live", label: "Live card" },
] as const;

function regimePreset(id: (typeof REGIME_PRESETS)[number]["id"]): Array<{ fixtureId: number; kind: "home" | "away" | "over_25" | "under_25" | "over_15" }> {
  if (id === "same") {
    return Array.from({ length: 5 }, (_, i) => [
      { fixtureId: i + 1, kind: "home" as const },
      { fixtureId: i + 1, kind: "over_25" as const },
    ]).flat();
  }
  if (id === "spoiler") {
    return [
      { fixtureId: 1, kind: "home" as const },
      { fixtureId: 1, kind: "away" as const },
      ...Array.from({ length: 8 }, (_, i) => ({ fixtureId: i + 2, kind: "over_25" as const })),
    ];
  }
  if (id === "opposed") {
    return Array.from({ length: 5 }, (_, i) => [
      { fixtureId: i + 1, kind: "over_25" as const },
      { fixtureId: i + 1, kind: "under_25" as const },
    ]).flat();
  }
  return Array.from({ length: 10 }, (_, i) => ({ fixtureId: i + 1, kind: "home" as const }));
}

const PROOF_ROWS = [
  { id: "independence" as const, name: "Independence", when: "Separate matches. BH 1995." },
  { id: "prds" as const, name: "PRDS", when: "Same direction, or ρ ≥ 0. BH still proved." },
  { id: "arbitrary" as const, name: "Arbitrary", when: "An opposed pair, or ρ < 0. Only BY." },
];

const PRESETS = [
  { id: "cliff", label: "Last-5 4/5", k: 4, n: 5, p0: 0.55 },
  { id: "lock", label: "Last-5 5/5", k: 5, n: 5, p0: 0.5 },
  { id: "book20", label: "Last-20 14/20", k: 14, n: 20, p0: 0.55 },
  { id: "sig20", label: "Last-20 16/20", k: 16, n: 20, p0: 0.55 },
  { id: "overlay", label: "Overlay 35/60", k: 35, n: 60, p0: 0.5 },
  { id: "coin", label: "Coin 25/50", k: 25, n: 50, p0: 0.5 },
] as const;

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-card p-4 shadow-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{hint}</p>
    </div>
  );
}

function IntervalTrack({
  iv,
  p0,
  phat,
  label,
}: {
  iv: Interval;
  p0: number;
  phat: number;
  label: string;
}) {
  const lo = iv.lo * 100;
  const hi = iv.hi * 100;
  const width = Math.max(0.6, hi - lo);
  return (
    <div className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="relative h-3 rounded-full bg-muted">
        <div
          className="absolute top-0 h-3 rounded-full bg-pitch/80"
          style={{ left: `${lo}%`, width: `${width}%` }}
        />
        <div
          className="absolute top-[-3px] h-[18px] w-px bg-foreground"
          style={{ left: `${p0 * 100}%` }}
          title="book"
        />
        <div
          className="absolute top-[-3px] h-[18px] w-px bg-primary"
          style={{ left: `${phat * 100}%` }}
          title="rate"
        />
      </div>
      <p className="text-right font-mono text-xs tabular-nums text-muted-foreground">{fmtInterval(iv)}</p>
    </div>
  );
}

function verdictClass(v: SigVerdict): string {
  if (v === "significant") return "text-pitch";
  if (v === "against") return "text-destructive";
  return "text-muted-foreground";
}

export function SignificancePanel({
  fold,
  rest,
}: {
  fold?: ScoredPick[];
  rest?: ScoredPick[];
}) {
  const [n, setN] = useState(5);
  const [k, setK] = useState(4);
  const [p0, setP0] = useState(0.55);
  const [alpha, setAlpha] = useState(SIG_ALPHA);
  const [mCard, setMCard] = useState(10);
  const [lambda, setLambda] = useState(STOREY_LAMBDA);
  const [storeySrc, setStoreySrc] = useState<(typeof STOREY_PRESETS)[number]["id"]>("sparse");
  const [storeyMode, setStoreyMode] = useState<StoreyLambdaMode>("fixed");
  const [bhSrc, setBhSrc] = useState<(typeof BH_PRESETS)[number]["id"]>("gap");
  const [stepSrc, setStepSrc] = useState<(typeof STEP_PRESETS)[number]["id"]>("split");
  const [byM, setByM] = useState(10);
  const [regimeSrc, setRegimeSrc] = useState<(typeof REGIME_PRESETS)[number]["id"]>("spoiler");
  const [rho, setRho] = useState(0);
  const [pi0By, setPi0By] = useState(1);
  const [qSrc, setQSrc] = useState<"pull" | "storey">("pull");

  const kk = Math.max(0, Math.min(n, k));
  const preset = PRESETS.find((p) => p.n === n && p.k === kk && Math.abs(p.p0 - p0) < 1e-9)?.id ?? null;
  const report = useMemo(() => significanceReport(kk, n, p0, alpha), [kk, n, p0, alpha]);
  const curve = useMemo(() => powerCurve(p0, Math.min(0.95, p0 + 0.1), alpha), [p0, alpha]);
  const live = useMemo(() => cardSignificance(fold ?? [], rest ?? [], alpha), [fold, rest, alpha]);
  const settled = useMemo(() => settledBinomial([...(fold ?? []), ...(rest ?? [])]), [fold, rest]);
  const thisP = report.test.pOneGreater;
  const dummyPs = useMemo(() => spreadNulls(mCard, thisP), [mCard, thisP]);
  const bhDemo = benjaminiHochberg(dummyPs, alpha);
  const bonDemo = bonferroni(dummyPs, alpha);
  const storeyPs = useMemo(() => {
    if (storeySrc === "noise") return spreadNulls(10);
    if (storeySrc === "weak") return WEAK_PS;
    if (storeySrc === "this") return dummyPs;
    if (storeySrc === "live") {
      const ps = live.fdr.map((r) => r.p);
      if (ps.length >= 3) return ps;
    }
    return SPARSE_PS;
  }, [storeySrc, dummyPs, live.fdr]);
  const sensitivity = useMemo(() => storeyLambdaSensitivity(storeyPs, alpha), [storeyPs, alpha]);
  const storey = useMemo(
    () => storeyReport(storeyPs, lambda, alpha, storeyMode),
    [storeyPs, lambda, alpha, storeyMode],
  );
  const leadQ = storey.q.length ? Math.min(...storey.q) : null;
  const bhPs = useMemo(() => {
    if (bhSrc === "classic") return BH_CLASSIC;
    if (bhSrc === "pile") return BH_PILE;
    if (bhSrc === "live") {
      const ps = live.fdr.map((r) => r.p);
      if (ps.length >= 2) return ps;
    }
    return BH_GAP;
  }, [bhSrc, live.fdr]);
  const bh = useMemo(() => bhProcedure(bhPs, alpha), [bhPs, alpha]);
  const stepPs = useMemo(() => {
    if (stepSrc === "gap") return BH_GAP;
    if (stepSrc === "pile") return BH_PILE;
    if (stepSrc === "live") {
      const ps = live.fdr.map((r) => r.p);
      if (ps.length >= 2) return ps;
    }
    return STEP_SPLIT;
  }, [stepSrc, live.fdr]);
  const steps = useMemo(() => stepProcedures(stepPs, alpha), [stepPs, alpha]);
  const price = useMemo(() => byPrice(byM, alpha), [byM, alpha]);
  const pricePath = useMemo(() => byPricePath(40, alpha), [alpha]);
  const terms = useMemo(() => byHarmonicTerms(byM), [byM]);
  const dependence = useMemo(
    () => deskDependence((fold ?? []).map((p) => ({ fixtureId: p.fixtureId, kind: p.kind }))),
    [fold],
  );
  const regimePicks = useMemo(() => {
    if (regimeSrc === "live") return (fold ?? []).map((p) => ({ fixtureId: p.fixtureId, kind: p.kind }));
    return regimePreset(regimeSrc);
  }, [regimeSrc, fold]);
  const regimes = useMemo(() => dependenceRegimes(regimePicks, alpha), [regimePicks, alpha]);
  const rhoPath = useMemo(() => equicorrelationPath(Math.max(2, regimes.m || byM)), [regimes.m, byM]);
  const gauss = gaussianRegime(rho, Math.max(2, regimes.m || byM));
  const method = useMemo(() => byMethod(bhPs, alpha, pi0By), [bhPs, alpha, pi0By]);
  const qTrace = useMemo(
    () => (qSrc === "storey" ? storeyQTrace(storeyPs, storey.pi0) : storeyQTrace(BH_GAP, 0.5)),
    [qSrc, storeyPs, storey.pi0],
  );

  function applyPreset(id: (typeof PRESETS)[number]["id"]) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setN(p.n);
    setK(p.k);
    setP0(p.p0);
  }

  const fdrById = new Map(live.fdr.map((r) => [r.id, r]));
  const shown = live.rows
    .filter((r) => r.onTen || r.evidence)
    .sort((a, b) => (a.p ?? 1) - (b.p ?? 1));

  return (
    <div className="space-y-8" data-qa="sig-lab">
      <section className="space-y-2">
        <h2 className="font-display text-xl">Statistical significance</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Data-backed is not the same as significant. Last-five 4/5 against a 1.82 Shin line looks like a lock;
          Wilson (1927) puts that rate in 38–96%, which still contains the book. Wald collapses to a point on
          0/n and 5/5 — that is the interval we do not use. Clopper–Pearson is the exact belt (wider).
          Agresti–Coull adds two of each. Power at a 10pp edge needs a three-digit sample, not five matches.
          Ten simultaneous claims are a search: Bonferroni is α/10; Benjamini–Hochberg keeps the false-discovery
          rate at 5% assuming every line is a null (π₀ = 1). Storey (2002) estimates π₀ from the upper tail of
          p-values and shrinks q below the BH number when some of the ten are real. A ten-fold rarely has a
          usable tail, so q falls back to BH. This tab does not rank the ten.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={preset === p.id ? "default" : "outline"}
            className="whitespace-nowrap"
            onClick={() => applyPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="sig-n">Sample n</Label>
            <span className="font-mono text-sm tabular-nums">{n}</span>
          </div>
          <input
            id="sig-n"
            type="range"
            className="dc-range mt-1 w-full"
            min={3}
            max={120}
            step={1}
            value={n}
            onChange={(e) => {
              const next = Number(e.target.value);
              setN(next);
              if (k > next) setK(next);
            }}
            aria-label="Sample size"
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="sig-k">Hits k</Label>
            <span className="font-mono text-sm tabular-nums">
              {kk}/{n}
            </span>
          </div>
          <input
            id="sig-k"
            type="range"
            className="dc-range mt-1 w-full"
            min={0}
            max={n}
            step={1}
            value={kk}
            onChange={(e) => {
              setK(Number(e.target.value));
            }}
            aria-label="Hits"
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="sig-p0">Book p₀</Label>
            <span className="font-mono text-sm tabular-nums">{(p0 * 100).toFixed(0)}%</span>
          </div>
          <input
            id="sig-p0"
            type="range"
            className="dc-range mt-1 w-full"
            min={0.3}
            max={0.8}
            step={0.01}
            value={p0}
            onChange={(e) => {
              setP0(Number(e.target.value));
            }}
            aria-label="Book implied probability"
          />
        </div>
        <div>
          <Label>α</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[0.01, 0.05, 0.1].map((a) => (
              <Button
                key={a}
                type="button"
                size="sm"
                variant={alpha === a ? "default" : "outline"}
                className="whitespace-nowrap"
                onClick={() => setAlpha(a)}
              >
                {(a * 100).toFixed(0)}%
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Rate" value={fmtPct(report.phat)} hint={`${report.k} / ${report.n}`} />
        <Stat
          label="Wilson 95%"
          value={fmtInterval(report.wilson)}
          hint={report.wilsonExcludesP0 ? "excludes the book" : "book still inside"}
        />
        <Stat
          label="Exact p"
          value={fmtP(report.test.pOneGreater)}
          hint={`H₀: p = ${(p0 * 100).toFixed(0)}% · one-sided`}
        />
        <Stat
          label="Power +10pp"
          value={fmtPct(report.power)}
          hint={
            report.power <= 0
              ? "no 5% reject region at this n"
              : report.n80
                ? `n ≈ ${report.n80} for 80%`
                : "no n ≤ 2000 hits 80%"
          }
        />
      </div>

      <p className={`font-mono text-sm tabular-nums ${verdictClass(report.verdict)}`} data-qa="sig-verdict">
        {verdictLabel(report.verdict)}
        {report.test.reject5Greater ? " · p < 5%" : " · cannot reject the book"}
        {` · Wald ${fmtInterval(report.wald)}${report.wald.clipped ? " (clipped)" : ""}`}
      </p>

      <div className="rounded-lg bg-card p-4 shadow-border">
        <p className="mb-3 text-xs text-muted-foreground">
          Bone tick is the book, cream is k/n. Wald is the small-n failure; Wilson is the desk default.
        </p>
        <div className="space-y-3">
          <IntervalTrack iv={report.wald} p0={p0} phat={report.phat} label="Wald" />
          <IntervalTrack iv={report.wilson} p0={p0} phat={report.phat} label="Wilson" />
          <IntervalTrack iv={report.agresti} p0={p0} phat={report.phat} label="Agresti–Coull" />
          <IntervalTrack iv={report.clopper} p0={p0} phat={report.phat} label="Clopper–Pearson" />
        </div>
      </div>

      <div className="rounded-lg bg-card p-4 shadow-border">
        <p className="mb-2 text-xs text-muted-foreground">
          Power vs n at a +10pp alternative, α {(alpha * 100).toFixed(0)}%. Sage dashed line is 80%. Last-5 sits at the
          left wall — n=5 cannot reject a 55% book at 5% even on 5/5.
        </p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="n"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                domain={[0, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-foreground)",
                }}
                formatter={(v: number) => [`${(Number(v) * 100).toFixed(0)}%`, "power"]}
              />
              <ReferenceLine y={0.8} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="power" stroke="var(--color-pitch)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Ten claims, not one test</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          A 4% p-value on one line is not a 4% error rate on a ten-fold. Bonferroni divides α by m. BH (1995)
          is less grim: it controls the share of false discoveries, not the chance of any. The other m − 1 tests
          here are spread nulls (not a pile of 40%), so Storey still has a tail to estimate π₀.
        </p>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="sig-m">Tests on the card m</Label>
            <span className="font-mono text-sm tabular-nums">{mCard}</span>
          </div>
          <input
            id="sig-m"
            type="range"
            className="dc-range mt-1 w-full"
            min={1}
            max={20}
            step={1}
            value={mCard}
            onChange={(e) => setMCard(Number(e.target.value))}
            aria-label="Number of tests"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="This p" value={fmtP(thisP)} hint={`Bonferroni bar ${fmtP(alpha / mCard)}`} />
          <Stat
            label="Bonferroni"
            value={bonDemo[0] ? "kept" : "dropped"}
            hint={`α / ${mCard}`}
          />
          <Stat label="BH" value={bhDemo.reject[0] ? "kept" : "dropped"} hint="FDR 5% among m · π₀ = 1" />
        </div>
      </section>

      <section className="space-y-3" data-qa="sig-bh">
        <h3 className="font-display text-lg">How the step-up decides</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Sort the p-values. Draw the line (r/m)α. k* is the largest rank that sits on or under that line.
          Every rank up to k* is kept — including one that missed its own bar, if a worse rank cleared a higher
          bar. That is the prefix gap. Adjusted p is not (m/r)p: it is the running minimum of those ratios from
          the right, which is why the gap’s p-value can still print under 5%. BY (2001) divides every bar by
          H_m when dependence can be arbitrary. Whether this card has to pay that tax is the next block.
          This block does not rank the ten.
        </p>
        <div className="flex flex-wrap gap-2">
          {BH_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={bhSrc === p.id ? "default" : "outline"}
              className="whitespace-nowrap"
              onClick={() => setBhSrc(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="k*" value={String(bh.kStar)} hint={bh.cutoff == null ? "nothing clears" : `cutoff ${fmtP(bh.cutoff)}`} />
          <Stat label="Prefix gaps" value={String(bh.gaps)} hint="kept, but above their own bar" />
          <Stat label="BY keeps" value={`${bh.byKStar}/${bh.m}`} hint={`H_${bh.m} = ${bh.harmonic.toFixed(2)}`} />
          <Stat label="FDR budget" value={bh.budget.toFixed(2)} hint={`≤ ${(alpha * 100).toFixed(0)}% × ${bh.kStar} keeps`} />
        </div>
        <div className="rounded-lg bg-card p-4 shadow-border">
          <p className="mb-2 text-xs text-muted-foreground">
            Sage is the ordered p-value. Bone is the BH bar. The dashed line is the BY bar — same slope, divided by H_m.
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bh.steps} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="rank"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                  formatter={(v: number, name: string) => [`${(Number(v) * 100).toFixed(1)}%`, name === "p" ? "p" : name === "byBar" ? "BY bar" : "BH bar"]}
                />
                <Line type="monotone" dataKey="p" stroke="var(--color-pitch)" strokeWidth={2} dot />
                <Line type="monotone" dataKey="bhBar" stroke="var(--color-muted-foreground)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="byBar" stroke="var(--color-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {bh.steps.length ? (
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Rank</th>
                  <th className="px-3 py-2 font-medium text-right">p</th>
                  <th className="px-3 py-2 font-medium text-right">BH bar</th>
                  <th className="px-3 py-2 font-medium text-right">Own bar</th>
                  <th className="px-3 py-2 font-medium text-right">Kept</th>
                  <th className="px-3 py-2 font-medium text-right">Adj p</th>
                  <th className="px-3 py-2 font-medium text-right">BY</th>
                </tr>
              </thead>
              <tbody>
                {bh.steps.map((s) => (
                  <tr key={s.rank} className={`border-t border-border ${s.gap ? "bg-muted/40" : ""}`}>
                    <td className="px-3 py-1.5 font-mono tabular-nums">
                      {s.rank}
                      {s.gap ? <span className="ml-2 text-xs tracking-wide text-pitch uppercase">gap</span> : null}
                      {s.rank === bh.kStar ? <span className="ml-2 text-xs text-muted-foreground">k*</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtP(s.p)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtP(s.bhBar)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{s.ownBar ? "yes" : "no"}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{s.kept ? "keep" : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtP(s.adjusted)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                      {s.byKept ? "keep" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3" data-qa="sig-steps">
        <h3 className="font-display text-lg">BH next to Holm and Hochberg</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Three procedures, two error rates. Order the p-values. Bonferroni keeps p ≤ α/m. Holm (1979) is
          step-down: reject rank r only if it and every rank before it clear α/(m−r+1), and stop at the first
          miss. Hochberg (1988) uses those same bars but steps up: keep the prefix through the last rank that
          clears its bar. BH (1995) steps up on the higher line (r/m)α. On any fixed list the keeps nest —
          Bonferroni inside Holm inside Hochberg inside BH — because the Holm–Hochberg bars sit on or under the
          BH line. The first three control the familywise error, the chance of any false keep. BH controls the
          share of false keeps. That is why it is allowed to keep more. Hochberg is not BH. This does not rank
          the ten.
        </p>
        <div className="flex flex-wrap gap-2">
          {STEP_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={stepSrc === p.id ? "default" : "outline"}
              className="whitespace-nowrap"
              onClick={() => setStepSrc(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Bonferroni" value={String(steps.bonKeeps)} hint="FWER · α/m" />
          <Stat label="Holm" value={String(steps.holmKeeps)} hint="FWER · step-down" />
          <Stat label="Hochberg" value={String(steps.hochbergKeeps)} hint="FWER · step-up, same bars as Holm" />
          <Stat label="BH" value={String(steps.bhKeeps)} hint="FDR · step-up on (r/m)α" />
        </div>
        <div className="rounded-lg bg-card p-4 shadow-border">
          <p className="mb-2 text-xs text-muted-foreground">
            Sage is the ordered p-value. Bone is the Holm–Hochberg bar. The dashed line is the BH bar — same at the first and last rank, higher in the middle.
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={steps.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="rank"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                  formatter={(v: number, name: string) => [
                    `${(Number(v) * 100).toFixed(1)}%`,
                    name === "p" ? "p" : name === "bhBar" ? "BH bar" : "Holm bar",
                  ]}
                />
                <Line type="monotone" dataKey="p" stroke="var(--color-pitch)" strokeWidth={2} dot />
                <Line type="monotone" dataKey="holmBar" stroke="var(--color-foreground)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="bhBar" stroke="var(--color-muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {steps.rows.length ? (
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Rank</th>
                  <th className="px-3 py-2 font-medium text-right">p</th>
                  <th className="px-3 py-2 font-medium text-right">Holm bar</th>
                  <th className="px-3 py-2 font-medium text-right">Holm</th>
                  <th className="px-3 py-2 font-medium text-right">Hochberg</th>
                  <th className="px-3 py-2 font-medium text-right">BH</th>
                </tr>
              </thead>
              <tbody>
                {steps.rows.map((s) => (
                  <tr key={s.rank} className={`border-t border-border ${s.bh !== s.holm ? "bg-muted/40" : ""}`}>
                    <td className="px-3 py-1.5 font-mono tabular-nums">{s.rank}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{(s.p * 100).toFixed(2)}%</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{(s.holmBar * 100).toFixed(2)}%</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{s.holm ? "keep" : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{s.hochberg ? "keep" : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{s.bh ? "keep" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3" data-qa="sig-by">
        <h3 className="font-display text-lg">When BY is the tax</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          BH at level α is proved for independent tests and for PRDS — positive dependence, the case of several
          overs moving with the same night. Under arbitrary dependence the same procedure is only guaranteed up
          to α times H_m. BY divides every bar by H_m and puts the ceiling back at α. The log is necessary in
          the worst case; a mild negative correlation cannot get more negative than −1/(m−1), and that usually
          does not break BH. Opposite legs on one fixture (home against away, over against under) are the case
          that can. Same-direction legs on a shared fixture stay on BH. One opposed pair changes the proof for the
          whole card — next block. This does not rank the ten.
        </p>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="sig-by-m">Tests m</Label>
            <span className="font-mono text-sm tabular-nums">{byM}</span>
          </div>
          <input
            id="sig-by-m"
            type="range"
            className="dc-range mt-1 w-full"
            min={1}
            max={40}
            step={1}
            value={byM}
            onChange={(e) => setByM(Number(e.target.value))}
            aria-label="BY card size"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="H_m" value={price.harmonic.toFixed(2)} hint={`ln m + γ ≈ ${price.lnApprox.toFixed(2)}`} />
          <Stat label="α / H_m" value={`${(price.alphaBy * 100).toFixed(1)}%`} hint="BY’s effective level" />
          <Stat label="Worst-case BH" value={`${(price.worstBh * 100).toFixed(1)}%`} hint="α · H_m, adversarial dependence" />
          <Stat
            label="This card"
            value={dependence.m ? dependence.procedure : "—"}
            hint={
              !dependence.m
                ? "scan a date"
                : dependence.regime === "opposed"
                  ? `${dependence.opposed} opposed fixture${dependence.opposed === 1 ? "" : "s"}`
                  : dependence.regime === "same-way"
                    ? `${dependence.shared} shared, same way`
                    : "separate matches"
            }
          />
        </div>
        <div className="rounded-lg bg-card p-4 shadow-border">
          <p className="mb-2 text-xs text-muted-foreground">
            Sage is H_m. Bone dashed is ln m + γ + 1/(2m). The tax grows like a log, not like Bonferroni’s 1/m.
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pricePath} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="m"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  domain={[0, 5]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                  formatter={(v: number, name: string) => [Number(v).toFixed(2), name === "lnApprox" ? "ln m + γ" : "H_m"]}
                />
                <ReferenceLine x={byM} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="harmonic" stroke="var(--color-pitch)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lnApprox" stroke="var(--color-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg bg-card p-4 shadow-border">
          <p className="mb-2 text-xs text-muted-foreground">
            The summands of H_m. The k = 1 term is a third of a ten-fold’s tax. The rest is the log.
          </p>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={terms} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="k"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  domain={[0, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                  formatter={(v: number) => [Number(v).toFixed(3), "1/k"]}
                />
                <Bar dataKey="term" fill="var(--color-pitch)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="space-y-3" data-qa="sig-by-method">
        <h3 className="font-display text-lg">The BY method</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          There is no second procedure. Benjamini–Yekutieli is Benjamini–Hochberg run at α′ = α / H_m. Order the
          p-values from the step-up card above, divide the level by the harmonic number, then take the same
          step-up. Under arbitrary dependence the proof delivers FDR ≤ π₀α, which is less than α whenever some
          lines are real. The method does not estimate π₀ and does not spend that slack. Spending it is Storey,
          and Storey is not proved once a pair can move against each other. This does not rank the ten.
        </p>
        <ol className="max-w-3xl list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Order the {method.m || "—"} p-values on the step-up card.</li>
          <li>c(m) = H_m = {method.harmonic ? method.harmonic.toFixed(2) : "—"}.</li>
          <li>Feed ordinary BH the level α′ = {(method.alphaPrime * 100).toFixed(2)}%, not {(alpha * 100).toFixed(0)}%.</li>
          <li>
            k* = {method.kStar}. Reject ranks 1 through k*
            {method.cutoff == null ? "." : `, cutoff ${fmtP(method.cutoff)}.`}
          </li>
        </ol>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="α′" value={`${(method.alphaPrime * 100).toFixed(2)}%`} hint="α / H_m, fed to BH" />
          <Stat label="BY keeps" value={`${method.keeps}/${method.m || 0}`} hint={`BH at α keeps ${method.bhKeeps}`} />
          <Stat label="Same as BH at α′" value={method.sameAsBhAtPrime ? "yes" : "no"} hint="the definition, not a second rule" />
          <Stat
            label="Proved ceiling"
            value={`${(method.provedCeiling * 100).toFixed(1)}%`}
            hint={`slack ${(method.slack * 100).toFixed(1)}pp left unspent`}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="sig-pi0-by">Assumed π₀</Label>
            <span className="font-mono text-sm tabular-nums">{pi0By.toFixed(2)}</span>
          </div>
          <input
            id="sig-pi0-by"
            type="range"
            className="dc-range mt-1 w-full"
            min={0.2}
            max={1}
            step={0.05}
            value={pi0By}
            onChange={(e) => setPi0By(Number(e.target.value))}
            aria-label="Assumed null share"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Moving π₀ changes the ceiling the proof already gave you. It does not change k*. A lower null share
            means BY is leaving power on the table, not that the bars should move.
          </p>
        </div>
      </section>

      <section className="space-y-3" data-qa="sig-regimes">
        <h3 className="font-display text-lg">Which proof covers the card</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Three regimes, two procedures. Independence (BH 1995) and PRDS (BY 2001, theorem 1.2) both let BH keep
          the false-discovery rate at α. Arbitrary dependence does not: uncorrected BH is only proved up to α·H_m,
          so the procedure that restores α is BY. PRDS is positive dependence — if one true-null leg looks more
          extreme, the others do not look less extreme. Same-direction legs on a fixture are that case. Home
          against away is not. One such pair makes the joint law arbitrary. BH on the other eight does not repair
          the pooled rate. This does not rank the ten.
        </p>
        <div className="flex flex-wrap gap-2">
          {REGIME_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={regimeSrc === p.id ? "default" : "outline"}
              className="whitespace-nowrap"
              onClick={() => setRegimeSrc(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Joint proof"
            value={regimes.m ? (regimes.proof === "prds" ? "PRDS" : regimes.proof === "arbitrary" ? "Arbitrary" : "Independence") : "—"}
            hint={regimes.m ? `${regimes.m} legs` : "scan a date"}
          />
          <Stat
            label="BH ceiling"
            value={regimes.m ? `${(regimes.bhCeiling * 100).toFixed(1)}%` : "—"}
            hint={regimes.proof === "arbitrary" ? "α · H_m on the pool" : "α, proof covers BH"}
          />
          <Stat label="Proved procedure" value={regimes.m ? regimes.procedure : "—"} hint={`BY ceiling ${(regimes.byCeiling * 100).toFixed(0)}%`} />
          <Stat
            label="PSD floor"
            value={regimes.m >= 2 ? regimes.rhoFloor.toFixed(2) : "—"}
            hint="−1/(m−1), equicorrelation"
          />
        </div>
        <div className="overflow-x-auto rounded-lg bg-card shadow-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Proof</th>
                <th className="px-3 py-2 font-medium text-right">BH ceiling</th>
                <th className="px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {PROOF_ROWS.map((row) => (
                <tr key={row.id} className={`border-t border-border ${regimes.proof === row.id ? "bg-muted/40" : ""}`}>
                  <td className="px-3 py-1.5 font-mono">
                    {row.name}
                    {regimes.proof === row.id ? <span className="ml-2 text-xs tracking-wide text-pitch uppercase">this card</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {row.id === "arbitrary" ? "α · H_m" : "α"}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{row.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {regimes.blocks.length ? (
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Block</th>
                  <th className="px-3 py-2 font-medium text-right">m</th>
                  <th className="px-3 py-2 font-medium text-right">Own proof</th>
                  <th className="px-3 py-2 font-medium text-right">BH ceiling inside</th>
                </tr>
              </thead>
              <tbody>
                {regimes.blocks.map((b) => (
                  <tr key={b.label} className={`border-t border-border ${b.proof === "arbitrary" ? "bg-muted/40" : ""}`}>
                    <td className="px-3 py-1.5 font-mono">{b.label}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{b.m}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{b.proof === "prds" ? "PRDS" : b.proof === "arbitrary" ? "Arbitrary" : "Independence"}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{`${(b.bhCeiling * 100).toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="sig-rho">Equicorrelation ρ</Label>
            <span className="font-mono text-sm tabular-nums">{rho.toFixed(2)}</span>
          </div>
          <input
            id="sig-rho"
            type="range"
            className="dc-range mt-1 w-full"
            min={-1}
            max={1}
            step={0.01}
            value={rho}
            onChange={(e) => setRho(Number(e.target.value))}
            aria-label="Equicorrelation"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {gauss.possible
              ? gauss.proof === "independence"
                ? "ρ = 0. Independence. BH is proved."
                : gauss.proof === "prds"
                  ? "ρ > 0. One-sided Gaussians are PRDS. BH is proved."
                  : `ρ below 0, still above the floor ${gauss.floor.toFixed(2)}. Possible, and BH is not proved.`
              : `Below ${gauss.floor.toFixed(2)} this is not a correlation matrix.`}
          </p>
        </div>
        <div className="rounded-lg bg-card p-4 shadow-border">
          <p className="mb-2 text-xs text-muted-foreground">
            Sage is 1 where BH is proved. The cliff is ρ = 0. The left edge is the PSD floor, not −1.
          </p>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rhoPath} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="rho"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                  tickFormatter={(v: number) => Number(v).toFixed(1)}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  domain={[0, 1]}
                  ticks={[0, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                  formatter={(v: number) => [Number(v) ? "BH proved" : "only BY", "regime"]}
                />
                <ReferenceLine x={0} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
                <Line type="stepAfter" dataKey="bhProved" stroke="var(--color-pitch)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="space-y-3" data-qa="sig-storey">
        <h3 className="font-display text-lg">Storey q-value</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          BH is Storey with π₀ pinned at 1. Storey estimates π₀ from the count of p-values above λ, divided by
          m(1 − λ). Small λ lets weak alternatives leak into the tail and overstates π₀; large λ is a coin
          flip at m = 10. Bootstrap (2002) picks λ* by MSE; the smoother (2003) fits π₀(λ) and reads it at
          0.95. When the tail is empty, both sit out and q is BH. This is a diagnosis, not a gate.
        </p>
        <div className="flex flex-wrap gap-2">
          {STOREY_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={storeySrc === p.id ? "default" : "outline"}
              className="whitespace-nowrap"
              onClick={() => setStoreySrc(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {LAMBDA_MODES.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={storeyMode === p.id ? "default" : "outline"}
              className="whitespace-nowrap"
              onClick={() => setStoreyMode(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="sig-lambda">λ</Label>
            <span className="font-mono text-sm tabular-nums">
              {storey.lambda.toFixed(2)}
              {storeyMode !== "fixed" ? ` · ${storeyMode}` : ""}
            </span>
          </div>
          <input
            id="sig-lambda"
            type="range"
            className="dc-range mt-1 w-full"
            min={0.05}
            max={0.95}
            step={0.05}
            value={lambda}
            onChange={(e) => {
              setStoreyMode("fixed");
              setLambda(Number(e.target.value));
            }}
            aria-label="Storey lambda"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="π₀"
            value={fmtPct(storey.pi0)}
            hint={storey.thin ? "thin tail — fell back to 1" : `${storey.nTail} p-values > λ`}
          />
          <Stat label="Lead q" value={fmtP(leadQ)} hint={storey.rejectQ.some(Boolean) && leadQ != null && leadQ <= alpha ? "q ≤ 5% · keep" : "q > 5% · drop"} />
          <Stat
            label="BH-adjusted"
            value={fmtP(storey.bhAdjusted.length ? Math.min(...storey.bhAdjusted) : null)}
            hint="π₀ = 1 · smallest p"
          />
          <Stat
            label="Keeps"
            value={`${storey.rejectQ.filter(Boolean).length}/${storey.m}`}
            hint={`q ≤ ${(alpha * 100).toFixed(0)}% · ${storey.thin ? "BH fallback" : storey.mode}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-qa="sig-lambda">
          <Stat
            label="λ*"
            value={sensitivity.lambdaStar != null ? sensitivity.lambdaStar.toFixed(2) : "—"}
            hint={
              sensitivity.bootstrapPi0 != null
                ? `bootstrap π₀ ${fmtPct(sensitivity.bootstrapPi0)}`
                : "no usable tail"
            }
          />
          <Stat
            label="Smoother π₀"
            value={fmtPct(sensitivity.smootherPi0)}
            hint="quadratic @ 0.95"
          />
          <Stat
            label="π₀ range"
            value={`${fmtPct(sensitivity.pi0Min)}–${fmtPct(sensitivity.pi0Max)}`}
            hint={sensitivity.unstable ? "λ-sensitive" : "stable across λ"}
          />
          <Stat
            label="Keep range"
            value={`${sensitivity.keepsMin}–${sensitivity.keepsMax}`}
            hint={`${sensitivity.flips} of ${sensitivity.m} flip`}
          />
        </div>
        <div className="rounded-lg bg-card p-4 shadow-border">
          <p className="mb-2 text-xs text-muted-foreground">
            Sage is π₀(λ). Bone is bootstrap MSE. Dashed is the active λ; a second tick is λ* when it differs.
            A jump as λ rises is leftover signal — or a dying tail.
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sensitivity.grid} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="lambda"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                  tickFormatter={(v: number) => Number(v).toFixed(1)}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                  formatter={(v: number, name: string) => [
                    `${(Number(v) * 100).toFixed(0)}%`,
                    name === "mse" ? "MSE" : "π₀",
                  ]}
                />
                <ReferenceLine x={storey.lambda} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
                {sensitivity.lambdaStar != null && Math.abs(sensitivity.lambdaStar - storey.lambda) > 1e-9 ? (
                  <ReferenceLine x={sensitivity.lambdaStar} stroke="var(--color-primary)" strokeDasharray="2 4" />
                ) : null}
                <Line type="stepAfter" dataKey="pi0" stroke="var(--color-pitch)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="mse" stroke="var(--color-muted-foreground)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {sensitivity.grid.length ? (
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">λ</th>
                  <th className="px-3 py-2 font-medium text-right">Tail</th>
                  <th className="px-3 py-2 font-medium text-right">π₀</th>
                  <th className="px-3 py-2 font-medium text-right">Lead q</th>
                  <th className="px-3 py-2 font-medium text-right">Keeps</th>
                  <th className="px-3 py-2 font-medium text-right">MSE</th>
                </tr>
              </thead>
              <tbody>
                {sensitivity.grid.map((g) => {
                  const active = Math.abs(g.lambda - storey.lambda) < 1e-9;
                  const star = sensitivity.lambdaStar != null && Math.abs(g.lambda - sensitivity.lambdaStar) < 1e-9;
                  return (
                    <tr
                      key={g.lambda}
                      className={`border-t border-border ${active ? "bg-muted/40" : ""}`}
                    >
                      <td className="px-3 py-1.5 font-mono tabular-nums">
                        {g.lambda.toFixed(2)}
                        {star ? <span className="ml-2 text-xs tracking-wide text-pitch uppercase">λ*</span> : null}
                        {g.thin ? <span className="ml-2 text-xs text-muted-foreground">thin</span> : null}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{g.nTail}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtPct(g.pi0)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtP(g.leadQ)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{g.keeps}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                        {g.mse == null ? "—" : g.mse.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3" data-qa="sig-q">
        <h3 className="font-display text-lg">How q is calculated</h3>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          At threshold t = p₍ᵣ₎ the plug-in false-discovery rate is π₀ · m · t / r. That is π₀ times the BH ratio
          (m/r)·p. The q-value at rank r is the smallest of those rates over every threshold that still includes
          this rank — walk from the worst p-value backward and keep a running minimum, then cap at 1. π₀ is a
          constant, so the minimum is just min(1, π₀ × the BH-adjusted p). A row marked pull lost to a later
          rank: its own ratio was worse than one further down the list. q is an FDR, not a p-value. This does
          not rank the ten.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={qSrc === "pull" ? "default" : "outline"} onClick={() => setQSrc("pull")}>
            Prefix pull
          </Button>
          <Button type="button" size="sm" variant={qSrc === "storey" ? "default" : "outline"} onClick={() => setQSrc("storey")}>
            This Storey card
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="π₀ in the product" value={fmtPct(qTrace.pi0)} hint={qSrc === "pull" ? "fixed at ½, so the pull is visible" : "from the λ block above"} />
          <Stat label="Identity" value={qTrace.identity ? "yes" : "no"} hint="q = min(1, π₀ × BH p)" />
          <Stat label="Pulled ranks" value={String(qTrace.pulled)} hint="own ratio lost to a later rank" />
          <Stat
            label="Lead q"
            value={fmtP(qTrace.steps.length ? Math.min(...qTrace.steps.map((s) => s.q)) : null)}
            hint="smallest q on this card"
          />
        </div>
        {qTrace.steps.length ? (
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Rank</th>
                  <th className="px-3 py-2 font-medium text-right">p</th>
                  <th className="px-3 py-2 font-medium text-right">BH ratio</th>
                  <th className="px-3 py-2 font-medium text-right">× π₀</th>
                  <th className="px-3 py-2 font-medium text-right">q</th>
                </tr>
              </thead>
              <tbody>
                {qTrace.steps.map((s) => (
                  <tr key={s.rank} className={`border-t border-border ${s.pulled ? "bg-muted/40" : ""}`}>
                    <td className="px-3 py-1.5 font-mono tabular-nums">
                      {s.rank}
                      {s.pulled ? <span className="ml-2 text-xs tracking-wide text-pitch uppercase">pull</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{(s.p * 100).toFixed(2)}%</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{(s.bhRatio * 100).toFixed(2)}%</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{(s.scaled * 100).toFixed(2)}%</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{(s.q * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg">Live card</h3>
        <p className="text-sm text-pretty text-muted-foreground">
          Last-5 WDL (or H2H when form is missing) versus Shin. Fold lines first by p. q is Storey at λ = ½;
          BH is the π₀ = 1 special case.{" "}
          {live.m
            ? `${live.storeyRejects} / ${live.m} survive Storey · ${live.bhRejects} survive BH · ${live.bonferroniRejects} survive Bonferroni${live.storeyThin ? " · π₀ thin, q = BH" : ` · π₀ ${fmtPct(live.pi0)}`}.`
            : "Scan a date to fill this."}
        </p>
        {shown.length ? (
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Line</th>
                  <th className="px-3 py-2 font-medium">k/n</th>
                  <th className="px-3 py-2 font-medium text-right">Wilson</th>
                  <th className="px-3 py-2 font-medium text-right">Book</th>
                  <th className="px-3 py-2 font-medium text-right">p</th>
                  <th className="px-3 py-2 font-medium text-right">q</th>
                  <th className="px-3 py-2 font-medium text-right">Keep</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <SigRow key={r.id} row={r} fdr={fdrById.get(r.id)} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No last-five or H2H counts on this date yet.</p>
        )}
      </section>

      {settled ? (
        <section className="space-y-3">
          <h3 className="font-display text-lg">Settled vs the book</h3>
          <p className="text-sm text-pretty text-muted-foreground">
            Finished lines on this date, H₀ = mean Shin implied. Not a walk-forward — that lives on Accuracy.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Hits" value={`${settled.k}/${settled.n}`} hint={fmtPct(settled.phat)} />
            <Stat label="Book p₀" value={fmtPct(settled.p0)} hint="mean implied" />
            <Stat label="Exact p" value={fmtP(settled.test.pOneGreater)} hint={verdictLabel(settled.verdict)} />
            <Stat label="Wilson" value={fmtInterval(settled.wilson)} hint={settled.wilsonExcludesP0 ? "excludes p₀" : "inside"} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SigRow({
  row,
  fdr,
}: {
  row: PickSignificance;
  fdr?: FdrRow;
}) {
  const kN = row.evidence ? `${row.evidence.k}/${row.evidence.n}` : "—";
  const keep = fdr?.storey ? "q" : fdr?.bh ? "BH" : fdr?.bonferroni ? "Bon" : "—";
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">
          {row.fixture}
          {row.onTen ? <span className="ml-2 text-xs tracking-wide text-pitch uppercase">ten</span> : null}
        </p>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {row.selection} · {row.odd.toFixed(2)} · {row.evidence?.label ?? "model n"}
        </p>
      </td>
      <td className="px-3 py-2 font-mono tabular-nums">{kN}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtInterval(row.report?.wilson)}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtPct(row.implied)}</td>
      <td className={`px-3 py-2 text-right font-mono tabular-nums ${verdictClass(row.verdict)}`}>{fmtP(row.p)}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtP(fdr?.q)}</td>
      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">{keep}</td>
    </tr>
  );
}
