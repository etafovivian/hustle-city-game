export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new AppError(400, code, message);
export const unauthorized = () => new AppError(401, "unauthorized", "Please sign in.");
export const forbidden = () => new AppError(403, "forbidden", "You do not have access to this.");
export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found.`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);

/** Postgres unique_violation, optionally for a specific constraint/index. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  // drizzle wraps driver errors; the pg error is on `cause`.
  const e = (err as { cause?: unknown })?.cause ?? err;
  const pg = e as { code?: string; constraint_name?: string };
  return pg?.code === "23505" && (!constraint || pg.constraint_name === constraint);
}
