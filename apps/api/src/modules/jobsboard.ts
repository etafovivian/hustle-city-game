// Jobs board (see @hc/shared deals.ts): verified businesses post real vacancies; players apply with a message and
// the contact they choose to share; the business sees their Academy certificates and can shortlist or decline.

import { businessMembers, businesses, certificateRevocations, certificates, jobApplications, profiles, uniEnrolments, vacancies } from "@hc/db";
import { LAGOS_AREA_SET, NG_PHONE, PROGRAMME_BY_KEY, VACANCY_KINDS, chatProblem, normalisePhone, type ApplicationView, type VacancyView } from "@hc/shared";
import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";
import { sendPing } from "./presence.js";

const KIND_KEYS = VACANCY_KINDS.map((k) => k.key) as [string, ...string[]];
const clean = (field: string, text: string) => {
  const problem = text ? chatProblem(text) : null;
  if (problem) throw new AppError(400, "bad_text", `${field}: ${problem}`);
  return text;
};

export async function jobsBoardRoutes(app: FastifyInstance) {
  const members = async (businessId: string) => (await app.db.select({ userId: businessMembers.userId }).from(businessMembers).where(eq(businessMembers.businessId, businessId))).map((m) => m.userId);
  const toView = (v: typeof vacancies.$inferSelect, b: typeof businesses.$inferSelect): VacancyView => ({
    id: v.id,
    businessId: b.id,
    businessName: b.name,
    verified: b.verifiedAt !== null,
    title: v.title,
    kind: v.kind as VacancyView["kind"],
    pay: v.pay,
    area: v.area,
    description: v.description,
    wantsCertificate: v.wantsCertificate,
    status: v.status as VacancyView["status"],
    createdAt: v.createdAt.toISOString(),
  });

  app.post<{ Params: { id: string } }>("/api/businesses/:id/vacancies", async (request, reply) => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    const body = z
      .object({
        title: z.string().trim().min(3).max(60),
        kind: z.enum(KIND_KEYS),
        pay: z.string().trim().max(60).default(""),
        area: z.string().refine((a) => LAGOS_AREA_SET.has(a), "Pick an area from the list."),
        description: z.string().trim().min(20, "Say what the job is and who you want (at least a sentence).").max(800),
        wantsCertificate: z.boolean().default(false),
      })
      .parse(request.body);
    if (!(await members(businessId)).includes(user.id)) throw notFound("Business");
    const [b] = await app.db.select().from(businesses).where(eq(businesses.id, businessId));
    if (!b || b.status !== "published") throw new AppError(409, "not_live", "Your business needs to be live first.");
    if (!b.verifiedAt) throw new AppError(409, "not_verified", "Only verified businesses can post jobs (it keeps job scams out). Ask for verification in Phone → Business.");
    const [v] = await app.db
      .insert(vacancies)
      .values({ businessId, ...body, title: clean("Title", body.title), pay: clean("Pay", body.pay), description: clean("Description", body.description) })
      .returning();
    return reply.code(201).send(toView(v!, b));
  });

  app.get<{ Params: { id: string } }>("/api/businesses/:id/vacancies", async (request) => {
    const user = requireUser(request);
    const businessId = z.uuid().parse(request.params.id);
    if (!(await members(businessId)).includes(user.id)) throw notFound("Business");
    const rows = await app.db.select({ v: vacancies, b: businesses }).from(vacancies).innerJoin(businesses, eq(businesses.id, vacancies.businessId)).where(eq(vacancies.businessId, businessId)).orderBy(desc(vacancies.createdAt));
    const counts = rows.length ? await app.db.select({ id: jobApplications.vacancyId, n: count() }).from(jobApplications).where(inArray(jobApplications.vacancyId, rows.map((r) => r.v.id))).groupBy(jobApplications.vacancyId) : [];
    return rows.map(({ v, b }) => ({ ...toView(v, b), applications: Number(counts.find((c) => c.id === v.id)?.n ?? 0) }));
  });

  app.post<{ Params: { id: string } }>("/api/vacancies/:id/close", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const [v] = await app.db.select().from(vacancies).where(eq(vacancies.id, id));
    if (!v || !(await members(v.businessId)).includes(user.id)) throw notFound("Vacancy");
    await app.db.update(vacancies).set({ status: "closed" }).where(eq(vacancies.id, id));
    return { ok: true };
  });

  // Open jobs for everyone (newest first), marked if you've applied.
  app.get("/api/vacancies", async (request) => {
    const { area } = z.object({ area: z.string().max(40).optional() }).parse(request.query);
    const rows = await app.db
      .select({ v: vacancies, b: businesses })
      .from(vacancies)
      .innerJoin(businesses, eq(businesses.id, vacancies.businessId))
      .where(and(eq(vacancies.status, "open"), eq(businesses.status, "published"), isNotNull(businesses.verifiedAt), ...(area ? [eq(vacancies.area, area)] : [])))
      .orderBy(desc(vacancies.createdAt))
      .limit(60);
    const userId = request.user?.id;
    const mine = userId && rows.length ? await app.db.select({ id: jobApplications.vacancyId }).from(jobApplications).where(and(eq(jobApplications.userId, userId), inArray(jobApplications.vacancyId, rows.map((r) => r.v.id)))) : [];
    return rows.map(({ v, b }) => ({ ...toView(v, b), applied: mine.some((m) => m.id === v.id) }));
  });

  app.post<{ Params: { id: string } }>("/api/vacancies/:id/apply", async (request, reply) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const { message, contact } = z
      .object({ message: z.string().trim().min(10, "Say a little about yourself (at least a sentence).").max(600), contact: z.string().trim().max(20) })
      .parse(request.body);
    const phone = normalisePhone(contact);
    if (!NG_PHONE.test(phone)) throw new AppError(400, "bad_phone", "Add a Nigerian phone or WhatsApp number the business can call you on.");
    const [row] = await app.db.select({ v: vacancies, b: businesses }).from(vacancies).innerJoin(businesses, eq(businesses.id, vacancies.businessId)).where(eq(vacancies.id, id));
    if (!row || row.v.status !== "open") throw notFound("Vacancy");
    const team = await members(row.b.id);
    if (team.includes(user.id)) throw new AppError(409, "own", "That's your own business.");
    const [a] = await app.db.insert(jobApplications).values({ vacancyId: id, userId: user.id, message: clean("Message", message), contact: phone }).onConflictDoNothing().returning();
    if (!a) throw new AppError(409, "applied", "You've applied for this one already.");
    const [me] = await app.db.select({ nickname: profiles.nickname }).from(profiles).where(eq(profiles.userId, user.id));
    for (const m of team) sendPing(m, { from: me?.nickname ?? "someone", kind: "note", place: null, text: `💼 New application for "${row.v.title}" at ${row.b.name}. See it in Phone → Business.` });
    return reply.code(201).send({ ok: true });
  });

  app.get<{ Params: { id: string } }>("/api/vacancies/:id/applications", async (request): Promise<ApplicationView[]> => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const [v] = await app.db.select().from(vacancies).where(eq(vacancies.id, id));
    if (!v || !(await members(v.businessId)).includes(user.id)) throw notFound("Vacancy");
    const rows = await app.db
      .select({ a: jobApplications, nickname: profiles.nickname })
      .from(jobApplications)
      .innerJoin(profiles, eq(profiles.userId, jobApplications.userId))
      .where(eq(jobApplications.vacancyId, id))
      .orderBy(desc(jobApplications.createdAt));
    const ids = rows.map((r) => r.a.userId);
    const certs = ids.length
      ? await app.db
          .select({ userId: certificates.userId, number: certificates.number, courseTitle: certificates.courseTitle })
          .from(certificates)
          .leftJoin(certificateRevocations, eq(certificateRevocations.certificateId, certificates.id))
          .where(and(inArray(certificates.userId, ids), isNull(certificateRevocations.certificateId)))
      : [];
    const degrees = ids.length ? await app.db.select().from(uniEnrolments).where(and(inArray(uniEnrolments.userId, ids), isNotNull(uniEnrolments.graduatedAt))) : [];
    return rows.map(({ a, nickname }) => ({
      id: a.id,
      nickname,
      message: a.message,
      contact: a.contact,
      status: a.status as ApplicationView["status"],
      createdAt: a.createdAt.toISOString(),
      certificates: certs.filter((c) => c.userId === a.userId).map((c) => ({ number: c.number, courseTitle: c.courseTitle })),
      degrees: degrees.filter((d) => d.userId === a.userId).map((d) => PROGRAMME_BY_KEY.get(d.programme)?.degree ?? d.programme),
    }));
  });

  app.post<{ Params: { id: string } }>("/api/applications/:id/status", async (request) => {
    const user = requireUser(request);
    const id = z.uuid().parse(request.params.id);
    const { status } = z.object({ status: z.enum(["shortlisted", "declined"]) }).parse(request.body);
    const [row] = await app.db.select({ a: jobApplications, v: vacancies, b: businesses }).from(jobApplications).innerJoin(vacancies, eq(vacancies.id, jobApplications.vacancyId)).innerJoin(businesses, eq(businesses.id, vacancies.businessId)).where(eq(jobApplications.id, id));
    if (!row || !(await members(row.b.id)).includes(user.id)) throw notFound("Application");
    await app.db.update(jobApplications).set({ status }).where(eq(jobApplications.id, id));
    sendPing(row.a.userId, {
      from: row.b.name,
      kind: "note",
      place: null,
      text: status === "shortlisted" ? `💼 ${row.b.name} shortlisted you for "${row.v.title}". Expect a call on the number you gave.` : `${row.b.name} went with someone else for "${row.v.title}". Keep going!`,
    });
    return { ok: true };
  });
}
