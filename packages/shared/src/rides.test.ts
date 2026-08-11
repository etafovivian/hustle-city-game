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
