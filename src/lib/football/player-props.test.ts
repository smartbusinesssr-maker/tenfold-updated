import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  expectedMinutes,
  formatPlayerGa,
  matchPlayer,
  namesMatch,
  parsePlayerGa,
  playerAttackLambdas,
  playerRoleLambda,
} from "./player-props.ts";
import { playerGoalOrAssist } from "./markets-engine.ts";
import type { PlayerSeasonStats } from "./types.ts";

const stats = (over: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats => ({
  id: 1,
  name: "Erling Haaland",
  teamId: 50,
  minutes: 900,
  appearances: 10,
  starts: 10,
  goals: 12,
  assists: 3,
  shots: 40,
  sot: 22,
  keyPasses: 8,
  position: "F",
  ...over,
});

describe("player minutes", () => {
  it("confirmed starter keeps minutes; bench without evidence is null", () => {
    assert.ok((expectedMinutes({
      confirmedStarter: true,
      confirmedBench: false,
      minutes: 850,
      appearances: 10,
      starts: 10,
    }) ?? 0) >= 55);
    assert.equal(
      expectedMinutes({
        confirmedStarter: false,
        confirmedBench: true,
        minutes: null,
        appearances: null,
        starts: null,
      }),
      null,
    );
    assert.equal(
      expectedMinutes({
        confirmedStarter: false,
        confirmedBench: false,
        minutes: 120,
        appearances: 8,
        starts: 1,
      }),
      null,
    );
  });
});

describe("player λ and G∪A", () => {
  it("GK role is unavailable", () => {
    assert.equal(playerRoleLambda("G"), null);
    assert.equal(
      playerAttackLambdas({
        stats: stats({ position: "Goalkeeper", goals: 0, assists: 0 }),
        expectedMinutes: 90,
        teamLambda: 1.8,
        teamGfPer90: 1.9,
        pos: "G",
      }),
      null,
    );
  });

  it("scales with minutes and does not sum P(G)+P(A)", () => {
    const atk = playerAttackLambdas({
      stats: stats(),
      expectedMinutes: 85,
      teamLambda: 2.1,
      teamGfPer90: 1.9,
      pos: "F",
    });
    assert.ok(atk);
    const joint = playerGoalOrAssist({
      lambdaG: atk!.lambdaG,
      lambdaA: atk!.lambdaA,
      expectedMinutes: 85,
    });
    assert.ok(joint);
    assert.ok(Math.abs(joint!.pOr - (joint!.pG + joint!.pA - joint!.pBoth)) < 1e-9);
    assert.ok(joint!.pOr < joint!.pG + joint!.pA);
    const short = playerAttackLambdas({
      stats: stats(),
      expectedMinutes: 45,
      teamLambda: 2.1,
      teamGfPer90: 1.9,
      pos: "F",
    });
    assert.ok(short && short.lambdaG < atk!.lambdaG);
  });

  it("minutes below 180 season sample → null", () => {
    assert.equal(
      playerAttackLambdas({
        stats: stats({ minutes: 90, appearances: 2, starts: 1, goals: 1, assists: 0 }),
        expectedMinutes: 80,
        teamLambda: 1.5,
        teamGfPer90: 1.4,
        pos: "F",
      }),
      null,
    );
  });
});

describe("player name parse / match", () => {
  it("parses G∪A vs anytime scorer", () => {
    assert.equal(parsePlayerGa("Erling Haaland G∪A")?.mode, "or");
    assert.equal(parsePlayerGa("E. Haaland to score")?.mode, "score");
    assert.equal(formatPlayerGa("Haaland", "or"), "Haaland G∪A");
    assert.ok(namesMatch("E. Haaland", "Erling Haaland"));
    const hit = matchPlayer(
      "E. Haaland",
      [{ id: 1, name: "Erling Haaland", pos: "F", number: 9 }],
      [stats()],
    );
    assert.equal(hit.stats?.id, 1);
    assert.equal(hit.player?.id, 1);
  });
});
