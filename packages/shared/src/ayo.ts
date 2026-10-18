// Ayo (Ayọ̀ Ọlọ́pọ́n), the Yoruba sowing game. Two rows of six pits, four seeds each. On your turn pick one of your
// pits and sow its seeds one by one anticlockwise (skipping the pit you emptied when there are 12 or more). If your
// last seed lands in the opponent's row and makes 2 or 3, you take them, and keep taking backwards while the
// opponent's pits hold 2 or 3. You must leave your opponent a move if you can. The game ends when someone can't
// move or has more than half the seeds (24 of 48).
// Pits 0-5 are player 0's row (left to right), 6-11 player 1's (right to left, so sowing goes 0→11→0).

export interface AyoState {
  pits: number[];
  stores: [number, number];
  turn: 0 | 1;
  over: boolean;
  winner: 0 | 1 | null; // null = draw (when over)
}

export const ayoStart = (): AyoState => ({ pits: Array(12).fill(4), stores: [0, 0], turn: 0, over: false, winner: null });
const own = (p: number, pit: number) => (p === 0 ? pit < 6 : pit >= 6);

/** Sow from a pit without the "leave them a move" rule: the raw result. */
function sow(s: AyoState, pit: number): AyoState {
  const pits = [...s.pits];
  const stores: [number, number] = [s.stores[0], s.stores[1]];
  let seeds = pits[pit]!;
  pits[pit] = 0;
  let i = pit;
  while (seeds > 0) {
    i = (i + 1) % 12;
    if (i === pit) continue;
    pits[i]!++;
    seeds--;
  }
  // Capture backwards from the last pit while it's the opponent's and holds 2 or 3.
  const p = s.turn;
  const before = [...pits];
  let taken = 0;
  let j = i;
  while (!own(p, j) && (pits[j] === 2 || pits[j] === 3)) {
    taken += pits[j]!;
    pits[j] = 0;
    j = (j + 11) % 12;
  }
  // A capture that would wipe out the opponent's whole row is not allowed (grand slam): no capture then.
  const oppEmpty = pits.every((n, k) => own(p, k) || n === 0);
  if (taken && oppEmpty) return { ...s, pits: before, stores, turn: p === 0 ? 1 : 0 };
  stores[p] += taken;
  return { ...s, pits, stores, turn: p === 0 ? 1 : 0 };
}

/** How a move plays out, seed by seed (for the board to animate): each pit a seed drops into, in order, and the
 * pits captured afterwards (in the order they're taken; empty when there's no capture or a grand slam). */
export function ayoTrace(s: AyoState, pit: number): { drops: number[]; captured: { pit: number; seeds: number }[] } {
  const pits = [...s.pits];
  let seeds = pits[pit]!;
  pits[pit] = 0;
  const drops: number[] = [];
  let i = pit;
  while (seeds > 0) {
    i = (i + 1) % 12;
    if (i === pit) continue;
    pits[i]!++;
    drops.push(i);
    seeds--;
  }
  const p = s.turn;
  const captured: { pit: number; seeds: number }[] = [];
  let j = i;
  while (!own(p, j) && (pits[j] === 2 || pits[j] === 3)) {
    captured.push({ pit: j, seeds: pits[j]! });
    pits[j] = 0;
    j = (j + 11) % 12;
  }
  const oppEmpty = pits.every((n, k) => own(p, k) || n === 0);
  return { drops, captured: captured.length && oppEmpty ? [] : captured };
}

/** The pit that turned `before` into `after` (a move by `before.turn`), or null if none does. */
export function ayoFindMove(before: AyoState, after: AyoState): number | null {
  for (const m of ayoMoves(before)) {
    const x = ayoPlay(before, m);
    if (x.stores[0] === after.stores[0] && x.stores[1] === after.stores[1] && x.pits.every((n, k) => n === after.pits[k])) return m;
  }
  return null;
}

const oppHasSeeds = (s: AyoState, p: 0 | 1) => s.pits.some((n, k) => !own(p, k) && n > 0);

export function ayoMoves(s: AyoState): number[] {
  if (s.over) return [];
  const p = s.turn;
  const mine = s.pits.map((n, k) => (own(p, k) && n > 0 ? k : -1)).filter((k) => k >= 0);
  // If the opponent has no seeds, you must give them some if you can.
  if (!oppHasSeeds(s, p)) {
    const feeding = mine.filter((k) => oppHasSeeds({ ...sow(s, k), turn: p }, p));
    return feeding.length ? feeding : [];
  }
  return mine;
}

function finish(s: AyoState): AyoState {
  const [a, b] = s.stores;
  if (a > 24 || b > 24 || ayoMoves(s).length === 0) {
    // Remaining seeds go to whoever's row they're in.
    const stores: [number, number] = [a + s.pits.slice(0, 6).reduce((x, y) => x + y, 0), b + s.pits.slice(6).reduce((x, y) => x + y, 0)];
    if (a > 24 || b > 24) return { ...s, over: true, winner: a > b ? 0 : 1 };
    return { ...s, pits: Array(12).fill(0), stores, over: true, winner: stores[0] === stores[1] ? null : stores[0] > stores[1] ? 0 : 1 };
  }
  return s;
}

export function ayoPlay(s: AyoState, pit: number): AyoState {
  if (!ayoMoves(s).includes(pit)) throw new Error("illegal move");
  return finish(sow(s, pit));
}

/** The computer's move: a small minimax (deterministic, so the server can replay games). */
export function ayoBest(s: AyoState, depth = 4): number {
  const me = s.turn;
  const score = (x: AyoState) => x.stores[me] - x.stores[me === 0 ? 1 : 0];
  const search = (x: AyoState, d: number, alpha: number, beta: number): number => {
    if (d === 0 || x.over) return x.over && x.winner !== null ? (x.winner === me ? 1000 : -1000) + score(x) : score(x);
    const moves = ayoMoves(x);
    if (x.turn === me) {
      let best = -Infinity;
      for (const m of moves) {
        best = Math.max(best, search(ayoPlay(x, m), d - 1, alpha, beta));
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (const m of moves) {
      best = Math.min(best, search(ayoPlay(x, m), d - 1, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  };
  const moves = ayoMoves(s);
  let pick = moves[0]!;
  let best = -Infinity;
  for (const m of moves) {
    const v = search(ayoPlay(s, m), depth - 1, -Infinity, Infinity);
    if (v > best) [best, pick] = [v, m];
  }
  return pick;
}

/**
 * Replay a game against the computer from the player's moves (player 0 moves first; the computer's replies are
 * recomputed). Returns the final state, or null if any move was illegal.
 */
export function ayoReplayVsComputer(moves: number[], depth = 3): AyoState | null {
  let s = ayoStart();
  for (const m of moves) {
    if (s.over || s.turn !== 0 || !ayoMoves(s).includes(m)) return null;
    s = ayoPlay(s, m);
    while (!s.over && s.turn === 1) s = ayoPlay(s, ayoBest(s, depth));
  }
  return s;
}

/** Coins for beating the computer (up to AYO_WINS_PER_DAY rewarded wins a day). */
export const AYO_WIN = { coins: 300, xp: 25 };
export const AYO_WINS_PER_DAY = 3;
