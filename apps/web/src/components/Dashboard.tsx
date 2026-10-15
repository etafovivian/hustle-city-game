// Phone → Business → Dashboard: what players did with your business (last 7 or 30 days), your deals and quotes.
import { BUSINESS_EVENTS, BUSINESS_EVENT_LABEL, type BusinessDashboard } from "@hc/shared";
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";

/** Count one thing a player did with a business (fire and forget). */
export const track = (businessId: string, kind: (typeof BUSINESS_EVENTS)[number]) =>
  void api("POST", `/api/businesses/${businessId}/track`, { kind }).catch(() => undefined);

export function Dashboard({ businessId }: { businessId: string }) {
  const [days, setDays] = useState(7);
  const [d, setD] = useState<BusinessDashboard | null>(null);
  useEffect(() => {
    api<BusinessDashboard>("GET", `/api/businesses/${businessId}/dashboard?days=${days}`)
      .then(setD)
      .catch(() => undefined);
  }, [businessId, days]);
  if (!d) return <p className="tiny muted">Loading your numbers…</p>;
  const daily = d.daily.map((x) => x.card_open + x.search_view + x.whatsapp + x.directions);
  const max = Math.max(1, ...daily);
  return (
    <div className="dash">
      <div className="row spread">
        <strong className="small row" style={{ gap: 6 }}>
          <BarChart3 size={15} aria-hidden="true" /> Dashboard
        </strong>
        <div className="row" style={{ gap: 4 }}>
          {[7, 30].map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={days === n} onClick={() => setDays(n)}>
              {n} days
            </button>
          ))}
        </div>
      </div>
      <div className="dash-grid">
        {BUSINESS_EVENTS.map((k) => (
          <div key={k} className="dash-stat">
            <span className="dash-num">{d.totals[k]}</span>
            <span className="tiny muted">{BUSINESS_EVENT_LABEL[k]}</span>
          </div>
        ))}
        <div className="dash-stat">
          <span className="dash-num">{d.deals.reduce((n, x) => n + x.redeemed, 0)}</span>
          <span className="tiny muted">Deals used at your counter</span>
        </div>
        <div className="dash-stat">
          <span className="dash-num">{d.quotes.total}</span>
          <span className="tiny muted">Quote requests ({d.quotes.open} open)</span>
        </div>
      </div>
      <div className="dash-bars" aria-label="People reached each day">
        {daily.map((v, i) => (
          <span key={d.daily[i]!.day} title={`${d.daily[i]!.day}: ${v}`} style={{ height: `${(v / max) * 100}%` }} />
        ))}
      </div>
      <span className="tiny muted">People reached each day. {d.onMap ? "" : "Tip: put your business on a map plot (free) so players walk past it."}{d.verified ? "" : " Verified businesses show first in search."}</span>
    </div>
  );
}
