---
name: Naija Hustle City
description: Wax-Print Selvedge — every place in Junction 101 is its own bolt of wax-print cloth, and the selvedge prints the truth.
colors:
  indigo: "#1f2a6b"
  indigo-deep: "#141c4d"
  indigo-ink: "#e9ecfb"
  cadmium-yellow: "#f2b705"
  yellow-ink: "#2a1f00"
  madder-red: "#c8321e"
  leaf-green: "#1e7a46"
  cotton: "#f7f4ea"
  ground: "#f2f3f9"
  sheet: "#ffffff"
  sheet-2: "#e8eaf4"
  text: "#141833"
  muted: "#4c5275"
  rule: "#d3d7ea"
  rule-strong: "#b4bad6"
  ok: "#17663a"
  danger: "#b0281a"
  coin: "#8a6400"
  map-ground: "#e6e2d3"
  map-road: "#b9b4a3"
  map-lane: "#f7f4ea"
  map-grass: "#a9c98f"
  night-ground: "#0d1233"
  night-sheet: "#151b45"
  night-sheet-2: "#1d2456"
  night-text: "#eef0fb"
  night-muted: "#aab0d6"
  night-rule: "#2a3268"
  night-rule-strong: "#3b447e"
  night-accent-ink: "#1b1400"
  night-ok: "#6fd69a"
  night-danger: "#ff8f80"
  night-coin: "#f2c443"
  night-map-ground: "#1b2150"
  night-map-road: "#2c3470"
  night-map-lane: "#4a5394"
  night-map-grass: "#24493a"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(34px, 7vw, 60px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "'wdth' 70"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(28px, 5vw, 40px)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 88"
  place-title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "clamp(24px, 5vw, 32px)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 88"
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 88"
  section-title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 750
    lineHeight: 1.15
    fontVariation: "'wdth' 88"
  figure:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 85"
  lockup:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 850
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 75"
  body:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
  body-small:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 650
  label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.06em"
  selvedge:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.16em"
rounded:
  bar: "3px"
  tag: "4px"
  control: "10px"
  plate: "10px"
  toast: "12px"
  cloth: "14px"
  map-frame: "16px"
  pill: "999px"
spacing:
  hair: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
    height: "44px"
  button-hover:
    backgroundColor: "{colors.sheet-2}"
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.sheet}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
    height: "44px"
  button-go:
    backgroundColor: "{colors.cadmium-yellow}"
    textColor: "{colors.yellow-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
    height: "44px"
  button-disabled:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.muted}"
  button-quiet:
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  button-sm:
    padding: "6px 10px"
    height: "36px"
  shell-button:
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
    height: "36px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  segmented:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-selected:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    height: "32px"
  chip-pressed:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.sheet}"
  tag:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  tag-demo:
    backgroundColor: "{colors.cadmium-yellow}"
    textColor: "{colors.yellow-ink}"
  balance:
    backgroundColor: "{colors.cadmium-yellow}"
    textColor: "{colors.yellow-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  shellbar:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.indigo-ink}"
    padding: "10px 16px"
  selvedge:
    backgroundColor: "{colors.indigo-deep}"
    textColor: "{colors.cadmium-yellow}"
    typography: "{typography.selvedge}"
    padding: "5px 16px"
  place-plate:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.text}"
    rounded: "{rounded.plate}"
    padding: "10px 14px"
  timebar:
    backgroundColor: "{colors.sheet-2}"
    rounded: "{rounded.bar}"
    height: "6px"
  timebar-fill:
    backgroundColor: "{colors.indigo}"
    rounded: "{rounded.bar}"
  bolt-plate:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.plate}"
    padding: "10px 12px"
  bolt-plate-ready:
    backgroundColor: "{colors.sheet}"
  bolt-bar:
    backgroundColor: "{colors.sheet-2}"
    rounded: "{rounded.tag}"
    height: "8px"
  bolt-bar-fill:
    backgroundColor: "{colors.leaf-green}"
  toast:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.toast}"
    padding: "12px 16px"
  map-name-plate:
    backgroundColor: "{colors.indigo-deep}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.plate}"
    height: "40px"
---

# Design System: Naija Hustle City

## Overview

**Creative North Star: "Wax-Print Selvedge"**

