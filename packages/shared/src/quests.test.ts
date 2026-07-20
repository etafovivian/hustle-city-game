import { describe, expect, it } from "vitest";
import { DAILY_QUESTS_PER_DAY, dailyQuestsFor } from "./quests.js";
import { dayKey } from "./time.js";

describe("dailyQuestsFor", () => {
  it("returns a stable set of distinct quests per day", () => {
    const a = dailyQuestsFor("2026-10-11");
    expect(a).toHaveLength(DAILY_QUESTS_PER_DAY);
    expect(new Set(a.map((q) => q.key)).size).toBe(DAILY_QUESTS_PER_DAY);
    expect(dailyQuestsFor("2026-10-11")).toEqual(a);
  });
});

describe("dayKey", () => {
  it("uses the Lagos day boundary (UTC+1)", () => {
    // 23:30 UTC on 10 Oct is 00:30 on 11 Oct in Lagos.
    expect(dayKey(new Date("2026-10-10T23:30:00Z"))).toBe("2026-10-11");
    expect(dayKey(new Date("2026-10-10T22:30:00Z"))).toBe("2026-10-10");
  });
});
