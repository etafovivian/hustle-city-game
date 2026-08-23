// The Lagos week: events that come round at set times (owambe Saturdays, Sunday service, Jumu'ah, match nights,
// Friday groove at the lounge, the Sunday sunset cruise). While an event is on, its places give +50% XP and an
// extra lift to the needs they fill, and the map shows it. Lagos is UTC+1 all year.
import type { Vibe } from "./venues.js";

export interface CityEvent {
  key: string;
  name: string;
  icon: string;
  blurb: string;
  /** Base venue keys (branches of these share the event). */
  venues: readonly string[];
  /** Lagos weekdays it runs on (0 = Sunday … 6 = Saturday). */
  days: readonly number[];
  /** Lagos hours [start, end); end below start runs past midnight. */
  hours: readonly [number, number];
  /** Extra need lift for activities during the event. */
  gives: readonly Vibe[];
}

export const EVENTS: readonly CityEvent[] = [
  { key: "owambe_saturday", name: "Owambe Saturday", icon: "🎉", blurb: "Aso-ebi, jollof and a live band. Spray the celebrants and dance till evening.", venues: ["royal_event_centre"], days: [6], hours: [13, 22], gives: ["fun", "social"] },
  { key: "sunday_service", name: "Sunday service", icon: "⛪", blurb: "Praise and worship, a long sermon, and gist with everyone after.", venues: ["grace_chapel"], days: [0], hours: [8, 13], gives: ["faith", "social"] },
  { key: "jumuah", name: "Jumu'ah prayers", icon: "🕌", blurb: "Friday prayers: the courtyard fills, then food and greetings outside.", venues: ["central_mosque"], days: [5], hours: [12, 15], gives: ["faith", "social"] },
  { key: "match_night", name: "Match night", icon: "⚽", blurb: "The big game on the big screen. Every goal shakes the street.", venues: ["viewing_centre", "city_stadium", "oga_snooker"], days: [2, 3, 6], hours: [18, 23], gives: ["fun", "social"] },
  { key: "friday_groove", name: "Friday Groove", icon: "🪩", blurb: "The DJ's best set of the week. Dress sharp.", venues: ["skyline_lounge"], days: [5], hours: [22, 4], gives: ["fun", "style"] },
  { key: "sunset_cruise", name: "Sunday sunset cruise", icon: "🌅", blurb: "Cocktails and Afrobeats on the lagoon as the sun goes down.", venues: ["lagoon_boat_cruise"], days: [0], hours: [16, 20], gives: ["fun", "rest"] },
  { key: "market_day", name: "Big market day", icon: "🛍️", blurb: "Traders from every corner; prices drop, crowds swell.", venues: ["tailors_row", "mama_nkechi_buka", "mallam_suya"], days: [4], hours: [8, 18], gives: ["food", "social"] },
];
export const EVENT_BY_KEY: ReadonlyMap<string, CityEvent> = new Map(EVENTS.map((e) => [e.key, e]));
/** XP multiplier during an event. */
export const EVENT_XP = 1.5;
/** Extra need lift during an event (on top of the activity's own). */
export const EVENT_NEED_BONUS = 10;

/** Lagos weekday and hour of a moment. */
export function lagosClock(at: Date) {
  const l = new Date(at.getTime() + 3_600_000);
  return { day: l.getUTCDay(), hour: l.getUTCHours() + l.getUTCMinutes() / 60 };
}

/** Is the event on at this moment? (An evening that runs past midnight belongs to the day it started.) */
export function isEventOn(e: CityEvent, at: Date) {
  const { day, hour } = lagosClock(at);
  const [s, end] = e.hours;
  if (s < end) return e.days.includes(day) && hour >= s && hour < end;
  return (e.days.includes(day) && hour >= s) || (e.days.includes((day + 6) % 7) && hour < end);
}

export const eventsOn = (at: Date) => EVENTS.filter((e) => isEventOn(e, at));
/** The event on now at a place (by its base venue key), if any. */
export const eventAt = (venue: string, at: Date) => eventsOn(at).find((e) => e.venues.includes(venue));

/** The next start of each event from `at` (for the calendar), soonest first. */
export function upcoming(at: Date): { event: CityEvent; start: Date; on: boolean }[] {
  const out = EVENTS.map((e) => {
    if (isEventOn(e, at)) return { event: e, start: at, on: true };
    for (let h = 1; h <= 24 * 8; h++) {
      const t = new Date(Math.floor(at.getTime() / 3_600_000) * 3_600_000 + h * 3_600_000);
      const { day, hour } = lagosClock(t);
      if (e.days.includes(day) && Math.floor(hour) === e.hours[0]) return { event: e, start: t, on: false };
    }
    return { event: e, start: new Date(at.getTime() + 8 * 86_400_000), on: false };
  });
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
