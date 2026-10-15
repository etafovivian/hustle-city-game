// Phone → Hustle: the hustle board (see @hc/shared hustle.ts). Players hire players for game jobs; the fee is held
// until the job is done. Plus the admin queue for disputes and reported jobs.
import { HUSTLE_KINDS, HUSTLE_KIND_BY_KEY, HUSTLE_RULES, VENUES, hustleTextProblem, type HustleJobView, type HustleKind } from "@hc/shared";
import { Flag, Handshake } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatCoins } from "../api.js";

type Board = { open: HustleJobView[]; mine: HustleJobView[] };
const placeName = (key: string | null) => (key ? (VENUES.find((v) => v.key === key)?.name ?? key) : null);
const time = (iso: string) => new Intl.DateTimeFormat("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
const STATUS: Record<HustleJobView["status"], string> = {
  open: "Waiting for someone",
  taken: "In progress",
  done: "Done, waiting for payment",
  paid: "Paid ✓",
  cancelled: "Cancelled, fee returned",
  disputed: "Disputed: an admin will decide",
  removed: "Taken down after reports",
};

function JobCard({ job, children }: { job: HustleJobView; children?: React.ReactNode }) {
  const kind = HUSTLE_KIND_BY_KEY.get(job.kind);
  return (
    <div className="quote-card hustle-job">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}>
        <strong>
          {kind?.icon} {job.title}
        </strong>
        <span className="hustle-fee">{formatCoins(job.fee)}</span>
      </div>
      <span className="tiny muted">
        {kind?.label} · by @{job.poster.nickname}
        {job.place ? ` · at ${placeName(job.place)}` : ""}
        {job.worker ? ` · @${job.worker.nickname} on it` : ""}
      </span>
      {job.details && <span className="small">{job.details}</span>}
      {children}
    </div>
  );
}

