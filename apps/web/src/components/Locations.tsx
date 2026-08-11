import type { LeaderboardRow } from "@hc/shared";
import { AlertCircle, Clock, Trophy, Users } from "lucide-react";
import { InteriorScene, ROOMS } from "./Interior.js";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";

const JOB_PREVIEWS = [
  { title: "Clean up 10 product photos", kind: "Design", note: "For a phone accessories shop" },
  { title: "Transcribe a 15-minute Yoruba interview", kind: "Writing", note: "Audio supplied, English transcript" },
  { title: "Test a checkout on an Android phone", kind: "Testing", note: "Report what breaks, with screenshots" },
];

export function WorkHub() {
  return (
    <div className="stack-lg">
      <p style={{ maxWidth: "62ch" }}>
        Paid digital tasks from businesses that have already funded them. Apply, submit your work, and get a verified review.
        Jobs open in the private beta. Nothing here pays yet.
      </p>
      <section className="sheet" aria-labelledby="jobs-title">
        <div className="side-title">
          <h2 id="jobs-title" style={{ fontSize: 18 }}>
            Example jobs
          </h2>
          <span className="tag">Preview</span>
        </div>
        <div className="rule-list" style={{ borderTop: "1px solid var(--rule)" }}>
          {JOB_PREVIEWS.map((j) => (
            <div key={j.title} className="spread sheet-pad">
              <div>
                <strong>{j.title}</strong>
                <p className="small muted">{j.note}</p>
              </div>
              <div className="row">
                <span className="tag">{j.kind}</span>
                <span className="tiny muted row" style={{ gap: 4 }}>
                  <Clock size={14} aria-hidden="true" /> Opens in beta
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Hangout({ onViewed }: { onViewed: () => void }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<LeaderboardRow[]>("GET", "/api/game/leaderboard")
      .then((r) => {
        setRows(r);
        onViewed();
      })
      .catch((e: Error) => setError(e.message));
    // Load once per visit.
  }, []);

  return (
    <div className="stack-lg">
      <InteriorScene src="/art/interiors/hangout.webp" alt="Inside The Hangout" room={ROOMS.hangout} seed={7} />
      <section className="sheet" aria-labelledby="standings-title">
        <div className="side-title">
          <h2 id="standings-title" style={{ fontSize: 18 }} className="row">
            <Trophy size={20} aria-hidden="true" /> Weekly standings
          </h2>
          <span className="tiny muted">City Coins earned from sales, Monday to Sunday</span>
        </div>
        {error && (
          <p className="alert sheet-pad" role="alert">
            <AlertCircle size={18} aria-hidden="true" /> {error}
          </p>
        )}
        {rows?.length === 0 && <p className="sheet-pad muted">No sales yet this week. Serve a customer and you're on the board.</p>}
        {rows && rows.length > 0 && (
          <table className="data">
            <thead>
              <tr>
                <th className="num" style={{ width: 56 }}>
                  #
                </th>
                <th>Player</th>
                <th className="num">Coins earned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rank} className={r.isMe ? "me" : undefined}>
                  <td className="num">{r.rank}</td>
                  <td>
                    {r.nickname}
                    {r.isMe ? " (you)" : ""}
                  </td>
                  <td className="num">{formatCoins(r.coinsEarned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="sheet sheet-pad row" style={{ alignItems: "flex-start", gap: 12 }}>
        <Users size={22} aria-hidden="true" className="muted" />
        <div>
          <h3>Friends and clubs</h3>
          <p className="small muted">Add friends, join one club, and compare standings. Coming in the private beta.</p>
        </div>
      </section>
    </div>
  );
}
