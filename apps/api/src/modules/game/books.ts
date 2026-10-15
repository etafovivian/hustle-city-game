// Holy books (see @hc/shared books.ts): reading a while brings a calm mind, once a Lagos day.

import { BOOK_KEYS, READ_GIVES, dayKey, type BookKey } from "@hc/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Tx } from "../../lib/db.js";
import { requireUser } from "../../plugins/auth.js";
import { loadNeeds, needsView, saveNeeds } from "./needs.js";
import { recordEvents } from "./quests.js";

export async function bookRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date()));

  app.post("/api/game/read", async (request) => {
    const user = requireUser(request);
    z.object({ book: z.enum(BOOK_KEYS as [BookKey, ...BookKey[]]) }).parse(request.body);
    return inTx(async (tx, now) => {
      const { needs, freeAt } = await loadNeeds(tx, user.id, now);
      const day = dayKey(now, tz);
      if (freeAt.__read === day) return { calm: false, ...needsView(needs) };
      await recordEvents(tx, user.id, [{ type: "verse_read" }], now, tz);
      const next = { ...needs, energy: Math.min(100, needs.energy + READ_GIVES.energy), fun: Math.min(100, needs.fun + READ_GIVES.fun) };
      await saveNeeds(tx, user.id, next, now, { ...freeAt, __read: day });
      return { calm: true, ...needsView(next) };
    });
  });
}
