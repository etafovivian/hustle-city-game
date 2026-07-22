---
name: Naija Hustle City
description: Lagos Street Arcade — Junction 101 at night, gold-lit stalls on midnight navy, where every surface still prints its one plain rule.
colors:
  midnight-navy: "#0a0f24"
  navy-panel: "#121835"
  navy-well: "#182042"
  shell-indigo: "#1e2a5e"
  shell-ink: "#e9ecfb"
  street-light: "#f1f4ff"
  haze: "#9aa6c8"
  hairline: "#27325c"
  hairline-strong: "#34406f"
  arcade-gold: "#ffc72c"
  arcade-gold-pressed: "#e6b020"
  gold-ink: "#0a0f24"
  ankara-red: "#df382b"
  naija-green: "#00a859"
  ok-mint: "#4ade80"
  danger-coral: "#ff8f80"
  map-night: "#1a2350"
  map-night-edge: "#0d1333"
  map-road: "#232c5a"
  map-lane: "#3d4886"
typography:
  display:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "clamp(30px, 3.4vw, 42px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "clamp(28px, 5vw, 40px)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title-sm:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-sm:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  cta:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "clamp(14px, 3.6vw, 17px)"
    fontWeight: 800
    letterSpacing: "0.04em"
  label:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.08em"
  selvedge:
    fontFamily: "Outfit Variable, Outfit, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.16em"
rounded:
  tag: "4px"
  plate: "10px"
  md: "12px"
  well: "14px"
  frame: "16px"
  cta: "18px"
  card: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  gutter: "16px"
  page-max: "1160px"
  rail: "340px"
components:
  button-primary:
    backgroundColor: "{colors.arcade-gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.arcade-gold-pressed}"
    textColor: "{colors.gold-ink}"
  button-primary-disabled:
    backgroundColor: "{colors.navy-well}"
    textColor: "{colors.haze}"
  button-cta-xl:
    backgroundColor: "{colors.arcade-gold}"
    textColor: "{colors.gold-ink}"
    typography: "{typography.cta}"
    rounded: "{rounded.cta}"
    height: "58px"
    width: "100%"
  button-secondary:
    backgroundColor: "{colors.navy-panel}"
    textColor: "{colors.street-light}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
    height: "46px"
  button-secondary-hover:
    backgroundColor: "{colors.navy-well}"
  button-small:
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    height: "38px"
  input:
    backgroundColor: "{colors.navy-panel}"
    textColor: "{colors.street-light}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  input-well:
    backgroundColor: "{colors.navy-well}"
    textColor: "{colors.street-light}"
    rounded: "{rounded.well}"
    padding: "10px 12px"
    height: "50px"
  chip:
    backgroundColor: "{colors.navy-panel}"
    textColor: "{colors.street-light}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.arcade-gold}"
    textColor: "{colors.gold-ink}"
  segmented:
    backgroundColor: "{colors.navy-well}"
    textColor: "{colors.haze}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-selected:
    backgroundColor: "{colors.arcade-gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  coin-balance:
    backgroundColor: "{colors.arcade-gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  tag:
    backgroundColor: "{colors.navy-well}"
    textColor: "{colors.haze}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  tag-demo:
    backgroundColor: "{colors.arcade-gold}"
    textColor: "{colors.gold-ink}"
  shellbar:
    backgroundColor: "{colors.shell-indigo}"
    textColor: "{colors.shell-ink}"
    padding: "10px 16px"
  selvedge:
    backgroundColor: "{colors.midnight-navy}"
    textColor: "{colors.arcade-gold}"
    typography: "{typography.selvedge}"
    padding: "5px 16px"
  selvedge-band:
    backgroundColor: "{colors.arcade-gold}"
    textColor: "{colors.gold-ink}"
    padding: "10px 16px"
  place-plate:
    backgroundColor: "{colors.navy-panel}"
    textColor: "{colors.street-light}"
    rounded: "{rounded.plate}"
    padding: "10px 14px"
  map-name-plate:
    backgroundColor: "{colors.midnight-navy}"
    textColor: "{colors.street-light}"
    rounded: "{rounded.pill}"
    height: "38px"
---

# Design System: Naija Hustle City

## Overview

**Creative North Star: "Lagos Street Arcade"**

