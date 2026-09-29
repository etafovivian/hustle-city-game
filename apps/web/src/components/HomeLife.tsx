// Life at home (see @hc/shared HOME_ACTIONS): what you can do depends on your house. A kitchen has a cooker, the
// villa cinema a big screen, a parlour a TV; a thing you buy adds what a room lacks. Tapping an action takes you to
// the room that has the thing, walks you to it and plays the pose; a TV or the cinema screen plays a moving picture
// while you watch, a rider brings the food you ordered, a call lets you pick who.
import { HOME_ACTIONS, HOME_ITEMS, HOME_OBJECTS, ITEM_OBJECT, NEED_ICON, NEED_LABEL, type ContactView, type HomeAction, type HomeObject, type NeedKey, type NeedsView, type ObjectSpot } from "@hc/shared";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, formatCoins } from "../api.js";
import type { InteriorPlayer } from "./Interior.js";
import type { PlayerAction, Pt, Worker } from "./rooms.js";

type HomeRoom = { key: string; label: string; art: string };

/** Where furniture stands in a room until you arrange it (front of the floor, fractions of the image). */
export const ITEM_SPOTS: [number, number][] = [
  [0.24, 0.8],
  [0.76, 0.8],
  [0.38, 0.9],
  [0.62, 0.9],
  [0.14, 0.68],
  [0.86, 0.68],
  [0.5, 0.95],
  [0.3, 0.7],
];
/** Where a thing you own stands: where you put it, else its default room and spot (as the home card draws it). */
function itemAt(items: string[], key: string, rooms: HomeRoom[], placed: Record<string, { room: string; x: number; y: number }>) {
  if (placed[key]) return placed[key]!;
  const i = items.indexOf(key);
  const [x, y] = ITEM_SPOTS[i % ITEM_SPOTS.length]!;
  return { room: rooms[i % rooms.length]!.key, x, y };
}
type Quad = NonNullable<ObjectSpot["screen"]>;

