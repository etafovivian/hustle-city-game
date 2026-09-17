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
  /** A phone app this place opens (the Academy at the school, the gadget counter at Gadget Village). */
  opens?: "academy" | "gadgets";
  /** Extra words the city map's search matches (what people call this kind of place). */
  keywords?: readonly string[];
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
      { key: "treadmill", label: "Run on the treadmill", cost: 200, xp: 10 },
      { key: "dumbbells", label: "Dumbbell session", cost: 250, xp: 10 },
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
    interior: "/art/interiors/golf-lounge.webp",
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
    interior: "/art/interiors/stadium-room.webp",
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
    interior: "/art/interiors/police-desk.webp",
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
    interior: "/art/interiors/snooker-room.webp",
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
    key: "balogun_market",
    name: "Balogun Market",
    area: "Marina Wharf",
    icon: "🛍️",
    art: "/art/buildings/market-hall.webp",
    interior: "/art/interiors/market-aisle.webp",
    blurb: "Lagos's biggest market: fabric, phones, provisions, everything. Haggle hard, buy wholesale, sell it in your shop.",
    regulars: ["Iya Oloja the market queen", "Chinedu the phone dealer"],
    activities: [
      { key: "browse", label: "Push through the crowd and price everything", cost: 100, xp: 8 },
      { key: "fabric", label: "Buy Ankara for your next outfit", cost: 1500, xp: 15 },
      { key: "street_food", label: "Roasted corn and ube from the hawkers", cost: 200, xp: 8 },
    ],
  },
  {
    key: "high_court",
    name: "High Court",
    area: "Marina Wharf",
    icon: "⚖️",
    art: "/art/buildings/high-court.webp",
    interior: "/art/interiors/courtroom.webp",
    blurb: "Wigs, gowns and long queues. Lawyers in a hurry, everybody else waiting.",
    regulars: ["Barrister Okoro", "Court Clerk Funmi"],
    activities: [
      { key: "watch", label: "Watch a case from the gallery", cost: 50, xp: 6 },
      { key: "affidavit", label: "Swear an affidavit for your business", cost: 300, xp: 10 },
    ],
  },
  // ── Ogun State (past the state border on the expressway) ──
  {
    key: "olumo_rock",
    name: "Olumo Rock",
    area: "Abeokuta",
    icon: "🪨",
    // A drawn stand-in for the rock (the map draws it on its high ground) until its art arrives
    art: "/art/landmarks/olumo-rock.svg",
    blurb: "The great rock Abeokuta was founded under. Climb the steps past the shrines and see the whole town and the Ogun River from the top.",
    regulars: ["Guide Baba Sola"],
    activities: [
      { key: "climb", label: "Climb to the top with a guide", cost: 800, xp: 20 },
      { key: "history", label: "Hear the story of the Egba people", cost: 300, xp: 12 },
      { key: "photo", label: "Take a photo at the summit", cost: 100, xp: 8 },
    ],
  },
  {
    key: "itoku_adire_market",
    name: "Itoku Adire Market",
    area: "Abeokuta",
    icon: "🧵",
    art: "/art/buildings/market-hall.webp",
    interior: "/art/interiors/market-aisle.webp",
    blurb: "Rows of hand-dyed adire in every blue you can think of. Watch the women dye cloth in the pits, then haggle for a bundle.",
    regulars: ["Mama Adire"],
    activities: [
      { key: "dye", label: "Dye your own adire with Mama Adire", cost: 1500, xp: 20 },
      { key: "buy", label: "Buy a bundle of adire", cost: 2500, xp: 15 },
      { key: "browse", label: "Walk the market and price everything", cost: 100, xp: 8 },
    ],
  },
  {
    key: "sagamu_junction",
    name: "Sagamu Interchange Stop",
    area: "Sagamu",
    icon: "🚌",
    art: "/art/buildings/motor-park.webp",
    blurb: "Every bus between Lagos, Ibadan and the east stops here. Buy hot agege bread and suya from the hawkers before the conductor shouts.",
    regulars: ["Hawker Iya Bread"],
    activities: [
      { key: "bread", label: "Hot agege bread and suya", cost: 400, xp: 10 },
      { key: "kola", label: "Buy Sagamu kola nut to take home", cost: 300, xp: 8 },
    ],
  },
  {
    key: "mowe_estate_office",
    name: "Mowe Estates Office",
    area: "Mowe",
    icon: "🏡",
    art: "/art/buildings/estate-gate.webp",
    blurb: "Everybody's 'buy land in Ogun' dream starts here: cheaper plots, new estates, and an agent who promises the road will be tarred soon.",
    regulars: ["Agent Femi"],
    activities: [
      { key: "inspect", label: "Go on an estate inspection", cost: 200, xp: 12 },
      { key: "survey", label: "Pay for a survey plan check", cost: 1000, xp: 15 },
    ],
  },
  {
    key: "ring_kings_boxing",
    name: "Ring Kings Boxing Club",
    area: "Danfo Terminal",
    icon: "🥊",
    art: "/art/buildings/gym.webp",
    interior: "/art/interiors/gym.webp",
    blurb: "Sweat, sawdust and a ring with old ropes. Coach Dele has trained champions; he'll train you too if you show up at 6am.",
    regulars: ["Coach Dele", "Kid Lightning"],
    activities: [
      { key: "heavy_bag", label: "Work the heavy bag", cost: 200, xp: 10 },
      { key: "pads", label: "Pad work with Coach Dele", cost: 500, xp: 15 },
      { key: "skipping", label: "Skipping and shadow boxing", cost: 100, xp: 8 },
      { key: "spar", label: "Spar a round in the ring", cost: 300, xp: 14 },
    ],
  },
  {
    key: "sandbar_beach",
    name: "Sandbar Bay Beach",
    area: "Sandbar Bay",
    icon: "🏖️",
    art: "/art/buildings/restaurant-terrace.webp",
    interior: "/art/interiors/home-villa-pool.webp",
    blurb: "A strip of white sand you only reach by water bus. Cabanas, coconut, horses on the shore, and on Sundays the beach rave goes till late.",
    regulars: ["Lifeguard Kunle", "Mama Coconut", "Horse man Sule"],
    activities: [
      { key: "swim", label: "Swim between the flags (towel and locker)", cost: 50, xp: 10 },
      { key: "coconut", label: "Fresh coconut and suya on the sand", cost: 500, xp: 10 },
      { key: "horse", label: "Ride a horse along the shore", cost: 1500, xp: 18 },
      { key: "cabana", label: "Rent a cabana for the afternoon", cost: 3000, xp: 25 },
      { key: "beach_ball", label: "Beach football with whoever's there", cost: 100, xp: 12 },
    ],
  },
  {
    key: "lagoon_city_university",
    name: "Lagoon City University",
    area: "Tech Mile",
    icon: "🏛️",
    art: "/art/buildings/university.webp",
    interior: "/art/interiors/lecture-hall.webp",
    blurb: "Big campus, bigger dreams. Enrol in a degree, go to lectures, write your exams and graduate in front of the whole family.",
    regulars: ["Prof. Adebayo-Okafor", "Course rep Tolu"],
    activities: [
      { key: "cafeteria", label: "Rice and plantain at the cafeteria", cost: 300, xp: 8 },
      { key: "study_group", label: "Study group under the mango tree", cost: 100, xp: 10 },
    ],
  },
  {
    key: "city_library",
    name: "City Library",
    area: "Tech Mile",
    icon: "📚",
    art: "/art/buildings/library.webp",
    interior: "/art/interiors/library-room.webp",
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
    interior: "/art/interiors/radio-studio.webp",
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
    interior: "/art/interiors/hospital-ward.webp",
    blurb: "Doctors, nurses and a pharmacy that is always out of one thing. Get checked before you break down.",
    regulars: ["Dr Okafor", "Nurse Amaka"],
    activities: [
      { key: "checkup", label: "Get a check-up", cost: 500, xp: 10 },
      { key: "pharmacy", label: "Pick up malaria drugs", cost: 200, xp: 6 },
    ],
  },
  // ── Landmarks (drawn stand-ins in public/art/landmarks until the Stitch batch 39 art arrives) ──
  {
    key: "crown_arts_theatre",
    name: "Crown Arts Theatre",
    area: "Owambe Gardens",
    icon: "🎭",
    art: "/art/landmarks/crown-arts-theatre.svg",
    interior: "/art/interiors/event-centre.webp",
    blurb: "The big round theatre with the roof like a general's cap. Plays, stand-up nights, and on Fridays the premiere everybody dresses up for.",
    regulars: ["Director Funmilayo", "Comedian Gbenga Laffs"],
    activities: [
      { key: "play", label: "Ticket for tonight's play", cost: 1_200, xp: 20 },
      { key: "standup", label: "Stand-up comedy night", cost: 800, xp: 16 },
      { key: "interval", label: "Puff-puff and zobo at the interval", cost: 200, xp: 6 },
    ],
    keywords: ["theatre", "theater", "play", "drama", "stand-up", "comedy", "national theatre", "iganmu", "surulere"],
  },
  {
    key: "independence_square",
    name: "Independence Square",
    area: "Marina Wharf",
    icon: "🎖️",
    art: "/art/landmarks/independence-square.svg",
    blurb: "A huge parade ground with grandstands and four horses on tall pillars. Parades on 1 October, concerts on Saturday nights, crusades at the weekend, and people gisting on the steps every day.",
    regulars: ["Parade marshal Okon", "Mama Flags"],
    activities: [
      { key: "parade", label: "Watch the march-past from the stands", cost: 100, xp: 8 },
      { key: "flag", label: "Buy a flag and a pack of small chops", cost: 300, xp: 8 },
      { key: "concert", label: "Concert ticket in the grandstand", cost: 1_500, xp: 20 },
    ],
    keywords: ["square", "parade", "concert", "crusade", "independence", "tafawa balewa", "tbs", "race course"],
  },
  {
    key: "liberty_arts_park",
    name: "Liberty Arts Park",
    area: "Marina Wharf",
    icon: "🎨",
    art: "/art/landmarks/liberty-arts-park.svg",
    blurb: "An old colonial prison turned into a park: arches in the old wall, an open-air stage, painters under the trees and poetry when the sun goes down.",
    regulars: ["Poet Adaeze", "Painter Kunle"],
    activities: [
      { key: "open_mic", label: "Open mic: perform a song", cost: 300, xp: 12 },
      { key: "poetry", label: "Poetry night under the arches", cost: 200, xp: 10 },
      { key: "art_market", label: "Buy a painting at the art market", cost: 1_500, xp: 15 },
      { key: "chill", label: "Chapman and chilling by the stage", cost: 500, xp: 10 },
    ],
    keywords: ["park", "arts", "art market", "open mic", "poetry", "stage", "freedom park"],
  },
  {
    key: "gadget_village",
    name: "Gadget Village",
    area: "Airport Ridge",
    icon: "📱",
    // Stand-in until the gadget plaza block (Stitch batch 34) arrives
    art: "/art/buildings/commercial-block.webp",
    interior: "/art/interiors/gadget-market.webp",
    blurb: "Street after street of phone shops, laptop stalls and repair benches. Buy a new phone, fix your screen, and never pay the first price.",
    regulars: ["Chinedu the phone dealer", "Engineer Bayo (screens while you wait)"],
    activities: [
      { key: "browse", label: "Window-shop the newest phones", cost: 50, xp: 5 },
      { key: "data", label: "New SIM and a data bundle", cost: 300, xp: 8 },
      { key: "flash", label: "Get your phone flashed and cleaned", cost: 500, xp: 10 },
    ],
    opens: "gadgets",
    keywords: ["gadget", "gadgets", "phone", "phones", "laptop", "laptops", "computer", "computer village", "repair", "screen", "accessories", "ikeja"],
  },
];

