import { STOCK_ITEMS_BY_KEY, type ShopLineView, type ShopView } from "@hc/shared";
import { useState } from "react";
import { api, formatCoins } from "../api.js";

interface Props {
  shop: ShopView;
  onShop: (shop: ShopView) => void;
  onChanged: () => void;
  notify: (msg: string) => void;
}

function LineControls({ line, busy, act }: { line: ShopLineView; busy: boolean; act: (fn: () => Promise<ShopView>) => void }) {
  const [units, setUnits] = useState(10);
  const [price, setPrice] = useState(line.price);
  const margin = price - line.wholesaleCost;

  return (
    <div className="row">
      <input
        className="input narrow"
        type="number"
        min={1}
        max={200}
        value={units}
        aria-label={`Units of ${line.name} to restock`}
        onChange={(e) => setUnits(Math.max(1, Number(e.target.value) || 1))}
      />
      <button
        className="btn sm"
        disabled={busy}
        onClick={() =>
          act(() =>
            api<ShopView>("POST", "/api/game/shop/restock", { itemKey: line.itemKey, units, requestId: crypto.randomUUID() }),
          )
        }
      >
        Restock · {formatCoins(units * line.wholesaleCost)}
      </button>
      <input
        className="input narrow"
        type="number"
        min={1}
        value={price}
        aria-label={`Selling price for ${line.name}`}
        onChange={(e) => setPrice(Number(e.target.value) || 0)}
      />
      <button
        className="btn sm"
        disabled={busy || price === line.price}
        onClick={() => act(() => api<ShopView>("POST", "/api/game/shop/price", { itemKey: line.itemKey, price }))}
      >
        Set price
      </button>
      <span className={`small ${margin < 0 ? "error" : "muted"}`}>margin {formatCoins(margin)}</span>
    </div>
  );
}

export function ShopPanel({ shop, onShop, onChanged, notify }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<ShopView>, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      onShop(await fn());
      onChanged();
      if (success) notify(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const order = shop.order;
  const orderItem = order ? STOCK_ITEMS_BY_KEY.get(order.itemKey) : undefined;
  const orderStock = order ? (shop.lines.find((l) => l.itemKey === order.itemKey)?.quantity ?? 0) : 0;
  const sold = shop.recentSales.reduce((s, l) => s + l.units, 0);

  return (
    <div className="stack">
      {order && orderItem && (
        <div className="order stack">
          <div className="spread">
            <strong>{order.customerName} wants to buy</strong>
            <span className="tag">new customer every 30 min</span>
          </div>
          <p>
            {order.units} × {orderItem.name} — pays <strong>{formatCoins(order.offer)} City Coins</strong>
          </p>
          {order.fulfilled ? (
            <p className="notice">Served. Next customer soon.</p>
          ) : (
            <div className="row">
              <button
                className="btn primary"
                disabled={busy || orderStock < order.units}
                onClick={() => act(() => api<ShopView>("POST", "/api/game/shop/order", { slot: order.slot }), "Customer served!")}
              >
                Serve customer
              </button>
              {orderStock < order.units && (
                <span className="small muted">
                  You have {orderStock}. Restock {orderItem.name} below.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card stack">
        <div className="spread">
          <div>
            <h3>{shop.name}</h3>
            <p className="small muted">Customers buy while you're away (up to 24 hours). Price affects demand.</p>
          </div>
          <div className="row">
            <span className="pill coins">
              <span className="coin-dot" /> {formatCoins(shop.uncollected)} takings
            </span>
            <button
              className="btn primary"
              disabled={busy || shop.uncollected <= 0}
              onClick={() => act(() => api<ShopView>("POST", "/api/game/shop/collect"), "Takings collected.")}
            >
              Collect
            </button>
          </div>
        </div>
        {sold > 0 && <p className="notice">Customers bought {sold} item(s) since your last visit.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="inv-cards">
          {shop.lines.map((line) => (
            <div className="inv-card" key={line.itemKey}>
              <div className="spread">
                <strong>{line.name}</strong>
                <span className="small muted">
                  stock <strong>{line.quantity}</strong> · cost {formatCoins(line.wholesaleCost)} · usual price{" "}
                  {formatCoins(line.referencePrice)} · yours <strong>{formatCoins(line.price)}</strong>
                </span>
              </div>
              <LineControls key={`${line.itemKey}-${line.price}`} line={line} busy={busy} act={(fn) => void act(fn)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
