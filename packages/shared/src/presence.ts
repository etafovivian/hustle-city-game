// Presence: other players online right now and where they are (so friends can meet up).
import type { AvatarConfig } from "./profile.js";

export interface PresencePlayer {
  nickname: string;
  avatar: AvatarConfig;
  x: number;
  y: number;
  /** A place key (venue, branch "base@building", or "home:<plotId>") when they're inside one. */
  place: string | null;
}

export interface PresencePing {
  from: string;
  kind: "wave" | "drink" | "join";
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
 * Rooms in each kind of home: the first is where you arrive. Bigger houses have more rooms; rooms without their own
 * art yet reuse the closest one until the Stitch batch for them lands (docs/stitch/queue.md, batch 32).
 */
export const HOME_ROOMS: Record<string, { key: string; label: string; art: string }[]> = {
  starter: [{ key: "room", label: "Your room", art: "home-face-me" }],
  bungalow: [
    { key: "parlour", label: "Parlour", art: "home-self-contain" },
    { key: "bedroom", label: "Bedroom", art: "home-mini-flat" },
  ],
  storey_house: [
    { key: "parlour", label: "Parlour", art: "home-mini-flat" },
    { key: "bedroom", label: "Bedroom", art: "home-self-contain" },
  ],
  family_compound: [
    { key: "parlour", label: "Parlour", art: "home-mini-flat" },
    { key: "bedroom", label: "Bedroom", art: "home-self-contain" },
    { key: "yard", label: "Compound yard", art: "home-face-me" },
  ],
  terrace_duplex: [
    { key: "living", label: "Living room", art: "home-duplex" },
    { key: "bedroom", label: "Master bedroom", art: "home-mini-flat" },
    { key: "kitchen", label: "Kitchen", art: "home-self-contain" },
  ],
  villa: [
    { key: "living", label: "Grand living room", art: "home-mansion" },
    { key: "lounge", label: "Lounge", art: "home-duplex" },
    { key: "bedroom", label: "Master suite", art: "home-crazy" },
    { key: "kitchen", label: "Kitchen", art: "home-mini-flat" },
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
};
