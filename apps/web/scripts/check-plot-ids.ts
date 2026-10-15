// Plot ids are ownership: every plot for sale in an earlier plots.gen.ts must still be for sale, in the same area, the
// same size and fronting the same kind of road, and keep its number within its area (Land.tsx numbers plots by order).
// Run: node scripts/check-plot-ids.ts [git ref, default HEAD]   (compares the ref's plots.gen.ts with the layout now)
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FOR_SALE } from "../src/components/cityLayout.ts";

const ref = process.argv[2] ?? "HEAD";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const old = execFileSync("git", ["show", `${ref}:packages/shared/src/plots.gen.ts`], { cwd: root, encoding: "utf8" });
const rows = [...old.matchAll(/\["([^"]+)", "([^"]+)", "([^"]+)", (\d+)\]/g)].map((m) => ({ id: m[1]!, area: m[2]!, road: m[3]!, hh: Number(m[4]) }));
const now = new Map(FOR_SALE.map((p) => [p.id, p]));
const bad: string[] = [];
for (const r of rows) {
  const p = now.get(r.id);
  if (!p) bad.push(`${r.id} (${r.area}) is gone`);
  else if (p.area !== r.area || p.road !== r.road || p.hh !== r.hh) bad.push(`${r.id}: was ${r.area}/${r.road}/${r.hh}, now ${p.area}/${p.road}/${p.hh}`);
}
// Plot numbers within an area follow the order of FOR_SALE: the old plots must come first, in their old order.
const order = (list: { id: string; area: string }[], area: string) => list.filter((p) => p.area === area).map((p) => p.id);
for (const area of new Set(rows.map((r) => r.area))) {
  const was = order(rows, area);
  const is = order(FOR_SALE, area).slice(0, was.length);
  if (was.join() !== is.join()) bad.push(`${area}: the old plots' numbers changed`);
}
console.log(bad.length ? bad.join("\n") : `all ${rows.length} plot ids from ${ref} are still for sale, same area, size and number (${FOR_SALE.length} now)`);
process.exit(bad.length ? 1 : 0);
