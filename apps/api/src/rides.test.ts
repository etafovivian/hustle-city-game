// Rides: fares charged at the start, area-boys stops decided by the server and settled once.
import { transitFare } from "@hc/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dice } from "./modules/game/rides.js";
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

describe("rides", () => {
  it("charges the fare, and a stop is settled once by the server", async () => {
    const p = await registerPlayer(app);
    const before = (await p.call("GET", "/api/me")).json().coins;
    dice.roll = () => 0; // the area boys stop this one, and every gamble works
    const ride = (await p.call("POST", "/api/game/rides", { mode: "okada", units: 3000 })).json();
    expect(ride.stop).toBe(true);
    expect(ride.fare).toBeGreaterThan(0);
    expect((await p.call("GET", "/api/me")).json().coins).toBe(before - ride.fare);

    const won = (await p.call("POST", `/api/game/rides/${ride.rideId}/stop`, { choice: "stand" })).json();
    expect(won).toMatchObject({ ok: true, cost: 0, xp: 20 });
    expect((await p.call("POST", `/api/game/rides/${ride.rideId}/stop`, { choice: "pay" })).statusCode).toBe(409);

    dice.roll = () => 0.99; // no stop on this one
    const calm = (await p.call("POST", "/api/game/rides", { mode: "danfo", units: 2000 })).json();
    expect(calm.stop).toBe(false);
    expect((await p.call("POST", `/api/game/rides/${calm.rideId}/stop`, { choice: "pay" })).statusCode).toBe(404);
  });

  it("charges for a failed gamble, refuses walking and silly distances", async () => {
    const p = await registerPlayer(app);
    dice.roll = () => 0;
    const ride = (await p.call("POST", "/api/game/rides", { mode: "keke", units: 1500 })).json();
    dice.roll = () => 0.99;
    const lost = (await p.call("POST", `/api/game/rides/${ride.rideId}/stop`, { choice: "run" })).json();
    expect(lost).toMatchObject({ ok: false, cost: 500, xp: 0 });
    expect((await p.call("POST", "/api/game/rides", { mode: "walk", units: 1500 })).statusCode).toBe(400);
    expect((await p.call("POST", "/api/game/rides", { mode: "cab", units: 999_999 })).statusCode).toBe(400);
    const other = await registerPlayer(app);
    dice.roll = () => 0;
    const theirs = (await other.call("POST", "/api/game/rides", { mode: "okada", units: 1000 })).json();
    expect((await p.call("POST", `/api/game/rides/${theirs.rideId}/stop`, { choice: "pay" })).statusCode).toBe(404);
  });

  it("charges public transport by distance and never stops it", async () => {
    const p = await registerPlayer(app);
    const before = (await p.call("GET", "/api/me")).json().coins;
    const r = (await p.call("POST", "/api/game/rides", { mode: "transit", transit: "ferry", units: 3000 })).json();
    expect(r).toMatchObject({ fare: transitFare("ferry", 3000), stop: false });
    expect((await p.call("GET", "/api/me")).json().coins).toBe(before - r.fare);
    expect((await p.call("POST", "/api/game/rides", { mode: "transit", transit: "coach", units: 3000 })).json()).toMatchObject({ fare: transitFare("coach", 3000), stop: false });
    expect((await p.call("POST", "/api/game/rides", { mode: "transit", transit: "rocket", units: 3000 })).statusCode).toBe(400);
  });
});
