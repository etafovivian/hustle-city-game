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
}

export interface RedeemResult {
  title: string;
  /** The player's nickname, so the counter can greet them. */
  nickname: string;
  rewarded: boolean;
}
