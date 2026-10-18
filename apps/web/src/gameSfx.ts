// Little game sounds (Ayo seeds dropping, snooker balls clicking), made on the fly with Web Audio: no files to load.
// Players can mute them (remembered on this device); they only ever play after a tap, as browsers require.
import { useState } from "react";

const KEY = "hc_game_sfx";
let ctx: AudioContext | null = null;
let on = (() => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
})();

const audio = () => {
  if (!on) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

/** A short knock: `pitch` in Hz, `loud` 0..1, `ring` how long it rings (s), `noise` for a woody click. */
function knock(pitch: number, loud: number, ring = 0.06, noise = 0.4) {
  const c = audio();
  if (!c || loud <= 0.01) return;
  const t = c.currentTime;
  const gain = c.createGain();
  gain.gain.setValueAtTime(Math.min(1, loud) * 0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ring);
  gain.connect(c.destination);
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(pitch, t);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + ring);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + ring);
  if (noise > 0) {
    const len = Math.floor(c.sampleRate * 0.015);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const ng = c.createGain();
    ng.gain.value = Math.min(1, loud) * noise * 0.5;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    src.connect(hp).connect(ng).connect(c.destination);
    src.start(t);
  }
}

export const sfx = {
  /** A seed dropping into a wooden pit (a little higher each seed, like counting). */
  seed: (n = 0) => knock(520 + (n % 6) * 40, 0.55, 0.05, 0.6),
  /** Seeds swept into the store. */
  capture: () => {
    knock(330, 0.6, 0.12, 0.8);
    window.setTimeout(() => knock(390, 0.5, 0.1, 0.8), 70);
  },
  /** Ball on ball, as hard as they met. */
  ball: (speed: number) => knock(1900 + Math.random() * 300, Math.min(1, speed / 18), 0.035, 0.9),
  cushion: (speed: number) => knock(140, Math.min(0.8, speed / 25), 0.08, 0.15),
  pocket: () => {
    knock(110, 0.6, 0.18, 0.2);
    window.setTimeout(() => knock(90, 0.4, 0.15, 0.1), 90);
  },
  cue: (power: number) => knock(900, 0.3 + power * 0.5, 0.04, 1),
};

/** The 🔊 switch shown on the games. */
export function useGameSound(): [boolean, () => void] {
  const [state, setState] = useState(on);
  return [
    state,
    () => {
      on = !on;
      setState(on);
      try {
        localStorage.setItem(KEY, on ? "on" : "off");
      } catch {}
    },
  ];
}
