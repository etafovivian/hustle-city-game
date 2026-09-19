# Gap review: what Hustle City is missing, against real Lagos and Lagos Life

Reviewed 2026-10-13 against the code on `main` (plus uncommitted work: `Wardrobe.tsx`, presence changes), the docs in
`docs/`, and the art in `apps/web/public/art`. The live site was **not** re-checked for this pass, so "built" means
"in the code". In-game names below are invented; real names appear only to say what the place is modelled on.

**Where we stand:** 10 districts (Junction 101, Tech Mile, Owambe Gardens, Danfo Terminal, Apapa Port, Airport Ridge,
Marina Wharf, Island Heights, Lekki Gardens, Atlantic Beach strip), 25 venues, 22 job ladders, 6 needs with moodlets,
rides with fares, rush hour and area boys, own vehicles, plot-and-build homes, room chat, DMs, presence, land, deals,
billboards, Academy. **Thin spots:** Lekki Gardens and Apapa Port have no venues, Airport Ridge has only the hospital,
Atlantic Beach is a name on the sand, and Marina Wharf's market hall is decoration.

## 1. Lagos places we don't have yet

### Areas

| Real area | In-game name (idea) | Fits | Art we have | Art needed |
|---|---|---|---|---|
| Computer Village, Ikeja | **Gadget Village** | A quarter of Airport Ridge | `phone-shop`, `laptop-shop`, `gadget-kiosk`, `props/trader-phones` | Gadget plaza block (Stitch, batch 34) |
| Balogun / Idumota markets | **Marina Market** (venue in Marina Wharf) | Marina Wharf | `market-hall`, `colonial-block`, `market-square.webp` | Market stall row, fabric lane interior (batch 34) |
| Mile 12 foodstuff market | **Twelve Mile Market** | Danfo Terminal edge or a new Ketu-side area | `market-hall`, `props/trader-fruit` | Foodstuff market with lorries and baskets (batch 34) |
| Oshodi | Already **Danfo Terminal** (flyover, bus terminal) | — | `bus-terminal`, `motor-park`, `props/footbridge` | Under-bridge market stalls (batch 34 stall row covers it) |
| Yaba / Surulere / Mushin | Already Tech Mile, Owambe Gardens, Junction 101 | — | yes | University hall of residence (batch 41) |
| Ikeja GRA / Alausa | **Ridge GRA** and **State House** | Airport Ridge | `terrace-duplex`, `bungalow`, `estate-gate` | State secretariat building (batch 39) |
| Ikorodu | **Ikodu Town** (new outer mainland area) | New district, west of Danfo Terminal | `bungalow`, `family-compound`, `unfinished-building`, `storey-house` | Sandy-road fenced bungalow (batch 41); a ferry terminal reuses `ferry-jetty` |
| Ajah / Sangotedo | **Road's End** (Lekki far end) | East end of the Island road, past Lekki Gardens | `terrace-duplex`, `unfinished-building`, `estate-gate`, `shop-house` | Nothing essential |
| Festac Town | **Festival Town** (numbered avenues, estate rows) | New district off Road B past Apapa | `residential-block`, `bungalow` | Estate row of identical blocks (batch 41) |
| Eko Atlantic | **Ocean City** (reclaimed land, sea wall) | South of Island Heights, on the Atlantic | `office-tower`, `residential-tower` | Sea wall and reclaimed-land towers (batch 40) |
| Ikoyi vs Victoria Island | Both live in **Island Heights** today | Could split later | yes | — |
| Banana Island | `crazy-house` in Lekki Gardens | — | yes | — |
| Obalende (Island bus hub) | **Island Bus Park** | Marina Wharf / Island Heights border | `bus-terminal`, `motor-park` | — |
| Alaba / Trade Fair (Ojo) | **Trade Fair Complex** (electronics wholesale) | Beyond Apapa | `warehouse`, `commercial-block` | Not sure it's worth it before Gadget Village |
| Badagry (heritage, coast) | Forest name exists; a **Creek Heritage** day-trip | Later, with intercity travel | — | Not sure; needs research before art |

### Landmark and place types

