// Onboarding choices: a player's hustle (trade) and long-term dream.
// The hustle has one real, server-enforced effect: the free starter stock the shop opens with.

export interface Hustle {
  key: string;
  title: string;
  pitch: string;
  /** Free stock placed in the new shop (no coins charged). */
  starter: { itemKey: string; units: number };
  starterLabel: string;
}

export const HUSTLES: readonly Hustle[] = [
  {
    key: "trader",
    title: "Market trader",
    pitch: "Buy low, sell sharp. You know every customer by name.",
    starter: { itemKey: "pure_water", units: 20 },
    starterLabel: "Opens with 20 sachets of pure water",
  },
  {
    key: "chop",
    title: "Chop seller",
    pitch: "Hot puff-puff, cold drinks. Your queue never ends.",
    starter: { itemKey: "puff_puff", units: 10 },
    starterLabel: "Opens with 10 packs of puff-puff",
  },
  {
    key: "gadget",
    title: "Gadget plug",
    pitch: "Recharge cards, chargers, cases — if it has a battery, you sell it.",
    starter: { itemKey: "recharge_card", units: 2 },
    starterLabel: "Opens with 2 recharge cards",
  },
  {
    key: "artisan",
    title: "Fix-it artisan",
    pitch: "Phones, gens, anything with a screw. Your hands pay the bills.",
    starter: { itemKey: "phone_case", units: 1 },
    starterLabel: "Opens with 1 phone case",
  },
];

export interface Dream {
  key: string;
  title: string;
  goal: string;
}

export const DREAMS: readonly Dream[] = [
  { key: "market_royalty", title: "Market Royalty", goal: "Serve 100 customers at your counter." },
  { key: "showroom", title: "Showroom Owner", goal: "Earn 50,000 City Coins from sales." },
  { key: "junction_legend", title: "Junction Legend", goal: "Finish a week at the top of the standings." },
  { key: "padi", title: "Everybody's Padi", goal: "Make 5 friends in Junction 101 (when friends open)." },
];

export const HUSTLES_BY_KEY: ReadonlyMap<string, Hustle> = new Map(HUSTLES.map((h) => [h.key, h]));
export const DREAMS_BY_KEY: ReadonlyMap<string, Dream> = new Map(DREAMS.map((d) => [d.key, d]));

export const SHOP_NAME_PATTERN = /^[A-Za-z0-9 _'&.\-]{3,30}$/;

export function checkShopName(name: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = name.trim();
  if (!SHOP_NAME_PATTERN.test(trimmed)) {
    return { ok: false, reason: "Use 3–30 letters, numbers, spaces or _ ' & . -" };
  }
  return { ok: true };
}
