// New Lagos — a pan-and-zoom isometric world with Junction 101 at its centre.
// Art is the Stitch raster set (public/art, provenance in *.json sidecars).
// Places are real buttons for keyboard and screen-reader access; drag never triggers a tap.
import { HUSTLES_BY_KEY, type LocationKey, type NeighbourShop } from "@hc/shared";
import { LocateFixed, Minus, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SVGProps } from "react";
import { api } from "../api.js";
import { INK } from "../prints.js";
import { usePanZoom } from "./usePanZoom.js";

// World units. Junction 101 occupies an 800×640 block at the centre.
const WORLD = { w: 4800, h: 3600 };
const CX = 2400;
const CY = 1800;
const J = { x: CX - 400, y: CY - 300, w: 800, h: 640 };
const HALF = 34; // half road width, measured vertically
const roadA = (x: number) => CY + 0.5 * (x - CX); // runs down-right
const roadB = (x: number) => CY - 0.5 * (x - CX); // runs up-right

const band = (f: (x: number) => number) =>
  `M0 ${f(0) - HALF} L${WORLD.w} ${f(WORLD.w) - HALF} L${WORLD.w} ${f(WORLD.w) + HALF} L0 ${f(0) + HALF}Z`;

/** Districts beyond Junction 101 — named for the game world, opening in later stages. */
const DISTRICTS = [
  { name: "Tech Mile", x: CX + 1250, y: CY - 640 },
  { name: "Owambe Gardens", x: CX - 1250, y: CY - 640 },
  { name: "Marina Wharf", x: CX + 1250, y: CY + 640 },
  { name: "Danfo Terminal", x: CX - 1250, y: CY + 640 },
];

/** Each hustle's shop looks different on the map (Stitch art in public/art/buildings). */
const HUSTLE_ART: Record<string, string> = {
  trader: "/art/market-square.webp",
  chop: "/art/buildings/buka.webp",
  gadget: "/art/buildings/gadget-kiosk.webp",
  artisan: "/art/buildings/tailor-shop.webp",
};

/** City buildings that make each district read as a real neighbourhood (decorative for now). */
const DISTRICT_BUILDINGS: Record<string, string[]> = {
  "Tech Mile": ["commercial-block", "mixed-use-block", "residential-block"],
  "Owambe Gardens": ["bungalow", "suya-stand", "mixed-use-block"],
  "Marina Wharf": ["residential-block", "bungalow", "commercial-block"],
  "Danfo Terminal": ["mixed-use-block", "bungalow", "suya-stand"],
};
const OFFSETS = [
  { x: -300, y: -150 },
  { x: 300, y: -150 },
  { x: -300, y: 190 },
  { x: 300, y: 190 },
  { x: 0, y: -300 },
  { x: 0, y: 330 },
];
const clearOfRoads = (x: number, y: number) => Math.abs(y - roadA(x)) > 130 && Math.abs(y - roadB(x)) > 130;
const SCENERY = DISTRICTS.flatMap((d) =>
  (DISTRICT_BUILDINGS[d.name] ?? []).map((art, i) => {
    const spot = OFFSETS.filter((o) => clearOfRoads(d.x + o.x, d.y + o.y))[i] ?? OFFSETS[i]!;
    return { art: `/art/buildings/${art}.webp`, x: d.x + spot.x, y: d.y + spot.y, key: `${d.name}-${i}` };
  }),
);
/** A ring of homes and blocks between the junction and the districts, so the city has no bare sand. */
const RING = [
  { x: CX - 820, y: CY, art: "bungalow" },
  { x: CX + 820, y: CY, art: "residential-block" },
  { x: CX - 620, y: CY - 560, art: "commercial-block" },
  { x: CX + 620, y: CY - 560, art: "bungalow" },
  { x: CX - 620, y: CY + 600, art: "residential-block" },
  { x: CX + 620, y: CY + 600, art: "suya-stand" },
  { x: CX, y: CY - 1000, art: "mixed-use-block" },
  { x: CX, y: CY + 1040, art: "bungalow" },
  { x: CX - 1080, y: CY - 260, art: "suya-stand" },
  { x: CX + 1080, y: CY + 300, art: "commercial-block" },
];
const ALL_SCENERY = [
  ...SCENERY,
  ...RING.filter((r) => clearOfRoads(r.x, r.y)).map((r, i) => ({ art: `/art/buildings/${r.art}.webp`, x: r.x, y: r.y, key: `ring-${i}` })),
].sort((a, b) => a.y - b.y);

