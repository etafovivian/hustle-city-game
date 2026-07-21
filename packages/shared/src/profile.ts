// Nickname and avatar rules shared by client (instant feedback) and server (authority).

export const LOCATIONS = [
  { key: "market_square", name: "Market Square", blurb: "Run your shop and browse real merchants." },
  { key: "work_hub", name: "Work Hub", blurb: "Digital jobs, applications and earnings history." },
  { key: "hangout", name: "The Hangout", blurb: "Friends, clubs and weekly standings." },
] as const;

export type LocationKey = (typeof LOCATIONS)[number]["key"];
export const LOCATION_KEYS: readonly string[] = LOCATIONS.map((l) => l.key);

export const AVATAR_OPTIONS = {
  skinTone: ["#3b2219", "#5a3825", "#6b4226", "#8d5524", "#a86b3c", "#c68642"],
  hairStyle: ["low_cut", "buzzcut", "high_top", "curly", "puff", "locs", "bald", "cap"],
  outfit: ["ankara_green", "agbada_white", "jersey_red", "tee_blue", "kaftan_gold", "hoodie_black"],
} as const;

/** Earlier hair keys still stored on some profiles, mapped to their current equivalent. */
export const LEGACY_HAIR: Record<string, string> = { afro: "high_top", braids: "puff", headwrap: "cap" };

export interface AvatarConfig {
  skinTone: string;
  hairStyle: string;
  outfit: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skinTone: AVATAR_OPTIONS.skinTone[2],
  hairStyle: AVATAR_OPTIONS.hairStyle[0],
  outfit: AVATAR_OPTIONS.outfit[0],
};

export function isValidAvatar(value: unknown): value is AvatarConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (AVATAR_OPTIONS.skinTone as readonly unknown[]).includes(v.skinTone) &&
    (AVATAR_OPTIONS.hairStyle as readonly unknown[]).includes(v.hairStyle) &&
    (AVATAR_OPTIONS.outfit as readonly unknown[]).includes(v.outfit)
  );
}

export const NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

// Small starter blocklist; admins can additionally hide reported names (FR01).
const BLOCKED_FRAGMENTS = ["admin", "moderator", "support", "hustlecity", "official", "paystack"];

export type NicknameCheck = { ok: true } | { ok: false; reason: string };

export function checkNickname(nickname: string): NicknameCheck {
  if (!NICKNAME_PATTERN.test(nickname)) {
    return { ok: false, reason: "Use 3–20 letters, numbers or underscores." };
  }
  const lower = nickname.toLowerCase();
  if (BLOCKED_FRAGMENTS.some((f) => lower.includes(f))) {
    return { ok: false, reason: "That nickname is reserved. Try another." };
  }
  return { ok: true };
}
