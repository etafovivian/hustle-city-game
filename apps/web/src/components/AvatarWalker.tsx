// The player's avatar on the map: tap the ground to walk there (like a street walk).
// Animates on its own, so the big map doesn't re-render while you walk.
import { JOURNEY_EVENT_AT, RIDE_BY_MODE, TRANSIT, type CoachEventKey, VEHICLE_BY_KIND, bodyOf, type AvatarConfig, type RideMode, type TransitKind, type VehicleKind } from "@hc/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { avatarUri } from "./Avatar.js";
import { CX, CY, HALF, ROUNDABOUT, roadRoute, walkRoute } from "./cityLayout.js";
import { vehicleView } from "./StreetLife.js";
import { outfitVariant, walkDir, walkerSheet, walkerSize, type WalkDir, type WalkerVariant } from "./walkers.js";

type Point = { x: number; y: number };
/** Where to go, and how: on foot, or a paid ride (which the area boys may stop partway). */
export type Trip = Point & {
  seq: number;
  mode?: RideMode | "own" | "transit";
  vehicle?: VehicleKind;
  rideId?: string;
  stop?: boolean;
  /** Public transport: walk to the stop, wait, ride the line, walk on (paths already planned). */
  legs?: { kind: "walk" | TransitKind; path: Point[]; rideId?: string; events?: string[] }[];
};
/** A point on the way, with how fast to go to it, what you're riding, a wait when you get there, and something
 * that happens there on a coach trip (the ride pauses until it's dealt with). */
type Waypoint = Point & { speed: number; art: string; wait?: number; halt?: { rideId: string; event: string } };

/** A ride leg's points, with each road event put in at an even share of the way along. */
function withHalts(path: Point[], rideId: string | undefined, events: string[] | undefined): (Point & { halt?: { rideId: string; event: string } })[] {
  if (!rideId || !events?.length || path.length < 2) return path;
  const out: (Point & { halt?: { rideId: string; event: string } })[] = [path[0]!];
  const lens = path.slice(1).map((p, i) => Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y));
  const total = lens.reduce((a, b) => a + b, 0);
  // Spread evenly, except the ones tied to a moment (the gate before take-off, the landing at the end).
  const marks = events.map((event, k) => ({ at: total * (JOURNEY_EVENT_AT[event as CoachEventKey] ?? (k + 1) / (events.length + 1)), event })).sort((a, b) => a.at - b.at);
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const l = lens[i - 1]!;
    while (marks.length && marks[0]!.at <= run + l) {
      const m = marks.shift()!;
      const t = l ? (m.at - run) / l : 0;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, halt: { rideId, event: m.event } });
    }
    out.push(b);
    run += l;
  }
  return out;
}

const SPEED = 300; // world units per second (walking)

/**
 * A road route moved into the lane for its direction (drive on the right, like the traffic: heading east, the
 * lower half of the road), instead of straddling both lanes on the centre line. Round the Junction 101 roundabout
 * the route is already on the ring's lane.
 */
function keepRight(route: Point[]): Point[] {
  if (route.length < 2) return route;
  const onRing = (p: Point) => ((p.x - CX) / (ROUNDABOUT.lane.rx + 40)) ** 2 + ((p.y - CY) / (ROUNDABOUT.lane.ry + 20)) ** 2 < 1;
  const lane = (a: Point, b: Point) => (b.x >= a.x ? HALF / 2 : -HALF / 2);
  const out: Point[] = [];
  for (let i = 0; i < route.length; i++) {
    const p = route[i]!;
    if (onRing(p)) {
      out.push(p);
      continue;
    }
    const inLane = i > 0 ? lane(route[i - 1]!, p) : lane(p, route[1]!);
    const outLane = i < route.length - 1 ? lane(p, route[i + 1]!) : inLane;
    out.push({ x: p.x, y: p.y + inLane });
    // Turning back the other way: cross over to the other lane here.
    if (outLane !== inLane) out.push({ x: p.x, y: p.y + outLane });
  }
  return out;
}
// The player's walker is a bit bigger than street walkers so you can spot yourself.
const WALK = walkerSize(70);

