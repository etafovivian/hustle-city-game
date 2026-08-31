// "Bring your crew" (Phone → Contacts) and play nights (map banner and Phone → Events).
import {
  CREW,
  PLAY_NIGHT,
  VENUES_BY_KEY,
  type CrewView,
  type PlayNightView,
} from "@hc/shared";
import { Copy, Gift, MessageCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, formatCoins } from "../api.js";

const CREW_KEY = "hc_crew";
/** Remember a ?crew= invite from the link until sign-up. */
export function rememberCrew() {
  try {
    const c = new URLSearchParams(window.location.search).get("crew");
    if (c && /^[A-Za-z0-9_]{2,30}$/.test(c)) localStorage.setItem(CREW_KEY, c);
  } catch {
    /* not essential */
  }
}
export function crewInvite(): string | null {
  try {
    return localStorage.getItem(CREW_KEY);
  } catch {
    return null;
  }
}
export const crewLink = (code: string) =>
  `${window.location.origin}/?crew=${encodeURIComponent(code)}`;

export function CrewCard({ notify }: { notify: (m: string) => void }) {
  const [crew, setCrew] = useState<CrewView | null>(null);
  useEffect(() => {
    api<CrewView>("GET", "/api/crew")
      .then(setCrew)
      .catch(() => undefined);
  }, []);
  if (!crew?.code) return null;
  const link = crewLink(crew.code);
  const text = `Come and hustle with me in Naija Hustle City, a Lagos city game. Join with my link and you start with ${formatCoins(CREW.welcome)} extra coins: ${link}`;
  return (
    <div className="quote-card crew-card">
      <strong className="row" style={{ gap: 6 }}>
        <Gift size={17} aria-hidden="true" /> Bring your crew
      </strong>
      <span className="tiny muted">
        Friends who join with your link start with +{formatCoins(CREW.welcome)}{" "}
        coins and you're in each other's contacts. When they've played a bit,
        you get +{formatCoins(CREW.reward)} coins and +{CREW.rewardXp} XP.
      </span>
      <code className="crew-link">{link}</code>
      <div className="row">
        <a
          className="btn sm go"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={15} aria-hidden="true" /> Share on WhatsApp
        </a>
        <button
          type="button"
          className="btn sm"
          onClick={() =>
            void navigator.clipboard
              .writeText(link)
              .then(() => notify("Link copied"))
              .catch(() => notify(link))
          }
        >
          <Copy size={15} aria-hidden="true" /> Copy link
        </button>
      </div>
      {crew.friends.length > 0 && (
        <span className="tiny">
          <Users size={13} aria-hidden="true" /> Your crew:{" "}
          {crew.friends
            .map((f) => `@${f.nickname}${f.played ? " ✓" : " (new)"}`)
            .join(", ")}{" "}
          · {crew.rewarded} rewarded
        </span>
      )}
    </div>
  );
}

const startsIn = (iso: string) => {
  const mins = Math.max(
    0,
    Math.round((new Date(iso).getTime() - Date.now()) / 60_000),
  );
  if (mins < 60) return `in ${mins} min`;
  if (mins < 24 * 60) return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
};

export function usePlayNights() {
  const [nights, setNights] = useState<PlayNightView[]>([]);
  useEffect(() => {
    const load = () =>
      api<PlayNightView[]>("GET", "/api/play-nights")
        .then(setNights)
        .catch(() => undefined);
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const rsvp = async (key: string) =>
    setNights(
      await api<PlayNightView[]>("POST", `/api/play-nights/${key}/rsvp`),
    );
  return { nights, rsvp };
}

/** One play night: when, who's coming, I'm coming, go there. */
export function PlayNightCard({
  n,
  onRsvp,
  onGo,
  here,
}: {
  n: PlayNightView;
  onRsvp: () => void;
  onGo: () => void;
  here?: number;
}) {
  const venue = VENUES_BY_KEY.get(n.venue);
  return (
    <div className={`quote-card play-night ${n.on ? "event-on" : ""}`}>
      <strong>
        {n.icon} {n.name} {n.on && <span className="tag">On now</span>}
      </strong>
      <span className="tiny muted">
        {venue?.name} ·{" "}
        {n.on
          ? `happening now${here ? `, ${here} there` : ""}`
          : startsIn(n.start)}{" "}
        · win a table game for +{PLAY_NIGHT.winCoins} coins (up to{" "}
        {PLAY_NIGHT.winsPerNight})
      </span>
      <span className="small">{n.blurb}</span>
      <span className="tiny">
        {n.coming
          ? `${n.coming} coming: ${n.names.map((x) => `@${x}`).join(", ")}${n.coming > n.names.length ? "…" : ""}`
          : "Be the first to say you're coming."}
      </span>
      <div className="row">
        <button
          type="button"
          className={`btn sm ${n.you ? "" : "gold"}`}
          onClick={onRsvp}
          aria-pressed={n.you}
        >
          {n.you ? "✓ You're coming" : "I'm coming"}
        </button>
        <button
          type="button"
          className={`btn sm ${n.on ? "go" : "quiet"}`}
          onClick={onGo}
        >
          Go there
        </button>
      </div>
    </div>
  );
}

/** The map banner: the next play night within a day, or the one on now. */
export function PlayNightBanner({
  onGo,
  hereCount,
}: {
  onGo: (venue: string) => void;
  hereCount: (venue: string) => number;
}) {
  const { nights, rsvp } = usePlayNights();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const soon = nights.filter(
    (n) =>
      n.on || new Date(n.start).getTime() - Date.now() < 3 * 24 * 3_600_000,
  );
  const n = soon[0];
  if (!n) return null;
  return (
    <>
      <button
        type="button"
        className={`play-night-pill ${n.on ? "on" : ""}`}
        onClick={() => setOpen(true)}
      >
        {n.icon} {n.name}{" "}
        {n.on ? `is ON · ${hereCount(n.venue)} there` : startsIn(n.start)}
        {n.coming > 0 && !n.on ? ` · ${n.coming} coming` : ""}
      </button>
      {open &&
        createPortal(
          <div className="phone-backdrop" onClick={() => setOpen(false)}>
            <div
              className="visit-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Play nights"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Play nights</h2>
              <p className="small muted">
                Set times when everyone comes online and meets up. Bring your
                crew.
              </p>
              {nights.map((x) => (
                <PlayNightCard
                  key={x.key}
                  n={x}
                  here={hereCount(x.venue)}
                  onRsvp={() => void rsvp(x.key)}
                  onGo={() => {
                    setOpen(false);
                    onGo(x.venue);
                  }}
                />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
