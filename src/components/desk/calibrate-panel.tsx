import { useMemo, useState } from "react";
import {
  EXPERTS,
  EXPERT_LABELS,
  FAMILIES,
  FAMILY_LABELS,
  FIT_METHOD_LABELS,
  pctWeight,
  plattMethodTrace,
  type EnsembleFamily,
  type ExpertKey,
  type ExpertWeights,
} from "@/lib/football/calibrate";
import type { CalibrationReport, WalkForwardReport } from "@/lib/football/types";
import { Button } from "@/components/ui/button";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function brierPermille(b: number): string {
  return `${(b * 1000).toFixed(0)}‰`;
}

function skillLabel(skill: number): string {
  const sign = skill >= 0 ? "+" : "";
  return `${sign}${(skill * 100).toFixed(1)}%`;
}

function fmtP(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p < 0.001) return "<0.1%";
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
}

function PlattMethods() {
  const t = plattMethodTrace();
  return (
    <section className="space-y-3" data-qa="platt-methods">
      <h2 className="font-display text-xl">Platt</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        The map is invlogit(a · logit p + b). Temperature fits a and locks b at 0, so both tails move
        toward 1/2 together. Bias fits b and locks a at 1, so every quote shifts the same way. Full fits
        both, which is what the desk runs, inside a ∈ [0.55, 1.45] and b ∈ [−0.85, 0.85]. On a book that
        quotes 0.80 and 0.20 while the hits are half, temperature is the whole fit: 0.80 becomes 0.68 and
        bias does nothing. On a book whose quotes are simply too low, bias does the work and temperature
        barely moves. A one-price book cannot tell a from b. This does not rank the ten.
      </p>
      <PlattTable title="Overconfident, centred" shape={t.hot} />
      <PlattTable title="Every quote too low" shape={t.shifted} />
    </section>
  );
}

