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
export const OCEAN_PATH = `M-400 6300 C1200 6000 2600 5600 ${TIP + 100} ${island(TIP + 100) + ISLAND_S + 60} L${WORLD.w + 400} ${island(WORLD.w + 400) + ISLAND_S + 60} L${WORLD.w + 400} ${WORLD.h + 400} L-400 ${WORLD.h + 400}Z`;
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
const BRIDGE = ROADS.find((r) => r.bridge)!;
/** Where a person can stand: mainland, the Island, or the bridge deck. Null means water or off the map. */
export function landmassAt(x: number, y: number): Landmass | null {
  if (x < 0 || y < 0 || x > WORLD.w || y > WORLD.h) return null;
  if (x >= BRIDGE.x0 && x <= BRIDGE.x1 && Math.abs(y - yOn(BRIDGE, x)) < HALF + 14) return "bridge";
  if (y < shoreY(x) - 12) return "mainland";
  if (x > TIP + 120 && y > island(x) + ISLAND_N + 40 && y < island(x) + ISLAND_S - 10) return "island";
  return null;
}
/** Bridge ends, just onto dry land on each side. */
const BRIDGE_MAIN = { x: BRIDGE.x1 - 40, y: yOn(BRIDGE, BRIDGE.x1 - 40) };
const BRIDGE_ISLAND = { x: BRIDGE.x0 + 40, y: yOn(BRIDGE, BRIDGE.x0 + 40) };
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
  const leg = (a: { x: number; y: number }, b: { x: number; y: number }) => (clearLine(a, b) ? [b] : [JUNCTION, b]);
  const side = (m: Landmass) => (m === "bridge" ? "bridge" : m);
  if (side(start) === side(end) || start === "bridge" || end === "bridge") return leg(from, to);
  return start === "mainland" ? [...leg(from, BRIDGE_MAIN), BRIDGE_ISLAND, to] : [BRIDGE_ISLAND, BRIDGE_MAIN, ...leg(BRIDGE_MAIN, to)];
}

export const clearOfRoads = (x: number, y: number, gap = 160) =>
  ROADS.every((s) => x < Math.min(s.x0, s.x1) - 60 || x > Math.max(s.x0, s.x1) + 60 || Math.abs(y - yOn(s, x)) > gap);

export type Phase = 1 | 2 | 3 | 4;
export interface District {
  name: string;
  x: number;
  y: number;
  phase: Phase;
  buildings: string[];
  /** A landmark strip (the beach): a name on the ground, no district plate. */
  landmark?: boolean;
  /** Open now: what players can do there (shown instead of "Opens later"). */
  open?: string;
}

/** Districts beyond Junction 101, named for the game world, opening in later stages. */
export const DISTRICTS: District[] = [
  { name: "Tech Mile", x: CX + 1600, y: CY + 800, phase: 1, buildings: ["commercial-block", "mixed-use-block", "residential-block", "gadget-kiosk"] },
  { name: "Owambe Gardens", x: CX - 1600, y: CY + 800, phase: 1, open: "ARTISANS · OPEN NOW", buildings: ["bungalow", "tailor-shop", "mixed-use-block", "suya-stand"] },
  { name: "Danfo Terminal", x: CX - 1800, y: CY - 900, phase: 2, buildings: ["mixed-use-block", "buka", "bungalow", "suya-stand"] },
  { name: "Apapa Port", x: 1800, y: CY - 0.5 * (1800 - CX), phase: 2, buildings: ["commercial-block", "residential-block"] },
  { name: "Airport Ridge", x: CX + 1600, y: CY - 800, phase: 4, buildings: ["commercial-block", "mixed-use-block"] },
  { name: "Marina Wharf", x: 4300, y: island(4300), phase: 3, buildings: ["commercial-block", "mixed-use-block", "buka"] },
  { name: "Island Heights", x: 6100, y: island(6100), phase: 3, buildings: ["commercial-block", "residential-block", "commercial-block"] },
  { name: "Lekki Gardens", x: 7900, y: island(7900), phase: 4, buildings: ["bungalow", "residential-block", "bungalow"] },
  { name: "Atlantic Beach", x: 7000, y: island(7000) + ISLAND_S - 160, phase: 4, buildings: ["suya-stand"], landmark: true },
];

