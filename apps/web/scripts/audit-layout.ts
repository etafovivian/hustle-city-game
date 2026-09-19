// Visual layout audit: what the map's art actually covers, not just the plot squares.
// Run: node scripts/audit-layout.ts           (report; -v lists every finding)
//      node scripts/audit-layout.ts --strict  (exit 1 on any of the STRICT findings below)
// check-clearance.ts runs the strict checks too, so `pnpm test` keeps them.
//
// Sprites are modelled by their silhouettes (cityLayout's buildingShape, treeShape, signShape): a building is its
// footprint diamond extruded up to the top of its image, a tree its crown, an open plot its for-sale sign. "Covers"
// means the sprite drawn in front (larger foot y, drawn later) hides that share of the one behind it.
import { pathToFileURL } from "node:url";
import * as L from "../src/components/cityLayout.ts";
import { ART_SIZE } from "../src/components/artSizes.ts";
import { VENUES } from "../../../packages/shared/src/venues.ts";

type Pt = L.Pt;
export interface Sprite {
  name: string;
  kind: "building" | "tree" | "prop" | "sign";
  fx: number;
  fy: number;
  poly: Pt[];
  foot?: Pt[];
}
export interface Finding {
  kind: "covers" | "ground" | "tree-in-building" | "tree-covers" | "sign-hidden" | "water" | "off-map" | "dead-end" | "edge-end" | "empty" | "label" | "art-size";
  msg: string;
}
/** The findings that must stay at zero (check-clearance.ts fails on them). */
export const STRICT: Finding["kind"][] = ["covers", "ground", "tree-in-building", "tree-covers", "water", "off-map", "label", "art-size"];

const artName = (art: string) => art.split("/").pop()!.replace(/\.(webp|svg)$/, "");
const building = (name: string, art: string, x: number, y: number, scale: number, h?: number): Sprite => ({ name, kind: "building", fx: x, fy: y, ...L.buildingShape(art, x, y, scale, h) });

export function sprites() {
  const out: Sprite[] = [];
  for (const b of L.ALL_SCENERY) out.push(building(`${b.key} ${artName(b.art)}`, b.art, b.x, b.y, b.scale));
  for (const v of L.VENUE_SPOTS) {
    const art = VENUES.find((vv) => vv.key === v.key)?.art;
    if (art && !art.includes("ferry-jetty")) out.push(building(`venue ${v.key}`, art, v.x, v.y, v.scale));
  }
  for (const p of L.PLACES) out.push(building(`place ${p.id}`, p.art, p.x + p.w / 2, p.y + p.h - p.w / 12, p.w / L.BASE, p.h));
  out.push(building("park", "park", L.PARK.x + L.PARK.w / 2, L.PARK.y + L.PARK.h - L.PARK.w / 12, L.PARK.w / L.BASE, L.PARK.h));
  for (const l of L.FOR_SALE) out.push({ name: `land ${l.id}`, kind: "sign", fx: l.x, fy: l.y + l.hh * 0.25, poly: L.signShape(l) });
  for (const t of L.TREES) out.push({ name: `tree ${t.key} (${t.kind})`, kind: "tree", fx: t.x, fy: t.y, poly: L.treeShape(t.x, t.y, t.kind) });
  for (const p of [...L.PROPS, ...L.PORT_AND_PLANES]) {
    const [pw, ph] = ART_SIZE[p.art] ?? [p.w, p.w];
    out.push({ name: `prop ${p.key} ${artName(p.art)}`, kind: "prop", fx: p.x, fy: p.y, poly: L.boxShape(p.x, p.y, p.w, (p.w * ph) / pw) });
  }
  return out;
}

/** Things allowed to stand on or over water: moored ships, tugs, the ferry jetty, quay cranes on the quay edge. */
const WET_OK = /cargo-ship|tugboat|ferry-jetty|quay-crane|jet-|plane-|water-bus|marina-station/;

