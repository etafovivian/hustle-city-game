// New Lagos layout, following docs/city-plan.md: Mainland in the north, the lagoon across the middle,
// Third Mainland Bridge down to the Island, the Atlantic in the south.
// Roads run on the 2:1 isometric axes (slope ±0.5) so they line up with the building art.
import type { TransitLine, TransitMode, TransitStop } from "./transitData.js";

/**
 * The world's edges. Lagos fills 0..w × 0..h; Ogun State lies north of it, past the state border on the expressway, up
 * to y0 (negative). `w` and `h` are the far edges (Lagos's ground rectangle is drawn 0..w × 0..h).
 */
export const WORLD = { x0: 0, y0: -5600, w: 13000, h: 10400 };
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
  /** Street lamps only along these x ranges (the expressway is dark through the bush); every 250 when unset. */
  lit?: [number, number][];
  /** Traffic density (1 = like the city roads). */
  traffic?: number;
}

/** y on a segment's centre line for an x (segments are never vertical). */
export const yOn = (s: Segment, x: number) => s.y0 + ((x - s.x0) * (s.y1 - s.y0)) / (s.x1 - s.x0);
/** Island road: Marina Wharf → Island Heights → Lekki. */
const island = (x: number) => 4300 + 0.5 * (x - 3800);

/** World point of iso road coordinates (as `iso` below, which the road list can't use yet). */
const isoXY = (a: number, b: number) => ({ x: CX + a + b, y: CY + 0.5 * a - 0.5 * b });
// ── Ogun State: the Lagos-Ibadan expressway ──
// Road A runs on past its north-west end (the "To Ogun · Ibadan" sign) to OGUN_A, turns and runs north-east along the
// iso line a = OGUN_A, through the bush to the state border, then Mowe, the Sagamu interchange and Abeokuta.
export const OGUN_A = -4300;
/** Expressway landmarks, as iso b along a = OGUN_A. */
export const OGUN_B = { border: 1300, moweFrom: 2200, moweTo: 3700, sagamuFrom: 4600, sagamu: 5200, sagamuTo: 5800, abeokutaFrom: 6800, abeokutaTo: 9100, end: 9300 } as const;
const OGUN_CORNER = isoXY(OGUN_A, 0);
const OGUN_END = isoXY(OGUN_A, OGUN_B.end);
/** The Sagamu road crosses the expressway at the interchange (iso b = OGUN_B.sagamu), from a = -5800 to -3000. */
const SAGAMU_W = isoXY(-5800, OGUN_B.sagamu);
const SAGAMU_E = isoXY(-3000, OGUN_B.sagamu);
/** Lamps through the towns only (world x ranges along the expressway). */
const ogunLit = (...bs: [number, number][]) => bs.map(([b0, b1]) => [isoXY(OGUN_A, b0).x, isoXY(OGUN_A, b1).x] as [number, number]);

export const ROADS: Segment[] = [
  // Road A: Danfo Terminal (NW) → Junction 101 → Tech Mile → bridge head
  { id: "a", x0: 900, y0: CY + 0.5 * (900 - CX), x1: 7200, y1: CY + 0.5 * (7200 - CX) },
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
  // Ogun (appended, so the roads above keep their places): Road A's carry-on to the expressway's corner, the
  // expressway, and the Sagamu road across it at the interchange.
  { id: "ogun-link", x0: OGUN_CORNER.x, y0: OGUN_CORNER.y, x1: 900, y1: CY + 0.5 * (900 - CX), lit: [], traffic: 0.6 },
  {
    id: "expressway",
    x0: OGUN_CORNER.x,
    y0: OGUN_CORNER.y,
    x1: OGUN_END.x,
    y1: OGUN_END.y,
    lit: ogunLit([OGUN_B.border + 100, OGUN_B.border + 400], [OGUN_B.moweFrom, OGUN_B.moweTo], [OGUN_B.sagamuFrom, OGUN_B.sagamuTo], [OGUN_B.abeokutaFrom, OGUN_B.end]),
    traffic: 0.45,
  },
  { id: "sagamu-road", x0: SAGAMU_W.x, y0: SAGAMU_W.y, x1: SAGAMU_E.x, y1: SAGAMU_E.y, lit: [[isoXY(-4900, 0).x + OGUN_B.sagamu, isoXY(-3700, 0).x + OGUN_B.sagamu]], traffic: 0.5 },
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

// ── Sandbar Bay ──
// A small beach spit in the harbour mouth off Marina Wharf, on the Atlantic side: sand and palms, reachable only by the
// water bus (its pier faces Marina). An ellipse in iso coordinates (long along Road A's axis), drawn smooth.
const SANDBAR = { a: 1925, b: -4015, ra: 470, rb: 160 };
const isoPt = (a: number, b: number) => ({ x: CX + a + b, y: CY + 0.5 * a - 0.5 * b });
const sandbarRing = (grow: number): [number, number][] =>
  Array.from({ length: 24 }, (_, i) => {
    const t = (i / 24) * 2 * Math.PI;
    const p = isoPt(SANDBAR.a + (SANDBAR.ra + grow) * Math.cos(t), SANDBAR.b + (SANDBAR.rb + grow) * Math.sin(t));
    return [Math.round(p.x), Math.round(p.y)];
  });
const closedSmooth = (pts: [number, number][]) => {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n]!;
  let d = `M${at(0)[0]} ${at(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(0)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(0)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(0)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(0)} ${p2[0]} ${p2[1]}`;
  }
  return `${d}Z`;
};
/** Sandbar Bay's sand, and the pale wet rim drawn under it. */
export const SANDBAR_PATH = closedSmooth(sandbarRing(0));
export const SANDBAR_RIM_PATH = closedSmooth(sandbarRing(36));
/** Where a person can stand on the sandbar (a little inside its edge). */
const inSandbar = (x: number, y: number, inset = 30) => {
  const a = (x - CX) / 2 + (y - CY) - SANDBAR.a;
  const b = (x - CX) / 2 - (y - CY) - SANDBAR.b;
  return (a / (SANDBAR.ra - inset)) ** 2 + (b / (SANDBAR.rb - inset)) ** 2 <= 1;
};
// ── The Ogun River ──
// Comes down from the north past Abeokuta's east side and leaves the map to the east, through the bush (no road or
// track crosses it). A Catmull-Rom curve through these points, sampled into a polyline for drawing and for tests.
const RIVER_KNOTS: [number, number][] = [
  [8500, -5700],
  [9150, -5180],
  [10150, -4800],
  [11050, -4150],
  [11800, -3250],
  [12500, -2650],
  [13300, -2380],
];
export const RIVER_HALF = 95;
export const RIVER_PTS: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  const k = RIVER_KNOTS;
  for (let i = 0; i < k.length - 1; i++) {
    const [p0, p1, p2, p3] = [k[i - 1] ?? k[i]!, k[i]!, k[i + 1]!, k[i + 2] ?? k[i + 1]!];
    for (let t = 0; t < 1; t += 0.125) {
      const [t2, t3] = [t * t, t * t * t];
      const f = (j: 0 | 1) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push({ x: Math.round(f(0)), y: Math.round(f(1)) });
    }
  }
  out.push({ x: k[k.length - 1]![0], y: k[k.length - 1]![1] });
  return out;
})();
/** Distance from a point to the river's centre line. */
export function riverDistance(x: number, y: number) {
  if (y > -1500) return Infinity; // the river is all in the far north
  let best = Infinity;
  for (let i = 1; i < RIVER_PTS.length; i++) {
    const [p, q] = [RIVER_PTS[i - 1]!, RIVER_PTS[i]!];
    const [dx, dy] = [q.x - p.x, q.y - p.y];
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x + dx * t - x, p.y + dy * t - y));
  }
  return best;
}

/** Dry land with room for a building (art is drawn up to ~210 units above its foot). */
export const onLand = (x: number, y: number) => (y < shoreY(x) - 60 && riverDistance(x, y) > RIVER_HALF + 60) || onIsland(x, y) || inSandbar(x, y, 50);

// ── Walking ──
export type Landmass = "mainland" | "island" | "bridge" | "sandbar";
const BRIDGES = ROADS.filter((r) => r.bridge);
/** Where a person can stand: mainland, the Island, or the bridge deck. Null means water or off the map. */
export function landmassAt(x: number, y: number): Landmass | null {
  if (x < WORLD.x0 || y < WORLD.y0 || x > WORLD.w || y > WORLD.h) return null;
  if (BRIDGES.some((b) => x >= b.x0 && x <= b.x1 && Math.abs(y - yOn(b, x)) < HALF + 14)) return "bridge";
  if (y < shoreY(x) - 12) return riverDistance(x, y) < RIVER_HALF + 10 ? null : "mainland";
  if (x > TIP + 120 && y > island(x) + ISLAND_N + 40 && y < island(x) + ISLAND_S - 10) return "island";
  if (inSandbar(x, y)) return "sandbar";
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
  // Sandbar Bay has no bridge: walk about on it, or take the water bus.
  if (start === "sandbar" || end === "sandbar") return start === end ? [to] : null;
  // Around Junction 101, walk the pavements and cross at the zebras, like everyone else.
  if (start === "mainland" && end === "mainland") {
    const onFoot = footpathRoute(from, to);
    if (onFoot) return onFoot;
  }
  // A few steps away: just walk over.
  if (Math.hypot(to.x - from.x, to.y - from.y) < 260 && clearLine(from, to)) return [to];
  // Farther afield, follow the streets' pavements (and the bridges) instead of cutting across plots.
  const byRoad = roadRoute(from, to, true);
  if (byRoad) return byRoad;
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
    lines: [
      A_ROAD(-2750, -1450),
      ...collectors("dt", "a", [-2050, -2500], 0, [1400, -1400]),
      // The flyover's ramps land at b = ±600 on a = -1650: streets carry on from both ends, and the side streets
      // run through to meet them, so the flyover joins the grid instead of stopping in the sand.
      st("dtfn", "a", -1650, 600, 1400, "collector"),
      st("dtfs", "a", -1650, -600, -1400, "collector"),
      ...[800, -800].map((b, i) => st(`dtl${i}`, "b", b, -1650, -2750, "local")),
    ],
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
const BOARD_AT: { key: string; road: string; x: number; drawX?: number }[] = [
  { key: "junction-101", road: "a", x: CX - 400 },
  { key: "third-mainland", road: "bridge", x: 6500 },
  { key: "danfo-terminal", road: "a", x: CX - 1450 },
  { key: "tech-mile", road: "a", x: CX + 1250 },
  { key: "owambe-gardens", road: "b", x: CX - 1250, drawX: CX - 1300 },
  // drawX: where a board is drawn when its first spot ended up crowded (houses right behind it, or the Ogun
  // railway between its legs). The first spot stays reserved, so the buildings around it don't move.
  { key: "airport-ridge", road: "b", x: CX + 1250, drawX: CX + 2400 },
  { key: "island-heights", road: "island", x: 5650, drawX: 5000 },
  { key: "lekki-gardens", road: "island", x: 7450, drawX: 7400 },
];
// Both legs stand behind the pavement: roads run diagonally, so check the road under each leg.
const LEG = 125;
const boardAt = (road: string, x: number) => {
  const seg = ROADS.find((r) => r.id === road)!;
  const roadTop = Math.min(yOn(seg, x - LEG), yOn(seg, x + LEG)) - HALF - PAVEMENT;
  return { x, y: roadTop - 48 };
};
/** Where the land is kept clear for each board (fixed: the city is laid out around these). */
const BOARD_RESERVED = BOARD_AT.map((b) => ({ key: b.key, ...boardAt(b.road, b.x) }));
/** Where each board is drawn. */
export const BILLBOARD_SPOTS = BOARD_AT.map((b) => ({ key: b.key, ...boardAt(b.road, b.drawX ?? b.x) }));

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
  const boards = BOARD_RESERVED.every((s) => Math.abs(cx - s.x) > LEG + 30 + 2 * hh || Math.abs(cy - s.y) > hh + 50);
  return roads && streets && roundabout && boards;
}

/** Everything placed so far; each new thing must not overlap it. */
const TAKEN: Patch[] = [];
/** Is this ground point on something built (a building's or place's plot)? Taps there walk you to the pavement. */
export function onBuiltPlot(x: number, y: number): boolean {
  const p = toIso(x, y);
  return TAKEN.some((q) => Math.abs(p.a - q.a) < q.hh && Math.abs(p.b - q.b) < q.hh);
}
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
  { key: "fit_lagos", district: "Island Heights" },
  { key: "skyline_lounge", district: "Island Heights" },
  { key: "island_motors", district: "Island Heights" },
  { key: "lagoon_golf_club", district: "Island Heights" },
  { key: "glory_hair_salon", district: "Owambe Gardens" },
  { key: "grace_chapel", district: "Owambe Gardens" },
  { key: "city_stadium", district: "Owambe Gardens" },
  { key: "central_mosque", district: "Danfo Terminal" },
  { key: "police_division", district: "Danfo Terminal" },
  { key: "oga_snooker", district: "Danfo Terminal" },
  // The boat cruise leaves from Marina's ferry jetty (drawn half over the lagoon)
  { key: "lagoon_boat_cruise", a: 1510, b: -2060 },
  { key: "high_court", district: "Marina Wharf" },
  { key: "balogun_market", district: "Marina Wharf", scale: 1.2 },
  { key: "city_library", district: "Tech Mile" },
  { key: "city_fm", district: "Tech Mile" },
  { key: "general_hospital", district: "Airport Ridge", scale: 1.2 },
  { key: "lagoon_city_university", district: "Tech Mile", scale: 1.3 },
  { key: "ring_kings_boxing", district: "Danfo Terminal" },
  // On Sandbar Bay, a short walk from its pier, facing the open sea (open sand either side for cabanas later)
  { key: "sandbar_beach", a: 1880, b: -4065 },
  // Ogun State (see the expressway at OGUN_A): the estate office at Mowe's gate, the Sagamu interchange's motor park on
  // its south-east corner, Olumo Rock on the high ground north of Abeokuta, and Itoku's adire market on the main road.
  { key: "mowe_estate_office", a: -4475, b: 2725, scale: 1.1 },
  { key: "sagamu_junction", a: -4135, b: 5035 },
  // (The rock's art is a tall tile: drawn at 1.6 so it doesn't hide Abeokuta's houses; the hill is claimed separately.)
  { key: "olumo_rock", a: -5300, b: 7720, scale: 1.6 },
  { key: "itoku_adire_market", a: -4480, b: 8625, scale: 1.25 },
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
  stadium: 2,
  "golf-club": 1.4,
  hospital: 1.3,
  "high-court": 1.2,
  library: 1.15,
  university: 1.3,
  // New art for venues placed by district keeps the size its stand-in had (so no plot moves)
  senate: 1.3,
  "boxing-club": 1.1,
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
  // Newer areas (appended, so nothing above moves). Ikodu Town: the outer mainland on the lagoon past Airport Ridge
  // and the Lagoon Forest; bungalows, compounds and half-built houses on sandy streets, with a water bus jetty.
  { name: "Ikodu Town", ...iso(3330, 2420), phase: 4, buildings: [] },
  // Sandbar Bay: the beach spit off Marina Wharf (its name sits on the water just south of it).
  { name: "Sandbar Bay", ...(({ x, y }) => ({ x, y: y + 20 }))(iso(1925, -4015)), phase: 4, buildings: [], landmark: true },
  // Ogun State, past the border on the expressway: Mowe's new estates, the Sagamu interchange, and Abeokuta.
  { name: "Mowe", ...iso(-4800, 3000), phase: 4, buildings: [] },
  { name: "Sagamu", ...iso(-4700, 5450), phase: 4, buildings: [] },
  { name: "Abeokuta", ...iso(-4650, 8250), phase: 4, buildings: [] },
];
/** Areas added after the first city: older buildings keep the area (and branch names) they had before these. */
const NEWER_AREAS = new Set(["Ikodu Town", "Sandbar Bay", "Mowe", "Sagamu", "Abeokuta"]);

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

