import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * as schema from "./schema.js";
export * from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 10 });
  const db: Db = drizzle(client, { schema });
  return { db, client };
}
export * from "./password.js";
export * from "./resets.js";
