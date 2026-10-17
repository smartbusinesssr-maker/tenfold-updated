import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyShrink, autoresearchShrink } from "./autoresearch.ts";

function book(p: number, hits: number, misses: number, dates: string[]) {
  const rows = [];
  for (const date of dates) {
    for (let i = 0; i < hits; i++) rows.push({ date, p, y: 1 as const });
    for (let i = 0; i < misses; i++) rows.push({ date, p, y: 0 as const });
  }
  return rows;
}

describe("autoresearch shrink", () => {
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];

  it("keeps the 15% shrink when every date is overconfident, and leaves a fair book alone", () => {
    const hot = autoresearchShrink(book(0.8, 11, 9, dates));
    assert.equal(hot.keep, 0.85);
    assert.ok(hot.trials.some((t) => t.id === "shrink85" && t.status === "keep"));
    assert.ok(hot.trials.some((t) => t.id === "shrink92" && t.status === "discard"));
    assert.equal(hot.trials[0]!.status, "discard");
    const fair = autoresearchShrink(book(0.55, 11, 9, dates));
    assert.equal(fair.keep, 1);
    assert.ok(fair.trials.filter((t) => t.id !== "identity").every((t) => t.status === "discard"));
  });

  it("a one-day book cannot keep a shrink, and keep=1 does not move p", () => {
    const thin = autoresearchShrink(book(0.8, 11, 9, ["2026-09-01"]));
    assert.equal(thin.keep, 1);
    assert.equal(applyShrink(0.8, 1), 0.8);
    assert.ok(Math.abs(applyShrink(0.8, 0.85) - 0.755) < 1e-12);
  });

  it("the holdout can veto a shrink that only looked good earlier", () => {
    const early = book(0.8, 11, 9, dates.slice(0, 5));
    const last = book(0.55, 11, 9, [dates[5]!]);
    const veto = autoresearchShrink([...early, ...last]);
    assert.equal(veto.keep, 1);
    assert.ok(veto.trials.find((t) => t.id === "shrink85")!.status === "discard");
  });
});
