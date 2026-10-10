// Venues on the map: the building, a floating icon badge with its name, and the place card
// (story, regulars, paid activities, walk there, and real businesses where it fits).
import { CHIEF_TITLE, NPC_BY_KEY, eventAt, GAME_TABLES, TABLE_GAMES, JOB_BY_VENUE, SHIFT_COST, SHIFT_SECONDS, VENUES_BY_KEY, VIBE_LABEL, type JobView, type PresencePlayer, type AvatarConfig, clockHour, hoursLabel, isOpenAt, venueActions, venueHours, type Venue, type VenueAction, type VenueDay } from "@hc/shared";
import { Briefcase, CheckCircle2, Clock, Coins, Crown, Footprints, GraduationCap, Sparkles, Store, Timer, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, formatCoins } from "../api.js";
import { INK } from "../prints.js";
import { InteriorScene, ROOMS, type PlayerAction } from "./Interior.js";
import { GameTables } from "./Tables.js";
import { UniversityPanel } from "./University.js";
import { playAdhan, stopAdhan } from "./Ambience.js";
import { RoomChat } from "./Chat.js";
import { Haggle, Stalls } from "./Market.js";
import { GadgetCounter } from "./Gadgets.js";
import { PeopleHere, withRegulars } from "./Love.js";
import { dateRoom, endDate, holdDate, useDateAt } from "./Dates.js";
import { Garage } from "./Home.js";
import { useLagosLight } from "./lagosTime.js";
import { SponsorBanner } from "./Sponsors.js";
import { buildingBox } from "./sprites.js";
import type { DepthItem } from "./People.js";
import { WALKER_VARIANTS, walkerSheet, walkerSize } from "./walkers.js";

/** The building: tap to open its card. */
export function VenueBuilding({ venue, x, y, scale = 1, onOpen }: { venue: Venue; x: number; y: number; scale?: number; onOpen: () => void }) {
  const box = buildingBox(venue.art, x, y, scale);
  return (
    <g
      className="hotspot venue"
      role="button"
      tabIndex={0}
      aria-label={`${venue.name}, ${venue.area}. Open.`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
    >
      <ellipse cx={x} cy={y} rx={box.w * 0.42} ry={box.w * 0.09} fill="rgb(0 0 0 / 28%)" />
      <g className="bld">
        <image href={venue.art} x={box.x} y={box.y} width={box.w} height={box.h} />
      </g>
    </g>
  );
}

/** Your chieftaincy title, if the Oba has given you one (the palace's flex). */
function ChiefTitle() {
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    api<{ title: string | null }>("GET", "/api/game/title")
      .then((r) => setTitle(r.title))
      .catch(() => undefined);
  }, []);
  return title ? <p className="small notice">👑 You are Chief, {title}. Everyone sees it on your player card.</p> : <p className="small muted">👑 Flex here and the Oba makes you a chief: the title shows on your player card for good.</p>;
}

/** Venues drawn at least this big are cut into upright slices for depth order (see venueDepthItems). */
const SLICE_FROM = 1.4;
/** Front edge of a building's footprint at x: the foot point, rising half as fast as it goes sideways (2:1 iso). */
const frontY = (x: number, y: number, at: number) => y - Math.abs(at - x) / 2;
/** Depth of the slice [x0, x1]: the front edge's nearest point (the middle slice carries the foot point itself). */
const sliceDepth = (x: number, y: number, x0: number, x1: number) => frontY(x, y, x0 < x && x < x1 ? x : Math.abs(x0 - x) < Math.abs(x1 - x) ? x0 : x1);
const sliceCount = (scale: number) => Math.ceil(scale * 4);

/**
 * A venue on the buildings layer. A big landmark has one foot point but a long front edge, so as one sprite it would hide
 * people standing just in front of its sides. Big ones are cut into upright slices, each sorted by the front edge's
 * depth at its middle, so whoever stands in front of any part of it is drawn over that part.
 */
