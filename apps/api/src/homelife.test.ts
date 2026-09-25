// Life at home: actions need what they need (a thing, a room), cost what they cost, change needs and wait their turn.
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer } from "./test/harness.js";

let app: Awaited<ReturnType<typeof testServer>>;
let sql: ReturnType<typeof postgres>;
beforeAll(async () => {
  await prepareDatabase();
  app = await testServer();
  sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
});
afterAll(async () => {
  await sql?.end();
  await app?.close();
});
beforeEach(async () => {
  await resetDatabase();
});

describe("life at home", () => {
  it("cooks with a cooker, eats what was cooked, and checks rooms, cooldowns and coins", async () => {
    const p = await registerPlayer(app);
    await sql`update profiles set coin_balance = 100000 where user_id = ${p.id}`;
    const coins = async () => (await p.call("GET", "/api/me")).json().coins as number;

    expect((await p.call("POST", "/api/game/home/act/relax")).statusCode).toBe(200);
    expect((await p.call("POST", "/api/game/home/act/relax")).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/home/act/cook")).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/home/act/leftovers")).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/home/items", { key: "gas_cooker" })).statusCode).toBeLessThan(300);

    const before = await coins();
    const food0 = (await p.call("GET", "/api/game/needs")).json().needs.food as number;
    const cooked = (await p.call("POST", "/api/game/home/act/cook")).json();
    expect(cooked.needs.food).toBe(Math.min(100, food0 + 30));
    expect(await coins()).toBe(before - 400);
    expect((await p.call("POST", "/api/game/home/act/leftovers")).statusCode).toBe(200);
    expect((await p.call("GET", "/api/game/skills")).json().cooking.points).toBe(8);

    // The starter room has no pool or cinema.
    expect((await p.call("POST", "/api/game/home/act/swim", { room: "pool" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/home/act/nonsense")).statusCode).toBe(404);
  });
});
