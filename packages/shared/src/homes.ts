// Homes: everyone starts with a rented room in a face-me-I-face-you; buy a plot with City Coins, pick a house for it,
// and it becomes your home on the map (with your name on it). Resting at home brings your energy back.
import { PLOTS_FOR_SALE } from "./plots.gen.js";
import { landPrice, type LandRoad } from "./land.js";

export interface HouseDesign {
  key: string;
  label: string;
  /** Building art in public/art/buildings. */
  art: string;
  /** City Coins to build it (on top of the land). */
  price: number;
  note: string;
}

/** Up the ladder: face-me room (free) → bungalow → storey house → duplex → villa. */
export const HOUSE_DESIGNS: readonly HouseDesign[] = [
  { key: "bungalow", label: "Bungalow", art: "bungalow", price: 30_000, note: "Two bedrooms, a veranda and a gate" },
  { key: "storey_house", label: "Storey house", art: "storey-house", price: 70_000, note: "One storey up, a balcony over the street" },
  { key: "family_compound", label: "Family compound", art: "family-compound", price: 90_000, note: "Room for the whole family and the aunties" },
  { key: "terrace_duplex", label: "Terrace duplex", art: "terrace-duplex", price: 140_000, note: "Modern duplex with parking" },
  { key: "villa", label: "Villa", art: "villa", price: 260_000, note: "Pool, palms and a big gate" },
];
export const HOUSE_BY_KEY: ReadonlyMap<string, HouseDesign> = new Map(HOUSE_DESIGNS.map((h) => [h.key, h]));

const PLOT_BY_ID = new Map(PLOTS_FOR_SALE.map(([id, area, road, hh]) => [id, { id, area, road: road as LandRoad, hh }]));
export const plotInfo = (id: string) => PLOT_BY_ID.get(id);
/** The land price of a plot for sale (the same figure the land card shows). */
export const plotPriceOf = (id: string) => {
  const p = PLOT_BY_ID.get(id);
  return p ? landPrice(p.area, p.road, p.hh) : null;
};

/** Resting at home: energy back, once every couple of hours. */
export const REST = { energy: 45, everyMs: 2 * 60 * 60_000 };
/** Changing your house design later costs the new design's price less this share of the old one. */
export const REBUILD_CREDIT = 0.5;

export interface HomeView {
  /** null: still in the starter room. */
  plotId: string | null;
  design: string | null;
  /** When resting will work again (ISO), or null if now. */
  restAgainAt: string | null;
}

export interface MapHome {
  plotId: string;
  design: string;
  nickname: string;
  mine: boolean;
}
