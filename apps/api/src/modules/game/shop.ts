// Simulated shop: restock, pricing, server-calculated NPC demand, customer orders.
// The client never changes coins or inventory directly (FR02).

import { randomUUID } from "node:crypto";
import { shopDecor, simInventory, simOrders, simShops } from "@hc/db";
import {
  ECONOMY,
  STOCK_ITEMS,
  STOCK_ITEMS_BY_KEY,
  appealOf,
  demandBoost,
  customerOrderFor,
  isValidPrice,
  orderSlotIndex,
  settleShop,
  stepIndex,
  type GameEvent,
  type ShopView,
} from "@hc/shared";
import { and, eq, sql } from "drizzle-orm";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError, badRequest, notFound } from "../../lib/errors.js";
import { recordEvents } from "./quests.js";

type ShopRow = typeof simShops.$inferSelect;

export async function createShop(
  tx: Tx,
  userId: string,
  shopName: string,
  now: Date,
  starter?: { itemKey: string; units: number },
) {
  const [shop] = await tx
    .insert(simShops)
    .values({ ownerId: userId, name: shopName, settledStep: stepIndex(now) })
    .returning();
  await tx
    .insert(simInventory)
    .values(
      STOCK_ITEMS.map((i) => ({
        shopId: shop!.id,
        itemKey: i.key,
        quantity: starter?.itemKey === i.key ? starter.units : 0,
        price: i.referencePrice,
      })),
    );
  return shop!;
}

/** Lock profile then shop (consistent lock order), and settle NPC demand up to `now`. */
async function openShop(tx: Tx, userId: string, now: Date, timeZone: string) {
  await lockProfile(tx, userId);
  const [shop] = await tx.select().from(simShops).where(eq(simShops.ownerId, userId)).for("update");
  if (!shop) throw notFound("Shop");
  const sales = await settle(tx, shop, now, timeZone);
  return { shop: { ...shop, ...sales.shopUpdate }, recentSales: sales.recentSales };
}

async function settle(tx: Tx, shop: ShopRow, now: Date, timeZone: string) {
  const lines = await tx.select().from(simInventory).where(eq(simInventory.shopId, shop.id));
  const decor = await tx.select().from(shopDecor).where(eq(shopDecor.shopId, shop.id));
  const result = settleShop(shop.id, lines, shop.settledStep, stepIndex(now), demandBoost(appealOf(decor)));

  for (const sale of result.sales) {
    await tx
      .update(simInventory)
      .set({ quantity: sql`${simInventory.quantity} - ${sale.units}` })
      .where(and(eq(simInventory.shopId, shop.id), eq(simInventory.itemKey, sale.itemKey)));
  }
  const shopUpdate = {
    settledStep: result.settledToStep,
    uncollected: shop.uncollected + result.totalRevenue,
  };
  if (shopUpdate.settledStep !== shop.settledStep || result.totalRevenue) {
    await tx.update(simShops).set(shopUpdate).where(eq(simShops.id, shop.id));
  }
  if (result.totalUnits > 0) {
    await recordEvents(
      tx,
      shop.ownerId,
      [
        { type: "items_sold", amount: result.totalUnits },
        { type: "coins_from_sales", amount: result.totalRevenue },
      ],
      now,
      timeZone,
    );
  }
  return { shopUpdate, recentSales: result.sales };
}

async function view(tx: Tx, shop: ShopRow, recentSales: ShopView["recentSales"], now: Date): Promise<ShopView> {
  const lines = await tx.select().from(simInventory).where(eq(simInventory.shopId, shop.id));
  const slot = orderSlotIndex(now);
  const order = customerOrderFor(shop.id, slot);
  const [fulfilled] = await tx
    .select({ slot: simOrders.slot })
    .from(simOrders)
    .where(and(eq(simOrders.shopId, shop.id), eq(simOrders.slot, slot)));

  return {
    id: shop.id,
    name: shop.name,
    uncollected: shop.uncollected,
    recentSales,
    order: { ...order, fulfilled: !!fulfilled },
    lines: STOCK_ITEMS.map((item) => {
      const l = lines.find((x) => x.itemKey === item.key);
      return {
        itemKey: item.key,
        name: item.name,
        quantity: l?.quantity ?? 0,
        price: l?.price ?? item.referencePrice,
        wholesaleCost: item.wholesaleCost,
        referencePrice: item.referencePrice,
      };
    }),
  };
}

function itemOrThrow(itemKey: string) {
  const item = STOCK_ITEMS_BY_KEY.get(itemKey);
  if (!item) throw badRequest("unknown_item", "Unknown stock item.");
  return item;
}

export interface ShopCtx {
  tx: Tx;
  userId: string;
  now: Date;
  timeZone: string;
}

export async function getShop({ tx, userId, now, timeZone }: ShopCtx) {
  const { shop, recentSales } = await openShop(tx, userId, now, timeZone);
  return view(tx, shop, recentSales, now);
}

