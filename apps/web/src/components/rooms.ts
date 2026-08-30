// Hand-marked interior rooms (public/art/interiors), used by InteriorScene. Positions are fractions of the image:
// where a person's feet touch the floor (for lying people: the middle of the body on the mattress).
//   walkway  open floor, in order: walkers go back and forth along it, and the player walks on it (taps snap to it);
//   stations people who stay put and do something (pose sheets in public/art/life/poses);
//   spots    where the player goes for each thing they can do in the room (door = where they come in).
import { OUTFIT_VARIANTS, type WalkerVariant } from "./walkers.js";

/** People who stay put and do something (Blender pose sheets in public/art/life/poses). */
export type PoseAction = "dance" | "serve" | "stand_idle" | "sit_eat" | "sit_talk" | "sleep" | "pray_salah" | "pray_church" | "kneel_pray";
/** Adult looks that have every pose, prayer included. */
const ADULTS: WalkerVariant[] = ["woman_buba", "woman_gele", "man_kaftan", "man_casual", ...OUTFIT_VARIANTS];
/** Which variants have a sheet for each pose (the player's own variant always has dance, sit, eat, stand, sleep). */
export const POSE_VARIANTS: Record<PoseAction, WalkerVariant[]> = {
  dance: ["woman_gele", "man_kaftan", "woman_buba", "man_casual", ...OUTFIT_VARIANTS],
  serve: ["woman_buba", "man_casual"],
  stand_idle: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
  sit_eat: ["woman_buba", "man_kaftan", "man_casual", "woman_gele", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
  sit_talk: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
  sleep: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
  // Salah sheets put the women in a headscarf; all three prayer sheets exist for every adult look.
  pray_salah: ADULTS,
  pray_church: ADULTS,
  kneel_pray: ADULTS,
};
/**
 * Each pose sheet's frame size, frame count and speed. Standing, seated and praying frames have the feet 16 px above
 * the bottom; lying (sleep) frames are centred on the middle of the body. Salah frames are wider (prostration reaches
 * forward) and only salah has a "nw" sheet (facing the mihrab).
 */
export const POSE_SHEETS: Record<PoseAction, { w: number; h: number; frames: number; fps: number; centred?: boolean }> = {
  dance: { w: 96, h: 160, frames: 8, fps: 10 },
  serve: { w: 96, h: 160, frames: 8, fps: 7 },
  stand_idle: { w: 96, h: 160, frames: 8, fps: 7 },
  sit_eat: { w: 96, h: 160, frames: 8, fps: 7 },
  sit_talk: { w: 96, h: 160, frames: 8, fps: 7 },
  sleep: { w: 192, h: 112, frames: 8, fps: 3, centred: true },
  pray_salah: { w: 144, h: 160, frames: 16, fps: 1.6 },
  pray_church: { w: 96, h: 160, frames: 8, fps: 4 },
  kneel_pray: { w: 96, h: 160, frames: 8, fps: 2 },
};

export type Pt = [number, number];
/** Pose sheets face se or sw (towards the viewer); salah also faces nw (towards a mihrab on the left wall). */
export type Facing = "se" | "sw" | "nw";
/** What the player is doing in a room. */
export type PlayerAction = "walk" | "sit" | "eat" | "sleep" | "dance" | "chair" | "stand" | "pray";
/** Marked places for the player: door (where they come in) and one per action that fits the room. */
export type SpotKey = "door" | Exclude<PlayerAction, "walk">;
export interface Spot {
  at: Pt;
  dir: Facing;
  /** The pose played there, when not the usual one for the action (e.g. standing in a prayer row). */
  pose?: PoseAction;
}
export interface Room {
  /** Open floor, in order: walkers go back and forth along it, pausing at each spot. */
  walkway: Pt[];
  walkers: number;
  /** `phase`: frames into its loop this person starts (so a row of people praying don't move in step). */
  stations: { action: PoseAction; at: Pt; dir: Facing; variant?: WalkerVariant; phase?: number }[];
  spots?: Partial<Record<SpotKey, Spot>>;
}

/** Hand-marked rooms, keyed by interior art name (public/art/interiors). Every room has 2-5 people. */
export const ROOMS: Record<string, Room> = {
  buka: {
    walkway: [[0.25, 0.74], [0.33, 0.8], [0.44, 0.85], [0.54, 0.9], [0.64, 0.86]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.56, 0.58], dir: "sw", variant: "woman_buba" },
      { action: "stand_idle", at: [0.4, 0.75], dir: "se" },
      { action: "sit_eat", at: [0.24, 0.66], dir: "se", variant: "man_kaftan" },
      { action: "sit_eat", at: [0.38, 0.57], dir: "se", variant: "woman_gele" },
    ],
    spots: { door: { at: [0.54, 0.9], dir: "se" }, eat: { at: [0.3, 0.6], dir: "se" }, stand: { at: [0.33, 0.8], dir: "se" } },
  },
  "event-centre": {
    walkway: [[0.36, 0.63], [0.46, 0.71], [0.56, 0.75], [0.62, 0.67], [0.52, 0.5]],
    walkers: 1,
    stations: [
      { action: "dance", at: [0.45, 0.56], dir: "se" },
      { action: "dance", at: [0.53, 0.62], dir: "sw" },
      { action: "dance", at: [0.58, 0.55], dir: "se" },
      { action: "dance", at: [0.47, 0.65], dir: "sw" },
    ],
    spots: { door: { at: [0.56, 0.75], dir: "se" }, dance: { at: [0.62, 0.68], dir: "sw" }, stand: { at: [0.36, 0.63], dir: "se" } },
  },
  "viewing-centre": {
    // Rows of chairs fill the floor: everyone is seated watching, one person by the cooler. The only open floor is
    // the strip in front of the screen.
    walkway: [[0.18, 0.6], [0.28, 0.55], [0.38, 0.5]],
    walkers: 0,
    stations: [
      { action: "sit_talk", at: [0.2, 0.68], dir: "se" },
      { action: "sit_talk", at: [0.36, 0.6], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.54, 0.6], dir: "se", variant: "man_casual" },
      { action: "sit_talk", at: [0.46, 0.82], dir: "se" },
      { action: "stand_idle", at: [0.7, 0.55], dir: "sw", variant: "man_casual" },
    ],
    spots: { door: { at: [0.18, 0.6], dir: "se" }, sit: { at: [0.3, 0.72], dir: "se" }, stand: { at: [0.28, 0.55], dir: "se" } },
  },
  barbershop: {
    walkway: [[0.36, 0.86], [0.48, 0.88], [0.6, 0.8], [0.7, 0.72]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.62, 0.65], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.7, 0.62], dir: "sw", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.42, 0.78], dir: "se" },
    ],
    spots: { door: { at: [0.48, 0.88], dir: "se" }, chair: { at: [0.54, 0.63], dir: "se" }, sit: { at: [0.78, 0.6], dir: "sw" }, stand: { at: [0.6, 0.8], dir: "sw" } },
  },
  "tailor-shop": {
    walkway: [[0.28, 0.78], [0.4, 0.85], [0.52, 0.89], [0.62, 0.81], [0.73, 0.74]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.22, 0.66], dir: "se", variant: "woman_buba" },
      { action: "stand_idle", at: [0.57, 0.76], dir: "sw", variant: "woman_gele" },
    ],
    // Stand by the dress form to be measured.
    spots: { door: { at: [0.52, 0.89], dir: "se" }, chair: { at: [0.45, 0.8], dir: "se", pose: "stand_idle" }, stand: { at: [0.45, 0.8], dir: "se" } },
  },
  "bank-hall": {
    walkway: [[0.25, 0.75], [0.4, 0.82], [0.55, 0.85], [0.7, 0.76], [0.78, 0.67]],
    walkers: 2,
    stations: [
      { action: "stand_idle", at: [0.57, 0.67], dir: "se" },
      { action: "stand_idle", at: [0.73, 0.63], dir: "sw" },
      { action: "sit_talk", at: [0.32, 0.64], dir: "se" },
    ],
    spots: { door: { at: [0.55, 0.85], dir: "se" }, sit: { at: [0.25, 0.6], dir: "se" }, stand: { at: [0.66, 0.68], dir: "sw" } },
  },
  gym: {
    walkway: [[0.62, 0.84], [0.68, 0.78], [0.74, 0.72], [0.8, 0.64]],
    walkers: 1,
    stations: [
      { action: "dance", at: [0.67, 0.71], dir: "sw", variant: "woman_buba" },
      { action: "stand_idle", at: [0.78, 0.62], dir: "sw", variant: "man_casual" },
      { action: "stand_idle", at: [0.5, 0.76], dir: "se", variant: "man_kaftan" },
    ],
    spots: { door: { at: [0.62, 0.84], dir: "se" }, dance: { at: [0.72, 0.8], dir: "sw" }, stand: { at: [0.74, 0.72], dir: "sw" } },
  },
  "boat-deck": {
    walkway: [[0.36, 0.56], [0.46, 0.62], [0.56, 0.58], [0.64, 0.5]],
    walkers: 1,
    stations: [
      { action: "dance", at: [0.48, 0.52], dir: "se" },
      { action: "dance", at: [0.56, 0.47], dir: "sw" },
      { action: "serve", at: [0.62, 0.38], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.36, 0.46], dir: "se", variant: "woman_gele" },
    ],
    spots: { door: { at: [0.36, 0.56], dir: "se" }, dance: { at: [0.52, 0.6], dir: "se" }, stand: { at: [0.64, 0.5], dir: "sw" } },
  },
  church: {
    // The pastor at the pulpit; the congregation at the pews, hands raised in praise or kneeling in prayer.
    walkway: [[0.32, 0.74], [0.42, 0.7], [0.52, 0.66], [0.6, 0.6]],
    walkers: 0,
    stations: [
      { action: "stand_idle", at: [0.49, 0.55], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.16, 0.69], dir: "se", variant: "woman-hoodie_black" },
      { action: "kneel_pray", at: [0.71, 0.7], dir: "sw", variant: "woman-ankara_green" },
      { action: "kneel_pray", at: [0.5, 0.62], dir: "se", variant: "woman_gele", phase: 4 },
      { action: "pray_church", at: [0.59, 0.67], dir: "sw", variant: "man-tee_blue", phase: 3 },
    ],
    spots: { door: { at: [0.32, 0.76], dir: "se" }, sit: { at: [0.27, 0.73], dir: "se" }, pray: { at: [0.4, 0.7], dir: "se", pose: "pray_church" }, stand: { at: [0.42, 0.7], dir: "se" } },
  },
  salon: {
    walkway: [[0.4, 0.82], [0.5, 0.76], [0.58, 0.68], [0.66, 0.62]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.52, 0.6], dir: "sw", variant: "woman_buba" },
      { action: "serve", at: [0.41, 0.7], dir: "se", variant: "man_casual" },
      { action: "sit_talk", at: [0.87, 0.67], dir: "sw", variant: "woman_gele" },
      { action: "stand_idle", at: [0.74, 0.8], dir: "sw", variant: "schoolgirl" },
    ],
    spots: { door: { at: [0.4, 0.82], dir: "se" }, chair: { at: [0.27, 0.66], dir: "se" }, stand: { at: [0.58, 0.68], dir: "sw" } },
  },
  lounge: {
    walkway: [[0.22, 0.7], [0.3, 0.63], [0.4, 0.58], [0.52, 0.62]],
    walkers: 1,
    stations: [
      { action: "dance", at: [0.22, 0.69], dir: "se", variant: "woman_gele" },
      { action: "dance", at: [0.29, 0.74], dir: "sw", variant: "man_kaftan" },
      { action: "serve", at: [0.36, 0.41], dir: "sw", variant: "woman_buba" },
      { action: "sit_talk", at: [0.7, 0.6], dir: "sw", variant: "woman_buba" },
    ],
    spots: { door: { at: [0.52, 0.62], dir: "sw" }, dance: { at: [0.36, 0.66], dir: "se" }, sit: { at: [0.62, 0.62], dir: "sw" }, stand: { at: [0.4, 0.58], dir: "se" } },
  },
  mosque: {
    // Congregational prayer, all facing the mihrab (nw) and moving through the rak'ah together: the imam alone in
    // front, a row's depth of open floor, the men's row, another gap, and the women's row at the back.
    walkway: [[0.45, 0.88], [0.485, 0.83], [0.615, 0.765], [0.745, 0.7], [0.74, 0.62]],
    walkers: 0,
    stations: [
      { action: "pray_salah", at: [0.36, 0.585], dir: "nw", variant: "man-agbada_white", phase: 0 },
      { action: "pray_salah", at: [0.465, 0.738], dir: "nw", variant: "man_kaftan", phase: 0 },
      { action: "pray_salah", at: [0.595, 0.672], dir: "nw", variant: "man-tee_blue", phase: 0 },
      { action: "pray_salah", at: [0.635, 0.858], dir: "nw", variant: "woman-buba_wrapper", phase: 0 },
      { action: "pray_salah", at: [0.765, 0.792], dir: "nw", variant: "woman-kaftan_gold", phase: 0 },
    ],
    spots: {
      door: { at: [0.45, 0.88], dir: "se" },
      // in the men's row, next to the two already there
      pray: { at: [0.725, 0.606], dir: "nw", pose: "pray_salah" },
      sit: { at: [0.725, 0.606], dir: "nw", pose: "pray_salah" },
      stand: { at: [0.28, 0.72], dir: "se" },
    },
  },
  "car-showroom": {
    walkway: [[0.6, 0.83], [0.7, 0.76], [0.8, 0.68]],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.38, 0.56], dir: "se", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.47, 0.6], dir: "sw", variant: "woman_gele" },
      { action: "stand_idle", at: [0.82, 0.64], dir: "sw", variant: "man_casual" },
    ],
    spots: { door: { at: [0.6, 0.83], dir: "se" }, stand: { at: [0.7, 0.76], dir: "sw" } },
  },
  classroom: {
    walkway: [],
    walkers: 0,
    stations: [
      { action: "stand_idle", at: [0.62, 0.46], dir: "se", variant: "woman_buba" },
      { action: "sit_talk", at: [0.52, 0.7], dir: "se", variant: "schoolgirl" },
      { action: "sit_talk", at: [0.68, 0.78], dir: "sw", variant: "schoolboy" },
      { action: "sit_talk", at: [0.8, 0.66], dir: "sw", variant: "schoolgirl" },
    ],
  },
  // Lagoon City University's lecture theatre: the lecturer behind the desk under the screens, students on the
  // tiered benches either side of the aisle, and a seat for you on the left bank.
  "lecture-hall": {
    walkway: [[0.22, 0.72], [0.34, 0.66], [0.46, 0.6], [0.52, 0.56]],
    walkers: 0,
    stations: [
      { action: "stand_idle", at: [0.74, 0.47], dir: "sw", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.16, 0.6], dir: "se", variant: "woman-tee_blue" },
      { action: "sit_talk", at: [0.42, 0.57], dir: "se", variant: "man-hoodie_black" },
      { action: "sit_talk", at: [0.48, 0.8], dir: "se", variant: "woman-ankara_green" },
      { action: "sit_talk", at: [0.7, 0.68], dir: "sw", variant: "man-jersey_red" },
    ],
    spots: { door: { at: [0.22, 0.72], dir: "se" }, sit: { at: [0.27, 0.56], dir: "se" }, stand: { at: [0.46, 0.6], dir: "se" } },
  },
  // Balogun market: a narrow aisle between fabric, shoe and household stalls, traders at their stalls and
  // shoppers squeezing through.
  "market-aisle": {
    walkway: [[0.5, 0.88], [0.48, 0.76], [0.5, 0.64], [0.52, 0.52]],
    walkers: 2,
    stations: [
      { action: "stand_idle", at: [0.36, 0.64], dir: "se", variant: "woman_gele" },
      { action: "stand_idle", at: [0.6, 0.56], dir: "sw", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.44, 0.5], dir: "se", variant: "woman-buba_wrapper" },
    ],
    spots: { door: { at: [0.5, 0.88], dir: "se" }, stand: { at: [0.47, 0.72], dir: "sw" } },
  },
  "hotel-lobby": {
    walkway: [[0.25, 0.72], [0.35, 0.8], [0.5, 0.86], [0.62, 0.8], [0.66, 0.73]],
    walkers: 2,
    stations: [
      { action: "stand_idle", at: [0.3, 0.65], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.66, 0.63], dir: "sw", variant: "woman_gele" },
    ],
    spots: { door: { at: [0.5, 0.86], dir: "se" }, sit: { at: [0.78, 0.64], dir: "sw" }, stand: { at: [0.35, 0.8], dir: "se" } },
  },
  // Zip 15 (batches 29-31): rooms for the new places and clean redos.
  "provision-shop": {
    walkway: [[0.72, 0.63], [0.77, 0.71], [0.72, 0.78], [0.69, 0.82]],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.68, 0.67], dir: "sw", variant: "woman_buba" },
      { action: "stand_idle", at: [0.76, 0.79], dir: "sw", variant: "man_casual" },
    ],
    spots: { door: { at: [0.69, 0.82], dir: "sw" }, stand: { at: [0.72, 0.74], dir: "sw" } },
  },
  "golf-lounge": {
    walkway: [[0.6, 0.64], [0.68, 0.7], [0.78, 0.74], [0.72, 0.82]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.27, 0.6], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.18, 0.68], dir: "se", variant: "woman_gele" },
      { action: "stand_idle", at: [0.63, 0.66], dir: "sw" },
    ],
    spots: { door: { at: [0.72, 0.82], dir: "se" }, stand: { at: [0.68, 0.7], dir: "sw" } },
  },
  "stadium-room": {
    walkway: [[0.45, 0.62], [0.6, 0.7], [0.72, 0.8], [0.55, 0.85], [0.4, 0.75]],
    walkers: 2,
    stations: [
      { action: "sit_talk", at: [0.2, 0.62], dir: "se", variant: "man_casual" },
      { action: "sit_talk", at: [0.35, 0.56], dir: "se", variant: "man_casual" },
      { action: "stand_idle", at: [0.7, 0.62], dir: "sw", variant: "man_kaftan" },
    ],
    spots: { door: { at: [0.72, 0.8], dir: "sw" }, sit: { at: [0.27, 0.59], dir: "se" }, stand: { at: [0.6, 0.7], dir: "sw" } },
  },
  "snooker-room": {
    walkway: [[0.18, 0.72], [0.3, 0.82], [0.48, 0.9], [0.62, 0.86], [0.76, 0.78], [0.82, 0.7]],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.2, 0.69], dir: "se", variant: "man_casual" },
      { action: "stand_idle", at: [0.79, 0.72], dir: "sw", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.66, 0.52], dir: "sw" },
    ],
    spots: { door: { at: [0.48, 0.9], dir: "se" }, sit: { at: [0.57, 0.48], dir: "sw" }, stand: { at: [0.62, 0.86], dir: "sw" } },
  },
  "police-desk": {
    walkway: [[0.4, 0.62], [0.5, 0.72], [0.62, 0.8], [0.5, 0.88], [0.35, 0.78]],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.47, 0.57], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.18, 0.62], dir: "se" },
      { action: "stand_idle", at: [0.56, 0.66], dir: "sw", variant: "man_kaftan" },
    ],
    spots: { door: { at: [0.5, 0.88], dir: "se" }, sit: { at: [0.26, 0.66], dir: "se" }, stand: { at: [0.5, 0.72], dir: "sw" } },
  },
  "radio-studio": {
    walkway: [[0.8, 0.65], [0.85, 0.72], [0.74, 0.78]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.35, 0.5], dir: "se", variant: "woman_buba" },
      { action: "sit_talk", at: [0.56, 0.6], dir: "sw", variant: "man_casual" },
    ],
    spots: { door: { at: [0.74, 0.78], dir: "sw" }, stand: { at: [0.8, 0.65], dir: "sw" } },
  },
  "hospital-ward": {
    // Patients lying in two of the beds, a visitor at the middle one, a nurse by the desk.
    walkway: [[0.42, 0.7], [0.5, 0.78], [0.58, 0.88], [0.62, 0.72]],
    walkers: 1,
    stations: [
      { action: "sleep", at: [0.48, 0.42], dir: "sw", variant: "man_kaftan" },
      { action: "sleep", at: [0.8, 0.58], dir: "sw", variant: "woman_buba" },
      { action: "stand_idle", at: [0.57, 0.67], dir: "se", variant: "woman_gele" },
      { action: "stand_idle", at: [0.43, 0.66], dir: "se", variant: "woman_buba" },
    ],
    spots: { door: { at: [0.58, 0.88], dir: "se" }, sleep: { at: [0.64, 0.5], dir: "sw" }, stand: { at: [0.5, 0.78], dir: "se" } },
  },
  "library-room": {
    walkway: [[0.6, 0.62], [0.7, 0.72], [0.8, 0.78], [0.64, 0.83]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.18, 0.58], dir: "se", variant: "schoolgirl" },
      { action: "sit_talk", at: [0.38, 0.72], dir: "se", variant: "schoolboy" },
      { action: "stand_idle", at: [0.64, 0.58], dir: "sw", variant: "woman_buba" },
    ],
    spots: { door: { at: [0.64, 0.83], dir: "se" }, sit: { at: [0.28, 0.64], dir: "se" }, stand: { at: [0.7, 0.72], dir: "sw" } },
  },
  courtroom: {
    walkway: [[0.56, 0.65], [0.62, 0.68], [0.55, 0.73]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.35, 0.41], dir: "se", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.62, 0.62], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.6, 0.83], dir: "se" },
    ],
    spots: { door: { at: [0.55, 0.73], dir: "se" }, sit: { at: [0.68, 0.8], dir: "se" }, stand: { at: [0.56, 0.66], dir: "se" } },
  },
  hangout: {
    walkway: [[0.47, 0.5], [0.57, 0.5], [0.64, 0.61], [0.84, 0.66]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.5, 0.49], dir: "sw", variant: "man_casual" },
      { action: "stand_idle", at: [0.66, 0.53], dir: "sw", variant: "woman_gele" },
      { action: "sit_talk", at: [0.3, 0.7], dir: "se" },
      { action: "sit_eat", at: [0.4, 0.7], dir: "sw" },
    ],
    spots: { door: { at: [0.84, 0.66], dir: "sw" }, sit: { at: [0.49, 0.62], dir: "se" }, eat: { at: [0.58, 0.62], dir: "sw" }, dance: { at: [0.57, 0.5], dir: "se" }, stand: { at: [0.64, 0.61], dir: "sw" } },
  },
  // Homes (Home.tsx and visits): the player's own place, with family or friends about.
  "home-face-me": {
    // One room: a mattress on the floor, a plastic chair, a stove on the floor.
    walkway: [[0.48, 0.73], [0.6, 0.72], [0.72, 0.76], [0.64, 0.84]],
    walkers: 1,
    stations: [{ action: "sit_talk", at: [0.38, 0.79], dir: "se", variant: "woman_buba" }],
    spots: {
      door: { at: [0.64, 0.84], dir: "sw" },
      sleep: { at: [0.46, 0.54], dir: "sw" },
      sit: { at: [0.38, 0.79], dir: "se" },
      eat: { at: [0.38, 0.79], dir: "se" },
      stand: { at: [0.6, 0.72], dir: "sw" },
      dance: { at: [0.62, 0.78], dir: "se" },
    },
  },
  "home-self-contain": {
    // Bed on the left, kitchen counter at the back, TV on a stool.
    walkway: [[0.6, 0.6], [0.62, 0.68], [0.58, 0.78], [0.5, 0.86]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.53, 0.58], dir: "sw", variant: "woman_buba" },
      { action: "sit_talk", at: [0.46, 0.72], dir: "se", variant: "man_casual" },
    ],
    spots: {
      door: { at: [0.5, 0.86], dir: "se" },
      sleep: { at: [0.28, 0.58], dir: "se" },
      sit: { at: [0.46, 0.72], dir: "se" },
      eat: { at: [0.46, 0.72], dir: "se" },
      stand: { at: [0.62, 0.68], dir: "sw" },
      dance: { at: [0.56, 0.8], dir: "se" },
    },
  },
  "home-mini-flat": {
    // Living room: sofa facing the TV, coffee table, fridge; no bed in view, so sleep is a nap on the sofa.
    walkway: [[0.22, 0.73], [0.34, 0.8], [0.48, 0.86], [0.62, 0.82], [0.72, 0.72], [0.7, 0.64]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.4, 0.69], dir: "se", variant: "man_kaftan" },
      { action: "sit_eat", at: [0.5, 0.645], dir: "se", variant: "woman_buba" },
      { action: "stand_idle", at: [0.78, 0.74], dir: "sw", variant: "schoolgirl" },
    ],
    spots: {
      door: { at: [0.48, 0.86], dir: "se" },
      sleep: { at: [0.43, 0.6], dir: "sw" },
      sit: { at: [0.4, 0.69], dir: "se" },
      eat: { at: [0.5, 0.645], dir: "se" },
      stand: { at: [0.72, 0.72], dir: "sw" },
      dance: { at: [0.62, 0.82], dir: "se" },
    },
  },
  "home-duplex": {
    // Sectional sofa round a coffee table, dining table on the left, stairs up, window on the right. Meals are
    // on the sofa by the coffee table (a seat at the dining table would be drawn over the table top).
    walkway: [[0.47, 0.92], [0.6, 0.88], [0.7, 0.8], [0.74, 0.7], [0.78, 0.63], [0.68, 0.52]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.4, 0.71], dir: "se", variant: "woman_gele" },
      { action: "sit_eat", at: [0.5, 0.67], dir: "se", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.78, 0.64], dir: "sw", variant: "schoolgirl" },
    ],
    spots: {
      door: { at: [0.6, 0.88], dir: "se" },
      sleep: { at: [0.44, 0.64], dir: "sw" },
      sit: { at: [0.4, 0.71], dir: "se" },
      eat: { at: [0.5, 0.67], dir: "se" },
      stand: { at: [0.74, 0.72], dir: "sw" },
      dance: { at: [0.7, 0.8], dir: "se" },
    },
  },
  "home-mansion": {
    // Curved sofa round a glass table, armchair, fireplace; the pool is outside the glass.
    walkway: [[0.62, 0.88], [0.7, 0.82], [0.8, 0.73], [0.73, 0.64], [0.62, 0.6]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.44, 0.635], dir: "se", variant: "woman_gele" },
      { action: "sit_eat", at: [0.54, 0.6], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.68, 0.745], dir: "sw", variant: "woman_buba" },
      { action: "stand_idle", at: [0.76, 0.66], dir: "sw", variant: "man_casual" },
    ],
    spots: {
      door: { at: [0.62, 0.88], dir: "se" },
      sleep: { at: [0.47, 0.575], dir: "sw" },
      sit: { at: [0.44, 0.635], dir: "se" },
      eat: { at: [0.54, 0.6], dir: "se" },
      stand: { at: [0.73, 0.64], dir: "sw" },
      dance: { at: [0.7, 0.82], dir: "se" },
    },
  },
  "home-crazy": {
    // A throne on a dais, an aquarium wall and a supercar behind glass: no bed or table in view.
    walkway: [[0.5, 0.88], [0.58, 0.8], [0.55, 0.7], [0.65, 0.68], [0.75, 0.72], [0.68, 0.82]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.31, 0.665], dir: "se", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.62, 0.7], dir: "sw", variant: "woman_buba" },
      { action: "dance", at: [0.6, 0.8], dir: "se", variant: "woman_gele" },
    ],
    spots: {
      door: { at: [0.5, 0.88], dir: "se" },
      sit: { at: [0.31, 0.665], dir: "se" },
      stand: { at: [0.65, 0.72], dir: "sw" },
      dance: { at: [0.66, 0.78], dir: "se" },
    },
  },
  // Stitch zip 16: more rooms of the homes.
  "home-compound-yard": {
    // Open yard: water tank on a stand, mango tree with two plastic chairs, generator cage, washing line.
    walkway: [[0.15, 0.6], [0.3, 0.68], [0.45, 0.76], [0.56, 0.66], [0.5, 0.52], [0.38, 0.5]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.555, 0.44], dir: "sw", variant: "woman_buba" },
      { action: "sit_talk", at: [0.625, 0.48], dir: "sw", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.3, 0.62], dir: "se", variant: "schoolboy" },
    ],
    spots: {
      door: { at: [0.45, 0.82], dir: "se" },
      sit: { at: [0.555, 0.44], dir: "sw" },
      eat: { at: [0.625, 0.48], dir: "sw" },
      stand: { at: [0.4, 0.62], dir: "se" },
      dance: { at: [0.3, 0.7], dir: "se" },
    },
  },
  "home-villa-pool": {
    // Deck round the pool: two sun loungers, a tiki bar with stools, a cushioned bench on the pool's stone edge.
    walkway: [[0.32, 0.44], [0.42, 0.44], [0.5, 0.5], [0.6, 0.53], [0.7, 0.56], [0.74, 0.68]],
    walkers: 1,
    stations: [
      { action: "sleep", at: [0.26, 0.63], dir: "se", variant: "woman_gele" },
      { action: "stand_idle", at: [0.53, 0.47], dir: "sw", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.78, 0.66], dir: "sw", variant: "woman_buba" },
    ],
    spots: {
      door: { at: [0.32, 0.44], dir: "se" },
      sleep: { at: [0.36, 0.575], dir: "se" },
      sit: { at: [0.78, 0.66], dir: "sw" },
      eat: { at: [0.62, 0.47], dir: "se" },
      stand: { at: [0.45, 0.47], dir: "se" },
      dance: { at: [0.5, 0.5], dir: "se" },
    },
  },
  "home-bedroom": {
    // Bed under a mosquito net, wardrobe, mirror shelf, standing fan; the rest is open floor.
    walkway: [[0.45, 0.82], [0.55, 0.75], [0.6, 0.66], [0.7, 0.6], [0.8, 0.68]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.24, 0.7], dir: "sw", variant: "woman_gele" },
      { action: "stand_idle", at: [0.7, 0.58], dir: "sw", variant: "man_casual" },
    ],
    spots: {
      door: { at: [0.5, 0.85], dir: "se" },
      sleep: { at: [0.3, 0.56], dir: "se" },
      sit: { at: [0.24, 0.7], dir: "sw" },
      eat: { at: [0.24, 0.7], dir: "sw" },
      stand: { at: [0.62, 0.66], dir: "sw" },
      dance: { at: [0.55, 0.75], dir: "se" },
    },
  },
  "home-kitchen": {
    // Cooker and counters along the back, a dining table with chairs on the right, checkered floor.
    walkway: [[0.35, 0.72], [0.45, 0.62], [0.55, 0.55], [0.6, 0.7], [0.5, 0.82], [0.4, 0.8]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.28, 0.68], dir: "se", variant: "woman_buba" },
      { action: "sit_eat", at: [0.71, 0.63], dir: "se", variant: "man_kaftan" },
    ],
    spots: {
      door: { at: [0.5, 0.85], dir: "se" },
      eat: { at: [0.71, 0.63], dir: "se" },
      sit: { at: [0.71, 0.63], dir: "se" },
      stand: { at: [0.45, 0.62], dir: "se" },
      dance: { at: [0.48, 0.75], dir: "se" },
    },
  },
  "home-duplex-bedroom": {
    // Big bed against the right wall, vanity with a stool, TV on the left wall; wide open floor.
    walkway: [[0.35, 0.6], [0.3, 0.7], [0.4, 0.78], [0.52, 0.84], [0.65, 0.78], [0.75, 0.72]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.84, 0.7], dir: "sw", variant: "woman_buba" },
      { action: "stand_idle", at: [0.3, 0.68], dir: "se", variant: "man_kaftan" },
    ],
    spots: {
      door: { at: [0.52, 0.84], dir: "se" },
      sleep: { at: [0.6, 0.54], dir: "sw" },
      sit: { at: [0.57, 0.69], dir: "se" },
      eat: { at: [0.57, 0.69], dir: "se" },
      stand: { at: [0.65, 0.78], dir: "sw" },
      dance: { at: [0.42, 0.75], dir: "se" },
    },
  },
  "home-villa-suite": {
    // Bed with a tall headboard, two armchairs round a glass table, arched doorway and pool view on the left.
    walkway: [[0.2, 0.63], [0.32, 0.66], [0.45, 0.68], [0.55, 0.66], [0.62, 0.62], [0.5, 0.78]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.76, 0.72], dir: "sw", variant: "woman_gele" },
      { action: "sit_talk", at: [0.62, 0.84], dir: "se", variant: "man_kaftan" },
    ],
    spots: {
      door: { at: [0.2, 0.63], dir: "se" },
      sleep: { at: [0.68, 0.47], dir: "sw" },
      sit: { at: [0.76, 0.72], dir: "sw" },
      eat: { at: [0.62, 0.84], dir: "se" },
      stand: { at: [0.45, 0.68], dir: "se" },
      dance: { at: [0.4, 0.74], dir: "se" },
    },
  },
  "home-villa-kitchen": {
    // Fitted kitchen with an island and three bar stools, big fridge on the right.
    walkway: [[0.3, 0.62], [0.4, 0.72], [0.52, 0.8], [0.65, 0.76], [0.75, 0.68], [0.8, 0.62]],
    walkers: 1,
    stations: [
      { action: "serve", at: [0.37, 0.53], dir: "se", variant: "woman_buba" },
      { action: "sit_eat", at: [0.48, 0.63], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.55, 0.67], dir: "sw", variant: "woman_gele" },
    ],
    spots: {
      door: { at: [0.52, 0.82], dir: "se" },
      eat: { at: [0.48, 0.63], dir: "sw" },
      sit: { at: [0.55, 0.67], dir: "sw" },
      stand: { at: [0.65, 0.76], dir: "sw" },
      dance: { at: [0.42, 0.74], dir: "se" },
    },
  },
  "home-villa-cinema": {
    // Screen on the left wall, popcorn machine in the corner, an L-shaped sectional facing the screen.
    walkway: [[0.3, 0.62], [0.42, 0.56], [0.52, 0.52], [0.58, 0.6], [0.48, 0.72], [0.42, 0.8]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.68, 0.58], dir: "sw", variant: "woman_gele" },
      { action: "sit_eat", at: [0.76, 0.62], dir: "sw", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.5, 0.53], dir: "se", variant: "schoolboy" },
    ],
    spots: {
      door: { at: [0.42, 0.82], dir: "se" },
      sleep: { at: [0.76, 0.54], dir: "se" },
      sit: { at: [0.68, 0.58], dir: "sw" },
      eat: { at: [0.76, 0.62], dir: "sw" },
      stand: { at: [0.5, 0.55], dir: "se" },
      dance: { at: [0.4, 0.66], dir: "se" },
    },
  },
};
