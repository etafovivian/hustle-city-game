// Builds layered sprite sheets off the page's main thread (spriteComposer.ts sends the layer URLs and tints, gets a
// PNG back), so a slow phone never stalls a frame while someone's look is put together.
import { composePixels, type Tints } from "./composeCore.js";

type Job = { id: string; base: string; mask: string; hair: string[]; tints: Tints };

async function bitmap(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return createImageBitmap(await r.blob());
}
function pixels(b: ImageBitmap) {
  const c = new OffscreenCanvas(b.width, b.height);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(b, 0, 0);
  return g.getImageData(0, 0, b.width, b.height);
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, base, mask, hair, tints } = e.data;
  try {
    // The hair: its own layer, else the nearest style's.
    let h: ImageBitmap | null = null;
    for (const url of hair) {
      try {
        h = await bitmap(url);
        break;
      } catch {
        /* try the next */
      }
    }
    if (hair.length && !h) throw new Error("hair");
    const [b, m] = await Promise.all([bitmap(base), bitmap(mask)]);
    const bp = pixels(b);
    const mp = pixels(m);
    const hp = h ? pixels(h) : null;
    if (mp.width !== bp.width || (hp && (hp.width !== bp.width || hp.height !== bp.height))) throw new Error("size");
    composePixels(bp.data, mp.data, hp?.data ?? null, tints);
    const c = new OffscreenCanvas(bp.width, bp.height);
    c.getContext("2d")!.putImageData(bp, 0, 0);
    const blob = await c.convertToBlob({ type: "image/png" });
    (self as unknown as Worker).postMessage({ id, blob });
  } catch {
    (self as unknown as Worker).postMessage({ id, blob: null });
  }
};
