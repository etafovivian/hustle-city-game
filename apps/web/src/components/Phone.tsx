// The in-game phone: one place for Jobs, Quests, Standings, Messages and the real Market.
import type { DreamView, QuestBoard, ServiceRequestSummary } from "@hc/shared";
import { ArrowLeft, Briefcase, Hammer, ListChecks, MessageCircle, Settings, ShieldCheck, Store, Trophy, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Dream, DreamCard } from "./Dream.js";
import { ChangePassword } from "./Password.js";
import { RequestList, RequestThread } from "./Requests.js";
import { AdminReview, Workshop } from "./Workshop.js";
import { Hangout, WorkHub } from "./Locations.js";
import { Quests } from "./Quests.js";

export type PhoneApp = "home" | "dream" | "jobs" | "quests" | "standings" | "messages" | "account" | "workshop" | "admin";

const APPS: { key: Exclude<PhoneApp, "home"> | "market"; label: string; Icon: LucideIcon; tint: string }[] = [
  { key: "jobs", label: "Jobs", Icon: Briefcase, tint: "#1e2a5e" },
  { key: "quests", label: "Quests", Icon: ListChecks, tint: "#00a859" },
  { key: "standings", label: "Standings", Icon: Trophy, tint: "#df382b" },
  { key: "messages", label: "Messages", Icon: MessageCircle, tint: "#3b5bdb" },
  { key: "market", label: "Market", Icon: Store, tint: "#b8860b" },
  { key: "workshop", label: "Workshop", Icon: Hammer, tint: "#8a3fa0" },
  { key: "account", label: "Account", Icon: Settings, tint: "#4b5563" },
  { key: "admin", label: "Admin", Icon: ShieldCheck, tint: "#0f766e" },
];

const TITLES: Record<PhoneApp, string> = { home: "Phone", dream: "Dream", account: "Account", workshop: "Workshop", admin: "Admin", jobs: "Jobs", quests: "Quests", standings: "Standings", messages: "Messages" };

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
}: {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          {app === "jobs" && <WorkHub />}
          {app === "account" && <ChangePassword email={email} notify={notify} />}
          {app === "quests" && board && <Quests board={board} onBoard={onBoard} onChanged={onChanged} notify={notify} />}
          {app === "standings" && <Hangout onViewed={onChanged} />}
          {app === "messages" &&
            (thread ? (
              <RequestThread id={thread} onBack={() => setThread(null)} notify={notify} onChanged={refreshTurns} />
            ) : (
              <RequestList onOpen={setThread} />
            ))}
          {app === "workshop" && <Workshop notify={notify} />}
          {app === "admin" && isAdmin && <AdminReview notify={notify} />}
        </div>
      </div>
    </div>
  );
}
