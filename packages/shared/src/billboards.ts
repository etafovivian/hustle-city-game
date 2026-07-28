// Billboards: real businesses pay to show a banner on in-game boards. Ads take turns on a board.
// An ad goes live only when an admin has approved its content and confirmed payment.

export const AD_BANNER = { width: 1200, height: 400, maxBytes: 600 * 1024 };
export const AD_ROTATE_SECONDS = 15;
export const AD_MAX_WEEKS = 4;

/** What ads can't promote (PRD risk: "earn money by playing" schemes; Nigerian advertising rules). */
export const AD_POLICY = [
  "No gambling, betting or lottery",
  "No crypto, forex or investment schemes, and no 'double your money' offers",
  "No adult content, weapons or drugs",
  "No political or religious campaigning",
  "No fake claims, other people's brands or misleading prices",
];

export type AdStatus = "in_review" | "awaiting_payment" | "scheduled" | "live" | "ended" | "rejected";

export function adStatus(c: { reviewStatus: string; paymentStatus: string; startsAt: Date | null; endsAt: Date | null }, now: Date): AdStatus {
  if (c.reviewStatus === "rejected") return "rejected";
  if (c.reviewStatus !== "approved") return "in_review";
  if (c.paymentStatus !== "paid") return "awaiting_payment";
  if (c.endsAt && c.endsAt <= now) return "ended";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  return "live";
}

export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  in_review: "In review",
  awaiting_payment: "Approved: awaiting payment",
  scheduled: "Scheduled",
  live: "On air",
  ended: "Ended",
  rejected: "Not approved",
};

/** An https link to the advertiser's site or WhatsApp; returns the normalised URL or null. */
export function cleanAdLink(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".") || url.hostname.length > 120) return null;
  const out = url.toString();
  return out.length <= 300 ? out : null;
}

export const adDomain = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
};

/**
 * Banner type and size from the file's own header bytes (never from a file name or a client-sent type).
 * Supports WebP (VP8, VP8L, VP8X), PNG and baseline/progressive JPEG.
 */
export function imageInfo(b: Uint8Array): { type: "image/webp" | "image/png" | "image/jpeg"; width: number; height: number } | null {
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length > 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return { type: "image/webp", width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
    if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { type: "image/webp", width: (b[26]! | (b[27]! << 8)) & 0x3fff, height: (b[28]! | (b[29]! << 8)) & 0x3fff };
    }
    if (chunk === "VP8L" && b[20] === 0x2f) {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
      return { type: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (b.length > 24 && b[0] === 0x89 && ascii(1, 3) === "PNG" && ascii(12, 4) === "IHDR") {
    const be = (o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
    return { type: "image/png", width: be(16), height: be(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) return null;
      const marker = b[o + 1]!;
      const len = (b[o + 2]! << 8) | b[o + 3]!;
      // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "image/jpeg", height: (b[o + 5]! << 8) | b[o + 6]!, width: (b[o + 7]! << 8) | b[o + 8]! };
      }
      o += 2 + len;
    }
  }
  return null;
}

// ── API shapes ──

export interface BoardAd {
  id: string;
  headline: string;
  linkUrl: string;
  imageUrl: string;
  until: string;
}

export interface BillboardView {
  key: string;
  name: string;
  tier: "standard" | "mega";
  priceKoboPerWeek: number;
  capacity: number;
  /** Booked places (in review, awaiting payment or on air) out of capacity. */
  taken: number;
  ads: BoardAd[];
}

export interface MyAd {
  id: string;
  billboardKey: string;
  billboardName: string;
  headline: string;
  linkUrl: string;
  imageUrl: string;
  weeks: number;
  priceKobo: number;
  status: AdStatus;
  reviewNote: string | null;
  startsAt: string | null;
  endsAt: string | null;
  views: number;
  clicks: number;
  createdAt: string;
}
