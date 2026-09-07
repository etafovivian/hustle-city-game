// Homes: everyone starts with a rented room in a face-me-I-face-you; buy a plot with City Coins, pick a house for it,
// and it becomes your home on the map (with your name on it). Resting at home brings your energy back.
import { PLOTS_FOR_SALE } from "./plots.gen.js";
import { landPrice, type LandRoad } from "./land.js";
import type { RentalView } from "./rent.js";

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

/** Plots one player can own at once (land or houses). */
export const MAX_PLOTS = 5;

export interface HomeItem {
  key: string;
  name: string;
  price: number;
  /** Extra energy every rest at home. */
  comfort: number;
  art: string;
}
/** Things for the house: bought once each, shown in your rooms, and each makes resting a bit better. */
export const HOME_ITEMS: readonly HomeItem[] = [
  { key: "plastic_chairs", name: "Plastic chairs", price: 2_000, comfort: 1, art: "/art/furniture/plastic-chair-classic.webp" },
  { key: "bucket_set", name: "Bucket and bowl set", price: 1_500, comfort: 1, art: "/art/furniture/bucket-set.webp" },
  { key: "standing_fan", name: "Standing fan", price: 8_000, comfort: 4, art: "/art/furniture/standing-fan.webp" },
  { key: "sofa_ankara", name: "Sofa with Ankara cushions", price: 25_000, comfort: 5, art: "/art/furniture/sofa-ankara-cushions.webp" },
  { key: "generator_small", name: "Small generator (I better pass my neighbour)", price: 35_000, comfort: 6, art: "/art/furniture/generator-small.webp" },
  { key: "adire_sofa_set", name: "Adire lounge set", price: 90_000, comfort: 8, art: "/art/furniture/adire-sofa-set.webp" },
  { key: "big_generator", name: "Big generator (24/7 light)", price: 150_000, comfort: 10, art: "/art/furniture/generator-34.webp" },
  { key: "water_tank", name: "Water tank (no more fetching)", price: 60_000, comfort: 6, art: "/art/props/water-tank.webp" },
  { key: "dumbbell_set", name: "Dumbbell set (work out at home)", price: 15_000, comfort: 0, art: "/art/furniture/dumbbells.svg" },
  { key: "punching_bag", name: "Punching bag (box at home)", price: 25_000, comfort: 0, art: "/art/furniture/punching-bag.svg" },
];
/** Working out at home: with dumbbells or a punching bag, once every couple of hours. */
export const WORKOUT = { items: ["dumbbell_set", "punching_bag"], health: 20, fun: 6, energy: 12, fitness: 8, everyMs: 2 * 60 * 60_000 };
export const HOME_ITEM_BY_KEY: ReadonlyMap<string, HomeItem> = new Map(HOME_ITEMS.map((i) => [i.key, i]));
/** Energy from resting at home with these things. */
export const restEnergy = (items: readonly string[]) => Math.min(80, REST.energy + items.reduce((n, k) => n + (HOME_ITEM_BY_KEY.get(k)?.comfort ?? 0), 0));

export interface OwnedPlot {
  plotId: string;
  /** House design, or null for empty land. */
  design: string | null;
  isHome: boolean;
  /** Let out to a tenant: weekly rent and what's built up to collect. */
  let?: { weekly: number; due: number } | null;
}

export interface HomeView {
  /** Your home plot; null while you're still in the starter room. */
  plotId: string | null;
  design: string | null;
  plots: OwnedPlot[];
  items: string[];
  /** Where you put each item (room key and spot); missing = its default spot. */
  placements: Record<string, { room: string; x: number; y: number }>;
  /** Energy a rest gives you now. */
  restEnergy: number;
  /** When resting will work again (ISO), or null if now. */
  restAgainAt: string | null;
  /** The flat you rent (your home when you don't live in a house you own). */
  rental: RentalView | null;
}

export interface MapHome {
  plotId: string;
  /** House design, or null for land bought but not built on. */
  design: string | null;
  nickname: string;
  mine: boolean;
  isHome: boolean;
}
