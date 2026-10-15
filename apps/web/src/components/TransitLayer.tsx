// Public transport on the map: the Coast Line's track and bridge, platforms, BRT and coach bays painted on the road,
// water bus routes on the lagoon, Sandbar Bay's sand, and a marker with a small name plate at every stop.
// Three parts: "land" (the ground under everything, drawn first: the map's sand reaching north into Ogun State and
// Olumo Rock's hill), "ground" (flat, on the ground layer with the roads: tracks, bays, the Ogun River) and "labels"
// (markers, above the night tint, tappable). Stations, piers, shelters and the parked train stand with the street furniture
// (cityLayout PROPS), so they sort in depth with the buildings.
import { INK } from "../prints.js";
import {
  CX,
  CY,
  HALF,
  OGUN_RAIL_PATH,
  OGUN_RAIL_STATIONS,
  OLUMO_HILL,
  PIERS,
  RAIL_BRIDGE,
  RAIL_HALF,
  RAIL_PATH,
  RAIL_STATIONS,
  RIVER_HALF,
  RIVER_PTS,
  SANDBAR_PATH,
  SANDBAR_RIM_PATH,
  WORLD,
  iso,
  isoRect,
  landmassAt,
  railDistance,
  strokeFor,
} from "./cityLayout.js";
import { TRANSIT_LINES, TRANSIT_STOPS, type TransitMode } from "./transitData.js";

type Pt = { x: number; y: number };
const ICON: Record<TransitMode, string> = { rail: "🚆", ferry: "⛴️", brt: "🚌", coach: "🚍", flight: "✈️" };
/** Marker ring colour per mode (the line colours are close to these). */
const RING: Record<TransitMode, string> = { rail: "#d9482b", ferry: "#14a3a3", brt: "#1f6fd1", coach: "#e07b1f", flight: "#7a4fd6" };

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

/** The Ogun line's own track: from the Coast Line's old buffer stop on to Abeokuta (the first stretch is shared). */
const OGUN_TRACK = OGUN_RAIL_PATH.slice(1);
const PLATFORMS = [...RAIL_STATIONS, ...OGUN_RAIL_STATIONS];
/** Olumo Rock's hill: iso ellipses from the foot of the slope up to the top (each a smooth closed path). */
const hillRing = (grow: number, lift = 0) => {
  const pts = Array.from({ length: 28 }, (_, i) => {
    const t = (i / 28) * 2 * Math.PI;
    const p = iso(OLUMO_HILL.a + (OLUMO_HILL.ra + grow) * Math.cos(t), OLUMO_HILL.b + (OLUMO_HILL.rb + grow) * Math.sin(t));
    return { x: p.x, y: p.y - lift };
  });
  return `${d(pts)}Z`;
};
const HILL = [
  { d: hillRing(70), fill: "#7d8f4a" },
  { d: hillRing(10, 22), fill: "#8fa257" },
  { d: hillRing(-90, 48), fill: "#a2b265" },
  { d: hillRing(-190, 70), fill: "#b3bd78" },
];
const RIVER_D = d(RIVER_PTS);
const RIVER_LABEL = RIVER_PTS[Math.floor(RIVER_PTS.length * 0.45)]!;
/** The whole map's ground (Lagos and Ogun), from the far north edge down. */
const GROUND = { x: WORLD.x0, y: WORLD.y0, w: WORLD.w - WORLD.x0, h: WORLD.h - WORLD.y0 };

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

