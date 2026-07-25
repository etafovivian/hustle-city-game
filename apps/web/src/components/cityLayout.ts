// New Lagos layout, following docs/city-plan.md: Mainland in the north, the lagoon across the middle,
// Third Mainland Bridge down to the Island, the Atlantic in the south.
// Roads run on the 2:1 isometric axes (slope ±0.5) so they line up with the building art.

export const WORLD = { w: 9600, h: 7600 };
/** Junction 101, the start of the game. */
export const CX = 4800;
export const CY = 2400;
export const HALF = 34; // half road width, measured vertically

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

export const clearOfRoads = (x: number, y: number, gap = 130) =>
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
}

/** Districts beyond Junction 101, named for the game world, opening in later stages. */
export const DISTRICTS: District[] = [
  { name: "Tech Mile", x: CX + 1600, y: CY + 800, phase: 1, buildings: ["commercial-block", "mixed-use-block", "residential-block", "gadget-kiosk"] },
  { name: "Owambe Gardens", x: CX - 1600, y: CY + 800, phase: 1, buildings: ["bungalow", "tailor-shop", "mixed-use-block", "suya-stand"] },
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

/** Homes and blocks between the junction and the districts, so the mainland has no bare sand. */
const RING = [
  { x: CX - 820, y: CY, art: "bungalow" },
  { x: CX + 820, y: CY, art: "residential-block" },
  { x: CX - 620, y: CY - 560, art: "commercial-block" },
  { x: CX + 620, y: CY - 560, art: "bungalow" },
  { x: CX - 620, y: CY + 600, art: "residential-block" },
  { x: CX + 620, y: CY + 600, art: "suya-stand" },
  { x: CX, y: CY - 1000, art: "mixed-use-block" },
  { x: CX, y: CY + 1040, art: "bungalow" },
  { x: CX - 1080, y: CY - 260, art: "suya-stand" },
  { x: CX + 1080, y: CY + 300, art: "commercial-block" },
  { x: CX - 300, y: CY - 1500, art: "residential-block" },
  { x: CX + 400, y: CY - 1600, art: "bungalow" },
  { x: CX - 2700, y: CY - 300, art: "bungalow" },
  { x: CX + 2700, y: CY - 100, art: "residential-block" },
  { x: CX + 3300, y: CY - 1300, art: "mixed-use-block" },
  { x: CX - 3300, y: CY - 1500, art: "commercial-block" },
];

export const ALL_SCENERY = [
  ...DISTRICT_SCENERY,
  ...RING.filter((r) => free(r.x, r.y)).map((r, i) => ({ art: `/art/buildings/${r.art}.webp`, x: r.x, y: r.y, key: `ring-${i}` })),
].sort((a, b) => a.y - b.y);

/** Plots around the junction: players' shops fill them; the rest show as open plots. Clear of roads and places. */
export const PLOTS = [
  { x: CX - 520, y: CY - 120 },
  { x: CX + 520, y: CY - 150 },
  { x: CX - 250, y: CY - 420 },
  { x: CX + 250, y: CY - 420 },
  { x: CX - 250, y: CY + 470 },
  { x: CX + 250, y: CY + 470 },
  { x: CX - 520, y: CY + 170 },
  { x: CX + 520, y: CY + 150 },
  { x: CX, y: CY - 680 },
  { x: CX, y: CY + 700 },
];

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
export const bandPath = (s: Segment) =>
  `M${s.x0} ${s.y0 - HALF} L${s.x1} ${s.y1 - HALF} L${s.x1} ${s.y1 + HALF} L${s.x0} ${s.y0 + HALF}Z`;
export const kerbPath = (s: Segment, off: number) => `M${s.x0} ${s.y0 + off} L${s.x1} ${s.y1 + off}`;
export const centrePath = (s: Segment) => `M${s.x0} ${s.y0} L${s.x1} ${s.y1}`;
