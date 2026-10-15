// Lagos weather: the same for everyone at the same time. Rain is likelier in the rainy season (April–October),
// storms mostly in its peak (June–July); dry season brings harmattan haze (December–February).

export type Weather = "sunny" | "cloudy" | "rain" | "storm" | "harmattan";
export const WEATHER_ICON: Record<Weather, string> = { sunny: "☀️", cloudy: "⛅", rain: "🌧️", storm: "⛈️", harmattan: "🌫️" };
export const WEATHER_LABEL: Record<Weather, string> = { sunny: "Sunny", cloudy: "Cloudy", rain: "Rain", storm: "Storm", harmattan: "Harmattan haze" };

/** Small deterministic hash → [0, 1). */
function rnd(n: number) {
  let t = (n * 2654435761) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The weather in Lagos at a moment; it changes every two hours. */
export function weatherAt(at: Date): Weather {
  const lagos = new Date(at.getTime() + 3_600_000);
  const month = lagos.getUTCMonth() + 1;
  const block = Math.floor(lagos.getTime() / 7_200_000);
  const r = rnd(block);
  const rainy = month >= 4 && month <= 10;
  const peak = month === 6 || month === 7;
  if (month === 12 || month <= 2) return r < 0.55 ? "harmattan" : r < 0.9 ? "sunny" : "cloudy";
  if (rainy) {
    if (r < (peak ? 0.18 : 0.08)) return "storm";
    if (r < (peak ? 0.5 : 0.32)) return "rain";
    if (r < 0.65) return "cloudy";
    return "sunny";
  }
  return r < 0.12 ? "rain" : r < 0.35 ? "cloudy" : "sunny";
}

// ── Floods ──
/** Low-lying areas that flood first (Lekki, Victoria Island, Apapa) and the next ones in a storm. */
export const FLOOD_PRONE: readonly { area: string; depth: 1 | 2 }[] = [
  { area: "Lekki Gardens", depth: 1 },
  { area: "Island Heights", depth: 1 },
  { area: "Apapa Port", depth: 1 },
  { area: "Ikodu Town", depth: 1 },
  { area: "Marina Wharf", depth: 2 },
  { area: "Owambe Gardens", depth: 2 },
];
const BLOCK = 7_200_000;
const wet = (w: Weather) => w === "rain" || w === "storm";

/**
 * Flooded areas now: a storm (now or in the last two hours) floods every prone area; two rainy spells in a row flood
 * the lowest ones. Water takes about two hours to drain after the rain stops.
 */
export function floodedAreas(at: Date): string[] {
  const now = weatherAt(at);
  const before = weatherAt(new Date(at.getTime() - BLOCK));
  const twoBefore = weatherAt(new Date(at.getTime() - 2 * BLOCK));
  const storm = now === "storm" || before === "storm";
  const soaked = (wet(now) && wet(before)) || (wet(before) && wet(twoBefore));
  if (storm) return FLOOD_PRONE.map((f) => f.area);
  if (soaked) return FLOOD_PRONE.filter((f) => f.depth === 1).map((f) => f.area);
  return [];
}

/** Rain surge on road rides: cabs and okadas cost more in the rain, more in a storm, and everything is slower. */
export function rainSurge(at: Date): { fare: number; slow: number } {
  const w = weatherAt(at);
  if (w === "storm") return { fare: 1.5, slow: 1.4 };
  if (w === "rain") return { fare: 1.25, slow: 1.2 };
  return { fare: 1, slow: 1 };
}

/** Umbrella from a roadside hawker: walking in the rain without one leaves you soaked. */
export const UMBRELLA = { price: 800 };
export const SOAKED = { style: -12, health: -4, cooldownMs: 60 * 60_000 };
