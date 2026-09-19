// Moving life on the map: danfos, cars, BRT buses, okadas and kekes on the roads; people on the pavements.
// Vehicles drive their lanes and go round the Junction 101 roundabout; walkers follow the footpath network
// (cityLayout FOOTPATHS): pavements, corners and zebras. Both are moved by animation loops that set attributes
// directly, so React doesn't re-render while things move.
// Art: Stitch exports 9 and 11 (public/art/life, provenance in *.json sidecars); walkers from the 3D bodies.
import { useEffect, useRef, useState } from "react";
import { ART_SIZE } from "./artSizes.js";
import { CX, CY, HALF, ROUNDABOUT, flyHeight, yOn, type Segment } from "./cityLayout.js";
import { frameGate } from "./frameGate.js";
import { walkDir, type WalkDir } from "./walkers.js";

type View = { href: string; w: number; h: number; mirror: boolean };
/** A vehicle view `w` world units wide; `mirror` flips it to face the other way (SE ↔ SW, NE ↔ NW). */
const V = (name: string, w: number, mirror = false): View => {
  const href = `/art/life/${name}.webp`;
  const [pw, ph] = ART_SIZE[href] ?? [w, w];
  return { href, w, h: (w * ph) / pw, mirror };
};
/**
 * Each vehicle's views by heading. Danfos, BRT buses, okadas and kekes have front and back art, so they can go
 * any way (round the roundabout too); cars have front and back views too (the back views came later, batch 51).
 */
const KINDS: Record<string, Partial<Record<WalkDir, View>>> = {
  danfo: { se: V("danfo-se", 104), sw: V("danfo-se", 104, true), nw: V("danfo-nw", 104), ne: V("danfo-nw", 104, true) },
  okada: { se: V("okada-se", 49), sw: V("okada-sw", 50), ne: V("okada-ne", 50), nw: V("okada-ne", 50, true) },
  keke: { se: V("keke-se", 57), sw: V("keke-sw", 57), ne: V("keke-ne", 58), nw: V("keke-ne", 58, true) },
  brt: { sw: V("brt-sw", 176), se: V("brt-sw", 176, true), ne: V("brt-ne", 176), nw: V("brt-ne", 176, true) },
  taxi: { sw: V("car-taxi", 98), se: V("car-taxi", 98, true), ne: V("car-taxi-ne", 98), nw: V("car-taxi-ne", 98, true) },
  saloon: { sw: V("car-saloon", 100), se: V("car-saloon", 100, true), ne: V("car-saloon-ne", 100), nw: V("car-saloon-ne", 100, true) },
  suvBlack: { sw: V("car-suv-black", 94), se: V("car-suv-black", 94, true), ne: V("car-suv-black-ne", 94), nw: V("car-suv-black-ne", 94, true) },
  suvWhite: { sw: V("car-suv-white", 96), se: V("car-suv-white", 96, true), ne: V("car-suv-white-ne", 96), nw: V("car-suv-white-ne", 96, true) },
  // The interstate coach and the three-car train (Stitch batches 55-56), ridden by the player.
  coach: { sw: V("coach-sw", 190), se: V("coach-se", 190), ne: V("coach-ne", 190), nw: V("coach-ne", 190, true) },
  train: { se: V("train-se", 380), sw: V("train-se", 380, true), ne: V("train-ne", 380), nw: V("train-ne", 380, true) },
};
/** A vehicle's art for a heading (the player's ride uses the same views as traffic). */
export function vehicleView(kind: string, dir: WalkDir): View {
  const views = KINDS[kind] ?? KINDS.taxi!;
  return views[dir] ?? views[dir === "ne" ? "se" : dir === "nw" ? "sw" : dir] ?? Object.values(views)[0]!;
}
const ANY_WAY = ["danfo", "okada", "danfo", "keke", "brt", "danfo", "okada", "keke"];
const CARS = ["taxi", "saloon", "suvBlack", "taxi", "suvWhite"];

