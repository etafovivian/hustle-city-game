// Presence: players see each other, wave, and buy a drink when they're together.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareDatabase, registerPlayer, resetDatabase, testServer } from "./test/harness.js";

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

describe("presence", () => {
  it("lets two friends see each other at the hospital, wave and share a drink", async () => {
    const a = await registerPlayer(app, "maro_test");
    const b = await registerPlayer(app, "alexander_t");
    await a.call("POST", "/api/presence", { x: 7000, y: 1200, place: "general_hospital" });
    const seenByB = (await b.call("POST", "/api/presence", { x: 7020, y: 1210, place: "general_hospital" })).json();
    expect(seenByB.players).toEqual([expect.objectContaining({ nickname: "maro_test", place: "general_hospital" })]);
    expect((await b.call("POST", "/api/presence/wave", { to: "maro_test" })).statusCode).toBe(200);
    const coins = (await b.call("GET", "/api/me")).json().coins;
    expect((await b.call("POST", "/api/presence/treat", { to: "maro_test" })).statusCode).toBe(200);
    expect((await b.call("GET", "/api/me")).json().coins).toBe(coins - 300);
    const inbox = (await a.call("POST", "/api/presence", { x: 7000, y: 1200, place: "general_hospital" })).json();
    expect(inbox.pings.map((p: { kind: string }) => p.kind)).toEqual(["wave", "drink"]);
    expect(inbox.players[0].nickname).toBe("alexander_t");
    // Room chat at the hospital, and a private message
    expect((await a.call("POST", "/api/chat/place/general_hospital", { body: "How far, I dey ward" })).statusCode).toBe(200);
    expect((await b.call("GET", "/api/chat/place/general_hospital")).json()[0]).toMatchObject({ from: "maro_test", body: "How far, I dey ward" });
    expect((await a.call("POST", "/api/chat/place/general_hospital", { body: "call me 08031234567" })).statusCode).toBe(400);
    expect((await b.call("POST", "/api/chat/dm/maro_test", { body: "Meet me at Skyline" })).statusCode).toBe(201);
    expect((await a.call("POST", "/api/presence", { x: 7000, y: 1200, place: "general_hospital" })).json().unread).toBe(1);
    expect((await a.call("GET", "/api/chat/dm")).json()[0]).toMatchObject({ with: "alexander_t", unread: 1 });
    expect((await a.call("GET", "/api/chat/dm/alexander_t")).json()[0]).toMatchObject({ body: "Meet me at Skyline", mine: false });
    expect((await a.call("GET", "/api/chat/dm")).json()[0].unread).toBe(0);
    // Too far for a drink
    await a.call("POST", "/api/presence", { x: 100, y: 100, place: null });
    expect((await b.call("POST", "/api/presence/treat", { to: "maro_test" })).statusCode).toBe(409);
  });

  it("gives a together bonus when friends do things at the same place", async () => {
    const a = await registerPlayer(app, "bisi_together");
    const b = await registerPlayer(app, "tunde_together");
    await a.call("POST", "/api/presence", { x: 5000, y: 2400, place: "mama_nkechi_buka" });
    await b.call("POST", "/api/presence", { x: 5010, y: 2400, place: "mama_nkechi_buka" });
    const r = (await a.call("POST", "/api/game/venues/mama_nkechi_buka/amala")).json();
    expect(r).toMatchObject({ gained: 15, together: ["tunde_together"] });
    const pings = (await b.call("POST", "/api/presence", { x: 5010, y: 2400, place: "mama_nkechi_buka" })).json().pings;
    expect(pings[0]).toMatchObject({ kind: "join", from: "bisi_together" });
  });
});
