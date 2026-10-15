# Regions plan: Ogun State first, then the rest of Nigeria

New Lagos stays the home city. Other states are separate maps you **travel to**. Ogun is first: it is next door, it is cheap, and "buy land in Ogun" is a real Lagos dream. The regions after it are ranked in section 5.

Towns keep their real names, because they are public places and players should recognise them. Every building, venue, church, school and business is invented, and there are no real brands.

## 1. How regions work in the game

**One map per region.** Each region has its own layout module (`ogunLayout.ts`) with its own `WORLD`, `ROADS`, `DISTRICTS`, `AREA_GRIDS`, `AREA_PRESETS`, `FORESTS`, `VENUE_AT` and road network, loaded with a dynamic `import()` on arrival so the Lagos bundle does not grow. A registry in `@hc/shared` (`regions.ts`) lists `{ key: "lagos" | "ogun" | …, name, gateways, distanceKm }`, and the server stores each player's region.

**Gateways out of Lagos:**

| Gateway (Lagos) | Where | Modes |
|---|---|---|
| **Interstate Motor Park** (new venue, Jibowu/Ojota feel) | Danfo Terminal | Commuter bus, AC coach, night bus |
| **Airport Ridge terminal** (existing art) | Airport Ridge | Flight (not to Ogun: no airport there; Abuja, PH and Kano later) |
| **City Rail Station** (new, an Iddo feel) | Danfo Terminal | Train to Abeokuta (later Ibadan) |
| **Own car** | Drive off Road A's north-west end ("To Ogun · Ibadan" sign) | Fuel only, from `vehicles.ts` |

The Ogun map has matching gateways: Kara-style motor park at the Lagos boundary, Abeokuta rail station, Sagamu interchange park. You come back the same ways.

**Trip UI.**
- A gateway's place card (or a "Travel" tab in the phone Ride app) lists destinations: region, then town. Each mode row shows fare, time and a note, like the ride picker ("AC Coach · 1,500 · ~60 s · AC, film on the screen").
- Coins are charged on **Go**, as in `rides.ts`. A skippable trip scene follows: a dark road view, a pill "🚌 On the way to Abeokuta…", Map and Skip buttons, and the region's name card. You arrive at that region's gateway.

**Fares (City Coins).** `TRIP_MODES` in a new `trips.ts`, in the same shape as `RIDE_MODES`. Fare = base + perKm × km, rounded to 10, times 1.3 on Friday evenings and festival days.

| Mode | base | perKm | Lagos → Mowe (35 km) | → Abeokuta (80 km) | → Ibadan (130 km) | Event chance |
|---|---|---|---|---|---|---|
| Commuter bus (danfo/korope) | 150 | 8 | 430 | 790 | 1,190 | 0.25 |
| AC coach | 300 | 15 | 830 | 1,500 | 2,250 | 0.10 |
| Train | 400 | 8 | n/a | 1,040 | 1,440 | 0.03 |
| Night bus (≥300 km only) | 1,500 | 6 | n/a | n/a | n/a | 0.20 |
| Flight (≥300 km only) | 8,000 | 15 | n/a | n/a | n/a | 0.02 |
| Own car | 0 | `fuelPerKm` | 320 (saloon) | 720 | 1,170 | `stopChance` × 2 |

For scale, a buka plate is 300 and a Lagos cab across town about 1,000, so Ogun is "a day out", not a big decision. Abuja (530 km) is about 16,000 by flight and 4,700 by night bus.

**Travel time.** The game clock is real Lagos time (`time.ts`), so trips are short in real time. Ogun towns take 30–90 s, and rush hour slows buses and cars ×1.4 (the `rideSeconds` rule). A night bus is a 2-minute "asleep" scene: you arrive "next morning" with +Energy and –Hygiene. A flight is a 90 s scene with no rush-hour slowdown.

**Road events** (`TRIP_EVENTS`, in the shape of `AREA_BOYS_OPTIONS`, settled once on the server):
- **Checkpoint.** "Officer waves the bus down: 'Where una dey go?'" Options: show your papers (safe, +20 s) · talk your way out (Charisma, 60%; fail = 300) · everybody contribute (150, quick). In your own car without "papers" (500 a week at the Interstate Park), the safe option costs 600.
- **Breakdown at the interchange.** Wait for the mechanic (free, +40 s) · hop another bus (400) · help push (Fitness, 50%, +12 XP; fail = –10 Energy).
- **Trailer go-slow at the river bridge.** Gala and pure water from hawkers (100, +Hunger) · sleep (+Energy) · gist with passengers (+Social). Neutral or positive: not every event is a tax.
- **Preacher on the bus** (coach only). Drop an offering (50, +5 XP) or ignore him; moodlet "Bus preacher wore me out" –5.

