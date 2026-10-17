// Beta tester rewards: players who test the beta earn a tier (and a badge on their card). The first two come on
// their own from days played and reports the team found useful; Founding tester is picked by the team. Each tier's
// coins are the total for that tier (not added together), banked now and paid when the team pays rewards out.

export type TesterTier = "joined" | "active" | "founding";
export interface TesterTierInfo {
  key: TesterTier;
  label: string;
  icon: string;
  coins: number;
  how: string;
}
export const TESTER_TIERS: readonly TesterTierInfo[] = [
  { key: "joined", label: "Beta tester", icon: "🧪", coins: 10_000, how: "Play on 2 different days" },
  { key: "active", label: "Active tester", icon: "🛠️", coins: 50_000, how: "Play on 7 different days, or send a report the team marks fixed" },
  { key: "founding", label: "Founding tester", icon: "🏅", coins: 100_000, how: "Picked by the team for great testing" },
];
export const TESTER_BY_KEY: ReadonlyMap<string, TesterTierInfo> = new Map(TESTER_TIERS.map((t) => [t.key, t]));
export const TESTER_RANK: Record<TesterTier, number> = { joined: 1, active: 2, founding: 3 };
export const TESTER_DAYS = { joined: 2, active: 7 } as const;

/** The tier earned on its own (never Founding), or null. */
export function earnedTier(days: number, usefulReports: number): TesterTier | null {
  if (days >= TESTER_DAYS.active || usefulReports >= 1) return "active";
  if (days >= TESTER_DAYS.joined) return "joined";
  return null;
}

export interface TesterView {
  tier: TesterTier | null;
  days: number;
  usefulReports: number;
  /** Coins for the tier, and how many already paid. */
  coins: number;
  paid: number;
}
export interface AdminTesterRow extends TesterView {
  userId: string;
  nickname: string;
  reports: number;
  lastDay: string | null;
}
