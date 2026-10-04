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
  /** When you last did each thing at home (HOME_ACTIONS key → ISO time), for cooldowns and "eat what you cooked". */
  actsDoneAt?: Record<string, string>;
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
/** Things in a room that you do something with. */
export type HomeObject = "cooker" | "tv" | "screen" | "seat" | "table" | "wardrobe" | "bucket" | "line" | "garden" | "pool" | "shower" | "radio" | "floor";
/** Where you stand (or sit) to use it, as fractions of the room picture, and which way you face. */
export interface ObjectSpot {
  at: [number, number];
  dir: "se" | "sw" | "ne" | "nw";
  /** Seated at a table (or a counter, on a stool): eat with the plate on it. A number is the height of the table's
   * near edge, when you sit on its far side and it hides your legs. */
  table?: number | true;
  /** A screen's corners (top-left, top-right, bottom-right, bottom-left), for the moving picture. */
  screen?: [[number, number], [number, number], [number, number], [number, number]];
}
/**
 * What each home room (by its picture) already has: a kitchen has a cooker, the villa cinema a big screen, the
 * compound yard a clothesline. Actions use these without buying anything; a thing you buy adds what a room lacks.
 */
export const HOME_OBJECTS: Record<string, Partial<Record<HomeObject, ObjectSpot>>> = {
  "home-face-me": {
    cooker: { at: [0.58, 0.855], dir: "sw" },
    bucket: { at: [0.24, 0.745], dir: "sw" },
    radio: { at: [0.7, 0.75], dir: "se" },
    wardrobe: { at: [0.72, 0.62], dir: "ne" },
    seat: { at: [0.375, 0.8], dir: "se" },
    floor: { at: [0.6, 0.78], dir: "se" },
  },
  "home-self-contain": {
    cooker: { at: [0.545, 0.5], dir: "ne" },
    // The set faces the bed (we see its back): the picture shows on the edge of the screen.
    tv: { at: [0.46, 0.72], dir: "se", screen: [[0.689, 0.642], [0.702, 0.636], [0.704, 0.725], [0.691, 0.728]] },
    wardrobe: { at: [0.85, 0.71], dir: "ne" },
    seat: { at: [0.46, 0.72], dir: "se" },
    floor: { at: [0.55, 0.75], dir: "se" },
  },
  "home-mini-flat": {
    tv: { at: [0.4, 0.69], dir: "se", screen: [[0.709, 0.345], [0.866, 0.418], [0.862, 0.513], [0.707, 0.447]] },
    seat: { at: [0.4, 0.69], dir: "se" },
    table: { at: [0.5, 0.645], dir: "se" },
    floor: { at: [0.72, 0.78], dir: "se" },
  },
  "home-bedroom": {
    wardrobe: { at: [0.57, 0.64], dir: "ne" },
    seat: { at: [0.24, 0.7], dir: "sw" },
    floor: { at: [0.55, 0.75], dir: "se" },
  },
  "home-kitchen": {
    cooker: { at: [0.3, 0.665], dir: "nw" },
    table: { at: [0.855, 0.64], dir: "sw", table: 0.61 },
    floor: { at: [0.5, 0.7], dir: "se" },
  },
  "home-compound-yard": {
    bucket: { at: [0.36, 0.53], dir: "nw" },
    line: { at: [0.78, 0.53], dir: "ne" },
    garden: { at: [0.495, 0.44], dir: "ne" },
    seat: { at: [0.625, 0.48], dir: "sw" },
    floor: { at: [0.5, 0.6], dir: "se" },
  },
  "home-duplex": {
    seat: { at: [0.47, 0.725], dir: "se" },
    table: { at: [0.24, 0.6], dir: "se", table: 0.585 },
    floor: { at: [0.72, 0.76], dir: "se" },
  },
  "home-duplex-bedroom": {
    tv: { at: [0.5, 0.62], dir: "sw", screen: [[0.059, 0.425], [0.217, 0.343], [0.217, 0.467], [0.06, 0.553]] },
    wardrobe: { at: [0.8, 0.74], dir: "ne" },
    seat: { at: [0.5, 0.62], dir: "sw" },
    floor: { at: [0.45, 0.78], dir: "se" },
  },
  "home-mansion": {
    seat: { at: [0.4, 0.7], dir: "se" },
    table: { at: [0.54, 0.6], dir: "se" },
    floor: { at: [0.74, 0.82], dir: "se" },
  },
  "home-villa-suite": {
    wardrobe: { at: [0.18, 0.62], dir: "nw" },
    seat: { at: [0.76, 0.72], dir: "sw" },
    floor: { at: [0.5, 0.72], dir: "se" },
  },
  "home-villa-kitchen": {
    cooker: { at: [0.395, 0.51], dir: "nw" },
    table: { at: [0.48, 0.6], dir: "ne", table: true },
    floor: { at: [0.35, 0.74], dir: "se" },
  },
  "home-villa-cinema": {
    screen: { at: [0.76, 0.62], dir: "sw", screen: [[0.124, 0.302], [0.416, 0.142], [0.416, 0.382], [0.123, 0.551]] },
    seat: { at: [0.76, 0.62], dir: "sw" },
    floor: { at: [0.45, 0.7], dir: "se" },
  },
  "home-villa-pool": {
    pool: { at: [0.5, 0.78], dir: "se" },
    shower: { at: [0.8, 0.73], dir: "sw" },
    seat: { at: [0.78, 0.66], dir: "sw" },
    table: { at: [0.64, 0.475], dir: "ne", table: true },
    floor: { at: [0.5, 0.55], dir: "se" },
  },
};
/** Things you can buy that bring an object into the house (when the room doesn't have it already). */
export const ITEM_OBJECT: Readonly<Record<string, HomeObject>> = {
  gas_cooker: "cooker",
  flat_tv: "tv",
  radio: "radio",
  bucket_set: "bucket",
  water_tank: "bucket",
  sofa_ankara: "seat",
  adire_sofa_set: "seat",
  plastic_chairs: "seat",
};
/** What a house can do: objects in its rooms (by picture), plus what the things you own bring. */
export function houseObjects(roomArts: readonly string[], items: readonly string[]): Set<HomeObject> {
  const out = new Set<HomeObject>(["floor"]);
  for (const art of roomArts) for (const k of Object.keys(HOME_OBJECTS[art] ?? {})) out.add(k as HomeObject);
  for (const i of items) if (ITEM_OBJECT[i]) out.add(ITEM_OBJECT[i]!);
  return out;
}
/** Selling something back for the house returns this share of its price. */
export const SELL_BACK = 0.5;

