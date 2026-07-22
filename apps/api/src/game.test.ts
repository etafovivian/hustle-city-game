import { randomUUID } from "node:crypto";
import { STOCK_ITEMS_BY_KEY, orderSlotIndex, type QuestBoard, type ShopView } from "@hc/shared";
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

const coins = async (p: { call: (m: "GET", u: string) => Promise<{ json: () => { coins: number } }> }) =>
  (await p.call("GET", "/api/me")).json().coins;

describe("registration and profile", () => {
  it("grants 2,000 starting City Coins and opens the shop with the hustle's free starter stock", async () => {
    const p = await registerPlayer(app);
    expect(await coins(p)).toBe(2000);
    const shop = (await p.call("GET", "/api/game/shop")).json() as ShopView;
    expect(shop.lines.find((l) => l.itemKey === "phone_case")!.quantity).toBe(1);
    expect(shop.lines.filter((l) => l.itemKey !== "phone_case").every((l) => l.quantity === 0)).toBe(true);
    const me = (await p.call("GET", "/api/me")).json();
    expect(me.hustle).toBe("artisan");
    expect(me.dream).toBe("market_royalty");
  });

  it("stores onboarding choices and names the shop", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        email: "chop@example.test",
        password: "correct-horse-battery",
        nickname: "chop_queen",
        hustle: "chop",
        dream: "showroom",
        shopName: "Mama Put Deluxe",
        confirmAdult: true,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ hustle: "chop", dream: "showroom", coins: 2000 });
    const cookie = String(res.headers["set-cookie"]).split(";")[0]!;
    const shop = (await app.inject({ method: "GET", url: "/api/game/shop", headers: { cookie } })).json() as ShopView;
    expect(shop.name).toBe("Mama Put Deluxe");
    expect(shop.lines.find((l) => l.itemKey === "puff_puff")!.quantity).toBe(10);
  });

  it("rejects unknown hustles, dreams and bad shop names", async () => {
    const base = { email: "x@example.test", password: "correct-horse-battery", nickname: "xplayer", confirmAdult: true };
    for (const extra of [{ hustle: "oil_baron" }, { dream: "lottery" }, { shopName: "<script>" }]) {
      const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { ...base, ...extra } });
      expect(res.statusCode).toBe(400);
    }
  });

  it("rejects duplicate nicknames case-insensitively and requires adult confirmation", async () => {
    await registerPlayer(app, "Ada_Lagos");
    const dup = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "other@example.test", password: "correct-horse-battery", nickname: "ada_lagos", confirmAdult: true },
    });
    expect(dup.statusCode).toBe(409);
    const minor = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "kid@example.test", password: "correct-horse-battery", nickname: "kiddo", confirmAdult: false },
    });
    expect(minor.statusCode).toBe(400);
  });

  it("requires a session for game endpoints", async () => {
    const res = await app.inject({ method: "GET", url: "/api/game/shop" });
    expect(res.statusCode).toBe(401);
  });

  it("blocks cross-origin mutations", async () => {
    const p = await registerPlayer(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/game/shop/collect",
      headers: { cookie: p.cookie, origin: "https://evil.example" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("simulated shop economy", () => {
  it("charges wholesale cost once per restock request id", async () => {
    const p = await registerPlayer(app);
    const water = STOCK_ITEMS_BY_KEY.get("pure_water")!;
    const requestId = randomUUID();
    const first = await p.call("POST", "/api/game/shop/restock", { itemKey: water.key, units: 10, requestId });
    expect(first.statusCode).toBe(200);
    const replay = await p.call("POST", "/api/game/shop/restock", { itemKey: water.key, units: 10, requestId });
    expect(replay.statusCode).toBe(200);

    expect(await coins(p)).toBe(2000 - 10 * water.wholesaleCost);
    const line = (replay.json() as ShopView).lines.find((l) => l.itemKey === water.key)!;
    expect(line.quantity).toBe(10);
  });

  it("never lets concurrent restocks overspend the balance", async () => {
    const p = await registerPlayer(app);
    const tooDear = await p.call("POST", "/api/game/shop/restock", { itemKey: "power_bank", units: 1, requestId: randomUUID() });
    expect(tooDear.statusCode).toBe(422); // 2,500 > 2,000

    // Each restock costs 1,200 of the 2,000 balance; only one of three concurrent requests can succeed.
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        p.call("POST", "/api/game/shop/restock", { itemKey: "earpiece", units: 2, requestId: randomUUID() }),
      ),
    );
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 422)).toHaveLength(2);
    expect(await coins(p)).toBe(2000 - 1200);
  });

  it("validates prices on the server", async () => {
    const p = await registerPlayer(app);
    const bad = await p.call("POST", "/api/game/shop/price", { itemKey: "pure_water", price: 999999 });
    expect(bad.statusCode).toBe(400);
    const ok = await p.call("POST", "/api/game/shop/price", { itemKey: "pure_water", price: 60 });
    expect((ok.json() as ShopView).lines.find((l) => l.itemKey === "pure_water")!.price).toBe(60);
  });

  it("fulfils the current customer order once and pays the offer", async () => {
    const p = await registerPlayer(app);
    const shop = (await p.call("GET", "/api/game/shop")).json() as ShopView;
    const order = shop.order!;
    expect(order.slot).toBe(orderSlotIndex(new Date()));

    const short = await p.call("POST", "/api/game/shop/order", { slot: order.slot });
    expect(short.statusCode).toBe(422); // no stock yet

    await p.call("POST", "/api/game/shop/restock", { itemKey: order.itemKey, units: order.units, requestId: randomUUID() });
    const before = await coins(p);
    const done = await p.call("POST", "/api/game/shop/order", { slot: order.slot });
    expect(done.statusCode).toBe(200);
    expect(await coins(p)).toBe(before + order.offer);

    const again = await p.call("POST", "/api/game/shop/order", { slot: order.slot });
    expect(again.statusCode).toBe(409);
    expect(await coins(p)).toBe(before + order.offer);
  });

  it("rejects stale order slots", async () => {
    const p = await registerPlayer(app);
    const res = await p.call("POST", "/api/game/shop/order", { slot: orderSlotIndex(new Date()) - 5 });
    expect(res.statusCode).toBe(410);
  });
});

