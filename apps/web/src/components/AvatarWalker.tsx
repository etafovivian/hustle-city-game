// The player's avatar on the map: tap the ground to walk there (like a street walk).
// Animates on its own, so the big map doesn't re-render while you walk.
import { RIDE_BY_MODE, VEHICLE_BY_KIND, bodyOf, type AvatarConfig, type RideMode, type VehicleKind } from "@hc/shared";
import { useEffect, useRef, useState } from "react";
import { avatarUri } from "./Avatar.js";
import { roadRoute, walkRoute } from "./cityLayout.js";
import { vehicleView } from "./StreetLife.js";
import { outfitVariant, walkDir, walkerSheet, walkerSize, type WalkDir, type WalkerVariant } from "./walkers.js";

type Point = { x: number; y: number };
/** Where to go, and how: on foot, or a paid ride (which the area boys may stop partway). */
export type Trip = Point & { seq: number; mode?: RideMode | "own"; vehicle?: VehicleKind; rideId?: string; stop?: boolean };

const SPEED = 300; // world units per second (walking)
// The player's walker is a bit bigger than street walkers so you can spot yourself.
const WALK = walkerSize(84);

/** The rendered walker closest to the player's chosen look. */
export function variantFor(a: AvatarConfig): WalkerVariant {
  // Their exact body and outfit; the older looks only for a combination that has no sheet.
  const exact = outfitVariant(bodyOf(a), a.outfit);
  if (exact) return exact;
  if (bodyOf(a) === "woman") return a.outfit === "peplum_coral" || a.hairStyle === "gele" ? "woman_gele" : "woman_buba";
  return ["agbada_white", "kaftan_gold", "ankara_green"].includes(a.outfit) ? "man_kaftan" : "man_casual";
}
const STORE = "hc_avatar_pos";

function loadPos(fallback: Point): Point {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null") as Point | null;
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) return v;
  } catch {
    /* storage can be blocked; start at the default spot */
  }
  return fallback;
}
function savePos(p: Point) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) }));
  } catch {
    /* not essential */
  }
}

export function AvatarWalker({
  avatar,
  nickname,
  start,
  target,
  plateScale,
  onBlocked,
  onStop,
  onArrive,
  posOut,
}: {
  avatar: AvatarConfig;
  nickname: string;
  /** Where the avatar stands the first time (before any saved spot). */
  start: Point;
  /** Latest tap; `seq` changes on every tap so tapping the same spot twice still walks. */
  target: Trip | null;
  plateScale: number;
  onBlocked: () => void;
  /** The area boys stopped the ride: resolves when the player has dealt with them. */
  onStop?: (rideId: string) => Promise<void>;
  /** Reached the end of a trip. */
  onArrive?: (trip: Trip) => void;
  /** Kept up to date with where the player is (for pricing rides from here). */
  posOut?: { current: Point };
}) {
  const [pos, setPos] = useState(() => loadPos(start));
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<WalkDir>("se");
  const posRef = useRef(pos);
  posRef.current = pos;
  if (posOut) posOut.current = pos;
  /** The vehicle art being ridden ("walk" on foot). */
  const [riding, setRiding] = useState<string>("walk");
  const face = useRef(avatarUri(avatar));
  face.current = avatarUri(avatar);

  useEffect(() => {
    if (!target) return;
    // Rides keep to the roads; walkers to the pavements and zebras.
    const route = target.mode && target.mode !== "walk" ? roadRoute(posRef.current, target) : walkRoute(posRef.current, target);
    if (!route) {
      onBlocked();
      return;
    }
    const path = [...route];
    const mode = target.mode ?? "walk";
    const own = mode === "own" ? VEHICLE_BY_KIND.get(target.vehicle ?? "bike") : undefined;
    const speed = own?.speed ?? RIDE_BY_MODE.get(mode as RideMode)?.speed ?? SPEED;
    const art = own?.art ?? RIDE_BY_MODE.get(mode as RideMode)?.vehicle ?? "walk";
    let total = 0;
    for (let i = 0, prev = posRef.current; i < path.length; prev = path[i]!, i++) total += Math.hypot(path[i]!.x - prev.x, path[i]!.y - prev.y);
    let travelled = 0;
    let stopPending = Boolean(target.stop && target.rideId && onStop);
    let raf = 0;
    let cancelled = false;
    let last = performance.now();
    setWalking(true);
    setRiding(art);
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
      let budget = speed * dt;
      travelled += budget;
      while (budget > 0 && path.length) {
        const next = path[0]!;
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= budget) {
          p = next;
          path.shift();
          budget -= dist;
        } else {
          p = { x: p.x + (dx / dist) * budget, y: p.y + (dy / dist) * budget };
          budget = 0;
          setFacing(walkDir(dx, dy));
        }
      }
      posRef.current = p;
      setPos(p);
      if (path.length) raf = requestAnimationFrame(step);
      else {
        setWalking(false);
        setRiding("walk");
        savePos(p);
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

  const plateW = 80;
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
        {walking && riding !== "walk" ? (
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
        {/* Name plate with the player's face, kept readable at any zoom. */}
        <g transform={`translate(0 ${-WALK.h + WALK.ground - 4}) scale(${plateScale * 0.85}) translate(${-plateW / 2} -34)`}>
          <rect width={plateW} height="30" rx="15" fill="#ffc72c" stroke="#0a0f24" strokeWidth="2" />
          <image href={face.current} x="3" y="3" width="24" height="24" />
          <text x={(plateW + 26) / 2} y="20" textAnchor="middle" fontSize="15" fontWeight="900" fill="#0a0f24">
            You
          </text>
        </g>
      </g>
    </g>
  );
}