/**
 * Things to do at home, each with a real effect, done at a thing in the house (`uses`: any one of these objects; the
 * room's own, or one you bought). Some also need a thing you own (`needs`: the console for games). Each has its own
 * cooldown and the server checks all of it. `pose` is what your character does there.
 */
export interface HomeAction {
  key: string;
  label: string;
  icon: string;
  /** What it does, shown on the button. */
  note: string;
  uses: readonly HomeObject[];
  needs?: readonly string[];
  /** Coins it costs (foodstuff, a delivery). */
  cost?: number;
  gives: Partial<Record<"food" | "energy" | "fun" | "social" | "health" | "style", number>>;
  skill?: readonly ["charisma" | "fitness" | "cooking" | "tech" | "business", number];
  xp?: number;
  /** Minutes before it can be done again. */
  every: number;
  /** Only within this many minutes after another action (eating what you cooked). */
  after?: { action: string; within: number };
  /** What the player does in the room (Interior PlayerAction): its pose and the spot it goes to. */
  pose: "sit" | "eat" | "dance" | "stand" | "pray" | "chair" | "cook" | "bath" | "laundry" | "sweep" | "water_plants" | "phone" | "games" | "swim" | "dress";
  /** What plays on a screen while you do it. */
  shows?: "tv" | "film" | "game";
}

