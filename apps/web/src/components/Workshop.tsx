// Phone → Workshop: artisans register a real workshop (admin review first) and see its status.
// Phone → Admin: the review queue for new workshops.
import { ARTISAN_CATEGORIES, LAGOS_AREAS, categoryLabel, type MyBusiness } from "@hc/shared";
import { AlertCircle, CheckCircle2, Clock, Plus, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, formatNaira } from "../api.js";

const STATUS: Record<MyBusiness["status"], { label: string; Icon: typeof Clock }> = {
  pending_review: { label: "Waiting for review", Icon: Clock },
  published: { label: "Live: customers can find you", Icon: CheckCircle2 },
  rejected: { label: "Not approved", Icon: XCircle },
  hidden: { label: "Hidden by a moderator", Icon: XCircle },
  draft: { label: "Draft", Icon: Clock },
};

export function Workshop({ notify }: { notify: (m: string) => void }) {
  const [mine, setMine] = useState<MyBusiness[] | null>(null);
  const [adding, setAdding] = useState(false);
  const load = () =>
    api<MyBusiness[]>("GET", "/api/businesses/mine")
      .then(setMine)
      .catch(() => setMine([]));
  useEffect(() => {
    void load();
  }, []);

  if (!mine) return <p className="muted small">Loading…</p>;
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>Your workshop</h2>
        <p className="small muted">Fix generators, phones or ACs, or tailor and cater? List your real workshop in Owambe Gardens and get quote requests from customers.</p>
      </div>
      {mine.map((b) => {
        const s = STATUS[b.status];
        return (
          <div key={b.id} className="quote-card">
            <strong>{b.name}</strong>
            <span className="tiny muted">
              {categoryLabel(b.category)} · {b.serviceArea}
            </span>
            <span className="small row" style={{ gap: 6 }}>
              <s.Icon size={15} aria-hidden="true" /> {s.label}
            </span>
            {b.reviewNote && <span className="small muted">Moderator note: {b.reviewNote}</span>}
            {b.status === "published" && <span className="tiny muted">Requests arrive in Phone → Messages.</span>}
          </div>
        );
      })}
      {adding || !mine.length ? (
        <RegisterWorkshop
          onDone={() => {
            setAdding(false);
            void load();
            notify("Workshop sent for review");
          }}
        />
      ) : (
        mine.length < 3 && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" /> Add another workshop
          </button>
        )
      )}
    </div>
  );
}

function RegisterWorkshop({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(ARTISAN_CATEGORIES[0].key);
  const [areas, setAreas] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [services, setServices] = useState([{ name: "", price: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (a: string) => setAreas((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : xs.length < 6 ? [...xs, a] : xs));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/businesses", {
        name,
        category,
        areas,
        description,
        services: services.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), fromPriceNaira: Number(s.price) || 0 })),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack req-form" onSubmit={(e) => void submit(e)}>
      <strong>Register a workshop</strong>
      <label className="field">
        <span className="field-label">Business name</span>
        <input className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tunde Gen Repairs" required />
      </label>
      <label className="field">
        <span className="field-label">What do you do?</span>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {ARTISAN_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label">Areas you serve (up to 6)</legend>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {LAGOS_AREAS.map((a) => (
            <button key={a} type="button" className="chip" aria-pressed={areas.includes(a)} onClick={() => toggle(a)}>
              {a}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span className="field-label">Describe your work</span>
        <textarea className="input" rows={3} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you fix or make, experience, working hours" required />
      </label>
      <div className="field">
        <span className="field-label">Services and "from" prices (optional)</span>
        {services.map((s, i) => (
          <div className="quote-line" key={i}>
            <input className="input" maxLength={60} placeholder="e.g. Call-out" aria-label={`Service ${i + 1}`} value={s.name} onChange={(e) => setServices((xs) => xs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <span className="naira-input">
              <span aria-hidden="true">₦</span>
              <input className="input num" inputMode="numeric" placeholder="from" aria-label={`Service ${i + 1} from price in naira`} value={s.price} onChange={(e) => setServices((xs) => xs.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^\d]/g, "") } : x)))} />
            </span>
            {services.length > 1 && (
              <button type="button" className="btn sm quiet" aria-label={`Remove service ${i + 1}`} onClick={() => setServices((xs) => xs.filter((_, j) => j !== i))}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {services.length < 8 && (
          <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} onClick={() => setServices((xs) => [...xs, { name: "", price: "" }])}>
            <Plus size={15} aria-hidden="true" /> Add a service
          </button>
        )}
      </div>
      <p className="tiny muted">A moderator checks every workshop before customers can see it. No fees in the beta.</p>
      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
      <button className="btn primary block" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send for review"}
      </button>
    </form>
  );
}

interface PendingBusiness extends MyBusiness {
  description: string;
  createdAt: string;
  services: { name: string; fromPriceKobo: number }[];
}

const REJECT_REASONS = [
  { key: "incomplete", label: "Incomplete details" },
  { key: "not_a_real_business", label: "Not a real business" },
  { key: "offensive", label: "Offensive content" },
  { key: "duplicate", label: "Duplicate listing" },
  { key: "other", label: "Other" },
];

export function AdminReview({ notify }: { notify: (m: string) => void }) {
  const [queue, setQueue] = useState<PendingBusiness[] | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    api<PendingBusiness[]>("GET", "/api/admin/businesses?status=pending_review")
      .then(setQueue)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: string, decision: "publish" | "reject") => {
    setError(null);
    try {
      await api("POST", `/api/admin/businesses/${id}/review`, {
        decision,
        reasonCode: decision === "publish" ? "meets_guidelines" : (reason[id] ?? "incomplete"),
        note: note[id] || undefined,
      });
      notify(decision === "publish" ? "Published" : "Rejected");
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>
          <ShieldCheck size={20} aria-hidden="true" /> Workshop review
        </h2>
        <p className="small muted">Every decision is written to the audit log.</p>
      </div>
      {queue?.length === 0 && <p className="small muted">Nothing waiting. Nice.</p>}
      {queue?.map((b) => (
        <div key={b.id} className="quote-card">
          <strong>{b.name}</strong>
          <span className="tiny muted">
            {categoryLabel(b.category)} · {b.serviceArea}
          </span>
          <p className="small">{b.description}</p>
          {b.services.map((s) => (
            <span key={s.name} className="tiny">
              {s.name} · from {formatNaira(s.fromPriceKobo)}
            </span>
          ))}
          <select className="input" aria-label="Reason if rejecting" value={reason[b.id] ?? "incomplete"} onChange={(e) => setReason((r) => ({ ...r, [b.id]: e.target.value }))}>
            {REJECT_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <input className="input" maxLength={300} placeholder="Note to the owner (optional)" value={note[b.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [b.id]: e.target.value }))} />
          <div className="row">
            <button type="button" className="btn primary" onClick={() => void decide(b.id, "publish")}>
              Publish
            </button>
            <button type="button" className="btn quiet" onClick={() => void decide(b.id, "reject")}>
              Reject
            </button>
          </div>
        </div>
      ))}
      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}
