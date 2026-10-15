// Love life (see @hc/shared partners.ts): meet people where they hang out, chat, give gifts, go on dates, ask them
// out, move in, propose and marry at an owambe. One partner at a time. Closeness slips if you ignore each other.

import { partnerBonds, playerPlots, profiles, rentals } from "@hc/db";
import {
  CHATS_PER_DAY,
  DATE_EVERY_HOURS,
  DATE_SPOT_BY_VENUE,
  DRIFT_AFTER_DAYS,
  GAIN,
  GIFT_BY_KEY,
  NEED,
  NPC_BY_KEY,
  PARTNER_PREFS,
  WEDDING,
  chatGain,
  chatPromptFor,
  dayKey,
  together,
  type BondStage,
  type BondView,
  type GiftKey,
  type LoveView,
  type Npc,
  type PartnerPref,
} from "@hc/shared";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";
import { requireUser } from "../../plugins/auth.js";
import { loadNeeds, needsView, saveNeeds } from "./needs.js";
import { recordEvents } from "./quests.js";

type Bond = typeof partnerBonds.$inferSelect;
const DAY = 86_400_000;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Closeness after neglect: a point a day once you've gone quiet for a few days, never below friends. */
function drifted(b: Bond, now: Date): number {
  const days = Math.floor((now.getTime() - b.lastAt.getTime()) / DAY) - DRIFT_AFTER_DAYS;
  if (days <= 0) return b.closeness;
  return Math.max(Math.min(b.closeness, NEED.friends), b.closeness - days);
}

/** Living somewhere of your own (a house you built or a flat you rent): needed to move in together. */
async function hasOwnHome(tx: Tx, userId: string) {
  const [plot] = await tx.select({ d: playerPlots.design }).from(playerPlots).where(and(eq(playerPlots.userId, userId), eq(playerPlots.isHome, true)));
  if (plot?.d) return true;
  const [flat] = await tx.select({ id: rentals.userId }).from(rentals).where(eq(rentals.userId, userId));
  return !!flat;
}

/** Your partner living with you (for the home and a better night's sleep), or null. */
export async function partnerAtHome(tx: Tx, userId: string): Promise<Npc | null> {
  const rows = await tx.select().from(partnerBonds).where(eq(partnerBonds.userId, userId));
  const b = rows.find((r) => r.stage === "living" || r.stage === "engaged" || r.stage === "married");
  return b ? (NPC_BY_KEY.get(b.npc) ?? null) : null;
}

