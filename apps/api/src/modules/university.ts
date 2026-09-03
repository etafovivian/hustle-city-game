// Lagoon City University (see @hc/shared university.ts): enrol, attend lectures at the campus (server-timed, a few
// a day while it's open), sit each course's exam, graduate. Lectures and exams in progress are kept in memory.

import { profiles, uniCourses, uniEnrolments, uniLectures } from "@hc/db";
import {
  COURSE_BY_KEY,
  EXAM,
  GRADUATE,
  LECTURE,
  LECTURES_PER_COURSE,
  PROGRAMME_BY_KEY,
  PROGRAMME_SKILL,
  SKILL_POINTS,
  UNIVERSITY,
  VENUES_BY_KEY,
  clockHour,
  dayKey,
  fillNeeds,
  isOpenAt,
  lagosHourOf,
  venueHours,
  type UniExam,
  type UniView,
} from "@hc/shared";
import { randomInt } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { lockProfile, type Tx } from "../lib/db.js";
import { AppError, notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";
import { loadNeeds, saveNeeds } from "./game/needs.js";
import { placeOf } from "./presence.js";
import { addSkill } from "./game/skills.js";

/** The clock lectures run on (tests move it). */
export const uniClock = { now: () => Date.now() };

/** You must be at the campus (a branch of it counts). */
const atCampus = (userId: string) => placeOf(userId)?.split("@")[0] === UNIVERSITY.venue;

export async function universityRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date(uniClock.now())));
  const lectures = new Map<string, { course: string; index: number; endsAt: number }>();
  const exams = new Map<string, { course: string; picks: number[] }>();
  const campus = VENUES_BY_KEY.get(UNIVERSITY.venue)!;

  const current = async (tx: Tx, userId: string) => {
    const [row] = await tx.select().from(uniEnrolments).where(and(eq(uniEnrolments.userId, userId), isNull(uniEnrolments.graduatedAt)));
    return row ?? null;
  };
  const lecturesToday = async (tx: Tx, userId: string, day: string) => {
    const [{ n }] = (await tx.select({ n: count() }).from(uniLectures).where(and(eq(uniLectures.userId, userId), eq(uniLectures.day, day)))) as [{ n: number }];
    return Number(n);
  };
  const view = async (tx: Tx, userId: string, now: Date): Promise<UniView> => {
    const enrol = await tx.select().from(uniEnrolments).where(eq(uniEnrolments.userId, userId));
    const now0 = enrol.find((e) => !e.graduatedAt);
    const programme = now0 ? PROGRAMME_BY_KEY.get(now0.programme) : undefined;
    const rows = programme ? await tx.select().from(uniCourses).where(eq(uniCourses.userId, userId)) : [];
    const byCourse = new Map(rows.map((r) => [r.course, r]));
    const live = lectures.get(userId);
    return {
      programme: programme?.key ?? null,
      courses: (programme?.courses ?? []).map((co) => {
        const r = byCourse.get(co.key);
        return { key: co.key, code: co.code, title: co.title, lectures: r?.lectures ?? 0, passed: !!r?.passedAt, attempts: r?.attempts ?? 0 };
      }),
      lecturesToday: await lecturesToday(tx, userId, dayKey(now, tz)),
      degrees: enrol
        .filter((e) => e.graduatedAt)
        .map((e) => ({ programme: e.programme, degree: PROGRAMME_BY_KEY.get(e.programme)?.degree ?? e.programme, at: e.graduatedAt!.toISOString() })),
      lecture: live ? { course: live.course, index: live.index, endsAt: new Date(live.endsAt).toISOString() } : null,
    };
  };
  /** The course, checked to be in your current programme. */
  const myCourse = async (tx: Tx, userId: string, key: string) => {
    const enrol = await current(tx, userId);
    const course = COURSE_BY_KEY.get(key);
    if (!enrol || !course || course.programme !== enrol.programme) throw notFound("Course");
    const [row] = await tx.select().from(uniCourses).where(and(eq(uniCourses.userId, userId), eq(uniCourses.course, key)));
    return { enrol, course, row: row ?? null };
  };

  app.get("/api/uni", async (request) => {
    const user = requireUser(request);
    return inTx((tx, now) => view(tx, user.id, now));
  });

  app.post("/api/uni/enrol", async (request) => {
    const user = requireUser(request);
    const { programme } = z.object({ programme: z.string().max(40) }).parse(request.body);
    const p = PROGRAMME_BY_KEY.get(programme);
    if (!p) throw notFound("Programme");
    if (!atCampus(user.id)) throw new AppError(409, "not_here", `Go to ${UNIVERSITY.name} to enrol.`);
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      if (await current(tx, user.id)) throw new AppError(409, "enrolled", "Finish your current programme first.");
      const [done] = await tx.select().from(uniEnrolments).where(and(eq(uniEnrolments.userId, user.id), eq(uniEnrolments.programme, p.key)));
      if (done) throw new AppError(409, "graduated", `You already have a ${p.degree}.`);
      await postCoins(tx, user.id, -UNIVERSITY.fees, "university_fees", `uni:fees:${p.key}`);
      await tx.insert(uniEnrolments).values({ userId: user.id, programme: p.key, enrolledAt: now });
      return view(tx, user.id, now);
    });
  });

  // A lecture: start it at the campus, stay for its time, then finish it.
  app.post("/api/uni/lectures/start", async (request) => {
    const user = requireUser(request);
    const { course: key } = z.object({ course: z.string().max(20) }).parse(request.body);
    if (!atCampus(user.id)) throw new AppError(409, "not_here", `Lectures are at ${UNIVERSITY.name}. Go there first.`);
    return inTx(async (tx, now) => {
      if (!isOpenAt(campus, lagosHourOf(now))) throw new AppError(409, "closed", `Lectures run from ${clockHour(venueHours(campus)![0])} to ${clockHour(venueHours(campus)![1])}.`);
      const { row } = await myCourse(tx, user.id, key);
      if ((row?.lectures ?? 0) >= LECTURES_PER_COURSE) throw new AppError(409, "done", "You've attended every lecture for this course. Sit the exam.");
      if ((await lecturesToday(tx, user.id, dayKey(now, tz))) >= LECTURE.perDay) throw new AppError(409, "enough_today", `That's ${LECTURE.perDay} lectures today. Come back tomorrow.`);
      const index = row?.lectures ?? 0;
      lectures.set(user.id, { course: key, index, endsAt: now.getTime() + LECTURE.seconds * 1000 });
      return view(tx, user.id, now);
    });
  });

  app.post("/api/uni/lectures/finish", async (request) => {
    const user = requireUser(request);
    const live = lectures.get(user.id);
    if (!live) throw new AppError(409, "no_lecture", "You're not in a lecture.");
    if (uniClock.now() < live.endsAt - 1500) throw new AppError(409, "too_soon", "The lecture isn't over yet.");
    lectures.delete(user.id);
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const { row } = await myCourse(tx, user.id, live.course);
      if ((row?.lectures ?? 0) !== live.index) return view(tx, user.id, now);
      await tx
        .insert(uniCourses)
        .values({ userId: user.id, course: live.course, lectures: 1, updatedAt: now })
        .onConflictDoUpdate({ target: [uniCourses.userId, uniCourses.course], set: { lectures: sql`${uniCourses.lectures} + 1`, updatedAt: now } });
      await tx.insert(uniLectures).values({ userId: user.id, course: live.course, day: dayKey(now, tz) });
      await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${LECTURE.xp}` }).where(eq(profiles.userId, user.id));
      const course = COURSE_BY_KEY.get(live.course);
      await addSkill(tx, user.id, course ? PROGRAMME_SKILL[course.programme] : undefined, SKILL_POINTS.lecture);
      const { needs } = await loadNeeds(tx, user.id, now);
      await saveNeeds(tx, user.id, fillNeeds(needs, ["brain"], 20), now);
      return view(tx, user.id, now);
    });
  });

  // Exams: four of the course's questions (answers stay on the server); a resit costs a small fee.
  app.post<{ Params: { course: string } }>("/api/uni/exams/:course", async (request): Promise<UniExam> => {
    const user = requireUser(request);
    if (!atCampus(user.id)) throw new AppError(409, "not_here", `Exams are at ${UNIVERSITY.name}. Go there first.`);
    return inTx(async (tx) => {
      const { course, row } = await myCourse(tx, user.id, request.params.course);
      if (row?.passedAt) throw new AppError(409, "passed", "You passed this course already.");
      if ((row?.lectures ?? 0) < LECTURES_PER_COURSE) throw new AppError(409, "not_ready", `Attend all ${LECTURES_PER_COURSE} lectures first.`);
      const fee = (row?.attempts ?? 0) > 0 ? EXAM.resitFee : 0;
      if (fee) {
        await lockProfile(tx, user.id);
        await postCoins(tx, user.id, -fee, "university_fees", `uni:resit:${course.key}:${row!.attempts}`);
      }
      const order = course.questions.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      const picks = order.slice(0, EXAM.questions);
      exams.set(user.id, { course: course.key, picks });
      return { course: course.key, fee, questions: picks.map((i) => ({ q: course.questions[i]!.q, options: [...course.questions[i]!.options] })) };
    });
  });

  app.post<{ Params: { course: string } }>("/api/uni/exams/:course/submit", async (request) => {
    const user = requireUser(request);
    const { answers } = z.object({ answers: z.array(z.number().int().min(0).max(3)).length(EXAM.questions) }).parse(request.body);
    const exam = exams.get(user.id);
    if (!exam || exam.course !== request.params.course) throw new AppError(409, "no_exam", "Start the exam first.");
    exams.delete(user.id);
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const { course, enrol } = await myCourse(tx, user.id, exam.course);
      const score = exam.picks.filter((qi, i) => course.questions[qi]!.answer === answers[i]).length;
      const passed = score >= EXAM.pass;
      await tx
        .insert(uniCourses)
        .values({ userId: user.id, course: course.key, attempts: 1, passedAt: passed ? now : null, updatedAt: now })
        .onConflictDoUpdate({ target: [uniCourses.userId, uniCourses.course], set: { attempts: sql`${uniCourses.attempts} + 1`, ...(passed ? { passedAt: now } : {}), updatedAt: now } });
      // Every course passed: convocation.
      let graduated: string | null = null;
      const programme = PROGRAMME_BY_KEY.get(enrol.programme)!;
      if (passed) {
        const rows = await tx.select().from(uniCourses).where(eq(uniCourses.userId, user.id));
        const done = new Set(rows.filter((r) => r.passedAt).map((r) => r.course));
        if (programme.courses.every((co) => done.has(co.key))) {
          await tx.update(uniEnrolments).set({ graduatedAt: now }).where(and(eq(uniEnrolments.userId, user.id), eq(uniEnrolments.programme, programme.key)));
          await postCoins(tx, user.id, GRADUATE.coins, "game_reward", `uni:graduate:${programme.key}`);
          await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${GRADUATE.xp}` }).where(eq(profiles.userId, user.id));
          graduated = programme.degree;
        }
      }
      return {
        score,
        passed,
        graduated,
        // After the exam you see which were right.
        review: exam.picks.map((qi, i) => ({ q: course.questions[qi]!.q, yours: answers[i]!, answer: course.questions[qi]!.answer, options: course.questions[qi]!.options })),
        uni: await view(tx, user.id, now),
      };
    });
  });
}

/** Graduates earn more in every job. */
export async function isGraduate(tx: Tx, userId: string) {
  const rows = await tx.select({ at: uniEnrolments.graduatedAt }).from(uniEnrolments).where(eq(uniEnrolments.userId, userId));
  return rows.some((r) => r.at);
}
export const graduatePay = (pay: number, graduate: boolean) => (graduate ? Math.round(pay * (1 + GRADUATE.payBoost)) : pay);
