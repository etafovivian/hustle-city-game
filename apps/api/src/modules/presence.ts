// Presence: who's in the city right now and where, so friends can find each other, meet at a place, wave and
// buy each other a drink. Kept in memory (one API process); a player counts as online for a minute after their
// last report. Nothing here is stored except the coins and needs a drink moves.

import { contacts, directMessages, gameLedgerEntries, profiles } from "@hc/db";
import { NEED_GAIN, chatProblem, dayKey, fillNeeds, type AvatarConfig, type ChatMessage, type ContactView, type DmThread, type PresenceReply, type PresencePlayer } from "@hc/shared";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, isNull, like, or, sql } from "drizzle-orm";
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
  kind: "wave" | "drink" | "join" | "invite" | "challenge" | "note";
  text?: string;
  place: string | null;
  at: number;
}

/** Who's where right now (shared with the activity code, for "together" bonuses). */
const seen = new Map<string, Seen>();
const inbox = new Map<string, Ping[]>();

/** Other players online at the same place (a branch counts as its original). */
export function companionsAt(userId: string, baseVenue: string): { userId: string; nickname: string }[] {
  const now = Date.now();
  const me = seen.get(userId);
  if (!me?.place || me.place.split("@")[0] !== baseVenue) return [];
  return [...seen.values()].filter((s) => s.userId !== userId && now - s.at < ONLINE_MS && s.place === me.place).map((s) => ({ userId: s.userId, nickname: s.nickname }));
}

/** Where a player is right now (a place key), or null when out in the city or offline. */
export function placeOf(userId: string): string | null {
  const s = seen.get(userId);
  return s && Date.now() - s.at < ONLINE_MS ? (s.place ?? null) : null;
}

/** Tell someone about something (shown as a toast next time their game reports in). */
export function sendPing(toUserId: string, ping: { from: string; kind: Ping["kind"]; place: string | null; text?: string }) {
  const list = inbox.get(toUserId) ?? [];
  list.push({ ...ping, id: randomUUID(), at: Date.now() });
  inbox.set(toUserId, list.slice(-20));
}

/** Find someone online by nickname (for game challenges). */
export function onlineByNick(nick: string) {
  const now = Date.now();
  return [...seen.values()].find((s) => now - s.at < ONLINE_MS && s.nickname.toLowerCase() === nick.toLowerCase());
}
export const nicknameOf = (userId: string) => seen.get(userId)?.nickname;

