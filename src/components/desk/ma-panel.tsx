import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  latentStateTrace,
  movingAveragePath,
  movingAverages,
  samplesFromGoals,
} from "@/lib/football/latent";
import { latentShockPosterior } from "@/lib/football/models";
import type { ScoredPick } from "@/lib/football/types";

const PRESETS = [
  { id: "even", label: "Even 1.2", gf: Array.from({ length: 20 }, () => 1.2) },
  { id: "hot", label: "Hot last 5", gf: [4, 3, 2, 3, 2, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 2, 0, 1, 1] },
  { id: "cold", label: "Cold last 5", gf: [0, 0, 1, 0, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1] },
  { id: "cliff", label: "Last-5 cliff", gf: [3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "fade", label: "Hot book, cold now", gf: [0, 0, 0, 1, 0, 2, 2, 3, 2, 2, 3, 1, 2, 2, 3, 2, 1, 2, 2, 3] },
] as const;

function fmtGf(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function LatentBlock() {
  const state = latentStateTrace(1.38);
  const shock = latentShockPosterior(1.38, 1.12);
  return (
    <section className="space-y-3" data-qa="latent-var">
      <h2 className="font-display text-xl">Latent variables</h2>
      <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
        Two things on the card are not on the scoreboard. The Karlis shock is a latent count: the score is
        the observation, and the posterior is the share of the bivariate cell that used k shared goals. A
        2–0 can only have been private goals, so the shock is 0. A 1–1 was the shared goal{" "}
        {(shock.scores.find((row) => row.score === "1-1")!.posterior[1]?.prob * 100).toFixed(1)}% of the time,
        against a prior mean of {shock.prior.toFixed(2)}. Across matches, log-attack is a random walk. Process
        noise is {state.q} per match and observation noise is {state.r}, so the steady gain is{" "}
        {state.steadyGain.toFixed(3)}. A first match of 4 goals moves λ from {state.mu.toFixed(2)} to{" "}
        {state.cold.lambda.toFixed(2)}, not to 4. After seven ordinary games the same 4 only reaches{" "}
        {state.spike.lambda.toFixed(2)}. Finishing is a third latent rate: an observed 4 shrinks to{" "}
        {state.shrink1.toFixed(2)} after one game and {state.shrink5.toFixed(2)} after five, because the prior
        is worth 8 games at the league mean. This does not rank the ten.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Score</th>
              <th className="py-1.5 font-medium">P(K=0)</th>
              <th className="py-1.5 font-medium">P(K=1)</th>
              <th className="py-1.5 font-medium">P(K=2)</th>
              <th className="py-1.5 font-medium">E[K | score]</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {shock.scores.map((row) => (
              <tr key={row.score} className="border-t border-border">
                <td className="py-1.5 font-sans">{row.score}</td>
                <td className="py-1.5">{prob(row, 0)}</td>
                <td className="py-1.5">{prob(row, 1)}</td>
                <td className="py-1.5">{prob(row, 2)}</td>
                <td className="py-1.5">{row.mean.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1.5 font-medium">Book</th>
              <th className="py-1.5 font-medium">Gain</th>
              <th className="py-1.5 font-medium">Latent λ</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            <tr className="border-t border-border">
              <td className="py-1.5 font-sans">First match is 4</td>
              <td className="py-1.5">{state.cold.gain.toFixed(3)}</td>
              <td className="py-1.5">{state.cold.lambda.toFixed(2)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5 font-sans">Eight matches of 1</td>
              <td className="py-1.5">{state.flat.gain.toFixed(3)}</td>
              <td className="py-1.5">{state.flat.lambda.toFixed(2)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5 font-sans">Seven 1s, then a 4</td>
              <td className="py-1.5">{state.spike.gain.toFixed(3)}</td>
              <td className="py-1.5">{state.spike.lambda.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function prob(row: { posterior: Array<{ k: number; prob: number }> }, k: number): string {
  const hit = row.posterior.find((p) => p.k === k);
  return hit ? hit.prob.toFixed(3) : "—";
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

function uniqueFixtures(picks: ScoredPick[]): ScoredPick[] {
  const seen = new Set<number>();
  const out: ScoredPick[] = [];
  for (const p of picks) {
    if (seen.has(p.fixtureId)) continue;
    seen.add(p.fixtureId);
    out.push(p);
  }
  return out;
}

export function MaPanel({ picks }: { picks?: ScoredPick[] }) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("hot");
  const [k, setK] = useState(5);
  const [field, setField] = useState<"gf" | "ga">("gf");
  const [custom, setCustom] = useState("");
  const active = PRESETS.find((p) => p.id === preset) ?? PRESETS[1];
  const parsedCustom = custom
    .split(/[,\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 12);
  const gf = parsedCustom.length >= 3 ? parsedCustom : [...active.gf];
  const customOn = parsedCustom.length >= 3;
  const samples = useMemo(() => samplesFromGoals(gf), [gf]);
  const asOf = samples[0]?.timestamp ?? 1_800_000_000;
  const ma = useMemo(() => movingAverages(samples, k, field, asOf), [samples, k, field, asOf]);
  const path = useMemo(() => movingAveragePath(samples, k, field), [samples, k, field]);
  const live = uniqueFixtures(picks ?? []).filter(
    (p) => p.facts.homeSma5 != null || p.facts.awaySma5 != null || p.facts.lastNHome,
  );

  return (
    <div className="space-y-8" data-qa="ma-lab">
      <section className="space-y-2">
        <h2 className="font-display text-xl">Moving average</h2>
        <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
          Last-20 sample mean is not one number. SMA(k) is the unweighted last k matches — last-5 GF on a
          results page is SMA(5). EMA uses α = 2/(k+1) over the whole book, match by match. EWMA-5 / EWMA-20
          are the live λ timescales: half-life in days, not games. Dixon–Coles ξ on the same book is a 373-day
          half-life, so the last-20 DC mean sits on SMA(20). The ten use the EWMA 3/5/10/20 blend, not SMA.
          This tab does not rank the ten.
        </p>
      </section>

      <LatentBlock />

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={!customOn && p.id === active.id ? "default" : "outline"}
            onClick={() => {
              setPreset(p.id);
              setCustom("");
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="ma-window">Window k</Label>
            <span className="font-mono text-sm tabular-nums">SMA / EMA {k}</span>
          </div>
          <input
            id="ma-window"
            type="range"
            className="dc-range mt-1 w-full"
            min={3}
            max={20}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            aria-label="Window k"
          />
          <p className="text-xs text-muted-foreground">Newest {k} matches for SMA. EMA span {k} on all {ma.n}.</p>
        </div>
        <div>
          <Label htmlFor="ma-goals">Goal sequence (newest first)</Label>
          <input
            id="ma-goals"
            className="mt-1 h-11 w-full rounded-md bg-card px-3 font-mono text-sm shadow-border"
            value={customOn ? custom : gf.join(",")}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Goal sequence newest first"
          />
          <p className="text-xs text-muted-foreground">Comma-separated GF. One match every 7 days.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={field === "gf" ? "default" : "outline"} onClick={() => setField("gf")}>
          Goals for
        </Button>
        <Button type="button" size="sm" variant={field === "ga" ? "default" : "outline"} onClick={() => setField("ga")}>
          Goals against
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`SMA(${k})`} value={fmtGf(ma.smaK)} hint="equal weight last k" />
        <Stat label={`EMA(${k})`} value={fmtGf(ma.emaK)} hint={`α = ${(2 / (k + 1)).toFixed(3)} · full book`} />
        <Stat label="EWMA-5d" value={fmtGf(ma.ewma5)} hint="live short timescale" />
        <Stat label="Last-20 mean" value={fmtGf(ma.dc)} hint={`DC ξ · SMA20 ${fmtGf(ma.sma20)}`} />
      </div>

      {path.length ? (
        <div className="rounded-lg bg-card p-4 shadow-border">
          <p className="mb-2 text-xs text-muted-foreground">
            Oldest → newest. Bars are the match, sage is SMA({k}), dashed bone is EMA({k}).
          </p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={path} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="i"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="obs" fill="var(--color-muted-foreground)" fillOpacity={0.35} name="match" />
                <Line type="monotone" dataKey="sma" stroke="var(--color-pitch)" strokeWidth={2} dot={false} name="SMA" />
                <Line
                  type="monotone"
                  dataKey="ema"
                  stroke="var(--color-primary)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="EMA"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <h3 className="font-display text-lg">Live last-20</h3>
        {live.length ? (
          <div className="overflow-x-auto rounded-lg bg-card shadow-border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Match</th>
                  <th className="px-3 py-2 font-medium">n</th>
                  <th className="px-3 py-2 font-medium">Home SMA5</th>
                  <th className="px-3 py-2 font-medium">SMA20</th>
                  <th className="px-3 py-2 font-medium">EWMA5</th>
                  <th className="px-3 py-2 font-medium">Away SMA5</th>
                  <th className="px-3 py-2 font-medium">SMA20</th>
                  <th className="px-3 py-2 font-medium">λ</th>
                </tr>
              </thead>
              <tbody>
                {live.slice(0, 12).map((p) => (
                  <tr key={p.fixtureId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      {p.home} v {p.away}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                      {p.facts.lastNHome ?? "—"}/{p.facts.lastNAway ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{fmtGf(p.facts.homeSma5)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{fmtGf(p.facts.homeSma20)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{fmtGf(p.facts.homeEwma5)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{fmtGf(p.facts.awaySma5)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{fmtGf(p.facts.awaySma20)}</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                      {p.lambdaHome.toFixed(2)}/{p.lambdaAway.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No last-20 sample on this card yet — the calculator above still runs. Scan a date with finished
            history to fill SMA5 / SMA20 / EWMA5 per side.
          </p>
        )}
      </section>
    </div>
  );
}
