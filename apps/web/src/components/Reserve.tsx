// Pickup reservations: reserve a product on a shop's card, see yours in Phone → Deals, and (for the shop) confirm,
// decline or mark collected in Phone → Business. You pay at the shop; no money moves in the game.
import { RESERVE, type ReservationView } from "@hc/shared";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";

const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
const until = (iso: string) => new Intl.DateTimeFormat("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
const STATUS: Record<ReservationView["status"], string> = {
  requested: "Waiting for the shop",
  confirmed: "Held for you",
  declined: "Shop couldn't hold it",
  collected: "Collected",
  cancelled: "Cancelled",
  expired: "Expired",
};

/** The Reserve button next to a product, with quantity and a note. */
export function ReserveButton({ productId, name, notify }: { productId: string; name: string; notify: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await api<ReservationView>("POST", `/api/products/${productId}/reserve`, { qty, note });
      notify(`Reserved ${qty} × ${name} (code ${r.code}). The shop confirms within ${RESERVE.confirmHours} hours.`);
      setOpen(false);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <button type="button" className="btn sm quiet" onClick={() => setOpen(true)} aria-label={`Reserve ${name}`}>
        <ShoppingBag size={14} aria-hidden="true" /> Reserve
      </button>
    );
  return (
    <span className="row reserve-form" style={{ gap: 4 }}>
      <select className="input" value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="How many">
        {Array.from({ length: RESERVE.maxQty }, (_, i) => i + 1).map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
      <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. coming at 5)" aria-label="Note for the shop" />
      <button type="button" className="btn sm go" disabled={busy} onClick={() => void send()}>
        Send
      </button>
    </span>
  );
}

/** Phone → Deals: your reservations. */
export function MyReservations() {
  const [items, setItems] = useState<ReservationView[] | null>(null);
  const load = () =>
    api<ReservationView[]>("GET", "/api/reservations/mine")
      .then(setItems)
      .catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, []);
  if (!items?.length) return null;
  const cancel = async (id: string) => {
    await api("POST", `/api/reservations/${id}/cancel`).catch(() => undefined);
    void load();
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h3 style={{ fontSize: 16, margin: 0 }}>Your reservations</h3>
      {items.map((r) => (
        <div key={r.id} className={`quote-card reservation ${r.status}`}>
          <strong className="small">
            {r.qty} × {r.product} · {naira(r.priceKobo * r.qty)}
          </strong>
          <span className="tiny muted">
            {r.businessName}
            {r.pickupAddress ? ` · ${r.pickupAddress}` : ""} · code <b>{r.code}</b>
          </span>
          <span className="tiny">
            {STATUS[r.status]}
            {r.status === "confirmed" ? ` until ${until(r.expiresAt)}: pay and collect at the shop` : r.status === "requested" ? ` (answer by ${until(r.expiresAt)})` : ""}
          </span>
          {(r.status === "requested" || r.status === "confirmed") && (
            <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} onClick={() => void cancel(r.id)}>
              Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Phone → Business: the shop's reservations to answer. */
export function ShopReservations({ businessId, notify }: { businessId: string; notify: (m: string) => void }) {
  const [items, setItems] = useState<ReservationView[] | null>(null);
  const load = () =>
    api<ReservationView[]>("GET", `/api/businesses/${businessId}/reservations`)
      .then(setItems)
      .catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, [businessId]);
  const act = async (id: string, action: "confirm" | "decline" | "collected") => {
    try {
      await api("POST", `/api/reservations/${id}/${action}`);
      void load();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const open = (items ?? []).filter((r) => r.status === "requested" || r.status === "confirmed");
  if (!items) return null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <strong className="small">
        <ShoppingBag size={14} aria-hidden="true" /> Reservations {open.length ? `(${open.length} open)` : ""}
      </strong>
      {!open.length && <span className="tiny muted">None waiting. Customers reserve products from your card on the map and pay you at pickup.</span>}
      {open.map((r) => (
        <div key={r.id} className="table-row">
          <span className="tiny">
            <b>
              {r.qty} × {r.product}
            </b>{" "}
            for @{r.customer} · {r.code}
            {r.note ? ` · “${r.note}”` : ""}
          </span>
          <span className="row" style={{ gap: 4 }}>
            {r.status === "requested" ? (
              <>
                <button type="button" className="btn sm go" onClick={() => void act(r.id, "confirm")}>
                  Hold it
                </button>
                <button type="button" className="btn sm quiet" onClick={() => void act(r.id, "decline")}>
                  Can't
                </button>
              </>
            ) : (
              <button type="button" className="btn sm go" onClick={() => void act(r.id, "collected")}>
                Collected
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
