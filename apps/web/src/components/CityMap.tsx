// New Lagos — a pan-and-zoom isometric world laid out like Lagos (docs/city-plan.md), starting at Junction 101.
// Art is the Stitch raster set (public/art, provenance in *.json sidecars).
// Places are real buttons for keyboard and screen-reader access; drag never triggers a tap.
import { AD_ROTATE_SECONDS, HUSTLES_BY_KEY, VENUES_BY_KEY, type AvatarConfig, type BillboardView, type LocationKey, type NeighbourShop } from "@hc/shared";
import { LocateFixed, Megaphone, Minus, Plus, Sparkles, Store, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SVGProps } from "react";
import { api } from "../api.js";
import { INK } from "../prints.js";
import { clockLabel, useLagosLight } from "./lagosTime.js";
import { AvatarWalker } from "./AvatarWalker.js";
import { BillboardOnMap, BillboardSheet } from "./Billboards.js";
import { ShopVisit } from "./ShopVisit.js";
import { VenueBadge, VenueBuilding, VenueCard } from "./Venues.js";
import { StreetLife } from "./StreetLife.js";
import {
  ALL_SCENERY,
  BEACH_PATH,
  ROAD_PATHS,
  STREET_ENDS,
  strokeFor,
  flyHeight,
  yOn,
  BILLBOARD_SPOTS,
  DRIVEWAYS,
  STREETS,
  STREET_HALF,
  TREES,
  VENUE_SPOTS,
  CX,
  CY,
  DISTRICTS,
  HALF,
  ISLAND_PATH,
  LAMPS,
  OCEAN_PATH,
  PAVEMENT,
  STREET_PAVEMENT,
  PARK,
  PILLARS,
  PLACES,
  PLOTS,
  PROPS,
  ZEBRAS,
  ROAD_A,
  ROAD_B,
  ROADS,
  SHORE_PATH,
  WATER_PATH,
  WORLD,
  bandPath,
  centrePath,
  kerbPath,
} from "./cityLayout.js";
import { buildingBox, propBox } from "./sprites.js";
import { usePanZoom } from "./usePanZoom.js";

const J = { x: CX - 400, y: CY - 300, w: 800, h: 640 };

const LAMP = { art: "/art/props/street-lamp.webp", w: 46 };
/** Street furniture: stalls, shelters, poles and lamps. */
const STREET_PROPS = [...PROPS, ...LAMPS.map((l) => ({ ...l, art: LAMP.art, w: LAMP.w }))];

/** Buildings, trees and street furniture in one back-to-front list so nearer things cover farther ones. */
const WORLD_OBJECTS = [
  ...ALL_SCENERY.map((b) => ({ ...b, type: "building" as const, box: buildingBox(b.art, b.x, b.y, b.scale) })),
  ...TREES.map((t) => ({ ...t, type: "tree" as const })),
  ...STREET_PROPS.filter((p) => !p.behind).map((p) => ({ ...p, type: "prop" as const, box: propBox(p.art, p.x, p.y, p.w) })),
].sort((a, b) => a.y - b.y);
/** Furniture on the far side of a road: drawn before the traffic and walkers, which pass in front of it. */
const BEHIND_PROPS = STREET_PROPS.filter((p) => p.behind)
  .map((p) => ({ ...p, box: propBox(p.art, p.x, p.y, p.w) }))
  .sort((a, b) => a.y - b.y);

/** A zebra crossing: white stripes along the road, across it from kerb to kerb. */
function zebraStripes(z: (typeof ZEBRAS)[number]) {
  const [ux, uy] = [z.x1 - z.x0, z.y1 - z.y0];
  // The road runs along the other iso axis: (1, 0.5) if the zebra runs along (1, -0.5), and the other way round.
  const r = Math.hypot(1, 0.5);
  const [vx, vy] = uy / ux < 0 ? [1 / r, 0.5 / r] : [1 / r, -0.5 / r];
  const [hx, hy] = [(vx * z.w) / 2, (vy * z.w) / 2];
  const n = Math.max(3, Math.round(Math.hypot(ux, uy) / 15));
  return Array.from({ length: n }, (_, i) => {
    const [t0, t1] = [(i + 0.2) / n, (i + 0.7) / n];
    const [ax, ay, bx, by] = [z.x0 + ux * t0, z.y0 + uy * t0, z.x0 + ux * t1, z.y0 + uy * t1];
    return `M${ax - hx} ${ay - hy}L${ax + hx} ${ay + hy}L${bx + hx} ${by + hy}L${bx - hx} ${by - hy}Z`;
  }).join("");
}

/** Each hustle's shop looks different on the map (Stitch art in public/art/buildings). */
const HUSTLE_ART: Record<string, string> = {
  trader: "/art/market-square.webp",
  chop: "/art/buildings/buka.webp",
  gadget: "/art/buildings/gadget-kiosk.webp",
  artisan: "/art/buildings/tailor-shop.webp",
};


const PHASE_LABEL = { dawn: "Early morning", day: "Daytime", dusk: "Evening", night: "Night" } as const;

