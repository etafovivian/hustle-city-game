import { DEFAULT_AVATAR, checkNickname, type AvatarConfig, type Me } from "@hc/shared";
import { AlertCircle, ArrowRight, Coins, Eye, EyeOff, MapPin, Search, Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api.js";
import { printUrl } from "../prints.js";
import { AvatarPicker } from "./Avatar.js";
import { Selvedge } from "./ui.js";

type Mode = "register" | "login";

function Tabs({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="segmented" role="tablist" aria-label="Account">
      <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>
        New here
      </button>
      <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>
        Sign in
      </button>
    </div>
  );
}

/** Rough strength: length and variety. Server only requires 10+ characters. */
function strength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = pw.length >= 10 ? 2 : 1;
  if (pw.length >= 14) score++;
  if (/[^A-Za-z]/.test(pw) && /[A-Za-z]/.test(pw)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
const STRENGTH_LABEL = ["", "Too short", "Okay", "Good", "Strong"];

export function AuthScreen({ onSignedIn, onBrowse }: { onSignedIn: (me: Me) => void; onBrowse: () => void }) {
  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needAdult, setNeedAdult] = useState(false);

  const nickCheck = nickname ? checkNickname(nickname) : null;
  const registering = mode === "register";
  const pwScore = strength(password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (registering && !adult) {
      setNeedAdult(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = registering
        ? await api<Me>("POST", "/api/auth/register", { email, password, nickname, avatar, confirmAdult: adult })
        : await api<Me>("POST", "/api/auth/login", { email, password });
      onSignedIn(me);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="welcome">
      {/* Desktop brand panel */}
      <aside className="welcome-cloth" style={{ backgroundImage: printUrl("market") }} aria-label="About Naija Hustle City">
        <span className="status-pill">
          <span className="status-dot" aria-hidden="true" /> Junction 101 · Private beta
        </span>
        <div className="brand-card">
          <div className="brand-head">
            <img className="brand-logo" src="/art/logo.webp" alt="" width={96} height={96} />
            <h1 className="brand-name">
              Naija <span>Hustle</span> City
            </h1>
          </div>
          <p>Open your shop in Junction 101, serve customers, clear daily quests, and find real Lagos businesses near you.</p>
          <ul className="feature-list">
            <li>
              <span className="feature-icon">
                <Store size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>Run a shop:</strong> stock it, price it, collect your takings.
              </span>
            </li>
            <li>
              <span className="feature-icon">
                <MapPin size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>Explore:</strong> walk Market Square, Work Hub and The Hangout.
              </span>
            </li>
            <li>
              <span className="feature-icon">
                <Search size={18} aria-hidden="true" />
              </span>
              <span>
                <strong>Real merchants:</strong> or skip the game and find Lagos sellers straight away.
              </span>
            </li>
          </ul>
          <div>
            <button className="btn go cta" onClick={onBrowse}>
              Browse merchants <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <Selvedge rule="City Coins are game money — no cash value" />
      </aside>

      <div>
        {/* Mobile hero: the street at night */}
        <header className="welcome-hero" style={{ backgroundImage: "url(/art/street-scene.webp)" }}>
          <div className="hero-tabs">
            <Tabs mode={mode} setMode={setMode} />
          </div>
          <img className="brand-logo" src="/art/logo.webp" alt="Naija Hustle City" width={140} height={140} />
        </header>
        <div className="welcome-hero-strip">
          <Selvedge rule="City Coins are game money — no cash value" />
        </div>

        <section className="welcome-form">
          <form className="welcome-form-inner" onSubmit={(e) => void submit(e)}>
            <div className="form-tabs">
              <Tabs mode={mode} setMode={setMode} />
            </div>

            <div className="stack intro-card" style={{ gap: 8 }}>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
                {registering ? (
                  <>
                    Get your shop in <em>Junction 101</em>
                  </>
                ) : (
                  <>
                    Welcome back, <em>hustler</em>
                  </>
                )}
              </h2>
              {registering ? (
                <p className="coin-line">
                  <span className="coin-badge" aria-hidden="true">
                    <Coins size={13} />
                  </span>
                  <span>
                    You start with <strong>2,000 City Coins</strong> to stock your shelves.
                  </span>
                </p>
              ) : (
                <p className="muted">Your shop kept selling while you were away. Sign in to collect your takings.</p>
              )}
            </div>

            <label className="field">
              <span className="field-label">Email</span>
              <span className="input-wrap">
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. ayo@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-wrap">
                <input
                  className="input has-reveal"
                  type={reveal ? "text" : "password"}
                  autoComplete={registering ? "new-password" : "current-password"}
                  minLength={registering ? 10 : undefined}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="reveal" onClick={() => setReveal((r) => !r)} aria-label={reveal ? "Hide password" : "Show password"}>
                  {reveal ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </span>
              {registering && (
                <>
                  <span className="strength" aria-hidden="true">
                    {[1, 2, 3, 4].map((i) => (
                      <i key={i} data-on={i <= pwScore ? (pwScore >= 3 ? "1" : "2") : "0"} />
                    ))}
                  </span>
                  <span className="hint">
                    At least 10 characters{password ? ` · ${STRENGTH_LABEL[pwScore]}` : ""}.
                  </span>
                </>
              )}
            </label>

            {registering && (
              <>
                <label className="field">
                  <span className="field-label">Nickname</span>
                  <span className="input-wrap">
                    <span className="prefix" aria-hidden="true">
                      @
                    </span>
                    <input
                      className="input"
                      required
                      maxLength={20}
                      placeholder="lagos_baller"
                      autoComplete="nickname"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                    />
                  </span>
                  {nickCheck && !nickCheck.ok ? (
                    <span className="err">{nickCheck.reason}</span>
                  ) : (
                    <span className="hint">This is how other players see you. Letters, numbers and _ only.</span>
                  )}
                </label>

                <hr className="section-divider" />
                <AvatarPicker value={avatar} onChange={setAvatar} />

                <label className="check">
                  <input
                    type="checkbox"
                    checked={adult}
                    aria-invalid={needAdult && !adult}
                    aria-describedby={needAdult && !adult ? "adult-err" : undefined}
                    onChange={(e) => {
                      setAdult(e.target.checked);
                      setNeedAdult(false);
                    }}
                  />
                  <span>I am 18 or older.</span>
                </label>
                {needAdult && !adult && (
                  <p id="adult-err" className="check-err" role="alert">
                    Tick to confirm you're 18 or older. Naija Hustle City is for adults.
                  </p>
                )}
              </>
            )}

            {error && (
              <p className="alert" role="alert">
                <AlertCircle size={18} aria-hidden="true" /> {error}
              </p>
            )}

            <button
              className="btn primary block cta cta-xl"
              type="submit"
              disabled={busy}
            >
              {busy ? "One moment…" : registering ? "Start hustling in Junction 101" : "Sign in"}
              {!busy && <ArrowRight size={20} aria-hidden="true" />}
            </button>

            <p className="guest-line">
              {registering ? "Not ready to open shop? " : "New to the city? "}
              <button type="button" onClick={registering ? onBrowse : () => setMode("register")}>
                {registering ? "Browse merchants as guest" : "Join Junction 101"}
              </button>
            </p>

            <p className="welcome-foot">© 2026 Naija Hustle City</p>
          </form>
        </section>
      </div>
    </div>
  );
}
