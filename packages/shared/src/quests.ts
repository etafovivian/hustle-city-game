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
  | "decor_bought"
  | "shop_visited"
  | "activity_done"
  // life in the city (see LIFE_QUESTS)
  | "verse_read"
  | "home_action"
  | "love_met"
  | "love_chat"
  | "date_done"
  | "pet_cared"
  | "party_fun";

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
  { key: "neighbour_2", title: "Neighbourly", description: "Visit 2 other players' shops from the map.", event: "shop_visited", target: 2, distinct: true, rewardCoins: 100, rewardXp: 15 },
  { key: "venue_2", title: "Out and about", description: "Do 2 activities at places around the city.", event: "activity_done", target: 2, rewardCoins: 120, rewardXp: 15 },
  { key: "standings_1", title: "Who's on top?", description: "Check the weekly standings at The Hangout.", event: "leaderboard_viewed", target: 1, rewardCoins: 60, rewardXp: 10 },
  { key: "verse_1", title: "A quiet moment", description: "Read for a while in Phone → Holy books.", event: "verse_read", target: 1, rewardCoins: 80, rewardXp: 10 },
  { key: "home_2", title: "Home sweet home", description: "Do 2 things at home (cook, watch TV, relax...).", event: "home_action", target: 2, rewardCoins: 100, rewardXp: 15 },
  { key: "gist_2", title: "Good gist", description: "Chat twice with someone you've met (Phone → Love).", event: "love_chat", target: 2, rewardCoins: 100, rewardXp: 15 },
];

/**
 * One more quest a day for each player, from their own life: what they have decides which (a pet to care for, someone
 * to date, a house to throw a party in); with none of those yet, meeting someone new. Rotates by day among the ones
 * that fit.
 */
export const LIFE_QUESTS: readonly (QuestDefinition & { needs: "pet" | "date" | "house" | null })[] = [
  { key: "life_pet", title: "Best friend", description: "Feed, play with or walk your pet twice.", event: "pet_cared", target: 2, rewardCoins: 150, rewardXp: 20, needs: "pet" },
  { key: "life_date", title: "Date night", description: "Go on a date (Phone → Love).", event: "date_done", target: 1, rewardCoins: 200, rewardXp: 25, needs: "date" },
  { key: "life_party", title: "Party people", description: "Throw a house party, or join a friend's.", event: "party_fun", target: 1, rewardCoins: 250, rewardXp: 30, needs: "house" },
  { key: "life_meet", title: "New faces", description: "Say hi to someone new where they hang out (Phone → Love shows where).", event: "love_met", target: 1, rewardCoins: 120, rewardXp: 15, needs: null },
];
export const LIFE_QUESTS_BY_KEY: ReadonlyMap<string, QuestDefinition> = new Map(LIFE_QUESTS.map((q) => [q.key, q]));
export type LifeSituation = { pet: boolean; date: boolean; house: boolean };
/** Today's life quest for someone in this situation. */
export function lifeQuestFor(day: string, life: LifeSituation): QuestDefinition {
  const fits = LIFE_QUESTS.filter((q) => q.needs === null ? !life.pet && !life.date && !life.house : life[q.needs]);
  const pool = fits.length ? fits : LIFE_QUESTS.filter((q) => q.needs === null);
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) % 1009;
  return pool[h % pool.length]!;
}

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