Every place in Junction 101 is its own bolt of wax-print cloth, and the selvedge, the printed edge of the cloth, prints the truth. The shell is indigo-dyed; three authored two-colour repeats in cadmium yellow, madder red, leaf green and indigo give Market Square, Work Hub and The Hangout their own cloth. Everything that is not cloth sits flat on a pale indigo-white ground, divided by hairlines. The world refuses the fintech default of white cards on grey with one green accent.

The type is one variable grotesque, Archivo, used for display and data alike; its width axis does the expressive work (condensed and uppercase for the name and the welcome, slightly narrowed for headings, full width for reading). Numbers are tabular and right-aligned so coin amounts, stock and countdowns read like a ledger. Light mode is the default because the player holds a mid-range Android outdoors in Lagos daylight; an indigo-dyed night mode follows the system preference.

Truth is carried by structure, not decoration: a single printed rule on each surface's selvedge says what is real (coins have no cash value; jobs pay only when funded), timed states are bars of exact remaining time, and quest bolts unroll their cloth only when there is something to claim.

**Key Characteristics:**
- Indigo shell, yellow coin balance, cloth only where a place is.
- Three authored wax-print tiles, one per place, reused as CSS backgrounds and SVG pattern fills.
- One selvedge per surface, stating that surface's one rule.
- Hairlines on the ground; only the cloth (map, place header, welcome cloth) is raised.
- Archivo Variable with the `wdth` axis as the display voice; tabular numerals throughout.
- Bars, not spinners or badges, for time and progress.

## Colors

A dyer's palette: indigo for the shell and primary actions, cadmium yellow for coins and "go", madder red and leaf green living mostly inside the prints, on an indigo-tinted white ground.

### Primary
- **Indigo Dye** (indigo): the shell bar, primary buttons, selected segmented tabs and chips, pressed swatch ring, timed-state bar fill, toast and the welcome plate. The colour of the cloth itself; it never changes between modes (the shell stays indigo at night).
- **Deep Indigo** (indigo-deep): the selvedge strip and the map's name plates and junction sign. One step darker than the shell so the printed edge reads as the cloth's border.
- **Indigo Ink** (indigo-ink): text and icons on the indigo shell.

### Secondary
- **Cadmium Yellow** (cadmium-yellow): the coin balance pill, the "go" button (serve, claim, browse merchants), the selvedge lettering, the demo-listing tag, the current stage in an order strip, text selection and the focus ring. Always paired with **Yellow Ink** (yellow-ink) for text on it.

### Tertiary
- **Madder Red** (madder-red): lives in the prints (Hangout ground, Market Square centres) and the Market Square stalls on the map; in the UI only as the text caret. Not an error colour.
- **Leaf Green** (leaf-green): quest-progress fill, completed order stages, palms and the Hangout building. Not a success-message colour.
- **Cotton** (cotton): the undyed cloth in prints and map stalls.

### Neutral
- **Indigo-White Ground** (ground): the page background everything sits on; also the resting fill of a quest bolt plate.
- **Sheet** (sheet) / **Sheet Two** (sheet-2): control surfaces and plates; sheet-2 for hover, disabled, bar tracks and the takings band.
- **Ink Text** (text) / **Muted** (muted): body copy and secondary copy (both indigo-tinted, never neutral grey).
- **Hairline** (rule) / **Strong Hairline** (rule-strong): dividers between sections and rows; control borders use rule-strong.
- **Status:** ok and danger are their own deeper tones (not leaf-green or madder-red) so status text holds contrast; coin is a darkened yellow for reward amounts on light ground.
- **Map tones** (map-ground, map-road, map-lane, map-grass): a warm laterite-and-grass ground so the indigo-and-yellow cloth on the buildings pops.

### Night (prefers-color-scheme: dark)
The ground becomes indigo-dyed (night-ground, night-sheet, night-sheet-2), text and rules shift to the night-* tokens, and the **accent flips from indigo to cadmium yellow** (primary buttons, selected tabs, chips, checkbox, timed-state fill, pressed swatch ring) with night-accent-ink on it. Shell, selvedge, prints and map buildings keep their dye colours.

