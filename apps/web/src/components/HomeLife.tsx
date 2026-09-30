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

/** What can be on: TV channels, cinema films, video games. A different one each time you switch on. */
export type Programme = "football" | "news" | "music" | "nollywood" | "cartoon" | "chase" | "sunset" | "runner" | "racing";
const PROGRAMMES: Record<"tv" | "film" | "game", Programme[]> = {
  tv: ["football", "news", "music", "nollywood", "cartoon"],
  film: ["chase", "sunset", "nollywood", "music"],
  game: ["runner", "racing", "football"],
};
export const pickProgramme = (kind: "tv" | "film" | "game") => PROGRAMMES[kind][Math.floor(Math.random() * PROGRAMMES[kind].length)]!;

/** One programme, drawn in a 1×1 box (the screen maps it onto itself). */
function ProgrammeArt({ p }: { p: Programme }) {
  switch (p) {
    case "football":
      return (
        <>
          <rect width="1" height="1" fill="#2f8a3a" />
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((x) => (
            <rect key={x} x={x - 0.1} width="0.1" height="1" fill="#2a7d33" />
          ))}
          <rect x="0.04" y="0.06" width="0.92" height="0.88" fill="none" stroke="#f4f1e8" strokeWidth="0.015" />
          <line x1="0.5" y1="0.06" x2="0.5" y2="0.94" stroke="#f4f1e8" strokeWidth="0.012" />
          <circle cx="0.5" cy="0.5" r="0.12" fill="none" stroke="#f4f1e8" strokeWidth="0.012" />
          <g className="pg-teamA">{[[0.3, 0.3], [0.35, 0.65], [0.2, 0.5]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="0.035" fill="#c8321e" />)}</g>
          <g className="pg-teamB">{[[0.7, 0.35], [0.62, 0.6], [0.8, 0.5]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="0.035" fill="#f4f1e8" />)}</g>
          <circle className="pg-ball" cx="0.45" cy="0.48" r="0.018" fill="#fff" stroke="#000" strokeWidth="0.004" />
          <rect x="0.03" y="0.03" width="0.3" height="0.1" rx="0.02" fill="#0a0f24" opacity=".8" />
          <text x="0.05" y="0.105" fontSize="0.07" fill="#fff" fontWeight="800">LAG 1 – 0 ABJ</text>
        </>
      );
    case "news":
      return (
        <>
          <rect width="1" height="1" fill="#1f3a6b" />
          <rect x="0.55" y="0.12" width="0.38" height="0.4" fill="#2f6fd1" />
          <g className="pg-map">
            <path d="M0.6 0.4 L0.7 0.2 L0.82 0.28 L0.88 0.44 Z" fill="#7cc4f0" />
          </g>
          <g className="pg-anchor">
            <rect x="0.16" y="0.42" width="0.22" height="0.4" rx="0.05" fill="#7a1f3d" />
            <circle cx="0.27" cy="0.34" r="0.09" fill="#6b4226" />
          </g>
          <rect x="0.08" y="0.7" width="0.5" height="0.12" fill="#0a0f24" />
          <rect y="0.82" width="1" height="0.18" fill="#b8323a" />
          <text className="ss-ticker" y="0.95" fontSize="0.12" fill="#fff" fontWeight="800">
            BREAKING: Junction 101 traffic clears at last · Hot day in Lagos · Match night on Saturday ·
          </text>
        </>
      );
    case "music":
      return (
        <>
          <rect width="1" height="1" fill="#2a0f3d" />
          <g className="pg-lights">
            <path d="M0.2 0 L0.05 1 L0.35 1 Z" fill="#ff4fd8" opacity=".35" />
            <path d="M0.8 0 L0.65 1 L0.95 1 Z" fill="#4fd8ff" opacity=".35" />
          </g>
          {[0.3, 0.5, 0.7].map((x, i) => (
            <g key={x} className={`pg-dancer d${i}`}>
              <rect x={x - 0.04} y="0.45" width="0.08" height="0.3" rx="0.03" fill="#0a0f24" />
              <circle cx={x} cy="0.39" r="0.05" fill="#0a0f24" />
            </g>
          ))}
          <rect y="0.82" width="1" height="0.18" fill="#0a0f24" />
          {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((x, i) => (
            <rect key={x} className={`pg-eq e${i % 3}`} x={x} y="0.84" width="0.08" height="0.14" fill="#ffc72c" />
          ))}
        </>
      );
    case "nollywood":
      return (
        <>
          <rect width="1" height="1" fill="#5a3825" />
          <rect x="0.05" y="0.1" width="0.3" height="0.4" fill="#f2b84b" opacity=".5" />
          <g className="pg-left">
            <rect x="0.2" y="0.4" width="0.18" height="0.6" rx="0.06" fill="#1e7a46" />
            <circle cx="0.29" cy="0.32" r="0.09" fill="#3b2219" />
            <path d="M0.2 0.24 Q0.29 0.12 0.38 0.24 Z" fill="#c8321e" />
          </g>
          <g className="pg-right">
            <rect x="0.6" y="0.38" width="0.2" height="0.62" rx="0.06" fill="#f4f1e8" />
            <circle cx="0.7" cy="0.3" r="0.09" fill="#5a3825" />
          </g>
          <rect className="pg-sub" x="0.1" y="0.86" width="0.8" height="0.09" rx="0.02" fill="#0a0f24" opacity=".75" />
          <text x="0.14" y="0.925" fontSize="0.06" fill="#fff">"You think I don't know?"</text>
        </>
      );
    case "cartoon":
      return (
        <>
          <rect width="1" height="1" fill="#7cc4f0" />
          <rect y="0.72" width="1" height="0.28" fill="#6fbf4f" />
          <circle cx="0.85" cy="0.18" r="0.09" fill="#ffd34d" />
          <g className="pg-bounce">
            <ellipse cx="0.35" cy="0.58" rx="0.12" ry="0.14" fill="#ff8a3d" />
            <circle cx="0.31" cy="0.54" r="0.025" fill="#fff" />
            <circle cx="0.39" cy="0.54" r="0.025" fill="#fff" />
            <circle cx="0.31" cy="0.54" r="0.012" fill="#000" />
            <circle cx="0.39" cy="0.54" r="0.012" fill="#000" />
          </g>
          <g className="pg-bounce2">
            <rect x="0.6" y="0.5" width="0.16" height="0.2" rx="0.06" fill="#7a4fd6" />
          </g>
        </>
      );
    case "chase":
      return (
        <>
          <rect width="1" height="1" fill="#1a1022" />
          <rect y="0.6" width="1" height="0.4" fill="#2b2f3a" />
          <g className="pg-city">{[0.05, 0.25, 0.45, 0.65, 0.85, 1.05, 1.25].map((x, i) => <rect key={x} x={x} y={0.25 + (i % 3) * 0.08} width="0.15" height={0.4 - (i % 3) * 0.08} fill="#3b2f55" />)}</g>
          <g className="pg-lanes">{[0, 0.3, 0.6, 0.9, 1.2].map((x) => <rect key={x} x={x} y="0.78" width="0.15" height="0.02" fill="#ffc72c" />)}</g>
          <g className="pg-car"><rect x="0.3" y="0.62" width="0.22" height="0.08" rx="0.03" fill="#c8321e" /><rect x="0.6" y="0.64" width="0.2" height="0.07" rx="0.03" fill="#0a0f24" /></g>
        </>
      );
    case "sunset":
      return (
        <>
          <rect width="1" height="1" fill="#f2884b" />
          <rect y="0.5" width="1" height="0.5" fill="#3b2f55" />
          <circle className="pg-sun" cx="0.5" cy="0.5" r="0.16" fill="#ffd34d" />
          <rect y="0.55" width="1" height="0.45" fill="#2f5fb3" opacity=".7" />
          <g className="pg-couple"><rect x="0.42" y="0.48" width="0.06" height="0.18" fill="#0a0f24" /><rect x="0.52" y="0.47" width="0.06" height="0.19" fill="#0a0f24" /></g>
        </>
      );
    case "racing":
      return (
        <>
          <rect width="1" height="1" fill="#6fbf4f" />
          <path d="M0.3 0 L0.7 0 L0.9 1 L0.1 1 Z" fill="#3b3f46" />
          <g className="pg-stripes">{[0, 0.25, 0.5, 0.75, 1].map((y) => <rect key={y} x="0.48" y={y} width="0.04" height="0.12" fill="#f4f1e8" />)}</g>
          <rect className="pg-player" x="0.44" y="0.72" width="0.12" height="0.18" rx="0.03" fill="#c8321e" />
          <rect className="pg-rival" x="0.36" y="0.2" width="0.1" height="0.14" rx="0.03" fill="#1f6fd1" />
          <text x="0.04" y="0.1" fontSize="0.08" fill="#fff" fontWeight="800">LAP 2/3</text>
        </>
      );
    default:
      return (
        <>
          <rect width="1" height="1" fill="#101935" />
          <rect y="0.78" width="1" height="0.22" fill="#2f7d3a" />
          <g className="ss-runner">
            <rect x="0.12" y="0.56" width="0.08" height="0.22" fill="#ffc72c" />
            <rect x="0.13" y="0.5" width="0.06" height="0.07" fill="#f4c7a1" />
          </g>
          <g className="ss-scroll">
            {[0.2, 0.55, 0.9, 1.25, 1.6].map((x) => <rect key={x} x={x} y="0.66" width="0.07" height="0.12" fill="#df382b" />)}
            {[0.35, 0.8, 1.15, 1.5].map((x) => <circle key={x} cx={x} cy="0.3" r="0.04" fill="#ffd34d" />)}
          </g>
          <text x="0.05" y="0.14" fontSize="0.1" fill="#fff" fontWeight="800">SCORE</text>
        </>
      );
  }
}

