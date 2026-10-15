import { describe, expect, it } from "vitest";
import { ayoBest, ayoMoves, ayoPlay, ayoReplayVsComputer, ayoStart } from "./ayo.js";

describe("ayo", () => {
  it("sows anticlockwise and keeps 48 seeds", () => {
    const s = ayoPlay(ayoStart(), 2);
    expect(s.pits.slice(0, 7)).toEqual([4, 4, 0, 5, 5, 5, 5]);
    expect(s.turn).toBe(1);
    const total = (x: typeof s) => x.pits.reduce((a, b) => a + b, 0) + x.stores[0] + x.stores[1];
    let g = ayoStart();
    for (let i = 0; i < 200 && !g.over; i++) g = ayoPlay(g, ayoBest(g, 2));
    expect(g.over).toBe(true);
    expect(total(g)).toBe(48);
  });
  it("captures 2s and 3s backwards", () => {
    const s = { ...ayoStart(), pits: [0, 0, 0, 0, 0, 2, 1, 2, 4, 4, 4, 4], turn: 0 as const };
    const after = ayoPlay(s, 5); // seeds land in 6 and 7: 2 and 3
    expect(after.stores[0]).toBe(5);
  });
  it("replays games against the computer and rejects illegal moves", () => {
    expect(ayoReplayVsComputer([0, 99])).toBeNull();
    const s = ayoReplayVsComputer([ayoMoves(ayoStart())[0]!]);
    expect(s?.turn).toBe(0);
  });
});
