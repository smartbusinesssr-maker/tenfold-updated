export const MODEL_LABELS: Record<string, string> = {
  dixonColes: "Dixon–Coles",
  shin: "Shin market",
  apiFootball: "API-Football",
  hvattumElo: "Hvattum Elo",
  baioH2h: "Baio H2H",
  maher: "Maher Poisson",
  karlisNtzoufras: "Karlis–Ntzoufras",
  negBin: "NegBin totals",
};

export const BOOKMAKER_RANK: Record<number, number> = {
  4: 100,
  8: 92,
  7: 78,
  16: 74,
  11: 70,
  3: 62,
  1: 55,
};

export function bookmakerScore(id: number, name: string): number {
  if (BOOKMAKER_RANK[id] != null) return BOOKMAKER_RANK[id]!;
  const n = name.toLowerCase();
  if (/pinnacle/.test(n)) return 100;
  if (/bet365/.test(n)) return 92;
  if (/william/.test(n)) return 78;
  if (/unibet/.test(n)) return 74;
  if (/1xbet/.test(n)) return 70;
  if (/betfair|sbobet|matchbook|circa/.test(n)) return 88;
  return 48;
}

const LEAGUE_TIER: Record<number, number> = {
  2: 1.0,
  3: 0.92,
  848: 0.86,
  39: 1.0,
  140: 0.99,
  135: 0.98,
  78: 0.98,
  61: 0.96,
  88: 0.9,
  94: 0.88,
  40: 0.84,
  48: 0.82,
  45: 0.8,
  144: 0.8,
  179: 0.78,
  203: 0.78,
  253: 0.76,
  71: 0.76,
  128: 0.74,
  41: 0.7,
  79: 0.68,
  136: 0.66,
  141: 0.66,
  42: 0.58,
  307: 0.7,
  585: 0.7,
};

const COUNTRY_TIER: Record<string, number> = {
  England: 0.86,
  Spain: 0.86,
  Italy: 0.86,
  Germany: 0.86,
  France: 0.82,
  Netherlands: 0.78,
  Portugal: 0.76,
  Belgium: 0.74,
  Turkey: 0.72,
  Scotland: 0.7,
  Brazil: 0.7,
  Argentina: 0.68,
  USA: 0.66,
  Mexico: 0.62,
  Uganda: 0.7,
};

const LIQUID = new Set([2, 3, 39, 140, 135, 78, 61]);

const EXPECTED_TOTAL: Record<number, number> = {
  78: 3.05,
  88: 3.1,
  2: 2.85,
  48: 2.85,
  253: 2.85,
  45: 2.8,
  39: 2.75,
  144: 2.75,
  3: 2.7,
  179: 2.7,
  61: 2.65,
  848: 2.65,
  94: 2.6,
  140: 2.55,
  135: 2.55,
  40: 2.5,
};

const SCAN_ORDER: Record<number, number> = {
  2: 1,
  39: 2,
  140: 2,
  135: 2,
  78: 2,
  61: 2,
  3: 3,
  848: 4,
  88: 5,
  94: 5,
  40: 5,
  48: 5,
  45: 5,
  144: 6,
  179: 6,
  203: 6,
  253: 6,
  71: 6,
  128: 6,
  41: 7,
  79: 7,
  136: 7,
  141: 7,
  42: 8,
};

export function leagueTier(id: number): number {
  return SCAN_ORDER[id] ?? 9;
}

export function isLiquidLeague(id: number): boolean {
  return LIQUID.has(id);
}

export function leagueExpectedTotal(id: number): number {
  return EXPECTED_TOTAL[id] ?? 2.65;
}

/** Pollard: home share of goals. Top leagues sit ~54–58%. */
const HOME_GOAL_SHARE: Record<number, number> = {
  2: 0.55,
  3: 0.55,
  39: 0.555,
  140: 0.575,
  135: 0.545,
  78: 0.545,
  61: 0.56,
  88: 0.54,
  94: 0.555,
  253: 0.57,
  71: 0.56,
  128: 0.58,
  203: 0.56,
  144: 0.555,
};

export function leagueScoringMeans(id: number): { home: number; away: number } {
  const tot = leagueExpectedTotal(id);
  const share = HOME_GOAL_SHARE[id] ?? 0.552;
  return { home: tot * share, away: tot * (1 - share) };
}

export function leagueWeight(leagueId: number, league: string, country: string, home = "", away = ""): number {
  let w = LEAGUE_TIER[leagueId] ?? COUNTRY_TIER[country] ?? 0.5;
  const n = `${league} ${country}`.toLowerCase();
  const teams = `${home} ${away}`;
  if (
    /u-?1[6-9]|u-?2[01]|youth|reserve|women|woman|frauen|femminile|femenin|femenina|ladies|wsl/.test(n) ||
    /\bW$/.test(home.trim()) ||
    /\bW$/.test(away.trim()) ||
    /\bW\b/.test(teams) ||
    /\bII\b|\bU21\b|reserves/i.test(teams)
  ) {
    w = Math.min(w, 0.28);
  }
  if (/friendl/.test(n)) w = Math.min(w, 0.28);
  if (
    /serie c|rfef|2\. division|3\. liga|national league|league two|challenge league|eerste|ligue 2|non-league|non league|isthmian|northern premier|southern league|fa trophy|fa vase/.test(
      n,
    )
  ) {
    w = Math.min(w, 0.45);
  }
  return clamp01(w);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export const SHARP_BOOK_RE = /pinnacle|betfair|sbobet|matchbook|pinn|circa/i;
