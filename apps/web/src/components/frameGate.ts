// Things that move on the map (traffic, walkers) are redrawn every frame on a device that keeps up (good phones and
// PCs get the full 60 a second). Only when frames are slow (a cheap phone struggling) does each loop skip frames:
// about 30 updates a second, or 15 when it's really slow. Movement speed stays the same; it just steps less often.
// "Slow" is measured on the frames right after an update (those carry its cost), and the step changes at most every
// two seconds, so it doesn't flicker between speeds.
export function frameGate() {
  let lastRun = 0;
  let prev = 0;
  let ranLast = false;
  let cost = 16;
  let every = 0;
  let decidedAt = 0;
  return (now: number) => {
    if (prev && ranLast) cost = cost * 0.85 + Math.min(200, now - prev) * 0.15;
    prev = now;
    if (now - decidedAt > 2000) {
      decidedAt = now;
      every = cost > 30 ? 64 : cost > 20 ? 31 : 0;
    }
    ranLast = now - lastRun >= every;
    if (!ranLast) return false;
    lastRun = now;
    return true;
  };
}