describe("quests", () => {
  it("completes and claims the intro quest exactly once", async () => {
    const p = await registerPlayer(app);
    expect((await p.call("POST", "/api/game/quests/intro/claim")).statusCode).toBe(422);

    for (const location of ["market_square", "work_hub", "hangout", "hangout"]) {
      await p.call("POST", "/api/game/visit", { location });
    }
    const shop = (await p.call("GET", "/api/game/shop")).json() as ShopView;
    await p.call("POST", "/api/game/shop/restock", { itemKey: shop.order!.itemKey, units: shop.order!.units, requestId: randomUUID() });
    await p.call("POST", "/api/game/shop/order", { slot: shop.order!.slot });

    const board = (await p.call("GET", "/api/game/quests")).json() as QuestBoard;
    expect(board.intro.steps.map((s) => s.progress)).toEqual([3, 1]);

    const before = await coins(p);
    expect((await p.call("POST", "/api/game/quests/intro/claim")).statusCode).toBe(200);
    expect(await coins(p)).toBe(before + 500);
    expect((await p.call("POST", "/api/game/quests/intro/claim")).statusCode).toBe(409);
  });

  it("rejects unknown visit locations and quests not active today", async () => {
    const p = await registerPlayer(app);
    expect((await p.call("POST", "/api/game/visit", { location: "secret_vault" })).statusCode).toBe(400);
    expect((await p.call("POST", "/api/game/quests/not_a_quest/claim")).statusCode).toBe(404);
  });
});

describe("roles and integrity", () => {
  it("forbids players from admin endpoints", async () => {
    const p = await registerPlayer(app);
    const other = await registerPlayer(app);
    const res = await p.call("POST", `/api/admin/users/${other.id}/hide-nickname`, { reasonCode: "spam" });
    expect(res.statusCode).toBe(403);
  });

  it("keeps the coin ledger and audit log append-only", async () => {
    await registerPlayer(app);
    const sql = postgres(TEST_DATABASE_URL, { max: 1 });
    await expect(sql`update game_ledger_entries set amount = 999999`).rejects.toThrow(/append-only/);
    await expect(sql`delete from game_ledger_entries`).rejects.toThrow(/append-only/);
    await sql.end();
  });

  it("allows market browsing without signing in", async () => {
    const res = await app.inject({ method: "GET", url: "/api/market/businesses" });
    expect(res.statusCode).toBe(200);
  });
});

