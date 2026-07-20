// Opaque session tokens in an httpOnly cookie; only the SHA-256 hash is stored.

import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@hc/shared";
import { sessions, users } from "@hc/db";
import { and, eq, gt } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { forbidden, unauthorized } from "../lib/errors.js";

export const SESSION_COOKIE = "hc_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  roles: Role[];
}

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(app: FastifyInstance, reply: FastifyReply, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await app.db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: app.config.COOKIE_SECURE,
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[SESSION_COOKIE];
  if (token) await app.db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function requireUser(request: FastifyRequest): SessionUser {
  if (!request.user) throw unauthorized();
  return request.user;
}

export function requireRole(request: FastifyRequest, role: Role): SessionUser {
  const user = requireUser(request);
  if (!user.roles.includes(role)) throw forbidden();
  return user;
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const [row] = await app.db
      .select({ id: users.id, email: users.email, roles: users.roles, status: users.status })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
    if (row && row.status === "active") {
      request.user = { id: row.id, email: row.email, roles: row.roles as Role[] };
    }
  });

  // CSRF defence in depth: SameSite=Lax cookies + JSON-only bodies + Origin check on mutations.
  app.addHook("onRequest", async (request) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
    const origin = request.headers.origin;
    if (origin && !app.config.allowedOrigins.includes(origin)) throw forbidden();
  });
});
