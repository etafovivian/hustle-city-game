// Phone → Love: who you'd like to meet, the people you know (closeness, what's next) and what you can do together:
// chat (they bring something up, you answer), a gift, a date, then the big steps. "People here" shows in a place's
// card: who hangs out there, and "Say hi".
import {
  DATE_SPOTS,
  GIFTS,
  NEED,
  NPCS,
  NPC_BY_KEY,
  PARTNER_PREFS,
  PARTNER_PREF_LABEL,
  STAGE_LABEL,
  VENUES_BY_KEY,
  WEDDING,
  npcsAt,
  type BondView,
  type LoveView,
  type Npc,
  type PartnerPref,
} from "@hc/shared";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";
import { Avatar } from "./Avatar.js";
import { variantFor } from "./AvatarWalker.js";
import type { Room } from "./rooms.js";
import { WEDDING_VENUE, startDate } from "./Dates.js";
import { music, musicState } from "../music.js";

const placeName = (v: string) => VENUES_BY_KEY.get(v)?.name ?? v;

/** What to do next with someone, in plain words. */
function nextHint(b: BondView, npc: Npc, partner: string | null): string {
  if (b.stage === "met") return `Chat and maybe a small gift. Friends at ${NEED.friends}.`;
  if (b.stage === "friends") return partner && partner !== b.npc ? "Good friends." : b.closeness >= NEED.askOut ? `${npc.name} would say yes. Ask them out!` : `Dates help. You can ask ${npc.name} out at ${NEED.askOut}.`;
  if (b.stage === "dating") return b.can.moveIn ? "Ready to move in together." : b.closeness >= NEED.moveIn ? "Get your own flat or house to move in together." : `Keep dating. Move in together at ${NEED.moveIn}.`;
  if (b.stage === "living") return b.can.propose ? "Time to propose? 💍" : `Living together. Propose at ${NEED.propose}.`;
  if (b.stage === "engaged") return `Plan the owambe: ${formatCoins(WEDDING.cost)} coins.`;
  return "Married. Come home to each other. 💞";
}

function Closeness({ value }: { value: number }) {
  return (
    <span className="love-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Closeness">
      <span style={{ width: `${value}%` }} />
    </span>
  );
}

