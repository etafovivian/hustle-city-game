// Inside a place: the cutaway room, shown big, with people moving about in it. They walk between random spots on the
// floor, stop for a moment, then carry on (walk sprites from the 3D bodies; sitting and eating poses come next).
// The floor is the diamond at the bottom of every Stitch cutaway: its corners are fractions of the image.
import { useEffect, useRef, useState } from "react";
import { WALKER_VARIANTS, walkDir, walkerSheet, type WalkDir, type WalkerVariant } from "./walkers.js";

const FLOOR = { top: [0.5, 0.5], right: [0.88, 0.69], bottom: [0.5, 0.9], left: [0.12, 0.69] } as const;
/** Floor coordinates (u, v in 0..1 along the two back walls) to image fractions. */
const onFloor = (u: number, v: number) => ({
  x: FLOOR.top[0] + u * (FLOOR.right[0] - FLOOR.top[0]) + v * (FLOOR.left[0] - FLOOR.top[0]),
  y: FLOOR.top[1] + u * (FLOOR.right[1] - FLOOR.top[1]) + v * (FLOOR.left[1] - FLOOR.top[1]),
});

function usePrefersReducedMotion() {
  const [reduce] = useState(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });
  return reduce;
}

/** People who stay put and do something (Blender pose sheets in public/art/life/poses): dance, serve, stand. */
export type PoseAction = "dance" | "serve" | "stand_idle" | "sit_eat" | "sit_talk";
const POSE_VARIANTS: Record<PoseAction, WalkerVariant[]> = {
  dance: ["woman_gele", "man_kaftan", "woman_buba"],
  serve: ["woman_buba", "man_casual"],
  stand_idle: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy"],
  sit_eat: ["woman_buba", "man_kaftan", "man_casual", "woman_gele"],
  sit_talk: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy"],
};

export function InteriorScene({ src, alt, crowd = 4, seed = 1, poses = [] }: { src: string; alt: string; crowd?: number; seed?: number; poses?: PoseAction[] }) {
  const box = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const [h, setH] = useState(0);
  const reduce = usePrefersReducedMotion();
  const variants: WalkerVariant[] = Array.from({ length: crowd }, (_, i) => WALKER_VARIANTS[(i + seed) % WALKER_VARIANTS.length]!);
  // Posed people stand at fixed spots spread over the floor, each facing the viewer (se or sw).
  const posed = poses.map((action, i) => {
    const vs = POSE_VARIANTS[action];
    const spot = onFloor(0.2 + ((i * 0.37 + seed * 0.13) % 0.6), 0.25 + ((i * 0.29 + seed * 0.07) % 0.55));
    return { action, variant: vs[(i + seed) % vs.length]!, dir: (i % 2 ? "sw" : "se") as WalkDir, ...spot };
  });
  const posedEls = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!h) return;
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const people = variants.map(() => ({ u: 0.15 + rnd() * 0.7, v: 0.15 + rnd() * 0.7, tu: rnd(), tv: rnd(), wait: rnd() * 2, walked: 0, dir: "se" as WalkDir }));
    const width = box.current!.clientWidth;
    const place = (i: number) => {
      const p = people[i]!;
      const el = els.current[i];
      if (!el) return;
      const at = onFloor(p.u, p.v);
      el.style.left = `${at.x * 100}%`;
      el.style.top = `${at.y * 100}%`;
      el.style.zIndex = String(Math.round(at.y * 1000));
      const frame = p.wait > 0 ? 0 : Math.floor(p.walked / 0.024) % 8;
      el.style.backgroundPosition = `${(frame / 7) * 100}% 0`;
      el.style.backgroundImage = `url(${walkerSheet(variants[i]!, p.dir)})`;
    };
    people.forEach((_, i) => place(i));
    if (reduce) return;
    const t0 = performance.now();
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      people.forEach((p, i) => {
        if (p.wait > 0) p.wait -= dt;
        else {
          const du = p.tu - p.u;
          const dv = p.tv - p.v;
          const d = Math.hypot(du, dv);
          if (d < 0.02) {
            // Arrived: stand a moment, then pick somewhere new on the floor.
            p.wait = 1 + rnd() * 3;
            p.tu = 0.08 + rnd() * 0.84;
            p.tv = 0.08 + rnd() * 0.84;
          } else {
            const speed = 0.09; // floor widths per second
            const k = Math.min(1, (speed * dt) / d);
            const a = onFloor(p.u, p.v);
            p.u += du * k;
            p.v += dv * k;
            const b = onFloor(p.u, p.v);
            p.walked += Math.hypot(b.x - a.x, b.y - a.y);
            p.dir = walkDir((b.x - a.x) * width, (b.y - a.y) * width);
          }
        }
        place(i);
      });
      // Posed people loop their 8 frames (dancers a little faster)
      posed.forEach((p, i) => {
        const el = posedEls.current[i];
        if (!el) return;
        const fps = p.action === "dance" ? 10 : 7;
        const frame = (Math.floor(((now - t0) / 1000) * fps) + i * 3) % 8;
        el.style.backgroundPosition = `${(frame / 7) * 100}% 0`;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, src, reduce]);

  // People stand about a fifth of the room's height (sprite frames are 96×160, feet 16 px above the bottom).
  const ph = h * 0.21;
  return (
    <div ref={box} className="interior-scene">
      <img src={src} alt={alt} />
      {h > 0 &&
        variants.map((v, i) => (
          <div
            key={`${v}-${i}`}
            ref={(el) => void (els.current[i] = el)}
            className="interior-npc"
            aria-hidden="true"
            style={{ width: ph * 0.6, height: ph, marginTop: ph * 0.1 }}
          />
        ))}
      {h > 0 &&
        posed.map((p, i) => (
          <div
            key={`pose-${i}`}
            ref={(el) => void (posedEls.current[i] = el)}
            className="interior-npc"
            aria-hidden="true"
            style={{
              width: ph * 0.6,
              height: ph,
              marginTop: ph * 0.1,
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              zIndex: Math.round(p.y * 1000),
              backgroundImage: `url(/art/life/poses/${p.action}-${p.variant}-${p.dir}.webp)`,
            }}
          />
        ))}
    </div>
  );
}
