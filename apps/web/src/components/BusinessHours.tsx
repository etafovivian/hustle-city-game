// Opening hours: the owner sets them (Phone → Business); customers see "Open now" or when it opens on the card.
import { DEFAULT_HOURS, hoursText, isBusinessOpen, type BusinessHours, type MyBusiness } from "@hc/shared";
import { Clock } from "lucide-react";
import { useState } from "react";
import { api } from "../api.js";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourOpt = (h: number) => (h === 0 || h === 24 ? "Midnight" : h === 12 ? "Noon" : h < 12 ? `${h} am` : `${h - 12} pm`);

/** "Open now · Mon–Sat 8am–7pm" (or Closed). */
export function OpenNow({ hours }: { hours: BusinessHours | null }) {
  if (!hours) return null;
  const open = isBusinessOpen(hours, new Date());
  return (
    <p className={`small ${open ? "notice" : "muted"}`}>
      <Clock size={14} aria-hidden="true" /> {open ? "Open now" : "Closed now"} · {hoursText(hours)}
    </p>
  );
}

export function HoursEditor({ biz, notify, onSaved }: { biz: MyBusiness; notify: (m: string) => void; onSaved: (b: MyBusiness) => void }) {
  const [h, setH] = useState<BusinessHours>(biz.hours ?? DEFAULT_HOURS);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await api<MyBusiness>("POST", `/api/businesses/${biz.id}/hours`, h));
      notify("Opening hours saved");
      setOpen(false);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        <Clock size={14} aria-hidden="true" /> {biz.hours ? hoursText(biz.hours) : "Set opening hours"}
      </button>
    );
  return (
    <div className="stack hours-editor">
      <div className="row" style={{ gap: 4 }}>
        {DAYS.map((d, i) => (
          <button key={d} type="button" className="chip" aria-pressed={h.days.includes(i)} onClick={() => setH((x) => ({ ...x, days: x.days.includes(i) ? x.days.filter((y) => y !== i) : [...x.days, i] }))}>
            {d}
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <label className="small row" style={{ gap: 4 }}>
          Opens
          <select className="input" value={h.open} onChange={(e) => setH((x) => ({ ...x, open: Number(e.target.value) }))}>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {hourOpt(i)}
              </option>
            ))}
          </select>
        </label>
        <label className="small row" style={{ gap: 4 }}>
          Closes
          <select className="input" value={h.close} onChange={(e) => setH((x) => ({ ...x, close: Number(e.target.value) }))}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
              <option key={i} value={i}>
                {hourOpt(i)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <button type="button" className="btn sm go" disabled={busy || !h.days.length} onClick={() => void save()}>
          Save hours
        </button>
        <button type="button" className="btn sm quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
