// Visiting another player's shop from the map: their room and decor, their price board, read-only.
import { HUSTLES_BY_KEY, type ShopVisit as Visit } from "@hc/shared";
import { AlertCircle, Flag, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, formatCoins } from "../api.js";
import { ShopRoom } from "./ShopRoom.js";

export function ShopVisit({ shopId, onClose, onVisited, notify }: { shopId: string; onClose: () => void; onVisited: () => void; notify: (m: string) => void }) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    api<Visit>("POST", `/api/game/shops/${shopId}/visit`)
      .then((v) => {
        if (!live) return;
        setVisit(v);
        onVisited();
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // onVisited is a fresh callback each render; visiting once per shop is what matters.
  }, [shopId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const report = () => {
    api("POST", "/api/reports", { targetType: "shop", targetId: shopId, reason: "Offensive or inappropriate shop name (reported from a shop visit)" })
      .then(() => {
        setReported(true);
        notify("Thanks. A moderator will check this shop.");
      })
      .catch((e: Error) => setError(e.message));
  };

  const hustle = visit ? HUSTLES_BY_KEY.get(visit.hustle) : undefined;

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div
        ref={sheet}
        className="visit-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={visit ? `Visiting ${visit.shopName}` : "Visiting a shop"}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Leave shop">
          <X size={18} aria-hidden="true" />
        </button>

        {!visit && !error && <p className="muted">Knocking on the door…</p>}

        {visit && (
          <>
            <div className="visit-head">
              <span className="tiny dream-kicker">{visit.isMe ? "Your shop" : "Visiting"}</span>
              <h2>{visit.shopName}</h2>
              <span className="small muted">
                {visit.isMe ? "This is how visitors see your shop" : `Run by @${visit.nickname}`} · {hustle?.title ?? "Trader"}
              </span>
              <span className="appeal-pill" style={{ justifySelf: "start" }}>
                <Sparkles size={14} aria-hidden="true" /> Appeal {visit.decor.appeal} · +{Math.round(visit.decor.boost * 100)}% customers
              </span>
            </div>

            <div className="decor-floor visit-room">
              <ShopRoom cols={visit.decor.floor.cols} rows={visit.decor.floor.rows} items={visit.decor.placements} label={`${visit.shopName} shop floor`} />
              {visit.decor.placements.length === 0 && <p className="visit-empty small">No furniture yet. Plenty of room to grow.</p>}
            </div>

            <section aria-labelledby="price-board" className="stack">
              <h3 id="price-board" style={{ fontSize: 16 }}>
                Price board
              </h3>
              {visit.prices.length ? (
                <ul className="price-board">
                  {visit.prices.map((p) => (
                    <li key={p.itemKey}>
                      <span>{p.name}</span>
                      <span className="num">{formatCoins(p.price)}</span>
                      <span className={`tiny ${p.inStock ? "in-stock" : "muted"}`}>{p.inStock ? "In stock" : "Sold out"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">Nothing on the shelves yet.</p>
              )}
              {!visit.isMe && <p className="tiny muted">Compare their prices with yours: customers walk if you charge too much.</p>}
            </section>

            {!visit.isMe && (
              <button type="button" className="btn sm quiet visit-report" onClick={report} disabled={reported}>
                <Flag size={14} aria-hidden="true" /> {reported ? "Reported" : "Report shop name"}
              </button>
            )}
          </>
        )}

        {error && (
          <p className="alert" role="alert">
            <AlertCircle size={18} aria-hidden="true" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
