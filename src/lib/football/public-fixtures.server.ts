import { publicGet } from "./client.server";
import { extractEspnStandings, inferSeason, oddsFromEspn } from "./extract";
import { leagueExpectedTotal } from "./leagues";
import { addDaysYmd, ymdToEspn } from "./time";
import type { RawFixture, StandingRow } from "./types";

const ESPN_LEAGUES: Array<{ slug: string; name: string; country: string; id: number }> = [
  { slug: "eng.1", name: "Premier League", country: "England", id: 39 },
  { slug: "eng.2", name: "Championship", country: "England", id: 40 },
  { slug: "eng.3", name: "League One", country: "England", id: 41 },
  { slug: "eng.league_cup", name: "League Cup", country: "England", id: 48 },
  { slug: "ger.1", name: "Bundesliga", country: "Germany", id: 78 },
  { slug: "ger.2", name: "2. Bundesliga", country: "Germany", id: 79 },
  { slug: "ita.1", name: "Serie A", country: "Italy", id: 135 },
  { slug: "ita.2", name: "Serie B", country: "Italy", id: 136 },
  { slug: "esp.1", name: "La Liga", country: "Spain", id: 140 },
  { slug: "esp.2", name: "La Liga 2", country: "Spain", id: 141 },
  { slug: "fra.1", name: "Ligue 1", country: "France", id: 61 },
  { slug: "ned.1", name: "Eredivisie", country: "Netherlands", id: 88 },
  { slug: "por.1", name: "Primeira Liga", country: "Portugal", id: 94 },
  { slug: "bel.1", name: "Pro League", country: "Belgium", id: 144 },
  { slug: "sco.1", name: "Premiership", country: "Scotland", id: 179 },
  { slug: "uefa.champions", name: "UEFA Champions League", country: "World", id: 2 },
  { slug: "uefa.europa", name: "UEFA Europa League", country: "World", id: 3 },
  { slug: "uefa.europa.conf", name: "UEFA Conference League", country: "World", id: 848 },
];

type EspnEvent = {
  id?: string;
  date?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      team?: { id?: string; displayName?: string; logo?: string };
      form?: string;
      records?: Array<{ summary?: string }>;
    }>;
    odds?: unknown[];
    venue?: { fullName?: string };
  }>;
};

type EspnBoard = { events?: EspnEvent[] };

export interface PublicMatch {
  fixture: RawFixture;
  homeForm: string | null;
  awayForm: string | null;
  over15: number | null;
  under15: number | null;
  over25: number | null;
  under25: number | null;
  homeOdd: number | null;
  awayOdd: number | null;
  leagueAvg: number;
}

function statusShort(state?: string, completed?: boolean): string {
  if (completed || state === "post") return "FT";
  if (state === "in") return "LIVE";
  return "NS";
}

export async function loadPublicMatches(date: string, timezone: string, deadline: number): Promise<PublicMatch[]> {
  const days = [date, addDaysYmd(date, 1)];
  const jobs: Array<Promise<PublicMatch[]>> = [];
  for (const day of days) {
    for (const lg of ESPN_LEAGUES) {
      jobs.push(
        (async () => {
          try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.slug}/scoreboard?dates=${ymdToEspn(day)}`;
            const board = await publicGet<EspnBoard>(url, deadline);
            const out: PublicMatch[] = [];
            for (const ev of board.events ?? []) {
              const st = statusShort(ev.status?.type?.state, ev.status?.type?.completed);
              if (st !== "NS") continue;
              const comps = ev.competitions?.[0]?.competitors ?? [];
              const homeC = comps.find((c) => c.homeAway === "home");
              const awayC = comps.find((c) => c.homeAway === "away");
              if (!homeC?.team?.displayName || !awayC?.team?.displayName) continue;
              const fid = Number(ev.id) || lg.id * 1_000_000 + Math.abs(hash(`${lg.id}:${ev.date}:${homeC.team.displayName}`));
              const odds = oddsFromEspn(ev as Parameters<typeof oddsFromEspn>[0]);
              out.push({
                fixture: {
                  fixtureId: fid,
                  date: day,
                  kickoff: ev.date ?? "",
                  timestamp: ev.date ? Math.floor(new Date(ev.date).getTime() / 1000) : 0,
                  timezone,
                  status: "NS",
                  leagueId: lg.id,
                  league: lg.name,
                  country: lg.country,
                  round: "",
                  homeId: Number(homeC.team.id) || 0,
                  awayId: Number(awayC.team.id) || 0,
                  home: homeC.team.displayName,
                  away: awayC.team.displayName,
                  homeLogo: homeC.team.logo ?? null,
                  awayLogo: awayC.team.logo ?? null,
                  season: inferSeason(ev.date ?? "", ev.date ? Math.floor(new Date(ev.date).getTime() / 1000) : 0),
                },
                homeForm: homeC.form ?? null,
                awayForm: awayC.form ?? null,
                over15: odds.over15 ?? null,
                under15: odds.under15 ?? null,
                over25: odds.over25 ?? null,
                under25: odds.under25 ?? null,
                homeOdd: odds.home ?? null,
                awayOdd: odds.away ?? null,
                leagueAvg: leagueExpectedTotal(lg.id),
              });
            }
            return out;
          } catch {
            return [];
          }
        })(),
      );
    }
  }
  const settled = await Promise.allSettled(jobs);
  const all: PublicMatch[] = [];
  const seen = new Set<number>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const m of s.value) {
      if (seen.has(m.fixture.fixtureId)) continue;
      seen.add(m.fixture.fixtureId);
      all.push(m);
    }
  }
  return all;
}

export async function loadEspnStandings(leagueId: number, deadline: number): Promise<StandingRow[]> {
  const lg = ESPN_LEAGUES.find((x) => x.id === leagueId);
  if (!lg) return [];
  try {
    const url = `https://site.api.espn.com/apis/v2/sports/soccer/${lg.slug}/standings`;
    const raw = await publicGet<unknown>(url, deadline);
    return extractEspnStandings(raw);
  } catch {
    return [];
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
