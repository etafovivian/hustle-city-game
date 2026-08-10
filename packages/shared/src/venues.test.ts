import { describe, expect, it } from "vitest";
import { VENUES, VENUES_BY_KEY, hoursLabel, isOpenAt, lagosHourOf, venueActions } from "./venues.js";

describe("venue life", () => {
  it("gives every place a free action first and keeps paid keys unique", () => {
    for (const v of VENUES) {
      const acts = venueActions(v);
      expect(acts[0]?.kind).toBe("free");
      expect(acts[0]?.cost).toBe(0);
      expect(new Set(acts.map((a) => a.key)).size).toBe(acts.length);
      for (const a of acts) expect(a.seconds).toBeGreaterThanOrEqual(6);
    }
  });
  it("keeps Lagos hours, including past midnight", () => {
    const lounge = VENUES_BY_KEY.get("skyline_lounge")!;
    expect(isOpenAt(lounge, 23)).toBe(true);
    expect(isOpenAt(lounge, 2)).toBe(true);
    expect(isOpenAt(lounge, 12)).toBe(false);
    expect(hoursLabel(lounge, 12)).toBe("Closed · opens 10 pm");
    const bank = VENUES_BY_KEY.get("lagoon_capital_bank")!;
    expect(hoursLabel(bank, 9)).toBe("Open now · until 5 pm");
    expect(hoursLabel(VENUES_BY_KEY.get("general_hospital")!, 3)).toBe("Open all day");
  });
  it("reads the Lagos hour as UTC+1", () => {
    expect(lagosHourOf(new Date("2026-10-12T21:30:00Z"))).toBe(22.5);
    expect(lagosHourOf(new Date("2026-10-12T23:00:00Z"))).toBe(0);
  });
});
