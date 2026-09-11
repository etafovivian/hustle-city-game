// Meeting people: other players on the map (and their card: wave, buy a drink, go to them, visit their home),
// and visiting someone's house.
import { HOUSE_BY_KEY, VENUES_BY_KEY, type AvatarConfig, type MapHome, type PresencePlayer } from "@hc/shared";
import { Beer, Hand, Home as HomeIcon, MessageCircle, Navigation, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { Avatar } from "./Avatar.js";
import { variantFor } from "./AvatarWalker.js";
import { BRANCH_BY_KEY } from "./cityLayout.js";
import { DmThreadView, RoomChat } from "./Chat.js";
import { HomeRooms } from "./Home.js";
import type { PlayerAction } from "./Interior.js";
import { walkerSheet, walkerSize } from "./walkers.js";

const WALK = walkerSize(70);
/** Price of a drink for a friend (matches the server). */
export const TREAT_COINS = 300;

/** Where someone is, in words. */
export function placeName(place: string | null) {
  if (!place) return "Out in the city";
  if (place.startsWith("home:")) return "At home";
  return `At ${BRANCH_BY_KEY.get(place)?.name ?? VENUES_BY_KEY.get(place)?.name ?? "a place"}`;
}

/** Other players on the map: their walker (gliding between reports) and a blue name tag. */
export function OtherPlayers({ players, plateScale, onOpen }: { players: PresencePlayer[]; plateScale: number; onOpen: (p: PresencePlayer) => void }) {
  return (
    <g className="others">
      {players.map((p) => (
        <g key={p.nickname} className="other-player hotspot" style={{ transform: `translate(${p.x}px, ${p.y}px)` }} role="button" tabIndex={0} aria-label={`@${p.nickname}. ${placeName(p.place)}. Open.`} onClick={() => onOpen(p)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(p)}>
          <ellipse rx="16" ry="5" fill="rgb(0 0 0 / 30%)" />
          <ellipse rx="22" ry="9" fill="none" stroke="#5aa9ff" strokeWidth="3" />
          <svg x={-WALK.w / 2} y={-WALK.h + WALK.ground} width={WALK.w} height={WALK.h} overflow="hidden">
            <image href={walkerSheet(variantFor(p.avatar), "se")} width={WALK.w * WALK.frames} height={WALK.h} />
          </svg>
          <g transform={`translate(0 ${-WALK.h + WALK.ground - 4}) scale(${plateScale * 0.8})`}>
            <rect x={-(p.nickname.length * 4.6 + 16)} y="-26" width={p.nickname.length * 9.2 + 32} height="24" rx="12" fill="#1e4fd6" stroke="#fff" strokeWidth="1.5" />
            <text y="-9" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff">
              @{p.nickname}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
}

function useSheet(onClose: () => void) {
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
  return sheet;
}

/** Another player's card: wave, buy them a drink (when you're together), go to them, visit their home. */
export function PlayerCard({
  player,
  near,
  home,
  onClose,
  notify,
  onGo,
  onVisitHome,
  onChanged,
}: {
  player: PresencePlayer;
  /** Close enough (or at the same place) for a drink. */
  near: boolean;
  home: MapHome | undefined;
  onClose: () => void;
  notify: (m: string) => void;
  onGo: () => void;
  onVisitHome: () => void;
  onChanged: () => void;
}) {
  const sheet = useSheet(onClose);
  const [busy, setBusy] = useState(false);
  const [talking, setTalking] = useState(false);
  const addContact = async () => {
    try {
      await api("POST", `/api/contacts/${encodeURIComponent(player.nickname)}`);
      notify(`@${player.nickname} added to Phone → Contacts`);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const invite = async () => {
    setBusy(true);
    try {
      await api("POST", "/api/presence/invite", { to: player.nickname });
      notify(`Invite sent. @${player.nickname} can tap you and Visit your home.`);
      onClose();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const send = async (what: "wave" | "treat") => {
    setBusy(true);
    try {
      await api("POST", `/api/presence/${what}`, { to: player.nickname });
      notify(what === "wave" ? `You waved at @${player.nickname} 👋` : `You bought @${player.nickname} a drink 🍻`);
      if (what === "treat") onChanged();
      onClose();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet player-card" role="dialog" aria-modal="true" aria-label={`@${player.nickname}`} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <Avatar avatar={player.avatar} size={56} />
          <div>
            <h2>@{player.nickname}</h2>
            <span className="small muted">
              <span className="online-dot" aria-hidden="true" /> Online · {placeName(player.place)}
            </span>
          </div>
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={busy} onClick={() => void send("wave")}>
            <Hand size={16} aria-hidden="true" /> Wave
          </button>
          <button type="button" className="btn go" disabled={busy || !near} onClick={() => void send("treat")} title={near ? undefined : "Go to where they are first"}>
            <Beer size={16} aria-hidden="true" /> Buy a drink ({TREAT_COINS} coins)
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void addContact()}>
            <UserPlus size={16} aria-hidden="true" /> Add contact
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void invite()}>
            <HomeIcon size={16} aria-hidden="true" /> Invite to my house
          </button>
          <button type="button" className="btn" onClick={() => setTalking((x) => !x)}>
            <MessageCircle size={16} aria-hidden="true" /> Message
          </button>
          <button type="button" className="btn quiet" onClick={onGo}>
            <Navigation size={16} aria-hidden="true" /> Go to them
          </button>
          {home && (
            <button type="button" className="btn quiet" onClick={onVisitHome}>
              <HomeIcon size={16} aria-hidden="true" /> Visit their home
            </button>
          )}
        </div>
        {talking && <DmThreadView nick={player.nickname} />}
        {!near && <p className="tiny muted">Meet up first: go to the same place (or stand close) to buy them a drink. A drink lifts Social and Fun for both of you.</p>}
      </div>
    </div>,
    document.body,
  );
}

/** Inside someone's house: their room, who's there, and a knock (a wave) if they're home. */
export function VisitHome({
  home,
  inside,
  onClose,
  notify,
  avatar,
}: {
  avatar?: AvatarConfig;
  home: { plotId: string; nickname: string; design: string | null; mine?: boolean };
  /** Players in this home right now. */
  inside: PresencePlayer[];
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const sheet = useSheet(onClose);
  const [me, setMe] = useState<PlayerAction>("walk");
  const ownerIn = inside.some((p) => p.nickname === home.nickname);
  const knock = async () => {
    try {
      await api("POST", "/api/presence/wave", { to: home.nickname });
      notify(`You knocked on @${home.nickname}'s door`);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return createPortal(
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet venue-card" role="dialog" aria-modal="true" aria-label={`@${home.nickname}'s home`} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <span className="venue-icon" aria-hidden="true">
            🏠
          </span>
          <div>
            <h2>@{home.nickname}'s {HOUSE_BY_KEY.get(home.design ?? "")?.label.toLowerCase() ?? "room"}</h2>
            <span className="small muted">{inside.length ? `Inside: ${inside.map((p) => `@${p.nickname}`).join(", ")}` : "Nobody's in right now"}</span>
          </div>
        </div>
        <div className="venue-layout has-room">
          <div className="venue-room">
            <HomeRooms design={home.design} who={`@${home.nickname}'s`} avatar={avatar} action={me} onAction={setMe} guests={inside} />
            <div className="row home-acts">
              <button type="button" className="btn sm" onClick={() => setMe("sit")}>
                🛋️ Sit down
              </button>
              <button type="button" className="btn sm" onClick={() => setMe("eat")}>
                🍲 Eat with them
              </button>
              <button type="button" className="btn sm" onClick={() => setMe("dance")}>
                💃 Dance
              </button>
            </div>
          </div>
          <div className="venue-info">
            <p className="small">Make yourself at home. {ownerIn ? `@${home.nickname} is in: say hello!` : `@${home.nickname} isn't in. Knock and they'll see it next time they look.`}</p>
            <RoomChat place={`home:${home.plotId}`} />
            <div className="row">
              <button type="button" className="btn go" onClick={() => void knock()}>
                <Hand size={16} aria-hidden="true" /> {ownerIn ? "Say hello" : "Knock"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
