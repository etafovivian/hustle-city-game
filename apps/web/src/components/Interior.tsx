// Inside a place: the cutaway room, shown big, with people in it. Each room is marked up by hand (see ROOMS): a
// walkway through its open floor that walkers follow from spot to spot, and stations where people stay and do
// something (the cook at the pots, the barber by the chair, dancers on the dance floor, people seated on the benches).
// Positions are fractions of the image: where the person's feet touch the floor.
import { useEffect, useRef, useState } from "react";
import { WALKER_VARIANTS, walkDir, walkerSheet, type WalkDir, type WalkerVariant } from "./walkers.js";

/** People who stay put and do something (Blender pose sheets in public/art/life/poses). */
export type PoseAction = "dance" | "serve" | "stand_idle" | "sit_eat" | "sit_talk";
const POSE_VARIANTS: Record<PoseAction, WalkerVariant[]> = {
  dance: ["woman_gele", "man_kaftan", "woman_buba"],
  serve: ["woman_buba", "man_casual"],
  stand_idle: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy"],
  sit_eat: ["woman_buba", "man_kaftan", "man_casual", "woman_gele"],
  sit_talk: ["woman_buba", "woman_gele", "man_kaftan", "man_casual"],
};

type Pt = [number, number];
export interface Room {
  /** Open floor, in order: walkers go back and forth along it, pausing at each spot. */
  walkway: Pt[];
  walkers: number;
  stations: { action: PoseAction; at: Pt; dir: "se" | "sw"; variant?: WalkerVariant }[];
}

