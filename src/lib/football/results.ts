import { gradeMarket } from "./models.ts";
import type { ScoredPick } from "./types.ts";

export type LiveScore = { home: number; away: number; live: boolean };

/** Grade saved picks against fresh scores. In-play lines stay ungraded so calibration only sees finals. */
export function applyScoreUpdates(
  picks: ScoredPick[],
  scores: Map<number, LiveScore>,
): { hits: number; n: number; live: number } {
  let hits = 0;
  let n = 0;
  let live = 0;
  for (const p of picks) {
    const multi =
      p.kind === "combo" && p.comboLegs?.some((leg) => leg.fixtureId != null && leg.fixtureId !== p.fixtureId);
    if (multi && p.comboLegs?.length) {
      let hit = true;
      let known = true;
      let anyLive = false;
      let won = 0;
      let shownHome = 0;
      let shownAway = 0;
      for (const leg of p.comboLegs) {
        const ls = scores.get(leg.fixtureId ?? p.fixtureId);
        if (!ls) {
          known = false;
          break;
        }
        shownHome = ls.home;
        shownAway = ls.away;
        if (ls.live) {
          anyLive = true;
          continue;
        }
        const one = gradeMarket(leg.kind, leg.selection, ls.home, ls.away);
        if (one == null) {
          known = false;
          break;
        }
        if (!one) hit = false;
        else won += 1;
      }
      if (!known) continue;
      if (anyLive) {
        p.settled = { home: shownHome, away: shownAway, hit: null, live: true };
        live += 1;
        continue;
      }
      p.settled = { home: won, away: p.comboLegs.length, hit, live: false };
      n += 1;
      if (hit) hits += 1;
      continue;
    }
    const s = scores.get(p.fixtureId);
    if (!s) continue;
    if (s.live) {
      p.settled = { home: s.home, away: s.away, hit: null, live: true };
      live += 1;
      continue;
    }
    const hit = gradeMarket(p.kind, p.selection, s.home, s.away, { comboLegs: p.comboLegs });
    p.settled = { home: s.home, away: s.away, hit, live: false };
    if (hit == null) continue;
    n += 1;
    if (hit) hits += 1;
  }
  return { hits, n, live };
}