export function HustleBoard({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<"open" | "mine" | "post">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const load = () =>
    api<Board>("GET", "/api/hustle")
      .then(setBoard)
      .catch(() => setBoard({ open: [], mine: [] }));
  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      setNow(Date.now());
      void load();
    }, 30_000);
    return () => window.clearInterval(t);
  }, []);
  const act = async (job: HustleJobView, path: string, done: string, body?: unknown) => {
    setBusy(job.id + path);
    try {
      await api("POST", `/api/hustle/${job.id}/${path}`, body);
      notify(done);
      void load();
      onChanged();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const report = (job: HustleJobView) => {
    const reason = window.prompt("What's wrong with this job? (scam, rude, asks for contact or real money…)");
    if (reason && reason.trim().length >= 3) void act(job, "report", "Thanks. We'll look at it; enough reports take a job down straight away.", { reason: reason.trim() });
  };
  const open = board?.open.filter((j) => !j.mine) ?? [];
  const mine = board?.mine ?? [];
  const live = mine.filter((j) => ["open", "taken", "done", "disputed"].includes(j.status)).length;

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>
          <Handshake size={20} aria-hidden="true" /> Hustle board
        </h2>
        <p className="small muted">
          Hire other players for game jobs, or get hired. The fee is held when a job goes up and paid when it's done. Coins only: never pay or accept real money, and never share your number here.
        </p>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {(
          [
            ["open", `Open jobs${open.length ? ` (${open.length})` : ""}`],
            ["mine", `My jobs${live ? ` (${live})` : ""}`],
            ["post", "+ Post a job"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={tab === k} className="chip" onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "open" &&
        (board && open.length === 0 ? (
          <p className="small muted">No open jobs right now. Post one, or check back soon.</p>
        ) : (
          open.map((j) => (
            <JobCard key={j.id} job={j}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <button type="button" className="btn sm go" disabled={busy !== null} onClick={() => void act(j, "take", `You took "${j.title}". Do the work, then mark it done.`)}>
                  Take this job
                </button>
                {!j.reportedByMe && (
                  <button type="button" className="btn sm quiet" onClick={() => report(j)} aria-label="Report this job">
                    <Flag size={14} aria-hidden="true" /> Report
                  </button>
                )}
              </div>
            </JobCard>
          ))
        ))}

      {tab === "mine" &&
        (mine.length === 0 ? (
          <p className="small muted">Nothing yet. Take a job from the board, or post one.</p>
        ) : (
          mine.map((j) => {
            const finishIn = j.canFinishAt ? Math.max(0, Math.ceil((new Date(j.canFinishAt).getTime() - now) / 60_000)) : 0;
            const noShow = j.takenAt ? now - new Date(j.takenAt).getTime() > HUSTLE_RULES.noShowHours * 3_600_000 : false;
            return (
              <JobCard key={j.id} job={j}>
                <span className={`tiny hustle-status ${j.status}`}>
                  {j.working ? "You're the worker" : "You posted this"} · {STATUS[j.status]}
                </span>
                {j.working && j.status === "taken" && (
                  <div className="row">
                    <button type="button" className="btn sm go" disabled={busy !== null || finishIn > 0} onClick={() => void act(j, "done", "Marked done. You'll be paid when they confirm (or on its own in a day).")}>
                      {finishIn > 0 ? `Working… ${finishIn} min left` : "Mark it done"}
                    </button>
                    {j.place && VENUES.some((v) => v.key === j.place) && (
                      <button type="button" className="btn sm" onClick={() => window.dispatchEvent(new CustomEvent("hc:open-venue", { detail: j.place }))}>
                        Show the place
                      </button>
                    )}
                    <button type="button" className="btn sm quiet" disabled={busy !== null} onClick={() => void act(j, "drop", "You gave the job back.")}>
                      Give it back
                    </button>
                  </div>
                )}
                {j.working && j.status === "done" && j.autoPayAt && <span className="tiny muted">Pays on its own by {time(j.autoPayAt)} if they don't confirm sooner.</span>}
                {j.mine && j.status === "done" && (
                  <div className="row">
                    <button type="button" className="btn sm go" disabled={busy !== null} onClick={() => void act(j, "confirm", `Paid @${j.worker?.nickname} ${formatCoins(j.fee)} coins.`)}>
                      Confirm and pay
                    </button>
                    <button
                      type="button"
                      className="btn sm quiet"
                      disabled={busy !== null}
                      onClick={() => window.confirm("Say the work wasn't done? The fee stays held until an admin decides.") && void act(j, "dispute", "Disputed. An admin will look at it.")}
                    >
                      It wasn't done
                    </button>
                  </div>
                )}
                {j.mine && (j.status === "open" || (j.status === "taken" && noShow)) && (
                  <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} disabled={busy !== null} onClick={() => void act(j, "cancel", "Cancelled. Your coins are back.")}>
                    {j.status === "taken" ? "They never finished: cancel" : "Cancel the job"}
                  </button>
                )}
              </JobCard>
            );
          })
        ))}

      {tab === "post" && (
        <PostForm
          notify={notify}
          onPosted={() => {
            setTab("mine");
            void load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function PostForm({ notify, onPosted }: { notify: (m: string) => void; onPosted: () => void }) {
  const [kind, setKind] = useState<HustleKind>("cook");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [fee, setFee] = useState(HUSTLE_KIND_BY_KEY.get("cook")!.hint);
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);
  const problem = hustleTextProblem(title) ?? hustleTextProblem(details);
  const info = HUSTLE_KIND_BY_KEY.get(kind)!;
  const post = async () => {
    setBusy(true);
    try {
      await api("POST", "/api/hustle", { kind, title, details, fee, place: place || null });
      notify(`Posted. ${formatCoins(fee)} coins are held until the job is done.`);
      onPosted();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="small stack" style={{ gap: 4 }}>
        What do you need?
        <select
          className="input"
          value={kind}
          onChange={(e) => {
            const k = e.target.value as HustleKind;
            setKind(k);
            setFee(HUSTLE_KIND_BY_KEY.get(k)!.hint);
          }}
        >
          {HUSTLE_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.icon} {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="small stack" style={{ gap: 4 }}>
        Title
        <input className="input" value={title} maxLength={HUSTLE_RULES.titleMax} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Jollof for my birthday party" />
      </label>
      <label className="small stack" style={{ gap: 4 }}>
        Details (optional)
        <textarea className="input" rows={3} value={details} maxLength={HUSTLE_RULES.detailsMax} onChange={(e) => setDetails(e.target.value)} placeholder="What, where and when, in the game" />
      </label>
      <label className="small stack" style={{ gap: 4 }}>
        Where (optional)
        <select className="input" value={place} onChange={(e) => setPlace(e.target.value)}>
          <option value="">Anywhere</option>
          {VENUES.map((v) => (
            <option key={v.key} value={v.key}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="small stack" style={{ gap: 4 }}>
        Fee in coins (a fair fee is about {formatCoins(info.hint)})
        <input className="input" type="number" inputMode="numeric" min={HUSTLE_RULES.minFee} max={HUSTLE_RULES.maxFee} value={fee} onChange={(e) => setFee(Math.round(Number(e.target.value) || 0))} />
      </label>
      <span className="tiny muted">
        The worker needs at least {info.minutes} minutes on the job before they can mark it done, and gets {HUSTLE_KIND_BY_KEY.get(kind)!.skill} skill for it. You can have {HUSTLE_RULES.maxOpenPosts} jobs going at once.
      </span>
      {problem && <p className="alert small">{problem}</p>}
      <button
        type="button"
        className="btn go"
        disabled={busy || !!problem || title.trim().length < 3 || fee < HUSTLE_RULES.minFee || fee > HUSTLE_RULES.maxFee}
        onClick={() => void post()}
      >
        Post the job · hold {formatCoins(fee)} coins
      </button>
    </div>
  );
}

/** Admin: disputed jobs and reported ones. */
export function AdminHustle({ notify }: { notify: (m: string) => void }) {
  const [jobs, setJobs] = useState<(HustleJobView & { reports: string[] })[] | null>(null);
  const load = () =>
    api<(HustleJobView & { reports: string[] })[]>("GET", "/api/admin/hustle")
      .then(setJobs)
      .catch(() => setJobs([]));
  useEffect(() => {
    void load();
  }, []);
  const resolve = async (id: string, decision: "pay" | "refund" | "remove") => {
    try {
      await api("POST", `/api/admin/hustle/${id}/resolve`, { decision });
      notify("Done");
      void load();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <div className="stack">
      <h2 style={{ fontSize: 20 }}>Hustle board: disputes and reports</h2>
      {jobs?.length === 0 && <p className="small muted">Nothing to look at.</p>}
      {jobs?.map((j) => (
        <JobCard key={j.id} job={j}>
          <span className="tiny">Status: {STATUS[j.status]}</span>
          {j.reports.length > 0 && <span className="tiny">Reports: {j.reports.map((r) => `"${r}"`).join(" · ")}</span>}
          <div className="row" style={{ flexWrap: "wrap" }}>
            {j.status === "disputed" && j.worker && (
              <button type="button" className="btn sm go" onClick={() => void resolve(j.id, "pay")}>
                Pay the worker
              </button>
            )}
            {["disputed", "taken", "open"].includes(j.status) && (
              <button type="button" className="btn sm" onClick={() => void resolve(j.id, "refund")}>
                Refund the poster
              </button>
            )}
            {j.status !== "removed" && (
              <button type="button" className="btn sm quiet" onClick={() => void resolve(j.id, "remove")}>
                Take it down
              </button>
            )}
          </div>
        </JobCard>
      ))}
    </div>
  );
}
