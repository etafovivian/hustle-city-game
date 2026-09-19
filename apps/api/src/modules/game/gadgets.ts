// Gadget Village: buy a better phone or accessories (at the tag price or by haggling), and fix a cracked screen.
// What you own is in player_items; a cracked screen is the CRACKED row. Coins move with postCoins, in one transaction
// with the items (profile locked first).

import { playerItems } from "@hc/db";
import {
  CRACKED,
  GADGET_BY_KEY,
  GADGET_HAGGLE_TRIES,
  GADGET_NEEDS,
  SELF_REPAIR_LEVEL,
  VENUES_BY_KEY,
  cannotBuy,
  clockHour,
  dayKey,
  gadgetFloor,
  isOpenAt,
  lagosHourOf,
  phoneTier,
  repairPrice,
  venueHours,
  type GadgetHaggleResult,
  type GadgetsView,
} from "@hc/shared";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { requireUser } from "../../plugins/auth.js";
import { loadNeeds, needsView, saveNeeds } from "./needs.js";
import { skillLevelOf } from "./skills.js";

const ownedItems = async (tx: Tx, userId: string) => (await tx.select({ item: playerItems.item }).from(playerItems).where(eq(playerItems.userId, userId))).map((r) => r.item);

export async function gadgetsView(tx: Tx, userId: string): Promise<GadgetsView> {
  const items = await ownedItems(tx, userId);
  const techLevel = await skillLevelOf(tx, userId, "tech");
  const phone = phoneTier(items);
  return { owned: items.filter((i) => GADGET_BY_KEY.has(i)), phone, cracked: items.includes(CRACKED), techLevel, repairPrice: repairPrice(phone, techLevel) };
}

/** Cracks the player's screen (the area boys caught them), unless a phone case saves it. True if it cracked. */
export async function crackScreen(tx: Tx, userId: string) {
  const items = await ownedItems(tx, userId);
  if (items.includes("phone_case") || items.includes(CRACKED)) return false;
  await tx.insert(playerItems).values({ userId, item: CRACKED });
  return true;
}

const village = () => VENUES_BY_KEY.get("gadget_village")!;
function mustBeOpen(now: Date) {
  const v = village();
  if (!isOpenAt(v, lagosHourOf(now))) throw new AppError(409, "closed", `Gadget Village is closed now. The shops open at ${clockHour(venueHours(v)![0])}.`);
}

/** Pays for a gadget and hands it over: the item row, the coins and the Style/Fun lift together. */
async function sell(tx: Tx, userId: string, key: string, price: number, now: Date) {
  await lockProfile(tx, userId);
  const why = cannotBuy(key, await ownedItems(tx, userId));
  if (why) throw new AppError(409, "cannot_buy", why);
  const posting = await postCoins(tx, userId, -price, "gadget", `gadget:${key}`);
  if (!posting.applied) throw new AppError(409, "cannot_buy", "You already have one.");
  await tx.insert(playerItems).values({ userId, item: key });
  const g = GADGET_BY_KEY.get(key)!;
  const { needs, freeAt } = await loadNeeds(tx, userId, now);
  const lift = GADGET_NEEDS[g.kind] as { style?: number; fun?: number };
  const after = { ...needs, style: Math.min(100, needs.style + (lift.style ?? 0)), fun: Math.min(100, needs.fun + (lift.fun ?? 0)) };
  await saveNeeds(tx, userId, after, now, freeAt);
  return { balance: posting.balance, view: await gadgetsView(tx, userId), ...needsView(after) };
}

const buyBody = z.object({ key: z.string().max(40) });
const haggleBody = z.object({ key: z.string().max(40), offer: z.number().int().min(1) });
const repairBody = z.object({ requestId: z.uuid() });

export async function gadgetRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date()));

  app.get("/api/game/gadgets", async (request) => {
    const user = requireUser(request);
    return inTx((tx) => gadgetsView(tx, user.id));
  });

  // Buy at the price on the tag.
  app.post("/api/game/gadgets/buy", async (request) => {
    const user = requireUser(request);
    const { key } = buyBody.parse(request.body);
    const g = GADGET_BY_KEY.get(key);
    if (!g) throw new AppError(404, "not_found", "Nobody sells that here.");
    return inTx(async (tx, now) => {
      mustBeOpen(now);
      return sell(tx, user.id, key, g.price, now);
    });
  });

  // Haggle: an offer at or above today's floor is a deal at your price; a few tries per item per day.
  const tries = new Map<string, number>();
  app.post("/api/game/gadgets/haggle", { config: { rateLimit: { max: 30 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } }, async (request): Promise<GadgetHaggleResult> => {
    const user = requireUser(request);
    const { key, offer } = haggleBody.parse(request.body);
    const now = new Date();
    mustBeOpen(now);
    const g = GADGET_BY_KEY.get(key);
    const day = dayKey(now, tz);
    const floor = gadgetFloor(user.id, day, key);
    if (!g || floor === null) throw new AppError(404, "not_found", "Nobody sells that here.");
    const tag = `${user.id}|${day}|${key}`;
    const used = tries.get(tag) ?? 0;
    if (used >= GADGET_HAGGLE_TRIES) throw new AppError(409, "no_more", "Oga, you don price am finish. Pay the price or come back tomorrow.");
    if (offer >= floor) {
      const paid = Math.min(offer, g.price);
      const sold = await inTx((tx) => sell(tx, user.id, key, paid, now));
      return { result: "deal", paid, saved: g.price - paid, triesLeft: GADGET_HAGGLE_TRIES - used, balance: sold.balance, view: sold.view };
    }
    tries.set(tag, used + 1);
    const left = GADGET_HAGGLE_TRIES - used - 1;
    if (offer < floor * 0.8) return { result: "walked", line: "Ah, bros! Na original be this o. Go and check other shops.", triesLeft: left };
    const counter = Math.max(floor, Math.round((offer + g.price) / 2 / 50) * 50);
    return { result: "counter", counter, line: `Last price na ${counter}. I no fit go lower.`, triesLeft: left };
  });

  // Fix a cracked screen (parts only, if your Tech is good enough to do it yourself).
  app.post("/api/game/gadgets/repair", async (request) => {
    const user = requireUser(request);
    const { requestId } = repairBody.parse(request.body);
    return inTx(async (tx, now) => {
      mustBeOpen(now);
      await lockProfile(tx, user.id);
      const before = await gadgetsView(tx, user.id);
      if (!before.cracked) throw new AppError(409, "not_cracked", "Your screen is fine. Nothing to fix.");
      const posting = await postCoins(tx, user.id, -before.repairPrice, "gadget", `screen_repair:${requestId}`);
      if (!posting.applied) throw new AppError(409, "duplicate", "That repair is already done.");
      await tx.delete(playerItems).where(and(eq(playerItems.userId, user.id), eq(playerItems.item, CRACKED)));
      return { balance: posting.balance, paid: before.repairPrice, self: before.techLevel >= SELF_REPAIR_LEVEL, view: await gadgetsView(tx, user.id) };
    });
  });
}
