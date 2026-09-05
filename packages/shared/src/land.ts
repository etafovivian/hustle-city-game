// Land for sale: open plots on the map with a permanent id (cityLayout makes them the same on every visit).
// Prices are in City Coins and follow Lagos: the Island and Lekki cost the most, a plot on a big road more than
// one on a close. Ownership opens later; for now players register interest and the owner follows up.
import type { BusinessHours } from "./services.js";

export type LandRoad = "arterial" | "collector" | "local" | "alley";

/** Coins per square metre in each area. */
export const LAND_RATE: Record<string, number> = {
  "Island Heights": 260,
  "Lekki Gardens": 200,
  "Marina Wharf": 150,
  "Tech Mile": 110,
  "Airport Ridge": 90,
  "Junction 101": 80,
  "Owambe Gardens": 70,
  "Apapa Port": 60,
  "Danfo Terminal": 45,
  // Outer mainland, across the lagoon: the cheapest land in the city
  "Ikodu Town": 35,
};
const ROAD_FACTOR: Record<LandRoad, number> = { arterial: 1.5, collector: 1.25, local: 1, alley: 0.8 };

/** Map units across a plot to metres: a typical Lagos plot (about 18 m × 36 m, 648 m²) is a half-side of ~54 units. */
export const plotSquareMetres = (halfSide: number) => Math.round(((halfSide * 2) / 4.2) ** 2 / 10) * 10;

export function landPrice(area: string, road: LandRoad, halfSide: number): number {
  const raw = plotSquareMetres(halfSide) * (LAND_RATE[area] ?? 60) * ROAD_FACTOR[road];
  return Math.round(raw / 1000) * 1000;
}

/** Areas where land is a premium (shown first in the land list). */
export const PRIME_AREAS = ["Island Heights", "Lekki Gardens"];

/** Plot ids from the area generator, e.g. "lekki-gardens-c2+4" (area, street line, side, index). */
export const PLOT_ID = /^[a-zA-Z0-9-]{3,40}[+-]\d{1,4}$/;

export interface LandInterestView {
  /** Players interested in each plot (only plots with at least one). */
  counts: Record<string, number>;
  /** Plots this player asked about. */
  mine: string[];
}

/** A business's building on a map plot. */
export interface MapBusiness {
  plotId: string;
  businessId: string;
  name: string;
  kind: "artisan" | "retail" | "office";
  category: string;
  verified: boolean;
  description: string;
  serviceArea: string;
  pickupAddress: string | null;
  contactPhone: string | null;
  products: { name: string; priceKobo: number }[];
  /** Live deals right now. */
  deals: number;
  hours: BusinessHours | null;
  /** Average stars (1-5, from finished jobs and redeemed deals) and how many reviews. */
  rating: number | null;
  reviews: number;
  /** A few recent review lines. */
  recent: { rating: number; body: string }[];
}

/** The building drawn for a business, by what it does. */
export const BUSINESS_ART: Record<string, string> = {
  generator_repair: "mechanic",
  phone_repair: "phone-shop",
  laptop_repair: "laptop-shop",
  ac_repair: "mechanic",
  electrician: "shop-house",
  plumber: "shop-house",
  tailor: "tailor-shop",
  event_decor: "shop-house",
  catering: "restaurant-terrace",
  hair_beauty: "salon",
  provisions: "shop-house",
  food_drinks: "restaurant-terrace",
  fashion_fabrics: "tailor-shop",
  phones_gadgets: "phone-shop",
  electronics: "gadget-kiosk",
  beauty_supplies: "salon",
  building_materials: "warehouse",
  books_stationery: "cyber-cafe",
  baby_kids: "shop-house",
  home_kitchen: "commercial-block",
  pos_agent: "gadget-kiosk",
  dispatch_rider: "shop-house",
  laundry: "shop-house",
  cleaning: "shop-house",
  solar_inverter: "commercial-block",
  gas_refill: "shop-house",
  printing: "cyber-cafe",
  tutor: "cyber-cafe",
  car_wash: "mechanic",
  mechanic: "mechanic",
  pharmacy: "chemist",
};
export const businessArt = (category: string) => `/art/buildings/${BUSINESS_ART[category] ?? "shop-house"}.webp`;
