// Buy mode: an isometric shop floor where players buy, place, turn, move and sell furniture.
// The server validates every placement and charge; the client previews with the same shared rules.
import {
  DECOR_BY_KEY,
  DECOR_ITEMS,
  DECOR_REFUND_SHARE,
  footprint,
  placementProblem,
  type DecorItem,
  type DecorView,
  type Placement,
} from "@hc/shared";
import { AlertCircle, Check, Coins, Move, RotateCw, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, formatCoins } from "../api.js";
import { printUrl } from "../prints.js";

const TW = 96; // tile width in floor units
const TH = 48; // tile height
const HEADROOM = 200; // space above the back row for the walls and tall sprites
const WALL = 150; // back wall height

type Mode = { kind: "idle" } | { kind: "placing"; itemKey: string; rotation: number } | { kind: "selected"; id: string; moving: boolean };

function spriteFor(item: DecorItem, rotation: number) {
  const four = item.views.length === 4;
  return { href: four ? item.views[rotation]! : item.views[0]!, mirror: !four && rotation % 2 === 1 };
}

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
  const offX = (rows * TW) / 2;
  const offY = HEADROOM;
  const width = ((cols + rows) * TW) / 2;
  const height = HEADROOM + ((cols + rows) * TH) / 2 + 8;
  const top = (gx: number, gy: number) => ({ X: offX + ((gx - gy) * TW) / 2, Y: offY + ((gx + gy) * TH) / 2 });

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
    .map((p) => ({ p, f: footprint(p)! }))
    .filter(({ f }) => f)
    .sort((a, b) => a.f.x + a.f.w + a.f.y + a.f.h - (b.f.x + b.f.w + b.f.y + b.f.h));

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
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Shop floor" onMouseLeave={() => setHover(null)}>
          {/* Two back walls make the floor read as a room; an Ankara trim runs along the top. */}
          <defs>
            <pattern id="wall-trim" width="24" height="24" patternUnits="userSpaceOnUse">
              <image href={printUrl("market").slice(5, -2)} width="24" height="24" />
            </pattern>
          </defs>
          {(() => {
            const T = top(0, 0);
            const L = top(0, rows);
            const R = top(cols, 0);
            return (
              <g aria-hidden="true">
                <polygon points={`${L.X},${L.Y} ${T.X},${T.Y} ${T.X},${T.Y - WALL} ${L.X},${L.Y - WALL}`} fill="#1f2752" />
                <polygon points={`${T.X},${T.Y} ${R.X},${R.Y} ${R.X},${R.Y - WALL} ${T.X},${T.Y - WALL}`} fill="#283166" />
                <polygon points={`${L.X},${L.Y - WALL} ${T.X},${T.Y - WALL} ${T.X},${T.Y - WALL + 16} ${L.X},${L.Y - WALL + 16}`} fill="url(#wall-trim)" />
                <polygon points={`${T.X},${T.Y - WALL} ${R.X},${R.Y - WALL} ${R.X},${R.Y - WALL + 16} ${T.X},${T.Y - WALL + 16}`} fill="url(#wall-trim)" />
                <line x1={T.X} y1={T.Y} x2={T.X} y2={T.Y - WALL} stroke="#3b4580" strokeWidth="2" />
              </g>
            );
          })()}
          {Array.from({ length: rows }, (_, gy) =>
            Array.from({ length: cols }, (_, gx) => {
              const { X, Y } = top(gx, gy);
              const inGhost = ghost && (() => {
                const f = footprint(ghost)!;
                return gx >= f.x && gx < f.x + f.w && gy >= f.y && gy < f.y + f.h;
              })();
              return (
                <polygon
                  key={`${gx}-${gy}`}
                  className={`tile${(gx + gy) % 2 ? " alt" : ""}${inGhost ? (ghost!.problem ? " bad" : " good") : ""}`}
                  points={`${X},${Y} ${X + TW / 2},${Y + TH / 2} ${X},${Y + TH} ${X - TW / 2},${Y + TH / 2}`}
                  role="button"
                  tabIndex={mode.kind === "idle" ? -1 : 0}
                  aria-label={`Floor tile ${gx + 1}, ${gy + 1}`}
                  onMouseEnter={() => setHover({ x: gx, y: gy })}
                  onFocus={() => setHover({ x: gx, y: gy })}
                  onClick={() => void clickTile(gx, gy)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void clickTile(gx, gy);
                    }
                  }}
                />
              );
            }),
          )}

          {drawn.map(({ p, f }) => {
            const item = DECOR_BY_KEY.get(p.itemKey)!;
            const { href, mirror } = spriteFor(item, p.rotation);
            const cx = offX + ((f.x + f.w / 2 - (f.y + f.h / 2)) * TW) / 2;
            const frontY = offY + ((f.x + f.w + f.y + f.h) * TH) / 2;
            const sw = ((f.w + f.h) / 2) * TW * 0.86;
            const sh = sw * 1.5;
            const isSel = mode.kind === "selected" && mode.id === p.id;
            return (
              <g
                key={p.id}
                className={`decor-item${p.ghost ? " ghost" : ""}${p.ghost && ghost?.problem ? " bad" : ""}${isSel ? " selected" : ""}`}
                transform={mirror ? `translate(${2 * cx} 0) scale(-1 1)` : undefined}
                onClick={(e) => {
                  if (p.ghost || mode.kind === "placing") return;
                  e.stopPropagation();
                  setMode({ kind: "selected", id: p.id, moving: false });
                }}
                role={p.ghost ? undefined : "button"}
                aria-label={p.ghost ? undefined : `${item.name}. Select to turn, move or sell.`}
                tabIndex={p.ghost ? undefined : 0}
                onKeyDown={(e) => {
                  if (!p.ghost && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setMode({ kind: "selected", id: p.id, moving: false });
                  }
                }}
              >
                <ellipse cx={cx} cy={frontY - (f.w + f.h) * (TH / 4)} rx={sw * 0.4} ry={sw * 0.14} fill="rgb(0 0 0 / 35%)" />
                <image href={href} x={cx - sw / 2} y={frontY - sh - TH * 0.15} width={sw} height={sh} preserveAspectRatio="xMidYMax meet" />
              </g>
            );
          })}
        </svg>
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
