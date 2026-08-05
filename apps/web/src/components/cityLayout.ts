// New Lagos layout, following docs/city-plan.md: Mainland in the north, the lagoon across the middle,
// Third Mainland Bridge down to the Island, the Atlantic in the south.
// Roads run on the 2:1 isometric axes (slope ±0.5) so they line up with the building art.

export const WORLD = { w: 9600, h: 7600 };
/** Junction 101, the start of the game. */
export const CX = 4800;
export const CY = 2400;
export const HALF = 60; // half width of a main road (two lanes), measured vertically
export const STREET_HALF = 24; // half width of a residential street

export interface Segment {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  bridge?: boolean;
  /** Raised road on pillars (crosses over another road); height in world units at its middle. */
  flyover?: number;
}

/** y on a segment's centre line for an x (segments are never vertical). */
export const yOn = (s: Segment, x: number) => s.y0 + ((x - s.x0) * (s.y1 - s.y0)) / (s.x1 - s.x0);
/** Island road: Marina Wharf → Island Heights → Lekki. */
const island = (x: number) => 4300 + 0.5 * (x - 3800);

export const ROADS: Segment[] = [
  // Road A: Danfo Terminal (NW) → Junction 101 → Tech Mile → bridge head
  { id: "a", x0: 1600, y0: CY + 0.5 * (1600 - CX), x1: 7200, y1: CY + 0.5 * (7200 - CX) },
  // Road B: Apapa Port (SW) → Owambe Gardens → Junction 101 → Airport Ridge (NE)
  { id: "b", x0: 1500, y0: CY - 0.5 * (1500 - CX), x1: 7600, y1: CY - 0.5 * (7600 - CX) },
  // Third Mainland Bridge: from the bridge head down-left across the lagoon to the Island
  { id: "bridge", x0: 4800, y0: island(4800), x1: 7200, y1: CY + 0.5 * (7200 - CX), bridge: true },
  // Island road
  { id: "island", x0: 3700, y0: island(3700), x1: 9600, y1: island(9600) },
  // Eko Bridge: from Road B near Apapa over the harbour channel to Marina Wharf (the Island's west end)
  { id: "eko", x0: 2400 + 64, y0: CY - 0.5 * (2400 - CX) + 32, x1: 3700, y1: island(3700), bridge: true },
  // Oshodi-style flyover at Danfo Terminal: over Road A, ramps down at both ends
  // (runs along the iso b axis at a = -1650, crossing Road A between b = -600 and +600)
  { id: "flyover", x0: CX - 1650 - 600, y0: CY - 825 + 300, x1: CX - 1650 + 600, y1: CY - 825 - 300, flyover: 70 },
];
export const ROAD_A = ROADS[0]!;
export const ROAD_B = ROADS[1]!;

/** Mainland shoreline, west to east. Everything south of it is water unless it is on the Island. */
const SHORE: [number, number][] = [
  [0, 4700],
  [1200, 4500],
  [2000, 4080],
  [2800, 3960],
  [3600, 3720],
  [4600, 3660],
  [5600, 3720],
  [6600, 3500],
  [7300, 3580],
  [8200, 3420],
  [9600, 3220],
];
const shoreY = (x: number) => {
  for (let i = 1; i < SHORE.length; i++) {
    const [ax, ay] = SHORE[i - 1]!;
    const [bx, by] = SHORE[i]!;
    if (x <= bx) return ay + ((x - ax) * (by - ay)) / (bx - ax);
  }
  return SHORE[SHORE.length - 1]![1];
};

/** Smooth path through points (Catmull-Rom as cubic Béziers). */
function smooth(points: [number, number][]) {
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const ISLAND_N = -450; // north shore, relative to the island road
const ISLAND_S = 600; // south shore (beach)
const TIP = 3500;

/** All water south of the mainland shore (lagoon, harbour and sea together). */
export const WATER_PATH = `${smooth(SHORE)} L${WORLD.w + 400} ${WORLD.h + 400} L-400 ${WORLD.h + 400} L-400 ${SHORE[0]![1]}Z`;
/** The open Atlantic: deeper blue beyond the Island's beach. */
export const OCEAN_PATH = `M-400 6500 C1400 6450 3000 6000 ${TIP + 900} ${island(TIP + 900) + ISLAND_S + 60} L${WORLD.w + 400} ${island(WORLD.w + 400) + ISLAND_S + 60} L${WORLD.w + 400} ${WORLD.h + 400} L-400 ${WORLD.h + 400}Z`;
/** The Island: Marina, Island Heights and Lekki on one long strip. */
export const ISLAND_PATH = `M${TIP} ${island(TIP) + 120} C${TIP - 20} ${island(TIP) - 260} ${TIP + 200} ${island(TIP + 300) + ISLAND_N} ${TIP + 400} ${island(TIP + 400) + ISLAND_N} L${WORLD.w + 400} ${island(WORLD.w + 400) + ISLAND_N} L${WORLD.w + 400} ${island(WORLD.w + 400) + ISLAND_S} L${TIP + 400} ${island(TIP + 400) + ISLAND_S} C${TIP + 100} ${island(TIP + 100) + ISLAND_S} ${TIP} ${island(TIP) + 380} ${TIP} ${island(TIP) + 120}Z`;
/** Beach: a pale strip along the Island's south shore. */
export const BEACH_PATH = `M${TIP + 400} ${island(TIP + 400) + ISLAND_S - 70} L${WORLD.w + 400} ${island(WORLD.w + 400) + ISLAND_S - 70} L${WORLD.w + 400} ${island(WORLD.w + 400) + ISLAND_S} L${TIP + 400} ${island(TIP + 400) + ISLAND_S}Z`;
export const SHORE_PATH = smooth(SHORE);

const onIsland = (x: number, y: number) => x > TIP + 250 && y > island(x) + ISLAND_N + 140 && y < island(x) + ISLAND_S - 90;
/** Dry land with room for a building (art is drawn up to ~210 units above its foot). */
export const onLand = (x: number, y: number) => y < shoreY(x) - 60 || onIsland(x, y);

// ── Walking ──
export type Landmass = "mainland" | "island" | "bridge";
const BRIDGES = ROADS.filter((r) => r.bridge);
/** Where a person can stand: mainland, the Island, or the bridge deck. Null means water or off the map. */
export function landmassAt(x: number, y: number): Landmass | null {
  if (x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return null;
  if (BRIDGES.some((b) => x >= b.x0 && x <= b.x1 && Math.abs(y - yOn(b, x)) < HALF + 14)) return "bridge";
  if (y < shoreY(x) - 12) return "mainland";
  if (x > TIP + 120 && y > island(x) + ISLAND_N + 40 && y < island(x) + ISLAND_S - 10) return "island";
  return null;
}
/** Bridge ends, just onto dry land on each side. */
/** Each bridge's mainland and Island ends, just onto dry land. */
const CROSSINGS = BRIDGES.map((b) => {
  const lo = { x: b.x0 + 40, y: yOn(b, b.x0 + 40) };
  const hi = { x: b.x1 - 40, y: yOn(b, b.x1 - 40) };
  // The end with the larger y is further south, on the Island side.
  return lo.y > hi.y ? { island: lo, main: hi } : { island: hi, main: lo };
});
const JUNCTION = { x: CX, y: CY + 110 };

const clearLine = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 60);
  for (let i = 1; i < n; i++) if (!landmassAt(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)) return false;
  return true;
};

