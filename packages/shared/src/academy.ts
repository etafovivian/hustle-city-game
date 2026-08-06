// Hustle Academy (docs/academy-plan.md): courses from Lampnet Institute of Technology and its partner AkureTechHub.
// A course is modules → lessons (an unlisted YouTube video and/or text) → a quiz per module. Finishing means every
// lesson was really spent on (server-timed) and every module quiz passed; then the learner gets a virtual
// certificate with a public verify page. Paid certificates and professional training fees come in step B.

export const ACADEMY_ISSUER = "Lampnet Institute of Technology";
export const PROVIDERS = {
  lampnet: { name: "Lampnet Institute of Technology", short: "Lampnet" },
  akuretechhub: { name: "AkureTechHub", short: "AkureTechHub", partnerOf: "Lampnet Institute of Technology" },
} as const;
export type Provider = keyof typeof PROVIDERS;

export const COURSE_CATEGORIES = ["software", "cloud", "devops", "cybersecurity", "data", "productivity", "business"] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];
export const COURSE_LEVELS = ["beginner", "intermediate", "professional"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

/** Owner's pricing (2026-10-12): the virtual certificate is free; a physical certificate costs ₦5,000. */
export const PHYSICAL_CERT_KOBO = 500_000;
/** Professional training (cloud, DevOps, DevSecOps…) is priced per course, ₦500,000–₦800,000. */
export const TRAINING_FEE_RANGE_KOBO = { min: 50_000_000, max: 80_000_000 } as const;

/** Quiz rules. */
export const QUIZ = {
  defaultSize: 5,
  defaultPassPercent: 70,
  /** After a failed attempt the learner waits before trying again (time to re-watch). */
  retryAfterMinutes: 10,
  maxAttemptsPerDay: 5,
} as const;
/** Heartbeats from an open lesson: each counts at most this many seconds, so a closed tab can't bank time. */
export const HEARTBEAT = { everySeconds: 15, maxCreditSeconds: 20 } as const;

/** The YouTube video id from a link (watch, youtu.be, embed, shorts) or a bare id; null when it isn't one. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = /^\/(embed|shorts|live)\/([\w-]+)/.exec(url.pathname);
      id = m ? m[2]! : null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Score a quiz: percent correct (rounded down) and whether it passes. */
export function scoreQuiz(answers: (number | null)[], correct: number[], passPercent: number) {
  const right = correct.reduce((n, c, i) => n + (answers[i] === c ? 1 : 0), 0);
  const percent = correct.length ? Math.floor((right * 100) / correct.length) : 0;
  return { right, total: correct.length, percent, passed: percent >= passPercent };
}

/** Certificate numbers: issuer prefix, year, and 6 characters without look-alikes (no 0/O, 1/I/L). */
const CERT_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function certificateNumber(year: number, random: (n: number) => number) {
  let code = "";
  for (let i = 0; i < 6; i++) code += CERT_ALPHABET[random(CERT_ALPHABET.length)]!;
  return `LIT-${String(year).slice(-2)}-${code}`;
}
export const CERT_NUMBER_RE = /^LIT-\d{2}-[2-9A-HJKMNP-Z]{6}$/;

/** Ledger reference for a course's completion reward (one per learner and course). */
export const courseRewardRef = (courseId: string) => `course:${courseId}`;

// --- API shapes -----------------------------------------------------------

export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: CourseCategory;
  level: CourseLevel;
  provider: Provider;
  modules: number;
  lessons: number;
  rewardCoins: number;
  rewardXp: number;
  physicalCertKobo: number;
  trainingFeeKobo: number | null;
  status: "draft" | "published";
  /** For a signed-in learner: enrolled, and how far (0–100). */
  enrolled?: boolean;
  percent?: number;
  completed?: boolean;
}

export interface LessonOutline {
  id: string;
  title: string;
  kind: "video" | "text";
  minSeconds: number;
  done?: boolean;
}
export interface ModuleOutline {
  id: string;
  title: string;
  lessons: LessonOutline[];
  questions: number;
  quizSize: number;
  passPercent: number;
  passed?: boolean;
}
export interface CourseDetail extends CourseCard {
  modules_: ModuleOutline[];
  certificate?: CertificateView | null;
}

export interface LessonView {
  id: string;
  courseSlug: string;
  moduleId: string;
  title: string;
  kind: "video" | "text";
  youtubeId: string | null;
  body: string;
  minSeconds: number;
  seconds: number;
  done: boolean;
  prev: string | null;
  next: string | null;
  /** Last lesson of a module that has a quiz: offer the quiz before moving on. */
  quizNext: boolean;
}

export interface QuizQuestionView {
  id: string;
  prompt: string;
  options: string[];
}
export interface QuizAttemptView {
  attemptId: string;
  moduleId: string;
  questions: QuizQuestionView[];
  passPercent: number;
}
export interface QuizResult {
  percent: number;
  right: number;
  total: number;
  passed: boolean;
  /** Per question: the right option and why (shown after submitting). */
  review: { id: string; correct: number; chosen: number | null; explanation: string }[];
  retryAt: string | null;
  courseComplete: boolean;
}

export interface CertificateView {
  number: string;
  holderName: string;
  courseTitle: string;
  provider: Provider;
  issuer: string;
  partner: string | null;
  issuedAt: string;
  kind: "virtual" | "physical";
  revoked: boolean;
  revokedReason: string | null;
}

export interface AcademyMe {
  courses: CourseCard[];
  certificates: CertificateView[];
}

// Admin editor shapes
export interface AdminLesson {
  id: string;
  title: string;
  kind: "video" | "text";
  youtubeId: string | null;
  body: string;
  minSeconds: number;
  position: number;
}
export interface AdminQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  active: boolean;
}
export interface AdminModule {
  id: string;
  title: string;
  position: number;
  quizSize: number;
  passPercent: number;
  lessons: AdminLesson[];
  questions: AdminQuestion[];
}
export interface AdminCourse extends CourseCard {
  modules_: AdminModule[];
  learners: number;
  certified: number;
}
export interface LearnerRow {
  nickname: string;
  enrolledAt: string;
  percent: number;
  quizzesPassed: number;
  completedAt: string | null;
  certificate: string | null;
}
