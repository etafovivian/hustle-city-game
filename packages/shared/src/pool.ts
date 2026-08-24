// Snooker (Naija pool rules, simplified): 7 red, 7 yellow and the black. Player 0 pots reds, player 1 yellows. Pot
// one of yours and you go again; a foul (cue ball potted, hitting nothing, or potting the other colour) passes the
// turn. Pot the black after all yours to win; pot it early and you lose. The same physics runs on both phones (to
// animate) and on the server (which decides).

export const TABLE = { w: 1000, h: 500, r: 13, pocket: 30 };
export type BallKind = "cue" | "red" | "yellow" | "black";
export interface Ball {
  id: number;
  kind: BallKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  in: boolean;
}
export interface PoolState {
  balls: Ball[];
  turn: 0 | 1;
  over: boolean;
  winner: 0 | 1 | null;
  /** What happened on the last shot, for the players. */
  note: string;
  shots: number;
}

const POCKETS = [
  [0, 0],
  [TABLE.w / 2, -6],
  [TABLE.w, 0],
  [0, TABLE.h],
  [TABLE.w / 2, TABLE.h + 6],
  [TABLE.w, TABLE.h],
] as const;
const CUE_SPOT = { x: 250, y: 250 };

export function poolStart(): PoolState {
  const balls: Ball[] = [{ id: 0, kind: "cue", x: CUE_SPOT.x, y: CUE_SPOT.y, vx: 0, vy: 0, in: false }];
  // A triangle at the far end: 5 rows, black in the middle.
  const order: BallKind[] = ["red", "yellow", "red", "red", "black", "yellow", "yellow", "red", "yellow", "red", "yellow", "red", "yellow", "red", "yellow"];
  let k = 0;
  const d = TABLE.r * 2 + 0.5;
  for (let row = 0; row < 5; row++)
    for (let i = 0; i <= row; i++) {
      balls.push({ id: k + 1, kind: order[k]!, x: 700 + row * d * 0.866, y: 250 + (i - row / 2) * d, vx: 0, vy: 0, in: false });
      k++;
    }
  return { balls, turn: 0, over: false, winner: null, note: "Break!", shots: 0 };
}

const FRICTION = 0.985;
const STOP = 0.05;

/** Advance the balls one step; returns false once everything has stopped. Mutates. */
export function poolStep(balls: Ball[], hits: { first: BallKind | null }, potted: Ball[]): boolean {
  const r = TABLE.r;
  let moving = false;
  for (const b of balls) {
    if (b.in) continue;
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if (Math.abs(b.vx) < STOP && Math.abs(b.vy) < STOP) b.vx = b.vy = 0;
    else moving = true;
    for (const [px, py] of POCKETS)
      if ((b.x - px) ** 2 + (b.y - py) ** 2 < TABLE.pocket ** 2) {
        b.in = true;
        b.vx = b.vy = 0;
        potted.push(b);
      }
    if (b.in) continue;
    if (b.x < r) (b.x = r), (b.vx = -b.vx * 0.9);
    if (b.x > TABLE.w - r) (b.x = TABLE.w - r), (b.vx = -b.vx * 0.9);
    if (b.y < r) (b.y = r), (b.vy = -b.vy * 0.9);
    if (b.y > TABLE.h - r) (b.y = TABLE.h - r), (b.vy = -b.vy * 0.9);
  }
  for (let i = 0; i < balls.length; i++)
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]!;
      const b = balls[j]!;
      if (a.in || b.in) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 4 * r * r || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      // Separate, then swap the velocity along the line between them (equal masses).
      const push = (2 * r - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel <= 0) continue;
      a.vx -= rel * nx;
      a.vy -= rel * ny;
      b.vx += rel * nx;
      b.vy += rel * ny;
      if (hits.first === null) {
        if (a.kind === "cue") hits.first = b.kind;
        else if (b.kind === "cue") hits.first = a.kind;
      }
      moving = true;
    }
  return moving;
}

/** Strike the cue ball (angle in radians, power 0..1) and play the shot to the end. Pure. */
export function poolShoot(s: PoolState, angle: number, power: number): PoolState {
  if (s.over) return s;
  const balls = s.balls.map((b) => ({ ...b }));
  const cue = balls.find((b) => b.kind === "cue")!;
  const speed = 4 + Math.max(0, Math.min(1, power)) * 26;
  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;
  const hits = { first: null as BallKind | null };
  const potted: Ball[] = [];
  for (let i = 0; i < 4000 && poolStep(balls, hits, potted); i++);
  return poolJudge(s, balls, hits.first, potted);
}

const mine = (p: 0 | 1): BallKind => (p === 0 ? "red" : "yellow");

function poolJudge(s: PoolState, balls: Ball[], first: BallKind | null, potted: Ball[]): PoolState {
  const p = s.turn;
  const other = (p === 0 ? 1 : 0) as 0 | 1;
  const left = (k: BallKind) => balls.filter((b) => b.kind === k && !b.in).length;
  const base = { ...s, balls, shots: s.shots + 1 };
  if (potted.some((b) => b.kind === "black")) {
    const cleared = left(mine(p)) === 0 && !potted.some((b) => b.kind === "cue");
    return { ...base, over: true, winner: cleared ? p : other, note: cleared ? "Black potted. Game!" : "Black potted too early. Game over." };
  }
  const cueIn = potted.some((b) => b.kind === "cue");
  if (cueIn) {
    const cue = balls.find((b) => b.kind === "cue")!;
    Object.assign(cue, { in: false, x: CUE_SPOT.x, y: CUE_SPOT.y, vx: 0, vy: 0 });
  }
  const foul = cueIn || first === null || (first !== mine(p) && !(first === "black" && left(mine(p)) === 0));
  const goodPot = potted.some((b) => b.kind === mine(p));
  if (foul) return { ...base, turn: other, note: cueIn ? "Foul: cue ball potted." : first === null ? "Foul: missed everything." : "Foul: hit the wrong colour first." };
  if (goodPot) return { ...base, note: "Potted! Go again." };
  return { ...base, turn: other, note: "No pot." };
}

export const poolLeft = (s: PoolState, p: 0 | 1) => s.balls.filter((b) => b.kind === mine(p) && !b.in).length;
