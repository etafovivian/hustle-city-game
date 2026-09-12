// The interstate coach: the trip out to Ogun State is a scene of its own. Two things happen on the road (a
// checkpoint, hawkers at the junction, a preacher, a burst tyre, a trailer go-slow, a medicine seller) and the
// player picks how to handle each. Which two is fixed by the ride (same on the client and the server); the server
// rolls any gamble and settles each event once.
import type { NeedKey } from "./needs.js";
import type { SkillKey } from "./skills.js";

export type CoachEventKey = "checkpoint" | "hawkers" | "preacher" | "tyre" | "goslow" | "medicine";

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
export const COACH_EVENT_BY_KEY: ReadonlyMap<CoachEventKey, CoachEvent> = new Map(COACH_EVENTS.map((e) => [e.key, e]));

/** How many things happen on one coach trip. */
export const COACH_EVENTS_PER_TRIP = 2;

/** The events on this ride, in order: fixed by the ride id, so the client and the server agree. */
export function coachEventsFor(rideId: string): CoachEventKey[] {
  let h = 2166136261;
  for (let i = 0; i < rideId.length; i++) h = Math.imul(h ^ rideId.charCodeAt(i), 16777619) >>> 0;
  const first = h % COACH_EVENTS.length;
  const second = (first + 1 + ((h >>> 8) % (COACH_EVENTS.length - 1))) % COACH_EVENTS.length;
  return [COACH_EVENTS[first]!.key, COACH_EVENTS[second]!.key].slice(0, COACH_EVENTS_PER_TRIP);
}

export interface CoachResult {
  ok: boolean;
  outcome: CoachOutcome;
  balance: number;
}
