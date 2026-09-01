// Ambient sound, made live in the browser (Web Audio, no recordings to license): the city by day (traffic hum,
// far horns, birds), rain and thunder, crickets in the evening, and an Afrobeats-style groove inside clubs and
// parties. Off until the player turns it on (browsers only allow sound after a tap); the choice is remembered.
import type { Weather } from "@hc/shared";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type SoundScene = "street" | "club" | "quiet" | "beach" | "beach-rave";
const KEY = "hc_sound";

/**
 * The call to prayer (adhan): a real recording, CC0 (public domain) from Wikimedia Commons, "Beautiful adhan.ogg"
 * by Adam-synagda (credits in public/audio/CREDITS.md). It sounds across the city, softly, at the five daily prayer
 * times (Lagos, rounded), and plays inside the mosque. Other code asks for it with the "hc:adhan" event.
 */
const ADHAN_SRC = "/audio/adhan.mp3";
/** Lagos prayer times, hours (Fajr, Dhuhr, Asr, Maghrib, Isha); they barely move through the year near the equator. */
export const PRAYER_HOURS = [5 + 20 / 60, 13, 16 + 15 / 60, 18 + 50 / 60, 20 + 5 / 60];
export const playAdhan = (volume: number) => window.dispatchEvent(new CustomEvent("hc:adhan", { detail: volume }));
export const stopAdhan = () => window.dispatchEvent(new Event("hc:adhan-stop"));

function noiseBuffer(ctx: AudioContext, seconds = 2, brown = false) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

/** One running soundscape; `set` changes what plays, `stop` silences it. */
class Engine {
  ctx = new AudioContext();
  master = this.ctx.createGain();
  layers = new Map<string, { gain: GainNode; stop: () => void }>();
  timers: number[] = [];
  constructor() {
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }
  private fade(name: string, to: number) {
    const l = this.layers.get(name);
    if (l) l.gain.gain.setTargetAtTime(to, this.ctx.currentTime, 0.8);
  }
  private loopNoise(name: string, brown: boolean, filter: BiquadFilterType, freq: number, vol: number) {
    if (this.layers.has(name)) return this.fade(name, vol);
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx, 3, brown);
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.8);
    this.layers.set(name, { gain: g, stop: () => src.stop() });
  }
  private blip(freq: number, dur: number, vol: number, type: OscillatorType = "sine", at = this.ctx.currentTime) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  }
  private every(ms: number, fn: () => void) {
    this.timers.push(window.setInterval(fn, ms));
  }
  private clearTimers() {
    this.timers.forEach((t) => window.clearInterval(t));
    this.timers = [];
  }

  set(scene: SoundScene, weather: Weather, hour: number) {
    this.clearTimers();
    const night = hour >= 19 || hour < 6;
    const wet = weather === "rain" || weather === "storm";
    // Rain under everything when it's raining.
    if (wet) this.loopNoise("rain", false, "highpass", 900, weather === "storm" ? 0.22 : 0.14);
    else this.fade("rain", 0);
    if (weather === "storm")
      this.every(9000, () => {
        if (Math.random() < 0.5) return;
        // Thunder: a low rumble of brown noise.
        const src = this.ctx.createBufferSource();
        src.buffer = noiseBuffer(this.ctx, 3, true);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.9, this.ctx.currentTime + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 2.8);
        src.connect(g).connect(this.master);
        src.start();
      });

    // The beach: waves rolling in and out (and gulls by day); at the rave, the groove plays over the waves.
    if (scene === "beach" || scene === "beach-rave") {
      this.fade("city", 0);
      this.fade("crickets", 0);
      this.loopNoise("waves", true, "lowpass", 650, 0.22);
      const waves = this.layers.get("waves")!.gain.gain;
      this.every(4200, () => {
        const t = this.ctx.currentTime;
        waves.cancelScheduledValues(t);
        waves.setValueAtTime(0.08, t);
        waves.linearRampToValueAtTime(0.32, t + 1.6);
        waves.linearRampToValueAtTime(0.1, t + 4);
      });
      if (!night && !wet)
        this.every(5200, () => {
          if (Math.random() < 0.6) return;
          const t = this.ctx.currentTime;
          for (let i = 0; i < 2; i++) {
            const o = this.blip(1700, 0.22, 0.02, "triangle", t + i * 0.28);
            o.frequency.setValueAtTime(1700, t + i * 0.28);
            o.frequency.exponentialRampToValueAtTime(1100, t + i * 0.28 + 0.2);
          }
        });
      if (scene === "beach") return;
    } else this.fade("waves", 0);

    if (scene === "club" || scene === "beach-rave") {
      this.fade("city", 0.02);
      this.fade("crickets", 0);
      // ~104 bpm groove: kick on the beat, shaker on eighths, log-drum bass and a chord stab.
      const beat = 60 / 104;
      let step = 0;
      const bass = [55, 0, 73.4, 55, 0, 82.4, 73.4, 0];
      this.every(beat * 500, () => {
        const t = this.ctx.currentTime + 0.02;
        if (step % 2 === 0) {
          const k = this.blip(110, 0.25, 0.6, "sine", t);
          k.frequency.setValueAtTime(110, t);
          k.frequency.exponentialRampToValueAtTime(40, t + 0.2);
        }
        this.blip(6000, 0.04, 0.05, "square", t);
        const b = bass[step % bass.length]!;
        if (b) this.blip(b, 0.3, 0.35, "triangle", t);
        if (step % 8 === 3) [261.6, 329.6, 392].forEach((f) => this.blip(f, 0.18, 0.06, "sawtooth", t));
        step++;
      });
      return;
    }
    if (scene === "quiet") {
      this.fade("city", 0.03);
      this.fade("crickets", night ? 0.03 : 0);
      return;
    }
    // Street: city hum, far horns and okada engines, birds by day, crickets at night.
    this.loopNoise("city", true, "lowpass", 420, night ? 0.08 : 0.16);
    this.every(2600, () => {
      if (Math.random() < (night ? 0.15 : 0.35)) {
        const f = 380 + Math.random() * 120;
        this.blip(f, 0.22, 0.05, "square");
        if (Math.random() < 0.5) this.blip(f, 0.18, 0.05, "square", this.ctx.currentTime + 0.3);
      }
    });
    if (night && !wet) {
      this.every(700, () => {
        for (let i = 0; i < 3; i++) this.blip(4200 + Math.random() * 300, 0.04, 0.015, "sine", this.ctx.currentTime + i * 0.06);
      });
    } else if (!wet) {
      this.every(3100, () => {
        if (Math.random() < 0.5) return;
        const t = this.ctx.currentTime;
        const o = this.blip(2400, 0.18, 0.025, "sine", t);
        o.frequency.setValueAtTime(2400, t);
        o.frequency.exponentialRampToValueAtTime(3600, t + 0.15);
      });
    }
  }
  stop() {
    this.clearTimers();
    this.layers.forEach((l) => l.stop());
    this.layers.clear();
    void this.ctx.close();
  }
}

