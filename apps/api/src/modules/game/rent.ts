// Rent (see @hc/shared rent.ts): renting a flat (up front, then weekly, eviction when two weeks behind) and letting
// out a house you own for weekly rent you collect. Rent falls due lazily, whenever your home is loaded.

import { playerPlots, rentals } from "@hc/db";
import { RENT_AREA, RENT_TERMS, RENT_UNIT_BY_KEY, WEEK_MS, letRent, moveInCost, rentDue, type RentalView, type RentUnitKey } from "@hc/shared";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";

/** Pay any weeks due from your coins; two weeks behind and you're out (caution kept). Returns the rental after. */
export async function settleRent(tx: Tx, userId: string, now: Date): Promise<{ rental: RentalView | null; evicted: boolean }> {
  const [r] = await tx.select().from(rentals).where(eq(rentals.userId, userId));
  if (!r) return { rental: null, evicted: false };
  let paidUntil = r.paidUntil;
  if (paidUntil < now) {
    const profile = await lockProfile(tx, userId);
    let balance = profile.coinBalance;
    while (paidUntil < now && balance >= r.weekly) {
      const posting = await postCoins(tx, userId, -r.weekly, "rent", `rent:${userId}:${paidUntil.toISOString()}`);
      balance = posting.balance;
      paidUntil = new Date(paidUntil.getTime() + WEEK_MS);
    }
    await tx.update(rentals).set({ paidUntil }).where(eq(rentals.userId, userId));
  }
  const owing = paidUntil < now ? Math.ceil((now.getTime() - paidUntil.getTime()) / WEEK_MS) : 0;
  if (owing >= RENT_TERMS.graceWeeks) {
    await tx.delete(rentals).where(eq(rentals.userId, userId));
    return { rental: null, evicted: true };
  }
  return { rental: { unit: r.unit as RentUnitKey, area: r.area, plotId: r.plotId, weekly: r.weekly, caution: r.caution, paidUntil: paidUntil.toISOString(), owing }, evicted: false };
}

/** Move into a flat: four weeks up front, the agent's fee and the caution, all at once. */
export async function moveIn(tx: Tx, userId: string, unit: string, area: string, plotId: string, now: Date) {
  const u = RENT_UNIT_BY_KEY.get(unit);
  if (!u) throw new AppError(400, "bad_unit", "Pick a flat from the list.");
  if (!(area in RENT_AREA)) throw new AppError(400, "bad_area", "Pick an area from the list.");
  if (!/^[\w:+-]{3,80}$/.test(plotId)) throw new AppError(400, "bad_plot", "That building isn't on the map.");
  await lockProfile(tx, userId);
  const [cur] = await tx.select().from(rentals).where(eq(rentals.userId, userId));
  if (cur) throw new AppError(409, "renting", "You're already renting. Move out first.");
  const cost = moveInCost(u.key, area);
  await postCoins(tx, userId, -cost.total, "rent", `rent:movein:${userId}:${randomUUID()}`);
  await tx.insert(rentals).values({ userId, unit: u.key, area, plotId, weekly: cost.weekly, caution: cost.caution, paidUntil: new Date(now.getTime() + RENT_TERMS.weeksUpFront * WEEK_MS) });
  return cost;
}

/** Move out: the caution comes back if you're up to date. */
export async function moveOut(tx: Tx, userId: string, now: Date) {
  const { rental } = await settleRent(tx, userId, now);
  if (!rental) throw new AppError(409, "not_renting", "You're not renting anywhere.");
  await tx.delete(rentals).where(eq(rentals.userId, userId));
  const refund = rental.owing ? 0 : rental.caution;
  if (refund) await postCoins(tx, userId, refund, "rent", `rent:caution:${userId}:${randomUUID()}`);
  return { refund };
}

/** A let house: its weekly rent and what's built up. */
export const letInfo = (p: { plotId: string; design: string | null; letSince: Date | null }, now: Date) =>
  p.design && p.letSince ? { weekly: letRent(p.design, p.plotId), due: rentDue(letRent(p.design, p.plotId), p.letSince, now) } : null;

/** Let a house out (or take it back, collecting what's due). */
export async function setLet(tx: Tx, userId: string, plot: { plotId: string; design: string | null; isHome: boolean; letSince: Date | null }, on: boolean, now: Date) {
  if (on) {
    if (!plot.design) throw new AppError(409, "no_house", "Build a house there first.");
    if (plot.isHome) throw new AppError(409, "home", "You live there. Make another house your home first.");
    if (!plot.letSince) await tx.update(playerPlots).set({ letSince: now }).where(eq(playerPlots.plotId, plot.plotId));
    return { collected: 0 };
  }
  const { collected } = await collect(tx, userId, plot, now);
  await tx.update(playerPlots).set({ letSince: null }).where(eq(playerPlots.plotId, plot.plotId));
  return { collected };
}

export async function collect(tx: Tx, userId: string, plot: { plotId: string; design: string | null; letSince: Date | null }, now: Date) {
  const info = letInfo(plot, now);
  if (!info || info.due <= 0) return { collected: 0 };
  await lockProfile(tx, userId);
  await postCoins(tx, userId, info.due, "rent", `let:${plot.plotId}:${now.toISOString()}`);
  await tx.update(playerPlots).set({ letSince: now }).where(eq(playerPlots.plotId, plot.plotId));
  return { collected: info.due };
}
