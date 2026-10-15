// "Bring your crew" invites and play-night RSVPs.
import postgres from "postgres";
import { CREW } from "@hc/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
async function setXp(p: Player, xp: number) {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`update profiles set xp = ${xp} where user_id = ${p.id}`;
  await sql.end();
}

describe("crew invites", () => {
  it("welcomes the friend, adds contacts both ways, and rewards the inviter once the friend has played", async () => {
    const host = await registerPlayer(app, "crew_host");
    const plain = await registerPlayer(app, "crew_plain");
    const friend = await registerPlayer(app, "crew_friend", { crew: "@Crew_Host" });
    const plainCoins = (await plain.call("GET", "/api/me")).json().coins;
    expect((await friend.call("GET", "/api/me")).json().coins).toBe(plainCoins + CREW.welcome);
    expect((await friend.call("GET", "/api/contacts")).json().map((c: { nickname: string }) => c.nickname)).toEqual(["crew_host"]);
    expect((await host.call("GET", "/api/contacts")).json().map((c: { nickname: string }) => c.nickname)).toEqual(["crew_friend"]);
    expect((await host.call("GET", "/api/crew")).json()).toMatchObject({ code: "crew_host", friends: [{ nickname: "crew_friend", played: false }], rewarded: 0 });

    const before = (await host.call("GET", "/api/me")).json().coins;
    await friend.call("GET", "/api/me"); // not played yet: no reward
    expect((await host.call("GET", "/api/me")).json().coins).toBe(before);
    await setXp(friend, CREW.qualifyXp);
    await friend.call("GET", "/api/me");
    await friend.call("GET", "/api/me"); // paid once only
    expect((await host.call("GET", "/api/me")).json().coins).toBe(before + CREW.reward);
    expect((await host.call("GET", "/api/crew")).json()).toMatchObject({ friends: [{ nickname: "crew_friend", played: true }], rewarded: 1 });
  });

  it("ignores unknown or own crew codes", async () => {
    const p = await registerPlayer(app, "crew_solo", { crew: "nobody_here" });
    expect((await p.call("GET", "/api/contacts")).json()).toEqual([]);
  });
});

describe("play nights", () => {
  it("lists the next play nights and toggles I'm coming", async () => {
    const a = await registerPlayer(app, "night_a");
    const b = await registerPlayer(app, "night_b");
    const list = (await a.call("GET", "/api/play-nights")).json();
    expect(list.map((n: { key: string }) => n.key).sort()).toEqual(["buka_night", "games_night"]);
    const on = (await a.call("POST", "/api/play-nights/games_night/rsvp")).json().find((n: { key: string }) => n.key === "games_night");
    expect(on).toMatchObject({ coming: 1, you: true, names: ["night_a"] });
    expect((await b.call("GET", "/api/play-nights")).json().find((n: { key: string }) => n.key === "games_night")).toMatchObject({ coming: 1, you: false });
    const off = (await a.call("POST", "/api/play-nights/games_night/rsvp")).json().find((n: { key: string }) => n.key === "games_night");
    expect(off).toMatchObject({ coming: 0, you: false });
    expect((await a.call("POST", "/api/play-nights/owambe_saturday/rsvp")).statusCode).toBe(404);
  });
});
