# PRD v1.0 review notes

Review of `docs/Hustle-City-PRD.pdf` (v1.0, 11 Oct 2026). Notes are input for v1.1 of the PRD, not decisions.

## Strengths to keep

- **Money design is right from day one.** Kobo integers, immutable double-entry, reversals for corrections, webhook dedupe with durable-before-ack, "timeout means unknown, not retry", campaigns pre-funded before publish, daily reconciliation that blocks payouts on differences.
- **The required money tests are the right acceptance gate.** Replay a webhook 10 times, concurrent withdrawals, a timeout followed by eventual success, and a worker restart mid-processing.
- **Release switches** for checkout, withdrawals, sponsored rewards, multiplayer and trading, so City Coins keep working while cash is paused.
- **Explicit exclusions:** no coin cash-out, crypto, land speculation, wagering or P2P cash.

## Decisions taken (2026-10-11)

- **Private beta hosting: the VPS**, not the Dell homelab. The homelab remains dev/staging. A public HTTPS endpoint on the VPS also gives Paystack sandbox webhooks a reachable URL, with no tunnel needed.
- **Stage B is split.** B1 is the artisan quote journey, with business onboarding and admin review. B2 is retail pickup reservations, jobs and submissions, and social features.
- **UI** is designed through the Impeccable skill (`.claude/skills/impeccable`). Product truth is in `PRODUCT.md`.

## Concerns

1. **Stage B is too large for a part-time solo build.** It bundles spaces, premium previews, catalogues, search, reservations, quotes, jobs, reviews, friends, clubs, leaderboards and admin into 4–6 weeks. Proposal: split it.
   - **B1:** one marketplace journey, artisan quotes for electronics and repair, which matches the recruiting hypothesis. Add business onboarding and admin review.
   - **B2:** retail pickup reservations, jobs and submissions, and social features.
2. **"Play to earn" positioning risk in Nigeria.** After MMM and CBEX, "earn money by playing" invites suspicion from users and regulators. Position it as a marketplace with a game layer. Cash comes from *work* and *sponsor campaigns*, never from "playing". Legal review should explicitly cover the CBN (stored value, holding funds, payouts and the PSP licence position), the NDPA 2023 (data protection, including the identity data held by the KYC provider) and the FCCPC (consumer protection and advertising of earnings).
3. **Gaps in the data model.** Proposed additions: `notifications`, `media` (upload + malware-scan status), `service_areas`, `feature_flags`, `reports` (user/listing reports are separate from transaction `disputes`), `identity_verifications` (provider references only), `idempotency_keys`, `sessions`. City Coins should also go through an append-only ledger so "client cannot change coins" is auditable. Stage A implements this as `game_ledger_entries` with an append-only trigger.
4. **Homelab exposure vs current environment split.** The homelab is currently *dev*, and the VPS is *cloud/prod*. Invited beta users plus Paystack sandbox webhooks need ingress. Options:
   - Tailscale for testers, plus a Cloudflare Tunnel that exposes only `/api/webhooks/*`.
   - Run the private beta on the VPS from the start.

   The decision is needed before backlog row 6.
5. **The PDF tables are cut off.** The right-hand column (exit gate / acceptance evidence / done-when) is cut off on pages 2–4 and 8. Re-export the PDF so that acceptance criteria are complete.
6. **Workflow names Codex.** The workflow (one backlog row at a time, review in Git) applies equally to Claude Code.
7. **Admin MFA** is required by the PRD but not scheduled in any backlog row. Add it to row 3 (admin console) at the latest.

## Stage A interpretation (implemented)

- "Complete one simulated order" is implemented as an **NPC customer order**. Each shop gets a new deterministic order every 30 minutes, and the player fulfils it from stock.
- **NPC demand runs in bounded steps:** 10-minute steps, capped at 24 hours of offline accrual. The calculation is deterministic per (shop, step), so repeated settlement is safe.
- **Daily quests:** 3 of 9 rotate at the Lagos midnight boundary. Rewards are claimable once per day via a unique ledger reference.
- **The Work Hub and the Hangout's friends/clubs are previews.** The Hangout shows the server-computed weekly standings (coins earned from sales), which are independent of NGN.
- **Mock merchants** are seeded with `is_mock = true` and labelled "demo listing" in the UI.
