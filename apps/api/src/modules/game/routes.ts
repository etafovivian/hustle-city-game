import { gameLedgerEntries, profiles, shopDecor, simShops, users } from "@hc/db";
import { AREA_BOYS_OPTIONS, HAGGLE_TRIES, askPrice, dayKey, haggleFloor, isOpenAt, lagosHourOf, VENUES_BY_KEY, type HaggleResult, DECOR_BY_KEY, LOCATION_KEYS, RIDE_MODES, type LeaderboardRow, type NeighbourShop } from "@hc/shared";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lockProfile } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { requireUser } from "../../plugins/auth.js";
import { claimQuest, questBoard, recordEvents } from "./quests.js";
import { buyDecor, getDecor, moveDecor, sellDecor } from "./decor.js";
import { claimDreamStep, getDream } from "./dream.js";
import { visitShop } from "./visit.js";
import { doActivity, doFree, venueDay } from "./venues.js";
import { loadNeeds, needsView } from "./needs.js";
import { settleStop, startDrive, startRide, startTransit } from "./rides.js";
import { collectTakings, fulfilOrder, getShop, restock, setPrice, stockFromMarket, type ShopCtx } from "./shop.js";

const visitBody = z.object({ location: z.string().refine((l) => LOCATION_KEYS.includes(l), "Unknown location") });
const restockBody = z.object({ itemKey: z.string(), units: z.number().int(), requestId: z.uuid() });
const priceBody = z.object({ itemKey: z.string(), price: z.number().int() });
const orderBody = z.object({ slot: z.number().int() });
const decorBuyBody = z.object({
  itemKey: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  rotation: z.number().int(),
  requestId: z.uuid(),
});
const rideBody = z.object({
  mode: z.enum(["own", "transit", ...RIDE_MODES.map((m) => m.mode)] as [string, ...string[]]),
  units: z.number().int(),
  vehicle: z.enum(["bike", "keke", "saloon", "suv"]).optional(),
  transit: z.enum(["brt", "rail", "ferry", "coach"]).optional(),
  line: z.string().max(40).optional(),
});
const stopBody = z.object({ choice: z.enum(AREA_BOYS_OPTIONS.map((o) => o.choice) as [string, ...string[]]) });
const dreamClaimBody = z.object({ at: z.number().int().positive() });
const decorMoveBody = z.object({ x: z.number().int(), y: z.number().int(), rotation: z.number().int() });