| Real type | In-game name (idea) | District | Art we have | Art needed |
|---|---|---|---|---|
| National Theatre (Iganmu) | **Crown Arts Theatre** | Owambe Gardens (Surulere side) | none | Theatre exterior + auditorium (batches 39, 42) |
| Tafawa Balewa Square | **Independence Square** (parades, crusades, concerts) | Marina Wharf | none | Square with horse statues (batch 39) |
| Freedom Park (arts park) | **Liberty Arts Park** | Marina Wharf | `city-park.webp` as a stand-in | Arts park with stage (batch 39) |
| Lekki Conservation Centre | **Lagoon Canopy Reserve** | Lekki Gardens | `nature/*` trees, `FORESTS` | Canopy walkway (batch 40) |
| Lekki toll gate | **Peninsula Toll Gate** (Island road, Island Heights → Lekki) | Island road | none | Toll plaza (batch 36) |
| Lekki-Ikoyi link bridge | **Link Bridge** (cable-stayed) | Island Heights → Lekki Gardens | road code only | Bridge pylon prop (batch 40) |
| Third Mainland Bridge views | **Bridge lay-by** sunset spot + "Sunset over the bridge" ticker | Bridge road (exists) | road, lamps, billboard | None (code only) |
| Elegushi-style beach | **Atlantic Beach** as a venue (rave nights, cabanas, horse rides) | Atlantic Beach strip (exists) | none | Beach huts, bar shack, horse, lifeguard tower (batch 38) |
| Tarkwa Bay (boat-only beach) | **Sandbar Bay**, reached by boat from the jetty | Off Marina Wharf | `ferry-jetty`, `interiors/boat-deck` | Beach huts reuse batch 38 |
| Eko Hotel / convention centre | **Grand Lagoon Hotel** exists; add **Atlantic Convention Centre** for big concerts | Island Heights | `hotel`, `interiors/hotel-lobby` | Concert stage (batch 37) |
| Afrobeat shrine (music venue) | **Afrobeat House** | Airport Ridge | `event-centre` as a stand-in | Not sure; a distinct exterior would help |
| Filling station | **City Fuel** (tap to buy fuel, queues) | Main roads, all areas | `filling-station` (decor today) | Pump island + jerrycan seller (batch 36) |
| ATM gallery | Tap-able **ATM** (withdraw coins, "network down" moments) | Everywhere | `atm`, bank art | None |
| POS stand | **POS agent** (a business kind and a street prop) | Junction 101, Danfo Terminal | `props/pos-booth` | None |
| Churches with crusades | **Mercy Camp Crusade Ground** (expressway camp) | New area on the edge, or Independence Square | `church` (small chapel), `interiors/church` | Crusade ground + tent interior (batches 37, 42) |
| Oba's palace | **Oba's Palace** (heritage, Eyo-style festival) | Marina Wharf | none | Palace exterior (batch 39) |
| University (UNILAG type) | **Lagoon University** (halls, lagoon front) | Tech Mile | `polytechnic-gate`, `school`, `interiors/classroom` | Hall of residence (batch 41) |
| BRT station / rail station | **BRT** stops and **Coast Line / Ridge Line** rail | Road A and Road B | `life/brt-ne`, `life/brt-sw`, `props/bus-stop` | BRT station, rail station, train (batch 35) |
| Commuter ferry | **Water bus** | Jetty ↔ Ikodu Town ↔ Sandbar Bay | `ferry-jetty`, `props/tugboat` | Water bus boat (batch 35) |
| Car wash, mechanic village | **Car wash** | Danfo Terminal, Airport Ridge | `mechanic`, `props/vulcanizer` | Car wash (batch 36) |
| Wellbeing centre | **Calm Corner** (gentle real help line) | Tech Mile | `clinic` | None |

## 2. Daily-life systems we lack

Checked in code: no weather, power cuts, crime, government, skills, seasonal events, collectibles, sound, rent,
other cities, sea plots, hustle board or friends table. Rush hour exists only as a fare and speed change.

