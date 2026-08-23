// NEPA: areas lose light in two-hour slots, more often in some areas than others (the Island and Lekki have better
// supply than Danfo and Apapa). The same for everyone. During a cut, sleeping at home gives half the energy unless
// you own a generator, and the area goes dark on the map at night.

/** Chance of a cut in any two-hour slot, by area. */
export const OUTAGE_CHANCE: Record<string, number> = {
  "Island Heights": 0.12,
  "Lekki Gardens": 0.15,
  "Marina Wharf": 0.2,
  "Airport Ridge": 0.22,
  "Tech Mile": 0.25,
  "Junction 101": 0.3,
  "Owambe Gardens": 0.33,
  "Apapa Port": 0.4,
  "Danfo Terminal": 0.42,
};
export const GENERATORS = ["generator_small", "big_generator"];

function rnd(n: number) {
  let t = (n * 2654435761) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const areaSeed = (area: string) => [...area].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Has this area got light right now? */
export function hasLight(area: string, at: Date): boolean {
  const slot = Math.floor(at.getTime() / 7_200_000);
  return rnd(slot * 131 + areaSeed(area)) >= (OUTAGE_CHANCE[area] ?? 0.3);
}

export const areasWithoutLight = (at: Date) => Object.keys(OUTAGE_CHANCE).filter((a) => !hasLight(a, at));

/** When the light comes back (the end of this two-hour slot). */
export const lightBackAt = (at: Date) => new Date((Math.floor(at.getTime() / 7_200_000) + 1) * 7_200_000);
