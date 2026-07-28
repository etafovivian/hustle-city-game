// Billboards: paid banner ads from real businesses, shown on boards around the map.
// Booking → admin content review → admin confirms payment (bank transfer until the payment phase) → on air.
// Every admin decision writes an audit event. Banners are validated from their own bytes and served
// with a fixed image type, so nothing uploaded can run as a page or script.

import { adCampaigns, adCreatives, adStats, auditEvents, billboards } from "@hc/db";
import {
  AD_BANNER,
  AD_MAX_WEEKS,
  adStatus,
  cleanAdLink,
  dayKey,
  imageInfo,
  type BillboardView,
  type MyAd,
} from "@hc/shared";
import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql, sum } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, notFound } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";

const bookBody = z.object({
  billboardKey: z.string().max(40),
  headline: z.string().trim().min(3, "Add a short headline (it's also read out to screen readers).").max(80),
  linkUrl: z.string().max(300),
  weeks: z.number().int().min(1).max(AD_MAX_WEEKS),
  /** Base64 banner, 1200×400 WebP, PNG or JPEG. */
  image: z.string().max(Math.ceil((AD_BANNER.maxBytes * 4) / 3) + 8),
  agreePolicy: z.literal(true, { error: "Please confirm the ad follows the ad rules." }),
});

const REVIEW_REASONS = ["meets_policy", "gambling_or_schemes", "misleading", "adult_or_illegal", "political", "poor_quality", "other"] as const;
const reviewBody = z.object({ decision: z.enum(["approve", "reject"]), reasonCode: z.enum(REVIEW_REASONS), note: z.string().trim().max(300).optional() });
const paymentBody = z.object({ reference: z.string().trim().min(3, "Add the bank transfer reference.").max(80) });
const statsBody = z.object({ views: z.record(z.uuid(), z.number().int().min(1).max(40)).refine((v) => Object.keys(v).length <= 30) });

const WEEK_MS = 7 * 86_400_000;
const imageUrl = (id: string) => `/api/billboards/ads/${id}/image`;

