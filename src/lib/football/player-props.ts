/**
 * Player to score or assist — P(G ∪ A) = P(G) + P(A) − P(G ∩ A).
 * Minutes are required. Missing minutes / λ → unavailable, never 0.
 */

import type { LineupPlayer, PlayerSeasonStats } from "./types.ts";

export type { LineupPlayer, PlayerSeasonStats };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type PlayerGaMode = "or" | "score" | "assist";

export interface PlayerGaParsed {
  name: string;
  mode: PlayerGaMode;
}

/** Role λ/90 priors — used only as shrinkage targets, never as fabricated observations. */
export function playerRoleLambda(pos: string | null | undefined): { g: number; a: number } | null {
  const p = String(pos ?? "").toUpperCase();
  if (!p) return { g: 0.18, a: 0.14 };
  if (/^G\b|GK|GOAL/.test(p)) return null;
  if (/^F\b|^A\b|ST|CF|FW|STRIKER|FORWARD/.test(p)) return { g: 0.42, a: 0.16 };
  if (/LW|RW|WINGER|AM|ATT/.test(p)) return { g: 0.28, a: 0.24 };
  if (/^M\b|CM|MID/.test(p)) return { g: 0.14, a: 0.18 };
  if (/WB|WING.?BACK/.test(p)) return { g: 0.1, a: 0.16 };
  if (/^D\b|CB|FB|DEF/.test(p)) return { g: 0.06, a: 0.08 };
  return { g: 0.16, a: 0.14 };
}

/**
 * Confirmed starter → ~80–90. Bench with no minutes evidence → null.
 * Unconfirmed with a high start rate may keep season average; otherwise NO BET.
 */
export function expectedMinutes(opts: {
  confirmedStarter: boolean;
  confirmedBench: boolean;
  minutes: number | null;
  appearances: number | null;
  starts: number | null;
}): number | null {
  const apps = opts.appearances;
  const mins = opts.minutes;
  const starts = opts.starts;
  const avg = mins != null && apps != null && apps > 0 ? mins / apps : mins != null && mins > 0 ? mins / Math.max(1, starts ?? 8) : null;
  const startRate = starts != null && apps != null && apps > 0 ? starts / apps : null;

  if (opts.confirmedStarter) {
    if (avg != null && avg >= 20) return clamp(0.35 * 84 + 0.65 * avg, 55, 95);
    return 82;
  }
  if (opts.confirmedBench) {
    if (avg != null && avg >= 18 && avg <= 55) return clamp(avg, 18, 45);
    if (avg != null && avg > 55 && (startRate == null || startRate < 0.55)) return 28;
    return null;
  }
  if (avg != null && avg >= 60 && (startRate == null || startRate >= 0.55) && (apps == null || apps >= 5)) {
    return clamp(avg * 0.9, 55, 90);
  }
  return null;
}

function shrinkPer90(obs: number, n90: number, prior: number, k = 8): number {
  return (n90 * obs + k * prior) / (n90 + k);
}

/**
 * λ_G / λ_A for this fixture. Scales by expected minutes and the team's current λ
 * versus the player's season team-goal environment. Does not invent xG/xA.
 */
export function playerAttackLambdas(opts: {
  stats: PlayerSeasonStats;
  expectedMinutes: number;
  teamLambda: number | null;
  teamGfPer90: number | null;
  pos?: string | null;
}): { lambdaG: number; lambdaA: number; n90: number } | null {
  const mins = opts.stats.minutes;
  if (mins == null || mins < 180) return null;
  const role = playerRoleLambda(opts.pos ?? opts.stats.position);
  if (!role) return null;
  const n90 = mins / 90;
  const gObs = opts.stats.goals == null ? role.g : opts.stats.goals / n90;
  const aObs = opts.stats.assists == null ? role.a : opts.stats.assists / n90;
  let g90 = shrinkPer90(Math.max(0, gObs), n90, role.g);
  let a90 = shrinkPer90(Math.max(0, aObs), n90, role.a);

  if (opts.stats.sot != null && n90 > 0) {
    const sot90 = opts.stats.sot / n90;
    g90 = 0.7 * g90 + 0.3 * clamp(sot90 * 0.32, 0, 0.9);
  }
  if (opts.stats.keyPasses != null && n90 > 0) {
    const kp90 = opts.stats.keyPasses / n90;
    a90 = 0.7 * a90 + 0.3 * clamp(kp90 * 0.18, 0, 0.8);
  }
  if (opts.stats.penaltyGoals != null && opts.stats.penaltyGoals > 0 && n90 > 0) {
    g90 += clamp(opts.stats.penaltyGoals / n90, 0, 0.2);
  }

  const scaleMin = clamp(opts.expectedMinutes / 90, 0.2, 1.05);
  let lambdaG = g90 * scaleMin;
  let lambdaA = a90 * scaleMin;

  if (opts.teamLambda != null && opts.teamLambda > 0 && opts.teamGfPer90 != null && opts.teamGfPer90 > 0.15) {
    const env = clamp(opts.teamLambda / opts.teamGfPer90, 0.55, 1.55);
    lambdaG *= env;
    lambdaA *= env;
  }

  return {
    lambdaG: clamp(lambdaG, 0.02, 1.6),
    lambdaA: clamp(lambdaA, 0.02, 1.4),
    n90,
  };
}

export function parsePlayerGa(selection: string): PlayerGaParsed | null {
  const t = String(selection ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  let mode: PlayerGaMode = "or";
  let name = t;
  if (/\bto score or assist\b|g\s*∪\s*a|\bgoal or assist\b|\bscore or assist\b/.test(lower)) {
    mode = "or";
    name = t.replace(/\s*(to score or assist|G\s*∪\s*A|goal or assist|score or assist)\s*/gi, " ").trim();
  } else if (/\bto assist\b|\bassists?\b/.test(lower) && !/\bscore\b/.test(lower)) {
    mode = "assist";
    name = t.replace(/\s*(to assist|assists?)\s*/gi, " ").trim();
  } else if (/\bto score\b|anytime|goalscorer|goal scorer/.test(lower)) {
    mode = "score";
    name = t.replace(/\s*(to score|anytime( goalscorer)?|goalscorer|goal scorer)\s*/gi, " ").trim();
  } else {
    mode = "or";
  }
  name = name.replace(/^[\s\-–:]+|[\s\-–:]+$/g, "").trim();
  if (name.length < 2) return null;
  return { name, mode };
}

export function formatPlayerGa(name: string, mode: PlayerGaMode): string {
  if (mode === "score") return `${name} to score`;
  if (mode === "assist") return `${name} to assist`;
  return `${name} G∪A`;
}

export function namesMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const lastA = na.split(" ").pop() ?? "";
  const lastB = nb.split(" ").pop() ?? "";
  if (lastA.length >= 4 && lastA === lastB) return true;
  return false;
}

function normName(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchPlayer(
  name: string,
  lineup: LineupPlayer[],
  stats: PlayerSeasonStats[],
): { player: LineupPlayer | null; stats: PlayerSeasonStats | null } {
  const fromStats = stats.find((p) => namesMatch(p.name, name)) ?? null;
  const fromXi =
    lineup.find((p) => (fromStats ? p.id === fromStats.id : false)) ??
    lineup.find((p) => namesMatch(p.name, name)) ??
    null;
  const st = fromStats ?? (fromXi ? stats.find((p) => p.id === fromXi.id) ?? null : null);
  return { player: fromXi, stats: st };
}
