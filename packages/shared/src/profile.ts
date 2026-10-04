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
  // Deep to light: the first six are the original tones (indexes stay put; DEFAULT_AVATAR uses [2]); then olive and
  // South Asian browns and lighter tones, so everyone can find their own.
  skinTone: ["#3b2219", "#5a3825", "#6b4226", "#8d5524", "#a86b3c", "#c68642", "#b98a5e", "#d8a47f", "#e9bf9d", "#f3d7c3"],
  hairStyle: [
    "low_cut", "buzzcut", "high_top", "curly", "puff", "braids", "bob", "locs", "gele", "bald", "cap",
    "straight", "wavy", "ponytail", "bun", "side_part", "long_straight", "hijab",
  ],
  outfit: [
    "ankara_green", "agbada_white", "kaftan_gold", "buba_wrapper", "peplum_coral", "jersey_red", "tee_blue", "hoodie_black",
    "suit", "jeans_jacket", "summer_dress", "abaya", "kente", "boubou", "kurta", "salwar_kameez", "saree",
  ],
} as const;

/** Skin tones in the order the picker shows them (deep to light). */
export const SKIN_ORDER: readonly string[] = ["#3b2219", "#5a3825", "#6b4226", "#8d5524", "#a86b3c", "#b98a5e", "#c68642", "#d8a47f", "#e9bf9d", "#f3d7c3"];

export type BodyType = (typeof AVATAR_OPTIONS.body)[number];

/**
 * Every hair style works with both bodies; these orders put the most common choices first in the picker.
 * Outfits: the gowns are cut for the woman's body and the agbada for the man's (on the other body they only
 * showed as painted colour), so each picker leaves those out. Older profiles that have them still load.
 */
export const LOOK_ORDER: Record<BodyType, { hair: string[]; outfit: string[] }> = {
  man: {
    hair: ["low_cut", "buzzcut", "high_top", "curly", "locs", "bald", "cap", "straight", "side_part", "wavy", "puff", "braids", "bob", "ponytail", "bun", "long_straight", "gele"],
    outfit: ["agbada_white", "kaftan_gold", "ankara_green", "jersey_red", "tee_blue", "hoodie_black", "suit", "jeans_jacket", "kente", "boubou", "kurta"],
  },
  woman: {
    hair: ["braids", "puff", "bob", "gele", "hijab", "curly", "locs", "long_straight", "straight", "wavy", "ponytail", "bun", "side_part", "low_cut", "high_top", "buzzcut", "bald", "cap"],
    outfit: [
      "buba_wrapper", "peplum_coral", "ankara_green", "kaftan_gold", "tee_blue", "jersey_red", "hoodie_black",
      "suit", "jeans_jacket", "summer_dress", "abaya", "kente", "boubou", "salwar_kameez", "saree",
    ],
  },
};

/** Each outfit's own colour (the fabric when no outfitColor is picked) and its name in the picker. */
export const OUTFIT_INFO: Record<string, { color: string; label: string }> = {
  ankara_green: { color: "#1e7a46", label: "Ankara green" },
  agbada_white: { color: "#ece6d6", label: "Agbada white" },
  jersey_red: { color: "#c8321e", label: "Jersey red" },
  tee_blue: { color: "#1f2a6b", label: "Indigo tee" },
  kaftan_gold: { color: "#f2b705", label: "Kaftan gold" },
  hoodie_black: { color: "#25282b", label: "Black hoodie" },
  buba_wrapper: { color: "#0f7b6c", label: "Buba & wrapper" },
  peplum_coral: { color: "#e4572e", label: "Coral peplum" },
  suit: { color: "#1f2a6b", label: "Business suit" },
  jeans_jacket: { color: "#4b5a2a", label: "Jeans & jacket" },
  summer_dress: { color: "#e985b5", label: "Summer dress" },
  abaya: { color: "#25282b", label: "Abaya" },
  kente: { color: "#f2b705", label: "Kente" },
  boubou: { color: "#2f5fb3", label: "Boubou" },
  kurta: { color: "#f4f4f2", label: "Kurta" },
  salwar_kameez: { color: "#0f7b6c", label: "Salwar kameez" },
  saree: { color: "#c8321e", label: "Saree" },
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
  { hex: "#2a1a12", label: "Black-brown" },
  { hex: "#e0bc6a", label: "Blonde" },
  { hex: "#a5461c", label: "Copper" },
  { hex: "#d8d8d4", label: "Silver" },
] as const;

/** Styles that are fabric (wraps and caps): they take an outfit colour instead of a hair colour. */
export const FABRIC_HAIR = new Set(["gele", "cap", "hijab"]);
/** The fabric colour of a wrap or cap when none is picked. */
export const FABRIC_HAIR_DEFAULT: Record<string, string> = { gele: "#f2b705", cap: "#c8321e", hijab: "#7a1f3d" };
const OUTFIT_COLOR_SET = new Set<string>(OUTFIT_COLORS.map((c) => c.hex));
const HAIR_COLOR_SET = new Set<string>(HAIR_COLORS.map((c) => c.hex));

export const bodyOf = (a: AvatarConfig): BodyType => (a.body === "woman" ? "woman" : "man");

export const DEFAULT_AVATAR: AvatarConfig = {
  skinTone: AVATAR_OPTIONS.skinTone[2],
  hairStyle: AVATAR_OPTIONS.hairStyle[0],
  outfit: AVATAR_OPTIONS.outfit[0],
};

/**
 * A varied, valid look from a number (the same seed always gives the same look): for game characters such as a
 * partner, drawn with the layered sprites. Any skin tone, a hair style and outfit from that body's picker, and often
 * a fabric or hair colour of their own.
 */
export function lookFromSeed(seed: number, body?: BodyType): AvatarConfig {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const b: BodyType = body ?? (rnd() < 0.5 ? "man" : "woman");
  // the first few of each picker are the commonest choices: favour them
  const favour = (xs: readonly string[]) => (rnd() < 0.6 ? xs[Math.floor(rnd() * Math.min(5, xs.length))]! : pick(xs));
  const hairStyle = favour(LOOK_ORDER[b].hair.filter((h) => (b === "man" ? !["gele", "hijab", "bob", "ponytail", "bun"].includes(h) : true)));
  const outfit = favour(LOOK_ORDER[b].outfit);
  const look: AvatarConfig = { body: b, skinTone: pick(AVATAR_OPTIONS.skinTone), hairStyle, outfit };
  if (rnd() < 0.6) look.outfitColor = pick(OUTFIT_COLORS).hex;
  if (hairStyle !== "bald" && rnd() < 0.5) look.hairColor = FABRIC_HAIR.has(hairStyle) ? pick(OUTFIT_COLORS).hex : pick(HAIR_COLORS).hex;
  return look;
}

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
