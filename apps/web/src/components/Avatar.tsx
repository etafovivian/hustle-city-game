// Player avatars drawn with DiceBear "Personas" by Draftbit (CC BY 4.0, credited in the picker and README).
import { createAvatar } from "@dicebear/core";
import * as personas from "@dicebear/personas";
import { AVATAR_OPTIONS, LEGACY_HAIR, LOOK_ORDER, bodyOf, type AvatarConfig, type BodyType } from "@hc/shared";
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
  braids: "extraLong",
  bob: "bobCut",
  gele: "beanie",
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
  braids: "Braids",
  bob: "Bob",
  gele: "Gele",
};

// Outfit colours drawn from the wax-print dyes.
const OUTFIT: Record<string, { color: string; label: string }> = {
  ankara_green: { color: "1e7a46", label: "Ankara green" },
  agbada_white: { color: "ece6d6", label: "Agbada white" },
  jersey_red: { color: "c8321e", label: "Jersey red" },
  tee_blue: { color: "1f2a6b", label: "Indigo tee" },
  kaftan_gold: { color: "f2b705", label: "Kaftan gold" },
  hoodie_black: { color: "25282b", label: "Black hoodie" },
  buba_wrapper: { color: "0f7b6c", label: "Buba & wrapper" },
  peplum_coral: { color: "e4572e", label: "Coral peplum" },
};

/** Gele and caps take a fabric colour; hair is near-black. */
const HAIR_COLOR: Record<string, string> = { gele: "f2b705", cap: "c8321e" };

function avatarUri(a: AvatarConfig): string {
  const hairKey = HAIR[a.hairStyle] ? a.hairStyle : (LEGACY_HAIR[a.hairStyle] ?? "low_cut");
  return createAvatar(personas, {
    seed: "naija-hustle-city",
    skinColor: [a.skinTone.replace("#", "")],
    hair: [HAIR[hairKey]!],
    hairColor: [HAIR_COLOR[hairKey] ?? "1b1410"],
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
  const src = useMemo(() => avatarUri(avatar), [avatar.skinTone, avatar.hairStyle, avatar.outfit, avatar.body]);
  return (
    <span className={`avatar ${className ?? ""}`} style={{ width: size, height: size }}>
      <img src={src} width={size} height={size} alt="Your avatar" draggable={false} />
    </span>
  );
}

/** Switching body starts from that body's most common hair and outfit (players can still pick any). */
function withBody(a: AvatarConfig, body: BodyType): AvatarConfig {
  if (a.body === body) return a;
  return { ...a, body, hairStyle: LOOK_ORDER[body].hair[0]!, outfit: LOOK_ORDER[body].outfit[0]! };
}

export function AvatarPicker({
  value,
  onChange,
  preview = true,
}: {
  value: AvatarConfig;
  onChange: (v: AvatarConfig) => void;
  preview?: boolean;
}) {
  return (
    <fieldset className="avatar-picker">
      <legend className="field-label" style={{ padding: 0, marginBottom: 10 }}>
        Your look
      </legend>
      {preview && (
      <div className="look-card">
        <span className="look-avatar">
          <Avatar avatar={value} size={64} />
          <span className="level-badge">Lvl 1</span>
        </span>
        <p className="muted small">Pick a look now. You can change it any time inside Junction 101.</p>
      </div>
      )}
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">You are a</span>
        <div className="body-pick" role="radiogroup" aria-label="Body">
          {AVATAR_OPTIONS.body.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              className="chip body-chip"
              aria-checked={value.body === b}
              aria-pressed={value.body === b}
              onClick={() => onChange(withBody(value, b))}
            >
              {b === "man" ? "Man" : "Woman"}
            </button>
          ))}
        </div>
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
          {LOOK_ORDER[bodyOf(value)].hair.map((h) => (
            <button key={h} type="button" className="chip" aria-pressed={value.hairStyle === h} onClick={() => onChange({ ...value, hairStyle: h })}>
              {HAIR_LABEL[h]}
            </button>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">Outfit</span>
        <div className="swatches">
          {LOOK_ORDER[bodyOf(value)].outfit.map((o) => (
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
