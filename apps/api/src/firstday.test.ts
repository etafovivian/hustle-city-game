// "First day in Lagos": steps recorded as the player eats, rides and works; the gift only once, only when done.
import { FIRST_DAY } from "@hc/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareDatabase, registerPlayer, resetDatabase, testServer } from "./test/harness.js";

let app: Awaited<ReturnType<typeof testServer>>;
beforeAll(async () => {
  await prepareDatabase();
  app = await testServer();
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  await resetDatabase();
});

describe("first day in Lagos", () => {
  it("records eat, ride and shift as they happen, and gives the gift once when they're done", async () => {
    const p = await registerPlayer(app);
    expect((await p.call("GET", "/api/game/first-day")).json()).toEqual({ done: [], claimed: false });
    expect((await p.call("POST", "/api/game/first-day/claim")).statusCode).toBe(422);
    expect((await p.call("POST", "/api/game/venues/mama_nkechi_buka/amala")).statusCode).toBe(200);
    expect((await p.call("POST", "/api/game/rides", { mode: "danfo", units: 1500 })).statusCode).toBe(200);
    expect((await p.call("POST", "/api/game/jobs/mama_nkechi_buka/shift")).statusCode).toBe(200);
    expect((await p.call("GET", "/api/game/first-day")).json()).toEqual({ done: ["eat", "ride", "shift"], claimed: false });
    const before = (await p.call("GET", "/api/me")).json().coins;
    expect((await p.call("POST", "/api/game/first-day/claim")).json()).toMatchObject({ coins: FIRST_DAY.rewardCoins });
    expect((await p.call("GET", "/api/me")).json().coins).toBe(before + FIRST_DAY.rewardCoins);
    expect((await p.call("POST", "/api/game/first-day/claim")).statusCode).toBe(409);
    expect((await p.call("GET", "/api/game/first-day")).json().claimed).toBe(true);
  });
});
