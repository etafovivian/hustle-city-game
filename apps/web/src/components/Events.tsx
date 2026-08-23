// Phone → Events: the Lagos week (owambe Saturdays, Sunday service, Jumu'ah, match nights…), what's on now, and
// a way to go there.
import { VENUES_BY_KEY, upcoming } from "@hc/shared";
import { CalendarDays } from "lucide-react";

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-NG", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(d);

export function EventsApp({ onGo }: { onGo: (venueKey: string) => void }) {
  const list = upcoming(new Date());
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>
          <CalendarDays size={20} aria-hidden="true" /> This week in Lagos
        </h2>
        <p className="small muted">While an event is on, everything at its places gives +50% XP and an extra lift. Even better with friends.</p>
      </div>
      {list.map(({ event, start, on }) => (
        <div key={event.key} className={`quote-card ${on ? "event-on" : ""}`}>
          <strong>
            {event.icon} {event.name} {on && <span className="tag">On now</span>}
          </strong>
          <span className="tiny muted">{on ? "Happening now" : when(start)}</span>
          <span className="small">{event.blurb}</span>
          <div className="row">
            {event.venues.map((v) => {
              const venue = VENUES_BY_KEY.get(v);
              return venue ? (
                <button key={v} type="button" className={`btn sm ${on ? "go" : ""}`} onClick={() => onGo(v)}>
                  {venue.icon} {venue.name}
                </button>
              ) : null;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
