import type { ScoreCell } from "@/lib/football/types";
import { cn } from "@/lib/utils";

export function ScorelineGrid({
  heat,
  highlight,
  caption = "Home goals down · away across · P(H,A) percent. Modal cells are typically 8–14%.",
  region,
}: {
  heat: ScoreCell[];
  highlight: string;
  caption?: string;
  region?: "btts";
}) {
  const max = heat.reduce((m, c) => Math.max(m, c.p), 0) || 1;
  const top = [...heat].sort((a, b) => b.p - a.p).slice(0, 3);
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid grid-cols-6 gap-px">
        <span className="size-8" />
        {[0, 1, 2, 3, 4].map((a) => (
          <span
            key={`h-${a}`}
            className="flex size-8 items-center justify-center font-mono text-[10px] text-muted-foreground tabular-nums"
          >
            {a}
          </span>
        ))}
        {[0, 1, 2, 3, 4].map((h) => (
          <div key={`r-${h}`} className="contents">
            <span className="flex size-8 items-center justify-center font-mono text-[10px] text-muted-foreground tabular-nums">
              {h}
            </span>
            {[0, 1, 2, 3, 4].map((a) => {
              const cell = heat.find((c) => c.home === h && c.away === a);
              const p = cell?.p ?? 0;
              const on = highlight === `${h}-${a}`;
              const bttsCell = region === "btts" && h >= 1 && a >= 1;
              const shutout = region === "btts" && (h === 0 || a === 0);
              return (
                <span
                  key={`${h}-${a}`}
                  title={`${h}-${a} ${(p * 100).toFixed(1)}%`}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-sm font-mono text-[10px] tabular-nums",
                    on ? "ring-1 ring-primary text-primary-foreground" : "text-foreground",
                    bttsCell && !on ? "ring-1 ring-pitch/40" : null,
                    shutout ? "opacity-55" : null,
                  )}
                  style={{
                    background: `color-mix(in oklab, var(--color-pitch) ${Math.round((p / max) * (bttsCell ? 80 : 70))}%, var(--color-muted))`,
                  }}
                >
                  {(p * 100).toFixed(0)}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
        {top.map((c) => `${c.home}-${c.away} ${(c.p * 100).toFixed(1)}%`).join(" · ")}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}
