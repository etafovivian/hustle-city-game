// Stage B1 artisan quote journey: request → quote (versioned) → accept → booked → done → confirm → review.
// Only the customer and the business's members can see a request; anyone else gets 404.
// Every change locks the request row, checks the shared state machine and writes an append-only event.

import { businessMembers, businesses, profiles, quoteVersions, reviews, serviceEvents, serviceRequests } from "@hc/db";
import {
  LAGOS_AREA_SET,
  OPEN_STATUSES,
  availableActions,
  nextStatus,
  quoteProblem,
  quoteTotal,
  waitingOn,
  type QuoteItem,
  type RequestAction,
  type RequestRole,
  type RequestStatus,
  type ServiceRequestDetail,
  type ServiceRequestSummary,
} from "@hc/shared";
import { and, asc, count, desc, eq, inArray, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Tx } from "../lib/db.js";
import { AppError, notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";

const requestBody = z.object({
  businessId: z.uuid(),
  description: z.string().trim().min(15, "Describe the job in at least 15 characters.").max(1000),
  serviceArea: z.string().refine((a) => LAGOS_AREA_SET.has(a), "Choose your area from the list."),
});
const quoteBody = z.object({
  items: z.array(z.object({ label: z.string().max(80), amountKobo: z.number().int() })).max(20),
  appointmentAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(500).default(""),
});
const noteBody = z.object({ note: z.string().trim().max(500).default("") });
const acceptBody = z.object({ version: z.number().int().positive() });
const reviewBody = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(600).default("") });

/** Open requests one customer may have with one business at a time (spam guard). */
const MAX_OPEN_PER_BUSINESS = 3;

type RequestRow = typeof serviceRequests.$inferSelect;

/** The request and the viewer's role in it; 404 when the viewer is neither party. */
async function loadForViewer(tx: Tx | FastifyInstance["db"], id: string, userId: string, lock = false) {
  const q = tx.select().from(serviceRequests).where(eq(serviceRequests.id, id));
  const [req] = lock ? await q.for("update") : await q;
  if (!req) throw notFound("Request");
  let role: RequestRole | null = req.customerId === userId ? "customer" : null;
  if (!role) {
    const [member] = await tx
      .select({ role: businessMembers.role })
      .from(businessMembers)
      .where(and(eq(businessMembers.businessId, req.businessId), eq(businessMembers.userId, userId)));
    if (member) role = "artisan";
  }
  if (!role) throw notFound("Request");
  return { req, role };
}

