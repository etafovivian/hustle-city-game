// Beta feedback: reports from players, browser errors counted per player, and the admin view.
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer } from "./test/harness.js";

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

describe("beta feedback", () => {
  it("takes a report with context, counts repeated errors, and shows both to admins only", async () => {
    const p = await registerPlayer(app);
    expect((await p.call("POST", "/api/feedback", { kind: "bug", message: "The nurse stands in the bin", context: { screen: "hospital", device: "test" } })).statusCode).toBe(201);
    expect((await p.call("POST", "/api/feedback", { kind: "bug", message: "x" })).statusCode).toBe(400);
    for (let i = 0; i < 3; i++) expect((await p.call("POST", "/api/feedback/error", { message: "TypeError: x is undefined", stack: "at a\nat b", context: { url: "/" } })).statusCode).toBe(204);
    expect((await p.call("GET", "/api/admin/feedback")).statusCode).toBe(403);
    const admin = await registerPlayer(app);
    const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
    await sql`update users set roles = array['player','admin'] where id = ${admin.id}`;
    await sql.end();
    const all = (await admin.call("GET", "/api/admin/feedback?kind=all&status=all")).json();
    expect(all).toHaveLength(2);
    const err = all.find((r: { kind: string }) => r.kind === "error");
    expect(err.count).toBe(3);
    const bug = all.find((r: { kind: string }) => r.kind === "bug");
    expect(bug).toMatchObject({ message: "The nurse stands in the bin", context: { screen: "hospital" } });
    expect((await admin.call("POST", `/api/admin/feedback/${bug.id}`, { status: "fixed" })).statusCode).toBe(200);
    expect((await admin.call("GET", "/api/admin/feedback?status=new")).json()).toHaveLength(1);
  });
});