**The Dye Lot Rule.** Saturated colour comes from the cloth: indigo, yellow, red and green appear in the shell, the prints, the coin and the one "go" action per moment. Everything else is ground, sheet, ink and hairline.

**The Coins-Are-Yellow Rule.** Cadmium yellow marks City Coins and the action that earns them. Real-money prices (naira, merchants) are set in plain ink, never yellow.

## Typography

**Display Font:** Archivo Variable (with Archivo, system-ui, sans-serif), loaded with the width axis.
**Body Font:** the same family.

**Character:** One sturdy grotesque doing everything, the way signwriting and ledger books share one hand at a market stall. Width is the expressive axis: condensed caps for the name, narrowed headings, full-width reading text.

### Hierarchy
- **Display** (900, clamp 34–60px, 0.95, width 70%, uppercase): the welcome plate's "Naija Hustle City" only.
- **Lockup** (850, 20px, 17px under 560px, width 75%, uppercase, 0.01em): the shell-bar name, second line in yellow.
- **Headline** (800, clamp 28–40px, 1.15, width 88%, -0.01em): page titles (Junction 101, Find a business). Inside a place-plate it drops to clamp 24–32px.
- **Title** (750, 24px): section headings (Customer at your counter, shop name).
- **Section title** (750, 18px): side-column and list headings (Today's quests, Example jobs); bolt titles at 16px.
- **Figure** (800, 28px, width 85%, tabular): money amounts that are the point of a section (takings to collect). The order line uses 750/20px/width 90%.
- **Body** (400, 16px, 1.5, tabular numerals on): running copy, capped near 44–62ch where it is prose.
- **Small / Tiny** (14px / 12px): hints, metadata, bar captions.
- **Control** (650): every button, tab, field label and stepper value.
- **Label** (700, 12px, 0.06em, uppercase): table and inventory column heads, tags, order stage names.
- **Selvedge** (700, 11px, 0.16em, uppercase): only the selvedge strip.

**The One Hand Rule.** Archivo Variable is the only family. Hierarchy comes from weight (400–900) and the `wdth` axis (70–100%), never a second face.

**The Ledger Rule.** Numbers are tabular everywhere and right-aligned in columns (stock, cost, price, coins, standings, countdowns).

## Layout

A centred column (max 1160px; 820px for the merchant browse page) with 16px gutters and generous bottom space (96px) for the toast. From 900px the page becomes two columns: the main column and a 340px quest column, sticky under the shell bar at 72px and separated by a vertical hairline; below 900px quests follow beneath the main column after a top hairline. The welcome screen splits 1.05fr / 1fr at 900px with the cloth sticky at full viewport height; below, the cloth stacks above the form (min 220px).

Spacing runs 4 / 6 / 8 / 12 / 16 / 20 / 24px: 12px between items in a stack, 24px between sections, 16px internal padding on sections and rows. Breakpoints are 560px (selvedge wraps to one line, secondary shell items hide, map name plates scale 1.5×) and 900px (two columns).

**The Hairline-on-Ground Rule.** Sections sit directly on the ground and are divided by 1px hairlines (rule between rows, rule-strong above a section). There are no cards: if something needs a box, it is either cloth or a plate on cloth.

## Elevation & Depth

Flat by default. Depth belongs to the cloth: the map frame, the place-header cloth frame and the welcome plate lift off the ground with one soft two-layer shadow; plates set on cloth (place plate, a claimable quest's plate) take the same shadow so they read as name boards pinned to fabric. The toast and welcome plate use a deeper indigo-tinted drop because they sit over cloth or content. Night mode deepens the shadow to black.

### Shadow Vocabulary
- **Cloth lift** (`0 1px 2px rgb(20 24 51 / 8%), 0 8px 24px -8px rgb(20 24 51 / 18%)`; night `0 1px 2px rgb(0 0 0 / 40%), 0 10px 28px -10px rgb(0 0 0 / 60%)`): map frame, place-header frame, place plate, ready bolt plate.
- **Plate over cloth** (`0 20px 40px -20px rgb(20 28 77 / 70%)`): the welcome plate.
- **Toast** (`0 16px 32px -12px rgb(20 28 77 / 60%)`): the toast.

**The Only-Cloth-Is-Raised Rule.** A section, list, table or form never gets a shadow. Lift is reserved for cloth and the plates set on it.

## Shapes

Gently rounded, never pill-shaped except where the object is a token or a toggle. Controls and plates use a 10px corner; cloth frames 14px; the map frame 16px; the toast 12px. Pills (999px) are reserved for the coin balance, shell buttons, segmented tabs and filter chips. Bars and tags are almost square (3–4px). The selvedge is square-edged and full-bleed; its separator is a 6px yellow diamond (a rotated square), the one ornament outside the prints.

**The Print Tile Rule.** The three prints are authored 48×48 tiles in the cloth palette, rendered as CSS backgrounds (place header at 48px, welcome cloth at 64px, quest bolts at 32px, lockup swatch at 28px) and as SVG patterns at 0.6 scale on the map. New places get a new authored tile, not a recolour of an existing one.

- **Market Square, "record" circles:** indigo concentric rings in half-drop with madder centres and diamonds, on cadmium ground. Used for Market Square's place header, its map umbrellas and the junction roundabout, the welcome cloth, the lockup swatch, and every quest without a place of its own (including First steps).
- **Work Hub, ladder-brick:** leaf-green stepped bricks with yellow ticks on indigo. Used for the Work Hub header, its building fascia on the map, and the tour quest.
- **The Hangout, fan-and-dot:** yellow quarter-fans with red rays and indigo dots on madder. Used for the Hangout header, its canopy on the map, and the standings quest.

## Components

### Buttons
- **Shape:** gently curved (10px), 44px minimum height (36px for small), 650 weight, 8px icon gap.
- **Default:** sheet with a strong-hairline border; hover to sheet-2; press nudges down 1px.
- **Primary:** indigo (yellow at night) for committing actions: Open my shop / Sign in, Collect, Buy. Hover brightens.
- **Go:** cadmium yellow with yellow ink for the action that earns coins or leaves the game for real merchants: Serve, Claim (only when ready), Browse merchants.
- **Quiet:** transparent until hover.
- **Disabled:** all variants collapse to sheet-2 with muted text and a plain hairline; no filter.
- **Shell button:** transparent pill with a 30% indigo-ink border on the shell bar.

### Chips, Tags and the Balance
- **Chip:** pill, sheet with strong hairline, 13px/600; pressed becomes accent.
- **Tag:** near-square label (4px), sheet-2 with muted label type; the demo-listing tag is yellow so mock data is never mistaken for a real business.
- **Coin balance:** yellow pill on the indigo shell with a coin icon, tabular amount, and "City Coins" unit (hidden under 560px); its title states that coins have no cash value.

### Inputs / Fields
- **Style:** sheet, strong hairline, 10px corner, 44px tall, 10px 12px padding; label above in control weight (14px), hint in muted 13px, error in danger 13px.
- **Focus:** the global 3px cadmium outline, flush (offset 0) on inputs.
- **Stepper and price input:** inline groups with a shared border; values centred or right-aligned in tabular figures, native spinners removed.
- **Checkbox:** custom 22px square, 5px corner, filled accent with a white tick when checked.

### Navigation
- **Shell bar:** sticky indigo bar: lockup (print swatch + condensed name) that returns to the map, coin balance, XP, avatar ringed in yellow, sign-out. Under 560px only the lockup, balance and an icon sign-out remain.
- **Segmented tabs:** pill track in sheet-2, selected tab in accent with cloth lift. Used for Market Square (My shop / Real businesses) and the auth form (New here / Sign in).
- **Back:** a small default button labelled "Map" with a left arrow, set on the place cloth.

### Selvedge (signature)
A full-width strip in deep indigo with yellow 11px uppercase lettering at 0.16em, 5px 16px padding. It states the surface's one rule once; further repeats are `aria-hidden` and separated by yellow diamonds, clipped by the edge like a printed selvedge. Under 560px the repeats hide and the rule wraps.

**The One Selvedge Rule.** One rule per surface, on the cloth's edge. The map view, the browse page and the welcome cloth carry one each; inside a place, the place header's selvedge replaces the shell's. The rule is a true constraint of that surface (coins have no cash value; customers walk if the price is too high; jobs pay only when funded; standings count coins), never a slogan.

### Place Header
The place's print fills a cloth frame (min 132px tall, 14px corner, cloth lift) with a back button and a sheet plate carrying the place name and blurb; the place's selvedge runs along the bottom edge.

### Timed-State Bars
A 6px bar (3px corner) on a sheet-2 track whose indigo fill (yellow at night) shrinks linearly with the exact time left, captioned with a muted label on the left and a tabular countdown ("4:32 left", or "3h 05m left") on the right. Used for the customer waiting at the counter and the daily quest reset (Lagos midnight). Order progress uses a sibling three-stage strip of 6px bars: done in leaf green, now in yellow, todo in sheet-2.

**The Exact Time Rule.** Anything that expires is shown as a bar of the real remaining time plus the countdown in figures, never as a vague badge.

### Quest Bolts
Each quest is a plate on the ground (10px corner, 10px 12px padding) over a hidden strip of the print of the place it belongs to. Progress is an 8px leaf-green bar with `progressbar` semantics and a tabular "n / target" count. When the quest becomes claimable the cloth unrolls left-to-right behind the plate (clip-path over 0.9s on the out-expo curve), the plate lifts to sheet with cloth lift, and the Claim button turns yellow. Claimed quests show a green "Claimed" notice instead of the button.

### Tables and Inventory
Full-width rows divided by hairlines with 12px 16px cells; column heads in the label style; numeric columns right-aligned. The player's own leaderboard row is tinted with 18% cadmium yellow and set in 750. The takings band is sheet-2 with the figure style. Negative margins and zero stock turn danger.

### Map (Junction 101)
An 800×520 SVG inside a sheet frame (16px corner, 6px padding, cloth lift). Laterite ground, grass ellipses, two crossing roads with dashed cotton lanes, and a roundabout filled with the Market Square print. Each place is a building wearing its own print, a hotspot that is a real keyboard button (Enter/Space) with a descriptive label. Name plates are deep-indigo 10px-corner boards with white 750 text at 85% width; unvisited places carry a yellow star medallion. Hover or focus lifts the building 4px; focus also draws a 4px yellow ring. Decorative palms and a yellow danfo are `aria-hidden`.

### Toast
Indigo, 12px corner, white 650 text with a yellow coin icon, centred above the safe area, sliding up 12px over 0.4s; it announces with `role="status"` and clears after 2.6s.

### Motion
One curve, `cubic-bezier(0.16, 1, 0.3, 1)`, for everything that arrives or lifts (button press, building lift 0.25s, quest bar 0.5s, cloth unroll 0.9s, toast 0.4s). Time bars run linear over 1s so the shrink matches the clock. `prefers-reduced-motion` reduces every transition and animation to effectively instant.

### Accessibility conventions
- Focus is always a 3px cadmium-yellow outline offset 2px (flush on inputs).
- Touch targets are 44px for primary controls, at least 32–40px for chips, tabs and steppers.
- Icons are decorative (`aria-hidden`) next to text; icon-only controls carry `aria-label`.
- Errors are `role="alert"` with an icon; the toast is `role="status"`; countdowns are `aria-live="off"` so they do not chatter.
- The coin balance and the selvedge both say coins are game-only; the yellow demo tag marks mock merchants.

## Do's and Don'ts

### Do:
- **Do** give every new place its own authored wax-print tile in the cloth palette and use it on its header, its map building and its quests.
- **Do** put exactly one selvedge on each surface, stating one true rule of that surface.
- **Do** keep sections flat on the ground, divided by hairlines; raise only cloth and the plates set on it.
- **Do** show anything that expires as a timed-state bar with an exact tabular countdown.
- **Do** reserve cadmium yellow for coins, the "go" action and the focus ring; set real-money prices in plain ink.
- **Do** set every number in tabular figures, right-aligned in columns.
- **Do** use Archivo's width axis and weight for hierarchy instead of another typeface.

### Don't:
- **Don't** build white cards on grey with one green accent; this world's surfaces are cloth or hairline-divided ground.
- **Don't** add a second selvedge, or use the selvedge for marketing copy.
- **Don't** use madder red or leaf green as error and success colours; status uses the ok and danger tokens.
- **Don't** show a spinner or vague badge where a remaining time is known.
- **Don't** recolour an existing print to make a new place.
