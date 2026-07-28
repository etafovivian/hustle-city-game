# Build backlog

Rows follow the PRD's "Backlog validation and build sequence", with Stage B split into B1/B2 (decided 2026-10-11). Implement one row at a time; review money flows,
access control and deployment changes before merging.

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 1 | Repository and platform foundation | **Done (initial)** | pnpm monorepo, Compose (Postgres/Redis/MinIO), Drizzle migrations, seed, sessions, roles, audit log, release switches, CI |
| 2 | Playable city slice (Stage A) | **In progress** | Map, avatar, three hotspots, sim shop, NPC demand + customer orders, daily + intro quests, weekly standings, mock catalogue |
| 3 | Merchant space engine | Not started | 3 free templates, 2 premium previews, catalogue upload, owner dashboard, moderation, **admin MFA** |
| 4a | **B1** — artisan quote journey | **Done (beta)** | Search by category + service area → request (description + optional photo) → itemised, versioned quote → accept → schedule → completion → review. Business onboarding + admin review for artisans. No live payment. Built 2026-10-11: versioned append-only quotes, request history, reviews from completed jobs only, cross-account access tests. Open: optional photo upload (needs object storage on the lab), email/push notifications. |
| 4b | **B2** — retail, work and social | Not started | Pickup reservations (merchant confirm/expiry), jobs/applications/versioned submissions/reviews, plus row 5 social features |
| 4c | **Billboards (revenue)** | **Done (beta)** | Paid banner ads from real businesses on 8 map boards (4 MEGA). Book → admin content review → admin records bank transfer → on air for 1–4 weeks; 15 s rotation; views/clicks report. Placeholder prices ₦25k/₦45k/₦60k per week in the `billboards` table. Before charging: legal check on ad rules (ARCON pre-exposure vetting for Nigerian ads), invoices, Paystack checkout in row 7. |
| 5 | Social features (ships with B2) | Not started | Friend requests, block/remove, clubs (one per player), weekly club standings |
| 6 | **VPS** beta operations | Not started | Decided 2026-10-11: private beta runs on the VPS (cloud/prod), not the Dell homelab. Dockerfiles, versioned images, Compose on VPS, TLS via reverse proxy on the blackfortzcapital-style domain setup, invite-only access, Postgres/MinIO ports never public, off-host encrypted backups, restore drill. Homelab stays dev/staging. |
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
