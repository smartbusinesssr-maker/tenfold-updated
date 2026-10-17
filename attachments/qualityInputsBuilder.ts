// Build quality inputs from data already fetched by the engines,
// for use by the two-stage quality selector at pruning time.

import type { QualityInputs } from './qualitySelector.ts';

// Inline copy of league rating lookup (engines run on Deno; no shared frontend lib).
const LEAGUE_RATINGS: Record<string, number> = {
  'Premier League': 1.0, 'La Liga': 1.0, 'Champions League': 1.0,
  'Serie A': 0.95, 'Bundesliga': 0.95, 'Ligue 1': 0.90, 'Europa League': 0.85,
  'Eredivisie': 0.80, 'Championship': 0.75, 'Primeira Liga': 0.80,
  'Belgian First Division A': 0.75,
  'U19': 0.50, 'U21': 0.55, 'Youth': 0.50, 'Reserve': 0.45, 'Amateur': 0.40, 'Women': 0.65,
};

function getLeagueRating(name?: string): number {
  if (!name) return 0.70;
  if (LEAGUE_RATINGS[name] !== undefined) return LEAGUE_RATINGS[name];
  for (const [k, v] of Object.entries(LEAGUE_RATINGS)) {
    if (name.includes(k)) return v;
  }
  return 0.70;
}

// Reuse placeholder fingerprints from the reliability gate
function isPlaceholderStanding(s: any): boolean {
  if (!s || !s.all) return true;
  const a = s.all;
  if (a.played === 15 && a.win === 5 && a.draw === 5 && a.lose === 5 &&
      a.goals?.for === 18 && a.goals?.against === 18) return true;
  if (a.played === 15 && a.win === 4 && a.draw === 5 && a.lose === 6 &&
      a.goals?.for === 16 && a.goals?.against === 19) return true;
  return false;
}

function safePlayed(s: any): number {
  if (isPlaceholderStanding(s)) return 0;
  return typeof s?.all?.played === 'number' ? s.all.played : 0;
}

// Build "WWDLW" form string from recent matches array (most recent first)
function buildFormString(recent: any[], teamId: number, take = 5): string {
  if (!Array.isArray(recent) || recent.length === 0) return '';
  const sorted = [...recent].sort((a, b) =>
    new Date(b.fixture?.date || 0).getTime() - new Date(a.fixture?.date || 0).getTime()
  );
  const out: string[] = [];
  for (const m of sorted.slice(0, take)) {
    const isHome = m.teams?.home?.id === teamId;
    const hg = m.goals?.home, ag = m.goals?.away;
    if (typeof hg !== 'number' || typeof ag !== 'number') continue;
    if (hg === ag) out.push('D');
    else if ((hg > ag && isHome) || (ag > hg && !isHome)) out.push('W');
    else out.push('L');
  }
  return out.join('');
}

// Average two form strings letter-by-letter into one (for draw picks)
function avgForm(a: string, b: string): string {
  const len = Math.max(a.length, b.length);
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    const ca = a[i], cb = b[i];
    if (!ca && !cb) break;
    // Pick the worse of the two so draw picks need both sides solid
    const rank = (ch?: string) => ch === 'W' ? 3 : ch === 'D' ? 2 : ch === 'L' ? 1 : 0;
    out.push(rank(ca) <= rank(cb) ? (ca || cb || 'D') : (cb || ca || 'D'));
  }
  return out.join('');
}

function h2hCounts(h2h: any[], homeId: number, awayId: number, predictionType: string):
  { favorable: number; total: number } {
  if (!Array.isArray(h2h) || h2h.length === 0) return { favorable: 0, total: 0 };
  let fav = 0;
  let total = 0;
  for (const m of h2h) {
    const hg = m.goals?.home, ag = m.goals?.away;
    if (typeof hg !== 'number' || typeof ag !== 'number') continue;
    total++;
    const homeWon = hg > ag, awayWon = ag > hg, draw = hg === ag;
    const wasHomeAtHome = m.teams?.home?.id === homeId;
    if (predictionType === 'draw') {
      if (draw) fav++;
    } else if (predictionType === 'home_win') {
      // "favorable" = the team we picked (home in this fixture) won this h2h
      if ((homeWon && wasHomeAtHome) || (awayWon && !wasHomeAtHome)) fav++;
    } else if (predictionType === 'away_win') {
      // "favorable" = the team we picked as away in current fixture won this h2h
      // wasHomeAtHome=true → picked home was past home → picked away was past away → awayWon
      // wasHomeAtHome=false → picked home was past away → picked away was past home → homeWon
      if ((awayWon && wasHomeAtHome) || (homeWon && !wasHomeAtHome)) fav++;
    }
  }
  return { favorable: fav, total };
}

export function buildQualityInputs(opts: {
  predictionType: 'home_win' | 'away_win' | 'draw';
  homeStanding: any;
  awayStanding: any;
  homeId: number;
  awayId: number;
  homeRecentMatches: any[];
  awayRecentMatches: any[];
  h2h: any[];
  reliabilityScore: number;
  leagueName?: string;
}): QualityInputs {
  const homeForm = buildFormString(opts.homeRecentMatches, opts.homeId);
  const awayForm = buildFormString(opts.awayRecentMatches, opts.awayId);

  let formString = '';
  if (opts.predictionType === 'home_win') formString = homeForm;
  else if (opts.predictionType === 'away_win') formString = awayForm;
  else formString = avgForm(homeForm, awayForm);

  const { favorable, total } = h2hCounts(opts.h2h, opts.homeId, opts.awayId, opts.predictionType);

  const minGames = Math.min(safePlayed(opts.homeStanding), safePlayed(opts.awayStanding));

  return {
    formString,
    h2hFavorable: favorable,
    h2hTotal: total,
    minGamesPlayed: minGames,
    reliabilityScore: opts.reliabilityScore,
    leagueRating: getLeagueRating(opts.leagueName),
  };
}
