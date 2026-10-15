// Phone → Admin → Beta stats: who plays and what they use, from what the game already records (coins earned and
// spent, quest progress, and each feature's own tables). Admin accounts are left out of every number.

export interface StatsView {
  /** Lagos day the numbers end on. */
  day: string;
  players: { total: number; newToday: number; new7d: number; activeToday: number; active7d: number; active30d: number };
  /** The last 14 days, oldest first. */
  daily: { day: string; signups: number; active: number }[];
  /** Players who signed up on a day, and how many came back the next day and a week later (null: not yet known). */
  cohorts: { day: string; signups: number; d1: number | null; d7: number | null }[];
  /** The last 7 days: how often each thing was done, and by how many players. */
  use: { label: string; times: number; players: number }[];
  love: Record<string, number>;
  pets: Record<string, number>;
  reports: { newBugs: number; newIdeas: number; errors7d: number };
}
