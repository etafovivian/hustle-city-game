// Chess: full rules (castling, en passant, promotion, check, mate, stalemate, 50 moves, bare kings) on a 64-square
// string board, plus a small computer opponent ("Professor", alpha-beta on material and position).
// Squares: 0 = a8 (top left, Black's back rank) … 63 = h1. Uppercase = White (player 0), lowercase = Black (player 1),
// "." = empty. The same code checks moves on the server and draws the board on the phone.

export type ChessPromo = "q" | "r" | "b" | "n";
export interface ChessMove {
  from: number;
  to: number;
  promo?: ChessPromo;
}
export interface ChessState {
  board: string;
  turn: 0 | 1;
  /** Castling still allowed: any of "KQkq". */
  castle: string;
  /** The square a pawn can be taken on en passant, or -1. */
  ep: number;
  /** Half-moves since a capture or pawn move (50-move rule). */
  half: number;
  last: { from: number; to: number } | null;
  check: boolean;
  over: boolean;
  winner: 0 | 1 | null;
  note: string;
}

const START = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
export const chessStart = (): ChessState => ({ board: START, turn: 0, castle: "KQkq", ep: -1, half: 0, last: null, check: false, over: false, winner: null, note: "White to move." });

const rowOf = (sq: number) => sq >> 3;
const colOf = (sq: number) => sq & 7;
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
const isWhite = (p: string) => p !== "." && p === p.toUpperCase();
const sideOf = (p: string): 0 | 1 | null => (p === "." ? null : isWhite(p) ? 0 : 1);
export const chessSquare = (sq: number) => "abcdefgh"[colOf(sq)]! + (8 - rowOf(sq));

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Is `sq` attacked by `by`'s pieces? */
function attacked(board: string, sq: number, by: 0 | 1): boolean {
  const r = rowOf(sq);
  const c = colOf(sq);
  const has = (i: number, kind: string) => i >= 0 && board[i] === (by === 0 ? kind.toUpperCase() : kind);
  // Pawns attack diagonally forward (White up the board, so from the row below).
  const pr = by === 0 ? r + 1 : r - 1;
  if (has(at(pr, c - 1), "p") || has(at(pr, c + 1), "p")) return true;
  for (const [dr, dc] of KNIGHT) if (has(at(r + dr!, c + dc!), "n")) return true;
  for (const [dr, dc] of KING) if (has(at(r + dr!, c + dc!), "k")) return true;
  const slide = (dirs: number[][], kinds: string[]) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr!;
      let cc = c + dc!;
      while (at(rr, cc) >= 0) {
        const p = board[at(rr, cc)]!;
        if (p !== ".") {
          if (sideOf(p) === by && kinds.includes(p.toLowerCase())) return true;
          break;
        }
        rr += dr!;
        cc += dc!;
      }
    }
    return false;
  };
  return slide(ROOK, ["r", "q"]) || slide(BISHOP, ["b", "q"]);
}

const kingSquare = (board: string, side: 0 | 1) => board.indexOf(side === 0 ? "K" : "k");
export const chessInCheck = (s: ChessState) => attacked(s.board, kingSquare(s.board, s.turn), s.turn === 0 ? 1 : 0);

