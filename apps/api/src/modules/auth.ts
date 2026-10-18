import { auditEvents, feedback, hashPassword, issueResetLink, profiles, useResetLink, users, verifyPassword } from "@hc/db";
import { DEFAULT_AVATAR, DREAMS_BY_KEY, HUSTLES_BY_KEY, checkNickname, checkShopName, cleanAvatar, isValidAvatar, passwordProblem } from "@hc/shared";
import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { postCoins } from "../lib/coins.js";
import { AppError, badRequest, conflict, isUniqueViolation } from "../lib/errors.js";
import { endOtherSessions, endSession, requireRole, requireUser, startSession } from "../plugins/auth.js";
import { createShop } from "./game/shop.js";
import { loadMe } from "./me.js";
import { joinCrew } from "./crew.js";

const registerBody = z.object({
  email: z.email().max(254),
  password: z.string().max(200),
  nickname: z.string(),
  avatar: z.unknown().optional(),
  hustle: z.string().optional(),
  dream: z.string().optional(),
  shopName: z.string().max(60).optional(),
  /** The nickname of the friend whose invite link brought them. */
  crew: z.string().max(30).optional(),
  confirmAdult: z.literal(true, { error: "Hustle City is for adults aged 18 and over." }),
});

/** `email` may also be the player's nickname. */
const loginBody = z.object({ email: z.string().max(254), password: z.string().max(200) });

const newPassword = z.string().superRefine((p, ctx) => {
  const problem = passwordProblem(p);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});
const changeBody = z.object({ currentPassword: z.string().max(200), newPassword });
const resetBody = z.object({ token: z.string().min(20).max(100), newPassword });
const resetLinkBody = z.object({ email: z.string().max(254) });

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
    const hustle = HUSTLES_BY_KEY.get(body.hustle ?? "trader");
    if (!hustle) throw badRequest("invalid_hustle", "Choose a hustle from the list.");
    const dream = DREAMS_BY_KEY.get(body.dream ?? "market_royalty");
    if (!dream) throw badRequest("invalid_dream", "Choose a dream from the list.");
    const shopName = (body.shopName ?? `${body.nickname}'s Shop`).trim();
    const shopCheck = checkShopName(shopName);
    if (!shopCheck.ok) throw badRequest("invalid_shop_name", shopCheck.reason);
    const pwProblem = passwordProblem(body.password, body.nickname);
    if (pwProblem) throw badRequest("weak_password", pwProblem);

    const passwordHash = await hashPassword(body.password);
    const now = new Date();
    let userId: string;
    try {
      userId = await app.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ email: body.email.trim(), passwordHash })
          .returning({ id: users.id });
        await tx
          .insert(profiles)
          .values({ userId: user!.id, nickname: body.nickname, avatar: cleanAvatar(avatar), hustle: hustle.key, dream: dream.key });
        if (app.config.STARTING_COINS > 0) {
          await postCoins(tx, user!.id, app.config.STARTING_COINS, "signup_grant", "signup_grant");
        }
        await createShop(tx, user!.id, shopName, now, hustle.starter);
        if (body.crew) await joinCrew(tx, user!.id, body.nickname, body.crew.replace(/^@/, ""));
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

  /** A player by email, or by nickname when there's no @ in it. */
  const findUser = (who: string) =>
    who.includes("@")
      ? app.db.select().from(users).where(sql`lower(${users.email}) = lower(${who})`)
      : app.db
          .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, status: users.status })
          .from(users)
          .innerJoin(profiles, eq(profiles.userId, users.id))
          .where(sql`lower(${profiles.nickname}) = lower(${who})`);

  // Sign-up: is this nickname free? (So people hear it on the first step, not after filling everything in.)
  app.get<{ Params: { nickname: string } }>("/api/auth/nickname/:nickname", authLimit, async (request) => {
    const nickname = request.params.nickname.slice(0, 40);
    const check = checkNickname(nickname);
    if (!check.ok) return { ok: false, reason: check.reason };
    const [taken] = await app.db.select({ id: profiles.userId }).from(profiles).where(sql`lower(${profiles.nickname}) = lower(${nickname})`);
    return taken ? { ok: false, reason: "That nickname is taken. Try another." } : { ok: true };
  });

  // Forgot password: the request shows up for the team in Phone → Admin, who send a reset link. Always the same
  // answer, so it never tells anyone whether an account exists.
  app.post("/api/auth/forgot", authLimit, async (request, reply) => {
    const { who } = z.object({ who: z.string().trim().min(3).max(254) }).parse(request.body);
    const [user] = await findUser(who.replace(/^@/, ""));
    if (user) {
      const [recent] = await app.db
        .select({ id: feedback.id })
        .from(feedback)
        .where(sql`${feedback.userId} = ${user.id} and ${feedback.kind} = 'reset' and ${feedback.createdAt} > now() - interval '1 hour'`);
      if (!recent) await app.db.insert(feedback).values({ userId: user.id, kind: "reset", message: `🔑 Asked for a password reset from the sign-in page (${user.email}).`, context: {} });
    }
    return reply.code(202).send({ message: "Got it. The team will send you a reset link (usually on WhatsApp or email) soon." });
  });

  app.post("/api/auth/login", authLimit, async (request, reply) => {
    const body = loginBody.parse(request.body);
    const who = body.email.trim().replace(/^@/, "");
    const [user] = await findUser(who);
    const ok = await verifyPassword(body.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !ok) throw new AppError(401, "invalid_credentials", "That email or nickname and password don't match. Check them, or tap \"Forgot your password?\".");
    if (user.status !== "active") throw new AppError(403, "account_suspended", "This account is suspended.");

    await startSession(app, reply, user.id);
    return loadMe(app.db, user.id);
  });

  // Change password while signed in; signs out every other device.
  app.post("/api/auth/password", authLimit, async (request, reply) => {
    const me = requireUser(request);
    const body = changeBody.parse(request.body);
    const [user] = await app.db.select().from(users).where(eq(users.id, me.id));
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw new AppError(401, "invalid_credentials", "Your current password is incorrect.");
    }
    const passwordHash = await hashPassword(body.newPassword);
    await app.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, me.id));
      await tx.insert(auditEvents).values({ actorId: me.id, action: "auth.password_changed", targetType: "user", targetId: me.id });
    });
    await endOtherSessions(app, request, me.id);
    return reply.code(204).send();
  });

  // Set a new password from a one-time reset link.
  app.post("/api/auth/reset", authLimit, async (request, reply) => {
    const body = resetBody.parse(request.body);
    if (!(await useResetLink(app.db, body.token, body.newPassword))) {
      throw new AppError(410, "reset_link_invalid", "This reset link has expired or was already used. Ask for a new one.");
    }
    return reply.code(204).send();
  });

  // Admin: issue a reset link for a player (no email delivery yet, so the admin passes it on).
  app.post("/api/admin/reset-link", async (request) => {
    const admin = requireRole(request, "admin");
    const { email } = resetLinkBody.parse(request.body);
    const base = request.headers.origin ?? app.config.allowedOrigins[0]!;
    const link = await issueResetLink(app.db, email, base, admin.id, "admin");
    if (!link) throw new AppError(404, "not_found", "No account with that email.");
    return link;
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await endSession(app, request, reply);
    return reply.code(204).send();
  });
}
