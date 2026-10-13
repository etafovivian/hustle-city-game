// Walkers among the buildings: everything on the buildings layer (houses, trees, stalls, places, shops) is drawn
// back to front by its foot point, and the walkers are slotted into that order, so a person walking in front of a
// building is drawn over it and one walking behind it is hidden by it. Walkers follow the footpath network
// (cityLayout FOOTPATHS): pavements, corners and zebras. One animation loop moves them by setting attributes
// directly; React only re-renders a few times a second when a walker passes another object's depth.
// Beyond Junction 101 every area has its own walkers on its street pavements (areaWalks.ts). Only walkers in view
// (or near it) are moved on screen; the rest are hidden and just keep their place in the walk, so phones stay smooth.
import { lookFromSeed, type AvatarConfig } from "@hc/shared";
import { frameGate } from "./frameGate.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AREA_WALKERS, areaCrowd, pointOn, type WalkPath } from "./areaWalks.js";
import { FOOTPATHS, PRESETS } from "./cityLayout.js";
import { WALKER_VARIANTS, walkDir, walkerSheet, walkerSize, type WalkDir } from "./walkers.js";
import { layerSheet, walkSheetName } from "./spriteComposer.js";

/**
 * The street's modern looks: a small fixed set (8 people's worth, reused round the city) so a slow phone composes at
 * most 32 walk sheets however many walkers there are. Biased to the modern street outfits (lookFromSeed `modern`).
 */
const STREET_LOOKS: AvatarConfig[] = Array.from({ length: 8 }, (_, k) => lookFromSeed(20261015 + k * 7919, k % 2 ? "woman" : "man", 0.85));
/** ?crowd=0 turns the modern street looks off (to compare performance, e.g. deploy/lab/perf.sh); default on. */
const CROWD = (() => {
  try {
    return new URLSearchParams(window.location.search).get("crowd") !== "0";
  } catch {
    return true;
  }
})();

export interface DepthItem {
  key: string;
  /** Foot point y: things lower on screen are nearer and drawn later. */
  y: number;
  node: ReactNode;
}

// Walkers: drawn 64 world units tall; children are smaller inside the same frames.
const WALK = walkerSize(64);
const JUNCTION_WALKERS = PRESETS.mainland.walkers;
const WALKERS = JUNCTION_WALKERS + Object.values(AREA_WALKERS).reduce((a, b) => a + b, 0);
/** Walkers this far (world units) outside the visible part of the map are hidden and not drawn. */
const VIEW_MARGIN = 160;
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