/** A programme playing on a screen (the four corners of the screen in the room picture). */
export function ScreenShow({ quad, programme }: { quad: Quad; programme: Programme }) {
  const [tl, tr, , bl] = quad;
  // The screen as a slanted rectangle: draw in 0..1 and map with one matrix.
  const m = `matrix(${tr[0] - tl[0]} ${tr[1] - tl[1]} ${bl[0] - tl[0]} ${bl[1] - tl[1]} ${tl[0]} ${tl[1]})`;
  return (
    <svg className="screen-show" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id="screen-clip" clipPathUnits="userSpaceOnUse">
          <polygon points={quad.map((p) => p.join(",")).join(" ")} />
        </clipPath>
      </defs>
      <g clipPath="url(#screen-clip)">
        <g transform={m}>
          <ProgrammeArt p={programme} />
          <rect className="ss-flicker" width="1" height="1" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}

/** Water: drops from a shower or a bucket over your head, or ripples round you in the pool (fractions of the room). */
export function WaterFx({ at, kind }: { at: Pt; kind: "shower" | "splash" | "ripples" }) {
  const [x, y] = at;
  return (
    <svg className={`water-fx ${kind}`} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {kind === "ripples" ? (
        <g>
          {[0, 1, 2].map((i) => (
            <ellipse key={i} className={`wf-ripple r${i}`} cx={x} cy={y} rx="0.05" ry="0.02" fill="none" stroke="#e8fbff" strokeWidth="0.004" />
          ))}
        </g>
      ) : (
        <g>
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} className={`wf-drop d${i % 3}`} x1={x - 0.03 + (i % 5) * 0.015} y1={y - 0.24} x2={x - 0.03 + (i % 5) * 0.015} y2={y - 0.21} stroke="#bfe9ff" strokeWidth="0.005" strokeLinecap="round" />
          ))}
        </g>
      )}
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
  const [show, setShow] = useState<{ room: string; quad: Quad; programme: Programme } | null>(null);
  /** Water while you bathe or swim. */
  const [fx, setFx] = useState<{ room: string; at: Pt; kind: "shower" | "splash" | "ripples" } | null>(null);
  /** Cooking: the house cook steps aside while you're at the hob. */
  const [cooking, setCooking] = useState<string | null>(null);
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
    // Walk to the thing and do it (sweeping goes round the room first; swimming does laps in the water).
    const pool = HOME_OBJECTS[room.art]?.pool;
    const via: Pt[] | undefined =
      a.key === "clean" ? [[0.3, 0.72], [0.62, 0.66], [0.5, 0.82]] : a.key === "swim" && pool ? [[0.42, 0.74], [0.6, 0.82], [0.44, 0.86], [0.58, 0.76]] : undefined;
    const water = a.key === "swim" && pool ? { box: [0.3, 0.68, 0.7, 0.92] as [number, number, number, number], wade: 0.55 } : undefined;
    setSpot({ at: at.spot.at, dir: at.spot.dir, via, seq: Date.now(), water });
    setFx(a.key === "swim" ? { room: room.key, at: at.spot.at, kind: "ripples" } : a.key === "bath" ? { room: room.key, at: at.spot.at, kind: at.obj === "shower" ? "shower" : "splash" } : null);
    setCooking(a.key === "cook" ? room.key : null);
    // Watching a TV you bought: stand in front of it (there's no sofa facing it).
    setAction(a.shows && at.bought ? "stand" : POSE[a.pose]);
    if (a.shows && at.spot.screen) setShow({ room: room.key, quad: at.spot.screen, programme: pickProgramme(a.shows) });
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
      setFx(null);
      setCooking(null);
      setAction("stand");
    } finally {
      setBusy(false);
    }
  };
  const start = (a: HomeAction) => (a.key === "call" ? setCalling(true) : void run(a));
  const waitFor = (a: HomeAction) => Math.max(0, Math.ceil((readyAt(a) - Date.now()) / 60_000));

  /** Props for the room scene now on show. */
  const scene = (room: string): { spot?: InteriorPlayer["spot"]; overlay?: ReactNode; overlayTop?: ReactNode; extraWorkers?: Worker[]; onItem?: string | null; hideCook?: boolean } => ({
    spot,
    onItem,
    hideCook: cooking === room,
    overlay: show && show.room === room ? <ScreenShow quad={show.quad} programme={show.programme} /> : undefined,
    overlayTop: fx && fx.room === room ? <WaterFx at={fx.at} kind={fx.kind} /> : undefined,
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
