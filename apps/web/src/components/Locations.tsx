import type { LeaderboardRow } from "@hc/shared";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";

export function WorkHub() {
  const previews = [
    { title: "Product photo cleanup (10 images)", kind: "Design", note: "Funded jobs open in the private beta" },
    { title: "Transcribe 15-min Yoruba interview", kind: "Writing", note: "Funded jobs open in the private beta" },
    { title: "Test a checkout flow on Android", kind: "Testing", note: "Funded jobs open in the private beta" },
  ];
  return (
    <div className="stack">
      <p className="muted">
        Real digital tasks from funded clients. Apply, submit your work, get a verified review. Earnings and payouts are tested in sandbox
        before going live — nothing here pays cash yet.
      </p>
      {previews.map((p) => (
        <div className="card spread" key={p.title}>
          <div>
            <strong>{p.title}</strong>
            <p className="small muted">{p.note}</p>
          </div>
          <span className="tag">{p.kind}</span>
        </div>
      ))}
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
    <div className="stack">
      <div className="card stack">
        <div className="spread">
          <h3>Weekly standings</h3>
          <span className="small muted">City Coins earned from sales, Mon–Sun</span>
        </div>
        {error && <p className="error">{error}</p>}
        {rows?.length === 0 && <p className="muted">No sales yet this week. Be the first on the board.</p>}
        {rows && rows.length > 0 && (
          <table className="inv">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Coins earned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rank} style={r.isMe ? { fontWeight: 700 } : undefined}>
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
      </div>
      <div className="card">
        <strong>Friends and clubs</strong>
        <p className="small muted">Add friends, join a club and compare standings — coming in the private beta.</p>
      </div>
    </div>
  );
}
