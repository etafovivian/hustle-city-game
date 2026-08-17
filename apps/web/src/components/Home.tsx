// Your home (the starter room or the house on your plot), the house picker for buying or rebuilding, and the garage.
import {
  HOME_ROOMS,
  HOUSE_BY_KEY,
  HOUSE_DESIGNS,
  REBUILD_CREDIT,
  REST,
  VEHICLES,
  plotPriceOf,
  type HomeView,
  type NeedsView,
  type VehicleKind,
} from "@hc/shared";
import { BedDouble, Car, Check, Coins, Hammer, Home as HomeIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, formatCoins } from "../api.js";
import { InteriorScene, ROOMS } from "./Interior.js";
import { RoomChat } from "./Chat.js";

function useSheet(onClose: () => void) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return sheet;
}

const houseArt = (key: string) => `/art/buildings/${HOUSE_BY_KEY.get(key)?.art ?? "bungalow"}.webp`;

/** Pick a house: for a plot you're buying (with the land price added) or to rebuild on your own plot. */
export function HousePicker({ plotId, current, onPick, busy }: { plotId?: string; current?: string | null; onPick: (key: string) => void; busy: boolean }) {
  const land = plotId ? (plotPriceOf(plotId) ?? 0) : 0;
  const credit = current ? Math.round((HOUSE_BY_KEY.get(current)?.price ?? 0) * REBUILD_CREDIT) : 0;
  return (
    <ul className="house-grid">
      {HOUSE_DESIGNS.map((h) => {
        const cost = plotId ? land + h.price : Math.max(0, h.price - credit);
        const isCurrent = current === h.key;
        return (
          <li key={h.key}>
            <button type="button" className={`house-option ${isCurrent ? "current" : ""}`} disabled={busy || isCurrent} onClick={() => onPick(h.key)}>
              <img src={`/art/buildings/${h.art}.webp`} alt="" />
              <strong>{h.label}</strong>
              <span className="tiny muted">{h.note}</span>
              <span className="land-price">
                {isCurrent ? (
                  <>
                    <Check size={13} aria-hidden="true" /> Your house
                  </>
                ) : (
                  <>
                    <Coins size={13} aria-hidden="true" /> {formatCoins(cost)}
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Your home: rest here, and (on your own plot) rebuild; in the starter room, a nudge to buy land. */
export function HomeCard({
  home,
  label,
  onClose,
  onChanged,
  notify,
  onBuyLand,
  chatPlace,
}: {
  /** The presence/chat key for your home ("home:<plot>" or your room). */
  chatPlace?: string;
  home: HomeView;
  /** "Room 4, face-me block" or the house name. */
  label: string;
  onClose: () => void;
  onChanged: () => void;
  notify: (m: string) => void;
  onBuyLand: () => void;
}) {
  const sheet = useSheet(onClose);
  const [busy, setBusy] = useState(false);
  const [rebuild, setRebuild] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restLeft = home.restAgainAt ? Math.max(0, new Date(home.restAgainAt).getTime() - Date.now()) : 0;

  const rest = async () => {
    setBusy(true);
    setError(null);
    try {
      await api<NeedsView>("POST", "/api/game/home/rest");
      notify(`You rested. +${REST.energy} energy`);
      onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const build = async (design: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ paid: number }>("POST", "/api/game/home/design", { design });
      notify(`Rebuilt as a ${HOUSE_BY_KEY.get(design)!.label.toLowerCase()} (${formatCoins(r.paid)} coins)`);
      onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet home-card" role="dialog" aria-modal="true" aria-label="Your home" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <img className="biz-art" src={home.design ? houseArt(home.design) : "/art/buildings/face-me-block.webp"} alt="" />
          <div>
            <h2>Your home</h2>
            <span className="small muted">{label}</span>
          </div>
        </div>
        <HomeRooms design={home.design} who="your" />
        <p className="small">
          {home.plotId
            ? "Your own house on your own land. Rest here, and rebuild it bigger as your hustle grows."
            : "A rented room in a face-me-I-face-you: shared toilet, generator noise, good neighbours. Buy land to build your own house."}
        </p>
        <div className="row">
          <button type="button" className="btn go" disabled={busy || restLeft > 0} onClick={() => void rest()}>
            <BedDouble size={16} aria-hidden="true" /> {restLeft > 0 ? `Rest again in ${Math.ceil(restLeft / 60_000)} min` : `Rest (+${REST.energy} energy)`}
          </button>
          {home.plotId ? (
            <button type="button" className="btn" onClick={() => setRebuild((x) => !x)}>
              <Hammer size={16} aria-hidden="true" /> Change house
            </button>
          ) : (
            <button type="button" className="btn" onClick={onBuyLand}>
              <HomeIcon size={16} aria-hidden="true" /> Buy land
            </button>
          )}
        </div>
        {rebuild && home.plotId && (
          <>
            <p className="tiny muted">Rebuilding gives you back half of what your current house cost.</p>
            <HousePicker current={home.design} onPick={(k) => void build(k)} busy={busy} />
          </>
        )}
        {error && <p className="alert small">{error}</p>}
        {chatPlace && <RoomChat place={chatPlace} />}
      </div>
    </div>,
    document.body,
  );
}

/** Phone → Garage: buy a bike, keke or car and drive yourself. */
export function Garage({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const [owned, setOwned] = useState<VehicleKind[] | null>(null);
  const [busy, setBusy] = useState<VehicleKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    api<VehicleKind[]>("GET", "/api/game/vehicles")
      .then(setOwned)
      .catch(() => setOwned([]));
  useEffect(() => {
    void load();
  }, []);
  const buy = async (kind: VehicleKind) => {
    setBusy(kind);
    setError(null);
    try {
      await api("POST", "/api/game/vehicles", { kind });
      notify("It's yours! Pick it when you go somewhere.");
      onChanged();
      void load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>
          <Car size={20} aria-hidden="true" /> Garage
        </h2>
        <p className="small muted">Drive yourself: no fare, just a little fuel. Faster than a danfo, and the area boys mostly leave a car alone.</p>
      </div>
      <ul className="garage">
        {VEHICLES.map((v) => {
          const mine = owned?.includes(v.kind);
          return (
            <li key={v.kind} className="quote-card garage-item">
              <img src={v.image} alt="" />
              <span className="stack" style={{ gap: 2 }}>
                <strong>{v.label}</strong>
                <span className="tiny muted">
                  {v.note} · fuel {v.fuelPerKm} coins/km
                </span>
              </span>
              {mine ? (
                <span className="notice small">
                  <Check size={14} aria-hidden="true" /> Yours
                </span>
              ) : (
                <button type="button" className="btn sm go" disabled={busy !== null} onClick={() => void buy(v.kind)}>
                  {busy === v.kind ? "…" : `${formatCoins(v.price)} coins`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="alert small">{error}</p>}
    </div>
  );
}

/** The rooms of a home with tabs to move between them (bigger houses have more rooms). */
export function HomeRooms({ design, who }: { design: string | null; who: string }) {
  const rooms = HOME_ROOMS[design ?? "starter"] ?? HOME_ROOMS.starter!;
  const [at, setAt] = useState(0);
  const room = rooms[Math.min(at, rooms.length - 1)]!;
  return (
    <div className="home-rooms">
      {rooms.length > 1 && (
        <div className="row" role="tablist" aria-label="Rooms">
          {rooms.map((r, i) => (
            <button key={r.key} type="button" role="tab" className="chip" aria-selected={i === at} aria-pressed={i === at} onClick={() => setAt(i)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      <InteriorScene key={room.key} src={`/art/interiors/${room.art}.webp`} alt={`Inside ${who} ${room.label.toLowerCase()}`} room={ROOMS[room.art]} seed={3 + at} />
    </div>
  );
}
