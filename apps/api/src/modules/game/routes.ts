import { gameLedgerEntries, profiles } from "@hc/db";
import { LOCATION_KEYS, type LeaderboardRow } from "@hc/shared";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lockProfile } from "../../lib/db.js";
import { requireUser } from "../../plugins/auth.js";
import { claimQuest, questBoard, recordEvents } from "./quests.js";
import { collectTakings, fulfilOrder, getShop, restock, setPrice, type ShopCtx } from "./shop.js";

const visitBody = z.object({ location: z.string().refine((l) => LOCATION_KEYS.includes(l), "Unknown location") });
const restockBody = z.object({ itemKey: z.string(), units: z.number().int(), requestId: z.uuid() });
const priceBody = z.object({ itemKey: z.string(), price: z.number().int() });
const orderBody = z.object({ slot: z.number().int() });

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
}
