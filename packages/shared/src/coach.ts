// The interstate coach: the trip out to Ogun State is a scene of its own. Two things happen on the road (a
// checkpoint, hawkers at the junction, a preacher, a burst tyre, a trailer go-slow, a medicine seller) and the
// player picks how to handle each. Which two is fixed by the ride (same on the client and the server); the server
// rolls any gamble and settles each event once.
import type { NeedKey } from "./needs.js";
import type { SkillKey } from "./skills.js";

export type CoachEventKey =
  | "checkpoint"
  | "hawkers"
  | "preacher"
  | "tyre"
  | "goslow"
  | "medicine"
  // On a flight
  | "gate"
  | "turbulence"
  | "trolley"
  | "bigman"
  | "overhead"
  | "landing";

export interface CoachOutcome {
  /** Coins (negative: you pay). */
  coins?: number;
  needs?: Partial<Record<NeedKey, number>>;
  xp?: number;
  /** Skill points earned. */
  skill?: [SkillKey, number];
  message: string;
}

export interface CoachChoice {
  key: string;
  label: string;
  /** What it costs or risks, shown on the button. */
  note: string;
  /** A gamble: the chance it works (plus SKILL_ODDS per level of `skill`); `fail` happens otherwise. */
  odds?: number;
  oddsSkill?: SkillKey;
  win: CoachOutcome;
  fail?: CoachOutcome;
}

export interface CoachEvent {
  key: CoachEventKey;
  title: string;
  icon: string;
  /** What you see out of the window or in the aisle. */
  scene: string;
  /** Someone talking. */
  line: string;
  choices: readonly CoachChoice[];
}

export const COACH_EVENTS: readonly CoachEvent[] = [
  {
    key: "checkpoint",
    title: "Checkpoint at the toll",
    icon: "👮",
    scene: "Two officers wave the coach onto the shoulder. One climbs in with a torch.",
    line: "\"Everybody, ID card. Wetin you carry for that bag?\"",
    choices: [
      { key: "show", label: "Show your ID card", note: "Free; takes a while", win: { needs: { fun: -4 }, message: "He looks at your card for a long time, then hands it back. \"Go.\"" } },
      { key: "driver", label: "Let the driver settle it", note: "50 coins to the driver", win: { coins: -50, message: "Everyone drops 50 for the driver. The coach is moving again in a minute." } },
      {
        key: "rights",
        label: "Know your rights",
        note: "Charisma helps; lose and it costs 200",
        odds: 0.5,
        oddsSkill: "charisma",
        win: { xp: 10, skill: ["charisma", 6], needs: { social: 6 }, message: "You quote the law, politely. He laughs, \"Lawyer!\", and waves the coach on. Passengers clap." },
        fail: { coins: -200, needs: { fun: -8 }, message: "He didn't like that. Twenty minutes on the shoulder and 200 coins later, you're moving." },
      },
    ],
  },
  {
    key: "hawkers",
    title: "Hawkers at the junction",
    icon: "🌽",
    scene: "At the junction the coach slows and hawkers run alongside, trays up at the windows.",
    line: "\"Plantain chips! Bread! Gala! Cold water, cold water!\"",
    choices: [
      { key: "chips", label: "Plantain chips and cold water", note: "100 coins · +Food", win: { coins: -100, needs: { food: 10, health: 2 }, message: "Crunchy, salty, gone in five minutes." } },
      { key: "bread", label: "Agege bread and roasted corn", note: "250 coins · ++Food", win: { coins: -250, needs: { food: 25 }, message: "The bread is still warm. Belle full for the rest of the trip." } },
      { key: "no", label: "No thanks", note: "Free", win: { message: "You wave them off. The smell of roasted corn follows you down the road." } },
    ],
  },
  {
    key: "preacher",
    title: "A preacher on board",
    icon: "📖",
    scene: "A man stands up in the aisle with a small Bible and clears his throat.",
    line: "\"Brothers and sisters, before we reach our destination, let us pray!\"",
    choices: [
      { key: "amen", label: "Say amen, drop an offering", note: "50 coins · +Social", win: { coins: -50, needs: { social: 8 }, xp: 2, message: "He prays for journey mercies. The aunty beside you says \"Amen!\" louder than everyone." } },
      { key: "sleep", label: "Sleep through it", note: "Free · +Energy", win: { needs: { energy: 10 }, message: "You wake up two towns later with a stiff neck. Rested, though." } },
      { key: "earphones", label: "Earphones in", note: "Free · +Fun", win: { needs: { fun: 6 }, message: "Your playlist wins. Barely." } },
    ],
  },
  {
    key: "tyre",
    title: "Burst tyre!",
    icon: "🛞",
    scene: "BANG. The coach shudders onto the shoulder. The driver gets out, looks, and sighs.",
    line: "\"Men, come help me small. Women, rest under the tree.\"",
    choices: [
      { key: "help", label: "Help change the tyre", note: "−Energy · +Fitness", win: { needs: { energy: -10, social: 6 }, xp: 8, skill: ["fitness", 6], message: "Five of you lift, the driver spins the spanner. Done in fifteen minutes. He shakes your hand." } },
      { key: "shade", label: "Wait in the shade", note: "Free", win: { needs: { fun: -4 }, message: "You wait under a mango tree, swatting flies, until the horn calls you back." } },
      { key: "water", label: "Buy cold water from a boy", note: "50 coins · +Health", win: { coins: -50, needs: { health: 4, food: 3 }, message: "A boy appears from nowhere with a cooler. The water is ice cold." } },
    ],
  },
  {
    key: "goslow",
    title: "Trailer go-slow",
    icon: "🚛",
    scene: "A tanker has broken down across two lanes. Nothing moves for as far as you can see.",
    line: "Your seatmate: \"Ah, this road. Where you dey go sef?\"",
    choices: [
      { key: "gist", label: "Gist with your seatmate", note: "+Social · +Charisma", win: { needs: { social: 12 }, skill: ["charisma", 6], message: "An hour of gist later you know her whole family, and she's sent you her business page." } },
      { key: "phone", label: "Play on your phone", note: "+Fun", win: { needs: { fun: 10, energy: -3 }, message: "Battery 31%. Worth it." } },
      { key: "nap", label: "Nap", note: "+Energy", win: { needs: { energy: 12 }, message: "You sleep through the worst of it." } },
    ],
  },
  {
    key: "medicine",
    title: "The medicine seller",
    icon: "💊",
    scene: "A man in a crisp shirt stands at the front with a bag of small bottles.",
    line: "\"This one cures headache, malaria, back pain, toothache and bad luck. Only today!\"",
    choices: [
      { key: "buy", label: "Buy a bottle", note: "150 coins", win: { coins: -150, needs: { health: -3, fun: 4 }, message: "It tastes like ginger and regret." } },
      { key: "laugh", label: "Laugh it off", note: "Free · +Fun", win: { needs: { fun: 6 }, message: "Half the coach is laughing with you. He moves on to the next row." } },
      {
        key: "expose",
        label: "Ask him for his licence",
        note: "Charisma helps; lose and you look silly",
        odds: 0.5,
        oddsSkill: "charisma",
        win: { xp: 12, skill: ["charisma", 6], needs: { social: 8 }, message: "He fumbles, sits down, and gets off at the next stop. The aunties cheer." },
        fail: { needs: { social: -6 }, message: "He has an answer for everything. The aunties side with him." },
      },
    ],
  },
];

