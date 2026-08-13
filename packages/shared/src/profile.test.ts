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

describe("avatar colours", () => {
  it("accepts palette colours and drops unknown fields", async () => {
    const { cleanAvatar } = await import("./profile.js");
    expect(isValidAvatar({ ...DEFAULT_AVATAR, outfitColor: "#5b2a86", hairColor: "#8c2f1d" })).toBe(true);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, hairStyle: "gele", hairColor: "#f2b705" })).toBe(true);
    expect(isValidAvatar({ ...DEFAULT_AVATAR, outfitColor: "#123456" })).toBe(false);
    expect(cleanAvatar({ ...DEFAULT_AVATAR, outfitColor: "#5b2a86", extra: "x" } as never)).toEqual({ ...DEFAULT_AVATAR, outfitColor: "#5b2a86" });
  });
});
