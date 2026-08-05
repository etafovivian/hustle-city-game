// Moving life on the map: danfos, cars, BRT buses, okadas and kekes on the roads; people on the pavements.
// Traffic is SMIL animation (no React re-renders). Walkers follow the footpath network (cityLayout FOOTPATHS):
// they keep to the pavements, turn at corners and cross only at zebras, moved by one animation loop that sets
// attributes directly, so React still doesn't re-render while they walk.
// Art: Stitch exports 9 and 11 (public/art/life, provenance in *.json sidecars); walkers from the 3D bodies.
import { useEffect, useRef, useState } from "react";
import { ART_SIZE } from "./artSizes.js";
import { FOOTPATHS, HALF, flyHeight, yOn, type Segment } from "./cityLayout.js";
import { WALKER_VARIANTS, walkDir, walkerSheet, walkerSize, type WalkDir } from "./walkers.js";

/** A vehicle's route along a road; flyovers rise and fall, so they get several points. */
function roadPath(s: Segment, x0: number, x1: number, lane: number) {
  if (!s.flyover) return `M${x0} ${yOn(s, x0) + lane} L${x1} ${yOn(s, x1) + lane}`;
  const N = 12;
  return Array.from({ length: N + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / N;
    return `${i ? "L" : "M"}${x} ${yOn(s, x) + lane - flyHeight(s, x)}`;
  }).join(" ");
}

interface Props {
  roads: Segment[];
}

type Sprite = { href: string; w: number; h: number; mirror: boolean };
/** A vehicle sprite `w` world units wide; `mirror` flips it to face the other way (SE ↔ SW, NE ↔ NW). */
const V = (name: string, w: number, mirror = false): Sprite => {
  const href = `/art/life/${name}.webp`;
  const [pw, ph] = ART_SIZE[href] ?? [w, w];
  return { href, w, h: (w * ph) / pw, mirror };
};
/**
 * What drives each way on screen. The art has front views (driving down the screen) for everything, but back
 * views (driving up it) only for danfos, BRT buses, okadas and kekes, so cars only drive down the screen.
 */
const POOL: Record<WalkDir, Sprite[]> = {
  se: [V("danfo-se", 104), V("car-taxi", 98, true), V("okada-se", 49), V("car-saloon", 100, true), V("danfo-se", 104), V("keke-se", 57), V("car-suv-black", 94, true), V("brt-sw", 176, true), V("car-suv-white", 96, true)],
  sw: [V("danfo-se", 104, true), V("car-taxi", 98), V("okada-sw", 50), V("car-saloon", 100), V("keke-sw", 57), V("brt-sw", 176), V("car-suv-black", 94), V("danfo-se", 104, true), V("car-suv-white", 96)],
  ne: [V("danfo-nw", 104, true), V("okada-ne", 50), V("brt-ne", 176), V("keke-ne", 58), V("danfo-nw", 104, true)],
  nw: [V("danfo-nw", 104), V("okada-ne", 50, true), V("keke-ne", 58, true), V("danfo-nw", 104), V("brt-ne", 176, true)],
};
/** World-x to drop from each end of a road's traffic route (the Tech Mile / bridge corner is a curve). */
const CORNER_TRIM: Record<string, { lo: number; hi: number }> = { a: { lo: 0, hi: 170 }, bridge: { lo: 0, hi: 170 } };

function trafficFor(s: Segment, r: number) {
  const downRight = (s.y1 - s.y0) / (s.x1 - s.x0) > 0;
  const length = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
  const n = Math.max(2, Math.round(length / 950));
  return [true, false].flatMap((east) =>
    Array.from({ length: n }, (_, i) => {
      const dir: WalkDir = downRight ? (east ? "se" : "nw") : east ? "ne" : "sw";
      const pool = POOL[dir];
      const sprite = pool[(i * 3 + r + (east ? 0 : 2)) % pool.length]!;
      // One speed per lane, so nothing drives through the vehicle in front.
      return { seg: s, east, sprite, speed: east ? 150 : 138, offset: (i + (east ? 0 : 0.5)) / n };
    }),
  );
}

// Walkers: drawn 64 world units tall; children are smaller inside the same frames.
const WALK = walkerSize(64);
const WALKERS = 26;
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

/** People on the pavements: each walks from node to node of the footpath network, choosing a way at each corner. */
function Walkers() {
  const groups = useRef<(SVGGElement | null)[]>([]);
  const sheets = useRef<(SVGImageElement | null)[]>([]);

  useEffect(() => {
    const { nodes, links } = FOOTPATHS;
    // Same start every visit (a seeded shuffle), different choices as they go.
    let seed = 20261012;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    const people = Array.from({ length: WALKERS }, (_, i) => {
      const from = Math.floor(rnd() * nodes.length);
      const to = links[from]![Math.floor(rnd() * links[from]!.length)]!;
      return { from, to, t: rnd(), walked: rnd() * STRIDE, speed: 40 + rnd() * 10, variant: WALKER_VARIANTS[i % WALKER_VARIANTS.length]!, dir: "" as WalkDir | "" };
    });
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const [i, p] of people.entries()) {
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
        const y = a.y + (b.y - a.y) * p.t;
        groups.current[i]?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
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
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <g className="walkers">
      {Array.from({ length: WALKERS }, (_, i) => (
        <g key={i} ref={(el) => void (groups.current[i] = el)} transform="translate(-999 -999)">
          <ellipse cx="0" cy="-1" rx="12" ry="4" fill="rgb(0 0 0 / 25%)" />
          <svg x={-WALK.w / 2} y={-WALK.h + WALK.ground} width={WALK.w} height={WALK.h} overflow="hidden">
            <image ref={(el) => void (sheets.current[i] = el)} width={WALK.w * WALK.frames} height={WALK.h} />
          </svg>
        </g>
      ))}
    </g>
  );
}

export function StreetLife({ roads }: Props) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return null;

  return (
    <g aria-hidden="true" className="street-life">
      {roads.flatMap(trafficFor).map((t, i) => {
        const s = t.seg;
        const lane = t.east ? HALF / 2 : -HALF / 2;
        // Where Road A turns onto Third Mainland Bridge the drawn road is a curve, so traffic on both
        // stops short of the sharp corner (and fades) instead of cutting across the bend.
        const trim = CORNER_TRIM[s.id] ?? { lo: 0, hi: 0 };
        const [lo, hi] = [Math.min(s.x0, s.x1) + trim.lo, Math.max(s.x0, s.x1) - trim.hi];
        const [x0, x1] = t.east ? [lo, hi] : [hi, lo];
        const f = (x: number) => yOn(s, x);
        const length = Math.hypot(x1 - x0, f(x1) - f(x0));
        const dur = length / t.speed;
        const { href, w, h, mirror } = t.sprite;
        return (
          <g key={i}>
            <animateMotion
              dur={`${dur.toFixed(1)}s`}
              begin={`${(-dur * t.offset).toFixed(1)}s`}
              repeatCount="indefinite"
              path={roadPath(s, x0, x1, lane)}
            />
            {/* Fade in and out at the ends of a road instead of popping */}
            <animate attributeName="opacity" dur={`${dur.toFixed(1)}s`} begin={`${(-dur * t.offset).toFixed(1)}s`} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.03;0.97;1" />
            <ellipse cx="0" cy="-4" rx={w * 0.42} ry={h * 0.12} fill="rgb(0 0 0 / 28%)" />
            <g transform={mirror ? "scale(-1 1)" : undefined}>
              <image href={href} x={-w / 2} y={-h + 6} width={w} height={h} />
            </g>
          </g>
        );
      })}
      <Walkers />
    </g>
  );
}
