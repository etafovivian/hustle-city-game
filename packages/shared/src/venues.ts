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
    interior: "/art/interiors/classroom.webp",
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
  {
    key: "fit_lagos",
    name: "Fit Lagos",
    area: "Island Heights",
    icon: "🏋🏾",
    art: "/art/buildings/gym.webp",
    interior: "/art/interiors/gym.webp",
    blurb: "Treadmills by the window, Afrobeats on the speakers and a trainer who shouts in Pidgin.",
    regulars: ["Coach Bolaji", "Kemi"],
    activities: [
      { key: "weights", label: "Lift weights with Coach Bolaji", cost: 300, xp: 12 },
      { key: "aerobics", label: "Join the aerobics class", cost: 400, xp: 15 },
      { key: "smoothie", label: "Tiger-nut smoothie after", cost: 250, xp: 8 },
    ],
  },
  {
    key: "skyline_lounge",
    name: "Skyline Lounge",
    area: "Island Heights",
    icon: "🍸",
    art: "/art/buildings/skyline-lounge.webp",
    interior: "/art/interiors/lounge.webp",
    blurb: "Rooftop views over the lagoon, a DJ who knows every Afrobeats hit, and a table you have to book.",
    regulars: ["DJ Spinall-not-Spinall", "Zara"],
    activities: [
      { key: "dance", label: "Dance till late", cost: 800, xp: 18 },
      { key: "chapman", label: "Chapman and small chops", cost: 600, xp: 12 },
      { key: "table", label: "Book a table with friends", cost: 3000, xp: 30 },
    ],
  },
  {
    key: "island_motors",
    name: "Island Motors",
    area: "Island Heights",
    icon: "🚘",
    art: "/art/buildings/car-showroom.webp",
    interior: "/art/interiors/car-showroom.webp",
    blurb: "Tokunbo and brand-new, all shining. The sales man already knows your budget is not enough.",
    regulars: ["Sales Manager Chidi"],
    activities: [
      { key: "window", label: "Window-shop the new SUVs", cost: 100, xp: 6 },
      { key: "test_drive", label: "Take a test drive round Island Heights", cost: 1000, xp: 20 },
    ],
  },
  {
    key: "lagoon_golf_club",
    name: "Lagoon Golf Club",
    area: "Island Heights",
    icon: "⛳",
    art: "/art/buildings/golf-club.webp",
    blurb: "Old money, new money and the people who carry their bags. Deals get made on the 9th hole.",
    regulars: ["Chief Adebayo", "Caddie Musa"],
    activities: [
      { key: "round", label: "Play a round of golf", cost: 2500, xp: 30 },
      { key: "clubhouse", label: "Drinks at the clubhouse", cost: 800, xp: 12 },
    ],
  },
  {
    key: "glory_hair_salon",
    name: "Glory Hair Salon",
    area: "Owambe Gardens",
    icon: "💇🏾‍♀️",
    art: "/art/buildings/salon.webp",
    interior: "/art/interiors/salon.webp",
    blurb: "Braids, wigs and the best gist on the street. Book early on Fridays before owambe.",
    regulars: ["Aunty Glory", "Bisi"],
    activities: [
      { key: "braids", label: "Knotless braids for the weekend", cost: 1500, xp: 20 },
      { key: "wash_set", label: "Wash and set", cost: 600, xp: 12 },
      { key: "gist", label: "Gist under the dryer", cost: 150, xp: 6 },
    ],
  },
  {
    key: "grace_chapel",
    name: "Grace Chapel",
    area: "Owambe Gardens",
    icon: "⛪",
    art: "/art/buildings/church.webp",
    interior: "/art/interiors/church.webp",
    blurb: "Drums, keyboard and a choir that can lift the roof. Service starts on time, African time.",
    regulars: ["Pastor Femi", "Choir Mistress Ada"],
    activities: [
      { key: "service", label: "Sunday service and offering", cost: 100, xp: 10 },
      { key: "choir", label: "Sing with the choir", cost: 50, xp: 8 },
    ],
  },
  {
    key: "city_stadium",
    name: "City Stadium",
    area: "Owambe Gardens",
    icon: "🏟️",
    art: "/art/buildings/stadium.webp",
    blurb: "Floodlights, vuvuzelas and the derby everyone argues about for a week.",
    regulars: ["Coach Femi", "Captain Uche"],
    activities: [
      { key: "derby", label: "Watch the derby", cost: 500, xp: 15 },
      { key: "five_a_side", label: "Five-a-side on the training pitch", cost: 300, xp: 12 },
    ],
  },
  {
    key: "central_mosque",
    name: "Central Mosque",
    area: "Danfo Terminal",
    icon: "🕌",
    art: "/art/buildings/mosque.webp",
    interior: "/art/interiors/mosque.webp",
    blurb: "Calm in the middle of the motor-park noise. Shoes off at the rack.",
    regulars: ["Imam Abdullahi", "Alhaji Sani"],
    activities: [
      { key: "jumat", label: "Jumat prayers and sadaqah", cost: 100, xp: 10 },
      { key: "class", label: "Evening Quran class", cost: 50, xp: 8 },
    ],
  },
  {
    key: "police_division",
    name: "Junction Police Division",
    area: "Danfo Terminal",
    icon: "🚓",
    art: "/art/buildings/police-station.webp",
    blurb: "The station for Junction 101, Danfo Terminal and Tech Mile. Bring your papers.",
    regulars: ["Inspector Bello", "Sergeant Ngozi"],
    activities: [
      { key: "report", label: "Report a case", cost: 50, xp: 5 },
      { key: "papers", label: "Get a police report for your business", cost: 300, xp: 10 },
    ],
  },
  {
    key: "oga_snooker",
    name: "Oga's Snooker Spot",
    area: "Danfo Terminal",
    icon: "🎱",
    art: "/art/buildings/snooker.webp",
    blurb: "One snooker table, a games corner and cold drinks. Winner stays on.",
    regulars: ["Oga Tunde", "Small Boy Kayode"],
    activities: [
      { key: "frame", label: "Play a frame of snooker", cost: 100, xp: 8 },
      { key: "games", label: "Games night with the boys", cost: 200, xp: 10 },
    ],
  },
  {
    key: "lagoon_boat_cruise",
    name: "Lagoon Boat Cruise",
    area: "Marina Wharf",
    icon: "⛵",
    art: "/art/buildings/ferry-jetty.webp",
    interior: "/art/interiors/boat-deck.webp",
    blurb: "Sunset on the lagoon, a DJ on the deck and the Third Mainland Bridge lit up behind you.",
    regulars: ["Captain Eyo", "Deck DJ Remi"],
    activities: [
      { key: "sunset", label: "Sunset cruise", cost: 2000, xp: 30 },
      { key: "party_deck", label: "Party deck", cost: 1000, xp: 20 },
    ],
  },
  {
    key: "high_court",
    name: "High Court",
    area: "Marina Wharf",
    icon: "⚖️",
    art: "/art/buildings/high-court.webp",
    blurb: "Wigs, gowns and long queues. Lawyers in a hurry, everybody else waiting.",
    regulars: ["Barrister Okoro", "Court Clerk Funmi"],
    activities: [
      { key: "watch", label: "Watch a case from the gallery", cost: 50, xp: 6 },
      { key: "affidavit", label: "Swear an affidavit for your business", cost: 300, xp: 10 },
    ],
  },
  {
    key: "city_library",
    name: "City Library",
    area: "Tech Mile",
    icon: "📚",
    art: "/art/buildings/library.webp",
    blurb: "Quiet, cool and free Wi-Fi. The students from City Polytechnic study here until closing.",
    regulars: ["Librarian Mrs Adeyemi"],
    activities: [
      { key: "read", label: "Read for an hour", cost: 50, xp: 8 },
      { key: "study_group", label: "Join a study group", cost: 100, xp: 10 },
    ],
  },
  {
    key: "city_fm",
    name: "City FM",
    area: "Tech Mile",
    icon: "📻",
    art: "/art/buildings/radio-station.webp",
    blurb: "The morning show everyone listens to in traffic. Call in, shout out your hustle.",
    regulars: ["OAP Toke", "OAP Big Mike"],
    activities: [
      { key: "call_in", label: "Call in to the morning show", cost: 100, xp: 8 },
      { key: "advert", label: "Run a radio jingle for your hustle", cost: 1500, xp: 20 },
    ],
  },
  {
    key: "general_hospital",
    name: "City General Hospital",
    area: "Airport Ridge",
    icon: "🏥",
    art: "/art/buildings/hospital.webp",
    blurb: "Doctors, nurses and a pharmacy that is always out of one thing. Get checked before you break down.",
    regulars: ["Dr Okafor", "Nurse Amaka"],
    activities: [
      { key: "checkup", label: "Get a check-up", cost: 500, xp: 10 },
      { key: "pharmacy", label: "Pick up malaria drugs", cost: 200, xp: 6 },
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
