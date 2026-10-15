// Buy mode: buy, move, rotate and sell shop furniture with City Coins.
// Every change locks the profile, then the shop (same order as shop.ts), so two
// requests can't overspend or drop two items on the same tile.

import { gameLedgerEntries, shopDecor, simShops } from "@hc/db";
import {
  DECOR_BY_KEY,
  DECOR_REFUND_SHARE,
  SHOP_FLOOR,
  appealOf,
  demandBoost,
  placementProblem,
  type DecorView,
  type Placement,
} from "@hc/shared";
import { and, eq } from "drizzle-orm";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { recordEvents } from "./quests.js";
import type { ShopCtx } from "./shop.js";

async function lockShop(tx: Tx, userId: string) {
  await lockProfile(tx, userId);
  const [shop] = await tx.select().from(simShops).where(eq(simShops.ownerId, userId)).for("update");
  if (!shop) throw notFound("Shop");
  return shop;
}

async function view(tx: Tx, shopId: string): Promise<DecorView> {
  const rows = await tx.select().from(shopDecor).where(eq(shopDecor.shopId, shopId));
  const appeal = appealOf(rows);
  return {
    floor: { cols: SHOP_FLOOR.cols, rows: SHOP_FLOOR.rows },
    placements: rows.map((r) => ({ id: r.id, itemKey: r.itemKey, x: r.x, y: r.y, rotation: r.rotation })),
    appeal,
    boost: demandBoost(appeal),
  };
}

export async function getDecor({ tx, userId }: ShopCtx) {
  const shop = await lockShop(tx, userId);
  return view(tx, shop.id);
}

export async function buyDecor(ctx: ShopCtx, p: Placement, requestId: string) {
  const { tx, userId, now, timeZone } = ctx;
  const item = DECOR_BY_KEY.get(p.itemKey);
  if (!item) throw badRequest("unknown_item", "That item isn't in the catalogue.");
  const shop = await lockShop(tx, userId);
  // A retried request (same id) already succeeded: return the current floor, don't re-validate.
  const reference = `decor:${requestId}`;
  const [done] = await tx
    .select({ id: gameLedgerEntries.id })
    .from(gameLedgerEntries)
    .where(and(eq(gameLedgerEntries.userId, userId), eq(gameLedgerEntries.reference, reference)));
  if (done) return view(tx, shop.id);

  const existing = await tx.select().from(shopDecor).where(eq(shopDecor.shopId, shop.id));
  const problem = placementProblem(p, existing);
  if (problem) throw badRequest("invalid_placement", problem);

  await postCoins(tx, userId, -item.price, "decor", reference);
  await tx.insert(shopDecor).values({ shopId: shop.id, itemKey: item.key, x: p.x, y: p.y, rotation: p.rotation, pricePaid: item.price });
  await recordEvents(tx, userId, [{ type: "decor_bought" }], now, timeZone);
  return view(tx, shop.id);
}

export async function moveDecor(ctx: ShopCtx, id: string, to: { x: number; y: number; rotation: number }) {
  const { tx, userId } = ctx;
  const shop = await lockShop(tx, userId);
  const all = await tx.select().from(shopDecor).where(eq(shopDecor.shopId, shop.id));
  const row = all.find((r) => r.id === id);
  if (!row) throw notFound("Item");
  const problem = placementProblem({ itemKey: row.itemKey, ...to }, all.filter((r) => r.id !== id));
  if (problem) throw badRequest("invalid_placement", problem);
  await tx.update(shopDecor).set(to).where(and(eq(shopDecor.id, id), eq(shopDecor.shopId, shop.id)));
  return view(tx, shop.id);
}

export async function sellDecor(ctx: ShopCtx, id: string) {
  const { tx, userId } = ctx;
  const shop = await lockShop(tx, userId);
  const [row] = await tx
    .delete(shopDecor)
    .where(and(eq(shopDecor.id, id), eq(shopDecor.shopId, shop.id)))
    .returning();
  if (!row) throw notFound("Item");
  const refund = Math.floor(row.pricePaid * DECOR_REFUND_SHARE);
  if (refund > 0) await postCoins(tx, userId, refund, "decor_refund", `decor_refund:${row.id}`);
  return view(tx, shop.id);
}
