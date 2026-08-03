# Asset brief, batch 3: the whole city, area by area

Goal: every area looks different (see `docs/city-plan.md` → Area styles), every enterable place has an outside and an inside, and the streets feel like Lagos.

**Who makes what (working in parallel):**

| Maker | Makes | Why |
|---|---|---|
| **Stitch** (you) | Buildings, interiors, vehicles, street props: everything 2.5D on the map | Matches our existing art style |
| **Blender** (3D VM, I run it) | 3D avatar bodies (man and woman), hair (10 styles done), clothes, and later walk-cycle sprites rendered from the 3D avatar in all 4 directions | Needs rigging and animation; Stitch can't keep a character consistent across frames |
| **Code** (me) | Roads: median kerbs, lane lines, laterite shoulder, pavements. Water, bridge, lights, traffic, icons, cards | Vector, so it scales and animates |

## How to send them (same as before)
1. Paste the **style block** from `docs/stitch-asset-brief.md` first, and attach `market-square.webp` as the style reference.
2. **One object per image**, 1024×1024, flat magenta `#FF00FF` background, nothing cropped.
3. Signs say only the words in the prompt. **No real brands, banks, logos or currency symbols.**
4. Send me the zip. I cut out, optimise, add provenance and place them.

**Extra line for exteriors:** "Isometric 2:1, front corner facing the viewer, the building sits on its own square plot with a little ground (pavement or grass) around it."

**Extra line for interiors:** "Isometric cutaway room interior: two back walls and a floor, no front walls or ceiling, like a dollhouse seen from above at 2:1, so a small character could stand inside. Warm interior lighting."

---

## Priority 1: the places that are open now (Junction 101 and Owambe Gardens)

**Exteriors**
1. **Barbershop**, Junction 101: a small single-storey shop with a big painted sign "SHARP CUTS", a barber pole, a bench outside and a small generator. Mirror visible through the door.
2. **Event hall**, Owambe Gardens: a wide hall with columns and a gold-trimmed sign "ROYAL EVENT CENTRE", white and gold party canopies in front, stacked plastic chairs, a red carpet.
3. **Viewing centre**, Owambe Gardens: a zinc-roof hall with a hand-painted sign "VIEWING CENTRE · LIVE MATCHES", a chalkboard of fixtures (no team names), plastic chairs, a generator.
4. **Motor park**, Junction 101: a covered loading bay with a row of yellow danfos, a ticket booth with the sign "JUNCTION MOTOR PARK", hawkers with trays.

**Interiors** (the cutaway room line above, 1024×1024)

5. **Buka**: wooden benches, a serving counter with big steaming pots, a cooler, a ceiling fan, a radio, enamel plates.
6. **Barbershop**: two barber chairs, a big mirror, a clipper shelf, a waiting bench, a small TV.
7. **Event hall**: a decorated high table, round tables with gold covers, a live band corner, a dance floor.
8. **Viewing centre**: a big screen on the wall (screen shows only green grass), rows of plastic chairs, a drinks cooler.
9. **Tailors' row**: two sewing machines, fabric bolts in Ankara patterns, a mannequin in an aso-ebi gown, a measuring table.
10. **Suya spot** (open air): a grill with smoke, a wooden table with onions, tomatoes and yaji in bowls, a bench, a lantern.

## Priority 2: streets (the Lagos road look)
11. **Bus stop shelter**: a yellow and black metal shelter with a bench and a blank route board. Two views: side, and end-on.
12. **Power pole**: a wooden pole with a transformer box and cross-arms. Wires get drawn in code.
13. **Roadside umbrella trader**: a big striped umbrella, a table with snacks and sachet water, a stool. Make 3 versions: snacks, phone accessories, fruit.
14. **Street lamp, Lagos style**: a tall grey pole with a single arm, light on.
15. **Kiosk row piece**: a container-style kiosk with a roller shutter half open and a blank sign. Make 3 colours.
16. **Pedestrian bridge (overhead footbridge)**: steel and concrete, stairs on both ends, for Danfo Terminal.

## Priority 3: buildings for every area (each area its own set)

**Junction 101** (busy, everyday)
17. A two-storey shop-house: shops below with roller shutters, flats above with burglar-proof windows and a water tank on the roof.
18. A face-me-I-face-you block: long single-storey rooms off a shared corridor, washing lines, buckets.