const OFFSETS = [
  { x: -320, y: -170 },
  { x: 320, y: -170 },
  { x: -320, y: 200 },
  { x: 320, y: 200 },
  { x: 0, y: -320 },
  { x: 0, y: 340 },
  { x: -560, y: 20 },
  { x: 560, y: 20 },
];
const free = (x: number, y: number) => onLand(x, y) && clearOfRoads(x, y);

const DISTRICT_SCENERY = DISTRICTS.flatMap((d) => {
  const spots = OFFSETS.map((o) => ({ x: d.x + o.x, y: d.y + o.y })).filter((p) => free(p.x, p.y));
  return d.buildings.slice(0, spots.length).map((art, i) => ({ art: `/art/buildings/${art}.webp`, x: spots[i]!.x, y: spots[i]!.y, key: `${d.name}-${i}` }));
});

/** Plots around the junction: players' shops fill them; the rest show as open plots. Clear of roads and places. */
export const PLOTS = [
  { x: CX - 520, y: CY - 120 },
  { x: CX + 520, y: CY - 150 },
  { x: CX + 560, y: CY + 430 },
  { x: CX + 250, y: CY - 420 },
  { x: CX - 250, y: CY + 470 },
  { x: CX + 250, y: CY + 470 },
  { x: CX - 520, y: CY + 170 },
  { x: CX + 520, y: CY + 150 },
  { x: CX, y: CY - 600 },
  { x: CX, y: CY + 620 },
];

/** World point from isometric road coordinates: a runs along Road A (down-right), b along Road B (up-right). */
const iso = (a: number, b: number) => ({ x: CX + a + b, y: CY + 0.5 * a - 0.5 * b });

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
    seg(`s1${sa}${sb}`, iso(0, sb * STREET_AT), iso(sa * STREET_LEN, sb * STREET_AT)),
    seg(`s2${sa}${sb}`, iso(sa * STREET_AT, 0), iso(sa * STREET_AT, sb * STREET_LEN)),
  ];
});

const clearOfStreets = (x: number, y: number, gap = 110) =>
  STREETS.every((s) => x < s.x0 - 40 || x > s.x1 + 40 || Math.abs(y - yOn(s, x)) > gap);
const awayFromJunction = (x: number, y: number) => Math.abs(x - CX) / 700 + Math.abs(y - CY) / 520 > 1;
const awayFromPlots = (x: number, y: number) => PLOTS.every((p) => Math.hypot(p.x - x, (p.y - y) * 1.6) > 260);
const buildable = (x: number, y: number) => free(x, y) && clearOfStreets(x, y) && awayFromJunction(x, y) && awayFromPlots(x, y);

const HOUSE_ART = ["bungalow", "residential-block", "bungalow", "mixed-use-block"];

/** Houses on both sides of every street, each with a driveway to the street; trees between them. */
const STREET_LOTS = (() => {
  const houses: { art: string; x: number; y: number; key: string }[] = [];
  const driveways: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const trees: { x: number; y: number; kind: "leafy" | "palm"; key: string }[] = [];
  let n = 0;
  for (const [sa, sb] of QUARTERS) {
    for (const which of [1, 2] as const) {
      for (let t = 280; t <= STREET_LEN - 120; t += 330) {
        for (const side of [1, -1] as const) {
          const off = side * 210;
          const along = (tt: number, o: number) => (which === 1 ? iso(sa * tt, sb * STREET_AT + o) : iso(sa * STREET_AT + o, sb * tt));
          const house = along(t, off);
          if (!buildable(house.x, house.y)) continue;
          houses.push({ art: `/art/buildings/${HOUSE_ART[n % HOUSE_ART.length]}.webp`, ...house, key: `house-${n}` });
          // Houses above the street on screen get a driveway from their door; houses below it have the
          // driveway beside them, so the building doesn't hide it.
          const farSide = (which === 1 ? off : -off) > 0;
          const dt = farSide ? 0 : 135;
          const from = along(t + dt, off);
          const to = along(t + dt, side * STREET_HALF);
          driveways.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y });
          const tree = along(t + 165, side * 250);
          if (buildable(tree.x, tree.y)) trees.push({ ...tree, kind: n % 3 === 0 ? "palm" : "leafy", key: `tree-${n}` });
          n++;
        }
      }
    }
  }
  return { houses, driveways, trees };
})();
export const DRIVEWAYS = STREET_LOTS.driveways;

