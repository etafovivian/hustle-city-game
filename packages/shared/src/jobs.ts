// Jobs at places: work a shift where you hang out and climb from the bottom (dishwasher → head cook). A shift plays
// in the room for a few seconds, pays City Coins and XP, costs energy and a bit of food, and counts towards the next
// promotion. Shifts are capped per Lagos day; branches share their original's job.

export interface Job {
  /** Base venue key. */
  venue: string;
  /** Titles from the first rung up (four rungs). */
  titles: readonly [string, string, string, string];
  /** What you do on a shift, for the card. */
  task: string;
  /** Pay multiplier for the place (banks and hotels pay more than a buka). */
  tier: number;
}

export const JOBS: readonly Job[] = [
  { venue: "mama_nkechi_buka", titles: ["Dishwasher", "Kitchen help", "Cook", "Head cook"], task: "Wash plates, pound yam, serve the queue", tier: 1 },
  { venue: "sharp_cuts", titles: ["Sweeper", "Apprentice barber", "Barber", "Master barber"], task: "Line-ups, beard trims and football gist", tier: 1 },
  { venue: "junction_motor_park", titles: ["Bus caller", "Conductor", "Driver", "Park manager"], task: "Call the routes and pack the danfo", tier: 0.9 },
  { venue: "royal_event_centre", titles: ["Waiter", "Usher", "MC's assistant", "Event planner"], task: "Serve small chops and keep the party moving", tier: 1.1 },
  { venue: "tailors_row", titles: ["Errand boy", "Apprentice tailor", "Tailor", "Fashion designer"], task: "Measure, cut and sew aso-ebi", tier: 1 },
  { venue: "viewing_centre", titles: ["Gate keeper", "Attendant", "Supervisor", "Owner's partner"], task: "Collect the gate fee and keep the generator running", tier: 0.9 },
  { venue: "mallam_suya", titles: ["Suya boy", "Grill hand", "Suya master", "Spot owner"], task: "Slice, spice and grill", tier: 1 },
  { venue: "lampnet_academy", titles: ["Class rep", "Teaching assistant", "Tutor", "Lead instructor"], task: "Help learners through the day's lesson", tier: 1.2 },
  { venue: "lagoon_capital_bank", titles: ["Cleaner", "Teller", "Customer officer", "Branch manager"], task: "Count cash and calm the queue", tier: 1.4 },
  { venue: "grand_lagoon_hotel", titles: ["Porter", "Receptionist", "Duty manager", "General manager"], task: "Check guests in and keep the lobby sharp", tier: 1.3 },
  { venue: "fit_lagos", titles: ["Front desk", "Floor trainer", "Personal trainer", "Head coach"], task: "Spot lifts and run the evening class", tier: 1.1 },
  { venue: "skyline_lounge", titles: ["Glass collector", "Waiter", "Bartender", "Resident DJ"], task: "Keep the bottles moving and the crowd happy", tier: 1.2 },
  { venue: "island_motors", titles: ["Car washer", "Sales assistant", "Sales executive", "Showroom manager"], task: "Polish the cars and close a sale", tier: 1.3 },
  { venue: "lagoon_golf_club", titles: ["Caddie", "Starter", "Club pro", "Club captain"], task: "Carry bags and read the greens", tier: 1.3 },
  { venue: "glory_hair_salon", titles: ["Shampoo girl", "Braider", "Stylist", "Salon manager"], task: "Wash, braid and fix wigs", tier: 1 },
  { venue: "city_stadium", titles: ["Steward", "Ticket checker", "Ground manager", "Club scout"], task: "Check tickets and keep the stands safe", tier: 1 },
  { venue: "oga_snooker", titles: ["Table brusher", "Marker", "Hustler", "Spot manager"], task: "Rack the balls and mark the scores", tier: 0.9 },
  { venue: "lagoon_boat_cruise", titles: ["Deckhand", "Steward", "First mate", "Captain"], task: "Tie the ropes and serve the deck", tier: 1.2 },
  { venue: "balogun_market", titles: ["Alabaru (load carrier)", "Shop boy", "Trader", "Market leader"], task: "Carry loads, call customers, close sales", tier: 1 },
  { venue: "high_court", titles: ["Messenger", "Court clerk", "Registrar", "Chief registrar"], task: "File the cause list and swear in witnesses", tier: 1.2 },
  { venue: "city_library", titles: ["Shelver", "Library assistant", "Librarian", "Head librarian"], task: "Shelve books and help students", tier: 1 },
  { venue: "city_fm", titles: ["Runner", "Producer", "OAP", "Station manager"], task: "Take calls and run the morning show", tier: 1.2 },
  { venue: "ring_kings_boxing", titles: ["Towel boy", "Sparring partner", "Assistant coach", "Head coach"], task: "Hold the pads, wrap hands and run the morning session", tier: 1 },
  { venue: "sandbar_beach", titles: ["Beach cleaner", "Cabana attendant", "Lifeguard", "Beach manager"], task: "Rake the sand, serve the cabanas and watch the water", tier: 1.1 },
  // The phone-repair apprentice side hustle: changes screens and flashes phones, trains Tech
  { venue: "gadget_village", titles: ["Phone repair apprentice", "Repair engineer", "Shop manager", "Plaza boss"], task: "Change screens, flash phones and price accessories", tier: 1.1 },
  { venue: "crown_arts_theatre", titles: ["Usher", "Stagehand", "Stage manager", "Artistic director"], task: "Seat the audience and move the set between scenes", tier: 1 },
  // Abuja
  { venue: "abuja_secretariat", titles: ["Messenger", "Clerical officer", "Assistant director", "Permanent secretary"], task: "Move files, stamp letters and sit in meetings", tier: 1.4 },
  { venue: "capital_lights_lounge", titles: ["Glass collector", "Waiter", "Bartender", "Floor manager"], task: "Keep the bottles moving for the VIP tables", tier: 1.3 },
  { venue: "zone5_market", titles: ["Load carrier", "Shop boy", "Trader", "Market leader"], task: "Carry loads, call customers, close sales", tier: 1 },
  { venue: "capital_polo_club", titles: ["Stable hand", "Groom", "Caddie master", "Club secretary"], task: "Exercise the ponies and keep the greens", tier: 1.3 },
  { venue: "general_hospital", titles: ["Porter", "Nurse aide", "Nurse", "Matron"], task: "Push trolleys and check blood pressure", tier: 1.2 },
];
export const JOB_BY_VENUE: ReadonlyMap<string, Job> = new Map(JOBS.map((j) => [j.venue, j]));

