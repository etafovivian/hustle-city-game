import { describe, expect, it } from "vitest";
import { EVENT_BY_KEY, isEventOn } from "./events.js";
import { GADGETS, cannotBuy, gadgetFloor, phoneTier, repairPrice, REPAIR_PRICE } from "./gadgets.js";
import { JOB_BY_VENUE } from "./jobs.js";
import { VENUE_SKILL } from "./skills.js";
import { VENUES, VENUES_BY_KEY, venueActions } from "./venues.js";

describe("gadget village", () => {
  it("only sells a phone better than yours, and each thing once", () => {
    expect(cannotBuy("phone_mid", [])).toBeNull();
    expect(cannotBuy("phone_mid", ["phone_flagship"])).not.toBeNull();
    expect(cannotBuy("earbuds", ["earbuds"])).not.toBeNull();
    expect(cannotBuy("nonsense", [])).not.toBeNull();
    expect(phoneTier(["phone_mid", "phone_flagship"])).toBe(2);
  });
  it("haggles down to 75-92% of the tag, the same all day for one player", () => {
    for (const g of GADGETS) {
      const f = gadgetFloor("u1", "2026-10-14", g.key)!;
      expect(f).toBeGreaterThanOrEqual(Math.floor(g.price * 0.75));
      expect(f).toBeLessThanOrEqual(Math.ceil(g.price * 0.92));
      expect(gadgetFloor("u1", "2026-10-14", g.key)).toBe(f);
    }
  });
  it("charges for a screen by the phone, parts only with Tech level 3", () => {
    expect(repairPrice(1, 0)).toBe(REPAIR_PRICE[1]);
    expect(repairPrice(1, 3)).toBeLessThan(REPAIR_PRICE[1]);
  });
  it("has the apprentice side hustle, training Tech", () => {
    expect(JOB_BY_VENUE.get("gadget_village")?.titles[0]).toBe("Phone repair apprentice");
    expect(VENUE_SKILL.gadget_village).toBe("tech");
  });
});

describe("landmarks", () => {
  it("each has a free thing to do and paid tickets", () => {
    for (const key of ["crown_arts_theatre", "independence_square", "liberty_arts_park", "gadget_village"]) {
      const kinds = venueActions(VENUES_BY_KEY.get(key)!).map((a) => a.kind);
      expect(kinds).toContain("free");
      expect(kinds).toContain("paid");
    }
  });
  it("venue keys are unique", () => {
    expect(new Set(VENUES.map((v) => v.key)).size).toBe(VENUES.length);
  });
  it("the parade is on 1 October only; premiere night is Friday evening; crusades at the weekend", () => {
    const parade = EVENT_BY_KEY.get("independence_parade")!;
    expect(isEventOn(parade, new Date("2026-10-01T09:00:00Z"))).toBe(true);
    expect(isEventOn(parade, new Date("2026-10-02T09:00:00Z"))).toBe(false);
    expect(isEventOn(EVENT_BY_KEY.get("premiere_night")!, new Date("2026-10-16T19:00:00Z"))).toBe(true); // Fri 8 pm
    const crusade = EVENT_BY_KEY.get("weekend_crusade")!;
    expect(isEventOn(crusade, new Date("2026-10-18T09:00:00Z"))).toBe(true); // Sunday 10 am
    expect(isEventOn(crusade, new Date("2026-10-14T09:00:00Z"))).toBe(false); // Wednesday
  });
});