export const VENUES_BY_KEY: ReadonlyMap<string, Venue> = new Map(VENUES.map((v) => [v.key, v]));

/** Ledger reference for doing an activity: once per player, Lagos day, venue and activity. */
export const activityRef = (day: string, venue: string, activity: string) => `activity:${day}:${venue}:${activity}`;

export interface VenueDay {
  /** "venue:activity" keys done today. */
  done: string[];
}

// ---------------------------------------------------------------- life at each place
// Every place has a free thing to do (no coins, no XP: just the scene), its paid activities, and at the social
// places a "flex" for players with money to show (a big coin sink and a goal). Each activity takes a few seconds
// while the room plays, then shows what it gave. Places keep Lagos hours: the lounge opens at 10 pm, suya is an
// evening thing, the bank shuts at 5.

/** What an activity is good for (shown as chips; needs bars can use the same names later). */
export type Vibe = "food" | "fun" | "social" | "style" | "health" | "brain" | "rest" | "faith" | "rep" | "hustle";
export const VIBE_LABEL: Record<Vibe, string> = {
  food: "Food",
  fun: "Fun",
  social: "Social",
  style: "Style",
  health: "Health",
  brain: "Brain",
  rest: "Rest",
  faith: "Peace",
  rep: "Respect",
  hustle: "Hustle",
};

