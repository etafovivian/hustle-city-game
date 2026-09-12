// Inside a place: the cutaway room, shown big, with people in it. Each room is marked up by hand (see ROOMS): a
// walkway through its open floor that walkers follow from spot to spot, and stations where people stay and do
// something (the cook at the pots, the barber by the chair, dancers on the dance floor, people seated on the benches).
// Positions are fractions of the image: where the person's feet touch the floor.
// The player can be in the room too (`player`): their own character comes in at the door, walks along the walkway to
// the spot for what they're doing (a seat, the bed, the dance floor, the barber's chair) and plays that pose there.
// Tapping the floor walks them there (snapped to the walkway). The caller changes what they do with `player.action`.
import type { AvatarConfig } from "@hc/shared";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from "react";
import { variantFor } from "./AvatarWalker.js";
import { close, nearestOnPolyline, routeTo } from "./interiorPath.js";
import { POSE_SHEETS, POSE_VARIANTS, ROOMS, type Facing, type PlayerAction, type PoseAction, type Pt, type Room, type Spot, type SpotKey, type Worker } from "./rooms.js";
import { WALKER_VARIANTS, walkDir, walkerSheet, type WalkDir, type WalkerVariant } from "./walkers.js";

export { ROOMS, type PlayerAction, type Room };

// Only some poses have a nw sheet (POSE_SHEETS nw); the others facing nw use their sw sheet.
const poseSheet = (action: PoseAction, v: WalkerVariant, d: Facing) =>
  `/art/life/poses/${action}-${v}-${d === "nw" && !POSE_SHEETS[action].nw ? "sw" : d}.webp`;

/** Box for a person `ph` tall showing a pose sheet (null: a walk sheet). Frames are sized in px of a 160 px tall
 * person; most are anchored at the feet (16 px up), lying ones on the middle of the body. */
function spriteBox(ph: number, pose: PoseAction | null): CSSProperties {
  const s = pose ? POSE_SHEETS[pose] : { w: 96, h: 160, frames: 8, centred: false };
  const k = ph / 160;
  const base = { width: s.w * k, height: s.h * k, backgroundSize: `${s.frames * 100}% 100%` };
  return s.centred ? { ...base, marginTop: 0, transform: "translate(-50%, -50%)" } : { ...base, marginTop: ph * 0.1 };
}
/** Background position for frame `f` of a sheet with `n` frames. */
const framePos = (f: number, n: number) => `${(f / (n - 1)) * 100}% 0`;

/** The usual pose for each thing the player does at a spot. */
const POSE_OF: Record<Exclude<PlayerAction, "walk">, PoseAction> = {
  sit: "sit_talk",
  eat: "sit_eat",
  sleep: "sleep",
  dance: "dance",
  chair: "sit_talk",
  stand: "stand_idle",
  pray: "pray_church",
  lift_weights: "lift_weights",
  boxing: "boxing",
  run: "run",
  pushups: "pushups",
  skip: "skip_rope",
};
/** Where to go when a room has no spot for an action: eat or rest on a seat, dance where you'd stand. */
const FALLBACK: Record<Exclude<PlayerAction, "walk">, SpotKey[]> = {
  sit: ["sit", "chair", "eat"],
  eat: ["eat", "sit"],
  sleep: ["sleep", "sit"],
  dance: ["dance", "stand"],
  chair: ["chair", "sit"],
  stand: ["stand"],
  pray: ["pray"],
  // workouts: their own equipment in the gym, the free floor at home
  lift_weights: ["lift_weights", "workout"],
  boxing: ["boxing", "workout"],
  run: ["run"],
  pushups: ["pushups", "workout"],
  skip: ["skip", "workout"],
};
/** The spot and pose for an action in a room (null: stay where you are). */
export function spotFor(room: Room | undefined, action: PlayerAction): { spot: Spot; pose: PoseAction } | null {
  if (action === "walk" || !room?.spots) return null;
  for (const key of FALLBACK[action]) {
    const spot = room.spots[key];
    if (!spot) continue;
    // A stand-in spot keeps the action's own pose where it makes sense (eat on a seat, dance on the stand spot);
    // resting on a seat (no bed) is sitting.
    const pose = spot.pose ?? (action === "sleep" && key !== "sleep" ? "sit_talk" : POSE_OF[action]);
    return { spot, pose };
  }
  return null;
}

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

export interface InteriorPlayer {
  avatar: AvatarConfig;
  /** What they're doing: they walk to the room's spot for it and play its pose ("walk": just come in). */
  action: PlayerAction;
}

