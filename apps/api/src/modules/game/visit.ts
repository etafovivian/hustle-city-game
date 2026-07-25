// Visiting another player's shop: read-only. Visitors see the room, the decor and the price board,
// never the owner's balance, takings or exact stock. Moderated (hidden) names never reach visitors.

import { profiles, shopDecor, simInventory, simShops, users } from "@hc/db";
import { SHOP_FLOOR, STOCK_ITEMS_BY_KEY, appealOf, demandBoost, type ShopVisit } from "@hc/shared";
import { and, eq } from "drizzle-orm";
import { lockProfile } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import { recordEvents } from "./quests.js";
import type { ShopCtx } from "./shop.js";

export async function visitShop({ tx, userId, now, timeZone }: ShopCtx, shopId: string): Promise<ShopVisit> {
  const [shop] = await tx
    .select({ id: simShops.id, name: simShops.name, ownerId: simShops.ownerId, nickname: profiles.nickname, hidden: profiles.nicknameHidden, hustle: profiles.hustle })
    .from(simShops)
    .innerJoin(profiles, eq(profiles.userId, simShops.ownerId))
    .innerJoin(users, eq(users.id, simShops.ownerId))
    .where(and(eq(simShops.id, shopId), eq(users.status, "active")));
  if (!shop) throw notFound("Shop");

  const isMe = shop.ownerId === userId;
  const decor = await tx.select().from(shopDecor).where(eq(shopDecor.shopId, shop.id));
  const stock = await tx.select().from(simInventory).where(eq(simInventory.shopId, shop.id));
  const appeal = appealOf(decor);

  if (!isMe) {
    await lockProfile(tx, userId);
    await recordEvents(tx, userId, [{ type: "shop_visited", key: shop.id }], now, timeZone);
  }

  const hide = shop.hidden && !isMe;
  return {
    shopId: shop.id,
    shopName: hide ? "A Junction 101 shop" : shop.name,
    nickname: hide ? "A player" : shop.nickname,
    hustle: shop.hustle,
    isMe,
    decor: {
      floor: { cols: SHOP_FLOOR.cols, rows: SHOP_FLOOR.rows },
      placements: decor.map((d) => ({ id: d.id, itemKey: d.itemKey, x: d.x, y: d.y, rotation: d.rotation })),
      appeal,
      boost: demandBoost(appeal),
    },
    prices: stock
      .filter((s) => STOCK_ITEMS_BY_KEY.has(s.itemKey))
      .map((s) => ({ itemKey: s.itemKey, name: STOCK_ITEMS_BY_KEY.get(s.itemKey)!.name, price: s.price, inStock: s.quantity > 0 })),
  };
}
