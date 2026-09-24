// Venue activities: pay City Coins at a place on the map, earn XP once per Lagos day per activity.
// The ledger reference makes each activity once a day; doing it again is refused before any charge.

import { gameLedgerEntries, playerItems, profiles } from "@hc/db";
import { CHIEF_TITLE, EVENT_NEED_BONUS, EVENT_XP, FREE_COOLDOWN_MS, NEED_GAIN, eventAt, VENUES_BY_KEY, activityRef, clockHour, dayKey, fillNeeds, isOpenAt, lagosHourOf, venueActions, venueHours, SKILL_POINTS, VENUE_SKILL, type VenueDay } from "@hc/shared";
import { loadNeeds, needsView, saveNeeds } from "./needs.js";
import { firstDayStep } from "./firstday.js";
import { addSkill } from "./skills.js";
import { companionsAt, sendPing, setTitle } from "../presence.js";
import { and, eq, like, sql } from "drizzle-orm";
import { postCoins } from "../../lib/coins.js";
import { lockProfile } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";
import { recordEvents } from "./quests.js";
import type { ShopCtx } from "./shop.js";

export async function venueDay({ tx, userId, now, timeZone }: ShopCtx): Promise<VenueDay> {
  const day = dayKey(now, timeZone);
  const rows = await tx
    .select({ reference: gameLedgerEntries.reference })
    .from(gameLedgerEntries)
    .where(and(eq(gameLedgerEntries.userId, userId), like(gameLedgerEntries.reference, `activity:${day}:%`)));
  return { done: rows.map((r) => r.reference.split(":").slice(2).join(":")) };
}

export async function doActivity(ctx: ShopCtx, venueKey: string, activityKey: string) {
  const { tx, userId, now, timeZone } = ctx;
  const venue = VENUES_BY_KEY.get(venueKey);
  // The free action needs no server: it costs nothing and gives no XP.
  const activity = venue ? venueActions(venue).find((a) => a.key === activityKey && a.kind !== "free") : undefined;
  if (!venue || !activity) throw notFound("Activity");
  if (!isOpenAt(venue, lagosHourOf(now))) {
    throw new AppError(409, "closed", `${venue.name} is closed now. It opens at ${clockHour(venueHours(venue)![0])}.`);
  }
  await lockProfile(tx, userId);
  if (venue.key === CHIEF_TITLE.venue && activity.kind === "flex") {
    const [has] = await tx.select().from(playerItems).where(and(eq(playerItems.userId, userId), eq(playerItems.item, CHIEF_TITLE.item)));
    if (has) throw new AppError(409, "titled", `You are already ${CHIEF_TITLE.label}. The Oba gives a title once.`);
  }
  const posting = await postCoins(tx, userId, -activity.cost, "activity", activityRef(dayKey(now, timeZone), venue.key, activity.key));
  if (!posting.applied) throw new AppError(409, "done_today", "You've done that here today. Come back tomorrow.");
  // Better together: friends at the same place make it count for more (+50% XP, and more Social).
  const friends = companionsAt(userId, venue.key);
  // Events (owambe Saturday, match night…) make everything there count for more, and stack with friends.
  const event = eventAt(venue.key, now);
  const gained = Math.round(activity.xp * (friends.length ? 1.5 : 1) * (event ? EVENT_XP : 1));
  const [p] = await tx
    .update(profiles)
    .set({ xp: sql`${profiles.xp} + ${gained}` })
    .where(eq(profiles.userId, userId))
    .returning({ xp: profiles.xp, nickname: profiles.nickname });
  for (const f of friends) sendPing(f.userId, { from: p!.nickname, kind: "join", place: venue.key, text: `${activity.label} at ${venue.name}` });
  await recordEvents(tx, userId, [{ type: "activity_done", key: `${venue.key}:${activity.key}` }], now, timeZone);
  if (activity.gives.includes("food")) await firstDayStep(tx, userId, "eat");
  // Practice makes perfect: the place's skill grows.
  await addSkill(tx, userId, VENUE_SKILL[venue.key], activity.kind === "flex" ? SKILL_POINTS.flex : SKILL_POINTS.activity);
  // The activity fills the needs its tags name.
  const { needs } = await loadNeeds(tx, userId, now);
  let filled = fillNeeds(needs, activity.gives, activity.kind === "flex" ? NEED_GAIN.flex : NEED_GAIN.paid);
  if (friends.length) filled = fillNeeds(filled, ["social"], 10);
  if (event) filled = fillNeeds(filled, event.gives, EVENT_NEED_BONUS);
  await saveNeeds(tx, userId, filled, now);
  // The palace's flex: the Oba gives you a chieftaincy title (kept for good, shown on your card).
  let title: string | undefined;
  if (venue.key === CHIEF_TITLE.venue && activity.kind === "flex") {
    await tx.insert(playerItems).values({ userId, item: CHIEF_TITLE.item }).onConflictDoNothing();
    setTitle(userId, (title = CHIEF_TITLE.label));
  }
  return { balance: posting.balance, xp: p!.xp, gained, ...(title ? { title } : {}), together: friends.map((f) => f.nickname), event: event?.name ?? null, ...(await venueDay(ctx)), ...needsView(filled) };
}

/** The free thing to do at a place: no coins or XP, a small lift to its needs (once an hour per place). */
export async function doFree(ctx: ShopCtx, venueKey: string) {
  const { tx, userId, now } = ctx;
  const venue = VENUES_BY_KEY.get(venueKey);
  const free = venue ? venueActions(venue).find((a) => a.kind === "free") : undefined;
  if (!venue || !free) throw notFound("Place");
  if (!isOpenAt(venue, lagosHourOf(now))) throw new AppError(409, "closed", `${venue.name} is closed now.`);
  await lockProfile(tx, userId);
  const { needs, freeAt } = await loadNeeds(tx, userId, now);
  const last = freeAt[venue.key] ? new Date(freeAt[venue.key]!).getTime() : 0;
  const fresh = now.getTime() - last >= FREE_COOLDOWN_MS;
  const event = eventAt(venue.key, now);
  const filled = fresh ? fillNeeds(needs, [...free.gives, ...(event?.gives ?? [])], NEED_GAIN.free + (event ? EVENT_NEED_BONUS : 0)) : needs;
  await saveNeeds(tx, userId, filled, now, fresh ? { ...freeAt, [venue.key]: now.toISOString() } : freeAt);
  return { filled: fresh, ...needsView(filled) };
}
