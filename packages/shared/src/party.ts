// House parties: throw one at your own house (food, drinks, music), your contacts get an invite, and for an hour
// your house is full of people dancing. Friends who come by (visit your house while it's on) join in: Social and Fun
// for them, a little XP for you per guest. One party a Lagos day.

export type PartySize = "gist" | "owambe" | "bash";
export interface PartyKind {
  key: PartySize;
  label: string;
  icon: string;
  note: string;
  cost: number;
  /** People dancing in the house (game characters) while it's on. */
  crowd: number;
  /** House designs big enough for it (null: any house). */
  houses: readonly string[] | null;
  /** For the host when it starts. */
  gives: { social: number; fun: number };
  xp: number;
}
export const PARTIES: readonly PartyKind[] = [
  { key: "gist", label: "Small gist", icon: "🍻", note: "Drinks, small chops and good gist", cost: 5_000, crowd: 3, houses: null, gives: { social: 20, fun: 15 }, xp: 15 },
  { key: "owambe", label: "Owambe", icon: "🎉", note: "Jollof, a DJ and everybody in aso-ebi", cost: 15_000, crowd: 6, houses: null, gives: { social: 30, fun: 25 }, xp: 30 },
  { key: "bash", label: "Big bash", icon: "🪩", note: "Live band, catering, the whole street talking", cost: 40_000, crowd: 10, houses: ["storey_house", "family_compound", "terrace_duplex", "villa"], gives: { social: 40, fun: 35 }, xp: 60 },
];
export const PARTY_BY_KEY: ReadonlyMap<string, PartyKind> = new Map(PARTIES.map((p) => [p.key, p]));
export const PARTY_MINUTES = 60;
/** For each guest who joins (once a party), and for the host per guest (up to MAX_GUEST_XP guests). */
export const PARTY_GUEST = { social: 20, fun: 15, xp: 10, hostXp: 5, maxGuestXp: 10 };

export interface PartyView {
  id: string;
  host: string;
  plotId: string;
  area: string | null;
  size: PartySize;
  endsAt: string;
  guests: number;
  /** You've joined this one. */
  joined: boolean;
}
export interface PartiesView {
  /** Your party now, if any. */
  mine: PartyView | null;
  /** Whether you can throw one today (you already did, or no house of your own). */
  canThrow: { ok: boolean; why: string | null };
  /** Your contacts' parties going on now. */
  friends: PartyView[];
}