| # | System | Lagos Life? | Player value | Effort | Notes |
|---|---|---|---|---|---|
| 1 | **Weekly rhythm and events**: owambe Saturdays (event centre busy, aso-ebi deals), Sunday service and Jumu'ah specials, match nights at the viewing centre and stadium | Yes (special days, fixtures) | High | M | Venues and art exist; needs an events table and a day-of-week check in `LIFE` hours |
| 2 | **Detty December season**: beach raves, concerts, returnees in the crowd, higher prices on the Island | No | High (seasonal spike) | M | Builds on row 1; best sponsor slot of the year |
| 3 | **Power cuts ("Up NEPA!")**: areas go dark on a schedule; lights, viewing centre and fan depend on a generator | No | High | S–M | We already sell generators that only add comfort; this gives them a reason. Map lamps already fade by hour |
| 4 | **Weather and rainy season** (about Apr–Jul and Sep–Oct; harmattan haze Dec–Feb): rain overlay, flooded streets on the Island, slower rides, okada and cab fares up | No | High | M | Pure Lagos feel; needs rain and flood art |
| 5 | **Traffic you can see**: a "go-slow" indicator per road, jams on the map, okada beats it | Yes | Medium | S | `isRushHour` and `rideSeconds` exist; it's mostly UI |
| 6 | **Fuel price and queues**: filling stations as places, scarcity days, queue or buy from a jerrycan seller | No | Medium | S–M | `fuelPerKm` exists; fuel is just deducted today |
| 7 | **Ambient sound**: traffic and horns, generator hum, market chatter, owambe music | Yes | Medium | S | No audio in the code |
| 8 | **Daily collectible hunt** (hidden items on the map, small prize) | Yes (gem hunt) | Medium | S | Cheap retention |
| 9 | **Skills** (charisma, fitness, cooking, coding…) used in area-boy checks and job promotions | Yes (9 skills) | Medium | M | Area-boy odds are fixed today |
| 10 | **Rent ladder**: weekly rent by area, move-in = rent + agent fee, rent your house to others | Yes | Medium | M | We have buy-and-build only; starter room is free |
| 11 | **More transport**: BRT, light rail, water bus, interstate coach from the motor park | Partly (coach) | Medium | M | BRT bus art exists |
| 12 | **Outfits per context and a boutique** | Yes | Medium | M | `Wardrobe.tsx` is in progress, not reviewed |
| 13 | **Area chairman / community vote** (apolitical, one fun policy a week per district) | Yes (governor) | Medium (social) | L | Real politics stays out; slogans must be moderated |
| 14 | **Civic consequences**: traffic fines, the police desk and court used for disputes, not crime actions | Yes (crime → jail → court) | Low–medium | L | Recommend **no** player crime actions (pickpocket, ATM hacking); keep area boys as the street risk |
| 15 | **Hustle board** (players hire players for coins, held until done) | Yes | Medium | L | Needs fixed job types, no free text (their board is full of scams) |
| 16 | **Sea plots** (rent water tiles for ad images) | Yes | Low (revenue) | S–M | Coins only; same review as billboards |
| 17 | **Friends list and clubs** (backlog row 5) | Yes | Medium | M | Presence counts "companions" but there is no friends table |
| 18 | **Other cities** (Abuja, Port Harcourt) | Yes | Low for now | L | Later; the motor park and airport are the gateways |

Not copying: betting, casino, "play for real" tables, crime actions, open free-text jobs.

## 3. Business and marketplace gaps

From `business-plan.md`, steps 1–3 are built (retail listings, business on the map, deals). Missing:

1. **Business dashboard** (step 5): views, card opens, deal claims and redemptions, quote requests and billboard stats in
   one page. Without it, a business can't see that the game sends customers. *Most important for retention of SMEs.*
2. **Sponsored place and quest kit** (step 4): swap a generic venue (e.g. Lagoon Capital Bank) for a sponsor's, with
   "Sponsored" label, quests and a report. No code yet; the only "sponsor" string is a City FM flex.
