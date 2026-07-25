// Buy mode: an isometric shop floor where players buy, place, turn, move and sell furniture.
// The server validates every placement and charge; the client previews with the same shared rules.
import {
  DECOR_BY_KEY,
  DECOR_ITEMS,
  DECOR_REFUND_SHARE,
  footprint,
  placementProblem,
  type DecorView,
  type Placement,
} from "@hc/shared";
import { AlertCircle, Check, Coins, Move, RotateCw, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, formatCoins } from "../api.js";
import { ShopRoom } from "./ShopRoom.js";


type Mode = { kind: "idle" } | { kind: "placing"; itemKey: string; rotation: number } | { kind: "selected"; id: string; moving: boolean };

export function Decorate({ coins, onChanged, notify }: { coins: number; onChanged: () => void; notify: (m: string) => void }) {
  const [decor, setDecor] = useState<DecorView | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DecorView>("GET", "/api/game/decor")
      .then(setDecor)
      .catch((e: Error) => setError(e.message));
  }, []);

  const cols = decor?.floor.cols ?? 8;
  const rows = decor?.floor.rows ?? 6;

  const act = async (fn: () => Promise<DecorView>, ok?: string) => {
    setBusy(true);
    setError(null);
    try {
      setDecor(await fn());
      onChanged();
      if (ok) notify(ok);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const placements = decor?.placements ?? [];
  const selected = mode.kind === "selected" ? placements.find((p) => p.id === mode.id) : undefined;

  // The ghost shows where the item being placed (or moved) would land, and whether it fits.
  const ghost = useMemo((): (Placement & { problem: string | null }) | null => {
    if (!hover) return null;
    if (mode.kind === "placing") {
      const p = { itemKey: mode.itemKey, x: hover.x, y: hover.y, rotation: mode.rotation };
      return { ...p, problem: placementProblem(p, placements) };
    }
    if (mode.kind === "selected" && mode.moving && selected) {
      const p = { itemKey: selected.itemKey, x: hover.x, y: hover.y, rotation: selected.rotation };
      return { ...p, problem: placementProblem(p, placements.filter((o) => o.id !== selected.id)) };
    }
    return null;
  }, [hover, mode, placements, selected]);

  const clickTile = async (x: number, y: number) => {
    if (busy) return;
    if (mode.kind === "placing") {
      const item = DECOR_BY_KEY.get(mode.itemKey)!;
      const ok = await act(
        () => api<DecorView>("POST", "/api/game/decor/buy", { itemKey: item.key, x, y, rotation: mode.rotation, requestId: crypto.randomUUID() }),
        `${item.name} placed`,
      );
      if (ok) setMode({ kind: "idle" });
    } else if (mode.kind === "selected" && mode.moving && selected) {
      const ok = await act(() => api<DecorView>("POST", `/api/game/decor/${selected.id}/move`, { x, y, rotation: selected.rotation }));
      if (ok) setMode({ kind: "selected", id: selected.id, moving: false });
    } else {
      setMode({ kind: "idle" });
    }
  };

  const rotate = () => {
    if (mode.kind === "placing") setMode({ ...mode, rotation: (mode.rotation + 1) % 4 });
    else if (selected)
      void act(() => api<DecorView>("POST", `/api/game/decor/${selected.id}/move`, { x: selected.x, y: selected.y, rotation: (selected.rotation + 1) % 4 }));
  };

  const sell = async () => {
    if (!selected) return;
    const item = DECOR_BY_KEY.get(selected.itemKey)!;
    const ok = await act(() => api<DecorView>("POST", `/api/game/decor/${selected.id}/sell`), `Sold ${item.name}`);
    if (ok) setMode({ kind: "idle" });
  };

  // Items drawn back-to-front so nearer furniture covers what's behind it.
  const drawn = [...placements.map((p) => ({ ...p, ghost: false as const })), ...(ghost ? [{ ...ghost, id: "ghost", ghost: true as const }] : [])]
    .filter((p) => !(mode.kind === "selected" && mode.moving && p.id === mode.id))
    .map((p) => ({ p }));

  const activeItem = mode.kind === "placing" ? DECOR_BY_KEY.get(mode.itemKey) : selected ? DECOR_BY_KEY.get(selected.itemKey) : undefined;

  return (
    <div className="stack-lg">
      <div className="decor-head">
        <div>
          <h2>Decorate your shop</h2>
          <p className="small muted">Tap an item, then a spot on the floor. Furniture adds appeal, and appeal brings more customers.</p>
        </div>
        <span className="appeal-pill" title="Each appeal point adds 1% more customers, up to +20%">
          <Sparkles size={16} aria-hidden="true" /> Appeal {decor?.appeal ?? 0} · +{Math.round((decor?.boost ?? 0) * 100)}% customers
        </span>
      </div>

      <div className="decor-floor">
        <ShopRoom
          cols={cols}
          rows={rows}
          items={drawn.map(({ p }) => ({ ...p, bad: p.ghost && !!ghost?.problem, selected: mode.kind === "selected" && mode.id === p.id }))}
          ghost={ghost ? { f: footprint(ghost)!, bad: !!ghost.problem } : null}
          tilesFocusable={mode.kind !== "idle"}
          onTileHover={setHover}
          onTileClick={(x, y) => void clickTile(x, y)}
          onItemSelect={mode.kind === "placing" ? undefined : (id) => setMode({ kind: "selected", id, moving: false })}
        />
      </div>

      {(mode.kind !== "idle" || error) && (
        <div className="decor-actions" role="toolbar" aria-label="Item actions">
          {activeItem && (
            <span className="decor-active">
              <img src={activeItem.views[0]} alt="" />
              <span>
                <strong>{activeItem.name}</strong>
                <span className="tiny muted">
                  {mode.kind === "placing"
                    ? `${formatCoins(activeItem.price)} coins · tap a free spot`
                    : mode.kind === "selected" && mode.moving
                      ? "Tap where it should go"
                      : `Sells back for ${formatCoins(Math.floor(activeItem.price * DECOR_REFUND_SHARE))}`}
                </span>
              </span>
            </span>
          )}
          {mode.kind !== "idle" && (
            <div className="row">
              <button type="button" className="btn sm" onClick={rotate} disabled={busy}>
                <RotateCw size={16} aria-hidden="true" /> Turn
              </button>
              {mode.kind === "selected" && !mode.moving && (
                <>
                  <button type="button" className="btn sm" onClick={() => setMode({ ...mode, moving: true })} disabled={busy}>
                    <Move size={16} aria-hidden="true" /> Move
                  </button>
                  <button type="button" className="btn sm" onClick={() => void sell()} disabled={busy}>
                    <Trash2 size={16} aria-hidden="true" /> Sell
                  </button>
                </>
              )}
              <button type="button" className="btn sm quiet" onClick={() => setMode({ kind: "idle" })} aria-label="Done">
                {mode.kind === "selected" ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                {mode.kind === "selected" ? "Done" : "Cancel"}
              </button>
            </div>
          )}
          {error && (
            <p className="alert" role="alert">
              <AlertCircle size={18} aria-hidden="true" /> {error}
            </p>
          )}
        </div>
      )}

      <section aria-labelledby="catalogue-title" className="stack">
        <div className="spread">
          <h3 id="catalogue-title">Catalogue</h3>
          <span className="small muted">You have {formatCoins(coins)} City Coins</span>
        </div>
        <div className="catalogue">
          {DECOR_ITEMS.map((item) => {
            const tooDear = item.price > coins;
            const active = mode.kind === "placing" && mode.itemKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className="cat-card"
                aria-pressed={active}
                disabled={tooDear}
                onClick={() => setMode({ kind: "placing", itemKey: item.key, rotation: 0 })}
              >
                <span className="cat-size">
                  {item.w}×{item.h}
                </span>
                <img src={item.views[0]} alt="" loading="lazy" />
                <strong>{item.name}</strong>
                <span className="cat-meta">
                  <span className="reward">
                    <Coins size={14} aria-hidden="true" /> {formatCoins(item.price)}
                  </span>
                  <span className="tiny muted">+{item.appeal} appeal</span>
                </span>
                {item.views.length === 4 && <span className="cat-turn">Turns 4 ways</span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
