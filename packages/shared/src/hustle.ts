// The hustle board: players hire players. A poster puts up a job (cook for my party, DJ my owambe, help build my
// house) with a fee in coins, which is held (escrow) the moment it's posted. Another player takes it, does the work
// (at least a few minutes on the job) and marks it done; the poster confirms and the fee goes to the worker, with
// skill points for the kind of work. If the poster goes quiet, the fee is released on its own a day later; a
// disagreement goes to an admin. Coins only: nothing here is ever real money.
//
// Safety first (Lagos Life's open board filled with scams and worse): fixed kinds of job, short text that blocks
// links, numbers, "DM me" and anything sexual or about children, a report button that hides a job after a few
// reports, and limits on how much one player can post or take.
import { chatProblem } from "./chat.js";
import type { SkillKey } from "./skills.js";

export type HustleKind = "build" | "cook" | "dj" | "drive" | "photo" | "tutor" | "decorate" | "errand" | "shop" | "hype";

export interface HustleKindInfo {
  key: HustleKind;
  label: string;
  icon: string;
  /** The skill the work trains. */
  skill: SkillKey;
  /** Minutes on the job before it can be marked done. */
  minutes: number;
  /** A fair fee, shown as a hint when posting. */
  hint: number;
}

export const HUSTLE_KINDS: readonly HustleKindInfo[] = [
  { key: "build", label: "Help build my house", icon: "🧱", skill: "fitness", minutes: 15, hint: 2500 },
  { key: "cook", label: "Cook for my party", icon: "🍲", skill: "cooking", minutes: 10, hint: 1500 },
  { key: "dj", label: "DJ at my owambe", icon: "🎧", skill: "charisma", minutes: 10, hint: 2000 },
  { key: "drive", label: "Drive me around", icon: "🚗", skill: "fitness", minutes: 5, hint: 800 },
  { key: "photo", label: "Take my photos", icon: "📸", skill: "tech", minutes: 5, hint: 1000 },
  { key: "tutor", label: "Tutor me", icon: "📚", skill: "tech", minutes: 10, hint: 1200 },
  { key: "decorate", label: "Decorate my house", icon: "🛋️", skill: "business", minutes: 10, hint: 1500 },
  { key: "errand", label: "Run an errand", icon: "🏃🏾", skill: "fitness", minutes: 5, hint: 500 },
  { key: "shop", label: "Mind my shop for a shift", icon: "🏪", skill: "business", minutes: 15, hint: 1500 },
  { key: "hype", label: "Hype my business", icon: "📣", skill: "charisma", minutes: 5, hint: 800 },
];
export const HUSTLE_KIND_BY_KEY: ReadonlyMap<HustleKind, HustleKindInfo> = new Map(HUSTLE_KINDS.map((k) => [k.key, k]));

export const HUSTLE_RULES = {
  minFee: 100,
  maxFee: 50_000,
  /** Open or in-progress jobs one player can have posted at once. */
  maxOpenPosts: 3,
  /** Jobs one player can take in a day (Lagos time). */
  maxTakesPerDay: 5,
  /** XP needed to post or take (keeps brand-new throwaway accounts off the board). */
  minXp: 10,
  /** The fee goes to the worker on its own this long after they mark it done, if the poster says nothing. */
  autoPayHours: 24,
  /** A taken job nobody finishes in this time can be cancelled by the poster (fee back). */
  noShowHours: 24,
  /** Reports from different players that hide a job until an admin looks. */
  hideAfterReports: 3,
  /** Skill points for finishing a job. */
  skillPoints: 10,
  /** XP for finishing a job (worker) and for a job well done (poster's confirmation). */
  xp: 12,
  titleMax: 60,
  detailsMax: 280,
} as const;

/** Words and phrases that have no place on a jobs board for a game: contact grabs, sex, children, cash-outs. */
const BANNED = [
  /\bdm\b/i,
  /\binbox me\b/i,
  /whats\s*app|telegram|snapchat|instagram|\big\b|tiktok/i,
  /\b(sex|sexy|nude|nudes|naked|escort|hook\s*up|hookup|sugar\s*(daddy|mummy|mommy|baby)|girlfriend|boyfriend|massage)\b/i,
  /\b(minor|minors|under\s*18|underage|small\s*(girl|boy)|teen|teenager|school\s*(girl|boy)|child|children|kid|kids)\b/i,
  /\b(real\s*money|bank\s*transfer|account\s*number|cash\s*out|withdraw|opay|palmpay|moniepoint|crypto|usdt|bitcoin)\b/i,
];

/** Why this job text can't go up, or null if it's fine. */
export function hustleTextProblem(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const chat = chatProblem(text);
  if (chat) return chat.replace("in chat", "on the hustle board");
  if (BANNED.some((re) => re.test(text))) return "That isn't allowed on the hustle board. Keep it to the game job: what, where and when.";
  return null;
}

export type HustleStatus = "open" | "taken" | "done" | "paid" | "cancelled" | "disputed" | "removed";

export interface HustleJobView {
  id: string;
  kind: HustleKind;
  title: string;
  details: string;
  fee: number;
  /** A place in the game where the work happens (a venue key or "home"), if the poster picked one. */
  place: string | null;
  status: HustleStatus;
  poster: { id: string; nickname: string };
  worker: { id: string; nickname: string } | null;
  createdAt: string;
  takenAt: string | null;
  doneAt: string | null;
  /** When "done" turns into "paid" on its own. */
  autoPayAt: string | null;
  /** When the worker can mark it done. */
  canFinishAt: string | null;
  mine: boolean;
  working: boolean;
  reportedByMe: boolean;
}
