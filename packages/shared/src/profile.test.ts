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
  });
});