export function TransitLayer({ part, k = 1, plateScale = 1, onStop }: { part: "land" | "ground" | "labels"; k?: number; plateScale?: number; onStop?: (id: string) => void }) {
  if (part === "land") {
    // The sand reaches north past Lagos into Ogun State: the city map draws its ground over 0..w × 0..h only, so the
    // whole ground is drawn again here over the full world (same sand, glow and edge shade), then Ogun's greener
    // ground and Olumo Rock's hill. Uses the city map's own patterns.
    return (
      <g aria-hidden="true" className="ogun-land">
        <rect x={GROUND.x} y={GROUND.y} width={GROUND.w} height={GROUND.h} fill="#cfa874" />
        <rect x={GROUND.x} y={GROUND.y} width={GROUND.w} height={GROUND.h} fill="url(#sand)" />
        <ellipse cx={CX} cy={CY} rx="1400" ry="800" fill="url(#glow-centre)" />
        <rect x={GROUND.x} y={GROUND.y} width={GROUND.w} height={GROUND.h} fill="url(#sand-shade)" />
        {/* Ogun: greener ground than Lagos, fading in north of the city */}
        <rect x={GROUND.x} y={GROUND.y} width={GROUND.w} height={-GROUND.y + 300} fill="url(#ogun-green)" />
        <defs>
          <linearGradient id="ogun-green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6f9a45" stopOpacity=".32" />
            <stop offset={(-GROUND.y - 500) / (-GROUND.y + 300)} stopColor="#6f9a45" stopOpacity=".22" />
            <stop offset="1" stopColor="#6f9a45" stopOpacity="0" />
          </linearGradient>
        </defs>
        {HILL.map((h, i) => (
          <path key={i} d={h.d} fill={h.fill} stroke={i ? "none" : "#5f7038"} strokeWidth="6" opacity=".95" />
        ))}
      </g>
    );
  }
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

        {/* The Ogun River, coming down past Abeokuta (over the bush floor, under the trees) */}
        <path d={RIVER_D} fill="none" stroke="#e9f4f6" strokeOpacity=".55" strokeWidth={RIVER_HALF * 2 + 14} strokeLinecap="round" strokeLinejoin="round" />
        <path d={RIVER_D} fill="none" stroke="#2f7ea6" strokeWidth={RIVER_HALF * 2} strokeLinecap="round" strokeLinejoin="round" />
        {near && <path d={RIVER_D} fill="none" stroke="url(#water-tex)" strokeWidth={RIVER_HALF * 2 - 10} strokeLinecap="round" strokeLinejoin="round" />}
        <text x={RIVER_LABEL.x} y={RIVER_LABEL.y + 14} textAnchor="middle" fontSize="44" fontWeight="800" fontStyle="italic" fill="#cfe9f6" opacity=".85">
          Ogun River
        </text>

        {/* Platforms */}
        {PLATFORMS.map((s) => (
          <path key={s.id} d={isoRect(s.platform.a0, s.platform.a1, s.platform.b0, s.platform.b1)} fill="#d8d2c4" stroke="#a59f91" strokeWidth="3" />
        ))}

        {/* Track: ballast bed (on land), sleepers, then the two rails. Where it crosses a road it is a level crossing. */}
        {[TRACK_LAND, OGUN_TRACK].map((t, i) => (
          <path key={i} d={d(t)} fill="none" stroke="#7d7468" strokeWidth={strokeFor(RAIL_HALF)} strokeLinejoin="round" />
        ))}
        {[RAIL_PATH, OGUN_TRACK].map((t, i) => (
          <path key={i} d={d(t)} fill="none" stroke="#5b4a3a" strokeWidth={strokeFor(RAIL_HALF) - 10} strokeDasharray="5 9" />
        ))}
        {[RAIL_PATH, OGUN_TRACK].flatMap((t, i) =>
          [-7, 7].map((o) => <path key={`${i}${o}`} d={d(offset(t, o))} fill="none" stroke="#d8dbe0" strokeWidth="3.5" strokeLinejoin="round" />),
        )}
        {/* Buffer stops at the ends of the line (the City Rail Station's west end runs on to Ogun now) */}
        {[RAIL_PATH[RAIL_PATH.length - 1]!, OGUN_TRACK[OGUN_TRACK.length - 1]!].map((p, i) => (
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
