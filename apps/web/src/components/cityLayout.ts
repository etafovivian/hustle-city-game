// New Lagos layout, following docs/city-plan.md: Mainland in the north, the lagoon across the middle,
// Third Mainland Bridge down to the Island, the Atlantic in the south.
// Roads run on the 2:1 isometric axes (slope ±0.5) so they line up with the building art.

export const WORLD = { w: 13000, h: 10400 };
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
  { id: "island", x0: 3700, y0: island(3700), x1: 13000, y1: island(13000) },
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
  [11200, 3080],
  [13000, 2960],
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
const ISLAND_S = 1100; // south shore (beach)
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
/** Road classes below the arterials: carriageway half-width and pavement width (vertical world units). */
export const STREET_CLASS = {
  collector: { half: 34, pav: 18 },
  local: { half: 24, pav: 14 },
  alley: { half: 11, pav: 0 },
} as const;
export type StreetClass = keyof typeof STREET_CLASS;
export interface Street extends Segment {
  cls: StreetClass;
  half: number;
  pav: number;
  /** In iso coordinates: the axis held fixed and its value, and the range of the other one. */
  fixedAxis: "a" | "b";
  at: number;
  lo: number;
  hi: number;
  /** The street's far end (where its turning circle is). */
  end: { x: number; y: number };
}
/** Walkers' line on a street: the middle of its pavement (alleys: the middle of the lane). */
const kerbOf = (cls: StreetClass) => (cls === "alley" ? 0 : STREET_CLASS[cls].half + STREET_CLASS[cls].pav / 2);

const QUARTERS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
/**
 * Junction 101's neighbourhood streets, the same in each quarter, in positive iso coordinates (u = |a|, v = |b|).
 * A street keeps one coordinate `fixed` at `at` and runs along the other from `from` to `to`. Collectors leave the
 * arterials; local streets and an alley leave the collectors and end in turning circles at the neighbourhood edge.
 */
interface StreetDef {
  id: string;
  fixed: "u" | "v";
  at: number;
  from: number;
  to: number;
  cls: StreetClass;
}
const STREET_AT = 850;
const STREET_LEN = 1350;
const STREET_DEFS: StreetDef[] = [
  { id: "c1", fixed: "u", at: STREET_AT, from: 0, to: STREET_LEN, cls: "collector" },
  { id: "c2", fixed: "v", at: STREET_AT, from: 0, to: STREET_LEN, cls: "collector" },
  { id: "l1", fixed: "v", at: 430, from: STREET_AT, to: STREET_LEN, cls: "local" },
  { id: "l2", fixed: "u", at: 430, from: STREET_AT, to: STREET_LEN, cls: "local" },
  { id: "y1", fixed: "u", at: 1100, from: STREET_AT, to: STREET_LEN, cls: "alley" },
];
/** World point of quarter coordinates (u along the fixed/running axes as given). */
const quarterPt = (sa: number, sb: number, u: number, v: number) => iso(sa * u, sb * v);
const defPt = (d: StreetDef, sa: number, sb: number, t: number, off = 0) =>
  d.fixed === "u" ? quarterPt(sa, sb, d.at + off, t) : quarterPt(sa, sb, t, d.at + off);

const JUNCTION_STREETS: Street[] = QUARTERS.flatMap(([sa, sb]) =>
  STREET_DEFS.map((d) => {
    // Streets off an arterial start under its asphalt; others start at the centre of the street they leave.
    const p = defPt(d, sa, sb, d.from === 0 ? HALF - 4 : d.from);
    const q = defPt(d, sa, sb, d.to);
    const [a, b] = p.x < q.x ? [p, q] : [q, p];
    const [sf, sr] = d.fixed === "u" ? [sa, sb] : [sb, sa];
    const [r0, r1] = [sr * (d.from === 0 ? HALF - 4 : d.from), sr * d.to];
    return {
      id: `${d.id}${sa}${sb}`,
      x0: a.x,
      y0: a.y,
      x1: b.x,
      y1: b.y,
      cls: d.cls,
      ...STREET_CLASS[d.cls],
      fixedAxis: d.fixed === "u" ? "a" : "b",
      at: sf * d.at,
      lo: Math.min(r0, r1),
      hi: Math.max(r0, r1),
      end: q,
    } satisfies Street;
  }),
);

// ── Area street grids ──
// Every area beyond Junction 101 gets its own streets: collectors leave its main road at intervals and local streets
// run between them, ending in turning circles. Plots then line every street (see the area generator below).
/** A line plots front onto, in absolute iso coordinates: `at` on the fixed axis, running from `from` to `to`. */
export interface FrontLine {
  id: string;
  fixed: "a" | "b";
  at: number;
  from: number;
  to: number;
  cls: StreetClass | "arterial";
  /** Drawn from under the main road it leaves (instead of from a street's centre). */
  offRoad?: boolean;
}
/** The Island road is the iso line b = -2400 (it runs parallel to Road A). */
export const ISLAND_B = -2400;
const A_ROAD = (from: number, to: number): FrontLine => ({ id: "A", fixed: "b", at: 0, from, to, cls: "arterial" });
const B_ROAD = (from: number, to: number): FrontLine => ({ id: "B", fixed: "a", at: 0, from, to, cls: "arterial" });
const I_ROAD = (from: number, to: number): FrontLine => ({ id: "I", fixed: "b", at: ISLAND_B, from, to, cls: "arterial" });
const st = (id: string, fixed: "a" | "b", at: number, from: number, to: number, cls: StreetClass, offRoad = false): FrontLine => ({ id, fixed, at, from, to, cls, offRoad });
const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** Collectors leaving a main road on both sides (or one), every `step`, `reach` long. */
function collectors(tag: string, fixed: "a" | "b", ats: number[], road: number, reaches: number[]) {
  return ats.flatMap((at, i) => reaches.map((r, j) => st(`${tag}c${i}${j ? "s" : "n"}`, fixed, at, road, road + r, "collector", true)));
}