export async function presenceRoutes(app: FastifyInstance) {
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
    // Ogun State lies north of Lagos on the map (y down to about -5600).
    y: z.number().finite().min(-6000).max(20_000),
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
    const [{ n: unread }] = (await app.db
      .select({ n: count() })
      .from(directMessages)
      .where(and(eq(directMessages.toId, user.id), isNull(directMessages.readAt)))) as [{ n: number }];
    return {
      unread: Number(unread),
      players: online(now)
        .filter((s) => s.userId !== user.id)
        .map(view),
      pings: pings.map((p) => ({ from: p.from, kind: p.kind, place: p.place, ...(p.text ? { text: p.text } : {}) })),
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

  // Invite someone online to your house.
  app.post("/api/presence/invite", { config: { rateLimit: { max: 20 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } }, async (request) => {
    const user = requireUser(request);
    const { to } = z.object({ to: z.string().max(30) }).parse(request.body);
    const me = seen.get(user.id);
    const them = byNick(to, Date.now());
    if (!me || !them || them.userId === user.id) throw new AppError(404, "not_here", "They're not around right now.");
    push(them.userId, { from: me.nickname, kind: "invite", place: null });
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

  // ── Room chat: whoever is at a place can talk there (kept in memory: the last 50 messages, for two hours) ──
  const rooms = new Map<string, { id: string; userId: string; from: string; body: string; at: number }[]>();
  const ROOM_TTL = 2 * 60 * 60_000;
  const roomMessages = (place: string, viewer: string): ChatMessage[] => {
    const now = Date.now();
    const list = (rooms.get(place) ?? []).filter((m) => now - m.at < ROOM_TTL);
    rooms.set(place, list);
    return list.map((m) => ({ id: m.id, from: m.from, body: m.body, at: new Date(m.at).toISOString(), mine: m.userId === viewer }));
  };
  const placeParam = (raw: string) => {
    if (!/^[a-zA-Z0-9_@:+-]{2,80}$/.test(raw)) throw new AppError(400, "bad_place", "Unknown place.");
    return raw;
  };

  app.get<{ Params: { place: string } }>("/api/chat/place/:place", async (request) => {
    const user = requireUser(request);
    return roomMessages(placeParam(request.params.place), user.id);
  });

  app.post<{ Params: { place: string } }>(
    "/api/chat/place/:place",
    { config: { rateLimit: { max: 12 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } },
    async (request) => {
      const user = requireUser(request);
      const place = placeParam(request.params.place);
      const { body } = z.object({ body: z.string().max(400) }).parse(request.body);
      const problem = chatProblem(body);
      if (problem) throw new AppError(400, "bad_message", problem);
      const me = seen.get(user.id);
      if (!me || me.place !== place) throw new AppError(409, "not_here", "Go inside first to talk here.");
      const list = rooms.get(place) ?? [];
      list.push({ id: randomUUID(), userId: user.id, from: me.nickname, body: body.trim(), at: Date.now() });
      rooms.set(place, list.slice(-50));
      return roomMessages(place, user.id);
    },
  );

  // ── Private messages ──
  const userByNick = async (nick: string) => {
    const [p] = await app.db
      .select({ userId: profiles.userId, nickname: profiles.nickname })
      .from(profiles)
      .where(sql`lower(${profiles.nickname}) = lower(${nick})`);
    if (!p) throw notFound("Player");
    return p;
  };

  app.get("/api/chat/dm", async (request): Promise<DmThread[]> => {
    const user = requireUser(request);
    const rows = await app.db
      .select({ m: directMessages, fromNick: sql<string>`(select nickname from profiles where user_id = ${directMessages.fromId})`, toNick: sql<string>`(select nickname from profiles where user_id = ${directMessages.toId})` })
      .from(directMessages)
      .where(or(eq(directMessages.fromId, user.id), eq(directMessages.toId, user.id)))
      .orderBy(desc(directMessages.createdAt))
      .limit(300);
    const threads = new Map<string, DmThread>();
    for (const { m, fromNick, toNick } of rows) {
      const other = m.fromId === user.id ? toNick : fromNick;
      const t = threads.get(other) ?? { with: other, last: m.body, at: m.createdAt.toISOString(), unread: 0 };
      if (m.toId === user.id && !m.readAt) t.unread++;
      threads.set(other, t);
    }
    return [...threads.values()];
  });

  app.get<{ Params: { nick: string } }>("/api/chat/dm/:nick", async (request): Promise<ChatMessage[]> => {
    const user = requireUser(request);
    const other = await userByNick(request.params.nick.slice(0, 30));
    const pair = or(and(eq(directMessages.fromId, user.id), eq(directMessages.toId, other.userId)), and(eq(directMessages.fromId, other.userId), eq(directMessages.toId, user.id)));
    const rows = await app.db.select().from(directMessages).where(pair).orderBy(desc(directMessages.createdAt)).limit(100);
    await app.db
      .update(directMessages)
      .set({ readAt: new Date() })
      .where(and(eq(directMessages.fromId, other.userId), eq(directMessages.toId, user.id), isNull(directMessages.readAt)));
    return rows.reverse().map((m) => ({ id: m.id, from: m.fromId === user.id ? "you" : other.nickname, body: m.body, at: m.createdAt.toISOString(), mine: m.fromId === user.id }));
  });

  app.post<{ Params: { nick: string } }>(
    "/api/chat/dm/:nick",
    { config: { rateLimit: { max: 20 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const user = requireUser(request);
      const other = await userByNick(request.params.nick.slice(0, 30));
      if (other.userId === user.id) throw new AppError(400, "self", "That's you!");
      const { body } = z.object({ body: z.string().max(400) }).parse(request.body);
      const problem = chatProblem(body);
      if (problem) throw new AppError(400, "bad_message", problem);
      await app.db.insert(directMessages).values({ fromId: user.id, toId: other.userId, body: body.trim() });
      return reply.code(201).send({ ok: true });
    },
  );

  // ── Contacts ──
  app.get("/api/contacts", async (request): Promise<ContactView[]> => {
    const user = requireUser(request);
    const rows = await app.db
      .select({ id: profiles.userId, nickname: profiles.nickname, avatar: profiles.avatar })
      .from(contacts)
      .innerJoin(profiles, eq(profiles.userId, contacts.contactId))
      .where(eq(contacts.userId, user.id))
      .orderBy(profiles.nickname);
    const now = Date.now();
    return rows.map((r) => {
      const s = seen.get(r.id);
      const on = !!s && now - s.at < ONLINE_MS;
      return { nickname: r.nickname, avatar: r.avatar as AvatarConfig, online: on, place: on ? s!.place : null, x: on ? Math.round(s!.x) : null, y: on ? Math.round(s!.y) : null };
    });
  });

  app.post<{ Params: { nick: string } }>("/api/contacts/:nick", async (request, reply) => {
    const user = requireUser(request);
    const other = await userByNick(request.params.nick.slice(0, 30).replace(/^@/, ""));
    if (other.userId === user.id) throw new AppError(400, "self", "That's you!");
    const [{ n }] = (await app.db.select({ n: count() }).from(contacts).where(eq(contacts.userId, user.id))) as [{ n: number }];
    if (Number(n) >= 200) throw new AppError(409, "too_many", "You have 200 contacts already.");
    await app.db.insert(contacts).values({ userId: user.id, contactId: other.userId }).onConflictDoNothing();
    const me = seen.get(user.id);
    if (me) push(other.userId, { from: me.nickname, kind: "wave", place: null });
    return reply.code(201).send({ ok: true, nickname: other.nickname });
  });

  app.delete<{ Params: { nick: string } }>("/api/contacts/:nick", async (request) => {
    const user = requireUser(request);
    const other = await userByNick(request.params.nick.slice(0, 30));
    await app.db.delete(contacts).where(and(eq(contacts.userId, user.id), eq(contacts.contactId, other.userId)));
    return { ok: true };
  });
}