export const VENUE_ART: Record<string, string> = {
  fit_lagos: "gym",
  skyline_lounge: "skyline-lounge",
  island_motors: "car-showroom",
  lagoon_golf_club: "golf-club",
  glory_hair_salon: "salon",
  grace_chapel: "church",
  city_stadium: "stadium",
  central_mosque: "mosque",
  police_division: "police-station",
  oga_snooker: "snooker",
  high_court: "high-court",
  balogun_market: "market-hall",
  city_library: "library",
  lagoon_city_university: "senate",
  ring_kings_boxing: "boxing-club",
  city_fm: "radio-station",
  general_hospital: "hospital",
  lampnet_academy: "school",
  lagoon_capital_bank: "bank-lagoon-capital",
  grand_lagoon_hotel: "hotel",
  royal_event_centre: "event-centre",
  tailors_row: "tailor-shop",
  viewing_centre: "viewing-centre",
  mallam_suya: "suya-stand",
  sandbar_beach: "beach-bar",
  mowe_estate_office: "peace-estate",
  sagamu_junction: "motor-park",
  olumo_rock: "olumo-rock",
  itoku_adire_market: "adire-pits",
  // Landmarks, placed late (see "Landmarks and Gadget Village" below). Keep each name in step with the venue's art in
  // packages/shared venues.ts (check-clearance.ts checks it).
  crown_arts_theatre: "arts-theatre",
  independence_square: "parade-square",
  liberty_arts_park: "arts-park",
  gadget_village: "commercial-block",
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
export const RUNWAY = { a0: -1300, a1: 1300, b: 3150, half: 70, taxiB: 2970, taxiHalf: 26, apron: { a0: -950, a1: 950, b0: 2740, b1: 2944 } };
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
  // Outer mainland: family compounds, bungalows and houses still going up, a few shops and a motor park on the main
  // street, cheap land.
  "Ikodu Town": {
    commercial: 0.22,
    forSale: 0.22,
    plotHalf: 54,
    shops: [["shop-house", 3], ["buka", 2], ["mechanic", 2], ["chemist", 1], ["suya-stand", 1], ["gadget-kiosk", 1], ["salon", 1]],
    homes: [["bungalow", 6], ["family-compound", 5], ["unfinished-building", 4], ["storey-house", 1]],
    civic: [["church", 2], ["mosque", 2], ["school", 1]],
    mainRoad: [["motor-park", 1], ["filling-station", 1]],
  },
  // Ogun State: quieter and greener than Lagos, cheap land. Mowe is new estates (bungalows, houses going up, most of
  // the land still for sale), Sagamu a busy junction town, Abeokuta an old town of family compounds and storey houses.
  Mowe: {
    commercial: 0.1,
    forSale: 0.55,
    plotHalf: 56,
    shops: [["shop-house", 3], ["chemist", 1], ["buka", 1], ["mechanic", 1], ["gadget-kiosk", 1]],
    homes: [["bungalow", 9], ["unfinished-building", 5], ["terrace-duplex", 2], ["family-compound", 1], ["storey-house", 1]],
    civic: [["church", 2], ["school", 1], ["mosque", 1]],
    mainRoad: [["filling-station", 1]],
  },
  Sagamu: {
    commercial: 0.32,
    forSale: 0.3,
    plotHalf: 52,
    shops: [["shop-house", 3], ["buka", 3], ["suya-stand", 2], ["mechanic", 2], ["market-stalls", 2], ["chemist", 1], ["gadget-kiosk", 1]],
    homes: [["bungalow", 4], ["family-compound", 4], ["unfinished-building", 3], ["storey-house", 2]],
    civic: [["mosque", 2], ["church", 2]],
    mainRoad: [["motor-park", 1], ["filling-station", 2]],
  },
  Abeokuta: {
    commercial: 0.2,
    forSale: 0.25,
    plotHalf: 54,
    shops: [["shop-house", 3], ["tailor-shop", 3], ["buka", 2], ["market-stalls", 2], ["chemist", 1], ["salon", 1], ["phone-shop", 1]],
    homes: [["family-compound", 5], ["bungalow", 4], ["storey-house", 3], ["colonial-block", 1], ["unfinished-building", 2]],
    civic: [["church", 2], ["mosque", 2], ["school", 1]],
    mainRoad: [["filling-station", 1]],
  },
};

/** The Junction 101 neighbourhood's front lines: both arterials' frontages and every quarter street. */
const J101_LINES: FrontLine[] = [
  A_ROAD(ZEBRA_AT + 40, STREET_LEN),
  // The west and south halves need their own ids, or their plots would repeat the east and north halves' ids.
  { ...A_ROAD(-STREET_LEN, -(ZEBRA_AT + 40)), id: "Aw" },
  B_ROAD(ZEBRA_AT + 40, STREET_LEN),
  { ...B_ROAD(-STREET_LEN, -(ZEBRA_AT + 40)), id: "Bs" },
  ...QUARTERS.flatMap(([sa, sb]) =>
    STREET_DEFS.map((d): FrontLine =>
      d.fixed === "u" ? st(`${d.id}${sa}${sb}`, "a", sa * d.at, sb * d.from, sb * d.to, d.cls) : st(`${d.id}${sa}${sb}`, "b", sb * d.at, sa * d.from, sa * d.to, d.cls),
    ),
  ),
];

/** Forest reserves on the open land between areas (drawn and planted further down); the city doesn't grow into them. */
const FOREST_RECTS = [
  { name: "Ikeja Forest Reserve", a0: -3100, a1: -1500, b0: 1550, b1: 3000 },
  { name: "Lagoon Forest", a0: 1600, a1: 3400, b0: 2850, b1: 4300 },
  { name: "Badagry Creek Forest", a0: -1500, a1: 300, b0: -4600, b1: -3450 },
];
const inForest = (x: number, y: number, hh: number) => {
  const p = toIso(x, y);
  return FOREST_RECTS.some((f) => p.a + hh > f.a0 && p.a - hh < f.a1 && p.b + hh > f.b0 && p.b - hh < f.b1);
};
/** On the map, with room for a tree's crown above its foot. */
const onMap = (x: number, y: number) => x > 30 && x < WORLD.w - 30 && y > 110 && y < WORLD.h - 30;
/** Well inside the map's edges, with room for a building's art above its plot (growth only). */
const inWorld = (x: number, y: number, hh = 0) => x - 2 * hh > 60 && x + 2 * hh < WORLD.w - 60 && y - hh - 210 > 0 && y + hh < WORLD.h - 60;

interface FillOpts {
  /** Lines that count as crossings (for corners); defaults to the lines being filled. */
  context?: FrontLine[];
  /** Share of plots kept as land for sale, instead of the area's. */
  forSale?: number;
  /** Plot half-side, instead of the area's (infill plots squeeze into the gaps left between bigger ones). */
  plotHalf?: number;
  /** Growth: plots must sit well inside the map. */
  growing?: boolean;
  /** Where a growing plot may stand (default: well inside Lagos's part of the map). */
  within?: (x: number, y: number, hh?: number) => boolean;
  /** What to build, instead of the area's own mix (a quarter inside an area, like Gadget Village). */
  preset?: AreaPreset;
}
/**
 * The area generator: plots on both sides of every front line, shops on busy frontages and corners, homes and
 * civic buildings behind, a share kept as land for sale. Seeded per plot id, so the same on every visit.
 */
function fillArea(area: string, lines: FrontLine[], opts: FillOpts = {}) {
  const { context = lines, forSale: forSaleShare, growing = false } = opts;
  const P = opts.preset ?? AREA_PRESETS[area]!;
  const slug = area.toLowerCase().replace(/\s+/g, "-");
  const houses: Building[] = [];
  const driveways: { x0: number; y0: number; x1: number; y1: number; key: string }[] = [];
  for (const l of lines) {
    const clear = l.cls === "arterial" ? HALF + PAVEMENT + 8 : STREET_CLASS[l.cls].half + STREET_CLASS[l.cls].pav + 6;
    const crossings = context.filter((o) => o.fixed !== l.fixed).map((o) => o.at);
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
        const half = opts.plotHalf ?? P.plotHalf;
        const hh = shop ? half - 4 : half;
        const off = l.at + side * (clear + hh + 2);
        const c = l.fixed === "b" ? iso(t, off) : iso(off, t);
        if ((growing && (!(opts.within ?? inWorld)(c.x, c.y, hh) || inForest(c.x, c.y, hh))) || !onSite(c.x, c.y, hh) || !claim(c.x, c.y, hh, 22)) continue;
        n++;
        t += hh * 2;
        const forSale = seeded(id + ":land") < (forSaleShare ?? P.forSale);
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
          driveways.push({ x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, key: id });
        }
      }
    }
  }
  return { houses, driveways };
}

const FILLED = [fillArea("Junction 101", J101_LINES), ...AREA_GRIDS.map((g) => fillArea(g.area, g.lines))];
/** The plots for sale before the city grew (these never move or go). */
const ORIGINAL_SALE = new Set(FOR_SALE.map((l) => l.id));

// ── Growth: the newer streets ──
// The city grows outwards after everything above is placed, so every older plot keeps its id (area + line + side +
// index) and its spot: the grids above are never edited, new streets get new line ids, and they are laid only where
// they keep off everything already built (a street stops short of the first plot in its way; a link between two
// streets is laid whole or not at all). Their plots are claimed after all the older ones, so they are appended to
// LAND and FOR_SALE in order.
type GrowLine = FrontLine & { whole?: boolean };
/** A link: a short street joining the end of one street to another, laid whole or not at all. */
const link = (id: string, fixed: "a" | "b", at: number, from: number, to: number, cls: StreetClass = "local"): GrowLine => ({ ...st(id, fixed, at, from, to, cls), whole: true });
/** Collectors every 600 along the Island road (Island Heights, then Lekki); the drives link their far ends. */
const ISLAND_COLLECTORS = [...range(2850, 4650, 600), ...range(5150, 10100, 600)];
/** The beach drive runs just inside the Island's south shore, south of the last row of plots. */
const BEACH_B = -3310;
/** The lagoon drive runs along the Island's north shore, behind the plots and landmarks on the Island road. */
const LAGOON_B = -2058;
/** The north collectors stop short of the lagoon drive: a link carries each one on to it. */
const LAGOON_STUB = -2180;
/** Drive pieces between consecutive collectors (each laid whole or not at all). */
const drive = (tag: string, b: number, ats: number[]) => ats.flatMap((a, i) => (i ? [link(`${tag}${i}`, "b", b, ats[i - 1]!, a)] : []));
const GROWTH: { area: string; forSale?: number; lines: GrowLine[] }[] = [
  {
    // Danfo Terminal grows west along Road A (which now runs on towards the edge of the map), in blocks between two
    // long locals, and south to meet Owambe Gardens' new streets.
    area: "Danfo Terminal",
    lines: [
      { ...A_ROAD(-3850, -2750), id: "Ax" },
      ...collectors("dtx", "a", [-2950, -3350], 0, [800, -800]),
      st("dtxc2s", "a", -3750, 0, -800, "collector", true),
      st("dtl0x", "b", 800, -2670, -3350, "local"),
      st("dtl1x", "b", -800, -2670, -3750, "local"),
      st("dtc0x", "a", -2050, -1340, -2600, "collector"),
      st("dtc1x", "a", -2500, -1340, -2300, "collector"),
      // Along the top: the north ends of the flyover street and both collectors, joined up
      link("dtl2x", "b", 1400, -1650, -2500),
      link("dtfsx", "a", -1650, -1340, -1750),
    ],
  },
  {
    // Owambe Gardens' collectors carry on west to Danfo Terminal's new streets, and a third runs back east from the
    // end of Danfo's, linked to Apapa Port's.
    area: "Owambe Gardens",
    lines: [
      st("owc0w", "b", -1750, -1340, -2500, "collector"),
      st("owc1w", "b", -2150, -1340, -2550, "collector"),
      st("owc2w", "b", -2550, -2050, -60, "collector"),
      link("owl0x", "a", -1200, -2550, -2900),
      link("owl1x", "a", -700, -2550, -2900),
    ],
  },
  {
    // Airport Ridge's collectors carry on east towards the lagoon forest, Tech Mile's run north to meet them, and the
    // west ends are joined up along the Ikeja forest.
    area: "Airport Ridge",
    lines: [
      ...[1750, 2200, 2650].map((b, i) => st(`arc${i}x`, "b", b, 1340, 2700, "collector")),
      st("tmc0x", "a", 1650, 1420, 2650, "local"),
      st("tmc1x", "a", 2050, 1420, 2650, "local"),
      link("arl2x", "a", 2700, 1750, 2650),
      link("arl3x", "a", -1400, 1750, 2650),
    ],
  },
  {
    // Tech Mile's locals meet at their east ends.
    area: "Tech Mile",
    lines: [link("tml3x", "a", 2290, 800, 1250)],
  },
  {
    // Marina Wharf's north collectors carry on to the lagoon drive too.
    area: "Marina Wharf",
    lines: [...drive("mwnd", LAGOON_B, [1850, 2200, 2850]), ...[1850, 2200].map((a, i) => link(`mwc${i}nx`, "a", a, LAGOON_STUB, LAGOON_B, "collector"))],
  },
  {
    // The lagoon drive along the Island's north shore links the far ends of Island Heights' and Lekki's north
    // collectors, and the beach drive along the south shore Lekki's south ones (Island Heights' landmarks stand on
    // the beach side, so its south collectors still end in turning circles).
    area: "Island Heights",
    lines: [
      ...drive("ihnd", LAGOON_B, ISLAND_COLLECTORS.slice(0, 4)),
      ...ISLAND_COLLECTORS.slice(0, 4).map((a, i) => link(`ihc${i}nx`, "a", a, LAGOON_STUB, LAGOON_B, "collector")),
    ],
  },
  {
    area: "Lekki Gardens",
    lines: [
      ...drive("lkbd", BEACH_B, ISLAND_COLLECTORS.slice(3)),
      ...drive("lknd", LAGOON_B, ISLAND_COLLECTORS.slice(3)),
      ...ISLAND_COLLECTORS.slice(4).map((a, i) => link(`lkc${i}nx`, "a", a, LAGOON_STUB, LAGOON_B, "collector")),
    ],
  },
];
/** Lays a growth street: it runs from its start until the land, the map's edge or something already built stops it. */
function growLine(l: GrowLine, within: (x: number, y: number) => boolean = inWorld): FrontLine | null {
  if (l.cls === "arterial") return l;
  const { half, pav } = STREET_CLASS[l.cls];
  const dir = Math.sign(l.to - l.from);
  const pt = (t: number) => (l.fixed === "a" ? iso(l.at, t) : iso(t, l.at));
  const blocked = (t: number) =>
    TAKEN.some((p) => {
      const [fixed, run] = l.fixed === "a" ? [p.a, p.b] : [p.b, p.a];
      return Math.abs(fixed - l.at) < p.hh + half + pav + 6 && Math.abs(run - t) < p.hh + half * 2.4 + 4;
    });
  const start = l.offRoad ? l.from + dir * (HALF - 4) : l.from;
  if (blocked(start)) return null;
  let end = start;
  let stopped = false;
  for (let t = start + dir * 20; dir > 0 ? t <= l.to : t >= l.to; t += dir * 20) {
    const p = pt(t);
    if (!onLand(p.x, p.y + 40) || !within(p.x, p.y)) {
      stopped = true;
      end -= dir * 60;
      break;
    }
    if ((stopped = blocked(t))) break;
    end = t;
  }
  if (l.whole) return stopped ? null : { id: l.id, fixed: l.fixed, at: l.at, from: l.from, to: l.to, cls: l.cls };
  return Math.abs(end - l.from) < 200 ? null : { id: l.id, fixed: l.fixed, at: l.at, from: l.from, to: end, cls: l.cls, offRoad: l.offRoad };
}
const GROWN_GRIDS = GROWTH.map((g) => ({ ...g, lines: g.lines.flatMap((l) => growLine(l) ?? []) }));
// From here on, everything keeps off the new streets too.
STREETS.push(...GROWN_GRIDS.flatMap((g) => g.lines.filter((l) => l.cls !== "arterial").map(streetOf)));
const contextOf = (area: string) => [...(area === "Junction 101" ? J101_LINES : (AREA_GRIDS.find((o) => o.area === area)?.lines ?? [])), ...GROWN_GRIDS.filter((g) => g.area === area).flatMap((g) => g.lines)];
const GROWN = [
  ...GROWN_GRIDS.map((g) => fillArea(g.area, g.lines, { context: contextOf(g.area), forSale: g.forSale, growing: true })),
  // Infill: smaller plots, all for sale, in the gaps the bigger plots left along Island Heights' and Lekki's streets
  // (each street again, under a new line id ending in "i").
  ...(["Island Heights", "Lekki Gardens"] as const).map((area) =>
    fillArea(
      area,
      [...AREA_GRIDS.find((g) => g.area === area)!.lines, ...GROWN_GRIDS.filter((g) => g.area === area).flatMap((g) => g.lines)].map((l) => ({ ...l, id: `${l.id}i` })),
      { context: contextOf(area), forSale: 1, plotHalf: 44, growing: true },
    ),
  ),
];