function PlattTable({
  title,
  shape,
}: {
  title: string;
  shape: ReturnType<typeof plattMethodTrace>["hot"];
}) {
  const rows = [
    ["Identity", shape.maps.identity, shape.brier.identity],
    ["Temperature", shape.maps.temperature, shape.brier.temperature],
    ["Bias", shape.maps.bias, shape.brier.bias],
    ["Full", shape.maps.full, shape.brier.full],
  ] as const;
  return (
    <div className="overflow-x-auto rounded-lg bg-card p-4 shadow-border">
      <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">{title}</p>
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th className="py-1.5 font-medium">Map</th>
            <th className="py-1.5 font-medium">a</th>
            <th className="py-1.5 font-medium">b</th>
            <th className="py-1.5 font-medium">Brier</th>
            <th className="py-1.5 font-medium">0.80 goes to</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map(([name, map, brier]) => (
            <tr key={name} className="border-t border-border">
              <td className="py-1.5 font-sans">{name}</td>
              <td className="py-1.5">{map.a.toFixed(2)}</td>
              <td className="py-1.5">{map.b.toFixed(2)}</td>
              <td className="py-1.5">{brier.toFixed(3)}</td>
              <td className="py-1.5">{(1 / (1 + Math.exp(-(map.a * Math.log(0.8 / 0.2) + map.b)))).toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-card p-4 shadow-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{hint}</p>
    </div>
  );
}

function WeightCompare({
  title,
  prior,
  applied,
  inSample,
  rule,
  windows,
  oosBrier,
  oosPrior,
  shrinkNote,
}: {
  title: string;
  prior: ExpertWeights;
  applied: ExpertWeights;
  inSample?: ExpertWeights;
  rule: string;
  windows: number;
  oosBrier?: number;
  oosPrior?: number;
  shrinkNote?: string;
}) {
  return (
    <div className="rounded-lg bg-card p-4 shadow-border">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {rule}
          {windows ? ` · ${windows} windows` : ""}
        </p>
      </div>
      {oosBrier != null && oosPrior != null ? (
        <p className="mb-3 text-xs text-muted-foreground">
          OOS {brierPermille(oosBrier)} vs prior {brierPermille(oosPrior)}
          {oosBrier < oosPrior - 0.0005 ? " — mix left the paper prior." : " — staying on the paper mix."}
        </p>
      ) : null}
      {shrinkNote ? <p className="mb-3 text-xs text-muted-foreground">{shrinkNote}</p> : null}
      <ul className="space-y-2">
        {EXPERTS.map((k: ExpertKey) => {
          const live = applied[k];
          const pr = prior[k];
          const ins = inSample?.[k];
          return (
            <li key={k}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span>{EXPERT_LABELS[k]}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {pctWeight(live)}
                  {Math.abs(live - pr) > 0.005 ? <span> · prior {pctWeight(pr)}</span> : null}
                  {ins != null && Math.abs(ins - live) > 0.01 ? <span> · in-sample {pctWeight(ins)}</span> : null}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary/35" style={{ width: `${pr * 100}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-pitch" style={{ width: `${live * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WeightPathChart({ wf, family }: { wf: WalkForwardReport; family: EnsembleFamily }) {
  const data = wf.folds.map((f) => ({
    date: f.date.slice(5),
    dc: Math.round((f.accByFamily?.[family] ?? f.accWin).dc * 100),
    shin: Math.round((f.accByFamily?.[family] ?? f.accWin).shin * 100),
  }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [`${value}%`, name === "dc" ? "Union grid" : "Shin"]}
          />
          <Line type="monotone" dataKey="dc" stroke="var(--color-pitch)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-pitch)" }} name="dc" />
          <Line
            type="monotone"
            dataKey="shin"
            stroke="var(--color-primary)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 2, fill: "var(--color-primary)" }}
            name="shin"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CalibratePanel({ calibration }: { calibration?: CalibrationReport | null }) {
  const applied = calibration?.applied;
  const wf = calibration?.walkForward;
  const [family, setFamily] = useState<EnsembleFamily>("win");
  const hasCorpus = Boolean(applied && applied.n > 0);
  const dm = wf?.dm;
  const fam = applied?.families[family];

  const moved = useMemo(
    () => FAMILIES.filter((f) => applied?.families[f]?.rule && applied.families[f].rule !== "prior").length,
    [applied],
  );

  return (
    <div className="space-y-8" data-qa="calibrate-lab">
      <section className="space-y-2">
        <h2 className="font-display text-xl">Backtest weights</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          The ten use a recency-weighted mean of expanding-window mixes — each window is the fit that would
          have been available that day, including the full sample as the last term. Nested walk-forward picks
          the rule (inverse-Brier, Granger–Ramanathan least squares, optional Platt scale) and only leaves the
          paper prior if that rule wins out of sample. Diebold–Mariano (Harvey–Leybourne–Newbold t on daily
          Brier, HAC) tests whether the skill is more than noise. This date does not grade itself. Shrinkage
          n₀ starts at 48; Walk-forward may replace half-life and n₀ when a grid cell wins out of sample.
          Shin is capped at 72%.
        </p>
      </section>

      <PlattMethods />

      {!hasCorpus ? (
        <p className="text-sm text-muted-foreground">
          No settled corpus yet — the ten still use the paper priors. Scan a finished date so each expert
          gets a Brier score; the next live card then mixes those backtest weights with the prior.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Corpus"
              value={`${applied!.nDates}d`}
              hint={`${applied!.n} lines before this card`}
            />
            <Stat
              label="Families moved"
              value={`${moved} / 4`}
              hint={moved ? "left the paper prior" : "all still on the paper mix"}
            />
            <Stat
              label="OOS skill"
              value={wf ? skillLabel(wf.skill) : "—"}
              hint={wf ? `${brierPermille(wf.brierCal)} vs ${brierPermille(wf.brierPrior)}` : "run a finished date"}
            />
            <Stat
              label="DM p-value"
              value={dm ? fmtP(dm.p) : "—"}
              hint={
                dm
                  ? dm.reject5
                    ? `t ${dm.t.toFixed(2)} · rejects equal Brier at 5%`
                    : `t ${dm.t.toFixed(2)} · skill not significant`
                  : "need 3 scored dates"
              }
            />
          </div>

          {dm ? (
            <p className="text-xs text-muted-foreground">
              Mean daily Brier gap {(dm.meanDiff * 1000).toFixed(1)}‰ (prior − calibrated) · HAC lag {dm.lag} ·{" "}
              {wf!.nDates} folds. One-sided H₁: the backtest mix is sharper.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {FAMILIES.map((f) => (
              <Button key={f} type="button" size="sm" variant={f === family ? "default" : "outline"} onClick={() => setFamily(f)}>
                {FAMILY_LABELS[f]}
                {applied?.families[f]?.rule && applied.families[f].rule !== "prior" ? (
                  <span className="font-mono text-muted-foreground">
                    {FIT_METHOD_LABELS[applied.families[f].rule ?? "prior"]}
                  </span>
                ) : null}
              </Button>
            ))}
          </div>

          {fam ? (
            <WeightCompare
              title={FAMILY_LABELS[family]}
              prior={fam.priorAcc}
              applied={fam.acc}
              inSample={fam.inSampleAcc}
              rule={FIT_METHOD_LABELS[fam.rule ?? "prior"]}
              windows={fam.backtestWindows ?? 0}
              oosBrier={fam.oosBrier}
              oosPrior={fam.oosPrior}
              shrinkNote={fam.autoresearch}
            />
          ) : null}

          {wf && wf.folds.length >= 2 ? (
            <div className="rounded-lg bg-card p-4 shadow-border">
              <p className="mb-2 text-xs text-muted-foreground">
                Walk-forward {FAMILY_LABELS[family]} weights (%) — sage is union grid, dashed bone is Shin.
                First fold is the paper prior.
              </p>
              <WeightPathChart wf={wf} family={family} />
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {FAMILIES.filter((f) => f !== family).map((f) => {
              const row = applied!.families[f];
              return (
                <WeightCompare
                  key={f}
                  title={FAMILY_LABELS[f]}
                  prior={row.priorAcc}
                  applied={row.acc}
                  inSample={row.inSampleAcc}
                  rule={FIT_METHOD_LABELS[row.rule ?? "prior"]}
                  windows={row.backtestWindows ?? 0}
                  oosBrier={row.oosBrier}
                  oosPrior={row.oosPrior}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
