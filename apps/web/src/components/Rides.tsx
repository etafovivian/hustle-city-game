// Getting around: the ride picker (trek, danfo, keke, okada, cab with fares and times) and the area boys who
// sometimes stop you on the way. Fares and outcomes come from the server; this only shows them.
import {
  AREA_BOYS_OPTIONS,
  RIDE_MODES,
  isRushHour,
  rideFare,
  rideSeconds,
  type RideMode,
  type StopChoice,
  type StopResult,
} from "@hc/shared";
import { Coins, Footprints, ShieldAlert, Timer, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, formatCoins } from "../api.js";

const ART: Record<RideMode, string | null> = {
  walk: null,
  danfo: "/art/life/danfo-se.webp",
  keke: "/art/life/keke-se.webp",
  okada: "/art/life/okada-se.webp",
  cab: "/art/life/car-taxi.webp",
};

export function RidePicker({
  units,
  hour,
  coins,
  to,
  onPick,
  onClose,
}: {
  /** Trip length in map units along the route. */
  units: number;
  hour: number;
  coins: number | null;
  /** Where to, for the title. */
  to: string;
  onPick: (mode: RideMode) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<RideMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rush = isRushHour(hour);
  const km = (units / 1000).toFixed(1);

  const pick = async (mode: RideMode) => {
    setBusy(mode);
    setError(null);
    try {
      await onPick(mode);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet ride-sheet" role="dialog" aria-modal="true" aria-label={`Go to ${to}`} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="visit-head">
          <h2>How are you going?</h2>
          <span className="small muted">
            To {to} · {km} km{rush && <span className="rush-tag">Rush hour: go-slow and surge</span>}
          </span>
        </div>
        <ul className="ride-list">
          {RIDE_MODES.map((m) => {
            const fare = rideFare(m.mode, units, hour);
            const short = coins !== null && fare > coins;
            return (
              <li key={m.mode}>
                <button type="button" className="ride-option" disabled={busy !== null || short} onClick={() => void pick(m.mode)}>
                  <span className="ride-art" aria-hidden="true">
                    {ART[m.mode] ? <img src={ART[m.mode]!} alt="" /> : <Footprints size={28} />}
                  </span>
                  <span className="ride-text">
                    <strong>{m.label}</strong>
                    <span className="tiny muted">{short ? "Not enough coins" : m.note}</span>
                  </span>
                  <span className="ride-meta">
                    <span className="ride-fare">
                      {fare ? (
                        <>
                          <Coins size={13} aria-hidden="true" /> {formatCoins(fare)}
                        </>
                      ) : (
                        "Free"
                      )}
                    </span>
                    <span className="tiny muted">
                      <Timer size={11} aria-hidden="true" /> {rideSeconds(m.mode, units, hour)}s
                    </span>
                  </span>
                  {busy === m.mode && <span className="tiny">…</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {error && <p className="alert small">{error}</p>}
      </div>
    </div>
  );
}

/** "Area Boys!": four ways out; the server rolls the result. */
export function AreaBoys({ rideId, onDone }: { rideId: string; onDone: (r: StopResult | null) => void }) {
  const [busy, setBusy] = useState<StopChoice | null>(null);
  const [result, setResult] = useState<StopResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choose = async (choice: StopChoice) => {
    setBusy(choice);
    setError(null);
    try {
      setResult(await api<StopResult>("POST", `/api/game/rides/${rideId}/stop`, { choice }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="phone-backdrop">
      <div className="visit-sheet area-boys" role="alertdialog" aria-modal="true" aria-label="Area boys">
        <div className="area-boys-head">
          <span className="area-boys-icon" aria-hidden="true">
            <ShieldAlert size={30} />
          </span>
          <div>
            <h2>Area Boys!</h2>
            <p className="small muted">Three of them block the road. "Oga, you no fit pass like that. Drop something."</p>
          </div>
        </div>
        {result ? (
          <>
            <p className={`area-result ${result.ok ? "ok" : "bad"}`}>{result.message}</p>
            {result.xp > 0 && <p className="small">+{result.xp} XP · +Respect</p>}
            <button type="button" className="btn go" onClick={() => onDone(result)}>
              Continue the trip
            </button>
          </>
        ) : (
          <ul className="area-options">
            {AREA_BOYS_OPTIONS.map((o) => (
              <li key={o.choice}>
                <button type="button" className={`area-option ${o.choice}`} disabled={busy !== null} onClick={() => void choose(o.choice)}>
                  <strong>{o.label}</strong>
                  <span className="tiny">{o.risk}</span>
                  {o.xp > 0 && <span className="tiny muted">Win: +{o.xp} XP</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <>
            <p className="alert small">{error}</p>
            <button type="button" className="btn" onClick={() => onDone(null)}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
