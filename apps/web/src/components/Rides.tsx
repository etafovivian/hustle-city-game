// Getting around: the ride picker (trek, danfo, keke, okada, cab with fares and times) and the area boys who
// sometimes stop you on the way. Fares and outcomes come from the server; this only shows them.
import {
  AREA_BOYS_OPTIONS,
  RIDE_MODES,
  TRANSIT,
  isRushHour,
  rainSurge,
  rideFare,
  rideSeconds,
  VEHICLES,
  fuelCost,
  fuelPriceOn,
  type RideMode,
  type VehicleKind,
  type StopChoice,
  type StopResult,
} from "@hc/shared";
import { Coins, Footprints, ShieldAlert, Timer, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, formatCoins } from "../api.js";
import type { TransitPlan } from "./transit.js";

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
  vehicles = [],
  plans = [],
  walkable = true,
  onTransit,
}: {
  /** Public transport plans (walk, ride, walk) worth offering. */
  plans?: TransitPlan[];
  /** False when only a boat gets you there (no road or path). */
  walkable?: boolean;
  onTransit?: (plan: TransitPlan) => Promise<void>;
  /** Vehicles the player owns (drive yourself for fuel). */
  vehicles?: VehicleKind[];
  /** Trip length in map units along the route. */
  units: number;
  hour: number;
  coins: number | null;
  /** Where to, for the title. */
  to: string;
  onPick: (mode: RideMode | "own", vehicle?: VehicleKind) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    // Focus the sheet once when it opens; refocusing on every re-render pulled focus out of text fields.
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const rush = isRushHour(hour);
  const rain = rainSurge(new Date());
  const km = (units / 1000).toFixed(1);

  const pick = async (mode: RideMode | "own", vehicle?: VehicleKind) => {
    setBusy(vehicle ?? mode);
    setError(null);
    try {
      await onPick(mode, vehicle);
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
            To {to}
            {walkable ? ` · ${km} km` : plans?.some((p) => p.kinds.includes("flight")) ? " · by air" : " · by boat"}
            {rush && walkable && <span className="rush-tag">Rush hour: go-slow and surge</span>}
            {rain.fare > 1 && <span className="rush-tag">Rain surge</span>}
          </span>
        </div>
        {!walkable && <p className="small notice">{plans?.some((p) => p.kinds.includes("flight")) ? "Only a flight goes there: from the Airport Ridge terminal." : "Only the water bus goes there."}</p>}
        <ul className="ride-list">
          {plans.map((pl) => {
            const key = `transit:${pl.kinds.join("+")}`;
            const short = coins !== null && pl.fare > coins;
            const walkMins = pl.legs.filter((l) => l.kind === "walk").reduce((s, l) => s + l.units, 0) / 300;
            return (
              <li key={key}>
                <button
                  type="button"
                  className="ride-option transit"
                  style={{ borderColor: pl.color }}
                  disabled={busy !== null || short || !onTransit}
                  onClick={() => {
                    setBusy(key);
                    setError(null);
                    onTransit!(pl).catch((e: Error) => {
                      setError(e.message);
                      setBusy(null);
                    });
                  }}
                >
                  <span className="ride-art transit-icon" aria-hidden="true" style={{ background: pl.color }}>
                    {pl.kinds.map((k) => TRANSIT[k].icon).join("")}
                  </span>
                  <span className="ride-text">
                    <strong>{pl.title}</strong>
                    <span className="tiny muted">{short ? "Not enough coins" : `${pl.detail} · ${walkMins >= 1 ? `${Math.round(walkMins)}s walk` : "stop right here"}`}</span>
                  </span>
                  <span className="ride-meta">
                    <span className="ride-fare">
                      <Coins size={13} aria-hidden="true" /> {formatCoins(pl.fare)}
                    </span>
                    <span className="tiny muted">
                      <Timer size={11} aria-hidden="true" /> {pl.seconds}s
                    </span>
                  </span>
                  {busy === key && <span className="tiny">…</span>}
                </button>
              </li>
            );
          })}
          {walkable && VEHICLES.filter((v) => vehicles.includes(v.kind)).map((v) => {
            const fuel = fuelCost(v.kind, units);
            return (
              <li key={v.kind}>
                <button type="button" className="ride-option own" disabled={busy !== null} onClick={() => void pick("own", v.kind)}>
                  <span className="ride-art" aria-hidden="true">
                    <img src={v.image} alt="" />
                  </span>
                  <span className="ride-text">
                    <strong>Drive your {v.label.toLowerCase()}</strong>
                    <span className="tiny muted">{fuelPriceOn().scarcity ? "⛽ Fuel scarcity today: queues, price up" : "Yours: just fuel"}</span>
                  </span>
                  <span className="ride-meta">
                    <span className="ride-fare">
                      <Coins size={13} aria-hidden="true" /> {formatCoins(fuel)}
                    </span>
                    <span className="tiny muted">
                      <Timer size={11} aria-hidden="true" /> {Math.max(3, Math.round(units / v.speed))}s
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {walkable && RIDE_MODES.map((m) => {
            const fare = rideFare(m.mode, units, hour, rain.fare);
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
                      <Timer size={11} aria-hidden="true" /> {rideSeconds(m.mode, units, hour, rain.slow)}s
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
