// The Phone's Dream app: the long goal picked in onboarding, its steps and their rewards.
import type { DreamView } from "@hc/shared";
import { AlertCircle, CheckCircle2, Coins, Lock } from "lucide-react";
import { useState } from "react";
import { api, formatCoins } from "../api.js";
import { dreamIcon } from "./dreamIcons.js";

const fmt = (n: number, unit: string) => (unit === "standing" ? String(n) : formatCoins(n));

/** Compact card for the phone's home screen. */
export function DreamCard({ dream, onOpen }: { dream: DreamView; onOpen: () => void }) {
  const Icon = dreamIcon(dream.key);
  const ready = dream.steps.filter((s) => s.reached && !s.claimed).length;
  const pct = dream.locked ? 0 : Math.min(1, dream.value / dream.target);
  return (
    <button type="button" className="dream-card" onClick={onOpen} aria-label={`Your dream: ${dream.title}. ${ready ? `${ready} reward ready.` : ""}`}>
      <span className="dream-icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="dream-card-body">
        <span className="tiny dream-kicker">Your dream</span>
        <strong>{dream.title}</strong>
        <span className="dream-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${pct})` }} />
        </span>
      </span>
      {ready > 0 && <span className="phone-badge dream-badge">{ready}</span>}
      {dream.locked && <Lock size={16} aria-hidden="true" />}
    </button>
  );
}

export function Dream({ dream, onDream, onChanged, notify }: { dream: DreamView; onDream: (d: DreamView) => void; onChanged: () => void; notify: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = dreamIcon(dream.key);
  const pct = dream.locked ? 0 : Math.min(1, dream.value / dream.target);

  const claim = (at: number) => {
    setBusy(true);
    setError(null);
    api<{ dream: DreamView; reward: number }>("POST", "/api/game/dream/claim", { at })
      .then((r) => {
        onDream(r.dream);
        onChanged();
        notify(`+${formatCoins(r.reward)} City Coins`);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="dream">
      <div className="dream-head">
        <span className="dream-icon lg" aria-hidden="true">
          <Icon size={30} />
        </span>
        <div>
          <h2 style={{ fontSize: 22 }}>{dream.title}</h2>
          <p className="small muted">{dream.goal}</p>
        </div>
      </div>

      {dream.locked ? (
        <p className="notice small dream-locked">
          <Lock size={16} aria-hidden="true" /> {dream.locked}
        </p>
      ) : (
        <div className="dream-progress">
          <div className="dream-bar lg" role="progressbar" aria-valuemin={0} aria-valuemax={dream.target} aria-valuenow={Math.min(dream.value, dream.target)} aria-label={`${dream.title} progress`}>
            <span style={{ transform: `scaleX(${pct})` }} />
          </div>
          <span className="small num">
            {dream.unit === "standing"
              ? `${dream.steps.filter((s) => s.reached).length} of ${dream.steps.length} steps`
              : `${fmt(Math.min(dream.value, dream.target), dream.unit)} / ${fmt(dream.target, dream.unit)} ${dream.unit}`}
          </span>
          {dream.note && <p className="small muted">{dream.note}</p>}
        </div>
      )}

      <ol className="dream-steps">
        {dream.steps.map((s) => (
          <li key={s.at} data-reached={s.reached} data-claimed={s.claimed}>
            <span className="dream-dot" aria-hidden="true">
              {s.reached ? <CheckCircle2 size={18} /> : null}
            </span>
            <span className="dream-step-label">
              <strong>{s.label}</strong>
              <span className="reward small">
                <Coins size={14} aria-hidden="true" /> +{formatCoins(s.reward)}
              </span>
            </span>
            {s.claimed ? (
              <span className="notice small">
                <CheckCircle2 size={16} aria-hidden="true" /> Claimed
              </span>
            ) : (
              <button type="button" className={`btn sm${s.reached ? " go" : ""}`} disabled={!s.reached || busy} onClick={() => claim(s.at)}>
                Claim
              </button>
            )}
          </li>
        ))}
      </ol>

      {dream.achieved && (
        <p className="notice dream-done">
          <CheckCircle2 size={18} aria-hidden="true" /> Dream reached. The Island across Third Mainland Bridge opens in a later stage, and you're ready for it.
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}
