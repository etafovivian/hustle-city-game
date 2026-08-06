// Hustle Academy step A: building a course, the learner's journey, honest progress, quizzes and certificates.
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer, type Player } from "./test/harness.js";

let app: Awaited<ReturnType<typeof testServer>>;
beforeAll(async () => {
  await prepareDatabase();
  app = await testServer();
});
afterAll(async () => {
  await app?.close();
});
beforeEach(resetDatabase);

const sql = () => postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
async function admin() {
  const p = await registerPlayer(app);
  const db = sql();
  await db`update users set roles = array['player','admin'] where id = ${p.id}`;
  await db.end();
  return p;
}

/** A published course: one module with a video lesson (needs 30 s) and a text lesson (no minimum), 3 questions. */
async function buildCourse(a: Player) {
  let course = (await a.call("POST", "/api/admin/academy/courses", { slug: "web-basics", title: "Web Basics", category: "software", summary: "HTML and CSS from zero." })).json();
  course = (await a.call("POST", `/api/admin/academy/courses/${course.id}/modules`, { title: "Your first page", quizSize: 2, passPercent: 50 })).json();
  const m = course.modules_[0].id;
  await a.call("POST", `/api/admin/academy/modules/${m}/lessons`, { title: "What is HTML?", kind: "video", video: "https://youtu.be/dQw4w9WgXcQ", minSeconds: 30 });
  await a.call("POST", `/api/admin/academy/modules/${m}/lessons`, { title: "Tags", kind: "text", body: "Tags wrap content: <p> for a paragraph, <h1> for a heading.", minSeconds: 0 });
  for (const [prompt, answer] of [
    ["Which tag makes a paragraph?", 0],
    ["Which tag is the main heading?", 1],
    ["HTML stands for?", 2],
  ] as const)
    await a.call("POST", `/api/admin/academy/modules/${m}/questions`, { prompt, options: ["<p>", "<h1>", "HyperText Markup Language"], answer, explanation: "See the lesson." });
  course = (await a.call("PATCH", `/api/admin/academy/courses/${course.id}`, { status: "published" })).json();
  return course;
}

