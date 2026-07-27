import { ARTISAN_CATEGORIES, LAGOS_AREAS, type BusinessSummary } from "@hc/shared";
import { AlertCircle, CircleCheck, CircleDot, CircleX, MapPin, MessageSquarePlus, Search, SearchX, Star } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, formatNaira } from "../api.js";

const STOCK = {
  in_stock: { label: "In stock", Icon: CircleCheck, cls: "ok" },
  low_stock: { label: "Low stock", Icon: CircleDot, cls: "warn" },
  out_of_stock: { label: "Out of stock", Icon: CircleX, cls: "warn" },
} as const;

const CATEGORIES = [{ key: "", label: "All" }, { key: "electronics", label: "Electronics" }, ...ARTISAN_CATEGORIES];

const KIND_LABEL = { retail: "Shop", artisan: "Artisan", office: "Office" } as const;

/** Ask an artisan for a quote: what's wrong, and where. */
function RequestQuote({ business, onSent, onClose }: { business: BusinessSummary; onSent: () => void; onClose: () => void }) {
  const firstArea = LAGOS_AREAS.find((a) => business.serviceArea.includes(a)) ?? LAGOS_AREAS[0];
  const [description, setDescription] = useState("");
  const [area, setArea] = useState<string>(firstArea);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/services/requests", { businessId: business.id, description, serviceArea: area });
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="stack req-form biz-request" onSubmit={(e) => void submit(e)}>
      <strong>Request a quote from {business.name}</strong>
      <label className="field">
        <span className="field-label">What do you need?</span>
        <textarea className="input" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. My 2.5kVA generator starts then goes off after a minute" required />
      </label>
      <label className="field">
        <span className="field-label">Your area</span>
        <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
          {LAGOS_AREAS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <p className="tiny muted">The artisan sees your nickname, not your email. Share your address only after you accept a quote.</p>
      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send request"}
        </button>
        <button className="btn quiet" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Real-merchant discovery. Works without signing in (quick search, no game movement required). */
export function Merchants({ onViewed, signedIn = false, onRequested }: { onViewed?: () => void; signedIn?: boolean; onRequested?: () => void }) {
  const [area, setArea] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<BusinessSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (area) params.set("area", area);
    const t = setTimeout(() => {
      api<BusinessSummary[]>("GET", `/api/market/businesses${params.size ? `?${params}` : ""}`)
        .then((r) => {
          setItems(r);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [q, category, area]);

  const view = (id: string) => {
    setOpen((o) => (o === id ? null : id));
    api("GET", `/api/market/products/${id}`)
      .then(() => onViewed?.())
      .catch(() => {
        /* the card still opens if quest tracking fails */
      });
  };

  return (
    <div className="stack-lg">
      <div className="stack">
        <label className="search">
          <span className="sr-only">Search merchants</span>
          <Search size={18} aria-hidden="true" />
          <input
            className="input"
            type="search"
            placeholder="Try generator repair or power bank"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="field" style={{ maxWidth: 260 }}>
          <span className="field-label">Area</span>
          <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All of Lagos</option>
            {LAGOS_AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <div className="row" role="group" aria-label="Category" style={{ flexWrap: "wrap" }}>
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" className="chip" aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="small muted">Prices are in naira and set by each business. The product details are what count, not the building.</p>
      </div>

      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
      {items?.length === 0 && (
        <div className="sheet sheet-pad stack" style={{ justifyItems: "start" }}>
          <SearchX size={22} aria-hidden="true" className="muted" />
          <h3>No merchants match that yet</h3>
          <p className="small muted">Try a shorter search or another category.</p>
        </div>
      )}

      {items?.map((b) => (
        <article className="sheet" key={b.id} aria-labelledby={`biz-${b.id}`}>
          <div className="biz-head">
            <div className="spread">
              <h3 id={`biz-${b.id}`}>{b.name}</h3>
              <div className="row">
                <span className="tag">{KIND_LABEL[b.kind]}</span>
                {b.isMock && <span className="tag demo">Demo listing</span>}
              </div>
            </div>
            <p className="small muted row" style={{ gap: 6 }}>
              <MapPin size={15} aria-hidden="true" /> Serves {b.serviceArea}
              {b.pickupAddress ? ` · Pickup at ${b.pickupAddress}` : ""}
            </p>
            <p className="small">{b.description}</p>
            {b.rating && (
              <p className="small row" style={{ gap: 4 }}>
                <Star size={15} fill="currentColor" aria-hidden="true" className="gold" /> {b.rating.average.toFixed(1)} · {b.rating.count} review{b.rating.count === 1 ? "" : "s"} from completed jobs
              </p>
            )}
            {b.kind === "artisan" &&
              (signedIn ? (
                asking === b.id ? (
                  <RequestQuote
                    business={b}
                    onClose={() => setAsking(null)}
                    onSent={() => {
                      setAsking(null);
                      onRequested?.();
                    }}
                  />
                ) : (
                  <button type="button" className="btn sm go" style={{ justifySelf: "start" }} onClick={() => setAsking(b.id)}>
                    <MessageSquarePlus size={16} aria-hidden="true" /> Request a quote
                  </button>
                )
              ) : (
                <p className="tiny muted">Sign in to request a quote.</p>
              ))}
          </div>
          {b.products.map((p) => {
            const s = STOCK[p.stockStatus];
            const expanded = open === p.id;
            return (
              <button key={p.id} className="product" onClick={() => view(p.id)} aria-expanded={expanded}>
                <span>{p.name}</span>
                <span className="product-price num">{formatNaira(p.priceKobo)}</span>
                {expanded && (
                  <span className="product-detail">
                    <span className={`tag ${s.cls}`}>
                      <s.Icon size={13} aria-hidden="true" /> {s.label}
                    </span>{" "}
                    {b.kind === "artisan" ? "Starting price. Request a quote for your exact job." : "Pickup reservations open in the private beta."}
                  </span>
                )}
              </button>
            );
          })}
        </article>
      ))}
    </div>
  );
}
