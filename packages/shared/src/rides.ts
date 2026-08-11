// Getting around: walk for free or pay for a keke, danfo, okada or cab. Fares go by distance, cabs and okadas
// cost more in rush hour, and on the way the area boys may stop you. Fares and stops are decided on the server.

export type RideMode = "walk" | "keke" | "danfo" | "okada" | "cab";

export interface RideModeInfo {
  mode: RideMode;
  label: string;
  /** What it's like, one line. */
  note: string;
  /** City Coins: flag-down plus per kilometre. */
  base: number;
  perKm: number;
  /** World units per second on the map. */
  speed: number;
  /** Rush-hour multiplier on the fare. */
  rush: number;
  /** Chance the area boys stop you on the way. */
  stopChance: number;
  /** Vehicle art on the map (StreetLife views); none for walking. */
  vehicle?: "keke" | "danfo" | "okada" | "taxi";
}

export const RIDE_MODES: readonly RideModeInfo[] = [
  { mode: "walk", label: "Trek", note: "Free, slow, good for your legs", base: 0, perKm: 0, speed: 230, rush: 1, stopChance: 0 },
  { mode: "danfo", label: "Danfo", note: "Cheapest ride. Stops everywhere", base: 30, perKm: 15, speed: 420, rush: 1, stopChance: 0.12, vehicle: "danfo" },
  { mode: "keke", label: "Keke", note: "Quick on short trips", base: 50, perKm: 25, speed: 480, rush: 1, stopChance: 0.15, vehicle: "keke" },
  { mode: "okada", label: "Okada", note: "Fastest through go-slow, a bit risky", base: 60, perKm: 30, speed: 640, rush: 1.25, stopChance: 0.25, vehicle: "okada" },
  { mode: "cab", label: "Cab", note: "AC, comfort, surge in rush hour", base: 200, perKm: 70, speed: 560, rush: 1.5, stopChance: 0.05, vehicle: "taxi" },
];
export const RIDE_BY_MODE: ReadonlyMap<RideMode, RideModeInfo> = new Map(RIDE_MODES.map((m) => [m.mode, m]));

/** Map units in a kilometre (a typical 25 m plot is about 108 units across). */
export const UNITS_PER_KM = 1000;
/** Longest trip the server will price (the map is about 13 km across). */
export const MAX_RIDE_UNITS = 20_000;
/** Taps closer than this just walk; farther ones offer a ride. */
export const RIDE_PICK_FROM = 900;

/** Lagos rush hours: 7–10 am and 4–8 pm. */
export const isRushHour = (hour: number) => (hour >= 7 && hour < 10) || (hour >= 16 && hour < 20);

export function rideFare(mode: RideMode, units: number, hour: number): number {
  const m = RIDE_BY_MODE.get(mode)!;
  if (!m.base && !m.perKm) return 0;
  const raw = (m.base + (m.perKm * units) / UNITS_PER_KM) * (isRushHour(hour) ? m.rush : 1);
  return Math.max(m.base, Math.round(raw / 10) * 10);
}

/** Seconds the trip takes on the map (rush hour slows the danfo, keke and cab in go-slow). */
export function rideSeconds(mode: RideMode, units: number, hour: number): number {
  const m = RIDE_BY_MODE.get(mode)!;
  const slow = isRushHour(hour) && mode !== "okada" && mode !== "walk" ? 1.4 : 1;
  return Math.max(3, Math.round((units / m.speed) * slow));
}

// ---------------------------------------------------------------- the area boys
export type StopChoice = "pay" | "talk" | "run" | "stand";

export interface StopOption {
  choice: StopChoice;
  label: string;
  /** Chance it works (pay always works). */
  odds: number;
  /** Coins if it works (pay) or if it fails (the rest). */
  cost: number;
  /** XP if it works. */
  xp: number;
  risk: string;
}

export const AREA_BOYS_OPTIONS: readonly StopOption[] = [
  { choice: "pay", label: "Settle them", odds: 1, cost: 200, xp: 0, risk: "Safe: 200 coins and you go" },
  { choice: "talk", label: "Talk your way out", odds: 0.55, cost: 400, xp: 8, risk: "55% chance; fail and you pay 400 coins" },
  { choice: "run", label: "Run for it", odds: 0.45, cost: 500, xp: 10, risk: "45% chance; fail and you pay 500 coins" },
  { choice: "stand", label: "Stand your ground", odds: 0.37, cost: 800, xp: 20, risk: "37% chance; fail and you pay 800 coins" },
];
export const STOP_BY_CHOICE: ReadonlyMap<StopChoice, StopOption> = new Map(AREA_BOYS_OPTIONS.map((o) => [o.choice, o]));

export interface RideStart {
  rideId: string;
  fare: number;
  /** The area boys will stop this ride partway. */
  stop: boolean;
  balance: number;
}

export interface StopResult {
  ok: boolean;
  cost: number;
  xp: number;
  message: string;
  balance: number;
}
