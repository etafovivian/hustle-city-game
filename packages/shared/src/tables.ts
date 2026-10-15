// Game tables at places: what you can sit down and play where (with whoever is there, or the computer).
export type TableGame = "ayo" | "snooker" | "chess";

export const TABLE_GAMES: Record<TableGame, { label: string; icon: string; seat: string }> = {
  snooker: { label: "Snooker", icon: "🎱", seat: "the snooker table" },
  chess: { label: "Chess", icon: "♟️", seat: "the chess board" },
  ayo: { label: "Ayo", icon: "🌰", seat: "the Ayo board" },
};

/** Venue key → the tables there (branches share their base place's tables). */
export const GAME_TABLES: Record<string, TableGame[]> = {
  oga_snooker: ["snooker", "chess", "ayo"],
  skyline_lounge: ["snooker"],
  lagoon_golf_club: ["chess", "snooker"],
  grand_lagoon_hotel: ["chess"],
  city_library: ["chess", "ayo"],
  lampnet_academy: ["chess"],
  viewing_centre: ["ayo", "chess"],
  mallam_suya: ["ayo"],
  mama_nkechi_buka: ["ayo"],
};
