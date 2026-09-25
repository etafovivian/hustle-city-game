// "First day in Lagos" (see @hc/shared firstday.ts): steps recorded as they happen, in quest_progress under the day
// "firstday" (one row per step, plus a "claimed" row once the reward is taken). Calls are cheap no-ops after that.

import { questProgress, profiles } from "@hc/db";
import { FIRST_DAY, type FirstDayStepKey, type FirstDayView } from "@hc/shared";
import { and, eq, sql } from "drizzle-orm";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";

const DAY = "firstday";

export async function firstDayStep(tx: Tx, userId: string, step: FirstDayStepKey) {
  await tx.insert(questProgress).values({ userId, day: DAY, questKey: step, progress: 1, seenKeys: [] }).onConflictDoNothing();
}

export async function firstDayView(tx: Tx, userId: string): Promise<FirstDayView> {
  const rows = await tx.select({ key: questProgress.questKey }).from(questProgress).where(and(eq(questProgress.userId, userId), eq(questProgress.day, DAY)));
  const keys = new Set(rows.map((r) => r.key));
  return { done: FIRST_DAY.steps.filter((s) => keys.has(s.key)).map((s) => s.key), claimed: keys.has("claimed") };
}

export async function claimFirstDay(tx: Tx, userId: string) {
  await lockProfile(tx, userId);
  const view = await firstDayView(tx, userId);
  if (view.claimed) throw new AppError(409, "already_claimed", "You've had your first-day gift already.");
  const missing = FIRST_DAY.steps.filter((s) => !s.client && !view.done.includes(s.key));
  if (missing.length) throw new AppError(422, "not_done", `Finish the tour first: ${missing.map((s) => s.title.toLowerCase()).join(", ")}.`);
  await tx.insert(questProgress).values({ userId, day: DAY, questKey: "claimed", progress: 1, seenKeys: [] });
  const posting = await postCoins(tx, userId, FIRST_DAY.rewardCoins, "intro_reward", "first_day_reward");
  await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${FIRST_DAY.rewardXp}` }).where(eq(profiles.userId, userId));
  return { coins: FIRST_DAY.rewardCoins, balance: posting.balance };
}
