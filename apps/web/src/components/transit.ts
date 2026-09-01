// Trip planning on public transport (lines and stops from transitData.ts): walk to a stop, ride the line (with at
// most one change at a shared stop), walk from the last stop. The ride picker offers the best plan per kind of
// transport when it beats walking, and always when walking can't get there (an island only the water bus reaches).
import { TRANSIT, transitFare, type TransitKind } from "@hc/shared";
import { walkRoute } from "./cityLayout.js";
import { TRANSIT_LINES, TRANSIT_STOP_BY_ID, type TransitLine, type TransitStop } from "./transitData.js";

type P = { x: number; y: number };
const WALK_SPEED = 300;
/** Stops farther than this (straight line) from the start or the end aren't worth walking to. */
const MAX_WALK = 2200;

export interface TripLeg {
  kind: "walk" | TransitKind;
  path: P[];
  units: number;
  /** Ride legs: the line and the stops. */
  line?: string;
  board?: string;
  alight?: string;
}
export interface TransitPlan {
  legs: TripLeg[];
  fare: number;
  seconds: number;
  /** Kinds ridden, in order ("brt", or "rail" then "ferry"). */
  kinds: TransitKind[];
  title: string;
  detail: string;
  color: string;
}

const len = (path: P[]) => path.reduce((s, p, i) => (i ? s + Math.hypot(p.x - path[i - 1]!.x, p.y - path[i - 1]!.y) : 0), 0);
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** The part of a line's path between two of its stops (either direction). */
export function lineSegment(line: TransitLine, from: string, to: string): P[] | null {
  const i = line.stops.indexOf(from);
  const j = line.stops.indexOf(to);
  if (i < 0 || j < 0 || i === j) return null;
  const a = line.stopAt[i]!;
  const b = line.stopAt[j]!;
  return a < b ? line.path.slice(a, b + 1) : line.path.slice(b, a + 1).reverse();
}

const walkLeg = (from: P, to: P): TripLeg | null => {
  if (dist(from, to) < 5) return { kind: "walk", path: [to], units: 0 };
  const path = walkRoute(from, to);
  return path ? { kind: "walk", path, units: Math.round(len([from, ...path])) } : null;
};
const rideLeg = (line: TransitLine, board: string, alight: string): TripLeg | null => {
  const path = lineSegment(line, board, alight);
  return path ? { kind: line.mode, path, units: Math.max(1, Math.round(len(path))), line: line.key, board, alight } : null;
};
const near = (line: TransitLine, p: P) =>
  line.stops
    .map((id) => TRANSIT_STOP_BY_ID.get(id)!)
    .filter((s) => s && dist(s, p) < MAX_WALK)
    .sort((a, b) => dist(a, p) - dist(b, p))
    .slice(0, 2);

function score(legs: TripLeg[]): { seconds: number; fare: number } {
  let seconds = 0;
  let fare = 0;
  for (const l of legs) {
    if (l.kind === "walk") seconds += l.units / WALK_SPEED;
    else {
      seconds += TRANSIT[l.kind].wait + l.units / TRANSIT[l.kind].speed;
      fare += transitFare(l.kind, l.units);
    }
  }
  return { seconds: Math.round(seconds), fare };
}

function plan(legs: (TripLeg | null)[]): TransitPlan | null {
  if (legs.some((l) => !l)) return null;
  const ok = legs as TripLeg[];
  const rides = ok.filter((l) => l.kind !== "walk");
  const { seconds, fare } = score(ok);
  const kinds = rides.map((r) => r.kind as TransitKind);
  const lines = rides.map((r) => TRANSIT_LINES.find((x) => x.key === r.line)!);
  const stopName = (id?: string) => (id ? (TRANSIT_STOP_BY_ID.get(id)?.name ?? id) : "");
  return {
    legs: ok,
    fare,
    seconds,
    kinds,
    title: kinds.map((k) => TRANSIT[k].label).join(" + "),
    detail: rides.map((r) => `${stopName(r.board)} → ${stopName(r.alight)}`).join(", change, "),
    color: lines[0]!.color,
  };
}

/** The best plan for each kind of transport from `from` to `to` (none when there are no lines nearby). */
export function transitPlans(from: P, to: P): TransitPlan[] {
  if (!TRANSIT_LINES.length) return [];
  const all: TransitPlan[] = [];
  const usable = TRANSIT_LINES.filter((l) => l.mode !== "coach");
  for (const line of usable) {
    for (const b of near(line, from))
      for (const a of near(line, to)) {
        if (a.id === b.id) continue;
        const p = plan([walkLeg(from, b), rideLeg(line, b.id, a.id), walkLeg(a, to)]);
        if (p) all.push(p);
      }
  }
  // One change at a stop two lines share.
  for (const l1 of usable)
    for (const l2 of usable) {
      if (l1 === l2) continue;
      const shared = l1.stops.filter((s) => l2.stops.includes(s));
      for (const x of shared)
        for (const b of near(l1, from))
          for (const a of near(l2, to)) {
            if (b.id === x || a.id === x) continue;
            const p = plan([walkLeg(from, b), rideLeg(l1, b.id, x), rideLeg(l2, x, a.id), walkLeg(a, to)]);
            if (p) all.push(p);
          }
    }
  // Best (fastest) per combination of kinds.
  const best = new Map<string, TransitPlan>();
  for (const p of all) {
    const k = p.kinds.join("+");
    const cur = best.get(k);
    if (!cur || p.seconds < cur.seconds) best.set(k, p);
  }
  return [...best.values()].sort((a, b) => a.seconds - b.seconds).slice(0, 3);
}

/** Should the picker offer this plan? Yes if it's quicker than walking, or walking can't get there. */
export function worthIt(p: TransitPlan, walkUnits: number | null) {
  if (walkUnits === null) return true;
  return p.seconds < (walkUnits / WALK_SPEED) * 0.8;
}

export type { TransitStop };
