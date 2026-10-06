// Love life with people in the city (NPCs for now; real players later). You meet someone where they hang out, get
// closer by chatting, gifts and dates, then ask them out, move in together, and marry at an owambe. One partner at a
// time; friends as many as you like. Kept warm and non-sexual: dates, gists, food, dancing, living together.

import type { AvatarConfig } from "./profile.js";

export type PartnerGender = "man" | "woman";
export type PartnerPref = "men" | "women" | "anyone";
export const PARTNER_PREFS: readonly PartnerPref[] = ["women", "men", "anyone"];
export const PARTNER_PREF_LABEL: Record<PartnerPref, string> = { women: "Women", men: "Men", anyone: "Anyone" };

/** What someone values; chat answers and gifts land better when they match. */
export type Trait = "ambitious" | "fun" | "homely" | "brainy" | "stylish" | "sporty";

export type GiftKey = "flowers" | "chocolate" | "perfume" | "ankara" | "book" | "jersey";
export const GIFTS: readonly { key: GiftKey; label: string; icon: string; cost: number }[] = [
  { key: "flowers", label: "Flowers", icon: "💐", cost: 600 },
  { key: "chocolate", label: "Chin-chin and chocolate", icon: "🍫", cost: 900 },
  { key: "book", label: "A good book", icon: "📚", cost: 1500 },
  { key: "jersey", label: "Football jersey", icon: "⚽", cost: 2500 },
  { key: "ankara", label: "Ankara fabric", icon: "🧵", cost: 3000 },
  { key: "perfume", label: "Perfume", icon: "🌸", cost: 4000 },
];
export const GIFT_BY_KEY: ReadonlyMap<GiftKey, (typeof GIFTS)[number]> = new Map(GIFTS.map((g) => [g.key, g]));

/** Places for a date: what it costs for two, and how much fun it is. */
export const DATE_SPOTS: readonly { venue: string; label: string; icon: string; cost: number; fun: number }[] = [
  { venue: "mama_nkechi_buka", label: "Amala at the buka", icon: "🍲", cost: 1500, fun: 10 },
  { venue: "mallam_suya", label: "Suya under the stars", icon: "🍢", cost: 1200, fun: 10 },
  { venue: "viewing_centre", label: "Watch the match together", icon: "📺", cost: 1000, fun: 12 },
  { venue: "sandbar_beach", label: "A walk on the beach", icon: "🏖️", cost: 3500, fun: 16 },
  { venue: "crown_arts_theatre", label: "A play at the theatre", icon: "🎭", cost: 4000, fun: 16 },
  { venue: "skyline_lounge", label: "Dancing at the lounge", icon: "💃🏾", cost: 6000, fun: 20 },
  { venue: "lagoon_boat_cruise", label: "Boat cruise on the lagoon", icon: "🛥️", cost: 8000, fun: 22 },
  { venue: "capital_lights_lounge", label: "A night out in Abuja", icon: "🌃", cost: 7000, fun: 20 },
];
export const DATE_SPOT_BY_VENUE: ReadonlyMap<string, (typeof DATE_SPOTS)[number]> = new Map(DATE_SPOTS.map((d) => [d.venue, d]));

export interface Npc {
  key: string;
  name: string;
  gender: PartnerGender;
  age: number;
  job: string;
  bio: string;
  avatar: AvatarConfig;
  /** Venue keys where you can meet them. */
  hangouts: readonly string[];
  traits: readonly Trait[];
  likes: readonly GiftKey[];
  /** Their favourite date (a DATE_SPOTS venue): counts extra. */
  favDate: string;
}

