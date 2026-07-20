import { AVATAR_OPTIONS, type AvatarConfig } from "@hc/shared";

const OUTFIT_COLORS: Record<string, { base: string; trim: string }> = {
  ankara_green: { base: "#0f7b4b", trim: "#f5c542" },
  agbada_white: { base: "#f3efe6", trim: "#8a7f68" },
  jersey_red: { base: "#c0392b", trim: "#ffffff" },
  tee_blue: { base: "#2f6fb2", trim: "#1d4f82" },
  kaftan_gold: { base: "#c99a2e", trim: "#6b4e12" },
  hoodie_black: { base: "#25282b", trim: "#5a5f64" },
};

const HAIR = "#1b1410";

function Hair({ style }: { style: string }) {
  switch (style) {
    case "afro":
      return <circle cx="50" cy="30" r="22" fill={HAIR} />;
    case "braids":
      return (
        <g fill={HAIR}>
          <path d="M31 34c0-14 8-21 19-21s19 7 19 21c-4-6-10-9-19-9s-15 3-19 9z" />
          <rect x="29" y="34" width="5" height="22" rx="2.5" />
          <rect x="66" y="34" width="5" height="22" rx="2.5" />
        </g>
      );
    case "locs":
      return (
        <g fill={HAIR}>
          <path d="M30 36c0-15 9-23 20-23s20 8 20 23c-5-6-11-9-20-9s-15 3-20 9z" />
          {[30, 36, 62, 68].map((x) => (
            <rect key={x} x={x} y="32" width="4" height="26" rx="2" />
          ))}
        </g>
      );
    case "bald":
      return <ellipse cx="44" cy="24" rx="5" ry="2.5" fill="#fff" opacity="0.25" />;
    case "headwrap":
      return (
        <g>
          <path d="M28 34c0-16 10-24 22-24s22 8 22 24H28z" fill="#e2572b" />
          <path d="M40 14c6-6 16-6 22 2-6 0-12 2-16 6z" fill="#f5c542" />
        </g>
      );
    default: // low_cut
      return <path d="M32 34c0-13 8-19 18-19s18 6 18 19c-4-5-10-7-18-7s-14 2-18 7z" fill={HAIR} />;
  }
}

export function Avatar({ avatar, size = 40 }: { avatar: AvatarConfig; size?: number }) {
  const outfit = OUTFIT_COLORS[avatar.outfit] ?? OUTFIT_COLORS.ankara_green!;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Avatar">
      <circle cx="50" cy="50" r="50" fill="var(--surface-2)" />
      <path d="M18 100c2-20 15-32 32-32s30 12 32 32z" fill={outfit.base} />
      <path d="M42 70l8 10 8-10" fill="none" stroke={outfit.trim} strokeWidth="3" />
      <rect x="44" y="56" width="12" height="12" rx="4" fill={avatar.skinTone} />
      <circle cx="50" cy="38" r="19" fill={avatar.skinTone} />
      <Hair style={avatar.hairStyle} />
      <circle cx="43" cy="40" r="2" fill="#1b1410" />
      <circle cx="57" cy="40" r="2" fill="#1b1410" />
      <path d="M44 47c3 3 9 3 12 0" fill="none" stroke="#1b1410" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const label = (s: string) => s.replace(/_/g, " ");

export function AvatarPicker({ value, onChange }: { value: AvatarConfig; onChange: (v: AvatarConfig) => void }) {
  return (
    <div className="avatar-picker">
      <div className="row">
        <Avatar avatar={value} size={84} />
        <p className="muted small">Pick a look. You can change it later.</p>
      </div>
      <div>
        <div className="small muted">Skin tone</div>
        <div className="swatches">
          {AVATAR_OPTIONS.skinTone.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              style={{ background: c }}
              aria-label={`Skin tone ${c}`}
              aria-pressed={value.skinTone === c}
              onClick={() => onChange({ ...value, skinTone: c })}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="small muted">Hair</div>
        <div className="swatches">
          {AVATAR_OPTIONS.hairStyle.map((h) => (
            <button key={h} type="button" className="chip" aria-pressed={value.hairStyle === h} onClick={() => onChange({ ...value, hairStyle: h })}>
              {label(h)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="small muted">Outfit</div>
        <div className="swatches">
          {AVATAR_OPTIONS.outfit.map((o) => (
            <button key={o} type="button" className="chip" aria-pressed={value.outfit === o} onClick={() => onChange({ ...value, outfit: o })}>
              {label(o)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
