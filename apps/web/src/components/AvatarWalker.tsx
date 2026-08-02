// The player's avatar on the map: tap the ground to walk there (like a street walk).
// Animates on its own, so the big map doesn't re-render while you walk.
import type { AvatarConfig } from "@hc/shared";
import { useEffect, useRef, useState } from "react";
import { avatarUri } from "./Avatar.js";
import { walkRoute } from "./cityLayout.js";

type Point = { x: number; y: number };

const SPEED = 230; // world units per second
const WALK = { away: "/art/life/kaftan-walk-away.webp", toward: "/art/life/kaftan-walk-toward.webp" };
const H = 92;
const FRAME_W = (266 / 4) * (H / 128);
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
}: {
  avatar: AvatarConfig;
  nickname: string;
  /** Where the avatar stands the first time (before any saved spot). */
  start: Point;
  /** Latest tap; `seq` changes on every tap so tapping the same spot twice still walks. */
  target: (Point & { seq: number }) | null;
  plateScale: number;
  onBlocked: () => void;
}) {
  const [pos, setPos] = useState(() => loadPos(start));
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<{ down: boolean; mirror: boolean }>({ down: true, mirror: false });
  const posRef = useRef(pos);
  posRef.current = pos;
  const face = useRef(avatarUri(avatar));
  face.current = avatarUri(avatar);

  useEffect(() => {
    if (!target) return;
    const route = walkRoute(posRef.current, target);
    if (!route) {
      onBlocked();
      return;
    }
    const path = [...route];
    let raf = 0;
    let last = performance.now();
    setWalking(true);
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let p = posRef.current;
      let budget = SPEED * dt;
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
          // The walk art faces down-right (towards) and up-left (away); mirror for the other diagonals.
          const down = dy > 0;
          setFacing({ down, mirror: down ? dx < 0 : dx > 0 });
        }
      }
      posRef.current = p;
      setPos(p);
      if (path.length) raf = requestAnimationFrame(step);
      else {
        setWalking(false);
        savePos(p);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
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
        <g transform={facing.mirror ? "scale(-1 1)" : undefined}>
          <svg x={-FRAME_W / 2} y={-H} width={FRAME_W} height={H} overflow="hidden">
            <image href={facing.down ? WALK.toward : WALK.away} width={FRAME_W * 4} height={H} x={walking ? undefined : 0}>
              {walking && <animate attributeName="x" dur="0.5s" repeatCount="indefinite" calcMode="discrete" values={`0;${-FRAME_W};${-FRAME_W * 2};${-FRAME_W * 3}`} />}
            </image>
          </svg>
        </g>
        {/* Name plate with the player's face, kept readable at any zoom. */}
        <g transform={`translate(0 ${-H - 8}) scale(${plateScale * 0.85}) translate(${-plateW / 2} -34)`}>
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
