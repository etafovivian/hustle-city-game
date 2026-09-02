// Rain: buy an umbrella from a roadside hawker, or get soaked walking in the rain (Style and Health drop, at most
// once an hour). Floods and the rain surge on fares are worked out from the shared weather (same for everyone).

import { playerItems } from "@hc/db";
import { SOAKED, UMBRELLA, floodedAreas, weatherAt } from "@hc/shared";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { requireUser } from "../../plugins/auth.js";
import { loadNeeds, needsView, saveNeeds } from "./needs.js";

const hasItem = async (tx: Tx, userId: string, item: string) =>
  (await tx.select().from(playerItems).where(and(eq(playerItems.userId, userId), eq(playerItems.item, item)))).length > 0;

export async function weatherRoutes(app: FastifyInstance) {
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date()));

  app.get("/api/game/weather", async (request) => {
    const user = requireUser(request);
    return inTx(async (tx, now) => ({ weather: weatherAt(now), flooded: floodedAreas(now), umbrella: await hasItem(tx, user.id, "umbrella") }));
  });

  app.post("/api/game/umbrella", async (request) => {
    const user = requireUser(request);
    return inTx(async (tx) => {
      await lockProfile(tx, user.id);
      if (await hasItem(tx, user.id, "umbrella")) throw new AppError(409, "owned", "You already have an umbrella.");
      const posting = await postCoins(tx, user.id, -UMBRELLA.price, "home_item", "item:umbrella");
      await tx.insert(playerItems).values({ userId: user.id, item: "umbrella" });
      return { balance: posting.balance, umbrella: true };
    });
  });

  // Walked in the rain: soaked unless you have an umbrella.
  app.post("/api/game/soaked", async (request) => {
    const user = requireUser(request);
    return inTx(async (tx, now) => {
      const w = weatherAt(now);
      if (w !== "rain" && w !== "storm") return { soaked: false };
      if (await hasItem(tx, user.id, "umbrella")) return { soaked: false, umbrella: true };
      const { needs, freeAt } = await loadNeeds(tx, user.id, now);
      const last = freeAt.soaked ? new Date(freeAt.soaked).getTime() : 0;
      if (now.getTime() - last < SOAKED.cooldownMs) return { soaked: false };
      const wet = { ...needs, style: Math.max(0, needs.style + SOAKED.style), health: Math.max(0, needs.health + SOAKED.health) };
      await saveNeeds(tx, user.id, wet, now, { ...freeAt, soaked: now.toISOString() });
      return { soaked: true, ...needsView(wet) };
    });
  });
}
