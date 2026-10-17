import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { familyLabel, kindLabel, odds, pct } from "@/components/desk/format";
import type { ScoredPick } from "@/lib/football/types";
import {
  DEFAULT_BANKROLL,
  DEFAULT_KELLY_FRACTION,
  KELLY_FRACTIONS,
  fractionLabel,
  kellyTierLabel,
  planKellyCard,
  type KellyFraction,
  type KellyPlan,
} from "@/lib/football/kelly";
import { expectedCardSharpe, fmtOmega, fmtSharpe } from "@/lib/football/sharpe";
import { cn } from "@/lib/utils";

function fmtUnits(n: number): string {
  if (n >= 100) return n.toFixed(1);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(2);
}

export function KellyPanel({
  picks,
  bankroll,
  fraction,
  onBankroll,
  onFraction,
}: {
  picks: ScoredPick[];
  bankroll: number;
  fraction: KellyFraction;
  onBankroll: (n: number) => void;
  onFraction: (f: KellyFraction) => void;
}) {
  const plan: KellyPlan = useMemo(
    () =>
      planKellyCard(
        picks.map((p) => ({ id: p.id, fixtureId: p.fixtureId, odd: p.odd, p: p.accuracy })),
        { bankroll, fraction },
      ),
    [picks, bankroll, fraction],
  );
  const byId = useMemo(() => new Map(picks.map((p) => [p.id, p])), [picks]);
  const staked = plan.rows.filter((r) => r.allocated > 0);
  const passed = plan.rows.filter((r) => r.allocated <= 0);
  const exAnte = expectedCardSharpe(
    staked.map((r) => {
      const p = byId.get(r.id);
      return { odd: p?.odd ?? 2, p: p?.accuracy ?? 0.5, stake: r.allocated };
    }),
  );

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Kelly 1956 sizes the stake as a fraction of bankroll from calibrated P and the posted price. Full Kelly
        maximises log-wealth and has brutal variance — Thorp's quarter-Kelly is the default. Same-fixture
        markets are haircut; the card is scaled if it would exceed 20% of the roll. Ranking does not use stake
        size. A Pass is a no-bet. Ex-ante Sharpe treats slips as independent Bernoulli — same-fixture
        correlation is only in the haircut, not in σ. Omega is expected upside over expected downside
        on the same slips.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="bankroll">Bankroll (units)</Label>
          <Input
            id="bankroll"
            type="number"
            min={1}
            step={10}
            value={Number.isFinite(bankroll) ? bankroll : DEFAULT_BANKROLL}
            onChange={(e) => {
              const n = Number(e.target.value);
              onBankroll(n > 0 ? n : DEFAULT_BANKROLL);
            }}
            className="w-36 font-mono tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Fraction</p>
          <div className="flex flex-wrap gap-1.5">
            {KELLY_FRACTIONS.map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={f === fraction ? "default" : "outline"}
                onClick={() => onFraction(f)}
              >
                {fractionLabel(f)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {fraction === 1 ? (
        <p className="text-xs text-destructive">
          Full Kelly swings hard. A long losing run can halve the roll. Quarter-Kelly is the desk default.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Card stake</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{fmtUnits(plan.cardUnits)}</p>
          <p className="text-xs text-muted-foreground">{pct(plan.cardAllocated)} of bankroll</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Slips</p>
          <p className="mt-1 font-display text-2xl tabular-nums">
            {plan.nStaked}
            <span className="text-base text-muted-foreground"> / {plan.rows.length}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {plan.nPassed ? `${plan.nPassed} pass` : "all above the 2% floor"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Log growth</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{(plan.growth * 100).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">
            {plan.scaled ? `scaled ×${plan.scale.toFixed(2)} to the 20% cap` : "E[Δ log wealth] × 100"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Ex-ante Sharpe</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{fmtSharpe(exAnte.sharpe)}</p>
          <p className="text-xs text-muted-foreground">
            μ {exAnte.mu >= 0 ? "+" : ""}
            {(exAnte.mu * 100).toFixed(2)}% · Sortino {fmtSharpe(exAnte.sortino)} · Ω {fmtOmega(exAnte.omega)}
          </p>
        </Card>
      </div>

      {staked.length ? (
        <div className="overflow-x-auto shadow-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Slip</th>
                <th className="py-2 pr-3 font-medium">Market</th>
                <th className="py-2 pr-3 font-medium text-right">Odd</th>
                <th className="py-2 pr-3 font-medium text-right">P</th>
                <th className="py-2 pr-3 font-medium text-right">Full f*</th>
                <th className="py-2 pr-3 font-medium text-right">Stake</th>
                <th className="py-2 font-medium text-right">Units</th>
              </tr>
            </thead>
            <tbody>
              {staked.map((r) => {
                const p = byId.get(r.id);
                if (!p) return null;
                return (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <p className="font-medium">
                        {p.home} v {p.away}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.selection}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{kindLabel(p.kind)}</span>
                        <Badge variant="muted">{familyLabel(p.kind)}</Badge>
                        <Badge variant={r.tier === "strong" ? "win" : r.tier === "solid" ? "btts" : "outline"}>
                          {kellyTierLabel(r.tier)}
                        </Badge>
                        {r.haircut < 1 ? (
                          <Badge variant="outline">same fixture ×{r.haircut}</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{odds(p.odd)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{pct(p.accuracy)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{pct(r.full)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{pct(r.allocated)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtUnits(r.units)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 font-medium" colSpan={5}>
                  Card
                </td>
                <td className="pt-3 text-right font-mono tabular-nums">{pct(plan.cardAllocated)}</td>
                <td className="pt-3 text-right font-mono tabular-nums">{fmtUnits(plan.cardUnits)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">
            No slip on this card clears the 2% full-Kelly floor. Tick lines on the board, or the daily ten when it
            prints.
          </p>
        </Card>
      )}

      {passed.length ? (
        <div>
          <h3 className="mb-2 font-display text-lg">Pass</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {passed.map((r) => {
              const p = byId.get(r.id);
              if (!p) return null;
              return (
                <li key={r.id} className={cn("flex justify-between gap-3")}>
                  <span>
                    {p.home} v {p.away} · {p.selection}
                  </span>
                  <span className="font-mono tabular-nums">f* {pct(r.full)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
