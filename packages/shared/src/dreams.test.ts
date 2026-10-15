import { describe, expect, it } from "vitest";
import { claimableStep, dreamRewardRef, dreamView, legendScore, type DreamMetrics } from "./dreams.js";

const base: DreamMetrics = { customersServed: 0, salesEarned: 0, bestWeekRank: null, rankThisWeek: null, friends: 0 };

describe("dreams", () => {
  it("tracks customers served for Market Royalty", () => {
    const v = dreamView("market_royalty", { ...base, customersServed: 27 }, new Set());
    expect(v.value).toBe(27);
    expect(v.target).toBe(100);
    expect(v.steps.map((s) => s.reached)).toEqual([true, true, false, false]);
    expect(v.achieved).toBe(false);
  });

  it("marks claimed steps from ledger references", () => {
    const v = dreamView("showroom", { ...base, salesEarned: 12_000 }, new Set([dreamRewardRef("showroom", 2_500)]));
    expect(v.steps[0]).toMatchObject({ reached: true, claimed: true });
    expect(v.steps[1]).toMatchObject({ reached: true, claimed: false });
    expect(claimableStep(v, 10_000)?.reward).toBe(200);
    expect(claimableStep(v, 25_000)).toBeUndefined();
  });

  it("scores Junction Legend by best finished week", () => {
    expect([null, 11, 10, 3, 1].map(legendScore)).toEqual([0, 0, 1, 2, 3]);
    const v = dreamView("junction_legend", { ...base, bestWeekRank: 2, rankThisWeek: 4 }, new Set());
    expect(v.steps.map((s) => s.reached)).toEqual([true, true, false]);
    expect(v.note).toContain("number 4");
  });

  it("keeps Padi locked until friends open", () => {
    const v = dreamView("padi", { ...base, friends: 9 }, new Set());
    expect(v.locked).toBeTruthy();
    expect(v.value).toBe(0);
    expect(v.steps.some((s) => s.reached)).toBe(false);
  });

  it("falls back to Market Royalty for an unknown dream", () => {
    expect(dreamView("nope", base, new Set()).key).toBe("market_royalty");
  });
});