/** Areas with their own street grid. Junction 101's neighbourhood has its quarter streets (above). */
const AREA_GRIDS: { area: string; lines: FrontLine[] }[] = [
  {
    area: "Tech Mile",
    lines: [A_ROAD(1450, 2250), ...collectors("tm", "a", [1650, 2050], 0, [1500]), st("tml1", "b", 800, 1650, 2300, "local"), st("tml2", "b", 1250, 1650, 2300, "local")],
  },
  {
    area: "Airport Ridge",
    lines: [B_ROAD(1450, 2750), ...collectors("ar", "b", [1750, 2200, 2650], 0, [1400, -1400]), ...[750, -750].map((a, i) => st(`arl${i}`, "a", a, 1750, 2650, "local"))],
  },
  {
    area: "Danfo Terminal",
    lines: [A_ROAD(-2750, -1450), ...collectors("dt", "a", [-2050, -2500], 0, [1400, -1400]), ...[800, -800].map((b, i) => st(`dtl${i}`, "b", b, -2050, -2750, "local"))],
  },
  {
    area: "Owambe Gardens",
    lines: [B_ROAD(-2350, -1450), ...collectors("ow", "b", [-1750, -2150], 0, [1400, -1400]), ...[750, -750].map((a, i) => st(`owl${i}`, "a", a, -1750, -2150, "local"))],
  },
  {
    area: "Apapa Port",
    lines: [B_ROAD(-3250, -2550), ...collectors("ap", "b", [-2900], 0, [1200, -1200]), ...[600, -600].map((a, i) => st(`apl${i}`, "a", a, -2900, -3250, "local"))],
  },
  {
    area: "Marina Wharf",
    lines: [I_ROAD(1450, 2300), ...collectors("mw", "a", [1850, 2200], ISLAND_B, [300, -950]), st("mwl", "b", ISLAND_B - 300, 1850, 2300, "local"), st("mwl2", "b", ISLAND_B - 680, 1850, 2300, "local")],
  },
  {
    area: "Island Heights",
    lines: [I_ROAD(2550, 4800), ...collectors("ih", "a", range(2850, 4650, 600), ISLAND_B, [300, -950]), st("ihl", "b", ISLAND_B - 300, 2850, 4650, "local"), st("ihl2", "b", ISLAND_B - 680, 2850, 4650, "local")],
  },
  {
    area: "Lekki Gardens",
    lines: [I_ROAD(4900, 10300), ...collectors("lk", "a", range(5150, 10100, 600), ISLAND_B, [300, -950]), st("lkl", "b", ISLAND_B - 300, 5150, 10100, "local"), st("lkl2", "b", ISLAND_B - 680, 5150, 10100, "local")],
  },
];

/** Streets stop where the land does (with room for the turning circle); very short ones are dropped. */
for (const g of AREA_GRIDS)
  g.lines = g.lines.flatMap((l) => {
    if (l.cls === "arterial") return [l];
    const dir = Math.sign(l.to - l.from);
    const pt = (t: number) => (l.fixed === "a" ? iso(l.at, t) : iso(t, l.at));
    let end = l.from;
    for (let t = l.from + dir * 40; dir > 0 ? t <= l.to : t >= l.to; t += dir * 40) {
      const p = pt(t);
      if (!onLand(p.x, p.y + 40)) break;
      end = t;
    }
    end -= dir * 60;
    return Math.abs(end - l.from) < 200 ? [] : [{ ...l, to: end }];
  });

