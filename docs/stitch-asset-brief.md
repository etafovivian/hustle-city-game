# Stitch asset brief — Naija Hustle City

These are the assets the map and the app need next, in priority order, with prompts written to match the art we already ship: the market stall, The Hangout, The Hive, danfo park, city park and signpost in `apps/web/public/art/`.

## How to get consistent results

- **Attach a style reference** to every request: `market-square.webp` or `hangout.webp`. Say *"match this exact art style, outline weight, lighting and camera angle."*
- **Paste the style block first**, then one asset prompt.
- **One object per image**, 1024 × 1024, full object visible.
- **Background:** transparent, or a **flat solid magenta `#FF00FF`**. Do not use a checkerboard: Stitch paints fake checkerboards into the pixels, and they're hard to remove. I cut out the background.
- Send me the export zip and I'll cut out, optimise, add provenance, and place everything on the map.

### Style block (paste first, every time)

> Isometric 2:1 cartoon game asset for a 2026 mobile city-builder set in Lagos, Nigeria. Hand-drawn style with bold dark outlines, rich saturated colour, and warm night lighting from string lights, lamps and glowing windows, matching the attached reference exactly. Camera: classic 2:1 isometric, the object's front corner facing the viewer. Authentic Lagos street detail: Ankara wax-print fabric, corrugated roofing, generators, plastic stools, palm trees.
>
> Rules:
> - No real brand names or logos (no MTN, Glo, Airtel, banks or car badges).
> - No currency symbols.
> - No religious, ethnic or political slogans.
> - Signs may only read the words given in the prompt, or be blank.
> - Single object, centred, nothing cropped.
> - Flat solid magenta `#FF00FF` background.

---

## Priority 1 — what each existing place still needs

For **Market Square, Work Hub (The Hive) and The Hangout**:

| # | Asset | Size | Why |
|---|-------|------|-----|
| 1 | **Map icon**: a simplified, chunky version of the building, readable when tiny | 512 × 512 | Shown when zoomed out instead of the detailed art |
| 2 | **Close-up / interior scene**: the inside or front counter, wide | 1600 × 900 | Page header for the place, and the deep-zoom view |
| 3 | **"Coming soon" state**: the same building under scaffolding with tarps | 1024 × 1024 | Places not yet open in a district |

Prompt patterns:
- *"…a simplified chunky icon version of [the attached building], fewer details and thicker shapes, still readable at 48 pixels."*
- *"…interior view of [the place]: [Market Square: a stall owner's counter with phones, chargers, sachet water and fruit] / [Work Hub: an open-plan co-working floor with laptops, whiteboards and a generator room door] / [The Hangout: a lounge with plastic chairs, a suya grill, a TV showing football and string lights]. Wide 16:9 scene, same style."*
- *"…the same [building] under construction: bamboo scaffolding, blue tarpaulin, a cement mixer, a sign that says COMING SOON."*

## Priority 2 — merchant spaces (from the PRD: 3 free and 2 premium templates)

All on the **same square plot footprint**, so they line up on the map's open plots:

| Template | Prompt core |
|----------|-------------|
| Free: **Shop** | A small Lagos lock-up shop with a roll-up metal shutter, a blank signboard and a counter facing the street |
| Free: **Workshop** | An artisan repair workshop under a corrugated roof: workbench, generator parts, phone-repair tools, an extension reel |
| Free: **Office** | A small one-room office in a bungalow: a desk visible through the window, a potted plant, an AC unit |
| Premium: **Showroom** | A modern glass-front showroom with display shelves, a gold-trimmed canopy and spotlights |
| Premium: **Headquarters** | A three-storey branded-looking headquarters with a blank rooftop sign, glass and gold accents, and a small forecourt |

Also on the same plot:
- an **empty plot** with a sign reading "PLOT AVAILABLE"
- a **construction site** version of the empty plot

## Priority 3 — ground tiles (make the map feel like a city)

Ground tiles are 2:1 isometric diamonds, **512 × 256**, flat ground only, seamless edges, no buildings:

- road straight (two directions)
- crossroad
- T-junction
- roundabout with a centre planter
- kerb and sidewalk
- paved plaza
- grass
- sandy roadside
- lagoon water edge
- small bridge