/** Shifts needed to reach each rung (the first rung is where you start). */
export const PROMOTE_AT = [0, 4, 12, 25] as const;
/** Base pay per shift at each rung, before the place's tier. */
export const SHIFT_PAY = [400, 600, 850, 1200] as const;
export const SHIFT_XP = [10, 12, 15, 18] as const;
/** Shifts per player per Lagos day, across all jobs. */
export const SHIFTS_PER_DAY = 4;
/** Seconds a shift plays in the room. */
export const SHIFT_SECONDS = 20;
/** Needs a shift uses up; too tired to work below MIN_ENERGY. */
export const SHIFT_COST = { energy: 12, food: 6 };
export const MIN_ENERGY = 15;

export const rungFor = (shifts: number) => (shifts >= PROMOTE_AT[3] ? 3 : shifts >= PROMOTE_AT[2] ? 2 : shifts >= PROMOTE_AT[1] ? 1 : 0);
export const shiftPay = (job: Job, rung: number) => Math.round((SHIFT_PAY[rung]! * job.tier) / 10) * 10;

export interface JobView {
  venue: string;
  title: string;
  rung: number;
  shifts: number;
  /** Shifts until the next title, or null at the top. */
  toNext: number | null;
  nextTitle: string | null;
  pay: number;
  xp: number;
  /** Shifts left today across all jobs. */
  shiftsLeftToday: number;
}

export function jobView(job: Job, shifts: number, doneToday: number): JobView {
  const rung = rungFor(shifts);
  return {
    venue: job.venue,
    title: job.titles[rung]!,
    rung,
    shifts,
    toNext: rung < 3 ? PROMOTE_AT[rung + 1]! - shifts : null,
    nextTitle: rung < 3 ? job.titles[rung + 1]! : null,
    pay: shiftPay(job, rung),
    xp: SHIFT_XP[rung]!,
    shiftsLeftToday: Math.max(0, SHIFTS_PER_DAY - doneToday),
  };
}
