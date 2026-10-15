// Skills (see @hc/shared skills.ts): points stored per player and skill, added inside the caller's transaction.

import { playerSkills } from "@hc/db";
import { skillLevel, skillsView, type SkillKey, type SkillsView } from "@hc/shared";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Tx } from "../../lib/db.js";
import { requireUser } from "../../plugins/auth.js";

export async function addSkill(tx: Tx, userId: string, skill: SkillKey | undefined, points: number) {
  if (!skill || points <= 0) return;
  await tx
    .insert(playerSkills)
    .values({ userId, skill, points })
    .onConflictDoUpdate({ target: [playerSkills.userId, playerSkills.skill], set: { points: sql`${playerSkills.points} + ${points}` } });
}

export async function skillLevelOf(tx: Tx, userId: string, skill: SkillKey | undefined) {
  if (!skill) return 0;
  const [row] = await tx.select().from(playerSkills).where(and(eq(playerSkills.userId, userId), eq(playerSkills.skill, skill)));
  return skillLevel(row?.points ?? 0);
}

export async function loadSkills(tx: Tx, userId: string): Promise<SkillsView> {
  const rows = await tx.select().from(playerSkills).where(eq(playerSkills.userId, userId));
  return skillsView(Object.fromEntries(rows.map((r) => [r.skill, r.points])));
}

export async function skillRoutes(app: FastifyInstance) {
  app.get("/api/game/skills", async (request) => {
    const user = requireUser(request);
    return app.db.transaction((tx) => loadSkills(tx, user.id));
  });
}
