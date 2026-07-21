// Authored wax-print repeats, one per place in Junction 101. Two- or three-colour
// tiles in the cloth's own palette, used as CSS backgrounds and as SVG <pattern> fills.

export type PrintKey = "market" | "work" | "hangout";

export const INK = {
  indigo: "#1f2a6b",
  indigoDeep: "#141c4d",
  yellow: "#f2b705",
  red: "#c8321e",
  green: "#1e7a46",
  cotton: "#f7f4ea",
} as const;

/** Tile SVG bodies (no outer <svg>), drawn on a 48×48 cell. */
export const PRINT_TILES: Record<PrintKey, { size: number; body: string; ground: string }> = {
  // Market Square — concentric "record" circles in half-drop, red centres.
  market: {
    size: 48,
    ground: INK.yellow,
    body: `
      <g fill="none" stroke="${INK.indigo}" stroke-width="3">
        <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>
        <circle cx="36" cy="36" r="9"/><circle cx="36" cy="36" r="4.5"/>
      </g>
      <circle cx="12" cy="12" r="1.8" fill="${INK.red}"/>
      <circle cx="36" cy="36" r="1.8" fill="${INK.red}"/>
      <path d="M30 6l6 6-6 6-6-6zM6 30l6 6-6 6-6-6zM54 30l-6 6 6 6z" fill="${INK.red}"/>`,
  },
  // Work Hub — stepped ladder bricks with yellow ticks.
  work: {
    size: 48,
    ground: INK.indigo,
    body: `
      <g fill="${INK.green}">
        <rect x="2" y="4" width="20" height="8" rx="1"/>
        <rect x="26" y="16" width="20" height="8" rx="1"/>
        <rect x="2" y="28" width="20" height="8" rx="1"/>
        <rect x="26" y="40" width="20" height="8" rx="1"/>
      </g>
      <g stroke="${INK.yellow}" stroke-width="2" stroke-linecap="round">
        <path d="M30 6v4M36 6v4M42 6v4M6 18v4M12 18v4M18 18v4M30 30v4M36 30v4M42 30v4M6 42v4M12 42v4M18 42v4"/>
      </g>`,
  },
  // The Hangout — fans and dots.
  hangout: {
    size: 48,
    ground: INK.red,
    body: `
      <g fill="${INK.yellow}">
        <path d="M0 24A24 24 0 0 1 24 0V24z" opacity=".95"/>
        <path d="M24 48A24 24 0 0 1 48 24V48z" opacity=".95"/>
      </g>
      <g stroke="${INK.red}" stroke-width="1.6">
        <path d="M24 24L4 14M24 24L10 6M24 24L18 2M48 48L28 38M48 48L34 30M48 48L42 26"/>
      </g>
      <g fill="${INK.indigo}">
        <circle cx="36" cy="10" r="3.2"/><circle cx="12" cy="36" r="3.2"/>
      </g>`,
  },
};

function tileSvg(key: PrintKey): string {
  const t = PRINT_TILES[key];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${t.size}" height="${t.size}" viewBox="0 0 ${t.size} ${t.size}"><rect width="${t.size}" height="${t.size}" fill="${t.ground}"/>${t.body}</svg>`;
}

/** CSS `background-image` value for a print. */
export function printUrl(key: PrintKey): string {
  return `url("data:image/svg+xml,${encodeURIComponent(tileSvg(key).replace(/\s+/g, " "))}")`;
}

export const LOCATION_PRINT: Record<string, PrintKey> = {
  market_square: "market",
  work_hub: "work",
  hangout: "hangout",
};
