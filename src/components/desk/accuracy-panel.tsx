import { modelLabel, pct } from "@/components/desk/format";
import {
  EXPERTS,
  EXPERT_LABELS,
  FAMILIES,
  FAMILY_LABELS,
  FIT_METHOD_LABELS,
  pctWeight,
  type EnsembleFamily,
  type ExpertKey,
} from "@/lib/football/calibrate";
import { fmtDrawdown, fmtOmega, fmtPsr, fmtSharpe } from "@/lib/football/sharpe";
import type { CalibrationReport, FamilySharpeRow, ModelLeaderRow, SharpeReport, WalkForwardReport } from "@/lib/football/types";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function Reliability({
  bins,
}: {
  bins: { lo: number; hi: number; pBar: number; yBar: number; n: number }[];
}) {
  const maxN = Math.max(1, ...bins.map((b) => b.n));
  return (
    <div className="grid grid-cols-10 gap-1">
      {bins.map((b) => (
        <div key={b.lo} className="flex h-16 flex-col justify-end">
          <div className="relative h-14 overflow-hidden rounded-sm bg-muted">
            <div
              className="absolute bottom-0 left-0 right-0 bg-pitch/70"
              style={{ height: `${Math.round((b.n / maxN) * 100)}%` }}
            />
            {b.n > 0 ? (
              <div
                className="absolute left-0 right-0 h-px bg-primary"
                style={{ bottom: `${Math.round(b.yBar * 100)}%` }}
              />
            ) : null}
          </div>
          <p className="mt-1 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
            {b.lo.toFixed(1)}
          </p>
        </div>
      ))}
    </div>
  );
}

