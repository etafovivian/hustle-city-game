// Life in the city: jobs at places (shifts, pay, promotions), your home (starter room or a house on a plot you
// bought), resting at home, and your own bike or car. All money here is City Coins.

import { businessPlots, gameLedgerEntries, playerHomes, playerJobs, playerVehicles, profiles } from "@hc/db";
import {
  HOUSE_BY_KEY,
  JOB_BY_VENUE,
  MIN_ENERGY,
  PLOT_ID,
  REBUILD_CREDIT,
  REST,
  SHIFTS_PER_DAY,
  SHIFT_COST,
  VEHICLE_BY_KIND,
  VENUES_BY_KEY,
  clockHour,
  dayKey,
  isOpenAt,
  jobView,
  lagosHourOf,
  plotPriceOf,
  rungFor,
  shiftPay,
  venueHours,
  type HomeView,
  type MapHome,
  type Needs,
  type VehicleKind,
} from "@hc/shared";
import { randomUUID } from "node:crypto";
import { and, count, eq, like, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postCoins } from "../../lib/coins.js";
import { lockProfile, type Tx } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";
import { requireUser } from "../../plugins/auth.js";
import { loadNeeds, needsView, saveNeeds } from "./needs.js";

const shiftsToday = async (tx: Tx, userId: string, day: string) => {
  const [{ n }] = (await tx
    .select({ n: count() })
    .from(gameLedgerEntries)
    .where(and(eq(gameLedgerEntries.userId, userId), like(gameLedgerEntries.reference, `shift:${day}:%`)))) as [{ n: number }];
  return Number(n);
};

