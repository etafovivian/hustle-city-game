import { describe, expect, it } from "vitest";
import { NEED_START, fillNeeds, lowestNeed, moodOf, needsAt } from "./needs.js";

describe("needs", () => {
  it("run down over time and never below zero", () => {
    const t0 = new Date("2026-10-12T08:00:00Z");
    const later = needsAt(NEED_START, t0, new Date("2026-10-12T12:00:00Z"));
    expect(later.food).toBe(NEED_START.food - 28);
    expect(needsAt(NEED_START, t0, new Date("2026-10-20T00:00:00Z")).food).toBe(0);
  });
  it("activities fill the needs their tags name", () => {
    const n = fillNeeds({ ...NEED_START, food: 10 }, ["food", "social", "rep"], 25);
    expect(n.food).toBe(35);
    expect(n.social).toBe(NEED_START.social + 25);
  });
  it("moods follow the needs, with Naija moodlets", () => {
    const hungry = moodOf({ ...NEED_START, food: 5, energy: 10 });
    expect(hungry.moodlets.map((m) => m.label)).toContain("Belle dey cry");
    expect(["Miserable", "Low"]).toContain(hungry.label);
    expect(moodOf({ food: 95, energy: 95, fun: 95, social: 95, health: 95, style: 95 }).label).toBe("Great");
    expect(lowestNeed({ ...NEED_START, fun: 3 })).toBe("fun");
  });
});
