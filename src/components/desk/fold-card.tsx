import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScorelineGrid } from "@/components/desk/scoreline-grid";
import { TeamMark } from "@/components/desk/team-mark";
import { edgePp, familyLabel, kindLabel, modelLabel, odds, pct } from "@/components/desk/format";
import { formatKickoff } from "@/lib/football/time";
import { kellyFull, kellyTier, kellyTierLabel } from "@/lib/football/kelly";
import type { ScoredPick } from "@/lib/football/types";
import { cn } from "@/lib/utils";

const badgeVariant = (kind: ScoredPick["kind"]) => {
  if (kind === "home" || kind === "away" || kind === "draw" || kind === "dc_1x" || kind === "dc_x2" || kind === "dc_12" || kind === "ah" || kind === "eh") {
    return "win" as const;
  }
  if (kind === "btts_yes" || kind === "btts_no" || kind === "home_score" || kind === "away_score") {
    return "btts" as const;
  }
  if (kind === "cs" || kind === "player_ga" || kind === "combo") return "cs" as const;
  return "ou" as const;
};

export function FoldCard({
  pick,
  checked,
  onToggle,
  timezone,
}: {
  pick: ScoredPick;
  checked: boolean;
  onToggle: () => void;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const bars: Array<[string, number | null]> =
    pick.kind === "cs"
      ? [
          ["Dixon–Coles cell", pick.models?.dixonColes ?? null],
          ["Karlis–Ntzoufras", pick.models?.karlisNtzoufras ?? null],
          ["Maher", pick.models?.maher ?? null],
          ["Shin CS book", pick.models?.shin],
          ["Elo cell", pick.models?.hvattumElo],
          ["H2H cell", pick.models?.baioH2h],
        ]
      : [
          ["Dixon–Coles", pick.models?.dixonColes],
          ["Shin", pick.models?.shin],
          ["API-Football", pick.models?.apiFootball],
          ["Elo", pick.models?.hvattumElo],
          ["H2H", pick.models?.baioH2h],
        ];

  return (
    <article className="stagger-in rounded-lg bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <span className="font-display text-3xl leading-none text-primary tabular-nums">{pick.rank ?? 0}</span>
          <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Save ${pick.selection}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant(pick.kind)}>
              {pick.notes?.includes("over-focus") ? "Over combo" : kindLabel(pick.kind)}
            </Badge>
            <span className="text-lg tabular-nums">{odds(pick.odd)}</span>
            <span className="text-sm text-muted-foreground">{pick.bookmaker}</span>
            <span className="ml-auto text-sm text-muted-foreground">{familyLabel(pick.kind)}</span>
            {pick.settled?.live || (pick.settled && pick.settled.hit == null) ? (
              <Badge variant="outline">
                Live {pick.settled.home}–{pick.settled.away}
              </Badge>
            ) : pick.settled ? (
              <Badge variant={pick.settled.hit ? "win" : "miss"}>
                {pick.settled.hit ? "Hit" : "Miss"}
                {pick.notes?.includes("over-focus") ? "" : ` ${pick.settled.home}–${pick.settled.away}`}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <TeamMark name={pick.home} src={pick.homeLogo} />
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight text-balance">
                {pick.home} <span className="text-muted-foreground">v</span> {pick.away}
              </p>
              <p className="text-xs text-muted-foreground">
                {pick.league} · {formatKickoff(pick.kickoff, timezone)}
              </p>
            </div>
          </div>
          {pick.facts && !pick.notes?.includes("over-focus") ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground tabular-nums">
              {pick.facts.homeForm || pick.facts.homeGf != null ? (
                <>
                  {pick.facts.homeRank != null ? `${pick.facts.homeRank}. ` : ""}
                  {pick.facts.homeForm ?? "—"}
                  {pick.facts.homeGf != null && pick.facts.homeGa != null
                    ? ` ${pick.facts.homeGf.toFixed(1)}/${pick.facts.homeGa.toFixed(1)}`
                    : ""}
                  <span className="text-foreground/40"> vs </span>
                  {pick.facts.awayRank != null ? `${pick.facts.awayRank}. ` : ""}
                  {pick.facts.awayForm ?? "—"}
                  {pick.facts.awayGf != null && pick.facts.awayGa != null
                    ? ` ${pick.facts.awayGf.toFixed(1)}/${pick.facts.awayGa.toFixed(1)}`
                    : ""}
                </>
              ) : pick.facts.homeRank != null && pick.facts.awayRank != null ? (
                <>
                  Table {pick.facts.homeRank} vs {pick.facts.awayRank}
                </>
              ) : (
                "Waiting on last-five / table"
              )}
              {pick.facts.h2hN > 0 ? (
                <>
                  {" · "}H2H {pick.facts.h2hWins}-{pick.facts.h2hDraws}-{pick.facts.h2hLosses} ({pick.facts.h2hN})
                </>
              ) : null}
              {pick.facts.homeOver15 != null || pick.facts.awayOver15 != null ? (
                <>
                  {" · "}O1.5{" "}
                  {pick.facts.homeOver15 != null ? `${Math.round(pick.facts.homeOver15 * 100)}%` : "—"}/
                  {pick.facts.awayOver15 != null ? `${Math.round(pick.facts.awayOver15 * 100)}%` : "—"}
                </>
              ) : null}
              {pick.facts.lineupConfirmed ? <>{" · "}XI in</> : null}
              {pick.facts.grade ? (
                <>
                  {" · "}
                  {pick.facts.grade === "FULL_DATA"
                    ? "full data"
                    : pick.facts.grade === "PARTIAL_DATA"
                      ? "partial data"
                      : pick.facts.grade === "LOW_DATA"
                        ? "thin sample"
                        : "low data"}
                </>
              ) : null}
            </p>
          ) : null}
          <p className="mt-2 text-sm">
            {pick.kind === "cs" ? (
              <>
                <span className="text-muted-foreground">Correct score</span>{" "}
                <span className="font-medium">{pick.selection}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-muted-foreground">P(cell)</span>{" "}
                <span className="font-mono tabular-nums">{pct(pick.scorelineP)}</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">Selection</span>{" "}
                <span className="font-medium">{pick.selection}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-muted-foreground">Most likely</span>{" "}
                <span className="font-mono tabular-nums">{pick.scoreline}</span>
              </>
            )}
          </p>
          {pick.comboLegs?.length ? (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {pick.comboLegs.map((leg, i) => (
                <li key={`${leg.kind}:${leg.selection}:${i}`}>
                  • {leg.selection}{" "}
                  <span className="font-mono tabular-nums">{odds(leg.odd)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {pick.advice ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{pick.advice}</p>
          ) : null}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <Stat label="Accuracy" value={pct(pick.accuracy)} />
            <Stat label="Implied" value={pct(pick.implied)} />
            <Stat label="Edge" value={edgePp(pick.edge)} />
            <Stat
              label="¼ Kelly"
              value={`${(pick.kellyQuarter * 100).toFixed(1)}% · ${kellyTierLabel(kellyTier(kellyFull(pick.odd, pick.accuracy)))}`}
            />
            {pick.aavs != null ? <Stat label="AAVS" value={pick.aavs.toFixed(3)} /> : null}
            {pick.robustness != null ? <Stat label="Robust" value={pct(pick.robustness)} /> : null}
            {pick.qualityGate ? (
              <Stat label="Quality" value={`${Math.round(pick.qualityGate.combined)}`} />
            ) : null}
          </dl>
          <button
            type="button"
            className="mt-3 text-xs tracking-wide text-muted-foreground uppercase hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide models" : "Model bars & scoreline grid"}
          </button>
          {open ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                {bars.map(([label, v]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-pitch"
                        style={{ width: `${Math.round((v ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-[11px] tabular-nums">
                      {v == null ? "—" : pct(v)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                λ {pick.lambdaHome.toFixed(2)} / {pick.lambdaAway.toFixed(2)} · ρ {pick.rho} · Elo{" "}
                {Math.round(pick.eloHome)}/{Math.round(pick.eloAway)} · agreement {pct(pick.agreement)} ·{" "}
                {modelLabel(pick.bestModel)}
              </p>
              <ScorelineGrid
                heat={pick.heat}
                highlight={pick.kind === "cs" ? pick.selection : pick.scoreline}
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("font-mono text-sm tabular-nums")}>{value}</dd>
    </div>
  );
}
