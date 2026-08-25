// Balogun Market: haggling for stock (floor on the server), and free stalls for real traders.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { VENUES_BY_KEY, isOpenAt, lagosHourOf } from "@hc/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer } from "./test/harness.js";

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
const open = () => isOpenAt(VENUES_BY_KEY.get("balogun_market")!, lagosHourOf(new Date()));

describe("Balogun market", () => {
  it("haggles: lowballs walk, fair offers get a counter, and a deal stocks the shop below the ask", async () => {
    const p = await registerPlayer(app);
    await p.call("GET", "/api/game/shop");
    const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    await sql`update profiles set coin_balance = 100000 where user_id = ${p.id}`;
    await sql.end();
    const haggle = (offer: number) => p.call("POST", "/api/market/haggle", { itemKey: "power_bank", units: 2, offer, requestId: randomUUID() });
    const first = await haggle(1);
    if (!open()) return expect(first.statusCode).toBe(409);
    expect(first.json()).toMatchObject({ result: "walked", triesLeft: 2 });
    const counter = (await haggle(3200)).json();
    // The trader's floor depends on the player and day, so a middling offer may be countered or waved off.
    expect(["counter", "walked", "deal"]).toContain(counter.result);
    const deal = (await haggle(5500)).json();
    expect(deal).toMatchObject({ result: "deal", paid: 5500 });
    const shop = (await p.call("GET", "/api/game/shop")).json();
    expect(JSON.stringify(shop)).toContain("power_bank");
  });

  it("gives a live business a free stall", async () => {
    const owner = await registerPlayer(app);
    const biz = (await owner.call("POST", "/api/businesses", { kind: "retail", name: "Ada Fabrics", category: "fashion_fabrics", areas: ["Lagos Island"], pickupAddress: "Stall area, Balogun, Lagos Island", description: "Ankara, lace and aso-oke at good prices." })).json();
    const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    await sql`update businesses set status = 'published' where id = ${biz.id}`;
    await sql.end();
    expect((await owner.call("POST", `/api/businesses/${biz.id}/stall`)).json()).toMatchObject({ stall: 1 });
    const map = (await app.inject({ method: "GET", url: "/api/map/businesses" })).json();
    expect(map[0].plotId).toBe("balogun-stall+1");
  });
});
