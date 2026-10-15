// The daily hunt: five golden kola nuts are hidden around the city each Lagos day (the same places for everyone).
// Walk close and tap one to pick it up: coins and XP each, and a bonus for finding all five.
export const HUNT = { count: 5, coins: 100, xp: 10, bonusCoins: 1_000, bonusXp: 50, reach: 360 };

/** A small seeded random generator (the same day gives the same hiding places on every phone). */
export function huntRandom(day: string) {
  let h = 2166136261;
  for (const ch of `hunt:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
export interface HuntView {
  day: string;
  found: number[];
}
