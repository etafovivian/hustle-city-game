// Walkers among the buildings: everything on the buildings layer (houses, trees, stalls, places, shops) is drawn
// back to front by its foot point, and the walkers are slotted into that order, so a person walking in front of a
// building is drawn over it and one walking behind it is hidden by it. Walkers follow the footpath network
// (cityLayout FOOTPATHS): pavements, corners and zebras. One animation loop moves them by setting attributes
// directly; React only re-renders a few times a second when a walker passes another object's depth.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FOOTPATHS, PRESETS } from "./cityLayout.js";
import { WALKER_VARIANTS, walkDir, walkerSheet, walkerSize, type WalkDir } from "./walkers.js";

export interface DepthItem {
  key: string;
  /** Foot point y: things lower on screen are nearer and drawn later. */
  y: number;
  node: ReactNode;
}

// Walkers: drawn 64 world units tall; children are smaller inside the same frames.
const WALK = walkerSize(64);
const WALKERS = PRESETS.mainland.walkers;
/** One full walk cycle (8 frames, two steps) covers this much ground, so feet don't slide. */
const STRIDE = 58;

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Index of the first item drawn after a walker at depth y (items sorted by y). */
function slotOf(ys: number[], y: number) {
  let lo = 0;
  let hi = ys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ys[mid]! <= y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function DepthSorted({ items, people }: { items: DepthItem[]; people: boolean }) {
  const reduce = usePrefersReducedMotion();
  const walking = people && !reduce;
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const ys = useRef<number[]>([]);
  ys.current = sorted.map((i) => i.y);
  const groups = useRef<(SVGGElement | null)[]>([]);
  const sheets = useRef<(SVGImageElement | null)[]>([]);
  const [slots, setSlots] = useState<number[]>(() => Array.from({ length: WALKERS }, () => 0));

  useEffect(() => {
    if (!walking) return;
    const { nodes, links } = FOOTPATHS;
    // Same start every visit (a seeded shuffle), different choices as they go.
    let seed = 20261012;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    const crowd = Array.from({ length: WALKERS }, (_, i) => {
      const from = Math.floor(rnd() * nodes.length);
      const to = links[from]![Math.floor(rnd() * links[from]!.length)]!;
      return { from, to, t: rnd(), y: 0, walked: rnd() * STRIDE, speed: 40 + rnd() * 10, variant: WALKER_VARIANTS[i % WALKER_VARIANTS.length]!, dir: "" as WalkDir | "" };
    });
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const [i, p] of crowd.entries()) {
        let a = nodes[p.from]!;
        let b = nodes[p.to]!;
        let len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        p.t += (p.speed * dt) / len;
        p.walked += p.speed * dt;
        while (p.t >= 1) {
          // At a corner: carry on any way but back (unless it's a dead end).
          const ways = links[p.to]!.filter((n) => n !== p.from);
          const next = ways.length ? ways[Math.floor(rnd() * ways.length)]! : p.from;
          const over = (p.t - 1) * len;
          [p.from, p.to] = [p.to, next];
          a = nodes[p.from]!;
          b = nodes[p.to]!;
          len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          p.t = over / len;
        }
        const x = a.x + (b.x - a.x) * p.t;
        p.y = a.y + (b.y - a.y) * p.t;
        groups.current[i]?.setAttribute("transform", `translate(${x.toFixed(1)} ${p.y.toFixed(1)})`);
        const img = sheets.current[i];
        if (!img) continue;
        const dir = walkDir(b.x - a.x, b.y - a.y);
        if (dir !== p.dir) {
          p.dir = dir;
          img.setAttribute("href", walkerSheet(p.variant, dir));
        }
        const frame = Math.floor((p.walked / STRIDE) * WALK.frames) % WALK.frames;
        img.setAttribute("x", String(-WALK.w * frame));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // A few times a second, move walkers whose depth slot changed (React re-orders their nodes).
    const resort = window.setInterval(() => {
      const next = crowd.map((p) => slotOf(ys.current, p.y));
      setSlots((prev) => (prev.length === next.length && prev.every((s, i) => s === next[i]) ? prev : next));
    }, 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(resort);
    };
  }, [walking]);

  const walker = (i: number) => (
    <g key={`walker-${i}`} ref={(el) => void (groups.current[i] = el)} transform="translate(-999 -999)" aria-hidden="true">
      <ellipse cx="0" cy="-1" rx="12" ry="4" fill="rgb(0 0 0 / 25%)" />
      <svg x={-WALK.w / 2} y={-WALK.h + WALK.ground} width={WALK.w} height={WALK.h} overflow="hidden">
        <image ref={(el) => void (sheets.current[i] = el)} width={WALK.w * WALK.frames} height={WALK.h} />
      </svg>
    </g>
  );
  const out: ReactNode[] = [];
  const byslot = new Map<number, number[]>();
  if (walking) slots.forEach((s, i) => byslot.set(Math.min(s, sorted.length), [...(byslot.get(Math.min(s, sorted.length)) ?? []), i]));
  sorted.forEach((item, idx) => {
    for (const w of byslot.get(idx) ?? []) out.push(walker(w));
    out.push(<g key={item.key}>{item.node}</g>);
  });
  for (const w of byslot.get(sorted.length) ?? []) out.push(walker(w));
  return <>{out}</>;
}