/**
 * Waypoints from one point to another, staying on land: straight when the way is clear, through
 * Junction 101 when a straight line would cross water, and over Third Mainland Bridge between
 * the mainland and the Island. Returns null when the destination is water.
 */
export function walkRoute(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] | null {
  const end = landmassAt(to.x, to.y);
  if (!end) return null;
  const start = landmassAt(from.x, from.y) ?? "mainland";
  // Around Junction 101, walk the pavements and cross at the zebras, like everyone else.
  if (start === "mainland" && end === "mainland") {
    const onFoot = footpathRoute(from, to);
    if (onFoot) return onFoot;
  }
  const leg = (a: { x: number; y: number }, b: { x: number; y: number }) => (clearLine(a, b) ? [b] : [JUNCTION, b]);
  const side = (m: Landmass) => (m === "bridge" ? "bridge" : m);
  if (side(start) === side(end) || start === "bridge" || end === "bridge") return leg(from, to);
  // Take whichever bridge makes the shorter trip.
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const c = CROSSINGS.reduce((best, k) =>
    start === "mainland"
      ? d(from, k.main) + d(k.island, to) < d(from, best.main) + d(best.island, to) ? k : best
      : d(from, k.island) + d(k.main, to) < d(from, best.island) + d(best.main, to) ? k : best,
  );
  return start === "mainland" ? [...leg(from, c.main), c.island, to] : [c.island, c.main, ...leg(c.main, to)];
}

/** World point from isometric road coordinates: a runs along Road A (down-right), b along Road B (up-right). */
export const iso = (a: number, b: number) => ({ x: CX + a + b, y: CY + 0.5 * a - 0.5 * b });
/** Isometric road coordinates of a world point (inverse of `iso`). */
export const toIso = (x: number, y: number) => ({ a: (x - CX) / 2 + (y - CY), b: (x - CX) / 2 - (y - CY) });

/** Zebra crossings at Junction 101 sit this far out along each arm. */
const ZEBRA_AT = 210;
/** How far out the junction's footpaths run along each arm (with a zebra at the end). */
const WALK_FAR = 1500;
/** Width of the pavement (walkway) on each side of a main road. */
export const PAVEMENT = 34;
export const STREET_PAVEMENT = 16;

// ── Streets ──
/**
 * Residential streets: a block grid in each quarter around Junction 101. Each quarter gets one street
 * parallel to Road A (starting at Road B) and one parallel to Road B (starting at Road A); they cross.
 */
const QUARTERS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const STREET_AT = 850;
const STREET_LEN = 1350;
export const STREETS: Segment[] = QUARTERS.flatMap(([sa, sb]) => {
  const seg = (id: string, p: { x: number; y: number }, q: { x: number; y: number }): Segment =>
    p.x < q.x ? { id, x0: p.x, y0: p.y, x1: q.x, y1: q.y } : { id, x0: q.x, y0: q.y, x1: p.x, y1: p.y };
  return [
    // Streets start at the main road's kerb (vertical distance from the road = the iso coordinate).
    seg(`s1${sa}${sb}`, iso(sa * (HALF - 4), sb * STREET_AT), iso(sa * STREET_LEN, sb * STREET_AT)),
    seg(`s2${sa}${sb}`, iso(sa * STREET_AT, sb * (HALF - 4)), iso(sa * STREET_AT, sb * (STREET_LEN + 0))),
  ];
});

// ── Billboards ──
/** Billboard spots: on the north kerb of a road, at an x along it. Keys match the `billboards` table. */
const BOARD_AT: { key: string; road: string; x: number }[] = [
  { key: "junction-101", road: "a", x: CX - 400 },
  { key: "third-mainland", road: "bridge", x: 6500 },
  { key: "danfo-terminal", road: "a", x: CX - 1450 },
  { key: "tech-mile", road: "a", x: CX + 1250 },
  { key: "owambe-gardens", road: "b", x: CX - 1250 },
  { key: "airport-ridge", road: "b", x: CX + 1250 },
  { key: "island-heights", road: "island", x: 5650 },
  { key: "lekki-gardens", road: "island", x: 7450 },
];
// Both legs stand behind the pavement: roads run diagonally, so check the road under each leg.
const LEG = 125;
export const BILLBOARD_SPOTS = BOARD_AT.map((b) => {
  const seg = ROADS.find((r) => r.id === b.road)!;
  const roadTop = Math.min(yOn(seg, b.x - LEG), yOn(seg, b.x + LEG)) - HALF - PAVEMENT;
  return { key: b.key, x: b.x, y: roadTop - 48 };
});

