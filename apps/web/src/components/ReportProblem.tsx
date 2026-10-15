// Phone → Report: beta testers tell us what's wrong (or what they'd love), with where they were and their device
// attached. Admins read reports and the errors caught in players' browsers in Phone → Admin.
import { Bug } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { BUILD, betaContext } from "../beta.js";

const KINDS = [
  ["bug", "🐞 Something's broken"],
  ["idea", "💡 An idea"],
  ["other", "💬 Something else"],
] as const;

export function ReportProblem({ notify, onDone, where }: { notify: (m: string) => void; onDone: () => void; where?: string }) {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api("POST", "/api/feedback", { kind, message, context: betaContext({ screenName: where ?? null }) });
      notify("Thank you! We read every report.");
      onDone();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>
          <Bug size={20} aria-hidden="true" /> Report a problem
        </h2>
        <p className="small muted">You're playing the beta. Tell us what went wrong, or what would make the game better. Screenshots help: describe what you saw and where.</p>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {KINDS.map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      <textarea
        className="input"
        rows={5}
        maxLength={1000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={kind === "bug" ? "What happened, and what did you expect? e.g. \"At the buka, I tapped Eat and nothing happened.\"" : "Tell us…"}
        aria-label="Your report"
      />
      <span className="tiny muted">We also send: your phone or browser, screen size, where you are on the map and the game version ({BUILD}). Nothing else.</span>
      <button type="button" className="btn go" disabled={busy || message.trim().length < 5} onClick={() => void send()}>
        Send
      </button>
    </div>
  );
}

type Row = { id: string; kind: string; message: string; context: Record<string, unknown>; count: number; status: string; nickname: string | null; createdAt: string; lastAt: string };

/** Admin: beta reports and browser errors. */
export function AdminFeedback({ notify }: { notify: (m: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("new");
  const [open, setOpen] = useState<string | null>(null);
  const load = () =>
    api<Row[]>("GET", `/api/admin/feedback?kind=${kind}&status=${status}`)
      .then(setRows)
      .catch(() => setRows([]));
  useEffect(() => {
    void load();
  }, [kind, status]);
  const mark = async (id: string, s: string) => {
    await api("POST", `/api/admin/feedback/${id}`, { status: s }).catch((e: Error) => notify(e.message));
    void load();
  };
  const when = (iso: string) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
  return (
    <div className="stack">
      <h2 style={{ fontSize: 20 }}>Beta reports and errors</h2>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind">
          {["all", "bug", "idea", "other", "error"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {["new", "seen", "fixed", "all"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </div>
      {rows?.length === 0 && <p className="small muted">Nothing here.</p>}
      {rows?.map((r) => (
        <div key={r.id} className="quote-card">
          <strong className="small">
            {r.kind === "error" ? "⚠️" : r.kind === "bug" ? "🐞" : r.kind === "idea" ? "💡" : "💬"} {r.message}
          </strong>
          <span className="tiny muted">
            {r.nickname ? `@${r.nickname}` : "signed out"} · {when(r.lastAt)}
            {r.count > 1 ? ` · ×${r.count}` : ""} · {String(r.context.screen ?? "")} · build {String(r.context.build ?? "?")}
          </span>
          {open === r.id && <pre className="tiny" style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>{JSON.stringify(r.context, null, 2)}</pre>}
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn sm quiet" onClick={() => setOpen(open === r.id ? null : r.id)}>
              {open === r.id ? "Hide details" : "Details"}
            </button>
            {r.status !== "seen" && (
              <button type="button" className="btn sm" onClick={() => void mark(r.id, "seen")}>
                Seen
              </button>
            )}
            {r.status !== "fixed" && (
              <button type="button" className="btn sm go" onClick={() => void mark(r.id, "fixed")}>
                Fixed
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
