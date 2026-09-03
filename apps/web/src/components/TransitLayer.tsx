// Public transport on the map: the Coast Line's track and bridge, platforms, BRT and coach bays painted on the road,
// water bus routes on the lagoon, Sandbar Bay's sand, and a marker with a small name plate at every stop.
// Two parts, each in its own map layer: "ground" (flat, on the ground layer with the roads) and "labels" (markers,
// above the night tint, tappable). Stations, piers, shelters and the parked train stand with the street furniture
// (cityLayout PROPS), so they sort in depth with the buildings.
import { INK } from "../prints.js";
import { HALF, PIERS, RAIL_BRIDGE, RAIL_HALF, RAIL_PATH, RAIL_STATIONS, SANDBAR_PATH, SANDBAR_RIM_PATH, iso, isoRect, landmassAt, railDistance, strokeFor } from "./cityLayout.js";
import { TRANSIT_LINES, TRANSIT_STOPS, type TransitMode } from "./transitData.js";

type Pt = { x: number; y: number };
const ICON: Record<TransitMode, string> = { rail: "🚆", ferry: "⛴️", brt: "🚌", coach: "🚍" };
/** Marker ring colour per mode (the line colours are close to these). */
const RING: Record<TransitMode, string> = { rail: "#d9482b", ferry: "#14a3a3", brt: "#1f6fd1", coach: "#e07b1f" };

const d = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

/** A polyline shifted sideways by `off` (world units), with mitred corners. */
function offset(pts: Pt[], off: number): Pt[] {
  const norm = (p: Pt, q: Pt) => {
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: -(q.y - p.y) / l, y: (q.x - p.x) / l };
  };
  return pts.map((p, i) => {
    const n0 = i > 0 ? norm(pts[i - 1]!, p) : norm(p, pts[i + 1]!);
    const n1 = i < pts.length - 1 ? norm(p, pts[i + 1]!) : n0;
    const m = { x: n0.x + n1.x, y: n0.y + n1.y };
    const ml = Math.hypot(m.x, m.y) || 1;
    const k = off / Math.max(0.5, (m.x * n0.x + m.y * n0.y) / ml);
    return { x: p.x + (m.x / ml) * k, y: p.y + (m.y / ml) * k };
  });
}

// Split the track into the part on land and the part on the bridge (over the lagoon).
const BRIDGE_START = iso(RAIL_BRIDGE.a, RAIL_BRIDGE.b0);
const BRIDGE_END = iso(RAIL_BRIDGE.a, RAIL_BRIDGE.b1);
const onBridge = (p: Pt) => p.y >= BRIDGE_START.y - 1 && Math.abs(p.x - BRIDGE_START.x - (p.y - BRIDGE_START.y) * -2) < 2;
const TRACK_LAND = RAIL_PATH.filter((p, i) => i === 0 || !onBridge(p) || !onBridge(RAIL_PATH[i - 1]!));
const RAIL_PILLARS: Pt[] = (() => {
  const out: Pt[] = [];
  const n = Math.floor(Math.hypot(BRIDGE_END.x - BRIDGE_START.x, BRIDGE_END.y - BRIDGE_START.y) / 150);
  for (let i = 1; i < n; i++) {
    const p = { x: BRIDGE_START.x + ((BRIDGE_END.x - BRIDGE_START.x) * i) / n, y: BRIDGE_START.y + ((BRIDGE_END.y - BRIDGE_START.y) * i) / n };
    if (!landmassAt(p.x, p.y + 30)) out.push(p);
  }
  return out;
})();

/** Water bus routes as dashed pieces, broken where they pass under a bridge. */
const FERRY_PIECES = TRANSIT_LINES.filter((l) => l.mode === "ferry").map((l) => {
  const pieces: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = 1; i < l.path.length; i++) {
    const [p, q] = [l.path[i - 1]!, l.path[i]!];
    const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 20));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const c = { x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n };
      const under = landmassAt(c.x, c.y) === "bridge" || railDistance(c.x, c.y) < 48;
      if (under) {
        if (cur.length > 1) pieces.push(cur);
        cur = [];
      } else cur.push(c);
    }
  }
  if (cur.length > 1) pieces.push(cur);
  return { key: l.key, color: l.color, d: pieces.map(d).join(" ") };
});

/** Painted bays where buses and coaches stop: a box on the lane along the road, with the mode written in it. */
const BAYS = TRANSIT_LINES.filter((l) => l.mode === "brt" || l.mode === "coach").flatMap((l) =>
  l.stopAt.map((at, i) => {
    const p = l.path[at]!;
    const prev = l.path[Math.max(0, at - 1)]!;
    const next = l.path[Math.min(l.path.length - 1, at + 1)]!;
    // Along the road (both ways round), on the 2:1 axes
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const slope = Math.abs(dx) < 1 ? 0.5 : Math.sign(dy / dx) * 0.5 || 0.5;
    return { key: `${l.key}-${l.stops[i]}`, x: p.x, y: p.y, slope, coach: l.mode === "coach" };
  }),
);

