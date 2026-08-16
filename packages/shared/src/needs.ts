// Needs and moods. Six needs (0–100) run down in real time and the places in town fill them back up: an activity
// fills the needs its tags name (+Food, +Fun…), a free action a little. The mood comes from the needs, with Naija
// moodlets ("Belle full", "Tire don catch me") that say why. Values live on the server and decay lazily: the stored
// value plus the time since it was saved.
import type { Vibe } from "./venues.js";

export const NEED_KEYS = ["food", "energy", "fun", "social", "health", "style"] as const;
export type NeedKey = (typeof NEED_KEYS)[number];
export type Needs = Record<NeedKey, number>;

export const NEED_LABEL: Record<NeedKey, string> = {
  food: "Food",
  energy: "Energy",
  fun: "Fun",
  social: "Social",
  health: "Health",
  style: "Style",
};
export const NEED_ICON: Record<NeedKey, string> = { food: "🍲", energy: "⚡", fun: "🎉", social: "🗣️", health: "❤️", style: "✨" };

/** Points lost per real hour (food goes fastest; health slowly). Roughly: hungry again in about 8 hours. */
export const NEED_DECAY: Needs = { food: 7, energy: 4, fun: 5, social: 3.5, health: 1.2, style: 2.5 };
export const NEED_START: Needs = { food: 70, energy: 80, fun: 60, social: 60, health: 85, style: 65 };

/** Which need each activity tag fills (the rest — brain, faith, respect, hustle — lift the mood instead). */
export const VIBE_NEED: Partial<Record<Vibe, NeedKey>> = { food: "food", rest: "energy", fun: "fun", social: "social", health: "health", style: "style" };
/** How much a paid activity, a flex and a free action fill each tagged need. */
export const NEED_GAIN = { paid: 25, flex: 40, free: 8 };
/** A free action fills needs at most once an hour per place. */
export const FREE_COOLDOWN_MS = 60 * 60_000;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Needs now, from what was saved at `savedAt`. */
export function needsAt(saved: Needs, savedAt: Date, now: Date): Needs {
  const hours = Math.max(0, (now.getTime() - savedAt.getTime()) / 3_600_000);
  const out = {} as Needs;
  for (const k of NEED_KEYS) out[k] = clamp(Math.round((saved[k] - NEED_DECAY[k] * hours) * 10) / 10);
  return out;
}

/** Needs after an activity with these tags. */
export function fillNeeds(n: Needs, gives: readonly Vibe[], amount: number): Needs {
  const out = { ...n };
  for (const v of gives) {
    const k = VIBE_NEED[v];
    if (k) out[k] = clamp(out[k] + amount);
  }
  return out;
}

export interface Moodlet {
  key: string;
  label: string;
  /** Effect on the mood score. */
  delta: number;
}
export type MoodLabel = "Miserable" | "Low" | "Fine" | "Good" | "Great";
export interface Mood {
  score: number;
  label: MoodLabel;
  emoji: string;
  moodlets: Moodlet[];
}

/** The mood from the needs: their average, nudged by moodlets for anything very low or very high. */
export function moodOf(n: Needs): Mood {
  const m: Moodlet[] = [];
  const low = (k: NeedKey, below: number, key: string, label: string, delta: number) => n[k] < below && m.push({ key, label, delta });
  const high = (k: NeedKey, above: number, key: string, label: string, delta: number) => n[k] >= above && m.push({ key, label, delta });
  low("food", 25, "belle_cry", "Belle dey cry", -15);
  high("food", 80, "belle_full", "Belle full", 8);
  low("energy", 25, "tire", "Tire don catch me", -12);
  high("energy", 85, "fresh", "Fresh like morning", 5);
  low("fun", 25, "bored", "Life too serious", -10);
  high("fun", 80, "enjoyment", "Enjoyment!", 8);
  low("social", 25, "lonely", "No one dey my side", -8);
  high("social", 80, "my_people", "With my people", 6);
  low("health", 35, "body_no_well", "Body no dey okay", -15);
  low("style", 25, "rough", "Looking rough", -6);
  high("style", 80, "sharp", "Looking sharp", 6);
  const avg = NEED_KEYS.reduce((s, k) => s + n[k], 0) / NEED_KEYS.length;
  const score = clamp(Math.round(avg + m.reduce((s, x) => s + x.delta, 0)));
  const [label, emoji]: [MoodLabel, string] =
    score < 25 ? ["Miserable", "😩"] : score < 45 ? ["Low", "😕"] : score < 65 ? ["Fine", "🙂"] : score < 80 ? ["Good", "😄"] : ["Great", "🤩"];
  return { score, label, emoji, moodlets: m };
}

/** The need to look after first (the lowest), for "go fix it" hints. */
export const lowestNeed = (n: Needs): NeedKey => NEED_KEYS.reduce((a, b) => (n[b] < n[a] ? b : a));

export interface NeedsView {
  needs: Needs;
  mood: Mood;
}
