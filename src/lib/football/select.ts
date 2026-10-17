import {
  COMBO_ODDS_BAND,
  CS_ODDS_BAND,
  DAILY_FOLD_SIZE,
  DRAW_ODDS_BAND,
  MULTI_GOALS_ODDS_BAND,
  ODDS_PLAYABLE,
  PLAYER_ODDS_BAND,
  TARGET_AH_PICKS,
  TARGET_BTTS_PICKS,
  TARGET_CS_PICKS,
  TARGET_DC_PICKS,
  TARGET_OU_PICKS,
  TARGET_WIN_PICKS,
  TEAM_ODDS_BAND,
  emptyFamilyCount,
  isExtraFamily,
  isHeadlineOu,
  type ComboLeg,
  type MarketFamily,
  type MarketKind,
  type ScoredPick,
} from "./types.ts";
import { gateBestBets, gateDailyTen } from "./quality.ts";
import { aavs } from "./markets-engine.ts";
import { quarterKelly } from "./kelly.ts";
import { compositeScore } from "./models.ts";

const MIN_ACCURACY = 0.5;
const MIN_WIN_ACCURACY = 0.54;
const MIN_OU_ACCURACY = 0.5;
const MIN_CS_ACCURACY = 0.1;
const MIN_DRAW_ACCURACY = 0.26;
const MIN_DC_ACCURACY = 0.62;
const MIN_TEAM_ACCURACY = 0.7;
const MIN_MULTI = 0.4;
const MIN_ODD_EVEN = 0.54;
const MIN_COMBO = 0.4;
const OVER_BLOCK = "over-focus-block";
const OVER_FOCUS = "over-focus";
const OVER_COMBO_MIN_ODDS = 2;
const OVER_COMBO_MAX_ODDS = 5;
const OVER_KINDS = new Set<MarketKind>(["home_score", "away_score", "over_15", "over_25"]);
const MIN_PLAYER = 0.42;
const MIN_CORNERS = 0.52;
const MIN_EV = 0.96;
const MIN_DRAW_EV = 0.92;
const MIN_CS_EV = 0.8;
const MIN_EDGE = -0.01;
const MIN_AGREEMENT = 0.18;
const MIN_LEAGUE_W = 0.5;
const MIN_TEN_QUALITY = 0.6;
const MIN_BEST_QUALITY = 0.6;
const MIN_SAMPLE = 5;

/** Combos / parity / player props never headline. They live on Markets, not the ten or Best. */
const RESEARCH_FAMILIES = new Set<MarketFamily>(["combo", "multi", "parity", "player", "cards", "corners"]);

function hasLastFive(f: ScoredPick["facts"]): boolean {
  if (!f) return false;
  if (f.homeGf != null && f.awayGf != null) return true;
  const hf = (f.homeForm ?? "").replace(/[^WDL]/gi, "");
  const af = (f.awayForm ?? "").replace(/[^WDL]/gi, "");
  return hf.length >= 3 && af.length >= 3;
}

function hasSample(f: ScoredPick["facts"]): boolean {
  if (!f) return false;
  const nH = f.lastNHome ?? f.homePlayed ?? 0;
  const nA = f.lastNAway ?? f.awayPlayed ?? 0;
  return nH >= MIN_SAMPLE && nA >= MIN_SAMPLE;
}

/** Last-five + sample + a real grade. Stubs without facts stay eligible so mixer tests can run. */
export function isDataBacked(c: ScoredPick, mode: "ten" | "best" = "ten"): boolean {
  const f = c.facts;
  if (!f) return mode === "ten";
  if (f.grade === "UNUSABLE" || f.grade === "LOW_DATA") return false;
  if (!hasLastFive(f) || !hasSample(f)) return false;
  if (c.bookmaker && /model fair/i.test(c.bookmaker)) return false;
  if (mode === "best") {
    return f.grade === "FULL_DATA" && (f.quality ?? 0) >= MIN_BEST_QUALITY;
  }
  if (f.grade === "FULL_DATA") return true;
  return f.grade === "PARTIAL_DATA" && (f.quality ?? 0) >= MIN_TEN_QUALITY;
}

