// Jobs board: real vacancies from verified Lagos businesses (Phone → Jobs), and posting and hiring (Phone → Business).
import { LAGOS_AREAS, VACANCY_KINDS, type ApplicationView, type MyBusiness, type VacancyView } from "@hc/shared";
import { BadgeCheck, Briefcase, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";

const kindLabel = (k: string) => VACANCY_KINDS.find((x) => x.key === k)?.label ?? k;

export function JobsBoard({ notify }: { notify: (m: string) => void }) {
  const [list, setList] = useState<VacancyView[] | null>(null);
  const [area, setArea] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const load = () =>
    api<VacancyView[]>("GET", `/api/vacancies${area ? `?area=${encodeURIComponent(area)}` : ""}`)
      .then(setList)
      .catch(() => setList([]));
  useEffect(() => {
    void load();
  }, [area]);
  const apply = async (id: string) => {
    try {
      await api("POST", `/api/vacancies/${id}/apply`, { message, contact });
      notify("Application sent. The business will call you if you're shortlisted.");
      setApplying(null);
      setMessage("");
      void load();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <div className="stack">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>
          <Briefcase size={20} aria-hidden="true" /> Real jobs in Lagos
        </h2>
        <p className="small muted">From verified businesses only. Never pay anyone to get a job. Your Academy certificates are shown with your application.</p>
      </div>
      <select className="input" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
        <option value="">All areas</option>
        {LAGOS_AREAS.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
      {list?.length === 0 && <p className="small muted">No open jobs here yet. Check back soon.</p>}
      {list?.map((v) => (
        <div key={v.id} className="quote-card">
          <strong>{v.title}</strong>
          <span className="tiny muted">
            {v.businessName} <BadgeCheck size={12} aria-label="Verified business" /> · {v.area} · {kindLabel(v.kind)}
            {v.pay ? ` · ${v.pay}` : ""}
          </span>
          <span className="small">{v.description}</span>
          {v.wantsCertificate && (
            <span className="tiny">
              <GraduationCap size={12} aria-hidden="true" /> Academy certificate holders preferred
            </span>
          )}
          {v.applied ? (
            <span className="notice small">Applied ✓</span>
          ) : applying === v.id ? (
            <div className="stack" style={{ gap: 6 }}>
              <textarea className="input" rows={3} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="A few lines about you and why you'd be good at this" aria-label="Message" />
              <input className="input" value={contact} maxLength={20} onChange={(e) => setContact(e.target.value)} placeholder="Your phone or WhatsApp (e.g. 0803 123 4567)" aria-label="Phone" inputMode="tel" />
              <span className="tiny muted">Only this business sees your number.</span>
              <div className="row">
                <button type="button" className="btn sm go" disabled={message.trim().length < 10 || !contact.trim()} onClick={() => void apply(v.id)}>
                  Send application
                </button>
                <button type="button" className="btn sm quiet" onClick={() => setApplying(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn sm go" style={{ justifySelf: "start" }} onClick={() => setApplying(v.id)}>
              Apply
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Phone → Business: post jobs (verified businesses) and see applicants. */
export function BusinessJobs({ biz, notify }: { biz: MyBusiness; notify: (m: string) => void }) {
  const [list, setList] = useState<VacancyView[]>([]);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ title: "", kind: "full_time", pay: "", area: biz.serviceArea, description: "", wantsCertificate: false });
  const [openApps, setOpenApps] = useState<{ id: string; apps: ApplicationView[] } | null>(null);
  const load = () =>
    api<VacancyView[]>("GET", `/api/businesses/${biz.id}/vacancies`)
      .then(setList)
      .catch(() => undefined);
  useEffect(() => {
    void load();
  }, [biz.id]);
  const post = async () => {
    try {
      await api("POST", `/api/businesses/${biz.id}/vacancies`, form);
      notify("Job posted");
      setPosting(false);
      void load();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const showApps = async (id: string) => setOpenApps({ id, apps: await api<ApplicationView[]>("GET", `/api/vacancies/${id}/applications`) });
  const decide = async (appId: string, status: "shortlisted" | "declined") => {
    await api("POST", `/api/applications/${appId}/status`, { status }).catch((e: Error) => notify(e.message));
    if (openApps) void showApps(openApps.id);
  };
  const close = async (id: string) => {
    await api("POST", `/api/vacancies/${id}/close`);
    void load();
  };
  return (
    <div className="stack" style={{ gap: 6 }}>
      <strong className="small">
        <Briefcase size={14} aria-hidden="true" /> Jobs
      </strong>
      {!biz.verified && <span className="tiny muted">Get verified to post jobs (it keeps job scams out).</span>}
      {list.map((v) => (
        <div key={v.id} className="table-row">
          <span className="tiny">
            <b>{v.title}</b> · {v.status === "open" ? `${v.applications ?? 0} applied` : "closed"}
          </span>
          <span className="row" style={{ gap: 4 }}>
            {(v.applications ?? 0) > 0 && (
              <button type="button" className="btn sm" onClick={() => void showApps(v.id)}>
                Applicants
              </button>
            )}
            {v.status === "open" && (
              <button type="button" className="btn sm quiet" onClick={() => void close(v.id)}>
                Close
              </button>
            )}
          </span>
        </div>
      ))}
      {openApps?.apps.map((a) => (
        <div key={a.id} className="quote-card">
          <strong className="small">
            @{a.nickname} · {a.contact}
          </strong>
          <span className="small">{a.message}</span>
          {(a.certificates.length > 0 || a.degrees.length > 0) && (
            <span className="tiny">
              <GraduationCap size={12} aria-hidden="true" /> {[...a.certificates.map((c) => `${c.courseTitle} (${c.number})`), ...a.degrees].join(" · ")}
            </span>
          )}
          {a.status === "new" ? (
            <div className="row">
              <button type="button" className="btn sm go" onClick={() => void decide(a.id, "shortlisted")}>
                Shortlist
              </button>
              <button type="button" className="btn sm quiet" onClick={() => void decide(a.id, "declined")}>
                Decline
              </button>
            </div>
          ) : (
            <span className="tiny muted">{a.status === "shortlisted" ? "Shortlisted: call them" : "Declined"}</span>
          )}
        </div>
      ))}
      {biz.verified &&
        (posting ? (
          <div className="stack" style={{ gap: 6 }}>
            <input className="input" value={form.title} maxLength={60} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Job title (e.g. Sales assistant)" aria-label="Job title" />
            <div className="row" style={{ gap: 6 }}>
              <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Kind">
                {VACANCY_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
              <select className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} aria-label="Area">
                {LAGOS_AREAS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <input className="input" value={form.pay} maxLength={60} onChange={(e) => setForm({ ...form, pay: e.target.value })} placeholder="Pay (e.g. ₦80,000 a month)" aria-label="Pay" />
            <textarea className="input" rows={3} maxLength={800} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the job is and who you want" aria-label="Description" />
            <label className="small row" style={{ gap: 6 }}>
              <input type="checkbox" checked={form.wantsCertificate} onChange={(e) => setForm({ ...form, wantsCertificate: e.target.checked })} /> Prefer Academy certificate holders
            </label>
            <div className="row">
              <button type="button" className="btn sm go" onClick={() => void post()}>
                Post job
              </button>
              <button type="button" className="btn sm quiet" onClick={() => setPosting(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn sm" style={{ justifySelf: "start" }} onClick={() => setPosting(true)}>
            Post a job
          </button>
        ))}
    </div>
  );
}
