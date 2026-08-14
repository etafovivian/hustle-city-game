// Business onboarding for artisans (Stage B1) and admin review.
// New workshops start pending review and only appear in search once an admin publishes them.

import { auditEvents, businessMembers, businesses, products } from "@hc/db";
import { ARTISAN_CATEGORY_KEYS, LAGOS_AREA_SET, NG_PHONE, RETAIL_CATEGORY_KEYS, normalisePhone, type MyBusiness } from "@hc/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, notFound } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";

const createBody = z
  .object({
  kind: z.enum(["artisan", "retail"]).default("artisan"),
  name: z.string().trim().min(3, "Give your business a name of at least 3 characters.").max(60),
  category: z.string(),
  /** Retail: where customers find the shop. */
  pickupAddress: z.string().trim().max(160).optional(),
  contactPhone: z
    .string()
    .transform(normalisePhone)
    .refine((p) => NG_PHONE.test(p), "Use a Nigerian mobile number, like 0803 123 4567.")
    .optional(),
  areas: z
    .array(z.string().refine((a) => LAGOS_AREA_SET.has(a), "Choose areas from the list."))
    .min(1, "Pick at least one area you serve.")
    .max(6, "Pick up to 6 areas."),
  description: z.string().trim().min(20, "Describe what you do in at least 20 characters.").max(600),
  services: z
    .array(z.object({ name: z.string().trim().min(2).max(60), fromPriceNaira: z.number().int().min(0).max(5_000_000) }))
    .max(12)
    .default([]),
  })
  .superRefine((b, ctx) => {
    const ok = (b.kind === "retail" ? RETAIL_CATEGORY_KEYS : ARTISAN_CATEGORY_KEYS).includes(b.category);
    if (!ok) ctx.addIssue({ code: "custom", path: ["category"], message: "Choose a category from the list." });
    if (b.kind === "retail" && (b.pickupAddress ?? "").length < 8)
      ctx.addIssue({ code: "custom", path: ["pickupAddress"], message: "Add the shop's address so customers can find it." });
    if (b.kind === "artisan" && b.services.length > 8) ctx.addIssue({ code: "custom", path: ["services"], message: "List up to 8 services." });
  });

const REVIEW_REASONS = ["meets_guidelines", "incomplete", "not_a_real_business", "offensive", "duplicate", "other"] as const;
const reviewBody = z.object({
  decision: z.enum(["publish", "reject", "hide"]),
  reasonCode: z.enum(REVIEW_REASONS),
  note: z.string().trim().max(300).optional(),
});

const MAX_BUSINESSES_PER_OWNER = 3;

const toMine = (b: typeof businesses.$inferSelect): MyBusiness => ({
  id: b.id,
  name: b.name,
  category: b.category,
  serviceArea: b.serviceArea,
  kind: b.kind as MyBusiness["kind"],
  verified: b.verifiedAt !== null,
  status: b.status as MyBusiness["status"],
  reviewNote: b.reviewNote,
});

export async function businessRoutes(app: FastifyInstance) {
  // Register a workshop. It goes to admin review before anyone can find it.
  app.post("/api/businesses", { config: { rateLimit: { max: 5 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } }, async (request, reply) => {
    const user = requireUser(request);
    const body = createBody.parse(request.body);
    const created = await app.db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: businessMembers.businessId })
        .from(businessMembers)
        .where(and(eq(businessMembers.userId, user.id), eq(businessMembers.role, "owner")));
      if (owned.length >= MAX_BUSINESSES_PER_OWNER) {
        throw new AppError(422, "too_many_businesses", `You can register up to ${MAX_BUSINESSES_PER_OWNER} businesses in the beta.`);
      }
      const [biz] = await tx
        .insert(businesses)
        .values({
          name: body.name,
          kind: body.kind,
          category: body.category,
          pickupAddress: body.kind === "retail" ? body.pickupAddress! : null,
          contactPhone: body.contactPhone ?? null,
          serviceArea: body.areas.join(", "),
          description: body.description,
          status: "pending_review",
        })
        .returning();
      await tx.insert(businessMembers).values({ businessId: biz!.id, userId: user.id, role: "owner" });
      if (body.services.length) {
        await tx.insert(products).values(body.services.map((s) => ({ businessId: biz!.id, name: s.name, priceKobo: s.fromPriceNaira * 100 })));
      }
      return biz!;
    });
    return reply.code(201).send(toMine(created));
  });

  app.get("/api/businesses/mine", async (request): Promise<MyBusiness[]> => {
    const user = requireUser(request);
    const rows = await app.db
      .select({ b: businesses })
      .from(businesses)
      .innerJoin(businessMembers, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, user.id))
      .orderBy(desc(businesses.createdAt));
    return rows.map((r) => toMine(r.b));
  });

  // ── Admin review ──
  app.get("/api/admin/businesses", async (request) => {
    requireRole(request, "admin");
    const { status } = z.object({ status: z.enum(["pending_review", "published", "rejected", "hidden"]).default("pending_review") }).parse(request.query);
    const rows = await app.db.select().from(businesses).where(eq(businesses.status, status)).orderBy(desc(businesses.createdAt)).limit(100);
    const items = rows.length
      ? await app.db.select().from(products).where(inArray(products.businessId, rows.map((r) => r.id)))
      : [];
    return rows.map((b) => ({
      ...toMine(b),
      description: b.description,
      isMock: b.isMock,
      pickupAddress: b.pickupAddress,
      contactPhone: b.contactPhone,
      createdAt: b.createdAt.toISOString(),
      services: items.filter((p) => p.businessId === b.id).map((p) => ({ name: p.name, fromPriceKobo: p.priceKobo })),
    }));
  });

  app.post<{ Params: { id: string } }>("/api/admin/businesses/:id/review", async (request) => {
    const admin = requireRole(request, "admin");
    const id = z.uuid().parse(request.params.id);
    const body = reviewBody.parse(request.body);
    const status = body.decision === "publish" ? "published" : body.decision === "reject" ? "rejected" : "hidden";
    await app.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(businesses)
        .set({ status, reviewNote: body.decision === "publish" ? null : (body.note ?? null) })
        .where(eq(businesses.id, id))
        .returning({ name: businesses.name });
      if (!updated) throw notFound("Business");
      await tx.insert(auditEvents).values({
        actorId: admin.id,
        action: `business.${body.decision}`,
        targetType: "business",
        targetId: id,
        reasonCode: body.reasonCode,
        details: { name: updated.name, note: body.note ?? null },
      });
    });
    return { ok: true, status };
  });

  // Verified badge: an admin has checked the business (phone call, and CAC registration for bigger ones).
  app.post<{ Params: { id: string } }>("/api/admin/businesses/:id/verify", async (request) => {
    const admin = requireRole(request, "admin");
    const id = z.uuid().parse(request.params.id);
    const { verified, note } = z.object({ verified: z.boolean(), note: z.string().trim().max(300).optional() }).parse(request.body);
    await app.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(businesses)
        .set({ verifiedAt: verified ? new Date() : null })
        .where(eq(businesses.id, id))
        .returning({ name: businesses.name });
      if (!updated) throw notFound("Business");
      await tx.insert(auditEvents).values({
        actorId: admin.id,
        action: verified ? "business.verify" : "business.unverify",
        targetType: "business",
        targetId: id,
        reasonCode: verified ? "checked" : "removed",
        details: { name: updated.name, note: note ?? null },
      });
    });
    return { ok: true, verified };
  });
}
