// City Coin postings. The cached balance on `profiles` and the append-only
// `game_ledger_entries` change together in one transaction; the unique
// (user_id, reference) index makes each posting idempotent.

import { gameLedgerEntries, profiles } from "@hc/db";
import { and, eq, sql } from "drizzle-orm";
import { lockProfile, type Tx } from "./db.js";
import { AppError } from "./errors.js";

export type CoinKind =
  | "signup_grant"
  | "restock"
  | "takings"
  | "order"
  | "quest_reward"
  | "intro_reward"
  | "decor"
  | "decor_refund"
  | "dream_reward"
  | "activity"
  | "course_reward"
  | "ride"
  | "area_boys"
  | "deal_reward"
  | "shift_pay"
  | "land"
  | "house"
  | "vehicle"
  | "fuel"
  | "treat"
  | "home_item"
  | "game_reward"
  | "university_fees"
  | "rent"
  | "coach"
  | "admin_adjustment";

export interface PostingResult {
  applied: boolean;
  balance: number;
}

/**
 * Apply a signed coin amount to a player. Caller must be inside a transaction.
 * Re-posting the same reference is a no-op that returns the current balance.
 */
export async function postCoins(
  tx: Tx,
  userId: string,
  amount: number,
  kind: CoinKind,
  reference: string,
): Promise<PostingResult> {
  if (!Number.isInteger(amount) || amount === 0) throw new Error(`invalid coin amount ${amount}`);

  const profile = await lockProfile(tx, userId);

  const [existing] = await tx
    .select({ id: gameLedgerEntries.id })
    .from(gameLedgerEntries)
    .where(and(eq(gameLedgerEntries.userId, userId), eq(gameLedgerEntries.reference, reference)));
  if (existing) return { applied: false, balance: profile.coinBalance };

  const balance = profile.coinBalance + amount;
  if (balance < 0) throw new AppError(422, "insufficient_coins", "Not enough City Coins.");

  await tx.insert(gameLedgerEntries).values({ userId, amount, balanceAfter: balance, kind, reference });
  await tx
    .update(profiles)
    .set({ coinBalance: balance, updatedAt: sql`now()` })
    .where(eq(profiles.userId, userId));
  return { applied: true, balance };
}
