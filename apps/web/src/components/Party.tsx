// House parties (see @hc/shared party.ts): throw one from your house; join a friend's when you visit; see who's
// partying in Phone → Events. While one is on, the house fills with people dancing.
import { PARTIES, PARTY_BY_KEY, lookFromSeed, type PartiesView, type PartyView } from "@hc/shared";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";
import { music, musicState } from "../music.js";
import { variantFor } from "./AvatarWalker.js";
import { FOR_SALE, kerbsideOf } from "./cityLayout.js";
import type { Room } from "./rooms.js";

const minutesLeft = (p: PartyView) => Math.max(0, Math.ceil((Date.parse(p.endsAt) - Date.now()) / 60_000));

export function useParties(): [PartiesView | null, () => void] {
  const [view, setView] = useState<PartiesView | null>(null);
  const load = () =>
    void api<PartiesView>("GET", "/api/parties")
      .then(setView)
      .catch(() => setView(null));
  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, []);
  return [view, load];
}

/** People dancing in a room while a party is on (not in bedrooms): their own looks, the nearest everyday one as the fallback. */
export function withParty(room: Room | undefined, roomKey: string, party: { crowd: number; seed: number } | null): Room | undefined {
  if (!room || !party || /bed|suite/.test(roomKey) || room.walkway.length < 2) return room;
  const walk = room.walkway;
  const dancers = Array.from({ length: party.crowd }, (_, i) => {
    const look = lookFromSeed(party.seed * 13 + i * 101);
    const at = walk[Math.round(((i + 0.5) / party.crowd) * (walk.length - 1))]!;
    return { action: "dance" as const, at: [at[0] + ((i % 3) - 1) * 0.03, at[1] + ((i % 2) - 0.5) * 0.04] as [number, number], dir: (i % 2 ? "sw" : "se") as "sw" | "se", variant: variantFor(look), look, phase: i };
  });
  return { ...room, stations: [...room.stations, ...dancers] };
}

/** In your own house: throw a party, or how yours is going. */
export function PartyPanel({ design, view, reload, notify, onChanged }: { design: string | null; view: PartiesView | null; reload: () => void; notify: (m: string) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!view) return null;
  if (view.mine) {
    const k = PARTY_BY_KEY.get(view.mine.size)!;
    return (
      <div className="party-box on">
        <strong className="small">
          {k.icon} Your {k.label.toLowerCase()} is on!
        </strong>
        <span className="tiny muted">
          {minutesLeft(view.mine)} min left · {view.mine.guests ? `${view.mine.guests} friend${view.mine.guests === 1 ? "" : "s"} came` : "Your contacts got an invite"}
        </span>
        {!musicState().playing && (
          <button type="button" className="btn sm" style={{ justifySelf: "start" }} onClick={() => music.play("afro")}>
            🎵 Put the music on
          </button>
        )}
      </div>
    );
  }
  const throwIt = async (size: string) => {
    setBusy(true);
    try {
      // The music starts with the party (this tap allows sound).
      if (!musicState().playing) music.play(size === "gist" ? "highlife" : "afro");
      await api("POST", "/api/parties", { size });
      const k = PARTY_BY_KEY.get(size)!;
      notify(`${k.icon} Party time! Your contacts got an invite. +Social +Fun +${k.xp} XP`);
      onChanged();
      reload();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="party-box">
      <strong className="small">🎉 Throw a party</strong>
      {view.canThrow.ok ? (
        <>
          <span className="tiny muted">For an hour your house fills up and your contacts get an invite. Friends who come get Social and Fun; you get XP for each.</span>
          <div className="party-kinds">
            {PARTIES.map((k) => {
              const small = !!k.houses && !k.houses.includes(design ?? "");
              return (
                <button key={k.key} type="button" className="btn sm" disabled={busy || small} onClick={() => void throwIt(k.key)} title={k.note}>
                  {k.icon} {k.label} · {formatCoins(k.cost)}
                  <span className="tiny muted">{small ? " · needs a bigger house" : ` · ${k.note}`}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <span className="tiny muted">{view.canThrow.why}</span>
      )}
    </div>
  );
}

/** At a friend's house: their party, and "Join the party". */
export function JoinParty({ party, notify, onChanged, reload }: { party: PartyView; notify: (m: string) => void; onChanged: () => void; reload: () => void }) {
  const k = PARTY_BY_KEY.get(party.size)!;
  const join = async () => {
    try {
      if (!musicState().playing) music.play("afro");
      const r = await api<{ joined: boolean }>("POST", `/api/parties/${party.id}/join`);
      notify(r.joined ? `${k.icon} You joined @${party.host}'s party! +Social +Fun +XP` : "You're already at this party. Enjoy!");
      onChanged();
      reload();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <div className="party-box on">
      <strong className="small">
        {k.icon} @{party.host}'s {k.label.toLowerCase()} is on! · {minutesLeft(party)} min left
      </strong>
      {party.joined ? (
        <span className="tiny muted">You're in. Dance, eat, gist.</span>
      ) : (
        <button type="button" className="btn sm go" style={{ justifySelf: "start" }} onClick={() => void join()}>
          🎉 Join the party
        </button>
      )}
    </div>
  );
}

/** Phone → Events: your friends' parties going on now, with a way to get there. */
export function PartiesNow({ onClose }: { onClose: () => void }) {
  const [view] = useParties();
  if (!view || (!view.friends.length && !view.mine)) return null;
  const goTo = (p: PartyView) => {
    const plot = FOR_SALE.find((x) => x.id === p.plotId);
    if (!plot) return;
    const k = kerbsideOf({ x: plot.x, y: plot.y });
    onClose();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("hc:go-to", { detail: { x: k.x, y: k.y, label: `@${p.host}'s party`, place: null } })), 50);
  };
  return (
    <div className="stack" style={{ gap: 6 }}>
      <h3 className="small">🎉 House parties now</h3>
      {view.mine && <span className="tiny muted">Yours is on: {minutesLeft(view.mine)} min left.</span>}
      {view.friends.map((p) => (
        <div key={p.id} className="party-box on">
          <strong className="small">
            {PARTY_BY_KEY.get(p.size)!.icon} @{p.host}'s {PARTY_BY_KEY.get(p.size)!.label.toLowerCase()}
            {p.area ? ` · ${p.area}` : ""}
          </strong>
          <span className="tiny muted">
            {minutesLeft(p)} min left · {p.guests} there{p.joined ? " · you came" : ""}
          </span>
          <button type="button" className="btn sm go" style={{ justifySelf: "start" }} onClick={() => goTo(p)}>
            Go there
          </button>
          <span className="tiny muted">When you arrive, tap their house and Visit, then Join the party.</span>
        </div>
      ))}
    </div>
  );
}
