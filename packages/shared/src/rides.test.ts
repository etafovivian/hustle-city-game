import { describe, expect, it } from "vitest";
import { RIDE_MODES, isRushHour, rideFare, rideSeconds } from "./rides.js";

describe("rides", () => {
  it("walking is free and the cab costs most", () => {
    expect(rideFare("walk", 5000, 12)).toBe(0);
    const fares = RIDE_MODES.map((m) => rideFare(m.mode, 5000, 12));
    expect(Math.max(...fares)).toBe(rideFare("cab", 5000, 12));
    expect(rideFare("danfo", 5000, 12)).toBeLessThan(rideFare("keke", 5000, 12));
  });
  it("charges cabs more in rush hour, not danfos", () => {
    expect(isRushHour(8)).toBe(true);
    expect(isRushHour(13)).toBe(false);
    expect(rideFare("cab", 5000, 8)).toBeGreaterThan(rideFare("cab", 5000, 13));
    expect(rideFare("danfo", 5000, 8)).toBe(rideFare("danfo", 5000, 13));
  });
  it("okada beats go-slow", () => {
    expect(rideSeconds("okada", 6000, 8)).toBeLessThan(rideSeconds("cab", 6000, 8));
  });
});

describe("fuel price", () => {
  it("is the same all Lagos day, mostly normal, sometimes a scarcity day", async () => {
    const { fuelPriceOn } = await import("./vehicles.js");
    const a = fuelPriceOn(new Date("2026-10-13T08:00:00Z"));
    expect(fuelPriceOn(new Date("2026-10-13T20:00:00Z"))).toEqual(a);
    const days = Array.from({ length: 120 }, (_, i) => fuelPriceOn(new Date(Date.UTC(2026, 0, 1 + i, 12))));
    const scarce = days.filter((d) => d.scarcity).length;
    expect(scarce).toBeGreaterThan(5);
    expect(scarce).toBeLessThan(40);
    expect(days.every((d) => d.factor >= 0.95 && d.factor <= 1.5)).toBe(true);
  });
});
