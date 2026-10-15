// Gadget Village (a quarter of Airport Ridge, modelled on Lagos's big phone and computer market): buy a better phone
// or accessories, haggle with the traders, and fix a cracked screen. What you own lives in player_items (one row per
// thing). Everyone starts with a basic phone; a better one replaces it. A screen cracks when the area boys catch you
// running or standing your ground (a phone case saves it). With Tech level 3 or more you fix your own screen for the
// price of the parts. Prices are City Coins and sit with the city's other things (an okada is 20,000, a standing fan
// 8,000, an umbrella 800).

export type GadgetKind = "phone" | "accessory";
export interface Gadget {
  key: string;
  kind: GadgetKind;
  name: string;
  icon: string;
  price: number;
  note: string;
  /** Phones: higher is better (the basic phone everyone starts with is 0). */
  tier?: number;
}

export const GADGETS: readonly Gadget[] = [
  { key: "phone_mid", kind: "phone", tier: 1, name: "Mid-range smartphone", icon: "📱", price: 18_000, note: "Big screen, good camera, battery that lasts the day" },
  { key: "phone_flagship", kind: "phone", tier: 2, name: "Flagship phone", icon: "📲", price: 60_000, note: "The one everybody at the lounge wants to hold" },
  { key: "phone_case", kind: "accessory", name: "Rugged phone case", icon: "🛡️", price: 1_500, note: "Your screen survives the next fall" },
  { key: "screen_guard", kind: "accessory", name: "Screen guard", icon: "🪟", price: 1_000, note: "No more scratches" },
  { key: "earbuds", kind: "accessory", name: "Wireless earbuds", icon: "🎧", price: 4_000, note: "Afrobeats in traffic" },
  { key: "power_bank", kind: "accessory", name: "Power bank (20,000 mAh)", icon: "🔋", price: 6_000, note: "For when NEPA takes light" },
];
export const GADGET_BY_KEY: ReadonlyMap<string, Gadget> = new Map(GADGETS.map((g) => [g.key, g]));

/** The player_items row for a cracked screen (deleted when it's fixed). */
export const CRACKED = "screen_cracked";
/** The phone everyone starts with. */
export const BASIC_PHONE = { name: "Basic phone", icon: "📞", tier: 0 };

/** A new screen, by the phone it goes on. */
export const REPAIR_PRICE = [2_000, 4_000, 12_000] as const;
/** Tech level from which you fix it yourself, paying only for the part. */
export const SELF_REPAIR_LEVEL = 3;
export const PARTS_SHARE = 0.4;
export function repairPrice(tier: number, techLevel: number) {
  const full = REPAIR_PRICE[Math.max(0, Math.min(2, tier))]!;
  return techLevel >= SELF_REPAIR_LEVEL ? Math.round((full * PARTS_SHARE) / 50) * 50 : full;
}
/** A good new phone lifts your Style (once, when you buy it); accessories a little Fun. */
export const GADGET_NEEDS = { phone: { style: 15, fun: 10 }, accessory: { fun: 5 } } as const;

/** The phone you carry: your best owned phone, or the basic one. */
export function phoneOf(owned: readonly string[]) {
  return GADGETS.filter((g) => g.kind === "phone" && owned.includes(g.key)).sort((p, q) => (q.tier ?? 0) - (p.tier ?? 0))[0] ?? null;
}
export const phoneTier = (owned: readonly string[]) => phoneOf(owned)?.tier ?? 0;

/** Can this be bought now? null if yes, else why not. */
export function cannotBuy(key: string, owned: readonly string[]): string | null {
  const g = GADGET_BY_KEY.get(key);
  if (!g) return "Nobody sells that here.";
  if (owned.includes(key)) return "You already have one.";
  if (g.kind === "phone" && (g.tier ?? 0) <= phoneTier(owned)) return "Your phone is already better than this one.";
  return null;
}

// ── Haggling ──
/** Offers per item per Lagos day. */
export const GADGET_HAGGLE_TRIES = 3;
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
/** The lowest the trader takes from you today (75–92% of the tag). Kept on the server. */
export function gadgetFloor(userId: string, day: string, key: string) {
  const g = GADGET_BY_KEY.get(key);
  if (!g) return null;
  return Math.ceil(g.price * (0.75 + 0.17 * hash(`${userId}|${day}|gadget|${key}`)));
}

export interface GadgetsView {
  owned: string[];
  /** Your phone's tier (0 = the basic phone). */
  phone: number;
  cracked: boolean;
  techLevel: number;
  repairPrice: number;
}
export type GadgetHaggleResult =
  | { result: "deal"; paid: number; saved: number; triesLeft: number; balance: number; view: GadgetsView }
  | { result: "counter"; counter: number; line: string; triesLeft: number }
  | { result: "walked"; line: string; triesLeft: number };