// ── Sites: where things may stand ──
/**
 * Building art is drawn `BASE * scale` wide with its foot point at the bottom of the plot. The plot is a 2:1
 * diamond as wide as the art, so in iso coordinates it is a square of half-side `hh` around its centre.
 */
export const BASE = 240;
export const siteOf = (scale = 1) => ({ hh: (BASE * scale) / 4, lift: (BASE * scale) / 6 });

/** A taken square of ground, in iso coordinates. */
type Patch = { a: number; b: number; hh: number };
const patchAt = (cx: number, cy: number, hh: number): Patch => ({ ...toIso(cx, cy), hh });
const overlaps = (p: Patch, q: Patch, gap: number) => Math.abs(p.a - q.a) < p.hh + q.hh + gap && Math.abs(p.b - q.b) < p.hh + q.hh + gap;

/** True when a square of ground (centre cx, cy; half-side hh) keeps off every road, kerb, pavement and street. */
export function groundClear(cx: number, cy: number, hh: number) {
  const roads = ROADS.every((s) => {
    if (cx + 2 * hh < Math.min(s.x0, s.x1) - 40 || cx - 2 * hh > Math.max(s.x0, s.x1) + 40) return true;
    return Math.abs(cy - yOn(s, cx)) >= hh + HALF + PAVEMENT + 8;
  });
  const streets = STREETS.every((s) => {
    if (cx + 2 * hh < s.x0 - 60 || cx - 2 * hh > s.x1 + 60) return true;
    return Math.abs(cy - yOn(s, cx)) >= hh + STREET_HALF + STREET_PAVEMENT + 6;
  });
  // The roundabout, and the billboards' legs and boards
  const roundabout = ((cx - CX) / (150 + 2 * hh + 40)) ** 2 + ((cy - CY) / (75 + hh + 20)) ** 2 > 1;
  const boards = BILLBOARD_SPOTS.every((s) => Math.abs(cx - s.x) > LEG + 30 + 2 * hh || Math.abs(cy - s.y) > hh + 50);
  return roads && streets && roundabout && boards;
}

/** Everything placed so far; each new thing must not overlap it. */
const TAKEN: Patch[] = [];
function claim(cx: number, cy: number, hh: number, gap = 18) {
  const p = patchAt(cx, cy, hh);
  if (!groundClear(cx, cy, hh) || TAKEN.some((q) => overlaps(p, q, gap))) return false;
  TAKEN.push(p);
  return true;
}
/** Foot point (where the art's bottom sits) of a building whose plot is centred on iso (a, b). */
const footAt = (a: number, b: number, scale = 1) => {
  const c = iso(a, b);
  return { x: c.x, y: c.y + siteOf(scale).lift };
};
/** Plot centre of a building drawn with its foot at (x, y). */
const plotCentre = (x: number, y: number, scale = 1) => ({ x, y: y - siteOf(scale).lift });

// ── Junction 101 ──
/** The three Junction 101 places and the park: one per quarter, set back from the pavements. */
const PLACE_AT = [
  { id: "work_hub", label: "Work Hub", art: "/art/work-hub.webp", a: -175, b: 175, w: 200, h: 196 },
  { id: "hangout", label: "The Hangout", art: "/art/hangout.webp", a: 182, b: 182, w: 220, h: 170 },
  { id: "market_square", label: "Market Square", art: "/art/market-square.webp", a: 188, b: -188, w: 248, h: 176 },
] as const;
/** Image box (top-left, size) for each place, in world units. */
export const PLACES = PLACE_AT.map((p) => {
  const c = iso(p.a, p.b);
  claim(c.x, c.y, p.w / 4);
  return { id: p.id, label: p.label, art: p.art, x: c.x - p.w / 2, y: c.y + p.w / 4 - p.h, w: p.w, h: p.h };
});
export const PARK = (() => {
  const c = iso(-182, -182);
  claim(c.x, c.y, 55);
  return { x: c.x - 115, y: c.y + 55 - 200, w: 230, h: 200 };
})();

/** Enterable venues (see @hc/shared venues.ts): Junction 101's sit inside the blocks; district ones front their road. */
const VENUE_AT: { key: string; a?: number; b?: number; district?: string; scale?: number }[] = [
  { key: "mama_nkechi_buka", a: 445, b: 470 },
  { key: "sharp_cuts", a: -470, b: -445 },
  { key: "junction_motor_park", a: -720, b: 470 },
  { key: "royal_event_centre", district: "Owambe Gardens", scale: 1.15 },
  { key: "tailors_row", district: "Owambe Gardens" },
  { key: "viewing_centre", district: "Owambe Gardens" },
  { key: "mallam_suya", district: "Owambe Gardens" },
];

/**
 * Plots around the junction: players' shops fill them (yours first); the rest show as open plots.
 * Each point is the plot's centre; plots are 260 wide.
 */
const PLOT_HH = 65;
const PLOT_AT: [number, number][] = [
  [470, -195],
  [-430, 470],
  [470, 200],
  [-460, -190],
  [195, -470],
  [-180, 455],
  [185, 465],
  [-195, -470],
  [480, -480],
  [-700, -700],
];
export const PLOTS = PLOT_AT.map(([a, b]) => {
  const c = iso(a, b);
  claim(c.x, c.y, PLOT_HH, 10);
  return c;
});

// ── Districts ──
export type Phase = 1 | 2 | 3 | 4;
export interface District {
  name: string;
  x: number;
  y: number;
  phase: Phase;
  /** Art names in public/art/buildings, most important first (gets the spot nearest the centre). */
  buildings: string[];
  /** A landmark strip (the beach): a name on the ground, no district plate. */
  landmark?: boolean;
  /** Open now: what players can do there (shown instead of "Opens later"). */
  open?: string;
  /** The road its buildings front: along Road A / the Island road (iso a) or Road B (iso b). */
  front?: { axis: "a" | "b"; at: number; base: number; from: number; to: number };
}

