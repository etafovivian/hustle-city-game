// Rent, Lagos style. Tenants: move out of the face-me room into a self-contain, mini flat or flat in any area:
// pay four weeks up front plus the agent's fee and a week's caution (refunded when you move out properly). Rent is
// due every week after that; fall two weeks behind and the landlord changes the locks (you're back in the face-me
// room and lose the caution). Landlords: let out a house you own that isn't your home and collect weekly rent.
import { HOUSE_BY_KEY, plotPriceOf } from "./homes.js";

export type RentUnitKey = "rent_self_contain" | "rent_mini_flat" | "rent_flat";
export interface RentUnit {
  key: RentUnitKey;
  label: string;
  note: string;
  /** Weekly rent in a mid-priced area. */
  weekly: number;
}
export const RENT_UNITS: readonly RentUnit[] = [
  { key: "rent_self_contain", label: "Self-contain", note: "One room with your own toilet and kitchenette", weekly: 2_000 },
  { key: "rent_mini_flat", label: "Mini flat", note: "Parlour and a bedroom, prepaid meter", weekly: 4_500 },
  { key: "rent_flat", label: "2-bedroom flat", note: "Living room, two bedrooms, kitchen, parking", weekly: 9_000 },
];
export const RENT_UNIT_BY_KEY: ReadonlyMap<string, RentUnit> = new Map(RENT_UNITS.map((u) => [u.key, u]));

/** Area price factor: the Island and Lekki cost double, Ikodu and Ogun are cheap. */
export const RENT_AREA: Readonly<Record<string, number>> = {
  "Island Heights": 2,
  "Lekki Gardens": 2,
  "Marina Wharf": 1.5,
  "Tech Mile": 1.4,
  "Airport Ridge": 1.3,
  "Junction 101": 1,
  "Owambe Gardens": 1,
  "Danfo Terminal": 0.9,
  "Apapa Port": 0.9,
  "Ikodu Town": 0.7,
  // Ogun State
  Mowe: 0.5,
  Sagamu: 0.6,
  Abeokuta: 0.7,
  // Abuja
  Maitama: 2.8,
  Asokoro: 2.6,
  "Central Area": 2.2,
  Jabi: 1.8,
  Wuse: 1.6,
  Garki: 1.4,
  Kubwa: 0.6,
};
export const RENT_TERMS = { weeksUpFront: 4, agentFee: 0.1, cautionWeeks: 1, graceWeeks: 2 };
export const WEEK_MS = 7 * 86_400_000;

export const weeklyRent = (unit: RentUnitKey, area: string) => Math.round(((RENT_UNIT_BY_KEY.get(unit)?.weekly ?? 0) * (RENT_AREA[area] ?? 1)) / 50) * 50;
/** What moving in costs: rent up front, the agent's fee, and the caution deposit. */
export function moveInCost(unit: RentUnitKey, area: string) {
  const w = weeklyRent(unit, area);
  const rent = w * RENT_TERMS.weeksUpFront;
  const agent = Math.round((rent * RENT_TERMS.agentFee) / 10) * 10;
  const caution = w * RENT_TERMS.cautionWeeks;
  return { weekly: w, rent, agent, caution, total: rent + agent + caution };
}

/** Letting a house: about 3% of the house and 1% of the land a week; at most four weeks build up uncollected. */
export const LET_MAX_WEEKS = 4;
export function letRent(design: string, plotId: string) {
  const house = HOUSE_BY_KEY.get(design)?.price ?? 0;
  const land = plotPriceOf(plotId) ?? 0;
  return Math.round((house * 0.03 + land * 0.01) / 50) * 50;
}
/** Rent built up since `since` (weekly rent `weekly`), capped. */
export const rentDue = (weekly: number, since: Date, now: Date) => Math.floor((weekly * Math.min(now.getTime() - since.getTime(), LET_MAX_WEEKS * WEEK_MS)) / WEEK_MS);

export interface RentalView {
  unit: RentUnitKey;
  area: string;
  /** The building it's in (a home plot on the map). */
  plotId: string;
  weekly: number;
  caution: number;
  paidUntil: string;
  /** Weeks behind (0 when up to date). */
  owing: number;
}
