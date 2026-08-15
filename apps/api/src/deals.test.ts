// Deals: verified businesses publish at once, players claim one code each, the business redeems it and the
// player is rewarded (a few a day); owners can't claim their own; unverified deals wait for review.
import postgres from "postgres";
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
const sqlRun = async (fn: (sql: postgres.Sql) => Promise<unknown>) => {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await fn(sql);
  await sql.end();
};
async function liveShop(owner: Player, verified: boolean) {
  const biz = (
    await owner.call("POST", "/api/businesses", { kind: "retail", name: "Mama Bisi Provisions", category: "provisions", areas: ["Yaba"], pickupAddress: "12 Herbert Macaulay Way, Yaba", description: "Rice, beans, garri, noodles and drinks every day." })
  ).json();
  await sqlRun((sql) => sql`update businesses set status = 'published', verified_at = ${verified ? new Date() : null} where id = ${biz.id}`);
  return biz.id as string;
}

describe("deals", () => {
  it("claim, redeem at the counter, reward once", async () => {
    const owner = await registerPlayer(app);
    const buyer = await registerPlayer(app);
    const shop = await liveShop(owner, true);
    const created = await owner.call("POST", `/api/businesses/${shop}/deals`, { title: "10% off a bag of rice", terms: "One per customer", days: 14, maxClaims: 50 });
    expect(created.json()).toMatchObject({ status: "live" });
    const deal = (await app.inject({ method: "GET", url: `/api/deals?businessId=${shop}` })).json()[0];
    expect(deal).toMatchObject({ title: "10% off a bag of rice", left: 50 });

    expect((await owner.call("POST", `/api/deals/${deal.id}/claim`)).statusCode).toBe(409); // own deal
    const claim = (await buyer.call("POST", `/api/deals/${deal.id}/claim`)).json();
    expect(claim.code).toMatch(/^HC-[A-Z2-9]{6}$/);
    expect((await buyer.call("POST", `/api/deals/${deal.id}/claim`)).json().code).toBe(claim.code); // same code again

    const before = (await buyer.call("GET", "/api/me")).json();
    const lower = claim.code.toLowerCase().replace("-", " ");
    const used = await owner.call("POST", `/api/businesses/${shop}/redeem`, { code: lower });
    expect(used.json()).toMatchObject({ title: "10% off a bag of rice", rewarded: true });
    const after = (await buyer.call("GET", "/api/me")).json();
    expect(after.coins).toBe(before.coins + 150);
    expect(after.xp).toBe(before.xp + 20);
    expect((await owner.call("POST", `/api/businesses/${shop}/redeem`, { code: claim.code })).statusCode).toBe(409);
    expect((await buyer.call("POST", `/api/businesses/${shop}/redeem`, { code: claim.code })).statusCode).toBe(404);
    const mine = (await buyer.call("GET", "/api/deals/mine")).json();
    expect(mine[0]).toMatchObject({ code: claim.code, businessName: "Mama Bisi Provisions" });
    expect(mine[0].redeemedAt).not.toBeNull();
    const stats = (await owner.call("GET", `/api/businesses/${shop}/deals`)).json();
    expect(stats[0]).toMatchObject({ claimed: 1, redeemed: 1 });
  });

  it("unverified businesses' deals wait for review; limits hold", async () => {
    const owner = await registerPlayer(app);
    const shop = await liveShop(owner, false);
    const d = (await owner.call("POST", `/api/businesses/${shop}/deals`, { title: "Free pure water with any order", days: 7, maxClaims: 1 })).json();
    expect(d.status).toBe("pending_review");
    expect((await app.inject({ method: "GET", url: `/api/deals?businessId=${shop}` })).json()).toEqual([]);
    const mod = await registerPlayer(app);
    await sqlRun((sql) => sql`update users set roles = array['player','admin'] where id = ${mod.id}`);
    expect((await mod.call("POST", `/api/admin/deals/${d.id}/review`, { decision: "approve" })).statusCode).toBe(200);
    const a = await registerPlayer(app);
    const b = await registerPlayer(app);
    expect((await a.call("POST", `/api/deals/${d.id}/claim`)).statusCode).toBe(200);
    expect((await b.call("POST", `/api/deals/${d.id}/claim`)).statusCode).toBe(409); // only 1 code
    await owner.call("POST", `/api/businesses/${shop}/deals`, { title: "Deal number two here", days: 7, maxClaims: 5 });
    await owner.call("POST", `/api/businesses/${shop}/deals`, { title: "Deal number three here", days: 7, maxClaims: 5 });
    expect((await owner.call("POST", `/api/businesses/${shop}/deals`, { title: "Deal number four here", days: 7, maxClaims: 5 })).statusCode).toBe(409);
  });
});
