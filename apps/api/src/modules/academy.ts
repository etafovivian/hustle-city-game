// Hustle Academy, step A (docs/academy-plan.md): Lampnet Institute of Technology courses in the game.
// Learners enrol, spend real (server-timed) time on each lesson, pass every module quiz, then claim a free virtual
// certificate with a public verify page. Admins build courses: modules, lessons (unlisted YouTube links or text) and
// quiz questions. Quiz answers never leave the server until an attempt is submitted.

import { randomInt } from "node:crypto";
import {
  certificateRevocations,
  certificates,
  courseModules,
  courses,
  enrolments,
  lessonProgress,
  lessons,
  profiles,
  quizAttempts,
  quizQuestions,
} from "@hc/db";
import {
  CERT_NUMBER_RE,
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  HEARTBEAT,
  PROVIDERS,
  QUIZ,
  TRAINING_FEE_RANGE_KOBO,
  certificateNumber,
  courseRewardRef,
  scoreQuiz,
  youtubeId,
  type AcademyMe,
  type AdminCourse,
  type CertificateView,
  type CourseCard,
  type CourseDetail,
  type LearnerRow,
  type LessonView,
  type ModuleOutline,
  type Provider,
  type QuizAttemptView,
  type QuizResult,
} from "@hc/shared";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { lockProfile, type Tx } from "../lib/db.js";
import { AppError, isUniqueViolation, notFound } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";

type Db = FastifyInstance["db"] | Tx;
type CourseRow = typeof courses.$inferSelect;

// --- Validation -------------------------------------------------------------

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case letters, numbers and dashes.")
  .max(60);
const courseBody = z.object({
  slug,
  title: z.string().trim().min(3).max(100),
  summary: z.string().trim().max(600).default(""),
  category: z.enum(COURSE_CATEGORIES),
  level: z.enum(COURSE_LEVELS).default("beginner"),
  provider: z.enum(Object.keys(PROVIDERS) as [Provider, ...Provider[]]).default("lampnet"),
  rewardCoins: z.number().int().min(0).max(10_000).default(500),
  rewardXp: z.number().int().min(0).max(5_000).default(100),
  trainingFeeKobo: z.number().int().min(TRAINING_FEE_RANGE_KOBO.min).max(TRAINING_FEE_RANGE_KOBO.max).nullable().default(null),
});
const coursePatch = courseBody.partial().extend({ status: z.enum(["draft", "published"]).optional() });
const moduleBody = z.object({
  title: z.string().trim().min(2).max(100),
  quizSize: z.number().int().min(1).max(30).default(QUIZ.defaultSize),
  passPercent: z.number().int().min(50).max(100).default(QUIZ.defaultPassPercent),
});
const lessonBody = z
  .object({
    title: z.string().trim().min(2).max(120),
    kind: z.enum(["video", "text"]).default("video"),
    video: z.string().trim().max(300).default(""),
    body: z.string().trim().max(20_000).default(""),
    minSeconds: z.number().int().min(0).max(4 * 3600).default(60),
  })
  .superRefine((l, ctx) => {
    if (l.kind === "video" && !youtubeId(l.video)) ctx.addIssue({ code: "custom", path: ["video"], message: "Paste a YouTube link (an unlisted video is fine)." });
    if (l.kind === "text" && l.body.length < 20) ctx.addIssue({ code: "custom", path: ["body"], message: "Write the lesson text (at least a few sentences)." });
  });
const questionBody = z
  .object({
    prompt: z.string().trim().min(5).max(500),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    answer: z.number().int().min(0),
    explanation: z.string().trim().max(600).default(""),
    active: z.boolean().default(true),
  })
  .refine((q) => q.answer < q.options.length, { path: ["answer"], message: "Pick the right answer from the options." });
const holderBody = z.object({ holderName: z.string().trim().min(3, "Write your full name as it should appear.").max(80) });
const answersBody = z.object({ answers: z.array(z.number().int().min(0).nullable()).max(30) });

// --- Reading ----------------------------------------------------------------

