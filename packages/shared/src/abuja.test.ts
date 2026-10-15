import { describe, expect, it } from "vitest";
import { EVENT_BY_KEY } from "./events.js";
import { JOB_BY_VENUE } from "./jobs.js";
import { landPrice } from "./land.js";
import { PLOTS_FOR_SALE } from "./plots.gen.js";
import { weeklyRent } from "./rent.js";
import { TRANSIT } from "./rides.js";
import { VENUES_BY_KEY, venueActions } from "./venues.js";

const ABUJA = ["Central Area", "Maitama", "Asokoro", "Wuse", "Garki", "Jabi", "Kubwa"];

describe("Abuja", () => {
  it("has land for sale in every district, Maitama and Asokoro dearest, Kubwa cheapest", () => {
    for (const area of ABUJA) expect(PLOTS_FOR_SALE.some((p) => p[1] === area), area).toBe(true);
    expect(landPrice("Maitama", "local", 54)).toBeGreaterThan(landPrice("Island Heights", "local", 54));
    expect(landPrice("Kubwa", "local", 54)).toBeLessThan(landPrice("Junction 101", "local", 54));
    expect(weeklyRent("rent_flat", "Maitama")).toBeGreaterThan(weeklyRent("rent_flat", "Kubwa") * 3);
  });
  it("has its places, with things to do, jobs at the secretariat, and prayer at the mosque and cathedral", () => {
    for (const key of ["abuja_secretariat", "unity_mosque", "unity_cathedral", "zone5_market", "capital_lights_lounge", "capital_polo_club", "lakeview_mall", "jabi_lakeside_park"]) {
      const v = VENUES_BY_KEY.get(key)!;
      expect(v, key).toBeDefined();
      expect(venueActions(v).some((a) => a.kind === "paid")).toBe(true);
    }
    expect(JOB_BY_VENUE.get("abuja_secretariat")).toBeDefined();
    expect(EVENT_BY_KEY.get("jumuah")!.venues).toContain("unity_mosque");
    expect(EVENT_BY_KEY.get("sunday_service")!.venues).toContain("unity_cathedral");
  });
  it("is a flight away", () => {
    expect(TRANSIT.flight.base).toBeGreaterThan(0);
  });
});
