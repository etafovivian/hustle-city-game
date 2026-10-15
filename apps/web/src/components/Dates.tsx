// Dates as scenes: after a date in Phone → Love the place opens with the two of you in it, doing the date together
// (eating across a table, sitting side by side, dancing, a hug on the beach), and the wedding is an owambe at the
// event centre with the hall dancing round you. Uses the together poses (rooms.ts PAIR_POSES) and the room's together
// spots (Room.pairs), or spots worked out from the room's own sit, eat and dance spots.
import { NPC_BY_KEY, type Npc } from "@hc/shared";
import { useSyncExternalStore } from "react";
import { variantFor } from "./AvatarWalker.js";
import { withParty } from "./Party.js";
import { PAIR_POSES, type Facing, type PairKey, type PoseAction, type Pt, type Room, type Spot } from "./rooms.js";

export interface DateScene {
  npc: string;
  venue: string;
  pair: PairKey;
  label: string;
  wedding: boolean;
  /** A new date (or the same one again) starts the scene over. */
  seq: number;
}
/** What each date spot looks like together. */
const SCENE_OF: Record<string, PairKey> = {
  mama_nkechi_buka: "eat",
  mallam_suya: "eat",
  viewing_centre: "sit",
  crown_arts_theatre: "sit",
  sandbar_beach: "hug",
  skyline_lounge: "dance",
  lagoon_boat_cruise: "dance",
  capital_lights_lounge: "dance",
};
export const WEDDING_VENUE = "royal_event_centre";

let current: DateScene | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

/** Start the scene (then open the place). */
export function startDate(npc: string, venue: string, label: string, wedding = false) {
  current = { npc, venue, pair: wedding ? "wedding" : (SCENE_OF[venue] ?? "sit"), label, wedding, seq: Date.now() };
  emit();
}
export function endDate() {
  current = null;
  emit();
}
let open = 0;
/** For a place's card while it's open: closing it ends the date (after a beat, so a card that is only remounted, as
 * React does in development, keeps it). Returns the effect's cleanup. */
export function holdDate() {
  open++;
  return () => {
    open--;
    window.setTimeout(() => open === 0 && endDate(), 300);
  };
}

/** The date going on at this place, if any. */
export function useDateAt(venue: string): DateScene | null {
  const d = useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => current,
  );
  return d && d.venue === venue ? d : null;
}

const flip: Record<Facing, Facing> = { se: "nw", nw: "se", sw: "ne", ne: "sw" };
/** The two spots for a together pose: the room's own (Room.pairs), else beside or across from its usual spot. */
function pairSpots(room: Room, key: PairKey): [Spot, Spot] {
  const own = room.pairs?.[key];
  if (own) return own;
  const base: Spot | undefined =
    key === "eat" ? (room.spots?.eat ?? room.spots?.sit) : key === "dance" || key === "hug" || key === "wedding" ? (room.spots?.dance ?? room.spots?.stand) : (room.spots?.sit ?? room.spots?.chair);
  const at: Pt = base?.at ?? room.walkway[Math.floor(room.walkway.length / 2)] ?? [0.5, 0.7];
  const dir: Facing = base?.dir ?? "se";
  const p = PAIR_POSES[key];
  // Across (eat, dance, hug): a step in front, facing back; beside (sit, wedding): a step to the side, same way.
  const partner: Pt = p.face === "opposite" ? [at[0] + 0.035, at[1] + 0.03] : [at[0] + 0.05, at[1] - 0.012];
  return [
    { at, dir },
    { at: partner, dir: p.face === "opposite" ? flip[dir] : dir },
  ];
}

/**
 * The room for a date and your spot in it: your date in their own look at their spot, doing their half of the pose
 * (and the hall full of dancing guests at a wedding).
 */
export function dateRoom(room: Room | undefined, date: DateScene | null): { room: Room | undefined; spot: { at: Pt; dir: Facing; seq: number; pose: PoseAction; behind?: number } | null } {
  if (!room || !date) return { room, spot: null };
  const npc: Npc | undefined = NPC_BY_KEY.get(date.npc);
  if (!npc) return { room, spot: null };
  const [mine, theirs] = pairSpots(room, date.pair);
  const poses = PAIR_POSES[date.pair];
  // The hug sheet depends on who you're hugging.
  const theirPose = date.pair === "hug" ? (npc.gender === "man" ? "hug_w" : "hug_m") : (theirs.pose ?? poses.partner);
  const myPose = date.pair === "hug" ? (npc.gender === "man" ? "hug_m" : "hug_w") : (mine.pose ?? poses.player);
  // Your date isn't also standing about as one of the place's regulars.
  const others = room.stations.filter((st) => st.look !== npc.avatar);
  // Eating or sitting: they take the seat nearest yours (a real chair, across the table or beside you), in place of
  // whoever sat there; elsewhere their own spot.
  const seated = date.pair === "eat" || date.pair === "sit";
  const near = (st: (typeof others)[number]) => Math.hypot(st.at[0] - mine.at[0], st.at[1] - mine.at[1]);
  const seat = seated
    ? others.filter((st) => (st.action === "sit_eat" || st.action === "sit_talk" || st.action === "eat_table") && near(st) > 0.02 && near(st) < 0.2).sort((x, y) => near(x) - near(y))[0]
    : undefined;
  const them = seat
    ? { action: seat.action, at: seat.at, dir: seat.dir, behind: seat.behind, variant: variantFor(npc.avatar), look: npc.avatar }
    : { action: theirPose, at: theirs.at, dir: theirs.dir, behind: theirs.behind, variant: variantFor(npc.avatar), look: npc.avatar };
  const withThem: Room = { ...room, stations: [...others.filter((st) => st !== seat), them] };
  // At the wedding the guests dance round the couple, not on top of them.
  const party = date.wedding ? withParty(withThem, "hall", { crowd: 10, seed: date.seq % 97 })! : withThem;
  const clear = (at: Pt) => Math.hypot(at[0] - mine.at[0], at[1] - mine.at[1]) > 0.09 && Math.hypot(at[0] - them.at[0], at[1] - them.at[1]) > 0.09;
  const final: Room = date.wedding ? { ...party, stations: party.stations.filter((st) => st === them || st.action !== "dance" || clear(st.at)) } : party;
  return {
    room: final,
    spot: { at: mine.at, dir: mine.dir, seq: date.seq, pose: myPose, behind: mine.behind },
  };
}
