// Your home (the starter room or the house on your plot), the house picker for buying or rebuilding, and the garage.
import {
  GENERATORS,
  HOME_ITEMS,
  HOME_ROOMS,
  HOUSE_BY_KEY,
  HOUSE_DESIGNS,
  REBUILD_CREDIT,
  REST,
  VEHICLES,
  plotPriceOf,
  type AvatarConfig,
  type HomeView,
  type NeedsView,
  type VehicleKind,
} from "@hc/shared";
import { BedDouble, Car, Check, Coins, Hammer, Home as HomeIcon, Sofa, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, formatCoins } from "../api.js";
import { InteriorScene, ROOMS, type PlayerAction, type Room } from "./Interior.js";
import type { PoseAction } from "./rooms.js";
import { variantFor } from "./AvatarWalker.js";
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
  avatar,
  guests = [],
  area,
  hasLight = true,
}: {
  /** Your home's area (power cuts) and whether it has light right now. */
  area?: string;
  hasLight?: boolean;
  guests?: { avatar: AvatarConfig; nickname: string }[];
  avatar?: AvatarConfig;
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
  const [me, setMe] = useState<PlayerAction>("walk");
  const [error, setError] = useState<string | null>(null);
  const restLeft = home.restAgainAt ? Math.max(0, new Date(home.restAgainAt).getTime() - Date.now()) : 0;

  const rest = async () => {
    setBusy(true);
    setError(null);
    try {
      setMe("sleep");
      const r = await api<NeedsView & { gained: number; light: boolean; generator: boolean }>("POST", "/api/game/home/rest", { area });
      notify(
        !r.light && !r.generator
          ? `NEPA took light: hot night, only +${r.gained} energy. A generator would help.`
          : !r.light
            ? `NEPA took light, but your generator dey hum. +${r.gained} energy`
            : `Good night! +${r.gained} energy`,
      );
      onChanged();
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
      const r = await api<{ paid: number }>("POST", `/api/plots/${encodeURIComponent(home.plotId!)}/build`, { design });
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
        <HomeRooms design={home.design} who="your" items={home.items} avatar={avatar} action={me} onAction={setMe} guests={guests} />
        <div className="row home-acts">
          <button type="button" className="btn sm" onClick={() => setMe("sit")}>
            🛋️ Sit down
          </button>
          <button type="button" className="btn sm" onClick={() => setMe("eat")}>
            🍲 Eat
          </button>
          <button type="button" className="btn sm" onClick={() => setMe("dance")}>
            💃 Dance
          </button>
          <span className="tiny muted">Tap the floor to walk around.</span>
        </div>
        <p className={`small power-line ${hasLight ? "on" : "off"}`}>
          {hasLight
            ? "💡 There's light."
            : home.items.some((k) => GENERATORS.includes(k))
              ? "🕯️ NEPA took light. Your generator is running."
              : "🕯️ NEPA took light. Sleeping now gives half the energy (a generator fixes that)."}
        </p>
        <p className="small">
          {home.plotId
            ? "Your own house on your own land. Rest here, and rebuild it bigger as your hustle grows."
            : "A rented room in a face-me-I-face-you: shared toilet, generator noise, good neighbours. Buy land to build your own house."}
        </p>
        <div className="row">
          <button type="button" className="btn go" disabled={busy || restLeft > 0} onClick={() => void rest()}>
            <BedDouble size={16} aria-hidden="true" /> {restLeft > 0 ? `Rest again in ${Math.ceil(restLeft / 60_000)} min` : `Sleep (+${home.restEnergy} energy)`}
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
        <HomeShop home={home} notify={notify} onChanged={onChanged} />
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
/** Where furniture stands in a room (front of the floor, fractions of the image). */
const ITEM_SPOTS: [number, number][] = [
  [0.24, 0.8],
  [0.76, 0.8],
  [0.38, 0.9],
  [0.62, 0.9],
  [0.14, 0.68],
  [0.86, 0.68],
  [0.5, 0.95],
  [0.3, 0.7],
];

/**
 * A private home: no strangers. A house help works in the kitchen, and guests (players visiting now) sit in the
 * living rooms or at the kitchen table, each in their own seat. Bedrooms are just for the household.
 */
function privateRoom(room: Room | undefined, kind: string, guests: { avatar: AvatarConfig }[]): Room | undefined {
  if (!room) return room;
  const kitchen = /kitchen/.test(kind);
  const social = /parlour|living|lounge|cinema|room|pool|yard/.test(kind);
  const seats = [
    ...(room.spots?.sit ? [room.spots.sit] : []),
    ...(room.spots?.eat ? [room.spots.eat] : []),
    ...room.stations.filter((s) => s.action === "sit_talk" || s.action === "sit_eat").map((s) => ({ at: s.at, dir: s.dir })),
  ];
  const help = kitchen ? room.stations.filter((s) => s.action === "serve").slice(0, 1) : [];
  const guestSeats = kitchen || social ? guests.slice(0, seats.length) : [];
  return {
    ...room,
    walkers: 0,
    stations: [
      ...help,
      ...guestSeats.map((g, i) => ({ action: (kitchen ? "sit_eat" : "sit_talk") as PoseAction, at: seats[i]!.at, dir: seats[i]!.dir, variant: variantFor(g.avatar) })),
    ],
  };
}

export function HomeRooms({
  design,
  who,
  items = [],
  avatar,
  action = "walk",
  onAction,
  guests = [],
}: {
  /** Players visiting this home right now. */
  guests?: { avatar: AvatarConfig; nickname: string }[];
  design: string | null;
  who: string;
  items?: string[];
  /** You in the room (you walk around, sit, eat, sleep). */
  avatar?: AvatarConfig;
  action?: PlayerAction;
  onAction?: (a: PlayerAction) => void;
}) {
  const rooms = HOME_ROOMS[design ?? "starter"] ?? HOME_ROOMS.starter!;
  const [at, setAt] = useState(0);
  // Going to sleep takes you to the bedroom, eating to the kitchen (when the house has them).
  useEffect(() => {
    const want = action === "sleep" ? /bed|suite|room/ : action === "eat" ? /kitchen/ : action === "sit" ? /parlour|living|lounge|cinema/ : null;
    if (!want) return;
    const i = rooms.findIndex((r) => want.test(r.key));
    if (i >= 0) setAt(i);
  }, [action]);
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
      {guests.length > 0 && <p className="tiny muted">With you: {guests.map((g) => `@${g.nickname}`).join(", ")}</p>}
      <div className="home-room-frame">
        <InteriorScene
          key={room.key}
          src={`/art/interiors/${room.art}.webp`}
          alt={`Inside ${who} ${room.label.toLowerCase()}`}
          room={privateRoom(ROOMS[room.art], room.key, guests)}
          seed={3 + at}
          player={avatar ? { avatar, action } : undefined}
          onPlayerWalk={() => onAction?.("walk")}
        />
        {/* Your things: spread through the rooms, a few per room */}
        {items
          .filter((_, i) => i % rooms.length === at)
          .map((k, i) => {
            const item = HOME_ITEMS.find((x) => x.key === k);
            const [x, y] = ITEM_SPOTS[i % ITEM_SPOTS.length]!;
            return item ? <img key={k} className="home-item" src={item.art} alt={item.name} title={item.name} style={{ left: `${x * 100}%`, top: `${y * 100}%` }} /> : null;
          })}
      </div>
    </div>
  );
}

/** Things for the house: buy each once; they appear in your rooms and make sleeping at home better. */
function HomeShop({ home, notify, onChanged }: { home: HomeView; notify: (m: string) => void; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const buy = async (key: string) => {
    setBusy(key);
    try {
      await api("POST", "/api/game/home/items", { key });
      notify("Delivered! It's in your house now.");
      onChanged();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="home-shop">
      <button type="button" className="btn sm" onClick={() => setOpen((x) => !x)}>
        <Sofa size={15} aria-hidden="true" /> Things for your house ({home.items.length}/{HOME_ITEMS.length})
      </button>
      {open && (
        <ul className="garage">
          {HOME_ITEMS.map((it) => {
            const owned = home.items.includes(it.key);
            return (
              <li key={it.key} className="quote-card garage-item">
                <img src={it.art} alt="" />
                <span className="stack" style={{ gap: 2 }}>
                  <strong>{it.name}</strong>
                  <span className="tiny muted">+{it.comfort} energy every sleep</span>
                </span>
                {owned ? (
                  <span className="notice small">
                    <Check size={14} aria-hidden="true" /> Yours
                  </span>
                ) : (
                  <button type="button" className="btn sm go" disabled={busy !== null} onClick={() => void buy(it.key)}>
                    {busy === it.key ? "…" : `${formatCoins(it.price)} coins`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** One of your plots: build or rebuild a house, make it home, or go inside. */
export function PlotCard({
  plot,
  area,
  onClose,
  onChanged,
  notify,
}: {
  plot: { plotId: string; design: string | null; isHome: boolean };
  area: string;
  onClose: () => void;
  onChanged: () => void;
  notify: (m: string) => void;
}) {
  const sheet = useSheet(onClose);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(!plot.design);
  const build = async (design: string) => {
    setBusy(true);
    try {
      const r = await api<{ paid: number }>("POST", `/api/plots/${encodeURIComponent(plot.plotId)}/build`, { design });
      notify(`${HOUSE_BY_KEY.get(design)!.label} built (${formatCoins(r.paid)} coins)`);
      onChanged();
      onClose();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const makeHome = async () => {
    setBusy(true);
    try {
      await api("POST", `/api/plots/${encodeURIComponent(plot.plotId)}/home`);
      notify("This is home now");
      onChanged();
      onClose();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet home-card" role="dialog" aria-modal="true" aria-label="Your plot" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <img className="biz-art" src={plot.design ? houseArt(plot.design) : "/art/props/for-sale-sign.webp"} alt="" />
          <div>
            <h2>{plot.design ? `Your ${HOUSE_BY_KEY.get(plot.design)?.label.toLowerCase()}` : "Your land"}</h2>
            <span className="small muted">
              {area}
              {plot.isHome ? " · your home" : ""}
            </span>
          </div>
        </div>
        {plot.design && <HomeRooms design={plot.design} who="your" />}
        <div className="row">
          {plot.design && !plot.isHome && (
            <button type="button" className="btn go" disabled={busy} onClick={() => void makeHome()}>
              <HomeIcon size={16} aria-hidden="true" /> Make this my home
            </button>
          )}
          {plot.design && (
            <button type="button" className="btn" onClick={() => setPicking((x) => !x)}>
              <Hammer size={16} aria-hidden="true" /> Change house
            </button>
          )}
        </div>
        {picking && (
          <>
            <p className="tiny muted">{plot.design ? "Rebuilding gives you back half of what this house cost." : "Pick a house to build on your land."}</p>
            <HousePicker current={plot.design} onPick={(k) => void build(k)} busy={busy} />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
