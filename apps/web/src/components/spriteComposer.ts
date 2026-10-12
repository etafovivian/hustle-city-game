// Layered sprites: the player's own look (any skin tone, hair, hair colour, outfit and fabric colour) built at
// runtime from neutral layers rendered in Blender (scripts/blender/agent/sprites.py, LAYERS=base|hair), instead of
// the nearest of the ~20 baked walker looks.
//
//   /art/life/layers/<body>-<outfit>/<sheet>.webp    the body in the outfit, no hair: skin and fabric in neutral
//                                                    grey (0.8; trousers in the same cloth 0.69), the rest in colour
//   /art/life/layers/<body>-<outfit>/<sheet>.m.webp  its mask (lossless): red = skin, green = fabric
//   /art/life/layers/hair-<body>-<style>/<sheet>.webp  one hair style in neutral grey, already cut where the body,
//                                                    clothes or props hide it
// <sheet> is "walk-<dir>" or "<pose>-<dir>", with exactly the frame sizes and anchors of the baked sheets.
//
// Each layer is multiplied by its tint (skin tone, fabric, hair colour, lifted the way the Blender toon palette lifts
// the baked colours) and the hair laid over the base. The result is a blob URL, cached per look and sheet. Anything
// missing or failing gives null, and callers keep today's baked sheet (variantFor): nothing that works breaks.
import { FABRIC_HAIR, FABRIC_HAIR_DEFAULT, OUTFIT_INFO, bodyOf, type AvatarConfig } from "@hc/shared";
import { useEffect, useState } from "react";
import { composePixels } from "./composeCore.js";

export { composePixels };

/** The layered looks, on for everyone since 2026-10-15 (false: admins only, or ?layers=1 to test). */
export const LAYERS_FOR_EVERYONE = true;

/** The base looks that have layers (sprites.py LAYER_LOOK), per body. */
const BASES: Record<"man" | "woman", Set<string>> = {
  man: new Set(["ankara_green", "agbada_white", "kaftan_gold", "jersey_red", "tee_blue", "hoodie_black", "suit", "jeans_jacket", "kente", "boubou", "kurta"]),
  woman: new Set([
    "buba_wrapper", "peplum_coral", "ankara_green", "kaftan_gold", "tee_blue", "jersey_red", "hoodie_black",
    "suit", "jeans_jacket", "summer_dress", "abaya", "kente", "boubou", "salwar_kameez", "saree",
  ]),
};
/** Hair styles with layers (sprites.py LAYER_HAIRS); "bald" needs none. */
const HAIRS = new Set(["low_cut", "buzzcut", "high_top", "curly", "puff", "braids", "bob", "locs", "gele", "cap", "straight", "wavy", "ponytail", "bun", "side_part", "long_straight", "hijab"]);
const LEGACY_HAIR: Record<string, string> = { afro: "high_top", headwrap: "gele" };
/** A close style to borrow while a newer style's pose layer is still missing (the walk has every style). */
const NEAR_HAIR: Record<string, string> = {
  straight: "low_cut",
  side_part: "low_cut",
  wavy: "curly",
  ponytail: "puff",
  bun: "puff",
  long_straight: "braids",
  hijab: "gele",
};

/**
 * The fabric colour when the player hasn't picked one: the baked sheets' own colours for the original outfits (so the
 * default look stays as it was), the shared outfit colour for the new ones.
 */
const BAKED_FABRIC: Record<string, string> = {
  ankara_green: "#00a859",
  agbada_white: "#ece6d6",
  kaftan_gold: "#d9a21f",
  jersey_red: "#df382b",
  tee_blue: "#1e2a5e",
  hoodie_black: "#25282b",
  buba_wrapper: "#0f7b6c",
  peplum_coral: "#e4572e",
};
const HAIR_DEFAULT = "#1b1410";