Junction 101 is a Lagos street at night seen as an arcade: midnight navy ground, gold light pooling under lamps and on the one thing you should press, danfo yellow and Ankara cloth as the city's own colour. The look is user-pinned: the owner designed the welcome and sign-in in Google Stitch ("Lagos Street Arcade") and approved its palette, Outfit, the logo and the isometric building art. That pin supersedes the earlier Wax-Print Selvedge world for type, palette and imagery. Dark is the product's own look, not a theme setting; there is no light mode to fall back to.

The arcade is a game skin over a working shop and a real merchant directory, so it stays legible and operational. Sections sit flat on the navy ground divided by hairlines; only the city itself (the map frame, place headers, the welcome brand card) is raised. Three pieces carry over from the previous world and still define it: the market wax-print circle repeat as cloth (welcome panel, place headers), the selvedge truth strip that prints each surface's one plain rule, and exact-time bars. Players wear DiceBear Personas avatars.

The world refuses the fintech white-card default and the generic neon-cyber game skin. Gold glows softly; nothing is neon, nothing is chrome.

**Key Characteristics:**
- Midnight navy ground with two navy panel steps; gold is the one action and the coin colour.
- Outfit throughout, heavy and uppercase for calls to action and the brand lockup; tabular figures everywhere.
- Raster isometric Lagos art from Stitch on a 2:1 isometric road ground; name plates on every place.
- Pill-shaped controls; plates and frames with moderate rounding.
- A selvedge strip on every surface stating its one rule (gold on navy; solid gold band on the mobile welcome).
- Coins are game money: shown as a number with a coin icon and the words "City Coins", never with a currency symbol.

## Colors

A night palette: three navy depths, one gold, two cloth accents used sparingly.

### Primary
- **Arcade Gold** (arcade-gold): the single action colour and the coin colour. Primary and "go" buttons (with the soft gold glow), the coin balance pill, quest rewards, the selected chip and segmented tab, focus outlines, the selvedge text, the Hustle in the lockup, the unvisited-place badge and lamp light on the map. Its pressed step **Arcade Gold Pressed** (arcade-gold-pressed) is the hover fill. Text on gold is always **Gold Ink** (gold-ink), the ground navy.

### Secondary
- **Naija Green** (naija-green): progress that is done or filling. Quest progress bars, completed order stages, the strong end of the password strength meter, the live status dot.

### Tertiary
- **Ankara Red** (ankara-red): the text caret and the red centres of the market print. An accent of the cloth, not a UI state colour.

### Neutral
- **Midnight Navy** (midnight-navy): the page ground, the selvedge strip, the map name plates, and the browser `theme-color`.
- **Navy Panel** (navy-panel): raised surfaces and default controls (secondary buttons, inputs, chips, plates, the mobile intro card).
- **Navy Well** (navy-well): one step deeper inside a panel: hover fills, welcome input wells, segmented track, bar tracks, the takings strip.
- **Shell Indigo** (shell-indigo) with **Shell Ink** (shell-ink): the sticky top bar and the toast.
- **Street Light** (street-light): body text. **Haze** (haze): secondary text, placeholders, table heads.
- **Hairline** (hairline) and **Hairline Strong** (hairline-strong): dividers between sections and control borders.
- **Ok Mint** (ok-mint) and **Danger Coral** (danger-coral): state text (claimed, done steps, errors, zero stock, negative margin), brightened for contrast on navy rather than reusing the cloth green and red.
- **Map Night** (map-night radiating to map-night-edge), **Map Road** (map-road), **Map Lane** (map-lane): the map's own ground; roads and dashed lane marks.

### Named Rules
**The One Gold Rule.** Gold marks what to press and what you earn. One gold-filled action per region; everything else is a navy pill.

**The Coins Are Not Cash Rule.** Coin amounts show a number, a coin icon, and "City Coins" where space allows; never ₦, $ or any currency symbol in UI chrome. Naira (₦) appears only on real merchant prices in the directory.

**The Dark-First Rule.** Navy is the product's ground by the owner's pin. Do not add a light theme or white cards.

## Typography

**Display Font:** Outfit Variable (self-hosted via @fontsource-variable/outfit), falling back to Outfit, system-ui
**Body Font:** the same Outfit
**Label/Mono Font:** none; labels are Outfit, uppercase and tracked

