// Phone → Music: radio stations playing original music made live in the browser (Web Audio: no recordings, nothing
// to license or download). Every track is new: its own key, chords, groove and melody from a seed, with an invented
// title and artist; tracks run 2-3 minutes and the next one follows. One player for the whole game (keeps playing
// while you move about); screens read it with useMusic().

import { useSyncExternalStore } from "react";

export type StationKey = "afro" | "piano" | "highlife" | "drums" | "praise" | "chill";
export interface Station {
  key: StationKey;
  name: string;
  blurb: string;
  icon: string;
  tint: string;
  bpm: [number, number];
  minor: number;
  artists: readonly string[];
}
export const STATIONS: readonly Station[] = [
  { key: "afro", name: "Gidi Afrobeats", blurb: "Hits for the danfo and the dance floor", icon: "🔥", tint: "#e4572e", bpm: [100, 108], minor: 0.6, artists: ["Kolawave", "Ada Sparks", "Zee Bello", "Yemi Cruise", "Chuks Groove"] },
  { key: "piano", name: "Log Drum Lounge", blurb: "Amapiano for late nights", icon: "🎹", tint: "#5b2a86", bpm: [110, 114], minor: 0.8, artists: ["DJ Lagoon Deep", "Bisi Keys", "Thabo & Tolu", "Night Shift Collective"] },
  { key: "highlife", name: "Highlife Gold", blurb: "Sweet guitars, old-school owambe", icon: "🎸", tint: "#f2b705", bpm: [118, 126], minor: 0.2, artists: ["Papa Okon & His Stars", "The Lagoon Rhythm Kings", "Emeka Strings", "Sweet Harmattan Band"] },
  { key: "drums", name: "Talking Drum Radio", blurb: "Fuji and juju drums, shekere and bells", icon: "🥁", tint: "#8c2f1d", bpm: [94, 102], minor: 0.5, artists: ["Alhaji Gbedu Ensemble", "Ola Drums", "Iya Ilu Sisters", "Ayan Brothers"] },
  { key: "praise", name: "Sunday Praise", blurb: "Warm organ and handclaps", icon: "🙏🏾", tint: "#1e7a46", bpm: [70, 78], minor: 0.15, artists: ["Joyful Voices Choir", "Brother Femi & Friends", "Morning Dew Singers"] },
  { key: "chill", name: "Study & Chill", blurb: "Soft keys and slow beats for work", icon: "📚", tint: "#2f5fb3", bpm: [76, 84], minor: 0.5, artists: ["Harmattan Tapes", "Nkem Starr", "Quiet Mainland", "Rainy Lekki"] },
];
export const STATION_BY_KEY = new Map(STATIONS.map((s) => [s.key, s]));