/** Moves that follow how pieces move, before checking your own king is safe. */
function pseudo(s: ChessState): ChessMove[] {
  const out: ChessMove[] = [];
  const b = s.board;
  const me = s.turn;
  const push = (from: number, to: number) => {
    const p = b[from]!.toLowerCase();
    if (p === "p" && (rowOf(to) === 0 || rowOf(to) === 7)) for (const promo of ["q", "r", "b", "n"] as const) out.push({ from, to, promo });
    else out.push({ from, to });
  };
  for (let sq = 0; sq < 64; sq++) {
    const piece = b[sq]!;
    if (sideOf(piece) !== me) continue;
    const r = rowOf(sq);
    const c = colOf(sq);
    const kind = piece.toLowerCase();
    const target = (i: number) => i >= 0 && sideOf(b[i]!) !== me;
    if (kind === "p") {
      const dir = me === 0 ? -1 : 1;
      const one = at(r + dir, c);
      if (one >= 0 && b[one] === ".") {
        push(sq, one);
        const two = at(r + 2 * dir, c);
        if ((me === 0 ? r === 6 : r === 1) && b[two] === ".") push(sq, two);
      }
      for (const dc of [-1, 1]) {
        const t = at(r + dir, c + dc);
        if (t < 0) continue;
        if ((b[t] !== "." && sideOf(b[t]!) !== me) || t === s.ep) push(sq, t);
      }
    } else if (kind === "n" || kind === "k") {
      for (const [dr, dc] of kind === "n" ? KNIGHT : KING) {
        const t = at(r + dr!, c + dc!);
        if (target(t)) push(sq, t);
      }
      if (kind === "k") {
        // Castling: rights kept, squares between empty, and the king doesn't start, pass or land in check.
        const them = me === 0 ? 1 : 0;
        const home = me === 0 ? 60 : 4;
        if (sq === home && !attacked(b, home, them)) {
          const [k, q] = me === 0 ? ["K", "Q"] : ["k", "q"];
          if (s.castle.includes(k) && b[home + 1] === "." && b[home + 2] === "." && !attacked(b, home + 1, them)) out.push({ from: sq, to: home + 2 });
          if (s.castle.includes(q) && b[home - 1] === "." && b[home - 2] === "." && b[home - 3] === "." && !attacked(b, home - 1, them)) out.push({ from: sq, to: home - 2 });
        }
      }
    } else {
      const dirs = kind === "r" ? ROOK : kind === "b" ? BISHOP : [...ROOK, ...BISHOP];
      for (const [dr, dc] of dirs) {
        let rr = r + dr!;
        let cc = c + dc!;
        while (at(rr, cc) >= 0) {
          const t = at(rr, cc);
          if (b[t] === ".") push(sq, t);
          else {
            if (sideOf(b[t]!) !== me) push(sq, t);
            break;
          }
          rr += dr!;
          cc += dc!;
        }
      }
    }
  }
  return out;
}

/** Move the pieces (no legality checks): the new board, castling rights, en passant square and 50-move count. */
function apply(s: ChessState, m: ChessMove): ChessState {
  const b = s.board.split("");
  const piece = b[m.from]!;
  const kind = piece.toLowerCase();
  const captured = b[m.to] !== "." || (kind === "p" && m.to === s.ep);
  b[m.to] = m.promo ? (s.turn === 0 ? m.promo.toUpperCase() : m.promo) : piece;
  b[m.from] = ".";
  if (kind === "p" && m.to === s.ep) b[m.to + (s.turn === 0 ? 8 : -8)] = ".";
  if (kind === "k" && Math.abs(m.to - m.from) === 2) {
    // Castling: the rook jumps over the king.
    const kingside = m.to > m.from;
    const rookFrom = kingside ? m.from + 3 : m.from - 4;
    const rookTo = kingside ? m.from + 1 : m.from - 1;
    b[rookTo] = b[rookFrom]!;
    b[rookFrom] = ".";
  }
  let castle = s.castle;
  const drop = (chars: string) => (castle = castle.split("").filter((ch) => !chars.includes(ch)).join(""));
  if (piece === "K") drop("KQ");
  if (piece === "k") drop("kq");
  for (const sq of [m.from, m.to]) {
    if (sq === 63) drop("K");
    if (sq === 56) drop("Q");
    if (sq === 7) drop("k");
    if (sq === 0) drop("q");
  }
  const ep = kind === "p" && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  return { ...s, board: b.join(""), turn: s.turn === 0 ? 1 : 0, castle, ep, half: captured || kind === "p" ? 0 : s.half + 1, last: { from: m.from, to: m.to } };
}

export function chessMoves(s: ChessState): ChessMove[] {
  if (s.over) return [];
  return pseudo(s).filter((m) => {
    const next = apply(s, m);
    return !attacked(next.board, kingSquare(next.board, s.turn), next.turn);
  });
}

const sameMove = (a: ChessMove, b: ChessMove) => a.from === b.from && a.to === b.to && (a.promo ?? "q") === (b.promo ?? "q");
export const chessLegal = (s: ChessState, m: ChessMove) => chessMoves(s).some((x) => x.from === m.from && x.to === m.to && (!x.promo || sameMove(x, m)));