function BondCard({ b, partner, notify, onView, onChanged, onGo }: { b: BondView; partner: string | null; notify: (m: string) => void; onView: (v: LoveView) => void; onChanged: () => void; onGo: (venue: string) => void }) {
  const npc = NPC_BY_KEY.get(b.npc)!;
  const [open, setOpen] = useState<null | "chat" | "gift" | "date">(null);
  const [busy, setBusy] = useState(false);
  const call = async <T,>(path: string, body: unknown, done: (r: T) => void) => {
    setBusy(true);
    try {
      done(await api<T>("POST", `/api/love/${b.npc}/${path}`, body));
      onChanged();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  type Gained = { gained: number; love: LoveView };
  return (
    <div className={`love-card ${partner === b.npc ? "partner" : ""}`}>
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <Avatar avatar={npc.avatar} size={48} />
        <div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <strong>
            {npc.name}, {npc.age} <span className="love-stage">{STAGE_LABEL[b.stage]}</span>
          </strong>
          <span className="tiny muted">{npc.job}</span>
          <Closeness value={b.closeness} />
        </div>
      </div>
      <span className="tiny muted">{nextHint(b, npc, partner)}</span>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="btn sm" aria-pressed={open === "chat"} onClick={() => setOpen(open === "chat" ? null : "chat")}>
          💬 Chat
        </button>
        <button type="button" className="btn sm" aria-pressed={open === "gift"} disabled={b.giftToday} onClick={() => setOpen(open === "gift" ? null : "gift")}>
          🎁 {b.giftToday ? "Gift given today" : "Gift"}
        </button>
        {b.stage !== "met" && (
          <button type="button" className="btn sm" aria-pressed={open === "date"} onClick={() => setOpen(open === "date" ? null : "date")}>
            🌹 Date
          </button>
        )}
        {b.can.askOut && (
          <button type="button" className="btn sm go" disabled={busy} onClick={() => void call<LoveView>("ask-out", {}, (v) => (onView(v), notify(`${npc.name} said yes! You're dating now. 💕`)))}>
            💕 Ask out
          </button>
        )}
        {b.can.moveIn && (
          <button type="button" className="btn sm go" disabled={busy} onClick={() => void call<LoveView>("move-in", {}, (v) => (onView(v), notify(`${npc.name} moved in with you. Home feels warmer.`)))}>
            🏠 Move in together
          </button>
        )}
        {b.can.propose && (
          <button type="button" className="btn sm go" disabled={busy} onClick={() => void call<LoveView>("propose", {}, (v) => (onView(v), notify(`${npc.name} said YES! 💍 Now plan the owambe.`)))}>
            💍 Propose
          </button>
        )}
        {b.can.wedding && (
          <button type="button" className="btn sm gold" disabled={busy} onClick={() => void call<LoveView>("wedding", {}, (v) => {
                onView(v);
                notify(`Owambe! You and ${npc.name} are married. 🎉 +${WEDDING.xp} XP`);
                // The owambe itself: the event centre, the two of you, everyone dancing.
                if (!musicState().playing) music.play("highlife");
                startDate(b.npc, WEDDING_VENUE, "the event centre", true);
                onGo(WEDDING_VENUE);
              })}>
            🎉 Owambe wedding · {formatCoins(WEDDING.cost)}
          </button>
        )}
        {partner === b.npc && (
          <button
            type="button"
            className="btn sm quiet"
            disabled={busy}
            onClick={() => window.confirm(`Break up with ${npc.name}? You'll stay friends, but much less close.`) && void call<LoveView>("break-up", {}, (v) => (onView(v), notify(`You and ${npc.name} broke up.`)))}
          >
            Break up
          </button>
        )}
      </div>
      {open === "chat" && (
        <div className="love-chat">
          <p className="small">
            <strong>{npc.name}:</strong> “{b.prompt.say}”
          </p>
          {b.prompt.answers.map((a, i) => (
            <button
              key={a.text}
              type="button"
              className="btn sm quiet love-answer"
              disabled={busy}
              onClick={() =>
                void call<Gained & { reaction: string }>("chat", { answer: i }, (r) => {
                  onView(r.love);
                  notify(r.gained ? `${npc.name} ${r.reaction}. +${r.gained} closeness` : `${npc.name} had to run. Talk again tomorrow.`);
                })
              }
            >
              {a.text}
            </button>
          ))}
          {b.chatsLeft === 0 && <span className="tiny muted">{npc.name} is busy today; chats count again tomorrow.</span>}
        </div>
      )}
      {open === "gift" && (
        <div className="love-grid">
          {GIFTS.map((g) => (
            <button
              key={g.key}
              type="button"
              className="btn sm"
              disabled={busy}
              onClick={() =>
                void call<Gained>("gift", { gift: g.key }, (r) => {
                  onView(r.love);
                  setOpen(null);
                  notify(r.gained >= 10 ? `${npc.name} loves it! ${g.icon} +${r.gained}` : `${npc.name} says thank you. ${g.icon} +${r.gained}`);
                })
              }
            >
              {g.icon} {g.label} · {formatCoins(g.cost)}
            </button>
          ))}
        </div>
      )}
      {open === "date" && (
        <div className="love-grid">
          {DATE_SPOTS.map((d) => (
            <button
              key={d.venue}
              type="button"
              className="btn sm"
              disabled={busy}
              onClick={() =>
                void call<Gained & { fav: boolean }>("date", { venue: d.venue }, (r) => {
                  onView(r.love);
                  setOpen(null);
                  // Go there together: the place opens with the two of you in it.
                  startDate(b.npc, d.venue, d.label);
                  onGo(d.venue);
                  notify(
                    r.gained
                      ? `${d.icon} ${d.label} with ${npc.name}${r.fav ? `: their favourite!` : ""} +${r.gained} closeness, +Fun, +Social`
                      : `${d.icon} A lovely time with ${npc.name}. (Closeness grows again in a few hours.)`,
                  );
                })
              }
            >
              {d.icon} {d.label} · {formatCoins(d.cost)}
            </button>
          ))}
          {b.dateAt && <span className="tiny muted">Another date now is still fun; closeness grows again later today.</span>}
        </div>
      )}
    </div>
  );
}

export function LoveApp({ notify, onGo, onChanged }: { notify: (m: string) => void; onGo: (venue: string) => void; onChanged: () => void }) {
  const [view, setView] = useState<LoveView | null>(null);
  useEffect(() => {
    api<LoveView>("GET", "/api/love")
      .then(setView)
      .catch(() => setView({ pref: null, partner: null, bonds: [] }));
  }, []);
  const setPref = (pref: PartnerPref) =>
    void api<LoveView>("PUT", "/api/love/pref", { pref })
      .then(setView)
      .catch((e: Error) => notify(e.message));
  if (!view) return <p className="small muted">Loading…</p>;
  const known = new Set(view.bonds.map((b) => b.npc));
  const pref = view.pref ?? "anyone";
  const toMeet = NPCS.filter((n) => !known.has(n.key) && (pref === "anyone" || (pref === "women") === (n.gender === "woman")));
  return (
    <div className="stack">
      <h2 style={{ fontSize: 20 }}>
        <Heart size={20} aria-hidden="true" /> Love life
      </h2>
      <div className="stack" style={{ gap: 4 }}>
        <span className="small">Who would you like to meet?</span>
        <div className="row" style={{ gap: 6 }}>
          {PARTNER_PREFS.map((p) => (
            <button key={p} type="button" className="chip" aria-pressed={view.pref === p} onClick={() => setPref(p)}>
              {PARTNER_PREF_LABEL[p]}
            </button>
          ))}
        </div>
      </div>
      {view.bonds.length > 0 && <h3 className="small">People you know</h3>}
      {view.bonds.map((b) => (
        <BondCard key={b.npc} b={b} partner={view.partner} notify={notify} onView={setView} onChanged={onChanged} onGo={onGo} />
      ))}
      {toMeet.length > 0 && (
        <>
          <h3 className="small">People to meet</h3>
          <p className="tiny muted">Go where they hang out and say hi. Be kind, listen, and see where it goes.</p>
          {toMeet.map((n) => (
            <div key={n.key} className="love-card">
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <Avatar avatar={n.avatar} size={44} />
                <div className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                  <strong className="small">
                    {n.name}, {n.age} · {n.job}
                  </strong>
                  <span className="tiny muted">{n.bio}</span>
                  <span className="tiny muted">Often at {n.hangouts.map(placeName).join(" or ")}</span>
                </div>
              </div>
              <button type="button" className="btn sm go" style={{ justifySelf: "start" }} onClick={() => onGo(n.hangouts[0]!)}>
                Show me
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** In a place's card: who hangs out here (by your preference), and "Say hi". */
export function PeopleHere({ venue, at, present, notify, onLove }: { venue: string; at: string; present: boolean; notify: (m: string) => void; onLove?: () => void }) {
  const [view, setView] = useState<LoveView | null>(null);
  useEffect(() => {
    api<LoveView>("GET", "/api/love")
      .then(setView)
      .catch(() => setView(null));
  }, [venue]);
  if (!view) return null;
  const people = npcsAt(venue, view.pref ?? "anyone");
  if (people.length === 0) return null;
  const meet = async (n: Npc) => {
    try {
      setView(await api<LoveView>("POST", `/api/love/${n.key}/meet`, { at }));
      notify(`You met ${n.name}! Find them in Phone → Love to chat.`);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <div className="work-box">
      <strong className="small">
        <Heart size={14} aria-hidden="true" /> People here
      </strong>
      {people.map((n) => {
        const b = view.bonds.find((x) => x.npc === n.key);
        return (
          <div key={n.key} className="row" style={{ gap: 8, alignItems: "center" }}>
            <Avatar avatar={n.avatar} size={36} />
            <span className="small" style={{ flex: 1, minWidth: 0 }}>
              <strong>{n.name}</strong> · {n.job}
              {b && <span className="tiny muted"> · {STAGE_LABEL[b.stage]}</span>}
            </span>
            {b ? (
              onLove && (
                <button type="button" className="btn sm" onClick={onLove}>
                  💬 Talk
                </button>
              )
            ) : present ? (
              <button type="button" className="btn sm go" onClick={() => void meet(n)}>
                👋 Say hi
              </button>
            ) : (
              <span className="tiny muted">Go there to say hi</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Your partner living with you (to show at home), or null. */
export function usePartnerAtHome(): Npc | null {
  const [npc, setNpc] = useState<Npc | null>(null);
  useEffect(() => {
    api<LoveView>("GET", "/api/love")
      .then((v) => {
        const b = v.bonds.find((x) => x.stage === "living" || x.stage === "engaged" || x.stage === "married");
        setNpc(b ? (NPC_BY_KEY.get(b.npc) ?? null) : null);
      })
      .catch(() => setNpc(null));
  }, []);
  return npc;
}

/** A place's room with the people who hang out there standing about in it (on the walkway, apart from each other),
 * drawn in their own look (layered) with the nearest everyday look as the fallback. */
export function withRegulars(room: Room | undefined, venue: string): Room | undefined {
  const people = npcsAt(venue, "anyone");
  const walk = room?.walkway ?? [];
  if (!room || !people.length || walk.length < 2) return room;
  const extra = people.slice(0, 2).map((n, i) => ({
    action: "stand_idle" as const,
    at: walk[Math.min(walk.length - 1, Math.round((walk.length - 1) * (i ? 0.25 : 0.7)))]!,
    dir: i ? ("se" as const) : ("sw" as const),
    variant: variantFor(n.avatar),
    look: n.avatar,
  }));
  return { ...room, stations: [...room.stations, ...extra] };
}
