// Game tables inside a place (the snooker spot, the library, the hotel lobby…): sit at a table and wait for anyone
// here to join, sit down at someone's table, challenge a player who's here, watch a game, or practise against the
// computer. The game plays right here in the place's card, not on the phone.
import { TABLE_GAMES, type PresencePlayer, type TableGame } from "@hc/shared";
import { Bot, Eye, LogOut, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { ChessLive, ChessVsComputer } from "./Chess.js";
import { AyoLive, AyoVsComputer } from "./Games.js";
import { Snooker } from "./Snooker.js";

interface TableRow {
  id: string;
  game: TableGame;
  names: [string, string | null];
  waiting: boolean;
  mine: boolean;
}
type Active = { game: TableGame; id: string; mine: boolean } | { game: TableGame; cpu: true };

export function GameTables({
  place,
  games,
  here,
  notify,
  onChanged,
  onSeated,
}: {
  /** The place's key (a branch has its own tables). */
  place: string;
  games: TableGame[];
  /** Other players at this place now. */
  here: PresencePlayer[];
  notify: (m: string) => void;
  onChanged: () => void;
  /** You sat down at (true) or left (false) a table: your character sits in the room. */
  onSeated: (seated: boolean) => void;
}) {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the tables fresh; when someone sits at your table (or accepts your challenge), the game opens.
  useEffect(() => {
    let stop = false;
    const load = () =>
      api<TableRow[]>("GET", `/api/games/at/${encodeURIComponent(place)}`)
        .then((r) => {
          if (stop) return;
          setRows(r);
          const started = r.find((t) => t.mine && !t.waiting);
          setActive((a) => a ?? (started ? { game: started.game, id: started.id, mine: true } : null));
        })
        .catch(() => undefined);
    void load();
    const t = window.setInterval(() => void load(), 2500);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [place]);
  useEffect(() => onSeated(active !== null || rows.some((r) => r.mine)), [active, rows.some((r) => r.mine)]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const sit = (game: TableGame) =>
    run(async () => {
      const t = await api<{ id: string }>("POST", `/api/games/${game}/open`, { place });
      setRows((r) => [...r.filter((x) => !(x.mine && x.waiting)), { id: t.id, game, names: ["you", null], waiting: true, mine: true }]);
      notify(`You sat at ${TABLE_GAMES[game].seat}. Anyone here can join you.`);
    });
  const join = (t: TableRow) =>
    run(async () => {
      await api("POST", `/api/games/table/${t.id}/join`);
      setActive({ game: t.game, id: t.id, mine: true });
    });
  const challenge = (nick: string, game: TableGame) =>
    run(async () => {
      const t = await api<{ id: string }>("POST", `/api/games/${game}/challenge`, { to: nick, place });
      notify(`Challenged @${nick} to ${TABLE_GAMES[game].label.toLowerCase()}`);
      setActive({ game, id: t.id, mine: true });
    });
  const leave = (id: string) =>
    run(async () => {
      await api("POST", `/api/games/table/${id}/leave`);
      setRows((r) => r.filter((x) => x.id !== id));
      setActive(null);
    });

  if (active) {
    const live = "id" in active;
    return (
      <div className="tables-box">
        <div className="row spread">
          <strong className="small">
            {TABLE_GAMES[active.game].icon} {TABLE_GAMES[active.game].label}
            {"cpu" in active ? " · practice" : live && !active.mine ? " · watching" : ""}
          </strong>
          <button
            type="button"
            className="btn sm quiet"
            disabled={busy}
            onClick={() => {
              if (live && active.mine) {
                if (window.confirm("Leave the table? If the game is still going, you give it up.")) void leave(active.id);
              } else setActive(null);
            }}
          >
            <LogOut size={14} aria-hidden="true" /> {live && active.mine ? "Leave table" : "Back"}
          </button>
        </div>
        {"cpu" in active ? (
          active.game === "chess" ? (
            <ChessVsComputer notify={notify} onChanged={onChanged} />
          ) : active.game === "ayo" ? (
            <AyoVsComputer notify={notify} onChanged={onChanged} />
          ) : (
            <Snooker notify={notify} />
          )
        ) : active.game === "chess" ? (
          <ChessLive id={active.id} />
        ) : active.game === "ayo" ? (
          <AyoLive id={active.id} />
        ) : (
          <Snooker id={active.id} notify={notify} />
        )}
      </div>
    );
  }

  const myWait = rows.find((r) => r.mine && r.waiting);
  const others = rows.filter((r) => !r.mine);
  return (
    <div className="tables-box">
      <strong className="small">🎲 Tables here</strong>
      {myWait && (
        <div className="table-row waiting">
          <span className="small">
            {TABLE_GAMES[myWait.game].icon} You're at {TABLE_GAMES[myWait.game].seat}, waiting for someone to sit down…
          </span>
          <button type="button" className="btn sm quiet" disabled={busy} onClick={() => void leave(myWait.id)}>
            Get up
          </button>
        </div>
      )}
      {others.map((t) => (
        <div key={t.id} className="table-row">
          <span className="small">
            {TABLE_GAMES[t.game].icon} {t.waiting ? `@${t.names[0]} is waiting for a ${TABLE_GAMES[t.game].label.toLowerCase()} partner` : `@${t.names[0]} vs @${t.names[1]}`}
          </span>
          {t.waiting ? (
            <button type="button" className="btn sm go" disabled={busy} onClick={() => void join(t)}>
              <Users size={14} aria-hidden="true" /> Sit and play
            </button>
          ) : (
            <button type="button" className="btn sm" onClick={() => setActive({ game: t.game, id: t.id, mine: false })}>
              <Eye size={14} aria-hidden="true" /> Watch
            </button>
          )}
        </div>
      ))}
      <ul className="table-games">
        {games.map((g) => (
          <li key={g} className="table-row">
            <span className="small">
              {TABLE_GAMES[g].icon} <b>{TABLE_GAMES[g].label}</b>
            </span>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="btn sm go" disabled={busy || !!myWait} onClick={() => void sit(g)}>
                Sit and wait
              </button>
              <button type="button" className="btn sm quiet" onClick={() => setActive({ game: g, cpu: true })}>
                <Bot size={14} aria-hidden="true" /> {g === "snooker" ? "Practise" : "Vs computer"}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {here.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny muted">Challenge someone here:</span>
          {here.map((p) => (
            <div key={p.nickname} className="table-row">
              <span className="small">@{p.nickname}</span>
              <span className="row" style={{ gap: 4 }}>
                {games.map((g) => (
                  <button key={g} type="button" className="btn sm" disabled={busy} onClick={() => void challenge(p.nickname, g)} aria-label={`Challenge @${p.nickname} to ${TABLE_GAMES[g].label}`} title={TABLE_GAMES[g].label}>
                    {TABLE_GAMES[g].icon}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
