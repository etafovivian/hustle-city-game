// The daily kola-nut hunt (see @hc/shared hunt.ts): each nut pays once a day; all five pay a bonus.

import { gameLedgerEntries, profiles } from "@hc/db";
import { HUNT, dayKey, type HuntView } from "@hc/shared";
import { and, eq, like, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { requireUser } from "../../plugins/auth.js";

export async function huntRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const found = async (tx: Tx | FastifyInstance["db"], userId: string, day: string) =>
    (
      await tx
        .select({ ref: gameLedgerEntries.reference })
        .from(gameLedgerEntries)
        .where(and(eq(gameLedgerEntries.userId, userId), like(gameLedgerEntries.reference, `hunt:${day}:%`)))
    )
      .map((r) => Number(r.ref.split(":")[2]))
      .filter((n) => Number.isInteger(n));

  app.get("/api/game/hunt", async (request): Promise<HuntView> => {
    const user = requireUser(request);
    const day = dayKey(new Date(), tz);
    return { day, found: await found(app.db, user.id, day) };
  });

  app.post<{ Params: { index: string } }>("/api/game/hunt/:index", async (request) => {
    const user = requireUser(request);
    const index = z.coerce.number().int().min(0).max(HUNT.count - 1).parse(request.params.index);
    const day = dayKey(new Date(), tz);
    return app.db.transaction(async (tx) => {
      await lockProfile(tx, user.id);
      const posting = await postCoins(tx, user.id, HUNT.coins, "game_reward", `hunt:${day}:${index}`);
      if (!posting.applied) throw new AppError(409, "found", "You found that one already today.");
      await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${HUNT.xp}` }).where(eq(profiles.userId, user.id));
      const all = await found(tx, user.id, day);
      let bonus = false;
      if (all.length >= HUNT.count) {
        const b = await postCoins(tx, user.id, HUNT.bonusCoins, "game_reward", `huntall:${day}`);
        if (b.applied) {
          bonus = true;
          await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${HUNT.bonusXp}` }).where(eq(profiles.userId, user.id));
        }
      }
      return { day, found: all, bonus };
    });
  });
}
