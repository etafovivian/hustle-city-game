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

export const POCKETS = [
  [0, 0],
  [TABLE.w / 2, -6],
  [TABLE.w, 0],
  [0, TABLE.h],
  [TABLE.w / 2, TABLE.h + 6],
  [TABLE.w, TABLE.h],
] as const;
export const CUE_SPOT = { x: 250, y: 250 };

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

/** Cloth: a ball loses a little speed each step plus a steady rolling drag, so it slows and stops like on baize. */
const ROLL = 0.992;
const DRAG = 0.016;
/** Energy kept when a ball bounces off a cushion, and in a ball-on-ball hit. */
const CUSHION = 0.78;
const BALLS = 0.95;
/** Fastest cue ball (power 1), slowest (a touch). */
export const POOL_SPEED = { min: 3, max: 30 };

/** Things that happened in a step, for sound: hits (with how hard), cushions and pots. */
export interface PoolEvent {
  type: "hit" | "cushion" | "pot";
  speed: number;
  ball: number;
}
/** The shot under way: what the cue ball hit first, and its spin (follow > 0, draw < 0) until that first hit. */
export interface PoolShot {
  first: BallKind | null;
  spin?: number;
  dx?: number;
  dy?: number;
  speed?: number;
}

/** Advance the balls one step; returns false once everything has stopped. Mutates. */
export function poolStep(balls: Ball[], hits: PoolShot, potted: Ball[], events?: PoolEvent[]): boolean {
  const r = TABLE.r;
  let fastest = 0;
  for (const b of balls) if (!b.in) fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
  // Fast balls move in small steps so they never pass through each other.
  const sub = Math.max(1, Math.ceil(fastest / (r * 0.6)));
  let moving = false;
  for (let k = 0; k < sub; k++) {
    for (const b of balls) {
      if (b.in || (b.vx === 0 && b.vy === 0)) continue;
      b.x += b.vx / sub;
      b.y += b.vy / sub;
      for (const [px, py] of POCKETS)
        if ((b.x - px) ** 2 + (b.y - py) ** 2 < TABLE.pocket ** 2) {
          b.in = true;
          events?.push({ type: "pot", speed: Math.hypot(b.vx, b.vy), ball: b.id });
          b.vx = b.vy = 0;
          potted.push(b);
          break;
        }
      if (b.in) continue;
      const bounce = (v: number) => (events?.push({ type: "cushion", speed: Math.abs(v), ball: b.id }), -v * CUSHION);
      if (b.x < r) (b.x = r), (b.vx = bounce(b.vx));
      if (b.x > TABLE.w - r) (b.x = TABLE.w - r), (b.vx = bounce(b.vx));
      if (b.y < r) (b.y = r), (b.vy = bounce(b.vy));
      if (b.y > TABLE.h - r) (b.y = TABLE.h - r), (b.vy = bounce(b.vy));
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
        const push = (2 * r - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 0) continue;
        // Equal masses: swap the speed along the line between the centres (losing a little).
        const j2 = ((1 + BALLS) / 2) * rel;
        a.vx -= j2 * nx;
        a.vy -= j2 * ny;
        b.vx += j2 * nx;
        b.vy += j2 * ny;
        events?.push({ type: "hit", speed: rel, ball: a.kind === "cue" ? b.id : a.id });
        if (hits.first === null && (a.kind === "cue" || b.kind === "cue")) {
          hits.first = a.kind === "cue" ? b.kind : a.kind;
          // Spin takes hold after the first hit: follow rolls on through, draw screws back.
          const cue = a.kind === "cue" ? a : b;
          if (hits.spin && hits.dx !== undefined && hits.dy !== undefined) {
            const kick = hits.spin * (hits.speed ?? 0) * 0.42;
            cue.vx += hits.dx * kick;
            cue.vy += hits.dy * kick;
            hits.spin = 0;
          }
        }
      }
  }
  for (const b of balls) {
    if (b.in) continue;
    const v = Math.hypot(b.vx, b.vy);
    if (v === 0) continue;
    const next = v * ROLL - DRAG;
    if (next <= 0.02) b.vx = b.vy = 0;
    else {
      b.vx *= next / v;
      b.vy *= next / v;
      moving = true;
    }
  }
  // Spin wears off as the cue ball travels.
  if (hits.spin) {
    hits.spin *= 0.997;
    if (hits.speed) hits.speed = Math.max(0, hits.speed * ROLL - DRAG);
  }
  return moving;
}

/** Set the cue ball going: angle in radians, power 0..1, spin -1 (draw) .. 1 (follow). */
export function poolStrike(balls: Ball[], angle: number, power: number, spin = 0): PoolShot {
  const cue = balls.find((b) => b.kind === "cue")!;
  const speed = POOL_SPEED.min + Math.max(0, Math.min(1, power)) * (POOL_SPEED.max - POOL_SPEED.min);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  cue.vx = dx * speed;
  cue.vy = dy * speed;
  return { first: null, spin: Math.max(-1, Math.min(1, spin)), dx, dy, speed };
}

/** Strike the cue ball and play the shot to the end. Pure. */
export function poolShoot(s: PoolState, angle: number, power: number, spin = 0): PoolState {
  if (s.over) return s;
  const balls = s.balls.map((b) => ({ ...b }));
  const hits = poolStrike(balls, angle, power, spin);
  const potted: Ball[] = [];
  for (let i = 0; i < 6000 && poolStep(balls, hits, potted); i++);
  for (const b of balls) b.vx = b.vy = 0;
  return poolJudge(s, balls, hits.first, potted);
}

/** Where the cue ball would first touch another ball along `angle` (the "ghost ball"), or where it meets a cushion. */
export function poolAim(balls: Ball[], angle: number): { x: number; y: number; ball: Ball | null } {
  const cue = balls.find((b) => b.kind === "cue" && !b.in);
  if (!cue) return { x: 0, y: 0, ball: null };
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = Infinity;
  let hit: Ball | null = null;
  for (const b of balls) {
    if (b === cue || b.in) continue;
    const fx = b.x - cue.x;
    const fy = b.y - cue.y;
    const along = fx * dx + fy * dy;
    if (along <= 0) continue;
    const off2 = fx * fx + fy * fy - along * along;
    const rr = (2 * TABLE.r) ** 2;
    if (off2 > rr) continue;
    const t = along - Math.sqrt(rr - off2);
    if (t < best) [best, hit] = [t, b];
  }
  if (!hit) {
    const r = TABLE.r;
    const tx = dx > 0 ? (TABLE.w - r - cue.x) / dx : dx < 0 ? (r - cue.x) / dx : Infinity;
    const ty = dy > 0 ? (TABLE.h - r - cue.y) / dy : dy < 0 ? (r - cue.y) / dy : Infinity;
    best = Math.min(tx, ty);
  }
  return { x: cue.x + dx * best, y: cue.y + dy * best, ball: hit };
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
