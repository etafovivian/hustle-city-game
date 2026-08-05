// Venues on the map: the building, a floating icon badge with its name, and the place card
// (story, regulars, paid activities, walk there, and real businesses where it fits).
import { VENUES_BY_KEY, type Venue, type VenueDay } from "@hc/shared";
import { CheckCircle2, Coins, Footprints, Sparkles, Store, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, formatCoins } from "../api.js";
import { INK } from "../prints.js";
import { buildingBox } from "./sprites.js";

/** The building: tap to open its card. */
export function VenueBuilding({ venue, x, y, scale = 1, onOpen }: { venue: Venue; x: number; y: number; scale?: number; onOpen: () => void }) {
  const box = buildingBox(venue.art, x, y, scale);
  return (
    <g
      className="hotspot venue"
      role="button"
      tabIndex={0}
      aria-label={`${venue.name}, ${venue.area}. Open.`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
    >
      <ellipse cx={x} cy={y} rx={box.w * 0.42} ry={box.w * 0.09} fill="rgb(0 0 0 / 28%)" />
      <g className="bld">
        <image href={venue.art} x={box.x} y={box.y} width={box.w} height={box.h} />
      </g>
    </g>
  );
}

/** Icon badge floating above the roof (`y` is the roof top), with the name beside it (drawn above the night tint). */
export function VenueBadge({ venue, x, y, scale, showName, onOpen }: { venue: Venue; x: number; y: number; scale: number; showName: boolean; onOpen: () => void }) {
  const nameW = venue.name.length * 9.5 + 30;
  return (
    <g className="venue-badge" transform={`translate(${x} ${y - 16}) scale(${scale})`} onClick={onOpen} aria-hidden="true">
      <line x1="0" y1="18" x2="0" y2="34" stroke="#fff" strokeWidth="3" opacity=".8" />
      <circle r="22" fill="#fff" stroke={INK.indigoDeep} strokeWidth="3" />
      <text y="8" textAnchor="middle" fontSize="22">
        {venue.icon}
      </text>
      {showName && (
        <g transform="translate(26 -15)">
          <rect width={nameW} height="30" rx="15" fill="#fff" stroke={INK.indigoDeep} strokeWidth="2" />
          <text x={nameW / 2} y="20" textAnchor="middle" fontSize="15" fontWeight="800" fill={INK.indigoDeep}>
            {venue.name}
          </text>
        </g>
      )}
    </g>
  );
}

export function VenueCard({
  venueKey,
  onClose,
  onWalk,
  onFindReal,
  onChanged,
  notify,
}: {
  venueKey: string;
  onClose: () => void;
  onWalk: () => void;
  onFindReal: () => void;
  onChanged: () => void;
  notify: (m: string) => void;
}) {
  const venue = VENUES_BY_KEY.get(venueKey)!;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<VenueDay>("GET", "/api/game/venues/today")
      .then((d) => setDone(new Set(d.done)))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const act = async (key: string) => {
    setBusy(key);
    setError(null);
    try {
      const r = await api<VenueDay & { gained: number }>("POST", `/api/game/venues/${venue.key}/${key}`);
      setDone(new Set(r.done));
      onChanged();
      notify(`+${r.gained} XP at ${venue.name}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet venue-card" role="dialog" aria-modal="true" aria-label={venue.name} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <span className="venue-icon" aria-hidden="true">
            {venue.icon}
          </span>
          <div>
            <h2>{venue.name}</h2>
            <span className="small muted">{venue.area}</span>
          </div>
        </div>
        {venue.interior && <img className="venue-interior" src={venue.interior} alt={`Inside ${venue.name}`} />}
        <p>{venue.blurb}</p>
        <p className="small muted">Regulars here: {venue.regulars.join(", ")}</p>

        <ul className="venue-acts">
          {venue.activities.map((a) => {
            const isDone = done.has(`${venue.key}:${a.key}`);
            return (
              <li key={a.key}>
                <span className="venue-act-label">
                  <strong>{a.label}</strong>
                  <span className="tiny muted venue-meta">
                    <Coins size={12} aria-hidden="true" /> {formatCoins(a.cost)} coins <span aria-hidden="true">·</span> <Sparkles size={12} aria-hidden="true" /> +{a.xp} XP
                  </span>
                </span>
                {isDone ? (
                  <span className="notice small">
                    <CheckCircle2 size={15} aria-hidden="true" /> Done today
                  </span>
                ) : (
                  <button type="button" className="btn sm go" disabled={busy !== null} onClick={() => void act(a.key)}>
                    {busy === a.key ? "…" : "Do it"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {error && <p className="alert small">{error}</p>}

        <div className="row">
          <button type="button" className="btn" onClick={onWalk}>
            <Footprints size={16} aria-hidden="true" /> Walk there
          </button>
          {venue.realCategory && (
            <button type="button" className="btn quiet" onClick={onFindReal}>
              <Store size={16} aria-hidden="true" /> Find a real one near you
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
