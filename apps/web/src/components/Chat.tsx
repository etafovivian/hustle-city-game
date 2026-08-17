// Chat: the room chat at a place (whoever's there), private messages, and Phone → Chats.
import { CHAT_MAX, chatProblem, type ChatMessage, type DmThread } from "@hc/shared";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api.js";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });

function MessageList({ items, empty }: { items: ChatMessage[]; empty: string }) {
  const end = useRef<HTMLDivElement>(null);
  // (Braces matter: newer browsers return a promise from scrollIntoView, and an effect must not return one.)
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [items.length]);
  return (
    <div className="chat-list" role="log" aria-live="polite">
      {!items.length && <p className="tiny muted">{empty}</p>}
      {items.map((m) => (
        <div key={m.id} className={`chat-msg ${m.mine ? "mine" : ""}`}>
          {!m.mine && <strong className="tiny">@{m.from}</strong>}
          <span>{m.body}</span>
          <span className="chat-time">{time(m.at)}</span>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function Composer({ onSend, placeholder }: { onSend: (body: string) => Promise<void>; placeholder: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = chatProblem(body);
    if (problem) return setError(problem);
    setError(null);
    try {
      await onSend(body);
      setBody("");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <form className="chat-compose" onSubmit={(e) => void submit(e)}>
      <input className="input" maxLength={CHAT_MAX} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} aria-label="Message" />
      <button type="submit" className="btn sm go" aria-label="Send" disabled={!body.trim()}>
        <Send size={15} aria-hidden="true" />
      </button>
      {error && <span className="tiny chat-error">{error}</span>}
    </form>
  );
}

/** The room chat at a place: everyone inside can talk. */
export function RoomChat({ place }: { place: string }) {
  const [items, setItems] = useState<ChatMessage[]>([]);
  useEffect(() => {
    let stop = false;
    const load = () =>
      api<ChatMessage[]>("GET", `/api/chat/place/${encodeURIComponent(place)}`)
        .then((m) => !stop && setItems(m))
        .catch(() => undefined);
    void load();
    const id = window.setInterval(load, 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [place]);
  return (
    <div className="chat-box">
      <strong className="small row" style={{ gap: 6 }}>
        <MessageCircle size={15} aria-hidden="true" /> Room chat
      </strong>
      <MessageList items={items} empty="Quiet in here. Say hi to whoever walks in." />
      <Composer placeholder="Say something to the room" onSend={async (body) => setItems(await api<ChatMessage[]>("POST", `/api/chat/place/${encodeURIComponent(place)}`, { body }))} />
    </div>
  );
}

/** A private conversation with one player. */
export function DmThreadView({ nick }: { nick: string }) {
  const [items, setItems] = useState<ChatMessage[]>([]);
  const load = () =>
    api<ChatMessage[]>("GET", `/api/chat/dm/${encodeURIComponent(nick)}`)
      .then(setItems)
      .catch(() => undefined);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [nick]);
  return (
    <div className="chat-box">
      <MessageList items={items} empty={`Start a conversation with @${nick}.`} />
      <Composer
        placeholder={`Message @${nick}`}
        onSend={async (body) => {
          await api("POST", `/api/chat/dm/${encodeURIComponent(nick)}`, { body });
          await load();
        }}
      />
    </div>
  );
}

/** Phone → Chats: your conversations. */
export function Chats({ open: initial }: { open?: string | null }) {
  const [threads, setThreads] = useState<DmThread[] | null>(null);
  const [open, setOpen] = useState<string | null>(initial ?? null);
  const [to, setTo] = useState("");
  useEffect(() => {
    if (open) return;
    api<DmThread[]>("GET", "/api/chat/dm")
      .then(setThreads)
      .catch(() => setThreads([]));
  }, [open]);
  if (open)
    return (
      <div className="stack account-form">
        <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} onClick={() => setOpen(null)}>
          <ArrowLeft size={15} aria-hidden="true" /> Chats
        </button>
        <h2 style={{ fontSize: 20 }}>@{open}</h2>
        <DmThreadView nick={open} />
      </div>
    );
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>Chats</h2>
        <p className="small muted">Message any player by their @name, or tap someone on the map. Links and phone numbers are blocked to keep scams out.</p>
      </div>
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          const n = to.trim().replace(/^@/, "");
          if (n) setOpen(n);
        }}
      >
        <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Message a player: type their @name" aria-label="Player's name" maxLength={30} />
        <button type="submit" className="btn sm go" disabled={!to.trim()}>
          Open
        </button>
      </form>
      {threads?.length === 0 && <p className="small muted">No chats yet.</p>}
      {threads?.map((t) => (
        <button key={t.with} type="button" className="ov-row chat-thread" onClick={() => setOpen(t.with)}>
          <span aria-hidden="true">💬</span>
          <span>
            <strong>
              @{t.with} {t.unread > 0 && <span className="unread-badge">{t.unread}</span>}
            </strong>
            <span className="tiny muted">{t.last}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
