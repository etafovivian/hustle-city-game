// "First day in Lagos" (see @hc/shared firstday.ts): Mama Nkechi's guide card on the map for a new player. One step
// at a time with a "Show me" button; the gift when it's done. Walking is noticed here (the map says when you arrive on
// foot); eating, riding and the shift come from the server. "Skip" hides it for good on this device.
import { FIRST_DAY, type FirstDayStepKey, type FirstDayView } from "@hc/shared";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";

const HIDE = "hc_firstday_hidden";
const WALKED = "hc_firstday_walked";
const read = (k: string) => {
  try {
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
};
const write = (k: string) => {
  try {
    localStorage.setItem(k, "1");
  } catch {
    /* not essential */
  }
};

/** Where "Show me" takes you for each step. */
const SHOW: Partial<Record<FirstDayStepKey, string>> = { eat: "mama_nkechi_buka", ride: "grand_lagoon_hotel", shift: "mama_nkechi_buka" };

export function FirstDayGuide({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const [view, setView] = useState<FirstDayView | null>(null);
  const [hidden, setHidden] = useState(() => read(HIDE));
  const [walked, setWalked] = useState(() => read(WALKED));
  const [small, setSmall] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<FirstDayView>("GET", "/api/game/first-day")
      .then(setView)
      .catch(() => undefined);
  useEffect(() => {
    if (hidden) return;
    void load();
    // Steps finish elsewhere (a ride, a meal, a shift): check back now and then, and when the map says you walked.
    const t = window.setInterval(() => void load(), 15_000);
    const onWalk = () => {
      write(WALKED);
      setWalked(true);
    };
    window.addEventListener("hc:walked", onWalk);
    window.addEventListener("hc:first-day", load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("hc:walked", onWalk);
      window.removeEventListener("hc:first-day", load);
    };
  }, [hidden]);
  if (hidden || !view || view.claimed) return null;

  const done = new Set<FirstDayStepKey>(view.done);
  if (walked) done.add("walk");
  const next = FIRST_DAY.steps.find((s) => !done.has(s.key));
  const claim = async () => {
    setBusy(true);
    try {
      await api("POST", "/api/game/first-day/claim");
      notify(`Welcome to Lagos! Mama Nkechi gave you ${formatCoins(FIRST_DAY.rewardCoins)} coins.`);
      onChanged();
      void load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const skip = () => {
    write(HIDE);
    setHidden(true);
  };

  if (small)
    return (
      <button type="button" className="firstday-pill" onClick={() => setSmall(false)} aria-label="Open Mama Nkechi's tour">
        👩🏾‍🍳 First day · {done.size}/{FIRST_DAY.steps.length}
      </button>
    );
  return (
    <aside className="firstday" aria-label="First day in Lagos">
      <div className="firstday-head">
        <span className="firstday-face" aria-hidden="true">
          👩🏾‍🍳
        </span>
        <strong className="small">{FIRST_DAY.guide}</strong>
        <span className="tiny muted">First day · {done.size}/{FIRST_DAY.steps.length}</span>
        <button type="button" className="firstday-x" onClick={() => setSmall(true)} aria-label="Make smaller">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <ol className="firstday-steps">
        {FIRST_DAY.steps.map((s) => (
          <li key={s.key} className={done.has(s.key) ? "done" : s === next ? "now" : ""}>
            {done.has(s.key) ? <Check size={12} aria-label="done" /> : <span aria-hidden="true">•</span>} {s.title}
          </li>
        ))}
      </ol>
      {next ? (
        <>
          <p className="small firstday-say">“{next.say}”</p>
          <div className="row" style={{ gap: 6 }}>
            {SHOW[next.key] && (
              <button type="button" className="btn sm go" onClick={() => window.dispatchEvent(new CustomEvent("hc:open-venue", { detail: SHOW[next.key] }))}>
                Show me
              </button>
            )}
            <button type="button" className="btn sm quiet" onClick={skip}>
              Skip the tour
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="small firstday-say">“You don try! You know your way around now. Take this small something to start.”</p>
          <button type="button" className="btn sm go" disabled={busy} onClick={() => void claim()}>
            Take {formatCoins(FIRST_DAY.rewardCoins)} coins · +{FIRST_DAY.rewardXp} XP
          </button>
        </>
      )}
    </aside>
  );
}
