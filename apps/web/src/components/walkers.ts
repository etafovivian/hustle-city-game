// Walk-cycle sprite sheets rendered from the 3D bodies (public/art/life/walkers, see its LICENSE.txt):
// 8 frames of 96×160 px per direction; feet on a ground line 16 px above the frame bottom; 76 px per metre.
export type WalkerVariant = "woman_buba" | "woman_gele" | "man_kaftan" | "man_casual" | "schoolgirl" | "schoolboy";
export type WalkDir = "se" | "sw" | "ne" | "nw";

export const WALKER_VARIANTS: WalkerVariant[] = ["woman_buba", "man_kaftan", "schoolgirl", "man_casual", "woman_gele", "schoolboy"];

const FRAME_PX = { w: 96, h: 160, ground: 16 };
/** World units per sprite pixel so an adult (~124 px) stands about `adultHeight` world units tall. */
export function walkerSize(adultHeight: number) {
  const s = adultHeight / 124;
  return { w: FRAME_PX.w * s, h: FRAME_PX.h * s, ground: FRAME_PX.ground * s, frames: 8 };
}

/** Which sheet to use for a movement (screen down = towards the viewer). */
export const walkDir = (dx: number, dy: number): WalkDir => (dy > 0 ? (dx >= 0 ? "se" : "sw") : dx >= 0 ? "ne" : "nw");

export const walkerSheet = (v: WalkerVariant, d: WalkDir) => `/art/life/walkers/${v}-${d}.webp`;