type Pt = { x: number; y: number };
/** World-x to drop from each end of a road's traffic route (the Tech Mile / bridge corner is a curve). */
const CORNER_TRIM: Record<string, { lo: number; hi: number }> = {
  a: { lo: 0, hi: 170 },
  bridge: { lo: 0, hi: 170 },
  // The expressway's corner where Road A turns north-east for Ogun
  "ogun-link": { lo: 170, hi: 0 },
  expressway: { lo: 170, hi: 0 },
};

/** Points along a road lane from x0 to x1 (flyovers rise and fall, so they get several points). */
function lanePoints(s: Segment, x0: number, x1: number, lane: number): Pt[] {
  const N = s.flyover ? 12 : 1;
  return Array.from({ length: N + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / N;
    return { x, y: yOn(s, x) + lane - flyHeight(s, x) };
  });
}
const RING = ROUNDABOUT.lane;
const inRing = (p: Pt) => ((p.x - CX) / RING.rx) ** 2 + ((p.y - CY) / RING.ry) ** 2;
/** Where a lane meets the roundabout ring, coming from `far` towards `near` (bisection on the lane line). */
function ringMeet(s: Segment, lane: number, xFar: number, xNear: number) {
  const at = (x: number) => ({ x, y: yOn(s, x) + lane });
  let [lo, hi] = [xFar, xNear];
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inRing(at(mid)) > 1) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2);
}
const angle = (p: Pt) => Math.atan2((p.y - CY) / RING.ry, (p.x - CX) / RING.rx);
/** Round the ring anticlockwise on screen (traffic keeps right, so it circles the island anticlockwise). */
function arc(from: Pt, to: Pt): Pt[] {
  const t0 = angle(from);
  let t1 = angle(to);
  while (t1 >= t0) t1 -= Math.PI * 2;
  const n = Math.max(2, Math.ceil((t0 - t1) / 0.18));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / n;
    return { x: CX + RING.rx * Math.cos(t), y: CY + RING.ry * Math.sin(t) };
  });
}

type Route = { pts: Pt[]; kinds: string[]; speed: number; count: number; fadeEnd: boolean; fadeStart: boolean };
/** Every lane's route: straight roads end to end; Roads A and B go round the roundabout at Junction 101. */
function buildRoutes(roads: Segment[]): Route[] {
  const out: Route[] = [];
  for (const s of roads) {
    const trim = CORNER_TRIM[s.id] ?? { lo: 0, hi: 0 };
    const [lo, hi] = [Math.min(s.x0, s.x1) + trim.lo, Math.max(s.x0, s.x1) - trim.hi];
    const downRight = (s.y1 - s.y0) / (s.x1 - s.x0) > 0;
    const length = Math.hypot(hi - lo, yOn(s, hi) - yOn(s, lo));
    for (const east of [true, false]) {
      const lane = east ? HALF / 2 : -HALF / 2;
      const [x0, x1] = east ? [lo, hi] : [hi, lo];
      const speed = east ? 150 : 138;
      // Cars can drive this lane when it heads down the screen (east on a down-right road, west on an up-right one).
      const carsOk = downRight === east;
      const count = Math.max(2, Math.round((length / 950) * (s.traffic ?? 1)));
      const crosses = (s.id === "a" || s.id === "b") && Math.min(x0, x1) < CX && Math.max(x0, x1) > CX;
      if (!crosses) {
        out.push({ pts: lanePoints(s, x0, x1, lane), kinds: carsOk ? [...ANY_WAY, ...CARS] : ANY_WAY, speed, count, fadeEnd: true, fadeStart: true });
        continue;
      }
      const entry = ringMeet(s, lane, x0, CX);
      const exit = ringMeet(s, lane, x1, CX);
      const approach = [{ x: x0, y: yOn(s, x0) + lane }, entry];
      const depart = [exit, { x: x1, y: yOn(s, x1) + lane }];
      // Through traffic: approach, round the ring, away the other side.
      out.push({ pts: [...approach, ...arc(entry, exit).slice(1, -1), ...depart], kinds: ANY_WAY, speed, count, fadeEnd: true, fadeStart: true });
      // Cars turn off just before the roundabout and others join just after it (they only face down the screen).
      if (carsOk) {
        const half = Math.max(1, Math.round(count / 2));
        out.push({ pts: approach, kinds: CARS, speed, count: half, fadeEnd: true, fadeStart: true });
        out.push({ pts: depart, kinds: CARS, speed, count: half, fadeEnd: true, fadeStart: true });
      }
    }
  }
  return out;
}

