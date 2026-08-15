# Businesses in Hustle City: small businesses and corporates

Owner's ask (2026-10-12): plan for small businesses and corporates, because the game needs them. They bring real
value to players (somewhere real to buy, learn and work) and they are the main source of money.

Players want real things from the city: food, repairs, training and jobs. Businesses want customers and attention in
Lagos. The game sits in between, as a city people visit every day.

## What exists already

| Built | Who it's for |
|---|---|
| Artisan listings with admin review, quote requests to the business (Stage B1) | Small businesses (artisans) |
| Billboards: booking, banner review, payment confirmed by an admin, view counts | Small businesses and corporates |
| Hustle Academy: courses, quizzes, verifiable certificates (Lampnet) | Training providers, employers |
| Venues on the map with activities, opening hours and interiors | Sponsored places later |
| Land plots with ids, prices and an interest list | Businesses that want a place on the map |

The `businesses` table already has a `kind` of retail, artisan or office, plus members, status and review, so both tiers
build on it.

## Small businesses (SMEs: buka, salon, tailor, mechanic, provision shop, POS agent)

What they get:

1. **Free listing** (built for artisans; extend to retail): name, area, services, prices from, photos, WhatsApp.
2. **A shop on the map.** A verified business can take a plot in its real area. It shows as a building with its name
   and opens a card with its real services, hours and a "Contact" or "Order" button. This is the same idea as our
   venues, but owned.
3. **Deals players can use for real.** For example, "Show this code at Mama Put Deluxe for 10% off jollof". The code
   is single-use and checked with the business's own phone. Players earn coins or XP for using deals, so the game pays
   players to visit real shops.
4. **Sponsored activities.** The business's own activity appears in a nearby venue, for example "Get your hair done at
   Glory Hair Salon (real branch, Yaba)".
5. **Quotes and leads** (built): artisans get quote requests; a later step adds a "Leads this week" view.
6. **Small ads**: standard billboards from ₦25,000 a week (live now).

Pricing idea (owner to decide):

| Tier | What | Price idea |
|---|---|---|
| Free | Listing, quotes, reviews | ₦0 |
| Verified | Badge, phone check, top of search in its area | ₦2,000–₦5,000 a month |
| On the map | A building on a plot with its name and card | ₦10,000–₦25,000 a month, or a land deal |
| Deals | Deals redeemed in real life | Per redemption (₦50–₦200) or included in "On the map" |

## Corporates (banks, telcos, FMCG brands, fintechs, schools, employers)

What they get:

1. **Branded places.** For example, a bank branch, a telco shop or a drinks brand's lounge. Each has its own building,
   interior, activities and quests. We have generic ones now (Lagoon Capital Bank); a sponsor would replace one under
   a contract.
2. **Sponsored quests and events.** "Open a savings pot this week", "Owambe Saturday sponsored by …", a branded match
   night at the viewing centre. Rewards are coins and items in the game; real rewards (data, airtime) only where the
   sponsor fulfils them and the law allows.
3. **Mega billboards and takeovers**: the Junction 101 and Third Mainland Bridge boards (₦45,000–₦60,000 a week
   now), and a city-wide banner for a launch day.
4. **Academy partnerships.** Courses with their name on them, for example a fintech's "Money basics". Graduates can
   be hired from the certificate pool, so employers pay for training and hiring.
5. **Jobs board** (Stage B2): real vacancies at real companies, applied for from the game.
6. **Reports**: views, visits, quest completions and redemptions, with no personal data beyond what players agree to
   share.

Pricing idea (owner to decide): packages from ₦250,000 a month (one branded place, plus boards) up to campaign deals
(₦1m and up for a month with quests, takeover and an event).

## Rules that keep it trustworthy

- Every business is reviewed before it appears (as artisans are now). Verified means we checked the phone number and
  (for corporates) CAC registration.
- No gambling, loan sharks, "double your money" or political ads (same rules as billboards). The Lagos Life
  marketplace is full of real-money scam posts; we must not let that happen here.
- Sponsored things are always labelled "Sponsored".
- Deals and real rewards: the business fulfils them, and our terms say so. Check consumer-protection and
  data-protection rules (NDPA 2023) before collecting anything for a sponsor.
- Prices in naira are paid outside the game: bank transfer confirmed by an admin now, a payment provider later. City
  Coins never turn into naira.

## Build order (proposal)

| Step | Scope | Size |
|---|---|---|
| 1 | Retail and office listings (extend B1 onboarding); "Verified" badge set by an admin (**retail built 2026-10-12**) | S |
| 2 | Business on the map: link a published business to a plot; building, name and card with real contact (**built 2026-10-12, free**) | M |
| 3 | Deals: create, show in the card, single-use codes, redeem on the business's phone, coins to the player (**built 2026-10-12**) | M |
| 4 | Sponsored place and quest kit for corporates (admin builds it; sponsor sees a report) | M |
| 5 | Business dashboard: leads, views, redemptions, billboard stats in one place | M |
| 6 | Jobs board (Stage B2) and Academy hiring | L |

## Owner's answers (2026-10-12)

- **The building on the map is free at first**, to fill the city. (Paid "On the map" tiers come later.)
- **Payments: bank transfer confirmed by an admin** for now, like billboards. No payment provider yet.
- **Deals only**: discounts the business honours. No airtime, data or other real rewards for now.
- First corporates: not decided yet.

## Questions for the owner (asked 2026-10-12)

1. Prices: are the tier ideas above roughly right for Lagos SMEs, or should the map building be free at first to fill
   the city?
2. Payments: bank transfer confirmed by an admin for now (as billboards), or set up Paystack or Flutterwave now?
3. First corporates to approach: a bank, a telco or a fintech? Any warm contacts?
4. Real rewards (airtime, data, discounts): allowed from the start, or deals only?