/** Screen size (px) a world-unit size renders at, kept readable at any zoom. */
const readable = (k: number, worldSize: number, minPx: number, max = 8) => Math.min(max, Math.max(1, minPx / (worldSize * k)));

interface HotspotProps {
  part: "body" | "label";
  id: LocationKey;
  label: string;
  art: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visited: boolean;
  plateScale: number;
  onOpen: (id: LocationKey) => void;
}

function Hotspot({ part, id, label, art, x, y, w, h, visited, plateScale, onOpen }: HotspotProps) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onOpen(id);
    }
  };
  const plateW = label.length * 13 + 40;
  if (part === "label")
    return (
      <g transform={`translate(${x} ${y})`} aria-hidden="true" className="map-label">
        <g transform={`translate(${w / 2} ${h + 6}) scale(${plateScale}) translate(${-plateW / 2} 0)`}>
          <rect width={plateW} height="38" rx="19" fill={INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".55" strokeWidth="1.5" />
          <text x={plateW / 2} y="25" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">
            {label}
          </text>
        </g>
        {!visited && (
          <g transform={`translate(${w - 14} 18) scale(${Math.min(plateScale, 3)})`}>
            <circle r="14" fill={INK.yellow} stroke={INK.indigoDeep} strokeWidth="2.5" />
            <path d="M0-7l2.1 4.9L7-2.1 2.1 0 0 4.9-2.1 0-7-2.1l4.9-.5z" fill={INK.indigoDeep} />
          </g>
        )}
      </g>
    );
  return (
    <g
      className="hotspot"
      role="button"
      tabIndex={0}
      aria-label={`Go into ${label}${visited ? "" : " (not visited yet)"}`}
      onClick={() => onOpen(id)}
      onKeyDown={onKey}
      transform={`translate(${x} ${y})`}
    >
      <rect className="ring" x="-6" y="-6" width={w + 12} height={h + 54} rx="18" fill="transparent" />
      <ellipse cx={w / 2} cy={h - 6} rx={w * 0.42} ry="14" fill="rgb(0 0 0 / 35%)" />
      <g className="bld">
        <image href={art} width={w} height={h} preserveAspectRatio="xMidYMax meet" />
      </g>
    </g>
  );
}

function Diamond({ x, y, w, h, ...rest }: { x: number; y: number; w: number; h: number } & SVGProps<SVGPathElement>) {
  return <path d={`M${x} ${y - h / 2} L${x + w / 2} ${y} L${x} ${y + h / 2} L${x - w / 2} ${y}Z`} {...rest} />;
}

