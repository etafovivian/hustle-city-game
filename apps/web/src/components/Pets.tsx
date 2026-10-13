// Pets (see @hc/shared pets.ts): Phone → Pets to adopt, name and care for your pet; it follows you on the map and
// wanders your rooms at home. Drawn from its sprite sheets once they exist (PET_SHEETS), an emoji until then.
import { PETS, PET_BY_KIND, PET_CARE, parrotLine, type PetCare, type PetKind, type PetView } from "@hc/shared";
import { PawPrint } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, formatCoins } from "../api.js";
import { PET_FRAME, petSheet } from "./petSheets.js";
import { walkerSize } from "./walkers.js";

// ---- your pet, shared by the map, the home and the app
let pet: PetView | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const setPet = (p: PetView | null) => {
  pet = p;
  loaded = true;
  listeners.forEach((f) => f());
};
export const reloadPet = () =>
  api<{ pet: PetView | null }>("GET", "/api/pets")
    .then((r) => setPet(r.pet))
    .catch(() => undefined);
export function usePet(): PetView | null {
  useEffect(() => {
    if (!loaded) void reloadPet();
  }, []);
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => pet,
  );
}

export type PetPose = "walk" | "sit" | "sleep" | "eat" | "play";

/**
 * The pet doing something, drawn from its sheet (petSheets.ts: 8 frames of 128x112 at the people's scale) with its
 * feet at the box's anchor; `k` is screen px per sheet px (a person's sheet is 160 px tall). An emoji where a pet
 * has no sheet for it (the parrot doesn't play).
 */
export function PetSprite({ kind, pose, dir, k }: { kind: PetKind; pose: PetPose; dir: "se" | "sw" | "ne" | "nw"; k: number }) {
  const url = petSheet(kind, pose, dir) ?? (pose === "play" ? petSheet(kind, "sit", dir) : null);
  if (url) {
    const fps = pose === "walk" ? 10 : pose === "play" ? 8 : 3;
    return (
      <span
        className="pet-sheet"
        style={{
          width: PET_FRAME.w * k,
          height: PET_FRAME.h * k,
          marginTop: -(PET_FRAME.h - PET_FRAME.ground) * k,
          marginLeft: (-PET_FRAME.w * k) / 2,
          backgroundImage: `url(${url})`,
          animationDuration: `${PET_FRAME.frames / fps}s`,
        }}
        aria-hidden="true"
      />
    );
  }
  const right = dir === "se" || dir === "ne";
  return (
    <span className={`pet-emoji ${pose}`} style={{ fontSize: 60 * k, transform: `translate(-50%, -100%)${right ? " scaleX(-1)" : ""}` }} aria-hidden="true">
      {PET_BY_KIND.get(kind)!.icon}
    </span>
  );
}

/** A still portrait of the pet (sitting), in a box of its own, for the app. */
function PetPortrait({ kind, k }: { kind: PetKind; k: number }) {
  return (
    <span className="pet-portrait" style={{ width: PET_FRAME.w * k, height: PET_FRAME.h * k }}>
      <span style={{ position: "absolute", left: (PET_FRAME.w * k) / 2, top: (PET_FRAME.h - PET_FRAME.ground) * k }}>
        <PetSprite kind={kind} pose="sit" dir="se" k={k} />
      </span>
    </span>
  );
}

