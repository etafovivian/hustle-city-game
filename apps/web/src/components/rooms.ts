// Hand-marked interior rooms (public/art/interiors), used by InteriorScene. Positions are fractions of the image:
// where a person's feet touch the floor (for lying people: the middle of the body on the mattress).
//   walkway  open floor, in order: walkers go back and forth along it, and the player walks on it (taps snap to it);
//   stations people who stay put and do something (pose sheets in public/art/life/poses);
//   spots    where the player goes for each thing they can do in the room (door = where they come in).
import { OUTFIT_VARIANTS, STAFF_VARIANTS, type WalkerVariant } from "./walkers.js";

/** People who stay put and do something (Blender pose sheets in public/art/life/poses). */
export type PoseAction =
  | "dance"
  | "serve"
  | "stand_idle"
  | "sit_eat"
  | "sit_talk"
  | "sleep"
  | "pray_salah"
  | "pray_church"
  | "kneel_pray"
  | "lift_weights"
  | "boxing"
  | "run"
  | "pushups"
  | "skip_rope"
  // Work (staff in uniform, and a few everyday looks): see WORK below.
  | "check_patient"
  | "write_chart"
  | "pour_drink"
  | "carry_tray"
  | "serve_tray"
  | "cook_stir"
  | "wipe_counter"
  | "sick_sit"
  | "take_order"
  | "stand_talk"
  | "cook_hob"
  | "cut_hair"
  | "sew"
  | "sit_desk"
  | "eat_table"
  | "sit_table";
/** Adult looks that have every pose, prayer included. */
const ADULTS: WalkerVariant[] = ["woman_buba", "woman_gele", "man_kaftan", "man_casual", ...OUTFIT_VARIANTS];
/** Which variants have a sheet for each pose (the player's own variant always has dance, sit, eat, stand, sleep). */
export const POSE_VARIANTS: Record<PoseAction, WalkerVariant[]> = {
  dance: ["woman_gele", "man_kaftan", "woman_buba", "man_casual", ...OUTFIT_VARIANTS],
  serve: ["woman_buba", "man_casual"],
  stand_idle: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS, ...STAFF_VARIANTS],
  sit_eat: ["woman_buba", "man_kaftan", "man_casual", "woman_gele", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
  sit_talk: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
  sleep: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
  // Salah sheets put the women in a headscarf; all three prayer sheets exist for every adult look.
  pray_salah: ADULTS,
  pray_church: ADULTS,
  kneel_pray: ADULTS,
  lift_weights: ADULTS,
  boxing: ADULTS,
  run: ADULTS,
  pushups: ADULTS,
  skip_rope: ADULTS,
  check_patient: ["nurse", "doctor"],
  write_chart: ["nurse", "doctor"],
  pour_drink: ["bartender", "man_casual"],
  carry_tray: ["waiter", "chef", "man_casual"],
  serve_tray: ["waiter", "chef", "man_casual"],
  cook_stir: ["chef", "woman_buba"],
  wipe_counter: ["bartender", "waiter", "chef", "woman_buba"],
  sick_sit: ["woman_buba", "woman_gele", "man_kaftan", "man_casual"],
  take_order: ["waiter", "bartender"],
  stand_talk: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", ...OUTFIT_VARIANTS, ...STAFF_VARIANTS],
  cook_hob: ["woman_buba", "woman_gele", "chef", "man_casual"],
  cut_hair: ["man_casual", "woman_buba", "woman_gele"],
  sew: ["woman_buba", "man_kaftan"],
  sit_desk: ["man_casual", "woman_buba", "man_kaftan", "woman_gele"],
  eat_table: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
  sit_table: ["woman_buba", "woman_gele", "man_kaftan", "man_casual", "schoolgirl", "schoolboy", ...OUTFIT_VARIANTS],
};
/**
 * Each pose sheet's frame size, frame count and speed. Standing, seated and praying frames have the feet 16 px above
 * the bottom; lying (sleep) frames are centred on the middle of the body. Salah frames are wider (prostration reaches
 * forward) and only salah has a "nw" sheet (facing the mihrab).
 */
export const POSE_SHEETS: Record<PoseAction, { w: number; h: number; frames: number; fps: number; centred?: boolean; nw?: boolean; ne?: boolean; walk?: boolean }> = {
  dance: { w: 96, h: 160, frames: 8, fps: 10 },
  serve: { w: 96, h: 160, frames: 8, fps: 7 },
  stand_idle: { w: 96, h: 160, frames: 8, fps: 7 },
  // Seated: all four ways (a seat can face away from the viewer). sit_eat has a plate of jollof on the lap and a spoon.
  sit_eat: { w: 96, h: 160, frames: 8, fps: 7, nw: true, ne: true },
  sit_talk: { w: 96, h: 160, frames: 8, fps: 7, nw: true, ne: true },
  sleep: { w: 192, h: 112, frames: 8, fps: 3, centred: true },
  pray_salah: { w: 144, h: 160, frames: 16, fps: 1.6, nw: true },
  pray_church: { w: 96, h: 160, frames: 8, fps: 4 },
  kneel_pray: { w: 96, h: 160, frames: 8, fps: 2 },
  // Workouts: dumbbell curls, jab-cross in gloves (also nw, at a bag), jogging (also nw, on a treadmill),
  // push-ups (horizontal, centred like sleep) and skipping with a rope.
  lift_weights: { w: 96, h: 160, frames: 8, fps: 5 },
  boxing: { w: 112, h: 160, frames: 8, fps: 7, nw: true },
  run: { w: 96, h: 160, frames: 8, fps: 11, nw: true },
  pushups: { w: 192, h: 112, frames: 8, fps: 5, centred: true },
  skip_rope: { w: 112, h: 160, frames: 8, fps: 10 },
  // Work, facing all four ways so they can face what they work on (the bed, the pots, the counter, the customer).
  // check_patient: bent over the bed, a hand on the patient's arm, giving an injection; write_chart: writing on a
  // clipboard; take_order: a notepad, looking up at the customer now and then; pour_drink: shaking, then pouring into
  // a glass; serve_tray: a tray up on one hand, setting a plate down on the table; cook_stir: stirring a big pot on a
  // low stove (the pot is in the sheet); wipe_counter: a cloth going round on the counter top; sick_sit: a patient on
  // the edge of the bed, bent over, a hand on the stomach and one on the forehead (se/sw; the seat is behind the feet).
  // carry_tray is a walk sheet (the walk cycle with a tray up on the right hand): used while walking (Task.carry).
  check_patient: { w: 96, h: 160, frames: 8, fps: 4, nw: true, ne: true },
  write_chart: { w: 96, h: 160, frames: 8, fps: 5, nw: true, ne: true },
  take_order: { w: 96, h: 160, frames: 8, fps: 4, nw: true, ne: true },
  pour_drink: { w: 96, h: 160, frames: 8, fps: 5, nw: true, ne: true },
  serve_tray: { w: 96, h: 160, frames: 8, fps: 4, nw: true, ne: true },
  cook_stir: { w: 96, h: 160, frames: 8, fps: 6, nw: true, ne: true },
  wipe_counter: { w: 96, h: 160, frames: 8, fps: 7, nw: true, ne: true },
  sick_sit: { w: 96, h: 160, frames: 8, fps: 3 },
  carry_tray: { w: 96, h: 160, frames: 8, fps: 10, nw: true, ne: true, walk: true },
  // stand_talk: standing and chatting, hands moving (the library's talking idle): visitors, customers, a preacher.
  // cook_hob: stirring a pot on a cooker's hob (the pot is in the sheet at hob height, ~0.9 m); cut_hair: clippers
  // round a seated client's head; sew: seated at a machine feeding cloth; sit_desk: seated at a desk, typing or writing.
  // The seated ones (sew, sit_desk) are anchored at the feet like sit_talk.
  stand_talk: { w: 96, h: 160, frames: 8, fps: 6, nw: true, ne: true },
  cook_hob: { w: 96, h: 160, frames: 8, fps: 6, nw: true, ne: true },
  cut_hair: { w: 96, h: 160, frames: 8, fps: 6, nw: true, ne: true },
  sew: { w: 96, h: 160, frames: 8, fps: 6, nw: true, ne: true },
  sit_desk: { w: 96, h: 160, frames: 8, fps: 5, nw: true, ne: true },
  // eat_table: seated at a table, the plate (and a drink) on the table in front at 0.75 m, spoon to the mouth. Seated
  // on the far side of a table facing the viewer, use `behind` (the table's near edge) so the table hides the legs.
  eat_table: { w: 96, h: 160, frames: 8, fps: 5, nw: true, ne: true },
  // sit_table: seated at a table chatting, forearms on it (the legs under the table are cut away like eat_table).
  sit_table: { w: 96, h: 160, frames: 8, fps: 4, nw: true, ne: true },
};

