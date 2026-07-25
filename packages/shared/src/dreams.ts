// Dream progress: the long goal each player picks in onboarding, split into steps with City Coin rewards.
// Progress is derived server-side from game data the player can't edit (orders, ledger, standings).
import { DREAMS_BY_KEY } from "./onboarding.js";

export interface DreamMetrics {
  /** Customer orders served at the player's counter, all time. */
  customersServed: number;
  /** City Coins earned from sales (takings + orders), all time. */
  salesEarned: number;
  /** Best finishing rank in a completed week of standings; null if never ranked. */
  bestWeekRank: number | null;
  /** Rank in the current week so far; null if not on the board. */
  rankThisWeek: number | null;
  /** Friends made (friends are not open yet). */
  friends: number;
}

export interface DreamStep {
  /** Threshold on the dream's score. */
  at: number;
  label: string;
  reward: number;
}

interface DreamPlan {
  unit: string;
  score: (m: DreamMetrics) => number;
  steps: DreamStep[];
  /** Not playable yet: shown, but nothing can be reached. */
  locked?: string;
  note?: (m: DreamMetrics) => string | undefined;
}

/** Finishing rank → legend score: top 10 = 1, top 3 = 2, first = 3. */
export const legendScore = (rank: number | null) => (rank === null ? 0 : rank <= 1 ? 3 : rank <= 3 ? 2 : rank <= 10 ? 1 : 0);

const PLANS: Record<string, DreamPlan> = {
  market_royalty: {
    unit: "customers",
    score: (m) => m.customersServed,
    steps: [
      { at: 10, label: "Serve 10 customers", reward: 100 },
      { at: 25, label: "Serve 25 customers", reward: 200 },
      { at: 50, label: "Serve 50 customers", reward: 300 },
      { at: 100, label: "Serve 100 customers", reward: 600 },
    ],
    note: () => "Serve the customer waiting at your counter in Market Square. A new one comes every 30 minutes.",
  },
  showroom: {
    unit: "City Coins earned",
    score: (m) => m.salesEarned,
    steps: [
      { at: 2_500, label: "Earn 2,500 from sales", reward: 100 },
      { at: 10_000, label: "Earn 10,000 from sales", reward: 200 },
      { at: 25_000, label: "Earn 25,000 from sales", reward: 300 },
      { at: 50_000, label: "Earn 50,000 from sales", reward: 600 },
    ],
    note: () => "Takings you collect from your shop and customer orders both count. Decor raises demand.",
  },
  junction_legend: {
    unit: "standing",
    score: (m) => legendScore(m.bestWeekRank),
    steps: [
      { at: 1, label: "Finish a week in the top 10", reward: 200 },
      { at: 2, label: "Finish a week in the top 3", reward: 400 },
      { at: 3, label: "Finish a week at number 1", reward: 800 },
    ],
    note: (m) => (m.rankThisWeek ? `You're number ${m.rankThisWeek} this week. Standings close Sunday midnight, Lagos time.` : "Sell this week to get on the standings."),
  },
  padi: {
    unit: "friends",
    score: (m) => m.friends,
    steps: [
      { at: 1, label: "Make your first friend", reward: 100 },
      { at: 3, label: "Make 3 friends", reward: 200 },
      { at: 5, label: "Make 5 friends", reward: 500 },
    ],
    locked: "Friends open in the private beta. Your progress starts then.",
  },
};

export interface DreamStepView extends DreamStep {
  reached: boolean;
  claimed: boolean;
}

export interface DreamView {
  key: string;
  title: string;
  goal: string;
  unit: string;
  value: number;
  target: number;
  steps: DreamStepView[];
  /** All steps reached. */
  achieved: boolean;
  locked?: string;
  note?: string;
}

/** Ledger reference for a step reward: one per player, dream and step. */
export const dreamRewardRef = (key: string, at: number) => `dream:${key}:${at}`;

export function dreamView(key: string, m: DreamMetrics, claimedRefs: ReadonlySet<string>): DreamView {
  const plan = PLANS[key] ?? PLANS.market_royalty!;
  const dream = DREAMS_BY_KEY.get(key) ?? DREAMS_BY_KEY.get("market_royalty")!;
  const value = plan.locked ? 0 : plan.score(m);
  const steps = plan.steps.map((s) => ({ ...s, reached: !plan.locked && value >= s.at, claimed: claimedRefs.has(dreamRewardRef(dream.key, s.at)) }));
  return {
    key: dream.key,
    title: dream.title,
    goal: dream.goal,
    unit: plan.unit,
    value,
    target: plan.steps[plan.steps.length - 1]!.at,
    steps,
    achieved: steps.every((s) => s.reached),
    locked: plan.locked,
    note: plan.locked ? undefined : plan.note?.(m),
  };
}

/** The step with this threshold, if the player has reached it. */
export function claimableStep(view: DreamView, at: number): DreamStepView | undefined {
  return view.steps.find((s) => s.at === at && s.reached);
}
