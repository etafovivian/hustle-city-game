# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two first-class audiences, served equally in the beta:

- **Players:** Nigerian adults aged 18–35, starting with one Lagos service area (Yaba is the working hypothesis). They mostly use mid-range Android phones on mobile data. They come for an entertaining social game: running a simulated shop, doing daily quests and seeing friends. They stay for credible economic opportunity, meaning real digital work and later sponsored missions.
- **Merchants and artisans:** small Lagos businesses. The first recruiting hypothesis is electronics retailers and repair artisans, such as phone and generator repair. They need affordable discovery, a catalogue and customer enquiries. A merchant can also play using the same account, with separate business permissions.

Customers looking for a real product or service may skip the game entirely and use quick search.

## Product Purpose

Hustle City is a playable marketplace. You can walk through a fictional Lagos neighbourhood (Junction 101) or use quick search, and you reach the same real catalogue of local businesses either way. The game gives players a reason to return daily, and merchants get a free digital storefront.

The beta succeeds if 30–50 players and 10 merchants show day-7 retention around 20%, with real marketplace interactions and zero unexplained ledger discrepancies. These targets are hypotheses, not forecasts.

## Positioning

It joins a game loop people return to daily with real, verifiable local commerce and work. The gameplay never promises cash. Cash comes only from completed real work or pre-funded sponsor campaigns.

## Operating Context

- Mobile-first, bandwidth-conscious: the marketplace should be useful within 3 s on a throttled mid-range Android device. Initial map assets must be under 5 MB.
- Real merchants keep their actual pickup address and service area whatever their virtual location. The product card (photos, NGN price, stock) is authoritative, and buildings are decoration.
- The beta is invite-only and hosted on the founder's VPS.

## Capabilities and Constraints

- **Three separate balances:**
  - City Coins: game-only, with no cash value, not withdrawable and not transferable.
  - NGN earnings: from real transactions or funded campaigns only, and only in a later stage.
  - XP and reputation: neither spendable nor convertible.
- **Stage A (now):** map with Market Square, Work Hub and The Hangout; avatar and nickname; simulated shop; customer orders; intro and daily quests; weekly standings; browsing the (demo) merchant catalogue.
- **Later stages:**
  - Business spaces with free and premium templates.
  - Artisan quotes (B1).
  - Pickup reservations, jobs and social features (B2).
  - Payment sandbox, then a live pilot.
  - Multiplayer and 3D.
  - Trading.
- **Explicit exclusions:** coin cash-out, crypto, land speculation, wagering, P2P cash transfers, public chat and voice, and promises of employment.
- **Undecided:**
  - premium tier prices
  - payment partner (Paystack is a candidate)
  - exact service area
  - verified-adult flow

## Brand Commitments

- Name: **Naija Hustle City** (short form "Hustle City" in running copy). Neighbourhood: **Junction 101** in "New Lagos".
- Voice: clear, plain English for anything about money, rules, eligibility or errors. Light Nigerian Pidgin flavour in NPC dialogue, greetings and celebrations, never in terms, and never where it could blur a money fact.
- No existing logo, palette or typography. The visual world is open.

## Evidence on Hand

- PRD v1.0: `docs/Hustle-City-PRD.pdf`.
- There are no real merchants, testimonials, user counts or press yet. The seeded catalogue is demo data marked "demo listing", and nothing may present it as real businesses or invent social proof.

## Product Principles

1. **Never blur game money and real money.** Every coin surface states it has no cash value, and every NGN surface is exact and sourced.
2. **Commerce works without the game.** Search and product cards must be fully usable without walking the map.
3. **Respect phones and data.** Mobile-first, light assets, tap targets sized for thumbs.
4. **Honest by default.** Verification badges state exactly what was checked, and paid plans never imply trust.
5. **Daily return comes from play and people, not from implied income.**

## Accessibility & Inclusion

- WCAG 2.2 AA as the baseline. Map hotspots must be operable by keyboard and screen reader, not only by tap.
- Readable in bright outdoor light on low-end screens. Must not depend on colour alone.