/** Play a legal move (a pawn reaching the end becomes a queen unless you pick another piece). */
export function chessPlay(s: ChessState, m: ChessMove): ChessState {
  const legal = chessMoves(s).filter((x) => x.from === m.from && x.to === m.to);
  if (!legal.length) throw new Error("illegal move");
  const move = legal.find((x) => !x.promo || x.promo === (m.promo ?? "q"))!;
  const next = apply(s, move);
  const check = chessInCheck(next);
  const replies = chessMoves(next).length;
  const who = next.turn === 0 ? "White" : "Black";
  const rest = next.board.replace(/[.Kk]/g, "");
  if (!replies) return { ...next, check, over: true, winner: check ? s.turn : null, note: check ? `Checkmate! ${s.turn === 0 ? "White" : "Black"} wins.` : "Stalemate: a draw." };
  if (next.half >= 100) return { ...next, check, over: true, winner: null, note: "Fifty moves without a capture: a draw." };
  if (rest === "" || /^[NnBb]$/.test(rest)) return { ...next, check, over: true, winner: null, note: "Not enough pieces to mate: a draw." };
  return { ...next, check, note: check ? `${who} is in check!` : `${who} to move.` };
}

/** Resign: the other side wins. */
export const chessResign = (s: ChessState, side: 0 | 1): ChessState => ({ ...s, over: true, winner: side === 0 ? 1 : 0, note: `${side === 0 ? "White" : "Black"} resigned.` });

/** How hard the Professor (the chess computer) thinks. The server replays at this depth to check a win. */
export const CHESS_CPU_DEPTH = 2;

// ── The computer: material plus a little for central, advanced pieces; alpha-beta a few plies deep. ──
const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function evaluate(board: string): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq]!;
    if (p === ".") continue;
    const kind = p.toLowerCase();
    const r = rowOf(sq);
    const c = colOf(sq);
    const centre = 3.5 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c));
    let v = VALUE[kind]! + (kind === "n" || kind === "b" ? centre * 8 : kind === "p" ? centre * 4 + (isWhite(p) ? 6 - r : r - 1) * 6 : 0);
    if (kind === "k") v -= centre * 6; // keep the king tucked away
    score += isWhite(p) ? v : -v;
  }
  return score;
}
function search(s: ChessState, depth: number, alpha: number, beta: number): number {
  const moves = chessMoves(s);
  if (!moves.length) return chessInCheck(s) ? -100_000 - depth : 0;
  if (depth === 0) return (s.turn === 0 ? 1 : -1) * evaluate(s.board);
  // Captures first: they cut the search down most.
  moves.sort((a, b) => (s.board[b.to] !== "." ? 1 : 0) - (s.board[a.to] !== "." ? 1 : 0));
  for (const m of moves) {
    const v = -search(apply(s, m), depth - 1, -beta, -alpha);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
/** The computer's move (`depth` 2 is a casual player; 3 plays a decent game). `rand` breaks ties. */
export function chessBest(s: ChessState, depth = 2, rand: () => number = Math.random): ChessMove {
  const moves = chessMoves(s);
  let best: ChessMove[] = [];
  let bestV = -Infinity;
  for (const m of moves) {
    const v = -search(apply(s, m), depth - 1, -Infinity, Infinity);
    if (v > bestV) {
      bestV = v;
      best = [m];
    } else if (v === bestV) best.push(m);
  }
  return best[Math.floor(rand() * best.length)]!;
}

export const CHESS_GLYPH: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

/** A position from FEN (for tests and puzzles): pieces, side to move, castling, en passant. */
export function chessFromFen(fen: string): ChessState {
  const [rows, side, castle, ep] = fen.split(" ");
  const board = rows!.split("/").map((r) => r.replace(/\d/g, (n) => ".".repeat(Number(n)))).join("");
  const epSq = ep && ep !== "-" ? (8 - Number(ep[1])) * 8 + "abcdefgh".indexOf(ep[0]!) : -1;
  return { ...chessStart(), board, turn: side === "b" ? 1 : 0, castle: castle === "-" ? "" : (castle ?? ""), ep: epSq, note: side === "b" ? "Black to move." : "White to move." };
}