async function courseBySlug(db: Db, s: string, includeDraft: boolean) {
  const [c] = await db.select().from(courses).where(eq(courses.slug, s));
  if (!c || (!includeDraft && c.status !== "published")) throw notFound("Course");
  return c;
}

/** Modules with their lessons and active question counts, in order. */
async function outline(db: Db, courseId: string) {
  const mods = await db.select().from(courseModules).where(eq(courseModules.courseId, courseId)).orderBy(asc(courseModules.position));
  const ids = mods.map((m) => m.id);
  const ls = ids.length ? await db.select().from(lessons).where(inArray(lessons.moduleId, ids)).orderBy(asc(lessons.position)) : [];
  const qs = ids.length
    ? await db
        .select({ moduleId: quizQuestions.moduleId, n: count() })
        .from(quizQuestions)
        .where(and(inArray(quizQuestions.moduleId, ids), eq(quizQuestions.active, true)))
        .groupBy(quizQuestions.moduleId)
    : [];
  return mods.map((m) => ({ ...m, lessons: ls.filter((l) => l.moduleId === m.id), questions: qs.find((q) => q.moduleId === m.id)?.n ?? 0 }));
}
type Outline = Awaited<ReturnType<typeof outline>>;

/** What a learner has done in a course: finished lessons and passed module quizzes. */
async function progressOf(db: Db, userId: string, o: Outline) {
  const lessonIds = o.flatMap((m) => m.lessons.map((l) => l.id));
  const moduleIds = o.map((m) => m.id);
  const done = lessonIds.length
    ? await db
        .select({ id: lessonProgress.lessonId })
        .from(lessonProgress)
        .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, lessonIds), isNotNull(lessonProgress.completedAt)))
    : [];
  const passed = moduleIds.length
    ? await db
        .selectDistinct({ id: quizAttempts.moduleId })
        .from(quizAttempts)
        .where(and(eq(quizAttempts.userId, userId), inArray(quizAttempts.moduleId, moduleIds), eq(quizAttempts.passed, true)))
    : [];
  const doneSet = new Set(done.map((d) => d.id));
  const passedSet = new Set(passed.map((p) => p.id));
  // Steps: every lesson, plus every module that has a quiz.
  const quizModules = o.filter((m) => m.questions > 0);
  const total = lessonIds.length + quizModules.length;
  const finished = doneSet.size + quizModules.filter((m) => passedSet.has(m.id)).length;
  return { doneSet, passedSet, percent: total ? Math.floor((finished * 100) / total) : 0, complete: total > 0 && finished === total };
}

function card(c: CourseRow, o: Outline): CourseCard {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    category: c.category as CourseCard["category"],
    level: c.level as CourseCard["level"],
    provider: c.provider as Provider,
    modules: o.length,
    lessons: o.reduce((n, m) => n + m.lessons.length, 0),
    rewardCoins: c.rewardCoins,
    rewardXp: c.rewardXp,
    physicalCertKobo: c.physicalCertKobo,
    trainingFeeKobo: c.trainingFeeKobo,
    status: c.status as CourseCard["status"],
  };
}

async function certificateView(db: Db, row: typeof certificates.$inferSelect): Promise<CertificateView> {
  const [rev] = await db.select().from(certificateRevocations).where(eq(certificateRevocations.certificateId, row.id));
  const provider = row.provider as Provider;
  const p = PROVIDERS[provider];
  return {
    number: row.number,
    holderName: row.holderName,
    courseTitle: row.courseTitle,
    provider,
    issuer: "partnerOf" in p ? p.partnerOf : p.name,
    partner: "partnerOf" in p ? p.name : null,
    issuedAt: row.issuedAt.toISOString(),
    kind: row.kind as CertificateView["kind"],
    revoked: !!rev,
    revokedReason: rev?.reason ?? null,
  };
}

async function requireEnrolled(db: Db, userId: string, courseId: string) {
  const [e] = await db.select().from(enrolments).where(and(eq(enrolments.userId, userId), eq(enrolments.courseId, courseId)));
  if (!e) throw new AppError(403, "not_enrolled", "Join the course first.");
  return e;
}

