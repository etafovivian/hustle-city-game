// The home button with more than one house: pick which one to go to (the one you pick becomes home).
import { HOUSE_BY_KEY, type OwnedPlot } from "@hc/shared";
import { Home as HomeIcon, X } from "lucide-react";
import { useEffect } from "react";
import { FOR_SALE } from "./cityLayout.js";

export function HousePick({ houses, from, onPick, onClose }: { houses: OwnedPlot[]; from: { x: number; y: number }; onPick: (h: OwnedPlot) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows = houses
    .map((h) => ({ h, plot: FOR_SALE.find((p) => p.id === h.plotId) }))
    .filter((r) => r.plot)
    .sort((a, b) => Number(b.h.isHome) - Number(a.h.isHome) || Math.hypot(a.plot!.x - from.x, a.plot!.y - from.y) - Math.hypot(b.plot!.x - from.x, b.plot!.y - from.y));
  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div className="visit-sheet ride-sheet" role="dialog" aria-modal="true" aria-label="Which house?" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Which house?</h2>
          <span className="small muted">The one you go to becomes your home (your things come with you).</span>
        </div>
        <ul className="ride-list">
          {rows.map(({ h, plot }) => {
            const house = HOUSE_BY_KEY.get(h.design ?? "");
            const km = (Math.hypot(plot!.x - from.x, plot!.y - from.y) / 1000).toFixed(1);
            return (
              <li key={h.plotId}>
                <button type="button" className="ride-option" onClick={() => onPick(h)}>
                  <span className="ride-art" aria-hidden="true">
                    {house ? <img src={`/art/buildings/${house.art}.webp`} alt="" /> : <HomeIcon size={28} />}
                  </span>
                  <span className="ride-text">
                    <strong>{house?.label ?? "House"}</strong>
                    <span className="tiny muted">
                      {plot!.area} · {km} km{h.isHome ? " · home now" : ""}
                    </span>
                  </span>
                  <span className="small">Go</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
