import { describe, expect, it } from "vitest";
import { CHAT_PROMPTS, DATE_SPOTS, NPCS, chatPromptFor, npcsAt } from "./partners.js";
import { AVATAR_OPTIONS, OUTFIT_COLORS, isValidAvatar } from "./profile.js";
import { VENUES_BY_KEY } from "./venues.js";

describe("love life people", () => {
  it("hang out and date at real places, in looks the game can draw", () => {
    for (const n of NPCS) {
      for (const v of n.hangouts) expect(VENUES_BY_KEY.has(v), `${n.key} at ${v}`).toBe(true);
      expect(DATE_SPOTS.some((d) => d.venue === n.favDate), n.key).toBe(true);
      expect(isValidAvatar(n.avatar), n.key).toBe(true);
      expect(AVATAR_OPTIONS.hairStyle).toContain(n.avatar.hairStyle);
      expect(AVATAR_OPTIONS.outfit).toContain(n.avatar.outfit);
      expect(AVATAR_OPTIONS.skinTone).toContain(n.avatar.skinTone);
      if (n.avatar.outfitColor) expect(OUTFIT_COLORS.map((c) => c.hex)).toContain(n.avatar.outfitColor);
    }
    for (const d of DATE_SPOTS) expect(VENUES_BY_KEY.has(d.venue), d.venue).toBe(true);
  });
  it("show people by your preference, and vary what they talk about", () => {
    expect(npcsAt("skyline_lounge", "women")).toEqual([]);
    expect(npcsAt("skyline_lounge", "men").map((n) => n.key).sort()).toEqual(["dayo", "emeka"]);
    expect(new Set([0, 1, 2, 3, 4].map((i) => chatPromptFor("adaeze", i).say)).size).toBe(5);
    expect(CHAT_PROMPTS.every((p) => p.answers.length === 3)).toBe(true);
  });
});
