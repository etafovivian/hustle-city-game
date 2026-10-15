// Stage B1: artisan quote journey (PRD: Customer and artisan journey; Service booking states).
// request → quoted → (accepted →) scheduled → completion submitted → completed, with versioned quotes.
// Any change to a quote is a new version the customer must accept again (extra charges need approval).
// No money moves in B1: prices are real naira, paid directly as agreed until the payment phase.

export const ARTISAN_CATEGORIES = [
  { key: "generator_repair", label: "Generator repair" },
  { key: "phone_repair", label: "Phone repair" },
  { key: "laptop_repair", label: "Laptop repair" },
  { key: "ac_repair", label: "AC and fridge repair" },
  { key: "electrician", label: "Electrician" },
  { key: "plumber", label: "Plumber" },
  { key: "tailor", label: "Tailor and fashion" },
  { key: "event_decor", label: "Event decoration" },
  { key: "catering", label: "Catering" },
  { key: "hair_beauty", label: "Hair and beauty" },
  { key: "pos_agent", label: "POS agent (cash out, transfers)" },
  { key: "dispatch_rider", label: "Dispatch rider and delivery" },
  { key: "laundry", label: "Laundry and dry cleaning" },
  { key: "cleaning", label: "Home and office cleaning" },
  { key: "solar_inverter", label: "Solar and inverter installer" },
  { key: "gas_refill", label: "Cooking gas refill" },
  { key: "printing", label: "Printing and branding" },
  { key: "tutor", label: "Lesson teacher and tutor" },
  { key: "car_wash", label: "Car wash" },
  { key: "mechanic", label: "Mechanic and vulcaniser" },
] as const;
export const ARTISAN_CATEGORY_KEYS: readonly string[] = ARTISAN_CATEGORIES.map((c) => c.key);
/** Shops that sell things (retail listings): customers see products and prices, and go to the shop or WhatsApp it. */
export const RETAIL_CATEGORIES = [
  { key: "provisions", label: "Provisions and groceries" },
  { key: "food_drinks", label: "Food and drinks" },
  { key: "fashion_fabrics", label: "Fashion and fabrics" },
  { key: "phones_gadgets", label: "Phones and gadgets" },
  { key: "electronics", label: "Electronics and appliances" },
  { key: "beauty_supplies", label: "Beauty and hair supplies" },
  { key: "building_materials", label: "Building materials" },
  { key: "books_stationery", label: "Books and stationery" },
  { key: "baby_kids", label: "Baby and kids" },
  { key: "home_kitchen", label: "Home and kitchen" },
  { key: "pharmacy", label: "Pharmacy and chemist" },
] as const;
export const RETAIL_CATEGORY_KEYS: readonly string[] = RETAIL_CATEGORIES.map((c) => c.key);
export type ListingKind = "artisan" | "retail";
export const categoryLabel = (key: string) =>
  [...ARTISAN_CATEGORIES, ...RETAIL_CATEGORIES].find((c) => c.key === key)?.label ?? key.replace(/_/g, " ");
/** Nigerian mobile number, as typed: 080…, +234 80…, or 234 80… (spaces and dashes allowed). */
export const NG_PHONE = /^(\+?234|0)[789][01]\d{8}$/;
export const normalisePhone = (raw: string) => raw.replace(/[\s-]/g, "");

export const LAGOS_AREAS = [
  "Yaba",
  "Surulere",
  "Ikeja",
  "Maryland",
  "Gbagada",
  "Oshodi",
  "Mushin",
  "Apapa",
  "Festac",
  "Lagos Island",
  "Ikoyi",
  "Victoria Island",
  "Lekki",
  "Ajah",
  "Ikorodu",
  "Egbeda",
] as const;
export const LAGOS_AREA_SET: ReadonlySet<string> = new Set(LAGOS_AREAS);

export type RequestStatus = "requested" | "quoted" | "scheduled" | "completion_submitted" | "completed" | "declined" | "cancelled";
export type RequestRole = "customer" | "artisan";
export type RequestAction = "quote" | "accept" | "decline" | "cancel" | "complete" | "confirm" | "not_done" | "review" | "note";

export const OPEN_STATUSES: readonly RequestStatus[] = ["requested", "quoted", "scheduled", "completion_submitted"];

/** Allowed transitions: [from statuses, role] → to status. */
const RULES: Record<Exclude<RequestAction, "review" | "note">, { from: RequestStatus[]; role: RequestRole; to: RequestStatus }> = {
  // First quote, a revision before acceptance, or extra charges after scheduling (back to the customer to approve).
  quote: { from: ["requested", "quoted", "scheduled"], role: "artisan", to: "quoted" },
  accept: { from: ["quoted"], role: "customer", to: "scheduled" },
  decline: { from: ["requested", "quoted"], role: "customer", to: "declined" },
  cancel: { from: ["requested", "quoted", "scheduled"], role: "customer", to: "cancelled" },
  complete: { from: ["scheduled"], role: "artisan", to: "completion_submitted" },
  confirm: { from: ["completion_submitted"], role: "customer", to: "completed" },
  not_done: { from: ["completion_submitted"], role: "customer", to: "scheduled" },
};
/** The artisan can also turn a request down before quoting. */
const ARTISAN_DECLINE: RequestStatus[] = ["requested"];

/** The status after an action, or null if that role can't do it now. */
export function nextStatus(status: RequestStatus, action: RequestAction, role: RequestRole): RequestStatus | null {
  if (action === "note") return OPEN_STATUSES.includes(status) ? status : null;
  if (action === "review") return role === "customer" && status === "completed" ? status : null;
  if (action === "decline" && role === "artisan") return ARTISAN_DECLINE.includes(status) ? "declined" : null;
  const rule = RULES[action];
  return rule.role === role && rule.from.includes(status) ? rule.to : null;
}