3. **Jobs board and Academy hiring** (step 6, backlog 4b): real vacancies, applications, hire from certificate holders.
4. **Pickup reservations** (backlog 4b): reserve a product, merchant confirms, expiry. Products exist; ordering doesn't.
5. **Payments**: bank transfer confirmed by an admin only; no Paystack/Flutterwave checkout, invoices or receipts.
6. **Paid tiers**: "Verified" and "On the map" pricing is planned but there's no billing or expiry.
7. **Market stalls for micro-traders**: a stall in a market hall (Marina Market, Gadget Village) instead of a whole
   plot. Most Lagos traders don't have a building.
8. **Missing business kinds**: POS agent, dispatch rider/logistics, laundry, cleaning, solar and inverter installers,
   gas refill, printing, tutors, pharmacies, car wash. `services.ts` has 10 artisan and 10 retail categories.
9. **Opening hours and "open now"** for real businesses on their card (venues have hours; businesses don't, as far as I
   can tell).
10. **Retail reviews**: reviews come only from completed artisan jobs; shops have no review path (deal redemption could
    unlock one).
11. **Sponsored phone app tiles** and **ads on ride routes**: two ad products Lagos Life sells; billboards only show on
    the map today.
12. **Corporate needs**: multi-branch businesses, campaign reports with no personal data, ARCON vetting step, NDPA
    consent text. Billboard prices (₦25k–₦60k/week) are ~10× under theirs; owner still to decide.

## 4. Asset gaps: Stitch batches 34–43

Same rules as `docs/stitch/queue.md`: attach `market-square.webp`, paste the style block, then one batch. Add the
interior line for batch 42 and the "clear walkway, no people" line from batches 29–31.

## Batch 34: markets
1. A row of four market stalls under rusty zinc roofs on wooden posts, tables of tomatoes, peppers, onions and plastic bowls, a narrow lane in front.
2. An open foodstuff market yard: a lorry piled with baskets of tomatoes, sacks of onions, traders under umbrellas, a muddy lane.
3. A three-storey gadget plaza packed with small phone shops, hand-painted banners, a sign "GADGET PLAZA", phones on display (no brands).
4. Cutaway interior of a covered market lane: bolts of Ankara and lace on shelves both sides, a trader's stool, hanging fabric, a narrow walkway.

## Batch 35: public transport
1. A BRT bus station: a raised platform with a steel and glass shelter, turnstiles, a ramp, and the sign "BRT".
2. An elevated light-rail station: concrete pillars, a platform with a canopy, stairs down to the street, the sign "CITY RAIL".
3. A three-car light-rail train in blue and white, 2×2 sheet of four directions (no logos).
4. A small commuter ferry (water bus) with a covered passenger deck and orange life jackets on the rails.

## Batch 36: roadside and roads
1. A toll plaza across a dual carriageway: four booths under one long canopy, barriers, lane lights, the sign "TOLL".
2. A filling-station pump island: two fuel pumps, an attendant in overalls, a small cashier booth, a short queue of cars.
3. A roadside fuel seller: jerrycans and a funnel on a wooden table under an umbrella.
4. A car wash: a hose, buckets, a car with soap on it, a small sign "CAR WASH".

## Batch 37: faith, events and concerts
1. A crusade ground: a huge open-sided white tent with a stage, rows of plastic chairs and speaker towers, the sign "CRUSADE".
2. A street owambe: white and gold canopies across a street, round tables, plastic chairs, a DJ stand.
3. An outdoor concert stage with a lighting rig, big speakers and crowd barriers (no brand banners).
4. A large modern church auditorium building with a wide front and a cross (no names).

## Batch 38: the beach
1. A row of three thatched beach cabanas with loungers in front, on sand.
2. A beach bar shack: a palm-roof hut, a counter, coconuts and a grill.
3. A horse with a decorated saddle and a handler, standing on sand.
4. A lifeguard tower with a red flag, and two jet skis pulled up on the sand.

## Batch 39: culture and civic landmarks (tall: 1024×1536 where needed)
1. A grand round arts theatre shaped like a military cap, on a plinth with steps, the sign "ARTS THEATRE".
2. A parade square with stepped grandstands and four horse statues on tall pillars, flags on poles.
3. An arts park: an old colonial prison wall with arches, a small open-air stage, trees and benches.
4. A traditional palace: a long walled compound with a carved gate, a red and white facade and a courtyard.

