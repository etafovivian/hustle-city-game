// Moving life on the map: danfos, okadas and kekes on the arterials, people strolling the kerbs.
// Pure SVG animation (SMIL animateMotion), so nothing re-renders in React while it runs.
// Art: Stitch export 9 (public/art/life, provenance in *.json sidecars).
import { useEffect, useState } from "react";
import { HALF, flyHeight, yOn, type Segment } from "./cityLayout.js";
import { WALKER_VARIANTS, walkDir, walkerSheet, walkerSize } from "./walkers.js";

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
  /** Roads the walkers stroll along, near the junction. */
  walkRoads: { a: Segment; b: Segment };
  /** Kerb distance from the centre line for pedestrians. */
  kerb: number;
  /** Junction centre. */
  cx: number;
}

type Sprite = { href: string; w: number; h: number };
const DANFO_SE: Sprite = { href: "/art/life/danfo-se.webp", w: 104, h: 91 };
const DANFO_NW: Sprite = { href: "/art/life/danfo-nw.webp", w: 104, h: 91 };
const OKADA_SE: Sprite = { href: "/art/life/okada-se.webp", w: 49, h: 60 };
const KEKE_SE: Sprite = { href: "/art/life/keke-se.webp", w: 57, h: 66 };

// Walk strips: 4 frames side by side, 266×128 source; drawn 64 world units tall.
const WALK = walkerSize(64);

/**
 * Vehicles for a road: about one per 1100 units each way, with art that faces the way it drives.
 * Down-right roads use the SE/NW art; up-right roads mirror it (NE = mirrored NW, SW = mirrored SE).
 */
const MIX = [DANFO_SE, OKADA_SE, DANFO_SE, KEKE_SE];
function trafficFor(s: Segment) {
  const downRight = (s.y1 - s.y0) / (s.x1 - s.x0) > 0;
  const length = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
  const n = Math.max(2, Math.round(length / 1100));
  return [true, false].flatMap((east) =>
    Array.from({ length: n }, (_, i) => {
      // Danfos only have rear art, so traffic heading up the screen is all danfos.
      const facingDown = downRight === east;
      const sprite = facingDown ? MIX[(i + (east ? 0 : 1)) % MIX.length]! : DANFO_NW;
      const speed = sprite === OKADA_SE ? 230 : sprite === KEKE_SE ? 115 : 140 + (i % 3) * 8;
      return { seg: s, east, sprite, mirror: !downRight, speed, offset: (i + (east ? 0 : 0.5)) / n };
    }),
  );
}

/** People strolling near the junction: which kerb, which way, and how far out. */
const WALKERS: { road: "a" | "b"; side: 1 | -1; east: boolean; from: number; to: number; offset: number }[] = [
  { road: "a", side: 1, east: true, from: -1300, to: -300, offset: 0 },
  { road: "a", side: -1, east: false, from: 300, to: 1400, offset: 0.4 },
  { road: "b", side: 1, east: false, from: 350, to: 1300, offset: 0.2 },
  { road: "b", side: -1, east: true, from: -1400, to: -350, offset: 0.65 },
  { road: "a", side: -1, east: true, from: -1500, to: -400, offset: 0.15 },
  { road: "a", side: 1, east: false, from: 350, to: 1500, offset: 0.8 },
  { road: "b", side: -1, east: false, from: 300, to: 1450, offset: 0.55 },
  { road: "b", side: 1, east: true, from: -1300, to: -300, offset: 0.3 },
];
const WALK_SPEED = 34;

/** Each vehicle and walker runs twice, half a loop apart, so the streets stay busy at close zoom. */
const twice = <T extends { offset: number }>(list: T[]) => list.flatMap((v) => [v, { ...v, offset: (v.offset + 0.5) % 1 }]);
const DENSE_WALKERS = twice(WALKERS);

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

export function StreetLife({ roads, walkRoads, kerb, cx }: Props) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return null;

  return (
    <g aria-hidden="true" className="street-life">
      {roads.flatMap(trafficFor).map((t, i) => {
        const s = t.seg;
        const lane = t.east ? HALF / 2 : -HALF / 2;
        const [lo, hi] = [Math.min(s.x0, s.x1), Math.max(s.x0, s.x1)];
        const [x0, x1] = t.east ? [lo, hi] : [hi, lo];
        const f = (x: number) => yOn(s, x);
        const length = Math.hypot(x1 - x0, f(x1) - f(x0));
        const dur = length / t.speed;
        const { href, w, h } = t.sprite;
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
            <g transform={t.mirror ? "scale(-1 1)" : undefined}>
              <image href={href} x={-w / 2} y={-h + 6} width={w} height={h} />
            </g>
          </g>
        );
      })}

      {DENSE_WALKERS.map((p, i) => {
        const r = walkRoads[p.road];
        const [a, b] = p.east ? [cx + p.from, cx + p.to] : [cx + p.to, cx + p.from];
        const y = (x: number) => yOn(r, x) + p.side * kerb;
        const length = Math.hypot(b - a, y(b) - y(a));
        const dur = length / WALK_SPEED;
        const variant = WALKER_VARIANTS[i % WALKER_VARIANTS.length]!;
        const sheet = walkerSheet(variant, walkDir(b - a, y(b) - y(a)));
        return (
          <g key={`w${i}`}>
            <animateMotion
              dur={`${dur.toFixed(1)}s`}
              begin={`${(-dur * p.offset).toFixed(1)}s`}
              repeatCount="indefinite"
              path={`M${a} ${y(a)} L${b} ${y(b)}`}
            />
            {/* Fade at the ends of the route instead of snapping back to the start */}
            <animate attributeName="opacity" dur={`${dur.toFixed(1)}s`} begin={`${(-dur * p.offset).toFixed(1)}s`} repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.06;0.94;1" />
            <ellipse cx="0" cy="-1" rx="12" ry="4" fill="rgb(0 0 0 / 25%)" />
            <svg x={-WALK.w / 2} y={-WALK.h + WALK.ground} width={WALK.w} height={WALK.h} overflow="hidden">
              <image href={sheet} width={WALK.w * WALK.frames} height={WALK.h}>
                <animate
                  attributeName="x"
                  dur="0.8s"
                  repeatCount="indefinite"
                  calcMode="discrete"
                  values={Array.from({ length: WALK.frames }, (_, f) => -WALK.w * f).join(";")}
                />
              </image>
            </svg>
          </g>
        );
      })}
    </g>
  );
}