function isEligible(c: ScoredPick, band: { min: number; max: number }): boolean {
  if (c.facts && !isDataBacked(c, "ten")) return false;
  if (c.facts?.grade === "UNUSABLE" || c.facts?.grade === "LOW_DATA") return false;
  if ((c.leagueWeight ?? 1) < MIN_LEAGUE_W) return false;
  if ((c.agreement ?? 1) < MIN_AGREEMENT) return false;
  if (c.kind === "under_15" || c.kind === "over_15" || c.kind === "under_05") return false;
  if (c.kind === "under_25" && c.odd < 1.55) return false;
  if (c.bookmaker && /model fair/i.test(c.bookmaker)) return false;
  const implied = c.implied || (c.odd > 1 ? 1 / c.odd : 0.5);
  const edge = c.accuracy - implied;
  const postedEdge = c.edge ?? edge;
  const ev = c.accuracy * c.odd;
  if (
    c.kellyQuarter != null &&
    c.kellyQuarter <= 0 &&
    c.family !== "draw" &&
    c.family !== "ah" &&
    c.kind !== "ou_asian" &&
    c.family !== "combo" &&
    c.family !== "multi" &&
    c.family !== "parity" &&
    c.family !== "player" &&
    c.family !== "corners"
  ) {
    return false;
  }
  // Draw EV floor is 0.92 (slightly negative allowed). AH / Asian totals use settlement EV in `edge`.
  if (
    postedEdge < 0 &&
    c.family !== "draw" &&
    c.family !== "ah" &&
    c.kind !== "ou_asian" &&
    c.family !== "combo" &&
    c.family !== "multi" &&
    c.family !== "parity" &&
    c.family !== "player" &&
    c.family !== "corners"
  ) {
    return false;
  }
  if (c.family === "cs") {
    return (
      c.accuracy >= MIN_CS_ACCURACY &&
      ev >= MIN_CS_EV &&
      edge >= 0 &&
      c.odd >= CS_ODDS_BAND.min &&
      c.odd <= CS_ODDS_BAND.max
    );
  }
  if (c.family === "draw") {
    return (
      c.accuracy >= MIN_DRAW_ACCURACY &&
      ev >= MIN_DRAW_EV &&
      edge >= MIN_EDGE &&
      c.odd >= DRAW_ODDS_BAND.min &&
      c.odd <= DRAW_ODDS_BAND.max
    );
  }
  if (c.family === "dc") {
    return (
      c.accuracy >= MIN_DC_ACCURACY &&
      ev >= MIN_EV &&
      edge >= MIN_EDGE &&
      c.odd >= band.min &&
      c.odd <= band.max
    );
  }
  if (c.family === "team") {
    if (c.facts && c.facts.grade !== "FULL_DATA") return false;
    return (
      c.accuracy >= MIN_TEAM_ACCURACY &&
      ev >= MIN_EV &&
      edge >= MIN_EDGE &&
      c.odd >= TEAM_ODDS_BAND.min &&
      c.odd <= TEAM_ODDS_BAND.max
    );
  }
  if (c.family === "ah") {
    return (
      c.accuracy >= 0.5 &&
      edge >= MIN_EDGE &&
      (c.edge ?? postedEdge) > 0 &&
      c.odd >= band.min &&
      c.odd <= band.max
    );
  }
  if (c.kind === "ou_asian") {
    return (
      c.accuracy >= MIN_OU_ACCURACY &&
      (c.edge ?? postedEdge) > 0 &&
      c.odd >= band.min &&
      c.odd <= band.max
    );
  }
  if (c.family === "player") {
    return (
      c.accuracy >= MIN_PLAYER &&
      edge >= MIN_EDGE &&
      c.odd >= PLAYER_ODDS_BAND.min &&
      c.odd <= PLAYER_ODDS_BAND.max
    );
  }
  if (c.family === "corners") {
    return (
      c.accuracy >= MIN_CORNERS &&
      edge >= MIN_EDGE &&
      c.odd >= band.min &&
      c.odd <= band.max
    );
  }
  if (c.family === "multi") {
    return (
      c.accuracy >= MIN_MULTI &&
      edge >= MIN_EDGE &&
      c.odd >= MULTI_GOALS_ODDS_BAND.min &&
      c.odd <= MULTI_GOALS_ODDS_BAND.max
    );
  }
  if (c.family === "parity") {
    return (
      c.accuracy >= MIN_ODD_EVEN &&
      edge >= MIN_EDGE &&
      c.odd >= band.min &&
      c.odd <= band.max
    );
  }
  if (c.family === "combo") {
    return (
      c.accuracy >= MIN_COMBO &&
      edge >= MIN_EDGE &&
      c.odd >= COMBO_ODDS_BAND.min &&
      c.odd <= COMBO_ODDS_BAND.max
    );
  }
  const minAcc =
    c.family === "win" ? MIN_WIN_ACCURACY : c.family === "ou" ? MIN_OU_ACCURACY : MIN_ACCURACY;
  return (
    c.accuracy >= minAcc &&
    ev >= MIN_EV &&
    edge >= MIN_EDGE &&
    c.odd >= band.min &&
    c.odd <= band.max
  );
}

