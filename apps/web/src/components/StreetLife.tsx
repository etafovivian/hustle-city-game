// Moving life on the map: danfos, okadas and kekes on the arterials, people strolling the kerbs.
// Pure SVG animation (SMIL animateMotion), so nothing re-renders in React while it runs.
// Art: Stitch export 9 (public/art/life, provenance in *.json sidecars).
import { useEffect, useState } from "react";

interface Road {
  /** y for an x on the road's centre line. */
  f: (x: number) => number;
  /** Lane offset (world units) for traffic heading towards larger x. Nigeria drives on the right. */
  eastLane: number;
}

interface Props {
  width: number;
  roads: { a: Road; b: Road };
  /** Kerb distance from the centre line for pedestrians. */
  kerb: number;
  /** Junction centre: walkers stroll near it rather than across the whole city. */
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

/** Vehicles per road and direction: sprite, speed (units/s) and a start offset so they are spread out. */
const TRAFFIC: { road: "a" | "b"; east: boolean; sprite: Sprite; mirror: boolean; speed: number; offset: number }[] = [
  // Road A runs down-right: eastbound traffic faces SE, westbound faces NW.
  { road: "a", east: true, sprite: DANFO_SE, mirror: false, speed: 150, offset: 0 },
  { road: "a", east: true, sprite: OKADA_SE, mirror: false, speed: 230, offset: 0.45 },
  { road: "a", east: true, sprite: KEKE_SE, mirror: false, speed: 115, offset: 0.7 },
  { road: "a", east: false, sprite: DANFO_NW, mirror: false, speed: 140, offset: 0.2 },
  { road: "a", east: false, sprite: DANFO_NW, mirror: false, speed: 150, offset: 0.75 },
  // Road B runs up-right: eastbound faces NE (mirrored NW art), westbound faces SW (mirrored SE art).
  { road: "b", east: true, sprite: DANFO_NW, mirror: true, speed: 145, offset: 0.1 },
  { road: "b", east: true, sprite: DANFO_NW, mirror: true, speed: 150, offset: 0.6 },
  { road: "b", east: false, sprite: DANFO_SE, mirror: true, speed: 150, offset: 0.3 },
  { road: "b", east: false, sprite: OKADA_SE, mirror: true, speed: 240, offset: 0.85 },
  { road: "b", east: false, sprite: KEKE_SE, mirror: true, speed: 110, offset: 0.5 },
];

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
const DENSE_TRAFFIC = twice(TRAFFIC);
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

export function StreetLife({ width, roads, kerb, cx }: Props) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return null;

  return (
    <g aria-hidden="true" className="street-life">
      {DENSE_TRAFFIC.map((t, i) => {
        const r = roads[t.road];
        const lane = t.east ? r.eastLane : -r.eastLane;
        const [x0, x1] = t.east ? [-120, width + 120] : [width + 120, -120];
        const length = Math.hypot(x1 - x0, r.f(x1) - r.f(x0));
        const dur = length / t.speed;
        const { href, w, h } = t.sprite;
        return (
          <g key={i}>
            <animateMotion
              dur={`${dur.toFixed(1)}s`}
              begin={`${(-dur * t.offset).toFixed(1)}s`}
              repeatCount="indefinite"
              path={`M${x0} ${r.f(x0) + lane} L${x1} ${r.f(x1) + lane}`}
            />
            <ellipse cx="0" cy="-4" rx={w * 0.42} ry={h * 0.12} fill="rgb(0 0 0 / 28%)" />
            <g transform={t.mirror ? "scale(-1 1)" : undefined}>
              <image href={href} x={-w / 2} y={-h + 6} width={w} height={h} />
            </g>
          </g>
        );
      })}

      {DENSE_WALKERS.map((p, i) => {
        const r = roads[p.road];
        const [a, b] = p.east ? [cx + p.from, cx + p.to] : [cx + p.to, cx + p.from];
        const y = (x: number) => r.f(x) + p.side * kerb;
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
