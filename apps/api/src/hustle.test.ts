// The hustle board: escrow on posting, taking, finishing after the minimum time, paying once, auto-pay, cancels,
// reports that hide a job, disputes settled by an admin, and the text and account limits.
import { HUSTLE_RULES } from "@hc/shared";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer, type Player } from "./test/harness.js";

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

/** A player with some XP and coins (new accounts can't use the board). */
async function player(coins = 20_000) {
  const p = await registerPlayer(app);
  await sql`update profiles set xp = 50, coin_balance = ${coins} where user_id = ${p.id}`;
  return p;
}
const coins = async (p: Player) => (await p.call("GET", "/api/me")).json().coins as number;
const post = (p: Player, over: Record<string, unknown> = {}) => p.call("POST", "/api/hustle", { kind: "cook", title: "Jollof for my birthday", details: "Party at my place on Saturday", fee: 1500, ...over });
/** Pretend the worker took the job `minutes` ago (so it can be marked done). */
const backdate = (id: string, field: "taken_at" | "done_at", hours: number) => sql`update hustle_jobs set ${sql(field)} = now() - make_interval(secs => ${hours * 3600}) where id = ${id}`;

describe("hustle board", () => {
  it("holds the fee, and pays the worker once when the poster confirms", async () => {
    const poster = await player();
    const worker = await player();
    const job = (await post(poster)).json();
    expect(job).toMatchObject({ status: "open", fee: 1500, mine: true });
    expect(await coins(poster)).toBe(20_000 - 1500);

    expect((await worker.call("POST", `/api/hustle/${job.id}/take`)).json()).toMatchObject({ status: "taken", working: true });
    expect((await poster.call("POST", `/api/hustle/${job.id}/take`)).statusCode).toBe(409);
    // Too soon to be done: the job takes at least 10 minutes.
    expect((await worker.call("POST", `/api/hustle/${job.id}/done`)).statusCode).toBe(409);
    await backdate(job.id, "taken_at", 1);
    expect((await worker.call("POST", `/api/hustle/${job.id}/done`)).json()).toMatchObject({ status: "done" });
    // Only the poster confirms.
    expect((await worker.call("POST", `/api/hustle/${job.id}/confirm`)).statusCode).toBe(404);
    expect((await poster.call("POST", `/api/hustle/${job.id}/confirm`)).json()).toMatchObject({ status: "paid" });
    expect((await poster.call("POST", `/api/hustle/${job.id}/confirm`)).statusCode).toBe(409);
    expect(await coins(worker)).toBe(20_000 + 1500);
    const skills = (await worker.call("GET", "/api/game/skills")).json();
    expect(skills.cooking.points).toBe(HUSTLE_RULES.skillPoints);
  });

  it("pays on its own a day after it's marked done, and refunds a cancelled open job", async () => {
    const poster = await player();
    const worker = await player();
    const job = (await post(poster, { kind: "errand", title: "Buy me pure water", fee: 600 })).json();
    await worker.call("POST", `/api/hustle/${job.id}/take`);
    await backdate(job.id, "taken_at", 1);
    await worker.call("POST", `/api/hustle/${job.id}/done`);
    await backdate(job.id, "done_at", HUSTLE_RULES.autoPayHours + 1);
    const board = (await worker.call("GET", "/api/hustle")).json();
    expect(board.mine.find((j: { id: string }) => j.id === job.id).status).toBe("paid");
    expect(await coins(worker)).toBe(20_000 + 600);

    const other = (await post(poster, { title: "Cook egusi", fee: 2000 })).json();
    const before = await coins(poster);
    expect((await poster.call("POST", `/api/hustle/${other.id}/cancel`)).json()).toMatchObject({ status: "cancelled" });
    expect(await coins(poster)).toBe(before + 2000);
    expect((await poster.call("POST", `/api/hustle/${other.id}/cancel`)).statusCode).toBe(409);
  });

  it("lets a poster cancel a no-show, and a worker drop a job back on the board", async () => {
    const poster = await player();
    const worker = await player();
    const job = (await post(poster)).json();
    await worker.call("POST", `/api/hustle/${job.id}/take`);
    expect((await poster.call("POST", `/api/hustle/${job.id}/cancel`)).statusCode).toBe(409);
    expect((await worker.call("POST", `/api/hustle/${job.id}/drop`)).json()).toMatchObject({ status: "open", worker: null });
    await worker.call("POST", `/api/hustle/${job.id}/take`);
    await backdate(job.id, "taken_at", HUSTLE_RULES.noShowHours + 1);
    expect((await poster.call("POST", `/api/hustle/${job.id}/cancel`)).json()).toMatchObject({ status: "cancelled" });
    expect(await coins(poster)).toBe(20_000);
  });

  it("holds a disputed fee until an admin decides", async () => {
    const poster = await player();
    const worker = await player();
    const admin = await player();
    await sql`update users set roles = array['player','admin'] where id = ${admin.id}`;
    const job = (await post(poster, { kind: "dj", title: "DJ my owambe", fee: 3000 })).json();
    await worker.call("POST", `/api/hustle/${job.id}/take`);
    await backdate(job.id, "taken_at", 1);
    await worker.call("POST", `/api/hustle/${job.id}/done`);
    expect((await poster.call("POST", `/api/hustle/${job.id}/dispute`)).json()).toMatchObject({ status: "disputed" });
    expect((await poster.call("GET", "/api/admin/hustle")).statusCode).toBe(403);
    expect((await admin.call("GET", "/api/admin/hustle")).json().map((j: { id: string }) => j.id)).toContain(job.id);
    expect((await admin.call("POST", `/api/admin/hustle/${job.id}/resolve`, { decision: "pay" })).statusCode).toBe(200);
    expect(await coins(worker)).toBe(20_000 + 3000);
    expect((await admin.call("POST", `/api/admin/hustle/${job.id}/resolve`, { decision: "refund" })).statusCode).toBe(409);
  });

  it("hides a job after enough reports, refunding the poster", async () => {
    const poster = await player();
    const job = (await post(poster)).json();
    for (let i = 0; i < HUSTLE_RULES.hideAfterReports; i++) {
      const r = await player();
      expect((await r.call("POST", `/api/hustle/${job.id}/report`, { reason: "Looks like a scam" })).statusCode).toBe(200);
    }
    const board = (await poster.call("GET", "/api/hustle")).json();
    expect(board.open.find((j: { id: string }) => j.id === job.id)).toBeUndefined();
    expect(board.mine.find((j: { id: string }) => j.id === job.id).status).toBe("removed");
    expect(await coins(poster)).toBe(20_000);
  });

  it("blocks scam text, brand-new accounts, broke posters and too many posts", async () => {
    const poster = await player();
    expect((await post(poster, { details: "DM me on whatsapp 08031234567" })).statusCode).toBe(400);
    expect((await post(poster, { details: "Pay with bank transfer" })).statusCode).toBe(400);
    expect((await post(poster, { title: "Need a girlfriend" })).statusCode).toBe(400);
    expect((await post(poster, { details: "visit www.scam.com" })).statusCode).toBe(400);
    const newbie = await registerPlayer(app);
    expect((await post(newbie)).statusCode).toBe(403);
    const broke = await player(100);
    expect((await post(broke, { fee: 5000 })).statusCode).toBe(422);
    for (let i = 0; i < HUSTLE_RULES.maxOpenPosts; i++) expect((await post(poster, { title: `Job number ${i}` })).statusCode).toBe(201);
    expect((await post(poster, { title: "One too many" })).statusCode).toBe(409);
    expect((await post(poster, { fee: 50 })).statusCode).toBe(400);
  });
});
