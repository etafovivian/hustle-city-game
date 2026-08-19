// Geometry for people inside a room: points are fractions of the room image (x of its width, y of its height).
// `aspect` (image width / height) makes distances real, so a walk across and a walk down take the right time.
import type { Pt } from "./rooms.js";

const dist = (a: Pt, b: Pt, aspect: number) => Math.hypot((a[0] - b[0]) * aspect, a[1] - b[1]);

/** The nearest point on a polyline: the segment it lies on (from vertex `seg` to `seg + 1`) and the point. */
export function nearestOnPolyline(pts: Pt[], p: Pt, aspect = 1): { seg: number; at: Pt; d: number } {
  if (pts.length === 1) return { seg: 0, at: pts[0]!, d: dist(pts[0]!, p, aspect) };
  let best = { seg: 0, at: pts[0]!, d: Infinity };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = (b[0] - a[0]) * aspect;
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, (((p[0] - a[0]) * aspect) * dx + (p[1] - a[1]) * dy) / len2));
    const at: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d = dist(at, p, aspect);
    if (d < best.d) best = { seg: i, at, d };
  }
  return best;
}

/**
 * A route through the room: onto the walkway at its nearest point, along it, and off it to the destination.
 * Rooms without a walkway go straight there.
 */
export function routeTo(walkway: Pt[], from: Pt, to: Pt, aspect = 1): Pt[] {
  if (walkway.length < 2) return [from, to];
  const a = nearestOnPolyline(walkway, from, aspect);
  const b = nearestOnPolyline(walkway, to, aspect);
  const mid: Pt[] = [];
  if (a.seg < b.seg) for (let i = a.seg + 1; i <= b.seg; i++) mid.push(walkway[i]!);
  else if (a.seg > b.seg) for (let i = a.seg; i > b.seg; i--) mid.push(walkway[i]!);
  const out: Pt[] = [from];
  for (const p of [a.at, ...mid, b.at, to]) if (dist(out[out.length - 1]!, p, aspect) > 0.004) out.push(p);
  return out;
}

export const close = (a: Pt, b: Pt, within = 0.035) => Math.abs(a[0] - b[0]) < within && Math.abs(a[1] - b[1]) < within;