export function InteriorScene({
  src,
  alt,
  room,
  seed = 1,
  player,
  onPlayerWalk,
}: {
  src: string;
  alt: string;
  room: Room | undefined;
  seed?: number;
  /** The player's own character in the room. Change `action` to send them to another spot. */
  player?: InteriorPlayer;
  /** The player tapped the floor and is walking there (so the caller can show them as walking, not sitting). */
  onPlayerWalk?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const posedEls = useRef<(HTMLDivElement | null)[]>([]);
  const [h, setH] = useState(0);
  const reduce = usePrefersReducedMotion();
  const walkway = room?.walkway ?? [];
  const variants: WalkerVariant[] = walkway.length > 1 ? Array.from({ length: room!.walkers }, (_, i) => WALKER_VARIANTS[(i * 2 + seed) % WALKER_VARIANTS.length]!) : [];
  const posed = (room?.stations ?? []).map((s, i) => {
    const vs = POSE_VARIANTS[s.action];
    // Only variants with a sheet for the pose (a marked variant without one falls back to the list).
    return { ...s, variant: s.variant && vs.includes(s.variant) ? s.variant : vs[(i + seed) % vs.length]! };
  });
  // Where the player has settled: whoever was posed there makes room.
  const [taken, setTaken] = useState<Pt | null>(null);

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
      // Posed people loop their sheets (each at its own phase, so nobody moves in step)
      posed.forEach((p, i) => {
        const el = posedEls.current[i];
        if (!el) return;
        const { fps, frames } = POSE_SHEETS[p.action];
        const frame = (Math.floor(((now - t0) / 1000) * fps) + (p.phase ?? i * 3)) % frames;
        el.style.backgroundPosition = framePos(frame, frames);
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, src, reduce]);

  // Tapping the floor walks the player there, kept to the walkway.
  const [tap, setTap] = useState<{ at: Pt; seq: number } | null>(null);
  const onTap = (e: MouseEvent<HTMLDivElement>) => {
    if (!player || walkway.length < 2 || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const p: Pt = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    const at = nearestOnPolyline(walkway, p, r.width / r.height).at;
    setTap((t) => ({ at, seq: (t?.seq ?? 0) + 1 }));
    onPlayerWalk?.();
  };

  // People stand about a fifth of the room's height (sprite frames are 96×160, feet 16 px above the bottom).
  const ph = h * 0.21;
  const size = spriteBox(ph, null);
  return (
    <div ref={box} className="interior-scene" onClick={player ? onTap : undefined} style={player && walkway.length > 1 ? { cursor: "pointer" } : undefined}>
      <img src={src} alt={alt} />
      {h > 0 && player && (
        <PlayerInRoom
          key={src}
          room={room}
          avatar={player.avatar}
          action={player.action}
          tap={tap}
          ph={ph}
          box={box}
          reduce={reduce}
          onSettle={(at) => setTaken((prev) => (prev === at || (prev && at && close(prev, at, 0.001)) ? prev : at))}
        />
      )}
      {h > 0 && (room?.workers ?? []).map((w, i) => <WorkerInRoom key={`${src}-w${i}`} worker={w} ph={ph} box={box} reduce={reduce} />)}
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
              ...spriteBox(ph, p.action),
              backgroundPosition: framePos(p.phase ?? 0, POSE_SHEETS[p.action].frames),
              left: `${p.at[0] * 100}%`,
              top: `${p.at[1] * 100}%`,
              zIndex: Math.round(p.at[1] * 1000),
              backgroundImage: `url(${poseSheet(p.action, p.variant, p.dir)})`,
              display: taken && close(taken, p.at) ? "none" : undefined,
            }}
          />
        ))}
    </div>
  );
}

/**
 * The player's own character in a room: comes in at the door, walks the walkway to the spot for `action` (or to
 * the last tapped point) and plays the pose there. Moves by setting styles in its own animation loop.
 */
