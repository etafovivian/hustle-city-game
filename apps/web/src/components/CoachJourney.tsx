// The coach trip to Ogun State as a scene: the road out of the window, and something happening on the way (see
// @hc/shared coach.ts). The coach on the map waits while this is open; "Continue the trip" moves it on.
import { COACH_EVENT_BY_KEY, NEED_ICON, NEED_LABEL, SKILL_BY_KEY, type CoachEventKey, type CoachResult, type NeedKey } from "@hc/shared";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";

/** Stand-in art for the window view and each event until the Stitch images arrive (swap the paths here). */
const ART: { window?: string } & Partial<Record<CoachEventKey, string>> = {};

/** The expressway sliding past: sky, distant bush, palms and the verge, each at its own speed. Stops for an event. */
function WindowView({ moving }: { moving: boolean }) {
  if (ART.window) return <img className="coach-window-art" src={ART.window} alt="" />;
  const palms = [40, 190, 330, 470, 620, 760];
  return (
    <svg className={`coach-window ${moving ? "moving" : ""}`} viewBox="0 0 400 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="coach-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#7cc4f0" />
          <stop offset="1" stopColor="#e9f3dc" />
        </linearGradient>
      </defs>
      <rect width="400" height="170" fill="url(#coach-sky)" />
      <circle cx="330" cy="38" r="18" fill="#ffd34d" />
      <g className="coach-far">
        {[0, 400].map((o) => (
          <path key={o} transform={`translate(${o} 0)`} d="M0 104 Q40 80 80 98 T160 92 T240 100 T320 88 T400 104 V120 H0Z" fill="#6f9e58" />
        ))}
      </g>
      <rect y="112" width="400" height="58" fill="#3b3f46" />
      <g className="coach-lines">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={i * 70} y="139" width="36" height="4" fill="#f4f1e8" />
        ))}
      </g>
      <g className="coach-near">
        {palms.map((x) => (
          <g key={x} transform={`translate(${x} 112)`}>
            <path d="M0 0 Q4 -30 2 -60" stroke="#7a5230" strokeWidth="5" fill="none" />
            {[-60, -20, 20, 60, 100, 140].map((a) => (
              <path key={a} d="M2 -60 q18 -6 30 8" transform={`rotate(${a} 2 -60)`} stroke="#2f7d3a" strokeWidth="6" fill="none" strokeLinecap="round" />
            ))}
          </g>
        ))}
      </g>
      {/* The window frame and a curtain */}
      <rect x="0" y="0" width="400" height="170" fill="none" stroke="#1c2340" strokeWidth="14" rx="18" />
      <path d="M0 0 H46 Q30 80 44 170 H0Z" fill="#b8323a" opacity=".9" />
    </svg>
  );
}

const outcomeBits = (r: CoachResult) => {
  const o = r.outcome;
  const bits: string[] = [];
  if (o.coins) bits.push(`${o.coins > 0 ? "+" : "−"}${formatCoins(Math.abs(o.coins))} coins`);
  for (const [k, v] of Object.entries(o.needs ?? {}) as [NeedKey, number][]) if (v) bits.push(`${v > 0 ? "+" : "−"}${NEED_ICON[k]} ${NEED_LABEL[k]}`);
  if (o.xp) bits.push(`+${o.xp} XP`);
  if (o.skill) bits.push(`+${SKILL_BY_KEY.get(o.skill[0])?.label ?? o.skill[0]}`);
  return bits;
};

export function CoachJourney({ rideId, event, step, onDone }: { rideId: string; event: string; step: string; onDone: () => void }) {
  const ev = COACH_EVENT_BY_KEY.get(event as CoachEventKey);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // An event this version doesn't know: just go on.
  useEffect(() => {
    if (!ev) onDone();
  }, [ev]);
  if (!ev) return null;
  const choose = async (choice: string) => {
    setBusy(choice);
    setError(null);
    try {
      setResult(await api<CoachResult>("POST", `/api/game/rides/${rideId}/coach`, { event: ev.key, choice }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="phone-backdrop">
      <div className="visit-sheet coach-sheet" role="alertdialog" aria-modal="true" aria-label={`On the coach: ${ev.title}`}>
        <div className="coach-view">
          <WindowView moving={!!result} />
          {ART[ev.key] ? (
            <img className="coach-event-art" src={ART[ev.key]} alt="" />
          ) : (
            <span className="coach-event-icon" aria-hidden="true">
              {ev.icon}
            </span>
          )}
          <span className="coach-step tiny">🚍 Interstate coach · {step}</span>
        </div>
        <h2>{ev.title}</h2>
        <p className="small">{ev.scene}</p>
        <p className="coach-line small">{ev.line}</p>
        {result ? (
          <>
            <p className={`area-result ${result.ok ? "ok" : "bad"}`}>{result.outcome.message}</p>
            {outcomeBits(result).length > 0 && <p className="small">{outcomeBits(result).join(" · ")}</p>}
            <button type="button" className="btn go" onClick={onDone}>
              Continue the trip
            </button>
          </>
        ) : (
          <ul className="area-options">
            {ev.choices.map((c) => (
              <li key={c.key}>
                <button type="button" className="area-option" disabled={busy !== null} onClick={() => void choose(c.key)}>
                  <strong>{c.label}</strong>
                  <span className="tiny">{c.note}</span>
                  {c.odds !== undefined && <span className="tiny muted">{Math.round(c.odds * 100)}% chance, more with skill</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <>
            <p className="alert small">{error}</p>
            <button type="button" className="btn" onClick={onDone}>
              Continue the trip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