/** Drawn a little bigger than the 240-wide default. */
const BIG: Record<string, number> = {
  // Island Heights and Lekki: high life is big
  "office-tower": 1.5,
  "residential-tower": 1.45,
  hotel: 1.5,
  mall: 1.45,
  "bank-eko-trust": 1.25,
  "bank-lagoon-capital": 1.3,
  "bank-crown-savings": 1.25,
  "skyline-lounge": 1.15,
  "car-showroom": 1.15,
  gym: 1.1,
  "restaurant-terrace": 1.1,
  "crazy-house": 1.45,
  villa: 1.3,
  "terrace-duplex": 1.15,
  "estate-gate": 1.1,
  // Big sheds and halls
  "airport-terminal": 1.5,
  "bus-terminal": 1.35,
  "market-hall": 1.25,
  "container-port": 1.2,
  "colonial-block": 1.1,
  "event-centre": 1.15,
  // Small things
  atm: 0.75,
  "kiosk-container": 0.7,
  "control-tower": 0.95,
};

/** The Island road is the iso line b = -2400 (it runs parallel to Road A). */
const ISLAND_B = -2400;

/** Districts beyond Junction 101, named for the game world, opening in later stages. */
export const DISTRICTS: District[] = [
  {
    name: "Tech Mile",
    ...iso(1600, 0),
    phase: 1,
    buildings: ["tech-hub", "phone-shop", "laptop-shop", "cyber-cafe", "polytechnic-gate", "chemist", "shop-house", "commercial-block", "gadget-kiosk", "mixed-use-block"],
    front: { axis: "a", at: 1600, base: 0, from: 980, to: 2200 },
  },
  {
    name: "Owambe Gardens",
    ...iso(0, -1600),
    phase: 1,
    open: "ARTISANS · OPEN NOW",
    buildings: ["shop-house", "bungalow", "residential-block", "chemist"],
    front: { axis: "b", at: -1600, base: 0, from: -980, to: -2250 },
  },
  {
    name: "Danfo Terminal",
    ...iso(-1800, 0),
    phase: 2,
    buildings: ["bus-terminal", "face-me-block", "shop-house", "buka", "mixed-use-block", "suya-stand", "bungalow"],
    front: { axis: "a", at: -1800, base: 0, from: -980, to: -2600 },
  },
  {
    name: "Apapa Port",
    ...iso(0, -3000),
    phase: 2,
    buildings: ["container-port", "warehouse", "warehouse", "commercial-block"],
    front: { axis: "b", at: -3000, base: 0, from: -2550, to: -3300 },
  },
  {
    name: "Airport Ridge",
    ...iso(0, 1600),
    phase: 4,
    buildings: ["airport-terminal", "control-tower", "warehouse", "commercial-block", "mixed-use-block"],
    front: { axis: "b", at: 1600, base: 0, from: 980, to: 2600 },
  },
  {
    name: "Marina Wharf",
    x: 4300,
    y: island(4300),
    phase: 3,
    buildings: ["colonial-block", "market-hall", "bank-eko-trust", "colonial-block", "shop-house", "commercial-block"],
    front: { axis: "a", at: 1900, base: ISLAND_B, from: 1400, to: 2250 },
  },
  {
    name: "Island Heights",
    x: 6100,
    y: island(6100),
    phase: 3,
    buildings: [
      "office-tower",
      "bank-lagoon-capital",
      "hotel",
      "residential-tower",
      "bank-crown-savings",
      "mall",
      "office-tower",
      "atm",
      "skyline-lounge",
      "car-showroom",
      "gym",
      "restaurant-terrace",
      "residential-tower",
      "bank-eko-trust",
    ],
    front: { axis: "a", at: 3700, base: ISLAND_B, from: 2600, to: 4700 },
  },
  {
    name: "Lekki Gardens",
    x: 7900,
    y: island(7900),
    phase: 4,
    buildings: ["estate-gate", "crazy-house", "villa", "terrace-duplex", "villa", "terrace-duplex", "restaurant-terrace", "residential-tower"],
    front: { axis: "a", at: 5500, base: ISLAND_B, from: 4850, to: 6700 },
  },
  { name: "Atlantic Beach", x: 7000, y: island(7000) + ISLAND_S - 160, phase: 4, buildings: [], landmark: true },
];

const onSite = (cx: number, cy: number, hh: number) => onLand(cx, cy + hh) && onLand(cx, cy - hh) && onLand(cx - 2 * hh, cy) && onLand(cx + 2 * hh, cy);

/** Frontage spots for a district: rows either side of its road, nearest the centre first. */
function frontage(d: District) {
  const f = d.front!;
  const spots: { a: number; b: number; rank: number }[] = [];
  for (let along = f.from; f.from < f.to ? along <= f.to : along >= f.to; along += f.from < f.to ? 160 : -160)
    for (const [row, off] of [
      [0, 205],
      [0, -205],
      [1, 530],
      [1, -530],
      [2, 850],
      [2, -850],
    ] as const) {
      const [a, b] = f.axis === "a" ? [along, f.base + off] : [f.base + off, along];
      spots.push({ a, b, rank: row * 10000 + Math.abs(along - f.at) });
    }
  return spots.sort((p, q) => p.rank - q.rank);
}

export interface Building {
  art: string;
  x: number;
  y: number;
  key: string;
  scale: number;
}
/** Takes the first free frontage spot for each art in turn. */
function settle(d: District, arts: string[], tag: string) {
  const out: (Building & { name: string })[] = [];
  const spots = frontage(d);
  for (const [i, name] of arts.entries()) {
    const scale = BIG[name] ?? 1;
    const hh = siteOf(scale).hh;
    const spot = spots.find((s) => {
      const c = iso(s.a, s.b);
      return onSite(c.x, c.y, hh) && claim(c.x, c.y, hh);
    });
    if (!spot) continue;
    spots.splice(spots.indexOf(spot), 1);
    out.push({ name, art: `/art/buildings/${name}.webp`, ...footAt(spot.a, spot.b, scale), scale, key: `${tag}-${i}` });
  }
  return out;
}

