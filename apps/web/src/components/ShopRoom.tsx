// The isometric shop room: two back walls with an Ankara trim, a tiled floor and furniture drawn back to front.
// Decorate passes handlers to make it editable; a visit renders it read-only.
import { DECOR_BY_KEY, footprint, type DecorItem, type Placement } from "@hc/shared";
import { printUrl } from "../prints.js";

const TW = 96; // tile width in floor units
const TH = 48; // tile height
const HEADROOM = 200; // space above the back row for the walls and tall sprites
const WALL = 150; // back wall height

export type RoomItem = Placement & { id: string; ghost?: boolean; bad?: boolean; selected?: boolean };
type Footprint = NonNullable<ReturnType<typeof footprint>>;

function spriteFor(item: DecorItem, rotation: number) {
  const four = item.views.length === 4;
  return { href: four ? item.views[rotation]! : item.views[0]!, mirror: !four && rotation % 2 === 1 };
}

export function ShopRoom({
  cols,
  rows,
  items,
  ghost = null,
  tilesFocusable = false,
  onTileHover,
  onTileClick,
  onItemSelect,
  label = "Shop floor",
}: {
  cols: number;
  rows: number;
  items: RoomItem[];
  /** Footprint highlighted on the floor while placing or moving. */
  ghost?: { f: Footprint; bad: boolean } | null;
  tilesFocusable?: boolean;
  onTileHover?: (t: { x: number; y: number } | null) => void;
  onTileClick?: (x: number, y: number) => void;
  onItemSelect?: (id: string) => void;
  label?: string;
}) {
  const editable = !!onTileClick;
  const offX = (rows * TW) / 2;
  const offY = HEADROOM;
  const width = ((cols + rows) * TW) / 2;
  const height = HEADROOM + ((cols + rows) * TH) / 2 + 8;
  const top = (gx: number, gy: number) => ({ X: offX + ((gx - gy) * TW) / 2, Y: offY + ((gx + gy) * TH) / 2 });

  // Items drawn back-to-front so nearer furniture covers what's behind it.
  const drawn = items
    .map((p) => ({ p, f: footprint(p) }))
    .filter((d): d is { p: RoomItem; f: Footprint } => !!d.f && DECOR_BY_KEY.has(d.p.itemKey))
    .sort((a, b) => a.f.x + a.f.w + a.f.y + a.f.h - (b.f.x + b.f.w + b.f.y + b.f.h));

  const T = top(0, 0);
  const L = top(0, rows);
  const R = top(cols, 0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={label} onMouseLeave={() => onTileHover?.(null)}>
      <defs>
        <pattern id="wall-trim" width="24" height="24" patternUnits="userSpaceOnUse">
          <image href={printUrl("market").slice(5, -2)} width="24" height="24" />
        </pattern>
      </defs>
      <g aria-hidden="true">
        <polygon points={`${L.X},${L.Y} ${T.X},${T.Y} ${T.X},${T.Y - WALL} ${L.X},${L.Y - WALL}`} fill="#1f2752" />
        <polygon points={`${T.X},${T.Y} ${R.X},${R.Y} ${R.X},${R.Y - WALL} ${T.X},${T.Y - WALL}`} fill="#283166" />
        <polygon points={`${L.X},${L.Y - WALL} ${T.X},${T.Y - WALL} ${T.X},${T.Y - WALL + 16} ${L.X},${L.Y - WALL + 16}`} fill="url(#wall-trim)" />
        <polygon points={`${T.X},${T.Y - WALL} ${R.X},${R.Y - WALL} ${R.X},${R.Y - WALL + 16} ${T.X},${T.Y - WALL + 16}`} fill="url(#wall-trim)" />
        <line x1={T.X} y1={T.Y} x2={T.X} y2={T.Y - WALL} stroke="#3b4580" strokeWidth="2" />
      </g>

      {Array.from({ length: rows }, (_, gy) =>
        Array.from({ length: cols }, (_, gx) => {
          const { X, Y } = top(gx, gy);
          const f = ghost?.f;
          const inGhost = f && gx >= f.x && gx < f.x + f.w && gy >= f.y && gy < f.y + f.h;
          const points = `${X},${Y} ${X + TW / 2},${Y + TH / 2} ${X},${Y + TH} ${X - TW / 2},${Y + TH / 2}`;
          const className = `tile${(gx + gy) % 2 ? " alt" : ""}${inGhost ? (ghost!.bad ? " bad" : " good") : ""}`;
          if (!editable) return <polygon key={`${gx}-${gy}`} className={className} points={points} aria-hidden="true" />;
          return (
            <polygon
              key={`${gx}-${gy}`}
              className={className}
              points={points}
              role="button"
              tabIndex={tilesFocusable ? 0 : -1}
              aria-label={`Floor tile ${gx + 1}, ${gy + 1}`}
              onMouseEnter={() => onTileHover?.({ x: gx, y: gy })}
              onFocus={() => onTileHover?.({ x: gx, y: gy })}
              onClick={() => onTileClick!(gx, gy)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTileClick!(gx, gy);
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
        const selectable = !p.ghost && !!onItemSelect;
        return (
          <g
            key={p.id}
            className={`decor-item${p.ghost ? " ghost" : ""}${p.bad ? " bad" : ""}${p.selected ? " selected" : ""}${selectable ? "" : " static"}`}
            transform={mirror ? `translate(${2 * cx} 0) scale(-1 1)` : undefined}
            onClick={
              selectable
                ? (e) => {
                    e.stopPropagation();
                    onItemSelect!(p.id);
                  }
                : undefined
            }
            role={selectable ? "button" : undefined}
            aria-label={selectable ? `${item.name}. Select to turn, move or sell.` : p.ghost ? undefined : item.name}
            tabIndex={selectable ? 0 : undefined}
            onKeyDown={
              selectable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onItemSelect!(p.id);
                    }
                  }
                : undefined
            }
          >
            <ellipse cx={cx} cy={frontY - (f.w + f.h) * (TH / 4)} rx={sw * 0.4} ry={sw * 0.14} fill="rgb(0 0 0 / 35%)" />
            <image href={href} x={cx - sw / 2} y={frontY - sh - TH * 0.15} width={sw} height={sh} preserveAspectRatio="xMidYMax meet" />
          </g>
        );
      })}
    </svg>
  );
}