/** Hand-marked rooms, keyed by interior art name (public/art/interiors). */
export const ROOMS: Record<string, Room> = {
  buka: {
    walkway: [
      [0.25, 0.74],
      [0.33, 0.8],
      [0.44, 0.85],
      [0.54, 0.9],
      [0.64, 0.86],
    ],
    walkers: 2,
    stations: [
      { action: "serve", at: [0.56, 0.58], dir: "sw", variant: "woman_buba" },
      { action: "stand_idle", at: [0.4, 0.75], dir: "se" },
      { action: "sit_eat", at: [0.24, 0.66], dir: "se", variant: "man_kaftan" },
      { action: "sit_eat", at: [0.38, 0.57], dir: "se", variant: "woman_gele" },
    ],
  },
  "event-centre": {
    walkway: [
      [0.36, 0.63],
      [0.46, 0.71],
      [0.56, 0.75],
      [0.62, 0.67],
      [0.52, 0.5],
    ],
    walkers: 2,
    stations: [
      { action: "dance", at: [0.45, 0.56], dir: "se" },
      { action: "dance", at: [0.53, 0.62], dir: "sw" },
      { action: "dance", at: [0.58, 0.55], dir: "se" },
      { action: "dance", at: [0.47, 0.65], dir: "sw" },
    ],
  },
  "viewing-centre": {
    // Rows of chairs fill the floor: everyone is seated watching, one person by the cooler.
    walkway: [[0.8, 0.66], [0.86, 0.7]],
    walkers: 0,
    stations: [
      { action: "sit_talk", at: [0.2, 0.68], dir: "se" },
      { action: "sit_talk", at: [0.36, 0.6], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.54, 0.6], dir: "se", variant: "man_casual" },
      { action: "sit_talk", at: [0.46, 0.82], dir: "se" },
      { action: "stand_idle", at: [0.7, 0.55], dir: "sw", variant: "man_casual" },
    ],
  },
  barbershop: {
    walkway: [
      [0.36, 0.86],
      [0.48, 0.88],
      [0.6, 0.8],
      [0.7, 0.72],
    ],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.62, 0.65], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.7, 0.62], dir: "sw", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.42, 0.78], dir: "se" },
    ],
  },
  "tailor-shop": {
    walkway: [
      [0.28, 0.78],
      [0.4, 0.85],
      [0.52, 0.89],
      [0.62, 0.81],
      [0.73, 0.74],
    ],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.22, 0.66], dir: "se", variant: "woman_buba" },
      { action: "stand_idle", at: [0.57, 0.76], dir: "sw", variant: "woman_gele" },
    ],
  },
  "bank-hall": {
    walkway: [
      [0.25, 0.75],
      [0.4, 0.82],
      [0.55, 0.85],
      [0.7, 0.76],
      [0.78, 0.67],
    ],
    walkers: 2,
    stations: [
      { action: "stand_idle", at: [0.57, 0.67], dir: "se" },
      { action: "stand_idle", at: [0.73, 0.63], dir: "sw" },
      { action: "sit_talk", at: [0.32, 0.64], dir: "se" },
    ],
  },
  gym: {
    walkway: [
      [0.42, 0.8],
      [0.52, 0.86],
      [0.62, 0.8],
      [0.72, 0.7],
      [0.8, 0.62],
    ],
    walkers: 1,
    stations: [
      { action: "dance", at: [0.67, 0.71], dir: "sw", variant: "woman_buba" },
      { action: "stand_idle", at: [0.78, 0.62], dir: "sw", variant: "man_casual" },
      { action: "stand_idle", at: [0.5, 0.76], dir: "se", variant: "man_kaftan" },
    ],
  },
  "boat-deck": {
    walkway: [
      [0.36, 0.56],
      [0.46, 0.62],
      [0.56, 0.58],
      [0.64, 0.5],
    ],
    walkers: 1,
    stations: [
      { action: "dance", at: [0.48, 0.52], dir: "se" },
      { action: "dance", at: [0.56, 0.47], dir: "sw" },
      { action: "serve", at: [0.62, 0.38], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.36, 0.46], dir: "se", variant: "woman_gele" },
    ],
  },
  church: {
    walkway: [
      [0.32, 0.74],
      [0.42, 0.7],
      [0.52, 0.66],
      [0.6, 0.6],
    ],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.49, 0.55], dir: "se", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.73, 0.52], dir: "sw", variant: "man_casual" },
      { action: "dance", at: [0.4, 0.63], dir: "se", variant: "woman_gele" },
      { action: "sit_talk", at: [0.16, 0.69], dir: "se", variant: "woman_buba" },
      { action: "sit_talk", at: [0.71, 0.7], dir: "sw" },
    ],
  },
  salon: {
    walkway: [
      [0.4, 0.82],
      [0.5, 0.76],
      [0.58, 0.68],
      [0.66, 0.62],
    ],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.52, 0.6], dir: "sw", variant: "woman_buba" },
      { action: "serve", at: [0.41, 0.7], dir: "se", variant: "woman_gele" },
      { action: "sit_talk", at: [0.87, 0.67], dir: "sw", variant: "woman_gele" },
      { action: "stand_idle", at: [0.74, 0.8], dir: "sw", variant: "schoolgirl" },
    ],
  },
  lounge: {
    walkway: [
      [0.22, 0.7],
      [0.3, 0.63],
      [0.4, 0.58],
      [0.52, 0.62],
    ],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.13, 0.5], dir: "se", variant: "man_casual" },
      { action: "dance", at: [0.22, 0.69], dir: "se", variant: "woman_gele" },
      { action: "dance", at: [0.29, 0.74], dir: "sw", variant: "man_kaftan" },
      { action: "serve", at: [0.36, 0.41], dir: "sw", variant: "woman_buba" },
      { action: "sit_talk", at: [0.7, 0.6], dir: "sw", variant: "woman_buba" },
    ],
  },
  mosque: {
    walkway: [
      [0.3, 0.7],
      [0.45, 0.78],
      [0.6, 0.82],
      [0.72, 0.72],
      [0.6, 0.62],
    ],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.4, 0.62], dir: "se", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.55, 0.7], dir: "se", variant: "man_casual" },
      { action: "stand_idle", at: [0.68, 0.64], dir: "sw", variant: "schoolboy" },
    ],
  },
  "car-showroom": {
    walkway: [
      [0.4, 0.88],
      [0.52, 0.88],
      [0.62, 0.82],
      [0.8, 0.68],
    ],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.38, 0.43], dir: "se", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.47, 0.6], dir: "sw", variant: "woman_gele" },
      { action: "stand_idle", at: [0.82, 0.64], dir: "sw", variant: "man_casual" },
    ],
  },
  classroom: {
    walkway: [],
    walkers: 0,
    stations: [
      { action: "stand_idle", at: [0.62, 0.46], dir: "se", variant: "woman_buba" },
      { action: "sit_talk", at: [0.52, 0.7], dir: "se", variant: "schoolgirl" },
      { action: "sit_talk", at: [0.68, 0.78], dir: "sw", variant: "schoolboy" },
      { action: "sit_talk", at: [0.8, 0.66], dir: "sw", variant: "schoolgirl" },
    ],
  },
  "hotel-lobby": {
    walkway: [
      [0.25, 0.72],
      [0.35, 0.8],
      [0.5, 0.86],
      [0.62, 0.8],
      [0.66, 0.73],
    ],
    walkers: 2,
    stations: [
      { action: "stand_idle", at: [0.3, 0.65], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.66, 0.63], dir: "sw", variant: "woman_gele" },
    ],
  },
  // Zip 15 (batches 29-31): rooms for the new places and clean redos.
  "provision-shop": {
    walkway: [[0.62, 0.62], [0.7, 0.7], [0.78, 0.76], [0.68, 0.8]],
    walkers: 1,
    stations: [{ action: "stand_idle", at: [0.6, 0.78], dir: "sw" }],
  },
  "golf-lounge": {
    walkway: [[0.6, 0.64], [0.68, 0.7], [0.78, 0.74], [0.72, 0.82]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.27, 0.6], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.5, 0.76], dir: "se" },
      { action: "stand_idle", at: [0.63, 0.66], dir: "sw" },
    ],
  },
  "stadium-room": {
    walkway: [[0.45, 0.62], [0.6, 0.7], [0.72, 0.8], [0.55, 0.85], [0.4, 0.75]],
    walkers: 2,
    stations: [
      { action: "sit_talk", at: [0.2, 0.62], dir: "se", variant: "man_casual" },
      { action: "sit_talk", at: [0.35, 0.56], dir: "se", variant: "man_casual" },
      { action: "stand_idle", at: [0.62, 0.55], dir: "sw", variant: "man_kaftan" },
    ],
  },
  "snooker-room": {
    walkway: [[0.3, 0.7], [0.45, 0.8], [0.6, 0.85], [0.78, 0.78], [0.85, 0.68]],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.42, 0.72], dir: "se", variant: "man_casual" },
      { action: "stand_idle", at: [0.76, 0.63], dir: "sw", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.67, 0.46], dir: "se" },
    ],
  },
  "police-desk": {
    walkway: [[0.4, 0.62], [0.5, 0.72], [0.62, 0.8], [0.5, 0.88], [0.35, 0.78]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.68, 0.45], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.18, 0.62], dir: "se" },
      { action: "stand_idle", at: [0.52, 0.62], dir: "se" },
    ],
  },
  "radio-studio": {
    walkway: [[0.8, 0.65], [0.85, 0.72], [0.74, 0.78]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.35, 0.5], dir: "se", variant: "woman_buba" },
      { action: "sit_talk", at: [0.6, 0.46], dir: "sw", variant: "man_casual" },
    ],
  },
  "hospital-ward": {
    walkway: [[0.42, 0.62], [0.5, 0.72], [0.6, 0.8], [0.45, 0.85]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.25, 0.52], dir: "se", variant: "woman_buba" },
      { action: "stand_idle", at: [0.66, 0.63], dir: "se", variant: "woman_gele" },
      { action: "stand_idle", at: [0.38, 0.72], dir: "sw" },
    ],
  },
  "library-room": {
    walkway: [[0.6, 0.62], [0.7, 0.72], [0.8, 0.78], [0.64, 0.83]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.18, 0.58], dir: "se", variant: "schoolgirl" },
      { action: "sit_talk", at: [0.38, 0.72], dir: "se", variant: "schoolboy" },
      { action: "serve", at: [0.8, 0.52], dir: "sw", variant: "woman_buba" },
    ],
  },
  courtroom: {
    walkway: [[0.5, 0.58], [0.6, 0.64], [0.55, 0.72]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.47, 0.38], dir: "se", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.62, 0.62], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.6, 0.83], dir: "se" },
    ],
  },
  hangout: {
    walkway: [[0.42, 0.6], [0.52, 0.62], [0.62, 0.57], [0.56, 0.66]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.3, 0.45], dir: "se", variant: "man_casual" },
      { action: "stand_idle", at: [0.72, 0.5], dir: "sw", variant: "woman_gele" },
      { action: "sit_talk", at: [0.33, 0.72], dir: "se" },
      { action: "sit_eat", at: [0.47, 0.82], dir: "se" },
    ],
  },
};

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

