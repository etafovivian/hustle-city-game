// Pets: adopt one (coins), name checks, care counts once per its hours, happiness drifts, a happy pet helps sleep.
import { PET_BY_KIND, PET_CARE } from "@hc/shared";
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

describe("pets", () => {
  it("are adopted, named, cared for, and drift when ignored", async () => {
    const p = await registerPlayer(app);
    await sql`update profiles set coin_balance = 100000 where user_id = ${p.id}`;
    expect((await p.call("GET", "/api/pets")).json().pet).toBeNull();
    expect((await p.call("POST", "/api/pets", { kind: "dog_local", name: "B@d!" })).statusCode).toBe(400);
    const adopted = await p.call("POST", "/api/pets", { kind: "dog_local", name: "Bingo" });
    expect(adopted.statusCode).toBe(201);
    expect(adopted.json().balance).toBe(100000 - PET_BY_KIND.get("dog_local")!.cost);
    expect((await p.call("POST", "/api/pets", { kind: "cat_tabby", name: "Tom" })).json().error).toBe("has_pet");
    const fed = (await p.call("POST", "/api/pets/feed")).json();
    expect(fed.counted).toBe(true);
    expect(fed.balance).toBe(100000 - PET_BY_KIND.get("dog_local")!.cost - PET_CARE.feed.cost);
    expect(fed.pet.happiness).toBe(100);
    // Feeding again soon: welcome, but it doesn't count (or cost).
    const again = (await p.call("POST", "/api/pets/feed")).json();
    expect(again.counted).toBe(false);
    expect(again.balance).toBeUndefined();
    // Two days alone: happiness drifts down, and play lifts it (and your Fun).
    await sql`update player_pets set happy_at = now() - interval '40 hours' where user_id = ${p.id}`;
    expect((await p.call("GET", "/api/pets")).json().pet.mood).toBe("sad");
    const played = (await p.call("POST", "/api/pets/play")).json();
    expect(played.counted).toBe(true);
    expect(played.pet.happiness).toBe(35);
    expect((await p.call("PUT", "/api/pets/name", { name: "Bingo Junior" })).json().pet.name).toBe("Bingo Junior");
    expect((await p.call("DELETE", "/api/pets")).json().pet).toBeNull();
  });
});