describe("Hustle Academy", () => {
  it("only admins build courses; drafts are hidden; video links must be YouTube", async () => {
    const a = await admin();
    const learner = await registerPlayer(app);
    expect((await learner.call("POST", "/api/admin/academy/courses", { slug: "x", title: "Nope", category: "software" })).statusCode).toBe(403);
    const draft = (await a.call("POST", "/api/admin/academy/courses", { slug: "draft-one", title: "Draft", category: "cloud" })).json();
    expect((await app.inject({ method: "GET", url: "/api/academy/courses" })).json()).toHaveLength(0);
    expect((await app.inject({ method: "GET", url: "/api/academy/courses/draft-one" })).statusCode).toBe(404);
    const withModule = (await a.call("POST", `/api/admin/academy/courses/${draft.id}/modules`, { title: "M1" })).json();
    const bad = await a.call("POST", `/api/admin/academy/modules/${withModule.modules_[0].id}/lessons`, { title: "Video", kind: "video", video: "https://vimeo.com/1" });
    expect(bad.statusCode).toBe(400);
    // Can't publish a module without lessons
    expect((await a.call("PATCH", `/api/admin/academy/courses/${draft.id}`, { status: "published" })).statusCode).toBe(422);
  });

  it("takes a learner from enrolling to a verified certificate, with server-timed lessons", async () => {
    const a = await admin();
    const course = await buildCourse(a);
    const learner = await registerPlayer(app);
    const [video, text] = course.modules_[0].lessons;
    const m = course.modules_[0].id;

    // Must enrol before seeing lessons
    expect((await learner.call("GET", `/api/academy/lessons/${video.id}`)).statusCode).toBe(403);
    await learner.call("POST", "/api/academy/courses/web-basics/enrol");
    const lesson = (await learner.call("GET", `/api/academy/lessons/${video.id}`)).json();
    expect(lesson).toMatchObject({ youtubeId: "dQw4w9WgXcQ", done: false, next: text.id });

    // Quiz is locked until the lessons are done
    expect((await learner.call("POST", `/api/academy/modules/${m}/quiz`)).statusCode).toBe(422);

    // Time only counts between heartbeats, capped at 20 s each: a tab left closed for 5 minutes gets 20 s, not 300.
    const beat = async (id: string) => (await learner.call("POST", `/api/academy/lessons/${id}/heartbeat`)).json();
    expect(await beat(video.id)).toMatchObject({ seconds: 0, done: false });
    const db = sql();
    await db`update lesson_progress set last_beat_at = now() - interval '5 minutes' where lesson_id = ${video.id}`;
    expect(await beat(video.id)).toMatchObject({ seconds: 20, done: false });
    await db`update lesson_progress set last_beat_at = now() - interval '12 seconds' where lesson_id = ${video.id}`;
    expect(await beat(video.id)).toMatchObject({ seconds: 32, done: true });
    expect(await beat(text.id)).toMatchObject({ done: true });

    // Quiz: answers stay on the server
    const quiz = (await learner.call("POST", `/api/academy/modules/${m}/quiz`)).json();
    expect(quiz.questions).toHaveLength(2);
    expect(JSON.stringify(quiz)).not.toContain('"answer"');
    const rows = await db`select id, answer from quiz_questions`;
    const right = new Map(rows.map((r) => [r.id, r.answer]));
    // Fail first: wait before retrying
    const fail = (await learner.call("POST", `/api/academy/attempts/${quiz.attemptId}/submit`, { answers: quiz.questions.map((q: { id: string }) => (right.get(q.id) + 1) % 3) })).json();
    expect(fail).toMatchObject({ passed: false, percent: 0, courseComplete: false });
    expect(fail.review[0].correct).toBe(right.get(quiz.questions[0].id));
    expect((await learner.call("POST", `/api/academy/attempts/${quiz.attemptId}/submit`, { answers: [0, 0] })).statusCode).toBe(409);
    expect((await learner.call("POST", `/api/academy/modules/${m}/quiz`)).statusCode).toBe(429);
    await db`update quiz_attempts set submitted_at = now() - interval '11 minutes'`;
    const again = (await learner.call("POST", `/api/academy/modules/${m}/quiz`)).json();
    const pass = (await learner.call("POST", `/api/academy/attempts/${again.attemptId}/submit`, { answers: again.questions.map((q: { id: string }) => right.get(q.id)) })).json();
    expect(pass).toMatchObject({ passed: true, percent: 100, courseComplete: true });

    // Certificate: once, with a reward paid once
    const balance = async () => Number((await db`select coin_balance from profiles where user_id = ${learner.id}`)[0]!.coin_balance);
    const before = await balance();
    const claim = (await learner.call("POST", "/api/academy/courses/web-basics/certificate", { holderName: "Adaeze Okafor" })).json();
    expect(claim.certificate).toMatchObject({ holderName: "Adaeze Okafor", courseTitle: "Web Basics", issuer: "Lampnet Institute of Technology", partner: null, revoked: false });
    expect(claim.reward).toEqual({ coins: 500, xp: 100 });
    expect(await balance()).toBe(before + 500);
    const second = (await learner.call("POST", "/api/academy/courses/web-basics/certificate", { holderName: "Someone Else" })).json();
    expect(second).toMatchObject({ certificate: { number: claim.certificate.number, holderName: "Adaeze Okafor" }, reward: null });

    // Anyone can verify; certificates can't be edited, only revoked
    const verify = await app.inject({ method: "GET", url: `/api/certificates/${claim.certificate.number}` });
    expect(verify.json()).toMatchObject({ holderName: "Adaeze Okafor", revoked: false });
    await expect(db`update certificates set holder_name = 'Forged'`).rejects.toThrow(/append-only/);
    await a.call("POST", `/api/admin/certificates/${claim.certificate.number}/revoke`, { reason: "Test revocation" });
    expect((await app.inject({ method: "GET", url: `/api/certificates/${claim.certificate.number}` })).json()).toMatchObject({ revoked: true, revokedReason: "Test revocation" });
    expect((await app.inject({ method: "GET", url: "/api/certificates/LIT-26-NOPE00" })).statusCode).toBe(404);

    // Admin sees the learner; published courses can't lose lessons
    expect((await a.call("GET", `/api/admin/academy/courses/${course.id}/learners`)).json()[0]).toMatchObject({ percent: 100, certificate: claim.certificate.number });
    expect((await a.call("DELETE", `/api/admin/academy/lessons/${video.id}`)).statusCode).toBe(409);
    await db.end();
  });

  it("won't issue a certificate before the course is finished", async () => {
    const a = await admin();
    await buildCourse(a);
    const learner = await registerPlayer(app);
    await learner.call("POST", "/api/academy/courses/web-basics/enrol");
    expect((await learner.call("POST", "/api/academy/courses/web-basics/certificate", { holderName: "Too Early" })).statusCode).toBe(422);
  });
});