// ── Ikodu Town ──
// Laid after everything above (so every older plot keeps its id and number): Airport Ridge's top collector carries on
// east past the Lagoon Forest to the lagoon, with cross streets down to the water and up beside the forest.
const IKODU_LINES: GrowLine[] = [
  st("ikm", "b", 2650, 2700, 4100, "collector"),
  st("ikc0", "a", 3000, 2650, 1300, "local"),
  st("ikc1", "a", 3380, 2650, 1700, "local"),
  st("ikc2", "a", 3760, 2650, 3700, "local"),
  link("ikl0", "b", 2150, 3000, 3380),
  st("ikl1", "b", 3200, 3760, 4500, "local"),
  st("ikl2", "b", 3600, 3760, 4400, "local"),
  link("ikc3", "a", 4130, 3200, 3600),
];
const IKODU_GRID = IKODU_LINES.flatMap((l) => growLine(l) ?? []);
STREETS.push(...IKODU_GRID.map(streetOf));
GROWN.push(fillArea("Ikodu Town", IKODU_GRID, { growing: true }));

// ── Public transport: the ground it needs ──
// Laid after every plot (so no plot id moves) and before the street furniture and trees (so those keep off it). The
// Coast Line's track runs on its own corridor through the gaps between the plots: along the Lagoon Forest's edge north
// of Danfo Terminal, between Junction 101's north streets and Airport Ridge, past Tech Mile, then on its own bridge
// beside Third Mainland Bridge to the Island. Stations, piers and the line paths are built further down
// (TRANSIT_STOPS / TRANSIT_LINES, read by transitData.ts).
type IsoPt = readonly [number, number];
/** Problems found while laying transit (something already standing where it goes); check-clearance fails on any. */
export const TRANSIT_ISSUES: string[] = [];
/** Everything claimed before transit: the track, platforms and piers may sit side by side, never on these. */
const BEFORE_TRANSIT = TAKEN.length;
/** Claims a strip of iso squares (half-side `hh`) along a polyline, reporting anything already there. */
function claimStrip(name: string, pts: { x: number; y: number }[], hh: number) {
  const before = BEFORE_TRANSIT;
  for (let i = 1; i < pts.length; i++) {
    const [p, q] = [pts[i - 1]!, pts[i]!];
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / hh));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const c = { x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n };
      if (!landmassAt(c.x, c.y)) continue; // over water nothing can stand anyway
      const patch = patchAt(c.x, c.y, hh);
      const hit = TAKEN.slice(0, before).find((t) => overlaps(patch, t, 0));
      if (hit) TRANSIT_ISSUES.push(`${name} at ${c.x.toFixed(0)},${c.y.toFixed(0)} runs over something at iso ${hit.a.toFixed(0)},${hit.b.toFixed(0)}`);
      TAKEN.push(patch);
    }
  }
}
/** Claims an iso rectangle (a platform, a pier, a station's plot). */
function claimRect(name: string, a0: number, a1: number, b0: number, b1: number) {
  const pts: { x: number; y: number }[] = [];
  const hh = Math.min(Math.abs(a1 - a0), Math.abs(b1 - b0)) / 2;
  const [al, ah] = [Math.min(a0, a1) + hh, Math.max(a0, a1) - hh];
  const [bl, bh] = [Math.min(b0, b1) + hh, Math.max(b0, b1) - hh];
  for (let a = al; a <= ah + 0.1; a += Math.max(hh, (ah - al) / Math.ceil((ah - al) / hh || 1)))
    for (let b = bl; b <= bh + 0.1; b += Math.max(hh, (bh - bl) / Math.ceil((bh - bl) / hh || 1))) pts.push(iso(a, b));
  const before = BEFORE_TRANSIT;
  for (const c of pts) {
    const patch = patchAt(c.x, c.y, hh);
    const hit = TAKEN.slice(0, before).find((t) => overlaps(patch, t, 0));
    if (hit) TRANSIT_ISSUES.push(`${name} at ${c.x.toFixed(0)},${c.y.toFixed(0)} overlaps something at iso ${hit.a.toFixed(0)},${hit.b.toFixed(0)}`);
    TAKEN.push(patch);
  }
}

/** Half-width of the Coast Line's track bed (iso units). */
export const RAIL_HALF = 24;
/** The Coast Line in iso coordinates, from the City Rail Station's buffer stop to the Island. */
const RAIL_ISO: IsoPt[] = [
  [-2880, 1600],
  [-1560, 1600],
  [-1420, 1515],
  [-480, 1515],
  // under the Airport Ridge billboard, over Road B, and between the first plots either side of it
  [80, 1349],
  [300, 1349],
  [470, 1526],
  [2380, 1526],
  [2560, 1346],
  [2560, 360],
  [2560, -1995],
];
/** Where the rail bridge leaves the mainland and reaches the Island (iso b on the a = 2560 line). */
export const RAIL_BRIDGE = { a: 2560, b0: 360, b1: -1995 };
export const RAIL_PATH = RAIL_ISO.map(([a, b]) => iso(a, b));
/** Distance from a point to the Coast Line's track. */
export function railDistance(x: number, y: number) {
  let best = Infinity;
  for (let i = 1; i < RAIL_PATH.length; i++) {
    const [p, q] = [RAIL_PATH[i - 1]!, RAIL_PATH[i]!];
    const [dx, dy] = [q.x - p.x, q.y - p.y];
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x + dx * t - x, p.y + dy * t - y));
  }
  return best;
}
claimStrip("Coast Line track", RAIL_PATH, RAIL_HALF + 6);

/** Something transit puts on the map that stands up (a station, a pier, a parked train): drawn with the street furniture. */
interface TransitProp {
  art: string;
  x: number;
  y: number;
  key: string;
  w: number;
  behind: boolean;
}
const TRANSIT_ART_PROPS: TransitProp[] = [];
/** A transit building on an iso rectangle: claims the ground and stands its art on the rectangle's front corner. */
function transitBuilding(key: string, art: string, a0: number, a1: number, b0: number, b1: number, w: number) {
  claimRect(key, a0, a1, b0, b1);
  // The front (bottom) corner of the rectangle is at the larger a and the smaller b.
  const front = iso(Math.max(a0, a1), Math.min(b0, b1));
  const mid = iso((a0 + a1) / 2, (b0 + b1) / 2);
  TRANSIT_ART_PROPS.push({ art, x: mid.x, y: front.y, key, w, behind: false });
}

/** Rail stations: platform rectangle beside the track (iso), and where people stand to board. */
export interface RailStation {
  id: string;
  name: string;
  /** Platform as an iso rectangle. */
  platform: { a0: number; a1: number; b0: number; b1: number };
  stand: { x: number; y: number };
  terminus?: boolean;
}
const station = (id: string, name: string, a0: number, a1: number, b0: number, b1: number, stand: IsoPt, terminus = false): RailStation => ({
  id,
  name,
  platform: { a0, a1, b0, b1 },
  stand: iso(stand[0], stand[1]),
  terminus,
});
export const RAIL_STATIONS: RailStation[] = [
  // The terminus (an Iddo feel): the station hall south of the buffer stop, its platform along the track
  station("city-rail-station", "City Rail Station", -2880, -2600, 1546, 1570, [-2640, 1558], true),
  station("danfo-north-station", "Danfo North", -1990, -1810, 1630, 1656, [-1900, 1640]),
  station("j101-north-station", "Junction 101 North", -940, -760, 1460, 1484, [-850, 1474]),
  station("airport-ridge-station", "Airport Ridge Station", 630, 810, 1472, 1496, [720, 1486]),
  station("tech-mile-station", "Tech Mile Station", 1700, 1860, 1472, 1496, [1780, 1486]),
  // On piles at the Island end of the rail bridge; people come up from the lagoon drive
  station("marina-station", "Marina Wharf Station", 2486, 2530, -1990, -1830, [2560, -2027], true),
];
// The terminus yard: kept clear round the buffer stop and the waiting train
claimRect("city-rail-yard", -2920, -2560, 1570, 1700);
for (const s of RAIL_STATIONS) if (s.platform.b1 > 0) claimRect(`${s.id} platform`, s.platform.a0, s.platform.a1, s.platform.b0, s.platform.b1);
// Station buildings: the terminus hall, and a canopy at each stop
transitBuilding("city-rail-hall", "/art/transit/rail-terminus.svg", -2860, -2690, 1415, 1540, 270);
transitBuilding("danfo-north-canopy", "/art/buildings/rail-station.webp", -1975, -1825, 1660, 1716, 170);
transitBuilding("j101-north-canopy", "/art/buildings/rail-station.webp", -925, -775, 1400, 1456, 170);
transitBuilding("airport-ridge-canopy", "/art/buildings/rail-station.webp", 645, 795, 1412, 1468, 170);
transitBuilding("tech-mile-canopy", "/art/buildings/rail-station.webp", 1712, 1852, 1412, 1468, 160);
{
  // Marina Wharf's station stands over the water at the bridge end
  const c = iso(2508, -1880);
  TRANSIT_ART_PROPS.push({ art: "/art/buildings/rail-station.webp", x: c.x, y: c.y + 40, key: "marina-station-canopy", w: 150, behind: false });
}
// A train waiting at the terminus
{
  const c = iso(-2760, 1600);
  TRANSIT_ART_PROPS.push({ art: "/art/transit/train.svg", x: c.x, y: c.y + 26, key: "train-parked", w: 230, behind: true });
}

// ── Water bus piers ──
export interface Pier {
  id: string;
  name: string;
  /** Where people stand to board (on land). */
  stand: { x: number; y: number };
  /** Where the water bus ties up (on the water). */
  dock: { x: number; y: number };
}
/** A pier as ferry-jetty art with its foot at (x, y), claimed so nothing else stands there. */
function pierArt(key: string, x: number, y: number, w = 190) {
  const hh = w / 5;
  const patch = patchAt(x, y - hh, hh);
  const hit = TAKEN.slice(0, BEFORE_TRANSIT).find((t) => overlaps(patch, t, 0));
  if (hit) TRANSIT_ISSUES.push(`${key} at ${x.toFixed(0)},${y.toFixed(0)} overlaps something at iso ${hit.a.toFixed(0)},${hit.b.toFixed(0)}`);
  TAKEN.push(patch);
  TRANSIT_ART_PROPS.push({ art: "/art/buildings/ferry-jetty.webp", x, y, key, w, behind: false });
}
const drivePt = (a: number, off: number) => iso(a, LAGOON_B + off);
export const PIERS: Pier[] = (() => {
  const out: Pier[] = [];
  // Marina Wharf: the existing jetty is the hub
  out.push({ id: "marina-jetty", name: "Marina Jetty", stand: { x: JETTY.x, y: JETTY.y + 30 }, dock: { x: JETTY.x, y: JETTY.y - 205 } });
  // Sandbar Bay: on the spit's Marina side
  {
    // At the water's edge, so the jetty's piles stand in the sea
    const foot = iso(2035, -3868);
    pierArt("sandbar-pier-art", foot.x, foot.y, 170);
    out.push({ id: "sandbar-pier", name: "Sandbar Bay Pier", stand: iso(1990, -3935), dock: { x: foot.x + 20, y: foot.y - 190 } });
  }
  // Island Heights and Lekki: off the lagoon drive on the Island's north shore
  for (const [id, name, a] of [
    ["island-heights-jetty", "Island Heights Jetty", 3750],
    ["lekki-jetty", "Lekki Jetty", 7850],
  ] as const) {
    const kerb = drivePt(a, 0);
    const foot = { x: kerb.x, y: kerb.y - 60 };
    pierArt(`${id}-art`, foot.x, foot.y);
    out.push({ id, name, stand: { x: kerb.x, y: kerb.y - 31 }, dock: { x: foot.x, y: foot.y - 200 } });
  }
  // Ikodu Town: at the lagoon end of its main street (the water is in front here, so the jetty stands out over it)
  {
    const end = iso(3790, 2650);
    const foot = { x: end.x + 70, y: shoreY(end.x + 70) + 40 };
    TRANSIT_ART_PROPS.push({ art: "/art/buildings/ferry-jetty.webp", x: foot.x, y: foot.y, key: "ikodu-jetty-art", w: 190, behind: false });
    out.push({ id: "ikodu-jetty", name: "Ikodu Town Jetty", stand: end, dock: { x: foot.x + 30, y: foot.y + 110 } });
  }
  return out;
})();
// A water bus tied up at Marina
TRANSIT_ART_PROPS.push({ art: "/art/transit/water-bus.svg", x: JETTY.x + 150, y: JETTY.y - 170, key: "water-bus-moored", w: 150, behind: true });

// ── Ogun State ──
// Laid after every Lagos plot and Lagos's transit ground, so nothing in Lagos moves. First what the towns are built
// round (the Ogun line's track and Abeokuta's station, the border arch, Olumo Rock's high ground, the Kuto motor park),
// then each town's streets and plots (ids mowe-*, sagamu-*, abeokuta-*), appended to LAND and FOR_SALE after Ikodu's.
/** Well inside Ogun's part of the map (north of Lagos), with room for a building's art above its plot. */
const inOgun = (x: number, y: number, hh = 0) => x - 2 * hh > 60 && x + 2 * hh < WORLD.w - 60 && y - hh - 210 > WORLD.y0 + 40 && y + hh < -120;
/** Iso line of the Ogun line's track beside the expressway (south-east of it, behind the towns' south streets). */
const OGUN_RAIL_A = -3300;
/**
 * The Ogun line (a Lagos-Ibadan railway feel): out of the City Rail Station on the Coast Line's track, on past its old
 * buffer stop, round the corner north of Danfo Terminal and north-east beside the expressway to Abeokuta.
 */
