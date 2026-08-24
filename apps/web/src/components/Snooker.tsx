// Snooker on a canvas: drag from the cue ball to aim (pull back like a cue), set the power, shoot. Solo practice
// plays locally; with a friend, the server plays each shot and both phones animate it from the same start.
import { TABLE, poolLeft, poolShoot, poolStart, poolStep, type Ball, type BallKind, type PoolState } from "@hc/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const COLOR: Record<BallKind, string> = { cue: "#f8f5ec", red: "#d6302a", yellow: "#f2c21b", black: "#151515" };

interface LiveView {
  id: string;
  names: [string, string];
  you: 0 | 1;
  state: PoolState;
  before: PoolState;
  last: { angle: number; power: number } | null;
}

export function Snooker({ id, notify }: { id?: string; notify: (m: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<PoolState>(poolStart);
  const [live, setLive] = useState<LiveView | null>(null);
  const [aim, setAim] = useState(0);
  const [power, setPower] = useState(0.6);
  const [rolling, setRolling] = useState(false);
  const shownShots = useRef(0);
  const anim = useRef<number>(0);

  const draw = (balls: Ball[], showAim: boolean) => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const k = c.width / TABLE.w;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#5b3a1e";
    ctx.fillRect(-40, -40, TABLE.w + 80, TABLE.h + 80);
    ctx.fillStyle = "#1f7a3e";
    ctx.fillRect(0, 0, TABLE.w, TABLE.h);
    ctx.fillStyle = "#0b0b0b";
    for (const [px, py] of [[0, 0], [TABLE.w / 2, -6], [TABLE.w, 0], [0, TABLE.h], [TABLE.w / 2, TABLE.h + 6], [TABLE.w, TABLE.h]]) {
      ctx.beginPath();
      ctx.arc(px!, py!, TABLE.pocket, 0, Math.PI * 2);
      ctx.fill();
    }
    const cue = balls.find((b) => b.kind === "cue");
    if (showAim && cue && !cue.in) {
      ctx.strokeStyle = "rgb(255 255 255 / 55%)";
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cue.x, cue.y);
      ctx.lineTo(cue.x + Math.cos(aim) * 700, cue.y + Math.sin(aim) * 700);
      ctx.stroke();
      ctx.setLineDash([]);
      // The cue stick behind the ball, pulled back by the power.
      ctx.strokeStyle = "#c79a5a";
      ctx.lineWidth = 7;
      const back = 25 + power * 70;
      ctx.beginPath();
      ctx.moveTo(cue.x - Math.cos(aim) * back, cue.y - Math.sin(aim) * back);
      ctx.lineTo(cue.x - Math.cos(aim) * (back + 300), cue.y - Math.sin(aim) * (back + 300));
      ctx.stroke();
    }
    for (const b of balls) {
      if (b.in) continue;
      ctx.fillStyle = COLOR[b.kind];
      ctx.beginPath();
      ctx.arc(b.x, b.y, TABLE.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgb(255 255 255 / 35%)";
      ctx.beginPath();
      ctx.arc(b.x - 4, b.y - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /** Animate a shot from `from` (then land exactly on `to`). */
  const play = (from: PoolState, angle: number, pw: number, to: PoolState) => {
    cancelAnimationFrame(anim.current);
    const balls = from.balls.map((b) => ({ ...b }));
    const cue = balls.find((b) => b.kind === "cue")!;
    const speed = 4 + pw * 26;
    cue.vx = Math.cos(angle) * speed;
    cue.vy = Math.sin(angle) * speed;
    const hits = { first: null as BallKind | null };
    setRolling(true);
    const frame = () => {
      let moving = false;
      for (let i = 0; i < 2; i++) moving = poolStep(balls, hits, []) || moving;
      draw(balls, false);
      if (moving) anim.current = requestAnimationFrame(frame);
      else {
        setRolling(false);
        setState(to);
      }
    };
    anim.current = requestAnimationFrame(frame);
  };

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
        if (g.last) play(g.before, g.last.angle, g.last.power, g.state);
        else setState(g.state);
      } else if (g.state.shots === 0) setState(g.state);
    };
    void load();
    const t = window.setInterval(() => void load(), 1500);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [id]);

  useEffect(() => {
    if (!rolling) draw(state.balls, !state.over && (!live || live.state.turn === live.you));
  });

  const myTurn = !live || state.turn === live.you;
  const shoot = async () => {
    if (rolling || state.over || !myTurn) return;
    if (live) {
      try {
        const g = await api<LiveView>("POST", `/api/games/snooker/${live.id}/shot`, { angle: aim, power });
        shownShots.current = g.state.shots;
        setLive(g);
        play(g.before, aim, power, g.state);
      } catch (e) {
        notify((e as Error).message);
      }
    } else play(state, aim, power, poolShoot(state, aim, power));
  };
  const aimAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * TABLE.w;
    const y = ((e.clientY - r.top) / r.height) * TABLE.h;
    const cue = state.balls.find((b) => b.kind === "cue")!;
    setAim(Math.atan2(y - cue.y, x - cue.x));
  };

  const names = live ? live.names.map((n) => `@${n}`) : ["Reds (you)", "Yellows"];
  const turnName = names[state.turn];
  return (
    <div className="stack snooker">
      <p className="small">
        <b style={{ color: COLOR.red }}>●</b> {names[0]}: {poolLeft(state, 0)} left · <b style={{ color: COLOR.yellow }}>●</b> {names[1]}: {poolLeft(state, 1)} left
      </p>
      <canvas ref={canvas} width={1000} height={500} className="snooker-table" onPointerMove={(e) => e.buttons && aimAt(e)} onPointerDown={aimAt} />
      <p className="small">
        {state.over ? (state.winner === (live?.you ?? 0) ? "You win! 🎉" : `${names[state.winner ?? 1]} wins.`) : `${state.note} ${live ? (myTurn ? "Your shot." : `${turnName} to play…`) : `${turnName} to play.`}`}
      </p>
      <div className="row">
        <label className="small row" style={{ gap: 6, flex: 1 }}>
          Power
          <input type="range" min={0.05} max={1} step={0.01} value={power} onChange={(e) => setPower(Number(e.target.value))} style={{ flex: 1 }} />
        </label>
        <button type="button" className="btn go" disabled={rolling || state.over || !myTurn} onClick={() => void shoot()}>
          Shoot
        </button>
        {!live && state.over && (
          <button type="button" className="btn" onClick={() => setState(poolStart())}>
            New game
          </button>
        )}
      </div>
      <span className="tiny muted">Tap or drag on the table to aim. {live ? "" : "Practice: you play both sides."}</span>
    </div>
  );
}
