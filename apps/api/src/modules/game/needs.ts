// Needs: stored values that run down in real time (see shared/needs). Read and saved inside the caller's
// transaction, so an activity's coins, XP and needs change together.

import { playerNeeds } from "@hc/db";
import { NEED_START, moodOf, needsAt, type Needs, type NeedsView } from "@hc/shared";
import { eq } from "drizzle-orm";
import type { Tx } from "../../lib/db.js";

export async function loadNeeds(tx: Tx, userId: string, now: Date) {
  const [row] = await tx.select().from(playerNeeds).where(eq(playerNeeds.userId, userId)).for("update");
  if (!row) return { needs: { ...NEED_START }, freeAt: {} as Record<string, string> };
  return { needs: needsAt(row.needs as Needs, row.updatedAt, now), freeAt: row.freeAt as Record<string, string> };
}

export async function saveNeeds(tx: Tx, userId: string, needs: Needs, now: Date, freeAt?: Record<string, string>) {
  await tx
    .insert(playerNeeds)
    .values({ userId, needs, freeAt: freeAt ?? {}, updatedAt: now })
    .onConflictDoUpdate({ target: playerNeeds.userId, set: { needs, updatedAt: now, ...(freeAt ? { freeAt } : {}) } });
}

export const needsView = (needs: Needs): NeedsView => ({ needs, mood: moodOf(needs) });
