import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { printUrl, type PrintKey } from "../prints.js";

/** The printed edge of the cloth: states this surface's one rule, once (repeats are decorative). */
export function Selvedge({ rule }: { rule: string }) {
  const text = rule;
  return (
    <div className="selvedge">
      <span>{text}</span>
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} aria-hidden="true">
          <i className="sep" /> {text}
        </span>
      ))}
    </div>
  );
}

export function PlaceHeader({
  print,
  title,
  blurb,
  rule,
  onBack,
}: {
  print: PrintKey;
  title: string;
  blurb: string;
  rule: string;
  onBack: () => void;
}) {
  return (
    <div className="cloth-frame">
      <div className="place-head" style={{ backgroundImage: printUrl(print) }}>
        <button className="btn sm" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Map
        </button>
        <div className="place-plate">
          <h1>{title}</h1>
          <p className="small muted">{blurb}</p>
        </div>
      </div>
      <Selvedge rule={rule} />
    </div>
  );
}

/** Re-render every `ms` so countdowns stay live. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const fmtLeft = (msLeft: number) => {
  const s = Math.max(0, Math.round(msLeft / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
};

/** A bar whose length is the exact time remaining in a window. */
export function TimeBar({ start, end, label }: { start: number; end: number; label: ReactNode }) {
  const now = useNow();
  const left = Math.max(0, end - now);
  const pct = Math.max(0, Math.min(100, (left / (end - start)) * 100));
  return (
    <div className="timebar">
      <div className="spread tiny muted">
        <span>{label}</span>
        <span className="num" aria-live="off">
          {fmtLeft(left)} left
        </span>
      </div>
      <div className="timebar-track" role="presentation">
        <div className="timebar-fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

/** Start and end (ms) of the current Lagos calendar day (UTC+1, no DST). */
export function lagosDayWindow(now: number) {
  const offset = 60 * 60 * 1000;
  const start = Math.floor((now + offset) / 86_400_000) * 86_400_000 - offset;
  return { start, end: start + 86_400_000 };
}
