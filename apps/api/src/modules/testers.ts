// Beta tester rewards (see @hc/shared testers.ts): days played are counted from map position reports, tiers come on
// their own (Founding is set by an admin), and admins pay the banked coins out in one go. Admins never earn tiers.

import { feedback, playerDays, profiles, testerRewards, users } from "@hc/db";
import { TESTER_BY_KEY, TESTER_RANK, TESTER_TIERS, dayKey, earnedTier, type AdminTesterRow, type TesterTier, type TesterView } from "@hc/shared";
import { and, count, eq, inArray, max, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import type { Db } from "@hc/db";
import type { Tx } from "../lib/db.js";
import { notFound } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";
import { setTester } from "./presence.js";

type Conn = Db | Tx;
const counted = new Set<string>();

const isAdmin = async (db: Conn, userId: string) => {
  const [u] = await db.select({ roles: users.roles }).from(users).where(eq(users.id, userId));
  return !!u?.roles.includes("admin");
};

/** Days played and reports marked fixed, and the tier row. */
async function progress(db: Conn, userId: string) {
  const [{ n: days }] = (await db.select({ n: count() }).from(playerDays).where(eq(playerDays.userId, userId))) as [{ n: number }];
  const [{ n: useful }] = (await db
    .select({ n: count() })
    .from(feedback)
    .where(and(eq(feedback.userId, userId), inArray(feedback.kind, ["bug", "idea", "other"]), eq(feedback.status, "fixed")))) as [{ n: number }];
  const [row] = await db.select().from(testerRewards).where(eq(testerRewards.userId, userId));
  return { days: Number(days), useful: Number(useful), row };
}

/** Move a player up to the tier they've earned (never down; Founding only by hand). */
export async function refreshTier(db: Conn, userId: string): Promise<TesterView> {
  const { days, useful, row } = await progress(db, userId);
  let tier = (row?.tier as TesterTier | undefined) ?? null;
  const earned = earnedTier(days, useful);
  if (earned && (!tier || TESTER_RANK[earned] > TESTER_RANK[tier]) && !(await isAdmin(db, userId))) {
    tier = earned;
    await db.insert(testerRewards).values({ userId, tier }).onConflictDoUpdate({ target: testerRewards.userId, set: { tier, earnedAt: sql`now()` } });
  }
  return { tier, days, usefulReports: useful, coins: tier ? TESTER_BY_KEY.get(tier)!.coins : 0, paid: row?.paid ?? 0 };
}

/** Count today as a day played (once a day per player), and update their tier. */
export async function markPlayed(db: Db, userId: string, tz: string): Promise<TesterTier | null> {
  const day = dayKey(new Date(), tz);
  const key = `${userId}|${day}`;
  if (counted.has(key)) return null;
  if (counted.size > 50_000) counted.clear();
  counted.add(key);
  const added = await db.insert(playerDays).values({ userId, day }).onConflictDoNothing().returning();
  return added.length ? (await refreshTier(db, userId)).tier : null;
}

export async function testerTierOf(db: Conn, userId: string): Promise<TesterTier | null> {
  const [row] = await db.select({ tier: testerRewards.tier }).from(testerRewards).where(eq(testerRewards.userId, userId));
  return (row?.tier as TesterTier | undefined) ?? null;
}

export async function testerRoutes(app: FastifyInstance) {
  app.get("/api/tester", async (request): Promise<TesterView> => {
    const user = requireUser(request);
    return refreshTier(app.db, user.id);
  });

  // Everyone who has played (not admins): their days, reports and tier.
  app.get("/api/admin/testers", async (request): Promise<AdminTesterRow[]> => {
    requireRole(request, "admin");
    const players = await app.db
      .select({ userId: profiles.userId, nickname: profiles.nickname, lastDay: max(playerDays.day) })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .innerJoin(playerDays, eq(playerDays.userId, profiles.userId))
      .where(sql`not ('admin' = any(${users.roles}))`)
      .groupBy(profiles.userId, profiles.nickname);
    const rows: AdminTesterRow[] = [];
    for (const p of players) {
      const v = await refreshTier(app.db, p.userId);
      const [{ n }] = (await app.db.select({ n: count() }).from(feedback).where(and(eq(feedback.userId, p.userId), inArray(feedback.kind, ["bug", "idea", "other"])))) as [{ n: number }];
      rows.push({ ...v, userId: p.userId, nickname: p.nickname, reports: Number(n), lastDay: p.lastDay });
    }
    return rows.sort((a, b) => (b.tier ? TESTER_RANK[b.tier] : 0) - (a.tier ? TESTER_RANK[a.tier] : 0) || b.days - a.days);
  });

  // Set a tier by hand (Founding tester, or a correction); null takes it away.
  app.post<{ Params: { userId: string } }>("/api/admin/testers/:userId", async (request) => {
    requireRole(request, "admin");
    const userId = z.uuid().parse(request.params.userId);
    const { tier } = z.object({ tier: z.enum(TESTER_TIERS.map((t) => t.key) as [TesterTier, ...TesterTier[]]).nullable() }).parse(request.body);
    const [p] = await app.db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, userId));
    if (!p) throw notFound("Player");
    if (tier) await app.db.insert(testerRewards).values({ userId, tier }).onConflictDoUpdate({ target: testerRewards.userId, set: { tier, earnedAt: sql`now()` } });
    else await app.db.delete(testerRewards).where(eq(testerRewards.userId, userId));
    const view = await refreshTier(app.db, userId);
    setTester(userId, view.tier);
    return view;
  });

  // Pay out: everyone gets what their tier is worth minus what they've had (one ledger posting per tier).
  app.post("/api/admin/testers/pay", async (request) => {
    requireRole(request, "admin");
    const rows = await app.db.select().from(testerRewards);
    let players = 0;
    let coins = 0;
    for (const r of rows) {
      const owed = (TESTER_BY_KEY.get(r.tier)?.coins ?? 0) - r.paid;
      if (owed <= 0) continue;
      await app.db.transaction(async (tx) => {
        const { applied } = await postCoins(tx, r.userId, owed, "tester_reward", `tester:${r.tier}`);
        await tx.update(testerRewards).set({ paid: r.paid + owed, paidAt: sql`now()` }).where(eq(testerRewards.userId, r.userId));
        if (applied) {
          players++;
          coins += owed;
        }
      });
    }
    return { players, coins };
  });
}
