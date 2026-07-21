import type { BusinessSummary } from "@hc/shared";
import { AlertCircle, CircleCheck, CircleDot, CircleX, MapPin, Search, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatNaira } from "../api.js";

const STOCK = {
  in_stock: { label: "In stock", Icon: CircleCheck, cls: "ok" },
  low_stock: { label: "Low stock", Icon: CircleDot, cls: "warn" },
  out_of_stock: { label: "Out of stock", Icon: CircleX, cls: "warn" },
} as const;

const CATEGORIES = [
  { key: "", label: "All" },
  { key: "electronics", label: "Electronics" },
  { key: "phone_repair", label: "Phone repair" },
  { key: "generator_repair", label: "Generator repair" },
];

const KIND_LABEL = { retail: "Shop", artisan: "Artisan", office: "Office" } as const;

/** Real-merchant discovery. Works without signing in (quick search, no game movement required). */
export function Merchants({ onViewed }: { onViewed?: () => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<BusinessSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const t = setTimeout(() => {
      api<BusinessSummary[]>("GET", `/api/market/businesses${params.size ? `?${params}` : ""}`)
        .then((r) => {
          setItems(r);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [q, category]);

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
        <div className="row" role="group" aria-label="Category">
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
                    {b.kind === "artisan" ? "Quote requests open in the private beta." : "Pickup reservations open in the private beta."}
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
