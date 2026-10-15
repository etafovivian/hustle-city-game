// House parties (see @hc/shared party.ts): throw one at your house, your contacts get an invite, friends who come
// by while it's on join in. One a Lagos day; an hour long.

import { contacts, houseParties, partyGuests, playerPlots, profiles } from "@hc/db";
import { PARTIES, PARTY_BY_KEY, PARTY_GUEST, PARTY_MINUTES, dayKey, plotInfo, type PartiesView, type PartySize, type PartyView } from "@hc/shared";
import { and, count, eq, gt, inArray, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";
import { requireUser } from "../../plugins/auth.js";
import { placeOf, sendPing } from "../presence.js";
import { loadNeeds, saveNeeds } from "./needs.js";
import { recordEvents } from "./quests.js";

type Party = typeof houseParties.$inferSelect;
const addXp = (tx: Tx, userId: string, xp: number) => tx.update(profiles).set({ xp: sql`${profiles.xp} + ${xp}` }).where(eq(profiles.userId, userId));
const boost = async (tx: Tx, userId: string, now: Date, g: { social: number; fun: number }) => {
  const { needs, freeAt } = await loadNeeds(tx, userId, now);
  await saveNeeds(tx, userId, { ...needs, social: Math.min(100, needs.social + g.social), fun: Math.min(100, needs.fun + g.fun) }, now, freeAt);
};

export async function partyRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date()));

  /** People you know, either way round. */
  const contactIds = async (tx: Tx, userId: string) => {
    const rows = await tx.select().from(contacts).where(or(eq(contacts.userId, userId), eq(contacts.contactId, userId)));
    return [...new Set(rows.map((r) => (r.userId === userId ? r.contactId : r.userId)))];
  };
  const view = async (tx: Tx, p: Party, userId: string): Promise<PartyView> => {
    const [host] = await tx.select({ n: profiles.nickname }).from(profiles).where(eq(profiles.userId, p.hostId));
    const [{ n }] = (await tx.select({ n: count() }).from(partyGuests).where(eq(partyGuests.partyId, p.id))) as [{ n: number }];
    const [mine] = await tx.select().from(partyGuests).where(and(eq(partyGuests.partyId, p.id), eq(partyGuests.userId, userId)));
    return { id: p.id, host: host?.n ?? "someone", plotId: p.plotId, area: plotInfo(p.plotId)?.area ?? null, size: p.size as PartySize, endsAt: p.endsAt.toISOString(), guests: Number(n), joined: !!mine };
  };
  const homePlot = async (tx: Tx, userId: string) => {
    const [plot] = await tx.select().from(playerPlots).where(and(eq(playerPlots.userId, userId), eq(playerPlots.isHome, true)));
    return plot?.design ? plot : null;
  };

  const partiesView = async (tx: Tx, userId: string, now: Date): Promise<PartiesView> => {
    const [mine] = await tx.select().from(houseParties).where(and(eq(houseParties.hostId, userId), gt(houseParties.endsAt, now)));
    const [today] = await tx.select().from(houseParties).where(and(eq(houseParties.hostId, userId), eq(houseParties.day, dayKey(now, tz))));
    const plot = await homePlot(tx, userId);
    const friends = await contactIds(tx, userId);
    const live = friends.length ? await tx.select().from(houseParties).where(and(inArray(houseParties.hostId, friends), gt(houseParties.endsAt, now))) : [];
    return {
      mine: mine ? await view(tx, mine, userId) : null,
      canThrow: !plot ? { ok: false, why: "Build a house on your own land to throw parties." } : today ? { ok: false, why: "You've had your party today. Throw another tomorrow." } : { ok: true, why: null },
      friends: await Promise.all(live.map((p) => view(tx, p, userId))),
    };
  };

  app.get("/api/parties", async (request) => {
    const user = requireUser(request);
    return inTx((tx, now) => partiesView(tx, user.id, now));
  });

  // Throw a party at your house: pay for it, feel it, and your contacts get an invite.
  app.post("/api/parties", async (request, reply) => {
    const user = requireUser(request);
    const { size } = z.object({ size: z.enum(PARTIES.map((p) => p.key) as [PartySize, ...PartySize[]]) }).parse(request.body);
    const kind = PARTY_BY_KEY.get(size)!;
    const result = await inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const plot = await homePlot(tx, user.id);
      if (!plot) throw new AppError(409, "no_house", "Build a house on your own land to throw parties.");
      if (kind.houses && !kind.houses.includes(plot.design!)) throw new AppError(409, "too_small", `A ${kind.label.toLowerCase()} needs a bigger house.`);
      const day = dayKey(now, tz);
      const [today] = await tx.select().from(houseParties).where(and(eq(houseParties.hostId, user.id), eq(houseParties.day, day)));
      if (today) throw new AppError(409, "partied", "You've had your party today. Throw another tomorrow.");
      const { balance } = await postCoins(tx, user.id, -kind.cost, "party", `party:${user.id}:${day}`);
      const [party] = await tx
        .insert(houseParties)
        .values({ hostId: user.id, plotId: plot.plotId, size, day, startsAt: now, endsAt: new Date(now.getTime() + PARTY_MINUTES * 60_000) })
        .returning();
      await boost(tx, user.id, now, kind.gives);
      await addXp(tx, user.id, kind.xp);
      await recordEvents(tx, user.id, [{ type: "party_fun" }], now, tz);
      // Invitations: every contact gets a note on their screen.
      const [me] = await tx.select({ n: profiles.nickname }).from(profiles).where(eq(profiles.userId, user.id));
      const area = plotInfo(plot.plotId)?.area;
      for (const id of await contactIds(tx, user.id))
        sendPing(id, { from: me!.n, kind: "note", place: `home:${plot.plotId}`, text: `${kind.icon} @${me!.n} is throwing a ${kind.label.toLowerCase()} at their house${area ? ` in ${area}` : ""}! Phone → Events to go.` });
      return { balance, party: await view(tx, party!, user.id), parties: await partiesView(tx, user.id, now) };
    });
    return reply.code(201).send(result);
  });

  // Join a friend's party: you have to be there (visiting their house while it's on).
  app.post<{ Params: { id: string } }>("/api/parties/:id/join", async (request) => {
    const user = requireUser(request);
    const id = z.string().uuid().parse(request.params.id);
    return inTx(async (tx, now) => {
      const [party] = await tx.select().from(houseParties).where(eq(houseParties.id, id));
      if (!party) throw notFound("Party");
      if (party.endsAt <= now) throw new AppError(409, "over", "That party is over.");
      if (party.hostId === user.id) throw new AppError(409, "own_party", "It's your party: you're already in it.");
      if (placeOf(user.id) !== `home:${party.plotId}`) throw new AppError(409, "not_there", "Go to their house first.");
      const added = await tx.insert(partyGuests).values({ partyId: id, userId: user.id, joinedAt: now }).onConflictDoNothing().returning();
      if (added.length) {
        await boost(tx, user.id, now, PARTY_GUEST);
        await addXp(tx, user.id, PARTY_GUEST.xp);
        await recordEvents(tx, user.id, [{ type: "party_fun" }], now, tz);
        const [{ n }] = (await tx.select({ n: count() }).from(partyGuests).where(eq(partyGuests.partyId, id))) as [{ n: number }];
        if (Number(n) <= PARTY_GUEST.maxGuestXp) await addXp(tx, party.hostId, PARTY_GUEST.hostXp);
        const [me] = await tx.select({ n: profiles.nickname }).from(profiles).where(eq(profiles.userId, user.id));
        sendPing(party.hostId, { from: me!.n, kind: "note", place: `home:${party.plotId}`, text: `🎉 @${me!.n} joined your party!` });
      }
      return { joined: added.length > 0, party: await view(tx, party, user.id) };
    });
  });
}