**Per-region systems:**
- **Presence and chat.** `Seen` gets `region`; `online()`, `near()`, `companionsAt()` and the online counter filter by it, and x/y are only compared inside one region. Room chat is keyed by place and venue keys stay globally unique, so it already works. Add a region-wide "motor park gist" channel; friends lists show "in Ogun · Abeokuta".
- **Land, homes, businesses.** Plot ids are region-prefixed (`ogun:abeokuta-A+3`). `MAX_PLOTS` (5) stays one cap across regions. **One home per region**; the Lagos face-me starter room stays your Lagos home. A business sits on one plot in one region and serves that region's players and NPCs. Stock moves between regions with a "load the bus" cargo trip (+10% of the fare).
- **Lagos ids stay as they are.** No prefix means "lagos". Plot ids are ownership; we never rewrite them.

**Code that assumes one city (to change in P1):**

| Where | Assumption | Change |
|---|---|---|
| `cityLayout.ts` (whole module) | Module-level state (`TAKEN`, `LAND`, `FOR_SALE`, `CX/CY`) built at import | Extract a `layoutKit.ts`: `iso/toIso(origin)`, `seeded`, `claim`, `fillArea`, `settle`, `growLine`, road-net builder, all taking a `LayoutCtx`. `cityLayout.ts` becomes the Lagos spec and `ogunLayout.ts` the Ogun spec. Lagos output must stay byte-identical (`check-plot-ids.ts`, `audit-layout.ts`). |
| `landmassAt`, `onLand`, `shoreY`, `island()` | `Landmass = mainland/island/bridge`, one shoreline, one island | Each layout supplies `landAt(x,y) → string \| null` (Ogun: land, river, bridge), plus its own water paths. |
| `walkRoute`, `CROSSINGS`, `JUNCTION`, `footpathRoute` | Detours via Junction 101 and Third Mainland; footpaths only around J101 | Take the bridges and a hub point from the layout ctx. Footpaths become optional per layout. |
| `roadRoute`, `ROAD_NET`, `ROAD_PATHS` | Built from Lagos `ROADS`/`STREETS` | Built per layout. |
| `VENUE_SPOTS`, `VENUE_AT`, `VENUE_ART`, `SPOT_VENUE_ART` | Lagos list; looks districts up by name | Per layout. `Venue` gets `region`, and `VENUES` is filtered by region on the map and in `venues.ts` routes (`apps/api/src/modules/game/venues.ts`). |
| `venues.ts` `area` | "District name from the city plan" | Keep the district name and add `region`. Area names may repeat across regions ("Market"), so key by `region:area` wherever a lookup uses it. |
| `PLACES`, `PARK`, `PLOTS`, `STARTER_BLOCKS`/`starterRoom` | Junction 101 player shops and starter rooms | Lagos-only. Ogun has no starter room; you stay at a guesthouse venue or your own home. |
| `BRANCH_OF`, `SHORT_AREA`, `BRANCHES` | Lagos venue originals | Per region (an Ogun buka branches from the Ogun buka). |
| `FOREST_RECTS`, `GREEN_SHARE`, `RUNWAY`, `PORT_AND_PLANES`, `JETTY`, `BILLBOARD_SPOTS` | Lagos scenery | Each layout supplies its own. Billboard ids get a region prefix too. |
| `land.ts` `LAND_RATE`, `PRIME_AREAS`, `landPrice` default 60 | Keyed by area name; default rate is Lagos | Key by `region:area` (Lagos keys may stay bare). The default comes from the region. |
| `land.ts` `PLOT_ID = /^[a-zA-Z0-9-]{3,40}[+-]\d{1,4}$/` | No `:`, so `ogun:…` fails in `apps/api/src/modules/land.ts` and `game/life.ts` | `/^(?:[a-z]{2,12}:)?[a-zA-Z0-9-]{3,40}[+-]\d{1,4}$/`, and parse the region from the id (`regionOfPlot`). |
| `plots.gen.ts`, `export-plots.ts`, `check-plot-ids.ts` | One file from `cityLayout` `FOR_SALE` | Rows become `[id, region, area, road, hh]`, or there is one `plots.<region>.gen.ts` per region merged in `homes.ts`. Both scripts loop over the layouts, and the check runs per region. New towns are appended after existing areas so that `claim` order and plot numbers never shift. |
| `fillArea` id `${slug}-${l.id}±n`, `landId` | Unprefixed | Prefix with `ctx.region + ":"` when region ≠ lagos. |
| `presence.ts` (api + shared) | One map; `NEAR` is in Lagos units | Add `region` to `Seen`, `PresencePlayer` and `PresencePing`, and to the body schema. |
| `rides.ts` `MAX_RIDE_UNITS`, `isRushHour` | Lagos map size | Make the max per region. The rush rule can stay. |
| DB (`packages/db/src/schema.ts`) | `player_homes` PK `user_id` (one home) | PK `(user_id, region)`. Add `profiles.region` (default "lagos") plus last x/y. Add a `trips` table: from, to, mode, fare, event, choice, cost. Use Drizzle migrations in `packages/db`. |
| `CityMap.tsx`, `Overview.tsx`, `AvatarWalker.tsx`, `Land.tsx` | Import `WORLD`, `walkRoute` and so on straight from `cityLayout` | Read the active layout from a `RegionContext`. |

