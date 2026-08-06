// Hustle Academy (docs/academy-plan.md): Lampnet Institute of Technology courses on the phone.
// Learners: catalogue → course → lessons (unlisted YouTube or text, server-timed) → module quizzes → free virtual
// certificate with a public verify link to share. Admins: the course builder and learner progress.
import {
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  HEARTBEAT,
  PROVIDERS,
  type AcademyMe,
  type AdminCourse,
  type AdminModule,
  type CertificateView,
  type CourseCard,
  type CourseDetail,
  type LearnerRow,
  type LessonView,
  type QuizAttemptView,
  type QuizResult,
} from "@hc/shared";
import { Award, BookOpen, CheckCircle2, ChevronRight, Coins, Copy, GraduationCap, Lock, PlayCircle, Share2, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, formatCoins, formatNaira } from "../api.js";

const verifyUrl = (n: string) => `${window.location.origin}/?verify=${encodeURIComponent(n)}`;
const issuedOn = (iso: string) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));
const levelLabel = (l: string) => l[0]!.toUpperCase() + l.slice(1);

type Screen = { kind: "list" } | { kind: "course"; slug: string } | { kind: "lesson"; id: string } | { kind: "quiz"; slug: string; moduleId: string } | { kind: "cert"; cert: CertificateView };

