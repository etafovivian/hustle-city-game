// "First day in Lagos": a guided tour for a new player on the map. Mama Nkechi shows them round: walk somewhere,
// eat something, take a ride, work a shift. Walking is noticed by the client; the other steps are recorded by the
// server as they happen (eating = any activity that fills Food), and the reward can only be claimed once, when all
// the server steps are done.

export type FirstDayStepKey = "walk" | "eat" | "ride" | "shift";

export interface FirstDayStep {
  key: FirstDayStepKey;
  title: string;
  /** What the guide says. */
  say: string;
  /** Noticed by the client (no server record). */
  client?: boolean;
}

export const FIRST_DAY = {
  guide: "Mama Nkechi",
  steps: [
    { key: "walk", title: "Take a walk", say: "Welcome to Lagos, my dear! First, stretch your legs: tap the road anywhere and walk there.", client: true },
    { key: "eat", title: "Eat something", say: "Hungry? Come to my buka for amala, or grab suya. Tap \"Show me\", then go in and eat.", },
    { key: "ride", title: "Take a ride", say: "Lagos is big. Pick a place far away and take a danfo, keke, okada or the BRT.", },
    { key: "shift", title: "Work a shift", say: "Now, money! Every place has jobs. Open a place, find Work, and do one shift.", },
  ] as readonly FirstDayStep[],
  rewardCoins: 1000,
  rewardXp: 50,
} as const;

export interface FirstDayView {
  /** Step keys done (server-recorded ones; the client adds "walk"). */
  done: FirstDayStepKey[];
  claimed: boolean;
}
