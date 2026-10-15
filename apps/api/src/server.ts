import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { createDb, type Db } from "@hc/db";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import { AppError } from "./lib/errors.js";
import { authRoutes } from "./modules/auth.js";
import { billboardRoutes } from "./modules/billboards.js";
import { businessRoutes } from "./modules/businesses.js";
import { serviceRoutes } from "./modules/services.js";
import { academyRoutes } from "./modules/academy.js";
import { landRoutes } from "./modules/land.js";
import { dealRoutes } from "./modules/deals.js";
import { lifeRoutes } from "./modules/game/life.js";
import { presenceRoutes } from "./modules/presence.js";
import { playRoutes } from "./modules/games.js";
import { universityRoutes } from "./modules/university.js";
import { crewRoutes } from "./modules/crew.js";
import { weatherRoutes } from "./modules/game/weather.js";
import { skillRoutes } from "./modules/game/skills.js";
import { gadgetRoutes } from "./modules/game/gadgets.js";
import { reservationRoutes } from "./modules/reservations.js";
import { sponsorRoutes } from "./modules/sponsors.js";
import { feedbackRoutes } from "./modules/feedback.js";
import { hustleRoutes } from "./modules/hustle.js";
import { partnerRoutes } from "./modules/game/partners.js";
import { partyRoutes } from "./modules/game/party.js";
import { bookRoutes } from "./modules/game/books.js";
import { petRoutes } from "./modules/game/pets.js";
import { statsRoutes } from "./modules/stats.js";
import { jobsBoardRoutes } from "./modules/jobsboard.js";
import { huntRoutes } from "./modules/game/hunt.js";
import { gameRoutes } from "./modules/game/routes.js";
import { marketRoutes } from "./modules/market.js";
import { meRoutes } from "./modules/me.js";
import { moderationRoutes } from "./modules/moderation.js";
import { authPlugin } from "./plugins/auth.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    config: Config;
  }
}

export async function buildServer(config: Config, options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.LOG_LEVEL,
            // Never log credentials or session cookies.
            redact: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']"],
          },
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });

  const { db, client } = createDb(config.DATABASE_URL);
  app.decorate("db", db);
  app.decorate("config", config);
  app.addHook("onClose", async () => {
    await client.end();
  });

  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(authPlugin);

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    }
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.code(400).send({
        error: "validation_error",
        message: first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request.",
      });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.code(status).send({ error: "request_error", message: (err as Error).message });
    }
    request.log.error(err);
    return reply.code(500).send({ error: "internal_error", message: "Something went wrong." });
  });

  app.get("/api/health", async () => {
    await db.execute(sql`select 1`);
    return { ok: true };
  });

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(gameRoutes);
  await app.register(marketRoutes);
  await app.register(moderationRoutes);
  await app.register(businessRoutes);
  await app.register(serviceRoutes);
  await app.register(billboardRoutes);
  await app.register(academyRoutes);
  await app.register(landRoutes);
  await app.register(dealRoutes);
  await app.register(lifeRoutes);
  await app.register(presenceRoutes);
  await app.register(playRoutes);
  await app.register(universityRoutes);
  await app.register(crewRoutes);
  await app.register(weatherRoutes);
  await app.register(skillRoutes);
  await app.register(gadgetRoutes);
  await app.register(reservationRoutes);
  await app.register(sponsorRoutes);
  await app.register(jobsBoardRoutes);
  await app.register(hustleRoutes);
  await app.register(feedbackRoutes);
  await app.register(partnerRoutes);
  await app.register(partyRoutes);
  await app.register(bookRoutes);
  await app.register(petRoutes);
  await app.register(statsRoutes);
  await app.register(huntRoutes);

  return app;
}