let enabledFor = false;
/** Called with the signed-in user's roles (from /api/me): admins see the layered looks first. */
export function setLayerRoles(roles: readonly string[] | undefined) {
  enabledFor = !!roles?.includes("admin");
}
/** ?layers=1 turns the layered looks on for this tab, ?layers=0 off (to compare, e.g. in performance runs). */
function testFlag(): "1" | "0" | null {
  try {
    const q = new URLSearchParams(window.location.search).get("layers");
    if (q === "1" || q === "0") sessionStorage.setItem("hc_layers", q);
    const v = sessionStorage.getItem("hc_layers");
    return v === "1" || v === "0" ? v : null;
  } catch {
    return null;
  }
}
export function layersOn(): boolean {
  const flag = testFlag();
  if (flag === "0") return false;
  return LAYERS_FOR_EVERYONE || enabledFor || flag === "1";
}

/** The layer folders for a look, or null when it has none (an outfit not cut for that body). */
export function layerKeys(a: AvatarConfig): { base: string; hair: string | null } | null {
  const body = bodyOf(a);
  if (!BASES[body].has(a.outfit)) return null;
  const style = LEGACY_HAIR[a.hairStyle] ?? a.hairStyle;
  if (style !== "bald" && !HAIRS.has(style)) return null;
  return { base: `${body}-${a.outfit}`, hair: style === "bald" ? null : `hair-${body}-${style}` };
}

// ---------------------------------------------------------------- colour
function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function toHsv([r, g, b]: [number, number, number]): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
function fromHsv(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Skin: lifted like the toon palette lifts the baked skin (deep tones a lot, light ones barely), so form reads. */
export function skinTint(hex: string): [number, number, number] {
  const [h, s, v] = toHsv(hexRgb(hex));
  const k = 1.55 - 0.5 * smooth(0.3, 0.9, v);
  return fromHsv(h, Math.min(1, s * 1.05), Math.min(1, v * k));
}
/** Fabric: a little richer; whites and creams go a warm off-white (as the baked sheets do). */
export function fabricTint(hex: string): [number, number, number] {
  const [h, s, v] = toHsv(hexRgb(hex));
  if (s < 0.16 && v > 0.6) return [Math.min(1, (0.98 * v) / 0.93), Math.min(1, (0.94 * v) / 0.93), Math.min(1, (0.84 * v) / 0.93)];
  return fromHsv(h, Math.min(1, s * 1.1), Math.min(1, v * 1.04));
}
export function hairTint(hex: string): [number, number, number] {
  const [h, s, v] = toHsv(hexRgb(hex));
  return fromHsv(h, Math.min(1, s * 1.1), Math.min(1, v * 1.3));
}

export function tintsFor(a: AvatarConfig) {
  const style = LEGACY_HAIR[a.hairStyle] ?? a.hairStyle;
  const fabric = a.outfitColor ?? BAKED_FABRIC[a.outfit] ?? OUTFIT_INFO[a.outfit]?.color ?? "#1e7a46";
  const hair = a.hairColor ?? (FABRIC_HAIR.has(style) ? FABRIC_HAIR_DEFAULT[style]! : HAIR_DEFAULT);
  return { skin: skinTint(a.skinTone), fabric: fabricTint(fabric), hair: FABRIC_HAIR.has(style) ? fabricTint(hair) : hairTint(hair) };
}

// ---------------------------------------------------------------- compositing
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}
function pixels(img: HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}