/** The rendered walker closest to the player's chosen look. */
export function variantFor(a: AvatarConfig): WalkerVariant {
  // Their exact body and outfit; the older looks only for a combination that has no sheet.
  const exact = outfitVariant(bodyOf(a), a.outfit);
  if (exact) return exact;
  if (bodyOf(a) === "woman") return a.outfit === "peplum_coral" || a.hairStyle === "gele" ? "woman_gele" : "woman_buba";
  return ["agbada_white", "kaftan_gold", "ankara_green"].includes(a.outfit) ? "man_kaftan" : "man_casual";
}
const STORE = "hc_avatar_pos";

/** Where to start: the newer of this device's last spot and the account's (another device may have moved on). */
function loadPos(fallback: Point, server: { x: number; y: number; at: string } | null | undefined): Point {
  let local: (Point & { at?: string }) | null = null;
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null") as (Point & { at?: string }) | null;
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) local = v;
  } catch {
    /* storage can be blocked; start at the default spot */
  }
  if (server && (!local || !local.at || Date.parse(server.at) > Date.parse(local.at))) return { x: server.x, y: server.y };
  return local ? { x: local.x, y: local.y } : fallback;
}
/** Remember where the player stopped: on this device, and on their account (only when a trip ends). */
function savePos(p: Point, sync = false) {
  const at = new Date().toISOString();
  try {
    localStorage.setItem(STORE, JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y), at }));
  } catch {
    /* not essential */
  }
  if (sync) void api("PUT", "/api/me/position", { x: p.x, y: p.y }).catch(() => undefined);
}

