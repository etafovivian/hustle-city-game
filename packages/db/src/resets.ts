// One-time password reset links. The raw token only ever lives in the link; the table stores its SHA-256.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "./index.js";
import { auditEvents, passwordResets, sessions, users } from "./schema.js";
import { hashPassword } from "./password.js";

export const RESET_TTL_MS = 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Issue a reset link for an account. Returns null if no account has that email. */
export async function issueResetLink(db: Db, email: string, baseUrl: string, issuedBy: string | null, via: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = lower(${email.trim()})`);
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await db.transaction(async (tx) => {
    await tx.insert(passwordResets).values({ tokenHash: hashToken(token), userId: user.id, issuedBy, expiresAt });
    await tx.insert(auditEvents).values({ actorId: issuedBy, action: "auth.reset_link_issued", targetType: "user", targetId: user.id, details: { via } });
  });
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ reset: token }).toString();
  return { url: url.toString(), expiresAt };
}

/**
 * Use a reset link: sets the new password, burns the link and signs the account out everywhere.
 * Returns false if the link is unknown, used or expired.
 */
export async function useResetLink(db: Db, token: string, newPassword: string): Promise<boolean> {
  const passwordHash = await hashPassword(newPassword);
  return db.transaction(async (tx) => {
    const [reset] = await tx
      .update(passwordResets)
      .set({ usedAt: sql`now()` })
      .where(and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, sql`now()`)))
      .returning({ userId: passwordResets.userId });
    if (!reset) return false;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
    await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
    await tx.insert(auditEvents).values({ actorId: reset.userId, action: "auth.password_reset", targetType: "user", targetId: reset.userId });
    return true;
  });
}