export function venueDepthItems(venue: Venue, x: number, y: number, scale: number, onOpen: () => void): DepthItem[] {
  if (scale < SLICE_FROM) return [{ key: `venue-${venue.key}`, y, node: <VenueBuilding venue={venue} x={x} y={y} scale={scale} onOpen={onOpen} /> }];
  const box = buildingBox(venue.art, x, y, scale);
  const n = sliceCount(scale);
  return Array.from({ length: n }, (_, i) => {
    const [x0, x1] = [box.x + (box.w * i) / n, box.x + (box.w * (i + 1)) / n];
    const id = `slice-${venue.key}-${i}`;
    return {
      key: `venue-${venue.key}-${i}`,
      y: sliceDepth(x, y, x0, x1),
      node: (
        <g clipPath={`url(#${id})`}>
          <defs>
            <clipPath id={id} clipPathUnits="userSpaceOnUse">
              {/* a hair wider than the slice, so no seam shows between neighbours */}
              <rect x={x0 - 0.5} y={box.y - 10} width={x1 - x0 + 1} height={box.h + box.w * 0.2} />
            </clipPath>
          </defs>
          <VenueBuilding venue={venue} x={x} y={y} scale={scale} onOpen={onOpen} />
        </g>
      ),
    };
  });
}

/** Deterministic random in [0, 1). */
const rand = (k: number) => {
  const t = Math.sin(k * 12.9898) * 43758.5453;
  return t - Math.floor(t);
};
/** Where a landmark's crowd stands on event days: a diamond on its art (centre and half-size, as shares of the image). */
export const CROWD_AT: Record<string, { cx: number; cy: number; rx: number; ry: number; people: number }> = {
  // Independence Square's parade ground
  independence_square: { cx: 0.42, cy: 0.56, rx: 0.17, ry: 0.12, people: 36 },
  // The street in front of the palace's carved gate (the image's front-left edge and just past it)
  oba_palace: { cx: 0.24, cy: 0.95, rx: 0.16, ry: 0.07, people: 12 },
};
const PERSON = walkerSize(64);
/** The crowd on a landmark while its event is on: people standing about (and swaying) on its open ground. */
export function crowdDepthItems(venue: Venue, x: number, y: number, scale: number): DepthItem[] {
  const at = CROWD_AT[venue.key];
  if (!at) return [];
  const box = buildingBox(venue.art, x, y, scale);
  const n = scale < SLICE_FROM ? 1 : sliceCount(scale);
  const out: DepthItem[] = [];
  for (let i = 0; i < at.people; i++) {
    // A point in the diamond: two uniform coordinates along its axes
    const [u, v] = [rand(i + 1) * 2 - 1, rand(i + 101) * 2 - 1];
    const px = box.x + box.w * (at.cx + (at.rx * (u + v)) / 2);
    const py = box.y + box.h * (at.cy + (at.ry * (v - u)) / 2);
    const slice = Math.min(n - 1, Math.max(0, Math.floor(((px - box.x) / box.w) * n)));
    const variant = WALKER_VARIANTS[i % WALKER_VARIANTS.length]!;
    const dir = rand(i + 201) < 0.5 ? "ne" : "nw";
    out.push({
      key: `crowd-${venue.key}-${i}`,
      // Just after the slice it stands in (people further forward after people further back)
      y: sliceDepth(x, y, box.x + (box.w * slice) / n, box.x + (box.w * (slice + 1)) / n) + 0.01 + py / 1e6,
      node: (
        <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)})`} aria-hidden="true">
          <animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -3;0 0" dur={`${(0.8 + rand(i + 301) * 0.8).toFixed(2)}s`} repeatCount="indefinite" />
          <ellipse cx="0" cy="-1" rx="11" ry="4" fill="rgb(0 0 0 / 22%)" />
          <svg x={-PERSON.w / 2} y={-PERSON.h + PERSON.ground} width={PERSON.w} height={PERSON.h} overflow="hidden">
            <image href={walkerSheet(variant, dir)} width={PERSON.w * PERSON.frames} height={PERSON.h} />
          </svg>
        </g>
      ),
    });
  }
  return out;
}

/** Icon badge floating above the roof (`y` is the roof top), with the name beside it (drawn above the night tint). */
export function VenueBadge({ venue, x, y, scale, showName, onOpen, live }: { venue: Venue; x: number; y: number; scale: number; showName: boolean; onOpen: () => void; live?: string | null }) {
  const nameW = (venue.name.length + (live ? live.length + 3 : 0)) * 7.2 + 22;
  return (
    <g className="venue-badge" transform={`translate(${x} ${y - 16}) scale(${scale})`} onClick={onOpen} aria-hidden="true">
      <line x1="0" y1="18" x2="0" y2="34" stroke="#fff" strokeWidth="3" opacity=".8" />
      {live && (
        <circle r="30" fill="none" stroke="#ffc72c" strokeWidth="5">
          <animate attributeName="r" values="24;40;24" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <circle r="22" fill="#fff" stroke={live ? "#ffc72c" : INK.indigoDeep} strokeWidth="3" />
      <text y="8" textAnchor="middle" fontSize="22">
        {venue.icon}
      </text>
      {showName && (
        <g transform="translate(24 -11)">
          <rect width={nameW} height="22" rx="11" fill="#fff" fillOpacity=".7" stroke={INK.indigoDeep} strokeOpacity=".4" strokeWidth="1" />
          <text x={nameW / 2} y="15" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={INK.indigoDeep}>
            {live ? `${live} · ` : ""}
            {venue.name}
          </text>
        </g>
      )}
    </g>
  );
}

export function VenueCard({
  venueKey,
  onClose,
  onWalk,
  onFindReal,
  onChanged,
  notify,
  onApp,
  branch,
  here = [],
  onPlayer,
  avatar,
  present = true,
}: {
  /** You're actually there (arrived). Away, the card is a preview: look, then Go there. */
  present?: boolean;
  /** Your look, so you appear in the room. */
  avatar?: AvatarConfig;
  /** Players at this place right now. */
  here?: PresencePlayer[];
  onPlayer?: (p: PresencePlayer) => void;
  venueKey: string;
  /** A branch of this place (same room and activities, its own name and area). */
  branch?: { name: string; area: string; key: string };
  onClose: () => void;
  onWalk: () => void;
  onFindReal: () => void;
  onChanged: () => void;
  notify: (m: string) => void;
  /** Open a phone app (the school opens the Academy). */
  onApp?: (app: "academy" | "garage" | "love") => void;
}) {
  const base = VENUES_BY_KEY.get(venueKey)!;
  const venue = branch ? { ...base, name: branch.name, area: branch.area } : base;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  // People you can meet here, standing about in the room (one list per place, so they don't restart on redraws).
  const regulars = useMemo(() => (base.interior ? withRegulars(ROOMS[base.interior.split("/").pop()!.replace(".webp", "")], base.key) : undefined), [base.key]);
  // On a date here (Phone → Love): the two of you in the room, together.
  const date = useDateAt(base.key);
  const scene = useMemo(() => dateRoom(regulars, date), [regulars, date]);
  const room = scene.room;

  useEffect(() => {
    api<VenueDay>("GET", "/api/game/venues/today")
      .then((d) => setDone(new Set(d.done)))
      .catch(() => undefined);
  }, []);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Leaving the place ends a date there.
  useEffect(() => holdDate(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    // Focus the sheet once when it opens; refocusing on every re-render pulled focus out of text fields.
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Inside the mosque you hear the call to prayer (with sound on); it stops when you leave.
  useEffect(() => {
    if (!present || base.key !== "central_mosque") return;
    playAdhan(0.8);
    return () => {
      stopAdhan();
    };
  }, [present, base.key]);
  const hour = useLagosLight().hour;
  // You in the room: you walk in, and each activity takes you to the right spot (a seat to eat, the dance floor…).
  const [me, setMe] = useState<PlayerAction>("walk");
  const actionFor = (a: VenueAction): PlayerAction => {
    const k = `${a.key} ${a.label}`.toLowerCase();
    // Working out: the gym and the boxing club play the matching animation at the right equipment.
    if (/treadmill|jog|run on/.test(k)) return "run";
    if (/dumbbell|weights|lift/.test(k)) return "lift_weights";
    if (/heavy_bag|heavy bag|pads|spar|boxing/.test(k)) return "boxing";
    if (/skip/.test(k)) return "skip";
    if (/danc|party|rave|owambe/.test(k)) return "dance";
    if (/sleep|nap|rest|suite|room/.test(k) && venue.key.includes("hotel")) return "sleep";
    if (a.gives.includes("style") && /cut|trim|braid|hair|wig|measure|aso|fabric|style/.test(k)) return "chair";
    if (a.gives.includes("food")) return "eat";
    // Worship: salah in the mosque, praise and kneeling prayer in church.
    if (/mosque|chapel|church/.test(venue.key) && (a.gives.includes("faith") || /pray|service|jumat|choir/.test(k))) return "pray";
    if (a.gives.includes("social") || a.gives.includes("fun") || a.gives.includes("faith") || a.gives.includes("brain") || a.gives.includes("rest")) return "sit";
    return "stand";
  };
  const open = isOpenAt(venue, hour);
  const liveEvent = eventAt(base.key, new Date());
  const actions = venueActions(venue);
  /** The activity playing now: the room plays for its seconds, then the result shows. */
  const [running, setRunning] = useState<{ action: VenueAction; started: number; gained: number } | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const remain = running.action.seconds - (Date.now() - running.started) / 1000;
      setLeft(Math.max(0, remain));
      if (remain > 0) return;
      window.clearInterval(id);
      const vibes = running.action.gives.map((g) => `+${VIBE_LABEL[g]}`).join(" ");
      if (running.action.key !== "shift") notify(running.gained ? `+${running.gained} XP ${vibes} at ${venue.name}` : `${vibes} at ${venue.name}`);
      setRunning(null);
    };
    const id = window.setInterval(tick, 200);
    tick();
    return () => window.clearInterval(id);
  }, [running, notify, venue.name]);

  // Work here: the place's job ladder, one shift at a time.
  const job = JOB_BY_VENUE.get(venue.key);
  const [work, setWork] = useState<JobView | null>(null);
  useEffect(() => {
    if (!job) return;
    api<JobView>("GET", `/api/game/jobs/${venue.key}`)
      .then(setWork)
      .catch(() => undefined);
  }, [venue.key]);
  const shift = async () => {
    setBusy("shift");
    setError(null);
    try {
      const r = await api<{ pay: number; xp: number; promoted: string | null; job: JobView }>("POST", `/api/game/jobs/${venue.key}/shift`);
      setWork(r.job);
      onChanged();
      setMe("stand");
      setRunning({ action: { key: "shift", label: "Shift", cost: 0, xp: 0, kind: "paid", seconds: SHIFT_SECONDS, gives: [] }, started: Date.now(), gained: 0 });
      notify(r.promoted ? `Promoted to ${r.promoted}! +${formatCoins(r.pay)} coins` : `Shift done: +${formatCoins(r.pay)} coins, +${r.xp} XP`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const act = async (a: VenueAction) => {
    setError(null);
    setMe(actionFor(a));
    if (a.kind === "free") {
      // Free: no coins or XP, but it lifts the place's needs a little (once an hour per place).
      const r = await api<{ filled: boolean }>("POST", `/api/game/venues/${venue.key}/free`).catch(() => ({ filled: false }));
      if (r.filled) onChanged();
      setRunning({ action: a, started: Date.now(), gained: 0 });
      return;
    }
    setBusy(a.key);
    try {
      // Pay first (the server checks hours, coins and once-a-day), then the room plays it out.
      const r = await api<VenueDay & { gained: number; together?: string[]; event?: string | null }>("POST", `/api/game/venues/${venue.key}/${a.key}`);
      if (r.event) notify(`${r.event}: +50% XP`);
      if (r.together?.length) notify(`Together with ${r.together.map((n) => `@${n}`).join(", ")}: +50% XP and extra Social`);
      setDone(new Set(r.done));
      onChanged();
      setRunning({ action: a, started: Date.now(), gained: r.gained });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div ref={sheet} className="visit-sheet venue-card" role="dialog" aria-modal="true" aria-label={venue.name} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="phone-close visit-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="venue-head">
          <span className="venue-icon" aria-hidden="true">
            {venue.icon}
          </span>
          <div>
            <h2>{venue.name}</h2>
            <span className="small muted">{venue.area}</span>
          </div>
        </div>
        <div className={`venue-layout ${venue.interior ? "has-room" : ""}`}>
        {venue.interior && (
          <div className="venue-room">
            <InteriorScene
              src={venue.interior}
              alt={`Inside ${venue.name}`}
              room={room}
              seed={(branch?.key ?? venue.key).length}
              player={avatar && (present || date) ? { avatar, action: date ? "stand" : me, spot: scene.spot ?? undefined } : undefined}
              onPlayerWalk={() => setMe("walk")}
            />
          </div>
        )}
        <div className="venue-info">
        {date && (
          <div className="party-box on">
            <strong className="small">
              {date.wedding ? "💍 Your wedding owambe" : "🌹 On a date"} with {NPC_BY_KEY.get(date.npc)?.name} · {date.label}
            </strong>
            <button type="button" className="btn sm" style={{ justifySelf: "start" }} onClick={() => endDate()}>
              {date.wedding ? "Leave the party" : "End the date"}
            </button>
          </div>
        )}
        {!present && !date && (
          <div className="away-note">
            <span className="small">You're not here yet. Go there to do things, work or chat inside.</span>
            <button type="button" className="btn sm go" onClick={onWalk}>
              <Footprints size={15} aria-hidden="true" /> Go there
            </button>
          </div>
        )}
        <SponsorBanner venue={base.key} />
        <p>{venue.blurb}</p>
        {branch ? (
          <p className="small muted">Same things to do as {base.name} in {base.area}.</p>
        ) : (
          <p className="small muted">Regulars here: {venue.regulars.join(", ")}</p>
        )}

        {here.length > 0 && (
          <div className="here-now" title="Do an activity while they're here: +50% XP and extra Social for you">
            <span className="tiny muted">
              <span className="online-dot" aria-hidden="true" /> Here now
            </span>
            {here.map((p) => (
              <button key={p.nickname} type="button" className="chip" onClick={() => onPlayer?.(p)}>
                @{p.nickname}
              </button>
            ))}
          </div>
        )}
        {liveEvent && (
          <div className="event-chip">
            <strong>
              {liveEvent.icon} {liveEvent.name} is on now
            </strong>
            <span className="tiny">{liveEvent.blurb} Everything here gives +50% XP and an extra lift.</span>
          </div>
        )}
        {base.key === "island_motors" && present && <Garage notify={notify} onChanged={onChanged} showroom />}
        <p className={`venue-hours small ${open ? "open" : "closed"}`}>
          <Clock size={14} aria-hidden="true" /> {hoursLabel(venue, hour)}
          {!open && <span className="muted"> · come back tonight or tomorrow</span>}
        </p>

        <ul className="venue-acts">
          {actions.map((a) => {
            const isDone = a.kind !== "free" && done.has(`${venue.key}:${a.key}`);
            const playing = running?.action.key === a.key;
            return (
              <li key={a.key} className={a.kind === "flex" ? "flex" : a.kind === "free" ? "free" : undefined}>
                <span className="venue-act-label">
                  <strong>
                    {a.kind === "flex" && <Crown size={14} aria-hidden="true" />} {a.label}
                  </strong>
                  <span className="tiny muted venue-meta">
                    {a.cost ? (
                      <>
                        <Coins size={12} aria-hidden="true" /> {formatCoins(a.cost)} coins <span aria-hidden="true">·</span> <Sparkles size={12} aria-hidden="true" /> +{a.xp} XP
                      </>
                    ) : (
                      <>Free</>
                    )}{" "}
                    <span aria-hidden="true">·</span> <Timer size={12} aria-hidden="true" /> {a.seconds}s
                  </span>
                  <span className="vibes">
                    {a.gives.map((g) => (
                      <span key={g} className={`vibe vibe-${g}`}>
                        +{VIBE_LABEL[g]}
                      </span>
                    ))}
                  </span>
                  {playing && (
                    <span className="act-progress" role="progressbar" aria-valuemin={0} aria-valuemax={a.seconds} aria-valuenow={Math.round(a.seconds - left)}>
                      <span style={{ width: `${(100 * (a.seconds - left)) / a.seconds}%` }} />
                    </span>
                  )}
                </span>
                {isDone ? (
                  <span className="notice small">
                    <CheckCircle2 size={15} aria-hidden="true" /> Done today
                  </span>
                ) : playing ? (
                  <span className="small muted">{Math.ceil(left)}s</span>
                ) : !open ? (
                  <span className="small muted">Opens {clockHour(venueHours(venue)![0])}</span>
                ) : !present ? (
                  <span className="small muted">Go there first</span>
                ) : (
                  <button type="button" className={`btn sm ${a.kind === "flex" ? "gold" : "go"}`} disabled={busy !== null || running !== null} onClick={() => void act(a)}>
                    {busy === a.key ? "…" : a.kind === "flex" ? "Flex" : "Do it"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <PeopleHere venue={venue.key} at={branch?.key ?? venue.key} present={present} notify={notify} onLove={onApp && (() => onApp("love"))} />
        {job && work && (
          <div className="work-box">
            <strong className="small row" style={{ gap: 6 }}>
              <Briefcase size={15} aria-hidden="true" /> Work here: {work.title}
            </strong>
            <span className="tiny muted">
              {job.task}. {formatCoins(work.pay)} coins + {work.xp} XP a shift · uses {SHIFT_COST.energy} energy
            </span>
            {work.nextTitle && (
              <span className="act-progress" aria-label={`${work.toNext} shifts to ${work.nextTitle}`}>
                <span style={{ width: `${(100 * (work.shifts - [0, 4, 12, 25][work.rung]!)) / ([4, 12, 25, 25][work.rung]! - [0, 4, 12, 25][work.rung]!)}%` }} />
              </span>
            )}
            <span className="row spread">
              <span className="tiny muted">{work.nextTitle ? `${work.toNext} more shift${work.toNext === 1 ? "" : "s"} to ${work.nextTitle}` : "Top of the ladder"} · {work.shiftsLeftToday} shifts left today</span>
              {running?.action.key === "shift" ? (
                <span className="small muted">{Math.ceil(left)}s</span>
              ) : (
                <button type="button" className="btn sm go" disabled={!present || busy !== null || running !== null || !open || work.shiftsLeftToday === 0} onClick={() => void shift()}>
                  {busy === "shift" ? "…" : "Start shift"}
                </button>
              )}
            </span>
          </div>
        )}
        {present && base.key === "lagoon_city_university" && <UniversityPanel notify={notify} onChanged={onChanged} open={open} onSeated={(on) => setMe(on ? "sit" : "walk")} />}
        {!present && base.key === "lagoon_city_university" && <p className="small muted">🎓 Degrees, lectures and exams happen on campus. Go there to enrol.</p>}
        {present && GAME_TABLES[base.key] && (
          <GameTables place={branch?.key ?? venue.key} games={GAME_TABLES[base.key]!} here={here} notify={notify} onChanged={onChanged} onSeated={(on) => setMe(on ? "sit" : "walk")} />
        )}
        {!present && GAME_TABLES[base.key] && <p className="small muted">🎲 Tables here: {GAME_TABLES[base.key]!.map((g) => TABLE_GAMES[g].label).join(", ")}. Go there to sit down and play with whoever's around.</p>}
        {base.key === "balogun_market" && open && present && <Haggle notify={notify} onChanged={onChanged} />}
        {base.key === "balogun_market" && <Stalls notify={notify} />}
        {base.key === CHIEF_TITLE.venue && <ChiefTitle />}
        {venue.opens === "gadgets" && present && <GadgetCounter notify={notify} onChanged={onChanged} open={open} />}
        {venue.opens === "gadgets" && !present && <p className="small muted">📱 Phones, accessories and screen repairs. Go there to buy, haggle or fix your phone.</p>}
        {error && <p className="alert small">{error}</p>}
        {present && <RoomChat place={branch?.key ?? venue.key} />}

        <div className="row">
          {!present && (
            <button type="button" className="btn" onClick={onWalk}>
              <Footprints size={16} aria-hidden="true" /> Go there
            </button>
          )}
          {venue.opens === "academy" && onApp && (
            <button type="button" className="btn go" onClick={() => onApp("academy")}>
              <GraduationCap size={16} aria-hidden="true" /> Open Hustle Academy
            </button>
          )}
          {venue.realCategory && (
            <button type="button" className="btn quiet" onClick={onFindReal}>
              <Store size={16} aria-hidden="true" /> Find a real one near you
            </button>
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