/** Palms along the Island road (Lekki feel) and trees around the districts. */
const EXTRA_TREES = [
  ...Array.from({ length: 22 }, (_, i) => 3900 + i * 260).flatMap((x, i) => {
    const y = island(x) + (i % 2 ? 150 : -150);
    return onIsland(x, y) && clearOfRoads(x, y, 100) ? [{ x, y, kind: "palm" as const, key: `isle-${i}` }] : [];
  }),
  ...DISTRICTS.flatMap((d, i) =>
    [
      { x: d.x - 520, y: d.y - 260 },
      { x: d.x + 520, y: d.y + 280 },
      { x: d.x + 140, y: d.y - 420 },
    ]
      .filter((p) => free(p.x, p.y) && clearOfStreets(p.x, p.y))
      .map((p, j) => ({ ...p, kind: (i + j) % 2 ? ("palm" as const) : ("leafy" as const), key: `dt-${i}-${j}` })),
  ),
];
export const TREES = [...STREET_LOTS.trees, ...EXTRA_TREES].sort((a, b) => a.y - b.y);

export const ALL_SCENERY = [...DISTRICT_SCENERY.filter((d) => clearOfStreets(d.x, d.y)), ...STREET_LOTS.houses].sort((a, b) => a.y - b.y);

/** Bridge pillars: evenly spaced along the deck where it crosses water. */
export const PILLARS = (() => {
  const b = ROADS.find((r) => r.bridge)!;
  const out: { x: number; y: number }[] = [];
  for (let x = b.x0 + 120; x < b.x1 - 60; x += 160) {
    const y = yOn(b, x);
    if (!onLand(x, y + 40)) out.push({ x, y });
  }
  return out;
})();

/** Street lamps along every road, alternating kerbs, skipping the roundabout. */
export const LAMPS = ROADS.flatMap((s) => {
  const out: { x: number; y: number; key: string }[] = [];
  const [lo, hi] = [Math.min(s.x0, s.x1), Math.max(s.x0, s.x1)];
  let i = 0;
  for (let x = lo + 120; x < hi - 60; x += s.bridge ? 200 : 250) {
    if (Math.hypot(x - CX, yOn(s, x) - CY) < 180) continue;
    out.push({ x, y: yOn(s, x) + (i++ % 2 ? HALF + 14 : -HALF - 14), key: `${s.id}-${x}` });
  }
  return out;
});

/** Polygon for a road's asphalt band. */
export const bandPath = (s: Segment, half = HALF) =>
  `M${s.x0} ${s.y0 - half} L${s.x1} ${s.y1 - half} L${s.x1} ${s.y1 + half} L${s.x0} ${s.y0 + half}Z`;
export const kerbPath = (s: Segment, off: number) => `M${s.x0} ${s.y0 + off} L${s.x1} ${s.y1 + off}`;
export const centrePath = (s: Segment) => `M${s.x0} ${s.y0} L${s.x1} ${s.y1}`;

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
/** Width of the pavement (walkway) on each side of a main road. */
export const PAVEMENT = 34;
export const STREET_PAVEMENT = 16;

// Both legs stand behind the pavement: roads run diagonally, so check the road under each leg.
const LEG = 125;
export const BILLBOARD_SPOTS = BOARD_AT.map((b) => {
  const seg = ROADS.find((r) => r.id === b.road)!;
  const roadTop = Math.min(yOn(seg, b.x - LEG), yOn(seg, b.x + LEG)) - HALF - PAVEMENT;
  return { key: b.key, x: b.x, y: roadTop - 48 };
});