function WeightBars({
  family,
  report,
}: {
  family: EnsembleFamily;
  report: CalibrationReport;
}) {
  const fam = report.applied.families[family];
  const rule = fam.rule ? FIT_METHOD_LABELS[fam.rule] : null;
  const scaled = Math.abs((fam.plattA ?? 1) - 1) > 0.02 || Math.abs(fam.plattB ?? 0) > 0.02;
  const leftPrior = fam.rule && fam.rule !== "prior";
  return (
    <div className="rounded-lg bg-card p-4 shadow-border">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{FAMILY_LABELS[family]}</h3>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {rule ? `${rule} · ` : ""}n {fam.n} · ECE {(fam.ece * 100).toFixed(1)} pp
        </p>
      </div>
      {fam.rule === "prior" && fam.n >= 12 ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Walk-forward did not beat the paper mix
          {fam.oosPrior != null ? ` (${(fam.oosPrior * 1000).toFixed(0)}‰)` : ""} — staying put.
        </p>
      ) : leftPrior && fam.oosBrier != null && fam.oosPrior != null ? (
        <p className="mb-3 text-xs text-muted-foreground">
          OOS {(fam.oosBrier * 1000).toFixed(0)}‰ vs prior {(fam.oosPrior * 1000).toFixed(0)}‰
          {scaled
            ? ` · scale ${(fam.plattA ?? 1).toFixed(2)} ${fam.plattB && fam.plattB >= 0 ? "+" : ""}${(fam.plattB ?? 0).toFixed(2)}`
            : ""}
          .
        </p>
      ) : null}
      <ul className="space-y-2">
        {EXPERTS.map((k: ExpertKey) => {
          const live = fam.acc[k];
          const prior = fam.priorAcc[k];
          return (
            <li key={k}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span>{EXPERT_LABELS[k]}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {pctWeight(live)}
                  {Math.abs(live - prior) > 0.005 ? (
                    <span> · prior {pctWeight(prior)}</span>
                  ) : null}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/35"
                  style={{ width: `${prior * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-pitch"
                  style={{ width: `${live * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function skillLabel(skill: number): string {
  const sign = skill >= 0 ? "+" : "";
  return `${sign}${(skill * 100).toFixed(1)}%`;
}

function brierPermille(b: number): string {
  return `${(b * 1000).toFixed(0)}‰`;
}

function WalkForwardChart({ wf }: { wf: WalkForwardReport }) {
  const data = wf.folds.map((f) => ({
    date: f.date.slice(5),
    cal: Math.round(f.cumBrierCal * 1000),
    prior: Math.round(f.cumBrierPrior * 1000),
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
            domain={["auto", "auto"]}
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
              name === "cal" ? "Calibrated" : "Paper prior",
            ]}
          />
          <Line
            type="monotone"
            dataKey="cal"
            stroke="var(--color-pitch)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-pitch)" }}
            name="cal"
          />
          <Line
            type="monotone"
            dataKey="prior"
            stroke="var(--color-primary)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={{ r: 2, fill: "var(--color-primary)" }}
            name="prior"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function WalkForwardSection({ wf }: { wf: WalkForwardReport }) {
  const thin = wf.nDates < 2;
  const helped = wf.skill > 0.002;
  const hurt = wf.skill < -0.002;
  return (
    <section className="space-y-3" data-qa="walk-forward">
      <h2 className="font-display text-xl">Walk-forward validation</h2>
      {wf.nDates === 0 ? (
        <p className="text-sm text-pretty text-muted-foreground">
          No settled dates yet. Scan a finished day so each later card can be scored with weights that
          never saw that day.
        </p>
      ) : (
        <>
          <p className="text-sm text-pretty text-muted-foreground">
            Expanding window: date D is scored with inverse-Brier or Granger–Ramanathan weights
            (logit pool + optional intercept) fit only on dates before D
            {wf.embargoDays > 0 ? ` (embargo ${wf.embargoDays}d)` : ""}. This is validation of a
            frozen fitting rule — not Pardo optimization of half-life and n₀ (that is Walk-forward).
            A family leaves the paper prior only if that mix — or a temperature scale of it — beats
            it out of sample. The first fold always uses the paper prior. Skill is 1 − Brier_cal /
            Brier_prior on the pooled out-of-sample lines.
            {thin
              ? " One more finished date will show whether calibration actually helps."
              : helped
                ? " Calibrated mix is beating the paper prior out of sample."
                : hurt
                  ? " Paper prior is still sharper OOS — shrinkage is doing its job; the corpus is not large enough to outvote n₀ = 48."
                  : " Calibrated mix is level with the paper prior out of sample."}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="OOS Brier" value={brierPermille(wf.brierCal)} hint="calibrated mix" />
            <Stat label="Prior Brier" value={brierPermille(wf.brierPrior)} hint="paper mix" />
            <Stat label="Skill vs prior" value={skillLabel(wf.skill)} hint={helped ? "helps" : hurt ? "prior wins" : "level"} />
            <Stat
              label="Folds"
              value={`${wf.nDates}d`}
              hint={`${wf.n} lines · ${wf.hits}/${wf.n} hit`}
            />
            {wf.dm ? (
              <Stat
                label="DM p-value"
                value={
                  wf.dm.p < 0.001 ? "<0.1%" : `${(wf.dm.p * 100).toFixed(wf.dm.p < 0.1 ? 1 : 0)}%`
                }
                hint={wf.dm.reject5 ? `t ${wf.dm.t.toFixed(2)} · mix is sharper` : `t ${wf.dm.t.toFixed(2)} · not significant`}
              />
            ) : null}
          </div>
          {wf.folds.length >= 2 ? (
            <div className="rounded-lg bg-card p-4 shadow-border">
              <p className="mb-2 text-xs text-muted-foreground">
                Cumulative OOS Brier (‰) — sage is calibrated, dashed bone is the paper prior.
              </p>
              <WalkForwardChart wf={wf} />
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Train</th>
                  <th className="px-3 py-2 font-medium">n</th>
                  <th className="px-3 py-2 font-medium">Hit</th>
                  <th className="px-3 py-2 font-medium">Brier cal</th>
                  <th className="px-3 py-2 font-medium">Brier prior</th>
                  <th className="px-3 py-2 font-medium">Skill</th>
                  <th className="px-3 py-2 font-medium">DC wt</th>
                </tr>
              </thead>
              <tbody>
                {wf.folds.map((f) => (
                  <tr key={f.date} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono tabular-nums">{f.date}</td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                      {f.trainN ? `${f.trainN} / ${f.trainDates}d` : "prior"}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{f.n}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {f.hits}/{f.n}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{f.brierCal.toFixed(3)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                      {f.brierPrior.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{skillLabel(f.skill)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                      {pctWeight(f.accWin.dc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-card p-4 shadow-border">
              <h3 className="mb-3 font-medium">OOS by family</h3>
              <ul className="space-y-2">
                {FAMILIES.map((fam) => {
                  const row = wf.families[fam];
                  return (
                    <li key={fam} className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{FAMILY_LABELS[fam]}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {row.n
                          ? `${brierPermille(row.brierCal)} · skill ${skillLabel(row.skill)} · n ${row.n}`
                          : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-lg bg-card p-4 shadow-border">
              <h3 className="mb-3 font-medium">OOS by expert</h3>
              <ul className="space-y-2">
                {wf.experts
                  .slice()
                  .sort((a, b) => a.brier - b.brier)
                  .map((e) => (
                    <li key={e.expert} className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{e.label}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        Brier {e.brier.toFixed(3)} · n {e.n}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
          {wf.brierRoll != null && wf.nDates > wf.rollingDates ? (
            <p className="text-xs text-muted-foreground">
              Rolling last {wf.rollingDates} dates: {brierPermille(wf.brierRoll)} vs expanding{" "}
              {brierPermille(wf.brierCal)}.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Rolling last-{wf.rollingDates} comparison waits until the corpus is longer than a week —
              expanding and rolling are the same mix today.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SharpeSection({
  corpus,
  card,
  byFamily,
  dsr,
  nTrials,
}: {
  corpus?: SharpeReport | null;
  card?: SharpeReport | null;
  byFamily?: FamilySharpeRow[];
  dsr?: number | null;
  nTrials?: number;
}) {
  const s = corpus;
  const thin = !s || s.n < 3;
  const families = (byFamily ?? []).filter((row) => row.report.n >= 2);
  const showEquity = Boolean(s && s.daily.length >= 2);
  return (
    <section className="space-y-3" data-qa="sharpe">
      <h2 className="font-display text-xl">Sharpe ratio</h2>
      <p className="text-sm text-pretty text-muted-foreground">
        Unit-stake returns: +(odds − 1) on a hit, −1 on a miss. Risk-free is cash — 0. Not annualised;
        a football desk is not 252 sessions. Sortino, Omega and Kappa sit in the next block and on the Sortino tab.
        PSR is Bailey & López de Prado
        2012: P(true Sharpe is positive) given this n, skew and kurtosis. DSR (2014) raises the hurdle to the
        expected max Sharpe of the families searched, so a lucky 1X2 slice cannot carry the desk. Older
        corpus rows without a posted price are skipped.
      </p>
      {thin ? (
        <p className="text-sm text-muted-foreground">
          {s && s.n > 0
            ? `Only ${s.n} priced settled line${s.n === 1 ? "" : "s"} so far — Sharpe waits for a short series.`
            : "No priced settled lines in the corpus yet. Scan a finished date so returns can be scored."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Per-bet Sharpe" value={fmtSharpe(s!.sharpe)} hint={`${s!.n} lines · rf 0`} />
            <Stat
              label="Per-date Sharpe"
              value={fmtSharpe(s!.dailySharpe)}
              hint={s!.nDates >= 2 ? `${s!.nDates} dates` : "need 2 dates"}
            />
            <Stat label="Sortino" value={fmtSharpe(s!.sortino)} hint="MAR 0 · next block" />
            <Stat
              label="PSR"
              value={fmtPsr(s!.psr)}
              hint={s!.minTrack ? `need ~${s!.minTrack} for 95%` : "P(true Sharpe is positive)"}
            />
            <Stat label="Max drawdown" value={fmtDrawdown(s!.maxDrawdown)} hint="peak to trough, unit stake" />
            <Stat
              label="Rolling Sharpe"
              value={fmtSharpe(s!.rollingSharpe)}
              hint={s!.nDates >= 2 ? `last ${Math.min(7, s!.nDates)} dates` : "need 2 dates"}
            />
            <Stat
              label="DSR"
              value={fmtPsr(dsr ?? null)}
              hint={`deflated for N=${nTrials ?? 1} ${nTrials === 1 ? "family" : "families"}`}
            />
            <Stat
              label="Yield"
              value={`${s!.mean >= 0 ? "+" : ""}${(s!.mean * 100).toFixed(1)}%`}
              hint={`hit ${Math.round(s!.hitRate * 100)}% · σ ${(s!.std * 100).toFixed(0)}%`}
            />
          </div>
          {s && s.n >= 2 ? (
            <p className="text-xs text-muted-foreground">
              Skew {s.skew.toFixed(2)} · kurtosis {s.kurtosis.toFixed(2)}
              {card && card.n >= 2 ? ` · this card ${fmtSharpe(card.sharpe)} (${card.n} settled)` : ""}.
              {dsr != null && s.psr != null && nTrials != null && nTrials > 1
                ? ` DSR ${fmtPsr(dsr)} vs PSR ${fmtPsr(s.psr)} — the extra families were a search, not a free option.`
                : ""}
            </p>
          ) : null}
        </>
      )}
      {showEquity ? <EquityChart daily={s!.daily} /> : null}
      {families.length ? (
        <div className="overflow-x-auto shadow-border" data-qa="sharpe-family">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Family</th>
                <th className="py-2 pr-3 font-medium text-right">n</th>
                <th className="py-2 pr-3 font-medium text-right">Hit</th>
                <th className="py-2 pr-3 font-medium text-right">Yield</th>
                <th className="py-2 pr-3 font-medium text-right">Sharpe</th>
                <th className="py-2 pr-3 font-medium text-right">Sortino</th>
                <th className="py-2 pr-3 font-medium text-right">UPR</th>
                <th className="py-2 font-medium text-right">PSR</th>
              </tr>
            </thead>
            <tbody>
              {families.map((row) => {
                const r = row.report;
                const label = (FAMILY_LABELS as Record<string, string>)[row.family] ?? row.family;
                return (
                  <tr key={row.family} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{label}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.n}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{Math.round(r.hitRate * 100)}%</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">
                      {r.mean >= 0 ? "+" : ""}
                      {(r.mean * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtSharpe(r.sharpe)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtSharpe(r.sortino)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtSharpe(r.upr)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtPsr(r.psr)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function SortinoSection({
  corpus,
  byFamily,
}: {
  corpus?: SharpeReport | null;
  byFamily?: FamilySharpeRow[];
}) {
  const s = corpus;
  const thin = !s || s.n < 3;
  const gap = s?.sortinoOverSharpe;
  const upsideHeavy = gap != null && gap > 1.15 && (s?.sharpe ?? 0) > 0;
  const families = (byFamily ?? [])
    .filter((row) => row.report.n >= 2)
    .slice()
    .sort((a, b) => (b.report.sortino ?? -999) - (a.report.sortino ?? -999));
  return (
    <section className="space-y-3" data-qa="sortino">
      <h2 className="font-display text-xl">Sortino ratio</h2>
      <p className="text-sm text-pretty text-muted-foreground">
        Same unit book as Sharpe, different risk. MAR is cash — 0. Downside δ is Sortino & Price 1994:
        √(Σ min(R, 0)² / n). A hit contributes 0, not a dropped observation, so a 2.00 overlay that
        mostly hits prints a higher Sortino than Sharpe. UPR (Dutch Triangle, 1999) is mean upside over
        the same δ. Omega is UPM₁ / LPM₁; κ₁ restates it (Ω = 1 + κ₁), κ₂ is Sortino, κ₃ weights crash
        tails. Open Sortino to change MAR, odd and hit rate. Per-date and rolling wait for a second
        priced date.
      </p>
      {thin ? (
        <p className="text-sm text-muted-foreground">
          {s && s.n > 0
            ? `Only ${s.n} priced settled line${s.n === 1 ? "" : "s"} so far — Sortino waits for a short series.`
            : "No priced settled lines yet. Scan a finished date so the losing tail can be scored."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Per-bet Sortino" value={fmtSharpe(s!.sortino)} hint="MAR 0 · rf cash" />
            <Stat
              label="Per-date Sortino"
              value={fmtSharpe(s!.dailySortino)}
              hint={s!.nDates >= 2 ? `${s!.nDates} dates` : "need 2 dates"}
            />
            <Stat
              label="Rolling Sortino"
              value={fmtSharpe(s!.rollingSortino)}
              hint={s!.nDates >= 2 ? `last ${Math.min(7, s!.nDates)} dates` : "need 2 dates"}
            />
            <Stat label="Omega" value={fmtOmega(s!.omega)} hint="UPM₁ / LPM₁" />
            <Stat label="UPR" value={fmtSharpe(s!.upr)} hint="mean upside / δ" />
            <Stat label="κ₃" value={fmtSharpe(s!.kappa3)} hint={s!.kappa1 != null ? `κ₁ ${fmtSharpe(s!.kappa1)}` : "crash tail"} />
            <Stat
              label="Downside σ"
              value={`${(s!.downsideStd * 100).toFixed(0)}%`}
              hint={`semi ${((s!.semiDeviation || 0) * 100).toFixed(0)}% · full σ ${(s!.std * 100).toFixed(0)}%`}
            />
            <Stat
              label="Sortino / Sharpe"
              value={gap != null && Number.isFinite(gap) ? gap.toFixed(2) : "—"}
              hint={upsideHeavy ? "vol is mostly upside" : "same-sign ratio"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {upsideHeavy
              ? `Sortino is ${gap!.toFixed(2)}× Sharpe — most of the σ is winning tickets, not losing ones. Dropping those tickets (semi-deviation) prints ${fmtSharpe(s!.sortinoSemi)}.`
              : s!.sortino != null && s!.sharpe != null && s!.sharpe < 0
                ? "Mean is below MAR, so Sortino is the harsher of the two ratios (δ < σ)."
                : "A book with no losing slips has δ = 0 and Sortino is undefined — that is a sample, not infinite skill."}
          </p>
        </>
      )}
      {families.length ? (
        <div className="overflow-x-auto shadow-border" data-qa="sortino-family-acc">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Family</th>
                <th className="py-2 pr-3 font-medium text-right">n</th>
                <th className="py-2 pr-3 font-medium text-right">Sortino</th>
                <th className="py-2 pr-3 font-medium text-right">Omega</th>
                <th className="py-2 font-medium text-right">κ₃</th>
              </tr>
            </thead>
            <tbody>
              {families.map((row) => {
                const r = row.report;
                const label = (FAMILY_LABELS as Record<string, string>)[row.family] ?? row.family;
                return (
                  <tr key={row.family} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{label}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.n}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtSharpe(r.sortino)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtOmega(r.omega)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtSharpe(r.kappa3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function EquityChart({ daily }: { daily: { date: string; pnl: number; equity: number }[] }) {
  const data = daily.map((d) => ({
    date: d.date.slice(5),
    equity: Math.round(d.equity * 100) / 100,
  }));
  return (
    <div className="rounded-lg bg-card p-4 shadow-border">
      <h3 className="mb-3 font-medium">Unit equity</h3>
      <div className="h-40 w-full">
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
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="equity" stroke="var(--color-pitch)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ValidationSection({
  validation,
}: {
  validation?: CalibrationReport["validation"];
}) {
  const rows = validation?.rows ?? [];
  const optimism = validation?.optimism;
  return (
    <section className="space-y-3" data-qa="validation-methods">
      <h2 className="font-display text-xl">Validation methods</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Same settled lines, five ways to grade them. The starting probability is the frozen paper mix.
        Each scheme may shift it by an intercept fit on that scheme’s training lines. Resubstitution
        and a k-fold that ignores the calendar are not valid. Last-date holdout is honest and one
        number. Expanding walk-forward is the desk: day D never trains day D. Rolling last-7 uses the
        same embargo and a shorter memory. The optimism is how much worse the expanding Brier is than
        the in-sample grade. None of this ranks the ten.
      </p>
      {rows.every((r) => r.n === 0) ? (
        <p className="text-sm text-muted-foreground">No settled lines yet. Scan a finished day.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat
              label="Desk"
              value="Expanding"
              hint="day D unseen"
            />
            <Stat
              label="Optimism"
              value={optimism == null ? "—" : `${optimism >= 0 ? "+" : ""}${(optimism * 1000).toFixed(0)}‰`}
              hint="expanding − resubstitution"
            />
            <Stat
              label="Invalid"
              value="2"
              hint="resubstitution, time-blind k-fold"
            />
          </div>
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Valid</th>
                  <th className="px-3 py-2 font-medium">Future</th>
                  <th className="px-3 py-2 font-medium">n</th>
                  <th className="px-3 py-2 font-medium">Brier</th>
                  <th className="px-3 py-2 font-medium">What it does</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{r.valid ? "yes" : "no"}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{r.usesFuture ? "yes" : "no"}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{r.n || "—"}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{r.brier == null ? "—" : brierPermille(r.brier)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
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

export function AccuracyPanel({
  rows,
  calibration,
}: {
  rows: ModelLeaderRow[];
  calibration?: CalibrationReport | null;
}) {
  const applied = calibration?.applied;
  const card = calibration?.card;
  const wf = calibration?.walkForward;
  const hasCorpus = Boolean(applied && applied.n > 0);

  return (
    <div className="space-y-8">
      {wf ? (
        <WalkForwardSection wf={wf} />
      ) : (
        <section className="space-y-3" data-qa="walk-forward">
          <h2 className="font-display text-xl">Walk-forward validation</h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Run the desk to score every settled date with weights that date never saw. Expanding
            window, no self-grading — the first fold stays on the paper prior.
          </p>
        </section>
      )}

      <ValidationSection validation={calibration?.validation} />

      <SharpeSection
        corpus={calibration?.sharpe}
        card={calibration?.cardSharpe}
        byFamily={calibration?.sharpeByFamily}
        dsr={calibration?.deflatedPsr}
        nTrials={calibration?.nTrials}
      />

      <SortinoSection corpus={calibration?.sharpe} byFamily={calibration?.sharpeByFamily} />

      <section className="space-y-3">
        <h2 className="font-display text-xl">Walk-forward weights</h2>
        {hasCorpus ? (
          <p className="text-sm text-pretty text-muted-foreground">
            Inverse-Brier is the start; Granger–Ramanathan least squares is the backtest mix on the
            live logit pool, with a Platt intercept when the experts are biased as a group. A family
            only leaves the paper prior if that mix beats it on expanding-window walk-forward —{" "}
            {applied!.n} lines across {applied!.nDates} date
            {applied!.nDates === 1 ? "" : "s"}, strictly before this card. Shrunk toward the prior
            (n₀ = 48). Shin is capped at 34%. This date is ingested after grading.
          </p>
        ) : (
          <p className="text-sm text-pretty text-muted-foreground">
            No settled corpus yet — the ten still use the paper priors. Run a finished date (yesterday)
            so each expert gets a Brier score; the next live card then mixes those weights with the
            prior. Classic BMA stays on the BMA tab: it collapses onto Shin.
          </p>
        )}
        {hasCorpus ? (
          <div className="grid gap-3 md:grid-cols-2">
            {FAMILIES.map((f) => (
              <WeightBars key={f} family={f} report={calibration!} />
            ))}
          </div>
        ) : null}
      </section>

      {card ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl">This card</h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Settled {card.hits}/{card.n} of the ten. Ensemble Brier {(card.brier * 1000).toFixed(0)}‰ ·
            log-loss {card.logLoss.toFixed(3)} · ECE {(card.ece * 100).toFixed(1)} pp. Reliability:
            sage fill is sample, bone hairline is observed hit rate in that predicted bin.
          </p>
          <Reliability bins={card.reliability} />
          <ul className="divide-y divide-border rounded-lg bg-card shadow-border">
            {card.experts
              .slice()
              .sort((a, b) => a.brier - b.brier)
              .map((e) => (
                <li key={e.expert} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                  <span>{e.label}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    Brier {e.brier.toFixed(3)} · n {e.n}
                    {e.meanP ? ` · P̄ ${pct(e.meanP)}` : ""}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {rows.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Model leaderboard</h2>
          <p className="text-sm text-pretty text-muted-foreground">
            Mean probability and calibration on this card. Lower calib / Brier is better.
          </p>
          <ul className="divide-y divide-border rounded-lg bg-card shadow-border">
            {rows.map((r) => (
              <li key={r.model} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                <span>{r.label || modelLabel(r.model)}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  P̄ {pct(r.meanP)} · calib {r.calib.toFixed(3)}
                  {r.brier != null ? ` · Brier ${r.brier.toFixed(3)}` : ""}
                  {r.n != null ? ` · n ${r.n}` : ""} · wins {r.wins}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