export async function restock(ctx: ShopCtx, itemKey: string, units: number, requestId: string) {
  const { tx, userId, now, timeZone } = ctx;
  const item = itemOrThrow(itemKey);
  if (!Number.isInteger(units) || units < 1 || units > ECONOMY.maxRestockUnits) {
    throw badRequest("invalid_units", `Restock between 1 and ${ECONOMY.maxRestockUnits} units.`);
  }
  const { shop, recentSales } = await openShop(tx, userId, now, timeZone);

  const [line] = await tx
    .select()
    .from(simInventory)
    .where(and(eq(simInventory.shopId, shop.id), eq(simInventory.itemKey, item.key)));
  if ((line?.quantity ?? 0) + units > ECONOMY.maxStockPerItem) {
    throw badRequest("stock_limit", `You can hold at most ${ECONOMY.maxStockPerItem} of one item.`);
  }

  const posting = await postCoins(tx, userId, -(units * item.wholesaleCost), "restock", `restock:${requestId}`);
  if (posting.applied) {
    await tx
      .insert(simInventory)
      .values({ shopId: shop.id, itemKey: item.key, quantity: units, price: item.referencePrice })
      .onConflictDoUpdate({
        target: [simInventory.shopId, simInventory.itemKey],
        set: { quantity: sql`${simInventory.quantity} + ${units}` },
      });
    await recordEvents(tx, userId, [{ type: "stock_purchased" }], now, timeZone);
  }
  return view(tx, shop, recentSales, now);
}

export async function setPrice(ctx: ShopCtx, itemKey: string, price: number) {
  const { tx, userId, now, timeZone } = ctx;
  const item = itemOrThrow(itemKey);
  if (!isValidPrice(item, price)) {
    throw badRequest(
      "invalid_price",
      `Price must be a whole number between ${Math.ceil(item.referencePrice * ECONOMY.minPriceMultiple)} and ${Math.floor(item.referencePrice * ECONOMY.maxPriceMultiple)}.`,
    );
  }
  // Settle at the old price first so past steps are not repriced.
  const { shop, recentSales } = await openShop(tx, userId, now, timeZone);
  const updated = await tx
    .update(simInventory)
    .set({ price })
    .where(and(eq(simInventory.shopId, shop.id), eq(simInventory.itemKey, item.key), sql`${simInventory.price} <> ${price}`))
    .returning({ itemKey: simInventory.itemKey });
  if (updated.length) await recordEvents(tx, userId, [{ type: "price_changed", key: item.key }], now, timeZone);
  return view(tx, shop, recentSales, now);
}

export async function collectTakings(ctx: ShopCtx) {
  const { tx, userId, now, timeZone } = ctx;
  const { shop, recentSales } = await openShop(tx, userId, now, timeZone);
  if (shop.uncollected <= 0) throw new AppError(422, "nothing_to_collect", "No takings to collect yet.");

  await postCoins(tx, userId, shop.uncollected, "takings", `takings:${shop.id}:${randomUUID()}`);
  await tx.update(simShops).set({ uncollected: 0 }).where(eq(simShops.id, shop.id));
  await recordEvents(tx, userId, [{ type: "takings_collected" }], now, timeZone);
  return view(tx, { ...shop, uncollected: 0 }, recentSales, now);
}

export async function fulfilOrder(ctx: ShopCtx, slot: number) {
  const { tx, userId, now, timeZone } = ctx;
  if (slot !== orderSlotIndex(now)) throw new AppError(410, "order_expired", "That customer has left. Check the new order.");
  const { shop, recentSales } = await openShop(tx, userId, now, timeZone);
  const order = customerOrderFor(shop.id, slot);

  const inserted = await tx
    .insert(simOrders)
    .values({ shopId: shop.id, slot, itemKey: order.itemKey, units: order.units, offer: order.offer })
    .onConflictDoNothing()
    .returning({ slot: simOrders.slot });
  if (!inserted.length) throw new AppError(409, "already_fulfilled", "You already served this customer.");

  const taken = await tx
    .update(simInventory)
    .set({ quantity: sql`${simInventory.quantity} - ${order.units}` })
    .where(
      and(
        eq(simInventory.shopId, shop.id),
        eq(simInventory.itemKey, order.itemKey),
        sql`${simInventory.quantity} >= ${order.units}`,
      ),
    )
    .returning({ quantity: simInventory.quantity });
  if (!taken.length) throw new AppError(422, "insufficient_stock", "Not enough stock for this order. Restock first.");

  await postCoins(tx, userId, order.offer, "order", `order:${shop.id}:${slot}`);
  const events: GameEvent[] = [
    { type: "order_fulfilled" },
    { type: "items_sold", amount: order.units },
    { type: "coins_from_sales", amount: order.offer },
  ];
  await recordEvents(tx, userId, events, now, timeZone);
  return view(tx, shop, recentSales, now);
}
