// Phone → Contacts: people you've added, whether they're online and where, with Message / Go to / Visit.
import type { ContactView } from "@hc/shared";
import { MessageCircle, Navigation, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api.js";
import { Avatar } from "./Avatar.js";
import { DmThreadView } from "./Chat.js";
import { placeName } from "./Social.js";

export function Contacts({ notify, onGo }: { notify: (m: string) => void; onGo: (c: ContactView) => void }) {
  const [items, setItems] = useState<ContactView[] | null>(null);
  const [name, setName] = useState("");
  const [talk, setTalk] = useState<string | null>(null);
  const load = () =>
    api<ContactView[]>("GET", "/api/contacts")
      .then(setItems)
      .catch(() => setItems([]));
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, []);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ nickname: string }>("POST", `/api/contacts/${encodeURIComponent(name.trim().replace(/^@/, ""))}`);
      notify(`@${r.nickname} added to your contacts`);
      setName("");
      void load();
    } catch (err) {
      notify((err as Error).message);
    }
  };
  const remove = async (nick: string) => {
    await api("DELETE", `/api/contacts/${encodeURIComponent(nick)}`).catch(() => undefined);
    void load();
  };
  const sorted = [...(items ?? [])].sort((a, b) => Number(b.online) - Number(a.online));
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>Contacts</h2>
        <p className="small muted">Add friends by their @name. See who's online and where, then message them or go and meet them.</p>
      </div>
      <form className="chat-compose" onSubmit={(e) => void add(e)}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="@name, e.g. Alexander_Abdulganiy" aria-label="Player's name" maxLength={31} />
        <button type="submit" className="btn sm go" disabled={!name.trim()}>
          <UserPlus size={15} aria-hidden="true" /> Add
        </button>
      </form>
      {items?.length === 0 && <p className="small muted">No contacts yet.</p>}
      {sorted.map((c) => (
        <div key={c.nickname} className="quote-card contact">
          <div className="row" style={{ gap: 10 }}>
            <Avatar avatar={c.avatar} size={40} />
            <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
              <strong>@{c.nickname}</strong>
              <span className="tiny muted">{c.online ? (<><span className="online-dot" aria-hidden="true" /> {placeName(c.place)}</>) : "Offline"}</span>
            </span>
            <button type="button" className="btn sm quiet" aria-label={`Remove @${c.nickname}`} onClick={() => void remove(c.nickname)}>
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="row">
            <button type="button" className="btn sm" onClick={() => setTalk(talk === c.nickname ? null : c.nickname)}>
              <MessageCircle size={15} aria-hidden="true" /> Message
            </button>
            {c.online && c.x !== null && (
              <button type="button" className="btn sm go" onClick={() => onGo(c)}>
                <Navigation size={15} aria-hidden="true" /> Go to them
              </button>
            )}
          </div>
          {talk === c.nickname && <DmThreadView nick={c.nickname} />}
        </div>
      ))}
    </div>
  );
}
