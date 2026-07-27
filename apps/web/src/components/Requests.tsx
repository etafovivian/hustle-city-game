// Stage B1 in the Phone's Messages app: quote requests as a customer and as an artisan.
// A list with "your turn" markers, and a thread per request: quotes (all versions), history and actions.
import {
  STATUS_LABEL,
  categoryLabel,
  type QuoteItem,
  type ServiceRequestDetail,
  type ServiceRequestSummary,
} from "@hc/shared";
import { AlertCircle, ArrowLeft, CalendarClock, CheckCircle2, MessageCircle, Plus, Star, Trash2, Wrench } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, formatNaira } from "../api.js";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));

const EVENT_TEXT: Record<string, (by: string, v: number | null) => string> = {
  requested: () => "Request sent",
  quote: (_by, v) => (v === 1 ? "Quote sent" : `Quote updated (version ${v})`),
  accept: (_by, v) => `Quote version ${v} accepted, job booked`,
  decline: (by) => (by === "artisan" ? "The artisan turned this request down" : "Quote declined"),
  cancel: () => "Request cancelled",
  complete: () => "Artisan marked the job done",
  not_done: () => "Customer says it's not done yet",
  confirm: () => "Customer confirmed the job is done",
  review: () => "Review left",
  note: (by) => (by === "artisan" ? "Message from the artisan" : "Message from the customer"),
};

