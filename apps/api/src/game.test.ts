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

    // Price it at the maximum first so a 10-minute sales tick during the test can't sell the stock.
    const item = STOCK_ITEMS_BY_KEY.get(order.itemKey)!;
    await p.call("POST", "/api/game/shop/price", { itemKey: order.itemKey, price: Math.floor(item.referencePrice * 5) });
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


describe("buy mode (decorate)", () => {
  const buy = (p: Awaited<ReturnType<typeof registerPlayer>>, body: Record<string, unknown>) =>
    p.call("POST", "/api/game/decor/buy", { rotation: 0, requestId: randomUUID(), ...body });

  it("charges once per request id, places the item and raises appeal", async () => {
    const p = await registerPlayer(app);
    const requestId = randomUUID();
    const first = await buy(p, { itemKey: "standing_fan", x: 0, y: 0, requestId });
    expect(first.statusCode).toBe(200);
    expect((await buy(p, { itemKey: "standing_fan", x: 0, y: 0, requestId })).statusCode).toBe(200);
    expect(await coins(p)).toBe(2000 - 300);
    const view = (await p.call("GET", "/api/game/decor")).json();
    expect(view.placements).toHaveLength(1);
    expect(view.appeal).toBe(2);
    expect(view.boost).toBeCloseTo(0.02);
  });

  it("rejects overlaps, off-floor spots and unaffordable items", async () => {
    const p = await registerPlayer(app);
    await buy(p, { itemKey: "plastic_chair", x: 2, y: 2 });
    expect((await buy(p, { itemKey: "plastic_chair", x: 2, y: 2 })).statusCode).toBe(400);
    expect((await buy(p, { itemKey: "generator", x: 7, y: 0 })).statusCode).toBe(400);
    expect((await buy(p, { itemKey: "adire_sofa_set", x: 4, y: 3 })).statusCode).toBe(422); // 2,500 > balance
  });

  it("lets only one of two concurrent buys take the same tile", async () => {
    const p = await registerPlayer(app);
    const results = await Promise.all([buy(p, { itemKey: "bucket_set", x: 5, y: 5 }), buy(p, { itemKey: "bucket_set", x: 5, y: 5 })]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 400]);
    expect(await coins(p)).toBe(2000 - 80);
  });

  it("moves, rotates and sells for half price", async () => {
    const p = await registerPlayer(app);
    const placed = (await buy(p, { itemKey: "plastic_chair", x: 0, y: 0 })).json();
    const id = placed.placements[0].id;
    const moved = await p.call("POST", `/api/game/decor/${id}/move`, { x: 3, y: 1, rotation: 2 });
    expect(moved.json().placements[0]).toMatchObject({ x: 3, y: 1, rotation: 2 });
    const sold = await p.call("POST", `/api/game/decor/${id}/sell`);
    expect(sold.json().placements).toHaveLength(0);
    expect(await coins(p)).toBe(2000 - 150 + 75);
    expect((await p.call("POST", `/api/game/decor/${id}/sell`)).statusCode).toBe(404);
  });
});

describe("map neighbours", () => {
  it("returns my shop first and other players' shops, hiding moderated names", async () => {
    const me = await registerPlayer(app, "map_me");
    const other = await registerPlayer(app, "map_other");
    const sql = postgres(TEST_DATABASE_URL, { max: 1 });
    await sql`update profiles set nickname_hidden = true where user_id = ${other.id}`;
    await sql.end();
    const list = (await me.call("GET", "/api/game/neighbours")).json();
    expect(list[0]).toMatchObject({ nickname: "map_me", isMe: true });
    const theirs = list.find((s: { isMe: boolean }) => !s.isMe);
    expect(theirs).toMatchObject({ nickname: "A player", shopName: "A Junction 101 shop", isMe: false });
  });
});

describe("dream progress", () => {
  it("counts served customers and pays each step reward once", async () => {
    const p = await registerPlayer(app);
    const empty = (await p.call("GET", "/api/game/dream")).json();
    expect(empty).toMatchObject({ key: "market_royalty", value: 0, target: 100 });
    expect((await p.call("POST", "/api/game/dream/claim", { at: 10 })).statusCode).toBe(422);

    // Serve 12 customers (seeded directly: one order per 30-minute slot).
    const sql = postgres(TEST_DATABASE_URL, { max: 1 });
    const [shop] = await sql`select id from sim_shops where owner_id = ${p.id}`;
    for (let slot = 1; slot <= 12; slot++) {
      await sql`insert into sim_orders (shop_id, slot, item_key, units, offer) values (${shop!.id}, ${slot}, 'pure_water', 1, 10)`;
    }
    await sql.end();

    const dream = (await p.call("GET", "/api/game/dream")).json();
    expect(dream.value).toBe(12);
    expect(dream.steps[0]).toMatchObject({ at: 10, reached: true, claimed: false });

    const before = await coins(p);
    const claim = await p.call("POST", "/api/game/dream/claim", { at: 10 });
    expect(claim.statusCode).toBe(200);
    expect(claim.json().dream.steps[0].claimed).toBe(true);
    expect(await coins(p)).toBe(before + 100);
    expect((await p.call("POST", "/api/game/dream/claim", { at: 10 })).statusCode).toBe(409);
    expect((await p.call("POST", "/api/game/dream/claim", { at: 25 })).statusCode).toBe(422);
    expect(await coins(p)).toBe(before + 100);
  });

  it("ranks Junction Legend on finished Lagos weeks only", async () => {
    const me = await registerPlayer(app);
    const rival = await registerPlayer(app);
    const sql = postgres(TEST_DATABASE_URL, { max: 1 });
    await sql`update profiles set dream = 'junction_legend' where user_id = ${me.id}`;
    const lastWeek = sql`now() - interval '8 days'`;
    await sql`insert into game_ledger_entries (user_id, amount, balance_after, kind, reference, created_at) values
      (${me.id}, 500, 2500, 'order', 'test:me', ${lastWeek}),
      (${rival.id}, 300, 2300, 'order', 'test:rival', ${lastWeek}),
      (${rival.id}, 900, 3200, 'order', 'test:rival-now', now())`;
    await sql.end();

    const dream = (await me.call("GET", "/api/game/dream")).json();
    expect(dream.key).toBe("junction_legend");
    expect(dream.steps.map((s: { reached: boolean }) => s.reached)).toEqual([true, true, true]);
    const rivalView = (await rival.call("GET", "/api/game/dream")).json();
    expect(rivalView.key).toBe("market_royalty");
  });
});
