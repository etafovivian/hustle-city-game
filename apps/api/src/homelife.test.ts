// Life at home: actions are done at things the room has (or you bought), cost what they cost, change needs and wait
// their turn; things can be sold back and bought again (charged again); a call reaches a friend.
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
  it("uses what the room has, adds what you buy, and checks cooldowns and coins", async () => {
    const p = await registerPlayer(app);
    await sql`update profiles set coin_balance = 100000 where user_id = ${p.id}`;
    const coins = async () => (await p.call("GET", "/api/me")).json().coins as number;
    // The starter room (a face-me room) has a kerosene stove: cooking works without buying a cooker.
    const before = await coins();
    const food0 = (await p.call("GET", "/api/game/needs")).json().needs.food as number;
    expect((await p.call("POST", "/api/game/home/act/cook", { room: "room" })).json().needs.food).toBe(Math.min(100, food0 + 30));
    expect(await coins()).toBe(before - 400);
    expect((await p.call("POST", "/api/game/home/act/cook", { room: "room" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/home/act/leftovers", { room: "room" })).statusCode).toBe(200);
    expect((await p.call("GET", "/api/game/skills")).json().cooking.points).toBe(8);
    // No TV in a face-me room, until you buy one.
    expect((await p.call("POST", "/api/game/home/act/tv", { room: "room" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/home/items", { key: "flat_tv" })).statusCode).toBe(201);
    expect((await p.call("POST", "/api/game/home/act/tv", { room: "room" })).statusCode).toBe(200);
    // Games need the console too; no pool here.
    expect((await p.call("POST", "/api/game/home/act/games", { room: "room" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/home/act/swim", { room: "room" })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/home/act/nonsense")).statusCode).toBe(404);
  });

  it("sells things back for half, charges again on a re-buy, and a call reaches a friend", async () => {
    const p = await registerPlayer(app, "caller_one");
    const friend = await registerPlayer(app, "friend_two");
    await sql`update profiles set coin_balance = 100000 where user_id = ${p.id}`;
    const coins = async () => (await p.call("GET", "/api/me")).json().coins as number;
    await p.call("POST", "/api/game/home/items", { key: "plastic_chairs" });
    expect(await coins()).toBe(100000 - 2000);
    expect((await p.call("DELETE", "/api/game/home/items/plastic_chairs")).json()).toMatchObject({ refund: 1000 });
    expect(await coins()).toBe(100000 - 1000);
    expect((await p.call("DELETE", "/api/game/home/items/plastic_chairs")).statusCode).toBe(404);
    expect((await p.call("POST", "/api/game/home/items", { key: "plastic_chairs" })).statusCode).toBe(201);
    expect(await coins()).toBe(100000 - 3000);

    const r = (await p.call("POST", "/api/game/home/act/call", { room: "room", to: "friend_two" })).json();
    expect(r.called).toBe("friend_two");
    const pings = (await friend.call("POST", "/api/presence", { x: 0, y: 0, place: null })).json().pings;
    expect(pings.some((x: { text?: string }) => x.text?.includes("called you"))).toBe(true);
  });
});