## 2. Ogun State map design

`ogunLayout.ts` uses `WORLD 12000×9000`, roughly true to geography but compressed. Roads follow the iso axes.

```
            to Ibadan (Oyo gateway) ↗          N
           ABEOKUTA (Great Rock)  ─ ─ rail ─ ─↗
     Ogun river ║   ╲ Abeokuta–Sagamu road
ILARO (P3)      ║     ╲            SAGAMU interchange · quarry ─ Benin road ──▶ IJEBU-ODE ─▶ to Benin (Edo gateway)
  farms         ║      farms ╲   ╱ Hillgate University
     OTA ─ Lagos–Abeokuta road  ╱ expressway
  (industrial)  ║        MOWE/IBAFO belt · Faith Camp
 ═══════════ Lagos boundary: Kara-style park + river bridge (arrive here) ═══════════
```

- **Roads.** The Lagos–Ibadan expressway runs along iso b, from the bottom gateway up through Mowe to the Sagamu interchange and on to the top-right edge. The Lagos–Abeokuta road runs along iso b on the west, through Ota. The Abeokuta–Sagamu road runs along iso a and links them. The Benin road leaves the interchange to the east.
- **Water and rail.** The **Ogun river** runs north to south past Abeokuta's east side to the Lagos boundary, with three bridges. The **rail line** runs from the boundary to Abeokuta station and on north.

