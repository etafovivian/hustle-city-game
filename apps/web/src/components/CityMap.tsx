// Junction 101 — 2D isometric map built from the Stitch art set (public/art, provenance in *.json sidecars).
// Hotspots are real buttons for keyboard and screen-reader access; tap works on mobile.
import type { LocationKey } from "@hc/shared";
import type { KeyboardEvent } from "react";
import { INK } from "../prints.js";

interface HotspotProps {
  id: LocationKey;
  label: string;
  art: string;
  /** Art box in map units (viewBox 800×640). */
  x: number;
  y: number;
  w: number;
  h: number;
  visited: boolean;
  onOpen: (id: LocationKey) => void;
}

function Hotspot({ id, label, art, x, y, w, h, visited, onOpen }: HotspotProps) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
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
      <g transform={`translate(${w / 2 - plateW / 2} ${h + 6})`}>
        <g className="map-plate">
          <rect width={plateW} height="38" rx="19" fill={INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".55" strokeWidth="1.5" />
          <text x={plateW / 2} y="25" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">
            {label}
          </text>
        </g>
      </g>
      {!visited && (
        <g transform={`translate(${w - 14} 18)`} aria-hidden="true">
          <circle r="14" fill={INK.yellow} stroke={INK.indigoDeep} strokeWidth="2.5" />
          <path d="M0-7l2.1 4.9L7-2.1 2.1 0 0 4.9-2.1 0-7-2.1l4.9-.5z" fill={INK.indigoDeep} />
        </g>
      )}
    </g>
  );
}

// Isometric 2:1 roads crossing at the roundabout, so the ground shares the buildings' projection.
const CX = 400;
const CY = 300;
const HALF = 34; // half road width, measured vertically
const roadA = (x: number) => CY + 0.5 * (x - CX); // runs down-right
const roadB = (x: number) => CY - 0.5 * (x - CX); // runs up-right

function band(f: (x: number) => number) {
  return `M0 ${f(0) - HALF} L800 ${f(800) - HALF} L800 ${f(800) + HALF} L0 ${f(0) + HALF}Z`;
}

export function CityMap({ onOpen, visited }: { onOpen: (id: LocationKey) => void; visited: Set<string> }) {
  return (
    <div className="map map-frame">
      <svg viewBox="0 0 800 640" role="group" aria-label="Junction 101 map. Choose a place to go in.">
        <defs>
          <radialGradient id="night" cx="50%" cy="45%" r="75%">
            <stop offset="0" stopColor="#1a2350" />
            <stop offset="1" stopColor="#0d1333" />
          </radialGradient>
          <radialGradient id="lamp">
            <stop offset="0" stopColor="#ffc72c" stopOpacity=".28" />
            <stop offset="1" stopColor="#ffc72c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="640" fill="url(#night)" />

        {/* Ground: isometric road cross, kerbs, lane marks, roundabout */}
        <path d={band(roadA)} fill="var(--map-road)" />
        <path d={band(roadB)} fill="var(--map-road)" />
        <path d={`M0 ${roadA(0) - HALF} L800 ${roadA(800) - HALF}M0 ${roadA(0) + HALF} L800 ${roadA(800) + HALF}`} stroke="#3a4682" strokeWidth="3" />
        <path d={`M0 ${roadB(0) - HALF} L800 ${roadB(800) - HALF}M0 ${roadB(0) + HALF} L800 ${roadB(800) + HALF}`} stroke="#3a4682" strokeWidth="3" />
        <path d={`M0 ${roadA(0)} L800 ${roadA(800)}M0 ${roadB(0)} L800 ${roadB(800)}`} stroke="var(--map-lane)" strokeWidth="3" strokeDasharray="20 16" />
        <ellipse cx={CX} cy={CY} rx="96" ry="48" fill="var(--map-road)" />
        <ellipse cx={CX} cy={CY} rx="62" ry="31" fill={INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".55" strokeWidth="2" />
        <text x={CX} y={CY + 5} textAnchor="middle" fontSize="13" fontWeight="900" fill={INK.yellow} letterSpacing="1.4">
          JUNCTION 101
        </text>

        {/* Lamp light pooling on the ground */}
        <g aria-hidden="true">
          <ellipse cx="400" cy="180" rx="150" ry="70" fill="url(#lamp)" />
          <ellipse cx="400" cy="500" rx="170" ry="70" fill="url(#lamp)" />
          <ellipse cx="680" cy="300" rx="130" ry="60" fill="url(#lamp)" />
        </g>

        {/* Scenery — decorative, not a place */}
        <g aria-hidden="true" className="map-scenery">
          <image href="/art/city-park.webp" x="0" y="190" width="230" height="200" preserveAspectRatio="xMidYMid meet" />
          <image href="/art/danfo-park.webp" x="8" y="455" width="150" height="130" preserveAspectRatio="xMidYMax meet" />
          <image href="/art/signpost.webp" x="660" y="452" width="66" height="130" preserveAspectRatio="xMidYMax meet" />
        </g>

        <Hotspot id="work_hub" label="Work Hub" art="/art/work-hub.webp" x={300} y={0} w={200} h={196} visited={visited.has("work_hub")} onOpen={onOpen} />
        <Hotspot id="hangout" label="The Hangout" art="/art/hangout.webp" x={540} y={150} w={220} h={170} visited={visited.has("hangout")} onOpen={onOpen} />
        <Hotspot
          id="market_square"
          label="Market Square"
          art="/art/market-square.webp"
          x={276}
          y={372}
          w={248}
          h={176}
          visited={visited.has("market_square")}
          onOpen={onOpen}
        />
      </svg>
    </div>
  );
}
