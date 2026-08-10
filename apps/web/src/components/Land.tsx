// Land for sale: tap a dashed plot on the map (or pick one from the list) to see its size, road and price,
// share it, or say you want it. Ownership opens later; the owner contacts interested players first.
import { PRIME_AREAS, landPrice, plotSquareMetres, type LandInterestView, type LandRoad } from "@hc/shared";
import { Check, Heart, LandPlot, MapPinned, Share2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, formatCoins } from "../api.js";
import { FOR_SALE, type LandPlot as Plot } from "./cityLayout.js";

const ROAD_LABEL: Record<LandRoad, string> = {
  arterial: "On the main road",
  collector: "On a busy street",
  local: "On a quiet street",
  alley: "In a close",
};

export const plotPrice = (p: Plot) => landPrice(p.area, p.road as LandRoad, p.hh);
/** Short plot number within its area ("Plot 7"), stable because the map is generated the same every visit. */
const plotNo = (p: Plot) => FOR_SALE.filter((q) => q.area === p.area).indexOf(p) + 1;

/** Link that opens the map on this plot. */
const plotLink = (p: Plot) => `${window.location.origin}/?at=${Math.round(p.x)},${Math.round(p.y)}&plot=${encodeURIComponent(p.id)}`;

function useInterest() {
  const [state, setState] = useState<LandInterestView>({ counts: {}, mine: [] });
  useEffect(() => {
    api<LandInterestView>("GET", "/api/land/interest")
      .then(setState)
      .catch(() => undefined);
  }, []);
  return [state, setState] as const;
}

function useEscape(onClose: () => void, focus: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    focus.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, focus]);
}

export function LandCard({ plotId, onClose, notify, onList }: { plotId: string; onClose: () => void; notify: (m: string) => void; onList: () => void }) {
  const plot = FOR_SALE.find((p) => p.id === plotId);
  const [interest, setInterest] = useInterest();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useEscape(onClose, sheet);
  if (!plot) return null;
  const mine = interest.mine.includes(plot.id);
  const others = (interest.counts[plot.id] ?? 0) - (mine ? 1 : 0);
  const prime = PRIME_AREAS.includes(plot.area);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api<LandInterestView>(mine ? "DELETE" : "POST", `/api/land/${encodeURIComponent(plot.id)}/interest`);
      setInterest(next);
      if (!mine) notify("Noted! We'll contact you first when this plot opens for owners.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    const url = plotLink(plot);
    const text = `Plot for sale in ${plot.area}, Naija Hustle City: ${plotSquareMetres(plot.hh)} m² for ${formatCoins(plotPrice(plot))} coins`;
    try {
      if (navigator.share) await navigator.share({ title: "Land for sale", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        notify("Link copied");
      }
    } catch {
      /* closed the share sheet */
    }
  };

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet land-card" role="dialog" aria-modal="true" aria-label={`Plot in ${plot.area}`} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <span className="venue-icon land-icon" aria-hidden="true">
            <LandPlot size={26} />
          </span>
          <div>
            <h2>
              Land for sale{prime && <span className="prime-tag">Prime</span>}
            </h2>
            <span className="small muted">
              {plot.area} · Plot {plotNo(plot)}
            </span>
          </div>
        </div>
        <dl className="land-facts">
          <div>
            <dt>Size</dt>
            <dd>{plotSquareMetres(plot.hh).toLocaleString()} m²</dd>
          </div>
          <div>
            <dt>Frontage</dt>
            <dd>{ROAD_LABEL[plot.road as LandRoad]}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd className="land-price">{formatCoins(plotPrice(plot))} coins</dd>
          </div>
        </dl>
        <p className="small muted">
          Build a shop, a home or rent it out. Ownership opens soon: say you want it and you're first in line.
          {others > 0 && ` ${others} other player${others === 1 ? "" : "s"} also want${others === 1 ? "s" : ""} this plot.`}
        </p>
        {error && <p className="alert small">{error}</p>}
        <div className="row">
          <button type="button" className={`btn ${mine ? "" : "go"}`} disabled={busy} onClick={() => void toggle()}>
            {mine ? <Check size={16} aria-hidden="true" /> : <Heart size={16} aria-hidden="true" />} {mine ? "You're on the list" : "I want this plot"}
          </button>
          <button type="button" className="btn" onClick={() => void share()}>
            <Share2 size={16} aria-hidden="true" /> Share
          </button>
          <button type="button" className="btn quiet" onClick={onList}>
            <MapPinned size={16} aria-hidden="true" /> All land for sale
          </button>
        </div>
      </div>
    </div>
  );
}

export function LandList({ onClose, onPick }: { onClose: () => void; onPick: (p: Plot) => void }) {
  const [interest] = useInterest();
  const sheet = useRef<HTMLDivElement>(null);
  useEscape(onClose, sheet);
  const areas = useMemo(() => {
    const by = new Map<string, Plot[]>();
    for (const p of FOR_SALE) by.set(p.area, [...(by.get(p.area) ?? []), p]);
    const rank = (a: string) => (PRIME_AREAS.includes(a) ? PRIME_AREAS.indexOf(a) : 10);
    return [...by.entries()]
      .map(([area, plots]) => ({ area, plots: plots.sort((a, b) => plotPrice(b) - plotPrice(a)) }))
      .sort((a, b) => rank(a.area) - rank(b.area) || b.plots.length - a.plots.length);
  }, []);
  const [open, setOpen] = useState(areas[0]?.area ?? "");

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet land-list" role="dialog" aria-modal="true" aria-label="Land for sale" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="visit-head">
          <h2>Land for sale</h2>
          <span className="small muted">
            {FOR_SALE.length} plots across the city. Island Heights and Lekki first: that's where the money is.
          </span>
        </div>
        <div className="chips" role="tablist" aria-label="Areas">
          {areas.map(({ area, plots }) => (
            <button key={area} type="button" role="tab" className="chip" aria-selected={open === area} aria-pressed={open === area} onClick={() => setOpen(area)}>
              {area} · {plots.length}
            </button>
          ))}
        </div>
        <ul className="land-rows">
          {areas
            .find((a) => a.area === open)
            ?.plots.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>Plot {plotNo(p)}</strong>
                  <span className="tiny muted">
                    {plotSquareMetres(p.hh).toLocaleString()} m² · {ROAD_LABEL[p.road as LandRoad]}
                    {interest.counts[p.id] ? ` · ${interest.counts[p.id]} interested` : ""}
                  </span>
                </span>
                <span className="land-price">{formatCoins(plotPrice(p))}</span>
                <button type="button" className="btn sm" onClick={() => onPick(p)}>
                  Show
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
