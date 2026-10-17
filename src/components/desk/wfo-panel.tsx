import { useMemo, useState } from "react";
import type { WfoPair, WfoReport, WfoWindow } from "@/lib/football/types";
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

function fmtEff(e: number | null | undefined): string {
  if (e == null || !Number.isFinite(e)) return "—";
  return e.toFixed(2);
}

function fmtP(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p < 0.001) return "<0.1%";
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-card p-4 shadow-border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">{hint}</p>
    </div>
  );
}

function PathChart({ report }: { report: WfoReport }) {
  const data = report.folds.map((f) => {
    const def = f.configs.find((c) => c.id === "default");
    const win = f.configs.find((c) => c.id === f.isWinner);
    return {
      date: f.date.slice(5),
      winner: Math.round((win?.oosBrier ?? f.oosBrier) * 1000),
      def: Math.round((def?.oosBrier ?? f.oosBrier) * 1000),
    };
  });
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
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              `${value}‰`,
              name === "winner" ? "IS-winner OOS" : "14d · n₀ 48 OOS",
            ]}
          />
          <Line
            type="monotone"
            dataKey="winner"
            stroke="var(--color-pitch)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-pitch)" }}
            name="winner"
          />
          <Line
            type="monotone"
            dataKey="def"
            stroke="var(--color-primary)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 2, fill: "var(--color-primary)" }}
            name="def"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WfoPanel({ wfo }: { wfo?: WfoPair | null }) {
  const [window, setWindow] = useState<WfoWindow>("anchored");
  const report = window === "rolling" ? wfo?.rolling : wfo?.anchored;
  const hasFolds = Boolean(report && report.folds.length);

  const ranked = useMemo(() => {
    if (!report) return [];
    return [...report.grid].sort((a, b) => a.meanOos - b.meanOos);
  }, [report]);

  return (
    <div className="space-y-8" data-qa="wfo-lab">
      <section className="space-y-2">
        <h2 className="font-display text-xl">Walk-forward optimization</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Accuracy is validation of a frozen fitting rule. This tab is Pardo optimization of the two
          knobs that rule does not search: recency half-life and prior pseudo-count n₀. Each fold
          fits Granger–Ramanathan mix-ls under four hypers, freezes the in-sample winner, and scores
          the next date. Method × hyper is not nested — that 16-way search is the overfitting the lab
          is meant to catch. Efficiency is IS Brier / OOS Brier of the winner path (≳ 0.50–0.60 is
          the robustness bar). The last IS-winner is the live candidate; it is applied only if its
          mean OOS beats 14d · n₀ 48 by 0.0005 Brier. This date does not grade itself.
        </p>
      </section>

      {!hasFolds ? (
        <p className="text-sm text-muted-foreground">
          Need two settled dates and at least 12 training lines before a fold can walk. Scan a
          finished card; the next date then freezes whatever won the last in-sample grid.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={window === "anchored" ? "default" : "outline"}
              onClick={() => setWindow("anchored")}
            >
              Anchored
            </Button>
            <Button
              type="button"
              size="sm"
              variant={window === "rolling" ? "default" : "outline"}
              onClick={() => setWindow("rolling")}
            >
              Rolling last {report!.rollingDates}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Walk-forward efficiency"
              value={fmtEff(report!.efficiency)}
              hint={
                report!.efficiency == null
                  ? "need an OOS Brier"
                  : report!.efficiency >= 0.5
                    ? "IS / OOS · robust enough"
                    : "IS / OOS · path overfit"
              }
            />
            <Stat
              label="Last IS-winner"
              value={report!.recommended.label}
              hint={report!.lastAgree ? "matches OOS-best last fold" : "OOS-best differed last fold"}
            />
            <Stat
              label="PBO"
              value={report!.pbo != null ? fmtP(report!.pbo) : "—"}
              hint={
                report!.pbo != null
                  ? `${report!.pboN} CSCV splits · P(IS-best < OOS median)`
                  : "need 6 scored dates"
              }
            />
            <Stat
              label="This card"
              value={report!.apply ? report!.recommended.label : "14d · n₀ 48"}
              hint={report!.apply ? "WFO hyper applied" : "OOS missed the 0.5‰ bar"}
            />
          </div>

          <p className="text-xs text-muted-foreground">{report!.appliedReason}</p>
          {report!.white ? (
            <p className="text-xs text-muted-foreground">
              White reality check vs default: best {report!.white.bestId} · gap{" "}
              {(report!.white.stat * 1000).toFixed(1)}‰ · p {fmtP(report!.white.p)} ({report!.white.nBoot}{" "}
              boots, {report!.white.n} dates). H₀: no cell beats 14d · n₀ 48.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              White reality check needs 3 scored dates. Mean OOS champion {report!.oosChampion.label}.
            </p>
          )}

          {report!.folds.length >= 2 ? (
            <div className="rounded-lg bg-card p-4 shadow-border">
              <p className="mb-2 text-xs text-muted-foreground">
                Daily OOS Brier (‰) — sage is the IS-winner that fold, dashed bone is the default 14d
                · n₀ 48.
              </p>
              <PathChart report={report!} />
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Hyper</th>
                  <th className="px-3 py-2 font-medium">IS wins</th>
                  <th className="px-3 py-2 font-medium">OOS wins</th>
                  <th className="px-3 py-2 font-medium">Mean IS</th>
                  <th className="px-3 py-2 font-medium">Mean OOS</th>
                  <th className="px-3 py-2 font-medium">WFE</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((g) => {
                  const rec = g.id === report!.recommended.id;
                  const live = g.id === report!.appliedId;
                  return (
                    <tr key={g.id} className="border-b border-border last:border-0" data-qa={`wfo-cell-${g.id}`}>
                      <td className="px-3 py-2">
                        <span className="font-medium">{g.label}</span>
                        {rec ? (
                          <span className="ml-2 font-mono text-xs text-pitch">IS-winner</span>
                        ) : null}
                        {live && !rec ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">applied</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums">{g.isWins}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{g.oosWins}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{brierPermille(g.meanIs)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{brierPermille(g.meanOos)}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">{fmtEff(g.meanEfficiency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Train</th>
                  <th className="px-3 py-2 font-medium">n</th>
                  <th className="px-3 py-2 font-medium">IS-winner</th>
                  <th className="px-3 py-2 font-medium">OOS-best</th>
                  <th className="px-3 py-2 font-medium">IS</th>
                  <th className="px-3 py-2 font-medium">OOS</th>
                  <th className="px-3 py-2 font-medium">WFE</th>
                </tr>
              </thead>
              <tbody>
                {report!.folds.map((f) => (
                  <tr key={f.date} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono tabular-nums">{f.date}</td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                      {f.trainN} / {f.trainDates}d
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{f.n}</td>
                    <td className="px-3 py-2">{f.configs.find((c) => c.id === f.isWinner)?.label ?? f.isWinner}</td>
                    <td className="px-3 py-2">
                      {f.configs.find((c) => c.id === f.oosBest)?.label ?? f.oosBest}
                      {f.isOosAgree ? (
                        <span className="ml-2 font-mono text-xs text-pitch">agree</span>
                      ) : (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">split</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{brierPermille(f.isBrier)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{brierPermille(f.oosBrier)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{fmtEff(f.efficiency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
