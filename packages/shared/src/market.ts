// Balogun Market: buy stock wholesale by haggling (cheaper than the usual restock if you bargain well), and real
// small traders can take a free stall there instead of a whole plot.
import { STOCK_ITEMS_BY_KEY } from "./economy.js";

/** The trader's opening ask, as a share of the usual wholesale cost (a bit over, as traders do). */
export const ASK = 1.1;
/** Offers per item per Lagos day. */
export const HAGGLE_TRIES = 3;
/** Free stalls at the market for real small traders. */
export const STALLS = 60;
export const stallId = (n: number) => `balogun-stall+${n}`;
export const isStall = (plotId: string) => plotId.startsWith("balogun-stall+");

/** Deterministic number in [0, 1) from a string. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** The lowest the trader will go today for you (65–85% of usual wholesale). Kept on the server. */
export function haggleFloor(userId: string, day: string, itemKey: string, units: number) {
  const item = STOCK_ITEMS_BY_KEY.get(itemKey);
  if (!item) return null;
  const share = 0.65 + 0.2 * hash(`${userId}|${day}|${itemKey}`);
  return Math.ceil(item.wholesaleCost * units * share);
}
export const askPrice = (itemKey: string, units: number) => {
  const item = STOCK_ITEMS_BY_KEY.get(itemKey);
  return item ? Math.round(item.wholesaleCost * units * ASK) : null;
};

export type HaggleResult =
  | { result: "deal"; paid: number; saved: number; triesLeft: number }
  | { result: "counter"; counter: number; line: string; triesLeft: number }
  | { result: "walked"; line: string; triesLeft: number };