function familyCap(pass: number, allowCs: boolean): Record<MarketFamily, number> {
  if (pass === 1) {
    return {
      ...emptyFamilyCount(),
      win: TARGET_WIN_PICKS,
      btts: TARGET_BTTS_PICKS,
      ou: TARGET_OU_PICKS,
      cs: TARGET_CS_PICKS,
    };
  }
  if (pass === 2) {
    return {
      ...emptyFamilyCount(),
      win: 5,
      btts: 3,
      ou: 2,
      cs: 0,
      draw: 1,
      dc: TARGET_DC_PICKS,
      ah: TARGET_AH_PICKS,
      team: 1,
    };
  }
  return {
    ...emptyFamilyCount(),
    win: 6,
    btts: 4,
    ou: 3,
    cs: allowCs ? 1 : 0,
    draw: 1,
    dc: 2,
    ah: 2,
    team: 1,
  };
}

export function selectDailyTen(candidates: ScoredPick[]): ScoredPick[] {
  const fold: ScoredPick[] = [];
  const fixtures = new Set<number>();
  const leagueCount = new Map<number, number>();
  const familyCount = emptyFamilyCount();
  const playable = candidates.filter((c) => isEligible(c, ODDS_PLAYABLE));
  const { keep: qualityPool } = gateDailyTen(playable);

  const tryTake = (p: ScoredPick, caps: Record<MarketFamily, number>, leagueCap: number): boolean => {
    if (fold.length >= DAILY_FOLD_SIZE) return false;
    if (fixtures.has(p.fixtureId)) return false;
    if ((leagueCount.get(p.leagueId) ?? 0) >= leagueCap) return false;
    if (familyCount[p.family] >= (caps[p.family] ?? 0)) return false;
    fold.push(p);
    fixtures.add(p.fixtureId);
    leagueCount.set(p.leagueId, (leagueCount.get(p.leagueId) ?? 0) + 1);
    familyCount[p.family] += 1;
    return true;
  };

  const bands = [ODDS_PLAYABLE, ODDS_PLAYABLE, ODDS_PLAYABLE] as const;
  const byQualityThenComposite = (a: ScoredPick, b: ScoredPick) => {
    const qa = a.qualityGate?.combined ?? 0;
    const qb = b.qualityGate?.combined ?? 0;
    if (qa !== qb) return qb - qa;
    return b.composite - a.composite;
  };

  for (const pass of [1, 2, 3] as const) {
    const band = bands[pass - 1]!;
    const eligible = qualityPool
      .filter((c) => isEligible(c, band))
      .filter((c) => {
        if (pass !== 1) return true;
        if (isExtraFamily(c.family) || c.family === "cs") return false;
        if (c.family === "ou") return isHeadlineOu(c.kind);
        return true;
      })
      .sort(byQualityThenComposite);
    const allowCs = pass === 3 && fold.filter((p) => p.family !== "cs").length < 6;
    const caps = familyCap(pass, allowCs);
    const leagueCap = pass === 3 ? 3 : 2;

    if (pass === 1) {
      const byFamily = (fam: MarketFamily) =>
        eligible.filter((c) => c.family === fam && !fixtures.has(c.fixtureId));
      while (fold.length < DAILY_FOLD_SIZE) {
        const need: MarketFamily[] = [];
        if (familyCount.win < caps.win) need.push("win");
        if (familyCount.btts < caps.btts) need.push("btts");
        if (familyCount.ou < caps.ou) need.push("ou");
        if (!need.length) break;
        const options = need
          .map((fam) => ({ fam, pick: byFamily(fam)[0] }))
          .filter((x): x is { fam: MarketFamily; pick: ScoredPick } => Boolean(x.pick));
        if (!options.length) break;
        options.sort((a, b) => {
          const bias = a.fam === "win" ? 1 : a.fam === "btts" ? 0.97 : 0.96;
          const bb = b.fam === "win" ? 1 : b.fam === "btts" ? 0.97 : 0.96;
          const sa = (a.pick.qualityGate?.combined ?? a.pick.composite * 100) * bias;
          const sb = (b.pick.qualityGate?.combined ?? b.pick.composite * 100) * bb;
          return sb - sa;
        });
        let taken = false;
        for (const opt of options) {
          if (tryTake(opt.pick, caps, leagueCap)) {
            taken = true;
            break;
          }
        }
        if (!taken) break;
      }
    }

    const ordered =
      pass === 3
        ? [...eligible.filter((p) => p.family !== "cs"), ...eligible.filter((p) => p.family === "cs")]
        : eligible;
    for (const p of ordered) {
      if (fold.length >= DAILY_FOLD_SIZE) break;
      tryTake(p, caps, leagueCap);
    }
  }

  return fold.sort(byQualityThenComposite).map((p, i) => ({ ...p, rank: i + 1 }));
}

