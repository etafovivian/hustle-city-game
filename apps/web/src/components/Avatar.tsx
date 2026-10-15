// Player avatars drawn with DiceBear "Personas" by Draftbit (CC BY 4.0, credited in the picker and README).
import { createAvatar } from "@dicebear/core";
import * as personas from "@dicebear/personas";
import { AVATAR_OPTIONS, FABRIC_HAIR, FABRIC_HAIR_DEFAULT, HAIR_COLORS, LEGACY_HAIR, LOOK_ORDER, OUTFIT_COLORS, OUTFIT_INFO, SKIN_ORDER, bodyOf, type AvatarConfig, type BodyType } from "@hc/shared";
import { useMemo } from "react";
import { layersOn } from "./spriteComposer.js";

/** The looks every player sees drawn in the city today; the newer ones only show while layered looks are on (admins
 * first), so for now the picker offers them only there: what you pick is what you see. */
const BAKED = {
  skin: new Set<string>(AVATAR_OPTIONS.skinTone.slice(0, 6)),
  hair: new Set<string>(AVATAR_OPTIONS.hairStyle.slice(0, 11)),
  outfit: new Set<string>(AVATAR_OPTIONS.outfit.slice(0, 8)),
};
const offered = (kind: keyof typeof BAKED, list: readonly string[], current: string) => (layersOn() ? list : list.filter((k) => BAKED[kind].has(k) || k === current));

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
  straight: "shortCombover",
  wavy: "bobBangs",
  ponytail: "pigtails",
  bun: "straightBun",
  side_part: "shortComboverChops",
  long_straight: "long",
  hijab: "beanie",
  knotless: "extraLong",
  big_afro: "curly",
  bob_wig: "bobBangs",
  twists: "long",
  fade_part: "fade",
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
  straight: "Straight",
  wavy: "Wavy",
  ponytail: "Ponytail",
  bun: "Bun",
  side_part: "Side part",
  long_straight: "Long straight",
  hijab: "Hijab",
  knotless: "Knotless braids",
  big_afro: "Big afro",
  bob_wig: "Bob wig",
  twists: "Twists",
  fade_part: "Fade with a part",
};

// Outfit colours drawn from the wax-print dyes (shared OUTFIT_INFO, without the "#").
const OUTFIT: Record<string, { color: string; label: string }> = Object.fromEntries(
  Object.entries(OUTFIT_INFO).map(([k, v]) => [k, { color: v.color.slice(1), label: v.label }]),
);

/** Gele, caps and the hijab take a fabric colour; hair is near-black. */
const HAIR_COLOR: Record<string, string> = Object.fromEntries(Object.entries(FABRIC_HAIR_DEFAULT).map(([k, v]) => [k, v.slice(1)]));

export function avatarUri(a: AvatarConfig): string {
  const hairKey = HAIR[a.hairStyle] ? a.hairStyle : (LEGACY_HAIR[a.hairStyle] ?? "low_cut");
  return createAvatar(personas, {
    seed: "naija-hustle-city",
    skinColor: [a.skinTone.replace("#", "")],
    hair: [HAIR[hairKey]!],
    hairColor: [(a.hairColor ?? "").replace("#", "") || (HAIR_COLOR[hairKey] ?? "1b1410")],
    clothingColor: [(a.outfitColor ?? "").replace("#", "") || (OUTFIT[a.outfit]?.color ?? OUTFIT.ankara_green!.color)],
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
  const src = useMemo(() => avatarUri(avatar), [avatar.skinTone, avatar.hairStyle, avatar.outfit, avatar.body, avatar.outfitColor, avatar.hairColor]);
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
          {offered("skin", SKIN_ORDER, value.skinTone).map((c, i, all) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{ background: c }}
              aria-label={`Skin tone ${i + 1} of ${all.length}`}
              aria-pressed={value.skinTone === c}
              onClick={() => onChange({ ...value, skinTone: c })}
            />
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">Hair</span>
        <div className="swatches">
          {offered("hair", LOOK_ORDER[bodyOf(value)].hair, value.hairStyle).map((h) => (
            <button key={h} type="button" className="chip" aria-pressed={value.hairStyle === h} onClick={() => onChange({ ...value, hairStyle: h, hairColor: FABRIC_HAIR.has(h) === FABRIC_HAIR.has(value.hairStyle) ? value.hairColor : undefined })}>
              {HAIR_LABEL[h]}
            </button>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">Outfit</span>
        <div className="swatches">
          {offered("outfit", LOOK_ORDER[bodyOf(value)].outfit, value.outfit).map((o) => (
            <button key={o} type="button" className="chip" aria-pressed={value.outfit === o} onClick={() => onChange({ ...value, outfit: o })}>
              <i className="chip-dot" style={{ background: `#${OUTFIT[o]!.color}` }} aria-hidden="true" />
              {OUTFIT[o]!.label}
            </button>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">Outfit colour</span>
        <div className="swatches">
          <button type="button" className="swatch swatch-default" style={{ background: `#${OUTFIT[value.outfit]?.color ?? "1e7a46"}` }} aria-label="The outfit's own colour" aria-pressed={!value.outfitColor} onClick={() => onChange({ ...value, outfitColor: undefined })} />
          {OUTFIT_COLORS.map((c) => (
            <button key={c.hex} type="button" className="swatch" style={{ background: c.hex }} aria-label={`Outfit colour: ${c.label}`} title={c.label} aria-pressed={value.outfitColor === c.hex} onClick={() => onChange({ ...value, outfitColor: c.hex })} />
          ))}
        </div>
      </div>
      {value.hairStyle !== "bald" && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">{FABRIC_HAIR.has(value.hairStyle) ? (value.hairStyle === "gele" ? "Gele colour" : value.hairStyle === "hijab" ? "Hijab colour" : "Cap colour") : "Hair colour"}</span>
          <div className="swatches">
            {(FABRIC_HAIR.has(value.hairStyle) ? OUTFIT_COLORS : HAIR_COLORS).map((c) => (
              <button
                key={c.hex}
                type="button"
                className="swatch"
                style={{ background: c.hex }}
                aria-label={`${FABRIC_HAIR.has(value.hairStyle) ? "Fabric" : "Hair"} colour: ${c.label}`}
                title={c.label}
                aria-pressed={(value.hairColor ?? (FABRIC_HAIR.has(value.hairStyle) ? "" : "#1b1410")) === c.hex}
                onClick={() => onChange({ ...value, hairColor: c.hex })}
              />
            ))}
          </div>
        </div>
      )}
      <p className="tiny muted">
        Avatar art: “Personas” by Draftbit, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, via DiceBear.
      </p>
    </fieldset>
  );
}
