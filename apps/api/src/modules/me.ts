import { profiles, users, type Db } from "@hc/db";
import { checkNickname, isValidAvatar, type AvatarConfig, type Me, type Role } from "@hc/shared";
import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { badRequest, conflict, isUniqueViolation, notFound } from "../lib/errors.js";
import { requireUser } from "../plugins/auth.js";

export async function loadMe(db: Db, userId: string): Promise<Me> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      roles: users.roles,
      nickname: profiles.nickname,
      nicknameHidden: profiles.nicknameHidden,
      avatar: profiles.avatar,
      coins: profiles.coinBalance,
      xp: profiles.xp,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId));
  if (!row) throw notFound("Profile");
  return { ...row, roles: row.roles as Role[], avatar: row.avatar as AvatarConfig };
}

const profileBody = z.object({ nickname: z.string().optional(), avatar: z.unknown().optional() });

export async function meRoutes(app: FastifyInstance) {
  app.get("/api/me", async (request) => loadMe(app.db, requireUser(request).id));

  app.patch("/api/me/profile", async (request) => {
    const user = requireUser(request);
    const body = profileBody.parse(request.body);
    const set: Partial<typeof profiles.$inferInsert> = {};

    if (body.nickname !== undefined) {
      const check = checkNickname(body.nickname);
      if (!check.ok) throw badRequest("invalid_nickname", check.reason);
      set.nickname = body.nickname;
      // A new nickname clears a moderation hide; it can be reported again.
      set.nicknameHidden = false;
    }
    if (body.avatar !== undefined) {
      if (!isValidAvatar(body.avatar)) throw badRequest("invalid_avatar", "Choose avatar options from the list.");
      set.avatar = body.avatar;
    }
    if (Object.keys(set).length) {
      try {
        await app.db
          .update(profiles)
          .set({ ...set, updatedAt: sql`now()` })
          .where(eq(profiles.userId, user.id));
      } catch (err) {
        if (isUniqueViolation(err, "profiles_nickname_lower_uq")) throw conflict("nickname_taken", "That nickname is taken.");
        throw err;
      }
    }
    return loadMe(app.db, user.id);
  });
}