// ---- Phone → Pets
export function PetsApp({ notify, onChanged }: { notify: (m: string) => void; onChanged: () => void }) {
  const p = usePet();
  const [kind, setKind] = useState<PetKind>("dog_local");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState(0);
  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      notify((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  if (!loaded) return <p className="small muted">Loading…</p>;
  if (!p) {
    const info = PET_BY_KIND.get(kind)!;
    return (
      <div className="stack">
        <h2 style={{ fontSize: 20 }}>
          <PawPrint size={20} aria-hidden="true" /> Adopt a pet
        </h2>
        <p className="small muted">A friend for your house. They follow you around the city, and a happy pet makes coming home better.</p>
        <div className="pet-kinds">
          {PETS.map((k) => (
            <button key={k.kind} type="button" className="pet-kind" aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)}>
              <PetPortrait kind={k.kind} k={0.5} />
              <span className="stack" style={{ gap: 1, minWidth: 0 }}>
                <strong className="small">{k.label}</strong>
                <span className="tiny muted">
                  {k.note} · {formatCoins(k.cost)}
                </span>
              </span>
            </button>
          ))}
        </div>
        <label className="stack small" style={{ gap: 4 }}>
          Name your {info.species}
          <input className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder={info.species === "cat" ? "e.g. Mimi" : info.species === "parrot" ? "e.g. Captain" : "e.g. Bingo"} />
        </label>
        <button
          type="button"
          className="btn go"
          disabled={busy || name.trim().length < 1}
          onClick={() =>
            void run(async () => {
              const r = await api<{ pet: PetView }>("POST", "/api/pets", { kind, name });
              setPet(r.pet);
              onChanged();
              notify(`${info.icon} Welcome home, ${r.pet.name}!`);
            })
          }
        >
          Adopt {info.label.toLowerCase()} · {formatCoins(info.cost)}
        </button>
      </div>
    );
  }
  const info = PET_BY_KIND.get(p.kind)!;
  const care = (c: PetCare) =>
    void run(async () => {
      const r = await api<{ counted: boolean; pet: PetView }>("POST", `/api/pets/${c}`);
      setPet(r.pet);
      onChanged();
      const happy = c === "feed" ? `${p.name} ate everything!` : c === "play" ? `${p.name} loved that!` : `A good walk with ${p.name}.`;
      notify(r.counted ? `${PET_CARE[c].icon} ${happy}` : `${PET_CARE[c].icon} ${p.name} is happy you're around.`);
    });
  return (
    <div className="stack">
      <h2 style={{ fontSize: 20 }}>
        <PawPrint size={20} aria-hidden="true" /> {p.name}
      </h2>
      <div className={`pet-card ${p.mood}`}>
        <PetPortrait kind={p.kind} k={0.9} />
        <div className="stack" style={{ gap: 4, flex: 1 }}>
          <strong className="small">
            {p.name} · {info.label}
          </strong>
          <span className="tiny muted">{p.mood === "happy" ? "Happy and wagging" : p.mood === "okay" ? "Doing fine, wants attention" : "Lonely: play, feed or walk them"}</span>
          <span className="love-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.happiness} aria-label="Happiness">
            <span style={{ width: `${p.happiness}%` }} />
          </span>
          {info.species === "parrot" && (
            <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} onClick={() => setSaid((n) => n + 1)}>
              🦜 “{parrotLine(p.name, said)}”
            </button>
          )}
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {(Object.keys(PET_CARE) as PetCare[]).map((c) => (
          <button key={c} type="button" className="btn sm" disabled={busy} onClick={() => care(c)}>
            {PET_CARE[c].icon} {PET_CARE[c].label}
            {PET_CARE[c].cost ? <span className="tiny muted"> · {formatCoins(PET_CARE[c].cost)}</span> : null}
          </button>
        ))}
      </div>
      <p className="tiny muted">A happy pet lifts your Social when you sleep at home. {p.name} follows you around the city.</p>
      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className="btn sm quiet"
          disabled={busy}
          onClick={() => {
            const n = window.prompt(`A new name for ${p.name}?`, p.name);
            if (n)
              void run(async () => {
                const r = await api<{ pet: PetView }>("PUT", "/api/pets/name", { name: n });
                setPet(r.pet);
              });
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className="btn sm quiet"
          disabled={busy}
          onClick={() =>
            window.confirm(`Give ${p.name} to a kind family? (No refund.)`) &&
            void run(async () => {
              await api("DELETE", "/api/pets");
              setPet(null);
              notify(`${p.name} went to a kind new home.`);
            })
          }
        >
          Rehome
        </button>
      </div>
    </div>
  );
}

/** On the map (SVG): your pet trotting a step behind you, or sitting beside you when you stop (people's scale). */
const MAP_K = walkerSize(70).h / 160;
export function MapPet({ kind, heading, walking }: { kind: PetKind; heading: number; walking: boolean }) {
  // Behind you as you walk; to your side when you stand still.
  const dx = walking ? -Math.cos(heading) * 30 : 26;
  const dy = walking ? -Math.sin(heading) * 30 + 4 : 6;
  const right = Math.cos(heading) > 0;
  const dir = right ? (Math.sin(heading) > 0 ? "se" : "ne") : Math.sin(heading) > 0 ? "sw" : "nw";
  const url = petSheet(kind, walking ? "walk" : "sit", dir);
  if (!url) return null;
  const w = PET_FRAME.w * MAP_K;
  const h = PET_FRAME.h * MAP_K;
  return (
    <svg x={dx - w / 2} y={dy - (PET_FRAME.h - PET_FRAME.ground) * MAP_K} width={w} height={h} overflow="hidden" className="map-pet">
      <image href={url} width={w * PET_FRAME.frames} height={h}>
        <animate attributeName="x" dur={walking ? "0.8s" : "2.6s"} repeatCount="indefinite" calcMode="discrete" values={Array.from({ length: PET_FRAME.frames }, (_, f) => -w * f).join(";")} />
      </image>
    </svg>
  );
}

/** At home: your pet pottering about the room (walk to a spot, sit a while), asleep when you are. Tap it for the app. */
export function HomePet({ kind, walkway, asleep }: { kind: PetKind; walkway: readonly (readonly [number, number])[]; asleep: boolean }) {
  const [i, setI] = useState(0);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (asleep || walkway.length < 2) return;
    let t2 = 0;
    const t = window.setInterval(() => {
      setMoving(true);
      setI((x) => (x + 1 + Math.floor(Math.random() * (walkway.length - 1))) % walkway.length);
      t2 = window.setTimeout(() => setMoving(false), 2600);
    }, 6500);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(t2);
    };
  }, [asleep, walkway.length]);
  const [x, y] = walkway[Math.min(i, walkway.length - 1)] ?? [0.5, 0.8];
  const prev = walkway[(i + walkway.length - 1) % walkway.length] ?? [x, y];
  const dir = x >= prev[0] ? (y >= prev[1] ? "se" : "ne") : y >= prev[1] ? "sw" : "nw";
  const info = PET_BY_KIND.get(kind)!;
  // The room's people are 0.21 of the scene's height per 160 sheet px (Interior.tsx): the same for the pet.
  const [k, setK] = useState(0.4);
  const ref = (el: HTMLButtonElement | null) => {
    const hgt = el?.parentElement?.clientHeight;
    if (hgt && Math.abs((hgt * 0.21) / 160 - k) > 0.01) setK((hgt * 0.21) / 160);
  };
  return (
    <button
      ref={ref}
      type="button"
      className="home-pet"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onClick={() => window.dispatchEvent(new CustomEvent("hc:open-phone", { detail: "pets" }))}
      aria-label={`Your ${info.label.toLowerCase()}`}
    >
      <PetSprite kind={kind} pose={asleep ? "sleep" : moving ? "walk" : "sit"} dir={dir} k={k} />
    </button>
  );
}
