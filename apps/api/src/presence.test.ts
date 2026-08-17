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
    // Too far for a drink
    await a.call("POST", "/api/presence", { x: 100, y: 100, place: null });
    expect((await b.call("POST", "/api/presence/treat", { to: "maro_test" })).statusCode).toBe(409);
  });
});
