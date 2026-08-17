// Your own ride: buy a bike, keke or car with City Coins and drive yourself. No fare, just a little fuel per
// kilometre; faster than a danfo and the area boys mostly leave a car alone.

export type VehicleKind = "bike" | "keke" | "saloon" | "suv";

export interface VehicleInfo {
  kind: VehicleKind;
  label: string;
  note: string;
  price: number;
  /** Fuel in City Coins per km. */
  fuelPerKm: number;
  /** World units per second on the map. */
  speed: number;
  stopChance: number;
  /** Traffic art used on the map (StreetLife views). */
  art: "okada" | "keke" | "saloon" | "suvBlack";
  /** Image for the shop. */
  image: string;
}

export const VEHICLES: readonly VehicleInfo[] = [
  { kind: "bike", label: "Okada (motorbike)", note: "Beats any go-slow", price: 20_000, fuelPerKm: 4, speed: 680, stopChance: 0.15, art: "okada", image: "/art/life/okada-se.webp" },
  { kind: "keke", label: "Keke", note: "Cheap to run, carries your market", price: 35_000, fuelPerKm: 5, speed: 520, stopChance: 0.1, art: "keke", image: "/art/life/keke-se.webp" },
  { kind: "saloon", label: "Tokunbo saloon car", note: "AC, music, respect", price: 90_000, fuelPerKm: 9, speed: 620, stopChance: 0.04, art: "saloon", image: "/art/life/car-saloon.webp" },
  { kind: "suv", label: "Black SUV", note: "Big man ride. Area boys step aside", price: 220_000, fuelPerKm: 14, speed: 640, stopChance: 0.02, art: "suvBlack", image: "/art/life/car-suv-black.webp" },
];
export const VEHICLE_BY_KIND: ReadonlyMap<VehicleKind, VehicleInfo> = new Map(VEHICLES.map((v) => [v.kind, v]));

export const fuelCost = (kind: VehicleKind, units: number) => Math.max(5, Math.round((VEHICLE_BY_KIND.get(kind)!.fuelPerKm * units) / 1000));
