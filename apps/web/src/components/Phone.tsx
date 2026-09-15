// The in-game phone: one place for Jobs, Quests, Standings, Messages and the real Market.
import type { AvatarConfig, DreamView, QuestBoard, ServiceRequestSummary } from "@hc/shared";
import { ArrowLeft, Briefcase, Handshake, GraduationCap, Hammer, ListChecks, Megaphone, MessageCircle, Settings, ShieldCheck, Store, Ticket, Car, MessagesSquare, Shirt, CalendarDays, Users, Gamepad2, Trophy, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { AcademyApp, AdminAcademy } from "./Academy.js";
import { Dream, DreamCard } from "./Dream.js";
import { AdminAds, MyAds } from "./Billboards.js";
import { ChangePassword } from "./Password.js";
import { RequestList, RequestThread } from "./Requests.js";
import { AdminReview, Workshop } from "./Workshop.js";
import { AdminDeals, MyDeals } from "./Deals.js";
import { Garage } from "./Home.js";
import { Chats } from "./Chat.js";
import { Wardrobe } from "./Wardrobe.js";
import { EventsApp } from "./Events.js";
import { Contacts } from "./Contacts.js";
import { GamesApp, type GameOpen } from "./Games.js";
import { Hangout, WorkHub } from "./Locations.js";
import { AdminSponsors } from "./Sponsors.js";
import { JobsBoard } from "./JobsBoard.js";
import { AdminHustle, HustleBoard } from "./HustleBoard.js";
import { Quests } from "./Quests.js";

export type PhoneApp = "home" | "dream" | "jobs" | "quests" | "standings" | "messages" | "account" | "workshop" | "admin" | "ads" | "academy" | "deals" | "garage" | "chats" | "wardrobe" | "events" | "contacts" | "games" | "hustle";

const APPS: { key: Exclude<PhoneApp, "home"> | "market"; label: string; Icon: LucideIcon; tint: string }[] = [
  { key: "academy", label: "Academy", Icon: GraduationCap, tint: "#0e7490" },
  { key: "jobs", label: "Jobs", Icon: Briefcase, tint: "#1e2a5e" },
  { key: "hustle", label: "Hustle", Icon: Handshake, tint: "#b45309" },
  { key: "quests", label: "Quests", Icon: ListChecks, tint: "#00a859" },
  { key: "standings", label: "Standings", Icon: Trophy, tint: "#df382b" },
  { key: "messages", label: "Messages", Icon: MessageCircle, tint: "#3b5bdb" },
  { key: "market", label: "Market", Icon: Store, tint: "#b8860b" },
  { key: "events", label: "Events", Icon: CalendarDays, tint: "#d97706" },
  { key: "games", label: "Games", Icon: Gamepad2, tint: "#7c3aed" },
  { key: "contacts", label: "Contacts", Icon: Users, tint: "#0891b2" },
  { key: "chats", label: "Chats", Icon: MessagesSquare, tint: "#2563eb" },
  { key: "deals", label: "Deals", Icon: Ticket, tint: "#15803d" },
  { key: "garage", label: "Garage", Icon: Car, tint: "#334155" },
  { key: "wardrobe", label: "Wardrobe", Icon: Shirt, tint: "#be185d" },
  { key: "workshop", label: "Business", Icon: Hammer, tint: "#8a3fa0" },
  { key: "ads", label: "Ads", Icon: Megaphone, tint: "#c2410c" },
  { key: "account", label: "Account", Icon: Settings, tint: "#4b5563" },
  { key: "admin", label: "Admin", Icon: ShieldCheck, tint: "#0f766e" },
];

const TITLES: Record<PhoneApp, string> = { home: "Phone", academy: "Academy", dream: "Dream", account: "Account", workshop: "Your business", deals: "Deals", chats: "Chats", garage: "Garage", wardrobe: "Wardrobe", events: "Events", contacts: "Contacts", games: "Games", hustle: "Hustle board", admin: "Admin", ads: "Ads", jobs: "Jobs", quests: "Quests", standings: "Standings", messages: "Messages" };

export function Phone({
  app,
  setApp,
  onClose,
  onMarket,
  board,
  onBoard,
  onChanged,
  notify,
  email,
  isAdmin = false,
  avatar,
  game,
}: {
  /** A game to open straight away (a friend's challenge). */
  game?: GameOpen;
  avatar?: AvatarConfig;
  app: PhoneApp;
  setApp: (a: PhoneApp) => void;
  onClose: () => void;
  onMarket: () => void;
  board: QuestBoard | null;
  onBoard: (b: QuestBoard) => void;
  onChanged: () => void;
  notify: (msg: string) => void;
  email: string;
  isAdmin?: boolean;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const [dream, setDream] = useState<DreamView | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [turns, setTurns] = useState(0);
  const refreshTurns = () => {
    api<ServiceRequestSummary[]>("GET", "/api/services/requests")
      .then((rs) => setTurns(rs.filter((r) => r.yourTurn).length))
      .catch(() => setTurns(0));
  };
  // Re-check whose turn it is whenever the home screen shows (quotes can arrive while the phone is open).
  useEffect(() => {
    if (app === "home") refreshTurns();
  }, [app]);
  useEffect(() => {
    api<DreamView>("GET", "/api/game/dream")
      .then(setDream)
      .catch(() => setDream(null));
  }, []);
  const readyQuests = board ? board.daily.filter((q) => q.progress >= q.target && !q.claimed).length : 0;

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    // Focus the sheet once when it opens; refocusing on every re-render pulled focus out of text fields.
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const now = new Date();
  const time = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(now);
  const date = new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(now);

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div
        ref={sheet}
        className="phone"
        role="dialog"
        aria-modal="true"
        aria-label={`Phone: ${TITLES[app]}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="phone-notch" aria-hidden="true" />
        <div className="phone-bar">
          {app === "home" ? (
            <span className="phone-time">Lagos</span>
          ) : (
            <button
              type="button"
              className="phone-back"
              onClick={() => {
                setThread(null);
                setApp("home");
              }}
            >
              <ArrowLeft size={18} aria-hidden="true" /> {TITLES[app]}
            </button>
          )}
          <button type="button" className="phone-close" onClick={onClose} aria-label="Close phone">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="phone-screen">
          {app === "home" && (
            <div className="phone-home">
              <div className="phone-clock">
                <strong>{time}</strong>
                <span>{date} · Lagos</span>
              </div>
              {dream && <DreamCard dream={dream} onOpen={() => setApp("dream")} />}
              <div className="phone-apps">
                {APPS.filter((a) => a.key !== "admin" || isAdmin).map(({ key, label, Icon, tint }) => (
                  <button
                    key={key}
                    type="button"
                    className="phone-app"
                    onClick={() => (key === "market" ? onMarket() : setApp(key))}
                  >
                    <span className="phone-app-icon" style={{ background: tint }}>
                      <Icon size={26} aria-hidden="true" />
                      {key === "quests" && readyQuests > 0 && <span className="phone-badge">{readyQuests}</span>}
                      {key === "messages" && turns > 0 && <span className="phone-badge">{turns}</span>}
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {app === "dream" && dream && <Dream dream={dream} onDream={setDream} onChanged={onChanged} notify={notify} />}
          {app === "academy" && <AcademyApp notify={notify} onChanged={onChanged} />}
          {app === "jobs" && (
            <div className="stack-lg">
              <JobsBoard notify={notify} />
              <WorkHub />
            </div>
          )}
          {app === "hustle" && <HustleBoard notify={notify} onChanged={onChanged} />}
          {app === "account" && <ChangePassword email={email} notify={notify} />}
          {app === "quests" && board && <Quests board={board} onBoard={onBoard} onChanged={onChanged} notify={notify} />}
          {app === "standings" && <Hangout onViewed={onChanged} />}
          {app === "messages" &&
            (thread ? (
              <RequestThread id={thread} onBack={() => setThread(null)} notify={notify} onChanged={refreshTurns} />
            ) : (
              <div className="stack">
                <Chats />
                <h2 style={{ fontSize: 18 }}>Quote requests</h2>
                <RequestList onOpen={setThread} />
              </div>
            ))}
          {app === "workshop" && <Workshop notify={notify} />}
          {app === "deals" && <MyDeals />}
          {app === "chats" && <Chats />}
          {app === "games" && <GamesApp key={game?.id ?? "menu"} notify={notify} onChanged={onChanged} open={game ?? null} />}
          {app === "contacts" && (
            <Contacts
              notify={notify}
              onGo={(c) => {
                onClose();
                window.setTimeout(() => window.dispatchEvent(new CustomEvent("hc:go-to", { detail: { x: c.x, y: c.y, label: `@${c.nickname}`, place: c.place } })), 50);
              }}
            />
          )}
          {app === "events" && (
            <EventsApp
              onGo={(v) => {
                onClose();
                window.setTimeout(() => window.dispatchEvent(new CustomEvent("hc:open-venue", { detail: v })), 50);
              }}
            />
          )}
          {app === "wardrobe" && avatar && <Wardrobe avatar={avatar} notify={notify} onChanged={onChanged} />}
          {app === "garage" && <Garage notify={notify} onChanged={onChanged} />}
          {app === "admin" && isAdmin && (
            <div className="stack">
              <AdminAcademy notify={notify} />
              <AdminAds notify={notify} />
              <AdminSponsors notify={notify} />
              <AdminHustle notify={notify} />
              <AdminReview notify={notify} />
              <h2 style={{ fontSize: 20 }}>Deal review</h2>
              <AdminDeals notify={notify} />
            </div>
          )}
          {app === "ads" && <MyAds />}
        </div>
      </div>
    </div>
  );
}