export function RequestList({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<ServiceRequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<ServiceRequestSummary[]>("GET", "/api/services/requests")
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error)
    return (
      <p className="alert" role="alert">
        <AlertCircle size={18} aria-hidden="true" /> {error}
      </p>
    );
  if (!items) return <p className="muted small">Loading…</p>;
  if (!items.length)
    return (
      <div className="phone-empty">
        <MessageCircle size={32} aria-hidden="true" />
        <strong>No requests yet</strong>
        <p className="muted small">Find an artisan in Market → Real businesses and tap "Request a quote". Replies and quotes land here.</p>
      </div>
    );

  return (
    <ul className="req-list">
      {items.map((r) => (
        <li key={r.id}>
          <button type="button" className="req-row" onClick={() => onOpen(r.id)}>
            <span className="req-row-main">
              <strong>{r.role === "customer" ? r.businessName : `${r.counterpart} · ${categoryLabel(r.category)}`}</strong>
              <span className="tiny muted">
                {r.role === "artisan" ? "Request to your workshop" : categoryLabel(r.category)}
                {r.latestTotalKobo !== null ? ` · ${formatNaira(r.latestTotalKobo)}` : ""}
              </span>
            </span>
            <span className={`req-status s-${r.status}`}>{STATUS_LABEL[r.status]}</span>
            {r.yourTurn && <span className="phone-badge req-turn" aria-label="Your turn" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Line-item editor for a quote (naira in the form, kobo on the wire). */
function QuoteForm({ last, onSend, busy }: { last?: ServiceRequestDetail["quotes"][number]; onSend: (q: { items: QuoteItem[]; appointmentAt: string; note: string }) => void; busy: boolean }) {
  const [lines, setLines] = useState(() => (last ? last.items.map((i) => ({ label: i.label, naira: String(i.amountKobo / 100) })) : [{ label: "", naira: "" }]));
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setHours(10, 0, 0, 0);
  const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [at, setAt] = useState(() => toLocal(last ? new Date(last.appointmentAt) : tomorrow));
  const [note, setNote] = useState("");
  const total = lines.reduce((s, l) => s + (Number(l.naira) || 0), 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend({
      items: lines.filter((l) => l.label.trim() || l.naira).map((l) => ({ label: l.label, amountKobo: Math.round((Number(l.naira) || 0) * 100) })),
      appointmentAt: new Date(at).toISOString(),
      note,
    });
  };

  return (
    <form className="stack req-form" onSubmit={submit}>
      <strong>{last ? "Update the quote" : "Send a quote"}</strong>
      {last && <p className="tiny muted">The customer has to accept the new version, so extra charges always need their OK.</p>}
      {lines.map((l, i) => (
        <div className="quote-line" key={i}>
          <input className="input" placeholder="e.g. Call-out" aria-label={`Line ${i + 1} description`} value={l.label} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <span className="naira-input">
            <span aria-hidden="true">₦</span>
            <input className="input num" inputMode="numeric" placeholder="0" aria-label={`Line ${i + 1} price in naira`} value={l.naira} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, naira: e.target.value.replace(/[^\d]/g, "") } : x)))} />
          </span>
          {lines.length > 1 && (
            <button type="button" className="btn sm quiet" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {lines.length < 20 && (
        <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} onClick={() => setLines((ls) => [...ls, { label: "", naira: "" }])}>
          <Plus size={15} aria-hidden="true" /> Add a line
        </button>
      )}
      <div className="spread">
        <span className="small muted">Total</span>
        <strong className="num">{formatNaira(total * 100)}</strong>
      </div>
      <label className="field">
        <span className="field-label">Appointment</span>
        <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">Note (optional)</span>
        <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's included, parts, how long it takes" />
      </label>
      <button className="btn primary block" type="submit" disabled={busy}>
        {last ? "Send updated quote" : "Send quote"}
      </button>
    </form>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className="stars" role={onChange ? "radiogroup" : "img"} aria-label={onChange ? "Rating" : `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(n)}>
            <Star size={22} fill={n <= value ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        ) : (
          <Star key={n} size={16} fill={n <= value ? "currentColor" : "none"} aria-hidden="true" />
        ),
      )}
    </span>
  );
}

export function RequestThread({ id, onBack, notify, onChanged }: { id: string; onBack: () => void; notify: (m: string) => void; onChanged: () => void }) {
  const [req, setReq] = useState<ServiceRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    api<ServiceRequestDetail>("GET", `/api/services/requests/${id}`)
      .then(setReq)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const run = async (path: string, body: unknown, ok?: string) => {
    setBusy(true);
    setError(null);
    try {
      setReq(await api<ServiceRequestDetail>("POST", `/api/services/requests/${id}/${path}`, body));
      setQuoting(false);
      onChanged();
      if (ok) notify(ok);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!req)
    return error ? (
      <p className="alert" role="alert">
        <AlertCircle size={18} aria-hidden="true" /> {error}
      </p>
    ) : (
      <p className="muted small">Loading…</p>
    );

  const latest = req.quotes[req.quotes.length - 1];
  const older = req.quotes.slice(0, -1).reverse();
  const can = new Set(req.can);
  const customer = req.role === "customer";

  return (
    <div className="stack req-thread">
      <button type="button" className="link-btn small" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" /> All requests
      </button>
      <div className="stack" style={{ gap: 4 }}>
        <span className={`req-status s-${req.status}`} style={{ justifySelf: "start" }}>
          {STATUS_LABEL[req.status]}
        </span>
        <h2 style={{ fontSize: 20 }}>{customer ? req.businessName : `${req.counterpart}'s request`}</h2>
        <span className="tiny muted">
          {categoryLabel(req.category)} · {req.serviceArea} · sent {when(req.createdAt)}
        </span>
      </div>
      <blockquote className="req-desc">{req.description}</blockquote>

      {req.scheduledFor && (
        <p className="notice small">
          <CalendarClock size={16} aria-hidden="true" /> Booked for {when(req.scheduledFor)}. Pay the artisan directly as agreed. In-app payment comes later.
        </p>
      )}

      {latest && (
        <section className="quote-card" aria-label={`Quote version ${latest.version}`}>
          <div className="spread">
            <strong>Quote{latest.version > 1 ? ` · version ${latest.version}` : ""}</strong>
            <span className="tiny muted">{when(latest.createdAt)}</span>
          </div>
          <ul className="quote-items">
            {latest.items.map((it, i) => (
              <li key={i}>
                <span>{it.label}</span>
                <span className="num">{formatNaira(it.amountKobo)}</span>
              </li>
            ))}
          </ul>
          <div className="spread quote-total">
            <span>Total</span>
            <strong className="num">{formatNaira(latest.totalKobo)}</strong>
          </div>
          <span className="small">
            <CalendarClock size={14} aria-hidden="true" /> Appointment: {when(latest.appointmentAt)}
          </span>
          {latest.note && <p className="small muted">"{latest.note}"</p>}
          {customer && can.has("accept") && (
            <div className="row">
              <button type="button" className="btn primary" disabled={busy} onClick={() => void run("accept", { version: latest.version }, "Quote accepted. Job booked.")}>
                <CheckCircle2 size={16} aria-hidden="true" /> Accept {formatNaira(latest.totalKobo)}
              </button>
              <button type="button" className="btn quiet" disabled={busy} onClick={() => void run("decline", {})}>
                Decline
              </button>
            </div>
          )}
        </section>
      )}
      {older.length > 0 && (
        <details className="small">
          <summary>Earlier versions ({older.length})</summary>
          {older.map((q) => (
            <p key={q.version} className="muted">
              Version {q.version}: {formatNaira(q.totalKobo)} · {q.items.map((i) => i.label).join(", ")}
            </p>
          ))}
        </details>
      )}

      {!customer && can.has("quote") && (quoting || !latest ? <QuoteForm last={latest} busy={busy} onSend={(q) => void run("quote", q, "Quote sent")} /> : (
        <button type="button" className="btn" onClick={() => setQuoting(true)}>
          Update quote or add charges
        </button>
      ))}

      <div className="row">
        {!customer && can.has("complete") && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => void run("complete", {}, "Marked done. The customer will confirm.")}>
            <Wrench size={16} aria-hidden="true" /> Mark job done
          </button>
        )}
        {customer && can.has("confirm") && (
          <>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void run("confirm", {}, "Job confirmed. Thanks!")}>
              <CheckCircle2 size={16} aria-hidden="true" /> Confirm it's done
            </button>
            <button type="button" className="btn quiet" disabled={busy} onClick={() => void run("not-done", { note: message })}>
              Not done yet
            </button>
          </>
        )}
        {!customer && can.has("decline") && (
          <button type="button" className="btn quiet" disabled={busy} onClick={() => void run("decline", {})}>
            Can't take this job
          </button>
        )}
        {customer && can.has("cancel") && (
          <button type="button" className="btn quiet" disabled={busy} onClick={() => void run("cancel", {})}>
            Cancel request
          </button>
        )}
      </div>

      {customer && can.has("review") && (
        <form
          className="stack req-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating) void run("review", { rating, body: reviewText }, "Review posted");
          }}
        >
          <strong>How did it go?</strong>
          <Stars value={rating} onChange={setRating} />
          <textarea className="input" rows={2} maxLength={600} placeholder="A few words for other customers (optional)" value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy || !rating}>
            Post review
          </button>
        </form>
      )}
      {req.review && (
        <p className="small">
          <Stars value={req.review.rating} /> {req.review.body}
        </p>
      )}

      {can.has("note") && (
        <form
          className="req-note"
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) void run("note", { note: message }).then((ok) => ok && setMessage(""));
          }}
        >
          <input className="input" maxLength={500} placeholder={customer ? "Message the artisan" : "Message the customer"} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Message" />
          <button className="btn sm" type="submit" disabled={busy || !message.trim()}>
            Send
          </button>
        </form>
      )}
      <p className="tiny muted">Keep phone numbers and addresses out of messages until you've agreed the job.</p>

      <ol className="req-events" aria-label="History">
        {[...req.events].reverse().map((e, i) => (
          <li key={i}>
            <span className="tiny muted">{when(e.at)}</span>
            <span className="small">{(EVENT_TEXT[e.type] ?? (() => e.type))(e.by, e.version)}</span>
            {e.note && <span className="small req-event-note">{e.note}</span>}
          </li>
        ))}
      </ol>

      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}