/** A moving picture on a screen (the four corners of the screen in the room picture). */
export function ScreenShow({ quad, kind }: { quad: Quad; kind: "tv" | "film" | "game" }) {
  const [tl, tr, , bl] = quad;
  // The screen as a slanted rectangle: draw in 0..1 and map with one matrix.
  const m = `matrix(${tr[0] - tl[0]} ${tr[1] - tl[1]} ${bl[0] - tl[0]} ${bl[1] - tl[1]} ${tl[0]} ${tl[1]})`;
  return (
    <svg className={`screen-show ${kind}`} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={`clip-${kind}`} clipPathUnits="userSpaceOnUse">
          <polygon points={quad.map((p) => p.join(",")).join(" ")} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${kind})`}>
        <g transform={m}>
          {kind === "game" ? (
            <>
              <rect width="1" height="1" fill="#101935" />
              <rect y="0.78" width="1" height="0.22" fill="#2f7d3a" />
              <g className="ss-runner">
                <rect x="0.12" y="0.56" width="0.08" height="0.22" fill="#ffc72c" />
                <rect x="0.13" y="0.5" width="0.06" height="0.07" fill="#f4c7a1" />
              </g>
              <g className="ss-scroll">
                {[0.2, 0.55, 0.9, 1.25, 1.6].map((x) => (
                  <rect key={x} x={x} y="0.66" width="0.07" height="0.12" fill="#df382b" />
                ))}
                {[0.35, 0.8, 1.15, 1.5].map((x) => (
                  <circle key={x} cx={x} cy="0.3" r="0.04" fill="#ffd34d" />
                ))}
              </g>
              <text x="0.05" y="0.14" fontSize="0.1" fill="#fff" fontWeight="800">
                SCORE
              </text>
            </>
          ) : (
            <>
              <rect width="1" height="1" fill={kind === "film" ? "#1a1022" : "#0d2a52"} />
              <g className="ss-scene">
                <circle cx="0.3" cy="0.45" r="0.32" fill={kind === "film" ? "#c94f2b" : "#2f6fd1"} opacity=".8" />
                <circle cx="0.75" cy="0.55" r="0.28" fill={kind === "film" ? "#f2b84b" : "#1e9e6a"} opacity=".75" />
                <circle cx="0.5" cy="0.2" r="0.18" fill="#f4f1e8" opacity=".35" />
              </g>
              <g className="ss-figure">
                <rect x="0.42" y="0.42" width="0.14" height="0.42" rx="0.05" fill="#0a0f24" opacity=".75" />
                <circle cx="0.49" cy="0.36" r="0.07" fill="#0a0f24" opacity=".75" />
              </g>
              {kind === "tv" && (
                <>
                  <rect y="0.82" width="1" height="0.18" fill="#b8323a" />
                  <text className="ss-ticker" y="0.95" fontSize="0.12" fill="#fff" fontWeight="800">
                    BREAKING: Junction 101 traffic clears at last · Lagos weather: hot · Match night on Saturday ·
                  </text>
                </>
              )}
            </>
          )}
          <rect className="ss-flicker" width="1" height="1" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}

/** Who to call: your contacts, or family. */
function CallPicker({ onPick, onClose }: { onPick: (to: string) => void; onClose: () => void }) {
  const [contacts, setContacts] = useState<ContactView[] | null>(null);
  useEffect(() => {
    api<ContactView[]>("GET", "/api/contacts")
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);
  return (
    <div className="call-picker" role="dialog" aria-label="Who do you want to call?">
      <strong className="small">📞 Who do you want to call?</strong>
      <button type="button" className="btn sm" onClick={() => onPick("family")}>
        👨‍👩‍👧 Family back home
      </button>
      {contacts?.map((c) => (
        <button key={c.nickname} type="button" className="btn sm" onClick={() => onPick(c.nickname)}>
          {c.online ? "🟢" : "⚪"} @{c.nickname}
        </button>
      ))}
      {contacts?.length === 0 && <span className="tiny muted">No contacts yet. Meet people in the city and add them.</span>}
      <button type="button" className="btn sm quiet" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}

/** Where to stand to use an object in a room: the room's own thing, or a thing you bought that stands there. */
function spotIn(room: HomeRoom, uses: readonly HomeObject[], items: string[], placed: Record<string, { room: string; x: number; y: number }>, rooms: HomeRoom[]) {
  const own = HOME_OBJECTS[room.art] ?? {};
  for (const o of uses) {
    const s = own[o];
    if (s) return { obj: o, spot: s, bought: false };
    // A thing you bought is used in the room where it stands.
    const item = items.find((k) => ITEM_OBJECT[k] === o && itemAt(items, k, rooms, placed).room === room.key);
    if (item) {
      const p = itemAt(items, item, rooms, placed);
      // In front of it, facing it (a TV faces the room, so you stand before it with your back to us).
      const facing = o === "tv" || o === "radio";
      const at: [number, number] = facing ? [Math.min(0.9, p.x + 0.08), Math.min(0.92, p.y + 0.08)] : [p.x, Math.min(0.92, p.y + 0.06)];
      return { obj: o, spot: { at, dir: facing ? ("nw" as const) : ("se" as const), screen: undefined }, bought: true };
    }
  }
  return null;
}

const POSE: Record<HomeAction["pose"], PlayerAction> = {
  sit: "sit",
  eat: "eat",
  dance: "dance",
  stand: "stand",
  pray: "pray",
  chair: "chair",
  // their own poses (Interior POSE_OF): cooking at the hob, a bucket bath, scrubbing in a basin, sweeping, watering,
  // the phone at the ear, a controller in hand, at the wardrobe or mirror, floating in the pool
  cook: "cook",
  bath: "bath",
  laundry: "laundry",
  sweep: "sweep",
  water_plants: "water_plants",
  phone: "phone",
  games: "games",
  swim: "swim",
  dress: "dress",
};

/**
 * Life at home for the home card: the actions this house can do (and where), and what the room scene should show
 * while you do one (your spot, a picture on the screen, a delivery rider).
 */
export function useHomeLife({
  rooms,
  roomKey,
  items,
  placed,
  doneAt = {},
  notify,
  onChanged,
  setAction,
}: {
  rooms: HomeRoom[];
  roomKey: string | null;
  items: string[];
  placed: Record<string, { room: string; x: number; y: number }>;
  /** When each action was last done (from the server). */
  doneAt?: Record<string, string>;
  notify: (m: string) => void;
  onChanged: () => void;
  setAction: (a: PlayerAction) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState<Record<string, number>>({});
  /** When an action can be done again: from this visit, else from the server's record of when it was last done. */
  const readyAt = (a: HomeAction) => again[a.key] ?? (doneAt[a.key] ? Date.parse(doneAt[a.key]!) + a.every * 60_000 : 0);
  const [spot, setSpot] = useState<InteriorPlayer["spot"]>();
  const [show, setShow] = useState<{ room: string; quad: Quad; kind: "tv" | "film" | "game" } | null>(null);
  /** A TV you bought that's switched on (its picture plays on the thing itself). */
  const [onItem, setOnItem] = useState<string | null>(null);
  const [rider, setRider] = useState<{ room: string; at: Pt; seq: number } | null>(null);
  const [goRoom, setGoRoom] = useState<{ key: string; seq: number } | null>(null);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** For each action: the room it's done in (this room if it can be, else the first that can), or none. */
  const where = useMemo(() => {
    const current = rooms.find((r) => r.key === roomKey) ?? rooms[0]!;
    return new Map(
      HOME_ACTIONS.map((a) => {
        if (a.needs && !a.needs.some((k) => items.includes(k))) return [a.key, null] as const;
        // "Eat what you cooked" only after cooking.
        if (a.after) {
          const done = again[a.after.action] ? again[a.after.action]! - (HOME_ACTIONS.find((x) => x.key === a.after!.action)?.every ?? 0) * 60_000 : doneAt[a.after.action] ? Date.parse(doneAt[a.after.action]!) : 0;
          if (Date.now() - done > a.after.within * 60_000) return [a.key, null] as const;
        }
        const pick = [current, ...rooms.filter((r) => r !== current)].find((r) => spotIn(r, a.uses, items, placed, rooms));
        return [a.key, pick ?? null] as const;
      }),
    );
  }, [rooms, roomKey, items, placed, again, doneAt]);
  const available = HOME_ACTIONS.filter((a) => where.get(a.key));
  /** Things you could buy to do more at home. */
  const unlocks = [
    ...new Set(
      HOME_ACTIONS.filter((a) => !where.get(a.key) && !a.after)
        .flatMap((a) => [...(a.needs ?? []), ...Object.keys(ITEM_OBJECT).filter((k) => a.uses.includes(ITEM_OBJECT[k]!))].slice(0, 1))
        .map((k) => HOME_ITEMS.find((i) => i.key === k)?.name.split(" (")[0])
        .filter(Boolean),
    ),
  ];

  const run = async (a: HomeAction, to?: string) => {
    const room = where.get(a.key);
    if (!room) return;
    const at = spotIn(room, a.uses, items, placed, rooms)!;
    setError(null);
    if (room.key !== roomKey) setGoRoom({ key: room.key, seq: Date.now() });
    // Walk to the thing and do it (sweeping goes round the room first).
    const via: Pt[] | undefined = a.key === "clean" ? [[0.3, 0.72], [0.62, 0.66], [0.5, 0.82]] : undefined;
    setSpot({ at: at.spot.at, dir: at.spot.dir, via, seq: Date.now() });
    // Watching a TV you bought: stand in front of it (there's no sofa facing it).
    setAction(a.shows && at.bought ? "stand" : POSE[a.pose]);
    if (a.shows && at.spot.screen) setShow({ room: room.key, quad: at.spot.screen, kind: a.shows });
    else setShow(null);
    // Watching on a TV you bought: switch it on.
    setOnItem(a.shows && !at.spot.screen ? (items.find((k) => ITEM_OBJECT[k] === at.obj) ?? null) : null);
    // The rider comes in with the food and hands it over next to where you eat.
    if (a.key === "order") setRider({ room: room.key, at: [at.spot.at[0] + 0.06, Math.min(0.9, at.spot.at[1] + 0.06)], seq: Date.now() });
    setBusy(true);
    try {
      const r = await api<NeedsView & { again: string; called?: string | null }>("POST", `/api/game/home/act/${a.key}`, { room: room.key, to });
      setAgain((x) => ({ ...x, [a.key]: new Date(r.again).getTime() }));
      const bits = (Object.entries(a.gives) as [NeedKey, number][]).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? "+" : "−"}${NEED_ICON[k]} ${NEED_LABEL[k]}`);
      const who = a.key === "call" ? (r.called ? ` You called @${r.called}; they got a ring.` : " You called home. Everyone's fine.") : "";
      notify(`${a.icon} ${a.label}${a.cost ? ` (−${formatCoins(a.cost)} coins)` : ""}: ${bits.join(" ")}.${who}`);
      onChanged();
      if (a.key === "dress") window.dispatchEvent(new CustomEvent("hc:open-phone", { detail: "wardrobe" }));
    } catch (e) {
      setError((e as Error).message);
      setShow(null);
      setAction("stand");
    } finally {
      setBusy(false);
    }
  };
  const start = (a: HomeAction) => (a.key === "call" ? setCalling(true) : void run(a));
  const waitFor = (a: HomeAction) => Math.max(0, Math.ceil((readyAt(a) - Date.now()) / 60_000));

  /** Props for the room scene now on show. */
  const scene = (room: string): { spot?: InteriorPlayer["spot"]; overlay?: ReactNode; extraWorkers?: Worker[]; onItem?: string | null } => ({
    spot,
    onItem,
    overlay: show && show.room === room ? <ScreenShow quad={show.quad} kind={show.kind} /> : undefined,
    extraWorkers:
      rider && rider.room === room
        ? [
            {
              variant: "man_casual",
              start: 0,
              visitor: { door: [0.5, 0.92], away: 100_000, variants: ["man_casual"] },
              tasks: [{ at: rider.at, pose: "serve", dir: "nw", secs: 3 }],
            },
          ]
        : undefined,
  });

  const panel = (
    <>
      <div className="row home-acts">
        {available.map((a) => {
          const left = waitFor(a);
          const room = where.get(a.key)!;
          const elsewhere = roomKey !== null && room.key !== roomKey && rooms.length > 1;
          return (
            <button key={a.key} type="button" className="btn sm home-act" disabled={busy || left > 0} onClick={() => start(a)} title={a.note}>
              {a.icon} {a.label}
              <span className="tiny muted">{left > 0 ? ` · again in ${left} min` : elsewhere ? ` · in the ${room.label.toLowerCase()}` : ` · ${a.note}`}</span>
            </button>
          );
        })}
      </div>
      {unlocks.length > 0 && <p className="tiny muted">More to do at home with: {unlocks.join(", ")} (in "Things for your house" below).</p>}
      {calling && (
        <CallPicker
          onClose={() => setCalling(false)}
          onPick={(to) => {
            setCalling(false);
            void run(HOME_ACTIONS.find((x) => x.key === "call")!, to);
          }}
        />
      )}
      {error && <p className="alert small">{error}</p>}
    </>
  );
  return { panel, scene, goRoom };
}
