// Presence: other players online right now and where they are (so friends can meet up).
import type { AvatarConfig } from "./profile.js";

export interface PresencePlayer {
  nickname: string;
  avatar: AvatarConfig;
  x: number;
  y: number;
  /** A place key (venue, branch "base@building", or "home:<plotId>") when they're inside one. */
  place: string | null;
  /** A chieftaincy title from the palace, to show off on their card. */
  title?: string;
}

export interface PresencePing {
  from: string;
  kind: "wave" | "drink" | "join" | "invite" | "challenge" | "note";
  /** For "join": what they're doing ("Dance till late at Skyline Lounge"). */
  text?: string;
  place: string | null;
}

export interface PresenceReply {
  /** Unread private messages. */
  unread: number;
  players: PresencePlayer[];
  pings: PresencePing[];
}

/**
 * Rooms in each kind of home: the first is where you arrive. Bigger houses have more rooms; art from Stitch zip 16 (batches 32-33).
 */
export const HOME_ROOMS: Record<string, { key: string; label: string; art: string }[]> = {
  starter: [{ key: "room", label: "Your room", art: "home-face-me" }],
  bungalow: [
    { key: "parlour", label: "Parlour", art: "home-self-contain" },
    { key: "bedroom", label: "Bedroom", art: "home-bedroom" },
  ],
  storey_house: [
    { key: "parlour", label: "Parlour", art: "home-mini-flat" },
    { key: "bedroom", label: "Bedroom", art: "home-bedroom" },
    { key: "kitchen", label: "Kitchen", art: "home-kitchen" },
  ],
  family_compound: [
    { key: "parlour", label: "Parlour", art: "home-mini-flat" },
    { key: "bedroom", label: "Bedroom", art: "home-bedroom" },
    { key: "yard", label: "Compound yard", art: "home-compound-yard" },
  ],
  terrace_duplex: [
    { key: "living", label: "Living room", art: "home-duplex" },
    { key: "bedroom", label: "Master bedroom", art: "home-duplex-bedroom" },
    { key: "kitchen", label: "Kitchen", art: "home-kitchen" },
  ],
  // Rented flats (rent.ts).
  rent_self_contain: [{ key: "room", label: "Your self-contain", art: "home-self-contain" }],
  rent_mini_flat: [
    { key: "parlour", label: "Parlour", art: "home-mini-flat" },
    { key: "bedroom", label: "Bedroom", art: "home-bedroom" },
  ],
  rent_flat: [
    { key: "living", label: "Living room", art: "home-duplex" },
    { key: "bedroom", label: "Bedroom", art: "home-duplex-bedroom" },
    { key: "kitchen", label: "Kitchen", art: "home-kitchen" },
  ],
  villa: [
    { key: "living", label: "Grand living room", art: "home-mansion" },
    { key: "suite", label: "Master suite", art: "home-villa-suite" },
    { key: "kitchen", label: "Kitchen", art: "home-villa-kitchen" },
    { key: "cinema", label: "Cinema", art: "home-villa-cinema" },
    { key: "pool", label: "Pool deck", art: "home-villa-pool" },
  ],
};

/** Home interiors by house design (the starter room is a face-me room). */
export const HOME_INTERIOR: Record<string, string> = {
  starter: "home-face-me",
  bungalow: "home-self-contain",
  storey_house: "home-mini-flat",
  family_compound: "home-mini-flat",
  terrace_duplex: "home-duplex",
  villa: "home-mansion",
  rent_self_contain: "home-self-contain",
  rent_mini_flat: "home-mini-flat",
  rent_flat: "home-duplex",
};

/** A saved contact, with where they are if they're online now. */
export interface ContactView {
  nickname: string;
  avatar: AvatarConfig;
  online: boolean;
  place: string | null;
  x: number | null;
  y: number | null;
}