export const NPCS: readonly Npc[] = [
  {
    key: "adaeze",
    name: "Adaeze",
    gender: "woman",
    age: 27,
    job: "Fashion designer",
    bio: "Runs a small label from Tailors Row. Loves owambe colours and a good laugh.",
    avatar: { body: "woman", skinTone: "#8d5524", hairStyle: "braids", outfit: "peplum_coral", outfitColor: "#7a1f3d" },
    hangouts: ["tailors_row", "glory_hair_salon"],
    traits: ["stylish", "ambitious"],
    likes: ["ankara", "perfume"],
    favDate: "skyline_lounge",
  },
  {
    key: "tunde",
    name: "Tunde",
    gender: "man",
    age: 29,
    job: "Software developer",
    bio: "Builds apps by day, plays FIFA by night. Will talk tech till morning.",
    avatar: { body: "man", skinTone: "#5a3825", hairStyle: "high_top", outfit: "hoodie_black" },
    hangouts: ["gadget_village", "lampnet_academy"],
    traits: ["brainy", "fun"],
    likes: ["jersey", "book"],
    favDate: "viewing_centre",
  },
  {
    key: "zainab",
    name: "Zainab",
    gender: "woman",
    age: 26,
    job: "Nurse",
    bio: "Works long shifts at the General Hospital. Calm, caring, loves suya after work.",
    avatar: { body: "woman", skinTone: "#6b4226", hairStyle: "gele", outfit: "buba_wrapper", outfitColor: "#0f7b6c" },
    hangouts: ["general_hospital", "mallam_suya"],
    traits: ["homely", "brainy"],
    likes: ["flowers", "chocolate"],
    favDate: "mallam_suya",
  },
  {
    key: "emeka",
    name: "Emeka",
    gender: "man",
    age: 31,
    job: "Car dealer",
    bio: "Sells cars at Island Motors. Big dreams, bigger laugh, always well dressed.",
    avatar: { body: "man", skinTone: "#8d5524", hairStyle: "low_cut", outfit: "suit", outfitColor: "#25282b" },
    hangouts: ["island_motors", "skyline_lounge"],
    traits: ["ambitious", "stylish"],
    likes: ["perfume", "ankara"],
    favDate: "lagoon_boat_cruise",
  },
  {
    key: "priya",
    name: "Priya",
    gender: "woman",
    age: 28,
    job: "Teacher",
    bio: "Born and raised in Lagos to an Indian family. Teaches at the Academy, reads everything, dances anywhere.",
    avatar: { body: "woman", skinTone: "#b98a5e", hairStyle: "long_straight", outfit: "saree", outfitColor: "#5b2a86" },
    hangouts: ["lampnet_academy", "city_library"],
    traits: ["brainy", "fun"],
    likes: ["book", "flowers"],
    favDate: "crown_arts_theatre",
  },
  {
    key: "segun",
    name: "Segun",
    gender: "man",
    age: 28,
    job: "Fitness coach",
    bio: "Trains people at Fit Lagos and boxes at Ring Kings. Early riser, jollof lover.",
    avatar: { body: "man", skinTone: "#3b2219", hairStyle: "buzzcut", outfit: "jersey_red" },
    hangouts: ["fit_lagos", "ring_kings_boxing"],
    traits: ["sporty", "homely"],
    likes: ["jersey", "chocolate"],
    favDate: "sandbar_beach",
  },
  {
    key: "funmi",
    name: "Funmi",
    gender: "woman",
    age: 30,
    job: "Radio presenter",
    bio: "The voice of the City FM morning show. Knows every gist in Lagos first.",
    avatar: { body: "woman", skinTone: "#a86b3c", hairStyle: "puff", outfit: "summer_dress", outfitColor: "#f2b705" },
    hangouts: ["city_fm", "sandbar_beach"],
    traits: ["fun", "stylish"],
    likes: ["perfume", "chocolate"],
    favDate: "skyline_lounge",
  },
  {
    key: "tom",
    name: "Tom",
    gender: "man",
    age: 32,
    job: "Engineer",
    bio: "Came from abroad for a bridge project and stayed for the food. Learning Yoruba, badly.",
    avatar: { body: "man", skinTone: "#e9bf9d", hairStyle: "side_part", hairColor: "#c99a4a", outfit: "jeans_jacket" },
    hangouts: ["grand_lagoon_hotel", "lagoon_golf_club"],
    traits: ["brainy", "sporty"],
    likes: ["book", "jersey"],
    favDate: "lagoon_boat_cruise",
  },
  {
    key: "hauwa",
    name: "Hauwa",
    gender: "woman",
    age: 29,
    job: "Civil servant",
    bio: "Works at the Federal Secretariat in Abuja. Neat, funny and very serious about polo.",
    avatar: { body: "woman", skinTone: "#8d5524", hairStyle: "hijab", outfit: "abaya", outfitColor: "#1f2a6b", hairColor: "#ece6d6" },
    hangouts: ["abuja_secretariat", "capital_polo_club"],
    traits: ["ambitious", "homely"],
    likes: ["ankara", "flowers"],
    favDate: "capital_lights_lounge",
  },
  {
    key: "dayo",
    name: "Dayo",
    gender: "man",
    age: 27,
    job: "Musician",
    bio: "Plays keys at owambes and the lounge. Writes songs about danfo drivers.",
    avatar: { body: "man", skinTone: "#6b4226", hairStyle: "locs", outfit: "kente" },
    hangouts: ["skyline_lounge", "royal_event_centre"],
    traits: ["fun", "stylish"],
    likes: ["chocolate", "perfume"],
    favDate: "skyline_lounge",
  },
];
export const NPC_BY_KEY: ReadonlyMap<string, Npc> = new Map(NPCS.map((n) => [n.key, n]));

