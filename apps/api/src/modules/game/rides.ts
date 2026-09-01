// Rides: the fare is charged when the trip starts, and the server decides there and then whether the area boys
// stop it. The player picks how to handle the stop; the server rolls the outcome and settles it once.

import { playerVehicles, profiles, rides } from "@hc/db";
import { MAX_RIDE_UNITS, RIDE_BY_MODE, STOP_BY_CHOICE, VEHICLE_BY_KIND, fuelCost, lagosHourOf, rideFare, TRANSIT, transitFare, type TransitKind, type RideMode, type RideStart, type StopChoice, type StopResult, type VehicleKind } from "@hc/shared";
import { and, eq, sql } from "drizzle-orm";
import { postCoins, type PostingResult } from "../../lib/coins.js";
import { lockProfile } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";
import type { ShopCtx } from "./shop.js";

/** Dice for stops and their outcomes (tests swap it for fixed rolls). */
export const dice = { roll: () => Math.random() };

/** Driving yourself: fuel instead of a fare, and the vehicle's own (lower) chance of a stop. */
export async function startDrive({ tx, userId }: ShopCtx, kind: VehicleKind, units: number): Promise<RideStart> {
  const v = VEHICLE_BY_KIND.get(kind);
  if (!v) throw new AppError(400, "bad_vehicle", "Pick one of your vehicles.");
  if (!Number.isInteger(units) || units < 1 || units > MAX_RIDE_UNITS) throw new AppError(400, "bad_distance", "That trip is off the map.");
  const [owned] = await tx.select().from(playerVehicles).where(and(eq(playerVehicles.userId, userId), eq(playerVehicles.kind, kind)));
  if (!owned) throw new AppError(409, "not_owned", "You don't own that yet. Buy one in Phone → Garage.");
  const profile = await lockProfile(tx, userId);
  const fuel = fuelCost(kind, units);
  if (profile.coinBalance < fuel) throw new AppError(422, "insufficient_coins", `You need ${fuel} coins of fuel.`);
  const stop = dice.roll() < v.stopChance;
  const [ride] = await tx.insert(rides).values({ userId, mode: `own:${kind}`, units, fare: fuel, stop }).returning({ id: rides.id });
  const posting = await postCoins(tx, userId, -fuel, "fuel", `fuel:${ride!.id}`);
  return { rideId: ride!.id, fare: fuel, stop, balance: posting.balance };
}

export async function startRide({ tx, userId, now }: ShopCtx, mode: RideMode, units: number): Promise<RideStart> {
  const info = RIDE_BY_MODE.get(mode);
  if (!info || info.mode === "walk") throw new AppError(400, "bad_mode", "Pick a keke, danfo, okada or cab.");
  if (!Number.isInteger(units) || units < 1 || units > MAX_RIDE_UNITS) throw new AppError(400, "bad_distance", "That trip is off the map.");
  const profile = await lockProfile(tx, userId);
  const fare = rideFare(mode, units, lagosHourOf(now));
  if (profile.coinBalance < fare) throw new AppError(422, "insufficient_coins", `The ${info.label.toLowerCase()} costs ${fare} coins. Trek, or take something cheaper.`);
  const stop = dice.roll() < info.stopChance;
  const [ride] = await tx.insert(rides).values({ userId, mode, units, fare, stop }).returning({ id: rides.id });
  const posting = await postCoins(tx, userId, -fare, "ride", `ride:${ride!.id}`);
  return { rideId: ride!.id, fare, stop, balance: posting.balance };
}

/** Public transport: the fare for the distance on the line; never stopped by area boys. */
export async function startTransit({ tx, userId }: ShopCtx, kind: TransitKind, units: number): Promise<RideStart> {
  const info = TRANSIT[kind];
  if (!info) throw new AppError(400, "bad_mode", "Pick a BRT, train or water bus.");
  if (kind === "coach") throw new AppError(409, "coming_soon", "Coaches out of Lagos start soon. Ogun State is on its way.");
  if (!Number.isInteger(units) || units < 1 || units > MAX_RIDE_UNITS) throw new AppError(400, "bad_distance", "That trip is off the map.");
  const profile = await lockProfile(tx, userId);
  const fare = transitFare(kind, units);
  if (profile.coinBalance < fare) throw new AppError(422, "insufficient_coins", `The ${info.label} costs ${fare} coins.`);
  const [ride] = await tx.insert(rides).values({ userId, mode: `transit:${kind}`, units, fare, stop: false }).returning({ id: rides.id });
  const posting = await postCoins(tx, userId, -fare, "ride", `ride:${ride!.id}`);
  return { rideId: ride!.id, fare, stop: false, balance: posting.balance };
}

export async function settleStop({ tx, userId }: ShopCtx, rideId: string, choice: StopChoice): Promise<StopResult> {
  const option = STOP_BY_CHOICE.get(choice);
  if (!option) throw new AppError(400, "bad_choice", "Pick what to do.");
  const profile = await lockProfile(tx, userId);
  const [ride] = await tx.select().from(rides).where(and(eq(rides.id, rideId), eq(rides.userId, userId)));
  if (!ride || !ride.stop) throw notFound("Stop");
  if (ride.stopChoice) throw new AppError(409, "settled", "You've already dealt with them.");
  const ok = choice === "pay" || dice.roll() < option.odds;
  // Paying always costs; the others cost only when they fail. Nobody pays more than they have.
  const owed = choice === "pay" || !ok ? option.cost : 0;
  const cost = Math.min(owed, profile.coinBalance);
  let posting: PostingResult = { applied: false, balance: profile.coinBalance };
  if (cost > 0) posting = await postCoins(tx, userId, -cost, "area_boys", `area_boys:${ride.id}`);
  const xp = ok ? option.xp : 0;
  if (xp) await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${xp}` }).where(eq(profiles.userId, userId));
  await tx.update(rides).set({ stopChoice: choice, stopCost: cost }).where(eq(rides.id, ride.id));
  const message =
    choice === "pay"
      ? "You settled them. \"Oga, safe journey!\""
      : ok
        ? { talk: "Your mouth sweet. They waved you through.", run: "You ran, they gave up. Your heart is still racing.", stand: "You stood your ground and they backed off. Respect.", pay: "" }[choice]
        : { talk: "They didn't buy it.", run: "They caught up with you.", stand: "Bad move. They were too many.", pay: "" }[choice] + (cost ? ` You paid ${cost} coins.` : " Luckily you had nothing on you.");
  return { ok, cost, xp, message, balance: posting.balance };
}
