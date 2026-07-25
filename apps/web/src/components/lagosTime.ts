// Lagos time of day for the map's lighting. Lagos is UTC+1 all year (no daylight saving).
import { useEffect, useState } from "react";

export type Phase = "dawn" | "day" | "dusk" | "night";

export interface Light {
  /** Hours since midnight in Lagos, e.g. 19.5 = 7:30pm. */
  hour: number;
  phase: Phase;
  /** Multiply tint over the world (white = no change). */
  tint: string;
  /** 0 = lamps off, 1 = full night glow. */
  lamps: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i]!, t))).join(" ")})`;

const NOON = [255, 255, 255];
const GOLD = [255, 214, 170]; // sunrise and sunset
const NIGHT = [92, 106, 168]; // deep indigo, still readable

/** Lagos hour for a moment in time. */
export function lagosHour(at: Date): number {
  return (at.getUTCHours() + 1 + at.getUTCMinutes() / 60) % 24;
}

/** Lighting for an hour of the Lagos day; sunrise about 6:45, sunset about 18:45. */
export function lightAt(hour: number): Light {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7.5 && h < 17.5) return { hour: h, phase: "day", tint: "rgb(255 255 255)", lamps: 0 };
  if (h >= 5.5 && h < 7.5) {
    const t = clamp01((h - 5.5) / 2); // night → gold → day
    return { hour: h, phase: "dawn", tint: t < 0.5 ? mix(NIGHT, GOLD, t * 2) : mix(GOLD, NOON, (t - 0.5) * 2), lamps: clamp01(1 - t * 1.6) };
  }
  if (h >= 17.5 && h < 19.75) {
    const t = clamp01((h - 17.5) / 2.25); // day → gold → night
    return { hour: h, phase: "dusk", tint: t < 0.45 ? mix(NOON, GOLD, t / 0.45) : mix(GOLD, NIGHT, (t - 0.45) / 0.55), lamps: clamp01((t - 0.3) / 0.6) };
  }
  return { hour: h, phase: "night", tint: "rgb(92 106 168)", lamps: 1 };
}

export function clockLabel(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

/** Live Lagos light, refreshed every minute. `?hour=21` in the URL pins a time for previews. */
export function useLagosLight(): Light {
  const pinned = (() => {
    try {
      const v = new URLSearchParams(window.location.search).get("hour");
      const n = v === null || v === "" ? NaN : Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  })();
  const [hour, setHour] = useState(() => pinned ?? lagosHour(new Date()));
  useEffect(() => {
    if (pinned !== null) return;
    const id = window.setInterval(() => setHour(lagosHour(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, [pinned]);
  return lightAt(hour);
}
