// Rent (see @hc/shared rent.ts): find a flat to rent from the face-me room, your tenancy, and letting out a house.
import { RENT_AREA, RENT_TERMS, RENT_UNITS, moveInCost, type HomeView, type OwnedPlot, type RentalView } from "@hc/shared";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { api, formatCoins } from "../api.js";
import { LAND } from "./cityLayout.js";

const date = (iso: string) => new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));

/** Flats to rent, by area: pick a place and a size, see the move-in cost, move in. */
export function RentPicker({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const areas = Object.keys(RENT_AREA).filter((a) => LAND.some((p) => p.area === a && p.use === "home"));
  const [area, setArea] = useState(areas.includes("Junction 101") ? "Junction 101" : areas[0]!);
  const [busy, setBusy] = useState<string | null>(null);
  const take = async (unit: string) => {
    // The flat is in one of the area's residential buildings.
    const homes = LAND.filter((p) => p.area === area && p.use === "home");
    const plot = homes[Math.floor(Math.random() * homes.length)]!;
    setBusy(unit);
    try {
      const r = await api<{ cost: { total: number } }>("POST", "/api/game/rent", { unit, area, plotId: plot.id });
      notify(`You've moved in! ${formatCoins(r.cost.total)} coins paid (rent, agent and caution).`);
      onChanged();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="stack rent-picker">
      <strong className="small row" style={{ gap: 6 }}>
        <KeyRound size={15} aria-hidden="true" /> Rent a flat
      </strong>
      <span className="tiny muted">
        Lagos style: {RENT_TERMS.weeksUpFront} weeks up front, {Math.round(RENT_TERMS.agentFee * 100)}% agent's fee and a week's caution (you get it back when you move out properly). Then rent every week; {RENT_TERMS.graceWeeks} weeks behind and the landlord changes the locks.
      </span>
      <label className="small row" style={{ gap: 6 }}>
        Area
        <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <ul className="ride-list">
        {RENT_UNITS.map((u) => {
          const c = moveInCost(u.key, area);
          return (
            <li key={u.key}>
              <button type="button" className="ride-option" disabled={busy !== null} onClick={() => void take(u.key)}>
                <span className="ride-text">
                  <strong>{u.label}</strong>
                  <span className="tiny muted">{u.note}</span>
                </span>
                <span className="ride-meta">
                  <span className="ride-fare">{formatCoins(c.weekly)}/wk</span>
                  <span className="tiny muted">Move in: {formatCoins(c.total)}</span>
                </span>
                {busy === u.key && <span className="tiny">…</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Your tenancy: what you pay, until when, and moving out. */
export function Tenancy({ rental, notify, onChanged }: { rental: RentalView; notify: (m: string) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const unit = RENT_UNITS.find((u) => u.key === rental.unit);
  const leave = async () => {
    if (!window.confirm(rental.owing ? "You're behind on rent, so you won't get your caution back. Move out?" : `Move out? You'll get your ${formatCoins(rental.caution)} caution back.`)) return;
    setBusy(true);
    try {
      const r = await api<{ refund: number }>("POST", "/api/game/rent/leave");
      notify(r.refund ? `Moved out. ${formatCoins(r.refund)} caution refunded.` : "Moved out.");
      onChanged();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`quote-card tenancy ${rental.owing ? "owing" : ""}`}>
      <strong className="small">
        🔑 Rented {unit?.label.toLowerCase()} · {rental.area}
      </strong>
      <span className="tiny muted">
        {formatCoins(rental.weekly)} a week, taken from your coins when due · paid until {date(rental.paidUntil)}
        {rental.owing ? ` · ⚠️ ${rental.owing} week${rental.owing > 1 ? "s" : ""} behind: top up your coins or you'll be evicted` : ""}
      </span>
      <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} disabled={busy} onClick={() => void leave()}>
        Move out
      </button>
    </div>
  );
}

/** Letting out a house you own (not your home): tenants pay weekly; collect what's built up. */
export function LetBox({ plot, notify, onChanged }: { plot: OwnedPlot; notify: (m: string) => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const call = async (path: string, body?: unknown) => {
    setBusy(true);
    try {
      const r = await api<{ collected: number; home: HomeView }>("POST", `/api/plots/${encodeURIComponent(plot.plotId)}/${path}`, body);
      if (r.collected) notify(`Rent collected: +${formatCoins(r.collected)} coins`);
      else if (path === "let") notify((body as { on: boolean }).on ? "Let out! Tenants pay weekly; collect it here." : "Your tenants have moved out.");
      onChanged();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!plot.let)
    return (
      <button type="button" className="btn" disabled={busy} onClick={() => void call("let", { on: true })}>
        <KeyRound size={16} aria-hidden="true" /> Let it out to tenants
      </button>
    );
  return (
    <div className="quote-card">
      <strong className="small">🔑 Let out · {formatCoins(plot.let.weekly)} a week</strong>
      <span className="tiny muted">Rent builds up for up to four weeks; collect it before then.</span>
      <div className="row">
        <button type="button" className="btn sm go" disabled={busy || plot.let.due <= 0} onClick={() => void call("collect")}>
          Collect {formatCoins(plot.let.due)}
        </button>
        <button type="button" className="btn sm quiet" disabled={busy} onClick={() => void call("let", { on: false })}>
          End the tenancy
        </button>
      </div>
    </div>
  );
}
