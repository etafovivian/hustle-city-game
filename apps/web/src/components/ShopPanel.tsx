import { ECONOMY, STOCK_ITEMS_BY_KEY, type ShopLineView, type ShopView } from "@hc/shared";
import { AlertCircle, CheckCircle2, Coins, Minus, PackagePlus, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { api, formatCoins } from "../api.js";
import { TimeBar } from "./ui.js";

interface Props {
  shop: ShopView;
  onShop: (shop: ShopView) => void;
  onChanged: () => void;
  notify: (msg: string) => void;
}

type Act = (fn: () => Promise<ShopView>, success?: string) => void;

function Row({ line, busy, act }: { line: ShopLineView; busy: boolean; act: Act }) {
  const [units, setUnits] = useState(10);
  const [price, setPrice] = useState(line.price);
  const margin = price - line.wholesaleCost;
  const clampUnits = (n: number) => Math.max(1, Math.min(ECONOMY.maxRestockUnits, Math.round(n) || 1));

  return (
    <div className="inv-row" role="row">
      <div role="cell">
        <div className="inv-name">{line.name}</div>
        <div className="tiny muted">Usual price {formatCoins(line.referencePrice)}</div>
      </div>
      <div role="cell" className={`num inv-qty${line.quantity === 0 ? " zero" : ""}`}>
        {line.quantity}
      </div>
      <div role="cell" className="num">
        {formatCoins(line.wholesaleCost)}
      </div>
      <div role="cell" className="num" style={{ fontWeight: 750 }}>
        {formatCoins(line.price)}
      </div>

      <div className="inv-controls" role="cell">
        <div className="stepper" aria-label={`Units of ${line.name} to buy`}>
          <button type="button" aria-label="Fewer" onClick={() => setUnits((u) => clampUnits(u - 5))}>
            <Minus size={16} aria-hidden="true" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={units}
            aria-label={`Units of ${line.name}`}
            onChange={(e) => setUnits(clampUnits(Number(e.target.value)))}
          />
          <button type="button" aria-label="More" onClick={() => setUnits((u) => clampUnits(u + 5))}>
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
        <button
          className="btn sm"
          disabled={busy}
          onClick={() =>
            act(
              () => api<ShopView>("POST", "/api/game/shop/restock", { itemKey: line.itemKey, units, requestId: crypto.randomUUID() }),
              `Bought ${units} × ${line.name}`,
            )
          }
        >
          <PackagePlus size={16} aria-hidden="true" /> Buy for {formatCoins(units * line.wholesaleCost)}
        </button>

        <span className="price-input">
          <Tag size={14} aria-hidden="true" className="muted" />
          <input
            type="number"
            inputMode="numeric"
            value={price}
            aria-label={`Your selling price for ${line.name}`}
            onChange={(e) => setPrice(Math.round(Number(e.target.value)) || 0)}
          />
        </span>
        <button
          className="btn sm quiet"
          disabled={busy || price === line.price}
          onClick={() => act(() => api<ShopView>("POST", "/api/game/shop/price", { itemKey: line.itemKey, price }), "Price updated")}
        >
          Set price
        </button>
        <span className={`margin${margin < 0 ? " neg" : ""}`}>
          {margin < 0 ? "Selling at a loss: " : "Profit per item: "}
          {formatCoins(margin)}
        </span>
      </div>
    </div>
  );
}

export function ShopPanel({ shop, onShop, onChanged, notify }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act: Act = (fn, success) => {
    setBusy(true);
    setError(null);
    fn()
      .then((s) => {
        onShop(s);
        onChanged();
        if (success) notify(success);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const order = shop.order;
  const orderItem = order ? STOCK_ITEMS_BY_KEY.get(order.itemKey) : undefined;
  const orderStock = order ? (shop.lines.find((l) => l.itemKey === order.itemKey)?.quantity ?? 0) : 0;
  const ready = !!order && orderStock >= order.units;
  const sold = shop.recentSales.reduce((s, l) => s + l.units, 0);
  const slotMs = ECONOMY.orderSlotMinutes * 60_000;

  return (
    <div className="stack-lg">
      {order && orderItem && (
        <section className="sheet sheet-pad order" aria-labelledby="order-title">
          <div className="spread">
            <h2 id="order-title">Customer at your counter</h2>
          </div>
          <p className="npc-say">
            <strong>{order.customerName}:</strong> “Abeg, you get {order.units} {orderItem.name.toLowerCase()}? I go pay{" "}
            {formatCoins(order.offer)}.”
          </p>
          <div className="stage-strip" aria-label="Order progress">
            <span className="stage" data-state="done">
              Asked
            </span>
            <span className="stage" data-state={order.fulfilled || ready ? "done" : "now"}>
              {order.fulfilled || ready ? "Stock ready" : "Get stock"}
            </span>
            <span className="stage" data-state={order.fulfilled ? "done" : ready ? "now" : "todo"}>
              Served
            </span>
          </div>
          {order.fulfilled ? (
            <p className="notice">
              <CheckCircle2 size={18} aria-hidden="true" /> Served. E don land! Another customer is on the way.
            </p>
          ) : (
            <div className="row">
              <button
                className="btn go"
                disabled={busy || !ready}
                onClick={() => act(() => api<ShopView>("POST", "/api/game/shop/order", { slot: order.slot }), `Served ${order.customerName}`)}
              >
                <Coins size={18} aria-hidden="true" /> Serve for {formatCoins(order.offer)}
              </button>
              {!ready && (
                <span className="small muted">
                  You have {orderStock} of {order.units}. Buy {order.units - orderStock} more {orderItem.name.toLowerCase()} below.
                </span>
              )}
            </div>
          )}
          <TimeBar start={order.slot * slotMs} end={(order.slot + 1) * slotMs} label={order.fulfilled ? "Next customer" : "Customer waits for"} />
        </section>
      )}

      <section className="sheet" aria-labelledby="shop-title">
        <div className="takings">
          <div>
            <h2 id="shop-title">{shop.name}</h2>
            <p className="small muted">
              {sold > 0
                ? `Customers bought ${sold} item${sold === 1 ? "" : "s"} since your last visit.`
                : "Customers keep buying while you're away, for up to 24 hours. Price changes demand."}
            </p>
          </div>
          <div className="row">
            <div className="stack" style={{ gap: 0, textAlign: "right" }}>
              <span className="tiny muted">Takings to collect</span>
              <span className="takings-amount num">{formatCoins(shop.uncollected)}</span>
            </div>
            <button
              className="btn primary"
              disabled={busy || shop.uncollected <= 0}
              onClick={() => act(() => api<ShopView>("POST", "/api/game/shop/collect"), "Takings collected")}
            >
              Collect
            </button>
          </div>
        </div>

        {error && (
          <p className="alert sheet-pad" role="alert">
            <AlertCircle size={18} aria-hidden="true" /> {error}
          </p>
        )}

        <div className="inv" role="table" aria-label="Your stock">
          <div className="inv-head" role="row">
            <span role="columnheader">Item</span>
            <span role="columnheader" className="num">
              Stock
            </span>
            <span role="columnheader" className="num">
              Cost
            </span>
            <span role="columnheader" className="num">
              Price
            </span>
          </div>
          {shop.lines.map((line) => (
            <Row key={`${line.itemKey}-${line.price}`} line={line} busy={busy} act={act} />
          ))}
        </div>
      </section>
    </div>
  );
}
