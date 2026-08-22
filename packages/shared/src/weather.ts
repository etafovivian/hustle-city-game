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
