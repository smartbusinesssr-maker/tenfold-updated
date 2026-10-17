import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  accuracyPriors,
  bayesModelAverage,
  ensembleForKind,
  kassRafteryGrade,
  OCCAM_DELTA,
  stackMixture,
  type BmaSource,
} from "@/lib/football/models";
import type { MarketFamily, ScoredPick } from "@/lib/football/types";
import { cn } from "@/lib/utils";

export interface BmaSeed {
  id: string;
  label: string;
  selection: string;
  family: MarketFamily;
  sources: BmaSource[];
  shin: number;
}

const DEMO: BmaSeed = {
  id: "demo",
  label: "Worked 1X2",
  selection: "Home",
  family: "win",
  shin: 0.51,
  sources: [
    { id: "dc", label: "Dixon–Coles", p: 0.44, prior: 0.26 },
    { id: "shin", label: "Shin", p: 0.51, prior: 0.28 },
    { id: "api", label: "API-Football", p: 0.47, prior: 0.18 },
    { id: "elo", label: "Pi / Elo", p: 0.41, prior: 0.16 },
    { id: "h2h", label: "Baio H2H", p: 0.38, prior: 0.12 },
  ],
};

export function seedsFromBmaPicks(picks: ScoredPick[], limit = 10): BmaSeed[] {
  const acc: BmaSeed[] = [];
  for (const p of picks) {
    if (acc.length >= limit) break;
    const pri = accuracyPriors(p.family);
    const shin = p.models.shin ?? p.implied;
    acc.push({
      id: p.id,
      label: `${p.home} v ${p.away}`,
      selection: p.selection,
      family: p.family,
      shin,
      sources: [
        { id: "dc", label: "Dixon–Coles", p: p.models.dixonColes, prior: pri.dc },
        { id: "shin", label: "Shin", p: shin, prior: pri.shin },
        { id: "api", label: "API-Football", p: p.models.apiFootball, prior: pri.api },
        { id: "elo", label: "Pi / Elo", p: p.models.hvattumElo, prior: pri.elo },
        { id: "h2h", label: "Baio H2H", p: p.models.baioH2h, prior: pri.h2h },
      ],
    });
  }
  return acc;
}

function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function bfTxt(bf: number): string {
  if (bf <= 1.001) return "1";
  if (bf >= 100) return ">100";
  return bf < 10 ? bf.toFixed(1) : bf.toFixed(0);
}

