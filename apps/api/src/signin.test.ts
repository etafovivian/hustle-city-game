// Easier sign-up and sign-in: short passwords (but not common ones), sign in with email or nickname, a nickname
// check before the last step, and "forgot password" requests that reach the admins.
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ORIGIN, TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer } from "./test/harness.js";

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

const post = (url: string, payload: object) => app.inject({ method: "POST", url, headers: { origin: ORIGIN }, payload });

describe("sign-up and sign-in", () => {
  it("takes a 6-character password but not a common one", async () => {
    const base = { avatar: undefined, hustle: "artisan", confirmAdult: true };
    expect((await post("/api/auth/register", { ...base, email: "a1@example.test", nickname: "short_pw", password: "ab12" })).statusCode).toBe(400);
    const common = await post("/api/auth/register", { ...base, email: "a2@example.test", nickname: "common_pw", password: "123456" });
    expect(common.statusCode).toBe(400);
    expect(common.json().message).toMatch(/too easy/);
    expect((await post("/api/auth/register", { ...base, email: "a3@example.test", nickname: "same_pw", password: "Same_PW" })).statusCode).toBe(400);
    expect((await post("/api/auth/register", { ...base, email: "a4@example.test", nickname: "ok_pw", password: "jollof9" })).statusCode).toBe(201);
  });

  it("signs in with email or nickname, any case", async () => {
    await registerPlayer(app, "Ayo_Hustler");
    const pw = "correct-horse-battery";
    expect((await post("/api/auth/login", { email: "ayo_hustler@example.test", password: pw })).statusCode).toBe(200);
    expect((await post("/api/auth/login", { email: "ayo_HUSTLER", password: pw })).statusCode).toBe(200);
    expect((await post("/api/auth/login", { email: "@Ayo_Hustler", password: pw })).statusCode).toBe(200);
    const wrong = await post("/api/auth/login", { email: "Ayo_Hustler", password: "nope-nope" });
    expect(wrong.statusCode).toBe(401);
    expect((await post("/api/auth/login", { email: "nobody_here", password: pw })).statusCode).toBe(401);
  });

  it("says whether a nickname is free", async () => {
    await registerPlayer(app, "taken_name");
    const check = async (n: string) => (await app.inject({ method: "GET", url: `/api/auth/nickname/${n}`, headers: { origin: ORIGIN } })).json();
    expect(await check("TAKEN_name")).toMatchObject({ ok: false });
    expect(await check("free_name")).toEqual({ ok: true });
    expect((await check("x")).ok).toBe(false);
  });

  it("passes forgot-password requests to the admins, without saying who has an account", async () => {
    const p = await registerPlayer(app, "forgetful");
    const a = await post("/api/auth/forgot", { who: "forgetful" });
    const b = await post("/api/auth/forgot", { who: "no_such_player" });
    expect(a.statusCode).toBe(202);
    expect(b.statusCode).toBe(202);
    expect(a.json()).toEqual(b.json());
    await post("/api/auth/forgot", { who: "forgetful@example.test" });
    const rows = await sql`select kind, message from feedback where user_id = ${p.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "reset" });
  });
});