interface VenueLife {
  /** Lagos hours [open, close); close below open runs past midnight. Missing: open all day. */
  hours?: readonly [number, number];
  gives: readonly Vibe[];
  free: string;
  flex?: { label: string; cost: number };
}

const LIFE: Record<string, VenueLife> = {
  mama_nkechi_buka: { gives: ["food", "social"], free: "Gist with Mama while she cooks", flex: { label: "Feed everybody in the buka", cost: 25_000 } },
  sharp_cuts: { hours: [7, 22], gives: ["style", "social"], free: "Watch the football argument", flex: { label: "Book the barber for your whole crew", cost: 20_000 } },
  junction_motor_park: { gives: ["hustle"], free: "Watch the agberos call the routes", flex: { label: "Charter a whole danfo for your people", cost: 30_000 } },
  royal_event_centre: { hours: [12, 3], gives: ["fun", "social"], free: "Peep the party from the gate", flex: { label: "Spray the couple with a full bundle", cost: 100_000 } },
  tailors_row: { hours: [8, 20], gives: ["style"], free: "Look through the fabric books", flex: { label: "Order aso-ebi for the whole family", cost: 60_000 } },
  viewing_centre: { hours: [12, 2], gives: ["fun", "social"], free: "Watch the second half from the back", flex: { label: "Buy drinks for the whole viewing centre", cost: 30_000 } },
  mallam_suya: { hours: [17, 3], gives: ["food", "fun"], free: "Smell the suya and gist with Mallam", flex: { label: "Buy suya for the whole street", cost: 25_000 } },
  lampnet_academy: { hours: [7, 21], gives: ["brain"], free: "Sit in on a free class" },
  lagoon_capital_bank: { hours: [8, 17], gives: ["hustle"], free: "Ask about a business account" },
  grand_lagoon_hotel: { gives: ["rest"], free: "Cool off in the lobby AC", flex: { label: "Book the presidential suite for the weekend", cost: 150_000 } },
  fit_lagos: { hours: [5, 23], gives: ["health"], free: "Jog round the block", flex: { label: "Hire a personal trainer for a month", cost: 40_000 } },
  skyline_lounge: { hours: [22, 5], gives: ["fun", "social", "rep"], free: "Lean on the rail and enjoy the view", flex: { label: "Big-boy bottle with sparklers for your table", cost: 250_000 } },
  island_motors: { hours: [9, 19], gives: ["style", "rep"], free: "Sit in the showroom car", flex: { label: "Test-drive the flagship SUV with a driver", cost: 50_000 } },
  lagoon_golf_club: { hours: [6, 19], gives: ["rep", "health"], free: "Walk the course at sunset", flex: { label: "Join the club for a season", cost: 500_000 } },
  glory_hair_salon: { hours: [8, 21], gives: ["style", "social"], free: "Window-shop the wigs", flex: { label: "Full glam for you and your friends", cost: 60_000 } },
  grace_chapel: { hours: [6, 22], gives: ["faith", "social"], free: "Kneel and pray" },
  city_stadium: { hours: [15, 24], gives: ["fun"], free: "Watch training from the stands", flex: { label: "VIP box for the derby", cost: 80_000 } },
  central_mosque: { hours: [5, 23], gives: ["faith"], free: "Pray with the congregation (salah)" },
  police_division: { gives: ["rep"], free: "Read the notices on the board" },
  oga_snooker: { hours: [11, 3], gives: ["fun", "social"], free: "Watch a frame from the bench", flex: { label: "Pay for games night for everyone", cost: 15_000 } },
  balogun_market: { hours: [7, 19], gives: ["hustle", "social"], free: "Watch the traders haggle", flex: { label: "Buy out a whole fabric stall for your aso-ebi crew", cost: 80_000 } },
  lagoon_boat_cruise: { hours: [15, 1], gives: ["fun", "rest"], free: "Watch the boats from the jetty", flex: { label: "Charter the whole boat for your birthday", cost: 200_000 } },
  high_court: { hours: [8, 17], gives: ["hustle"], free: "Read the cause list on the board" },
  olumo_rock: { hours: [8, 18], gives: ["fun", "health"], free: "Look up at the rock from the gate" },
  itoku_adire_market: { hours: [8, 18], gives: ["style", "social"], free: "Watch the dyers at work", flex: { label: "Order adire for your whole family", cost: 40_000 } },
  sagamu_junction: { gives: ["food", "hustle"], free: "Watch the buses come and go" },
  mowe_estate_office: { hours: [8, 17], gives: ["hustle"], free: "Read the 'Land for sale' boards" },
  ring_kings_boxing: { hours: [6, 22], gives: ["health", "fun"], free: "Watch the fighters train", flex: { label: "Sponsor the club's next fight night", cost: 60_000 } },
  sandbar_beach: { hours: [7, 23], gives: ["fun", "rest", "health"], free: "Walk on the sand and watch the waves", flex: { label: "Book the whole beach for your birthday", cost: 300_000 } },
  lagoon_city_university: { hours: [8, 18], gives: ["brain", "social"], free: "Walk round the campus and read the noticeboards" },
  city_library: { hours: [8, 21], gives: ["brain"], free: "Read the day's newspapers" },
  city_fm: { gives: ["fun", "rep"], free: "Listen to the show in reception", flex: { label: "Sponsor the morning show for a week", cost: 100_000 } },
  general_hospital: { gives: ["health"], free: "Free blood-pressure check at the stand" },
  crown_arts_theatre: { hours: [12, 24], gives: ["fun", "social"], free: "Look at the posters in the foyer", flex: { label: "Book a box for the premiere for all your friends", cost: 80_000 } },
  independence_square: { gives: ["fun", "social", "rep"], free: "Hang out on the square and watch the crowd", flex: { label: "Sponsor the fireworks over the square", cost: 120_000 } },
  liberty_arts_park: { hours: [10, 24], gives: ["fun", "rest", "social"], free: "Sit under the arches and people-watch", flex: { label: "Commission a mural on the old prison wall", cost: 50_000 } },
  gadget_village: { hours: [8, 19], gives: ["hustle", "style"], free: "Watch the engineers change a screen" },
};

