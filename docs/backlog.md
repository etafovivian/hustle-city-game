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
| 7b | **Phone: Music app** (from Toyeeb, 2026-10-14) | Phase 1 live (2026-10-15): six stations of original music made in the browser (no recordings, no licences), mini player, city sounds step back, the radio at home puts a station on. Later: real tracks from Nigerian artists who opt in. | A radio or player in the phone (and in rooms and cars). **Rights first:** only royalty-free or CC0 music, or tracks Nigerian artists give us to promote (a sponsorship and promotion slot, like billboards). No streaming of commercial catalogues without a licence. Start with in-game "radio stations" (Afrobeats, Fuji, Highlife, Gospel, Apala) built from cleared tracks. |
| 7c | **Phone: Holy books** (from Toyeeb, 2026-10-14) | Not started | A reader in the phone with the Bible, the Qur'an and the Bhagavad Gita (others later), plus a verse of the day. Use public-domain texts only: KJV Bible; a public-domain Qur'an translation such as Pickthall (1930) or Yusuf Ali (1934) next to the Arabic; Edwin Arnold's "The Song Celestial" for the Gita. Check each licence before shipping. Respectful design: no ads or game rewards inside the reader; open it from the phone, the mosque or the church. Optional quiet "read today" streak without coins. |
| 7d | **Relationships and partners** (from Toyeeb and the owner, 2026-10-14) | Phase 1 live (2026-10-15): 10 people to meet, chat, gifts, dates, ask out, move in, propose, owambe wedding, partner at home. Together-poses wait on the NPC art. | Someone to come home to: partners you meet, date and live with, and do things together with (eat, dance, go out, sit together at home). **Two phases.** (1) **Game characters first:** invented NPC partners with their own looks, jobs and moods. You meet them at places, build closeness through dates (buka, suya, lounge, beach, owambe), move in together, and later marry with a wedding owambe. Together-poses: holding hands, eating at one table, dancing, sitting on the sofa. One partner at a time. (2) **Real players, later:** mutual opt-in "couple" status only between two adults who both choose it, with report and block, and no contact or photo sharing (the chat filters already block numbers and links). Reuses the together-actions from phase 1. **Not in the game:** anything sexual or in bed together; dating profiles that are really contact ads; real-money gifts. **Before phase 2:** stronger 18+ checks and moderation capacity, because romance scams are a known problem. |
| 7e | **House parties** (owner, 2026-10-14) | Live (2026-10-15): small gist, owambe or big bash at your house for an hour, invites to contacts, people dancing in your rooms, music on, friends who visit join (Social, Fun, XP), Phone → Events lists friends' parties. | Host friends at your house: send invites (the existing "invite to my house" ping), set the music on the radio or TV, put out food you cooked or ordered, and dance together. Guests get Fun and Social, the host gets Charisma, and a bigger house holds more guests. An owambe-at-home flex: hire a DJ (a hustle board job) or a caterer. |
| 7f | **Pets** (owner, 2026-10-14) | Not started | A dog, a cat, a parrot or chickens in the compound yard (the yard art already has cages). Feed them (a coin sink), and walk the dog round the block (Fitness). They follow you round the house and greet you at the door, and get sad if neglected (no death). Pet food and toys could be sponsored items from real pet shops. |
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
