/**
 * Kelly criterion (Kelly 1956; Thorp 2008 fractional Kelly).
 * Ranking still ignores stake size. This module sizes the card.
 *
 * f* = (b p − q) / b  with b = decimal odds − 1, q = 1 − p.
 * Full Kelly maximises E[log wealth] and has brutal variance — the desk
 * defaults to quarter-Kelly. Simultaneous slips share one bankroll:
 * scale the vector if the card would exceed the cap. Same-fixture markets
 * are not independent — keep the strongest and haircut the rest.
 */

export const KELLY_FRACTIONS = [0.125, 0.25, 0.5, 1] as const;
export type KellyFraction = (typeof KELLY_FRACTIONS)[number];

export const DEFAULT_KELLY_FRACTION: KellyFraction = 0.25;
export const DEFAULT_BANKROLL = 100;
export const KELLY_FULL_CAP = 0.25;
export const KELLY_PICK_CAP = 0.08;
export const KELLY_CARD_CAP = 0.2;
export const KELLY_MIN_FULL = 0.02;
export const SAME_FIXTURE_HAIRCUT = 0.45;

export type KellyTier = "pass" | "lean" | "solid" | "strong";

export function kellyFull(odd: number, p: number): number {
  const b = odd - 1;
  if (!(b > 0) || !(p > 0) || p >= 1) return 0;
  const f = (b * p - (1 - p)) / b;
  if (!(f > 0)) return 0;
  return Math.min(KELLY_FULL_CAP, f);
}

/** Existing eligibility helper: quarter-Kelly, capped at 8% of bankroll. */
export function quarterKelly(odd: number, value: number): number {
  const f = 0.25 * kellyFull(odd, value);
  return Math.max(0, Math.min(KELLY_PICK_CAP, f));
}

export function kellyTier(full: number): KellyTier {
  if (full < KELLY_MIN_FULL) return "pass";
  if (full < 0.05) return "lean";
  if (full < 0.1) return "solid";
  return "strong";
}

export function kellyTierLabel(tier: KellyTier): string {
  if (tier === "pass") return "Pass";
  if (tier === "lean") return "Lean";
  if (tier === "solid") return "Solid";
  return "Strong";
}

export function fractionLabel(frac: KellyFraction): string {
  if (frac === 0.125) return "⅛ Kelly";
  if (frac === 0.25) return "¼ Kelly";
  if (frac === 0.5) return "½ Kelly";
  return "Full Kelly";
}

export interface KellyPick {
  id: string;
  fixtureId: number;
  odd: number;
  p: number;
}

export interface KellyRow {
  id: string;
  fixtureId: number;
  full: number;
  haircut: number;
  allocated: number;
  units: number;
  tier: KellyTier;
  growth: number;
}

export interface KellyPlan {
  fraction: KellyFraction;
  bankroll: number;
  rows: KellyRow[];
  cardFull: number;
  cardAllocated: number;
  cardUnits: number;
  scaled: boolean;
  scale: number;
  growth: number;
  nStaked: number;
  nPassed: number;
}

function logGrowth(odd: number, p: number, f: number): number {
  if (f <= 0 || f >= 1) return 0;
  const b = odd - 1;
  const win = 1 + b * f;
  const lose = 1 - f;
  if (win <= 0 || lose <= 0) return 0;
  return p * Math.log(win) + (1 - p) * Math.log(lose);
}

function fixtureHaircut(picks: Array<KellyPick & { full: number }>): Map<string, number> {
  const byFx = new Map<number, Array<KellyPick & { full: number }>>();
  for (const p of picks) {
    const arr = byFx.get(p.fixtureId) ?? [];
    arr.push(p);
    byFx.set(p.fixtureId, arr);
  }
  const out = new Map<string, number>();
  for (const group of byFx.values()) {
    const ranked = [...group].sort((a, b) => b.full - a.full);
    ranked.forEach((p, i) => out.set(p.id, i === 0 ? 1 : SAME_FIXTURE_HAIRCUT));
  }
  return out;
}

export function planKellyCard(
  picks: KellyPick[],
  opts: { bankroll?: number; fraction?: KellyFraction; cardCap?: number } = {},
): KellyPlan {
  const bankroll = opts.bankroll != null && opts.bankroll > 0 ? opts.bankroll : DEFAULT_BANKROLL;
  const fraction = opts.fraction ?? DEFAULT_KELLY_FRACTION;
  const cardCap = opts.cardCap ?? KELLY_CARD_CAP;

  const sized = picks.map((p) => ({ ...p, full: kellyFull(p.odd, p.p) }));
  const hair = fixtureHaircut(sized);

  const raw = sized.map((p) => {
    const h = hair.get(p.id) ?? 1;
    const allocated = Math.min(KELLY_PICK_CAP, fraction * p.full * h);
    return { ...p, haircut: h, allocated: allocated > 0 ? allocated : 0 };
  });

  const rawSum = raw.reduce((s, r) => s + r.allocated, 0);
  const scale = rawSum > cardCap && rawSum > 0 ? cardCap / rawSum : 1;

  const rows: KellyRow[] = raw.map((r) => {
    const allocated = r.allocated * scale;
    const stakeable = r.full >= KELLY_MIN_FULL && allocated > 0;
    const f = stakeable ? allocated : 0;
    return {
      id: r.id,
      fixtureId: r.fixtureId,
      full: r.full,
      haircut: r.haircut,
      allocated: f,
      units: f * bankroll,
      tier: kellyTier(r.full),
      growth: f > 0 ? logGrowth(r.odd, r.p, f) : 0,
    };
  });

  const staked = rows.filter((r) => r.allocated > 0);
  const cardAllocated = staked.reduce((s, r) => s + r.allocated, 0);
  const cardFull = sized.reduce((s, r) => s + r.full, 0);
  const growth = staked.reduce((s, r) => s + r.growth, 0);

  return {
    fraction,
    bankroll,
    rows,
    cardFull,
    cardAllocated,
    cardUnits: cardAllocated * bankroll,
    scaled: scale < 1,
    scale,
    growth,
    nStaked: staked.length,
    nPassed: rows.filter((r) => r.tier === "pass").length,
  };
}

export function rowFor(plan: KellyPlan, id: string): KellyRow | undefined {
  return plan.rows.find((r) => r.id === id);
}
