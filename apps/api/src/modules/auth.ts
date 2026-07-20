import { hashPassword, profiles, users, verifyPassword } from "@hc/db";
import { DEFAULT_AVATAR, checkNickname, isValidAvatar } from "@hc/shared";
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { AppError, badRequest, conflict, isUniqueViolation } from "../lib/errors.js";
import { endSession, startSession } from "../plugins/auth.js";
import { createShop } from "./game/shop.js";
import { loadMe } from "./me.js";

const registerBody = z.object({
  email: z.email().max(254),
  password: z.string().min(10).max(200),
  nickname: z.string(),
  avatar: z.unknown().optional(),
  confirmAdult: z.literal(true, { error: "Hustle City is for adults aged 18 and over." }),
});

const loginBody = z.object({ email: z.string().max(254), password: z.string().max(200) });

// Equalise timing when the email is unknown.
const DUMMY_HASH = hashPassword("timing-equaliser-not-a-real-password");

export async function authRoutes(app: FastifyInstance) {
  const authLimit = { config: { rateLimit: { max: app.config.AUTH_RATE_LIMIT, timeWindow: "1 minute" } } };

  app.post("/api/auth/register", authLimit, async (request, reply) => {
    const body = registerBody.parse(request.body);
    const nick = checkNickname(body.nickname);
    if (!nick.ok) throw badRequest("invalid_nickname", nick.reason);
    const avatar = body.avatar === undefined ? DEFAULT_AVATAR : body.avatar;
    if (!isValidAvatar(avatar)) throw badRequest("invalid_avatar", "Choose avatar options from the list.");

    const passwordHash = await hashPassword(body.password);
    const now = new Date();
    let userId: string;
    try {
      userId = await app.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ email: body.email.trim(), passwordHash })
          .returning({ id: users.id });
        await tx.insert(profiles).values({ userId: user!.id, nickname: body.nickname, avatar });
        if (app.config.STARTING_COINS > 0) {
          await postCoins(tx, user!.id, app.config.STARTING_COINS, "signup_grant", "signup_grant");
        }
        await createShop(tx, user!.id, body.nickname, now);
        return user!.id;
      });
    } catch (err) {
      if (isUniqueViolation(err, "users_email_lower_uq")) throw conflict("email_taken", "An account with that email already exists.");
      if (isUniqueViolation(err, "profiles_nickname_lower_uq")) throw conflict("nickname_taken", "That nickname is taken.");
      throw err;
    }

    await startSession(app, reply, userId);
    return reply.code(201).send(await loadMe(app.db, userId));
  });

  app.post("/api/auth/login", authLimit, async (request, reply) => {
    const body = loginBody.parse(request.body);
    const [user] = await app.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${body.email.trim()})`);
    const ok = await verifyPassword(body.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !ok) throw new AppError(401, "invalid_credentials", "Email or password is incorrect.");
    if (user.status !== "active") throw new AppError(403, "account_suspended", "This account is suspended.");

    await startSession(app, reply, user.id);
    return loadMe(app.db, user.id);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await endSession(app, request, reply);
    return reply.code(204).send();
  });
}
