// Balogun Market: haggle with a trader for stock for your shop, and browse the real traders' stalls.
import { STOCK_ITEMS, askPrice, isStall, type HaggleResult, type MapBusiness } from "@hc/shared";
import { Handshake, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";
import { BusinessCard } from "./Land.js";

export function Haggle({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const [itemKey, setItemKey] = useState(STOCK_ITEMS[3]!.key);
  const [units, setUnits] = useState(5);
  const ask = askPrice(itemKey, units) ?? 0;
  const [offer, setOffer] = useState(String(Math.round(ask * 0.7)));
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setOffer(String(Math.round((askPrice(itemKey, units) ?? 0) * 0.7)));
    setLine(null);
  }, [itemKey, units]);
  const go = async () => {
    setBusy(true);
    try {
      const r = await api<HaggleResult>("POST", "/api/market/haggle", { itemKey, units, offer: Number(offer), requestId: crypto.randomUUID() });
      if (r.result === "deal") {
        setLine(`Deal! You paid ${formatCoins(r.paid)}${r.saved > 0 ? `, ${formatCoins(r.saved)} less than a normal restock` : ""}. It's in your shop.`);
        notify("Stock delivered to your shop");
        onChanged();
      } else if (r.result === "counter") {
        setLine(`"${r.line}" (${r.triesLeft} tries left)`);
        setOffer(String(r.counter));
      } else setLine(`"${r.line}" (${r.triesLeft} tries left)`);
    } catch (e) {
      setLine((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="work-box">
      <strong className="small row" style={{ gap: 6 }}>
        <Handshake size={15} aria-hidden="true" /> Buy stock for your shop: haggle!
      </strong>
      <div className="row">
        <select className="input" value={itemKey} onChange={(e) => setItemKey(e.target.value)} aria-label="Item">
          {STOCK_ITEMS.map((i) => (
            <option key={i.key} value={i.key}>
              {i.name}
            </option>
          ))}
        </select>
        <select className="input" value={units} onChange={(e) => setUnits(Number(e.target.value))} aria-label="How many">
          {[5, 10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n} units
            </option>
          ))}
        </select>
      </div>
      <span className="tiny muted">
        Trader asks {formatCoins(ask)}. Offer less; bargain well and you beat the usual restock price. Too low and they walk off.
      </span>
      <div className="row">
        <input className="input num" inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value.replace(/[^\d]/g, ""))} aria-label="Your offer" />
        <button type="button" className="btn go" disabled={busy || !Number(offer)} onClick={() => void go()}>
          {busy ? "…" : "Offer"}
        </button>
      </div>
      {line && <span className="small">{line}</span>}
    </div>
  );
}

/** Real traders with a stall at the market. */
export function Stalls({ notify }: { notify: (m: string) => void }) {
  const [items, setItems] = useState<MapBusiness[]>([]);
  const [open, setOpen] = useState<MapBusiness | null>(null);
  useEffect(() => {
    api<MapBusiness[]>("GET", "/api/map/businesses")
      .then((r) => setItems(r.filter((b) => isStall(b.plotId))))
      .catch(() => undefined);
  }, []);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <strong className="small row" style={{ gap: 6 }}>
        <Store size={15} aria-hidden="true" /> Traders' stalls ({items.length})
      </strong>
      {!items.length && <span className="tiny muted">No real traders here yet. Got a shop? Take a free stall from Phone → Business.</span>}
      <div className="row">
        {items.map((b) => (
          <button key={b.plotId} type="button" className="chip" onClick={() => setOpen(b)}>
            {b.verified ? "✓ " : ""}
            {b.name} {b.deals ? "🏷️" : ""}
          </button>
        ))}
      </div>
      {open && <BusinessCard biz={open} onClose={() => setOpen(null)} onGo={() => setOpen(null)} onQuote={() => setOpen(null)} notify={notify} />}
    </div>
  );
}
