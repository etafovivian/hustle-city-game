// The in-game phone: one place for Jobs, Quests, Standings, Messages and the real Market.
import type { QuestBoard } from "@hc/shared";
import { ArrowLeft, Briefcase, ListChecks, MessageCircle, Store, Trophy, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Hangout, WorkHub } from "./Locations.js";
import { Quests } from "./Quests.js";

export type PhoneApp = "home" | "jobs" | "quests" | "standings" | "messages";

const APPS: { key: Exclude<PhoneApp, "home"> | "market"; label: string; Icon: LucideIcon; tint: string }[] = [
  { key: "jobs", label: "Jobs", Icon: Briefcase, tint: "#1e2a5e" },
  { key: "quests", label: "Quests", Icon: ListChecks, tint: "#00a859" },
  { key: "standings", label: "Standings", Icon: Trophy, tint: "#df382b" },
  { key: "messages", label: "Messages", Icon: MessageCircle, tint: "#3b5bdb" },
  { key: "market", label: "Market", Icon: Store, tint: "#b8860b" },
];

const TITLES: Record<PhoneApp, string> = { home: "Phone", jobs: "Jobs", quests: "Quests", standings: "Standings", messages: "Messages" };

export function Phone({
  app,
  setApp,
  onClose,
  onMarket,
  board,
  onBoard,
  onChanged,
  notify,
}: {
  app: PhoneApp;
  setApp: (a: PhoneApp) => void;
  onClose: () => void;
  onMarket: () => void;
  board: QuestBoard | null;
  onBoard: (b: QuestBoard) => void;
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
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
            <button type="button" className="phone-back" onClick={() => setApp("home")}>
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
              <div className="phone-apps">
                {APPS.map(({ key, label, Icon, tint }) => (
                  <button
                    key={key}
                    type="button"
                    className="phone-app"
                    onClick={() => (key === "market" ? onMarket() : setApp(key))}
                  >
                    <span className="phone-app-icon" style={{ background: tint }}>
                      <Icon size={26} aria-hidden="true" />
                      {key === "quests" && readyQuests > 0 && <span className="phone-badge">{readyQuests}</span>}
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {app === "jobs" && <WorkHub />}
          {app === "quests" && board && <Quests board={board} onBoard={onBoard} onChanged={onChanged} notify={notify} />}
          {app === "standings" && <Hangout onViewed={onChanged} />}
          {app === "messages" && (
            <div className="phone-empty">
              <MessageCircle size={32} aria-hidden="true" />
              <strong>No messages yet</strong>
              <p className="muted small">Merchant replies, quotes and friend messages will land here when the private beta opens them.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
