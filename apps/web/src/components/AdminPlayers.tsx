// Phone → Admin → Players: everyone who has signed up, with a search, newest first.
import { TESTER_BY_KEY, type AdminPlayerRow } from "@hc/shared";
import { Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, formatCoins } from "../api.js";

type Sort = "joined" | "last" | "days" | "xp" | "coins";
const SORTS: [Sort, string][] = [
  ["joined", "Newest"],
  ["last", "Last played"],
  ["days", "Days played"],
  ["xp", "XP"],
  ["coins", "Coins"],
];

export function AdminPlayers() {
  const [rows, setRows] = useState<AdminPlayerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("joined");
  const [open, setOpen] = useState<string | null>(null);
  const load = () =>
    void api<AdminPlayerRow[]>("GET", "/api/admin/players")
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  useEffect(load, []);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => !t || r.nickname.toLowerCase().includes(t) || r.email.toLowerCase().includes(t));
    const key: Record<Sort, (r: AdminPlayerRow) => string | number> = {
      joined: (r) => r.joined,
      last: (r) => r.lastDay ?? "",
      days: (r) => r.days,
      xp: (r) => r.xp,
      coins: (r) => r.coins,
    };
    return [...list].sort((a, b) => (key[sort](b) > key[sort](a) ? 1 : key[sort](b) < key[sort](a) ? -1 : 0));
  }, [rows, q, sort]);
  if (error) return <p className="small alert">{error}</p>;
  const players = (rows ?? []).filter((r) => !r.roles.includes("admin")).length;
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 20 }}>
          <Users size={20} aria-hidden="true" /> Players {rows && <span className="small muted">({players} players, {rows.length - players} admins)</span>}
        </h2>
        <button type="button" className="btn sm quiet" onClick={load}>
          Refresh
        </button>
      </div>
      <input className="input" type="search" placeholder="Search nickname or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {SORTS.map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>
            {label}
          </button>
        ))}
      </div>
      {!rows ? (
        <p className="small muted">Loading players…</p>
      ) : (
        <ul className="admin-players">
          {shown.map((r) => (
            <li key={r.userId}>
              <button type="button" className="admin-player-head" aria-expanded={open === r.userId} onClick={() => setOpen(open === r.userId ? null : r.userId)}>
                <span>
                  <strong>@{r.nickname}</strong>
                  {r.roles.includes("admin") && <span className="tiny admin-tag"> admin</span>}
                  {r.status !== "active" && <span className="tiny alert"> {r.status}</span>}
                  {r.tester && <span className="tiny"> {TESTER_BY_KEY.get(r.tester)?.icon}</span>}
                </span>
                <span className="tiny muted">
                  {r.days} {r.days === 1 ? "day" : "days"} · {r.lastDay ? `last ${r.lastDay}` : "never played"}
                </span>
              </button>
              {open === r.userId && (
                <dl className="admin-player-info tiny">
                  <dt>Email</dt>
                  <dd>{r.email}</dd>
                  <dt>Joined</dt>
                  <dd>{r.joined}</dd>
                  <dt>XP · coins</dt>
                  <dd>
                    {formatCoins(r.xp)} XP · {formatCoins(r.coins)} coins
                  </dd>
                  <dt>Hustle</dt>
                  <dd>{r.hustle.replace(/_/g, " ")}</dd>
                  <dt>Land</dt>
                  <dd>{r.plots ? `${r.plots} ${r.plots === 1 ? "plot" : "plots"}${r.home ? ` · home: ${r.home.replace(/_/g, " ")}` : " · no house yet"}` : "none"}</dd>
                  <dt>Tester</dt>
                  <dd>{r.tester ? TESTER_BY_KEY.get(r.tester)?.label : "–"}</dd>
                  <dt>Reports</dt>
                  <dd>{r.reports}</dd>
                  <dt>Roles</dt>
                  <dd>{r.roles.join(", ")}</dd>
                </dl>
              )}
            </li>
          ))}
          {shown.length === 0 && <li className="small muted">No one matches “{q}”.</li>}
        </ul>
      )}
    </div>
  );
}
