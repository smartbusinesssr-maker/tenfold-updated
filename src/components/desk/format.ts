import { MODEL_LABELS } from "@/lib/football/leagues";
import type { MarketKind } from "@/lib/football/types";

export function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function odds(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export function edgePp(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const pp = n * 100;
  const sign = pp >= 0 ? "+" : "";
  return `${sign}${pp.toFixed(1)} pp`;
}

export function modelLabel(name: string): string {
  return MODEL_LABELS[name] ?? name;
}

export function kindLabel(kind: MarketKind): string {
  switch (kind) {
    case "home":
      return "Home";
    case "away":
      return "Away";
    case "draw":
      return "Draw";
    case "btts_yes":
      return "BTTS Yes";
    case "btts_no":
      return "BTTS No";
    case "over_05":
      return "Over 0.5";
    case "under_05":
      return "Under 0.5";
    case "over_15":
      return "Over 1.5";
    case "under_15":
      return "Under 1.5";
    case "over_25":
      return "Over 2.5";
    case "under_25":
      return "Under 2.5";
    case "over_35":
      return "Over 3.5";
    case "under_35":
      return "Under 3.5";
    case "over_45":
      return "Over 4.5";
    case "under_45":
      return "Under 4.5";
    case "cs":
      return "Correct score";
    case "dc_1x":
      return "1X";
    case "dc_x2":
      return "X2";
    case "dc_12":
      return "12";
    case "home_score":
      return "Home to score";
    case "away_score":
      return "Away to score";
    case "ah":
      return "Asian handicap";
    case "eh":
      return "European handicap";
    case "ou_asian":
      return "Asian total";
    case "corners":
      return "Corners";
    case "cards":
      return "Bookings";
    case "player_ga":
      return "Player G∪A";
    case "multi_goals":
      return "Multi goals";
    case "odd_even":
      return "Odd/Even";
    case "combo":
      return "Combo";
  }
}

export function familyLabel(kind: MarketKind): string {
  if (kind === "home" || kind === "away") return "Win";
  if (kind === "draw") return "Draw";
  if (kind === "btts_yes" || kind === "btts_no") return "BTTS";
  if (kind === "cs") return "CS";
  if (kind === "dc_1x" || kind === "dc_x2" || kind === "dc_12") return "DC";
  if (kind === "home_score" || kind === "away_score") return "Team";
  if (kind === "ah" || kind === "eh") return "Handicap";
  if (kind === "corners") return "Corners";
  if (kind === "cards") return "Cards";
  if (kind === "player_ga") return "Player";
  if (kind === "multi_goals") return "Multi";
  if (kind === "odd_even") return "Odd/Even";
  if (kind === "combo") return "Combo";
  return "O/U";
}
