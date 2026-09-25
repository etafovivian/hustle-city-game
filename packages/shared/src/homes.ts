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
  { key: "dumbbell_set", name: "Dumbbell set (work out at home)", price: 15_000, comfort: 0, art: "/art/props/dumbbells.webp" },
  { key: "punching_bag", name: "Punching bag (box at home)", price: 25_000, comfort: 0, art: "/art/props/punching-bag.webp" },
  { key: "radio", name: "Radio (dance at home)", price: 5_000, comfort: 0, art: "/art/furniture/radio.svg" },
  { key: "prayer_mat", name: "Prayer mat", price: 3_000, comfort: 1, art: "/art/furniture/prayer-mat.svg" },
  { key: "gas_cooker", name: "Gas cooker (cook at home)", price: 20_000, comfort: 1, art: "/art/furniture/gas-cooker.svg" },
  { key: "flat_tv", name: "Flat-screen TV", price: 45_000, comfort: 2, art: "/art/furniture/flat-tv.svg" },
  { key: "game_console", name: "Game console", price: 60_000, comfort: 1, art: "/art/furniture/game-console.svg" },
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

// ---------------------------------------------------------------- life at home
/**
 * Things to do at home, each with a real effect: Food from cooking, Fun from the TV, Style from a bath… Some need
 * something you own (a cooker, a TV) or a room (the villa's pool and cinema, the compound yard); each has its own
 * cooldown, and the server checks all of it. `pose` is what your character does in the room.
 */
export interface HomeAction {
  key: string;
  label: string;
  icon: string;
  /** What it does, shown on the button. */
  note: string;
  /** Needs one of these things in the house. */
  needs?: readonly string[];
  /** Only in rooms with these keys (from HOME_ROOMS). */
  rooms?: readonly string[];
  /** Coins it costs (foodstuff, a delivery). */
  cost?: number;
  gives: Partial<Record<"food" | "energy" | "fun" | "social" | "health" | "style", number>>;
  skill?: readonly ["charisma" | "fitness" | "cooking" | "tech" | "business", number];
  xp?: number;
  /** Minutes before it can be done again. */
  every: number;
  /** Only within this many minutes after another action (eating what you cooked). */
  after?: { action: string; within: number };
  pose: "sit" | "eat" | "dance" | "stand" | "pray" | "chair";
}

export const HOME_ACTIONS: readonly HomeAction[] = [
  { key: "cook", label: "Cook a pot of jollof", icon: "🍳", note: "400 coins of foodstuff · ++Food · Cooking", needs: ["gas_cooker"], cost: 400, gives: { food: 30 }, skill: ["cooking", 8], xp: 4, every: 180, pose: "stand" },
  { key: "leftovers", label: "Eat what you cooked", icon: "🍲", note: "Free · +Food", needs: ["gas_cooker"], gives: { food: 20 }, every: 60, after: { action: "cook", within: 240 }, pose: "eat" },
  { key: "order", label: "Order food (Chop Express)", icon: "🛵", note: "700 coins · ++Food", cost: 700, gives: { food: 30 }, every: 60, pose: "eat" },
  { key: "tv", label: "Watch TV", icon: "📺", note: "+Fun", needs: ["flat_tv"], gives: { fun: 15 }, every: 60, pose: "sit" },
  { key: "film", label: "Watch a film", icon: "🎬", note: "++Fun", rooms: ["cinema"], gives: { fun: 25, social: 3 }, every: 120, pose: "sit" },
  { key: "swim", label: "Swim in your pool", icon: "🏊🏾", note: "+Health +Fun · Fitness", rooms: ["pool"], gives: { health: 10, fun: 10, energy: -5 }, skill: ["fitness", 6], every: 120, pose: "stand" },
  { key: "bath", label: "Bucket bath", icon: "🪣", note: "+Health +Style", needs: ["bucket_set", "water_tank"], gives: { health: 6, style: 10 }, every: 60, pose: "stand" },
  { key: "dress", label: "Dress up in the mirror", icon: "👔", note: "+Style", gives: { style: 12 }, every: 120, pose: "stand" },
  { key: "pray", label: "Pray at home", icon: "🙏🏾", note: "+Energy, a calm mind", needs: ["prayer_mat"], gives: { energy: 5, fun: 3 }, every: 60, pose: "pray" },
  { key: "games", label: "Play video games", icon: "🎮", note: "+Fun · Tech", needs: ["game_console"], gives: { fun: 18, energy: -3 }, skill: ["tech", 4], every: 60, pose: "sit" },
  { key: "call", label: "Call your family", icon: "📞", note: "Free · +Social", gives: { social: 12 }, every: 180, pose: "stand" },
  { key: "clean", label: "Clean the house", icon: "🧹", note: "+Health · XP", gives: { health: 4, energy: -3 }, xp: 5, every: 360, pose: "stand" },
  { key: "laundry", label: "Wash your clothes", icon: "🧺", note: "+Style", needs: ["bucket_set", "water_tank"], gives: { style: 8, energy: -4 }, every: 240, pose: "stand" },
  { key: "garden", label: "Tend the plantain and pepper", icon: "🌿", note: "+Health +Fun", rooms: ["yard"], gives: { health: 6, fun: 4 }, every: 180, pose: "stand" },
  { key: "radio_dance", label: "Dance to the radio", icon: "💃🏾", note: "+Fun", needs: ["radio"], gives: { fun: 10, energy: -4 }, every: 60, pose: "dance" },
  { key: "relax", label: "Sit and relax", icon: "🛋️", note: "+Energy", gives: { energy: 5, fun: 2 }, every: 30, pose: "sit" },
];
export const HOME_ACTION_BY_KEY: ReadonlyMap<string, HomeAction> = new Map(HOME_ACTIONS.map((a) => [a.key, a]));
