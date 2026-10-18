// Phone → Games: Ayo against the computer or a friend (live), and snooker (see Snooker.tsx).
import { AYO_WIN, AYO_WINS_PER_DAY, ayoBest, ayoFindMove, ayoPlay, ayoStart, type AyoState, type TableGame } from "@hc/shared";
import { ArrowLeft, Bot, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { AyoBoard, useAyoPlayback } from "./AyoBoard.js";
import { ChessLive, ChessVsComputer } from "./Chess.js";
import { Snooker } from "./Snooker.js";

const status = (s: AyoState, me: 0 | 1, names: [string, string]) =>
  s.over ? (s.winner === null ? "Draw!" : s.winner === me ? "You won! 🎉" : `${names[s.winner]} won.`) : s.turn === me ? "Your turn: tap one of your pits." : `Waiting for ${names[s.turn]}…`;

export function AyoVsComputer({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const [s, setS] = useState(ayoStart);
  const pb = useAyoPlayback(s);
  const moves = useRef<number[]>([]);
  const [done, setDone] = useState(false);
  const move = async (from: AyoState, p: number) => {
    const next = ayoPlay(from, p);
    await pb.play(from, p, next);
    setS(next);
  };
  const pick = (p: number) => {
    if (pb.busy.current || s.turn !== 0) return;
    moves.current.push(p);
    void move(s, p);
  };
  // The computer thinks for a beat, then sows its move the same way (the server replays the same moves).
  useEffect(() => {
    if (s.over || s.turn !== 1) return;
    const t = window.setTimeout(() => void move(s, ayoBest(s, 3)), 650);
    return () => window.clearTimeout(t);
  }, [s]);
  useEffect(() => {
    if (!s.over || done) return;
    setDone(true);
    if (s.winner === 0)
      void api<{ message: string }>("POST", "/api/games/ayo/win", { moves: moves.current })
        .then((r) => {
          notify(r.message);
          onChanged();
        })
        .catch(() => undefined);
  }, [s.over]);
  return (
    <div className="stack">
      <AyoBoard s={s} pb={pb} me={0} onPick={pick} names={["You", "Baba Ayo"]} />
      <p className="small ayo-status">{status(s, 0, ["You", "Baba Ayo"])}</p>
      {s.over && (
        <button
          type="button"
          className="btn go"
          onClick={() => {
            moves.current = [];
            setDone(false);
            const fresh = ayoStart();
            pb.show(fresh);
            setS(fresh);
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
  state: AyoState;
  you: 0 | 1 | null;
  waiting: boolean;
}

export function AyoLive({ id }: { id: string }) {
  const [g, setG] = useState<LiveView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownState = useRef<AyoState | null>(null);
  const pb = useAyoPlayback(ayoStart());
  /** Move the board to a new state: sow the move seed by seed when we can tell which pit it was. */
  const follow = async (next: LiveView) => {
    const prev = shownState.current;
    shownState.current = next.state;
    const m = prev && !prev.over ? ayoFindMove(prev, next.state) : null;
    if (prev && m !== null) await pb.play(prev, m, next.state);
    else pb.show(next.state);
    setG(next);
  };
  useEffect(() => {
    const load = () => {
      if (pb.busy.current) return;
      api<LiveView>("GET", `/api/games/ayo/${id}`)
        .then((v) => {
          if (pb.busy.current) return;
          const cur = shownState.current;
          if (!cur || JSON.stringify(cur) !== JSON.stringify(v.state)) void follow(v);
          else setG(v);
        })
        .catch((e: Error) => setError(e.message));
    };
    load();
    const t = window.setInterval(load, 1500);
    return () => window.clearInterval(t);
  }, [id]);
  if (error) return <p className="alert small">{error}</p>;
  if (!g) return <p className="small muted">Loading the board…</p>;
  const pick = async (p: number) => {
    if (pb.busy.current) return;
    try {
      void follow(await api<LiveView>("POST", `/api/games/ayo/${id}/move`, { pit: p }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const names = g.names.map((n) => (n ? `@${n}` : "…")) as [string, string];
  return (
    <div className="stack">
      <AyoBoard s={g.state} pb={pb} me={g.you ?? 0} watching={g.you === null} onPick={(p) => void pick(p)} names={names} />
      <p className="small ayo-status">{g.waiting ? "Waiting for someone to sit down…" : g.you === null ? (g.state.over ? (g.state.winner === null ? "Draw!" : `${names[g.state.winner]} won.`) : `Watching: ${names[g.state.turn]} to play.`) : status(g.state, g.you, names)}</p>
    </div>
  );
}

export type GameOpen = { game: TableGame; id?: string } | null;

export function GamesApp({ notify, onChanged, open: initial }: { notify: (m: string) => void; onChanged: () => void; open?: GameOpen }) {
  const [open, setOpen] = useState<GameOpen | "ayo-cpu" | "chess-cpu" | "snooker-solo">(initial ?? null);
  const [friend, setFriend] = useState("");
  const challenge = async (game: TableGame) => {
    try {
      const r = await api<{ id: string }>("POST", `/api/games/${game}/challenge`, { to: friend.trim().replace(/^@/, "") });
      notify(`Challenge sent to @${friend.trim().replace(/^@/, "")}`);
      setOpen({ game, id: r.id });
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const back = (
    <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} onClick={() => setOpen(null)}>
      <ArrowLeft size={15} aria-hidden="true" /> Games
    </button>
  );
  if (open === "ayo-cpu")
    return (
      <div className="stack account-form">
        {back}
        <AyoVsComputer notify={notify} onChanged={onChanged} />
      </div>
    );
  if (open === "chess-cpu")
    return (
      <div className="stack account-form">
        {back}
        <ChessVsComputer notify={notify} onChanged={onChanged} />
      </div>
    );
  if (open === "snooker-solo")
    return (
      <div className="stack account-form">
        {back}
        <Snooker notify={notify} />
      </div>
    );
  if (open && typeof open === "object" && open.id)
    return (
      <div className="stack account-form">
        {back}
        {open.game === "ayo" ? <AyoLive id={open.id} /> : open.game === "chess" ? <ChessLive id={open.id} /> : <Snooker id={open.id} notify={notify} />}
      </div>
    );
  const friendForm = (game: TableGame) => (
    <form
      className="chat-compose"
      onSubmit={(e) => {
        e.preventDefault();
        void challenge(game);
      }}
    >
      <input className="input" value={friend} onChange={(e) => setFriend(e.target.value)} placeholder="Friend's @name (they must be online)" aria-label="Friend's name" />
      <button type="submit" className="btn sm go" disabled={!friend.trim()}>
        <Users size={15} aria-hidden="true" /> Challenge
      </button>
    </form>
  );
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>Games</h2>
        <p className="small muted">Play the computer or challenge a friend who's online.</p>
      </div>
      <div className="quote-card">
        <strong>🌰 Ayo</strong>
        <span className="tiny muted">The Yoruba seed game. Capture 2s and 3s; first past 24 seeds wins. Beat the computer for +{AYO_WIN.coins} coins (up to {AYO_WINS_PER_DAY} wins a day).</span>
        <div className="row">
          <button type="button" className="btn sm go" onClick={() => setOpen("ayo-cpu")}>
            <Bot size={15} aria-hidden="true" /> Play the computer
          </button>
        </div>
        {friendForm("ayo")}
      </div>
      <div className="quote-card">
        <strong>♟️ Chess</strong>
        <span className="tiny muted">Play the Professor for +{AYO_WIN.coins} coins a win (up to {AYO_WINS_PER_DAY} a day), or challenge a friend. Tables at the snooker spot, the library and the hotel lobby too.</span>
        <div className="row">
          <button type="button" className="btn sm go" onClick={() => setOpen("chess-cpu")}>
            <Bot size={15} aria-hidden="true" /> Play the Professor
          </button>
        </div>
        {friendForm("chess")}
      </div>
      <div className="quote-card">
        <strong>🎱 Snooker</strong>
        <span className="tiny muted">Aim, set your power, shoot. Pot all your balls, then the black.</span>
        <div className="row">
          <button type="button" className="btn sm go" onClick={() => setOpen("snooker-solo")}>
            Practise alone
          </button>
        </div>
        {friendForm("snooker")}
      </div>
    </div>
  );
}