export function AcademyApp({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  if (screen.kind === "course") return <CoursePage slug={screen.slug} go={setScreen} notify={notify} onChanged={onChanged} />;
  if (screen.kind === "lesson") return <LessonPage id={screen.id} go={setScreen} />;
  if (screen.kind === "quiz") return <QuizPage slug={screen.slug} moduleId={screen.moduleId} go={setScreen} />;
  if (screen.kind === "cert")
    return (
      <div className="stack">
        <button type="button" className="link-btn small" onClick={() => setScreen({ kind: "list" })}>
          ← All courses
        </button>
        <CertificateCard cert={screen.cert} notify={notify} />
      </div>
    );
  return <Catalogue go={setScreen} />;
}

function Catalogue({ go }: { go: (s: Screen) => void }) {
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [mine, setMine] = useState<AcademyMe | null>(null);
  useEffect(() => {
    api<CourseCard[]>("GET", "/api/academy/courses").then(setCourses).catch(() => setCourses([]));
    api<AcademyMe>("GET", "/api/academy/me").then(setMine).catch(() => setMine(null));
  }, []);
  return (
    <div className="stack academy">
      <div className="academy-hero">
        <GraduationCap size={30} aria-hidden="true" />
        <div>
          <strong>Hustle Academy</strong>
          <span className="small">Lampnet Institute of Technology · with AkureTechHub</span>
        </div>
      </div>
      <p className="small muted">Learn real tech skills between hustles. Finish a course to earn City Coins, XP and a certificate you can share.</p>
      {mine && mine.certificates.length > 0 && (
        <section className="stack">
          <h3 className="academy-h">Your certificates</h3>
          {mine.certificates.map((c) => (
            <button key={c.number} type="button" className="academy-row" onClick={() => go({ kind: "cert", cert: c })}>
              <Award size={20} aria-hidden="true" />
              <span>
                <strong>{c.courseTitle}</strong>
                <span className="tiny muted">{c.number}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
        </section>
      )}
      <h3 className="academy-h">Courses</h3>
      {!courses && <p className="small muted">Loading…</p>}
      {courses?.length === 0 && <p className="phone-empty">No courses open yet. New ones are coming soon.</p>}
      {courses?.map((c) => (
        <button key={c.id} type="button" className="course-card" onClick={() => go({ kind: "course", slug: c.slug })}>
          <span className="course-top">
            <span className="tag">{c.category}</span>
            <span className="tag">{levelLabel(c.level)}</span>
            {c.provider === "akuretechhub" && <span className="tag">AkureTechHub</span>}
          </span>
          <strong>{c.title}</strong>
          <span className="small muted">{c.summary}</span>
          <span className="tiny muted">
            {c.modules} modules · {c.lessons} lessons · <Coins size={11} aria-hidden="true" /> {formatCoins(c.rewardCoins)} · +{c.rewardXp} XP
          </span>
          {c.enrolled && (
            <span className="course-progress" aria-label={`${c.percent}% done`}>
              <span style={{ width: `${c.percent ?? 0}%` }} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function CoursePage({ slug, go, notify, onChanged }: { slug: string; go: (s: Screen) => void; notify: (m: string) => void; onChanged: () => void }) {
  const [c, setC] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<CourseDetail>("GET", `/api/academy/courses/${slug}`)
      .then(setC)
      .catch((e) => setError((e as Error).message));
  useEffect(() => {
    void load();
  }, [slug]);
  if (!c) return <p className="small muted">{error ?? "Loading…"}</p>;

  const enrol = async () => {
    setBusy(true);
    try {
      await api("POST", `/api/academy/courses/${slug}/enrol`);
      await load();
      notify("You're in. Start with the first lesson.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const claim = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ certificate: CertificateView; reward: { coins: number; xp: number } | null }>("POST", `/api/academy/courses/${slug}/certificate`, { holderName: name });
      if (r.reward) notify(`Certificate earned! +${formatCoins(r.reward.coins)} City Coins, +${r.reward.xp} XP`);
      onChanged();
      go({ kind: "cert", cert: r.certificate });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const firstOpen = c.modules_.flatMap((m) => m.lessons).find((l) => !l.done);
  return (
    <div className="stack academy">
      <button type="button" className="link-btn small" onClick={() => go({ kind: "list" })}>
        ← All courses
      </button>
      <h2 style={{ fontSize: 22 }}>{c.title}</h2>
      <p className="small">{c.summary}</p>
      <p className="tiny muted">
        By {PROVIDERS[c.provider].name} · {levelLabel(c.level)} · Finish to earn {formatCoins(c.rewardCoins)} City Coins and {c.rewardXp} XP
      </p>
      {c.enrolled && (
        <span className="course-progress" aria-label={`${c.percent}% done`}>
          <span style={{ width: `${c.percent ?? 0}%` }} />
        </span>
      )}
      {!c.enrolled ? (
        <button type="button" className="btn go" disabled={busy} onClick={() => void enrol()}>
          <BookOpen size={16} aria-hidden="true" /> Join this course (free)
        </button>
      ) : (
        firstOpen && (
          <button type="button" className="btn go" onClick={() => go({ kind: "lesson", id: firstOpen.id })}>
            <PlayCircle size={16} aria-hidden="true" /> {c.percent ? "Continue" : "Start"}: {firstOpen.title}
          </button>
        )
      )}

      {c.modules_.map((m, i) => {
        const lessonsDone = m.lessons.every((l) => l.done);
        return (
          <section key={m.id} className="module-card stack">
            <strong>
              {i + 1}. {m.title}
            </strong>
            <ul className="lesson-list">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <button type="button" className="academy-row" disabled={!c.enrolled} onClick={() => go({ kind: "lesson", id: l.id })}>
                    {l.done ? <CheckCircle2 size={18} className="ok" aria-label="Done" /> : l.kind === "video" ? <PlayCircle size={18} aria-hidden="true" /> : <BookOpen size={18} aria-hidden="true" />}
                    <span>{l.title}</span>
                    <span className="tiny muted">{l.minSeconds >= 60 ? `${Math.round(l.minSeconds / 60)} min` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
            {m.questions > 0 &&
              (m.passed ? (
                <span className="notice small">
                  <CheckCircle2 size={15} aria-hidden="true" /> Quiz passed
                </span>
              ) : (
                <button type="button" className="btn sm" disabled={!c.enrolled || !lessonsDone} onClick={() => go({ kind: "quiz", slug, moduleId: m.id })}>
                  {lessonsDone ? <Sparkles size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />} Module quiz · {m.quizSize} questions · pass {m.passPercent}%
                </button>
              ))}
          </section>
        );
      })}

      {c.certificate ? (
        <button type="button" className="btn go" onClick={() => go({ kind: "cert", cert: c.certificate! })}>
          <Award size={16} aria-hidden="true" /> View your certificate
        </button>
      ) : (
        c.completed && (
          <form className="module-card stack" onSubmit={(e) => void claim(e)}>
            <strong>You finished the course! 🎉</strong>
            <label className="field">
              <span>Your full name, as it should appear on the certificate</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={3} maxLength={80} />
            </label>
            <button type="submit" className="btn go" disabled={busy}>
              <Award size={16} aria-hidden="true" /> Get my certificate
            </button>
          </form>
        )
      )}
      <p className="tiny muted">
        The virtual certificate is free. A printed certificate ({formatNaira(c.physicalCertKobo)}){c.trainingFeeKobo ? ` and the full professional training (${formatNaira(c.trainingFeeKobo)})` : ""} from Lampnet Institute of
        Technology are coming soon.
      </p>
      {error && <p className="alert small">{error}</p>}
    </div>
  );
}

function LessonPage({ id, go }: { id: string; go: (s: Screen) => void }) {
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const [progress, setProgress] = useState({ seconds: 0, done: false });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLesson(null);
    api<LessonView>("GET", `/api/academy/lessons/${id}`)
      .then((l) => {
        setLesson(l);
        setProgress({ seconds: l.seconds, done: l.done });
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);
  // Report in while the lesson is open and visible; the server times it.
  useEffect(() => {
    if (!lesson) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      api<{ seconds: number; done: boolean }>("POST", `/api/academy/lessons/${id}/heartbeat`)
        .then((p) => setProgress({ seconds: p.seconds, done: p.done }))
        .catch(() => undefined);
    };
    beat();
    const t = window.setInterval(beat, HEARTBEAT.everySeconds * 1000);
    return () => window.clearInterval(t);
  }, [lesson, id]);
  if (!lesson) return <p className="small muted">{error ?? "Loading…"}</p>;

  const left = Math.max(0, lesson.minSeconds - progress.seconds);
  return (
    <div className="stack academy">
      <button type="button" className="link-btn small" onClick={() => go({ kind: "course", slug: lesson.courseSlug })}>
        ← Course
      </button>
      <h2 style={{ fontSize: 20 }}>{lesson.title}</h2>
      {lesson.youtubeId && (
        <div className="video-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${lesson.youtubeId}?rel=0&modestbranding=1`}
            title={lesson.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
      {lesson.body &&
        lesson.body.split(/\n{2,}/).map((p, i) => (
          <p key={i} className="lesson-text">
            {p}
          </p>
        ))}
      {progress.done ? (
        <span className="notice small">
          <CheckCircle2 size={15} aria-hidden="true" /> Lesson done
        </span>
      ) : (
        <div className="stack" style={{ gap: 4 }}>
          <span className="course-progress" aria-label="Time on this lesson">
            <span style={{ width: `${lesson.minSeconds ? Math.min(100, (progress.seconds * 100) / lesson.minSeconds) : 100}%` }} />
          </span>
          <span className="tiny muted">Keep this lesson open: it counts as done in about {Math.ceil(left / 60)} min.</span>
        </div>
      )}
      <div className="row">
        {lesson.prev && (
          <button type="button" className="btn quiet" onClick={() => go({ kind: "lesson", id: lesson.prev! })}>
            Back
          </button>
        )}
        {lesson.quizNext ? (
          <button type="button" className="btn go" disabled={!progress.done} onClick={() => go({ kind: "quiz", slug: lesson.courseSlug, moduleId: lesson.moduleId })}>
            Take the module quiz
          </button>
        ) : lesson.next ? (
          <button type="button" className="btn go" disabled={!progress.done} onClick={() => go({ kind: "lesson", id: lesson.next! })}>
            Next lesson
          </button>
        ) : (
          <button type="button" className="btn go" disabled={!progress.done} onClick={() => go({ kind: "course", slug: lesson.courseSlug })}>
            Back to the course
          </button>
        )}
      </div>
    </div>
  );
}

function QuizPage({ slug, moduleId, go }: { slug: string; moduleId: string; go: (s: Screen) => void }) {
  const [quiz, setQuiz] = useState<QuizAttemptView | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<QuizAttemptView>("POST", `/api/academy/modules/${moduleId}/quiz`)
      .then((q) => {
        setQuiz(q);
        setAnswers(q.questions.map(() => null));
      })
      .catch((e) => setError((e as Error).message));
  }, [moduleId]);
  const back = (
    <button type="button" className="link-btn small" onClick={() => go({ kind: "course", slug })}>
      ← Course
    </button>
  );
  if (!quiz)
    return (
      <div className="stack">
        {back}
        <p className={error ? "alert small" : "small muted"}>{error ?? "Loading…"}</p>
      </div>
    );
  const submit = async () => {
    setBusy(true);
    try {
      setResult(await api<QuizResult>("POST", `/api/academy/attempts/${quiz.attemptId}/submit`, { answers }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack academy">
      {back}
      {result && (
        <div className={result.passed ? "notice" : "alert"}>
          {result.passed ? `Passed: ${result.percent}% (${result.right} of ${result.total}).` : `${result.percent}% this time; you need ${quiz.passPercent}%. Go over the lessons and try again in a few minutes.`}
          {result.courseComplete && " You've finished the whole course. Claim your certificate on the course page."}
        </div>
      )}
      {quiz.questions.map((q, i) => {
        const r = result?.review[i];
        return (
          <fieldset key={q.id} className="module-card quiz-q">
            <legend>
              {i + 1}. {q.prompt}
            </legend>
            {q.options.map((o, j) => (
              <label key={j} className={`quiz-opt${r ? (j === r.correct ? " right" : j === r.chosen ? " wrong" : "") : ""}`}>
                <input type="radio" name={q.id} checked={answers[i] === j} disabled={!!result} onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))} />
                {o}
              </label>
            ))}
            {r?.explanation && <span className="tiny muted">{r.explanation}</span>}
          </fieldset>
        );
      })}
      {!result ? (
        <button type="button" className="btn go" disabled={busy || answers.some((a) => a === null)} onClick={() => void submit()}>
          Hand in
        </button>
      ) : (
        <button type="button" className="btn go" onClick={() => go({ kind: "course", slug })}>
          Back to the course
        </button>
      )}
      {error && <p className="alert small">{error}</p>}
    </div>
  );
}

/** The certificate itself: shown in the game and on the public verify page, with share links. */
export function CertificateCard({ cert, notify }: { cert: CertificateView; notify?: (m: string) => void }) {
  const url = verifyUrl(cert.number);
  const text = `I just earned my ${cert.courseTitle} certificate from ${cert.issuer} on Hustle City! Check it:`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify?.("Link copied");
    } catch {
      notify?.(url);
    }
  };
  const share = async () => {
    if (navigator.share) await navigator.share({ title: `${cert.courseTitle} certificate`, text, url }).catch(() => undefined);
    else void copy();
  };
  return (
    <div className="stack">
      <article className={`cert${cert.revoked ? " revoked" : ""}`} aria-label={`Certificate ${cert.number}`}>
        <span className="cert-kicker">{cert.issuer}</span>
        {cert.partner && <span className="tiny">in partnership with {cert.partner}</span>}
        <span className="cert-title">Certificate of Completion</span>
        <span className="small">This certifies that</span>
        <strong className="cert-name">{cert.holderName}</strong>
        <span className="small">has completed the course</span>
        <strong className="cert-course">{cert.courseTitle}</strong>
        <span className="tiny">
          Issued {issuedOn(cert.issuedAt)} · No. {cert.number}
        </span>
        <span className="tiny">Verify at {url.replace(/^https?:\/\//, "")}</span>
        {cert.revoked && <span className="cert-stamp">Revoked{cert.revokedReason ? `: ${cert.revokedReason}` : ""}</span>}
      </article>
      {!cert.revoked && (
        <div className="row wrap">
          <a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a className="btn sm" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          <a className="btn sm" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
            X
          </a>
          <button type="button" className="btn sm quiet" onClick={() => void share()}>
            <Share2 size={15} aria-hidden="true" /> Share
          </button>
          <button type="button" className="btn sm quiet" onClick={() => void copy()}>
            <Copy size={15} aria-hidden="true" /> Copy link
          </button>
        </div>
      )}
    </div>
  );
}

/** Public page for ?verify=<number>: anyone can check a certificate, no sign-in. */
export function VerifyPage({ number, onDone }: { number: string; onDone: () => void }) {
  const [cert, setCert] = useState<CertificateView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    api<CertificateView>("GET", `/api/certificates/${encodeURIComponent(number)}`)
      .then(setCert)
      .catch(() => setMissing(true));
  }, [number]);
  return (
    <main className="reset-page">
      <div className="reset-card stack">
        <h1 style={{ fontSize: 24 }}>Certificate check</h1>
        {missing && (
          <p className="alert">
            <span>
              No certificate with the number <strong>{number}</strong>. Check the number and try again.
            </span>
          </p>
        )}
        {cert && (
          <>
            <p className={cert.revoked ? "alert" : "notice"}>
              {cert.revoked ? "This certificate has been revoked." : `Genuine: issued by ${cert.issuer}${cert.partner ? ` with ${cert.partner}` : ""}.`}
            </p>
            <CertificateCard cert={cert} />
          </>
        )}
        <button type="button" className="btn go" onClick={onDone}>
          Play Hustle City
        </button>
      </div>
    </main>
  );
}

// --- Admin: course builder ---------------------------------------------------

export function AdminAcademy({ notify }: { notify: (m: string) => void }) {
  const [list, setList] = useState<AdminCourse[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () =>
    api<AdminCourse[]>("GET", "/api/admin/academy/courses")
      .then(setList)
      .catch(() => setList([]));
  useEffect(() => {
    void load();
  }, []);
  const course = list?.find((c) => c.id === open);
  const replace = (c: AdminCourse) => setList((l) => (l ? (l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [c, ...l]) : [c]));
  if (course) return <CourseEditor course={course} onBack={() => setOpen(null)} onSaved={replace} notify={notify} />;
  return (
    <section className="stack">
      <h3 className="academy-h">Academy courses</h3>
      {list?.map((c) => (
        <button key={c.id} type="button" className="academy-row" onClick={() => setOpen(c.id)}>
          <GraduationCap size={18} aria-hidden="true" />
          <span>
            <strong>{c.title}</strong>
            <span className="tiny muted">
              {c.status} · {c.modules} modules · {c.lessons} lessons · {c.learners} learners · {c.certified} certified
            </span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ))}
      <NewCourse
        onCreated={(c) => {
          replace(c);
          setOpen(c.id);
        }}
      />
    </section>
  );
}

function errorText(e: unknown) {
  return (e as Error).message;
}

function NewCourse({ onCreated }: { onCreated: (c: AdminCourse) => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<string>("software");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      onCreated(await api<AdminCourse>("POST", "/api/admin/academy/courses", { title, slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), category }));
      setTitle("");
      setSlug("");
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <form className="module-card stack" onSubmit={(e) => void submit(e)}>
      <strong>New course</strong>
      <label className="field">
        Title
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      </label>
      <label className="field">
        Web name (optional)
        <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. web-basics" />
      </label>
      <label className="field">
        Category
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {COURSE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn go">
        Create draft
      </button>
      {error && <p className="alert small">{error}</p>}
    </form>
  );
}

function CourseEditor({ course, onBack, onSaved, notify }: { course: AdminCourse; onBack: () => void; onSaved: (c: AdminCourse) => void; notify: (m: string) => void }) {
  const [meta, setMeta] = useState({
    title: course.title,
    summary: course.summary,
    category: course.category,
    level: course.level,
    provider: course.provider,
    rewardCoins: course.rewardCoins,
    rewardXp: course.rewardXp,
    trainingFee: course.trainingFeeKobo ? String(course.trainingFeeKobo / 100) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [learners, setLearners] = useState<LearnerRow[] | null>(null);
  const call = async (method: "POST" | "PATCH" | "PUT" | "DELETE", url: string, body?: unknown, ok?: string) => {
    setError(null);
    try {
      onSaved(await api<AdminCourse>(method, url, body));
      if (ok) notify(ok);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    }
  };
  const saveMeta = () =>
    call(
      "PATCH",
      `/api/admin/academy/courses/${course.id}`,
      { ...meta, trainingFee: undefined, trainingFeeKobo: meta.trainingFee ? Math.round(Number(meta.trainingFee) * 100) : null },
      "Course saved",
    );
  return (
    <div className="stack academy">
      <button type="button" className="link-btn small" onClick={onBack}>
        ← All courses
      </button>
      <h3 className="academy-h">
        {course.title} <span className="tag">{course.status}</span>
      </h3>
      <div className="module-card stack">
        <label className="field">
          Title
          <input className="input" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </label>
        <label className="field">
          Summary
          <textarea className="input" rows={3} value={meta.summary} onChange={(e) => setMeta({ ...meta, summary: e.target.value })} />
        </label>
        <div className="row wrap">
          <label className="field">
            Category
            <select className="input" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value as typeof meta.category })}>
              {COURSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Level
            <select className="input" value={meta.level} onChange={(e) => setMeta({ ...meta, level: e.target.value as typeof meta.level })}>
              {COURSE_LEVELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Provider
            <select className="input" value={meta.provider} onChange={(e) => setMeta({ ...meta, provider: e.target.value as typeof meta.provider })}>
              {Object.entries(PROVIDERS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row wrap">
          <label className="field">
            Reward coins
            <input className="input" type="number" min={0} value={meta.rewardCoins} onChange={(e) => setMeta({ ...meta, rewardCoins: Number(e.target.value) })} />
          </label>
          <label className="field">
            Reward XP
            <input className="input" type="number" min={0} value={meta.rewardXp} onChange={(e) => setMeta({ ...meta, rewardXp: Number(e.target.value) })} />
          </label>
          <label className="field">
            Professional training fee ₦ (blank = none)
            <input className="input" type="number" min={500000} max={800000} step={10000} value={meta.trainingFee} onChange={(e) => setMeta({ ...meta, trainingFee: e.target.value })} />
          </label>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => void saveMeta()}>
            Save details
          </button>
          <button
            type="button"
            className="btn go"
            onClick={() => void call("PATCH", `/api/admin/academy/courses/${course.id}`, { status: course.status === "draft" ? "published" : "draft" }, course.status === "draft" ? "Published" : "Back to draft")}
          >
            {course.status === "draft" ? "Publish" : "Unpublish"}
          </button>
        </div>
      </div>

      {course.modules_.map((m, i) => (
        <ModuleEditor key={m.id} n={i + 1} m={m} published={course.status === "published"} call={call} />
      ))}
      <AddModule onAdd={(title) => call("POST", `/api/admin/academy/courses/${course.id}/modules`, { title }, "Module added")} />

      <button
        type="button"
        className="btn quiet"
        onClick={() =>
          api<LearnerRow[]>("GET", `/api/admin/academy/courses/${course.id}/learners`)
            .then(setLearners)
            .catch((e) => setError(errorText(e)))
        }
      >
        Show learners
      </button>
      {learners && (
        <table className="learners">
          <thead>
            <tr>
              <th>Learner</th>
              <th>Progress</th>
              <th>Quizzes</th>
              <th>Certificate</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((l) => (
              <tr key={l.nickname}>
                <td>@{l.nickname}</td>
                <td>{l.percent}%</td>
                <td>{l.quizzesPassed}</td>
                <td>{l.certificate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="alert small">{error}</p>}
    </div>
  );
}

type Call = (method: "POST" | "PATCH" | "PUT" | "DELETE", url: string, body?: unknown, ok?: string) => Promise<boolean>;

function AddModule({ onAdd }: { onAdd: (title: string) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        void onAdd(title).then((ok) => ok && setTitle(""));
      }}
    >
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New module title" required minLength={2} />
      <button type="submit" className="btn">
        Add module
      </button>
    </form>
  );
}

function ModuleEditor({ n, m, published, call }: { n: number; m: AdminModule; published: boolean; call: Call }) {
  const [lesson, setLesson] = useState({ title: "", kind: "video" as "video" | "text", video: "", body: "", minutes: "5" });
  const [q, setQ] = useState({ prompt: "", options: "", answer: 0, explanation: "" });
  const opts = q.options.split("\n").map((o) => o.trim()).filter(Boolean);
  return (
    <section className="module-card stack">
      <div className="spread">
        <strong>
          {n}. {m.title}
        </strong>
        {!published && (
          <button type="button" className="link-btn tiny" onClick={() => void call("DELETE", `/api/admin/academy/modules/${m.id}`, undefined, "Module removed")}>
            Remove
          </button>
        )}
      </div>
      <div className="row wrap tiny">
        <label>
          Quiz size{" "}
          <input className="input sm" type="number" min={1} max={30} defaultValue={m.quizSize} onBlur={(e) => void call("PATCH", `/api/admin/academy/modules/${m.id}`, { quizSize: Number(e.target.value) })} />
        </label>
        <label>
          Pass %{" "}
          <input className="input sm" type="number" min={50} max={100} defaultValue={m.passPercent} onBlur={(e) => void call("PATCH", `/api/admin/academy/modules/${m.id}`, { passPercent: Number(e.target.value) })} />
        </label>
      </div>
      <ul className="lesson-list">
        {m.lessons.map((l) => (
          <li key={l.id} className="academy-row static">
            {l.kind === "video" ? <PlayCircle size={16} aria-hidden="true" /> : <BookOpen size={16} aria-hidden="true" />}
            <span>
              {l.title} <span className="tiny muted">· {Math.round(l.minSeconds / 60)} min{l.youtubeId ? ` · youtu.be/${l.youtubeId}` : ""}</span>
            </span>
            {!published && (
              <button type="button" className="link-btn tiny" onClick={() => void call("DELETE", `/api/admin/academy/lessons/${l.id}`)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="stack add-box"
        onSubmit={(e) => {
          e.preventDefault();
          void call("POST", `/api/admin/academy/modules/${m.id}/lessons`, { title: lesson.title, kind: lesson.kind, video: lesson.video, body: lesson.body, minSeconds: Math.round(Number(lesson.minutes) * 60) }, "Lesson added").then(
            (ok) => ok && setLesson({ title: "", kind: lesson.kind, video: "", body: "", minutes: lesson.minutes }),
          );
        }}
      >
        <strong className="small">Add a lesson</strong>
        <div className="row wrap">
          <input className="input" value={lesson.title} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} placeholder="Lesson title" required />
          <select className="input" value={lesson.kind} onChange={(e) => setLesson({ ...lesson, kind: e.target.value as "video" | "text" })}>
            <option value="video">Video</option>
            <option value="text">Text</option>
          </select>
          <label className="tiny">
            Minutes to count as done{" "}
            <input className="input sm" type="number" min={0} step={0.5} value={lesson.minutes} onChange={(e) => setLesson({ ...lesson, minutes: e.target.value })} />
          </label>
        </div>
        {lesson.kind === "video" && <input className="input" value={lesson.video} onChange={(e) => setLesson({ ...lesson, video: e.target.value })} placeholder="YouTube link (unlisted is fine)" />}
        <textarea className="input" rows={3} value={lesson.body} onChange={(e) => setLesson({ ...lesson, body: e.target.value })} placeholder={lesson.kind === "video" ? "Notes under the video (optional)" : "Lesson text"} />
        <button type="submit" className="btn sm">
          Add lesson
        </button>
      </form>

      <strong className="small">Quiz questions ({m.questions.filter((x) => x.active).length} active)</strong>
      <ul className="lesson-list">
        {m.questions.map((x) => (
          <li key={x.id} className={`academy-row static${x.active ? "" : " muted"}`}>
            <span>
              {x.prompt} <span className="tiny muted">→ {x.options[x.answer]}</span>
            </span>
            <button type="button" className="link-btn tiny" onClick={() => void call("PUT", `/api/admin/academy/questions/${x.id}`, { ...x, active: !x.active })}>
              {x.active ? "Hide" : "Show"}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="stack add-box"
        onSubmit={(e) => {
          e.preventDefault();
          void call("POST", `/api/admin/academy/modules/${m.id}/questions`, { prompt: q.prompt, options: opts, answer: q.answer, explanation: q.explanation }, "Question added").then(
            (ok) => ok && setQ({ prompt: "", options: "", answer: 0, explanation: "" }),
          );
        }}
      >
        <strong className="small">Add a question</strong>
        <input className="input" value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} placeholder="Question" required />
        <textarea className="input" rows={4} value={q.options} onChange={(e) => setQ({ ...q, options: e.target.value })} placeholder={"Options, one per line (2 to 6)"} />
        {opts.length > 1 && (
          <div className="stack" role="radiogroup" aria-label="Right answer">
            <span className="tiny muted">Tick the right answer:</span>
            {opts.map((o, i) => (
              <label key={i} className="quiz-opt">
                <input type="radio" name={`ans-${m.id}`} checked={q.answer === i} onChange={() => setQ({ ...q, answer: i })} /> {o}
              </label>
            ))}
          </div>
        )}
        <input className="input" value={q.explanation} onChange={(e) => setQ({ ...q, explanation: e.target.value })} placeholder="Why it's right (shown after handing in)" />
        <button type="submit" className="btn sm">
          Add question
        </button>
      </form>
    </section>
  );
}
