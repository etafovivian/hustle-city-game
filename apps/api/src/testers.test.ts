// Beta tester rewards: days played earn tiers on their own, a fixed report counts, admins pick Founding testers,
// and paying out credits each tier's coins once (the difference when someone moves up).
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

/** Add `n` earlier days played (from `from` days ago back), clear of today in any time zone. */
const days = (id: string, n: number, from = 2) =>
  sql`insert into player_days (user_id, day) select ${id}, to_char(current_date - g, 'YYYY-MM-DD') from generate_series(${from}::int, ${from + n - 1}::int) g on conflict do nothing`;

describe("tester rewards", () => {
  it("earn tiers from days and reports, set Founding by hand, pay once", async () => {
    const admin = await registerPlayer(app, "tester_lead");
    const a = await registerPlayer(app, "tester_a");
    const b = await registerPlayer(app, "tester_b");
    const c = await registerPlayer(app, "tester_c");
    await sql`update users set roles = array['player','admin'] where id = ${admin.id}`;

    // Playing today counts a day (from the map's position reports).
    await a.call("POST", "/api/presence", { x: 100, y: 100 });
    await new Promise((r) => setTimeout(r, 300));
    expect((await a.call("GET", "/api/tester")).json()).toMatchObject({ tier: null, days: 1 });
    await days(a.id, 1);
    expect((await a.call("GET", "/api/tester")).json()).toMatchObject({ tier: "joined", days: 2, coins: 10_000, paid: 0 });

    // Seven days, or one report the team marks fixed: Active.
    await days(b.id, 7);
    expect((await b.call("GET", "/api/tester")).json()).toMatchObject({ tier: "active", coins: 50_000 });
    expect((await c.call("POST", "/api/feedback", { kind: "bug", message: "The bus stop sign floats" })).statusCode).toBe(201);
    await days(c.id, 1);
    expect((await c.call("GET", "/api/tester")).json()).toMatchObject({ tier: null, usefulReports: 0 });
    await sql`update feedback set status = 'fixed' where user_id = ${c.id}`;
    expect((await c.call("GET", "/api/tester")).json()).toMatchObject({ tier: "active", usefulReports: 1 });

    // Admins only; admins never earn a tier.
    expect((await a.call("GET", "/api/admin/testers")).statusCode).toBe(403);
    await days(admin.id, 9);
    const list = (await admin.call("GET", "/api/admin/testers")).json();
    expect(list.map((r: { nickname: string }) => r.nickname).sort()).toEqual(["tester_a", "tester_b", "tester_c"]);
    expect(list.find((r: { nickname: string }) => r.nickname === "tester_c")).toMatchObject({ reports: 1, tier: "active" });

    // Founding tester by hand; then pay everyone.
    expect((await admin.call("POST", `/api/admin/testers/${b.id}`, { tier: "founding" })).json()).toMatchObject({ tier: "founding", coins: 100_000 });
    const before = (await sql`select user_id, coin_balance from profiles`).reduce((m, r) => m.set(r.user_id, r.coin_balance), new Map());
    expect((await admin.call("POST", "/api/admin/testers/pay")).json()).toEqual({ players: 3, coins: 160_000 });
    const bal = async (id: string) => (await sql`select coin_balance from profiles where user_id = ${id}`)[0]!.coin_balance - before.get(id);
    expect(await bal(a.id)).toBe(10_000);
    expect(await bal(b.id)).toBe(100_000);
    expect(await bal(c.id)).toBe(50_000);
    // Paying again does nothing; moving up pays only the difference.
    expect((await admin.call("POST", "/api/admin/testers/pay")).json()).toEqual({ players: 0, coins: 0 });
    await days(a.id, 6, 3);
    expect((await a.call("GET", "/api/tester")).json()).toMatchObject({ tier: "active", paid: 10_000 });
    expect((await admin.call("POST", "/api/admin/testers/pay")).json()).toEqual({ players: 1, coins: 40_000 });
    expect(await bal(a.id)).toBe(50_000);
    expect((await sql`select count(*)::int as n from game_ledger_entries where kind = 'tester_reward'`)[0]!.n).toBe(4);
  });
});
