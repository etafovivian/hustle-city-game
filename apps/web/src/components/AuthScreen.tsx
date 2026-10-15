import type { Me } from "@hc/shared";
import { AlertCircle, ArrowRight, Eye, EyeOff, MapPin, Search, Store } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api.js";
import { printUrl } from "../prints.js";
import { Onboarding } from "./Onboarding.js";
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

/** Welcome screen: "New here" runs the step-by-step onboarding; "Sign in" is a short form. */
export function AuthScreen({ onSignedIn, onBrowse, notice }: { onSignedIn: (me: Me) => void; onBrowse: () => void; notice?: string | null }) {
  const [mode, setMode] = useState<Mode>(notice ? "login" : "register");
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api<Me>("POST", "/api/auth/login", { email, password }));
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
        {/* Mobile hero: the street at night (sign-in only; onboarding has its own stage) */}
        {!registering && (
        <header className="welcome-hero" style={{ backgroundImage: "url(/art/street-scene.webp)" }}>
          <div className="hero-tabs">
            <Tabs mode={mode} setMode={setMode} />
          </div>
          <img className="brand-logo" src="/art/logo.webp" alt="Naija Hustle City" width={140} height={140} />
        </header>
        )}
        {!registering && (
        <div className="welcome-hero-strip">
          <Selvedge rule="City Coins are game money — no cash value" />
        </div>
        )}

        {registering ? (
          <section className="welcome-form">
            <div className="welcome-form-inner">
              <div className="form-tabs form-tabs-always">
                <Tabs mode={mode} setMode={setMode} />
              </div>
              <Onboarding onSignedIn={onSignedIn} onBrowse={onBrowse} />
            </div>
          </section>
        ) : (
        <section className="welcome-form">
          <form className="welcome-form-inner" onSubmit={(e) => void signIn(e)}>
            <div className="form-tabs">
              <Tabs mode={mode} setMode={setMode} />
            </div>

            <div className="stack intro-card" style={{ gap: 8 }}>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
                Welcome back, <em>hustler</em>
              </h2>
              <p className="muted">Your shop kept selling while you were away. Sign in to collect your takings.</p>
            </div>

            <label className="field">
              <span className="field-label">Email</span>
              <span className="input-wrap">
                <input className="input" type="email" autoComplete="email" placeholder="e.g. ayo@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </span>
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-wrap">
                <input
                  className="input has-reveal"
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="reveal" onClick={() => setReveal((r) => !r)} aria-label={reveal ? "Hide password" : "Show password"}>
                  {reveal ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </span>
            </label>

            {error && (
              <p className="alert" role="alert">
                <AlertCircle size={18} aria-hidden="true" /> {error}
              </p>
            )}

            {notice && !error && (
              <p className="notice small" role="status">
                {notice}
              </p>
            )}
            <button type="button" className="link-btn small" onClick={() => setForgot((f) => !f)} aria-expanded={forgot}>
              Forgot your password?
            </button>
            {forgot && (
              <p className="small muted forgot-note">
                During the private beta, ask the Naija Hustle City team for a reset link. It opens a page where you choose a new password. Reset by email comes before public launch.
              </p>
            )}

            <button className="btn primary block cta cta-xl" type="submit" disabled={busy}>
              {busy ? "One moment…" : "Sign in"}
              {!busy && <ArrowRight size={20} aria-hidden="true" />}
            </button>

            <p className="guest-line">
              New to the city? <button type="button" onClick={() => setMode("register")}>Join Junction 101</button>
            </p>

            <p className="welcome-foot">© 2026 Naija Hustle City</p>
          </form>
        </section>
        )}
      </div>
    </div>
  );
}
