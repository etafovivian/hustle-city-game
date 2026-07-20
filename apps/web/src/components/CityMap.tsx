// Junction 101 — lightweight 2D map (PRD: lightweight 2D map first; Three.js later).
// Hotspots are real buttons for keyboard and screen-reader access; tap works on mobile.
import type { LocationKey } from "@hc/shared";
import type { KeyboardEvent, ReactNode } from "react";

interface HotspotProps {
  id: LocationKey;
  label: string;
  x: number;
  y: number;
  onOpen: (id: LocationKey) => void;
  children: ReactNode;
}

function Hotspot({ id, label, x, y, onOpen, children }: HotspotProps) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(id);
    }
  };
  return (
    <g
      className="hotspot"
      role="button"
      tabIndex={0}
      aria-label={`Enter ${label}`}
      onClick={() => onOpen(id)}
      onKeyDown={onKey}
      transform={`translate(${x} ${y})`}
    >
      <rect className="focus-ring" x="-10" y="-10" width="220" height="190" rx="16" fill="transparent" stroke="transparent" />
      <g className="bld">{children}</g>
      <text x="100" y="172" textAnchor="middle" fontSize="18">
        {label}
      </text>
    </g>
  );
}

function Palm({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <path d="M0 0c2-14 1-26-2-38" stroke="#7a5a32" strokeWidth="4" fill="none" />
      <g fill="#2e8b57">
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
      <rect x="0" y="0" width="70" height="30" rx="6" fill="#f5c542" />
      <rect x="0" y="12" width="70" height="4" fill="#1b1410" />
      <rect x="6" y="4" width="14" height="7" rx="2" fill="#bfe3f2" />
      <rect x="24" y="4" width="14" height="7" rx="2" fill="#bfe3f2" />
      <rect x="42" y="4" width="14" height="7" rx="2" fill="#bfe3f2" />
      <circle cx="16" cy="31" r="6" fill="#1b1410" />
      <circle cx="54" cy="31" r="6" fill="#1b1410" />
    </g>
  );
}

export function CityMap({ onOpen, visited }: { onOpen: (id: LocationKey) => void; visited: Set<string> }) {
  const badge = (id: string, x: number, y: number) =>
    visited.has(id) ? null : (
      <g transform={`translate(${x} ${y})`} aria-hidden="true">
        <circle r="13" fill="var(--accent)" stroke="#1b1410" strokeWidth="2" />
        <text textAnchor="middle" dy="5" fontSize="16" fontWeight="800" fill="#1b1410">
          !
        </text>
      </g>
    );

  return (
    <div className="map">
      <svg viewBox="0 0 800 520" aria-label="Junction 101 map. Choose a location.">
        <rect width="800" height="520" fill="var(--map-ground)" />
        {/* Grass patches */}
        <ellipse cx="90" cy="70" rx="110" ry="60" fill="var(--map-grass)" />
        <ellipse cx="720" cy="470" rx="120" ry="60" fill="var(--map-grass)" />
        {/* Roads */}
        <rect x="0" y="236" width="800" height="56" fill="var(--map-road)" />
        <rect x="372" y="0" width="56" height="520" fill="var(--map-road)" />
        <path d="M0 264H800M400 0V520" stroke="var(--map-road-line)" strokeWidth="3" strokeDasharray="18 14" />
        {/* Roundabout */}
        <circle cx="400" cy="264" r="52" fill="var(--map-road)" />
        <circle cx="400" cy="264" r="30" fill="var(--map-grass)" stroke="var(--map-road-line)" strokeWidth="3" />
        <text x="400" y="270" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text)">
          J101
        </text>

        <Palm x={60} y={120} />
        <Palm x={110} y={110} />
        <Palm x={700} y={480} />
        <Palm x={760} y={470} />
        <Danfo x={470} y={242} />

        {/* Market Square — stalls with umbrellas */}
        <Hotspot id="market_square" label="Market Square" x={70} y={300} onOpen={onOpen}>
          <rect x="10" y="70" width="180" height="80" rx="8" fill="#d9a066" />
          <rect x="10" y="70" width="180" height="14" fill="#b5793f" />
          {[30, 80, 130].map((sx, i) => (
            <g key={sx}>
              <path d={`M${sx - 8} 60 q30 -40 60 0z`} fill={["#e2572b", "#0f7b4b", "#2f6fb2"][i]} />
              <rect x={sx + 20} y="60" width="4" height="30" fill="#5b4630" />
              <rect x={sx} y="96" width="44" height="34" rx="4" fill="#f3e2c3" stroke="#b5793f" />
            </g>
          ))}
        </Hotspot>
        {badge("market_square", 260, 320)}

        {/* Work Hub — office block */}
        <Hotspot id="work_hub" label="Work Hub" x={500} y={30} onOpen={onOpen}>
          <rect x="30" y="10" width="140" height="140" rx="6" fill="#5b7a99" />
          <rect x="30" y="10" width="140" height="16" fill="#3f5a75" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect key={`${r}-${c}`} x={44 + c * 30} y={36 + r * 24} width="20" height="14" rx="2" fill="#cfe6f5" />
            )),
          )}
          <rect x="88" y="126" width="24" height="24" fill="#2b3e52" />
        </Hotspot>
        {badge("work_hub", 690, 40)}

        {/* The Hangout — joint with canopy and seats */}
        <Hotspot id="hangout" label="The Hangout" x={500} y={300} onOpen={onOpen}>
          <rect x="20" y="60" width="160" height="90" rx="10" fill="#8e5bb5" />
          <path d="M10 64h180l-14-26H24z" fill="#f5c542" />
          <path d="M10 64h180" stroke="#1b1410" strokeWidth="2" />
          <rect x="40" y="86" width="40" height="30" rx="4" fill="#f0d9ff" />
          <rect x="120" y="86" width="40" height="30" rx="4" fill="#f0d9ff" />
          <rect x="88" y="112" width="24" height="38" fill="#4d2f66" />
          <circle cx="62" cy="40" r="5" fill="#ff6b6b" />
          <circle cx="100" cy="36" r="5" fill="#4ecdc4" />
          <circle cx="138" cy="40" r="5" fill="#ffe66d" />
        </Hotspot>
        {badge("hangout", 690, 320)}
      </svg>
    </div>
  );
}
