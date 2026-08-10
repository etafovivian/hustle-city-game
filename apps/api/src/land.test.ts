// Land interest: players mark plots they want; counts are public, the list of who is admin-only.
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

describe("land interest", () => {
  it("records interest once per plot, counts it, and lets the player drop it", async () => {
    const a = await registerPlayer(app);
    const b = await registerPlayer(app);
    expect((await a.call("POST", "/api/land/lekki-gardens-c2+3/interest")).json()).toMatchObject({ mine: ["lekki-gardens-c2+3"] });
    await a.call("POST", "/api/land/lekki-gardens-c2+3/interest");
    const vb = (await b.call("POST", "/api/land/lekki-gardens-c2+3/interest")).json();
    expect(vb.counts["lekki-gardens-c2+3"]).toBe(2);
    expect((await app.inject({ method: "GET", url: "/api/land/interest" })).json()).toMatchObject({ counts: { "lekki-gardens-c2+3": 2 }, mine: [] });
    expect((await a.call("DELETE", "/api/land/lekki-gardens-c2+3/interest")).json().mine).toEqual([]);
    expect((await a.call("POST", "/api/land/..%2Fsecret/interest")).statusCode).toBe(400);
    expect((await a.call("GET", "/api/admin/land-interest")).statusCode).toBe(403);
  });
});