export const HOME_ACTIONS: readonly HomeAction[] = [
  { key: "cook", label: "Cook a pot of jollof", icon: "🍳", note: "400 coins of foodstuff · ++Food · Cooking", uses: ["cooker"], cost: 400, gives: { food: 30 }, skill: ["cooking", 8], xp: 4, every: 180, pose: "cook" },
  { key: "leftovers", label: "Eat what you cooked", icon: "🍲", note: "Free · +Food", uses: ["table", "seat"], gives: { food: 20 }, every: 60, after: { action: "cook", within: 240 }, pose: "eat" },
  { key: "order", label: "Order food (Chop Express)", icon: "🛵", note: "700 coins · a rider brings it · ++Food", uses: ["table", "seat", "floor"], cost: 700, gives: { food: 30 }, every: 60, pose: "eat" },
  { key: "tv", label: "Watch TV", icon: "📺", note: "+Fun", uses: ["tv"], gives: { fun: 15 }, every: 60, pose: "sit", shows: "tv" },
  { key: "film", label: "Watch a film", icon: "🎬", note: "++Fun", uses: ["screen"], gives: { fun: 25, social: 3 }, every: 120, pose: "sit", shows: "film" },
  { key: "games", label: "Play video games", icon: "🎮", note: "+Fun · Tech", uses: ["screen", "tv"], needs: ["game_console"], gives: { fun: 18, energy: -3 }, skill: ["tech", 4], every: 60, pose: "games", shows: "game" },
  { key: "swim", label: "Swim in your pool", icon: "🏊🏾", note: "+Health +Fun · Fitness", uses: ["pool"], gives: { health: 10, fun: 10, energy: -5 }, skill: ["fitness", 6], every: 120, pose: "swim" },
  { key: "bath", label: "Bath", icon: "🚿", note: "+Health +Style", uses: ["shower", "bucket"], gives: { health: 6, style: 10 }, every: 60, pose: "bath" },
  { key: "dress", label: "Change your clothes", icon: "👗", note: "Opens your wardrobe · +Style", uses: ["wardrobe"], gives: { style: 12 }, every: 120, pose: "dress" },
  { key: "pray", label: "Pray", icon: "🙏🏾", note: "+Energy, a calm mind", uses: ["floor"], gives: { energy: 5, fun: 3 }, every: 60, pose: "pray" },
  { key: "call", label: "Call someone", icon: "📞", note: "Pick who · +Social", uses: ["floor"], gives: { social: 12 }, every: 180, pose: "phone" },
  { key: "clean", label: "Sweep and tidy up", icon: "🧹", note: "+Health · XP", uses: ["floor"], gives: { health: 4, energy: -3 }, xp: 5, every: 360, pose: "sweep" },
  { key: "laundry", label: "Wash your clothes", icon: "🧺", note: "+Style", uses: ["line", "bucket"], gives: { style: 8, energy: -4 }, every: 240, pose: "laundry" },
  { key: "garden", label: "Tend the plantain and pepper", icon: "🌿", note: "+Health +Fun", uses: ["garden"], gives: { health: 6, fun: 4 }, every: 180, pose: "water_plants" },
  { key: "radio_dance", label: "Dance to the radio", icon: "💃🏾", note: "+Fun", uses: ["radio"], gives: { fun: 10, energy: -4 }, every: 60, pose: "dance" },
  { key: "relax", label: "Sit and relax", icon: "🛋️", note: "+Energy", uses: ["seat"], gives: { energy: 5, fun: 2 }, every: 30, pose: "sit" },
];
export const HOME_ACTION_BY_KEY: ReadonlyMap<string, HomeAction> = new Map(HOME_ACTIONS.map((a) => [a.key, a]));
