// The pixel work of a layered sprite (spriteComposer.ts), shared by the page and the compose worker: tint the neutral
// layers and lay the hair over the body.

/** The grey the layers are rendered in; a tint of exactly this leaves a pixel unchanged. */
export const NEUTRAL = 0.8;
export type Tints = { skin: [number, number, number]; fabric: [number, number, number]; hair: [number, number, number] };

/** Tints and stacks layer pixels in place: `base` (RGBA) by `mask` (red skin, green fabric), then `hair` over it. */
export function composePixels(
  base: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  hair: Uint8ClampedArray | null,
  t: Tints,
) {
  const ks = t.skin.map((c) => c / NEUTRAL);
  const kf = t.fabric.map((c) => c / NEUTRAL);
  const kh = t.hair.map((c) => c / NEUTRAL);
  for (let i = 0; i < base.length; i += 4) {
    const a = base[i + 3]!;
    if (a) {
      const ms = mask[i]! / 255;
      const mf = mask[i + 1]! / 255;
      for (let c = 0; c < 3; c++) base[i + c] = base[i + c]! * (1 + ms * (ks[c]! - 1) + mf * (kf[c]! - 1));
    }
    if (hair) {
      const ha = hair[i + 3]! / 255;
      if (ha > 0) {
        for (let c = 0; c < 3; c++) base[i + c] = hair[i + c]! * kh[c]! * ha + base[i + c]! * (1 - ha);
        base[i + 3] = 255 * (ha + (a / 255) * (1 - ha));
      }
    }
  }
}

