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
 * Every hair style works with both bodies; these orders put the most common choices first in the picker.
 * Outfits: the gowns are cut for the woman's body and the agbada for the man's (on the other body they only
 * showed as painted colour), so each picker leaves those out. Older profiles that have them still load.
 */
export const LOOK_ORDER: Record<BodyType, { hair: string[]; outfit: string[] }> = {
  man: {
    hair: ["low_cut", "buzzcut", "high_top", "curly", "locs", "bald", "cap", "puff", "braids", "bob", "gele"],
    outfit: ["agbada_white", "kaftan_gold", "ankara_green", "jersey_red", "tee_blue", "hoodie_black"],
  },
  woman: {
    hair: ["braids", "puff", "bob", "gele", "curly", "locs", "low_cut", "high_top", "buzzcut", "bald", "cap"],
    outfit: ["buba_wrapper", "peplum_coral", "ankara_green", "kaftan_gold", "tee_blue", "jersey_red", "hoodie_black"],
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
  /** Fabric colour for the outfit (from OUTFIT_COLORS); missing means the outfit's own colour. */
  outfitColor?: string;
  /** Hair colour (HAIR_COLORS), or the fabric colour of a gele or cap (OUTFIT_COLORS); missing means the default. */
  hairColor?: string;
}

/** Fabric dyes every outfit can be worn in: the wax-print and aso-oke colours people actually wear. */
export const OUTFIT_COLORS = [
  { hex: "#0f7b6c", label: "Teal" },
  { hex: "#1e7a46", label: "Green" },
  { hex: "#1f2a6b", label: "Indigo" },
  { hex: "#2f5fb3", label: "Royal blue" },
  { hex: "#5b2a86", label: "Purple" },
  { hex: "#7a1f3d", label: "Wine" },
  { hex: "#c8321e", label: "Red" },
  { hex: "#e4572e", label: "Coral" },
  { hex: "#e88a1a", label: "Orange" },
  { hex: "#f2b705", label: "Gold" },
  { hex: "#e985b5", label: "Pink" },
  { hex: "#ece6d6", label: "Cream" },
  { hex: "#f4f4f2", label: "White" },
  { hex: "#8a8f98", label: "Grey" },
  { hex: "#25282b", label: "Black" },
] as const;

/** Natural and dyed hair. */
export const HAIR_COLORS = [
  { hex: "#1b1410", label: "Black" },
  { hex: "#3b2417", label: "Dark brown" },
  { hex: "#6b3a1f", label: "Brown" },
  { hex: "#8c2f1d", label: "Auburn" },
  { hex: "#6d1830", label: "Burgundy" },
  { hex: "#c99a4a", label: "Honey blonde" },
  { hex: "#9a9a9a", label: "Grey" },
] as const;

/** Styles that are fabric (wraps and caps): they take an outfit colour instead of a hair colour. */
export const FABRIC_HAIR = new Set(["gele", "cap"]);
const OUTFIT_COLOR_SET = new Set<string>(OUTFIT_COLORS.map((c) => c.hex));
const HAIR_COLOR_SET = new Set<string>(HAIR_COLORS.map((c) => c.hex));

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
    (AVATAR_OPTIONS.outfit as readonly unknown[]).includes(v.outfit) &&
    (v.outfitColor === undefined || OUTFIT_COLOR_SET.has(v.outfitColor as string)) &&
    (v.hairColor === undefined || HAIR_COLOR_SET.has(v.hairColor as string) || OUTFIT_COLOR_SET.has(v.hairColor as string))
  );
}

/** Only the known avatar fields (what gets stored), so nothing extra rides along in the profile. */
export function cleanAvatar(v: AvatarConfig): AvatarConfig {
  return {
    ...(v.body ? { body: v.body } : {}),
    skinTone: v.skinTone,
    hairStyle: v.hairStyle,
    outfit: v.outfit,
    ...(v.outfitColor ? { outfitColor: v.outfitColor } : {}),
    ...(v.hairColor ? { hairColor: v.hairColor } : {}),
  };
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