/** Whose move it is, for "your turn" badges. */
export function waitingOn(status: RequestStatus): RequestRole | null {
  if (status === "requested" || status === "scheduled") return "artisan";
  if (status === "quoted" || status === "completion_submitted") return "customer";
  return null;
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  requested: "Waiting for a quote",
  quoted: "Quote ready",
  scheduled: "Booked",
  completion_submitted: "Marked done",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export interface QuoteItem {
  label: string;
  /** Integer kobo. */
  amountKobo: number;
}

export const QUOTE_LIMITS = {
  maxItems: 20,
  /** ₦5,000,000 per line. */
  maxItemKobo: 500_000_000,
  maxNote: 500,
  /** Appointments up to 90 days ahead. */
  maxDaysAhead: 90,
};

/** Problem with a quote, or null if it's valid. `now` makes the appointment check testable. */
export function quoteProblem(items: QuoteItem[], appointmentAt: Date, now: Date): string | null {
  if (!items.length) return "Add at least one line to the quote.";
  if (items.length > QUOTE_LIMITS.maxItems) return `Use at most ${QUOTE_LIMITS.maxItems} lines.`;
  for (const it of items) {
    const label = it.label.trim();
    if (label.length < 2 || label.length > 80) return "Each line needs a short description (2–80 characters).";
    if (!Number.isInteger(it.amountKobo) || it.amountKobo < 0 || it.amountKobo > QUOTE_LIMITS.maxItemKobo) return "Each line needs a price between ₦0 and ₦5,000,000.";
  }
  if (Number.isNaN(appointmentAt.getTime())) return "Pick an appointment time.";
  if (appointmentAt.getTime() < now.getTime() - 5 * 60_000) return "The appointment must be in the future.";
  if (appointmentAt.getTime() > now.getTime() + QUOTE_LIMITS.maxDaysAhead * 86_400_000) return "Pick an appointment within the next 90 days.";
  return null;
}

export const quoteTotal = (items: QuoteItem[]) => items.reduce((s, i) => s + i.amountKobo, 0);

// ── API shapes ───────────────────────────────────────────

export interface ServiceRequestSummary {
  id: string;
  role: RequestRole;
  businessId: string;
  businessName: string;
  /** The other party's public name (customers appear by nickname only). */
  counterpart: string;
  category: string;
  status: RequestStatus;
  yourTurn: boolean;
  latestTotalKobo: number | null;
  scheduledFor: string | null;
  updatedAt: string;
}

export interface QuoteVersionView {
  version: number;
  items: QuoteItem[];
  totalKobo: number;
  note: string;
  appointmentAt: string;
  createdAt: string;
}

export interface ServiceEventView {
  type: string;
  by: RequestRole | "system";
  version: number | null;
  note: string;
  at: string;
}

export interface ServiceRequestDetail extends ServiceRequestSummary {
  description: string;
  serviceArea: string;
  createdAt: string;
  quotes: QuoteVersionView[];
  events: ServiceEventView[];
  review: { rating: number; body: string; at: string } | null;
  /** Actions the viewer can take now. */
  can: RequestAction[];
}

/** Opening hours: Lagos hours [open, close) on the given weekdays (0 = Sunday). close below open runs past midnight. */
export interface BusinessHours {
  days: number[];
  open: number;
  close: number;
}
export const DEFAULT_HOURS: BusinessHours = { days: [1, 2, 3, 4, 5, 6], open: 8, close: 19 };
const lagosNow = (at: Date) => {
  const l = new Date(at.getTime() + 3_600_000);
  return { day: l.getUTCDay(), hour: l.getUTCHours() + l.getUTCMinutes() / 60 };
};
export function isBusinessOpen(h: BusinessHours | null, at: Date): boolean | null {
  if (!h) return null;
  const { day, hour } = lagosNow(at);
  if (h.open < h.close) return h.days.includes(day) && hour >= h.open && hour < h.close;
  return (h.days.includes(day) && hour >= h.open) || (h.days.includes((day + 6) % 7) && hour < h.close);
}
const hourLabel = (n: number) => (n === 0 || n === 24 ? "midnight" : n === 12 ? "noon" : n < 12 ? `${n}am` : `${n - 12}pm`);
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Mon–Sat 8am–7pm" style. */
export function hoursText(h: BusinessHours): string {
  const days = [...h.days].sort();
  const run = days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1]! + 1);
  const d = days.length === 7 ? "Every day" : run ? `${DAY_SHORT[days[0]!]}–${DAY_SHORT[days[days.length - 1]!]}` : days.map((x) => DAY_SHORT[x]).join(", ");
  return `${d} ${hourLabel(h.open)}–${hourLabel(h.close)}`;
}

export interface MyBusiness {
  id: string;
  hours: BusinessHours | null;
  name: string;
  kind: ListingKind | "office";
  verified: boolean;
  category: string;
  serviceArea: string;
  status: "draft" | "pending_review" | "published" | "hidden" | "rejected";
  reviewNote: string | null;
}

export const REQUEST_ACTIONS: readonly RequestAction[] = ["quote", "accept", "decline", "cancel", "complete", "confirm", "not_done", "review", "note"];

/** Every action a role could take at a status (for the UI's buttons). */
export function availableActions(status: RequestStatus, role: RequestRole, reviewed: boolean): RequestAction[] {
  return REQUEST_ACTIONS.filter((a) => nextStatus(status, a, role) !== null && !(a === "review" && reviewed));
}