const VENUE_ART: Record<string, string> = {
  royal_event_centre: "event-centre",
  tailors_row: "tailor-shop",
  viewing_centre: "viewing-centre",
  mallam_suya: "suya-stand",
};
export const VENUE_SPOTS = VENUE_AT.map((v) => {
  if (v.a !== undefined && v.b !== undefined) {
    const c = iso(v.a, v.b);
    claim(c.x, c.y, siteOf(v.scale).hh);
    return { key: v.key, ...footAt(v.a, v.b, v.scale), scale: v.scale ?? 1 };
  }
  const d = DISTRICTS.find((dd) => dd.name === v.district)!;
  const [b] = settle(d, [VENUE_ART[v.key] ?? "bungalow"], `venue-${v.key}`);
  return { key: v.key, x: b!.x, y: b!.y, scale: b!.scale };
});

/** The ferry jetty sits on Marina's lagoon shore, half over the water. */
const JETTY: Building = (() => {
  const x = 4250;
  const y = island(x) + ISLAND_N + 150;
  TAKEN.push(patchAt(x, y - siteOf().lift, siteOf().hh));
  return { art: "/art/buildings/ferry-jetty.webp", x, y, key: "jetty", scale: 1 };
})();

const DISTRICT_SCENERY = DISTRICTS.filter((d) => d.front).flatMap((d) => settle(d, d.buildings, d.name));

// ── Neighbourhood streets ──
const HOUSE_ART = ["bungalow", "residential-block", "face-me-block", "shop-house", "bungalow", "mixed-use-block"];

/** Houses on both sides of every street, each with a driveway to the street; trees between them. */
const STREET_LOTS = (() => {
  const houses: Building[] = [];
  const driveways: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const trees: { x: number; y: number; kind: "leafy" | "palm"; key: string }[] = [];
  let n = 0;
  for (const [sa, sb] of QUARTERS) {
    for (const which of [1, 2] as const) {
      for (let t = 280; t <= STREET_LEN - 120; t += 330) {
        for (const side of [1, -1] as const) {
          const off = side * 210;
          const along = (tt: number, o: number) => (which === 1 ? iso(sa * tt, sb * STREET_AT + o) : iso(sa * STREET_AT + o, sb * tt));
          const centre = which === 1 ? { a: sa * t, b: sb * STREET_AT + off } : { a: sa * STREET_AT + off, b: sb * t };
          const c = iso(centre.a, centre.b);
          if (!onLand(c.x, c.y + 60) || !claim(c.x, c.y, 60)) continue;
          houses.push({ art: `/art/buildings/${HOUSE_ART[n % HOUSE_ART.length]}.webp`, ...footAt(centre.a, centre.b), key: `house-${n}`, scale: 1 });
          // Houses above the street on screen get a driveway from their door; houses below it have the
          // driveway beside them, so the building doesn't hide it.
          const farSide = (which === 1 ? off : -off) > 0;
          const dt = farSide ? 0 : 135;
          const from = along(t + dt, off);
          const to = along(t + dt, side * STREET_HALF);
          driveways.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y });
          const tree = along(t + 165, side * 250);
          if (onLand(tree.x, tree.y) && claim(tree.x, tree.y, 16, 6)) trees.push({ ...tree, kind: n % 3 === 0 ? "palm" : "leafy", key: `tree-${n}` });
          n++;
        }
      }
    }
  }
  return { houses, driveways, trees };
})();
export const DRIVEWAYS = STREET_LOTS.driveways;

// ── Street furniture ──
export interface Prop {
  art: string;
  x: number;
  y: number;
  key: string;
  /** Drawn width in world units. */
  w: number;
  /** On the far (north) side of its road: drawn under the traffic and walkers that pass in front of it. */
  behind: boolean;
}
/** Back edge of the pavement, where poles, lamps, stalls and shelters stand (vertical distance from the centre). */
const BACK = HALF + PAVEMENT - 4;
const PROP_W: Record<string, number> = {
  "street-lamp": 46,
  "power-pole": 52,
  "bus-stop": 120,
  "trader-snacks": 92,
  "trader-phones": 92,
  "trader-fruit": 92,
  "kiosk-container": 110,
  "suya-grill": 110,
};
/** Junction 101's arms have zebras and street mouths; poles and lamps keep clear of them. */
const atCrossing = (road: Segment, x: number) => {
  if (road.id !== "a" && road.id !== "b") return false;
  const d = Math.abs(x - CX);
  return d < ZEBRA_AT + 80 || Math.abs(d - STREET_AT) < 120 || Math.abs(d - WALK_FAR) < 90;
};
/** A prop on a road side: `side` 1 = north (behind the traffic), -1 = south. Stalls and shelters stand just off the pavement. */
function roadProp(road: Segment, x: number, side: 1 | -1, kind: string, key: string): Prop | null {
  const w = PROP_W[kind] ?? 80;
  const pole = kind === "street-lamp" || kind === "power-pole";
  const hh = pole ? 6 : w / 4;
  // Poles stand on the back edge of the pavement; stalls and shelters stand on the ground behind it.
  const off = pole ? BACK : HALF + PAVEMENT + hh + 12;
  const y = yOn(road, x) - side * off;
  if (!onLand(x, y + hh) || (pole && atCrossing(road, x))) return null;
  if (!pole && !claim(x, y, hh, 6)) return null;
  return { art: `/art/props/${kind}.webp`, x, y: pole ? y : y + hh, key, w, behind: side > 0 };
}