/** Vehicles: one animation loop moves them along their routes and turns their art to face the way they go. */
function Traffic({ roads, goSlow }: { roads: Segment[]; goSlow: boolean }) {
  // Rush hour: traffic crawls stop-start (read in the loop, so the loop never restarts).
  const slowRef = useRef(goSlow);
  slowRef.current = goSlow;
  const routes = useRef(buildRoutes(roads)).current;
  const vehicles = useRef(
    routes.flatMap((r, ri) => {
      const len = r.pts.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - r.pts[i]!.x, p.y - r.pts[i]!.y), 0);
      return Array.from({ length: r.count }, (_, i) => ({ route: ri, len, at: (len * (i + (ri % 3) * 0.17)) / r.count, kind: r.kinds[(i * 3 + ri) % r.kinds.length]! }));
    }),
  ).current;
  const outer = useRef<(SVGGElement | null)[]>([]);
  const inner = useRef<(SVGGElement | null)[]>([]);
  const imgs = useRef<(SVGImageElement | null)[]>([]);
  const shadows = useRef<(SVGEllipseElement | null)[]>([]);

  useEffect(() => {
    const facing: (WalkDir | "")[] = vehicles.map(() => "");
    // Where each vehicle was last frame, which way it was heading (unit vector) and its length, so vehicles can
    // queue behind whatever is in front of them in their lane (routes share lanes round the roundabout).
    const n = vehicles.length;
    const px = new Float64Array(n).fill(NaN);
    const py = new Float64Array(n).fill(NaN);
    const hx = new Float64Array(n);
    const hy = new Float64Array(n);
    const len = vehicles.map((v) => (KINDS[v.kind]?.se ?? KINDS[v.kind]?.sw ?? { w: 100 }).w);
    const waited = new Float64Array(n);
    /** Someone close in front, going the same way in the same lane: wait (unless waiting long; never gridlock). */
    const blocked = (i: number) => {
      if (Number.isNaN(px[i]!)) return false;
      for (let j = 0; j < n; j++) {
        if (j === i || Number.isNaN(px[j]!)) continue;
        const dx = px[j]! - px[i]!;
        const dy = py[j]! - py[i]!;
        const ahead = dx * hx[i]! + dy * hy[i]!;
        if (ahead <= 0) continue;
        const gap = (len[i]! + len[j]!) / 2 + 14;
        if (ahead > gap) continue;
        const side = Math.abs(dx * -hy[i]! + dy * hx[i]!);
        if (side > 22) continue;
        // Same direction (not oncoming), and at a merge where both see the other ahead, the lower one goes first.
        if (hx[i]! * hx[j]! + hy[i]! * hy[j]! < 0.3) continue;
        const mutual = -dx * hx[j]! + -dy * hy[j]! > 0;
        if (mutual && i < j) continue;
        return true;
      }
      return false;
    };
    // The visible part of the map in world units (from the layer's screen transform, a few times a second), so
    // vehicles off screen are moved along but not redrawn.
    let onScreen: { x0: number; y0: number; x1: number; y1: number } | null = null;
    const shown = vehicles.map(() => true);
    const measure = () => {
      const g = outer.current.find(Boolean);
      const m = (g?.parentNode as SVGGraphicsElement | null)?.getScreenCTM();
      if (!m) return (onScreen = null);
      const inv = m.inverse();
      const p = new DOMPoint(0, 0).matrixTransform(inv);
      const q = new DOMPoint(window.innerWidth, window.innerHeight).matrixTransform(inv);
      onScreen = { x0: Math.min(p.x, q.x) - 250, y0: Math.min(p.y, q.y) - 250, x1: Math.max(p.x, q.x) + 250, y1: Math.max(p.y, q.y) + 250 };
    };
    measure();
    const remeasure = window.setInterval(measure, 300);
    const gate = frameGate();
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      if (!gate(now)) {
        raf = requestAnimationFrame(step);
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const [i, v] of vehicles.entries()) {
        const r = routes[v.route]!;
        const crawl = slowRef.current ? 0.08 + 0.3 * Math.max(0, Math.sin(now / 1400 + i * 1.7)) : 1;
        if (blocked(i) && waited[i]! < 4) waited[i] = waited[i]! + dt;
        else {
          waited[i] = 0;
          v.at = (v.at + r.speed * crawl * dt) % v.len;
        }
        // Find the point at distance v.at along the route
        let d = v.at;
        let k = 0;
        let seg = 0;
        for (k = 1; k < r.pts.length; k++) {
          seg = Math.hypot(r.pts[k]!.x - r.pts[k - 1]!.x, r.pts[k]!.y - r.pts[k - 1]!.y);
          if (d <= seg) break;
          d -= seg;
        }
        const a = r.pts[k - 1]!;
        const b = r.pts[Math.min(k, r.pts.length - 1)]!;
        const t = seg ? d / seg : 0;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        // Faded out at a route's ends: not in anyone's way.
        const ends = Math.min(v.at, v.len - v.at) < 60;
        px[i] = ends ? NaN : x;
        py[i] = y;
        const hl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        hx[i] = (b.x - a.x) / hl;
        hy[i] = (b.y - a.y) / hl;
        const g = outer.current[i];
        if (!g) continue;
        const visible = !onScreen || (x > onScreen.x0 && x < onScreen.x1 && y > onScreen.y0 && y < onScreen.y1);
        if (visible !== shown[i]) {
          shown[i] = visible;
          g.setAttribute("display", visible ? "inline" : "none");
        }
        if (!visible) continue;
        g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        // Fade at the ends of a route instead of popping
        const edge = Math.min(v.at, v.len - v.at);
        g.setAttribute("opacity", edge < 60 ? (edge / 60).toFixed(2) : "1");
        // Face the way it moves (keep the last view while moving almost flat, so it doesn't flicker)
        const [dx, dy] = [b.x - a.x, b.y - a.y];
        let dir = facing[i]!;
        if (!dir || Math.abs(dy) > Math.abs(dx) * 0.12) dir = walkDir(dx, dy);
        else if (dir && Math.sign(dx) !== (dir === "se" || dir === "ne" ? 1 : -1)) dir = walkDir(dx, dy);
        const view = KINDS[v.kind]![dir] ?? KINDS[v.kind]![facing[i] || "se"] ?? Object.values(KINDS[v.kind]!)[0]!;
        if (dir !== facing[i]) {
          facing[i] = dir;
          const img = imgs.current[i]!;
          img.setAttribute("href", view.href);
          img.setAttribute("x", String(-view.w / 2));
          img.setAttribute("y", String(-view.h + 6));
          img.setAttribute("width", String(view.w));
          img.setAttribute("height", String(view.h));
          inner.current[i]!.setAttribute("transform", view.mirror ? "scale(-1 1)" : "");
          shadows.current[i]!.setAttribute("rx", String(view.w * 0.42));
          shadows.current[i]!.setAttribute("ry", String(view.h * 0.12));
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(remeasure);
    };
  }, [routes, vehicles]);

  return (
    <g className="traffic">
      {vehicles.map((_, i) => (
        <g key={i} ref={(el) => void (outer.current[i] = el)} transform="translate(-999 -999)">
          <ellipse ref={(el) => void (shadows.current[i] = el)} cx="0" cy="-4" fill="rgb(0 0 0 / 28%)" />
          <g ref={(el) => void (inner.current[i] = el)}>
            <image ref={(el) => void (imgs.current[i] = el)} />
          </g>
        </g>
      ))}
    </g>
  );
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

export function StreetLife({ roads, goSlow = false }: { roads: Segment[]; goSlow?: boolean }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return null;

  return (
    <g aria-hidden="true" className="street-life">
      <Traffic roads={roads} goSlow={goSlow} />
    </g>
  );
}
