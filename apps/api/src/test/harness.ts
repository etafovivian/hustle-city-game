// Integration-test harness: a dedicated database, migrated once, truncated per test.
import { fileURLToPath } from "node:url";
import { createDb } from "@hc/db";
import { DEFAULT_AVATAR } from "@hc/shared";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadConfig } from "../config.js";
import { buildServer } from "../server.js";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://hustle:hustle@localhost:5433/hustle_city_test";

export const ORIGIN = "http://localhost:5190";

export async function prepareDatabase() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const admin = postgres({ ...parse(url), database: "postgres", max: 1 });
  const [exists] = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (!exists) await admin.unsafe(`create database "${dbName.replace(/"/g, "")}"`);
  await admin.end();

  const { db, client } = createDb(TEST_DATABASE_URL, { max: 1 });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../../../packages/db/migrations", import.meta.url)) });
  await client.end();
}

function parse(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

export async function resetDatabase() {
  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  // TRUNCATE does not fire row-level DELETE triggers, so append-only tables can be reset.
  await sql`truncate users, businesses, feature_flags restart identity cascade`;
  await sql.end();
}

export async function testServer() {
  const config = loadConfig({ ...process.env, DATABASE_URL: TEST_DATABASE_URL, WEB_ORIGIN: ORIGIN, AUTH_RATE_LIMIT: "1000" });
  return buildServer(config, { logger: false });
}

type App = Awaited<ReturnType<typeof testServer>>;

export interface Player {
  cookie: string;
  id: string;
  call: (method: "GET" | "POST" | "PATCH", url: string, body?: unknown) => Promise<Awaited<ReturnType<App["inject"]>>>;
}

let counter = 0;
export async function registerPlayer(app: App, nickname = `player_${++counter}`): Promise<Player> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    headers: { origin: ORIGIN },
    payload: { email: `${nickname}@example.test`, password: "correct-horse-battery", nickname, avatar: DEFAULT_AVATAR, confirmAdult: true },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const setCookie = res.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookie = raw!.split(";")[0]!;
  return {
    cookie,
    id: res.json().id,
    call: async (method, url, body) =>
      app.inject({ method, url, headers: { cookie, origin: ORIGIN }, ...(body === undefined ? {} : { payload: body as object }) }),
  };
}