**Tech Mile** (young, shopfront street)
19. A phone shop with a big painted sign "PHONES & ACCESSORIES", phone posters (no brands) and a glass counter.
20. A laptop and repair shop with the sign "LAPTOPS · REPAIRS".
21. A tech hub: a modern 3-storey glass and brick building with the sign "THE HUB", bikes outside.
22. A polytechnic gate: a concrete arch gate with the sign "CITY POLYTECHNIC" and a gatehouse.
23. A cyber café with the sign "CYBER CAFÉ · PRINTING · TYPING".

**Danfo Terminal** (transit, chaos)
24. A bus terminal shed: long metal sheds, bays and painted bay numbers.
25. Under-bridge market stalls: a concrete overpass section with stalls underneath.

**Marina Wharf** (old Lagos trade)
26. An old colonial-style 3-storey building with balconies and faded paint, shops below.
27. A big covered market hall, crowded, with fabric bales.
28. A ferry jetty: a wooden pier with a small passenger ferry and life jackets.

**Island Heights** (high life)
29. **A glass high-rise office tower**, about 30 floors, blue glass, a lobby canopy. It's tall, so make the image 1024×1536.
30. **A residential high-rise** with balconies and a rooftop pool, 1024×1536.
31. **A five-star hotel**: a wide tower with the sign "GRAND LAGOON HOTEL", a porte-cochère and a fountain.
32. **A rooftop lounge**: a low glass building with the sign "SKYLINE", string lights and a terrace.
33. **A mall** with the sign "THE MALL", glass front, a cinema banner (blank).
34. **A car showroom** with the sign "ISLAND MOTORS", glass front, 2 cars inside (no badges).
35. **Banks: three different made-up banks**, each a 3–5 storey corporate building with its own colours and an ATM gallery at street level:
    - **"EKO TRUST BANK"**: green and gold, a classic pillared front.
    - **"LAGOON CAPITAL BANK"**: navy and teal, modern glass.
    - **"CROWN SAVINGS BANK"**: maroon and gold, rounded corner tower.
36. **ATM kiosk**: a standalone booth with 2 ATMs and a security guard post (sign "ATM").

**Lekki Gardens** (aspirational homes, "crazy houses")
37. An estate gate: a gatehouse with a boom barrier and the sign "PALM ESTATE".
38. A terrace duplex row (3 units).
39. A mansion with a pool: white modern villa, glass, palm trees, 3 cars parked (no badges).
40. **A crazy house**: an over-the-top gold-and-white mansion with a helipad, infinity pool, fountain and lions on the gate pillars.

**Airport Ridge**
41. An airport terminal (low, wide, glass) with the sign "CITY AIRPORT".
42. A control tower.

**Apapa Port**
43. A warehouse, a container stack (mixed colours) and a gantry crane: three separate images.

## Priority 4: vehicles (trips and traffic)

Every vehicle in **4 views**: driving down-right, down-left, up-right and up-left (isometric). Make each one a 2×2 sheet on magenta.

44. A Lagos yellow cab (yellow with a black checker stripe).
45. A private car, "Tokunbo" saloon (silver).
46. A family SUV (black).
47. A luxury SUV (white).
48. A BRT bus (blue and white, long).
49. The danfo, okada and keke again, in the two missing views (up-right, down-left).

## Priority 5: homes ladder (exteriors and interiors)

From poor to "crazy". Exteriors 1024×1024; interiors use the cutaway room line.

| # | Home | Exterior | Interior |
|---|---|---|---|
| 50 | Face-me-I-face-you room | (use #18) | Mattress on the floor, bucket and bowl, a small kerosene stove, a plastic chair, a calendar on the wall |
| 51 | Self-contain | A small flat block | A bed, a small kitchen corner, a fan, a TV on a stool |
| 52 | Mini-flat | A 2-storey block of flats | A sitting room: a couch, a rug, a TV on a stand, a fridge |
| 53 | Terrace duplex | (use #38) | A lounge with a big couch, a dining table, a staircase |
| 54 | Mansion | (use #39) | A double-height lounge, chandelier, white sofas, pool view |
| 55 | Crazy house | (use #40) | Gold everything: a throne chair, an aquarium wall, a car gallery behind glass |

## What you can generate first
Batch A is Priority 1 and 2 (#1–16). That unblocks going inside places in the two open areas, and the road look. Then the Island and Tech Mile sets (#19–36), then vehicles (#44–49), then homes.