export function CityMap({
  onOpen,
  visited,
  onVisited,
  notify,
  onDistrict,
  avatar,
  nickname,
}: {
  onOpen: (id: LocationKey) => void;
  visited: Set<string>;
  /** A shop visit happened (quest progress may have moved). */
  onVisited: () => void;
  notify: (msg: string) => void;
  /** An open district was tapped. */
  onDistrict: (name: string) => void;
  avatar: AvatarConfig;
  nickname: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [neighbours, setNeighbours] = useState<NeighbourShop[]>([]);
  const [peek, setPeek] = useState<NeighbourShop | null>(null);
  const [visiting, setVisiting] = useState<string | null>(null);
  const [boards, setBoards] = useState<BillboardView[]>([]);
  const [boardSheet, setBoardSheet] = useState<{ key: string | null } | null>(null);
  const [tick, setTick] = useState(0);
  const [walkTo, setWalkTo] = useState<{ x: number; y: number; seq: number } | null>(null);
  const [venueOpen, setVenueOpen] = useState<string | null>(null);
  useEffect(() => {
    api<BillboardView[]>("GET", "/api/billboards")
      .then(setBoards)
      .catch(() => setBoards([]));
  }, []);
  useEffect(() => {
    api<NeighbourShop[]>("GET", "/api/game/neighbours")
      .then(setNeighbours)
      .catch(() => setNeighbours([]));
  }, []);
  // Home view: the junction plus the ring of player shops around it.
  // Phones get a closer start (the junction and its places), so buildings show instead of the far view.
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const HOME = narrow ? { x: CX - 430, y: CY - 520, w: 860, h: 1100 } : { x: CX - 680, y: CY - 620, w: 1360, h: 1420 };
  const pz = usePanZoom(ref, { minK: 0.05, maxK: 4, home: HOME, bounds: WORLD });

  // Banners take turns every 15 s. Each turn counts a view for boards actually on screen (close enough to
  // read, tab visible); counts are sent in batches every minute for advertiser reports.
  const viewsRef = useRef<Record<string, number>>({});
  const viewRef = useRef(pz.view);
  viewRef.current = pz.view;
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  useEffect(() => {
    let turn = 0;
    const rotate = window.setInterval(() => {
      const next = ++turn;
      setTick(next);
      {
        const v = viewRef.current;
        const el = ref.current;
        if (v && el && v.k >= 0.3 && document.visibilityState === "visible") {
          const [x0, y0] = [-v.x / v.k, -v.y / v.k];
          const [x1, y1] = [(el.clientWidth - v.x) / v.k, (el.clientHeight - v.y) / v.k];
          for (const spot of BILLBOARD_SPOTS) {
            const b = boardsRef.current.find((bb) => bb.key === spot.key);
            if (!b?.ads.length || spot.x < x0 || spot.x > x1 || spot.y < y0 || spot.y - 300 > y1) continue;
            const ad = b.ads[next % b.ads.length]!;
            viewsRef.current[ad.id] = (viewsRef.current[ad.id] ?? 0) + 1;
          }
        }
      }
    }, AD_ROTATE_SECONDS * 1000);
    const flush = window.setInterval(() => {
      const views = viewsRef.current;
      if (!Object.keys(views).length) return;
      viewsRef.current = {};
      void api("POST", "/api/billboards/views", { views }).catch(() => undefined);
    }, 60_000);
    return () => {
      window.clearInterval(rotate);
      window.clearInterval(flush);
    };
  }, []);
  const k = pz.view?.k ?? 1;
  const world = pz.view ? `translate(${pz.view.x} ${pz.view.y}) scale(${k})` : undefined;
  const plateScale = readable(k, 20, 14);
  const districtScale = readable(k, 56, 16, 20);
  const far = k < 0.3;
  const light = useLagosLight();

  const open = (id: LocationKey) => {
    if (!pz.wasDragged()) onOpen(id);
  };

  return (
    <div className="map map-frame">
      <div
        ref={ref}
        className="map-viewport"
        tabIndex={0}
        role="application"
        aria-roledescription="map"
        aria-label="New Lagos map. Drag or use arrow keys to move, plus and minus to zoom, 0 to recentre. Tap the ground to walk there. Tab to the places."
        {...pz.handlers}
      >
        {/* Three stacked layers with one view transform: the ground and roads, the moving traffic and walkers,
            then buildings, people's shops and labels. Only the thin middle layer repaints while things move. */}
        <svg className="map-layer" aria-hidden="true">
          <defs>
            {/* Laterite sand: speckles of lighter and darker grains. */}
            <pattern id="sand" width="90" height="90" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="18" r="2.2" fill="#b98e58" />
              <circle cx="58" cy="9" r="1.6" fill="#e3c590" />
              <circle cx="40" cy="52" r="2.6" fill="#b48853" />
              <circle cx="78" cy="66" r="1.8" fill="#e6caa0" />
              <circle cx="22" cy="74" r="1.4" fill="#a97f4c" />
              <circle cx="70" cy="34" r="1.2" fill="#9c7444" />
            </pattern>
            {/* Cartoon trees with dark outlines, to sit with the Stitch art (until tree art arrives). */}
            <symbol id="tree" viewBox="0 0 120 145">
              <path d="M55 92h10l3 50H52z" fill="#6b4423" stroke="#2a1a0c" strokeWidth="3" strokeLinejoin="round" />
              <g stroke="#1d2a14" strokeWidth="3">
                <circle cx="34" cy="78" r="26" fill="#2f7a34" />
                <circle cx="86" cy="76" r="27" fill="#2f7a34" />
                <circle cx="60" cy="62" r="36" fill="#3f8f3a" />
                <circle cx="58" cy="34" r="25" fill="#4fa043" />
              </g>
              <circle cx="50" cy="28" r="9" fill="#7cc65a" />
              <circle cx="78" cy="58" r="7" fill="#6db84f" />
            </symbol>
            <symbol id="palm" viewBox="0 0 120 170">
              <path d="M54 168c2-40 4-80 10-118l9 2c-5 38-7 76-8 116z" fill="#8a5a2f" stroke="#2a1a0c" strokeWidth="3" strokeLinejoin="round" />
              <path d="M57 140h9M58 115h9M60 90h9M62 66h8" stroke="#5a3a1c" strokeWidth="2.5" />
              <g fill="#3f8f3a" stroke="#1d2a14" strokeWidth="3" strokeLinejoin="round">
                <path d="M68 50C50 30 26 30 6 46c22-4 40 0 58 10z" />
                <path d="M68 50c18-20 42-20 62-4-22-4-40 0-58 10z" />
                <path d="M68 50C60 26 44 12 24 8c16 12 28 26 38 46z" />
                <path d="M68 50c6-24 22-40 42-44-14 12-26 28-34 48z" />
                <path d="M68 50C52 58 40 74 34 96c12-18 24-30 38-40z" fill="#2f7a34" />
                <path d="M68 50c16 8 28 24 34 46-12-18-24-30-38-40z" fill="#2f7a34" />
              </g>
              <circle cx="66" cy="52" r="6" fill="#6b4423" stroke="#2a1a0c" strokeWidth="2" />
            </symbol>
            <pattern id="waves" width="160" height="56" patternUnits="userSpaceOnUse">
              <path d="M0 28q40-22 80 0t80 0" fill="none" stroke="#9fd3e8" strokeOpacity=".3" strokeWidth="5" />
            </pattern>
            <radialGradient id="sand-shade" cx="50%" cy="50%" r="60%">
              <stop offset="0.55" stopColor="#5a3d1c" stopOpacity="0" />
              <stop offset="1" stopColor="#5a3d1c" stopOpacity=".38" />
            </radialGradient>
            <radialGradient id="lamp-pool">
              <stop offset="0" stopColor="#ffd98a" stopOpacity=".75" />
              <stop offset=".5" stopColor="#ffb547" stopOpacity=".28" />
              <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="window-glow">
              <stop offset="0" stopColor="#ffcf6e" stopOpacity=".55" />
              <stop offset=".6" stopColor="#ff9f3a" stopOpacity=".16" />
              <stop offset="1" stopColor="#ff9f3a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="glow-centre" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#e4c48e" />
              <stop offset="1" stopColor="#cfa874" stopOpacity="0" />
            </radialGradient>
          </defs>
          {pz.view && (
            <g transform={world}>
              <rect width={WORLD.w} height={WORLD.h} fill="#cfa874" />
              <rect width={WORLD.w} height={WORLD.h} fill="url(#sand)" />
              <ellipse cx={CX} cy={CY} rx="1400" ry="800" fill="url(#glow-centre)" />
              <rect width={WORLD.w} height={WORLD.h} fill="url(#sand-shade)" />

              {/* Lagoon, harbour and sea, then the Island on top */}
              <path d={WATER_PATH} fill="#2f7ea6" />
              <path d={WATER_PATH} fill="url(#waves)" />
              <path d={OCEAN_PATH} fill="#26688f" />
              <path d={OCEAN_PATH} fill="url(#waves)" />
              <path d={SHORE_PATH} fill="none" stroke="#e9f4f6" strokeOpacity=".55" strokeWidth="10" strokeLinecap="round" />
              <path d={ISLAND_PATH} fill="#d6b27e" stroke="#e9f4f6" strokeOpacity=".55" strokeWidth="10" />
              <path d={ISLAND_PATH} fill="url(#sand)" />
              <path d={BEACH_PATH} fill="#f0dcae" />
              {!far && (
                <g aria-hidden="true">
                  <text x="7800" y="4200" textAnchor="middle" fontSize="64" fontWeight="800" fontStyle="italic" fill="#cfe9f6" opacity=".8">
                    Lagos Lagoon
                  </text>
                  <text x="3000" y="6500" textAnchor="middle" fontSize="72" fontWeight="800" fontStyle="italic" fill="#cfe9f6" opacity=".8">
                    Atlantic Ocean
                  </text>
                </g>
              )}

              {/* Third Mainland Bridge pillars sit in the water under the deck */}
              {PILLARS.map((p) => (
                <rect key={p.key} x={p.x - 9} y={p.y + HALF - 4} width="18" height="70" rx="4" fill="#8a8f98" stroke="#5d626b" strokeWidth="2" />
              ))}

              {/* Roads as continuous centre lines, stroked in layers: pavement edge, pavement, laterite shoulder,
                  kerb, then asphalt. Every junction and every turn merges cleanly because all kerbs sit under
                  all asphalt. Turns (Tech Mile onto Third Mainland Bridge, the Eko Bridge fork) are curves. */}
              {(() => {
                const roads = ROAD_PATHS.filter((p) => p.kind === "road");
                const bridges = ROAD_PATHS.filter((p) => p.kind === "bridge");
                const streets = far ? [] : ROAD_PATHS.filter((p) => p.kind === "street");
                const line = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
                return (
                  <g aria-hidden="true">
                    {!far && DRIVEWAYS.map((d, i) => <path key={i} d={`M${d.x0} ${d.y0} L${d.x1} ${d.y1}`} stroke="#9a8f7c" strokeWidth="26" />)}
                    {roads.map((r) => <path key={`pe-${r.id}`} d={r.d} {...line} stroke="#b9a782" strokeWidth={strokeFor(HALF + PAVEMENT) + 5} />)}
                    {roads.map((r) => <path key={`pv-${r.id}`} d={r.d} {...line} stroke="#d6c7a5" strokeWidth={strokeFor(HALF + PAVEMENT)} />)}
                    {streets.map((r) => <path key={`spv-${r.id}`} d={r.d} {...line} stroke="#cdbd9c" strokeWidth={strokeFor(STREET_HALF + STREET_PAVEMENT)} />)}
                    {!far && STREET_ENDS.map((p) => <ellipse key={`sec-${p.key}`} cx={p.x} cy={p.y} rx={(STREET_HALF + STREET_PAVEMENT) * 2.2} ry={STREET_HALF + STREET_PAVEMENT + 6} fill="#cdbd9c" />)}
                    {roads.map((r) => <path key={`lt-${r.id}`} d={r.d} {...line} stroke="#a8653a" strokeWidth={strokeFor(HALF + 9)} />)}
                    {bridges.map((r) => <path key={`bf-${r.id}`} d={r.d} {...line} stroke="#9aa0a8" strokeWidth={strokeFor(HALF + 14)} strokeLinecap="butt" />)}
                    {/* kerbs: a slightly wider stroke under the asphalt */}
                    {roads.map((r) => <path key={`kb-${r.id}`} d={r.d} {...line} stroke="#e6d6b4" strokeWidth={strokeFor(HALF) + 8} />)}
                    {bridges.map((r) => <path key={`rl-${r.id}`} d={r.d} {...line} stroke="#cfd3d8" strokeWidth={strokeFor(HALF) + 14} strokeLinecap="butt" />)}
                    {streets.map((r) => <path key={`skb-${r.id}`} d={r.d} {...line} stroke="#d9c9a6" strokeWidth={strokeFor(STREET_HALF) + 6} />)}
                    {!far && STREET_ENDS.map((p) => <ellipse key={`sek-${p.key}`} cx={p.x} cy={p.y} rx={STREET_HALF * 2.4 + 4} ry={STREET_HALF + 7} fill="#d9c9a6" />)}
                    {/* asphalt */}
                    {streets.map((r) => <path key={`sas-${r.id}`} d={r.d} {...line} stroke="#5c564f" strokeWidth={strokeFor(STREET_HALF)} />)}
                    {!far && STREET_ENDS.map((p) => <ellipse key={`sea-${p.key}`} cx={p.x} cy={p.y} rx={STREET_HALF * 2.4} ry={STREET_HALF + 4} fill="#5c564f" />)}
                    {bridges.map((r) => <path key={`ba-${r.id}`} d={r.d} {...line} stroke="#55504a" strokeWidth={strokeFor(HALF)} strokeLinecap="butt" />)}
                    {roads.map((r) => <path key={`as-${r.id}`} d={r.d} {...line} stroke="var(--map-road)" strokeWidth={strokeFor(HALF)} />)}
                    {/* Lagos dual carriageway: a raised median with black-and-yellow striped kerbs */}
                    {roads.map((r) => (
                      <g key={`md-${r.id}`}>
                        <path d={r.d} {...line} strokeLinecap="butt" stroke="#2b2b2b" strokeWidth="12" />
                        <path d={r.d} {...line} strokeLinecap="butt" stroke="#f2c14e" strokeWidth="12" strokeDasharray="12 12" />
                      </g>
                    ))}
                    {bridges.map((r) => <path key={`bd-${r.id}`} d={r.d} {...line} stroke="var(--map-lane)" strokeWidth="3" strokeDasharray="20 16" />)}
                    {/* Zebra crossings: at the junction, at the far ends of its footpaths, and across every side street */}
                    {!far && <path d={ZEBRAS.map(zebraStripes).join("")} fill="#f4f1e8" opacity=".92" />}
                  </g>
                );
              })()}

              {/* Street furniture on the far kerbs, under the traffic and walkers passing in front of it */}
              {!far && (
                <g aria-hidden="true" className="map-scenery">
                  {BEHIND_PROPS.map((p) => (
                    <image key={p.key} href={p.art} x={p.box.x} y={p.box.y} width={p.box.w} height={p.box.h} />
                  ))}
                </g>
              )}

            </g>
          )}
        </svg>
        {/* Traffic and people (hidden when zoomed far out, and for reduced motion) */}
        <svg className="map-layer" aria-hidden="true">
          {pz.view && !far && (
            <g transform={world}>
              <StreetLife roads={ROADS} />
            </g>
          )}
        </svg>
        <svg
          className="map-layer map-top"
          onClick={(e) => {
            // Tap the ground to walk there. Places, shops and billboards handle their own taps.
            if (far || !pz.view || pz.wasDragged() || (e.target as Element).closest(".hotspot, .billboard, .venue-badge")) return;
            const box = ref.current!.getBoundingClientRect();
            const v = pz.view;
            setWalkTo({ x: (e.clientX - box.left - v.x) / v.k, y: (e.clientY - box.top - v.y) / v.k, seq: Date.now() });
          }}
        >
          {pz.view && (
            <g transform={world}>

              {/* Flyover: a raised deck on pillars over Road A (drawn above the traffic passing under it) */}
              {ROADS.filter((r) => r.flyover).map((r) => {
                const N = 24;
                const pts = Array.from({ length: N + 1 }, (_, i) => {
                  const x = r.x0 + ((r.x1 - r.x0) * i) / N;
                  return { x, y: yOn(r, x), h: flyHeight(r, x) };
                });
                const edge = (off: number) => pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y - p.h + off}`).join(" ");
                const deck = `${edge(-HALF)} ${[...pts].reverse().map((p) => `L${p.x} ${p.y - p.h + HALF}`).join(" ")}Z`;
                return (
                  <g key={r.id} aria-hidden="true">
                    {/* shadow on the ground */}
                    <path d={bandPath(r, HALF)} fill="rgb(0 0 0 / 22%)" transform="translate(0 18)" />
                    {pts.filter((p, i) => i % 3 === 0 && p.h > 20).map((p) => (
                      <rect key={p.x} x={p.x - 10} y={p.y - p.h + HALF - 4} width="20" height={p.h} rx="3" fill="#9ca1a9" stroke="#5d626b" strokeWidth="2" />
                    ))}
                    <path d={deck} fill="#4d4944" />
                    <path d={`${edge(-HALF)} ${edge(HALF)}`} fill="none" stroke="#cfd3d8" strokeWidth="8" />
                    <path d={edge(0)} fill="none" stroke="var(--map-lane)" strokeWidth="3" strokeDasharray="20 16" />
                  </g>
                );
              })}

              {/* Districts that open in later stages */}
              {DISTRICTS.filter((d) => !d.landmark).map((d) => (
                <g key={d.name} aria-hidden="true">
                  <Diamond x={d.x} y={d.y} w={1100} h={550} fill="rgb(255 255 255 / 7%)" stroke="#8c6a3e" strokeWidth="4" strokeDasharray="18 14" />
                </g>
              ))}

              {/* District and neighbourhood buildings (decorative until districts open) */}
              <g aria-hidden="true" className="map-scenery">
                {WORLD_OBJECTS.map((o) =>
                  o.type === "building" ? (
                    <image key={o.key} href={o.art} x={o.box.x} y={o.box.y} width={o.box.w} height={o.box.h} />
                  ) : far ? null : o.type === "prop" ? (
                    <image key={o.key} href={o.art} x={o.box.x} y={o.box.y} width={o.box.w} height={o.box.h} />
                  ) : (
                    <g key={o.key}>
                      <ellipse cx={o.x + 10} cy={o.y} rx="46" ry="14" fill="rgb(0 0 0 / 22%)" />
                      <use href={o.kind === "palm" ? "#palm" : "#tree"} x={o.x - 60} y={o.y - (o.kind === "palm" ? 165 : 140)} width="120" height={o.kind === "palm" ? 170 : 145} />
                    </g>
                  ),
                )}
              </g>

              {/* Junction 101 */}
              <g transform={`translate(${J.x} ${J.y})`}>
                <ellipse cx="400" cy="300" rx="150" ry="75" fill="var(--map-road)" />
                <ellipse cx="400" cy="300" rx="78" ry="39" fill={INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".55" strokeWidth="2" />
                {far ? (
                  <g
                    className="hotspot"
                    role="button"
                    tabIndex={0}
                    aria-label="Zoom in to Junction 101"
                    onClick={() => !pz.wasDragged() && pz.flyTo(CX, CY + 60, 0.55)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        pz.flyTo(CX, CY + 60, 0.55);
                      }
                    }}
                  >
                    <image href="/art/market-square.webp" x="200" y="150" width="400" height="300" preserveAspectRatio="xMidYMid meet" />
                  </g>
                ) : null}
              </g>
              {!far && (
                <>
                  <image href="/art/city-park.webp" x={PARK.x} y={PARK.y} width={PARK.w} height={PARK.h} preserveAspectRatio="xMidYMax meet" aria-hidden="true" className="map-scenery" />
                  {PLACES.map((pl) => (
                    <Hotspot key={pl.id} part="body" {...pl} visited={visited.has(pl.id)} plateScale={plateScale} onOpen={open} />
                  ))}
                </>
              )}

              {/* Venues you can go into */}
              {!far &&
                VENUE_SPOTS.map((spot) => {
                  const v = VENUES_BY_KEY.get(spot.key);
                  return v ? <VenueBuilding key={spot.key} venue={v} x={spot.x} y={spot.y} scale={spot.scale} onOpen={() => !pz.wasDragged() && setVenueOpen(v.key)} /> : null;
                })}

              {/* Plots: player shops (yours first), then open plots */}
              {!far &&
                PLOTS.map((p, i) => {
                  const shop = neighbours[i];
                  if (!shop)
                    return (
                      <g key={i} aria-hidden="true">
                        <Diamond x={p.x} y={p.y} w={260} h={130} fill="rgb(30 110 60 / 14%)" stroke="#2f6b45" strokeWidth="3" strokeDasharray="10 8" />
                        <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#24533a" letterSpacing="2">
                          OPEN PLOT
                        </text>
                      </g>
                    );
                  const open = () => !pz.wasDragged() && setPeek(shop);
                  return (
                    <g
                      key={i}
                      className="hotspot"
                      role="button"
                      tabIndex={0}
                      aria-label={`${shop.isMe ? "Your shop" : `${shop.nickname}'s shop`}: ${shop.shopName}`}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setPeek(shop);
                        }
                      }}
                    >
                      <Diamond x={p.x} y={p.y} w={240} h={120} fill={shop.isMe ? "rgb(255 199 44 / 30%)" : "rgb(255 255 255 / 16%)"} stroke={shop.isMe ? "#ffc72c" : "#8c6a3e"} strokeWidth="2" />
                      <g className="bld">
                        <image href={HUSTLE_ART[shop.hustle] ?? HUSTLE_ART.trader} x={p.x - 90} y={p.y + 45 - 150} width="180" height="150" preserveAspectRatio="xMidYMax meet" />
                      </g>
                    </g>
                  );
                })}

              {/* You: tap the ground to walk */}
              {!far && (
                <AvatarWalker
                  avatar={avatar}
                  nickname={nickname}
                  start={{ x: CX - 120, y: CY + 150 }}
                  target={walkTo}
                  plateScale={plateScale}
                  onBlocked={() => notify("You can't walk on water. Take the bridge to the Island.")}
                />
              )}

              {/* Lagos time of day: one multiply tint over the whole world */}
              {light.phase !== "day" && <rect width={WORLD.w} height={WORLD.h} fill={light.tint} className="map-tint" />}

              {/* Billboards: paid ads from real businesses. Drawn above the night tint because their screens are lit. */}
              {!far &&
                BILLBOARD_SPOTS.map((spot) => {
                  const b = boards.find((bb) => bb.key === spot.key);
                  return b ? <BillboardOnMap key={spot.key} board={b} x={spot.x} y={spot.y} tick={tick} onOpen={() => !pz.wasDragged() && setBoardSheet({ key: b.key })} /> : null;
                })}

              {/* Night lights: street lamps, lit windows, the roundabout */}
              {light.lamps > 0 && (
                <g aria-hidden="true" className="map-lights" opacity={light.lamps}>
                  {!far &&
                    BILLBOARD_SPOTS.map((spot) => <ellipse key={`bb-${spot.key}`} cx={spot.x} cy={spot.y - 200} rx="220" ry="110" fill="url(#window-glow)" />)}
                  {LAMPS.map((l) => {
                    // The lamp head hangs off its arm, up and to the right of the pole.
                    const box = propBox(LAMP.art, l.x, l.y, LAMP.w);
                    return (
                      <g key={l.key}>
                        <ellipse cx={l.x + 14} cy={l.y + 12} rx="110" ry="52" fill="url(#lamp-pool)" />
                        <circle cx={box.x + box.w * 0.72} cy={box.y + box.h * 0.1} r="7" fill="#fff4c8" />
                      </g>
                    );
                  })}
                  {ALL_SCENERY.map((b) => {
                    const box = buildingBox(b.art, b.x, b.y, b.scale);
                    return <ellipse key={b.key} cx={b.x} cy={box.y + box.h * 0.6} rx={box.w * 0.5} ry={box.h * 0.42} fill="url(#window-glow)" />;
                  })}
                  {!far &&
                    PLOTS.map((p, i) => neighbours[i] && <ellipse key={i} cx={p.x} cy={p.y - 30} rx="110" ry="80" fill="url(#window-glow)" />)}
                  <ellipse cx={CX} cy={CY} rx="260" ry="140" fill="url(#lamp-pool)" />
                  {!far && PLACES.map((pl) => <ellipse key={pl.id} cx={pl.x + pl.w / 2} cy={pl.y + pl.h * 0.55} rx={pl.w * 0.6} ry={pl.h * 0.5} fill="url(#window-glow)" />)}
                </g>
              )}

              {/* Labels stay readable at every zoom and time of day */}
              <g className="map-labels" aria-hidden="true">
                {/* Venue icons show at every zoom (names only up close), so places are easy to find. */}
                {VENUE_SPOTS.map((spot) => {
                    const v = VENUES_BY_KEY.get(spot.key);
                    return v ? (
                      <VenueBadge key={spot.key} venue={v} x={spot.x} y={far ? spot.y - 36 : buildingBox(v.art, spot.x, spot.y, spot.scale).y - 20} scale={Math.min(plateScale, 4)} showName={k >= 0.35} onOpen={() => !pz.wasDragged() && setVenueOpen(v.key)} />
                    ) : null;
                  })}
                {DISTRICTS.filter((d) => d.landmark).map((d) => (
                  <text key={d.name} x={d.x} y={d.y + 330} textAnchor="middle" fontSize="60" fontWeight="800" fontStyle="italic" fill="#fff5dc" stroke="#1f5a80" strokeWidth="8" paintOrder="stroke">
                    {d.name} · opens later
                  </text>
                ))}
                {DISTRICTS.filter((d) => !d.landmark).map((d) => {
                  const plate = (
                    <>
                      <rect
                        x={-(d.name.length * 17 + 50)}
                        y="-62"
                        width={d.name.length * 34 + 100}
                        height="118"
                        rx="26"
                        fill={d.open ? "#166534" : INK.indigoDeep}
                        stroke={d.open ? INK.yellow : "none"}
                        strokeWidth="4"
                        opacity={d.open ? 1 : 0.9}
                      />
                      <text textAnchor="middle" fontSize="56" fontWeight="900" fill="#fff">
                        {d.name}
                      </text>
                      <text textAnchor="middle" y="40" fontSize="24" fontWeight="700" fill={INK.yellow} letterSpacing="3">
                        {d.open ?? "OPENS LATER"}
                      </text>
                    </>
                  );
                  return d.open ? (
                    // Open districts are real buttons: they take the player to what's there.
                    <g
                      key={`${d.name}-label`}
                      className="hotspot district-open"
                      role="button"
                      tabIndex={0}
                      aria-label={`${d.name}: ${d.open.toLowerCase()}. Find artisans.`}
                      transform={`translate(${d.x} ${d.y}) scale(${districtScale})`}
                      onClick={() => !pz.wasDragged() && onDistrict(d.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onDistrict(d.name);
                        }
                      }}
                    >
                      {plate}
                    </g>
                  ) : (
                    <g key={`${d.name}-label`} transform={`translate(${d.x} ${d.y}) scale(${districtScale})`}>
                      {plate}
                    </g>
                  );
                })}
                <g transform={`translate(${J.x} ${J.y})`}>
                  <g transform={`translate(400 305) scale(${Math.min(districtScale, 6)})`}>
                    <text textAnchor="middle" fontSize="13" fontWeight="900" fill={INK.yellow} letterSpacing="1.4">
                      JUNCTION 101
                    </text>
                  </g>
                  {far && (
                    <g transform={`translate(400 470) scale(${districtScale})`}>
                      <rect x="-150" y="-34" width="300" height="60" rx="30" fill={INK.yellow} />
                      <text textAnchor="middle" y="6" fontSize="30" fontWeight="900" fill={INK.indigoDeep}>
                        Junction 101
                      </text>
                    </g>
                  )}
                </g>
                {!far && PLACES.map((pl) => <Hotspot key={pl.id} part="label" {...pl} visited={visited.has(pl.id)} plateScale={plateScale} onOpen={open} />)}
                {!far &&
                  PLOTS.map((p, i) => {
                    const shop = neighbours[i];
                    if (!shop) return null;
                    const label = shop.isMe ? "Your shop" : `@${shop.nickname}`;
                    const plateW = label.length * 11 + 34;
                    return (
                      <g key={i} transform={`translate(${p.x} ${p.y + 66}) scale(${plateScale * 0.9}) translate(${-plateW / 2} 0)`}>
                        <rect width={plateW} height="32" rx="16" fill={shop.isMe ? INK.yellow : INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".5" />
                        <text x={plateW / 2} y="21" textAnchor="middle" fontSize="17" fontWeight="800" fill={shop.isMe ? INK.indigoDeep : "#fff"}>
                          {label}
                        </text>
                      </g>
                    );
                  })}
              </g>
            </g>
          )}
        </svg>
      </div>

      <div className="map-controls" role="group" aria-label="Map zoom">
        <button type="button" className="map-ctl" onClick={() => setBoardSheet({ key: null })} aria-label="Billboards: advertise your business">
          <Megaphone size={18} aria-hidden="true" />
        </button>
        <button type="button" className="map-ctl" onClick={() => pz.zoomBy(1.4)} aria-label="Zoom in">
          <Plus size={18} aria-hidden="true" />
        </button>
        <button type="button" className="map-ctl" onClick={() => pz.zoomBy(1 / 1.4)} aria-label="Zoom out">
          <Minus size={18} aria-hidden="true" />
        </button>
        <button type="button" className="map-ctl" onClick={pz.fitHome} aria-label="Back to Junction 101">
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="map-clock tiny" aria-live="off">
        Lagos {clockLabel(light.hour)} · {PHASE_LABEL[light.phase]}
      </p>
      <p className="map-hint tiny">Tap the road to walk · drag to move · pinch to zoom</p>
      {peek && (
        <div className="map-peek" role="dialog" aria-label={`${peek.shopName}`}>
          <button type="button" className="map-peek-close" onClick={() => setPeek(null)} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
          <strong>{peek.shopName}</strong>
          <span className="small muted">
            {peek.isMe ? "Your shop" : `Run by @${peek.nickname}`} · {HUSTLES_BY_KEY.get(peek.hustle)?.title ?? "Trader"}
          </span>
          <span className="appeal-pill" style={{ justifySelf: "start" }}>
            <Sparkles size={14} aria-hidden="true" /> Appeal {peek.appeal}
          </span>
          {peek.isMe ? (
            <button type="button" className="btn sm go" onClick={() => onOpen("market_square")}>
              Go to my shop
            </button>
          ) : (
            <button type="button" className="btn sm go" onClick={() => setVisiting(peek.shopId)}>
              <Store size={16} aria-hidden="true" /> Visit shop
            </button>
          )}
        </div>
      )}
      {visiting && <ShopVisit shopId={visiting} onClose={() => setVisiting(null)} onVisited={onVisited} notify={notify} />}
      {boardSheet && (
        <BillboardSheet boards={boards} boardKey={boardSheet.key} signedIn onPick={(key) => setBoardSheet({ key })} onClose={() => setBoardSheet(null)} />
      )}
      {venueOpen && (
        <VenueCard
          venueKey={venueOpen}
          onClose={() => setVenueOpen(null)}
          onWalk={() => {
            const spot = VENUE_SPOTS.find((v) => v.key === venueOpen);
            if (spot) setWalkTo({ x: spot.x, y: spot.y + 30, seq: Date.now() });
            setVenueOpen(null);
          }}
          onFindReal={() => {
            setVenueOpen(null);
            onDistrict("artisans");
          }}
          onChanged={onVisited}
          notify={notify}
        />
      )}
    </div>
  );
}
