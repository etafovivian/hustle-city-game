# New Lagos: city plan and roadmap

![New Lagos city plan](city-plan.svg)

New Lagos follows the shape of real Lagos, so players who know the city recognise it straight away:
- the **Mainland** sits in the north;
- the **Lagos Lagoon** cuts across the middle;
- the long **Third Mainland Bridge** crosses the lagoon to the **Island**;
- **Lekki** runs east along the coast;
- the **Atlantic** is in the south.

The plan follows Lagos geography (OpenStreetMap, general knowledge), but is drawn from scratch. No map data or geometry is copied. District names are the game's own. The "like Yaba" notes in the image are only design references and never show in the game.

## Districts

| Phase | District | Real-Lagos feel | What it is in the game | Opens with |
|---|---|---|---|---|
| 0 | **Junction 101** | Mushin/Surulere crossroads | Start: Market Square, Work Hub, Hangout, player shops | Live now |
| 1 | **Tech Mile** | Yaba ("Yabacon Valley") | Gadget plugs, phone repair, tech jobs | Stage B1 |
| 1 | **Owambe Gardens** | Surulere | Artisans: tailors, decorators, caterers, event halls. Artisan quotes live here. | Stage B1 |
| 2 | **Danfo Terminal** | Oshodi | Transport hub and big open market, jobs board, retail | Stage B2 |
| 2 | **Apapa Port** | Apapa | Wholesale and imports: cheaper bulk stock, container deliveries | Stage B2 |
| 3 | **Marina Wharf** | Lagos Island, Marina, Balogun | Big market across the bridge, higher prices, more customers | After the bridge |
| 3 | **Island Heights** | Ikoyi, Victoria Island | Showrooms and premium shops: the "showroom" and "market royalty" dreams | After the bridge |
| 4 | **Lekki Gardens** | Lekki | Homes and estates: buy and decorate your own house | Late game |
| 4 | **Airport Ridge** | Ikeja | Export and travel deals, the "junction legend" goal | Late game |
| 4 | **Atlantic Beach** | Elegushi / Bar Beach | Events, weekend hangouts, owambe parties | Late game |

**The bridge is a milestone.** Crossing Third Mainland unlocks the Island districts. It's a natural "you have made it" moment for the dream system.

## How the map grows

1. **Done:**
   - The map is laid out to this plan on a 9600×7600 world (`apps/web/src/components/cityLayout.ts`).
   - Roads run on the isometric axes:
     - **Road A:** Danfo Terminal → Junction 101 → Tech Mile → bridge head.
     - **Road B:** Apapa Port → Owambe Gardens → Junction 101 → Airport Ridge.
     - **Third Mainland Bridge:** on pillars over the lagoon, down to the Island road (Marina Wharf → Island Heights → Lekki Gardens).
   - The lagoon, harbour and Atlantic are drawn as vector water, with the beach along the Island's south shore.
   - Day and night by Lagos time. Danfos, okadas, kekes and walkers move on every road, including the bridge.
   - In the game, Airport Ridge sits north-east and Danfo Terminal north-west, so that both are on the isometric roads. The plan image above is schematic.
2. **Phases 1–4:** each district opens with its stage. Until then it shows buildings with an "Opens later" plate.
3. **When the art arrives:** Stitch shoreline, bridge and boat art replaces the vector water and bridge.

## Area styles (every area looks different)

No area reuses another's house set. Each one has its own buildings, ground and props:

| Area | Buildings | Ground and props | Mood |
|---|---|---|---|
| **Junction 101** (Mushin/Surulere crossroads) | Two-storey shop-houses, face-me-I-face-you blocks, kiosks, a motor park | Worn tarmac, laterite patches, umbrella traders, generator boxes, power lines | Busy, loud, everyday hustle |
| **Owambe Gardens** (Surulere) | Event hall with columns, tailors' row, bungalows with gates, a viewing centre | Party canopies (white and gold), plastic chairs stacked, aso-ebi colours, palms | Celebration, weekends |
| **Tech Mile** (Yaba) | Shopfront street ("Herbert Macaulay"): phone and laptop shops with painted signboards, a tech hub, a polytechnic gate | Tiled pavements, bus stops, students, okadas | Young, ambitious |
| **Danfo Terminal** (Oshodi) | Bus terminal sheds, under-bridge market stalls, a pedestrian bridge | Danfo rows, conductors, puddles, banners | Chaotic, transit |
| **Apapa Port** | Warehouses, container stacks, gantry cranes | Trailers, port fences | Industrial |
| **Marina Wharf** (Lagos Island) | Old colonial facades, a big covered market, a ferry jetty | Crowded lanes, fabric bales | Old Lagos, trade |
| **Island Heights** (VI/Ikoyi) | Glass towers, a five-star hotel, a rooftop lounge, a mall, a car showroom | Landscaped lawns, valet bays, fountains | High life |
| **Lekki Gardens** | Gated estates, terrace duplexes, mansions with pools ("crazy houses") | Estate gates, guard posts, beach palms | Aspirational |
| **Airport Ridge** (Ikeja) | Terminal, cargo hangars, a GRA family duplex | Wide roads, flags | Arrival and status |

**Roads everywhere** (from the Lagos Life review):
- a dual carriageway median with black-and-yellow striped kerbs and trees;
- a red laterite shoulder;
- grey tiled pavements and lamp posts;
- bus stop shelters on danfo routes;
- power poles with sagging wires;
- roadside umbrella traders.

## Art still needed (Stitch, same style, flat magenta background)

| For | Asset |
|---|---|
| Water | Lagoon shoreline pieces (straight, inner corner, outer corner), a sand-to-water edge, small wooden fishing boats, a ferry |
| Bridge | Third Mainland Bridge segments: straight, curve, on-ramp. Concrete on pillars over water. |
| Port | Container stacks, gantry crane, cargo ship, warehouse |
| Island | Glass office tower, luxury showroom, upscale apartment block, palm-lined boulevard pieces |
| Lekki | Duplex house, estate gate, beach shack, beach umbrellas |
| Airport Ridge | Small terminal building, control tower, cargo hangar |
| People | Three more walk sheets like the kaftan man's: market trader with a head pan, student with a backpack, woman in a gele. **All four rows must face one direction each:** row 1 up-right, row 2 up-left, row 3 down-right, row 4 down-left (export 9's row 1 mixed front and back views). |
| Traffic | Danfo, okada and keke from the two missing angles (heading up-right, heading down-left), and a BRT bus |

No real brand logos, carrier colours or readable plate numbers.
