// Quest progress is advanced only by server-side game events (FR02).

import { questProgress, profiles } from "@hc/db";
import {
  INTRO_QUEST,
  QUESTS_BY_KEY,
  dailyQuestsFor,
  dayKey,
  type GameEvent,
  type QuestBoard,
} from "@hc/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";

const INTRO_DAY = "intro";

interface Tracked {
  day: string;
  questKey: string;
  event: GameEvent["type"];
  distinct: boolean;
}

function trackedFor(day: string, introClaimed: boolean): Tracked[] {
  const daily = dailyQuestsFor(day).map((q) => ({ day, questKey: q.key, event: q.event, distinct: !!q.distinct }));
  const intro = introClaimed
    ? []
    : INTRO_QUEST.steps.map((s) => ({ day: INTRO_DAY, questKey: s.event, event: s.event, distinct: s.distinct }));
  return [...daily, ...intro];
}

/**
 * Advance quest progress for events. Must run inside a transaction that has
 * already locked the player's profile (see lockProfile).
 */
export async function recordEvents(tx: Tx, userId: string, events: GameEvent[], now: Date, timeZone: string) {
  if (!events.length) return;
  const profile = await lockProfile(tx, userId);
  const tracked = trackedFor(dayKey(now, timeZone), !!profile.introClaimedAt);

  for (const t of tracked) {
    const matching = events.filter((e) => e.type === t.event);
    if (!matching.length) continue;

    const [row] = await tx
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.userId, userId), eq(questProgress.day, t.day), eq(questProgress.questKey, t.questKey)));
    if (row?.claimedAt) continue;

    let progress = row?.progress ?? 0;
    const seen = new Set(row?.seenKeys ?? []);
    for (const e of matching) {
      if (t.distinct) {
        if (e.key) seen.add(e.key);
        progress = seen.size;
      } else {
        progress += e.amount ?? 1;
      }
    }

    await tx
      .insert(questProgress)
      .values({ userId, day: t.day, questKey: t.questKey, progress, seenKeys: [...seen] })
      .onConflictDoUpdate({
        target: [questProgress.userId, questProgress.day, questProgress.questKey],
        set: { progress, seenKeys: [...seen], updatedAt: sql`now()` },
      });
  }
}

export async function questBoard(tx: Tx, userId: string, now: Date, timeZone: string): Promise<QuestBoard> {
  const day = dayKey(now, timeZone);
  const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) throw notFound("Profile");

  const rows = await tx
    .select()
    .from(questProgress)
    .where(and(eq(questProgress.userId, userId), inArray(questProgress.day, [day, INTRO_DAY])));
  const find = (d: string, k: string) => rows.find((r) => r.day === d && r.questKey === k);

  return {
    day,
    daily: dailyQuestsFor(day).map((q) => {
      const r = find(day, q.key);
      return {
        key: q.key,
        title: q.title,
        description: q.description,
        target: q.target,
        progress: Math.min(q.target, r?.progress ?? 0),
        rewardCoins: q.rewardCoins,
        rewardXp: q.rewardXp,
        claimed: !!r?.claimedAt,
      };
    }),
    intro: {
      title: INTRO_QUEST.title,
      description: INTRO_QUEST.description,
      steps: INTRO_QUEST.steps.map((s) => ({
        label: s.label,
        target: s.target,
        progress: profile.introClaimedAt ? s.target : Math.min(s.target, find(INTRO_DAY, s.event)?.progress ?? 0),
      })),
      rewardCoins: INTRO_QUEST.rewardCoins,
      rewardXp: INTRO_QUEST.rewardXp,
      claimed: !!profile.introClaimedAt,
    },
  };
}

const notReady = () => new AppError(422, "quest_incomplete", "Finish the quest before claiming.");

/** Claim a daily quest (once per day) or the intro quest (once ever). */
export async function claimQuest(tx: Tx, userId: string, questKey: string, now: Date, timeZone: string) {
  const profile = await lockProfile(tx, userId);

  if (questKey === INTRO_QUEST.key) {
    if (profile.introClaimedAt) throw new AppError(409, "already_claimed", "Already claimed.");
    const rows = await tx
      .select()
      .from(questProgress)
      .where(and(eq(questProgress.userId, userId), eq(questProgress.day, INTRO_DAY)));
    const done = INTRO_QUEST.steps.every((s) => (rows.find((r) => r.questKey === s.event)?.progress ?? 0) >= s.target);
    if (!done) throw notReady();
    await postCoins(tx, userId, INTRO_QUEST.rewardCoins, "intro_reward", "intro_reward");
    await tx
      .update(profiles)
      .set({ introClaimedAt: now, xp: sql`${profiles.xp} + ${INTRO_QUEST.rewardXp}` })
      .where(eq(profiles.userId, userId));
    return;
  }

  const day = dayKey(now, timeZone);
  const quest = QUESTS_BY_KEY.get(questKey);
  if (!quest || !dailyQuestsFor(day).some((q) => q.key === questKey)) throw notFound("Quest");

  const [row] = await tx
    .select()
    .from(questProgress)
    .where(and(eq(questProgress.userId, userId), eq(questProgress.day, day), eq(questProgress.questKey, questKey)));
  if (row?.claimedAt) throw new AppError(409, "already_claimed", "Already claimed today.");
  if (!row || row.progress < quest.target) throw notReady();

  await postCoins(tx, userId, quest.rewardCoins, "quest_reward", `quest:${day}:${questKey}`);
  await tx
    .update(questProgress)
    .set({ claimedAt: now })
    .where(and(eq(questProgress.userId, userId), eq(questProgress.day, day), eq(questProgress.questKey, questKey)));
  await tx
    .update(profiles)
    .set({ xp: sql`${profiles.xp} + ${quest.rewardXp}` })
    .where(eq(profiles.userId, userId));
}