/** A front line as a drawn street (main-road lines are drawn already). */
function streetOf(l: FrontLine): Street {
  const cls = l.cls as StreetClass;
  const dir = Math.sign(l.to - l.from);
  const start = l.offRoad ? l.from + dir * (HALF - 4) : l.from;
  const pt = (t: number) => (l.fixed === "a" ? iso(l.at, t) : iso(t, l.at));
  const p = pt(start);
  const q = pt(l.to);
  const [a, b] = p.x < q.x ? [p, q] : [q, p];
  return { id: l.id, x0: a.x, y0: a.y, x1: b.x, y1: b.y, cls, ...STREET_CLASS[cls], fixedAxis: l.fixed, at: l.at, lo: Math.min(start, l.to), hi: Math.max(start, l.to), end: q };
}
export const STREETS: Street[] = [...JUNCTION_STREETS, ...AREA_GRIDS.flatMap((g) => g.lines.filter((l) => l.cls !== "arterial").map(streetOf))];

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
  const p = toIso(cx, cy);
  const streets = STREETS.every((s) => {
    const [fixed, run] = s.fixedAxis === "a" ? [p.a, p.b] : [p.b, p.a];
    // Past either end (turning circles reach a little further)
    if (run + hh < s.lo - s.half * 2.4 || run - hh > s.hi + s.half * 2.4) return true;
    return Math.abs(fixed - s.at) >= hh + s.half + s.pav + 6;
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
  // The park's trees and fence spread past its base, so it keeps a wider square than its art.
  claim(c.x, c.y, 68, 24);
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
  { key: "lampnet_academy", district: "Tech Mile", scale: 1.15 },
  { key: "lagoon_capital_bank", district: "Island Heights", scale: 1.3 },
  { key: "grand_lagoon_hotel", district: "Island Heights", scale: 1.5 },
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


/** Districts beyond Junction 101, named for the game world, opening in later stages. */
export const DISTRICTS: District[] = [
  {
    name: "Tech Mile",
    ...iso(1600, 0),
    phase: 1,
    buildings: ["tech-hub", "phone-shop", "laptop-shop", "cyber-cafe", "polytechnic-gate", "chemist", "shop-house", "commercial-block", "gadget-kiosk", "mixed-use-block"],
    front: { axis: "a", at: 1800, base: 0, from: 1450, to: 2200 },
  },
  {
    name: "Owambe Gardens",
    ...iso(0, -1600),
    phase: 1,
    open: "ARTISANS · OPEN NOW",
    buildings: ["shop-house", "bungalow", "residential-block", "chemist"],
    front: { axis: "b", at: -1700, base: 0, from: -1450, to: -2250 },
  },
  {
    name: "Danfo Terminal",
    ...iso(-1800, 0),
    phase: 2,
    buildings: ["bus-terminal", "face-me-block", "shop-house", "buka", "mixed-use-block", "suya-stand", "bungalow"],
    front: { axis: "a", at: -1900, base: 0, from: -1450, to: -2600 },
  },
  {
    name: "Apapa Port",
    ...iso(0, -3000),
    phase: 2,
    // Lagos's main port: yard after yard of containers and cranes, sheds between them.
    buildings: ["container-port", "container-port", "warehouse", "container-port", "container-port", "warehouse", "container-port", "warehouse", "container-port", "commercial-block"],
    front: { axis: "b", at: -2950, base: 0, from: -2550, to: -3300 },
  },
  {
    name: "Airport Ridge",
    ...iso(0, 1600),
    phase: 4,
    // Terminal and tower up front; hangars (big sheds) towards the runway (see RUNWAY).
    buildings: ["airport-terminal", "control-tower", "warehouse", "warehouse", "warehouse", "commercial-block", "mixed-use-block"],
    front: { axis: "b", at: 1800, base: 0, from: 1450, to: 2600 },
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
      "residential-tower",
      "bank-crown-savings",
      "mall",
      "office-tower",
      "atm",
      "skyline-lounge",
      "car-showroom",
      "gym",
      "restaurant-terrace",
    ],
    front: { axis: "a", at: 3700, base: ISLAND_B, from: 2600, to: 4700 },
  },
  {
    name: "Lekki Gardens",
    x: 10000,
    y: island(10000),
    phase: 4,
    buildings: ["estate-gate", "crazy-house", "villa", "terrace-duplex", "villa", "terrace-duplex", "restaurant-terrace", "residential-tower"],
    front: { axis: "a", at: 7600, base: ISLAND_B, from: 4900, to: 10300 },
  },
  { name: "Atlantic Beach", x: 9000, y: island(9000) + ISLAND_S - 160, phase: 4, buildings: [], landmark: true },
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
  /** An area's signature building: still drawn when the map is zoomed far out. */
  landmark?: boolean;
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
  lampnet_academy: "school",
  lagoon_capital_bank: "bank-lagoon-capital",
  grand_lagoon_hotel: "hotel",
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

/** A plot of land with a permanent id: built on, or open land for sale. */
export interface LandPlot {
  id: string;
  /** Plot centre. */
  x: number;
  y: number;
  hh: number;
  area: string;
  use: "shop" | "home" | "for-sale";
  /** Frontage road class (what pulls customers). */
  road: StreetClass | "arterial";
}
export const LAND: LandPlot[] = [];
/** Open plots for sale: a dashed outline and a small sign. */
export const FOR_SALE: LandPlot[] = [];
const landId = (area: string, k: number) => `${area.toLowerCase().replace(/\s+/g, "-")}-land-${k}`;

// ── Airport: runway, taxiway and apron ──
/**
 * The runway runs parallel to Road A, north of Airport Ridge's streets (iso b = RUNWAY.b), with a taxiway beside it
 * and an apron (the parking pad for planes) between the taxiway and the terminal side. Drawn on the ground layer;
 * the ground under them is claimed so nothing gets built or planted there.
 */
export const RUNWAY = { a0: -1300, a1: 1300, b: 3150, half: 70, taxiB: 2970, taxiHalf: 26, apron: { a0: -500, a1: 500, b0: 2840, b1: 2950 } };
for (let a = RUNWAY.a0; a <= RUNWAY.a1; a += 100) {
  for (const [b, hh] of [
    [RUNWAY.b, RUNWAY.half + 20],
    [RUNWAY.taxiB, RUNWAY.taxiHalf + 20],
  ] as const) {
    const c = iso(a, b);
    TAKEN.push(patchAt(c.x, c.y, hh));
  }
}
for (let a = RUNWAY.apron.a0; a <= RUNWAY.apron.a1; a += 60) {
  const c = iso(a, (RUNWAY.apron.b0 + RUNWAY.apron.b1) / 2);
  TAKEN.push(patchAt(c.x, c.y, (RUNWAY.apron.b1 - RUNWAY.apron.b0) / 2 + 10));
}
/** An iso rectangle as a world polygon path. */
export const isoRect = (a0: number, a1: number, b0: number, b1: number) => {
  const p = [iso(a0, b0), iso(a1, b0), iso(a1, b1), iso(a0, b1)];
  return `M${p.map((q) => `${q.x.toFixed(0)} ${q.y.toFixed(0)}`).join(" L")}Z`;
};

const DISTRICT_SCENERY = DISTRICTS.filter((d) => d.front).flatMap((d) => settle(d, d.buildings, d.name));

// ── Neighbourhood generator ──
// Junction 101 is built like a mixed Mainland neighbourhood (Yaba, Surulere, Mushin): plots line every street, shops
// crowd the busy frontages and corners, compounds and flats sit behind them. Choices come from a seeded random
// number per plot, so the city is the same on every visit and each plot keeps its id for ownership later.

/** Deterministic random in [0, 1) from a string (FNV-1a hash into a mulberry32 step). */
export function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let t = (h += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(r: number, weighted: [T, number][]) => {
  const total = weighted.reduce((n, [, w]) => n + w, 0);
  let x = r * total;
  for (const [v, w] of weighted) if ((x -= w) < 0) return v;
  return weighted[weighted.length - 1]![0];
};

/**
 * Neighbourhood presets (game weights, not census figures). Densities follow the Lagos planning ranges the owner
 * shared: people and buildings per km² are kept for the economy and NPC counts; the map itself is drawn at game scale.
 */
export const PRESETS = {
  mainland: {
    label: "Mixed Mainland (Yaba, Surulere, Mushin)",
    peoplePerKm2: 30000,
    buildingsPerKm2: 2500,
    /** Share of plots that are shops before the location multipliers below. */
    commercial: 0.24,
    /** Share of plots kept as open land for sale. */
    forSale: 0.08,
    green: 0.16,
    plotHalf: 54,
    walkers: 30,
  },
  premium: { label: "Lekki / Ikoyi", peoplePerKm2: 10500, buildingsPerKm2: 1100, commercial: 0.05, forSale: 0.3, green: 0.55, plotHalf: 80, walkers: 8 },
  cbd: { label: "Victoria Island", peoplePerKm2: 8000, buildingsPerKm2: 600, commercial: 0.6, forSale: 0.2, green: 0.3, plotHalf: 80, walkers: 16 },
} as const;
/** Commercial pull of a location (owner's guide: quiet road 0.4×, corner 1.5×, collector 2×, junction 3×, bus stop 3.5×). */
const PULL: Record<StreetClass | "arterial", number> = { arterial: 2.4, collector: 2, local: 0.4, alley: 0.3 };

const MAINLAND_SHOPS: [string, number][] = [
  ["shop-house", 5],
  ["salon", 2],
  ["mechanic", 1],
  ["phone-shop", 2],
  ["chemist", 2],
  ["buka", 2],
  ["gadget-kiosk", 2],
  ["mixed-use-block", 2],
  ["laptop-shop", 1],
  ["cyber-cafe", 1],
  ["tailor-shop", 1],
  ["barbershop", 1],
  ["suya-stand", 1],
];
const MAINLAND_HOMES: [string, number][] = [
  ["face-me-block", 22],
  ["family-compound", 14],
  ["bungalow", 16],
  ["storey-house", 14],
  ["residential-block", 14],
  ["mixed-use-block", 8],
  ["unfinished-building", 5],
  ["shop-house", 5],
  ["terrace-duplex", 2],
];
/** Schools, clinics and places of worship: about one plot in ten off the busiest frontages (owner's guide). */
const MAINLAND_CIVIC: [string, number][] = [
  ["church", 3],
  ["mosque", 3],
  ["school", 3],
  ["clinic", 2],
];
/** Filling stations want a main-road frontage. */
const ARTERIAL_EXTRA: [string, number][] = [["filling-station", 1]];

/** What each area builds (game weights from the owner's Lagos guide, not census figures). */
interface AreaPreset {
  /** Share of plots that are shops before the location pull. */
  commercial: number;
  /** Share of plots kept as open land for sale. */
  forSale: number;
  /** Half-side of a plot (iso units): bigger plots, bigger buildings. */
  plotHalf: number;
  shops: [string, number][];
  homes: [string, number][];
  civic?: [string, number][];
  /** Extra choices for main-road frontage (filling stations, motor parks). */
  mainRoad?: [string, number][];
}
const AREA_PRESETS: Record<string, AreaPreset> = {
  "Junction 101": { commercial: PRESETS.mainland.commercial, forSale: PRESETS.mainland.forSale, plotHalf: PRESETS.mainland.plotHalf, shops: MAINLAND_SHOPS, homes: MAINLAND_HOMES, civic: MAINLAND_CIVIC, mainRoad: ARTERIAL_EXTRA },
  "Tech Mile": {
    commercial: 0.5,
    forSale: 0.12,
    plotHalf: 54,
    shops: [["phone-shop", 3], ["laptop-shop", 3], ["cyber-cafe", 2], ["gadget-kiosk", 2], ["tech-hub", 1], ["shop-house", 2], ["chemist", 1], ["salon", 1]],
    homes: [["residential-block", 3], ["storey-house", 3], ["mixed-use-block", 2], ["bungalow", 1]],
    civic: [["school", 1], ["polytechnic-gate", 1]],
    mainRoad: [["filling-station", 1]],
  },
  "Danfo Terminal": {
    commercial: 0.55,
    forSale: 0.06,
    plotHalf: 50,
    shops: [["shop-house", 4], ["buka", 3], ["suya-stand", 2], ["mechanic", 2], ["gadget-kiosk", 2], ["salon", 1], ["market-hall", 1]],
    homes: [["face-me-block", 4], ["family-compound", 3], ["unfinished-building", 2], ["storey-house", 2]],
    civic: [["mosque", 2], ["church", 2], ["clinic", 1]],
    mainRoad: [["filling-station", 1], ["motor-park", 1]],
  },
  "Owambe Gardens": {
    commercial: 0.35,
    forSale: 0.1,
    plotHalf: 56,
    shops: [["tailor-shop", 3], ["event-centre", 2], ["buka", 2], ["salon", 2], ["shop-house", 2], ["viewing-centre", 1]],
    homes: [["bungalow", 3], ["storey-house", 3], ["family-compound", 2], ["residential-block", 2]],
    civic: [["church", 2], ["mosque", 1], ["school", 1]],
  },
  "Airport Ridge": {
    commercial: 0.4,
    forSale: 0.12,
    plotHalf: 66,
    shops: [["commercial-block", 3], ["warehouse", 2], ["hotel", 1], ["chemist", 1], ["filling-station", 1]],
    homes: [["residential-block", 3], ["bungalow", 2], ["terrace-duplex", 2]],
    civic: [["clinic", 1], ["school", 1]],
  },
  "Apapa Port": {
    commercial: 0.7,
    forSale: 0.08,
    plotHalf: 66,
    shops: [["container-port", 5], ["warehouse", 4], ["mechanic", 2], ["commercial-block", 1], ["filling-station", 1]],
    homes: [["face-me-block", 2], ["unfinished-building", 1]],
  },
  "Marina Wharf": {
    commercial: 0.75,
    forSale: 0.1,
    plotHalf: 48,
    shops: [["colonial-block", 4], ["shop-house", 3], ["market-hall", 2], ["commercial-block", 2], ["bank-eko-trust", 1], ["chemist", 1]],
    homes: [["storey-house", 2], ["colonial-block", 2], ["face-me-block", 1]],
    civic: [["mosque", 1], ["church", 1]],
  },
  "Island Heights": {
    commercial: 0.7,
    forSale: 0.2,
    plotHalf: 64,
    shops: [["office-tower", 4], ["bank-lagoon-capital", 1], ["bank-crown-savings", 1], ["bank-eko-trust", 1], ["mall", 1], ["hotel", 1], ["skyline-lounge", 1], ["car-showroom", 1], ["gym", 1], ["restaurant-terrace", 2], ["atm", 1]],
    homes: [["residential-tower", 3], ["terrace-duplex", 1]],
  },
  "Lekki Gardens": {
    commercial: 0.1,
    forSale: 0.3,
    plotHalf: 62,
    shops: [["restaurant-terrace", 2], ["gym", 1], ["chemist", 1], ["car-showroom", 1], ["mall", 1]],
    homes: [["villa", 4], ["terrace-duplex", 4], ["residential-tower", 1], ["crazy-house", 1], ["estate-gate", 1]],
    civic: [["school", 1], ["church", 1]],
  },
};

/** The Junction 101 neighbourhood's front lines: both arterials' frontages and every quarter street. */
const J101_LINES: FrontLine[] = [
  A_ROAD(ZEBRA_AT + 40, STREET_LEN),
  A_ROAD(-STREET_LEN, -(ZEBRA_AT + 40)),
  B_ROAD(ZEBRA_AT + 40, STREET_LEN),
  B_ROAD(-STREET_LEN, -(ZEBRA_AT + 40)),
  ...QUARTERS.flatMap(([sa, sb]) =>
    STREET_DEFS.map((d): FrontLine =>
      d.fixed === "u" ? st(`${d.id}${sa}${sb}`, "a", sa * d.at, sb * d.from, sb * d.to, d.cls) : st(`${d.id}${sa}${sb}`, "b", sb * d.at, sa * d.from, sa * d.to, d.cls),
    ),
  ),
];

/**
 * The area generator: plots on both sides of every front line, shops on busy frontages and corners, homes and
 * civic buildings behind, a share kept as land for sale. Seeded per plot id, so the same on every visit.
 */
function fillArea(area: string, lines: FrontLine[]) {
  const P = AREA_PRESETS[area]!;
  const slug = area.toLowerCase().replace(/\s+/g, "-");
  const houses: Building[] = [];
  const driveways: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const l of lines) {
    const clear = l.cls === "arterial" ? HALF + PAVEMENT + 8 : STREET_CLASS[l.cls].half + STREET_CLASS[l.cls].pav + 6;
    const crossings = lines.filter((o) => o.fixed !== l.fixed).map((o) => o.at);
    const [lo, hi] = [Math.min(l.from, l.to), Math.max(l.from, l.to)];
    for (const side of [1, -1] as const) {
      let n = 0;
      for (let t = lo + 60; t <= hi - 40; t += 24) {
        const id = `${slug}-${l.id}${side > 0 ? "+" : "-"}${n}`;
        const r = seeded(id);
        const corner = crossings.some((c) => Math.abs(c - t) < P.plotHalf * 2 + 60);
        const nearJunction = area === "Junction 101" && l.cls === "arterial" && Math.abs(t) < 700;
        const pull = PULL[l.cls] * (corner ? 1.5 : 1) * (nearJunction ? 1.25 : 1);
        const shop = r < Math.min(0.92, P.commercial * pull);
        const hh = shop ? P.plotHalf - 4 : P.plotHalf;
        const off = l.at + side * (clear + hh + 2);
        const c = l.fixed === "b" ? iso(t, off) : iso(off, t);
        if (!onSite(c.x, c.y, hh) || !claim(c.x, c.y, hh, 22)) continue;
        n++;
        t += hh * 2;
        const forSale = seeded(id + ":land") < P.forSale;
        const plot: LandPlot = { id, x: c.x, y: c.y, hh, area, use: forSale ? "for-sale" : shop ? "shop" : "home", road: l.cls };
        LAND.push(plot);
        if (forSale) {
          FOR_SALE.push(plot);
          continue;
        }
        const civic = !shop && !!P.civic && l.cls !== "arterial" && seeded(id + ":civic") < 0.1;
        const choices = shop ? (l.cls === "arterial" && P.mainRoad ? [...P.shops, ...P.mainRoad] : P.shops) : civic ? P.civic! : P.homes;
        const art = pick(seeded(id + ":art"), choices);
        const scale = (hh * 4) / BASE;
        houses.push({ art: `/art/buildings/${art}.webp`, x: c.x, y: c.y + siteOf(scale).lift, key: id, scale });
        // Homes off the quieter streets get a driveway from the street to the plot.
        if (!shop && l.cls !== "arterial" && l.cls !== "alley") {
          const half = STREET_CLASS[l.cls].half;
          const p0 = l.fixed === "b" ? iso(t - hh * 2, l.at + side * half) : iso(l.at + side * half, t - hh * 2);
          const p1 = l.fixed === "b" ? iso(t - hh * 2, off - side * hh) : iso(off - side * hh, t - hh * 2);
          driveways.push({ x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y });
        }
      }
    }
  }
  return { houses, driveways };
}

const FILLED = [fillArea("Junction 101", J101_LINES), ...AREA_GRIDS.map((g) => fillArea(g.area, g.lines))];
const AREA_HOUSES = FILLED.flatMap((f) => f.houses);
export const DRIVEWAYS = FILLED.flatMap((f) => f.driveways);

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
  "pos-booth": 84,
  vulcanizer: 104,
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
        const kinds = [traders[n % 3]!, n % 2 ? "pos-booth" : "vulcanizer", traders[(n + 1) % 3]!, n % 2 ? "kiosk-container" : "bus-stop"];
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

/** The roundabout: asphalt ring, centre island (with the fountain) and the lane vehicles drive round anticlockwise. */
export const ROUNDABOUT = { rx: 150, ry: 75, island: { rx: 78, ry: 39 }, lane: { rx: 114, ry: 57 } };
// Lamps on the four corners of the junction, lighting the roundabout and the zebras
for (const [sa, sb] of QUARTERS) {
  const c = iso(sa * 100, sb * 100);
  LAMPS.push({ x: c.x, y: c.y, key: `j101-${sa}${sb}`, behind: c.y < CY });
}

/** Palms along the Island road (Lekki feel) and trees around the districts. */
const EXTRA_TREES = [
  ...Array.from({ length: 22 }, (_, i) => 3900 + i * 260).flatMap((x, i) => {
    const y = island(x) + (i % 2 ? 150 : -150);
    return onIsland(x, y) && claim(x, y, 16, 6) ? [{ x, y, kind: "palm" as TreeKind, key: `isle-${i}` }] : [];
  }),
  ...DISTRICTS.flatMap((d, i) =>
    [
      { x: d.x - 520, y: d.y - 260 },
      { x: d.x + 520, y: d.y + 280 },
      { x: d.x + 140, y: d.y - 420 },
    ]
      .filter((p) => onLand(p.x, p.y) && claim(p.x, p.y, 16, 6))
      .map((p, j) => ({ ...p, kind: (i + j) % 2 ? ("palm" as TreeKind) : ("leafy" as TreeKind), key: `dt-${i}-${j}` })),
  ),
];
// ── Green: trees, bushes and grass ──
// Lagos ground is mostly laterite, with green where people plant it: almond and mango trees shading compounds,
// palms along the Island, hedges and lawns in the estates. Each area has its own share of green.
export type TreeKind = "leafy" | "palm" | "mango" | "almond" | "neem" | "plantain" | "bush" | "hedge" | "bougainvillea";
const GREEN_SHARE: Record<string, number> = { "Lekki Gardens": 0.6, "Island Heights": 0.32, "Airport Ridge": 0.3, "Owambe Gardens": 0.25, "Tech Mile": 0.15, "Marina Wharf": 0.1, "Danfo Terminal": 0.06, "Apapa Port": 0.04 };
const GREEN_AREAS: { name: string; a0: number; a1: number; b0: number; b1: number; green: number }[] = [
  { name: "j101", a0: -1400, a1: 1400, b0: -1400, b1: 1400, green: PRESETS.mainland.green },
  ...AREA_GRIDS.map((g) => {
    const as = g.lines.flatMap((l) => (l.fixed === "a" ? [l.at] : [l.from, l.to]));
    const bs = g.lines.flatMap((l) => (l.fixed === "b" ? [l.at] : [l.from, l.to]));
    return { name: g.area, a0: Math.min(...as) - 200, a1: Math.max(...as) + 200, b0: Math.min(...bs) - 200, b1: Math.max(...bs) + 200, green: GREEN_SHARE[g.area] ?? 0.15 };
  }),
];
/** Grass patches: flat on the ground, under everything. */
export const GRASS: { x: number; y: number; r: number; key: string }[] = [];
const SCATTER = GREEN_AREAS.flatMap((g) => {
  const out: { x: number; y: number; kind: TreeKind; key: string }[] = [];
  const premium = g.green >= 0.3;
  for (let a = g.a0; a <= g.a1; a += 85)
    for (let b = g.b0; b <= g.b1; b += 85) {
      const key = `${g.name}:${a}:${b}`;
      const r = seeded(key);
      if (r > g.green) continue;
      const c = iso(a + (seeded(key + "x") - 0.5) * 50, b + (seeded(key + "y") - 0.5) * 50);
      if (!onLand(c.x, c.y)) continue;
      const kind = pick<TreeKind | "grass">(
        seeded(key + "k"),
        premium
          ? [["grass", 4], ["hedge", 2], ["bougainvillea", 1], ["palm", 2], ["almond", 2], ["mango", 1], ["plantain", 1], ["bush", 1]]
          : [["grass", 3], ["bush", 1], ["almond", 2], ["mango", 2], ["neem", 2], ["plantain", 2], ["palm", 1]],
      );
      if (kind === "grass") {
        const p = patchAt(c.x, c.y, 26);
        if (groundClear(c.x, c.y, 26) && !TAKEN.some((q) => overlaps(p, q, 0))) GRASS.push({ x: c.x, y: c.y, r: 34 + seeded(key + "r") * 30, key });
        continue;
      }
      const hh = kind === "hedge" || kind === "bougainvillea" ? 28 : kind === "bush" ? 12 : 16;
      if (claim(c.x, c.y, hh, 4)) out.push({ ...c, kind, key });
    }
  return out;
});
// ── Forests ──
/** Forest reserves on the open land between areas: dark ground packed with trees. */
export const FORESTS = [
  { name: "Ikeja Forest Reserve", a0: -3100, a1: -1500, b0: 1550, b1: 3000 },
  { name: "Lagoon Forest", a0: 1600, a1: 3400, b0: 2850, b1: 4300 },
  { name: "Badagry Creek Forest", a0: -1500, a1: 300, b0: -4600, b1: -3450 },
].map((f) => ({ ...f, path: isoRect(f.a0, f.a1, f.b0, f.b1) }));
const FOREST_TREES = FORESTS.flatMap((f) => {
  const out: { x: number; y: number; kind: TreeKind; key: string }[] = [];
  for (let a = f.a0 + 40; a <= f.a1 - 40; a += 62)
    for (let b = f.b0 + 40; b <= f.b1 - 40; b += 62) {
      const key = `${f.name}:${a}:${b}`;
      if (seeded(key) > 0.86) continue;
      const c = iso(a + (seeded(key + "x") - 0.5) * 44, b + (seeded(key + "y") - 0.5) * 44);
      if (!onLand(c.x, c.y)) continue;
      const kind = pick<TreeKind>(seeded(key + "k"), [["almond", 3], ["mango", 3], ["neem", 3], ["palm", 2], ["plantain", 1], ["bush", 2], ["leafy", 1]]);
      if (claim(c.x, c.y, kind === "bush" ? 10 : 13, 2)) out.push({ ...c, kind, key });
    }
  return out;
});

export const TREES = [...EXTRA_TREES, ...SCATTER, ...FOREST_TREES].sort((a, b) => a.y - b.y);

export const ALL_SCENERY: Building[] = [...DISTRICT_SCENERY.map((b) => ({ ...b, landmark: true })), { ...JETTY, landmark: true }, ...AREA_HOUSES].sort((a, b) => a.y - b.y);

/** Every placed building and plot, for the layout check (scripts/check-clearance.ts). */
export const PLACED = { scenery: ALL_SCENERY, venues: VENUE_SPOTS, plots: PLOTS, plotHalf: PLOT_HH, props: PROPS, trees: TREES, land: LAND, plotCentre };

// ── Footpaths ──
/** Walkers keep to the middle of the pavement: this far (vertically) from a road's centre line. */
export const KERB = HALF + PAVEMENT / 2;
export interface Zebra {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Stripe length (the band's width along the road). */
  w: number;
}

/**
 * The footpath network around Junction 101: both pavements of each arm, round the corners, across the zebras,
 * along both pavements of every collector and local street, and down the middle of the alleys. Nodes are world
 * points; edges join them. Pavements meet where streets cross, so walkers can turn there.
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
  // Streets leaving the arterials (their mouths interrupt the arterial pavements)
  const mouthsU = STREET_DEFS.filter((d) => d.from === 0 && d.fixed === "u");
  const mouthsV = STREET_DEFS.filter((d) => d.from === 0 && d.fixed === "v");
  const stopsAround = (defs: StreetDef[]) => defs.flatMap((d) => [d.at - kerbOf(d.cls), d.at + kerbOf(d.cls)]);
  for (const s of [1, -1] as const) {
    for (const side of [1, -1] as const) {
      // Road A pavements (b = ±KERB) stop either side of the streets leaving Road A, and the same for Road B
      chain([ZEBRA_AT, ...stopsAround(mouthsU), WALK_FAR].sort((p, q) => p - q).map((t) => [s * t, side * KERB]));
      chain([ZEBRA_AT, ...stopsAround(mouthsV), WALK_FAR].sort((p, q) => p - q).map((t) => [side * KERB, s * t]));
    }
    // Zebras at the junction and at the far ends of the arms
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
  // Streets: pavement chains on both sides (alleys: one chain down the middle), stopping at every crossing street
  for (const [sa, sb] of QUARTERS) {
    const pt = (d: StreetDef, off: number, t: number): [number, number] => (d.fixed === "u" ? [sa * (d.at + off), sb * t] : [sa * t, sb * (d.at + off)]);
    for (const d of STREET_DEFS) {
      const k = kerbOf(d.cls);
      const start = d.from === 0 ? KERB : d.from + kerbOf(STREET_DEFS.find((x) => x.fixed !== d.fixed && x.at === d.from)!.cls);
      const end = d.to - 20;
      const crossing = STREET_DEFS.filter((x) => x.fixed !== d.fixed && x.at > start && x.at < end && d.at >= x.from && d.at <= x.to);
      const stops = [start, ...crossing.flatMap((x) => (x.cls === "alley" ? [x.at] : [x.at - kerbOf(x.cls), x.at + kerbOf(x.cls)])), end].sort((p, q) => p - q);
      for (const off of d.cls === "alley" ? [0] : [-k, k]) chain(stops.map((t) => pt(d, off, t)));
      if (d.cls !== "alley") {
        // Round the turning circle at the end
        chain([pt(d, -k, end), pt(d, k, end)]);
        // Zebra across the mouth, along the pavement line of the road it leaves
        const from = d.from === 0 ? KERB : start;
        const [lo, hi] = [d.at - STREET_CLASS[d.cls].half, d.at + STREET_CLASS[d.cls].half];
        if (d.fixed === "u") zebra("b", sb * from, sa * lo, sa * hi, d.cls === "collector" ? 18 : 14);
        else zebra("a", sa * from, sb * lo, sb * hi, d.cls === "collector" ? 18 : 14);
        // Where a street crosses this one right through, zebras across this street on both sides of the crossing
        for (const x of crossing.filter((xx) => xx.cls !== "alley" && xx.from < d.at))
          for (const pos of [x.at - kerbOf(x.cls), x.at + kerbOf(x.cls)]) {
            const [p0, p1] = [d.at - STREET_CLASS[d.cls].half, d.at + STREET_CLASS[d.cls].half];
            if (d.fixed === "u") zebra("b", sb * pos, sa * p0, sa * p1, 14);
            else zebra("a", sa * pos, sb * p0, sb * p1, 14);
          }
        // Streets that start at this one (T-junctions) get a crossing over this street too
        for (const x of STREET_DEFS.filter((xx) => xx.fixed !== d.fixed && xx.from === d.at && xx.cls !== "alley")) {
          chain([pt(d, -k, x.at + kerbOf(x.cls)), pt(d, k, x.at + kerbOf(x.cls))]);
          const [p0, p1] = [d.at - STREET_CLASS[d.cls].half, d.at + STREET_CLASS[d.cls].half];
          const pos = x.at + kerbOf(x.cls);
          if (d.fixed === "u") zebra("b", sb * pos, sa * p0, sa * p1, 14);
          else zebra("a", sa * pos, sb * p0, sb * p1, 14);
        }
      }
    }
  }
  const links: number[][] = nodes.map(() => []);
  for (const [p, q] of edges) {
    if (p === q) continue;
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

/** Street ends away from the main roads: turning circles sized to the street (alleys just stop). */
export const STREET_ENDS = STREETS.filter((s) => s.cls !== "alley").map((s) => ({ ...s.end, key: s.id, half: s.half, pav: s.pav }));

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
  kind: "road" | "bridge" | "street" | "alley";
  /** Streets: carriageway half-width and pavement width. */
  half?: number;
  pav?: number;
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
    ...STREETS.map((s): RoadPath => ({ id: s.id, kind: s.cls === "alley" ? "alley" : "street", d: `M${P(s.x0, s.y0)} L${P(s.x1, s.y1)}`, half: s.half, pav: s.pav })),
  ];
})();
