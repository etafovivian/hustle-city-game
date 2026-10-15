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

describe("businesses on the map", () => {
  it("puts a live business on one free plot, moves it, and keeps others off it", async () => {
    const owner = await registerPlayer(app);
    const other = await registerPlayer(app);
    const biz = (await owner.call("POST", "/api/businesses", { kind: "retail", name: "Mama Bisi Provisions", category: "provisions", areas: ["Yaba"], pickupAddress: "12 Herbert Macaulay Way, Yaba", description: "Rice, beans, garri, noodles and drinks every day." })).json();
    // Not live yet
    expect((await owner.call("PUT", `/api/businesses/${biz.id}/plot`, { plotId: "lekki-gardens-c2+3" })).statusCode).toBe(409);
    const sql = (await import("postgres")).default((await import("./test/harness.js")).TEST_DATABASE_URL, { max: 1 });
    await sql`update businesses set status = 'published' where id = ${biz.id}`;
    await sql.end();
    expect((await other.call("PUT", `/api/businesses/${biz.id}/plot`, { plotId: "lekki-gardens-c2+3" })).statusCode).toBe(404);
    expect((await owner.call("PUT", `/api/businesses/${biz.id}/plot`, { plotId: "lekki-gardens-c2+3" })).statusCode).toBe(200);
    expect((await owner.call("PUT", `/api/businesses/${biz.id}/plot`, { plotId: "lekki-gardens-c2+4" })).statusCode).toBe(200);
    const map = (await app.inject({ method: "GET", url: "/api/map/businesses" })).json();
    expect(map).toHaveLength(1);
    expect(map[0]).toMatchObject({ plotId: "lekki-gardens-c2+4", name: "Mama Bisi Provisions", kind: "retail" });
  });
});
