// Phone → Games: Ayo against the computer or a friend (live), and snooker (see Snooker.tsx).
import { AYO_WIN, AYO_WINS_PER_DAY, ayoBest, ayoMoves, ayoPlay, ayoStart, type AyoState } from "@hc/shared";
import { ArrowLeft, Bot, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Snooker } from "./Snooker.js";

/** The board: player 1's row on top (right to left), player 0's below (left to right), stores at the sides. */
function AyoBoard({ s, me, onPick, names }: { s: AyoState; me: 0 | 1; onPick: (pit: number) => void; names: [string, string] }) {
  const legal = s.turn === me && !s.over ? ayoMoves(s) : [];
  // Show your own row at the bottom.
  const bottom = me === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];
  const top = me === 0 ? [11, 10, 9, 8, 7, 6] : [5, 4, 3, 2, 1, 0];
  const pit = (i: number) => (
    <button key={i} type="button" className={`ayo-pit ${legal.includes(i) ? "legal" : ""}`} disabled={!legal.includes(i)} onClick={() => onPick(i)} aria-label={`Pit with ${s.pits[i]} seeds`}>
      <span className="ayo-seeds" aria-hidden="true">
        {Array.from({ length: Math.min(s.pits[i]!, 12) }, (_, k) => (
          <i key={k} />
        ))}
      </span>
      <b>{s.pits[i]}</b>
    </button>
  );
  const other = me === 0 ? 1 : 0;
  return (
    <div className="ayo">
      <div className="ayo-store">
        <span className="tiny">{names[other]}</span>
        <b>{s.stores[other]}</b>
      </div>
      <div className="ayo-rows">
        <div className="ayo-row">{top.map(pit)}</div>
        <div className="ayo-row">{bottom.map(pit)}</div>
      </div>
      <div className="ayo-store mine">
        <span className="tiny">{names[me]}</span>
        <b>{s.stores[me]}</b>
      </div>
    </div>
  );
}

const status = (s: AyoState, me: 0 | 1, names: [string, string]) =>
  s.over ? (s.winner === null ? "Draw!" : s.winner === me ? "You won! 🎉" : `@${names[s.winner]} won.`) : s.turn === me ? "Your turn: tap one of your pits." : `Waiting for ${names[s.turn]}…`;

function AyoVsComputer({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const [s, setS] = useState(ayoStart);
  const moves = useRef<number[]>([]);
  const [done, setDone] = useState(false);
  const pick = (p: number) => {
    moves.current.push(p);
    setS(ayoPlay(s, p));
  };
  // The computer replies after a beat (same moves the server replays).
  useEffect(() => {
    if (s.over || s.turn !== 1) return;
    const t = window.setTimeout(() => setS(ayoPlay(s, ayoBest(s, 3))), 700);
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
      <AyoBoard s={s} me={0} onPick={pick} names={["You", "Baba Ayo (computer)"]} />
      <p className="small">{status(s, 0, ["You", "Baba Ayo"])}</p>
      {s.over && (
        <button
          type="button"
          className="btn go"
          onClick={() => {
            moves.current = [];
            setDone(false);
            setS(ayoStart());
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
  names: [string, string];
  state: AyoState;
  you: 0 | 1;
}

export function AyoLive({ id }: { id: string }) {
  const [g, setG] = useState<LiveView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () =>
      api<LiveView>("GET", `/api/games/ayo/${id}`)
        .then(setG)
        .catch((e: Error) => setError(e.message));
    void load();
    const t = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(t);
  }, [id]);
  if (error) return <p className="alert small">{error}</p>;
  if (!g) return <p className="small muted">Loading the board…</p>;
  const pick = async (p: number) => {
    try {
      setG(await api<LiveView>("POST", `/api/games/ayo/${id}/move`, { pit: p }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="stack">
      <AyoBoard s={g.state} me={g.you} onPick={(p) => void pick(p)} names={g.names.map((n) => `@${n}`) as [string, string]} />
      <p className="small">{status(g.state, g.you, g.names)}</p>
    </div>
  );
}

export type GameOpen = { game: "ayo" | "snooker"; id?: string } | null;

export function GamesApp({ notify, onChanged, open: initial }: { notify: (m: string) => void; onChanged: () => void; open?: GameOpen }) {
  const [open, setOpen] = useState<GameOpen | "ayo-cpu" | "ayo-friend" | "snooker-friend" | "snooker-solo">(initial ?? null);
  const [friend, setFriend] = useState("");
  const challenge = async (game: "ayo" | "snooker") => {
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
        {open.game === "ayo" ? <AyoLive id={open.id} /> : <Snooker id={open.id} notify={notify} />}
      </div>
    );
  const friendForm = (game: "ayo" | "snooker") => (
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