/** AAVS rank across data-backed markets only. FULL_DATA, last-five, agreement ≥ 0.55, EV > 0, then two-stage quality. No fallback to the ungated pool. */
export function rankBestBets(picks: ScoredPick[]): { best: ScoredPick | null; alternates: ScoredPick[] } {
  const gated = picks.filter((p) => {
    if (RESEARCH_FAMILIES.has(p.family)) return false;
    if (!isDataBacked(p, "best")) return false;
    const agreement = p.agreement ?? 0;
    const implied = p.implied || (p.odd > 1 ? 1 / p.odd : 0.5);
    const edge = p.edge ?? p.accuracy - implied;
    const ev = p.accuracy * p.odd - 1;
    if (agreement < 0.55) return false;
    if (!(edge > 0 || ev > 0)) return false;
    return true;
  });
  const qualityGated = gateBestBets(gated);
  qualityGated.sort((a, b) => {
    const aa = a.aavs ?? 0;
    const ba = b.aavs ?? 0;
    const rel = Math.abs(aa - ba) / Math.max(Math.abs(aa), Math.abs(ba), 1e-9);
    if (rel <= 0.05) return b.accuracy - a.accuracy;
    return ba - aa;
  });
  return { best: qualityGated[0] ?? null, alternates: qualityGated.slice(1, 3) };
}