/** Plots around the junction: players' shops fill them; the rest show as open plots. Clear of roads and places. */
const PLOTS = [
  { x: CX - 520, y: CY - 120 },
  { x: CX + 520, y: CY - 150 },
  { x: CX - 250, y: CY - 420 },
  { x: CX + 250, y: CY - 420 },
  { x: CX - 250, y: CY + 470 },
  { x: CX + 250, y: CY + 470 },
  { x: CX - 520, y: CY + 170 },
  { x: CX + 520, y: CY + 150 },
  { x: CX, y: CY - 680 },
  { x: CX, y: CY + 700 },
];

/** Screen size (px) a world-unit size renders at, kept readable at any zoom. */
const readable = (k: number, worldSize: number, minPx: number, max = 8) => Math.min(max, Math.max(1, minPx / (worldSize * k)));

interface HotspotProps {
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

function Hotspot({ id, label, art, x, y, w, h, visited, plateScale, onOpen }: HotspotProps) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onOpen(id);
    }
  };
  const plateW = label.length * 13 + 40;
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
      <g transform={`translate(${w / 2} ${h + 6}) scale(${plateScale}) translate(${-plateW / 2} 0)`}>
        <rect width={plateW} height="38" rx="19" fill={INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".55" strokeWidth="1.5" />
        <text x={plateW / 2} y="25" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">
          {label}
        </text>
      </g>
      {!visited && (
        <g transform={`translate(${w - 14} 18) scale(${Math.min(plateScale, 3)})`} aria-hidden="true">
          <circle r="14" fill={INK.yellow} stroke={INK.indigoDeep} strokeWidth="2.5" />
          <path d="M0-7l2.1 4.9L7-2.1 2.1 0 0 4.9-2.1 0-7-2.1l4.9-.5z" fill={INK.indigoDeep} />
        </g>
      )}
    </g>
  );
}

function Diamond({ x, y, w, h, ...rest }: { x: number; y: number; w: number; h: number } & SVGProps<SVGPathElement>) {
  return <path d={`M${x} ${y - h / 2} L${x + w / 2} ${y} L${x} ${y + h / 2} L${x - w / 2} ${y}Z`} {...rest} />;
}

