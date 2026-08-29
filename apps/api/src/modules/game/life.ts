// Life in the city: jobs at places (shifts, pay, promotions), your home (starter room or a house on a plot you
// bought), resting at home, and your own bike or car. All money here is City Coins.

import { businessPlots, gameLedgerEntries, homeItems, playerJobs, playerPlots, playerVehicles, profiles } from "@hc/db";
import {
  GENERATORS,
  HOME_ITEM_BY_KEY,
  OUTAGE_CHANCE,
  hasLight,
  plotInfo,
  HOUSE_BY_KEY,
  JOB_BY_VENUE,
  MAX_PLOTS,
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
  restEnergy,
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
import { graduatePay, isGraduate } from "../university.js";

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
      const pay = graduatePay(shiftPay(job, rung), await isGraduate(tx, user.id));
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

  // ── Home and land ──
  /** Your plots (land and houses), your home among them, and your furniture. */
  const homeView = async (tx: Tx, userId: string, now: Date): Promise<HomeView> => {
    const plots = await tx.select().from(playerPlots).where(eq(playerPlots.userId, userId));
    const rows = await tx.select().from(homeItems).where(eq(homeItems.userId, userId));
    const items = rows.map((r) => r.itemKey);
    const placements = Object.fromEntries(rows.filter((r) => r.room && r.x !== null && r.y !== null).map((r) => [r.itemKey, { room: r.room!, x: r.x!, y: r.y! }]));
    const home = plots.find((p) => p.isHome && p.design);
    const { freeAt } = await loadNeeds(tx, userId, now);
    const last = freeAt.__home ? new Date(freeAt.__home).getTime() : 0;
    const again = last + REST.everyMs;
    return {
      plotId: home?.plotId ?? null,
      design: home?.design ?? null,
      plots: plots.map((p) => ({ plotId: p.plotId, design: p.design, isHome: p.isHome })),
      items,
      placements,
      restEnergy: restEnergy(items),
      restAgainAt: again > now.getTime() ? new Date(again).toISOString() : null,
    };
  };

  app.get("/api/game/home", async (request): Promise<HomeView> => {
    const user = requireUser(request);
    return inTx((tx, now) => homeView(tx, user.id, now));
  });

  app.post("/api/game/home/rest", async (request) => {
    const user = requireUser(request);
    // The starter room's area comes from the client (it's placed on the client's map); it only affects your own rest.
    const { area } = z.object({ area: z.string().max(40).optional() }).parse(request.body ?? {});
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const { needs, freeAt } = await loadNeeds(tx, user.id, now);
      const last = freeAt.__home ? new Date(freeAt.__home).getTime() : 0;
      if (now.getTime() - last < REST.everyMs) throw new AppError(409, "rested", "You rested not long ago. Go and enjoy the city.");
      const items = (await tx.select({ k: homeItems.itemKey }).from(homeItems).where(eq(homeItems.userId, user.id))).map((r) => r.k);
      // NEPA: no light at home means a hot, short night, unless you have a generator.
      const [homePlot] = await tx.select().from(playerPlots).where(and(eq(playerPlots.userId, user.id), eq(playerPlots.isHome, true)));
      const homeArea = homePlot ? plotInfo(homePlot.plotId)?.area : area && OUTAGE_CHANCE[area] !== undefined ? area : undefined;
      const light = homeArea ? hasLight(homeArea, now) : true;
      const generator = items.some((k) => GENERATORS.includes(k));
      const gain = !light && !generator ? Math.round(restEnergy(items) / 2) : restEnergy(items);
      const rested = { ...needs, energy: Math.min(100, needs.energy + gain) };
      await saveNeeds(tx, user.id, rested, now, { ...freeAt, __home: now.toISOString() });
      return { ...needsView(rested), gained: gain, light, generator };
    });
  });

  /** A plot you own, or 404. */
  const ownPlot = async (tx: Tx, userId: string, plotId: string) => {
    const [p] = await tx.select().from(playerPlots).where(and(eq(playerPlots.plotId, plotId), eq(playerPlots.userId, userId)));
    if (!p) throw notFound("Plot");
    return p;
  };

  // Buy a plot for sale with City Coins: land only, or land and a house in one go. Up to MAX_PLOTS each.
  app.post<{ Params: { plotId: string } }>("/api/land/:plotId/buy", async (request, reply) => {
    const user = requireUser(request);
    const plotId = request.params.plotId;
    const { design } = z.object({ design: z.string().max(40).optional() }).parse(request.body ?? {});
    const house = design ? HOUSE_BY_KEY.get(design) : undefined;
    const land = PLOT_ID.test(plotId) ? plotPriceOf(plotId) : null;
    if (land === null) throw new AppError(400, "bad_plot", "That plot isn't for sale.");
    if (design && !house) throw new AppError(400, "bad_design", "Pick a house from the list.");
    const result = await inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const mine = await tx.select().from(playerPlots).where(eq(playerPlots.userId, user.id));
      if (mine.length >= MAX_PLOTS) throw new AppError(409, "too_many_plots", `You can own up to ${MAX_PLOTS} plots for now.`);
      const [takenPlot] = await tx.select().from(playerPlots).where(eq(playerPlots.plotId, plotId));
      const [takenBiz] = await tx.select().from(businessPlots).where(eq(businessPlots.plotId, plotId));
      if (takenPlot || takenBiz) throw new AppError(409, "plot_taken", "Someone already owns that plot.");
      let posting = await postCoins(tx, user.id, -land, "land", `land:${plotId}:${randomUUID()}`);
      if (house) posting = await postCoins(tx, user.id, -house.price, "house", `house:${plotId}:${house.key}:${randomUUID()}`);
      // Your first house becomes your home.
      const isHome = !!house && !mine.some((p) => p.isHome);
      await tx.insert(playerPlots).values({ userId: user.id, plotId, design: house?.key ?? null, isHome });
      return { plotId, design: house?.key ?? null, paid: land + (house?.price ?? 0), balance: posting.balance, home: await homeView(tx, user.id, now) };
    });
    return reply.code(201).send(result);
  });

  // Build (or rebuild) a house on a plot you own; rebuilding gives back half of the old house.
  app.post<{ Params: { plotId: string } }>("/api/plots/:plotId/build", async (request) => {
    const user = requireUser(request);
    const { design } = z.object({ design: z.string().max(40) }).parse(request.body);
    const house = HOUSE_BY_KEY.get(design);
    if (!house) throw new AppError(400, "bad_design", "Pick a house from the list.");
    return inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const plot = await ownPlot(tx, user.id, request.params.plotId);
      if (plot.design === house.key) return { design: house.key, paid: 0, home: await homeView(tx, user.id, now) };
      const credit = plot.design ? Math.round((HOUSE_BY_KEY.get(plot.design)?.price ?? 0) * REBUILD_CREDIT) : 0;
      const cost = Math.max(0, house.price - credit);
      if (cost > 0) await postCoins(tx, user.id, -cost, "house", `house:${plot.plotId}:${house.key}:${randomUUID()}`);
      const hasHome = (await tx.select().from(playerPlots).where(and(eq(playerPlots.userId, user.id), eq(playerPlots.isHome, true)))).length > 0;
      await tx.update(playerPlots).set({ design: house.key, ...(hasHome ? {} : { isHome: true }) }).where(eq(playerPlots.plotId, plot.plotId));
      return { design: house.key, paid: cost, home: await homeView(tx, user.id, now) };
    });
  });

  // Choose which of your houses is home.
  app.post<{ Params: { plotId: string } }>("/api/plots/:plotId/home", async (request) => {
    const user = requireUser(request);
    return inTx(async (tx, now) => {
      const plot = await ownPlot(tx, user.id, request.params.plotId);
      if (!plot.design) throw new AppError(409, "no_house", "Build a house there first.");
      await tx.update(playerPlots).set({ isHome: false }).where(eq(playerPlots.userId, user.id));
      await tx.update(playerPlots).set({ isHome: true }).where(eq(playerPlots.plotId, plot.plotId));
      return homeView(tx, user.id, now);
    });
  });

  // Things for the house.
  app.post("/api/game/home/items", async (request, reply) => {
    const user = requireUser(request);
    const { key } = z.object({ key: z.string().max(40) }).parse(request.body);
    const item = HOME_ITEM_BY_KEY.get(key);
    if (!item) throw notFound("Item");
    const result = await inTx(async (tx, now) => {
      await lockProfile(tx, user.id);
      const [owned] = await tx.select().from(homeItems).where(and(eq(homeItems.userId, user.id), eq(homeItems.itemKey, key)));
      if (owned) throw new AppError(409, "owned", "You already have that.");
      await postCoins(tx, user.id, -item.price, "home_item", `home_item:${user.id}:${key}`);
      await tx.insert(homeItems).values({ userId: user.id, itemKey: key });
      return homeView(tx, user.id, now);
    });
    return reply.code(201).send(result);
  });

  // Arrange furniture: put an item you own in a room of your home, at a spot (fractions of the room image).
  app.patch<{ Params: { key: string } }>("/api/game/home/items/:key", async (request) => {
    const user = requireUser(request);
    const { room, x, y } = z.object({ room: z.string().regex(/^[a-z_]{2,20}$/), x: z.number().min(0.05).max(0.95), y: z.number().min(0.3).max(0.98) }).parse(request.body);
    const [row] = await app.db
      .update(homeItems)
      .set({ room, x, y })
      .where(and(eq(homeItems.userId, user.id), eq(homeItems.itemKey, request.params.key.slice(0, 40))))
      .returning({ k: homeItems.itemKey });
    if (!row) throw notFound("Item");
    return { ok: true };
  });

  app.get("/api/map/homes", async (request): Promise<MapHome[]> => {
    const rows = await app.db
      .select({ plotId: playerPlots.plotId, design: playerPlots.design, isHome: playerPlots.isHome, userId: playerPlots.userId, nickname: profiles.nickname, hidden: profiles.nicknameHidden })
      .from(playerPlots)
      .innerJoin(profiles, eq(profiles.userId, playerPlots.userId));
    return rows.map((r) => ({ plotId: r.plotId, design: r.design, isHome: r.isHome, nickname: r.hidden ? "a player" : r.nickname, mine: r.userId === request.user?.id }));
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
