// Junction 101 — lightweight 2D map (PRD: lightweight 2D map first; Three.js later).
// Hotspots are real buttons for keyboard and screen-reader access; tap works on mobile.
// Each place wears its own wax-print cloth (prints.ts).
import type { LocationKey } from "@hc/shared";
import type { KeyboardEvent, ReactNode } from "react";
import { INK, PRINT_TILES, type PrintKey } from "../prints.js";

function PrintPattern({ id, print, scale = 0.6 }: { id: string; print: PrintKey; scale?: number }) {
  const t = PRINT_TILES[print];
  const s = t.size * scale;
  return (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      <g transform={`scale(${scale})`}>
        <rect width={t.size} height={t.size} fill={t.ground} />
        <g dangerouslySetInnerHTML={{ __html: t.body }} />
      </g>
    </pattern>
  );
}

interface HotspotProps {
  id: LocationKey;
  label: string;
  x: number;
  y: number;
  visited: boolean;
  onOpen: (id: LocationKey) => void;
  children: ReactNode;
}

function Hotspot({ id, label, x, y, visited, onOpen, children }: HotspotProps) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(id);
    }
  };
  const plateW = label.length * 13.5 + 36;
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
      <rect className="ring" x="-8" y="-8" width="216" height="200" rx="16" fill="transparent" />
      <g className="bld">{children}</g>
      {/* Name plate */}
      <g transform={`translate(${100 - plateW / 2} 156)`}>
        <g className="map-plate">
          <rect width={plateW} height="40" rx="10" fill={INK.indigoDeep} />
          <text x={plateW / 2} y="27" textAnchor="middle" fontSize="22" fontWeight="750" fill="#fff" style={{ fontStretch: "85%" }}>
            {label}
          </text>
        </g>
      </g>
      {!visited && (
        <g transform="translate(196 6)" aria-hidden="true">
          <circle r="12" fill={INK.yellow} stroke={INK.indigoDeep} strokeWidth="2" />
          <path d="M0-6l1.8 4.2L6-1.8 1.8 0 0 4.2-1.8 0-6-1.8l4.2-.4z" fill={INK.indigoDeep} />
        </g>
      )}
    </g>
  );
}

function Palm({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <path d="M0 0c2-14 1-26-2-38" stroke="#6b4a2a" strokeWidth="4" fill="none" />
      <g fill={INK.green}>
        <path d="M-2-38c-12-6-22-2-26 6 10-6 18-6 26-6z" />
        <path d="M-2-38c12-6 22-2 26 6-10-6-18-6-26-6z" />
        <path d="M-2-38c-6-10-16-12-22-8 9 0 15 3 22 8z" />
        <path d="M-2-38c6-10 16-12 22-8-9 0-15 3-22 8z" />
      </g>
    </g>
  );
}

function Danfo({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <rect x="0" y="0" width="74" height="30" rx="6" fill={INK.yellow} />
      <rect x="0" y="13" width="74" height="4" fill="#111" />
      <rect x="6" y="4" width="15" height="7" rx="2" fill="#cfe6f5" />
      <rect x="25" y="4" width="15" height="7" rx="2" fill="#cfe6f5" />
      <rect x="44" y="4" width="15" height="7" rx="2" fill="#cfe6f5" />
      <circle cx="17" cy="31" r="6" fill="#111" />
      <circle cx="57" cy="31" r="6" fill="#111" />
    </g>
  );
}

export function CityMap({ onOpen, visited }: { onOpen: (id: LocationKey) => void; visited: Set<string> }) {
  return (
    <div className="map map-frame">
      <svg viewBox="0 0 800 520" role="group" aria-label="Junction 101 map. Choose a place to go in.">
        <defs>
          <PrintPattern id="p-market" print="market" />
          <PrintPattern id="p-work" print="work" />
          <PrintPattern id="p-hangout" print="hangout" />
        </defs>
        <rect width="800" height="520" fill="var(--map-ground)" />
        <ellipse cx="90" cy="70" rx="120" ry="64" fill="var(--map-grass)" />
        <ellipse cx="730" cy="480" rx="130" ry="64" fill="var(--map-grass)" />
        {/* Roads */}
        <rect x="0" y="236" width="800" height="56" fill="var(--map-road)" />
        <rect x="372" y="0" width="56" height="520" fill="var(--map-road)" />
        <path d="M0 264H800M400 0V520" stroke="var(--map-lane)" strokeWidth="3" strokeDasharray="18 14" />
        <circle cx="400" cy="264" r="54" fill="var(--map-road)" />
        <circle cx="400" cy="264" r="32" fill="url(#p-market)" stroke="var(--map-lane)" strokeWidth="4" />
        <g transform="translate(400 330)">
          <rect x="-62" y="-13" width="124" height="26" rx="6" fill={INK.indigoDeep} />
          <text textAnchor="middle" y="5" fontSize="12" fontWeight="800" fill={INK.yellow} letterSpacing="1.5">
            JUNCTION 101
          </text>
        </g>

        <Palm x={60} y={120} />
        <Palm x={112} y={108} />
        <Palm x={710} y={488} />
        <Palm x={762} y={476} />
        <Danfo x={470} y={242} />

        {/* Market Square — stalls under printed umbrellas */}
        <Hotspot id="market_square" label="Market Square" x={70} y={300} visited={visited.has("market_square")} onOpen={onOpen}>
          <rect x="10" y="72" width="180" height="80" rx="8" fill={INK.red} />
          <rect x="10" y="72" width="180" height="12" fill="#8f2314" />
          {[30, 80, 130].map((sx) => (
            <g key={sx}>
              <path d={`M${sx - 10} 62 q32 -46 64 0z`} fill="url(#p-market)" stroke={INK.indigoDeep} strokeWidth="2" />
              <rect x={sx + 20} y="62" width="4" height="30" fill="#4a3522" />
              <rect x={sx} y="98" width="44" height="32" rx="4" fill={INK.cotton} stroke="#8f2314" />
            </g>
          ))}
        </Hotspot>

        {/* Work Hub — office block with printed fascia */}
        <Hotspot id="work_hub" label="Work Hub" x={500} y={22} visited={visited.has("work_hub")} onOpen={onOpen}>
          <rect x="30" y="8" width="140" height="146" rx="6" fill={INK.indigo} />
          <rect x="30" y="8" width="140" height="22" fill="url(#p-work)" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => <rect key={`${r}-${c}`} x={44 + c * 30} y={40 + r * 24} width="20" height="14" rx="2" fill={(r + c) % 3 === 0 ? INK.yellow : "#d7dcf5"} />),
          )}
          <rect x="88" y="130" width="24" height="24" fill={INK.indigoDeep} />
        </Hotspot>

        {/* The Hangout — printed canopy */}
        <Hotspot id="hangout" label="The Hangout" x={500} y={300} visited={visited.has("hangout")} onOpen={onOpen}>
          <rect x="20" y="62" width="160" height="90" rx="10" fill={INK.green} />
          <path d="M8 66h184l-14-30H22z" fill="url(#p-hangout)" stroke={INK.indigoDeep} strokeWidth="2" />
          <rect x="40" y="88" width="40" height="30" rx="4" fill={INK.yellow} />
          <rect x="120" y="88" width="40" height="30" rx="4" fill={INK.yellow} />
          <rect x="88" y="114" width="24" height="38" fill="#124d2c" />
        </Hotspot>
      </svg>
    </div>
  );
}
