import type { QuestBoard } from "@hc/shared";
import { useState } from "react";
import { api, formatCoins } from "../api.js";

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export function Quests({ board, onBoard, onChanged, notify }: {
  board: QuestBoard;
  onBoard: (b: QuestBoard) => void;
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claim = async (key: string, coins: number) => {
    setBusy(key);
    setError(null);
    try {
      onBoard(await api<QuestBoard>("POST", `/api/game/quests/${key}/claim`));
      onChanged();
      notify(`+${formatCoins(coins)} City Coins`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const intro = board.intro;
  const introDone = intro.steps.every((s) => s.progress >= s.target);

  return (
    <div className="stack">
      {!intro.claimed && (
        <div className="quest" style={{ borderColor: "var(--accent)" }}>
          <div className="spread">
            <strong>{intro.title}</strong>
            <span className="small muted">+{formatCoins(intro.rewardCoins)} coins</span>
          </div>
          {intro.steps.map((s) => (
            <div key={s.label} className="stack" style={{ gap: 4 }}>
              <span className="small">
                {s.label} ({s.progress}/{s.target})
              </span>
              <Bar value={s.progress} max={s.target} />
            </div>
          ))}
          <button className="btn primary sm" disabled={!introDone || busy !== null} onClick={() => void claim("intro", intro.rewardCoins)}>
            Claim
          </button>
        </div>
      )}

      <div className="spread">
        <h3>Today's quests</h3>
        <span className="small muted">resets at midnight (Lagos)</span>
      </div>
      {board.daily.map((q) => (
        <div className="quest" key={q.key}>
          <div className="spread">
            <strong>{q.title}</strong>
            <span className="small muted">+{formatCoins(q.rewardCoins)} coins</span>
          </div>
          <span className="small muted">{q.description}</span>
          <Bar value={q.progress} max={q.target} />
          <div className="spread">
            <span className="small">
              {q.progress}/{q.target}
            </span>
            {q.claimed ? (
              <span className="notice small">Claimed</span>
            ) : (
              <button className="btn sm" disabled={q.progress < q.target || busy !== null} onClick={() => void claim(q.key, q.rewardCoins)}>
                Claim
              </button>
            )}
          </div>
        </div>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
