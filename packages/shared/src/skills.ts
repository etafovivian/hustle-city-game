// Skills: Charisma, Fitness, Cooking, Tech and Business grow with what you do (activities at matching places,
// shifts at matching jobs, university lectures) and pay off in play: better odds with the area boys and better pay
// at jobs that use the skill. Levels 0-10, from skill points (level 1 at 40 points, 5 at 1,000, 10 at 4,000).

export type SkillKey = "charisma" | "fitness" | "cooking" | "tech" | "business";
export interface Skill {
  key: SkillKey;
  label: string;
  icon: string;
  /** What it does for you. */
  perk: string;
  /** How to grow it. */
  grow: string;
}
export const SKILLS: readonly Skill[] = [
  { key: "charisma", label: "Charisma", icon: "🗣️", perk: "Talk your way past the area boys; more pay at lounges, barbers and events", grow: "Lounges, owambes, barbers and salons, snooker, Mass Communication" },
  { key: "fitness", label: "Fitness", icon: "💪", perk: "Outrun the area boys; more pay at the gym, stadium and beach", grow: "The gym, the stadium, swimming, golf" },
  { key: "cooking", label: "Cooking", icon: "🍳", perk: "More pay at the buka and the suya spot", grow: "Eat and work at the buka and suya spots" },
  { key: "tech", label: "Tech", icon: "💻", perk: "More pay at the academy, the radio station, the library and Gadget Village; fix your own cracked screen from level 3", grow: "The Academy, Computer Science, the library, phone repairs at Gadget Village" },
  { key: "business", label: "Business", icon: "📈", perk: "More pay at the bank, market, showroom and hotel", grow: "Balogun Market, the bank, Business Administration and Law" },
];
export const SKILL_BY_KEY: ReadonlyMap<SkillKey, Skill> = new Map(SKILLS.map((s) => [s.key, s]));

/** Which skill each place trains (and which its job pays more for). */
export const VENUE_SKILL: Readonly<Record<string, SkillKey>> = {
  skyline_lounge: "charisma",
  royal_event_centre: "charisma",
  oga_snooker: "charisma",
  viewing_centre: "charisma",
  sharp_cuts: "charisma",
  glory_hair_salon: "charisma",
  city_fm: "tech",
  fit_lagos: "fitness",
  ring_kings_boxing: "fitness",
  city_stadium: "fitness",
  sandbar_beach: "fitness",
  lagoon_golf_club: "fitness",
  general_hospital: "fitness",
  mama_nkechi_buka: "cooking",
  mallam_suya: "cooking",
  lampnet_academy: "tech",
  city_library: "tech",
  lagoon_city_university: "tech",
  lagoon_capital_bank: "business",
  balogun_market: "business",
  island_motors: "business",
  grand_lagoon_hotel: "business",
  high_court: "business",
  tailors_row: "business",
  junction_motor_park: "business",
  lagoon_boat_cruise: "charisma",
  crown_arts_theatre: "charisma",
  independence_square: "charisma",
  liberty_arts_park: "charisma",
  gadget_village: "tech",
  abuja_secretariat: "business",
  zone5_market: "business",
  capital_lights_lounge: "charisma",
  capital_polo_club: "fitness",
  lakeview_mall: "business",
  jabi_lakeside_park: "fitness",
};
/** University programmes train their own skill. */
export const PROGRAMME_SKILL: Readonly<Record<string, SkillKey>> = { computer_science: "tech", business_admin: "business", mass_comm: "charisma", law: "business" };

/** Points per thing done. */
export const SKILL_POINTS = { activity: 6, flex: 12, shift: 10, lecture: 15 };
export const MAX_SKILL = 10;
export const skillLevel = (points: number) => Math.min(MAX_SKILL, Math.floor(Math.sqrt(Math.max(0, points) / 40)));
/** Points needed for a level. */
export const pointsFor = (level: number) => level * level * 40;

/** Area-boy odds: +3 points of chance per level of the skill each way out uses. */
export const SKILL_ODDS = 0.03;
/** Shift pay: +4% per level of the job's skill. */
export const SKILL_PAY = 0.04;

export type SkillsView = Record<SkillKey, { points: number; level: number }>;
export function skillsView(points: Partial<Record<SkillKey, number>>): SkillsView {
  return Object.fromEntries(SKILLS.map((s) => [s.key, { points: points[s.key] ?? 0, level: skillLevel(points[s.key] ?? 0) }])) as SkillsView;
}