export async function partnerRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date()));

  const bondView = (b: Bond, now: Date, ownHome: boolean, partner: string | null): BondView => {
    const closeness = drifted(b, now);
    const stage = b.stage as BondStage;
    const day = dayKey(now, tz);
    const next = b.dateAt ? b.dateAt.getTime() + DATE_EVERY_HOURS * 3_600_000 : 0;
    return {
      npc: b.npc,
      stage,
      closeness,
      chatsLeft: b.chatDay === day ? Math.max(0, CHATS_PER_DAY - b.chatsOnDay) : CHATS_PER_DAY,
      giftToday: b.giftDay === day,
      dateAt: next > now.getTime() ? new Date(next).toISOString() : null,
      prompt: chatPromptFor(b.npc, b.chats),
      can: {
        askOut: (stage === "met" || stage === "friends") && closeness >= NEED.askOut && (partner === null || partner === b.npc),
        moveIn: stage === "dating" && closeness >= NEED.moveIn && ownHome,
        propose: stage === "living" && closeness >= NEED.propose,
        wedding: stage === "engaged",
      },
    };
  };

  const loveView = async (tx: Tx, userId: string, now: Date): Promise<LoveView> => {
    const [p] = await tx.select({ pref: profiles.partnerPref }).from(profiles).where(eq(profiles.userId, userId));
    const rows = await tx.select().from(partnerBonds).where(eq(partnerBonds.userId, userId));
    const partner = rows.find((r) => together(r.stage as BondStage))?.npc ?? null;
    const ownHome = await hasOwnHome(tx, userId);
    return {
      pref: (p?.pref as PartnerPref | null) ?? null,
      partner,
      bonds: rows.sort((a, b) => b.closeness - a.closeness).map((b) => bondView(b, now, ownHome, partner)),
    };
  };

  /** Your bond with someone you've met, locked for the change; 404 if you haven't met. */
  const bondFor = async (tx: Tx, userId: string, key: string) => {
    if (!NPC_BY_KEY.has(key)) throw notFound("Person");
    const [b] = await tx.select().from(partnerBonds).where(and(eq(partnerBonds.userId, userId), eq(partnerBonds.npc, key))).for("update");
    if (!b) throw new AppError(409, "not_met", "You haven't met yet. Find them where they hang out.");
    return b;
  };
  /** Save closeness (and the stage it reaches on its own: friends), touching `lastAt`. */
  const saveBond = async (tx: Tx, b: Bond, now: Date, set: Partial<Bond>) => {
    const closeness = clamp(set.closeness ?? drifted(b, now));
    const stage = set.stage ?? (b.stage === "met" && closeness >= NEED.friends ? "friends" : b.stage);
    await tx
      .update(partnerBonds)
      .set({ ...set, closeness, stage, lastAt: now })
      .where(and(eq(partnerBonds.userId, b.userId), eq(partnerBonds.npc, b.npc)));
  };

  app.get("/api/love", async (request) => {
    const user = requireUser(request);
    return inTx((tx, now) => loveView(tx, user.id, now));
  });

  app.put("/api/love/pref", async (request) => {
    const user = requireUser(request);
    const { pref } = z.object({ pref: z.enum(PARTNER_PREFS as [PartnerPref, ...PartnerPref[]]) }).parse(request.body);
    return inTx(async (tx, now) => {
      await tx.update(profiles).set({ partnerPref: pref }).where(eq(profiles.userId, user.id));
      return loveView(tx, user.id, now);
    });
  });

  // Say hi to someone at a place they hang out.
  app.post<{ Params: { npc: string } }>("/api/love/:npc/meet", async (request, reply) => {
    const user = requireUser(request);
    const npc = NPC_BY_KEY.get(request.params.npc);
    if (!npc) throw notFound("Person");
    const { at } = z.object({ at: z.string().max(60) }).parse(request.body ?? {});
    if (!npc.hangouts.includes(at.split("@")[0]!)) throw new AppError(409, "not_here", `${npc.name} isn't here.`);
    const view = await inTx(async (tx, now) => {
      const fresh = await tx.insert(partnerBonds).values({ userId: user.id, npc: npc.key, closeness: 5, lastAt: now }).onConflictDoNothing().returning();
      if (fresh.length) await recordEvents(tx, user.id, [{ type: "love_met", key: npc.key }], now, tz);
      return loveView(tx, user.id, now);
    });
    return reply.code(201).send(view);
  });

  // Answer what they brought up: an answer that suits them brings you closer.
  app.post<{ Params: { npc: string } }>("/api/love/:npc/chat", async (request) => {
    const user = requireUser(request);
    const { answer } = z.object({ answer: z.number().int().min(0).max(2) }).parse(request.body);
    return inTx(async (tx, now) => {
      const b = await bondFor(tx, user.id, request.params.npc);
      const npc = NPC_BY_KEY.get(b.npc)!;
      const day = dayKey(now, tz);
      const used = b.chatDay === day ? b.chatsOnDay : 0;
      const prompt = chatPromptFor(b.npc, b.chats);
      const picked = prompt.answers[answer] ?? prompt.answers[0]!;
      // After a few chats in a day they're busy: you still talk, but it doesn't count.
      const gained = used < CHATS_PER_DAY ? chatGain(npc, picked.trait) : 0;
      await saveBond(tx, b, now, { closeness: drifted(b, now) + gained, chats: b.chats + 1, chatDay: day, chatsOnDay: used + 1 });
      await recordEvents(tx, user.id, [{ type: "love_chat" }], now, tz);
      if (gained) {
        const { needs, freeAt } = await loadNeeds(tx, user.id, now);
        await saveNeeds(tx, user.id, { ...needs, social: Math.min(100, needs.social + 4) }, now, freeAt);
      }
      const reaction = gained >= GAIN.chatLiked ? "loved that" : gained > GAIN.chatMeh ? "smiled" : gained ? "nodded" : "had to run";
      return { gained, reaction, love: await loveView(tx, user.id, now) };
    });
  });

  app.post<{ Params: { npc: string } }>("/api/love/:npc/gift", async (request) => {
    const user = requireUser(request);
    const { gift } = z.object({ gift: z.string() }).parse(request.body);
    const g = GIFT_BY_KEY.get(gift as GiftKey);
    if (!g) throw new AppError(400, "bad_gift", "Pick a gift from the list.");
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const b = await bondFor(tx, user.id, request.params.npc);
      const npc = NPC_BY_KEY.get(b.npc)!;
      const day = dayKey(now, tz);
      if (b.giftDay === day) throw new AppError(409, "gift_today", `You already gave ${npc.name} something today.`);
      const { balance } = await postCoins(tx, user.id, -g.cost, "love", `love:gift:${b.npc}:${day}`);
      const gained = npc.likes.includes(g.key) ? GAIN.giftLiked : GAIN.gift;
      await saveBond(tx, b, now, { closeness: drifted(b, now) + gained, giftDay: day });
      return { gained, balance, love: await loveView(tx, user.id, now) };
    });
  });

  // A date at one of the spots (from friends up): fun and closeness for both of you.
  app.post<{ Params: { npc: string } }>("/api/love/:npc/date", async (request) => {
    const user = requireUser(request);
    const { venue } = z.object({ venue: z.string() }).parse(request.body);
    const spot = DATE_SPOT_BY_VENUE.get(venue);
    if (!spot) throw new AppError(400, "bad_spot", "Pick a place from the list.");
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const b = await bondFor(tx, user.id, request.params.npc);
      const npc = NPC_BY_KEY.get(b.npc)!;
      if (b.stage === "met") throw new AppError(409, "too_soon", `Get to know ${npc.name} a bit first (chat, a small gift).`);
      // Dates any time; closeness grows once every few hours.
      const counts = !b.dateAt || now.getTime() - b.dateAt.getTime() >= DATE_EVERY_HOURS * 3_600_000;
      const { balance } = await postCoins(tx, user.id, -spot.cost, "love", `love:date:${b.npc}:${now.toISOString()}`);
      const gained = counts ? (npc.favDate === venue ? GAIN.dateFav : GAIN.date) : 0;
      await saveBond(tx, b, now, { closeness: drifted(b, now) + gained, ...(counts ? { dateAt: now } : {}) });
      await recordEvents(tx, user.id, [{ type: "date_done" }], now, tz);
      const { needs, freeAt } = await loadNeeds(tx, user.id, now);
      const after = { ...needs, fun: Math.min(100, needs.fun + spot.fun), social: Math.min(100, needs.social + 15) };
      await saveNeeds(tx, user.id, after, now, freeAt);
      return { gained, fav: npc.favDate === venue, balance, ...needsView(after), love: await loveView(tx, user.id, now) };
    });
  });

  /** The next step together; each checks closeness and where you are. */
  const step = (path: string, run: (tx: Tx, b: Bond, npc: Npc, now: Date, userId: string) => Promise<Partial<Bond>>) =>
    app.post<{ Params: { npc: string } }>(`/api/love/:npc/${path}`, async (request) => {
      const user = requireUser(request);
      return inTx(async (tx, now) => {
        await lockProfile(tx, user.id);
        const b = await bondFor(tx, user.id, request.params.npc);
        const set = await run(tx, b, NPC_BY_KEY.get(b.npc)!, now, user.id);
        await saveBond(tx, b, now, set);
        return loveView(tx, user.id, now);
      });
    });

  step("ask-out", async (tx, b, npc, now, userId) => {
    if (together(b.stage as BondStage)) throw new AppError(409, "already", `You and ${npc.name} are already together.`);
    const others = await tx.select().from(partnerBonds).where(eq(partnerBonds.userId, userId));
    const current = others.find((o) => o.npc !== b.npc && together(o.stage as BondStage));
    if (current) throw new AppError(409, "taken", `You're with ${NPC_BY_KEY.get(current.npc)?.name ?? "someone"}. One partner at a time.`);
    if (drifted(b, now) < NEED.askOut) throw new AppError(409, "not_yet", `${npc.name} likes you, but wants to know you better first.`);
    return { stage: "dating" };
  });
  step("move-in", async (tx, b, npc, now, userId) => {
    if (b.stage !== "dating") throw new AppError(409, "not_dating", `You need to be dating ${npc.name} first.`);
    if (drifted(b, now) < NEED.moveIn) throw new AppError(409, "not_yet", `${npc.name} isn't ready to move in yet. Spend more time together.`);
    if (!(await hasOwnHome(tx, userId))) throw new AppError(409, "no_home", "You need your own flat or house first (rent one or build on your land).");
    return { stage: "living" };
  });
  step("propose", async (_tx, b, npc, now) => {
    if (b.stage !== "living") throw new AppError(409, "not_living", `Live together with ${npc.name} first.`);
    if (drifted(b, now) < NEED.propose) throw new AppError(409, "not_yet", `${npc.name} says "not yet". Keep loving them well.`);
    return { stage: "engaged" };
  });
  step("wedding", async (tx, b, npc, now, userId) => {
    if (b.stage !== "engaged") throw new AppError(409, "not_engaged", `Propose to ${npc.name} first.`);
    await postCoins(tx, userId, -WEDDING.cost, "love", `love:wedding:${b.npc}:${now.toISOString()}`);
    await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${WEDDING.xp}` }).where(eq(profiles.userId, userId));
    return { stage: "married", closeness: 100 };
  });
  step("break-up", async (_tx, b, npc, now) => {
    if (!together(b.stage as BondStage)) throw new AppError(409, "not_together", `You and ${npc.name} aren't together.`);
    return { stage: "friends", closeness: Math.max(0, drifted(b, now) - 30) };
  });
}
