// Pets (see @hc/shared pets.ts): Phone → Pets to adopt, name and care for your pet; it follows you on the map and
// wanders your rooms at home. Drawn from its sprite sheets once they exist (PET_SHEETS), an emoji until then.
import { PETS, PET_BY_KIND, PET_CARE, parrotLine, type PetCare, type PetKind, type PetView } from "@hc/shared";
import { PawPrint } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, formatCoins } from "../api.js";

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

/** Kinds that have their own drawn sheets (walk, sit, sleep, eat, play); the rest show as an emoji for now. */
export const PET_SHEETS = new Set<PetKind>();
export type PetPose = "walk" | "sit" | "sleep" | "eat" | "play";

/** The pet at a spot: its sheet when it has one, else its emoji (flipped to face the way it goes). */
export function PetSprite({ kind, pose, dir, size }: { kind: PetKind; pose: PetPose; dir: "se" | "sw" | "ne" | "nw"; size: number }) {
  const info = PET_BY_KIND.get(kind)!;
  if (PET_SHEETS.has(kind)) {
    const d = pose === "walk" ? dir : dir === "sw" || dir === "nw" ? "sw" : "se";
    return (
      <span
        className={`pet-sheet ${pose === "walk" ? "walking" : ""}`}
        style={{ width: size, height: size, backgroundImage: `url(/art/life/pets/${kind}-${pose}-${d}.webp)` }}
        aria-hidden="true"
      />
    );
  }
  // Emoji animals face left: turn them to face right when going right.
  const right = dir === "se" || dir === "ne";
  return (
    <span className={`pet-emoji ${pose}`} style={{ fontSize: size * 0.75, transform: right ? "scaleX(-1)" : undefined }} aria-hidden="true">
      {pose === "sleep" ? "💤" : info.icon}
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
              <span className="pet-kind-icon" aria-hidden="true">
                {k.icon}
              </span>
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
        <span className="pet-big" aria-hidden="true">
          {info.icon}
        </span>
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

/** On the map (SVG): your pet trotting a step behind you, or sitting beside you when you stop. */
export function MapPet({ kind, heading, walking }: { kind: PetKind; heading: number; walking: boolean }) {
  const info = PET_BY_KIND.get(kind)!;
  const big = kind === "boerboel" || kind === "shepherd";
  const size = info.species === "parrot" ? 22 : info.species === "cat" ? 24 : big ? 34 : 28;
  // Behind you as you walk; to your side when you stand still.
  const dx = walking ? -Math.cos(heading) * 30 : 24;
  const dy = walking ? -Math.sin(heading) * 30 + 4 : 6;
  const right = Math.cos(heading) > 0;
  const dir = right ? (Math.sin(heading) > 0 ? "se" : "ne") : Math.sin(heading) > 0 ? "sw" : "nw";
  if (PET_SHEETS.has(kind)) {
    const pose = walking ? "walk" : "sit";
    const d = pose === "walk" ? dir : right ? "se" : "sw";
    return (
      <svg x={dx - size / 2} y={dy - size} width={size} height={size} overflow="hidden" className="map-pet">
        <image href={`/art/life/pets/${kind}-${pose}-${d}.webp`} width={size * 8} height={size}>
          {walking && <animate attributeName="x" dur="0.6s" repeatCount="indefinite" calcMode="discrete" values={Array.from({ length: 8 }, (_, f) => -size * f).join(";")} />}
        </image>
      </svg>
    );
  }
  return (
    <g transform={`translate(${dx} ${dy})${right ? " scale(-1 1)" : ""}`} className={`map-pet ${walking ? "trot" : ""}`}>
      <text fontSize={size} textAnchor="middle" y={-2}>
        {info.icon}
      </text>
    </g>
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
  const size = info.species === "parrot" ? 26 : info.species === "cat" ? 28 : kind === "boerboel" || kind === "shepherd" ? 40 : 32;
  return (
    <button
      type="button"
      className="home-pet"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onClick={() => window.dispatchEvent(new CustomEvent("hc:open-phone", { detail: "pets" }))}
      aria-label={`Your ${info.label.toLowerCase()}`}
    >
      <PetSprite kind={kind} pose={asleep ? "sleep" : moving ? "walk" : "sit"} dir={dir} size={size} />
    </button>
  );
}