/** The lesson with its module and course (published courses only, unless admin preview). */
async function lessonContext(db: Db, lessonId: string) {
  const [row] = await db
    .select({ l: lessons, m: courseModules, c: courses })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, courseModules.courseId))
    .where(eq(lessons.id, lessonId));
  if (!row || row.c.status !== "published") throw notFound("Lesson");
  return row;
}

// --- Routes -----------------------------------------------------------------

export async function academyRoutes(app: FastifyInstance) {
  // Catalogue: published courses, with the learner's progress when signed in.
  app.get("/api/academy/courses", async (request): Promise<CourseCard[]> => {
    const rows = await app.db.select().from(courses).where(eq(courses.status, "published")).orderBy(asc(courses.title));
    const out: CourseCard[] = [];
    for (const c of rows) {
      const o = await outline(app.db, c.id);
      const cc = card(c, o);
      if (request.user) {
        const [e] = await app.db.select().from(enrolments).where(and(eq(enrolments.userId, request.user.id), eq(enrolments.courseId, c.id)));
        if (e) {
          const p = await progressOf(app.db, request.user.id, o);
          Object.assign(cc, { enrolled: true, percent: p.percent, completed: !!e.completedAt });
        }
      }
      out.push(cc);
    }
    return out;
  });

  app.get<{ Params: { slug: string } }>("/api/academy/courses/:slug", async (request): Promise<CourseDetail> => {
    const c = await courseBySlug(app.db, request.params.slug, false);
    const o = await outline(app.db, c.id);
    const user = request.user;
    const enrolled = user ? (await app.db.select().from(enrolments).where(and(eq(enrolments.userId, user.id), eq(enrolments.courseId, c.id))))[0] : undefined;
    const p = user && enrolled ? await progressOf(app.db, user.id, o) : null;
    const [cert] = user ? await app.db.select().from(certificates).where(and(eq(certificates.userId, user.id), eq(certificates.courseId, c.id), eq(certificates.kind, "virtual"))) : [];
    const modules_: ModuleOutline[] = o.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, kind: l.kind as "video" | "text", minSeconds: l.minSeconds, done: p?.doneSet.has(l.id) })),
      questions: m.questions,
      quizSize: Math.min(m.quizSize, m.questions),
      passPercent: m.passPercent,
      passed: p?.passedSet.has(m.id),
    }));
    return {
      ...card(c, o),
      enrolled: !!enrolled,
      percent: p?.percent ?? 0,
      completed: p?.complete ?? false,
      modules_,
      certificate: cert ? await certificateView(app.db, cert) : null,
    };
  });

  app.post<{ Params: { slug: string } }>("/api/academy/courses/:slug/enrol", async (request) => {
    const user = requireUser(request);
    const c = await courseBySlug(app.db, request.params.slug, false);
    await app.db.insert(enrolments).values({ userId: user.id, courseId: c.id }).onConflictDoNothing();
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/academy/lessons/:id", async (request): Promise<LessonView> => {
    const user = requireUser(request);
    const { l, m, c } = await lessonContext(app.db, z.uuid().parse(request.params.id));
    await requireEnrolled(app.db, user.id, c.id);
    const o = await outline(app.db, c.id);
    const flat = o.flatMap((mm) => mm.lessons.map((ll) => ll.id));
    const i = flat.indexOf(l.id);
    const [prog] = await app.db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, l.id)));
    return {
      id: l.id,
      courseSlug: c.slug,
      moduleId: m.id,
      title: l.title,
      kind: l.kind as "video" | "text",
      youtubeId: l.youtubeId,
      body: l.body,
      minSeconds: l.minSeconds,
      seconds: prog?.seconds ?? 0,
      done: !!prog?.completedAt,
      prev: flat[i - 1] ?? null,
      next: flat[i + 1] ?? null,
      quizNext: (() => {
        const mod = o.find((mm) => mm.id === m.id)!;
        return mod.questions > 0 && mod.lessons[mod.lessons.length - 1]?.id === l.id;
      })(),
    };
  });

  // An open lesson reports in every 15 s. The server credits the real time since the last report, capped, so time
  // only builds up while the lesson is actually open; it is done once the time reaches the lesson's minimum.
  app.post<{ Params: { id: string } }>("/api/academy/lessons/:id/heartbeat", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const user = requireUser(request);
    const { l, c } = await lessonContext(app.db, z.uuid().parse(request.params.id));
    await requireEnrolled(app.db, user.id, c.id);
    return app.db.transaction(async (tx) => {
      await tx.insert(lessonProgress).values({ userId: user.id, lessonId: l.id }).onConflictDoNothing();
      const [p] = await tx
        .select()
        .from(lessonProgress)
        .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, l.id)))
        .for("update");
      const now = new Date();
      const credit = p!.lastBeatAt ? Math.min(HEARTBEAT.maxCreditSeconds, Math.max(0, Math.floor((now.getTime() - p!.lastBeatAt.getTime()) / 1000))) : 0;
      const seconds = p!.seconds + credit;
      const done = seconds >= l.minSeconds;
      await tx
        .update(lessonProgress)
        .set({ seconds, lastBeatAt: now, completedAt: p!.completedAt ?? (done ? now : null) })
        .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, l.id)));
      return { seconds, minSeconds: l.minSeconds, done: done || !!p!.completedAt };
    });
  });

  // Start a module quiz: every lesson in the module must be done; a wait after a failed try; a daily limit.
  app.post<{ Params: { id: string } }>("/api/academy/modules/:id/quiz", async (request): Promise<QuizAttemptView> => {
    const user = requireUser(request);
    const moduleId = z.uuid().parse(request.params.id);
    const [row] = await app.db
      .select({ m: courseModules, c: courses })
      .from(courseModules)
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(eq(courseModules.id, moduleId));
    if (!row || row.c.status !== "published") throw notFound("Quiz");
    await requireEnrolled(app.db, user.id, row.c.id);
    const o = (await outline(app.db, row.c.id)).find((mm) => mm.id === moduleId)!;
    const p = await progressOf(app.db, user.id, [o]);
    if (o.lessons.some((l) => !p.doneSet.has(l.id))) throw new AppError(422, "lessons_first", "Finish every lesson in this module first.");
    if (o.questions === 0) throw new AppError(422, "no_quiz", "This module has no quiz yet.");

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await app.db
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.userId, user.id), eq(quizAttempts.moduleId, moduleId), gte(quizAttempts.startedAt, since)))
      .orderBy(desc(quizAttempts.startedAt));
    const open = recent.find((a) => !a.submittedAt && Date.now() - a.startedAt.getTime() < 2 * 3600 * 1000);
    const lastFail = recent.find((a) => a.submittedAt && a.passed === false);
    if (!open) {
      if (lastFail && Date.now() - lastFail.submittedAt!.getTime() < QUIZ.retryAfterMinutes * 60_000)
        throw new AppError(429, "retry_later", `Go over the lessons again; you can retry ${QUIZ.retryAfterMinutes} minutes after your last try.`);
      if (recent.length >= QUIZ.maxAttemptsPerDay) throw new AppError(429, "daily_limit", "That's enough tries for today. Come back tomorrow.");
    }
    const bank = await app.db
      .select({ id: quizQuestions.id, prompt: quizQuestions.prompt, options: quizQuestions.options })
      .from(quizQuestions)
      .where(and(eq(quizQuestions.moduleId, moduleId), eq(quizQuestions.active, true)));
    let ids: string[];
    let attemptId: string;
    if (open) {
      ids = open.questionIds;
      attemptId = open.id;
    } else {
      // Draw this attempt's questions from the bank, in a random order.
      const pool = [...bank];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      }
      ids = pool.slice(0, Math.min(row.m.quizSize, pool.length)).map((q) => q.id);
      const [a] = await app.db.insert(quizAttempts).values({ userId: user.id, moduleId, questionIds: ids }).returning({ id: quizAttempts.id });
      attemptId = a!.id;
    }
    const byId = new Map(bank.map((q) => [q.id, q]));
    return {
      attemptId,
      moduleId,
      passPercent: row.m.passPercent,
      questions: ids.flatMap((id) => {
        const q = byId.get(id);
        return q ? [{ id: q.id, prompt: q.prompt, options: q.options }] : [];
      }),
    };
  });

  app.post<{ Params: { id: string } }>("/api/academy/attempts/:id/submit", async (request): Promise<QuizResult> => {
    const user = requireUser(request);
    const { answers } = answersBody.parse(request.body);
    return app.db.transaction(async (tx) => {
      const [a] = await tx
        .select()
        .from(quizAttempts)
        .where(and(eq(quizAttempts.id, z.uuid().parse(request.params.id)), eq(quizAttempts.userId, user.id)))
        .for("update");
      if (!a) throw notFound("Attempt");
      if (a.submittedAt) throw new AppError(409, "already_submitted", "You already handed this one in.");
      if (Date.now() - a.startedAt.getTime() > 2 * 3600 * 1000) throw new AppError(410, "expired", "This try ran out of time. Start the quiz again.");
      const qs = await tx.select().from(quizQuestions).where(inArray(quizQuestions.id, a.questionIds));
      const byId = new Map(qs.map((q) => [q.id, q]));
      const ordered = a.questionIds.map((id) => byId.get(id)!).filter(Boolean);
      const chosen = ordered.map((_, i) => answers[i] ?? null);
      const [m] = await tx.select().from(courseModules).where(eq(courseModules.id, a.moduleId));
      const s = scoreQuiz(
        chosen,
        ordered.map((q) => q.answer),
        m!.passPercent,
      );
      const now = new Date();
      await tx.update(quizAttempts).set({ answers: chosen, percent: s.percent, passed: s.passed, submittedAt: now }).where(eq(quizAttempts.id, a.id));
      // Finished the whole course?
      const o = await outline(tx, m!.courseId);
      const p = await progressOf(tx, user.id, o);
      if (p.complete)
        await tx
          .update(enrolments)
          .set({ completedAt: now })
          .where(and(eq(enrolments.userId, user.id), eq(enrolments.courseId, m!.courseId), isNull(enrolments.completedAt)));
      return {
        ...s,
        review: ordered.map((q, i) => ({ id: q.id, correct: q.answer, chosen: chosen[i] ?? null, explanation: q.explanation })),
        retryAt: s.passed ? null : new Date(now.getTime() + QUIZ.retryAfterMinutes * 60_000).toISOString(),
        courseComplete: p.complete,
      };
    });
  });

  // Claim the free virtual certificate once the course is complete. The reward (coins and XP) is paid once.
  app.post<{ Params: { slug: string } }>("/api/academy/courses/:slug/certificate", async (request): Promise<{ certificate: CertificateView; reward: { coins: number; xp: number } | null }> => {
    const user = requireUser(request);
    const { holderName } = holderBody.parse(request.body);
    const c = await courseBySlug(app.db, request.params.slug, false);
    await requireEnrolled(app.db, user.id, c.id);
    return app.db.transaction(async (tx) => {
      await lockProfile(tx, user.id);
      const [existing] = await tx.select().from(certificates).where(and(eq(certificates.userId, user.id), eq(certificates.courseId, c.id), eq(certificates.kind, "virtual")));
      if (existing) return { certificate: await certificateView(tx, existing), reward: null };
      const p = await progressOf(tx, user.id, await outline(tx, c.id));
      if (!p.complete) throw new AppError(422, "not_finished", "Finish every lesson and pass every quiz first.");
      let row: typeof certificates.$inferSelect | undefined;
      for (let i = 0; i < 5 && !row; i++) {
        try {
          [row] = await tx
            .insert(certificates)
            .values({ number: certificateNumber(new Date().getFullYear(), randomInt), userId: user.id, courseId: c.id, holderName, courseTitle: c.title, provider: c.provider, kind: "virtual" })
            .returning();
        } catch (err) {
          if (!isUniqueViolation(err, "certificates_number_uq")) throw err;
        }
      }
      if (!row) throw new AppError(503, "try_again", "Please try again.");
      let reward: { coins: number; xp: number } | null = null;
      if (c.rewardCoins > 0) {
        const posting = await postCoins(tx, user.id, c.rewardCoins, "course_reward", courseRewardRef(c.id));
        if (posting.applied) reward = { coins: c.rewardCoins, xp: c.rewardXp };
      } else reward = { coins: 0, xp: c.rewardXp };
      if (reward && c.rewardXp > 0) await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${c.rewardXp}` }).where(eq(profiles.userId, user.id));
      return { certificate: await certificateView(tx, row), reward };
    });
  });

  app.get("/api/academy/me", async (request): Promise<AcademyMe> => {
    const user = requireUser(request);
    const rows = await app.db.select({ c: courses, e: enrolments }).from(enrolments).innerJoin(courses, eq(courses.id, enrolments.courseId)).where(eq(enrolments.userId, user.id));
    const out: CourseCard[] = [];
    for (const { c, e } of rows) {
      const o = await outline(app.db, c.id);
      const p = await progressOf(app.db, user.id, o);
      out.push({ ...card(c, o), enrolled: true, percent: p.percent, completed: !!e.completedAt });
    }
    const certs = await app.db.select().from(certificates).where(eq(certificates.userId, user.id)).orderBy(desc(certificates.issuedAt));
    return { courses: out, certificates: await Promise.all(certs.map((r) => certificateView(app.db, r))) };
  });

  // Public verify page data: anyone with the number can check a certificate.
  app.get<{ Params: { number: string } }>("/api/certificates/:number", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request): Promise<CertificateView> => {
    const n = request.params.number.toUpperCase();
    if (!CERT_NUMBER_RE.test(n)) throw notFound("Certificate");
    const [row] = await app.db.select().from(certificates).where(eq(certificates.number, n));
    if (!row) throw notFound("Certificate");
    return certificateView(app.db, row);
  });

  // --- Admin: the course builder ---------------------------------------------

  async function adminCourse(db: Db, c: CourseRow): Promise<AdminCourse> {
    const mods = await db.select().from(courseModules).where(eq(courseModules.courseId, c.id)).orderBy(asc(courseModules.position));
    const ids = mods.map((m) => m.id);
    const ls = ids.length ? await db.select().from(lessons).where(inArray(lessons.moduleId, ids)).orderBy(asc(lessons.position)) : [];
    const qs = ids.length ? await db.select().from(quizQuestions).where(inArray(quizQuestions.moduleId, ids)) : [];
    const [learners] = await db.select({ n: count() }).from(enrolments).where(eq(enrolments.courseId, c.id));
    const [certified] = await db.select({ n: count() }).from(certificates).where(eq(certificates.courseId, c.id));
    const o = await outline(db, c.id);
    return {
      ...card(c, o),
      learners: learners?.n ?? 0,
      certified: certified?.n ?? 0,
      modules_: mods.map((m) => ({
        id: m.id,
        title: m.title,
        position: m.position,
        quizSize: m.quizSize,
        passPercent: m.passPercent,
        lessons: ls
          .filter((l) => l.moduleId === m.id)
          .map((l) => ({ id: l.id, title: l.title, kind: l.kind as "video" | "text", youtubeId: l.youtubeId, body: l.body, minSeconds: l.minSeconds, position: l.position })),
        questions: qs.filter((q) => q.moduleId === m.id).map((q) => ({ id: q.id, prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation, active: q.active })),
      })),
    };
  }
  const courseOf = async (id: string) => {
    const [c] = await app.db.select().from(courses).where(eq(courses.id, z.uuid().parse(id)));
    if (!c) throw notFound("Course");
    return c;
  };
  const moduleCourse = async (moduleId: string) => {
    const [row] = await app.db.select({ c: courses }).from(courseModules).innerJoin(courses, eq(courses.id, courseModules.courseId)).where(eq(courseModules.id, z.uuid().parse(moduleId)));
    if (!row) throw notFound("Module");
    return row.c;
  };
  /** Lessons and modules can only be removed while the course is a draft (learners' progress points at them). */
  const draftOnly = (c: CourseRow) => {
    if (c.status !== "draft") throw new AppError(409, "published", "Unpublish the course before removing parts of it, or hide a question instead.");
  };
  const touch = (id: string) => app.db.update(courses).set({ updatedAt: sql`now()` }).where(eq(courses.id, id));

  app.get("/api/admin/academy/courses", async (request): Promise<AdminCourse[]> => {
    requireRole(request, "admin");
    const rows = await app.db.select().from(courses).orderBy(desc(courses.updatedAt));
    return Promise.all(rows.map((c) => adminCourse(app.db, c)));
  });

  app.post("/api/admin/academy/courses", async (request): Promise<AdminCourse> => {
    const admin = requireRole(request, "admin");
    const body = courseBody.parse(request.body);
    try {
      const [c] = await app.db.insert(courses).values({ ...body, createdBy: admin.id }).returning();
      return adminCourse(app.db, c!);
    } catch (err) {
      if (isUniqueViolation(err, "courses_slug_uq")) throw new AppError(409, "slug_taken", "Another course already uses that web name.");
      throw err;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/admin/academy/courses/:id", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await courseOf(request.params.id);
    const body = coursePatch.parse(request.body);
    if (body.status === "published") {
      const o = await outline(app.db, c.id);
      if (!o.length || o.some((m) => !m.lessons.length)) throw new AppError(422, "incomplete", "Every module needs at least one lesson before you publish.");
    }
    const [u] = await app.db
      .update(courses)
      .set({ ...body, updatedAt: sql`now()` })
      .where(eq(courses.id, c.id))
      .returning();
    return adminCourse(app.db, u!);
  });

  app.post<{ Params: { id: string } }>("/api/admin/academy/courses/:id/modules", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await courseOf(request.params.id);
    const body = moduleBody.parse(request.body);
    const [last] = await app.db.select({ p: sql<number>`coalesce(max(${courseModules.position}), 0)::int` }).from(courseModules).where(eq(courseModules.courseId, c.id));
    await app.db.insert(courseModules).values({ ...body, courseId: c.id, position: (last?.p ?? 0) + 1 });
    await touch(c.id);
    return adminCourse(app.db, c);
  });

  app.patch<{ Params: { id: string } }>("/api/admin/academy/modules/:id", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await moduleCourse(request.params.id);
    await app.db.update(courseModules).set(moduleBody.partial().parse(request.body)).where(eq(courseModules.id, request.params.id));
    await touch(c.id);
    return adminCourse(app.db, c);
  });

  app.delete<{ Params: { id: string } }>("/api/admin/academy/modules/:id", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await moduleCourse(request.params.id);
    draftOnly(c);
    await app.db.delete(courseModules).where(eq(courseModules.id, request.params.id));
    await touch(c.id);
    return adminCourse(app.db, c);
  });

  app.post<{ Params: { id: string } }>("/api/admin/academy/modules/:id/lessons", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await moduleCourse(request.params.id);
    const l = lessonBody.parse(request.body);
    const [last] = await app.db.select({ p: sql<number>`coalesce(max(${lessons.position}), 0)::int` }).from(lessons).where(eq(lessons.moduleId, request.params.id));
    await app.db.insert(lessons).values({
      moduleId: request.params.id,
      position: (last?.p ?? 0) + 1,
      title: l.title,
      kind: l.kind,
      youtubeId: l.kind === "video" ? youtubeId(l.video) : null,
      body: l.body,
      minSeconds: l.minSeconds,
    });
    await touch(c.id);
    return adminCourse(app.db, c);
  });

  const lessonCourse = async (lessonId: string) => {
    const [row] = await app.db
      .select({ c: courses })
      .from(lessons)
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(eq(lessons.id, z.uuid().parse(lessonId)));
    if (!row) throw notFound("Lesson");
    return row.c;
  };
  app.put<{ Params: { id: string } }>("/api/admin/academy/lessons/:id", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await lessonCourse(request.params.id);
    const l = lessonBody.parse(request.body);
    await app.db
      .update(lessons)
      .set({ title: l.title, kind: l.kind, youtubeId: l.kind === "video" ? youtubeId(l.video) : null, body: l.body, minSeconds: l.minSeconds })
      .where(eq(lessons.id, request.params.id));
    await touch(c.id);
    return adminCourse(app.db, c);
  });
  app.delete<{ Params: { id: string } }>("/api/admin/academy/lessons/:id", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await lessonCourse(request.params.id);
    draftOnly(c);
    await app.db.delete(lessons).where(eq(lessons.id, request.params.id));
    await touch(c.id);
    return adminCourse(app.db, c);
  });

  app.post<{ Params: { id: string } }>("/api/admin/academy/modules/:id/questions", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await moduleCourse(request.params.id);
    await app.db.insert(quizQuestions).values({ ...questionBody.parse(request.body), moduleId: request.params.id });
    await touch(c.id);
    return adminCourse(app.db, c);
  });
  const questionCourse = async (questionId: string) => {
    const [row] = await app.db
      .select({ c: courses })
      .from(quizQuestions)
      .innerJoin(courseModules, eq(courseModules.id, quizQuestions.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(eq(quizQuestions.id, z.uuid().parse(questionId)));
    if (!row) throw notFound("Question");
    return row.c;
  };
  // Questions are edited in place; on a published course hide a question (active: false) rather than remove it.
  app.put<{ Params: { id: string } }>("/api/admin/academy/questions/:id", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await questionCourse(request.params.id);
    await app.db.update(quizQuestions).set(questionBody.parse(request.body)).where(eq(quizQuestions.id, request.params.id));
    await touch(c.id);
    return adminCourse(app.db, c);
  });
  app.delete<{ Params: { id: string } }>("/api/admin/academy/questions/:id", async (request): Promise<AdminCourse> => {
    requireRole(request, "admin");
    const c = await questionCourse(request.params.id);
    draftOnly(c);
    await app.db.delete(quizQuestions).where(eq(quizQuestions.id, request.params.id));
    await touch(c.id);
    return adminCourse(app.db, c);
  });

  app.get<{ Params: { id: string } }>("/api/admin/academy/courses/:id/learners", async (request): Promise<LearnerRow[]> => {
    requireRole(request, "admin");
    const c = await courseOf(request.params.id);
    const o = await outline(app.db, c.id);
    const rows = await app.db
      .select({ e: enrolments, nickname: profiles.nickname })
      .from(enrolments)
      .innerJoin(profiles, eq(profiles.userId, enrolments.userId))
      .where(eq(enrolments.courseId, c.id))
      .orderBy(desc(enrolments.enrolledAt))
      .limit(500);
    const out: LearnerRow[] = [];
    for (const { e, nickname } of rows) {
      const p = await progressOf(app.db, e.userId, o);
      const [cert] = await app.db.select({ n: certificates.number }).from(certificates).where(and(eq(certificates.userId, e.userId), eq(certificates.courseId, c.id)));
      out.push({ nickname, enrolledAt: e.enrolledAt.toISOString(), percent: p.percent, quizzesPassed: p.passedSet.size, completedAt: e.completedAt?.toISOString() ?? null, certificate: cert?.n ?? null });
    }
    return out;
  });

  app.post<{ Params: { number: string } }>("/api/admin/certificates/:number/revoke", async (request) => {
    const admin = requireRole(request, "admin");
    const { reason } = z.object({ reason: z.string().trim().min(5).max(300) }).parse(request.body);
    const [row] = await app.db.select().from(certificates).where(eq(certificates.number, request.params.number.toUpperCase()));
    if (!row) throw notFound("Certificate");
    await app.db.insert(certificateRevocations).values({ certificateId: row.id, reason, actorId: admin.id }).onConflictDoNothing();
    return certificateView(app.db, row);
  });
}
