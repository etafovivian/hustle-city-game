import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./index.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

// Works from both src/ (tsx) and dist/ (built image).
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

const { db, client } = createDb(url, { max: 1 });
await migrate(db, { migrationsFolder });
await client.end();
console.log("migrations applied");