export async function billboardRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;

  /** Campaigns holding a place on a board: not rejected and not ended. */
  const holding = (now: Date) =>
    and(ne(adCampaigns.reviewStatus, "rejected"), or(isNull(adCampaigns.endsAt), gt(adCampaigns.endsAt, now)));

  // Public: every board with what's on air now and how full it is.
  app.get("/api/billboards", async (): Promise<BillboardView[]> => {
    const now = new Date();
    const boards = await app.db.select().from(billboards).where(eq(billboards.active, true)).orderBy(asc(billboards.key));
    const camps = await app.db.select().from(adCampaigns).where(holding(now));
    return boards.map((b) => {
      const mine = camps.filter((c) => c.billboardKey === b.key);
      return {
        key: b.key,
        name: b.name,
        tier: b.tier as BillboardView["tier"],
        priceKoboPerWeek: b.priceKoboPerWeek,
        capacity: b.capacity,
        taken: mine.length,
        ads: mine
          .filter((c) => adStatus(c, now) === "live")
          .sort((x, y) => x.startsAt!.getTime() - y.startsAt!.getTime())
          .map((c) => ({ id: c.id, headline: c.headline, linkUrl: c.linkUrl, imageUrl: imageUrl(c.id), until: c.endsAt!.toISOString() })),
      };
    });
  });

  // Banner image: public while on air; the advertiser and admins can always see it.
  app.get<{ Params: { id: string } }>("/api/billboards/ads/:id/image", async (request, reply) => {
    const id = z.uuid().safeParse(request.params.id);
    if (!id.success) throw notFound("Ad");
    const [row] = await app.db
      .select({ c: adCampaigns, type: adCreatives.contentType, bytes: adCreatives.bytes })
      .from(adCampaigns)
      .innerJoin(adCreatives, eq(adCreatives.campaignId, adCampaigns.id))
      .where(eq(adCampaigns.id, id.data));
    if (!row) throw notFound("Ad");
    const viewer = request.user;
    const live = adStatus(row.c, new Date()) === "live";
    const allowed = live || (viewer && (viewer.id === row.c.advertiserId || viewer.roles.includes("admin")));
    if (!allowed) throw notFound("Ad");
    return reply
      .header("content-type", row.type)
      .header("x-content-type-options", "nosniff")
      .header("content-security-policy", "default-src 'none'; sandbox")
      .header("cache-control", live ? "public, max-age=300" : "private, no-store")
      .send(row.bytes);
  });

  // Book an ad. Starts in review; an admin approves it and confirms payment before it goes on air.
  app.post(
    "/api/billboards/ads",
    { bodyLimit: 1024 * 1024, config: { rateLimit: { max: 6 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const user = requireUser(request);
      const body = bookBody.parse(request.body);
      const link = cleanAdLink(body.linkUrl);
      if (!link) throw new AppError(400, "invalid_link", "Use a full https:// link to your website, WhatsApp or social page.");
      const bytes = Buffer.from(body.image, "base64");
      if (bytes.length > AD_BANNER.maxBytes) throw new AppError(400, "image_too_big", "The banner must be 600 KB or smaller.");
      const info = imageInfo(bytes);
      if (!info) throw new AppError(400, "invalid_image", "Upload a WebP, PNG or JPEG image.");
      if (info.width !== AD_BANNER.width || info.height !== AD_BANNER.height) {
        throw new AppError(400, "wrong_size", `The banner must be exactly ${AD_BANNER.width}×${AD_BANNER.height} pixels.`);
      }

      const id = await app.db.transaction(async (tx) => {
        // Lock the board so two bookings can't both take its last place.
        const [board] = await tx.select().from(billboards).where(and(eq(billboards.key, body.billboardKey), eq(billboards.active, true))).for("update");
        if (!board) throw notFound("Billboard");
        const now = new Date();
        const [{ n }] = (await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(adCampaigns)
          .where(and(eq(adCampaigns.billboardKey, board.key), holding(now)))) as [{ n: number }];
        if (n >= board.capacity) throw new AppError(409, "board_full", "This board is full right now. Try another board or check back soon.");
        const [c] = await tx
          .insert(adCampaigns)
          .values({
            advertiserId: user.id,
            billboardKey: board.key,
            headline: body.headline,
            linkUrl: link,
            weeks: body.weeks,
            priceKobo: board.priceKoboPerWeek * body.weeks,
          })
          .returning({ id: adCampaigns.id });
        await tx.insert(adCreatives).values({ campaignId: c!.id, contentType: info.type, bytes });
        return c!.id;
      });
      return reply.code(201).send({ id });
    },
  );

  app.get("/api/billboards/ads/mine", async (request): Promise<MyAd[]> => {
    const user = requireUser(request);
    const rows = await app.db
      .select({ c: adCampaigns, boardName: billboards.name })
      .from(adCampaigns)
      .innerJoin(billboards, eq(billboards.key, adCampaigns.billboardKey))
      .where(eq(adCampaigns.advertiserId, user.id))
      .orderBy(desc(adCampaigns.createdAt));
    const totals = rows.length
      ? await app.db
          .select({ id: adStats.campaignId, views: sum(adStats.views), clicks: sum(adStats.clicks) })
          .from(adStats)
          .where(inArray(adStats.campaignId, rows.map((r) => r.c.id)))
          .groupBy(adStats.campaignId)
      : [];
    const now = new Date();
    return rows.map(({ c, boardName }) => {
      const t = totals.find((x) => x.id === c.id);
      return {
        id: c.id,
        billboardKey: c.billboardKey,
        billboardName: boardName,
        headline: c.headline,
        linkUrl: c.linkUrl,
        imageUrl: imageUrl(c.id),
        weeks: c.weeks,
        priceKobo: c.priceKobo,
        status: adStatus(c, now),
        reviewNote: c.reviewNote,
        startsAt: c.startsAt?.toISOString() ?? null,
        endsAt: c.endsAt?.toISOString() ?? null,
        views: Number(t?.views ?? 0),
        clicks: Number(t?.clicks ?? 0),
        createdAt: c.createdAt.toISOString(),
      };
    });
  });

  // Views: the client batches how often each on-air ad was on screen. Signed-in players only, capped per call.
  app.post("/api/billboards/views", { config: { rateLimit: { max: 4 * app.config.ACTION_RATE_SCALE, timeWindow: "1 minute" } } }, async (request, reply) => {
    requireUser(request);
    const { views } = statsBody.parse(request.body);
    const ids = Object.keys(views);
    if (!ids.length) return reply.code(204).send();
    const now = new Date();
    const live = (await app.db.select().from(adCampaigns).where(inArray(adCampaigns.id, ids))).filter((c) => adStatus(c, now) === "live");
    const day = dayKey(now, tz);
    for (const c of live) {
      await app.db
        .insert(adStats)
        .values({ campaignId: c.id, day, views: views[c.id]! })
        .onConflictDoUpdate({ target: [adStats.campaignId, adStats.day], set: { views: sql`${adStats.views} + ${views[c.id]!}` } });
    }
    return reply.code(204).send();
  });

  // A click on an on-air ad's link (counted before the browser opens it).
  app.post<{ Params: { id: string } }>("/api/billboards/ads/:id/click", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const id = z.uuid().parse(request.params.id);
    const [c] = await app.db.select().from(adCampaigns).where(eq(adCampaigns.id, id));
    if (!c || adStatus(c, new Date()) !== "live") throw notFound("Ad");
    await app.db
      .insert(adStats)
      .values({ campaignId: id, day: dayKey(new Date(), tz), clicks: 1 })
      .onConflictDoUpdate({ target: [adStats.campaignId, adStats.day], set: { clicks: sql`${adStats.clicks} + 1` } });
    return reply.code(204).send();
  });

  // ── Admin ──
  app.get("/api/admin/billboards/ads", async (request) => {
    requireRole(request, "admin");
    const now = new Date();
    const rows = await app.db
      .select({ c: adCampaigns, boardName: billboards.name })
      .from(adCampaigns)
      .innerJoin(billboards, eq(billboards.key, adCampaigns.billboardKey))
      .where(holding(now))
      .orderBy(asc(adCampaigns.createdAt));
    return rows.map(({ c, boardName }) => ({
      id: c.id,
      billboardName: boardName,
      headline: c.headline,
      linkUrl: c.linkUrl,
      imageUrl: imageUrl(c.id),
      weeks: c.weeks,
      priceKobo: c.priceKobo,
      status: adStatus(c, now),
      advertiserId: c.advertiserId,
      createdAt: c.createdAt.toISOString(),
    }));
  });

  /** Start the run once an ad is both approved and paid. */
  const startIfReady = (c: typeof adCampaigns.$inferSelect, now: Date) =>
    c.reviewStatus === "approved" && c.paymentStatus === "paid" && !c.startsAt ? { startsAt: now, endsAt: new Date(now.getTime() + c.weeks * WEEK_MS) } : {};

  app.post<{ Params: { id: string } }>("/api/admin/billboards/ads/:id/review", async (request) => {
    const admin = requireRole(request, "admin");
    const id = z.uuid().parse(request.params.id);
    const body = reviewBody.parse(request.body);
    return app.db.transaction(async (tx) => {
      const [c] = await tx.select().from(adCampaigns).where(eq(adCampaigns.id, id)).for("update");
      if (!c) throw notFound("Ad");
      if (c.startsAt) throw new AppError(409, "already_running", "This ad is already on air.");
      const next = { ...c, reviewStatus: body.decision === "approve" ? "approved" : "rejected" };
      const set = { reviewStatus: next.reviewStatus, reviewNote: body.decision === "reject" ? (body.note ?? null) : null, ...startIfReady(next, new Date()) };
      await tx.update(adCampaigns).set(set).where(eq(adCampaigns.id, id));
      await tx.insert(auditEvents).values({ actorId: admin.id, action: `ad.${body.decision}`, targetType: "ad_campaign", targetId: id, reasonCode: body.reasonCode, details: { note: body.note ?? null } });
      return { ok: true };
    });
  });

  app.post<{ Params: { id: string } }>("/api/admin/billboards/ads/:id/payment", async (request) => {
    const admin = requireRole(request, "admin");
    const id = z.uuid().parse(request.params.id);
    const { reference } = paymentBody.parse(request.body);
    return app.db.transaction(async (tx) => {
      const [c] = await tx.select().from(adCampaigns).where(eq(adCampaigns.id, id)).for("update");
      if (!c) throw notFound("Ad");
      if (c.reviewStatus === "rejected") throw new AppError(409, "rejected", "This ad was not approved.");
      if (c.paymentStatus === "paid") throw new AppError(409, "already_paid", "Payment is already recorded.");
      const set = { paymentStatus: "paid", paymentReference: reference, ...startIfReady({ ...c, paymentStatus: "paid" }, new Date()) };
      await tx.update(adCampaigns).set(set).where(eq(adCampaigns.id, id));
      await tx.insert(auditEvents).values({ actorId: admin.id, action: "ad.payment_recorded", targetType: "ad_campaign", targetId: id, reasonCode: "bank_transfer", details: { reference, priceKobo: c.priceKobo } });
      return { ok: true };
    });
  });
}