export function InteriorScene({ src, alt, room, seed = 1 }: { src: string; alt: string; room: Room | undefined; seed?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const posedEls = useRef<(HTMLDivElement | null)[]>([]);
  const [h, setH] = useState(0);
  const reduce = usePrefersReducedMotion();
  const walkway = room?.walkway ?? [];
  const variants: WalkerVariant[] = walkway.length > 1 ? Array.from({ length: room!.walkers }, (_, i) => WALKER_VARIANTS[(i * 2 + seed) % WALKER_VARIANTS.length]!) : [];
  const posed = (room?.stations ?? []).map((s, i) => {
    const vs = POSE_VARIANTS[s.action];
    return { ...s, variant: s.variant ?? vs[(i + seed) % vs.length]! };
  });

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
    // Each walker is between walkway spot `from` and `to`, `t` of the way.
    const people = variants.map((_, i) => {
      const from = Math.floor(rnd() * walkway.length);
      const to = from + 1 < walkway.length ? from + 1 : from - 1;
      return { from, to, t: rnd() * 0.8, wait: i * 1.2, walked: 0, dir: (to > from ? "se" : "nw") as WalkDir };
    });
    const width = box.current!.clientWidth;
    const pos = (p: (typeof people)[number]) => {
      const a = walkway[p.from]!;
      const b = walkway[p.to]!;
      return [a[0] + (b[0] - a[0]) * p.t, a[1] + (b[1] - a[1]) * p.t] as Pt;
    };
    const place = (i: number) => {
      const p = people[i]!;
      const el = els.current[i];
      if (!el) return;
      const [x, y] = pos(p);
      el.style.left = `${x * 100}%`;
      el.style.top = `${y * 100}%`;
      el.style.zIndex = String(Math.round(y * 1000));
      const frame = p.wait > 0 ? 0 : Math.floor(p.walked / 0.024) % 8;
      el.style.backgroundPosition = `${(frame / 7) * 100}% 0`;
      el.style.backgroundImage = `url(${walkerSheet(variants[i]!, p.dir)})`;
    };
    people.forEach((_, i) => place(i));
    if (reduce) return;
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      people.forEach((p, i) => {
        if (p.wait > 0) p.wait -= dt;
        else {
          const a = walkway[p.from]!;
          const b = walkway[p.to]!;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const speed = 0.06; // image widths per second
          const before = pos(p);
          p.t += (speed * dt) / len;
          if (p.t >= 1) {
            // Reached a spot: stand a moment, then carry on along the walkway (or turn back at its ends).
            p.t = 0;
            const forward = p.to > p.from;
            p.from = p.to;
            const ahead = forward ? p.from + 1 : p.from - 1;
            p.to = ahead >= 0 && ahead < walkway.length && rnd() > 0.25 ? ahead : forward ? p.from - 1 : p.from + 1;
            p.to = Math.max(0, Math.min(walkway.length - 1, p.to));
            p.wait = 0.8 + rnd() * 2.5;
          }
          const after = pos(p);
          p.walked += Math.hypot(after[0] - before[0], after[1] - before[1]);
          const nb = walkway[p.to]!;
          const na = walkway[p.from]!;
          p.dir = walkDir((nb[0] - na[0]) * width, (nb[1] - na[1]) * width);
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
  const size = { width: ph * 0.6, height: ph, marginTop: ph * 0.1 };
  return (
    <div ref={box} className="interior-scene">
      <img src={src} alt={alt} />
      {h > 0 &&
        variants.map((v, i) => <div key={`${v}-${i}`} ref={(el) => void (els.current[i] = el)} className="interior-npc" aria-hidden="true" style={size} />)}
      {h > 0 &&
        posed.map((p, i) => (
          <div
            key={`pose-${i}`}
            ref={(el) => void (posedEls.current[i] = el)}
            className="interior-npc"
            aria-hidden="true"
            style={{
              ...size,
              left: `${p.at[0] * 100}%`,
              top: `${p.at[1] * 100}%`,
              zIndex: Math.round(p.at[1] * 1000),
              backgroundImage: `url(/art/life/poses/${p.action}-${p.variant}-${p.dir}.webp)`,
            }}
          />
        ))}
    </div>
  );
}
