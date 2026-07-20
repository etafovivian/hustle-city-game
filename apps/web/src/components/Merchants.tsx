import type { BusinessSummary } from "@hc/shared";
import { useEffect, useState } from "react";
import { api, formatNaira } from "../api.js";

const STOCK_LABEL = { in_stock: "In stock", low_stock: "Low stock", out_of_stock: "Out of stock" } as const;

/** Real-merchant discovery. Works without signing in (quick search, no game movement required). */
export function Merchants({ onViewed }: { onViewed?: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<BusinessSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<BusinessSummary[]>("GET", `/api/market/businesses${q ? `?q=${encodeURIComponent(q)}` : ""}`)
        .then(setItems)
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const view = async (id: string) => {
    setSelected(id);
    try {
      await api("GET", `/api/market/products/${id}`);
      onViewed?.();
    } catch {
      /* viewing still works if quest tracking fails */
    }
  };

  return (
    <div className="stack">
      <input
        className="input"
        type="search"
        placeholder="Search e.g. generator repair, power bank"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search merchants"
      />
      <p className="small muted">Prices are real NGN. Product details are what count — the shop building is decoration.</p>
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="muted">No merchants match yet.</p>}
      {items?.map((b) => (
        <div className="card biz" key={b.id}>
          <div className="spread">
            <h3>{b.name}</h3>
            <div className="row">
              <span className="tag">{b.kind}</span>
              {b.isMock && <span className="tag warn">demo listing</span>}
            </div>
          </div>
          <p className="small muted">
            Serves {b.serviceArea}
            {b.pickupAddress ? ` · Pickup: ${b.pickupAddress}` : ""}
          </p>
          <p className="small">{b.description}</p>
          {b.products.map((p) => (
            <div className="product" key={p.id}>
              <button onClick={() => void view(p.id)} aria-expanded={selected === p.id}>
                {p.name}
                {selected === p.id && (
                  <span className="small muted">
                    {" "}
                    — {STOCK_LABEL[p.stockStatus]}.{" "}
                    {b.kind === "artisan" ? "Quote requests open in the private beta." : "Pickup reservations open in the private beta."}
                  </span>
                )}
              </button>
              <strong>{formatNaira(p.priceKobo)}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