/** Same-match accas that clear FULL_DATA + edge — never a substitute for Best. Over-focus blocks are parts, not tickets. */
export function selectDataBackedCombos(picks: ScoredPick[], max = 3): ScoredPick[] {
  return picks
    .filter((c) => c.kind === "combo")
    .filter((c) => !c.notes?.includes(OVER_BLOCK) && !c.notes?.includes(OVER_FOCUS))
    .filter((c) => isEligible(c, ODDS_PLAYABLE) && isDataBacked(c, "best") && (c.edge ?? 0) > 0)
    .sort((a, b) => (b.aavs ?? b.composite) - (a.aavs ?? a.composite))
    .slice(0, max);
}

function overPriceOk(kind: MarketKind, odd: number): boolean {
  if (kind === "over_15") return odd >= 1.15 && odd <= 1.8;
  if (kind === "over_25") return odd >= 1.25 && odd <= 3.5;
  return odd >= 1.12 && odd <= TEAM_ODDS_BAND.max;
}

/** Team over 0.5, match over 1.5, or match over 2.5 that already clears the Best-bet data gate. */
export function overLegEligible(p: ScoredPick): boolean {
  if (!OVER_KINDS.has(p.kind)) return false;
  if (!isDataBacked(p, "best")) return false;
  if ((p.agreement ?? 0) < 0.55) return false;
  if (p.accuracy < 0.7) return false;
  if (!overPriceOk(p.kind, p.odd)) return false;
  if (!(p.accuracy * p.odd > 1)) return false;
  if (p.accuracy * p.odd < MIN_EV) return false;
  return true;
}

function overLabel(p: ScoredPick): string {
  if (p.kind === "home_score") return `${p.home} over 0.5`;
  if (p.kind === "away_score") return `${p.away} over 0.5`;
  if (p.kind === "over_25") return `${p.home} v ${p.away} over 2.5`;
  return `${p.home} v ${p.away} over 1.5`;
}

type OverBlock = {
  fixtureId: number;
  jointP: number;
  odds: number;
  agreement: number;
  quality: number;
  legs: ComboLeg[];
  members: ScoredPick[];
};

function overBlocks(picks: ScoredPick[]): OverBlock[] {
  const singles = picks.filter(overLegEligible);
  const byKey = new Map<string, ScoredPick>();
  for (const p of singles) byKey.set(`${p.fixtureId}:${p.kind}:${p.selection}`, p);
  const blocks: OverBlock[] = singles.map((p) => ({
    fixtureId: p.fixtureId,
    jointP: p.accuracy,
    odds: p.odd,
    agreement: p.agreement ?? 0,
    quality: p.facts?.quality ?? 0,
    legs: [{ kind: p.kind, selection: overLabel(p), odd: p.odd, fixtureId: p.fixtureId }],
    members: [p],
  }));
  for (const block of picks) {
    if (!block.notes?.includes(OVER_BLOCK) || !block.comboLegs || block.comboLegs.length < 2) continue;
    const members = block.comboLegs.map((leg) => byKey.get(`${block.fixtureId}:${leg.kind}:${leg.selection}`));
    if (members.some((m) => !m)) continue;
    const found = members.filter((m): m is ScoredPick => Boolean(m));
    blocks.push({
      fixtureId: block.fixtureId,
      jointP: block.accuracy,
      odds: block.odd,
      agreement: Math.min(...found.map((m) => m.agreement ?? 0)),
      quality: Math.min(...found.map((m) => m.facts?.quality ?? 0)),
      legs: found.map((m) => ({
        kind: m.kind,
        selection: overLabel(m),
        odd: m.odd,
        fixtureId: m.fixtureId,
      })),
      members: found,
    });
  }
  return blocks.filter((b) => b.jointP * b.odds > 1 && b.agreement >= 0.55 && b.quality >= MIN_BEST_QUALITY);
}

/**
 * One over-only ticket: 2–5 legs, decimal product at least 2.00 and at most 5.00.
 * Team over 0.5, match over 1.5 and match over 2.5 are the only legs.
 * Same-match pairs use the stored score-matrix joint. Different matches multiply.
 * Over 2.5 is not stacked on over 1.5. Both teams over 0.5 is not stacked with over 1.5.
 */