## Priority 4 — props and life

Each one alone on magenta, 512 × 512:

- **Lighting and plants:** a lit street lamp; palm trees (2 variants).
- **Street items:** a generator; a trash bin; a bench; a blank billboard; a roadside kiosk with no brands.
- **Vehicles:** an okada with a rider; a keke napep; a danfo facing left and one facing right, with no text.
- **People:** pedestrians and shoppers in 6 poses (walking, carrying a bag, on the phone, sitting).

## Priority 5 — the four future districts (one landmark each)

| District | Landmark |
|----------|----------|
| Tech Mile | A glass tech tower with rooftop satellite dishes and solar panels |
| Owambe Gardens | An event hall with a party canopy, aso-ebi-coloured drapes and string lights |
| Marina Wharf | A jetty with a small ferry boat and fishing canoes on lagoon water |
| Danfo Terminal | A big bus park with rows of danfos under a long shed |

## Priority 6 — UI art

| Asset | Notes |
|-------|-------|
| **City Coin icon** | A gold coin stamped with a five-point star and "CC". **No ₦.** 256 × 256 |
| XP icon | A small gold lightning or star badge |
| Quest scroll / clipboard icon | For the quest list |
| Empty states (3) | "No merchants match", "No sales yet this week", "Shop is empty: restock" — small illustrations |
| Achievement badges (6) | First sale, 10 customers served, first week, quest streak, top of the Hangout, first restock |
| **Logo variant** | The same logo with the ₦ coins replaced by CC star coins, plus a horizontal wordmark version |

---

## What I can and can't do

- **I can:**
  - write and refine these prompts;
  - cut out backgrounds and optimise images;
  - record provenance;
  - place every asset on the map and wire it into the zoom levels;
  - draw simple geometry myself in code: the map ground, roads, plot outlines, lamp glows.
- **I can't:** generate painted art in this environment. That has to come from Stitch, ChatGPT or Gemini, or from an image API key added to the project.

---

## Request batch 2 — more buildings for the map (send to Stitch)

Use the same style block, attach `market-square.webp` as the style reference, and use a **flat magenta background**. Each building sits on the same square isometric plot.

**Daily-life places**
1. Mama Put buka: an open-front food spot with a pot stand, wooden benches, a smoky grill and a blank signboard.
2. Pharmacy: a small chemist with a green cross sign (no brand) and shelves visible through glass.
3. Barbershop: a salon chair visible inside, a striped pole, a hand-painted sign reading "BARBER".
4. Tailor / fashion shop: Ankara bolts on display, a sewing machine at the window.
5. Phone repair kiosk: a small booth with a phone sign (no logos), a glass counter and tools.
6. Provision store: a supermarket front with a crate stack and a cooler outside.
7. Fuel station: two pumps and a canopy, with no brand.
8. Bank-style "City Vault" building: columns, an ATM-style wall slot, no real bank name. For a later stage.

**Homes (where players live)**
9. Face-me-I-face-you compound: a long bungalow with many doors and a shared courtyard.
10. Mini-flat block: two storeys, balconies, a water tank on the roof.
11. Duplex with a gate: a fenced compound with a small generator house.

**Civic and fun**
12. Community school.
13. Viewing centre: a football screening hall with plastic chairs and a projector glow.
14. Church/mosque-neutral "Town Hall": a civic building with a flag pole and an empty flag.
15. Beach front / Bar Beach style kiosk with umbrellas, for the Marina Wharf district.

**People and avatars (onboarding preview, better than flat avatars)**
16. A full-body character turnaround sheet in the same art style. Six presets: a market woman in gele, a male trader in kaftan, a tech sis with a laptop bag, an artisan in overalls, a chop seller with an apron, and a student. Each is front-facing, full body, on magenta.
17. Hustle card illustrations (four, 1024 × 768): Market trader, Chop seller, Gadget plug, Fix-it artisan.
18. Dream card illustrations (four): Market Royalty (a crowned stall), Showroom Owner (a glass showroom), Junction Legend (a trophy over the roundabout), Everybody's Padi (friends at The Hangout).
19. Phone app icons (rounded squares, 512 × 512): Jobs, Quests, Standings, Messages, Market.
