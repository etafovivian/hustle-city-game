// "Bring your crew" invites (see @hc/shared crew.ts) and play nights: who's coming, and prizes for table wins.

import { contacts, playNightRsvps, profiles, referrals } from "@hc/db";
import { CREW, EVENT_BY_KEY, PLAY_NIGHTS, isEventOn, lagosDate, upcoming, type CrewView, type PlayNightView } from "@hc/shared";
import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { postCoins } from "../lib/coins.js";
import { lockProfile, type Tx } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";
import { sendPing } from "./presence.js";

type Db = FastifyInstance["db"];

/** At sign-up with a crew link: welcome coins, contacts both ways, and tell the inviter. */
export async function joinCrew(tx: Tx, inviteeId: string, inviteeNick: string, crew: string) {
  const [inviter] = await tx.select({ userId: profiles.userId, nickname: profiles.nickname }).from(profiles).where(sql`lower(${profiles.nickname}) = lower(${crew})`);
  if (!inviter || inviter.userId === inviteeId) return;
  await tx.insert(referrals).values({ inviteeId, inviterId: inviter.userId }).onConflictDoNothing();
  await tx
    .insert(contacts)
    .values([
      { userId: inviteeId, contactId: inviter.userId },
      { userId: inviter.userId, contactId: inviteeId },
    ])
    .onConflictDoNothing();
  await postCoins(tx, inviteeId, CREW.welcome, "game_reward", "crew:welcome");
  sendPing(inviter.userId, { from: inviteeNick, kind: "note", place: null, text: `@${inviteeNick} joined with your invite! You get ${CREW.reward.toLocaleString()} coins once they've played a bit.` });
}

/** Pay the inviter once the friend has really played (checked when the friend's game loads). */
export async function settleCrew(db: Db, inviteeId: string) {
  const [ref] = await db.select().from(referrals).where(eq(referrals.inviteeId, inviteeId));
  if (!ref || ref.rewardedAt) return;
  const [me] = await db.select({ xp: profiles.xp, nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, inviteeId));
  if (!me || me.xp < CREW.qualifyXp) return;
  await db.transaction(async (tx) => {
    await lockProfile(tx, ref.inviterId);
    const [{ n }] = (await tx.select({ n: count() }).from(referrals).where(and(eq(referrals.inviterId, ref.inviterId), isNotNull(referrals.rewardedAt)))) as [{ n: number }];
    const [row] = await tx.update(referrals).set({ rewardedAt: new Date() }).where(and(eq(referrals.inviteeId, inviteeId), sql`${referrals.rewardedAt} is null`)).returning();
    if (!row || Number(n) >= CREW.maxRewards) return;
    const posting = await postCoins(tx, ref.inviterId, CREW.reward, "game_reward", `crew:reward:${inviteeId}`);
    if (posting.applied) await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${CREW.rewardXp}` }).where(eq(profiles.userId, ref.inviterId));
    sendPing(ref.inviterId, { from: me.nickname, kind: "note", place: null, text: `🎁 @${me.nickname} is playing for real: +${CREW.reward.toLocaleString()} coins and +${CREW.rewardXp} XP for bringing them.` });
  });
}

export async function crewRoutes(app: FastifyInstance) {
  app.get("/api/crew", async (request): Promise<CrewView> => {
    const user = requireUser(request);
    const [me] = await app.db.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, user.id));
    const rows = await app.db
      .select({ nickname: profiles.nickname, xp: profiles.xp, rewardedAt: referrals.rewardedAt })
      .from(referrals)
      .innerJoin(profiles, eq(profiles.userId, referrals.inviteeId))
      .where(eq(referrals.inviterId, user.id));
    return {
      code: me?.nickname ?? "",
      friends: rows.map((r) => ({ nickname: r.nickname, played: !!r.rewardedAt || r.xp >= CREW.qualifyXp })),
      rewarded: rows.filter((r) => r.rewardedAt).length,
    };
  });

  // Play nights: the next one of each, who's coming.
  const nightsView = async (userId: string): Promise<PlayNightView[]> => {
    const now = new Date();
    const next = upcoming(now).filter((u) => u.event.playNight);
    const out: PlayNightView[] = [];
    for (const u of next) {
      const day = lagosDate(u.start);
      const rows = await app.db
        .select({ userId: playNightRsvps.userId, nickname: profiles.nickname })
        .from(playNightRsvps)
        .innerJoin(profiles, eq(profiles.userId, playNightRsvps.userId))
        .where(and(eq(playNightRsvps.event, u.event.key), eq(playNightRsvps.day, day)));
      out.push({
        key: u.event.key,
        name: u.event.name,
        icon: u.event.icon,
        blurb: u.event.blurb,
        venue: u.event.venues[0]!,
        start: u.start.toISOString(),
        on: u.on,
        day,
        coming: rows.length,
        you: rows.some((r) => r.userId === userId),
        names: rows.map((r) => r.nickname).slice(0, 8),
      });
    }
    return out;
  };
  app.get("/api/play-nights", async (request) => nightsView(requireUser(request).id));

  app.post<{ Params: { key: string } }>("/api/play-nights/:key/rsvp", async (request) => {
    const user = requireUser(request);
    const e = EVENT_BY_KEY.get(request.params.key);
    if (!e?.playNight) throw notFound("Play night");
    const night = (await nightsView(user.id)).find((n) => n.key === e.key)!;
    if (night.you) await app.db.delete(playNightRsvps).where(and(eq(playNightRsvps.event, e.key), eq(playNightRsvps.day, night.day), eq(playNightRsvps.userId, user.id)));
    else await app.db.insert(playNightRsvps).values({ event: e.key, day: night.day, userId: user.id }).onConflictDoNothing();
    return nightsView(user.id);
  });
}

/** The play night on at a place now (by its key; a branch counts as its original), if any. */
export const playNightAt = (place: string, at: Date) => PLAY_NIGHTS.find((e) => e.venues.includes(place.split("@")[0]!) && isEventOn(e, at)) ?? null;
