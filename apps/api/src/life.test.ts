// Jobs, homes and vehicles.
import postgres from "postgres";
import { PLOTS_FOR_SALE, plotPriceOf } from "@hc/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dice } from "./modules/game/rides.js";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer, type Player } from "./test/harness.js";

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
async function rich(p: Player, coins = 2_000_000) {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`update profiles set coin_balance = ${coins} where user_id = ${p.id}`;
  await sql.end();
}

describe("jobs", () => {
  it("pays shifts, promotes after 4, and stops at the daily cap", async () => {
    const p = await registerPlayer(app);
    const first = (await p.call("GET", "/api/game/jobs/mama_nkechi_buka")).json();
    expect(first).toMatchObject({ title: "Dishwasher", rung: 0, toNext: 4, shiftsLeftToday: 4 });
    const coins0 = (await p.call("GET", "/api/me")).json().coins;
    let last;
    for (let i = 0; i < 4; i++) last = (await p.call("POST", "/api/game/jobs/mama_nkechi_buka/shift")).json();
    expect(last.promoted).toBe("Kitchen help");
    expect(last.job).toMatchObject({ title: "Kitchen help", shiftsLeftToday: 0 });
    expect((await p.call("GET", "/api/me")).json().coins).toBe(coins0 + 4 * 400);
    expect((await p.call("POST", "/api/game/jobs/sharp_cuts/shift")).statusCode).toBe(409);
    expect((await p.call("GET", "/api/game/needs")).json().needs.energy).toBeLessThan(40);
    expect((await p.call("POST", "/api/game/jobs/nowhere/shift")).statusCode).toBe(404);
  });
});

describe("homes", () => {
  it("buys a plot with a house, rebuilds, rests, and shows on the map", async () => {
    const p = await registerPlayer(app);
    const other = await registerPlayer(app);
    await rich(p);
    await rich(other);
    const [plotId] = PLOTS_FOR_SALE[0]!;
    expect((await p.call("GET", "/api/game/home")).json()).toMatchObject({ plotId: null });
    const before = (await p.call("GET", "/api/me")).json().coins;
    const bought = await p.call("POST", `/api/land/${encodeURIComponent(plotId)}/buy`, { design: "bungalow" });
    expect(bought.statusCode).toBe(201);
    expect((await p.call("GET", "/api/me")).json().coins).toBe(before - plotPriceOf(plotId)! - 30_000);
    expect((await other.call("POST", `/api/land/${encodeURIComponent(plotId)}/buy`, { design: "villa" })).statusCode).toBe(409);
    expect((await p.call("POST", `/api/land/${encodeURIComponent(PLOTS_FOR_SALE[1]![0])}/buy`, { design: "villa" })).statusCode).toBe(409); // one home
    expect((await p.call("POST", "/api/game/home/design", { design: "storey_house" })).json()).toMatchObject({ design: "storey_house", paid: 70_000 - 15_000 });
    const map = (await other.call("GET", "/api/map/homes")).json();
    expect(map).toEqual([expect.objectContaining({ plotId, design: "storey_house", mine: false })]);
    expect((await p.call("POST", "/api/game/home/rest")).statusCode).toBe(200);
    expect((await p.call("POST", "/api/game/home/rest")).statusCode).toBe(409);
    expect((await p.call("POST", "/api/land/not-a-plot+1/buy", { design: "villa" })).statusCode).toBe(400);
  });
});

describe("vehicles", () => {
  it("buys a car and drives it for fuel", async () => {
    const p = await registerPlayer(app);
    expect((await p.call("POST", "/api/game/vehicles", { kind: "suv" })).statusCode).toBe(422); // can't afford
    await rich(p);
    expect((await p.call("POST", "/api/game/rides", { mode: "own", vehicle: "saloon", units: 3000 })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/vehicles", { kind: "saloon" })).statusCode).toBe(201);
    expect((await p.call("POST", "/api/game/vehicles", { kind: "saloon" })).statusCode).toBe(409);
    expect((await p.call("GET", "/api/game/vehicles")).json()).toEqual(["saloon"]);
    dice.roll = () => 0.99;
    const drive = (await p.call("POST", "/api/game/rides", { mode: "own", vehicle: "saloon", units: 3000 })).json();
    expect(drive).toMatchObject({ fare: 27, stop: false });
  });
});
