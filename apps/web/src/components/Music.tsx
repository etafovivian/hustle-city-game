// Phone → Music: pick a station and listen while you play. A small player sits above the dock while music is on.
import { Music2, Pause, Play, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { STATIONS, STATION_BY_KEY, music, useMusic } from "../music.js";

function Progress() {
  const [p, setP] = useState(music.progress());
  useEffect(() => {
    const t = window.setInterval(() => setP(music.progress()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="music-progress" aria-hidden="true">
      <span style={{ width: `${Math.min(100, p * 100)}%` }} />
    </span>
  );
}

export function MusicApp() {
  const m = useMusic();
  const st = STATION_BY_KEY.get(m.station)!;
  return (
    <div className="stack">
      <h2 style={{ fontSize: 20 }}>
        <Music2 size={20} aria-hidden="true" /> Music
      </h2>
      <div className="music-now" style={{ ["--tint" as string]: st.tint }}>
        <span className="music-cover" aria-hidden="true">
          {st.icon}
        </span>
        <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
          <strong className="small">{m.playing && m.track ? m.track.title : st.name}</strong>
          <span className="tiny muted">{m.playing && m.track ? `${m.track.artist} · ${st.name}` : "Tap play to listen"}</span>
          {m.playing && <Progress />}
        </div>
        <button type="button" className="btn sm go" onClick={() => music.toggle()} aria-label={m.playing ? "Pause" : "Play"}>
          {m.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
        {m.playing && (
          <button type="button" className="btn sm" onClick={() => music.next()} aria-label="Next track">
            <SkipForward size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <label className="row small" style={{ gap: 8, alignItems: "center" }}>
        Volume
        <input type="range" min={0} max={1} step={0.05} value={m.volume} onChange={(e) => music.setVolume(Number(e.target.value))} style={{ flex: 1 }} aria-label="Volume" />
      </label>
      <h3 className="small">Stations</h3>
      <div className="music-stations">
        {STATIONS.map((s) => (
          <button key={s.key} type="button" className="music-station" aria-pressed={m.playing && m.station === s.key} style={{ ["--tint" as string]: s.tint }} onClick={() => music.play(s.key)}>
            <span className="music-cover" aria-hidden="true">
              {s.icon}
            </span>
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <strong className="small">{s.name}</strong>
              <span className="tiny muted">{s.blurb}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="tiny muted">Every song is made fresh by the game as you listen, so no two are the same.</p>
    </div>
  );
}

/** Above the dock while music plays: what's on, pause, next, and a tap to open the app. */
export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const m = useMusic();
  if (!m.playing || !m.track) return null;
  const st = STATION_BY_KEY.get(m.station)!;
  return (
    <div className="mini-player" style={{ ["--tint" as string]: st.tint }}>
      <button type="button" className="mini-player-info" onClick={onOpen} aria-label="Open Music">
        <span aria-hidden="true">{st.icon}</span>
        <span className="mini-player-text">
          <strong>{m.track.title}</strong> · {m.track.artist}
        </span>
      </button>
      <button type="button" className="mini-player-btn" onClick={() => music.pause()} aria-label="Pause">
        <Pause size={16} aria-hidden="true" />
      </button>
      <button type="button" className="mini-player-btn" onClick={() => music.next()} aria-label="Next track">
        <SkipForward size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