/** Who you'd meet at a place, by your preference. */
export function npcsAt(venue: string, pref: PartnerPref): Npc[] {
  return NPCS.filter((n) => n.hangouts.includes(venue) && (pref === "anyone" || (pref === "women") === (n.gender === "woman")));
}

export type BondStage = "met" | "friends" | "dating" | "living" | "engaged" | "married";
export const STAGE_LABEL: Record<BondStage, string> = {
  met: "Just met",
  friends: "Friends",
  dating: "Dating",
  living: "Living together",
  engaged: "Engaged",
  married: "Married",
};
/** Closeness (0-100) you need for each step. */
export const NEED = { friends: 20, askOut: 45, moveIn: 75, propose: 92 } as const;
export const WEDDING = { cost: 50_000, xp: 200 };
/** Closeness gains. */
export const GAIN = { chatLiked: 6, chatOk: 3, chatMeh: 1, giftLiked: 10, gift: 5, date: 12, dateFav: 18 };
/** Chats that count per person per Lagos day; one gift a day; a date every few hours. */
export const CHATS_PER_DAY = 3;
export const DATE_EVERY_HOURS = 6;
/** Neglect: after this many days without contact, closeness slips a point a day (never below "friends"). */
export const DRIFT_AFTER_DAYS = 3;
/** Living together: extra Social each time you sleep at home. */
export const HOME_SOCIAL = 10;

