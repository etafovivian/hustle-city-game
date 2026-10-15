// Presence: players see each other, wave, and buy a drink when they're together.
import { EVENT_XP, eventAt } from "@hc/shared";
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
    // Contacts: add by @name, see them online and where
    expect((await a.call("POST", "/api/contacts/@alexander_t")).statusCode).toBe(201);
    expect((await a.call("GET", "/api/contacts")).json()[0]).toMatchObject({ nickname: "alexander_t", online: true, place: "general_hospital" });
    expect((await a.call("POST", "/api/contacts/nobody_here_x")).statusCode).toBe(404);
    expect((await a.call("DELETE", "/api/contacts/alexander_t")).statusCode).toBe(200);
    expect((await a.call("GET", "/api/contacts")).json()).toEqual([]);
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
    // Together: +50%; and +50% more while a city event is on there.
    expect(r).toMatchObject({ gained: Math.round(10 * 1.5 * (eventAt("mama_nkechi_buka", new Date()) ? EVENT_XP : 1)), together: ["tunde_together"] });
    const pings = (await b.call("POST", "/api/presence", { x: 5010, y: 2400, place: "mama_nkechi_buka" })).json().pings;
    expect(pings[0]).toMatchObject({ kind: "join", from: "bisi_together" });
  });
});

describe("ayo", () => {
  it("rejects fake wins and plays live games in turn", async () => {
    const a = await registerPlayer(app, "ayo_a");
    const b = await registerPlayer(app, "ayo_b");
    expect((await a.call("POST", "/api/games/ayo/win", { moves: [0, 1, 2] })).statusCode).toBe(400);
    await a.call("POST", "/api/presence", { x: 100, y: 100, place: null });
    await b.call("POST", "/api/presence", { x: 100, y: 100, place: null });
    const g = (await a.call("POST", "/api/games/ayo/challenge", { to: "ayo_b" })).json();
    expect(g).toMatchObject({ you: 0, names: ["ayo_a", "ayo_b"] });
    expect((await b.call("POST", `/api/games/ayo/${g.id}/move`, { pit: 6 })).statusCode).toBe(409); // not b's turn
    expect((await a.call("POST", `/api/games/ayo/${g.id}/move`, { pit: 0 })).json().state.turn).toBe(1);
    expect((await b.call("GET", `/api/games/ayo/${g.id}`)).json()).toMatchObject({ you: 1 });
    const ping = (await b.call("POST", "/api/presence", { x: 100, y: 100, place: null })).json().pings[0];
    expect(ping).toMatchObject({ kind: "challenge", text: g.id });
  });

  it("plays live snooker shots on the server in turn", async () => {
    const a = await registerPlayer(app, "pool_a");
    const b = await registerPlayer(app, "pool_b");
    await a.call("POST", "/api/presence", { x: 100, y: 100, place: null });
    await b.call("POST", "/api/presence", { x: 100, y: 100, place: null });
    const g = (await a.call("POST", "/api/games/snooker/challenge", { to: "pool_b" })).json();
    expect((await b.call("POST", `/api/games/snooker/${g.id}/shot`, { angle: 0, power: 1 })).statusCode).toBe(409);
    const after = (await a.call("POST", `/api/games/snooker/${g.id}/shot`, { angle: 0, power: 1 })).json();
    expect(after.state.shots).toBe(1);
    expect(after.last).toEqual({ angle: 0, power: 1 });
  });

  it("sets a chess table at the snooker spot: one sits and waits, another joins, a third watches", async () => {
    const a = await registerPlayer(app, "chess_a");
    const b = await registerPlayer(app, "chess_b");
    const c = await registerPlayer(app, "chess_c");
    for (const p of [a, b, c]) await p.call("POST", "/api/presence", { x: 100, y: 100, place: "oga_snooker" });
    const t = (await a.call("POST", "/api/games/chess/open", { place: "oga_snooker" })).json();
    expect(t).toMatchObject({ game: "chess", you: 0, waiting: true });
    expect((await a.call("POST", `/api/games/chess/${t.id}/move`, { from: 52, to: 36 })).statusCode).toBe(409); // nobody to play yet
    expect((await b.call("GET", "/api/games/at/oga_snooker")).json()).toEqual([expect.objectContaining({ id: t.id, waiting: true, names: ["chess_a", null] })]);
    expect((await b.call("POST", `/api/games/table/${t.id}/join`)).json()).toMatchObject({ you: 1, waiting: false });
    expect((await c.call("POST", `/api/games/table/${t.id}/join`)).statusCode).toBe(409); // seat taken
    expect((await a.call("POST", `/api/games/chess/${t.id}/move`, { from: 52, to: 28 })).statusCode).toBe(400); // e2e5 is illegal
    expect((await a.call("POST", `/api/games/chess/${t.id}/move`, { from: 52, to: 36 })).json().state.turn).toBe(1); // e2e4
    expect((await c.call("GET", `/api/games/chess/${t.id}`)).json()).toMatchObject({ you: null, names: ["chess_a", "chess_b"] });
    const ping = (await a.call("POST", "/api/presence", { x: 100, y: 100, place: "oga_snooker" })).json().pings[0];
    expect(ping).toMatchObject({ kind: "join", from: "chess_b" });
    // b walks away: a wins.
    await b.call("POST", `/api/games/table/${t.id}/leave`);
    expect((await a.call("GET", `/api/games/chess/${t.id}`)).json().state).toMatchObject({ over: true, winner: 0 });
  });

  it("only rewards a real chess win against the computer", async () => {
    const a = await registerPlayer(app, "chess_cpu");
    // Fool's mate the other way round is not a win for you.
    const lose = [{ from: 53, to: 45 }, { from: 12, to: 28 }, { from: 54, to: 38 }, { from: 3, to: 39 }];
    expect((await a.call("POST", "/api/games/chess/win", { moves: lose })).statusCode).toBe(400);
  });
});
