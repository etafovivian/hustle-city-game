// Land interest: players say which plot they want; the owner sees who to contact when ownership opens.

import { businessMembers, businessPlots, businesses, deals, landInterest, playerPlots, products, users, reviews, shopReviews } from "@hc/db";
import { PLOT_ID, STALLS, isStall, stallId, type LandInterestView, type MapBusiness } from "@hc/shared";
import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, notFound } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";

/** Most plots one player can hold interest in, so the list stays meaningful. */
const MAX_INTEREST = 10;

export async function landRoutes(app: FastifyInstance) {
  const plotParam = (raw: string) => {
    if (!PLOT_ID.test(raw)) throw new AppError(400, "bad_plot", "That isn't a plot on the map.");
    return raw;
  };

  const view = async (userId?: string): Promise<LandInterestView> => {
    const rows = await app.db.select({ plotId: landInterest.plotId, n: count() }).from(landInterest).groupBy(landInterest.plotId);
    const mine = userId ? await app.db.select({ plotId: landInterest.plotId }).from(landInterest).where(eq(landInterest.userId, userId)) : [];
    return { counts: Object.fromEntries(rows.map((r) => [r.plotId, Number(r.n)])), mine: mine.map((r) => r.plotId) };
  };

  app.get("/api/land/interest", async (request) => view(request.user?.id));

  app.post<{ Params: { plotId: string } }>("/api/land/:plotId/interest", async (request) => {
    const user = requireUser(request);
    const plotId = plotParam(request.params.plotId);
    const [{ n }] = (await app.db.select({ n: count() }).from(landInterest).where(eq(landInterest.userId, user.id))) as [{ n: number }];
    if (Number(n) >= MAX_INTEREST) throw new AppError(409, "too_many", `You can ask about up to ${MAX_INTEREST} plots. Drop one first.`);
    await app.db.insert(landInterest).values({ userId: user.id, plotId }).onConflictDoNothing();
    return view(user.id);
  });

  app.delete<{ Params: { plotId: string } }>("/api/land/:plotId/interest", async (request) => {
    const user = requireUser(request);
    const plotId = plotParam(request.params.plotId);
    await app.db.delete(landInterest).where(and(eq(landInterest.userId, user.id), eq(landInterest.plotId, plotId)));
    return view(user.id);
  });

  // Admin: who wants which plot, newest first.
  app.get("/api/admin/land-interest", async (request) => {
    requireRole(request, "admin");
    return app.db
      .select({ plotId: landInterest.plotId, email: users.email, createdAt: landInterest.createdAt })
      .from(landInterest)
      .innerJoin(users, eq(users.id, landInterest.userId))
      .orderBy(desc(landInterest.createdAt))
      .limit(500);
  });

  // ── Businesses on the map (free in the beta: one plot per business, first come) ──
  app.get("/api/map/businesses", async (): Promise<MapBusiness[]> => {
    const rows = await app.db
      .select({ plotId: businessPlots.plotId, b: businesses })
      .from(businessPlots)
      .innerJoin(businesses, eq(businesses.id, businessPlots.businessId))
      .where(eq(businesses.status, "published"));
    const items = rows.length
      ? await app.db.select().from(products).where(and(inArray(products.businessId, rows.map((r) => r.b.id)), eq(products.status, "published")))
      : [];
    const live = rows.length
      ? await app.db
          .select({ businessId: deals.businessId, n: count() })
          .from(deals)
          .where(and(inArray(deals.businessId, rows.map((r) => r.b.id)), eq(deals.status, "live"), gt(deals.endsAt, new Date())))
          .groupBy(deals.businessId)
      : [];
    // Stars from finished artisan jobs and redeemed deals.
    const ids = rows.map((r) => r.b.id);
    const jobReviews = ids.length ? await app.db.select({ businessId: reviews.businessId, rating: reviews.rating, body: reviews.body, at: reviews.createdAt }).from(reviews).where(inArray(reviews.businessId, ids)) : [];
    const dealReviews = ids.length ? await app.db.select({ businessId: shopReviews.businessId, rating: shopReviews.rating, body: shopReviews.body, at: shopReviews.createdAt }).from(shopReviews).where(inArray(shopReviews.businessId, ids)) : [];
    const ratingOf = (id: string) => {
      const all = [...jobReviews, ...dealReviews].filter((r) => r.businessId === id).sort((a, b) => b.at.getTime() - a.at.getTime());
      return {
        rating: all.length ? Math.round((10 * all.reduce((n, r) => n + r.rating, 0)) / all.length) / 10 : null,
        reviews: all.length,
        recent: all.filter((r) => r.body).slice(0, 3).map((r) => ({ rating: r.rating, body: r.body })),
      };
    };
    return rows.map(({ plotId, b }) => ({
      deals: Number(live.find((x) => x.businessId === b.id)?.n ?? 0),
      plotId,
      businessId: b.id,
      name: b.name,
      kind: b.kind as MapBusiness["kind"],
      category: b.category,
      verified: b.verifiedAt !== null,
      description: b.description,
      serviceArea: b.serviceArea,
      pickupAddress: b.pickupAddress,
      contactPhone: b.contactPhone,
      products: items.filter((p) => p.businessId === b.id).slice(0, 6).map((p) => ({ name: p.name, priceKobo: p.priceKobo })),
      hours: (b.hours as MapBusiness["hours"]) ?? null,
      ...ratingOf(b.id),
    }));
  });

  /** The owner's business, published (only live businesses get a building). */
  const ownBusiness = async (userId: string, businessId: string) => {
    const [row] = await app.db
      .select({ b: businesses })
      .from(businesses)
      .innerJoin(businessMembers, eq(businessMembers.businessId, businesses.id))
      .where(and(eq(businesses.id, businessId), eq(businessMembers.userId, userId), eq(businessMembers.role, "owner")));
    if (!row) throw notFound("Business");
    if (row.b.status !== "published") throw new AppError(409, "not_live", "Your business needs to be approved before it can have a building.");
    return row.b;
  };

  app.put<{ Params: { id: string } }>("/api/businesses/:id/plot", async (request) => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    const plotId = plotParam(z.object({ plotId: z.string().max(60) }).parse(request.body).plotId);
    await ownBusiness(user.id, businessId);
    await app.db.transaction(async (tx) => {
      const [taken] = await tx.select().from(businessPlots).where(eq(businessPlots.plotId, plotId));
      if (taken && taken.businessId !== businessId) throw new AppError(409, "plot_taken", "Another business is already on that plot.");
      const [home] = await tx.select().from(playerPlots).where(eq(playerPlots.plotId, plotId));
      if (home) throw new AppError(409, "plot_taken", "A player already owns that plot.");
      // Moving: one building per business.
      await tx.delete(businessPlots).where(eq(businessPlots.businessId, businessId));
      await tx.insert(businessPlots).values({ businessId, plotId });
    });
    return { ok: true, plotId };
  });

  app.delete<{ Params: { id: string } }>("/api/businesses/:id/plot", async (request) => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    await ownBusiness(user.id, businessId);
    await app.db.delete(businessPlots).where(eq(businessPlots.businessId, businessId));
    return { ok: true };
  });

  // A free stall at Balogun Market (instead of a plot): the next free one.
  app.post<{ Params: { id: string } }>("/api/businesses/:id/stall", async (request) => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    await ownBusiness(user.id, businessId);
    return app.db.transaction(async (tx) => {
      const taken = new Set((await tx.select({ p: businessPlots.plotId }).from(businessPlots)).map((r) => r.p).filter(isStall));
      let n = 1;
      while (n <= STALLS && taken.has(stallId(n))) n++;
      if (n > STALLS) throw new AppError(409, "full", "Every stall is taken. Ask for a plot instead.");
      await tx.delete(businessPlots).where(eq(businessPlots.businessId, businessId));
      await tx.insert(businessPlots).values({ businessId, plotId: stallId(n) });
      return { ok: true, stall: n };
    });
  });
}
