// Lagoon City University, inside the campus card: pick a programme and enrol, attend lectures (you sit in the hall
// while the lecturer talks; the note is what the exam asks about), sit each course's exam, graduate.
import { COURSE_BY_KEY, EXAM, GRADUATE, LECTURE, LECTURES_PER_COURSE, PROGRAMMES, PROGRAMME_BY_KEY, UNIVERSITY, type UniExam, type UniView } from "@hc/shared";
import { BookOpen, CheckCircle2, GraduationCap, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";

interface ExamResult {
  score: number;
  passed: boolean;
  graduated: string | null;
  review: { q: string; yours: number; answer: number; options: string[] }[];
  uni: UniView;
}

export function UniversityPanel({ notify, onChanged, onSeated, open }: { notify: (m: string) => void; onChanged: () => void; onSeated: (seated: boolean) => void; open: boolean }) {
  const [uni, setUni] = useState<UniView | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);
  const [exam, setExam] = useState<UniExam | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    api<UniView>("GET", "/api/uni")
      .then(setUni)
      .catch(() => undefined);
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // The lecture in progress: count down, then finish it on the server.
  const lecture = uni?.lecture ?? null;
  useEffect(() => {
    onSeated(!!lecture || !!exam);
    if (!lecture) return;
    const end = new Date(lecture.endsAt).getTime();
    let done = false;
    const tick = () => {
      const remain = Math.max(0, (end - Date.now()) / 1000);
      setLeft(remain);
      if (remain > 0 || done) return;
      done = true;
      void api<UniView>("POST", "/api/uni/lectures/finish")
        .then((v) => {
          setUni(v);
          onChanged();
          notify(`Lecture done: +${LECTURE.xp} XP, +Brain`);
        })
        .catch((e: Error) => notify(e.message));
    };
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [lecture?.endsAt, !!exam]);

  if (!uni) return <p className="small muted">Checking your student file…</p>;
  const programme = uni.programme ? PROGRAMME_BY_KEY.get(uni.programme) : undefined;

  if (result)
    return (
      <div className="uni-box">
        <strong className="row" style={{ gap: 6 }}>
          {result.graduated ? <GraduationCap size={18} aria-hidden="true" /> : <PenLine size={16} aria-hidden="true" />}
          {result.graduated ? "Convocation!" : result.passed ? "You passed!" : "Not this time"}
        </strong>
        {result.graduated && (
          <p className="small">
            🎓 You graduated with a <b>{result.graduated}</b>. +{formatCoins(GRADUATE.coins)} coins and +{GRADUATE.xp} XP, and every job now pays you {Math.round(GRADUATE.payBoost * 100)}% more.
          </p>
        )}
        <p className="small">
          Score: {result.score} of {result.review.length}
          {result.passed ? "" : ` (you need ${EXAM.pass}). Resits cost ${formatCoins(EXAM.resitFee)} coins.`}
        </p>
        <ul className="uni-review">
          {result.review.map((r) => (
            <li key={r.q} className={r.yours === r.answer ? "ok" : "bad"}>
              <span className="small">{r.q}</span>
              <span className="tiny">
                {r.yours === r.answer ? "✓" : "✗"} {r.options[r.answer]}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn go" onClick={() => setResult(null)}>
          Back to my courses
        </button>
      </div>
    );

  if (exam) {
    const course = COURSE_BY_KEY.get(exam.course)!;
    return (
      <form
        className="uni-box"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const r = await api<ExamResult>("POST", `/api/uni/exams/${exam.course}/submit`, { answers });
            setExam(null);
            setUni(r.uni);
            setResult(r);
            onChanged();
          });
        }}
      >
        <strong>
          📝 {course.code} exam · {course.title}
        </strong>
        <span className="tiny muted">Answer all {EXAM.questions}; {EXAM.pass} right to pass.</span>
        {exam.questions.map((q, i) => (
          <fieldset key={q.q} className="uni-q">
            <legend className="small">
              {i + 1}. {q.q}
            </legend>
            {q.options.map((o, k) => (
              <label key={o} className="small row" style={{ gap: 8 }}>
                <input type="radio" name={`q${i}`} checked={answers[i] === k} onChange={() => setAnswers((a) => Object.assign([...a], { [i]: k }))} /> {o}
              </label>
            ))}
          </fieldset>
        ))}
        <button type="submit" className="btn go" disabled={busy || exam.questions.some((_, i) => answers[i] === undefined)}>
          Submit my paper
        </button>
      </form>
    );
  }

  if (lecture) {
    const course = COURSE_BY_KEY.get(lecture.course)!;
    return (
      <div className="uni-box">
        <strong className="row" style={{ gap: 6 }}>
          <BookOpen size={16} aria-hidden="true" /> {course.code}: lecture {lecture.index + 1} of {LECTURES_PER_COURSE}
        </strong>
        <p className="uni-note">{course.notes[lecture.index]}</p>
        <span className="act-progress" role="progressbar" aria-valuemin={0} aria-valuemax={LECTURE.seconds} aria-valuenow={Math.round(LECTURE.seconds - left)}>
          <span style={{ width: `${(100 * (LECTURE.seconds - left)) / LECTURE.seconds}%` }} />
        </span>
        <span className="tiny muted">{left > 0 ? `${Math.ceil(left)}s left. Take note: the exam asks about this.` : "Wrapping up…"}</span>
      </div>
    );
  }

  if (!programme)
    return (
      <div className="uni-box">
        <strong className="row" style={{ gap: 6 }}>
          <GraduationCap size={18} aria-hidden="true" /> Admissions
        </strong>
        {uni.degrees.length > 0 && <p className="small">🎓 You hold: {uni.degrees.map((d) => d.degree).join(", ")}. Go for another?</p>}
        <span className="tiny muted">
          School fees {formatCoins(UNIVERSITY.fees)} coins, once. Four courses, {LECTURES_PER_COURSE} lectures each ({LECTURE.perDay} a day, {LECTURE.seconds}s each, 8am–6pm), then an exam per course. Graduates earn {Math.round(GRADUATE.payBoost * 100)}% more in every job.
        </span>
        <ul className="uni-programmes">
          {PROGRAMMES.filter((p) => !uni.degrees.some((d) => d.programme === p.key)).map((p) => (
            <li key={p.key}>
              <button type="button" className={`uni-prog ${pick === p.key ? "on" : ""}`} onClick={() => setPick(p.key)} aria-pressed={pick === p.key}>
                <span className="uni-prog-icon" aria-hidden="true">
                  {p.icon}
                </span>
                <span className="stack" style={{ gap: 2 }}>
                  <strong className="small">{p.degree}</strong>
                  <span className="tiny muted">
                    {p.faculty}. {p.blurb}
                  </span>
                  {pick === p.key && <span className="tiny">{p.courses.map((co) => `${co.code} ${co.title}`).join(" · ")}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn go"
          disabled={!pick || busy || !open}
          onClick={() =>
            void run(async () => {
              setUni(await api<UniView>("POST", "/api/uni/enrol", { programme: pick }));
              onChanged();
              notify(`Welcome to ${UNIVERSITY.name}! You're now a ${PROGRAMME_BY_KEY.get(pick!)!.degree} student.`);
            })
          }
        >
          {open ? `Pay fees and enrol (${formatCoins(UNIVERSITY.fees)})` : "Admissions open 8am"}
        </button>
      </div>
    );

  const passed = uni.courses.filter((co) => co.passed).length;
  return (
    <div className="uni-box">
      <strong className="row" style={{ gap: 6 }}>
        {programme.icon} {programme.degree}
      </strong>
      <span className="tiny muted">
        {passed} of {uni.courses.length} courses passed · {uni.lecturesToday} of {LECTURE.perDay} lectures today
      </span>
      <ul className="uni-courses">
        {uni.courses.map((co) => (
          <li key={co.key} className="table-row">
            <span className="stack" style={{ gap: 2 }}>
              <span className="small">
                <b>{co.code}</b> {co.title}
              </span>
              <span className="uni-dots" aria-label={`${co.lectures} of ${LECTURES_PER_COURSE} lectures`}>
                {Array.from({ length: LECTURES_PER_COURSE }, (_, i) => (
                  <i key={i} className={i < co.lectures ? "on" : ""} />
                ))}
                {co.attempts > 0 && !co.passed && <span className="tiny muted"> · {co.attempts} attempt{co.attempts > 1 ? "s" : ""}</span>}
              </span>
            </span>
            {co.passed ? (
              <span className="notice small">
                <CheckCircle2 size={15} aria-hidden="true" /> Passed
              </span>
            ) : co.lectures < LECTURES_PER_COURSE ? (
              <button
                type="button"
                className="btn sm go"
                disabled={busy || !open || uni.lecturesToday >= LECTURE.perDay}
                onClick={() =>
                  void run(async () => {
                    setUni(await api<UniView>("POST", "/api/uni/lectures/start", { course: co.key }));
                  })
                }
              >
                {!open ? "Closed" : uni.lecturesToday >= LECTURE.perDay ? "Tomorrow" : "Attend lecture"}
              </button>
            ) : (
              <button
                type="button"
                className="btn sm gold"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const e = await api<UniExam>("POST", `/api/uni/exams/${co.key}`);
                    if (e.fee) notify(`Resit fee: ${formatCoins(e.fee)} coins`);
                    setAnswers([]);
                    setExam(e);
                  })
                }
              >
                {co.attempts > 0 ? `Resit exam (${formatCoins(EXAM.resitFee)})` : "Sit exam"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
