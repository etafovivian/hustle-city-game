// Daily quest pool and rotation. Progress is driven only by server-side events.

import { seededRandom, shuffle } from "./rng.js";

export type GameEventType =
  | "location_visited"
  | "stock_purchased"
  | "price_changed"
  | "items_sold"
  | "coins_from_sales"
  | "order_fulfilled"
  | "takings_collected"
  | "product_viewed"
  | "leaderboard_viewed"
  | "decor_bought";

export interface GameEvent {
  type: GameEventType;
  /** Amount to add to progress (units sold, coins earned...). Defaults to 1. */
  amount?: number;
  /** Identity for distinct-count quests (e.g. which location was visited). */
  key?: string;
}

export interface QuestDefinition {
  key: string;
  title: string;
  description: string;
  event: GameEventType;
  target: number;
  /** Count distinct event keys instead of summing amounts. */
  distinct?: boolean;
  rewardCoins: number;
  rewardXp: number;
}

export const DAILY_QUESTS_PER_DAY = 3;

export const DAILY_QUEST_POOL: readonly QuestDefinition[] = [
  { key: "restock_3", title: "Stock up", description: "Restock your shop 3 times.", event: "stock_purchased", target: 3, rewardCoins: 150, rewardXp: 20 },
  { key: "sell_10", title: "Busy counter", description: "Sell 10 items to customers.", event: "items_sold", target: 10, rewardCoins: 200, rewardXp: 25 },
  { key: "earn_500", title: "Good market", description: "Earn 500 City Coins from sales.", event: "coins_from_sales", target: 500, rewardCoins: 250, rewardXp: 30 },
  { key: "reprice_2", title: "Price check", description: "Adjust your prices twice.", event: "price_changed", target: 2, rewardCoins: 100, rewardXp: 15 },
  { key: "order_2", title: "Customer first", description: "Fulfil 2 customer orders.", event: "order_fulfilled", target: 2, rewardCoins: 200, rewardXp: 25 },
  { key: "collect_1", title: "Count the takings", description: "Collect your shop takings.", event: "takings_collected", target: 1, rewardCoins: 80, rewardXp: 10 },
  { key: "browse_3", title: "Window shopping", description: "View 3 different real merchant products.", event: "product_viewed", target: 3, distinct: true, rewardCoins: 120, rewardXp: 15 },
  { key: "tour_3", title: "Around Junction 101", description: "Visit all three locations.", event: "location_visited", target: 3, distinct: true, rewardCoins: 100, rewardXp: 15 },
  { key: "decor_1", title: "Spruce up", description: "Buy one item for your shop in Decorate.", event: "decor_bought", target: 1, rewardCoins: 120, rewardXp: 15 },
  { key: "standings_1", title: "Who's on top?", description: "Check the weekly standings at The Hangout.", event: "leaderboard_viewed", target: 1, rewardCoins: 60, rewardXp: 10 },
];

/** One-time onboarding quest (PRD: visit the three locations, complete one simulated order). */
export const INTRO_QUEST = {
  key: "intro",
  title: "Welcome to Junction 101",
  description: "Visit Market Square, Work Hub and The Hangout, then fulfil one customer order.",
  steps: [
    { event: "location_visited" as const, target: 3, distinct: true, label: "Visit all three locations" },
    { event: "order_fulfilled" as const, target: 1, distinct: false, label: "Fulfil one customer order" },
  ],
  rewardCoins: 500,
  rewardXp: 50,
} as const;

export const QUESTS_BY_KEY: ReadonlyMap<string, QuestDefinition> = new Map(DAILY_QUEST_POOL.map((q) => [q.key, q]));

/** The quests active on a given game day — same for every player. */
export function dailyQuestsFor(day: string): QuestDefinition[] {
  return shuffle(DAILY_QUEST_POOL, seededRandom("daily-quests", day)).slice(0, DAILY_QUESTS_PER_DAY);
}
