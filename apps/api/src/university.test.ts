// Lagoon City University: enrol at the campus, attend timed lectures, pass exams, graduate, earn more.
import postgres from "postgres";
import { COURSE_BY_KEY, EXAM, GRADUATE, LECTURE, PROGRAMME_BY_KEY, UNIVERSITY } from "@hc/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { uniClock } from "./modules/university.js";
import { TEST_DATABASE_URL, prepareDatabase, registerPlayer, resetDatabase, testServer, type Player } from "./test/harness.js";

let app: Awaited<ReturnType<typeof testServer>>;
beforeAll(async () => {
  await prepareDatabase();
  app = await testServer();
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  await resetDatabase();
});
afterEach(() => {
  uniClock.now = () => Date.now();
});
async function rich(p: Player, coins = 1_000_000) {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await sql`update profiles set coin_balance = ${coins} where user_id = ${p.id}`;
  await sql.end();
}
/** 10am Lagos (UTC+1) on a weekday, then each lecture moves the clock on. */
let t = Date.UTC(2026, 9, 14, 9, 0, 0);
const atCampus = (p: Player) => p.call("POST", "/api/presence", { x: 100, y: 100, place: UNIVERSITY.venue });

async function attend(p: Player, course: string) {
  expect((await p.call("POST", "/api/uni/lectures/start", { course })).statusCode).toBe(200);
  t += (LECTURE.seconds + 1) * 1000;
  return p.call("POST", "/api/uni/lectures/finish");
}
async function pass(p: Player, course: string) {
  const exam = (await p.call("POST", `/api/uni/exams/${course}`)).json();
  const bank = COURSE_BY_KEY.get(course)!.questions;
  const answers = exam.questions.map((q: { q: string }) => bank.find((b) => b.q === q.q)!.answer);
  return (await p.call("POST", `/api/uni/exams/${course}/submit`, { answers })).json();
}

describe("university", () => {
  it("enrols only at the campus, times lectures, caps them per day and checks exams", async () => {
    uniClock.now = () => t;
    const p = await registerPlayer(app, "student_a");
    await rich(p);
    expect((await p.call("POST", "/api/uni/enrol", { programme: "computer_science" })).statusCode).toBe(409); // not there
    await atCampus(p);
    const v = (await p.call("POST", "/api/uni/enrol", { programme: "computer_science" })).json();
    expect(v).toMatchObject({ programme: "computer_science", courses: expect.arrayContaining([expect.objectContaining({ key: "csc101", lectures: 0 })]) });
    expect((await p.call("POST", "/api/uni/exams/csc101")).statusCode).toBe(409); // lectures first
    // A lecture can't be finished early.
    await p.call("POST", "/api/uni/lectures/start", { course: "csc101" });
    expect((await p.call("POST", "/api/uni/lectures/finish")).statusCode).toBe(409);
    t += (LECTURE.seconds + 1) * 1000;
    expect((await p.call("POST", "/api/uni/lectures/finish")).json().courses[0].lectures).toBe(1);
    await attend(p, "csc101");
    await attend(p, "csc101");
    // Three a day.
    expect((await p.call("POST", "/api/uni/lectures/start", { course: "csc102" })).statusCode).toBe(409);
    // A wrong exam fails; the resit costs a fee.
    const exam = (await p.call("POST", "/api/uni/exams/csc101")).json();
    expect(exam.questions).toHaveLength(EXAM.questions);
    expect(exam.questions[0]).not.toHaveProperty("answer");
    const bank = COURSE_BY_KEY.get("csc101")!.questions;
    const wrong = exam.questions.map((q: { q: string }) => (bank.find((b) => b.q === q.q)!.answer + 1) % 4);
    expect((await p.call("POST", "/api/uni/exams/csc101/submit", { answers: wrong })).json()).toMatchObject({ passed: false, score: 0 });
    const resit = await pass(p, "csc101");
    expect(resit).toMatchObject({ passed: true, graduated: null });
  });

  it("graduates after every course and pays graduates more", async () => {
    uniClock.now = () => t;
    const p = await registerPlayer(app, "student_b");
    await rich(p);
    await atCampus(p);
    await p.call("POST", "/api/uni/enrol", { programme: "law" });
    const courses = PROGRAMME_BY_KEY.get("law")!.courses;
    let last: { graduated: string | null; uni: { degrees: unknown[] } } | null = null;
    for (const [i, co] of courses.entries()) {
      // Three lectures a day: the next day for each course.
      t += 24 * 60 * 60 * 1000 * (i === 0 ? 0 : 1);
      for (let k = 0; k < 3; k++) await attend(p, co.key);
      last = await pass(p, co.key);
    }
    expect(last).toMatchObject({ graduated: "LLB Law", uni: { programme: null, degrees: [expect.objectContaining({ programme: "law" })] } });
    const me = (await p.call("GET", "/api/me")).json();
    expect(me.coins).toBe(1_000_000 - UNIVERSITY.fees + GRADUATE.coins);
  });
});
