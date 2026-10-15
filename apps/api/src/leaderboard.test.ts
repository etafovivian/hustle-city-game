// The weekly leaderboard: coins earned from sales this week; admins (the team, with test coins) are left out.
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

describe("leaderboard", () => {
  it("ranks players by this week's takings and leaves admins out", async () => {
    const seller = await registerPlayer(app, "big_seller");
    const admin = await registerPlayer(app, "team_lead");
    await sql`update users set roles = array['player','admin'] where id = ${admin.id}`;
    for (const [id, amount] of [
      [seller.id, 500],
      [admin.id, 999_999],
    ] as const)
      await sql`insert into game_ledger_entries (user_id, amount, balance_after, kind, reference) values (${id}, ${amount}, ${amount}, 'takings', ${`test:${id}`})`;
    const board = (await seller.call("GET", "/api/game/leaderboard")).json();
    expect(board.map((r: { nickname: string }) => r.nickname)).toEqual(["big_seller"]);
    expect(board[0]).toMatchObject({ rank: 1, coinsEarned: 500, isMe: true });
  });
});