export function TransitLayer({ part, k = 1, plateScale = 1, onStop }: { part: "ground" | "labels"; k?: number; plateScale?: number; onStop?: (id: string) => void }) {
  if (part === "ground") {
    const near = k >= 0.3;
    return (
      <g aria-hidden="true" className="transit-ground">
        {/* Sandbar Bay: a pale wet rim, then the sand */}
        <path d={SANDBAR_RIM_PATH} fill="#e9f4f6" opacity=".45" />
        <path d={SANDBAR_PATH} fill="#ecd39c" stroke="#f6e6bd" strokeWidth="8" />
        <path d={SANDBAR_PATH} fill="url(#sand)" opacity=".6" />

        {/* Water bus routes, dashed on the water */}
        {FERRY_PIECES.map((f) => (
          <path key={f.key} d={f.d} fill="none" stroke={f.color} strokeOpacity=".75" strokeWidth={near ? 7 : 16} strokeDasharray={near ? "26 18" : "60 40"} strokeLinecap="round" />
        ))}

        {/* The rail bridge: pillars in the water, then the deck with its parapets */}
        {RAIL_PILLARS.map((p, i) => (
          <rect key={i} x={p.x - 8} y={p.y + 14} width="16" height="56" rx="3" fill="#8a8f98" stroke="#5d626b" strokeWidth="2" />
        ))}
        <path d={d([BRIDGE_START, BRIDGE_END])} stroke="#cfd3d8" strokeWidth={strokeFor(RAIL_HALF) + 14} strokeLinecap="butt" />
        <path d={d([BRIDGE_START, BRIDGE_END])} stroke="#8d867c" strokeWidth={strokeFor(RAIL_HALF) + 2} strokeLinecap="butt" />

        {/* Platforms */}
        {RAIL_STATIONS.map((s) => (
          <path key={s.id} d={isoRect(s.platform.a0, s.platform.a1, s.platform.b0, s.platform.b1)} fill="#d8d2c4" stroke="#a59f91" strokeWidth="3" />
        ))}

        {/* Track: ballast bed (on land), sleepers, then the two rails. Where it crosses a road it is a level crossing. */}
        <path d={d(TRACK_LAND)} fill="none" stroke="#7d7468" strokeWidth={strokeFor(RAIL_HALF)} strokeLinejoin="round" />
        <path d={d(RAIL_PATH)} fill="none" stroke="#5b4a3a" strokeWidth={strokeFor(RAIL_HALF) - 10} strokeDasharray="5 9" />
        {[-7, 7].map((o) => (
          <path key={o} d={d(offset(RAIL_PATH, o))} fill="none" stroke="#d8dbe0" strokeWidth="3.5" strokeLinejoin="round" />
        ))}
        {/* Buffer stops at both ends */}
        {[RAIL_PATH[0]!, RAIL_PATH[RAIL_PATH.length - 1]!].map((p, i) => (
          <rect key={i} x={p.x - 12} y={p.y - 12} width="24" height="14" rx="3" fill="#f2c14e" stroke="#2b2b2b" strokeWidth="3" />
        ))}

        {/* Bus and coach bays painted on the lane */}
        {near &&
          BAYS.map((b) => {
            const L = 70;
            const w = HALF / 2 - 4;
            const pts = [
              { x: b.x - L, y: b.y - b.slope * L - w },
              { x: b.x + L, y: b.y + b.slope * L - w },
              { x: b.x + L, y: b.y + b.slope * L + w },
              { x: b.x - L, y: b.y - b.slope * L + w },
            ];
            const angle = (Math.atan(b.slope) * 180) / Math.PI;
            return (
              <g key={b.key}>
                <path d={`${d(pts)}Z`} fill={b.coach ? "#e07b1f" : "#1f6fd1"} fillOpacity=".55" stroke="#f4f1e8" strokeWidth="3" strokeDasharray="10 6" />
                <text x={b.x} y={b.y + 5} transform={`rotate(${angle} ${b.x} ${b.y})`} textAnchor="middle" fontSize="15" fontWeight="900" fill="#f4f1e8" letterSpacing="2">
                  {b.coach ? "COACH" : "BRT"}
                </text>
              </g>
            );
          })}
      </g>
    );
  }

  // Labels: a marker over each stop; names up close. Small and see-through, like the venue badges.
  const showName = k >= 0.35;
  const s = Math.min(plateScale, 4) * 0.8;
  return (
    <g className="transit-labels">
      {TRANSIT_STOPS.map((st) => {
        const mode = st.modes[0]!;
        const pier = PIERS.some((p) => p.id === st.id);
        const nameW = st.name.length * 6.6 + 18;
        return (
          <g
            key={st.id}
            className="venue-badge transit-stop"
            transform={`translate(${st.x} ${st.y - (pier ? 70 : 40)}) scale(${s})`}
            onClick={() => onStop?.(st.id)}
            role={onStop ? "button" : undefined}
            aria-label={onStop ? `${st.name}. Open.` : undefined}
            aria-hidden={onStop ? undefined : true}
          >
            <line x1="0" y1="14" x2="0" y2="26" stroke="#fff" strokeWidth="3" opacity=".8" />
            <circle r="15" fill="#fff" fillOpacity=".85" stroke={RING[mode]} strokeWidth="3" />
            <text y="5.5" textAnchor="middle" fontSize="15">
              {st.modes.map((m) => ICON[m]).join("")}
            </text>
            {showName && (
              <g transform="translate(18 -9)">
                <rect width={nameW} height="18" rx="9" fill="#fff" fillOpacity=".7" stroke={INK.indigoDeep} strokeOpacity=".4" strokeWidth="1" />
                <text x={nameW / 2} y="12.5" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK.indigoDeep}>
                  {st.name}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