export interface ChatPrompt {
  say: string;
  answers: readonly { text: string; trait: Trait | null }[];
}
/** What they bring up; each answer suits a kind of person. */
export const CHAT_PROMPTS: readonly ChatPrompt[] = [
  {
    say: "If you had a free Saturday, what would you do?",
    answers: [
      { text: "Work on my hustle. Money no dey sleep.", trait: "ambitious" },
      { text: "Owambe, then the beach, then suya!", trait: "fun" },
      { text: "Cook a big pot of soup and rest at home.", trait: "homely" },
    ],
  },
  {
    say: "What's the best thing about Lagos?",
    answers: [
      { text: "The fashion. Everybody dey slay.", trait: "stylish" },
      { text: "The energy. Nobody dey sleep for this city.", trait: "fun" },
      { text: "The opportunities. Anybody fit blow.", trait: "ambitious" },
    ],
  },
  {
    say: "I just finished a really good book. Do you read?",
    answers: [
      { text: "Yes! Tell me about it.", trait: "brainy" },
      { text: "I prefer football highlights, to be honest.", trait: "sporty" },
      { text: "Only the price list at the market.", trait: null },
    ],
  },
  {
    say: "Did you watch the match last night?",
    answers: [
      { text: "Of course! That last goal ehn!", trait: "sporty" },
      { text: "No, I was at a party. Who won?", trait: "fun" },
      { text: "I was working late. Busy week.", trait: "ambitious" },
    ],
  },
  {
    say: "What do you think of my outfit today?",
    answers: [
      { text: "You look sharp. The colours are perfect.", trait: "stylish" },
      { text: "Fine, but you'd look good in anything.", trait: "homely" },
      { text: "Is that new? Where did you buy it?", trait: null },
    ],
  },
  {
    say: "Jollof or fried rice?",
    answers: [
      { text: "Jollof, with plantain. No debate.", trait: "homely" },
      { text: "Whichever one has more chicken.", trait: "fun" },
      { text: "Fried rice, then a long run to burn it.", trait: "sporty" },
    ],
  },
  {
    say: "Where do you see yourself in five years?",
    answers: [
      { text: "Owning my own business, maybe two.", trait: "ambitious" },
      { text: "With a family, in a house full of laughter.", trait: "homely" },
      { text: "Still learning. Maybe a master's degree.", trait: "brainy" },
    ],
  },
  {
    say: "I'm thinking of getting my hair done. Any ideas?",
    answers: [
      { text: "Go bold. You can carry any style.", trait: "stylish" },
      { text: "Something easy, so we can go swimming.", trait: "sporty" },
      { text: "Whatever makes you happy.", trait: "homely" },
    ],
  },
  {
    say: "Tell me something nobody knows about you.",
    answers: [
      { text: "I can solve a Rubik's cube in a minute.", trait: "brainy" },
      { text: "I dance in my room when nobody is looking.", trait: "fun" },
      { text: "I save half of everything I earn.", trait: "ambitious" },
    ],
  },
  {
    say: "Traffic was terrible today. How was your day?",
    answers: [
      { text: "Long, but I closed a big deal!", trait: "ambitious" },
      { text: "I walked half the way. Good exercise.", trait: "sporty" },
      { text: "Better now that I'm talking to you.", trait: "homely" },
    ],
  },
  {
    say: "If we went on holiday, where would we go?",
    answers: [
      { text: "Somewhere with museums and old buildings.", trait: "brainy" },
      { text: "Anywhere with good shopping.", trait: "stylish" },
      { text: "A beach with loud music.", trait: "fun" },
    ],
  },
  {
    say: "What's your favourite way to relax?",
    answers: [
      { text: "A gym session, then a cold drink.", trait: "sporty" },
      { text: "A film at home with snacks.", trait: "homely" },
      { text: "A podcast about business.", trait: "ambitious" },
    ],
  },
];
/** The next thing they bring up (by how many chats you've had). */
export const chatPromptFor = (npcKey: string, chats: number): ChatPrompt => {
  let h = 0;
  for (const c of npcKey) h = (h * 31 + c.charCodeAt(0)) % 997;
  return CHAT_PROMPTS[(h + chats * 5) % CHAT_PROMPTS.length]!;
};
export const chatGain = (npc: Npc, trait: Trait | null) => (trait && npc.traits[0] === trait ? GAIN.chatLiked : trait && npc.traits.includes(trait) ? GAIN.chatOk + 1 : trait ? GAIN.chatOk : GAIN.chatMeh);

/** Your bond with someone, for the app. */
export interface BondView {
  npc: string;
  stage: BondStage;
  closeness: number;
  /** Chats today that still count. */
  chatsLeft: number;
  giftToday: boolean;
  /** When the next date counts (ISO), or null now. */
  dateAt: string | null;
  /** The thing they'll bring up next time you chat. */
  prompt: ChatPrompt;
  /** What you can do next (the server allows exactly these). */
  can: { askOut: boolean; moveIn: boolean; propose: boolean; wedding: boolean };
}
export interface LoveView {
  pref: PartnerPref | null;
  bonds: BondView[];
  /** Your partner (dating or more), if any. */
  partner: string | null;
}

/** Stages from "dating" up count as being together. */
export const together = (s: BondStage) => s === "dating" || s === "living" || s === "engaged" || s === "married";