/** Things that happen on a flight to Abuja (same shape, settled the same way). */
export const FLIGHT_EVENTS: readonly CoachEvent[] = [
  {
    key: "gate",
    title: "Delay at the gate",
    icon: "🛫",
    scene: "Boarding was meant to start twenty minutes ago. The screen still says ON TIME.",
    line: "The gate agent, into the microphone: \"Abuja passengers, we apologise, there will be a short delay.\"",
    choices: [
      { key: "snack", label: "Meat pie and a drink in the lounge", note: "300 coins · +Food", win: { coins: -300, needs: { food: 15 }, message: "The meat pie is better than the airport has any right to make." } },
      { key: "scroll", label: "Charge your phone and scroll", note: "Free · +Fun", win: { needs: { fun: 6 }, message: "You find the one working socket. Forty minutes pass in a blink." } },
      {
        key: "complain",
        label: "Ask the agent what's going on",
        note: "Charisma helps",
        odds: 0.5,
        oddsSkill: "charisma",
        win: { xp: 10, skill: ["charisma", 6], needs: { social: 6 }, message: "You ask nicely. She moves you to the earlier flight that's boarding now. \"Go, go!\"" },
        fail: { needs: { fun: -6 }, message: "\"Sir, please sit down. We will announce.\" You sit down." },
      },
    ],
  },
  {
    key: "overhead",
    title: "No space in the overhead bin",
    icon: "🧳",
    scene: "Someone has put three bags and a cooler of jollof in the bin above your seat.",
    line: "The owner, not moving: \"Abeg, push am small, e go enter.\"",
    choices: [
      { key: "help", label: "Rearrange the bin for everyone", note: "−Energy · +Fitness", win: { needs: { energy: -6, social: 6 }, skill: ["fitness", 6], xp: 4, message: "Ten minutes of bag Tetris and everything fits. The crew thanks you." } },
      { key: "under", label: "Put your bag under the seat", note: "Free", win: { needs: { fun: -3 }, message: "Your legs are cramped all the way to Abuja." } },
      {
        key: "insist",
        label: "Insist they move the cooler",
        note: "Charisma helps",
        odds: 0.55,
        oddsSkill: "charisma",
        win: { xp: 6, needs: { fun: 4 }, message: "The cooler goes under their seat. Justice." },
        fail: { needs: { social: -6 }, message: "An argument starts. The crew moves YOUR bag to the back of the plane." },
      },
    ],
  },
  {
    key: "turbulence",
    title: "Turbulence",
    icon: "🌩️",
    scene: "The plane drops, then shudders. The seatbelt sign pings on. Somebody's tea goes everywhere.",
    line: "The aunty beside you grips your arm: \"Blood of Jesus! Is this normal?\"",
    choices: [
      { key: "calm", label: "Calm her down", note: "+Social · +Charisma", win: { needs: { social: 10 }, skill: ["charisma", 6], xp: 6, message: "You tell her it's like a pothole in the sky. She laughs, then holds your arm anyway." } },
      { key: "pray", label: "Pray with her", note: "+Social", win: { needs: { social: 8, fun: -2 }, message: "Three rows join in. The plane steadies. Everyone takes the credit." } },
      { key: "window", label: "Watch the clouds", note: "+Fun", win: { needs: { fun: 6 }, message: "Out of the window the clouds are piled like cotton. It's beautiful, honestly." } },
    ],
  },
  {
    key: "trolley",
    title: "The trolley comes round",
    icon: "🥤",
    scene: "Cabin crew push the trolley down the aisle, smiling the airline smile.",
    line: "\"Water, juice? Small chops are 500.\"",
    choices: [
      { key: "chops", label: "Small chops", note: "500 coins · ++Food", win: { coins: -500, needs: { food: 18 }, message: "Two puff-puffs, a samosa, a spring roll. Worth it at this height." } },
      { key: "water", label: "Free water", note: "Free · +Health", win: { needs: { health: 3 }, message: "A tiny cup of water. You make it last." } },
      { key: "sleep", label: "Sleep through it", note: "Free · +Energy", win: { needs: { energy: 12 }, message: "You wake up as the captain says \"cabin crew, prepare for landing\"." } },
    ],
  },
  {
    key: "bigman",
    title: "A big man in the next seat",
    icon: "🕴🏾",
    scene: "Agbada, gold watch, two phones. He's been on a call about \"the contract\" since take-off.",
    line: "He ends the call and sighs: \"This Abuja. You dey go for business?\"",
    choices: [
      {
        key: "pitch",
        label: "Pitch your hustle",
        note: "Charisma helps",
        odds: 0.45,
        oddsSkill: "charisma",
        win: { xp: 15, skill: ["business", 6], needs: { social: 10 }, message: "He listens, nods, and takes your number. \"Call my office on Monday.\"" },
        fail: { needs: { social: -4 }, message: "Halfway through, his phone rings. He holds up a finger and never comes back." },
      },
      { key: "gist", label: "Just gist", note: "+Social", win: { needs: { social: 10 }, message: "Forty minutes of gist about Abuja traffic (there is none) and Lagos traffic (there is plenty)." } },
      { key: "headphones", label: "Headphones on", note: "+Energy", win: { needs: { energy: 8 }, message: "You nod politely and put your headphones on. Peace." } },
    ],
  },
  {
    key: "landing",
    title: "Touchdown in Abuja",
    icon: "🛬",
    scene: "The wheels hit the runway. The hills around the city come into view, and the granite rock.",
    line: "Half the plane starts clapping. The captain: \"Welcome to Abuja.\"",
    choices: [
      { key: "clap", label: "Clap along", note: "+Social · +Fun", win: { needs: { social: 6, fun: 4 }, message: "You clap for the pilot. He can't hear you, but it counts." } },
      { key: "stand", label: "Stand up before the seatbelt sign goes off", note: "Free", win: { needs: { social: -3, fun: 3 }, message: "You and twenty others stand, heads bent under the bins, for ten minutes." } },
      { key: "wait", label: "Wait calmly", note: "+Energy", win: { needs: { energy: 4 }, message: "You wait until the aisle clears and walk off like a citizen." } },
    ],
  },
];
/** Every journey event, coach and flight. */
export const JOURNEY_EVENTS: readonly CoachEvent[] = [...COACH_EVENTS, ...FLIGHT_EVENTS];
export const COACH_EVENT_BY_KEY: ReadonlyMap<CoachEventKey, CoachEvent> = new Map(JOURNEY_EVENTS.map((e) => [e.key, e]));
/** Transport with things happening on the way. */
export type JourneyKind = "coach" | "flight";

