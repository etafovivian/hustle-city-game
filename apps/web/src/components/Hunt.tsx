// The daily kola-nut hunt on the map: five nuts hidden near buildings across the city (the same for everyone today).
// Walk close and tap one to pick it up; the chip shows how many you've found and which areas still hide one.
import { HUNT, huntRandom, type HuntView } from "@hc/shared";
import { useEffect, useMemo, useState } from "react";
import { api, formatCoins } from "../api.js";
import { LAND, kerbsideOf } from "./cityLayout.js";

type P = { x: number; y: number };
const lagosDay = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

/** Today's hiding places: one in each of five different areas. */
export function huntSpots(day: string): (P & { area: string })[] {
  const rnd = huntRandom(day);
  const areas = [...new Set(LAND.map((p) => p.area))];
  const picked: (P & { area: string })[] = [];
  const pool = [...areas];
  while (picked.length < HUNT.count && pool.length) {
    const area = pool.splice(Math.floor(rnd() * pool.length), 1)[0]!;
    const plots = LAND.filter((p) => p.area === area);
    const plot = plots[Math.floor(rnd() * plots.length)]!;
    const k = kerbsideOf({ x: plot.x, y: plot.y });
    picked.push({ x: k.x + (rnd() - 0.5) * 60, y: k.y + (rnd() - 0.5) * 30, area });
  }
  return picked;
}

export function useHunt(notify: (m: string) => void, onChanged: () => void) {
  const [day, setDay] = useState(lagosDay);
  const [found, setFound] = useState<number[]>([]);
  useEffect(() => {
    api<HuntView>("GET", "/api/game/hunt")
      .then((h) => {
        setDay(h.day);
        setFound(h.found);
      })
      .catch(() => undefined);
  }, []);
  const spots = useMemo(() => huntSpots(day), [day]);
  const pick = async (i: number, me: P) => {
    const s = spots[i]!;
    if (Math.hypot(s.x - me.x, s.y - me.y) > HUNT.reach) return notify(`🌰 A golden kola nut! Walk closer to pick it up.`);
    try {
      const r = await api<HuntView & { bonus: boolean }>("POST", `/api/game/hunt/${i}`);
      setFound(r.found);
      onChanged();
      notify(r.bonus ? `🌰 All ${HUNT.count} found today! +${formatCoins(HUNT.bonusCoins)} bonus coins` : `🌰 Golden kola nut! +${HUNT.coins} coins (${r.found.length}/${HUNT.count} today)`);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return { spots, found, pick };
}

/** The nuts on the map (drawn in world space; only the ones not found yet). */
export function HuntLayer({ spots, found, onPick, plateScale }: { spots: P[]; found: number[]; onPick: (i: number) => void; plateScale: number }) {
  return (
    <g className="hunt-layer">
      {spots.map((s, i) =>
        found.includes(i) ? null : (
          <g key={i} transform={`translate(${s.x} ${s.y}) scale(${Math.min(plateScale, 3)})`} role="button" aria-label="A golden kola nut" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => onPick(i)} onKeyDown={(e) => e.key === "Enter" && onPick(i)}>
            <circle r="26" fill="rgb(255 199 44 / 18%)">
              <animate attributeName="r" values="18;30;18" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <ellipse rx="11" ry="13" cy="-4" fill="#d9a21b" stroke="#6b4a08" strokeWidth="3" />
            <path d="M-4 -12 q4 8 0 16" stroke="#6b4a08" strokeWidth="2" fill="none" />
            <path d="M7 -22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fff6c2" />
          </g>
        ),
      )}
    </g>
  );
}

export function HuntChip({ spots, found }: { spots: (P & { area: string })[]; found: number[] }) {
  const [open, setOpen] = useState(false);
  const left = spots.map((s, i) => ({ ...s, i })).filter((s) => !found.includes(s.i));
  return (
    <button type="button" className="hunt-chip" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
      🌰 Kola hunt {found.length}/{HUNT.count}
      {open && <span className="tiny"> · {left.length ? `still hiding in: ${left.map((s) => s.area).join(", ")}` : "all found today! New nuts tomorrow."}</span>}
    </button>
  );
}
