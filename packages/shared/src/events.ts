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
  /** Only in season: Lagos month-day range [from, to] as "MM-DD" (wraps over New Year). */
  season?: readonly [string, string];
  /** A play night: players meet at a set time; table-game wins there pay a prize, and people say "I'm coming". */
  playNight?: boolean;
}

export const EVENTS: readonly CityEvent[] = [
  { key: "owambe_saturday", name: "Owambe Saturday", icon: "🎉", blurb: "Aso-ebi, jollof and a live band. Spray the celebrants and dance till evening.", venues: ["royal_event_centre"], days: [6], hours: [13, 22], gives: ["fun", "social"] },
  { key: "sunday_service", name: "Sunday service", icon: "⛪", blurb: "Praise and worship, a long sermon, and gist with everyone after.", venues: ["grace_chapel"], days: [0], hours: [8, 13], gives: ["faith", "social"] },
  { key: "jumuah", name: "Jumu'ah prayers", icon: "🕌", blurb: "Friday prayers: the courtyard fills, then food and greetings outside.", venues: ["central_mosque"], days: [5], hours: [12, 15], gives: ["faith", "social"] },
  { key: "match_night", name: "Match night", icon: "⚽", blurb: "The big game on the big screen. Every goal shakes the street.", venues: ["viewing_centre", "city_stadium", "oga_snooker"], days: [2, 3, 6], hours: [18, 23], gives: ["fun", "social"] },
  { key: "friday_groove", name: "Friday Groove", icon: "🪩", blurb: "The DJ's best set of the week. Dress sharp.", venues: ["skyline_lounge"], days: [5], hours: [22, 4], gives: ["fun", "style"] },
  { key: "sunset_cruise", name: "Sunday sunset cruise", icon: "🌅", blurb: "Cocktails and Afrobeats on the lagoon as the sun goes down.", venues: ["lagoon_boat_cruise"], days: [0], hours: [16, 20], gives: ["fun", "rest"] },
  { key: "games_night", name: "Games Night", icon: "🎲", blurb: "Everybody at Oga's: chess, Ayo and snooker against real people. Win a game here on the night for a prize.", venues: ["oga_snooker"], days: [3], hours: [20, 22], gives: ["fun", "social"], playNight: true },
  { key: "buka_night", name: "Buka Night", icon: "🍲", blurb: "Saturday night at Mama Nkechi's: food, gist and Ayo with whoever turns up. Win at the Ayo board for a prize.", venues: ["mama_nkechi_buka"], days: [6], hours: [20, 22], gives: ["food", "social"], playNight: true },
  { key: "fight_night", name: "Fight Night", icon: "🥊", blurb: "Amateur bouts under the lights at Ring Kings. Cheer, spar a round yourself, or just watch the fists fly.", venues: ["ring_kings_boxing"], days: [5], hours: [19, 23], gives: ["fun", "social"] },
  { key: "beach_rave", name: "Sunday Beach Rave", icon: "🏝️", blurb: "DJ on the sand, bonfire at sunset, everybody dancing barefoot. Take the water bus from Marina.", venues: ["sandbar_beach"], days: [0], hours: [16, 23], gives: ["fun", "social"] },
  { key: "detty_december", name: "Detty December", icon: "🎆", blurb: "Everyone is back home for Christmas: beach raves every night, owambes everywhere, the Island is packed and prices are up.", venues: ["sandbar_beach", "skyline_lounge", "royal_event_centre", "lagoon_boat_cruise"], days: [0, 1, 2, 3, 4, 5, 6], hours: [18, 4], gives: ["fun", "social"], season: ["12-15", "01-02"] },
  { key: "market_day", name: "Big market day", icon: "🛍️", blurb: "Traders from every corner; prices drop, crowds swell.", venues: ["balogun_market", "tailors_row", "mama_nkechi_buka", "mallam_suya"], days: [4], hours: [8, 18], gives: ["food", "social"] },
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
/** Is a moment inside an event's season (Lagos date)? */
function inSeason(e: CityEvent, at: Date) {
  if (!e.season) return true;
  const md = new Date(at.getTime() + 3_600_000).toISOString().slice(5, 10);
  const [from, to] = e.season;
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

export function isEventOn(e: CityEvent, at: Date) {
  if (!inSeason(e, at) && !inSeason(e, new Date(at.getTime() - 12 * 3_600_000))) return false;
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
  // Seasonal events show only when they're on or start within the week.
  const out = EVENTS.filter((e) => !e.season || [0, 1, 2, 3, 4, 5, 6, 7].some((d) => inSeason(e, new Date(at.getTime() + d * 86_400_000)))).map((e) => {
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

/** Play nights: a prize for each table game you win there (a few a night). */
export const PLAY_NIGHT = { winCoins: 500, winsPerNight: 3 };
export const PLAY_NIGHTS = EVENTS.filter((e) => e.playNight);
/** Lagos date (YYYY-MM-DD) of the evening a play night starting at `start` belongs to. */
export const lagosDate = (at: Date) => new Date(at.getTime() + 3_600_000).toISOString().slice(0, 10);
export interface PlayNightView {
  key: string;
  name: string;
  icon: string;
  blurb: string;
  venue: string;
  /** When it starts (now, if on). */
  start: string;
  on: boolean;
  /** Its Lagos date (what "I'm coming" is for). */
  day: string;
  coming: number;
  you: boolean;
  /** Some of the people coming (nicknames). */
  names: string[];
}