/** Stalls, kiosks, bus shelters and power poles along the roads near Junction 101 and in the districts. */
export const PROPS: Prop[] = (() => {
  const out: (Prop | null)[] = [];
  const A = ROADS.find((r) => r.id === "a")!;
  const B = ROADS.find((r) => r.id === "b")!;
  const ISL = ROADS.find((r) => r.id === "island")!;
  // Each pavement side of each arm (and the Island road) takes its stalls, kiosk and bus shelter at the first
  // free gaps, walking out from the junction.
  const scan = (road: Segment, from: number, to: number, side: 1 | -1, kinds: string[], tag: string) => {
    let last = -Infinity;
    let k = 0;
    const step = from < to ? 30 : -30;
    for (let x = from; k < kinds.length && (step > 0 ? x <= to : x >= to); x += step) {
      if (Math.abs(x - last) < 200) continue;
      const p = roadProp(road, x, side, kinds[k]!, `${tag}-${k}`);
      if (p) {
        out.push(p);
        last = x;
        k++;
      }
    }
  };
  const traders = ["trader-snacks", "trader-fruit", "trader-phones"];
  let n = 0;
  for (const road of [A, B])
    for (const dir of [1, -1] as const)
      for (const side of [1, -1] as const) {
        const kinds = [traders[n % 3]!, traders[(n + 1) % 3]!, n % 2 ? "kiosk-container" : "bus-stop"];
        scan(road, CX + dir * 260, CX + dir * 1600, side, kinds, `arm-${road.id}-${dir}-${side}`);
        n++;
      }
  scan(ISL, 4700, 7600, 1, ["bus-stop", "trader-fruit", "kiosk-container"], "isl-n");
  scan(ISL, 5300, 7600, -1, ["trader-snacks", "bus-stop"], "isl-s");
  // Power poles along the mainland roads (south side, every 520)
  for (const road of [A, B])
    for (let x = Math.min(road.x0, road.x1) + 300; x < Math.max(road.x0, road.x1) - 200; x += 520) {
      if (Math.abs(x - CX) < 260) continue;
      out.push(roadProp(road, x, -1, "power-pole", `pole-${road.id}-${x}`));
    }
  // Suya smoke in Owambe Gardens and on the beach
  out.push(roadProp(B, CX - 2050, -1, "suya-grill", "suya-owambe"));
  return out.filter((p): p is Prop => !!p);
})();

/** Street lamps along every road, alternating sides, on the back edge of the pavement; none on the roundabout. */
export const LAMPS = ROADS.filter((r) => !r.flyover).flatMap((s) => {
  const out: { x: number; y: number; key: string; behind: boolean }[] = [];
  const [lo, hi] = [Math.min(s.x0, s.x1), Math.max(s.x0, s.x1)];
  let i = 0;
  for (let x = lo + 120; x < hi - 60; x += s.bridge ? 200 : 250) {
    if (Math.hypot(x - CX, yOn(s, x) - CY) < 300 || atCrossing(s, x)) continue;
    const north = i++ % 2 === 1;
    // On bridges the lamps stand on the parapet.
    const off = s.bridge ? HALF + 10 : BACK;
    out.push({ x, y: yOn(s, x) + (north ? -off : off), key: `${s.id}-${x}`, behind: north });
  }
  return out;
});

/** Palms along the Island road (Lekki feel) and trees around the districts. */
const EXTRA_TREES = [
  ...Array.from({ length: 22 }, (_, i) => 3900 + i * 260).flatMap((x, i) => {
    const y = island(x) + (i % 2 ? 150 : -150);
    return onIsland(x, y) && claim(x, y, 16, 6) ? [{ x, y, kind: "palm" as const, key: `isle-${i}` }] : [];
  }),
  ...DISTRICTS.flatMap((d, i) =>
    [
      { x: d.x - 520, y: d.y - 260 },
      { x: d.x + 520, y: d.y + 280 },
      { x: d.x + 140, y: d.y - 420 },
    ]
      .filter((p) => onLand(p.x, p.y) && claim(p.x, p.y, 16, 6))
      .map((p, j) => ({ ...p, kind: (i + j) % 2 ? ("palm" as const) : ("leafy" as const), key: `dt-${i}-${j}` })),
  ),
];
export const TREES = [...STREET_LOTS.trees, ...EXTRA_TREES].sort((a, b) => a.y - b.y);

export const ALL_SCENERY: Building[] = [...DISTRICT_SCENERY, JETTY, ...STREET_LOTS.houses].sort((a, b) => a.y - b.y);

/** Every placed building and plot, for the layout check (scripts/check-clearance.ts). */
export const PLACED = { scenery: ALL_SCENERY, venues: VENUE_SPOTS, plots: PLOTS, plotHalf: PLOT_HH, props: PROPS, trees: TREES, plotCentre };

