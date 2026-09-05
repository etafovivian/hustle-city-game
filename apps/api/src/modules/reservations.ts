// Pickup reservations (see @hc/shared deals.ts RESERVE): no money moves here; the customer pays at the shop.

import { businessMembers, businesses, products, profiles, reservations } from "@hc/db";
import { DEAL_CODE_ALPHABET, RESERVE, type ReservationStatus, type ReservationView } from "@hc/shared";
import { randomInt } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";
import { sendPing } from "./presence.js";

const code = () => `RS-${Array.from({ length: 5 }, () => DEAL_CODE_ALPHABET[randomInt(DEAL_CODE_ALPHABET.length)]).join("")}`;
const H = 3_600_000;

export async function reservationRoutes(app: FastifyInstance) {
  type Row = { r: typeof reservations.$inferSelect; p: typeof products.$inferSelect; b: typeof businesses.$inferSelect; nick?: string | null };
  /** Past its deadline, a request or a confirmed hold has expired. */
  const statusOf = (r: typeof reservations.$inferSelect, now: Date): ReservationStatus =>
    (r.status === "requested" || r.status === "confirmed") && r.expiresAt < now ? "expired" : (r.status as ReservationStatus);
  const view = ({ r, p, b, nick }: Row, now: Date): ReservationView => ({
    id: r.id,
    code: r.code,
    product: p.name,
    priceKobo: p.priceKobo,
    qty: r.qty,
    note: r.note,
    status: statusOf(r, now),
    expiresAt: r.expiresAt.toISOString(),
    businessName: b.name,
    pickupAddress: b.pickupAddress,
    ...(nick !== undefined ? { customer: nick ?? "a player" } : {}),
  });
  const members = async (businessId: string) => (await app.db.select({ userId: businessMembers.userId }).from(businessMembers).where(eq(businessMembers.businessId, businessId))).map((m) => m.userId);

  app.post<{ Params: { id: string } }>("/api/products/:id/reserve", async (request, reply) => {
    const user = requireUser(request);
    const productId = z.uuid().parse(request.params.id);
    const { qty, note } = z.object({ qty: z.number().int().min(1).max(RESERVE.maxQty), note: z.string().trim().max(200).default("") }).parse(request.body);
    const now = new Date();
    const [row] = await app.db
      .select({ p: products, b: businesses })
      .from(products)
      .innerJoin(businesses, eq(businesses.id, products.businessId))
      .where(and(eq(products.id, productId), eq(products.status, "published"), eq(businesses.status, "published"), eq(businesses.kind, "retail")));
    if (!row) throw notFound("Product");
    const team = await members(row.b.id);
    if (team.includes(user.id)) throw new AppError(409, "own_shop", "That's your own shop.");
    const open = (await app.db.select().from(reservations).where(and(eq(reservations.userId, user.id), inArray(reservations.status, ["requested", "confirmed"])))).filter((r) => r.expiresAt > now);
    if (open.length >= RESERVE.maxOpen) throw new AppError(409, "too_many", `You have ${RESERVE.maxOpen} reservations waiting. Collect or cancel one first.`);
    const [r] = await app.db
      .insert(reservations)
      .values({ productId, businessId: row.b.id, userId: user.id, qty, note, code: code(), expiresAt: new Date(now.getTime() + RESERVE.confirmHours * H) })
      .returning();
    const [me] = await app.db.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, user.id));
    for (const m of team) sendPing(m, { from: me?.nickname ?? "a customer", kind: "note", place: null, text: `🛍️ New reservation at ${row.b.name}: ${qty} × ${row.p.name}. Confirm it in Phone → Business.` });
    return reply.code(201).send(view({ r: r!, p: row.p, b: row.b }, now));
  });

  app.get("/api/reservations/mine", async (request) => {
    const user = requireUser(request);
    const now = new Date();
    const rows = await app.db
      .select({ r: reservations, p: products, b: businesses })
      .from(reservations)
      .innerJoin(products, eq(products.id, reservations.productId))
      .innerJoin(businesses, eq(businesses.id, reservations.businessId))
      .where(eq(reservations.userId, user.id))
      .orderBy(desc(reservations.createdAt))
      .limit(30);
    return rows.map((x) => view(x, now));
  });

  app.get<{ Params: { id: string } }>("/api/businesses/:id/reservations", async (request) => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    if (!(await members(businessId)).includes(user.id)) throw notFound("Business");
    const now = new Date();
    const rows = await app.db
      .select({ r: reservations, p: products, b: businesses, nick: profiles.nickname })
      .from(reservations)
      .innerJoin(products, eq(products.id, reservations.productId))
      .innerJoin(businesses, eq(businesses.id, reservations.businessId))
      .leftJoin(profiles, eq(profiles.userId, reservations.userId))
      .where(eq(reservations.businessId, businessId))
      .orderBy(desc(reservations.createdAt))
      .limit(50);
    return rows.map((x) => view(x, now));
  });

  // The shop: confirm (hold it for the customer), decline, or mark collected. The customer: cancel.
  app.post<{ Params: { id: string; action: string } }>("/api/reservations/:id/:action", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const action = z.enum(["confirm", "decline", "collected", "cancel"]).parse(request.params.action);
    const now = new Date();
    const [row] = await app.db
      .select({ r: reservations, p: products, b: businesses })
      .from(reservations)
      .innerJoin(products, eq(products.id, reservations.productId))
      .innerJoin(businesses, eq(businesses.id, reservations.businessId))
      .where(eq(reservations.id, id));
    if (!row) throw notFound("Reservation");
    const isShop = (await members(row.b.id)).includes(user.id);
    const isCustomer = row.r.userId === user.id;
    if (action === "cancel" ? !isCustomer : !isShop) throw notFound("Reservation");
    const status = statusOf(row.r, now);
    const allowed: Record<typeof action, ReservationStatus[]> = { confirm: ["requested"], decline: ["requested", "confirmed"], collected: ["confirmed"], cancel: ["requested", "confirmed"] };
    if (!allowed[action].includes(status)) throw new AppError(409, "bad_state", `This reservation is ${status}.`);
    const next = { confirm: "confirmed", decline: "declined", collected: "collected", cancel: "cancelled" }[action];
    const [r] = await app.db
      .update(reservations)
      .set({ status: next, ...(action === "confirm" ? { expiresAt: new Date(now.getTime() + RESERVE.holdHours * H) } : {}) })
      .where(eq(reservations.id, id))
      .returning();
    if (action === "confirm" || action === "decline")
      sendPing(row.r.userId, {
        from: row.b.name,
        kind: "note",
        place: null,
        text: action === "confirm" ? `✅ ${row.b.name} is holding ${row.r.qty} × ${row.p.name} for you (code ${row.r.code}). Pick it up within ${RESERVE.holdHours} hours.` : `${row.b.name} couldn't hold ${row.p.name} for you this time.`,
      });
    return view({ r: r!, p: row.p, b: row.b }, now);
  });
}
