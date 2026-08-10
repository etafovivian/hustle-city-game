// Land interest: players say which plot they want; the owner sees who to contact when ownership opens.

import { landInterest, users } from "@hc/db";
import { PLOT_ID, type LandInterestView } from "@hc/shared";
import { and, count, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import { requireRole, requireUser } from "../plugins/auth.js";

/** Most plots one player can hold interest in, so the list stays meaningful. */
const MAX_INTEREST = 10;

export async function landRoutes(app: FastifyInstance) {
  const plotParam = (raw: string) => {
    if (!PLOT_ID.test(raw)) throw new AppError(400, "bad_plot", "That isn't a plot on the map.");
    return raw;
  };

  const view = async (userId?: string): Promise<LandInterestView> => {
    const rows = await app.db.select({ plotId: landInterest.plotId, n: count() }).from(landInterest).groupBy(landInterest.plotId);
    const mine = userId ? await app.db.select({ plotId: landInterest.plotId }).from(landInterest).where(eq(landInterest.userId, userId)) : [];
    return { counts: Object.fromEntries(rows.map((r) => [r.plotId, Number(r.n)])), mine: mine.map((r) => r.plotId) };
  };

  app.get("/api/land/interest", async (request) => view(request.user?.id));

  app.post<{ Params: { plotId: string } }>("/api/land/:plotId/interest", async (request) => {
    const user = requireUser(request);
    const plotId = plotParam(request.params.plotId);
    const [{ n }] = (await app.db.select({ n: count() }).from(landInterest).where(eq(landInterest.userId, user.id))) as [{ n: number }];
    if (Number(n) >= MAX_INTEREST) throw new AppError(409, "too_many", `You can ask about up to ${MAX_INTEREST} plots. Drop one first.`);
    await app.db.insert(landInterest).values({ userId: user.id, plotId }).onConflictDoNothing();
    return view(user.id);
  });

  app.delete<{ Params: { plotId: string } }>("/api/land/:plotId/interest", async (request) => {
    const user = requireUser(request);
    const plotId = plotParam(request.params.plotId);
    await app.db.delete(landInterest).where(and(eq(landInterest.userId, user.id), eq(landInterest.plotId, plotId)));
    return view(user.id);
  });

  // Admin: who wants which plot, newest first.
  app.get("/api/admin/land-interest", async (request) => {
    requireRole(request, "admin");
    return app.db
      .select({ plotId: landInterest.plotId, email: users.email, createdAt: landInterest.createdAt })
      .from(landInterest)
      .innerJoin(users, eq(users.id, landInterest.userId))
      .orderBy(desc(landInterest.createdAt))
      .limit(500);
  });
}
