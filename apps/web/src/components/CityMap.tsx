// New Lagos — a pan-and-zoom isometric world laid out like Lagos (docs/city-plan.md), starting at Junction 101.
// Art is the Stitch raster set (public/art, provenance in *.json sidecars).
// Places are real buttons for keyboard and screen-reader access; drag never triggers a tap.
import { AD_ROTATE_SECONDS, HUSTLES_BY_KEY, type BillboardView, type LocationKey, type NeighbourShop } from "@hc/shared";
import { LocateFixed, Megaphone, Minus, Plus, Sparkles, Store, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SVGProps } from "react";
import { api } from "../api.js";
import { INK } from "../prints.js";
import { clockLabel, useLagosLight } from "./lagosTime.js";
import { BillboardOnMap, BillboardSheet } from "./Billboards.js";
import { ShopVisit } from "./ShopVisit.js";
import { StreetLife } from "./StreetLife.js";
import {
  ALL_SCENERY,
  BEACH_PATH,
  BILLBOARD_SPOTS,
  DRIVEWAYS,
  STREETS,
  STREET_HALF,
  TREES,
  CX,
  CY,
  DISTRICTS,
  HALF,
  ISLAND_PATH,
  LAMPS,
  OCEAN_PATH,
  PAVEMENT,
  STREET_PAVEMENT,
  PILLARS,
  PLOTS,
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
import { usePanZoom } from "./usePanZoom.js";

const J = { x: CX - 400, y: CY - 300, w: 800, h: 640 };

/** Buildings and trees in one back-to-front list so nearer things cover farther ones. */
const WORLD_OBJECTS = [
  ...ALL_SCENERY.map((b) => ({ ...b, type: "building" as const, kind: undefined })),
  ...TREES.map((t) => ({ ...t, type: "tree" as const, art: "" })),
].sort((a, b) => a.y - b.y);

/** Each hustle's shop looks different on the map (Stitch art in public/art/buildings). */
const HUSTLE_ART: Record<string, string> = {
  trader: "/art/market-square.webp",
  chop: "/art/buildings/buka.webp",
  gadget: "/art/buildings/gadget-kiosk.webp",
  artisan: "/art/buildings/tailor-shop.webp",
};

/** The three Junction 101 places. */
const PLACES: { id: LocationKey; label: string; art: string; x: number; y: number; w: number; h: number }[] = [
  { id: "work_hub", label: "Work Hub", art: "/art/work-hub.webp", x: 300, y: 0, w: 200, h: 196 },
  { id: "hangout", label: "The Hangout", art: "/art/hangout.webp", x: 540, y: 150, w: 220, h: 170 },
  { id: "market_square", label: "Market Square", art: "/art/market-square.webp", x: 276, y: 372, w: 248, h: 176 },
];

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
}: {
  onOpen: (id: LocationKey) => void;
  visited: Set<string>;
  /** A shop visit happened (quest progress may have moved). */
  onVisited: () => void;
  notify: (msg: string) => void;
  /** An open district was tapped. */
  onDistrict: (name: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [neighbours, setNeighbours] = useState<NeighbourShop[]>([]);
  const [peek, setPeek] = useState<NeighbourShop | null>(null);
  const [visiting, setVisiting] = useState<string | null>(null);
  const [boards, setBoards] = useState<BillboardView[]>([]);
  const [boardSheet, setBoardSheet] = useState<{ key: string | null } | null>(null);
  const [tick, setTick] = useState(0);
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
  const HOME = { x: CX - 680, y: CY - 620, w: 1360, h: 1420 };
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
        aria-label="New Lagos map. Drag or use arrow keys to move, plus and minus to zoom, 0 to recentre. Tab to the places."
        {...pz.handlers}
      >
        <svg width="100%" height="100%">
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
            <g transform={`translate(${pz.view.x} ${pz.view.y}) scale(${k})`}>
              <rect width={WORLD.w} height={WORLD.h} fill="#cfa874" />
              <rect width={WORLD.w} height={WORLD.h} fill="url(#sand)" />
              <ellipse cx={CX} cy={CY} rx="1400" ry="800" fill="url(#glow-centre)" />
              <rect width={WORLD.w} height={WORLD.h} fill="url(#sand-shade)" />

              {/* Lagoon, harbour and sea, then the Island on top */}
              <path d={WATER_PATH} fill="#2f7ea6" />
              <path d={WATER_PATH} fill="url(#waves)" />
              <path d={OCEAN_PATH} fill="#1f5a80" />
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
                <rect key={p.x} x={p.x - 9} y={p.y + HALF - 4} width="18" height="70" rx="4" fill="#8a8f98" stroke="#5d626b" strokeWidth="2" />
              ))}

              {/* Residential streets and driveways, under the main roads so junctions read as T-junctions */}
              {!far && (
                <g aria-hidden="true">
                  {DRIVEWAYS.map((d, i) => (
                    <path key={i} d={`M${d.x0} ${d.y0} L${d.x1} ${d.y1}`} stroke="#9a8f7c" strokeWidth="26" />
                  ))}
                  {STREETS.map((r) => (
                    <g key={r.id}>
                      <path d={bandPath(r, STREET_HALF + STREET_PAVEMENT)} fill="#cdbd9c" />
                      <path d={bandPath(r, STREET_HALF)} fill="#5c564f" />
                      <path d={`${kerbPath(r, -STREET_HALF)}${kerbPath(r, STREET_HALF)}`} stroke="#d9c9a6" strokeWidth="4" />
                    </g>
                  ))}
                </g>
              )}

              {/* Roads: asphalt, kerbs (rails on the bridge), lane markings */}
              {ROADS.map((r) => (
                <g key={r.id}>
                  {/* Pavement on both sides (walkways); the bridge has a narrow footway behind its rails. */}
                  <path d={bandPath(r, HALF + (r.bridge ? 12 : PAVEMENT))} fill={r.bridge ? "#9aa0a8" : "#d6c7a5"} />
                  {!r.bridge && <path d={`${kerbPath(r, -HALF - PAVEMENT)}${kerbPath(r, HALF + PAVEMENT)}`} stroke="#b9a782" strokeWidth="3" />}
                  <path d={bandPath(r)} fill={r.bridge ? "#55504a" : "var(--map-road)"} />
                  <path d={`${kerbPath(r, -HALF)}${kerbPath(r, HALF)}`} stroke={r.bridge ? "#cfd3d8" : "#e6d6b4"} strokeWidth={r.bridge ? 9 : 6} />
                  <path d={centrePath(r)} stroke="var(--map-lane)" strokeWidth="3" strokeDasharray="20 16" />
                </g>
              ))}

              {/* Traffic and people (hidden when zoomed far out, and for reduced motion) */}
              {!far && <StreetLife roads={ROADS} walkRoads={{ a: ROAD_A, b: ROAD_B }} kerb={HALF + PAVEMENT / 2} cx={CX} />}

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
                    <image key={o.key} href={o.art} x={o.x - 120} y={o.y - 210} width="240" height="230" preserveAspectRatio="xMidYMax meet" />
                  ) : far ? null : (
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
                {!far && (
                  <g aria-hidden="true" className="map-scenery">
                    <image href="/art/city-park.webp" x="0" y="190" width="230" height="200" preserveAspectRatio="xMidYMid meet" />
                    <image href="/art/danfo-park.webp" x="8" y="455" width="150" height="130" preserveAspectRatio="xMidYMax meet" />
                    <image href="/art/signpost.webp" x="660" y="452" width="66" height="130" preserveAspectRatio="xMidYMax meet" />
                  </g>
                )}
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
                ) : (
                  PLACES.map((pl) => <Hotspot key={pl.id} part="body" {...pl} visited={visited.has(pl.id)} plateScale={plateScale} onOpen={open} />)
                )}
              </g>

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
                      <Diamond x={p.x} y={p.y + 40} w={240} h={120} fill={shop.isMe ? "rgb(255 199 44 / 30%)" : "rgb(255 255 255 / 16%)"} stroke={shop.isMe ? "#ffc72c" : "#8c6a3e"} strokeWidth="2" />
                      <g className="bld">
                        <image href={HUSTLE_ART[shop.hustle] ?? HUSTLE_ART.trader} x={p.x - 90} y={p.y - 110} width="180" height="150" preserveAspectRatio="xMidYMax meet" />
                      </g>
                    </g>
                  );
                })}

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
                  {LAMPS.map((l) => (
                    <g key={l.key}>
                      <ellipse cx={l.x} cy={l.y + 10} rx="110" ry="52" fill="url(#lamp-pool)" />
                      <circle cx={l.x} cy={l.y - 30} r="5" fill="#fff4c8" />
                    </g>
                  ))}
                  {ALL_SCENERY.map((b) => (
                    <ellipse key={b.key} cx={b.x} cy={b.y - 90} rx="120" ry="95" fill="url(#window-glow)" />
                  ))}
                  {!far &&
                    PLOTS.map((p, i) => neighbours[i] && <ellipse key={i} cx={p.x} cy={p.y - 30} rx="110" ry="80" fill="url(#window-glow)" />)}
                  <g transform={`translate(${J.x} ${J.y})`}>
                    <ellipse cx="400" cy="300" rx="260" ry="140" fill="url(#lamp-pool)" />
                    {!far && PLACES.map((pl) => <ellipse key={pl.id} cx={pl.x + pl.w / 2} cy={pl.y + pl.h * 0.55} rx={pl.w * 0.6} ry={pl.h * 0.5} fill="url(#window-glow)" />)}
                  </g>
                </g>
              )}

              {/* Labels stay readable at every zoom and time of day */}
              <g className="map-labels" aria-hidden="true">
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
                  {far ? (
                    <g transform={`translate(400 470) scale(${districtScale})`}>
                      <rect x="-150" y="-34" width="300" height="60" rx="30" fill={INK.yellow} />
                      <text textAnchor="middle" y="6" fontSize="30" fontWeight="900" fill={INK.indigoDeep}>
                        Junction 101
                      </text>
                    </g>
                  ) : (
                    PLACES.map((pl) => <Hotspot key={pl.id} part="label" {...pl} visited={visited.has(pl.id)} plateScale={plateScale} onOpen={open} />)
                  )}
                </g>
                {!far &&
                  PLOTS.map((p, i) => {
                    const shop = neighbours[i];
                    if (!shop) return null;
                    const label = shop.isMe ? "Your shop" : `@${shop.nickname}`;
                    const plateW = label.length * 11 + 34;
                    return (
                      <g key={i} transform={`translate(${p.x} ${p.y + 52}) scale(${plateScale * 0.9}) translate(${-plateW / 2} 0)`}>
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
      <p className="map-hint tiny">Drag to move · pinch or scroll to zoom</p>
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
    </div>
  );
}
