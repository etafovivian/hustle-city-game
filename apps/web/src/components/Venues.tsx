// Venues on the map: the building, a floating icon badge with its name, and the place card
// (story, regulars, paid activities, walk there, and real businesses where it fits).
import { VENUES_BY_KEY, VIBE_LABEL, clockHour, hoursLabel, isOpenAt, venueActions, venueHours, type Venue, type VenueAction, type VenueDay } from "@hc/shared";
import { CheckCircle2, Clock, Coins, Crown, Footprints, GraduationCap, Sparkles, Store, Timer, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, formatCoins } from "../api.js";
import { INK } from "../prints.js";
import { InteriorScene, ROOMS } from "./Interior.js";
import { useLagosLight } from "./lagosTime.js";
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
  onApp,
  branch,
}: {
  venueKey: string;
  /** A branch of this place (same room and activities, its own name and area). */
  branch?: { name: string; area: string; key: string };
  onClose: () => void;
  onWalk: () => void;
  onFindReal: () => void;
  onChanged: () => void;
  notify: (m: string) => void;
  /** Open a phone app (the school opens the Academy). */
  onApp?: (app: "academy") => void;
}) {
  const base = VENUES_BY_KEY.get(venueKey)!;
  const venue = branch ? { ...base, name: branch.name, area: branch.area } : base;
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

  const hour = useLagosLight().hour;
  const open = isOpenAt(venue, hour);
  const actions = venueActions(venue);
  /** The activity playing now: the room plays for its seconds, then the result shows. */
  const [running, setRunning] = useState<{ action: VenueAction; started: number; gained: number } | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const remain = running.action.seconds - (Date.now() - running.started) / 1000;
      setLeft(Math.max(0, remain));
      if (remain > 0) return;
      window.clearInterval(id);
      const vibes = running.action.gives.map((g) => `+${VIBE_LABEL[g]}`).join(" ");
      notify(running.gained ? `+${running.gained} XP ${vibes} at ${venue.name}` : `${vibes} at ${venue.name}`);
      setRunning(null);
    };
    const id = window.setInterval(tick, 200);
    tick();
    return () => window.clearInterval(id);
  }, [running, notify, venue.name]);

  const act = async (a: VenueAction) => {
    setError(null);
    if (a.kind === "free") {
      setRunning({ action: a, started: Date.now(), gained: 0 });
      return;
    }
    setBusy(a.key);
    try {
      // Pay first (the server checks hours, coins and once-a-day), then the room plays it out.
      const r = await api<VenueDay & { gained: number }>("POST", `/api/game/venues/${venue.key}/${a.key}`);
      setDone(new Set(r.done));
      onChanged();
      setRunning({ action: a, started: Date.now(), gained: r.gained });
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
        <div className={`venue-layout ${venue.interior ? "has-room" : ""}`}>
        {venue.interior && (
          <div className="venue-room">
            <InteriorScene src={venue.interior} alt={`Inside ${venue.name}`} room={ROOMS[venue.interior.split("/").pop()!.replace(".webp", "")]} seed={(branch?.key ?? venue.key).length} />
          </div>
        )}
        <div className="venue-info">
        <p>{venue.blurb}</p>
        {branch ? (
          <p className="small muted">Same things to do as {base.name} in {base.area}.</p>
        ) : (
          <p className="small muted">Regulars here: {venue.regulars.join(", ")}</p>
        )}

        <p className={`venue-hours small ${open ? "open" : "closed"}`}>
          <Clock size={14} aria-hidden="true" /> {hoursLabel(venue, hour)}
          {!open && <span className="muted"> · come back tonight or tomorrow</span>}
        </p>

        <ul className="venue-acts">
          {actions.map((a) => {
            const isDone = a.kind !== "free" && done.has(`${venue.key}:${a.key}`);
            const playing = running?.action.key === a.key;
            return (
              <li key={a.key} className={a.kind === "flex" ? "flex" : a.kind === "free" ? "free" : undefined}>
                <span className="venue-act-label">
                  <strong>
                    {a.kind === "flex" && <Crown size={14} aria-hidden="true" />} {a.label}
                  </strong>
                  <span className="tiny muted venue-meta">
                    {a.cost ? (
                      <>
                        <Coins size={12} aria-hidden="true" /> {formatCoins(a.cost)} coins <span aria-hidden="true">·</span> <Sparkles size={12} aria-hidden="true" /> +{a.xp} XP
                      </>
                    ) : (
                      <>Free</>
                    )}{" "}
                    <span aria-hidden="true">·</span> <Timer size={12} aria-hidden="true" /> {a.seconds}s
                  </span>
                  <span className="vibes">
                    {a.gives.map((g) => (
                      <span key={g} className={`vibe vibe-${g}`}>
                        +{VIBE_LABEL[g]}
                      </span>
                    ))}
                  </span>
                  {playing && (
                    <span className="act-progress" role="progressbar" aria-valuemin={0} aria-valuemax={a.seconds} aria-valuenow={Math.round(a.seconds - left)}>
                      <span style={{ width: `${(100 * (a.seconds - left)) / a.seconds}%` }} />
                    </span>
                  )}
                </span>
                {isDone ? (
                  <span className="notice small">
                    <CheckCircle2 size={15} aria-hidden="true" /> Done today
                  </span>
                ) : playing ? (
                  <span className="small muted">{Math.ceil(left)}s</span>
                ) : !open ? (
                  <span className="small muted">Opens {clockHour(venueHours(venue)![0])}</span>
                ) : (
                  <button type="button" className={`btn sm ${a.kind === "flex" ? "gold" : "go"}`} disabled={busy !== null || running !== null} onClick={() => void act(a)}>
                    {busy === a.key ? "…" : a.kind === "flex" ? "Flex" : "Do it"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {error && <p className="alert small">{error}</p>}

        <div className="row">
          <button type="button" className="btn" onClick={onWalk}>
            <Footprints size={16} aria-hidden="true" /> Go there
          </button>
          {venue.opens === "academy" && onApp && (
            <button type="button" className="btn go" onClick={() => onApp("academy")}>
              <GraduationCap size={16} aria-hidden="true" /> Open Hustle Academy
            </button>
          )}
          {venue.realCategory && (
            <button type="button" className="btn quiet" onClick={onFindReal}>
              <Store size={16} aria-hidden="true" /> Find a real one near you
            </button>
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
