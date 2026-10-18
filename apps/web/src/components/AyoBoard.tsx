// The Ayo board: a carved wooden board with real-looking seeds. A move plays out like at a real board: the hand
// scoops up the pit, then drops the seeds one by one into the next pits in order (counting down as it goes), and
// any capture is swept into the player's store. Used for games against the computer and live games.
import { ayoMoves, ayoTrace, type AyoState } from "@hc/shared";
import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { sfx, useGameSound } from "../gameSfx.js";

interface Shown {
  pits: number[];
  stores: [number, number];
}
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const TONES = ["a", "b", "c", "d"];

/** Seeds spread in a pit like a real handful: a sunflower spiral, each with its own turn and shade. */
function Seeds({ n, at, fresh, store = false }: { n: number; at: number; fresh?: boolean; store?: boolean }) {
  if (store)
    return (
      <span className="ayo-pile" aria-hidden="true">
        {Array.from({ length: Math.min(n, 48) }, (_, k) => (
          <i key={k} className={`seed t${TONES[(k * 7 + at * 3) % 4]}`} style={{ ["--rot" as string]: `${(k * 67 + at * 41) % 180}deg` }} />
        ))}
      </span>
    );
  const shown = Math.min(n, 24);
  const spread = Math.max(5.2, 12.5 - shown * 0.32);
  return (
    <span className="ayo-seed-bed" aria-hidden="true">
      {Array.from({ length: shown }, (_, k) => {
        const a = k * 2.39996 + at * 1.7;
        const r = spread * Math.sqrt(k + 0.4);
        const x = 50 + Math.cos(a) * r;
        const y = 50 + Math.sin(a) * r;
        return (
          <i
            key={k}
            className={`seed t${TONES[(k * 7 + at * 3) % 4]}${fresh && k === shown - 1 ? " fresh" : ""}`}
            style={{ left: `${x}%`, top: `${y}%`, ["--rot" as string]: `${(k * 67 + at * 41) % 180}deg` }}
          />
        );
      })}
    </span>
  );
}

/** Plays moves on the board, seed by seed. `play` resolves when the move has finished playing out. */
export function useAyoPlayback(initial: AyoState) {
  const [shown, setShown] = useState<Shown>({ pits: [...initial.pits], stores: [...initial.stores] });
  const [hand, setHand] = useState<{ at: number; seeds: number } | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [glow, setGlow] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const show = useCallback((s: AyoState) => setShown({ pits: [...s.pits], stores: [...s.stores] }), []);
  const play = useCallback(async (from: AyoState, pit: number, to: AyoState) => {
    busy.current = true;
    const fast = reduced();
    const { drops, captured } = ayoTrace(from, pit);
    const step = fast ? 40 : drops.length > 12 ? 170 : drops.length > 6 ? 220 : 280;
    const cur: Shown = { pits: [...from.pits], stores: [...from.stores] };
    setShown({ ...cur, pits: [...cur.pits] });
    setLast(pit);
    // Scoop the pit up.
    setHand({ at: pit, seeds: cur.pits[pit]! });
    await wait(fast ? 40 : 260);
    cur.pits[pit] = 0;
    setShown({ ...cur, pits: [...cur.pits] });
    await wait(fast ? 20 : 160);
    // Drop them one by one, in order.
    for (let k = 0; k < drops.length && alive.current; k++) {
      const d = drops[k]!;
      setHand({ at: d, seeds: drops.length - k });
      await wait(step * 0.55);
      cur.pits[d]!++;
      setShown({ ...cur, pits: [...cur.pits] });
      setFresh(d);
      setHand({ at: d, seeds: drops.length - k - 1 });
      sfx.seed(k);
      await wait(step * 0.45);
    }
    setHand(null);
    setFresh(null);
    // Captures: each pit glows, then its seeds go to the store.
    for (const c of captured) {
      if (!alive.current) break;
      setGlow((g) => [...g, c.pit]);
      await wait(fast ? 40 : 320);
      cur.pits[c.pit] = 0;
      cur.stores[from.turn] += c.seeds;
      setShown({ ...cur, pits: [...cur.pits], stores: [...cur.stores] as [number, number] });
      sfx.capture();
      await wait(fast ? 20 : 180);
    }
    if (captured.length) await wait(fast ? 0 : 300);
    setGlow([]);
    if (alive.current) show(to);
    busy.current = false;
  }, [show]);
  return { shown, hand, fresh, glow, last, play, show, busy };
}

