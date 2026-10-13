// Pet sprite sheets (public/art/life/pets, rendered by scripts/blender/agent/pets.py in the people's toon look and
// scale: 76 px per metre). Each sheet: 8 frames of 128x112 in a row; the ground (where the feet touch) is 18 px
// above the frame bottom, the pet centred on x. Parrot: walk = hops, sit = perched, plus fly (in the air, 4 ways);
// it has no play sheet.
export const PET_FRAME = { w: 128, h: 112, frames: 8, ground: 18 } as const;

export type PetKind = "dog_local" | "lhasa" | "boerboel" | "shepherd" | "cat_tabby" | "cat_black" | "parrot";
export type PetAction = "walk" | "sit" | "sleep" | "eat" | "play" | "fly";
const ALL4 = ["se", "sw", "ne", "nw"] as const;
const FRONT = ["se", "sw"] as const;
const QUAD = { walk: ALL4, sit: FRONT, sleep: FRONT, eat: FRONT, play: FRONT };

/** Which sheets exist, per kind and action: the directions rendered (others fall back to the nearest of se/sw). */
export const PET_SHEETS: Record<PetKind, Partial<Record<PetAction, readonly string[]>>> = {
  dog_local: QUAD,
  lhasa: QUAD,
  boerboel: QUAD,
  shepherd: QUAD,
  cat_tabby: QUAD,
  cat_black: QUAD,
  parrot: { walk: ALL4, sit: FRONT, sleep: FRONT, eat: FRONT, fly: ALL4 },
};

/** The sheet URL for a pet doing something facing a way, or null when that action has no sheet. */
export function petSheet(kind: PetKind, action: PetAction, dir: "se" | "sw" | "ne" | "nw"): string | null {
  const dirs = PET_SHEETS[kind]?.[action];
  if (!dirs) return null;
  const d = dirs.includes(dir) ? dir : dir === "ne" ? "se" : dir === "nw" ? "sw" : dirs[0]!;
  return `/art/life/pets/${kind}-${action}-${d}.webp`;
}
