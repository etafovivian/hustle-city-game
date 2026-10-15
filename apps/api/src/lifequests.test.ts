// Life quests: one more quest a day from your own life. With nothing yet: meet someone new. With a pet: care for it.
// Reading, home actions and chats count towards the shared daily quests too.
import { LIFE_QUESTS_BY_KEY } from "@hc/shared";
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

describe("life quests", () => {
  it("start with meeting someone, follow what you have, and pay once", async () => {
    const p = await registerPlayer(app);
    await sql`update profiles set coin_balance = 100000 where user_id = ${p.id}`;
    const board = (await p.call("GET", "/api/game/quests")).json();
    expect(board.life.key).toBe("life_meet");
    expect((await p.call("POST", "/api/game/quests/life_meet/claim")).statusCode).toBe(422);
    await p.call("POST", "/api/love/adaeze/meet", { at: "tailors_row" });
    expect((await p.call("GET", "/api/game/quests")).json().life.progress).toBe(1);
    const coins = (await p.call("GET", "/api/me")).json().coins as number;
    expect((await p.call("POST", "/api/game/quests/life_meet/claim")).statusCode).toBe(200);
    expect((await p.call("GET", "/api/me")).json().coins).toBe(coins + LIFE_QUESTS_BY_KEY.get("life_meet")!.rewardCoins);
    expect((await p.call("POST", "/api/game/quests/life_meet/claim")).statusCode).toBe(409);
    // With a pet, the life quest is about the pet; another day's quest can't be claimed.
    await p.call("POST", "/api/pets", { kind: "cat_tabby", name: "Mimi" });
    expect((await p.call("GET", "/api/game/quests")).json().life.key).toBe("life_pet");
    await p.call("POST", "/api/pets/feed");
    await p.call("POST", "/api/pets/play");
    expect((await p.call("GET", "/api/game/quests")).json().life.progress).toBe(2);
    expect((await p.call("POST", "/api/game/quests/life_party/claim")).statusCode).toBe(404);
  });
});
