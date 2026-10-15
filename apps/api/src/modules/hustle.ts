// The hustle board (see @hc/shared hustle.ts): players hire players, with the fee held in escrow from the moment a
// job goes up. Every state change locks the job's row, so a fee is only ever paid or refunded once (the ledger
// references are unique per job too).

import { auditEvents, hustleJobs, hustleReports, profiles } from "@hc/db";
import { HUSTLE_KIND_BY_KEY, HUSTLE_KINDS, HUSTLE_RULES, hustleTextProblem, type HustleJobView, type HustleKind, type HustleStatus } from "@hc/shared";
import { and, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { lockProfile, type Tx } from "../lib/db.js";
import { AppError, notFound } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";
import { addSkill } from "./game/skills.js";
import { sendPing } from "./presence.js";

const HOUR = 3_600_000;
const KIND_KEYS = HUSTLE_KINDS.map((k) => k.key) as [string, ...string[]];
const postBody = z.object({
  kind: z.enum(KIND_KEYS),
  title: z.string().trim().min(3, "Give it a short title.").max(HUSTLE_RULES.titleMax),
  details: z.string().trim().max(HUSTLE_RULES.detailsMax).default(""),
  fee: z.number().int().min(HUSTLE_RULES.minFee).max(HUSTLE_RULES.maxFee),
  place: z.string().trim().max(60).nullable().default(null),
});
const reportBody = z.object({ reason: z.string().trim().min(3).max(200) });
const resolveBody = z.object({ decision: z.enum(["pay", "refund", "remove"]), note: z.string().max(300).optional() });

type Job = typeof hustleJobs.$inferSelect;

export async function hustleRoutes(app: FastifyInstance) {
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date()));
  const lockJob = async (tx: Tx, id: string) => {
    const [job] = await tx.select().from(hustleJobs).where(eq(hustleJobs.id, id)).for("update");
    if (!job) throw notFound("Job");
    return job;
  };
  const set = (tx: Tx, id: string, values: Partial<Job>) => tx.update(hustleJobs).set(values).where(eq(hustleJobs.id, id));

  /** Pay the worker (once): the fee, skill points for the kind of work, and XP for both sides. */
  const pay = async (tx: Tx, job: Job, now: Date) => {
    if (!job.workerId) return;
    await postCoins(tx, job.workerId, job.fee, "hustle_pay", `hustle_pay:${job.id}`);
    await addSkill(tx, job.workerId, HUSTLE_KIND_BY_KEY.get(job.kind as HustleKind)?.skill, HUSTLE_RULES.skillPoints);
    await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${HUSTLE_RULES.xp}` }).where(inArray(profiles.userId, [job.workerId, job.posterId]));
    await set(tx, job.id, { status: "paid", closedAt: now });
  };
  const refund = async (tx: Tx, job: Job, now: Date, status: HustleStatus) => {
    await postCoins(tx, job.posterId, job.fee, "hustle_refund", `hustle_refund:${job.id}`);
    await set(tx, job.id, { status, closedAt: now });
  };

  /** Jobs marked done that the poster never answered: paid on their own after a day. */
  const settleOverdue = async (now: Date) => {
    const due = await app.db
      .select({ id: hustleJobs.id })
      .from(hustleJobs)
      .where(and(eq(hustleJobs.status, "done"), lt(hustleJobs.doneAt, new Date(now.getTime() - HUSTLE_RULES.autoPayHours * HOUR))))
      .limit(50);
    for (const { id } of due)
      await inTx(async (tx) => {
        const job = await lockJob(tx, id);
        if (job.status === "done") await pay(tx, job, now);
      });
  };

  const views = async (jobs: Job[], me: string): Promise<HustleJobView[]> => {
    if (!jobs.length) return [];
    const ids = [...new Set(jobs.flatMap((j) => [j.posterId, j.workerId ?? j.posterId]))];
    const names = new Map(
      (await app.db.select({ id: profiles.userId, nickname: profiles.nickname, hidden: profiles.nicknameHidden }).from(profiles).where(inArray(profiles.userId, ids))).map((p) => [
        p.id,
        p.hidden ? "Hidden player" : p.nickname,
      ]),
    );
    const mine = new Set(
      (await app.db.select({ id: hustleReports.jobId }).from(hustleReports).where(and(eq(hustleReports.reporterId, me), inArray(hustleReports.jobId, jobs.map((j) => j.id))))).map((r) => r.id),
    );
    return jobs.map((j) => {
      const kind = HUSTLE_KIND_BY_KEY.get(j.kind as HustleKind);
      return {
        id: j.id,
        kind: j.kind as HustleKind,
        title: j.title,
        details: j.details,
        fee: j.fee,
        place: j.place,
        status: j.status as HustleStatus,
        poster: { id: j.posterId, nickname: names.get(j.posterId) ?? "Someone" },
        worker: j.workerId ? { id: j.workerId, nickname: names.get(j.workerId) ?? "Someone" } : null,
        createdAt: j.createdAt.toISOString(),
        takenAt: j.takenAt?.toISOString() ?? null,
        doneAt: j.doneAt?.toISOString() ?? null,
        autoPayAt: j.doneAt ? new Date(j.doneAt.getTime() + HUSTLE_RULES.autoPayHours * HOUR).toISOString() : null,
        canFinishAt: j.takenAt && kind ? new Date(j.takenAt.getTime() + kind.minutes * 60_000).toISOString() : null,
        mine: j.posterId === me,
        working: j.workerId === me,
        reportedByMe: mine.has(j.id),
      };
    });
  };

  const needXp = async (tx: Tx, userId: string, what: string) => {
    const p = await lockProfile(tx, userId);
    if (p.xp < HUSTLE_RULES.minXp) throw new AppError(403, "too_new", `Play a little first: you need ${HUSTLE_RULES.minXp} XP to ${what} on the hustle board.`);
    return p;
  };
  const clean = (field: string, text: string) => {
    const problem = hustleTextProblem(text);
    if (problem) throw new AppError(400, "bad_text", `${field}: ${problem}`);
    return text;
  };

  // The board: open jobs (newest first) and your own jobs, as poster or worker.
  app.get("/api/hustle", async (request) => {
    const user = requireUser(request);
    const now = new Date();
    await settleOverdue(now);
    const open = await app.db.select().from(hustleJobs).where(eq(hustleJobs.status, "open")).orderBy(desc(hustleJobs.createdAt)).limit(60);
    const mine = await app.db
      .select()
      .from(hustleJobs)
      .where(and(or(eq(hustleJobs.posterId, user.id), eq(hustleJobs.workerId, user.id)), or(inArray(hustleJobs.status, ["open", "taken", "done", "disputed"]), gte(hustleJobs.closedAt, new Date(now.getTime() - 72 * HOUR)))))
      .orderBy(desc(hustleJobs.createdAt))
      .limit(40);
    return { open: await views(open, user.id), mine: await views(mine, user.id) };
  });

  // Post a job: the fee is held from your coins straight away.
  app.post("/api/hustle", { config: { rateLimit: { max: 10 * app.config.ACTION_RATE_SCALE, timeWindow: "1 hour" } } }, async (request, reply) => {
    const user = requireUser(request);
    const body = postBody.parse(request.body);
    const job = await inTx(async (tx) => {
      await needXp(tx, user.id, "post");
      const [{ n }] = (await tx
        .select({ n: count() })
        .from(hustleJobs)
        .where(and(eq(hustleJobs.posterId, user.id), inArray(hustleJobs.status, ["open", "taken", "done", "disputed"])))) as [{ n: number }];
      if (Number(n) >= HUSTLE_RULES.maxOpenPosts) throw new AppError(409, "too_many", `You can have ${HUSTLE_RULES.maxOpenPosts} jobs going at once. Finish or cancel one first.`);
      const [row] = await tx
        .insert(hustleJobs)
        .values({ posterId: user.id, kind: body.kind, title: clean("Title", body.title), details: clean("Details", body.details), fee: body.fee, place: body.place })
        .returning();
      await postCoins(tx, user.id, -body.fee, "hustle_escrow", `hustle_escrow:${row!.id}`);
      return row!;
    });
    return reply.code(201).send((await views([job], user.id))[0]);
  });

  const act = (path: string, fn: (tx: Tx, job: Job, userId: string, now: Date, body: unknown) => Promise<void>) =>
    app.post<{ Params: { id: string } }>(`/api/hustle/:id/${path}`, async (request) => {
      const user = requireUser(request);
      const id = z.uuid().parse(request.params.id);
      const job = await inTx(async (tx, now) => {
        const j = await lockJob(tx, id);
        await fn(tx, j, user.id, now, request.body);
        return (await tx.select().from(hustleJobs).where(eq(hustleJobs.id, id)))[0]!;
      });
      return (await views([job], user.id))[0];
    });

  act("take", async (tx, job, me, now) => {
    if (job.status !== "open") throw new AppError(409, "not_open", "Someone else got there first.");
    if (job.posterId === me) throw new AppError(409, "own_job", "That's your own job.");
    await needXp(tx, me, "take jobs");
    const [{ n }] = (await tx.select({ n: count() }).from(hustleJobs).where(and(eq(hustleJobs.workerId, me), gte(hustleJobs.takenAt, new Date(now.getTime() - 24 * HOUR))))) as [{ n: number }];
    if (Number(n) >= HUSTLE_RULES.maxTakesPerDay) throw new AppError(429, "too_many", `You've taken ${HUSTLE_RULES.maxTakesPerDay} jobs today. Rest small; come back tomorrow.`);
    await set(tx, job.id, { status: "taken", workerId: me, takenAt: now });
    sendPing(job.posterId, { from: me, kind: "note", place: job.place, text: `took your job "${job.title}"` });
  });

  // The worker gives the job back (it goes back on the board).
  act("drop", async (tx, job, me) => {
    if (job.status !== "taken" || job.workerId !== me) throw new AppError(409, "not_yours", "You're not on this job.");
    await set(tx, job.id, { status: "open", workerId: null, takenAt: null });
    sendPing(job.posterId, { from: me, kind: "note", place: job.place, text: `gave back your job "${job.title}"` });
  });

  act("done", async (tx, job, me, now) => {
    if (job.status !== "taken" || job.workerId !== me) throw new AppError(409, "not_yours", "You're not on this job.");
    const minutes = HUSTLE_KIND_BY_KEY.get(job.kind as HustleKind)?.minutes ?? 5;
    if (now.getTime() - job.takenAt!.getTime() < minutes * 60_000) throw new AppError(409, "too_soon", `This job takes at least ${minutes} minutes. Keep at it.`);
    await set(tx, job.id, { status: "done", doneAt: now });
    sendPing(job.posterId, { from: me, kind: "note", place: job.place, text: `finished "${job.title}". Confirm to pay them (it pays on its own in a day).` });
  });

  act("confirm", async (tx, job, me, now) => {
    if (job.posterId !== me) throw notFound("Job");
    if (job.status !== "done") throw new AppError(409, "not_done", "The worker hasn't marked it done yet.");
    await pay(tx, job, now);
    sendPing(job.workerId!, { from: me, kind: "note", place: job.place, text: `paid you ${job.fee} coins for "${job.title}"` });
  });

  // The poster says the work wasn't done: the fee stays held until an admin decides.
  act("dispute", async (tx, job, me) => {
    if (job.posterId !== me) throw notFound("Job");
    if (job.status !== "done") throw new AppError(409, "not_done", "You can only dispute a job that's been marked done.");
    await set(tx, job.id, { status: "disputed" });
  });

  // Cancel: an open job any time; a taken job only when the worker has had it a day without finishing.
  act("cancel", async (tx, job, me, now) => {
    if (job.posterId !== me) throw notFound("Job");
    const noShow = job.status === "taken" && now.getTime() - job.takenAt!.getTime() > HUSTLE_RULES.noShowHours * HOUR;
    if (job.status !== "open" && !noShow) throw new AppError(409, "in_progress", "Someone is on this job. You can cancel it if they haven't finished in a day.");
    await refund(tx, job, now, "cancelled");
    if (job.workerId) sendPing(job.workerId, { from: me, kind: "note", place: job.place, text: `cancelled "${job.title}"` });
  });

  // Report a job; enough reports from different players hide it (fee back to the poster) until an admin looks.
  act("report", async (tx, job, me, now, body) => {
    const { reason } = reportBody.parse(body);
    if (job.posterId === me) throw new AppError(409, "own_job", "That's your own job.");
    await tx.insert(hustleReports).values({ jobId: job.id, reporterId: me, reason }).onConflictDoNothing();
    const [{ n }] = (await tx.select({ n: count() }).from(hustleReports).where(eq(hustleReports.jobId, job.id))) as [{ n: number }];
    if (Number(n) >= HUSTLE_RULES.hideAfterReports && job.status === "open") await refund(tx, job, now, "removed");
  });

  // Admin: disputed jobs and reported ones.
  app.get("/api/admin/hustle", async (request) => {
    const admin = requireRole(request, "admin");
    const reported = await app.db.select({ id: hustleReports.jobId, n: count() }).from(hustleReports).groupBy(hustleReports.jobId);
    const jobs = await app.db
      .select()
      .from(hustleJobs)
      .where(or(eq(hustleJobs.status, "disputed"), reported.length ? inArray(hustleJobs.id, reported.map((r) => r.id)) : sql`false`))
      .orderBy(desc(hustleJobs.createdAt))
      .limit(100);
    const reasons = jobs.length ? await app.db.select().from(hustleReports).where(inArray(hustleReports.jobId, jobs.map((j) => j.id))) : [];
    return (await views(jobs, admin.id)).map((v) => ({ ...v, reports: reasons.filter((r) => r.jobId === v.id).map((r) => r.reason) }));
  });

  app.post<{ Params: { id: string } }>("/api/admin/hustle/:id/resolve", async (request) => {
    const admin = requireRole(request, "admin");
    const id = z.uuid().parse(request.params.id);
    const { decision, note } = resolveBody.parse(request.body);
    await inTx(async (tx, now) => {
      const job = await lockJob(tx, id);
      if (decision === "pay") {
        if (job.status !== "disputed" || !job.workerId) throw new AppError(409, "bad_state", "Only a disputed job with a worker can be paid.");
        await pay(tx, job, now);
      } else if (decision === "refund") {
        if (!["disputed", "taken", "open"].includes(job.status)) throw new AppError(409, "bad_state", "This job's fee has already been settled.");
        await refund(tx, job, now, "cancelled");
      } else if (decision === "remove") {
        if (["paid", "cancelled", "removed"].includes(job.status)) await set(tx, job.id, { status: "removed" });
        else await refund(tx, job, now, "removed");
      }
      await tx.insert(auditEvents).values({ actorId: admin.id, action: `hustle.${decision}`, targetType: "hustle_job", targetId: job.id, reasonCode: decision, details: { note: note ?? null, fee: job.fee } });
    });
    return { ok: true };
  });
}
