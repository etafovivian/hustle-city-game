// Beta tester rewards (see @hc/shared testers.ts): your tier and progress (Phone → Report), the badge on player
// cards, and the admin list where Founding testers are picked and rewards paid out.
import { TESTER_BY_KEY, TESTER_DAYS, TESTER_TIERS, type AdminTesterRow, type TesterTier, type TesterView } from "@hc/shared";
import { Award } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";

export function TesterBadge({ tier }: { tier: TesterTier }) {
  const t = TESTER_BY_KEY.get(tier)!;
  return (
    <span className={`small tester-badge tester-${tier}`}>
      {t.icon} {t.label}
    </span>
  );
}

/** Your tester rewards: the tier you're on, what's next and the coins waiting for you. */
export function TesterCard() {
  const [v, setV] = useState<TesterView | null>(null);
  useEffect(() => {
    void api<TesterView>("GET", "/api/tester")
      .then(setV)
      .catch(() => undefined);
  }, []);
  if (!v) return null;
  const owed = v.coins - v.paid;
  return (
    <div className="tester-card stack" style={{ gap: 6 }}>
      <strong>
        <Award size={16} aria-hidden="true" /> Beta tester rewards
      </strong>
      {v.tier ? (
        <span className="small">
          You're a <TesterBadge tier={v.tier} />
          {owed > 0 ? ` · ${formatCoins(owed)} coins waiting for you when rewards are paid out` : v.paid ? ` · ${formatCoins(v.paid)} coins paid` : ""}
        </span>
      ) : (
        <span className="small">Play on {TESTER_DAYS.joined} different days to become a Beta tester.</span>
      )}
      <ul className="tester-tiers">
        {TESTER_TIERS.map((t) => {
          const got = v.tier && TESTER_TIERS.findIndex((x) => x.key === v.tier) >= TESTER_TIERS.indexOf(t);
          return (
            <li key={t.key} className={got ? "got" : undefined}>
              <span>
                {got ? "✓" : t.icon} <strong>{t.label}</strong> · {formatCoins(t.coins)} coins
              </span>
              <span className="tiny muted">{t.how}</span>
            </li>
          );
        })}
      </ul>
      <span className="tiny muted">
        Days played: {v.days}
        {v.usefulReports ? ` · reports fixed: ${v.usefulReports}` : ""}. Tier coins aren't added together: the highest tier you reach is what you get.
      </span>
    </div>
  );
}

/** Admin: every player who has played, their tier, Founding picks and paying out. */
export function AdminTesters({ notify }: { notify: (m: string) => void }) {
  const [rows, setRows] = useState<AdminTesterRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    void api<AdminTesterRow[]>("GET", "/api/admin/testers")
      .then(setRows)
      .catch((e: Error) => notify(e.message));
  useEffect(load, []);
  const setTier = async (r: AdminTesterRow, tier: TesterTier | null) => {
    try {
      await api("POST", `/api/admin/testers/${r.userId}`, { tier });
      notify(tier ? `@${r.nickname} is now a ${TESTER_BY_KEY.get(tier)!.label}` : `@${r.nickname}'s tier removed`);
      load();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const owed = (rows ?? []).reduce((n, r) => n + Math.max(0, r.coins - r.paid), 0);
  const pay = async () => {
    if (!window.confirm(`Pay ${formatCoins(owed)} coins of tester rewards now? Players get them straight away.`)) return;
    setBusy(true);
    try {
      const r = await api<{ players: number; coins: number }>("POST", "/api/admin/testers/pay");
      notify(`Paid ${formatCoins(r.coins)} coins to ${r.players} testers`);
      load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <h2 style={{ fontSize: 20 }}>
        <Award size={20} aria-hidden="true" /> Beta testers
      </h2>
      <p className="tiny muted">
        Beta tester ({TESTER_DAYS.joined} days) and Active tester ({TESTER_DAYS.active} days, or a report marked fixed) come on their own. Founding tester is your pick. Coins are banked until you pay them out.
      </p>
      {!rows ? (
        <p className="small muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="small muted">No players yet.</p>
      ) : (
        <ul className="tester-admin">
          {rows.map((r) => (
            <li key={r.userId}>
              <span>
                <strong>@{r.nickname}</strong> {r.tier ? <TesterBadge tier={r.tier} /> : <span className="tiny muted">no tier yet</span>}
                <span className="tiny muted">
                  {" "}
                  · {r.days} {r.days === 1 ? "day" : "days"} · {r.reports} {r.reports === 1 ? "report" : "reports"} ({r.usefulReports} fixed){r.lastDay ? ` · last played ${r.lastDay}` : ""}
                  {r.coins - r.paid > 0 ? ` · owed ${formatCoins(r.coins - r.paid)}` : r.paid ? ` · paid ${formatCoins(r.paid)}` : ""}
                </span>
              </span>
              {r.tier === "founding" ? (
                <button type="button" className="btn sm quiet" onClick={() => void setTier(r, null)}>
                  Remove Founding
                </button>
              ) : (
                <button type="button" className="btn sm" onClick={() => void setTier(r, "founding")}>
                  🏅 Make Founding
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn go" style={{ justifySelf: "start" }} disabled={busy || owed <= 0} onClick={() => void pay()}>
        Pay out rewards ({formatCoins(owed)} coins)
      </button>
    </div>
  );
}
