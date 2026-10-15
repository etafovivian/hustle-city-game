// Beta feedback: "Report a problem" from inside the game, and errors caught in players' browsers (sent on their own,
// counted per player and error instead of stored again). Admins read and triage them in Phone → Admin.

import { feedback, profiles } from "@hc/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole, requireUser } from "../plugins/auth.js";

/** Context the client attaches (where they were, the device, the build); kept small. */
const context = z
  .record(z.string(), z.unknown())
  .default({})
  .refine((c) => JSON.stringify(c).length <= 4000, "Too much context.");
const reportBody = z.object({ kind: z.enum(["bug", "idea", "other"]), message: z.string().trim().min(5, "Say a little more (what happened, where).").max(1000), context });
const errorBody = z.object({ message: z.string().trim().min(1).max(500), stack: z.string().max(3000).default(""), context });

export async function feedbackRoutes(app: FastifyInstance) {
  app.post("/api/feedback", { config: { rateLimit: { max: 10 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } }, async (request, reply) => {
    const user = requireUser(request);
    const body = reportBody.parse(request.body);
    const [row] = await app.db.insert(feedback).values({ userId: user.id, kind: body.kind, message: body.message, context: body.context }).returning({ id: feedback.id });
    return reply.code(201).send(row);
  });

  // Browser errors: the same error from the same player bumps a counter (never floods the table).
  app.post("/api/feedback/error", { config: { rateLimit: { max: 30 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } }, async (request, reply) => {
    const body = errorBody.parse(request.body);
    const userId = request.user?.id ?? null;
    const fingerprint = (body.message + "|" + body.stack.split("\n").slice(0, 2).join("|")).slice(0, 300);
    request.log.warn({ clientError: body.message, userId }, "client error");
    await app.db
      .insert(feedback)
      .values({ userId, kind: "error", message: body.message, context: { ...body.context, stack: body.stack }, fingerprint })
      .onConflictDoUpdate({ target: [feedback.userId, feedback.fingerprint], set: { count: sql`${feedback.count} + 1`, lastAt: sql`now()`, status: "new" } });
    return reply.code(204).send();
  });

  app.get("/api/admin/feedback", async (request) => {
    requireRole(request, "admin");
    const q = z.object({ kind: z.enum(["bug", "idea", "other", "error", "all"]).default("all"), status: z.enum(["new", "seen", "fixed", "all"]).default("new") }).parse(request.query);
    const where = and(q.kind === "all" ? undefined : eq(feedback.kind, q.kind), q.status === "all" ? undefined : eq(feedback.status, q.status));
    const rows = await app.db.select().from(feedback).where(where).orderBy(desc(feedback.lastAt)).limit(200);
    const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
    const names = new Map(ids.length ? (await app.db.select({ id: profiles.userId, n: profiles.nickname }).from(profiles).where(inArray(profiles.userId, ids))).map((p) => [p.id, p.n]) : []);
    return rows.map((r) => ({ ...r, nickname: r.userId ? (names.get(r.userId) ?? null) : null }));
  });

  app.post<{ Params: { id: string } }>("/api/admin/feedback/:id", async (request) => {
    requireRole(request, "admin");
    const id = z.uuid().parse(request.params.id);
    const { status } = z.object({ status: z.enum(["new", "seen", "fixed"]) }).parse(request.body);
    await app.db.update(feedback).set({ status }).where(eq(feedback.id, id));
    return { ok: true };
  });
}