export async function gameRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;

  /** Run a player-scoped mutation in one transaction. */
  const inTx = <T>(userId: string, fn: (ctx: ShopCtx) => Promise<T>) =>
    app.db.transaction((tx) => fn({ tx, userId, now: new Date(), timeZone: tz }));

  app.post("/api/game/visit", async (request) => {
    const user = requireUser(request);
    const { location } = visitBody.parse(request.body);
    return inTx(user.id, async ({ tx, now }) => {
      await lockProfile(tx, user.id);
      await recordEvents(tx, user.id, [{ type: "location_visited", key: location }], now, tz);
      return questBoard(tx, user.id, now, tz);
    });
  });

  app.get("/api/game/quests", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, ({ tx, now }) => questBoard(tx, user.id, now, tz));
  });

  app.post<{ Params: { key: string } }>("/api/game/quests/:key/claim", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, async ({ tx, now }) => {
      await claimQuest(tx, user.id, request.params.key, now, tz);
      return questBoard(tx, user.id, now, tz);
    });
  });

  app.get("/api/game/shop", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, getShop);
  });

  app.post("/api/game/shop/restock", async (request) => {
    const user = requireUser(request);
    const body = restockBody.parse(request.body);
    return inTx(user.id, (ctx) => restock(ctx, body.itemKey, body.units, body.requestId));
  });

  app.post("/api/game/shop/price", async (request) => {
    const user = requireUser(request);
    const body = priceBody.parse(request.body);
    return inTx(user.id, (ctx) => setPrice(ctx, body.itemKey, body.price));
  });

  app.post("/api/game/shop/collect", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, collectTakings);
  });

  app.post("/api/game/shop/order", async (request) => {
    const user = requireUser(request);
    const { slot } = orderBody.parse(request.body);
    return inTx(user.id, (ctx) => fulfilOrder(ctx, slot));
  });

  // Buy mode: decorate the shop floor.
  app.get("/api/game/decor", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, getDecor);
  });

  app.post("/api/game/decor/buy", async (request) => {
    const user = requireUser(request);
    const { requestId, ...p } = decorBuyBody.parse(request.body);
    return inTx(user.id, (ctx) => buyDecor(ctx, p, requestId));
  });

  app.post<{ Params: { id: string } }>("/api/game/decor/:id/move", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const to = decorMoveBody.parse(request.body);
    return inTx(user.id, (ctx) => moveDecor(ctx, id, to));
  });

  app.post<{ Params: { id: string } }>("/api/game/decor/:id/sell", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    return inTx(user.id, (ctx) => sellDecor(ctx, id));
  });

  // Dream progress: the long goal picked in onboarding, with step rewards.
  app.get("/api/game/dream", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, getDream);
  });

  app.post("/api/game/dream/claim", async (request) => {
    const user = requireUser(request);
    const { at } = dreamClaimBody.parse(request.body);
    return inTx(user.id, (ctx) => claimDreamStep(ctx, at));
  });

  // Venues: today's done activities, and doing one (costs coins, gives XP once per Lagos day).
  app.get("/api/game/venues/today", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, venueDay);
  });

  app.post<{ Params: { venue: string; activity: string } }>("/api/game/venues/:venue/:activity", async (request) => {
    const user = requireUser(request);
    const { venue, activity } = request.params;
    return inTx(user.id, (ctx) => doActivity(ctx, venue.slice(0, 40), activity.slice(0, 40)));
  });

  // Visit a player's shop (read-only); counts towards the "Neighbourly" quest.
  app.post<{ Params: { id: string } }>("/api/game/shops/:id/visit", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    return inTx(user.id, (ctx) => visitShop(ctx, id));
  });

  // Player shops for the map: the caller's own shop plus the most recently active others.
  app.get("/api/game/neighbours", async (request): Promise<NeighbourShop[]> => {
    const user = requireUser(request);
    const rows = await app.db
      .select({
        shopId: simShops.id,
        shopName: simShops.name,
        userId: simShops.ownerId,
        nickname: profiles.nickname,
        hidden: profiles.nicknameHidden,
        hustle: profiles.hustle,
      })
      .from(simShops)
      .innerJoin(profiles, eq(profiles.userId, simShops.ownerId))
      .innerJoin(users, eq(users.id, simShops.ownerId))
      .where(eq(users.status, "active"))
      .orderBy(desc(profiles.updatedAt))
      .limit(40);
    const mine = rows.filter((r) => r.userId === user.id);
    const others = rows.filter((r) => r.userId !== user.id).slice(0, 9);
    const picked = [...mine, ...others];
    if (!picked.length) return [];
    const decor = await app.db
      .select({ shopId: shopDecor.shopId, itemKey: shopDecor.itemKey })
      .from(shopDecor)
      .where(inArray(shopDecor.shopId, picked.map((r) => r.shopId)));
    return picked.map((r) => ({
      shopId: r.shopId,
      // Hidden (moderated) names never reach other players.
      shopName: r.hidden && r.userId !== user.id ? "A Junction 101 shop" : r.shopName,
      nickname: r.hidden && r.userId !== user.id ? "A player" : r.nickname,
      hustle: r.hustle,
      appeal: decor.filter((d) => d.shopId === r.shopId).reduce((s, d) => s + (DECOR_BY_KEY.get(d.itemKey)?.appeal ?? 0), 0),
      isMe: r.userId === user.id,
    }));
  });

  // Weekly gameplay standings: City Coins earned from sales this week (Lagos time).
  // Computed server-side and independent of any real NGN earnings (FR03).
  app.get("/api/game/leaderboard", async (request) => {
    const user = requireUser(request);
    const weekStart = sql`(date_trunc('week', now() at time zone ${tz}) at time zone ${tz})`;
    const earned = sql<number>`sum(${gameLedgerEntries.amount})::bigint`.mapWith(Number);

    const rows = await app.db
      .select({ userId: gameLedgerEntries.userId, nickname: profiles.nickname, hidden: profiles.nicknameHidden, earned })
      .from(gameLedgerEntries)
      .innerJoin(profiles, eq(profiles.userId, gameLedgerEntries.userId))
      .where(and(inArray(gameLedgerEntries.kind, ["takings", "order"]), gte(gameLedgerEntries.createdAt, weekStart)))
      .groupBy(gameLedgerEntries.userId, profiles.nickname, profiles.nicknameHidden)
      .orderBy(desc(earned))
      .limit(20);

    await inTx(user.id, async ({ tx, now }) => {
      await lockProfile(tx, user.id);
      await recordEvents(tx, user.id, [{ type: "leaderboard_viewed" }], now, tz);
    });

    return rows.map(
      (r, i): LeaderboardRow => ({
        rank: i + 1,
        nickname: r.hidden ? "Hidden player" : r.nickname,
        coinsEarned: r.earned,
        isMe: r.userId === user.id,
      }),
    );
  });

  app.post("/api/game/rides", async (request) => {
    const user = requireUser(request);
    const { mode, units, vehicle, transit, line } = rideBody.parse(request.body);
    if (mode === "transit") return inTx(user.id, (ctx) => startTransit(ctx, transit ?? "brt", units, line));
    if (mode === "own") return inTx(user.id, (ctx) => startDrive(ctx, vehicle ?? "bike", units));
    return inTx(user.id, (ctx) => startRide(ctx, mode as never, units));
  });

  app.post<{ Params: { id: string } }>("/api/game/rides/:id/stop", async (request) => {
    const user = requireUser(request);
    const { choice } = stopBody.parse(request.body);
    const id = z.uuid().parse(request.params.id);
    return inTx(user.id, (ctx) => settleStop(ctx, id, choice as never));
  });

  app.get("/api/game/needs", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, async ({ tx, now }) => needsView((await loadNeeds(tx, user.id, now)).needs));
  });

  app.post<{ Params: { venue: string } }>("/api/game/venues/:venue/free", async (request) => {
    const user = requireUser(request);
    return inTx(user.id, (ctx) => doFree(ctx, request.params.venue.slice(0, 40)));
  });

  // ── Balogun Market: haggle for wholesale stock (the floor stays on the server) ──
  const tries = new Map<string, number>();
  const haggleBody = z.object({ itemKey: z.string().max(40), units: z.number().int().min(1).max(500), offer: z.number().int().min(1), requestId: z.uuid() });
  app.post("/api/market/haggle", { config: { rateLimit: { max: 30 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } }, async (request): Promise<HaggleResult & { shop?: unknown }> => {
    const user = requireUser(request);
    const { itemKey, units, offer, requestId } = haggleBody.parse(request.body);
    const now = new Date();
    const market = VENUES_BY_KEY.get("balogun_market")!;
    if (!isOpenAt(market, lagosHourOf(now))) throw new AppError(409, "closed", "The market is closed. Traders are back at 7am.");
    const day = dayKey(now, tz);
    const floor = haggleFloor(user.id, day, itemKey, units);
    const ask = askPrice(itemKey, units);
    if (floor === null || ask === null) throw new AppError(404, "not_found", "Nobody sells that here.");
    const key = `${user.id}|${day}|${itemKey}`;
    const used = tries.get(key) ?? 0;
    if (used >= HAGGLE_TRIES) throw new AppError(409, "no_more", "This trader has heard enough from you today. Try another item or come back tomorrow.");
    if (offer >= floor) {
      // A deal: pay what you offered (never more than the ask).
      const paid = Math.min(offer, ask);
      const shop = await inTx(user.id, (ctx) => stockFromMarket(ctx, itemKey, units, paid, requestId));
      return { result: "deal", paid, saved: Math.round((ask / 1.1) - paid), triesLeft: HAGGLE_TRIES - used, shop };
    }
    tries.set(key, used + 1);
    const left = HAGGLE_TRIES - used - 1;
    if (offer < floor * 0.8) return { result: "walked", line: "Ah! Customer, you wan kill me? Go and come back.", triesLeft: left };
    const counter = Math.max(floor, Math.round((offer + ask) / 2));
    return { result: "counter", counter, line: `My last price na ${counter}. Last last.`, triesLeft: left };
  });
}
