// Gadget Village's counter: buy a better phone or accessories at the tag price or by haggling, and fix a cracked screen.
import { BASIC_PHONE, GADGETS, GADGET_BY_KEY, SELF_REPAIR_LEVEL, cannotBuy, phoneOf, type GadgetHaggleResult, type GadgetsView } from "@hc/shared";
import { Handshake, Smartphone, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";

export function GadgetCounter({ notify, onChanged, open }: { notify: (m: string) => void; onChanged: () => void; open: boolean }) {
  const [view, setView] = useState<GadgetsView | null>(null);
  const [pick, setPick] = useState(GADGETS[0]!.key);
  const [offer, setOffer] = useState("");
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<GadgetsView>("GET", "/api/game/gadgets")
      .then(setView)
      .catch(() => undefined);
  }, []);
  const item = GADGET_BY_KEY.get(pick)!;
  useEffect(() => {
    setOffer(String(Math.round((item.price * 0.75) / 50) * 50));
    setLine(null);
  }, [pick]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setLine((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const bought = (paid: number) => {
    notify(`${item.icon} ${item.name} bought for ${formatCoins(paid)} coins`);
    onChanged();
  };
  const buy = () =>
    run(async () => {
      const r = await api<{ view: GadgetsView }>("POST", "/api/game/gadgets/buy", { key: pick });
      setView(r.view);
      setLine(`It's yours. ${item.note}.`);
      bought(item.price);
    });
  const haggle = () =>
    run(async () => {
      const r = await api<GadgetHaggleResult>("POST", "/api/game/gadgets/haggle", { key: pick, offer: Number(offer) });
      if (r.result === "deal") {
        setView(r.view);
        setLine(`Deal! You paid ${formatCoins(r.paid)}${r.saved > 0 ? `, ${formatCoins(r.saved)} under the tag` : ""}.`);
        bought(r.paid);
      } else if (r.result === "counter") {
        setLine(`"${r.line}" (${r.triesLeft} tries left)`);
        setOffer(String(r.counter));
      } else setLine(`"${r.line}" (${r.triesLeft} tries left)`);
    });
  const repair = () =>
    run(async () => {
      const r = await api<{ paid: number; self: boolean; view: GadgetsView }>("POST", "/api/game/gadgets/repair", { requestId: crypto.randomUUID() });
      setView(r.view);
      notify(r.self ? `🔧 You changed the screen yourself: ${formatCoins(r.paid)} coins for the part` : `🔧 New screen fitted for ${formatCoins(r.paid)} coins`);
      onChanged();
    });

  const owned = view?.owned ?? [];
  const phone = phoneOf(owned) ?? BASIC_PHONE;
  const why = cannotBuy(pick, owned);
  return (
    <div className="work-box">
      <strong className="small row" style={{ gap: 6 }}>
        <Smartphone size={15} aria-hidden="true" /> Your phone: {phone.icon} {phone.name}
        {view?.cracked ? " (cracked screen)" : ""}
      </strong>
      {owned.filter((k) => GADGET_BY_KEY.get(k)?.kind === "accessory").length > 0 && (
        <span className="tiny muted">You have: {owned.flatMap((k) => (GADGET_BY_KEY.get(k)?.kind === "accessory" ? [`${GADGET_BY_KEY.get(k)!.icon} ${GADGET_BY_KEY.get(k)!.name}`] : [])).join(", ")}</span>
      )}
      {view?.cracked && (
        <div className="row spread">
          <span className="tiny muted">
            {view.techLevel >= SELF_REPAIR_LEVEL ? `Your Tech is level ${view.techLevel}: buy the part and change it yourself.` : "Engineer Bayo changes it while you wait."} {formatCoins(view.repairPrice)} coins.
          </span>
          <button type="button" className="btn sm go" disabled={busy || !open} onClick={() => void repair()}>
            <Wrench size={14} aria-hidden="true" /> Fix screen
          </button>
        </div>
      )}
      <div className="row">
        <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="What to buy">
          {GADGETS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.icon} {g.name} ({formatCoins(g.price)})
            </option>
          ))}
        </select>
      </div>
      <span className="tiny muted">
        {item.note}. Tag price {formatCoins(item.price)} coins; offer less and the trader may take it. Too low and they wave you off.
      </span>
      {why ? (
        <span className="tiny muted">{why}</span>
      ) : (
        <div className="row">
          <input className="input num" inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value.replace(/[^\d]/g, ""))} aria-label="Your offer" />
          <button type="button" className="btn go" disabled={busy || !open || !Number(offer)} onClick={() => void haggle()}>
            <Handshake size={14} aria-hidden="true" /> Offer
          </button>
          <button type="button" className="btn" disabled={busy || !open} onClick={() => void buy()}>
            Pay {formatCoins(item.price)}
          </button>
        </div>
      )}
      {line && <span className="small">{line}</span>}
      <span className="tiny muted">City Coins have no cash value.</span>
    </div>
  );
}
