import { describe, expect, it } from "vitest";
import { EVENT_BY_KEY, isEventOn } from "./events.js";
import { JOB_BY_VENUE } from "./jobs.js";
import { VENUE_SKILL } from "./skills.js";
import { CHIEF_TITLE, VENUES_BY_KEY, venueActions } from "./venues.js";

describe("the Oba's palace", () => {
  it("has homage, the museum, a photo, a free drum show and the chieftaincy flex", () => {
    const acts = venueActions(VENUES_BY_KEY.get("oba_palace")!);
    expect(acts.map((a) => a.key)).toEqual(["free", "homage", "museum", "photo", "flex"]);
    expect(acts.find((a) => a.kind === "flex")!.cost).toBeGreaterThanOrEqual(200_000);
    expect(CHIEF_TITLE.venue).toBe("oba_palace");
  });
  it("holds its festival on one day a year and palace court every Wednesday", () => {
    const fest = EVENT_BY_KEY.get("white_robes_festival")!;
    expect(isEventOn(fest, new Date("2026-11-20T10:00:00Z"))).toBe(true);
    expect(isEventOn(fest, new Date("2026-11-21T10:00:00Z"))).toBe(false);
    expect(isEventOn(EVENT_BY_KEY.get("palace_court")!, new Date("2026-10-14T11:00:00Z"))).toBe(true); // Wednesday noon
  });
  it("hires guards, drummers and chiefs' aides, training Charisma", () => {
    expect(JOB_BY_VENUE.get("oba_palace")!.titles.slice(0, 3)).toEqual(["Palace guard", "Drummer", "Chief's aide"]);
    expect(VENUE_SKILL.oba_palace).toBe("charisma");
  });
});
