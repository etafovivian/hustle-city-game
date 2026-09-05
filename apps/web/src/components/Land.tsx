// Land for sale: tap a dashed plot on the map (or pick one from the list) to see its size, road and price,
// share it, or say you want it. Ownership opens later; the owner contacts interested players first.
import { MAX_PLOTS, PRIME_AREAS, VENUES_BY_KEY, businessArt, categoryLabel, landPrice, plotSquareMetres, type LandInterestView, type LandRoad, type MapBusiness, type MyBusiness } from "@hc/shared";
import { BadgeCheck, Check, Heart, Home as HomeIcon, LandPlot, MapPinned, MessageCircle, Share2, Store, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, formatCoins, formatNaira } from "../api.js";
import { FOR_SALE, VENUE_SPOTS, type LandPlot as Plot } from "./cityLayout.js";
import { DealList } from "./Deals.js";
import { HousePicker } from "./Home.js";
import { OpenNow } from "./BusinessHours.js";
import { track } from "./Dashboard.js";

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

export function LandCard({
  plotId,
  onClose,
  notify,
  onList,
  onBuilt,
  ownedCount = 0,
  onBought,
}: {
  plotId: string;
  onClose: () => void;
  notify: (m: string) => void;
  onList: () => void;
  onBuilt?: () => void;
  /** Plots the player owns already (there's a limit). */
  ownedCount?: number;
  onBought?: () => void;
}) {
  const [buying, setBuying] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const buyWith = async (design?: string) => {
    setBuyBusy(true);
    try {
      await api("POST", `/api/land/${encodeURIComponent(plotId)}/buy`, design ? { design } : {});
      notify(design ? "Congratulations, landlord! Your house is going up." : "The land is yours! Tap it any time to build.");
      onBought?.();
      onClose();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBuyBusy(false);
    }
  };
  const [mine, setMine] = useState<MyBusiness[]>([]);
  useEffect(() => {
    api<MyBusiness[]>("GET", "/api/businesses/mine")
      .then((b) => setMine(b.filter((x) => x.status === "published")))
      .catch(() => undefined);
  }, []);
  const build = async (b: MyBusiness) => {
    try {
      await api("PUT", `/api/businesses/${b.id}/plot`, { plotId });
      notify(`${b.name} is on the map!`);
      onBuilt?.();
      onClose();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const plot = FOR_SALE.find((p) => p.id === plotId);
  const [interest, setInterest] = useInterest();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useEscape(onClose, sheet);
  if (!plot) return null;
  const isMine = interest.mine.includes(plot.id);
  const others = (interest.counts[plot.id] ?? 0) - (isMine ? 1 : 0);
  const prime = PRIME_AREAS.includes(plot.area);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api<LandInterestView>(isMine ? "DELETE" : "POST", `/api/land/${encodeURIComponent(plot.id)}/interest`);
      setInterest(next);
      if (!isMine) notify("Noted! We'll contact you first when this plot opens for owners.");
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
          Buy it with City Coins and build your house, or put your real business here.
          {others > 0 && ` ${others} other player${others === 1 ? "" : "s"} also want${others === 1 ? "s" : ""} this plot.`}
        </p>
        {error && <p className="alert small">{error}</p>}
        {ownedCount < MAX_PLOTS ? (
          <div className="land-buy">
            {buying ? (
              <>
                <strong className="small">Pick your house (price shown is land + house):</strong>
                <HousePicker plotId={plotId} onPick={(k) => void buyWith(k)} busy={buyBusy} />
              </>
            ) : (
              <div className="row">
                <button type="button" className="btn go" disabled={buyBusy} onClick={() => void buyWith()}>
                  <LandPlot size={16} aria-hidden="true" /> Buy the land ({formatCoins(plotPrice(plot))})
                </button>
                <button type="button" className="btn" onClick={() => setBuying(true)}>
                  <HomeIcon size={16} aria-hidden="true" /> Buy and build a house
                </button>
              </div>
            )}
            <span className="tiny muted">You own {ownedCount} of {MAX_PLOTS} plots you can have.</span>
          </div>
        ) : (
          <p className="small muted">You own {MAX_PLOTS} plots already, the most for now.</p>
        )}
        {mine.length > 0 && (
          <div className="land-build">
            <strong className="small">Got a real business? Put it here for free.</strong>
            <div className="row">
              {mine.map((b) => (
                <button key={b.id} type="button" className="btn go sm" onClick={() => void build(b)}>
                  <Store size={15} aria-hidden="true" /> Build {b.name} here
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="row">
          <button type="button" className={`btn ${isMine ? "" : "go"}`} disabled={busy} onClick={() => void toggle()}>
            {isMine ? <Check size={16} aria-hidden="true" /> : <Heart size={16} aria-hidden="true" />} {isMine ? "You're on the list" : "I want this plot"}
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

export function LandList({ onClose, onPick, taken }: { onClose: () => void; onPick: (p: Plot) => void; taken?: Set<string> }) {
  const [interest] = useInterest();
  const sheet = useRef<HTMLDivElement>(null);
  useEscape(onClose, sheet);
  const areas = useMemo(() => {
    const by = new Map<string, Plot[]>();
    for (const p of FOR_SALE) if (!taken?.has(p.id)) by.set(p.area, [...(by.get(p.area) ?? []), p]);
    const rank = (a: string) => (PRIME_AREAS.includes(a) ? PRIME_AREAS.indexOf(a) : 10);
    return [...by.entries()]
      .map(([area, plots]) => ({ area, plots: plots.sort((a, b) => plotPrice(b) - plotPrice(a)) }))
      .sort((a, b) => rank(a.area) - rank(b.area) || b.plots.length - a.plots.length);
  }, []);
  const [open, setOpen] = useState("__best");
  // Best picks: prime area, a busy frontage, and places to enjoy within a short walk.
  const best = useMemo(() => {
    const roadScore: Record<string, number> = { arterial: 25, collector: 18, local: 10, alley: 4 };
    return FOR_SALE.filter((p) => !taken?.has(p.id))
      .map((p) => {
        const near = VENUE_SPOTS.filter((v) => Math.hypot(v.x - p.x, v.y - p.y) < 1400)
          .map((v) => VENUES_BY_KEY.get(v.key))
          .filter((v): v is NonNullable<typeof v> => !!v);
        const score = (PRIME_AREAS.includes(p.area) ? 35 : 0) + (roadScore[p.road] ?? 0) + near.length * 8;
        return { p, near, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [taken]);

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
          <button type="button" role="tab" className="chip" aria-selected={open === "__best"} aria-pressed={open === "__best"} onClick={() => setOpen("__best")}>
            ⭐ Best picks
          </button>
          {areas.map(({ area, plots }) => (
            <button key={area} type="button" role="tab" className="chip" aria-selected={open === area} aria-pressed={open === area} onClick={() => setOpen(area)}>
              {area} · {plots.length}
            </button>
          ))}
        </div>
        {open === "__best" && (
          <ul className="land-rows">
            {best.map(({ p, near, score }) => (
              <li key={p.id}>
                <span>
                  <strong>
                    {p.area} · Plot {plotNo(p)} <span className="tiny muted">score {score}</span>
                  </strong>
                  <span className="tiny muted">
                    {plotSquareMetres(p.hh).toLocaleString()} m² · {ROAD_LABEL[p.road as LandRoad]}
                    {near.length ? ` · Near ${near.slice(0, 3).map((v) => v.name).join(", ")}` : ""}
                  </span>
                </span>
                <span className="land-price">{formatCoins(plotPrice(p))}</span>
                <button type="button" className="btn sm" onClick={() => onPick(p)}>
                  Show
                </button>
              </li>
            ))}
          </ul>
        )}
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

/** A real business's building on the map: what it is, what it sells, and how to reach it. */
export function BusinessCard({ biz, onClose, onGo, onQuote, notify }: { biz: MapBusiness; onClose: () => void; onGo: () => void; onQuote: () => void; notify?: (m: string) => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  useEscape(onClose, sheet);
  useEffect(() => track(biz.businessId, "card_open"), [biz.businessId]);
  const wa = biz.contactPhone ? `https://wa.me/${biz.contactPhone.replace(/^\+/, "").replace(/^0/, "234")}` : null;
  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet land-card" role="dialog" aria-modal="true" aria-label={biz.name} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <img className="biz-art" src={businessArt(biz.category)} alt="" />
          <div>
            <h2>
              {biz.name}
              {biz.verified && (
                <span className="verified-tag">
                  <BadgeCheck size={13} aria-hidden="true" /> Verified
                </span>
              )}
            </h2>
            <span className="small muted">
              Real {biz.kind === "retail" ? "shop" : "workshop"} · {categoryLabel(biz.category)} · {biz.serviceArea}
            </span>
          </div>
        </div>
        <p>{biz.description}</p>
        <OpenNow hours={biz.hours} />
        {biz.reviews > 0 && (
          <div className="stack" style={{ gap: 2 }}>
            <span className="small">
              <span className="stars-static" aria-label={`${biz.rating} out of 5`}>
                {"★".repeat(Math.round(biz.rating ?? 0))}
                {"☆".repeat(5 - Math.round(biz.rating ?? 0))}
              </span>{" "}
              {biz.rating} · {biz.reviews} review{biz.reviews > 1 ? "s" : ""} from real customers
            </span>
            {biz.recent.map((r, i) => (
              <span key={i} className="tiny muted">
                “{r.body}” · {r.rating}★
              </span>
            ))}
          </div>
        )}
        {biz.pickupAddress && (
          <p className="small">
            <MapPinned size={14} aria-hidden="true" /> {biz.pickupAddress}
          </p>
        )}
        {biz.products.length > 0 && (
          <ul className="land-rows">
            {biz.products.map((p) => (
              <li key={p.name}>
                <span>{p.name}</span>
                <span className="land-price">{biz.kind === "artisan" ? "from " : ""}{formatNaira(p.priceKobo)}</span>
                <span />
              </li>
            ))}
          </ul>
        )}
        <DealList businessId={biz.businessId} notify={notify} />
        <p className="tiny muted">A real Lagos business on Hustle City. Prices are theirs; you pay them directly.</p>
        <div className="row">
          {wa && (
            <a className="btn go" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track(biz.businessId, "whatsapp")}>
              <MessageCircle size={16} aria-hidden="true" /> WhatsApp them
            </a>
          )}
          {biz.kind === "artisan" && (
            <button type="button" className="btn" onClick={onQuote}>
              Request a quote
            </button>
          )}
          <button
            type="button"
            className="btn quiet"
            onClick={() => {
              track(biz.businessId, "directions");
              onGo();
            }}
          >
            Go there
          </button>
        </div>
      </div>
    </div>
  );
}
