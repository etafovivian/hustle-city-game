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
  kind: "wave" | "drink";
  place: string | null;
}

export interface PresenceReply {
  players: PresencePlayer[];
  pings: PresencePing[];
}

/** Home interiors by house design (the starter room is a face-me room). */
export const HOME_INTERIOR: Record<string, string> = {
  starter: "home-face-me",
  bungalow: "home-self-contain",
  storey_house: "home-mini-flat",
  family_compound: "home-mini-flat",
  terrace_duplex: "home-duplex",
  villa: "home-mansion",
};
