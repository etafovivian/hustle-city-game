// Pan and zoom for an SVG world: wheel/trackpad, drag, two-finger pinch, keyboard, buttons.
// The world is drawn in its own units inside <g transform="translate(x y) scale(k)">.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

export interface View {
  x: number;
  y: number;
  k: number;
}

interface Options {
  minK: number;
  maxK: number;
  /** World rectangle the view should fit on first load / recentre. */
  home: { x: number; y: number; w: number; h: number };
  /** World bounds (x0..w, y0..h; x0 and y0 default to 0); the viewport centre is kept inside them. */
  bounds: { x0?: number; y0?: number; w: number; h: number };
}

const DRAG_THRESHOLD = 6;

export function usePanZoom(ref: RefObject<HTMLDivElement | null>, opts: Options) {
  const [view, setView] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startDist: number; startK: number; lastMid: { x: number; y: number } } | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  /** Zoom limits; never zoom out past the edge of the world, so it always fills the viewport. */
  const clampK = useCallback(
    (k: number) => {
      const el = ref.current;
      const { minK, maxK, bounds } = optsRef.current;
      const floor = el ? Math.max(minK, el.clientWidth / (bounds.w - (bounds.x0 ?? 0)), el.clientHeight / (bounds.h - (bounds.y0 ?? 0))) : minK;
      return Math.min(maxK, Math.max(floor, k));
    },
    [ref],
  );

  const clampView = useCallback((v: View): View => {
    const el = ref.current;
    const { bounds } = optsRef.current;
    const k = clampK(v.k);
    if (!el) return { ...v, k };
    const w = el.clientWidth;
    const h = el.clientHeight;
    // Keep the world point under the viewport centre inside the world.
    const cx = Math.min(bounds.w, Math.max(bounds.x0 ?? 0, (w / 2 - v.x) / k));
    const cy = Math.min(bounds.h, Math.max(bounds.y0 ?? 0, (h / 2 - v.y) / k));
    return { k, x: w / 2 - cx * k, y: h / 2 - cy * k };
  }, [ref, clampK]);

  const commit = useCallback(
    (v: View) => {
      const next = clampView(v);
      viewRef.current = next;
      setView(next);
    },
    [clampView],
  );

  const fitHome = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { home } = optsRef.current;
    const k = Math.min(el.clientWidth / home.w, el.clientHeight / home.h) * 0.96;
    commit({ k, x: el.clientWidth / 2 - (home.x + home.w / 2) * k, y: el.clientHeight / 2 - (home.y + home.h / 2) * k });
  }, [commit, ref]);

  const zoomAt = useCallback(
    (p: { x: number; y: number }, factor: number) => {
      const v = viewRef.current;
      if (!v) return;
      const k = clampK(v.k * factor);
      const wx = (p.x - v.x) / v.k;
      const wy = (p.y - v.y) / v.k;
      commit({ k, x: p.x - wx * k, y: p.y - wy * k });
    },
    [commit, clampK],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const el = ref.current;
      if (el) zoomAt({ x: el.clientWidth / 2, y: el.clientHeight / 2 }, factor);
    },
    [ref, zoomAt],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const v = viewRef.current;
      if (v) commit({ ...v, x: v.x + dx, y: v.y + dy });
    },
    [commit],
  );

  // Fit on first layout, and keep the view valid when the viewport resizes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!viewRef.current) fitHome();
      else commit(viewRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fitHome, commit]);

  // Wheel / trackpad: ctrlKey is set for trackpad pinch on most browsers.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 2) {
        zoomAt(p, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, zoomAt, panBy]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      downAt.current = p;
      dragged.current = false;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = {
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startK: viewRef.current?.k ?? 1,
        lastMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      dragged.current = true;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      if (downAt.current && Math.hypot(p.x - downAt.current.x, p.y - downAt.current.y) > DRAG_THRESHOLD) {
        dragged.current = true;
      }
      if (dragged.current) panBy(p.x - prev.x, p.y - prev.y);
    } else if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const v = viewRef.current;
      if (v && gesture.current.startDist > 0) {
        const targetK = gesture.current.startK * (dist / gesture.current.startDist);
        panBy(mid.x - gesture.current.lastMid.x, mid.y - gesture.current.lastMid.y);
        zoomAt(mid, targetK / (viewRef.current?.k ?? targetK));
      }
      gesture.current.lastMid = mid;
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = 60;
    const keys: Record<string, () => void> = {
      "+": () => zoomBy(1.25),
      "=": () => zoomBy(1.25),
      "-": () => zoomBy(0.8),
      "0": fitHome,
      ArrowLeft: () => panBy(step, 0),
      ArrowRight: () => panBy(-step, 0),
      ArrowUp: () => panBy(0, step),
      ArrowDown: () => panBy(0, -step),
    };
    const fn = keys[e.key];
    if (fn && e.target === e.currentTarget) {
      e.preventDefault();
      fn();
    }
  };

  /** Smoothly bring a world point to the centre at zoom k. */
  const flyTo = useCallback(
    (wx: number, wy: number, k: number) => {
      const el = ref.current;
      const from = viewRef.current;
      if (!el || !from) return;
      const to = clampView({ k, x: el.clientWidth / 2 - wx * k, y: el.clientHeight / 2 - wy * k });
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return commit(to);
      const t0 = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 450);
        const e = ease(t);
        commit({ k: from.k + (to.k - from.k) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [clampView, commit, ref],
  );

  return {
    view,
    flyTo,
    zoomBy,
    fitHome,
    /** True when the last pointer gesture moved the map; taps on places should be ignored then. */
    wasDragged: () => dragged.current,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
  };
}
