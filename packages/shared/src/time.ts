// Calendar helpers anchored to the configured game timezone (default Africa/Lagos).

export const DEFAULT_GAME_TIMEZONE = "Africa/Lagos";

/** Returns the calendar day (YYYY-MM-DD) for `at` in the given IANA timezone. */
export function dayKey(at: Date, timeZone: string = DEFAULT_GAME_TIMEZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
