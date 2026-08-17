// Presence: who's in the city right now and where, so friends can find each other, meet at a place, wave and
// buy each other a drink. Kept in memory (one API process); a player counts as online for a minute after their
// last report. Nothing here is stored except the coins and needs a drink moves.

import { gameLedgerEntries, profiles } from "@hc/db";
import { NEED_GAIN, dayKey, fillNeeds, type AvatarConfig, type PresenceReply, type PresencePlayer } from "@hc/shared";
import { randomUUID } from "node:crypto";
import { and, count, eq, like } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { lockProfile } from "../lib/db.js";
import { AppError, notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";
import { loadNeeds, saveNeeds } from "./game/needs.js";

const ONLINE_MS = 60_000;
/** A drink costs this, and each pair can share a few a day. */
export const TREAT = { coins: 300, perDay: 3 };
/** "Near": close enough on the map to wave, or at the same place. */
const NEAR = 900;

interface Seen {
  userId: string;
  nickname: string;
  avatar: AvatarConfig;
  x: number;
  y: number;
  place: string | null;
  at: number;
}
interface Ping {
  id: string;
  from: string;
  kind: "wave" | "drink";
  place: string | null;
  at: number;
}

export async function presenceRoutes(app: FastifyInstance) {
  const seen = new Map<string, Seen>();
  const inbox = new Map<string, Ping[]>();
  const tz = app.config.GAME_TIMEZONE;

  const online = (now: number) => [...seen.values()].filter((s) => now - s.at < ONLINE_MS);
  const byNick = (nick: string, now: number) => online(now).find((s) => s.nickname.toLowerCase() === nick.toLowerCase());
  const near = (a: Seen, b: Seen) => (a.place && a.place === b.place) || Math.hypot(a.x - b.x, a.y - b.y) < NEAR;
  const view = (s: Seen): PresencePlayer => ({ nickname: s.nickname, avatar: s.avatar, x: Math.round(s.x), y: Math.round(s.y), place: s.place });
  const push = (userId: string, p: Omit<Ping, "id" | "at">) => {
    const list = inbox.get(userId) ?? [];
    list.push({ ...p, id: randomUUID(), at: Date.now() });
    inbox.set(userId, list.slice(-20));
  };

  const body = z.object({
    x: z.number().finite().min(-1000).max(20_000),
    y: z.number().finite().min(-1000).max(20_000),
    place: z.string().max(80).nullable().optional(),
  });

  // Report where you are; get everyone else online, and anything sent to you.
  app.post("/api/presence", { config: { rateLimit: { max: 40 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } }, async (request): Promise<PresenceReply> => {
    const user = requireUser(request);
    const b = body.parse(request.body);
    const now = Date.now();
    let me = seen.get(user.id);
    if (!me) {
      const [p] = await app.db.select({ nickname: profiles.nickname, hidden: profiles.nicknameHidden, avatar: profiles.avatar }).from(profiles).where(eq(profiles.userId, user.id));
      if (!p) throw notFound("Profile");
      me = { userId: user.id, nickname: p.hidden ? "player" : p.nickname, avatar: p.avatar as AvatarConfig, x: b.x, y: b.y, place: null, at: now };
    }
    Object.assign(me, { x: b.x, y: b.y, place: b.place ?? null, at: now });
    seen.set(user.id, me);
    // Forget people who left long ago.
    for (const [id, s] of seen) if (now - s.at > 10 * ONLINE_MS) seen.delete(id);
    const pings = inbox.get(user.id) ?? [];
    inbox.delete(user.id);
    return {
      players: online(now)
        .filter((s) => s.userId !== user.id)
        .map(view),
      pings: pings.map((p) => ({ from: p.from, kind: p.kind, place: p.place })),
    };
  });

  // Wave at someone online.
  app.post("/api/presence/wave", { config: { rateLimit: { max: 30 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } }, async (request) => {
    const user = requireUser(request);
    const { to } = z.object({ to: z.string().max(30) }).parse(request.body);
    const now = Date.now();
    const me = seen.get(user.id);
    const them = byNick(to, now);
    if (!me || !them || them.userId === user.id) throw new AppError(404, "not_here", "They're not around right now.");
    push(them.userId, { from: me.nickname, kind: "wave", place: me.place });
    return { ok: true };
  });

  // Buy someone nearby a drink: costs you, lifts both of you (Social and Fun).
  app.post("/api/presence/treat", async (request) => {
    const user = requireUser(request);
    const { to } = z.object({ to: z.string().max(30) }).parse(request.body);
    const now = new Date();
    const me = seen.get(user.id);
    const them = byNick(to, now.getTime());
    if (!me || !them || them.userId === user.id) throw new AppError(404, "not_here", "They're not around right now.");
    if (!near(me, them)) throw new AppError(409, "too_far", `Go to where @${them.nickname} is first.`);
    const day = dayKey(now, tz);
    await app.db.transaction(async (tx) => {
      await lockProfile(tx, user.id);
      const [{ n }] = (await tx
        .select({ n: count() })
        .from(gameLedgerEntries)
        .where(and(eq(gameLedgerEntries.userId, user.id), like(gameLedgerEntries.reference, `treat:${day}:${them.userId}:%`)))) as [{ n: number }];
      if (Number(n) >= TREAT.perDay) throw new AppError(409, "enough", "You've bought them enough drinks today!");
      await postCoins(tx, user.id, -TREAT.coins, "treat", `treat:${day}:${them.userId}:${randomUUID()}`);
      for (const id of [user.id, them.userId]) {
        const { needs } = await loadNeeds(tx, id, now);
        await saveNeeds(tx, id, fillNeeds(needs, ["social", "fun"], NEED_GAIN.paid), now);
      }
    });
    push(them.userId, { from: me.nickname, kind: "drink", place: me.place });
    return { ok: true };
  });
}
