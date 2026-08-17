// The city map: all of Lagos on one screen (land, water, main roads, areas, places, real businesses and you), with
// a search. Tap anything to fly the camera there, or ride straight to it.
import { VENUES_BY_KEY, type MapBusiness } from "@hc/shared";
import { LocateFixed, Navigation, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BEACH_PATH,
  BRANCHES,
  DISTRICTS,
  FORESTS,
  FOR_SALE,
  ISLAND_PATH,
  OCEAN_PATH,
  ROAD_PATHS,
  VENUE_SPOTS,
  WATER_PATH,
  WORLD,
} from "./cityLayout.js";

export interface Spot {
  key: string;
  label: string;
  sub: string;
  icon: string;
  x: number;
  y: number;
  kind: "area" | "place" | "branch" | "business";
  /** Opens this place's card on arrival. */
  venue?: string;
}

function useSpots(mapBiz: MapBusiness[]): Spot[] {
  return useMemo(() => {
    const out: Spot[] = [];
    for (const d of DISTRICTS) out.push({ key: `area-${d.name}`, label: d.name, sub: "Area", icon: "📍", x: d.x, y: d.y, kind: "area" });
    for (const s of VENUE_SPOTS) {
      const v = VENUES_BY_KEY.get(s.key);
      if (v) out.push({ key: s.key, label: v.name, sub: v.area, icon: v.icon, x: s.x, y: s.y, kind: "place", venue: s.key });
    }
    for (const b of BRANCHES) {
      const v = VENUES_BY_KEY.get(b.base);
      out.push({ key: b.key, label: b.name, sub: b.area, icon: v?.icon ?? "📍", x: b.x, y: b.y, kind: "branch", venue: b.key });
    }
    for (const b of mapBiz) {
      const l = FOR_SALE.find((p) => p.id === b.plotId);
      if (l) out.push({ key: `biz-${b.plotId}`, label: b.name, sub: `Real business · ${l.area}`, icon: "🏪", x: l.x, y: l.y, kind: "business" });
    }
    return out;
  }, [mapBiz]);
}

const KIND_ORDER: Spot["kind"][] = ["area", "place", "business", "branch"];
const KIND_LABEL: Record<Spot["kind"], string> = { area: "Areas", place: "Places", business: "Real businesses", branch: "More places" };