const OGUN_RAIL_ISO: IsoPt[] = [
  [-2600, 1600],
  [-2880, 1600],
  [-3180, 1600],
  [OGUN_RAIL_A, 1720],
  [OGUN_RAIL_A, 7660],
];
export const OGUN_RAIL_PATH = OGUN_RAIL_ISO.map(([a, b]) => iso(a, b));
claimStrip("Ogun line track", OGUN_RAIL_PATH.slice(1), RAIL_HALF + 6);
/** Distance from a point to either railway's track. */
export function anyRailDistance(x: number, y: number) {
  let best = railDistance(x, y);
  for (let i = 1; i < OGUN_RAIL_PATH.length; i++) {
    const [p, q] = [OGUN_RAIL_PATH[i - 1]!, OGUN_RAIL_PATH[i]!];
    const [dx, dy] = [q.x - p.x, q.y - p.y];
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x + dx * t - x, p.y + dy * t - y));
  }
  return best;
}
/** Abeokuta's station: the platform on the town side of the track, the station hall behind it, a train waiting. */
export const OGUN_RAIL_STATIONS: RailStation[] = [station("abeokuta-station", "Abeokuta Station", -3356, -3332, 7420, 7600, [-3374, 7510], true)];
claimRect("abeokuta-station platform", -3356, -3332, 7420, 7600);
transitBuilding("abeokuta-station-hall", "/art/transit/rail-terminus.svg", -3550, -3392, 7425, 7595, 250);
{
  const c = iso(OGUN_RAIL_A, 7520);
  TRANSIT_ART_PROPS.push({ art: "/art/transit/train.svg", x: c.x, y: c.y + 26, key: "train-abeokuta", w: 230, behind: true });
}
// The state border: an arch over the expressway (its legs on the verges), with the toll booths just past it.
{
  const c = iso(OGUN_A, OGUN_B.border);
  // The art's right leg stands 140 down-right of the centre line, 10 above the image's bottom
  TRANSIT_ART_PROPS.push({ art: "/art/transit/ogun-border-arch.svg", x: c.x, y: c.y + 150, key: "ogun-border-arch", w: 340, behind: false });
  for (const da of [-140, 140]) {
    const p = iso(OGUN_A + da, OGUN_B.border);
    TAKEN.push(patchAt(p.x, p.y, 16));
  }
}
/** Olumo Rock's high ground north of Abeokuta (iso centre and radii): the hill is drawn under the rock (TransitLayer). */
export const OLUMO_HILL = { a: -5300, b: 7720, ra: 410, rb: 360 };
for (let a = OLUMO_HILL.a - OLUMO_HILL.ra + 40; a <= OLUMO_HILL.a + OLUMO_HILL.ra - 40; a += 60)
  for (let b = OLUMO_HILL.b - OLUMO_HILL.rb + 40; b <= OLUMO_HILL.b + OLUMO_HILL.rb - 40; b += 60) {
    const c = iso(a, b);
    TAKEN.push(patchAt(c.x, c.y, 30));
  }
/** Ogun's own buildings that aren't plots (a town's landmark that every visit shows the same). */
const OGUN_FIXED: Building[] = [];
const ogunFixed = (key: string, art: string, a: number, b: number, scale = 1) => {
  const c = iso(a, b);
  if (claim(c.x, c.y, siteOf(scale).hh)) OGUN_FIXED.push({ art: `/art/buildings/${art}.webp`, ...footAt(a, b, scale), key, scale });
  else TRANSIT_ISSUES.push(`${key} has no room at iso ${a},${b}`);
};
// Kuto-style motor park at the end of the expressway in Abeokuta, where the coach from Lagos stops
ogunFixed("abeokuta-kuto-park", "motor-park", -4136, 9000);

/** Frontage along the expressway, and along the Sagamu road. */
const EXPRESS = (from: number, to: number): FrontLine => ({ id: "E", fixed: "a", at: OGUN_A, from, to, cls: "arterial" });
const SAGAMU_ROAD = (from: number, to: number): FrontLine => ({ id: "S", fixed: "b", at: OGUN_B.sagamu, from, to, cls: "arterial" });
const OGUN_AREAS: { area: string; lines: GrowLine[] }[] = [
  {
    // Mowe: estate roads north of the expressway behind the estate gate, joined across and round the back; two
    // shorter roads to the south.
    area: "Mowe",
    lines: [
      EXPRESS(OGUN_B.moweFrom + 50, OGUN_B.moweTo - 50),
      ...[2450, 3000, 3550].map((b, i) => st(`moc${i}n`, "b", b, OGUN_A, -5450, "collector", true)),
      link("mol0", "a", -4900, 2450, 3550),
      link("mol1", "a", -5450, 2450, 3550),
      ...[2650, 3350].map((b, i) => st(`moc${i}s`, "b", b, OGUN_A, -3500, "collector", true)),
      link("mol2", "a", -3560, 2650, 3350),
    ],
  },
  {
    // Sagamu: the interchange, with streets off the Sagamu road either side of the expressway.
    area: "Sagamu",
    lines: [
      EXPRESS(OGUN_B.sagamuFrom + 50, OGUN_B.sagamuTo - 50),
      SAGAMU_ROAD(-5700, -3100),
      ...[-4950, -3700].flatMap((a, i) => [st(`sgc${i}n`, "a", a, OGUN_B.sagamu, OGUN_B.sagamuTo - 50, "collector", true), st(`sgc${i}s`, "a", a, OGUN_B.sagamu, OGUN_B.sagamuFrom + 50, "collector", true)]),
    ],
  },
  {
    // Abeokuta: town streets both sides of the expressway; Olumo Rock's hill between the north ones, the station
    // between the south ones.
    area: "Abeokuta",
    lines: [
      EXPRESS(OGUN_B.abeokutaFrom + 50, OGUN_B.abeokutaTo),
      ...[7050, 8350].map((b, i) => st(`abc${i}n`, "b", b, OGUN_A, -5850, "collector", true)),
      st("abc2n", "b", 8950, OGUN_A, -5300, "collector", true),
      link("abl0", "a", -5850, 7050, 8350),
      link("abl1", "a", -4850, 8350, 8950),
      ...[7100, 7750, 8350].map((b, i) => st(`abc${i}s`, "b", b, OGUN_A, -3480, "collector", true)),
      st("abc3s", "b", 8800, OGUN_A, -3600, "collector", true),
      link("abl2", "a", -3900, 7100, 8800),
    ],
  },
];
const OGUN_GRIDS = OGUN_AREAS.map((g) => ({ ...g, lines: g.lines.flatMap((l) => growLine(l, inOgun) ?? []) }));
STREETS.push(...OGUN_GRIDS.flatMap((g) => g.lines.filter((l) => l.cls !== "arterial").map(streetOf)));
GROWN.push(...OGUN_GRIDS.map((g) => fillArea(g.area, g.lines, { growing: true, within: inOgun })), { houses: OGUN_FIXED, driveways: [] });

/** Buildings of the city before it grew. */
const ORIGINAL_HOUSES = FILLED.flatMap((f) => f.houses);
/** Their order back to front as it was then (starter rooms and branch names follow it, whatever changes below). */
const ORIGINAL_ORDER = new Map([...DISTRICT_SCENERY, ...ORIGINAL_HOUSES].sort((a, b) => a.y - b.y).map((b, i) => [b.key, i]));

// ── Art: what each sprite hides ──
// Plots never overlap on the ground, but the art stands up from them: a tall building can hide most of the one behind
// it. Each sprite is modelled by its silhouette (not its image rectangle; the art is cut out on a transparent ground):
// a building is its footprint diamond extruded up to the top of its image, a tree its crown, a sign its board. The
// pass below keeps every building from hiding more than MAX_COVER of another (scripts/audit-layout.ts checks it).
/** Height / width of each building's art, as in artSizes.ts (check-clearance keeps the two in step). */
export const ART_ASPECT: Record<string, number> = {
  "airport-terminal": 0.75, atm: 0.85, "bank-crown-savings": 0.9, "bank-eko-trust": 0.94, "bank-lagoon-capital": 1.08, barbershop: 0.96, buka: 0.94,
  bungalow: 0.83, "bus-terminal": 0.67, "car-showroom": 0.8, chemist: 0.89, church: 0.92, clinic: 0.8, "colonial-block": 1.01, "commercial-block": 0.91,
  "container-port": 0.92, "control-tower": 1.2, "crazy-house": 0.81, "cyber-cafe": 0.87, "estate-gate": 0.75, "event-centre": 0.94, "face-me-block": 0.8,
  "family-compound": 0.72, "ferry-jetty": 0.77, "filling-station": 0.8, "gadget-kiosk": 1.13, "golf-club": 0.72, gym: 0.89, "high-court": 0.87,
  hospital: 0.89, hotel: 1, "laptop-shop": 0.89, library: 0.92, mall: 0.89, "market-hall": 0.8, mechanic: 0.86, "mixed-use-block": 0.91, mosque: 1.24,
  "motor-park": 0.72, "office-tower": 1.23, "phone-shop": 0.96, "police-station": 0.9, "polytechnic-gate": 0.84, "radio-station": 1.33,
  "residential-block": 0.88, "residential-tower": 1.06, "restaurant-terrace": 0.88, salon: 1.11, school: 0.79, "shop-house": 0.99, "skyline-lounge": 0.83,
  snooker: 0.89, stadium: 0.75, "storey-house": 1.21, "suya-stand": 1.02, "tailor-shop": 0.98, "tech-hub": 1, "terrace-duplex": 0.82, university: 0.87, "campus-quad": 0.86, "market-stalls": 0.74,
  "unfinished-building": 0.99, "viewing-centre": 0.94, villa: 0.78, warehouse: 0.77,
  "adire-pits": 0.8, "beach-bar": 0.97, "beach-cabanas": 0.71, "boxing-club": 0.92, "brt-station": 0.79, "peace-estate": 0.79, "rail-station": 1.01, senate: 0.87,
  // Landmarks (public/art/landmarks)
  "olumo-rock": 1.5, "arts-theatre": 0.69, "parade-square": 0.72, "arts-park": 0.75, palace: 0.68,
};
export type Pt = [number, number];
const artName = (art: string) => art.split("/").pop()!.replace(/\.(webp|svg)$/, "");
/** Silhouette and footprint of building art `BASE * scale` wide with its foot at (x, y) (`h`: drawn height, if not the art's own). */
export function buildingShape(art: string, x: number, y: number, scale: number, h?: number) {
  const w = BASE * scale;
  const height = h ?? w * (ART_ASPECT[artName(art)] ?? 0.94);
  const inset = w * 0.06;
  const [l, r] = [x - w / 2 + inset, x + w / 2 - inset];
  const bottom = y + w / 12 - inset / 2;
  const top = y + w / 12 - height + inset;
  const q = (r - l) / 4;
  const foot: Pt[] = [[x, bottom], [r, bottom - q], [x, bottom - 2 * q], [l, bottom - q]];
  const wall = Math.min(bottom - q, top + q);
  const poly: Pt[] = [[x, bottom], [r, bottom - q], [r, wall], [x, top], [l, wall], [l, bottom - q]];
  return { poly, foot };
}
/** An image box `w` × `h` standing on (x, y), inset by `inset` of its size for the transparent margin. */
export function boxShape(x: number, y: number, w: number, h: number, inset = 0.2): Pt[] {
  const [dx, dy] = [(w * inset) / 2, (h * inset) / 2];
  return [[x - w / 2 + dx, y - h + dy], [x + w / 2 - dx, y - h + dy], [x + w / 2 - dx, y - dy / 2], [x - w / 2 + dx, y - dy / 2]];
}
/** Plants as CityMap draws them: art, drawn width and height / width (palms and bushes are vector symbols). */
export const PLANT_SIZE: Record<TreeKind, [number, number]> = {
  mango: [130, 640 / 542], almond: [140, 640 / 571], neem: [100, 640 / 436], leafy: [100, 640 / 436], plantain: [100, 640 / 597],
  hedge: [120, 640 / 752], bougainvillea: [120, 640 / 662], palm: [120, 170 / 120], bush: [72, 40 / 72],
};
export function treeShape(x: number, y: number, kind: TreeKind): Pt[] {
  const [w, k] = PLANT_SIZE[kind];
  const foot = kind === "bush" ? 4 : kind === "palm" ? 5 : 10;
  return boxShape(x, y + foot, w, w * k, kind === "palm" ? 0.45 : kind === "bush" ? 0.2 : 0.3);
}
/** The for-sale sign on an open plot, as CityMap draws it (82 × 89, left of the plot's centre). */
export const signShape = (l: { x: number; y: number; hh: number }): Pt[] => boxShape(l.x - l.hh * 0.6 + 1, l.y + l.hh * 0.25 + 2, 82, 89, 0.25);
export const polyArea = (p: Pt[]) => Math.abs(p.reduce((s, [x, y], i) => s + x * p[(i + 1) % p.length]![1] - p[(i + 1) % p.length]![0] * y, 0)) / 2;
/** Intersection of two convex polygons (Sutherland-Hodgman). */
function clipPoly(subject: Pt[], by: Pt[]): Pt[] {
  const sign = Math.sign(by.reduce((s, [x, y], i) => s + x * by[(i + 1) % by.length]![1] - by[(i + 1) % by.length]![0] * y, 0)) || 1;
  let out = subject;
  for (let i = 0; i < by.length && out.length; i++) {
    const [ax, ay] = by[i]!;
    const [bx, bY] = by[(i + 1) % by.length]!;
    const inside = ([x, y]: Pt) => sign * ((bx - ax) * (y - ay) - (bY - ay) * (x - ax)) >= 0;
    const cross = ([px, py]: Pt, [qx, qy]: Pt): Pt => {
      const [a1, b1] = [bY - ay, ax - bx];
      const [a2, b2] = [qy - py, px - qx];
      const [c1, c2] = [a1 * ax + b1 * ay, a2 * px + b2 * py];
      const d = a1 * b2 - a2 * b1;
      return [(b2 * c1 - b1 * c2) / d, (a1 * c2 - a2 * c1) / d];
    };
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const [cur, prev] = [input[k]!, input[(k + input.length - 1) % input.length]!];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur));
    }
  }
  return out;
}
export const overlapArea = (p: Pt[], q: Pt[]) => {
  const c = clipPoly(p, q);
  return c.length > 2 ? polyArea(c) : 0;
};
/** Share of `back` hidden by `front`. */
export const coverShare = (back: Pt[], front: Pt[]) => overlapArea(back, front) / polyArea(back);
export const inPoly = ([x, y]: Pt, p: Pt[]) => {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [p[i]!, p[j]!];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** Most of a building another building may hide (neighbours along a street overlap a little). */
export const MAX_COVER = 0.2;
/** Most of a building a tree in front of it may hide, and of a for-sale sign a building may hide. */
export const MAX_TREE_COVER = 0.3;
export const MAX_SIGN_COVER = 0.4;
const bounds = (p: Pt[]) => [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))] as const;
/** Things kept apart by the pass below, bucketed by x for quick neighbour lookups. */
class ShapeGrid<T extends { poly: Pt[] }> {
  private cells = new Map<number, T[]>();
  add(s: T) {
    const [x0, , x1] = bounds(s.poly);
    for (let i = Math.floor(x0 / 300); i <= Math.floor(x1 / 300); i++) (this.cells.get(i) ?? this.cells.set(i, []).get(i)!).push(s);
  }
  near(poly: Pt[]) {
    const [x0, y0, x1, y1] = bounds(poly);
    const out = new Set<T>();
    for (let i = Math.floor(x0 / 300); i <= Math.floor(x1 / 300); i++)
      for (const s of this.cells.get(i) ?? []) {
        const [a0, b0, a1, b1] = bounds(s.poly);
        if (a0 < x1 && x0 < a1 && b0 < y1 && y0 < b1) out.add(s);
      }
    return [...out];
  }
}