export function audit() {
  const S = sprites();
  const found: Finding[] = [];
  // Art sizes: cityLayout's copy of the building aspects must match artSizes.ts.
  for (const [art, [w, h]] of Object.entries(ART_SIZE)) {
    if (!art.startsWith("/art/buildings/") || art.includes("/kit-")) continue;
    const k = L.ART_ASPECT[artName(art)];
    if (k === undefined || Math.abs(k - h / w) > 0.006) found.push({ kind: "art-size", msg: `ART_ASPECT["${artName(art)}"] is ${k}, the art is ${(h / w).toFixed(2)} (update cityLayout.ts)` });
  }
  // Pairs, through a spatial hash on the silhouettes' bounds
  const CELL = 400;
  const grid = new Map<string, number[]>();
  const bounds = S.map((s) => {
    const xs = s.poly.map((p) => p[0]);
    const ys = s.poly.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
  });
  bounds.forEach(([x0, y0, x1, y1], i) => {
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
      for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
        const k = `${gx},${gy}`;
        (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
      }
  });
  const seen = new Set<number>();
  for (const cell of grid.values())
    for (let u = 0; u < cell.length; u++)
      for (let v = u + 1; v < cell.length; v++) {
        const [i, j] = cell[u]! < cell[v]! ? [cell[u]!, cell[v]!] : [cell[v]!, cell[u]!];
        const key = i * 100000 + j;
        if (seen.has(key)) continue;
        seen.add(key);
        const [a, b] = [bounds[i]!, bounds[j]!];
        if (a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]) continue;
        const [p, q] = [S[i]!, S[j]!];
        const [back, front] = p.fy <= q.fy ? [p, q] : [q, p];
        if (back.kind === "building" && front.kind === "building") {
          if (L.overlapArea(back.foot!, front.foot!) > 1) found.push({ kind: "ground", msg: `${back.name} and ${front.name} share ground` });
          const cover = L.coverShare(back.poly, front.poly);
          if (cover > L.MAX_COVER) found.push({ kind: "covers", msg: `${front.name} covers ${(cover * 100).toFixed(0)}% of ${back.name}` });
        } else if (back.kind === "sign" && front.kind === "building") {
          const cover = L.coverShare(back.poly, front.poly);
          if (cover > L.MAX_SIGN_COVER) found.push({ kind: "sign-hidden", msg: `${front.name} hides ${(cover * 100).toFixed(0)}% of the sign on ${back.name}` });
        } else if ((back.kind === "building") !== (front.kind === "building") && back.kind !== "sign" && front.kind !== "sign") {
          // A tree or prop and a building
          const [bld, other] = back.kind === "building" ? [back, front] : [front, back];
          if (inside(other, bld)) found.push({ kind: "tree-in-building", msg: `${other.name} stands inside ${bld.name}` });
          else if (front === other) {
            const cover = L.coverShare(bld.poly, other.poly);
            if (cover > (other.kind === "tree" ? L.MAX_TREE_COVER : L.MAX_COVER)) found.push({ kind: "tree-covers", msg: `${other.name} covers ${(cover * 100).toFixed(0)}% of ${bld.name}` });
          }
        }
      }
  // Water and the map's edge: footprint corners of buildings, foot points of everything else
  for (const s of S) {
    if (WET_OK.test(s.name)) continue;
    const pts = s.foot ?? [[s.fx, s.fy] as Pt];
    // Lagos and Ogun fill WORLD; Abuja lies beyond it to the east (inside MAP_BOUNDS, on its own ground)
    if (pts.some(([x, y]) => x < L.WORLD.x0 || y < L.WORLD.y0 || x > L.MAP_BOUNDS.w || y > L.WORLD.h || (x > L.WORLD.w && !L.inAbuja(x, y, 0)))) {
      found.push({ kind: "off-map", msg: `${s.name} at ${s.fx.toFixed(0)},${s.fy.toFixed(0)} is off the map` });
      continue;
    }
    const wet = pts.filter(([x, y]) => !L.landmassAt(x, y) || L.landmassAt(x, y) === "bridge");
    if (wet.length) found.push({ kind: "water", msg: `${s.name} at ${s.fx.toFixed(0)},${s.fy.toFixed(0)} stands on water or a bridge (${wet.length}/${pts.length} points)` });
  }
  found.push(...deadEnds(), ...labels(), ...empty(S));
  return { found, sprites: S };
}
const inside = (o: Sprite, b: Sprite) => L.inPoly([o.fx, o.fy], b.foot!);