export function CityOverview({
  me,
  home,
  mapBiz,
  onClose,
  onShow,
  onGo,
}: {
  me: { x: number; y: number };
  home: { x: number; y: number };
  mapBiz: MapBusiness[];
  onClose: () => void;
  /** Fly the camera there (and open the place). */
  onShow: (s: Spot) => void;
  /** Ride or walk there. */
  onGo: (s: Spot) => void;
}) {
  const base = useSpots(mapBiz);
  const spots = useMemo(() => [{ key: "home", label: "Your home", sub: "Rest and change your house", icon: "🏠", x: home.x, y: home.y, kind: "place" as const, venue: "__home" }, ...base], [base, home.x, home.y]);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Spot | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const term = q.trim().toLowerCase();
  const found = term ? spots.filter((s) => s.label.toLowerCase().includes(term) || s.sub.toLowerCase().includes(term)).slice(0, 30) : [];
  const roads = ROAD_PATHS.filter((r) => r.kind === "road" || r.kind === "bridge");
  // Frame the city (everything with a name on it), not the open sea around it.
  const box = useMemo(() => {
    const xs = spots.map((s) => s.x);
    const ys = spots.map((s) => s.y);
    const pad = 600;
    const x0 = Math.max(0, Math.min(...xs) - pad);
    const y0 = Math.max(0, Math.min(...ys) - pad - 300);
    const x1 = Math.min(WORLD.w, Math.max(...xs) + pad);
    const y1 = Math.min(WORLD.h, Math.max(...ys) + pad);
    return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
  }, [spots]);

  return createPortal(
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet overview-sheet" role="dialog" aria-modal="true" aria-label="City map" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="visit-head">
          <h2>City map</h2>
          <span className="small muted">Tap a place to see it, or search. {spots.filter((s) => s.kind !== "area").length} places to go.</span>
        </div>
        <div className="overview-layout">
          <div className="overview-map">
            <svg viewBox={box} role="img" aria-label="Map of the city">
              <rect width={WORLD.w} height={WORLD.h} fill="#d9b981" />
              <path d={WATER_PATH} fill="#2f8fb0" />
              <path d={OCEAN_PATH} fill="#1f6f9a" />
              <path d={ISLAND_PATH} fill="#e3c48f" />
              <path d={BEACH_PATH} fill="#f2dfb0" />
              {FORESTS.map((f) => (
                <path key={f.name} d={f.path} fill="#4c8a3c" opacity=".75" />
              ))}
              {roads.map((r) => (
                <path key={r.id} d={r.d} fill="none" stroke={r.kind === "bridge" ? "#cfd3d8" : "#4a4540"} strokeWidth="90" strokeLinecap="round" />
              ))}
              {DISTRICTS.map((d) => (
                <text key={d.name} x={d.x} y={d.y - 420} textAnchor="middle" fontSize="230" fontWeight="900" fill="#fff" stroke="#0a0f24" strokeWidth="40" paintOrder="stroke" pointerEvents="none">
                  {d.name}
                </text>
              ))}
              {spots
                .filter((s) => s.kind === "branch")
                .map((s) => (
                  <circle key={s.key} cx={s.x} cy={s.y} r="45" fill="#fff" stroke="#0a0f24" strokeWidth="14" className="ov-dot" onClick={() => setPicked(s)} />
                ))}
              {spots
                .filter((s) => s.kind === "place" || s.kind === "business")
                .map((s) => (
                  <g key={s.key} className="ov-pin" transform={`translate(${s.x} ${s.y})`} onClick={() => setPicked(s)}>
                    <circle r="150" fill={s.kind === "business" ? "#0e3b2a" : "#fff"} stroke={picked?.key === s.key ? "#ffc72c" : "#0a0f24"} strokeWidth={picked?.key === s.key ? 40 : 18} />
                    <text y="60" textAnchor="middle" fontSize="170">
                      {s.icon}
                    </text>
                  </g>
                ))}
              {picked && (
                <circle cx={picked.x} cy={picked.y} r="260" fill="none" stroke="#ffc72c" strokeWidth="50">
                  <animate attributeName="r" values="200;340;200" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              {/* You */}
              <g transform={`translate(${me.x} ${me.y})`}>
                <circle r="260" fill="#ffc72c" opacity=".35">
                  <animate attributeName="r" values="160;300;160" dur="1.8s" repeatCount="indefinite" />
                </circle>
                <circle r="120" fill="#ffc72c" stroke="#0a0f24" strokeWidth="30" />
              </g>
            </svg>
          </div>
          <div className="overview-side">
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input className="input" placeholder="Find a place, area or business" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {picked && (
              <div className="ov-picked">
                <strong>
                  {picked.icon} {picked.label}
                </strong>
                <span className="tiny muted">{picked.sub}</span>
                <div className="row">
                  <button type="button" className="btn sm" onClick={() => onShow(picked)}>
                    <LocateFixed size={15} aria-hidden="true" /> Show me
                  </button>
                  <button type="button" className="btn sm go" onClick={() => onGo(picked)}>
                    <Navigation size={15} aria-hidden="true" /> Go there
                  </button>
                </div>
              </div>
            )}
            <div className="ov-list">
              {term
                ? found.map((s) => <SpotRow key={s.key} s={s} onPick={setPicked} />)
                : KIND_ORDER.filter((k) => k !== "branch").map((k) => {
                    const items = spots.filter((s) => s.kind === k);
                    return items.length ? (
                      <div key={k}>
                        <span className="ov-group">{KIND_LABEL[k]}</span>
                        {items.map((s) => (
                          <SpotRow key={s.key} s={s} onPick={setPicked} />
                        ))}
                      </div>
                    ) : null;
                  })}
              {term && !found.length && <p className="small muted">Nothing called that yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SpotRow({ s, onPick }: { s: Spot; onPick: (s: Spot) => void }) {
  return (
    <button type="button" className="ov-row" onClick={() => onPick(s)}>
      <span aria-hidden="true">{s.icon}</span>
      <span>
        <strong>{s.label}</strong>
        <span className="tiny muted">{s.sub}</span>
      </span>
    </button>
  );
}
