// Deals: discounts real businesses honour. Players get a one-time code here and show it at the shop; the business
// types it in (Phone → Business) to mark it used, and the player earns a small reward. No cash or airtime.
import { DEAL_LIMITS, DEAL_REWARD, type DealView, type MyDealCode, type OwnerDeal, type RedeemResult } from "@hc/shared";
import { AlertCircle, CheckCircle2, Clock, Copy, Plus, Tag, Ticket } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api.js";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

/** A business's live deals with a "Get code" button (on its map card and in Find a business). */
export function DealList({ businessId, signedIn = true, notify }: { businessId: string; signedIn?: boolean; notify?: (m: string) => void }) {
  const [items, setItems] = useState<DealView[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    api<DealView[]>("GET", `/api/deals?businessId=${businessId}`)
      .then(setItems)
      .catch(() => undefined);
  useEffect(() => {
    void load();
  }, [businessId]);
  if (!items.length) return null;

  const claim = async (d: DealView) => {
    setBusy(d.id);
    setError(null);
    try {
      await api("POST", `/api/deals/${d.id}/claim`);
      notify?.("Code saved in Phone → Deals");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="deal-list">
      {items.map((d) => (
        <div key={d.id} className="deal">
          <span className="deal-icon" aria-hidden="true">
            <Tag size={18} />
          </span>
          <span className="deal-text">
            <strong>{d.title}</strong>
            {d.terms && <span className="tiny muted">{d.terms}</span>}
            <span className="tiny muted">
              Until {shortDate(d.endsAt)} · {d.left} code{d.left === 1 ? "" : "s"} left · +{DEAL_REWARD.coins} coins when you use it
            </span>
          </span>
          {d.myCode ? (
            <span className={`deal-code ${d.myCode.redeemed ? "used" : ""}`}>{d.myCode.redeemed ? "Used" : d.myCode.code}</span>
          ) : signedIn ? (
            <button type="button" className="btn sm go" disabled={busy !== null || d.left === 0} onClick={() => void claim(d)}>
              {d.left === 0 ? "All gone" : busy === d.id ? "…" : "Get code"}
            </button>
          ) : (
            <span className="tiny muted">Sign in to get a code</span>
          )}
        </div>
      ))}
      {error && <p className="alert small">{error}</p>}
    </div>
  );
}

/** Phone → Deals: the player's codes. */
export function MyDeals() {
  const [items, setItems] = useState<MyDealCode[] | null>(null);
  useEffect(() => {
    api<MyDealCode[]>("GET", "/api/deals/mine")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  if (!items) return <p className="muted small">Loading…</p>;
  const now = Date.now();
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>Your deals</h2>
        <p className="small muted">Show the code at the shop. When they mark it used you get {DEAL_REWARD.coins} coins and {DEAL_REWARD.xp} XP (up to 3 deals a day).</p>
      </div>
      {!items.length && <p className="small muted">No codes yet. Look for the green tag on real businesses around the city.</p>}
      {items.map((c) => {
        const expired = !c.redeemedAt && new Date(c.expiresAt).getTime() < now;
        return (
          <div key={c.code} className="quote-card">
            <strong>{c.title}</strong>
            <span className="tiny muted">
              {c.businessName}
              {c.pickupAddress ? ` · ${c.pickupAddress}` : ""}
            </span>
            {c.terms && <span className="tiny muted">{c.terms}</span>}
            <span className="row" style={{ gap: 8 }}>
              <span className={`deal-code big ${c.redeemedAt || expired ? "used" : ""}`}>{c.code}</span>
              {!c.redeemedAt && !expired && (
                <button type="button" className="btn sm quiet" aria-label="Copy code" onClick={() => void navigator.clipboard?.writeText(c.code)}>
                  <Copy size={14} aria-hidden="true" />
                </button>
              )}
            </span>
            <span className="tiny">
              {c.redeemedAt ? (
                <>
                  <CheckCircle2 size={13} aria-hidden="true" /> Used {shortDate(c.redeemedAt)}
                </>
              ) : expired ? (
                "Expired"
              ) : (
                <>
                  <Clock size={13} aria-hidden="true" /> Use by {shortDate(c.expiresAt)}
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Phone → Business: a live business's deals, a new-deal form and the counter (redeem a code). */
export function OwnerDeals({ businessId, verified, notify }: { businessId: string; verified: boolean; notify: (m: string) => void }) {
  const [items, setItems] = useState<OwnerDeal[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [days, setDays] = useState(14);
  const [maxClaims, setMaxClaims] = useState("50");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    api<OwnerDeal[]>("GET", `/api/businesses/${businessId}/deals`)
      .then(setItems)
      .catch(() => undefined);
  useEffect(() => {
    void load();
  }, [businessId]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<{ status: string }>("POST", `/api/businesses/${businessId}/deals`, { title, terms, days, maxClaims: Number(maxClaims) || 1 });
      notify(r.status === "live" ? "Deal is live" : "Deal sent for review");
      setAdding(false);
      setTitle("");
      setTerms("");
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const redeem = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<RedeemResult>("POST", `/api/businesses/${businessId}/redeem`, { code });
      notify(`✓ ${r.title} for @${r.nickname}`);
      setCode("");
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const end = async (id: string) => {
    await api("POST", `/api/businesses/${businessId}/deals/${id}/end`).catch(() => undefined);
    void load();
  };
  const live = items.filter((d) => d.status === "live" || d.status === "pending_review");

  return (
    <div className="stack owner-deals">
      <strong className="small row" style={{ gap: 6 }}>
        <Ticket size={15} aria-hidden="true" /> Deals
      </strong>
      <form className="row" onSubmit={(e) => void redeem(e)}>
        <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Customer's code, e.g. HC-7KQ2PD" aria-label="Customer's deal code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
        <button type="submit" className="btn sm go" disabled={!code.trim()}>
          Mark used
        </button>
      </form>
      {items.map((d) => (
        <div key={d.id} className="deal">
          <span className="deal-text">
            <strong>{d.title}</strong>
            <span className="tiny muted">
              {d.status === "pending_review" ? "Waiting for review" : d.status === "live" ? `Live until ${shortDate(d.endsAt)}` : d.status === "rejected" ? `Not approved${d.reviewNote ? `: ${d.reviewNote}` : ""}` : "Ended"} · {d.claimed}/{d.maxClaims} claimed · {d.redeemed} used
            </span>
          </span>
          {(d.status === "live" || d.status === "pending_review") && (
            <button type="button" className="btn sm quiet" onClick={() => void end(d.id)}>
              End
            </button>
          )}
        </div>
      ))}
      {adding ? (
        <form className="stack req-form" onSubmit={(e) => void create(e)}>
          <label className="field">
            <span className="field-label">The deal</span>
            <input className="input" required minLength={DEAL_LIMITS.titleMin} maxLength={DEAL_LIMITS.titleMax} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10% off any bag of rice" />
          </label>
          <label className="field">
            <span className="field-label">Terms (optional)</span>
            <input className="input" maxLength={DEAL_LIMITS.termsMax} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="e.g. One per customer, weekdays only" />
          </label>
          <div className="row">
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Runs for</span>
              <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[7, 14, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Codes</span>
              <input className="input num" inputMode="numeric" value={maxClaims} onChange={(e) => setMaxClaims(e.target.value.replace(/[^\d]/g, ""))} />
            </label>
          </div>
          <p className="tiny muted">
            You honour the deal at your shop. {verified ? "Verified businesses' deals go live at once." : "A moderator checks it before it goes live."} Players earn a small reward from us when you mark their code used.
          </p>
          <div className="row">
            <button type="submit" className="btn primary">
              {verified ? "Publish deal" : "Send for review"}
            </button>
            <button type="button" className="btn quiet" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        live.length < DEAL_LIMITS.perBusiness && (
          <button type="button" className="btn sm" style={{ justifySelf: "start" }} onClick={() => setAdding(true)}>
            <Plus size={15} aria-hidden="true" /> New deal
          </button>
        )
      )}
      {error && (
        <p className="alert small" role="alert">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

interface PendingDeal {
  id: string;
  businessName: string;
  title: string;
  terms: string;
  endsAt: string;
  maxClaims: number;
}

/** Admin: deals from businesses that aren't verified yet. */
export function AdminDeals({ notify }: { notify: (m: string) => void }) {
  const [items, setItems] = useState<PendingDeal[] | null>(null);
  const load = () =>
    api<PendingDeal[]>("GET", "/api/admin/deals")
      .then(setItems)
      .catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, []);
  const decide = async (id: string, decision: "approve" | "reject") => {
    await api("POST", `/api/admin/deals/${id}/review`, { decision }).catch((e: Error) => notify(e.message));
    notify(decision === "approve" ? "Deal approved" : "Deal rejected");
    void load();
  };
  if (!items) return null;
  return (
    <div className="stack">
      {!items.length && <p className="small muted">No deals waiting.</p>}
      {items.map((d) => (
        <div key={d.id} className="quote-card">
          <strong>{d.title}</strong>
          <span className="tiny muted">
            {d.businessName} · until {shortDate(d.endsAt)} · {d.maxClaims} codes
          </span>
          {d.terms && <span className="small">{d.terms}</span>}
          <div className="row">
            <button type="button" className="btn primary" onClick={() => void decide(d.id, "approve")}>
              Approve
            </button>
            <button type="button" className="btn quiet" onClick={() => void decide(d.id, "reject")}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
