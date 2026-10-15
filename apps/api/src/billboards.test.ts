// Billboards: booking, admin review and payment, going on air, banner safety, capacity and stats.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer, type Player } from "./test/harness.js";

let app: Awaited<ReturnType<typeof testServer>>;
const fixture = (name: string) => readFileSync(new URL(`../../../packages/shared/src/__fixtures__/${name}`, import.meta.url)).toString("base64");
const BANNER = fixture("banner-lossy.webp");

beforeAll(async () => {
  await prepareDatabase();
  app = await testServer();
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  await resetDatabase();
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`truncate billboards cascade`;
  await sql`insert into billboards (key, name, tier, price_kobo_per_week, capacity) values
    ('junction-101', 'Junction 101 Roundabout', 'mega', 6000000, 12),
    ('tiny', 'Tiny board', 'standard', 2500000, 1)`;
  await sql.end();
});

async function admin() {
  const p = await registerPlayer(app);
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  await sql`update users set roles = array['player','admin'] where id = ${p.id}`;
  await sql.end();
  return p;
}
const book = (p: Player, over: Record<string, unknown> = {}) =>
  p.call("POST", "/api/billboards/ads", { billboardKey: "junction-101", headline: "Fresh suya, Yaba", linkUrl: "https://wa.me/2348000000000", weeks: 2, image: BANNER, agreePolicy: true, ...over });
const board = async (key = "junction-101") =>
  (await app.inject({ method: "GET", url: "/api/billboards" })).json().find((b: { key: string }) => b.key === key);

describe("billboard ads", () => {
  it("goes on air only after admin approval and recorded payment", async () => {
    const shop = await registerPlayer(app);
    const mod = await admin();
    const res = await book(shop);
    expect(res.statusCode).toBe(201);
    const id = res.json().id;

    const mine = async () => (await shop.call("GET", "/api/billboards/ads/mine")).json()[0];
    expect(await mine()).toMatchObject({ status: "in_review", priceKobo: 12_000_000, weeks: 2 });
    expect((await board()).ads).toHaveLength(0);
    expect((await board()).taken).toBe(1);
    // Not on air: the banner is private to the advertiser (and admins).
    expect((await app.inject({ method: "GET", url: `/api/billboards/ads/${id}/image` })).statusCode).toBe(404);
    expect((await shop.call("GET", `/api/billboards/ads/${id}/image`)).statusCode).toBe(200);

    expect((await shop.call("POST", `/api/admin/billboards/ads/${id}/review`, { decision: "approve", reasonCode: "meets_policy" })).statusCode).toBe(403);
    await mod.call("POST", `/api/admin/billboards/ads/${id}/review`, { decision: "approve", reasonCode: "meets_policy" });
    expect(await mine()).toMatchObject({ status: "awaiting_payment" });
    expect((await board()).ads).toHaveLength(0);

    await mod.call("POST", `/api/admin/billboards/ads/${id}/payment`, { reference: "GTB-TRF-0001" });
    expect((await mod.call("POST", `/api/admin/billboards/ads/${id}/payment`, { reference: "GTB-TRF-0001" })).statusCode).toBe(409);
    const live = await mine();
    expect(live.status).toBe("live");
    expect(new Date(live.endsAt).getTime() - new Date(live.startsAt).getTime()).toBe(14 * 86_400_000);
    expect((await board()).ads[0]).toMatchObject({ id, headline: "Fresh suya, Yaba", linkUrl: "https://wa.me/2348000000000" });

    const img = await app.inject({ method: "GET", url: `/api/billboards/ads/${id}/image` });
    expect(img.statusCode).toBe(200);
    expect(img.headers["content-type"]).toBe("image/webp");
    expect(img.headers["x-content-type-options"]).toBe("nosniff");

    // Stats: batched views from players, clicks, both in the advertiser's report.
    await shop.call("POST", "/api/billboards/views", { views: { [id]: 5 } });
    await shop.call("POST", "/api/billboards/views", { views: { [id]: 3 } });
    await app.inject({ method: "POST", url: `/api/billboards/ads/${id}/click`, headers: { origin: "http://localhost:5190" } });
    expect(await mine()).toMatchObject({ views: 8, clicks: 1 });
    expect((await shop.call("POST", "/api/billboards/views", { views: { [id]: 500 } })).statusCode).toBe(400);
  });

  it("accepts only real 1200×400 images and https links", async () => {
    const p = await registerPlayer(app);
    expect((await book(p, { image: fixture("banner.png") })).statusCode).toBe(201);
    expect((await book(p, { image: fixture("banner.jpg") })).statusCode).toBe(201);
    expect((await book(p, { image: fixture("square.png") })).json().error).toBe("wrong_size");
    expect((await book(p, { image: Buffer.from("<svg onload=alert(1)></svg>").toString("base64") })).json().error).toBe("invalid_image");
    expect((await book(p, { linkUrl: "javascript:alert(1)" })).json().error).toBe("invalid_link");
    expect((await book(p, { linkUrl: "http://example.com" })).json().error).toBe("invalid_link");
    expect((await book(p, { agreePolicy: false })).statusCode).toBe(400);
    expect((await book(p, { weeks: 9 })).statusCode).toBe(400);
  });

  it("caps a board and never lets two bookings take its last place", async () => {
    const a = await registerPlayer(app);
    const b = await registerPlayer(app);
    const results = await Promise.all([book(a, { billboardKey: "tiny" }), book(b, { billboardKey: "tiny" })]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);

    // A rejected ad frees its place.
    const mod = await admin();
    const winner = results.find((r) => r.statusCode === 201)!.json().id;
    await mod.call("POST", `/api/admin/billboards/ads/${winner}/review`, { decision: "reject", reasonCode: "gambling_or_schemes", note: "No betting ads" });
    expect((await book(a, { billboardKey: "tiny" })).statusCode).toBe(201);
  });

  it("only counts views and clicks for ads on air", async () => {
    const p = await registerPlayer(app);
    const id = (await book(p)).json().id;
    await p.call("POST", "/api/billboards/views", { views: { [id]: 5 } });
    expect((await app.inject({ method: "POST", url: `/api/billboards/ads/${id}/click`, headers: { origin: "http://localhost:5190" } })).statusCode).toBe(404);
    expect((await p.call("GET", "/api/billboards/ads/mine")).json()[0]).toMatchObject({ views: 0, clicks: 0 });
  });
});
