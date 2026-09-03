// Pedestrians beyond Junction 101: every area's streets get walkers on their pavements. Junction 101 has its own
// footpath network (cityLayout FOOTPATHS); the other areas only have their street grids, so each street becomes a
// loop here: up one pavement, across at the turning circle, back down the other pavement and across the street's
// mouth (along the pavement of the road it leaves). The main road through each area gets walkers going up and down
// each of its pavements. Pavements are kept clear of every plot (cityLayout groundClear), so nobody walks through a
// building. Built from exported layout data only.
import { DISTRICTS, HALF, ISLAND_B, KERB, STREETS, STREET_CLASS, iso, onLand, toIso, type Street } from "./cityLayout.js";

type P = { x: number; y: number };
export interface WalkPath {
  area: string;
  /** World points along the path. */
  pts: P[];
  /** Closed loops carry on round; open paths are walked back and forth. */
  closed: boolean;
  /** Cumulative length at each point (and the closing leg for loops, as the last entry). */
  cum: number[];
  total: number;
}

/** Street id prefixes of each area's grid (see cityLayout AREA_GRIDS). */
const AREA_OF_PREFIX: Record<string, string> = {
  tm: "Tech Mile",
  ar: "Airport Ridge",
  dt: "Danfo Terminal",
  ow: "Owambe Gardens",
  ap: "Apapa Port",
  mw: "Marina Wharf",
  ih: "Island Heights",
  lk: "Lekki Gardens",
  ik: "Ikodu Town",
};
/** The main road's stretch through each area: fixed iso axis and value, and the range along it. */
const MAIN_ROADS: { area: string; fixed: "a" | "b"; at: number; from: number; to: number }[] = [
  { area: "Tech Mile", fixed: "b", at: 0, from: 1550, to: 2250 },
  { area: "Airport Ridge", fixed: "a", at: 0, from: 1550, to: 2750 },
  { area: "Danfo Terminal", fixed: "b", at: 0, from: -3850, to: -1550 },
  { area: "Owambe Gardens", fixed: "a", at: 0, from: -2350, to: -1550 },
  { area: "Apapa Port", fixed: "a", at: 0, from: -3250, to: -2550 },
  { area: "Marina Wharf", fixed: "b", at: ISLAND_B, from: 1450, to: 2300 },
  { area: "Island Heights", fixed: "b", at: ISLAND_B, from: 2550, to: 4800 },
  { area: "Lekki Gardens", fixed: "b", at: ISLAND_B, from: 4900, to: 10300 },
];
/** How many walkers each area gets: busy mainland areas more, the far ends of the map fewer. */
export const AREA_WALKERS: Record<string, number> = {
  "Tech Mile": 7,
  "Danfo Terminal": 10,
  "Owambe Gardens": 7,
  "Airport Ridge": 6,
  "Apapa Port": 4,
  "Marina Wharf": 6,
  "Island Heights": 6,
  "Lekki Gardens": 8,
  "Ikodu Town": 4,
};

const kerbOf = (s: { half: number; pav: number }) => s.half + s.pav / 2;
const COLLECTOR_KERB = kerbOf(STREET_CLASS.collector);

function makePath(area: string, pts: P[], closed: boolean): WalkPath {
  const cum = [0];
  const n = closed ? pts.length + 1 : pts.length;
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1]!;
    const b = pts[i % pts.length]!;
    cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { area, pts, closed, cum, total: cum[cum.length - 1]! };
}

/** A street's pavement loop, or null for alleys. */
function streetLoop(s: Street, area: string): WalkPath | null {
  if (s.cls === "alley" || !s.pav) return null;
  const endIso = toIso(s.end.x, s.end.y);
  const endRun = s.fixedAxis === "a" ? endIso.b : endIso.a;
  const farIsHi = Math.abs(endRun - s.hi) < Math.abs(endRun - s.lo);
  let near = farIsHi ? s.lo : s.hi;
  const dir = farIsHi ? 1 : -1;
  const far = (farIsHi ? s.hi : s.lo) - dir * 20; // short of the turning circle
  const roadAt = near - dir * (HALF - 4);
  if (s.cls === "collector" && (Math.abs(roadAt) < 1 || Math.abs(roadAt - ISLAND_B) < 1)) near = roadAt + dir * KERB; // off a main road
  else if (s.cls === "local") near += dir * COLLECTOR_KERB; // locals leave a collector
  if ((far - near) * dir < 80) return null;
  const k = kerbOf(s);
  const pt = (off: number, run: number) => (s.fixedAxis === "a" ? iso(s.at + off, run) : iso(run, s.at + off));
  const pts = [pt(k, near), pt(k, far), pt(-k, far), pt(-k, near)];
  return makePath(area, pts, true);
}

const onPathLand = (p: WalkPath) => p.pts.every((q) => onLand(q.x, q.y));

/** Every area's walking paths (streets and main-road pavements). */
export const AREA_PATHS: WalkPath[] = (() => {
  const out: WalkPath[] = [];
  for (const s of STREETS) {
    const area = AREA_OF_PREFIX[s.id.slice(0, 2)];
    if (!area) continue; // Junction 101's own streets are on the footpath network
    const loop = streetLoop(s, area);
    if (loop && onPathLand(loop)) out.push(loop);
  }
  for (const r of MAIN_ROADS) {
    if (!DISTRICTS.some((d) => d.name === r.area)) continue;
    for (const side of [1, -1]) {
      const pt = (run: number) => (r.fixed === "b" ? iso(run, r.at + side * KERB) : iso(r.at + side * KERB, run));
      // Trim the ends to land (Road B's far ends, the Island's tip).
      const runs: number[] = [];
      for (let t = r.from; t <= r.to; t += 50) if (onLand(pt(t).x, pt(t).y)) runs.push(t);
      if (runs.length < 4) continue;
      out.push(makePath(r.area, [pt(runs[0]!), pt(runs[runs.length - 1]!)], false));
    }
  }
  return out;
})();

/** Where to start each area walker: paths picked in proportion to their length (seeded, same every visit). */
export function areaCrowd(rnd: () => number) {
  const crowd: { path: WalkPath; s: number }[] = [];
  for (const [area, count] of Object.entries(AREA_WALKERS)) {
    const paths = AREA_PATHS.filter((p) => p.area === area);
    const sum = paths.reduce((acc, p) => acc + p.total, 0);
    if (!sum) continue;
    for (let i = 0; i < count; i++) {
      // Spread them out: the i-th walker starts at an even share of the area's total length, nudged a little.
      let at = ((i + rnd() * 0.6) / count) * sum;
      const path = paths.find((p) => (at -= p.total) < 0) ?? paths[paths.length - 1]!;
      crowd.push({ path, s: rnd() * (path.closed ? path.total : 2 * path.total) });
    }
  }
  return crowd;
}

/** Position and heading at distance `s` along a path (open paths turn back at their ends). */
export function pointOn(p: WalkPath, s: number): { x: number; y: number; dx: number; dy: number } {
  let d = p.closed ? ((s % p.total) + p.total) % p.total : ((s % (2 * p.total)) + 2 * p.total) % (2 * p.total);
  let sign = 1;
  if (!p.closed && d > p.total) {
    d = 2 * p.total - d;
    sign = -1;
  }
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i]! < d) i++;
  const a = p.pts[i - 1]!;
  const b = p.pts[i % p.pts.length]!;
  const len = p.cum[i]! - p.cum[i - 1]! || 1;
  const t = (d - p.cum[i - 1]!) / len;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) * sign, dy: (b.y - a.y) * sign };
}
