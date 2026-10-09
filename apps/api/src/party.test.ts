// House parties: only with a house of your own, once a Lagos day, bigger ones need a bigger house; contacts see it;
// a friend who is at the house joins once (Social, Fun, XP for them; XP for the host).
import { PARTY_BY_KEY } from "@hc/shared";
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

describe("house parties", () => {
  it("are thrown at your own house once a day, and friends who come join in", async () => {
    const host = await registerPlayer(app, "party_host");
    const friend = await registerPlayer(app, "party_friend");
    await sql`update profiles set coin_balance = 100000 where user_id = ${host.id}`;
    // No house of your own yet.
    expect((await host.call("GET", "/api/parties")).json().canThrow.ok).toBe(false);
    expect((await host.call("POST", "/api/parties", { size: "gist" })).json().error).toBe("no_house");
    await sql`insert into player_plots (user_id, plot_id, design, is_home) values (${host.id}, 'test-plot-party', 'bungalow', true)`;
    // A big bash needs a bigger house.
    expect((await host.call("POST", "/api/parties", { size: "bash" })).json().error).toBe("too_small");
    await friend.call("POST", "/api/contacts/party_host");
    const xp0 = (await host.call("GET", "/api/me")).json().xp as number;
    const thrown = await host.call("POST", "/api/parties", { size: "owambe" });
    expect(thrown.statusCode).toBe(201);
    expect(thrown.json().balance).toBe(100000 - PARTY_BY_KEY.get("owambe")!.cost);
    expect((await host.call("POST", "/api/parties", { size: "gist" })).json().error).toBe("partied");
    // The friend sees it, but has to be at the house to join.
    const seen = (await friend.call("GET", "/api/parties")).json();
    expect(seen.friends).toHaveLength(1);
    const id = seen.friends[0].id as string;
    expect((await friend.call("POST", `/api/parties/${id}/join`)).json().error).toBe("not_there");
    await friend.call("POST", "/api/presence", { x: 0, y: 0, place: "home:test-plot-party" });
    const social0 = (await friend.call("GET", "/api/game/needs")).json().needs.social as number;
    expect((await friend.call("POST", `/api/parties/${id}/join`)).json().joined).toBe(true);
    expect((await friend.call("POST", `/api/parties/${id}/join`)).json().joined).toBe(false);
    expect((await friend.call("GET", "/api/game/needs")).json().needs.social).toBeGreaterThan(social0 + 15);
    expect((await host.call("GET", "/api/parties")).json().mine.guests).toBe(1);
    expect((await host.call("GET", "/api/me")).json().xp).toBe(xp0 + PARTY_BY_KEY.get("owambe")!.xp + 5);
    expect((await host.call("POST", `/api/parties/${id}/join`)).json().error).toBe("own_party");
  });
});