// ── Footpaths ──
/** Walkers keep to the middle of the pavement: this far (vertically) from a road's centre line. */
export const KERB = HALF + PAVEMENT / 2;
const STREET_KERB = STREET_HALF + STREET_PAVEMENT / 2;
export interface Zebra {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Stripe length (the band's width along the road). */
  w: number;
}

/**
 * The footpath network around Junction 101: both pavements of each arm, round the corners, across the
 * zebras, and up and down both pavements of every side street. Nodes are world points; edges join them.
 */
export const FOOTPATHS = (() => {
  const nodes: { x: number; y: number }[] = [];
  const index = new Map<string, number>();
  const edges: [number, number][] = [];
  const zebras: Zebra[] = [];
  const node = (a: number, b: number) => {
    const k = `${Math.round(a)},${Math.round(b)}`;
    if (!index.has(k)) {
      index.set(k, nodes.length);
      nodes.push(iso(a, b));
    }
    return index.get(k)!;
  };
  const chain = (pts: [number, number][]) => {
    for (let i = 1; i < pts.length; i++) edges.push([node(...pts[i - 1]!), node(...pts[i]!)]);
  };
  // A zebra across a road or street, from kerb to kerb, along the iso axis `along` at `pos`.
  const zebra = (along: "a" | "b", pos: number, fromOther: number, toOther: number, w: number) => {
    const [p, q] = along === "a" ? [iso(pos, fromOther), iso(pos, toOther)] : [iso(fromOther, pos), iso(toOther, pos)];
    zebras.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y, w });
  };
  const S = STREET_AT;
  const SK = STREET_KERB;
  for (const s of [1, -1] as const) {
    for (const side of [1, -1] as const) {
      // Main road pavements, stopping either side of each street mouth
      const stops = [ZEBRA_AT, S - SK, S + SK, WALK_FAR].map((t) => s * t);
      chain(stops.map((t) => [t, side * KERB]));
      chain(stops.map((t) => [side * KERB, t]));
    }
    // Zebras at the junction (Road A at a = ±ZEBRA_AT, Road B at b = ±ZEBRA_AT) and at the far ends
    for (const at of [ZEBRA_AT, WALK_FAR]) {
      chain([
        [s * at, -KERB],
        [s * at, KERB],
      ]);
      chain([
        [-KERB, s * at],
        [KERB, s * at],
      ]);
      zebra("a", s * at, -HALF, HALF, 30);
      zebra("b", s * at, -HALF, HALF, 30);
    }
  }
  // Round each corner of the junction, on the pavement
  const C = 92;
  for (const [sa, sb] of QUARTERS)
    chain([
      [sa * ZEBRA_AT, sb * KERB],
      [sa * C, sb * KERB],
      [sa * KERB, sb * C],
      [sa * KERB, sb * ZEBRA_AT],
    ]);
  // Side streets: both pavements, crossing at each street mouth and where the quarter's two streets cross
  for (const [sa, sb] of QUARTERS) {
    for (const o of [-SK, SK]) {
      // s2: runs along b at a = sa*S; its pavements at a = sa*(S±SK)
      chain(([KERB, S - SK, S + SK, STREET_LEN - 20] as const).map((t) => [sa * (S + o), sb * t]));
      // s1: runs along a at b = sb*S
      chain(([KERB, S - SK, S + SK, STREET_LEN - 20] as const).map((t) => [sa * t, sb * (S + o)]));
    }
    // Across each street at its far end (round the turning circle)
    chain([
      [sa * (S - SK), sb * (STREET_LEN - 20)],
      [sa * (S + SK), sb * (STREET_LEN - 20)],
    ]);
    chain([
      [sa * (STREET_LEN - 20), sb * (S - SK)],
      [sa * (STREET_LEN - 20), sb * (S + SK)],
    ]);
    // Zebras: across each street mouth (on the main pavement line) and on all four sides of the street crossing
    zebra("b", sb * KERB, sa * (S - STREET_HALF), sa * (S + STREET_HALF), 16);
    zebra("a", sa * KERB, sb * (S - STREET_HALF), sb * (S + STREET_HALF), 16);
    for (const o of [-SK, SK]) {
      zebra("a", sa * (S + o), sb * (S - STREET_HALF), sb * (S + STREET_HALF), 14);
      zebra("b", sb * (S + o), sa * (S - STREET_HALF), sa * (S + STREET_HALF), 14);
    }
  }
  const links: number[][] = nodes.map(() => []);
  for (const [p, q] of edges) {
    if (!links[p]!.includes(q)) links[p]!.push(q);
    if (!links[q]!.includes(p)) links[q]!.push(p);
  }
  return { nodes, links, zebras };
})();
export const ZEBRAS = FOOTPATHS.zebras;

/** Nearest point on the footpath network to (x, y), as the edge it lies on and the point itself. */
function nearestOnFootpaths(x: number, y: number) {
  const { nodes, links } = FOOTPATHS;
  let best = { d: Infinity, p: 0, q: 0, x: 0, y: 0 };
  for (const [p, qs] of links.entries())
    for (const q of qs) {
      if (q < p) continue;
      const A = nodes[p]!;
      const B = nodes[q]!;
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const t = Math.max(0, Math.min(1, ((x - A.x) * dx + (y - A.y) * dy) / (dx * dx + dy * dy || 1)));
      const px = A.x + dx * t;
      const py = A.y + dy * t;
      const d = Math.hypot(px - x, (py - y) * 1.6);
      if (d < best.d) best = { d, p, q, x: px, y: py };
    }
  return best;
}

/** Shortest way along the footpaths between two points near them (Dijkstra over the small network). */
export function footpathRoute(from: { x: number; y: number }, to: { x: number; y: number }, reach = 420) {
  const s = nearestOnFootpaths(from.x, from.y);
  const e = nearestOnFootpaths(to.x, to.y);
  if (s.d > reach || e.d > reach) return null;
  const { nodes, links } = FOOTPATHS;
  const len = (i: number, p: { x: number; y: number }) => Math.hypot(nodes[i]!.x - p.x, nodes[i]!.y - p.y);
  const dist = new Map<number, number>([
    [s.p, len(s.p, s)],
    [s.q, len(s.q, s)],
  ]);
  const prev = new Map<number, number>();
  const done = new Set<number>();
  for (;;) {
    let cur = -1;
    let cd = Infinity;
    for (const [i, d] of dist) if (!done.has(i) && d < cd) [cur, cd] = [i, d];
    if (cur < 0) break;
    done.add(cur);
    for (const nb of links[cur]!) {
      const nd = cd + len(nb, nodes[cur]!);
      if (nd < (dist.get(nb) ?? Infinity)) {
        dist.set(nb, nd);
        prev.set(nb, cur);
      }
    }
  }
  // Finish at whichever end of the target edge gives the shorter trip (or walk straight along a shared edge).
  const sameEdge = (s.p === e.p && s.q === e.q) || (s.p === e.q && s.q === e.p);
  if (sameEdge) return [{ x: e.x, y: e.y }, to];
  const via = [e.p, e.q].reduce((b, i) => ((dist.get(i) ?? Infinity) + len(i, e) < (dist.get(b) ?? Infinity) + len(b, e) ? i : b));
  const path: number[] = [];
  for (let i: number | undefined = via; i !== undefined; i = prev.get(i)) path.unshift(i);
  return [{ x: s.x, y: s.y }, ...path.map((i) => nodes[i]!), { x: e.x, y: e.y }, to];
}

