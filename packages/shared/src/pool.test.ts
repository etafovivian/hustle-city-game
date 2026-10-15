import { describe, expect, it } from "vitest";
import { poolLeft, poolShoot, poolStart } from "./pool.js";

describe("pool", () => {
  it("breaks, stops, and is deterministic", () => {
    const a = poolShoot(poolStart(), 0, 1);
    const b = poolShoot(poolStart(), 0, 1);
    expect(a.balls.every((x) => x.vx === 0 && x.vy === 0)).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.shots).toBe(1);
  });
  it("calls a miss a foul and passes the turn", () => {
    const s = poolShoot(poolStart(), Math.PI, 0.05); // tap away from the rack
    expect(s.turn).toBe(1);
    expect(s.note).toMatch(/Foul/);
    expect(poolLeft(s, 0)).toBe(7);
  });
});
