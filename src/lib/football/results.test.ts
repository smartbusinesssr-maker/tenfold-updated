import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyScoreUpdates } from "./results.ts";
import type { ScoredPick } from "./types.ts";

function pick(partial: Partial<ScoredPick> & Pick<ScoredPick, "id" | "fixtureId" | "kind" | "selection">): ScoredPick {
  return partial as ScoredPick;
}

describe("applyScoreUpdates", () => {
  it("grades finals and leaves in-play lines ungraded", () => {
    const rows = [
      pick({ id: "a", fixtureId: 1, kind: "home", selection: "Home" }),
      pick({ id: "b", fixtureId: 2, kind: "btts_yes", selection: "BTTS Yes" }),
      pick({ id: "c", fixtureId: 3, kind: "over_25", selection: "Over 2.5" }),
    ];
    const scores = new Map([
      [1, { home: 2, away: 1, live: false }],
      [2, { home: 1, away: 0, live: true }],
      [3, { home: 0, away: 0, live: false }],
    ]);
    const tally = applyScoreUpdates(rows, scores);
    assert.equal(tally.hits, 1);
    assert.equal(tally.n, 2);
    assert.equal(tally.live, 1);
    assert.equal(rows[0]!.settled?.hit, true);
    assert.equal(rows[1]!.settled?.live, true);
    assert.equal(rows[1]!.settled?.hit, null);
    assert.equal(rows[2]!.settled?.hit, false);
  });
});