export function AvatarWalker({
  avatar,
  nickname,
  start,
  target,
  lastPos,
  plateScale,
  onBlocked,
  onStop,
  onCoach,
  onArrive,
  posOut,
}: {
  avatar: AvatarConfig;
  nickname: string;
  /** Where the avatar stands the first time (before any saved spot). */
  start: Point;
  /** Where the account last stopped (from /api/me): wins over this device's spot when it's newer. */
  lastPos?: { x: number; y: number; at: string } | null;
  /** Latest tap; `seq` changes on every tap so tapping the same spot twice still walks. */
  target: Trip | null;
  plateScale: number;
  onBlocked: () => void;
  /** The area boys stopped the ride: resolves when the player has dealt with them. */
  onStop?: (rideId: string) => Promise<void>;
  /** Something on the road during a coach trip; the trip goes on when this resolves. */
  onCoach?: (rideId: string, event: string) => Promise<void>;
  /** Reached the end of a trip. */
  onArrive?: (trip: Trip) => void;
  /** Kept up to date with where the player is (for pricing rides from here). */
  posOut?: { current: Point };
}) {
  const [pos, setPos] = useState(() => loadPos(start, lastPos));
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<WalkDir>("se");
  const posRef = useRef(pos);
  posRef.current = pos;
  if (posOut) posOut.current = pos;
  /** The vehicle art being ridden ("walk" on foot). */
  const [riding, setRiding] = useState<string>("walk");
  /** Waiting at a stop for this kind of transport. */
  const [waiting, setWaiting] = useState<TransitKind | null>(null);
  /** Direction of travel in screen radians (the train lines up with its track). */
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    if (!target) return;
    let path: Waypoint[];
    if (target.legs) {
      // Transit: each leg at its own speed; a wait at the stop before each ride.
      path = target.legs.flatMap((leg) => {
        const ride = leg.kind !== "walk" ? TRANSIT[leg.kind] : null;
        return withHalts(leg.path, leg.rideId, leg.events).map((p, i) => ({ ...p, speed: ride?.speed ?? SPEED, art: ride ? leg.kind : "walk", wait: ride && i === 0 ? ride.wait : undefined }));
      });
    } else {
      // Rides keep to the roads; walkers to the pavements and zebras.
      const road = target.mode && target.mode !== "walk" ? roadRoute(posRef.current, target) : null;
      const route = target.mode && target.mode !== "walk" ? (road ? [...keepRight(road.slice(0, -1)), road[road.length - 1]!] : null) : walkRoute(posRef.current, target);
      if (!route) {
        onBlocked();
        return;
      }
      const mode = target.mode ?? "walk";
      const own = mode === "own" ? VEHICLE_BY_KIND.get(target.vehicle ?? "bike") : undefined;
      const speed = own?.speed ?? RIDE_BY_MODE.get(mode as RideMode)?.speed ?? SPEED;
      const art = own?.art ?? RIDE_BY_MODE.get(mode as RideMode)?.vehicle ?? "walk";
      path = route.map((p) => ({ ...p, speed, art }));
    }
    const art = path[0]?.art ?? "walk";
    let total = 0;
    for (let i = 0, prev = posRef.current; i < path.length; prev = path[i]!, i++) total += Math.hypot(path[i]!.x - prev.x, path[i]!.y - prev.y);
    let travelled = 0;
    let waitUntil = 0;
    let stopPending = Boolean(target.stop && target.rideId && onStop);
    let raf = 0;
    let cancelled = false;
    let last = performance.now();
    setWalking(true);
    setRiding(art);
    let shownArt = art;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Partway through, the area boys block the road: wait until the player has dealt with them.
      if (stopPending && travelled >= total * 0.45) {
        stopPending = false;
        onStop!(target.rideId!).then(() => {
          if (cancelled) return;
          last = performance.now();
          raf = requestAnimationFrame(step);
        });
        return;
      }
      let p = posRef.current;
      // Waiting at a stop for the next bus, train or boat.
      if (now < waitUntil) {
        raf = requestAnimationFrame(step);
        return;
      }
      setWaiting(null);
      let budget = (path[0]?.speed ?? SPEED) * dt;
      travelled += budget;
      while (budget > 0 && path.length) {
        const next = path[0]!;
        if (next.art !== shownArt) {
          shownArt = next.art;
          setRiding(next.art);
        }
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (next.halt && dist <= budget && onCoach) {
          // Something on the road: the coach stops until the player has dealt with it.
          const halt = next.halt;
          posRef.current = { x: next.x, y: next.y };
          setPos(posRef.current);
          path[0] = { ...next, halt: undefined };
          onCoach(halt.rideId, halt.event).then(() => {
            if (cancelled) return;
            last = performance.now();
            raf = requestAnimationFrame(step);
          });
          return;
        }
        if (next.wait && dist <= budget) {
          // At the stop: board after the wait.
          p = { x: next.x, y: next.y };
          path[0] = { ...next, wait: undefined };
          waitUntil = now + next.wait * 1000;
          setWaiting(next.art as TransitKind);
          setRiding("walk");
          shownArt = "walk";
          break;
        }
        if (dist <= budget) {
          p = next;
          path.shift();
          budget -= dist;
        } else {
          p = { x: p.x + (dx / dist) * budget, y: p.y + (dy / dist) * budget };
          budget = 0;
          setFacing(walkDir(dx, dy));
          setHeading(Math.atan2(dy, dx));
        }
      }
      posRef.current = p;
      setPos(p);
      if (path.length) raf = requestAnimationFrame(step);
      else {
        setWalking(false);
        setWaiting(null);
        setRiding("walk");
        savePos(p, true);
        onArrive?.(target);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      savePos(posRef.current);
    };
    // A new tap replaces the walk in progress.
  }, [target?.seq]);

  return (
    <g aria-label={`${nickname} (you)`} className="me-walker" pointerEvents="none">
      {walking && target && (
        <g transform={`translate(${target.x} ${target.y})`}>
          <ellipse rx="34" ry="17" fill="none" stroke="#ffc72c" strokeWidth="4">
            <animate attributeName="rx" values="16;38;16" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="ry" values="8;19;8" dur="1.2s" repeatCount="indefinite" />
          </ellipse>
        </g>
      )}
      <g transform={`translate(${pos.x} ${pos.y})`}>
        <ellipse rx="18" ry="6" fill="rgb(0 0 0 / 30%)" />
        <ellipse rx="26" ry="11" fill="none" stroke="#ffc72c" strokeWidth="3" />
        {walking && riding === "rail" ? (
          // The train (Stitch three-car sheet), turned to the way it's going along the track.
          (() => {
            const v = vehicleView("train", walkDir(Math.cos(heading), Math.sin(heading)));
            return (
              <g transform={v.mirror ? "scale(-1 1)" : undefined}>
                <image href={v.href} x={-v.w / 2} y={-v.h + 20} width={v.w} height={v.h} />
              </g>
            );
          })()
        ) : walking && riding === "flight" ? (
          // The plane (Stitch airport jets): nose up-right or down-left, mirrored for the other two ways.
          (() => {
            const d = walkDir(Math.cos(heading), Math.sin(heading));
            const up = d === "ne" || d === "nw";
            const mirror = d === "nw" || d === "se";
            return (
              <g transform={`translate(0 -60)${mirror ? " scale(-1 1)" : ""}`}>
                {up ? <image href="/art/props/jet-ne.webp" x={-160} y={-94} width={320} height={187} /> : <image href="/art/props/jet-sw.webp" x={-130} y={-101} width={260} height={202} />}
              </g>
            );
          })()
        ) : walking && riding === "ferry" ? (
          // The water bus (drawn bow to the left): flipped when it heads right.
          <g transform={Math.cos(heading) > 0 ? "scale(-1 1)" : undefined}>
            <image href="/art/life/water-bus.webp" x={-110} y={-140} width={220} height={156} />
          </g>
        ) : walking && riding !== "walk" ? (
          (() => {
            const v = vehicleView(riding, facing);
            const w = v.w * 1.25;
            const h = v.h * 1.25;
            return (
              <g transform={v.mirror ? "scale(-1 1)" : undefined}>
                <image href={v.href} x={-w / 2} y={-h + 7} width={w} height={h} />
              </g>
            );
          })()
        ) : (
        <svg x={-WALK.w / 2} y={-WALK.h + WALK.ground} width={WALK.w} height={WALK.h} overflow="hidden">
          <image href={walkerSheet(variantFor(avatar), facing)} width={WALK.w * WALK.frames} height={WALK.h} x={walking ? undefined : 0}>
            {walking && (
              <animate attributeName="x" dur="0.8s" repeatCount="indefinite" calcMode="discrete" values={Array.from({ length: WALK.frames }, (_, f) => -WALK.w * f).join(";")} />
            )}
          </image>
        </svg>
        )}
        {waiting && (
          <g transform={`translate(0 ${-WALK.h + WALK.ground - 40}) scale(${plateScale * 0.8})`}>
            <rect x={-80} y={-26} width={160} height={24} rx={12} fill="rgb(10 15 36 / 85%)" />
            <text y={-9} textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">
              {TRANSIT[waiting].icon} Waiting for the {TRANSIT[waiting].label}…
            </text>
          </g>
        )}
      </g>
    </g>
  );
}

/**
 * Your name plate, drawn above everything (your character is depth-sorted, so a building in front can hide you;
 * the plate still shows where you are). It follows your position directly, without re-rendering the map.
 */
export function YouPlate({ avatar, pos, plateScale }: { avatar: AvatarConfig; pos: { current: Point }; plateScale: number }) {
  const g = useRef<SVGGElement>(null);
  const face = avatarUri(avatar);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const p = pos.current;
      g.current?.setAttribute("transform", `translate(${p.x} ${p.y})`);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pos]);
  const plateW = 80;
  return (
    <g ref={g} className="you-plate" pointerEvents="none" aria-hidden="true">
      <g transform={`translate(0 ${-WALK.h + WALK.ground - 4}) scale(${plateScale * 0.85}) translate(${-plateW / 2} -34)`}>
        <rect width={plateW} height="30" rx="15" fill="#ffc72c" stroke="#0a0f24" strokeWidth="2" />
        <image href={face} x="3" y="3" width="24" height="24" />
        <text x={(plateW + 26) / 2} y="20" textAnchor="middle" fontSize="15" fontWeight="900" fill="#0a0f24">
          You
        </text>
      </g>
    </g>
  );
}
