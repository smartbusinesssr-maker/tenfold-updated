import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FAMILY_LABELS } from "@/lib/football/calibrate";
import {
  fmtOmega,
  fmtSharpe,
  sharpeFromBets,
  syntheticBook,
  unitReturn,
  type FamilySharpeRow,
  type SharpeReport,
} from "@/lib/football/sharpe";

const PRESETS = [
  { id: "overlay", label: "1.90 overlay", odd: 1.9, p: 0.58, n: 40, mar: 0 },
  { id: "coin", label: "2.00 coin", odd: 2, p: 0.5, n: 40, mar: 0 },
  { id: "long", label: "Longshot 5.00", odd: 5, p: 0.22, n: 40, mar: 0 },
  { id: "lock", label: "All-hit 1.80", odd: 1.8, p: 1, n: 24, mar: 0 },
  { id: "red", label: "Losing 1.90", odd: 1.9, p: 0.4, n: 40, mar: 0 },
] as const;

function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

function ReturnStem({
  xs,
  mar,
  flatten,
}: {
  xs: number[];
  mar: number;
  flatten: boolean;
}) {
  const shown = flatten ? xs.map((x) => Math.min(x, mar)) : xs;
  const maxAbs = Math.max(0.4, ...shown.map((x) => Math.abs(x - mar)), 0.05);
  return (
    <div className="rounded-lg bg-card p-4 shadow-border">
      <div className="flex h-36 min-h-0 overflow-hidden">
        {shown.map((x, i) => {
          const d = x - mar;
          const pct = Math.min(100, (Math.abs(d) / maxAbs) * 100);
          const down = d < 0;
          return (
            <div key={i} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-end">
                {!down && pct > 0 ? (
                  <div className="w-full rounded-sm bg-pitch" style={{ height: `${pct}%` }} />
                ) : null}
              </div>
              <div className="shrink-0 border-t border-border" />
              <div className="flex min-h-0 flex-1 items-start">
                {down && pct > 0 ? (
                  <div className="w-full rounded-sm bg-destructive/80" style={{ height: `${pct}%` }} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
        {flatten
          ? "δ construction — winners sit on MAR as zeros, they are not dropped"
          : `unit returns · MAR ${mar === 0 ? "0 (cash)" : mar.toFixed(2)} · sage above, clay below`}
      </p>
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

function Slider({
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

function FamilyTable({ rows }: { rows: FamilySharpeRow[] }) {
  const ranked = [...rows]
    .filter((r) => r.report.n >= 2)
    .sort((a, b) => (b.report.sortino ?? -999) - (a.report.sortino ?? -999));
  if (!ranked.length) return null;
  return (
    <div className="overflow-x-auto shadow-border" data-qa="sortino-family">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-medium">Family</th>
            <th className="py-2 pr-3 font-medium text-right">n</th>
            <th className="py-2 pr-3 font-medium text-right">Sortino</th>
            <th className="py-2 pr-3 font-medium text-right">Sharpe</th>
            <th className="py-2 pr-3 font-medium text-right">Omega</th>
            <th className="py-2 pr-3 font-medium text-right">κ₃</th>
            <th className="py-2 font-medium text-right">δ / σ</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row) => {
            const r = row.report;
            const label = (FAMILY_LABELS as Record<string, string>)[row.family] ?? row.family;
            const gap = r.std > 1e-12 ? r.downsideStd / r.std : null;
            return (
              <tr key={row.family} className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium">{label}</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.n}</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtSharpe(r.sortino)}</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtSharpe(r.sharpe)}</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtOmega(r.omega)}</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtSharpe(r.kappa3)}</td>
                <td className="py-2 text-right font-mono tabular-nums">{gap != null ? gap.toFixed(2) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SortinoPanel({
  corpus,
  byFamily,
}: {
  corpus?: SharpeReport | null;
  byFamily?: FamilySharpeRow[];
}) {
  const [odd, setOdd] = useState(1.9);
  const [p, setP] = useState(0.58);
  const [n, setN] = useState(40);
  const [mar, setMar] = useState(0);
  const [flatten, setFlatten] = useState(false);

  const bets = useMemo(() => syntheticBook(odd, p, n), [odd, p, n]);
  const xs = useMemo(() => bets.map((b) => unitReturn(b.odd, b.y)), [bets]);
  const report = useMemo(() => sharpeFromBets(bets, mar), [bets, mar]);
  const ev = p * odd - 1;
  const active = PRESETS.find((x) => near(x.odd, odd) && near(x.p, p) && x.n === n && near(x.mar, mar));

  return (
    <div id="sortino-lab" data-qa="sortino-lab" className="space-y-8">
      <section className="space-y-2">
        <h2 className="font-display text-xl">Sortino ratio</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Sandbox only — the daily ten are not ranked by Sortino. Same unit book as Sharpe: +(odd − 1) on a
          hit, −1 on a miss. Risk is the losing tail, not all of σ. Sortino & Price 1994 put winning
          periods in δ as zeros, they are not dropped — that is why a 1.90 overlay that mostly hits looks
          better here than on Sharpe. Omega (Keating & Shadwick 2002) is the other reading of the same
          tails: total gain over total loss versus MAR. Kappa_n (Kaplan & Knowles 2004) nests them: κ₁
          restates Omega, κ₂ is Sortino, κ₃ leans on crash tails. Desk MAR is cash.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((x) => (
          <Button
            key={x.id}
            size="sm"
            variant={active?.id === x.id ? "default" : "outline"}
            onClick={() => {
              setOdd(x.odd);
              setP(x.p);
              setN(x.n);
              setMar(x.mar);
            }}
          >
            {x.label}
          </Button>
        ))}
        <Button size="sm" variant={flatten ? "secondary" : "outline"} onClick={() => setFlatten((v) => !v)}>
          {flatten ? "Show returns" : "Show δ zeros"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="Decimal odd"
          value={odd}
          min={1.2}
          max={5}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={setOdd}
          hint={`hit pays +${(odd - 1).toFixed(2)}u`}
        />
        <Slider
          label="Hit rate"
          value={p}
          min={0.2}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={setP}
          hint={`EV ${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(1)}% vs a fair ${((1 / odd) * 100).toFixed(0)}%`}
        />
        <Slider
          label="Slips"
          value={n}
          min={8}
          max={80}
          step={2}
          format={(v) => String(v)}
          onChange={setN}
          hint="two a date, evenly spaced hits"
        />
        <Slider
          label="MAR"
          value={mar}
          min={-0.2}
          max={0.3}
          step={0.01}
          format={(v) => (v === 0 ? "0 cash" : v.toFixed(2))}
          onChange={setMar}
          hint="desk default is cash. A hurdle turns a short-priced hit into a shortfall."
        />
      </div>

      <ReturnStem xs={xs} mar={mar} flatten={flatten} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sortino" value={fmtSharpe(report.sortino)} hint="(μ − MAR) / δ · winners as 0" />
        <Stat label="Sharpe" value={fmtSharpe(report.sharpe)} hint="μ / σ · rf 0" />
        <Stat label="Omega" value={fmtOmega(report.omega)} hint="UPM₁ / LPM₁" />
        <Stat
          label="κ₃"
          value={fmtSharpe(report.kappa3)}
          hint={report.kappa1 != null ? `κ₁ ${fmtSharpe(report.kappa1)} · Ω = 1+κ₁` : "crash-tail Kappa"}
        />
        <Stat
          label="Downside δ"
          value={`${(report.downsideStd * 100).toFixed(0)}%`}
          hint={`semi ${((report.semiDeviation || 0) * 100).toFixed(0)}% · full σ ${(report.std * 100).toFixed(0)}%`}
        />
        <Stat
          label="Wrong Sortino"
          value={fmtSharpe(report.sortinoSemi)}
          hint="n_loss in the denominator — the drop-winners bug"
        />
        <Stat label="UPR" value={fmtSharpe(report.upr)} hint="mean upside / same δ" />
        <Stat
          label="Losing slips"
          value={`${report.nLoss}/${report.n}`}
          hint={`hit ${Math.round(report.hitRate * 100)}% · yield ${report.mean >= 0 ? "+" : ""}${(report.mean * 100).toFixed(1)}%`}
        />
      </div>

      <p className="text-xs text-pretty text-muted-foreground">
        {report.sortino == null
          ? "No shortfall versus MAR, so δ = 0 and Sortino / Omega are undefined — a sample, not infinite skill."
          : report.sortinoOverSharpe != null && report.sortinoOverSharpe > 1.15 && (report.sharpe ?? 0) > 0
            ? `Sortino is ${report.sortinoOverSharpe.toFixed(2)}× Sharpe because most of σ is winning tickets. Semi-deviation (dropping those tickets) inflates δ and shrinks the ratio to ${fmtSharpe(report.sortinoSemi)}.`
            : report.omega != null && report.kappa1 != null
              ? `Ω ${fmtOmega(report.omega)} = 1 + κ₁ ${fmtSharpe(report.kappa1)} (Kaplan & Knowles). Semi-deviation is ${fmtSharpe(report.sortinoSemi)} — larger than Sortino because winners were dropped from n.`
              : "A mean below MAR makes Sortino the harsher of the two ratios (δ < σ)."}
      </p>

      {corpus && corpus.n >= 2 ? (
        <section className="space-y-3" data-qa="sortino-corpus">
          <h2 className="font-display text-xl">Live corpus</h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Same priced settled lines as Accuracy, MAR = 0. Sortino does not rank the ten.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Per-bet Sortino" value={fmtSharpe(corpus.sortino)} hint={`${corpus.n} lines`} />
            <Stat label="Omega" value={fmtOmega(corpus.omega)} hint="MAR 0" />
            <Stat label="κ₃" value={fmtSharpe(corpus.kappa3)} hint="crash tail" />
            <Stat
              label="δ / σ"
              value={corpus.std > 1e-12 ? (corpus.downsideStd / corpus.std).toFixed(2) : "—"}
              hint={`loss ${Math.round(corpus.lossRate * 100)}%`}
            />
          </div>
          <FamilyTable rows={byFamily ?? []} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Scan a finished date to score the live corpus on the same downside measures.
        </p>
      )}
    </div>
  );
}