export function DepthSorted({ items, people, me }: { items: DepthItem[]; people: boolean; me?: { pos: { current: { x: number; y: number } }; node: ReactNode } }) {
  const reduce = usePrefersReducedMotion();
  const walking = people && !reduce;
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const ys = useRef<number[]>([]);
  ys.current = sorted.map((i) => i.y);
  const groups = useRef<(SVGGElement | null)[]>([]);
  const sheets = useRef<(SVGImageElement | null)[]>([]);
  const [slots, setSlots] = useState<number[]>(() => Array.from({ length: WALKERS }, () => 0));

  const probe = useRef<SVGGElement | null>(null);
  // You: slotted into the same back-to-front order (hidden behind buildings, never walking over their roofs).
  const [meSlot, setMeSlot] = useState(0);
  const meRef = useRef(me);
  meRef.current = me;
  useEffect(() => {
    const t = window.setInterval(() => {
      const p = meRef.current?.pos.current;
      if (!p) return;
      const s = slotOf(ys.current, p.y);
      setMeSlot((prev) => (prev === s ? prev : s));
    }, 150);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!walking) return;
    const { nodes, links } = FOOTPATHS;
    // Same start every visit (a seeded shuffle), different choices as they go.
    let seed = 20261012;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    type Walker = {
      x: number;
      y: number;
      dx: number;
      dy: number;
      walked: number;
      speed: number;
      variant: (typeof WALKER_VARIANTS)[number];
      /** A modern look drawn from layers (half the crowd), with the baked variant as the fallback. */
      look?: AvatarConfig;
      /** The layered sheet is on show (stop re-checking). */
      layered: boolean;
      dir: WalkDir | "";
      shown: boolean;
      // On Junction 101's footpath network: between nodes `from` and `to`, `t` of the way.
      from: number;
      to: number;
      t: number;
      // On an area path: distance `s` along it.
      path?: WalkPath;
      s: number;
    };
    const base = (i: number) => ({ x: 0, y: 0, dx: 0, dy: 1, walked: rnd() * STRIDE, speed: 40 + rnd() * 10, variant: WALKER_VARIANTS[i % WALKER_VARIANTS.length]!, look: CROWD && i % 2 ? STREET_LOOKS[(i >> 1) % STREET_LOOKS.length] : undefined, layered: false, dir: "" as WalkDir | "", shown: true, from: 0, to: 0, t: 0, s: 0 });
    const crowd: Walker[] = Array.from({ length: JUNCTION_WALKERS }, (_, i) => {
      const from = Math.floor(rnd() * nodes.length);
      const to = links[from]![Math.floor(rnd() * links[from]!.length)]!;
      return { ...base(i), from, to, t: rnd() };
    });
    for (const [j, w] of areaCrowd(rnd).entries()) crowd.push({ ...base(JUNCTION_WALKERS + j * 5), path: w.path, s: w.s });

    // The visible part of the map, in world units (refreshed a few times a second; null = unknown, show everyone).
    let view: { x0: number; y0: number; x1: number; y1: number } | null = null;
    const measure = () => {
      const g = probe.current;
      const svg = g?.ownerSVGElement;
      const m = g?.getScreenCTM();
      if (!g || !svg || !m) return (view = null);
      const r = svg.getBoundingClientRect();
      const [l, t, rt, b] = [Math.max(r.left, 0), Math.max(r.top, 0), Math.min(r.right, window.innerWidth), Math.min(r.bottom, window.innerHeight)];
      const inv = m.inverse();
      const p = new DOMPoint(l, t).matrixTransform(inv);
      const q = new DOMPoint(rt, b).matrixTransform(inv);
      view = { x0: Math.min(p.x, q.x) - VIEW_MARGIN, y0: Math.min(p.y, q.y) - VIEW_MARGIN, x1: Math.max(p.x, q.x) + VIEW_MARGIN, y1: Math.max(p.y, q.y) + VIEW_MARGIN * 1.5 };
    };
    const inView = (p: Walker) => !view || (p.x >= view.x0 && p.x <= view.x1 && p.y >= view.y0 && p.y <= view.y1);

    const move = (p: Walker, dt: number) => {
      p.walked += p.speed * dt;
      if (p.path) {
        p.s += p.speed * dt;
        const q = pointOn(p.path, p.s);
        [p.x, p.y, p.dx, p.dy] = [q.x, q.y, q.dx, q.dy];
        return;
      }
      let a = nodes[p.from]!;
      let b = nodes[p.to]!;
      let len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      p.t += (p.speed * dt) / len;
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
      p.x = a.x + (b.x - a.x) * p.t;
      p.y = a.y + (b.y - a.y) * p.t;
      [p.dx, p.dy] = [b.x - a.x, b.y - a.y];
    };

    const gate = frameGate();
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      if (!gate(now)) {
        raf = requestAnimationFrame(step);
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const [i, p] of crowd.entries()) {
        move(p, dt);
        const group = groups.current[i];
        const shown = inView(p);
        if (shown !== p.shown) {
          p.shown = shown;
          group?.setAttribute("display", shown ? "inline" : "none");
        }
        if (!shown) continue;
        group?.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        const img = sheets.current[i];
        if (!img) continue;
        const dir = walkDir(p.dx, p.dy);
        if (dir !== p.dir || (p.look && !p.layered)) {
          // half the crowd in modern street looks (tinted layers, composed once per look and direction and shared);
          // the baked look shows until that sheet is ready, or if layers are off
          const own = p.look ? layerSheet(p.look, walkSheetName(dir), true) : null;
          if (dir !== p.dir || own) img.setAttribute("href", own ?? walkerSheet(p.variant, dir));
          p.layered = !!own;
          p.dir = dir;
        }
        const frame = Math.floor((p.walked / STRIDE) * WALK.frames) % WALK.frames;
        img.setAttribute("x", String(-WALK.w * frame));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // A few times a second, re-measure the view and move walkers whose depth slot changed (React re-orders their
    // nodes). Hidden walkers keep their old slot, so they never cause a re-render.
    const resort = window.setInterval(() => {
      measure();
      setSlots((prev) => {
        const next = crowd.map((p, i) => (p.shown ? slotOf(ys.current, p.y) : (prev[i] ?? 0)));
        return prev.length === next.length && prev.every((s, i) => s === next[i]) ? prev : next;
      });
    }, 250);
    measure();
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
  const out: ReactNode[] = [<g key="walkers-probe" ref={(el) => void (probe.current = el)} />];
  const byslot = new Map<number, number[]>();
  if (walking) slots.forEach((s, i) => byslot.set(Math.min(s, sorted.length), [...(byslot.get(Math.min(s, sorted.length)) ?? []), i]));
  const mine = me ? <g key="me-walker">{me.node}</g> : null;
  const meAt = Math.min(meSlot, sorted.length);
  sorted.forEach((item, idx) => {
    if (mine && idx === meAt) out.push(mine);
    for (const w of byslot.get(idx) ?? []) out.push(walker(w));
    out.push(<g key={item.key}>{item.node}</g>);
  });
  if (mine && meAt >= sorted.length) out.push(mine);
  for (const w of byslot.get(sorted.length) ?? []) out.push(walker(w));
  return <>{out}</>;
}
