// Beta stats: admins only; admins left out of the numbers; activity and feature use show up.
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

describe("beta stats", () => {
  it("count players and what they do, for admins only", async () => {
    const admin = await registerPlayer(app, "stats_lead");
    const a = await registerPlayer(app, "stats_a");
    await registerPlayer(app, "stats_b");
    await sql`update users set roles = array['player','admin'] where id = ${admin.id}`;
    expect((await a.call("GET", "/api/admin/stats")).statusCode).toBe(403);
    // Player a does things: meets someone (quest progress) and adopts a pet (coins).
    await sql`update profiles set coin_balance = 100000 where user_id = ${a.id}`;
    await a.call("POST", "/api/love/zainab/meet", { at: "general_hospital" });
    await a.call("POST", "/api/pets", { kind: "dog_local", name: "Bingo" });
    const s = (await admin.call("GET", "/api/admin/stats")).json();
    expect(s.players.total).toBe(2);
    expect(s.players.newToday).toBe(2);
    expect(s.players.activeToday).toBe(1);
    expect(s.daily).toHaveLength(14);
    expect(s.daily.at(-1)).toMatchObject({ signups: 2, active: 1 });
    expect(s.cohorts[0]).toMatchObject({ signups: 2, d1: null, d7: null });
    const use = (label: string) => s.use.find((u: { label: string }) => u.label === label);
    expect(use("Pets adopted")).toMatchObject({ times: 1, players: 1 });
    expect(use("People met (Love)")).toMatchObject({ times: 1, players: 1 });
    expect(s.pets).toEqual({ dog_local: 1 });
    expect(s.love).toEqual({ met: 1 });
  });
});
