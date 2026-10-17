import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  kellyFull,
  kellyTier,
  planKellyCard,
  quarterKelly,
  SAME_FIXTURE_HAIRCUT,
} from "./kelly.ts";

describe("kellyFull", () => {
  it("is zero on a fair coin and on negative EV", () => {
    assert.equal(kellyFull(2, 0.5), 0);
    assert.equal(kellyFull(1.9, 0.5), 0);
    assert.equal(kellyFull(1.5, 0), 0);
  });

  it("matches (bp − q) / b on a 2.00 overlay", () => {
    // p=0.6 at 2.00 → f* = 0.20
    assert.ok(Math.abs(kellyFull(2, 0.6) - 0.2) < 1e-9);
  });

  it("caps full Kelly at 25%", () => {
    assert.equal(kellyFull(5, 0.9), 0.25);
  });
});

describe("quarterKelly", () => {
  it("is a quarter of full, capped at 8%", () => {
    const q = quarterKelly(2, 0.6);
    assert.ok(Math.abs(q - 0.05) < 1e-9);
    assert.ok(quarterKelly(5, 0.9) <= 0.08);
  });
});

describe("kellyTier", () => {
  it("passes thin edges and marks a 12% overlay strong", () => {
    assert.equal(kellyTier(0.01), "pass");
    assert.equal(kellyTier(0.03), "lean");
    assert.equal(kellyTier(0.07), "solid");
    assert.equal(kellyTier(0.12), "strong");
  });
});

describe("planKellyCard", () => {
  it("stakes quarter-Kelly in units of the bankroll", () => {
    const plan = planKellyCard([{ id: "a", fixtureId: 1, odd: 2, p: 0.6 }], { bankroll: 200, fraction: 0.25 });
    assert.equal(plan.nStaked, 1);
    assert.ok(Math.abs(plan.rows[0]!.allocated - 0.05) < 1e-9);
    assert.ok(Math.abs(plan.rows[0]!.units - 10) < 1e-9);
    assert.equal(plan.rows[0]!.tier, "strong");
    assert.ok(plan.growth > 0);
  });

  it("haircuts a second market on the same fixture", () => {
    const plan = planKellyCard(
      [
        { id: "home", fixtureId: 9, odd: 2, p: 0.6 },
        { id: "btts", fixtureId: 9, odd: 1.9, p: 0.58 },
      ],
      { bankroll: 100, fraction: 0.25 },
    );
    const home = plan.rows.find((r) => r.id === "home")!;
    const btts = plan.rows.find((r) => r.id === "btts")!;
    assert.equal(home.haircut, 1);
    assert.equal(btts.haircut, SAME_FIXTURE_HAIRCUT);
    assert.ok(btts.allocated < home.allocated);
  });

  it("scales the card when the book would exceed the cap", () => {
    const picks = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      fixtureId: i + 1,
      odd: 2,
      p: 0.62,
    }));
    const plan = planKellyCard(picks, { bankroll: 100, fraction: 0.25, cardCap: 0.2 });
    assert.equal(plan.scaled, true);
    assert.ok(plan.cardAllocated <= 0.2 + 1e-9);
    assert.ok(plan.scale < 1);
  });

  it("passes a pick below the 2% full-Kelly floor", () => {
    const plan = planKellyCard([{ id: "thin", fixtureId: 1, odd: 1.91, p: 0.525 }], { bankroll: 100 });
    assert.equal(plan.rows[0]!.tier, "pass");
    assert.equal(plan.rows[0]!.allocated, 0);
    assert.equal(plan.nStaked, 0);
  });
});
