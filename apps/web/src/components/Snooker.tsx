// Snooker on a canvas, made to look and feel like a real table: wooden rails with diamonds, cushions, leather
// pockets, shaded balls with shadows, a proper cue that draws back with the power and strikes, an aiming guide (the
// ghost ball where the cue ball meets the first ball, and where that ball will go), follow and draw spin, and the
// click of the balls. Solo practice plays locally; with a friend, the server plays each shot with the same shared
// physics and both phones animate it from the same start.
import { CUE_SPOT, POCKETS, TABLE, poolAim, poolLeft, poolShoot, poolStart, poolStep, poolStrike, type Ball, type BallKind, type PoolEvent, type PoolState } from "@hc/shared";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { sfx, useGameSound } from "../gameSfx.js";

/** The rail around the cloth (table units). */
const RAIL = 50;
const FULL = { w: TABLE.w + RAIL * 2, h: TABLE.h + RAIL * 2 };
const BALL: Record<BallKind, [string, string, string]> = {
  cue: ["#ffffff", "#f1ead6", "#b9ad8c"],
  red: ["#ff8a7a", "#d42a22", "#5e0905"],
  yellow: ["#fff3a6", "#f2be14", "#7a5300"],
  black: ["#7a7a7a", "#1a1a1a", "#000000"],
};
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A small seeded random, so the cloth and wood grain look the same every time. */
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);

/** Rounded rectangle, or a plain one on browsers too old to draw rounded ones. */
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => (typeof ctx.roundRect === "function" ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h));