Arrived in zip 18: `public/art/landmarks/arts-theatre.webp`, `parade-square.webp`, `arts-park.webp` (and `palace.webp`,
not placed yet). To swap a venue's art: put the cut-out under `public/art/`, run `python3 scripts/art-sizes.py`, then
change the venue's `art` in `packages/shared/src/venues.ts` and its name in `VENUE_ART` and `ART_ASPECT` in
`cityLayout.ts` (check-clearance fails if they disagree). Gadget Village's plaza uses `commercial-block` until the
batch 34 gadget plaza block.

## Batch 40: bridges, nature and the new city
1. A canopy walkway: a rope and timber bridge high between tall forest trees, with platforms.
2. A cable-stayed bridge pylon: one tall white pylon with cables fanning down to a short section of deck.
3. A reclaimed-land sea wall: big concrete armour blocks against waves, a promenade on top.
4. Two glass towers on fresh sandy reclaimed land, with a sign "OCEAN CITY" on a hoarding.

## Batch 41: new homes and areas
1. A university hall of residence: a long four-storey block with balconies, clothes drying, the sign "HALL".
2. A row of identical two-storey estate blocks on a numbered avenue, with a sign "AVENUE 4".
3. A fenced bungalow on a sandy road with a small gate, a water tank and a plantain clump.
4. A State House: a wide government building with a dome, flagpoles and a fountain (no crest).

## Batch 42: interiors for new places
1. Cutaway interior of the crusade tent: a stage with a keyboard and drums, rows of chairs, speakers.
2. Cutaway interior of a theatre auditorium: a stage with red curtains and tiered seats.
3. Cutaway interior of a beach cabana: loungers, a low table with coconuts, a sea view.
4. Cutaway interior of a BRT bus: seats on both sides, standing rails, windows, a driver's cab.

## Batch 43: weather and power props
1. A flooded street patch: brown water over the tarmac, floating sachets, a car stuck halfway.
2. A roadside umbrella and raincoat seller.
3. A pole-mounted transformer with two workers on a ladder and a utility van.
4. A deep pothole full of rainwater, with a warning tyre in it.

## 5. Top 15 next things to build

| # | What | Why | Size |
|---|---|---|---|
| 1 | **Weekly events calendar** (owambe Sat, Sunday service, Jumu'ah, match nights) | Uses venues and art we have; gives "come back on Saturday" hooks | M |
| 2 | **Business dashboard** | SMEs stay only if they see the game sending them customers | M |
| 3 | **Power cuts + generators** | Very Lagos, cheap, and makes the generator items mean something | S–M |
| 4 | **Marina Market venue** (buy, haggle, resell) plus market stalls for real micro-traders | Art exists; fills Marina Wharf; ties play to real traders | M |
| 5 | **Atlantic Beach venue** (day and night rave) | Lagos's weekend place; the strip is already on the map | S (M with batch 38) |
| 6 | **Rainy season and floods** | Strong Lagos feel; changes ride choice and prices | M |
| 7 | **Sponsored place and quest kit** | First corporate deal needs it; main revenue line | M |
| 8 | **Ambient sound** | Lagos Life has it; makes the map feel alive | S |
| 9 | **Fuel stations as places + fuel price days** | Gives filling-station art a use and a coin sink | S–M |
| 10 | **Visible traffic (go-slow layer)** | Rush hour already exists in the maths; show it | S |
| 11 | **Detty December season** | Seasonal spike and sponsor slot (needs row 1) | M |
| 12 | **BRT, light rail and water bus rides** | Real Lagos transport; BRT art exists | M |
| 13 | **Gadget Village quarter** in Airport Ridge | Airport Ridge has one venue; real Ikeja trade | M |
| 14 | **Skills** used in area-boy checks and promotions | Gives walking, gym and Academy a mechanical payoff | M |
| 15 | **Rent ladder + agent fee** | Lagos housing truth, big coin sink, rent-out income | M |

Later: hustle board (L), area chairman vote (L), friends and clubs (M), daily collectibles (S), other cities (L).
