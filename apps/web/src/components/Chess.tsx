// Chess: the board (tap a piece, then where it goes), a game against the Professor (the computer), and live games
// with another player or watched from the side. The rules live in @hc/shared (chess.ts) and the server checks them.
import { CHESS_CPU_DEPTH, chessBest, chessMoves, chessPlay, chessStart, type ChessMove, type ChessPromo, type ChessState } from "@hc/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// Solid glyphs for both sides (coloured by CSS); U+FE0E keeps phones from drawing the pawn as an emoji.
const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const PROMOS: ChessPromo[] = ["q", "r", "b", "n"];

export function ChessBoard({ s, me, onMove }: { s: ChessState; me: 0 | 1 | null; onMove: (m: ChessMove) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const mine = me !== null && s.turn === me && !s.over;
  const legal = mine ? chessMoves(s) : [];
  const targets = sel === null ? [] : legal.filter((m) => m.from === sel).map((m) => m.to);
  useEffect(() => setSel(null), [s.board]);
  // Your side at the bottom (watchers see White's side).
  const order = Array.from({ length: 64 }, (_, i) => (me === 1 ? 63 - i : i));
  const kingInCheck = s.check ? s.board.indexOf(s.turn === 0 ? "K" : "k") : -1;
  const tap = (sq: number) => {
    if (!mine) return;
    if (targets.includes(sq)) {
      const options = legal.filter((m) => m.from === sel && m.to === sq);
      if (options.some((m) => m.promo)) setPromo({ from: sel!, to: sq });
      else onMove({ from: sel!, to: sq });
      setSel(null);
      return;
    }
    const p = s.board[sq]!;
    setSel(p !== "." && (p === p.toUpperCase()) === (me === 0) && legal.some((m) => m.from === sq) ? sq : null);
  };
  return (
    <div className="chess-wrap">
      <div className="chess-board" role="grid" aria-label="Chess board">
        {order.map((sq) => {
          const p = s.board[sq]!;
          const dark = ((sq >> 3) + (sq & 7)) % 2 === 1;
          const cls = ["chess-sq", dark ? "dark" : "light", sel === sq ? "sel" : "", targets.includes(sq) ? (p === "." ? "dot" : "hit") : "", s.last && (s.last.from === sq || s.last.to === sq) ? "last" : "", kingInCheck === sq ? "check" : ""].join(" ");
          return (
            <button key={sq} type="button" className={cls} onClick={() => tap(sq)} aria-label={`${"abcdefgh"[sq & 7]}${8 - (sq >> 3)}${p === "." ? "" : ` ${p === p.toUpperCase() ? "white" : "black"} ${p.toLowerCase()}`}`}>
              {p !== "." && <span className={`chess-pc ${p === p.toUpperCase() ? "w" : "b"}`}>{GLYPH[p.toLowerCase()]}{"︎"}</span>}
            </button>
          );
        })}
      </div>
      {promo && (
        <div className="chess-promo" role="dialog" aria-label="Promote your pawn to">
          <span className="small">Promote to:</span>
          {PROMOS.map((k) => (
            <button
              key={k}
              type="button"
              className="btn sm"
              onClick={() => {
                onMove({ ...promo, promo: k });
                setPromo(null);
              }}
            >
              <span className={`chess-pc ${me === 0 ? "w" : "b"}`}>{GLYPH[k]}{"︎"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const status = (s: ChessState, me: 0 | 1 | null, names: [string, string]) => {
  if (s.over) return s.winner === null ? s.note : me !== null && s.winner === me ? `You win! 🎉 ${s.note}` : s.note.replace(/\b(White|Black)\b/g, (w) => names[w === "White" ? 0 : 1]!);
  const who = names[s.turn];
  return `${s.check ? "Check! " : ""}${me === null ? `${who} to move.` : s.turn === me ? "Your move: tap a piece, then where it goes." : `Waiting for ${who}…`}`;
};

/** Play the Professor. A win is checked by the server (it replays the game) and rewarded a few times a day. */
export function ChessVsComputer({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const [s, setS] = useState(chessStart);
  const moves = useRef<ChessMove[]>([]);
  const [done, setDone] = useState(false);
  const play = (m: ChessMove) => {
    moves.current.push(m);
    setS((st) => chessPlay(st, m));
  };
  useEffect(() => {
    if (s.over || s.turn !== 1) return;
    const t = window.setTimeout(() => play(chessBest(s, CHESS_CPU_DEPTH, () => 0)), 450);
    return () => window.clearTimeout(t);
  }, [s]);
  useEffect(() => {
    if (!s.over || done) return;
    setDone(true);
    if (s.winner === 0)
      void api<{ message: string }>("POST", "/api/games/chess/win", { moves: moves.current })
        .then((r) => {
          notify(r.message);
          onChanged();
        })
        .catch(() => undefined);
  }, [s.over]);
  return (
    <div className="stack">
      <ChessBoard s={s} me={0} onMove={play} />
      <p className="small">{status(s, 0, ["You", "The Professor"])}</p>
      {s.over && (
        <button
          type="button"
          className="btn go"
          onClick={() => {
            moves.current = [];
            setDone(false);
            setS(chessStart());
          }}
        >
          Play again
        </button>
      )}
    </div>
  );
}

interface LiveView {
  id: string;
  names: [string, string | null];
  state: ChessState;
  you: 0 | 1 | null;
  waiting: boolean;
}

/** A live game: yours (you move on your turn) or someone else's (you watch). */
export function ChessLive({ id }: { id: string }) {
  const [g, setG] = useState<LiveView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () =>
      api<LiveView>("GET", `/api/games/chess/${id}`)
        .then(setG)
        .catch((e: Error) => setError(e.message));
    void load();
    const t = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(t);
  }, [id]);
  if (error) return <p className="alert small">{error}</p>;
  if (!g) return <p className="small muted">Setting up the board…</p>;
  const names: [string, string] = [`@${g.names[0]}`, g.names[1] ? `@${g.names[1]}` : "…"];
  const move = async (m: ChessMove) => {
    try {
      setG(await api<LiveView>("POST", `/api/games/chess/${id}/move`, m));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="stack">
      <p className="small">
        <b>♔ {names[0]}</b> (White) vs <b>♚ {names[1]}</b> (Black){g.you === null ? " · watching" : ""}
      </p>
      <ChessBoard s={g.state} me={g.you} onMove={(m) => void move(m)} />
      <p className="small">{g.waiting ? "Waiting for someone to sit down…" : status(g.state, g.you, names)}</p>
    </div>
  );
}
