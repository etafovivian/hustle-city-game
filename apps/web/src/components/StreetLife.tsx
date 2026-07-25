// Moving life on the map: danfos, okadas and kekes on the arterials, people strolling the kerbs.
// Pure SVG animation (SMIL animateMotion), so nothing re-renders in React while it runs.
// Art: Stitch export 9 (public/art/life, provenance in *.json sidecars).
import { useEffect, useState } from "react";
import { HALF, yOn, type Segment } from "./cityLayout.js";

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
const WALK = { away: "/art/life/kaftan-walk-away.webp", toward: "/art/life/kaftan-walk-toward.webp" };
const WALK_H = 64;
const WALK_FRAME_W = (266 / 4) * (WALK_H / 128);

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
              path={`M${x0} ${f(x0) + lane} L${x1} ${f(x1) + lane}`}
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
        // Heading down the screen shows the face; heading up shows the back.
        const down = y(b) > y(a);
        // Source art walks towards the viewer facing down-right, and away facing up-left.
        const mirror = down ? b < a : b > a;
        return (
          <g key={`w${i}`}>
            <animateMotion
              dur={`${dur.toFixed(1)}s`}
              begin={`${(-dur * p.offset).toFixed(1)}s`}
              repeatCount="indefinite"
              path={`M${a} ${y(a)} L${b} ${y(b)}`}
            />
            <ellipse cx="0" cy="-2" rx="13" ry="4" fill="rgb(0 0 0 / 25%)" />
            <g transform={mirror ? "scale(-1 1)" : undefined}>
              <svg x={-WALK_FRAME_W / 2} y={-WALK_H} width={WALK_FRAME_W} height={WALK_H} overflow="hidden">
                <image href={down ? WALK.toward : WALK.away} width={WALK_FRAME_W * 4} height={WALK_H}>
                  <animate
                    attributeName="x"
                    dur="0.5s"
                    repeatCount="indefinite"
                    calcMode="discrete"
                    values={`0;${-WALK_FRAME_W};${-WALK_FRAME_W * 2};${-WALK_FRAME_W * 3}`}
                  />
                </image>
              </svg>
            </g>
          </g>
        );
      })}
    </g>
  );
}