/** Venues placed by spot (not by district) and the art they are drawn with. */
const SPOT_VENUE_ART: Record<string, string> = { mama_nkechi_buka: "buka", sharp_cuts: "barbershop", junction_motor_park: "motor-park" };
/** Buildings that may not change: everyone's starter room (face-me blocks) and branches keep their art and key. */
const KEEP_ART = new Set(["face-me-block", "buka", "salon", "hotel", "school", "mosque", "church", "tailor-shop", "viewing-centre", "event-centre", "car-showroom", "skyline-lounge", "gym"]);
interface Shaped {
  name: string;
  /** "fixed": places, venues, landmarks; "house": an area building; "sign": an open plot's for-sale sign. */
  kind: "fixed" | "house" | "sign";
  fy: number;
  poly: Pt[];
  foot?: Pt[];
  house?: Building;
  /** Something drawn at a scale that may be made a little smaller (a building, landmark or venue). */
  sized?: { x: number; y: number; scale: number };
  plot?: LandPlot;
  /** Placed when the city grew (may be dropped to keep the art clear). */
  grown: boolean;
}
/** What the declutter pass changed, for the audit's report. */
export const DECLUTTER = { shrunk: [] as string[], dropped: [] as string[], cleared: [] as string[], left: [] as string[] };
const GROWN_HOUSES = new Set(GROWN.flatMap((f) => f.houses));
const ALL_HOUSES = [...ORIGINAL_HOUSES, ...GROWN_HOUSES];
const DROPPED = new Set<Building>();
const fixedShapes: Shaped[] = [
  ...PLACES.map((p) => ({ name: `place ${p.id}`, kind: "fixed" as const, fy: p.y + p.h - p.w / 12, grown: false, ...buildingShape(p.art, p.x + p.w / 2, p.y + p.h - p.w / 12, p.w / BASE, p.h) })),
  { name: "park", kind: "fixed", fy: PARK.y + PARK.h, grown: false, ...buildingShape("park", PARK.x + PARK.w / 2, PARK.y + PARK.h - PARK.w / 12, PARK.w / BASE, PARK.h) },
  ...VENUE_SPOTS.flatMap((v) => {
    const art = VENUE_ART[v.key] ?? SPOT_VENUE_ART[v.key];
    return art ? [{ name: `venue ${v.key}`, kind: "fixed" as const, fy: v.y, grown: false, sized: v, ...buildingShape(art, v.x, v.y, v.scale) }] : [];
  }),
  ...DISTRICT_SCENERY.map((b) => ({ name: `${b.key} ${artName(b.art)}`, kind: "fixed" as const, fy: b.y, grown: false, sized: b, ...buildingShape(b.art, b.x, b.y, b.scale) })),
];
/** Recomputes a fixed shape after its building was made smaller. */
const reshape = (f: Shaped) => {
  const v = VENUE_SPOTS.find((vv) => vv === f.sized);
  const art = v ? (VENUE_ART[v.key] ?? SPOT_VENUE_ART[v.key])! : (f.sized as Building).art;
  const x = f.sized!.x;
  Object.assign(f, { fy: f.sized!.y, ...buildingShape(art, x, f.sized!.y, f.sized!.scale) });
};
/** Scale each thing was first drawn at: nothing is made smaller than about two thirds of it. */
const FIRST_SCALE = new Map<object, number>();
const shapeOfHouse = (h: Building): Shaped => ({ name: `${h.key} ${artName(h.art)}`, kind: "house", fy: h.y, grown: GROWN_HOUSES.has(h), house: h, sized: h, ...buildingShape(h.art, h.x, h.y, h.scale) });
const removePlot = (id: string) => {
  for (const list of [LAND, FOR_SALE]) {
    const i = list.findIndex((l) => l.id === id);
    if (i >= 0) list.splice(i, 1);
  }
};
for (let round = 0; round < 8; round++) {
  const shapes: Shaped[] = [
    ...fixedShapes,
    ...ALL_HOUSES.filter((h) => !DROPPED.has(h)).map(shapeOfHouse),
    ...FOR_SALE.map((l) => ({ name: `land ${l.id}`, kind: "sign" as const, fy: l.y + l.hh * 0.25, poly: signShape(l), plot: l, grown: !ORIGINAL_SALE.has(l.id) })),
  ];
  const grid = new ShapeGrid<Shaped>();
  for (const s of shapes) grid.add(s);
  const touched = new Set<Shaped>();
  let changed = false;
  for (const p of shapes) {
    if (p.kind === "sign") continue;
    for (const q of grid.near(p.poly)) {
      // p is the building in front; q anything behind it.
      if (q === p || q.fy > p.fy || (q.fy === p.fy && q.name >= p.name) || touched.has(p) || touched.has(q)) continue;
      const cover = coverShare(q.poly, p.poly);
      if (cover <= (q.kind === "sign" ? MAX_SIGN_COVER : MAX_COVER)) continue;
      // Resolve: drop what the city grew first, then make the front building a little smaller, then clear the plot
      // behind (it stays a plot with its id, without the building), and only then leave it.
      let done = true;
      if (p.grown && p.house) {
        DROPPED.add(p.house);
        removePlot(p.house.key);
        DECLUTTER.dropped.push(p.name);
      } else if (q.grown && (q.house || q.plot)) {
        if (q.house) DROPPED.add(q.house);
        removePlot(q.house?.key ?? q.plot!.id);
        DECLUTTER.dropped.push(q.name);
      } else if (p.sized && p.sized.scale * 0.88 >= (FIRST_SCALE.get(p.sized) ?? FIRST_SCALE.set(p.sized, p.sized.scale).get(p.sized)!) * 0.68) {
        // Smaller on the same plot: the plot's centre stays put, the foot point moves up with the smaller art.
        const o = p.sized;
        const centre = o.y - siteOf(o.scale).lift;
        o.scale = Math.round(o.scale * 0.88 * 1000) / 1000;
        o.y = centre + siteOf(o.scale).lift;
        if (p.kind === "fixed") reshape(p);
        if (!DECLUTTER.shrunk.includes(p.name)) DECLUTTER.shrunk.push(p.name);
      } else if (q.kind === "house" && !KEEP_ART.has(artName(q.house!.art))) {
        DROPPED.add(q.house!);
        DECLUTTER.cleared.push(q.name);
      } else done = false;
      if (!done && !DECLUTTER.left.includes(`${p.name} / ${q.name}`)) DECLUTTER.left.push(`${p.name} / ${q.name}`);
      if (done) {
        touched.add(p).add(q);
        changed = true;
      }
    }
  }
  if (!changed) break;
}

const AREA_HOUSES = ALL_HOUSES.filter((h) => !DROPPED.has(h));
const DROPPED_KEYS = new Set([...DROPPED].filter((h) => GROWN_HOUSES.has(h)).map((h) => h.key));
export const DRIVEWAYS = [...FILLED, ...GROWN].flatMap((f) => f.driveways.filter((d) => !DROPPED_KEYS.has(d.key)));
/** Building silhouettes after the pass above: trees keep from hiding them. */
const BUILDING_SHAPES = new ShapeGrid<Shaped>();
for (const s of [...fixedShapes, ...AREA_HOUSES.map(shapeOfHouse)]) BUILDING_SHAPES.add(s);
/** A tree may stand here: not inside a building's footprint, and not hiding much of one from in front. */
const treeClear = (x: number, y: number, kind: TreeKind) => {
  const poly = treeShape(x, y, kind);
  return BUILDING_SHAPES.near(poly).every((b) => !inPoly([x, y], b.foot!) && (b.fy > y || coverShare(b.poly, poly) <= MAX_TREE_COVER));
};

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
  if (!onLand(x, y + hh) || (pole && (atCrossing(road, x) || railDistance(x, y) < 80))) return null;
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
    if (s.lit && !s.lit.some(([l, h]) => x >= l && x <= h)) continue;
    const north = i++ % 2 === 1;
    // On bridges the lamps stand on the parapet.
    const off = s.bridge ? HALF + 10 : BACK;
    // None at the Coast Line's level crossing
    if ((s.lit ? anyRailDistance : railDistance)(x, yOn(s, x) + (north ? -off : off)) < 80) continue;
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

// ── Airport and harbour life ──
/** Jets parked nose-in on the apron, boarding bridges between them, small planes at the end; ships, quay cranes and
 * tugboats along Apapa's waterfront. Drawn with the street furniture (they stand on claimed or open water). */
export const PORT_AND_PLANES: Prop[] = (() => {
  const out: Prop[] = [];
  const at = (a: number, b: number) => iso(a, b);
  const mid = (RUNWAY.apron.b0 + RUNWAY.apron.b1) / 2;
  for (const [i, a] of [-700, -250, 200, 650].entries()) {
    const c = at(a, mid + 10);
    out.push({ art: `/art/props/${i % 3 === 1 ? "jet-ne" : "jet-sw"}.webp`, x: c.x, y: c.y + 60, key: `jet-${i}`, w: 270, behind: false });
    const bridge = at(a + 200, RUNWAY.apron.b0 + 30);
    if (i < 3) out.push({ art: "/art/props/jet-bridge.webp", x: bridge.x, y: bridge.y + 30, key: `bridge-${i}`, w: 150, behind: false });
  }
  for (const [i, a] of [880, -900].entries()) {
    const c = at(a, mid);
    out.push({ art: "/art/props/plane-small.webp", x: c.x, y: c.y + 40, key: `plane-${i}`, w: 150, behind: false });
  }
  // Apapa's waterfront: ships moored off the quay, cranes on its edge, tugs in the harbour
  for (const [i, x] of [2150, 2700].entries()) out.push({ art: "/art/props/cargo-ship.webp", x, y: shoreY(x) + 210, key: `ship-${i}`, w: 360, behind: false });
  for (const [i, x] of [1950, 2250, 2550, 2850].entries()) out.push({ art: "/art/props/quay-crane.webp", x, y: shoreY(x) - 10, key: `crane-${i}`, w: 150, behind: true });
  for (const [i, x] of [2420, 3050].entries()) out.push({ art: "/art/props/tugboat.webp", x, y: shoreY(x) + 380, key: `tug-${i}`, w: 120, behind: false });
  return out;
})();

// ── Landmarks and Gadget Village ──
// Laid after everything above (every older plot, building, transit stop and stall keeps its place and id) and before
// the trees (which keep clear of them). Problems placing them go in LANDMARK_ISSUES; check-clearance fails on any.
//   Crown Arts Theatre: Owambe Gardens' north-east corner, between Junction 101's south streets and the frontage row.
//   Marina Wharf's civic strip, between Marina's last collector and Island Heights: Liberty Arts Park (its old prison
//   wall and stage) just off the Island road, its lawn and trees running down behind the bank, and Independence Square
//   filling the open ground towards the beach.
//   Gadget Village: a dense quarter north of the airport's runway, reached by a road through the Lagoon Forest from
//   Ikodu Town's top street (the plots on Airport Ridge's top collector leave no gap for a road north).
export const LANDMARK_ISSUES: string[] = [];
/** Adds a building drawn after the declutter pass: it must not hide, or be hidden by, more than MAX_COVER of anything. */
function lateShape(name: string, art: string, x: number, y: number, scale: number, strict: boolean) {
  const shape: Shaped = { name, kind: "fixed", fy: y, grown: false, ...buildingShape(art, x, y, scale) };
  for (const o of BUILDING_SHAPES.near(shape.poly)) {
    const [back, front] = o.fy <= shape.fy ? [o, shape] : [shape, o];
    const cover = coverShare(back.poly, front.poly);
    if (cover > MAX_COVER) {
      if (strict) LANDMARK_ISSUES.push(`${front.name} covers ${(cover * 100).toFixed(0)}% of ${back.name}`);
      return false;
    }
  }
  BUILDING_SHAPES.add(shape);
  return true;
}
/** A landmark venue on its own spot (iso centre a, b), drawn with its venue's art (VENUE_ART). */
function landmark(key: string, a: number, b: number, scale: number) {
  const c = iso(a, b);
  const hh = siteOf(scale).hh;
  if (!onSite(c.x, c.y, hh) || !claim(c.x, c.y, hh)) return void LANDMARK_ISSUES.push(`${key} has no room at iso ${a},${b}`);
  const foot = footAt(a, b, scale);
  lateShape(`venue ${key}`, VENUE_ART[key]!, foot.x, foot.y, scale, true);
  VENUE_SPOTS.push({ key, x: foot.x, y: foot.y, scale });
}
landmark("crown_arts_theatre", 700, -1447, 1.4);
landmark("liberty_arts_park", 2438, -2640, 1.07);
landmark("independence_square", 2510, -3215, 2.25);

/** Flat ground drawn under a landmark (Liberty Arts Park's lawn): people walk on it; nothing is built on it. */
export const LANDMARK_GROUNDS: { key: string; kind: "lawn" | "paving"; path: string }[] = [
  { key: "liberty-lawn", kind: "lawn", path: isoRect(2372, 2505, -3012, -2712) },
  { key: "liberty-lawn-east", kind: "lawn", path: isoRect(2505, 2650, -2836, -2698) },
];
/** Trees in Liberty Arts Park's lawn (planted with the other trees below). */
const LANDMARK_TREE_AT: [number, number, TreeKind][] = [
  [2560, -2730, "almond"],
  [2620, -2800, "palm"],
  [2400, -2735, "mango"],
  [2475, -2800, "neem"],
  [2400, -2870, "palm"],
  [2470, -2940, "almond"],
  [2405, -2985, "bougainvillea"],
];
const LANDMARK_TREES = LANDMARK_TREE_AT.flatMap(([a, b, kind], i) => {
  const c = iso(a, b);
  return treeClear(c.x, c.y, kind) && claim(c.x, c.y, kind === "bougainvillea" ? 28 : 16, 4) ? [{ ...c, kind, key: `liberty-${i}` }] : [];
});

/** Gadget Village builds phone shops, laptop shops and kiosks, close together (no buildings that are branches). */
const GADGET_PRESET: AreaPreset = {
  commercial: 0.92,
  forSale: 0.15,
  plotHalf: 42,
  shops: [["phone-shop", 5], ["laptop-shop", 4], ["gadget-kiosk", 4], ["cyber-cafe", 1], ["mixed-use-block", 1], ["commercial-block", 1]],
  homes: [["mixed-use-block", 2], ["commercial-block", 1], ["phone-shop", 1]],
};
/** Gadget Village's own venue (the plaza where you buy, haggle and repair), on the corner by the forest road. */
landmark("gadget_village", 1330, 3500, 1.2);
const GADGET_LINES: GrowLine[] = [
  // The forest road: from Ikodu Town's top street (beside its b = 3200 street) west through the Lagoon Forest
  link("gvr", "b", 3180, 3760, 1480, "collector"),
  // Gadget Village's streets: the east street up from the forest road, the main street and the back street west
  // from it, and short lanes between them
  st("gvc", "a", 1480, 3180, 3900, "collector"),
  st("gvm", "b", 3360, 1480, -300, "collector"),
  st("gvb", "b", 3720, 1480, 0, "local"),
  ...[1000, 550, 100].map((a, i) => link(`gvl${i}`, "a", a, 3360, 3720)),
];
const GADGET_GRID = GADGET_LINES.flatMap((l) => {
  const g = growLine(l);
  if (!g) LANDMARK_ISSUES.push(`Gadget Village street ${l.id} has no room`);
  return g ?? [];
});
STREETS.push(...GADGET_GRID.map(streetOf));
/** Gadget Village's quarter of Airport Ridge (where its name is drawn on the ground). */
export const GADGET_VILLAGE = { name: "Gadget Village", ...iso(650, 3560) };
const GADGET_FILL = fillArea(
  "Airport Ridge",
  GADGET_GRID.filter((l) => l.id !== "gvr"),
  { context: GADGET_GRID, growing: true, preset: GADGET_PRESET },
);
/** Its shops: each one kept only if its art keeps clear of everything drawn already. */
const GADGET_HOUSES = GADGET_FILL.houses.filter((h) => {
  const ok = lateShape(`${h.key} ${artName(h.art)}`, h.art, h.x, h.y, h.scale, false);
  if (!ok) removePlot(h.key);
  return ok;
});
/** Phone traders' stalls and kiosks on Gadget Village's pavements (kept off the corners and clear of the shops' art). */
const GADGET_STALLS: Prop[] = (() => {
  const out: Prop[] = [];
  const lines = GADGET_GRID.filter((l) => l.id !== "gvr" && l.cls !== "arterial");
  for (const l of lines) {
    const { half, pav } = STREET_CLASS[l.cls as StreetClass];
    const crossings = GADGET_GRID.filter((o) => o.fixed !== l.fixed).map((o) => o.at);
    const [lo, hi] = [Math.min(l.from, l.to), Math.max(l.from, l.to)];
    let k = 0;
    for (let t = lo + 70; t < hi - 50; t += 75)
      for (const side of [1, -1] as const) {
        if (crossings.some((c) => Math.abs(c - t) < 90) || seeded(`${l.id}:stall:${t}:${side}`) < 0.4) continue;
        const kiosk = seeded(`${l.id}:kiosk:${t}:${side}`) < 0.25;
        const [kind, w, aspect] = kiosk ? ["kiosk-container", 80, 0.98] : ["trader-phones", 66, 1.21];
        const off = l.at + side * (half + pav - 3);
        const c = l.fixed === "b" ? iso(t, off) : iso(off, t);
        const poly = boxShape(c.x, c.y, w, w * aspect);
        const clear = BUILDING_SHAPES.near(poly).every((b) => !inPoly([c.x, c.y], b.foot!) && (b.fy > c.y || coverShare(b.poly, poly) <= MAX_COVER));
        if (!clear || !onLand(c.x, c.y)) continue;
        const kerb = l.fixed === "b" ? iso(t, l.at) : iso(l.at, t);
        out.push({ art: `/art/props/${kind}.webp`, x: c.x, y: c.y, key: `gv-stall-${l.id}-${k++}`, w, behind: c.y < kerb.y });
      }
  }
  return out;
})();
PROPS.push(...GADGET_STALLS);