/** How many things happen on one coach trip. */
export const COACH_EVENTS_PER_TRIP = 2;

/** The events on this ride, in order: fixed by the ride id (and coach or flight), so the client and the server agree. */
export function coachEventsFor(rideId: string, kind: JourneyKind = "coach"): CoachEventKey[] {
  const list = kind === "flight" ? FLIGHT_EVENTS : COACH_EVENTS;
  let h = 2166136261;
  for (let i = 0; i < rideId.length; i++) h = Math.imul(h ^ rideId.charCodeAt(i), 16777619) >>> 0;
  const first = h % list.length;
  const second = (first + 1 + ((h >>> 8) % (list.length - 1))) % list.length;
  // In the order they'd happen (the gate before take-off, the landing last).
  return [list[first]!.key, list[second]!.key]
    .slice(0, COACH_EVENTS_PER_TRIP)
    .sort((a, b) => list.findIndex((e) => e.key === a) - list.findIndex((e) => e.key === b));
}
/** Where on the way an event happens (a share of the trip): the gate at the start, the landing at the end. */
export const JOURNEY_EVENT_AT: Partial<Record<CoachEventKey, number>> = { gate: 0.03, overhead: 0.08, landing: 0.97 };

export interface CoachResult {
  ok: boolean;
  outcome: CoachOutcome;
  balance: number;
}
