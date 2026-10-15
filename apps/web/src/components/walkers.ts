// Walk-cycle sprite sheets rendered from the 3D bodies (public/art/life/walkers, see its LICENSE.txt):
// 8 frames of 96×160 px per direction; feet on a ground line 16 px above the frame bottom; 76 px per metre.
/** The first six looks (street NPCs, children, and the fallback for players). */
export type LegacyVariant = "woman_buba" | "woman_gele" | "man_kaftan" | "man_casual" | "schoolgirl" | "schoolboy";
/** One look per body and outfit a player can wear (profile.ts LOOK_ORDER), painted in the outfit's own colours. */
export const OUTFIT_VARIANTS = [
  "man-agbada_white",
  "man-kaftan_gold",
  "man-ankara_green",
  "man-jersey_red",
  "man-tee_blue",
  "man-hoodie_black",
  "woman-buba_wrapper",
  "woman-peplum_coral",
  "woman-ankara_green",
  "woman-kaftan_gold",
  "woman-tee_blue",
  "woman-jersey_red",
  "woman-hoodie_black",
] as const;
export type OutfitVariant = (typeof OUTFIT_VARIANTS)[number];
/**
 * People at work in uniform (scripts/blender/agent/sprites.py STAFF_VARIANTS): a nurse in light-blue scrubs and cap, a
 * doctor in a white coat with a stethoscope, a chef in whites and a toque, a waiter in a black waistcoat and long white
 * apron, a barman in a dark shirt with rolled sleeves and a leather apron, a delivery rider in an open-face helmet and
 * a plain green jacket with a box bag. Only for staff in rooms (Room.workers and
 * stations): never on the street.
 */
export const STAFF_VARIANTS = ["nurse", "doctor", "chef", "waiter", "bartender", "rider"] as const;
export type StaffVariant = (typeof STAFF_VARIANTS)[number];
export type WalkerVariant = LegacyVariant | OutfitVariant | StaffVariant;
/** Everyday looks: anyone in the street or milling about in a room. */
export type StreetVariant = Exclude<WalkerVariant, StaffVariant>;
export type WalkDir = "se" | "sw" | "ne" | "nw";

const OUTFIT_SET = new Set<string>(OUTFIT_VARIANTS);
/** The rendered look for a body and outfit, if there is one. */
export const outfitVariant = (body: "man" | "woman", outfit: string): OutfitVariant | null =>
  OUTFIT_SET.has(`${body}-${outfit}`) ? (`${body}-${outfit}` as OutfitVariant) : null;

/**
 * Who walks the streets (and rooms), in turn: half of them in modern clothes (tees and jeans, jerseys, hoodies), the
 * rest in traditional dress, with school children among them. No uniforms (StreetVariant): staff looks are for workers.
 */
export const WALKER_VARIANTS: StreetVariant[] = [
  "man-tee_blue",
  "woman_buba",
  "woman-jersey_red",
  "man_kaftan",
  "man-hoodie_black",
  "schoolgirl",
  "woman-tee_blue",
  "man-agbada_white",
  "man_casual",
  "woman-peplum_coral",
  "woman-hoodie_black",
  "schoolboy",
  "man-jersey_red",
  "woman-ankara_green",
  "man-tee_blue",
  "woman_gele",
  "woman-jersey_red",
  "man-ankara_green",
];

const FRAME_PX = { w: 96, h: 160, ground: 16 };
/** World units per sprite pixel so an adult (~124 px) stands about `adultHeight` world units tall. */
export function walkerSize(adultHeight: number) {
  const s = adultHeight / 124;
  return { w: FRAME_PX.w * s, h: FRAME_PX.h * s, ground: FRAME_PX.ground * s, frames: 8 };
}

/** Which sheet to use for a movement (screen down = towards the viewer). */
export const walkDir = (dx: number, dy: number): WalkDir => (dy > 0 ? (dx >= 0 ? "se" : "sw") : dx >= 0 ? "ne" : "nw");

export const walkerSheet = (v: WalkerVariant, d: WalkDir) => `/art/life/walkers/${v}-${d}.webp`;