export interface VenueAction extends VenueActivity {
  kind: "free" | "paid" | "flex";
  /** How long it plays in the room, in seconds. */
  seconds: number;
  gives: readonly Vibe[];
}

/** Seconds an activity plays: a quick one for small spends, longer for big ones. */
export const activitySeconds = (cost: number) => Math.min(15, 6 + Math.round(cost / 250));

/** Everything to do at a place, in card order: free first, then paid, then the flex. */
export function venueActions(v: Venue): VenueAction[] {
  const life = LIFE[v.key];
  const gives = life?.gives ?? [];
  const out: VenueAction[] = [];
  if (life) out.push({ key: "free", label: life.free, cost: 0, xp: 0, kind: "free", seconds: 6, gives });
  for (const a of v.activities) out.push({ ...a, kind: "paid", seconds: activitySeconds(a.cost), gives });
  if (life?.flex) out.push({ key: "flex", label: life.flex.label, cost: life.flex.cost, xp: 100, kind: "flex", seconds: 15, gives: [...gives, ...(gives.includes("rep") ? [] : (["rep"] as const))] });
  return out;
}

/** Lagos hour (0–24, with minutes as a fraction). Lagos has no daylight saving: UTC+1 all year. */
export const lagosHourOf = (at: Date) => (at.getUTCHours() + 1 + at.getUTCMinutes() / 60) % 24;

export function venueHours(v: Venue) {
  return LIFE[v.key]?.hours;
}

/** Is the place open at this Lagos hour? */
export function isOpenAt(v: Venue, hour: number): boolean {
  const h = venueHours(v);
  if (!h) return true;
  const [open, close] = h;
  return open < close ? hour >= open && hour < close : hour >= open || hour < close;
}

/** "10 pm", "noon", "midnight". */
export function clockHour(h: number): string {
  const n = ((Math.floor(h) % 24) + 24) % 24;
  if (n === 0) return "midnight";
  if (n === 12) return "noon";
  return `${n % 12} ${n < 12 ? "am" : "pm"}`;
}

/** "Open all day", "Open now · until 5 pm", "Closed · opens 10 pm". */
export function hoursLabel(v: Venue, hour: number): string {
  const h = venueHours(v);
  if (!h) return "Open all day";
  return isOpenAt(v, hour) ? `Open now · until ${clockHour(h[1])}` : `Closed · opens ${clockHour(h[0])}`;
}
