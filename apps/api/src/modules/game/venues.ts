// Venue activities: pay City Coins at a place on the map, earn XP once per Lagos day per activity.
// The ledger reference makes each activity once a day; doing it again is refused before any charge.

import { gameLedgerEntries, profiles } from "@hc/db";
import { FREE_COOLDOWN_MS, NEED_GAIN, VENUES_BY_KEY, activityRef, clockHour, dayKey, fillNeeds, isOpenAt, lagosHourOf, venueActions, venueHours, type VenueDay } from "@hc/shared";
import { loadNeeds, needsView, saveNeeds } from "./needs.js";
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
  const posting = await postCoins(tx, userId, -activity.cost, "activity", activityRef(dayKey(now, timeZone), venue.key, activity.key));
  if (!posting.applied) throw new AppError(409, "done_today", "You've done that here today. Come back tomorrow.");
  const [p] = await tx
    .update(profiles)
    .set({ xp: sql`${profiles.xp} + ${activity.xp}` })
    .where(eq(profiles.userId, userId))
    .returning({ xp: profiles.xp });
  await recordEvents(tx, userId, [{ type: "activity_done", key: `${venue.key}:${activity.key}` }], now, timeZone);
  // The activity fills the needs its tags name.
  const { needs } = await loadNeeds(tx, userId, now);
  const filled = fillNeeds(needs, activity.gives, activity.kind === "flex" ? NEED_GAIN.flex : NEED_GAIN.paid);
  await saveNeeds(tx, userId, filled, now);
  return { balance: posting.balance, xp: p!.xp, gained: activity.xp, ...(await venueDay(ctx)), ...needsView(filled) };
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
  const filled = fresh ? fillNeeds(needs, free.gives, NEED_GAIN.free) : needs;
  await saveNeeds(tx, userId, filled, now, fresh ? { ...freeAt, [venue.key]: now.toISOString() } : freeAt);
  return { filled: fresh, ...needsView(filled) };
}
