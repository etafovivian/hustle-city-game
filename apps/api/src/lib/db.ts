import type { Db } from "@hc/db";
import { profiles } from "@hc/db";
import { eq } from "drizzle-orm";
import { notFound } from "./errors.js";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Lock the player's profile row for the rest of the transaction.
 * Every mutation of a player's game state takes this lock first, which serialises
 * that player's coin, inventory and quest updates and keeps lock order consistent
 * (profile → shop) to avoid deadlocks.
 */
export async function lockProfile(tx: Tx, userId: string) {
  const [row] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).for("update");
  if (!row) throw notFound("Profile");
  return row;
}
