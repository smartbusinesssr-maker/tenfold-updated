import { Checkbox } from "@/components/ui/checkbox";
import { TeamMark } from "@/components/desk/team-mark";
import { edgePp, kindLabel, modelLabel, odds, pct } from "@/components/desk/format";
import { formatKickoff } from "@/lib/football/time";
import type { ScoredPick } from "@/lib/football/types";

export function BoardTable({
  rows,
  selected,
  onToggle,
  timezone,
  empty,
}: {
  rows: ScoredPick[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  timezone: string;
  empty: string;
}) {
  if (!rows.length) {
    return <p className="py-8 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="text-sm text-muted-foreground">
            <tr className="border-b border-border">
              <th className="w-10 py-2 font-medium">Save</th>
              <th className="py-2 font-medium">Match</th>
              <th className="py-2 font-medium">Kickoff</th>
              <th className="py-2 font-medium">Market</th>
              <th className="py-2 font-medium">Odd</th>
              <th className="py-2 font-medium">Acc.</th>
              <th className="py-2 font-medium">Model</th>
              <th className="py-2 font-medium">Edge</th>
              <th className="py-2 font-medium">CS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="py-2">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => onToggle(p.id)}
                    aria-label={`Save ${p.selection}`}
                  />
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <TeamMark name={p.home} src={p.homeLogo} size="sm" />
                    <div>
                      <div className="font-medium">
                        {p.home} v {p.away}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.league}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2 text-muted-foreground">{formatKickoff(p.kickoff, timezone)}</td>
                <td className="py-2">{kindLabel(p.kind)}</td>
                <td className="py-2 tabular-nums">
                  {odds(p.odd)} <span className="text-muted-foreground">{p.bookmaker}</span>
                </td>
                <td className="py-2 tabular-nums">{pct(p.accuracy)}</td>
                <td className="py-2 text-muted-foreground">{modelLabel(p.bestModel)}</td>
                <td className="py-2 tabular-nums">{edgePp(p.edge)}</td>
                <td className="py-2 tabular-nums">
                  {p.kind === "cs" ? `${p.scoreline} ${pct(p.scorelineP)}` : p.scoreline}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((p) => (
          <li key={p.id} className="rounded-lg bg-card p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selected.has(p.id)}
                onCheckedChange={() => onToggle(p.id)}
                aria-label={`Save ${p.selection}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <TeamMark name={p.home} src={p.homeLogo} size="sm" />
                  <p className="font-medium leading-tight">
                    {p.home} v {p.away}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.league} · {formatKickoff(p.kickoff, timezone)}
                </p>
                <p className="mt-2 text-sm tabular-nums">
                  {kindLabel(p.kind)} · {odds(p.odd)} · {pct(p.accuracy)} · {edgePp(p.edge)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
