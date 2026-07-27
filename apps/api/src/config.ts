import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().default(4180),
  API_HOST: z.string().default("127.0.0.1"),
  WEB_ORIGIN: z.string().default("http://localhost:5190"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  GAME_TIMEZONE: z.string().default("Africa/Lagos"),
  STARTING_COINS: z.coerce.number().int().nonnegative().default(2000),
  LOG_LEVEL: z.string().default("info"),
  /** Sign-in/registration attempts per IP per minute. */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  /** Multiplier for per-hour limits on marketplace actions (raised in tests, which share one IP). */
  ACTION_RATE_SCALE: z.coerce.number().positive().default(1),
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const c = schema.parse(env);
  return { ...c, allowedOrigins: c.WEB_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean) };
}