export function BmaPanel({ seeds }: { seeds: BmaSeed[] }) {
  const [seedId, setSeedId] = useState<string>(seeds[0]?.id ?? "demo");
  const [n, setN] = useState(8);
  const [occam, setOccam] = useState(false);
  const seed = seeds.find((s) => s.id === seedId) ?? seeds[0] ?? DEMO;
  const sources = seed.sources;
  const shin = seed.shin;

  const priorTot = sources.reduce((a, s) => a + s.prior, 0) || 1;
  const priorW = sources.map((s) => s.prior / priorTot);
  const priorPool = sources.reduce((a, s, i) => a + priorW[i] * s.p, 0);

  const bma = useMemo(
    () => bayesModelAverage(sources, shin, n, Infinity),
    [sources, shin, n],
  );
  const occamFit = useMemo(
    () => bayesModelAverage(sources, shin, n, occam ? OCCAM_DELTA : Infinity),
    [sources, shin, n, occam],
  );
  const stack = useMemo(() => stackMixture(sources, shin), [sources, shin]);
  const desk = useMemo(() => {
    const shinSrc = sources.find((s) => s.id === "shin");
    return ensembleForKind(seed.family === "win" ? "home" : seed.family === "btts" ? "btts_yes" : seed.family === "cs" ? "cs" : "over_25", {
      dc: sources.find((s) => s.id === "dc")?.p ?? 0.45,
      shin: shinSrc?.p ?? shin,
      api: sources.find((s) => s.id === "api")?.p ?? 0.45,
      elo: sources.find((s) => s.id === "elo")?.p ?? 0.45,
      h2h: sources.find((s) => s.id === "h2h")?.p ?? 0.45,
    });
  }, [sources, shin, seed.family]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="font-display text-2xl">Bayesian model averaging</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Hoeting, Madigan, Raftery & Volinsky (1999): P(Mₖ | D) ∝ P(D | Mₖ) πₖ. Likelihood is
          Gaussian on the probability, SE = 10 pp, versus Shin — expected Brier, not a full-time
          result. Drag n. BMA collapses onto the model nearest the market. Stacking (Yao 2018)
          mixes two models so the pool <em>hits</em> Shin. The ten still use the logit pool.
        </p>
      </header>

      {seeds.length ? (
        <div className="flex flex-wrap gap-2">
          {seeds.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={seedId === s.id ? "secondary" : "outline"}
              className="h-auto max-w-full whitespace-normal py-2 text-left"
              onClick={() => setSeedId(s.id)}
            >
              {s.label}
              <span className="font-mono text-muted-foreground tabular-nums">{s.selection}</span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run the desk to seed today’s fold. Worked 1X2 is loaded until then.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={n < 0.5 ? "secondary" : "outline"} onClick={() => setN(0)}>
          Priors only
        </Button>
        <Button size="sm" variant={n === 8 ? "secondary" : "outline"} onClick={() => setN(8)}>
          n = 8
        </Button>
        <Button size="sm" variant={n >= 20 ? "secondary" : "outline"} onClick={() => setN(20)}>
          Collapse n = 20
        </Button>
        <Button size="sm" variant={occam ? "secondary" : "outline"} onClick={() => setOccam((v) => !v)}>
          Occam window {OCCAM_DELTA}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl bg-card p-4 shadow-border">
          <Param
            label="Effective n (Shin as data)"
            value={n}
            min={0}
            max={40}
            step={1}
            format={(v) => v.toFixed(0)}
            onChange={setN}
            hint={
              n < 0.5
                ? "n = 0 → posterior = paper prior. Nothing has been observed."
                : `ℓₖ = −n (pₖ − s)² / (2σ²), σ = 10 pp, s = Shin ${pct(shin)}. Max weight ${pct(bma.maxWeight, 0)}.`
            }
          />
          <p className="text-xs text-pretty text-muted-foreground">
            {seed.label} · {seed.selection}. Reference s = {pct(shin)}. Desk logit-pool{" "}
            {pct(desk.accuracy)} (I² {pct(desk.i2, 0)}).
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="text-muted-foreground">Prior mix</dt>
            <dd className="text-right">{pct(priorPool)}</dd>
            <dt className="text-muted-foreground">BMA</dt>
            <dd className="text-right">{pct(bma.pooled)}</dd>
            <dt className="text-muted-foreground">Occam {OCCAM_DELTA}</dt>
            <dd className="text-right">{pct(occamFit.pooled)}</dd>
            <dt className="text-muted-foreground">Stack to Shin</dt>
            <dd className="text-right">{pct(stack.pooled)}</dd>
            <dt className="text-muted-foreground">Desk (Satopää)</dt>
            <dd className="text-right">{pct(desk.accuracy)}</dd>
          </dl>
        </div>

        <div className="rounded-xl bg-card p-4 shadow-border">
          <p className="mb-3 text-xs tracking-wide text-muted-foreground uppercase">Weights</p>
          <ul className="space-y-3">
            {sources.map((s, i) => (
              <li key={s.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    {s.label}
                    {occam && occamFit.dropped[i] ? (
                      <span className="ml-2 text-xs text-muted-foreground">dropped</span>
                    ) : null}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    p {pct(s.p)}
                  </span>
                </div>
                <WeightBar label="π" value={priorW[i]} />
                <WeightBar label="BMA" value={bma.weights[i] ?? 0} accent />
                <WeightBar label="stack" value={stack.weights[i] ?? 0} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 shadow-border">
        <p className="mb-1 text-xs tracking-wide text-muted-foreground uppercase">
          Bayes factors vs the current best · Kass & Raftery 1995
        </p>
        <p className="mb-3 text-sm text-pretty text-muted-foreground">
          BF(best, k) = exp(log π_best + ℓ_best − log π_k − ℓ_k). Grade is on 2 ln BF. Occam’s
          window (Madigan & Raftery) drops anything worse than {OCCAM_DELTA}:1.
        </p>
        <ul className="divide-y divide-border text-sm">
          {sources.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <span className={cn(occamFit.dropped[i] && "text-muted-foreground")}>{s.label}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                BF {bfTxt(bma.bfVsBest[i] ?? 1)} · {kassRafteryGrade(bma.bfVsBest[i] ?? 1)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WeightBar({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 text-xs">
      <span className="font-mono text-muted-foreground">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", accent ? "bg-pitch" : "bg-line")}
          style={{ width: `${Math.round(clamp01(value) * 100)}%` }}
        />
      </div>
      <span className="text-right font-mono tabular-nums">{pct(value, 0)}</span>
    </div>
  );
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
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
