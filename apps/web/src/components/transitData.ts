// Public transport on the map: BRT bus lines, the light-rail line, the water bus (ferry) and the coach out of Lagos.
// The map agent lays these out (stations, lines, piers) with the city layout; the ride code (transit.ts, Rides.tsx)
// plans trips on them: walk to a stop, ride the line, walk from the stop at the other end.
//
// Contract:
// - Every stop has a unique, stable id (like plot ids: never rename one once shipped) and a position where a person
//   stands to board (on the pavement or platform for BRT/rail, on the pier for the ferry, in the coach bay).
// - A line's `path` is the polyline the vehicle follows, passing through each of its stops in order; `stopAt[i]` is
//   the index in `path` of `stops[i]`. Lines run both ways.
// - Positions are map units (the same space as cityLayout's iso()).
import { TRANSIT_LINES_L, TRANSIT_STOPS_L } from "./cityLayout.js";

export type TransitMode = "brt" | "rail" | "ferry" | "coach" | "flight";

export interface TransitStop {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Which modes call here (an interchange can have several). */
  modes: TransitMode[];
}

export interface TransitLine {
  key: string;
  name: string;
  mode: TransitMode;
  /** Line colour on the map and in the ride picker. */
  color: string;
  /** Stop ids in order along the line. */
  stops: string[];
  path: { x: number; y: number }[];
  stopAt: number[];
}

// Laid out with the city (cityLayout.ts, "Public transport"): stations beside the Coast Line's own track, BRT stops on
// the pavements of Roads A and B (and the Island road), water bus piers on the lagoon, the coach bay at Danfo Terminal.
export const TRANSIT_STOPS: TransitStop[] = TRANSIT_STOPS_L;
export const TRANSIT_LINES: TransitLine[] = TRANSIT_LINES_L;
export const TRANSIT_STOP_BY_ID = new Map<string, TransitStop>(TRANSIT_STOPS.map((s) => [s.id, s]));