**Character:** One geometric sans, run from regular body to black uppercase display. Outfit is user-pinned with the Stitch design. Weights are used finely (650, 750 and 850 occur alongside 400, 700, 800 and 900); figures are tabular site-wide so coin counts and timers do not jitter.

### Hierarchy
- **Display** (display): the brand lockup on the welcome card, uppercase, Hustle in gold. The shell lockup is its smaller sibling (850, 20px, uppercase).
- **Headline** (headline): page titles such as Junction 101 and Find a business; place names on plates step down to clamp(24px, 5vw, 32px).
- **Title** (title): section headings; the welcome form heading runs larger, clamp(26px, 4vw, 38px) at 800, with its key phrase in gold.
- **Title small** (title-sm): side-rail and section titles (Today's quests, Standings); quest titles at 16px.
- **Body** (body): reading text, 16px/1.5; long copy capped near 62ch. **Body small** (body-sm) for hints, notes and directory detail.
- **Call to action** (cta): uppercase, 800, tracked 0.04em, on CTA buttons only.
- **Label** (label): uppercase tracked field labels; table heads, tags and order stages use the same treatment at 0.06em.
- **Selvedge** (selvedge): uppercase at 0.16em for the truth strip; 800 on the mobile gold band.

### Named Rules
**The Shout Only to Act Rule.** Heavy uppercase belongs to the brand lockup, calls to action, labels and the selvedge. Headings stay sentence case.

**The Tabular Rule.** Every number is set with tabular figures and right-aligned in tables.

## Layout

A single centred column (max 1160px, 16px gutter) under a sticky shell bar. At 900px and up, signed-in pages split into the main column and a 340px quest rail that sticks below the bar, divided by a hairline; below that the rail follows the content. Rhythm runs on 4/8/12/16/24px steps: 12px inside stacks, 24px between sections, 16px row padding.

The welcome is its own layout. Desktop (900px+): a 46/54 split, the left wax-print cloth panel sticky at full viewport height fading to navy, carrying the brand card and the selvedge at its foot; the form is centred on the right (max 560px). Mobile: a 300px street-scene hero with the logo and account tabs, the solid gold selvedge band, then the form with its intro in a navy panel card. Below 560px the shell drops the wordmark and secondary items, the selvedge wraps to one statement, and map name plates scale up 1.5x to stay readable.

The map is an 800×640 isometric scene in a framed panel: two 2:1 roads crossing at the Junction 101 roundabout, lamp pools on the ground, decorative scenery (city park, danfo park, signpost) at reduced opacity, and three place hotspots each with art, a ground shadow and a name plate.

## Elevation & Depth

Mostly flat: content sections sit on the ground and are separated by hairlines, not cards. Depth is reserved for the city and for the primary action. Raised pieces (map frame, place header frame, plates, mobile intro card) share one dark ambient shadow. Gold elements emit light instead of casting shadow: the primary CTA, the ready quest and the logo carry a soft gold glow, and map buildings gain a gold halo on hover or focus while lifting 4px.

### Shadow Vocabulary
- **Ambient** (`0 1px 2px rgb(0 0 0 / 40%), 0 14px 32px -12px rgb(0 0 0 / 65%)`): raised frames and plates, the selected segmented tab.
- **Gold glow** (`0 10px 28px -8px rgb(255 199 44 / 45%)`): primary and go buttons, ready quest plates.
- **Brand card** (`0 30px 60px -20px rgb(0 0 0 / 70%)`): the welcome brand card over the cloth.
- **Art drop** (`drop-shadow(0 10px 18px rgb(0 0 0 / 55%))`): place art on headers; the logo instead takes a gold drop-shadow at 35%.

### Named Rules
**The Light Not Lift Rule.** Gold glows; navy casts shadow. A gold element never gets a black drop shadow, and a navy panel never glows.

**The No Card Soup Rule.** Lists and sections sit on the ground divided by hairlines. Only the city's own pieces are framed.

## Shapes

Pills for anything you press or toggle: buttons, chips, segmented tabs, the coin balance, steppers, price inputs, shell buttons, map name plates. Moderately rounded rectangles for things you read: plates (10px), inputs (12px; 14px wells on the welcome), map and place frames (14 to 16px), the big CTA (18px), the welcome brand card (24px). Tags are the one near-square form (4px). Bars are 5 to 8px tall with half-height rounding. Avatars are circles ringed in gold.

## Components

### Buttons
- **Shape:** pill, 46px tall; small 38px.
- **Primary / Go:** gold fill, navy ink, gold glow; hover to the pressed gold; disabled drops to the navy well with haze text and no glow. Press moves 1px down.
- **Call to action:** primary plus uppercase 800 tracked type; the full-width welcome submit is 58px with 18px corners and lifts 1px on hover.
- **Secondary:** navy panel with a strong hairline; hover to navy well. **Quiet:** transparent until hover.
- **Focus:** 3px gold outline, 2px offset, everywhere.

### Chips and Tabs
- **Chips:** navy pill with hairline, 13px/600; the pressed state fills gold.
- **Segmented tabs:** a navy-well pill track; the selected tab fills gold with ambient shadow.
- **Tags:** small uppercase on navy well with 4px corners; the demo tag is gold.

### Inputs / Fields
- **Style:** navy panel, strong hairline, 12px corners, 44px. Welcome wells: navy well, 14px corners, 50px, uppercase tracked labels above, an @ prefix for the nickname and an eye toggle for the password.
- **Focus:** gold outline at zero offset.
- **Error:** coral text below the field; a four-segment strength meter (gold, then green when strong).

### Navigation
- **Shell bar:** sticky shell indigo; logo plus uppercase lockup (a button back to the map), the gold coin balance pill, XP, the avatar ringed in gold, and a ghost pill Sign out. Below 560px only the logo, balance and an icon sign-out remain.

### Selvedge (signature)
A narrow uppercase strip stating the surface's one rule ("City Coins are game money — no cash value", or the place rule). Gold on midnight navy, the statement repeated decoratively with small diamond separators (repeats are hidden from assistive tech). On the mobile welcome it becomes a solid gold band with navy text, centred, one statement.

### Junction 101 Map (signature)
An isometric 2:1 night ground drawn as SVG geometry (roads, kerbs, dashed lanes, a gold-ringed roundabout plate) with gold lamp pools, and raster place art placed as SVG images. Each place is a keyboard-focusable button: ground shadow, art that lifts and glows gold on hover or focus, a midnight pill name plate with a faint gold stroke, and a gold star badge until first visited.

### Place Header (signature)
A framed band filled with the place's wax-print repeat, the place name on a navy plate, the place art at the right, a Map back button, and the place's selvedge at its foot.

### Quest Bolt
A rail item on the ground with title, gold coin reward, green progress bar, count and Claim. When ready it rises onto a navy panel ringed 1.5px in gold with the gold glow, and Claim becomes the gold go button.

### Exact-Time Bar
A label, a tabular countdown ("4h 12m left"), and a 6px bar whose length is exactly the time remaining (gold fill on navy well).

### Art Set
Raster isometric Lagos art from Stitch in `public/art/*.webp` (logo, market-square, work-hub, hangout, city-park, danfo-park, signpost, street-scene). Each file has a `.webp.json` provenance sidecar recording its origin in the owner's Stitch export, its processing (background cutout, WebP) and the owner's approval.

## Do's and Don'ts

### Do:
- **Do** keep midnight navy as the ground and Outfit as the only face; both are owner-pinned.
- **Do** use arcade gold for exactly one primary action per region and for coins; text on gold is gold ink.
- **Do** give every new surface a selvedge strip that states its one plain rule.
- **Do** show coin amounts as a tabular number with the coin icon and "City Coins"; keep ₦ for real merchant prices only.
- **Do** add new places and scenery as raster isometric art from the Stitch set, shipped as WebP with a provenance sidecar, sharing the 2:1 projection of the map ground.
- **Do** use exact-time bars wherever something resets or expires.
- **Do** give every map place a name plate and a real button role.

### Don't:
- **Don't** put a currency symbol on coins anywhere in UI chrome.
- **Don't** draw illustration in inline SVG; place, building and scene art is raster from the Stitch set. Inline SVG is for map ground geometry, the wax-print tiles and icons only.
- **Don't** add a light theme, white cards or neon-cyber effects; gold glows softly and nothing else glows.
- **Don't** set headings in uppercase; uppercase is for the lockup, calls to action, labels and the selvedge.
- **Don't** wrap content sections in cards; divide them with hairlines.
