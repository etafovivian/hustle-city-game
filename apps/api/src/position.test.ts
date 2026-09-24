// The player's last spot on the map lives on their account, so every device starts them in the same place.
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

describe("last position", () => {
  it("is null at first, saved on arrival, and refused off the map", async () => {
    const p = await registerPlayer(app);
    expect((await p.call("GET", "/api/me")).json().lastPos).toBeNull();
    const saved = (await p.call("PUT", "/api/me/position", { x: 22450.4, y: -1872.6 })).json();
    expect(saved).toMatchObject({ x: 22450, y: -1873 });
    const me = (await p.call("GET", "/api/me")).json();
    expect(me.lastPos).toMatchObject({ x: 22450, y: -1873 });
    expect(Date.parse(me.lastPos.at)).toBeGreaterThan(Date.now() - 60_000);
    expect((await p.call("PUT", "/api/me/position", { x: 99_999, y: 0 })).statusCode).toBe(400);
  });
});