// ── The beaches: cabanas, the lifeguard tower and the horse men ──
// Sandbar Bay's open sand either side of the beach bar, and the Atlantic Beach strip along Lekki's shore (between the
// beach drive and the sea). Each stands only where its ground is free and on the sand.
const BEACH_W: Record<string, number> = { "beach-cabanas": 190, "lifeguard-tower": 90, "beach-horse": 100 };
function beachProp(kind: string, x: number, y: number, key: string, on: (x: number, y: number) => boolean): Prop | null {
  const w = BEACH_W[kind]!;
  const hh = w / 5;
  if (!on(x, y - hh) || !on(x, y + 2 * hh) || !landmassAt(x, y + hh) || !on(x - 2 * hh, y) || !on(x + 2 * hh, y) || !claim(x, y, hh, 8)) return null;
  const art = kind === "beach-cabanas" ? `/art/buildings/${kind}.webp` : `/art/props/${kind}.webp`;
  const poly = boxShape(x, y + hh, w, w * (kind === "beach-cabanas" ? 0.71 : kind === "lifeguard-tower" ? 1.12 : 0.86));
  if (!BUILDING_SHAPES.near(poly).every((b) => !inPoly([x, y + hh], b.foot!) && (b.fy > y + hh || coverShare(b.poly, poly) <= MAX_COVER))) return null;
  return { art, x, y: y + hh, key, w, behind: false };
}
/** The first spot near the one asked for (iso offsets tried in order) where the prop fits. */
function beachNear(kind: string, at: (da: number, db: number) => { x: number; y: number }, key: string, on: (x: number, y: number) => boolean) {
  for (const da of [0, 40, -40, 80, -80, 120, -120])
    for (const db of [0, 30, -30, 60, -60]) {
      const c = at(da, db);
      const p = beachProp(kind, c.x, c.y, key, on);
      if (p) return p;
    }
  return null;
}
const BEACH_PROPS: Prop[] = [
  // Sandbar Bay (iso a, b), either side of the beach bar at a 1880
  ...(
    [
      ["beach-cabanas", 1660, -4060],
      ["beach-cabanas", 2110, -4060],
      ["lifeguard-tower", 2330, -4040],
      ["beach-horse", 1460, -4030],
    ] as const
  ).map(([kind, a, b], i) => beachNear(kind, (da, db) => iso(a + da, b + db), `sandbar-${kind}-${i}`, (x, y) => inSandbar(x, y, 20))),
  // Atlantic Beach: along Lekki's shore, every 520 or so, between the beach drive and the sea
  ...range(7300, 12500, 520).map((x, i) => {
    const kind = (["beach-cabanas", "lifeguard-tower", "beach-cabanas", "beach-horse"] as const)[i % 4]!;
    return beachNear(kind, (da, db) => ({ x: x + da * 2, y: island(x + da * 2) + ISLAND_S - 120 - db / 3 }), `atlantic-${kind}-${i}`, (px, py) => landmassAt(px, py) === "island");
  }),
].filter((p): p is Prop => !!p);
PROPS.push(...BEACH_PROPS);

/** Palms along the Island road (Lekki feel) and trees around the districts. */
const EXTRA_TREES = [
  ...Array.from({ length: 22 }, (_, i) => 3900 + i * 260).flatMap((x, i) => {
    const y = island(x) + (i % 2 ? 150 : -150);
    return onIsland(x, y) && onMap(x, y) && treeClear(x, y, "palm") && claim(x, y, 16, 6) ? [{ x, y, kind: "palm" as TreeKind, key: `isle-${i}` }] : [];
  }),
  ...DISTRICTS.flatMap((d, i) =>
    [
      { x: d.x - 520, y: d.y - 260 },
      { x: d.x + 520, y: d.y + 280 },
      { x: d.x + 140, y: d.y - 420 },
    ]
      .filter((p) => onLand(p.x, p.y) && onMap(p.x, p.y) && treeClear(p.x, p.y, "almond") && claim(p.x, p.y, 16, 6))
      .map((p, j) => ({ ...p, kind: (i + j) % 2 ? ("palm" as TreeKind) : ("leafy" as TreeKind), key: `dt-${i}-${j}` })),
  ),
];
// ── Green: trees, bushes and grass ──
// Lagos ground is mostly laterite, with green where people plant it: almond and mango trees shading compounds,
// palms along the Island, hedges and lawns in the estates. Each area has its own share of green.
export type TreeKind = "leafy" | "palm" | "mango" | "almond" | "neem" | "plantain" | "bush" | "hedge" | "bougainvillea";
const GREEN_SHARE: Record<string, number> = { "Ikodu Town": 0.08, "Lekki Gardens": 0.6, "Island Heights": 0.32, "Airport Ridge": 0.3, "Owambe Gardens": 0.25, "Tech Mile": 0.15, "Marina Wharf": 0.1, "Danfo Terminal": 0.06, "Apapa Port": 0.04 };
const GREEN_AREAS: { name: string; a0: number; a1: number; b0: number; b1: number; green: number }[] = [
  { name: "j101", a0: -1400, a1: 1400, b0: -1400, b1: 1400, green: PRESETS.mainland.green },
  ...AREA_GRIDS.map((g) => {
    const as = g.lines.flatMap((l) => (l.fixed === "a" ? [l.at] : [l.from, l.to]));
    const bs = g.lines.flatMap((l) => (l.fixed === "b" ? [l.at] : [l.from, l.to]));
    return { name: g.area, a0: Math.min(...as) - 200, a1: Math.max(...as) + 200, b0: Math.min(...bs) - 200, b1: Math.max(...bs) + 200, green: GREEN_SHARE[g.area] ?? 0.15 };
  }),
  // The new streets on the mainland get their share of green too.
  ...GROWN_GRIDS.filter((g) => ["Danfo Terminal", "Owambe Gardens", "Airport Ridge"].includes(g.area) && g.lines.length).map((g) => {
    const ls = g.lines.filter((l) => l.cls !== "arterial");
    const as = ls.flatMap((l) => (l.fixed === "a" ? [l.at] : [l.from, l.to]));
    const bs = ls.flatMap((l) => (l.fixed === "b" ? [l.at] : [l.from, l.to]));
    return { name: `${g.area} new`, a0: Math.min(...as) - 150, a1: Math.max(...as) + 150, b0: Math.min(...bs) - 150, b1: Math.max(...bs) + 150, green: GREEN_SHARE[g.area] ?? 0.15 };
  }),
  // Ikodu Town: sandy, a little green (kept out of the forest's rectangle, which plants its own)
  { name: "Ikodu Town", a0: 2850, a1: 4300, b0: 1300, b1: 2800, green: GREEN_SHARE["Ikodu Town"]! },
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
      if (!onLand(c.x, c.y) || !onMap(c.x, c.y)) continue;
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
      if (treeClear(c.x, c.y, kind) && claim(c.x, c.y, hh, 4)) out.push({ ...c, kind, key });
    }
  return out;
});
// ── Forests ──
/** Forest reserves on the open land between areas: dark ground packed with trees. */
export const FORESTS = FOREST_RECTS.map((f) => ({ ...f, path: isoRect(f.a0, f.a1, f.b0, f.b1) }));
const FOREST_TREES = FORESTS.flatMap((f) => {
  const out: { x: number; y: number; kind: TreeKind; key: string }[] = [];
  for (let a = f.a0 + 40; a <= f.a1 - 40; a += 62)
    for (let b = f.b0 + 40; b <= f.b1 - 40; b += 62) {
      const key = `${f.name}:${a}:${b}`;
      if (seeded(key) > 0.86) continue;
      const c = iso(a + (seeded(key + "x") - 0.5) * 44, b + (seeded(key + "y") - 0.5) * 44);
      if (!onLand(c.x, c.y) || !onMap(c.x, c.y)) continue;
      const kind = pick<TreeKind>(seeded(key + "k"), [["almond", 3], ["mango", 3], ["neem", 3], ["palm", 2], ["plantain", 1], ["bush", 2], ["leafy", 1]]);
      if (treeClear(c.x, c.y, kind) && claim(c.x, c.y, kind === "bush" ? 10 : 13, 2)) out.push({ ...c, kind, key });
    }
  return out;
});

// Sandbar Bay: a row of palms along its Marina side, clear of the walk from the pier to the beach venue, and open
// sand either side of the venue (room for cabanas later).
const SANDBAR_PALMS = (
  [
    [1500, -3990],
    [1570, -3950],
    [1650, -3940],
    [1730, -3945],
    [2170, -3945],
    [2250, -3950],
    [2330, -3975],
    [2400, -4010],
  ] as const
).flatMap(([a, b], i) => {
  const c = iso(a, b);
  return inSandbar(c.x, c.y, 40) && treeClear(c.x, c.y, "palm") && claim(c.x, c.y, 16, 6) ? [{ ...c, kind: "palm" as TreeKind, key: `sandbar-${i}` }] : [];
});

// Ogun: thick bush either side of the expressway between the towns (it reads as leaving the city: dark forest floor
// like the Lagos reserves), open country with a scattering of trees behind, and some green in the towns. Sparse, and
// mostly low bush, so the map stays light.
const OGUN_BUSH: { name: string; a0: number; a1: number; b0: number; b1: number; density: number; floor: boolean; below?: number }[] = [
  { name: "Border Bush North", a0: -5700, a1: -4470, b0: 250, b1: 2080, density: 0.09, floor: true },
  { name: "Border Bush South", a0: -4140, a1: -3420, b0: 480, b1: 2080, density: 0.09, floor: true },
  { name: "Mowe-Sagamu Bush North", a0: -5800, a1: -4470, b0: 3800, b1: 4480, density: 0.07, floor: true },
  { name: "Mowe-Sagamu Bush South", a0: -4140, a1: -3420, b0: 3800, b1: 4480, density: 0.07, floor: true },
  { name: "Sagamu-Abeokuta Bush North", a0: -5800, a1: -4470, b0: 5920, b1: 6700, density: 0.07, floor: true },
  { name: "Sagamu-Abeokuta Bush South", a0: -4140, a1: -3420, b0: 5920, b1: 6700, density: 0.07, floor: true },
  { name: "Ogun Country", a0: -9400, a1: -6000, b0: 400, b1: 10600, density: 0.006, floor: false },
  { name: "Ogun Country East", a0: -3150, a1: -1950, b0: 3350, b1: 9800, density: 0.008, floor: false },
  { name: "River Country", a0: -5900, a1: -3420, b0: 9500, b1: 11600, density: 0.016, floor: false },
  // The Ikeja Forest Reserve's north end (its floor reaches past Lagos's old edge, where nothing was planted)
  { name: "Ikeja Forest Reserve North", a0: -3100, a1: -1500, b0: 1550, b1: 3000, density: 0.4, floor: false, below: 110 },
];
FORESTS.push(...OGUN_BUSH.filter((f) => f.floor).map(({ name, a0, a1, b0, b1 }) => ({ name, a0, a1, b0, b1, path: isoRect(a0, a1, b0, b1) })));
/** On the Ogun part of the map, with room for a tree's crown above its foot. */
const onOgunMap = (x: number, y: number, below = -60) => x > 30 && x < WORLD.w - 30 && y > WORLD.y0 + 110 && y < below;
const OGUN_TREES = [
  ...OGUN_BUSH.flatMap((f) => {
    const out: { x: number; y: number; kind: TreeKind; key: string }[] = [];
    for (let a = f.a0 + 40; a <= f.a1 - 40; a += 62)
      for (let b = f.b0 + 40; b <= f.b1 - 40; b += 62) {
        const key = `${f.name}:${a}:${b}`;
        if (seeded(key) > f.density) continue;
        const c = iso(a + (seeded(key + "x") - 0.5) * 44, b + (seeded(key + "y") - 0.5) * 44);
        if (!onLand(c.x, c.y) || !onOgunMap(c.x, c.y, f.below)) continue;
        const kind = pick<TreeKind>(seeded(key + "k"), f.below ? [["almond", 3], ["mango", 3], ["neem", 3], ["palm", 2], ["bush", 2]] : [["bush", 6], ["neem", 2], ["mango", 1], ["palm", 2], ["almond", 1], ["plantain", 1]]);
        if (treeClear(c.x, c.y, kind) && claim(c.x, c.y, kind === "bush" ? 10 : 13, 2)) out.push({ ...c, kind, key });
      }
    return out;
  }),
  // The towns: greener than Lagos (Mowe's estates have hedges and lawns)
  ...OGUN_GRIDS.flatMap((g) => {
    const ls = g.lines.filter((l) => l.cls !== "arterial");
    const as = ls.flatMap((l) => (l.fixed === "a" ? [l.at] : [l.from, l.to]));
    const bs = ls.flatMap((l) => (l.fixed === "b" ? [l.at] : [l.from, l.to]));
    const green = { Mowe: 0.15, Sagamu: 0.08, Abeokuta: 0.12 }[g.area] ?? 0.1;
    const out: { x: number; y: number; kind: TreeKind; key: string }[] = [];
    for (let a = Math.min(...as) - 150; a <= Math.max(...as) + 150; a += 85)
      for (let b = Math.min(...bs) - 150; b <= Math.max(...bs) + 150; b += 85) {
        const key = `${g.area}:${a}:${b}`;
        if (seeded(key) > green) continue;
        const c = iso(a + (seeded(key + "x") - 0.5) * 50, b + (seeded(key + "y") - 0.5) * 50);
        if (!onLand(c.x, c.y) || !onOgunMap(c.x, c.y)) continue;
        const kind = pick<TreeKind | "grass">(
          seeded(key + "k"),
          g.area === "Mowe"
            ? [["grass", 4], ["hedge", 2], ["bougainvillea", 1], ["palm", 2], ["almond", 1], ["mango", 1], ["bush", 1]]
            : [["grass", 3], ["bush", 1], ["almond", 2], ["mango", 2], ["neem", 2], ["plantain", 2], ["palm", 1]],
        );
        if (kind === "grass") {
          const p = patchAt(c.x, c.y, 26);
          if (groundClear(c.x, c.y, 26) && !TAKEN.some((q) => overlaps(p, q, 0))) GRASS.push({ x: c.x, y: c.y, r: 34 + seeded(key + "r") * 30, key });
          continue;
        }
        const hh = kind === "hedge" || kind === "bougainvillea" ? 28 : kind === "bush" ? 12 : 16;
        if (treeClear(c.x, c.y, kind) && claim(c.x, c.y, hh, 4)) out.push({ ...c, kind, key });
      }
    return out;
  }),
];

