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

describe("pool physics", () => {
  it("never lets a hard shot pass through a ball", () => {
    // A ball straight ahead, cue at full power: it must be hit.
    const s = poolStart();
    s.balls = [
      { id: 0, kind: "cue", x: 100, y: 250, vx: 0, vy: 0, in: false },
      { id: 1, kind: "red", x: 160, y: 250, vx: 0, vy: 0, in: false },
    ];
    const after = poolShoot(s, 0, 1);
    expect(after.note).not.toMatch(/missed everything/);
  });
  it("draw brings the cue ball back, follow carries it on", () => {
    const base = () => {
      const s = poolStart();
      s.balls = [
        { id: 0, kind: "cue", x: 300, y: 250, vx: 0, vy: 0, in: false },
        { id: 1, kind: "red", x: 500, y: 250, vx: 0, vy: 0, in: false },
      ];
      return s;
    };
    const cueX = (spin: number) => poolShoot(base(), 0, 0.4, spin).balls[0]!.x;
    expect(cueX(-1)).toBeLessThan(470);
    expect(cueX(1)).toBeGreaterThan(cueX(0) + 30);
  });
});
describe("ayo trace", () => {
  it("drops one seed per pit in order and matches the move", async () => {
    const { ayoStart, ayoTrace, ayoPlay, ayoFindMove } = await import("./ayo.js");
    const s = ayoStart();
    const t = ayoTrace(s, 2);
    expect(t.drops).toEqual([3, 4, 5, 6]);
    expect(ayoFindMove(s, ayoPlay(s, 2))).toBe(2);
  });
});
describe("ayo trace over random games", () => {
  it("captures what the rules capture, seed for seed", async () => {
    const { ayoStart, ayoTrace, ayoPlay, ayoMoves } = await import("./ayo.js");
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed / 2 ** 31);
    for (let g = 0; g < 200; g++) {
      let s = ayoStart();
      for (let turn = 0; turn < 300 && !s.over; turn++) {
        const moves = ayoMoves(s);
        const m = moves[Math.floor(rnd() * moves.length)]!;
        const t = ayoTrace(s, m);
        const next = ayoPlay(s, m);
        const got = t.captured.reduce((n, c) => n + c.seeds, 0);
        if (!next.over) expect(next.stores[s.turn] - s.stores[s.turn]).toBe(got);
        expect(t.drops.length).toBe(s.pits[m]);
        s = next;
      }
    }
  });
});