/** The sound button (map controls) and the engine behind it. */
export function SoundToggle({ scene, weather, hour }: { scene: SoundScene; weather: Weather; hour: number }) {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "on";
    } catch {
      return false;
    }
  });
  const engine = useRef<Engine | null>(null);
  // Browsers need a tap before sound: a saved "on" waits for the first tap anywhere.
  useEffect(() => {
    if (!on) {
      engine.current?.stop();
      engine.current = null;
      return;
    }
    const start = () => {
      if (!engine.current) engine.current = new Engine();
      void engine.current.ctx.resume();
      engine.current.set(scene, weather, hour);
    };
    start();
    if (engine.current?.ctx.state !== "running") {
      const once = () => start();
      window.addEventListener("pointerdown", once, { once: true });
      return () => window.removeEventListener("pointerdown", once);
    }
  }, [on]);
  useEffect(() => {
    engine.current?.set(scene, weather, Math.floor(hour));
  }, [scene, weather, Math.floor(hour)]);
  useEffect(() => () => engine.current?.stop(), []);
  // The adhan: on request (inside the mosque) and at prayer times, only with sound on.
  const adhan = useRef<HTMLAudioElement | null>(null);
  const onRef = useRef(on);
  onRef.current = on;
  useEffect(() => {
    const play = (e: Event) => {
      if (!onRef.current) return;
      const vol = (e as CustomEvent<number>).detail;
      const a = (adhan.current ??= new Audio(ADHAN_SRC));
      a.volume = Math.min(1, Math.max(0, vol));
      if (a.paused) {
        a.currentTime = 0;
        void a.play().catch(() => undefined);
      }
    };
    const stop = () => adhan.current?.pause();
    window.addEventListener("hc:adhan", play);
    window.addEventListener("hc:adhan-stop", stop);
    return () => {
      window.removeEventListener("hc:adhan", play);
      window.removeEventListener("hc:adhan-stop", stop);
      adhan.current?.pause();
    };
  }, []);
  useEffect(() => {
    if (!on) adhan.current?.pause();
  }, [on]);
  // At each prayer time (within its first two minutes), once.
  const called = useRef<number | null>(null);
  const due = PRAYER_HOURS.find((p) => hour >= p && hour < p + 2 / 60) ?? null;
  useEffect(() => {
    if (due === null || called.current === due) return;
    called.current = due;
    playAdhan(scene === "quiet" ? 0.25 : 0.4);
  }, [due]);
  const toggle = () => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* not essential */
    }
  };
  return (
    <button type="button" className="map-ctl" onClick={toggle} aria-pressed={on} aria-label={on ? "Sound off" : "Sound on"} title={on ? "Sound off" : "Sound on"}>
      {on ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
    </button>
  );
}
