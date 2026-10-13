// Pets: adopt one (a dog, a cat or an African grey parrot), name it, feed it, play with it and take it for walks.
// It follows you about the city and lives in your rooms. A happy pet lifts your Social when you sleep at home;
// a neglected one gets sad, but never dies or runs away: this is a kind game.

export type PetKind = "dog_local" | "boerboel" | "shepherd" | "lhasa" | "cat_tabby" | "cat_black" | "parrot";
export interface PetInfo {
  kind: PetKind;
  label: string;
  species: "dog" | "cat" | "parrot";
  icon: string;
  cost: number;
  note: string;
}
export const PETS: readonly PetInfo[] = [
  { kind: "dog_local", label: "Local dog (Ekuke)", species: "dog", icon: "🐕", cost: 15_000, note: "Loyal, clever and never sick" },
  { kind: "lhasa", label: "Lhasa Apso", species: "dog", icon: "🐩", cost: 60_000, note: "Small, fluffy and proud" },
  { kind: "boerboel", label: "Boerboel", species: "dog", icon: "🐕‍🦺", cost: 80_000, note: "A big gentle guard for the gate" },
  { kind: "shepherd", label: "German Shepherd", species: "dog", icon: "🐕‍🦺", cost: 120_000, note: "Smart, brave, the estate's pride" },
  { kind: "cat_tabby", label: "Tabby cat", species: "cat", icon: "🐈", cost: 10_000, note: "Purrs on your lap, keeps the rats away" },
  { kind: "cat_black", label: "Black cat", species: "cat", icon: "🐈‍⬛", cost: 10_000, note: "Sleek, quiet, very independent" },
  { kind: "parrot", label: "African grey parrot", species: "parrot", icon: "🦜", cost: 90_000, note: "Talks back, learns your name" },
];
export const PET_BY_KIND: ReadonlyMap<string, PetInfo> = new Map(PETS.map((p) => [p.kind, p]));

/** Caring: what it costs, how often it counts, and what it does (happiness 0-100, and your own needs). */
export const PET_CARE = {
  feed: { label: "Feed", icon: "🍖", cost: 300, everyHours: 8, happy: 25, gives: {} },
  play: { label: "Play", icon: "🎾", cost: 0, everyHours: 2, happy: 15, gives: { fun: 8 } },
  walk: { label: "Go for a walk", icon: "🦮", cost: 0, everyHours: 4, happy: 20, gives: { health: 5, fun: 5 } },
} as const;
export type PetCare = keyof typeof PET_CARE;
/** Happiness slips this much an hour without care (never below zero). */
export const PET_DRIFT_PER_HOUR = 2;
/** Sleeping at home with a happy pet (happiness at least this) lifts Social. */
export const PET_HAPPY = 60;
export const PET_HOME_SOCIAL = 6;
export const PET_NAME = /^[\p{L}][\p{L} '-]{0,19}$/u;

export interface PetView {
  kind: PetKind;
  name: string;
  happiness: number;
  mood: "happy" | "okay" | "sad";
  /** When each kind of care counts again (ISO), or null now. */
  next: Record<PetCare, string | null>;
  adoptedAt: string;
}
export const petMood = (h: number): PetView["mood"] => (h >= PET_HAPPY ? "happy" : h >= 30 ? "okay" : "sad");
/** What the parrot says when you visit (it learns your name). */
export const parrotLine = (name: string, n: number) => ["Hello o!", `${name}! ${name}!`, "How far?", "I wan chop!", "Who dey there?", "E go better!", "Oya come!"][n % 7]!;
