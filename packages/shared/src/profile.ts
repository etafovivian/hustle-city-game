// Nickname and avatar rules shared by client (instant feedback) and server (authority).

export const LOCATIONS = [
  { key: "market_square", name: "Market Square", blurb: "Run your shop and browse real merchants." },
  { key: "work_hub", name: "Work Hub", blurb: "Digital jobs, applications and earnings history." },
  { key: "hangout", name: "The Hangout", blurb: "Friends, clubs and weekly standings." },
] as const;

export type LocationKey = (typeof LOCATIONS)[number]["key"];
export const LOCATION_KEYS: readonly string[] = LOCATIONS.map((l) => l.key);

export const AVATAR_OPTIONS = {
  body: ["man", "woman"],
  skinTone: ["#3b2219", "#5a3825", "#6b4226", "#8d5524", "#a86b3c", "#c68642"],
  hairStyle: ["low_cut", "buzzcut", "high_top", "curly", "puff", "braids", "bob", "locs", "gele", "bald", "cap"],
  outfit: ["ankara_green", "agbada_white", "kaftan_gold", "buba_wrapper", "peplum_coral", "jersey_red", "tee_blue", "hoodie_black"],
} as const;

export type BodyType = (typeof AVATAR_OPTIONS.body)[number];

/**
 * Every hair style and outfit works with both bodies; these orders just put the most common
 * choices for each body first in the picker.
 */
export const LOOK_ORDER: Record<BodyType, { hair: string[]; outfit: string[] }> = {
  man: {
    hair: ["low_cut", "buzzcut", "high_top", "curly", "locs", "bald", "cap", "puff", "braids", "bob", "gele"],
    outfit: ["agbada_white", "kaftan_gold", "ankara_green", "jersey_red", "tee_blue", "hoodie_black", "buba_wrapper", "peplum_coral"],
  },
  woman: {
    hair: ["braids", "puff", "bob", "gele", "curly", "locs", "low_cut", "high_top", "buzzcut", "bald", "cap"],
    outfit: ["buba_wrapper", "peplum_coral", "ankara_green", "kaftan_gold", "tee_blue", "jersey_red", "hoodie_black", "agbada_white"],
  },
};

/** Earlier hair keys still stored on some profiles, mapped to their current equivalent. */
export const LEGACY_HAIR: Record<string, string> = { afro: "high_top", headwrap: "gele" };

export interface AvatarConfig {
  /** Missing on profiles made before body choice existed; treated as "man". */
  body?: BodyType;
  skinTone: string;
  hairStyle: string;
  outfit: string;
}

export const bodyOf = (a: AvatarConfig): BodyType => (a.body === "woman" ? "woman" : "man");

export const DEFAULT_AVATAR: AvatarConfig = {
  skinTone: AVATAR_OPTIONS.skinTone[2],
  hairStyle: AVATAR_OPTIONS.hairStyle[0],
  outfit: AVATAR_OPTIONS.outfit[0],
};

export function isValidAvatar(value: unknown): value is AvatarConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.body === undefined || (AVATAR_OPTIONS.body as readonly unknown[]).includes(v.body)) &&
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