export type Pt = [number, number];
/** Pose sheets face se or sw (towards the viewer); some also face nw or ne (POSE_SHEETS nw/ne): salah towards a mihrab
 * on the left wall, the work poses towards whatever is being worked on. */
export type Facing = "se" | "sw" | "nw" | "ne";
/** What the player is doing in a room. */
export type PlayerAction =
  | "walk"
  | "sit"
  | "eat"
  | "sleep"
  | "dance"
  | "chair"
  | "stand"
  | "pray"
  | "lift_weights"
  | "boxing"
  | "run"
  | "pushups"
  | "skip"
  | "cook";
/** Every action the player can take in a room (for callers mapping activities to actions). */
export const PLAYER_ACTIONS: PlayerAction[] = ["walk", "sit", "eat", "sleep", "dance", "chair", "stand", "pray", "lift_weights", "boxing", "run", "pushups", "skip", "cook"];
/** Marked places for the player: door (where they come in) and one per action that fits the room. */
/** "workout": a free bit of floor at home for push-ups, skipping, dumbbells or shadow boxing. */
export type SpotKey = "door" | "workout" | Exclude<PlayerAction, "walk">;
export interface Spot {
  at: Pt;
  dir: Facing;
  /** The pose played there, when not the usual one for the action (e.g. standing in a prayer row). */
  pose?: PoseAction;
  /** Hidden below this height (fraction of the image) once settled: seated behind a table, standing behind a counter. */
  behind?: number;
}
export interface Room {
  /** Open floor, in order: walkers go back and forth along it, pausing at each spot. */
  walkway: Pt[];
  walkers: number;
  /** `phase`: frames into its loop this person starts (so a row of people praying don't move in step). */
  stations: { action: PoseAction; at: Pt; dir: Facing; variant?: WalkerVariant; phase?: number; behind?: number }[];
  spots?: Partial<Record<SpotKey, Spot>>;
  /** People at work (or passing through) who move from task to task: the nurse doing her rounds, the barman
   * going from customer to customer, a patient who comes in, lies down for a while and goes home. */
  workers?: Worker[];
}

/** One stop on a worker's round: walk there (straight, they know the room), then hold the pose for `secs`. */
export interface Task {
  at: Pt;
  /** The pose there (none: just walk through, or stand for `secs`). */
  pose?: PoseAction;
  dir?: Facing;
  secs: number;
  /** Step straight onto it instead of walking (onto a bed, behind a counter). */
  snap?: boolean;
  /** Walk there carrying something (a walk-style pose sheet, e.g. carry_tray) when the look has that sheet. */
  carry?: PoseAction;
  /** Hidden below this height (fraction of the image): someone standing behind a counter or bar, whose legs the
   * counter would hide. */
  behind?: number;
}
export interface Worker {
  variant: WalkerVariant;
  /** Done in order, round and round. */
  tasks: Task[];
  /** A visitor: comes in at `door`, does the tasks once, goes out, and someone else (the next look) comes in
   * `away` seconds later. */
  visitor?: { door: Pt; away: number; variants: WalkerVariant[] };
  /** Seconds into the round they start (so two people in a room aren't in step). */
  start?: number;
}