function drawTable(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d")!;
  const k = c.width / FULL.w;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const rnd = rng(42);
  // Wooden frame with grain.
  const wood = ctx.createLinearGradient(0, 0, 0, FULL.h);
  wood.addColorStop(0, "#7a4219");
  wood.addColorStop(0.5, "#5a2f10");
  wood.addColorStop(1, "#3d1e08");
  ctx.fillStyle = wood;
  ctx.beginPath();
  roundRect(ctx, 0, 0, FULL.w, FULL.h, 34);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 90; i++) {
    const y = rnd() * FULL.h;
    ctx.strokeStyle = rnd() > 0.5 ? "#2a1204" : "#a2643a";
    ctx.lineWidth = 0.6 + rnd() * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(FULL.w * 0.3, y + (rnd() - 0.5) * 18, FULL.w * 0.7, y + (rnd() - 0.5) * 18, FULL.w, y + (rnd() - 0.5) * 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // A polished edge.
  ctx.strokeStyle = "rgb(255 210 160 / 35%)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(ctx, 2, 2, FULL.w - 4, FULL.h - 4, 32);
  ctx.stroke();
  // Diamonds on the rails.
  ctx.fillStyle = "#f3e7c9";
  const diamond = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 3.5, y);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x - 3.5, y);
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue;
    diamond(RAIL + (TABLE.w * i) / 8, RAIL / 2);
    diamond(RAIL + (TABLE.w * i) / 8, FULL.h - RAIL / 2);
  }
  for (let i = 1; i < 4; i++) {
    diamond(RAIL / 2, RAIL + (TABLE.h * i) / 4);
    diamond(FULL.w - RAIL / 2, RAIL + (TABLE.h * i) / 4);
  }
  ctx.translate(RAIL, RAIL);
  // Cushions: a darker green band.
  const cushion = 14;
  ctx.fillStyle = "#145c2c";
  ctx.fillRect(-cushion, -cushion, TABLE.w + cushion * 2, TABLE.h + cushion * 2);
  // The cloth: brighter under the lights in the middle.
  const cloth = ctx.createRadialGradient(TABLE.w / 2, TABLE.h / 2, 40, TABLE.w / 2, TABLE.h / 2, TABLE.w * 0.62);
  cloth.addColorStop(0, "#2fa75a");
  cloth.addColorStop(0.6, "#23893f");
  cloth.addColorStop(1, "#186b31");
  ctx.fillStyle = cloth;
  ctx.fillRect(0, 0, TABLE.w, TABLE.h);
  ctx.strokeStyle = "rgb(140 230 160 / 30%)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.5, 0.5, TABLE.w - 1, TABLE.h - 1);
  // Nap of the cloth.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rnd() > 0.5 ? "rgb(255 255 255 / 4%)" : "rgb(0 0 0 / 5%)";
    ctx.fillRect(rnd() * TABLE.w, rnd() * TABLE.h, 1.4, 1.4);
  }
  // Baulk line, the D and the spots.
  ctx.strokeStyle = "rgb(255 255 255 / 30%)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CUE_SPOT.x, 0);
  ctx.lineTo(CUE_SPOT.x, TABLE.h);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CUE_SPOT.x, CUE_SPOT.y, 82, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.stroke();
  ctx.fillStyle = "rgb(255 255 255 / 45%)";
  for (const [x, y] of [[CUE_SPOT.x, CUE_SPOT.y], [700, 250], [TABLE.w / 2, TABLE.h / 2]]) {
    ctx.beginPath();
    ctx.arc(x!, y!, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pockets: leather-lined holes cut through the cushion.
  for (const [px, py] of POCKETS) {
    const rim = ctx.createRadialGradient(px, py, TABLE.pocket * 0.6, px, py, TABLE.pocket + 9);
    rim.addColorStop(0, "#000");
    rim.addColorStop(0.72, "#0b0503");
    rim.addColorStop(0.86, "#3a2414");
    rim.addColorStop(1, "rgb(58 36 20 / 0%)");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(px, py, TABLE.pocket + 9, 0, Math.PI * 2);
    ctx.fill();
    const hole = ctx.createRadialGradient(px, py - 4, 2, px, py, TABLE.pocket);
    hole.addColorStop(0, "#000");
    hole.addColorStop(1, "#120a05");
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(px, py, TABLE.pocket - 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** One ball, drawn once at the screen's size: base colour, shading, and the light on top. */
function ballSprite(kind: BallKind, px: number) {
  const c = document.createElement("canvas");
  c.width = c.height = Math.ceil(px * 2 + 4);
  const ctx = c.getContext("2d")!;
  const r = px;
  const cx = c.width / 2;
  const [hi, mid, lo] = BALL[kind];
  const g = ctx.createRadialGradient(cx - r * 0.35, cx - r * 0.4, r * 0.1, cx, cx, r);
  g.addColorStop(0, hi);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.fill();
  if (kind === "black") {
    ctx.fillStyle = "#f4f1e8";
    ctx.beginPath();
    ctx.arc(cx + r * 0.12, cx + r * 0.1, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = `bold ${Math.round(r * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("8", cx + r * 0.12, cx + r * 0.13);
  }
  // Specular highlight and a soft reflected light underneath.
  ctx.fillStyle = "rgb(255 255 255 / 85%)";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.38, cx - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgb(255 255 255 / 14%)";
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.3, cx + r * 0.52, r * 0.4, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

interface LiveView {
  id: string;
  names: [string, string | null];
  you: 0 | 1 | null;
  state: PoolState;
  before: PoolState;
  last: { angle: number; power: number; spin?: number } | null;
}
interface Sinking {
  kind: BallKind;
  x: number;
  y: number;
  px: number;
  py: number;
  t0: number;
}

export function Snooker({ id, notify }: { id?: string; notify: (m: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const table = useRef<HTMLCanvasElement | null>(null);
  const sprites = useRef<Partial<Record<BallKind, HTMLCanvasElement>>>({});
  const scale = useRef(1);
  const [state, setState] = useState<PoolState>(poolStart);
  const [live, setLive] = useState<LiveView | null>(null);
  const [aim, setAim] = useState(0);
  const [power, setPower] = useState(0.55);
  const [spin, setSpin] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [sound, toggleSound] = useGameSound();
  const shownShots = useRef(0);
  const anim = useRef(0);
  const sinking = useRef<Sinking[]>([]);
  const view = useRef({ aim, power, spin });
  view.current = { aim, power, spin };

  const myTurn = !live || state.turn === live.you;
  const canAim = !rolling && !state.over && myTurn && live?.you !== null;

  /** Size the canvas to the screen (sharp on high-density phones, capped for slow ones) and redraw the table. */
  const fit = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.round(c.clientWidth * dpr));
    if (c.width === w && table.current) return;
    c.width = w;
    c.height = Math.round((w * FULL.h) / FULL.w);
    scale.current = w / FULL.w;
    const t = table.current ?? document.createElement("canvas");
    t.width = c.width;
    t.height = c.height;
    drawTable(t);
    table.current = t;
    const r = TABLE.r * scale.current;
    sprites.current = { cue: ballSprite("cue", r), red: ballSprite("red", r), yellow: ballSprite("yellow", r), black: ballSprite("black", r) };
  }, []);

  const draw = useCallback((balls: Ball[], opts: { aim?: boolean; cuePull?: number } = {}) => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !table.current) return;
    const k = scale.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(table.current, 0, 0);
    ctx.setTransform(k, 0, 0, k, RAIL * k, RAIL * k);
    const r = TABLE.r;
    // Shadows first (the lights are above, a little toward the player).
    ctx.fillStyle = "rgb(0 0 0 / 32%)";
    for (const b of balls) {
      if (b.in) continue;
      ctx.beginPath();
      ctx.ellipse(b.x + 3, b.y + 4, r * 1.02, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const now = performance.now();
    sinking.current = sinking.current.filter((s) => now - s.t0 < 260);
    for (const s of sinking.current) {
      const t = (now - s.t0) / 260;
      const sp = sprites.current[s.kind]!;
      const size = (sp.width / k) * (1 - t * 0.7);
      ctx.globalAlpha = 1 - t * 0.6;
      ctx.drawImage(sp, s.x + (s.px - s.x) * t - size / 2, s.y + (s.py - s.y) * t - size / 2, size, size);
      ctx.globalAlpha = 1;
    }
    for (const b of balls) {
      if (b.in) continue;
      const sp = sprites.current[b.kind]!;
      const size = sp.width / k;
      ctx.drawImage(sp, b.x - size / 2, b.y - size / 2, size, size);
    }
    const cue = balls.find((b) => b.kind === "cue" && !b.in);
    if (!cue) return;
    const { aim: a, power: pw } = view.current;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    if (opts.aim) {
      // Aiming guide: the path to the ghost ball, the ghost ball, and where the struck ball heads.
      const g = poolAim(balls, a);
      ctx.strokeStyle = "rgb(255 255 255 / 70%)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 7]);
      ctx.beginPath();
      ctx.moveTo(cue.x + dx * r, cue.y + dy * r);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgb(255 255 255 / 80%)";
      ctx.beginPath();
      ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
      ctx.stroke();
      if (g.ball) {
        const ox = g.ball.x - g.x;
        const oy = g.ball.y - g.y;
        const d = Math.hypot(ox, oy) || 1;
        const reach = 60 + pw * 160;
        ctx.strokeStyle = g.ball.kind === "red" ? "rgb(255 140 120 / 90%)" : g.ball.kind === "yellow" ? "rgb(255 230 120 / 90%)" : "rgb(230 230 230 / 85%)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(g.ball.x, g.ball.y);
        ctx.lineTo(g.ball.x + (ox / d) * reach, g.ball.y + (oy / d) * reach);
        ctx.stroke();
        // The cue ball glances off along the tangent.
        const tx = -oy / d;
        const ty = ox / d;
        const side = tx * dx + ty * dy >= 0 ? 1 : -1;
        ctx.strokeStyle = "rgb(255 255 255 / 30%)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x + tx * side * reach * 0.5, g.y + ty * side * reach * 0.5);
        ctx.stroke();
      }
    }
    if (opts.aim || opts.cuePull !== undefined) {
      // The cue: tip, ferrule, ash shaft, brass joint, dark butt with a grip, drawn back by the power.
      const pull = opts.cuePull ?? 6 + pw * 70;
      const len = 560;
      const at = (d: number) => [cue.x - dx * (r + pull + d), cue.y - dy * (r + pull + d)] as const;
      const seg = (from: number, to: number, w0: number, w1: number, fill: string | CanvasGradient) => {
        const [x0, y0] = at(from);
        const [x1, y1] = at(to);
        const nx = -dy;
        const ny = dx;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
        ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
        ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
        ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
        ctx.closePath();
        ctx.fill();
      };
      const w = (d: number) => 2.6 + (d / len) * 4.4;
      // Shadow on the cloth.
      ctx.save();
      ctx.translate(6, 9);
      ctx.globalAlpha = 0.28;
      seg(0, len, w(0), w(len), "#000");
      ctx.restore();
      const [sx, sy] = at(0);
      const [ex, ey] = at(len);
      const shaft = ctx.createLinearGradient(sx - dy * 4, sy + dx * 4, sx + dy * 4, sy - dx * 4);
      shaft.addColorStop(0, "#c99a5c");
      shaft.addColorStop(0.5, "#f1d9a6");
      shaft.addColorStop(1, "#b88848");
      seg(0, 3, w(0), w(3), "#3b6fd1");
      seg(3, 12, w(3), w(12), "#f5f0e2");
      seg(12, 360, w(12), w(360), shaft);
      seg(360, 368, w(360), w(368), "#d4af37");
      const butt = ctx.createLinearGradient(ex - dy * 6, ey + dx * 6, ex + dy * 6, ey - dx * 6);
      butt.addColorStop(0, "#2a1206");
      butt.addColorStop(0.5, "#6b3416");
      butt.addColorStop(1, "#200d03");
      seg(368, len, w(368), w(len), butt);
      seg(470, 520, w(470) + 0.3, w(520) + 0.3, "#1b1b1b");
    }
  }, []);

  /** Animate a shot from `from` (the cue strikes, the balls run with sound), then land exactly on `to`. */
  const play = useCallback(
    (from: PoolState, angle: number, pw: number, sp: number, to: PoolState) => {
      cancelAnimationFrame(anim.current);
      const balls = from.balls.map((b) => ({ ...b }));
      setRolling(true);
      const fast = reduced();
      const strikeStart = performance.now();
      const pullFrom = 6 + pw * 70;
      // The cue comes through the ball first.
      const strike = () => {
        const t = Math.min(1, (performance.now() - strikeStart) / (fast ? 1 : 110));
        view.current = { ...view.current, aim: angle, power: pw };
        draw(balls, { cuePull: pullFrom * (1 - t * t) - 2 });
        if (t < 1) {
          anim.current = requestAnimationFrame(strike);
          return;
        }
        sfx.cue(pw);
        const hits = poolStrike(balls, angle, pw, sp);
        let last = performance.now();
        let acc = 0;
        const frame = (now: number) => {
          acc += Math.min(80, Math.max(0, now - last));
          last = now;
          let moving = true;
          const events: PoolEvent[] = [];
          const potted: Ball[] = [];
          // Two physics steps per 60 fps frame, whatever the screen's refresh rate.
          while (acc >= 8.33 && moving) {
            moving = poolStep(balls, hits, potted, events);
            acc -= 8.33;
          }
          for (const b of potted) {
            let best: readonly [number, number] = POCKETS[0];
            for (const p of POCKETS) if ((p[0] - b.x) ** 2 + (p[1] - b.y) ** 2 < (best[0] - b.x) ** 2 + (best[1] - b.y) ** 2) best = p;
            sinking.current.push({ kind: b.kind, x: b.x, y: b.y, px: best[0], py: best[1], t0: now });
          }
          let sounds = 0;
          for (const e of events) {
            if (sounds >= 3) break;
            if (e.type === "hit" && e.speed > 0.4) (sfx.ball(e.speed), sounds++);
            else if (e.type === "cushion" && e.speed > 1.2) (sfx.cushion(e.speed), sounds++);
            else if (e.type === "pot") (sfx.pocket(), sounds++);
          }
          draw(balls);
          if (moving || sinking.current.length) anim.current = requestAnimationFrame(frame);
          else {
            setRolling(false);
            setState(to);
          }
        };
        anim.current = requestAnimationFrame(frame);
      };
      anim.current = requestAnimationFrame(strike);
    },
    [draw],
  );

  // Live: follow the game; animate the other player's shots.
  useEffect(() => {
    if (!id) return;
    let stop = false;
    const load = async () => {
      const g = await api<LiveView>("GET", `/api/games/snooker/${id}`).catch(() => null);
      if (!g || stop) return;
      setLive(g);
      if (g.state.shots > shownShots.current) {
        shownShots.current = g.state.shots;
        if (g.last) play(g.before, g.last.angle, g.last.power, g.last.spin ?? 0, g.state);
        else setState(g.state);
      } else if (g.state.shots === 0) setState(g.state);
    };
    void load();
    const t = window.setInterval(() => void load(), 1500);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [id, play]);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);
  // Keep the canvas sharp and the right size as the screen changes.
  const redraw = useRef(() => {});
  redraw.current = () => {
    if (!rolling) draw(state.balls, { aim: canAim });
  };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    fit();
    redraw.current();
    const ro = new ResizeObserver(() => {
      fit();
      redraw.current();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [fit]);
  useEffect(() => {
    if (!rolling) draw(state.balls, { aim: canAim });
  }, [state, rolling, aim, power, spin, canAim, draw]);

  const shoot = async () => {
    if (!canAim) return;
    if (live) {
      try {
        const g = await api<LiveView>("POST", `/api/games/snooker/${live.id}/shot`, { angle: aim, power, spin });
        shownShots.current = g.state.shots;
        setLive(g);
        play(g.before, aim, power, spin, g.state);
      } catch (e) {
        notify((e as Error).message);
      }
    } else play(state, aim, power, spin, poolShoot(state, aim, power, spin));
  };
  const aimAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canAim) return;
    const r = canvas.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * FULL.w - RAIL;
    const y = ((e.clientY - r.top) / r.height) * FULL.h - RAIL;
    const cue = state.balls.find((b) => b.kind === "cue")!;
    setAim(Math.atan2(y - cue.y, x - cue.x));
  };
  const nudge = (d: number) => setAim((a) => a + (d * Math.PI) / 180);

  const names = live ? live.names.map((n) => (n ? `@${n}` : "…")) : ["Reds", "Yellows"];
  const turnName = names[state.turn];
  const rack = (p: 0 | 1) => (
    <div className={`snk-player${state.turn === p && !state.over ? " turn" : ""}`}>
      <span className="snk-name">{names[p]}</span>
      <span className="snk-rack" aria-label={`${poolLeft(state, p)} left`}>
        {Array.from({ length: 7 }, (_, k) => (
          <i key={k} className={`snk-mini ${p === 0 ? "red" : "yellow"}${k < 7 - poolLeft(state, p) ? " potted" : ""}`} />
        ))}
      </span>
    </div>
  );
  const message = state.over
    ? live
      ? live.you !== null && state.winner === live.you
        ? "You win! 🎉"
        : `${names[state.winner ?? 1]} wins.`
      : `${names[state.winner ?? 1]} win the frame! 🎉`
    : `${state.note} ${live ? (live.you === null ? `${turnName} to play.` : myTurn ? "Your shot." : `${turnName} to play…`) : `${turnName} to play.`}`;
  const spinLabel = spin > 0.15 ? "Follow" : spin < -0.15 ? "Draw" : "Centre";
  return (
    <div className="stack snooker">
      <div className="snk-head">
        {rack(0)}
        <button type="button" className="snk-sound" onClick={toggleSound} aria-label={sound ? "Mute game sounds" : "Turn game sounds on"}>
          {sound ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
        </button>
        {rack(1)}
      </div>
      <canvas
        ref={canvas}
        className="snooker-table"
        onPointerDown={(e) => {
          canvas.current?.setPointerCapture(e.pointerId);
          aimAt(e);
        }}
        onPointerMove={(e) => e.buttons && aimAt(e)}
        aria-label="Snooker table: tap or drag to aim"
      />
      <p className="small snk-note" aria-live="polite">
        {message}
      </p>
      {live?.you === null ? (
        <span className="tiny muted">Watching this frame.</span>
      ) : (
        <div className="snk-controls">
          <div className="snk-fine">
            <button type="button" className="btn sm quiet" disabled={!canAim} onClick={() => nudge(-0.5)} aria-label="Aim a little left">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="tiny muted">Fine aim</span>
            <button type="button" className="btn sm quiet" disabled={!canAim} onClick={() => nudge(0.5)} aria-label="Aim a little right">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <label className="snk-power">
            <span className="tiny">Power {Math.round(power * 100)}%</span>
            <input type="range" min={0.05} max={1} step={0.01} value={power} onChange={(e) => setPower(Number(e.target.value))} style={{ ["--p" as string]: `${power * 100}%` }} />
          </label>
          <button
            type="button"
            className="snk-spin"
            disabled={!canAim}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const v = -((e.clientY - r.top) / r.height - 0.5) * 2;
              setSpin(Math.abs(v) < 0.2 ? 0 : Math.max(-1, Math.min(1, v)));
            }}
            aria-label={`Spin: ${spinLabel}. Tap the top for follow, the bottom for draw.`}
          >
            <i style={{ top: `${50 - spin * 34}%` }} />
            <span className="tiny">{spinLabel}</span>
          </button>
          <button type="button" className="btn go snk-shoot" disabled={!canAim} onClick={() => void shoot()}>
            Shoot
          </button>
          {!live && state.over && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setState(poolStart());
                setAim(0);
              }}
            >
              New game
            </button>
          )}
        </div>
      )}
      <span className="tiny muted">Drag on the table to aim, set the power, tap the white ball for follow (top) or draw (bottom), then shoot.{live ? "" : " Practice: you play both sides."}</span>
    </div>
  );
}
