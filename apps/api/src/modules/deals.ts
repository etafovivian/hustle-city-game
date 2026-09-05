// Deals: a business offers a discount it honours in real life; players claim one-time codes and show them at the
// counter; the business marks a code used and the player earns a small reward. Owner decision (2026-10-12): deals
// only, no cash, airtime or data. Deals from verified businesses go live at once; others wait for admin review.

import { auditEvents, businessMembers, businessPlots, businessStats, businesses, dealClaims, deals, gameLedgerEntries, profiles, serviceRequests, shopReviews } from "@hc/db";
import {
  BUSINESS_EVENTS,
  DEAL_CODE,
  DEAL_CODE_ALPHABET,
  DEAL_LIMITS,
  DEAL_REWARD,
  DEAL_REWARDS_PER_DAY,
  chatProblem,
  dayKey,
  normaliseDealCode,
  type BusinessDashboard,
  type BusinessEvent,
  type DealView,
  type MyDealCode,
  type OwnerDeal,
  type RedeemResult,
} from "@hc/shared";
import { randomInt } from "node:crypto";
import { and, count, desc, eq, gt, inArray, like, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { lockProfile } from "../lib/db.js";
import { AppError, notFound } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";

const createBody = z.object({
  title: z.string().trim().min(DEAL_LIMITS.titleMin, "Say what the deal is, e.g. \"10% off jollof\".").max(DEAL_LIMITS.titleMax),
  terms: z.string().trim().max(DEAL_LIMITS.termsMax).default(""),
  days: z.number().int().min(1).max(DEAL_LIMITS.maxDays),
  maxClaims: z.number().int().min(1).max(DEAL_LIMITS.maxClaims),
});

const DAY_MS = 86_400_000;
const newCode = () => `HC-${Array.from({ length: 6 }, () => DEAL_CODE_ALPHABET[randomInt(DEAL_CODE_ALPHABET.length)]).join("")}`;

export async function dealRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;

  /** The caller's own business (any status), or 404. */
  const owned = async (userId: string, businessId: string) => {
    const [row] = await app.db
      .select({ b: businesses })
      .from(businesses)
      .innerJoin(businessMembers, eq(businessMembers.businessId, businesses.id))
      .where(and(eq(businesses.id, businessId), eq(businessMembers.userId, userId)));
    if (!row) throw notFound("Business");
    return row.b;
  };

  // ── Business owners ──
  app.post<{ Params: { id: string } }>("/api/businesses/:id/deals", async (request, reply) => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    const body = createBody.parse(request.body);
    const biz = await owned(user.id, businessId);
    if (biz.status !== "published") throw new AppError(409, "not_live", "Your business needs to be approved before it can offer deals.");
    const now = new Date();
    const [{ n }] = (await app.db
      .select({ n: count() })
      .from(deals)
      .where(and(eq(deals.businessId, businessId), inArray(deals.status, ["pending_review", "live"]), gt(deals.endsAt, now)))) as [{ n: number }];
    if (Number(n) >= DEAL_LIMITS.perBusiness) throw new AppError(409, "too_many_deals", `You can run up to ${DEAL_LIMITS.perBusiness} deals at once. End one first.`);
    const [deal] = await app.db
      .insert(deals)
      .values({
        businessId,
        title: body.title,
        terms: body.terms,
        maxClaims: body.maxClaims,
        endsAt: new Date(now.getTime() + body.days * DAY_MS),
        // Verified businesses are trusted to publish straight away.
        status: biz.verifiedAt ? "live" : "pending_review",
      })
      .returning();
    return reply.code(201).send({ id: deal!.id, status: deal!.status });
  });

  app.get<{ Params: { id: string } }>("/api/businesses/:id/deals", async (request): Promise<OwnerDeal[]> => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    await owned(user.id, businessId);
    const rows = await app.db.select().from(deals).where(eq(deals.businessId, businessId)).orderBy(desc(deals.createdAt)).limit(20);
    const stats = rows.length
      ? await app.db
          .select({ dealId: dealClaims.dealId, claimed: count(), redeemed: count(dealClaims.redeemedAt) })
          .from(dealClaims)
          .where(inArray(dealClaims.dealId, rows.map((d) => d.id)))
          .groupBy(dealClaims.dealId)
      : [];
    const now = Date.now();
    return rows.map((d) => {
      const s = stats.find((x) => x.dealId === d.id);
      return {
        id: d.id,
        title: d.title,
        terms: d.terms,
        status: d.status === "live" && d.endsAt.getTime() <= now ? "ended" : (d.status as OwnerDeal["status"]),
        endsAt: d.endsAt.toISOString(),
        maxClaims: d.maxClaims,
        claimed: Number(s?.claimed ?? 0),
        redeemed: Number(s?.redeemed ?? 0),
        reviewNote: d.reviewNote,
      };
    });
  });

  app.post<{ Params: { id: string; dealId: string } }>("/api/businesses/:id/deals/:dealId/end", async (request) => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    const dealId = z.uuid().parse(request.params.dealId);
    await owned(user.id, businessId);
    const [d] = await app.db
      .update(deals)
      .set({ status: "ended" })
      .where(and(eq(deals.id, dealId), eq(deals.businessId, businessId)))
      .returning({ id: deals.id });
    if (!d) throw notFound("Deal");
    return { ok: true };
  });

  // The counter: the business types the customer's code and it's marked used. The player gets the reward
  // (up to a few deals a Lagos day), once per code.
  app.post<{ Params: { id: string } }>(
    "/api/businesses/:id/redeem",
    { config: { rateLimit: { max: 60 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } },
    async (request): Promise<RedeemResult> => {
      const user = requireUser(request);
      const businessId = z.uuid().parse(request.params.id);
      const code = normaliseDealCode(z.object({ code: z.string().max(20) }).parse(request.body).code);
      if (!DEAL_CODE.test(code)) throw new AppError(400, "bad_code", "That doesn't look like a Hustle City code (HC-XXXXXX).");
      await owned(user.id, businessId);
      return app.db.transaction(async (tx) => {
        const [row] = await tx
          .select({ claim: dealClaims, deal: deals, nickname: profiles.nickname })
          .from(dealClaims)
          .innerJoin(deals, eq(deals.id, dealClaims.dealId))
          .innerJoin(profiles, eq(profiles.userId, dealClaims.userId))
          .where(and(eq(dealClaims.code, code), eq(deals.businessId, businessId)))
          .for("update", { of: dealClaims });
        if (!row) throw new AppError(404, "unknown_code", "No deal of yours has that code.");
        if (row.claim.redeemedAt) throw new AppError(409, "already_used", "That code has already been used.");
        const now = new Date();
        if (row.claim.expiresAt <= now) throw new AppError(409, "expired", "That code has expired.");
        await tx.update(dealClaims).set({ redeemedAt: now }).where(eq(dealClaims.id, row.claim.id));
        // Reward the player, up to DEAL_REWARDS_PER_DAY a Lagos day.
        await lockProfile(tx, row.claim.userId);
        const day = dayKey(now, tz);
        const [{ n }] = (await tx
          .select({ n: count() })
          .from(gameLedgerEntries)
          .where(and(eq(gameLedgerEntries.userId, row.claim.userId), like(gameLedgerEntries.reference, `deal:${day}:%`)))) as [{ n: number }];
        let rewarded = false;
        if (Number(n) < DEAL_REWARDS_PER_DAY) {
          const posting = await postCoins(tx, row.claim.userId, DEAL_REWARD.coins, "deal_reward", `deal:${day}:${row.claim.id}`);
          if (posting.applied) {
            await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${DEAL_REWARD.xp}` }).where(eq(profiles.userId, row.claim.userId));
            rewarded = true;
          }
        }
        return { title: row.deal.title, nickname: row.nickname, rewarded };
      });
    },
  );

  // ── Players ──
  /** Live deals (optionally for one business), with the viewer's code if they have one. */
  app.get("/api/deals", async (request): Promise<DealView[]> => {
    const { businessId } = z.object({ businessId: z.uuid().optional() }).parse(request.query);
    const now = new Date();
    const filters = [eq(deals.status, "live"), gt(deals.endsAt, now), eq(businesses.status, "published")];
    if (businessId) filters.push(eq(deals.businessId, businessId));
    const rows = await app.db
      .select({ d: deals, name: businesses.name })
      .from(deals)
      .innerJoin(businesses, eq(businesses.id, deals.businessId))
      .where(and(...filters))
      .orderBy(desc(deals.createdAt))
      .limit(50);
    if (!rows.length) return [];
    const ids = rows.map((r) => r.d.id);
    const claimed = await app.db.select({ dealId: dealClaims.dealId, n: count() }).from(dealClaims).where(inArray(dealClaims.dealId, ids)).groupBy(dealClaims.dealId);
    const mine = request.user
      ? await app.db.select().from(dealClaims).where(and(inArray(dealClaims.dealId, ids), eq(dealClaims.userId, request.user.id)))
      : [];
    const ownBiz = request.user
      ? new Set(
          (
            await app.db
              .select({ id: businessMembers.businessId })
              .from(businessMembers)
              .where(and(eq(businessMembers.userId, request.user.id), inArray(businessMembers.businessId, rows.map((r) => r.d.businessId))))
          ).map((r) => r.id),
        )
      : new Set<string>();
    return rows.map(({ d, name }) => {
      const c = mine.find((m) => m.dealId === d.id);
      return {
        id: d.id,
        businessId: d.businessId,
        businessName: name,
        title: d.title,
        terms: d.terms,
        endsAt: d.endsAt.toISOString(),
        left: Math.max(0, d.maxClaims - Number(claimed.find((x) => x.dealId === d.id)?.n ?? 0)),
        own: ownBiz.has(d.businessId),
        myCode: c ? { code: c.code, expiresAt: c.expiresAt.toISOString(), redeemed: c.redeemedAt !== null } : null,
      };
    });
  });

  app.post<{ Params: { id: string } }>(
    "/api/deals/:id/claim",
    { config: { rateLimit: { max: 30 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } },
    async (request) => {
      const user = requireUser(request);
      const dealId = z.uuid().parse(request.params.id);
      return app.db.transaction(async (tx) => {
        const [d] = await tx.select().from(deals).where(eq(deals.id, dealId)).for("update");
        const now = new Date();
        if (!d || d.status !== "live" || d.endsAt <= now) throw notFound("Deal");
        const [own] = await tx.select().from(businessMembers).where(and(eq(businessMembers.businessId, d.businessId), eq(businessMembers.userId, user.id)));
        if (own) throw new AppError(409, "own_deal", "You can't claim your own business's deal.");
        const [existing] = await tx.select().from(dealClaims).where(and(eq(dealClaims.dealId, dealId), eq(dealClaims.userId, user.id)));
        if (existing) return { code: existing.code, expiresAt: existing.expiresAt.toISOString() };
        const [{ n }] = (await tx.select({ n: count() }).from(dealClaims).where(eq(dealClaims.dealId, dealId))) as [{ n: number }];
        if (Number(n) >= d.maxClaims) throw new AppError(409, "all_gone", "All the codes for this deal have been claimed.");
        const expiresAt = new Date(Math.min(d.endsAt.getTime(), now.getTime() + DEAL_LIMITS.codeDays * DAY_MS));
        // A fresh code; retry in the very rare case of a clash.
        for (let i = 0; i < 5; i++) {
          const code = newCode();
          const [taken] = await tx.select({ id: dealClaims.id }).from(dealClaims).where(eq(dealClaims.code, code));
          if (taken) continue;
          await tx.insert(dealClaims).values({ dealId, userId: user.id, code, expiresAt });
          return { code, expiresAt: expiresAt.toISOString() };
        }
        throw new AppError(503, "try_again", "Couldn't make a code just now. Try again.");
      });
    },
  );

  app.get("/api/deals/mine", async (request): Promise<MyDealCode[]> => {
    const user = requireUser(request);
    const rows = await app.db
      .select({ c: dealClaims, d: deals, b: businesses })
      .from(dealClaims)
      .innerJoin(deals, eq(deals.id, dealClaims.dealId))
      .innerJoin(businesses, eq(businesses.id, deals.businessId))
      .where(eq(dealClaims.userId, user.id))
      .orderBy(desc(dealClaims.createdAt))
      .limit(50);
    const mine = rows.length ? await app.db.select().from(shopReviews).where(inArray(shopReviews.claimId, rows.map((r) => r.c.id))) : [];
    return rows.map(({ c, d, b }) => ({
      claimId: c.id,
      review: (() => {
        const r = mine.find((x) => x.claimId === c.id);
        return r ? { rating: r.rating, body: r.body } : null;
      })(),
      code: c.code,
      expiresAt: c.expiresAt.toISOString(),
      redeemedAt: c.redeemedAt?.toISOString() ?? null,
      title: d.title,
      terms: d.terms,
      businessName: b.name,
      pickupAddress: b.pickupAddress,
    }));
  });

  // Review the shop after your deal was redeemed there (one review per redeemed deal).
  app.post<{ Params: { claimId: string } }>("/api/deals/claims/:claimId/review", async (request, reply) => {
    const user = requireUser(request);
    const claimId = z.uuid().parse(request.params.claimId);
    const { rating, body } = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(400).default("") }).parse(request.body);
    const problem = body ? chatProblem(body) : null;
    if (problem) throw new AppError(400, "bad_text", problem);
    const [row] = await app.db
      .select({ c: dealClaims, d: deals })
      .from(dealClaims)
      .innerJoin(deals, eq(deals.id, dealClaims.dealId))
      .where(and(eq(dealClaims.id, claimId), eq(dealClaims.userId, user.id)));
    if (!row) throw notFound("Deal");
    if (!row.c.redeemedAt) throw new AppError(409, "not_redeemed", "Use the deal at the shop first, then review it.");
    const [done] = await app.db.insert(shopReviews).values({ claimId, businessId: row.d.businessId, reviewerId: user.id, rating, body }).onConflictDoNothing().returning();
    if (!done) throw new AppError(409, "reviewed", "You've reviewed this one already.");
    return reply.code(201).send({ rating, body });
  });

  // ── Admin review (deals from businesses that aren't verified yet) ──
  app.get("/api/admin/deals", async (request) => {
    requireRole(request, "admin");
    const rows = await app.db
      .select({ d: deals, name: businesses.name })
      .from(deals)
      .innerJoin(businesses, eq(businesses.id, deals.businessId))
      .where(eq(deals.status, "pending_review"))
      .orderBy(desc(deals.createdAt))
      .limit(100);
    return rows.map(({ d, name }) => ({ id: d.id, businessName: name, title: d.title, terms: d.terms, endsAt: d.endsAt.toISOString(), maxClaims: d.maxClaims }));
  });

  app.post<{ Params: { id: string } }>("/api/admin/deals/:id/review", async (request) => {
    const admin = requireRole(request, "admin");
    const id = z.uuid().parse(request.params.id);
    const body = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(300).optional() }).parse(request.body);
    await app.db.transaction(async (tx) => {
      const [d] = await tx
        .update(deals)
        .set({ status: body.decision === "approve" ? "live" : "rejected", reviewNote: body.decision === "approve" ? null : (body.note ?? null) })
        .where(and(eq(deals.id, id), eq(deals.status, "pending_review")))
        .returning({ title: deals.title });
      if (!d) throw notFound("Deal");
      await tx.insert(auditEvents).values({
        actorId: admin.id,
        action: `deal.${body.decision}`,
        targetType: "deal",
        targetId: id,
        reasonCode: body.decision === "approve" ? "meets_guidelines" : "other",
        details: { title: d.title, note: body.note ?? null },
      });
    });
    return { ok: true };
  });

  // ── Business dashboard: what players did with your business ──
  /** Counted once per viewer, business, kind and Lagos day (so refreshing doesn't inflate it). */
  const counted = new Set<string>();
  app.post<{ Params: { id: string } }>(
    "/api/businesses/:id/track",
    { config: { rateLimit: { max: 120 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } },
    async (request) => {
      const businessId = z.uuid().parse(request.params.id);
      const { kind } = z.object({ kind: z.enum(BUSINESS_EVENTS as unknown as [BusinessEvent, ...BusinessEvent[]]) }).parse(request.body);
      const day = dayKey(new Date(), tz);
      const who = request.user?.id ?? request.ip;
      const key = `${who}|${businessId}|${kind}|${day}`;
      if (counted.has(key)) return { ok: true };
      if (counted.size > 200_000) counted.clear();
      counted.add(key);
      await app.db
        .insert(businessStats)
        .values({ businessId, day, kind, count: 1 })
        .onConflictDoUpdate({ target: [businessStats.businessId, businessStats.day, businessStats.kind], set: { count: sql`${businessStats.count} + 1` } })
        .catch(() => undefined); // unknown business id: ignore
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string } }>("/api/businesses/:id/dashboard", async (request): Promise<BusinessDashboard> => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) }).parse(request.query);
    const biz = await owned(user.id, businessId);
    const now = new Date();
    const dayList = Array.from({ length: days }, (_, i) => dayKey(new Date(now.getTime() - (days - 1 - i) * 86_400_000), tz));
    const rows = await app.db.select().from(businessStats).where(and(eq(businessStats.businessId, businessId), sql`${businessStats.day} >= ${dayList[0]!}`));
    const totals = Object.fromEntries(BUSINESS_EVENTS.map((k) => [k, 0])) as Record<BusinessEvent, number>;
    const daily = dayList.map((day) => ({ day, card_open: 0, search_view: 0, whatsapp: 0, directions: 0 }));
    for (const r of rows) {
      const k = r.kind as BusinessEvent;
      if (!(k in totals)) continue;
      totals[k] += r.count;
      const d = daily.find((x) => x.day === r.day);
      if (d) d[k] += r.count;
    }
    const dealRows = await app.db.select().from(deals).where(eq(deals.businessId, businessId)).orderBy(desc(deals.createdAt)).limit(10);
    const dealStats = dealRows.length
      ? await app.db
          .select({ dealId: dealClaims.dealId, claimed: count(), redeemed: count(dealClaims.redeemedAt) })
          .from(dealClaims)
          .where(inArray(dealClaims.dealId, dealRows.map((d) => d.id)))
          .groupBy(dealClaims.dealId)
      : [];
    const reqs = await app.db.select({ status: serviceRequests.status }).from(serviceRequests).where(eq(serviceRequests.businessId, businessId));
    const [onMap] = await app.db.select().from(businessPlots).where(eq(businessPlots.businessId, businessId));
    return {
      days,
      totals,
      daily,
      deals: dealRows.map((d) => {
        const st = dealStats.find((x) => x.dealId === d.id);
        return { title: d.title, claimed: Number(st?.claimed ?? 0), redeemed: Number(st?.redeemed ?? 0), status: d.status === "live" && d.endsAt <= now ? "ended" : d.status };
      }),
      quotes: {
        total: reqs.length,
        open: reqs.filter((r) => !["completed", "declined", "cancelled"].includes(r.status)).length,
        completed: reqs.filter((r) => r.status === "completed").length,
      },
      onMap: !!onMap,
      verified: biz.verifiedAt !== null,
    };
  });
}
