# Build backlog

Rows follow the PRD's "Backlog validation and build sequence". Implement one row at a time; review money flows,
access control and deployment changes before merging.

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 1 | Repository and platform foundation | **Done (initial)** | pnpm monorepo, Compose (Postgres/Redis/MinIO), Drizzle migrations, seed, sessions, roles, audit log, release switches, CI |
| 2 | Playable city slice (Stage A) | **In progress** | Map, avatar, three hotspots, sim shop, NPC demand + customer orders, daily + intro quests, weekly standings, mock catalogue |
| 3 | Merchant space engine | Not started | 3 free templates, 2 premium previews, catalogue upload, owner dashboard, moderation, **admin MFA** |
| 4 | Commerce and work journeys | Not started | Suggest B1 = artisan quotes first; then pickup reservations, jobs/submissions/reviews |
| 5 | Social features | Not started | Friend requests, block/remove, clubs (one per player), weekly club standings |
| 6 | Homelab beta operations | Not started | Dockerfiles, versioned images, Dell VM, restricted access (Tailscale / tunnel), off-host encrypted backups, restore drill |
| 7 | Payment sandbox and ledger | Not started | Paystack adapter (candidate), NGN double-entry ledger, webhooks, payouts, required money tests |
| 8 | Live money pilot | Blocked | Needs partner approval, legal review, entity, verified-adult flow |
| 9 | Multiplayer and 3D | Not started | Three.js client, rooms, server-validated movement |
| 10 | Complex virtual trading | Not started | Atomic offers, item locks, expiry |

## Stage A — remaining before exit gate

Exit gate: *"Playable journey works after reload; rewards and inventory are validated by the server."*

- [x] Register and sign in with nickname + avatar; 2,000 starting City Coins with a "no cash value" label
- [x] Three hotspots usable by mobile tap, mouse and keyboard
- [x] Sim shop: restock (idempotent), pricing (server-validated), NPC demand in bounded steps, takings collection
- [x] Customer order (simulated order) and intro quest
- [x] Daily quests (3/day, Lagos boundary), single claim per day
- [x] Weekly standings computed server-side
- [x] Browse real (mock) merchants without signing in
- [x] Reports and admin hide-nickname with reason code and audit event
- [ ] Profile edit screen (API exists: `PATCH /api/me/profile`)
- [ ] Admin moderation UI (API exists)
- [ ] Player-facing ledger history ("where did my coins go")
- [ ] Analytics events: onboarding completion, first shop action, quest completion (PRD analytics list)
- [ ] Throttled mid-range Android check: marketplace useful in < 3 s
- [ ] Playtest with 3–5 people; tune `ECONOMY` numbers in `packages/shared/src/economy.ts`
