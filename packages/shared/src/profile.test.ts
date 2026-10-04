import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, checkNickname, isValidAvatar } from "./profile.js";

describe("checkNickname", () => {
  it("accepts simple names and rejects bad or reserved ones", () => {
    expect(checkNickname("Ade_Hustler").ok).toBe(true);
    expect(checkNickname("ab").ok).toBe(false);
    expect(checkNickname("bad name!").ok).toBe(false);
    expect(checkNickname("RealAdmin").ok).toBe(false);
  });
});

describe("isValidAvatar", () => {
  it("only accepts known options", () => {
    expect(isValidAvatar(DEFAULT_AVATAR)).toBe(true);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, outfit: "gold_crown" })).toBe(false);
    expect(isValidAvatar(null)).toBe(false);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, body: "woman", hairStyle: "gele", outfit: "buba_wrapper" })).toBe(true);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, body: "man", hairStyle: "braids" })).toBe(true); // any style, any body
    expect(isValidAvatar({ ...DEFAULT_AVATAR, body: "robot" })).toBe(false);
  });
});

describe("new looks", () => {
  it("accepts the new tones, hair and outfits, and the old values still load", async () => {
    const { AVATAR_OPTIONS, LOOK_ORDER, OUTFIT_INFO, SKIN_ORDER } = await import("./profile.js");
    expect(isValidAvatar({ ...DEFAULT_AVATAR, skinTone: "#f3d7c3", body: "woman", hairStyle: "hijab", outfit: "abaya", hairColor: "#0f7b6c" })).toBe(true);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, body: "woman", hairStyle: "long_straight", outfit: "saree", hairColor: "#e0bc6a" })).toBe(true);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, skinTone: "#b98a5e", hairStyle: "side_part", outfit: "suit" })).toBe(true);
    expect(DEFAULT_AVATAR.skinTone).toBe("#6b4226");
    expect([...SKIN_ORDER].sort()).toEqual([...AVATAR_OPTIONS.skinTone].sort());
    for (const b of ["man", "woman"] as const) {
      for (const o of LOOK_ORDER[b].outfit) expect(OUTFIT_INFO[o]).toBeTruthy();
      for (const h of LOOK_ORDER[b].hair) expect(AVATAR_OPTIONS.hairStyle as readonly string[]).toContain(h);
    }
    for (const o of AVATAR_OPTIONS.outfit) expect(OUTFIT_INFO[o]).toBeTruthy();
  });
});

describe("lookFromSeed", () => {
  it("gives varied, valid looks, the same for the same seed", async () => {
    const { lookFromSeed } = await import("./profile.js");
    const looks = Array.from({ length: 200 }, (_, i) => lookFromSeed(i * 7919 + 3));
    for (const l of looks) expect(isValidAvatar(l)).toBe(true);
    expect(lookFromSeed(42)).toEqual(lookFromSeed(42));
    expect(new Set(looks.map((l) => l.skinTone)).size).toBeGreaterThan(6);
    expect(new Set(looks.map((l) => l.outfit)).size).toBeGreaterThan(10);
    expect(lookFromSeed(5, "woman").body).toBe("woman");
  });
});

describe("avatar colours", () => {
  it("accepts palette colours and drops unknown fields", async () => {
    const { cleanAvatar } = await import("./profile.js");
    expect(isValidAvatar({ ...DEFAULT_AVATAR, outfitColor: "#5b2a86", hairColor: "#8c2f1d" })).toBe(true);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, hairStyle: "gele", hairColor: "#f2b705" })).toBe(true);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, outfitColor: "#123456" })).toBe(false);
    expect(cleanAvatar({ ...DEFAULT_AVATAR, outfitColor: "#5b2a86", extra: "x" } as never)).toEqual({ ...DEFAULT_AVATAR, outfitColor: "#5b2a86" });
  });
});
