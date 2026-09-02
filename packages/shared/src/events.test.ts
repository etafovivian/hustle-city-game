import { describe, expect, it } from "vitest";
import { EVENT_BY_KEY, eventAt, hasLight, isEventOn, upcoming } from "./index.js";

describe("events", () => {
  it("knows the Lagos week", () => {
    const owambe = EVENT_BY_KEY.get("owambe_saturday")!;
    expect(isEventOn(owambe, new Date("2026-10-17T14:00:00Z"))).toBe(true); // Saturday 3pm Lagos
    expect(isEventOn(owambe, new Date("2026-10-18T14:00:00Z"))).toBe(false); // Sunday
    const groove = EVENT_BY_KEY.get("friday_groove")!;
    expect(isEventOn(groove, new Date("2026-10-17T01:00:00Z"))).toBe(true); // Saturday 2am, Friday night
    expect(eventAt("grace_chapel", new Date("2026-10-18T09:00:00Z"))?.key).toBe("sunday_service");
    const next = upcoming(new Date("2026-10-13T12:00:00Z"));
    expect(next[0]!.start.getTime()).toBeGreaterThanOrEqual(new Date("2026-10-13T12:00:00Z").getTime());
  });
  it("cuts light more in Danfo than on the Island", () => {
    let danfo = 0;
    let island = 0;
    for (let h = 0; h < 2000; h += 2) {
      const t = new Date(Date.UTC(2026, 0, 1) + h * 3_600_000);
      if (!hasLight("Danfo Terminal", t)) danfo++;
      if (!hasLight("Island Heights", t)) island++;
    }
    expect(danfo).toBeGreaterThan(island * 2);
  });
});

describe("seasons", () => {
  it("Detty December runs only from mid-December into the new year, at night", async () => {
    const { EVENT_BY_KEY, isEventOn, upcoming } = await import("./events.js");
    const dd = EVENT_BY_KEY.get("detty_december")!;
    expect(isEventOn(dd, new Date("2026-12-20T20:00:00Z"))).toBe(true); // 9pm Lagos
    expect(isEventOn(dd, new Date("2027-01-01T22:00:00Z"))).toBe(true);
    expect(isEventOn(dd, new Date("2026-12-20T12:00:00Z"))).toBe(false); // daytime
    expect(isEventOn(dd, new Date("2026-10-13T20:00:00Z"))).toBe(false); // October
    expect(upcoming(new Date("2026-10-13T12:00:00Z")).some((u) => u.event.key === "detty_december")).toBe(false);
    expect(upcoming(new Date("2026-12-10T12:00:00Z")).some((u) => u.event.key === "detty_december")).toBe(true);
  });
});

describe("floods and rain surge", () => {
  it("storms flood every prone area, two rainy spells the lowest ones, and dry weather none", async () => {
    const { floodedAreas, rainSurge, weatherAt, FLOOD_PRONE } = await import("./weather.js");
    const hours = Array.from({ length: 24 * 200 }, (_, i) => new Date(Date.UTC(2026, 3, 1) + i * 3_600_000));
    const storm = hours.find((h) => weatherAt(h) === "storm")!;
    expect(floodedAreas(storm)).toEqual(FLOOD_PRONE.map((f) => f.area));
    expect(rainSurge(storm)).toEqual({ fare: 1.5, slow: 1.4 });
    const dry = hours.find((h) => [0, 1, 2].every((k) => weatherAt(new Date(h.getTime() - k * 7_200_000)) === "sunny"))!;
    expect(floodedAreas(dry)).toEqual([]);
    expect(rainSurge(dry).fare).toBe(1);
    // Harmattan never floods.
    expect(floodedAreas(new Date(Date.UTC(2027, 0, 10, 12)))).toEqual([]);
  });
});
