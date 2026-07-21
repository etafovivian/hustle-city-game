# Hustle City

A Nigerian playable marketplace for adults aged 18–35. Players explore Junction 101, run a simulated shop, complete
daily quests, meet friends and discover real Lagos businesses and artisans. Merchants get a free digital storefront.

- Product requirements: [`docs/Hustle-City-PRD.pdf`](docs/Hustle-City-PRD.pdf)
- Review notes and open questions: [`docs/prd-review.md`](docs/prd-review.md)
- Build backlog and status: [`docs/backlog.md`](docs/backlog.md)

**Current stage: A — local vertical slice.** No real money moves anywhere in this codebase yet. City Coins are game
currency with no cash value.

## Stack

| Path | What |
|------|------|
| `apps/web` | React + Vite client, 2D SVG map (Three.js later) |
| `apps/api` | Fastify API (modules: auth, me, game, market, moderation) |
| `apps/worker` | Background jobs (housekeeping now; webhooks, reconciliation, payouts later) |
| `packages/db` | Drizzle schema, SQL migrations, seed |
| `packages/shared` | Game rules (economy, quests, avatar/nickname rules) and API types shared by client and server |
| `infra/compose` | Local Postgres 17, Redis 7, MinIO |

## Local development

Requires Node 24 (`nvm use`), Docker, and pnpm via corepack (`corepack enable pnpm`).

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: http://localhost:5190 · API: http://localhost:4180 (proxied under `/api`).

Postgres listens on `localhost:5433`, Redis on `6380` and MinIO on `9000` (console on `9001`). All are bound to 127.0.0.1.

### Tests

```bash
pnpm typecheck
pnpm test
```

API tests are integration tests against a real Postgres database (`hustle_city_test`, created automatically). They
cover idempotent restocks, concurrent overspend, single-use quest claims, CSRF origin checks, role checks and the
append-only ledger trigger.

### Schema changes

Edit `packages/db/src/schema.ts`, then:

```bash
pnpm db:generate   # writes a new SQL migration under packages/db/migrations
pnpm db:migrate
```

Never edit an applied migration; add a new one. Use `drizzle-kit generate --custom` for triggers and other raw SQL.

## Ground rules

- PostgreSQL is the source of truth for balances, inventory and transactions. Redis never owns balances.
- The client never changes coins or inventory. Every change goes through a server transaction that locks the
  player's profile row first (`lockProfile`), then the shop.
- Every coin posting has a unique reference (`game_ledger_entries.user_id + reference`), so retries are no-ops.
- `game_ledger_entries` and `audit_events` are append-only (enforced by triggers). Corrections are new entries.
- NGN amounts are always integer kobo.
- Keep secrets out of source control and logs.