function PlayerInRoom({
  room,
  avatar,
  action,
  tap,
  ph,
  box,
  reduce,
  onSettle,
}: {
  room: Room | undefined;
  avatar: AvatarConfig;
  action: PlayerAction;
  tap: { at: Pt; seq: number } | null;
  ph: number;
  box: RefObject<HTMLDivElement | null>;
  reduce: boolean;
  onSettle: (at: Pt | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const variant = variantFor(avatar);
  const walkway = room?.walkway ?? [];
  const door: Pt = room?.spots?.door?.at ?? walkway[0] ?? [0.5, 0.85];
  // Live state for the loop: where they are, the route ahead, and what to do on arrival.
  const me = useRef({ at: door, route: [] as Pt[], walked: 0, dir: "se" as WalkDir, pose: null as PoseAction | null, face: "se" as Facing, shown: null as PoseAction | null, t0: 0, settled: false, free: false, atSpot: false });
  /** The sheet on show (null while walking): sets the box size. */
  const [shown, setShown] = useState<PoseAction | null>(null);

  // A new action (or the first one): walk to its spot. "walk" just steps in from the door.
  useEffect(() => {
    const m = me.current;
    // Walking about after a tap: "walk" (which the caller may set on that tap) leaves the route alone.
    if (action === "walk" && m.free) return;
    m.free = false;
    const box0 = box.current;
    const aspect = box0 && box0.clientHeight ? box0.clientWidth / box0.clientHeight : 1;
    const target = spotFor(room, action);
    const to: Pt = target ? target.spot.at : walkway.length > 1 ? nearestOnPolyline(walkway, m.at, aspect).at : m.at;
    m.route = close(m.at, to, 0.002) ? [] : routeTo(walkway, m.at, to, aspect).slice(1);
    m.pose = target?.pose ?? (action === "dance" ? "dance" : "stand_idle");
    m.face = target?.spot.dir ?? m.face;
    m.atSpot = !!target;
    m.t0 = performance.now();
    m.settled = false;
    onSettle(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, room]);

  // A tap: walk there and stand.
  useEffect(() => {
    if (!tap) return;
    const m = me.current;
    const box0 = box.current;
    const aspect = box0 && box0.clientHeight ? box0.clientWidth / box0.clientHeight : 1;
    m.route = routeTo(walkway, m.at, tap.at, aspect).slice(1);
    m.pose = "stand_idle";
    m.free = true;
    m.settled = false;
    onSettle(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tap?.seq]);

  useEffect(() => {
    const m = me.current;
    let raf = 0;
    let last = performance.now();
    m.t0 = last;
    const draw = (now: number) => {
      const node = el.current;
      if (!node) return;
      node.style.left = `${m.at[0] * 100}%`;
      node.style.top = `${m.at[1] * 100}%`;
      // Just in front of anyone at the same depth (a seat's own furniture is part of the room image).
      node.style.zIndex = String(Math.round(m.at[1] * 1000) + 1);
      const pose = m.route.length ? null : (m.pose ?? "stand_idle");
      if (pose !== m.shown) {
        m.shown = pose;
        setShown(pose);
      }
      if (!pose) {
        const frame = Math.floor(m.walked / 0.024) % 8;
        node.style.backgroundImage = `url(${walkerSheet(variant, m.dir)})`;
        node.style.backgroundPosition = framePos(frame, 8);
      } else {
        const { fps, frames } = POSE_SHEETS[pose];
        const frame = reduce ? 0 : Math.floor(((now - m.t0) / 1000) * fps) % frames;
        node.style.backgroundImage = `url(${poseSheet(pose, variant, m.face)})`;
        node.style.backgroundPosition = framePos(frame, frames);
      }
    };
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const b = box.current;
      const aspect = b && b.clientHeight ? b.clientWidth / b.clientHeight : 1;
      if (m.route.length) {
        if (reduce) {
          m.at = m.route[m.route.length - 1]!;
          m.route = [];
        } else {
          let left = 0.14 * dt; // image widths per second: brisker than the people milling about
          while (left > 0 && m.route.length) {
            const next = m.route[0]!;
            const dx = (next[0] - m.at[0]) * aspect;
            const dy = next[1] - m.at[1];
            const d = Math.hypot(dx, dy);
            if (d > 1e-6) m.dir = walkDir(dx, dy);
            if (d <= left) {
              m.at = next;
              m.route.shift();
              left -= d;
              m.walked += d;
            } else {
              m.at = [m.at[0] + (dx / d / aspect) * left, m.at[1] + (dy / d) * left];
              m.walked += left;
              left = 0;
            }
          }
        }
        if (!m.route.length) {
          m.t0 = now;
          // Facing for standing after a walk: the way they were going (pose sheets face se or sw).
          // (atSpot, not `action`: this loop's closure only sees the action it started with.)
          if (m.free || !m.atSpot) m.face = m.dir === "sw" || m.dir === "nw" ? "sw" : "se";
        }
      }
      if (!m.route.length && !m.settled) {
        m.settled = true;
        onSettle(m.at);
      }
      draw(now);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, reduce]);

  return (
    <div ref={el} className="interior-npc interior-player" aria-label="You" style={{ ...spriteBox(ph, shown), left: `${door[0] * 100}%`, top: `${door[1] * 100}%` }}>
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: shown === "sleep" ? "8%" : "4%",
          transform: "translate(-50%, -100%)",
          padding: "1px 6px",
          borderRadius: 999,
          background: "#ffd23f",
          color: "#1b1410",
          font: "800 11px/1.3 system-ui, sans-serif",
          boxShadow: "0 1px 2px rgb(0 0 0 / 40%)",
          whiteSpace: "nowrap",
        }}
      >
        You
      </span>
    </div>
  );
}

/** A pose the look has a sheet for (the worker's own look, else the first that has it). */
const poseLook = (pose: PoseAction, v: WalkerVariant) => (POSE_VARIANTS[pose].includes(v) ? v : POSE_VARIANTS[pose][0]!);

/**
 * Someone at work in a room (see Room.workers): walks from task to task and holds each task's pose for a while,
 * round and round. A visitor comes in at the door, does the tasks once, leaves, and someone else comes in later.
 */
function WorkerInRoom({ worker, ph, box, reduce }: { worker: Worker; ph: number; box: RefObject<HTMLDivElement | null>; reduce: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<PoseAction | null>(null);
  useEffect(() => {
    const { tasks, visitor } = worker;
    if (!tasks.length) return;
    const first = visitor ? visitor.door : tasks[0]!.at;
    // i: the task being walked to or done; hold: seconds left there; away: seconds out of the room (visitors).
    const m = { at: first as Pt, i: 0, hold: -1, away: visitor ? (worker.start ?? 0) : 0, leaving: false, walked: 0, dir: "se" as WalkDir, look: worker.variant, visits: 0, shown: null as PoseAction | null, t0: 0 };
    if (!visitor && worker.start) m.hold = worker.start;
    let raf = 0;
    let last = performance.now();
    const target = (): Pt => (m.leaving ? visitor!.door : tasks[m.i]!.at);
    const draw = (now: number) => {
      const node = el.current;
      if (!node) return;
      node.style.display = m.away > 0 ? "none" : "";
      node.style.left = `${m.at[0] * 100}%`;
      node.style.top = `${m.at[1] * 100}%`;
      node.style.zIndex = String(Math.round(m.at[1] * 1000));
      const task = tasks[m.i]!;
      const pose = m.hold >= 0 && !m.leaving && task.pose ? task.pose : m.hold >= 0 && !m.leaving ? "stand_idle" : null;
      if (pose !== m.shown) {
        m.shown = pose;
        m.t0 = now;
        setShown(pose);
      }
      if (!pose) {
        node.style.backgroundImage = `url(${walkerSheet(m.look, m.dir)})`;
        node.style.backgroundPosition = framePos(Math.floor(m.walked / 0.024) % 8, 8);
      } else {
        const { fps, frames } = POSE_SHEETS[pose];
        const face: Facing = task.dir ?? (m.dir === "sw" || m.dir === "nw" ? "sw" : "se");
        node.style.backgroundImage = `url(${poseSheet(pose, poseLook(pose, m.look), face)})`;
        node.style.backgroundPosition = framePos(reduce ? 0 : Math.floor(((now - m.t0) / 1000) * fps) % frames, frames);
      }
    };
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const b = box.current;
      const aspect = b && b.clientHeight ? b.clientWidth / b.clientHeight : 1;
      if (m.away > 0) {
        m.away -= dt;
        if (m.away <= 0) {
          // The next visitor comes in.
          m.visits += 1;
          m.look = visitor!.variants[m.visits % visitor!.variants.length]!;
          m.at = visitor!.door;
          m.i = 0;
          m.hold = -1;
          m.leaving = false;
        }
      } else if (m.hold >= 0) {
        m.hold -= dt;
        if (m.hold < 0) {
          // Done here: on to the next task (a visitor leaves after the last one).
          if (visitor && m.i === tasks.length - 1) m.leaving = true;
          else m.i = (m.i + 1) % tasks.length;
          const next = tasks[m.i]!;
          if (!m.leaving && next.snap) m.at = next.at;
        }
      } else {
        const to = target();
        const dx = (to[0] - m.at[0]) * aspect;
        const dy = to[1] - m.at[1];
        const d = Math.hypot(dx, dy);
        const go = reduce ? d : 0.1 * dt; // image widths per second: purposeful, a bit quicker than browsers
        if (d > 1e-6) m.dir = walkDir(dx, dy);
        if (d <= go) {
          m.at = to;
          m.walked += d;
          if (m.leaving) {
            m.away = visitor!.away;
          } else m.hold = tasks[m.i]!.secs;
        } else {
          m.at = [m.at[0] + (dx / d / aspect) * go, m.at[1] + (dy / d) * go];
          m.walked += go;
        }
      }
      draw(now);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [worker, reduce]);
  // Placed from the first render (the loop takes over on its first frame); a visitor starts out of the room.
  const start = worker.visitor ? worker.visitor.door : (worker.tasks[0]?.at ?? [0.5, 0.8]);
  return (
    <div
      ref={el}
      className="interior-npc"
      aria-hidden="true"
      style={{ ...spriteBox(ph, shown), left: `${start[0] * 100}%`, top: `${start[1] * 100}%`, zIndex: Math.round(start[1] * 1000), display: worker.visitor ? "none" : undefined }}
    />
  );
}
