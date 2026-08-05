// Layout check: nothing on the map stands on a road, kerb, pavement or street, and buildings don't overlap.
// Run: node scripts/check-clearance.ts (Node 24 runs TypeScript directly). Exits 1 on any problem.
import * as L from "../src/components/cityLayout.ts";

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
for (const t of L.PLACED.trees) boxes.push({ name: `tree ${t.key}`, cx: t.x, cy: t.y, hh: 14 });

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

console.log(bad.length ? bad.join("\n") : "all clear");
console.log(`${boxes.length} things checked, ${L.PROPS.length} props, ${nodes.length} footpath nodes, ${L.ZEBRAS.length} zebras`);
process.exit(bad.length ? 1 : 0);
