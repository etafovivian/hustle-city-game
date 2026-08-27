import { describe, expect, it } from "vitest";
import { chessBest, chessFromFen, chessMoves, chessPlay, chessStart, type ChessState } from "./chess.js";

const sq = (name: string) => (8 - Number(name[1])) * 8 + "abcdefgh".indexOf(name[0]!);
const play = (s: ChessState, ...moves: string[]) => moves.reduce((st, m) => chessPlay(st, { from: sq(m.slice(0, 2)), to: sq(m.slice(2, 4)), promo: (m[4] as "q") ?? undefined }), s);
const perft = (s: ChessState, d: number): number => (d === 0 ? 1 : chessMoves(s).reduce((n, m) => n + perft(chessPlay(s, m), d - 1), 0));

describe("chess", () => {
  it("generates the right number of positions from the start (perft)", () => {
    expect(perft(chessStart(), 1)).toBe(20);
    expect(perft(chessStart(), 2)).toBe(400);
    expect(perft(chessStart(), 3)).toBe(8902);
  });

  it("matches perft on a tricky position (castling, en passant, promotion)", () => {
    // "Kiwipete" (r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -).
    const s = chessFromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -");
    expect(perft(s, 1)).toBe(48);
    expect(perft(s, 2)).toBe(2039);
  });

  it("spots fool's mate and refuses illegal moves", () => {
    const s = play(chessStart(), "f2f3", "e7e5", "g2g4", "d8h4");
    expect(s).toMatchObject({ over: true, winner: 1, check: true });
    expect(() => play(chessStart(), "e2e5")).toThrow();
  });

  it("castles, takes en passant and promotes", () => {
    let s = play(chessStart(), "e2e4", "a7a6", "e4e5", "d7d5", "e5d6");
    expect(s.board[sq("d5")]).toBe(".");
    s = play(chessStart(), "g2g3", "a7a6", "g1f3", "a6a5", "f1g2", "a5a4", "e1g1");
    expect(s.board[sq("g1")]).toBe("K");
    expect(s.board[sq("f1")]).toBe("R");
    const promo = chessFromFen("k7/4P3/8/8/8/8/8/4K3 w - -");
    expect(chessPlay(promo, { from: sq("e7"), to: sq("e8"), promo: "n" }).board[sq("e8")]).toBe("N");
    expect(chessPlay(promo, { from: sq("e7"), to: sq("e8") }).board[sq("e8")]).toBe("Q");
    // Mate in one for the computer: it finds it.
    const mate = chessFromFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - -");
    expect(chessBest(mate, 2, () => 0)).toEqual({ from: sq("a1"), to: sq("a8") });
  });

  it("the computer takes a free queen", () => {
    const s = play(chessStart(), "e2e4", "d7d5", "d1h5", "a7a6", "h5d5");
    const reply = play(chessStart(), "e2e4", "d7d5", "d1g4");
    const m = chessBest(reply, 2, () => 0);
    expect(m.to).toBe(sq("g4"));
    expect(s.board[sq("d5")]).toBe("Q");
  });
});