export const TREES = [...EXTRA_TREES, ...SCATTER, ...FOREST_TREES, ...SANDBAR_PALMS, ...OGUN_TREES, ...LANDMARK_TREES].sort((a, b) => a.y - b.y);

export const ALL_SCENERY: Building[] = [...DISTRICT_SCENERY.map((b) => ({ ...b, landmark: true })), ...AREA_HOUSES, ...GADGET_HOUSES].sort((a, b) => a.y - b.y);
/** The buildings that stood before the city grew, back to front as they were then. */
const ORIGINAL_SCENERY = ALL_SCENERY.filter((b) => ORIGINAL_ORDER.has(b.key)).sort((a, b) => ORIGINAL_ORDER.get(a.key)! - ORIGINAL_ORDER.get(b.key)!);

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
  ].filter((p) => p.x > WORLD.x0 + 60 && p.x < WORLD.w - 60 && p.y > WORLD.y0 + 60 && p.y < WORLD.h - 60 && !ROADS.some((o) => o !== r && !o.flyover && Math.hypot(o.x0 - p.x, o.y0 - p.y) < 90 || o !== r && !o.flyover && Math.hypot(o.x1 - p.x, o.y1 - p.y) < 90)),
);

/** Polygon for a road's asphalt band. */
export const bandPath = (s: Segment, half = HALF) =>
  `M${s.x0} ${s.y0 - half} L${s.x1} ${s.y1 - half} L${s.x1} ${s.y1 + half} L${s.x0} ${s.y0 + half}Z`;
export const kerbPath = (s: Segment, off: number) => `M${s.x0} ${s.y0 + off} L${s.x1} ${s.y1 + off}`;
export const centrePath = (s: Segment) => `M${s.x0} ${s.y0} L${s.x1} ${s.y1}`;

/** Distance from a point to a segment. */
const distTo = (l: Segment, p: { x: number; y: number }) => {
  const dx = l.x1 - l.x0;
  const dy = l.y1 - l.y0;
  const t = Math.max(0, Math.min(1, ((p.x - l.x0) * dx + (p.y - l.y0) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(l.x0 + dx * t - p.x, l.y0 + dy * t - p.y);
};
/** Street ends away from the main roads: turning circles sized to the street (alleys just stop). */
export const STREET_ENDS = STREETS.filter((s) => s.cls !== "alley")
  // A street that ends on another one (a T-junction) needs no turning circle.
  .filter((s) => !STREETS.some((o) => o !== s && distTo(o, s.end) < o.half))
  .map((s) => ({ ...s.end, key: s.id, half: s.half, pav: s.pav }));

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
    // Ogun: Road A carries on to the corner and turns north-east up the expressway; the Sagamu road crosses it.
    ...(() => {
      const ex = ROADS.find((r) => r.id === "expressway")!;
      const sg = ROADS.find((r) => r.id === "sagamu-road")!;
      const corner = { x: ex.x0, y: ex.y0 };
      const inC = { x: corner.x + R, y: corner.y + 0.5 * R };
      const outC = { x: corner.x + R, y: corner.y - 0.5 * R };
      return [
        { id: "expressway", kind: "road", d: `M${P(a.x0, a.y0)} L${P(inC.x, inC.y)} Q${P(corner.x, corner.y)} ${P(outC.x, outC.y)} L${P(ex.x1, ex.y1)}` },
        { id: "sagamu-road", kind: "road", d: `M${P(sg.x0, sg.y0)} L${P(sg.x1, sg.y1)}` },
      ] satisfies RoadPath[];
    })(),
  ];
})();

// ── The road network ──
// Every road, street and bridge as one graph, so rides drive along the roads and long walks follow the
// pavements, instead of cutting across plots. Nodes are segment ends, crossings, and where a street meets another
// road; built once, on first use.
type P = { x: number; y: number };
interface NetLine extends Segment {
  half: number;
  pav: number;
}
const ROAD_NET = (() => {
  let built: { nodes: P[]; links: { to: number; d: number }[][]; lines: NetLine[]; cuts: { t: number; node: number }[][] } | null = null;
  return () => {
    if (built) return built;
    const lines: NetLine[] = [
      ...ROADS.map((r) => ({ ...r, half: HALF, pav: PAVEMENT })),
      ...STREETS.map((s) => ({ ...s, half: s.half, pav: s.pav })),
    ];
    const nodes: P[] = [];
    const index = new Map<string, number>();
    const node = (p: P) => {
      const k = `${Math.round(p.x / 4)},${Math.round(p.y / 4)}`;
      if (!index.has(k)) {
        index.set(k, nodes.length);
        nodes.push({ x: p.x, y: p.y });
      }
      return index.get(k)!;
    };
    const at = (l: Segment, t: number): P => ({ x: l.x0 + (l.x1 - l.x0) * t, y: l.y0 + (l.y1 - l.y0) * t });
    const project = (l: Segment, p: P) => {
      const dx = l.x1 - l.x0;
      const dy = l.y1 - l.y0;
      const t = Math.max(0, Math.min(1, ((p.x - l.x0) * dx + (p.y - l.y0) * dy) / (dx * dx + dy * dy)));
      const q = at(l, t);
      return { t, q, d: Math.hypot(q.x - p.x, q.y - p.y) };
    };
    const ts: number[][] = lines.map(() => [0, 1]);
    const extra: [P, P][] = [];
    lines.forEach((a, i) => {
      lines.forEach((b, j) => {
        if (i >= j) return;
        // Proper crossing
        const d = (a.x1 - a.x0) * (b.y1 - b.y0) - (a.y1 - a.y0) * (b.x1 - b.x0);
        if (Math.abs(d) > 1e-6) {
          const u = ((b.x0 - a.x0) * (b.y1 - b.y0) - (b.y0 - a.y0) * (b.x1 - b.x0)) / d;
          const v = ((b.x0 - a.x0) * (a.y1 - a.y0) - (b.y0 - a.y0) * (a.x1 - a.x0)) / d;
          if (u > 0.001 && u < 0.999 && v > 0.001 && v < 0.999) {
            ts[i]!.push(u);
            ts[j]!.push(v);
          }
        }
      });
    });
    // A street that stops at (or just short of) another road joins it there.
    lines.forEach((a, i) => {
      for (const end of [{ x: a.x0, y: a.y0 }, { x: a.x1, y: a.y1 }]) {
        lines.forEach((b, j) => {
          if (i === j) return;
          const pr = project(b, end);
          if (pr.d < b.half + a.half + 40 && pr.d > 0.5) {
            ts[j]!.push(pr.t);
            extra.push([end, pr.q]);
          }
        });
      }
    });
    const links: { to: number; d: number }[][] = [];
    const link = (p: P, q: P) => {
      const a = node(p);
      const b = node(q);
      if (a === b) return;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      (links[a] ??= []).push({ to: b, d });
      (links[b] ??= []).push({ to: a, d });
    };
    const cuts = lines.map((l, i) => {
      const sorted = [...new Set(ts[i]!.map((t) => Math.round(t * 1e5) / 1e5))].sort((p, q) => p - q);
      for (let k = 1; k < sorted.length; k++) link(at(l, sorted[k - 1]!), at(l, sorted[k]!));
      return sorted.map((t) => ({ t, node: node(at(l, t)) }));
    });
    for (const [p, q] of extra) link(p, q);
    for (let i = 0; i < nodes.length; i++) links[i] ??= [];
    built = { nodes, links, lines, cuts };
    return built;
  };
})();

/**
 * A route along the roads from one point to another: onto the nearest road, along the network (bridges included)
 * and off at the nearest point to the destination. `pavement` keeps walkers on the kerb side instead of the lane.
 */
export function roadRoute(from: P, to: P, pavement = false): P[] | null {
  const net = ROAD_NET();
  const nearest = (p: P) => {
    let best = { line: -1, t: 0, q: p, d: Infinity };
    net.lines.forEach((l, i) => {
      const dx = l.x1 - l.x0;
      const dy = l.y1 - l.y0;
      const t = Math.max(0, Math.min(1, ((p.x - l.x0) * dx + (p.y - l.y0) * dy) / (dx * dx + dy * dy)));
      const q = { x: l.x0 + dx * t, y: l.y0 + dy * t };
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < best.d) best = { line: i, t, q, d };
    });
    return best;
  };
  const s = nearest(from);
  const e = nearest(to);
  if (s.line < 0 || e.line < 0) return null;
  // The two network nodes either side of a point on a line.
  const bracket = (n: typeof s) => {
    const c = net.cuts[n.line]!;
    let k = 1;
    while (k < c.length - 1 && c[k]!.t < n.t) k++;
    return [c[k - 1]!, c[k]!];
  };
  const len = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  for (const c of bracket(s)) dist.set(c.node, len(s.q, net.nodes[c.node]!));
  const goal = new Map(bracket(e).map((c) => [c.node, len(net.nodes[c.node]!, e.q)]));
  const done = new Set<number>();
  // Dijkstra (the network is a few hundred nodes)
  for (;;) {
    let cur = -1;
    let cd = Infinity;
    for (const [i, d] of dist) if (!done.has(i) && d < cd) [cur, cd] = [i, d];
    if (cur < 0) break;
    done.add(cur);
    for (const { to: nb, d } of net.links[cur]!) {
      if (cd + d < (dist.get(nb) ?? Infinity)) {
        dist.set(nb, cd + d);
        prev.set(nb, cur);
      }
    }
  }
  let end = -1;
  let ed = Infinity;
  for (const [n, d] of goal) if ((dist.get(n) ?? Infinity) + d < ed) [end, ed] = [n, (dist.get(n) ?? Infinity) + d];
  // Same stretch of road: just go along it
  const sameStretch = s.line === e.line && bracket(s)[0]!.node === bracket(e)[0]!.node;
  const path: P[] = [];
  if (!sameStretch) {
    if (end < 0 || !Number.isFinite(ed)) return null;
    for (let n: number | undefined = end; n !== undefined; n = prev.get(n)) path.unshift(net.nodes[n]!);
  }
  let pts = [s.q, ...path, e.q];
  // Junction 101 is a roundabout: go round the ring (anticlockwise, like the traffic) instead of over the fountain.
  pts = pts.flatMap((p, i) => {
    if (Math.hypot(p.x - CX, p.y - CY) > 20 || i === 0 || i === pts.length - 1) return [p];
    const ring = pavement ? { rx: ROUNDABOUT.rx + 46, ry: ROUNDABOUT.ry + 23 } : ROUNDABOUT.lane;
    const ang = (q: P) => Math.atan2((q.y - CY) / ring.ry, (q.x - CX) / ring.rx);
    const a0 = ang(pts[i - 1]!);
    const a1 = ang(pts[i + 1]!);
    const sweep = (((a0 - a1) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const n = Math.max(1, Math.ceil(sweep / (Math.PI / 6)));
    return Array.from({ length: n + 1 }, (_, k) => {
      const t = a0 - (sweep * k) / n;
      return { x: CX + ring.rx * Math.cos(t), y: CY + ring.ry * Math.sin(t) };
    });
  });
  if (pavement) {
    // Walk on the near-side pavement: shift each point down by its road's half-width plus half the pavement.
    const off = (p: P) => {
      const n = nearest(p);
      const l = net.lines[n.line]!;
      return { x: p.x, y: p.y + l.half + l.pav / 2 };
    };
    pts = pts.map((p) => (Math.hypot((p.x - CX) / 2, p.y - CY) < ROUNDABOUT.ry + 40 ? p : off(p)));
  }
  return [...pts, to];
}

// ── Branches ──
// Repeated buildings that already have a room inside (bukas, salons, hotels, churches…) are places too: each gets
// its own name and badge and opens the same room and activities as the original. Names are seeded by plot, so a
// branch keeps its name on every visit.
const BRANCH_OF: Record<string, string> = {
  buka: "mama_nkechi_buka",
  salon: "glory_hair_salon",
  hotel: "grand_lagoon_hotel",
  school: "lampnet_academy",
  mosque: "central_mosque",
  church: "grace_chapel",
  "tailor-shop": "tailors_row",
  "viewing-centre": "viewing_centre",
  "event-centre": "royal_event_centre",
  "car-showroom": "island_motors",
  "skyline-lounge": "skyline_lounge",
  gym: "fit_lagos",
};
const FIRST = ["Bisi", "Ngozi", "Tunde", "Chioma", "Emeka", "Funke", "Kemi", "Uche", "Sade", "Ifeoma", "Yemi", "Aisha", "Bola", "Femi", "Halima", "Nneka", "Segun", "Zainab", "Dayo", "Amaka"];
const BRANCH_NAMES: Record<string, string[]> = {
  mama_nkechi_buka: ["Mama {n}'s Buka", "Iya {n} Amala Spot", "{a} Mama Put", "{n}'s Kitchen", "Correct Taste Buka"],
  glory_hair_salon: ["{n}'s Hair Palace", "{a} Glam Salon", "Classic Touch Salon", "{n} Beauty Hub", "Queen {n} Braids"],
  grand_lagoon_hotel: ["{a} Suites", "Royal {n} Hotel", "Ocean Breeze Hotel", "{a} Guest House"],
  lampnet_academy: ["Lampnet Academy, {a}", "{a} Tech School", "Bright Minds School, {a}"],
  central_mosque: ["{a} Central Mosque", "Al-Noor Mosque, {a}", "{a} Juma'at Mosque"],
  grace_chapel: ["{a} Grace Chapel", "Living Faith Chapel, {a}", "Christ Light Church, {a}"],
  tailors_row: ["{n}'s Fashion House", "{a} Tailors", "Stitches by {n}", "{n} Couture"],
  viewing_centre: ["{a} Viewing Centre", "Goal Zone, {a}"],
  royal_event_centre: ["{a} Event Hall", "Grand {n} Event Centre"],
  island_motors: ["{a} Motors", "{n} Autos", "Prime Motors, {a}"],
  skyline_lounge: ["{a} Rooftop", "Cloud 9 Lounge"],
  fit_lagos: ["{a} Fitness", "Iron {n} Gym", "Body Shape Gym, {a}"],
};
/** Short area name for branch names ("Lekki", "Island", "Apapa"). */
const SHORT_AREA: Record<string, string> = {
  "Junction 101": "Junction",
  "Tech Mile": "Tech Mile",
  "Danfo Terminal": "Danfo",
  "Owambe Gardens": "Owambe",
  "Apapa Port": "Apapa",
  "Airport Ridge": "Airport",
  "Marina Wharf": "Marina",
  "Island Heights": "Island",
  "Lekki Gardens": "Lekki",
  "Ikodu Town": "Ikodu",
  Mowe: "Mowe",
  Sagamu: "Sagamu",
  Abeokuta: "Abeokuta",
};
export interface Branch {
  /** "<base venue>@<building>": the base venue's room, activities and once-a-day limits. */
  key: string;
  base: string;
  name: string;
  area: string;
  x: number;
  y: number;
  scale: number;
  art: string;
}
export const BRANCHES: Branch[] = (() => {
  const used = new Set<string>();
  const first = new Set(ORIGINAL_SCENERY.map((b) => b.key));
  // The newer areas' buildings come last, so no older branch's name changes.
  const inArea = (b: Building, n: string) => b.key.startsWith(`${n.toLowerCase().replace(/\s+/g, "-")}-`);
  const newer = (b: Building) => [...NEWER_AREAS].some((n) => inArea(b, n));
  const rest = ALL_SCENERY.filter((b) => !first.has(b.key));
  // Newer areas one after another, in the order they were added (so a later area never renames an earlier one's).
  return [...ORIGINAL_SCENERY, ...rest.filter((b) => !newer(b)), ...[...NEWER_AREAS].flatMap((n) => rest.filter((b) => inArea(b, n)))].flatMap((b) => {
    const kind = b.art.split("/").pop()!.replace(".webp", "");
    const base = BRANCH_OF[kind];
    if (!base) return [];
    // Buildings of the newer areas name themselves after their own area; older ones keep the area they had.
    const own = DISTRICTS.find((d) => NEWER_AREAS.has(d.name) && b.key.startsWith(`${d.name.toLowerCase().replace(/\s+/g, "-")}-`));
    const near = own ?? DISTRICTS.filter((d) => !NEWER_AREAS.has(d.name)).reduce((best, d) => (Math.hypot(d.x - b.x, d.y - b.y) < Math.hypot(best.x - b.x, best.y - b.y) ? d : best));
    const area = near.name;
    const templates = BRANCH_NAMES[base]!;
    // Pick a name that isn't taken yet (a few tries), so two branches don't share one.
    let name = "";
    for (let i = 0; i < 6 && (!name || used.has(name)); i++) {
      const r = seeded(`${b.key}:name:${i}`);
      const t = templates[Math.floor(r * templates.length)]!;
      name = t.replace("{n}", FIRST[Math.floor(seeded(`${b.key}:who:${i}`) * FIRST.length)]!).replace("{a}", SHORT_AREA[area] ?? area);
    }
    if (used.has(name)) name = `${name} ${used.size}`;
    used.add(name);
    return [{ key: `${base}@${b.key}`, base, name, area, x: b.x, y: b.y, scale: b.scale, art: b.art }];
  });
})();
export const BRANCH_BY_KEY: ReadonlyMap<string, Branch> = new Map(BRANCHES.map((b) => [b.key, b]));

// ── Starter homes ──
/** Everyone starts with a rented room in a face-me-I-face-you block; which block follows from their name. */
// Only the blocks that stood before the city grew, so everyone keeps the room they had.
export const STARTER_BLOCKS = ORIGINAL_SCENERY.filter((b) => b.art.endsWith("/face-me-block.webp"));
export const starterRoom = (nickname: string) => STARTER_BLOCKS[Math.floor(seeded(`room:${nickname.toLowerCase()}`) * STARTER_BLOCKS.length)] ?? STARTER_BLOCKS[0]!;

/** The pavement point in front of a place: the nearest street's kerb on the place's side (where you stand to go in). */
export function kerbsideOf(p: P): P {
  const net = ROAD_NET();
  let best = { q: p, d: Infinity, line: net.lines[0]! };
  for (const l of net.lines) {
    const dx = l.x1 - l.x0;
    const dy = l.y1 - l.y0;
    const t = Math.max(0, Math.min(1, ((p.x - l.x0) * dx + (p.y - l.y0) * dy) / (dx * dx + dy * dy)));
    const q = { x: l.x0 + dx * t, y: l.y0 + dy * t };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < best.d) best = { q, d, line: l };
  }
  const side = p.y >= best.q.y ? 1 : -1;
  return { x: best.q.x, y: best.q.y + side * (best.line.half + best.line.pav / 2) };
}