const WORD_A = ["Danfo", "Lagoon", "Owambe", "Jollof", "Island", "Harmattan", "Suya", "Ankara", "Midnight", "Eko", "Balogun", "Mainland", "Sunday", "Gidi", "Lekki", "Molue", "Rainy", "Golden", "Third Mainland", "Area"];
const WORD_B = ["Dreams", "Groove", "Nights", "Vibes", "Love", "Party", "Sunrise", "Shuffle", "Dance", "Road", "Fever", "Steps", "Story", "Blessings", "Waves", "Feelings", "Hustle", "Gbedu", "Sweetness", "Express"];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Track {
  seed: number;
  title: string;
  artist: string;
  bpm: number;
  /** MIDI note of the key's root (bass register). */
  root: number;
  minor: boolean;
  /** Scale degrees of the chords, one per bar, round and round. */
  prog: number[];
  bars: number;
}
export function makeTrack(station: Station, seed: number): Track {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const minor = r() < station.minor;
  const progs = minor ? [[0, 5, 3, 4], [0, 3, 4, 3], [0, 6, 5, 4], [0, 3, 0, 4]] : [[0, 4, 5, 3], [0, 3, 4, 4], [0, 5, 3, 4], [0, 3, 0, 4]];
  const bpm = Math.round(station.bpm[0] + r() * (station.bpm[1] - station.bpm[0]));
  return {
    seed,
    title: `${pick(WORD_A)} ${pick(WORD_B)}`,
    artist: pick(station.artists),
    bpm,
    root: 40 + Math.floor(r() * 8),
    minor,
    prog: pick(progs),
    // About two and a half minutes.
    bars: Math.round((150 * bpm) / 60 / 4 / 4) * 4,
  };
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** The sound engine for one station: schedules sixteenth notes a little ahead of time. */
class Player {
  ctx: AudioContext;
  out: GainNode;
  bus: GainNode;
  private noise: AudioBuffer;
  private timer = 0;
  private step = 0;
  private nextAt = 0;
  private melody = new Map<number, (number | null)[]>();
  constructor(
    private station: Station,
    public track: Track,
    volume: number,
    private onEnd: () => void,
  ) {
    this.ctx = new AudioContext();
    this.out = this.ctx.createGain();
    this.out.gain.value = volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.55;
    this.bus.connect(comp).connect(this.out).connect(this.ctx.destination);
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
  }
  start() {
    void this.ctx.resume();
    this.nextAt = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stop() {
    window.clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.08);
    window.setTimeout(() => void this.ctx.close(), 400);
  }
  setVolume(v: number) {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
  get elapsed() {
    return this.step / 16 / this.track.bars;
  }

  private schedule() {
    const sixteenth = 60 / this.track.bpm / 4;
    while (this.nextAt < this.ctx.currentTime + 0.12) {
      if (this.step >= this.track.bars * 16) {
        window.clearInterval(this.timer);
        this.onEnd();
        return;
      }
      // A little swing on the off sixteenths for the chill station.
      const swing = this.station.key === "chill" && this.step % 2 === 1 ? sixteenth * 0.18 : 0;
      this.play(this.step, this.nextAt + swing);
      this.nextAt += sixteenth;
      this.step++;
    }
  }

  // --- instruments ---
  private env(t: number, vol: number, attack: number, dur: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.bus);
    return g;
  }
  private tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType = "sine", attack = 0.005, glideTo?: number) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.8);
    o.connect(this.env(t, vol, attack, dur));
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private hit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    s.connect(f).connect(this.env(t, vol, 0.002, dur));
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }
  private kick(t: number, vol = 0.9) {
    this.tone(120, t, 0.28, vol, "sine", 0.002, 42);
  }
  private chord(bar: number): number[] {
    const scale = this.track.minor ? MINOR : MAJOR;
    const deg = this.track.prog[bar % this.track.prog.length]!;
    const note = (k: number) => this.track.root + 12 + scale[(deg + k) % 7]! + 12 * Math.floor((deg + k) / 7);
    return [note(0), note(2), note(4), note(6)];
  }
  /** The melody for a bar: a phrase that repeats every four bars and changes every sixteen. */
  private phrase(bar: number): (number | null)[] {
    const key = Math.floor(bar / 16) * 4 + (bar % 4);
    let m = this.melody.get(key);
    if (!m) {
      const r = rng(this.track.seed * 31 + key);
      const penta = this.track.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
      let i = Math.floor(r() * 5);
      m = Array.from({ length: 16 }, (_, s) => {
        if (r() > (s % 4 === 0 ? 0.75 : s % 2 === 0 ? 0.45 : 0.15)) return null;
        i = Math.max(0, Math.min(9, i + Math.floor(r() * 5) - 2));
        return this.track.root + 24 + penta[i % 5]! + 12 * Math.floor(i / 5);
      });
      this.melody.set(key, m);
    }
    return m;
  }

  private play(n: number, t: number) {
    const s = n % 16;
    const bar = Math.floor(n / 16);
    const total = this.track.bars;
    // Intro (drums only) and outro (fade).
    const intro = bar < 2;
    const outro = bar >= total - 2;
    const chord = this.chord(bar);
    const bassNote = hz(this.track.root + (this.track.minor ? MINOR : MAJOR)[this.track.prog[bar % this.track.prog.length]!]!);
    const lead = this.phrase(bar)[s];
    const leadOn = !intro && !outro && bar % 8 >= 4;
    if (outro && s === 0) this.bus.gain.setTargetAtTime(0.0001, t, 1.2);
    switch (this.station.key) {
      case "afro": {
        if ([0, 7, 8, 14].includes(s)) this.kick(t, s % 8 === 0 ? 0.9 : 0.5);
        if (s === 4 || s === 12) this.hit(t, 0.12, 0.35, "bandpass", 1800);
        this.hit(t, 0.03, s % 2 ? 0.14 : 0.07, "highpass", 7000);
        if ([2, 5, 10, 13].includes(s)) this.tone(s % 5 === 0 ? 260 : 200, t, 0.12, 0.18, "sine", 0.002, 150);
        if (!intro && [0, 3, 6, 10, 12].includes(s)) this.tone(bassNote * (s === 6 ? 2 : 1), t, 0.25, 0.45, "triangle");
        if (!intro && [2, 6, 10, 14].includes(s)) chord.slice(0, 3).forEach((m) => this.tone(hz(m), t, 0.14, 0.05, "sawtooth"));
        if (leadOn && lead !== null && lead !== undefined) this.tone(hz(lead), t, 0.2, 0.08, "square");
        break;
      }
      case "piano": {
        if (s % 4 === 0) this.kick(t, 0.55);
        this.hit(t, 0.025, s % 2 ? 0.1 : 0.05, "highpass", 8000);
        if (s === 4 || s === 12) this.hit(t, 0.06, 0.18, "bandpass", 2600);
        // The log drum: a deep sliding note.
        if (!intro && [0, 3, 6, 10, 11, 14].includes(s)) this.tone(bassNote * (s === 11 ? 1.5 : 1), t, 0.35, 0.5, "sine", 0.004, bassNote * 0.75);
        if (!intro && (s === 0 || s === 10)) chord.forEach((m) => this.tone(hz(m), t, 1.1, 0.045, "triangle", 0.01));
        if (leadOn && s % 2 === 0 && lead !== null && lead !== undefined) this.tone(hz(lead + 12), t, 0.3, 0.05, "sine");
        break;
      }
      case "highlife": {
        if (s === 0 || s === 8) this.kick(t, 0.6);
        if (s % 2 === 0) this.hit(t, 0.03, 0.08, "highpass", 6500);
        if ([0, 3, 6, 10, 12].includes(s)) this.hit(t, 0.04, 0.16, "bandpass", 3200);
        if (!intro && [0, 6, 8, 14].includes(s)) this.tone(bassNote, t, 0.3, 0.42, "triangle");
        // Two guitars picking through the chord, interlocking.
        if (!intro) {
          const a = chord[[0, 2, 1, 3][s % 4]!]! + 12;
          this.tone(hz(a), t, 0.16, 0.07, "triangle", 0.002);
          if (s % 4 === 2) this.tone(hz(chord[1]! + 24), t, 0.12, 0.04, "square", 0.002);
        }
        if (leadOn && lead !== null && lead !== undefined) this.tone(hz(lead + 12), t, 0.18, 0.06, "triangle");
        break;
      }
      case "drums": {
        if (s === 0 || s === 8 || s === 11) this.kick(t, 0.7);
        if (s % 2 === 0) this.hit(t, 0.06, 0.12, "bandpass", 5200);
        if ([0, 3, 6, 8, 11, 14].includes(s)) this.tone(s % 3 === 0 ? 880 : 660, t, 0.08, 0.06, "square");
        // The talking drum: pitch bends from the phrase rhythm.
        const tk = this.phrase(bar)[s];
        if (!intro && tk !== null && tk !== undefined) {
          const f = 140 + ((tk - this.track.root) % 12) * 12;
          this.tone(f, t, 0.22, 0.35, "sine", 0.003, s % 3 === 0 ? f * 1.4 : f * 0.7);
        }
        if (!intro && s === 0 && bar % 2 === 0) chord.slice(0, 3).forEach((m) => this.tone(hz(m - 12), t, 2.2, 0.025, "sine", 0.3));
        break;
      }
      case "praise": {
        if (s === 0 || s === 8) this.kick(t, 0.4);
        if (s === 4 || s === 12) this.hit(t, 0.1, 0.28, "bandpass", 1500);
        if (!intro) this.hit(t, 0.03, 0.04, "highpass", 9000);
        // The organ: soft-attack chords held for the bar, a bass under them.
        if (!intro && s === 0)
          chord.slice(0, 3).forEach((m) => {
            this.tone(hz(m), t, 3.2, 0.05, "sine", 0.15);
            this.tone(hz(m + 12), t, 3.2, 0.02, "sine", 0.15);
          });
        if (!intro && (s === 0 || s === 8)) this.tone(bassNote, t, 1.2, 0.35, "sine", 0.02);
        if (leadOn && s % 4 === 0 && lead !== null && lead !== undefined) this.tone(hz(lead), t, 0.6, 0.06, "triangle", 0.03);
        break;
      }
      case "chill": {
        if (s === 0 || s === 10) this.kick(t, 0.5);
        if (s === 8) this.hit(t, 0.12, 0.16, "bandpass", 1400);
        if (s % 2 === 0) this.hit(t, 0.03, 0.05, "highpass", 7500);
        if (s === 0) this.hit(t, 1.6, 0.012, "highpass", 3000);
        if (!intro && s === 0) chord.forEach((m) => this.tone(hz(m), t, 2.6, 0.045, "triangle", 0.02));
        if (!intro && (s === 0 || s === 7)) this.tone(bassNote, t, 0.6, 0.3, "sine");
        if (leadOn && s % 2 === 0 && lead !== null && lead !== undefined) this.tone(hz(lead), t, 0.45, 0.05, "sine", 0.01);
        break;
      }
    }
  }
}

