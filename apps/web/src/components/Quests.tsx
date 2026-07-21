import type { QuestBoard } from "@hc/shared";
import { AlertCircle, CheckCircle2, Coins } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api, formatCoins } from "../api.js";
import { printUrl, type PrintKey } from "../prints.js";
import { TimeBar, lagosDayWindow, useNow } from "./ui.js";

function Bolt({
  print,
  title,
  reward,
  progress,
  target,
  claimed,
  busy,
  onClaim,
  children,
}: {
  print: PrintKey;
  title: string;
  reward: number;
  progress: number;
  target: number;
  claimed: boolean;
  busy: boolean;
  onClaim: () => void;
  children?: ReactNode;
}) {
  const ready = progress >= target && !claimed;
  return (
    <div className="bolt" data-ready={ready}>
      <div className="bolt-cloth" style={{ backgroundImage: printUrl(print) }} aria-hidden="true" />
      <div className="bolt-plate">
      <div className="spread">
        <h3 style={{ fontSize: 16 }}>{title}</h3>
        <span className="reward">
          <Coins size={15} aria-hidden="true" /> +{formatCoins(reward)}
        </span>
      </div>
      {children}
      <div className="bolt-bar" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={progress} aria-label={title}>
        <span style={{ transform: `scaleX(${Math.min(1, progress / target)})` }} />
      </div>
      <div className="spread">
        <span className="small num">
          {progress} / {target}
        </span>
        {claimed ? (
          <span className="notice small">
            <CheckCircle2 size={16} aria-hidden="true" /> Claimed
          </span>
        ) : (
          <button className={`btn sm${ready ? " go" : ""}`} disabled={!ready || busy} onClick={onClaim}>
            Claim
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

// Each quest wears the print of the place it happens in.
const QUEST_PRINT: Record<string, PrintKey> = {
  tour_3: "work",
  standings_1: "hangout",
};
const questPrint = (key: string): PrintKey => QUEST_PRINT[key] ?? "market";

export function Quests({
  board,
  onBoard,
  onChanged,
  notify,
}: {
  board: QuestBoard;
  onBoard: (b: QuestBoard) => void;
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const day = lagosDayWindow(useNow(60_000));

  const claim = (key: string, coins: number) => {
    setBusy(true);
    setError(null);
    api<QuestBoard>("POST", `/api/game/quests/${key}/claim`)
      .then((b) => {
        onBoard(b);
        onChanged();
        notify(`+${formatCoins(coins)} City Coins`);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  const intro = board.intro;

  return (
    <aside className="quest-col" aria-labelledby="quests-title">
      {!intro.claimed && (
        <div className="rule-list" style={{ borderBottom: "1px solid var(--rule)" }}>
          <div className="side-title">
            <h2 style={{ fontSize: 18 }}>First steps</h2>
          </div>
          <Bolt
            print="market"
            title={intro.title}
            reward={intro.rewardCoins}
            progress={intro.steps.filter((s) => s.progress >= s.target).length}
            target={intro.steps.length}
            claimed={false}
            busy={busy}
            onClaim={() => claim("intro", intro.rewardCoins)}
          >
            <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
              {intro.steps.map((s) => (
                <li key={s.label} style={{ color: s.progress >= s.target ? "var(--ok)" : undefined }}>
                  {s.label}{" "}
                  <span className="num muted">
                    ({s.progress}/{s.target})
                  </span>
                </li>
              ))}
            </ul>
          </Bolt>
        </div>
      )}

      <div className="side-title">
        <h2 id="quests-title" style={{ fontSize: 18 }}>
          Today's quests
        </h2>
      </div>
      <div style={{ padding: "0 16px 12px" }}>
        <TimeBar start={day.start} end={day.end} label="New quests at midnight (Lagos)" />
      </div>
      <div className="rule-list" style={{ borderTop: "1px solid var(--rule)" }}>
        {board.daily.map((q) => (
          <Bolt
            key={q.key}
            print={questPrint(q.key)}
            title={q.title}
            reward={q.rewardCoins}
            progress={q.progress}
            target={q.target}
            claimed={q.claimed}
            busy={busy}
            onClaim={() => claim(q.key, q.rewardCoins)}
          >
            <p className="small muted">{q.description}</p>
          </Bolt>
        ))}
      </div>
      {error && (
        <p className="alert sheet-pad" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      )}
    </aside>
  );
}
