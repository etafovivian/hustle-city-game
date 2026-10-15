// Phone → Admin → Beta stats: players (new, active, coming back) and what they use, from what the game already
// records. Admins are left out of every number.
import { PET_BY_KIND, STAGE_LABEL, type BondStage, type StatsView } from "@hc/shared";
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";

const pct = (n: number | null, of: number) => (n === null ? "…" : of ? `${Math.round((100 * n) / of)}%` : "–");
const short = (day: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

export function AdminStats() {
  const [s, setS] = useState<StatsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    void api<StatsView>("GET", "/api/admin/stats")
      .then(setS)
      .catch((e: Error) => setError(e.message));
  useEffect(load, []);
  if (error) return <p className="small alert">{error}</p>;
  if (!s) return <p className="small muted">Loading stats…</p>;
  const max = Math.max(1, ...s.daily.map((d) => Math.max(d.signups, d.active)));
  const used = [...s.use].sort((a, b) => b.players - a.players || b.times - a.times);
  return (
    <div className="stack stats">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 20 }}>
          <BarChart3 size={20} aria-hidden="true" /> Beta stats
        </h2>
        <button type="button" className="btn sm quiet" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="stats-tiles">
        {(
          [
            ["Players", s.players.total],
            ["New today", s.players.newToday],
            ["New this week", s.players.new7d],
            ["Active today", s.players.activeToday],
            ["Active this week", s.players.active7d],
            ["Active this month", s.players.active30d],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="stats-tile">
            <strong>{n}</strong>
            <span className="tiny muted">{label}</span>
          </div>
        ))}
      </div>

      <h3 className="small">Last 14 days</h3>
      <div className="stats-chart" role="img" aria-label="Sign-ups and active players per day, last 14 days">
        {s.daily.map((d) => (
          <div key={d.day} className="stats-day" title={`${short(d.day)}: ${d.signups} new, ${d.active} active`}>
            <div className="stats-bars">
              <span className="stats-bar new" style={{ height: `${(100 * d.signups) / max}%` }} />
              <span className="stats-bar active" style={{ height: `${(100 * d.active) / max}%` }} />
            </div>
            <span className="tiny muted">{short(d.day).split(" ")[0]}</span>
          </div>
        ))}
      </div>
      <span className="tiny muted">
        <i className="stats-key new" /> new players <i className="stats-key active" /> active players
      </span>

      <h3 className="small">Do they come back?</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Joined</th>
            <th>New</th>
            <th>Next day</th>
            <th>A week later</th>
          </tr>
        </thead>
        <tbody>
          {s.cohorts.length === 0 && (
            <tr>
              <td colSpan={4} className="tiny muted">
                No new players in the last 14 days.
              </td>
            </tr>
          )}
          {s.cohorts.map((c) => (
            <tr key={c.day}>
              <td>{short(c.day)}</td>
              <td>{c.signups}</td>
              <td>{pct(c.d1, c.signups)}</td>
              <td>{pct(c.d7, c.signups)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="tiny muted">Active means they earned or spent coins, or made quest progress, that day. "…" means it's too early to tell.</span>

      <h3 className="small">What they did this week</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Thing</th>
            <th>Times</th>
            <th>Players</th>
          </tr>
        </thead>
        <tbody>
          {used.map((u) => (
            <tr key={u.label} className={u.times ? "" : "muted"}>
              <td>{u.label}</td>
              <td>{u.times}</td>
              <td>{u.players}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="tiny muted">Not counted: music and reading (nothing is stored for them).</span>

      <h3 className="small">Love life and pets (all time)</h3>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {Object.entries(s.love).map(([stage, n]) => (
          <span key={stage} className="chip">
            {STAGE_LABEL[stage as BondStage] ?? stage}: {n}
          </span>
        ))}
        {Object.entries(s.pets).map(([kind, n]) => (
          <span key={kind} className="chip">
            {PET_BY_KIND.get(kind)?.icon} {PET_BY_KIND.get(kind)?.label ?? kind}: {n}
          </span>
        ))}
        {!Object.keys(s.love).length && !Object.keys(s.pets).length && <span className="tiny muted">None yet.</span>}
      </div>

      <h3 className="small">Reports</h3>
      <span className="small">
        {s.reports.newBugs} new bug report{s.reports.newBugs === 1 ? "" : "s"}, {s.reports.newIdeas} new idea{s.reports.newIdeas === 1 ? "" : "s"}, {s.reports.errors7d} browser error
        {s.reports.errors7d === 1 ? "" : "s"} this week. Read them below in "Beta reports and errors".
      </span>
    </div>
  );
}