/** Street ends that don't meet another street or road (a turning circle in the sand). */
export function deadEnds(): Finding[] {
  const out: Finding[] = [];
  const lines = [...L.ROADS.map((r) => ({ ...r, half: L.HALF })), ...L.STREETS];
  const dist = (l: L.Segment, p: { x: number; y: number }) => {
    const dx = l.x1 - l.x0;
    const dy = l.y1 - l.y0;
    const t = Math.max(0, Math.min(1, ((p.x - l.x0) * dx + (p.y - l.y0) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(l.x0 + dx * t - p.x, l.y0 + dy * t - p.y);
  };
  for (const s of L.STREETS)
    for (const end of [
      { x: s.x0, y: s.y0 },
      { x: s.x1, y: s.y1 },
    ]) {
      if (lines.some((o) => o !== s && dist(o, end) < o.half + s.half + 40)) continue;
      const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      const edge = end.x < L.WORLD.x0 + 400 || end.y < L.WORLD.y0 + 400 || end.x > L.WORLD.w - 400;
      const coast = !L.onLand(end.x, end.y + 160) || !L.onLand(end.x, end.y - 160);
      out.push({
        kind: edge ? "edge-end" : "dead-end",
        msg: `street ${s.id} (${s.cls}, ${len.toFixed(0)} long) ends at ${end.x.toFixed(0)},${end.y.toFixed(0)}${edge ? " at the map's edge" : coast ? " by the water" : ""}`,
      });
    }
  return out;
}

/** District name plates (CityMap draws them `name.length * 34 + 100` wide, scaled to the zoom) must not overlap. */
export function labels(): Finding[] {
  const out: Finding[] = [];
  const named = L.DISTRICTS.filter((d) => !d.landmark);
  for (const k of [0.06, 0.1, 0.2, 0.3, 0.45]) {
    const scale = k >= 0.45 ? 13 / (56 * k) : Math.min(20, Math.max(1, 16 / (56 * k)));
    const rects = named.map((d) => {
      const w = (d.name.length * 34 + 100) * scale;
      return { d, x0: d.x - w / 2, x1: d.x + w / 2, y0: d.y - 62 * scale, y1: d.y + (d.open ? 56 : 26) * scale };
    });
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const [a, b] = [rects[i]!, rects[j]!];
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) out.push({ kind: "label", msg: `at zoom ${k}, the ${a.d.name} and ${b.d.name} name plates overlap` });
      }
  }
  return out;
}

/** Land in the built-up city with nothing on it: 300×300 cells on land with nothing standing in them, next to built cells. */
export function empty(S: Sprite[]): Finding[] {
  const CELL = 300;
  const filled = new Set<string>();
  for (const s of S) filled.add(`${Math.floor(s.fx / CELL)},${Math.floor(s.fy / CELL)}`);
  const holes: string[] = [];
  let land = 0;
  let built = 0;
  for (let gx = Math.floor(L.WORLD.x0 / CELL); gx < L.WORLD.w / CELL; gx++)
    for (let gy = Math.floor(L.WORLD.y0 / CELL); gy < L.WORLD.h / CELL; gy++) {
      const [x, y] = [(gx + 0.5) * CELL, (gy + 0.5) * CELL];
      if (!L.onLand(x, y)) continue;
      land++;
      if (filled.has(`${gx},${gy}`)) {
        built++;
        continue;
      }
      if (!L.groundClear(x, y, 20)) continue; // a road
      const n = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => filled.has(`${gx + dx!},${gy + dy!}`)).length;
      if (n >= 3) holes.push(`${x},${y}`);
    }
  return [
    { kind: "empty", msg: `${built} of ${land} land cells (${CELL}×${CELL}) have something on them (${((built / land) * 100).toFixed(0)}%)` },
    ...holes.map((h): Finding => ({ kind: "empty", msg: `empty land inside the city at ${h}` })),
  ];
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const { found, sprites: S } = audit();
  const by = new Map<string, Finding[]>();
  for (const f of found) (by.get(f.kind) ?? by.set(f.kind, []).get(f.kind)!).push(f);
  const verbose = process.argv.includes("-v");
  for (const [kind, fs] of by) {
    console.log(`\n## ${kind}: ${fs.length}${STRICT.includes(kind as Finding["kind"]) ? " (must be 0)" : ""}`);
    for (const f of verbose ? fs : fs.slice(0, 25)) console.log(`  ${f.msg}`);
    if (!verbose && fs.length > 25) console.log(`  … ${fs.length - 25} more (-v for all)`);
  }
  const D = L.DECLUTTER;
  console.log(`\nDeclutter pass: ${D.shrunk.length} buildings drawn smaller, ${D.cleared.length} older buildings cleared off their plots, ${D.dropped.length} new plots dropped, ${D.left.length} left as they are`);
  if (verbose) for (const [k, v] of Object.entries(D)) if (v.length) console.log(`  ${k}: ${v.join("; ")}`);
  console.log(`${S.length} sprites: ${S.filter((s) => s.kind === "building").length} buildings, ${S.filter((s) => s.kind === "sign").length} plots for sale, ${S.filter((s) => s.kind === "tree").length} trees, ${S.filter((s) => s.kind === "prop").length} props; ${L.STREETS.length} streets`);
  const bad = found.filter((f) => STRICT.includes(f.kind));
  if (process.argv.includes("--strict") && bad.length) process.exit(1);
}