type Playback = ReturnType<typeof useAyoPlayback>;

export function AyoBoard({ s, pb, me, onPick, names, watching = false }: { s: AyoState; pb: Playback; me: 0 | 1; onPick: (pit: number) => void; names: [string, string]; watching?: boolean }) {
  const [sound, toggleSound] = useGameSound();
  const animating = pb.hand !== null || pb.glow.length > 0 || pb.busy.current;
  const legal = !watching && !animating && s.turn === me && !s.over ? ayoMoves(s) : [];
  const other = me === 0 ? 1 : 0;
  // Your row at the bottom, left to right in sowing order; theirs on top, running back the other way.
  const bottom = me === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11];
  const top = me === 0 ? [11, 10, 9, 8, 7, 6] : [5, 4, 3, 2, 1, 0];
  const board = useRef<HTMLDivElement>(null);
  const pitEls = useRef<(HTMLButtonElement | null)[]>([]);
  const [handXY, setHandXY] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!pb.hand) return setHandXY(null);
    const el = pitEls.current[pb.hand.at];
    const b = board.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    if (b && r) setHandXY({ x: r.left - b.left + r.width / 2, y: r.top - b.top - r.height * 0.05 });
  }, [pb.hand?.at]);

  const pit = (i: number) => {
    const n = pb.shown.pits[i]!;
    const mine = (me === 0) === i < 6;
    return (
      <button
        key={i}
        ref={(el) => {
          pitEls.current[i] = el;
        }}
        type="button"
        className={`ayo-hole${legal.includes(i) ? " legal" : ""}${pb.glow.includes(i) ? " capture" : ""}${pb.last === i ? " last" : ""}${mine ? " mine" : ""}`}
        disabled={!legal.includes(i)}
        onClick={() => onPick(i)}
        aria-label={`${mine ? "Your" : "Their"} pit with ${n} ${n === 1 ? "seed" : "seeds"}`}
      >
        <Seeds n={n} at={i} fresh={pb.fresh === i} />
        <b className="ayo-count">{n}</b>
      </button>
    );
  };
  const store = (p: 0 | 1) => (
    <div className={`ayo-bank${p === me ? " mine" : ""}${s.turn === p && !s.over ? " turn" : ""}`}>
      <span className="ayo-bank-name">{names[p]}</span>
      <div className="ayo-trough">
        <Seeds n={pb.shown.stores[p]} at={p + 20} store />
      </div>
      <b className="ayo-bank-count">{pb.shown.stores[p]}</b>
    </div>
  );
  return (
    <div className="ayo-table">
      <button type="button" className="ayo-sound" onClick={toggleSound} aria-label={sound ? "Mute game sounds" : "Turn game sounds on"}>
        {sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
      </button>
      <div className="ayo-board" ref={board}>
        {store(other)}
        <div className="ayo-field">
          <div className="ayo-line">{top.map(pit)}</div>
          <div className="ayo-line">{bottom.map(pit)}</div>
        </div>
        {store(me)}
        {pb.hand && handXY && (
          <div className={`ayo-hand${pb.hand.seeds === 0 ? " empty" : ""}`} style={{ transform: `translate(${handXY.x}px, ${handXY.y}px)` }} aria-hidden="true">
            <span className="ayo-hand-seeds">
              {Array.from({ length: Math.min(pb.hand.seeds, 5) }, (_, k) => (
                <i key={k} className={`seed t${TONES[k % 4]}`} style={{ left: `${30 + (k % 3) * 18}%`, top: `${35 + Math.floor(k / 3) * 22}%`, ["--rot" as string]: `${k * 50}deg` }} />
              ))}
            </span>
            {pb.hand.seeds > 0 && <b>{pb.hand.seeds}</b>}
          </div>
        )}
      </div>
      <p className="ayo-sowing tiny" aria-live="polite">
        {pb.hand ? (pb.hand.seeds > 0 ? `Sowing… ${pb.hand.seeds} ${pb.hand.seeds === 1 ? "seed" : "seeds"} left` : "Last seed down") : pb.glow.length ? "Captured!" : " "}
      </p>
    </div>
  );
}
