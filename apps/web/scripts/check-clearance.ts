// Layout check: nothing on the map stands on a road, kerb, pavement or street, and buildings don't overlap.
// Run: node scripts/check-clearance.ts (Node 24 runs TypeScript directly). Exits 1 on any problem.
import * as L from "../src/components/cityLayout.ts";
import { audit, STRICT } from "./audit-layout.ts";
import { VENUES } from "../../../packages/shared/src/venues.ts";

type Box = { name: string; cx: number; cy: number; hh: number };
const boxes: Box[] = [];
for (const s of L.PLACED.scenery) {
  const c = L.PLACED.plotCentre(s.x, s.y, s.scale);
  boxes.push({ name: `${s.key} ${s.art.split("/").pop()}`, cx: c.x, cy: c.y, hh: L.siteOf(s.scale).hh });
}
for (const v of L.PLACED.venues) {
  const c = L.PLACED.plotCentre(v.x, v.y, v.scale);
  boxes.push({ name: `venue ${v.key}`, cx: c.x, cy: c.y, hh: L.siteOf(v.scale).hh });
}
for (const [i, p] of L.PLACED.plots.entries()) boxes.push({ name: `plot ${i}`, cx: p.x, cy: p.y, hh: L.PLACED.plotHalf });
for (const p of L.PLACES) boxes.push({ name: `place ${p.id}`, cx: p.x + p.w / 2, cy: p.y + p.h - p.w / 4, hh: p.w / 4 });
for (const l of L.PLACED.land.filter((ll) => ll.use === "for-sale")) boxes.push({ name: `land ${l.id}`, cx: l.x, cy: l.y, hh: l.hh });
for (const t of L.PLACED.trees) boxes.push({ name: `tree ${t.key}`, cx: t.x, cy: t.y, hh: 12 });

const bad: string[] = [];
for (const b of boxes) if (!L.groundClear(b.cx, b.cy, b.hh)) bad.push(`${b.name} is on a road, pavement, street or billboard`);
// Overlaps between buildings (iso squares)
const sq = boxes.filter((b) => !b.name.startsWith("tree")).map((b) => ({ ...b, ...L.toIso(b.cx, b.cy) }));
for (let i = 0; i < sq.length; i++)
  for (let j = i + 1; j < sq.length; j++) {
    const [p, q] = [sq[i]!, sq[j]!];
    if (Math.abs(p.a - q.a) < p.hh + q.hh && Math.abs(p.b - q.b) < p.hh + q.hh) bad.push(`${p.name} overlaps ${q.name}`);
  }
// Footpaths: every node joins the network.
const { nodes, links } = L.FOOTPATHS;
const lonely = nodes.filter((_, i) => links[i]!.length === 0).length;
if (lonely) bad.push(`${lonely} footpath nodes have no links`);

// The art: no building hides much of another, no tree stands in or in front of one, nothing in the water or off the
// map, no name plates on top of each other (scripts/audit-layout.ts has the rules and the full report).
for (const f of audit().found) if (STRICT.includes(f.kind)) bad.push(`${f.kind}: ${f.msg}`);

// Public transport: nothing was in the way when it was laid, every stop is on land people can walk to, buses and
// coaches keep to the roads, water buses to the water, and each line stops in order.
for (const i of L.TRANSIT_ISSUES) bad.push(`transit: ${i}`);
const ids = new Set<string>();
const start = { x: L.CX - 120, y: L.CY + 150 };
const abujaAirport = L.TRANSIT_STOPS_L.find((s) => s.id === "abuja-airport")!;
// Nothing walks between Lagos and Abuja
if (L.walkRoute(start, abujaAirport)) bad.push("abuja: you can walk there from Lagos");
for (const s of L.TRANSIT_STOPS_L) {
  if (ids.has(s.id)) bad.push(`transit: stop id ${s.id} is used twice`);
  ids.add(s.id);
  const land = L.landmassAt(s.x, s.y);
  if (!land || land === "bridge") bad.push(`transit: stop ${s.id} is not on land`);
  // Abuja's stops: walkable from its airport (Lagos is a flight away)
  else if (land === "abuja" ? !L.walkRoute(abujaAirport, s) : land !== "sandbar" && !L.walkRoute(start, s)) bad.push(`transit: stop ${s.id} can't be walked to`);
}
const roadDist = (p: { x: number; y: number }) =>
  Math.min(
    ...L.ROADS.map((r) => {
      const dx = r.x1 - r.x0;
      const dy = r.y1 - r.y0;
      const t = Math.max(0, Math.min(1, ((p.x - r.x0) * dx + (p.y - r.y0) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(r.x0 + dx * t - p.x, r.y0 + dy * t - p.y);
    }),
    Math.hypot((p.x - L.CX) / 2, p.y - L.CY) < L.ROUNDABOUT.rx ? 0 : Infinity,
  );
for (const l of L.TRANSIT_LINES_L) {
  if (l.stops.length !== l.stopAt.length || l.stopAt.some((k, i) => k < 0 || k >= l.path.length || (i && k <= l.stopAt[i - 1]!))) bad.push(`transit: ${l.key}'s stopAt is out of order`);
  for (const id of l.stops) if (!ids.has(id)) bad.push(`transit: ${l.key} calls at unknown stop ${id}`);
  for (let i = 1; i < l.path.length; i++) {
    const [p, q] = [l.path[i - 1]!, l.path[i]!];
    const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 30);
    for (let k = 0; k <= n; k++) {
      const c = { x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n };
      if (l.mode === "ferry" && L.landmassAt(c.x, c.y) && L.landmassAt(c.x, c.y) !== "bridge") {
        bad.push(`transit: ${l.key} runs aground at ${c.x.toFixed(0)},${c.y.toFixed(0)}`);
        break;
      }
      if ((l.mode === "brt" || l.mode === "coach") && roadDist(c) > L.HALF + 2) {
        bad.push(`transit: ${l.key} leaves the road at ${c.x.toFixed(0)},${c.y.toFixed(0)}`);
        break;
      }
    }
  }
}

// Landmarks and Gadget Village: each found its room (cityLayout LANDMARK_ISSUES), and every venue on the map is drawn
// with the art its card shows (the map's shapes use VENUE_ART; swapping a stand-in means changing both, in step).
for (const i of L.LANDMARK_ISSUES) bad.push(`landmark: ${i}`);
for (const v of L.VENUE_SPOTS) {
  const name = L.VENUE_ART[v.key];
  const art = VENUES.find((vv) => vv.key === v.key)?.art;
  if (!art) bad.push(`venue ${v.key} is on the map but not in venues.ts`);
  else if (name && art.split("/").pop()!.replace(/\.(webp|svg)$/, "") !== name) bad.push(`venue ${v.key}: the map draws "${name}", its card shows ${art}`);
}

console.log(bad.length ? bad.join("\n") : "all clear");
console.log(`${boxes.length} things checked, ${L.PROPS.length} props, ${nodes.length} footpath nodes, ${L.ZEBRAS.length} zebras`);
process.exit(bad.length ? 1 : 0);
