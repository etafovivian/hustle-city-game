// Deals: discounts a real business honours. A player claims a one-time code in the game and shows it at the shop;
// the business marks it used on its own phone and the player earns a small reward. No cash, airtime or data.

export const DEAL_LIMITS = {
  titleMin: 5,
  titleMax: 80,
  termsMax: 300,
  maxDays: 60,
  maxClaims: 1000,
  /** Live or waiting deals per business at once. */
  perBusiness: 3,
  /** A claimed code works for this many days (or until the deal ends). */
  codeDays: 7,
};
/** What a player earns when a business marks their code used. */
export const DEAL_REWARD = { coins: 150, xp: 20 };
/** Deal rewards per player per Lagos day (more deals can be used, they just don't pay). */
export const DEAL_REWARDS_PER_DAY = 3;

/** Codes avoid look-alike characters (0/O, 1/I/L) so they're easy to read out at a counter. */
export const DEAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const DEAL_CODE = /^HC-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/;
export const normaliseDealCode = (raw: string) => {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `HC-${s.startsWith("HC") ? s.slice(2) : s}`;
};

export type DealStatus = "pending_review" | "live" | "rejected" | "ended";

export interface DealView {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  terms: string;
  endsAt: string;
  left: number;
  /** The viewer runs this business (owners can't claim their own deals). */
  own: boolean;
  /** The viewer's code, if they claimed one. */
  myCode: { code: string; expiresAt: string; redeemed: boolean } | null;
}

export interface OwnerDeal {
  id: string;
  title: string;
  terms: string;
  status: DealStatus;
  endsAt: string;
  maxClaims: number;
  claimed: number;
  redeemed: number;
  reviewNote: string | null;
}

export interface MyDealCode {
  code: string;
  expiresAt: string;
  redeemedAt: string | null;
  title: string;
  terms: string;
  businessName: string;
  pickupAddress: string | null;
  /** The claim (for reviewing the shop once it's redeemed). */
  claimId: string;
  /** Your review of the shop for this deal, if you left one. */
  review: { rating: number; body: string } | null;
}

export interface RedeemResult {
  title: string;
  /** The player's nickname, so the counter can greet them. */
  nickname: string;
  rewarded: boolean;
}

/** What we count for a business's dashboard. */
export const BUSINESS_EVENTS = ["card_open", "search_view", "whatsapp", "directions", "sponsor_view"] as const;
export type BusinessEvent = (typeof BUSINESS_EVENTS)[number];
export const BUSINESS_EVENT_LABEL: Record<BusinessEvent, string> = {
  card_open: "Opened your card on the map",
  search_view: "Saw you in Find a business",
  whatsapp: "Tapped WhatsApp",
  directions: "Went to you in the game",
  sponsor_view: "Saw your sponsorship at a place",
};

/** A place sponsored by a business ("Presented by …"). */
export interface SponsorView {
  venue: string;
  businessId: string;
  businessName: string;
  tagline: string;
  endsAt: string;
  /** The business has a building on the map (so "Visit" can take you there). */
  onMap: boolean;
  deals: number;
}

export interface BusinessDashboard {
  days: number;
  /** Totals for the period. */
  totals: Record<BusinessEvent, number>;
  /** One row per day, oldest first. */
  daily: { day: string; card_open: number; search_view: number; whatsapp: number; directions: number; sponsor_view: number }[];
  deals: { title: string; claimed: number; redeemed: number; status: string }[];
  quotes: { total: number; open: number; completed: number };
  onMap: boolean;
  verified: boolean;
}

// ── Pickup reservations: reserve a product, the shop confirms, you pay and collect at the shop. ──
export const RESERVE = {
  /** Hours the shop has to confirm. */
  confirmHours: 24,
  /** Hours you have to collect once confirmed. */
  holdHours: 48,
  maxQty: 10,
  /** Open reservations one player can have at once. */
  maxOpen: 3,
};
export type ReservationStatus = "requested" | "confirmed" | "declined" | "collected" | "cancelled" | "expired";
export interface ReservationView {
  id: string;
  code: string;
  product: string;
  priceKobo: number;
  qty: number;
  note: string;
  status: ReservationStatus;
  expiresAt: string;
  businessName: string;
  pickupAddress: string | null;
  /** Who reserved it (shown to the shop). */
  customer?: string;
}

// ── Jobs board: real vacancies from verified businesses; players apply with a message and a contact. ──
export const VACANCY_KINDS = [
  { key: "full_time", label: "Full-time" },
  { key: "part_time", label: "Part-time" },
  { key: "gig", label: "One-off gig" },
  { key: "apprenticeship", label: "Apprenticeship" },
] as const;
export type VacancyKind = (typeof VACANCY_KINDS)[number]["key"];
export interface VacancyView {
  id: string;
  businessId: string;
  businessName: string;
  verified: boolean;
  title: string;
  kind: VacancyKind;
  pay: string;
  area: string;
  description: string;
  wantsCertificate: boolean;
  status: "open" | "closed";
  createdAt: string;
  /** For the player: already applied. For the business: how many applied. */
  applied?: boolean;
  applications?: number;
}
export interface ApplicationView {
  id: string;
  nickname: string;
  message: string;
  contact: string;
  status: "new" | "shortlisted" | "declined";
  createdAt: string;
  /** Verified Academy certificates the applicant holds. */
  certificates: { number: string; courseTitle: string }[];
  /** Degrees from Lagoon City University (in the game). */
  degrees: string[];
}
