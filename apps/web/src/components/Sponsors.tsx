// Sponsored places: "Presented by …" on a place's card (counted on the business's dashboard), and the admin form.
import { VENUES, type SponsorView } from "@hc/shared";
import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { track } from "./Dashboard.js";

let cache: { at: number; list: SponsorView[] } | null = null;
async function sponsors(): Promise<SponsorView[]> {
  if (cache && Date.now() - cache.at < 120_000) return cache.list;
  const list = await api<SponsorView[]>("GET", "/api/sponsors").catch(() => []);
  cache = { at: Date.now(), list };
  return list;
}

export function SponsorBanner({ venue }: { venue: string }) {
  const [s, setS] = useState<SponsorView | null>(null);
  useEffect(() => {
    let live = true;
    void sponsors().then((list) => {
      const found = list.find((x) => x.venue === venue) ?? null;
      if (!live) return;
      setS(found);
      if (found) track(found.businessId, "sponsor_view");
    });
    return () => {
      live = false;
    };
  }, [venue]);
  if (!s) return null;
  return (
    <div className="sponsor-banner">
      <span className="tiny muted">Presented by</span>
      <strong>{s.businessName}</strong>
      {s.tagline && <span className="small">{s.tagline}</span>}
      {s.onMap && (
        <button type="button" className="btn sm" onClick={() => window.dispatchEvent(new CustomEvent("hc:open-business", { detail: s.businessId }))}>
          {s.deals ? `See their ${s.deals} deal${s.deals > 1 ? "s" : ""}` : "Visit them"}
        </button>
      )}
    </div>
  );
}

/** Admin: put a live business on a place for some days. */
export function AdminSponsors({ notify }: { notify: (m: string) => void }) {
  const [list, setList] = useState<SponsorView[]>([]);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [venue, setVenue] = useState(VENUES[0]!.key);
  const [businessId, setBusinessId] = useState("");
  const [tagline, setTagline] = useState("");
  const [days, setDays] = useState(30);
  useEffect(() => {
    api<SponsorView[]>("GET", "/api/admin/sponsors")
      .then(setList)
      .catch(() => undefined);
    api<{ id: string; name: string }[]>("GET", "/api/admin/businesses?status=published")
      .then((b) => {
        setBusinesses(b);
        setBusinessId((x) => x || b[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);
  const save = async () => {
    try {
      setList(await api<SponsorView[]>("POST", "/api/admin/sponsors", { venue, businessId, tagline, days }));
      cache = null;
      notify("Sponsor set");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const end = async (v: string) => {
    setList(await api<SponsorView[]>("POST", `/api/admin/sponsors/${v}/end`));
    cache = null;
  };
  return (
    <div className="stack">
      <h2 style={{ fontSize: 20 }}>
        <Megaphone size={18} aria-hidden="true" /> Sponsored places
      </h2>
      {list.map((s) => (
        <div key={s.venue} className="table-row">
          <span className="small">
            {VENUES.find((v) => v.key === s.venue)?.name}: <b>{s.businessName}</b> until {new Date(s.endsAt).toLocaleDateString("en-NG")}
          </span>
          <button type="button" className="btn sm quiet" onClick={() => void end(s.venue)}>
            End
          </button>
        </div>
      ))}
      <select className="input" value={venue} onChange={(e) => setVenue(e.target.value)} aria-label="Place">
        {VENUES.map((v) => (
          <option key={v.key} value={v.key}>
            {v.icon} {v.name}
          </option>
        ))}
      </select>
      <select className="input" value={businessId} onChange={(e) => setBusinessId(e.target.value)} aria-label="Business">
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <input className="input" value={tagline} maxLength={80} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline (e.g. Fresh suya every evening)" aria-label="Tagline" />
      <label className="small row" style={{ gap: 6 }}>
        Days
        <input className="input" type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} />
      </label>
      <button type="button" className="btn go" disabled={!businessId} onClick={() => void save()}>
        Set sponsor
      </button>
    </div>
  );
}