**Land rates** (coins/m², next to Lagos's 45–260):

| Area | Rate | Typical plot (660 m², local road) | Lagos comparison |
|---|---|---|---|
| Mowe/Ibafo | 35 | ~23,000 | Junction 101 ~53,000 |
| Ota | 30 | ~20,000 | Danfo Terminal ~30,000 |
| Abeokuta (Kuto GRA 32) | 25 | ~17,000 | |
| Sagamu, Ijebu-Ode | 22 | ~15,000 | |
| Ilaro | 15 | ~10,000 | |
| Farmland (plotHalf 90, ~1,840 m²) | 8 | ~15,000 for 3× the land | Island Heights arterial ~360,000 |

Venue activities are written as in `venues.ts`: label (cost in City Coins, XP).

### Abeokuta: the rock town (P2)
- **Character:** old Egba town around a huge granite rock. It has hilly lanes, rusty-roof compounds, the adire market, the river, a GRA with civil-service bungalows, and the state university.
- **Landmarks:** **Great Rock** (Olumo feel): climbable, with a lift tower and caves; **Egba Palace** (invented palace for the town's Oba); **Abeokuta Rail Station**; **Centenary Hall** (town hall); **Gateway Stadium**.
- **Venues:**
  - `great_rock_tours` 🪨 **Great Rock Tours**: Climb the rock steps (0, 10) · Guided cave tour (400, 14) · Ride the lift up (300, 8) · Sunset photo at the top (200, 10) · Buy the guide a zobo (100, 6).
  - `itoku_adire_market` 🎨 **Adire Lane Market**: Haggle for adire (600, 10) · Dye your own adire (1,200, 20; see §3) · Buy indigo and wax (300, 8) · Gist with Iya Aro (100, 6).
  - `lafenwa_buka` 🍲 **Mama Egba's Buka** (Lafenwa motor park side): Amala and gbegiri (250, 10) · Ofada rice and ayamase (450, 12) · Ewa agoyin (200, 8).
  - `kuto_viewing_centre` ⚽ **Kuto Junction Viewing Centre**: Watch the match (150, 8) · Argue football (50, 5).
  - `rock_city_university` 🎓 **Rock City University** (opens `academy`): Short course (800, 20) · Night reading (0, 8) · Campus jollof (300, 8) · SUG rally (0, 10).
  - `egba_palace` 👑 **Egba Palace Courtyard**: Greet the Oba's chiefs (200, 12) · Watch the talking drummers (0, 8) · Festival seat (see §3).
- **Jobs:** tour guide (guide → senior guide → head guide → tourism officer); adire dyer (apprentice → dyer → pattern master → adire house owner); buka cook; lecturer's assistant; rail porter.
- **Art.** Reuse `family-compound`, `bungalow`, `storey-house`, `market-hall`, `buka`, `school`, `church`, `mosque`, `stadium`, `motor-park`, `viewing-centre`, `unfinished-building`, `mango`, `neem`, `plantain`, `trader-*`, `power-pole`, `water-tank`. New (Stitch): Great Rock (big), rusty-roof compound, adire market stalls with dye pots, palace, rail station, university gate, river bridge.

### Ota / Sango-Ota: the industrial gate (P3)
- **Character:** factories and warehouses along the Lagos–Abeokuta road, a busy toll-gate-style junction, worker estates, and a big private Christian university.
- **Landmarks:** **Ota Industrial Estate** (factories with plain names: "SUNRISE FOODS", "DELTA CABLES"), **Crestfield University** (Covenant feel), Sango Junction.
- **Venues:**
  - `ota_factory_gate` 🏭 **Industrial Estate Gate**: Queue for casual work (0, 8) · Canteen rice (250, 8) · Buy factory seconds (800, 10).
  - `crestfield_university` 🎓 **Crestfield University** (open day, chapel, strict dress code gag): Open day tour (0, 10) · Short course (1,000, 22) · Chapel service (0, 10).
  - `sango_suya` 🍢 **Sango Junction Suya**: Suya and onions (300, 8).
  - `ota_mechanic_village` 🔧 **Mechanic Village**: Service your car (500, 10) · Buy tokunbo parts (1,500, 12).
- **Jobs:** factory hand → line supervisor → shift manager → plant manager (tier 1.2); mechanic. **Land:** 30/m²; shops near the junction pull well. **Art.** Reuse `warehouse`, `commercial-block`, `mechanic`, `face-me-block`, `filling-station`. New: factory, university chapel and hall.

### Mowe / Ibafo: the commuter belt (P3, first area at the Lagos edge)
- **Character:** half-built estates along the expressway, where Lagos workers sleep. There are trailers, megachurch camp traffic, "Lagos is tired" energy, and cheap duplexes.
- **Landmarks:** **Faith City Camp Ground**, a megachurch camp (Redemption Camp feel, invented) with a stadium-sized auditorium and its own estate, bank and filling station; **Kara-style Boundary Park** and cattle market at the river bridge (the arrival gateway).
- **Venues:**
  - `faith_city_camp` ⛪ **Faith City Camp**: Night vigil (0, 15; Fridays) · Sow a seed (500, 10) · Camp canteen (300, 8) · Buy anointing oil (200, 6).
  - `boundary_park` 🚌 **Boundary Motor Park**: Buy a ticket back to Lagos · Ewa agoyin (200, 8) · Gist with drivers (0, 5).
  - `kara_cattle_market` 🐄 **Cattle Market**: Buy a ram for the festival (6,000, 20) · Watch the haggling (0, 6).
  - `estate_show_house` 🏠 **Sunshine Estate Show House**: Tour the duplex (0, 8) · Pay a deposit (opens the Land card).
- **Jobs:** estate agent → senior agent → land surveyor → developer; bus driver on the Lagos route. **Land:** 35/m², the highest in Ogun; a home here plus a job in Lagos gives a daily **commute quest**. **Art.** Reuse `terrace-duplex`, `unfinished-building`, `estate-gate`, `bus-terminal`, `filling-station`. New: camp auditorium, cattle market pens, trailer.

### Sagamu: the interchange (P3)
- **Character:** the cloverleaf where the Lagos, Ibadan and Benin roads meet. It has kola nut traders, trucks and roadside food, and **Hillgate University** (Babcock feel, invented) nearby.
- **Venues:**
  - `kola_market` 🌰 **Kola Nut Market**: Buy kola for a ceremony (300, 8) · Trade a sack to Lagos (2,000, 15).
  - `interchange_bole` 🍠 **Interchange Roadside**: Roasted plantain and groundnut (150, 6).
  - `hillgate_university` 🎓 **Hillgate University**: Short course (900, 20) · Vegetarian canteen (300, 8).
  - `sagamu_quarry` ⛏️ **Sagamu Rock Quarry** (see §3).
- **Jobs:** kola trader; quarry (§3); truck pusher → driver → fleet owner. **Land:** 22/m². **Art:** new interchange flyover pieces (the Lagos flyover can be reused for a start), kola stalls, quarry pit, crusher.

### Ijebu-Ode: the festival town (P3)
- **Character:** a prosperous trading town with old storey houses, a royal palace square and a famous food culture (ikokore, ojojo, Ijebu garri).
- **Landmarks:** **Ijebu Royal Court** (invented palace square of the town's king) with grandstands for the festival.
- **Venues:**
  - `ijebu_palace_square` 👑 **Royal Court Square**: Watch the horse parade (festival) · Pay homage (300, 12).
  - `ikokore_spot` 🍲 **Iya Ijebu's Ikokore Spot**: Ikokore (300, 10) · Buy Ijebu garri to take home (500, 8).
  - `ijebu_textile_house` 👘 **Aso-oke Weavers**: Order festival aso-oke (2,500, 15) · Learn to weave (400, 12).
- **Land:** 22/m². **Art.** Reuse `storey-house`, `colonial-block`, `tailor-shop`. New: palace with grandstand, horse with rider.

### Ilaro (P3, optional) and the farm belt
Ilaro is a quiet west town with a polytechnic (reuse `polytechnic-gate`). It shares the **farm belt** with the land between Abeokuta and Sagamu: farm plots use `use: "farm"`, `plotHalf 90` and 8/m², and the **Ogun Agro Hub** venue sells seedlings and feed, buys the harvest and hires out farmhands.

## 3. Region-specific gameplay

- **Adire dyeing** (Adire Lane Market). Pick a technique (tie/oniko, wax, stencil/eleko) and a pattern, then do 1–3 dye dips as a short tap-timing game; a 3-dip bolt takes three visits on three days. You get an **adire bolt** to sell at Tailors' Row in Lagos, stock in your Lagos shop, or put towards the `adire_sofa_set` furniture (2 bolts = 30% off). The best patterns unlock an "Adire Master" dream goal.
- **Cassava farm.** Lease or buy a farm plot and plant cassava (1,000 a field). Weed once a day (visit, or hire a hand at 200/day); skipped days shrink the yield, and rain and pests come as ticker events. Harvest after 3 real days and process it at the garri mill into **garri sacks**, which restock your Lagos shop at about half the normal restock cost: a reason to travel weekly.
- **Poultry farm.** Build a pen (15,000), buy day-old chicks (50 each) and feed them daily. Collect egg crates every day and sell them in Ogun or carry them to Lagos (cargo trip). "Festive chickens" sell at a premium at Christmas. Risk: a "sick birds" event (pay the vet or lose birds).
- **Great Rock climb and tour.** The steps give free daily Fitness XP with a climb meter, a photo spot at the top and a weekly "first to the top" board. The cave tour tells the town's founding story (our own short text).
- **Ojude Oba-style festival** (Royal Court Square, Ijebu-Ode). Monthly in game, plus a big edition on the real date (3 days after Eid al-Adha). **Crews** (age-grade "regberegbe" groups) wear matching aso-oke from the weavers and march past; players vote "best-dressed crew" and the winners get a banner. There is a horse parade, grandstand seats (500 / VIP 5,000) and a photo spot. Festival days raise trip fares ×1.3 and fill the coaches.
- **Quarry** (Sagamu). Jobs: labourer → driller → blast supervisor → quarry manager, with a hard-hat moodlet and a "dusty" Hygiene hit. Buy **granite chippings**: bringing them to your plot cuts a `HOUSE_DESIGNS` build price by 20%, so building is cheaper in Ogun.
- **Universities.** Rock City, Crestfield and Hillgate open the Academy (`opens: "academy"`) with Ogun short courses: Agribusiness, Textile design, Mining safety. A hostel bed is the cheapest Ogun "home" (500/week, no plot).

**Why players go:**
1. **Cheap land.** It is about ⅓ of Lagos, with bigger plots and a new dream, "Landlord in Ogun": own 3 plots in Ogun.
2. **Farm goods for the Lagos shop.**
3. **The festival and the rock** as weekly social events.
4. **Commuter life.** Live in Mowe, work in Lagos, survive the expressway.
5. **Quieter life.** Rest at an Ogun home gives +10% energy, with "Fresh air" +8 as a moodlet.

## 4. Stitch asset list (Ogun)

Same rules as `docs/stitch/queue.md`: attach `market-square.webp` as the style reference, paste the style block **with "set in Lagos, Nigeria" changed to "set in Ogun State, south-west Nigeria"**, 4 images per batch on flat magenta #FF00FF, no brands, logos, currency symbols or slogans, and signs show only the words given. Numbering continues the queue.

## Batch 44: Abeokuta landmarks (make 1 and 2 large: 1536×1536)
1. A huge rounded granite rock outcrop rising from trees, with carved stone steps up one side, a small viewing platform at the top, cave openings at the base and a slim steel lift tower beside it.
2. A traditional Yoruba palace: a long single-storey building with a red-brown roof, carved wooden pillars on a wide veranda, a walled courtyard and a gate with the sign "EGBA PALACE".
3. A small railway station: a modern cream-and-green building with a canopy over a platform, a clock, and the sign "ABEOKUTA STATION".
4. An old two-storey Abeokuta compound house with a rusty corrugated roof, wooden shutters, a front veranda and a mango tree.

## Batch 45: adire and market
1. An open market lane of adire stalls: wooden frames hung with indigo tie-dye cloths in blue and white patterns, a trader on a stool.
2. Adire dye pits: three big clay dye pots of indigo, a washing trough, cloths drying on a line.
3. A covered kola nut stall: baskets of red and white kola nuts on leaves, a scale, a bench.
4. Cutaway interior of an adire workshop: a cloth on a table with wax patterns, stencils on the wall, dye pots, folded bolts on a shelf.

## Batch 46: farms
1. A cassava field: neat rows of cassava plants with a small wooden farm hut and a hoe leaning on it.
2. A poultry farm: a long low pen with a zinc roof and wire-mesh sides, white chickens, feed sacks, a water tank on a stand.
3. A small garri mill: an open shed with a grating machine, a big flat frying pan over a fire and sacks of garri.
4. A farm plot marker: a cleared square of red earth with wooden pegs and a small board with the sign "FARM FOR LEASE".

## Batch 47: industry and quarry
1. A granite quarry: a terraced grey pit with a crusher machine on legs, a conveyor and piles of chippings.
2. A tipper truck loaded with granite chippings, side view facing down-left.
3. A factory with a saw-tooth roof, a tall chimney, a gate and the sign "SUNRISE FOODS".
4. A long articulated trailer truck with a plain container, facing down-left.

## Batch 48: universities and the camp
1. A grand university gate: two tall white pillars with an arch, flower beds, a gatehouse and the sign "CRESTFIELD UNIVERSITY".
2. A university lecture hall block: three storeys, cream walls, blue windows, students' bicycles and a notice board.
3. A huge open-sided church camp auditorium: a vast steel roof on many pillars, rows of plastic chairs inside, and the sign "FAITH CITY CAMP".
4. A student hostel block: four storeys with clothes drying on the balconies and a water tank on the roof.

## Batch 49: roads, river and festival
1. A concrete road bridge over a brown river, with railings and a small sign reading "OGUN RIVER".
2. A cloverleaf interchange piece: a raised curving ramp on pillars over a road, with a green road sign that has no words.
3. A royal festival grandstand: a tiered covered stand draped in purple and gold cloth, chairs for chiefs at the front.
4. A rider in white agbada on a decorated horse with tassels and a beaded bridle, facing down-left.

Also needed: a **luxury coach** in both views (up-right, down-left) for the trip scene and Ogun traffic; batch 14 only gave a BRT bus.

## 5. After Ogun: next regions (ranked)

1. **Oyo / Ibadan.** The expressway's other end, so the Ogun map already has its gateway. Ibadan has hills of rusty roofs, a tall old tower block, sprawling markets, a famous university and amala everywhere. Much of the Yoruba art reuses (compounds, palaces, markets), so it costs the least to build. The fun is the scale: a "big village" maze to explore, the region's own food fights (amala versus Lagos amala), the cheapest land outside Ogun, and the gateway north to the rest of the country.
2. **Abuja (FCT).** Reached by flight or night bus. It has a giant granite rock over planned wide boulevards, government buildings (invented names), embassies, malls, polo and golf clubs, and nightlife. It is the status region: show off cars on empty roads, attend "big man" events, and make it the home of the player government (the competitor makes Abuja its densest city). It needs much new modern art.
3. **Rivers / Port Harcourt.** Reached by flight or night bus. It has creeks, waterfronts, oil-company estates, Garden City nightlife, bole and fish, palm wine, and boat trips to fishing settlements. It reuses the Lagos water, boat and jetty systems. The fun is the waterside: fishing and boat-trader jobs, seafood bukas, a party scene, and higher wages but a higher cost of living.
4. **Edo / Benin City.** Reached by coach along the Benin road from Sagamu, which is already drawn. It has ancient moats and walls, the Oba's palace, the bronze casters' street, and wide ring roads. The fun is **bronze casting**, the crafting twin of adire, plus a royal festival and a historic tour. Its art is quite distinct.
5. **Enugu.** Reached by coach or flight. The Coal City has green hills, a scenic hill drive, old colonial mining sites, Igbo traders, abacha and ofe onugbu, and a New Yam festival. The fun is trading (a strong market economy that is good for business players), a hill-climb driving route for car owners, and a harvest festival.
6. **Kano.** Reached by flight or a long night bus. It has the old city walls and gates, ancient indigo dye pits (a link to adire), a vast market, a Durbar horse festival, and kilishi and suya. The fun is the biggest festival in the game, trading across the north, and a "far from home" achievement. It needs the most new art and cultural care, so it comes last.

## 6. Build steps

| Phase | Scope | Size |
|---|---|---|
| **P1: Region engine and travel** | Extract `layoutKit.ts` and keep Lagos byte-identical (plot-id check). Add `regions.ts`, `trips.ts` (TRIP_MODES, TRIP_EVENTS, fare and time functions with tests), `RegionContext` in the web app, and dynamic layout import. DB: `profiles.region`, `trips` table, `player_homes` PK (user, region). Regex and parsing for `PLOT_ID`; per-region `plots.gen` with export and check scripts. Presence and chat with a region. Gateways: Interstate Motor Park and rail station in Danfo Terminal. Trip scene and event modal. A one-district stub region for testing. | ~2–3 weeks |
| **P2: Ogun map v1 (Abeokuta only)** | `ogunLayout.ts` with the full road skeleton (expressway, Lagos–Abeokuta road, Abeokuta–Sagamu road, river, rail) so later towns slot in without moving plots. Abeokuta grid and preset, the Boundary Park gateway, the 6 Abeokuta venues and jobs, land rates, the rock climb and adire v1. Stitch batches 34–35 (and the bridge from 39). | ~2 weeks plus 2–3 batches |
| **P3: The other Ogun towns** | Mowe/Ibafo (and the commute quest), Ota, Sagamu (quarry, interchange), Ijebu-Ode (festival, crews), the farm belt (cassava, poultry, garri, cargo trips), optional Ilaro. The "Landlord in Ogun" dream. Stitch batches 36–39 and the coach. Append areas only, and run `check-plot-ids` per region. | ~3–4 weeks plus 4 batches |
| **P4: Next region (Oyo/Ibadan)** | `ibadanLayout.ts` on the kit, the expressway gateway at Ogun's top-right edge, reuse of Yoruba art, and 3–4 new batches. Then Abuja, which adds flights from Airport Ridge. | ~2–3 weeks per region |