export function selectOverFocusCombo(picks: ScoredPick[]): ScoredPick | null {
  const pool = overBlocks(picks).sort((a, b) => b.jointP * b.odds - a.jointP * a.odds);
  const singles = pool.filter((b) => b.legs.length === 1).slice(0, 12);
  const pairs = pool.filter((b) => b.legs.length > 1).slice(0, 8);
  const rankedBlocks = [...pairs, ...singles];
  if (rankedBlocks.length < 1) return null;
  const chosen: { ticket: { ev: number; legs: number; joint: number; blocks: OverBlock[] } | null } = {
    ticket: null,
  };
  const walk = (start: number, acc: OverBlock[]) => {
    if (acc.length > 0) {
      const fixtures = new Set(acc.map((b) => b.fixtureId));
      const nLegs = acc.reduce((n, b) => n + b.legs.length, 0);
      if (fixtures.size === acc.length && nLegs >= 2 && nLegs <= 5) {
        let odds = 1;
        let joint = 1;
        for (const b of acc) {
          odds *= b.odds;
          joint *= b.jointP;
        }
        const ev = joint * odds - 1;
        if (
          odds >= OVER_COMBO_MIN_ODDS - 1e-9 &&
          odds <= OVER_COMBO_MAX_ODDS + 1e-9 &&
          joint >= MIN_COMBO &&
          ev > 0
        ) {
          const better =
            !chosen.ticket ||
            ev > chosen.ticket.ev + 1e-12 ||
            (Math.abs(ev - chosen.ticket.ev) <= 1e-12 && nLegs < chosen.ticket.legs) ||
            (Math.abs(ev - chosen.ticket.ev) <= 1e-12 && nLegs === chosen.ticket.legs && joint > chosen.ticket.joint);
          if (better) chosen.ticket = { ev, legs: nLegs, joint, blocks: acc.slice() };
        }
      }
    }
    if (acc.length === 4) return;
    for (let i = start; i < rankedBlocks.length; i++) {
      acc.push(rankedBlocks[i]!);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  const best = chosen.ticket;
  if (!best) return null;
  const members = best.blocks.flatMap((b) => b.members);
  const legs = best.blocks.flatMap((b) => b.legs);
  const anchor = members.slice().sort((a, b) => (a.facts?.quality ?? 0) - (b.facts?.quality ?? 0))[0] ?? members[0]!;
  const agreement = Math.min(...members.map((m) => m.agreement ?? 0));
  const quality = Math.min(...members.map((m) => m.facts?.quality ?? 0));
  const odds = legs.reduce((p, l) => p * l.odd, 1);
  const joint = best.joint;
  const ev = joint * odds - 1;
  const sameMatch = best.blocks.some((b) => b.legs.length > 1);
  return {
    ...anchor,
    id: `over-focus:${legs.map((l) => `${l.fixtureId}:${l.kind}`).join("|")}`,
    kind: "combo",
    family: "combo",
    home: "Over combo",
    away: `${legs.length} legs`,
    homeLogo: null,
    awayLogo: null,
    league: "Best bet",
    selection: legs.map((l) => l.selection).join(" + "),
    odd: odds,
    bookmaker: "Combined",
    implied: 1 / odds,
    accuracy: joint,
    value: joint,
    edge: ev,
    agreement,
    leagueWeight: Math.min(...members.map((m) => m.leagueWeight ?? 1)),
    composite: compositeScore({
      accuracy: joint,
      agreement,
      leagueWeight: Math.min(...members.map((m) => m.leagueWeight ?? 1)),
      value: joint,
      implied: 1 / odds,
      odd: odds,
      bandMid: 3.25,
      kind: "combo",
      dataQuality: quality,
      lambdaSe: 0.12,
    }),
    kellyQuarter: quarterKelly(odds, joint),
    notes: [
      OVER_FOCUS,
      sameMatch
        ? "Same-match legs are the score-matrix joint, not the product of the prices."
        : "Different matches multiply. Each leg is already +EV.",
      "Over 2.5 is not stacked on over 1.5. Both teams over 0.5 already covers over 1.5.",
      `${legs.length} legs · ${odds.toFixed(2)}`,
    ],
    comboLegs: legs,
    aavs: aavs({
      accuracy: joint,
      edge: ev,
      agreement,
      dataQuality: quality,
      robustness: Math.min(...members.map((m) => m.robustness ?? 1)),
    }),
    facts: anchor.facts,
    rank: 1,
  };
}

/** Over combo takes Best when one clears. Otherwise the ranked single. The ten is unchanged. */
export function focusBestBet(picks: ScoredPick[]): { best: ScoredPick | null; alternates: ScoredPick[] } {
  const ranked = rankBestBets(picks);
  const over = selectOverFocusCombo(picks);
  if (!over) return ranked;
  const alternates: ScoredPick[] = [];
  for (const p of [ranked.best, ...ranked.alternates]) {
    if (!p || p.id === over.id) continue;
    alternates.push(p);
    if (alternates.length === 2) break;
  }
  return { best: over, alternates };
}

export function leaderboard(picks: ScoredPick[]): {
  model: ScoredPick["bestModel"];
  label: string;
  meanP: number;
  calib: number;
  wins: number;
}[] {
  const labels: Record<ScoredPick["bestModel"], string> = {
    dixonColes: "Dixon–Coles",
    shin: "Shin market",
    apiFootball: "API-Football",
    hvattumElo: "Hvattum Elo",
    baioH2h: "Baio H2H",
    maher: "Maher Poisson",
    karlisNtzoufras: "Karlis–Ntzoufras",
    negBin: "NegBin totals",
  };
  const keys = Object.keys(labels) as ScoredPick["bestModel"][];
  const graded = picks.filter((p) => p.settled && p.settled.hit != null);
  const useBrier = graded.length >= 6;
  const top = useBrier ? graded : picks.slice(0, 24);
  const rows = keys.map((model) => {
    const vals: number[] = [];
    let wins = 0;
    let calibAcc = 0;
    let brierAcc = 0;
    let logAcc = 0;
    let n = 0;
    for (const p of top) {
      const mp =
        model === "dixonColes"
          ? p.models.dixonColes
          : model === "shin"
            ? p.models.shin
            : model === "apiFootball"
              ? p.models.apiFootball
              : model === "hvattumElo"
                ? p.models.hvattumElo
                : model === "baioH2h"
                  ? p.models.baioH2h
                  : model === "maher"
                    ? p.models.maher
                    : model === "karlisNtzoufras"
                      ? p.models.karlisNtzoufras
                      : p.models.negBin;
      if (mp == null) continue;
      vals.push(mp);
      if (useBrier && p.settled && p.settled.hit != null) {
        const y = p.settled.hit ? 1 : 0;
        const q = Math.min(0.999, Math.max(1e-4, mp));
        brierAcc += (q - y) * (q - y);
        logAcc += -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
        n += 1;
      } else {
        const ref = p.implied || p.accuracy;
        calibAcc += Math.abs(mp - ref);
      }
      if (p.bestModel === model) wins += 1;
    }
    const meanP = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const brier = n ? brierAcc / n : undefined;
    const calib = useBrier ? (brier ?? 1) : vals.length ? calibAcc / vals.length : 1;
    return {
      model,
      label: labels[model],
      meanP,
      calib,
      wins,
      brier,
      logLoss: n ? logAcc / n : undefined,
      n: n || undefined,
    };
  });
  return rows.filter((r) => r.meanP > 0 || r.wins > 0).sort((a, b) => a.calib - b.calib || b.wins - a.wins);
}
