// Sponsored places: an admin puts a live business on a place for a period; its card shows "Presented by …".

import { auditEvents, businessPlots, businesses, deals, venueSponsors } from "@hc/db";
import { VENUES_BY_KEY, type SponsorView } from "@hc/shared";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireRole } from "../plugins/auth.js";

export async function sponsorRoutes(app: FastifyInstance) {
  const active = async (all = false): Promise<SponsorView[]> => {
    const now = new Date();
    const rows = await app.db
      .select({ s: venueSponsors, b: businesses, plot: businessPlots.plotId })
      .from(venueSponsors)
      .innerJoin(businesses, eq(businesses.id, venueSponsors.businessId))
      .leftJoin(businessPlots, eq(businessPlots.businessId, businesses.id))
      .where(all ? undefined : and(gt(venueSponsors.endsAt, now), eq(businesses.status, "published")));
    const ids = rows.map((r) => r.b.id);
    const live = ids.length
      ? await app.db.select({ businessId: deals.businessId, n: count() }).from(deals).where(and(inArray(deals.businessId, ids), eq(deals.status, "live"), gt(deals.endsAt, now))).groupBy(deals.businessId)
      : [];
    return rows.map(({ s, b, plot }) => ({
      venue: s.venue,
      businessId: b.id,
      businessName: b.name,
      tagline: s.tagline,
      endsAt: s.endsAt.toISOString(),
      onMap: !!plot,
      deals: Number(live.find((x) => x.businessId === b.id)?.n ?? 0),
    }));
  };

  app.get("/api/sponsors", async () => active());

  app.get("/api/admin/sponsors", async (request) => {
    requireRole(request, "admin");
    return active(true);
  });

  app.post("/api/admin/sponsors", async (request) => {
    const admin = requireRole(request, "admin");
    const { venue, businessId, tagline, days } = z
      .object({ venue: z.string().max(60), businessId: z.uuid(), tagline: z.string().trim().max(80).default(""), days: z.number().int().min(1).max(365) })
      .parse(request.body);
    if (!VENUES_BY_KEY.has(venue)) throw new AppError(400, "bad_venue", "Pick a place from the list.");
    const [b] = await app.db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!b || b.status !== "published") throw new AppError(409, "not_live", "Only live businesses can sponsor a place.");
    const endsAt = new Date(Date.now() + days * 86_400_000);
    await app.db.insert(venueSponsors).values({ venue, businessId, tagline, endsAt }).onConflictDoUpdate({ target: venueSponsors.venue, set: { businessId, tagline, endsAt } });
    await app.db.insert(auditEvents).values({ actorId: admin.id, action: "sponsor.set", targetType: "venue", targetId: venue, details: { businessId, days, tagline } });
    return active(true);
  });

  app.post<{ Params: { venue: string } }>("/api/admin/sponsors/:venue/end", async (request) => {
    const admin = requireRole(request, "admin");
    await app.db.delete(venueSponsors).where(eq(venueSponsors.venue, request.params.venue));
    await app.db.insert(auditEvents).values({ actorId: admin.id, action: "sponsor.end", targetType: "venue", targetId: request.params.venue, details: {} });
    return active(true);
  });
}
