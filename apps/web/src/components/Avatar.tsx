// Player avatars drawn with DiceBear "Personas" by Draftbit (CC BY 4.0, credited in the picker and README).
import { createAvatar } from "@dicebear/core";
import * as personas from "@dicebear/personas";
import { AVATAR_OPTIONS, LEGACY_HAIR, type AvatarConfig } from "@hc/shared";
import { useMemo } from "react";

type PersonasHair = NonNullable<personas.Options["hair"]>[number];

const HAIR: Record<string, PersonasHair> = {
  low_cut: "fade",
  buzzcut: "buzzcut",
  high_top: "curlyHighTop",
  curly: "curly",
  puff: "curlyBun",
  locs: "long",
  bald: "bald",
  cap: "cap",
};

const HAIR_LABEL: Record<string, string> = {
  low_cut: "Low cut",
  buzzcut: "Buzz cut",
  high_top: "High top",
  curly: "Curls",
  puff: "Puff",
  locs: "Locs",
  bald: "Bald",
  cap: "Cap",
};

// Outfit colours drawn from the wax-print dyes.
const OUTFIT: Record<string, { color: string; label: string }> = {
  ankara_green: { color: "1e7a46", label: "Ankara green" },
  agbada_white: { color: "ece6d6", label: "Agbada white" },
  jersey_red: { color: "c8321e", label: "Jersey red" },
  tee_blue: { color: "1f2a6b", label: "Indigo tee" },
  kaftan_gold: { color: "f2b705", label: "Kaftan gold" },
  hoodie_black: { color: "25282b", label: "Black hoodie" },
};

function avatarUri(a: AvatarConfig): string {
  const hairKey = HAIR[a.hairStyle] ? a.hairStyle : (LEGACY_HAIR[a.hairStyle] ?? "low_cut");
  return createAvatar(personas, {
    seed: "naija-hustle-city",
    skinColor: [a.skinTone.replace("#", "")],
    hair: [HAIR[hairKey]!],
    hairColor: ["1b1410"],
    clothingColor: [OUTFIT[a.outfit]?.color ?? OUTFIT.ankara_green!.color],
    body: ["rounded"],
    eyes: ["open"],
    mouth: ["smile"],
    nose: ["smallRound"],
    facialHairProbability: 0,
    scale: 112,
    translateY: 4,
  }).toDataUri();
}

export function Avatar({ avatar, size = 40, className }: { avatar: AvatarConfig; size?: number; className?: string }) {
  const src = useMemo(() => avatarUri(avatar), [avatar.skinTone, avatar.hairStyle, avatar.outfit]);
  return (
    <span className={`avatar ${className ?? ""}`} style={{ width: size, height: size }}>
      <img src={src} width={size} height={size} alt="Your avatar" draggable={false} />
    </span>
  );
}

export function AvatarPicker({ value, onChange }: { value: AvatarConfig; onChange: (v: AvatarConfig) => void }) {
  return (
    <fieldset className="avatar-picker">
      <legend className="field-label" style={{ padding: 0, marginBottom: 10 }}>
        Your look
      </legend>
      <div className="look-card">
        <span className="look-avatar">
          <Avatar avatar={value} size={64} />
          <span className="level-badge">Lvl 1</span>
        </span>
        <p className="muted small">Pick a look now. You can change it any time inside Junction 101.</p>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">Skin tone</span>
        <div className="swatches">
          {AVATAR_OPTIONS.skinTone.map((c, i) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{ background: c }}
              aria-label={`Skin tone ${i + 1} of ${AVATAR_OPTIONS.skinTone.length}`}
              aria-pressed={value.skinTone === c}
              onClick={() => onChange({ ...value, skinTone: c })}
            />
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">Hair</span>
        <div className="swatches">
          {AVATAR_OPTIONS.hairStyle.map((h) => (
            <button key={h} type="button" className="chip" aria-pressed={value.hairStyle === h} onClick={() => onChange({ ...value, hairStyle: h })}>
              {HAIR_LABEL[h]}
            </button>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">Outfit</span>
        <div className="swatches">
          {AVATAR_OPTIONS.outfit.map((o) => (
            <button key={o} type="button" className="chip" aria-pressed={value.outfit === o} onClick={() => onChange({ ...value, outfit: o })}>
              <i className="chip-dot" style={{ background: `#${OUTFIT[o]!.color}` }} aria-hidden="true" />
              {OUTFIT[o]!.label}
            </button>
          ))}
        </div>
      </div>
      <p className="tiny muted">
        Avatar art: “Personas” by Draftbit, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, via DiceBear.
      </p>
    </fieldset>
  );
}