/** Bridge pillars: evenly spaced along the deck where it crosses water. */
export const PILLARS = BRIDGES.flatMap((b) => {
  const out: { x: number; y: number; key: string }[] = [];
  for (let x = b.x0 + 120; x < b.x1 - 60; x += 160) {
    const y = yOn(b, x);
    if (!onLand(x, y + 40)) out.push({ x, y, key: `${b.id}-${x}` });
  }
  return out;
});

/** Height of a flyover deck along its length: ramps up over the first and last quarter, flat on top. */
export const flyHeight = (s: Segment, x: number) => {
  if (!s.flyover) return 0;
  const t = (x - s.x0) / (s.x1 - s.x0);
  const ramp = Math.min(1, Math.min(t, 1 - t) / 0.25);
  return s.flyover * Math.max(0, ramp);
};

/** Road ends inside the world get a rounded turning end instead of stopping dead. */
export const ROAD_ENDS = ROADS.filter((r) => !r.bridge && !r.flyover).flatMap((r) =>
  [
    { x: r.x0, y: r.y0 },
    { x: r.x1, y: r.y1 },
  ].filter((p) => p.x > 60 && p.x < WORLD.w - 60 && p.y > 60 && p.y < WORLD.h - 60 && !ROADS.some((o) => o !== r && !o.flyover && Math.hypot(o.x0 - p.x, o.y0 - p.y) < 90 || o !== r && !o.flyover && Math.hypot(o.x1 - p.x, o.y1 - p.y) < 90)),
);

/** Polygon for a road's asphalt band. */
export const bandPath = (s: Segment, half = HALF) =>
  `M${s.x0} ${s.y0 - half} L${s.x1} ${s.y1 - half} L${s.x1} ${s.y1 + half} L${s.x0} ${s.y0 + half}Z`;
export const kerbPath = (s: Segment, off: number) => `M${s.x0} ${s.y0 + off} L${s.x1} ${s.y1 + off}`;
export const centrePath = (s: Segment) => `M${s.x0} ${s.y0} L${s.x1} ${s.y1}`;

/** Street ends away from the main roads: small turning circles. */
export const STREET_ENDS = STREETS.map((st) => {
  const far = [
    { x: st.x0, y: st.y0 },
    { x: st.x1, y: st.y1 },
  ].sort((a, b) => Math.hypot(b.x - CX, b.y - CY) - Math.hypot(a.x - CX, a.y - CY))[0]!;
  return { ...far, key: st.id };
});

// ── Road drawing paths ──
// Roads are drawn as stroked centre lines, layer by layer (pavement, kerb, asphalt), so every junction and
// every turn merges cleanly. Turns between straight runs are smooth curves.
/** Stroke width that gives a vertical half-width `h` on our 2:1 isometric diagonals. */
export const strokeFor = (h: number) => 2 * h * Math.cos(Math.atan(0.5));

const P = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
/** Point `r` world-x units back from a corner along a direction (dx, dy normalised to dx = ±1). */
const back = (c: { x: number; y: number }, dir: { x: number; y: number }, r: number) => ({ x: c.x - dir.x * r, y: c.y - dir.y * r });

export interface RoadPath {
  id: string;
  d: string;
  kind: "road" | "bridge" | "street";
}

export const ROAD_PATHS: RoadPath[] = (() => {
  const a = ROADS.find((r) => r.id === "a")!;
  const b = ROADS.find((r) => r.id === "b")!;
  const tm = ROADS.find((r) => r.id === "bridge")!;
  const isl = ROADS.find((r) => r.id === "island")!;
  const eko = ROADS.find((r) => r.id === "eko")!;
  const R = 170;
  // Road A runs down-right into the Third Mainland Bridge head, where it turns down-left onto the bridge.
  const head = { x: a.x1, y: a.y1 };
  const inA = back(head, { x: 1, y: 0.5 }, R);
  const outTm = back(head, { x: 1, y: -0.5 }, R); // = head + R * (-1, +0.5)
  // Eko Bridge leaves Road B (running up-right) and heads down-right to Marina Wharf.
  const fork = { x: 2400, y: yOn(b, 2400) };
  const inB = back(fork, { x: 1, y: -0.5 }, R); // R before the fork, coming from the south-west
  const outEko = { x: fork.x + R, y: fork.y + 0.5 * R };
  return [
    { id: "a", kind: "road", d: `M${P(a.x0, a.y0)} L${P(inA.x, inA.y)} Q${P(head.x, head.y)} ${P(outTm.x, outTm.y)}` },
    { id: "bridge", kind: "bridge", d: `M${P(outTm.x, outTm.y)} L${P(tm.x0, tm.y0)}` },
    { id: "b", kind: "road", d: `M${P(b.x0, b.y0)} L${P(b.x1, b.y1)}` },
    { id: "eko-ramp", kind: "road", d: `M${P(inB.x, inB.y)} Q${P(fork.x, fork.y)} ${P(outEko.x, outEko.y)}` },
    { id: "eko", kind: "bridge", d: `M${P(outEko.x, outEko.y)} L${P(eko.x1, eko.y1)}` },
    { id: "island", kind: "road", d: `M${P(isl.x0, isl.y0)} L${P(isl.x1, isl.y1)}` },
    ...STREETS.map((s): RoadPath => ({ id: s.id, kind: "street", d: `M${P(s.x0, s.y0)} L${P(s.x1, s.y1)}` })),
  ];
})();