export function CityMap({ onOpen, visited }: { onOpen: (id: LocationKey) => void; visited: Set<string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [neighbours, setNeighbours] = useState<NeighbourShop[]>([]);
  const [peek, setPeek] = useState<NeighbourShop | null>(null);
  useEffect(() => {
    api<NeighbourShop[]>("GET", "/api/game/neighbours")
      .then(setNeighbours)
      .catch(() => setNeighbours([]));
  }, []);
  // Home view: the junction plus the ring of player shops around it.
  const HOME = { x: CX - 680, y: CY - 560, w: 1360, h: 1360 };
  const pz = usePanZoom(ref, { minK: 0.08, maxK: 4, home: HOME, bounds: WORLD });
  const k = pz.view?.k ?? 1;
  const plateScale = readable(k, 20, 14);
  const districtScale = readable(k, 56, 16, 20);
  const far = k < 0.3;

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
            <radialGradient id="sand-shade" cx="50%" cy="50%" r="60%">
              <stop offset="0.55" stopColor="#5a3d1c" stopOpacity="0" />
              <stop offset="1" stopColor="#5a3d1c" stopOpacity=".38" />
            </radialGradient>
            <radialGradient id="lamp">
              <stop offset="0" stopColor="#ffc72c" stopOpacity=".28" />
              <stop offset="1" stopColor="#ffc72c" stopOpacity="0" />
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

              {/* Arterial roads crossing the whole city */}
              <path d={band(roadA)} fill="var(--map-road)" />
              <path d={band(roadB)} fill="var(--map-road)" />
              <path
                d={`M0 ${roadA(0) - HALF} L${WORLD.w} ${roadA(WORLD.w) - HALF}M0 ${roadA(0) + HALF} L${WORLD.w} ${roadA(WORLD.w) + HALF}M0 ${roadB(0) - HALF} L${WORLD.w} ${roadB(WORLD.w) - HALF}M0 ${roadB(0) + HALF} L${WORLD.w} ${roadB(WORLD.w) + HALF}`}
                stroke="#e6d6b4"
                strokeWidth="6"
              />
              <path d={`M0 ${roadA(0)} L${WORLD.w} ${roadA(WORLD.w)}M0 ${roadB(0)} L${WORLD.w} ${roadB(WORLD.w)}`} stroke="var(--map-lane)" strokeWidth="3" strokeDasharray="20 16" />

              {/* Districts that open in later stages */}
              {DISTRICTS.map((d) => (
                <g key={d.name} aria-hidden="true">
                  <Diamond x={d.x} y={d.y} w={1100} h={550} fill="rgb(255 255 255 / 7%)" stroke="#8c6a3e" strokeWidth="4" strokeDasharray="18 14" />
                </g>
              ))}

              {/* District and neighbourhood buildings (decorative until districts open) */}
              <g aria-hidden="true" className="map-scenery">
                {ALL_SCENERY.map((b) => (
                  <image key={b.key} href={b.art} x={b.x - 120} y={b.y - 210} width="240" height="230" preserveAspectRatio="xMidYMax meet" />
                ))}
              </g>

              {/* District names sit above their buildings */}
              {DISTRICTS.map((d) => (
                <g key={`${d.name}-label`} aria-hidden="true">
                  <g transform={`translate(${d.x} ${d.y}) scale(${districtScale})`}>
                    <rect x={-(d.name.length * 17 + 50)} y="-62" width={d.name.length * 34 + 100} height="118" rx="26" fill={INK.indigoDeep} opacity=".9" />
                    <text textAnchor="middle" fontSize="56" fontWeight="900" fill="#fff">
                      {d.name}
                    </text>
                    <text textAnchor="middle" y="40" fontSize="24" fontWeight="700" fill={INK.yellow} letterSpacing="3">
                      OPENS LATER
                    </text>
                  </g>
                </g>
              ))}

              {/* Junction 101 */}
              <g transform={`translate(${J.x} ${J.y})`}>
                <ellipse cx="400" cy="300" rx="96" ry="48" fill="var(--map-road)" />
                <ellipse cx="400" cy="300" rx="62" ry="31" fill={INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".55" strokeWidth="2" />
                <g transform={`translate(400 305) scale(${Math.min(districtScale, 6)})`}>
                  <text textAnchor="middle" fontSize="13" fontWeight="900" fill={INK.yellow} letterSpacing="1.4">
                    JUNCTION 101
                  </text>
                </g>
                <g aria-hidden="true">
                  <ellipse cx="400" cy="180" rx="150" ry="70" fill="url(#lamp)" />
                  <ellipse cx="400" cy="500" rx="170" ry="70" fill="url(#lamp)" />
                  <ellipse cx="680" cy="300" rx="130" ry="60" fill="url(#lamp)" />
                </g>
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
                    <g transform={`translate(400 470) scale(${districtScale})`}>
                      <rect x="-150" y="-34" width="300" height="60" rx="30" fill={INK.yellow} />
                      <text textAnchor="middle" y="6" fontSize="30" fontWeight="900" fill={INK.indigoDeep}>
                        Junction 101
                      </text>
                    </g>
                  </g>
                ) : (
                <>
                <Hotspot id="work_hub" label="Work Hub" art="/art/work-hub.webp" x={300} y={0} w={200} h={196} visited={visited.has("work_hub")} plateScale={plateScale} onOpen={open} />
                <Hotspot id="hangout" label="The Hangout" art="/art/hangout.webp" x={540} y={150} w={220} h={170} visited={visited.has("hangout")} plateScale={plateScale} onOpen={open} />
                <Hotspot
                  id="market_square"
                  label="Market Square"
                  art="/art/market-square.webp"
                  x={276}
                  y={372}
                  w={248}
                  h={176}
                  visited={visited.has("market_square")}
                  plateScale={plateScale}
                  onOpen={open}
                />
                </>
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
                  const label = shop.isMe ? "Your shop" : `@${shop.nickname}`;
                  const plateW = label.length * 11 + 34;
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
                      <g transform={`translate(${p.x} ${p.y + 52}) scale(${plateScale * 0.9}) translate(${-plateW / 2} 0)`}>
                        <rect width={plateW} height="32" rx="16" fill={shop.isMe ? INK.yellow : INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".5" />
                        <text x={plateW / 2} y="21" textAnchor="middle" fontSize="17" fontWeight="800" fill={shop.isMe ? INK.indigoDeep : "#fff"}>
                          {label}
                        </text>
                      </g>
                    </g>
                  );
                })}
            </g>
          )}
        </svg>
      </div>

      <div className="map-controls" role="group" aria-label="Map zoom">
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
          {!peek.isMe && <span className="tiny muted">Visiting other players' shops opens with friends in the private beta.</span>}
        </div>
      )}
    </div>
  );
}
