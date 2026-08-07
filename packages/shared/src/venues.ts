// Venues: enterable places on the map, each with an icon, a story, regulars and paid activities.
// Activities cost City Coins (a coin sink) and give XP once per Lagos day each, so visiting is a daily ritual.
// Names are the game's own; no real venues or brands.

export interface VenueActivity {
  key: string;
  label: string;
  /** City Coins. */
  cost: number;
  xp: number;
}

export interface Venue {
  key: string;
  name: string;
  /** District name from the city plan. */
  area: string;
  icon: string;
  /** Building art in public/art. */
  art: string;
  /** Inside view (isometric cutaway) shown on the place card, when we have the art. */
  interior?: string;
  blurb: string;
  regulars: string[];
  activities: VenueActivity[];
  /** Real-world artisans or shops to suggest from this venue (artisan category key). */
  realCategory?: string;
  /** A phone app this place opens (the Academy at the school). */
  opens?: "academy";
}

export const VENUES: readonly Venue[] = [
  {
    key: "mama_nkechi_buka",
    name: "Mama Nkechi's Buka",
    area: "Junction 101",
    icon: "🍲",
    art: "/art/buildings/buka.webp",
    interior: "/art/interiors/buka.webp",
    blurb: "Hot amala, soft eba and gist that never finishes. Mama remembers everybody's order.",
    regulars: ["Mama Nkechi", "Tunde the conductor"],
    activities: [
      { key: "amala", label: "Amala, ewedu and gbegiri", cost: 300, xp: 10 },
      { key: "jollof", label: "Jollof, dodo and chicken", cost: 500, xp: 12 },
      { key: "pepper_soup", label: "Pepper soup and a cold drink", cost: 400, xp: 10 },
      { key: "malt_for_mama", label: "Buy Mama a malt and gist", cost: 150, xp: 8 },
    ],
  },
  {
    key: "sharp_cuts",
    name: "Sharp Cuts Barbershop",
    area: "Junction 101",
    icon: "💈",
    art: "/art/buildings/barbershop.webp",
    interior: "/art/interiors/barbershop.webp",
    blurb: "Clippers buzzing, generator humming, and the loudest football arguments on the street.",
    regulars: ["Oga Sharp", "Emeka"],
    activities: [
      { key: "low_cut", label: "Low cut with a sharp line-up", cost: 400, xp: 10 },
      { key: "beard", label: "Beard trim", cost: 250, xp: 8 },
      { key: "argue", label: "Join the football argument (buy a Coke)", cost: 100, xp: 6 },
    ],
  },
  {
    key: "junction_motor_park",
    name: "Junction Motor Park",
    area: "Junction 101",
    icon: "🚐",
    art: "/art/buildings/motor-park.webp",
    blurb: "Danfos loading for every corner of the city. Conductors shouting, hawkers weaving between buses.",
    regulars: ["Conductor Ade", "Iya Pure Water"],
    activities: [
      { key: "pure_water", label: "Pure water and gala from the hawkers", cost: 100, xp: 6 },
      { key: "fares_board", label: "Tip the agbero for fare news", cost: 50, xp: 5 },
    ],
  },
  {
    key: "royal_event_centre",
    name: "Royal Event Centre",
    area: "Owambe Gardens",
    icon: "🎊",
    art: "/art/buildings/event-centre.webp",
    interior: "/art/interiors/event-centre.webp",
    blurb: "Every weekend somebody is getting married, turning fifty or celebrating a chieftaincy title. Wear your aso-ebi.",
    regulars: ["MC Gbenga", "Aunty Bisi"],
    activities: [
      { key: "small_chops", label: "Small chops and party jollof", cost: 400, xp: 12 },
      { key: "dance", label: "Dance with the live band", cost: 300, xp: 12 },
      { key: "spray", label: "Spray the celebrants", cost: 1000, xp: 25 },
    ],
  },
  {
    key: "tailors_row",
    name: "Tailors' Row",
    area: "Owambe Gardens",
    icon: "🧵",
    art: "/art/buildings/tailor-shop.webp",
    interior: "/art/interiors/tailor-shop.webp",
    blurb: "Sewing machines in a line, aso-ebi fabric in every colour. Owambe Saturday starts here.",
    regulars: ["Ada the tailor", "Baba Fabrics"],
    activities: [
      { key: "measure", label: "Get measured for aso-ebi", cost: 800, xp: 15 },
      { key: "fabric", label: "Pick fabric with Baba", cost: 500, xp: 10 },
    ],
    realCategory: "tailor",
  },
  {
    key: "viewing_centre",
    name: "Owambe Viewing Centre",
    area: "Owambe Gardens",
    icon: "⚽",
    art: "/art/buildings/viewing-centre.webp",
    interior: "/art/interiors/viewing-centre.webp",
    blurb: "Big screen, plastic chairs, generator outside. When the match is on, the whole street is here.",
    regulars: ["Coach Femi", "Kola"],
    activities: [
      { key: "match", label: "Watch the big match", cost: 200, xp: 10 },
      { key: "drinks", label: "Buy a round of soft drinks", cost: 400, xp: 12 },
    ],
  },
  {
    key: "mallam_suya",
    name: "Mallam's Suya Spot",
    area: "Owambe Gardens",
    icon: "🍢",
    art: "/art/buildings/suya-stand.webp",
    blurb: "The smoke tells you before the sign does. Extra yaji, onions and tomatoes, wrapped in paper.",
    regulars: ["Mallam Sani"],
    activities: [
      { key: "beef_suya", label: "Beef suya, extra yaji", cost: 300, xp: 10 },
      { key: "kilishi", label: "A pack of kilishi", cost: 400, xp: 10 },
    ],
  },
  {
    key: "lampnet_academy",
    name: "Lampnet Academy",
    area: "Tech Mile",
    icon: "🎓",
    art: "/art/buildings/school.webp",
    blurb: "Lampnet Institute of Technology's campus on Tech Mile, with AkureTechHub. Real tech courses, free to start, with a certificate when you finish.",
    regulars: ["Tutor Kemi", "Femi from AkureTechHub"],
    activities: [
      { key: "study", label: "Study session in the library", cost: 100, xp: 10 },
      { key: "meetup", label: "Join the evening tech meetup", cost: 250, xp: 15 },
    ],
    opens: "academy",
  },
  {
    key: "lagoon_capital_bank",
    name: "Lagoon Capital Bank",
    area: "Island Heights",
    icon: "🏦",
    art: "/art/buildings/bank-lagoon-capital.webp",
    interior: "/art/interiors/bank-hall.webp",
    blurb: "Glass doors, cold AC and a queue that moves slowly. Everybody on the Island banks here, or says they do.",
    regulars: ["Teller Funmi", "Mr Okafor the manager"],
    activities: [
      { key: "queue", label: "Queue to update your BVN details", cost: 100, xp: 8 },
      { key: "loan_chat", label: "Ask the manager about a business loan", cost: 300, xp: 15 },
    ],
  },
  {
    key: "grand_lagoon_hotel",
    name: "Grand Lagoon Hotel",
    area: "Island Heights",
    icon: "🏨",
    art: "/art/buildings/hotel.webp",
    interior: "/art/interiors/hotel-lobby.webp",
    blurb: "Fountain in the lobby, live saxophone at night. Big deals get signed over Chapman here.",
    regulars: ["Concierge Tayo", "Chief Adebayo"],
    activities: [
      { key: "chapman", label: "Chapman at the lobby bar", cost: 600, xp: 12 },
      { key: "lunch", label: "Lunch at the poolside restaurant", cost: 1500, xp: 25 },
    ],
  },
];

export const VENUES_BY_KEY: ReadonlyMap<string, Venue> = new Map(VENUES.map((v) => [v.key, v]));

/** Ledger reference for doing an activity: once per player, Lagos day, venue and activity. */
export const activityRef = (day: string, venue: string, activity: string) => `activity:${day}:${venue}:${activity}`;

export interface VenueDay {
  /** "venue:activity" keys done today. */
  done: string[];
}
