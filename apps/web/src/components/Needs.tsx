// Needs and mood: the chip in the top bar and the panel it opens (six bars, why you feel the way you do, and places
// that would help right now).
import { NEED_ICON, NEED_KEYS, NEED_LABEL, VENUES, VIBE_NEED, isOpenAt, lagosHourOf, venueActions, type NeedKey, type NeedsView, type Vibe, MAX_SKILL, SKILLS, pointsFor, type SkillsView } from "@hc/shared";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { createPortal } from "react-dom";
import { VENUE_SPOTS } from "./cityLayout.js";

/** Places you can actually get to (on the map). */
const ON_MAP = new Set(VENUE_SPOTS.map((s) => s.key));

export function MoodChip({ view, onOpen }: { view: NeedsView; onOpen: () => void }) {
  const low = NEED_KEYS.filter((k) => view.needs[k] < 25);
  return (
    <button type="button" className={`mood-chip mood-${view.mood.label.toLowerCase()}`} onClick={onOpen} aria-label={`Mood: ${view.mood.label}. Open needs.`}>
      <span aria-hidden="true">{view.mood.emoji}</span>
      <span className="hide-sm">{view.mood.label}</span>
      {low.length > 0 && (
        <span className="mood-alert" aria-hidden="true">
          {low.map((k) => NEED_ICON[k]).join("")}
        </span>
      )}
    </button>
  );
}

const barTone = (v: number) => (v < 25 ? "bad" : v < 50 ? "meh" : "ok");

/** Places that fill a need and are open now (the originals; branches share their menus). */
function placesFor(need: NeedKey, hour: number) {
  const vibes = (Object.entries(VIBE_NEED) as [Vibe, NeedKey][]).filter(([, n]) => n === need).map(([v]) => v);
  return VENUES.filter((v) => ON_MAP.has(v.key) && isOpenAt(v, hour) && venueActions(v)[0]?.gives.some((g) => vibes.includes(g))).slice(0, 3);
}

export function NeedsPanel({ view, onClose, onGo }: { view: NeedsView; onClose: () => void; onGo: (venueKey: string) => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    // Focus the sheet once when it opens; refocusing on every re-render pulled focus out of text fields.
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hour = lagosHourOf(new Date());
  const lowest = [...NEED_KEYS].sort((a, b) => view.needs[a] - view.needs[b]).slice(0, 2).filter((k) => view.needs[k] < 70);

  // Rendered at the top of the page so it sits above the full-screen map and its header.
  return createPortal(
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet needs-sheet" role="dialog" aria-modal="true" aria-label="Your needs and mood" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <span className="venue-icon" aria-hidden="true">
            {view.mood.emoji}
          </span>
          <div>
            <h2>Feeling {view.mood.label.toLowerCase()}</h2>
            <span className="small muted">Mood {view.mood.score}/100. Needs run down through the day; places in town fill them.</span>
          </div>
        </div>
        <ul className="need-bars">
          {NEED_KEYS.map((k) => (
            <li key={k}>
              <span className="need-name">
                <span aria-hidden="true">{NEED_ICON[k]}</span> {NEED_LABEL[k]}
              </span>
              <span className="need-bar" role="meter" aria-label={NEED_LABEL[k]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.needs[k])}>
                <span className={barTone(view.needs[k])} style={{ width: `${view.needs[k]}%` }} />
              </span>
              <span className="num tiny">{Math.round(view.needs[k])}</span>
            </li>
          ))}
        </ul>
        <SkillsList />
        {view.mood.moodlets.length > 0 && (
          <div className="moodlets">
            {view.mood.moodlets.map((m) => (
              <span key={m.key} className={`moodlet ${m.delta < 0 ? "bad" : "good"}`}>
                {m.label} {m.delta > 0 ? `+${m.delta}` : m.delta}
              </span>
            ))}
          </div>
        )}
        {lowest.map((k) => {
          const places = placesFor(k, hour);
          return places.length ? (
            <div key={k} className="need-fix">
              <strong className="small">
                {NEED_ICON[k]} Low on {NEED_LABEL[k].toLowerCase()}? Try:
              </strong>
              <div className="row">
                {places.map((v) => (
                  <button key={v.key} type="button" className="btn sm" onClick={() => onGo(v.key)}>
                    {v.icon} {v.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null;
        })}
      </div>
    </div>,
    document.body,
  );
}

/** Your skills: level, progress to the next, and what each is good for. */
function SkillsList() {
  const [skills, setSkills] = useState<SkillsView | null>(null);
  useEffect(() => {
    api<SkillsView>("GET", "/api/game/skills")
      .then(setSkills)
      .catch(() => undefined);
  }, []);
  if (!skills) return null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <strong className="small">Skills</strong>
      <ul className="need-bars">
        {SKILLS.map((s) => {
          const { points, level } = skills[s.key];
          const from = pointsFor(level);
          const to = pointsFor(level + 1);
          const pct = level >= MAX_SKILL ? 100 : (100 * (points - from)) / (to - from);
          return (
            <li key={s.key} title={`${s.perk}. Grow it at: ${s.grow}.`}>
              <span className="need-name">
                <span aria-hidden="true">{s.icon}</span> {s.label}
              </span>
              <span className="need-bar" role="meter" aria-label={`${s.label} level ${level}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                <span className="skill-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="num tiny">Lv {level}</span>
            </li>
          );
        })}
      </ul>
      <span className="tiny muted">Grow skills by doing things at matching places, working shifts and going to lectures. Charisma and Fitness help with the area boys; every skill raises pay at its jobs.</span>
    </div>
  );
}