/** Hand-marked rooms, keyed by interior art name (public/art/interiors). Every room has 2-5 people. */
export const ROOMS: Record<string, Room> = {
  buka: {
    walkway: [[0.25, 0.74], [0.33, 0.8], [0.44, 0.85], [0.54, 0.9], [0.64, 0.86]],
    walkers: 1,
    stations: [
      { action: "stand_idle", at: [0.4, 0.75], dir: "se" },
      { action: "sit_eat", at: [0.24, 0.66], dir: "se", variant: "man_kaftan" },
      { action: "sit_eat", at: [0.38, 0.57], dir: "se", variant: "woman_gele" },
    ],
    spots: { door: { at: [0.54, 0.9], dir: "se" }, eat: { at: [0.3, 0.6], dir: "se" }, stand: { at: [0.33, 0.8], dir: "se" } },
    workers: [
      // The cook in her whites at a big pot on a low stove in front of the stoves, then dishing a plate up to the
      // glass counter.
      {
        variant: "chef",
        tasks: [
          { at: [0.7, 0.84], pose: "cook_stir", dir: "ne", secs: 8 },
          { at: [0.55, 0.88], pose: "serve_tray", dir: "ne", secs: 4, carry: "carry_tray" },
          { at: [0.7, 0.84], pose: "cook_stir", dir: "nw", secs: 6 },
        ],
      },
      // Her boy takes the plates from the counter to the tables.
      {
        variant: "man_casual",
        start: 3,
        tasks: [
          { at: [0.45, 0.8], pose: "stand_idle", dir: "ne", secs: 3 },
          { at: [0.31, 0.73], pose: "serve_tray", dir: "nw", secs: 4, carry: "carry_tray" },
          { at: [0.4, 0.8], secs: 0 },
          { at: [0.43, 0.63], pose: "serve_tray", dir: "nw", secs: 4, carry: "carry_tray" },
        ],
      },
    ],
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
      { action: "sit_talk", at: [0.2, 0.68], dir: "nw" },
      { action: "sit_talk", at: [0.36, 0.6], dir: "nw", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.54, 0.6], dir: "nw", variant: "man_casual" },
      { action: "sit_talk", at: [0.46, 0.82], dir: "nw" },
      { action: "stand_idle", at: [0.7, 0.55], dir: "sw", variant: "man_casual" },
    ],
    spots: { door: { at: [0.18, 0.6], dir: "se" }, sit: { at: [0.3, 0.72], dir: "nw" }, stand: { at: [0.28, 0.55], dir: "se" } },
  },
  barbershop: {
    walkway: [[0.36, 0.86], [0.48, 0.88], [0.6, 0.8], [0.7, 0.72]],
    walkers: 1,
    stations: [
      // a client in the front chair (chairs face sw) with the barber at his side working the clippers; the second
      // barber waits at the back chair for the player; a customer on the bench
      { action: "sit_talk", at: [0.27, 0.67], dir: "sw", variant: "man-tee_blue" },
      { action: "cut_hair", at: [0.37, 0.72], dir: "nw", variant: "man_casual" },
      { action: "cut_hair", at: [0.62, 0.66], dir: "nw", variant: "woman_buba", phase: 3 },
      { action: "sit_talk", at: [0.67, 0.62], dir: "sw", variant: "man_kaftan" },
    ],
    spots: { door: { at: [0.48, 0.88], dir: "se" }, chair: { at: [0.52, 0.605], dir: "sw" }, sit: { at: [0.77, 0.66], dir: "sw" }, stand: { at: [0.6, 0.8], dir: "sw" } },
  },
  "tailor-shop": {
    walkway: [[0.28, 0.78], [0.4, 0.85], [0.52, 0.89], [0.62, 0.81], [0.73, 0.74]],
    walkers: 1,
    stations: [
      // Baba at the sewing machine; his wife cutting cloth at the table
      { action: "sew", at: [0.2, 0.67], dir: "nw", variant: "man_kaftan" },
      { action: "wipe_counter", at: [0.55, 0.77], dir: "ne", variant: "woman_buba" },
    ],
    // Stand by the dress form to be measured.
    spots: { door: { at: [0.52, 0.89], dir: "se" }, chair: { at: [0.45, 0.8], dir: "se", pose: "stand_idle" }, stand: { at: [0.45, 0.8], dir: "se" } },
  },
  "bank-hall": {
    walkway: [[0.25, 0.75], [0.4, 0.82], [0.55, 0.85], [0.7, 0.76], [0.78, 0.67]],
    walkers: 2,
    stations: [
      // one waiting in the queue, one at the teller's window, one on the bench
      { action: "stand_idle", at: [0.6, 0.71], dir: "se" },
      { action: "stand_talk", at: [0.73, 0.6], dir: "ne", variant: "man-agbada_white" },
      { action: "sit_talk", at: [0.32, 0.64], dir: "se" },
    ],
    spots: { door: { at: [0.55, 0.85], dir: "se" }, sit: { at: [0.25, 0.6], dir: "se" }, stand: { at: [0.66, 0.68], dir: "sw" } },
  },
  gym: {
    // Treadmills along the left wall, the heavy bag and dumbbell rack on the right, a mat and kettlebells in front.
    walkway: [[0.6, 0.86], [0.55, 0.78], [0.5, 0.7], [0.52, 0.64]],
    walkers: 0,
    stations: [
      { action: "run", at: [0.405, 0.535], dir: "nw", variant: "man-jersey_red", phase: 0 },
      { action: "run", at: [0.3, 0.6], dir: "nw", variant: "woman-tee_blue", phase: 3 },
      { action: "boxing", at: [0.605, 0.52], dir: "nw", variant: "man-hoodie_black" },
      { action: "lift_weights", at: [0.62, 0.66], dir: "se", variant: "woman-jersey_red", phase: 2 },
      { action: "pushups", at: [0.68, 0.73], dir: "sw", variant: "man-tee_blue" },
    ],
    spots: {
      door: { at: [0.6, 0.86], dir: "se" },
      run: { at: [0.195, 0.665], dir: "nw" },
      boxing: { at: [0.605, 0.52], dir: "nw" },
      lift_weights: { at: [0.62, 0.66], dir: "se" },
      pushups: { at: [0.68, 0.73], dir: "sw" },
      skip: { at: [0.47, 0.72], dir: "se" },
      stand: { at: [0.55, 0.78], dir: "se" },
    },
  },
  "boat-deck": {
    walkway: [[0.36, 0.56], [0.46, 0.62], [0.56, 0.58], [0.64, 0.5]],
    walkers: 1,
    stations: [
      { action: "dance", at: [0.48, 0.52], dir: "se" },
      { action: "dance", at: [0.56, 0.47], dir: "sw" },
      { action: "pour_drink", at: [0.62, 0.38], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.36, 0.46], dir: "se", variant: "woman_gele" },
    ],
    spots: { door: { at: [0.36, 0.56], dir: "se" }, dance: { at: [0.52, 0.6], dir: "se" }, stand: { at: [0.64, 0.5], dir: "sw" } },
  },
  church: {
    // The pastor at the pulpit; the congregation at the pews, hands raised in praise or kneeling in prayer.
    walkway: [[0.32, 0.74], [0.42, 0.7], [0.52, 0.66], [0.6, 0.6]],
    walkers: 0,
    stations: [
      { action: "stand_talk", at: [0.49, 0.55], dir: "se", variant: "man_kaftan" },
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
      // a client in the back chair with her stylist; the second stylist waits at the front chair for the player
      { action: "sit_talk", at: [0.45, 0.56], dir: "se", variant: "woman-ankara_green" },
      { action: "cut_hair", at: [0.53, 0.56], dir: "sw", variant: "woman_buba" },
      { action: "cut_hair", at: [0.41, 0.7], dir: "nw", variant: "woman_gele", phase: 3 },
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
      { action: "sit_talk", at: [0.7, 0.6], dir: "sw", variant: "woman_buba" },
    ],
    workers: [
      // The barman behind the bar: shaking and pouring, wiping down the bar top, along to the next customer.
      {
        variant: "bartender",
        tasks: [
          { at: [0.41, 0.5], pose: "pour_drink", dir: "sw", secs: 6, snap: true, behind: 0.43 },
          { at: [0.5, 0.52], pose: "wipe_counter", dir: "se", secs: 5, behind: 0.45 },
          { at: [0.6, 0.47], pose: "pour_drink", dir: "se", secs: 5, behind: 0.405 },
          { at: [0.5, 0.52], pose: "wipe_counter", dir: "sw", secs: 4, behind: 0.45 },
        ],
      },
      // The waitress takes an order at a table, fetches the drinks from the bar on a tray and sets them down.
      {
        variant: "waiter",
        start: 3,
        tasks: [
          { at: [0.62, 0.68], pose: "take_order", dir: "ne", secs: 5 },
          { at: [0.56, 0.56], pose: "stand_idle", dir: "nw", secs: 3 },
          { at: [0.43, 0.69], pose: "serve_tray", dir: "se", secs: 4, carry: "carry_tray" },
          { at: [0.56, 0.62], secs: 0 },
          { at: [0.62, 0.68], pose: "serve_tray", dir: "ne", secs: 4, carry: "carry_tray" },
        ],
      },
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
      { action: "stand_talk", at: [0.38, 0.56], dir: "se", variant: "man_kaftan" },
      { action: "stand_talk", at: [0.47, 0.6], dir: "nw", variant: "woman_gele" },
      { action: "stand_idle", at: [0.82, 0.64], dir: "sw", variant: "man_casual" },
    ],
    spots: { door: { at: [0.6, 0.83], dir: "se" }, stand: { at: [0.7, 0.76], dir: "sw" } },
  },
  classroom: {
    walkway: [],
    walkers: 0,
    stations: [
      { action: "stand_talk", at: [0.62, 0.46], dir: "sw", variant: "woman_buba" },
      { action: "sit_talk", at: [0.52, 0.7], dir: "ne", variant: "schoolgirl" },
      { action: "sit_talk", at: [0.68, 0.78], dir: "ne", variant: "schoolboy" },
      { action: "sit_talk", at: [0.8, 0.66], dir: "ne", variant: "schoolgirl" },
    ],
  },
  // Lagoon City University's lecture theatre: the lecturer behind the desk under the screens, students on the
  // tiered benches either side of the aisle, and a seat for you on the left bank.
  "lecture-hall": {
    walkway: [[0.22, 0.72], [0.34, 0.66], [0.46, 0.6], [0.52, 0.56]],
    walkers: 0,
    stations: [
      { action: "stand_talk", at: [0.74, 0.47], dir: "sw", variant: "man_kaftan" },
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
      { action: "stand_talk", at: [0.36, 0.64], dir: "se", variant: "woman_gele" },
      { action: "stand_talk", at: [0.6, 0.56], dir: "sw", variant: "man_kaftan" },
      { action: "stand_idle", at: [0.44, 0.5], dir: "se", variant: "woman-buba_wrapper" },
    ],
    spots: { door: { at: [0.5, 0.88], dir: "se" }, stand: { at: [0.47, 0.72], dir: "sw" } },
  },
  // Gadget Village's shop: the repair bench on the left, the phone counter on the right.
  "gadget-market": {
    walkway: [[0.5, 0.92], [0.44, 0.84], [0.5, 0.76], [0.38, 0.7]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.3, 0.8], dir: "se", variant: "man_casual" },
      { action: "stand_idle", at: [0.66, 0.8], dir: "sw", variant: "man-tee_blue" },
    ],
    spots: { door: { at: [0.5, 0.92], dir: "se" }, stand: { at: [0.56, 0.82], dir: "sw" } },
  },
  "hotel-lobby": {
    walkway: [[0.25, 0.72], [0.35, 0.8], [0.5, 0.86], [0.62, 0.8], [0.66, 0.73]],
    walkers: 2,
    stations: [
      { action: "stand_idle", at: [0.38, 0.7], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.66, 0.63], dir: "sw", variant: "woman_gele" },
    ],
    spots: { door: { at: [0.5, 0.86], dir: "se" }, sit: { at: [0.78, 0.64], dir: "sw" }, stand: { at: [0.35, 0.8], dir: "se" } },
    workers: [
      // The receptionist behind the desk, writing guests in.
      {
        variant: "waiter",
        tasks: [
          { at: [0.26, 0.64], pose: "take_order", dir: "se", secs: 8, behind: 0.585 },
          { at: [0.33, 0.62], pose: "stand_idle", dir: "se", secs: 4, behind: 0.565 },
        ],
      },
      // Room service brings drinks to the guest in the armchair, takes the next order and goes back out.
      {
        variant: "waiter",
        start: 6,
        visitor: { door: [0.5, 0.86], away: 14, variants: ["waiter"] },
        tasks: [
          { at: [0.64, 0.84], secs: 0, carry: "carry_tray" },
          { at: [0.64, 0.75], pose: "serve_tray", dir: "ne", secs: 4, carry: "carry_tray" },
          { at: [0.64, 0.75], pose: "take_order", dir: "ne", secs: 4 },
        ],
      },
    ],
  },
  // Zip 15 (batches 29-31): rooms for the new places and clean redos.
  "provision-shop": {
    walkway: [[0.72, 0.63], [0.77, 0.71], [0.72, 0.78], [0.69, 0.82]],
    walkers: 1,
    stations: [{ action: "stand_idle", at: [0.76, 0.79], dir: "sw", variant: "man_casual" }],
    spots: { door: { at: [0.69, 0.82], dir: "sw" }, stand: { at: [0.72, 0.74], dir: "sw" } },
    workers: [
      // Madam behind her counter: wiping it down, then at the till end waiting on the customer.
      {
        variant: "woman_buba",
        tasks: [
          { at: [0.42, 0.66], pose: "wipe_counter", dir: "sw", secs: 6, behind: 0.62 },
          { at: [0.56, 0.7], pose: "stand_idle", dir: "se", secs: 5, behind: 0.66 },
        ],
      },
    ],
  },
  "golf-lounge": {
    walkway: [[0.6, 0.64], [0.68, 0.7], [0.78, 0.74], [0.72, 0.82]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.27, 0.6], dir: "se", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.18, 0.68], dir: "se", variant: "woman_gele" },
    ],
    spots: { door: { at: [0.72, 0.82], dir: "se" }, stand: { at: [0.68, 0.7], dir: "sw" } },
    workers: [
      // The barman behind the bar: pouring for the stools, wiping the bar top.
      {
        variant: "bartender",
        tasks: [
          { at: [0.64, 0.58], pose: "pour_drink", dir: "sw", secs: 6, behind: 0.5 },
          { at: [0.71, 0.58], pose: "wipe_counter", dir: "sw", secs: 5, behind: 0.52 },
        ],
      },
      // The waitress takes the members' order at the sofas and brings it over on a tray.
      {
        variant: "waiter",
        start: 2,
        tasks: [
          { at: [0.45, 0.6], pose: "take_order", dir: "sw", secs: 5 },
          { at: [0.55, 0.67], pose: "stand_idle", dir: "ne", secs: 3 },
          { at: [0.24, 0.77], pose: "serve_tray", dir: "ne", secs: 4, carry: "carry_tray" },
          { at: [0.4, 0.86], secs: 0 },
        ],
      },
    ],
  },
  "stadium-room": {
    walkway: [[0.45, 0.62], [0.6, 0.7], [0.72, 0.8], [0.55, 0.85], [0.4, 0.75]],
    walkers: 2,
    stations: [
      { action: "sit_talk", at: [0.2, 0.62], dir: "se", variant: "man_casual" },
      { action: "sit_talk", at: [0.35, 0.56], dir: "se", variant: "man_casual" },
      { action: "stand_talk", at: [0.7, 0.62], dir: "sw", variant: "man_kaftan" },
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
    workers: [
      // The attendant (dark shirt, apron) wipes down the table rail between frames and waits by the drinks fridge.
      {
        variant: "bartender",
        tasks: [
          { at: [0.6, 0.79], pose: "wipe_counter", dir: "nw", secs: 6 },
          { at: [0.71, 0.71], pose: "stand_idle", dir: "sw", secs: 5 },
        ],
      },
    ],
  },
  "police-desk": {
    walkway: [[0.4, 0.62], [0.5, 0.72], [0.62, 0.8], [0.5, 0.88], [0.35, 0.78]],
    walkers: 1,
    stations: [
      // the desk sergeant behind the counter writing in the book, a man reporting a case at it, someone waiting
      { action: "sit_desk", at: [0.72, 0.5], dir: "sw", variant: "man_casual", behind: 0.48 },
      { action: "sit_talk", at: [0.18, 0.62], dir: "se" },
      { action: "stand_talk", at: [0.55, 0.65], dir: "ne", variant: "man_kaftan" },
    ],
    spots: { door: { at: [0.5, 0.88], dir: "se" }, sit: { at: [0.26, 0.66], dir: "se" }, stand: { at: [0.5, 0.72], dir: "sw" } },
  },
  "radio-studio": {
    walkway: [[0.8, 0.65], [0.85, 0.72], [0.74, 0.78]],
    walkers: 1,
    stations: [
      // the presenter at the desk on the mic, a guest talking with him across it
      { action: "sit_desk", at: [0.55, 0.575], dir: "sw", variant: "man_casual" },
      { action: "stand_talk", at: [0.74, 0.64], dir: "nw", variant: "woman_buba" },
    ],
    spots: { door: { at: [0.74, 0.78], dir: "sw" }, stand: { at: [0.8, 0.65], dir: "sw" } },
  },
  "hospital-ward": {
    // A patient in the far bed. The nurse does her rounds from the desk to each bed and back; patients come in, lie
    // in the bed by the window for a while and go home. (No idle visitor standing in the aisle.)
    walkway: [[0.42, 0.7], [0.5, 0.78], [0.58, 0.88], [0.62, 0.72]],
    walkers: 0,
    stations: [
      { action: "sleep", at: [0.48, 0.42], dir: "sw", variant: "man_kaftan" },
      // a patient in the middle bed (the player's bed: she makes way when the player lies there)
      { action: "sleep", at: [0.64, 0.5], dir: "sw", variant: "woman_buba", phase: 3 },
    ],
    spots: { door: { at: [0.58, 0.88], dir: "se" }, sleep: { at: [0.64, 0.5], dir: "sw" }, stand: { at: [0.5, 0.78], dir: "se" } },
    workers: [
      // Family come to see the patient in the middle bed: they talk at the foot of the bed for a while and go.
      {
        variant: "woman_gele",
        start: 5,
        visitor: { door: [0.58, 0.88], away: 14, variants: ["woman_gele", "man-agbada_white", "woman-ankara_green", "man_kaftan"] },
        tasks: [{ at: [0.575, 0.675], pose: "stand_talk", dir: "ne", secs: 14 }],
      },
      // The nurse writes up her notes at the desk, then goes bed to bed: at the foot of each, bent over the patient
      // (checking them and giving an injection).
      {
        variant: "nurse",
        tasks: [
          { at: [0.38, 0.72], pose: "write_chart", dir: "nw", secs: 6 },
          { at: [0.5, 0.66], pose: "check_patient", dir: "ne", secs: 6 },
          { at: [0.56, 0.8], secs: 0 },
          { at: [0.635, 0.725], pose: "check_patient", dir: "ne", secs: 6 },
          { at: [0.45, 0.8], secs: 0 },
        ],
      },
      // The doctor comes round now and then: looks at the patient in the far bed, writes on his chart, goes out.
      {
        variant: "doctor",
        start: 12,
        visitor: { door: [0.58, 0.88], away: 25, variants: ["doctor"] },
        tasks: [
          { at: [0.42, 0.61], pose: "check_patient", dir: "ne", secs: 7 },
          { at: [0.44, 0.7], pose: "write_chart", dir: "nw", secs: 6 },
        ],
      },
      // Patients come in feeling poorly, sit on the edge of the bed by the window holding their head and stomach,
      // lie down for a while and go home.
      {
        variant: "man_casual",
        start: 4,
        visitor: { door: [0.58, 0.88], away: 8, variants: ["man_casual", "woman_gele", "man_kaftan", "woman_buba"] },
        tasks: [
          { at: [0.72, 0.81], secs: 0 },
          { at: [0.84, 0.745], pose: "sick_sit", dir: "se", secs: 8 },
          { at: [0.8, 0.58], pose: "sleep", dir: "sw", secs: 30, snap: true },
          { at: [0.84, 0.745], secs: 0, snap: true },
          { at: [0.72, 0.81], secs: 0 },
        ],
      },
    ],
  },
  "library-room": {
    walkway: [[0.6, 0.62], [0.7, 0.72], [0.8, 0.78], [0.64, 0.83]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.18, 0.58], dir: "se", variant: "schoolgirl" },
      { action: "sit_talk", at: [0.38, 0.72], dir: "se", variant: "schoolboy" },
      { action: "wipe_counter", at: [0.64, 0.58], dir: "se", variant: "woman_buba" },
    ],
    spots: { door: { at: [0.64, 0.83], dir: "se" }, sit: { at: [0.28, 0.64], dir: "se" }, stand: { at: [0.7, 0.72], dir: "sw" } },
  },
  courtroom: {
    walkway: [[0.56, 0.65], [0.62, 0.68], [0.55, 0.73]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.35, 0.41], dir: "se", variant: "man_kaftan" },
      { action: "stand_talk", at: [0.62, 0.62], dir: "nw", variant: "man_casual" },
      { action: "sit_talk", at: [0.6, 0.83], dir: "se" },
    ],
    spots: { door: { at: [0.55, 0.73], dir: "se" }, sit: { at: [0.68, 0.8], dir: "se" }, stand: { at: [0.56, 0.66], dir: "se" } },
  },
  hangout: {
    walkway: [[0.47, 0.5], [0.57, 0.5], [0.64, 0.61], [0.84, 0.66]],
    walkers: 1,
    stations: [
      { action: "pour_drink", at: [0.5, 0.49], dir: "sw", variant: "man_casual" },
      { action: "stand_talk", at: [0.66, 0.53], dir: "sw", variant: "woman_gele" },
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
    stations: [{ action: "sit_eat", at: [0.38, 0.79], dir: "se", variant: "woman_buba" }],
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
      { action: "cook_hob", at: [0.5, 0.5], dir: "ne", variant: "woman_buba" },
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
    ],
    spots: {
      door: { at: [0.48, 0.86], dir: "se" },
      sleep: { at: [0.43, 0.6], dir: "sw" },
      sit: { at: [0.4, 0.69], dir: "se" },
      eat: { at: [0.5, 0.645], dir: "se" },
      stand: { at: [0.72, 0.72], dir: "sw" },
      dance: { at: [0.62, 0.82], dir: "se" },
      workout: { at: [0.62, 0.82], dir: "se" },
    },
  },
  "home-duplex": {
    // Sectional sofa round a coffee table, dining table on the left, stairs up, window on the right. Meals are
    // on the sofa by the coffee table (a seat at the dining table would be drawn over the table top).
    walkway: [[0.47, 0.92], [0.6, 0.88], [0.7, 0.8], [0.74, 0.7], [0.78, 0.63], [0.68, 0.52]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.4, 0.71], dir: "se", variant: "woman_gele" },
      { action: "sit_talk", at: [0.5, 0.67], dir: "se", variant: "man_kaftan", phase: 4 },
      // the daughter at the dining table, eating
      { action: "eat_table", at: [0.245, 0.59], dir: "se", variant: "schoolgirl" },
    ],
    spots: {
      door: { at: [0.6, 0.88], dir: "se" },
      sleep: { at: [0.44, 0.64], dir: "sw" },
      sit: { at: [0.4, 0.71], dir: "se" },
      eat: { at: [0.18, 0.625], dir: "se", pose: "eat_table" },
      stand: { at: [0.74, 0.72], dir: "sw" },
      dance: { at: [0.7, 0.8], dir: "se" },
      workout: { at: [0.7, 0.8], dir: "se" },
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
      { action: "stand_talk", at: [0.76, 0.66], dir: "sw", variant: "man_casual" },
    ],
    spots: {
      door: { at: [0.62, 0.88], dir: "se" },
      sleep: { at: [0.47, 0.575], dir: "sw" },
      sit: { at: [0.44, 0.635], dir: "se" },
      eat: { at: [0.54, 0.6], dir: "se" },
      stand: { at: [0.73, 0.64], dir: "sw" },
      dance: { at: [0.7, 0.82], dir: "se" },
      workout: { at: [0.7, 0.82], dir: "se" },
    },
  },
  "home-crazy": {
    // A throne on a dais, an aquarium wall and a supercar behind glass: no bed or table in view.
    walkway: [[0.5, 0.88], [0.58, 0.8], [0.55, 0.7], [0.65, 0.68], [0.75, 0.72], [0.68, 0.82]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.31, 0.665], dir: "se", variant: "man_kaftan" },
      { action: "stand_talk", at: [0.62, 0.7], dir: "nw", variant: "woman_buba" },
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
      { action: "stand_talk", at: [0.5, 0.52], dir: "ne", variant: "man_casual" },
    ],
    spots: {
      door: { at: [0.45, 0.82], dir: "se" },
      sit: { at: [0.555, 0.44], dir: "sw" },
      eat: { at: [0.625, 0.48], dir: "sw" },
      stand: { at: [0.4, 0.62], dir: "se" },
      dance: { at: [0.3, 0.7], dir: "se" },
      workout: { at: [0.3, 0.7], dir: "se" },
    },
  },
  "home-villa-pool": {
    // Deck round the pool: two sun loungers, a tiki bar with stools, a cushioned bench on the pool's stone edge.
    walkway: [[0.32, 0.44], [0.42, 0.44], [0.5, 0.5], [0.6, 0.53], [0.7, 0.56], [0.74, 0.68]],
    walkers: 1,
    stations: [
      { action: "sleep", at: [0.26, 0.63], dir: "se", variant: "woman_gele" },
      { action: "sit_talk", at: [0.575, 0.435], dir: "ne", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.78, 0.66], dir: "sw", variant: "woman_buba" },
    ],
    spots: {
      door: { at: [0.32, 0.44], dir: "se" },
      sleep: { at: [0.36, 0.575], dir: "se" },
      sit: { at: [0.78, 0.66], dir: "sw" },
      // the second stool at the tiki bar (bar stools: feet on the footrest, a bit above the floor)
      eat: { at: [0.64, 0.475], dir: "ne", pose: "eat_table" },
      stand: { at: [0.45, 0.47], dir: "se" },
      dance: { at: [0.5, 0.5], dir: "se" },
      workout: { at: [0.5, 0.5], dir: "se" },
    },
  },
  "home-bedroom": {
    // Bed under a mosquito net, wardrobe, mirror shelf, standing fan; the rest is open floor.
    walkway: [[0.45, 0.82], [0.55, 0.75], [0.6, 0.66], [0.7, 0.6], [0.8, 0.68]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.24, 0.7], dir: "sw", variant: "woman_gele" },
      { action: "stand_talk", at: [0.7, 0.58], dir: "sw", variant: "man_casual" },
    ],
    spots: {
      door: { at: [0.5, 0.85], dir: "se" },
      sleep: { at: [0.3, 0.56], dir: "se" },
      sit: { at: [0.24, 0.7], dir: "sw" },
      eat: { at: [0.24, 0.7], dir: "sw" },
      stand: { at: [0.62, 0.66], dir: "sw" },
      dance: { at: [0.55, 0.75], dir: "se" },
      workout: { at: [0.55, 0.75], dir: "se" },
    },
  },
  "home-kitchen": {
    // Cooker and counters along the back, a dining table with chairs on the right, checkered floor.
    walkway: [[0.35, 0.72], [0.45, 0.62], [0.55, 0.55], [0.6, 0.7], [0.5, 0.82], [0.4, 0.8]],
    walkers: 1,
    stations: [
      // mum at the cooker stirring the pot; dad at the table eating
      { action: "cook_hob", at: [0.3, 0.665], dir: "nw", variant: "woman_buba" },
      { action: "eat_table", at: [0.73, 0.67], dir: "se", variant: "man_kaftan" },
    ],
    spots: {
      door: { at: [0.5, 0.85], dir: "se" },
      eat: { at: [0.855, 0.64], dir: "sw", pose: "eat_table" },
      sit: { at: [0.855, 0.64], dir: "sw", pose: "sit_table" },
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
      { action: "stand_talk", at: [0.3, 0.68], dir: "se", variant: "man_kaftan" },
    ],
    spots: {
      door: { at: [0.52, 0.84], dir: "se" },
      sleep: { at: [0.6, 0.54], dir: "sw" },
      sit: { at: [0.57, 0.69], dir: "se" },
      eat: { at: [0.57, 0.69], dir: "se" },
      stand: { at: [0.65, 0.78], dir: "sw" },
      dance: { at: [0.42, 0.75], dir: "se" },
      workout: { at: [0.42, 0.75], dir: "se" },
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
      workout: { at: [0.4, 0.74], dir: "se" },
    },
  },
  "home-villa-kitchen": {
    // Fitted kitchen: hob and oven on the left run, an island with three bar stools facing it (ne), big fridge on the
    // right. Bar stools are tall: seated people are anchored with their feet on the stool's footrest (a bit above the
    // floor), so they sit at the stool's seat height.
    walkway: [[0.3, 0.62], [0.4, 0.72], [0.52, 0.8], [0.65, 0.76], [0.75, 0.68], [0.8, 0.62]],
    walkers: 0,
    stations: [
      { action: "eat_table", at: [0.535, 0.598], dir: "ne", variant: "man_casual" },
      { action: "sit_talk", at: [0.595, 0.643], dir: "ne", variant: "woman_gele", phase: 3 },
    ],
    workers: [
      // Mum at the hob stirring the pot, turning now and then to talk to the two at the island.
      {
        variant: "woman_buba",
        tasks: [
          { at: [0.41, 0.515], pose: "cook_hob", dir: "nw", secs: 10 },
          { at: [0.42, 0.53], pose: "stand_talk", dir: "se", secs: 4 },
        ],
      },
    ],
    spots: {
      door: { at: [0.52, 0.82], dir: "se" },
      eat: { at: [0.475, 0.553], dir: "ne", pose: "eat_table" },
      sit: { at: [0.475, 0.553], dir: "ne" },
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
  // ---- Stitch zip 18: new rooms (2026-10-13). Bar stools and stages: people are anchored a little above the floor
  // (feet on the footrest or the stage) so they sit or stand at the right height.
  "hospital-ward-4": {
    // Two beds with drips and curtains, the nurses' desk on the left, the door on the right wall.
    walkway: [[0.8, 0.63], [0.7, 0.7], [0.58, 0.74], [0.45, 0.72], [0.35, 0.8]],
    walkers: 0,
    stations: [
      { action: "sleep", at: [0.53, 0.41], dir: "se", variant: "man_kaftan" },
      // the player's bed: she makes way when the player lies down there
      { action: "sleep", at: [0.35, 0.5], dir: "se", variant: "woman_buba", phase: 3 },
    ],
    spots: { door: { at: [0.8, 0.63], dir: "sw" }, sleep: { at: [0.35, 0.5], dir: "se" }, stand: { at: [0.6, 0.74], dir: "sw" } },
    workers: [
      // The nurse writes up her notes at the desk, then checks each patient at the foot of the bed.
      {
        variant: "nurse",
        tasks: [
          { at: [0.27, 0.8], pose: "write_chart", dir: "nw", secs: 6 },
          { at: [0.48, 0.63], pose: "check_patient", dir: "nw", secs: 6 },
          { at: [0.6, 0.63], secs: 0 },
          { at: [0.66, 0.525], pose: "check_patient", dir: "nw", secs: 6 },
          { at: [0.5, 0.75], secs: 0 },
        ],
      },
      // The doctor comes round now and then: at the bedside, then writing on the chart, and out.
      {
        variant: "doctor",
        start: 10,
        visitor: { door: [0.8, 0.63], away: 30, variants: ["doctor"] },
        tasks: [
          { at: [0.37, 0.655], pose: "check_patient", dir: "ne", secs: 7 },
          { at: [0.45, 0.72], pose: "write_chart", dir: "nw", secs: 5 },
        ],
      },
      // Family come to see the man in the far bed, talk for a while at the foot of it and go.
      {
        variant: "woman_gele",
        start: 4,
        visitor: { door: [0.8, 0.63], away: 12, variants: ["woman_gele", "man-agbada_white", "woman-ankara_green", "man_casual"] },
        tasks: [{ at: [0.6, 0.575], pose: "stand_talk", dir: "nw", secs: 14 }],
      },
    ],
  },
  "consulting-room": {
    // The doctor's desk with his chair behind it and two patient chairs in front (seen from behind), the examination
    // couch, scales, cabinet and sink.
    walkway: [[0.6, 0.88], [0.55, 0.78], [0.5, 0.7], [0.62, 0.68]],
    walkers: 0,
    stations: [{ action: "sit_desk", at: [0.21, 0.595], dir: "se", variant: "doctor" }],
    spots: {
      door: { at: [0.6, 0.88], dir: "se" },
      sit: { at: [0.39, 0.67], dir: "nw", behind: 0.6 },
      sleep: { at: [0.52, 0.43], dir: "se" },
      stand: { at: [0.6, 0.76], dir: "sw" },
    },
    workers: [
      // Patients come in, sit in front of the doctor, get up on the couch to be examined and go home.
      {
        variant: "man_casual",
        start: 2,
        visitor: { door: [0.6, 0.88], away: 6, variants: ["man_casual", "woman_buba", "man_kaftan", "woman_gele"] },
        tasks: [
          { at: [0.28, 0.73], pose: "sit_talk", dir: "nw", secs: 10, behind: 0.665 },
          { at: [0.5, 0.7], secs: 0 },
          { at: [0.52, 0.43], pose: "sleep", dir: "se", secs: 10, snap: true },
          { at: [0.5, 0.7], secs: 0, snap: true },
        ],
      },
      // The nurse writes at the cabinet and checks the patient on the couch.
      {
        variant: "nurse",
        start: 6,
        tasks: [
          { at: [0.7, 0.66], pose: "write_chart", dir: "ne", secs: 8 },
          { at: [0.6, 0.62], pose: "check_patient", dir: "nw", secs: 6 },
        ],
      },
    ],
  },
  restaurant: {
    // Four tables with white cloths, the kitchen pass on the left wall, the bar counter with the till on the right.
    walkway: [[0.5, 0.92], [0.38, 0.84], [0.35, 0.74], [0.42, 0.63], [0.56, 0.6], [0.6, 0.5]],
    walkers: 0,
    stations: [
      // Seated at a table (eat_table, sit_table): the anchor is the feet, under the table, so that the hips land on the
      // chair's seat: seat + (0.03, 0.054) facing se, seat + (-0.03, 0.054) facing sw.
      { action: "eat_table", at: [0.405, 0.574], dir: "se", variant: "man-agbada_white" },
      { action: "eat_table", at: [0.47, 0.554], dir: "sw", variant: "woman-peplum_coral", phase: 3 },
      { action: "eat_table", at: [0.64, 0.69], dir: "se", variant: "woman_gele", phase: 5 },
      { action: "sit_table", at: [0.71, 0.674], dir: "sw", variant: "man_kaftan" },
      { action: "sit_table", at: [0.435, 0.844], dir: "se", variant: "woman-tee_blue", phase: 2 },
    ],
    spots: {
      door: { at: [0.5, 0.92], dir: "se" },
      eat: { at: [0.185, 0.694], dir: "se", pose: "eat_table" },
      sit: { at: [0.26, 0.674], dir: "sw", pose: "sit_table" },
      stand: { at: [0.56, 0.6], dir: "se" },
    },
    workers: [
      // The waiter takes orders and carries plates from the kitchen pass to the tables.
      {
        variant: "waiter",
        tasks: [
          { at: [0.35, 0.61], pose: "take_order", dir: "ne", secs: 5 },
          { at: [0.36, 0.52], pose: "stand_idle", dir: "nw", secs: 3 },
          { at: [0.6, 0.72], pose: "serve_tray", dir: "ne", secs: 4, carry: "carry_tray" },
          { at: [0.42, 0.68], secs: 0 },
        ],
      },
      // The chef at the pass, wiping down and dishing up.
      { variant: "chef", tasks: [{ at: [0.28, 0.5], pose: "wipe_counter", dir: "se", secs: 8, behind: 0.455 }] },
      // The barman at the till end of the counter.
      {
        variant: "bartender",
        tasks: [
          { at: [0.8, 0.5], pose: "pour_drink", dir: "sw", secs: 6, behind: 0.47 },
          { at: [0.74, 0.47], pose: "wipe_counter", dir: "sw", secs: 5, behind: 0.44 },
        ],
      },
    ],
  },
  "cocktail-bar": {
    // A long bar with green stools facing it (ne), high tables on the left, one in front. Bar stools: feet on the
    // footrest.
    walkway: [[0.3, 0.75], [0.38, 0.68], [0.48, 0.66], [0.6, 0.72], [0.72, 0.78]],
    walkers: 1,
    stations: [
      { action: "sit_talk", at: [0.488, 0.52], dir: "ne", variant: "woman-peplum_coral" },
      { action: "sit_talk", at: [0.618, 0.59], dir: "ne", variant: "man-agbada_white", phase: 3 },
      { action: "sit_talk", at: [0.683, 0.63], dir: "ne", variant: "woman_gele", phase: 6 },
    ],
    spots: {
      door: { at: [0.3, 0.75], dir: "se" },
      sit: { at: [0.553, 0.575], dir: "ne" },
      eat: { at: [0.553, 0.575], dir: "ne", pose: "eat_table" },
      dance: { at: [0.42, 0.66], dir: "se" },
      stand: { at: [0.38, 0.68], dir: "se" },
    },
    workers: [
      {
        variant: "bartender",
        tasks: [
          { at: [0.56, 0.47], pose: "pour_drink", dir: "sw", secs: 6, behind: 0.44 },
          { at: [0.66, 0.52], pose: "wipe_counter", dir: "sw", secs: 4, behind: 0.49 },
          { at: [0.5, 0.44], pose: "take_order", dir: "sw", secs: 4, behind: 0.41 },
        ],
      },
      // The waitress takes drinks from the end of the bar to the table in front.
      {
        variant: "waiter",
        start: 3,
        tasks: [
          { at: [0.8, 0.68], pose: "stand_idle", dir: "nw", secs: 3 },
          { at: [0.58, 0.8], pose: "serve_tray", dir: "sw", secs: 4, carry: "carry_tray" },
          { at: [0.43, 0.75], pose: "take_order", dir: "se", secs: 4 },
        ],
      },
    ],
  },
  "boxing-gym": {
    // The ring in the middle (raised: people in it stand a little above the floor), heavy bags hanging at the back,
    // a speed bag on the left wall, benches and gear on the right.
    walkway: [[0.5, 0.92], [0.3, 0.84], [0.2, 0.7], [0.3, 0.55], [0.8, 0.72]],
    walkers: 0,
    stations: [
      { action: "boxing", at: [0.44, 0.585], dir: "se", variant: "man-hoodie_black" },
      { action: "boxing", at: [0.56, 0.645], dir: "nw", variant: "man-jersey_red", phase: 4 },
      { action: "boxing", at: [0.47, 0.445], dir: "nw", variant: "woman-tee_blue", phase: 2 },
      { action: "skip_rope", at: [0.72, 0.84], dir: "sw", variant: "man-tee_blue" },
      { action: "stand_talk", at: [0.8, 0.66], dir: "nw", variant: "man_kaftan" },
    ],
    spots: {
      door: { at: [0.5, 0.92], dir: "se" },
      boxing: { at: [0.56, 0.43], dir: "nw" },
      skip: { at: [0.3, 0.8], dir: "se" },
      stand: { at: [0.3, 0.84], dir: "se" },
    },
  },
  "beach-cabana": {
    // Two striped loungers under a thatched roof, a low table with coconuts and fruit, the sea beyond.
    walkway: [[0.75, 0.88], [0.66, 0.8], [0.58, 0.74], [0.7, 0.68]],
    walkers: 0,
    stations: [{ action: "sleep", at: [0.55, 0.57], dir: "se", variant: "woman_gele" }],
    spots: {
      door: { at: [0.75, 0.88], dir: "sw" },
      sleep: { at: [0.36, 0.7], dir: "se" },
      dance: { at: [0.7, 0.8], dir: "sw" },
      stand: { at: [0.62, 0.78], dir: "sw" },
    },
    workers: [
      // The attendant brings coconuts and drinks on a tray and goes back to the beach bar.
      {
        variant: "waiter",
        start: 4,
        visitor: { door: [0.75, 0.88], away: 18, variants: ["waiter"] },
        tasks: [{ at: [0.56, 0.74], pose: "serve_tray", dir: "nw", secs: 5, carry: "carry_tray" }],
      },
    ],
  },
  "lecture-theatre": {
    // Two banks of long desks with seats on their near side, students facing the screen and whiteboard (ne); the
    // lecturer by the lectern.
    walkway: [[0.6, 0.9], [0.66, 0.78], [0.74, 0.68], [0.8, 0.6]],
    walkers: 0,
    stations: [
      { action: "stand_talk", at: [0.78, 0.58], dir: "sw", variant: "man_kaftan" },
      { action: "sit_desk", at: [0.235, 0.645], dir: "ne", variant: "woman_buba" },
      { action: "sit_desk", at: [0.36, 0.595], dir: "ne", variant: "man_casual", phase: 3 },
      { action: "sit_desk", at: [0.5, 0.835], dir: "ne", variant: "woman_gele", phase: 5 },
      { action: "sit_desk", at: [0.62, 0.765], dir: "ne", variant: "man_kaftan", phase: 1 },
    ],
    spots: {
      door: { at: [0.6, 0.9], dir: "se" },
      sit: { at: [0.42, 0.765], dir: "ne", pose: "sit_table" },
      stand: { at: [0.74, 0.68], dir: "sw" },
    },
  },
  "uni-cafeteria": {
    // The serving counter with trays of rice, stew and plantain on the left; long tables with benches.
    walkway: [[0.35, 0.88], [0.3, 0.76], [0.25, 0.68], [0.45, 0.48], [0.6, 0.38]],
    walkers: 1,
    stations: [
      // on the far benches facing the room (anchor: the feet, under the table)
      { action: "eat_table", at: [0.41, 0.67], dir: "se", variant: "schoolboy" },
      { action: "eat_table", at: [0.475, 0.64], dir: "se", variant: "woman-tee_blue", phase: 3 },
      { action: "eat_table", at: [0.625, 0.535], dir: "se", variant: "man-hoodie_black", phase: 5 },
      { action: "sit_table", at: [0.69, 0.505], dir: "se", variant: "woman-jersey_red" },
      { action: "eat_table", at: [0.63, 0.735], dir: "se", variant: "schoolgirl", phase: 2 },
    ],
    spots: {
      door: { at: [0.35, 0.88], dir: "se" },
      eat: { at: [0.565, 0.765], dir: "se", pose: "eat_table" },
      sit: { at: [0.817, 0.603], dir: "nw", pose: "sit_table" },
      stand: { at: [0.3, 0.76], dir: "ne" },
    },
    workers: [
      // Behind the counter, dishing up from the trays.
      { variant: "chef", tasks: [{ at: [0.28, 0.5], pose: "serve_tray", dir: "se", secs: 6, behind: 0.43 }, { at: [0.38, 0.45], pose: "wipe_counter", dir: "se", secs: 5, behind: 0.39 }] },
    ],
  },
  "brt-bus": {
    // Inside a BRT bus: the driver at the front (left), pairs of seats facing forward (sw), grab rails for standing.
    walkway: [[0.62, 0.86], [0.5, 0.74], [0.4, 0.66]],
    walkers: 0,
    stations: [
      { action: "sit_talk", at: [0.17, 0.62], dir: "sw", variant: "man_casual" },
      { action: "sit_talk", at: [0.37, 0.555], dir: "sw", variant: "woman_buba", phase: 2 },
      { action: "sit_talk", at: [0.62, 0.56], dir: "sw", variant: "man-tee_blue", phase: 5 },
      { action: "sit_talk", at: [0.67, 0.6], dir: "sw", variant: "woman-hoodie_black", phase: 1 },
      { action: "stand_idle", at: [0.48, 0.72], dir: "sw", variant: "man-jersey_red" },
    ],
    spots: { door: { at: [0.62, 0.86], dir: "sw" }, sit: { at: [0.5, 0.62], dir: "sw" }, stand: { at: [0.4, 0.66], dir: "sw" } },
  },
  coach: {
    // Inside an interstate coach: rows of reclining seats facing the front (sw), tables between some, luggage racks.
    walkway: [[0.32, 0.6], [0.4, 0.68], [0.5, 0.75]],
    walkers: 0,
    stations: [
      { action: "sit_talk", at: [0.58, 0.46], dir: "sw", variant: "man_kaftan" },
      { action: "sit_talk", at: [0.7, 0.6], dir: "sw", variant: "woman_gele" },
      { action: "sit_talk", at: [0.62, 0.7], dir: "sw", variant: "woman-buba_wrapper", phase: 3 },
    ],
    spots: { door: { at: [0.32, 0.6], dir: "se" }, sit: { at: [0.5, 0.6], dir: "sw" }, stand: { at: [0.4, 0.68], dir: "se" } },
  },
  theatre: {
    // Rows of red seats facing the stage (ne); performers on the raised stage.
    walkway: [[0.32, 0.84], [0.3, 0.78], [0.45, 0.72]],
    walkers: 0,
    stations: [
      { action: "dance", at: [0.63, 0.44], dir: "sw", variant: "woman-peplum_coral" },
      { action: "stand_talk", at: [0.68, 0.48], dir: "sw", variant: "man-agbada_white" },
      { action: "sit_talk", at: [0.3, 0.6], dir: "ne", variant: "woman_gele" },
      { action: "sit_talk", at: [0.46, 0.7], dir: "ne", variant: "man_kaftan", phase: 3 },
      { action: "sit_talk", at: [0.38, 0.8], dir: "ne", variant: "woman-tee_blue", phase: 5 },
    ],
    spots: { door: { at: [0.32, 0.84], dir: "se" }, sit: { at: [0.53, 0.75], dir: "ne" }, stand: { at: [0.45, 0.72], dir: "ne" } },
  },
  "crusade-tent": {
    // A big white tent: the stage with pulpit, keyboard and drums at the back, rows of folding chairs facing it (ne).
    walkway: [[0.62, 0.92], [0.55, 0.8], [0.45, 0.68], [0.68, 0.62]],
    walkers: 0,
    stations: [
      { action: "stand_talk", at: [0.585, 0.47], dir: "sw", variant: "man-agbada_white", behind: 0.45 },
      { action: "pray_church", at: [0.3, 0.66], dir: "ne", variant: "woman_gele" },
      { action: "pray_church", at: [0.4, 0.6], dir: "ne", variant: "man_kaftan", phase: 3 },
      { action: "sit_talk", at: [0.52, 0.76], dir: "ne", variant: "woman-ankara_green" },
      { action: "pray_church", at: [0.66, 0.68], dir: "ne", variant: "man-tee_blue", phase: 5 },
    ],
    spots: {
      door: { at: [0.62, 0.92], dir: "se" },
      sit: { at: [0.44, 0.83], dir: "ne" },
      pray: { at: [0.55, 0.8], dir: "ne", pose: "pray_church" },
      stand: { at: [0.45, 0.68], dir: "ne" },
    },
  },
};