export async function lifeRoutes(app: FastifyInstance) {
  const tz = app.config.GAME_TIMEZONE;
  const inTx = <T>(fn: (tx: Tx, now: Date) => Promise<T>) => app.db.transaction((tx) => fn(tx, new Date()));

  // ── Jobs ──
  const jobFor = (venue: string) => {
    const job = JOB_BY_VENUE.get(venue.slice(0, 40));
    if (!job) throw notFound("Job");
    return job;
  };

  app.get<{ Params: { venue: string } }>("/api/game/jobs/:venue", async (request) => {
    const user = requireUser(request);
    const job = jobFor(request.params.venue);
    return inTx(async (tx, now) => {
      const [row] = await tx.select().from(playerJobs).where(and(eq(playerJobs.userId, user.id), eq(playerJobs.venue, job.venue)));
      return jobView(job, row?.shifts ?? 0, await shiftsToday(tx, user.id, dayKey(now, tz)));
    });
  });

  app.post<{ Params: { venue: string } }>("/api/game/jobs/:venue/shift", async (request) => {
    const user = requireUser(request);
    const job = jobFor(request.params.venue);
    const venue = VENUES_BY_KEY.get(job.venue)!;
    return inTx(async (tx, now) => {
      if (!isOpenAt(venue, lagosHourOf(now))) throw new AppError(409, "closed", `${venue.name} is closed. Shifts start when it opens at ${clockHour(venueHours(venue)![0])}.`);
      await lockProfile(tx, user.id);
      const day = dayKey(now, tz);
      const done = await shiftsToday(tx, user.id, day);
      if (done >= SHIFTS_PER_DAY) throw new AppError(409, "enough_today", `You've worked ${SHIFTS_PER_DAY} shifts today. Rest and come back tomorrow.`);
      const { needs } = await loadNeeds(tx, user.id, now);
      if (needs.energy < MIN_ENERGY) throw new AppError(409, "too_tired", "You're too tired to work. Go home and rest, or grab something to eat.");
      const [row] = await tx.select().from(playerJobs).where(and(eq(playerJobs.userId, user.id), eq(playerJobs.venue, job.venue)));
      const before = row?.shifts ?? 0;
      const rung = rungFor(before);
      const pay = shiftPay(job, rung);
      const view0 = jobView(job, before, done);
      const posting = await postCoins(tx, user.id, pay, "shift_pay", `shift:${day}:${randomUUID()}`);
      await tx.update(profiles).set({ xp: sql`${profiles.xp} + ${view0.xp}` }).where(eq(profiles.userId, user.id));
      await tx
        .insert(playerJobs)
        .values({ userId: user.id, venue: job.venue, shifts: 1, updatedAt: now })
        .onConflictDoUpdate({ target: [playerJobs.userId, playerJobs.venue], set: { shifts: sql`${playerJobs.shifts} + 1`, updatedAt: now } });
      const tired: Needs = { ...needs, energy: Math.max(0, needs.energy - SHIFT_COST.energy), food: Math.max(0, needs.food - SHIFT_COST.food) };
      await saveNeeds(tx, user.id, tired, now);
      const view = jobView(job, before + 1, done + 1);
      return { pay, xp: view0.xp, balance: posting.balance, promoted: view.rung > rung ? view.title : null, job: view, ...needsView(tired) };
    });
  });

  // ── Home ──
  app.get("/api/game/home", async (request): Promise<HomeView> => {
    const user = requireUser(request);
    return inTx(async (tx, now) => {
      const [home] = await tx.select().from(playerHomes).where(eq(playerHomes.userId, user.id));
      const { freeAt } = await loadNeeds(tx, user.id, now);
      const last = freeAt.__home ? new Date(freeAt.__home).getTime() : 0;
      const again = last + REST.everyMs;
      return { plotId: home?.plotId ?? null, design: home?.design ?? null, restAgainAt: again > now.getTime() ? new Date(again).toISOString() : null };
    });
  });

  app.post("/api/game/home/rest", async (request) => {
    const user = requireUser(request);
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const { needs, freeAt } = await loadNeeds(tx, user.id, now);
      const last = freeAt.__home ? new Date(freeAt.__home).getTime() : 0;
      if (now.getTime() - last < REST.everyMs) throw new AppError(409, "rested", "You rested not long ago. Go and enjoy the city.");
      const rested = { ...needs, energy: Math.min(100, needs.energy + REST.energy) };
      await saveNeeds(tx, user.id, rested, now, { ...freeAt, __home: now.toISOString() });
      return needsView(rested);
    });
  });

  // Buy a plot for sale and build a house on it (City Coins). One home per player for now.
  app.post<{ Params: { plotId: string } }>("/api/land/:plotId/buy", async (request, reply) => {
    const user = requireUser(request);
    const plotId = request.params.plotId;
    const { design } = z.object({ design: z.string().max(40) }).parse(request.body);
    const house = HOUSE_BY_KEY.get(design);
    const land = PLOT_ID.test(plotId) ? plotPriceOf(plotId) : null;
    if (land === null) throw new AppError(400, "bad_plot", "That plot isn't for sale.");
    if (!house) throw new AppError(400, "bad_design", "Pick a house from the list.");
    const result = await inTx(async (tx) => {
      await lockProfile(tx, user.id);
      const [mine] = await tx.select().from(playerHomes).where(eq(playerHomes.userId, user.id));
      if (mine) throw new AppError(409, "has_home", "You already own a home. Sell it first (coming soon) or rebuild it.");
      const [takenHome] = await tx.select().from(playerHomes).where(eq(playerHomes.plotId, plotId));
      const [takenBiz] = await tx.select().from(businessPlots).where(eq(businessPlots.plotId, plotId));
      if (takenHome || takenBiz) throw new AppError(409, "plot_taken", "Someone already owns that plot.");
      await postCoins(tx, user.id, -land, "land", `land:${plotId}`);
      const posting = await postCoins(tx, user.id, -house.price, "house", `house:${user.id}:${plotId}:${house.key}`);
      await tx.insert(playerHomes).values({ userId: user.id, plotId, design: house.key });
      return { plotId, design: house.key, paid: land + house.price, balance: posting.balance };
    });
    return reply.code(201).send(result);
  });

  // Rebuild: a different house on your plot (pay the new design, get half the old one back).
  app.post("/api/game/home/design", async (request) => {
    const user = requireUser(request);
    const { design } = z.object({ design: z.string().max(40) }).parse(request.body);
    const house = HOUSE_BY_KEY.get(design);
    if (!house) throw new AppError(400, "bad_design", "Pick a house from the list.");
    return inTx(async (tx) => {
      await lockProfile(tx, user.id);
      const [home] = await tx.select().from(playerHomes).where(eq(playerHomes.userId, user.id));
      if (!home) throw new AppError(409, "no_home", "Buy a plot first.");
      if (home.design === house.key) return { design: house.key, paid: 0 };
      const credit = Math.round(HOUSE_BY_KEY.get(home.design)!.price * REBUILD_CREDIT);
      const cost = Math.max(0, house.price - credit);
      if (cost > 0) await postCoins(tx, user.id, -cost, "house", `house:${user.id}:${home.plotId}:${house.key}:${randomUUID()}`);
      await tx.update(playerHomes).set({ design: house.key }).where(eq(playerHomes.userId, user.id));
      return { design: house.key, paid: cost };
    });
  });

  app.get("/api/map/homes", async (request): Promise<MapHome[]> => {
    const rows = await app.db
      .select({ plotId: playerHomes.plotId, design: playerHomes.design, userId: playerHomes.userId, nickname: profiles.nickname, hidden: profiles.nicknameHidden })
      .from(playerHomes)
      .innerJoin(profiles, eq(profiles.userId, playerHomes.userId));
    return rows.map((r) => ({ plotId: r.plotId, design: r.design, nickname: r.hidden ? "a player" : r.nickname, mine: r.userId === request.user?.id }));
  });

  // ── Vehicles ──
  app.get("/api/game/vehicles", async (request) => {
    const user = requireUser(request);
    const rows = await app.db.select({ kind: playerVehicles.kind }).from(playerVehicles).where(eq(playerVehicles.userId, user.id));
    return rows.map((r) => r.kind as VehicleKind);
  });

  app.post("/api/game/vehicles", async (request, reply) => {
    const user = requireUser(request);
    const { kind } = z.object({ kind: z.enum(["bike", "keke", "saloon", "suv"]) }).parse(request.body);
    const v = VEHICLE_BY_KIND.get(kind)!;
    const result = await inTx(async (tx) => {
      await lockProfile(tx, user.id);
      const [owned] = await tx.select().from(playerVehicles).where(and(eq(playerVehicles.userId, user.id), eq(playerVehicles.kind, kind)));
      if (owned) throw new AppError(409, "owned", `You already have a ${v.label.toLowerCase()}.`);
      const posting = await postCoins(tx, user.id, -v.price, "vehicle", `vehicle:${user.id}:${kind}`);
      await tx.insert(playerVehicles).values({ userId: user.id, kind });
      return { kind, balance: posting.balance };
    });
    return reply.code(201).send(result);
  });
}