// ── Public transport: stops and lines (read by transitData.ts) ──
// Stop ids are permanent once shipped, like plot ids. Each line's path passes through its stops' halts in order;
// `stopAt[i]` is the index in the path where the vehicle stops for `stops[i]`. Lines run both ways.
const round = (p: P) => ({ x: Math.round(p.x), y: Math.round(p.y) });
const STOPS = new Map<string, TransitStop>();
const stop = (id: string, name: string, at: P, mode: TransitMode) => {
  const s = STOPS.get(id);
  if (s) {
    if (!s.modes.includes(mode)) s.modes.push(mode);
  } else STOPS.set(id, { id, name, ...round(at), modes: [mode] });
  return id;
};

/** A line built from its halts, joining each pair of halts with `leg` (the points after `from`, ending at `to`). */
function lineOf(key: string, name: string, mode: TransitMode, color: string, halts: { id: string; at: P }[], leg: (from: P, to: P) => P[]): TransitLine {
  const path: P[] = [halts[0]!.at];
  const stopAt = [0];
  for (let i = 1; i < halts.length; i++) {
    path.push(...leg(halts[i - 1]!.at, halts[i]!.at));
    stopAt.push(path.length - 1);
  }
  return { key, name, mode, color, stops: halts.map((h) => h.id), path: path.map(round), stopAt };
}

// BRT: the buses keep to the near-side lane (half a lane south of the centre line), round the roundabout at Junction 101.
const LANE = HALF / 2;
const onRing = (p: P) => Math.hypot((p.x - CX) / ROUNDABOUT.rx, (p.y - CY) / ROUNDABOUT.ry) < 1.2;
const byRoad = (from: P, to: P) => {
  const r = roadRoute(from, to) ?? [to];
  // roadRoute ends with the destination itself after its nearest road point: drop the repeat
  const pts = r.slice(1, -1).filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1]!.x, p.y - all[i - 1]!.y) > 1);
  return [...pts.map((p) => (onRing(p) ? p : { x: p.x, y: p.y + LANE })), { x: to.x, y: to.y + LANE }].filter(
    (p, i, all) => i === all.length - 1 || Math.hypot(p.x - to.x, p.y - to.y - LANE) > 1,
  );
};
const brtHalts = (defs: [string, string, IsoPt, IsoPt][], mode: TransitMode) =>
  defs.map(([id, name, halt, stand]) => ({ id: stop(id, name, iso(stand[0], stand[1]), mode), at: iso(halt[0], halt[1]) }));
const IB = ISLAND_B;
/** Junction 101's stop is on the south-east corner, where both BRT lines stop either side. */
const J101_STAND: IsoPt = [110, -80];
const BRT_A = lineOf(
  "brt-a",
  "BRT Road A: Danfo – Lekki",
  "brt",
  "#1f6fd1",
  brtHalts(
    [
      ["danfo-west", "Danfo West", [-3300, 0], [-3300, -77]],
      ["danfo-terminal", "Danfo Terminal", [-1900, 0], [-1900, -77]],
      ["junction-101", "Junction 101", [300, 0], J101_STAND],
      ["tech-mile", "Tech Mile", [1700, 0], [1700, -77]],
      ["island-heights", "Island Heights", [3400, IB], [3400, IB - 77]],
      ["lekki-gardens", "Lekki Gardens", [6400, IB], [6400, IB - 77]],
    ],
    "brt",
  ),
  byRoad,
);
const BRT_B = lineOf(
  "brt-b",
  "BRT Road B: Marina – Airport",
  "brt",
  "#3d8fe0",
  brtHalts(
    [
      ["marina-wharf", "Marina Wharf", [1650, IB], [1650, IB - 77]],
      ["apapa-gate", "Apapa Gate", [0, -2250], [77, -2250]],
      ["owambe-gardens", "Owambe Gardens", [0, -1650], [77, -1650]],
      ["junction-101", "Junction 101", [0, -300], J101_STAND],
      ["airport-ridge", "Airport Ridge", [0, 1700], [77, 1700]],
      ["airport-terminal", "Airport Terminal", [0, 2550], [77, 2550]],
    ],
    "brt",
  ),
  byRoad,
);

// Trains: along their own track, stopping beside each platform.
function railLine(key: string, name: string, color: string, track: P[], stations: RailStation[]): TransitLine {
  // Each station's halt is the point on the track nearest its platform; the path is the track with the halts put in.
  const len = (p: P, q: P) => Math.hypot(q.x - p.x, q.y - p.y);
  const project = (c: P) => {
    let best = { d: Infinity, t: 0, p: c };
    let run = 0;
    for (let i = 1; i < track.length; i++) {
      const [p, q] = [track[i - 1]!, track[i]!];
      const [dx, dy] = [q.x - p.x, q.y - p.y];
      const u = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / (dx * dx + dy * dy)));
      const at = { x: p.x + dx * u, y: p.y + dy * u };
      const d = len(at, c);
      if (d < best.d) best = { d, t: run + len(p, q) * u, p: at };
      run += len(p, q);
    }
    return best;
  };
  const cum = track.map((_, i) => track.slice(1, i + 1).reduce((s, q, k) => s + len(track[k]!, q), 0));
  const halts = stations.map((s) => {
    const pl = s.platform;
    const pr = project(iso((pl.a0 + pl.a1) / 2, (pl.b0 + pl.b1) / 2));
    return { id: stop(s.id, s.name, s.stand, "rail"), t: pr.t, at: pr.p };
  });
  const pts = [...track.map((p, i) => ({ t: cum[i]!, at: p, id: "" })), ...halts].sort((p, q) => p.t - q.t || (p.id ? 1 : -1));
  const first = pts.findIndex((p) => p.id === halts[0]!.id);
  const last = pts.findIndex((p) => p.id === halts[halts.length - 1]!.id);
  const used = pts.slice(first, last + 1).filter((p, i, all) => p.id || i === 0 || len(p.at, all[i - 1]!.at) > 1);
  return {
    key,
    name,
    mode: "rail" as const,
    color,
    stops: halts.map((h) => h.id),
    path: used.map((p) => round(p.at)),
    stopAt: halts.map((h) => used.findIndex((p) => p.id === h.id)),
  };
}
const RAIL_LINE = railLine("coast-line", "Coast Line", "#d9482b", RAIL_PATH, RAIL_STATIONS);
// The Ogun line: from the City Rail Station (the Coast Line's terminus) to Abeokuta.
const OGUN_RAIL = railLine("ogun-rail", "Ogun Line: Lagos – Abeokuta", "#8a3fb3", OGUN_RAIL_PATH, [RAIL_STATIONS[0]!, ...OGUN_RAIL_STATIONS]);

// Water bus: the hub at Marina's jetty; boats keep to the water (waypoints between the piers).
const pierHalt = (id: string) => {
  const p = PIERS.find((q) => q.id === id)!;
  return { id: stop(p.id, p.name, p.stand, "ferry"), at: p.dock };
};
const viaWater = (ways: Record<string, P[]>) => (from: P, to: P) => [...(ways[`${Math.round(from.x)},${Math.round(from.y)}`] ?? []), to];
const dockKey = (id: string) => {
  const d = PIERS.find((q) => q.id === id)!.dock;
  return `${Math.round(d.x)},${Math.round(d.y)}`;
};
const FERRY_EAST = lineOf(
  "ferry-lagoon",
  "Lagoon Water Bus: Marina – Ikodu",
  "ferry",
  "#14a3a3",
  ["marina-jetty", "island-heights-jetty", "lekki-jetty", "ikodu-jetty"].map(pierHalt),
  viaWater({
    [dockKey("marina-jetty")]: [{ x: 4700, y: 4120 }, { x: 5400, y: 4420 }, { x: 6100, y: 4800 }],
    [dockKey("island-heights-jetty")]: [{ x: 7300, y: 5300 }, { x: 8400, y: 5900 }, { x: 9600, y: 6520 }],
    [dockKey("lekki-jetty")]: [{ x: 10900, y: 6200 }, { x: 11200, y: 4800 }, { x: 11250, y: 3800 }],
  }),
);
const FERRY_SANDBAR = lineOf(
  "ferry-sandbar",
  "Sandbar Shuttle: Marina – Sandbar Bay",
  "ferry",
  "#22b8cf",
  ["marina-jetty", "sandbar-pier"].map(pierHalt),
  viaWater({
    [dockKey("marina-jetty")]: [{ x: 3950, y: 3800 }, { x: 3700, y: 3772 }, { x: 3450, y: 3870 }, { x: 3200, y: 4500 }, { x: 3150, y: 4900 }],
  }),
);

// Interstate coach: from the motor park in front of Danfo Terminal's bus station out along Road A and up the
// expressway: the state border, Mowe, the Sagamu interchange and Abeokuta's motor park.
const COACH = lineOf(
  "coach-ogun",
  "Interstate Coach: Danfo – Abeokuta",
  "coach",
  "#e07b1f",
  brtHalts(
    [
      ["interstate-motor-park", "Interstate Motor Park", [-2196, 0], [-2196, -77]],
      ["ogun-border", "Ogun State Border", [OGUN_A, OGUN_B.border + 280], [OGUN_A + 77, OGUN_B.border + 280]],
      ["mowe-park", "Mowe Park", [OGUN_A, 3250], [OGUN_A + 77, 3250]],
      ["sagamu-interchange", "Sagamu Interchange", [OGUN_A, 4880], [OGUN_A + 77, 4880]],
      ["abeokuta-motor-park", "Abeokuta Motor Park", [OGUN_A, 9000], [OGUN_A + 77, 9000]],
    ],
    "coach",
  ),
  byRoad,
);

export const TRANSIT_LINES_L: TransitLine[] = [BRT_A, BRT_B, RAIL_LINE, FERRY_EAST, FERRY_SANDBAR, COACH, OGUN_RAIL];
export const TRANSIT_STOPS_L: TransitStop[] = [...STOPS.values()];

// ── Transit on the street: BRT shelters, the coach bay sign, the road out to Ogun ──
for (const l of [BRT_A, BRT_B])
  l.stops.forEach((id, i) => {
    const s = STOPS.get(id)!;
    const halt = l.path[l.stopAt[i]!]!;
    // A shelter just behind the pavement where there's room (it shares the spot with nothing)
    const road = ROADS.filter((r) => !r.bridge && !r.flyover).reduce((b, r) => (Math.abs(halt.y - LANE - yOn(r, halt.x)) < Math.abs(halt.y - LANE - yOn(b, halt.x)) && halt.x >= Math.min(r.x0, r.x1) && halt.x <= Math.max(r.x0, r.x1) ? r : b));
    if (PROPS.some((p) => p.key === `brt-${id}`)) return;
    for (const dx of [0, 60, -60, 120, -120, 180, -180]) {
      const p = roadProp(road, s.x + dx, -1, "bus-stop", `brt-${id}`);
      if (p) {
        PROPS.push(p);
        break;
      }
    }
  });
// Coach shelters at the Ogun stops (the Interstate Motor Park has its bus station)
const EXPRESSWAY = ROADS.find((r) => r.id === "expressway")!;
for (const id of COACH.stops.slice(1)) {
  const s = STOPS.get(id)!;
  for (const dx of [0, 60, -60, 120, -120, 180, -180]) {
    const p = roadProp(EXPRESSWAY, s.x + dx, -1, "bus-stop", `coach-${id}`);
    if (p) {
      PROPS.push(p);
      break;
    }
  }
}
PROPS.push(...TRANSIT_ART_PROPS);
{
  // Road signs at the far ends: the expressway on to Ibadan, the Sagamu road east to Ijebu-Ode and Benin
  const x = iso(OGUN_A, OGUN_B.end - 60).x;
  PROPS.push({ art: "/art/transit/sign-ibadan.svg", x, y: yOn(EXPRESSWAY, x) + BACK, key: "sign-ibadan", w: 110, behind: false });
  const sg = ROADS.find((r) => r.id === "sagamu-road")!;
  const x2 = sg.x1 - 140;
  PROPS.push({ art: "/art/transit/sign-benin.svg", x: x2, y: yOn(sg, x2) - BACK, key: "sign-benin", w: 110, behind: true });
}
{
  // The road sign at Road A's north-west end, on the near kerb (where the road leaves for Ogun)
  const x = iso(-3860, 0).x;
  PROPS.push({ art: "/art/transit/sign-ogun.svg", x, y: yOn(ROAD_A, x) + BACK, key: "sign-ogun", w: 110, behind: false });
}
