// Reports from players and admin moderation actions (FR01, FR09 foundation).
// Every admin action requires a reason code and writes an immutable audit event.

import { auditEvents, profiles, reports } from "@hc/db";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";

const reportBody = z.object({
  targetType: z.enum(["user", "business", "product", "shop"]),
  targetId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
});

const REASON_CODES = ["offensive_name", "impersonation", "spam", "fraud", "other"] as const;
const hideBody = z.object({ reasonCode: z.enum(REASON_CODES), note: z.string().max(500).optional() });

export async function moderationRoutes(app: FastifyInstance) {
  app.post("/api/reports", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (request, reply) => {
    const user = requireUser(request);
    const body = reportBody.parse(request.body);
    const [row] = await app.db
      .insert(reports)
      .values({ reporterId: user.id, ...body })
      .returning({ id: reports.id });
    return reply.code(201).send(row);
  });

  app.get("/api/admin/reports", async (request) => {
    requireRole(request, "admin");
    return app.db.select().from(reports).where(eq(reports.status, "open")).orderBy(desc(reports.createdAt)).limit(100);
  });

  app.post<{ Params: { userId: string } }>("/api/admin/users/:userId/hide-nickname", async (request) => {
    const admin = requireRole(request, "admin");
    const body = hideBody.parse(request.body);
    const userId = z.uuid().parse(request.params.userId);

    await app.db.transaction(async (tx) => {
      const updated = await tx
        .update(profiles)
        .set({ nicknameHidden: true })
        .where(eq(profiles.userId, userId))
        .returning({ nickname: profiles.nickname });
      if (!updated.length) throw notFound("User");
      await tx.insert(auditEvents).values({
        actorId: admin.id,
        action: "profile.hide_nickname",
        targetType: "user",
        targetId: userId,
        reasonCode: body.reasonCode,
        details: { nickname: updated[0]!.nickname, note: body.note ?? null },
      });
    });
    return { ok: true };
  });
}