// --- the one player for the game, and its state for screens ---
export interface MusicState {
  playing: boolean;
  station: StationKey;
  track: Track | null;
  volume: number;
}
const PREF = "hc_music";
const load = (): { station: StationKey; volume: number; n: number } => {
  try {
    const v = JSON.parse(localStorage.getItem(PREF) ?? "null") as { station?: StationKey; volume?: number; n?: number } | null;
    return { station: v?.station && STATION_BY_KEY.has(v.station) ? v.station : "afro", volume: typeof v?.volume === "number" ? v.volume : 0.7, n: v?.n ?? Math.floor(Math.random() * 1e6) };
  } catch {
    return { station: "afro", volume: 0.7, n: Math.floor(Math.random() * 1e6) };
  }
};
const pref = load();
let state: MusicState = { playing: false, station: pref.station, track: null, volume: pref.volume };
let player: Player | null = null;
let counter = pref.n;
const listeners = new Set<() => void>();
const set = (next: Partial<MusicState>) => {
  state = { ...state, ...next };
  try {
    localStorage.setItem(PREF, JSON.stringify({ station: state.station, volume: state.volume, n: counter }));
  } catch {
    /* not essential */
  }
  listeners.forEach((f) => f());
  // The city sounds step back while music plays (Ambience listens).
  window.dispatchEvent(new CustomEvent("hc:music", { detail: state.playing }));
};

function startTrack(key: StationKey) {
  player?.stop();
  const station = STATION_BY_KEY.get(key)!;
  const track = makeTrack(station, ++counter * 7919 + STATIONS.indexOf(station));
  player = new Player(station, track, state.volume, () => startTrack(key));
  player.start();
  set({ playing: true, station: key, track });
}

export const music = {
  play(key?: StationKey) {
    startTrack(key ?? state.station);
  },
  pause() {
    player?.stop();
    player = null;
    set({ playing: false });
  },
  toggle() {
    if (state.playing) this.pause();
    else this.play();
  },
  next() {
    startTrack(state.station);
  },
  setVolume(v: number) {
    player?.setVolume(v);
    set({ volume: v });
  },
  progress: () => player?.elapsed ?? 0,
};

/** The player's state now (outside React). */
export const musicState = () => state;

export function useMusic(): MusicState {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => state,
  );
}
