// Dream progress (see @hc/shared dreams.ts). Metrics come from game data the player can't edit:
// served orders, sales postings in the ledger and weekly standings. Step rewards are ledger postings
// with a per-step reference, so claiming twice is a no-op.

import { gameLedgerEntries, profiles, simOrders, simShops } from "@hc/db";
import { claimableStep, dreamRewardRef, dreamView, type DreamMetrics, type DreamView } from "@hc/shared";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";
import type { ShopCtx } from "./shop.js";

/** Ledger kinds that count as sales, same as the standings. */
const SALES = ["takings", "order"];

async function metrics(tx: Tx, userId: string, timeZone: string): Promise<DreamMetrics> {
  const [served] = await tx
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(simOrders)
    .innerJoin(simShops, eq(simShops.id, simOrders.shopId))
    .where(eq(simShops.ownerId, userId));

  const [earned] = await tx
    .select({ n: sql<number>`coalesce(sum(${gameLedgerEntries.amount}), 0)::bigint`.mapWith(Number) })
    .from(gameLedgerEntries)
    .where(and(eq(gameLedgerEntries.userId, userId), inArray(gameLedgerEntries.kind, SALES)));

  // Weekly sales per player (Lagos weeks), ranked within each week.
  const ranks = await tx.execute<{ current: boolean; rank: number }>(sql`
    with weekly as (
      select user_id,
             date_trunc('week', created_at at time zone ${timeZone}) as week,
             sum(amount) as earned
      from ${gameLedgerEntries}
      where kind in ('takings', 'order')
      group by 1, 2
    ), ranked as (
      select user_id, week, rank() over (partition by week order by earned desc) as rank
      from weekly
    )
    select week = date_trunc('week', now() at time zone ${timeZone}) as current, rank::int as rank
    from ranked
    where user_id = ${userId}
  `);
  const finished = ranks.filter((r) => !r.current).map((r) => Number(r.rank));
  const thisWeek = ranks.find((r) => r.current);

  return {
    customersServed: served?.n ?? 0,
    salesEarned: earned?.n ?? 0,
    bestWeekRank: finished.length ? Math.min(...finished) : null,
    rankThisWeek: thisWeek ? Number(thisWeek.rank) : null,
    friends: 0,
  };
}

async function claimedRefs(tx: Tx, userId: string) {
  const rows = await tx
    .select({ reference: gameLedgerEntries.reference })
    .from(gameLedgerEntries)
    .where(and(eq(gameLedgerEntries.userId, userId), like(gameLedgerEntries.reference, "dream:%")));
  return new Set(rows.map((r) => r.reference));
}

export async function getDream({ tx, userId, timeZone }: ShopCtx): Promise<DreamView> {
  const [profile] = await tx.select({ dream: profiles.dream }).from(profiles).where(eq(profiles.userId, userId));
  if (!profile) throw notFound("Profile");
  return dreamView(profile.dream, await metrics(tx, userId, timeZone), await claimedRefs(tx, userId));
}

export async function claimDreamStep(ctx: ShopCtx, at: number): Promise<{ dream: DreamView; reward: number; balance: number }> {
  const { tx, userId } = ctx;
  await lockProfile(tx, userId);
  const before = await getDream(ctx);
  const step = claimableStep(before, at);
  if (!step) throw new AppError(422, "not_reached", "You haven't reached that step yet.");
  const posting = await postCoins(tx, userId, step.reward, "dream_reward", dreamRewardRef(before.key, at));
  if (!posting.applied) throw new AppError(409, "already_claimed", "You already claimed that reward.");
  return { dream: await getDream(ctx), reward: step.reward, balance: posting.balance };
}