/** The compose worker (one, started on first use), or null where workers or OffscreenCanvas aren't available. */
let worker: Worker | null | undefined;
const waiting = new Map<string, (b: Blob | null) => void>();
function composer(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") return (worker = null);
    worker = new Worker(new URL("./composeWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: string; blob: Blob | null }>) => {
      waiting.get(e.data.id)?.(e.data.blob);
      waiting.delete(e.data.id);
    };
    worker.onerror = () => {
      // A worker that can't run: compose on the page from now on, and let anything waiting fall back.
      worker = null;
      waiting.forEach((r) => r(null));
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

const cache = new Map<string, Promise<string | null>>();
const ready = new Map<string, string | null>();
const listeners = new Set<() => void>();

const lookId = (a: AvatarConfig) => [bodyOf(a), a.outfit, a.outfitColor ?? "", a.skinTone, a.hairStyle, a.hairColor ?? ""].join("|");

/** Builds one sheet of a look (a blob URL), or null when its layers are missing. */
export function composeSheet(a: AvatarConfig, sheet: string): Promise<string | null> {
  const id = `${lookId(a)}#${sheet}`;
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const keys = layerKeys(a);
      if (!keys || typeof document === "undefined") return null;
      const root = "/art/life/layers";
      // Off the main thread where the browser can (a worker with OffscreenCanvas), else here.
      const w = composer();
      if (w) {
        const style = keys.hair?.split("-").slice(2).join("-");
        const near = style ? NEAR_HAIR[style] : undefined;
        const hair = keys.hair ? [`${root}/${keys.hair}/${sheet}.webp`, ...(near ? [`${root}/${keys.hair.replace(new RegExp(`-${style}$`), `-${near}`)}/${sheet}.webp`] : [])] : [];
        const blob = await new Promise<Blob | null>((resolve) => {
          waiting.set(id, resolve);
          w.postMessage({ id, base: `${root}/${keys.base}/${sheet}.webp`, mask: `${root}/${keys.base}/${sheet}.m.webp`, hair, tints: tintsFor(a) });
        });
        return blob ? URL.createObjectURL(blob) : null;
      }
      try {
        const hairImg = async () => {
          if (!keys.hair) return null;
          try {
            return await loadImage(`${root}/${keys.hair}/${sheet}.webp`);
          } catch (e) {
            const style = keys.hair.split("-").slice(2).join("-");
            const near = NEAR_HAIR[style];
            if (!near) throw e;
            return loadImage(`${root}/${keys.hair.replace(new RegExp(`-${style}$`), `-${near}`)}/${sheet}.webp`);
          }
        };
        const [b, m, h] = await Promise.all([loadImage(`${root}/${keys.base}/${sheet}.webp`), loadImage(`${root}/${keys.base}/${sheet}.m.webp`), hairImg()]);
        const base = pixels(b);
        const mask = pixels(m);
        const hair = h ? pixels(h) : null;
        if (mask.width !== base.width || (hair && (hair.width !== base.width || hair.height !== base.height))) return null;
        composePixels(base.data, mask.data, hair?.data ?? null, tintsFor(a));
        const c = document.createElement("canvas");
        c.width = base.width;
        c.height = base.height;
        c.getContext("2d")!.putImageData(base, 0, 0);
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
        return blob ? URL.createObjectURL(blob) : null;
      } catch {
        return null; // a layer is missing or failed: the caller keeps the baked sheet
      }
    })().then((url) => {
      ready.set(id, url);
      listeners.forEach((f) => f());
      return url;
    });
    cache.set(id, p);
  }
  return p;
}

/**
 * The composed sheet if it's ready; otherwise starts composing it and returns null (show the baked sheet meanwhile).
 * Cheap enough to call every animation frame. Off (always null) unless layers are on.
 */
export function layerSheet(a: AvatarConfig, sheet: string): string | null {
  if (!layersOn() || !layerKeys(a)) return null;
  const id = `${lookId(a)}#${sheet}`;
  if (ready.has(id)) return ready.get(id) ?? null;
  void composeSheet(a, sheet);
  return null;
}

/** For React-rendered sprites: the composed sheet when ready (re-renders then), else the fallback. */
export function useLayerSheet(a: AvatarConfig | undefined, sheet: string, fallback: string): string {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);
  return (a && layerSheet(a, sheet)) || fallback;
}

/** Poses where someone stands on the spot: while their own layered sheet is missing, the look's own walk sheet held
 * on one frame stands in (better than another look's baked sheet). */
export const STANDING_POSES = new Set(["stand_idle", "stand_talk", "phone_call", "dress_mirror", "water_plants", "cook_hob", "pour_drink", "wipe_counter", "write_chart", "take_order", "wedding_l", "wedding_r", "hug_m", "hug_w", "dance_pair"]);

/** The sheet name for a pose and facing (sheets without nw/ne fall back to sw/se, as the baked ones do). */
export const poseSheetName = (pose: string, dir: string) => `${pose}-${dir}`;
export const walkSheetName = (dir: string) => `walk-${dir}`;
