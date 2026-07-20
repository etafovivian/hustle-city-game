// Simulated shop economy. City Coins have no cash value (PRD: "Three clearly
// labelled balances"). All numbers here are tuning configuration, not promises.

import { seededRandom } from "./rng.js";

export interface StockItem {
  key: string;
  name: string;
  /** Coins the player pays per unit to restock. */
  wholesaleCost: number;
  /** Price at which NPC demand equals `baseDemandPerStep`. */
  referencePrice: number;
  /** Expected units sold per simulation step at the reference price. */
  baseDemandPerStep: number;
}

export const STOCK_ITEMS: readonly StockItem[] = [
  { key: "pure_water", name: "Pure water (sachet)", wholesaleCost: 20, referencePrice: 50, baseDemandPerStep: 3 },
  { key: "puff_puff", name: "Puff-puff (pack)", wholesaleCost: 40, referencePrice: 100, baseDemandPerStep: 1.5 },
  { key: "recharge_card", name: "Recharge card", wholesaleCost: 180, referencePrice: 220, baseDemandPerStep: 1 },
  { key: "phone_case", name: "Phone case", wholesaleCost: 400, referencePrice: 900, baseDemandPerStep: 0.3 },
  { key: "earpiece", name: "Earpiece", wholesaleCost: 600, referencePrice: 1200, baseDemandPerStep: 0.25 },
  { key: "power_bank", name: "Power bank", wholesaleCost: 2500, referencePrice: 4500, baseDemandPerStep: 0.08 },
];

export const STOCK_ITEMS_BY_KEY: ReadonlyMap<string, StockItem> = new Map(STOCK_ITEMS.map((i) => [i.key, i]));

export const ECONOMY = {
  /** Length of one NPC demand step. */
  stepMinutes: 10,
  /** Offline accrual cap: at most this many steps are simulated per settlement (24h). */
  maxStepsPerSettle: 144,
  /** How strongly demand reacts to price relative to the reference price. */
  priceElasticity: 2,
  /** Demand is never more than this multiple of base, however cheap the price. */
  maxDemandMultiplier: 3,
  /** Allowed price range as a multiple of reference price. */
  minPriceMultiple: 0.2,
  maxPriceMultiple: 5,
  /** Maximum units of a single item the shop can hold. */
  maxStockPerItem: 500,
  /** Max units per restock request. */
  maxRestockUnits: 200,
  /** A new NPC customer order appears every N minutes. */
  orderSlotMinutes: 30,
} as const;

export function stepIndex(at: Date): number {
  return Math.floor(at.getTime() / (ECONOMY.stepMinutes * 60_000));
}

export function orderSlotIndex(at: Date): number {
  return Math.floor(at.getTime() / (ECONOMY.orderSlotMinutes * 60_000));
}

export function isValidPrice(item: StockItem, price: number): boolean {
  return (
    Number.isInteger(price) &&
    price >= Math.max(1, Math.ceil(item.referencePrice * ECONOMY.minPriceMultiple)) &&
    price <= Math.floor(item.referencePrice * ECONOMY.maxPriceMultiple)
  );
}

/** Expected units per step for an item at a given price. */
export function expectedDemand(item: StockItem, price: number): number {
  if (price <= 0) return 0;
  const multiplier = Math.min(
    ECONOMY.maxDemandMultiplier,
    Math.pow(item.referencePrice / price, ECONOMY.priceElasticity),
  );
  return item.baseDemandPerStep * multiplier;
}

export interface InventoryLine {
  itemKey: string;
  quantity: number;
  price: number;
}

export interface SaleLine {
  itemKey: string;
  units: number;
  revenue: number;
}

export interface SettlementResult {
  /** Step index the shop is now settled up to (exclusive). */
  settledToStep: number;
  stepsSimulated: number;
  sales: SaleLine[];
  totalRevenue: number;
  totalUnits: number;
}

/**
 * Simulate NPC demand for steps [fromStep, toStep) in bounded time.
 * Deterministic for the same (shopId, step, item, price, stock), so a repeated
 * settlement over the same window yields the same result.
 * Steps older than `maxStepsPerSettle` before `toStep` are skipped (offline cap).
 */
export function settleShop(
  shopId: string,
  inventory: readonly InventoryLine[],
  fromStep: number,
  toStep: number,
): SettlementResult {
  const start = Math.max(fromStep, toStep - ECONOMY.maxStepsPerSettle);
  const remaining = new Map(inventory.map((l) => [l.itemKey, l.quantity]));
  const sold = new Map<string, SaleLine>();

  for (let step = start; step < toStep; step++) {
    for (const line of inventory) {
      const item = STOCK_ITEMS_BY_KEY.get(line.itemKey);
      const left = remaining.get(line.itemKey) ?? 0;
      if (!item || left <= 0 || line.price <= 0) continue;

      const expected = expectedDemand(item, line.price);
      const rand = seededRandom(shopId, step, line.itemKey);
      const whole = Math.floor(expected);
      const units = Math.min(left, whole + (rand() < expected - whole ? 1 : 0));
      if (units <= 0) continue;

      remaining.set(line.itemKey, left - units);
      const acc = sold.get(line.itemKey) ?? { itemKey: line.itemKey, units: 0, revenue: 0 };
      acc.units += units;
      acc.revenue += units * line.price;
      sold.set(line.itemKey, acc);
    }
  }

  const sales = [...sold.values()];
  return {
    settledToStep: Math.max(fromStep, toStep),
    stepsSimulated: Math.max(0, toStep - start),
    sales,
    totalRevenue: sales.reduce((s, l) => s + l.revenue, 0),
    totalUnits: sales.reduce((s, l) => s + l.units, 0),
  };
}

export interface CustomerOrder {
  slot: number;
  itemKey: string;
  units: number;
  /** Total coins the NPC pays for the whole order. */
  offer: number;
  customerName: string;
}

const CUSTOMER_NAMES = ["Mama Tolu", "Chidi", "Aunty Bisi", "Musa", "Kemi", "Oga Emeka", "Halima", "Tunde"];

/** The NPC customer order available to a shop in a given slot (deterministic). */
export function customerOrderFor(shopId: string, slot: number): CustomerOrder {
  const rand = seededRandom("order", shopId, slot);
  // Bias toward cheaper items so new players can fulfil orders.
  const pool = STOCK_ITEMS.slice(0, 4);
  const item = pool[Math.floor(rand() * pool.length)] ?? STOCK_ITEMS[0]!;
  const units = 1 + Math.floor(rand() * 5);
  const premium = 1.1 + rand() * 0.3; // pays 10–40% above reference
  const name = CUSTOMER_NAMES[Math.floor(rand() * CUSTOMER_NAMES.length)] ?? "Customer";
  return {
    slot,
    itemKey: item.key,
    units,
    offer: Math.round(units * item.referencePrice * premium),
    customerName: name,
  };
}