async function summaries(db: FastifyInstance["db"], rows: RequestRow[], viewerId: string): Promise<ServiceRequestSummary[]> {
  if (!rows.length) return [];
  const bizRows = await db.select({ id: businesses.id, name: businesses.name, category: businesses.category }).from(businesses).where(inArray(businesses.id, [...new Set(rows.map((r) => r.businessId))]));
  const people = await db.select({ userId: profiles.userId, nickname: profiles.nickname, hidden: profiles.nicknameHidden }).from(profiles).where(inArray(profiles.userId, [...new Set(rows.map((r) => r.customerId))]));
  const latest = await db
    .select({ requestId: quoteVersions.requestId, version: quoteVersions.version, totalKobo: quoteVersions.totalKobo })
    .from(quoteVersions)
    .where(inArray(quoteVersions.requestId, rows.map((r) => r.id)));
  return rows.map((r) => {
    const role: RequestRole = r.customerId === viewerId ? "customer" : "artisan";
    const biz = bizRows.find((b) => b.id === r.businessId);
    const person = people.find((p) => p.userId === r.customerId);
    const status = r.status as RequestStatus;
    return {
      id: r.id,
      role,
      businessId: r.businessId,
      businessName: biz?.name ?? "A business",
      counterpart: role === "customer" ? (biz?.name ?? "A business") : person && !person.hidden ? `@${person.nickname}` : "A customer",
      category: biz?.category ?? "",
      status,
      yourTurn: waitingOn(status) === role,
      latestTotalKobo: latest.find((q) => q.requestId === r.id && q.version === r.currentVersion)?.totalKobo ?? null,
      scheduledFor: r.scheduledFor?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

export async function serviceRoutes(app: FastifyInstance) {
  const myBusinessIds = async (userId: string) =>
    new Set((await app.db.select({ id: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId))).map((r) => r.id));

  async function detail(id: string, userId: string): Promise<ServiceRequestDetail> {
    const { req, role } = await loadForViewer(app.db, id, userId);
    const [summary] = await summaries(app.db, [req], userId);
    const quotes = await app.db.select().from(quoteVersions).where(eq(quoteVersions.requestId, id)).orderBy(asc(quoteVersions.version));
    const events = await app.db.select().from(serviceEvents).where(eq(serviceEvents.requestId, id)).orderBy(asc(serviceEvents.id));
    const [review] = await app.db.select().from(reviews).where(eq(reviews.requestId, id));
    return {
      ...summary!,
      role,
      yourTurn: waitingOn(req.status as RequestStatus) === role,
      description: req.description,
      serviceArea: req.serviceArea,
      createdAt: req.createdAt.toISOString(),
      quotes: quotes.map((q) => ({
        version: q.version,
        items: q.items as QuoteItem[],
        totalKobo: q.totalKobo,
        note: q.note,
        appointmentAt: q.appointmentAt.toISOString(),
        createdAt: q.createdAt.toISOString(),
      })),
      events: events.map((e) => ({ type: e.type, by: e.actorRole as "customer" | "artisan" | "system", version: e.version, note: e.note, at: e.createdAt.toISOString() })),
      review: review ? { rating: review.rating, body: review.body, at: review.createdAt.toISOString() } : null,
      can: availableActions(req.status as RequestStatus, role, !!review),
    };
  }

  /** Run one action: lock, check the state machine, apply, record the event. */
  async function act(
    id: string,
    userId: string,
    action: RequestAction,
    apply?: (tx: Tx, req: RequestRow) => Promise<{ set?: Partial<RequestRow>; version?: number; note?: string } | void>,
    note = "",
  ) {
    await app.db.transaction(async (tx) => {
      const { req, role } = await loadForViewer(tx, id, userId, true);
      const to = nextStatus(req.status as RequestStatus, action, role);
      if (!to) throw new AppError(409, "not_allowed_now", "That step isn't available for this request right now.");
      const extra = (await apply?.(tx, req)) ?? {};
      await tx
        .update(serviceRequests)
        .set({ status: to, updatedAt: new Date(), ...extra.set })
        .where(eq(serviceRequests.id, id));
      await tx.insert(serviceEvents).values({ requestId: id, actorId: userId, actorRole: role, type: action, version: extra.version ?? null, note: extra.note ?? note });
    });
    return detail(id, userId);
  }

  // Customer: ask an artisan for a quote.
  app.post("/api/services/requests", { config: { rateLimit: { max: 10 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } }, async (request, reply) => {
    const user = requireUser(request);
    const body = requestBody.parse(request.body);
    const id = await app.db.transaction(async (tx) => {
      const [biz] = await tx.select().from(businesses).where(eq(businesses.id, body.businessId));
      if (!biz || biz.status !== "published" || biz.kind !== "artisan") throw notFound("Artisan");
      const [member] = await tx
        .select()
        .from(businessMembers)
        .where(and(eq(businessMembers.businessId, biz.id), eq(businessMembers.userId, user.id)));
      if (member) throw new AppError(422, "own_business", "You can't request a quote from your own business.");
      const [open] = await tx
        .select({ n: count() })
        .from(serviceRequests)
        .where(and(eq(serviceRequests.businessId, biz.id), eq(serviceRequests.customerId, user.id), inArray(serviceRequests.status, [...OPEN_STATUSES])));
      if ((open?.n ?? 0) >= MAX_OPEN_PER_BUSINESS) {
        throw new AppError(422, "too_many_open", "You already have open requests with this business. Finish or cancel one first.");
      }
      const [row] = await tx
        .insert(serviceRequests)
        .values({ businessId: biz.id, customerId: user.id, description: body.description, serviceArea: body.serviceArea })
        .returning({ id: serviceRequests.id });
      await tx.insert(serviceEvents).values({ requestId: row!.id, actorId: user.id, actorRole: "customer", type: "requested" });
      return row!.id;
    });
    return reply.code(201).send(await detail(id, user.id));
  });

  // Both sides: my requests as a customer, and requests to businesses I belong to.
  app.get("/api/services/requests", async (request): Promise<ServiceRequestSummary[]> => {
    const user = requireUser(request);
    const mine = await myBusinessIds(user.id);
    const where = mine.size
      ? or(eq(serviceRequests.customerId, user.id), inArray(serviceRequests.businessId, [...mine]))
      : eq(serviceRequests.customerId, user.id);
    const rows = await app.db.select().from(serviceRequests).where(where).orderBy(desc(serviceRequests.updatedAt)).limit(100);
    return summaries(app.db, rows, user.id);
  });

  app.get<{ Params: { id: string } }>("/api/services/requests/:id", async (request) => {
    const user = requireUser(request);
    return detail(z.uuid().parse(request.params.id), user.id);
  });

  // Artisan: send a quote, or a revised one (a new version the customer must accept).
  app.post<{ Params: { id: string } }>("/api/services/requests/:id/quote", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const body = quoteBody.parse(request.body);
    const items = body.items.map((i) => ({ label: i.label.trim(), amountKobo: i.amountKobo }));
    const appointmentAt = new Date(body.appointmentAt);
    const problem = quoteProblem(items, appointmentAt, new Date());
    if (problem) throw new AppError(400, "invalid_quote", problem);
    return act(id, user.id, "quote", async (tx, req) => {
      const version = req.currentVersion + 1;
      await tx.insert(quoteVersions).values({ requestId: id, version, items, totalKobo: quoteTotal(items), note: body.note, appointmentAt, createdBy: user.id });
      return { set: { currentVersion: version, scheduledFor: null }, version, note: body.note };
    });
  });

  // Customer: accept the latest quote; its appointment becomes the booking.
  app.post<{ Params: { id: string } }>("/api/services/requests/:id/accept", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const { version } = acceptBody.parse(request.body);
    return act(id, user.id, "accept", async (tx, req) => {
      if (version !== req.currentVersion) throw new AppError(409, "quote_changed", "The quote was updated. Check the latest version before accepting.");
      const [q] = await tx
        .select()
        .from(quoteVersions)
        .where(and(eq(quoteVersions.requestId, id), eq(quoteVersions.version, version)));
      if (!q) throw notFound("Quote");
      return { set: { scheduledFor: q.appointmentAt }, version };
    });
  });

  // Simple transitions with an optional note.
  const simple: [string, RequestAction][] = [
    ["decline", "decline"],
    ["cancel", "cancel"],
    ["complete", "complete"],
    ["confirm", "confirm"],
    ["not-done", "not_done"],
  ];
  for (const [path, action] of simple) {
    app.post<{ Params: { id: string } }>(`/api/services/requests/:id/${path}`, async (request) => {
      const user = requireUser(request);
      const id = z.uuid().parse(request.params.id);
      const { note } = noteBody.parse(request.body ?? {});
      return act(id, user.id, action, undefined, note);
    });
  }

  // A short message on an open request (no public chat; this thread only has the two parties).
  app.post<{ Params: { id: string } }>("/api/services/requests/:id/note", { config: { rateLimit: { max: 30 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } }, async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const { note } = noteBody.parse(request.body ?? {});
    if (note.length < 1) throw new AppError(400, "empty_note", "Write a message first.");
    return act(id, user.id, "note", undefined, note);
  });

  // Customer: one review per completed request.
  app.post<{ Params: { id: string } }>("/api/services/requests/:id/review", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const body = reviewBody.parse(request.body);
    try {
      return await act(id, user.id, "review", async (tx, req) => {
        await tx.insert(reviews).values({ requestId: id, businessId: req.businessId, reviewerId: user.id, rating: body.rating, body: body.body });
        return { note: `${body.rating}★` };
      });
    } catch (err) {
      const pg = (err as { cause?: { code?: string } }).cause;
      if (pg?.code === "23505") throw new AppError(409, "already_reviewed", "You already reviewed this job.");
      throw err;
    }
  });
}
